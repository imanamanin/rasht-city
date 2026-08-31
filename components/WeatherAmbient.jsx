/**
 * React reference implementation of WeatherAmbient.
 * The live GitHub Pages site uses assets/js/WeatherAmbient.js (vanilla).
 * Use this file if you mount the portal inside a React app.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=37.2808&longitude=49.5832&current_weather=true";

const WMO_FA = {
  0: "آسمان صاف",
  1: "عمدتاً صاف",
  2: "نیمه‌ابری",
  3: "ابری",
  51: "نم‌نم باران ملایم",
  53: "نم‌نم باران",
  61: "باران ملایم",
  63: "بارانی",
  65: "باران شدید",
  80: "رگبار",
  81: "رگبار باران",
  82: "رگبار شدید",
  95: "رعدوبرق",
};

function isRainyCode(code) {
  const n = Number(code);
  return (n >= 51 && n <= 67) || (n >= 80 && n <= 82) || (n >= 95 && n <= 99);
}

function useRainAudio(volume) {
  const audioRef = useRef(null);

  const ensure = useCallback(async () => {
    if (audioRef.current?.ctx) return audioRef.current;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    audioRef.current = { ctx, master, sources: [], playing: false };
    return audioRef.current;
  }, [volume]);

  useEffect(() => {
    const a = audioRef.current;
    if (a?.master) a.master.gain.value = volume;
  }, [volume]);

  const start = useCallback(async () => {
    const a = await ensure();
    if (a.ctx.state === "suspended") await a.ctx.resume();
    if (a.playing) return;
    const rate = a.ctx.sampleRate;
    const buffer = a.ctx.createBuffer(1, rate * 2, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = a.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    const gain = a.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(a.master);
    src.start();
    a.sources = [src];
    a.playing = true;
  }, [ensure]);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    });
    a.sources = [];
    a.playing = false;
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, playingRef: audioRef };
}

export default function WeatherAmbient({ className = "" }) {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.28);
  const rain = useRainAudio(volume);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const cw = json.current_weather;
        if (!cw) throw new Error("Missing current_weather");
        if (cancelled) return;
        setWeather({
          temp: cw.temperature,
          wind: Math.round(cw.windspeed),
          code: cw.weathercode,
          rainy: isRainyCode(cw.weathercode),
          description: WMO_FA[cw.weathercode] || `کد ${cw.weathercode}`,
        });
      } catch (err) {
        if (!cancelled) setError(String(err.message || err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = async () => {
    if (playing) {
      rain.stop();
      setPlaying(false);
      return;
    }
    await rain.start();
    setPlaying(true);
  };

  if (error) return <p className="state error">{error}</p>;
  if (!weather) return <p className="state loading">در حال دریافت آب‌وهوا…</p>;

  return (
    <div className={`weather-ambient ${weather.rainy ? "is-rainy" : ""} ${className}`.trim()}>
      {weather.rainy ? (
        <div className="weather-rain" aria-hidden="true">
          <span className="weather-rain-layer" />
          <span className="weather-rain-layer weather-rain-layer--soft" />
        </div>
      ) : null}
      <div className="weather-main">
        <div className="temp">
          {Math.round(weather.temp)}
          <span>°C</span>
        </div>
        <div>
          <p className="weather-desc">{weather.description}</p>
          <p className="weather-place">رشت · Rasht</p>
        </div>
      </div>
      <div className="weather-ambient-controls">
        <button type="button" className="weather-ambient-toggle" aria-pressed={playing} onClick={onToggle}>
          {playing ? "قطع صدای باران" : "پخش صدای باران"}
        </button>
        <label className="weather-ambient-volume">
          <span>صدا</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
