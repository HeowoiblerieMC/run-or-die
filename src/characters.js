import * as THREE from "three";

function standardMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.68,
        metalness: options.metalness ?? 0.08,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0
    });
}

function roundedBox(width, height, depth, radius, material) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;

    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: Math.min(radius * 0.45, 0.08),
        bevelThickness: Math.min(radius * 0.45, 0.08)
    });

    geometry.center();
    return new THREE.Mesh(geometry, material);
}

function limbMesh(radiusTop, radiusBottom, length, material) {
    const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(
            Math.max(radiusTop, radiusBottom),
            Math.max(0.08, length - radiusTop * 2),
            5,
            10
        ),
        material
    );
    mesh.position.y = -length / 2;
    return mesh;
}

function createArm(side, materials, armored = false) {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? "LeftArmPivot" : "RightArmPivot";

    const upperArm = limbMesh(
        armored ? 0.25 : 0.2,
        0.18,
        armored ? 1.15 : 1.02,
        armored ? materials.armor : materials.jacket
    );
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.name = side < 0 ? "LeftForearmPivot" : "RightForearmPivot";
    elbow.position.y = armored ? -1.05 : -0.94;

    const forearm = limbMesh(
        armored ? 0.22 : 0.17,
        0.14,
        armored ? 1.05 : 0.9,
        armored ? materials.darkArmor : materials.sleeve
    );
    elbow.add(forearm);

    const hand = new THREE.Mesh(
        new THREE.SphereGeometry(armored ? 0.2 : 0.16, 12, 8),
        armored ? materials.darkArmor : materials.skin
    );
    hand.scale.set(0.9, 1.2, 0.72);
    hand.position.y = armored ? -0.98 : -0.84;
    elbow.add(hand);

    shoulder.add(elbow);
    shoulder.userData.elbow = elbow;
    return shoulder;
}

function createLeg(side, materials, armored = false) {
    const hip = new THREE.Group();
    hip.name = side < 0 ? "LeftLegPivot" : "RightLegPivot";

    const thigh = limbMesh(
        armored ? 0.28 : 0.23,
        armored ? 0.24 : 0.2,
        armored ? 1.35 : 1.2,
        armored ? materials.armor : materials.trousers
    );
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.name = side < 0 ? "LeftLowerLegPivot" : "RightLowerLegPivot";
    knee.position.y = armored ? -1.22 : -1.1;

    const lowerLeg = limbMesh(
        armored ? 0.25 : 0.2,
        armored ? 0.21 : 0.17,
        armored ? 1.27 : 1.08,
        armored ? materials.darkArmor : materials.trousers
    );
    knee.add(lowerLeg);

    const boot = roundedBox(
        armored ? 0.55 : 0.43,
        armored ? 0.34 : 0.28,
        armored ? 0.82 : 0.64,
        0.1,
        materials.boots
    );
    boot.position.set(0, armored ? -1.2 : -1.03, -0.16);
    knee.add(boot);

    hip.add(knee);
    hip.userData.knee = knee;
    return hip;
}

