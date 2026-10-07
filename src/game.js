import * as THREE from "three";

const MATCH_TIME = 600;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 7.2;
const SNEAK_SPEED = 1.8;
const REQUIRED_TERMINALS = 3;
const REPAIR_TIME = 5;
const INTERACT_DISTANCE = 3.4;

const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: .08, ...extra });

function box(name, size, position, color, customMaterial = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), customMaterial || material(color));
    mesh.name = name;
    mesh.position.set(...position);
    return mesh;
}

export class Game {
    constructor(container, { role = "ESCAPEE", onExit, onRetry } = {}) {
        this.container = container;
        this.role = role;
        this.onExit = onExit;
        this.onRetry = onRetry;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.running = false;
        this.frame = null;
        this.keys = new Set();
        this.yaw = 0;
        this.pitch = 0;
        this.paused = false;
        this.ended = false;
        this.elapsed = 0;
        this.stamina = 100;
        this.repaired = 0;
        this.walls = [];
        this.obstacles = [];
        this.terminals = [];
        this.escapees = [];
        this.pursuers = [];
        this.exitGate = null;
        this.currentInteraction = null;
        this.repairProgress = 0;
        this.hud = null;
        this.hudValues = {};
        this.overlay = null;
        this.isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
        this.dragPointer = null;
        this.dragX = 0;
        this.dragY = 0;
        this.joystick = { x: 0, y: 0, pointer: null };
        this.touch = { sprint: false, sneak: false, interact: false };
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.move = new THREE.Vector3();
        this.animate = this.animate.bind(this);
        this.resize = this.resize.bind(this);
        this.keyDown = this.keyDown.bind(this);
        this.keyUp = this.keyUp.bind(this);
        this.mouseMove = this.mouseMove.bind(this);
        this.pointerLockChange = this.pointerLockChange.bind(this);
    }

