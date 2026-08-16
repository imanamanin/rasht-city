/**
 * میدان شهرداری رشت — تجربه سه‌بعدی
 * Vanilla ES module + Three.js r160 · GitHub Pages ready
 */

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { createRouteMode } from "./routeMode.js";

/* =========================================================
   DOM
   ========================================================= */
const canvas = document.getElementById("c");
const blocker = document.getElementById("blocker");
const startBtn = document.getElementById("start-btn");
const hud = document.getElementById("hud");
const hudMode = document.getElementById("hud-mode");

/** @type {'walk' | 'route'} */
let appMode = "walk";
document.body.classList.add("is-walk");

/* =========================================================
   Renderer / Scene / Camera
   ========================================================= */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8d8);
scene.fog = new THREE.Fog(0x87b8d8, 40, 140);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  250
);
camera.position.set(0, 1.7, 18);

/* =========================================================
   Lights (day / night)
   ========================================================= */
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
sun.position.set(30, 45, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);

const moon = new THREE.DirectionalLight(0x6a8cff, 0.25);
moon.position.set(-20, 30, -10);
moon.visible = false;
scene.add(moon);

const nightAccent = new THREE.HemisphereLight(0x102030, 0x050807, 0.35);
nightAccent.visible = false;
scene.add(nightAccent);

/** @type {THREE.PointLight[]} */
const lampLights = [];
/** @type {THREE.Mesh[]} */
const neonMeshes = [];
/** @type {{ hour: THREE.Object3D, minute: THREE.Object3D }[]} */
const clockHands = [];
/** @type {THREE.Points | null} */
let fountainSpray = null;

let isNight = false;
let thirdPerson = false;

/* =========================================================
   Materials helpers
   ========================================================= */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.7,
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flatShading ?? false,
  });
}

function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

/* =========================================================
   Builder helpers
   ========================================================= */
function addShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Horizontal cornice band */
function makeCornice(w, d, y, parent, color = 0xe8e8e0) {
  const m = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.18, d + 0.25), mat(color, { roughness: 0.55 })));
  m.position.y = y;
  parent.add(m);
}

/** Arched window: dark box + half-cylinder top */
function makeArchedWindow(x, y, z, parent, rotY = 0) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.35, 0.12), mat(0x2a2a2a, { roughness: 0.9 }));
  frame.position.y = 0.55;
  g.add(frame);

  const arch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12, 1, false, 0, Math.PI),
    mat(0x2a2a2a, { roughness: 0.9 })
  );
  arch.rotation.z = Math.PI / 2;
  arch.rotation.y = Math.PI / 2;
  arch.position.y = 1.22;
  g.add(arch);

  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
}

function makeRoofPrism(w, d, h, color = 0x8c2f2f) {
  // Simple pitched roof: two slanted boxes
  const group = new THREE.Group();
  const left = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d * 0.62), mat(color, { roughness: 0.85 })));
  left.position.set(0, h * 0.35, -d * 0.18);
  left.rotation.x = 0.45;
  group.add(left);

  const right = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d * 0.62), mat(color, { roughness: 0.85 })));
  right.position.set(0, h * 0.35, d * 0.18);
  right.rotation.x = -0.45;
  group.add(right);

  const ridge = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.15, 0.3), mat(0x6e2424)));
  ridge.position.y = h * 0.55;
  group.add(ridge);

  return group;
}

/**
 * Municipality building — west side hero landmark
 */
