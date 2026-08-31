/**
 * rasht.city — interactive city map (Leaflet)
 * Minimal Carto tiles · categorized markers · OSRM walking routes
 */

const MAP_DEFAULTS = {
  center: [37.2786, 49.5846],
  zoom: 15,
  mobileZoom: 14,
  minZoom: 12,
  maxZoom: 18,
  placesUrl: "assets/data/rasht-map-places.json",
  /* Minimal dark basemap (Carto) — free with attribution */
  tileUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  tileOptions: {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a> · <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
  },
  routeUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
};

let rashtMapInstance = null;
let mapRuntime = null;

function isMobileMap() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function mapZoomLevel() {
  return isMobileMap() ? MAP_DEFAULTS.mobileZoom : MAP_DEFAULTS.zoom;
}

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

function setRouteStatus(html) {
  const el = document.getElementById("map-route-status");
  if (!el) return;
  if (!html) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = html;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryMeta(categories, id) {
  return categories.find((c) => c.id === id) || { id, label: id, color: "#7dcb9e" };
}

function popupOptions() {
  const mobile = isMobileMap();
  return {
    className: "rasht-popup-wrap",
    maxWidth: mobile ? 280 : 320,
    minWidth: mobile ? 200 : 220,
    autoPan: true,
    keepInView: true,
    autoPanPaddingTopLeft: mobile ? [16, 48] : [24, 24],
    autoPanPaddingBottomRight: mobile ? [16, 72] : [24, 48],
  };
}

function createCategoryIcon(color, isPrimary) {
  return L.divIcon({
    className: `rasht-marker${isPrimary ? " is-primary" : ""}`,
    html: `
      <span class="rasht-marker-pulse" aria-hidden="true" style="--marker-color:${color}"></span>
      <span class="rasht-marker-pin" aria-hidden="true" style="--marker-color:${color}"></span>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function buildPopupHtml(place, cat) {
  const link = place.link
    ? `<a class="rasht-popup-link" href="${escapeHtml(place.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.linkLabel || "وب‌سایت")}</a>`
    : "";
  return `
    <div class="rasht-popup" dir="rtl">
      <span class="rasht-popup-cat" style="--marker-color:${escapeHtml(cat.color)}">${escapeHtml(cat.label)}</span>
      <strong class="rasht-popup-title">${escapeHtml(place.name)}</strong>
      ${place.address ? `<p class="rasht-popup-address">${escapeHtml(place.address)}</p>` : ""}
      ${place.blurb ? `<p class="rasht-popup-blurb">${escapeHtml(place.blurb)}</p>` : ""}
      <div class="rasht-popup-actions">
        <button type="button" class="rasht-popup-route" data-route-to="${escapeHtml(place.id)}">مسیریابی پیاده</button>
        ${link}
      </div>
    </div>
  `;
}

function focusMarker(map, entry, zoom) {
  if (!map || !entry) return;
  const z = zoom ?? Math.max(map.getZoom(), mapZoomLevel());
  map.setView(entry.latLng, z, { animate: true });
  entry.marker.openPopup();
  requestAnimationFrame(() => {
    try {
      const mobile = isMobileMap();
      map.panInside(L.latLng(entry.latLng[0], entry.latLng[1]), {
        paddingTopLeft: mobile ? [12, 70] : [24, 40],
        paddingBottomRight: mobile ? [12, 40] : [24, 40],
        animate: true,
      });
    } catch (_) {
      /* ignore */
    }
  });
}

function clearRoute() {
  if (!mapRuntime) return;
  if (mapRuntime.routeLine) {
    mapRuntime.map.removeLayer(mapRuntime.routeLine);
    mapRuntime.routeLine = null;
  }
  if (mapRuntime.routeStartMarker) {
    mapRuntime.map.removeLayer(mapRuntime.routeStartMarker);
    mapRuntime.routeStartMarker = null;
  }
  mapRuntime.routeTargetId = null;
  setRouteStatus("");
  const clearBtn = document.getElementById("map-route-clear");
  if (clearBtn) clearBtn.hidden = true;
}

function formatRouteMeta(meters, seconds) {
  const km = meters / 1000;
  const dist = km < 1 ? `${Math.round(meters)} متر` : `${km.toFixed(1)} کیلومتر`;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${dist} · حدود ${mins} دقیقه پیاده`;
}

function getStartPoint() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

async function routeToPlace(placeId) {
  if (!mapRuntime) return;
  const entry = mapRuntime.markerById.get(placeId);
  const place = mapRuntime.places.find((p) => p.id === placeId);
  if (!entry || !place) return;

  setRouteStatus(`<span class="state loading">در حال محاسبه مسیر…</span>`);
  const clearBtn = document.getElementById("map-route-clear");
  if (clearBtn) clearBtn.hidden = false;

  let start = await getStartPoint();
  let startLabel = "موقعیت شما";
  if (!start) {
    const amen = mapRuntime.places.find((p) => p.id === "amenroad") || mapRuntime.places[0];
    start = [amen.lat, amen.lon];
    startLabel = amen.name;
  }

  const end = entry.latLng;
  const url =
    `${MAP_DEFAULTS.routeUrl}/` +
    `${start[1]},${start[0]};${end[1]},${end[0]}` +
    `?overview=full&geometries=geojson&steps=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Routing HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) throw new Error("No route");

    clearRoute();
    if (clearBtn) clearBtn.hidden = false;

    const latLngs = route.geometry.coordinates.map((c) => [c[1], c[0]]);
    mapRuntime.routeLine = L.polyline(latLngs, {
      color: "#7dcb9e",
      weight: 5,
      opacity: 0.9,
      lineJoin: "round",
      className: "rasht-route-line",
    }).addTo(mapRuntime.map);

    mapRuntime.routeStartMarker = L.circleMarker(start, {
      radius: 7,
      color: "#e8b87a",
      weight: 2,
      fillColor: "#e8b87a",
      fillOpacity: 0.9,
    })
      .addTo(mapRuntime.map)
      .bindTooltip(startLabel, { direction: "top" });

    mapRuntime.routeTargetId = placeId;
    mapRuntime.map.fitBounds(mapRuntime.routeLine.getBounds(), {
      padding: [40, 40],
      maxZoom: 17,
    });

    setRouteStatus(
      `<strong>مسیر تا ${escapeHtml(place.name)}</strong>` +
        `<span>${escapeHtml(formatRouteMeta(route.distance, route.duration))}</span>` +
        `<span class="map-route-from">از: ${escapeHtml(startLabel)}</span>`
    );
    entry.marker.openPopup();
  } catch (err) {
    console.error("Route error:", err);
    setRouteStatus(`<span class="state error">مسیر محاسبه نشد. اتصال اینترنت را بررسی کنید یا دوباره تلاش کنید.</span>`);
  }
}

function applyCategoryFilter(activeCat) {
  if (!mapRuntime) return;
  mapRuntime.activeCategory = activeCat;
  const bounds = [];

  mapRuntime.markerById.forEach((entry, id) => {
    const place = mapRuntime.places.find((p) => p.id === id);
    const show = activeCat === "all" || place?.category === activeCat;
    if (show) {
      if (!mapRuntime.map.hasLayer(entry.marker)) entry.marker.addTo(mapRuntime.map);
      bounds.push(entry.latLng);
    } else if (mapRuntime.map.hasLayer(entry.marker)) {
      mapRuntime.map.removeLayer(entry.marker);
    }
  });

  document.querySelectorAll("[data-map-cat]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-map-cat") === activeCat);
  });

  if (bounds.length > 1) {
    mapRuntime.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
  } else if (bounds.length === 1) {
    mapRuntime.map.setView(bounds[0], Math.max(mapZoomLevel(), 15));
  }
}

