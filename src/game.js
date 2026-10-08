import * as THREE from "three";
import { createEscapee, createPursuer, CharacterAnimator } from "./characters.js";
import {
  addCoins,
  executeAdminCoinCommand,
  executeGiftCommand,
  getSelectedRank
} from "./economy.js";

const MATCH_TIME=900, PLAYER_HEIGHT=1.72, REQUIRED_TERMINALS=3, REPAIR_TIME=5, WORLD_HALF=137;
const CAMERA_MODES=["FIRST","SECOND","THIRD"], UP=new THREE.Vector3(0,1,0);
const distanceXZ=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.08,...extra});
const box=(name,size,pos,color,custom=null)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),custom||mat(color));m.name=name;m.position.set(...pos);return m};

function storedProfile(){
  for(const key of ["rfl_session_v3","rfl_session_v2","rfl_session_v1"]){
    try{const value=JSON.parse(sessionStorage.getItem(key)||"null");if(value?.displayName)return value}catch{}
  }
  return{id:"local_guest",displayName:"Player",loginId:null,role:"GUEST",title:null,guest:true};
}

function npcProfile(npc){return{id:npc.userData.entityId,loginId:npc.userData.entityId,displayName:npc.userData.name,role:"PLAYER",title:null,npc:true}}

export class Game{
  constructor(container,{role="ESCAPEE",onExit,onRetry,profile,profiles=[],onCoinsChanged}={}){
    Object.assign(this,{container,role,onExit,onRetry,onCoinsChanged});
    this.profile=profile||storedProfile();this.profiles=Array.isArray(profiles)?profiles:[];
    this.keys=new Set();this.collisionBounds=[];this.escapees=[];this.pursuers=[];this.walls=[];this.obstacles=[];this.terminals=[];this.clues=[];this.finalRoutes=[];this.selectedRoute=null;this.routeProgress=0;this.objectiveCooldown=false;
    this.playerPosition=new THREE.Vector3();this.playerModel=null;this.playerAnimator=null;
    this.cameraModeIndex=0;this.cameraMode=CAMERA_MODES[0];this.cameraRay=new THREE.Raycaster();
    this.yaw=0;this.pitch=0;this.elapsed=0;this.stamina=100;this.repaired=0;this.repairProgress=0;
    this.running=false;this.ended=false;this.rewardGranted=false;this.chatOpen=false;this.playerHealth=3;this.lastTeamReplyAt=0;this.teamConversationHistory=[];this.npcConversationMemory=new Map();this.nextAmbientChatAt=performance.now()+5000+Math.random()*5000;this.ambientConversationId=0;this.lastSafePlayerPosition=new THREE.Vector3();this.chatMessages=[];this.chatMaximum=10;
    this.touch={sprint:false,sneak:false,interact:false};this.joystick={x:0,y:0,pointer:null};this.dragPointer=null;
    this.animate=this.animate.bind(this);this.keyDown=this.keyDown.bind(this);this.keyUp=this.keyUp.bind(this);this.mouseMove=this.mouseMove.bind(this);this.resize=this.resize.bind(this);
  }

