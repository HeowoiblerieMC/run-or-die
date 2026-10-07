import * as THREE from "three";

const MATCH_DURATION_SECONDS =
    10 * 60;

const REQUIRED_TERMINALS =
    3;

const WALK_SPEED =
    4.3;

const SPRINT_SPEED =
    7.2;

const SNEAK_SPEED =
    1.75;

const MAX_STAMINA =
    100;

const STAMINA_DRAIN_RATE =
    24;

const STAMINA_RECOVERY_RATE =
    17;

const PLAYER_RADIUS =
    0.42;

const PLAYER_HEIGHT =
    1.72;

const INTERACTION_DISTANCE =
    3.4;

const TERMINAL_REPAIR_TIME =
    4.5;

function createMaterial(
    color,
    {
        roughness = 0.82,
        metalness = 0.05,
        emissive = 0x000000,
        emissiveIntensity = 0
    } = {}
) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity
    });
}

function createBox({
    name,
    width,
    height,
    depth,
    x,
    y,
    z,
    color,
    material = null
}) {
    const mesh =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                width,
                height,
                depth
            ),
            material ||
                createMaterial(
                    color
                )
        );

    mesh.name =
        name;

    mesh.position.set(
        x,
        y,
        z
    );

    mesh.castShadow =
        false;

    mesh.receiveShadow =
        false;

    return mesh;
}

function distanceXZ(
    first,
    second
) {
    return Math.hypot(
        first.x -
            second.x,
        first.z -
            second.z
    );
}

export class Game {
    constructor(
        container,
        {
            onExit
        } = {}
    ) {
        this.container =
            container;

        this.onExit =
            onExit;

        this.scene = null;
        this.camera = null;
        this.renderer = null;

        this.clock =
            new THREE.Clock();

        this.animationFrameId =
            null;

        this.isRunning =
            false;

        this.keys =
            new Set();

        this.yaw = 0;
        this.pitch = 0;

        this.playerVelocityY =
            0;

        this.playerGrounded =
            true;

        this.stamina =
            MAX_STAMINA;

        this.elapsedTime =
            0;

        this.remainingTime =
            MATCH_DURATION_SECONDS;

        this.repairedTerminalCount =
            0;

        this.terminals = [];
        this.walls = [];
        this.obstacles = [];

        this.exitGate = null;

        this.currentInteraction =
            null;

        this.interactionProgress =
            0;

        this.enemy = null;

        this.enemyState =
            "PATROL";

        this.enemyPatrolIndex =
            0;

        this.enemyPatrolPoints = [];

        this.matchEnded =
            false;

        this.paused =
            false;

        this.hudRoot = null;
        this.hudElements = {};

        this.pauseRoot = null;
        this.resultRoot = null;

        this.forwardVector =
            new THREE.Vector3();

        this.rightVector =
            new THREE.Vector3();

        this.moveVector =
            new THREE.Vector3();

        this.animate =
            this.animate.bind(this);

        this.handleResize =
            this.handleResize.bind(this);

        this.handleKeyDown =
            this.handleKeyDown.bind(this);

        this.handleKeyUp =
            this.handleKeyUp.bind(this);

        this.handleMouseMove =
            this.handleMouseMove.bind(this);

        this.handleCanvasClick =
            this.handleCanvasClick.bind(this);

        this.handlePointerLockChange =
            this.handlePointerLockChange.bind(this);
    }

    start() {
        if (this.isRunning) {
            return;
        }

        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createLights();
        this.createFacility();
        this.createTerminals();
        this.createExitGate();
        this.createEnemy();
        this.createHUD();
        this.bindEvents();

        this.isRunning =
            true;

        this.clock.start();
        this.animate();
    }

    createScene() {
        this.scene =
            new THREE.Scene();

        this.scene.background =
            new THREE.Color(
                0x09131b
            );

        this.scene.fog =
            new THREE.Fog(
                0x09131b,
                22,
                92
            );
    }

    createCamera() {
        const width =
            Math.max(
                this.container
                    .clientWidth,
                1
            );

        const height =
            Math.max(
                this.container
                    .clientHeight,
                1
            );

        this.camera =
            new THREE.PerspectiveCamera(
                72,
                width / height,
                0.08,
                260
            );

        this.camera.position.set(
            0,
            PLAYER_HEIGHT,
            22
        );

        this.camera.rotation.order =
            "YXZ";
    }

    createRenderer() {
        this.renderer =
            new THREE.WebGLRenderer({
                antialias: true,
                powerPreference:
                    "high-performance"
            });

        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );

        this.renderer.setSize(
            this.container
                .clientWidth,
            this.container
                .clientHeight,
            false
        );

