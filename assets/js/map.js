/**
 * rasht.city — interactive map (Leaflet + OpenStreetMap)
 * Free, no API key, no backend. Safe for GitHub Pages.
 *
 * Loaded after Leaflet via CDN. Exposed as window.initRashtMap().
 */

/* Reusable map config — edit markers/zoom here */
const MAP_CONFIG = {
  center: [37.27581843337589, 49.59070186234632], // AmenRoad
  zoom: 17,
  minZoom: 11,
  maxZoom: 18,
  /* Standard OSM raster tiles — free, attribution required */
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileOptions: {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  },
  markers: [
    {
      id: "amenroad",
      lat: 37.27581843337589,
      lon: 49.59070186234632,
      label: "AmenRoad",
      popup: "<strong>AmenRoad</strong>",
      primary: true,
    },
    {
      id: "municipality",
      lat: 37.2786,
      lon: 49.5846,
      label: "میدان شهرداری",
      popup:
        "<strong>میدان شهرداری رشت</strong><br>نماد شهری رشت با عمارت تاریخی شهرداری و فضای پیاده‌مدار.",
    },
    {
      id: "bazaar",
      lat: 37.2768,
      lon: 49.5882,
      label: "بازار بزرگ",
      popup:
        "<strong>بازار بزرگ رشت</strong><br>بازار سنتی شهر؛ ادویه، ماهی تازه و طعم‌های گیلانی.",
    },
  ],
};

let rashtMapInstance = null;

function setMapStatus(message, kind) {
  const el = document.getElementById("map-status");
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.className = "map-status";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = `map-status state ${kind || ""}`;
}

function createAccentIcon(isPrimary) {
  return L.divIcon({
    className: `rasht-marker${isPrimary ? " is-primary" : ""}`,
    html: `
      <span class="rasht-marker-pulse" aria-hidden="true"></span>
      <span class="rasht-marker-pin" aria-hidden="true"></span>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function renderMapChips(map, markerById) {
  const host = document.getElementById("map-chips");
  if (!host) return;

  host.innerHTML = MAP_CONFIG.markers
    .map(
      (m) => `
      <button type="button" class="map-chip${m.primary ? " is-primary" : ""}" data-marker="${m.id}">
        ${m.label}
      </button>`
    )
    .join("");

  host.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-marker]");
    if (!btn) return;
    const id = btn.getAttribute("data-marker");
    const entry = markerById.get(id);
    if (!entry) return;

    map.flyTo(entry.latLng, Math.max(map.getZoom(), 15), { duration: 0.85 });
    entry.marker.openPopup();

    host.querySelectorAll(".map-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip === btn);
    });
  });
}

/**
 * Initialize the Rasht map. Safe to call once from main.js boot.
 */
function initRashtMap() {
  const canvas = document.getElementById("rasht-map");
  if (!canvas) return;
  if (rashtMapInstance) return rashtMapInstance;

  if (typeof L === "undefined") {
    setMapStatus("کتابخانه نقشه بارگذاری نشد. اتصال اینترنت را بررسی کنید.", "error");
    return null;
  }

  try {
    const map = L.map(canvas, {
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      scrollWheelZoom: true,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    L.tileLayer(MAP_CONFIG.tileUrl, MAP_CONFIG.tileOptions).addTo(map);

    const markerById = new Map();

    MAP_CONFIG.markers.forEach((place) => {
      const latLng = [place.lat, place.lon];
      const marker = L.marker(latLng, {
        icon: createAccentIcon(Boolean(place.primary)),
        title: place.label,
        keyboard: true,
        riseOnHover: true,
      }).addTo(map);

      marker.bindPopup(
        `<div class="rasht-popup" dir="rtl">${place.popup}</div>`,
        {
          className: "rasht-popup-wrap",
          maxWidth: 260,
          autoPanPadding: [24, 24],
        }
      );

      markerById.set(place.id, { marker, latLng });
    });

    const primary = MAP_CONFIG.markers.find((m) => m.primary) || MAP_CONFIG.markers[0];
    const openPrimaryPopup = () => {
      if (primary) markerById.get(primary.id)?.marker.openPopup();
    };
    openPrimaryPopup();

    renderMapChips(map, markerById);

    // Leaflet needs a size recalc after layout / fonts / responsive panels
    const refreshSize = () => {
      map.invalidateSize({ animate: false });
      openPrimaryPopup();
    };
    requestAnimationFrame(refreshSize);
    setTimeout(refreshSize, 250);
    window.addEventListener("resize", () => map.invalidateSize({ animate: false }), {
      passive: true,
    });

    rashtMapInstance = map;
    setMapStatus("");
    return map;
  } catch (err) {
    console.error("Map init error:", err);
    setMapStatus("نقشه بارگذاری نشد. لطفاً صفحه را دوباره باز کنید.", "error");
    return null;
  }
}

window.initRashtMap = initRashtMap;
window.MAP_CONFIG = MAP_CONFIG;
