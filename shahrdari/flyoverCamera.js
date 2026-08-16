/**
 * flyoverCamera.js — Strava/Relive-style chase camera + realistic cyclist
 */

import * as THREE from "three";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

/**
 * Visible bicycle + rider (third-person readable scale for flyover).
 */
export function createRider() {
  const root = new THREE.Group();
  root.scale.setScalar(2.4);

  const bike = new THREE.Group();
  bike.name = "bike";
  root.add(bike);

  const frameMat = mat(0x00e6b8, { metalness: 0.45, roughness: 0.35, emissive: 0x00ffcc, emissiveIntensity: 0.35 });
  const darkMat = mat(0x1a1a1a, { roughness: 0.7 });
  const chromeMat = mat(0xcccccc, { metalness: 0.7, roughness: 0.3 });

  // Wheels
  const wheels = [];
  [-1.55, 1.55].forEach((x) => {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 8, 20), darkMat);
    tire.rotation.y = Math.PI / 2;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 10), chromeMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    // spokes
    for (let i = 0; i < 6; i += 1) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.7, 0.04), chromeMat);
      spoke.rotation.z = (i / 6) * Math.PI;
      wheel.add(spoke);
    }
    wheel.position.set(x, 0.95, 0);
    bike.add(wheel);
    wheels.push(wheel);
  });

  // Frame tubes
  const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), frameMat);
  topTube.rotation.z = Math.PI / 2;
  topTube.position.set(0.05, 1.55, 0);
  bike.add(topTube);

  const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 8), frameMat);
  downTube.rotation.z = Math.PI / 2.6;
  downTube.position.set(0.15, 1.15, 0);
  bike.add(downTube);

  const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.15, 8), frameMat);
  seatTube.position.set(-0.55, 1.4, 0);
  bike.add(seatTube);

  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), frameMat);
  fork.position.set(1.35, 1.35, 0);
  bike.add(fork);

  // Handlebar
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), darkMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(1.35, 1.85, 0);
  bike.add(bar);

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.28), darkMat);
  seat.position.set(-0.55, 1.95, 0);
  bike.add(seat);

  // Pedal crank
  const crank = new THREE.Group();
  crank.position.set(0.15, 0.95, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), chromeMat);
  crank.add(arm);
  const pedalL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.18), darkMat);
  pedalL.position.set(0, 0.32, 0.2);
  crank.add(pedalL);
  const pedalR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.18), darkMat);
  pedalR.position.set(0, -0.32, -0.2);
  crank.add(pedalR);
  bike.add(crank);

  // ---- Rider body ----
  const rider = new THREE.Group();
  rider.name = "cyclist";
  root.add(rider);

  const skin = mat(0xd4a574, { roughness: 0.65 });
  const jersey = mat(0x0ea5a0, { emissive: 0x00ffcc, emissiveIntensity: 0.25 });
  const shorts = mat(0x111827);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), jersey);
  torso.position.set(-0.15, 2.55, 0);
  torso.rotation.z = 0.55; // leaning forward
  rider.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.set(0.25, 3.15, 0);
  rider.add(head);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.7),
    mat(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.2 })
  );
  helmet.position.copy(head.position);
  helmet.position.y += 0.05;
  rider.add(helmet);

  // Arms to handlebar
  const upperArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.35, 3, 6), jersey);
  upperArmL.position.set(0.35, 2.7, 0.35);
  upperArmL.rotation.z = 1.1;
  upperArmL.rotation.y = 0.4;
  rider.add(upperArmL);
  const upperArmR = upperArmL.clone();
  upperArmR.position.z = -0.35;
  upperArmR.rotation.y = -0.4;
  rider.add(upperArmR);

  // Legs
  const thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 3, 6), shorts);
  thighL.position.set(-0.35, 2.05, 0.18);
  thighL.rotation.z = 0.5;
  rider.add(thighL);
  const thighR = thighL.clone();
  thighR.position.z = -0.18;
  rider.add(thighR);

  const shinL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), skin);
  shinL.position.set(-0.05, 1.45, 0.18);
  shinL.rotation.z = -0.35;
  rider.add(shinL);
  const shinR = shinL.clone();
  shinR.position.z = -0.18;
  rider.add(shinR);

  // Soft neon trail particles behind bike
  const count = 36;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 1.2;
    positions[i * 3 + 1] = 0.4 + Math.random();
    positions[i * 3 + 2] = 1 + Math.random() * 3;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.28, transparent: true, opacity: 0.7 })
  );
  particles.position.set(0, 0.5, 2.2);
  root.add(particles);

  root.userData = {
    particles,
    wheels,
    crank,
    thighL,
    thighR,
    shinL,
    shinR,
    pedalPhase: 0,
  };

  return root;
}

