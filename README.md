# Athena Prompt Academy

Internal, PC-only training site to learn prompting. A 3D office (three.js, React Three Fiber), a glazed agency meeting room over a 3D city lit for day, sunset or night, where Ada, a robot assistant, explains the basics of generative AI while a wall screen shows diagrams. The laptop leads to the prompt workshop and the retro console to the dungeon (coming in a later sub-project).

## Run

```bash
npm install
npm run dev
```

Requires Node.js `^22.22.2` or `^24.15.0` (jsdom 30, used by the unit tests, needs it).

## The prompt workshop

The laptop in the office opens a retro desktop where you build prompts as blocks (role, task, context, format, plus example and constraint). Each block gets a material — stone, wood, cardboard or a hole — and a 3D physics building shows whether the prompt holds when the AI puts its weight on it. Six missions are simulated and work offline. Edit them in `content/en/workshop/missions/*.json`; `npm run test` checks every sample prompt and the building it produces.

### The corrector (real AI)

The CORRECTOR program sends any prompt to OpenAI through a small server that keeps the key. To turn it on:

1. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` (never commit `.env.local`).
2. Development: `npm run dev` (or `start.bat`) starts the site and the server together.
3. Production: `npm run build`, then `npm start` serves the site **and** `/api` on port 8787 (`PORT` to change it).

Without a key, the corrector shows as offline and everything else works. Limits per user and per day, the model and the answer length are set in `.env.local` (see `.env.example`). The server never logs prompt content; `npm run budget` fails if the key or OpenAI's address ever reaches the built site.

## Check

```bash
npm run check
```

Runs the type check, the unit and content tests, the production build and the bundle budget (initial JS ≤ 1.5 MB gzip). It also fails if the test API or any OpenAI detail reaches the production files.

The first end-to-end run needs the browser: `npx playwright install chromium`.

```bash
npm run e2e
```

Runs the Playwright journeys against the dev server and refreshes the screenshots in `docs/evidence/office/` and `docs/evidence/workshop/`. The corrector's server answers are simulated there: the journeys never call OpenAI.

## Edit the content

- Topics: `content/en/topics/<id>.json` — each line Ada says (`say`) is 220 characters max; `screen` points to a visual step (`<visual>:<step>`).
- Topic order and chapters: `content/en/chapters.json`.
- Interface text: `content/en/ui.json`; wall-screen text: `content/en/visuals.json`.
- `npm run test` validates every file and points to the exact problem.

## Add a language

Copy `content/en/` to `content/<code>/` and translate. The tests fail until every key and topic exists in the new language; the language then appears in the selector.

## Time of day

The office opens in the phase of the local time: day from 07:00 to 17:59, sunset from 18:00 to 20:59, night from 21:00 to 06:59. Click the wall clock, or use the "Time of day" button in the top bar (it works from the keyboard), to move to the next phase: the lights, the sky and the city change over 2.5 s, at once with reduced motion. To force a phase, put `?phase=day`, `?phase=sunset` or `?phase=night` before the hash, for example http://localhost:5173/?phase=night#/office. The parameter is read once at start-up and never written back.

## Tune the 3D layout

Open http://localhost:5173/?tune (development only). Pick an object, drag it, edit the camera rail, then "copy layout" and paste the values into `src/zones/office/layout.ts`. Tunable objects: Ada, the wall screen, the table, the sideboard, the lamp, the laptop, the TV stand, the TV, the retro console, the sofa, the floor lamp, the logo, the wall clock, the drawer cabinet, the coffee table and the shelves. Plants, vases and books are placed in `layout.objects` (`plants`, `hangingPlants`, `largePlants`, `vases`, `shelfBooks`).

`npm run test` checks the result: the overview keeps the retro corner, the laptop and its share of glazing, nothing stands between the overview camera and the laptop, and every generated plant stays inside its footprint (`src/zones/office/footprints.ts`).

## 3D assets (CC0 and CC BY)

Every texture and most models come from Poly Haven or ambientCG (CC0). A few models are CC BY 4.0, downloaded by hand from Sketchfab (an account is needed) or Khronos's glTF Sample Assets: their author is credited in `public/assets/CREDITS.md` and in the site (reading mode, `credits.models` in `content/en/ui.json`, checked by `npm run test`). Everything is served by the site from `public/assets/`: nothing is fetched from a CDN at run time. `scripts/assets/manifest.json` lists each asset: id, source, API URL, licence, texture size (`resolution` for a texture, `textureSize` for a model), use and loading stage (`base` for the first image, `decor` after it).

```bash
npm run assets:fetch   # downloads the listed CC0 sources into assets-src/ (ignored by git), checking sizes and checksums
npm run assets:import -- --id <id> --file <download>   # unpacks a CC BY model downloaded by hand (.zip or .glb)
npm run assets:build   # WebP textures, meshopt-compressed GLB models, public/assets/CREDITS.md, budget check
```

`assets:fetch` accepts `-- --only <id>[,<id>]` and `assets:build` accepts `-- --only <id>`. A CC BY model's manifest entry names its `title` and `author`, and its `api` is its page (it is never fetched). The build drops the lights a model brings and keeps only the default of its colour variants. The prepared files and `public/assets/CREDITS.md` are committed, so the site builds without the network. `npm run test` checks that every file is listed in `CREDITS.md` with its licence (and its author when CC BY) and its exact size, and the budgets: `public/assets` at most 18 MiB, files needed for the first image at most 6 MiB, no file of 3 MiB or more.

## Replace a procedural object with a 3D model

1. Add the model to `scripts/assets/manifest.json` (its Poly Haven `sourceId`, `textureSize` and `stage`), then run `npm run assets:fetch -- --only <id>` and `npm run assets:build`.
2. Give it a `ModelId` in `MODELS` (`src/three/assets.ts`).
3. Declare it in `glbModels` (`src/three/objects.tsx`) with `modelUrl('<ModelId>')`, for example `{ sofa: modelUrl('sofa') }`. `modelUrl` goes through `publicUrl()`: never write a URL under `public/` with a leading `/`, the site must keep working when it is served from a subfolder.

The registry loads the model with `useGLTF(url, false, true)` (no Draco decoder, meshopt built in), stands it on the floor, centred, turns its shadows on and marks its `_glass` materials as glass. The model's front is +z and its unit the metre; the `height` prop scales it and `outline` adds the hover outline. A decor model goes inside an `AssetBoundary` in `src/zones/office/decor/Decor.tsx`, so that a missing file only leaves that object out.

## Evidence and performance

```bash
node scripts/shots.mjs --out docs/evidence/office --prefix phase- --phases day,sunset,night --wait-decor
npm run build
npm run perf -- --out docs/evidence/office/perf.md
```

The first command saves the overview and the presentation view in each phase (Chromium in a real window on the GPU, 1600 x 900). The last two measure the production build in each phase (frames per second, office shown, decor loaded, quality tier) and write `docs/evidence/office/perf.md`. Both open browser windows: leave the machine alone while they run. `shots.mjs` uses the dev server on port 5199 (set `E2E_PORT` to change it, as for `npm run e2e`) and `perf.mjs` serves `dist/` with `vite preview` on port 4173; each starts its server when nothing answers there and stops it at the end.

The six `phase-*.png` screenshots are the look evidence: rendered on the GPU, with the whole decor loaded. The numbered screenshots (`01-overview.png` to `14-small-reading.png`) come from `npm run e2e`, which renders with Chromium's software rasterizer (SwiftShader): there the office runs on the `low` tier at a pixel ratio of 0.35 (`SOFTWARE_DPR`), and it leaves out the park across the street, the sideboard's two cabinets, its lamp and the vase on it, so that the journeys stay within their time limits. In the presentation views (`02-presentation.png`, `12-small-presentation.png`), thin orange lines from the slat wall cross the wall-screen picture: a depth artefact of the software rasterizer at that pixel ratio, absent from the GPU screenshots.

## Hosting the built site

`npm run build` writes a static site in `dist/` that works from any folder; every file is served from the same origin, with no CDN.
- Vite's bundles in `dist/assets/` have a content hash in their name. The 3D files in `dist/assets/textures/` and `dist/assets/models/` do not. A "cache `/assets/*` forever" rule would keep old models after an asset update, so cache those two folders for a short time, or revalidate them.
- A machine without a usable GPU (remote desktop, a blocklisted browser) gets the same software-rendering treatment as the e2e screenshots: the `low` tier, without the park and the sideboard set.
- If a Content Security Policy is ever added, the meshopt decoder needs `'wasm-unsafe-eval'` in `script-src`, and textures embedded in a model need `blob:` in `img-src`.

## Project docs

- Spec: `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`
- Plan: `docs/superpowers/plans/2026-09-29-athena-prompt-academy-office.md`
- Workshop spec: `docs/superpowers/specs/2026-10-06-athena-prompt-academy-workshop-design.md`
- Workshop plan: `docs/superpowers/plans/2026-10-06-athena-prompt-academy-workshop.md`
- Office redesign spec: `docs/superpowers/specs/2026-10-06-athena-prompt-academy-office-redesign-design.md`
- Office redesign plan: `docs/superpowers/plans/2026-10-06-athena-prompt-academy-office-redesign.md`
- Measurements: `docs/evidence/office/perf.md`, `docs/evidence/workshop/perf.md`