  start(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071119);this.scene.fog=new THREE.Fog(0x071119,22,95);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,240);this.camera.rotation.order="YXZ";
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.container.appendChild(this.renderer.domElement);
    this.clock=new THREE.Clock();this.createLighting();this.createFacility();this.createInteriors();this.createObjectives();this.rebuildCollisionCache();this.createCharacters();this.createHud();this.createGameChat();this.createTouchControls();this.bindEvents();this.updateCamera();
    this.addSystemMessage(this.role==="PURSUER"?"Coordinate with five Wardens and capture all escapees.":"Your team starts in the north safe zone. Six Wardens begin in the south sector.");
    this.running=true;this.clock.start();this.animate();
  }

  createLighting(){this.scene.add(new THREE.HemisphereLight(0x6c91a8,0x0d1113,1.25));const d=new THREE.DirectionalLight(0xb7ddeb,1.1);d.position.set(20,30,10);this.scene.add(d);const e=new THREE.PointLight(0xff2424,2,34,2);e.position.set(0,5,0);this.scene.add(e)}
  addWall(x,z,w,d){const m=box("Wall",[w,5,d],[x,2.5,z],0x38444a);this.scene.add(m);this.walls.push(m)}
  addCrate(x,z){const m=box("Crate",[3.4,2.6,3.4],[x,1.3,z],0x655f49);this.scene.add(m);this.obstacles.push(m)}
  createFacility(){
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(280,280),mat(0x222a2e));floor.rotation.x=-Math.PI/2;this.scene.add(floor);
    const grid=new THREE.GridHelper(280,140,0x4b5f69,0x343f45);grid.position.y=.01;this.scene.add(grid);
    [[0,-139,278,2],[0,139,278,2],[-139,0,2,278],[139,0,2,278],[-92,-48,2,112],[-92,82,2,86],[-45,-82,92,2],[-42,44,98,2],[0,-20,2,96],[46,-78,2,116],[48,26,98,2],[94,-42,2,104],[94,86,2,82],[-116,8,44,2],[-65,108,56,2],[18,108,58,2],[104,18,52,2],[0,72,72,2]].forEach(v=>this.addWall(...v));
    [[-122,-118],[-115,-118],[-108,-118],[-75,-115],[-68,-115],[-60,-108],[-122,55],[-114,55],[-105,62],[-80,115],[-72,115],[-20,-112],[-12,-112],[18,-110],[26,-110],[65,-118],[73,-118],[112,-112],[120,-105],[110,-60],[118,-52],[70,-35],[78,-35],[108,45],[116,45],[75,85],[83,85],[15,122],[23,122],[-25,75],[-17,75]].forEach(v=>this.addCrate(...v));
    const labels=[['RESEARCH',-118,-92,0x355f7a],['MEDICAL',-118,92,0x4e765c],['STORAGE',-48,-118,0x77664a],['POWER',40,-112,0x7b552e],['SECURITY',112,-68,0x683c47],['UNDERGROUND',112,72,0x3d4558],['CENTRAL HUB',0,24,0x355b67]];
    labels.forEach(([name,x,z,color])=>{const marker=box(name,[10,.25,4],[x,.13,z],color);this.scene.add(marker)});
  }

  addFurniture(name,size,position,color,solid=true,materialOptions={}){
    const object=box(name,size,position,color,mat(color,materialOptions));
    this.scene.add(object);
    if(solid)this.obstacles.push(object);
    return object;
  }

  addRoom(x,z,width,depth,doors=[]){
    const wall=.7,height=4.2;
    const has=side=>doors.includes(side);
    const split=(horizontal,side)=>{
      const length=horizontal?width:depth;
      const gap=has(side)?3.6:0;
      if(!gap){
        if(horizontal)this.addWall(x,z+(side==='N'?-depth/2:depth/2),length,wall);
        else this.addWall(x+(side==='W'?-width/2:width/2),z,wall,length);
        return;
      }
      const piece=(length-gap)/2;
      if(horizontal){
        const wz=z+(side==='N'?-depth/2:depth/2);
        this.addWall(x-(gap+piece)/2,wz,piece,wall);
        this.addWall(x+(gap+piece)/2,wz,piece,wall);
      }else{
        const wx=x+(side==='W'?-width/2:width/2);
        this.addWall(wx,z-(gap+piece)/2,wall,piece);
        this.addWall(wx,z+(gap+piece)/2,wall,piece);
      }
    };
    split(true,'N');split(true,'S');split(false,'W');split(false,'E');
  }

  addTable(x,z,rotation=0){
    const top=this.addFurniture('LabTable',[4.8,.28,2],[x,1.35,z],0x52626b,true,{metalness:.3});
    top.rotation.y=rotation;
    [[-1.8,-.7],[1.8,-.7],[-1.8,.7],[1.8,.7]].forEach(([dx,dz])=>{
      const leg=this.addFurniture('TableLeg',[.22,1.3,.22],[x+dx,0.65,z+dz],0x303a40,false,{metalness:.25});
      leg.rotation.y=rotation;
    });
  }

  addBed(x,z,rotation=0){
    const bed=this.addFurniture('MedicalBed',[2.2,.5,4.4],[x,.65,z],0xd4dce0,true);bed.rotation.y=rotation;
    const pillow=this.addFurniture('Pillow',[1.5,.28,.75],[x,.99,z-1.45],0xeaf5f8,false);pillow.rotation.y=rotation;
  }

  addShelf(x,z,rotation=0){
    const frame=this.addFurniture('ShelfFrame',[3.8,3.8,.55],[x,1.9,z],0x4c555b,true,{metalness:.35});frame.rotation.y=rotation;
    [-1.15,0,1.15].forEach(y=>{const shelf=this.addFurniture('Shelf',[3.5,.12,.9],[x,y+1.7,z],0x74746a,false);shelf.rotation.y=rotation});
  }

  addMonitorDesk(x,z,rotation=0){
    this.addTable(x,z,rotation);
    const monitor=this.addFurniture('Monitor',[1.55,1,.18],[x,2.25,z],0x17242c,false,{emissive:0x2bbcff,emissiveIntensity:.8});monitor.rotation.y=rotation;
  }

  addGenerator(x,z){
    this.addFurniture('Generator',[5,3.2,2.8],[x,1.6,z],0x555d3d,true,{metalness:.45});
    const glow=this.addFurniture('GeneratorLight',[1.1,.35,.1],[x,2.2,z-1.46],0xff9f32,false,{emissive:0xff7200,emissiveIntensity:1.4});
    return glow;
  }

  addPipe(x,z,length,rotation=0){
    const pipe=this.addFurniture('Pipe',[length,.7,.7],[x,2.7,z],0x66747a,false,{metalness:.65});pipe.rotation.y=rotation;
  }

  createInteriors(){
    // Research wing: four connected labs with benches, specimen tanks, and records.
    this.addRoom(-116,-96,34,30,['E','S']);
    this.addRoom(-116,-58,34,30,['E','N','S']);
    this.addTable(-124,-101);this.addTable(-112,-101);this.addMonitorDesk(-121,-91);this.addMonitorDesk(-107,-91);
    this.addTable(-124,-63);this.addTable(-112,-63);this.addShelf(-126,-51);this.addShelf(-108,-51);
    [-127,-119,-111,-103].forEach(x=>this.addFurniture('SpecimenTank',[2.1,3.5,2.1],[x,1.75,-76],0x285b63,true,{transparent:true,opacity:.75,emissive:0x1b7480,emissiveIntensity:.35}));

    // Medical wing: reception, treatment rooms, pharmacy and operating room.
    this.addRoom(-116,58,34,26,['E','S']);this.addRoom(-116,90,34,28,['E','N','S']);this.addRoom(-116,120,34,22,['E','N']);
    this.addMonitorDesk(-119,51);this.addShelf(-129,65);this.addBed(-125,87);this.addBed(-115,87);this.addBed(-105,87);
    this.addShelf(-128,118);this.addShelf(-119,118);this.addShelf(-110,118);this.addTable(-106,122);

    // Storage wing: dense shelving aisles and loading equipment.
    this.addRoom(-65,-112,48,38,['E','W','N']);
    [-82,-72,-62,-52].forEach(x=>{this.addShelf(x,-121);this.addShelf(x,-110);this.addShelf(x,-99)});
    this.addFurniture('ForkliftBody',[4,1.4,2.4],[-43,.7,-120],0xd39b2d,true);
    this.addFurniture('ForkliftMast',[.4,3.7,2.2],[-40.8,1.85,-120],0x33393d,true,{metalness:.5});

    // Power sector: generators, transformer blocks, control desks and cable channels.
    this.addRoom(25,-112,42,38,['E','W','N']);
    this.addGenerator(12,-120);this.addGenerator(25,-120);this.addGenerator(38,-120);
    this.addFurniture('Transformer',[5,4,4],[12,2,-99],0x4c5145,true,{metalness:.45});
    this.addFurniture('Transformer',[5,4,4],[30,2,-99],0x4c5145,true,{metalness:.45});
    this.addMonitorDesk(42,-100);

    // Security sector: camera control room, armory lockers and detention cells.
    this.addRoom(116,-91,34,34,['W','S']);this.addRoom(116,-51,34,32,['W','N','S']);
    this.addMonitorDesk(107,-99);this.addMonitorDesk(118,-99);this.addMonitorDesk(127,-99);
    [105,112,119,126].forEach(x=>this.addFurniture('SecurityLocker',[2,3.6,1.2],[x,1.8,-59],0x46525a,true,{metalness:.45}));
    [-1,1].forEach(side=>this.addFurniture('CellBars',[.2,4,12],[116+side*9,2,-39],0x6c7478,true,{metalness:.8}));

    // Underground: pump room and intersecting pipe corridors.
    this.addRoom(114,69,38,36,['W','N','S']);this.addRoom(114,112,38,30,['W','N']);
    this.addFurniture('Pump',[5,3.5,5],[104,1.75,66],0x465a62,true,{metalness:.6});
    this.addFurniture('Pump',[5,3.5,5],[124,1.75,66],0x465a62,true,{metalness:.6});
    this.addPipe(114,82,30,0);this.addPipe(104,105,18,Math.PI/2);this.addPipe(124,105,18,Math.PI/2);

    // Central hub furniture and cover.
    this.addRoom(-24,12,20,20,['N','S','E','W']);this.addRoom(24,12,20,20,['N','S','E','W']);
    this.addMonitorDesk(-24,12);this.addMonitorDesk(24,12);
    [[-38,52],[-18,52],[18,52],[38,52]].forEach(([x,z])=>this.addFurniture('HubBench',[7,.7,1.6],[x,.55,z],0x59666c,true));

    // Architectural details: door frames, ceiling lights, cabinets, chairs and wall panels.
    const doorFrames=[[-99,-96,0],[-99,-58,0],[-99,58,0],[-99,90,0],[-99,120,0],[-41,-112,0],[46,-112,0],[99,-91,0],[99,-51,0],[95,69,0],[95,112,0]];
    doorFrames.forEach(([x,z,r])=>{const left=this.addFurniture('DoorFrame',[.35,4,.35],[x-1.9,2,z],0x69777e,false,{metalness:.55});const right=this.addFurniture('DoorFrame',[.35,4,.35],[x+1.9,2,z],0x69777e,false,{metalness:.55});const top=this.addFurniture('DoorFrame',[4.15,.35,.35],[x,3.85,z],0x69777e,false,{metalness:.55});left.rotation.y=right.rotation.y=top.rotation.y=r});
    const lights=[[-116,-96],[-116,-58],[-116,58],[-116,90],[-116,120],[-65,-112],[25,-112],[116,-91],[116,-51],[114,69],[114,112],[-24,12],[24,12],[0,52]];
    lights.forEach(([x,z],index)=>{const panel=this.addFurniture('CeilingLight',[4.8,.12,1.1],[x,3.85,z],0xddeaf0,false,{emissive:index%3===0?0xff3333:0x9de7ff,emissiveIntensity:index%3===0?.7:1.2});});
    [[-123,-88],[-113,-88],[-123,80],[-113,80],[104,-86],[118,-86],[-55,-96],[-72,-96],[18,-104],[35,-104]].forEach(([x,z])=>this.addFurniture('Chair',[1,.9,1],[x,.55,z],0x2f3a40,true));
    [[-130,-105],[-130,-55],[-130,110],[-100,110],[131,-94],[131,-54],[132,108]].forEach(([x,z])=>this.addFurniture('Cabinet',[2.2,3.5,1.25],[x,1.75,z],0x4b575e,true,{metalness:.28}));
  }

  createObjectives(){
    const terminalLocations=[[-118,-75],[70,-108],[112,82]];
    terminalLocations.forEach(([x,z],i)=>{const t=new THREE.Group();t.position.set(x,0,z);t.name=`Terminal${i+1}`;const sm=mat(0x681f1f,{emissive:0xff2020,emissiveIntensity:1.2});t.add(box('TerminalBody',[2,2.4,1.2],[0,1.2,0],0x263239),box('TerminalScreen',[1.3,.75,.08],[0,1.55,-.64],0,sm));const code=String(Math.floor(1000+Math.random()*9000));t.userData={repaired:false,progress:0,screenMaterial:sm,assignedNpcId:null,code,cluesFound:new Set(),failures:0,lockedUntil:0};this.scene.add(t);this.terminals.push(t)});
    const clueSpots=[[-125,-122],[-104,-60],[-120,88],[-75,118],[-30,-115],[28,-120],[75,-75],[118,-20],[120,110],[-48,18],[28,58],[78,112],[8,-72],[-70,70],[105,35]];
    const shuffled=[...clueSpots].sort(()=>Math.random()-.5);
    this.terminals.forEach((terminal,terminalIndex)=>{for(let digitIndex=0;digitIndex<4;digitIndex+=1){const [x,z]=shuffled[terminalIndex*4+digitIndex];const clue=new THREE.Group();clue.position.set(x,0,z);const glow=mat(0x265a70,{emissive:0x26c6ff,emissiveIntensity:1.4});clue.add(box('Clue',[1.2,.15,1.6],[0,.08,0],0,glow),box('CluePost',[.18,1.1,.18],[0,.62,0],0x63727a));clue.userData={terminalIndex,digitIndex,value:terminal.userData.code[digitIndex],found:false};this.scene.add(clue);this.clues.push(clue)}});
    this.exitGate=new THREE.Group();this.exitGate.position.set(0,0,132);const f=mat(0x596871,{metalness:.5});this.exitGate.add(box('Frame',[1,5,1],[-3.5,2.5,0],0,f),box('Frame',[1,5,1],[3.5,2.5,0],0,f),box('Frame',[8,1,1],[0,4.5,0],0,f));const door=box('Door',[6,4,.5],[0,2,0],0x5a1818,mat(0x5a1818,{emissive:0x9d1515,emissiveIntensity:.5}));this.exitGate.add(door);this.exitGate.userData={open:false,door};this.scene.add(this.exitGate);
    [['TUNNEL',-42,126,0x57cfff],['ROOFTOP',0,126,0xa8e85c],['CARGO',42,126,0xff9f32]].forEach(([name,x,z,color])=>{const route=new THREE.Group();route.position.set(x,0,z);route.add(box(name,[13,.3,12],[0,.15,0],color,mat(color,{emissive:color,emissiveIntensity:.45})));route.userData={name,active:false};this.scene.add(route);this.finalRoutes.push(route)});
  }

  createCharacter(type,x,z,color,name){const c=type==="PURSUER"?createPursuer():createEscapee({jacketColor:color});c.position.set(x,0,z);Object.assign(c.userData,{entityId:crypto.randomUUID(),type,name,state:"IDLE",captured:false,escaped:false,health:2,stuckTime:0,avoidanceSide:Math.random()<.5?-1:1,targetTerminal:null,chatCooldownUntil:0,lastChatKey:"",animator:new CharacterAnimator(c),nextAttackAt:0,lastSafePosition:new THREE.Vector3(x,0,z),noMoveTime:0,aiRole:'SCOUT',decisionUntil:0,thoughtUntil:0,followPlayerUntil:0,targetClue:null,targetPoint:null,sharedClues:new Set(),navPath:[],navIndex:0,nextPathAt:performance.now()+250+Math.random()*2200,lastPathTarget:new THREE.Vector3(),movementIntent:false});this.scene.add(c);return c}
  isSpawnClear(position,radius=2.4){
    if(this.collision(position.x,position.z,radius))return false;
    return [...this.escapees,...this.pursuers].every(npc=>distanceXZ(position,npc.position)>radius*2.2);
  }

  findSafeSpawn(candidates,radius=2.4){
    for(const [x,z] of candidates){
      const position=new THREE.Vector3(x,0,z);
      if(this.isSpawnClear(position,radius))return position;
    }
    for(let attempt=0;attempt<300;attempt+=1){
      const position=new THREE.Vector3(THREE.MathUtils.randFloat(-125,125),0,THREE.MathUtils.randFloat(-125,125));
      if(this.isSpawnClear(position,radius))return position;
    }
    return new THREE.Vector3(0,0,24);
  }

  rememberSafePosition(entity,radius=.72){
    if(!this.collision(entity.position.x,entity.position.z,radius)){
      entity.userData.lastSafePosition=entity.position.clone();
    }
  }

  updateStuckRecovery(dt){
    const entities=[...this.escapees,...this.pursuers];
    for(const entity of entities){
      if(entity.userData.captured||entity.userData.escaped)continue;
      const current=entity.position;
      const previous=entity.userData.previousRecoveryPosition||current.clone();
      const moved=distanceXZ(current,previous);
      entity.userData.previousRecoveryPosition=current.clone();
      const wantsMove=entity.userData.movementIntent===true;entity.userData.movementIntent=false;
      entity.userData.noMoveTime=wantsMove&&moved<.012?(entity.userData.noMoveTime||0)+dt:0;
      this.rememberSafePosition(entity,entity.userData.type==='PURSUER'?1:.75);
      if(entity.userData.noMoveTime>3.5){
        const safe=entity.userData.lastSafePosition;
        if(safe&&!this.collision(safe.x,safe.z,1)){entity.position.copy(safe)}
        else{const around=[[entity.position.x+8,entity.position.z],[entity.position.x-8,entity.position.z],[entity.position.x,entity.position.z+8],[entity.position.x,entity.position.z-8],[0,24],[-70,20],[70,20],[0,62],[-32,104],[68,104]];entity.position.copy(this.findSafeSpawn(around,2));}
        entity.userData.noMoveTime=0;
      }
    }
    if(!this.collision(this.playerPosition.x,this.playerPosition.z,.65))this.lastSafePlayerPosition.copy(this.playerPosition);
  }

  createCharacters(){
    const pool=Array.from({length:1000},(_,i)=>({
      id:`npc_${String(i+1).padStart(4,'0')}`,
      name:`NOVA-${String(i+1).padStart(4,'0')}`,
      color:new THREE.Color().setHSL((i*.61803398875)%1,.55,.52).getHex()
    }));
    for(let i=pool.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    const walkable=[[0,86],[-18,86],[18,86],[-36,86],[36,86],[-54,86],[54,86],[-72,104],[-48,104],[-24,104],[0,104],[24,104],[48,104],[72,104],[-118,104],[-92,104],[92,104],[118,104],[-70,52],[70,52]];
    const escapeeCount=this.role==='ESCAPEE'?14:15;
    const pursuerNpcCount=this.role==='PURSUER'?5:6;
    const playerCandidates=this.role==='ESCAPEE'?[[0,86],[-18,86],[18,86],[0,100]]:[[0,-126],[-18,-126],[18,-126],[-36,-126],[36,-126]];
    const playerSpawn=this.findSafeSpawn(playerCandidates,2.8);
    this.playerPosition.copy(playerSpawn);this.lastSafePlayerPosition.copy(playerSpawn);this.yaw=this.role==='ESCAPEE'?Math.PI:Math.PI/2;
    this.playerModel=this.role==='ESCAPEE'?createEscapee({jacketColor:0xd59a43}):createPursuer();
    for(let i=0;i<escapeeCount;i+=1){
      const data=pool[i],preferred=walkable.slice(i).concat(walkable.slice(0,i));
      const spawn=this.findSafeSpawn(preferred,2.2);
      const npc=this.createCharacter('ESCAPEE',spawn.x,spawn.z,data.color,data.name);
      npc.userData.entityId=data.id;
      npc.userData.aiRole=['SCOUT','SCOUT','TECH','TECH','SUPPORT','DECOY','COORDINATOR'][i%7];
      npc.userData.personality=['CAUTIOUS','BRAVE','SOCIAL','FOCUSED'][i%4];
      npc.userData.reactionDelay=.15+(i%5)*.08;
      this.escapees.push(npc);
    }
    const hunterCandidates=[[0,-126],[-24,-126],[24,-126],[-48,-126],[48,-126],[-72,-126],[72,-126],[-120,-20],[120,-20],[-90,-88],[90,-88]];
    for(let i=0;i<pursuerNpcCount;i+=1){
      const ordered=hunterCandidates.slice(i).concat(hunterCandidates.slice(0,i));
      const spawn=this.findSafeSpawn(ordered,3.1);
      const hunter=this.createCharacter('PURSUER',spawn.x,spawn.z,0x15191c,`WARDEN-${String(i+1).padStart(2,'0')}`);
      hunter.userData.patrolIndex=i;
      this.pursuers.push(hunter);
    }
    this.playerModel.position.copy(this.playerPosition);this.playerModel.userData.animator=new CharacterAnimator(this.playerModel);this.playerAnimator=this.playerModel.userData.animator;this.scene.add(this.playerModel);this.syncPlayerModel();
  }

  createHud(){
    this.hud=document.createElement("div");this.hud.className="game-hud";this.hud.innerHTML=`<div class="hud-stack"><div class="hud-panel"><div class="hud-title">RUN FOR LIVE</div><div class="hud-row"><span>ROLE</span><strong>${this.role}</strong></div><div class="hud-row"><span>VIEW</span><strong data-view>FIRST</strong></div><div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div><div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div><div class="hud-row"><span>CAPTURED</span><strong data-captured>0 / 4</strong></div><div class="hud-row"><span>ESCAPEES</span><strong data-active>4 ACTIVE</strong></div><div class="hud-row"><span>HEALTH</span><strong data-health>3 / 3</strong></div><div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div></div></div><div class="crosshair"></div><div class="center-prompt" data-prompt></div><div class="view-toast" data-view-toast>FIRST PERSON</div>`;document.body.appendChild(this.hud);
    this.ui={view:this.hud.querySelector("[data-view]"),time:this.hud.querySelector("[data-time]"),terminals:this.hud.querySelector("[data-terminals]"),captured:this.hud.querySelector("[data-captured]"),active:this.hud.querySelector("[data-active]"),health:this.hud.querySelector("[data-health]"),stamina:this.hud.querySelector("[data-stamina]"),prompt:this.hud.querySelector("[data-prompt]"),viewToast:this.hud.querySelector("[data-view-toast]")};
  }

  createGameChat(){
    this.chatRoot=document.createElement("section");this.chatRoot.className="game-chat";this.chatRoot.innerHTML=`<div class="game-chat__log" data-log></div><form class="game-chat__form" data-form hidden><input data-input maxlength="120" autocomplete="off" placeholder="Type a message and press Enter..."></form><div class="game-chat__hint">T: CHAT</div>`;document.body.appendChild(this.chatRoot);this.chatLog=this.chatRoot.querySelector("[data-log]");this.chatForm=this.chatRoot.querySelector("[data-form]");this.chatInput=this.chatRoot.querySelector("[data-input]");this.chatForm.onsubmit=e=>{e.preventDefault();this.submitPlayerChat()};this.chatInput.onkeydown=e=>{e.stopPropagation();if(e.code==="Escape"){e.preventDefault();this.closeChat(false)}};
  }
  openChat(){if(this.chatOpen||this.ended)return;this.chatOpen=true;this.keys.clear();document.exitPointerLock?.();this.chatForm.hidden=false;this.chatRoot.classList.add("game-chat--open");requestAnimationFrame(()=>this.chatInput.focus())}
  closeChat(clear=true){this.chatOpen=false;this.chatForm.hidden=true;this.chatRoot.classList.remove("game-chat--open");if(clear)this.chatInput.value="";this.renderer?.domElement.focus?.()}

  getCommandProfiles(){
    const current=[...this.escapees,...this.pursuers].map(npcProfile);
    const virtual=Array.from({length:1000},(_,i)=>{const n=String(i+1).padStart(4,"0");return{id:`npc_${n}`,loginId:`npc_${n}`,displayName:`NOVA-${n}`,role:"PLAYER",title:null,npc:true}});
    const all=[this.profile,...this.profiles,...current,...virtual];return all.filter((p,i,list)=>list.findIndex(x=>x.id===p.id)===i);
  }

  submitPlayerChat(){
    const content=this.chatInput.value.trim().slice(0,120);if(!content){this.closeChat(true);return}
    const coin=/^\/(?:coin\s+give|give\s+coin)\s+/i.test(content),gift=/^\/gift\s+/i.test(content);
    if(coin||gift){
      try{const result=coin?executeAdminCoinCommand({executor:this.profile,command:content,profiles:this.getCommandProfiles()}):executeGiftCommand({sender:this.profile,command:content,profiles:this.getCommandProfiles()});this.addSystemMessage(result.message);if(gift)this.thankForGift(result.target);this.onCoinsChanged?.(result)}catch(error){this.addSystemMessage(error?.message||String(error))}
      this.closeChat(true);return;
    }
    let identity;if(this.profile.role==="ADMIN")identity={label:"Admin",className:"admin"};else if(this.profile.role==="MODERATOR")identity={label:"Mod",className:"moderator"};else if(this.profile.role==="GUEST")identity={label:"Guest",className:"guest"};else{const selected=getSelectedRank(this.profile);identity={label:selected.label,className:selected.className}}
    this.addChatMessage({...identity,displayName:this.profile.displayName,content});this.issueTeamOrder(content);this.scheduleNpcReply(content);this.closeChat(true);
  }

  getNearbyEscapees(maximum=4){
    return this.escapees
      .filter(npc=>!npc.userData.captured&&!npc.userData.escaped)
      .sort((a,b)=>distanceXZ(this.playerPosition,a.position)-distanceXZ(this.playerPosition,b.position))
      .slice(0,maximum);
  }

  chooseFreshReply(speaker,category,replies){
    const key=`${speaker.userData.entityId}:${category}`;
    const used=this.npcConversationMemory.get(key)||[];
    const available=replies.filter(reply=>!used.includes(reply));
    const pool=available.length?available:replies;
    const reply=pool[Math.floor(Math.random()*pool.length)];
    const next=[...used,reply].slice(-Math.max(1,replies.length-1));
    this.npcConversationMemory.set(key,next);
    return reply;
  }

  getConversationContext(){
    const active=this.escapees.filter(npc=>!npc.userData.captured&&!npc.userData.escaped).length;
    const captured=this.escapees.filter(npc=>npc.userData.captured).length;
    const found=this.clues.filter(clue=>clue.userData.found).length;
    const remaining=this.terminals.filter(terminal=>!terminal.userData.repaired).length;
    const nearestPursuer=this.pursuers
      .map(npc=>distanceXZ(this.playerPosition,npc.position))
      .sort((a,b)=>a-b)[0]??Infinity;
    return {active,captured,found,remaining,nearestPursuer};
  }

  scheduleNpcReply(content){
    if(this.role!=='ESCAPEE')return;
    const now=performance.now();
    if(now-this.lastTeamReplyAt<1200)return;
    this.lastTeamReplyAt=now;
    const lower=content.toLowerCase();
    const nearby=this.getNearbyEscapees(8);
    if(!nearby.length)return;
    const direct=nearby.find(npc=>lower.includes(npc.userData.name.toLowerCase()));
    const speaker=direct||nearby[Math.floor(Math.random()*nearby.length)];
    const context=this.getConversationContext();
    let category='general';
    let replies=[];

    if(/where|location|ã©ã|å ´æ/.test(lower)){
      category='location';
      const area=speaker.position.z>75?'north wing':speaker.position.z<-75?'south sector':speaker.position.x<-65?'west wing':speaker.position.x>65?'east wing':'central hub';
      replies=[
        `I am near the ${area}.`,
        `My position is the ${area}. I can regroup at the hub.`,
        `Check the ${area}. I am moving through that section now.`,
        `I am at coordinates ${Math.round(speaker.position.x)}, ${Math.round(speaker.position.z)}.`
      ];
    }else if(/plan|strategy|ä½æ¦|ã©ããã|what do we do/.test(lower)){
      category='strategy';
      replies=context.remaining===3?[
        'Three terminals remain. Split into three search teams and report every digit.',
        'Start with Research and Power. Avoid the central corridor until we have two codes.',
        'Two players should distract the Wardens while the rest search Medical and Security.',
        `We have ${context.active} escapees active. Work in pairs and regroup after one terminal.`,
        'Search the outer rooms first. The Wardens are more likely to patrol the hub.'
      ]:context.remaining===2?[
        'Two terminals remain. Keep one team on clues and one team ready at the gate.',
        'We are making progress. Finish the nearest code before changing sectors.',
        'Do not split too far now. The Wardens can isolate us in the side rooms.',
        `Two terminals left and ${context.captured} captured. We should stay in groups.`
      ]:[
        'Only one terminal remains. Everyone else should prepare a final route.',
        'Finish the last code, then regroup at the northern gate.',
        'One terminal left. I will search while the others draw the Wardens away.'
      ];
    }else if(/help|å©ã|ææ´|è¿½ãã|warden|é¬¼/.test(lower)){
      category='help';
      replies=context.nearestPursuer<14?[
        'A Warden is close. Turn into the nearest room and break line of sight!',
        'Keep running north. I will cross behind and distract it.',
        'Do not stop. Use the shelves as cover and circle back to the hub.',
        'I am moving toward you. Stay away from dead-end rooms.'
      ]:[
        'I do not see a Warden near you. Regroup with the closest team.',
        'Your area looks clear for now. Move toward a clue marker.',
        'I am on the way. Hold near a room with two exits.',
        'Copy. Mark your sector and keep moving.'
      ];
    }else if(/terminal|code|clue|ãã³ã|ç«¯æ«|ã³ã¼ã/.test(lower)){
      category='objective';
      replies=[
        `${context.found} clues have been found. ${context.remaining} terminals still need codes.`,
        'I will search Security. Someone else check Medical records and the Power panels.',
        'Share the terminal number and digit position, not just the digit.',
        'I am checking the nearest blue clue marker now.',
        'If a terminal locks, leave it for thirty seconds and search another wing.',
        'We should complete one code before everyone moves to the next terminal.'
      ];
    }else if(/tunnel|rooftop|cargo|route|ã«ã¼ã|å±ä¸|è²¨ç©|ãã³ãã«/.test(lower)){
      category='route';
      replies=[
        'Tunnel has the most cover, but the narrow turns can trap us.',
        'Cargo gives us room to spread out. I prefer Cargo if several Wardens survive.',
        'Rooftop is fast but exposed. We should only choose it if the team is together.',
        `With ${context.active} escapees active, Cargo is probably the safest choice.`,
        'Wait until the gate opens. The nearest Warden position should decide the route.'
      ];
    }else if(/thanks|thank you|ãããã¨ã/.test(lower)){
      category='thanks';
      replies=['You are welcome.','No problem. Let us get out together.','Anytime. Stay safe.','We are a team. Keep moving.','Glad to help. Tell me if you find another clue.'];
    }else if(/hello|hi|hey|ããã«ã¡ã¯|ãã/.test(lower)){
      category='greeting';
      replies=['Hey. I am ready.','Hello. Let us find those clues.','I hear you. What is the plan?','Hi. I am checking the nearby rooms.','Hello. Stay on the team channel if you spot a Warden.'];
    }else if(/yes|ok|okay|äºè§£|ããã£ã/.test(lower)){
      category='ack';
      replies=['Copy. Moving now.','Understood. I will update the team.','Okay. I will take the next room.','Got it. Stay on this channel.'];
    }else if(/tired|ç²ã|ä¼ã¿|sleep|ç /.test(lower)){
      category='condition';
      replies=['Same here, but keep moving until we find a room with two exits.','Take a short breath in the next safe room. I will watch the corridor.','Save your stamina. Walk until a Warden gets close.','We are almost there. Do not spend all your stamina at once.'];
    }else if(/scary|æ|ãã|terrifying/.test(lower)){
      category='fear';
      replies=['The masks are unsettling, but the Wardens are predictable in open corridors.','Stay near the team channel. It is easier when we share their positions.','I know. Keep a wall between you and the red lights.','Do not look back for too long. Focus on the next doorway.'];
    }else if(/food|hungry|ãè¹|è¹æ¸|é£ã¹/.test(lower)){
      category='smalltalk-food';
      replies=['If we escape, I am finding the biggest meal in the city.','I found an old vending machine, but I would not trust anything inside it.','Now you made me hungry too. Let us finish the terminals first.','Deal. First one out chooses where we eat.'];
    }else if(/game|ã²ã¼ã |fun|æ¥½ãã/.test(lower)){
      category='smalltalk-game';
      replies=['This place would be more fun without six Wardens chasing us.','I prefer games where the doors are not trying to lock us inside.','Ask me again after we escape. Right now I am counting exits.','The clue hunt is interesting. The alarms, not so much.'];
    }else if(/weather|å¤©æ°|rain|é¨|sunny|æ´/.test(lower)){
      category='smalltalk-weather';
      replies=['I cannot see outside from this wing. The rooftop route might answer that.','The air vents sound like rain, but it could just be the generators.','Anything outside would be better than this lighting.','If the rooftop is clear, I hope the weather stays calm.'];
    }else if(/name|åå|who are you|èª°/.test(lower)){
      category='identity';
      replies=[`I am ${speaker.userData.name}. I am covering the nearby rooms.`,`Call me ${speaker.userData.name}. I will report clues on this channel.`,`My tag is ${speaker.userData.name}. What sector are you taking?`];
    }else if(/joke|åè«|é¢ç½ããã¨/.test(lower)){
      category='joke';
      replies=['A Warden walked into a locked terminal. The terminal won.','Why did the escapee carry a map? Because every corridor looked exactly the same.','I would tell a better joke, but the Security cameras are listening.','The good news is we found a shortcut. The bad news is a Warden found it too.'];
    }else if(/why|ãªã|ãªãã§/.test(lower)){
      category='why';
      replies=['I do not know yet. Let us collect more clues before guessing.','Good question. The facility records might explain it.','There may be an answer in Research or Security.','I was wondering the same thing. We should compare what everyone has found.'];
    }else{
      category='general';
      replies=[
        'Copy that. What sector should I cover?',
        'I hear you. Give me a target or a route.',
        'Understood. I will keep searching nearby.',
        `We still have ${context.remaining} terminals left.`,
        'I am listening. Do you need help, clues, or a route vote?',
        'Stay together and keep moving. I will report anything useful.'
      ];
    }

    const reply=this.chooseFreshReply(speaker,category,replies);
    this.teamConversationHistory.push({speaker:speaker.userData.name,category,reply,at:Date.now()});
    this.teamConversationHistory=this.teamConversationHistory.slice(-30);
    setTimeout(()=>{
      if(this.running&&!speaker.userData.captured&&!speaker.userData.escaped){
        this.addNpcMessage(speaker,`reply-${category}-${Date.now()}`,reply,true);
      }
    },450+Math.random()*950);
  }

  ambientDialoguePool(){
    const context=this.getConversationContext();
    return [
      ['I am checking the next room.','Copy. I will cover the corridor.'],
      [`We have ${context.found} clues so far.`,`I will search the opposite wing.`],
      ['Did anyone check Medical?','Not yet. I can head there now.'],
      ['The central hub is too exposed.','Agreed. Use the side rooms for cover.'],
      ['I heard movement near Security.','I will mark it and take another route.'],
      ['My stamina is low.','Walk for a moment. I will stay nearby.'],
      ['Which route do we use after the gate?','Let us decide after we know where the Wardens are.'],
      ['These rooms all look alike.','Follow the ceiling lights and sector colors.'],
      ['I found another dead end.','Turn back toward the hub. I can guide you from there.'],
      ['Stay on the channel, everyone.','Copy. Reporting any Warden positions.']
    ];
  }

  updateAmbientConversation(){
    if(this.role!=='ESCAPEE'||this.chatOpen||this.ended)return;
    const now=performance.now();
    if(now<this.nextAmbientChatAt)return;
    this.nextAmbientChatAt=now+9000+Math.random()*9000;
    const available=this.escapees.filter(npc=>!npc.userData.captured&&!npc.userData.escaped&&distanceXZ(this.playerPosition,npc.position)<80);
    if(available.length<2)return;
    const first=available[Math.floor(Math.random()*available.length)];
    const others=available.filter(npc=>npc!==first);
    const second=others[Math.floor(Math.random()*others.length)];
    const conversations=this.ambientDialoguePool();
    const pair=conversations[this.ambientConversationId%conversations.length];
    this.ambientConversationId+=1;
    this.addNpcMessage(first,`ambient-a-${this.ambientConversationId}`,pair[0],true);
    setTimeout(()=>{
      if(this.running&&!second.userData.captured&&!second.userData.escaped&&!this.chatOpen){
        this.addNpcMessage(second,`ambient-b-${this.ambientConversationId}`,pair[1],true);
      }
    },900+Math.random()*1200);
  }

  thankForGift(target){
    if(!target)return;
    const npc=this.escapees.find(entity=>entity.userData.entityId===target.id||entity.userData.name.toLowerCase()===String(target.displayName||'').toLowerCase());
    if(!npc)return;
    const thanks=['Thank you! I will use it well.','That is amazing, thank you!','Thanks! I owe you one.','Thank you. I will help with the mission.'];
    setTimeout(()=>this.addNpcMessage(npc,`gift-thanks-${Date.now()}`,thanks[Math.floor(Math.random()*thanks.length)],true),450);
  }

  addChatMessage(message){this.chatMessages.push(message);if(this.chatMessages.length>this.chatMaximum)this.chatMessages.shift();this.renderChat()}
  addSystemMessage(content){this.addChatMessage({label:"System",className:"system",displayName:"",content})}
  addNpcMessage(npc,key,content,force=false){const now=performance.now();if(!force&&now<npc.userData.chatCooldownUntil)return;if(!force&&npc.userData.lastChatKey===key)return;npc.userData.chatCooldownUntil=now+8000+Math.random()*4000;npc.userData.lastChatKey=key;const identity=npc.userData.type==='PURSUER'?{label:'Pursuer',className:'pursuer'}:getSelectedRank(npcProfile(npc));this.addChatMessage({label:identity.label,className:identity.className,displayName:npc.userData.name,content})}
  renderChat(){this.chatLog.replaceChildren(...this.chatMessages.map(m=>{const p=document.createElement("p"),id=document.createElement("span"),body=document.createElement("span");p.className="game-chat__line";id.className=`game-chat__identity game-chat__identity--${m.className}`;id.textContent=m.displayName?`[${m.label}] ${m.displayName}:`:`[${m.label}]`;body.className="game-chat__content";body.textContent=` ${m.content}`;p.append(id,body);return p}));this.chatLog.scrollTop=this.chatLog.scrollHeight}

  createTouchControls(){
    const root=document.createElement("div");root.id="touch-controls";root.innerHTML=`<div class="touch-look" data-look></div><div class="touch-stick" data-zone><div data-knob></div></div><div class="touch-buttons"><button data-run>RUN</button><button data-use>USE</button><button data-sneak>SNEAK</button><button data-view>VIEW</button><button data-chat>CHAT</button><button data-capture>${this.role==="PURSUER"?"CAPTURE":"PING"}</button></div>`;document.body.appendChild(root);this.touchRoot=root;
    const look=root.querySelector("[data-look]");look.onpointerdown=e=>{if(this.chatOpen)return;this.dragPointer=e.pointerId;this.dragX=e.clientX;this.dragY=e.clientY;look.setPointerCapture?.(e.pointerId)};look.onpointermove=e=>{if(e.pointerId!==this.dragPointer||this.chatOpen)return;this.yaw-=(e.clientX-this.dragX)*.005;this.pitch=THREE.MathUtils.clamp(this.pitch-(e.clientY-this.dragY)*.005,-1.25,1.25);this.dragX=e.clientX;this.dragY=e.clientY};look.onpointerup=()=>this.dragPointer=null;
    const zone=root.querySelector("[data-zone]"),knob=root.querySelector("[data-knob]");const stick=e=>{if(e.pointerId!==this.joystick.pointer||this.chatOpen)return;const b=zone.getBoundingClientRect();let x=e.clientX-(b.left+b.width/2),y=e.clientY-(b.top+b.height/2),len=Math.hypot(x,y);if(len>44){x=x/len*44;y=y/len*44}this.joystick.x=x/44;this.joystick.y=y/44;knob.style.transform=`translate(${x}px,${y}px)`};zone.onpointerdown=e=>{if(this.chatOpen)return;this.joystick.pointer=e.pointerId;zone.setPointerCapture?.(e.pointerId);stick(e)};zone.onpointermove=stick;zone.onpointerup=()=>{this.joystick={x:0,y:0,pointer:null};knob.style.transform="translate(0,0)"};
    const hold=(selector,key)=>{const control=root.querySelector(selector);control.onpointerdown=e=>{e.preventDefault();if(!this.chatOpen)this.touch[key]=true};control.onpointerup=control.onpointercancel=()=>this.touch[key]=false};hold("[data-run]","sprint");hold("[data-use]","interact");root.querySelector("[data-sneak]").onclick=()=>{if(!this.chatOpen)this.touch.sneak=!this.touch.sneak};root.querySelector("[data-view]").onclick=()=>{if(!this.chatOpen)this.cycleCameraMode()};root.querySelector("[data-chat]").onclick=()=>this.openChat();root.querySelector("[data-capture]").onclick=()=>{if(!this.chatOpen&&this.role==="PURSUER")this.tryCapture()};
  }

  bindEvents(){addEventListener("keydown",this.keyDown);addEventListener("keyup",this.keyUp);addEventListener("mousemove",this.mouseMove);addEventListener("resize",this.resize);this.renderer.domElement.onclick=()=>{if(!this.chatOpen)this.renderer.domElement.requestPointerLock?.()}}
  keyDown(e){if(this.chatOpen)return;if(e.code==="KeyT"&&!e.repeat){e.preventDefault();this.openChat();return}if(e.code==="Escape"){this.stop();this.onExit?.();return}if(e.code==="KeyC"&&!e.repeat){this.cycleCameraMode();return}if(e.code==="Space"&&this.role==="PURSUER")this.tryCapture();this.keys.add(e.code)}
  keyUp(e){if(this.chatOpen)return;this.keys.delete(e.code);if(e.code==="KeyE")this.repairProgress=0}
  mouseMove(e){if(this.chatOpen||document.pointerLockElement!==this.renderer.domElement)return;this.yaw-=e.movementX*.0023;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.0023,-1.25,1.25)}
  cycleCameraMode(){this.cameraModeIndex=(this.cameraModeIndex+1)%CAMERA_MODES.length;this.cameraMode=CAMERA_MODES[this.cameraModeIndex];this.ui.view.textContent=this.cameraMode;this.ui.viewToast.textContent=this.cameraMode==="FIRST"?"FIRST PERSON":this.cameraMode==="SECOND"?"SECOND PERSON":"THIRD PERSON";this.ui.viewToast.classList.add("visible");clearTimeout(this.viewToastTimer);this.viewToastTimer=setTimeout(()=>this.ui.viewToast.classList.remove("visible"),1200);this.syncPlayerModel();this.updateCamera()}

  rebuildCollisionCache(){
    this.scene.updateMatrixWorld(true);
    this.collisionBounds=[...this.walls,...this.obstacles].map(object=>{
      const bounds=new THREE.Box3().setFromObject(object);
      return {minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z};
    });
  }
  collision(x,z,r=.42){
    if(Math.abs(x)+r>WORLD_HALF||Math.abs(z)+r>WORLD_HALF)return true;
    const bounds=this.collisionBounds.length?this.collisionBounds:[];
    return bounds.some(box=>x+r>box.minX&&x-r<box.maxX&&z+r>box.minZ&&z-r<box.maxZ);
  }
  updatePlayer(dt){if(this.chatOpen){this.playerAnimator?.update(dt,{state:"IDLE"});return}let f=(this.keys.has("KeyW")?1:0)-(this.keys.has("KeyS")?1:0)-this.joystick.y,s=(this.keys.has("KeyD")?1:0)-(this.keys.has("KeyA")?1:0)+this.joystick.x;const sneak=this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")||this.touch.sneak,run=((this.keys.has("KeyW")&&this.keys.has("KeyR"))||this.touch.sprint)&&f>.1&&!sneak&&this.stamina>0,speed=sneak?1.8:run?7.2:4.4;this.stamina=THREE.MathUtils.clamp(this.stamina+(run?-25:17)*dt,0,100);const l=Math.hypot(f,s);if(l>1){f/=l;s/=l}const move=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)).multiplyScalar(f).add(new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)).multiplyScalar(s));const x=this.playerPosition.x+move.x*speed*dt,z=this.playerPosition.z+move.z*speed*dt;if(!this.collision(x,this.playerPosition.z))this.playerPosition.x=x;if(!this.collision(this.playerPosition.x,z))this.playerPosition.z=z;this.syncPlayerModel();this.playerAnimator?.update(dt,{state:move.lengthSq()<.001?"IDLE":run?"RUN":"WALK"})}
  syncPlayerModel(){if(!this.playerModel)return;this.playerModel.position.copy(this.playerPosition);this.playerModel.rotation.y=this.yaw;this.playerModel.visible=this.cameraMode!=="FIRST"}
  updateCamera(){const eye=this.playerPosition.clone();eye.y+=PLAYER_HEIGHT;const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));if(this.cameraMode==="FIRST"){this.camera.position.copy(eye);this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");return}const target=eye.clone();target.y-=.15;const desired=eye.clone();if(this.cameraMode==="SECOND"){desired.addScaledVector(forward,4.6);desired.y+=.55}else{desired.addScaledVector(forward,-5.7);desired.y+=1.5}const direction=desired.clone().sub(target),max=direction.length();direction.normalize();this.cameraRay.set(target,direction);this.cameraRay.far=max;const hits=this.cameraRay.intersectObjects([...this.walls,...this.obstacles],false),safe=hits.length?target.clone().addScaledVector(direction,Math.max(.7,hits[0].distance-.35)):desired;this.camera.position.lerp(safe,.22);this.camera.lookAt(target)}

  hasClearPath(from,to,radius=.8){
    const distance=distanceXZ(from,to);
    const steps=Math.max(2,Math.ceil(distance/1.6));
    for(let index=1;index<=steps;index+=1){
      const ratio=index/steps;
      const x=THREE.MathUtils.lerp(from.x,to.x,ratio);
      const z=THREE.MathUtils.lerp(from.z,to.z,ratio);
      if(this.collision(x,z,radius))return false;
    }
    return true;
  }

  worldToNav(position,cell=5){
    return {x:Math.round(position.x/cell),z:Math.round(position.z/cell)};
  }

  navToWorld(node,cell=5){
    return new THREE.Vector3(node.x*cell,0,node.z*cell);
  }

  findNavigationPath(from,to,radius=.8){
    const cell=7;
    const start=this.worldToNav(from,cell);
    const goal=this.worldToNav(to,cell);
    const key=node=>`${node.x},${node.z}`;
    const heuristic=node=>Math.hypot(node.x-goal.x,node.z-goal.z);
    const open=[start];
    const openKeys=new Set([key(start)]);
    const cameFrom=new Map();
    const cost=new Map([[key(start),0]]);
    const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let reached=null;
    let visited=0;

    while(open.length&&visited<850){
      visited+=1;
      let bestIndex=0;
      let bestScore=Infinity;
      for(let index=0;index<open.length;index+=1){
        const node=open[index];
        const score=(cost.get(key(node))||0)+heuristic(node);
        if(score<bestScore){bestScore=score;bestIndex=index}
      }
      const current=open.splice(bestIndex,1)[0];
      openKeys.delete(key(current));
      if(Math.abs(current.x-goal.x)<=1&&Math.abs(current.z-goal.z)<=1){reached=current;break}

      for(const [dx,dz] of directions){
        const next={x:current.x+dx,z:current.z+dz};
        if(Math.abs(next.x*cell)>WORLD_HALF-4||Math.abs(next.z*cell)>WORLD_HALF-4)continue;
        const world=this.navToWorld(next,cell);
        if(this.collision(world.x,world.z,radius))continue;
        if(dx&&dz){
          const sideA=this.navToWorld({x:current.x+dx,z:current.z},cell);
          const sideB=this.navToWorld({x:current.x,z:current.z+dz},cell);
          if(this.collision(sideA.x,sideA.z,radius)||this.collision(sideB.x,sideB.z,radius))continue;
        }
        const nextKey=key(next);
        const nextCost=(cost.get(key(current))||0)+(dx&&dz?1.42:1);
        if(nextCost>=(cost.get(nextKey)??Infinity))continue;
        cameFrom.set(nextKey,current);
        cost.set(nextKey,nextCost);
        if(!openKeys.has(nextKey)){open.push(next);openKeys.add(nextKey)}
      }
    }

    if(!reached)return [];
    const reversed=[];
    let current=reached;
    while(current){reversed.push(this.navToWorld(current,cell));current=cameFrom.get(key(current))||null}
    reversed.reverse();
    reversed.push(to.clone());
    const smoothed=[];
    let index=0;
    while(index<reversed.length){
      let furthest=index;
      for(let candidate=Math.min(reversed.length-1,index+6);candidate>index;candidate-=1){
        if(this.hasClearPath(reversed[index],reversed[candidate],radius)){furthest=candidate;break}
      }
      smoothed.push(reversed[furthest]);
      index=furthest===index?index+1:furthest;
    }
    return smoothed;
  }
  navigationTarget(npc,target,radius){
    const now=performance.now();
    const targetMoved=distanceXZ(npc.userData.lastPathTarget,target)>5;
    const direct=this.hasClearPath(npc.position,target,radius);
    if(direct){
      npc.userData.navPath=[];npc.userData.navIndex=0;
      return target;
    }
    if((targetMoved||!npc.userData.navPath.length)&&now>=npc.userData.nextPathAt){
      npc.userData.navPath=this.findNavigationPath(npc.position,target,radius);
      npc.userData.navIndex=0;
      npc.userData.nextPathAt=now+1800+Math.random()*900;
      npc.userData.lastPathTarget.copy(target);
    }
    if(!npc.userData.navPath.length){
      const desired=target.clone().sub(npc.position).setY(0).normalize();
      for(const angle of[65,-65,100,-100,145,-145]){
        const direction=desired.clone().applyAxisAngle(UP,THREE.MathUtils.degToRad(angle));
        const local=npc.position.clone().add(direction.multiplyScalar(4));
        if(!this.collision(local.x,local.z,radius))return local;
      }
      return npc.position;
    }
    const path=npc.userData.navPath;
    while(npc.userData.navIndex<path.length-1&&distanceXZ(npc.position,path[npc.userData.navIndex])<1.7){npc.userData.navIndex+=1}
    return path[npc.userData.navIndex]||target;
  }

  chooseNpcDirection(npc,desired){const r=npc.userData.type==="PURSUER"?.78:.52,side=npc.userData.avoidanceSide||1;for(const angle of[0,25*side,-25*side,50*side,-50*side,75*side,-75*side,110,-110,160,-160,180]){const candidate=desired.clone().applyAxisAngle(UP,THREE.MathUtils.degToRad(angle));if(!this.collision(npc.position.x+candidate.x*1.3,npc.position.z+candidate.z*1.3,r)){if(angle!==0&&angle!==180)npc.userData.avoidanceSide=Math.sign(angle)||side;return candidate}}return null}
  moveNpc(npc,target,speed,dt){
    npc.userData.movementIntent=true;
    const radius=npc.userData.type==='PURSUER'?.86:.62;
    const steeringTarget=this.navigationTarget(npc,target,radius);
    const desired=steeringTarget.clone().sub(npc.position).setY(0);
    if(desired.lengthSq()<.01)return;
    desired.normalize();
    const direction=this.chooseNpcDirection(npc,desired);
    if(!direction){
      npc.userData.stuckTime+=dt;
      if(npc.userData.stuckTime>.65){
        npc.userData.navPath=[];npc.userData.navIndex=0;npc.userData.nextPathAt=performance.now()+180+Math.random()*300;
        npc.userData.avoidanceSide*=-1;npc.userData.stuckTime=0;
      }
      return;
    }
    npc.userData.stuckTime=0;
    const nextX=npc.position.x+direction.x*speed*dt;
    const nextZ=npc.position.z+direction.z*speed*dt;
    let moved=false;
    if(!this.collision(nextX,npc.position.z,radius)){npc.position.x=nextX;moved=true}
    if(!this.collision(npc.position.x,nextZ,radius)){npc.position.z=nextZ;moved=true}
    if(!moved){npc.userData.navPath=[];npc.userData.nextPathAt=performance.now()+250+Math.random()*400}
    const targetRotation=Math.atan2(direction.x,direction.z)+Math.PI;
    const difference=THREE.MathUtils.euclideanModulo(targetRotation-npc.rotation.y+Math.PI,Math.PI*2)-Math.PI;
    npc.rotation.y+=difference*Math.min(1,dt*9);
  }
  setNpcState(npc,state){if(npc.userData.state===state)return;npc.userData.state=state;if(state==="FLEE")this.addNpcMessage(npc,"flee","The pursuer is here!");else if(state==="REPAIR")this.addNpcMessage(npc,"repair","Repairing a terminal.");else if(state==="ESCAPE")this.addNpcMessage(npc,"exit","The exit is open. Move!");else if(state==="TERMINAL")this.addNpcMessage(npc,"terminal-move","I have the digits. Moving to the terminal.");else if(state==="SUPPORT")this.addNpcMessage(npc,"support","I am staying with the team.");else if(state==="CHASE"&&npc.userData.type==="PURSUER")this.addNpcMessage(npc,"chase","I found you.")}
  nearestPursuerTo(position){
    const candidates=this.role==='PURSUER'?[{position:this.playerPosition},...this.pursuers]:this.pursuers;
    return candidates.sort((a,b)=>distanceXZ(position,a.position)-distanceXZ(position,b.position))[0]||null;
  }

  chooseNpcClue(npc){
    if(npc.userData.targetClue&&!npc.userData.targetClue.userData.found)return npc.userData.targetClue;
    const available=this.clues
      .filter(clue=>!clue.userData.found)
      .sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position));
    const claimed=new Set(this.escapees.map(other=>other!==npc?other.userData.targetClue:null).filter(Boolean));
    npc.userData.targetClue=available.find(clue=>!claimed.has(clue))||available[0]||null;
    return npc.userData.targetClue;
  }

  collectClueForNpc(npc,clue){
    if(!clue||clue.userData.found)return;
    clue.userData.found=true;clue.visible=false;
    const terminal=this.terminals[clue.userData.terminalIndex];
    terminal.userData.cluesFound.add(clue.userData.digitIndex);
    npc.userData.targetClue=null;
    this.addNpcMessage(npc,`clue-${clue.userData.terminalIndex}-${clue.userData.digitIndex}`,`${terminal.name}, digit ${clue.userData.digitIndex+1} is ${clue.userData.value}.`,true);
  }

  canNpcUnlock(terminal){
    return terminal&&!terminal.userData.repaired&&terminal.userData.cluesFound.size===4&&Date.now()>=terminal.userData.lockedUntil;
  }

  issueTeamOrder(content){
    const lower=content.toLowerCase();
    if(/follow me|ã¤ãã¦ãã¦|ä¸ç·ã«æ¥ã¦/.test(lower)){
      this.getNearbyEscapees(3).forEach(npc=>npc.userData.followPlayerUntil=performance.now()+25000);
      this.addSystemMessage('Three nearby teammates will follow you for 25 seconds.');
    }
    if(/search clues|find clues|ãã³ãæ¢ãã¦|æãããæ¢ãã¦/.test(lower)){
      this.escapees.filter(npc=>!npc.userData.captured).forEach(npc=>{if(['SCOUT','COORDINATOR'].includes(npc.userData.aiRole))npc.userData.targetClue=null});
      this.addSystemMessage('Scouts are searching for unclaimed clues.');
    }
    if(/go terminal|terminal now|ç«¯æ«è¡ã£ã¦|ã³ã¼ãå¥å/.test(lower)){
      this.escapees.filter(npc=>npc.userData.aiRole==='TECH').forEach(npc=>npc.userData.targetTerminal=null);
      this.addSystemMessage('Technicians are moving to completed codes.');
    }
    if(/distract|å®|ãã¨ã/.test(lower)){
      this.escapees.filter(npc=>npc.userData.aiRole==='DECOY').forEach(npc=>npc.userData.followPlayerUntil=0);
      this.addSystemMessage('Decoys will pull Wardens away from the objective area.');
    }
  }

  chooseCoverPoint(npc,pursuer){
    const away=npc.position.clone().sub(pursuer.position).setY(0);
    if(away.lengthSq()<.01)away.set(1,0,0);
    away.normalize();
    const options=[];
    for(const angle of[-70,-35,0,35,70]){
      const direction=away.clone().applyAxisAngle(UP,THREE.MathUtils.degToRad(angle));
      options.push(npc.position.clone().add(direction.multiplyScalar(14)));
    }
    return options.find(point=>!this.collision(point.x,point.z,.9))||npc.position.clone().add(away.multiplyScalar(10));
  }

  selectTerminalForNpc(npc){if(npc.userData.targetTerminal&&!npc.userData.targetTerminal.userData.repaired)return npc.userData.targetTerminal;const available=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position)),terminal=available.find(t=>!t.userData.assignedNpcId||t.userData.assignedNpcId===npc.userData.entityId)||available[0];if(terminal){terminal.userData.assignedNpcId=npc.userData.entityId;npc.userData.targetTerminal=terminal}return terminal}
  updateEscapeeNpc(npc,dt){
    if(npc.userData.captured||npc.userData.escaped)return;
    const now=performance.now();
    const pursuer=this.nearestPursuerTo(npc.position);
    const danger=pursuer?distanceXZ(npc.position,pursuer.position):Infinity;
    const cautious=npc.userData.personality==='CAUTIOUS';
    const dangerRadius=cautious?18:14;

    if(danger<dangerRadius){
      this.setNpcState(npc,'FLEE');
      npc.userData.targetPoint=this.chooseCoverPoint(npc,pursuer);
      this.moveNpc(npc,npc.userData.targetPoint,npc.userData.aiRole==='DECOY'?5.5:5.1,dt);
      if(npc.userData.aiRole==='SUPPORT'&&distanceXZ(npc.position,this.playerPosition)<12&&danger<10){
        this.addNpcMessage(npc,'support-warning','Warden close! Follow me through the side room.');
      }
    }else if(this.repaired>=REQUIRED_TERMINALS){
      this.setNpcState(npc,'ESCAPE');
      const route=this.selectedRoute||this.finalRoutes[1]||this.exitGate;
      this.moveNpc(npc,route.position,4.1,dt);
      if(this.selectedRoute&&distanceXZ(npc.position,this.selectedRoute.position)<7){
        npc.userData.escaped=true;npc.visible=false;this.addSystemMessage(`${npc.userData.name} reached the extraction route.`);
      }
    }else if(npc.userData.followPlayerUntil>now){
      this.setNpcState(npc,'FOLLOW');
      const offset=new THREE.Vector3(((npc.userData.patrolIndex||0)%3-1)*2.2,0,3+((npc.userData.patrolIndex||0)%2)*1.5).applyAxisAngle(UP,this.yaw);
      const followTarget=this.playerPosition.clone().add(offset);
      if(distanceXZ(npc.position,followTarget)>3)this.moveNpc(npc,followTarget,3.7,dt);
    }else if(npc.userData.aiRole==='TECH'){
      const ready=this.terminals.find(terminal=>this.canNpcUnlock(terminal));
      if(ready){
        this.setNpcState(npc,'TERMINAL');
        if(distanceXZ(npc.position,ready.position)>2.4)this.moveNpc(npc,ready.position,3.15,dt);
        else if(now>=npc.userData.decisionUntil){
          npc.userData.decisionUntil=now+2500;
          this.addNpcMessage(npc,`unlock-${ready.name}`,`Code complete. Unlocking ${ready.name}.`,true);
          this.completeTerminal(ready,npc);
        }
      }else{
        const clue=this.chooseNpcClue(npc);
        if(clue){this.setNpcState(npc,'SEARCH');if(distanceXZ(npc.position,clue.position)>2)this.moveNpc(npc,clue.position,2.85,dt);else this.collectClueForNpc(npc,clue)}
      }
    }else if(npc.userData.aiRole==='SUPPORT'){
      const injured=this.escapees.filter(other=>other!==npc&&!other.userData.captured&&other.userData.health===1).sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position))[0];
      const supportTarget=injured||(distanceXZ(npc.position,this.playerPosition)>18?{position:this.playerPosition}:null);
      if(supportTarget){this.setNpcState(npc,'SUPPORT');this.moveNpc(npc,supportTarget.position,3.2,dt)}
      else{const clue=this.chooseNpcClue(npc);if(clue){this.setNpcState(npc,'SEARCH');this.moveNpc(npc,clue.position,2.6,dt);if(distanceXZ(npc.position,clue.position)<2)this.collectClueForNpc(npc,clue)}}
    }else if(npc.userData.aiRole==='DECOY'){
      const objective=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position))[0];
      const nearbyHunter=this.nearestPursuerTo(npc.position);
      if(nearbyHunter&&distanceXZ(npc.position,nearbyHunter.position)<28){
        this.setNpcState(npc,'DECOY');
        const awayFromObjective=npc.position.clone().sub(objective?.position||this.playerPosition).setY(0).normalize();
        this.moveNpc(npc,npc.position.clone().add(awayFromObjective.multiplyScalar(18)),4.7,dt);
      }else{const clue=this.chooseNpcClue(npc);if(clue){this.setNpcState(npc,'SEARCH');this.moveNpc(npc,clue.position,2.7,dt);if(distanceXZ(npc.position,clue.position)<2)this.collectClueForNpc(npc,clue)}}
    }else{
      const clue=this.chooseNpcClue(npc);
      if(clue){
        this.setNpcState(npc,'SEARCH');
        if(distanceXZ(npc.position,clue.position)>2)this.moveNpc(npc,clue.position,npc.userData.personality==='FOCUSED'?3.15:2.9,dt);
        else this.collectClueForNpc(npc,clue);
      }else{
        const terminal=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position))[0];
        if(terminal&&distanceXZ(npc.position,terminal.position)>4){this.setNpcState(npc,'REGROUP');this.moveNpc(npc,terminal.position,2.7,dt)}
        else this.setNpcState(npc,'IDLE');
      }
    }

    npc.userData.animator.update(dt,{state:npc.userData.state,injured:npc.userData.health===1});
  }
  updatePursuerNpc(npc,dt){
    const candidates=[
      ...(this.role==='ESCAPEE'?[{isPlayer:true,position:this.playerPosition}]:[]),
      ...this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped).map(e=>({isPlayer:false,entity:e,position:e.position}))
    ];
    if(!candidates.length)return;
    candidates.sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position));
    const spreadIndex=(npc.userData.patrolIndex||0)%Math.min(candidates.length,5);
    let target=candidates[spreadIndex];
    if(distanceXZ(npc.position,candidates[0].position)<12)target=candidates[0];
    const d=distanceXZ(npc.position,target.position);
    this.setNpcState(npc,d<38?'CHASE':'WALK');
    this.moveNpc(npc,target.position,d<38?5.6:3.2,dt);
    npc.userData.animator.update(dt,{state:npc.userData.state});
    const now=performance.now();
    if(d<1.9&&now>=npc.userData.nextAttackAt){
      npc.userData.nextAttackAt=now+1250;
      npc.userData.animator.update(dt,{state:'CHASE'});
      this.addNpcMessage(npc,`attack-${Math.floor(now/5000)}`,'Target acquired.',true);
      if(target.isPlayer){
        this.playerHealth-=1;
        this.addSystemMessage(`Warden hit you. Health: ${Math.max(0,this.playerHealth)}/3`);
        const push=this.playerPosition.clone().sub(npc.position).setY(0);
        if(push.lengthSq()>.01){push.normalize();const nx=this.playerPosition.x+push.x*2.4,nz=this.playerPosition.z+push.z*2.4;if(!this.collision(nx,nz,.65)){this.playerPosition.set(nx,0,nz)}}
        if(this.playerHealth<=0)this.end('CAUGHT');
      }else if(target.entity){
        target.entity.userData.health-=1;
        if(target.entity.userData.health<=0)this.captureEscapee(target.entity);
        else{
          const push=target.entity.position.clone().sub(npc.position).setY(0).normalize();
          const nx=target.entity.position.x+push.x*2.2,nz=target.entity.position.z+push.z*2.2;
          if(!this.collision(nx,nz,.75))target.entity.position.set(nx,0,nz);
        }
      }
    }
  }
  updateNpcs(dt){this.escapees.forEach(e=>this.updateEscapeeNpc(e,dt));this.pursuers.forEach(p=>this.updatePursuerNpc(p,dt))}
  completeTerminal(terminal,npc=null){if(terminal.userData.repaired)return;terminal.userData.repaired=true;terminal.userData.progress=1;terminal.userData.screenMaterial.color.set(0x1f7848);terminal.userData.screenMaterial.emissive.set(0x29ff82);terminal.userData.assignedNpcId=null;this.repaired+=1;if(npc)this.addNpcMessage(npc,`terminal-${this.repaired}`,"Terminal restored!",true);this.escapees.forEach(e=>{if(e.userData.targetTerminal===terminal)e.userData.targetTerminal=null});if(this.repaired>=REQUIRED_TERMINALS){this.exitGate.userData.open=true;this.exitGate.userData.door.visible=false;this.addSystemMessage("All codes accepted. The final gate is open. Choose one of three routes.")}}
  nearestClue(){return this.clues.filter(c=>!c.userData.found).sort((a,b)=>distanceXZ(this.playerPosition,a.position)-distanceXZ(this.playerPosition,b.position))[0]||null}
  showTerminalModal(terminal){
    if(this.objectiveCooldown||this.chatOpen)return;if(Date.now()<terminal.userData.lockedUntil){this.addSystemMessage(`Terminal locked for ${Math.ceil((terminal.userData.lockedUntil-Date.now())/1000)} seconds.`);return}
    this.objectiveCooldown=true;this.keys.clear();document.exitPointerLock?.();const known=[0,1,2,3].map(i=>terminal.userData.cluesFound.has(i)?terminal.userData.code[i]:'?').join(' ');const overlay=document.createElement('section');overlay.className='terminal-overlay';overlay.innerHTML=`<article class="terminal-card"><p class="eyebrow">${terminal.name}</p><h2>ACCESS CODE</h2><p class="terminal-known">CLUES: ${known}</p><input inputmode="numeric" maxlength="4" data-code placeholder="0000"><p class="form-error" data-error hidden></p><div class="menu-actions"><button class="menu-button menu-button--primary" data-confirm>CONFIRM</button><button class="menu-button" data-cancel>CANCEL</button></div></article>`;document.body.appendChild(overlay);const code=overlay.querySelector('[data-code]'),error=overlay.querySelector('[data-error]');const close=()=>{overlay.remove();this.objectiveCooldown=false};overlay.querySelector('[data-cancel]').onclick=close;overlay.querySelector('[data-confirm]').onclick=()=>{if(code.value===terminal.userData.code){this.completeTerminal(terminal);this.addSystemMessage(`${terminal.name} unlocked.`);close()}else{terminal.userData.failures+=1;error.hidden=false;error.textContent='ACCESS DENIED';this.addSystemMessage(`Wrong code at ${terminal.name}.`);if(terminal.userData.failures===2)this.addSystemMessage('The pursuer was alerted by the terminal alarm.');if(terminal.userData.failures>=3){terminal.userData.lockedUntil=Date.now()+30000;terminal.userData.failures=0;this.addSystemMessage(`${terminal.name} locked for 30 seconds.`);close()}}};requestAnimationFrame(()=>code.focus())}
  updateObjectives(dt){
    if(this.role!=="ESCAPEE"||this.chatOpen||this.objectiveCooldown)return;const use=this.keys.has("KeyE")||this.touch.interact;this.ui.prompt.classList.remove("visible");
    const clue=this.nearestClue();if(clue&&distanceXZ(this.playerPosition,clue.position)<3){this.ui.prompt.textContent=`PRESS E / USE TO READ CLUE`;this.ui.prompt.classList.add('visible');if(use&&!this.objectiveLatch){this.objectiveLatch=true;clue.userData.found=true;clue.visible=false;const terminal=this.terminals[clue.userData.terminalIndex];terminal.userData.cluesFound.add(clue.userData.digitIndex);this.addSystemMessage(`${terminal.name} digit ${clue.userData.digitIndex+1}: ${clue.userData.value}`)}}
    else{const terminal=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(this.playerPosition,a.position)-distanceXZ(this.playerPosition,b.position))[0];if(terminal&&distanceXZ(this.playerPosition,terminal.position)<3.5){this.ui.prompt.textContent=`PRESS E / USE TO ENTER CODE (${terminal.userData.cluesFound.size}/4 CLUES)`;this.ui.prompt.classList.add('visible');if(use&&!this.objectiveLatch){this.objectiveLatch=true;this.showTerminalModal(terminal)}}else if(this.exitGate.userData.open){const route=this.finalRoutes.sort((a,b)=>distanceXZ(this.playerPosition,a.position)-distanceXZ(this.playerPosition,b.position))[0];if(route&&distanceXZ(this.playerPosition,route.position)<7){if(!this.selectedRoute)this.ui.prompt.textContent=`HOLD E / USE: SELECT ${route.userData.name}`;else if(this.selectedRoute===route)this.ui.prompt.textContent=`COMPLETE ${route.userData.name}: ${Math.round(this.routeProgress/8*100)}%`;else this.ui.prompt.textContent='ANOTHER ROUTE IS LOCKED IN';this.ui.prompt.classList.add('visible');if(use){if(!this.selectedRoute){this.selectedRoute=route;route.userData.active=true;this.addSystemMessage(`${route.userData.name} route selected. Other routes are sealed.`)}if(this.selectedRoute===route){this.routeProgress+=dt;if(this.routeProgress>=8)this.end('ESCAPED')}}else if(this.selectedRoute===route)this.routeProgress=Math.max(0,this.routeProgress-dt*.35)}}}
    if(!use)this.objectiveLatch=false;
  }
  captureEscapee(target){if(target.userData.captured)return;target.userData.captured=true;target.visible=false;this.addSystemMessage(`${target.userData.name} was captured.`);this.checkMatchEnd()}
  tryCapture(){const target=this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped).sort((a,b)=>distanceXZ(this.playerPosition,a.position)-distanceXZ(this.playerPosition,b.position))[0];if(target&&distanceXZ(this.playerPosition,target.position)<2.2){target.userData.health-=1;this.addChatMessage({label:"Pursuer",className:"pursuer",displayName:this.profile.displayName,content:target.userData.health<=0?"Captured.":"You cannot escape."});if(target.userData.health<=0)this.captureEscapee(target)}}
  checkMatchEnd(){if(this.ended)return;const remaining=this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped),captured=this.escapees.filter(e=>e.userData.captured).length;if(this.role==="PURSUER"&&remaining.length===0)this.end(captured===this.escapees.length?"PURSUER WIN":"MATCH OVER")}
  calculateReward(result){let reward=25;if(this.role==="ESCAPEE"){reward+=this.repaired*100;if(result==="ESCAPED")reward+=400}else{reward+=this.escapees.filter(e=>e.userData.captured).length*150;if(result==="PURSUER WIN")reward+=500}return Math.max(0,Math.floor(reward))}
  grantMatchReward(result){if(this.rewardGranted||this.profile.role==="GUEST")return 0;this.rewardGranted=true;const reward=this.calculateReward(result);if(reward>0){addCoins(this.profile,reward);this.onCoinsChanged?.({profile:this.profile,amount:reward,result})}return reward}
  updateHud(){const remaining=Math.max(0,MATCH_TIME-this.elapsed);this.ui.time.textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(Math.floor(remaining%60)).padStart(2,"0")}`;this.ui.terminals.textContent=`${this.repaired} / ${REQUIRED_TERMINALS}`;const captured=this.escapees.filter(e=>e.userData.captured).length,active=this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped).length;this.ui.captured.textContent=`${captured} / ${this.escapees.length}`;this.ui.active.textContent=`${active+(this.role==="ESCAPEE"?1:0)} ACTIVE`;this.ui.health.textContent=`${Math.max(0,this.playerHealth)} / 3`;this.ui.stamina.textContent=`${Math.round(this.stamina)}%`}
  end(title){if(this.ended)return;this.ended=true;this.running=false;this.closeChat(false);document.exitPointerLock?.();const reward=this.grantMatchReward(title),overlay=document.createElement("section");overlay.className="overlay";overlay.innerHTML=`<article class="overlay-card"><h2>${title}</h2>${reward>0?`<p class="match-reward">+${reward.toLocaleString()} Coins</p>`:""}<div class="menu-actions"><button class="menu-button menu-button--primary" data-retry>RETRY</button><button class="menu-button" data-menu>MENU</button></div></article>`;document.body.appendChild(overlay);overlay.querySelector("[data-retry]").onclick=()=>{this.stop();this.onRetry?.()};overlay.querySelector("[data-menu]").onclick=()=>{this.stop();this.onExit?.()};this.overlay=overlay}
  animate(){if(!this.running)return;this.frame=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.05);this.elapsed+=dt;this.updatePlayer(dt);this.updateNpcs(dt);this.updateObjectives(dt);this.updateCamera();this.updateHud();this.checkMatchEnd();this.updateStuckRecovery(dt);this.updateAmbientConversation();if(this.elapsed>=MATCH_TIME)this.end(this.role==="PURSUER"?"PURSUER WIN":"TIME EXPIRED");this.renderer.render(this.scene,this.camera)}
  resize(){this.camera.aspect=this.container.clientWidth/this.container.clientHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false)}
  stop(){this.running=false;cancelAnimationFrame(this.frame);clearTimeout(this.viewToastTimer);removeEventListener("keydown",this.keyDown);removeEventListener("keyup",this.keyUp);removeEventListener("mousemove",this.mouseMove);removeEventListener("resize",this.resize);this.hud?.remove();this.chatRoot?.remove();this.touchRoot?.remove();this.overlay?.remove();this.renderer?.dispose();this.renderer?.domElement.remove()}
}
