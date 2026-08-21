/**
 * rasht.city — frontend logic
 * Works on GitHub Pages (no build step, no backend).
 *
 * APIs used:
 * - Weather: Open-Meteo (no key required)
 * - Prayer times: Aladhan (no key required, Tehran method)
 * - Images: Unsplash API (optional key) + curated fallbacks
 * - Events: local JSON at assets/data/events.json
 * - Map: Leaflet + OpenStreetMap tiles (free, no key) via assets/js/map.js
 * - مفاخر گیلان: assets/data/gilan-figures.json (Wikidata + fa.wikipedia)
 */

/* =========================================================
   CONFIG — put your API keys here if needed
   ========================================================= */

/**
 * Unsplash Access Key (optional but recommended for live photos)
 * Get one free at: https://unsplash.com/developers
 * Leave empty to use curated fallback images.
 */
const UNSPLASH_ACCESS_KEY = ""; // e.g. "abc123..."

/**
 * Optional OpenWeatherMap key — only used if you switch WEATHER_PROVIDER
 * Get one free at: https://openweathermap.org/api
 */
const OPENWEATHER_API_KEY = ""; // e.g. "abc123..."

/** "open-meteo" (default, no key) | "openweathermap" (needs OPENWEATHER_API_KEY) */
const WEATHER_PROVIDER = "open-meteo";

/* Rasht, Gilan coordinates */
const RASHT = {
  name: "Rasht",
  nameFa: "رشت",
  lat: 37.2808,
  lon: 49.5832,
  timezone: "Asia/Tehran",
};

/* Curated Unsplash fallbacks (no API key required) */
const FALLBACK_IMAGES = [
  {
    url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1800&q=80",
    credit: "Unsplash",
    link: "https://unsplash.com",
  },
  {
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1800&q=80",
    credit: "Unsplash",
    link: "https://unsplash.com",
  },
  {
    url: "https://images.unsplash.com/photo-1501785888041-af3ee95b0b5c?auto=format&fit=crop&w=1800&q=80",
    credit: "Unsplash",
    link: "https://unsplash.com",
  },
  {
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1800&q=80",
    credit: "Unsplash",
    link: "https://unsplash.com",
  },
  {
    url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1800&q=80",
    credit: "Unsplash",
    link: "https://unsplash.com",
  },
];

/* WMO weather codes → short labels (Open-Meteo) */
const WMO_LABELS = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm + hail",
  99: "Thunderstorm + hail",
};

const PRAYER_LABELS = [
  { key: "Fajr", fa: "اذان صبح" },
  { key: "Sunrise", fa: "طلوع آفتاب" },
  { key: "Dhuhr", fa: "اذان ظهر" },
  { key: "Asr", fa: "اذان عصر" },
  { key: "Maghrib", fa: "اذان مغرب" },
  { key: "Isha", fa: "اذان عشاء" },
];

const TYPE_LABELS = {
  festival: "جشنواره",
  exhibition: "نمایشگاه",
  nature: "طبیعت",
  culture: "فرهنگ",
  market: "بازار",
};

/* =========================================================
   Helpers
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function setState(el, message, kind) {
  if (!el) return;
  el.innerHTML = `<p class="state ${kind || ""}">${escapeHtml(message)}</p>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatDateFa(isoDate) {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: RASHT.timezone,
    }).format(d);
  } catch (_) {
    return isoDate;
  }
}

function formatClock() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: RASHT.timezone,
  }).format(now);
  const time = new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: RASHT.timezone,
  }).format(now);
  return { date, time };
}

function updateLocalClock() {
  const { date, time } = formatClock();
  const dateEl = $("local-date");
  const timeEl = $("local-time");
  if (dateEl) dateEl.textContent = date;
  if (timeEl) timeEl.textContent = time;
}

/* =========================================================
   Weather
   ========================================================= */

