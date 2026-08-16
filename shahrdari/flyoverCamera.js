/**
 * flyoverCamera.js — Strava/Relive-style chase camera + rider
 */

import * as THREE from "three";

export function createRider() {
  const g = new THREE.Group();

  const puck = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 1.6,
      roughness: 0.3,
    })
  );
  puck.position.y = 2.2;
  g.add(puck);

  // Minimal bike silhouette
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.35, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xe8f8f4, emissive: 0x00aa88, emissiveIntensity: 0.4 })
  );
  frame.position.y = 1.4;
  g.add(frame);

  [-1.6, 1.6].forEach((x) => {
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.18, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x00ffcc, emissiveIntensity: 0.25 })
    );
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x, 1.1, 0);
    g.add(wheel);
  });

  // Speed particles
  const count = 40;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = Math.random() * 2;
    positions[i * 3 + 2] = Math.random() * 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0x00ffcc, size: 0.45, transparent: true, opacity: 0.75 })
  );
  particles.position.set(0, 1, 3);
  g.add(particles);
  g.userData.particles = particles;

  return g;
}

/**
 * Chase camera state machine along a CatmullRomCurve3
 */
export function createFlyoverController(camera, curve) {
  const state = {
    playing: false,
    t: 0, // 0..1
    speed: 2, // multiplier
    duration: Math.max(18, curve.getLength() / 28), // seconds at 1x
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
    // Banked frame
    binormal.crossVectors(up, tangent).normalize();
    if (binormal.lengthSq() < 0.001) binormal.set(1, 0, 0);
    normal.crossVectors(tangent, binormal).normalize();
    return { pos, tangent, normal, binormal };
  }

  function applyToRider(rider, u) {
    const { pos, tangent, binormal } = sample(u);
    rider.position.copy(pos);
    rider.position.y += 0.2;
    const look = pos.clone().add(tangent);
    rider.lookAt(look);
    // slight bank
    rider.rotation.z = THREE.MathUtils.clamp(-binormal.x * 0.35, -0.35, 0.35);

    const parts = rider.userData.particles;
    if (parts) {
      const arr = parts.geometry.attributes.position;
      for (let i = 0; i < arr.count; i += 1) {
        let z = arr.getZ(i) + 0.15 + Math.random() * 0.05;
        if (z > 6) z = Math.random();
        arr.setXYZ(i, (Math.random() - 0.5) * 2, Math.random() * 2.2, z);
      }
      arr.needsUpdate = true;
    }
  }

  function applyCamera(u) {
    const { pos, tangent, normal, binormal } = sample(u);
    // Third-person chase: behind and above
    camPos
      .copy(pos)
      .addScaledVector(tangent, -18)
      .addScaledVector(normal, 9)
      .addScaledVector(binormal, 0);

    // Smooth lerp
    camera.position.lerp(camPos, 0.12);
    lookTarget.copy(pos).addScaledVector(tangent, 12).addScaledVector(normal, 2);
    camera.lookAt(lookTarget);
  }

  function update(delta, rider) {
    if (state.playing) {
      state.t += (delta * state.speed) / state.duration;
      if (state.t >= 1) {
        state.t = 1;
        state.playing = false;
      }
    }
    if (rider) applyToRider(rider, state.t);
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
