/**
 * WeatherAmbient — live Rasht weather + rain ambient (Web Audio) + CSS rain.
 *
 * This site is static GitHub Pages (no React/Vue build). The component is a
 * vanilla mountable class with the same name/API spirit as a UI component.
 *
 * Usage:
 *   const wa = new WeatherAmbient(document.getElementById("weather-content"), {
 *     panelEl: document.getElementById("weather"),
 *   });
 *   wa.start();
 */

(function (global) {
  "use strict";

  const API_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=37.2808&longitude=49.5832&current_weather=true";

  const WMO_FA = {
    0: "آسمان صاف",
    1: "عمدتاً صاف",
    2: "نیمه‌ابری",
    3: "ابری",
    45: "مه",
    48: "مه یخ‌زده",
    51: "نم‌نم باران ملایم",
    53: "نم‌نم باران",
    55: "نم‌نم باران شدید",
    61: "باران ملایم",
    63: "بارانی",
    65: "باران شدید",
    66: "باران یخ‌زده",
    67: "باران یخ‌زده شدید",
    71: "برف ملایم",
    73: "برفی",
    75: "برف شدید",
    77: "دانه‌های برف",
    80: "رگبار",
    81: "رگبار باران",
    82: "رگبار شدید",
    85: "رگبار برف",
    86: "رگبار برف شدید",
    95: "رعدوبرق",
    96: "رعدوبرق با تگرگ",
    99: "رعدوبرق با تگرگ",
  };

  function isRainyCode(code) {
    const n = Number(code);
    return (
      (n >= 51 && n <= 67) ||
      (n >= 80 && n <= 82) ||
      (n >= 95 && n <= 99)
    );
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Procedural rain / soft bed via Web Audio (no external files). */
  class RainAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sources = [];
      this.playing = false;
      this.volume = 0.28;
    }

    async ensure() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("Web Audio API unsupported");
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, Number(v) || 0));
      if (this.master) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.linearRampToValueAtTime(this.volume, now + 0.08);
      }
    }

    _noiseBuffer(seconds = 2) {
      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buffer = this.ctx.createBuffer(1, len, rate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i += 1) {
        const white = Math.random() * 2 - 1;
        // brown-ish noise for soft rain bed
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
      return buffer;
    }

    async start() {
      await this.ensure();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      if (this.playing) return;
      this.playing = true;

      const buffer = this._noiseBuffer(2.5);

      const makeLayer = (filterFreq, gainVal, detune) => {
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.detune.value = detune;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.7;

        const gain = this.ctx.createGain();
        gain.gain.value = gainVal;

        // gentle amplitude flutter
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.15 + Math.random() * 0.2;
        lfoGain.gain.value = gainVal * 0.18;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start();
        lfo.start();

        this.sources.push(src, lfo);
      };

      makeLayer(900, 0.45, -80);
      makeLayer(1800, 0.28, 40);
      makeLayer(420, 0.22, -160);
    }

    stop() {
      this.sources.forEach((node) => {
        try {
          node.stop();
        } catch (_) {
          /* already stopped */
        }
        try {
          node.disconnect();
        } catch (_) {
          /* noop */
        }
      });
      this.sources = [];
      this.playing = false;
    }

    destroy() {
      this.stop();
      if (this.ctx) {
        this.ctx.close().catch(() => {});
        this.ctx = null;
        this.master = null;
      }
    }
  }

  class WeatherAmbient {
    /**
     * @param {HTMLElement} rootEl — mount target (e.g. #weather-content)
     * @param {{ panelEl?: HTMLElement, apiUrl?: string }} [options]
     */
    constructor(rootEl, options = {}) {
      this.rootEl = rootEl;
      this.panelEl = options.panelEl || rootEl?.closest?.(".weather-panel") || null;
      this.apiUrl = options.apiUrl || API_URL;
      this.audio = new RainAudio();
      this.weather = null;
      this._onToggle = this._onToggle.bind(this);
      this._onVolume = this._onVolume.bind(this);
      this._onVis = this._onVis.bind(this);
    }

    async start() {
      if (!this.rootEl) return;
      this._ensureRainLayer();
      this.rootEl.innerHTML = `<p class="state loading">در حال دریافت آب‌وهوا…</p>`;
      try {
        const res = await fetch(this.apiUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        const json = await res.json();
        const cw = json.current_weather;
        if (!cw) throw new Error("Missing current_weather");
        this.weather = {
          temp: cw.temperature,
          wind: Math.round(cw.windspeed),
          code: cw.weathercode,
          rainy: isRainyCode(cw.weathercode),
          description: WMO_FA[cw.weathercode] || `کد ${cw.weathercode}`,
          time: cw.time,
        };
        this.render();
        this._setRainy(this.weather.rainy);
        document.addEventListener("visibilitychange", this._onVis);
      } catch (err) {
        console.error("WeatherAmbient error:", err);
        this.rootEl.innerHTML =
          `<p class="state error">فعلاً آب‌وهوا در دسترس نیست. لطفاً بعداً دوباره تلاش کنید.</p>`;
        this._setRainy(false);
      }
    }

    _ensureRainLayer() {
      if (!this.panelEl) return;
      if (this.panelEl.querySelector(".weather-rain")) return;
      const rain = document.createElement("div");
      rain.className = "weather-rain";
      rain.setAttribute("aria-hidden", "true");
      rain.innerHTML =
        '<span class="weather-rain-layer"></span><span class="weather-rain-layer weather-rain-layer--soft"></span>';
      this.panelEl.insertBefore(rain, this.panelEl.firstChild);
    }

    _setRainy(on) {
      if (!this.panelEl) return;
      this.panelEl.classList.toggle("is-rainy", Boolean(on));
    }

    render() {
      const w = this.weather;
      if (!w || !this.rootEl) return;
      const hint = w.rainy
        ? "هوا بارانی است — می‌توانید صدای باران را روشن کنید."
        : "صدای امبینت باران را در هر شرایطی می‌توانید پخش کنید.";

      this.rootEl.innerHTML = `
        <div class="weather-grid weather-ambient">
          <div class="weather-main">
            <div class="temp">${Math.round(w.temp)}<span>°C</span></div>
            <div>
              <p class="weather-desc">${escapeHtml(w.description)}</p>
              <p class="weather-place">رشت · Rasht</p>
            </div>
          </div>
          <div class="weather-stats">
            <div class="stat">
              <span class="stat-label">باد</span>
              <span class="stat-value">${w.wind} km/h</span>
            </div>
            <div class="stat">
              <span class="stat-label">وضعیت</span>
              <span class="stat-value">${w.rainy ? "بارانی" : "بدون بارش"}</span>
            </div>
          </div>
          <div class="weather-ambient-controls">
            <button type="button" class="weather-ambient-toggle" id="wa-toggle" aria-pressed="false">
              پخش صدای باران
            </button>
            <label class="weather-ambient-volume">
              <span>صدا</span>
              <input type="range" id="wa-volume" min="0" max="1" step="0.01" value="${this.audio.volume}" />
            </label>
            <p class="weather-ambient-hint">${escapeHtml(hint)}</p>
          </div>
        </div>
      `;

      const toggle = this.rootEl.querySelector("#wa-toggle");
      const volume = this.rootEl.querySelector("#wa-volume");
      if (toggle) toggle.addEventListener("click", this._onToggle);
      if (volume) volume.addEventListener("input", this._onVolume);
    }

    async _onToggle() {
      const toggle = this.rootEl?.querySelector("#wa-toggle");
      try {
        if (this.audio.playing) {
          this.audio.stop();
          if (toggle) {
            toggle.setAttribute("aria-pressed", "false");
            toggle.textContent = "پخش صدای باران";
          }
          return;
        }
        await this.audio.start();
        if (toggle) {
          toggle.setAttribute("aria-pressed", "true");
          toggle.textContent = "قطع صدای باران";
        }
      } catch (err) {
        console.error("Rain audio error:", err);
      }
    }

    _onVolume(event) {
      this.audio.setVolume(event.target.value);
    }

    _onVis() {
      if (document.hidden && this.audio.playing) {
        // pause context to be polite; keep UI as playing
        if (this.audio.ctx && this.audio.ctx.state === "running") {
          this.audio.ctx.suspend().catch(() => {});
        }
      } else if (!document.hidden && this.audio.playing && this.audio.ctx) {
        this.audio.ctx.resume().catch(() => {});
      }
    }

    destroy() {
      document.removeEventListener("visibilitychange", this._onVis);
      this.audio.destroy();
      this._setRainy(false);
    }
  }

  global.WeatherAmbient = WeatherAmbient;
})(typeof window !== "undefined" ? window : globalThis);
