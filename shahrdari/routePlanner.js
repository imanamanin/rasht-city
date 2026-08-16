/**
 * routePlanner.js — Geo helpers, OSRM routing, 3D neon path
 * Rasht center: 37.2808, 49.5832
 */

import * as THREE from "three";

export const RASHT = { lat: 37.2808, lon: 49.5832 };

/** Approx meters per degree */
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = 111320 * Math.cos((RASHT.lat * Math.PI) / 180);

/** World units: 1 unit ≈ 1 meter */
export function latLonToWorld(lat, lon, y = 0.35) {
  const x = (lon - RASHT.lon) * M_PER_DEG_LON;
  const z = -(lat - RASHT.lat) * M_PER_DEG_LAT;
  return new THREE.Vector3(x, y, z);
}

export function worldToLatLon(x, z) {
  const lon = RASHT.lon + x / M_PER_DEG_LON;
  const lat = RASHT.lat - z / M_PER_DEG_LAT;
  return { lat, lon };
}

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Fetch bike route from public OSRM demo.
 * Fallback: procedural polyline with slight road-like bends.
 */
export async function fetchBikeRoute(start, end) {
  const url =
    `https://router.project-osrm.org/route/v1/cycling/` +
    `${start.lon},${start.lat};${end.lon},${end.lat}` +
    `?overview=full&geometries=geojson&steps=false`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error("empty route");

    const coords = route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
    return {
      coords,
      distanceM: route.distance,
      durationS: route.duration,
      source: "osrm",
    };
  } catch (err) {
    console.warn("OSRM failed, using fallback path:", err);
    return buildFallbackRoute(start, end);
  }
}

function buildFallbackRoute(start, end) {
  const coords = [];
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    // Mild lateral wobble to feel road-like
    const lat =
      start.lat +
      (end.lat - start.lat) * t +
      Math.sin(t * Math.PI * 2) * 0.0012;
    const lon =
      start.lon +
      (end.lon - start.lon) * t +
      Math.cos(t * Math.PI * 3) * 0.001;
    coords.push({ lat, lon });
  }
  const distanceM = haversineKm(start, end) * 1000 * 1.12;
  const durationS = distanceM / 4.2; // ~15 km/h
  return { coords, distanceM, durationS, source: "fallback" };
}

/** Estimate a gentle elevation profile (meters) for HUD */
export function estimateElevation(coords) {
  if (coords.length < 2) return { gain: 0, loss: 0, profile: [] };
  const profile = [];
  let gain = 0;
  let loss = 0;
  let prev = 12;
  coords.forEach((c, i) => {
    const n =
      10 +
      Math.sin(c.lat * 80 + c.lon * 60) * 8 +
      Math.sin(i * 0.35) * 3;
    profile.push(n);
    if (i > 0) {
      const d = n - prev;
      if (d > 0) gain += d;
      else loss += -d;
    }
    prev = n;
  });
  return { gain, loss, profile };
}

/**
 * Build glowing tube path + curve from lat/lon coords.
 */
export function buildRoutePath(coords, elevProfile = null) {
  const points = coords.map((c, i) => {
    const elev = elevProfile ? elevProfile[i] * 0.35 : 0.4;
    return latLonToWorld(c.lat, c.lon, 1.2 + elev * 0.015);
  });

  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.15);
  const tubularSegments = Math.min(800, Math.max(100, points.length * 4));
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.9, 8, false);

  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    emissive: 0x00ffcc,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.2,
    transparent: true,
    opacity: 0.92,
  });

  const tube = new THREE.Mesh(geometry, material);

  // Soft outer glow shell
  const glowGeo = new THREE.TubeGeometry(curve, tubularSegments, 1.8, 8, false);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);

  const group = new THREE.Group();
  group.add(tube);
  group.add(glow);

  return { group, curve, points };
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} متر`;
  return `${(meters / 1000).toFixed(2)} کیلومتر`;
}

export function formatDuration(seconds) {
  const min = Math.max(1, Math.round(seconds / 60));
  return `${min} دقیقه`;
}

export function formatElevation(gain, loss) {
  return `+${Math.round(gain)} / −${Math.round(loss)} م`;
}
