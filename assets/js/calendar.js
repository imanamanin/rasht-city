/**
 * rasht.city — Persian calendar & time dashboard
 * Vanilla JS, no backend. Depends on assets/js/jalali.js
 *
 * Occasions & holidays: free pnldev Jalali Calendar API
 * https://pnldev.com/fa/api-doc/calender
 */

const CAL_TZ = "Asia/Tehran";
const PNLDEV_CALENDER_API = "https://pnldev.com/api/calender";

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

/** Cache: "jy-jm" → day map from API */
const monthCalendarCache = new Map();
let calView = { jy: 0, jm: 0 };
let calClockTimer = null;
let occasionsRequestId = 0;
/** Currently rendered month day map (for day click popups) */
let currentMonthDayMap = null;
let calPopupKeyHandler = null;

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
  return { year, month, day, hour, minute, second, date: new Date(year, month - 1, day, hour, minute, second) };
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

/**
 * Fetch one Jalali month from pnldev (free, no API key, CORS *).
 * result is keyed by day number as string: { "1": { holiday, event, solar, ... }, ... }
 */
async function fetchMonthCalendar(jy, jm) {
  const key = monthCacheKey(jy, jm);
  if (monthCalendarCache.has(key)) {
    return monthCalendarCache.get(key);
  }

  const url = `${PNLDEV_CALENDER_API}?year=${encodeURIComponent(jy)}&month=${encodeURIComponent(jm)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`pnldev calendar HTTP ${res.status}`);

  const data = await res.json();
  if (!data || data.status !== true || !data.result || typeof data.result !== "object") {
    throw new Error("pnldev calendar: unexpected response");
  }

  // Day query returns a single object; month query returns day-keyed map
  const result = data.result;
  let dayMap;
  if (result.solar && Array.isArray(result.event)) {
    dayMap = { [String(result.solar.day)]: result };
  } else {
    dayMap = result;
  }

  monthCalendarCache.set(key, dayMap);
  return dayMap;
}

function occasionsFromMonth(dayMap) {
  const items = [];
  if (!dayMap) return items;

  Object.keys(dayMap)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
    .forEach((dayNum) => {
      const entry = dayMap[String(dayNum)];
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
    syncOccasionsPanelHeight();
    return;
  }
  if (state === "error") {
    list.innerHTML = `<li class="cal-occasion empty">بارگذاری مناسبت‌ها ممکن نشد. اتصال اینترنت را بررسی کنید.</li>`;
    syncOccasionsPanelHeight();
    return;
  }
  if (!items.length) {
    list.innerHTML = `<li class="cal-occasion empty">مناسبت ثبت‌شده‌ای برای این ماه نیست.</li>`;
    syncOccasionsPanelHeight();
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
  syncOccasionsPanelHeight();
}

function closeDayPopup() {
  const popup = document.getElementById("cal-day-popup");
  if (!popup) return;
  popup.hidden = true;
  document.body.style.overflow = "";
  if (calPopupKeyHandler) {
    document.removeEventListener("keydown", calPopupKeyHandler);
    calPopupKeyHandler = null;
  }
}

function openDayPopup(dayNum) {
  const popup = document.getElementById("cal-day-popup");
  const titleEl = document.getElementById("cal-day-popup-title");
  const listEl = document.getElementById("cal-day-popup-list");
  if (!popup || !listEl || !currentMonthDayMap) return;

  const entry = currentMonthDayMap[String(dayNum)];
  const events = Array.isArray(entry?.event)
    ? entry.event.map((t) => String(t || "").trim()).filter(Boolean)
    : [];
  if (!events.length) return;

  const { jy, jm } = calView;
  const holiday = Boolean(entry?.holiday);
  if (titleEl) {
    titleEl.textContent = `${Jalali.toFaDigits(dayNum)} ${Jalali.months[jm - 1]} ${Jalali.toFaDigits(jy)}`;
  }

  listEl.innerHTML = events
    .map(
      (title) => `
      <li class="cal-day-popup-item${holiday ? " is-holiday" : ""}">
        ${escapeHtml(title)}
        ${holiday ? `<span class="cal-occasion-badge">تعطیل</span>` : ""}
      </li>`
    )
    .join("");

  popup.hidden = false;
  document.body.style.overflow = "hidden";

  if (calPopupKeyHandler) document.removeEventListener("keydown", calPopupKeyHandler);
  calPopupKeyHandler = (event) => {
    if (event.key === "Escape") closeDayPopup();
  };
  document.addEventListener("keydown", calPopupKeyHandler);

  const closeBtn = popup.querySelector(".cal-day-popup-close");
  if (closeBtn) closeBtn.focus();
}

function renderMonthGrid(dayMap) {
  const grid = document.getElementById("cal-grid");
  const titleEl = document.getElementById("cal-month-title");
  const subEl = document.getElementById("cal-month-sub");
  if (!grid) return;

  currentMonthDayMap = dayMap || null;

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
    const dayInfo = dayMap ? dayMap[String(d)] : null;
    const isHoliday = Boolean(dayInfo?.holiday) || isFriday;
    const events = Array.isArray(dayInfo?.event)
      ? dayInfo.event.map((e) => String(e || "").trim()).filter(Boolean)
      : [];
    const hasEvent = events.length > 0;
    const tip = hasEvent ? escapeHtml(events.join(" · ")) : "";

    html += `<div class="cal-cell cal-day${isToday ? " is-today" : ""}${
      isHoliday ? " is-holiday" : ""
    }${hasEvent ? " has-event" : ""}" data-day="${d}"${
      hasEvent ? ` role="button" tabindex="0" aria-label="مناسبت‌های روز ${Jalali.toFaDigits(d)}"` : ""
    }${tip ? ` title="${tip}"` : ""}>${Jalali.toFaDigits(d)}</div>`;
  }

  grid.innerHTML = html;
  syncOccasionsPanelHeight();
}

function syncOccasionsPanelHeight() {
  const month = document.querySelector(".cal-month-card");
  const occasions = document.querySelector(".cal-occasions-card");
  if (!month || !occasions) return;

  // Stacked layout on small screens — let each panel size naturally
  if (window.matchMedia("(max-width: 900px)").matches) {
    occasions.style.height = "";
    occasions.style.maxHeight = "";
    return;
  }

  // Measure calendar first with occasions unconstrained, then lock occasions to that height
  occasions.style.height = "auto";
  occasions.style.maxHeight = "none";

  requestAnimationFrame(() => {
    const h = Math.round(month.getBoundingClientRect().height);
    if (h < 120) return;
    occasions.style.height = `${h}px`;
    occasions.style.maxHeight = `${h}px`;
  });
}

function onCalendarGridActivate(event) {
  const cell = event.target.closest(".cal-day.has-event[data-day]");
  if (!cell || !event.currentTarget.contains(cell)) return;

  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
  if (event.type === "keydown") event.preventDefault();

  const day = Number(cell.getAttribute("data-day"));
  if (!Number.isFinite(day)) return;
  openDayPopup(day);
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
    syncOccasionsPanelHeight();
  } catch (err) {
    console.error("Calendar occasions error:", err);
    if (reqId !== occasionsRequestId) return;
    if (!cached) {
      renderMonthGrid(null);
      renderOccasionsList(jm, [], "error");
    }
    syncOccasionsPanelHeight();
  }
}

function shiftMonth(delta) {
  closeDayPopup();
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

  const grid = document.getElementById("cal-grid");
  if (grid && !grid.dataset.boundDayPopup) {
    grid.dataset.boundDayPopup = "1";
    grid.addEventListener("click", onCalendarGridActivate);
    grid.addEventListener("keydown", onCalendarGridActivate);
  }

  const popup = document.getElementById("cal-day-popup");
  if (popup && !popup.dataset.boundClose) {
    popup.dataset.boundClose = "1";
    popup.addEventListener("click", (event) => {
      if (event.target.closest("[data-cal-popup-close]")) closeDayPopup();
    });
  }

  if (!window.__calPanelHeightBound) {
    window.__calPanelHeightBound = true;
    let resizeTimer = null;
    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncOccasionsPanelHeight, 120);
      },
      { passive: true }
    );
  }
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
