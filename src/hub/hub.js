import * as THREE from "three";
import { HUB_CONFIG } from "../config.js";
import { buildHub } from "./hub-map.js";
import { LobbyService } from "../services/lobby-service.js";
import { LeaderboardService } from "../services/leaderboard-service.js";
import { openModeMenu } from "../ui/mode-menu.js";
import { createLeaderboardUi } from "../ui/leaderboard-ui.js";
import { rankForProfile } from "../services/economy-service.js";

export class Hub {
    constructor(container, { profile, onSignOut }) {
        this.container = container;
        this.profile = profile;
        this.onSignOut = onSignOut;
        this.position = new THREE.Vector3(0, 0, 8);
        this.yaw = Math.PI;
        this.keys = new Set();
        this.lobby = new LobbyService(profile);
        this.leaderboards = new LeaderboardService();
        this.animate = this.animate.bind(this);
        this.keyDown = this.keyDown.bind(this);
        this.keyUp = this.keyUp.bind(this);
        this.resize = this.resize.bind(this);
    }

    async start() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050a0f);
        this.scene.fog = new THREE.Fog(0x050a0f, HUB_CONFIG.fogNear, HUB_CONFIG.fogFar);
        this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, HUB_CONFIG.farPlane);
        this.renderer = new THREE.WebGLRenderer({
            antialias: !matchMedia("(pointer: coarse)").matches,
            powerPreference: "high-performance"
        });
        const mobile = matchMedia("(pointer: coarse)").matches;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? HUB_CONFIG.mobileMaxPixelRatio : HUB_CONFIG.maxPixelRatio));
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.HemisphereLight(0x8fd7ff, 0x10151a, 1.4));
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(16, 30, 10);
        this.scene.add(sun);

        const { portals } = buildHub(this.scene);
        this.portals = portals;
        this.createAvatar();
        this.createHud();
        this.bindEvents();
        this.resize();
        await this.lobby.connect();
        this.lobby.addEventListener("players", event => {
            this.onlineCount.textContent = `${event.detail.length} ONLINE`;
        });
        this.clock = new THREE.Clock();
        this.running = true;
        this.animate();
    }

    createAvatar() {
        this.avatar = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.38, 0.9, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0xd99b45, roughness: 0.72 })
        );
        body.position.y = 1.15;
        this.avatar.add(body);
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
            <div class="online-count" data-online>1 ONLINE</div>
            <div class="hub-prompt" data-prompt></div>
            <button data-sign-out>LOG OUT</button>
            <div class="hub-help">WASD: MOVE Â· E: USE Â· MOUSE: LOOK</div>
        `;
        document.body.appendChild(this.hud);
        this.prompt = this.hud.querySelector("[data-prompt]");
        this.onlineCount = this.hud.querySelector("[data-online]");
        this.hud.querySelector("[data-sign-out]").onclick = this.onSignOut;
    }

    bindEvents() {
        addEventListener("keydown", this.keyDown);
        addEventListener("keyup", this.keyUp);
        addEventListener("resize", this.resize);
        this.renderer.domElement.onclick = () => this.renderer.domElement.requestPointerLock?.();
        addEventListener("mousemove", event => {
            if (document.pointerLockElement === this.renderer.domElement) this.yaw -= event.movementX * 0.0022;
        });
    }

    keyDown(event) {
        this.keys.add(event.code);
        if (event.code === "KeyE" && !event.repeat) this.interact();
    }

    keyUp(event) {
        this.keys.delete(event.code);
    }

    nearestPortal() {
        return [...this.portals]
            .sort((a, b) => this.position.distanceTo(a.position) - this.position.distanceTo(b.position))[0];
    }

    interact() {
        const portal = this.nearestPortal();
        if (!portal || this.position.distanceTo(portal.position) > HUB_CONFIG.interactionDistance) return;
        if (portal.id === "PLAY") {
            openModeMenu({
                onSelect: mode => alert(`${mode} is the next rebuild phase.`)
            });
        } else if (portal.id === "LEADERBOARD") {
            createLeaderboardUi({ service: this.leaderboards, profile: this.profile });
        } else {
            alert(`${portal.label} is coming next.`);
        }
    }

    update(delta) {
        let forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
        let side = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
        const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
        const speed = running ? HUB_CONFIG.sprintSpeed : HUB_CONFIG.movementSpeed;
        const length = Math.hypot(forward, side) || 1;
        forward /= length;
        side /= length;
        const move = new THREE.Vector3(
            -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side,
            0,
            -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side
        );
        this.position.addScaledVector(move, speed * delta);
        if (this.position.length() > 35) this.position.setLength(35);
        this.avatar.position.copy(this.position);
        this.avatar.rotation.y = this.yaw;
        this.camera.position.set(this.position.x, 2.2, this.position.z);
        this.camera.rotation.set(0, this.yaw, 0, "YXZ");

        const portal = this.nearestPortal();
        const near = portal && this.position.distanceTo(portal.position) <= HUB_CONFIG.interactionDistance;
        this.prompt.textContent = near ? `PRESS E Â· ${portal.label}` : "";
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
        await this.lobby.disconnect();
        this.hud?.remove();
        this.renderer?.dispose();
        this.renderer?.domElement.remove();
    }
}
