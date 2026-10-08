import * as THREE from "three";
import { createEscapee, createPursuer, CharacterAnimator } from "./characters.js";

const MATCH_TIME = 600;
const PLAYER_HEIGHT = 1.72;
const PLAYER_RADIUS = 0.42;
const REQUIRED_TERMINALS = 3;
const REPAIR_TIME = 5;
const CAMERA_MODES = ["FIRST", "SECOND", "THIRD"];
const UP = new THREE.Vector3(0, 1, 0);

const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const gameMaterial = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.08,
    ...extra
});

function makeBox(name, size, position, color, customMaterial = null) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        customMaterial || gameMaterial(color)
    );
    mesh.name = name;
    mesh.position.set(...position);
    return mesh;
}

function getStoredProfile() {
    const keys = ["rfl_session_v3", "rfl_session_v2", "rfl_session_v1"];
    for (const key of keys) {
        try {
            const value = JSON.parse(sessionStorage.getItem(key) || "null");
            if (value?.displayName) return value;
        } catch {
            // Try the next known session key.
        }
    }
    return {
        displayName: "Player",
        role: "GUEST",
        title: null
    };
}

function getChatIdentity(profile) {
    if (profile.role === "ADMIN") return { label: "Admin", className: "admin" };
    if (profile.role === "MODERATOR") return { label: "Mod", className: "moderator" };
    if (profile.title === "LEGEND") return { label: "Legend", className: "legend" };
    if (profile.role === "GUEST") return { label: "Guest", className: "guest" };
    return { label: "Player", className: "player" };
}

