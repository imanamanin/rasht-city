/**
 * pois.js — Fetch real named places along a route (Overpass / OSM)
 * Fallback: curated Rasht shops & landmarks near the city center.
 */

import * as THREE from "three";
import { latLonToWorld } from "./routePlanner.js";

/** Well-known places around Rasht Municipality / Golsar / Motahari (approx coords) */
export const RASHT_FALLBACK_POIS = [
  { name: "کافه فوتون", lat: 37.2795, lon: 49.5848, kind: "cafe" },
  { name: "کافه گندم", lat: 37.2815, lon: 49.582, kind: "cafe" },
  { name: "کافه نیمکت", lat: 37.2802, lon: 49.5855, kind: "cafe" },
  { name: "کافه تینوش", lat: 37.2788, lon: 49.5835, kind: "cafe" },
  { name: "کافه شاباجی", lat: 37.2765, lon: 49.5885, kind: "cafe" },
  { name: "هتل ایران", lat: 37.2818, lon: 49.5838, kind: "hotel" },
  { name: "موزه پست", lat: 37.2812, lon: 49.5852, kind: "museum" },
  { name: "کتابخانه ملی", lat: 37.2805, lon: 49.5815, kind: "library" },
  { name: "سینما سپیدرود", lat: 37.279, lon: 49.586, kind: "cinema" },
  { name: "سینما ۲۲ بهمن", lat: 37.2775, lon: 49.584, kind: "cinema" },
  { name: "بازار بزرگ رشت", lat: 37.2755, lon: 49.589, kind: "market" },
  { name: "سبزه میدان", lat: 37.274, lon: 49.59, kind: "park" },
  { name: "پاساژ پاسارگاد", lat: 37.278, lon: 49.587, kind: "mall" },
  { name: "مرکز خرید رز", lat: 37.277, lon: 49.5825, kind: "mall" },
  { name: "شهرداری رشت", lat: 37.2808, lon: 49.5832, kind: "gov" },
  { name: "کافه ترنج", lat: 37.27, lon: 49.575, kind: "cafe" },
  { name: "کافه آرتیست", lat: 37.298, lon: 49.592, kind: "cafe" },
  { name: "کافه آولوس", lat: 37.297, lon: 49.588, kind: "cafe" },
  { name: "کافه ارسی", lat: 37.296, lon: 49.59, kind: "cafe" },
  { name: "کافه جنگا", lat: 37.301, lon: 49.585, kind: "cafe" },
  { name: "رستوران رازقی", lat: 37.295, lon: 49.591, kind: "restaurant" },
  { name: "مسیر امن | AmenRoad", lat: 37.2758, lon: 49.5907, kind: "shop" },
];

function sampleRoutePoints(coords, everyMeters = 90) {
  if (!coords?.length) return [];
  const out = [coords[0]];
  let acc = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const a = coords[i - 1];
    const b = coords[i];
    const dlat = (b.lat - a.lat) * 111320;
    const dlon = (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    acc += Math.hypot(dlat, dlon);
    if (acc >= everyMeters) {
      out.push(b);
      acc = 0;
    }
  }
  out.push(coords[coords.length - 1]);
  return out;
}

/**
 * Query Overpass for named shops/amenities near route samples.
 */
export async function fetchPoisAlongRoute(coords) {
  const samples = sampleRoutePoints(coords, 120).slice(0, 18);
  if (!samples.length) return [];

  const aroundBlocks = samples
    .map(
      (p) => `
  node(around:70,${p.lat},${p.lon})["name"]["shop"];
  node(around:70,${p.lat},${p.lon})["name"]["amenity"~"cafe|restaurant|fast_food|bank|pharmacy|marketplace|cinema|library|theatre"];
  node(around:70,${p.lat},${p.lon})["name"]["tourism"~"hotel|museum|attraction"];
  node(around:70,${p.lat},${p.lon})["name"]["building"];
`
    )
    .join("\n");

  const query = `
[out:json][timeout:20];
(
${aroundBlocks}
);
out body 80;
`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const json = await res.json();
    const seen = new Set();
    const pois = [];
    for (const el of json.elements || []) {
      const name = el.tags?.name;
      if (!name || seen.has(name)) continue;
      if (!el.lat || !el.lon) continue;
      seen.add(name);
      pois.push({
        name: String(name).slice(0, 42),
        lat: el.lat,
        lon: el.lon,
        kind: el.tags.shop || el.tags.amenity || el.tags.tourism || "place",
        source: "overpass",
      });
      if (pois.length >= 40) break;
    }
    if (pois.length >= 4) return pois;
    throw new Error("too few POIs");
  } catch (err) {
    console.warn("Overpass POI fetch failed, using curated Rasht list:", err);
    return pickFallbackNearRoute(coords);
  }
}

