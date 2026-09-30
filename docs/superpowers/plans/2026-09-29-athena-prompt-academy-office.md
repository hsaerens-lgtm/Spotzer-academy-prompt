# Athena Prompt Academy — Plan 1 : socle et bureau

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le socle technique d'Athena Prompt Academy et la zone « bureau » : une salle 3D avec Ada, le robot, qui explique 13 sujets d'IA, un écran mural qui affiche les schémas, et les points d'entrée vers l'atelier et le donjon.

**Architecture:** Application React 19 d'une seule page, avec un unique `<Canvas>` React Three Fiber toujours monté. Un store zustand (vanilla + hook) porte la zone active, les transitions, le rail de caméra, le dialogue et la progression ; la logique métier (dialogue, progression, routage, validation du contenu) est en TypeScript pur, testée avec Vitest. Tout le texte vit dans `content/<lang>/` (i18next + JSON validés par zod) ; la 3D est entièrement procédurale, derrière un registre d'objets qui accepte des fichiers GLB plus tard.

**Tech Stack:** React 19.3 · three 0.186 · @react-three/fiber 9.8 · @react-three/drei 10.7 · maath 0.10 · zustand 5 · i18next 26 / react-i18next 17 · zod 4 · gpt-tokenizer 4 · leva 0.10 · Vite 8 · TypeScript 7.0 · Vitest 5 · Testing Library 16 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`

## Global Constraints

- Plateforme : PC uniquement, Chrome/Edge récents, écran ≥ 1280 × 720 (en dessous : message « This experience works best on a larger screen. », le site reste utilisable).
- Versions exactes, installées avec `--save-exact` : react 19.3.0, react-dom 19.3.0, three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, maath 0.10.8, zustand 5.0.15, i18next 26.4.2, react-i18next 17.0.15, zod 4.6.5, gpt-tokenizer 4.0.0, @fontsource/montserrat 5.3.0, @fontsource/playfair-display 5.3.0 ; dev : vite 8.3.1, @vitejs/plugin-react 6.1.1, typescript 7.0.2, vitest 5.0.2, jsdom 30.1.1, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, @testing-library/user-event 14.6.7, @types/three 0.186.0, @types/react 19.3.0, @types/react-dom 19.3.0, @playwright/test 1.63.0, leva 0.10.1.
- `@react-three/postprocessing` n'est **pas** installé dans ce plan.
- `package.json` a `"type": "module"`. TypeScript 7.0.2 (vérifié compatible le 2026-09-29) ; ne repasser en 5.9 que si `npm run typecheck` échoue pour une raison propre à TS 7.
- Aucun backend, aucun appel réseau à l'exécution (polices auto-hébergées via @fontsource, pas de Google Fonts).
- Stockage : clés `localStorage` exactes `athena-prompt-academy:v1` (progression) et `athena-prompt-academy:settings` (réglages) ; toute lecture/écriture dans un `try/catch`.
- Aucune chaîne visible écrite en dur dans les composants : tout passe par `t('…')` (fichiers `content/<lang>/ui.json` et `visuals.json`) ou par les fichiers de sujets. Seules exceptions : la phrase d'exemple de la démo Tokens et ses tokens pré-calculés (anglais, propres au tokenizer).
- Charte : couleurs uniquement via `src/core/brand.ts` ou les variables CSS de `src/brand/` ; le lime (`#58FC73`) signale l'action ou le « bon » ; **une seule ligne Playfair italique (`.at-script`) par écran** ; boutons en pilule (`.at-btn`) ; aucun emoji ; pas de glassmorphism ni de `backdrop-filter`. Sur fond sombre, les carrés noirs du logo sont rendus en `currentColor` (= `--at-on-dark`).
- Contenu : chaque réplique `say` ≤ 220 caractères ; tiret demi-cadratin « – » pour les incises ; tutoiement (« you ») ; aucun emoji.
- Les 13 sujets, dans cet ordre : `what-is-ai`, `generative-ai`, `llm`, `tokens`, `context-window`, `hallucinations`, `prompt`, `multimodal`, `agents`, `tools`, `skills`, `mcp`, `ai-safety-at-work`.
- Budget : JavaScript initial ≤ 1,5 Mo compressé gzip (`npm run budget`).
- `prefers-reduced-motion` : vols de caméra remplacés par des fondus, texte affiché d'un coup, parallaxe et gestes amples désactivés.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Shell : Git Bash sous Windows (syntaxe POSIX). Tous les chemins sont relatifs à la racine du dépôt `C:\Users\Horn S\Desktop\AI prox max turbo tuto 300000`.

## Review Focus

1. **Stockage du navigateur bloqué ou qui lève une exception** (fenêtre privée, politique d'entreprise, quota plein) : le site se charge et fonctionne, la progression n'est simplement pas conservée. → test dans la Tâche 4.
2. **Double clic, ou clic sur un second objet pendant un vol de caméra ou un fondu** : ignoré, aucun double changement de zone, aucun état bloqué. → test dans la Tâche 7.
3. **Espace/Entrée pressé alors que le focus est sur un bouton (ligne de dialogue, choix) ou dans la zone de texte de la démo Tokens** : exactement une action, aucune réplique sautée, pas d'avance du dialogue pendant la saisie. → tests dans les Tâches 9 et 12.
4. **URL modifiée à la main ou obsolète** (`#/office?topic=inconnu`, `#/inconnu`, bouton « précédent » pendant une transition) : arrivée sur la vue d'ensemble du bureau, jamais de plantage ni de boucle. → tests dans la Tâche 7.
5. **Très long texte collé dans la démo Tokens** : saisie plafonnée à 2 000 caractères, l'interface reste réactive. → test dans la Tâche 12.

---

## Structure des fichiers

```
package.json · tsconfig.json · vite.config.ts · playwright.config.ts · index.html · README.md
scripts/check-bundle.mjs                 budget du JS initial (gzip)
public/favicon.svg
content/en/ui.json                       chaînes d'interface (namespace i18n "ui")
content/en/visuals.json                  chaînes des visuels de l'écran (namespace "visuals")
content/en/chapters.json                 chapitres + ordre des sujets
content/en/topics/<id>.json              un fichier par sujet (13)
src/main.tsx                             démarrage : i18n, WebGL, routeur, son, rendu
src/fonts.ts                             imports @fontsource
src/brand/oe-tokens.css · athena.css · logo-mark.svg   (copiés depuis la charte)
src/styles/app.css                       base : calques, focus, sr-only, fader, loading
src/core/brand.ts                        couleurs de la charte pour la 3D
src/core/i18n.ts                         i18next, langues, clés manquantes
src/core/progress.ts                     progression + réglages (localStorage sûr)
src/core/store.ts                        store zustand (zones, transitions, rail, dialogue…)
src/core/router.ts                       hash d'URL ↔ zone / sujet
src/core/selectors.ts                    hooks : contenu, sujet actif, réplique, écran
src/core/sound.ts                        bips d'Ada + ambiance (Web Audio)
src/core/dom.ts                          isEditable / isButtonLike (gestion clavier)
src/content/schema.ts                    schémas zod, humeurs, gestes, parseScreenRef
src/content/load.ts                      chargement + construction du contenu par langue
src/content/validate.ts                  validations croisées (visuels, next, 1re réplique)
src/dialogue/engine.ts                   moteur de dialogue (TS pur)
src/visuals/manifest.ts                  id de visuel → nombre d'étapes
src/visuals/registry.ts                  id de visuel → composant
src/visuals/parts.tsx                    VisualShell, on()
src/visuals/ScreenContent.tsx            contenu 1280×720 de l'écran (idle ou visuel)
src/visuals/FitScreen.tsx                mise à l'échelle 1280×720 dans un conteneur
src/visuals/TokensDemo.tsx               démo interactive Tokens
src/visuals/visuals.css
src/visuals/topics/<Visual>.tsx          13 visuels
src/ui/Button.tsx · Logo.tsx · Icons.tsx · Hud.tsx · SmallScreenNotice.tsx
src/ui/WelcomeBar.tsx · TopicMenu.tsx · DialogueBox.tsx · useTypewriter.ts
src/ui/ComingSoon.tsx · ExpandOverlay.tsx · overlay.css
src/app/App.tsx · Stage.tsx · zones.ts · ZoneOverlayHost.tsx · ErrorBoundary.tsx
src/app/Fader.tsx · LoadingScreen.tsx · SceneReadySignal.tsx · webgl.ts · ReadingMode.tsx · reading.css
src/app/quality.ts                       niveaux de qualité (PerformanceMonitor)
src/app/testApi.ts · TestApiBridge.tsx   (développement uniquement)
src/three/types.ts                       ObjectProps
src/three/materials.ts                   matériaux partagés
src/three/logo.ts                        le logo aux 5 carrés en boîtes 3D
src/three/objects.tsx                    registre procédural ↔ GLB
src/three/interactive.tsx                survol / clic / contour / étiquette
src/three/props/*.tsx                    mobilier procédural
src/three/robot/{geometry,face,motion}.ts · Ada.tsx
src/zones/office/index.ts · OfficeScene.tsx · OfficeOverlay.tsx · layout.ts
src/zones/office/Room.tsx · Lights.tsx · WallScreen3D.tsx · CrtScreen.tsx
src/zones/office/camera/railMath.ts · CameraRig.tsx
src/zones/office/interactions.ts · AdaController.tsx · TuneMode.tsx · tune.ts
src/zones/workshop/index.tsx · src/zones/dungeon/index.tsx
src/test/setup.ts · memoryStorage.ts · fixtures.ts · resetAppStore.ts
tests/e2e/office.spec.ts · reading.spec.ts
docs/evidence/office/                    captures et mesures
```

---

### Task 1: Squelette du projet

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/fonts.ts`, `src/app/App.tsx`, `src/test/setup.ts`, `scripts/check-bundle.mjs`, `src/brand/oe-tokens.css`, `src/brand/athena.css`, `src/brand/logo-mark.svg`, `public/favicon.svg`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: rien.
- Produces: scripts npm `dev`, `build`, `typecheck`, `test`, `e2e`, `budget`, `check` ; composant `App` exporté par `src/app/App.tsx` ; fichier de setup de test `src/test/setup.ts`.

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "athena-prompt-academy",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p .",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "budget": "node scripts/check-bundle.mjs",
    "check": "npm run typecheck && npm run test && npm run build && npm run budget"
  }
}
```

- [ ] **Step 2: Installer les dépendances (versions exactes)**

```bash
npm install --save-exact react@19.3.0 react-dom@19.3.0 three@0.186.1 @react-three/fiber@9.8.1 @react-three/drei@10.7.9 maath@0.10.8 zustand@5.0.15 i18next@26.4.2 react-i18next@17.0.15 zod@4.6.5 gpt-tokenizer@4.0.0 @fontsource/montserrat@5.3.0 @fontsource/playfair-display@5.3.0
npm install --save-exact -D vite@8.3.1 @vitejs/plugin-react@6.1.1 typescript@7.0.2 vitest@5.0.2 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.7 @types/three@0.186.0 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24 @playwright/test@1.63.0 leva@0.10.1
```

Expected : aucune erreur `ERESOLVE`.

- [ ] **Step 3: Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom", "node"]
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: Créer `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { manifest: true, target: 'es2022' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 5: Créer `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Athena Prompt Academy</title>
  </head>
  <body class="at-body">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Copier les fichiers de la charte**

```bash
TMP="$(mktemp -d)"
unzip -q "/c/Users/Horn S/Downloads/Athena charte.zip" -d "$TMP"
mkdir -p src/brand public
cp "$TMP/athena/oe-tokens.css" "$TMP/athena/athena.css" "$TMP/athena/assets/logo-mark.svg" src/brand/
cp "$TMP/athena/assets/logo-mark.svg" public/favicon.svg
sed -i '/@import url(".\/fonts\/fonts.css");/d' src/brand/oe-tokens.css
grep -c "@import" src/brand/oe-tokens.css
rm -rf "$TMP"
```

Expected : la commande `grep -c` affiche `0` (l'import Google Fonts est retiré ; les polices viennent de @fontsource).

- [ ] **Step 7: Créer `src/fonts.ts`**

```ts
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/playfair-display/700-italic.css'
```

- [ ] **Step 8: Créer `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

afterEach(() => {
  window.localStorage.clear()
})
```

- [ ] **Step 9: Écrire le test qui échoue `src/app/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

test('renders the site name', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Athena Prompt Academy' })).toBeInTheDocument()
})
```

- [ ] **Step 10: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/app/App.test.tsx`
Expected: FAIL (impossible de résoudre `./App`).

- [ ] **Step 11: Créer `src/app/App.tsx` et `src/main.tsx`**

`src/app/App.tsx` :

```tsx
export function App() {
  return (
    <main className="app">
      <h1 className="at-h1">Athena Prompt Academy</h1>
    </main>
  )
}
```

`src/main.tsx` :

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './brand/oe-tokens.css'
import './brand/athena.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 12: Créer `scripts/check-bundle.mjs`**

```js
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const BUDGET_BYTES = 1.5 * 1024 * 1024
const dist = 'dist'
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'))
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
if (!entryKey) {
  console.error('No entry chunk found in dist/.vite/manifest.json')
  process.exit(1)
}

const files = new Set()
function collect(key) {
  const chunk = manifest[key]
  if (!chunk || files.has(chunk.file)) return
  files.add(chunk.file)
  for (const imported of chunk.imports ?? []) collect(imported)
}
collect(entryKey)

let total = 0
for (const file of files) total += gzipSync(readFileSync(join(dist, file))).length
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
console.log(`Initial JS (gzip): ${mb(total)} MB / budget ${mb(BUDGET_BYTES)} MB`)
if (total > BUDGET_BYTES) {
  console.error('Bundle budget exceeded')
  process.exit(1)
}
```

- [ ] **Step 13: Lancer toute la vérification**

Run: `npm run check`
Expected : `tsc` sans erreur, `1 passed`, build OK, puis `Initial JS (gzip): 0.0x MB / budget 1.50 MB`.
Si `tsc` échoue avec une erreur propre à TypeScript 7 (option inconnue, binaire manquant) : `npm install --save-exact -D typescript@5.9.3`, relancer `npm run check`, et le noter dans le message de commit.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + R3F project with brand assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Couleurs de la charte, bouton et CSS de base

**Files:**
- Create: `src/core/brand.ts`, `src/ui/Button.tsx`, `src/styles/app.css`
- Modify: `src/main.tsx` (import de `app.css`)
- Test: `src/core/brand.test.ts`, `src/ui/Button.test.tsx`

**Interfaces:**
- Consumes: `src/brand/oe-tokens.css`, `src/brand/athena.css` (Tâche 1).
- Produces: `brand` (objet de couleurs hex), `brandCssVars`, type `BrandColor` ; composant `Button` (`variant?: 'primary' | 'ghost' | 'solid'`, `size?: 'md' | 'sm'`, toutes les props de `<button>` y compris `ref`) ; classes CSS globales `.app`, `.stage`, `.overlay`, `.panel`, `.sr-only`.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/core/brand.test.ts` :

```ts
import tokensCss from '../brand/oe-tokens.css?raw'
import athenaCss from '../brand/athena.css?raw'
import { brand, brandCssVars } from './brand'

const css = tokensCss + athenaCss

function cssHex(variable: string): string | undefined {
  const match = css.match(new RegExp(`${variable}:\\s*(#[0-9A-Fa-f]{6})`))
  return match?.[1].toUpperCase()
}

describe('brand colours', () => {
  it.each(Object.entries(brandCssVars))('%s mirrors %s', (key, variable) => {
    expect(cssHex(variable)).toBe(brand[key as keyof typeof brand].toUpperCase())
  })
})
```

`src/ui/Button.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

test('renders a pill button with the variant classes', () => {
  render(<Button variant="primary" size="sm">Go</Button>)
  const button = screen.getByRole('button', { name: 'Go' })
  expect(button).toHaveClass('at-btn', 'at-btn--primary', 'at-btn--sm')
  expect(button).toHaveAttribute('type', 'button')
})

test('defaults to the ghost variant and forwards clicks', async () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick}>Back</Button>)
  const button = screen.getByRole('button', { name: 'Back' })
  expect(button).toHaveClass('at-btn--ghost')
  await userEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/core/brand.test.ts src/ui/Button.test.tsx`
Expected: FAIL (modules `./brand` et `./Button` introuvables).

- [ ] **Step 3: Créer `src/core/brand.ts`**

```ts
/** Brand colours for three.js materials. Must mirror src/brand/*.css (see brand.test.ts). */
export const brand = {
  ink: '#0B0D0E',
  surface1: '#121517',
  surface2: '#181C1F',
  surface3: '#1F2429',
  lime: '#58FC73',
  limeHover: '#42E063',
  mint: '#4DDBB8',
  nearBlack: '#0E0E0F',
  blueGrey: '#2F4858',
  onDark: '#F4F6F5',
  warn: '#FF9500',
  danger: '#EF4444',
} as const

export type BrandColor = keyof typeof brand

export const brandCssVars = {
  ink: '--at-ink',
  surface1: '--at-surface-1',
  surface2: '--at-surface-2',
  surface3: '--at-surface-3',
  lime: '--oe-lime',
  limeHover: '--oe-lime-hover',
  mint: '--oe-lime-mint',
  nearBlack: '--oe-near-black',
  blueGrey: '--oe-blue-grey',
  onDark: '--at-on-dark',
  warn: '--oe-warn',
  danger: '--oe-danger',
} as const satisfies Record<BrandColor, string>
```

- [ ] **Step 4: Créer `src/ui/Button.tsx`**

```tsx
import type { ComponentPropsWithRef } from 'react'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'ghost' | 'solid'
  size?: 'md' | 'sm'
}

export function Button({ variant = 'ghost', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  const classes = ['at-btn', `at-btn--${variant}`, size === 'sm' ? 'at-btn--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
```

- [ ] **Step 5: Créer `src/styles/app.css`**

```css
:root { color-scheme: dark; }
html, body, #root { height: 100%; }
body { margin: 0; overflow: hidden; }

.app { position: relative; width: 100vw; height: 100vh; overflow: hidden; background: var(--at-ink); }
.stage { position: absolute; inset: 0; }
.overlay { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
.panel { pointer-events: auto; }

:focus-visible { outline: 2px solid var(--oe-lime); outline-offset: 3px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
```

- [ ] **Step 6: Importer la CSS dans `src/main.tsx`**

Ajouter après `import './brand/athena.css'` :

```ts
import './styles/app.css'
```

- [ ] **Step 7: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/core/brand.test.ts src/ui/Button.test.tsx`
Expected: PASS (12 tests couleur + 2 tests bouton).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: brand colour constants, pill Button and base styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Traductions (i18next)

**Files:**
- Create: `src/core/i18n.ts`, `content/en/ui.json`, `content/en/visuals.json`
- Modify: `src/test/setup.ts`, `src/main.tsx`
- Test: `src/core/i18n.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `initI18n(lang?: string): i18n`, `resolveLang(lang: string): string`, `missingKeys(base: Dict, other: Dict): string[]`, `flattenKeys(dict: Dict): string[]`, `languages: string[]`, `resources`, `DEFAULT_LANG = 'en'`, type `Dict`. Namespaces : `ui` (par défaut) et `visuals`. Toutes les clés de `ui.json` listées ci-dessous sont utilisées par les tâches suivantes.

- [ ] **Step 1: Créer `content/en/ui.json`**

```json
{
  "app": {
    "name": "Athena Prompt Academy",
    "loading": "Setting up the office…",
    "smallScreen": "This experience works best on a larger screen."
  },
  "hud": {
    "language": "Language",
    "soundOn": "Sound on",
    "soundOff": "Sound off",
    "progress": "{{seen}}/{{total}} topics",
    "readingMode": "Reading mode",
    "exitReadingMode": "3D mode"
  },
  "welcome": {
    "greeting": "Hi, I'm Ada. Welcome to the office – take a seat and let's talk about AI.",
    "scrollHint": "Scroll to take a seat",
    "clickableHint": "Psst – the laptop and the old console are clickable too.",
    "learn": "Learn the basics",
    "workshop": "Prompt workshop",
    "dungeon": "The dungeon",
    "pickTopic": "Pick a topic to start."
  },
  "topics": {
    "menuTitle": "What do you want to learn?",
    "seen": "Seen",
    "deeperSeen": "Deep dive done"
  },
  "dialogue": {
    "deeper": "Go deeper",
    "nextTopic": "Next: {{title}}",
    "allTopics": "All topics",
    "takeaway": "Key takeaway",
    "continueHint": "Click or press Space to continue",
    "tryIt": "Try it yourself"
  },
  "screen": {
    "expand": "Expand",
    "close": "Close"
  },
  "objects": {
    "laptop": "Prompt Workshop",
    "tv": "The Dungeon",
    "ada": "Ada"
  },
  "zones": {
    "soonLabel": "Coming soon",
    "back": "Back to the office",
    "workshop": {
      "title": "Prompt Workshop",
      "soon": "Ada is still setting up the workshop. Come back soon to build your first prompt."
    },
    "dungeon": {
      "title": "The Dungeon",
      "soon": "The dungeon gates are still locked. Come back soon to test what you've learned."
    }
  },
  "errors": {
    "generic": "Something went wrong",
    "genericBody": "This part of the office hit a snag. Head back and keep learning.",
    "webglLost": "3D stopped working on this device, so you're now in reading mode."
  },
  "tokensDemo": {
    "label": "Type a sentence",
    "loading": "Loading the tokenizer…",
    "count": "{{tokens}} tokens · {{chars}} characters",
    "note": "Each AI model splits text a little differently.",
    "limit": "Limited to {{max}} characters.",
    "loadError": "The live demo couldn't load."
  }
}
```

- [ ] **Step 2: Créer `content/en/visuals.json`**

```json
{
  "idle": {
    "kicker": "Welcome",
    "title": "Athena Prompt Academy",
    "tagline": "Learn to talk to AI"
  }
}
```

- [ ] **Step 3: Écrire le test qui échoue `src/core/i18n.test.ts`**

```ts
import { initI18n, languages, missingKeys, resolveLang, resources } from './i18n'

test('finds missing nested keys', () => {
  const base = { a: 'x', b: { c: 'y', d: 'z' } }
  expect(missingKeys(base, { a: 'x', b: { c: 'y' } })).toEqual(['b.d'])
  expect(missingKeys(base, base)).toEqual([])
})

test('every language has every English key', () => {
  for (const lang of languages) {
    expect(missingKeys(resources.en.ui, resources[lang].ui)).toEqual([])
    expect(missingKeys(resources.en.visuals, resources[lang].visuals)).toEqual([])
  }
})

test('resolves unknown languages to English', () => {
  expect(resolveLang('en')).toBe('en')
  expect(resolveLang('xx')).toBe('en')
})

test('interpolates values', () => {
  const i18n = initI18n('en')
  expect(i18n.t('hud.progress', { seen: 3, total: 13 })).toBe('3/13 topics')
  expect(i18n.t('idle.tagline', { ns: 'visuals' })).toBe('Learn to talk to AI')
})
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/core/i18n.test.ts`
Expected: FAIL (`./i18n` introuvable).

- [ ] **Step 5: Créer `src/core/i18n.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export type Dict = { [key: string]: string | Dict }

const uiFiles = import.meta.glob<Dict>('/content/*/ui.json', { eager: true, import: 'default' })
const visualFiles = import.meta.glob<Dict>('/content/*/visuals.json', { eager: true, import: 'default' })

const langOf = (path: string) => path.split('/')[2]

export const resources: Record<string, { ui: Dict; visuals: Dict }> = {}
for (const [path, dict] of Object.entries(uiFiles)) resources[langOf(path)] = { ui: dict, visuals: {} }
for (const [path, dict] of Object.entries(visualFiles)) {
  const lang = langOf(path)
  if (resources[lang]) resources[lang].visuals = dict
}

export const DEFAULT_LANG = 'en'
export const languages = Object.keys(resources).sort()

export function resolveLang(lang: string): string {
  return languages.includes(lang) ? lang : DEFAULT_LANG
}

export function flattenKeys(dict: Dict, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`),
  )
}

export function missingKeys(base: Dict, other: Dict): string[] {
  const present = new Set(flattenKeys(other))
  return flattenKeys(base).filter((key) => !present.has(key))
}

export function initI18n(lang: string = DEFAULT_LANG) {
  const lng = resolveLang(lang)
  if (i18n.isInitialized) {
    if (i18n.language !== lng) void i18n.changeLanguage(lng)
    return i18n
  }
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANG,
    ns: ['ui', 'visuals'],
    defaultNS: 'ui',
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return i18n
}

export { i18n }
```

- [ ] **Step 6: Initialiser i18n dans les tests et au démarrage**

Ajouter en tête de `src/test/setup.ts` (après l'import jest-dom) :

```ts
import { initI18n } from '../core/i18n'

initI18n('en')
```

Dans `src/main.tsx`, ajouter avant `createRoot(...)` :

```ts
import { initI18n } from './core/i18n'

initI18n('en')
```

(La Tâche 8 remplacera `'en'` par la langue des réglages.)

- [ ] **Step 7: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous les tests, dont les 4 d'i18n).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: i18next setup with ui and visuals namespaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Progression et réglages (stockage sûr)

**Files:**
- Create: `src/core/progress.ts`, `src/test/memoryStorage.ts`
- Test: `src/core/progress.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `PROGRESS_KEY = 'athena-prompt-academy:v1'`, `SETTINGS_KEY = 'athena-prompt-academy:settings'`
  - `type Progress = { version: 1; topicsSeen: string[]; deeperSeen: string[]; workshopDone: boolean; dungeon: { passed: boolean; bestScore: number } | null; firstVisitDone: boolean }`
  - `type Settings = { sound: boolean; lang: string }`
  - `type StorageLike = Pick<Storage, 'getItem' | 'setItem'>`
  - `emptyProgress(): Progress`, `defaultSettings(): Settings`
  - `loadProgress(storage?: StorageLike | null): Progress`, `saveProgress(p: Progress, storage?: StorageLike | null): boolean`
  - `loadSettings(storage?: StorageLike | null): Settings`, `saveSettings(s: Settings, storage?: StorageLike | null): boolean`
  - `markSeen(p: Progress, topicId: string, section: 'basics' | 'deeper'): Progress` (renvoie le même objet si déjà présent)
  - `memoryStorage(): StorageLike & { data: Map<string, string> }` (test helper)
  - Paramètre `storage` : `undefined` → `window.localStorage` (protégé), `null` → aucun stockage.

- [ ] **Step 1: Créer `src/test/memoryStorage.ts`**

```ts
import type { StorageLike } from '../core/progress'

export function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}
```

- [ ] **Step 2: Écrire le test qui échoue `src/core/progress.test.ts`**

```ts
import { memoryStorage } from '../test/memoryStorage'
import {
  PROGRESS_KEY,
  SETTINGS_KEY,
  defaultSettings,
  emptyProgress,
  loadProgress,
  loadSettings,
  markSeen,
  saveProgress,
  saveSettings,
} from './progress'

describe('progress', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const progress = { ...emptyProgress(), topicsSeen: ['tokens'], firstVisitDone: true }
    expect(saveProgress(progress, storage)).toBe(true)
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!)).toEqual(progress)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('returns empty progress without storage', () => {
    expect(loadProgress(null)).toEqual(emptyProgress())
    expect(saveProgress(emptyProgress(), null)).toBe(false)
  })

  it('returns empty progress for corrupted or unknown data', () => {
    const storage = memoryStorage()
    storage.setItem(PROGRESS_KEY, '{not json')
    expect(loadProgress(storage)).toEqual(emptyProgress())
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), version: 2 }))
    expect(loadProgress(storage)).toEqual(emptyProgress())
    storage.setItem(PROGRESS_KEY, JSON.stringify({ topicsSeen: 'tokens' }))
    expect(loadProgress(storage)).toEqual(emptyProgress())
  })

  // Review focus 1: blocked or throwing storage must never break the site.
  it('survives a storage whose methods throw', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadProgress(throwing)).toEqual(emptyProgress())
    expect(saveProgress(emptyProgress(), throwing)).toBe(false)
  })

  it('survives window.localStorage itself throwing', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(loadProgress()).toEqual(emptyProgress())
      expect(saveProgress(emptyProgress())).toBe(false)
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
      else delete (window as { localStorage?: Storage }).localStorage
    }
  })

  it('marks sections as seen once', () => {
    const once = markSeen(emptyProgress(), 'tokens', 'basics')
    expect(once.topicsSeen).toEqual(['tokens'])
    expect(markSeen(once, 'tokens', 'basics')).toBe(once)
    expect(markSeen(once, 'tokens', 'deeper').deeperSeen).toEqual(['tokens'])
  })
})

describe('settings', () => {
  it('round-trips and falls back to defaults', () => {
    const storage = memoryStorage()
    expect(loadSettings(storage)).toEqual(defaultSettings())
    saveSettings({ sound: false, lang: 'en' }, storage)
    expect(loadSettings(storage)).toEqual({ sound: false, lang: 'en' })
    storage.setItem(SETTINGS_KEY, '"broken"')
    expect(loadSettings(storage)).toEqual(defaultSettings())
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/core/progress.test.ts`
Expected: FAIL (`./progress` introuvable).

- [ ] **Step 4: Créer `src/core/progress.ts`**

```ts
import { z } from 'zod'

export const PROGRESS_KEY = 'athena-prompt-academy:v1'
export const SETTINGS_KEY = 'athena-prompt-academy:settings'

const progressSchema = z.object({
  version: z.literal(1),
  topicsSeen: z.array(z.string()),
  deeperSeen: z.array(z.string()),
  workshopDone: z.boolean(),
  dungeon: z.object({ passed: z.boolean(), bestScore: z.number() }).nullable(),
  firstVisitDone: z.boolean(),
})
export type Progress = z.infer<typeof progressSchema>

const settingsSchema = z.object({ sound: z.boolean(), lang: z.string() })
export type Settings = z.infer<typeof settingsSchema>

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const emptyProgress = (): Progress => ({
  version: 1,
  topicsSeen: [],
  deeperSeen: [],
  workshopDone: false,
  dungeon: null,
  firstVisitDone: false,
})

export const defaultSettings = (): Settings => ({ sound: true, lang: 'en' })

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function read<T>(key: string, schema: z.ZodType<T>, fallback: () => T, storage: StorageLike | null): T {
  if (!storage) return fallback()
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback()
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : fallback()
  } catch {
    return fallback()
  }
}

function write(key: string, value: unknown, storage: StorageLike | null): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadProgress = (storage: StorageLike | null = browserStorage()) =>
  read(PROGRESS_KEY, progressSchema, emptyProgress, storage)
export const saveProgress = (progress: Progress, storage: StorageLike | null = browserStorage()) =>
  write(PROGRESS_KEY, progress, storage)
export const loadSettings = (storage: StorageLike | null = browserStorage()) =>
  read(SETTINGS_KEY, settingsSchema, defaultSettings, storage)
export const saveSettings = (settings: Settings, storage: StorageLike | null = browserStorage()) =>
  write(SETTINGS_KEY, settings, storage)

export function markSeen(progress: Progress, topicId: string, section: 'basics' | 'deeper'): Progress {
  const key = section === 'basics' ? 'topicsSeen' : 'deeperSeen'
  if (progress[key].includes(topicId)) return progress
  return { ...progress, [key]: [...progress[key], topicId] }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/core/progress.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: progress and settings persistence resilient to blocked storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Schéma du contenu, chargement, validation et premier sujet

**Files:**
- Create: `src/content/schema.ts`, `src/content/load.ts`, `src/content/validate.ts`, `src/visuals/manifest.ts`, `src/test/fixtures.ts`, `content/en/chapters.json`, `content/en/topics/what-is-ai.json`
- Test: `src/content/load.test.ts`, `src/content/validate.test.ts`, `src/content/content.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `MOODS = ['neutral','happy','thinking','surprised','encouraging']`, `GESTURES = ['none','wave','pointScreen','spin','nod','shrug']`, types `Mood`, `Gesture`, `MAX_SAY = 220`
  - `beatSchema`, `topicSchema`, `chaptersSchema` ; types `Beat = { say: string; mood?: Mood; gesture?: Gesture; screen?: string }`, `Topic = { id; chapter; title; teaser; reviewed; basics: Beat[]; deeper: Beat[]; takeaway; next: string | null }`, `Chapter = { id; title; topics: string[] }`
  - `type ScreenRef = { visualId: string; step: number }`, `parseScreenRef(ref: string): ScreenRef`
  - `type ContentIssue = { path: string; message: string }`, `type LangContent = { lang; chapters: Chapter[]; topics: Topic[]; topicById: ReadonlyMap<string, Topic>; issues: ContentIssue[] }`
  - `buildContent(lang: string, rawChapters: unknown, rawTopics: Record<string, unknown>): LangContent`, `getContent(lang: string): LangContent` (mémoïsé, repli sur `en`), `contentLanguages: string[]`
  - `validateContent(content: LangContent, manifest: Record<string, { steps: number }>): ContentIssue[]`
  - `visualManifest` (13 entrées), type `VisualId`, `isVisualId(id: string): id is VisualId`
  - `makeTopic(overrides?: Partial<Topic>): Topic` (test helper)

- [ ] **Step 1: Créer `src/visuals/manifest.ts`**

```ts
/** Number of build-up steps of each wall-screen visual. Steps are numbered from 1. */
export const visualManifest = {
  'what-is-ai': { steps: 4 },
  'generative-ai': { steps: 3 },
  llm: { steps: 4 },
  tokens: { steps: 4 },
  'context-window': { steps: 3 },
  hallucinations: { steps: 3 },
  prompt: { steps: 4 },
  multimodal: { steps: 3 },
  agents: { steps: 4 },
  tools: { steps: 3 },
  skills: { steps: 3 },
  mcp: { steps: 3 },
  'ai-safety-at-work': { steps: 4 },
} as const satisfies Record<string, { steps: number }>

export type VisualId = keyof typeof visualManifest

export function isVisualId(id: string): id is VisualId {
  return Object.hasOwn(visualManifest, id)
}
```

- [ ] **Step 2: Créer `src/content/schema.ts`**

```ts
import { z } from 'zod'

export const MOODS = ['neutral', 'happy', 'thinking', 'surprised', 'encouraging'] as const
export const GESTURES = ['none', 'wave', 'pointScreen', 'spin', 'nod', 'shrug'] as const
export type Mood = (typeof MOODS)[number]
export type Gesture = (typeof GESTURES)[number]

export const MAX_SAY = 220
const SLUG = /^[a-z0-9-]+$/
const EMOJI = /[\p{Emoji_Presentation}\uFE0F]/u

const text = (max = 400) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !EMOJI.test(value), { message: 'No emoji allowed' })

export const beatSchema = z
  .object({
    say: text(MAX_SAY),
    mood: z.enum(MOODS).optional(),
    gesture: z.enum(GESTURES).optional(),
    screen: z.string().regex(/^[a-z0-9-]+:\d+$/).optional(),
  })
  .strict()

export const topicSchema = z
  .object({
    id: z.string().regex(SLUG),
    chapter: z.string().regex(SLUG),
    title: text(80),
    teaser: text(120),
    reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    basics: z.array(beatSchema).min(1),
    deeper: z.array(beatSchema).min(1),
    takeaway: text(160),
    next: z.string().regex(SLUG).nullable(),
  })
  .strict()

export const chaptersSchema = z
  .array(
    z
      .object({
        id: z.string().regex(SLUG),
        title: text(80),
        topics: z.array(z.string().regex(SLUG)).min(1),
      })
      .strict(),
  )
  .min(1)

export type Beat = z.infer<typeof beatSchema>
export type Topic = z.infer<typeof topicSchema>
export type Chapter = z.infer<typeof chaptersSchema>[number]

export interface ScreenRef {
  visualId: string
  step: number
}

export function parseScreenRef(ref: string): ScreenRef {
  const [visualId, step] = ref.split(':')
  return { visualId, step: Number(step) }
}
```

- [ ] **Step 3: Créer `src/test/fixtures.ts`**

```ts
import type { Topic } from '../content/schema'

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'alpha',
    chapter: 'basics',
    title: 'Alpha',
    teaser: 'The first test topic',
    reviewed: '2026-09-29',
    basics: [
      { say: 'Basics one.', mood: 'happy', gesture: 'pointScreen', screen: 'what-is-ai:1' },
      { say: 'Basics two.' },
      { say: 'Basics three.', screen: 'what-is-ai:2' },
    ],
    deeper: [{ say: 'Deeper one.' }, { say: 'Deeper two.', screen: 'what-is-ai:4' }],
    takeaway: 'Alpha in one line.',
    next: null,
    ...overrides,
  }
}
```

- [ ] **Step 4: Écrire les tests qui échouent**

`src/content/load.test.ts` :

```ts
import { makeTopic } from '../test/fixtures'
import { buildContent } from './load'

const chapters = [{ id: 'basics', title: 'The basics', topics: ['alpha', 'beta'] }]

describe('buildContent', () => {
  it('orders topics by chapter and indexes them', () => {
    const content = buildContent('en', chapters, {
      beta: makeTopic({ id: 'beta' }),
      alpha: makeTopic({ id: 'alpha', next: 'beta' }),
    })
    expect(content.issues).toEqual([])
    expect(content.topics.map((t) => t.id)).toEqual(['alpha', 'beta'])
    expect(content.topicById.get('beta')?.id).toBe('beta')
  })

  it('drops invalid topics and reports why', () => {
    const content = buildContent('en', chapters, {
      alpha: makeTopic({ basics: [{ say: 'x'.repeat(221) }] }),
      beta: makeTopic({ id: 'gamma' }),
    })
    expect(content.topics).toEqual([])
    expect(content.issues.map((i) => i.path)).toEqual(['en/topics/alpha.json', 'en/topics/beta.json'])
    expect(content.issues[1].message).toContain('does not match file name')
  })

  it('rejects emoji in text', () => {
    const content = buildContent('en', [{ id: 'basics', title: 'B', topics: ['alpha'] }], {
      alpha: makeTopic({ title: 'Alpha \u{1F680}' }),
    })
    expect(content.topics).toEqual([])
    expect(content.issues[0].message).toContain('No emoji allowed')
  })

  it('reports chapter problems', () => {
    const content = buildContent('en', [{ id: 'basics', title: 'B', topics: ['alpha', 'ghost'] }], {
      alpha: makeTopic({ chapter: 'other' }),
      orphan: makeTopic({ id: 'orphan' }),
    })
    const messages = content.issues.map((i) => i.message)
    expect(messages).toContain('chapter "basics" lists unknown topic "ghost"')
    expect(messages).toContain('topic "alpha" says chapter "other" but is listed in "basics"')
    expect(messages).toContain('topic "orphan" is not listed in any chapter')
    expect(content.topics.map((t) => t.id)).toEqual(['alpha'])
  })

  it('reports a broken chapters file', () => {
    const content = buildContent('en', { nope: true }, {})
    expect(content.issues[0].path).toBe('en/chapters.json')
    expect(content.chapters).toEqual([])
  })
})
```

`src/content/validate.test.ts` :

```ts
import { makeTopic } from '../test/fixtures'
import { visualManifest } from '../visuals/manifest'
import { buildContent } from './load'
import { validateContent } from './validate'

function contentWith(topics: ReturnType<typeof makeTopic>[]) {
  const chapters = [{ id: 'basics', title: 'B', topics: topics.map((t) => t.id) }]
  return buildContent('en', chapters, Object.fromEntries(topics.map((t) => [t.id, t])))
}

test('accepts a coherent topic', () => {
  expect(validateContent(contentWith([makeTopic()]), visualManifest)).toEqual([])
})

test('flags an unknown next topic', () => {
  const issues = validateContent(contentWith([makeTopic({ next: 'nowhere' })]), visualManifest)
  expect(issues[0].message).toBe('next "nowhere" is not a known topic')
})

test('flags unknown visuals and out-of-range steps', () => {
  const topic = makeTopic({
    basics: [{ say: 'a', screen: 'what-is-ai:9' }, { say: 'b', screen: 'nope:1' }],
  })
  const messages = validateContent(contentWith([topic]), visualManifest).map((i) => i.message)
  expect(messages).toContain('basics[0]: step 9 out of range 1-4 for "what-is-ai"')
  expect(messages).toContain('basics[1]: unknown visual "nope"')
})

test('requires the first basics beat to set a screen', () => {
  const topic = makeTopic({ basics: [{ say: 'no screen' }] })
  const messages = validateContent(contentWith([topic]), visualManifest).map((i) => i.message)
  expect(messages).toContain('the first basics beat must set a screen')
})
```

`src/content/content.test.ts` :

```ts
import { visualManifest } from '../visuals/manifest'
import { contentLanguages, getContent } from './load'
import { validateContent } from './validate'

describe('shipped content', () => {
  it('includes English', () => {
    expect(contentLanguages).toContain('en')
  })

  it.each(contentLanguages)('%s has no issues', (lang) => {
    expect(validateContent(getContent(lang), visualManifest)).toEqual([])
  })

  it.each(contentLanguages)('%s has the same topics as English', (lang) => {
    expect(getContent(lang).topics.map((t) => t.id)).toEqual(getContent('en').topics.map((t) => t.id))
  })

  it('falls back to English for an unknown language', () => {
    expect(getContent('xx').lang).toBe('en')
  })
})
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/content`
Expected: FAIL (`./load` et `./validate` introuvables).

- [ ] **Step 6: Créer `src/content/load.ts`**

```ts
import { chaptersSchema, topicSchema, type Chapter, type Topic } from './schema'

export interface ContentIssue {
  path: string
  message: string
}

export interface LangContent {
  lang: string
  chapters: Chapter[]
  topics: Topic[]
  topicById: ReadonlyMap<string, Topic>
  issues: ContentIssue[]
}

const topicFiles = import.meta.glob<unknown>('/content/*/topics/*.json', { eager: true, import: 'default' })
const chapterFiles = import.meta.glob<unknown>('/content/*/chapters.json', { eager: true, import: 'default' })

const langOf = (path: string) => path.split('/')[2]
const fileId = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')

export function buildContent(lang: string, rawChapters: unknown, rawTopics: Record<string, unknown>): LangContent {
  const issues: ContentIssue[] = []
  const topicPath = (id: string) => `${lang}/topics/${id}.json`

  const parsedChapters = chaptersSchema.safeParse(rawChapters)
  if (!parsedChapters.success) issues.push({ path: `${lang}/chapters.json`, message: parsedChapters.error.message })
  const chapterList = parsedChapters.success ? parsedChapters.data : []

  const valid = new Map<string, Topic>()
  for (const [id, raw] of Object.entries(rawTopics)) {
    const parsed = topicSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push({ path: topicPath(id), message: parsed.error.message })
      continue
    }
    if (parsed.data.id !== id) {
      issues.push({ path: topicPath(id), message: `id "${parsed.data.id}" does not match file name "${id}"` })
      continue
    }
    valid.set(id, parsed.data)
  }

  const listed = new Set<string>()
  const chapters: Chapter[] = chapterList.map((chapter) => {
    const topics: string[] = []
    for (const id of chapter.topics) {
      if (listed.has(id)) {
        issues.push({ path: `${lang}/chapters.json`, message: `topic "${id}" is listed more than once` })
        continue
      }
      listed.add(id)
      const topic = valid.get(id)
      if (!topic) {
        if (!(id in rawTopics)) {
          issues.push({ path: `${lang}/chapters.json`, message: `chapter "${chapter.id}" lists unknown topic "${id}"` })
        }
        continue
      }
      if (topic.chapter !== chapter.id) {
        issues.push({
          path: topicPath(id),
          message: `topic "${id}" says chapter "${topic.chapter}" but is listed in "${chapter.id}"`,
        })
      }
      topics.push(id)
    }
    return { ...chapter, topics }
  })

  for (const id of valid.keys()) {
    if (!listed.has(id)) issues.push({ path: topicPath(id), message: `topic "${id}" is not listed in any chapter` })
  }

  const topics = chapters.flatMap((chapter) => chapter.topics.map((id) => valid.get(id)!))
  return { lang, chapters, topics, topicById: new Map(topics.map((t) => [t.id, t])), issues }
}

export const contentLanguages = [...new Set(Object.keys(chapterFiles).map(langOf))].sort()

const cache = new Map<string, LangContent>()

export function getContent(lang: string): LangContent {
  const resolved = contentLanguages.includes(lang) ? lang : 'en'
  let content = cache.get(resolved)
  if (!content) {
    const rawTopics: Record<string, unknown> = {}
    for (const [path, raw] of Object.entries(topicFiles)) {
      if (langOf(path) === resolved) rawTopics[fileId(path)] = raw
    }
    content = buildContent(resolved, chapterFiles[`/content/${resolved}/chapters.json`], rawTopics)
    cache.set(resolved, content)
  }
  return content
}
```

- [ ] **Step 7: Créer `src/content/validate.ts`**

```ts
import { parseScreenRef } from './schema'
import type { ContentIssue, LangContent } from './load'

export function validateContent(
  content: LangContent,
  manifest: Readonly<Record<string, { readonly steps: number }>>,
): ContentIssue[] {
  const issues = [...content.issues]
  for (const topic of content.topics) {
    const path = `${content.lang}/topics/${topic.id}.json`
    if (topic.next !== null && !content.topicById.has(topic.next)) {
      issues.push({ path, message: `next "${topic.next}" is not a known topic` })
    }
    if (!topic.basics[0].screen) issues.push({ path, message: 'the first basics beat must set a screen' })
    for (const [section, beats] of [
      ['basics', topic.basics],
      ['deeper', topic.deeper],
    ] as const) {
      beats.forEach((beat, index) => {
        if (!beat.screen) return
        const { visualId, step } = parseScreenRef(beat.screen)
        const meta = manifest[visualId]
        if (!meta) issues.push({ path, message: `${section}[${index}]: unknown visual "${visualId}"` })
        else if (step < 1 || step > meta.steps) {
          issues.push({ path, message: `${section}[${index}]: step ${step} out of range 1-${meta.steps} for "${visualId}"` })
        }
      })
    }
  }
  return issues
}
```

- [ ] **Step 8: Créer le contenu réel minimal**

`content/en/chapters.json` (seul le premier sujet existe pour l'instant ; la Tâche 13 complète) :

```json
[
  { "id": "basics", "title": "The basics", "topics": ["what-is-ai"] }
]
```

`content/en/topics/what-is-ai.json` (`next` vaut `null` ici ; la Tâche 13 le remplace par `"generative-ai"`) :

```json
{
  "id": "what-is-ai",
  "chapter": "basics",
  "title": "What is AI?",
  "teaser": "The big picture, from AI to generative AI",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Let's start at the very beginning. 'AI' is a big umbrella word – it covers any machine doing a task that usually needs human thinking.", "mood": "happy", "gesture": "pointScreen", "screen": "what-is-ai:1" },
    { "say": "Inside that umbrella sits machine learning. Instead of following hand-written rules, the machine learns patterns from lots of examples.", "screen": "what-is-ai:2" },
    { "say": "Think of a spam filter. Nobody lists every spam email. It sees thousands of examples and learns what spam tends to look like.", "mood": "thinking" },
    { "say": "Deep learning is machine learning with many stacked layers – a 'neural network'. That's what made recognizing faces and voices possible.", "screen": "what-is-ai:3" },
    { "say": "And right in the middle: generative AI. It doesn't just recognize things – it creates new text, images or sound. That's what we'll explore here.", "mood": "encouraging", "gesture": "pointScreen", "screen": "what-is-ai:4" }
  ],
  "deeper": [
    { "say": "Here's the key difference. Traditional software: a person writes the rules. Machine learning: the machine finds the rules itself, from data.", "mood": "thinking", "screen": "what-is-ai:2" },
    { "say": "A neural network is loosely inspired by the brain: millions of tiny adjustable numbers, called parameters, tuned during training.", "screen": "what-is-ai:3" },
    { "say": "Training is slow, expensive and happens once. Using the model afterwards – experts call it 'inference' – is fast. That's what happens when you chat.", "mood": "neutral" },
    { "say": "One consequence: a model only knows what was in its training data, up to a cut-off date. Anything newer, it has to be told.", "mood": "encouraging", "screen": "what-is-ai:4" }
  ],
  "takeaway": "Generative AI is the part of AI that creates new content – text, images, sound.",
  "next": null
}
```

- [ ] **Step 9: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/content`
Expected: PASS (5 + 4 + 4 tests).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: content schema, loader, cross-validation and first topic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Moteur de dialogue

**Files:**
- Create: `src/dialogue/engine.ts`
- Test: `src/dialogue/engine.test.ts`

**Interfaces:**
- Consumes: `Topic`, `Beat`, `ScreenRef`, `parseScreenRef` (Tâche 5) ; `makeTopic` (tests).
- Produces:
  - `type Section = 'basics' | 'deeper'`, `type Phase = 'typing' | 'waiting' | 'choices'`
  - `interface DialogueState { topicId: string; section: Section; beatIndex: number; phase: Phase }`
  - `interface SectionCompleted { topicId: string; section: Section }`
  - `type Choice = { kind: 'deeper' } | { kind: 'next'; topicId: string } | { kind: 'all' }`
  - `start(topic): DialogueState`, `finishTyping(state): DialogueState`, `advance(state, topic): { state: DialogueState; completed: SectionCompleted | null }`, `chooseDeeper(state, topic): DialogueState`, `currentBeat(state, topic): Beat`, `choicesFor(state, topic, knownTopicIds: ReadonlySet<string>): Choice[]`, `screenAt(state, topic): ScreenRef | null`

- [ ] **Step 1: Écrire le test qui échoue `src/dialogue/engine.test.ts`**

```ts
import { makeTopic } from '../test/fixtures'
import { advance, choicesFor, chooseDeeper, currentBeat, finishTyping, screenAt, start } from './engine'

const topic = makeTopic({ next: 'beta' })

function runToChoices(state = start(topic)) {
  let current = state
  let completed = null
  for (let i = 0; i < 20 && current.phase !== 'choices'; i++) {
    const result = advance(current, topic)
    current = result.state
    completed = result.completed ?? completed
  }
  return { state: current, completed }
}

test('starts typing the first basics beat', () => {
  expect(start(topic)).toEqual({ topicId: 'alpha', section: 'basics', beatIndex: 0, phase: 'typing' })
  expect(currentBeat(start(topic), topic).say).toBe('Basics one.')
})

test('advance first reveals the whole line, then moves on', () => {
  const revealed = advance(start(topic), topic)
  expect(revealed.state.phase).toBe('waiting')
  expect(revealed.state.beatIndex).toBe(0)
  const next = advance(revealed.state, topic)
  expect(next.state).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('finishTyping only affects the typing phase', () => {
  const waiting = finishTyping(start(topic))
  expect(waiting.phase).toBe('waiting')
  expect(finishTyping(waiting)).toBe(waiting)
})

test('the last beat leads to choices and reports completion once', () => {
  const { state, completed } = runToChoices()
  expect(state.phase).toBe('choices')
  expect(completed).toEqual({ topicId: 'alpha', section: 'basics' })
  expect(advance(state, topic)).toEqual({ state, completed: null })
})

test('choices after basics: deeper, next, all', () => {
  const { state } = runToChoices()
  expect(choicesFor(state, topic, new Set(['alpha', 'beta']))).toEqual([
    { kind: 'deeper' },
    { kind: 'next', topicId: 'beta' },
    { kind: 'all' },
  ])
  expect(choicesFor(state, topic, new Set(['alpha']))).toEqual([{ kind: 'deeper' }, { kind: 'all' }])
  expect(choicesFor(start(topic), topic, new Set(['alpha']))).toEqual([])
})

test('go deeper, then the deeper section completes', () => {
  const { state } = runToChoices()
  const deeper = chooseDeeper(state, topic)
  expect(deeper).toEqual({ topicId: 'alpha', section: 'deeper', beatIndex: 0, phase: 'typing' })
  const done = runToChoices(deeper)
  expect(done.completed).toEqual({ topicId: 'alpha', section: 'deeper' })
  expect(choicesFor(done.state, topic, new Set(['alpha', 'beta']))).toEqual([
    { kind: 'next', topicId: 'beta' },
    { kind: 'all' },
  ])
  expect(chooseDeeper(done.state, topic)).toBe(done.state)
})

test('chooseDeeper is ignored before the choices phase', () => {
  const typing = start(topic)
  expect(chooseDeeper(typing, topic)).toBe(typing)
})

test('the screen keeps the last visual step set so far', () => {
  const s0 = start(topic)
  expect(screenAt(s0, topic)).toEqual({ visualId: 'what-is-ai', step: 1 })
  expect(screenAt({ ...s0, beatIndex: 1 }, topic)).toEqual({ visualId: 'what-is-ai', step: 1 })
  expect(screenAt({ ...s0, beatIndex: 2 }, topic)).toEqual({ visualId: 'what-is-ai', step: 2 })
  const deeper = { ...s0, section: 'deeper' as const, beatIndex: 0 }
  expect(screenAt(deeper, topic)).toEqual({ visualId: 'what-is-ai', step: 2 })
  expect(screenAt({ ...deeper, beatIndex: 1 }, topic)).toEqual({ visualId: 'what-is-ai', step: 4 })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/dialogue`
Expected: FAIL (`./engine` introuvable).

- [ ] **Step 3: Créer `src/dialogue/engine.ts`**

```ts
import { parseScreenRef, type Beat, type ScreenRef, type Topic } from '../content/schema'

export type Section = 'basics' | 'deeper'
export type Phase = 'typing' | 'waiting' | 'choices'

export interface DialogueState {
  topicId: string
  section: Section
  beatIndex: number
  phase: Phase
}

export interface SectionCompleted {
  topicId: string
  section: Section
}

export type Choice = { kind: 'deeper' } | { kind: 'next'; topicId: string } | { kind: 'all' }

const beatsOf = (topic: Topic, section: Section) => (section === 'basics' ? topic.basics : topic.deeper)

export function start(topic: Topic): DialogueState {
  return { topicId: topic.id, section: 'basics', beatIndex: 0, phase: 'typing' }
}

export function finishTyping(state: DialogueState): DialogueState {
  return state.phase === 'typing' ? { ...state, phase: 'waiting' } : state
}

export function advance(
  state: DialogueState,
  topic: Topic,
): { state: DialogueState; completed: SectionCompleted | null } {
  if (state.phase === 'typing') return { state: { ...state, phase: 'waiting' }, completed: null }
  if (state.phase === 'choices') return { state, completed: null }
  const beats = beatsOf(topic, state.section)
  if (state.beatIndex < beats.length - 1) {
    return { state: { ...state, beatIndex: state.beatIndex + 1, phase: 'typing' }, completed: null }
  }
  return { state: { ...state, phase: 'choices' }, completed: { topicId: topic.id, section: state.section } }
}

export function chooseDeeper(state: DialogueState, topic: Topic): DialogueState {
  if (state.phase !== 'choices' || state.section !== 'basics') return state
  return { topicId: topic.id, section: 'deeper', beatIndex: 0, phase: 'typing' }
}

export function currentBeat(state: DialogueState, topic: Topic): Beat {
  const beats = beatsOf(topic, state.section)
  return beats[Math.min(state.beatIndex, beats.length - 1)]
}

export function choicesFor(state: DialogueState, topic: Topic, knownTopicIds: ReadonlySet<string>): Choice[] {
  if (state.phase !== 'choices') return []
  const choices: Choice[] = []
  if (state.section === 'basics') choices.push({ kind: 'deeper' })
  if (topic.next && knownTopicIds.has(topic.next)) choices.push({ kind: 'next', topicId: topic.next })
  choices.push({ kind: 'all' })
  return choices
}

export function screenAt(state: DialogueState, topic: Topic): ScreenRef | null {
  const upto = (beats: Beat[]) => beats.slice(0, state.beatIndex + 1)
  const sequence = state.section === 'basics' ? upto(topic.basics) : [...topic.basics, ...upto(topic.deeper)]
  for (let i = sequence.length - 1; i >= 0; i--) {
    const screen = sequence[i].screen
    if (screen) return parseScreenRef(screen)
  }
  return null
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/dialogue`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: pure dialogue engine with sections, choices and screen steps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Store global et routeur d'URL

**Files:**
- Create: `src/core/store.ts`, `src/core/router.ts`, `src/test/resetAppStore.ts`
- Test: `src/core/store.test.ts`, `src/core/router.test.ts`

**Interfaces:**
- Consumes: `getContent` (Tâche 5), moteur de dialogue (Tâche 6), progression (Tâche 4).
- Produces:
  - `type ZoneId = 'office' | 'workshop' | 'dungeon'`, `ZONES`, `type Via = 'laptop' | 'tv'`, `type HoverTarget = 'laptop' | 'tv' | 'ada'`
  - `interface Transition { to: ZoneId; via: Via | null; stage: 'flight' | 'fade' }`
  - `interface AppState` (champs et actions ci-dessous), `interface StoreDeps { getTopic(lang, id): Topic | undefined; storage?: StorageLike | null; reducedMotion?: boolean }`
  - `createAppStore(deps): StoreApi<AppState>`, instance par défaut `appStore`, hook `useApp<T>(selector: (s: AppState) => T): T`
  - `interface Route { zone: ZoneId; topic: string | null }`, `parseHash(hash): Route`, `formatHash(route): string`, `startRouter(store, win?): () => void`
  - `resetAppStore(overrides?: Partial<AppState>): void` (test helper)
- Règles de transition :
  - `requestZone` est ignoré si une transition est en cours ou si la zone demandée est déjà active.
  - Il y a vol (`stage: 'flight'`) seulement si `via` est fourni, que la zone actuelle est `office`, que `reducedMotion` est faux, que WebGL est `ok` et que le mode lecture est désactivé ; sinon, fondu direct.
  - `transitionStep` : `flight` → `fade` → zone changée et `transition = null`.
  - Arriver au bureau remet `railTarget = 0`, `activeTopic = null`, `dialogue = null`, `menuOpen = false`.
- Note : le spec parle de `railT` ; le store porte la **cible** `railTarget` (0 = vue d'ensemble, 1 = vue présentation). La valeur animée vit dans la caméra (Tâche 15), pour éviter 60 mises à jour du store par seconde.

- [ ] **Step 1: Écrire le test du store qui échoue `src/core/store.test.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import { makeTopic } from '../test/fixtures'
import { memoryStorage } from '../test/memoryStorage'
import { PROGRESS_KEY, SETTINGS_KEY } from './progress'
import { createAppStore, type AppState } from './store'

const alpha = makeTopic({ id: 'alpha', next: 'beta' })
const beta = makeTopic({ id: 'beta' })
const topics: Record<string, typeof alpha> = { alpha, beta }

function setup(options: { reducedMotion?: boolean } = {}) {
  const storage = memoryStorage()
  const store = createAppStore({ getTopic: (_lang, id) => topics[id], storage, reducedMotion: options.reducedMotion })
  return { store, storage, s: () => store.getState() }
}

function toChoices(store: StoreApi<AppState>) {
  for (let i = 0; i < 40 && store.getState().dialogue?.phase !== 'choices'; i++) store.getState().advanceDialogue()
}

describe('zones and transitions', () => {
  it('flies, then fades, then switches zone', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    expect(s().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
    s().transitionStep()
    expect(s().transition?.stage).toBe('fade')
    s().transitionStep()
    expect(s().zone).toBe('workshop')
    expect(s().transition).toBeNull()
  })

  it('fades directly without an object, with reduced motion or in reading mode', () => {
    const plain = setup()
    plain.s().requestZone('dungeon')
    expect(plain.s().transition).toEqual({ to: 'dungeon', via: null, stage: 'fade' })

    const reduced = setup({ reducedMotion: true })
    reduced.s().requestZone('dungeon', 'tv')
    expect(reduced.s().transition).toEqual({ to: 'dungeon', via: null, stage: 'fade' })

    const reading = setup()
    reading.s().setReadingMode(true)
    reading.s().requestZone('workshop', 'laptop')
    expect(reading.s().transition?.stage).toBe('fade')
  })

  // Review focus 2: double clicks or a second object during a flight.
  it('ignores new requests while a transition runs', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().requestZone('dungeon', 'tv')
    s().requestZone('workshop', 'laptop')
    expect(s().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
    s().transitionStep()
    s().transitionStep()
    s().transitionStep()
    expect(s().zone).toBe('workshop')
    expect(s().transition).toBeNull()
  })

  it('ignores a request for the current zone', () => {
    const { s } = setup()
    s().requestZone('office', 'laptop')
    expect(s().transition).toBeNull()
  })

  it('arriving at the office resets the view', () => {
    const { s } = setup()
    s().openTopic('alpha')
    s().requestZone('workshop')
    s().transitionStep()
    s().requestZone('office')
    s().transitionStep()
    expect(s()).toMatchObject({ zone: 'office', railTarget: 0, activeTopic: null, dialogue: null, menuOpen: false })
  })
})

describe('rail', () => {
  it('clamps the target and remembers the first scroll', () => {
    const { s } = setup()
    expect(s().hasScrolled).toBe(false)
    s().nudgeRail(0.4)
    expect(s().railTarget).toBeCloseTo(0.4)
    expect(s().hasScrolled).toBe(true)
    s().nudgeRail(5)
    expect(s().railTarget).toBe(1)
    s().setRailTarget(-3)
    expect(s().railTarget).toBe(0)
  })

  it('opening the menu moves to the presentation view', () => {
    const { s } = setup()
    s().openMenu()
    expect(s()).toMatchObject({ menuOpen: true, railTarget: 1 })
    s().closeMenu()
    expect(s().menuOpen).toBe(false)
  })
})

describe('topics and dialogue', () => {
  it('ignores unknown topics', () => {
    const { s } = setup()
    s().openTopic('ghost')
    expect(s().activeTopic).toBeNull()
  })

  it('opens a topic, records the first visit and persists it', () => {
    const { s, storage } = setup()
    s().openMenu()
    s().openTopic('alpha')
    expect(s()).toMatchObject({ activeTopic: 'alpha', menuOpen: false, railTarget: 1 })
    expect(s().dialogue).toEqual({ topicId: 'alpha', section: 'basics', beatIndex: 0, phase: 'typing' })
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!).firstVisitDone).toBe(true)
  })

  it('marks basics then deeper as seen', () => {
    const { store, s, storage } = setup()
    s().openTopic('alpha')
    toChoices(store)
    expect(s().progress.topicsSeen).toEqual(['alpha'])
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!).topicsSeen).toEqual(['alpha'])
    s().choose({ kind: 'deeper' })
    expect(s().dialogue?.section).toBe('deeper')
    toChoices(store)
    expect(s().progress.deeperSeen).toEqual(['alpha'])
  })

  it('next opens the next topic, all goes back to the menu', () => {
    const { store, s } = setup()
    s().openTopic('alpha')
    toChoices(store)
    s().choose({ kind: 'next', topicId: 'beta' })
    expect(s().activeTopic).toBe('beta')
    toChoices(store)
    s().choose({ kind: 'all' })
    expect(s()).toMatchObject({ activeTopic: null, dialogue: null, menuOpen: true })
  })

  it('finishTyping moves to the waiting phase', () => {
    const { s } = setup()
    s().openTopic('alpha')
    s().finishTyping()
    expect(s().dialogue?.phase).toBe('waiting')
  })
})

describe('settings and 3D status', () => {
  it('persists sound and language', () => {
    const { s, storage } = setup()
    s().setSound(false)
    s().setLang('en')
    expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ sound: false, lang: 'en' })
  })

  it('a lost WebGL context switches to reading mode and cancels transitions', () => {
    const { s } = setup()
    s().requestZone('workshop', 'laptop')
    s().reportWebglLost()
    expect(s()).toMatchObject({ webgl: 'unavailable', webglLost: true, readingMode: true, transition: null })
  })

  it('counts pokes on Ada and tracks hover and the expand overlay', () => {
    const { s } = setup()
    s().pokeAda()
    s().pokeAda()
    s().setHovered('laptop')
    s().setExpandOpen(true)
    expect(s()).toMatchObject({ adaPokes: 2, hovered: 'laptop', expandOpen: true })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/core/store.test.ts`
Expected: FAIL (`./store` introuvable).

- [ ] **Step 3: Créer `src/core/store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { getContent } from '../content/load'
import type { Topic } from '../content/schema'
import * as engine from '../dialogue/engine'
import type { Choice, DialogueState } from '../dialogue/engine'
import {
  loadProgress,
  loadSettings,
  markSeen,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
  type StorageLike,
} from './progress'

export type ZoneId = 'office' | 'workshop' | 'dungeon'
export const ZONES: readonly ZoneId[] = ['office', 'workshop', 'dungeon']
export type Via = 'laptop' | 'tv'
export type HoverTarget = 'laptop' | 'tv' | 'ada'

export interface Transition {
  to: ZoneId
  via: Via | null
  stage: 'flight' | 'fade'
}

export interface AppState {
  zone: ZoneId
  transition: Transition | null
  railTarget: number
  hasScrolled: boolean
  activeTopic: string | null
  menuOpen: boolean
  dialogue: DialogueState | null
  progress: Progress
  settings: Settings
  webgl: 'ok' | 'unavailable'
  webglLost: boolean
  readingMode: boolean
  reducedMotion: boolean
  sceneReady: boolean
  hovered: HoverTarget | null
  adaPokes: number
  expandOpen: boolean

  requestZone: (to: ZoneId, via?: Via) => void
  transitionStep: () => void
  setRailTarget: (t: number) => void
  nudgeRail: (delta: number) => void
  openMenu: () => void
  closeMenu: () => void
  openTopic: (id: string) => void
  finishTyping: () => void
  advanceDialogue: () => void
  choose: (choice: Choice) => void
  closeTopic: () => void
  setSound: (on: boolean) => void
  setLang: (lang: string) => void
  setReadingMode: (on: boolean) => void
  setWebgl: (status: 'ok' | 'unavailable') => void
  reportWebglLost: () => void
  setSceneReady: (ready: boolean) => void
  setHovered: (target: HoverTarget | null) => void
  pokeAda: () => void
  setExpandOpen: (open: boolean) => void
}

export interface StoreDeps {
  getTopic: (lang: string, id: string) => Topic | undefined
  storage?: StorageLike | null
  reducedMotion?: boolean
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function createAppStore(deps: StoreDeps): StoreApi<AppState> {
  const { getTopic, storage } = deps
  return createStore<AppState>()((set, get) => {
    const topicFor = (id: string) => getTopic(get().settings.lang, id)
    const setProgress = (next: Progress) => {
      if (next === get().progress) return
      set({ progress: next })
      saveProgress(next, storage)
    }
    const setSettings = (next: Settings) => {
      set({ settings: next })
      saveSettings(next, storage)
    }

    return {
      zone: 'office',
      transition: null,
      railTarget: 0,
      hasScrolled: false,
      activeTopic: null,
      menuOpen: false,
      dialogue: null,
      progress: loadProgress(storage),
      settings: loadSettings(storage),
      webgl: 'ok',
      webglLost: false,
      readingMode: false,
      reducedMotion: deps.reducedMotion ?? false,
      sceneReady: false,
      hovered: null,
      adaPokes: 0,
      expandOpen: false,

      requestZone: (to, via) => {
        const s = get()
        if (s.transition || to === s.zone) return
        const canFly = via !== undefined && s.zone === 'office' && !s.reducedMotion && s.webgl === 'ok' && !s.readingMode
        set({ transition: { to, via: canFly ? via : null, stage: canFly ? 'flight' : 'fade' }, hovered: null })
      },
      transitionStep: () => {
        const t = get().transition
        if (!t) return
        if (t.stage === 'flight') {
          set({ transition: { ...t, stage: 'fade' } })
          return
        }
        const officeReset =
          t.to === 'office' ? { railTarget: 0, activeTopic: null, dialogue: null, menuOpen: false } : {}
        set({ zone: t.to, transition: null, expandOpen: false, ...officeReset })
      },
      setRailTarget: (t) => set({ railTarget: clamp01(t) }),
      nudgeRail: (delta) => set({ railTarget: clamp01(get().railTarget + delta), hasScrolled: true }),
      openMenu: () => set({ menuOpen: true, railTarget: 1 }),
      closeMenu: () => set({ menuOpen: false }),
      openTopic: (id) => {
        const topic = topicFor(id)
        if (!topic) return
        set({ activeTopic: id, dialogue: engine.start(topic), menuOpen: false, railTarget: 1, expandOpen: false })
        const progress = get().progress
        if (!progress.firstVisitDone) setProgress({ ...progress, firstVisitDone: true })
      },
      finishTyping: () => {
        const dialogue = get().dialogue
        if (dialogue) set({ dialogue: engine.finishTyping(dialogue) })
      },
      advanceDialogue: () => {
        const dialogue = get().dialogue
        if (!dialogue) return
        const topic = topicFor(dialogue.topicId)
        if (!topic) return
        const result = engine.advance(dialogue, topic)
        set({ dialogue: result.state })
        if (result.completed) {
          setProgress(markSeen(get().progress, result.completed.topicId, result.completed.section))
        }
      },
      choose: (choice) => {
        if (choice.kind === 'next') {
          get().openTopic(choice.topicId)
          return
        }
        if (choice.kind === 'all') {
          get().closeTopic()
          return
        }
        const dialogue = get().dialogue
        const topic = dialogue ? topicFor(dialogue.topicId) : undefined
        if (dialogue && topic) set({ dialogue: engine.chooseDeeper(dialogue, topic) })
      },
      closeTopic: () => set({ activeTopic: null, dialogue: null, expandOpen: false, menuOpen: true }),
      setSound: (on) => setSettings({ ...get().settings, sound: on }),
      setLang: (lang) => setSettings({ ...get().settings, lang }),
      setReadingMode: (on) => set({ readingMode: on, hovered: null }),
      setWebgl: (status) => set({ webgl: status }),
      reportWebglLost: () => set({ webgl: 'unavailable', webglLost: true, readingMode: true, transition: null }),
      setSceneReady: (ready) => set({ sceneReady: ready }),
      setHovered: (target) => set({ hovered: target }),
      pokeAda: () => set({ adaPokes: get().adaPokes + 1 }),
      setExpandOpen: (open) => set({ expandOpen: open }),
    }
  })
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export const appStore = createAppStore({
  getTopic: (lang, id) => getContent(lang).topicById.get(id),
  reducedMotion: prefersReducedMotion(),
})

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector)
}
```

- [ ] **Step 4: Lancer le test du store**

Run: `npx vitest run src/core/store.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Créer `src/test/resetAppStore.ts`**

```ts
import { appStore, type AppState } from '../core/store'

const initial = appStore.getState()

/** Restores the shared store between component tests. */
export function resetAppStore(overrides: Partial<AppState> = {}) {
  appStore.setState({ ...initial, ...overrides }, true)
}
```

- [ ] **Step 6: Écrire le test du routeur qui échoue `src/core/router.test.ts`**

```ts
import { makeTopic } from '../test/fixtures'
import { memoryStorage } from '../test/memoryStorage'
import { formatHash, parseHash, startRouter } from './router'
import { createAppStore } from './store'

describe('parseHash', () => {
  it.each([
    ['', { zone: 'office', topic: null }],
    ['#/office', { zone: 'office', topic: null }],
    ['#/workshop', { zone: 'workshop', topic: null }],
    ['#/dungeon', { zone: 'dungeon', topic: null }],
    ['#/office?topic=tokens', { zone: 'office', topic: 'tokens' }],
    ['#/office?topic=', { zone: 'office', topic: null }],
    ['#/dungeon?topic=tokens', { zone: 'dungeon', topic: null }],
    ['#/nope', { zone: 'office', topic: null }],
    ['#garbage??', { zone: 'office', topic: null }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })
})

test('formatHash', () => {
  expect(formatHash({ zone: 'office', topic: null })).toBe('#/office')
  expect(formatHash({ zone: 'office', topic: 'tokens' })).toBe('#/office?topic=tokens')
  expect(formatHash({ zone: 'workshop', topic: 'tokens' })).toBe('#/workshop')
})

describe('startRouter', () => {
  const alpha = makeTopic({ id: 'alpha' })
  const newStore = () =>
    createAppStore({ getTopic: (_lang, id) => (id === 'alpha' ? alpha : undefined), storage: memoryStorage() })
  let stop: () => void = () => {}

  afterEach(() => {
    stop()
    stop = () => {}
    window.history.replaceState(null, '', '#')
  })

  it('opens the zone from the initial hash', () => {
    window.history.replaceState(null, '', '#/dungeon')
    const store = newStore()
    stop = startRouter(store)
    expect(store.getState().zone).toBe('dungeon')
    expect(window.location.hash).toBe('#/dungeon')
  })

  it('opens a deep-linked topic', () => {
    window.history.replaceState(null, '', '#/office?topic=alpha')
    const store = newStore()
    stop = startRouter(store)
    expect(store.getState().activeTopic).toBe('alpha')
    expect(window.location.hash).toBe('#/office?topic=alpha')
  })

  // Review focus 4: hand-edited or stale URLs.
  it('lands on the office overview for unknown topics or zones', () => {
    for (const hash of ['#/office?topic=ghost', '#/nowhere', '#%%%']) {
      window.history.replaceState(null, '', hash)
      const store = newStore()
      stop()
      stop = startRouter(store)
      expect(store.getState()).toMatchObject({ zone: 'office', activeTopic: null, railTarget: 0 })
      expect(window.location.hash).toBe('#/office')
    }
  })

  it('pushes a history entry once the zone has changed', () => {
    window.history.replaceState(null, '', '#/office')
    const store = newStore()
    stop = startRouter(store)
    const before = window.history.length
    store.getState().requestZone('workshop', 'laptop')
    expect(window.location.hash).toBe('#/office')
    store.getState().transitionStep()
    store.getState().transitionStep()
    expect(window.location.hash).toBe('#/workshop')
    expect(window.history.length).toBe(before + 1)
  })

  it('keeps the topic in the URL without adding history entries', () => {
    window.history.replaceState(null, '', '#/office')
    const store = newStore()
    stop = startRouter(store)
    const before = window.history.length
    store.getState().openTopic('alpha')
    expect(window.location.hash).toBe('#/office?topic=alpha')
    expect(window.history.length).toBe(before)
  })

  it('follows the back button, even when pressed twice during a transition', () => {
    window.history.replaceState(null, '', '#/workshop')
    const store = newStore()
    stop = startRouter(store)
    window.history.replaceState(null, '', '#/office')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(store.getState().transition).toEqual({ to: 'office', via: null, stage: 'fade' })
    window.dispatchEvent(new PopStateEvent('popstate'))
    store.getState().transitionStep()
    expect(store.getState().zone).toBe('office')
    expect(store.getState().transition).toBeNull()
    expect(window.location.hash).toBe('#/office')
  })
})
```

- [ ] **Step 7: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/core/router.test.ts`
Expected: FAIL (`./router` introuvable).

- [ ] **Step 8: Créer `src/core/router.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import { ZONES, type AppState, type ZoneId } from './store'

export interface Route {
  zone: ZoneId
  topic: string | null
}

const isZone = (value: string): value is ZoneId => (ZONES as readonly string[]).includes(value)

export function parseHash(hash: string): Route {
  const match = hash.replace(/^#/, '').match(/^\/([a-z]+)(?:\?(.*))?$/)
  const zone = match && isZone(match[1]) ? match[1] : 'office'
  let topic: string | null = null
  if (zone === 'office' && match?.[2]) {
    try {
      topic = new URLSearchParams(match[2]).get('topic') || null
    } catch {
      topic = null
    }
  }
  return { zone, topic }
}

export function formatHash(route: Route): string {
  const query = route.zone === 'office' && route.topic ? `?topic=${encodeURIComponent(route.topic)}` : ''
  return `#/${route.zone}${query}`
}

/** Keeps the URL hash and the store in sync. Returns a cleanup function. */
export function startRouter(store: StoreApi<AppState>, win: Window = window): () => void {
  const currentHash = () => {
    const s = store.getState()
    return formatHash({ zone: s.zone, topic: s.zone === 'office' ? s.activeTopic : null })
  }

  const initial = parseHash(win.location.hash)
  if (initial.zone !== 'office') store.setState({ zone: initial.zone })
  else if (initial.topic) store.getState().openTopic(initial.topic)
  win.history.replaceState(null, '', currentHash())

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.transition) return
    const hash = currentHash()
    if (hash === win.location.hash) return
    if (state.zone !== previous.zone) win.history.pushState(null, '', hash)
    else win.history.replaceState(null, '', hash)
  })

  const onNavigate = () => {
    const route = parseHash(win.location.hash)
    const s = store.getState()
    if (route.zone !== s.zone) {
      s.requestZone(route.zone)
      return
    }
    if (route.zone === 'office' && route.topic && route.topic !== s.activeTopic) s.openTopic(route.topic)
  }
  win.addEventListener('popstate', onNavigate)
  win.addEventListener('hashchange', onNavigate)

  return () => {
    unsubscribe()
    win.removeEventListener('popstate', onNavigate)
    win.removeEventListener('hashchange', onNavigate)
  }
}
```

- [ ] **Step 9: Lancer tous les tests**

Run: `npx vitest run`
Expected: PASS (dont 9 + 1 + 6 tests du routeur).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: zustand app store with guarded transitions and hash router

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Coquille de l'application (zones, canvas, fondu, erreurs, chargement)

**Files:**
- Create: `src/app/zones.ts`, `src/app/ZoneOverlayHost.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/Fader.tsx`, `src/app/LoadingScreen.tsx`, `src/app/SceneReadySignal.tsx`, `src/app/webgl.ts`, `src/app/Stage.tsx`, `src/ui/Logo.tsx`, `src/ui/ComingSoon.tsx`, `src/zones/workshop/index.tsx`, `src/zones/dungeon/index.tsx`, `src/zones/office/index.ts`, `src/zones/office/OfficeScene.tsx`, `src/zones/office/OfficeOverlay.tsx`
- Modify: `src/app/App.tsx` (remplacé), `src/main.tsx`, `src/styles/app.css` (ajouts)
- Test: `src/app/App.test.tsx` (remplacé), `src/app/ErrorBoundary.test.tsx`, `src/app/Fader.test.tsx`

**Interfaces:**
- Consumes: `appStore`, `useApp`, `ZoneId`, `startRouter` (Tâche 7) ; `initI18n`, `resolveLang`, `i18n` (Tâche 3) ; `Button`, `brand` (Tâche 2).
- Produces:
  - `interface ZoneModule { id: ZoneId; Scene?: ComponentType; Overlay?: ComponentType }`, `loadZone(id: 'workshop' | 'dungeon'): Promise<ZoneModule>`
  - `officeZone`, `workshopZone`, `dungeonZone` (`ZoneModule`)
  - `ErrorBoundary` (props `zone: ZoneId`, `onError?(error)`, `children`) ; `Fader` + `FADE_MS = 350` ; `LoadingScreen` ; `SceneReadySignal` ; `Stage` ; `ZoneOverlayHost` ; `detectWebGL2(doc?: Document): boolean`
  - `Logo` (props `className?`, `title?`) ; `ComingSoon` (props `title`, `body`)
  - `OfficeScene` et `OfficeOverlay` provisoires (remplis par les Tâches 9 et 16)

- [ ] **Step 1: Écrire les tests qui échouent**

`src/app/App.test.tsx` (remplace le test de la Tâche 1) :

```tsx
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { App } from './App'
import { detectWebGL2 } from './webgl'

beforeEach(() => resetAppStore({ webgl: 'unavailable' }))

// Lazy zones suspend on use(): the render must be awaited inside act() for React 19 to resolve them.
async function renderApp() {
  await act(async () => {
    render(<App />)
  })
}

test('shows the workshop placeholder and returns to the office', async () => {
  appStore.setState({ zone: 'workshop' })
  await renderApp()
  expect(await screen.findByRole('heading', { name: 'Prompt Workshop' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Back to the office/ }))
  await waitFor(() => expect(appStore.getState().zone).toBe('office'), { timeout: 2000 })
})

test('shows the dungeon placeholder', async () => {
  appStore.setState({ zone: 'dungeon' })
  await renderApp()
  expect(await screen.findByRole('heading', { name: 'The Dungeon' })).toBeInTheDocument()
  expect(screen.getByText('Coming soon')).toHaveClass('at-script')
})

test('does not mount the 3D stage without WebGL', () => {
  render(<App />)
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
})

test('detectWebGL2 reflects canvas support', () => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
  spy.mockReturnValue(null)
  expect(detectWebGL2()).toBe(false)
  spy.mockReturnValue({} as RenderingContext)
  expect(detectWebGL2()).toBe(true)
  spy.mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(detectWebGL2()).toBe(false)
  spy.mockRestore()
})
```

`src/app/ErrorBoundary.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('boom')
}

let errorSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

test('a crashed zone shows a recovery card that returns to the office', async () => {
  resetAppStore({ zone: 'workshop' })
  const onError = vi.fn()
  render(
    <ErrorBoundary zone="workshop" onError={onError}>
      <Boom />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  expect(onError).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  expect(appStore.getState().transition?.to).toBe('office')
})

test('a crashed office falls back to reading mode', async () => {
  resetAppStore()
  render(
    <ErrorBoundary zone="office">
      <Boom />
    </ErrorBoundary>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Back to the office' }))
  expect(appStore.getState().readingMode).toBe(true)
})
```

`src/app/Fader.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { FADE_MS, Fader } from './Fader'

afterEach(() => vi.useRealTimers())

test('covers the screen, switches zone after the fade, then uncovers', () => {
  vi.useFakeTimers()
  resetAppStore()
  appStore.getState().requestZone('workshop')
  render(<Fader />)
  expect(screen.getByTestId('fader')).toHaveClass('is-on')
  act(() => {
    vi.advanceTimersByTime(FADE_MS)
  })
  expect(appStore.getState().zone).toBe('workshop')
  expect(screen.getByTestId('fader')).not.toHaveClass('is-on')
})

test('does nothing during a camera flight', () => {
  vi.useFakeTimers()
  resetAppStore()
  appStore.getState().requestZone('workshop', 'laptop')
  render(<Fader />)
  expect(screen.getByTestId('fader')).not.toHaveClass('is-on')
  act(() => {
    vi.advanceTimersByTime(FADE_MS * 3)
  })
  expect(appStore.getState().transition?.stage).toBe('flight')
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/app`
Expected: FAIL (modules manquants).

- [ ] **Step 3: Créer `src/ui/Logo.tsx`**

```tsx
/** The five-square brand mark. Dark squares use currentColor so the mark stays visible on dark surfaces. */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 78"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="0" y="0" width="28" height="28" fill="#4DDBB8" />
      <rect x="32" y="0" width="28" height="28" fill="currentColor" />
      <rect x="40" y="34" width="8" height="8" fill="currentColor" />
      <rect x="0" y="46" width="28" height="32" fill="#58FC73" />
      <rect x="32" y="46" width="28" height="32" fill="#58FC73" />
    </svg>
  )
}
```

- [ ] **Step 4: Créer `src/app/webgl.ts`**

```ts
export function detectWebGL2(doc: Document = document): boolean {
  try {
    return doc.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Créer `src/app/Fader.tsx`**

```tsx
import { useEffect } from 'react'
import { useApp } from '../core/store'

export const FADE_MS = 350

export function Fader() {
  const fading = useApp((s) => s.transition?.stage === 'fade')
  const reduced = useApp((s) => s.reducedMotion)
  const transitionStep = useApp((s) => s.transitionStep)

  useEffect(() => {
    if (!fading) return
    const id = window.setTimeout(transitionStep, reduced ? 0 : FADE_MS)
    return () => window.clearTimeout(id)
  }, [fading, reduced, transitionStep])

  return <div className={`fader${fading ? ' is-on' : ''}`} data-testid="fader" aria-hidden="true" />
}
```

- [ ] **Step 6: Créer `src/app/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, type ZoneId } from '../core/store'
import { Button } from '../ui/Button'

interface Props {
  zone: ZoneId
  onError?: (error: unknown) => void
  children: ReactNode
}

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorCard zone={this.props.zone} onRecover={() => this.setState({ failed: false })} />
  }
}

function ErrorCard({ zone, onRecover }: { zone: ZoneId; onRecover: () => void }) {
  const { t } = useTranslation()
  const recover = () => {
    const state = appStore.getState()
    if (zone === 'office') state.setReadingMode(true)
    else state.requestZone('office')
    onRecover()
  }
  return (
    <div className="error-card panel at-card at-card--raised" role="alert">
      <h2 className="at-h2">{t('errors.generic')}</h2>
      <p className="at-lede">{t('errors.genericBody')}</p>
      <Button variant="primary" onClick={recover}>
        {t('zones.back')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 7: Créer `src/app/LoadingScreen.tsx` et `src/app/SceneReadySignal.tsx`**

`src/app/LoadingScreen.tsx` :

```tsx
import { useProgress } from '@react-three/drei'
import { useTranslation } from 'react-i18next'
import { Logo } from '../ui/Logo'

export function LoadingScreen() {
  const { t } = useTranslation()
  const { active, progress } = useProgress()
  return (
    <div className="loading" role="status" aria-live="polite">
      <Logo className="loading__logo" />
      <p className="loading__text">{t('app.loading')}</p>
      <div className="loading__bar">
        <div
          className={`loading__fill${active ? '' : ' is-indeterminate'}`}
          style={active ? { width: `${Math.round(progress)}%` } : undefined}
        />
      </div>
    </div>
  )
}
```

`src/app/SceneReadySignal.tsx` :

```tsx
import { useFrame } from '@react-three/fiber'
import { appStore } from '../core/store'

/** Flags the scene as ready once the first frame has rendered. */
export function SceneReadySignal() {
  useFrame(() => {
    const state = appStore.getState()
    if (!state.sceneReady) state.setSceneReady(true)
  })
  return null
}
```

- [ ] **Step 8: Créer `src/ui/ComingSoon.tsx` et les zones provisoires**

`src/ui/ComingSoon.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { useApp } from '../core/store'
import { Button } from './Button'

export function ComingSoon({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()
  const requestZone = useApp((s) => s.requestZone)
  return (
    <section className="coming-soon panel" aria-labelledby="coming-soon-title">
      <div className="coming-soon__card at-card at-card--raised">
        <p className="at-kicker">{t('app.name')}</p>
        <h1 id="coming-soon-title" className="at-h1">
          {title}
        </h1>
        <p className="at-script coming-soon__script">{t('zones.soonLabel')}</p>
        <p className="at-lede">{body}</p>
        <Button variant="primary" onClick={() => requestZone('office')}>
          {t('zones.back')} <span className="arr" aria-hidden="true">→</span>
        </Button>
      </div>
    </section>
  )
}
```

`src/zones/workshop/index.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import type { ZoneModule } from '../../app/zones'
import { ComingSoon } from '../../ui/ComingSoon'

function WorkshopSoon() {
  const { t } = useTranslation()
  return <ComingSoon title={t('zones.workshop.title')} body={t('zones.workshop.soon')} />
}

export const workshopZone: ZoneModule = { id: 'workshop', Overlay: WorkshopSoon }
```

`src/zones/dungeon/index.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import type { ZoneModule } from '../../app/zones'
import { ComingSoon } from '../../ui/ComingSoon'

function DungeonSoon() {
  const { t } = useTranslation()
  return <ComingSoon title={t('zones.dungeon.title')} body={t('zones.dungeon.soon')} />
}

export const dungeonZone: ZoneModule = { id: 'dungeon', Overlay: DungeonSoon }
```

`src/zones/office/OfficeScene.tsx` (provisoire, remplacé par la Tâche 16) :

```tsx
import { brand } from '../../core/brand'

export function OfficeScene() {
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <ambientLight intensity={0.6} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color={brand.surface2} />
      </mesh>
    </>
  )
}
```

`src/zones/office/OfficeOverlay.tsx` (provisoire, remplacé par la Tâche 9) :

```tsx
export function OfficeOverlay() {
  return null
}
```

`src/zones/office/index.ts` :

```ts
import type { ZoneModule } from '../../app/zones'
import { OfficeOverlay } from './OfficeOverlay'
import { OfficeScene } from './OfficeScene'

export const officeZone: ZoneModule = { id: 'office', Scene: OfficeScene, Overlay: OfficeOverlay }
```

- [ ] **Step 9: Créer `src/app/zones.ts` et `src/app/ZoneOverlayHost.tsx`**

`src/app/zones.ts` :

```ts
import type { ComponentType } from 'react'
import type { ZoneId } from '../core/store'

export interface ZoneModule {
  id: ZoneId
  /** Rendered inside the shared Canvas (used by the dungeon, spec 3). */
  Scene?: ComponentType
  /** DOM rendered above the Canvas. */
  Overlay?: ComponentType
}

type LazyZoneId = Exclude<ZoneId, 'office'>

const loaders: Record<LazyZoneId, () => Promise<ZoneModule>> = {
  workshop: () => import('../zones/workshop').then((m) => m.workshopZone),
  dungeon: () => import('../zones/dungeon').then((m) => m.dungeonZone),
}

const cache = new Map<LazyZoneId, Promise<ZoneModule>>()

export function loadZone(id: LazyZoneId): Promise<ZoneModule> {
  let promise = cache.get(id)
  if (!promise) {
    promise = loaders[id]()
    cache.set(id, promise)
  }
  return promise
}
```

`src/app/ZoneOverlayHost.tsx` :

```tsx
import { Suspense, use } from 'react'
import { useApp } from '../core/store'
import { officeZone } from '../zones/office'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingScreen } from './LoadingScreen'
import { loadZone } from './zones'

function LazyOverlay({ id }: { id: 'workshop' | 'dungeon' }) {
  const zone = use(loadZone(id))
  const Overlay = zone.Overlay
  return Overlay ? <Overlay /> : null
}

export function ZoneOverlayHost() {
  const zone = useApp((s) => s.zone)
  const OfficeOverlay = officeZone.Overlay!
  return (
    <ErrorBoundary key={zone} zone={zone}>
      {zone === 'office' ? (
        <OfficeOverlay />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <LazyOverlay id={zone} />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}
```

- [ ] **Step 10: Créer `src/app/Stage.tsx`**

```tsx
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { appStore, useApp } from '../core/store'
import { OfficeScene } from '../zones/office/OfficeScene'
import { SceneReadySignal } from './SceneReadySignal'

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop={active ? 'always' : 'demand'}
        camera={{ fov: 45, near: 0.1, far: 60, position: [1.2, 2.3, 5.6] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault()
              appStore.getState().reportWebglLost()
            },
            { once: true },
          )
        }}
      >
        <SceneReadySignal />
        <Suspense fallback={null}>
          <OfficeScene />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 11: Remplacer `src/app/App.tsx`**

```tsx
import { appStore, useApp } from '../core/store'
import { ErrorBoundary } from './ErrorBoundary'
import { Fader } from './Fader'
import { LoadingScreen } from './LoadingScreen'
import { Stage } from './Stage'
import { ZoneOverlayHost } from './ZoneOverlayHost'

export function App() {
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const showLoading = useApp((s) => s.zone === 'office' && !s.sceneReady)
  return (
    <div className="app">
      {threeD && (
        <ErrorBoundary zone="office" onError={() => appStore.getState().reportWebglLost()}>
          <Stage />
        </ErrorBoundary>
      )}
      <div className="overlay">
        <ZoneOverlayHost />
      </div>
      {threeD && showLoading && <LoadingScreen />}
      <Fader />
    </div>
  )
}
```

- [ ] **Step 12: Mettre à jour `src/main.tsx`**

Remplacer tout le fichier :

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './brand/oe-tokens.css'
import './brand/athena.css'
import './styles/app.css'
import { App } from './app/App'
import { detectWebGL2 } from './app/webgl'
import { i18n, initI18n, resolveLang } from './core/i18n'
import { startRouter } from './core/router'
import { appStore } from './core/store'

initI18n(appStore.getState().settings.lang)
appStore.getState().setWebgl(detectWebGL2() ? 'ok' : 'unavailable')
startRouter(appStore)
appStore.subscribe((state, previous) => {
  if (state.settings.lang !== previous.settings.lang) void i18n.changeLanguage(resolveLang(state.settings.lang))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 13: Ajouter les styles de la coquille à la fin de `src/styles/app.css`**

```css
.fader {
  position: absolute; inset: 0; z-index: 50; background: var(--at-ink);
  opacity: 0; pointer-events: none; transition: opacity 350ms var(--oe-ease);
}
.fader.is-on { opacity: 1; pointer-events: auto; }

.loading {
  position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; background: var(--at-ink); color: var(--at-on-dark);
}
.loading__logo { width: 48px; height: auto; }
.loading__text { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--at-on-dark-2); }
.loading__bar { width: 220px; height: 3px; overflow: hidden; border-radius: var(--oe-radius-pill); background: var(--at-hairline); }
.loading__fill { height: 100%; background: var(--oe-lime); transition: width 200ms var(--oe-ease); }
.loading__fill.is-indeterminate { width: 40%; animation: loading-slide 1.1s var(--oe-ease) infinite; }
@keyframes loading-slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }

.coming-soon { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--at-ink); }
.coming-soon__card { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; max-width: 620px; padding: 48px; }
.coming-soon__script { margin: 0; font-size: 28px; }

.error-card {
  position: absolute; top: 50%; left: 50%; z-index: 30; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: flex-start; gap: 14px; max-width: 520px;
}
```

- [ ] **Step 14: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous, dont les 4 + 2 + 2 nouveaux).

- [ ] **Step 15: Vérifier dans le navigateur**

Run: `npm run dev` (en arrière-plan), puis ouvrir `http://localhost:5173/` dans le navigateur intégré.
Expected :
- un sol gris foncé en perspective ;
- l'écran de chargement disparaît ;
- aucune erreur dans la console ;
- `http://localhost:5173/#/workshop` affiche la carte « Prompt Workshop », et « Back to the office » ramène au bureau après un fondu.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: app shell with shared canvas, zone overlays, fader and error boundaries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Interface du bureau (HUD, accueil, menu des sujets, dialogue)

**Files:**
- Create: `src/core/dom.ts`, `src/core/selectors.ts`, `src/ui/Icons.tsx`, `src/ui/Hud.tsx`, `src/ui/SmallScreenNotice.tsx`, `src/ui/useTypewriter.ts`, `src/ui/DialogueBox.tsx`, `src/ui/TopicMenu.tsx`, `src/ui/WelcomeBar.tsx`, `src/ui/overlay.css`
- Modify: `src/zones/office/OfficeOverlay.tsx` (remplacé), `src/app/App.tsx` (HUD + notice)
- Test: `src/ui/useTypewriter.test.ts`, `src/ui/DialogueBox.test.tsx`, `src/ui/TopicMenu.test.tsx`, `src/ui/Hud.test.tsx`, `src/ui/WelcomeBar.test.tsx`, `src/ui/SmallScreenNotice.test.tsx`

**Interfaces:**
- Consumes: `appStore`, `useApp` (Tâche 7) ; `getContent` (Tâche 5) ; moteur de dialogue (Tâche 6) ; `languages`, `resolveLang` (Tâche 3) ; `Button`, `Logo`.
- Produces:
  - `isEditable(target: EventTarget | null): boolean`, `isButtonLike(target: EventTarget | null): boolean`
  - `useContent(): LangContent`, `useActiveTopic(): Topic | null`, `useCurrentBeat(): Beat | null`, `useScreenRef(): ScreenRef | null`
  - `CHARS_PER_SECOND = 45`, `revealedCount(elapsedMs, length, cps?): number`, `useTypewriter(text, { active, onDone, onReveal? }): number`
  - `TypedLine` (props `text`, `active`, `onDone`, `onReveal?(char, index)`), exporté par `DialogueBox.tsx` (la Tâche 19 y branche le son)
  - Composants `Hud`, `SmallScreenNotice` (`MIN_WIDTH = 1280`, `MIN_HEIGHT = 720`), `WelcomeBar`, `TopicMenu` (prop `embedded?: boolean`), `DialogueBox`, `OfficeOverlay`
  - Classe CSS `.bottom-panel` (panneau centré en bas) ; attributs de test `data-testid="dialogue-line"` (texte tapé) et `data-testid="progress"` (compteur)

- [ ] **Step 1: Créer `src/core/dom.ts` et `src/core/selectors.ts`**

`src/core/dom.ts` :

```ts
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function isButtonLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName) || target.getAttribute('role') === 'button'
}
```

`src/core/selectors.ts` :

```ts
import { getContent, type LangContent } from '../content/load'
import type { Beat, ScreenRef, Topic } from '../content/schema'
import { currentBeat, screenAt } from '../dialogue/engine'
import { useApp } from './store'

export function useContent(): LangContent {
  const lang = useApp((s) => s.settings.lang)
  return getContent(lang)
}

export function useActiveTopic(): Topic | null {
  const id = useApp((s) => s.activeTopic)
  const content = useContent()
  return id ? (content.topicById.get(id) ?? null) : null
}

export function useCurrentBeat(): Beat | null {
  const dialogue = useApp((s) => s.dialogue)
  const topic = useActiveTopic()
  return dialogue && topic ? currentBeat(dialogue, topic) : null
}

export function useScreenRef(): ScreenRef | null {
  const dialogue = useApp((s) => s.dialogue)
  const topic = useActiveTopic()
  return dialogue && topic ? screenAt(dialogue, topic) : null
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`src/ui/useTypewriter.test.ts` :

```ts
import { CHARS_PER_SECOND, revealedCount } from './useTypewriter'

test('reveals characters at a steady pace and never overshoots', () => {
  expect(revealedCount(0, 100)).toBe(0)
  expect(revealedCount(1000, 100)).toBe(CHARS_PER_SECOND)
  expect(revealedCount(60_000, 100)).toBe(100)
  expect(revealedCount(500, 10, 10)).toBe(5)
})
```

`src/ui/DialogueBox.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from './DialogueBox'

const topic = getContent('en').topicById.get('what-is-ai')!
const lineButton = () => screen.getByRole('button', { name: 'Click or press Space to continue' })

function open() {
  act(() => appStore.getState().openTopic('what-is-ai'))
}

function toChoices() {
  act(() => {
    for (let i = 0; i < 40 && appStore.getState().dialogue?.phase !== 'choices'; i++) {
      appStore.getState().advanceDialogue()
    }
  })
}

beforeEach(() => resetAppStore())
afterEach(() => vi.useRealTimers())

test('types the line, reveals it on click, then advances', async () => {
  vi.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  open()
  render(<DialogueBox />)
  act(() => {
    vi.advanceTimersByTime(200)
  })
  const partial = screen.getByTestId('dialogue-line').textContent ?? ''
  expect(partial.length).toBeGreaterThan(0)
  expect(partial.length).toBeLessThan(topic.basics[0].say.length)
  await user.click(lineButton())
  expect(screen.getByTestId('dialogue-line')).toHaveTextContent(topic.basics[0].say)
  await user.click(lineButton())
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('exposes the full line to screen readers', () => {
  open()
  render(<DialogueBox />)
  expect(screen.getByText(topic.basics[0].say, { selector: '.sr-only' })).toHaveAttribute('aria-live', 'polite')
})

// Review focus 3: one key press, one action.
test('Space on the focused line advances exactly once', async () => {
  const user = userEvent.setup()
  open()
  act(() => appStore.getState().finishTyping())
  render(<DialogueBox />)
  lineButton().focus()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 1, phase: 'typing' })
})

test('Space with focus elsewhere uses the global shortcut', async () => {
  const user = userEvent.setup()
  open()
  render(<DialogueBox />)
  ;(document.activeElement as HTMLElement | null)?.blur()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 0, phase: 'waiting' })
})

test('Enter on a focused choice triggers only that choice', async () => {
  const user = userEvent.setup()
  open()
  toChoices()
  render(<DialogueBox />)
  screen.getByRole('button', { name: 'Go deeper' }).focus()
  await user.keyboard('{Enter}')
  expect(appStore.getState().dialogue).toMatchObject({ section: 'deeper', beatIndex: 0, phase: 'typing' })
})

test('shows the takeaway and the choices at the end of the basics', () => {
  open()
  toChoices()
  render(<DialogueBox />)
  expect(screen.getByText(topic.takeaway)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Go deeper' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'All topics' })).toBeInTheDocument()
  expect(appStore.getState().progress.topicsSeen).toContain('what-is-ai')
})

test('Escape closes the topic and reopens the menu', async () => {
  const user = userEvent.setup()
  open()
  render(<DialogueBox />)
  await user.keyboard('{Escape}')
  expect(appStore.getState()).toMatchObject({ activeTopic: null, menuOpen: true })
})

test('keys are ignored while the expanded view is open', async () => {
  const user = userEvent.setup()
  open()
  act(() => appStore.getState().setExpandOpen(true))
  render(<DialogueBox />)
  ;(document.activeElement as HTMLElement | null)?.blur()
  await user.keyboard(' ')
  expect(appStore.getState().dialogue?.phase).toBe('typing')
})

test('reduced motion shows the whole line at once', () => {
  resetAppStore({ reducedMotion: true })
  open()
  render(<DialogueBox />)
  expect(appStore.getState().dialogue?.phase).toBe('waiting')
  expect(screen.getByTestId('dialogue-line')).toHaveTextContent(topic.basics[0].say)
})
```

`src/ui/TopicMenu.test.tsx` :

```tsx
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { TopicMenu } from './TopicMenu'

const content = getContent('en')

beforeEach(() => resetAppStore({ menuOpen: true }))

test('lists chapters as tabs and topics as buttons', async () => {
  render(<TopicMenu />)
  const tabs = screen.getAllByRole('tab')
  expect(tabs).toHaveLength(content.chapters.length)
  expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  expect(appStore.getState().activeTopic).toBe('what-is-ai')
})

test('marks seen topics', () => {
  act(() => appStore.setState({ progress: { ...appStore.getState().progress, topicsSeen: ['what-is-ai'] } }))
  render(<TopicMenu />)
  const pill = screen.getByRole('button', { name: /What is AI\?/ })
  expect(within(pill).getByLabelText('Seen')).toBeInTheDocument()
})

test('close button and Escape close the menu', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<TopicMenu />)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(appStore.getState().menuOpen).toBe(false)
  unmount()
  act(() => appStore.getState().openMenu())
  render(<TopicMenu />)
  await user.keyboard('{Escape}')
  expect(appStore.getState().menuOpen).toBe(false)
})

test('the embedded menu has no close button', () => {
  render(<TopicMenu embedded />)
  expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
})
```

`src/ui/Hud.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { Hud } from './Hud'

const total = getContent('en').topics.length

beforeEach(() => resetAppStore())

test('shows the site name and the progress counter', () => {
  render(<Hud />)
  expect(screen.getByText('Athena Prompt Academy')).toBeInTheDocument()
  expect(screen.getByTestId('progress')).toHaveTextContent(`0/${total} topics`)
  act(() => appStore.setState({ progress: { ...appStore.getState().progress, topicsSeen: ['what-is-ai', 'ghost'] } }))
  expect(screen.getByTestId('progress')).toHaveTextContent(`1/${total} topics`)
})

test('toggles sound', async () => {
  render(<Hud />)
  const button = screen.getByRole('button', { name: 'Sound on' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(button)
  expect(appStore.getState().settings.sound).toBe(false)
  expect(screen.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false')
})

test('toggles reading mode only when 3D is available', async () => {
  const { unmount } = render(<Hud />)
  await userEvent.click(screen.getByRole('button', { name: 'Reading mode' }))
  expect(appStore.getState().readingMode).toBe(true)
  expect(screen.getByRole('button', { name: '3D mode' })).toBeInTheDocument()
  unmount()
  resetAppStore({ webgl: 'unavailable' })
  render(<Hud />)
  expect(screen.queryByRole('button', { name: 'Reading mode' })).not.toBeInTheDocument()
})

test('offers the available languages', () => {
  render(<Hud />)
  expect(screen.getByRole('combobox', { name: /Language/ })).toHaveValue('en')
})
```

`src/ui/WelcomeBar.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { WelcomeBar } from './WelcomeBar'

beforeEach(() => resetAppStore())

test('learn opens the topic menu in the presentation view', async () => {
  render(<WelcomeBar />)
  await userEvent.click(screen.getByRole('button', { name: /Learn the basics/ }))
  expect(appStore.getState()).toMatchObject({ menuOpen: true, railTarget: 1 })
})

test('workshop and dungeon buttons fly to their objects', async () => {
  render(<WelcomeBar />)
  await userEvent.click(screen.getByRole('button', { name: 'Prompt workshop' }))
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})

test('first-visit hints disappear once scrolled and once a topic was opened', () => {
  render(<WelcomeBar />)
  expect(screen.getByText('Scroll to take a seat')).toBeInTheDocument()
  expect(screen.getByText(/the laptop and the old console are clickable/)).toBeInTheDocument()
  act(() => appStore.getState().nudgeRail(0.1))
  expect(screen.queryByText('Scroll to take a seat')).not.toBeInTheDocument()
  act(() => appStore.getState().openTopic('what-is-ai'))
  expect(screen.queryByText(/the laptop and the old console are clickable/)).not.toBeInTheDocument()
})
```

`src/ui/SmallScreenNotice.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import { SmallScreenNotice } from './SmallScreenNotice'

function resize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

test('warns below 1280 × 720 and hides again on a large window', () => {
  resize(1000, 700)
  render(<SmallScreenNotice />)
  expect(screen.getByRole('status')).toHaveTextContent('This experience works best on a larger screen.')
  act(() => resize(1600, 900))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/ui`
Expected: FAIL (modules manquants).

- [ ] **Step 4: Créer `src/ui/useTypewriter.ts`**

```ts
import { useEffect, useRef, useState } from 'react'

export const CHARS_PER_SECOND = 45

export function revealedCount(elapsedMs: number, length: number, cps = CHARS_PER_SECOND): number {
  return Math.min(length, Math.floor((elapsedMs / 1000) * cps))
}

interface Options {
  active: boolean
  onDone: () => void
  onReveal?: (char: string, index: number) => void
}

/** Returns how many characters of `text` are visible. Inactive means the whole text. */
export function useTypewriter(text: string, { active, onDone, onReveal }: Options): number {
  const [count, setCount] = useState(active ? 0 : text.length)
  const callbacks = useRef({ onDone, onReveal })
  callbacks.current = { onDone, onReveal }

  useEffect(() => {
    if (!active) {
      setCount(text.length)
      return
    }
    setCount(0)
    const startedAt = Date.now()
    let shown = 0
    const id = window.setInterval(() => {
      const next = revealedCount(Date.now() - startedAt, text.length)
      for (let i = shown; i < next; i++) callbacks.current.onReveal?.(text[i], i)
      shown = next
      setCount(next)
      if (next >= text.length) {
        window.clearInterval(id)
        callbacks.current.onDone()
      }
    }, 1000 / 60)
    return () => window.clearInterval(id)
  }, [text, active])

  return count
}
```

- [ ] **Step 5: Créer `src/ui/Icons.tsx`**

```tsx
export function CheckIcon({ label }: { label: string }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" role="img" aria-label={label}>
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DeepIcon({ label }: { label: string }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" role="img" aria-label={label}>
      <path d="M4 5l4 4 4-4M4 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
```

- [ ] **Step 6: Créer `src/ui/DialogueBox.tsx`**

```tsx
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { isButtonLike, isEditable } from '../core/dom'
import { useActiveTopic, useContent } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { choicesFor, currentBeat, type Choice } from '../dialogue/engine'
import { Button } from './Button'
import { useTypewriter } from './useTypewriter'
import './overlay.css'

export function TypedLine({
  text,
  active,
  onDone,
  onReveal,
}: {
  text: string
  active: boolean
  onDone: () => void
  onReveal?: (char: string, index: number) => void
}) {
  const count = useTypewriter(text, { active, onDone, onReveal })
  return (
    <span className="dialogue__text" data-testid="dialogue-line" aria-hidden="true">
      {text.slice(0, count)}
    </span>
  )
}

export function DialogueBox() {
  const { t } = useTranslation()
  const topic = useActiveTopic()
  const content = useContent()
  const dialogue = useApp((s) => s.dialogue)
  const reduced = useApp((s) => s.reducedMotion)
  const hasDialogue = dialogue !== null

  useEffect(() => {
    if (!hasDialogue) return
    const onKey = (event: KeyboardEvent) => {
      const state = appStore.getState()
      if (state.expandOpen || isEditable(event.target)) return
      if (event.key === 'Escape') {
        state.closeTopic()
        return
      }
      if ((event.key === ' ' || event.key === 'Enter') && !isButtonLike(event.target)) {
        event.preventDefault()
        state.advanceDialogue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasDialogue])

  useEffect(() => {
    if (reduced && dialogue?.phase === 'typing') appStore.getState().finishTyping()
  }, [reduced, dialogue])

  if (!dialogue || !topic) return null
  const beat = currentBeat(dialogue, topic)
  const choices = choicesFor(dialogue, topic, new Set(content.topicById.keys()))
  const { advanceDialogue, finishTyping, setExpandOpen } = appStore.getState()

  return (
    <section className="dialogue bottom-panel panel at-card at-card--raised" aria-label={t('objects.ada')}>
      <header className="dialogue__head">
        <span className="at-kicker">{topic.title}</span>
        <div className="dialogue__tools">
          <Button size="sm" variant="solid" onClick={() => setExpandOpen(true)}>
            {t('screen.expand')}
          </Button>
        </div>
      </header>
      <button type="button" className="dialogue__line" onClick={advanceDialogue} aria-label={t('dialogue.continueHint')}>
        <span className="dialogue__speaker" aria-hidden="true">
          {t('objects.ada')}
        </span>
        <TypedLine
          key={`${dialogue.topicId}-${dialogue.section}-${dialogue.beatIndex}`}
          text={beat.say}
          active={dialogue.phase === 'typing' && !reduced}
          onDone={finishTyping}
        />
      </button>
      <p className="sr-only" aria-live="polite">
        {beat.say}
      </p>
      {dialogue.phase !== 'choices' && (
        <p className="dialogue__hint" aria-hidden="true">
          {t('dialogue.continueHint')}
        </p>
      )}
      {dialogue.phase === 'choices' && (
        <div className="dialogue__choices">
          <p className="dialogue__takeaway">
            <strong>{t('dialogue.takeaway')}</strong> {topic.takeaway}
          </p>
          <div className="dialogue__buttons">
            {choices.map((choice, index) => (
              <ChoiceButton key={choice.kind} choice={choice} primary={index === 0 && choice.kind !== 'all'} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ChoiceButton({ choice, primary }: { choice: Choice; primary: boolean }) {
  const { t } = useTranslation()
  const content = useContent()
  const label =
    choice.kind === 'deeper'
      ? t('dialogue.deeper')
      : choice.kind === 'next'
        ? t('dialogue.nextTopic', { title: content.topicById.get(choice.topicId)?.title ?? '' })
        : t('dialogue.allTopics')
  return (
    <Button variant={primary ? 'primary' : 'ghost'} size="sm" onClick={() => appStore.getState().choose(choice)}>
      {label}
    </Button>
  )
}
```

- [ ] **Step 7: Créer `src/ui/TopicMenu.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isEditable } from '../core/dom'
import { useContent } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import { CheckIcon, DeepIcon } from './Icons'
import './overlay.css'

export function TopicMenu({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation()
  const content = useContent()
  const seen = useApp((s) => s.progress.topicsSeen)
  const deeperSeen = useApp((s) => s.progress.deeperSeen)
  const [chapterId, setChapterId] = useState(content.chapters[0]?.id)
  const chapter = content.chapters.find((c) => c.id === chapterId) ?? content.chapters[0]

  useEffect(() => {
    if (embedded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isEditable(event.target)) appStore.getState().closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [embedded])

  return (
    <section
      className={`topic-menu panel at-card at-card--raised${embedded ? ' topic-menu--embedded' : ' bottom-panel'}`}
      aria-labelledby="topic-menu-title"
    >
      <header className="topic-menu__head">
        <h2 id="topic-menu-title" className="at-h2">
          {t('topics.menuTitle')}
        </h2>
        {!embedded && (
          <Button size="sm" variant="ghost" onClick={() => appStore.getState().closeMenu()}>
            {t('screen.close')}
          </Button>
        )}
      </header>
      <div role="tablist" className="topic-menu__tabs">
        {content.chapters.map((c, index) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === chapter?.id}
            className="topic-menu__tab"
            onClick={() => setChapterId(c.id)}
          >
            <span className="num">{String(index + 1).padStart(2, '0')}</span>
            {c.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="topic-menu__list">
        {chapter?.topics.map((id) => {
          const topic = content.topicById.get(id)
          if (!topic) return null
          return (
            <button
              key={id}
              type="button"
              className={`topic-pill${seen.includes(id) ? ' is-seen' : ''}`}
              onClick={() => appStore.getState().openTopic(id)}
            >
              <span className="topic-pill__title">{topic.title}</span>
              <span className="topic-pill__teaser">{topic.teaser}</span>
              <span className="topic-pill__marks">
                {seen.includes(id) && <CheckIcon label={t('topics.seen')} />}
                {deeperSeen.includes(id) && <DeepIcon label={t('topics.deeperSeen')} />}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Créer `src/ui/WelcomeBar.tsx`, `src/ui/Hud.tsx`, `src/ui/SmallScreenNotice.tsx`**

`src/ui/WelcomeBar.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import './overlay.css'

export function WelcomeBar() {
  const { t } = useTranslation()
  const firstVisit = useApp((s) => !s.progress.firstVisitDone)
  const hasScrolled = useApp((s) => s.hasScrolled)
  const { openMenu, requestZone } = appStore.getState()
  return (
    <section className="welcome bottom-panel panel at-card at-card--raised" aria-label={t('app.name')}>
      <p className="welcome__greeting">
        <span className="dialogue__speaker">{t('objects.ada')}</span>
        {t('welcome.greeting')}
      </p>
      {firstVisit && <p className="welcome__hint">{t('welcome.clickableHint')}</p>}
      <div className="welcome__actions">
        <Button variant="primary" onClick={openMenu}>
          {t('welcome.learn')} <span className="arr" aria-hidden="true">→</span>
        </Button>
        <Button variant="ghost" onClick={() => requestZone('workshop', 'laptop')}>
          {t('welcome.workshop')}
        </Button>
        <Button variant="ghost" onClick={() => requestZone('dungeon', 'tv')}>
          {t('welcome.dungeon')}
        </Button>
      </div>
      {firstVisit && !hasScrolled && (
        <p className="welcome__scroll" aria-hidden="true">
          {t('welcome.scrollHint')}
        </p>
      )}
    </section>
  )
}
```

`src/ui/Hud.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { languages, resolveLang } from '../core/i18n'
import { useContent } from '../core/selectors'
import { appStore, useApp } from '../core/store'
import { Button } from './Button'
import { Logo } from './Logo'
import './overlay.css'

export function Hud() {
  const { t } = useTranslation()
  const content = useContent()
  const seen = useApp((s) => s.progress.topicsSeen)
  const sound = useApp((s) => s.settings.sound)
  const lang = useApp((s) => s.settings.lang)
  const readingMode = useApp((s) => s.readingMode)
  const webglOk = useApp((s) => s.webgl === 'ok')
  const { setSound, setLang, setReadingMode } = appStore.getState()
  const seenCount = content.topics.filter((topic) => seen.includes(topic.id)).length

  return (
    <header className="hud panel">
      <div className="hud__brand">
        <Logo className="hud__logo" />
        <span className="hud__name">{t('app.name')}</span>
      </div>
      <div className="hud__tools">
        <span className="hud__progress" data-testid="progress">
          {t('hud.progress', { seen: seenCount, total: content.topics.length })}
        </span>
        {webglOk && (
          <Button size="sm" variant="solid" onClick={() => setReadingMode(!readingMode)}>
            {readingMode ? t('hud.exitReadingMode') : t('hud.readingMode')}
          </Button>
        )}
        <Button size="sm" variant="solid" aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? t('hud.soundOn') : t('hud.soundOff')}
        </Button>
        <label className="hud__lang">
          <span className="sr-only">{t('hud.language')}</span>
          <select value={resolveLang(lang)} onChange={(event) => setLang(event.target.value)}>
            {languages.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  )
}
```

`src/ui/SmallScreenNotice.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './overlay.css'

export const MIN_WIDTH = 1280
export const MIN_HEIGHT = 720

const isSmall = () => window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT

export function SmallScreenNotice() {
  const { t } = useTranslation()
  const [small, setSmall] = useState(isSmall)
  useEffect(() => {
    const onResize = () => setSmall(isSmall())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  if (!small) return null
  return (
    <p className="small-screen panel" role="status">
      {t('app.smallScreen')}
    </p>
  )
}
```

- [ ] **Step 9: Créer `src/ui/overlay.css`**

```css
.hud { position: absolute; top: 18px; left: 24px; right: 24px; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.hud__brand { display: flex; align-items: center; gap: 12px; color: var(--at-on-dark); }
.hud__logo { width: 22px; height: auto; color: var(--at-on-dark); }
.hud__name { font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
.hud__tools { display: flex; align-items: center; gap: 10px; }
.hud__progress { margin-right: 6px; font-size: 13px; font-weight: 700; color: var(--at-on-dark-2); font-variant-numeric: tabular-nums; }
.hud__lang select {
  height: 38px; padding: 0 14px; border-radius: var(--oe-radius-pill); border: 1px solid var(--at-hairline);
  background: rgba(255, 255, 255, 0.07); color: var(--at-on-dark); font: inherit; font-size: 13px; font-weight: 700;
}

.small-screen {
  position: absolute; top: 72px; left: 50%; z-index: 20; transform: translateX(-50%); margin: 0; padding: 10px 16px;
  border-radius: var(--oe-radius-md); border: 1px solid var(--at-hairline-2); background: var(--at-surface-2); font-size: 13px;
}

.bottom-panel { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); width: min(880px, calc(100vw - 48px)); }

.dialogue__speaker { margin-right: 12px; font-size: 12px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--oe-lime); }

.welcome { display: flex; flex-direction: column; gap: 12px; }
.welcome__greeting { margin: 0; font-size: 17px; line-height: 1.5; }
.welcome__hint { margin: 0; font-size: 14px; color: var(--at-on-dark-2); }
.welcome__actions { display: flex; flex-wrap: wrap; gap: 12px; }
.welcome__scroll {
  position: absolute; left: 50%; top: -34px; transform: translateX(-50%); margin: 0; white-space: nowrap;
  font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--at-on-dark-2);
  animation: hint-pulse 2.4s var(--oe-ease) infinite;
}
@keyframes hint-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

.dialogue__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.dialogue__line {
  display: block; width: 100%; min-height: 3.3em; padding: 4px 0; border: 0; background: none; cursor: pointer;
  color: var(--at-on-dark); font: inherit; font-size: 18px; line-height: 1.55; text-align: left;
}
.dialogue__hint { margin: 6px 0 0; font-size: 12px; color: var(--at-on-dark-3); }
.dialogue__choices { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--at-hairline); }
.dialogue__takeaway { margin: 0 0 12px; color: var(--at-on-dark-2); }
.dialogue__takeaway strong { margin-right: 6px; color: var(--at-on-dark); }
.dialogue__buttons { display: flex; flex-wrap: wrap; gap: 10px; }

.topic-menu { display: flex; flex-direction: column; max-height: min(56vh, 540px); }
.topic-menu--embedded { max-height: none; }
.topic-menu__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.topic-menu__tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
.topic-menu__tab {
  height: 34px; padding: 0 14px; border-radius: var(--oe-radius-pill); border: 1px solid var(--at-hairline);
  background: transparent; color: var(--at-on-dark-2); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
}
.topic-menu__tab[aria-selected='true'] { border-color: var(--at-hairline-2); background: rgba(255, 255, 255, 0.08); color: var(--at-on-dark); }
.topic-menu__tab .num { margin-right: 8px; color: var(--oe-lime); font-variant-numeric: tabular-nums; }
.topic-menu__list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; overflow-y: auto; }
.topic-pill {
  position: relative; padding: 14px 52px 14px 16px; border-radius: var(--oe-radius-md); border: 1px solid var(--at-hairline);
  background: var(--at-surface-2); color: var(--at-on-dark); font: inherit; text-align: left; cursor: pointer;
  transition: border-color var(--oe-dur-1) var(--oe-ease), background var(--oe-dur-1) var(--oe-ease);
}
.topic-pill:hover { border-color: var(--oe-lime); background: var(--at-surface-3); }
.topic-pill__title { display: block; font-weight: 700; }
.topic-pill__teaser { display: block; margin-top: 2px; font-size: 13px; color: var(--at-on-dark-2); }
.topic-pill__marks { position: absolute; top: 12px; right: 12px; display: flex; gap: 4px; color: var(--oe-lime); }
.icon { width: 16px; height: 16px; }
```

- [ ] **Step 10: Remplacer `src/zones/office/OfficeOverlay.tsx` et ajouter le HUD dans `App`**

`src/zones/office/OfficeOverlay.tsx` :

```tsx
import { useApp } from '../../core/store'
import { DialogueBox } from '../../ui/DialogueBox'
import { TopicMenu } from '../../ui/TopicMenu'
import { WelcomeBar } from '../../ui/WelcomeBar'

export function OfficeOverlay() {
  const activeTopic = useApp((s) => s.activeTopic)
  const menuOpen = useApp((s) => s.menuOpen)
  const inTransition = useApp((s) => s.transition !== null)
  if (inTransition) return null
  if (activeTopic) return <DialogueBox />
  if (menuOpen) return <TopicMenu />
  return <WelcomeBar />
}
```

Dans `src/app/App.tsx`, ajouter les imports :

```tsx
import { Hud } from '../ui/Hud'
import { SmallScreenNotice } from '../ui/SmallScreenNotice'
```

et placer les deux composants juste après le bloc `<div className="overlay">…</div>` :

```tsx
      <div className="overlay">
        <ZoneOverlayHost />
      </div>
      <Hud />
      <SmallScreenNotice />
```

- [ ] **Step 11: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous).

- [ ] **Step 12: Vérifier dans le navigateur**

Run: `npm run dev` puis ouvrir `http://localhost:5173/`.
Expected :
- le HUD en haut et la barre d'accueil d'Ada en bas ;
- « Learn the basics » ouvre le menu ;
- « What is AI? » lance le dialogue lettre par lettre, et Espace avance ;
- à la fin, la phrase-clé s'affiche avec « Go deeper » et « All topics », et le compteur passe à « 1/1 topics ».

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: office overlay UI with HUD, welcome bar, topic menu and typed dialogue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Contenu de l'écran mural, vue agrandie et 4 premiers visuels

**Files:**
- Create: `src/visuals/parts.tsx`, `src/visuals/registry.ts`, `src/visuals/ScreenContent.tsx`, `src/visuals/FitScreen.tsx`, `src/visuals/visuals.css`, `src/visuals/topics/WhatIsAi.tsx`, `src/visuals/topics/GenerativeAi.tsx`, `src/visuals/topics/Llm.tsx`, `src/visuals/topics/Tokens.tsx`, `src/ui/ExpandOverlay.tsx`
- Modify: `content/en/visuals.json` (remplacé), `src/zones/office/OfficeOverlay.tsx`, `src/ui/overlay.css` (ajout)
- Test: `src/visuals/visuals.test.tsx`, `src/ui/ExpandOverlay.test.tsx`

**Interfaces:**
- Consumes: `visualManifest`, `VisualId`, `isVisualId` (Tâche 5) ; `ScreenRef` (Tâche 5) ; `useScreenRef` (Tâche 9) ; `Logo`, `Button` ; i18n namespace `visuals`.
- Produces:
  - `interface VisualProps { step: number }`, `on(active: boolean): string` (renvoie `' is-on'` ou `''`), `VisualShell` (props `id: VisualId`, `children`)
  - `visualComponents: Partial<Record<VisualId, ComponentType<VisualProps>>>` (complété en `Record` par la Tâche 11)
  - `ScreenContent` (props `screen: ScreenRef | null`) : racine `.screen-root` 1280 × 720, `data-testid="screen-content"`, écran d'accueil si aucun visuel
  - `FitScreen` (props `width?`, `height?`, `children`) : met un contenu 1280 × 720 à l'échelle de son conteneur
  - `SAMPLE_TEXT`, `SAMPLE_TOKENS` (exportés par `topics/Tokens.tsx`)
  - `ExpandOverlay` (vue agrandie, `role="dialog"`)
- Règles CSS des visuels : taille de texte minimale 22 px dans le repère 1280 × 720 ; ne jamais mettre `.vz-reveal` sur un élément qui a déjà son propre `transform` (l'envelopper dans un `div`).

- [ ] **Step 1: Remplacer `content/en/visuals.json`**

```json
{
  "idle": {
    "kicker": "Welcome",
    "title": "Athena Prompt Academy",
    "tagline": "Learn to talk to AI"
  },
  "what-is-ai": {
    "kicker": "The basics",
    "title": "AI is a family of ideas",
    "description": "Four nested circles: artificial intelligence contains machine learning, which contains deep learning, which contains generative AI.",
    "ai": { "name": "Artificial intelligence", "text": "Machines doing tasks that usually need human thinking" },
    "ml": { "name": "Machine learning", "text": "Learns patterns from examples, not fixed rules" },
    "dl": { "name": "Deep learning", "text": "Many stacked layers: a neural network" },
    "gen": { "name": "Generative AI", "text": "Creates new text, images and sound" }
  },
  "generative-ai": {
    "kicker": "The basics",
    "title": "Recognize or create",
    "description": "Left: classic AI looks at a cat photo and labels it cat, 98%. Right: generative AI turns the words a cat reading the newspaper into a brand new picture.",
    "classic": "Classic AI recognizes",
    "classicLabel": "cat · 98%",
    "gen": "Generative AI creates",
    "prompt": "A cat reading the newspaper",
    "caption": "It learned from millions of examples – now it makes new ones."
  },
  "llm": {
    "kicker": "The basics",
    "title": "A very well-read autocomplete",
    "description": "The sentence The cat sat on the, with the likely next words: mat 62%, sofa 18%, floor 11%, moon 1%. The model picks mat, then repeats the process.",
    "sentence": "The cat sat on the",
    "options": { "mat": "mat", "sofa": "sofa", "floor": "floor", "moon": "moon" },
    "again": "…then it does it again, word after word.",
    "large": "Large: trained on a huge library of text",
    "model": "Language model: predicts what comes next"
  },
  "tokens": {
    "kicker": "How it works",
    "title": "AI reads in chunks",
    "description": "The sentence Prompting is a skill you can learn is split into 9 tokens, for 35 characters. Tokens drive cost, speed and memory limits.",
    "count": "{{tokens}} tokens · {{chars}} characters",
    "rule": "In English, 1 token is about ¾ of a word",
    "why": {
      "title": "Why it matters",
      "cost": "Cost is counted in tokens",
      "speed": "More tokens, slower answers",
      "memory": "Memory limits are measured in tokens"
    }
  }
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`src/visuals/visuals.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { flattenKeys, resources } from '../core/i18n'
import { visualManifest, type VisualId } from './manifest'
import { visualComponents } from './registry'
import { ScreenContent } from './ScreenContent'
import { SAMPLE_TEXT, SAMPLE_TOKENS } from './topics/Tokens'

const registered = Object.keys(visualComponents) as VisualId[]
const visualKeys = new Set(flattenKeys(resources.en.visuals))

describe.each(registered)('visual %s', (id) => {
  it('has a kicker, a title and a description', () => {
    for (const key of ['kicker', 'title', 'description']) expect(visualKeys.has(`${id}.${key}`)).toBe(true)
  })

  it.each(Array.from({ length: visualManifest[id].steps }, (_, i) => i + 1))(
    'renders step %i without missing text',
    (step) => {
      const { container } = render(<ScreenContent screen={{ visualId: id, step }} />)
      expect(container.querySelector(`.vz--${id}`)).not.toBeNull()
      // i18next returns the key itself when a translation is missing.
      expect(container.textContent).not.toMatch(new RegExp(`${id}\\.[a-zA-Z]`))
    },
  )
})

test('the idle screen shows when there is no visual', () => {
  render(<ScreenContent screen={null} />)
  expect(screen.getByText('Learn to talk to AI')).toHaveClass('at-script')
})

test('an unknown visual falls back to the idle screen', () => {
  render(<ScreenContent screen={{ visualId: 'nope', step: 1 }} />)
  expect(screen.getByText('Learn to talk to AI')).toBeInTheDocument()
})

test('the screen exposes a text description of the visual', () => {
  render(<ScreenContent screen={{ visualId: 'what-is-ai', step: 1 }} />)
  expect(screen.getByText(/Four nested circles/)).toHaveClass('sr-only')
})

test('the tokens sample matches the real o200k tokenizer', async () => {
  const { encode, decode } = await import('gpt-tokenizer/encoding/o200k_base')
  expect(encode(SAMPLE_TEXT).map((id) => decode([id]))).toEqual([...SAMPLE_TOKENS])
  expect(SAMPLE_TOKENS.join('')).toBe(SAMPLE_TEXT)
})
```

`src/ui/ExpandOverlay.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { ExpandOverlay } from './ExpandOverlay'

beforeEach(() => {
  resetAppStore()
  act(() => {
    appStore.getState().openTopic('what-is-ai')
    appStore.getState().setExpandOpen(true)
  })
})

test('shows the current visual with the close button focused', () => {
  render(<ExpandOverlay />)
  expect(screen.getByRole('dialog', { name: 'Expand' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  expect(document.querySelector('.vz--what-is-ai')).not.toBeNull()
})

test('closes with Escape or the close button', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<ExpandOverlay />)
  await user.keyboard('{Escape}')
  expect(appStore.getState().expandOpen).toBe(false)
  unmount()
  act(() => appStore.getState().setExpandOpen(true))
  render(<ExpandOverlay />)
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(appStore.getState().expandOpen).toBe(false)
})
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/visuals src/ui/ExpandOverlay.test.tsx`
Expected: FAIL (modules manquants).

- [ ] **Step 4: Créer `src/visuals/parts.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VisualId } from './manifest'
import './visuals.css'

export interface VisualProps {
  step: number
}

export const on = (active: boolean) => (active ? ' is-on' : '')

export function VisualShell({ id, children }: { id: VisualId; children: ReactNode }) {
  const { t } = useTranslation('visuals')
  return (
    <div className={`vz vz--${id}`}>
      <header className="vz__head">
        <p className="at-kicker">{t(`${id}.kicker`)}</p>
        <h3 className="vz__title at-script">{t(`${id}.title`)}</h3>
      </header>
      <div className="vz__body">{children}</div>
    </div>
  )
}
```

- [ ] **Step 5: Créer les 4 visuels**

`src/visuals/topics/WhatIsAi.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const RINGS = [
  { key: 'ai', r: 230, at: 1 },
  { key: 'ml', r: 172, at: 2 },
  { key: 'dl', r: 114, at: 3 },
  { key: 'gen', r: 56, at: 4 },
] as const

export function WhatIsAi({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="what-is-ai">
      <div className="vz-row">
        <svg className="vz-rings" viewBox="-240 -240 480 480" aria-hidden="true">
          {RINGS.map((ring) => (
            <circle
              key={ring.key}
              r={ring.r}
              className={`vz-ring vz-ring--${ring.key}${on(step >= ring.at)}${step === ring.at ? ' is-current' : ''}`}
            />
          ))}
        </svg>
        <ol className="vz-legend">
          {RINGS.map((ring) => (
            <li
              key={ring.key}
              className={`vz-legend__item vz-reveal${on(step >= ring.at)}${step === ring.at ? ' is-current' : ''}`}
            >
              <strong>{t(`what-is-ai.${ring.key}.name`)}</strong>
              <span>{t(`what-is-ai.${ring.key}.text`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/GenerativeAi.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

function PhotoGlyph({ withPaper = false }: { withPaper?: boolean }) {
  return (
    <svg className="vz-photo" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="2" y="2" width="156" height="116" rx="14" className="vz-photo__frame" />
      <path d="M52 92 Q80 44 108 92 Z" className="vz-photo__cat" />
      <circle cx="80" cy="52" r="18" className="vz-photo__cat" />
      <path d="M66 42 L69 26 L76 37 Z M94 42 L91 26 L84 37 Z" className="vz-photo__cat" />
      {withPaper && <rect x="56" y="64" width="48" height="30" rx="3" className="vz-photo__paper" />}
    </svg>
  )
}

export function GenerativeAi({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="generative-ai">
      <div className="vz-gen">
        <div className={`vz-card vz-reveal${on(step >= 1)}`}>
          <p className="vz-label">{t('generative-ai.classic')}</p>
          <div className="vz-gen__io">
            <PhotoGlyph />
            <span className="vz-arrow" aria-hidden="true">→</span>
            <span className="vz-chip">{t('generative-ai.classicLabel')}</span>
          </div>
        </div>
        <div className={`vz-card vz-gen__card--new vz-reveal${on(step >= 2)}`}>
          <p className="vz-label">{t('generative-ai.gen')}</p>
          <div className="vz-gen__io">
            <span className="vz-chip">{t('generative-ai.prompt')}</span>
            <span className="vz-arrow" aria-hidden="true">→</span>
            <PhotoGlyph withPaper />
          </div>
        </div>
        <p className={`vz-caption vz-gen__caption vz-reveal${on(step >= 3)}`}>{t('generative-ai.caption')}</p>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Llm.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const OPTIONS = [
  { key: 'mat', p: 62 },
  { key: 'sofa', p: 18 },
  { key: 'floor', p: 11 },
  { key: 'moon', p: 1 },
] as const

export function Llm({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const chosen = step >= 3
  return (
    <VisualShell id="llm">
      <div className="vz-llm">
        <p className="vz-llm__sentence">
          <span>{t('llm.sentence')}</span>
          {chosen && <span className="vz-chip vz-chip--lime">{t('llm.options.mat')}</span>}
          <span className="vz-llm__blank" aria-hidden="true" />
        </p>
        <ul className={`vz-bars vz-reveal${on(step >= 2)}${chosen ? ' is-dim' : ''}`}>
          {OPTIONS.map((option, index) => (
            <li key={option.key} className={`vz-bars__row${index === 0 ? ' is-top' : ''}`}>
              <span className="vz-bars__word">{t(`llm.options.${option.key}`)}</span>
              <span className="vz-bars__track">
                <span className="vz-bars__fill" style={{ width: `${option.p}%` }} />
              </span>
              <span className="vz-bars__value">{option.p}%</span>
            </li>
          ))}
        </ul>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('llm.again')}</p>
        <div className={`vz-inline vz-reveal${on(step >= 4)}`}>
          <span className="vz-chip">{t('llm.large')}</span>
          <span className="vz-chip">{t('llm.model')}</span>
        </div>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Tokens.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

/** English sample shown in every language: the split below belongs to this exact sentence. */
export const SAMPLE_TEXT = 'Prompting is a skill you can learn.'
/** o200k_base split of SAMPLE_TEXT, checked against the real tokenizer in visuals.test.tsx. */
export const SAMPLE_TOKENS = ['Prompt', 'ing', ' is', ' a', ' skill', ' you', ' can', ' learn', '.'] as const

const WHY = ['cost', 'speed', 'memory'] as const

export function Tokens({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="tokens">
      <div className="vz-tokens">
        <p className="vz-tokens__sentence">
          {step >= 2
            ? SAMPLE_TOKENS.map((token, index) => (
                <span key={index} className={`vz-token vz-token--${index % 2}`}>
                  {token}
                </span>
              ))
            : SAMPLE_TEXT}
        </p>
        <p className={`vz-tokens__count vz-reveal${on(step >= 3)}`}>
          {t('tokens.count', { tokens: SAMPLE_TOKENS.length, chars: SAMPLE_TEXT.length })}
        </p>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('tokens.rule')}</p>
        <div className={`vz-inline vz-reveal${on(step >= 4)}`}>
          <span className="vz-label">{t('tokens.why.title')}</span>
          {WHY.map((key) => (
            <span key={key} className="vz-chip">
              {t(`tokens.why.${key}`)}
            </span>
          ))}
        </div>
      </div>
    </VisualShell>
  )
}
```

- [ ] **Step 6: Créer `src/visuals/registry.ts`, `src/visuals/ScreenContent.tsx`, `src/visuals/FitScreen.tsx`**

`src/visuals/registry.ts` :

```ts
import type { ComponentType } from 'react'
import type { VisualId } from './manifest'
import type { VisualProps } from './parts'
import { GenerativeAi } from './topics/GenerativeAi'
import { Llm } from './topics/Llm'
import { Tokens } from './topics/Tokens'
import { WhatIsAi } from './topics/WhatIsAi'

export const visualComponents: Partial<Record<VisualId, ComponentType<VisualProps>>> = {
  'what-is-ai': WhatIsAi,
  'generative-ai': GenerativeAi,
  llm: Llm,
  tokens: Tokens,
}
```

`src/visuals/ScreenContent.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import type { ScreenRef } from '../content/schema'
import { Logo } from '../ui/Logo'
import { isVisualId } from './manifest'
import { visualComponents } from './registry'
import './visuals.css'

function IdleScreen() {
  const { t } = useTranslation('visuals')
  return (
    <div className="vz-idle">
      <Logo className="vz-idle__logo" />
      <p className="at-kicker">{t('idle.kicker')}</p>
      <h2 className="vz-idle__title">{t('idle.title')}</h2>
      <p className="at-script vz-idle__tagline">{t('idle.tagline')}</p>
    </div>
  )
}

export function ScreenContent({ screen }: { screen: ScreenRef | null }) {
  const { t } = useTranslation('visuals')
  const Visual = screen && isVisualId(screen.visualId) ? visualComponents[screen.visualId] : undefined
  return (
    <div className="screen-root" data-testid="screen-content">
      {Visual && screen ? (
        <>
          <Visual step={screen.step} />
          <p className="sr-only">{t(`${screen.visualId}.description`)}</p>
        </>
      ) : (
        <IdleScreen />
      )}
    </div>
  )
}
```

`src/visuals/FitScreen.tsx` :

```tsx
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Scales fixed-size content (the 1280 × 720 screen) to fit its container. */
export function FitScreen({ width = 1280, height = 720, children }: { width?: number; height?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const { clientWidth, clientHeight } = element
      if (clientWidth > 0 && clientHeight > 0) setScale(Math.min(clientWidth / width, clientHeight / height))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height])

  return (
    <div className="fit-screen" ref={ref}>
      <div className="fit-screen__inner" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Créer `src/visuals/visuals.css`**

```css
.screen-root {
  box-sizing: border-box; width: 1280px; height: 720px; padding: 52px 72px; overflow: hidden;
  background: var(--at-surface-1); color: var(--at-on-dark); font-family: var(--oe-font-ui); font-size: 26px; line-height: 1.35;
}
.fit-screen { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; }
.fit-screen__inner { flex: none; transform-origin: center center; }

.vz { display: flex; flex-direction: column; height: 100%; }
.vz__head { margin-bottom: 26px; }
.vz__head .at-kicker { font-size: 22px; }
.vz__title { margin: 8px 0 0; font-size: 52px; line-height: 1.05; }
.vz__body { display: flex; flex: 1; align-items: center; min-height: 0; }

.vz-reveal { opacity: 0; transform: translateY(12px); transition: opacity 500ms var(--oe-ease), transform 500ms var(--oe-ease); }
.vz-reveal.is-on { opacity: 1; transform: none; }

.vz-row { display: flex; align-items: center; gap: 56px; width: 100%; }
.vz-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.vz-card { padding: 28px 32px; border-radius: 24px; border: 1px solid var(--at-hairline-2); background: var(--at-surface-2); }
.vz-chip {
  display: inline-flex; align-items: center; height: 52px; padding: 0 22px; border-radius: 9999px; white-space: pre;
  border: 1px solid var(--at-hairline-2); background: rgba(255, 255, 255, 0.07); font-size: 24px; font-weight: 700;
}
.vz-chip--lime { border-color: var(--oe-lime); background: var(--oe-lime); color: var(--at-ink); }
.vz-label { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--at-on-dark-2); }
.vz-caption { margin: 0; font-size: 28px; color: var(--at-on-dark-2); }
.vz-note { margin: 0; padding: 16px 22px; border-radius: 18px; border: 1px solid rgba(88, 252, 115, 0.35); background: rgba(88, 252, 115, 0.1); font-size: 24px; }
.vz-arrow { font-size: 40px; color: var(--oe-lime); }
.vz-bubble { max-width: 760px; margin: 0; padding: 22px 28px; border-radius: 24px; font-size: 26px; }
.vz-bubble--user { align-self: flex-end; background: rgba(255, 255, 255, 0.08); }
.vz-bubble--ai { border: 1px solid var(--at-hairline-2); background: var(--at-surface-3); }
.vz-chat { position: relative; display: flex; flex: 1; flex-direction: column; gap: 20px; }

.vz-idle { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 18px; height: 100%; }
.vz-idle__logo { width: 72px; height: auto; color: var(--at-on-dark); }
.vz-idle__title { margin: 0; font-size: 76px; font-weight: 800; line-height: 1.02; letter-spacing: -0.02em; text-transform: uppercase; }
.vz-idle__tagline { margin: 0; font-size: 48px; }

/* what-is-ai */
.vz-rings { flex: none; width: 470px; height: 470px; }
.vz-ring { fill: rgba(255, 255, 255, 0.02); stroke: var(--at-hairline-2); stroke-width: 2; opacity: 0.15; transition: opacity 500ms var(--oe-ease), fill 500ms var(--oe-ease), stroke 500ms var(--oe-ease); }
.vz-ring.is-on { opacity: 1; }
.vz-ring.is-current { stroke: var(--oe-lime); stroke-width: 3; }
.vz-ring--gen.is-on { fill: rgba(88, 252, 115, 0.18); stroke: var(--oe-lime); }
.vz-legend { display: flex; flex-direction: column; gap: 22px; margin: 0; padding: 0; list-style: none; }
.vz-legend__item strong { display: block; font-size: 30px; }
.vz-legend__item span { font-size: 24px; color: var(--at-on-dark-2); }
.vz-legend__item.is-current strong { color: var(--oe-lime); }

/* generative-ai */
.vz-gen { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; width: 100%; }
.vz-gen__io { display: flex; align-items: center; gap: 22px; margin-top: 18px; }
.vz-gen__card--new { border-color: var(--oe-lime); }
.vz-gen__caption { grid-column: 1 / -1; }
.vz-photo { flex: none; width: 190px; height: 142px; }
.vz-photo__frame { fill: var(--at-surface-3); stroke: var(--at-hairline-2); stroke-width: 2; }
.vz-photo__cat { fill: var(--at-on-dark-2); }
.vz-photo__paper { fill: var(--at-on-dark); }

/* llm */
.vz-llm { display: flex; flex-direction: column; gap: 22px; width: 100%; }
.vz-llm__sentence { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 0; font-size: 40px; font-weight: 700; }
.vz-llm__blank { display: inline-block; width: 120px; height: 44px; border-bottom: 4px solid var(--oe-lime); }
.vz-bars { display: flex; flex-direction: column; gap: 10px; max-width: 820px; margin: 0; padding: 0; list-style: none; }
.vz-bars.is-on.is-dim { opacity: 0.45; }
.vz-bars__row { display: grid; grid-template-columns: 140px 1fr 90px; align-items: center; gap: 18px; }
.vz-bars__track { height: 22px; overflow: hidden; border-radius: 9999px; background: rgba(255, 255, 255, 0.06); }
.vz-bars__fill { display: block; height: 100%; border-radius: inherit; background: var(--at-on-dark-3); }
.vz-bars__row.is-top .vz-bars__fill { background: var(--oe-lime); }
.vz-bars__value { text-align: right; font-variant-numeric: tabular-nums; color: var(--at-on-dark-2); }

/* tokens */
.vz-tokens { display: flex; flex-direction: column; gap: 24px; width: 100%; }
.vz-tokens__sentence { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; font-size: 44px; font-weight: 700; }
.vz-token { padding: 6px 12px; border-radius: 12px; white-space: pre; }
.vz-token--0 { background: rgba(77, 219, 184, 0.22); }
.vz-token--1 { background: rgba(88, 252, 115, 0.16); }
.vz-tokens__count { margin: 0; font-size: 34px; font-weight: 800; color: var(--oe-lime); }
```

- [ ] **Step 8: Créer `src/ui/ExpandOverlay.tsx` et ses styles**

`src/ui/ExpandOverlay.tsx` :

```tsx
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useScreenRef } from '../core/selectors'
import { appStore } from '../core/store'
import { FitScreen } from '../visuals/FitScreen'
import { ScreenContent } from '../visuals/ScreenContent'
import { Button } from './Button'
import './overlay.css'

export function ExpandOverlay() {
  const { t } = useTranslation()
  const screen = useScreenRef()
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = () => appStore.getState().setExpandOpen(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') appStore.getState().setExpandOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="expand panel" role="dialog" aria-modal="true" aria-label={t('screen.expand')}>
      <div className="expand__bar">
        <Button ref={closeRef} size="sm" variant="solid" onClick={close}>
          {t('screen.close')}
        </Button>
      </div>
      <div className="expand__stage">
        <FitScreen>
          <ScreenContent screen={screen} />
        </FitScreen>
      </div>
    </div>
  )
}
```

Ajouter à la fin de `src/ui/overlay.css` :

```css
.expand {
  position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; gap: 16px;
  padding: 72px 48px 32px; background: rgba(11, 13, 14, 0.94);
}
.expand__bar { display: flex; justify-content: flex-end; }
.expand__stage { flex: 1; min-height: 0; }
```

- [ ] **Step 9: Afficher la vue agrandie depuis le bureau**

Remplacer `src/zones/office/OfficeOverlay.tsx` :

```tsx
import { useApp } from '../../core/store'
import { DialogueBox } from '../../ui/DialogueBox'
import { ExpandOverlay } from '../../ui/ExpandOverlay'
import { TopicMenu } from '../../ui/TopicMenu'
import { WelcomeBar } from '../../ui/WelcomeBar'

export function OfficeOverlay() {
  const activeTopic = useApp((s) => s.activeTopic)
  const menuOpen = useApp((s) => s.menuOpen)
  const expandOpen = useApp((s) => s.expandOpen)
  const inTransition = useApp((s) => s.transition !== null)
  if (inTransition) return null
  return (
    <>
      {activeTopic ? <DialogueBox /> : menuOpen ? <TopicMenu /> : <WelcomeBar />}
      {activeTopic && expandOpen && <ExpandOverlay />}
    </>
  )
}
```

- [ ] **Step 10: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous ; les tests « renders step » couvrent 4 + 3 + 4 + 4 étapes).

- [ ] **Step 11: Vérifier la vue agrandie dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173/#/office?topic=what-is-ai`, cliquer sur « Expand ».
Expected : le visuel des cercles imbriqués remplit la fenêtre, net et centré ; Espace dans le dialogue n'agit pas tant que la vue agrandie est ouverte ; Échap la ferme.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: wall screen content, expand overlay and first four visuals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Les 9 autres visuels

**Files:**
- Create: `src/visuals/topics/ContextWindow.tsx`, `Hallucinations.tsx`, `Prompt.tsx`, `Multimodal.tsx`, `Agents.tsx`, `Tools.tsx`, `Skills.tsx`, `Mcp.tsx`, `AiSafetyAtWork.tsx`
- Modify: `src/visuals/registry.ts` (remplacé), `content/en/visuals.json` (ajouts), `src/visuals/visuals.css` (ajouts)
- Test: `src/visuals/visuals.test.tsx` (ajout d'un test)

**Interfaces:**
- Consumes: `VisualShell`, `on`, `VisualProps` (Tâche 10).
- Produces: `visualComponents: Record<VisualId, ComponentType<VisualProps>>`, complet pour les 13 identifiants du manifeste.

- [ ] **Step 1: Ajouter le test de complétude qui échoue**

Ajouter à la fin de `src/visuals/visuals.test.tsx` :

```tsx
test('every visual of the manifest has a component', () => {
  expect(Object.keys(visualComponents).sort()).toEqual(Object.keys(visualManifest).sort())
})
```

Run: `npx vitest run src/visuals`
Expected: FAIL (9 identifiants manquants).

- [ ] **Step 2: Ajouter les chaînes à `content/en/visuals.json`**

Ajouter ces entrées de premier niveau après l'entrée `"tokens"` (virgule après l'accolade de `"tokens"`) :

```json
  "context-window": {
    "kicker": "How it works",
    "title": "The context window",
    "description": "A conversation of eight messages. Only the last four fit inside the context window; the first four slide out of view and are forgotten.",
    "window": "Context window",
    "messages": {
      "0": "Hi. I need a slogan for our bakery.",
      "1": "Sure – what makes it special?",
      "2": "We bake everything at night, by hand.",
      "3": "How about: Fresh by dawn, made by hand.",
      "4": "Nice. Now a short social media post?",
      "5": "Here's a draft with three hashtags…",
      "6": "Make it a bit warmer, please.",
      "7": "Done. Remind me – when do you bake?"
    },
    "forgotten": "Out of view means forgotten",
    "caption": "Everything the AI can see at once – measured in tokens.",
    "tip": "Long chat? Start fresh or recap the key points."
  },
  "hallucinations": {
    "kicker": "How it works",
    "title": "Confident is not correct",
    "description": "A user asks who won the 1987 Mars Marathon. The AI confidently gives a name and a time, but the race never existed. Stamp: plausible is not true. Checklist: ask for sources, check key facts, allow I don't know.",
    "question": "Who won the 1987 Mars Marathon?",
    "answer": "Elena Ruiz won it, in 3 hours 12 minutes.",
    "tag": "Sounds right… but that race never existed.",
    "stamp": "Plausible ≠ true",
    "check": {
      "sources": "Ask for sources",
      "facts": "Check key facts",
      "dontKnow": "Allow 'I don't know'"
    }
  },
  "prompt": {
    "kicker": "Talking to AI",
    "title": "Anatomy of a good prompt",
    "description": "A prompt card built in four parts: role, task, context and format.",
    "role": { "label": "Role", "text": "You are a friendly customer support agent." },
    "task": { "label": "Task", "text": "Reply to this customer's email." },
    "context": { "label": "Context", "text": "Their order is 3 days late; we can offer free shipping." },
    "format": { "label": "Format", "text": "3 short paragraphs, warm and clear." },
    "cta": "Build your own on the laptop."
  },
  "multimodal": {
    "kicker": "Talking to AI",
    "title": "More than words",
    "description": "Text, images and audio go into one AI model, which can answer with text, images or speech.",
    "in": { "text": "Text", "image": "Image", "audio": "Audio" },
    "model": "AI model",
    "out": { "text": "Text", "image": "Image", "speech": "Speech" },
    "caption": "Multimodal: many kinds of input and output."
  },
  "agents": {
    "kicker": "Going further",
    "title": "The agent loop",
    "description": "Around the goal book a meeting room for Friday, four steps in a loop: plan (check the calendar), act (search for free rooms), observe (room 3 is free), repeat (book it, then confirm).",
    "goalLabel": "Goal",
    "goal": "Book a meeting room for Friday",
    "plan": { "name": "Plan", "text": "Check the calendar" },
    "act": { "name": "Act", "text": "Search for free rooms" },
    "observe": { "name": "Observe", "text": "Room 3 is free at 10:00" },
    "repeat": { "name": "Repeat", "text": "Book it, then confirm with you" }
  },
  "tools": {
    "kicker": "Going further",
    "title": "Tools do the heavy lifting",
    "description": "Asked for 18% of 2,340, the AI calls a calculator tool instead of guessing, gets 421.2 back and uses it in its answer.",
    "question": "What's 18% of 2,340?",
    "thinking": "Let me use the calculator.",
    "call": "calculator(2340 × 0.18)",
    "toolLabel": "Tool",
    "toolName": "Calculator",
    "result": "421.2",
    "answer": "18% of 2,340 is 421.2."
  },
  "skills": {
    "kicker": "Going further",
    "title": "Know-how on demand",
    "description": "A shelf of skill cards: brand voice, weekly report, invoice check. When the task write this week's report arrives, only the weekly report card is pulled out.",
    "taskLabel": "New task",
    "task": "Write this week's report",
    "cards": { "voice": "Brand voice", "report": "Weekly report", "invoice": "Invoice check" },
    "caption": "A skill: instructions and files the AI loads only when needed."
  },
  "mcp": {
    "kicker": "Going further",
    "title": "One plug for every tool",
    "description": "Before: the AI app needs a different custom connector for each tool. With MCP: one standard plug connects it to Drive, Calendar, a CRM and a database.",
    "before": "Before: a custom connector for every tool",
    "after": "With MCP: one standard plug",
    "ai": "AI app",
    "custom": "custom connector",
    "port": "MCP",
    "tools": { "drive": "Drive", "calendar": "Calendar", "crm": "CRM", "database": "Database" },
    "caption": "An open standard to plug AI into tools and data – like USB-C."
  },
  "ai-safety-at-work": {
    "kicker": "Bonus",
    "title": "The traffic light",
    "description": "Green: public information and your own drafts are fine. Orange: anonymize client and colleague details first. Red: never paste passwords, API keys or confidential client data. Always check the answer.",
    "green": { "title": "Green – fine to share", "text": "Public information, your own drafts and ideas" },
    "orange": { "title": "Orange – anonymize first", "text": "Client or colleague names, emails, figures" },
    "red": { "title": "Red – never paste", "text": "Passwords, API keys, contracts, confidential client data" },
    "verify": "Always check the answer before you use it – and follow your company's AI policy."
  }
```

- [ ] **Step 3: Créer les 9 composants**

`src/visuals/topics/ContextWindow.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const MESSAGE_COUNT = 8
const ROW = 68 // 56 px message + 12 px gap
const FRAME_TOP = 210

export function ContextWindow({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const shifted = step >= 2
  const shown = shifted ? MESSAGE_COUNT : 4
  const firstInside = shifted ? 4 : 0
  return (
    <VisualShell id="context-window">
      <div className="vz-row">
        <div className="vz-ctx">
          <ol className="vz-ctx__list" style={{ transform: `translateY(${shifted ? FRAME_TOP - 4 * ROW : FRAME_TOP}px)` }}>
            {Array.from({ length: shown }, (_, index) => (
              <li
                key={index}
                className={`vz-ctx__msg vz-ctx__msg--${index % 2 === 0 ? 'user' : 'ai'}${index < firstInside ? ' is-out' : ''}`}
              >
                {t(`context-window.messages.${index}`)}
              </li>
            ))}
          </ol>
          <div className="vz-ctx__frame" aria-hidden="true">
            <span className="vz-ctx__frame-label">{t('context-window.window')}</span>
          </div>
        </div>
        <div className="vz-ctx__side">
          <p className={`vz-ctx__out vz-reveal${on(step >= 2)}`}>{t('context-window.forgotten')}</p>
          <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('context-window.caption')}</p>
          <p className={`vz-note vz-reveal${on(step >= 3)}`}>{t('context-window.tip')}</p>
        </div>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Hallucinations.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const CHECKS = ['sources', 'facts', 'dontKnow'] as const

export function Hallucinations({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="hallucinations">
      <div className="vz-row">
        <div className="vz-chat">
          <p className="vz-bubble vz-bubble--user">{t('hallucinations.question')}</p>
          <p className={`vz-bubble vz-bubble--ai vz-reveal${on(step >= 2)}`}>
            {t('hallucinations.answer')}
            <span className="vz-hallu__tag">{t('hallucinations.tag')}</span>
          </p>
          <div className={`vz-hallu__stamp-wrap vz-reveal${on(step >= 3)}`}>
            <span className="vz-hallu__stamp">{t('hallucinations.stamp')}</span>
          </div>
        </div>
        <ul className={`vz-checklist vz-reveal${on(step >= 3)}`}>
          {CHECKS.map((key) => (
            <li key={key}>{t(`hallucinations.check.${key}`)}</li>
          ))}
        </ul>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Prompt.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const PARTS = ['role', 'task', 'context', 'format'] as const

export function Prompt({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="prompt">
      <div className="vz-prompt">
        <div className="vz-card vz-prompt__card">
          {PARTS.map((part, index) => (
            <div
              key={part}
              className={`vz-prompt__row vz-reveal${on(step >= index + 1)}${step === index + 1 ? ' is-current' : ''}`}
            >
              <span className="vz-prompt__label">{t(`prompt.${part}.label`)}</span>
              <span className="vz-prompt__text">{t(`prompt.${part}.text`)}</span>
            </div>
          ))}
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 4)}`}>{t('prompt.cta')}</p>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Multimodal.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const INPUTS = ['text', 'image', 'audio'] as const
const OUTPUTS = ['text', 'image', 'speech'] as const

export function Multimodal({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="multimodal">
      <div className="vz-mm">
        <ul className={`vz-mm__col vz-reveal${on(step >= 1)}`}>
          {INPUTS.map((key) => (
            <li key={key} className="vz-chip">
              {t(`multimodal.in.${key}`)}
            </li>
          ))}
        </ul>
        <div className={`vz-mm__center vz-reveal${on(step >= 2)}`}>
          <span className="vz-arrow" aria-hidden="true">→</span>
          <span className="vz-mm__model">{t('multimodal.model')}</span>
          <span className="vz-arrow" aria-hidden="true">→</span>
        </div>
        <ul className={`vz-mm__col vz-reveal${on(step >= 3)}`}>
          {OUTPUTS.map((key) => (
            <li key={key} className="vz-chip">
              {t(`multimodal.out.${key}`)}
            </li>
          ))}
        </ul>
        <p className={`vz-caption vz-mm__caption vz-reveal${on(step >= 3)}`}>{t('multimodal.caption')}</p>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Agents.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const NODES = [
  { key: 'plan', x: 50, y: 10 },
  { key: 'act', x: 84, y: 50 },
  { key: 'observe', x: 50, y: 90 },
  { key: 'repeat', x: 16, y: 50 },
] as const

export function Agents({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="agents">
      <div className="vz-agents">
        <svg className="vz-agents__ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="34" ry="40" />
        </svg>
        <div className="vz-agents__goal">
          <span className="vz-label">{t('agents.goalLabel')}</span>
          <strong>{t('agents.goal')}</strong>
        </div>
        {NODES.map((node, index) => (
          <div key={node.key} className="vz-agents__node" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
            <div className={`vz-reveal${on(step >= index + 1)}`}>
              <div className={`vz-agents__card${step === index + 1 ? ' is-current' : ''}`}>
                <strong>{t(`agents.${node.key}.name`)}</strong>
                <span>{t(`agents.${node.key}.text`)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Tools.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

export function Tools({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="tools">
      <div className="vz-tools">
        <div className="vz-chat">
          <p className="vz-bubble vz-bubble--user">{t('tools.question')}</p>
          <p className="vz-bubble vz-bubble--ai">{t('tools.thinking')}</p>
          <p className={`vz-bubble vz-bubble--ai vz-reveal${on(step >= 3)}`}>{t('tools.answer')}</p>
        </div>
        <div className={`vz-tools__side vz-reveal${on(step >= 2)}`}>
          <code className="vz-tools__call">{t('tools.call')}</code>
          <div className="vz-card vz-tools__tool">
            <span className="vz-label">{t('tools.toolLabel')}</span>
            <strong>{t('tools.toolName')}</strong>
            <span className={`vz-tools__result vz-reveal${on(step >= 3)}`}>{t('tools.result')}</span>
          </div>
        </div>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Skills.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const CARDS = ['voice', 'report', 'invoice'] as const

export function Skills({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="skills">
      <div className="vz-skills">
        <div className={`vz-inline vz-reveal${on(step >= 2)}`}>
          <span className="vz-label">{t('skills.taskLabel')}</span>
          <span className="vz-chip">{t('skills.task')}</span>
        </div>
        <div className="vz-skills__shelf">
          {CARDS.map((card) => (
            <div key={card} className={`vz-skills__card${step >= 2 && card === 'report' ? ' is-picked' : ''}`}>
              <span className="vz-skills__tab" aria-hidden="true" />
              <strong>{t(`skills.cards.${card}`)}</strong>
            </div>
          ))}
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('skills.caption')}</p>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/Mcp.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const TOOLS = ['drive', 'calendar', 'crm', 'database'] as const

export function Mcp({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  const unified = step >= 2
  return (
    <VisualShell id="mcp">
      <div className="vz-mcp">
        <p className="vz-label">{unified ? t('mcp.after') : t('mcp.before')}</p>
        <div className="vz-mcp__diagram">
          <div className="vz-mcp__ai">{t('mcp.ai')}</div>
          <div className={`vz-mcp__links${unified ? ' is-unified' : ''}`}>
            {unified ? (
              <span className="vz-mcp__port">{t('mcp.port')}</span>
            ) : (
              TOOLS.map((tool) => (
                <span key={tool} className="vz-mcp__custom">
                  {t('mcp.custom')}
                </span>
              ))
            )}
          </div>
          <ul className="vz-mcp__tools">
            {TOOLS.map((tool) => (
              <li key={tool} className="vz-chip">
                {t(`mcp.tools.${tool}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className={`vz-caption vz-reveal${on(step >= 3)}`}>{t('mcp.caption')}</p>
      </div>
    </VisualShell>
  )
}
```

`src/visuals/topics/AiSafetyAtWork.tsx` :

```tsx
import { useTranslation } from 'react-i18next'
import { on, VisualShell, type VisualProps } from '../parts'

const LIGHTS = [
  { key: 'green', at: 1 },
  { key: 'orange', at: 2 },
  { key: 'red', at: 3 },
] as const

export function AiSafetyAtWork({ step }: VisualProps) {
  const { t } = useTranslation('visuals')
  return (
    <VisualShell id="ai-safety-at-work">
      <div className="vz-safety">
        {LIGHTS.map((light) => (
          <div key={light.key} className={`vz-safety__row vz-safety__row--${light.key} vz-reveal${on(step >= light.at)}`}>
            <span className="vz-safety__lamp" aria-hidden="true" />
            <div>
              <strong>{t(`ai-safety-at-work.${light.key}.title`)}</strong>
              <span>{t(`ai-safety-at-work.${light.key}.text`)}</span>
            </div>
          </div>
        ))}
        <p className={`vz-note vz-reveal${on(step >= 4)}`}>{t('ai-safety-at-work.verify')}</p>
      </div>
    </VisualShell>
  )
}
```

- [ ] **Step 4: Remplacer `src/visuals/registry.ts`**

```ts
import type { ComponentType } from 'react'
import type { VisualId } from './manifest'
import type { VisualProps } from './parts'
import { Agents } from './topics/Agents'
import { AiSafetyAtWork } from './topics/AiSafetyAtWork'
import { ContextWindow } from './topics/ContextWindow'
import { GenerativeAi } from './topics/GenerativeAi'
import { Hallucinations } from './topics/Hallucinations'
import { Llm } from './topics/Llm'
import { Mcp } from './topics/Mcp'
import { Multimodal } from './topics/Multimodal'
import { Prompt } from './topics/Prompt'
import { Skills } from './topics/Skills'
import { Tokens } from './topics/Tokens'
import { Tools } from './topics/Tools'
import { WhatIsAi } from './topics/WhatIsAi'

export const visualComponents: Record<VisualId, ComponentType<VisualProps>> = {
  'what-is-ai': WhatIsAi,
  'generative-ai': GenerativeAi,
  llm: Llm,
  tokens: Tokens,
  'context-window': ContextWindow,
  hallucinations: Hallucinations,
  prompt: Prompt,
  multimodal: Multimodal,
  agents: Agents,
  tools: Tools,
  skills: Skills,
  mcp: Mcp,
  'ai-safety-at-work': AiSafetyAtWork,
}
```

- [ ] **Step 5: Ajouter les styles à la fin de `src/visuals/visuals.css`**

```css
/* context-window */
.vz-ctx { position: relative; flex: none; width: 560px; height: 500px; overflow: hidden; }
.vz-ctx__list { position: absolute; top: 0; left: 0; right: 0; margin: 0; padding: 0; list-style: none; transition: transform 700ms var(--oe-ease); }
.vz-ctx__msg {
  display: flex; align-items: center; height: 56px; margin-bottom: 12px; padding: 0 20px; overflow: hidden;
  border-radius: 16px; font-size: 22px; white-space: nowrap; text-overflow: ellipsis; transition: opacity 500ms var(--oe-ease);
}
.vz-ctx__msg--user { margin-left: 60px; background: rgba(255, 255, 255, 0.08); }
.vz-ctx__msg--ai { margin-right: 60px; background: var(--at-surface-3); }
.vz-ctx__msg.is-out { opacity: 0.25; }
.vz-ctx__frame { position: absolute; top: 202px; bottom: 6px; left: 0; right: 0; border: 3px solid var(--oe-lime); border-radius: 22px; pointer-events: none; }
.vz-ctx__frame-label { position: absolute; top: -18px; left: 24px; padding: 0 10px; background: var(--at-surface-1); font-size: 22px; font-weight: 700; color: var(--oe-lime); }
.vz-ctx__side { display: flex; flex-direction: column; gap: 22px; max-width: 520px; }
.vz-ctx__out { margin: 0; font-size: 26px; color: var(--at-on-dark-3); }

/* hallucinations */
.vz-hallu__tag { display: block; margin-top: 10px; font-size: 22px; color: #ffb249; }
.vz-hallu__stamp-wrap { align-self: flex-end; }
.vz-hallu__stamp {
  display: inline-block; padding: 10px 22px; transform: rotate(-6deg); border: 4px solid var(--oe-danger); border-radius: 12px;
  color: #ff6b6b; font-size: 32px; font-weight: 800; text-transform: uppercase;
}
.vz-checklist { display: flex; flex-direction: column; gap: 16px; width: 420px; margin: 0; padding: 0; list-style: none; }
.vz-checklist li { position: relative; padding-left: 40px; font-size: 26px; }
.vz-checklist li::before { content: ''; position: absolute; top: 8px; left: 0; width: 22px; height: 22px; border: 3px solid var(--oe-lime); border-radius: 6px; }

/* prompt */
.vz-prompt { display: flex; flex-direction: column; gap: 24px; width: 100%; }
.vz-prompt__card { display: flex; flex-direction: column; gap: 14px; }
.vz-prompt__row { display: grid; grid-template-columns: 170px 1fr; align-items: baseline; gap: 20px; }
.vz-prompt__label { font-size: 22px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--at-on-dark-3); }
.vz-prompt__row.is-current .vz-prompt__label { color: var(--oe-lime); }
.vz-prompt__text { font-size: 28px; }

/* multimodal */
.vz-mm { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 36px; width: 100%; }
.vz-mm__col { display: flex; flex-direction: column; align-items: center; gap: 16px; margin: 0; padding: 0; list-style: none; }
.vz-mm__center { display: flex; align-items: center; gap: 18px; }
.vz-mm__model { display: flex; align-items: center; justify-content: center; width: 220px; height: 220px; border: 3px solid var(--oe-lime); border-radius: 50%; font-size: 30px; font-weight: 800; text-align: center; }
.vz-mm__caption { grid-column: 1 / -1; text-align: center; }

/* agents */
.vz-agents { position: relative; width: 100%; height: 520px; }
.vz-agents__ring { position: absolute; inset: 0; width: 100%; height: 100%; }
.vz-agents__ring ellipse { fill: none; stroke: var(--at-hairline-2); stroke-width: 3; stroke-dasharray: 10 10; vector-effect: non-scaling-stroke; }
.vz-agents__goal { position: absolute; top: 50%; left: 50%; display: flex; flex-direction: column; gap: 8px; max-width: 380px; transform: translate(-50%, -50%); text-align: center; }
.vz-agents__goal strong { font-size: 30px; }
.vz-agents__node { position: absolute; width: 330px; transform: translate(-50%, -50%); }
.vz-agents__card { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; border: 1px solid var(--at-hairline-2); border-radius: 20px; background: var(--at-surface-2); }
.vz-agents__card.is-current { border-color: var(--oe-lime); }
.vz-agents__card strong { font-size: 26px; }
.vz-agents__card span { font-size: 22px; color: var(--at-on-dark-2); }

/* tools */
.vz-tools { display: grid; grid-template-columns: 1.2fr 1fr; align-items: center; gap: 40px; width: 100%; }
.vz-tools__side { display: flex; flex-direction: column; gap: 18px; }
.vz-tools__call { padding: 14px 18px; border: 1px solid var(--at-hairline); border-radius: 12px; background: var(--at-ink); color: var(--oe-lime-mint); font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 24px; }
.vz-tools__tool { display: flex; flex-direction: column; gap: 8px; }
.vz-tools__tool strong { font-size: 32px; }
.vz-tools__result { font-size: 40px; font-weight: 800; color: var(--oe-lime); }

/* skills */
.vz-skills { display: flex; flex-direction: column; gap: 30px; width: 100%; }
.vz-skills__shelf { display: flex; align-items: flex-end; gap: 28px; height: 260px; padding-bottom: 14px; border-bottom: 6px solid var(--at-surface-3); }
.vz-skills__card {
  display: flex; flex-direction: column; width: 280px; height: 200px; padding: 22px; border: 1px solid var(--at-hairline-2); border-radius: 18px;
  background: var(--at-surface-2); transition: transform 600ms var(--oe-ease), border-color 600ms var(--oe-ease), box-shadow 600ms var(--oe-ease);
}
.vz-skills__card strong { margin-top: auto; font-size: 28px; }
.vz-skills__card.is-picked { transform: translateY(-48px); border-color: var(--oe-lime); box-shadow: var(--at-glow-lime); }
.vz-skills__tab { width: 60px; height: 8px; border-radius: 4px; background: var(--at-on-dark-3); }
.vz-skills__card.is-picked .vz-skills__tab { background: var(--oe-lime); }

/* mcp */
.vz-mcp { display: flex; flex-direction: column; gap: 22px; width: 100%; }
.vz-mcp__diagram { display: grid; grid-template-columns: 220px 1fr 280px; align-items: center; gap: 28px; }
.vz-mcp__ai { display: flex; align-items: center; justify-content: center; height: 220px; border: 3px solid var(--oe-lime); border-radius: 28px; font-size: 34px; font-weight: 800; }
.vz-mcp__links { display: flex; flex-direction: column; gap: 14px; }
.vz-mcp__links.is-unified { align-items: center; }
.vz-mcp__custom { padding: 8px 16px; border: 2px dashed var(--oe-warn); border-radius: 10px; color: #ffb249; font-size: 22px; text-align: center; }
.vz-mcp__port { padding: 18px 34px; border-radius: 9999px; background: var(--oe-lime); color: var(--at-ink); font-size: 32px; font-weight: 800; }
.vz-mcp__tools { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }

/* ai-safety-at-work */
.vz-safety { display: flex; flex-direction: column; gap: 18px; width: 100%; }
.vz-safety__row { display: flex; align-items: center; gap: 24px; padding: 18px 24px; border: 1px solid var(--at-hairline); border-radius: 20px; background: var(--at-surface-2); }
.vz-safety__row strong { display: block; font-size: 28px; }
.vz-safety__row span { font-size: 23px; color: var(--at-on-dark-2); }
.vz-safety__lamp { flex: none; width: 44px; height: 44px; border-radius: 50%; }
.vz-safety__row--green .vz-safety__lamp { background: var(--oe-lime); }
.vz-safety__row--orange .vz-safety__lamp { background: var(--oe-warn); }
.vz-safety__row--red .vz-safety__lamp { background: var(--oe-danger); }
```

- [ ] **Step 6: Lancer les tests**

Run: `npx vitest run src/visuals`
Expected: PASS (dont le test de complétude et toutes les étapes des 13 visuels).

- [ ] **Step 7: Vérifier que le build passe**

Run: `npm run typecheck && npm run build`
Expected : build OK, sans erreur TypeScript ni CSS. (La vérification visuelle des 13 visuels se fait à la Tâche 13, une fois tous les sujets écrits, car seuls les sujets permettent de les afficher dans l'interface.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remaining nine wall-screen visuals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Démo interactive Tokens

**Files:**
- Create: `src/visuals/TokensDemo.tsx`
- Modify: `src/ui/ExpandOverlay.tsx`, `src/ui/DialogueBox.tsx`, `src/visuals/visuals.css` (ajouts)
- Test: `src/visuals/TokensDemo.test.tsx`

**Interfaces:**
- Consumes: `SAMPLE_TEXT`, `SAMPLE_TOKENS` (Tâche 10) ; `useScreenRef` (Tâche 9) ; `ExpandOverlay`, `DialogueBox`.
- Produces: `interface Tokenizer { encode(text: string): number[]; decode(tokens: number[]): string }`, `MAX_DEMO_CHARS = 2000`, `loadTokenizer(): Promise<Tokenizer>` (import dynamique d'o200k_base), `splitTokens(tokenizer, text): string[]`, composant `TokensDemo` (prop `loader?: () => Promise<Tokenizer>`) ; bouton « Try it yourself » dans le dialogue quand l'écran affiche le visuel `tokens`.

- [ ] **Step 1: Écrire le test qui échoue `src/visuals/TokensDemo.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from '../ui/DialogueBox'
import { MAX_DEMO_CHARS, TokensDemo, loadTokenizer, splitTokens, type Tokenizer } from './TokensDemo'
import { SAMPLE_TEXT, SAMPLE_TOKENS } from './topics/Tokens'

/** One token per character: predictable counts for UI tests. */
const charTokenizer: Tokenizer = {
  encode: (text) => Array.from(text, (char) => char.codePointAt(0)!),
  decode: (tokens) => String.fromCodePoint(...tokens),
}
const fakeLoader = () => Promise.resolve(charTokenizer)

async function renderDemo(loader: () => Promise<Tokenizer> = fakeLoader) {
  await act(async () => {
    render(<TokensDemo loader={loader} />)
  })
}

beforeEach(() => resetAppStore())

test('splits the pre-filled sample once the tokenizer is loaded', async () => {
  await renderDemo()
  expect(screen.getByRole('textbox', { name: 'Type a sentence' })).toHaveValue(SAMPLE_TEXT)
  expect(screen.getByText(`${SAMPLE_TEXT.length} tokens · ${SAMPLE_TEXT.length} characters`)).toBeInTheDocument()
})

test('updates as the user types', async () => {
  const user = userEvent.setup()
  await renderDemo()
  const box = screen.getByRole('textbox', { name: 'Type a sentence' })
  await user.clear(box)
  await user.type(box, 'Hi AI')
  expect(screen.getByText('5 tokens · 5 characters')).toBeInTheDocument()
})

// Review focus 5: a huge paste stays capped and responsive.
test('caps pasted text at the demo limit', async () => {
  const user = userEvent.setup()
  await renderDemo()
  const box = screen.getByRole('textbox', { name: 'Type a sentence' })
  await user.clear(box)
  await user.click(box)
  await user.paste('x'.repeat(5000))
  expect((box as HTMLTextAreaElement).value).toHaveLength(MAX_DEMO_CHARS)
  expect(screen.getByText(`${MAX_DEMO_CHARS} tokens · ${MAX_DEMO_CHARS} characters`)).toBeInTheDocument()
  expect(screen.getByText(`Limited to ${MAX_DEMO_CHARS} characters.`)).toBeInTheDocument()
})

test('explains when the tokenizer cannot load', async () => {
  await renderDemo(() => Promise.reject(new Error('offline')))
  expect(screen.getByRole('alert')).toHaveTextContent("The live demo couldn't load.")
})

// Review focus 3: typing a space in the demo must not advance the dialogue.
test('typing in the demo does not advance the dialogue', async () => {
  const user = userEvent.setup()
  act(() => appStore.getState().openTopic('what-is-ai'))
  await act(async () => {
    render(
      <>
        <DialogueBox />
        <TokensDemo loader={fakeLoader} />
      </>,
    )
  })
  await user.type(screen.getByRole('textbox', { name: 'Type a sentence' }), ' {Enter}')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 0, phase: 'typing' })
})

test('the real tokenizer splits the sample like the wall screen', async () => {
  expect(splitTokens(await loadTokenizer(), SAMPLE_TEXT)).toEqual([...SAMPLE_TOKENS])
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/visuals/TokensDemo.test.tsx`
Expected: FAIL (`./TokensDemo` introuvable).

- [ ] **Step 3: Créer `src/visuals/TokensDemo.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SAMPLE_TEXT } from './topics/Tokens'
import './visuals.css'

export interface Tokenizer {
  encode: (text: string) => number[]
  decode: (tokens: number[]) => string
}

export const MAX_DEMO_CHARS = 2000

export const loadTokenizer = (): Promise<Tokenizer> =>
  import('gpt-tokenizer/encoding/o200k_base').then((module) => ({ encode: module.encode, decode: module.decode }))

export function splitTokens(tokenizer: Tokenizer, text: string): string[] {
  return tokenizer.encode(text).map((token) => tokenizer.decode([token]))
}

export function TokensDemo({ loader = loadTokenizer }: { loader?: () => Promise<Tokenizer> }) {
  const { t } = useTranslation()
  const [text, setText] = useState(SAMPLE_TEXT)
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loader().then(
      (loaded) => {
        if (alive) setTokenizer(loaded)
      },
      () => {
        if (alive) setFailed(true)
      },
    )
    return () => {
      alive = false
    }
  }, [loader])

  const tokens = useMemo(() => (tokenizer ? splitTokens(tokenizer, text) : []), [tokenizer, text])

  return (
    <section className="tokens-demo at-card" aria-labelledby="tokens-demo-title">
      <h3 id="tokens-demo-title" className="at-h2">
        {t('dialogue.tryIt')}
      </h3>
      {failed ? (
        <p role="alert">{t('tokensDemo.loadError')}</p>
      ) : (
        <>
          <label className="tokens-demo__label">
            {t('tokensDemo.label')}
            <textarea
              value={text}
              rows={2}
              maxLength={MAX_DEMO_CHARS}
              onChange={(event) => setText(event.target.value.slice(0, MAX_DEMO_CHARS))}
            />
          </label>
          {text.length >= MAX_DEMO_CHARS && (
            <p className="tokens-demo__limit">{t('tokensDemo.limit', { max: MAX_DEMO_CHARS })}</p>
          )}
          {tokenizer ? (
            <>
              <p className="tokens-demo__count" aria-live="polite">
                {t('tokensDemo.count', { tokens: tokens.length, chars: text.length })}
              </p>
              <div className="tokens-demo__chips">
                {tokens.map((token, index) => (
                  <span key={index} className={`tokens-demo__chip tokens-demo__chip--${index % 2}`}>
                    {token}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="tokens-demo__count">{t('tokensDemo.loading')}</p>
          )}
          <p className="tokens-demo__note">{t('tokensDemo.note')}</p>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Ajouter les styles à la fin de `src/visuals/visuals.css`**

```css
.tokens-demo { display: flex; flex-direction: column; gap: 12px; max-height: 38vh; overflow-y: auto; }
.tokens-demo__label { display: flex; flex-direction: column; gap: 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--at-on-dark-2); }
.tokens-demo__label textarea {
  padding: 12px 14px; border: 1px solid var(--at-hairline-2); border-radius: var(--oe-radius-md); resize: vertical;
  background: var(--at-surface-1); color: var(--at-on-dark); font: 500 18px var(--oe-font-ui); letter-spacing: 0; text-transform: none;
}
.tokens-demo__count { margin: 0; font-weight: 800; color: var(--oe-lime); }
.tokens-demo__limit { margin: 0; font-size: 13px; color: #ffb249; }
.tokens-demo__chips { display: flex; flex-wrap: wrap; gap: 4px; }
.tokens-demo__chip { padding: 4px 6px; border-radius: 6px; font-size: 16px; white-space: pre; transition: background var(--oe-dur-1) var(--oe-ease), color var(--oe-dur-1) var(--oe-ease); }
.tokens-demo__chip--0 { background: rgba(255, 255, 255, 0.08); }
.tokens-demo__chip--1 { background: rgba(255, 255, 255, 0.16); }
.tokens-demo__chip:hover { background: var(--oe-lime); color: var(--at-ink); }
.tokens-demo__note { margin: 0; font-size: 13px; color: var(--at-on-dark-3); }
```

- [ ] **Step 5: Brancher la démo dans la vue agrandie et le dialogue**

Dans `src/ui/ExpandOverlay.tsx`, importer la démo et l'afficher sous l'écran pour le visuel `tokens` :

```tsx
import { TokensDemo } from '../visuals/TokensDemo'
```

```tsx
      <div className="expand__stage">
        <FitScreen>
          <ScreenContent screen={screen} />
        </FitScreen>
      </div>
      {screen?.visualId === 'tokens' && <TokensDemo />}
```

Dans `src/ui/DialogueBox.tsx`, ajouter l'import `import { useActiveTopic, useContent, useScreenRef } from '../core/selectors'` (remplace l'import existant), lire l'écran courant au début du composant :

```tsx
  const screenRef = useScreenRef()
```

et remplacer le bloc `<div className="dialogue__tools">…</div>` par :

```tsx
        <div className="dialogue__tools">
          {screenRef?.visualId === 'tokens' && (
            <Button size="sm" variant="solid" onClick={() => setExpandOpen(true)}>
              {t('dialogue.tryIt')}
            </Button>
          )}
          <Button size="sm" variant="solid" onClick={() => setExpandOpen(true)}>
            {t('screen.expand')}
          </Button>
        </div>
```

Ajouter à la fin de `src/ui/overlay.css` :

```css
.dialogue__tools { display: flex; gap: 8px; }
```

- [ ] **Step 6: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous, dont les 6 tests de la démo).

- [ ] **Step 7: Vérifier le découpage à la demande**

Run: `npm run build && npm run budget`
Expected : un chunk séparé pour `o200k_base` dans `dist/assets/` ; « Initial JS (gzip) » reste sous 1,50 Mo (le tokenizer n'est pas dans le JS initial).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: live tokens demo with lazy-loaded o200k tokenizer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Contenu des 12 autres sujets

**Files:**
- Create: `content/en/topics/generative-ai.json`, `llm.json`, `tokens.json`, `context-window.json`, `hallucinations.json`, `prompt.json`, `multimodal.json`, `agents.json`, `tools.json`, `skills.json`, `mcp.json`, `ai-safety-at-work.json`
- Modify: `content/en/chapters.json` (remplacé), `content/en/topics/what-is-ai.json` (`next`)
- Test: `src/content/content.test.ts` (ajouts)

**Interfaces:**
- Consumes: schéma et validation du contenu (Tâche 5) ; manifeste des visuels (Tâche 5).
- Produces: les 13 sujets validés, dans l'ordre du spec, chaînés par `next`.
- Ce contenu est une première rédaction, à faire valider par le propriétaire du projet (spec §7.5). Il respecte le ton d'Ada : tutoiement, phrases courtes, métaphores du quotidien, terme technique expliqué à sa première apparition, aucun emoji.

- [ ] **Step 1: Ajouter les tests qui échouent à `src/content/content.test.ts`**

```ts
const SPEC_ORDER = [
  'what-is-ai',
  'generative-ai',
  'llm',
  'tokens',
  'context-window',
  'hallucinations',
  'prompt',
  'multimodal',
  'agents',
  'tools',
  'skills',
  'mcp',
  'ai-safety-at-work',
]

test('the 13 topics exist in the agreed order', () => {
  expect(getContent('en').topics.map((topic) => topic.id)).toEqual(SPEC_ORDER)
})

test('each topic leads to the next one, the last one ends the path', () => {
  const topics = getContent('en').topics
  topics.forEach((topic, index) => expect(topic.next).toBe(topics[index + 1]?.id ?? null))
})

test('every topic has at least four basics beats and three deeper beats', () => {
  for (const topic of getContent('en').topics) {
    expect(topic.basics.length).toBeGreaterThanOrEqual(4)
    expect(topic.deeper.length).toBeGreaterThanOrEqual(3)
  }
})
```

Run: `npx vitest run src/content/content.test.ts`
Expected: FAIL (un seul sujet présent).

- [ ] **Step 2: Remplacer `content/en/chapters.json`**

```json
[
  { "id": "basics", "title": "The basics", "topics": ["what-is-ai", "generative-ai", "llm"] },
  { "id": "how-it-works", "title": "How it works", "topics": ["tokens", "context-window", "hallucinations"] },
  { "id": "talking-to-ai", "title": "Talking to AI", "topics": ["prompt", "multimodal"] },
  { "id": "going-further", "title": "Going further", "topics": ["agents", "tools", "skills", "mcp"] },
  { "id": "bonus", "title": "Bonus", "topics": ["ai-safety-at-work"] }
]
```

- [ ] **Step 3: Chaîner le premier sujet**

Dans `content/en/topics/what-is-ai.json`, remplacer `"next": null` par :

```json
  "next": "generative-ai"
```

- [ ] **Step 4: Créer les sujets du chapitre « The basics »**

`content/en/topics/generative-ai.json` :

```json
{
  "id": "generative-ai",
  "chapter": "basics",
  "title": "What is generative AI?",
  "teaser": "Machines that create, not just recognize",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Most AI you've met so far recognizes things: it spots spam, reads number plates or tags the people in your photos.", "mood": "neutral", "gesture": "pointScreen", "screen": "generative-ai:1" },
    { "say": "Generative AI goes one step further: it creates something new – an email, a picture, a summary, even a song.", "mood": "happy", "screen": "generative-ai:2" },
    { "say": "You describe what you want in plain words, and it produces a fresh result that didn't exist a second before.", "gesture": "pointScreen" },
    { "say": "How? It studied millions of examples and learned what usually goes together – then it builds new content piece by piece.", "mood": "thinking", "screen": "generative-ai:3" },
    { "say": "That's why the same request can give a slightly different answer each time. It's creating, not copying.", "mood": "encouraging" }
  ],
  "deeper": [
    { "say": "Under the hood, generation is prediction. A text model predicts the next piece of text, again and again, until the answer is complete.", "mood": "thinking", "screen": "generative-ai:3" },
    { "say": "Image models work differently: many start from random noise and clean it up, step by step, until a picture matches your description.", "mood": "neutral" },
    { "say": "A little randomness is built in on purpose. Developers can often tune it – low for consistent answers, high for more creative ones.", "mood": "neutral" },
    { "say": "It doesn't keep a copy of the internet to paste from. It learned patterns – which is also why it can sound sure and still be wrong.", "mood": "encouraging", "screen": "generative-ai:2" }
  ],
  "takeaway": "Generative AI creates new content by predicting what fits, based on patterns it learned.",
  "next": "llm"
}
```

`content/en/topics/llm.json` :

```json
{
  "id": "llm",
  "chapter": "basics",
  "title": "What is an LLM?",
  "teaser": "The engine behind chat assistants",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "LLM stands for Large Language Model. It's the engine inside chat assistants like ChatGPT, Claude or Copilot.", "mood": "happy", "gesture": "pointScreen", "screen": "llm:1" },
    { "say": "At its core, it plays one game: guess what comes next. 'The cat sat on the…' – what would you say?", "mood": "thinking" },
    { "say": "It weighs every option. 'Mat' is very likely, 'sofa' less so, 'moon' almost never.", "gesture": "pointScreen", "screen": "llm:2" },
    { "say": "It picks one, adds it to the sentence and plays again – word after word – until a whole answer appears.", "screen": "llm:3" },
    { "say": "'Large' because it learned from a huge library of text. That's how guessing the next word turns into explaining, writing and translating.", "mood": "encouraging", "screen": "llm:4" }
  ],
  "deeper": [
    { "say": "Strictly speaking, it predicts tokens – small chunks of text – rather than whole words. That's our next topic.", "mood": "neutral", "screen": "llm:3" },
    { "say": "What it learned is stored in billions of numbers called parameters, tuned during training so its guesses match real text.", "mood": "thinking", "screen": "llm:4" },
    { "say": "After that first training, people teach it to follow instructions and be helpful. That's what turns a text predictor into an assistant.", "mood": "happy" },
    { "say": "On its own, it doesn't remember past chats or browse the web – apps add those as extra features. It works with what's in front of it.", "mood": "encouraging", "gesture": "nod" }
  ],
  "takeaway": "An LLM writes by predicting the next piece of text, again and again.",
  "next": "tokens"
}
```

- [ ] **Step 5: Créer les sujets du chapitre « How it works »**

`content/en/topics/tokens.json` :

```json
{
  "id": "tokens",
  "chapter": "how-it-works",
  "title": "Tokens",
  "teaser": "How AI actually reads your words",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Here's a secret: AI doesn't read words the way you do. It reads tokens.", "mood": "surprised", "gesture": "pointScreen", "screen": "tokens:1" },
    { "say": "A token is a small chunk of text – a whole word, part of a word, or even a single character.", "screen": "tokens:2" },
    { "say": "Look: 'Prompting' becomes two tokens, 'Prompt' and 'ing'. Short, common words are usually one token each.", "gesture": "pointScreen" },
    { "say": "This sentence is 9 tokens for 35 characters. In English, a token is roughly three quarters of a word.", "mood": "thinking", "screen": "tokens:3" },
    { "say": "Why care? Tokens decide how much the AI can read at once, how fast it answers and what it costs.", "mood": "encouraging", "screen": "tokens:4" }
  ],
  "deeper": [
    { "say": "Each AI model has its own tokenizer, so the same sentence can be a different number of tokens from one model to another.", "mood": "neutral", "screen": "tokens:2" },
    { "say": "Other languages often need more tokens than English for the same idea. So do code, numbers and rare words.", "mood": "thinking" },
    { "say": "Paid AI services usually charge per token – both the tokens you send and the tokens the model writes back.", "screen": "tokens:4" },
    { "say": "Want to see it live? Press 'Try it yourself' and type any sentence – you'll see exactly how it gets chopped up.", "mood": "happy", "gesture": "pointScreen" }
  ],
  "takeaway": "AI reads chunks, not words – and every chunk counts.",
  "next": "context-window"
}
```

`content/en/topics/context-window.json` :

```json
{
  "id": "context-window",
  "chapter": "how-it-works",
  "title": "The context window",
  "teaser": "How much the AI can keep in mind",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "When you chat, the AI doesn't remember the way you do. Each time, it rereads the part of the conversation it can see.", "mood": "thinking", "gesture": "pointScreen", "screen": "context-window:1" },
    { "say": "That visible part is called the context window: your messages, its replies and any files you shared." },
    { "say": "The window has a size limit, measured in tokens. In a very long chat, the oldest messages can slide out of view.", "mood": "surprised", "screen": "context-window:2" },
    { "say": "Out of view means forgotten. That's why an assistant can lose track of something you said an hour ago.", "gesture": "nod" },
    { "say": "Tip: for a new task, start a fresh chat, or recap the key points. You keep the AI focused on what matters.", "mood": "encouraging", "screen": "context-window:3" }
  ],
  "deeper": [
    { "say": "Modern models have big windows – often hundreds of thousands of tokens, enough for a long report or even several books.", "mood": "happy", "screen": "context-window:3" },
    { "say": "Bigger isn't always better: details buried in the middle of a very long context can get less attention.", "mood": "thinking" },
    { "say": "Some apps offer 'memory'. Behind the scenes, they save notes and slip them back into the context window for you.", "screen": "context-window:2" },
    { "say": "The golden rule: whatever the AI needs for this task should be inside the window – clear, and close to your request.", "mood": "encouraging" }
  ],
  "takeaway": "The AI only knows what fits in its context window right now.",
  "next": "hallucinations"
}
```

`content/en/topics/hallucinations.json` :

```json
{
  "id": "hallucinations",
  "chapter": "how-it-works",
  "title": "Why AI makes things up",
  "teaser": "Confident is not the same as correct",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Time for an important warning. Sometimes AI gives an answer that sounds perfect – and is completely made up.", "mood": "surprised", "screen": "hallucinations:1" },
    { "say": "Ask about a marathon on Mars in 1987 and it might hand you a winner's name and a finishing time.", "gesture": "pointScreen", "screen": "hallucinations:2" },
    { "say": "Remember the next-word game? The model predicts what sounds right. Sounding right and being true are not the same thing.", "mood": "thinking" },
    { "say": "Experts call this a hallucination. It's more likely with rare facts, exact numbers, quotes, links and recent events." },
    { "say": "So treat answers like a smart colleague's first draft: useful, but worth checking before you rely on it.", "mood": "encouraging", "gesture": "nod", "screen": "hallucinations:3" }
  ],
  "deeper": [
    { "say": "It isn't lying – it has no intention at all. It fills gaps with the most plausible continuation.", "mood": "neutral" },
    { "say": "You can lower the risk: give it the source document, ask it to quote from it, and tell it that 'I don't know' is fine.", "mood": "encouraging", "screen": "hallucinations:3" },
    { "say": "Tools help too. When an assistant can search or read your files, it can base its answer on real sources – so check those sources.", "gesture": "pointScreen" },
    { "say": "For anything that matters – figures, legal points, client facts – verify with a trusted source. You stay responsible for what you share.", "mood": "thinking" }
  ],
  "takeaway": "AI can sound confident and still be wrong – always check what matters.",
  "next": "prompt"
}
```

- [ ] **Step 6: Créer les sujets du chapitre « Talking to AI »**

`content/en/topics/prompt.json` :

```json
{
  "id": "prompt",
  "chapter": "talking-to-ai",
  "title": "What is a prompt?",
  "teaser": "The instructions you give to AI",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "A prompt is what you type to the AI: a question, a request, a set of instructions. It's how you steer the result.", "mood": "happy", "gesture": "pointScreen", "screen": "prompt:1" },
    { "say": "Think of briefing a new colleague who is brilliant but knows nothing about your work. What would they need to hear?", "mood": "thinking" },
    { "say": "A role: who should it be? A task: what exactly should it do?", "screen": "prompt:2" },
    { "say": "Context: what's the situation, who is it for? And a format: how long, what tone, what structure?", "gesture": "pointScreen", "screen": "prompt:4" },
    { "say": "Vague prompt, vague answer. Clear prompt, useful answer. Want to practise? The laptop on the table is your workshop.", "mood": "encouraging", "gesture": "nod" }
  ],
  "deeper": [
    { "say": "The AI can't read your mind or see your screen. Anything it needs – facts, examples, the audience – has to be in the prompt.", "mood": "thinking", "screen": "prompt:3" },
    { "say": "Examples are powerful. Show one or two samples of what 'good' looks like and the AI will follow the pattern.", "mood": "happy" },
    { "say": "It's a conversation. If the first answer misses, don't start over – say what to change: shorter, warmer, more detail on point two.", "gesture": "nod" },
    { "say": "Many tools let you save standing instructions, often called custom instructions or system prompts, so you don't repeat yourself.", "mood": "neutral", "screen": "prompt:4" }
  ],
  "takeaway": "A good prompt is a good brief: role, task, context and format.",
  "next": "multimodal"
}
```

`content/en/topics/multimodal.json` :

```json
{
  "id": "multimodal",
  "chapter": "talking-to-ai",
  "title": "Multimodal AI",
  "teaser": "Beyond text: images, voice and more",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Early chat assistants only handled text. Many models today are multimodal: they work with several kinds of input.", "mood": "happy", "screen": "multimodal:1" },
    { "say": "You can show one a photo of a whiteboard, a screenshot of an error or a chart, and ask questions about it.", "gesture": "pointScreen", "screen": "multimodal:2" },
    { "say": "You can talk to it and hear it answer. Some tools can also create images or fill in documents for you.", "screen": "multimodal:3" },
    { "say": "Behind the scenes it's the same idea: everything is turned into tokens the model can work with.", "mood": "thinking" },
    { "say": "Practical tip: when words fall short, add a picture. A screenshot often explains a problem faster than a paragraph.", "mood": "encouraging" }
  ],
  "deeper": [
    { "say": "Images are cut into small patches, a bit like tokens for pictures. Audio is cut into short slices of sound.", "mood": "thinking", "screen": "multimodal:2" },
    { "say": "Seeing isn't understanding perfectly: models can misread small text, miscount objects or miss details in a busy image.", "mood": "neutral" },
    { "say": "Creating images is often done by a specialised image model that the assistant calls behind the scenes.", "screen": "multimodal:3" },
    { "say": "Same rules as text: don't upload confidential documents or photos of client data into tools your company hasn't approved.", "mood": "encouraging" }
  ],
  "takeaway": "Multimodal AI can read and create more than text: images, sound and documents.",
  "next": "agents"
}
```

- [ ] **Step 7: Créer les sujets du chapitre « Going further »**

`content/en/topics/agents.json` :

```json
{
  "id": "agents",
  "chapter": "going-further",
  "title": "Agents",
  "teaser": "AI that plans and takes action",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "So far, AI has answered your questions. An agent goes further: you give it a goal, and it works out the steps itself.", "mood": "happy", "gesture": "pointScreen", "screen": "agents:1" },
    { "say": "Take the goal 'book a meeting room for Friday'. First, it makes a plan: check the calendar, then look for free rooms.", "mood": "thinking" },
    { "say": "Then it acts, using the tools it's allowed to use, and it observes the result: room 3 is free.", "screen": "agents:3" },
    { "say": "Then it repeats the loop – book the room, confirm with you – until the goal is reached.", "gesture": "pointScreen", "screen": "agents:4" },
    { "say": "Plan, act, observe, repeat: that loop is what makes an agent. It's powerful, so good agents ask before doing anything important.", "mood": "encouraging" }
  ],
  "deeper": [
    { "say": "An agent is an LLM running in a loop, with access to tools. The model picks the next action based on what it has seen so far.", "mood": "thinking", "screen": "agents:4" },
    { "say": "Coding assistants are a good example: they read files, run tests, fix errors and try again, step by step.", "mood": "happy" },
    { "say": "More autonomy means more risk. Mistakes can add up over many steps, so people set limits and approve key actions.", "mood": "neutral" },
    { "say": "Your role shifts from doing each step to giving a clear goal, checking the plan and reviewing the result.", "mood": "encouraging", "gesture": "nod" }
  ],
  "takeaway": "An agent pursues a goal in a loop: plan, act, observe, repeat.",
  "next": "tools"
}
```

`content/en/topics/tools.json` :

```json
{
  "id": "tools",
  "chapter": "going-further",
  "title": "Tools",
  "teaser": "How AI calculates, searches and acts",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "An LLM on its own can only write text. It can't check today's news, do reliable maths or send an email.", "mood": "neutral", "screen": "tools:1" },
    { "say": "Tools fix that. A tool is a function the AI is allowed to call: a calculator, a web search, your calendar.", "mood": "happy", "gesture": "pointScreen" },
    { "say": "Ask for 18% of 2,340. Instead of guessing, the AI writes a request to the calculator tool.", "screen": "tools:2" },
    { "say": "The tool does the work and sends back the result: 421.2. The AI then writes its answer using that result.", "gesture": "pointScreen", "screen": "tools:3" },
    { "say": "Tools are what turn a chatbot into an assistant that can look things up and get things done.", "mood": "encouraging" }
  ],
  "deeper": [
    { "say": "The AI doesn't run the tool itself. It asks, the app runs the tool, then hands the result back to the model.", "mood": "thinking", "screen": "tools:2" },
    { "say": "Each tool comes with a short description. The model reads it to decide when that tool is useful.", "mood": "neutral" },
    { "say": "Tools that change things – sending, deleting, paying – usually ask for your confirmation first. That's a feature, not a bug.", "mood": "encouraging" },
    { "say": "Wiring tools in one by one gets messy fast. That's the problem MCP solves – we'll get there in a moment.", "gesture": "pointScreen", "screen": "tools:3" }
  ],
  "takeaway": "Tools let AI go beyond text: calculate, search and take actions.",
  "next": "skills"
}
```

`content/en/topics/skills.json` :

```json
{
  "id": "skills",
  "chapter": "going-further",
  "title": "Skills",
  "teaser": "Know-how the AI loads on demand",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Imagine a binder of recipe cards next to the AI: brand voice, weekly report, invoice check. Those are skills.", "mood": "happy", "gesture": "pointScreen", "screen": "skills:1" },
    { "say": "A skill is a packaged set of instructions – sometimes with files or scripts – for doing one kind of task well.", "mood": "neutral" },
    { "say": "When a task comes in, like 'write this week's report', the AI pulls out the matching card and follows it.", "screen": "skills:2" },
    { "say": "The other cards stay on the shelf. Only the skill that's needed takes up room in the context window.", "mood": "thinking", "gesture": "pointScreen" },
    { "say": "Skills let a team write its know-how down once and reuse it every time, the same way.", "mood": "encouraging", "screen": "skills:3" }
  ],
  "deeper": [
    { "say": "In practice, a skill is often a folder with a main instruction file. Its short description tells the AI when to use it.", "mood": "thinking", "screen": "skills:3" },
    { "say": "Because only those short descriptions are read up front, you can install many skills without overloading the AI.", "mood": "neutral" },
    { "say": "Skills and tools work together: a skill can explain how to use certain tools for a specific job.", "mood": "happy" },
    { "say": "Treat skills like any shared document: keep them up to date, and only install skills from sources you trust.", "mood": "encouraging" }
  ],
  "takeaway": "A skill is reusable know-how the AI loads only when a task needs it.",
  "next": "mcp"
}
```

`content/en/topics/mcp.json` :

```json
{
  "id": "mcp",
  "chapter": "going-further",
  "title": "MCP",
  "teaser": "One standard plug for AI and your tools",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Remember tools? Connecting an AI app to each service used to need its own custom connector. A lot of work, all different.", "mood": "thinking", "screen": "mcp:1" },
    { "say": "MCP – the Model Context Protocol – is a shared standard for those connections. Think of it as USB-C for AI.", "mood": "happy", "gesture": "pointScreen", "screen": "mcp:2" },
    { "say": "A service like Drive, a calendar or a CRM can offer an 'MCP server'. Any AI app that speaks MCP can plug into it." },
    { "say": "Build the connector once, use it with many AI assistants. That's why so many tools now come with MCP support.", "screen": "mcp:3" },
    { "say": "For you, it means the AI can read from and act in the tools you already use – if you allow it.", "mood": "encouraging", "gesture": "nod" }
  ],
  "deeper": [
    { "say": "MCP is an open standard, first published by Anthropic in late 2024 and now supported across many AI products.", "mood": "neutral", "screen": "mcp:3" },
    { "say": "An MCP server can offer tools to call, data to read and ready-made prompts. The AI app is the client that connects to it.", "mood": "thinking", "screen": "mcp:2" },
    { "say": "Connecting a server gives the AI real access to your data. Only use servers from trusted sources, approved by your company.", "mood": "surprised" },
    { "say": "MCP connects the tools, skills bring the know-how, agents run the loop. Together, that's how modern assistants get work done.", "mood": "encouraging", "gesture": "pointScreen" }
  ],
  "takeaway": "MCP is a shared standard that plugs AI into tools and data.",
  "next": "ai-safety-at-work"
}
```

- [ ] **Step 8: Créer le sujet bonus**

`content/en/topics/ai-safety-at-work.json` :

```json
{
  "id": "ai-safety-at-work",
  "chapter": "bonus",
  "title": "Using AI safely at work",
  "teaser": "What to share, and what never to share",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "Last topic, and maybe the most important: using AI safely at work. A simple traffic light helps.", "mood": "neutral", "gesture": "pointScreen", "screen": "ai-safety-at-work:1" },
    { "say": "Green: public information and your own drafts – a blog idea, rewording a paragraph, planning your day.", "mood": "happy" },
    { "say": "Orange: anything about clients or colleagues. Remove names, emails and figures first, or use a company-approved tool.", "mood": "thinking", "screen": "ai-safety-at-work:2" },
    { "say": "Red: never paste passwords, API keys, contracts or confidential client data into an AI tool – not even 'just once'.", "mood": "surprised", "screen": "ai-safety-at-work:3" },
    { "say": "And always check the answer before you use it. Your name is on what you send, not the AI's.", "mood": "encouraging", "gesture": "nod", "screen": "ai-safety-at-work:4" }
  ],
  "deeper": [
    { "say": "Why so careful? Depending on the tool and its settings, what you type may be stored, reviewed or used to improve future models.", "mood": "thinking", "screen": "ai-safety-at-work:3" },
    { "say": "Company-approved tools usually come with contracts that protect your data. Personal accounts usually don't.", "mood": "neutral" },
    { "say": "Watch for hidden instructions too: a web page or document can contain text meant to trick an AI assistant into doing something else.", "mood": "surprised" },
    { "say": "When in doubt, ask before you paste, and follow your company's AI policy – it beats any rule of thumb I can give you.", "mood": "encouraging", "gesture": "wave", "screen": "ai-safety-at-work:4" }
  ],
  "takeaway": "Share green, anonymize orange, never paste red – and always check the answer.",
  "next": null
}
```

- [ ] **Step 9: Lancer les tests**

Run: `npx vitest run`
Expected: PASS. Si le test « en has no issues » échoue, le message indique le fichier et la règle (réplique > 220 caractères, étape hors limites…) : corriger le texte concerné, sans changer la règle.

- [ ] **Step 10: Vérifier les 13 visuels dans le navigateur**

Run: `npm run dev`. Pour chaque sujet, ouvrir `http://localhost:5173/#/office?topic=<id>`, cliquer sur « Expand », puis avancer au clavier (Espace) jusqu'à la fin des parties simple et approfondie.
Expected, pour chaque visuel :
- toutes les étapes s'affichent ;
- aucun texte ne déborde du cadre 1280 × 720 ;
- aucun texte ne fait moins de 22 px ;
- une seule ligne en Playfair italique.

Corriger les débordements dans `src/visuals/visuals.css` (tailles, espacements), pas dans le contenu.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "content: write the 13 topics with basics and deep dives

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Mode lecture (sans 3D)

**Files:**
- Create: `src/app/ReadingMode.tsx`, `src/app/reading.css`
- Modify: `src/app/ZoneOverlayHost.tsx`
- Test: `src/app/ReadingMode.test.tsx`

**Interfaces:**
- Consumes: `TopicMenu` (prop `embedded`), `DialogueBox`, `ExpandOverlay`, `ScreenContent`, `FitScreen`, `useScreenRef`, `useApp`.
- Produces: composant `ReadingMode` (`<main aria-label="Reading mode">`), affiché pour la zone `office` quand `webgl !== 'ok'` ou `readingMode === true`.

- [ ] **Step 1: Écrire le test qui échoue `src/app/ReadingMode.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { App } from './App'

async function renderApp() {
  await act(async () => {
    render(<App />)
  })
}

test('without WebGL, the office opens in reading mode with the same content', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  expect(screen.getByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  expect(screen.getByTestId('screen-content').querySelector('.vz--what-is-ai')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Click or press Space to continue' })).toBeInTheDocument()
})

test('explains that 3D stopped working', async () => {
  resetAppStore({ webgl: 'unavailable', webglLost: true, readingMode: true })
  await renderApp()
  expect(screen.getByText(/3D stopped working/)).toHaveAttribute('role', 'status')
})

test('manual reading mode hides the 3D stage even with WebGL available', async () => {
  resetAppStore({ readingMode: true })
  await renderApp()
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
  expect(screen.getByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
})

test('zone buttons fade to the workshop and the dungeon', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  await userEvent.click(screen.getByRole('button', { name: 'Prompt workshop' }))
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/app/ReadingMode.test.tsx`
Expected: FAIL (pas de région « Reading mode »).

- [ ] **Step 3: Créer `src/app/ReadingMode.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { useScreenRef } from '../core/selectors'
import { useApp } from '../core/store'
import { Button } from '../ui/Button'
import { DialogueBox } from '../ui/DialogueBox'
import { ExpandOverlay } from '../ui/ExpandOverlay'
import { TopicMenu } from '../ui/TopicMenu'
import { FitScreen } from '../visuals/FitScreen'
import { ScreenContent } from '../visuals/ScreenContent'
import './reading.css'

export function ReadingMode() {
  const { t } = useTranslation()
  const activeTopic = useApp((s) => s.activeTopic)
  const webglLost = useApp((s) => s.webglLost)
  const expandOpen = useApp((s) => s.expandOpen)
  const requestZone = useApp((s) => s.requestZone)
  const screen = useScreenRef()

  return (
    <main className="reading panel" aria-label={t('hud.readingMode')}>
      {webglLost && (
        <p className="reading__banner" role="status">
          {t('errors.webglLost')}
        </p>
      )}
      <div className="reading__grid">
        <aside className="reading__side">
          <TopicMenu embedded />
          <div className="reading__zones">
            <Button variant="ghost" onClick={() => requestZone('workshop')}>
              {t('welcome.workshop')}
            </Button>
            <Button variant="ghost" onClick={() => requestZone('dungeon')}>
              {t('welcome.dungeon')}
            </Button>
          </div>
        </aside>
        <section className="reading__main">
          {activeTopic ? (
            <>
              <div className="reading__screen">
                <FitScreen>
                  <ScreenContent screen={screen} />
                </FitScreen>
              </div>
              <DialogueBox />
            </>
          ) : (
            <div className="reading__intro at-card">
              <p className="welcome__greeting">
                <span className="dialogue__speaker">{t('objects.ada')}</span>
                {t('welcome.greeting')}
              </p>
              <p className="welcome__hint">{t('welcome.pickTopic')}</p>
            </div>
          )}
        </section>
      </div>
      {activeTopic && expandOpen && <ExpandOverlay />}
    </main>
  )
}
```

- [ ] **Step 4: Créer `src/app/reading.css`**

```css
.reading { position: absolute; inset: 0; padding: 84px 32px 32px; overflow-y: auto; background: var(--at-ink); }
.reading__banner {
  max-width: 1480px; margin: 0 auto 16px; padding: 12px 18px; border-radius: var(--oe-radius-md);
  border: 1px solid rgba(255, 149, 0, 0.4); background: rgba(255, 149, 0, 0.12); color: #ffb249;
}
.reading__grid { display: grid; grid-template-columns: minmax(300px, 420px) 1fr; gap: 28px; max-width: 1480px; margin: 0 auto; }
.reading__side { display: flex; flex-direction: column; gap: 16px; }
.reading__zones { display: flex; flex-wrap: wrap; gap: 10px; }
.reading__main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.reading__screen { aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--at-hairline); border-radius: var(--oe-radius-lg); }
.reading__intro { display: flex; flex-direction: column; gap: 10px; }
.reading .dialogue { position: static; width: auto; transform: none; }
```

- [ ] **Step 5: Afficher le mode lecture dans `src/app/ZoneOverlayHost.tsx`**

Ajouter l'import et lire l'état 3D :

```tsx
import { ReadingMode } from './ReadingMode'
```

```tsx
export function ZoneOverlayHost() {
  const zone = useApp((s) => s.zone)
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const OfficeOverlay = officeZone.Overlay!
  return (
    <ErrorBoundary key={zone} zone={zone}>
      {zone === 'office' ? (
        threeD ? <OfficeOverlay /> : <ReadingMode />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <LazyOverlay id={zone} />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}
```

- [ ] **Step 6: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous, dont les 4 du mode lecture).

- [ ] **Step 7: Vérifier dans le navigateur**

Run: `npm run dev`, cliquer sur « Reading mode » dans le HUD.
Expected : le canvas disparaît, le menu des sujets s'affiche à gauche ; un sujet affiche son visuel (16:9) et le dialogue ; « 3D mode » ramène le bureau 3D.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: reading mode without 3D, automatic when WebGL is unavailable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Rail de caméra (molette, clavier, parallaxe, vols)

**Files:**
- Create: `src/zones/office/layout.ts`, `src/zones/office/camera/railMath.ts`, `src/zones/office/camera/CameraRig.tsx`
- Modify: `src/zones/office/OfficeScene.tsx` (ajout de `<CameraRig />`)
- Test: `src/zones/office/camera/railMath.test.ts`

**Interfaces:**
- Consumes: `appStore` (Tâche 7), `isEditable` (Tâche 9), `Via` (Tâche 7).
- Produces:
  - `type Vec3 = [number, number, number]`, `interface Pose { position: Vec3; target: Vec3 }`, `interface Placement { position: Vec3; rotationY?: number }`
  - `layout` (objet mutable, étendu par la Tâche 16) avec `layout.rail: Pose[]` (3 points : vue d'ensemble, milieu, vue présentation) et `layout.flights: Record<Via, Pose>`
  - `layoutVersion: { current: number }`, `bumpLayout(): void` (utilisés par le mode réglage, Tâche 20)
  - `WHEEL_SENSITIVITY`, `KEY_STEP = 0.25`, `FLIGHT_SECONDS = 1.2`, `RAIL_SMOOTH_TIME = 0.35`, `clamp01`, `easeInOutCubic`, `interface PoseVectors { position: Vector3; target: Vector3 }`, `makeRail(points): (t, out?) => PoseVectors`, `lerpPose(from, to, k, out): PoseVectors`, `wheelDelta(event): number`
  - Composant `CameraRig` (sans props)
- Sens : molette vers le haut (`deltaY < 0`) = avancer vers la vue présentation ; flèche ↑ = avancer.

- [ ] **Step 1: Créer `src/zones/office/layout.ts`**

```ts
import type { Via } from '../../core/store'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export interface Placement {
  position: Vec3
  rotationY?: number
}

/**
 * Single source of truth for the office: camera rail, flights and (Task 16) furniture.
 * Units are metres. The room spans x -5..5, z -6..6; the screen wall is at z = -6.
 * The object is mutable on purpose: the tuning panel (?tune) edits it live.
 */
export const layout = {
  rail: [
    { position: [1.6, 2.4, 5.7], target: [0.4, 1.1, -3.0] },
    { position: [0.2, 1.85, 2.3], target: [-0.9, 1.45, -4.6] },
    { position: [-1.5, 1.35, -1.4], target: [-1.5, 1.6, -5.97] },
  ] as Pose[],
  flights: {
    laptop: { position: [-0.8, 0.95, 0.39], target: [-0.8, 0.87, 0.1] },
    tv: { position: [3.95, 0.8, -1.4], target: [4.35, 0.78, -1.4] },
  } as Record<Via, Pose>,
}

/** Bumped by the tuning panel so the camera rig rebuilds its curves. */
export const layoutVersion = { current: 0 }

export function bumpLayout() {
  layoutVersion.current += 1
}
```

- [ ] **Step 2: Écrire le test qui échoue `src/zones/office/camera/railMath.test.ts`**

```ts
import { Vector3 } from 'three'
import { layout } from '../layout'
import { KEY_STEP, WHEEL_SENSITIVITY, clamp01, easeInOutCubic, lerpPose, makeRail, wheelDelta } from './railMath'

const toArray = (v: Vector3) => v.toArray().map((n) => Number(n.toFixed(6)))

describe('rail', () => {
  const rail = makeRail(layout.rail)

  it('starts at the overview and ends at the presentation view', () => {
    expect(toArray(rail(0).position)).toEqual(layout.rail[0].position)
    expect(toArray(rail(1).target)).toEqual(layout.rail[2].target)
  })

  it('passes through the middle point', () => {
    expect(toArray(rail(0.5).position)).toEqual(layout.rail[1].position)
  })

  it('clamps outside 0..1', () => {
    expect(rail(-2).position.equals(rail(0).position)).toBe(true)
    expect(rail(3).position.equals(rail(1).position)).toBe(true)
  })

  it('writes into the vectors it is given', () => {
    const out = { position: new Vector3(), target: new Vector3() }
    expect(rail(0.25, out)).toBe(out)
  })
})

test('easing starts, ends and crosses the middle as expected', () => {
  expect(easeInOutCubic(0)).toBe(0)
  expect(easeInOutCubic(1)).toBe(1)
  expect(easeInOutCubic(0.5)).toBeCloseTo(0.5)
  expect(easeInOutCubic(0.25)).toBeLessThan(0.25)
  expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75)
})

test('lerpPose interpolates position and target', () => {
  const from = { position: new Vector3(0, 0, 0), target: new Vector3(0, 0, -1) }
  const out = { position: new Vector3(), target: new Vector3() }
  lerpPose(from, { position: [2, 2, 2], target: [0, 0, -3] }, 0.5, out)
  expect(out.position.toArray()).toEqual([1, 1, 1])
  expect(out.target.toArray()).toEqual([0, 0, -2])
})

test('wheel up moves toward the presentation view, in pixels or lines', () => {
  expect(wheelDelta({ deltaY: -100, deltaMode: 0 })).toBeCloseTo(100 * WHEEL_SENSITIVITY)
  expect(wheelDelta({ deltaY: 100, deltaMode: 0 })).toBeCloseTo(-100 * WHEEL_SENSITIVITY)
  expect(wheelDelta({ deltaY: -3, deltaMode: 1 })).toBeCloseTo(48 * WHEEL_SENSITIVITY)
})

test('clamp01 and the keyboard step', () => {
  expect(clamp01(-1)).toBe(0)
  expect(clamp01(2)).toBe(1)
  expect(KEY_STEP).toBe(0.25)
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/zones/office/camera`
Expected: FAIL (`./railMath` introuvable).

- [ ] **Step 4: Créer `src/zones/office/camera/railMath.ts`**

```ts
import { CatmullRomCurve3, Vector3 } from 'three'
import type { Pose } from '../layout'

export const WHEEL_SENSITIVITY = 0.0012
export const KEY_STEP = 0.25
export const FLIGHT_SECONDS = 1.2
export const RAIL_SMOOTH_TIME = 0.35

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export interface PoseVectors {
  position: Vector3
  target: Vector3
}

export function makeRail(points: readonly Pose[]) {
  const position = new CatmullRomCurve3(points.map((p) => new Vector3(...p.position)))
  const target = new CatmullRomCurve3(points.map((p) => new Vector3(...p.target)))
  return (t: number, out: PoseVectors = { position: new Vector3(), target: new Vector3() }): PoseVectors => {
    const u = clamp01(t)
    position.getPoint(u, out.position)
    target.getPoint(u, out.target)
    return out
  }
}

const scratch = new Vector3()

export function lerpPose(from: PoseVectors, to: Pose, k: number, out: PoseVectors): PoseVectors {
  out.position.copy(from.position).lerp(scratch.set(...to.position), k)
  out.target.copy(from.target).lerp(scratch.set(...to.target), k)
  return out
}

export function wheelDelta(event: { deltaY: number; deltaMode: number }): number {
  const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 800 : event.deltaY
  return -pixels * WHEEL_SENSITIVITY
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/zones/office/camera`
Expected: PASS (8 tests).

- [ ] **Step 6: Créer `src/zones/office/camera/CameraRig.tsx`**

```tsx
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { isEditable } from '../../../core/dom'
import { appStore } from '../../../core/store'
import { layout, layoutVersion } from '../layout'
import {
  FLIGHT_SECONDS,
  KEY_STEP,
  RAIL_SMOOTH_TIME,
  easeInOutCubic,
  lerpPose,
  makeRail,
  wheelDelta,
  type PoseVectors,
} from './railMath'

const PARALLAX = { x: 0.35, y: 0.18 }

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  const rail = useRef({ version: layoutVersion.current, sample: makeRail(layout.rail) })
  const railT = useRef({ value: appStore.getState().railTarget })
  const parallax = useRef({ x: 0, y: 0 })
  const pointer = useRef({ x: 0, y: 0 })
  const flight = useRef<{ from: PoseVectors; elapsed: number; done: boolean } | null>(null)
  const wasInTransition = useRef(false)
  const pose = useMemo<PoseVectors>(() => ({ position: new Vector3(), target: new Vector3() }), [])
  const lookTarget = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const s = appStore.getState()
      if (s.zone !== 'office' || s.transition) return
      event.preventDefault()
      s.nudgeRail(wheelDelta(event))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvas])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = appStore.getState()
      if (s.zone !== 'office' || s.transition || isEditable(event.target)) return
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        s.nudgeRail(KEY_STEP)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        s.nudgeRail(-KEY_STEP)
      } else if (event.key === 'Home') s.setRailTarget(0)
      else if (event.key === 'End') s.setRailTarget(1)
    }
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointermove', onMove)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  useFrame((_, delta) => {
    const s = appStore.getState()
    if (rail.current.version !== layoutVersion.current) {
      rail.current = { version: layoutVersion.current, sample: makeRail(layout.rail) }
    }
    const transition = s.transition

    if (transition?.stage === 'flight' && transition.via) {
      if (!flight.current) {
        flight.current = { from: { position: camera.position.clone(), target: lookTarget.clone() }, elapsed: 0, done: false }
      }
      const current = flight.current
      current.elapsed += delta
      const k = easeInOutCubic(Math.min(1, current.elapsed / FLIGHT_SECONDS))
      lerpPose(current.from, layout.flights[transition.via], k, pose)
      camera.position.copy(pose.position)
      lookTarget.copy(pose.target)
      camera.lookAt(lookTarget)
      if (k >= 1 && !current.done) {
        current.done = true
        s.transitionStep()
      }
      wasInTransition.current = true
      return
    }
    if (transition) {
      wasInTransition.current = true
      return
    }
    if (wasInTransition.current) {
      // Back from another zone: snap to the rail while the fader still covers the screen.
      wasInTransition.current = false
      flight.current = null
      railT.current.value = s.railTarget
    }

    if (s.reducedMotion) railT.current.value = s.railTarget
    else easing.damp(railT.current, 'value', s.railTarget, RAIL_SMOOTH_TIME, delta)
    rail.current.sample(railT.current.value, pose)

    easing.damp(parallax.current, 'x', s.reducedMotion ? 0 : pointer.current.x, 0.4, delta)
    easing.damp(parallax.current, 'y', s.reducedMotion ? 0 : pointer.current.y, 0.4, delta)
    camera.position.copy(pose.position)
    lookTarget.copy(pose.target)
    lookTarget.x += parallax.current.x * PARALLAX.x
    lookTarget.y -= parallax.current.y * PARALLAX.y
    camera.lookAt(lookTarget)
  })

  return null
}
```

- [ ] **Step 7: Ajouter le rail à la scène provisoire**

Dans `src/zones/office/OfficeScene.tsx`, importer `import { CameraRig } from './camera/CameraRig'` et ajouter `<CameraRig />` juste après la balise `<color … />`.

- [ ] **Step 8: Vérifier dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173/`.
Expected :
- la molette vers le haut avance la caméra au-dessus du sol, de façon amortie, jusqu'à s'arrêter ; vers le bas, elle revient ;
- ↑ / ↓, `Home` et `End` font de même ;
- la souris décale légèrement le regard ;
- la molette au-dessus d'un panneau (barre d'accueil) ne bouge pas la caméra ;
- « Prompt workshop » lance un vol d'environ 1,2 s, puis un fondu vers la carte « Prompt Workshop » ; « Back to the office » revient à la vue d'ensemble.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: office camera rail with wheel, keys, parallax and object flights

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Salle 3D et mobilier procédural

**Files:**
- Create: `src/three/types.ts`, `src/three/materials.ts`, `src/three/logo.ts`, `src/three/interactive.tsx`, `src/three/objects.tsx`, `src/three/props/Table.tsx`, `Chair.tsx`, `Sideboard.tsx`, `Cabinet.tsx`, `Laptop.tsx`, `CrtTv.tsx`, `RetroConsole.tsx`, `Sofa.tsx`, `LogoCubes.tsx`, `Lamp.tsx`, `Microphone.tsx`, `src/zones/office/Room.tsx`, `src/zones/office/Lights.tsx`, `src/zones/office/WallScreen3D.tsx`
- Modify: `src/zones/office/layout.ts` (ajout du mobilier, de l'écran, d'Ada et des lumières), `src/zones/office/OfficeScene.tsx` (remplacé), `src/styles/app.css` (ajout)
- Test: `src/three/objects.test.ts`, `src/three/logo.test.ts`, `src/zones/office/layout.test.ts`

**Interfaces:**
- Consumes: `brand` (Tâche 2) ; `useScreenRef` (Tâche 9) ; `ScreenContent` (Tâche 10) ; `layout`, `Vec3`, `Placement` (Tâche 15) ; `CameraRig` (Tâche 15).
- Produces:
  - `type ObjectProps = Omit<ThreeElements['group'], 'ref'>`
  - `materials(): Materials` (instances partagées, créées au premier appel)
  - `LOGO_RECTS`, `LOGO_W = 60`, `LOGO_H = 78`, `logoBoxes(scale): { color: 'lime' | 'mint' | 'ink'; size: [number, number]; position: [number, number] }[]`
  - `HoverOutline` (props `thickness?`), qui dessine un contour lime quand le `HoverContext` vaut `true` ; `HoverContext` (la Tâche 17 ajoute `Interactive` dans le même fichier)
  - `type ObjectName = 'table' | 'chair' | 'sideboard' | 'cabinet' | 'laptop' | 'crtTv' | 'retroConsole' | 'sofa' | 'logoCubes' | 'lamp' | 'microphone'`, `glbModels`, `resolveObject(name, models?)`, `SceneObject` (props `object: ObjectName` + props de `group`)
  - `CRT_SCREEN = { width: 0.46, height: 0.35, center: Vec3 }` (exporté par `props/CrtTv.tsx`)
  - `layout.objects`, `layout.screen`, `layout.ada`, `layout.lights` ; `chairRing(): Placement[]` ; `TABLE = { center, radii, topY }`
  - `SCREEN_PX = { width: 1280, height: 720 }`, `screenDistanceFactor(widthMetres: number): number` (exporté par `WallScreen3D.tsx`)
- Noms d'objets 3D (`name` des groupes) utilisés par le mode réglage et les tests E2E : `table`, `sideboard`, `lamp`, `laptop`, `cabinet`, `tv`, `retroConsole`, `sofa`, `logo`, `screen`, `ada` (Tâche 18).

- [ ] **Step 1: Étendre `src/zones/office/layout.ts`**

Ajouter, avant la déclaration de `layout` :

```ts
export const TABLE = { center: { x: -1.0, z: -1.8 }, radii: { x: 1.25, z: 2.5 }, topY: 0.75 }

/** Four chairs on each long side of the oval table, turned toward it. */
export function chairRing(): Placement[] {
  return [-3.6, -2.4, -1.2, 0.0].flatMap((z) => {
    const dz = (z - TABLE.center.z) / TABLE.radii.z
    const offset = TABLE.radii.x * Math.sqrt(1 - dz * dz) + 0.5
    return [
      { position: [TABLE.center.x - offset, 0, z] as Vec3, rotationY: Math.PI / 2 },
      { position: [TABLE.center.x + offset, 0, z] as Vec3, rotationY: -Math.PI / 2 },
    ]
  })
}
```

puis ajouter ces clés dans l'objet `layout`, après `flights` :

```ts
  objects: {
    table: { position: [TABLE.center.x, 0, TABLE.center.z] } as Placement,
    chairs: chairRing(),
    microphones: [-3.0, -1.8, -0.6].flatMap((z) => [
      { position: [TABLE.center.x - 0.72, TABLE.topY, z] as Vec3, rotationY: -Math.PI / 2 },
      { position: [TABLE.center.x + 0.72, TABLE.topY, z] as Vec3, rotationY: Math.PI / 2 },
    ]) as Placement[],
    sideboard: { position: [-1.0, 0, -5.72] } as Placement,
    lamp: { position: [1.0, 0.7, -5.72] } as Placement,
    laptop: { position: [-0.8, TABLE.topY, 0.25], rotationY: 0 } as Placement,
    cabinet: { position: [4.62, 0, -1.4], rotationY: -Math.PI / 2 } as Placement,
    tv: { position: [4.6, 0.5, -1.4], rotationY: -Math.PI / 2 } as Placement,
    retroConsole: { position: [4.5, 0.5, -0.9], rotationY: -Math.PI / 2 } as Placement,
    sofa: { position: [2.9, 0, -1.4], rotationY: Math.PI / 2 } as Placement,
    logo: { position: [4.93, 1.9, -4.2], rotationY: -Math.PI / 2 } as Placement,
  },
  screen: { position: [-1.0, 1.9, -5.93] as Vec3, size: [4.0, 2.25] as [number, number] },
  ada: { position: [-3.4, 0.95, -4.7], rotationY: 0.5 } as Placement,
  lights: {
    hemisphere: { sky: '#FFE6C7', ground: '#1A1512', intensity: 0.5 },
    key: { position: [3, 6, 4] as Vec3, intensity: 1.2, color: '#FFE2BF' },
    fills: [
      { position: [-1.0, 2.95, -2.0] as Vec3, intensity: 8, distance: 9, color: '#FFC98A' },
      { position: [3.6, 2.9, -1.4] as Vec3, intensity: 5, distance: 7, color: '#FFC98A' },
    ],
    screenGlow: { position: [-1.0, 1.9, -5.3] as Vec3, intensity: 1.2, color: '#9FB8C8' },
  },
```

- [ ] **Step 2: Écrire les tests qui échouent**

`src/zones/office/layout.test.ts` :

```ts
import { SCREEN_PX, screenDistanceFactor } from './WallScreen3D'
import { TABLE, chairRing, layout } from './layout'

test('eight chairs sit outside the table and face it', () => {
  const chairs = chairRing()
  expect(chairs).toHaveLength(8)
  for (const chair of chairs) {
    const [x, , z] = chair.position
    const inside = ((x - TABLE.center.x) / TABLE.radii.x) ** 2 + ((z - TABLE.center.z) / TABLE.radii.z) ** 2
    expect(inside).toBeGreaterThan(1)
    expect(chair.rotationY).toBe(x < TABLE.center.x ? Math.PI / 2 : -Math.PI / 2)
  }
})

test('the wall screen keeps the 16:9 ratio of its content', () => {
  const [width, height] = layout.screen.size
  expect(width / height).toBeCloseTo(SCREEN_PX.width / SCREEN_PX.height)
})

test('1280 CSS pixels span the screen width', () => {
  // drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units.
  const factor = screenDistanceFactor(layout.screen.size[0])
  expect((SCREEN_PX.width * factor) / 400).toBeCloseTo(layout.screen.size[0])
})

test('the presentation view looks at the screen wall', () => {
  expect(layout.rail[2].target[2]).toBeCloseTo(layout.screen.position[2] - 0.04, 1)
})
```

`src/three/objects.test.ts` :

```ts
import { resolveObject } from './objects'

test('objects are procedural unless a GLB is declared', () => {
  expect(resolveObject('sofa')).toEqual({ kind: 'procedural' })
  expect(resolveObject('sofa', { sofa: '/models/sofa.glb' })).toEqual({ kind: 'glb', url: '/models/sofa.glb' })
})
```

`src/three/logo.test.ts` :

```ts
import { LOGO_H, LOGO_W, logoBoxes } from './logo'

test('the logo mark becomes five centred boxes', () => {
  const boxes = logoBoxes(1)
  expect(boxes).toHaveLength(5)
  const xs = boxes.flatMap((b) => [b.position[0] - b.size[0] / 2, b.position[0] + b.size[0] / 2])
  const ys = boxes.flatMap((b) => [b.position[1] - b.size[1] / 2, b.position[1] + b.size[1] / 2])
  expect(Math.min(...xs)).toBeCloseTo(-LOGO_W / 2)
  expect(Math.max(...xs)).toBeCloseTo(LOGO_W / 2)
  expect(Math.min(...ys)).toBeCloseTo(-LOGO_H / 2)
  expect(Math.max(...ys)).toBeCloseTo(LOGO_H / 2)
  // The mint square is top-left: SVG y goes down, 3D y goes up.
  expect(boxes[0]).toMatchObject({ color: 'mint', position: [-16, 25] })
})
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/three src/zones/office/layout.test.ts`
Expected: FAIL (modules manquants).

- [ ] **Step 4: Créer `src/three/types.ts`, `src/three/logo.ts`, `src/three/materials.ts`, `src/three/interactive.tsx`**

`src/three/types.ts` :

```ts
import type { ThreeElements } from '@react-three/fiber'

export type ObjectProps = Omit<ThreeElements['group'], 'ref'>
```

`src/three/logo.ts` :

```ts
/** The brand mark (src/brand/logo-mark.svg), in SVG units, y pointing down. */
export const LOGO_RECTS = [
  { x: 0, y: 0, w: 28, h: 28, color: 'mint' },
  { x: 32, y: 0, w: 28, h: 28, color: 'ink' },
  { x: 40, y: 34, w: 8, h: 8, color: 'ink' },
  { x: 0, y: 46, w: 28, h: 32, color: 'lime' },
  { x: 32, y: 46, w: 28, h: 32, color: 'lime' },
] as const

export const LOGO_W = 60
export const LOGO_H = 78

/** Centred boxes with y pointing up, `scale` metres per SVG unit. */
export function logoBoxes(scale: number) {
  return LOGO_RECTS.map((rect) => ({
    color: rect.color,
    size: [rect.w * scale, rect.h * scale] as [number, number],
    position: [(rect.x + rect.w / 2 - LOGO_W / 2) * scale, (LOGO_H / 2 - (rect.y + rect.h / 2)) * scale] as [number, number],
  }))
}
```

`src/three/materials.ts` :

```ts
import {
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
} from 'three'
import { brand } from '../core/brand'

function skyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#1D2B3B')
  gradient.addColorStop(0.6, '#56627A')
  gradient.addColorStop(1, '#D08F5E')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 4, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function build() {
  return {
    wall: new MeshStandardMaterial({ color: '#1C2023', roughness: 0.95 }),
    wallPanel: new MeshStandardMaterial({ color: brand.surface2, roughness: 0.9 }),
    ceiling: new MeshStandardMaterial({ color: '#16191B', roughness: 1 }),
    floor: new MeshStandardMaterial({ color: '#2B241F', roughness: 0.65 }),
    rug: new MeshStandardMaterial({ color: '#4A443D', roughness: 1 }),
    darkWood: new MeshStandardMaterial({ color: '#2E2723', roughness: 0.45, metalness: 0.05 }),
    fabric: new MeshStandardMaterial({ color: '#6E675F', roughness: 0.95 }),
    sofaFabric: new MeshStandardMaterial({ color: brand.blueGrey, roughness: 0.95 }),
    curtain: new MeshStandardMaterial({ color: '#6B6259', roughness: 1 }),
    metal: new MeshStandardMaterial({ color: '#2B2F33', roughness: 0.35, metalness: 0.8 }),
    plasticLight: new MeshStandardMaterial({ color: '#BDBBB4', roughness: 0.6 }),
    plasticDark: new MeshStandardMaterial({ color: '#34373A', roughness: 0.55 }),
    screenOff: new MeshStandardMaterial({ color: '#050607', roughness: 0.3, metalness: 0.1 }),
    warmGlow: new MeshBasicMaterial({ color: new Color('#FFD29A').multiplyScalar(2), toneMapped: false }),
    lime: new MeshStandardMaterial({ color: brand.lime, emissive: brand.lime, emissiveIntensity: 0.45 }),
    mint: new MeshStandardMaterial({ color: brand.mint, emissive: brand.mint, emissiveIntensity: 0.35 }),
    ink: new MeshStandardMaterial({ color: brand.nearBlack, roughness: 0.45 }),
    porcelain: new MeshPhysicalMaterial({ color: '#F4F6F5', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
    window: new MeshBasicMaterial({ map: skyTexture(), toneMapped: false }),
  }
}

export type Materials = ReturnType<typeof build>

let cache: Materials | null = null

/** Shared materials, created on first use (inside the Canvas). */
export function materials(): Materials {
  cache ??= build()
  return cache
}
```

`src/three/interactive.tsx` :

```tsx
import { Outlines } from '@react-three/drei'
import { createContext, useContext } from 'react'
import { brand } from '../core/brand'

export const HoverContext = createContext(false)

/** Put inside a mesh: draws a lime outline while the surrounding Interactive is hovered. */
export function HoverOutline({ thickness = 0.008 }: { thickness?: number }) {
  const hovered = useContext(HoverContext)
  return hovered ? <Outlines thickness={thickness} color={brand.lime} /> : null
}
```

- [ ] **Step 5: Créer le mobilier (`src/three/props/`)**

`src/three/props/Table.tsx` :

```tsx
import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Table(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.72} scale={[1.25, 1, 2.5]} material={m.darkWood} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.06, 64]} />
      </mesh>
      {[-1.3, 1.3].map((z) => (
        <group key={z} position-z={z}>
          <mesh position-y={0.36} material={m.darkWood} castShadow>
            <cylinderGeometry args={[0.16, 0.22, 0.66, 24]} />
          </mesh>
          <mesh position-y={0.02} scale={[1, 1, 1.5]} material={m.darkWood} receiveShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.04, 32]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
```

`src/three/props/Chair.tsx` :

```tsx
import { RoundedBox } from '@react-three/drei'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Chair(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[0.56, 0.12, 0.52]} radius={0.05} smoothness={3} position={[0, 0.48, 0]} material={m.fabric} castShadow receiveShadow />
      <RoundedBox args={[0.56, 0.52, 0.1]} radius={0.05} smoothness={3} position={[0, 0.8, -0.24]} rotation-x={-0.12} material={m.fabric} castShadow />
      <mesh position-y={0.24} material={m.metal}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i / 5) * Math.PI * 2}>
          <mesh position={[0, 0.04, 0.14]} material={m.metal}>
            <boxGeometry args={[0.035, 0.03, 0.28]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
```

`src/three/props/Sideboard.tsx` :

```tsx
import { materials } from '../materials'
import type { ObjectProps } from '../types'

const WIDTH = 4.6
const HEIGHT = 0.7
const DEPTH = 0.5

export function Sideboard(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={(HEIGHT - 0.06) / 2 + 0.04} material={m.darkWood} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT - 0.06, DEPTH]} />
      </mesh>
      <mesh position-y={HEIGHT + 0.01} material={m.darkWood} castShadow>
        <boxGeometry args={[WIDTH + 0.06, 0.03, DEPTH + 0.06]} />
      </mesh>
      {/* warm light strip under the overhanging top, as in the reference photo */}
      <mesh position={[0, HEIGHT - 0.012, DEPTH / 2 + 0.01]} material={m.warmGlow}>
        <boxGeometry args={[WIDTH - 0.1, 0.012, 0.02]} />
      </mesh>
    </group>
  )
}
```

`src/three/props/Cabinet.tsx` :

```tsx
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Low TV stand of the lounge corner: 1.7 m wide, 0.5 m high, front facing +z. */
export function Cabinet(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.25} material={m.darkWood} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.5, 0.5]} />
      </mesh>
    </group>
  )
}
```

`src/three/props/Laptop.tsx` :

```tsx
import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { brand } from '../../core/brand'
import { HoverOutline } from '../interactive'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Abstract "app window" for the laptop screen: shapes only, no text to translate. */
function screenTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = brand.surface1
  ctx.fillRect(0, 0, 512, 320)
  ctx.fillStyle = brand.surface3
  ctx.fillRect(0, 0, 512, 36)
  ctx.fillStyle = brand.lime
  ctx.fillRect(24, 64, 180, 18)
  ctx.fillStyle = 'rgba(244,246,245,0.35)'
  for (let row = 0; row < 5; row++) ctx.fillRect(24, 110 + row * 30, 300 + ((row * 53) % 140), 12)
  ctx.fillStyle = brand.mint
  ctx.fillRect(24, 272, 110, 26)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function Laptop(props: ObjectProps) {
  const m = materials()
  const texture = useMemo(screenTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group {...props}>
      <RoundedBox args={[0.34, 0.018, 0.24]} radius={0.008} smoothness={2} position-y={0.009} material={m.metal} castShadow>
        <HoverOutline />
      </RoundedBox>
      {/* hinge at the back edge; the lid leans back 15° */}
      <group position={[0, 0.018, -0.12]} rotation-x={-0.26}>
        <RoundedBox args={[0.34, 0.22, 0.012]} radius={0.006} smoothness={2} position={[0, 0.11, -0.006]} material={m.metal} castShadow>
          <HoverOutline />
        </RoundedBox>
        <mesh position={[0, 0.112, 0.0008]}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
```

`src/three/props/CrtTv.tsx` :

```tsx
import { RoundedBox } from '@react-three/drei'
import { HoverOutline } from '../interactive'
import { materials } from '../materials'
import type { Vec3 } from '../../zones/office/layout'
import type { ObjectProps } from '../types'

/** Screen area of the TV, in the TV's local frame (front = +z). */
export const CRT_SCREEN = { width: 0.46, height: 0.35, center: [0, 0.27, 0.253] as Vec3 }

export function CrtTv(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[0.62, 0.5, 0.36]} radius={0.04} smoothness={3} position={[0, 0.25, 0.07]} material={m.plasticLight} castShadow receiveShadow>
        <HoverOutline />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.38, 0.22]} radius={0.05} smoothness={3} position={[0, 0.24, -0.2]} material={m.plasticLight} castShadow />
      <mesh position={[0, 0.27, 0.251]} material={m.plasticDark}>
        <boxGeometry args={[0.52, 0.4, 0.002]} />
      </mesh>
      <mesh position={[0.24, 0.05, 0.252]} material={m.lime}>
        <boxGeometry args={[0.03, 0.012, 0.004]} />
      </mesh>
    </group>
  )
}
```

`src/three/props/RetroConsole.tsx` :

```tsx
import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** A made-up 90s console: rounded grey case, the brand squares as buttons, a pad and a cable. */
export function RetroConsole(props: ObjectProps) {
  const m = materials()
  const cable = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 0.03, -0.13),
          new Vector3(-0.12, 0.01, -0.2),
          new Vector3(-0.34, 0.01, -0.22),
          new Vector3(-0.44, 0.08, -0.18),
        ]),
        24,
        0.005,
        6,
      ),
    [],
  )
  const buttons = logoBoxes(0.0012)
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  return (
    <group {...props}>
      <RoundedBox args={[0.36, 0.07, 0.26]} radius={0.02} smoothness={3} position-y={0.035} material={m.plasticLight} castShadow>
        <HoverOutline />
      </RoundedBox>
      <mesh position={[0, 0.071, -0.04]} material={m.plasticDark}>
        <boxGeometry args={[0.2, 0.004, 0.08]} />
      </mesh>
      <group position={[0.11, 0.072, 0.07]} rotation-x={-Math.PI / 2}>
        {buttons.map((button, index) => (
          <mesh key={index} position={[button.position[0], button.position[1], 0.002]} material={byColor[button.color]}>
            <boxGeometry args={[button.size[0], button.size[1], 0.004]} />
          </mesh>
        ))}
      </group>
      <group position={[0.27, 0, 0.02]}>
        <RoundedBox args={[0.16, 0.03, 0.07]} radius={0.012} smoothness={3} position-y={0.015} material={m.plasticLight} castShadow />
        <mesh position={[-0.045, 0.031, 0]} material={m.plasticDark}>
          <boxGeometry args={[0.03, 0.004, 0.01]} />
        </mesh>
        <mesh position={[-0.045, 0.031, 0]} material={m.plasticDark}>
          <boxGeometry args={[0.01, 0.004, 0.03]} />
        </mesh>
        <mesh position={[0.04, 0.031, -0.008]} material={m.lime}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
        <mesh position={[0.058, 0.031, 0.008]} material={m.mint}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
      </group>
      <mesh geometry={cable} material={m.plasticDark} />
    </group>
  )
}
```

`src/three/props/Sofa.tsx` :

```tsx
import { RoundedBox } from '@react-three/drei'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Two-seat sofa, front facing +z. */
export function Sofa(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <RoundedBox args={[2.0, 0.3, 0.9]} radius={0.06} smoothness={3} position={[0, 0.2, 0]} material={m.sofaFabric} castShadow receiveShadow />
      {[-0.43, 0.43].map((x) => (
        <RoundedBox key={x} args={[0.84, 0.16, 0.66]} radius={0.06} smoothness={3} position={[x, 0.43, 0.08]} material={m.sofaFabric} castShadow />
      ))}
      <RoundedBox args={[2.0, 0.5, 0.22]} radius={0.08} smoothness={3} position={[0, 0.55, -0.34]} material={m.sofaFabric} castShadow />
      {[-0.95, 0.95].map((x) => (
        <RoundedBox key={x} args={[0.2, 0.56, 0.9]} radius={0.08} smoothness={3} position={[x, 0.33, 0]} material={m.sofaFabric} castShadow />
      ))}
      {[-0.85, 0.85].flatMap((x) =>
        [-0.35, 0.35].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.025, z]} material={m.metal}>
            <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
          </mesh>
        )),
      )}
    </group>
  )
}
```

`src/three/props/LogoCubes.tsx` :

```tsx
import { logoBoxes } from '../logo'
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** The five-square mark as cubes on the wall, 0.72 m wide. Front faces +z. */
export function LogoCubes(props: ObjectProps) {
  const m = materials()
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  return (
    <group {...props}>
      {logoBoxes(0.012).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0.05]} material={byColor[box.color]} castShadow>
          <boxGeometry args={[box.size[0], box.size[1], 0.1]} />
        </mesh>
      ))}
    </group>
  )
}
```

`src/three/props/Lamp.tsx` :

```tsx
import { materials } from '../materials'
import type { ObjectProps } from '../types'

export function Lamp(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.01} material={m.metal}>
        <cylinderGeometry args={[0.07, 0.08, 0.02, 24]} />
      </mesh>
      <mesh position-y={0.17} material={m.metal}>
        <cylinderGeometry args={[0.012, 0.012, 0.32, 12]} />
      </mesh>
      <mesh position-y={0.31} material={m.warmGlow}>
        <sphereGeometry args={[0.13, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <pointLight position-y={0.28} intensity={1.5} distance={3} decay={2} color="#FFC98A" />
    </group>
  )
}
```

`src/three/props/Microphone.tsx` :

```tsx
import { materials } from '../materials'
import type { ObjectProps } from '../types'

/** Conference microphone; the gooseneck leans toward +z. */
export function Microphone(props: ObjectProps) {
  const m = materials()
  return (
    <group {...props}>
      <mesh position-y={0.01} material={m.ink} castShadow>
        <boxGeometry args={[0.1, 0.02, 0.07]} />
      </mesh>
      <group position-y={0.02} rotation-x={0.45}>
        <mesh position-y={0.17} material={m.metal}>
          <cylinderGeometry args={[0.005, 0.005, 0.34, 8]} />
        </mesh>
        <mesh position-y={0.35} material={m.ink}>
          <cylinderGeometry args={[0.012, 0.01, 0.05, 12]} />
        </mesh>
        <mesh position-y={0.376} material={m.lime}>
          <cylinderGeometry args={[0.0125, 0.0125, 0.004, 12]} />
        </mesh>
      </group>
    </group>
  )
}
```

- [ ] **Step 6: Créer le registre `src/three/objects.tsx`**

```tsx
import { useGLTF } from '@react-three/drei'
import { useMemo, type ComponentType } from 'react'
import { Cabinet } from './props/Cabinet'
import { Chair } from './props/Chair'
import { CrtTv } from './props/CrtTv'
import { Lamp } from './props/Lamp'
import { Laptop } from './props/Laptop'
import { LogoCubes } from './props/LogoCubes'
import { Microphone } from './props/Microphone'
import { RetroConsole } from './props/RetroConsole'
import { Sideboard } from './props/Sideboard'
import { Sofa } from './props/Sofa'
import { Table } from './props/Table'
import type { ObjectProps } from './types'

export type ObjectName =
  | 'table'
  | 'chair'
  | 'sideboard'
  | 'cabinet'
  | 'laptop'
  | 'crtTv'
  | 'retroConsole'
  | 'sofa'
  | 'logoCubes'
  | 'lamp'
  | 'microphone'

/**
 * Declare a GLB in /public/models to replace an object's procedural version, e.g. { sofa: '/models/sofa.glb' }.
 * The model must share the procedural origin (floor level, centred) and orientation (front = +z), in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {}

const procedural: Record<ObjectName, ComponentType<ObjectProps>> = {
  table: Table,
  chair: Chair,
  sideboard: Sideboard,
  cabinet: Cabinet,
  laptop: Laptop,
  crtTv: CrtTv,
  retroConsole: RetroConsole,
  sofa: Sofa,
  logoCubes: LogoCubes,
  lamp: Lamp,
  microphone: Microphone,
}

export type ObjectSource = { kind: 'procedural' } | { kind: 'glb'; url: string }

export function resolveObject(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): ObjectSource {
  const url = models[name]
  return url ? { kind: 'glb', url } : { kind: 'procedural' }
}

function GltfObject({ url, ...props }: ObjectProps & { url: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  )
}

export function SceneObject({ object, ...props }: ObjectProps & { object: ObjectName }) {
  const source = resolveObject(object)
  if (source.kind === 'glb') return <GltfObject url={source.url} {...props} />
  const Procedural = procedural[object]
  return <Procedural {...props} />
}
```

- [ ] **Step 7: Créer `src/zones/office/Room.tsx`, `Lights.tsx`, `WallScreen3D.tsx`**

`src/zones/office/Room.tsx` :

```tsx
import { materials } from '../../three/materials'

export const ROOM = { width: 10, depth: 12, height: 3.2 }
const WINDOW = { centerZ: -2.0, centerY: 1.65, width: 3.4, height: 2.1 }

function LeftWall() {
  const m = materials()
  const { depth: D, height: H, width: W } = ROOM
  const x = -W / 2
  const bottom = WINDOW.centerY - WINDOW.height / 2
  const top = WINDOW.centerY + WINDOW.height / 2
  const zNear = WINDOW.centerZ - WINDOW.width / 2
  const zFar = WINDOW.centerZ + WINDOW.width / 2
  const pieces: { z: number; y: number; w: number; h: number }[] = [
    { z: 0, y: bottom / 2, w: D, h: bottom },
    { z: 0, y: (top + H) / 2, w: D, h: H - top },
    { z: (-D / 2 + zNear) / 2, y: WINDOW.centerY, w: zNear + D / 2, h: WINDOW.height },
    { z: (zFar + D / 2) / 2, y: WINDOW.centerY, w: D / 2 - zFar, h: WINDOW.height },
  ]
  return (
    <group>
      {pieces.map((piece, index) => (
        <mesh key={index} position={[x, piece.y, piece.z]} rotation-y={Math.PI / 2} material={m.wall} receiveShadow>
          <planeGeometry args={[piece.w, piece.h]} />
        </mesh>
      ))}
      <mesh position={[x - 0.05, WINDOW.centerY, WINDOW.centerZ]} rotation-y={Math.PI / 2} material={m.window}>
        <planeGeometry args={[WINDOW.width, WINDOW.height]} />
      </mesh>
      {[zNear, zFar].map((z) => (
        <mesh key={z} position={[x + 0.04, WINDOW.centerY, z]} material={m.darkWood}>
          <boxGeometry args={[0.08, WINDOW.height, 0.08]} />
        </mesh>
      ))}
      <mesh position={[x + 0.04, WINDOW.centerY, WINDOW.centerZ]} material={m.darkWood}>
        <boxGeometry args={[0.06, WINDOW.height, 0.05]} />
      </mesh>
      {[zNear - 0.3, zFar + 0.3].map((z) => (
        <mesh key={z} position={[x + 0.15, H / 2 - 0.1, z]} material={m.curtain} castShadow>
          <boxGeometry args={[0.12, H - 0.3, 0.7]} />
        </mesh>
      ))}
    </group>
  )
}

function CeilingCove() {
  const m = materials()
  const y = ROOM.height - 0.02
  const x0 = -3.6
  const x1 = 1.6
  const z0 = -5.2
  const z1 = 1.4
  const strips: { position: [number, number, number]; size: [number, number, number] }[] = [
    { position: [(x0 + x1) / 2, y, z0], size: [x1 - x0, 0.03, 0.05] },
    { position: [(x0 + x1) / 2, y, z1], size: [x1 - x0, 0.03, 0.05] },
    { position: [x0, y, (z0 + z1) / 2], size: [0.05, 0.03, z1 - z0] },
    { position: [x1, y, (z0 + z1) / 2], size: [0.05, 0.03, z1 - z0] },
  ]
  return (
    <group>
      {strips.map((strip, index) => (
        <mesh key={index} position={strip.position} material={m.warmGlow}>
          <boxGeometry args={strip.size} />
        </mesh>
      ))}
    </group>
  )
}

export function Room() {
  const m = materials()
  const { width: W, depth: D, height: H } = ROOM
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={m.floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-1.0, 0.004, -1.8]} material={m.rug} receiveShadow>
        <planeGeometry args={[5.2, 7.4]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={H} material={m.ceiling}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} material={m.wall} receiveShadow>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[-1.0, 1.65, -D / 2 + 0.01]} material={m.wallPanel} receiveShadow>
        <planeGeometry args={[6.4, 3.0]} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI} material={m.wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2} material={m.wall} receiveShadow>
        <planeGeometry args={[D, H]} />
      </mesh>
      <LeftWall />
      <CeilingCove />
    </group>
  )
}
```

`src/zones/office/Lights.tsx` :

```tsx
import { layout } from './layout'

export function Lights({ shadows = true }: { shadows?: boolean }) {
  const { hemisphere, key, fills, screenGlow } = layout.lights
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity]} />
      <directionalLight
        position={key.position}
        intensity={key.intensity}
        color={key.color}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      {fills.map((fill, index) => (
        <pointLight key={index} position={fill.position} intensity={fill.intensity} distance={fill.distance} decay={2} color={fill.color} />
      ))}
      <pointLight position={screenGlow.position} intensity={screenGlow.intensity} distance={4} decay={2} color={screenGlow.color} />
    </>
  )
}
```

`src/zones/office/WallScreen3D.tsx` :

```tsx
import { Html } from '@react-three/drei'
import { useScreenRef } from '../../core/selectors'
import { materials } from '../../three/materials'
import { ScreenContent } from '../../visuals/ScreenContent'
import { layout } from './layout'

export const SCREEN_PX = { width: 1280, height: 720 }

/** drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units. */
export function screenDistanceFactor(widthMetres: number): number {
  return (widthMetres / SCREEN_PX.width) * 400
}

export function WallScreen3D() {
  const m = materials()
  const screen = useScreenRef()
  const { position, size } = layout.screen
  return (
    <group position={position} name="screen">
      <mesh position-z={-0.03} material={m.ink} castShadow>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.05]} />
      </mesh>
      <mesh material={m.screenOff}>
        <planeGeometry args={size} />
      </mesh>
      {/* Sits below the DOM overlay (z-index 10) and never catches the pointer, so the wheel still reaches the canvas. */}
      <Html
        transform
        distanceFactor={screenDistanceFactor(size[0])}
        position-z={0.003}
        zIndexRange={[5, 0]}
        pointerEvents="none"
        wrapperClass="wall-screen"
      >
        <ScreenContent screen={screen} />
      </Html>
    </group>
  )
}
```

Ajouter à la fin de `src/styles/app.css` :

```css
.wall-screen { pointer-events: none; }
```

- [ ] **Step 8: Remplacer `src/zones/office/OfficeScene.tsx`**

```tsx
import { ContactShadows } from '@react-three/drei'
import { brand } from '../../core/brand'
import { SceneObject } from '../../three/objects'
import { CameraRig } from './camera/CameraRig'
import { layout } from './layout'
import { Lights } from './Lights'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const { table, chairs, microphones, sideboard, lamp, laptop, cabinet, tv, retroConsole, sofa, logo } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <CameraRig />
      <Lights />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      {chairs.map((chair, index) => (
        <SceneObject key={index} object="chair" name={`chair-${index}`} position={chair.position} rotation-y={chair.rotationY} />
      ))}
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <SceneObject object="sideboard" name="sideboard" position={sideboard.position} />
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      <SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} />
      <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
      <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <WallScreen3D />
      <ContactShadows
        position={[table.position[0], 0.006, table.position[2]]}
        scale={[5, 7.5]}
        opacity={0.55}
        blur={2.4}
        far={1.4}
        resolution={512}
        frames={1}
      />
    </>
  )
}
```

- [ ] **Step 9: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous, dont layout, objets et logo).

- [ ] **Step 10: Vérifier et régler l'ambiance dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173/` dans une fenêtre de 1600 × 900, puis prendre deux captures d'écran : la vue d'ensemble, et la vue présentation (molette vers le haut).
Expected :
- **Vue d'ensemble** :
  - toute la salle est visible : table avec le portable devant, écran mural au fond, logo en cubes, coin salon à droite (canapé, télé, console) ;
  - la fenêtre à gauche montre un ciel de fin de journée ;
  - la lumière est chaude et tamisée, sans zone noire complète.
- **Vue présentation** :
  - l'écran occupe environ 60 % de la largeur et son contenu d'accueil est net ;
  - la zone à gauche de l'écran est libre pour Ada (ajoutée à la Tâche 18) ;
  - la bulle de dialogue en bas ne couvre pas l'écran.

Si la scène est trop sombre ou trop claire, n'ajuster que les intensités de `layout.lights` (en gardant leurs rapports). Si le cadrage est décalé, n'ajuster que `layout.rail`. Enregistrer les deux captures pour la Tâche 21.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: procedural office room, furniture registry and wall screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Objets interactifs (survol, étiquette, clic, écran de la télé)

**Files:**
- Create: `src/zones/office/interactions.ts`, `src/zones/office/CrtScreen.tsx`
- Modify: `src/three/interactive.tsx` (ajout d'`Interactive`), `src/zones/office/OfficeScene.tsx`, `content/en/ui.json` (clé `crt`), `src/styles/app.css` (ajout)
- Test: `src/zones/office/interactions.test.ts`, `src/zones/office/CrtScreen.test.ts`

**Interfaces:**
- Consumes: `appStore`, `useApp`, `HoverTarget` (Tâche 7) ; `HoverContext`, `HoverOutline` (Tâche 16) ; `CRT_SCREEN` (Tâche 16) ; `layout` (Tâches 15-16).
- Produces:
  - `objectActions: Record<HoverTarget, () => void>` (utilisé par le clic 3D et par l'API de test de la Tâche 21)
  - `Interactive` (props `id: HoverTarget`, `label: string`, `labelPosition: Vec3`, `onActivate: () => void`, `children`)
  - `BLINK_SECONDS = 0.6`, `blinkOn(time): boolean`, `fillNoise(data: Uint8ClampedArray, rand: () => number): void`, composant `CrtScreen`
  - clés i18n `crt.title` et `crt.pressStart`

- [ ] **Step 1: Ajouter les clés de l'écran de la télé dans `content/en/ui.json`**

Ajouter cette entrée de premier niveau (après `"tokensDemo"`) :

```json
  "crt": {
    "title": "The Dungeon",
    "pressStart": "Press start"
  }
```

- [ ] **Step 2: Écrire les tests qui échouent**

`src/zones/office/interactions.test.ts` :

```ts
import { appStore } from '../../core/store'
import { resetAppStore } from '../../test/resetAppStore'
import { objectActions } from './interactions'

beforeEach(() => resetAppStore())

test('the laptop flies to the workshop', () => {
  objectActions.laptop()
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})

test('the TV flies to the dungeon', () => {
  objectActions.tv()
  expect(appStore.getState().transition).toEqual({ to: 'dungeon', via: 'tv', stage: 'flight' })
})

test('clicking Ada makes her wave', () => {
  objectActions.ada()
  expect(appStore.getState().adaPokes).toBe(1)
})
```

`src/zones/office/CrtScreen.test.ts` :

```ts
import { BLINK_SECONDS, blinkOn, fillNoise } from './CrtScreen'

test('PRESS START blinks on and off', () => {
  expect(blinkOn(0)).toBe(true)
  expect(blinkOn(BLINK_SECONDS + 0.01)).toBe(false)
  expect(blinkOn(BLINK_SECONDS * 2 + 0.01)).toBe(true)
})

test('noise fills opaque grey pixels', () => {
  const data = new Uint8ClampedArray(4 * 3)
  const values = [0.1, 0.5, 0.9]
  fillNoise(data, () => values.shift()!)
  expect(Array.from(data)).toEqual([26, 26, 26, 255, 128, 128, 128, 255, 230, 230, 230, 255])
})
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/zones/office/interactions.test.ts src/zones/office/CrtScreen.test.ts`
Expected: FAIL (modules manquants).

- [ ] **Step 4: Créer `src/zones/office/interactions.ts`**

```ts
import { appStore, type HoverTarget } from '../../core/store'

/** What each clickable object does. Shared by 3D clicks and the dev test API. */
export const objectActions: Record<HoverTarget, () => void> = {
  laptop: () => appStore.getState().requestZone('workshop', 'laptop'),
  tv: () => appStore.getState().requestZone('dungeon', 'tv'),
  ada: () => appStore.getState().pokeAda(),
}
```

- [ ] **Step 5: Ajouter `Interactive` à `src/three/interactive.tsx`**

Remplacer le fichier par :

```tsx
import { Html, Outlines, useCursor } from '@react-three/drei'
import { createContext, useContext, type ReactNode } from 'react'
import { brand } from '../core/brand'
import { appStore, useApp, type HoverTarget } from '../core/store'
import type { Vec3 } from '../zones/office/layout'

export const HoverContext = createContext(false)

/** Put inside a mesh: draws a lime outline while the surrounding Interactive is hovered. */
export function HoverOutline({ thickness = 0.008 }: { thickness?: number }) {
  const hovered = useContext(HoverContext)
  return hovered ? <Outlines thickness={thickness} color={brand.lime} /> : null
}

interface InteractiveProps {
  id: HoverTarget
  label: string
  /** World position of the floating label. */
  labelPosition: Vec3
  onActivate: () => void
  children: ReactNode
}

export function Interactive({ id, label, labelPosition, onActivate, children }: InteractiveProps) {
  const hovered = useApp((s) => s.hovered === id)
  const blocked = useApp((s) => s.transition !== null)
  const active = hovered && !blocked
  useCursor(active)
  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation()
        if (!appStore.getState().transition) appStore.getState().setHovered(id)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        if (appStore.getState().hovered === id) appStore.getState().setHovered(null)
      }}
      onClick={(event) => {
        event.stopPropagation()
        if (!appStore.getState().transition) onActivate()
      }}
    >
      <HoverContext.Provider value={active}>{children}</HoverContext.Provider>
      {active && (
        <Html position={labelPosition} center zIndexRange={[6, 0]} pointerEvents="none">
          <span className="object-label">{label}</span>
        </Html>
      )}
    </group>
  )
}
```

- [ ] **Step 6: Créer `src/zones/office/CrtScreen.tsx`**

```tsx
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CanvasTexture, NearestFilter, SRGBColorSpace, type Mesh } from 'three'
import { brand } from '../../core/brand'
import { useApp } from '../../core/store'
import { logoBoxes } from '../../three/logo'
import { CRT_SCREEN } from '../../three/props/CrtTv'
import { layout } from './layout'

export const BLINK_SECONDS = 0.6
const W = 160
const H = 120
const NOISE_W = 96
const NOISE_H = 72

export const blinkOn = (time: number) => Math.floor(time / BLINK_SECONDS) % 2 === 0

export function fillNoise(data: Uint8ClampedArray, rand: () => number) {
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.round(rand() * 255)
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
}

function pixelTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  return texture
}

function drawTitle(title: string, pressStart: string) {
  const base = document.createElement('canvas')
  base.width = W
  base.height = H
  const ctx = base.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#0B1F33'
  ctx.fillRect(0, 0, W, H)
  const colors = { lime: brand.lime, mint: brand.mint, ink: brand.onDark }
  for (const box of logoBoxes(0.5)) {
    ctx.fillStyle = colors[box.color]
    ctx.fillRect(
      Math.round(W / 2 + box.position[0] - box.size[0] / 2),
      Math.round(34 - box.position[1] - box.size[1] / 2),
      Math.round(box.size[0]),
      Math.round(box.size[1]),
    )
  }
  ctx.fillStyle = brand.lime
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(title.toUpperCase(), W / 2, 84)

  const press = document.createElement('canvas')
  press.width = W
  press.height = H
  const pctx = press.getContext('2d')!
  pctx.imageSmoothingEnabled = false
  pctx.fillStyle = brand.onDark
  pctx.font = 'bold 10px monospace'
  pctx.textAlign = 'center'
  pctx.fillText(pressStart.toUpperCase(), W / 2, 106)

  return { base: pixelTexture(base), press: pixelTexture(press) }
}

function createNoise() {
  const canvas = document.createElement('canvas')
  canvas.width = NOISE_W
  canvas.height = NOISE_H
  const ctx = canvas.getContext('2d')!
  return { ctx, image: ctx.createImageData(NOISE_W, NOISE_H), texture: pixelTexture(canvas) }
}

/** The TV picture: a pixel-art title with a blinking PRESS START, static noise while flying into the TV. */
export function CrtScreen() {
  const { t } = useTranslation()
  const noiseOn = useApp((s) => s.transition?.via === 'tv')
  const title = useMemo(() => drawTitle(t('crt.title'), t('crt.pressStart')), [t])
  const noise = useMemo(createNoise, [])
  const pressRef = useRef<Mesh>(null)
  const { position, rotationY } = layout.objects.tv
  const [cx, cy, cz] = CRT_SCREEN.center

  useEffect(
    () => () => {
      title.base.dispose()
      title.press.dispose()
    },
    [title],
  )
  useEffect(() => () => noise.texture.dispose(), [noise])

  useFrame((state) => {
    if (pressRef.current) pressRef.current.visible = blinkOn(state.clock.elapsedTime)
    if (noiseOn) {
      fillNoise(noise.image.data, Math.random)
      noise.ctx.putImageData(noise.image, 0, 0)
      noise.texture.needsUpdate = true
    }
  })

  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[cx, cy, cz + 0.001]}>
        <planeGeometry args={[CRT_SCREEN.width, CRT_SCREEN.height]} />
        <meshBasicMaterial map={noiseOn ? noise.texture : title.base} toneMapped={false} />
      </mesh>
      {!noiseOn && (
        <mesh ref={pressRef} position={[cx, cy, cz + 0.002]}>
          <planeGeometry args={[CRT_SCREEN.width, CRT_SCREEN.height]} />
          <meshBasicMaterial map={title.press} transparent toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}
```

- [ ] **Step 7: Rendre le portable et la télé cliquables dans `src/zones/office/OfficeScene.tsx`**

Ajouter les imports :

```tsx
import { useTranslation } from 'react-i18next'
import { Interactive } from '../../three/interactive'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
```

Au début du composant, ajouter `const { t } = useTranslation()`. Remplacer les lignes du portable, de la télé et de la console par :

```tsx
      <Interactive
        id="laptop"
        label={t('objects.laptop')}
        labelPosition={[laptop.position[0], laptop.position[1] + 0.42, laptop.position[2]]}
        onActivate={objectActions.laptop}
      >
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <Interactive
        id="tv"
        label={t('objects.tv')}
        labelPosition={[tv.position[0] - 0.2, tv.position[1] + 0.75, tv.position[2]]}
        onActivate={objectActions.tv}
      >
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
```

Ajouter à la fin de `src/styles/app.css` :

```css
.object-label {
  display: inline-block; padding: 6px 12px; border-radius: var(--oe-radius-pill); border: 1px solid var(--oe-lime);
  background: var(--at-surface-2); color: var(--at-on-dark); font: 700 13px var(--oe-font-ui); white-space: nowrap;
}
```

- [ ] **Step 8: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous, dont 3 + 2 nouveaux).

- [ ] **Step 9: Vérifier dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173/`.
Expected :
- au survol du portable : contour lime, curseur main et étiquette « Prompt Workshop » ; au clic : vol vers l'écran du portable, puis fondu vers la carte de l'atelier ;
- au survol de la télé ou de la console : contour lime et étiquette « The Dungeon » ;
- la télé affiche un titre en pixel art avec « PRESS START » qui clignote ; au clic, de la neige apparaît pendant le vol, puis c'est la carte du donjon ;
- aucun survol ni clic n'agit pendant un vol.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: clickable laptop and TV with lime outline, labels and CRT static

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Ada, le robot

**Files:**
- Create: `src/three/robot/geometry.ts`, `src/three/robot/motion.ts`, `src/three/robot/face.ts`, `src/three/robot/Ada.tsx`, `src/zones/office/AdaController.tsx`
- Modify: `src/zones/office/OfficeScene.tsx`
- Test: `src/three/robot/geometry.test.ts`, `src/three/robot/motion.test.ts`, `src/three/robot/face.test.ts`

**Interfaces:**
- Consumes: `Mood`, `Gesture` (Tâche 5) ; `materials`, `logoBoxes`, `HoverOutline`, `Interactive` (Tâches 16-17) ; `useCurrentBeat` (Tâche 9) ; `objectActions` (Tâche 17) ; `layout.ada` (Tâche 16).
- Produces:
  - `ADA` (dimensions), `HEAD_Y`, `VISOR`, `bodyRadiusAt(y): number`, `bodyProfile(segments?): Vector2[]`
  - `interface GesturePose { bodyYaw; spin; armPX; armNX; headTilt; headNod; bob }`, `NEUTRAL_POSE`, `GESTURE_SECONDS`, `POINT_YAW = 0.9`, `BLINK_SECONDS = 0.12`, `gesturePose(gesture, elapsedSeconds): GesturePose`, `hoverY(time): number`, `nextBlinkDelay(rand): number`
  - `type EyeShape = 'round' | 'happy' | 'dots' | 'big' | 'wink' | 'closed'`, `eyeShapes(mood, blinking): [EyeShape, EyeShape]`, `FACE_W = 512`, `FACE_H = 256`, `drawFace(ctx, shapes, { lookX, lookY, pulse, time })`, `faceKey(shapes, lookX, lookY, pulse, time): string`
  - Composant `Ada` (props de `group` + `mood`, `gesture`, `gestureKey`, `speaking`, `reducedMotion`, `lookAt?: { x: number; y: number }`), autonome et réutilisable par l'atelier (spec 2)
  - Composant `AdaController` (lit le store, rend Ada cliquable, nom d'objet 3D `ada`)
- Conventions : Ada regarde vers +z ; `armPX` est le bras du côté +x (celui qui montre l'écran), `armNX` celui du côté −x (celui qui salue) ; une rotation positive lève le bras vers l'extérieur.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/three/robot/geometry.test.ts` :

```ts
import { ADA, bodyProfile, bodyRadiusAt } from './geometry'

test('the body profile is a closed egg, widest in its upper half', () => {
  const profile = bodyProfile(40)
  expect(profile[0].x).toBeCloseTo(0)
  expect(profile.at(-1)!.x).toBeLessThan(1e-6)
  expect(profile.at(-1)!.y).toBeCloseTo(ADA.bodyHeight)
  profile.slice(1).forEach((point, index) => expect(point.y).toBeGreaterThan(profile[index].y))
  const widest = profile.reduce((best, point) => (point.x > best.x ? point : best))
  expect(widest.y / ADA.bodyHeight).toBeGreaterThan(0.55)
  expect(widest.y / ADA.bodyHeight).toBeLessThan(0.8)
  expect(widest.x).toBeCloseTo(ADA.bodyRadius, 2)
})

test('the radius is zero at the tips and clamped outside the body', () => {
  expect(bodyRadiusAt(0)).toBe(0)
  expect(bodyRadiusAt(-1)).toBe(0)
  expect(bodyRadiusAt(ADA.bodyHeight + 1)).toBeLessThan(1e-6)
})
```

`src/three/robot/motion.test.ts` :

```ts
import { GESTURES } from '../../content/schema'
import { GESTURE_SECONDS, NEUTRAL_POSE, POINT_YAW, gesturePose, hoverY, nextBlinkDelay } from './motion'

test.each(GESTURES)('%s starts and ends in the neutral pose', (gesture) => {
  expect(gesturePose(gesture, 0)).toEqual(NEUTRAL_POSE)
  expect(gesturePose(gesture, GESTURE_SECONDS[gesture] + 0.01)).toEqual(NEUTRAL_POSE)
})

test('pointing turns toward the screen and raises the screen-side arm', () => {
  const pose = gesturePose('pointScreen', GESTURE_SECONDS.pointScreen / 2)
  expect(pose.bodyYaw).toBeCloseTo(POINT_YAW)
  expect(pose.armPX).toBeCloseTo(1.3)
  expect(pose.armNX).toBe(0)
})

test('waving raises the outer arm, nodding tips the head forward', () => {
  expect(gesturePose('wave', GESTURE_SECONDS.wave / 2).armNX).toBeGreaterThan(1.5)
  expect(gesturePose('nod', GESTURE_SECONDS.nod / 4).headNod).toBeGreaterThan(0.1)
})

test('a spin makes one full turn', () => {
  expect(gesturePose('spin', GESTURE_SECONDS.spin * 0.999).spin).toBeCloseTo(Math.PI * 2, 1)
})

test('hovering stays within 4 cm and blinks every 3 to 6 seconds', () => {
  for (let t = 0; t < 10; t += 0.37) expect(Math.abs(hoverY(t))).toBeLessThanOrEqual(0.035)
  expect(nextBlinkDelay(() => 0)).toBe(3)
  expect(nextBlinkDelay(() => 0.999)).toBeCloseTo(6, 1)
})
```

`src/three/robot/face.test.ts` :

```ts
import { MOODS } from '../../content/schema'
import { eyeShapes, faceKey } from './face'

test('each mood has its eye shapes and blinking closes both eyes', () => {
  expect(eyeShapes('neutral', false)).toEqual(['round', 'round'])
  expect(eyeShapes('happy', false)).toEqual(['happy', 'happy'])
  expect(eyeShapes('thinking', false)).toEqual(['dots', 'dots'])
  expect(eyeShapes('surprised', false)).toEqual(['big', 'big'])
  expect(eyeShapes('encouraging', false)).toEqual(['round', 'wink'])
  for (const mood of MOODS) expect(eyeShapes(mood, true)).toEqual(['closed', 'closed'])
})

test('the face is redrawn only when something visible changes', () => {
  const round = eyeShapes('neutral', false)
  expect(faceKey(round, 0.1, 0, 0, 1)).toBe(faceKey(round, 0.1, 0, 0, 5))
  expect(faceKey(round, 0.1, 0, 0, 1)).not.toBe(faceKey(round, 0.2, 0, 0, 1))
  const dots = eyeShapes('thinking', false)
  expect(faceKey(dots, 0, 0, 0, 0)).not.toBe(faceKey(dots, 0, 0, 0, 0.3))
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/three/robot`
Expected: FAIL (modules manquants).

- [ ] **Step 3: Créer `src/three/robot/geometry.ts`**

```ts
import { Vector2 } from 'three'

/** Ada's proportions, in metres. The group origin is the bottom tip of the body. */
export const ADA = {
  bodyHeight: 0.62,
  bodyRadius: 0.24,
  headRadius: 0.18,
  headGap: 0.07,
  armLength: 0.36,
  armX: 0.27,
  armY: 0.5,
  beltY: 0.47,
  chestY: 0.36,
} as const

export const HEAD_Y = ADA.bodyHeight + ADA.headGap + ADA.headRadius * 0.85

/** Front part of the head sphere covered by the black visor (front = +z, i.e. phi = PI/2). */
export const VISOR = { phiStart: Math.PI / 2 - 0.95, phiLength: 1.9, thetaStart: 0.62, thetaLength: 1.2 } as const

/** Egg profile: pointed at the bottom, widest around 68 % of the height, rounded on top. */
export function bodyRadiusAt(y: number): number {
  const s = Math.min(1, Math.max(0, y / ADA.bodyHeight))
  return ADA.bodyRadius * Math.pow(Math.sin(Math.PI * Math.pow(s, 1.8)), 0.6)
}

export function bodyProfile(segments = 32): Vector2[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const y = (i / segments) * ADA.bodyHeight
    return new Vector2(Math.max(0, bodyRadiusAt(y)), y)
  })
}
```

- [ ] **Step 4: Créer `src/three/robot/motion.ts`**

```ts
import type { Gesture } from '../../content/schema'

export interface GesturePose {
  bodyYaw: number
  spin: number
  armPX: number
  armNX: number
  headTilt: number
  headNod: number
  bob: number
}

export const NEUTRAL_POSE: GesturePose = { bodyYaw: 0, spin: 0, armPX: 0, armNX: 0, headTilt: 0, headNod: 0, bob: 0 }

export const GESTURE_SECONDS: Record<Gesture, number> = {
  none: 0,
  wave: 1.6,
  pointScreen: 2.4,
  spin: 1.2,
  nod: 0.9,
  shrug: 1.0,
}

/** Extra body turn toward the wall screen while pointing (the screen is on Ada's +x side). */
export const POINT_YAW = 0.9
export const BLINK_SECONDS = 0.12

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function gesturePose(gesture: Gesture, elapsed: number): GesturePose {
  const duration = GESTURE_SECONDS[gesture]
  if (duration === 0 || elapsed <= 0 || elapsed >= duration) return NEUTRAL_POSE
  const p = elapsed / duration
  const envelope = Math.sin(Math.PI * p)
  switch (gesture) {
    case 'wave':
      return { ...NEUTRAL_POSE, armNX: envelope * 2.2 + Math.sin(elapsed * 14) * 0.3 * envelope, headTilt: envelope * 0.15 }
    case 'pointScreen':
      return { ...NEUTRAL_POSE, bodyYaw: envelope * POINT_YAW, armPX: envelope * 1.3, headTilt: -envelope * 0.08 }
    case 'spin':
      return { ...NEUTRAL_POSE, spin: easeInOut(p) * Math.PI * 2, bob: envelope * 0.08 }
    case 'nod':
      return { ...NEUTRAL_POSE, headNod: Math.sin(p * Math.PI * 2) * 0.18 }
    case 'shrug':
      return { ...NEUTRAL_POSE, armPX: envelope * 0.9, armNX: envelope * 0.9, headTilt: envelope * 0.12 }
    default:
      return NEUTRAL_POSE
  }
}

export const hoverY = (time: number) => Math.sin(time * 1.4) * 0.035

export const nextBlinkDelay = (rand: () => number) => 3 + rand() * 3
```

- [ ] **Step 5: Créer `src/three/robot/face.ts`**

```ts
import type { Mood } from '../../content/schema'
import { brand } from '../../core/brand'

export type EyeShape = 'round' | 'happy' | 'dots' | 'big' | 'wink' | 'closed'

export const FACE_W = 512
export const FACE_H = 256
const EYE_Y = 124
const EYE_DX = 92
const EYE_RX = 34
const EYE_RY = 44

export function eyeShapes(mood: Mood, blinking: boolean): [EyeShape, EyeShape] {
  if (blinking) return ['closed', 'closed']
  switch (mood) {
    case 'happy':
      return ['happy', 'happy']
    case 'thinking':
      return ['dots', 'dots']
    case 'surprised':
      return ['big', 'big']
    case 'encouraging':
      return ['round', 'wink']
    default:
      return ['round', 'round']
  }
}

/** A key that only changes when the drawn face would change. */
export function faceKey(shapes: [EyeShape, EyeShape], lookX: number, lookY: number, pulse: number, time: number): string {
  const dots = shapes.includes('dots') ? Math.floor(time * 4) % 3 : -1
  return `${shapes.join(',')}|${lookX.toFixed(2)}|${lookY.toFixed(2)}|${pulse.toFixed(1)}|${dots}`
}

function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
}

function drawEye(ctx: CanvasRenderingContext2D, shape: EyeShape, cx: number, cy: number, pulse: number, time: number) {
  const scale = 1 + pulse * 0.08
  switch (shape) {
    case 'round':
      ellipse(ctx, cx, cy, EYE_RX * scale, EYE_RY * scale)
      ctx.fill()
      break
    case 'big':
      ellipse(ctx, cx, cy, EYE_RX * 1.3, EYE_RY * 1.25)
      ctx.fill()
      break
    case 'happy':
      ctx.beginPath()
      ctx.arc(cx, cy + 16, EYE_RX, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
      break
    case 'wink':
      ctx.beginPath()
      ctx.moveTo(cx - EYE_RX, cy)
      ctx.lineTo(cx + EYE_RX, cy)
      ctx.stroke()
      break
    case 'closed':
      ctx.beginPath()
      ctx.moveTo(cx - EYE_RX, cy + 4)
      ctx.lineTo(cx + EYE_RX, cy + 4)
      ctx.stroke()
      break
    case 'dots':
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = Math.floor(time * 4) % 3 === k ? 1 : 0.35
        ellipse(ctx, cx - 24 + k * 24, cy, 8, 8)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      break
  }
}

/** Draws both eyes in lime on the black visor texture. lookX/lookY are -1..1 (y up). */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  shapes: [EyeShape, EyeShape],
  { lookX, lookY, pulse, time }: { lookX: number; lookY: number; pulse: number; time: number },
) {
  ctx.fillStyle = '#030405'
  ctx.fillRect(0, 0, FACE_W, FACE_H)
  ctx.save()
  ctx.fillStyle = brand.lime
  ctx.strokeStyle = brand.lime
  ctx.lineCap = 'round'
  ctx.lineWidth = 16
  ctx.shadowColor = brand.lime
  ctx.shadowBlur = 24 + pulse * 16
  shapes.forEach((shape, index) => {
    const cx = FACE_W / 2 + (index === 0 ? -EYE_DX : EYE_DX) + lookX * 22
    const cy = EYE_Y - lookY * 12
    drawEye(ctx, shape, cx, cy, pulse, time)
  })
  ctx.restore()
}
```

- [ ] **Step 6: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/three/robot`
Expected: PASS (2 + 10 + 2 tests).

- [ ] **Step 7: Créer `src/three/robot/Ada.tsx`**

```tsx
import type { ThreeElements } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, LatheGeometry, SRGBColorSpace, type Group } from 'three'
import type { Gesture, Mood } from '../../content/schema'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { materials } from '../materials'
import { FACE_H, FACE_W, drawFace, eyeShapes, faceKey } from './face'
import { ADA, HEAD_Y, VISOR, bodyProfile, bodyRadiusAt } from './geometry'
import { BLINK_SECONDS, NEUTRAL_POSE, gesturePose, hoverY, nextBlinkDelay } from './motion'

export interface AdaProps extends Omit<ThreeElements['group'], 'ref'> {
  mood: Mood
  gesture: Gesture
  /** Change this number to (re)start the gesture. */
  gestureKey: number
  speaking: boolean
  reducedMotion: boolean
  /** Where the eyes look, -1..1 (y up). Defaults to the mouse pointer. */
  lookAt?: { x: number; y: number }
}

function createFace() {
  const canvas = document.createElement('canvas')
  canvas.width = FACE_W
  canvas.height = FACE_H
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return { ctx: canvas.getContext('2d')!, texture, key: '' }
}

function createHalo() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(88, 252, 115, 0.9)')
  gradient.addColorStop(1, 'rgba(88, 252, 115, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Arm() {
  const m = materials()
  return (
    <mesh position-y={-ADA.armLength / 2} scale={[0.055, ADA.armLength / 2, 0.085]} material={m.porcelain} castShadow>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  )
}

function ChestLogo() {
  const m = materials()
  const byColor = { lime: m.lime, mint: m.mint, ink: m.ink }
  const z = bodyRadiusAt(ADA.chestY) + 0.002
  return (
    <group position={[0, ADA.chestY, z]}>
      {logoBoxes(0.0011).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0]} material={byColor[box.color]}>
          <boxGeometry args={[box.size[0], box.size[1], 0.006]} />
        </mesh>
      ))}
    </group>
  )
}

export function Ada({ mood, gesture, gestureKey, speaking, reducedMotion, lookAt, ...group }: AdaProps) {
  const m = materials()
  const body = useRef<Group>(null)
  const head = useRef<Group>(null)
  const armPX = useRef<Group>(null)
  const armNX = useRef<Group>(null)
  const bodyGeometry = useMemo(() => new LatheGeometry(bodyProfile(), 48), [])
  const face = useMemo(createFace, [])
  const halo = useMemo(createHalo, [])
  const gestureStart = useRef({ key: Number.NaN, at: 0 })
  const blink = useRef({ next: 2, until: 0 })
  const look = useRef({ x: 0, y: 0 })

  useEffect(
    () => () => {
      bodyGeometry.dispose()
      face.texture.dispose()
      halo.dispose()
    },
    [bodyGeometry, face, halo],
  )

  useFrame((state, delta) => {
    if (!body.current || !head.current || !armPX.current || !armNX.current) return
    const time = state.clock.elapsedTime
    if (gestureStart.current.key !== gestureKey) gestureStart.current = { key: gestureKey, at: time }
    const pose = reducedMotion ? NEUTRAL_POSE : gesturePose(gesture, time - gestureStart.current.at)
    const idle = reducedMotion ? 0 : Math.sin(time * 1.4) * 0.04

    body.current.position.y = (reducedMotion ? 0 : hoverY(time)) + pose.bob
    body.current.rotation.y = pose.bodyYaw + pose.spin
    armPX.current.rotation.z = pose.armPX + idle
    armNX.current.rotation.z = -pose.armNX - idle

    const goal = lookAt ?? state.pointer
    easing.damp(look.current, 'x', goal.x, 0.35, delta)
    easing.damp(look.current, 'y', goal.y, 0.35, delta)
    head.current.rotation.set(-look.current.y * 0.12 + pose.headNod, look.current.x * 0.25, pose.headTilt)

    if (time > blink.current.next) {
      blink.current.until = time + BLINK_SECONDS
      blink.current.next = time + nextBlinkDelay(Math.random)
    }
    const shapes = eyeShapes(mood, time < blink.current.until)
    const pulse = speaking && !reducedMotion ? 0.5 + 0.5 * Math.sin(time * 18) : 0
    const key = faceKey(shapes, look.current.x, look.current.y, pulse, time)
    if (key !== face.key) {
      drawFace(face.ctx, shapes, { lookX: look.current.x, lookY: look.current.y, pulse, time })
      face.texture.needsUpdate = true
      face.key = key
    }
  })

  return (
    <group {...group}>
      <group ref={body}>
        <mesh geometry={bodyGeometry} material={m.porcelain} castShadow>
          <HoverOutline />
        </mesh>
        <mesh position-y={ADA.beltY} rotation-x={Math.PI / 2} material={m.mint}>
          <torusGeometry args={[bodyRadiusAt(ADA.beltY) + 0.002, 0.005, 8, 64]} />
        </mesh>
        <ChestLogo />
        <group ref={head} position-y={HEAD_Y}>
          <mesh scale={[1, 0.85, 0.95]} material={m.porcelain} castShadow>
            <sphereGeometry args={[ADA.headRadius, 48, 32]} />
            <HoverOutline />
          </mesh>
          <mesh scale={[1, 0.85, 0.95]}>
            <sphereGeometry
              args={[ADA.headRadius * 1.015, 48, 24, VISOR.phiStart, VISOR.phiLength, VISOR.thetaStart, VISOR.thetaLength]}
            />
            <meshPhysicalMaterial
              color="#050607"
              roughness={0.1}
              clearcoat={1}
              emissive="#ffffff"
              emissiveMap={face.texture}
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>
        <group ref={armPX} position={[ADA.armX, ADA.armY, 0]}>
          <Arm />
        </group>
        <group ref={armNX} position={[-ADA.armX, ADA.armY, 0]}>
          <Arm />
        </group>
      </group>
      <mesh position-y={-0.02} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.3, 48]} />
        <meshBasicMaterial map={halo} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 8: Créer `src/zones/office/AdaController.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Gesture, Mood } from '../../content/schema'
import { useCurrentBeat } from '../../core/selectors'
import { useApp } from '../../core/store'
import { Interactive } from '../../three/interactive'
import { Ada } from '../../three/robot/Ada'
import { objectActions } from './interactions'
import { layout } from './layout'

/** Drives Ada from the dialogue: mood and gesture of the current beat, a wave on arrival and when clicked. */
export function AdaController() {
  const { t } = useTranslation()
  const beat = useCurrentBeat()
  const dialogue = useApp((s) => s.dialogue)
  const pokes = useApp((s) => s.adaPokes)
  const reducedMotion = useApp((s) => s.reducedMotion)
  const [gesture, setGesture] = useState<{ name: Gesture; key: number }>({ name: 'wave', key: 1 })
  const beatKey = dialogue ? `${dialogue.topicId}:${dialogue.section}:${dialogue.beatIndex}` : null
  const beatGesture = beat?.gesture

  useEffect(() => {
    if (beatKey && beatGesture && beatGesture !== 'none') {
      setGesture((current) => ({ name: beatGesture, key: current.key + 1 }))
    }
  }, [beatKey, beatGesture])

  useEffect(() => {
    if (pokes > 0) setGesture((current) => ({ name: 'wave', key: current.key + 1 }))
  }, [pokes])

  const mood: Mood = beat?.mood ?? (dialogue ? 'neutral' : 'happy')
  const { position, rotationY } = layout.ada
  return (
    <Interactive
      id="ada"
      label={t('objects.ada')}
      labelPosition={[position[0], position[1] + 1.25, position[2]]}
      onActivate={objectActions.ada}
    >
      <Ada
        name="ada"
        position={position}
        rotation-y={rotationY}
        mood={mood}
        gesture={gesture.name}
        gestureKey={gesture.key}
        speaking={dialogue?.phase === 'typing'}
        reducedMotion={reducedMotion}
      />
    </Interactive>
  )
}
```

- [ ] **Step 9: Placer Ada dans `src/zones/office/OfficeScene.tsx`**

Ajouter l'import `import { AdaController } from './AdaController'`, puis, juste après `<WallScreen3D />` :

```tsx
      <AdaController />
      <ContactShadows
        position={[layout.ada.position[0], 0.006, layout.ada.position[2]]}
        scale={1.4}
        opacity={0.35}
        blur={2.5}
        far={1.6}
        resolution={256}
        frames={1}
      />
```

- [ ] **Step 10: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous).

- [ ] **Step 11: Vérifier Ada dans le navigateur**

Run: `npm run dev`, ouvrir `http://localhost:5173/`, puis passer en vue présentation.
Expected :
- Ada flotte à gauche de l'écran sans le recouvrir ; elle salue à l'arrivée ; ses yeux lime suivent un peu la souris et clignent ;
- en ouvrant « What is AI? », elle se tourne vers l'écran et tend le bras côté écran à la première réplique ; ses yeux pulsent pendant l'écriture ; « thinking » affiche trois points ;
- un clic sur Ada la fait saluer, et son survol affiche le contour lime et l'étiquette « Ada ».

Si Ada chevauche l'écran, ajuster `layout.ada.position[0]`. Si son bras ne pointe pas vers l'écran, ajuster `layout.ada.rotationY` ou `POINT_YAW`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: Ada, the procedural robot, with moods, gestures and a live face

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Son (bips d'Ada et ambiance)

**Files:**
- Create: `src/core/sound.ts`
- Modify: `src/main.tsx`, `src/ui/DialogueBox.tsx`
- Test: `src/core/sound.test.ts`

**Interfaces:**
- Consumes: `TypedLine` et sa prop `onReveal` (Tâche 9) ; `appStore` (Tâche 7).
- Produces: `interface SoundEngine { readonly unlocked: boolean; unlock(): void; setEnabled(on: boolean): void; blip(char: string, index: number): void }`, `BASE_PITCH = 620`, `shouldBlip(char, index): boolean`, `createSound(Ctor?, rand?): SoundEngine`, instance `sound`, `installSoundUnlock(engine, win?): void`.

- [ ] **Step 1: Écrire le test qui échoue `src/core/sound.test.ts`**

```ts
import { createSound, installSoundUnlock, shouldBlip } from './sound'

class FakeParam {
  value = 0
  setValueAtTime() {
    return this
  }
  exponentialRampToValueAtTime() {
    return this
  }
}
class FakeNode {
  connect<T>(node: T) {
    return node
  }
  disconnect() {}
}
class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  start = vi.fn()
  stop = vi.fn()
}
class FakeGain extends FakeNode {
  gain = new FakeParam()
}
class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  start = vi.fn()
  stop = vi.fn()
}
class FakeContext {
  currentTime = 0
  sampleRate = 8000
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  sources: FakeSource[] = []
  createOscillator() {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }
  createGain() {
    return new FakeGain()
  }
  createBiquadFilter() {
    return new FakeFilter()
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  resume() {
    return Promise.resolve()
  }
}

let created: FakeContext[] = []
const Ctor = class extends FakeContext {
  constructor() {
    super()
    created.push(this)
  }
} as unknown as typeof AudioContext

beforeEach(() => {
  created = []
})

test('blips on every other letter or digit, never on spaces or punctuation', () => {
  expect(shouldBlip('a', 0)).toBe(true)
  expect(shouldBlip('a', 1)).toBe(false)
  expect(shouldBlip('7', 2)).toBe(true)
  expect(shouldBlip(' ', 0)).toBe(false)
  expect(shouldBlip('.', 0)).toBe(false)
})

test('stays silent until the first user gesture, then starts the ambience', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.blip('a', 0)
  expect(created).toHaveLength(0)
  engine.unlock()
  expect(engine.unlocked).toBe(true)
  expect(created[0].sources).toHaveLength(1)
  expect(created[0].sources[0].loop).toBe(true)
  engine.blip('a', 0)
  expect(created[0].oscillators).toHaveLength(1)
})

test('does not stack blips at the same instant', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.unlock()
  engine.blip('a', 0)
  engine.blip('b', 2)
  expect(created[0].oscillators).toHaveLength(1)
  created[0].currentTime = 0.1
  engine.blip('c', 4)
  expect(created[0].oscillators).toHaveLength(2)
})

test('muting stops the ambience and the blips; unmuting restarts the ambience', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.unlock()
  engine.setEnabled(false)
  expect(created[0].sources[0].stop).toHaveBeenCalled()
  engine.blip('a', 0)
  expect(created[0].oscillators).toHaveLength(0)
  engine.setEnabled(true)
  expect(created[0].sources).toHaveLength(2)
})

test('a muted engine does not start the ambience on unlock', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.setEnabled(false)
  engine.unlock()
  expect(created[0].sources).toHaveLength(0)
})

test('works without Web Audio', () => {
  const engine = createSound(undefined)
  expect(() => {
    engine.unlock()
    engine.blip('a', 0)
    engine.setEnabled(false)
  }).not.toThrow()
  expect(engine.unlocked).toBe(false)
})

test('the first pointer or key press unlocks the audio once', () => {
  const engine = { unlocked: false, unlock: vi.fn(), setEnabled: vi.fn(), blip: vi.fn() }
  installSoundUnlock(engine)
  window.dispatchEvent(new Event('pointerdown'))
  window.dispatchEvent(new Event('keydown'))
  expect(engine.unlock).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/core/sound.test.ts`
Expected: FAIL (`./sound` introuvable).

- [ ] **Step 3: Créer `src/core/sound.ts`**

```ts
export interface SoundEngine {
  readonly unlocked: boolean
  unlock(): void
  setEnabled(on: boolean): void
  blip(char: string, index: number): void
}

export const BASE_PITCH = 620
const MIN_GAP_SECONDS = 0.045

export function shouldBlip(char: string, index: number): boolean {
  return /[\p{L}\p{N}]/u.test(char) && index % 2 === 0
}

type AudioCtor = new () => AudioContext

/** Ada's voice: short synthesized blips, plus a very quiet room tone. No audio files. */
export function createSound(
  Ctor: AudioCtor | undefined = globalThis.AudioContext,
  rand: () => number = Math.random,
): SoundEngine {
  let ctx: AudioContext | null = null
  let enabled = true
  let ambience: AudioBufferSourceNode | null = null
  let lastBlip = -Infinity

  function startAmbience() {
    if (!ctx || ambience) return
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (rand() * 2 - 1)) / 1.02 // brown noise
      data[i] = last * 3.5
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const gain = ctx.createGain()
    gain.gain.value = 0.035
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start()
    ambience = source
  }

  function stopAmbience() {
    ambience?.stop()
    ambience?.disconnect()
    ambience = null
  }

  return {
    get unlocked() {
      return ctx !== null
    },
    unlock() {
      if (ctx || !Ctor) return
      try {
        ctx = new Ctor()
      } catch {
        ctx = null
        return
      }
      if (enabled) startAmbience()
    },
    setEnabled(on) {
      enabled = on
      if (!ctx) return
      if (on) {
        void ctx.resume()
        startAmbience()
      } else stopAmbience()
    },
    blip(char, index) {
      if (!ctx || !enabled || !shouldBlip(char, index)) return
      const now = ctx.currentTime
      if (now - lastBlip < MIN_GAP_SECONDS) return
      lastBlip = now
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = BASE_PITCH * (0.9 + rand() * 0.25)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.07)
    },
  }
}

export const sound = createSound()

/** Browsers only allow audio after a user gesture: unlock on the first pointer or key press. */
export function installSoundUnlock(engine: SoundEngine, win: Window = window) {
  const handler = () => {
    engine.unlock()
    win.removeEventListener('pointerdown', handler)
    win.removeEventListener('keydown', handler)
  }
  win.addEventListener('pointerdown', handler)
  win.addEventListener('keydown', handler)
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run src/core/sound.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Brancher le son**

Dans `src/main.tsx`, ajouter l'import `import { installSoundUnlock, sound } from './core/sound'` et, après `startRouter(appStore)` :

```ts
sound.setEnabled(appStore.getState().settings.sound)
installSoundUnlock(sound)
appStore.subscribe((state, previous) => {
  if (state.settings.sound !== previous.settings.sound) sound.setEnabled(state.settings.sound)
})
```

Dans `src/ui/DialogueBox.tsx`, ajouter `import { sound } from '../core/sound'` et passer `onReveal` à `TypedLine` :

```tsx
        <TypedLine
          key={`${dialogue.topicId}-${dialogue.section}-${dialogue.beatIndex}`}
          text={beat.say}
          active={dialogue.phase === 'typing' && !reduced}
          onDone={finishTyping}
          onReveal={(char, index) => sound.blip(char, index)}
        />
```

- [ ] **Step 6: Lancer les tests**

Run: `npx vitest run`
Expected: PASS (tous ; dans jsdom, `AudioContext` n'existe pas et le son reste muet).

- [ ] **Step 7: Vérifier à l'oreille**

Run: `npm run dev`, ouvrir le site, cliquer une fois, ouvrir un sujet.
Expected : un léger fond sonore et de petits bips pendant l'écriture ; rien sur la ponctuation ; « Sound on » dans le HUD coupe tout, et le réglage survit à un rechargement.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: synthesized blips for Ada and a quiet room tone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Qualité adaptative et mode réglage

**Files:**
- Create: `src/app/quality.ts`, `src/zones/office/tune.ts`, `src/zones/office/TuneMode.tsx`
- Modify: `src/app/Stage.tsx`, `src/zones/office/OfficeScene.tsx`
- Test: `src/app/quality.test.ts`, `src/zones/office/tune.test.ts`

**Interfaces:**
- Consumes: `layout`, `bumpLayout`, `Vec3` (Tâches 15-16) ; `Lights` (prop `shadows`, Tâche 16) ; noms d'objets 3D (Tâches 16 et 18).
- Produces:
  - `type Quality = 'high' | 'medium' | 'low'`, `QualityContext`, `nextQuality(current, event: 'decline' | 'incline' | 'fallback'): Quality`, `dprFor(quality): number | [number, number]`
  - `TUNABLE`, `type Tunable`, `isTuneEnabled(search, dev): boolean`, `applyTransform(name, position, rotationY): void`, `layoutSnapshot(): object`
  - `TuneMode` (export par défaut ; chargé uniquement en développement avec `?tune`)
- Niveaux : `high` = dpr jusqu'à 1,5 avec ombres ; `medium` = dpr 1 avec ombres ; `low` = dpr 1 sans ombres dynamiques (spec §8.2).

- [ ] **Step 1: Écrire les tests qui échouent**

`src/app/quality.test.ts` :

```ts
import { dprFor, nextQuality } from './quality'

test('declining lowers the resolution first, then drops shadows', () => {
  expect(nextQuality('high', 'decline')).toBe('medium')
  expect(nextQuality('medium', 'decline')).toBe('low')
  expect(nextQuality('low', 'decline')).toBe('low')
})

test('inclining climbs back, fallback goes straight to low', () => {
  expect(nextQuality('low', 'incline')).toBe('medium')
  expect(nextQuality('medium', 'incline')).toBe('high')
  expect(nextQuality('high', 'fallback')).toBe('low')
})

test('pixel ratio per level', () => {
  expect(dprFor('high')).toEqual([1, 1.5])
  expect(dprFor('medium')).toBe(1)
  expect(dprFor('low')).toBe(1)
})
```

`src/zones/office/tune.test.ts` :

```ts
import { layout, layoutVersion } from './layout'
import { applyTransform, isTuneEnabled, layoutSnapshot } from './tune'

test('tuning is only available in development with ?tune', () => {
  expect(isTuneEnabled('?tune', true)).toBe(true)
  expect(isTuneEnabled('?tune', false)).toBe(false)
  expect(isTuneEnabled('', true)).toBe(false)
})

test('moving an object updates the layout and bumps its version', () => {
  const before = layoutVersion.current
  applyTransform('laptop', [1, 2, 3], 0.5)
  expect(layout.objects.laptop).toEqual({ position: [1, 2, 3], rotationY: 0.5 })
  applyTransform('ada', [-3, 1, -4], 0.2)
  expect(layout.ada).toEqual({ position: [-3, 1, -4], rotationY: 0.2 })
  applyTransform('table', [0, 0, 0], 1)
  expect(layout.objects.table).toEqual({ position: [0, 0, 0] })
  expect(layoutVersion.current).toBe(before + 3)
})

test('the snapshot is plain JSON with every tunable section', () => {
  const snapshot = layoutSnapshot()
  expect(Object.keys(snapshot)).toEqual(['rail', 'flights', 'objects', 'screen', 'ada', 'lights'])
  expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/app/quality.test.ts src/zones/office/tune.test.ts`
Expected: FAIL (modules manquants).

- [ ] **Step 3: Créer `src/app/quality.ts`**

```ts
import { createContext } from 'react'

export type Quality = 'high' | 'medium' | 'low'

export const QualityContext = createContext<Quality>('high')

const ORDER: Quality[] = ['low', 'medium', 'high']

export function nextQuality(current: Quality, event: 'decline' | 'incline' | 'fallback'): Quality {
  if (event === 'fallback') return 'low'
  const index = ORDER.indexOf(current) + (event === 'incline' ? 1 : -1)
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, index))]
}

export function dprFor(quality: Quality): number | [number, number] {
  return quality === 'high' ? [1, 1.5] : 1
}
```

- [ ] **Step 4: Créer `src/zones/office/tune.ts`**

```ts
import { bumpLayout, layout, type Vec3 } from './layout'

export const TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'cabinet', 'tv', 'retroConsole', 'sofa', 'logo'] as const
export type Tunable = (typeof TUNABLE)[number]

export function isTuneEnabled(search: string, dev: boolean): boolean {
  return dev && new URLSearchParams(search).has('tune')
}

/** Writes a transform made in the tuning panel back into the layout. */
export function applyTransform(name: Tunable, position: Vec3, rotationY: number) {
  if (name === 'ada') {
    layout.ada.position = position
    layout.ada.rotationY = rotationY
  } else if (name === 'screen') {
    layout.screen.position = position
  } else {
    const entry = layout.objects[name]
    entry.position = position
    if (entry.rotationY !== undefined) entry.rotationY = rotationY
  }
  bumpLayout()
}

/** The values to paste back into layout.ts once the scene looks right. */
export function layoutSnapshot() {
  const { rail, flights, objects, screen, ada, lights } = layout
  return JSON.parse(JSON.stringify({ rail, flights, objects, screen, ada, lights })) as Record<string, unknown>
}
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/app/quality.test.ts src/zones/office/tune.test.ts`
Expected: PASS (3 + 3 tests).

- [ ] **Step 6: Créer `src/zones/office/TuneMode.tsx`**

```tsx
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { button, useControls } from 'leva'
import { useEffect, useState } from 'react'
import type { Object3D } from 'three'
import { bumpLayout, layout, type Vec3 } from './layout'
import { TUNABLE, applyTransform, layoutSnapshot, type Tunable } from './tune'

type XYZ = { x: number; y: number; z: number }
const toXYZ = ([x, y, z]: Vec3): XYZ => ({ x, y, z })

/** Development only (?tune): drag objects with gizmos, edit the camera rail, copy the values. */
export default function TuneMode() {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)

  const { object, mode } = useControls('Objects', {
    object: { options: [...TUNABLE], value: 'laptop' },
    mode: { options: ['translate', 'rotate'], value: 'translate' },
    'copy layout': button(() => {
      void navigator.clipboard.writeText(JSON.stringify(layoutSnapshot(), null, 2))
    }),
  })

  // leva's schema types do not follow a generated object, hence the loose record.
  const railSchema: Record<string, unknown> = {}
  layout.rail.forEach((point, index) => {
    railSchema[`p${index} position`] = {
      value: toXYZ(point.position),
      step: 0.05,
      onChange: (v: XYZ) => {
        point.position = [v.x, v.y, v.z]
        bumpLayout()
      },
    }
    railSchema[`p${index} target`] = {
      value: toXYZ(point.target),
      step: 0.05,
      onChange: (v: XYZ) => {
        point.target = [v.x, v.y, v.z]
        bumpLayout()
      },
    }
  })
  useControls('Camera rail', railSchema as Parameters<typeof useControls>[1])

  useEffect(() => {
    setTarget(scene.getObjectByName(object) ?? null)
  }, [scene, object])

  if (!target) return null
  return (
    <TransformControls
      object={target}
      mode={mode as 'translate' | 'rotate'}
      showY={mode === 'translate'}
      onObjectChange={() => applyTransform(object as Tunable, target.position.toArray() as Vec3, target.rotation.y)}
    />
  )
}
```

Note : en mode rotation, seul l'axe vertical sert (le layout ne stocke que `rotationY`). Déplacer la télé ne déplace pas son image (`CrtScreen`) avant un rechargement : copier les valeurs dans `layout.ts`, puis recharger.

- [ ] **Step 7: Qualité adaptative et mode réglage dans `src/app/Stage.tsx`**

Remplacer le fichier :

```tsx
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useState } from 'react'
import { appStore, useApp } from '../core/store'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import { QualityContext, dprFor, nextQuality, type Quality } from './quality'
import { SceneReadySignal } from './SceneReadySignal'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const [quality, setQuality] = useState<Quality>('high')
  const change = (event: 'decline' | 'incline' | 'fallback') => setQuality((current) => nextQuality(current, event))
  return (
    <div className="stage" data-testid="stage">
      <Canvas
        shadows
        dpr={dprFor(quality)}
        frameloop={active ? 'always' : 'demand'}
        camera={{ fov: 45, near: 0.1, far: 60, position: [1.6, 2.4, 5.7] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault()
              appStore.getState().reportWebglLost()
            },
            { once: true },
          )
        }}
      >
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => change('decline')}
          onIncline={() => change('incline')}
          onFallback={() => change('fallback')}
        >
          <QualityContext.Provider value={quality}>
            <SceneReadySignal />
            <Suspense fallback={null}>
              <OfficeScene />
            </Suspense>
            {TuneMode && tuneEnabled && (
              <Suspense fallback={null}>
                <TuneMode />
              </Suspense>
            )}
          </QualityContext.Provider>
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}
```

Dans `src/zones/office/OfficeScene.tsx`, ajouter `import { useContext } from 'react'` et `import { QualityContext } from '../../app/quality'`, lire `const quality = useContext(QualityContext)` au début du composant et remplacer `<Lights />` par :

```tsx
      <Lights shadows={quality !== 'low'} />
```

- [ ] **Step 8: Lancer les tests et vérifier le build de production**

Run: `npm run check`
Expected : tout passe ; « Initial JS (gzip) » sous 1,50 Mo ; aucun fichier de `leva` dans le JS initial (`grep -l leva dist/assets/*.js` ne renvoie que des chunks chargés à la demande, ou rien).

- [ ] **Step 9: Vérifier le mode réglage**

Run: `npm run dev`, ouvrir `http://localhost:5173/?tune`.
Expected : le panneau leva apparaît ; choisir « sofa » affiche une poignée de déplacement ; déplacer le canapé fonctionne ; « copy layout » copie un JSON contenant la nouvelle position ; modifier un point du rail change le cadrage. Sans `?tune`, aucun panneau.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: adaptive quality and a dev-only tuning mode for the office layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: Tests de bout en bout, preuves et README

**Files:**
- Create: `src/app/testApi.ts`, `src/app/TestApiBridge.tsx`, `playwright.config.ts`, `tests/e2e/office.spec.ts`, `tests/e2e/reading.spec.ts`, `docs/evidence/office/perf.md`, `README.md`
- Modify: `src/main.tsx`, `src/app/Stage.tsx`
- Test: `src/app/testApi.test.ts`

**Interfaces:**
- Consumes: `appStore`, `AppState`, `HoverTarget` (Tâche 7) ; `objectActions` (Tâche 17) ; noms d'objets 3D (Tâches 16 et 18).
- Produces: `interface AcademyTestApi { state(): AppState; clickObject(target: HoverTarget): void; screenPosition?(name: string): { x: number; y: number } | null }`, `window.__academy` (développement uniquement), `installTestApi(store, win?)`, composant `TestApiBridge`.

- [ ] **Step 1: Écrire le test qui échoue `src/app/testApi.test.ts`**

```ts
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { installTestApi } from './testApi'

beforeEach(() => resetAppStore())
afterEach(() => {
  delete window.__academy
})

test('exposes the state and the object actions', () => {
  installTestApi(appStore)
  expect(window.__academy?.state().zone).toBe('office')
  window.__academy?.clickObject('laptop')
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: 'laptop', stage: 'flight' })
})
```

Run: `npx vitest run src/app/testApi.test.ts`
Expected: FAIL (`./testApi` introuvable).

- [ ] **Step 2: Créer `src/app/testApi.ts` et `src/app/TestApiBridge.tsx`**

`src/app/testApi.ts` :

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Pixel position of a named 3D object's centre; added by TestApiBridge once the canvas is ready. */
  screenPosition?: (name: string) => { x: number; y: number } | null
}

declare global {
  interface Window {
    __academy?: AcademyTestApi
  }
}

/** Development-only hooks for Playwright. Never installed in production builds. */
export function installTestApi(store: StoreApi<AppState>, win: Window = window) {
  win.__academy = { state: () => store.getState(), clickObject: (target) => objectActions[target]() }
}
```

`src/app/TestApiBridge.tsx` :

```tsx
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3 } from 'three'

export function TestApiBridge() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.screenPosition = (name) => {
      const object = scene.getObjectByName(name)
      if (!object) return null
      const centre = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera)
      return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height }
    }
    return () => {
      delete api.screenPosition
    }
  }, [scene, camera, size])

  return null
}
```

Dans `src/main.tsx`, ajouter `import { installTestApi } from './app/testApi'` et, avant `createRoot(...)` :

```ts
if (import.meta.env.DEV) installTestApi(appStore)
```

Dans `src/app/Stage.tsx`, ajouter `import { TestApiBridge } from './TestApiBridge'` et placer `{import.meta.env.DEV && <TestApiBridge />}` juste après `<SceneReadySignal />`.

Run: `npx vitest run src/app/testApi.test.ts`
Expected: PASS.

- [ ] **Step 3: Créer `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
```

- [ ] **Step 4: Créer `tests/e2e/office.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test'

const EVIDENCE = 'docs/evidence/office'

async function openOffice(page: Page, hash = '') {
  // A hash-only change would not reload the page: go through a blank page to start fresh.
  await page.goto('about:blank')
  await page.goto(`/${hash}`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
}

const state = (page: Page) => page.evaluate(() => window.__academy!.state())

async function pressUntilVisible(page: Page, name: string) {
  const target = page.getByRole('button', { name })
  for (let i = 0; i < 40 && !(await target.isVisible()); i++) await page.keyboard.press('Space')
  await expect(target).toBeVisible()
}

test('scroll to the presentation view, learn a topic and keep the progress', async ({ page }) => {
  await openOffice(page)
  await expect(page.getByText('Scroll to take a seat')).toBeVisible()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${EVIDENCE}/01-overview.png` })

  await page.mouse.move(800, 300)
  await page.mouse.wheel(0, -1500)
  await expect.poll(async () => (await state(page)).railTarget).toBe(1)

  await page.getByRole('button', { name: /Learn the basics/ }).click()
  await page.getByRole('button', { name: /What is AI\?/ }).click()
  await expect(page.locator('.wall-screen [data-testid="screen-content"]')).toContainText('AI is a family of ideas')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${EVIDENCE}/02-presentation.png` })

  await pressUntilVisible(page, 'Go deeper')
  await expect(page.getByTestId('progress')).toHaveText('1/13 topics')
  await page.getByRole('button', { name: 'Go deeper' }).click()
  await pressUntilVisible(page, 'All topics')
  await expect(page.getByRole('button', { name: 'Go deeper' })).toHaveCount(0)
  expect((await state(page)).progress.deeperSeen).toContain('what-is-ai')

  await page.reload()
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: 60_000 })
  await expect(page.getByTestId('progress')).toHaveText('1/13 topics')
})

test('the real 3D laptop and the TV lead to their zones and back', async ({ page }) => {
  await openOffice(page)
  await page.waitForTimeout(1500)
  const approx = await page.evaluate(() => window.__academy!.screenPosition!('laptop'))
  expect(approx).not.toBeNull()
  // Moving the mouse shifts the view a little (parallax): let it settle, then aim again.
  await page.mouse.move(approx!.x, approx!.y)
  await page.waitForTimeout(1200)
  const laptop = await page.evaluate(() => window.__academy!.screenPosition!('laptop'))
  await page.mouse.move(laptop!.x, laptop!.y)
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
  await page.screenshot({ path: `${EVIDENCE}/03-hover-laptop.png` })
  await page.mouse.click(laptop!.x, laptop!.y)
  await expect(page.getByRole('heading', { name: 'Prompt Workshop' })).toBeVisible()
  await page.screenshot({ path: `${EVIDENCE}/04-workshop-soon.png` })
  await page.getByRole('button', { name: /Back to the office/ }).click()
  await expect.poll(async () => (await state(page)).zone).toBe('office')

  await page.evaluate(() => window.__academy!.clickObject('tv'))
  await expect(page.getByRole('heading', { name: 'The Dungeon' })).toBeVisible()
  await page.goBack()
  await expect.poll(async () => (await state(page)).zone).toBe('office')
  expect(new URL(page.url()).hash).toBe('#/office')
})

test('everything works from the keyboard', async ({ page }) => {
  await openOffice(page)
  await page.keyboard.press('ArrowUp')
  await expect.poll(async () => (await state(page)).railTarget).toBe(0.25)

  const focusText = () => page.evaluate(() => document.activeElement?.textContent ?? '')
  for (let i = 0; i < 15 && !(await focusText()).includes('Learn the basics'); i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tablist')).toBeVisible()
  for (let i = 0; i < 25 && !(await focusText()).includes('What is AI?'); i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('dialogue-line')).toBeVisible()
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  expect((await state(page)).dialogue?.beatIndex).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tablist')).toBeVisible()
  await page.keyboard.press('Escape')
  expect((await state(page)).menuOpen).toBe(false)
})

test('the wheel over a panel does not move the camera', async ({ page }) => {
  await openOffice(page)
  await page.getByRole('button', { name: /Learn the basics/ }).click()
  const menu = page.locator('.topic-menu')
  const box = (await menu.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 800)
  await page.waitForTimeout(300)
  expect((await state(page)).railTarget).toBe(1)
})

test('deep links open topics and bad links land on the office', async ({ page }) => {
  await openOffice(page, '#/office?topic=tokens')
  await expect(page.locator('.dialogue .at-kicker')).toHaveText('Tokens')
  await openOffice(page, '#/office?topic=nope')
  await expect(page.getByRole('button', { name: /Learn the basics/ })).toBeVisible()
  await openOffice(page, '#/nowhere')
  expect(new URL(page.url()).hash).toBe('#/office')
})
```

- [ ] **Step 5: Créer `tests/e2e/reading.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return null
      return (original as (...params: unknown[]) => RenderingContext | null).call(this, type, ...args)
    } as typeof original
  })
})

test('without WebGL the site opens in reading mode and the tokens demo works', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Reading mode' })).toBeVisible()
  await expect(page.getByTestId('stage')).toHaveCount(0)

  await page.getByRole('tab', { name: /How it works/ }).click()
  await page.getByRole('button', { name: /^Tokens/ }).click()
  await expect(page.getByTestId('screen-content')).toContainText('AI reads in chunks')
  await page.screenshot({ path: 'docs/evidence/office/05-reading-mode.png' })

  await page.getByRole('button', { name: 'Try it yourself' }).click()
  const box = page.getByRole('textbox', { name: 'Type a sentence' })
  await expect(page.getByText('9 tokens · 35 characters').last()).toBeVisible()
  await box.fill('Hello world')
  await expect(page.getByText(/tokens · 11 characters/)).toBeVisible()
  await page.screenshot({ path: 'docs/evidence/office/06-tokens-demo.png' })
})
```

- [ ] **Step 6: Lancer les tests de bout en bout**

Run: `mkdir -p docs/evidence/office && npm run e2e`
Expected : 6 tests PASS ; les captures `01` à `06` existent dans `docs/evidence/office/`. En cas d'échec, lire la trace (`test-results/`) et corriger le code, pas le test, sauf si le test contredit le spec.

- [ ] **Step 7: Mesurer les performances**

Run: `npm run dev`, puis ouvrir `http://localhost:5173/` dans le navigateur intégré (vraie carte graphique), fenêtre de 1600 × 900. Dans la console, exécuter en vue d'ensemble puis en vue présentation :

```js
await new Promise((resolve) => {
  let frames = 0
  const start = performance.now()
  const tick = () => {
    frames++
    if (performance.now() - start < 5000) requestAnimationFrame(tick)
    else resolve(Math.round(frames / 5))
  }
  requestAnimationFrame(tick)
})
```

puis, après un rechargement, mesurer le temps jusqu'à l'affichage du bureau :

```js
await new Promise((resolve) => {
  const check = () => (window.__academy?.state().sceneReady ? resolve(Math.round(performance.now())) : setTimeout(check, 20))
  check()
})
```

Run: `npm run build && npm run budget`

Écrire les valeurs dans `docs/evidence/office/perf.md` :

```markdown
# Mesures — bureau (sous-projet 1)

- Date : <date du jour>
- Machine : <modèle du PC, carte graphique>
- Navigateur : <Chrome/Edge + version>, fenêtre 1600 × 900

| Mesure | Valeur | Cible |
|---|---|---|
| Images/s, vue d'ensemble | <n> | 60 |
| Images/s, vue présentation | <n> | 60 |
| Bureau affiché après | <n> ms | < 3000 ms |
| JS initial (gzip) | <n> Mo | ≤ 1,50 Mo |
```

Les `<…>` sont les valeurs mesurées à cette étape ; aucune ne doit rester vide. Si les images/s sont sous 50, le noter et indiquer le niveau de qualité atteint (`PerformanceMonitor`).

- [ ] **Step 8: Créer `README.md`**

````markdown
# Athena Prompt Academy

Internal, PC-only training site to learn prompting. A 3D office (three.js, React Three Fiber) where Ada, a robot assistant, explains the basics of generative AI while a wall screen shows diagrams. The laptop leads to the prompt workshop and the retro console to the dungeon (both coming in later sub-projects).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — best on Chrome or Edge, window at least 1280 × 720.

## Check

```bash
npm run check
```

Runs the type check, the unit and content tests, the production build and the bundle budget (initial JS ≤ 1.5 MB gzip).

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

Put the file in `public/models/` and declare it in `glbModels` (`src/three/objects.tsx`). The model must share the procedural object's origin (floor level, centred), orientation (front = +z) and scale (metres).

## Project docs

- Spec: `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`
- Plan: `docs/superpowers/plans/2026-09-29-athena-prompt-academy-office.md`
````

- [ ] **Step 9: Vérification finale**

Run: `npm run check && npm run e2e`
Expected : tout passe. Relire les critères de succès du spec (§1) un par un et noter, pour chacun, la preuve correspondante (test, capture ou mesure).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "test: end-to-end journeys, evidence screenshots, performance notes and README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
