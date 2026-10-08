import * as THREE from "three";

const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.08,
    ...options
});

function mesh(geometry, color, options = {}) {
    const object = new THREE.Mesh(geometry, material(color, options));
    object.castShadow = false;
    object.receiveShadow = false;
    return object;
}

function addPart(parent, object, name, position, rotation = [0, 0, 0]) {
    object.name = name;
    object.position.set(...position);
    object.rotation.set(...rotation);
    parent.add(object);
    return object;
}

function createHead({ skin = 0xcaa88f, mask = false } = {}) {
    const group = new THREE.Group();
    const skull = mesh(new THREE.SphereGeometry(0.31, 18, 14), skin);
    skull.scale.set(0.9, 1.08, 0.92);
    group.add(skull);

    if (mask) {
        const face = mesh(
            new THREE.SphereGeometry(0.32, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
            0x171a1d,
            { metalness: 0.5, roughness: 0.4 }
        );
        face.rotation.x = -0.08;
        face.position.z = -0.035;
        face.scale.set(0.92, 1.03, 0.72);
        group.add(face);

        const eyeMaterial = material(0xff2d24, {
            emissive: 0xff0800,
            emissiveIntensity: 2.4,
            roughness: 0.2
        });
        [-0.115, 0.115].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), eyeMaterial);
            eye.position.set(x, 0.065, -0.285);
            group.add(eye);
        });

        const mouth = mesh(new THREE.BoxGeometry(0.24, 0.035, 0.035), 0x050506, {
            emissive: 0x5d0000,
            emissiveIntensity: 0.7
        });
        mouth.position.set(0, -0.13, -0.295);
        group.add(mouth);
    } else {
        const hair = mesh(new THREE.SphereGeometry(0.316, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), 0x252321);
        hair.position.y = 0.055;
        group.add(hair);
    }
    return group;
}

