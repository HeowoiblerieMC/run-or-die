import * as THREE from "three";

function createMaterial(
    color,
    extra = {}
) {
    return new THREE
        .MeshStandardMaterial({
            color,
            roughness:
                0.7,
            metalness:
                0.2,
            ...extra
        });
}

function createTextSprite(
    text,
    color
) {
    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        1024;

    canvas.height =
        256;

    const context =
        canvas.getContext("2d");

    context.fillStyle =
        "#040b11dd";

    context.fillRect(
        0,
        0,
        1024,
        256
    );

    context.strokeStyle =
        color;

    context.lineWidth =
        10;

    context.strokeRect(
        8,
        8,
        1008,
        240
    );

    context.fillStyle =
        color;

    context.font =
        "900 108px system-ui";

    context.textAlign =
        "center";

    context.textBaseline =
        "middle";

    context.fillText(
        text,
        512,
        128
    );

    const texture =
        new THREE.CanvasTexture(
            canvas
        );

    texture.colorSpace =
        THREE.SRGBColorSpace;

    const sprite =
        new THREE.Sprite(
            new THREE
                .SpriteMaterial({
                    map:
                        texture,

                    transparent:
                        true
                })
        );

    sprite.scale.set(
        9,
        2.25,
        1
    );

    return sprite;
}

function createPortal(
    scene,
    id,
    x,
    z,
    color
) {
    const group =
        new THREE.Group();

    group.position.set(
        x,
        0,
        z
    );

    const platform =
        new THREE.Mesh(
            new THREE
                .CylinderGeometry(
                    5,
                    5.4,
                    0.5,
                    28
                ),

            createMaterial(
                color,
                {
                    emissive:
                        color,

                    emissiveIntensity:
                        0.35
                }
            )
        );

    platform.position.y =
        0.25;

    group.add(
        platform
    );

    for (
        const pillarX of
        [
            -4,
            4
        ]
    ) {
        const pillar =
            new THREE.Mesh(
                new THREE
                    .BoxGeometry(
                        0.8,
                        6,
                        0.8
                    ),

                createMaterial(
                    0x344c59
                )
            );

        pillar.position.set(
            pillarX,
            3,
            0
        );

        group.add(
            pillar
        );
    }

    const top =
        new THREE.Mesh(
            new THREE
                .BoxGeometry(
                    8.8,
                    0.8,
                    0.8
                ),

            createMaterial(
                color,
                {
                    emissive:
                        color,

                    emissiveIntensity:
                        0.8
                }
            )
        );

    top.position.y =
        5.7;

    group.add(
        top
    );

    const label =
        createTextSprite(
            id,
            `#${color
                .toString(16)
                .padStart(6, "0")}`
        );

    label.position.y =
        7.2;

    group.add(
        label
    );

    group.userData = {
        id,
        label:
            id
    };

    scene.add(
        group
    );

    return {
        id,
        label:
            id,
        position:
            group.position,
        object:
            group
    };
}

export function buildHub(
    scene
) {
    const floor =
        new THREE.Mesh(
            new THREE
                .CircleGeometry(
                    48,
                    64
                ),

            createMaterial(
                0x17242d
            )
        );

    floor.rotation.x =
        -Math.PI / 2;

    scene.add(
        floor
    );

    const roof =
        new THREE.Mesh(
            new THREE
                .CylinderGeometry(
                    47,
                    47,
                    0.8,
                    64
                ),

            createMaterial(
                0x0b1118
            )
        );

    roof.position.y =
        13;

    scene.add(
        roof
    );

    for (
        let index = 0;
        index < 24;
        index += 1
    ) {
        const angle =
            index /
            24 *
            Math.PI *
            2;

        const pillar =
            new THREE.Mesh(
                new THREE
                    .BoxGeometry(
                        1.2,
                        12,
                        1.2
                    ),

                createMaterial(
                    0x243b48
                )
            );

        pillar.position.set(
            Math.cos(angle) * 45,
            6,
            Math.sin(angle) * 45
        );

        scene.add(
            pillar
        );
    }

    const title =
        createTextSprite(
            "RUN FOR LIVE",
            "#62d8ff"
        );

    title.position.set(
        0,
        8,
        0
    );

    scene.add(
        title
    );

    return {
        portals: [
            createPortal(
                scene,
                "PLAY",
                0,
                -30,
                0x28cfff
            ),

            createPortal(
                scene,
                "LEADERBOARD",
                -30,
                0,
                0xffc84d
            ),

            createPortal(
                scene,
                "STORE",
                30,
                0,
                0xa47cff
            ),

            createPortal(
                scene,
                "PROFILE",
                0,
                30,
                0x62e59a
            )
        ],

        obstacles: []
    };
}
