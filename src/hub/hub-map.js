import * as THREE from "three";

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.18,
    ...extra
});

function addBox(scene, size, position, color, extra = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, extra));
    mesh.position.set(...position);
    scene.add(mesh);
    return mesh;
}

function addTextSprite(text, color = "#ffffff", scale = [8, 2, 1]) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(3, 9, 14, 0.82)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = color;
    context.lineWidth = 10;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = color;
    context.font = "900 112px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(...scale);
    return sprite;
}

function createPortal(scene, definition) {
    const group = new THREE.Group();
    group.position.copy(definition.position);

    const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(4.8, 5.2, 0.5, 28),
        material(definition.color, {
            emissive: definition.color,
            emissiveIntensity: 0.35
        })
    );
    pad.position.y = 0.25;
    group.add(pad);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), material(0x334b5a, { metalness: 0.55 }));
    const right = left.clone();
    left.position.set(-3.8, 3, 0);
    right.position.set(3.8, 3, 0);
    group.add(left, right);

    const top = new THREE.Mesh(
        new THREE.BoxGeometry(8.4, 0.8, 0.8),
        material(definition.color, { emissive: definition.color, emissiveIntensity: 0.7 })
    );
    top.position.set(0, 5.7, 0);
    group.add(top);

    const label = addTextSprite(definition.label, `#${definition.color.toString(16).padStart(6, "0")}`, [7.5, 1.9, 1]);
    label.position.set(0, 7.2, 0);
    group.add(label);

    const glow = new THREE.PointLight(definition.color, 2.2, 18, 2);
    glow.position.y = 3;
    group.add(glow);

    group.userData = definition;
    scene.add(group);
    return group;
}

export function buildHub(scene) {
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(42, 64),
        material(0x18242d)
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const center = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 12, 0.65, 40),
        material(0x243844, { metalness: 0.32 })
    );
    center.position.y = 0.32;
    scene.add(center);

    const neonRing = new THREE.Mesh(
        new THREE.RingGeometry(12.5, 13, 64),
        material(0x24bffc, { emissive: 0x168aca, emissiveIntensity: 1.2 })
    );
    neonRing.rotation.x = -Math.PI / 2;
    neonRing.position.y = 0.68;
    scene.add(neonRing);

    const monument = new THREE.Group();
    monument.add(addTextSprite("RUN FOR LIVE", "#62d8ff", [15, 3.5, 1]));
    monument.position.set(0, 7.5, 0);
    scene.add(monument);

    const ceiling = new THREE.Mesh(
        new THREE.CylinderGeometry(41, 41, 0.8, 64),
        material(0x0d151c, { metalness: 0.35 })
    );
    ceiling.position.y = 12;
    scene.add(ceiling);

    const obstacles = [];
    for (let index = 0; index < 20; index += 1) {
        const angle = index / 20 * Math.PI * 2;
        const x = Math.cos(angle) * 39;
        const z = Math.sin(angle) * 39;
        const pillar = addBox(scene, [1.25, 11, 1.25], [x, 5.5, z], 0x29404c, { metalness: 0.42 });
        obstacles.push(pillar);
    }

    for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2;
        const light = new THREE.PointLight(index % 2 ? 0x3ecfff : 0x8b6cff, 1.3, 18, 2);
        light.position.set(Math.cos(angle) * 27, 7, Math.sin(angle) * 27);
        scene.add(light);
    }

    const definitions = [
        { id: "PLAY", label: "PLAY", position: new THREE.Vector3(0, 0, -27), color: 0x24c8ff },
        { id: "LEADERBOARD", label: "LEADERBOARD", position: new THREE.Vector3(-27, 0, 0), color: 0xffc84d },
        { id: "STORE", label: "STORE", position: new THREE.Vector3(27, 0, 0), color: 0x9d7cff },
        { id: "PROFILE", label: "PROFILE", position: new THREE.Vector3(0, 0, 27), color: 0x63e59b }
    ];
    const portals = definitions.map(definition => createPortal(scene, definition));

    const loungePositions = [
        [-15, 15], [15, 15], [-15, -15], [15, -15]
    ];
    for (const [x, z] of loungePositions) {
        const bench = addBox(scene, [7, 0.8, 2], [x, 0.55, z], 0x314550, { metalness: 0.25 });
        obstacles.push(bench);
    }

    scene.updateMatrixWorld(true);
    const collisionBounds = obstacles.map(object => {
        const bounds = new THREE.Box3().setFromObject(object);
        return {
            minX: bounds.min.x,
            maxX: bounds.max.x,
            minZ: bounds.min.z,
            maxZ: bounds.max.z
        };
    });

    return { portals, obstacles: collisionBounds };
}
