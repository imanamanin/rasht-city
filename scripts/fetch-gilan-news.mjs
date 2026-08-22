/**
 * rasht.city — Fetch recent Rasht/Gilan news from public RSS feeds.
 * Usage:
 *   node scripts/fetch-gilan-news.mjs
 *   node scripts/fetch-gilan-news.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const NEWS_PATH = path.join(ROOT, "assets", "data", "gilan-news.json");

const UA =
  "rasht.city-gilan-news/1.0 (https://rasht.city; hourly local news aggregate; contact via GitHub imanamanin/rasht-city)";
const MAX_ITEMS = 36;
const dryRun = process.argv.includes("--dry-run");

const REGION_RE =
  /رشت|گیلان|انزلی|لاهیجان|فومن|تالش|آستارا|لنگرود|رودسر|صومعه‌?سرا|ماسال|شفت|سیاهکل|املش|رضوانشهر|رودبار|منجیل|خمام|گیلانی/;

const FEEDS = [
  {
    id: "yjc-gilan",
    source: "باشگاه خبرنگاران جوان · گیلان",
    url: "https://www.yjc.ir/fa/rss/41",
    requireRegion: false,
  },
  {
    id: "google-site-mehr",
    source: "مهر",
    url: "https://news.google.com/rss/search?q=site:mehrnews.com+%DA%AF%DB%8C%D9%84%D8%A7%D9%86%20OR%20%D8%B1%D8%B4%D8%AA&hl=fa&gl=IR&ceid=IR:fa",
    requireRegion: true,
  },
  {
    id: "google-site-irna",
    source: "ایرنا",
    url: "https://news.google.com/rss/search?q=site:irna.ir+%DA%AF%DB%8C%D9%84%D8%A7%D9%86%20OR%20%D8%B1%D8%B4%D8%AA&hl=fa&gl=IR&ceid=IR:fa",
    requireRegion: true,
  },
  {
    id: "google-site-isna",
    source: "ایسنا",
    url: "https://news.google.com/rss/search?q=site:isna.ir+%DA%AF%DB%8C%D9%84%D8%A7%D9%86%20OR%20%D8%B1%D8%B4%D8%AA&hl=fa&gl=IR&ceid=IR:fa",
    requireRegion: true,
  },
  {
    id: "google-site-fars",
    source: "فارس",
    url: "https://news.google.com/rss/search?q=site:farsnews.ir+%DA%AF%DB%8C%D9%84%D8%A7%D9%86%20OR%20%D8%B1%D8%B4%D8%AA&hl=fa&gl=IR&ceid=IR:fa",
    requireRegion: true,
  },
  {
    id: "khabaronline",
    source: "خبرآنلاین",
    url: "https://www.khabaronline.ir/rss",
    requireRegion: true,
  },
];

function isPersianHeadline(title) {
  const t = String(title || "");
  const persian = (t.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  // Keep Persian news only — drop English / bilingual-latin headlines
  return persian >= 8 && persian >= latin * 2;
}

function looksRelevant(title, summary) {
  if (String(title).trim().length < 12) return false;
  if (!isPersianHeadline(title)) return false;
  if (/عرق سگی/i.test(title)) return false;
  return true;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function decodeEntities(str) {
  return String(str || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripHtml(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function tagContent(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function tagAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function splitItems(xml) {
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  const entryRe = /<entry\b[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = itemRe.exec(xml))) items.push({ kind: "rss", block: m[0] });
  while ((m = entryRe.exec(xml))) items.push({ kind: "atom", block: m[0] });
  return items;
}

function parsePublished(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function splitTitleSource(title) {
  const cleaned = String(title || "").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+[—–\-|]\s+/);
  if (parts.length >= 2) {
    const source = parts.pop().trim();
    return { title: parts.join(" — ").trim(), sourceHint: source };
  }
  return { title: cleaned, sourceHint: "" };
}

function makeId(url, title) {
  return createHash("sha1").update(`${url}||${title}`).digest("hex").slice(0, 12);
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return String(url || "").trim();
  }
}

function parseFeedItem(kind, block, feed) {
  let title = "";
  let link = "";
  let summaryHtml = "";
  let publishedRaw = "";
  let source = feed.source;

  if (kind === "rss") {
    title = stripHtml(tagContent(block, "title"));
    link = tagContent(block, "link") || tagAttr(block, "link", "href");
    summaryHtml =
      tagContent(block, "content:encoded") ||
      tagContent(block, "description") ||
      tagContent(block, "summary");
    publishedRaw = tagContent(block, "pubDate") || tagContent(block, "dc:date");
    const srcTitle = tagContent(block, "source");
    if (srcTitle) source = stripHtml(srcTitle);
  } else {
    title = stripHtml(tagContent(block, "title"));
    link = tagAttr(block, "link", "href") || tagContent(block, "id");
    summaryHtml = tagContent(block, "content") || tagContent(block, "summary");
    publishedRaw = tagContent(block, "updated") || tagContent(block, "published");
  }

  const { title: cleanTitle, sourceHint } = splitTitleSource(title);
  if (sourceHint) source = sourceHint;

  const url = normalizeUrl(link);
  const summary = stripHtml(summaryHtml);
  const publishedAt = parsePublished(publishedRaw);

  if (!cleanTitle || !url) return null;

  const haystack = `${cleanTitle}\n${summary}`;
  if (feed.requireRegion && !REGION_RE.test(haystack)) return null;
  if (!looksRelevant(cleanTitle, summary)) return null;

  return {
    id: makeId(url, cleanTitle),
    title: cleanTitle,
    summary: summary || cleanTitle,
    source: source || feed.source,
    url,
    publishedAt,
    feedId: feed.id,
  };
}

async function loadFeed(feed) {
  const xml = await fetchText(feed.url);
  const chunks = splitItems(xml);
  const items = [];
  for (const chunk of chunks) {
    const item = parseFeedItem(chunk.kind, chunk.block, feed);
    if (item) items.push(item);
  }
  return items;
}

function dedupeKey(item) {
  const titleKey = String(item.title || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${normalizeUrl(item.url)}::${titleKey}`;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const collected = [];
  const errors = [];

  for (const feed of FEEDS) {
    try {
      const items = await loadFeed(feed);
      collected.push(...items);
      console.log(`[ok] ${feed.id}: ${items.length} items`);
    } catch (err) {
      errors.push({ feed: feed.id, error: String(err.message || err) });
      console.warn(`[skip] ${feed.id}: ${err.message || err}`);
    }
  }

  const seen = new Set();
  const unique = [];
  for (const item of collected) {
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      url: item.url,
      publishedAt: item.publishedAt,
      fetchedAt,
    });
  }

  unique.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  const items = unique.slice(0, MAX_ITEMS);
  const payload = {
    updatedAt: fetchedAt,
    sourceNote:
      "Aggregated from public RSS (Google News + available agency feeds). Summaries come from feed descriptions; open the source for the full article.",
    errors,
    items,
  };

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    console.log(`Dry-run: ${items.length} items`);
    return;
  }

  writeJson(NEWS_PATH, payload);
  console.log(`Wrote ${items.length} news items → ${path.relative(ROOT, NEWS_PATH)}`);
  if (errors.length) console.log(`Feed errors: ${errors.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
