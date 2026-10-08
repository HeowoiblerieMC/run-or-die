import * as THREE from "three";
import { createEscapee, createPursuer, CharacterAnimator } from "./characters.js";

const MATCH_TIME = 600;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.42;
const REQUIRED_TERMINALS = 3;
const REPAIR_TIME = 5;
const UP = new THREE.Vector3(0, 1, 0);
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08, ...extra });

function makeBox(name, size, position, color, customMaterial = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), customMaterial || material(color));
    mesh.name = name;
    mesh.position.set(...position);
    return mesh;
}

export class Game {
    constructor(container, { role = "ESCAPEE", onExit, onRetry } = {}) {
        Object.assign(this, { container, role, onExit, onRetry });
        this.keys = new Set();
        this.escapees = [];
        this.pursuers = [];
        this.walls = [];
        this.obstacles = [];
        this.terminals = [];
        this.yaw = 0;
        this.pitch = 0;
        this.elapsed = 0;
        this.stamina = 100;
        this.repaired = 0;
        this.running = false;
        this.paused = false;
        this.ended = false;
        this.repairProgress = 0;
        this.touch = { sprint: false, sneak: false, interact: false };
        this.joystick = { x: 0, y: 0, pointer: null };
        this.dragPointer = null;
        this.animate = this.animate.bind(this);
        this.keyDown = this.keyDown.bind(this);
        this.keyUp = this.keyUp.bind(this);
        this.mouseMove = this.mouseMove.bind(this);
        this.resize = this.resize.bind(this);
    }