function makeMunicipalityBuilding() {
  const root = new THREE.Group();
  root.position.set(-22, 0, 0);

  const wall = mat(0xf5f5f0, { roughness: 0.65 });
  const bodyW = 30;
  const bodyD = 12;
  const bodyH = 11;

  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyD), wall));
  body.position.y = bodyH / 2;
  root.add(body);

  // Floor cornices
  makeCornice(bodyW, bodyD, 3.6, root);
  makeCornice(bodyW, bodyD, 7.2, root);
  makeCornice(bodyW + 0.1, bodyD + 0.1, bodyH - 0.1, root, 0xdeded6);

  // Windows — east-facing facade (toward square = +X local, building faces +X)
  for (let floor = 0; floor < 3; floor += 1) {
    const wy = 1.4 + floor * 3.5;
    for (let i = -5; i <= 5; i += 1) {
      if (i === 0) continue; // leave center for tower axis
      makeArchedWindow(bodyW / 2 + 0.05, wy, i * 2.35, root, -Math.PI / 2);
    }
  }

  // Half-cylinder ends (north / south)
  [-1, 1].forEach((side) => {
    const cyl = addShadow(
      new THREE.Mesh(new THREE.CylinderGeometry(bodyD / 2, bodyD / 2, bodyH, 20, 1, false, 0, Math.PI), wall)
    );
    cyl.position.set(0, bodyH / 2, side * (bodyW / 2));
    cyl.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(cyl);

    const endRoof = makeRoofPrism(bodyD + 1, bodyD + 0.5, 2.2);
    endRoof.position.set(0, bodyH, side * (bodyW / 2));
    endRoof.rotation.y = Math.PI / 2;
    endRoof.scale.set(0.85, 1, 0.85);
    root.add(endRoof);
  });

  // Main red roof
  const mainRoof = makeRoofPrism(bodyW + 1.2, bodyD + 1.5, 3.2);
  mainRoof.position.y = bodyH;
  root.add(mainRoof);

  // Clock tower
  root.add(makeClockTower(0, bodyH, 0));

  // Steps toward square
  const steps = addShadow(new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 3), mat(0xd8d4cc)));
  steps.position.set(bodyW / 2 + 1.6, 0.3, 0);
  root.add(steps);

  scene.add(root);
  return root;
}

function makeClockFace(size = 2.2) {
  const g = new THREE.Group();
  const dial = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 32), mat(0xfafafa, { roughness: 0.4 }));
  g.add(dial);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(size / 2 - 0.08, size / 2, 32),
    mat(0x1a1a1a, { roughness: 0.6 })
  );
  ring.position.z = 0.01;
  g.add(ring);

  const hour = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, size * 0.28, 0.06), mat(0x111111)));
  hour.position.z = 0.05;
  hour.geometry.translate(0, size * 0.14, 0);
  g.add(hour);

  const minute = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, size * 0.38, 0.05), mat(0x222222)));
  minute.position.z = 0.06;
  minute.geometry.translate(0, size * 0.19, 0);
  g.add(minute);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), mat(0x111111));
  hub.position.z = 0.08;
  g.add(hub);

  clockHands.push({ hour, minute });
  return g;
}

function makeClockTower(x, y, z) {
  const tower = new THREE.Group();
  tower.position.set(x, y, z);

  const shaftH = 16;
  const shaft = addShadow(new THREE.Mesh(new THREE.BoxGeometry(4.2, shaftH, 4.2), mat(0xf5f5f0)));
  shaft.position.y = shaftH / 2;
  tower.add(shaft);

  for (let i = 1; i <= 4; i += 1) {
    makeCornice(4.2, 4.2, i * 3.2, tower);
  }

  // Clock faces — 4 sides
  const faceY = shaftH - 3.2;
  const faces = [
    { pos: [2.12, faceY, 0], rot: Math.PI / 2 },
    { pos: [-2.12, faceY, 0], rot: -Math.PI / 2 },
    { pos: [0, faceY, 2.12], rot: 0 },
    { pos: [0, faceY, -2.12], rot: Math.PI },
  ];
  faces.forEach(({ pos, rot }) => {
    const face = makeClockFace(2.0);
    face.position.set(pos[0], pos[1], pos[2]);
    face.rotation.y = rot;
    tower.add(face);
  });

  // Cupola / crown
  const cupolaBase = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.2, 16), mat(0xf0f0ea)));
  cupolaBase.position.y = shaftH + 0.6;
  tower.add(cupolaBase);

  const dome = addShadow(new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8c2f2f)));
  dome.position.y = shaftH + 1.2;
  tower.add(dome);

  const spire = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 10), mat(0x6e2424)));
  spire.position.y = shaftH + 3.4;
  tower.add(spire);

  return tower;
}

