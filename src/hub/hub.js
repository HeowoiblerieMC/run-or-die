import * as THREE from "three";

import {
    HUB_CONFIG
} from "../config.js";

import {
    buildHub
} from "./hub-map.js";

import {
    LobbyService
} from "../services/lobby-service.js";

import {
    LeaderboardService
} from "../services/leaderboard-service.js";

import {
    openModeMenu
} from "../ui/mode-menu.js";

import {
    createLeaderboardUi
} from "../ui/leaderboard-ui.js";

import {
    rankForProfile
} from "../services/economy-service.js";

export class Hub {
    constructor(
        container,
        {
            profile,
            onSignOut,
            onLogout
        }
    ) {
        this.container =
            container;

        this.profile =
            profile;

        this.onSignOut =
            onSignOut ||
            onLogout;

        this.position =
            new THREE.Vector3(
                0,
                0,
                17
            );

        this.yaw =
            Math.PI;

        this.pitch =
            0;

        this.keys =
            new Set();

        this.touchMove = {
            x:
                0,

            y:
                0
        };

        this.mobile =
            matchMedia(
                "(pointer: coarse)"
            ).matches;

        this.lobby =
            new LobbyService(
                profile
            );

        this.leaderboards =
            new LeaderboardService();

        this.animate =
            this.animate.bind(
                this
            );

        this.resize =
            this.resize.bind(
                this
            );
    }

    async start() {
        this.scene =
            new THREE.Scene();

        this.scene.background =
            new THREE.Color(
                0x05080d
            );

        this.scene.fog =
            new THREE.Fog(
                0x05080d,
                42,
                125
            );

        this.camera =
            new THREE
                .PerspectiveCamera(
                    68,
                    1,
                    0.08,
                    HUB_CONFIG.farPlane
                );

        this.camera.rotation.order =
            "YXZ";

        this.renderer =
            new THREE.WebGLRenderer({
                antialias:
                    !this.mobile,

                powerPreference:
                    "high-performance"
            });

        this.renderer
            .setPixelRatio(
                Math.min(
                    devicePixelRatio,
                    this.mobile
                        ? HUB_CONFIG
                            .mobileMaxPixelRatio
                        : HUB_CONFIG
                            .maxPixelRatio
                )
            );

        this.renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        this.container.appendChild(
            this.renderer.domElement
        );

        this.scene.add(
            new THREE
                .HemisphereLight(
                    0x91d9ff,
                    0x091017,
                    1.55
                )
        );

        const light =
            new THREE
                .DirectionalLight(
                    0xffffff,
                    1.3
                );

        light.position.set(
            18,
            32,
            12
        );

        this.scene.add(
            light
        );

        const hubData =
            buildHub(
                this.scene
            );

        this.portals =
            hubData.portals;

        this.obstacles =
            hubData.obstacles;

        this.createHud();
        this.createTouchControls();
        this.bindEvents();
        this.resize();

        if (
            !this.profile.guest
        ) {
            await this.lobby
                .connect();
        }

        this.clock =
            new THREE.Clock();

        this.running =
            true;

        this.animate();
    }

    createHud() {
        const rank =
            rankForProfile(
                this.profile
            );

        this.hud =
            document.createElement(
                "section"
            );

        this.hud.className =
            "hub-hud";

        this.hud.innerHTML = `
            <div class="profile-chip">
                <span class="rank rank--${rank.className}">
                    [${rank.label}]
                </span>

                <b>
                    ${this.profile.displayName}
                </b>
            </div>

            <div class="online-count">
                ${
                    this.profile.guest
                        ? "GUEST MODE"
                        : "ONLINE"
                }
            </div>

            <div
                class="hub-prompt"
                data-prompt
            ></div>

            <button
                class="logout-button"
                type="button"
            >
                LOG OUT
            </button>
        `;

        document.body.appendChild(
            this.hud
        );

        this.prompt =
            this.hud.querySelector(
                "[data-prompt]"
            );

        this.hud
            .querySelector(
                ".logout-button"
            )
            .addEventListener(
                "click",
                () =>
                    this.onSignOut?.()
            );
    }

