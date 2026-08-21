/**
 * rasht.city — Persian calendar & time dashboard
 * Vanilla JS, no backend. Depends on assets/js/jalali.js
 *
 * Occasions & holidays from pnldev Jalali Calendar API:
 * https://pnldev.com/fa/api-doc/calender
 *
 * Strategy: local bundled year JSON first (always works on GitHub Pages),
 * then refresh from live API when reachable.
 */

const CAL_TZ = "Asia/Tehran";
const PNLDEV_CALENDER_API = "https://pnldev.com/api/calender";
const LOCAL_YEAR_JSON = (jy) => `assets/data/jalali-calendar-${jy}.json`;
const LS_PREFIX = "rasht.cal.pnldev.";

const ZODIAC_FA = [
  { name: "حمل", from: [3, 21], to: [4, 20] },
  { name: "ثور", from: [4, 21], to: [5, 20] },
  { name: "جوزا", from: [5, 21], to: [6, 21] },
  { name: "سرطان", from: [6, 22], to: [7, 22] },
  { name: "اسد", from: [7, 23], to: [8, 22] },
  { name: "سنبله", from: [8, 23], to: [9, 22] },
  { name: "میزان", from: [9, 23], to: [10, 22] },
  { name: "عقرب", from: [10, 23], to: [11, 21] },
  { name: "قوس", from: [11, 22], to: [12, 21] },
  { name: "جدی", from: [12, 22], to: [1, 20] },
  { name: "دلو", from: [1, 21], to: [2, 19] },
  { name: "حوت", from: [2, 20], to: [3, 20] },
];

const CITY_QUOTES = [
  "رشت شهر باران است؛ جایی که مه، چای و مهربانی در یک فنجان جا می‌گیرند.",
  "گیلان، سرزمین سبز شمال؛ رشت قلب تپنده‌اش در میان باران و بادهای خزر.",
  "در رشت، هر کوچه بوی تازگی می‌دهد؛ از بازار بزرگ تا مه‌آلود جنگل‌های سراوان.",
];

/** Cache: "jy-jm" → day map */
const monthCalendarCache = new Map();
/** Cache: jy → full year map { "1": { "1": day, ... }, ... } */
const yearCalendarCache = new Map();

let calView = { jy: 0, jm: 0 };
let calClockTimer = null;
let occasionsRequestId = 0;

function calNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    date: new Date(year, month - 1, day, hour, minute, second),
  };
}

function getZodiacFa(month, day) {
  for (const z of ZODIAC_FA) {
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm < tm) {
      if ((month === fm && day >= fd) || (month === tm && day <= td) || (month > fm && month < tm)) {
        return z.name;
      }
    } else if ((month === fm && day >= fd) || (month === tm && day <= td) || month > fm || month < tm) {
      return z.name;
    }
  }
  return "—";
}

function formatIslamicDate(date) {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: CAL_TZ,
    }).format(date);
  } catch (_) {
    try {
      return new Intl.DateTimeFormat("fa-IR-u-ca-islamic", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: CAL_TZ,
      }).format(date);
    } catch (e) {
      return "—";
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function monthCacheKey(jy, jm) {
  return `${jy}-${jm}`;
}

function isTruthyStatus(status) {
  return status === true || status === 1 || status === "true" || status === "1";
}

/**
 * Normalize pnldev payloads:
 * - day:   { solar, event, holiday }
 * - month: { "1": day, "2": day, ... }
 * - year:  { "1": { "1": day, ... }, "2": {...}, ... }
 */
function normalizeYearMap(result) {
  if (!result || typeof result !== "object") return null;

  // Single day
  if (result.solar && result.event !== undefined) {
    const m = String(result.solar.month);
    const d = String(result.solar.day);
    return { [m]: { [d]: result } };
  }

  const keys = Object.keys(result);
  if (!keys.length) return null;

  const first = result[keys[0]];
  // Month map: first child is a day object
  if (first && first.solar && first.event !== undefined) {
    const m = String(first.solar.month || keys[0]);
    // If keys look like days 1..31, wrap as one month. Prefer solar.month.
    return { [m]: result };
  }

  // Year map: first child is a month map
  if (first && typeof first === "object") {
    return result;
  }

  return null;
}

function dayMapFromYear(yearMap, jm) {
  if (!yearMap) return null;
  const month = yearMap[String(jm)] || yearMap[jm];
  return month && typeof month === "object" ? month : null;
}

function occasionsFromMonth(dayMap) {
  const items = [];
  if (!dayMap) return items;

  Object.keys(dayMap)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
    .forEach((dayNum) => {
      const entry = dayMap[String(dayNum)] || dayMap[dayNum];
      if (!entry) return;
      const events = Array.isArray(entry.event) ? entry.event : [];
      const holiday = Boolean(entry.holiday);
      events.forEach((title) => {
        const text = String(title || "").trim();
        if (!text) return;
        items.push({
          day: Number(entry.solar?.day) || dayNum,
          title: text,
          holiday,
        });
      });
    });

  return items;
}

function readLocalStorageYear(jy) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + jy);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.result || Date.now() - (parsed.savedAt || 0) > 1000 * 60 * 60 * 24 * 7) {
      return null;
    }
    return normalizeYearMap(parsed.result);
  } catch (_) {
    return null;
  }
}

