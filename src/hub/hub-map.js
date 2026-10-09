import * as THREE from "three";

const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.12,
    ...extra
});

const box = (scene, size, position, color, extra) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, extra));
    mesh.position.set(...position);
    scene.add(mesh);
    return mesh;
};

export function buildHub(scene) {
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(42, 48),
        material(0x17232b)
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(17, 19, 48),
        material(0x1c9bd1, { emissive: 0x083f5d, emissiveIntensity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        box(scene, [1.2, 5, 1.2], [Math.cos(angle) * 38, 2.5, Math.sin(angle) * 38], 0x2b3f49);
    }

    const portals = [
        { id: "PLAY", label: "PLAY", position: new THREE.Vector3(0, 0, -24), color: 0x2cd6ff },
        { id: "LEADERBOARD", label: "LEADERBOARD", position: new THREE.Vector3(-22, 0, 6), color: 0xffc857 },
        { id: "STORE", label: "STORE", position: new THREE.Vector3(22, 0, 6), color: 0x9a7cff },
        { id: "PROFILE", label: "PROFILE", position: new THREE.Vector3(0, 0, 24), color: 0x6ce89c }
    ];

    for (const portal of portals) {
        const group = new THREE.Group();
        group.position.copy(portal.position);
        const pad = new THREE.Mesh(
            new THREE.CylinderGeometry(5, 5, 0.45, 24),
            material(portal.color, { emissive: portal.color, emissiveIntensity: 0.34 })
        );
        pad.position.y = 0.22;
        group.add(pad);
        const beacon = new THREE.PointLight(portal.color, 2, 14, 2);
        beacon.position.y = 2.4;
        group.add(beacon);
        group.userData = portal;
        scene.add(group);
    }

    return { portals };
}