function createHumanoid({
    jacketColor = 0x3e8fd1,
    trouserColor = 0x18232a,
    skinColor = 0xcaa88f,
    pursuer = false
} = {}) {
    const root = new THREE.Group();
    root.userData.parts = {};

    const hips = new THREE.Group();
    hips.position.y = pursuer ? 1.05 : 0.95;
    root.add(hips);
    root.userData.parts.hips = hips;

    const pelvis = mesh(new THREE.CapsuleGeometry(pursuer ? 0.36 : 0.31, 0.34, 5, 10), trouserColor);
    pelvis.rotation.z = Math.PI / 2;
    hips.add(pelvis);

    const torso = new THREE.Group();
    torso.position.y = pursuer ? 0.7 : 0.62;
    hips.add(torso);
    root.userData.parts.torso = torso;

    const chest = mesh(
        new THREE.CapsuleGeometry(pursuer ? 0.47 : 0.39, pursuer ? 0.74 : 0.62, 7, 12),
        pursuer ? 0x17191c : jacketColor,
        pursuer ? { metalness: 0.18, roughness: 0.58 } : {}
    );
    chest.scale.set(1.05, 1, 0.72);
    torso.add(chest);

    const vest = mesh(new THREE.BoxGeometry(pursuer ? 0.83 : 0.68, 0.72, 0.16), pursuer ? 0x262a2e : 0x202b31, {
        metalness: pursuer ? 0.3 : 0.08
    });
    vest.position.set(0, 0, -0.31);
    torso.add(vest);

    const neck = mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.2, 12), pursuer ? 0x24282c : skinColor);
    neck.position.y = pursuer ? 0.67 : 0.58;
    torso.add(neck);

    const head = createHead({ skin: skinColor, mask: pursuer });
    head.position.y = pursuer ? 0.97 : 0.86;
    torso.add(head);
    root.userData.parts.head = head;

    function limb(side, isArm) {
        const sign = side === "left" ? -1 : 1;
        const upper = new THREE.Group();
        const lower = new THREE.Group();
        const upperLength = isArm ? (pursuer ? 0.62 : 0.54) : (pursuer ? 0.76 : 0.67);
        const lowerLength = isArm ? (pursuer ? 0.58 : 0.5) : (pursuer ? 0.72 : 0.64);
        const radius = isArm ? (pursuer ? 0.16 : 0.13) : (pursuer ? 0.2 : 0.17);

        if (isArm) {
            upper.position.set(sign * (pursuer ? 0.57 : 0.47), pursuer ? 0.42 : 0.37, 0);
            torso.add(upper);
        } else {
            upper.position.set(sign * (pursuer ? 0.24 : 0.2), -0.2, 0);
            hips.add(upper);
        }

        const upperMesh = mesh(
            new THREE.CapsuleGeometry(radius, upperLength, 5, 9),
            isArm ? (pursuer ? 0x1b1e21 : jacketColor) : trouserColor
        );
        upperMesh.position.y = -upperLength * 0.52;
        upper.add(upperMesh);

        lower.position.y = -upperLength - 0.08;
        upper.add(lower);
        const lowerMesh = mesh(
            new THREE.CapsuleGeometry(radius * 0.88, lowerLength, 5, 9),
            isArm ? (pursuer ? 0x262a2d : 0x25343c) : 0x11191f
        );
        lowerMesh.position.y = -lowerLength * 0.5;
        lower.add(lowerMesh);

        if (isArm) {
            const hand = mesh(new THREE.SphereGeometry(radius * 0.82, 10, 8), pursuer ? 0x303438 : skinColor);
            hand.position.y = -lowerLength - 0.08;
            lower.add(hand);
        } else {
            const boot = mesh(new THREE.BoxGeometry(radius * 1.7, radius * 1.2, radius * 2.7), pursuer ? 0x090b0c : 0x10161a);
            boot.position.set(0, -lowerLength - 0.02, -radius * 0.62);
            lower.add(boot);
        }

        root.userData.parts[`${side}${isArm ? "Arm" : "Leg"}`] = upper;
        root.userData.parts[`${side}${isArm ? "Forearm" : "Shin"}`] = lower;
    }

    limb("left", true);
    limb("right", true);
    limb("left", false);
    limb("right", false);

    if (pursuer) {
        const shoulderBar = mesh(new THREE.BoxGeometry(1.28, 0.18, 0.36), 0x303438, { metalness: 0.45 });
        shoulderBar.position.y = 0.48;
        torso.add(shoulderBar);

        const backUnit = mesh(new THREE.BoxGeometry(0.72, 0.87, 0.24), 0x111417, { metalness: 0.35 });
        backUnit.position.set(0, 0.02, 0.43);
        torso.add(backUnit);

        const redCore = mesh(new THREE.SphereGeometry(0.11, 12, 10), 0xff1b12, {
            emissive: 0xff0800,
            emissiveIntensity: 2.5
        });
        redCore.position.set(0, 0.1, -0.42);
        torso.add(redCore);

        const blade = mesh(new THREE.BoxGeometry(0.08, 0.85, 0.18), 0x7f878b, {
            metalness: 0.9,
            roughness: 0.22
        });
        blade.position.set(0, -0.78, -0.08);
        root.userData.parts.rightForearm.add(blade);
    } else {
        const backpack = mesh(new THREE.BoxGeometry(0.55, 0.72, 0.24), 0x202a30);
        backpack.position.set(0, 0.03, 0.4);
        torso.add(backpack);
    }

    root.scale.setScalar(pursuer ? 1.18 : 1);
    return root;
}

export function createEscapee(options = {}) {
    return createHumanoid({ ...options, pursuer: false });
}

export function createPursuer(options = {}) {
    return createHumanoid({ ...options, pursuer: true });
}

export class CharacterAnimator {
    constructor(character) {
        this.character = character;
        this.time = Math.random() * Math.PI * 2;
    }

    update(deltaTime, { state = "IDLE", injured = false } = {}) {
        this.time += deltaTime;
        const parts = this.character.userData.parts || {};
        const moving = state === "WALK" || state === "CHASE" || state === "FLEE" || state === "RUN" || state === "ESCAPE";
        const running = state === "CHASE" || state === "FLEE" || state === "RUN" || state === "ESCAPE";
        const speed = running ? 10 : moving ? 6 : 2;
        const amount = running ? 0.78 : moving ? 0.46 : 0.035;
        const swing = Math.sin(this.time * speed) * amount;

        if (parts.leftLeg) parts.leftLeg.rotation.x = swing;
        if (parts.rightLeg) parts.rightLeg.rotation.x = -swing;
        if (parts.leftArm) parts.leftArm.rotation.x = -swing * 0.8;
        if (parts.rightArm) parts.rightArm.rotation.x = swing * 0.8;
        if (parts.leftShin) parts.leftShin.rotation.x = Math.max(0, -swing) * 0.42;
        if (parts.rightShin) parts.rightShin.rotation.x = Math.max(0, swing) * 0.42;
        if (parts.torso) {
            parts.torso.rotation.z = injured ? -0.12 : Math.sin(this.time * 2) * 0.012;
            parts.torso.position.y = (running ? Math.abs(Math.sin(this.time * speed)) * 0.055 : 0);
        }
        if (parts.head) parts.head.rotation.y = Math.sin(this.time * 0.75) * 0.08;
    }
}