function writeLocalStorageYear(jy, yearMap) {
  try {
    localStorage.setItem(
      LS_PREFIX + jy,
      JSON.stringify({ savedAt: Date.now(), result: yearMap })
    );
  } catch (_) {
    /* quota / private mode */
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function loadBundledYear(jy) {
  try {
    const data = await fetchJson(LOCAL_YEAR_JSON(jy));
    if (!isTruthyStatus(data.status)) return null;
    return normalizeYearMap(data.result);
  } catch (_) {
    return null;
  }
}

async function loadLiveYear(jy) {
  const data = await fetchJson(
    `${PNLDEV_CALENDER_API}?year=${encodeURIComponent(jy)}`
  );
  if (!isTruthyStatus(data.status)) throw new Error("pnldev status false");
  const yearMap = normalizeYearMap(data.result);
  if (!yearMap) throw new Error("pnldev unexpected year shape");
  return yearMap;
}

async function loadLiveMonth(jy, jm) {
  const data = await fetchJson(
    `${PNLDEV_CALENDER_API}?year=${encodeURIComponent(jy)}&month=${encodeURIComponent(jm)}`
  );
  if (!isTruthyStatus(data.status)) throw new Error("pnldev status false");
  const yearMap = normalizeYearMap(data.result);
  return dayMapFromYear(yearMap, jm);
}

/**
 * Resolve one month: memory → localStorage → bundled JSON → live API.
 */
async function fetchMonthCalendar(jy, jm) {
  const key = monthCacheKey(jy, jm);
  if (monthCalendarCache.has(key)) {
    return monthCalendarCache.get(key);
  }

  if (yearCalendarCache.has(jy)) {
    const fromYear = dayMapFromYear(yearCalendarCache.get(jy), jm);
    if (fromYear) {
      monthCalendarCache.set(key, fromYear);
      return fromYear;
    }
  }

  const fromLs = readLocalStorageYear(jy);
  if (fromLs) {
    yearCalendarCache.set(jy, fromLs);
    const month = dayMapFromYear(fromLs, jm);
    if (month) {
      monthCalendarCache.set(key, month);
      // Refresh in background
      refreshYearFromApi(jy).catch(() => {});
      return month;
    }
  }

  const bundled = await loadBundledYear(jy);
  if (bundled) {
    yearCalendarCache.set(jy, bundled);
    writeLocalStorageYear(jy, bundled);
    const month = dayMapFromYear(bundled, jm);
    if (month) {
      monthCalendarCache.set(key, month);
      refreshYearFromApi(jy).catch(() => {});
      return month;
    }
  }

  // Live: prefer year (docs item-2), fall back to month
  try {
    const yearMap = await loadLiveYear(jy);
    yearCalendarCache.set(jy, yearMap);
    writeLocalStorageYear(jy, yearMap);
    const month = dayMapFromYear(yearMap, jm);
    if (month) {
      monthCalendarCache.set(key, month);
      return month;
    }
  } catch (yearErr) {
    console.warn("pnldev year fetch failed, trying month:", yearErr);
  }

  const monthOnly = await loadLiveMonth(jy, jm);
  if (!monthOnly) throw new Error("no month data");
  monthCalendarCache.set(key, monthOnly);
  return monthOnly;
}

async function refreshYearFromApi(jy) {
  const yearMap = await loadLiveYear(jy);
  yearCalendarCache.set(jy, yearMap);
  writeLocalStorageYear(jy, yearMap);
  Object.keys(yearMap).forEach((m) => {
    const month = yearMap[m];
    if (month) monthCalendarCache.set(monthCacheKey(jy, Number(m)), month);
  });
  // If user is still viewing this year, re-render quietly
  if (calView.jy === jy) {
    const dayMap = dayMapFromYear(yearMap, calView.jm);
    if (dayMap) {
      renderMonthGrid(dayMap);
      renderOccasionsList(calView.jm, occasionsFromMonth(dayMap), "ok");
    }
  }
}

function updateAnalogClock(h, m, s) {
  const hourEl = document.getElementById("cal-hand-hour");
  const minEl = document.getElementById("cal-hand-minute");
  const secEl = document.getElementById("cal-hand-second");
  if (!hourEl || !minEl || !secEl) return;

  const secDeg = s * 6;
  const minDeg = m * 6 + s * 0.1;
  const hourDeg = (h % 12) * 30 + m * 0.5 + s * (0.5 / 60);

  hourEl.style.transform = `rotate(${hourDeg}deg)`;
  minEl.style.transform = `rotate(${minDeg}deg)`;
  secEl.style.transform = `rotate(${secDeg}deg)`;
}

function updateDigitalTime(h, m, s) {
  const el = document.getElementById("cal-digital-time");
  if (!el) return;
  const pad = (n) => String(n).padStart(2, "0");
  el.textContent = Jalali.toFaDigits(`${pad(h)}:${pad(m)}:${pad(s)}`);
}

function updateDateCards() {
  const now = calNow();
  const { jy, jm, jd } = Jalali.gregorianToJalali(now.year, now.month, now.day);
  const wd = Jalali.jalaliWeekdayIndex(jy, jm, jd);

  const jalaliEl = document.getElementById("cal-jalali");
  const gregEl = document.getElementById("cal-gregorian");
  const islamicEl = document.getElementById("cal-islamic");
  const zodiacEl = document.getElementById("cal-zodiac");
  const weekdayEl = document.getElementById("cal-weekday");

  if (jalaliEl) {
    jalaliEl.textContent = Jalali.toFaDigits(`${jd} ${Jalali.months[jm - 1]} ${jy}`);
  }
  if (weekdayEl) weekdayEl.textContent = Jalali.weekdaysFull[wd];

  if (gregEl) {
    gregEl.textContent = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: CAL_TZ,
    }).format(now.date);
  }

  if (islamicEl) islamicEl.textContent = formatIslamicDate(now.date);
  if (zodiacEl) zodiacEl.textContent = getZodiacFa(now.month, now.day);

  return { jy, jm, jd, now };
}