    createTouchControls() {
        if (
            !this.mobile
        ) {
            return;
        }

        this.touchControls =
            document.createElement(
                "div"
            );

        this.touchControls.innerHTML = `
            <div class="touch-look-zone"></div>

            <div class="touch-stick">
                <div class="touch-stick__knob"></div>
            </div>

            <button class="touch-use">
                USE
            </button>
        `;

        document.body.appendChild(
            this.touchControls
        );

        const look =
            this.touchControls
                .querySelector(
                    ".touch-look-zone"
                );

        const stick =
            this.touchControls
                .querySelector(
                    ".touch-stick"
                );

        const knob =
            this.touchControls
                .querySelector(
                    ".touch-stick__knob"
                );

        look.addEventListener(
            "pointerdown",
            event => {
                this.lookPointer =
                    event.pointerId;

                this.lastLookX =
                    event.clientX;

                this.lastLookY =
                    event.clientY;
            }
        );

        look.addEventListener(
            "pointermove",
            event => {
                if (
                    event.pointerId !==
                    this.lookPointer
                ) {
                    return;
                }

                this.yaw -=
                    (
                        event.clientX -
                        this.lastLookX
                    ) *
                    0.006;

                this.pitch =
                    THREE.MathUtils.clamp(
                        this.pitch -
                            (
                                event.clientY -
                                this.lastLookY
                            ) *
                            0.006,

                        -1.05,
                        1.05
                    );

                this.lastLookX =
                    event.clientX;

                this.lastLookY =
                    event.clientY;
            }
        );

        const stopLooking =
            event => {
                if (
                    event.pointerId ===
                    this.lookPointer
                ) {
                    this.lookPointer =
                        null;
                }
            };

        look.addEventListener(
            "pointerup",
            stopLooking
        );

        look.addEventListener(
            "pointercancel",
            stopLooking
        );

        const moveStick =
            event => {
                if (
                    event.pointerId !==
                    this.stickPointer
                ) {
                    return;
                }

                const bounds =
                    stick
                        .getBoundingClientRect();

                let x =
                    event.clientX -
                    bounds.left -
                    bounds.width / 2;

                let y =
                    event.clientY -
                    bounds.top -
                    bounds.height / 2;

                const maximum =
                    42;

                const length =
                    Math.hypot(
                        x,
                        y
                    );

                if (
                    length >
                    maximum
                ) {
                    x =
                        x /
                        length *
                        maximum;

                    y =
                        y /
                        length *
                        maximum;
                }

                this.touchMove = {
                    x:
                        x /
                        maximum,

                    y:
                        y /
                        maximum
                };

                knob.style.transform =
                    `translate(${x}px, ${y}px)`;
            };

        stick.addEventListener(
            "pointerdown",
            event => {
                this.stickPointer =
                    event.pointerId;

                moveStick(
                    event
                );
            }
        );

        stick.addEventListener(
            "pointermove",
            moveStick
        );

        const stopMoving =
            event => {
                if (
                    event.pointerId !==
                    this.stickPointer
                ) {
                    return;
                }

                this.stickPointer =
                    null;

                this.touchMove = {
                    x:
                        0,

                    y:
                        0
                };

                knob.style.transform =
                    "translate(0, 0)";
            };

        stick.addEventListener(
            "pointerup",
            stopMoving
        );

        stick.addEventListener(
            "pointercancel",
            stopMoving
        );

        this.touchControls
            .querySelector(
                ".touch-use"
            )
            .addEventListener(
                "click",
                () =>
                    this.interact()
            );
    }

    bindEvents() {
        this.keyDown =
            event => {
                this.keys.add(
                    event.code
                );

                if (
                    event.code ===
                        "KeyE" &&
                    !event.repeat
                ) {
                    this.interact();
                }
            };

        this.keyUp =
            event => {
                this.keys.delete(
                    event.code
                );
            };

        this.mouseMove =
            event => {
                if (
                    document.pointerLockElement !==
                    this.renderer.domElement
                ) {
                    return;
                }

                this.yaw -=
                    event.movementX *
                    0.0022;

                this.pitch =
                    THREE.MathUtils.clamp(
                        this.pitch -
                        event.movementY *
                        0.0022,

                        -1.05,
                        1.05
                    );
            };

        addEventListener(
            "keydown",
            this.keyDown
        );

        addEventListener(
            "keyup",
            this.keyUp
        );

        addEventListener(
            "mousemove",
            this.mouseMove
        );

        addEventListener(
            "resize",
            this.resize
        );

        this.renderer
            .domElement
            .addEventListener(
                "click",
                () => {
                    if (
                        !this.mobile
                    ) {
                        this.renderer
                            .domElement
                            .requestPointerLock?.();
                    }
                }
            );
    }

