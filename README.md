# Candle Collection Log 🕯️

A cozy single-page app to catalog every candle you own or have burned through.
Log the name & brand, scent notes, burn status, a 1–5 flame rating, and personal
notes — then keep it all around across page refreshes via `localStorage`.

## Features

- **Add, edit, and delete** candles freely.
- **Status** per candle: *Unlit*, *Burning*, or *Finished*.
- **1–5 flame rating** with accessible star/rating input.
- **Search** across name, brand, scent notes, and personal notes.
- **Filter** by status and **sort** by name, brand, rating, or recency.
- **Summary bar** showing total logged plus Burning vs. Finished counts.
- **Persistent** storage with validation on load (corrupt records are dropped, never crash the app).
- Warm amber palette, soft shadows, and a flickering-candle glow (with `prefers-reduced-motion` respected).

## Architecture

The codebase is split into focused, importable modules rather than a single
monolithic file:

| Module            | Responsibility                                              |
| ----------------- | ----------------------------------------------------------- |
| `src/types.ts`    | Shared TypeScript types and data-shape contracts            |
| `src/schema.ts`   | Validation, normalization, and id generation                |
| `src/domain.ts`   | Pure logic: filtering, sorting, and statistics              |
| `src/storage.ts`  | All `localStorage` access, with error handling & seeding    |
| `src/render.ts`   | HTML escaping, date formatting, and star rendering          |
| `src/main.ts`     | App state, render pipeline, and event wiring                |
| `src/style.css`   | All visual styling                                          |

**Design principles**

- **Pure domain logic** (`domain.ts`, `schema.ts`) is side-effect free and fully unit tested.
- **Single trust boundary** (`storage.ts`) talks to `localStorage`; every read/write
  returns a result instead of throwing, so failures (quota exceeded, corrupt JSON)
  are surfaced to the user rather than swallowed silently.
- **All user input is HTML-escaped** before interpolation, preventing XSS.
- **Loading states** are shown for the initial load and on every save, so the app
  never assumes storage access is instantaneous.
- **Type safety** via strict TypeScript (`strict`, `noUncheckedIndexedAccess`, etc.).

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # run the unit test suite (Vitest)
npm run typecheck  # strict TypeScript check
npm run build      # type-check + production build
```

## Tests

`tests/` contains unit tests for the schema, domain logic, and storage layer
(28 tests total), covering validation, filtering/sorting, statistics, and the
error paths (corrupt data, quota/security failures).