function renderOccasionsList(jm, items, state) {
  const list = document.getElementById("cal-occasions-list");
  const title = document.getElementById("cal-occasions-month");
  if (!list) return;

  if (title) title.textContent = Jalali.months[jm - 1];

  if (state === "loading") {
    list.innerHTML = `<li class="cal-occasion empty">در حال بارگذاری مناسبت‌ها…</li>`;
    return;
  }
  if (state === "error") {
    list.innerHTML = `<li class="cal-occasion empty">بارگذاری مناسبت‌ها ممکن نشد. اتصال اینترنت را بررسی کنید.</li>`;
    return;
  }
  if (!items.length) {
    list.innerHTML = `<li class="cal-occasion empty">مناسبت ثبت‌شده‌ای برای این ماه نیست.</li>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <li class="cal-occasion${item.holiday ? " is-holiday" : ""}">
        <span class="cal-occasion-day">${Jalali.toFaDigits(item.day)}</span>
        <span class="cal-occasion-body">
          <span class="cal-occasion-title">${escapeHtml(item.title)}</span>
          ${item.holiday ? `<span class="cal-occasion-badge">تعطیل</span>` : ""}
        </span>
      </li>`
    )
    .join("");
}

function renderMonthGrid(dayMap) {
  const grid = document.getElementById("cal-grid");
  const titleEl = document.getElementById("cal-month-title");
  const subEl = document.getElementById("cal-month-sub");
  if (!grid) return;

  const { jy, jm } = calView;
  const today = Jalali.gregorianToJalali(calNow().year, calNow().month, calNow().day);

  if (titleEl) {
    titleEl.textContent = `${Jalali.months[jm - 1]} ${Jalali.toFaDigits(jy)}`;
  }

  if (subEl) {
    const start = Jalali.jalaliToGregorian(jy, jm, 1);
    const end = Jalali.jalaliToGregorian(jy, jm, Jalali.jalaliMonthLength(jy, jm));
    const fmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
    const a = fmt.format(new Date(start.gy, start.gm - 1, start.gd));
    const b = fmt.format(new Date(end.gy, end.gm - 1, end.gd));
    subEl.textContent = a === b ? a : `${a} – ${b}`;
  }

  const firstWd = Jalali.jalaliWeekdayIndex(jy, jm, 1);
  const daysInMonth = Jalali.jalaliMonthLength(jy, jm);

  let html = Jalali.weekdays
    .map((d) => `<div class="cal-cell cal-head">${d}</div>`)
    .join("");

  for (let i = 0; i < firstWd; i += 1) {
    html += `<div class="cal-cell cal-empty" aria-hidden="true"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const isToday = today.jy === jy && today.jm === jm && today.jd === d;
    const isFriday = Jalali.jalaliWeekdayIndex(jy, jm, d) === 6;
    const dayInfo = dayMap ? dayMap[String(d)] || dayMap[d] : null;
    const isHoliday = Boolean(dayInfo?.holiday) || isFriday;
    const hasEvent =
      Array.isArray(dayInfo?.event) && dayInfo.event.some((e) => String(e || "").trim());
    const tip = hasEvent ? escapeHtml(dayInfo.event.filter(Boolean).join(" · ")) : "";

    html += `<div class="cal-cell cal-day${isToday ? " is-today" : ""}${
      isHoliday ? " is-holiday" : ""
    }${hasEvent ? " has-event" : ""}"${tip ? ` title="${tip}"` : ""}">${Jalali.toFaDigits(d)}</div>`;
  }

  grid.innerHTML = html;
}

async function loadMonthView() {
  const { jy, jm } = calView;
  const reqId = ++occasionsRequestId;
  const cached = monthCalendarCache.get(monthCacheKey(jy, jm));

  renderMonthGrid(cached || null);
  renderOccasionsList(jm, cached ? occasionsFromMonth(cached) : [], cached ? "ok" : "loading");

  try {
    const dayMap = await fetchMonthCalendar(jy, jm);
    if (reqId !== occasionsRequestId) return;
    renderMonthGrid(dayMap);
    renderOccasionsList(jm, occasionsFromMonth(dayMap), "ok");
  } catch (err) {
    console.error("Calendar occasions error:", err);
    if (reqId !== occasionsRequestId) return;
    if (!cached) {
      renderMonthGrid(null);
      renderOccasionsList(jm, [], "error");
    }
  }
}

function shiftMonth(delta) {
  let { jy, jm } = calView;
  jm += delta;
  if (jm < 1) {
    jm = 12;
    jy -= 1;
  } else if (jm > 12) {
    jm = 1;
    jy += 1;
  }
  calView = { jy, jm };
  loadMonthView();
}

function tickClock() {
  const now = calNow();
  updateAnalogClock(now.hour, now.minute, now.second);
  updateDigitalTime(now.hour, now.minute, now.second);
}

function pickQuote() {
  const el = document.getElementById("cal-quote-text");
  if (!el) return;
  const q = CITY_QUOTES[Math.floor(Math.random() * CITY_QUOTES.length)];
  el.textContent = q;
}

function bindCalendarControls() {
  const prev = document.getElementById("cal-prev");
  const next = document.getElementById("cal-next");
  if (prev) prev.addEventListener("click", () => shiftMonth(-1));
  if (next) next.addEventListener("click", () => shiftMonth(1));
}

function buildClockTicks() {
  const host = document.getElementById("cal-clock-ticks");
  if (!host || host.childElementCount) return;
  for (let i = 0; i < 12; i += 1) {
    const tick = document.createElement("span");
    tick.className = "cal-clock-tick";
    tick.style.transform = `rotate(${i * 30}deg)`;
    host.appendChild(tick);
  }
}

function initCalendarDashboard() {
  if (typeof Jalali === "undefined") {
    console.error("Jalali helper missing");
    return;
  }

  buildClockTicks();

  const { jy, jm } = updateDateCards();
  calView = { jy, jm };

  pickQuote();
  loadMonthView();
  bindCalendarControls();
  tickClock();

  if (calClockTimer) clearInterval(calClockTimer);
  calClockTimer = setInterval(() => {
    tickClock();
    if (calNow().hour === 0 && calNow().minute === 0 && calNow().second < 2) {
      const t = updateDateCards();
      if (calView.jy === t.jy && calView.jm === t.jm) loadMonthView();
    }
  }, 1000);
}

window.initCalendarDashboard = initCalendarDashboard;