export class Game {
    constructor(container, { role = "ESCAPEE", onExit, onRetry, profile } = {}) {
        this.container = container;
        this.role = role;
        this.onExit = onExit;
        this.onRetry = onRetry;
        this.profile = profile || getStoredProfile();

        this.keys = new Set();
        this.escapees = [];
        this.pursuers = [];
        this.walls = [];
        this.obstacles = [];
        this.terminals = [];

        this.playerPosition = new THREE.Vector3();
        this.playerModel = null;
        this.playerAnimator = null;

        this.cameraModeIndex = 0;
        this.cameraMode = CAMERA_MODES[0];
        this.cameraCollisionRay = new THREE.Raycaster();

        this.yaw = 0;
        this.pitch = 0;
        this.elapsed = 0;
        this.stamina = 100;
        this.repaired = 0;
        this.repairProgress = 0;
        this.running = false;
        this.ended = false;

        this.chatOpen = false;
        this.chatMessages = [];
        this.chatMaximum = 9;
        this.lastChatAt = 0;

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
        this.createGameChat();
        this.createTouchControls();
        this.bindEvents();
        this.updateCamera();

        this.addSystemMessage(
            this.role === "PURSUER"
                ? "Capture all four escapees."
                : "Restore three terminals and reach the exit."
        );

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
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), gameMaterial(0x222a2e));
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(100, 50, 0x4b5f69, 0x343f45);
        grid.position.y = 0.01;
        this.scene.add(grid);

        [[0,-49,98,1],[0,49,98,1],[-49,0,1,98],[49,0,1,98],[-25,-20,1,38],[-25,26,1,34],[25,-24,1,34],[25,25,1,38],[0,-12,28,1],[8,12,30,1],[-18,34,28,1],[-36,4,20,1],[36,2,20,1]].forEach(
            ([x, z, width, depth]) => this.addWall(x, z, width, depth)
        );

        [[-36,-34],[-31,-34],[-36,-29],[35,33],[30,33],[35,28],[6,-27],[11,-27],[6,-22],[-8,22],[-3,22],[16,26],[21,26]].forEach(
            ([x, z]) => this.addCrate(x, z)
        );
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
        [[-38,0],[36,-30],[10,38]].forEach(([x, z], index) => {
            const terminal = new THREE.Group();
            terminal.position.set(x, 0, z);
            terminal.name = `Terminal${index + 1}`;
            const screenMaterial = gameMaterial(0x681f1f, {
                emissive: 0xff2020,
                emissiveIntensity: 1.2
            });
            terminal.add(
                makeBox("TerminalBody", [2, 2.4, 1.2], [0, 1.2, 0], 0x263239),
                makeBox("TerminalScreen", [1.3, 0.75, 0.08], [0, 1.55, -0.64], 0, screenMaterial)
            );
            terminal.userData = {
                repaired: false,
                progress: 0,
                screenMaterial,
                assignedNpcId: null
            };
            this.scene.add(terminal);
            this.terminals.push(terminal);
        });

        this.exitGate = new THREE.Group();
        this.exitGate.position.set(0, 0, -47.5);
        const frame = gameMaterial(0x596871, { metalness: 0.5 });
        this.exitGate.add(
            makeBox("Frame", [1,5,1], [-3.5,2.5,0], 0, frame),
            makeBox("Frame", [1,5,1], [3.5,2.5,0], 0, frame),
            makeBox("Frame", [8,1,1], [0,4.5,0], 0, frame)
        );
        const door = makeBox(
            "Door",
            [6,4,0.5],
            [0,2,0],
            0x5a1818,
            gameMaterial(0x5a1818, { emissive: 0x9d1515, emissiveIntensity: 0.5 })
        );
        this.exitGate.add(door);
        this.exitGate.userData = { open: false, door };
        this.scene.add(this.exitGate);
    }

    createCharacter(type, x, z, color, name) {
        const character = type === "PURSUER"
            ? createPursuer()
            : createEscapee({ jacketColor: color });

        character.position.set(x, 0, z);
        Object.assign(character.userData, {
            entityId: crypto.randomUUID(),
            type,
            name,
            state: "IDLE",
            previousState: "IDLE",
            captured: false,
            escaped: false,
            health: 2,
            speed: 0,
            stuckTime: 0,
            avoidanceSide: Math.random() < 0.5 ? -1 : 1,
            targetTerminal: null,
            chatCooldownUntil: 0,
            lastChatKey: "",
            animator: new CharacterAnimator(character)
        });
        this.scene.add(character);
        return character;
    }

    createCharacters() {
        const escapeeSpawns = [[-8,36],[0,38],[8,36],[14,32]];
        const colors = [0x3e8fd1,0x3fae72,0xb07bd8,0xd59a43];
        const names = ["NOVA-01", "NOVA-02", "NOVA-03", "NOVA-04"];
        const pursuerSpawn = [-40, -12];

        if (this.role === "ESCAPEE") {
            this.playerPosition.set(0, 0, 34);
            this.yaw = Math.PI;
            this.playerModel = createEscapee({ jacketColor: 0xd59a43 });
            escapeeSpawns.slice(0, 3).forEach((point, index) => {
                this.escapees.push(
                    this.createCharacter("ESCAPEE", point[0], point[1], colors[index], names[index])
                );
            });
            this.pursuers.push(
                this.createCharacter("PURSUER", pursuerSpawn[0], pursuerSpawn[1], 0x15191c, "WARDEN")
            );
        } else {
            this.playerPosition.set(pursuerSpawn[0], 0, pursuerSpawn[1]);
            this.yaw = Math.PI / 2;
            this.playerModel = createPursuer();
            escapeeSpawns.forEach((point, index) => {
                this.escapees.push(
                    this.createCharacter("ESCAPEE", point[0], point[1], colors[index], names[index])
                );
            });
        }

        this.playerModel.position.copy(this.playerPosition);
        this.playerModel.userData.animator = new CharacterAnimator(this.playerModel);
        this.playerAnimator = this.playerModel.userData.animator;
        this.scene.add(this.playerModel);
        this.syncPlayerModel();
    }

    createHud() {
        this.hud = document.createElement("div");
        this.hud.className = "game-hud";
        this.hud.innerHTML = `
            <div class="hud-stack">
                <div class="hud-panel">
                    <div class="hud-title">RUN FOR LIVE</div>
                    <div class="hud-row"><span>ROLE</span><strong>${this.role}</strong></div>
                    <div class="hud-row"><span>VIEW</span><strong data-view>FIRST</strong></div>
                    <div class="hud-row"><span>TIME</span><strong data-time>10:00</strong></div>
                    <div class="hud-row"><span>TERMINALS</span><strong data-terminals>0 / 3</strong></div>
                    <div class="hud-row"><span>CAPTURED</span><strong data-captured>0 / 4</strong></div>
                    <div class="hud-row"><span>ESCAPEES</span><strong data-active>4 ACTIVE</strong></div>
                    <div class="hud-row"><span>STAMINA</span><strong data-stamina>100%</strong></div>
                </div>
            </div>
            <div class="crosshair"></div>
            <div class="center-prompt" data-prompt></div>
            <div class="view-toast" data-view-toast>FIRST PERSON</div>
        `;
        document.body.appendChild(this.hud);
        this.ui = {
            view: this.hud.querySelector("[data-view]"),
            time: this.hud.querySelector("[data-time]"),
            terminals: this.hud.querySelector("[data-terminals]"),
            captured: this.hud.querySelector("[data-captured]"),
            active: this.hud.querySelector("[data-active]"),
            stamina: this.hud.querySelector("[data-stamina]"),
            prompt: this.hud.querySelector("[data-prompt]"),
            viewToast: this.hud.querySelector("[data-view-toast]")
        };
    }

    createGameChat() {
        this.chatRoot = document.createElement("section");
        this.chatRoot.className = "game-chat";
        this.chatRoot.innerHTML = `
            <div class="game-chat__log" data-game-chat-log></div>
            <form class="game-chat__form" data-game-chat-form hidden>
                <input
                    data-game-chat-input
                    maxlength="120"
                    autocomplete="off"
                    placeholder="Type a message and press Enter..."
                >
            </form>
            <div class="game-chat__hint">T: CHAT</div>
        `;
        document.body.appendChild(this.chatRoot);
        this.chatLog = this.chatRoot.querySelector("[data-game-chat-log]");
        this.chatForm = this.chatRoot.querySelector("[data-game-chat-form]");
        this.chatInput = this.chatRoot.querySelector("[data-game-chat-input]");

        this.chatForm.addEventListener("submit", event => {
            event.preventDefault();
            this.submitPlayerChat();
        });

        this.chatInput.addEventListener("keydown", event => {
            event.stopPropagation();
            if (event.code === "Escape") {
                event.preventDefault();
                this.closeChat(false);
            }
        });
    }

    openChat() {
        if (this.chatOpen || this.ended) return;
        this.chatOpen = true;
        this.keys.clear();
        document.exitPointerLock?.();
        this.chatForm.hidden = false;
        this.chatRoot.classList.add("game-chat--open");
        requestAnimationFrame(() => this.chatInput.focus());
    }

    closeChat(clearInput = true) {
        this.chatOpen = false;
        this.chatForm.hidden = true;
        this.chatRoot.classList.remove("game-chat--open");
        if (clearInput) this.chatInput.value = "";
        this.renderer.domElement.focus?.();
    }

    submitPlayerChat() {
        const content = this.chatInput.value.trim().slice(0, 120);
        if (content) {
            const identity = getChatIdentity(this.profile);
            this.addChatMessage({
                label: identity.label,
                className: identity.className,
                displayName: this.profile.displayName,
                content
            });
        }
        this.closeChat(true);
    }

    addChatMessage({ label, className, displayName, content }) {
        this.chatMessages.push({ label, className, displayName, content });
        if (this.chatMessages.length > this.chatMaximum) this.chatMessages.shift();
        this.renderChat();
    }

    addSystemMessage(content) {
        this.addChatMessage({
            label: "System",
            className: "system",
            displayName: "",
            content
        });
    }

    addNpcMessage(npc, key, content, force = false) {
        const now = performance.now();
        if (!force && now < npc.userData.chatCooldownUntil) return;
        if (!force && npc.userData.lastChatKey === key) return;
        npc.userData.chatCooldownUntil = now + 8000 + Math.random() * 4000;
        npc.userData.lastChatKey = key;
        this.addChatMessage({
            label: npc.userData.type === "PURSUER" ? "Pursuer" : "Player",
            className: npc.userData.type === "PURSUER" ? "pursuer" : "player",
            displayName: npc.userData.name,
            content
        });
    }

    renderChat() {
        this.chatLog.replaceChildren(...this.chatMessages.map(message => {
            const line = document.createElement("p");
            line.className = "game-chat__line";
            const identity = document.createElement("span");
            identity.className = `game-chat__identity game-chat__identity--${message.className}`;
            identity.textContent = message.displayName
                ? `[${message.label}] ${message.displayName}:`
                : `[${message.label}]`;
            const content = document.createElement("span");
            content.className = "game-chat__content";
            content.textContent = ` ${message.content}`;
            line.append(identity, content);
            return line;
        }));
        this.chatLog.scrollTop = this.chatLog.scrollHeight;
    }

    createTouchControls() {
        const root = document.createElement("div");
        root.id = "touch-controls";
        root.innerHTML = `
            <div class="touch-look" data-look></div>
            <div class="touch-stick" data-zone><div data-knob></div></div>
            <div class="touch-buttons">
                <button data-run>RUN</button>
                <button data-use>USE</button>
                <button data-sneak>SNEAK</button>
                <button data-view>VIEW</button>
                <button data-chat>CHAT</button>
                <button data-capture>${this.role === "PURSUER" ? "CAPTURE" : "PING"}</button>
            </div>
        `;
        document.body.appendChild(root);
        this.touchRoot = root;

        const look = root.querySelector("[data-look]");
        look.addEventListener("pointerdown", event => {
            if (this.chatOpen) return;
            this.dragPointer = event.pointerId;
            this.dragX = event.clientX;
            this.dragY = event.clientY;
            look.setPointerCapture?.(event.pointerId);
        });
        look.addEventListener("pointermove", event => {
            if (event.pointerId !== this.dragPointer || this.chatOpen) return;
            this.yaw -= (event.clientX - this.dragX) * 0.005;
            this.pitch = THREE.MathUtils.clamp(
                this.pitch - (event.clientY - this.dragY) * 0.005,
                -1.25,
                1.25
            );
            this.dragX = event.clientX;
            this.dragY = event.clientY;
        });
        look.addEventListener("pointerup", () => {
            this.dragPointer = null;
        });

        const zone = root.querySelector("[data-zone]");
        const knob = root.querySelector("[data-knob]");
        const moveStick = event => {
            if (event.pointerId !== this.joystick.pointer || this.chatOpen) return;
            const bounds = zone.getBoundingClientRect();
            let x = event.clientX - (bounds.left + bounds.width / 2);
            let y = event.clientY - (bounds.top + bounds.height / 2);
            const maximum = 44;
            const length = Math.hypot(x, y);
            if (length > maximum) {
                x = x / length * maximum;
                y = y / length * maximum;
            }
            this.joystick.x = x / maximum;
            this.joystick.y = y / maximum;
            knob.style.transform = `translate(${x}px, ${y}px)`;
        };
        zone.addEventListener("pointerdown", event => {
            if (this.chatOpen) return;
            this.joystick.pointer = event.pointerId;
            zone.setPointerCapture?.(event.pointerId);
            moveStick(event);
        });
        zone.addEventListener("pointermove", moveStick);
        zone.addEventListener("pointerup", () => {
            this.joystick = { x: 0, y: 0, pointer: null };
            knob.style.transform = "translate(0, 0)";
        });

        const bindHold = (selector, key) => {
            const button = root.querySelector(selector);
            button.onpointerdown = event => {
                event.preventDefault();
                if (!this.chatOpen) this.touch[key] = true;
            };
            button.onpointerup = button.onpointercancel = () => {
                this.touch[key] = false;
            };
        };
        bindHold("[data-run]", "sprint");
        bindHold("[data-use]", "interact");
        root.querySelector("[data-sneak]").onclick = () => {
            if (!this.chatOpen) this.touch.sneak = !this.touch.sneak;
        };
        root.querySelector("[data-view]").onclick = () => {
            if (!this.chatOpen) this.cycleCameraMode();
        };
        root.querySelector("[data-chat]").onclick = () => this.openChat();
        root.querySelector("[data-capture]").onclick = () => {
            if (!this.chatOpen && this.role === "PURSUER") this.tryCapture();
        };
    }

    bindEvents() {
        addEventListener("keydown", this.keyDown);
        addEventListener("keyup", this.keyUp);
        addEventListener("mousemove", this.mouseMove);
        addEventListener("resize", this.resize);
        this.renderer.domElement.onclick = () => {
            if (!this.chatOpen) this.renderer.domElement.requestPointerLock?.();
        };
    }

    keyDown(event) {
        if (this.chatOpen) return;

        if (event.code === "KeyT" && !event.repeat) {
            event.preventDefault();
            this.openChat();
            return;
        }

        if (event.code === "Escape") {
            this.stop();
            this.onExit?.();
            return;
        }

        if (event.code === "KeyC" && !event.repeat) {
            this.cycleCameraMode();
            return;
        }

        if (event.code === "Space" && this.role === "PURSUER") {
            this.tryCapture();
        }

        this.keys.add(event.code);
    }

    keyUp(event) {
        if (this.chatOpen) return;
        this.keys.delete(event.code);
        if (event.code === "KeyE") this.repairProgress = 0;
    }

    mouseMove(event) {
        if (this.chatOpen || document.pointerLockElement !== this.renderer.domElement) return;
        this.yaw -= event.movementX * 0.0023;
        this.pitch = THREE.MathUtils.clamp(
            this.pitch - event.movementY * 0.0023,
            -1.25,
            1.25
        );
    }

    cycleCameraMode() {
        this.cameraModeIndex = (this.cameraModeIndex + 1) % CAMERA_MODES.length;
        this.cameraMode = CAMERA_MODES[this.cameraModeIndex];
        this.ui.view.textContent = this.cameraMode;
        this.ui.viewToast.textContent =
            this.cameraMode === "FIRST"
                ? "FIRST PERSON"
                : this.cameraMode === "SECOND"
                    ? "SECOND PERSON"
                    : "THIRD PERSON";
        this.ui.viewToast.classList.add("visible");
        clearTimeout(this.viewToastTimer);
        this.viewToastTimer = setTimeout(
            () => this.ui.viewToast.classList.remove("visible"),
            1200
        );
        this.syncPlayerModel();
        this.updateCamera();
    }

    collision(x, z, radius = PLAYER_RADIUS) {
        if (Math.abs(x) + radius > 47 || Math.abs(z) + radius > 47) return true;
        return [...this.walls, ...this.obstacles].some(object => {
            const bounds = new THREE.Box3().setFromObject(object);
            return (
                x + radius > bounds.min.x &&
                x - radius < bounds.max.x &&
                z + radius > bounds.min.z &&
                z - radius < bounds.max.z
            );
        });
    }

    updatePlayer(deltaTime) {
        if (this.chatOpen) {
            this.playerAnimator?.update(deltaTime, { state: "IDLE" });
            return;
        }

        let forwardInput =
            (this.keys.has("KeyW") ? 1 : 0) -
            (this.keys.has("KeyS") ? 1 : 0) -
            this.joystick.y;
        let sideInput =
            (this.keys.has("KeyD") ? 1 : 0) -
            (this.keys.has("KeyA") ? 1 : 0) +
            this.joystick.x;

        const sneaking =
            this.keys.has("ShiftLeft") ||
            this.keys.has("ShiftRight") ||
            this.touch.sneak;
        const sprinting =
            ((this.keys.has("KeyW") && this.keys.has("KeyR")) || this.touch.sprint) &&
            forwardInput > 0.1 &&
            !sneaking &&
            this.stamina > 0;
        const speed = sneaking ? 1.8 : sprinting ? 7.2 : 4.4;

        this.stamina = THREE.MathUtils.clamp(
            this.stamina + (sprinting ? -25 : 17) * deltaTime,
            0,
            100
        );

        const inputLength = Math.hypot(forwardInput, sideInput);
        if (inputLength > 1) {
            forwardInput /= inputLength;
            sideInput /= inputLength;
        }

        const movement = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        )
            .multiplyScalar(forwardInput)
            .add(
                new THREE.Vector3(
                    Math.cos(this.yaw),
                    0,
                    -Math.sin(this.yaw)
                ).multiplyScalar(sideInput)
            );

        const nextX = this.playerPosition.x + movement.x * speed * deltaTime;
        const nextZ = this.playerPosition.z + movement.z * speed * deltaTime;

        if (!this.collision(nextX, this.playerPosition.z)) this.playerPosition.x = nextX;
        if (!this.collision(this.playerPosition.x, nextZ)) this.playerPosition.z = nextZ;

        this.syncPlayerModel();
        this.playerAnimator?.update(deltaTime, {
            state:
                movement.lengthSq() < 0.001
                    ? "IDLE"
                    : sprinting
                        ? "RUN"
                        : "WALK"
        });
    }

    syncPlayerModel() {
        if (!this.playerModel) return;
        this.playerModel.position.copy(this.playerPosition);
        this.playerModel.rotation.y = this.yaw;
        this.playerModel.visible = this.cameraMode !== "FIRST";
    }

    updateCamera() {
        const eye = this.playerPosition.clone();
        eye.y += PLAYER_HEIGHT;
        const forward = new THREE.Vector3(
            -Math.sin(this.yaw),
            0,
            -Math.cos(this.yaw)
        );

        if (this.cameraMode === "FIRST") {
            this.camera.position.copy(eye);
            this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
            return;
        }

        const lookTarget = eye.clone();
        lookTarget.y -= 0.15;
        const desired = eye.clone();

        if (this.cameraMode === "SECOND") {
            desired.addScaledVector(forward, 4.6);
            desired.y += 0.55;
        } else {
            desired.addScaledVector(forward, -5.7);
            desired.y += 1.5;
        }

        const direction = desired.clone().sub(lookTarget);
        const maximumDistance = direction.length();
        direction.normalize();
        this.cameraCollisionRay.set(lookTarget, direction);
        this.cameraCollisionRay.far = maximumDistance;
        const hits = this.cameraCollisionRay.intersectObjects(
            [...this.walls, ...this.obstacles],
            false
        );
        const safe = hits.length
            ? lookTarget.clone().addScaledVector(
                direction,
                Math.max(0.7, hits[0].distance - 0.35)
            )
            : desired;

        this.camera.position.lerp(safe, 0.22);
        this.camera.lookAt(lookTarget);
    }

    chooseNpcDirection(npc, desiredDirection) {
        const radius = npc.userData.type === "PURSUER" ? 0.78 : 0.52;
        const side = npc.userData.avoidanceSide || 1;
        const angles = [0,25*side,-25*side,50*side,-50*side,75*side,-75*side,110,-110,160,-160,180];

        for (const angle of angles) {
            const candidate = desiredDirection
                .clone()
                .applyAxisAngle(UP, THREE.MathUtils.degToRad(angle));
            if (!this.collision(
                npc.position.x + candidate.x * 1.3,
                npc.position.z + candidate.z * 1.3,
                radius
            )) {
                if (angle !== 0 && angle !== 180) {
                    npc.userData.avoidanceSide = Math.sign(angle) || side;
                }
                return candidate;
            }
        }
        return null;
    }

    moveNpc(npc, target, speed, deltaTime) {
        const desired = target.clone().sub(npc.position).setY(0);
        if (desired.lengthSq() < 0.01) return;
        desired.normalize();
        const direction = this.chooseNpcDirection(npc, desired);
        if (!direction) return;

        const radius = npc.userData.type === "PURSUER" ? 0.78 : 0.52;
        const nextX = npc.position.x + direction.x * speed * deltaTime;
        const nextZ = npc.position.z + direction.z * speed * deltaTime;
        if (!this.collision(nextX, npc.position.z, radius)) npc.position.x = nextX;
        if (!this.collision(npc.position.x, nextZ, radius)) npc.position.z = nextZ;

        const targetRotation = Math.atan2(direction.x, direction.z) + Math.PI;
        const difference = THREE.MathUtils.euclideanModulo(
            targetRotation - npc.rotation.y + Math.PI,
            Math.PI * 2
        ) - Math.PI;
        npc.rotation.y += difference * Math.min(1, deltaTime * 9);
    }

    setNpcState(npc, nextState) {
        if (npc.userData.state === nextState) return;
        npc.userData.previousState = npc.userData.state;
        npc.userData.state = nextState;

        if (nextState === "FLEE") {
            this.addNpcMessage(npc, "flee", "The pursuer is here!");
        } else if (nextState === "REPAIR") {
            this.addNpcMessage(npc, "repair", "Repairing a terminal.");
        } else if (nextState === "ESCAPE") {
            this.addNpcMessage(npc, "exit", "The exit is open. Move!");
        } else if (nextState === "CHASE" && npc.userData.type === "PURSUER") {
            this.addNpcMessage(npc, "chase", "I found you.");
        }
    }

    selectTerminalForNpc(npc) {
        if (npc.userData.targetTerminal && !npc.userData.targetTerminal.userData.repaired) {
            return npc.userData.targetTerminal;
        }
        const available = this.terminals
            .filter(terminal => !terminal.userData.repaired)
            .sort((a, b) => distanceXZ(npc.position, a.position) - distanceXZ(npc.position, b.position));
        const terminal = available.find(item =>
            !item.userData.assignedNpcId ||
            item.userData.assignedNpcId === npc.userData.entityId
        ) || available[0];
        if (terminal) {
            terminal.userData.assignedNpcId = npc.userData.entityId;
            npc.userData.targetTerminal = terminal;
        }
        return terminal;
    }

    updateEscapeeNpc(npc, deltaTime) {
        if (npc.userData.captured || npc.userData.escaped) return;
        const pursuer = this.role === "PURSUER"
            ? { position: this.playerPosition }
            : this.pursuers[0];
        const danger = pursuer
            ? distanceXZ(npc.position, pursuer.position)
            : Infinity;

        if (danger < 13) {
            this.setNpcState(npc, "FLEE");
            const away = npc.position.clone().sub(pursuer.position).setY(0);
            if (away.lengthSq() < 0.01) away.set(1, 0, 0);
            this.moveNpc(
                npc,
                npc.position.clone().add(away.normalize().multiplyScalar(12)),
                4.9,
                deltaTime
            );
        } else if (this.repaired >= REQUIRED_TERMINALS) {
            this.setNpcState(npc, "ESCAPE");
            this.moveNpc(npc, this.exitGate.position, 3.9, deltaTime);
            if (distanceXZ(npc.position, this.exitGate.position) < 2) {
                npc.userData.escaped = true;
                npc.visible = false;
                this.addSystemMessage(`${npc.userData.name} escaped.`);
            }
        } else {
            const terminal = this.selectTerminalForNpc(npc);
            if (!terminal) {
                this.setNpcState(npc, "IDLE");
            } else if (distanceXZ(npc.position, terminal.position) > 2.1) {
                this.setNpcState(npc, "WALK");
                this.moveNpc(npc, terminal.position, 2.8, deltaTime);
            } else {
                this.setNpcState(npc, "REPAIR");
                terminal.userData.progress += deltaTime / REPAIR_TIME * 0.55;
                if (terminal.userData.progress >= 1) {
                    this.completeTerminal(terminal, npc);
                }
            }
        }

        npc.userData.animator.update(deltaTime, {
            state: npc.userData.state,
            injured: npc.userData.health === 1
        });
    }

    updatePursuerNpc(npc, deltaTime) {
        const candidates = [
            { isPlayer: true, position: this.playerPosition },
            ...this.escapees
                .filter(escapee => !escapee.userData.captured && !escapee.userData.escaped)
                .map(escapee => ({
                    isPlayer: false,
                    entity: escapee,
                    position: escapee.position
                }))
        ];
        if (!candidates.length) return;
        candidates.sort((a, b) =>
            distanceXZ(npc.position, a.position) -
            distanceXZ(npc.position, b.position)
        );
        const target = candidates[0];
        const targetDistance = distanceXZ(npc.position, target.position);
        this.setNpcState(npc, targetDistance < 24 ? "CHASE" : "WALK");
        this.moveNpc(npc, target.position, targetDistance < 24 ? 4.7 : 2.4, deltaTime);
        npc.userData.animator.update(deltaTime, { state: npc.userData.state });

        if (targetDistance < 1.25) {
            if (target.isPlayer) {
                this.addNpcMessage(npc, "caught-player", "You're coming with me.", true);
                this.end("CAUGHT");
            } else if (target.entity) {
                target.entity.userData.health -= 1;
                if (target.entity.userData.health <= 0) {
                    this.captureEscapee(target.entity);
                } else {
                    target.entity.position.addScaledVector(
                        target.entity.position.clone().sub(npc.position).setY(0).normalize(),
                        3
                    );
                }
            }
        }
    }

    updateNpcs(deltaTime) {
        for (const escapee of this.escapees) {
            this.updateEscapeeNpc(escapee, deltaTime);
        }
        if (this.role === "ESCAPEE") {
            for (const pursuer of this.pursuers) {
                this.updatePursuerNpc(pursuer, deltaTime);
            }
        }
    }

    completeTerminal(terminal, npc = null) {
        if (terminal.userData.repaired) return;
        terminal.userData.repaired = true;
        terminal.userData.progress = 1;
        terminal.userData.screenMaterial.color.set(0x1f7848);
        terminal.userData.screenMaterial.emissive.set(0x29ff82);
        terminal.userData.assignedNpcId = null;
        this.repaired += 1;
        if (npc) {
            this.addNpcMessage(npc, `terminal-${this.repaired}`, "Terminal restored!", true);
        }
        for (const escapee of this.escapees) {
            if (escapee.userData.targetTerminal === terminal) {
                escapee.userData.targetTerminal = null;
            }
        }
        if (this.repaired >= REQUIRED_TERMINALS) {
            this.exitGate.userData.open = true;
            this.exitGate.userData.door.visible = false;
            this.addSystemMessage("All terminals restored. The exit is open.");
        }
    }

    captureEscapee(target) {
        if (target.userData.captured) return;
        target.userData.captured = true;
        target.visible = false;
        this.addSystemMessage(`${target.userData.name} was captured.`);
        this.checkMatchEnd();
    }

    tryCapture() {
        const target = this.escapees
            .filter(npc => !npc.userData.captured && !npc.userData.escaped)
            .sort((a, b) =>
                distanceXZ(this.playerPosition, a.position) -
                distanceXZ(this.playerPosition, b.position)
            )[0];
        if (target && distanceXZ(this.playerPosition, target.position) < 2.2) {
            target.userData.health -= 1;
            this.addChatMessage({
                label: "Pursuer",
                className: "pursuer",
                displayName: this.profile.displayName,
                content: target.userData.health <= 0
                    ? "Captured."
                    : "You cannot escape."
            });
            if (target.userData.health <= 0) {
                this.captureEscapee(target);
            }
        }
    }

    checkMatchEnd() {
        if (this.ended) return;
        const remaining = this.escapees.filter(escapee =>
            !escapee.userData.captured &&
            !escapee.userData.escaped
        );
        const captured = this.escapees.filter(escapee =>
            escapee.userData.captured
        ).length;

        if (this.role === "PURSUER" && remaining.length === 0) {
            if (captured === this.escapees.length) {
                this.addSystemMessage("All escapees have been captured.");
                this.end("PURSUER WIN");
            } else {
                this.end("MATCH OVER");
            }
        }
    }

    updateObjectives(deltaTime) {
        if (this.role !== "ESCAPEE" || this.chatOpen) return;
        const interacting = this.keys.has("KeyE") || this.touch.interact;
        const terminal = this.terminals
            .filter(item => !item.userData.repaired)
            .sort((a, b) =>
                distanceXZ(this.playerPosition, a.position) -
                distanceXZ(this.playerPosition, b.position)
            )[0];
        this.ui.prompt.classList.remove("visible");

        if (terminal && distanceXZ(this.playerPosition, terminal.position) < 3.4) {
            this.ui.prompt.textContent = interacting
                ? `RESTORING ${Math.min(100, Math.round(this.repairProgress / REPAIR_TIME * 100))}%`
                : "HOLD E / USE TO RESTORE";
            this.ui.prompt.classList.add("visible");
            if (interacting) {
                this.repairProgress += deltaTime;
                if (this.repairProgress >= REPAIR_TIME) {
                    this.completeTerminal(terminal);
                    this.repairProgress = 0;
                }
            } else {
                this.repairProgress = 0;
            }
        } else if (distanceXZ(this.playerPosition, this.exitGate.position) < 4) {
            this.ui.prompt.textContent = this.exitGate.userData.open
                ? "PRESS E / USE TO ESCAPE"
                : `${REQUIRED_TERMINALS - this.repaired} TERMINALS REMAINING`;
            this.ui.prompt.classList.add("visible");
            if (interacting && this.exitGate.userData.open) {
                this.end("ESCAPED");
            }
        } else {
            this.repairProgress = 0;
        }
    }

    updateHud() {
        const remainingTime = Math.max(0, MATCH_TIME - this.elapsed);
        this.ui.time.textContent =
            `${String(Math.floor(remainingTime / 60)).padStart(2, "0")}:` +
            `${String(Math.floor(remainingTime % 60)).padStart(2, "0")}`;
        this.ui.terminals.textContent = `${this.repaired} / ${REQUIRED_TERMINALS}`;
        const captured = this.escapees.filter(npc => npc.userData.captured).length;
        const active = this.escapees.filter(npc =>
            !npc.userData.captured && !npc.userData.escaped
        ).length;
        this.ui.captured.textContent = `${captured} / ${this.escapees.length}`;
        this.ui.active.textContent = `${active + (this.role === "ESCAPEE" ? 1 : 0)} ACTIVE`;
        this.ui.stamina.textContent = `${Math.round(this.stamina)}%`;
    }

    end(title) {
        if (this.ended) return;
        this.ended = true;
        this.running = false;
        this.closeChat(false);
        document.exitPointerLock?.();
        const overlay = document.createElement("section");
        overlay.className = "overlay";
        overlay.innerHTML = `
            <article class="overlay-card">
                <h2>${title}</h2>
                <div class="menu-actions">
                    <button class="menu-button menu-button--primary" data-retry>RETRY</button>
                    <button class="menu-button" data-menu>MENU</button>
                </div>
            </article>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector("[data-retry]").onclick = () => {
            this.stop();
            this.onRetry?.();
        };
        overlay.querySelector("[data-menu]").onclick = () => {
            this.stop();
            this.onExit?.();
        };
        this.overlay = overlay;
    }

    animate() {
        if (!this.running) return;
        this.frame = requestAnimationFrame(this.animate);
        const deltaTime = Math.min(this.clock.getDelta(), 0.05);
        this.elapsed += deltaTime;
        this.updatePlayer(deltaTime);
        this.updateNpcs(deltaTime);
        this.updateObjectives(deltaTime);
        this.updateCamera();
        this.updateHud();
        this.checkMatchEnd();
        if (this.elapsed >= MATCH_TIME) {
            this.end(this.role === "PURSUER" ? "PURSUER WIN" : "TIME EXPIRED");
        }
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect =
            this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(
            this.container.clientWidth,
            this.container.clientHeight,
            false
        );
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
        clearTimeout(this.viewToastTimer);
        removeEventListener("keydown", this.keyDown);
        removeEventListener("keyup", this.keyUp);
        removeEventListener("mousemove", this.mouseMove);
        removeEventListener("resize", this.resize);
        this.hud?.remove();
        this.chatRoot?.remove();
        this.touchRoot?.remove();
        this.overlay?.remove();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