    start() {
        this.createScene();
        this.createRenderer();
        this.createFacility();
        this.createObjectives();
        this.createCharacters();
        this.createHUD();
        this.createTouchControls();
        this.bind();
        this.running = true;
        this.clock.start();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x071119);
        this.scene.fog = new THREE.Fog(0x071119, 20, 95);
        this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, .08, 260);
        this.camera.position.set(0, PLAYER_HEIGHT, 35);
        this.camera.rotation.order = "YXZ";
        this.scene.add(new THREE.HemisphereLight(0x6389a0, 0x0d1113, 1.25));
        const sun = new THREE.DirectionalLight(0xb8dded, 1.2);
        sun.position.set(20, 30, 10);
        this.scene.add(sun);
        const red = new THREE.PointLight(0xff2424, 2.1, 35, 2);
        red.position.set(0, 5, 0);
        this.scene.add(red);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
    }

    createFacility() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 20, 20), material(0x222a2e));
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(100, 50, 0x4f626c, 0x36434a);
        grid.position.y = .01;
        this.scene.add(grid);
        [[0,-49,98,1],[0,49,98,1],[-49,0,1,98],[49,0,1,98],[-25,-20,1,38],[-25,26,1,34],[25,-24,1,34],[25,25,1,38],[0,-12,28,1],[8,12,30,1],[-18,34,28,1],[-36,4,20,1],[36,2,20,1]].forEach(([x,z,w,d]) => this.addWall(x,z,w,d));
        [[-36,-34],[-31,-34],[-36,-29],[35,33],[30,33],[35,28],[6,-27],[11,-27],[6,-22],[-8,22],[-3,22],[16,26],[21,26]].forEach(([x,z]) => this.addCrate(x,z));
        for (let x = -40; x <= 40; x += 16) {
            const lamp = box("CeilingLamp", [5,.12,.7], [x,5.1,-37], 0xd4e6ed, material(0xcfe8f2,{emissive:0x76b9d6,emissiveIntensity:.8}));
            this.scene.add(lamp);
        }
    }

    addWall(x,z,w,d) {
        const wall = box("Wall", [w,5,d], [x,2.5,z], 0x38444a);
        this.scene.add(wall); this.walls.push(wall);
    }

    addCrate(x,z) {
        const crate = box("Crate", [3.4,2.6,3.4], [x,1.3,z], 0x655f49);
        this.scene.add(crate); this.obstacles.push(crate);
    }

    createObjectives() {
        [[-38,0],[36,-30],[10,38]].forEach(([x,z], index) => {
            const group = new THREE.Group(); group.position.set(x,0,z); group.name = `Terminal${index+1}`;
            const screenMat = material(0x681f1f,{emissive:0xff2020,emissiveIntensity:1.2});
            group.add(box("TerminalBody",[2,2.4,1.2],[0,1.2,0],0x263239),box("TerminalScreen",[1.3,.75,.08],[0,1.55,-.64],0,screenMat));
            group.userData = { repaired:false, progress:0, screenMat, assigned:null };
            this.scene.add(group); this.terminals.push(group);
        });
        this.exitGate = new THREE.Group(); this.exitGate.position.set(0,0,-47.5);
        const frame = material(0x596871,{metalness:.5});
        this.exitGate.add(box("Frame",[1,5,1],[-3.5,2.5,0],0,frame),box("Frame",[1,5,1],[3.5,2.5,0],0,frame),box("Frame",[8,1,1],[0,4.5,0],0,frame));
        const door = box("Door",[6,4,.5],[0,2,0],0x5a1818,material(0x5a1818,{emissive:0x9d1515,emissiveIntensity:.5}));
        this.exitGate.add(door); this.exitGate.userData = { open:false, door };
        this.scene.add(this.exitGate);
    }

    createCharacter(type, x, z, color, player = false) {
        const root = new THREE.Group(); root.position.set(x,0,z); root.userData = { type, player, state:"IDLE", target:null, captured:false, escaped:false, health:2, cooldown:0 };
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(.55,1.35,6,10), material(color)); body.position.y = 1.35;
        const head = new THREE.Mesh(new THREE.SphereGeometry(.42,14,10), material(type === "PURSUER" ? 0x111416 : 0xc8a789)); head.position.y = 2.65;
        root.add(body, head);
        if (type === "PURSUER") {
            const eye = new THREE.PointLight(0xff2222,2.5,8,2); eye.position.set(0,2.7,-.35); root.add(eye);
        }
        this.scene.add(root); return root;
    }

    createCharacters() {
        if (this.role === "ESCAPEE") {
            this.playerType = "ESCAPEE";
            [[-2,34],[2,34],[5,32]].forEach((p,i) => this.escapees.push(this.createCharacter("ESCAPEE",p[0],p[1],[0x3e8fd1,0x3fae72,0xb07bd8][i])));
            this.pursuers.push(this.createCharacter("PURSUER",-35,-35,0x15191c));
        } else {
            this.playerType = "PURSUER";
            this.camera.position.set(-35,PLAYER_HEIGHT,-35);
            [[-8,34],[-2,36],[4,34],[10,36]].forEach((p,i) => this.escapees.push(this.createCharacter("ESCAPEE",p[0],p[1],[0x3e8fd1,0x3fae72,0xb07bd8,0xd59a43][i])));
        }
    }

    createHUD() {
        this.hud = document.createElement("div"); this.hud.className = "game-hud";
        this.hud.innerHTML = `<div class="hud-stack"><div class="hud-panel"><div class="hud-title">RUN FOR LIVE</div><div class="hud-row"><span>ROLE</span><strong data-role>${this.role}</strong></div><div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div><div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div><div class="hud-row"><span>ESCAPEES</span><strong data-escapees>4 ACTIVE</strong></div><div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div><div class="bar"><div data-stamina-bar></div></div></div></div><div class="crosshair"></div><div class="threat" data-threat>PURSUER DETECTED</div><div class="center-prompt" data-prompt></div>`;
        document.body.appendChild(this.hud);
        this.hudValues = { time:this.hud.querySelector("[data-time]"), terminals:this.hud.querySelector("[data-terminals]"), escapees:this.hud.querySelector("[data-escapees]"), stamina:this.hud.querySelector("[data-stamina]"), staminaBar:this.hud.querySelector("[data-stamina-bar]"), threat:this.hud.querySelector("[data-threat]"), prompt:this.hud.querySelector("[data-prompt]") };
    }

    createTouchControls() {
        const root = document.createElement("div"); root.id = "touch-controls";
        root.innerHTML = `<div class="look-zone" data-look></div><div class="joystick" data-joystick><div class="joystick-stick" data-stick></div></div><div class="touch-actions"><button class="touch-btn" data-run>RUN</button><button class="touch-btn" data-use>USE</button><button class="touch-btn" data-sneak>SNEAK</button><button class="touch-btn" data-action>${this.role === "PURSUER" ? "CAPTURE" : "PING"}</button></div><button class="menu-touch" data-menu>â°</button>`;
        document.body.appendChild(root); this.touchRoot = root;
        const look = root.querySelector("[data-look]");
        look.addEventListener("pointerdown", e => this.beginLook(e)); look.addEventListener("pointermove", e => this.moveLook(e)); look.addEventListener("pointerup", e => this.endLook(e)); look.addEventListener("pointercancel", e => this.endLook(e));
        const joy = root.querySelector("[data-joystick]"); this.joyStick = root.querySelector("[data-stick]");
        joy.addEventListener("pointerdown", e => this.beginJoystick(e,joy)); joy.addEventListener("pointermove", e => this.moveJoystick(e,joy)); joy.addEventListener("pointerup", e => this.endJoystick(e)); joy.addEventListener("pointercancel", e => this.endJoystick(e));
        this.bindTouchHold(root.querySelector("[data-run]"), value => this.touch.sprint = value);
        this.bindTouchHold(root.querySelector("[data-use]"), value => this.touch.interact = value);
        root.querySelector("[data-sneak]").addEventListener("pointerdown", e => { e.preventDefault(); this.touch.sneak = !this.touch.sneak; e.currentTarget.classList.toggle("active",this.touch.sneak); });
        root.querySelector("[data-action]").addEventListener("pointerdown", e => { e.preventDefault(); if(this.role === "PURSUER") this.tryCapture(); });
        root.querySelector("[data-menu]").addEventListener("click", () => this.setPaused(true));
    }

    bindTouchHold(element, callback) {
        element.addEventListener("pointerdown", e => { e.preventDefault(); element.classList.add("active"); callback(true); });
        ["pointerup","pointercancel","pointerleave"].forEach(name => element.addEventListener(name, e => { e.preventDefault(); element.classList.remove("active"); callback(false); }));
    }

    beginLook(e) { e.preventDefault(); this.dragPointer=e.pointerId; this.dragX=e.clientX; this.dragY=e.clientY; e.currentTarget.setPointerCapture?.(e.pointerId); }
    moveLook(e) { if(e.pointerId!==this.dragPointer)return; e.preventDefault(); this.applyLook(e.clientX-this.dragX,e.clientY-this.dragY,.005); this.dragX=e.clientX; this.dragY=e.clientY; }
    endLook(e) { if(e.pointerId===this.dragPointer)this.dragPointer=null; }
    beginJoystick(e,zone) { e.preventDefault(); this.joystick.pointer=e.pointerId; zone.setPointerCapture?.(e.pointerId); this.moveJoystick(e,zone); }
    moveJoystick(e,zone) { if(e.pointerId!==this.joystick.pointer)return; const r=zone.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; let x=e.clientX-cx,y=e.clientY-cy; const max=45,d=Math.hypot(x,y); if(d>max){x=x/d*max;y=y/d*max;} this.joystick.x=x/max; this.joystick.y=y/max; this.joyStick.style.transform=`translate(${x}px,${y}px)`; }
    endJoystick(e) { if(e.pointerId!==this.joystick.pointer)return; this.joystick={x:0,y:0,pointer:null}; this.joyStick.style.transform="translate(0,0)"; }

    bind() {
        addEventListener("resize",this.resize); addEventListener("keydown",this.keyDown); addEventListener("keyup",this.keyUp); addEventListener("mousemove",this.mouseMove); document.addEventListener("pointerlockchange",this.pointerLockChange);
        this.renderer.domElement.addEventListener("click",() => { if(!this.isTouch&&!this.paused&&!this.ended) this.renderer.domElement.requestPointerLock?.(); });
        this.renderer.domElement.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&document.pointerLockElement!==this.renderer.domElement){this.beginLook(e);}});
        this.renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerType==="mouse"&&document.pointerLockElement!==this.renderer.domElement)this.moveLook(e);});
        this.renderer.domElement.addEventListener("pointerup",e=>this.endLook(e));
    }

    keyDown(e) { if(["KeyW","KeyA","KeyS","KeyD","KeyR","KeyE","ShiftLeft","ShiftRight","Space"].includes(e.code))e.preventDefault(); if(e.code==="Escape"&&!e.repeat){this.setPaused(!this.paused);return;} if(e.code==="Space"&&!e.repeat&&this.role==="PURSUER")this.tryCapture(); this.keys.add(e.code); }
    keyUp(e) { this.keys.delete(e.code); if(e.code==="KeyE")this.repairProgress=0; }
    mouseMove(e) { if(document.pointerLockElement!==this.renderer.domElement||this.paused||this.ended)return; this.applyLook(e.movementX,e.movementY,.0023); }
    applyLook(dx,dy,sensitivity) { this.yaw-=dx*sensitivity; this.pitch=THREE.MathUtils.clamp(this.pitch-dy*sensitivity,-1.48,1.48); }
    pointerLockChange() { if(!this.isTouch&&document.pointerLockElement!==this.renderer.domElement&&!this.paused&&!this.ended&&this.running)this.setPaused(true); }

    updatePlayer(dt) {
        if(this.paused||this.ended)return;
        let forward=(this.keys.has("KeyW")?1:0)-(this.keys.has("KeyS")?1:0)-this.joystick.y;
        let side=(this.keys.has("KeyD")?1:0)-(this.keys.has("KeyA")?1:0)+this.joystick.x;
        const sneak=this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")||this.touch.sneak;
        const sprint=((this.keys.has("KeyW")&&this.keys.has("KeyR"))||this.touch.sprint)&&forward>.1&&!sneak&&this.stamina>0;
        const speed=sneak?SNEAK_SPEED:sprint?SPRINT_SPEED:WALK_SPEED;
        this.stamina=THREE.MathUtils.clamp(this.stamina+(sprint?-25:17)*dt,0,100);
        const len=Math.hypot(forward,side); if(len>1){forward/=len;side/=len;}
        this.forward.set(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
        this.right.set(Math.cos(this.yaw),0,-Math.sin(this.yaw));
        this.move.set(0,0,0).addScaledVector(this.forward,forward).addScaledVector(this.right,side).multiplyScalar(speed*dt);
        const nx=this.camera.position.x+this.move.x,nz=this.camera.position.z+this.move.z;
        if(!this.collides(nx,this.camera.position.z))this.camera.position.x=nx;
        if(!this.collides(this.camera.position.x,nz))this.camera.position.z=nz;
        this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");
    }

    collides(x,z) {
        for(const object of [...this.walls,...this.obstacles]) { const b=new THREE.Box3().setFromObject(object); if(x+PLAYER_RADIUS>b.min.x&&x-PLAYER_RADIUS<b.max.x&&z+PLAYER_RADIUS>b.min.z&&z-PLAYER_RADIUS<b.max.z)return true; }
        return false;
    }

    updateEscapeeNPCs(dt) {
        for(const npc of this.escapees) {
            if(npc.userData.captured||npc.userData.escaped)continue;
            const pursuer=this.getNearestPursuer(npc.position); const danger=pursuer&&distanceXZ(npc.position,pursuer.position)<13;
            if(danger){npc.userData.state="FLEE"; const dir=npc.position.clone().sub(pursuer.position).setY(0).normalize(); this.moveNPC(npc,dir,4.9,dt); continue;}
            if(this.repaired>=REQUIRED_TERMINALS){npc.userData.state="ESCAPE"; this.moveNPCToward(npc,this.exitGate.position,3.8,dt); if(distanceXZ(npc.position,this.exitGate.position)<2){npc.userData.escaped=true;npc.visible=false;} continue;}
            let terminal=this.terminals.find(t=>!t.userData.repaired&&(!t.userData.assigned||t.userData.assigned===npc));
            if(!terminal)terminal=this.terminals.find(t=>!t.userData.repaired);
            if(!terminal){npc.userData.state="IDLE";continue;}
            terminal.userData.assigned=npc; npc.userData.target=terminal;
            if(distanceXZ(npc.position,terminal.position)>2){npc.userData.state="SEARCH";this.moveNPCToward(npc,terminal.position,2.8,dt);} else {npc.userData.state="REPAIR";terminal.userData.progress+=dt/REPAIR_TIME*.72;if(terminal.userData.progress>=1)this.completeTerminal(terminal);}
        }
    }

    updatePursuerNPCs(dt) {
        for(const npc of this.pursuers) {
            let target=this.getNearestActiveEscapee(npc.position,true); if(!target){npc.userData.state="PATROL";continue;}
            const d=distanceXZ(npc.position,target.position); npc.userData.state=d<24?"CHASE":"PATROL";
            if(npc.userData.state==="CHASE")this.moveNPCToward(npc,target.position,4.7,dt); else {const patrol=this.terminals.find(t=>!t.userData.repaired)||this.exitGate;this.moveNPCToward(npc,patrol.position,2.2,dt);}
            if(d<1.25){if(target===this.camera){this.endMatch("CAUGHT");}else{target.userData.captured=true;target.visible=false;}}
        }
    }

    getNearestPursuer(position){return this.pursuers.sort((a,b)=>distanceXZ(position,a.position)-distanceXZ(position,b.position))[0]||null;}
    getNearestActiveEscapee(position,includePlayer){const list=this.escapees.filter(n=>!n.userData.captured&&!n.userData.escaped); if(includePlayer&&this.role==="ESCAPEE")list.push(this.camera); return list.sort((a,b)=>distanceXZ(position,a.position)-distanceXZ(position,b.position))[0]||null;}
    moveNPCToward(npc,target,speed,dt){const dir=target.clone().sub(npc.position).setY(0);if(dir.lengthSq()<.01)return;dir.normalize();this.moveNPC(npc,dir,speed,dt);}
    moveNPC(npc,dir,speed,dt){const nx=npc.position.x+dir.x*speed*dt,nz=npc.position.z+dir.z*speed*dt;if(!this.collides(nx,npc.position.z))npc.position.x=nx;if(!this.collides(npc.position.x,nz))npc.position.z=nz;npc.rotation.y=Math.atan2(dir.x,dir.z);}

    updateInteraction(dt) {
        if(this.paused||this.ended)return;
        const interacting=this.keys.has("KeyE")||this.touch.interact;
        this.currentInteraction=null;
        if(this.role==="ESCAPEE") {
            const terminal=this.terminals.filter(t=>!t.userData.repaired).sort((a,b)=>distanceXZ(this.camera.position,a.position)-distanceXZ(this.camera.position,b.position))[0];
            if(terminal&&distanceXZ(this.camera.position,terminal.position)<INTERACT_DISTANCE){this.currentInteraction={type:"TERMINAL",object:terminal};this.prompt("HOLD E / USE TO RESTORE");}
            else if(distanceXZ(this.camera.position,this.exitGate.position)<4){this.currentInteraction={type:"EXIT"};this.prompt(this.exitGate.userData.open?"PRESS E / USE TO ESCAPE":`${REQUIRED_TERMINALS-this.repaired} TERMINALS REMAINING`);} else this.prompt(null);
            if(interacting&&this.currentInteraction?.type==="TERMINAL"){this.repairProgress+=dt;this.currentInteraction.object.userData.progress=Math.max(this.currentInteraction.object.userData.progress,this.repairProgress/REPAIR_TIME);this.prompt(`RESTORING ${Math.round(this.currentInteraction.object.userData.progress*100)}%`);if(this.currentInteraction.object.userData.progress>=1){this.completeTerminal(this.currentInteraction.object);this.repairProgress=0;}}
            else if(interacting&&this.currentInteraction?.type==="EXIT"&&this.exitGate.userData.open)this.endMatch("ESCAPED"); else if(!interacting)this.repairProgress=0;
        } else {this.prompt("SPACE / CAPTURE NEAR AN ESCAPEE");}
    }

    completeTerminal(terminal){if(terminal.userData.repaired)return;terminal.userData.repaired=true;terminal.userData.progress=1;terminal.userData.screenMat.color.set(0x1f7848);terminal.userData.screenMat.emissive.set(0x29ff82);this.repaired++;if(this.repaired>=REQUIRED_TERMINALS){this.exitGate.userData.open=true;this.exitGate.userData.door.visible=false;}}
    tryCapture(){if(this.role!=="PURSUER"||this.paused||this.ended)return;const target=this.getNearestActiveEscapee(this.camera.position,false);if(target&&distanceXZ(this.camera.position,target.position)<2.2){target.userData.health--;if(target.userData.health<=0){target.userData.captured=true;target.visible=false;} else {const away=target.position.clone().sub(this.camera.position).setY(0).normalize();target.position.addScaledVector(away,4);}}}
    prompt(text){this.hudValues.prompt.textContent=text||"";this.hudValues.prompt.classList.toggle("visible",Boolean(text));}

    updateMatch(dt) {
        if(this.paused||this.ended)return;this.elapsed+=dt;if(this.elapsed>=MATCH_TIME)this.endMatch(this.role==="PURSUER"?"PURSUER_WIN":"TIME_EXPIRED");
        const active=this.escapees.filter(n=>!n.userData.captured&&!n.userData.escaped).length;
        const escaped=this.escapees.filter(n=>n.userData.escaped).length;
        if(this.role==="PURSUER"&&active===0)this.endMatch(escaped>0?"ESCAPEES_WIN":"PURSUER_WIN");
        if(this.role==="ESCAPEE"&&this.exitGate.userData.open&&escaped>=3)this.endMatch("TEAM_ESCAPED");
    }

    updateHUD() {
        const remain=Math.max(0,MATCH_TIME-this.elapsed),m=Math.floor(remain/60),s=Math.floor(remain%60);this.hudValues.time.textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;this.hudValues.terminals.textContent=`${this.repaired} / ${REQUIRED_TERMINALS}`;
        const active=this.escapees.filter(n=>!n.userData.captured&&!n.userData.escaped).length+(this.role==="ESCAPEE"?1:0);this.hudValues.escapees.textContent=`${active} ACTIVE`;const st=Math.round(this.stamina);this.hudValues.stamina.textContent=`${st}%`;this.hudValues.staminaBar.style.width=`${st}%`;
        const pursuer=this.getNearestPursuer(this.camera.position);this.hudValues.threat.classList.toggle("visible",this.role==="ESCAPEE"&&pursuer&&distanceXZ(this.camera.position,pursuer.position)<15);
    }

    setPaused(value){if(this.ended)return;this.paused=value;if(value){document.exitPointerLock?.();this.showOverlay("PAUSED","The match is waiting.",[{label:"RESUME",action:()=>{this.hideOverlay();this.paused=false;if(!this.isTouch)this.renderer.domElement.requestPointerLock?.();}},{label:"BACK TO MENU",action:()=>{this.stop();this.onExit?.();}}]);}}
    showOverlay(title,message,actions){this.hideOverlay();this.overlay=document.createElement("section");this.overlay.className="overlay";this.overlay.innerHTML=`<article class="overlay-card"><p class="eyebrow">RUN FOR LIVE</p><h2>${title}</h2><p>${message}</p><div class="menu-actions" data-actions></div></article>`;for(const item of actions){const b=document.createElement("button");b.className=`menu-button ${item.primary?"menu-button--primary":""}`;b.textContent=item.label;b.addEventListener("click",item.action);this.overlay.querySelector("[data-actions]").appendChild(b);}document.body.appendChild(this.overlay);}
    hideOverlay(){this.overlay?.remove();this.overlay=null;}
    endMatch(result){if(this.ended)return;this.ended=true;document.exitPointerLock?.();const win=["ESCAPED","TEAM_ESCAPED","PURSUER_WIN"].includes(result);const title=result.replaceAll("_"," ");this.showOverlay(title,win?"The match objective was completed.":"The facility claimed another match.",[{label:"RETRY",primary:true,action:()=>{this.stop();this.onRetry?.();}},{label:"BACK TO MENU",action:()=>{this.stop();this.onExit?.();}}]);}

    update(dt){this.updatePlayer(dt);this.updateEscapeeNPCs(dt);this.updatePursuerNPCs(dt);this.updateInteraction(dt);this.updateMatch(dt);this.updateHUD();}
    animate(){if(!this.running)return;this.frame=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.05);this.update(dt);this.renderer.render(this.scene,this.camera);}
    resize(){if(!this.camera||!this.renderer)return;const w=Math.max(this.container.clientWidth,1),h=Math.max(this.container.clientHeight,1);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}

    stop(){if(!this.running)return;this.running=false;cancelAnimationFrame(this.frame);removeEventListener("resize",this.resize);removeEventListener("keydown",this.keyDown);removeEventListener("keyup",this.keyUp);removeEventListener("mousemove",this.mouseMove);document.removeEventListener("pointerlockchange",this.pointerLockChange);document.exitPointerLock?.();this.clock.stop();this.hud?.remove();this.touchRoot?.remove();this.overlay?.remove();this.renderer?.dispose();this.renderer?.domElement.remove();this.scene=null;this.camera=null;this.renderer=null;}
}