function renderCategoryChips(categories) {
  const host = document.getElementById("map-chips");
  if (!host) return;

  const all = `<button type="button" class="map-chip is-active" data-map-cat="all">همه</button>`;
  const rest = categories
    .map(
      (c) => `
      <button type="button" class="map-chip" data-map-cat="${escapeHtml(c.id)}" style="--chip-accent:${escapeHtml(c.color)}">
        <span class="map-chip-dot" aria-hidden="true"></span>${escapeHtml(c.label)}
      </button>`
    )
    .join("");

  host.innerHTML = all + rest;
  host.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-map-cat]");
    if (!btn) return;
    applyCategoryFilter(btn.getAttribute("data-map-cat") || "all");
  });
}

function bindPopupRouting(map) {
  map.getContainer().addEventListener("click", (event) => {
    const btn = event.target.closest("[data-route-to]");
    if (!btn) return;
    event.preventDefault();
    const id = btn.getAttribute("data-route-to");
    if (id) routeToPlace(id);
  });
}

async function loadPlaces() {
  const res = await fetch(MAP_DEFAULTS.placesUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`places HTTP ${res.status}`);
  return res.json();
}

function initRashtMap() {
  const canvas = document.getElementById("rasht-map");
  if (!canvas) return;
  if (rashtMapInstance) return rashtMapInstance;

  if (typeof L === "undefined") {
    setMapStatus("کتابخانه نقشه بارگذاری نشد. اتصال اینترنت را بررسی کنید.", "error");
    return null;
  }

  loadPlaces()
    .then((data) => {
      const categories = data.categories || [];
      const places = data.places || [];
      const center = data.center || MAP_DEFAULTS.center;

      const map = L.map(canvas, {
        center,
        zoom: mapZoomLevel(),
        minZoom: MAP_DEFAULTS.minZoom,
        maxZoom: MAP_DEFAULTS.maxZoom,
        scrollWheelZoom: true,
        zoomControl: false,
      });

      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer(MAP_DEFAULTS.tileUrl, MAP_DEFAULTS.tileOptions).addTo(map);

      const markerById = new Map();

      places.forEach((place) => {
        const cat = categoryMeta(categories, place.category);
        const latLng = [place.lat, place.lon];
        const marker = L.marker(latLng, {
          icon: createCategoryIcon(cat.color, Boolean(place.primary)),
          title: place.name,
          keyboard: true,
          riseOnHover: true,
        }).addTo(map);

        marker.bindPopup(buildPopupHtml(place, cat), popupOptions());
        markerById.set(place.id, { marker, latLng, place });
      });

      mapRuntime = {
        map,
        places,
        categories,
        markerById,
        activeCategory: "all",
        routeLine: null,
        routeStartMarker: null,
        routeTargetId: null,
      };

      renderCategoryChips(categories);
      bindPopupRouting(map);

      const clearBtn = document.getElementById("map-route-clear");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => clearRoute());
      }

      const primary = places.find((p) => p.primary) || places[0];
      const primaryEntry = primary ? markerById.get(primary.id) : null;
      const focusPrimary = () => {
        if (primaryEntry) focusMarker(map, primaryEntry, mapZoomLevel());
      };

      const refreshSize = () => {
        map.invalidateSize({ animate: false });
        focusPrimary();
      };

      requestAnimationFrame(refreshSize);
      setTimeout(refreshSize, 200);
      setTimeout(refreshSize, 600);

      window.addEventListener(
        "resize",
        () => {
          map.invalidateSize({ animate: false });
        },
        { passive: true }
      );

      const section = document.getElementById("map");
      if (section && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              map.invalidateSize({ animate: false });
            }
          },
          { threshold: 0.25 }
        );
        io.observe(section);
      }

      rashtMapInstance = map;
      setMapStatus("");
    })
    .catch((err) => {
      console.error("Map init error:", err);
      setMapStatus("نقشه یا نقاط بارگذاری نشد. لطفاً صفحه را دوباره باز کنید.", "error");
    });

  return null;
}

window.initRashtMap = initRashtMap;
window.MAP_DEFAULTS = MAP_DEFAULTS;