export function createEscapee({
    jacketColor = 0x3e8fd1,
    accentColor = 0x70d8ff,
    skinColor = 0xc7a487
} = {}) {
    const root = new THREE.Group();
    root.name = "EscapeeCharacter";

    const bodyRoot = new THREE.Group();
    bodyRoot.position.y = 2.45;
    root.add(bodyRoot);

    const materials = {
        jacket: standardMaterial(jacketColor, { roughness: 0.72 }),
        sleeve: standardMaterial(new THREE.Color(jacketColor).multiplyScalar(0.76), { roughness: 0.75 }),
        shirt: standardMaterial(0xdbe4e8, { roughness: 0.8 }),
        trousers: standardMaterial(0x182732, { roughness: 0.78 }),
        boots: standardMaterial(0x0e1418, { roughness: 0.9 }),
        skin: standardMaterial(skinColor, { roughness: 0.82 }),
        hair: standardMaterial(0x202225, { roughness: 0.92 }),
        equipment: standardMaterial(0x252e34, { roughness: 0.65, metalness: 0.18 }),
        light: standardMaterial(accentColor, {
            roughness: 0.3,
            emissive: accentColor,
            emissiveIntensity: 1.7
        })
    };

    const torso = roundedBox(1.15, 1.5, 0.62, 0.2, materials.jacket);
    torso.position.y = 0.05;
    bodyRoot.add(torso);

    const shirtPanel = roundedBox(0.56, 0.9, 0.08, 0.1, materials.shirt);
    shirtPanel.position.set(0, 0.03, -0.34);
    bodyRoot.add(shirtPanel);

    const belt = roundedBox(1.1, 0.18, 0.7, 0.06, materials.equipment);
    belt.position.y = -0.72;
    bodyRoot.add(belt);

    const chestLight = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 20),
        materials.light
    );
    chestLight.position.set(0.36, 0.34, -0.365);
    bodyRoot.add(chestLight);

    const backpack = roundedBox(0.86, 1.04, 0.34, 0.13, materials.equipment);
    backpack.position.set(0, 0.04, 0.48);
    bodyRoot.add(backpack);

    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.17, 0.24, 12),
        materials.skin
    );
    neck.position.y = 0.89;
    bodyRoot.add(neck);

    const headPivot = new THREE.Group();
    headPivot.name = "HeadPivot";
    headPivot.position.y = 1.22;
    bodyRoot.add(headPivot);

    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.39, 20, 14),
        materials.skin
    );
    head.scale.set(0.9, 1.08, 0.88);
    headPivot.add(head);

    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.57),
        materials.hair
    );
    hair.position.y = 0.09;
    hair.scale.set(0.92, 0.76, 0.9);
    headPivot.add(hair);

    const visor = roundedBox(0.52, 0.16, 0.05, 0.05, materials.light);
    visor.position.set(0, 0.03, -0.36);
    headPivot.add(visor);

    const leftArm = createArm(-1, materials, false);
    leftArm.position.set(-0.69, 0.55, 0);
    bodyRoot.add(leftArm);

    const rightArm = createArm(1, materials, false);
    rightArm.position.set(0.69, 0.55, 0);
    bodyRoot.add(rightArm);

    const leftLeg = createLeg(-1, materials, false);
    leftLeg.position.set(-0.31, -0.76, 0);
    bodyRoot.add(leftLeg);

    const rightLeg = createLeg(1, materials, false);
    rightLeg.position.set(0.31, -0.76, 0);
    bodyRoot.add(rightLeg);

    root.scale.setScalar(0.76);

    root.userData.rig = {
        bodyRoot,
        torso,
        headPivot,
        leftArm,
        rightArm,
        leftForearm: leftArm.userData.elbow,
        rightForearm: rightArm.userData.elbow,
        leftLeg,
        rightLeg,
        leftLowerLeg: leftLeg.userData.knee,
        rightLowerLeg: rightLeg.userData.knee,
        chestLight
    };

    root.userData.characterType = "ESCAPEE";
    return root;
}

export function createPursuer() {
    const root = new THREE.Group();
    root.name = "WardenCharacter";

    const bodyRoot = new THREE.Group();
    bodyRoot.position.y = 2.85;
    root.add(bodyRoot);

    const materials = {
        armor: standardMaterial(0x252d33, { roughness: 0.5, metalness: 0.35 }),
        darkArmor: standardMaterial(0x101519, { roughness: 0.58, metalness: 0.28 }),
        underSuit: standardMaterial(0x171d21, { roughness: 0.84 }),
        boots: standardMaterial(0x090c0e, { roughness: 0.92 }),
        skin: standardMaterial(0x30363a, { roughness: 0.72 }),
        sensor: standardMaterial(0xff2424, {
            roughness: 0.2,
            emissive: 0xff0000,
            emissiveIntensity: 2.6
        })
    };

    const torso = roundedBox(1.48, 1.72, 0.84, 0.22, materials.armor);
    bodyRoot.add(torso);

    const abdomen = roundedBox(1.05, 0.72, 0.66, 0.15, materials.underSuit);
    abdomen.position.y = -1.02;
    bodyRoot.add(abdomen);

    for (const side of [-1, 1]) {
        const shoulderPlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.35, 0.82),
            materials.armor
        );
        shoulderPlate.position.set(side * 0.94, 0.64, 0);
        shoulderPlate.rotation.z = side * -0.16;
        bodyRoot.add(shoulderPlate);
    }

    const backUnit = roundedBox(1.05, 1.26, 0.46, 0.14, materials.darkArmor);
    backUnit.position.set(0, 0.08, 0.66);
    bodyRoot.add(backUnit);

    const headPivot = new THREE.Group();
    headPivot.name = "HeadPivot";
    headPivot.position.y = 1.25;
    bodyRoot.add(headPivot);

    const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 18, 12),
        materials.darkArmor
    );
    helmet.scale.set(0.95, 1.08, 0.92);
    headPivot.add(helmet);

    const facePlate = roundedBox(0.65, 0.48, 0.11, 0.08, materials.armor);
    facePlate.position.set(0, -0.02, -0.43);
    headPivot.add(facePlate);

    const sensor = roundedBox(0.42, 0.09, 0.04, 0.03, materials.sensor);
    sensor.position.set(0, 0.04, -0.5);
    headPivot.add(sensor);

    const sensorLight = new THREE.PointLight(0xff1010, 2.8, 8, 2);
    sensorLight.position.set(0, 0.04, -0.62);
    headPivot.add(sensorLight);

    const leftArm = createArm(-1, materials, true);
    leftArm.position.set(-0.92, 0.55, 0);
    bodyRoot.add(leftArm);

    const rightArm = createArm(1, materials, true);
    rightArm.position.set(0.92, 0.55, 0);
    bodyRoot.add(rightArm);

    const captureDevice = roundedBox(0.22, 1.25, 0.22, 0.07, materials.sensor);
    captureDevice.position.set(0, -1.07, -0.24);
    rightArm.userData.elbow.add(captureDevice);

    const leftLeg = createLeg(-1, materials, true);
    leftLeg.position.set(-0.38, -1.35, 0);
    bodyRoot.add(leftLeg);

    const rightLeg = createLeg(1, materials, true);
    rightLeg.position.set(0.38, -1.35, 0);
    bodyRoot.add(rightLeg);

    root.scale.setScalar(0.82);

    root.userData.rig = {
        bodyRoot,
        torso,
        headPivot,
        leftArm,
        rightArm,
        leftForearm: leftArm.userData.elbow,
        rightForearm: rightArm.userData.elbow,
        leftLeg,
        rightLeg,
        leftLowerLeg: leftLeg.userData.knee,
        rightLowerLeg: rightLeg.userData.knee,
        sensor,
        captureDevice
    };

    root.userData.characterType = "PURSUER";
    return root;
}

