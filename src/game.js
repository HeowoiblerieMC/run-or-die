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
    this.keys=new Set();this.escapees=[];this.pursuers=[];this.walls=[];this.obstacles=[];this.terminals=[];this.clues=[];this.finalRoutes=[];this.selectedRoute=null;this.routeProgress=0;this.objectiveCooldown=false;
    this.playerPosition=new THREE.Vector3();this.playerModel=null;this.playerAnimator=null;
    this.cameraModeIndex=0;this.cameraMode=CAMERA_MODES[0];this.cameraRay=new THREE.Raycaster();
    this.yaw=0;this.pitch=0;this.elapsed=0;this.stamina=100;this.repaired=0;this.repairProgress=0;
    this.running=false;this.ended=false;this.rewardGranted=false;this.chatOpen=false;this.chatMessages=[];this.chatMaximum=10;
    this.touch={sprint:false,sneak:false,interact:false};this.joystick={x:0,y:0,pointer:null};this.dragPointer=null;
    this.animate=this.animate.bind(this);this.keyDown=this.keyDown.bind(this);this.keyUp=this.keyUp.bind(this);this.mouseMove=this.mouseMove.bind(this);this.resize=this.resize.bind(this);
  }

  start(){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x071119);this.scene.fog=new THREE.Fog(0x071119,22,95);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,240);this.camera.rotation.order="YXZ";
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.container.appendChild(this.renderer.domElement);
    this.clock=new THREE.Clock();this.createLighting();this.createFacility();this.createInteriors();this.createObjectives();this.createCharacters();this.createHud();this.createGameChat();this.createTouchControls();this.bindEvents();this.updateCamera();
    this.addSystemMessage(this.role==="PURSUER"?"Capture all four escapees.":"Restore three terminals and reach the exit.");
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

  createCharacter(type,x,z,color,name){const c=type==="PURSUER"?createPursuer():createEscapee({jacketColor:color});c.position.set(x,0,z);Object.assign(c.userData,{entityId:crypto.randomUUID(),type,name,state:"IDLE",captured:false,escaped:false,health:2,stuckTime:0,avoidanceSide:Math.random()<.5?-1:1,targetTerminal:null,chatCooldownUntil:0,lastChatKey:"",animator:new CharacterAnimator(c)});this.scene.add(c);return c}
  createCharacters(){
    const pool=Array.from({length:1000},(_,i)=>({
      id:`npc_${String(i+1).padStart(4,'0')}`,
      name:`NOVA-${String(i+1).padStart(4,'0')}`,
      color:new THREE.Color().setHSL((i*.61803398875)%1,.55,.52).getHex()
    }));
    for(let i=pool.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    const walkable=[[-72,-70],[-52,-52],[-22,-52],[18,-60],[68,-72],[112,-118],[-122,20],[-70,20],[-34,24],[12,24],[56,20],[112,10],[-120,105],[-74,104],[-32,104],[18,104],[68,104],[112,98],[0,62],[45,68]];
    const escapeeCount=this.role==='ESCAPEE'?14:15;
    const pursuerNpcCount=this.role==='PURSUER'?4:5;
    if(this.role==='ESCAPEE'){
      this.playerPosition.set(0,0,24);this.yaw=Math.PI;this.playerModel=createEscapee({jacketColor:0xd59a43});
    }else{
      this.playerPosition.set(-125,0,-125);this.yaw=Math.PI/2;this.playerModel=createPursuer();
    }
    for(let i=0;i<escapeeCount;i+=1){
      const data=pool[i],spawn=walkable[i%walkable.length];
      const npc=this.createCharacter('ESCAPEE',spawn[0],spawn[1],data.color,data.name);
      npc.userData.entityId=data.id;
      this.escapees.push(npc);
    }
    for(let i=0;i<pursuerNpcCount;i+=1){
      const spawn=[[-128,-128],[128,-128],[-128,128],[128,128],[0,-128]][i];
      const hunter=this.createCharacter('PURSUER',spawn[0],spawn[1],0x15191c,`WARDEN-${String(i+1).padStart(2,'0')}`);
      hunter.userData.patrolIndex=i;
      this.pursuers.push(hunter);
    }
    this.playerModel.position.copy(this.playerPosition);this.playerModel.userData.animator=new CharacterAnimator(this.playerModel);this.playerAnimator=this.playerModel.userData.animator;this.scene.add(this.playerModel);this.syncPlayerModel();
  }

  createHud(){
    this.hud=document.createElement("div");this.hud.className="game-hud";this.hud.innerHTML=`<div class="hud-stack"><div class="hud-panel"><div class="hud-title">RUN FOR LIVE</div><div class="hud-row"><span>ROLE</span><strong>${this.role}</strong></div><div class="hud-row"><span>VIEW</span><strong data-view>FIRST</strong></div><div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div><div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div><div class="hud-row"><span>CAPTURED</span><strong data-captured>0 / 4</strong></div><div class="hud-row"><span>ESCAPEES</span><strong data-active>4 ACTIVE</strong></div><div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div></div></div><div class="crosshair"></div><div class="center-prompt" data-prompt></div><div class="view-toast" data-view-toast>FIRST PERSON</div>`;document.body.appendChild(this.hud);
    this.ui={view:this.hud.querySelector("[data-view]"),time:this.hud.querySelector("[data-time]"),terminals:this.hud.querySelector("[data-terminals]"),captured:this.hud.querySelector("[data-captured]"),active:this.hud.querySelector("[data-active]"),stamina:this.hud.querySelector("[data-stamina]"),prompt:this.hud.querySelector("[data-prompt]"),viewToast:this.hud.querySelector("[data-view-toast]")};
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
      try{const result=coin?executeAdminCoinCommand({executor:this.profile,command:content,profiles:this.getCommandProfiles()}):executeGiftCommand({sender:this.profile,command:content,profiles:this.getCommandProfiles()});this.addSystemMessage(result.message);this.onCoinsChanged?.(result)}catch(error){this.addSystemMessage(error?.message||String(error))}
      this.closeChat(true);return;
    }
    let identity;if(this.profile.role==="ADMIN")identity={label:"Admin",className:"admin"};else if(this.profile.role==="MODERATOR")identity={label:"Mod",className:"moderator"};else if(this.profile.role==="GUEST")identity={label:"Guest",className:"guest"};else{const selected=getSelectedRank(this.profile);identity={label:selected.label,className:selected.className}}
    this.addChatMessage({...identity,displayName:this.profile.displayName,content});this.closeChat(true);
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

  collision(x,z,r=.42){if(Math.abs(x)+r>WORLD_HALF||Math.abs(z)+r>WORLD_HALF)return true;return[...this.walls,...this.obstacles].some(o=>{const b=new THREE.Box3().setFromObject(o);return x+r>b.min.x&&x-r<b.max.x&&z+r>b.min.z&&z-r<b.max.z})}
  updatePlayer(dt){if(this.chatOpen){this.playerAnimator?.update(dt,{state:"IDLE"});return}let f=(this.keys.has("KeyW")?1:0)-(this.keys.has("KeyS")?1:0)-this.joystick.y,s=(this.keys.has("KeyD")?1:0)-(this.keys.has("KeyA")?1:0)+this.joystick.x;const sneak=this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")||this.touch.sneak,run=((this.keys.has("KeyW")&&this.keys.has("KeyR"))||this.touch.sprint)&&f>.1&&!sneak&&this.stamina>0,speed=sneak?1.8:run?7.2:4.4;this.stamina=THREE.MathUtils.clamp(this.stamina+(run?-25:17)*dt,0,100);const l=Math.hypot(f,s);if(l>1){f/=l;s/=l}const move=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)).multiplyScalar(f).add(new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)).multiplyScalar(s));const x=this.playerPosition.x+move.x*speed*dt,z=this.playerPosition.z+move.z*speed*dt;if(!this.collision(x,this.playerPosition.z))this.playerPosition.x=x;if(!this.collision(this.playerPosition.x,z))this.playerPosition.z=z;this.syncPlayerModel();this.playerAnimator?.update(dt,{state:move.lengthSq()<.001?"IDLE":run?"RUN":"WALK"})}
  syncPlayerModel(){if(!this.playerModel)return;this.playerModel.position.copy(this.playerPosition);this.playerModel.rotation.y=this.yaw;this.playerModel.visible=this.cameraMode!=="FIRST"}
  updateCamera(){const eye=this.playerPosition.clone();eye.y+=PLAYER_HEIGHT;const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));if(this.cameraMode==="FIRST"){this.camera.position.copy(eye);this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");return}const target=eye.clone();target.y-=.15;const desired=eye.clone();if(this.cameraMode==="SECOND"){desired.addScaledVector(forward,4.6);desired.y+=.55}else{desired.addScaledVector(forward,-5.7);desired.y+=1.5}const direction=desired.clone().sub(target),max=direction.length();direction.normalize();this.cameraRay.set(target,direction);this.cameraRay.far=max;const hits=this.cameraRay.intersectObjects([...this.walls,...this.obstacles],false),safe=hits.length?target.clone().addScaledVector(direction,Math.max(.7,hits[0].distance-.35)):desired;this.camera.position.lerp(safe,.22);this.camera.lookAt(target)}

  chooseNpcDirection(npc,desired){const r=npc.userData.type==="PURSUER"?.78:.52,side=npc.userData.avoidanceSide||1;for(const angle of[0,25*side,-25*side,50*side,-50*side,75*side,-75*side,110,-110,160,-160,180]){const candidate=desired.clone().applyAxisAngle(UP,THREE.MathUtils.degToRad(angle));if(!this.collision(npc.position.x+candidate.x*1.3,npc.position.z+candidate.z*1.3,r)){if(angle!==0&&angle!==180)npc.userData.avoidanceSide=Math.sign(angle)||side;return candidate}}return null}
  moveNpc(npc,target,speed,dt){const desired=target.clone().sub(npc.position).setY(0);if(desired.lengthSq()<.01)return;desired.normalize();const direction=this.chooseNpcDirection(npc,desired);if(!direction){npc.userData.stuckTime+=dt;if(npc.userData.stuckTime>.7){npc.userData.avoidanceSide*=-1;npc.userData.stuckTime=0}return}npc.userData.stuckTime=0;const r=npc.userData.type==="PURSUER"?.78:.52,x=npc.position.x+direction.x*speed*dt,z=npc.position.z+direction.z*speed*dt;if(!this.collision(x,npc.position.z,r))npc.position.x=x;if(!this.collision(npc.position.x,z,r))npc.position.z=z;const targetRotation=Math.atan2(direction.x,direction.z)+Math.PI,diff=THREE.MathUtils.euclideanModulo(targetRotation-npc.rotation.y+Math.PI,Math.PI*2)-Math.PI;npc.rotation.y+=diff*Math.min(1,dt*9)}
  setNpcState(npc,state){if(npc.userData.state===state)return;npc.userData.state=state;if(state==="FLEE")this.addNpcMessage(npc,"flee","The pursuer is here!");else if(state==="REPAIR")this.addNpcMessage(npc,"repair","Repairing a terminal.");else if(state==="ESCAPE")this.addNpcMessage(npc,"exit","The exit is open. Move!");else if(state==="CHASE"&&npc.userData.type==="PURSUER")this.addNpcMessage(npc,"chase","I found you.")}
  selectTerminalForNpc(npc){if(npc.userData.targetTerminal&&!npc.userData.targetTerminal.userData.repaired)return npc.userData.targetTerminal;const available=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position)),terminal=available.find(t=>!t.userData.assignedNpcId||t.userData.assignedNpcId===npc.userData.entityId)||available[0];if(terminal){terminal.userData.assignedNpcId=npc.userData.entityId;npc.userData.targetTerminal=terminal}return terminal}
  updateEscapeeNpc(npc,dt){if(npc.userData.captured||npc.userData.escaped)return;const pursuer=this.role==="PURSUER"?{position:this.playerPosition}:this.pursuers[0],danger=pursuer?distanceXZ(npc.position,pursuer.position):Infinity;if(danger<13){this.setNpcState(npc,"FLEE");const away=npc.position.clone().sub(pursuer.position).setY(0);if(away.lengthSq()<.01)away.set(1,0,0);this.moveNpc(npc,npc.position.clone().add(away.normalize().multiplyScalar(12)),4.9,dt)}else if(this.repaired>=REQUIRED_TERMINALS){this.setNpcState(npc,"ESCAPE");this.moveNpc(npc,this.exitGate.position,3.9,dt);if(distanceXZ(npc.position,this.exitGate.position)<2){npc.userData.escaped=true;npc.visible=false;this.addSystemMessage(`${npc.userData.name} escaped.`)}}else{const terminal=this.selectTerminalForNpc(npc);if(!terminal)this.setNpcState(npc,"IDLE");else if(distanceXZ(npc.position,terminal.position)>2.1){this.setNpcState(npc,"WALK");this.moveNpc(npc,terminal.position,2.8,dt)}else{this.setNpcState(npc,"REPAIR");terminal.userData.progress+=dt/REPAIR_TIME*.55;if(terminal.userData.progress>=1)this.completeTerminal(terminal,npc)}}npc.userData.animator.update(dt,{state:npc.userData.state,injured:npc.userData.health===1})}
  updatePursuerNpc(npc,dt){const candidates=[{isPlayer:true,position:this.playerPosition},...this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped).map(e=>({isPlayer:false,entity:e,position:e.position}))];if(!candidates.length)return;candidates.sort((a,b)=>distanceXZ(npc.position,a.position)-distanceXZ(npc.position,b.position));const target=candidates[Math.min(npc.userData.patrolIndex||0,candidates.length-1)],d=distanceXZ(npc.position,target.position);this.setNpcState(npc,d<24?"CHASE":"WALK");this.moveNpc(npc,target.position,d<24?4.7:2.4,dt);npc.userData.animator.update(dt,{state:npc.userData.state});if(d<1.25){if(target.isPlayer){this.addNpcMessage(npc,"caught","You're coming with me.",true);this.end("CAUGHT")}else{target.entity.userData.health-=1;if(target.entity.userData.health<=0)this.captureEscapee(target.entity);else target.entity.position.addScaledVector(target.entity.position.clone().sub(npc.position).setY(0).normalize(),3)}}}
  updateNpcs(dt){this.escapees.forEach(e=>this.updateEscapeeNpc(e,dt));if(this.role==="ESCAPEE")this.pursuers.forEach(p=>this.updatePursuerNpc(p,dt))}
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
  updateHud(){const remaining=Math.max(0,MATCH_TIME-this.elapsed);this.ui.time.textContent=`${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(Math.floor(remaining%60)).padStart(2,"0")}`;this.ui.terminals.textContent=`${this.repaired} / ${REQUIRED_TERMINALS}`;const captured=this.escapees.filter(e=>e.userData.captured).length,active=this.escapees.filter(e=>!e.userData.captured&&!e.userData.escaped).length;this.ui.captured.textContent=`${captured} / ${this.escapees.length}`;this.ui.active.textContent=`${active+(this.role==="ESCAPEE"?1:0)} ACTIVE`;this.ui.stamina.textContent=`${Math.round(this.stamina)}%`}
  end(title){if(this.ended)return;this.ended=true;this.running=false;this.closeChat(false);document.exitPointerLock?.();const reward=this.grantMatchReward(title),overlay=document.createElement("section");overlay.className="overlay";overlay.innerHTML=`<article class="overlay-card"><h2>${title}</h2>${reward>0?`<p class="match-reward">+${reward.toLocaleString()} Coins</p>`:""}<div class="menu-actions"><button class="menu-button menu-button--primary" data-retry>RETRY</button><button class="menu-button" data-menu>MENU</button></div></article>`;document.body.appendChild(overlay);overlay.querySelector("[data-retry]").onclick=()=>{this.stop();this.onRetry?.()};overlay.querySelector("[data-menu]").onclick=()=>{this.stop();this.onExit?.()};this.overlay=overlay}
  animate(){if(!this.running)return;this.frame=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.05);this.elapsed+=dt;this.updatePlayer(dt);this.updateNpcs(dt);this.updateObjectives(dt);this.updateCamera();this.updateHud();this.checkMatchEnd();if(this.elapsed>=MATCH_TIME)this.end(this.role==="PURSUER"?"PURSUER WIN":"TIME EXPIRED");this.renderer.render(this.scene,this.camera)}
  resize(){this.camera.aspect=this.container.clientWidth/this.container.clientHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(this.container.clientWidth,this.container.clientHeight,false)}
  stop(){this.running=false;cancelAnimationFrame(this.frame);clearTimeout(this.viewToastTimer);removeEventListener("keydown",this.keyDown);removeEventListener("keyup",this.keyUp);removeEventListener("mousemove",this.mouseMove);removeEventListener("resize",this.resize);this.hud?.remove();this.chatRoot?.remove();this.touchRoot?.remove();this.overlay?.remove();this.renderer?.dispose();this.renderer?.domElement.remove()}
}
