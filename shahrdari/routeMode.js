/**
 * routeMode.js — Interactive A→B planner + Strava-style 3D flyover
 */

import * as THREE from "three";
import {
  RASHT,
  latLonToWorld,
  fetchBikeRoute,
  estimateElevation,
  buildRoutePath,
  formatDistance,
  formatDuration,
  formatElevation,
} from "./routePlanner.js";
import { createRider, createFlyoverController } from "./flyoverCamera.js";

const BOUNDS = {
  south: 37.22,
  north: 37.34,
  west: 49.48,
  east: 49.68,
};

const DISTRICTS = [
  { name: "گلزار", lat: 37.295, lon: 49.575 },
  { name: "شهرداری", lat: 37.2808, lon: 49.5832 },
  { name: "سبزه میدان", lat: 37.275, lon: 49.588 },
  { name: "مطهری", lat: 37.268, lon: 49.575 },
  { name: "منظریه", lat: 37.29, lon: 49.56 },
  { name: "گلسار", lat: 37.3, lon: 49.59 },
];

export function createRouteMode(renderer) {
  const shell = document.getElementById("route-shell");
  const mapEl = document.getElementById("route-map");
  const promptText = document.getElementById("route-prompt-text");
  const metricsEl = document.getElementById("route-metrics");
  const flyControls = document.getElementById("flyover-controls");
  const mDist = document.getElementById("m-dist");
  const mTime = document.getElementById("m-time");
  const mElev = document.getElementById("m-elev");
  const btnFly = document.getElementById("btn-flyover");
  const btnReset = document.getElementById("btn-reset-route");
  const btnPlay = document.getElementById("btn-play");
  const btnRewind = document.getElementById("btn-rewind");
  const btnBackMap = document.getElementById("btn-back-map");
  const flySpeed = document.getElementById("fly-speed");
  const flyScrub = document.getElementById("fly-scrub");
  const flyStatus = document.getElementById("fly-status");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050c10);
  scene.fog = new THREE.FogExp2(0x050c10, 0.0016);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    1,
    8000
  );
  camera.position.set(0, 420, 520);

  const hemi = new THREE.HemisphereLight(0x88aacc, 0x0a1210, 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0x00ffcc, 0.35);
  key.position.set(80, 200, 40);
  scene.add(key);
  const fill = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(fill);

  const cityRoot = new THREE.Group();
  scene.add(cityRoot);
  const routeRoot = new THREE.Group();
  scene.add(routeRoot);

  let map = null;
  let startMarker = null;
  let endMarker = null;
  let routeLine = null;
  let pickStep = "start"; // start | end | ready
  let startLL = null;
  let endLL = null;
  let routeData = null;
  let flyover = null;
  let rider = null;
  let flying = false;
  let active = false;

  function pinIcon(cls) {
    return L.divIcon({
      className: "",
      html: `<div class="${cls}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 18],
    });
  }

  function initMap() {
    if (map || typeof L === "undefined") return;
    map = L.map(mapEl, {
      zoomControl: true,
      attributionControl: true,
    }).setView([RASHT.lat, RASHT.lon], 13);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    L.rectangle(
      [
        [BOUNDS.south, BOUNDS.west],
        [BOUNDS.north, BOUNDS.east],
      ],
      { color: "#00ffcc", weight: 1, fillOpacity: 0.03, dashArray: "4 6" }
    ).addTo(map);

    map.on("click", onMapClick);
    setTimeout(() => map.invalidateSize(), 120);
  }

  function inBounds(lat, lon) {
    return (
      lat >= BOUNDS.south &&
      lat <= BOUNDS.north &&
      lon >= BOUNDS.west &&
      lon <= BOUNDS.east
    );
  }

  async function onMapClick(e) {
    if (flying) return;
    const { lat, lng: lon } = e.latlng;
    if (!inBounds(lat, lon)) {
      promptText.textContent = "لطفاً داخل محدوده رشت کلیک کنید";
      return;
    }

    if (pickStep === "start" || pickStep === "ready") {
      resetRoute(false);
      startLL = { lat, lon };
      startMarker = L.marker([lat, lon], { icon: pinIcon("pin-start") }).addTo(map);
      pickStep = "end";
      promptText.textContent = "نقطه مقصد را انتخاب کنید";
      metricsEl.hidden = true;
      return;
    }

    if (pickStep === "end") {
      endLL = { lat, lon };
      endMarker = L.marker([lat, lon], { icon: pinIcon("pin-end") }).addTo(map);
      pickStep = "routing";
      promptText.textContent = "در حال محاسبه مسیر دوچرخه…";
      await computeRoute();
    }
  }

  async function computeRoute() {
    routeData = await fetchBikeRoute(startLL, endLL);
    const elev = estimateElevation(routeData.coords);
    routeData.elev = elev;

    if (routeLine) map.removeLayer(routeLine);
    routeLine = L.polyline(
      routeData.coords.map((c) => [c.lat, c.lon]),
      { color: "#00ffcc", weight: 5, opacity: 0.9 }
    ).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    mDist.textContent = formatDistance(routeData.distanceM);
    mTime.textContent = formatDuration(routeData.durationS);
    mElev.textContent = formatElevation(elev.gain, elev.loss);
    metricsEl.hidden = false;
    pickStep = "ready";
    promptText.textContent =
      routeData.source === "osrm"
        ? "مسیر آماده است — پرواز سه‌بعدی را شروع کنید"
        : "مسیر تقریبی (آفلاین) — پرواز سه‌بعدی را شروع کنید";
  }

  function buildCityContext(curve) {
    while (cityRoot.children.length) {
      const c = cityRoot.children[0];
      cityRoot.remove(c);
      c.geometry?.dispose?.();
    }

    // Dark ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0x0b1512, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    cityRoot.add(ground);

    // Grid
    const grid = new THREE.GridHelper(5000, 80, 0x14503f, 0x0e2a22);
    grid.position.y = 0.2;
    cityRoot.add(grid);

    // Procedural blocks near path
    const matB = new THREE.MeshStandardMaterial({
      color: 0x1a2a26,
      roughness: 0.85,
      emissive: 0x06221a,
      emissiveIntensity: 0.2,
    });
    const samples = 60;
    for (let i = 0; i < samples; i += 1) {
      const u = i / samples;
      const p = curve.getPointAt(u);
      const t = curve.getTangentAt(u).normalize();
      const side = new THREE.Vector3(-t.z, 0, t.x);
      [-1, 1].forEach((s) => {
        if (Math.random() < 0.35) return;
        const h = 18 + Math.random() * 55;
        const box = new THREE.Mesh(new THREE.BoxGeometry(18 + Math.random() * 22, h, 16 + Math.random() * 18), matB);
        box.position.copy(p).addScaledVector(side, s * (28 + Math.random() * 40));
        box.position.y = h / 2;
        cityRoot.add(box);
      });
    }

    // District markers
    DISTRICTS.forEach((d) => {
      const pos = latLonToWorld(d.lat, d.lon, 0);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 4, 6, 10),
        new THREE.MeshStandardMaterial({ color: 0xc9a56a, emissive: 0xc9a56a, emissiveIntensity: 0.35 })
      );
      pillar.position.set(pos.x, 3, pos.z);
      cityRoot.add(pillar);
    });
  }

  function startFlyover() {
    if (!routeData) return;
    flying = true;
    shell.classList.add("is-flying");
    flyControls.hidden = false;

    while (routeRoot.children.length) routeRoot.remove(routeRoot.children[0]);

    const { group, curve } = buildRoutePath(routeData.coords, routeData.elev?.profile);
    routeRoot.add(group);
    buildCityContext(curve);

    rider = createRider();
    routeRoot.add(rider);
    flyover = createFlyoverController(camera, curve);
    flyover.state.speed = Number(flySpeed.value) || 2;
    flyover.rewind();
    flyover.applyToRider(rider, 0);
    flyover.applyCamera(0);
    flyover.state.playing = true;
    btnPlay.textContent = "⏸ توقف";
    flyStatus.textContent = "پرواز فعال — Space برای توقف";
    flyScrub.value = "0";
  }

  function backToMap() {
    flying = false;
    shell.classList.remove("is-flying");
    flyControls.hidden = true;
    if (flyover) flyover.state.playing = false;
    setTimeout(() => map?.invalidateSize(), 80);
  }

  function resetRoute(clearPrompt = true) {
    backToMap();
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLine) map.removeLayer(routeLine);
    startMarker = endMarker = routeLine = null;
    startLL = endLL = routeData = null;
    pickStep = "start";
    metricsEl.hidden = true;
    if (clearPrompt) promptText.textContent = "نقطه شروع را انتخاب کنید";
    while (routeRoot.children.length) routeRoot.remove(routeRoot.children[0]);
    flyover = null;
    rider = null;
  }

  btnFly?.addEventListener("click", startFlyover);
  btnReset?.addEventListener("click", () => resetRoute(true));
  btnBackMap?.addEventListener("click", backToMap);
  btnRewind?.addEventListener("click", () => {
    if (!flyover) return;
    flyover.rewind();
    if (rider) flyover.applyToRider(rider, 0);
    flyover.applyCamera(0);
    flyScrub.value = "0";
    btnPlay.textContent = "▶ پخش";
    flyStatus.textContent = "از ابتدا";
  });
  btnPlay?.addEventListener("click", () => {
    if (!flyover) return;
    flyover.state.playing = !flyover.state.playing;
    if (flyover.state.t >= 1) {
      flyover.state.t = 0;
      flyover.state.playing = true;
    }
    btnPlay.textContent = flyover.state.playing ? "⏸ توقف" : "▶ پخش";
    flyStatus.textContent = flyover.state.playing ? "در حال پخش…" : "متوقف";
  });
  flySpeed?.addEventListener("change", () => {
    if (flyover) flyover.state.speed = Number(flySpeed.value) || 1;
  });
  flyScrub?.addEventListener("input", () => {
    if (!flyover) return;
    const t = Number(flyScrub.value) / 1000;
    flyover.setProgress(t);
    flyover.state.playing = false;
    if (rider) flyover.applyToRider(rider, t);
    flyover.applyCamera(t);
    btnPlay.textContent = "▶ پخش";
  });

  function onKey(e) {
    if (!active) return;
    if (e.code === "Space" && flying) {
      e.preventDefault();
      btnPlay?.click();
    } else if (e.code === "KeyR") {
      resetRoute(true);
    } else if (e.code === "Escape" && flying) {
      backToMap();
    }
  }
  document.addEventListener("keydown", onKey);

  function setActive(on) {
    active = on;
    if (on) {
      shell.hidden = false;
      initMap();
      setTimeout(() => map?.invalidateSize(), 100);
      if (!startLL) promptText.textContent = "نقطه شروع را انتخاب کنید";
    } else {
      backToMap();
      shell.hidden = true;
    }
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    map?.invalidateSize();
  }

  function update(delta) {
    if (!active || !flying || !flyover) return;
    const st = flyover.update(delta, rider);
    flyScrub.value = String(Math.round(st.t * 1000));
    if (!st.playing && st.t >= 1) {
      btnPlay.textContent = "▶ پخش";
      flyStatus.textContent = "پایان مسیر";
    }
  }

  function render() {
    if (!active || !flying) return false;
    renderer.render(scene, camera);
    return true;
  }

  return {
    setActive,
    resize,
    update,
    render,
    isFlying: () => flying,
    resetRoute,
  };
}
