import * as THREE from "three";
import { HUB_CONFIG } from "../config.js";
import { buildHub } from "./hub-map.js";
import { LobbyService } from "../services/lobby-service.js";
import { LeaderboardService } from "../services/leaderboard-service.js";
import { openModeMenu } from "../ui/mode-menu.js";
import { createLeaderboardUi } from "../ui/leaderboard-ui.js";
import { rankForProfile } from "../services/economy-service.js";

const clamp = THREE.MathUtils.clamp;

export class Hub {
    constructor(container, { profile, onSignOut }) {
        this.container = container;
        this.profile = profile;
        this.onSignOut = onSignOut;

        this.position = new THREE.Vector3(0, 0, 17);
        this.yaw = Math.PI;
        this.pitch = -0.04;
        this.keys = new Set();
        this.touchMove = { x: 0, y: 0 };
        this.touchLookPointer = null;
        this.touchStickPointer = null;
        this.isCoarsePointer = matchMedia("(pointer: coarse)").matches;

        this.lobby = new LobbyService(profile);
        this.leaderboards = new LeaderboardService();

        this.animate = this.animate.bind(this);
        this.keyDown = this.keyDown.bind(this);
        this.keyUp = this.keyUp.bind(this);
        this.resize = this.resize.bind(this);
        this.mouseMove = this.mouseMove.bind(this);
    }