function pickFallbackNearRoute(coords) {
  // Rank curated POIs by distance to nearest route point
  const scored = RASHT_FALLBACK_POIS.map((poi) => {
    let min = Infinity;
    for (const c of coords) {
      const dlat = (c.lat - poi.lat) * 111320;
      const dlon = (c.lon - poi.lon) * 111320 * Math.cos((poi.lat * Math.PI) / 180);
      const d = Math.hypot(dlat, dlon);
      if (d < min) min = d;
    }
    return { ...poi, dist: min, source: "fallback" };
  })
    .filter((p) => p.dist < 2500)
    .sort((a, b) => a.dist - b.dist);

  return scored.slice(0, 24);
}

function makeSignTexture(text, accent = "#00ffcc") {
  const cnv = document.createElement("canvas");
  cnv.width = 768;
  cnv.height = 192;
  const ctx = cnv.getContext("2d");
  ctx.fillStyle = "#101a16";
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, cnv.width - 20, cnv.height - 20);
  ctx.fillStyle = "#f2f7f4";
  ctx.font = "bold 56px Vazirmatn, Tahoma, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, cnv.width / 2, cnv.height / 2);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Place shop signs on BOTH sides of the road along the curve,
 * using real POI names (projected beside the path).
 */
export function placeRoadsideSigns(curve, pois, parent) {
  const group = new THREE.Group();
  parent.add(group);
  if (!pois?.length) return group;

  const count = Math.min(28, Math.max(8, pois.length));
  for (let i = 0; i < count; i += 1) {
    const u = (i + 0.5) / count;
    const pos = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).normalize();
    const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const poi = pois[i % pois.length];
    const sideSign = i % 2 === 0 ? 1 : -1;

    // Prefer real POI world position if close to this sample; else offset from path
    let world = latLonToWorld(poi.lat, poi.lon, 0);
    const distToPath = world.clone().setY(0).distanceTo(pos.clone().setY(0));
    if (distToPath > 180) {
      world = pos.clone().addScaledVector(side, sideSign * (22 + (i % 3) * 6));
    } else {
      // Push slightly off the road center
      const fromPath = world.clone().sub(pos);
      fromPath.y = 0;
      if (fromPath.lengthSq() < 4) {
        world.copy(pos).addScaledVector(side, sideSign * 24);
      } else {
        world.addScaledVector(fromPath.normalize(), 4);
      }
    }

    const accents = ["#00ffcc", "#c9a56a", "#7dcb9e", "#e08a7a", "#8ab4e0"];
    const tex = makeSignTexture(poi.name, accents[i % accents.length]);
    const w = Math.min(18, Math.max(8, poi.name.length * 0.55));
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(w, 3.2),
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0x00ffcc),
        emissiveIntensity: 0.55,
        roughness: 0.5,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })
    );
    board.position.set(world.x, 6.5, world.z);
    // Face toward the road
    board.lookAt(pos.x, 6.5, pos.z);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 6.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    post.position.set(world.x, 3.25, world.z);

    // Small shopfront block behind sign
    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(14 + (i % 3) * 4, 10 + (i % 4) * 3, 10),
      new THREE.MeshStandardMaterial({
        color: 0x15241f,
        roughness: 0.9,
        emissive: 0x04140f,
        emissiveIntensity: 0.25,
      })
    );
    const shopPos = world.clone().addScaledVector(side, sideSign * 8);
    shop.position.set(shopPos.x, shop.geometry.parameters.height / 2, shopPos.z);

    group.add(shop);
    group.add(post);
    group.add(board);
  }

  return group;
}
