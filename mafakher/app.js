/**
 * مفاخر گیلان — list + memorial detail (hash routing)
 */

const DATA_URL = "../assets/data/gilan-figures.json";

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatFaDate(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatLife(birth, death) {
  const parts = [];
  if (birth) parts.push(`زاده ${escapeHtml(birth)}`);
  if (death) parts.push(`درگذشت ${escapeHtml(death)}`);
  return parts.join(" · ") || "—";
}

function publishedFigures(data) {
  return (data.figures || []).filter((f) => f && f.status === "published" && f.isBornInGilan === true);
}

function renderList(figures) {
  const featured = document.getElementById("maf-featured");
  const grid = document.getElementById("maf-grid");
  const empty = document.getElementById("maf-empty");
  if (!featured || !grid || !empty) return;

  if (!figures.length) {
    featured.innerHTML = "";
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  const top = figures[0];
  const photo = top.image?.url
    ? `style="background-image:url('${escapeHtml(top.image.url)}')"`
    : "";

  featured.innerHTML = `
    <a class="maf-featured-card" href="#${encodeURIComponent(top.slug)}">
      <div class="maf-featured-media" ${photo} role="img" aria-label="${escapeHtml(top.image?.alt || top.fullName)}"></div>
      <div class="maf-featured-body">
        <span class="maf-chip">${escapeHtml(top.category || "مفاخر")}</span>
        <h2>${escapeHtml(top.fullName)}</h2>
        <p>${escapeHtml(top.shortDescription || "")}</p>
        <p class="maf-meta-line">${escapeHtml(top.birthPlace || "")} · ${formatLife(top.birthDate, top.deathDate)}</p>
      </div>
    </a>`;

  grid.innerHTML = figures
    .map((f) => {
      const bg = f.image?.url
        ? `style="background-image:url('${escapeHtml(f.image.url)}')"`
        : "";
      return `
        <a class="maf-card" href="#${encodeURIComponent(f.slug)}" role="listitem">
          <div class="maf-card-media" ${bg}></div>
          <div class="maf-card-body">
            <span class="maf-chip">${escapeHtml(f.category || "مفاخر")}</span>
            <h3>${escapeHtml(f.fullName)}</h3>
            <p>${escapeHtml(f.birthPlace || "")}</p>
          </div>
        </a>`;
    })
    .join("");
}

function renderDetail(figure) {
  const host = document.getElementById("maf-memorial");
  if (!host || !figure) return;

  const photo = figure.image?.url
    ? `style="background-image:url('${escapeHtml(figure.image.url)}')"`
    : "";

  const achievements = (figure.achievements || [])
    .map((a) => `<li>${escapeHtml(a)}</li>`)
    .join("");

  const notes = (figure.sourceNotes || [])
    .map((n) => `<li>${escapeHtml(n)}</li>`)
    .join("");

  const imageCredit = figure.image
    ? `<p>تصویر:
        ${figure.image.sourceUrl ? `<a href="${escapeHtml(figure.image.sourceUrl)}" target="_blank" rel="noopener noreferrer">منبع پرونده</a>` : "—"}
        ${figure.image.license ? ` · مجوز: ${escapeHtml(figure.image.license)}` : ""}
      </p>`
    : "";

  host.innerHTML = `
    <div class="maf-memorial-hero">
      <div class="maf-memorial-photo" ${photo} role="img" aria-label="${escapeHtml(figure.image?.alt || figure.fullName)}"></div>
      <div class="maf-memorial-intro">
        <span class="maf-chip">${escapeHtml(figure.category || "مفاخر")}</span>
        <h1>${escapeHtml(figure.fullName)}</h1>
        <p>${escapeHtml(figure.title || figure.shortDescription || "")}</p>
        <p class="maf-meta-line">${escapeHtml(figure.birthPlace || "")} · ${formatLife(figure.birthDate, figure.deathDate)}</p>
      </div>
    </div>
    <div class="maf-memorial-content">
      <section>
        <h2>یادبود</h2>
        <p class="maf-bio">${escapeHtml(figure.biography || "")}</p>
      </section>
      <section>
        <h2>نکات برجسته</h2>
        <ul class="maf-achievements">${achievements}</ul>
      </section>
      <section class="maf-source-box">
        <h2>منبع و شفافیت</h2>
        <p>
          مقالهٔ ویکی‌پدیای فارسی:
          <a href="${escapeHtml(figure.wikipediaFaUrl)}" target="_blank" rel="noopener noreferrer">مشاهدهٔ مقاله منبع</a>
        </p>
        <p>تاریخ واکشی: ${escapeHtml(formatFaDate(figure.fetchedAt))}</p>
        <p>تاریخ انتشار در rasht.city: ${escapeHtml(formatFaDate(figure.publishedAt))}</p>
        ${imageCredit}
        ${notes ? `<ul class="maf-notes">${notes}</ul>` : ""}
      </section>
    </div>`;
}

function showList() {
  document.getElementById("maf-list-view").hidden = false;
  document.getElementById("maf-detail-view").hidden = true;
  document.title = "مفاخر گیلان — rasht.city";
}

function showDetail(figure) {
  document.getElementById("maf-list-view").hidden = true;
  document.getElementById("maf-detail-view").hidden = false;
  renderDetail(figure);
  document.title = `${figure.fullName} — مفاخر گیلان`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function boot() {
  const listView = document.getElementById("maf-list-view");
  const detailView = document.getElementById("maf-detail-view");
  const back = document.getElementById("maf-back");

  let figures = [];
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    figures = publishedFigures(data);
  } catch (err) {
    listView.innerHTML = `<p class="maf-empty">بارگذاری داده‌ها ممکن نشد: ${escapeHtml(String(err.message || err))}</p>`;
    return;
  }

  renderList(figures);

  const route = () => {
    const slug = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!slug) {
      showList();
      return;
    }
    const figure = figures.find((f) => f.slug === slug);
    if (!figure) {
      showList();
      return;
    }
    showDetail(figure);
  };

  back?.addEventListener("click", () => {
    location.hash = "";
  });
  window.addEventListener("hashchange", route);
  route();
}

boot();
