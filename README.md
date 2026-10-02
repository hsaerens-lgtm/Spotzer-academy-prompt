# Athena Prompt Academy

Internal, PC-only training site to learn prompting. A 3D office (three.js, React Three Fiber) where Ada, a robot assistant, explains the basics of generative AI while a wall screen shows diagrams. The laptop leads to the prompt workshop and the retro console to the dungeon (both coming in later sub-projects).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — best on Chrome or Edge, window at least 1280 × 720.

Requires Node.js `^22.22.2` or `^24.15.0` (jsdom 30, used by the unit tests, needs it).

## Check

```bash
npm run check
```

Runs the type check, the unit and content tests, the production build and the bundle budget (initial JS ≤ 1.5 MB gzip).

The first end-to-end run needs the browser: `npx playwright install chromium`.

```bash
npm run e2e
```

Runs the Playwright journeys against the dev server and refreshes the screenshots in `docs/evidence/office/`.

## Edit the content

- Topics: `content/en/topics/<id>.json` — each line Ada says (`say`) is 220 characters max; `screen` points to a visual step (`<visual>:<step>`).
- Topic order and chapters: `content/en/chapters.json`.
- Interface text: `content/en/ui.json`; wall-screen text: `content/en/visuals.json`.
- `npm run test` validates every file and points to the exact problem.

## Add a language

Copy `content/en/` to `content/<code>/` and translate. The tests fail until every key and topic exists in the new language; the language then appears in the selector.

## Tune the 3D layout

Open http://localhost:5173/?tune (development only). Pick an object, drag it, edit the camera rail, then "copy layout" and paste the values into `src/zones/office/layout.ts`.

## Replace a procedural object with a 3D model

Put the file in `public/models/` and declare it in `glbModels` (`src/three/objects.tsx`) with `publicUrl('models/<file>.glb')` from `src/core/publicUrl.ts`, for example `{ sofa: publicUrl('models/sofa.glb') }`. Never write a URL under `public/` with a leading `/`: the site must keep working when it is served from a subfolder. The model must share the procedural object's origin (floor level, centred), orientation (front = +z) and scale (metres).

## Project docs

- Spec: `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`
- Plan: `docs/superpowers/plans/2026-09-29-athena-prompt-academy-office.md`
