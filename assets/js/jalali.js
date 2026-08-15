/**
 * Compact Jalali (Persian) calendar helpers — no dependencies.
 * Algorithms adapted from common public-domain Jalali converters.
 */

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const JALALI_WEEKDAYS_FULL = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

function div(a, b) {
  return Math.floor(a / b);
}

function gregorianToJalali(gy, gm, gd) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    gdm[gm - 1];
  let jy = -1595 + 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    div(jy, 33) * 8 +
    div((jy % 33) + 3, 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm += 1) gd -= sal_a[gm];
  return { gy, gm, gd };
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 29 or 30
  const g1 = jalaliToGregorian(jy, 12, 29);
  const g2 = jalaliToGregorian(jy + 1, 1, 1);
  const d1 = Date.UTC(g1.gy, g1.gm - 1, g1.gd);
  const d2 = Date.UTC(g2.gy, g2.gm - 1, g2.gd);
  return Math.round((d2 - d1) / 86400000) === 1 ? 29 : 30;
}

/** Saturday-based weekday index for Jalali date (0=Sat … 6=Fri) */
function jalaliWeekdayIndex(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, jd);
  const js = new Date(g.gy, g.gm - 1, g.gd).getDay(); // 0=Sun
  return (js + 1) % 7; // Sat=0
}

function toFaDigits(value) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

window.Jalali = {
  months: JALALI_MONTHS,
  weekdays: JALALI_WEEKDAYS,
  weekdaysFull: JALALI_WEEKDAYS_FULL,
  gregorianToJalali,
  jalaliToGregorian,
  jalaliMonthLength,
  jalaliWeekdayIndex,
  toFaDigits,
};