    start() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x071119);
        this.scene.fog = new THREE.Fog(0x071119, 22, 95);
        this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 240);
        this.camera.rotation.order = "YXZ";
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
        this.clock = new THREE.Clock();
        this.createLighting();
        this.createFacility();
        this.createObjectives();
        this.createCharacters();
        this.createHud();
        this.createTouchControls();
        this.bindEvents();
        this.running = true;
        this.clock.start();
        this.animate();
    }

    createLighting() {
        this.scene.add(new THREE.HemisphereLight(0x6c91a8, 0x0d1113, 1.25));
        const directional = new THREE.DirectionalLight(0xb7ddeb, 1.1);
        directional.position.set(20, 30, 10);
        this.scene.add(directional);
        const emergency = new THREE.PointLight(0xff2424, 2, 34, 2);
        emergency.position.set(0, 5, 0);
        this.scene.add(emergency);
    }

    createFacility() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material(0x222a2e));
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(100, 50, 0x4b5f69, 0x343f45);
        grid.position.y = 0.01;
        this.scene.add(grid);

        [[0,-49,98,1],[0,49,98,1],[-49,0,1,98],[49,0,1,98],[-25,-20,1,38],[-25,26,1,34],[25,-24,1,34],[25,25,1,38],[0,-12,28,1],[8,12,30,1],[-18,34,28,1],[-36,4,20,1],[36,2,20,1]].forEach(([x,z,w,d]) => this.addWall(x, z, w, d));
        [[-36,-34],[-31,-34],[-36,-29],[35,33],[30,33],[35,28],[6,-27],[11,-27],[6,-22],[-8,22],[-3,22],[16,26],[21,26]].forEach(([x,z]) => this.addCrate(x, z));
    }

    addWall(x, z, width, depth) {
        const wall = makeBox("Wall", [width, 5, depth], [x, 2.5, z], 0x38444a);
        this.scene.add(wall);
        this.walls.push(wall);
    }

    addCrate(x, z) {
        const crate = makeBox("Crate", [3.4, 2.6, 3.4], [x, 1.3, z], 0x655f49);
        this.scene.add(crate);
        this.obstacles.push(crate);
    }

    createObjectives() {
        [[-38,0],[36,-30],[10,38]].forEach(([x,z], index) => {
            const terminal = new THREE.Group();
            terminal.position.set(x, 0, z);
            terminal.name = `Terminal${index + 1}`;
            const screenMaterial = material(0x681f1f, { emissive: 0xff2020, emissiveIntensity: 1.2 });
            terminal.add(
                makeBox("TerminalBody", [2, 2.4, 1.2], [0, 1.2, 0], 0x263239),
                makeBox("TerminalScreen", [1.3, 0.75, 0.08], [0, 1.55, -0.64], 0, screenMaterial)
            );
            terminal.userData = { repaired: false, progress: 0, screenMaterial, assigned: null };
            this.scene.add(terminal);
            this.terminals.push(terminal);
        });

        this.exitGate = new THREE.Group();
        this.exitGate.position.set(0, 0, -47.5);
        const frame = material(0x596871, { metalness: 0.5 });
        this.exitGate.add(
            makeBox("Frame", [1,5,1], [-3.5,2.5,0], 0, frame),
            makeBox("Frame", [1,5,1], [3.5,2.5,0], 0, frame),
            makeBox("Frame", [8,1,1], [0,4.5,0], 0, frame)
        );
        const door = makeBox("Door", [6,4,0.5], [0,2,0], 0x5a1818, material(0x5a1818, { emissive: 0x9d1515, emissiveIntensity: 0.5 }));
        this.exitGate.add(door);
        this.exitGate.userData = { open: false, door };
        this.scene.add(this.exitGate);
    }

    createCharacter(type, x, z, color) {
        const character = type === "PURSUER" ? createPursuer() : createEscapee({ jacketColor: color });
        character.position.set(x, 0, z);
        Object.assign(character.userData, {
            type,
            state: "IDLE",
            captured: false,
            escaped: false,
            health: 2,
            speed: 0,
            stuckTime: 0,
            avoidanceSide: Math.random() < 0.5 ? -1 : 1,
            animator: new CharacterAnimator(character)
        });
        this.scene.add(character);
        return character;
    }

    createCharacters() {
        const escapeeSpawns = [[-8,36],[0,38],[8,36],[14,32]];
        const colors = [0x3e8fd1,0x3fae72,0xb07bd8,0xd59a43];
        const pursuerSpawn = [-40,-12];

        if (this.role === "ESCAPEE") {
            this.camera.position.set(0, PLAYER_HEIGHT, 34);
            this.yaw = Math.PI;
            escapeeSpawns.slice(0, 3).forEach((point, index) => this.escapees.push(this.createCharacter("ESCAPEE", point[0], point[1], colors[index])));
            this.pursuers.push(this.createCharacter("PURSUER", pursuerSpawn[0], pursuerSpawn[1], 0x15191c));
        } else {
            this.camera.position.set(pursuerSpawn[0], PLAYER_HEIGHT, pursuerSpawn[1]);
            this.yaw = Math.PI / 2;
            escapeeSpawns.forEach((point, index) => this.escapees.push(this.createCharacter("ESCAPEE", point[0], point[1], colors[index])));
        }
    }

    createHud() {
        this.hud = document.createElement("div");
        this.hud.className = "game-hud";
        this.hud.innerHTML = `<div class="hud-stack"><div class="hud-panel"><div class="hud-title">RUN FOR LIVE</div><div class="hud-row"><span>ROLE</span><strong>${this.role}</strong></div><div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div><div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div><div class="hud-row"><span>ESCAPEES</span><strong data-active>4 ACTIVE</strong></div><div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div></div></div><div class="crosshair"></div><div class="center-prompt" data-prompt></div>`;
        document.body.appendChild(this.hud);
        this.ui = {
            time: this.hud.querySelector("[data-time]"),
            terminals: this.hud.querySelector("[data-terminals]"),
            active: this.hud.querySelector("[data-active]"),
            stamina: this.hud.querySelector("[data-stamina]"),
            prompt: this.hud.querySelector("[data-prompt]")
        };
    }

    createTouchControls() {
        const root = document.createElement("div");
        root.id = "touch-controls";
        root.innerHTML = `<div class="touch-look" data-look></div><div class="touch-stick" data-zone><div data-knob></div></div><div class="touch-buttons"><button data-run>RUN</button><button data-use>USE</button><button data-sneak>SNEAK</button><button data-capture>${this.role === "PURSUER" ? "CAPTURE" : "PING"}</button></div>`;
        document.body.appendChild(root);
        this.touchRoot = root;
        const look = root.querySelector("[data-look]");
        look.addEventListener("pointerdown", event => { this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY; look.setPointerCapture?.(event.pointerId); });
        look.addEventListener("pointermove", event => { if (event.pointerId !== this.dragPointer) return; this.yaw -= (event.clientX - this.dragX) * 0.005; this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - this.dragY) * 0.005, -1.45, 1.45); this.dragX = event.clientX; this.dragY = event.clientY; });
        look.addEventListener("pointerup", () => { this.dragPointer = null; });
        const zone = root.querySelector("[data-zone]");
        const knob = root.querySelector("[data-knob]");
        const moveStick = event => { if (event.pointerId !== this.joystick.pointer) return; const bounds = zone.getBoundingClientRect(); let x = event.clientX - (bounds.left + bounds.width / 2); let y = event.clientY - (bounds.top + bounds.height / 2); const max = 44; const length = Math.hypot(x,y); if (length > max) { x = x / length * max; y = y / length * max; } this.joystick.x = x / max; this.joystick.y = y / max; knob.style.transform = `translate(${x}px,${y}px)`; };
        zone.addEventListener("pointerdown", event => { this.joystick.pointer = event.pointerId; zone.setPointerCapture?.(event.pointerId); moveStick(event); });
        zone.addEventListener("pointermove", moveStick);
        zone.addEventListener("pointerup", () => { this.joystick = { x:0,y:0,pointer:null }; knob.style.transform = "translate(0,0)"; });
        const hold = (selector, key) => { const button = root.querySelector(selector); button.onpointerdown = event => { event.preventDefault(); this.touch[key] = true; }; button.onpointerup = button.onpointercancel = () => { this.touch[key] = false; }; };
        hold("[data-run]", "sprint");
        hold("[data-use]", "interact");
        root.querySelector("[data-sneak]").onclick = () => { this.touch.sneak = !this.touch.sneak; };
        root.querySelector("[data-capture]").onclick = () => { if (this.role === "PURSUER") this.tryCapture(); };
    }

    bindEvents() {
        addEventListener("keydown", this.keyDown);
        addEventListener("keyup", this.keyUp);
        addEventListener("mousemove", this.mouseMove);
        addEventListener("resize", this.resize);
        this.renderer.domElement.onclick = () => this.renderer.domElement.requestPointerLock?.();
    }

    keyDown(event) {
        if (event.code === "Escape") { this.stop(); this.onExit?.(); return; }
        if (event.code === "Space" && this.role === "PURSUER") this.tryCapture();
        this.keys.add(event.code);
    }

    keyUp(event) {
        this.keys.delete(event.code);
        if (event.code === "KeyE") this.repairProgress = 0;
    }

    mouseMove(event) {
        if (document.pointerLockElement !== this.renderer.domElement) return;
        this.yaw -= event.movementX * 0.0023;
        this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0023, -1.45, 1.45);
    }

    collision(x, z, radius = PLAYER_RADIUS) {
        if (Math.abs(x) + radius > 47 || Math.abs(z) + radius > 47) return true;
        return [...this.walls, ...this.obstacles].some(object => {
            const bounds = new THREE.Box3().setFromObject(object);
            return x + radius > bounds.min.x && x - radius < bounds.max.x && z + radius > bounds.min.z && z - radius < bounds.max.z;
        });
    }

    updatePlayer(dt) {
        let forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.joystick.y;
        let side = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.joystick.x;
        const sneaking = this.keys.has("ShiftLeft") || this.touch.sneak;
        const sprinting = ((this.keys.has("KeyW") && this.keys.has("KeyR")) || this.touch.sprint) && forward > 0.1 && !sneaking && this.stamina > 0;
        const speed = sneaking ? 1.8 : sprinting ? 7.2 : 4.4;
        this.stamina = THREE.MathUtils.clamp(this.stamina + (sprinting ? -25 : 17) * dt, 0, 100);
        const length = Math.hypot(forward, side);
        if (length > 1) { forward /= length; side /= length; }
        const direction = new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw)).multiplyScalar(forward).add(new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)).multiplyScalar(side));
        const x = this.camera.position.x + direction.x * speed * dt;
        const z = this.camera.position.z + direction.z * speed * dt;
        if (!this.collision(x, this.camera.position.z)) this.camera.position.x = x;
        if (!this.collision(this.camera.position.x, z)) this.camera.position.z = z;
        this.camera.rotation.set(this.pitch, this.yaw, 0);
    }

    moveNpc(npc, target, speed, dt) {
        const desired = target.clone().sub(npc.position).setY(0);
        if (desired.lengthSq() < 0.01) return;
        desired.normalize();
        let chosen = null;
        for (const degrees of [0,30*npc.userData.avoidanceSide,-30*npc.userData.avoidanceSide,60,-60,110,-110,180]) {
            const candidate = desired.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad(degrees));
            if (!this.collision(npc.position.x + candidate.x, npc.position.z + candidate.z, npc.userData.type === "PURSUER" ? 0.78 : 0.52)) { chosen = candidate; break; }
        }
        if (!chosen) return;
        const x = npc.position.x + chosen.x * speed * dt;
        const z = npc.position.z + chosen.z * speed * dt;
        if (!this.collision(x, npc.position.z, 0.55)) npc.position.x = x;
        if (!this.collision(npc.position.x, z, 0.55)) npc.position.z = z;
        npc.rotation.y = Math.atan2(chosen.x, chosen.z) + Math.PI;
        npc.userData.animator.update(dt, { state: speed > 4 ? "RUN" : "WALK", injured: npc.userData.health === 1 });
    }

    updateNpc(dt) {
        if (this.role === "ESCAPEE") {
            const hunter = this.pursuers[0];
            const targets = [this.camera, ...this.escapees.filter(npc => !npc.userData.captured)];
            const target = targets.sort((a,b) => distanceXZ(hunter.position,a.position) - distanceXZ(hunter.position,b.position))[0];
            this.moveNpc(hunter, target.position, 4.6, dt);
            if (distanceXZ(hunter.position, target.position) < 1.2) {
                if (target === this.camera) this.end("CAUGHT");
                else target.userData.captured = true;
            }
        } else {
            for (const escapee of this.escapees) {
                if (escapee.userData.captured) continue;
                const away = escapee.position.clone().sub(this.camera.position).setY(0);
                const target = escapee.position.clone().add(away.lengthSq() ? away.normalize().multiplyScalar(10) : new THREE.Vector3(10,0,0));
                this.moveNpc(escapee, target, 4.7, dt);
            }
        }
    }

    updateObjectives(dt) {
        if (this.role !== "ESCAPEE") return;
        const interacting = this.keys.has("KeyE") || this.touch.interact;
        const terminal = this.terminals.filter(item => !item.userData.repaired).sort((a,b) => distanceXZ(this.camera.position,a.position) - distanceXZ(this.camera.position,b.position))[0];
        this.ui.prompt.classList.remove("visible");
        if (terminal && distanceXZ(this.camera.position, terminal.position) < 3.4) {
            this.ui.prompt.textContent = interacting ? `RESTORING ${Math.min(100, Math.round(this.repairProgress / REPAIR_TIME * 100))}%` : "HOLD E / USE TO RESTORE";
            this.ui.prompt.classList.add("visible");
            if (interacting) {
                this.repairProgress += dt;
                if (this.repairProgress >= REPAIR_TIME) {
                    terminal.userData.repaired = true;
                    terminal.userData.screenMaterial.color.set(0x1f7848);
                    terminal.userData.screenMaterial.emissive.set(0x29ff82);
                    this.repaired += 1;
                    this.repairProgress = 0;
                    if (this.repaired >= REQUIRED_TERMINALS) { this.exitGate.userData.open = true; this.exitGate.userData.door.visible = false; }
                }
            } else this.repairProgress = 0;
        } else if (distanceXZ(this.camera.position, this.exitGate.position) < 4) {
            this.ui.prompt.textContent = this.exitGate.userData.open ? "PRESS E / USE TO ESCAPE" : `${REQUIRED_TERMINALS - this.repaired} TERMINALS REMAINING`;
            this.ui.prompt.classList.add("visible");
            if (interacting && this.exitGate.userData.open) this.end("ESCAPED");
        }
    }

    tryCapture() {
        const target = this.escapees.filter(npc => !npc.userData.captured).sort((a,b) => distanceXZ(this.camera.position,a.position) - distanceXZ(this.camera.position,b.position))[0];
        if (target && distanceXZ(this.camera.position, target.position) < 2.2) {
            target.userData.health -= 1;
            if (target.userData.health <= 0) target.userData.captured = true;
        }
    }

    updateHud() {
        const remaining = Math.max(0, MATCH_TIME - this.elapsed);
        this.ui.time.textContent = `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(Math.floor(remaining % 60)).padStart(2,"0")}`;
        this.ui.terminals.textContent = `${this.repaired} / ${REQUIRED_TERMINALS}`;
        this.ui.active.textContent = `${this.escapees.filter(npc => !npc.userData.captured).length + (this.role === "ESCAPEE" ? 1 : 0)} ACTIVE`;
        this.ui.stamina.textContent = `${Math.round(this.stamina)}%`;
    }

    end(title) {
        if (this.ended) return;
        this.ended = true;
        this.running = false;
        document.exitPointerLock?.();
        const overlay = document.createElement("section");
        overlay.className = "overlay";
        overlay.innerHTML = `<article class="overlay-card"><h2>${title}</h2><div class="menu-actions"><button class="menu-button menu-button--primary" data-retry>RETRY</button><button class="menu-button" data-menu>MENU</button></div></article>`;
        document.body.appendChild(overlay);
        overlay.querySelector("[data-retry]").onclick = () => { this.stop(); this.onRetry?.(); };
        overlay.querySelector("[data-menu]").onclick = () => { this.stop(); this.onExit?.(); };
        this.overlay = overlay;
    }

    animate() {
        if (!this.running) return;
        this.frame = requestAnimationFrame(this.animate);
        const dt = Math.min(this.clock.getDelta(), 0.05);
        this.elapsed += dt;
        this.updatePlayer(dt);
        this.updateNpc(dt);
        this.updateObjectives(dt);
        this.updateHud();
        if (this.elapsed >= MATCH_TIME) this.end("TIME EXPIRED");
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
        removeEventListener("keydown", this.keyDown);
        removeEventListener("keyup", this.keyUp);
        removeEventListener("mousemove", this.mouseMove);
        removeEventListener("resize", this.resize);
        this.hud?.remove();
        this.touchRoot?.remove();
        this.overlay?.remove();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
