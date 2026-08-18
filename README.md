# Candle Collection Log 🕯️

Catalog every candle you own or have burned through: name & brand, scent notes,
burn status, a 1–5 flame rating, and personal notes.

## Features

- Add, edit, delete candles; status (Unlit / Burning / Finished); 1–5 rating.
- Search; filter by status; sort by name, brand, rating, or recency.
- Summary bar (total, burning, finished); persists via `localStorage`.
- Warm amber palette, soft shadows, flickering glow (respects `prefers-reduced-motion`).

## Architecture

`types.ts` · `schema.ts` · `domain.ts` · `storage.ts` · `render.ts` · `main.ts`.
Pure logic is side-effect free and unit tested; storage returns results instead
of throwing; input is HTML-escaped; loading states cover load/save.

## Development

```bash
npm install
npm run dev     # dev server
npm test        # Vitest unit tests
npm run build   # type-check + production build
```