function makeSurroundBuilding(x, z, w, d, h, rotY = 0, roofColor = 0x8c2f2f) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const body = addShadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xefebe3, { roughness: 0.7 })));
  body.position.y = h / 2;
  g.add(body);

  makeCornice(w, d, h * 0.33, g);
  makeCornice(w, d, h * 0.66, g);

  // Simple windows
  const rows = Math.max(2, Math.floor(h / 3.2));
  const cols = Math.max(3, Math.floor(w / 3));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const wx = -w / 2 + 1.5 + c * ((w - 3) / Math.max(cols - 1, 1));
      const wy = 1.5 + r * (h / (rows + 0.5));
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.2, 0.08), mat(0x2a2a2a));
      win.position.set(wx, wy, d / 2 + 0.02);
      g.add(win);
    }
  }

  const roof = makeRoofPrism(w + 0.8, d + 0.8, 2.4, roofColor);
  roof.position.y = h;
  g.add(roof);

  scene.add(g);
  return g;
}

function makeTree(x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  const trunk = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8), mat(0x5a3a22)));
  trunk.position.y = 1.1;
  g.add(trunk);

  const canopy = addShadow(new THREE.Mesh(new THREE.SphereGeometry(1.35, 10, 8), mat(0x2f6b3c, { roughness: 0.9 })));
  canopy.position.y = 3.0;
  g.add(canopy);

  const canopy2 = addShadow(new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 8), mat(0x3a7d48, { roughness: 0.9 })));
  canopy2.position.y = 3.6;
  g.add(canopy2);

  scene.add(g);
  return g;
}

function makeLamppost(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pole = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), mat(0x333333)));
  pole.position.y = 2.1;
  g.add(pole);

  const arm = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), mat(0x333333)));
  arm.position.set(0.3, 4.1, 0);
  g.add(arm);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat(0xfff2c2, { emissive: 0x000000, emissiveIntensity: 0 }));
  bulb.position.set(0.55, 4.0, 0);
  g.add(bulb);
  neonMeshes.push(bulb);

  const light = new THREE.PointLight(0xffd9a0, 0, 14, 2);
  light.position.copy(bulb.position);
  light.castShadow = false;
  g.add(light);
  lampLights.push(light);

  scene.add(g);
  return g;
}

function makeBench(x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const seat = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.45), mat(0x8a8a82)));
  seat.position.y = 0.45;
  g.add(seat);

  const back = addShadow(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.1), mat(0x8a8a82)));
  back.position.set(0, 0.7, -0.2);
  g.add(back);

  [-0.6, 0.6].forEach((sx) => {
    const leg = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.4), mat(0x555550)));
    leg.position.set(sx, 0.22, 0);
    g.add(leg);
  });

  scene.add(g);
  return g;
}

function makeFountain() {
  const g = new THREE.Group();
  g.position.set(2, 0, 0);

  const rim = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.55, 32), mat(0xcfc9bc)));
  rim.position.y = 0.28;
  g.add(rim);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(4.7, 4.7, 0.25, 32),
    mat(0x2a7faa, { roughness: 0.25, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0 })
  );
  water.position.y = 0.35;
  g.add(water);
  neonMeshes.push(water);

  const pedestal = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 16), mat(0xd5d0c4)));
  pedestal.position.y = 1.0;
  g.add(pedestal);

  const jet = addShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 10), mat(0xcfc9bc)));
  jet.position.y = 1.9;
  g.add(jet);

  // Particle spray
  const count = 120;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 1] = Math.random() * 3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  fountainSpray = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xa8d8ef, size: 0.08, transparent: true, opacity: 0.75 })
  );
  fountainSpray.position.y = 2.1;
  g.add(fountainSpray);

  scene.add(g);
  return g;
}

