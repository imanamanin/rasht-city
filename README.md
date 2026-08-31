# rasht.city

Dynamic single-page city portal for **Rasht & Gilan** — weather, prayer times, events, and photo backgrounds. Pure frontend for **GitHub Pages** (no build step, no backend).

## Structure

```
rasht-city/
├── index.html
├── mafakher/                 # مفاخر گیلان (memorial pages)
├── scripts/fetch-gilan-figure.mjs
├── assets/data/gilan-figures.json
├── assets/data/gilan-figures-log.json
└── .github/workflows/gilan-figure.yml
```

## مفاخر گیلان

Periodic memorial posts for people **born in Gilan**, sourced from **Wikidata + Persian Wikipedia API** (no HTML scraping).

```bash
node scripts/fetch-gilan-figure.mjs
# optional: --dry-run
```

- Validates birth place via Wikidata `P19` under Gilan province `Q928828`
- Skips duplicates already in `gilan-figures.json`
- Writes an independent memorial text (not a verbatim Wikipedia copy) + source link
- Logs success/failure to `gilan-figures-log.json` (see `/mafakher/log.html`)
- GitHub Action runs weekly and commits when a new figure is published

## Features

| Section | Source |
|--------|--------|
| آب‌وهوای رشت | [Open-Meteo](https://open-meteo.com/) (default, **no API key**) |
| اوقات شرعی رشت | [Aladhan](https://aladhan.com/prayer-times-api) method 7 (Tehran University) |
| رویدادها | `assets/data/events.json` |
| ساعت و تقویم ایران | Jalali utility + live clock (`assets/js/calendar.js`) |
| میدان شهرداری ۳بعدی | MapLibre + OpenFreeMap (`/#city3d` و `/shahrdari/`) — اکستروژن ساختمان، POI، چرخش خودکار |
| نقشه رشت | [Leaflet](https://leafletjs.com/) + تایل مینیمال [CARTO](https://carto.com/attributions) + مسیریابی پیاده OSRM (**بدون کلید API**) |
| خط زمان تاریخ | React + [Framer Motion](https://www.framer.com/motion/) — باندل از `timeline-app/` در `assets/timeline/` |
| Hero / section photos | Unsplash API (optional key) + curated fallbacks |

## API keys (optional)

Open `assets/js/main.js` and edit the config block at the top:

```js
const UNSPLASH_ACCESS_KEY = "";      // https://unsplash.com/developers
const OPENWEATHER_API_KEY = "";      // only if you switch provider
const WEATHER_PROVIDER = "open-meteo"; // or "openweathermap"
```

- **Weather works without any key** via Open-Meteo.
- **Prayer times work without any key** via Aladhan.
- **Images work without a key** using fallback Unsplash URLs; add `UNSPLASH_ACCESS_KEY` for live search (`Rasht`, `Gilan`, etc.).

## Local preview

`events.json` needs HTTP (not `file://`):

```bash
npx serve .
```

Then open the printed local URL.

## GitHub Pages

```bash
git add .
git commit -m "Dynamic rasht.city portal"
gh repo create rasht-city --public --source=. --remote=origin --push
```

Then: **Settings → Pages → Deploy from branch → `main` / root**.

### Custom domain `rasht.city`

DNS A records to GitHub Pages IPs + `CNAME` file (already set to `rasht.city`). See GitHub docs for custom domains.

## Extending events

Edit `assets/data/events.json`:

```json
{
  "title": "...",
  "date": "YYYY-MM-DD",
  "location": "...",
  "type": "festival|exhibition|nature|culture|market",
  "description": "..."
}
```
