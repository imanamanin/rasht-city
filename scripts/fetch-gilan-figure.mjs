/**
 * rasht.city — Discover one Gilan-born figure via Wikidata + Persian Wikipedia APIs.
 * Usage: node scripts/fetch-gilan-figure.mjs
 * Optional: node scripts/fetch-gilan-figure.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIGURES_PATH = path.join(ROOT, "assets", "data", "gilan-figures.json");
const LOG_PATH = path.join(ROOT, "assets", "data", "gilan-figures-log.json");

const UA = "rasht.city-gilan-figures/1.0 (https://rasht.city; memorial posts; contact via GitHub imanamanin/rasht-city)";
const WD_SPARQL = "https://query.wikidata.org/sparql";
const FA_API = "https://fa.wikipedia.org/w/api.php";
const WD_API = "https://www.wikidata.org/w/api.php";
const GILAN_PROVINCE_QID = "Q928828";

/** Persian place names used as secondary birthplace text checks */
const GILAN_PLACE_NAMES = [
  "گیلان",
  "رشت",
  "لاهیجان",
  "بندرانزلی",
  "بندر انزلی",
  "انزلی",
  "رودسر",
  "فومن",
  "لنگرود",
  "آستارا",
  "صومعه‌سرا",
  "صومعه سرا",
  "تالش",
  "هشتپر",
  "سیاهکل",
  "شفت",
  "آستانه‌اشرفیه",
  "آستانه اشرفیه",
  "ماسال",
  "املش",
  "رضوانشهر",
  "رودبار",
  "منجیل",
  "لوشان",
  "خمام",
  "کوچصفهان",
  "سنگر",
  "کیاشهر",
  "چابکسر",
  "کلاچای",
  "رحیم‌آباد",
  "پره سر",
  "اسالم",
  "لیسار",
  "حویق",
  "لوندویل",
  "دیلمان",
  "عمارلو",
  "جیرنده",
  "بره‌سر",
  "توتکابن",
  "رستم‌آباد",
  "لشت نشا",
  "لشت‌نشاء",
  "خشکبیجار",
  "کومله",
  "اطاقور",
  "شلمان",
  "بازارجمعه",
  "گوراب زرمیخ",
  "مرجقل",
  "فومنات",
];

const OCCUPATION_CATEGORY = [
  { match: /نقاش|مجسم|مجسمه‌ساز|هنرمند|بازیگر|سینما|تئاتر|کارگردان/i, category: "هنر" },
  { match: /موسیق|آهنگ|خوانند|نوازند|آواز/i, category: "موسیقی" },
  { match: /شاعر|نویسند|ادبیات|داستان|رمان|روزنام/i, category: "ادبیات" },
  { match: /مترجم/i, category: "ادبیات" },
  { match: /ورزش|فوتبال|کشتی|قهرمان|بازیکن|مربی/i, category: "ورزش" },
  { match: /علم|پژوهش|استاد|فیزیک|شیمی|ریاض|پزشک|دکتر|مهندس/i, category: "علم" },
  { match: /سیاست|وزیر|نماینده|فرماندار|شهردار/i, category: "سیاست" },
  { match: /دین|روحان|آیت‌الله|حجت|امام/i, category: "دین" },
  { match: /آموزش|معلم|فرهنگ/i, category: "آموزش" },
  { match: /کارآفرین|بازرگان|صنعت/i, category: "کارآفرینی" },
];

const dryRun = process.argv.includes("--dry-run");

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: init.accept || "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function appendLog(entry) {
  const log = readJson(LOG_PATH, { entries: [] });
  log.entries.unshift({ at: new Date().toISOString(), ...entry });
  log.entries = log.entries.slice(0, 100);
  writeJson(LOG_PATH, log);
  console.log(`[log] ${entry.level}: ${entry.message}`);
}