    nearestPortal() {
        return [
            ...this.portals
        ].sort(
            (
                first,
                second
            ) =>
                first.position
                    .distanceTo(
                        this.position
                    ) -
                second.position
                    .distanceTo(
                        this.position
                    )
        )[0];
    }

    interact() {
        const portal =
            this.nearestPortal();

        if (
            !portal ||
            portal.position
                .distanceTo(
                    this.position
                ) >
                HUB_CONFIG
                    .interactionDistance +
                1
        ) {
            return;
        }

        if (
            portal.id ===
            "PLAY"
        ) {
            openModeMenu({
                onSelect:
                    mode => {
                        console.log(
                            mode
                        );
                    }
            });

            return;
        }

        if (
            portal.id ===
            "LEADERBOARD"
        ) {
            createLeaderboardUi({
                service:
                    this.leaderboards,

                profile:
                    this.profile
            });

            return;
        }

        alert(
            `${portal.label} is coming next.`
        );
    }

    update(
        deltaTime
    ) {
        let forward =
            Number(
                this.keys.has(
                    "KeyW"
                )
            ) -
            Number(
                this.keys.has(
                    "KeyS"
                )
            ) -
            this.touchMove.y;

        let side =
            Number(
                this.keys.has(
                    "KeyD"
                )
            ) -
            Number(
                this.keys.has(
                    "KeyA"
                )
            ) +
            this.touchMove.x;

        const length =
            Math.hypot(
                forward,
                side
            );

        if (
            length >
            1
        ) {
            forward /=
                length;

            side /=
                length;
        }

        const sprint =
            this.keys.has(
                "ShiftLeft"
            ) ||
            this.keys.has(
                "ShiftRight"
            );

        const speed =
            sprint
                ? HUB_CONFIG
                    .sprintSpeed
                : HUB_CONFIG
                    .movementSpeed;

        const nextX =
            this.position.x +
            (
                -Math.sin(
                    this.yaw
                ) *
                    forward +

                Math.cos(
                    this.yaw
                ) *
                    side
            ) *
            speed *
            deltaTime;

        const nextZ =
            this.position.z +
            (
                -Math.cos(
                    this.yaw
                ) *
                    forward -

                Math.sin(
                    this.yaw
                ) *
                    side
            ) *
            speed *
            deltaTime;

        if (
            Math.hypot(
                nextX,
                nextZ
            ) <
            40
        ) {
            this.position.set(
                nextX,
                0,
                nextZ
            );
        }

        this.camera.position.set(
            this.position.x,
            1.72,
            this.position.z
        );

        this.camera.rotation.set(
            this.pitch,
            this.yaw,
            0,
            "YXZ"
        );

        const portal =
            this.nearestPortal();

        const nearby =
            portal &&
            portal.position
                .distanceTo(
                    this.position
                ) <=
                HUB_CONFIG
                    .interactionDistance +
                1;

        this.prompt.textContent =
            nearby
                ? `${
                    this.mobile
                        ? "TAP USE"
                        : "PRESS E"
                } · ${portal.label}`
                : "";

        this.prompt.classList.toggle(
            "visible",
            Boolean(nearby)
        );
    }

    animate() {
        if (
            !this.running
        ) {
            return;
        }

        this.animationFrame =
            requestAnimationFrame(
                this.animate
            );

        this.update(
            Math.min(
                this.clock.getDelta(),
                0.05
            )
        );

        this.renderer.render(
            this.scene,
            this.camera
        );
    }

    resize() {
        if (
            !this.camera
        ) {
            return;
        }

        const width =
            this.container
                .clientWidth ||
            innerWidth;

        const height =
            this.container
                .clientHeight ||
            innerHeight;

        this.camera.aspect =
            width /
            height;

        this.camera
            .updateProjectionMatrix();

        this.renderer.setSize(
            width,
            height,
            false
        );
    }

    async stop() {
        this.running =
            false;

        cancelAnimationFrame(
            this.animationFrame
        );

        removeEventListener(
            "keydown",
            this.keyDown
        );

        removeEventListener(
            "keyup",
            this.keyUp
        );

        removeEventListener(
            "mousemove",
            this.mouseMove
        );

        removeEventListener(
            "resize",
            this.resize
        );

        await this.lobby
            .disconnect();

        this.hud?.remove();
        this.touchControls?.remove();

        this.renderer?.dispose();

        this.renderer
            ?.domElement
            ?.remove();
    }
}