        this.renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        this.container.appendChild(
            this.renderer.domElement
        );
    }

    createLights() {
        const hemisphereLight =
            new THREE.HemisphereLight(
                0x54758c,
                0x101518,
                1.15
            );

        this.scene.add(
            hemisphereLight
        );

        const mainLight =
            new THREE.DirectionalLight(
                0x9dcde7,
                1.15
            );

        mainLight.position.set(
            18,
            30,
            12
        );

        this.scene.add(
            mainLight
        );

        const emergencyLight =
            new THREE.PointLight(
                0xff3131,
                2.2,
                28,
                2
            );

        emergencyLight.position.set(
            0,
            5.5,
            0
        );

        this.scene.add(
            emergencyLight
        );
    }

    createFacility() {
        const floor =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    96,
                    96
                ),
                createMaterial(
                    0x20282d,
                    {
                        roughness: 0.96
                    }
                )
            );

        floor.name =
            "FacilityFloor";

        floor.rotation.x =
            -Math.PI / 2;

        this.scene.add(
            floor
        );

        this.addWall(
            0,
            2.5,
            -45,
            90,
            5,
            1
        );

        this.addWall(
            0,
            2.5,
            45,
            90,
            5,
            1
        );

        this.addWall(
            -45,
            2.5,
            0,
            1,
            5,
            90
        );

        this.addWall(
            45,
            2.5,
            0,
            1,
            5,
            90
        );

        const wallSegments = [
            [-24, -26, 1, 5, 28],
            [-24, 20, 1, 5, 34],
            [24, -20, 1, 5, 34],
            [24, 28, 1, 5, 20],

            [-10, -14, 28, 5, 1],
            [12, 10, 24, 5, 1],
            [-15, 31, 30, 5, 1],
            [22, -34, 25, 5, 1],

            [-36, 0, 18, 5, 1],
            [35, 4, 20, 5, 1]
        ];

        for (
            const [
                x,
                z,
                width,
                height,
                depth
            ] of wallSegments
        ) {
            this.addWall(
                x,
                height / 2,
                z,
                width,
                height,
                depth
            );
        }

        const obstaclePositions = [
            [-35, -31],
            [-31, -31],
            [-35, -27],
            [33, 32],
            [29, 32],
            [33, 28],
            [5, -25],
            [9, -25],
            [5, -21],
            [-7, 20],
            [-3, 20],
            [14, 24],
            [18, 24]
        ];

        for (
            const [
                x,
                z
            ] of obstaclePositions
        ) {
            this.addObstacle(
                x,
                z
            );
        }

        this.createCeilingLights();
    }

    addWall(
        x,
        y,
        z,
        width,
        height,
        depth
    ) {
        const wall =
            createBox({
                name:
                    "FacilityWall",

                width,
                height,
                depth,

                x,
                y,
                z,

                color:
                    0x354047
            });

        this.scene.add(
            wall
        );

        this.walls.push(
            wall
        );
    }

    addObstacle(
        x,
        z
    ) {
        const obstacle =
            createBox({
                name:
                    "FacilityCrate",

                width:
                    3.2,

                height:
                    2.5,

                depth:
                    3.2,

                x,
                y:
                    1.25,

                z,

                color:
                    0x555448
            });

        this.scene.add(
            obstacle
        );

        this.obstacles.push(
            obstacle
        );
    }

    createCeilingLights() {
        const fixtureMaterial =
            createMaterial(
                0xced8dc,
                {
                    emissive:
                        0x6ca1b8,

                    emissiveIntensity:
                        0.52
                }
            );

        const positions = [
            [-32, -34],
            [-12, -34],
            [10, -34],
            [32, -34],

            [-32, -12],
            [-8, -12],
            [16, -12],
            [36, -12],

            [-34, 12],
            [-12, 12],
            [12, 12],
            [34, 12],

            [-32, 34],
            [-10, 34],
            [12, 34],
            [34, 34]
        ];

        for (
            const [
                x,
                z
            ] of positions
        ) {
            const fixture =
                createBox({
                    name:
                        "CeilingLight",

                    width:
                        3.8,

                    height:
                        0.12,

                    depth:
                        0.65,

                    x,
                    y:
                        5.1,

                    z,

                    material:
                        fixtureMaterial
                });

            this.scene.add(
                fixture
            );
        }
    }

    createTerminals() {
        const positions = [
            [-34, 0],
            [34, -25],
            [9, 34]
        ];

        positions.forEach(
            (
                [
                    x,
                    z
                ],
                index
            ) => {
                const terminal =
                    new THREE.Group();

                terminal.name =
                    `RepairTerminal${index + 1}`;

                terminal.position.set(
                    x,
                    0,
                    z
                );

                const body =
                    createBox({
                        name:
                            "TerminalBody",

                        width:
                            1.8,

                        height:
                            2.3,

                        depth:
                            1.1,

                        x:
                            0,

                        y:
                            1.15,

                        z:
                            0,

                        color:
                            0x27333a
                    });

                const screenMaterial =
                    createMaterial(
                        0x673125,
                        {
                            emissive:
                                0xff3e25,

                            emissiveIntensity:
                                1.1
                        }
                    );

                const screen =
                    createBox({
                        name:
                            "TerminalScreen",

                        width:
                            1.2,

                        height:
                            0.72,

                        depth:
                            0.08,

                        x:
                            0,

                        y:
                            1.55,

                        z:
                            -0.58,

                        material:
                            screenMaterial
                    });

                terminal.add(
                    body,
                    screen
                );

                terminal.userData = {
                    repaired: false,
                    repairProgress: 0,
                    screenMaterial
                };

                this.scene.add(
                    terminal
                );

                this.terminals.push(
                    terminal
                );
            }
        );
    }

    createExitGate() {
        this.exitGate =
            new THREE.Group();

        this.exitGate.name =
            "ExitGate";

        this.exitGate.position.set(
            0,
            0,
            -43.7
        );

        const frameMaterial =
            createMaterial(
                0x46545c,
                {
                    metalness:
                        0.45
                }
            );

        const leftFrame =
            createBox({
                name:
                    "ExitFrame",

                width:
                    1,

                height:
                    5,

                depth:
                    1,

                x:
                    -3.4,

                y:
                    2.5,

                z:
                    0,

                material:
                    frameMaterial
            });

        const rightFrame =
            createBox({
                name:
                    "ExitFrame",

                width:
                    1,

                height:
                    5,

                depth:
                    1,

                x:
                    3.4,

                y:
                    2.5,

                z:
                    0,

                material:
                    frameMaterial
            });

        const topFrame =
            createBox({
                name:
                    "ExitFrame",

                width:
                    7.8,

                height:
                    1,

                depth:
                    1,

                x:
                    0,

                y:
                    4.5,

                z:
                    0,

                material:
                    frameMaterial
            });

        const gateMaterial =
            createMaterial(
                0x551b1b,
                {
                    emissive:
                        0xaa1818,

                    emissiveIntensity:
                        0.44
                }
            );

        const gate =
            createBox({
                name:
                    "ExitDoor",

                width:
                    5.8,

                height:
                    4,

                depth:
                    0.5,

                x:
                    0,

                y:
                    2,

                z:
                    0,

                material:
                    gateMaterial
            });

        this.exitGate.add(
            leftFrame,
            rightFrame,
            topFrame,
            gate
        );

        this.exitGate.userData = {
            open: false,
            gate,
            gateMaterial
        };

        this.scene.add(
            this.exitGate
        );
    }

    createEnemy() {
        this.enemy =
            new THREE.Group();

        this.enemy.name =
            "ThePursuer";

        const bodyMaterial =
            createMaterial(
                0x141719,
                {
                    roughness:
                        0.88
                }
            );

        const body =
            new THREE.Mesh(
                new THREE.CapsuleGeometry(
                    0.62,
                    1.8,
                    6,
                    10
                ),
                bodyMaterial
            );

        body.position.y =
            1.65;

        const head =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.48,
                    14,
                    10
                ),
                bodyMaterial
            );

        head.position.y =
            3.32;

        const eyeMaterial =
            new THREE.MeshBasicMaterial({
                color:
                    0xff3333
            });

        const leftEye =
            new THREE.Mesh(
                new THREE.SphereGeometry(
                    0.06,
                    8,
                    6
                ),
                eyeMaterial
            );

        leftEye.position.set(
            -0.17,
            3.38,
            -0.44
        );

        const rightEye =
            leftEye.clone();

        rightEye.position.x =
            0.17;

        const eyeGlow =
            new THREE.PointLight(
                0xff0000,
                1.8,
                8,
                2
            );

        eyeGlow.position.set(
            0,
            3.3,
            -0.4
        );

        this.enemy.add(
            body,
            head,
            leftEye,
            rightEye,
            eyeGlow
        );

        this.enemy.position.set(
            -30,
            0,
            -30
        );

        this.scene.add(
            this.enemy
        );

        this.enemyPatrolPoints = [
            new THREE.Vector3(
                -30,
                0,
                -30
            ),
            new THREE.Vector3(
                30,
                0,
                -30
            ),
            new THREE.Vector3(
                30,
                0,
                25
            ),
            new THREE.Vector3(
                -30,
                0,
                25
            ),
            new THREE.Vector3(
                0,
                0,
                5
            )
        ];
    }

    createHUD() {
        this.hudRoot =
            document.createElement(
                "div"
            );

        this.hudRoot.className =
            "game-hud";

        this.hudRoot.innerHTML = `
            <div class="game-hud__top-left">
                <section class="hud-panel">
                    <div class="hud-title">
                        RUN FOR LIVE
                    </div>

                    <div class="hud-row">
                        <span>TIME</span>
                        <strong data-time>
                            10:00
                        </strong>
                    </div>

                    <div class="hud-row">
                        <span>TERMINALS</span>
                        <strong data-terminals>
                            0 / 3
                        </strong>
                    </div>

                    <div class="hud-row">
                        <span>THREAT</span>
                        <strong data-threat>
                            SEARCHING
                        </strong>
                    </div>

                    <div class="hud-row">
                        <span>STAMINA</span>
                        <strong data-stamina>
                            100%
                        </strong>
                    </div>

                    <div class="stamina-track">
                        <div
                            class="stamina-fill"
                            data-stamina-fill
                        ></div>
                    </div>
                </section>

                <section
                    class="hud-panel"
                    data-repair-panel
                    hidden
                >
                    <div class="hud-row">
                        <span>RESTORING</span>
                        <strong data-repair-value>
                            0%
                        </strong>
                    </div>

                    <div class="repair-track">
                        <div
                            class="repair-fill"
                            data-repair-fill
                        ></div>
                    </div>
                </section>
            </div>

            <div class="crosshair"></div>

            <div
                class="danger-warning"
                data-danger
            >
                PURSUER DETECTED
            </div>

            <div
                class="interaction-prompt"
                data-interaction-prompt
            ></div>
        `;

        document.body.appendChild(
            this.hudRoot
        );

        this.hudElements = {
            time:
                this.hudRoot.querySelector(
                    "[data-time]"
                ),

            terminals:
                this.hudRoot.querySelector(
                    "[data-terminals]"
                ),

            threat:
                this.hudRoot.querySelector(
                    "[data-threat]"
                ),

            stamina:
                this.hudRoot.querySelector(
                    "[data-stamina]"
                ),

            staminaFill:
                this.hudRoot.querySelector(
                    "[data-stamina-fill]"
                ),

            repairPanel:
                this.hudRoot.querySelector(
                    "[data-repair-panel]"
                ),

            repairValue:
                this.hudRoot.querySelector(
                    "[data-repair-value]"
                ),

            repairFill:
                this.hudRoot.querySelector(
                    "[data-repair-fill]"
                ),

            danger:
                this.hudRoot.querySelector(
                    "[data-danger]"
                ),

            interactionPrompt:
                this.hudRoot.querySelector(
                    "[data-interaction-prompt]"
                )
        };
    }

    bindEvents() {
        window.addEventListener(
            "resize",
            this.handleResize
        );

        window.addEventListener(
            "keydown",
            this.handleKeyDown
        );

        window.addEventListener(
            "keyup",
            this.handleKeyUp
        );

        window.addEventListener(
            "mousemove",
            this.handleMouseMove
        );

        this.renderer.domElement
            .addEventListener(
                "click",
                this.handleCanvasClick
            );

        document.addEventListener(
            "pointerlockchange",
            this.handlePointerLockChange
        );
    }

    handleCanvasClick() {
        if (
            this.matchEnded ||
            this.paused
        ) {
            return;
        }

        if (
            document.pointerLockElement !==
            this.renderer.domElement
        ) {
            this.renderer.domElement
                .requestPointerLock?.();
        }
    }

    handlePointerLockChange() {
        if (
            document.pointerLockElement !==
                this.renderer.domElement &&
            !this.matchEnded &&
            !this.paused &&
            this.isRunning
        ) {
            this.setPaused(
                true
            );
        }
    }

    handleMouseMove(
        event
    ) {
        if (
            document.pointerLockElement !==
                this.renderer.domElement ||
            this.paused ||
            this.matchEnded
        ) {
            return;
        }

        this.yaw -=
            event.movementX *
            0.0023;

        this.pitch -=
            event.movementY *
            0.0023;

        this.pitch =
            THREE.MathUtils.clamp(
                this.pitch,
                -1.48,
                1.48
            );
    }

    handleKeyDown(
        event
    ) {
        const controlledKeys = [
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "KeyR",
            "KeyE",
            "ShiftLeft",
            "ShiftRight",
            "Escape"
        ];

        if (
            controlledKeys.includes(
                event.code
            )
        ) {
            event.preventDefault();
        }

        if (
            event.code ===
                "Escape" &&
            !event.repeat
        ) {
            this.setPaused(
                !this.paused
            );

            return;
        }

        this.keys.add(
            event.code
        );
    }

    handleKeyUp(
        event
    ) {
        this.keys.delete(
            event.code
        );

        if (
            event.code ===
            "KeyE"
        ) {
            this.interactionProgress =
                0;
        }
    }

    updatePlayer(
        deltaTime
    ) {
        if (
            this.paused ||
            this.matchEnded
        ) {
            return;
        }

        let forwardInput =
            0;

        let sideInput =
            0;

        if (
            this.keys.has(
                "KeyW"
            )
        ) {
            forwardInput +=
                1;
        }

        if (
            this.keys.has(
                "KeyS"
            )
        ) {
            forwardInput -=
                1;
        }

        if (
            this.keys.has(
                "KeyA"
            )
        ) {
            sideInput -=
                1;
        }

        if (
            this.keys.has(
                "KeyD"
            )
        ) {
            sideInput +=
                1;
        }

        const sneaking =
            this.keys.has(
                "ShiftLeft"
            ) ||
            this.keys.has(
                "ShiftRight"
            );

        const sprintRequested =
            this.keys.has(
                "KeyW"
            ) &&
            this.keys.has(
                "KeyR"
            );

        const sprinting =
            sprintRequested &&
            !sneaking &&
            this.stamina > 0 &&
            forwardInput > 0;

        let speed =
            WALK_SPEED;

        if (sneaking) {
            speed =
                SNEAK_SPEED;
        } else if (
            sprinting
        ) {
            speed =
                SPRINT_SPEED;
        }

        if (sprinting) {
            this.stamina =
                Math.max(
                    0,
                    this.stamina -
                        STAMINA_DRAIN_RATE *
                        deltaTime
                );
        } else {
            this.stamina =
                Math.min(
                    MAX_STAMINA,
                    this.stamina +
                        STAMINA_RECOVERY_RATE *
                        deltaTime
                );
        }

        const inputLength =
            Math.hypot(
                forwardInput,
                sideInput
            );

        if (inputLength > 1) {
            forwardInput /=
                inputLength;

            sideInput /=
                inputLength;
        }

        this.forwardVector.set(
            Math.sin(
                this.yaw
            ),
            0,
            Math.cos(
                this.yaw
            )
        );

        this.rightVector.set(
            -this.forwardVector.z,
            0,
            this.forwardVector.x
        );

        this.moveVector.set(
            0,
            0,
            0
        );

        this.moveVector
            .addScaledVector(
                this.forwardVector,
                forwardInput
            )
            .addScaledVector(
                this.rightVector,
                sideInput
            );

        if (
            this.moveVector
                .lengthSq() >
            0
        ) {
            this.moveVector
                .normalize()
                .multiplyScalar(
                    speed *
                    deltaTime
                );
        }

        const nextX =
            this.camera.position.x +
            this.moveVector.x;

        const nextZ =
            this.camera.position.z +
            this.moveVector.z;

        if (
            !this.collides(
                nextX,
                this.camera.position.z
            )
        ) {
            this.camera.position.x =
                nextX;
        }

        if (
            !this.collides(
                this.camera.position.x,
                nextZ
            )
        ) {
            this.camera.position.z =
                nextZ;
        }

        this.camera.rotation.set(
            this.pitch,
            this.yaw,
            0,
            "YXZ"
        );
    }

    collides(
        x,
        z
    ) {
        const colliders = [
            ...this.walls,
            ...this.obstacles
        ];

        for (
            const collider of
            colliders
        ) {
            const geometry =
                collider.geometry;

            geometry.computeBoundingBox();

            const boundingBox =
                geometry.boundingBox
                    .clone();

            boundingBox.applyMatrix4(
                collider.matrixWorld
            );

            if (
                x +
                    PLAYER_RADIUS >
                    boundingBox.min.x &&
                x -
                    PLAYER_RADIUS <
                    boundingBox.max.x &&
                z +
                    PLAYER_RADIUS >
                    boundingBox.min.z &&
                z -
                    PLAYER_RADIUS <
                    boundingBox.max.z
            ) {
                return true;
            }
        }

        return false;
    }

    updateInteraction(
        deltaTime
    ) {
        if (
            this.paused ||
            this.matchEnded
        ) {
            return;
        }

        const nearestTerminal =
            this.findNearestTerminal();

        const distanceToGate =
            distanceXZ(
                this.camera.position,
                this.exitGate.position
            );

        this.currentInteraction =
            null;

        if (
            nearestTerminal &&
            !nearestTerminal
                .userData
                .repaired
        ) {
            this.currentInteraction = {
                type:
                    "TERMINAL",

                object:
                    nearestTerminal
            };

            this.setInteractionPrompt(
                "HOLD E TO RESTORE TERMINAL"
            );
        } else if (
            distanceToGate <=
            INTERACTION_DISTANCE +
                1.3
        ) {
            this.currentInteraction = {
                type:
                    "EXIT",

                object:
                    this.exitGate
            };

            if (
                this.exitGate
                    .userData
                    .open
            ) {
                this.setInteractionPrompt(
                    "PRESS E TO ESCAPE"
                );
            } else {
                this.setInteractionPrompt(
                    `${REQUIRED_TERMINALS - this.repairedTerminalCount} TERMINALS REMAINING`
                );
            }
        } else {
            this.setInteractionPrompt(
                null
            );
        }

        if (
            !this.currentInteraction ||
            !this.keys.has(
                "KeyE"
            )
        ) {
            this.interactionProgress =
                0;

            this.hudElements
                .repairPanel
                .hidden =
                true;

            return;
        }

        if (
            this.currentInteraction
                .type ===
            "TERMINAL"
        ) {
            this.interactionProgress +=
                deltaTime;

            const progress =
                THREE.MathUtils.clamp(
                    this.interactionProgress /
                        TERMINAL_REPAIR_TIME,
                    0,
                    1
                );

            this.hudElements
                .repairPanel
                .hidden =
                false;

            this.hudElements
                .repairValue
                .textContent =
                `${Math.round(
                    progress *
                        100
                )}%`;

            this.hudElements
                .repairFill
                .style.width =
                `${progress * 100}%`;

            if (progress >= 1) {
                this.repairTerminal(
                    this.currentInteraction
                        .object
                );

                this.interactionProgress =
                    0;
            }
        }

        if (
            this.currentInteraction
                .type ===
                "EXIT" &&
            this.exitGate
                .userData
                .open
        ) {
            this.endMatch(
                "ESCAPED"
            );
        }
    }

    findNearestTerminal() {
        let nearest =
            null;

        let nearestDistance =
            INTERACTION_DISTANCE;

        for (
            const terminal of
            this.terminals
        ) {
            const distance =
                distanceXZ(
                    this.camera
                        .position,
                    terminal
                        .position
                );

            if (
                distance <=
                nearestDistance
            ) {
                nearest =
                    terminal;

                nearestDistance =
                    distance;
            }
        }

        return nearest;
    }

    repairTerminal(
        terminal
    ) {
        if (
            terminal.userData
                .repaired
        ) {
            return;
        }

        terminal.userData.repaired =
            true;

        terminal.userData
            .screenMaterial
            .color.set(
                0x1f7041
            );

        terminal.userData
            .screenMaterial
            .emissive.set(
                0x24ff77
            );

        terminal.userData
            .screenMaterial
            .emissiveIntensity =
            1.75;

        this.repairedTerminalCount +=
            1;

        if (
            this.repairedTerminalCount >=
            REQUIRED_TERMINALS
        ) {
            this.openExitGate();
        }
    }

    openExitGate() {
        if (
            this.exitGate
                .userData
                .open
        ) {
            return;
        }

        this.exitGate.userData.open =
            true;

        this.exitGate.userData
            .gate
            .visible =
            false;

        this.exitGate.userData
            .gateMaterial
            .color.set(
                0x1f7343
            );

        this.exitGate.userData
            .gateMaterial
            .emissive.set(
                0x21ff78
            );
    }

    updateEnemy(
        deltaTime
    ) {
        if (
            this.paused ||
            this.matchEnded
        ) {
            return;
        }

        const distanceToPlayer =
            distanceXZ(
                this.enemy.position,
                this.camera.position
            );

        const playerSneaking =
            this.keys.has(
                "ShiftLeft"
            ) ||
            this.keys.has(
                "ShiftRight"
            );

        const detectionDistance =
            playerSneaking
                ? 9
                : this.keys.has(
                    "KeyR"
                )
                    ? 24
                    : 16;

        if (
            distanceToPlayer <=
            detectionDistance
        ) {
            this.enemyState =
                "CHASE";
        } else if (
            distanceToPlayer >
            30
        ) {
            this.enemyState =
                "PATROL";
        }

        let target =
            null;

        let speed =
            2.1;

        if (
            this.enemyState ===
            "CHASE"
        ) {
            target =
                this.camera.position;

            speed =
                4.85;
        } else {
            target =
                this.enemyPatrolPoints[
                    this.enemyPatrolIndex
                ];

            if (
                distanceXZ(
                    this.enemy.position,
                    target
                ) <
                1.2
            ) {
                this.enemyPatrolIndex =
                    (
                        this.enemyPatrolIndex +
                        1
                    ) %
                    this.enemyPatrolPoints
                        .length;

                target =
                    this.enemyPatrolPoints[
                        this.enemyPatrolIndex
                    ];
            }
        }

        const direction =
            new THREE.Vector3(
                target.x -
                    this.enemy
                        .position.x,
                0,
                target.z -
                    this.enemy
                        .position.z
            );

        if (
            direction.lengthSq() >
            0.001
        ) {
            direction.normalize();

            this.enemy.position.addScaledVector(
                direction,
                speed *
                    deltaTime
            );

            this.enemy.rotation.y =
                Math.atan2(
                    direction.x,
                    direction.z
                );
        }

        if (
            distanceToPlayer <
            1.2
        ) {
            this.endMatch(
                "CAUGHT"
            );
        }
    }

    updateTimer(
        deltaTime
    ) {
        if (
            this.paused ||
            this.matchEnded
        ) {
            return;
        }

        this.elapsedTime +=
            deltaTime;

        this.remainingTime =
            Math.max(
                0,
                MATCH_DURATION_SECONDS -
                    this.elapsedTime
            );

        if (
            this.remainingTime <=
            0
        ) {
            this.endMatch(
                "TIME_EXPIRED"
            );
        }
    }

    updateHUD() {
        const minutes =
            Math.floor(
                this.remainingTime /
                    60
            );

        const seconds =
            Math.floor(
                this.remainingTime %
                    60
            );

        this.hudElements
            .time
            .textContent =
            `${String(
                minutes
            ).padStart(
                2,
                "0"
            )}:${String(
                seconds
            ).padStart(
                2,
                "0"
            )}`;

        this.hudElements
            .terminals
            .textContent =
            `${this.repairedTerminalCount} / ${REQUIRED_TERMINALS}`;

        this.hudElements
            .threat
            .textContent =
            this.enemyState;

        this.hudElements
            .threat
            .style.color =
            this.enemyState ===
            "CHASE"
                ? "#ff5d5d"
                : "#ffffff";

        const staminaPercent =
            Math.round(
                (
                    this.stamina /
                    MAX_STAMINA
                ) *
                100
            );

        this.hudElements
            .stamina
            .textContent =
            `${staminaPercent}%`;

        this.hudElements
            .staminaFill
            .style.width =
            `${staminaPercent}%`;

        this.hudElements
            .danger
            .classList.toggle(
                "visible",
                this.enemyState ===
                    "CHASE"
            );
    }

    setInteractionPrompt(
        message
    ) {
        const prompt =
            this.hudElements
                .interactionPrompt;

        prompt.textContent =
            message || "";

        prompt.classList.toggle(
            "visible",
            Boolean(
                message
            )
        );
    }

    setPaused(
        value
    ) {
        if (
            this.matchEnded
        ) {
            return;
        }

        this.paused =
            value;

        if (value) {
            document.exitPointerLock?.();
            this.showPauseScreen();
        } else {
            this.hidePauseScreen();

            this.renderer.domElement
                .requestPointerLock?.();
        }
    }

    showPauseScreen() {
        this.hidePauseScreen();

        this.pauseRoot =
            document.createElement(
                "section"
            );

        this.pauseRoot.className =
            "overlay-screen";

        this.pauseRoot.innerHTML = `
            <article class="pause-panel">
                <p class="eyebrow">
                    RUN FOR LIVE
                </p>

                <h1>
                    PAUSED
                </h1>

                <div class="panel-actions">
                    <button
                        class="menu-button menu-button--primary"
                        data-resume
                    >
                        RESUME
                    </button>

                    <button
                        class="menu-button"
                        data-quit
                    >
                        BACK TO MENU
                    </button>
                </div>
            </article>
        `;

        document.body.appendChild(
            this.pauseRoot
        );

        this.pauseRoot
            .querySelector(
                "[data-resume]"
            )
            .addEventListener(
                "click",
                () => {
                    this.setPaused(
                        false
                    );
                }
            );

        this.pauseRoot
            .querySelector(
                "[data-quit]"
            )
            .addEventListener(
                "click",
                () => {
                    this.stop();
                    this.onExit?.();
                }
            );
    }

    hidePauseScreen() {
        this.pauseRoot?.remove();
        this.pauseRoot = null;
    }

    endMatch(
        result
    ) {
        if (
            this.matchEnded
        ) {
            return;
        }

        this.matchEnded =
            true;

        document.exitPointerLock?.();

        let title =
            "CAUGHT";

        let description =
            "The pursuer reached you before the facility could be escaped.";

        let success =
            false;

        if (
            result ===
            "ESCAPED"
        ) {
            title =
                "ESCAPED";

            description =
                "The facility systems were restored and the exit was reached.";

            success =
                true;
        }

        if (
            result ===
            "TIME_EXPIRED"
        ) {
            title =
                "TIME EXPIRED";

            description =
                "The facility entered lockdown before the escape was completed.";
        }

        this.resultRoot =
            document.createElement(
                "section"
            );

        this.resultRoot.className =
            "overlay-screen";

        this.resultRoot.innerHTML = `
            <article
                class="
                    result-panel
                    ${
                        success
                            ? "result-panel--success"
                            : "result-panel--failure"
                    }
                "
            >
                <p class="eyebrow">
                    RUN FOR LIVE
                </p>

                <h1>
                    ${title}
                </h1>

                <p>
                    ${description}
                </p>

                <div class="result-stats">
                    <div>
                        <span>TERMINALS</span>

                        <strong>
                            ${this.repairedTerminalCount} / ${REQUIRED_TERMINALS}
                        </strong>
                    </div>

                    <div>
                        <span>SURVIVAL TIME</span>

                        <strong>
                            ${Math.floor(this.elapsedTime)} SEC
                        </strong>
                    </div>
                </div>

                <div class="panel-actions">
                    <button
                        class="menu-button menu-button--primary"
                        data-retry
                    >
                        RETRY
                    </button>

                    <button
                        class="menu-button"
                        data-menu
                    >
                        BACK TO MENU
                    </button>
                </div>
            </article>
        `;

        document.body.appendChild(
            this.resultRoot
        );

        this.resultRoot
            .querySelector(
                "[data-retry]"
            )
            .addEventListener(
                "click",
                () => {
                    this.stop();

                    const newGame =
                        new Game(
                            this.container,
                            {
                                onExit:
                                    this.onExit
                            }
                        );

                    newGame.start();
                }
            );

        this.resultRoot
            .querySelector(
                "[data-menu]"
            )
            .addEventListener(
                "click",
                () => {
                    this.stop();
                    this.onExit?.();
                }
            );
    }

    update(
        deltaTime
    ) {
        this.updatePlayer(
            deltaTime
        );

        this.updateInteraction(
            deltaTime
        );

        this.updateEnemy(
            deltaTime
        );

        this.updateTimer(
            deltaTime
        );

        this.updateHUD();
    }

    animate() {
        if (
            !this.isRunning
        ) {
            return;
        }

        this.animationFrameId =
            window.requestAnimationFrame(
                this.animate
            );

        const deltaTime =
            Math.min(
                this.clock.getDelta(),
                1 / 20
            );

        this.update(
            deltaTime
        );

        this.renderer.render(
            this.scene,
            this.camera
        );
    }

    handleResize() {
        if (
            !this.camera ||
            !this.renderer
        ) {
            return;
        }

        const width =
            Math.max(
                this.container
                    .clientWidth,
                1
            );

        const height =
            Math.max(
                this.container
                    .clientHeight,
                1
            );

        this.camera.aspect =
            width / height;

        this.camera
            .updateProjectionMatrix();

        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio,
                2
            )
        );

        this.renderer.setSize(
            width,
            height,
            false
        );
    }

    stop() {
        if (
            !this.isRunning
        ) {
            return;
        }

        this.isRunning =
            false;

        if (
            this.animationFrameId !==
            null
        ) {
            window.cancelAnimationFrame(
                this.animationFrameId
            );
        }

        window.removeEventListener(
            "resize",
            this.handleResize
        );

        window.removeEventListener(
            "keydown",
            this.handleKeyDown
        );

        window.removeEventListener(
            "keyup",
            this.handleKeyUp
        );

        window.removeEventListener(
            "mousemove",
            this.handleMouseMove
        );

        this.renderer
            ?.domElement
            .removeEventListener(
                "click",
                this.handleCanvasClick
            );

        document.removeEventListener(
            "pointerlockchange",
            this.handlePointerLockChange
        );

        document.exitPointerLock?.();

        this.keys.clear();
        this.clock.stop();

        this.hudRoot?.remove();
        this.pauseRoot?.remove();
        this.resultRoot?.remove();

        this.renderer?.dispose();
        this.renderer?.domElement.remove();

        this.hudRoot = null;
        this.pauseRoot = null;
        this.resultRoot = null;

        this.renderer = null;
        this.camera = null;
        this.scene = null;
    }
}
