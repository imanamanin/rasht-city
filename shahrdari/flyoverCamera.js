/**
 * flyoverCamera.js — Chase camera with mouse-look + billboard cyclist sprite
 */

import * as THREE from "three";

/**
 * Draw a clear side-view bicycle + cyclist onto canvas (no external image fetch).
 */
function createBikeCanvas() {
  const cnv = document.createElement("canvas");
  cnv.width = 1024;
  cnv.height = 768;
  const ctx = cnv.getContext("2d");
  ctx.clearRect(0, 0, cnv.width, cnv.height);

  const cx = 520;
  const cy = 480;

  // Soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 175, 220, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  function wheel(x, y, r) {
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#00ffcc";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r - 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * (r - 16), y + Math.sin(a) * (r - 16));
      ctx.stroke();
    }
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  const rearX = cx - 150;
  const frontX = cx + 150;
  const wheelY = cy + 70;
  const R = 95;
  wheel(rearX, wheelY, R);
  wheel(frontX, wheelY, R);

  // Frame
  ctx.strokeStyle = "#00e6b8";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(rearX, wheelY); // rear hub
  ctx.lineTo(cx - 40, cy - 40); // seat tube top
  ctx.lineTo(cx + 90, cy - 10); // top tube to head
  ctx.lineTo(frontX, wheelY); // fork to front hub
  ctx.moveTo(cx - 40, cy - 40);
  ctx.lineTo(cx + 20, wheelY - 10); // seat to BB
  ctx.lineTo(cx + 90, cy - 10); // down/top
  ctx.stroke();

  // Seat
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(cx - 55, cy - 55, 42, 16, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Handlebar
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(cx + 85, cy - 20);
  ctx.lineTo(cx + 85, cy - 70);
  ctx.lineTo(cx + 130, cy - 75);
  ctx.stroke();

  // Pedal crank
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx + 20, wheelY - 10);
  ctx.lineTo(cx + 20, wheelY + 55);
  ctx.stroke();
  ctx.fillStyle = "#333";
  ctx.fillRect(cx + 5, wheelY + 50, 40, 14);

  // Cyclist body
  // Legs
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 20);
  ctx.lineTo(cx - 10, cy + 40);
  ctx.lineTo(cx + 25, wheelY + 45);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 35, cy - 15);
  ctx.lineTo(cx + 50, cy + 30);
  ctx.lineTo(cx + 35, wheelY + 20);
  ctx.stroke();

  // Torso (leaning)
  ctx.strokeStyle = "#0d9488";
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 25);
  ctx.lineTo(cx + 70, cy - 55);
  ctx.stroke();

  // Arms
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(cx + 40, cy - 45);
  ctx.lineTo(cx + 120, cy - 72);
  ctx.stroke();

  // Head
  ctx.fillStyle = "#d4a574";
  ctx.beginPath();
  ctx.arc(cx + 95, cy - 95, 32, 0, Math.PI * 2);
  ctx.fill();

  // Helmet
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.ellipse(cx + 95, cy - 108, 36, 24, 0.1, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(cx + 95, cy - 100, 30, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Neon accent glow outline
  ctx.strokeStyle = "rgba(0,255,204,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, cnv.width - 80, cnv.height - 80);

  return cnv;
}

/**
 * Billboard cyclist using a drawn "photo-like" side view (stays above ground).
 */
export function createRider() {
  const root = new THREE.Group();

  const cnv = createBikeCanvas();
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  // World size ~ 8m tall visual
  sprite.scale.set(10, 7.5, 1);
  // Anchor near bottom of sprite so wheels sit on path
  sprite.center.set(0.5, 0.08);
  sprite.position.y = 0.15;
  root.add(sprite);

  // Tiny contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  root.add(shadow);

  root.userData = { sprite, bob: 0 };
  return root;
}

/**
 * Chase camera with mouse-look so user can read roadside shop signs.
 */
export function createFlyoverController(camera, curve) {
  const state = {
    playing: false,
    t: 0,
    speed: 2,
    duration: Math.max(18, curve.getLength() / 28),
    lookYaw: 0,
    lookPitch: 0.22,
  };

  const lookTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  let lastPointer = null;

  function onPointerMove(e) {
    if (lastPointer == null) {
      lastPointer = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    state.lookYaw -= dx * 0.0045;
    state.lookPitch = THREE.MathUtils.clamp(state.lookPitch - dy * 0.0035, -0.15, 0.95);
  }

  function onPointerLeave() {
    lastPointer = null;
  }

  function enableMouseLook(on) {
    if (on) {
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerleave", onPointerLeave);
    } else {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      lastPointer = null;
    }
  }

  function sample(u) {
    const uu = THREE.MathUtils.clamp(u, 0, 1);
    const pos = curve.getPointAt(uu);
    tangent.copy(curve.getTangentAt(uu)).normalize();
    binormal.crossVectors(up, tangent).normalize();
    if (binormal.lengthSq() < 0.001) binormal.set(1, 0, 0);
    normal.crossVectors(tangent, binormal).normalize();
    return { pos, tangent, normal, binormal };
  }

  function applyToRider(rider, u, delta = 0.016, moving = true) {
    const { pos, tangent } = sample(u);
    rider.position.copy(pos);
    // Keep sprite clearly above the neon tube / ground
    rider.position.y = Math.max(pos.y, 0.6) + 0.35;
    if (moving) {
      rider.userData.bob = (rider.userData.bob || 0) + delta * 10 * state.speed;
      rider.position.y += Math.sin(rider.userData.bob) * 0.12;
    }
    // Face travel direction in XZ (sprite still billboards to camera visually)
    const face = pos.clone().add(tangent);
    rider.lookAt(face.x, rider.position.y, face.z);
  }

  function applyCamera(u) {
    const { pos, tangent } = sample(u);
    const baseYaw = Math.atan2(tangent.x, tangent.z);
    const yaw = baseYaw + Math.PI + state.lookYaw; // behind rider + mouse
    const pitch = state.lookPitch;
    const dist = 12;

    const targetY = Math.max(pos.y, 0.6) + 2.2;
    camPos.set(
      pos.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      targetY + Math.sin(pitch) * dist * 0.75 + 2.5,
      pos.z + Math.cos(yaw) * Math.cos(pitch) * dist
    );

    // Keep camera above ground
    camPos.y = Math.max(camPos.y, 3.5);

    camera.position.lerp(camPos, 0.18);
    lookTarget.set(pos.x, targetY, pos.z);
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

  function resetLook() {
    state.lookYaw = 0;
    state.lookPitch = 0.22;
  }

  return {
    state,
    update,
    setProgress,
    rewind,
    applyCamera,
    applyToRider,
    enableMouseLook,
    resetLook,
  };
}