async function loadWeather() {
  const root = $("weather-content");
  if (!root) return;

  try {
    let data;

    if (WEATHER_PROVIDER === "openweathermap") {
      if (!OPENWEATHER_API_KEY) {
        throw new Error("OpenWeatherMap key missing. Set OPENWEATHER_API_KEY in main.js.");
      }
      data = await fetchOpenWeather();
    } else {
      data = await fetchOpenMeteo();
    }

    root.innerHTML = `
      <div class="weather-grid">
        <div class="weather-main">
          <div class="temp">${Math.round(data.temp)}<span>°C</span></div>
          <div>
            <p class="weather-desc">${escapeHtml(data.description)}</p>
            <p class="weather-place">${RASHT.nameFa} · ${RASHT.name}</p>
          </div>
        </div>
        <div class="weather-stats">
          <div class="stat">
            <span class="stat-label">Humidity / رطوبت</span>
            <span class="stat-value">${data.humidity}%</span>
          </div>
          <div class="stat">
            <span class="stat-label">Wind / باد</span>
            <span class="stat-value">${data.wind} km/h</span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Weather error:", err);
    setState(root, "فعلاً آب‌وهوا در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.", "error");
  }
}

/** Free weather API — no key required */
async function fetchOpenMeteo() {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${RASHT.lat}&longitude=${RASHT.lon}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
    `&timezone=${encodeURIComponent(RASHT.timezone)}&wind_speed_unit=kmh`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const json = await res.json();
  const c = json.current;
  if (!c) throw new Error("Open-Meteo: missing current weather");

  return {
    temp: c.temperature_2m,
    humidity: c.relative_humidity_2m,
    wind: Math.round(c.wind_speed_10m),
    description: WMO_LABELS[c.weather_code] || `Code ${c.weather_code}`,
  };
}

/** Optional OpenWeatherMap path — needs OPENWEATHER_API_KEY */
async function fetchOpenWeather() {
  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${RASHT.lat}&lon=${RASHT.lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeatherMap HTTP ${res.status}`);
  const json = await res.json();

  return {
    temp: json.main?.temp,
    humidity: json.main?.humidity,
    wind: Math.round((json.wind?.speed || 0) * 3.6), // m/s → km/h
    description: json.weather?.[0]?.description
      ? capitalize(json.weather[0].description)
      : "—",
  };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/* =========================================================
   Prayer times (Aladhan — method 7 = Tehran University)
   ========================================================= */

async function loadPrayerTimes() {
  const root = $("prayer-content");
  if (!root) return;

  try {
    // method=7 → Institute of Geophysics, University of Tehran (good for Iran)
    const url =
      `https://api.aladhan.com/v1/timings` +
      `?latitude=${RASHT.lat}&longitude=${RASHT.lon}` +
      `&method=7&timezonestring=${encodeURIComponent(RASHT.timezone)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
    const json = await res.json();
    const timings = json?.data?.timings;
    if (!timings) throw new Error("Aladhan: missing timings");

    const rows = PRAYER_LABELS.map(({ key, fa }) => {
      const raw = String(timings[key] || "").split(" ")[0]; // strip extras like "(+03)"
      return `
        <tr>
          <th scope="row">${escapeHtml(fa)} <span style="opacity:.55;font-weight:500">(${escapeHtml(key)})</span></th>
          <td dir="ltr">${escapeHtml(raw)}</td>
        </tr>
      `;
    }).join("");

    const hijri = json?.data?.date?.hijri;
    const hijriLabel = hijri
      ? `${hijri.day} ${hijri.month?.en || ""} ${hijri.year}`
      : "";

    root.innerHTML = `
      <div class="prayer-table-wrap">
        <table class="prayer-table">
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="prayer-note">
        محاسبه با روش دانشگاه تهران · منطقه زمانی ${RASHT.timezone}
        ${hijriLabel ? ` · ${escapeHtml(hijriLabel)} هـ` : ""}
      </p>
    `;
  } catch (err) {
    console.error("Prayer times error:", err);
    setState(root, "اوقات شرعی دریافت نشد. اتصال اینترنت را بررسی کنید.", "error");
  }
}

/* =========================================================
   Events (local JSON)
   ========================================================= */

async function loadEvents() {
  const root = $("events-content");
  if (!root) return;

  try {
    const res = await fetch("assets/data/events.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`events.json HTTP ${res.status}`);
    const events = await res.json();
    if (!Array.isArray(events)) throw new Error("events.json must be an array");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = events
      .filter((e) => e && e.date)
      .map((e) => ({ ...e, _ts: new Date(`${e.date}T00:00:00`).getTime() }))
      .filter((e) => !Number.isNaN(e._ts) && e._ts >= today.getTime())
      .sort((a, b) => a._ts - b._ts);

    const list = upcoming.length ? upcoming : events.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (!list.length) {
      setState(root, "رویداد فعالی ثبت نشده است.", "");
      return;
    }

    root.innerHTML = `
      <div class="events-list">
        ${list
          .map((ev) => {
            const type = TYPE_LABELS[ev.type] || ev.type || "رویداد";
            return `
              <article class="event-item">
                <span class="event-type">${escapeHtml(type)}</span>
                <h3>${escapeHtml(ev.title || "بدون عنوان")}</h3>
                <p class="event-meta">${escapeHtml(formatDateFa(ev.date))} · ${escapeHtml(ev.location || "گیلان")}</p>
                <p class="event-desc">${escapeHtml(ev.description || "")}</p>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  } catch (err) {
    console.error("Events error:", err);
    setState(
      root,
      "رویدادها بارگذاری نشدند. برای پیش‌نمایش محلی از یک سرور ساده مثل npx serve استفاده کنید.",
      "error"
    );
  }
}

/* =========================================================
   مفاخر گیلان teaser
   ========================================================= */

async function loadGilanTeaser() {
  const root = $("maf-teaser");
  if (!root) return;

  try {
    const res = await fetch("assets/data/gilan-figures.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`gilan-figures.json HTTP ${res.status}`);
    const data = await res.json();
    const figures = (data.figures || []).filter((f) => {
      if (!f || f.status !== "published") return false;
      return f.isBornInGilan === true || f.isBornInGilan === "true";
    });
    if (!figures.length) {
      setState(root, "هنوز یادبودی منتشر نشده است.", "");
      return;
    }

    const f = figures[0];
    const href = `mafakher/#${encodeURIComponent(f.slug)}`;
    const rawImg = f.image && f.image.url ? String(f.image.url).split("?")[0] : "";
    const img = rawImg
      ? `<img class="maf-teaser-photo" src="${escapeHtml(rawImg)}" alt="${escapeHtml(f.image.alt || f.fullName)}" loading="lazy" />`
      : `<div class="maf-teaser-photo is-empty" aria-hidden="true"></div>`;

    root.innerHTML = `
      <a class="maf-teaser-card" href="${href}">
        ${img}
        <div class="maf-teaser-body">
          <span class="maf-teaser-chip">${escapeHtml(f.category || "مفاخر")}</span>
          <h3>${escapeHtml(f.fullName)}</h3>
          <p>${escapeHtml(f.shortDescription || "")}</p>
          <p class="maf-teaser-meta">${escapeHtml(f.birthPlace || "گیلان")}</p>
        </div>
      </a>`;
  } catch (err) {
    console.error("Gilan teaser error:", err);
    setState(root, "یادبود مفاخر بارگذاری نشد.", "error");
  }
}

/* =========================================================
   Background images (Unsplash + fallbacks)
   ========================================================= */

async function loadBackgroundImages() {
  let images = FALLBACK_IMAGES.slice();

  try {
    if (UNSPLASH_ACCESS_KEY) {
      const live = await fetchUnsplashImages();
      if (live.length) images = live;
    }
  } catch (err) {
    console.warn("Unsplash fetch failed, using fallbacks:", err);
  }

  const picked = shuffle(images);
  applyBackgrounds(picked);
}

/**
 * Fetch Rasht / Gilan / Iran photos from Unsplash.
 * Requires UNSPLASH_ACCESS_KEY at the top of this file.
 */
async function fetchUnsplashImages() {
  const queries = ["Rasht Iran", "Gilan Iran", "northern Iran forest rain", "Caspian coast Iran"];
  const results = [];

  for (const q of queries) {
    const url =
      `https://api.unsplash.com/search/photos` +
      `?query=${encodeURIComponent(q)}&orientation=landscape&per_page=4&content_filter=high`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`);
    const json = await res.json();
    const photos = Array.isArray(json.results) ? json.results : [];

    photos.forEach((p) => {
      if (!p?.urls?.regular) return;
      results.push({
        url: `${p.urls.regular}&w=1800`,
        credit: p.user?.name || "Unsplash",
        link: p.links?.html || p.user?.links?.html || "https://unsplash.com",
      });
    });
  }

  // de-dupe by url
  const seen = new Set();
  return results.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

function applyBackgrounds(images) {
  if (!images.length) return;

  const hero = images[0];
  const heroEl = $("hero-bg");
  if (heroEl) {
    heroEl.style.backgroundImage =
      `linear-gradient(160deg, rgba(18,53,44,.35), rgba(11,26,22,.2)), url("${hero.url}")`;
  }

  const pageBg = $("page-bg");
  if (pageBg && images[1]) {
    pageBg.style.backgroundImage =
      `linear-gradient(160deg, rgba(11,26,22,.85), rgba(8,20,16,.92)), url("${images[1].url}")`;
    pageBg.style.backgroundSize = "cover";
    pageBg.style.backgroundPosition = "center";
  }

  const slots = document.querySelectorAll("[data-bg-slot]");
  slots.forEach((el, i) => {
    const img = images[(i + 2) % images.length];
    if (!img) return;
    el.style.backgroundImage = `url("${img.url}")`;
  });

  const credit = $("photo-credit");
  if (credit && hero.credit) {
    credit.innerHTML = `Photos via <a href="${escapeHtml(hero.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(hero.credit)}</a> / Unsplash`;
  }

  // gentle rotation of hero image every 20s when multiple available
  if (images.length > 1) {
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % images.length;
      const next = images[idx];
      if (heroEl && next) {
        heroEl.style.backgroundImage =
          `linear-gradient(160deg, rgba(18,53,44,.35), rgba(11,26,22,.2)), url("${next.url}")`;
      }
      if (credit && next.credit) {
        credit.innerHTML = `Photos via <a href="${escapeHtml(next.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(next.credit)}</a> / Unsplash`;
      }
    }, 20000);
  }
}

/* =========================================================
   Boot
   ========================================================= */

function init() {
  const year = $("year");
  if (year) year.textContent = String(new Date().getFullYear());

  updateLocalClock();
  setInterval(updateLocalClock, 1000);

  loadBackgroundImages();
  loadWeather();
  loadPrayerTimes();
  loadEvents();
  loadGilanTeaser();

  if (typeof initCalendarDashboard === "function") {
    initCalendarDashboard();
  }

  if (typeof initRashtMap === "function") {
    initRashtMap();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
