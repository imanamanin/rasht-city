# GodBox — میدان شهرداری رشت (3D)

Persian / English · Static Three.js experience for GitHub Pages

تجربهٔ سه‌بعدی اول‌شخص از **پیاده‌راه فرهنگی / میدان شهرداری رشت** با برج ساعت و کاخ شهرداری.

A self-contained first-person 3D walkthrough of Rasht Municipality Square. No build step, no backend, no npm.

## Open locally

```bash
npx serve .
```

Then visit `/godbox/` (or open `godbox/index.html` via a local static server — ES modules need HTTP).

## Controls

| Key | Action |
|-----|--------|
| Click | Lock pointer / start |
| WASD | Move |
| Mouse | Look |
| Space | Jump |
| Shift | Run |
| N | Day / night |
| C | First / third person |
| R | Reset position |
| Esc | Unlock pointer |

## Stack

- Three.js `r160` via import map (unpkg)
- Vanilla ES modules
- Procedural geometry only (no model files, no external image fetches)

## Deploy (GitHub Pages)

This folder lives inside the `rasht-city` site as `/godbox/`.

For a **standalone** deploy on custom domain **godbox.ir**:

1. Publish the contents of `godbox/` as the Pages root (or keep as subpath).
2. Add a `CNAME` file containing:

```
godbox.ir
```

3. Point DNS A/CNAME records to GitHub Pages as usual.

Main portal: [rasht.city](../) — link “ورود به میدان سه‌بعدی” opens this experience.
