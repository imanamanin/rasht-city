/**
 * گیله خوراک — 3-step quiz + roulette for authentic Gilan dishes.
 */
(function (global) {
  "use strict";

  const DATA_URL = "assets/data/gileh-khorak.json";
  const WHEEL_COLORS = [
    "#1a3d32",
    "#234a3d",
    "#2d5a48",
    "#1f4638",
    "#2a5242",
    "#18352c",
    "#265544",
    "#314f42",
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scoreDish(dish, answers) {
    let score = 0;
    if (dish.meals?.includes(answers.meal)) score += 3;
    if (dish.moods?.includes(answers.mood)) score += 3;
    if (dish.styles?.includes(answers.style)) score += 3;
    // soft bonuses for related tags
    if (answers.mood === "sour" && dish.ingredients?.some((i) => /انار|غوره|ترش/.test(i))) score += 1;
    if (answers.mood === "herby" && dish.ingredients?.some((i) => /چوچاق|سبزی|شوید|سیر/.test(i))) score += 1;
    if (answers.style === "seafood" && dish.styles?.includes("seafood")) score += 1;
    return score;
  }

  function pickCandidates(dishes, answers, count = 6) {
    const ranked = dishes
      .map((d) => ({ dish: d, score: scoreDish(d, answers) }))
      .sort((a, b) => b.score - a.score || Math.random() - 0.5);

    const positive = ranked.filter((r) => r.score > 0).map((r) => r.dish);
    const pool = positive.length >= 3 ? positive : ranked.map((r) => r.dish);
    const unique = [];
    for (const d of pool) {
      if (unique.length >= count) break;
      if (!unique.find((u) => u.id === d.id)) unique.push(d);
    }
    // ensure wheel has enough slices
    while (unique.length < Math.min(4, dishes.length)) {
      const extra = dishes[Math.floor(Math.random() * dishes.length)];
      if (!unique.find((u) => u.id === extra.id)) unique.push(extra);
    }
    return unique;
  }

  class GilehKhorak {
    constructor(rootEl) {
      this.rootEl = rootEl;
      this.data = null;
      this.stepIndex = 0;
      this.answers = {};
      this.candidates = [];
      this.winner = null;
      this.spinning = false;
    }

    async start() {
      if (!this.rootEl) return;
      this.rootEl.innerHTML = `<p class="state loading">در حال آماده‌سازی گیله خوراک…</p>`;
      try {
        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.data = await res.json();
        if (!this.data?.steps?.length || !this.data?.dishes?.length) {
          throw new Error("Invalid gileh-khorak data");
        }
        this.renderQuiz();
      } catch (err) {
        console.error("GilehKhorak error:", err);
        this.rootEl.innerHTML =
          `<p class="state error">گیله خوراک بارگذاری نشد. برای پیش‌نمایش محلی از یک سرور ساده استفاده کنید.</p>`;
      }
    }

    renderQuiz() {
      const step = this.data.steps[this.stepIndex];
      const progress = this.data.steps
        .map((_, i) => {
          const cls =
            i < this.stepIndex ? "is-done" : i === this.stepIndex ? "is-current" : "";
          return `<span class="gk-step-dot ${cls}" aria-hidden="true"></span>`;
        })
        .join("");

      this.rootEl.innerHTML = `
        <div class="gk-quiz" role="group" aria-labelledby="gk-step-title">
          <div class="gk-progress" aria-label="مرحله ${this.stepIndex + 1} از ${this.data.steps.length}">
            ${progress}
            <span class="gk-progress-label">مرحله ${this.stepIndex + 1} از ${this.data.steps.length}</span>
          </div>
          <h3 class="gk-step-title" id="gk-step-title">${escapeHtml(step.title)}</h3>
          <div class="gk-options">
            ${step.options
              .map(
                (opt) => `
              <button type="button" class="gk-option" data-step="${escapeHtml(step.id)}" data-value="${escapeHtml(opt.id)}">
                <span class="gk-option-label">${escapeHtml(opt.label)}</span>
                <span class="gk-option-hint">${escapeHtml(opt.hint || "")}</span>
              </button>`
              )
              .join("")}
          </div>
        </div>
      `;

      this.rootEl.querySelectorAll(".gk-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.answers[btn.getAttribute("data-step")] = btn.getAttribute("data-value");
          if (this.stepIndex < this.data.steps.length - 1) {
            this.stepIndex += 1;
            this.renderQuiz();
          } else {
            this.beginRoulette();
          }
        });
      });
    }

    beginRoulette() {
      this.candidates = pickCandidates(this.data.dishes, this.answers, 6);
      // winner = best scored among candidates (with tiny randomness among top)
      const scored = this.candidates
        .map((d) => ({ d, s: scoreDish(d, this.answers) + Math.random() * 0.4 }))
        .sort((a, b) => b.s - a.s);
      this.winner = scored[0].d;
      this.renderRoulette();
      // auto-spin shortly after paint
      requestAnimationFrame(() => {
        setTimeout(() => this.spin(), 350);
      });
    }

    renderRoulette() {
      const n = this.candidates.length;
      const seg = 360 / n;
      const gradient = this.candidates
        .map((_, i) => {
          const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
          return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
        })
        .join(", ");

      const labels = this.candidates
        .map((d, i) => {
          const angle = i * seg + seg / 2;
          return `
            <span class="gk-wheel-label" style="--gk-angle:${angle}deg">
              <span>${escapeHtml(d.name)}</span>
            </span>`;
        })
        .join("");

      this.rootEl.innerHTML = `
        <div class="gk-roulette" aria-live="polite">
          <p class="gk-roulette-caption">گردونهٔ گیله خوراک می‌چرخد…</p>
          <div class="gk-wheel-wrap">
            <div class="gk-wheel-pointer" aria-hidden="true"></div>
            <div class="gk-wheel" id="gk-wheel" style="background: conic-gradient(from -90deg, ${gradient})">
              ${labels}
            </div>
          </div>
          <p class="gk-roulette-note">بر اساس وعده، طعم و سبک انتخابی شما</p>
        </div>
      `;
    }

    spin() {
      if (this.spinning || !this.winner) return;
      const wheel = this.rootEl.querySelector("#gk-wheel");
      if (!wheel) return;

      const reduceMotion =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        this.renderResult();
        return;
      }

      this.spinning = true;

      const n = this.candidates.length;
      const seg = 360 / n;
      const index = this.candidates.findIndex((d) => d.id === this.winner.id);
      // pointer at top; conic starts at -90deg so index 0 center is at top when rotation=0
      const targetCenter = index * seg + seg / 2;
      const spins = 4 + Math.floor(Math.random() * 2);
      // rotate so targetCenter lands under pointer (top)
      const finalDeg = spins * 360 + (360 - targetCenter);

      wheel.style.transition = "none";
      wheel.style.transform = "rotate(0deg)";
      void wheel.offsetWidth;
      wheel.style.transition = "transform 4.2s cubic-bezier(0.12, 0.75, 0.08, 1)";
      wheel.style.transform = `rotate(${finalDeg}deg)`;

      const onEnd = () => {
        wheel.removeEventListener("transitionend", onEnd);
        this.spinning = false;
        this.renderResult();
      };
      wheel.addEventListener("transitionend", onEnd);
      // fallback if transitionend missed
      setTimeout(() => {
        if (this.spinning) onEnd();
      }, 4800);
    }

    renderResult() {
      const d = this.winner;
      if (!d) return;

      const tags = (d.ingredients || [])
        .map((ing) => `<span class="gk-tag">${escapeHtml(ing)}</span>`)
        .join("");
      const markets = (d.markets || [])
        .map((m) => `<li>${escapeHtml(m)}</li>`)
        .join("");

      this.rootEl.innerHTML = `
        <div class="gk-result">
          <p class="gk-result-kicker">پیشنهاد گیله خوراک</p>
          <h3 class="gk-result-name">${escapeHtml(d.name)}</h3>
          <p class="gk-result-blurb">${escapeHtml(d.blurb || "")}</p>

          <div class="gk-block">
            <h4>مواد تشکیل‌دهنده</h4>
            <div class="gk-tags">${tags}</div>
          </div>

          <div class="gk-block">
            <h4>بهترین راسته‌های بازار رشت</h4>
            <ul class="gk-markets">${markets}</ul>
            <p class="gk-markets-note">بازار بزرگ رشت و راسته‌های اطراف میدان شهرداری معمولاً تازه‌ترین مواد محلی را دارند.</p>
          </div>

          <button type="button" class="gk-again" id="gk-again">دوباره بچرخان</button>
        </div>
      `;

      const again = this.rootEl.querySelector("#gk-again");
      if (again) {
        again.addEventListener("click", () => {
          this.stepIndex = 0;
          this.answers = {};
          this.winner = null;
          this.candidates = [];
          this.renderQuiz();
        });
      }
    }
  }

  async function initGilehKhorak() {
    const root = document.getElementById("gileh-khorak-root");
    if (!root) return;
    const app = new GilehKhorak(root);
    await app.start();
  }

  global.GilehKhorak = GilehKhorak;
  global.initGilehKhorak = initGilehKhorak;
})(typeof window !== "undefined" ? window : globalThis);