    async start() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x05080d);
        this.scene.fog = new THREE.Fog(0x05080d, 42, 118);

        this.camera = new THREE.PerspectiveCamera(68, 1, 0.08, HUB_CONFIG.farPlane);
        this.camera.rotation.order = "YXZ";

        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.isCoarsePointer,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(
            devicePixelRatio,
            this.isCoarsePointer ? HUB_CONFIG.mobileMaxPixelRatio : HUB_CONFIG.maxPixelRatio
        ));
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.HemisphereLight(0x91d9ff, 0x091017, 1.55));
        const keyLight = new THREE.DirectionalLight(0xd7efff, 1.4);
        keyLight.position.set(18, 32, 12);
        this.scene.add(keyLight);

        const { portals, obstacles } = buildHub(this.scene);
        this.portals = portals;
        this.obstacles = obstacles;

        this.createAvatar();
        this.createHud();
        this.createTouchControls();
        this.bindEvents();
        this.resize();

        if (!this.profile.guest) {
            await this.lobby.connect();
            this.lobby.addEventListener("players", event => {
                this.onlineCount.textContent = `${Math.max(1, event.detail.length)} ONLINE`;
            });
        } else {
            this.onlineCount.textContent = "GUEST MODE";
        }

        this.clock = new THREE.Clock();
        this.running = true;
        this.animate();
    }

    createAvatar() {
        this.avatar = new THREE.Group();
        const jacket = new THREE.MeshStandardMaterial({ color: 0xd99b45, roughness: 0.68 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x17212a, roughness: 0.8 });

        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.85, 4, 8), jacket);
        torso.position.y = 1.18;
        this.avatar.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), dark);
        head.position.y = 2.05;
        this.avatar.add(head);

        this.avatar.position.copy(this.position);
        this.scene.add(this.avatar);
    }

    createHud() {
        const rank = rankForProfile(this.profile);
        this.hud = document.createElement("section");
        this.hud.className = "hub-hud";
        this.hud.innerHTML = `
            <div class="profile-chip">
                <span class="rank rank--${rank.className}">[${rank.label}]</span>
                <b>${this.profile.displayName}</b>
            </div>
            <div class="online-count" data-online>CONNECTING...</div>
            <div class="hub-title"><b>RUN FOR LIVE</b><span>MAIN LOBBY</span></div>
            <div class="hub-prompt" data-prompt></div>
            <button class="logout-button" data-sign-out>LOG OUT</button>
            <div class="hub-help">WASD MOVE Â· MOUSE LOOK Â· E USE</div>
        `;
        document.body.appendChild(this.hud);
        this.prompt = this.hud.querySelector("[data-prompt]");
        this.onlineCount = this.hud.querySelector("[data-online]");
        this.hud.querySelector("[data-sign-out]").onclick = () => this.onSignOut?.();
    }

    createTouchControls() {
        if (!this.isCoarsePointer) return;

        this.touchControls = document.createElement("div");
        this.touchControls.className = "touch-controls";
        this.touchControls.innerHTML = `
            <div class="touch-look-zone" data-look></div>
            <div class="touch-stick" data-stick>
                <div class="touch-stick__knob" data-knob></div>
            </div>
            <button class="touch-use" data-use>USE</button>
        `;
        document.body.appendChild(this.touchControls);

        const look = this.touchControls.querySelector("[data-look]");
        const stick = this.touchControls.querySelector("[data-stick]");
        const knob = this.touchControls.querySelector("[data-knob]");

        look.onpointerdown = event => {
            this.touchLookPointer = event.pointerId;
            this.lastLookX = event.clientX;
            this.lastLookY = event.clientY;
            look.setPointerCapture?.(event.pointerId);
        };
        look.onpointermove = event => {
            if (event.pointerId !== this.touchLookPointer) return;
            this.yaw -= (event.clientX - this.lastLookX) * 0.006;
            this.pitch = clamp(this.pitch - (event.clientY - this.lastLookY) * 0.006, -1.05, 1.05);
            this.lastLookX = event.clientX;
            this.lastLookY = event.clientY;
        };
        const stopLook = event => {
            if (event.pointerId === this.touchLookPointer) this.touchLookPointer = null;
        };
        look.onpointerup = stopLook;
        look.onpointercancel = stopLook;

        const updateStick = event => {
            if (event.pointerId !== this.touchStickPointer) return;
            const bounds = stick.getBoundingClientRect();
            let x = event.clientX - (bounds.left + bounds.width / 2);
            let y = event.clientY - (bounds.top + bounds.height / 2);
            const radius = 42;
            const length = Math.hypot(x, y);
            if (length > radius) {
                x = x / length * radius;
                y = y / length * radius;
            }
            this.touchMove.x = x / radius;
            this.touchMove.y = y / radius;
            knob.style.transform = `translate(${x}px, ${y}px)`;
        };
        stick.onpointerdown = event => {
            this.touchStickPointer = event.pointerId;
            stick.setPointerCapture?.(event.pointerId);
            updateStick(event);
        };
        stick.onpointermove = updateStick;
        const stopStick = event => {
            if (event.pointerId !== this.touchStickPointer) return;
            this.touchStickPointer = null;
            this.touchMove.x = 0;
            this.touchMove.y = 0;
            knob.style.transform = "translate(0, 0)";
        };
        stick.onpointerup = stopStick;
        stick.onpointercancel = stopStick;

        this.touchControls.querySelector("[data-use]").onclick = () => this.interact();
    }

    bindEvents() {
        addEventListener("keydown", this.keyDown);
        addEventListener("keyup", this.keyUp);
        addEventListener("resize", this.resize);
        addEventListener("mousemove", this.mouseMove);
        this.renderer.domElement.onclick = () => {
            if (!this.isCoarsePointer) this.renderer.domElement.requestPointerLock?.();
        };
    }

    mouseMove(event) {
        if (document.pointerLockElement !== this.renderer.domElement) return;
        this.yaw -= event.movementX * 0.0022;
        this.pitch = clamp(this.pitch - event.movementY * 0.0022, -1.05, 1.05);
    }

    keyDown(event) {
        this.keys.add(event.code);
        if (event.code === "KeyE" && !event.repeat) this.interact();
    }

    keyUp(event) {
        this.keys.delete(event.code);
    }

    nearestPortal() {
        return [...this.portals].sort(
            (a, b) => this.position.distanceTo(a.position) - this.position.distanceTo(b.position)
        )[0];
    }

    interact() {
        const portal = this.nearestPortal();
        if (!portal || this.position.distanceTo(portal.position) > HUB_CONFIG.interactionDistance + 1.5) return;

        if (portal.id === "PLAY") {
            openModeMenu({ onSelect: mode => alert(`${mode} is coming in the match-lobby phase.`) });
        } else if (portal.id === "LEADERBOARD") {
            if (this.profile.guest) {
                alert("Sign in to view the live leaderboard.");
                return;
            }
            createLeaderboardUi({ service: this.leaderboards, profile: this.profile });
        } else {
            alert(`${portal.label} is coming next.`);
        }
    }

    collides(x, z, radius = 0.55) {
        if (Math.hypot(x, z) > 39) return true;
        return this.obstacles.some(bounds =>
            x + radius > bounds.minX && x - radius < bounds.maxX &&
            z + radius > bounds.minZ && z - radius < bounds.maxZ
        );
    }

    update(delta) {
        let forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")) - this.touchMove.y;
        let side = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")) + this.touchMove.x;
        const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
        const speed = running ? HUB_CONFIG.sprintSpeed : HUB_CONFIG.movementSpeed;
        const length = Math.hypot(forward, side);
        if (length > 1) {
            forward /= length;
            side /= length;
        }

        const move = new THREE.Vector3(
            -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side,
            0,
            -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side
        );
        const nextX = this.position.x + move.x * speed * delta;
        const nextZ = this.position.z + move.z * speed * delta;
        if (!this.collides(nextX, this.position.z)) this.position.x = nextX;
        if (!this.collides(this.position.x, nextZ)) this.position.z = nextZ;

        this.avatar.position.copy(this.position);
        this.avatar.rotation.y = this.yaw;
        this.avatar.visible = false;

        this.camera.position.set(this.position.x, 1.72, this.position.z);
        this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");

        const portal = this.nearestPortal();
        const near = portal && this.position.distanceTo(portal.position) <= HUB_CONFIG.interactionDistance + 1.5;
        this.prompt.textContent = near ? `${this.isCoarsePointer ? "TAP USE" : "PRESS E"} Â· ${portal.label}` : "";
        this.prompt.classList.toggle("visible", Boolean(near));
    }

    animate() {
        if (!this.running) return;
        this.frame = requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.update(delta);
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const width = this.container.clientWidth || innerWidth;
        const height = this.container.clientHeight || innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    async stop() {
        this.running = false;
        cancelAnimationFrame(this.frame);
        removeEventListener("keydown", this.keyDown);
        removeEventListener("keyup", this.keyUp);
        removeEventListener("resize", this.resize);
        removeEventListener("mousemove", this.mouseMove);
        await this.lobby.disconnect();
        this.hud?.remove();
        this.touchControls?.remove();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