function slugify(name) {
  const base = String(name)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `figure-${Date.now()}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function placeLooksGilan(placeLabel) {
  if (!placeLabel) return false;
  const t = placeLabel.replace(/\u200c/g, "").trim();
  return GILAN_PLACE_NAMES.some((p) => t.includes(p.replace(/\u200c/g, "")));
}

async function queryGilanBornCandidates(limit = 80) {
  const sparql = `
SELECT DISTINCT ?person ?personLabel ?place ?placeLabel ?article WHERE {
  ?person wdt:P19 ?place .
  ?place wdt:P131* wd:${GILAN_PROVINCE_QID} .
  ?article schema:about ?person ;
           schema:isPartOf <https://fa.wikipedia.org/> .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fa,en". }
}
LIMIT ${limit}
`.trim();

  const url = `${WD_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`;
  const data = await fetchJson(url, {
    accept: "application/sparql-results+json",
  });

  return (data.results?.bindings || []).map((b) => ({
    qid: String(b.person.value).split("/").pop(),
    name: b.personLabel?.value || "",
    placeQid: String(b.place.value).split("/").pop(),
    placeLabel: b.placeLabel?.value || "",
    articleUrl: b.article.value,
  }));
}

async function fetchWikidataEntity(qid) {
  const url = `${WD_API}?${new URLSearchParams({
    action: "wbgetentities",
    ids: qid,
    props: "labels|descriptions|claims|sitelinks",
    languages: "fa|en",
    format: "json",
  })}`;
  const data = await fetchJson(url);
  return data.entities?.[qid] || null;
}

function claimValues(entity, prop) {
  const claims = entity?.claims?.[prop] || [];
  return claims
    .map((c) => c.mainsnak?.datavalue)
    .filter(Boolean);
}

function timeToIso(timeValue) {
  // +1940-01-01T00:00:00Z
  const t = timeValue?.value?.time;
  if (!t) return undefined;
  const m = t.match(/([+-]?\d+)-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = m[2];
  const d = m[3];
  if (mo === "00" || d === "00") return String(Math.abs(y));
  return `${Math.abs(y)}-${mo}-${d}`;
}

async function resolvePlaceLabel(qid) {
  const ent = await fetchWikidataEntity(qid);
  return ent?.labels?.fa?.value || ent?.labels?.en?.value || qid;
}

async function verifyBornInGilan(entity) {
  const birthClaims = claimValues(entity, "P19");
  if (!birthClaims.length) {
    return { ok: false, reason: "Wikidata P19 (محل تولد) موجود نیست" };
  }

  for (const dv of birthClaims) {
    if (dv.type !== "wikibase-entityid") continue;
    const placeQid = dv.value?.id;
    if (!placeQid) continue;

    // Check place is administratively under Gilan via SPARQL ASK
    const ask = `
ASK {
  wd:${placeQid} wdt:P131* wd:${GILAN_PROVINCE_QID} .
}
`.trim();
    const url = `${WD_SPARQL}?query=${encodeURIComponent(ask)}&format=json`;
    const data = await fetchJson(url, { accept: "application/sparql-results+json" });
    const ok = Boolean(data.boolean);
    const label = await resolvePlaceLabel(placeQid);
    if (ok || placeLooksGilan(label)) {
      return { ok: true, placeQid, placeLabel: label };
    }
  }

  return { ok: false, reason: "محل تولد در سلسله‌مراتب استان گیلان تأیید نشد" };
}

function faTitleFromArticleUrl(articleUrl) {
  try {
    const u = new URL(articleUrl);
    const parts = u.pathname.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch {
    return "";
  }
}

async function fetchWikipediaBundle(title) {
  const url = `${FA_API}?${new URLSearchParams({
    action: "query",
    prop: "extracts|pageimages|info|categories|pageprops",
    exintro: "1",
    explaintext: "1",
    piprop: "thumbnail|original|name",
    pithumbsize: "800",
    inprop: "url",
    cllimit: "30",
    titles: title,
    redirects: "1",
    format: "json",
    origin: "*",
  })}`;
  const data = await fetchJson(url);
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing != null) return null;
  return page;
}

async function fetchImageMeta(fileName) {
  if (!fileName) return null;
  const title = fileName.startsWith("File:") ? fileName : `File:${fileName}`;
  const url = `${FA_API}?${new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    format: "json",
  })}`;
  const data = await fetchJson(url);
  const page = Object.values(data.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  const license =
    meta.LicenseShortName?.value ||
    meta.License?.value ||
    meta.UsageTerms?.value ||
    undefined;
  const artist = meta.Artist?.value?.replace(/<[^>]+>/g, "") || undefined;
  return {
    url: info.url,
    sourceUrl: info.descriptionurl || info.url,
    license: license ? String(license).replace(/<[^>]+>/g, "") : undefined,
    artist,
  };
}

function pickCategory(description, occupations, extract) {
  const blob = [description, ...(occupations || []), extract || ""].join(" ");
  for (const row of OCCUPATION_CATEGORY) {
    if (row.match.test(blob)) return row.category;
  }
  return "فرهنگ";
}

function occupationLabels(entity) {
  // We'll resolve later if needed; for now use description
  return [];
}

function rewriteBiography({ fullName, birthPlace, birthDate, deathDate, category, extract, description }) {
  // Independent memorial prose from structured facts — do not paste Wikipedia extract verbatim.
  const years = [];
  if (birthDate) years.push(`زادهٔ ${birthDate}`);
  if (deathDate) years.push(`درگذشتهٔ ${deathDate}`);
  const yearBit = years.length ? ` (${years.join(" — ")})` : "";

  const lead =
    description && description.length > 8
      ? `${fullName}${yearBit}، ${description}، از چهره‌های شناخته‌شدهٔ مرتبط با استان گیلان است.`
      : `${fullName}${yearBit} از چهره‌های ثبت‌شده در منابع عمومی است که زادگاهش در ${birthPlace} تأیید شده است.`;

  const placeLine = `بر پایهٔ داده‌های ویکی‌داده و مقالهٔ ویکی‌پدیای فارسی، محل تولد او ${birthPlace} (در محدودهٔ استان گیلان) گزارش شده است.`;

  const domainLine = `حوزهٔ فعالیت او در این یادبود زیر عنوان «${category}» آمده است.`;

  const cues = [];
  if (extract) {
    const text = extract.replace(/\s+/g, " ");
    if (/(زاده|متولد|به دنیا)/.test(text)) {
      cues.push("منابع عمومی به جزئیات زادگاه و زمینهٔ زندگی او اشاره کرده‌اند.");
    }
    if (deathDate && /(درگذشت|فوت|وفات)/.test(text)) {
      cues.push("سال‌های پایانی زندگی او نیز در همان منابع عمومی ثبت شده است.");
    }
  }
  cues.push("این صفحه یک یادبود خلاصه‌شده است و جایگزین مطالعهٔ مقالهٔ کامل منبع نیست.");

  // unique preserve order
  const unique = [...new Set(cues)];
  return [lead, placeLine, domainLine, ...unique].join("\n\n");
}

function buildAchievements({ category, description, extract }) {
  const items = [];
  if (description) items.push(`شناخته‌شده به‌عنوان: ${description}`);
  items.push(`ثبت در حوزهٔ «${category}» در یادبود مفاخر گیلان`);
  if (extract && /جایزه|قهرمان|برنده|نوبل|نشان/.test(extract)) {
    items.push("در منابع عمومی به افتخارات یا عناوین برجسته اشاره شده است (جزئیات در مقالهٔ ویکی‌پدیا).");
  }
  items.push("وجود مقالهٔ مستقل در ویکی‌پدیای فارسی");
  return items.slice(0, 5);
}

function makeId(qid, slug) {
  return createHash("sha1").update(`${qid}:${slug}`).digest("hex").slice(0, 12);
}

async function buildFigure(candidate) {
  const entity = await fetchWikidataEntity(candidate.qid);
  if (!entity) throw new Error("ویکی‌داده در دسترس نیست");

  const birthCheck = await verifyBornInGilan(entity);
  if (!birthCheck.ok) {
    return { skip: true, reason: birthCheck.reason };
  }

  const title = faTitleFromArticleUrl(candidate.articleUrl);
  if (!title) return { skip: true, reason: "عنوان مقاله فارسی نامعتبر است" };

  const page = await fetchWikipediaBundle(title);
  if (!page) return { skip: true, reason: "صفحه ویکی‌پدیای فارسی یافت نشد" };

  const extract = (page.extract || "").trim();
  if (extract.length < 40) {
    return { skip: true, reason: "خلاصه مقاله برای ساخت یادبود کافی نیست" };
  }

  // Extra text validation: intro should not contradict Gilan birth when it mentions birth elsewhere
  const birthMention = extract.match(/(?:زادهٔ|زادگاه|متولد)\s+([^،.]+)/);
  if (birthMention) {
    const mentioned = birthMention[1];
    if (!placeLooksGilan(mentioned) && !placeLooksGilan(birthCheck.placeLabel)) {
      // If extract mentions a clear non-Gilan birth city keyword set, skip
      const nonGilanHint = /(تهران|اصفهان|شیراز|تبریز|مشهد|اهواز|کرمان|یزد)/.test(mentioned);
      if (nonGilanHint) {
        return { skip: true, reason: `متن مقاله زادگاه ناسازگار ذکر کرده: ${mentioned}` };
      }
    }
  }

  const fullName =
    entity.labels?.fa?.value ||
    page.title ||
    candidate.name;
  const description =
    entity.descriptions?.fa?.value ||
    entity.descriptions?.en?.value ||
    "";

  const birthDate = timeToIso(claimValues(entity, "P569")[0]);
  const deathDate = timeToIso(claimValues(entity, "P570")[0]);
  const category = pickCategory(description, occupationLabels(entity), extract);
  const slugBase = slugify(fullName);
  const slug = `${slugBase}-${candidate.qid.toLowerCase()}`;

  let image;
  if (page.original?.source || page.thumbnail?.source) {
    const fileName = page.pageimage || page.pageimage;
    const meta = page.pageimage ? await fetchImageMeta(page.pageimage) : null;
    image = {
      url: meta?.url || page.original?.source || page.thumbnail?.source,
      alt: `تصویر ${fullName}`,
      sourceUrl: meta?.sourceUrl || page.fullurl,
      license: meta?.license || "see Wikimedia Commons / Wikipedia file page",
    };
  }

  const wikipediaFaUrl = page.fullurl || candidate.articleUrl;
  const now = new Date().toISOString();

  const figure = {
    id: makeId(candidate.qid, slug),
    slug,
    wikidataId: candidate.qid,
    fullName,
    title: description || undefined,
    shortDescription:
      description ||
      `چهره‌ای از ${birthCheck.placeLabel} که در منابع عمومی ثبت شده است.`,
    category,
    birthDate,
    deathDate,
    birthPlace: birthCheck.placeLabel,
    isBornInGilan: true,
    city: birthCheck.placeLabel,
    biography: rewriteBiography({
      fullName,
      birthPlace: birthCheck.placeLabel,
      birthDate,
      deathDate,
      category,
      extract,
      description,
    }),
    achievements: buildAchievements({ category, description, extract }),
    quote: undefined,
    image,
    wikipediaFaUrl,
    fetchedAt: now,
    publishedAt: now,
    status: "published",
    sourceNotes: [
      "محل تولد از طریق Wikidata P19 و سلسله‌مراتب P131 استان گیلان تأیید شد.",
      "متن یادبود بازنویسی مستقل بر اساس فکت‌های ساختاریافته است؛ متن ویکی‌پدیا عیناً کپی نشده.",
      `مقاله منبع: ${wikipediaFaUrl}`,
    ],
  };

  return { skip: false, figure };
}

async function main() {
  const store = readJson(FIGURES_PATH, { updatedAt: null, figures: [] });
  const existing = new Set(
    (store.figures || []).flatMap((f) => [f.slug, f.wikidataId, f.wikipediaFaUrl, f.id].filter(Boolean))
  );

  let candidates;
  try {
    candidates = await queryGilanBornCandidates(100);
  } catch (err) {
    appendLog({
      level: "error",
      message: "واکشی فهرست نامزدها از ویکی‌داده ناموفق بود",
      detail: String(err.message || err),
    });
    process.exitCode = 1;
    return;
  }

  const fresh = shuffle(candidates).filter((c) => {
    if (!c.qid || !c.articleUrl) return false;
    if (existing.has(c.qid) || existing.has(c.articleUrl)) return false;
    return true;
  });

  if (!fresh.length) {
    appendLog({
      level: "info",
      message: "نامزد جدیدی باقی نمانده یا همه قبلاً ثبت شده‌اند",
      detail: `totalCandidates=${candidates.length}`,
    });
    return;
  }

  let published = null;
  const skipped = [];

  for (const candidate of fresh.slice(0, 25)) {
    try {
      const result = await buildFigure(candidate);
      if (result.skip) {
        skipped.push({ name: candidate.name, reason: result.reason });
        continue;
      }
      published = result.figure;
      break;
    } catch (err) {
      skipped.push({ name: candidate.name, reason: String(err.message || err) });
    }
  }

  if (!published) {
    appendLog({
      level: "warn",
      message: "فرد واجد شرایط قابل‌اتکا برای انتشار پیدا نشد؛ چیزی منتشر نشد",
      detail: skipped.slice(0, 10),
    });
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify(published, null, 2));
    appendLog({
      level: "info",
      message: `dry-run: ${published.fullName}`,
      detail: { slug: published.slug },
    });
    return;
  }

  store.figures = [published, ...(store.figures || [])];
  store.updatedAt = new Date().toISOString();
  writeJson(FIGURES_PATH, store);

  appendLog({
    level: "success",
    message: `یادبود جدید منتشر شد: ${published.fullName}`,
    detail: {
      slug: published.slug,
      wikipediaFaUrl: published.wikipediaFaUrl,
      skippedTried: skipped.length,
    },
  });

  console.log(`Published: ${published.fullName} → ${published.slug}`);
}

main().catch((err) => {
  appendLog({ level: "error", message: "اجرای اسکریپت با خطا متوقف شد", detail: String(err.stack || err) });
  process.exitCode = 1;
});
