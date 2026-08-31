/**
 * rasht.city — MapLibre 3D city map
 * Buildings extrusion · glass POI markers · cinematic Earth→AmenRoad intro
 */
(function () {
  "use strict";

  const AMEN_LNG = 49.59070186234632;
  const AMEN_LAT = 37.27581843337589;

  const CONFIG = {
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    poisUrl: "assets/data/rasht-pois.json",
    buildingSource: "openmaptiles",
    buildingSourceLayer: "building",
    introStorageKey: "rasht.city3d.intro.v1",
    amenView: {
      center: [AMEN_LNG, AMEN_LAT],
      zoom: 17.35,
      pitch: 60,
      bearing: -28,
    },
    squareView: {
      center: [49.5832, 37.2808],
      zoom: 16.5,
      pitch: 60,
      bearing: -20,
    },
    cityView: {
      center: [49.5832, 37.268],
      zoom: 12.35,
      pitch: 48,
      bearing: -20,
    },
    minZoom: 12,
    maxZoom: 18.5,
    maxBounds: [
      [49.48, 37.2],
      [49.7, 37.36],
    ],
    idleRotateSpeed: 0.018,
    idleResumeMs: 9000,
  };

  const FILTER_CHIPS = [
    { id: "all", label: "همه" },
    { id: "cafe_restaurant", label: "خوراک و کافه" },
    { id: "historical", label: "تاریخی" },
    { id: "shopping", label: "بازار و خرید" },
    { id: "culture", label: "فرهنگ و دیدنی" },
  ];

  /** Cinematic beats: deep space → Earth orbit → Iran → Gilan → Rasht → AmenRoad */
  const INTRO_BEATS = [
    {
      center: [-30, 8],
      zoom: 0.85,
      pitch: 0,
      bearing: -120,
      duration: 0,
      caption: "خروج از مدار…",
    },
    {
      center: [10, 18],
      zoom: 1.35,
      pitch: 12,
      bearing: 40,
      duration: 5200,
      caption: "چرخش نرم دور زمین",
    },
    {
      center: [45, 28],
      zoom: 2.6,
      pitch: 20,
      bearing: 95,
      duration: 4200,
      caption: "نزدیک‌شدن به خاورمیانه",
    },
    {
      center: [53.2, 32.4],
      zoom: 4.6,
      pitch: 32,
      bearing: 18,
      duration: 4800,
      caption: "ایران",
    },
    {
      center: [49.7, 37.15],
      zoom: 8.4,
      pitch: 46,
      bearing: -8,
      duration: 3800,
      caption: "گیلان · سواحل خزر",
    },
    {
      center: [49.586, 37.278],
      zoom: 13.4,
      pitch: 55,
      bearing: -18,
      duration: 3200,
      caption: "رشت",
    },
    {
      center: [AMEN_LNG, AMEN_LAT],
      zoom: 17.35,
      pitch: 60,
      bearing: -28,
      duration: 3000,
      caption: "AmenRoad",
    },
  ];

  let map = null;
  let runtime = null;

  function resolvePoisUrl() {
    const root = document.getElementById("rasht-3d-city");
    const custom = root?.dataset?.poisUrl;
    if (custom) return custom;
    const path = window.location.pathname || "";
    if (path.includes("/shahrdari")) return "../assets/data/rasht-pois.json";
    return CONFIG.poisUrl;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(message, kind) {
    const el = document.getElementById("city3d-status");
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      el.className = "city3d-status";
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `city3d-status state ${kind || ""}`;
  }

  function categoryMeta(categories, id) {
    return (
      categories.find((c) => c.id === id) || {
        id,
        label: id,
        color: "#c9a56a",
      }
    );
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function introAlreadyPlayed() {
    try {
      return sessionStorage.getItem(CONFIG.introStorageKey) === "1";
    } catch (_) {
      return false;
    }
  }

  function markIntroPlayed() {
    try {
      sessionStorage.setItem(CONFIG.introStorageKey, "1");
    } catch (_) {
      /* ignore */
    }
  }

  function getAmenPoi() {
    return (
      runtime?.pois.find((p) => p.id === "amenroad" || p.primary) ||
      runtime?.pois.find((p) => /amenroad/i.test(p.name)) ||
      null
    );
  }

  function stopIdleRotate() {
    if (!runtime) return;
    runtime.idleActive = false;
    if (runtime.rafId) {
      cancelAnimationFrame(runtime.rafId);
      runtime.rafId = 0;
    }
  }

  function scheduleIdleResume() {
    if (!runtime || runtime.introPlaying) return;
    clearTimeout(runtime.idleTimer);
    runtime.idleTimer = setTimeout(() => {
      if (runtime?.autoRotateEnabled && !runtime.introPlaying) startIdleRotate();
    }, CONFIG.idleResumeMs);
  }

  function startIdleRotate() {
    if (!map || !runtime || !runtime.autoRotateEnabled || runtime.introPlaying) return;
    if (prefersReducedMotion()) return;
    if (runtime.idleActive) return;
    runtime.idleActive = true;

    const tick = () => {
      if (!runtime?.idleActive || !map || runtime.introPlaying) return;
      map.setBearing(map.getBearing() + CONFIG.idleRotateSpeed);
      runtime.rafId = requestAnimationFrame(tick);
    };
    runtime.rafId = requestAnimationFrame(tick);
  }

  function pauseInteraction() {
    if (runtime?.introPlaying) return;
    stopIdleRotate();
    scheduleIdleResume();
  }

  function lockCityBounds() {
    if (!map) return;
    map.setMinZoom(CONFIG.minZoom);
    map.setMaxZoom(CONFIG.maxZoom);
    map.setMaxBounds(CONFIG.maxBounds);
  }

  function unlockWorldView() {
    if (!map) return;
    map.setMaxBounds(null);
    map.setMinZoom(0);
    map.setMaxZoom(CONFIG.maxZoom);
  }

  function flyToView(view, duration) {
    if (!map) return;
    pauseInteraction();
    map.easeTo({
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
      duration: duration ?? 1600,
      essential: true,
    });
  }

  function easeToPromise(opts) {
    return new Promise((resolve) => {
      if (!map || runtime?.introAbort) {
        resolve(false);
        return;
      }
      const onEnd = () => resolve(true);
      map.once("moveend", onEnd);
      map.easeTo({ ...opts, essential: true });
    });
  }

  function setIntroCaption(text) {
    const el = document.getElementById("city3d-intro-caption");
    if (el) el.textContent = text || "";
  }

  function setIntroUi(playing) {
    const stage = document.querySelector(".city3d-stage");
    const overlay = document.getElementById("city3d-intro-overlay");
    if (stage) stage.classList.toggle("is-intro-playing", playing);
    if (overlay) overlay.hidden = !playing;
  }

  function closeModal() {
    const modal = document.getElementById("city3d-modal");
    if (modal) modal.hidden = true;
    if (runtime) {
      runtime.activePoiId = null;
      runtime.markers.forEach((entry) => {
        entry.el.classList.remove("is-active");
      });
    }
  }

  function openModal(poi, cat) {
    const modal = document.getElementById("city3d-modal");
    const card = document.getElementById("city3d-modal-card");
    if (!modal || !card) return;

    card.style.setProperty("--poi-color", cat.color);
    const routeUrl =
      `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=` +
      `${CONFIG.squareView.center[1]}%2C${CONFIG.squareView.center[0]}%3B${poi.lat}%2C${poi.lng}`;
    const shareText = `${poi.name} — ${poi.address || ""} — rasht.city`.trim();
    const shareUrl = `${window.location.origin}${window.location.pathname}#city3d`;

    card.innerHTML = `
      <div class="city3d-modal-media">
        ${
          poi.image
            ? `<img src="${escapeHtml(poi.image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />`
            : ""
        }
        <button type="button" class="city3d-modal-close" data-city3d-close aria-label="بستن">×</button>
      </div>
      <div class="city3d-modal-body">
        <span class="city3d-modal-cat">${escapeHtml(cat.label)}</span>
        <h3 class="city3d-modal-title">${escapeHtml(poi.name)}</h3>
        ${poi.address ? `<p class="city3d-modal-address">${escapeHtml(poi.address)}</p>` : ""}
        ${poi.blurb ? `<p class="city3d-modal-blurb">${escapeHtml(poi.blurb)}</p>` : ""}
        <div class="city3d-modal-actions">
          <a href="${escapeHtml(routeUrl)}" target="_blank" rel="noopener noreferrer">مسیریابی</a>
          <button type="button" class="is-ghost" data-city3d-share data-share-text="${escapeHtml(shareText)}" data-share-url="${escapeHtml(shareUrl)}">اشتراک‌گذاری</button>
          ${
            poi.link
              ? `<a class="is-ghost" href="${escapeHtml(poi.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(poi.linkLabel || "وب‌سایت")}</a>`
              : ""
          }
        </div>
      </div>
    `;

    modal.hidden = false;
    runtime.activePoiId = poi.id;
    runtime.markers.forEach((entry, id) => {
      entry.el.classList.toggle("is-active", id === poi.id);
    });
  }

  async function sharePoi(btn) {
    const text = btn.getAttribute("data-share-text") || "rasht.city";
    const url = btn.getAttribute("data-share-url") || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
    } catch (_) {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setStatus("لینک کپی شد.", "");
      setTimeout(() => setStatus(""), 1800);
    } catch (_) {
      setStatus("اشتراک‌گذاری در دسترس نیست.", "error");
    }
  }

  function focusPoi(poi) {
    if (!map || !runtime || runtime.introPlaying) return;
    const cat = categoryMeta(runtime.categories, poi.category);
    pauseInteraction();
    map.flyTo({
      center: [poi.lng, poi.lat],
      zoom: Math.max(map.getZoom(), 17.2),
      pitch: 58,
      bearing: map.getBearing(),
      duration: 1400,
      essential: true,
    });
    openModal(poi, cat);
  }

  function createMarkerElement(poi, cat) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `city3d-marker${poi.primary ? " is-primary" : ""}`;
    el.style.setProperty("--poi-color", cat.color);
    el.setAttribute("aria-label", `${poi.name}${poi.address ? ` — ${poi.address}` : ""}`);
    el.title = poi.address ? `${poi.name}\n${poi.address}` : poi.name;

    if (poi.primary) {
      const label = document.createElement("span");
      label.className = "city3d-marker-label";
      label.innerHTML = `<strong>${escapeHtml(poi.name)}</strong><small>${escapeHtml(poi.address || "")}</small>`;
      el.appendChild(label);
    }

    el.addEventListener("click", (event) => {
      event.stopPropagation();
      focusPoi(poi);
    });
    return el;
  }

  function clearMarkers() {
    if (!runtime) return;
    runtime.markers.forEach((entry) => entry.marker.remove());
    runtime.markers.clear();
  }

  function renderMarkers(filterId) {
    if (!map || !runtime) return;
    clearMarkers();
    const active = filterId || runtime.activeFilter || "all";
    runtime.activeFilter = active;

    runtime.pois.forEach((poi) => {
      const isPrimary = Boolean(poi.primary);
      if (active !== "all" && poi.category !== active && !isPrimary) return;
      const cat = categoryMeta(runtime.categories, poi.category);
      const el = createMarkerElement(poi, cat);
      const marker = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
        offset: isPrimary ? [0, -4] : [0, 0],
      })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map);
      runtime.markers.set(poi.id, { marker, el, poi });
    });

    document.querySelectorAll("[data-city3d-filter]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-city3d-filter") === active);
    });
  }

  function finishIntro({ skipped } = {}) {
    if (!runtime) return;
    runtime.introPlaying = false;
    runtime.introAbort = false;
    setIntroUi(false);
    setIntroCaption("");
    lockCityBounds();
    markIntroPlayed();
    renderMarkers(runtime.activeFilter || "all");

    const amen = getAmenPoi();
    if (amen) {
      const cat = categoryMeta(runtime.categories, amen.category);
      map.jumpTo({
        center: [amen.lng, amen.lat],
        zoom: CONFIG.amenView.zoom,
        pitch: CONFIG.amenView.pitch,
        bearing: CONFIG.amenView.bearing,
      });
      openModal(amen, cat);
      setStatus(
        skipped
          ? "رسیدیم به AmenRoad."
          : "فرود در AmenRoad — رشت، خیابان انقلاب (حاجی‌آباد) بن‌بست رز، ساختمان سبز، طبقه سوم",
        ""
      );
      setTimeout(() => setStatus(""), 4200);
    } else {
      flyToView(CONFIG.amenView, 1200);
    }

    if (runtime.autoRotateEnabled) {
      setTimeout(() => startIdleRotate(), 1600);
    }
  }

  async function playCinematicIntro() {
    if (!map || !runtime || runtime.introPlaying) return;
    if (prefersReducedMotion()) {
      markIntroPlayed();
      lockCityBounds();
      flyToView(CONFIG.amenView, 1200);
      const amen = getAmenPoi();
      if (amen) openModal(amen, categoryMeta(runtime.categories, amen.category));
      return;
    }

    runtime.introPlaying = true;
    runtime.introAbort = false;
    stopIdleRotate();
    closeModal();
    unlockWorldView();
    setIntroUi(true);
    setStatus("");

    // Hide cluttered markers during deep-space approach
    clearMarkers();

    for (let i = 0; i < INTRO_BEATS.length; i += 1) {
      if (runtime.introAbort) break;
      const beat = INTRO_BEATS[i];
      setIntroCaption(beat.caption || "");
      const ok = await easeToPromise({
        center: beat.center,
        zoom: beat.zoom,
        pitch: beat.pitch,
        bearing: beat.bearing,
        duration: beat.duration,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
      if (!ok || runtime.introAbort) break;

      // Extra orbital glide between first world beats
      if (i === 1 && !runtime.introAbort) {
        setIntroCaption("ادامهٔ چرخش سینمایی…");
        await easeToPromise({
          center: [28, 22],
          zoom: 1.85,
          pitch: 16,
          bearing: 150,
          duration: 3600,
          easing: (t) => t * (2 - t),
        });
      }
    }

    finishIntro({ skipped: runtime.introAbort });
  }

  function skipIntro() {
    if (!runtime?.introPlaying) return;
    runtime.introAbort = true;
    try {
      map.stop();
    } catch (_) {
      /* ignore */
    }
  }

  function addBuildingsLayer() {
    if (!map.getSource(CONFIG.buildingSource)) {
      map.addSource(CONFIG.buildingSource, {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      });
    }

    if (map.getLayer("rasht-3d-buildings")) return;

    const layers = map.getStyle().layers || [];
    let labelLayerId;
    for (let i = 0; i < layers.length; i += 1) {
      const layer = layers[i];
      if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
        labelLayerId = layer.id;
        break;
      }
    }

    layers.forEach((layer) => {
      if (
        layer.type === "fill" &&
        layer["source-layer"] === "building" &&
        map.getLayer(layer.id)
      ) {
        try {
          map.setPaintProperty(layer.id, "fill-opacity", 0);
        } catch (_) {
          /* ignore */
        }
      }
    });

    map.addLayer(
      {
        id: "rasht-3d-buildings",
        source: CONFIG.buildingSource,
        "source-layer": CONFIG.buildingSourceLayer,
        type: "fill-extrusion",
        minzoom: 13,
        filter: ["!", ["to-boolean", ["get", "hide_3d"]]],
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 12],
            0,
            "#1e293b",
            18,
            "#243447",
            40,
            "#334155",
            80,
            "#3b4f6b",
          ],
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0,
            14.5,
            ["coalesce", ["get", "render_height"], 10],
          ],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      labelLayerId
    );

    if (typeof map.setLight === "function") {
      map.setLight({
        anchor: "viewport",
        color: "#e8b87a",
        intensity: 0.42,
        position: [1.15, 210, 35],
      });
    }
  }

  function renderFilters() {
    const host = document.getElementById("city3d-filters");
    if (!host) return;
    host.innerHTML = FILTER_CHIPS.map(
      (chip) => `
      <button
        type="button"
        class="city3d-chip${chip.id === "all" ? " is-active" : ""}"
        data-city3d-filter="${chip.id}"
        style="--chip-accent:${
          chip.id === "all"
            ? "#c9a56a"
            : categoryMeta(runtime.categories, chip.id).color
        }"
      >${escapeHtml(chip.label)}</button>`
    ).join("");
  }

  function bindUi() {
    const root = document.getElementById("rasht-3d-city");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    root.addEventListener("click", (event) => {
      if (event.target.closest("[data-city3d-skip-intro]")) {
        skipIntro();
        return;
      }

      if (runtime?.introPlaying) return;

      const filterBtn = event.target.closest("[data-city3d-filter]");
      if (filterBtn) {
        renderMarkers(filterBtn.getAttribute("data-city3d-filter") || "all");
        return;
      }

      if (event.target.closest("[data-city3d-close]")) {
        closeModal();
        return;
      }

      const shareBtn = event.target.closest("[data-city3d-share]");
      if (shareBtn) {
        sharePoi(shareBtn);
        return;
      }

      if (event.target.closest("[data-city3d-view='amen']")) {
        closeModal();
        const amen = getAmenPoi();
        if (amen) focusPoi(amen);
        else flyToView(CONFIG.amenView);
        return;
      }

      if (event.target.closest("[data-city3d-view='square']")) {
        closeModal();
        flyToView(CONFIG.squareView);
        return;
      }

      if (event.target.closest("[data-city3d-view='city']")) {
        closeModal();
        flyToView(CONFIG.cityView, 2000);
        return;
      }

      const rotateBtn = event.target.closest("[data-city3d-rotate]");
      if (rotateBtn) {
        runtime.autoRotateEnabled = !runtime.autoRotateEnabled;
        rotateBtn.classList.toggle("is-on", runtime.autoRotateEnabled);
        rotateBtn.setAttribute("aria-pressed", String(runtime.autoRotateEnabled));
        rotateBtn.textContent = runtime.autoRotateEnabled
          ? "چرخش خودکار: روشن"
          : "چرخش خودکار: خاموش";
        if (runtime.autoRotateEnabled) startIdleRotate();
        else stopIdleRotate();
      }
    });

    const modal = document.getElementById("city3d-modal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (runtime?.introPlaying) skipIntro();
        else closeModal();
      }
    });
  }

  async function loadPois() {
    const res = await fetch(resolvePoisUrl(), { cache: "no-store" });
    if (!res.ok) throw new Error(`POI HTTP ${res.status}`);
    return res.json();
  }

  async function initRasht3dCity() {
    const container = document.getElementById("city3d-map");
    if (!container) return null;
    if (map) return map;

    if (typeof maplibregl === "undefined") {
      setStatus("کتابخانه MapLibre بارگذاری نشد.", "error");
      return null;
    }

    setStatus("در حال آماده‌سازی نقشه سه‌بعدی…", "loading");

    let data;
    try {
      data = await loadPois();
    } catch (err) {
      console.error(err);
      setStatus("دیتای مکان‌ها بارگذاری نشد.", "error");
      return null;
    }

    const shouldIntro = !introAlreadyPlayed() && !prefersReducedMotion();

    runtime = {
      categories: data.categories || [],
      pois: data.pois || [],
      markers: new Map(),
      activeFilter: "all",
      activePoiId: null,
      autoRotateEnabled: !prefersReducedMotion(),
      idleActive: false,
      idleTimer: 0,
      rafId: 0,
      introPlaying: false,
      introAbort: false,
      introStarted: false,
      shouldIntro,
    };

    renderFilters();
    bindUi();

    const rotateBtn = document.querySelector("[data-city3d-rotate]");
    if (rotateBtn) {
      rotateBtn.classList.toggle("is-on", runtime.autoRotateEnabled);
      rotateBtn.setAttribute("aria-pressed", String(runtime.autoRotateEnabled));
      rotateBtn.textContent = runtime.autoRotateEnabled
        ? "چرخش خودکار: روشن"
        : "چرخش خودکار: خاموش";
    }

    const startView = shouldIntro ? INTRO_BEATS[0] : CONFIG.amenView;

    map = new maplibregl.Map({
      container,
      style: CONFIG.styleUrl,
      center: startView.center,
      zoom: startView.zoom,
      pitch: startView.pitch,
      bearing: startView.bearing,
      minZoom: shouldIntro ? 0 : CONFIG.minZoom,
      maxZoom: CONFIG.maxZoom,
      maxBounds: shouldIntro ? undefined : CONFIG.maxBounds,
      antialias: true,
      attributionControl: true,
      cooperativeGestures: false,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    map.on("load", () => {
      try {
        addBuildingsLayer();
      } catch (err) {
        console.error("3D buildings error:", err);
      }

      if (!shouldIntro) {
        renderMarkers("all");
        setStatus("");
        if (runtime.autoRotateEnabled) startIdleRotate();
      } else {
        setStatus("برای شروع پرواز سینمایی کمی پایین‌تر اسکرول کنید…", "loading");
      }
    });

    map.on("error", (e) => {
      console.error("MapLibre error:", e?.error || e);
    });

    ["mousedown", "touchstart", "wheel", "dragstart", "rotatestart", "pitchstart", "zoomstart"].forEach(
      (evt) => map.on(evt, pauseInteraction)
    );

    map.on("click", () => {
      if (!runtime?.introPlaying) closeModal();
    });

    const refresh = () => {
      try {
        map.resize();
      } catch (_) {
        /* ignore */
      }
    };
    requestAnimationFrame(refresh);
    setTimeout(refresh, 250);
    window.addEventListener("resize", refresh, { passive: true });

    const section = document.getElementById("city3d");
    if (section && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          if (!visible) {
            if (!runtime?.introPlaying) stopIdleRotate();
            return;
          }
          refresh();
          if (runtime?.shouldIntro && !runtime.introStarted && map.isStyleLoaded()) {
            runtime.introStarted = true;
            playCinematicIntro();
            return;
          }
          if (runtime?.autoRotateEnabled && !runtime.introPlaying) startIdleRotate();
        },
        { threshold: 0.35 }
      );
      io.observe(section);
    } else if (shouldIntro) {
      map.once("load", () => playCinematicIntro());
    }

    return map;
  }

  window.initRasht3dCity = initRasht3dCity;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initRasht3dCity();
    });
  } else {
    initRasht3dCity();
  }
})();
