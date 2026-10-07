import * as THREE from "three";
import { createEscapee, createPursuer, CharacterAnimator } from "./characters.js";

const MATCH_TIME = 600;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.42;
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 7.2;
const SNEAK_SPEED = 1.8;
const REQUIRED_TERMINALS = 3;
const REPAIR_TIME = 5;
const INTERACT_DISTANCE = 3.4;
const UP = new THREE.Vector3(0, 1, 0);
const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const makeMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08, ...options });

function makeBox(name, size, position, color, customMaterial = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), customMaterial || makeMaterial(color));
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
        this.bindEvents();
        this.running = true;
        this.clock.start();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x071119);
        this.scene.fog = new THREE.Fog(0x071119, 20, 95);
        this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 260);
        this.camera.position.set(0, PLAYER_HEIGHT, 35);
        this.camera.rotation.order = "YXZ";
        this.scene.add(new THREE.HemisphereLight(0x6389a0, 0x0d1113, 1.25));
        const sun = new THREE.DirectionalLight(0xb8dded, 1.2);
        sun.position.set(20, 30, 10);
        this.scene.add(sun);
        const emergency = new THREE.PointLight(0xff2424, 2.1, 35, 2);
        emergency.position.set(0, 5, 0);
        this.scene.add(emergency);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);
    }

    createFacility() {
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), makeMaterial(0x222a2e));
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(100, 50, 0x4f626c, 0x36434a);
        grid.position.y = 0.01;
        this.scene.add(grid);

        [[0,-49,98,1],[0,49,98,1],[-49,0,1,98],[49,0,1,98],[-25,-20,1,38],[-25,26,1,34],[25,-24,1,34],[25,25,1,38],[0,-12,28,1],[8,12,30,1],[-18,34,28,1],[-36,4,20,1],[36,2,20,1]].forEach(([x,z,w,d]) => this.addWall(x,z,w,d));
        [[-36,-34],[-31,-34],[-36,-29],[35,33],[30,33],[35,28],[6,-27],[11,-27],[6,-22],[-8,22],[-3,22],[16,26],[21,26]].forEach(([x,z]) => this.addCrate(x,z));
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
            const screenMaterial = makeMaterial(0x681f1f, { emissive: 0xff2020, emissiveIntensity: 1.2 });
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
        const frame = makeMaterial(0x596871, { metalness: 0.5 });
        this.exitGate.add(
            makeBox("Frame", [1,5,1], [-3.5,2.5,0], 0, frame),
            makeBox("Frame", [1,5,1], [3.5,2.5,0], 0, frame),
            makeBox("Frame", [8,1,1], [0,4.5,0], 0, frame)
        );
        const door = makeBox("Door", [6,4,0.5], [0,2,0], 0x5a1818, makeMaterial(0x5a1818, { emissive: 0x9d1515, emissiveIntensity: 0.5 }));
        this.exitGate.add(door);
        this.exitGate.userData = { open: false, door };
        this.scene.add(this.exitGate);
    }

    createCharacter(type, x, z, color) {
        const character = type === "PURSUER"
            ? createPursuer()
            : createEscapee({ jacketColor: color, accentColor: new THREE.Color(color).offsetHSL(0, 0.08, 0.18).getHex() });
        character.position.set(x, 0, z);
        Object.assign(character.userData, {
            type,
            state: "IDLE",
            target: null,
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
        const escapeeSpawns = [
            new THREE.Vector3(-8, 0, 36),
            new THREE.Vector3(0, 0, 38),
            new THREE.Vector3(8, 0, 36),
            new THREE.Vector3(14, 0, 32)
        ];
        const pursuerSpawn = new THREE.Vector3(-40, 0, -12);
        const colors = [0x3e8fd1, 0x3fae72, 0xb07bd8, 0xd59a43];

        if (!this.isSafeSpawn(pursuerSpawn.x, pursuerSpawn.z, 1)) {
            throw new Error("The pursuer spawn point is blocked.");
        }

        if (this.role === "ESCAPEE") {
            this.camera.position.set(0, PLAYER_HEIGHT, 35);
            this.yaw = Math.PI;
            escapeeSpawns.slice(0, 3).forEach((position, index) => {
                this.escapees.push(this.createCharacter("ESCAPEE", position.x, position.z, colors[index]));
            });
            const pursuer = this.createCharacter("PURSUER", pursuerSpawn.x, pursuerSpawn.z, 0x15191c);
            pursuer.rotation.y = Math.atan2(-pursuerSpawn.x, -pursuerSpawn.z) + Math.PI;
            this.pursuers.push(pursuer);
        } else {
            this.camera.position.set(pursuerSpawn.x, PLAYER_HEIGHT, pursuerSpawn.z);
            this.yaw = Math.atan2(pursuerSpawn.x, pursuerSpawn.z);
            escapeeSpawns.forEach((position, index) => {
                const escapee = this.createCharacter("ESCAPEE", position.x, position.z, colors[index]);
                escapee.rotation.y = Math.PI;
                this.escapees.push(escapee);
            });
        }
    }

    isSafeSpawn(x, z, radius = 0.9) {
        if (Math.abs(x) > 46 || Math.abs(z) > 46) return false;
        for (const object of [...this.walls, ...this.obstacles]) {
            const bounds = new THREE.Box3().setFromObject(object);
            if (x + radius > bounds.min.x && x - radius < bounds.max.x && z + radius > bounds.min.z && z - radius < bounds.max.z) return false;
        }
        return true;
    }

    createHUD() {
        this.hud = document.createElement("div");
        this.hud.className = "game-hud";
        this.hud.innerHTML = `<div class="hud-stack"><div class="hud-panel"><div class="hud-title">RUN FOR LIVE</div><div class="hud-row"><span>ROLE</span><strong>${this.role}</strong></div><div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div><div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div><div class="hud-row"><span>ESCAPEES</span><strong data-escapees>4 ACTIVE</strong></div><div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div><div class="bar"><div data-stamina-bar></div></div></div></div><div class="crosshair"></div><div class="threat" data-threat>PURSUER DETECTED</div><div class="center-prompt" data-prompt></div>`;
        document.body.appendChild(this.hud);
        this.hudValues = {
            time: this.hud.querySelector("[data-time]"),
            terminals: this.hud.querySelector("[data-terminals]"),
            escapees: this.hud.querySelector("[data-escapees]"),
            stamina: this.hud.querySelector("[data-stamina]"),
            staminaBar: this.hud.querySelector("[data-stamina-bar]"),
            threat: this.hud.querySelector("[data-threat]"),
            prompt: this.hud.querySelector("[data-prompt]")
        };
    }

    createTouchControls() {
        const root = document.createElement("div");
        root.id = "touch-controls";
        root.innerHTML = `<div class="look-zone" data-look></div><div class="joystick" data-joystick><div class="joystick-stick" data-stick></div></div><div class="touch-actions"><button class="touch-btn" data-run>RUN</button><button class="touch-btn" data-use>USE</button><button class="touch-btn" data-sneak>SNEAK</button><button class="touch-btn" data-action>${this.role === "PURSUER" ? "CAPTURE" : "PING"}</button></div><button class="menu-touch" data-menu>â°</button>`;
        document.body.appendChild(root);
        this.touchRoot = root;
        const look = root.querySelector("[data-look]");
        look.addEventListener("pointerdown", event => this.beginLook(event));
        look.addEventListener("pointermove", event => this.moveLook(event));
        look.addEventListener("pointerup", event => this.endLook(event));
        look.addEventListener("pointercancel", event => this.endLook(event));
        const joystick = root.querySelector("[data-joystick]");
        this.joystickStick = root.querySelector("[data-stick]");
        joystick.addEventListener("pointerdown", event => this.beginJoystick(event, joystick));
        joystick.addEventListener("pointermove", event => this.moveJoystick(event, joystick));
        joystick.addEventListener("pointerup", event => this.endJoystick(event));
        joystick.addEventListener("pointercancel", event => this.endJoystick(event));
        this.bindTouchHold(root.querySelector("[data-run]"), value => { this.touch.sprint = value; });
        this.bindTouchHold(root.querySelector("[data-use]"), value => { this.touch.interact = value; });
        root.querySelector("[data-sneak]").addEventListener("pointerdown", event => {
            event.preventDefault();
            this.touch.sneak = !this.touch.sneak;
            event.currentTarget.classList.toggle("active", this.touch.sneak);
        });
        root.querySelector("[data-action]").addEventListener("pointerdown", event => {
            event.preventDefault();
            if (this.role === "PURSUER") this.tryCapture();
        });
        root.querySelector("[data-menu]").addEventListener("click", () => this.setPaused(true));
    }

    bindTouchHold(element, callback) {
        element.addEventListener("pointerdown", event => { event.preventDefault(); element.classList.add("active"); callback(true); });
        ["pointerup", "pointercancel", "pointerleave"].forEach(name => element.addEventListener(name, event => { event.preventDefault(); element.classList.remove("active"); callback(false); }));
    }

    beginLook(event) { event.preventDefault(); this.dragPointer = event.pointerId; this.dragX = event.clientX; this.dragY = event.clientY; event.currentTarget.setPointerCapture?.(event.pointerId); }
    moveLook(event) { if (event.pointerId !== this.dragPointer) return; event.preventDefault(); this.applyLook(event.clientX - this.dragX, event.clientY - this.dragY, 0.005); this.dragX = event.clientX; this.dragY = event.clientY; }
    endLook(event) { if (event.pointerId === this.dragPointer) this.dragPointer = null; }
    beginJoystick(event, zone) { event.preventDefault(); this.joystick.pointer = event.pointerId; zone.setPointerCapture?.(event.pointerId); this.moveJoystick(event, zone); }
    moveJoystick(event, zone) {
        if (event.pointerId !== this.joystick.pointer) return;
        const bounds = zone.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        let x = event.clientX - centerX;
        let y = event.clientY - centerY;
        const maximum = 45;
        const distance = Math.hypot(x, y);
        if (distance > maximum) { x = x / distance * maximum; y = y / distance * maximum; }
        this.joystick.x = x / maximum;
        this.joystick.y = y / maximum;
        this.joystickStick.style.transform = `translate(${x}px, ${y}px)`;
    }
    endJoystick(event) { if (event.pointerId !== this.joystick.pointer) return; this.joystick = { x: 0, y: 0, pointer: null }; this.joystickStick.style.transform = "translate(0, 0)"; }

    bindEvents() {
        addEventListener("resize", this.resize);
        addEventListener("keydown", this.keyDown);
        addEventListener("keyup", this.keyUp);
        addEventListener("mousemove", this.mouseMove);
        document.addEventListener("pointerlockchange", this.pointerLockChange);
        this.renderer.domElement.addEventListener("click", () => { if (!this.isTouch && !this.paused && !this.ended) this.renderer.domElement.requestPointerLock?.(); });
        this.renderer.domElement.addEventListener("pointerdown", event => { if (event.pointerType === "mouse" && document.pointerLockElement !== this.renderer.domElement) this.beginLook(event); });
        this.renderer.domElement.addEventListener("pointermove", event => { if (event.pointerType === "mouse" && document.pointerLockElement !== this.renderer.domElement) this.moveLook(event); });
        this.renderer.domElement.addEventListener("pointerup", event => this.endLook(event));
    }

    keyDown(event) {
        if (["KeyW","KeyA","KeyS","KeyD","KeyR","KeyE","ShiftLeft","ShiftRight","Space"].includes(event.code)) event.preventDefault();
        if (event.code === "Escape" && !event.repeat) { this.setPaused(!this.paused); return; }
        if (event.code === "Space" && !event.repeat && this.role === "PURSUER") this.tryCapture();
        this.keys.add(event.code);
    }
    keyUp(event) { this.keys.delete(event.code); if (event.code === "KeyE") this.repairProgress = 0; }
    mouseMove(event) { if (document.pointerLockElement !== this.renderer.domElement || this.paused || this.ended) return; this.applyLook(event.movementX, event.movementY, 0.0023); }
    applyLook(dx, dy, sensitivity) { this.yaw -= dx * sensitivity; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sensitivity, -1.48, 1.48); }
    pointerLockChange() { if (!this.isTouch && document.pointerLockElement !== this.renderer.domElement && !this.paused && !this.ended && this.running) this.setPaused(true); }

    updatePlayer(deltaTime) {
        if (this.paused || this.ended) return;
        let forwardInput = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) - this.joystick.y;
        let sideInput = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0) + this.joystick.x;
        const sneaking = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.touch.sneak;
        const sprinting = ((this.keys.has("KeyW") && this.keys.has("KeyR")) || this.touch.sprint) && forwardInput > 0.1 && !sneaking && this.stamina > 0;
        const speed = sneaking ? SNEAK_SPEED : sprinting ? SPRINT_SPEED : WALK_SPEED;
        this.stamina = THREE.MathUtils.clamp(this.stamina + (sprinting ? -25 : 17) * deltaTime, 0, 100);
        const length = Math.hypot(forwardInput, sideInput);
        if (length > 1) { forwardInput /= length; sideInput /= length; }
        this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        this.move.set(0,0,0).addScaledVector(this.forward, forwardInput).addScaledVector(this.right, sideInput).multiplyScalar(speed * deltaTime);
        const nextX = this.camera.position.x + this.move.x;
        const nextZ = this.camera.position.z + this.move.z;
        if (!this.collides(nextX, this.camera.position.z, PLAYER_RADIUS)) this.camera.position.x = nextX;
        if (!this.collides(this.camera.position.x, nextZ, PLAYER_RADIUS)) this.camera.position.z = nextZ;
        this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    }

    collides(x, z, radius = PLAYER_RADIUS) {
        for (const object of [...this.walls, ...this.obstacles]) {
            const bounds = new THREE.Box3().setFromObject(object);
            if (x + radius > bounds.min.x && x - radius < bounds.max.x && z + radius > bounds.min.z && z - radius < bounds.max.z) return true;
        }
        return Math.abs(x) + radius > 47.5 || Math.abs(z) + radius > 47.5;
    }

    updateEscapeeNPCs(deltaTime) {
        for (const npc of this.escapees) {
            if (npc.userData.captured || npc.userData.escaped) continue;
            const pursuer = this.getNearestPursuer(npc.position);
            const danger = pursuer && distanceXZ(npc.position, pursuer.position) < 13;
            if (danger) {
                npc.userData.state = "FLEE";
                const direction = npc.position.clone().sub(pursuer.position).setY(0).normalize();
                this.moveNPC(npc, direction, 4.9, deltaTime);
                continue;
            }
            if (this.repaired >= REQUIRED_TERMINALS) {
                npc.userData.state = "ESCAPE";
                this.moveNPCToward(npc, this.exitGate.position, 3.8, deltaTime);
                if (distanceXZ(npc.position, this.exitGate.position) < 2) { npc.userData.escaped = true; npc.visible = false; }
                continue;
            }
            let terminal = this.terminals.find(item => !item.userData.repaired && (!item.userData.assigned || item.userData.assigned === npc));
            if (!terminal) terminal = this.terminals.find(item => !item.userData.repaired);
            if (!terminal) { npc.userData.state = "IDLE"; continue; }
            terminal.userData.assigned = npc;
            npc.userData.target = terminal;
            if (distanceXZ(npc.position, terminal.position) > 2) {
                npc.userData.state = "SEARCH";
                this.moveNPCToward(npc, terminal.position, 2.8, deltaTime);
            } else {
                npc.userData.state = "REPAIR";
                npc.userData.speed = 0;
                terminal.userData.progress += deltaTime / REPAIR_TIME * 0.72;
                if (terminal.userData.progress >= 1) this.completeTerminal(terminal);
            }
        }
    }

    updatePursuerNPCs(deltaTime) {
        for (const npc of this.pursuers) {
            const target = this.getNearestActiveEscapee(npc.position, true);
            if (!target) { npc.userData.state = "PATROL"; npc.userData.speed = 0; continue; }
            const distance = distanceXZ(npc.position, target.position);
            npc.userData.state = distance < 24 ? "CHASE" : "PATROL";
            if (npc.userData.state === "CHASE") this.moveNPCToward(npc, target.position, 4.7, deltaTime);
            else this.moveNPCToward(npc, (this.terminals.find(item => !item.userData.repaired) || this.exitGate).position, 2.2, deltaTime);
            if (distance < 1.25) {
                if (target === this.camera) this.endMatch("CAUGHT");
                else { target.userData.captured = true; target.userData.state = "DOWNED"; }
            }
        }
    }

    getNearestPursuer(position) {
        return [...this.pursuers].sort((a,b) => distanceXZ(position,a.position) - distanceXZ(position,b.position))[0] || null;
    }

    getNearestActiveEscapee(position, includePlayer) {
        const list = this.escapees.filter(npc => !npc.userData.captured && !npc.userData.escaped);
        if (includePlayer && this.role === "ESCAPEE") list.push(this.camera);
        return list.sort((a,b) => distanceXZ(position,a.position) - distanceXZ(position,b.position))[0] || null;
    }

    moveNPCToward(npc, target, speed, deltaTime) {
        const desired = target.clone().sub(npc.position).setY(0);
        if (desired.lengthSq() < 0.001) { npc.userData.speed = 0; return; }
        this.moveNPC(npc, desired.normalize(), speed, deltaTime);
    }

    moveNPC(npc, desiredDirection, speed, deltaTime) {
        const radius = npc.userData.type === "PURSUER" ? 0.78 : 0.52;
        const preferred = npc.userData.avoidanceSide || 1;
        const angles = [0, 25 * preferred, -25 * preferred, 50 * preferred, -50 * preferred, 75 * preferred, -75 * preferred, 110 * preferred, -110 * preferred, 180];
        let selected = null;

        for (const degrees of angles) {
            const candidate = desiredDirection.clone().applyAxisAngle(UP, THREE.MathUtils.degToRad(degrees));
            const probe = Math.max(radius + 0.55, speed * deltaTime * 3);
            if (!this.collides(npc.position.x + candidate.x * probe, npc.position.z + candidate.z * probe, radius)) {
                selected = candidate;
                if (degrees !== 0 && degrees !== 180) npc.userData.avoidanceSide = Math.sign(degrees) || preferred;
                break;
            }
        }

        if (!selected) {
            npc.userData.stuckTime += deltaTime;
            npc.userData.speed = 0;
            if (npc.userData.stuckTime > 0.55) {
                npc.userData.avoidanceSide *= -1;
                const escape = desiredDirection.clone().multiplyScalar(-1).applyAxisAngle(UP, THREE.MathUtils.degToRad(55 * npc.userData.avoidanceSide));
                if (!this.collides(npc.position.x + escape.x, npc.position.z + escape.z, radius)) {
                    npc.position.addScaledVector(escape, 0.9);
                    npc.userData.stuckTime = 0;
                }
            }
            return;
        }

        const distance = speed * deltaTime;
        const nextX = npc.position.x + selected.x * distance;
        const nextZ = npc.position.z + selected.z * distance;
        let moved = false;
        if (!this.collides(nextX, npc.position.z, radius)) { npc.position.x = nextX; moved = true; }
        if (!this.collides(npc.position.x, nextZ, radius)) { npc.position.z = nextZ; moved = true; }

        const targetRotation = Math.atan2(selected.x, selected.z) + Math.PI;
        npc.rotation.y = this.lerpAngle(npc.rotation.y, targetRotation, Math.min(1, deltaTime * 10));
        npc.userData.speed = moved ? speed : 0;
        npc.userData.stuckTime = moved ? 0 : npc.userData.stuckTime + deltaTime;
    }

    lerpAngle(current, target, amount) {
        const difference = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
        return current + difference * amount;
    }

    updateCharacterAnimations(deltaTime) {
        for (const character of [...this.escapees, ...this.pursuers]) {
            if (!character.visible) continue;
            let state = character.userData.state || "IDLE";
            if (state === "SEARCH" || state === "PATROL") state = "WALK";
            if (state === "ESCAPE") state = "RUN";
            character.userData.animator?.update(deltaTime, {
                state,
                speed: character.userData.speed || 0,
                injured: character.userData.health === 1
            });
        }
    }

    updateInteraction(deltaTime) {
        if (this.paused || this.ended) return;
        const interacting = this.keys.has("KeyE") || this.touch.interact;
        this.currentInteraction = null;

        if (this.role === "ESCAPEE") {
            const terminal = this.terminals.filter(item => !item.userData.repaired).sort((a,b) => distanceXZ(this.camera.position,a.position) - distanceXZ(this.camera.position,b.position))[0];
            if (terminal && distanceXZ(this.camera.position, terminal.position) < INTERACT_DISTANCE) {
                this.currentInteraction = { type: "TERMINAL", object: terminal };
                this.prompt("HOLD E / USE TO RESTORE");
            } else if (distanceXZ(this.camera.position, this.exitGate.position) < 4) {
                this.currentInteraction = { type: "EXIT" };
                this.prompt(this.exitGate.userData.open ? "PRESS E / USE TO ESCAPE" : `${REQUIRED_TERMINALS - this.repaired} TERMINALS REMAINING`);
            } else this.prompt(null);

            if (interacting && this.currentInteraction?.type === "TERMINAL") {
                this.repairProgress += deltaTime;
                const terminalObject = this.currentInteraction.object;
                terminalObject.userData.progress = Math.max(terminalObject.userData.progress, this.repairProgress / REPAIR_TIME);
                this.prompt(`RESTORING ${Math.round(terminalObject.userData.progress * 100)}%`);
                if (terminalObject.userData.progress >= 1) { this.completeTerminal(terminalObject); this.repairProgress = 0; }
            } else if (interacting && this.currentInteraction?.type === "EXIT" && this.exitGate.userData.open) this.endMatch("ESCAPED");
            else if (!interacting) this.repairProgress = 0;
        } else this.prompt("SPACE / CAPTURE NEAR AN ESCAPEE");
    }

    completeTerminal(terminal) {
        if (terminal.userData.repaired) return;
        terminal.userData.repaired = true;
        terminal.userData.progress = 1;
        terminal.userData.screenMaterial.color.set(0x1f7848);
        terminal.userData.screenMaterial.emissive.set(0x29ff82);
        this.repaired += 1;
        if (this.repaired >= REQUIRED_TERMINALS) { this.exitGate.userData.open = true; this.exitGate.userData.door.visible = false; }
    }

    tryCapture() {
        if (this.role !== "PURSUER" || this.paused || this.ended) return;
        const target = this.getNearestActiveEscapee(this.camera.position, false);
        if (!target || distanceXZ(this.camera.position, target.position) >= 2.2) return;
        target.userData.health -= 1;
        if (target.userData.health <= 0) { target.userData.captured = true; target.userData.state = "DOWNED"; }
        else target.position.addScaledVector(target.position.clone().sub(this.camera.position).setY(0).normalize(), 4);
    }

    prompt(text) { this.hudValues.prompt.textContent = text || ""; this.hudValues.prompt.classList.toggle("visible", Boolean(text)); }

    updateMatch(deltaTime) {
        if (this.paused || this.ended) return;
        this.elapsed += deltaTime;
        if (this.elapsed >= MATCH_TIME) this.endMatch(this.role === "PURSUER" ? "PURSUER WIN" : "TIME EXPIRED");
        const active = this.escapees.filter(npc => !npc.userData.captured && !npc.userData.escaped).length;
        if (this.role === "PURSUER" && active === 0) this.endMatch("PURSUER WIN");
    }

    updateHUD() {
        const remaining = Math.max(0, MATCH_TIME - this.elapsed);
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);
        this.hudValues.time.textContent = `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
        this.hudValues.terminals.textContent = `${this.repaired} / ${REQUIRED_TERMINALS}`;
        const active = this.escapees.filter(npc => !npc.userData.captured && !npc.userData.escaped).length + (this.role === "ESCAPEE" ? 1 : 0);
        this.hudValues.escapees.textContent = `${active} ACTIVE`;
        const stamina = Math.round(this.stamina);
        this.hudValues.stamina.textContent = `${stamina}%`;
        this.hudValues.staminaBar.style.width = `${stamina}%`;
        const pursuer = this.getNearestPursuer(this.camera.position);
        this.hudValues.threat.classList.toggle("visible", this.role === "ESCAPEE" && pursuer && distanceXZ(this.camera.position, pursuer.position) < 15);
    }

    setPaused(value) {
        if (this.ended) return;
        this.paused = value;
        if (!value) return;
        document.exitPointerLock?.();
        this.showOverlay("PAUSED", "The match is waiting.", [
            { label: "RESUME", primary: true, action: () => { this.hideOverlay(); this.paused = false; if (!this.isTouch) this.renderer.domElement.requestPointerLock?.(); } },
            { label: "BACK TO MENU", action: () => { this.stop(); this.onExit?.(); } }
        ]);
    }

    showOverlay(title, message, actions) {
        this.hideOverlay();
        this.overlay = document.createElement("section");
        this.overlay.className = "overlay";
        this.overlay.innerHTML = `<article class="overlay-card"><p class="eyebrow">RUN FOR LIVE</p><h2>${title}</h2><p>${message}</p><div class="menu-actions" data-actions></div></article>`;
        for (const item of actions) {
            const button = document.createElement("button");
            button.className = `menu-button ${item.primary ? "menu-button--primary" : ""}`;
            button.textContent = item.label;
            button.addEventListener("click", item.action);
            this.overlay.querySelector("[data-actions]").appendChild(button);
        }
        document.body.appendChild(this.overlay);
    }

    hideOverlay() { this.overlay?.remove(); this.overlay = null; }
    endMatch(result) {
        if (this.ended) return;
        this.ended = true;
        document.exitPointerLock?.();
        this.showOverlay(result, "The match has ended.", [
            { label: "RETRY", primary: true, action: () => { this.stop(); this.onRetry?.(); } },
            { label: "BACK TO MENU", action: () => { this.stop(); this.onExit?.(); } }
        ]);
    }

    update(deltaTime) {
        this.updatePlayer(deltaTime);
        this.updateEscapeeNPCs(deltaTime);
        this.updatePursuerNPCs(deltaTime);
        this.updateCharacterAnimations(deltaTime);
        this.updateInteraction(deltaTime);
        this.updateMatch(deltaTime);
        this.updateHUD();
    }

    animate() {
        if (!this.running) return;
        this.frame = requestAnimationFrame(this.animate);
        const deltaTime = Math.min(this.clock.getDelta(), 0.05);
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        if (!this.camera || !this.renderer) return;
        const width = Math.max(this.container.clientWidth, 1);
        const height = Math.max(this.container.clientHeight, 1);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        cancelAnimationFrame(this.frame);
        removeEventListener("resize", this.resize);
        removeEventListener("keydown", this.keyDown);
        removeEventListener("keyup", this.keyUp);
        removeEventListener("mousemove", this.mouseMove);
        document.removeEventListener("pointerlockchange", this.pointerLockChange);
        document.exitPointerLock?.();
        this.clock.stop();
        this.hud?.remove();
        this.touchRoot?.remove();
        this.overlay?.remove();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