/**
 * Chase camera state machine along a CatmullRomCurve3
 */
export function createFlyoverController(camera, curve) {
  const state = {
    playing: false,
    t: 0,
    speed: 2,
    duration: Math.max(18, curve.getLength() / 28),
  };

  const lookTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function sample(u) {
    const uu = THREE.MathUtils.clamp(u, 0, 1);
    const pos = curve.getPointAt(uu);
    tangent.copy(curve.getTangentAt(uu)).normalize();
    binormal.crossVectors(up, tangent).normalize();
    if (binormal.lengthSq() < 0.001) binormal.set(1, 0, 0);
    normal.crossVectors(tangent, binormal).normalize();
    return { pos, tangent, normal, binormal };
  }

  function animateCyclist(rider, delta, moving) {
    const d = rider.userData;
    if (!d?.wheels) return;
    if (moving) d.pedalPhase += delta * 10 * state.speed;
    const ph = d.pedalPhase;
    d.wheels.forEach((w) => {
      w.rotation.z -= delta * 8 * state.speed * (moving ? 1 : 0);
    });
    if (d.crank) d.crank.rotation.z = ph;
    if (d.thighL) d.thighL.rotation.z = 0.45 + Math.sin(ph) * 0.45;
    if (d.thighR) d.thighR.rotation.z = 0.45 + Math.sin(ph + Math.PI) * 0.45;
    if (d.shinL) d.shinL.rotation.z = -0.25 + Math.cos(ph) * 0.35;
    if (d.shinR) d.shinR.rotation.z = -0.25 + Math.cos(ph + Math.PI) * 0.35;

    const parts = d.particles;
    if (parts && moving) {
      const arr = parts.geometry.attributes.position;
      for (let i = 0; i < arr.count; i += 1) {
        let z = arr.getZ(i) + 0.2 + Math.random() * 0.05;
        if (z > 5) z = Math.random() * 0.5;
        arr.setXYZ(i, (Math.random() - 0.5) * 1.2, 0.3 + Math.random(), z);
      }
      arr.needsUpdate = true;
    }
  }

  function applyToRider(rider, u, delta = 0.016, moving = true) {
    const { pos, tangent, binormal } = sample(u);
    rider.position.copy(pos);
    rider.position.y += 0.05;
    const look = pos.clone().add(tangent);
    rider.lookAt(look);
    rider.rotation.z = THREE.MathUtils.clamp(-binormal.x * 0.25, -0.3, 0.3);
    animateCyclist(rider, delta, moving);
  }

  function applyCamera(u) {
    const { pos, tangent, normal } = sample(u);
    camPos
      .copy(pos)
      .addScaledVector(tangent, -11)
      .addScaledVector(normal, 5.2);

    camera.position.lerp(camPos, 0.14);
    lookTarget.copy(pos).addScaledVector(tangent, 10).addScaledVector(normal, 1.8);
    camera.lookAt(lookTarget);
  }

  function update(delta, rider) {
    const moving = state.playing && state.t < 1;
    if (state.playing) {
      state.t += (delta * state.speed) / state.duration;
      if (state.t >= 1) {
        state.t = 1;
        state.playing = false;
      }
    }
    if (rider) applyToRider(rider, state.t, delta, moving);
    applyCamera(state.t);
    return state;
  }

  function setProgress(t01) {
    state.t = THREE.MathUtils.clamp(t01, 0, 1);
  }

  function rewind() {
    state.t = 0;
    state.playing = false;
  }

  return {
    state,
    update,
    setProgress,
    rewind,
    applyCamera,
    applyToRider,
  };
}