function makePedestrian(x, z, hue = 0x2c2c2c) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const body = addShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), mat(hue)));
  body.position.y = 1.05;
  g.add(body);

  const head = addShadow(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(0x3a3030)));
  head.position.y = 1.85;
  g.add(head);

  scene.add(g);
  return g;
}

/**
 * Shop / landmark signboard with procedural Persian text
 * Names based on well-known places around Shahrdari Square (Maps / local guides).
 */
function makeShopSign(text, x, y, z, rotY = 0, opts = {}) {
  const width = opts.width ?? Math.min(7.5, Math.max(3.2, text.length * 0.42));
  const height = opts.height ?? 1.15;
  const bg = opts.bg ?? "#1a241e";
  const fg = opts.fg ?? "#f2f7f4";
  const accent = opts.accent ?? "#c9a56a";
  const emissiveHex = opts.emissive ?? 0xc9a56a;

  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const cnv = document.createElement("canvas");
  cnv.width = 1024;
  cnv.height = 256;
  const ctx = cnv.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, cnv.width - 28, cnv.height - 28);
  ctx.fillStyle = fg;
  ctx.font = `bold ${opts.fontSize ?? 72}px Vazirmatn, Tahoma, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, cnv.width / 2, cnv.height / 2);

  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(emissiveHex),
      emissiveIntensity: 0.12,
      roughness: 0.55,
      metalness: 0.05,
    })
  );
  board.castShadow = true;
  g.add(board);

  // Thin backing plate
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.08),
    mat(0x222222)
  );
  back.position.z = -0.05;
  g.add(back);

  neonMeshes.push(board);
  scene.add(g);
  return g;
}

/** Place named signs around the square (real / well-known nearby places) */
function placeSquareSigns() {
  // Historic complex labels on building faces facing the square
  makeShopSign("هتل ایران", 8, 6.2, -23.9, 0, {
    width: 8,
    bg: "#3a2218",
    accent: "#e8b87a",
    emissive: 0xe8b87a,
  });
  makeShopSign("موزه پست و تلگراف", 22.9, 6.5, 0, -Math.PI / 2, {
    width: 9,
    bg: "#1e2430",
    accent: "#9eb6d4",
    emissive: 0x9eb6d4,
  });
  makeShopSign("کتابخانه ملی رشت", 6, 5.8, 23.9, Math.PI, {
    width: 9,
    bg: "#1a2a22",
    accent: "#7dcb9e",
    emissive: 0x7dcb9e,
  });
  makeShopSign("شهرداری رشت", -15.8, 8.2, 0, Math.PI / 2, {
    width: 8.5,
    height: 1.3,
    bg: "#f5f5f0",
    fg: "#1a1a1a",
    accent: "#8c2f2f",
    emissive: 0x8c2f2f,
    fontSize: 68,
  });

  // Pedestrian street / commercial strip signs
  makeShopSign("پیاده‌راه علم‌الهدی", 14, 3.4, -12, -0.5, {
    width: 7.5,
    bg: "#14241c",
    accent: "#c9a56a",
  });
  makeShopSign("سینما سپیدرود", 16, 3.2, -6, -Math.PI / 2, {
    width: 6.5,
    bg: "#2a1520",
    accent: "#e08a7a",
    emissive: 0xe08a7a,
  });
  makeShopSign("سینما ۲۲ بهمن", 16, 3.2, 6, -Math.PI / 2, {
    width: 6.2,
    bg: "#1a2030",
    accent: "#8ab4e0",
    emissive: 0x8ab4e0,
  });
  makeShopSign("بازار بزرگ رشت", 10, 3.1, 14, Math.PI * 0.85, {
    width: 6.8,
    bg: "#2a2418",
    accent: "#e0b35a",
    emissive: 0xe0b35a,
  });
  makeShopSign("سبزه میدان", 4, 3.0, 16, Math.PI, {
    width: 5.5,
    bg: "#16301f",
    accent: "#7dcb9e",
    emissive: 0x7dcb9e,
  });
  makeShopSign("پاساژ پاسارگاد", 18, 3.15, -2, -Math.PI / 2, {
    width: 6.5,
    bg: "#241a28",
    accent: "#d4a0c8",
    emissive: 0xd4a0c8,
  });
  makeShopSign("مرکز خرید رز", 12, 3.05, -16, 0.35, {
    width: 5.8,
    bg: "#301820",
    accent: "#e08aa8",
    emissive: 0xe08aa8,
  });
  makeShopSign("کافه فوتون", 15, 3.0, 10, -Math.PI / 2, {
    width: 5.2,
    bg: "#1c1810",
    accent: "#e8b87a",
    emissive: 0xe8b87a,
  });
  makeShopSign("مسیر امن | AmenRoad", 19, 3.2, 14, -Math.PI / 2, {
    width: 7.2,
    bg: "#0c1f1a",
    accent: "#7dcb9e",
    emissive: 0x7dcb9e,
    fontSize: 58,
  });
  makeShopSign("کافه رستوران گیلان", -6, 2.9, -14, 0.2, {
    width: 6.5,
    bg: "#201810",
    accent: "#c9a56a",
  });
  makeShopSign("شیرینی‌فروشی سنتی", -4, 2.85, 14, Math.PI, {
    width: 6.2,
    bg: "#281818",
    accent: "#e0a070",
    emissive: 0xe0a070,
  });
}

function makeSquareGround() {
  const ground = addShadow(
    new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat(0xc8c2b6, { roughness: 0.95 }))
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Subtle paving strips (lightweight grid)
  const stripMat = mat(0xbdb7ab, { roughness: 0.95 });
  for (let i = -40; i <= 40; i += 4) {
    const sx = addShadow(new THREE.Mesh(new THREE.BoxGeometry(90, 0.02, 0.15), stripMat));
    sx.position.set(0, 0.02, i);
    scene.add(sx);
    const sz = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 90), stripMat));
    sz.position.set(i, 0.02, 0);
    scene.add(sz);
  }
}

function buildScene() {
  makeSquareGround();
  makeMunicipalityBuilding();

  // Surrounding context — named landmarks around the square
  makeSurroundBuilding(8, -28, 22, 8, 9, 0, 0x6e3a2a); // south — هتل ایران
  makeSurroundBuilding(28, 0, 10, 24, 10, Math.PI / 2, 0x4a4a4a); // east — موزه پست
  makeSurroundBuilding(6, 28, 24, 8, 8.5, Math.PI, 0x8c2f2f); // north — کتابخانه ملی

  // Extra low shopfronts along pedestrian edges
  makeSurroundBuilding(20, -14, 8, 6, 5.5, -Math.PI / 2, 0x5a3a2a);
  makeSurroundBuilding(20, 14, 8, 6, 5.5, -Math.PI / 2, 0x4a4a3a);

  makeFountain();
  placeSquareSigns();

  // Trees along edges
  const treeSpots = [
    [-8, -20], [-4, -22], [4, -22], [10, -20],
    [-8, 20], [-2, 22], [6, 22], [12, 20],
    [20, -10], [22, -4], [22, 4], [20, 10],
    [-10, -12], [-10, 12],
  ];
  treeSpots.forEach(([x, z], i) => makeTree(x, z, 0.85 + (i % 3) * 0.12));

  // Lamps
  [[-6, -10], [10, -10], [10, 10], [-6, 10], [16, 0], [0, -16], [0, 16]].forEach(([x, z]) =>
    makeLamppost(x, z)
  );

  // Benches
  makeBench(8, 6, -0.4);
  makeBench(8, -6, 0.4);
  makeBench(-2, 8, Math.PI);
  makeBench(-2, -8, 0);

  // Pedestrian silhouettes
  makePedestrian(5, 4, 0x2a2a32);
  makePedestrian(7, -3, 0x333028);
  makePedestrian(-4, 5, 0x2c2830);
  makePedestrian(12, 2, 0x303030);
  makePedestrian(3, 12, 0x252528);
}

/* =========================================================
   Player controls
   ========================================================= */
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const spawn = new THREE.Vector3(0, 1.7, 18);
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;
const playerHeight = 1.7;
const gravity = 28;
const walkSpeed = 12;
const runSpeed = 24;

const keys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
  jump: false,
};

const avatar = new THREE.Group();
const avatarBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 4, 8), mat(0x1a3d2e));
avatarBody.position.y = 0.9;
avatar.add(avatarBody);
const avatarHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), mat(0xc9a56a));
avatarHead.position.y = 1.75;
avatar.add(avatarHead);
avatar.visible = false;
scene.add(avatar);

function resetPlayer() {
  controls.getObject().position.copy(spawn);
  velocity.set(0, 0, 0);
  canJump = true;
}

function updateHudMode() {
  const day = isNight ? "شب" : "روز";
  const cam = thirdPerson ? "سوم‌شخص" : "اول‌شخص";
  hudMode.textContent = `${day} · ${cam}`;
}

function setNight(night) {
  isNight = night;
  if (night) {
    scene.background = new THREE.Color(0x05080f);
    scene.fog.color.set(0x05080f);
    scene.fog.near = 20;
    scene.fog.far = 90;
    ambient.intensity = 0.12;
    sun.visible = false;
    moon.visible = true;
    nightAccent.visible = true;
    lampLights.forEach((l) => {
      l.intensity = 1.4;
    });
    neonMeshes.forEach((m) => {
      if (m.material && m.material.emissive) {
        if (m.material.map) {
          m.material.emissiveIntensity = 0.85;
        } else if (m.material.color && m.material.color.getHex() === 0x2a7faa) {
          m.material.emissive.setHex(0x124a66);
          m.material.emissiveIntensity = 0.45;
        } else if (m.material.color && m.material.color.getHex() === 0xfff2c2) {
          m.material.emissive.setHex(0xffd27a);
          m.material.emissiveIntensity = 1.2;
        } else {
          m.material.emissiveIntensity = Math.max(m.material.emissiveIntensity, 0.6);
        }
      }
    });
  } else {
    scene.background = new THREE.Color(0x87b8d8);
    scene.fog.color.set(0x87b8d8);
    scene.fog.near = 40;
    scene.fog.far = 140;
    ambient.intensity = 0.45;
    sun.visible = true;
    moon.visible = false;
    nightAccent.visible = false;
    lampLights.forEach((l) => {
      l.intensity = 0;
    });
    neonMeshes.forEach((m) => {
      if (m.material && m.material.emissive) {
        if (m.material.map) m.material.emissiveIntensity = 0.15;
        else {
          m.material.emissive.setHex(0x000000);
          m.material.emissiveIntensity = 0;
        }
      }
    });
  }
  updateHudMode();
}

function setThirdPerson(on) {
  thirdPerson = on;
  avatar.visible = on;
  if (on) {
    camera.position.set(0, 1.25, 5.2);
  } else {
    camera.position.set(0, 0, 0);
  }
  updateHudMode();
}

function updateClockHands() {
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourAngle = -((h + m / 60) * (Math.PI * 2)) / 12;
  const minuteAngle = -((m + s / 60) * (Math.PI * 2)) / 60;
  clockHands.forEach(({ hour, minute }) => {
    hour.rotation.z = hourAngle;
    minute.rotation.z = minuteAngle;
  });
}

function animateFountain(t) {
  if (!fountainSpray) return;
  const pos = fountainSpray.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    let y = pos.getY(i) + 0.04 + (i % 5) * 0.002;
    if (y > 3.2) y = Math.random() * 0.3;
    pos.setY(i, y);
    pos.setX(i, Math.sin(t * 2 + i) * 0.15 * (y / 3));
    pos.setZ(i, Math.cos(t * 2 + i * 0.7) * 0.15 * (y / 3));
  }
  pos.needsUpdate = true;
}

/* =========================================================
   Input
   ========================================================= */
startBtn.addEventListener("click", () => controls.lock());

controls.addEventListener("lock", () => {
  blocker.style.display = "none";
  hud.hidden = false;
});

controls.addEventListener("unlock", () => {
  blocker.style.display = "grid";
  hud.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (appMode !== "walk") return;
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      keys.forward = true;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.back = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = true;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      keys.run = true;
      break;
    case "Space":
      keys.jump = true;
      if (canJump) {
        velocity.y = 9.5;
        canJump = false;
      }
      e.preventDefault();
      break;
    case "KeyN":
      setNight(!isNight);
      break;
    case "KeyC":
      setThirdPerson(!thirdPerson);
      break;
    case "KeyR":
      resetPlayer();
      break;
    default:
      break;
  }
});

document.addEventListener("keyup", (e) => {
  if (appMode !== "walk") return;
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      keys.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      keys.back = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      keys.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      keys.right = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      keys.run = false;
      break;
    case "Space":
      keys.jump = false;
      break;
    default:
      break;
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  routeMode.resize();
});

/* =========================================================
   Loop
   ========================================================= */
const clock = new THREE.Clock();
const routeMode = createRouteMode(renderer);

function setAppMode(mode) {
  if (mode === appMode) return;
  appMode = mode;
  document.body.classList.toggle("is-walk", mode === "walk");
  document.body.classList.toggle("is-route", mode === "route");

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const on = btn.getAttribute("data-mode") === mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });

  if (mode === "route") {
    if (controls.isLocked) controls.unlock();
    hud.hidden = true;
    blocker.style.display = "none";
    routeMode.setActive(true);
  } else {
    routeMode.setActive(false);
    blocker.style.display = "grid";
    hud.hidden = true;
  }
}

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setAppMode(btn.getAttribute("data-mode")));
});

function updatePlayer(delta) {
  const obj = controls.getObject();

  velocity.x -= velocity.x * 8.0 * delta;
  velocity.z -= velocity.z * 8.0 * delta;
  velocity.y -= gravity * delta;

  direction.z = Number(keys.forward) - Number(keys.back);
  direction.x = Number(keys.right) - Number(keys.left);
  direction.normalize();

  const speed = keys.run ? runSpeed : walkSpeed;
  if (keys.forward || keys.back) velocity.z -= direction.z * speed * delta;
  if (keys.left || keys.right) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);
  obj.position.y += velocity.y * delta;

  // Soft bounds
  obj.position.x = THREE.MathUtils.clamp(obj.position.x, -40, 40);
  obj.position.z = THREE.MathUtils.clamp(obj.position.z, -40, 40);

  if (obj.position.y < playerHeight) {
    velocity.y = 0;
    obj.position.y = playerHeight;
    canJump = true;
  }

  if (thirdPerson) {
    avatar.position.set(obj.position.x, 0, obj.position.z);
    avatar.rotation.y = obj.rotation.y;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (appMode === "route") {
    routeMode.update(delta);
    if (!routeMode.render()) {
      // Map picking phase — still clear canvas under leaflet
      renderer.setClearColor(0x050c10, 1);
      renderer.clear();
    }
    return;
  }

  if (controls.isLocked) updatePlayer(delta);
  updateClockHands();
  animateFountain(t);
  renderer.render(scene, camera);
}

/* =========================================================
   Boot
   ========================================================= */
buildScene();
resetPlayer();
setNight(false);
setThirdPerson(false);
updateHudMode();
routeMode.setActive(false);
animate();
