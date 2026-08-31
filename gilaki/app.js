/**
 * فرهنگ واژگان و ضرب‌المثل‌های گیلکی
 */
(function () {
  "use strict";

  const DATA_URL = "../assets/data/gilaki-lexicon.json";

  const state = {
    entries: [],
    categories: [],
    query: "",
    category: "all",
    highlightId: null,
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function categoryLabel(id) {
    const found = state.categories.find((c) => c.id === id);
    return found ? found.label : id;
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\u200c/g, "")
      .trim();
  }

  function filteredEntries() {
    const q = normalize(state.query);
    return state.entries.filter((e) => {
      if (state.category !== "all" && e.category !== state.category) return false;
      if (!q) return true;
      const blob = normalize([e.term, e.meaning, e.example, e.phonetic, categoryLabel(e.category)].join(" "));
      return blob.includes(q);
    });
  }

  function cardShareText(entry) {
    const cat = categoryLabel(entry.category);
    const lines = [
      `گیلکی: ${entry.term}`,
      entry.phonetic ? `(${entry.phonetic})` : "",
      `معنی: ${entry.meaning}`,
      entry.example ? `مثال: ${entry.example}` : "",
      `دسته: ${cat}`,
      "",
      `از فرهنگ گیلکی rasht.city`,
      shareUrlFor(entry),
    ];
    return lines.filter(Boolean).join("\n");
  }

  function shareUrlFor(entry) {
    const base = `${location.origin}${location.pathname}`;
    return `${base}#${encodeURIComponent(entry.id)}`;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }

  function flashButton(btn, label) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = label;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
    }, 1400);
  }

  async function onCopy(entry, btn) {
    try {
      const ok = await copyText(cardShareText(entry));
      flashButton(btn, ok ? "کپی شد" : "ناموفق");
    } catch {
      flashButton(btn, "ناموفق");
    }
  }

  async function onShare(entry, btn) {
    const text = cardShareText(entry);
    const url = shareUrlFor(entry);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `گیلکی: ${entry.term}`,
          text,
          url,
        });
        flashButton(btn, "ارسال شد");
        return;
      }
      const ok = await copyText(text);
      flashButton(btn, ok ? "لینک کپی شد" : "ناموفق");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      flashButton(btn, "ناموفق");
    }
  }

  function renderFilters() {
    const host = $("gilaki-filters");
    if (!host) return;
    const allBtn = `<button type="button" class="gilaki-chip${state.category === "all" ? " is-active" : ""}" data-cat="all">همه</button>`;
    const rest = state.categories
      .map(
        (c) =>
          `<button type="button" class="gilaki-chip${state.category === c.id ? " is-active" : ""}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
      )
      .join("");
    host.innerHTML = allBtn + rest;
    host.querySelectorAll("[data-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.getAttribute("data-cat") || "all";
        render();
      });
    });
  }

  function renderList() {
    const host = $("gilaki-list");
    const empty = $("gilaki-empty");
    const count = $("gilaki-count");
    if (!host) return;

    const list = filteredEntries();
    if (count) count.textContent = `${list.length} مورد`;

    if (!list.length) {
      host.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    host.innerHTML = list
      .map((e) => {
        const active = state.highlightId === e.id ? " is-highlight" : "";
        return `
        <article class="gilaki-card${active}" id="entry-${escapeHtml(e.id)}" data-id="${escapeHtml(e.id)}">
          <div class="gilaki-card-top">
            <span class="gilaki-cat">${escapeHtml(categoryLabel(e.category))}</span>
            ${e.phonetic ? `<span class="gilaki-phonetic" dir="ltr">${escapeHtml(e.phonetic)}</span>` : ""}
          </div>
          <h2 class="gilaki-term">${escapeHtml(e.term)}</h2>
          <p class="gilaki-meaning">${escapeHtml(e.meaning)}</p>
          ${e.example ? `<p class="gilaki-example"><span>مثال:</span> ${escapeHtml(e.example)}</p>` : ""}
          <div class="gilaki-actions">
            <button type="button" class="gilaki-btn" data-action="copy">کپی کارت</button>
            <button type="button" class="gilaki-btn gilaki-btn-share" data-action="share">اشتراک‌گذاری</button>
          </div>
        </article>`;
      })
      .join("");

    host.querySelectorAll(".gilaki-card").forEach((card) => {
      const id = card.getAttribute("data-id");
      const entry = state.entries.find((e) => e.id === id);
      if (!entry) return;
      const copyBtn = card.querySelector('[data-action="copy"]');
      const shareBtn = card.querySelector('[data-action="share"]');
      if (copyBtn) copyBtn.addEventListener("click", () => onCopy(entry, copyBtn));
      if (shareBtn) shareBtn.addEventListener("click", () => onShare(entry, shareBtn));
    });

    if (state.highlightId) {
      const el = document.getElementById(`entry-${state.highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function render() {
    renderFilters();
    renderList();
  }

  function pickRandom() {
    const pool = filteredEntries();
    const source = pool.length ? pool : state.entries;
    if (!source.length) return;
    const entry = source[Math.floor(Math.random() * source.length)];
    state.highlightId = entry.id;
    // if filtered empty somehow, clear filters to show it
    if (!pool.find((e) => e.id === entry.id)) {
      state.category = "all";
      state.query = "";
      const input = $("gilaki-search");
      if (input) input.value = "";
    }
    render();
    history.replaceState(null, "", `#${encodeURIComponent(entry.id)}`);
  }

  function applyHash() {
    const raw = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    if (!raw) return;
    if (state.entries.some((e) => e.id === raw)) {
      state.highlightId = raw;
      state.category = "all";
      state.query = "";
      const input = $("gilaki-search");
      if (input) input.value = "";
    }
  }

  async function boot() {
    const year = $("year");
    if (year) year.textContent = String(new Date().getFullYear());

    const status = $("gilaki-status");
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.categories = Array.isArray(data.categories) ? data.categories : [];
      state.entries = Array.isArray(data.entries) ? data.entries : [];
      if (status) status.hidden = true;
      applyHash();
      render();
    } catch (err) {
      console.error(err);
      if (status) {
        status.hidden = false;
        status.className = "state error";
        status.textContent = "واژگان بارگذاری نشد. صفحه را با یک سرور محلی باز کنید.";
      }
    }

    const search = $("gilaki-search");
    if (search) {
      let t = null;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.query = search.value;
          state.highlightId = null;
          render();
        }, 120);
      });
    }

    const randomBtn = $("gilaki-random");
    if (randomBtn) randomBtn.addEventListener("click", pickRandom);

    window.addEventListener("hashchange", () => {
      applyHash();
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
