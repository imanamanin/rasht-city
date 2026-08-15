/**
 * rasht.city — Persian calendar & time dashboard
 * Vanilla JS, no backend. Depends on assets/js/jalali.js
 */

const CAL_TZ = "Asia/Tehran";

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

/** Sample occasions keyed by Jalali month (1–12) */
const MONTH_OCCASIONS = {
  1: [
    { day: 1, title: "آغاز نوروز" },
    { day: 2, title: "عیدنوروز" },
    { day: 13, title: "سیزده‌به‌در" },
  ],
  2: [
    { day: 2, title: "روز زمین پاک" },
    { day: 10, title: "روز ملی خلیج فارس" },
    { day: 25, title: "روز بزرگداشت فردوسی" },
  ],
  3: [
    { day: 14, title: "رحلت امام خمینی" },
    { day: 15, title: "قیام ۱۵ خرداد" },
  ],
  4: [
    { day: 7, title: "روز قوه قضاییه" },
    { day: 8, title: "روز مبارزه با سلاح‌های شیمیایی" },
  ],
  5: [
    { day: 14, title: "روز حقوق بشر اسلامی" },
    { day: 15, title: "روز خبرنگار" },
  ],
  6: [
    { day: 1, title: "روز پزشک" },
    { day: 8, title: "روز مبارزه با تروریسم" },
    { day: 27, title: "روز شعر و ادب فارسی" },
  ],
  7: [
    { day: 8, title: "روز آتش‌نشانی" },
    { day: 13, title: "روز نیروی انتظامی" },
    { day: 20, title: "روز بزرگداشت حافظ" },
  ],
  8: [
    { day: 8, title: "روز دانش‌آموز" },
    { day: 13, title: "روز دانشجو" },
    { day: 24, title: "روز کتاب و کتاب‌خوانی" },
  ],
  9: [
    { day: 16, title: "روز دانشجو" },
    { day: 30, title: "شب یلدا" },
  ],
  10: [
    { day: 12, title: "آغاز هفته وحدت" },
    { day: 20, title: "روز ملی فناوری اطلاعات" },
  ],
  11: [
    { day: 12, title: "بازگشت امام خمینی به ایران" },
    { day: 22, title: "پیروزی انقلاب اسلامی" },
  ],
  12: [
    { day: 15, title: "روز درختکاری" },
    { day: 29, title: "روز ملی شدن صنعت نفت" },
  ],
};

const CITY_QUOTES = [
  "رشت شهر باران است؛ جایی که مه، چای و مهربانی در یک فنجان جا می‌گیرند.",
  "گیلان، سرزمین سبز شمال؛ رشت قلب تپنده‌اش در میان باران و بادهای خزر.",
  "در رشت، هر کوچه بوی تازگی می‌دهد؛ از بازار بزرگ تا مه‌آلود جنگل‌های سراوان.",
];

let calView = { jy: 0, jm: 0 };
let calClockTimer = null;

function calNow() {
  // Wall-clock in Tehran via Intl parts for accuracy across locales
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
    } else {
      // Capricorn wraps year
      if ((month === fm && day >= fd) || (month === tm && day <= td) || month > fm || month < tm) {
        return z.name;
      }
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
    jalaliEl.textContent = Jalali.toFaDigits(
      `${jd} ${Jalali.months[jm - 1]} ${jy}`
    );
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

function renderOccasions(jm) {
  const list = document.getElementById("cal-occasions-list");
  const title = document.getElementById("cal-occasions-month");
  if (!list) return;

  if (title) title.textContent = Jalali.months[jm - 1];

  const items = MONTH_OCCASIONS[jm] || [];
  if (!items.length) {
    list.innerHTML = `<li class="cal-occasion empty">مناسبت ثبت‌شده‌ای برای این ماه نیست.</li>`;
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
      <li class="cal-occasion">
        <span class="cal-occasion-day">${Jalali.toFaDigits(item.day)}</span>
        <span class="cal-occasion-title">${item.title}</span>
      </li>`
    )
    .join("");
}

function renderMonthGrid() {
  const grid = document.getElementById("cal-grid");
  const titleEl = document.getElementById("cal-month-title");
  const subEl = document.getElementById("cal-month-sub");
  if (!grid) return;

  const { jy, jm } = calView;
  const today = Jalali.gregorianToJalali(
    calNow().year,
    calNow().month,
    calNow().day
  );

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
    html += `<div class="cal-cell cal-day${isToday ? " is-today" : ""}${
      isFriday ? " is-friday" : ""
    }">${Jalali.toFaDigits(d)}</div>`;
  }

  grid.innerHTML = html;
  renderOccasions(jm);
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
  renderMonthGrid();
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
  renderMonthGrid();
  bindCalendarControls();
  tickClock();

  if (calClockTimer) clearInterval(calClockTimer);
  calClockTimer = setInterval(() => {
    tickClock();
    // Refresh date cards around midnight
    if (calNow().hour === 0 && calNow().minute === 0 && calNow().second < 2) {
      const t = updateDateCards();
      if (calView.jy === t.jy && calView.jm === t.jm) renderMonthGrid();
    }
  }, 1000);
}

window.initCalendarDashboard = initCalendarDashboard;