export class CharacterAnimator {
    constructor(character) {
        this.character = character;
        this.rig = character.userData.rig;
        this.time = Math.random() * Math.PI * 2;
        this.currentState = "IDLE";
    }

    update(deltaTime, { state = "IDLE", speed = 0, injured = false } = {}) {
        this.time += deltaTime;
        this.currentState = state;

        const rig = this.rig;
        if (!rig) return;

        const isPursuer = this.character.userData.characterType === "PURSUER";
        const moving = state === "WALK" || state === "RUN" || state === "FLEE" || state === "CHASE" || state === "SEARCH" || state === "ESCAPE";
        const running = state === "RUN" || state === "FLEE" || state === "CHASE" || state === "ESCAPE";
        const repairing = state === "REPAIR";
        const capturing = state === "CAPTURE";

        const frequency = running ? 10 : moving ? 6.2 : 2;
        const amplitude = running ? 0.9 : moving ? 0.52 : 0.035;
        const cycle = Math.sin(this.time * frequency);
        const opposite = Math.sin(this.time * frequency + Math.PI);

        rig.leftArm.rotation.x = moving ? cycle * amplitude : Math.sin(this.time * 2) * 0.025;
        rig.rightArm.rotation.x = moving ? opposite * amplitude : -Math.sin(this.time * 2) * 0.025;
        rig.leftLeg.rotation.x = moving ? opposite * amplitude * 0.86 : 0;
        rig.rightLeg.rotation.x = moving ? cycle * amplitude * 0.86 : 0;
        rig.leftLowerLeg.rotation.x = moving ? Math.max(0, cycle) * 0.68 : 0;
        rig.rightLowerLeg.rotation.x = moving ? Math.max(0, opposite) * 0.68 : 0;

        rig.bodyRoot.position.y = (isPursuer ? 2.85 : 2.45) + Math.abs(Math.sin(this.time * frequency)) * (moving ? 0.055 : 0.018);
        rig.bodyRoot.rotation.x = running ? -0.15 : isPursuer && state === "CHASE" ? -0.2 : 0;
        rig.bodyRoot.rotation.z = injured ? 0.11 : 0;
        rig.headPivot.rotation.y = state === "FLEE" ? Math.sin(this.time * 4) * 0.34 : Math.sin(this.time * 0.8) * 0.035;

        if (repairing) {
            rig.leftArm.rotation.x = -1.1 + Math.sin(this.time * 7) * 0.14;
            rig.rightArm.rotation.x = -1.1 - Math.sin(this.time * 7) * 0.14;
            rig.leftArm.rotation.z = 0.22;
            rig.rightArm.rotation.z = -0.22;
            rig.leftForearm.rotation.x = -0.55;
            rig.rightForearm.rotation.x = -0.55;
        } else {
            rig.leftArm.rotation.z = 0;
            rig.rightArm.rotation.z = 0;
            rig.leftForearm.rotation.x = 0;
            rig.rightForearm.rotation.x = 0;
        }

        if (capturing && isPursuer) {
            rig.rightArm.rotation.x = -1.45;
            rig.rightForearm.rotation.x = -0.35;
            rig.bodyRoot.rotation.x = -0.18;
        }

        if (state === "DOWNED") {
            rig.bodyRoot.rotation.z = 1.35;
            rig.bodyRoot.position.y = 0.75;
            rig.leftArm.rotation.x = 0.4;
            rig.rightArm.rotation.x = -0.4;
        }

        if (isPursuer && rig.sensor) {
            rig.sensor.material.emissiveIntensity = state === "CHASE" ? 4.3 : 2.4;
        }
    }
}
