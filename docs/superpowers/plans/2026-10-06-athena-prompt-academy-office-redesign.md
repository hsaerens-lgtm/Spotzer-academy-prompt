# Athena Prompt Academy — Refonte visuelle du bureau — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refaire entièrement le rendu du bureau 3D en salle de réunion d'agence réaliste et chaleureuse — surfaces PBR texturées, plantes partout, grande baie vitrée sur une ville 3D et cycle jour → coucher → nuit à lumière dynamique — sans changer la disposition de la salle ni les parcours de la spec 1.

**Architecture:** Une chaîne de préparation de développement (`scripts/assets/`, glTF-Transform, sharp, meshoptimizer) télécharge les assets CC0 listés dans un manifeste et commite sous `public/assets/` des GLB compressés en meshopt et des textures WebP, avec leurs crédits ; à l'exécution, un chargeur de textures unique et une fabrique de matériaux PBR habillent la pièce et le mobilier en code, et le registre `objects.tsx` charge les modèles. Un module de phase pur et l'état global (`phase`, transition en cours) pilotent image par image un seul mélange de préréglages repris de Horn.os, qui règle les lumières, l'exposition, l'environnement en `Lightformer`, le dôme de ciel et la ville instanciée. La scène se charge en deux étages (socle compilé avant la première image, décor ensuite dans sa propre frontière `Suspense`), sans post-traitement : l'écran mural DOM reste visible par son trou dans le canvas.

**Tech Stack:** React 19.3, @react-three/fiber 9.8.1, @react-three/drei 10.7.9, three 0.186.1, zustand 5.0.15, zod 4.6.5, i18next 26, Vite 8.3, TypeScript 7.0, Vitest 5.0, Playwright 1.63, Node 24 ; outils de développement ajoutés : `@gltf-transform/core` 4.5.1, `@gltf-transform/functions` 4.5.1, `@gltf-transform/extensions` 4.5.1, `meshoptimizer` 1.2.0, `sharp` 0.35.5.

**Spec:** `docs/superpowers/specs/2026-10-06-athena-prompt-academy-office-redesign-design.md` (remplace les parties visuelles de `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`, dont les parcours, le dialogue et le mode lecture restent valables).

## Global Constraints

Critères de réussite de la spec (§1), contraignants :
- **Tout est texturé.** Chaque surface visible du bureau utilise un matériau PBR avec au moins une carte de couleur et une carte de normales ou de rugosité, ou un modèle CC0 avec ses propres textures. Seuls les matériaux émissifs, le verre, les écrans et le ciel en sont dispensés. Un audit des matériaux exposé par l'API de test le vérifie (§9).
- **Cycle de lumière.** L'heure locale choisit la phase à l'arrivée : jour 07:00–17:59, coucher 18:00–20:59, nuit 21:00–06:59. Un clic sur l'horloge murale, ou le bouton « Time of day » du HUD, passe à la phase suivante. La transition dure 2,5 s et l'on voit le soleil bouger. `?phase=day|sunset|night` force une phase. En mode « réduire les animations », le changement est instantané.
- **La ville se voit.** La vue d'ensemble garde un cadrage proche de l'actuel, où le coin rétro et le laptop restent visibles, avec la baie vitrée sur la plus grande part d'image compatible : environ 14 % au repos, contre 12 % aujourd'hui. L'écran de la télé doit rester lisible de face, à 73° au plus, comme aujourd'hui. Le rail est orienté vers la façade : environ 26 % de baie à mi-parcours et 18 % en vue présentation. Les seuils exacts sont mesurés et fixés dans le plan. La ville se découvre en se déplaçant le long du rail et apparaît derrière Ada dans la vue présentation. (Amendement du 2026-10-07, choix B du propriétaire : on peut bouger la caméra, il n'est donc pas nécessaire de sacrifier le coin rétro pour viser un quart de l'image.)
- **Les parcours de la spec 1 passent toujours.** Tous les tests e2e existants restent verts : survol et clic du laptop, télé, défilement du rail, texte de l'écran mural, format 1280 × 600.
- **Performances sur le PC de référence** (Radeon 860M intégrée, 1600 × 900, échelle 1,5) : au moins 60 images/s en vue d'ensemble et en vue présentation, dans chaque phase ; le niveau de qualité ne doit pas tomber à `low` ; bureau affiché en moins de 3 s (production) ; tous les décors chargés en moins de 8 s au premier chargement (production locale).
- **Budget et hébergement.** Le JS initial reste ≤ 1,5 Mo gzip. Tous les assets sont hébergés par le site. Aucun appel à un CDN à l'exécution : ni décodeur Draco de gstatic, ni environnement drei de githack.
- **Licences.** Uniquement des assets CC0 (Poly Haven, ambientCG), plus le code du propriétaire repris de Horn.os. Chaque fichier sous `public/assets/` figure dans `public/assets/CREDITS.md` avec sa source, sa licence et sa taille ; un test le vérifie.
- **Preuves.** Captures des 3 phases × 2 vues (vue d'ensemble, vue présentation). Le propriétaire juge le niveau Horn.os sur ces captures.

Valeurs contraignantes (spec §4, §5, §7) :
- `Phase = 'day' | 'sunset' | 'night'` ; transition de 2,5 s adoucie, une seule valeur `t` pilote toutes les lumières, l'exposition, le ciel, le brouillard et le soleil ; `?phase=` est lu au démarrage et n'est jamais réécrit dans l'URL ; en « réduire les animations » ou en mode lecture, le passage est instantané.
- Environnement (`scene.environmentIntensity`) 0,32 / 0,18 / 0,05 et exposition ACES 1,0 / 1,0 / 1,15 (jour / coucher / nuit). Une seule lumière projette des ombres (soleil ou lune, directionnelle, par la baie) ; carte d'ombre 2048 px en `high`, 1024 en `medium`, aucune en `low`.
- Aiguilles de l'horloge : 14:00, 19:30, 23:00 selon la phase ; elles tournent pendant les transitions.
- Budgets d'assets : `public/assets` ≤ 18 Mo au total ; assets nécessaires à la première image ≤ 6 Mo ; aucun fichier ≥ 3 Mo. Ici « Mo » = Mio (1 048 576 octets), la convention de `scripts/check-bundle.mjs`.
- Niveaux de qualité : `high` dpr ≤ 1,5, ombre 2048, toutes les lumières, plantes animées ; `medium` dpr 1, ombre 1024, lumières d'appoint réduites ; `low` dpr 1, pas d'ombre dynamique, plantes immobiles, fenêtres de la ville figées.
- e2e en rendu logiciel : le socle est prêt en moins de 60 s ; les tests de parcours n'attendent pas le décor.

Règles de code :
- Assets hébergés par le site sous `public/assets/` ; chaque URL passe par `publicUrl()` (`src/core/publicUrl.ts`), jamais de `/` initial.
- Aucun CDN : modèles chargés uniquement par `useGLTF(url, false, true)` (Draco désactivé, décodeur meshopt intégré à drei) ; `<Environment>` de drei uniquement avec des enfants `Lightformer` (jamais `preset` ni `files`) ; pas de KTX2, pas de `useGLTF.setDecoderPath`.
- Aucun préchargement au niveau module (`useGLTF.preload`, `useTexture.preload`) : le mode lecture ne charge aucun asset 3D (§8).
- Pas de post-traitement (ni `EffectComposer`, ni `@react-three/postprocessing`). L'écran mural reste un `<Html transform occlude="blending">` derrière le canvas (canvas `z-index: 2`, `position: absolute`, vérifiés par l'e2e) ; aucun verre ni objet transparent devant lui.
- Couleurs : les couleurs de marque viennent uniquement de `src/core/brand.ts` ; toutes les autres teintes de matériaux sont des constantes de `src/three/tints.ts` ; les couleurs des lumières, du ciel et du brouillard vivent dans `src/zones/office/lighting/presets.ts` et `src/zones/office/lighting/rig.ts`. Aucun littéral hexadécimal (`#rgb`, `#rrggbb`, `0xrrggbb`) ailleurs dans `src/three/**` et `src/zones/office/**` (exception : `src/three/robot/face.ts`, inchangé) ; contrôlé par `src/three/colours.test.ts` (Tâche 15). Les peintres de textures procédurales peuvent calculer des `rgb()` / `rgba()`.
- Texte visible : uniquement depuis `content/en/ui.json` ; deux clés nouvelles, `hud.timeOfDay` et `objects.clock`. Aucune texture procédurale (dos de livres, affiches, écran du laptop) ne porte de lettres.
- Pas de `React.StrictMode` (spec 1) ; aucun emoji, nulle part.
- L'API de test `window.__academy` n'apparaît que dans `src/app/testApi.ts` et `src/app/TestApiBridge.tsx`, importés seulement derrière `import.meta.env.DEV` ; `npm run budget` échoue si `__academy` atteint un chunk de production.
- Code repris de Horn.os : en-tête `// Ported from Horn.os (owner's project): <chemin d'origine>` ; le générateur LCG de Horn (`s = s * 1664525 + 1013904223`) est conservé pour des générations reproductibles.
- Dépendances : seules ces cinq dépendances de développement s'ajoutent, en versions exactes (`npm install -D --save-exact`), aucune dépendance d'exécution :
  - `@gltf-transform/core@4.5.1`, `@gltf-transform/functions@4.5.1`, `@gltf-transform/extensions@4.5.1` (aucune dépendance pair ; dépendances internes `^4.5.1`) ;
  - `meshoptimizer@1.2.0` (la version que déclare la CLI glTF-Transform 4.5.1, `~1.2.0` ; la 1.3.0 n'est pas retenue) ;
  - `sharp@0.35.5` (moteur `node >=20.9.0` ; binaire précompilé `@img/sharp-win32-x64@0.35.5` installé automatiquement sous Windows 11 x64 / Node 24 ; la CLI glTF-Transform 4.5.1 déclare `~0.35.3`).
- Les scripts Node (`scripts/**/*.mjs`) n'importent du TypeScript que depuis `src/assets/paths.ts` (aucun import, syntaxe effaçable), grâce à la suppression native des types de Node 24 ; ils tournent avec `node --disable-warning=ExperimentalWarning`.
- Tests unitaires : sortie propre (aucun avertissement nouveau) ; aucun test unitaire n'appelle `canvas.getContext` (absent de jsdom) : les textures procédurales testées sont des `DataTexture`. Les tests qui lisent le disque commencent par `// @vitest-environment node`.
- `npm run check` passe à la fin de chaque tâche ; les tâches qui touchent un parcours e2e lancent aussi le sous-ensemble Playwright indiqué.
- Les tâches de rendu enregistrent des captures pour le contrôleur avec `node scripts/shots.mjs` (Chromium avec interface, `--use-angle=d3d11`, 1600 × 900) dans `.superpowers/review-shots/task-N/` ; ces captures ne sont pas commitées (`.superpowers/` est ignoré par git).
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Résolutions du plan sur la spec (décidées à la rédaction du plan) :
- **Seuils de la baie (critère 3 amendé, valeurs mesurées).** Avec le coin rétro entier dans le cadre, l'image de la télé tournée vers la caméra à 73° au plus (71,9° mesurés ; vue actuelle : 68,8°), le laptop dégagé, l'écran mural et Ada dans le cadre, la baie couvre au plus 13,9 % de l'image en 16:9 (16,3 % en 1280 × 600 ; vue actuelle : 12,1 %) : c'est l'« environ 14 % au repos » de la spec ; davantage demandait de voir l'écran de la télé par la tranche ou de couper le coin rétro par le bord du cadre. Le plan fixe la vue d'ensemble `(2.0, 2.5, 5.8) → (0.4, 0.95, −1.3)` et les seuils des tests de la Tâche 5 : baie ≥ 13,5 % en 16:9 et ≥ 15,5 % en 1280 × 600 au repos, ≥ 12 % et ≥ 14 % aux extrêmes de la parallaxe ; télé ≤ 73° ; au point intermédiaire du rail, au moins 5 points de plus qu'en vue d'ensemble (25,7 % mesurés pour l'« environ 26 % » de la spec) ; en vue présentation, retour vitré ≥ 17 % derrière Ada (18,4 % mesurés pour les « 18 % » de la spec). La télé et la console restent visibles et cliquables dès la vue d'ensemble ; la phrase d'accueil « the laptop and the old console are clickable too » reste juste.
- **Palmier.** Le palmier du coin salon passe en `[4.45, 0, -2.9]` (échelle 0.9) : à sa place précédente, il masquait une partie du coin rétro depuis la nouvelle vue d'ensemble.
- **Caisson.** `drawer_cabinet` mesure 1,88 m de haut : il ne peut pas porter la télé. Le groupe `cabinet` devient ce caisson (décor), contre le mur de droite ; la télé et la console reposent sur un meuble bas en code, `tvStand` (socle), à l'ancienne place du caisson.
- **Buffet.** Un `modern_wooden_cabinet` (2,44 m) ne peut pas porter la lampe hors du rectangle de l'écran de 4 m : le groupe `sideboard` aligne deux exemplaires du modèle (4,88 m), la lampe est à son extrémité droite.
- **Étages de chargement.** Ce que la spec ne range dans aucun étage (horloge, canapé, lampe, micros, étagères, banquette, enseigne) appartient au socle ; livres et plantes des étagères appartiennent au décor.
- **Chemins.** L'état global est `src/core/store.ts` (la spec §11 écrit `src/app/store.ts`). Le module de phase pur est `src/core/phase.ts` ; `PRESETS` et `mixPreset`, qui dépendent de three, sont dans `src/zones/office/lighting/presets.ts`.
- **Résolution des textures.** Le « 1k ; 2k pour le sol et les murs » de la spec s'applique à la carte de couleur ; normales ≤ couleur ; ARM 1024 pour le sol et les murs, 512 ailleurs ; une échelle de repli fixe (Tâche 2) garantit les budgets.
- **Audit des matériaux.** Il couvre les groupes de scène `base` et `decor` ; exemptions : `emissive`, `glass`, `screen`, `sky`. La ville (façades dessinées dans le shader, §4) fait partie du dehors et compte comme `sky` ; les ombres de contact sont hors des groupes audités.
- **Horloge.** Un clic pendant une transition est ignoré (pas de file d'attente). Le GLB de l'horloge est construit sans quantification, pour que ses aiguilles tournent autour du centre du cadran.
- **Preuves e2e existantes.** `tests/e2e/office.spec.ts` ouvre le bureau en `?phase=day`, pour des captures identiques quelle que soit l'heure.
- **Rendu logiciel des e2e (critère 4, §7).** Les e2e tournent sur SwiftShader, où une image du nouveau bureau coûte plusieurs fois celle de l'ancien. Mesuré dans le scratch du plan (1600 × 900, modèles de remplacement) : avec la seule règle de départ (niveau `low` à demi-résolution), le parcours le plus long d'`office.spec.ts` (« scroll to the presentation view, learn a topic and keep the progress ») prenait 84 s sur 90 dès la Tâche 8. Le plan réduit le coût d'une image sans GPU plutôt que de relever les délais : (1) Tâche 7, `Stage` reconnaît un rastériseur logiciel (SwiftShader, llvmpipe, softpipe, Basic Render Driver), passe tout de suite au niveau `low`, réglé, dessine à `SOFTWARE_DPR` = 0,35 et le signale par `SoftwareRendererContext` ; (2) Tâche 8, `Street` y cache les arbres de la rue (6 000 cartes de feuillage, le poste le plus lourd d'une image). Objectif vérifié aux Tâches 8, 14 et 15 : le test e2e le plus long tient en 60 % de son délai de 90 s (54 s). Mesuré : 38,7 s après la Tâche 8, 45,1 s après la Tâche 14, 42,0 s dans la suite complète de la Tâche 15 (19 tests en 4,4 min ; les tests qui attendent le décor en 17 s au plus) ; avec les seuls arbres cachés, à demi-résolution, 66 s après la Tâche 15. Aucun délai n'est relevé : les tests du décor gardent les 90 s par défaut. Le PC de référence n'est pas concerné : le tableau des niveaux de la spec s'y applique tel quel. Conséquence acceptée : les captures que l'e2e réécrit dans `docs/evidence/office/` sont rendues au niveau `low`, à 0,35 de résolution, sans les arbres de la rue ; les six preuves des phases (Tâche 16) passent par `scripts/shots.mjs`, sur le vrai GPU, avec tout le décor.
- **Enseigne.** La plaque rétroéclairée entoure la marque de 9 cm de chaque côté : 0,90 × 1,116 m (la marque mesure 0,72 × 0,936 m) ; l'empreinte `SIZES.logo` de la Tâche 5 prend ces dimensions, pour que les tests de dégagement voient l'enseigne réelle.
- **Plantes de la banquette.** Monstera à l'échelle 0,7 en x = −4,705, fougère à 0,95 en x = −4,67, vase rond en x = −4,74 : aux valeurs de départ, les feuilles générées traversaient le verre de la façade (jusqu'à x = −5,07). Un test de la Tâche 14 mesure la géométrie générée et garde chaque feuille de la banquette en deçà du cadre de la façade (x > −4,96).
- **Noms de fichiers.** La géométrie des plantes vit dans `src/three/plants/plantGeometry.ts` et celle des livres dans `src/three/shelfBooks.ts` : sous Windows, `./plants/plant.ts` et `./books.ts` masqueraient `Plant.tsx` et `Books.tsx` à la résolution des imports (casse ignorée, `.ts` avant `.tsx`).

## Review Focus

1. Clics répétés sur l'horloge ou sur « Time of day » pendant les 2,5 s d'une transition → chaque clic en cours de transition est ignoré, la transition se termine exactement sur la phase suivante, sans saut ni éclairage à moitié appliqué. Tests : Tâche 3 (« advancePhase is ignored while a transition runs ») et Tâche 7 (« a finished transition lands exactly on the target preset »).
2. Changement de phase quand la 3D ne peut pas l'animer (mode lecture, WebGL perdu, autre zone, vol en cours, réduire les animations) → changement instantané, rien ne reste « en transition », et le retour en 3D montre le bon éclairage. Tests : Tâche 3 (« advancePhase is instant whenever no 3D can animate it », « a stale transition never blocks the next one »).
3. Un modèle du décor introuvable ou corrompu (404, réseau coupé) → l'objet est omis, le socle et le reste du décor s'affichent, `decorReady` passe à vrai, le laptop reste survolable et aucune erreur non interceptée n'apparaît (un avertissement en développement, rien de plus). Tests : Tâche 12 (« a failing décor item renders nothing and warns in development », « an error it has handled is not reported as uncaught ») et Tâche 15 (« a missing décor model leaves the office usable »).
4. Adresse avec `?phase=` invalide, vide, en majuscules ou mêlée à d'autres paramètres (`?tune&phase=night`), puis navigation par le hash → la valeur valide s'applique, sinon l'heure locale, sans erreur ; `?phase=` n'est jamais réécrit. Tests : Tâche 3 (« parsePhaseParam accepts only day, sunset and night », « the router keeps ?phase in the address »).
5. Vue d'ensemble ajustée, parallaxe aux extrêmes, viewport 1280 × 600, décor chargé → le coin rétro reste entier dans le cadre avec l'image de la télé tournée vers la caméra, le centre du laptop reste visible, survolable et hors du bandeau du HUD et du panneau d'accueil, et la baie garde au moins sa part mesurée. Tests : Tâche 5 (« the overview keeps the retro corner in frame », « the TV picture faces the overview camera », « the overview shows as much glazing as the retro corner allows », « nothing stands between the overview camera and the laptop », « the laptop stays clear of the HUD and the welcome panel ») et Tâche 15 (« the laptop stays hoverable once the décor has loaded »).

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `scripts/assets/manifest.json` | Liste des assets CC0 : identifiant, source, URL de l'API, licence, résolution, usage, étage |
| `scripts/assets/lib.mjs` | Fonctions pures de la chaîne : lecteur zip, choix des fichiers aux API, rendu des crédits |
| `scripts/assets/fetch.mjs` | Téléchargement contrôlé (taille, md5) vers `assets-src/` (ignoré par git) |
| `scripts/assets/build.mjs` | Préparation (WebP, meshopt, simplification, élagage), écriture de `public/assets/` et de `CREDITS.md` |
| `scripts/shots.mjs` | Captures de revue et de preuve (Chromium avec GPU, serveur de dev) |
| `scripts/perf.mjs` | Mesures de performance sur la version de production |
| `src/assets/paths.ts` | Noms des fichiers produits, étages, budgets, qualités WebP (sans import, partagé avec Node) |
| `src/assets/manifest.ts` | Schéma zod du manifeste |
| `public/assets/textures/*.webp`, `public/assets/models/*.glb`, `public/assets/CREDITS.md` | Assets produits et commités (générés) |
| `src/three/assets.ts` | Catalogue d'exécution : jeux de textures, modèles, URLs, pièces nommées des modèles, image de la télé |
| `src/core/phase.ts` | Phases du jour, bornes horaires, `?phase=`, progression, heure de l'horloge (pur) |
| `src/zones/office/lighting/presets.ts` | Préréglages par phase et `mixPreset` (repris de `daycycle.js`) |
| `src/core/store.ts` | État global : `phase`, transition de phase, `decorReady`, cible de survol `clock` |
| `src/three/textures.ts` | Chargeur de textures unique (espace colorimétrique, anisotropie, répétition) |
| `src/three/uv.ts` | UV en mètres par projection de boîte |
| `src/three/noise.ts` | Textures procédurales `DataTexture` (bruit, moucheture) |
| `src/three/merge.ts` | Fusion de pièces en une géométrie (repris de `merge.js`) |
| `src/three/tints.ts` | Teintes des matériaux (hors couleurs de marque) |
| `src/three/audit.ts` | Audit des matériaux et exemptions |
| `src/three/materials.ts` | Fabrique des matériaux PBR partagés (`useMaterials`) |
| `src/zones/office/layout.ts` | Plan de la salle : pièce, baie, rail, vols, positions de tout le mobilier et du décor |
| `src/zones/office/footprints.ts` | Boîtes d'encombrement et intersection segment / boîte |
| `src/zones/office/framing.ts` | Part de la baie vitrée dans une vue |
| `src/three/plants/types.ts` | Types de placement des plantes |
| `src/zones/office/room/plan.ts` | Boîtes de la pièce : murs, montants, tasseaux, banquette, lignes de plafond, tapis |
| `src/zones/office/room/Glazing.tsx` | Baie vitrée : verre, montants, traverses |
| `src/zones/office/Room.tsx` | Pièce complète |
| `src/zones/office/lighting/rig.ts` | Constantes d'éclairage et liste des lumières par niveau |
| `src/zones/office/lighting/live.ts` | Mélange courant et appliqueurs de lumière |
| `src/zones/office/lighting/PhaseDriver.tsx` | Applique le mélange à chaque image, termine la transition |
| `src/zones/office/lighting/Lights.tsx` | Lumières nommées de la salle |
| `src/zones/office/lighting/OfficeEnvironment.tsx` | Environnement construit avec `Lightformer` |
| `src/zones/office/lighting/emissive.ts` | Niveaux des matériaux émissifs par phase |
| `src/app/quality.ts` | Niveaux de qualité, réglages par niveau, détection du rendu logiciel |
| `src/zones/office/outdoor/*` | Dôme de ciel, nuages, ville instanciée, rue (repris de `city.js`) |
| `src/three/shapes.ts` | Boîte arrondie, plateau racetrack, pièce entre deux points |
| `src/three/props/*` | Mobilier en code : table, chaises instanciées, micros, laptop, canapé, lampe, meuble télé, étagères, console, enseigne |
| `src/three/gltf.ts` | Préparation des modèles : clone, ombres, verre, normalisation |
| `src/three/objects.tsx` | Registre des objets : procédural ou GLB, contour de survol |
| `src/zones/office/clockHands.ts`, `WallClock.tsx` | Horloge murale cliquable et ses aiguilles |
| `src/app/SceneReadySignal.tsx` | Socle compilé (`compileAsync`) et image de chauffe avant `sceneReady` |
| `src/three/AssetBoundary.tsx` | Omet un objet du décor qui échoue |
| `src/zones/office/decor/*` | Étage du décor : frontière, caisson, table basse, suspensions, cadres, grandes plantes, vases |
| `src/three/plants/*` | Générateur de plantes (`plantGeometry.ts`, `leaf.ts`) et de plantes suspendues (`hanging.ts`), matériaux, balancement, composants `Plant` et `HangingPlant` |
| `src/three/shelfBooks.ts`, `src/three/Books.tsx` | Livres d'étagère (atlas de dos sans texte) |
| `src/app/TestApiBridge.tsx`, `src/app/testApi.ts` | API de test : `setPhase`, `rail`, `lighting()`, `untexturedMeshes()` |
| `src/ui/Hud.tsx`, `content/en/ui.json` | Bouton « Time of day », libellé de l'horloge |
| `tests/e2e/redesign.spec.ts` | Parcours de la refonte : phases, horloge, audit, hébergement, décor manquant |

---

### Task 1: Chaîne de préparation des assets

**Files:**
- Modify: `package.json`, `package-lock.json` (cinq dépendances de développement, scripts `assets:fetch` et `assets:build`), `.gitignore`, `vite.config.ts`, `src/test/setup.ts`
- Create: `src/assets/paths.ts`, `src/assets/manifest.ts`, `scripts/assets/manifest.json`, `scripts/assets/lib.mjs`, `scripts/assets/fetch.mjs`, `scripts/assets/build.mjs`
- Test: `src/assets/manifest.test.ts`, `scripts/assets/lib.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces (`src/assets/paths.ts`, code exact, sans import, partagé avec Node) : `TEXTURE_MAPS = ['color', 'normal', 'arm']`, `TextureMap`, `STAGES = ['base', 'decor']`, `Stage`, `ASSETS_DIR = 'public/assets'`, `CREDITS_FILE = 'CREDITS.md'`, `LICENCE = 'CC0-1.0'`, `MIB`, `ASSET_BUDGET = { totalBytes, baseBytes, maxFileBytes }`, `WEBP_QUALITY = { color: 82, normal: 90, arm: 80 }`, `textureFile(id: string, map: TextureMap): string` (`textures/<id>_<map>.webp`), `modelFile(id: string): string` (`models/<id>.glb`).
- Produces (`src/assets/manifest.ts`) : `textureEntrySchema`, `modelEntrySchema`, `assetEntrySchema`, `assetManifestSchema`, types `TextureEntry`, `ModelEntry`, `AssetEntry`, `AssetManifest`, `entryFiles(entry: AssetEntry): string[]`, `manifestFiles(manifest: AssetManifest, stage?: Stage): string[]`. `ModelEntry.quantize` est un `boolean` toujours présent après analyse (défaut `true`).
- Produces (`scripts/assets/lib.mjs`) : `AMBIENTCG_MAPS`, `sourceResolutionKey(entry)`, `polyHavenTextureDownloads(files, entry)`, `polyHavenModelDownloads(files, key = '1k')`, `ambientCgDownload(fullJson, entry)`, `readZip(buffer): Map<string, Buffer>`, `sourceUrl(source, sourceId)`, `renderCredits(rows)`, `formatMiB(bytes)`.
- Produces : scripts npm `assets:fetch [-- --only id1,id2]` et `assets:build [-- --only id]` ; dossier `assets-src/` ignoré par git ; `scripts/**/*.test.mjs` passent dans Vitest ; `src/test/setup.ts` accepte les fichiers `// @vitest-environment node`.

Aucun asset n'est téléchargé dans cette tâche : les scripts sont vérifiés par les tests de `lib.mjs` et par leur aide (`--help`), qui charge aussi sharp, glTF-Transform et meshoptimizer.

- [ ] **Step 1: Installer les cinq dépendances de développement**

Run: `npm install -D --save-exact @gltf-transform/core@4.5.1 @gltf-transform/functions@4.5.1 @gltf-transform/extensions@4.5.1 meshoptimizer@1.2.0 sharp@0.35.5`
Expected: `package.json` gagne dans `devDependencies` exactement `"@gltf-transform/core": "4.5.1"`, `"@gltf-transform/extensions": "4.5.1"`, `"@gltf-transform/functions": "4.5.1"`, `"meshoptimizer": "1.2.0"`, `"sharp": "0.35.5"` ; `dependencies` ne change pas. Sous Windows 11 x64, npm installe aussi le binaire précompilé `@img/sharp-win32-x64@0.35.5`.

Run: `node -e "console.log(require('sharp').versions)"`
Expected: un objet qui contient `sharp: '0.35.5'` et une version de `vips` ; aucune erreur de chargement du binaire.

Run: `npm ls @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp --depth=0`
Expected: les cinq paquets aux versions ci-dessus, sans `UNMET` ni `invalid`.

- [ ] **Step 2: Configurer git, Vitest et les scripts npm**

Dans `.gitignore`, ajouter à la fin :

```gitignore

# CC0 asset sources fetched by `npm run assets:fetch`; the prepared files are committed under public/assets/
assets-src/
```

Dans `vite.config.ts`, remplacer exactement la ligne

```ts
    include: ['src/**/*.test.{ts,tsx}'],
```

par

```ts
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
```

Dans `package.json`, remplacer exactement le bloc

```json
    "budget": "node scripts/check-bundle.mjs",
    "check": "npm run typecheck && npm run test && npm run build && npm run budget"
  },
```

par

```json
    "budget": "node scripts/check-bundle.mjs",
    "check": "npm run typecheck && npm run test && npm run build && npm run budget",
    "assets:fetch": "node --disable-warning=ExperimentalWarning scripts/assets/fetch.mjs",
    "assets:build": "node --disable-warning=ExperimentalWarning scripts/assets/build.mjs"
  },
```

Les tests qui lisent le disque tournent en environnement `node` (`// @vitest-environment node`), où `window` n'existe pas : le fichier de mise en place actuel le touche sans précaution et ferait échouer ces fichiers (`ReferenceError: window is not defined`). Réécrire `src/test/setup.ts` en entier (contenu identique à celui de la branche de l'atelier, pour une fusion sans conflit) :

```ts
import '@testing-library/jest-dom/vitest'
import { initI18n } from '../core/i18n'

initI18n('en')

// Files marked `// @vitest-environment node` (simulation, server) have no `window`.
if (typeof window !== 'undefined') {
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
}

afterEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear()
})
```

Run: `npm run test`
Expected: PASS, mêmes tests qu'avant (aucun fichier `scripts/**/*.test.mjs` n'existe encore).

- [ ] **Step 3: Écrire le test qui échoue `src/assets/manifest.test.ts`**

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assetManifestSchema, entryFiles, manifestFiles, type AssetManifest } from './manifest'

const MANIFEST_PATH = fileURLToPath(new URL('../../scripts/assets/manifest.json', import.meta.url))
const raw = (): unknown => JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const manifest: AssetManifest = assetManifestSchema.parse(raw())
const byId = (id: string) => manifest.assets.find((entry) => entry.id === id)!
/** A copy of the raw JSON, edited by `edit`, to show what the schema refuses. */
function edited(edit: (assets: Record<string, unknown>[]) => void) {
  const copy = raw() as { assets: Record<string, unknown>[] }
  edit(copy.assets)
  return assetManifestSchema.safeParse(copy).success
}

test('the asset manifest is valid', () => {
  expect(assetManifestSchema.safeParse(raw()).success).toBe(true)
  expect(manifest.assets).toHaveLength(20)
  expect(manifest.assets.every((entry) => entry.licence === 'CC0-1.0')).toBe(true)
})

test('asset ids are unique, lower case and match their source id', () => {
  const ids = manifest.assets.map((entry) => entry.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const entry of manifest.assets) expect(entry.id).toBe(entry.sourceId.toLowerCase())
  expect(byId('metal046a').sourceId).toBe('Metal046A')
  expect(edited((assets) => assets.push({ ...assets[0] }))).toBe(false)
  expect(edited((assets) => (assets[4].id = 'fabric_036'))).toBe(false)
  expect(edited((assets) => (assets[0].id = 'Plank_flooring_04'))).toBe(false)
})

test('every asset points to its source API', () => {
  for (const entry of manifest.assets) {
    const expected =
      entry.source === 'polyhaven'
        ? `https://api.polyhaven.com/files/${entry.sourceId}`
        : `https://ambientcg.com/api/v2/full_json?id=${entry.sourceId}&include=downloadData`
    expect(entry.api).toBe(expected)
  }
  expect(edited((assets) => (assets[0].api = 'https://example.com/files/plank_flooring_04'))).toBe(false)
})

test('texture resolutions follow the spec', () => {
  const textures = manifest.assets.flatMap((entry) => (entry.kind === 'texture' ? [entry] : []))
  expect(textures.map((entry) => entry.id)).toEqual([
    'plank_flooring_04',
    'beige_wall_001',
    'oak_veneer_05',
    'american_walnut_veneer',
    'fabric036',
    'carpet016',
    'metal046a',
    'metal027',
  ])
  for (const entry of textures) {
    const twoK = entry.id === 'plank_flooring_04' || entry.id === 'beige_wall_001'
    expect(entry.resolution.color).toBe(twoK ? 2048 : 1024)
    expect(entry.resolution.normal).toBeLessThanOrEqual(entry.resolution.color)
    expect(entry.resolution.arm).toBeLessThanOrEqual(entry.resolution.color)
    expect(entry.stage).toBe('base')
  }
  expect(textures.filter((entry) => entry.metal).map((entry) => entry.id)).toEqual(['metal046a', 'metal027'])
  expect(edited((assets) => ((assets[2].resolution as { normal: number }).normal = 2048))).toBe(false)
  expect(edited((assets) => ((assets[2].resolution as { normal: number }).normal = 4096))).toBe(false)
})

test('every model is a Poly Haven asset and the clock keeps its node transforms', () => {
  const models = manifest.assets.flatMap((entry) => (entry.kind === 'model' ? [entry] : []))
  expect(models).toHaveLength(12)
  expect(models.every((entry) => entry.source === 'polyhaven')).toBe(true)
  expect(models.filter((entry) => !entry.quantize).map((entry) => entry.id)).toEqual(['wall_clock'])
  expect(byId('pachira_aquatica_01')).toMatchObject({ variant: 'b', simplify: { ratio: 0.4, error: 0.01 } })
  expect(models.filter((entry) => entry.stage === 'base').map((entry) => entry.id)).toEqual([
    'modern_wooden_cabinet',
    'television_02',
    'wall_clock',
  ])
  expect(edited((assets) => (assets[8].source = 'ambientcg'))).toBe(false)
})

test('file names come from the asset ids', () => {
  expect(entryFiles(byId('fabric036'))).toEqual([
    'textures/fabric036_color.webp',
    'textures/fabric036_normal.webp',
    'textures/fabric036_arm.webp',
  ])
  expect(entryFiles(byId('wall_clock'))).toEqual(['models/wall_clock.glb'])
  expect(manifestFiles(manifest)).toHaveLength(8 * 3 + 12)
  expect(manifestFiles(manifest, 'base')).toEqual([
    ...manifest.assets.slice(0, 8).flatMap(entryFiles),
    'models/modern_wooden_cabinet.glb',
    'models/television_02.glb',
    'models/wall_clock.glb',
  ])
  expect(manifestFiles(manifest, 'decor')).toHaveLength(9)
})
```

Run: `npx vitest run src/assets/manifest.test.ts`
Expected: FAIL — `Failed to resolve import "./manifest"` (le module n'existe pas encore).

- [ ] **Step 4: Créer `src/assets/paths.ts`, `src/assets/manifest.ts` et `scripts/assets/manifest.json`**

`src/assets/paths.ts` (code exact du contrat) :

```ts
/*
 * Shared by the site, the unit tests and the Node asset scripts (scripts/assets/*.mjs import this file directly).
 * Keep it free of any import and of non-erasable TypeScript syntax (no enum, no parameter properties).
 */
export const TEXTURE_MAPS = ['color', 'normal', 'arm'] as const
export type TextureMap = (typeof TEXTURE_MAPS)[number]
export const STAGES = ['base', 'decor'] as const
export type Stage = (typeof STAGES)[number]

/** On disk, from the repository root. Vite serves it as `assets/…` (see publicUrl). */
export const ASSETS_DIR = 'public/assets'
export const CREDITS_FILE = 'CREDITS.md'
export const LICENCE = 'CC0-1.0'
export const MIB = 1024 * 1024
export const ASSET_BUDGET = { totalBytes: 18 * MIB, baseBytes: 6 * MIB, maxFileBytes: 3 * MIB } as const
export const WEBP_QUALITY = { color: 82, normal: 90, arm: 80 } as const

/** Path of a texture map, relative to ASSETS_DIR. */
export function textureFile(id: string, map: TextureMap): string {
  return `textures/${id}_${map}.webp`
}

/** Path of a model, relative to ASSETS_DIR. */
export function modelFile(id: string): string {
  return `models/${id}.glb`
}
```

`src/assets/manifest.ts` — les règles qui croisent plusieurs champs (identifiants uniques, identifiant = identifiant source en minuscules, URL de l'API, cartes jamais plus grandes que la couleur) sont dans un seul `superRefine` du manifeste, pour que les schémas d'entrée restent de simples objets stricts dans l'union discriminée :

```ts
import { z } from 'zod'
import { LICENCE, STAGES, TEXTURE_MAPS, modelFile, textureFile, type Stage } from './paths'

/*
 * Schema of scripts/assets/manifest.json: every CC0 asset the site ships, where it comes from and how it is prepared.
 * The Node scripts read the JSON directly; src/assets/manifest.test.ts checks it against this schema.
 */

const resolution = z.union([z.literal(512), z.literal(1024), z.literal(2048)])

const common = {
  id: z.string().regex(/^[a-z0-9_]+$/),
  sourceId: z.string().min(1),
  api: z.url(),
  licence: z.literal(LICENCE),
  stage: z.enum(STAGES),
  usage: z.string().min(1).max(120),
}

export const textureEntrySchema = z
  .object({
    kind: z.literal('texture'),
    ...common,
    source: z.enum(['polyhaven', 'ambientcg']),
    /** Real-world size of one texture repeat, in metres. */
    tileMetres: z.number().positive(),
    metal: z.boolean(),
    resolution: z.object({ color: resolution, normal: resolution, arm: resolution }).strict(),
  })
  .strict()

export const modelEntrySchema = z
  .object({
    kind: z.literal('model'),
    ...common,
    source: z.literal('polyhaven'),
    textureSize: resolution,
    /** Keep only the nodes of this variant (Poly Haven files holding `_a`, `_b`... side by side). */
    variant: z.string().regex(/^[a-z]$/).optional(),
    simplify: z.object({ ratio: z.number().gt(0).lt(1), error: z.number().positive() }).strict().optional(),
    /** false keeps the node transforms and raw vertex positions (no meshopt quantization), e.g. for the clock hands. */
    quantize: z.boolean().default(true),
  })
  .strict()

export const assetEntrySchema = z.discriminatedUnion('kind', [textureEntrySchema, modelEntrySchema])

const SOURCE_API = {
  polyhaven: (sourceId: string) => `https://api.polyhaven.com/files/${sourceId}`,
  ambientcg: (sourceId: string) => `https://ambientcg.com/api/v2/full_json?id=${sourceId}&include=downloadData`,
} as const

export const assetManifestSchema = z
  .object({ version: z.literal(1), assets: z.array(assetEntrySchema).min(1) })
  .strict()
  .superRefine((manifest, ctx) => {
    const seen = new Set<string>()
    manifest.assets.forEach((entry, index) => {
      if (seen.has(entry.id)) ctx.addIssue({ code: 'custom', path: ['assets', index, 'id'], message: `Duplicate asset id ${entry.id}` })
      seen.add(entry.id)
      if (entry.id !== entry.sourceId.toLowerCase()) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'id'], message: 'The id must be the source id in lower case' })
      }
      if (entry.api !== SOURCE_API[entry.source](entry.sourceId)) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'api'], message: `Expected ${SOURCE_API[entry.source](entry.sourceId)}` })
      }
      if (entry.kind === 'texture' && (entry.resolution.normal > entry.resolution.color || entry.resolution.arm > entry.resolution.color)) {
        ctx.addIssue({ code: 'custom', path: ['assets', index, 'resolution'], message: 'Normal and ARM maps are never larger than the colour map' })
      }
    })
  })

export type TextureEntry = z.infer<typeof textureEntrySchema>
export type ModelEntry = z.infer<typeof modelEntrySchema>
export type AssetEntry = z.infer<typeof assetEntrySchema>
export type AssetManifest = z.infer<typeof assetManifestSchema>

/** Files an entry produces, relative to ASSETS_DIR: the three maps of a texture, or the GLB of a model. */
export function entryFiles(entry: AssetEntry): string[] {
  return entry.kind === 'texture' ? TEXTURE_MAPS.map((map) => textureFile(entry.id, map)) : [modelFile(entry.id)]
}

/** Every file the manifest produces, in manifest order; only those of one loading stage when `stage` is given. */
export function manifestFiles(manifest: AssetManifest, stage?: Stage): string[] {
  return manifest.assets.filter((entry) => stage === undefined || entry.stage === stage).flatMap(entryFiles)
}
```

`scripts/assets/manifest.json` (contenu de départ exact ; URLs vérifiées sur les API JSON de Poly Haven et d'ambientCG le 2026-10-06) :

```json
{
  "version": 1,
  "assets": [
    {
      "kind": "texture",
      "id": "plank_flooring_04",
      "source": "polyhaven",
      "sourceId": "plank_flooring_04",
      "api": "https://api.polyhaven.com/files/plank_flooring_04",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Oak plank floor",
      "tileMetres": 2.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 1024 }
    },
    {
      "kind": "texture",
      "id": "beige_wall_001",
      "source": "polyhaven",
      "sourceId": "beige_wall_001",
      "api": "https://api.polyhaven.com/files/beige_wall_001",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Walls and ceiling, tinted greige",
      "tileMetres": 3.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 1024 }
    },
    {
      "kind": "texture",
      "id": "oak_veneer_05",
      "source": "polyhaven",
      "sourceId": "oak_veneer_05",
      "api": "https://api.polyhaven.com/files/oak_veneer_05",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Slat wall, table top, shelves, banquette, TV stand",
      "tileMetres": 1.0,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "texture",
      "id": "american_walnut_veneer",
      "source": "polyhaven",
      "sourceId": "american_walnut_veneer",
      "api": "https://api.polyhaven.com/files/american_walnut_veneer",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Lamp base and small wooden details",
      "tileMetres": 1.0,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "texture",
      "id": "fabric036",
      "source": "ambientcg",
      "sourceId": "Fabric036",
      "api": "https://ambientcg.com/api/v2/full_json?id=Fabric036&include=downloadData",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Chair shells, sofa, cushions",
      "tileMetres": 0.5,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "texture",
      "id": "carpet016",
      "source": "ambientcg",
      "sourceId": "Carpet016",
      "api": "https://ambientcg.com/api/v2/full_json?id=Carpet016&include=downloadData",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Wool rug under the table",
      "tileMetres": 1.7,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "texture",
      "id": "metal046a",
      "source": "ambientcg",
      "sourceId": "Metal046A",
      "api": "https://ambientcg.com/api/v2/full_json?id=Metal046A&include=downloadData",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Black metal: legs, mullions, frames",
      "tileMetres": 1.0,
      "metal": true,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "texture",
      "id": "metal027",
      "source": "ambientcg",
      "sourceId": "Metal027",
      "api": "https://ambientcg.com/api/v2/full_json?id=Metal027&include=downloadData",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Brushed metal: microphones, laptop, lamp stem",
      "tileMetres": 1.0,
      "metal": true,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
    },
    {
      "kind": "model",
      "id": "modern_wooden_cabinet",
      "source": "polyhaven",
      "sourceId": "modern_wooden_cabinet",
      "api": "https://api.polyhaven.com/files/modern_wooden_cabinet",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Sideboard under the wall screen (two units)",
      "textureSize": 1024,
      "simplify": { "ratio": 0.5, "error": 0.001 }
    },
    {
      "kind": "model",
      "id": "television_02",
      "source": "polyhaven",
      "sourceId": "television_02",
      "api": "https://api.polyhaven.com/files/television_02",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Retro CRT television",
      "textureSize": 512
    },
    {
      "kind": "model",
      "id": "wall_clock",
      "source": "polyhaven",
      "sourceId": "wall_clock",
      "api": "https://api.polyhaven.com/files/wall_clock",
      "licence": "CC0-1.0",
      "stage": "base",
      "usage": "Clickable wall clock",
      "textureSize": 512,
      "quantize": false
    },
    {
      "kind": "model",
      "id": "drawer_cabinet",
      "source": "polyhaven",
      "sourceId": "drawer_cabinet",
      "api": "https://api.polyhaven.com/files/drawer_cabinet",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Drawer cabinet on the right wall",
      "textureSize": 1024,
      "simplify": { "ratio": 0.5, "error": 0.001 }
    },
    {
      "kind": "model",
      "id": "modern_coffee_table_01",
      "source": "polyhaven",
      "sourceId": "modern_coffee_table_01",
      "api": "https://api.polyhaven.com/files/modern_coffee_table_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Coffee table in the lounge corner",
      "textureSize": 1024
    },
    {
      "kind": "model",
      "id": "modern_ceiling_lamp_01",
      "source": "polyhaven",
      "sourceId": "modern_ceiling_lamp_01",
      "api": "https://api.polyhaven.com/files/modern_ceiling_lamp_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Glass pendants above the table",
      "textureSize": 512
    },
    {
      "kind": "model",
      "id": "hanging_picture_frame_01",
      "source": "polyhaven",
      "sourceId": "hanging_picture_frame_01",
      "api": "https://api.polyhaven.com/files/hanging_picture_frame_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Picture frames with Athena posters",
      "textureSize": 512
    },
    {
      "kind": "model",
      "id": "potted_plant_01",
      "source": "polyhaven",
      "sourceId": "potted_plant_01",
      "api": "https://api.polyhaven.com/files/potted_plant_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Large potted plant by the glazing",
      "textureSize": 1024,
      "simplify": { "ratio": 0.2, "error": 0.01 }
    },
    {
      "kind": "model",
      "id": "pachira_aquatica_01",
      "source": "polyhaven",
      "sourceId": "pachira_aquatica_01",
      "api": "https://api.polyhaven.com/files/pachira_aquatica_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Money tree in the back corner",
      "textureSize": 1024,
      "variant": "b",
      "simplify": { "ratio": 0.4, "error": 0.01 }
    },
    {
      "kind": "model",
      "id": "ceramic_vase_01",
      "source": "polyhaven",
      "sourceId": "ceramic_vase_01",
      "api": "https://api.polyhaven.com/files/ceramic_vase_01",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Tall vase on the sideboard",
      "textureSize": 512,
      "simplify": { "ratio": 0.5, "error": 0.001 }
    },
    {
      "kind": "model",
      "id": "ceramic_vase_04",
      "source": "polyhaven",
      "sourceId": "ceramic_vase_04",
      "api": "https://api.polyhaven.com/files/ceramic_vase_04",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Round vase on the banquette",
      "textureSize": 512,
      "simplify": { "ratio": 0.5, "error": 0.001 }
    },
    {
      "kind": "model",
      "id": "planter_pot_clay",
      "source": "polyhaven",
      "sourceId": "planter_pot_clay",
      "api": "https://api.polyhaven.com/files/planter_pot_clay",
      "licence": "CC0-1.0",
      "stage": "decor",
      "usage": "Clay planter for the money tree",
      "textureSize": 512
    }
  ]
}
```

Run: `npx vitest run src/assets/manifest.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Écrire le test qui échoue `scripts/assets/lib.test.mjs`**

Le zip de test est écrit à la main (en-têtes locaux, répertoire central, fin de répertoire), avec une entrée stockée, un dossier et une entrée compressée par `deflateRawSync`. Les fausses réponses d'API reprennent la forme exacte des JSON réels (Poly Haven : `files[<carte>][<résolution>].jpg = { url, size, md5 }`, glTF : `files.gltf['1k'].gltf = { url, size, md5, include }` ; ambientCG : `foundAssets[0].downloadFolders.default.downloadFiletypeCategories.zip.downloads[]` avec `attribute`, `size`, `downloadLink`).

```js
// @vitest-environment node
import { deflateRawSync } from 'node:zlib'
import { expect, test } from 'vitest'
import {
  ambientCgDownload,
  formatMiB,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readZip,
  renderCredits,
  sourceResolutionKey,
  sourceUrl,
} from './lib.mjs'

/** A zip written by hand: one local header + data per entry, then the central directory and its end record. */
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data, method } of entries) {
    const body = method === 8 ? deflateRawSync(data) : data
    const nameBytes = Buffer.from(name, 'utf8')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(body.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, body)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + body.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

const texture = (overrides = {}) => ({
  kind: 'texture',
  id: 'plank_flooring_04',
  source: 'polyhaven',
  sourceId: 'plank_flooring_04',
  resolution: { color: 2048, normal: 1024, arm: 1024 },
  ...overrides,
})

const file = (name, size) => ({ url: `https://dl.polyhaven.org/${name}`, size, md5: `md5-${name}` })
const polyHavenTexture = {
  Diffuse: { '1k': { jpg: file('diff_1k.jpg', 1) }, '2k': { jpg: file('diff_2k.jpg', 2) } },
  nor_gl: { '1k': { jpg: file('nor_gl_1k.jpg', 3) }, '2k': { jpg: file('nor_gl_2k.jpg', 4) } },
  arm: { '1k': { jpg: file('arm_1k.jpg', 5) }, '2k': { jpg: file('arm_2k.jpg', 6) } },
  nor_dx: { '1k': { jpg: file('nor_dx_1k.jpg', 7) } },
}

test('readZip reads stored and deflated entries', () => {
  const text = Buffer.from('roughness '.repeat(200))
  const zip = makeZip([
    { name: 'Fabric036_1K-JPG_Color.jpg', data: Buffer.from([1, 2, 3, 4]), method: 0 },
    { name: 'maps/', data: Buffer.alloc(0), method: 0 },
    { name: 'Fabric036_1K-JPG_Roughness.jpg', data: text, method: 8 },
  ])
  const entries = readZip(zip)
  expect([...entries.keys()]).toEqual(['Fabric036_1K-JPG_Color.jpg', 'Fabric036_1K-JPG_Roughness.jpg'])
  expect([...entries.get('Fabric036_1K-JPG_Color.jpg')]).toEqual([1, 2, 3, 4])
  expect(entries.get('Fabric036_1K-JPG_Roughness.jpg').equals(text)).toBe(true)
})

test('readZip refuses other compression methods', () => {
  const zip = makeZip([{ name: 'a.jpg', data: Buffer.from([1]), method: 12 }])
  expect(() => readZip(zip)).toThrow(/compression method 12/)
  expect(() => readZip(Buffer.from('not a zip at all, just some bytes'))).toThrow(/Not a zip file/)
})

test('Poly Haven texture downloads pick the needed resolution', () => {
  expect(sourceResolutionKey(texture())).toBe('2k')
  expect(polyHavenTextureDownloads(polyHavenTexture, texture())).toEqual([
    { url: 'https://dl.polyhaven.org/diff_2k.jpg', path: 'color.jpg', size: 2, md5: 'md5-diff_2k.jpg' },
    { url: 'https://dl.polyhaven.org/nor_gl_2k.jpg', path: 'normal.jpg', size: 4, md5: 'md5-nor_gl_2k.jpg' },
    { url: 'https://dl.polyhaven.org/arm_2k.jpg', path: 'arm.jpg', size: 6, md5: 'md5-arm_2k.jpg' },
  ])
  const oneK = texture({ resolution: { color: 1024, normal: 1024, arm: 512 } })
  expect(sourceResolutionKey(oneK)).toBe('1k')
  expect(polyHavenTextureDownloads(polyHavenTexture, oneK).map((d) => d.url)).toEqual([
    'https://dl.polyhaven.org/diff_1k.jpg',
    'https://dl.polyhaven.org/nor_gl_1k.jpg',
    'https://dl.polyhaven.org/arm_1k.jpg',
  ])
  expect(() => polyHavenTextureDownloads({ Diffuse: polyHavenTexture.Diffuse }, oneK)).toThrow(/no nor_gl map at 1k/)
})

test('Poly Haven model downloads keep the glTF include paths', () => {
  const files = {
    gltf: {
      '1k': {
        gltf: {
          url: 'https://dl.polyhaven.org/wall_clock_1k.gltf',
          size: 9008,
          md5: 'a',
          include: {
            'wall_clock.bin': { url: 'https://dl.polyhaven.org/wall_clock.bin', size: 132412, md5: 'b' },
            'textures/wall_clock_diff_1k.jpg': { url: 'https://dl.polyhaven.org/wall_clock_diff_1k.jpg', size: 366683, md5: 'c' },
          },
        },
      },
    },
  }
  expect(sourceResolutionKey({ kind: 'model', source: 'polyhaven', textureSize: 512 })).toBe('1k')
  expect(polyHavenModelDownloads(files)).toEqual([
    { url: 'https://dl.polyhaven.org/wall_clock_1k.gltf', path: 'model.gltf', size: 9008, md5: 'a' },
    { url: 'https://dl.polyhaven.org/wall_clock.bin', path: 'wall_clock.bin', size: 132412, md5: 'b' },
    { url: 'https://dl.polyhaven.org/wall_clock_diff_1k.jpg', path: 'textures/wall_clock_diff_1k.jpg', size: 366683, md5: 'c' },
  ])
  expect(() => polyHavenModelDownloads(files, '2k')).toThrow(/no glTF at 2k/)
})

test('ambientCG downloads pick the JPG zip of the right size', () => {
  const zip = (attribute, size) => ({
    attribute,
    size,
    downloadLink: `https://ambientcg.com/get?file=Fabric036_${attribute}.zip`,
    fileName: `Fabric036_${attribute}.zip`,
  })
  const fullJson = {
    foundAssets: [
      {
        assetId: 'Fabric036',
        downloadFolders: {
          default: {
            downloadFiletypeCategories: {
              zip: { downloads: [zip('1K-PNG', 17714531), zip('1K-JPG', 9644900), zip('2K-JPG', 33928892)] },
            },
          },
        },
      },
    ],
  }
  const fabric = texture({ id: 'fabric036', source: 'ambientcg', sourceId: 'Fabric036', resolution: { color: 1024, normal: 1024, arm: 512 } })
  expect(sourceResolutionKey(fabric)).toBe('1K')
  expect(ambientCgDownload(fullJson, fabric)).toEqual({
    url: 'https://ambientcg.com/get?file=Fabric036_1K-JPG.zip',
    path: 'source.zip',
    size: 9644900,
  })
  const large = { ...fabric, resolution: { color: 2048, normal: 1024, arm: 512 } }
  expect(ambientCgDownload(fullJson, large).size).toBe(33928892)
  expect(() => ambientCgDownload(fullJson, { ...fabric, sourceId: 'Fabric039' })).toThrow(/did not return Fabric039/)
})

test('credits list every file with its source, licence and size', () => {
  const text = renderCredits([
    { file: 'textures/fabric036_arm.webp', assetId: 'fabric036', source: 'ambientcg', sourceId: 'Fabric036', bytes: 81234 },
    { file: 'models/drawer_cabinet.glb', assetId: 'drawer_cabinet', source: 'polyhaven', sourceId: 'drawer_cabinet', bytes: 612345 },
  ])
  expect(text).toBe(
    [
      '# Asset credits',
      '',
      'All files in this folder are CC0-1.0 (public domain dedication). Generated by `npm run assets:build` from `scripts/assets/manifest.json`; do not edit by hand.',
      '',
      '| File | Asset | Source | Licence | Bytes |',
      '|---|---|---|---|---:|',
      '| models/drawer_cabinet.glb | drawer_cabinet | Poly Haven https://polyhaven.com/a/drawer_cabinet | CC0-1.0 | 612345 |',
      '| textures/fabric036_arm.webp | fabric036 | ambientCG https://ambientcg.com/view?id=Fabric036 | CC0-1.0 | 81234 |',
      '',
    ].join('\n'),
  )
  const row = /^\| (\S+) \| (\S+) \| (Poly Haven|ambientCG) (\S+) \| (CC0-1\.0) \| (\d+) \|$/
  expect(text.split('\n').filter((line) => row.test(line))).toHaveLength(2)
  expect(sourceUrl('ambientcg', 'Metal046A')).toBe('https://ambientcg.com/view?id=Metal046A')
  expect(formatMiB(1288490)).toBe('1.23 MiB')
})
```

Run: `npx vitest run scripts/assets/lib.test.mjs`
Expected: FAIL — `Failed to resolve import "./lib.mjs"` (le module n'existe pas encore).

- [ ] **Step 6: Créer `scripts/assets/lib.mjs`**

Node 24 importe `src/assets/paths.ts` directement (suppression native des types) ; Vitest le résout aussi. Aucune autre source TypeScript n'est importée par les scripts.

```js
// Pure helpers of the asset pipeline (no network, no disk): unit-tested in lib.test.mjs.
import { inflateRawSync } from 'node:zlib'
import { LICENCE, MIB } from '../../src/assets/paths.ts'

/** @typedef {{ url: string, path: string, size: number, md5?: string }} Download  path is relative to assets-src/<id>/ */

/** Files of an ambientCG JPG zip, by the map they hold. */
export const AMBIENTCG_MAPS = {
  color: /_Color\.jpg$/,
  normal: /_NormalGL\.jpg$/,
  roughness: /_Roughness\.jpg$/,
  ao: /_AmbientOcclusion\.jpg$/,
  metalness: /_Metalness\.jpg$/,
}

/**
 * Source resolution to download: the smallest one that still covers the largest map we produce.
 * Poly Haven keys are '1k' / '2k'; ambientCG attributes are '1K' / '2K'.
 */
export function sourceResolutionKey(entry) {
  const largest = entry.kind === 'texture' ? Math.max(entry.resolution.color, entry.resolution.normal, entry.resolution.arm) : entry.textureSize
  const key = largest > 1024 ? '2k' : '1k'
  return entry.source === 'ambientcg' ? key.toUpperCase() : key
}

const POLYHAVEN_TEXTURE_MAPS = [
  ['Diffuse', 'color.jpg'],
  ['nor_gl', 'normal.jpg'],
  ['arm', 'arm.jpg'],
]

/** @returns {Download[]} the colour, normal (OpenGL) and ARM JPGs of a Poly Haven texture. */
export function polyHavenTextureDownloads(files, entry) {
  const key = sourceResolutionKey(entry)
  return POLYHAVEN_TEXTURE_MAPS.map(([map, path]) => {
    const file = files?.[map]?.[key]?.jpg
    if (!file?.url) throw new Error(`${entry.id}: Poly Haven has no ${map} map at ${key}`)
    return { url: file.url, path, size: file.size, md5: file.md5 }
  })
}

/** @returns {Download[]} a Poly Haven glTF ('model.gltf') and every file it includes, at their relative paths. */
export function polyHavenModelDownloads(files, key = '1k') {
  const gltf = files?.gltf?.[key]?.gltf
  if (!gltf?.url) throw new Error(`Poly Haven has no glTF at ${key}`)
  return [
    { url: gltf.url, path: 'model.gltf', size: gltf.size, md5: gltf.md5 },
    ...Object.entries(gltf.include ?? {}).map(([path, file]) => ({ url: file.url, path, size: file.size, md5: file.md5 })),
  ]
}

/** @returns {Download} the JPG zip of an ambientCG material at the needed resolution. */
export function ambientCgDownload(fullJson, entry) {
  const asset = fullJson?.foundAssets?.[0]
  if (!asset || asset.assetId !== entry.sourceId) throw new Error(`${entry.id}: ambientCG did not return ${entry.sourceId}`)
  const attribute = `${sourceResolutionKey(entry)}-JPG`
  const zip = asset.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads?.find((d) => d.attribute === attribute)
  if (!zip?.downloadLink) throw new Error(`${entry.id}: ambientCG has no ${attribute} zip`)
  return { url: zip.downloadLink, path: 'source.zip', size: zip.size }
}

/**
 * Entries of a zip file, read from its central directory: Map<name, Buffer>, folders skipped.
 * Only "stored" (0) and "deflate" (8) entries exist in the zips we fetch; any other method throws.
 */
export function readZip(buffer) {
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('Not a zip file: no end of central directory')
  const count = buffer.readUInt16LE(end + 10)
  let offset = buffer.readUInt32LE(end + 16)
  if (offset === 0xffffffff) throw new Error('ZIP64 archives are not supported')
  const entries = new Map()
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Corrupt zip: bad central directory entry')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Corrupt zip: bad local header for ${name}`)
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28)
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) entries.set(name, Buffer.from(data))
    else if (method === 8) entries.set(name, inflateRawSync(data))
    else throw new Error(`Unsupported zip compression method ${method} for ${name}`)
  }
  return entries
}

const SOURCE_LABEL = { polyhaven: 'Poly Haven', ambientcg: 'ambientCG' }

/** Page of the asset on its source site. */
export function sourceUrl(source, sourceId) {
  if (source === 'polyhaven') return `https://polyhaven.com/a/${sourceId}`
  if (source === 'ambientcg') return `https://ambientcg.com/view?id=${sourceId}`
  throw new Error(`Unknown source ${source}`)
}

/** public/assets/CREDITS.md, one row per file, sorted by file. rows: { file, assetId, source, sourceId, bytes }[] */
export function renderCredits(rows) {
  const sorted = [...rows].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
  return [
    '# Asset credits',
    '',
    `All files in this folder are ${LICENCE} (public domain dedication). Generated by \`npm run assets:build\` from \`scripts/assets/manifest.json\`; do not edit by hand.`,
    '',
    '| File | Asset | Source | Licence | Bytes |',
    '|---|---|---|---|---:|',
    ...sorted.map(
      (row) => `| ${row.file} | ${row.assetId} | ${SOURCE_LABEL[row.source]} ${sourceUrl(row.source, row.sourceId)} | ${LICENCE} | ${row.bytes} |`,
    ),
    '',
  ].join('\n')
}

/** 1288490 -> '1.23 MiB' */
export function formatMiB(bytes) {
  return `${(bytes / MIB).toFixed(2)} MiB`
}
```

Run: `npx vitest run scripts/assets/lib.test.mjs src/assets/manifest.test.ts`
Expected: PASS (12 tests), sortie sans avertissement.

- [ ] **Step 7: Créer `scripts/assets/fetch.mjs`**

Téléchargement contrôlé : chaque fichier passe par un `.part` renommé à la fin ; un fichier déjà présent avec la bonne taille est sauté (le script se relance sans tout retélécharger) ; taille vérifiée pour tous, md5 pour Poly Haven ; une ressource annoncée à plus de 64 Mio (par l'API ou par `content-length`) arrête tout ; les zips d'ambientCG sont décompressés par `readZip` en `color.jpg`, `normal.jpg`, `roughness.jpg` (obligatoires) et `ao.jpg`, `metalness.jpg` (s'ils existent) ; code de sortie 1 au premier échec.

```js
// Downloads the source files of every asset in manifest.json into assets-src/<id>/ (ignored by git).
// Usage: npm run assets:fetch [-- --only id1,id2]
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { MIB } from '../../src/assets/paths.ts'
import {
  AMBIENTCG_MAPS,
  ambientCgDownload,
  formatMiB,
  polyHavenModelDownloads,
  polyHavenTextureDownloads,
  readZip,
  sourceResolutionKey,
} from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const MAX_DOWNLOAD = 64 * MIB
const HEADERS = { 'user-agent': 'athena-prompt-academy asset fetch (CC0 assets, run by hand)' }
const REQUIRED_AMBIENTCG_MAPS = ['color', 'normal', 'roughness']

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log('Usage: npm run assets:fetch [-- --only id1,id2]')
  console.log('Downloads the sources listed in scripts/assets/manifest.json into assets-src/<id>/.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
const only = values.only ? new Set(values.only.split(',').map((id) => id.trim())) : null
const unknown = only ? [...only].filter((id) => !manifest.assets.some((entry) => entry.id === id)) : []
if (unknown.length > 0) {
  console.error(`Unknown asset id(s): ${unknown.join(', ')}`)
  process.exit(1)
}

async function getJson(url) {
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.json()
}

function md5Of(path) {
  return createHash('md5').update(readFileSync(path)).digest('hex')
}

/** Downloads one file to its place under assets-src/<id>/, through a .part file; skips a file already there with the right size. */
async function download(id, file) {
  if (!(file.size > 0)) throw new Error(`${id}/${file.path}: the source API gives no size`)
  if (file.size > MAX_DOWNLOAD) throw new Error(`${id}/${file.path}: announced at ${formatMiB(file.size)}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
  const target = join(SOURCES, id, file.path)
  if (existsSync(target) && statSync(target).size === file.size) return { bytes: file.size, skipped: true }
  mkdirSync(dirname(target), { recursive: true })
  const part = `${target}.part`
  try {
    const response = await fetch(file.url, { headers: HEADERS })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
    const announced = Number(response.headers.get('content-length') ?? file.size)
    if (announced > MAX_DOWNLOAD) throw new Error(`announced at ${formatMiB(announced)}, over the ${formatMiB(MAX_DOWNLOAD)} limit`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(part))
    const size = statSync(part).size
    if (size !== file.size) throw new Error(`expected ${file.size} bytes, got ${size}`)
    if (file.md5 && md5Of(part) !== file.md5) throw new Error('md5 mismatch')
    renameSync(part, target)
    return { bytes: size, skipped: false }
  } catch (error) {
    rmSync(part, { force: true })
    throw new Error(`${id}/${file.path} (${file.url}): ${error.message}`)
  }
}

/** Unpacks the maps we use from an ambientCG zip: color, normal (OpenGL), roughness, and AO / metalness when present. */
function extractAmbientCg(id) {
  const folder = join(SOURCES, id)
  const entries = readZip(readFileSync(join(folder, 'source.zip')))
  for (const [map, pattern] of Object.entries(AMBIENTCG_MAPS)) {
    const name = [...entries.keys()].find((entry) => pattern.test(entry))
    if (!name) {
      if (REQUIRED_AMBIENTCG_MAPS.includes(map)) throw new Error(`${id}: source.zip has no ${map} map`)
      continue
    }
    writeFileSync(join(folder, `${map}.jpg`), entries.get(name))
  }
}

async function downloadsFor(entry) {
  const json = await getJson(entry.api)
  if (entry.source === 'ambientcg') return [ambientCgDownload(json, entry)]
  if (entry.kind === 'texture') return polyHavenTextureDownloads(json, entry)
  return polyHavenModelDownloads(json, sourceResolutionKey(entry))
}

let total = 0
try {
  for (const entry of manifest.assets) {
    if (only && !only.has(entry.id)) continue
    let bytes = 0
    let fetched = 0
    for (const file of await downloadsFor(entry)) {
      const result = await download(entry.id, file)
      bytes += result.bytes
      if (!result.skipped) fetched++
    }
    if (entry.source === 'ambientcg') extractAmbientCg(entry.id)
    total += bytes
    console.log(`${entry.id.padEnd(26)} ${formatMiB(bytes).padStart(10)}  ${fetched > 0 ? `${fetched} file(s) downloaded` : 'already there'}`)
  }
  console.log(`${'total'.padEnd(26)} ${formatMiB(total).padStart(10)}`)
} catch (error) {
  console.error(`assets:fetch failed: ${error.message}`)
  process.exit(1)
}
```

Run: `npm run assets:fetch -- --help`
Expected: les deux lignes d'aide (`Usage: npm run assets:fetch [-- --only id1,id2]` …), code de sortie 0, aucun accès réseau.

Run: `npm run assets:fetch -- --only nope`
Expected: `Unknown asset id(s): nope`, code de sortie 1, aucun accès réseau.

- [ ] **Step 8: Créer `scripts/assets/build.mjs`**

Trois choix de préparation complètent ce contrat, chacun justifié dans le code :
- `dedup({ keepUniqueNames: true })` : dans `modern_ceiling_lamp_01`, les matériaux `modern_ceiling_lamp_01_glass` et `modern_ceiling_lamp_01` ne diffèrent que par leur nom ; un `dedup()` par défaut les fusionnerait et le site perdrait le nom `…_glass` (exemption `glass`) ;
- `prune({ keepSolidTextures: true })` : chaque matériau de modèle garde ses cartes (l'audit des matériaux les compte) ;
- les extensions `KHR_materials_transmission` et `KHR_materials_volume` sont retirées (le verre de `wall_clock` en déclare une) : three.js rendrait la scène une seconde fois à chaque image pour la transmission ; le verre reste en mélange alpha (`BLEND`, opacité 0,4).

```js
// Prepares public/assets/ from assets-src/: WebP textures (sharp), meshopt-compressed GLB models (glTF-Transform),
// CREDITS.md, then prints every file with its size and checks the asset budgets.
// Usage: npm run assets:build [-- --only id]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { ASSET_BUDGET, ASSETS_DIR, CREDITS_FILE, TEXTURE_MAPS, WEBP_QUALITY, modelFile, textureFile } from '../../src/assets/paths.ts'
import { formatMiB, renderCredits } from './lib.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SOURCES = join(ROOT, 'assets-src')
const OUT = join(ROOT, ASSETS_DIR)
/** No physical transmission in the site: three.js would render the scene a second time for it, every frame. Glass stays alpha-blended. */
const DROPPED_EXTENSIONS = ['KHR_materials_transmission', 'KHR_materials_volume']

const { values } = parseArgs({ options: { only: { type: 'string' }, help: { type: 'boolean', default: false } } })
if (values.help) {
  console.log('Usage: npm run assets:build [-- --only id]')
  console.log('Builds public/assets/ (WebP textures, meshopt GLB models, CREDITS.md) from assets-src/ and checks the budgets.')
  process.exit(0)
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8'))
if (values.only && !manifest.assets.some((entry) => entry.id === values.only)) {
  console.error(`Unknown asset id: ${values.only}`)
  process.exit(1)
}

/** Same rule as entryFiles() in src/assets/manifest.ts (which Node cannot import: it needs zod and extensionless imports). */
const filesOf = (entry) => (entry.kind === 'texture' ? TEXTURE_MAPS.map((map) => textureFile(entry.id, map)) : [modelFile(entry.id)])

function source(entry, name) {
  const path = join(SOURCES, entry.id, name)
  if (!existsSync(path)) throw new Error(`${entry.id}: assets-src/${entry.id}/${name} is missing, run npm run assets:fetch first`)
  return path
}

function output(file) {
  const path = join(OUT, file)
  mkdirSync(dirname(path), { recursive: true })
  return path
}

/** One grey channel of an image at size x size, as raw bytes (one byte per pixel). */
function channel(path, size) {
  return sharp(path).resize(size, size, { fit: 'fill' }).extractChannel(0).raw().toBuffer()
}

async function buildTexture(entry) {
  const { color, normal, arm } = entry.resolution
  await sharp(source(entry, 'color.jpg'))
    .resize(color, color, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY.color })
    .toFile(output(textureFile(entry.id, 'color')))
  await sharp(source(entry, 'normal.jpg'))
    .resize(normal, normal, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY.normal })
    .toFile(output(textureFile(entry.id, 'normal')))
  if (entry.source === 'polyhaven') {
    await sharp(source(entry, 'arm.jpg'))
      .resize(arm, arm, { fit: 'fill' })
      .webp({ quality: WEBP_QUALITY.arm })
      .toFile(output(textureFile(entry.id, 'arm')))
    return
  }
  // ambientCG ships separate maps: pack them as glTF does, R = ambient occlusion, G = roughness, B = metalness.
  const folder = join(SOURCES, entry.id)
  const optional = (name, fill) => (existsSync(join(folder, name)) ? channel(join(folder, name), arm) : Buffer.alloc(arm * arm, fill))
  const [ao, roughness, metalness] = await Promise.all([
    optional('ao.jpg', 255),
    channel(source(entry, 'roughness.jpg'), arm),
    optional('metalness.jpg', 0),
  ])
  const pixels = Buffer.alloc(arm * arm * 3)
  for (let i = 0; i < arm * arm; i++) {
    pixels[i * 3] = ao[i]
    pixels[i * 3 + 1] = roughness[i]
    pixels[i * 3 + 2] = metalness[i]
  }
  await sharp(pixels, { raw: { width: arm, height: arm, channels: 3 } })
    .webp({ quality: WEBP_QUALITY.arm })
    .toFile(output(textureFile(entry.id, 'arm')))
}

let io = null
async function modelIO() {
  if (!io) {
    await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready])
    io = new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
  }
  return io
}

async function buildModel(entry) {
  const io = await modelIO()
  const document = await io.read(source(entry, 'model.gltf'))
  const root = document.getRoot()
  for (const extension of [...root.listExtensionsUsed()]) {
    if (DROPPED_EXTENSIONS.includes(extension.extensionName)) extension.dispose()
  }
  if (entry.variant) {
    for (const node of [...root.listNodes()]) {
      const name = node.getName()
      if (/_[a-z]$/.test(name) && !name.endsWith(`_${entry.variant}`)) node.dispose()
    }
  }
  const size = entry.textureSize
  // keepUniqueNames: the site finds materials by name (the *_glass ones, the pendant bulb, the frame artwork), even identical ones.
  // keepSolidTextures: every model material keeps its maps (the material audit counts them).
  const transforms = [dedup({ keepUniqueNames: true }), prune({ keepSolidTextures: true }), weld()]
  if (entry.simplify) {
    transforms.push(simplify({ simplifier: MeshoptSimplifier, ratio: entry.simplify.ratio, error: entry.simplify.error }))
  }
  transforms.push(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: WEBP_QUALITY.color, slots: /^(?!normalTexture).*$/ }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: WEBP_QUALITY.normal, slots: /^normalTexture$/ }),
  )
  // Quantization moves the vertices into node transforms: the clock keeps raw positions so its hands turn about the dial centre.
  if (entry.quantize !== false) transforms.push(meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await document.transform(...transforms)
  writeFileSync(output(modelFile(entry.id)), await io.writeBinary(document))
}

try {
  for (const entry of manifest.assets) {
    if (values.only && entry.id !== values.only) continue
    if (entry.kind === 'texture') await buildTexture(entry)
    else await buildModel(entry)
    console.log(`built ${entry.id}`)
  }

  // Files the manifest no longer produces are removed, so public/assets always matches it.
  const expected = new Set(manifest.assets.flatMap(filesOf))
  for (const folder of ['textures', 'models']) {
    if (!existsSync(join(OUT, folder))) continue
    for (const file of readdirSync(join(OUT, folder))) {
      if (!expected.has(`${folder}/${file}`)) {
        rmSync(join(OUT, folder, file), { recursive: true })
        console.log(`removed ${folder}/${file} (not in the manifest)`)
      }
    }
  }

  const rows = manifest.assets.flatMap((entry) =>
    filesOf(entry).map((file) => {
      const path = join(OUT, file)
      if (!existsSync(path)) throw new Error(`${file} is missing: run npm run assets:build without --only`)
      return { file, assetId: entry.id, source: entry.source, sourceId: entry.sourceId, stage: entry.stage, bytes: statSync(path).size }
    }),
  )
  writeFileSync(join(OUT, CREDITS_FILE), renderCredits(rows))

  console.log('')
  for (const row of rows) console.log(`${row.file.padEnd(46)} ${row.stage.padEnd(6)} ${formatMiB(row.bytes).padStart(10)}`)
  const total = rows.reduce((sum, row) => sum + row.bytes, statSync(join(OUT, CREDITS_FILE)).size)
  const base = rows.filter((row) => row.stage === 'base').reduce((sum, row) => sum + row.bytes, 0)
  const largest = rows.reduce((max, row) => (row.bytes > max.bytes ? row : max))
  console.log('')
  console.log(`total (public/assets)   ${formatMiB(total)} / ${formatMiB(ASSET_BUDGET.totalBytes)}`)
  console.log(`first image (base)      ${formatMiB(base)} / ${formatMiB(ASSET_BUDGET.baseBytes)}`)
  console.log(`largest file            ${formatMiB(largest.bytes)} (${largest.file}), must stay under ${formatMiB(ASSET_BUDGET.maxFileBytes)}`)

  const failures = []
  if (total > ASSET_BUDGET.totalBytes) failures.push(`public/assets is ${formatMiB(total)}, over ${formatMiB(ASSET_BUDGET.totalBytes)}`)
  if (base > ASSET_BUDGET.baseBytes) failures.push(`the first-image (base) assets are ${formatMiB(base)}, over ${formatMiB(ASSET_BUDGET.baseBytes)}`)
  for (const row of rows) {
    if (row.bytes >= ASSET_BUDGET.maxFileBytes) failures.push(`${row.file} is ${formatMiB(row.bytes)}, files must stay under ${formatMiB(ASSET_BUDGET.maxFileBytes)}`)
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`Asset budget exceeded: ${failure}`)
    process.exit(1)
  }
  console.log('Asset budgets OK')
} catch (error) {
  console.error(`assets:build failed: ${error.message}`)
  process.exit(1)
}
```

Run: `npm run assets:build -- --help`
Expected: les deux lignes d'aide, code de sortie 0. Cette exécution charge sharp (binaire Windows), `@gltf-transform/*` et meshoptimizer : une erreur ici signale une installation incomplète du Step 1.

Run: `npm run assets:build -- --only nope`
Expected: `Unknown asset id: nope`, code de sortie 1 ; `public/assets/` n'est pas créé.

- [ ] **Step 9: Vérifier et commiter**

Run: `npm run check`
Expected: PASS ; les 12 nouveaux tests passent avec les anciens ; « Initial JS (gzip) » inchangé (aucun code du site n'importe encore `src/assets/*`) ; `No test API (__academy) in the production JS`.

Run: `git status --short`
Expected: uniquement les fichiers de cette tâche ; aucun `assets-src/`.

```bash
git add package.json package-lock.json .gitignore vite.config.ts src/test/setup.ts src/assets scripts/assets
git commit -m "feat: CC0 asset pipeline: manifest, controlled fetch, WebP and meshopt build, credits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Assets produits, crédits, budgets et catalogue d'exécution

**Files:**
- Create: `public/assets/textures/*.webp` (24 fichiers), `public/assets/models/*.glb` (12 fichiers), `public/assets/CREDITS.md` (tous générés par `npm run assets:build`), `src/three/assets.ts`
- Delete: `public/models/.gitkeep`
- Modify (seulement si l'échelle de repli s'applique, Step 6) : `scripts/assets/manifest.json`, `src/assets/paths.ts`
- Test: `src/assets/assets.test.ts`, `src/three/assets.test.ts`

**Interfaces:**
- Consumes (Tâche 1) : `assetManifestSchema`, `entryFiles`, `manifestFiles` (`src/assets/manifest.ts`) ; `ASSET_BUDGET`, `ASSETS_DIR`, `CREDITS_FILE`, `LICENCE`, `modelFile`, `textureFile`, `Stage`, `TextureMap` (`src/assets/paths.ts`) ; scripts `assets:fetch`, `assets:build`.
- Produces (`src/three/assets.ts`, code exact) : `TextureSetId`, `TextureSetSpec`, `TEXTURE_SETS`, `TEXTURE_SET_IDS`, `ModelId`, `ModelSpec`, `MODELS`, `textureUrl(set: TextureSetId, map: TextureMap): string`, `modelUrl(model: ModelId): string`, `MODEL_PARTS`, `GLASS_MATERIAL`, `CRT_SCREEN`.
- Produces : les 36 fichiers de `public/assets/` et `public/assets/CREDITS.md`, dans les budgets (`public/assets` ≤ 18 Mio, étage `base` ≤ 6 Mio, chaque fichier < 3 Mio).

- [ ] **Step 1: Écrire le test qui échoue `src/three/assets.test.ts`**

```ts
import manifestJson from '../../scripts/assets/manifest.json'
import { assetManifestSchema } from '../assets/manifest'
import { publicUrl } from '../core/publicUrl'
import { MODELS, TEXTURE_SET_IDS, TEXTURE_SETS, modelUrl, textureUrl, type ModelId } from './assets'

const manifest = assetManifestSchema.parse(manifestJson)
const entry = (id: string) => manifest.assets.find((asset) => asset.id === id)

test('every texture set and model points to a manifest entry with the same stage, tile and metal flag', () => {
  for (const id of TEXTURE_SET_IDS) {
    const set = TEXTURE_SETS[id]
    // Textures dress the base of the scene: they load before the first image.
    expect(entry(set.assetId), id).toMatchObject({ kind: 'texture', stage: 'base', tileMetres: set.tileMetres, metal: set.metal })
  }
  for (const id of Object.keys(MODELS) as ModelId[]) {
    expect(entry(MODELS[id].assetId), id).toMatchObject({ kind: 'model', stage: MODELS[id].stage })
  }
  // Nothing is downloaded for nothing: every manifest entry is used once by the site.
  const used = [...Object.values(TEXTURE_SETS), ...Object.values(MODELS)].map((spec) => spec.assetId)
  expect([...used].sort()).toEqual(manifest.assets.map((asset) => asset.id).sort())
})

test('asset URLs go through publicUrl', () => {
  expect(textureUrl('floor', 'color')).toBe(publicUrl('assets/textures/plank_flooring_04_color.webp'))
  expect(textureUrl('blackMetal', 'arm')).toBe(publicUrl('assets/textures/metal046a_arm.webp'))
  expect(modelUrl('wallClock')).toBe(publicUrl('assets/models/wall_clock.glb'))
})
```

Run: `npx vitest run src/three/assets.test.ts`
Expected: FAIL — `Failed to resolve import "./assets"`.

- [ ] **Step 2: Créer `src/three/assets.ts`**

Code exact du contrat ; seule `CRT_SCREEN.center[2]` peut changer dans cette tâche, et seulement par le remède du Step 7.

```ts
import { modelFile, textureFile, type Stage, type TextureMap } from '../assets/paths'
import { publicUrl } from '../core/publicUrl'

export type TextureSetId = 'floor' | 'wall' | 'oak' | 'walnut' | 'fabric' | 'carpet' | 'blackMetal' | 'brushedMetal'
export interface TextureSetSpec {
  /** Manifest id (scripts/assets/manifest.json). */
  assetId: string
  /** Real-world size of one texture repeat, in metres (geometry UVs are in metres, see three/uv.ts). */
  tileMetres: number
  metal: boolean
}
export const TEXTURE_SETS: Record<TextureSetId, TextureSetSpec> = {
  floor: { assetId: 'plank_flooring_04', tileMetres: 2, metal: false },
  wall: { assetId: 'beige_wall_001', tileMetres: 3, metal: false },
  oak: { assetId: 'oak_veneer_05', tileMetres: 1, metal: false },
  walnut: { assetId: 'american_walnut_veneer', tileMetres: 1, metal: false },
  fabric: { assetId: 'fabric036', tileMetres: 0.5, metal: false },
  carpet: { assetId: 'carpet016', tileMetres: 1.7, metal: false },
  blackMetal: { assetId: 'metal046a', tileMetres: 1, metal: true },
  brushedMetal: { assetId: 'metal027', tileMetres: 1, metal: true },
}
export const TEXTURE_SET_IDS = Object.keys(TEXTURE_SETS) as TextureSetId[]

export type ModelId =
  | 'sideboard' | 'television' | 'wallClock' | 'drawerCabinet' | 'coffeeTable' | 'pendantLamp'
  | 'pictureFrame' | 'pottedPlant' | 'pachira' | 'vaseTall' | 'vaseRound' | 'clayPot'
export interface ModelSpec {
  assetId: string
  stage: Stage
}
export const MODELS: Record<ModelId, ModelSpec> = {
  sideboard: { assetId: 'modern_wooden_cabinet', stage: 'base' },
  television: { assetId: 'television_02', stage: 'base' },
  wallClock: { assetId: 'wall_clock', stage: 'base' },
  drawerCabinet: { assetId: 'drawer_cabinet', stage: 'decor' },
  coffeeTable: { assetId: 'modern_coffee_table_01', stage: 'decor' },
  pendantLamp: { assetId: 'modern_ceiling_lamp_01', stage: 'decor' },
  pictureFrame: { assetId: 'hanging_picture_frame_01', stage: 'decor' },
  pottedPlant: { assetId: 'potted_plant_01', stage: 'decor' },
  pachira: { assetId: 'pachira_aquatica_01', stage: 'decor' },
  vaseTall: { assetId: 'ceramic_vase_01', stage: 'decor' },
  vaseRound: { assetId: 'ceramic_vase_04', stage: 'decor' },
  clayPot: { assetId: 'planter_pot_clay', stage: 'decor' },
}

export function textureUrl(set: TextureSetId, map: TextureMap): string {
  return publicUrl(`assets/${textureFile(TEXTURE_SETS[set].assetId, map)}`)
}
export function modelUrl(model: ModelId): string {
  return publicUrl(`assets/${modelFile(MODELS[model].assetId)}`)
}

/** Node and material names inside the models (src/assets/assets.test.ts checks them against the GLB files). */
export const MODEL_PARTS = {
  clockHands: { hour: 'wall_clock_hours_hand', minute: 'wall_clock_minute_hand', second: 'wall_clock_second_hand' },
  pendantBulb: 'modern_ceiling_globe',
  frameArtwork: 'hanging_picture_frame_01_artwork',
} as const
/** Model materials whose name matches are glass (audit exemption). */
export const GLASS_MATERIAL = /_glass$/
/**
 * The TV picture, in the normalised television_02 frame (origin at the bottom centre, front +z).
 * Starting values; Task 11 aligns them on screenshots. center.z sits at most 6 mm in front of the model's front face.
 */
export const CRT_SCREEN = { width: 0.27, height: 0.2, center: [0, 0.235, 0.177] as [number, number, number] }
```

Run: `npx vitest run src/three/assets.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Écrire le test qui échoue `src/assets/assets.test.ts`**

Ce test lit les fichiers produits : `CREDITS.md` (analysé ligne par ligne avec l'expression `CREDIT_ROW` du test, fins de ligne `\r\n` tolérées), les tailles réelles, et les GLB, ouverts par `NodeIO` (toutes les extensions, décodeur meshopt). Les extensions déclarées sont lues directement dans le bloc JSON du GLB.

```ts
// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeIO, type Document } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/functions'
import { MeshoptDecoder } from 'meshoptimizer'
import { CRT_SCREEN, GLASS_MATERIAL, MODEL_PARTS } from '../three/assets'
import { assetManifestSchema, entryFiles, manifestFiles } from './manifest'
import { ASSET_BUDGET, ASSETS_DIR, CREDITS_FILE, LICENCE, modelFile } from './paths'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const ASSETS = join(ROOT, ASSETS_DIR)
const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(join(ROOT, 'scripts/assets/manifest.json'), 'utf8')))
const models = manifest.assets.flatMap((entry) => (entry.kind === 'model' ? [entry] : []))

/** Every file under public/assets, relative to it, with '/' separators. */
function listFiles(dir = ASSETS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name)
    return item.isDirectory() ? listFiles(path) : [relative(ASSETS, path).split(sep).join('/')]
  })
}
const sizeOf = (file: string) => statSync(join(ASSETS, file)).size
const sum = (files: string[]) => files.reduce((total, file) => total + sizeOf(file), 0)

const CREDIT_ROW = /^\| (\S+) \| (\S+) \| (Poly Haven|ambientCG) (\S+) \| (CC0-1\.0) \| (\d+) \|$/
function credits() {
  const rows = new Map<string, { assetId: string; source: string; url: string; licence: string; bytes: number }>()
  for (const line of readFileSync(join(ASSETS, CREDITS_FILE), 'utf8').split('\n')) {
    const match = CREDIT_ROW.exec(line.trimEnd())
    if (match) rows.set(match[1], { assetId: match[2], source: match[3], url: match[4], licence: match[5], bytes: Number(match[6]) })
  }
  return rows
}

let io: NodeIO
beforeAll(async () => {
  await MeshoptDecoder.ready
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
})
const documents = new Map<string, Promise<Document>>()
function readModel(id: string): Promise<Document> {
  if (!documents.has(id)) documents.set(id, io.read(join(ASSETS, modelFile(id))))
  return documents.get(id)!
}
/** extensionsUsed of a GLB, read straight from its JSON chunk (header 12 bytes, chunk length, chunk type, JSON). */
function glbExtensions(id: string): string[] {
  const glb = readFileSync(join(ASSETS, modelFile(id)))
  const length = glb.readUInt32LE(12)
  return (JSON.parse(glb.toString('utf8', 20, 20 + length)) as { extensionsUsed?: string[] }).extensionsUsed ?? []
}

test('every file in public/assets is listed in CREDITS.md as CC0-1.0 with its exact size', () => {
  const rows = credits()
  const files = listFiles().filter((file) => file !== CREDITS_FILE)
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const row = rows.get(file)
    expect(row, file).toBeDefined()
    expect(row!.licence).toBe(LICENCE)
    expect(row!.bytes, file).toBe(sizeOf(file))
    const entry = manifest.assets.find((asset) => entryFiles(asset).includes(file))
    expect(entry, file).toBeDefined()
    expect(row!.assetId).toBe(entry!.id)
    expect(row!.source).toBe(entry!.source === 'polyhaven' ? 'Poly Haven' : 'ambientCG')
    expect(row!.url).toBe(
      entry!.source === 'polyhaven' ? `https://polyhaven.com/a/${entry!.sourceId}` : `https://ambientcg.com/view?id=${entry!.sourceId}`,
    )
  }
  expect([...rows.keys()].sort()).toEqual([...files].sort())
})

test('the manifest produces exactly the files in public/assets', () => {
  expect(listFiles().filter((file) => file !== CREDITS_FILE).sort()).toEqual(manifestFiles(manifest).sort())
})

test('public/assets stays within 18 MiB', () => {
  expect(sum(listFiles())).toBeLessThanOrEqual(ASSET_BUDGET.totalBytes)
})

test('assets needed for the first image stay within 6 MiB', () => {
  expect(sum(manifestFiles(manifest, 'base'))).toBeLessThanOrEqual(ASSET_BUDGET.baseBytes)
})

test('no asset file reaches 3 MiB', () => {
  for (const file of listFiles()) expect(sizeOf(file), file).toBeLessThan(ASSET_BUDGET.maxFileBytes)
})

test('models are meshopt-compressed with WebP textures and never use Draco', async () => {
  for (const entry of models) {
    const used = glbExtensions(entry.id)
    // The clock is built without quantization (its hands turn about their raw origin), hence without meshopt.
    expect(used.includes('EXT_meshopt_compression'), entry.id).toBe(entry.quantize)
    expect(used, entry.id).not.toContain('KHR_draco_mesh_compression')
    // No physical transmission either: three.js would render the scene twice for it.
    expect(used, entry.id).not.toContain('KHR_materials_transmission')
    const textures = (await readModel(entry.id)).getRoot().listTextures()
    expect(textures.length, entry.id).toBeGreaterThan(0)
    for (const texture of textures) expect(texture.getMimeType(), entry.id).toBe('image/webp')
  }
}, 60_000)

test('the clock keeps three hand nodes with identity transforms', async () => {
  const nodes = (await readModel('wall_clock')).getRoot().listNodes()
  for (const name of Object.values(MODEL_PARTS.clockHands)) {
    const node = nodes.find((candidate) => candidate.getName() === name)
    expect(node, name).toBeDefined()
    expect(node!.getMesh(), name).not.toBeNull()
    expect(node!.getTranslation(), name).toEqual([0, 0, 0])
    expect(node!.getRotation(), name).toEqual([0, 0, 0, 1])
    expect(node!.getScale(), name).toEqual([1, 1, 1])
  }
})

test('the pendant has its bulb material and the frame its artwork material', async () => {
  const materials = async (id: string) => (await readModel(id)).getRoot().listMaterials().map((material) => material.getName())
  const pendant = await materials('modern_ceiling_lamp_01')
  expect(pendant).toContain(MODEL_PARTS.pendantBulb)
  expect(pendant.filter((name) => GLASS_MATERIAL.test(name))).toEqual(['modern_ceiling_lamp_01_glass'])
  expect(await materials('hanging_picture_frame_01')).toContain(MODEL_PARTS.frameArtwork)
  expect((await materials('wall_clock')).filter((name) => GLASS_MATERIAL.test(name))).toEqual(['wall_clock_glass'])
})

test('the money tree keeps only variant b', async () => {
  const names = (await readModel('pachira_aquatica_01')).getRoot().listNodes().map((node) => node.getName())
  const variants = names.filter((name) => /_[a-z]$/.test(name))
  expect(variants.length).toBeGreaterThan(0)
  expect(variants.filter((name) => !name.endsWith('_b'))).toEqual([])
})

test('the CRT picture sits just in front of the television', async () => {
  const document = await readModel('television_02')
  const { min, max } = getBounds(document.getRoot().listScenes()[0])
  const [width, height, depth] = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
  const [x, y, z] = CRT_SCREEN.center
  // Normalised frame (normaliseModel): standing on y = 0, centred on x and z, front face at z = depth / 2.
  const gap = z - depth / 2
  expect(gap).toBeGreaterThan(0)
  expect(gap).toBeLessThanOrEqual(0.006)
  expect(Math.abs(x) + CRT_SCREEN.width / 2).toBeLessThanOrEqual(width / 2)
  expect(y - CRT_SCREEN.height / 2).toBeGreaterThanOrEqual(0)
  expect(y + CRT_SCREEN.height / 2).toBeLessThanOrEqual(height)
})
```

Run: `npx vitest run src/assets/assets.test.ts`
Expected: FAIL — `ENOENT: no such file or directory` sur `public/assets` (rien n'est encore produit).

- [ ] **Step 4: Télécharger les sources**

Run: `npm run assets:fetch`
Expected: une ligne par asset puis le total ; les tailles ci-dessous sont celles annoncées par les API le 2026-10-06 (≈ 62 Mio ; elles peuvent varier légèrement si un auteur a republié un fichier, le script suit toujours l'API) ; code de sortie 0 :

```text
plank_flooring_04            6.15 MiB  3 file(s) downloaded
beige_wall_001               1.42 MiB  3 file(s) downloaded
oak_veneer_05                1.55 MiB  3 file(s) downloaded
american_walnut_veneer       1.62 MiB  3 file(s) downloaded
fabric036                    9.20 MiB  1 file(s) downloaded
carpet016                    8.94 MiB  1 file(s) downloaded
metal046a                    5.23 MiB  1 file(s) downloaded
metal027                     6.02 MiB  1 file(s) downloaded
modern_wooden_cabinet        2.72 MiB  5 file(s) downloaded
television_02                1.18 MiB  5 file(s) downloaded
wall_clock                   1.49 MiB  6 file(s) downloaded
drawer_cabinet               1.09 MiB  5 file(s) downloaded
modern_coffee_table_01       1.27 MiB  5 file(s) downloaded
modern_ceiling_lamp_01       0.42 MiB  5 file(s) downloaded
hanging_picture_frame_01     0.38 MiB  8 file(s) downloaded
potted_plant_01              6.03 MiB  8 file(s) downloaded
pachira_aquatica_01          4.90 MiB  8 file(s) downloaded
ceramic_vase_01              0.40 MiB  5 file(s) downloaded
ceramic_vase_04              0.57 MiB  5 file(s) downloaded
planter_pot_clay             1.71 MiB  5 file(s) downloaded
total                       62.29 MiB
```

Une coupure réseau donne `assets:fetch failed: <id>/<fichier> (<url>): …` et le code 1 : relancer la même commande, les fichiers complets sont sautés (« already there »). Un échec qui persiste (site indisponible, md5 faux) arrête la tâche : la signaler au contrôleur avec la ligne d'erreur, sans changer de source.

Run: `git status --short`
Expected: aucune ligne `assets-src/` (dossier ignoré).

- [ ] **Step 5: Construire `public/assets/`**

Run: `npm run assets:build`
Expected: 20 lignes `built <id>`, puis le tableau des 36 fichiers (`textures/…_color.webp`, `…_normal.webp`, `…_arm.webp` pour les 8 textures, `models/<id>.glb` pour les 12 modèles, avec leur étage et leur taille), puis les trois lignes de totaux `total (public/assets)`, `first image (base)`, `largest file`, et enfin `Asset budgets OK` (code 0) ou une ou plusieurs lignes `Asset budget exceeded: …` (code 1). Noter ces trois lignes de totaux : elles vont dans le message de commit.

- [ ] **Step 6: Si un budget est dépassé, appliquer l'échelle de repli**

À faire seulement si le Step 5 finit par `Asset budget exceeded`. Appliquer les pas dans l'ordre, relancer `npm run assets:build` après chacun, et s'arrêter dès que la sortie finit par `Asset budgets OK`. Ne rien changer d'autre (ni sources, ni résolutions des cartes de couleur, ni modèles retirés).

Pas 1 — ARM du sol et des murs 1024 → 512. Dans `scripts/assets/manifest.json`, remplacer exactement

```json
      "usage": "Oak plank floor",
      "tileMetres": 2.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 1024 }
```

par

```json
      "usage": "Oak plank floor",
      "tileMetres": 2.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 512 }
```

et

```json
      "usage": "Walls and ceiling, tinted greige",
      "tileMetres": 3.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 1024 }
```

par

```json
      "usage": "Walls and ceiling, tinted greige",
      "tileMetres": 3.0,
      "metal": false,
      "resolution": { "color": 2048, "normal": 1024, "arm": 512 }
```

Pas 2 — normales de `fabric036`, `carpet016`, `metal046a`, `metal027` 1024 → 512. Dans `scripts/assets/manifest.json`, remplacer exactement chacun des quatre blocs suivants (et eux seuls : `oak_veneer_05` et `american_walnut_veneer` gardent leurs normales en 1024)

```json
      "usage": "Chair shells, sofa, cushions",
      "tileMetres": 0.5,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
```

```json
      "usage": "Wool rug under the table",
      "tileMetres": 1.7,
      "metal": false,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
```

```json
      "usage": "Black metal: legs, mullions, frames",
      "tileMetres": 1.0,
      "metal": true,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
```

```json
      "usage": "Brushed metal: microphones, laptop, lamp stem",
      "tileMetres": 1.0,
      "metal": true,
      "resolution": { "color": 1024, "normal": 1024, "arm": 512 }
```

par le même bloc dont la dernière ligne devient

```json
      "resolution": { "color": 1024, "normal": 512, "arm": 512 }
```

Pas 3 — qualités WebP. Dans `src/assets/paths.ts`, remplacer exactement

```ts
export const WEBP_QUALITY = { color: 82, normal: 90, arm: 80 } as const
```

par

```ts
export const WEBP_QUALITY = { color: 75, normal: 82, arm: 80 } as const
```

Pas 4 — textures des modèles 1024 → 512. Dans `scripts/assets/manifest.json`, remplacer toutes les occurrences de

```json
      "textureSize": 1024,
```

par

```json
      "textureSize": 512,
```

(cinq entrées : `modern_wooden_cabinet`, `drawer_cabinet`, `modern_coffee_table_01`, `potted_plant_01`, `pachira_aquatica_01`).

Après chaque pas : `npm run assets:build` (mêmes sorties qu'au Step 5) puis `npx vitest run src/assets/manifest.test.ts` (PASS : aucun pas ne touche aux cartes de couleur ni ne grossit une carte). Si le budget casse encore après le pas 4, arrêter la tâche et transmettre au contrôleur la sortie complète de `npm run assets:build` : aucune autre réduction n'est prévue par le plan.

- [ ] **Step 7: Lancer les tests des assets**

Run: `npx vitest run src/assets src/three/assets.test.ts`
Expected: PASS (6 tests du manifeste, 10 tests des fichiers produits, 2 tests du catalogue).

Si seul « the CRT picture sits just in front of the television » échoue, la profondeur réelle du GLB diffère des 0,35 m relevés sur la source. Afficher l'emprise du modèle :

Run: `node --input-type=module -e "import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import { getBounds } from '@gltf-transform/functions'; import { MeshoptDecoder } from 'meshoptimizer'; await MeshoptDecoder.ready; const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }); const doc = await io.read('public/assets/models/television_02.glb'); console.log(getBounds(doc.getRoot().listScenes()[0]))"`
Expected: `{ min: [ -0.202…, 0…, -0.228… ], max: [ 0.198…, 0.411…, 0.122… ] }` à quelques dixièmes de millimètre près (la quantification meshopt arrondit).

Puis, dans `src/three/assets.ts`, mettre `CRT_SCREEN.center[2]` à `(max[2] − min[2]) / 2 + 0.002`, arrondi au millimètre, et relancer la commande de test (PASS). Tout autre échec signale une préparation fausse : le corriger dans `scripts/assets/build.mjs` (jamais en changeant le test), reconstruire, relancer.

- [ ] **Step 8: Retirer l'ancien dossier des modèles, vérifier et commiter**

Run: `git rm public/models/.gitkeep`
Expected: `rm 'public/models/.gitkeep'` ; le dossier vide `public/models/` disparaît (les modèles vivent désormais sous `public/assets/models/`).

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » inchangé (rien n'importe encore `src/three/assets.ts`) ; `dist/assets/` contient maintenant aussi les textures et modèles copiés depuis `public/` (ils ne comptent pas dans le budget JS).

Run: `git status --short`
Expected: `public/assets/` (36 fichiers et `CREDITS.md`), `src/three/assets.ts`, les deux tests, la suppression de `public/models/.gitkeep`, et `scripts/assets/manifest.json` / `src/assets/paths.ts` seulement si le Step 6 a servi ; aucun `assets-src/`.

Le message de commit cite les pas de repli appliqués et les trois lignes de totaux affichées par le dernier `npm run assets:build` : remplacer chaque valeur entre chevrons par la valeur affichée (aucune valeur estimée).

```bash
git add public/assets src/three/assets.ts src/three/assets.test.ts src/assets/assets.test.ts scripts/assets/manifest.json src/assets/paths.ts
git commit -m "feat: CC0 textures and models of the office, with credits, budgets and the runtime catalogue

Budget ladder steps applied: <none | 1 | 1-2 | 1-3 | 1-4>.
total (public/assets) <x.xx> MiB / 18.00 MiB; first image (base) <y.yy> MiB / 6.00 MiB; largest file <z.zz> MiB (<file>).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phases du jour, état global et API de test

**Files:**
- Create: `src/core/phase.ts`, `src/zones/office/lighting/presets.ts`, `scripts/shots.mjs`
- Modify: `src/core/store.ts`, `src/app/testApi.ts`, `package.json` (script `shots`)
- Test: `src/core/phase.test.ts`, `src/zones/office/lighting/presets.test.ts`, `src/core/store.test.ts`, `src/core/router.test.ts`, `src/app/testApi.test.ts`

**Interfaces:**
- Consumes: rien (le bloc `scripts` de `package.json` est celui laissé par la Tâche 1).
- Produces (`src/core/phase.ts`, pur, aucun import) : `PHASES = ['day', 'sunset', 'night']`, `Phase`, `PhaseTransition { from: Phase; to: Phase; startedAt: number }` (millisecondes de `performance.now()`), `PHASE_SECONDS = 2.5`, `CLOCK_MINUTES: Record<Phase, number>` (840, 1170, 1380), `phaseForTime(date: Date): Phase`, `nextPhase(phase: Phase): Phase`, `parsePhaseParam(search: string): Phase | null`, `phaseProgress(startedAt: number, now: number): number`, `easePhase(k: number): number`, `clockMinutes(from: Phase, to: Phase, e: number): number`.
- Produces (`src/zones/office/lighting/presets.ts`) : `interface Preset` (24 clés), `PRESET_KEYS: readonly (keyof Preset)[]` (ordre de l'interface), `SUN_TARGET: Vector3` (−1, 0, −1,8), `PRESETS: Record<Phase, Preset>`, `clonePreset(preset: Preset): Preset`, `mixPreset(a: Preset, b: Preset, t: number, out?: Preset): Preset`.
- Produces (`src/core/store.ts`) : `AppState` gagne `phase: Phase`, `phaseTransition: PhaseTransition | null`, `decorReady: boolean`, `advancePhase(): void`, `setPhase(phase: Phase): void`, `finishPhaseTransition(): void`, `setDecorReady(ready: boolean): void` ; `StoreDeps` gagne `initialPhase?: Phase` (défaut `'day'`) et `now?: () => number` (défaut `performance.now()`) ; `appStore` démarre sur `?phase=` sinon l'heure locale.
- Produces (`src/app/testApi.ts`) : `AcademyTestApi` gagne `setPhase(phase: Phase): void` et `rail(t: number): void`.
- Produces (`scripts/shots.mjs`) : `node scripts/shots.mjs --out <dir> [--phases day,sunset,night] [--views overview,presentation,tv] [--prefix <text>] [--wait-decor]` ; fichiers `<prefix><phase>-<vue>.png` ; script npm `shots`.

- [ ] **Step 1: Écrire le test qui échoue `src/core/phase.test.ts`**

```ts
import {
  CLOCK_MINUTES,
  PHASE_SECONDS,
  clockMinutes,
  easePhase,
  nextPhase,
  parsePhaseParam,
  phaseForTime,
  phaseProgress,
} from './phase'

const at = (hours: number, minutes: number) => new Date(2026, 9, 6, hours, minutes)

test('phaseForTime follows the spec bounds', () => {
  expect(phaseForTime(at(6, 59))).toBe('night')
  expect(phaseForTime(at(7, 0))).toBe('day')
  expect(phaseForTime(at(17, 59))).toBe('day')
  expect(phaseForTime(at(18, 0))).toBe('sunset')
  expect(phaseForTime(at(20, 59))).toBe('sunset')
  expect(phaseForTime(at(21, 0))).toBe('night')
  expect(phaseForTime(at(0, 0))).toBe('night')
})

test('nextPhase cycles day, sunset, night', () => {
  expect(nextPhase('day')).toBe('sunset')
  expect(nextPhase('sunset')).toBe('night')
  expect(nextPhase('night')).toBe('day')
})

// Review focus 4: hand-written addresses.
test('parsePhaseParam accepts only day, sunset and night', () => {
  expect(parsePhaseParam('?phase=night')).toBe('night')
  expect(parsePhaseParam('?tune&phase=sunset')).toBe('sunset')
  expect(parsePhaseParam('phase=day')).toBe('day')
  expect(parsePhaseParam('?phase=NIGHT')).toBeNull()
  expect(parsePhaseParam('?phase=')).toBeNull()
  expect(parsePhaseParam('?phase=dawn')).toBeNull()
  expect(parsePhaseParam('?phase=%%%')).toBeNull()
  expect(parsePhaseParam('')).toBeNull()
})

test('phase progress is clamped and eased', () => {
  expect(PHASE_SECONDS).toBe(2.5)
  expect(phaseProgress(1000, 500)).toBe(0)
  expect(phaseProgress(1000, 1000)).toBe(0)
  expect(phaseProgress(1000, 2250)).toBe(0.5)
  expect(phaseProgress(1000, 3500)).toBe(1)
  expect(phaseProgress(1000, 60_000)).toBe(1)
  expect(easePhase(0)).toBe(0)
  expect(easePhase(0.25)).toBeCloseTo(0.0625)
  expect(easePhase(0.5)).toBe(0.5)
  expect(easePhase(0.75)).toBeCloseTo(0.9375)
  expect(easePhase(1)).toBe(1)
})

test('the clock turns forward, through midnight from night to day', () => {
  expect(CLOCK_MINUTES).toEqual({ day: 840, sunset: 1170, night: 1380 })
  expect(clockMinutes('day', 'sunset', 0)).toBe(840)
  expect(clockMinutes('day', 'sunset', 0.5)).toBe(1005)
  expect(clockMinutes('day', 'sunset', 1)).toBe(1170)
  expect(clockMinutes('sunset', 'night', 1)).toBe(1380)
  expect(clockMinutes('night', 'day', 0.5)).toBe(390)
  expect(clockMinutes('night', 'day', 1)).toBe(840)
})
```

Run: `npx vitest run src/core/phase.test.ts`
Expected: FAIL — `Failed to resolve import "./phase"`.

- [ ] **Step 2: Créer `src/core/phase.ts`**

```ts
/*
 * Time of day: the three phases of the office, the hours that choose one on arrival, the `?phase=` override,
 * and the progress of a transition. Pure (no import): the store, the lighting and the clock all read it.
 */
export const PHASES = ['day', 'sunset', 'night'] as const
export type Phase = (typeof PHASES)[number]
/** A running change of phase. startedAt: performance.now() milliseconds. */
export interface PhaseTransition {
  from: Phase
  to: Phase
  startedAt: number
}
export const PHASE_SECONDS = 2.5
/** The time the wall clock shows in each phase, in minutes after midnight (14:00, 19:30, 23:00). */
export const CLOCK_MINUTES: Record<Phase, number> = { day: 14 * 60, sunset: 19 * 60 + 30, night: 23 * 60 }

const isPhase = (value: string): value is Phase => (PHASES as readonly string[]).includes(value)

/** Local hours: day 07:00-17:59, sunset 18:00-20:59, night 21:00-06:59. */
export function phaseForTime(date: Date): Phase {
  const hour = date.getHours()
  if (hour >= 7 && hour < 18) return 'day'
  if (hour >= 18 && hour < 21) return 'sunset'
  return 'night'
}

/** day -> sunset -> night -> day */
export function nextPhase(phase: Phase): Phase {
  return PHASES[(PHASES.indexOf(phase) + 1) % PHASES.length]
}

/** `?phase=day|sunset|night` (exact lower case), read from a location search string; null for anything else. */
export function parsePhaseParam(search: string): Phase | null {
  const value = new URLSearchParams(search).get('phase')
  return value !== null && isPhase(value) ? value : null
}

/** Linear progress of a transition, 0 at its start, 1 once PHASE_SECONDS have passed. */
export function phaseProgress(startedAt: number, now: number): number {
  return Math.min(1, Math.max(0, (now - startedAt) / (PHASE_SECONDS * 1000)))
}

/** Cubic ease in and out: slow start, slow landing. */
export function easePhase(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
}

/** Clock time during a transition: always forward, through midnight when going from night to day. */
export function clockMinutes(from: Phase, to: Phase, e: number): number {
  const span = (CLOCK_MINUTES[to] - CLOCK_MINUTES[from] + 1440) % 1440
  return (CLOCK_MINUTES[from] + span * e) % 1440
}
```

Run: `npx vitest run src/core/phase.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Écrire le test qui échoue `src/zones/office/lighting/presets.test.ts`**

Les comparaisons de couleurs et de vecteurs se font composante par composante (`toBeCloseTo`) : une interpolation exacte en flottants n'est pas garantie à 1 ulp près.

```ts
import { Color, Vector3 } from 'three'
import { PHASES } from '../../../core/phase'
import { PRESETS, PRESET_KEYS, SUN_TARGET, clonePreset, mixPreset, type Preset } from './presets'

/** Every key of `actual` equals `expected` (colours and vectors component by component, to 1e-9). */
function expectPreset(actual: Preset, expected: Preset) {
  for (const key of PRESET_KEYS) {
    const a = actual[key]
    const e = expected[key]
    const parts = (value: typeof a) =>
      value instanceof Color ? value.toArray() : value instanceof Vector3 ? value.toArray() : [value as number]
    parts(a).forEach((n, i) => expect(n, key).toBeCloseTo(parts(e)[i], 9))
  }
}

test('PRESETS are complete for each phase', () => {
  expect(PRESET_KEYS).toHaveLength(24)
  for (const phase of PHASES) {
    const preset = PRESETS[phase]
    expect(Object.keys(preset).sort(), phase).toEqual([...PRESET_KEYS].sort())
    for (const key of PRESET_KEYS) {
      const value = preset[key]
      const reference = PRESETS.day[key]
      if (reference instanceof Color) expect(value, `${phase}.${key}`).toBeInstanceOf(Color)
      else if (reference instanceof Vector3) expect(value, `${phase}.${key}`).toBeInstanceOf(Vector3)
      else expect(Number.isFinite(value), `${phase}.${key}`).toBe(true)
    }
  }
  expect(SUN_TARGET.toArray()).toEqual([-1, 0, -1.8])
})

test('spec values: environment and exposure per phase', () => {
  expect(PHASES.map((phase) => PRESETS[phase].environment)).toEqual([0.32, 0.18, 0.05])
  expect(PHASES.map((phase) => PRESETS[phase].exposure)).toEqual([1.0, 1.0, 1.15])
})

test('mixPreset returns a at 0 and b at 1', () => {
  expectPreset(mixPreset(PRESETS.day, PRESETS.night, 0), PRESETS.day)
  expectPreset(mixPreset(PRESETS.day, PRESETS.night, 1), PRESETS.night)
  expectPreset(mixPreset(PRESETS.sunset, PRESETS.sunset, 0.4), PRESETS.sunset)
})

test('mixPreset blends colours, vectors and numbers halfway', () => {
  const { day, night } = PRESETS
  const half = mixPreset(day, night, 0.5)
  expect(half.sunIntensity).toBeCloseTo((4.2 + 0.45) / 2)
  expect(half.exposure).toBeCloseTo(1.075)
  half.sunPosition.toArray().forEach((n, i) => expect(n).toBeCloseTo((day.sunPosition.getComponent(i) + night.sunPosition.getComponent(i)) / 2))
  expect(half.sunColor.r).toBeCloseTo((day.sunColor.r + night.sunColor.r) / 2)
  expect(half.sunColor.g).toBeCloseTo((day.sunColor.g + night.sunColor.g) / 2)
  expect(half.skyTop.b).toBeCloseTo((day.skyTop.b + night.skyTop.b) / 2)
})

test('mixPreset writes into out without touching its inputs', () => {
  const day = clonePreset(PRESETS.day)
  const night = clonePreset(PRESETS.night)
  const out = clonePreset(PRESETS.sunset)
  const sunColor = out.sunColor
  expect(mixPreset(PRESETS.day, PRESETS.night, 0.3, out)).toBe(out)
  expect(out.sunColor).toBe(sunColor)
  expectPreset(PRESETS.day, day)
  expectPreset(PRESETS.night, night)
  const fresh = mixPreset(PRESETS.day, PRESETS.night, 0.3)
  expect(fresh.sunColor).not.toBe(PRESETS.day.sunColor)
  expect(fresh.sunPosition).not.toBe(PRESETS.day.sunPosition)
  expectPreset(fresh, out)
})
```

Run: `npx vitest run src/zones/office/lighting/presets.test.ts`
Expected: FAIL — `Failed to resolve import "./presets"`.

- [ ] **Step 4: Créer `src/zones/office/lighting/presets.ts`**

Valeurs de départ (Horn.os `daycycle.js`, recalées sur une salle de 10 × 12 m) ; les couleurs des lumières et du ciel vivent ici (règle des couleurs). La Tâche 7 règle les valeurs sur captures, sauf `environment` et `exposure`, fixées par la spec.

```ts
// Ported from Horn.os (owner's project): js/scene/daycycle.js
import { Color, Vector3 } from 'three'
import type { Phase } from '../../../core/phase'

/** Everything the time of day changes. One mixed Preset drives the lights, the exposure, the sky and the city at once. */
export interface Preset {
  sunColor: Color
  sunIntensity: number
  sunPosition: Vector3
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  environment: number
  windowColor: Color
  windowIntensity: number
  /** 0..1 level of the ceiling-line RectAreaLights and the pendant PointLight (high tier only). */
  ceiling: number
  /** 0..1 level of the emissive pendant bulbs and ceiling strips (x RIG.emissivePeak). */
  bulb: number
  /** Sideboard lamp SpotLight, candela. */
  lampIntensity: number
  /** Logo sign backlight emissive intensity. */
  sign: number
  /** Wall-screen glow PointLight, candela. */
  screenGlow: number
  exposure: number
  skyTop: Color
  skyHorizon: Color
  sunDisc: Color
  sunSize: number
  stars: number
  /** 0..1: city windows, street lamps, car lights. */
  night: number
  cityAmbient: Color
  cloudColor: Color
  cloudOpacity: number
}

export const PRESET_KEYS: readonly (keyof Preset)[] = [
  'sunColor',
  'sunIntensity',
  'sunPosition',
  'hemiSky',
  'hemiGround',
  'hemiIntensity',
  'environment',
  'windowColor',
  'windowIntensity',
  'ceiling',
  'bulb',
  'lampIntensity',
  'sign',
  'screenGlow',
  'exposure',
  'skyTop',
  'skyHorizon',
  'sunDisc',
  'sunSize',
  'stars',
  'night',
  'cityAmbient',
  'cloudColor',
  'cloudOpacity',
]

/** The table centre: the sun (or the moon) aims here, through the glazing. */
export const SUN_TARGET = new Vector3(-1.0, 0, -1.8)

const C = (hex: string) => new Color(hex)
const V = (x: number, y: number, z: number) => new Vector3(x, y, z)

/**
 * Horn.os values, refitted to a 10 x 12 m room whose glazing is the wall x = -5.
 * The sun doubles as the moon at night: cool, faint, still the one shadow caster.
 * environment and exposure are fixed by the spec; the other values are tuned on screenshots (Task 7).
 */
export const PRESETS: Record<Phase, Preset> = {
  day: {
    sunColor: C('#fff0d8'), sunIntensity: 4.2, sunPosition: V(-10.86, 6.13, 1.26),
    hemiSky: C('#dfe9f5'), hemiGround: C('#b89c7c'), hemiIntensity: 0.5,
    environment: 0.32, windowColor: C('#e4eefc'), windowIntensity: 3.2,
    ceiling: 0, bulb: 0, lampIntensity: 0, sign: 0.4, screenGlow: 0.35, exposure: 1.0,
    skyTop: C('#4f8fd6'), skyHorizon: C('#d6e4ee'), sunDisc: C('#fff4de'), sunSize: 1,
    stars: 0, night: 0, cityAmbient: C('#9aa6b4'), cloudColor: C('#ffffff'), cloudOpacity: 0.9,
  },
  sunset: {
    sunColor: C('#ff8a4c'), sunIntensity: 3.6, sunPosition: V(-13.28, 2.42, 4.5),
    hemiSky: C('#f2b894'), hemiGround: C('#6a4a3a'), hemiIntensity: 0.32,
    environment: 0.18, windowColor: C('#ffb07e'), windowIntensity: 1.8,
    ceiling: 0.35, bulb: 0.5, lampIntensity: 1.1, sign: 1.2, screenGlow: 0.7, exposure: 1.0,
    skyTop: C('#3b4c86'), skyHorizon: C('#f6a56a'), sunDisc: C('#ffb870'), sunSize: 2.4,
    stars: 0.15, night: 0.45, cityAmbient: C('#8a6a74'), cloudColor: C('#ffa98a'), cloudOpacity: 0.85,
  },
  night: {
    sunColor: C('#8fa6e8'), sunIntensity: 0.45, sunPosition: V(-10.5, 6.0, -3.5),
    hemiSky: C('#2a3550'), hemiGround: C('#16110d'), hemiIntensity: 0.12,
    environment: 0.05, windowColor: C('#5b6fa8'), windowIntensity: 0.35,
    ceiling: 1, bulb: 1, lampIntensity: 1.8, sign: 2.5, screenGlow: 1.0, exposure: 1.15,
    skyTop: C('#050918'), skyHorizon: C('#1c2748'), sunDisc: C('#c8d4ff'), sunSize: 0.8,
    stars: 1, night: 1, cityAmbient: C('#1a2030'), cloudColor: C('#3a4466'), cloudOpacity: 0.35,
  },
}

type PresetValue = Preset[keyof Preset]

/** A deep copy: its colours and vectors are new objects. */
export function clonePreset(preset: Preset): Preset {
  const copy = { ...preset }
  const values = copy as Record<keyof Preset, PresetValue>
  for (const key of PRESET_KEYS) {
    const value = preset[key]
    if (value instanceof Color || value instanceof Vector3) values[key] = value.clone()
  }
  return copy
}

/**
 * a -> b at t (0..1), key by key: colours and vectors are lerped, numbers too. Writes into `out` (a fresh copy of `a`
 * when omitted) and returns it; never changes `a` or `b`, so `out` must be neither of them.
 */
export function mixPreset(a: Preset, b: Preset, t: number, out: Preset = clonePreset(a)): Preset {
  const values = out as Record<keyof Preset, PresetValue>
  for (const key of PRESET_KEYS) {
    const from = a[key]
    const to = b[key]
    if (from instanceof Color) (values[key] as Color).copy(from).lerp(to as Color, t)
    else if (from instanceof Vector3) (values[key] as Vector3).copy(from).lerp(to as Vector3, t)
    else values[key] = from + ((to as number) - from) * t
  }
  return out
}
```

Run: `npx vitest run src/zones/office/lighting/presets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Étendre `src/core/store.test.ts` (tests qui échouent)**

Remplacer exactement le bloc

```ts
import { PROGRESS_KEY, SETTINGS_KEY } from './progress'
import { createAppStore, type AppState } from './store'
```

par

```ts
import type { Phase } from './phase'
import { PROGRESS_KEY, SETTINGS_KEY } from './progress'
import { createAppStore, type AppState } from './store'
```

Remplacer exactement le bloc

```ts
function setup(options: { reducedMotion?: boolean } = {}) {
  const storage = memoryStorage()
  const store = createAppStore({ getTopic: (_lang, id) => topics[id], storage, reducedMotion: options.reducedMotion })
  return { store, storage, s: () => store.getState() }
}
```

par

```ts
function setup(options: { reducedMotion?: boolean; initialPhase?: Phase; now?: () => number } = {}) {
  const storage = memoryStorage()
  const store = createAppStore({
    getTopic: (_lang, id) => topics[id],
    storage,
    reducedMotion: options.reducedMotion,
    initialPhase: options.initialPhase,
    now: options.now,
  })
  return { store, storage, s: () => store.getState() }
}
```

Ajouter à la fin du fichier :

```ts

describe('time of day', () => {
  /** A store whose transition clock is `time`, moved by hand. */
  function timed(options: { reducedMotion?: boolean; initialPhase?: Phase } = {}) {
    const clock = { time: 1000 }
    return { ...setup({ ...options, now: () => clock.time }), clock }
  }

  it('the initial phase comes from the store deps', () => {
    expect(setup({ initialPhase: 'sunset' }).s()).toMatchObject({ phase: 'sunset', phaseTransition: null, decorReady: false })
    expect(setup().s().phase).toBe('day')
  })

  it('advancePhase starts a 2.5 s transition toward the next phase', () => {
    const { s } = timed()
    s().advancePhase()
    expect(s().phase).toBe('sunset')
    expect(s().phaseTransition).toEqual({ from: 'day', to: 'sunset', startedAt: 1000 })
  })

  // Review focus 1: repeated clicks on the clock or the Time of day button.
  it('advancePhase is ignored while a transition runs', () => {
    const { s, clock } = timed()
    s().advancePhase()
    clock.time = 1200
    s().advancePhase()
    clock.time = 3499
    s().advancePhase()
    expect(s().phase).toBe('sunset')
    expect(s().phaseTransition).toEqual({ from: 'day', to: 'sunset', startedAt: 1000 })
  })

  // Review focus 2: the 3D stopped (reading mode, lost context, another zone) before it could finish the transition.
  it('a stale transition never blocks the next one', () => {
    const { s, clock } = timed()
    s().advancePhase()
    clock.time = 3500
    s().advancePhase()
    expect(s().phase).toBe('night')
    expect(s().phaseTransition).toEqual({ from: 'sunset', to: 'night', startedAt: 3500 })
  })

  // Review focus 2: nothing can animate the change, so it happens at once and never stays "in transition".
  it('advancePhase is instant whenever no 3D can animate it', () => {
    const cases: [string, ReturnType<typeof timed>][] = [
      ['reduced motion', timed({ reducedMotion: true })],
      ['reading mode', timed()],
      ['no WebGL', timed()],
      ['another zone', timed()],
      ['a flight', timed()],
    ]
    cases[1][1].s().setReadingMode(true)
    cases[2][1].s().setWebgl('unavailable')
    cases[3][1].store.setState({ zone: 'workshop' })
    cases[4][1].s().requestZone('workshop', 'laptop')
    for (const [name, { s }] of cases) {
      s().advancePhase()
      expect(s().phase, name).toBe('sunset')
      expect(s().phaseTransition, name).toBeNull()
      s().advancePhase()
      expect(s().phase, name).toBe('night')
    }
  })

  it('finishPhaseTransition and setPhase clear the transition', () => {
    const { store, s } = timed()
    s().advancePhase()
    s().finishPhaseTransition()
    expect(s()).toMatchObject({ phase: 'sunset', phaseTransition: null })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    s().finishPhaseTransition()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    s().advancePhase()
    s().setPhase('day')
    expect(s()).toMatchObject({ phase: 'day', phaseTransition: null })
  })

  it('decorReady is set by setDecorReady', () => {
    const { s } = setup()
    s().setDecorReady(true)
    expect(s().decorReady).toBe(true)
    s().setDecorReady(false)
    expect(s().decorReady).toBe(false)
  })
})
```

Run: `npx vitest run src/core/store.test.ts`
Expected: FAIL — les 7 tests de `time of day` échouent (`s(...).advancePhase is not a function`, `phase` vaut `undefined`) ; les 22 tests existants passent.

- [ ] **Step 6: Modifier `src/core/store.ts`**

Remplacer exactement le bloc

```ts
import * as engine from '../dialogue/engine'
import type { Choice, DialogueState } from '../dialogue/engine'
```

par

```ts
import * as engine from '../dialogue/engine'
import type { Choice, DialogueState } from '../dialogue/engine'
import { PHASE_SECONDS, nextPhase, parsePhaseParam, phaseForTime, type Phase, type PhaseTransition } from './phase'
```

Remplacer exactement le bloc

```ts
  hovered: HoverTarget | null
  adaPokes: number
  expandOpen: boolean
```

par

```ts
  hovered: HoverTarget | null
  adaPokes: number
  expandOpen: boolean
  /** Time of day of the office. */
  phase: Phase
  /** The change of phase the 3D scene is animating, or null. */
  phaseTransition: PhaseTransition | null
  /** The decor stage (plants, books, frames, pendants) has loaded, or given up on what failed. */
  decorReady: boolean
```

Remplacer exactement le bloc

```ts
  setExpandOpen: (open: boolean) => void
}
```

par

```ts
  setExpandOpen: (open: boolean) => void
  /** Next phase: animated over PHASE_SECONDS when the 3D office can show it, instant otherwise; ignored mid-transition. */
  advancePhase: () => void
  /** Instant change, without a transition. */
  setPhase: (phase: Phase) => void
  finishPhaseTransition: () => void
  setDecorReady: (ready: boolean) => void
}
```

Remplacer exactement le bloc

```ts
  storage?: StorageLike | null
  reducedMotion?: boolean
}
```

par

```ts
  storage?: StorageLike | null
  reducedMotion?: boolean
  /** Default 'day'. */
  initialPhase?: Phase
  /** Clock of the phase transitions, in milliseconds. Default performance.now(). */
  now?: () => number
}
```

Remplacer exactement la ligne

```ts
  const { getTopic, storage } = deps
```

par

```ts
  const { getTopic, storage } = deps
  const clock = deps.now ?? (() => performance.now())
```

Remplacer exactement le bloc

```ts
      adaPokes: 0,
      expandOpen: false,
```

par

```ts
      adaPokes: 0,
      expandOpen: false,
      phase: deps.initialPhase ?? 'day',
      phaseTransition: null,
      decorReady: false,
```

Remplacer exactement le bloc (fin de l'objet d'état)

```ts
      setExpandOpen: (open) => set({ expandOpen: open }),
    }
```

par (règle exacte de `advancePhase`)

```ts
      setExpandOpen: (open) => set({ expandOpen: open }),
      advancePhase: () => {
        const s = get()
        const now = clock()
        // A transition older than its duration no longer blocks (3D stopped before it could finish it).
        if (s.phaseTransition && now - s.phaseTransition.startedAt < PHASE_SECONDS * 1000) return
        const to = nextPhase(s.phase)
        const animate = !s.reducedMotion && !s.readingMode && s.webgl === 'ok' && s.zone === 'office' && s.transition === null
        set({ phase: to, phaseTransition: animate ? { from: s.phase, to, startedAt: now } : null })
      },
      setPhase: (phase) => set({ phase, phaseTransition: null }),
      finishPhaseTransition: () => {
        if (get().phaseTransition) set({ phaseTransition: null })
      },
      setDecorReady: (ready) => set({ decorReady: ready }),
    }
```

Remplacer exactement le bloc

```ts
export const appStore = createAppStore({
  getTopic: (lang, id) => getContent(lang).topicById.get(id),
  reducedMotion: prefersReducedMotion(),
})
```

par

```ts
/** `?phase=` wins (read once, never written back to the address); otherwise the local time chooses. */
function initialPhase(): Phase {
  try {
    return parsePhaseParam(window.location.search) ?? phaseForTime(new Date())
  } catch {
    return 'day'
  }
}

export const appStore = createAppStore({
  getTopic: (lang, id) => getContent(lang).topicById.get(id),
  reducedMotion: prefersReducedMotion(),
  initialPhase: initialPhase(),
})
```

Run: `npx vitest run src/core/store.test.ts`
Expected: PASS (29 tests).

- [ ] **Step 7: Épingler `?phase=` dans le routeur et étendre l'API de test (tests)**

Le routeur ne change pas : il ne remplace que le hash, la requête reste dans l'adresse. Ce test l'épingle (il passe dès son écriture) ; il remet l'adresse à `/` même en cas d'échec, pour ne pas polluer les autres tests. Dans `src/core/router.test.ts`, remplacer exactement la ligne

```ts
  it('pushes a history entry once the zone has changed', () => {
```

par

```ts
  // Review focus 4: `?phase=` is read once at start-up and must survive every hash change.
  it('the router keeps ?phase in the address', () => {
    window.history.replaceState(null, '', '/?phase=night#/office')
    try {
      const store = newStore()
      stop = startRouter(store)
      expect(window.location.search).toBe('?phase=night')
      store.getState().requestZone('workshop', 'laptop')
      store.getState().transitionStep()
      store.getState().transitionStep()
      expect(window.location.hash).toBe('#/workshop')
      window.history.replaceState(null, '', '#/office')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      store.getState().transitionStep()
      expect(store.getState().zone).toBe('office')
      expect(window.location.hash).toBe('#/office')
      expect(window.location.search).toBe('?phase=night')
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('pushes a history entry once the zone has changed', () => {
```

Ajouter à la fin de `src/app/testApi.test.ts` :

```ts

test('setPhase changes the phase at once', () => {
  resetAppStore({ phase: 'day', phaseTransition: { from: 'night', to: 'day', startedAt: 0 } })
  installTestApi(appStore)
  window.__academy?.setPhase('night')
  expect(appStore.getState()).toMatchObject({ phase: 'night', phaseTransition: null })
  expect(window.__academy?.state().phase).toBe('night')
})

test('rail moves the camera target', () => {
  installTestApi(appStore)
  window.__academy?.rail(0.5)
  expect(appStore.getState().railTarget).toBe(0.5)
  window.__academy?.rail(3)
  expect(appStore.getState().railTarget).toBe(1)
})
```

Run: `npx vitest run src/core/router.test.ts src/app/testApi.test.ts`
Expected: `router.test.ts` PASS (22 tests, dont « the router keeps ?phase in the address ») ; `testApi.test.ts` FAIL sur les deux nouveaux tests (`window.__academy?.setPhase is not a function`, puis `rail is not a function`).

- [ ] **Step 8: Réécrire `src/app/testApi.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { Phase } from '../core/phase'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Sets the time of day at once, without a transition. */
  setPhase: (phase: Phase) => void
  /** Moves the camera rail target: 0 is the overview, 1 the presentation view. */
  rail: (t: number) => void
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
  win.__academy = {
    state: () => store.getState(),
    clickObject: (target) => objectActions[target](),
    setPhase: (phase) => store.getState().setPhase(phase),
    rail: (t) => store.getState().setRailTarget(t),
  }
}
```

Run: `npx vitest run src/core src/app/testApi.test.ts src/zones/office/lighting`
Expected: PASS ; sortie sans avertissement.

- [ ] **Step 9: Créer `scripts/shots.mjs` et le script npm**

Captures de revue et de preuve, en Chromium avec interface et vrai GPU (ANGLE sur Direct3D 11), sur le serveur de développement du port 5199 (celui de Playwright) : le script en lance un si rien ne répond et l'arrête à la fin (sous Windows, `taskkill /T` arrête aussi le processus Vite lancé par `npm`). Les vues s'enchaînent par l'API de test : `rail(0)` pour la vue d'ensemble, `rail(1)` pour la vue présentation, `clickObject('tv')` pour le vol vers la télé (la page est rechargée ensuite si d'autres vues suivent).

```js
// Review and evidence screenshots of the office, rendered by Chromium on the real GPU (ANGLE on Direct3D 11).
// Usage: node scripts/shots.mjs --out <dir> [--phases day,sunset,night] [--views overview,presentation,tv] [--prefix <text>] [--wait-decor]
// Uses the dev server on http://localhost:5199 (the Playwright port), starting one when nothing answers there.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5199'
const PHASES = ['day', 'sunset', 'night']
const VIEWS = ['overview', 'presentation', 'tv']
const READY_MS = 60_000

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    phases: { type: 'string', default: 'day' },
    views: { type: 'string', default: 'overview,presentation' },
    prefix: { type: 'string', default: '' },
    'wait-decor': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
})
const usage = 'Usage: node scripts/shots.mjs --out <dir> [--phases day,sunset,night] [--views overview,presentation,tv] [--prefix <text>] [--wait-decor]'
if (values.help) {
  console.log(usage)
  process.exit(0)
}
const list = (text, allowed, what) => {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean)
  const wrong = items.filter((item) => !allowed.includes(item))
  if (items.length === 0 || wrong.length > 0) {
    console.error(`Unknown ${what}: ${wrong.join(', ') || '(none given)'}. Choose among ${allowed.join(', ')}.`)
    process.exit(1)
  }
  return items
}
if (!values.out) {
  console.error(usage)
  process.exit(1)
}
const phases = list(values.phases, PHASES, 'phase')
const views = list(values.views, VIEWS, 'view')

async function serverAnswers() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

/** Starts `npm run dev` on the Playwright port and waits for it; returns the child process. */
async function startServer() {
  // One command string with shell: true runs npm.cmd on Windows (Node refuses to spawn .cmd files without a shell).
  const child = spawn('npm run dev -- --port 5199 --strictPort', { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
  const deadline = Date.now() + READY_MS
  while (Date.now() < deadline) {
    if (await serverAnswers()) return child
    await sleep(500)
  }
  stopServer(child)
  throw new Error(`the dev server did not answer on ${BASE} within ${READY_MS / 1000} s`)
}

function stopServer(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM')
}

async function openOffice(page, phase) {
  await page.goto('about:blank')
  await page.goto(`${BASE}/?phase=${phase}#/office`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
  if (values['wait-decor']) {
    try {
      await page.waitForFunction(() => window.__academy?.state().decorReady === true, undefined, { timeout: READY_MS })
    } catch {
      console.warn(`warning: ${phase}: the decor was not ready after ${READY_MS / 1000} s, shooting anyway`)
    }
  }
  await sleep(1500)
}

async function shoot(page, name) {
  const path = join(values.out, `${values.prefix}${name}.png`)
  await page.screenshot({ path })
  console.log(`saved ${path}`)
}

let server = null
let browser = null
try {
  mkdirSync(values.out, { recursive: true })
  if (!(await serverAnswers())) server = await startServer()
  browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  for (const phase of phases) {
    await openOffice(page, phase)
    for (const view of views) {
      if (view === 'overview') {
        await page.evaluate(() => window.__academy.rail(0))
        await sleep(2000)
        await shoot(page, `${phase}-overview`)
      } else if (view === 'presentation') {
        await page.evaluate(() => window.__academy.rail(1))
        await sleep(2500)
        await shoot(page, `${phase}-presentation`)
      } else {
        await page.evaluate(() => window.__academy.clickObject('tv'))
        await sleep(1100)
        await shoot(page, `${phase}-tv`)
        // The flight ends in another zone: reload the office when more views follow.
        if (view !== views.at(-1)) await openOffice(page, phase)
      }
    }
  }
} catch (error) {
  console.error(`shots failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  if (server) stopServer(server)
}
```

Dans `package.json`, remplacer exactement le bloc (état laissé par la Tâche 1)

```json
    "assets:build": "node --disable-warning=ExperimentalWarning scripts/assets/build.mjs"
  },
```

par

```json
    "assets:build": "node --disable-warning=ExperimentalWarning scripts/assets/build.mjs",
    "shots": "node scripts/shots.mjs"
  },
```

Run: `node scripts/shots.mjs --phases dawn --out .superpowers/review-shots/task-3`
Expected: `Unknown phase: dawn. Choose among day, sunset, night.`, code de sortie 1, aucun navigateur ouvert.

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-3`
Expected: une fenêtre Chromium s'ouvre et se ferme ; le script affiche `saved .superpowers\review-shots\task-3\day-overview.png` puis `saved .superpowers\review-shots\task-3\day-presentation.png` (séparateurs `\` sous Windows) ; code de sortie 0. Les deux PNG montrent le bureau actuel (inchangé à ce stade) en 1600 × 900, en vue d'ensemble puis en vue présentation. Ils ne sont pas commités (`.superpowers/` est ignoré par git).

- [ ] **Step 10: Vérifier et commiter**

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » quasi inchangé (seul `src/core/phase.ts` entre dans le chunk initial ; `presets.ts` n'est encore importé par aucun composant) ; `No test API (__academy) in the production JS`.

```bash
git add src/core/phase.ts src/core/phase.test.ts src/zones/office/lighting src/core/store.ts src/core/store.test.ts src/core/router.test.ts src/app/testApi.ts src/app/testApi.test.ts scripts/shots.mjs package.json
git commit -m "feat: time of day phases, presets from Horn.os, phase state, test API and review screenshots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Kit de matériaux PBR et audit

**Files:**
- Create: `src/three/uv.ts`, `src/three/merge.ts`, `src/three/tints.ts`, `src/three/noise.ts`, `src/three/audit.ts`, `src/three/textures.ts`
- Modify: `src/three/materials.ts` (réécriture : nouvelle fabrique PBR en tête ; l'ancienne fonction `materials()` et son code restent en fin de fichier, marqués `@deprecated`)
- Test: `src/three/uv.test.ts`, `src/three/merge.test.ts`, `src/three/noise.test.ts`, `src/three/audit.test.ts`, `src/three/textures.test.ts`, `src/three/materials.test.ts`

**Interfaces:**
- Consumes (Tâche 2, `src/three/assets.ts`) : `TEXTURE_SETS`, `TEXTURE_SET_IDS`, `TextureSetId`, `textureUrl(set, map)` ; (Tâche 1, `src/assets/paths.ts`) : `TEXTURE_MAPS`, `TextureMap` ; `brand` (`src/core/brand.ts`).
- Produces (`src/three/textures.ts`) : `MAX_ANISOTROPY = 8`, `interface PbrTextures { color: Texture; normal: Texture; arm: Texture }`, `type TextureSets = Record<TextureSetId, PbrTextures>`, `textureSetUrls(): string[]`, `configureTexture(texture: Texture, map: TextureMap, tileMetres: number, anisotropy: number): Texture`, `useTextureSets(): TextureSets` (même objet pour tous les composants).
- Produces (`src/three/uv.ts`) : `metreUVs<T extends BufferGeometry>(geometry: T, options?: { offset?: [number, number]; swap?: boolean }): T`.
- Produces (`src/three/noise.ts`) : `NoiseOptions`, `noiseTexture(options?: NoiseOptions): DataTexture`, `SpeckleOptions`, `speckleTexture(options: SpeckleOptions): DataTexture` (défaut `repeat` [3, 1], comme Horn.os).
- Produces (`src/three/merge.ts`) : `interface Part { geometry: BufferGeometry; matrix?: Matrix4; colour?: Color }`, `mergeParts(parts: readonly Part[], options?: { colours?: boolean }): BufferGeometry`, `at(x, y, z, rotation?: [number, number, number], scale?: number): Matrix4`.
- Produces (`src/three/tints.ts`) : `tints` (clés exactes du Step 6, `as const`).
- Produces (`src/three/audit.ts`) : `EXEMPTIONS`, `Exemption`, `markExempt<T extends { userData: Record<string, unknown> }>(target: T, reason: Exemption): T`, `isTextured(material: Material): boolean`, `untexturedMeshes(root: Object3D): string[]` (entrées `chemin#matériau`).
- Produces (`src/three/materials.ts`) : `ENV_MAP_INTENSITY = { surface: 1, model: 0.8, plant: 0.45 }`, `pbrMaterial(textures, { name, tint, metal, roughness?, envMapIntensity? }): MeshStandardMaterial`, `buildMaterials(sets: TextureSets)` (26 clés), `type Materials`, `type MaterialKey`, `useMaterials(): Materials`. Restent, dépréciés jusqu'à la Tâche 11 : `materials(): LegacyMaterials` et `type LegacyMaterials` (l'ancien type `Materials` est renommé, son nom servant désormais à la fabrique ; aucun fichier n'importait ce type). Tout le code ancien est regroupé sous la bannière « Flat materials of the first office » en fin de fichier : la Tâche 11 supprime cette section entière et les imports `CanvasTexture`, `Color`, `MeshBasicMaterial`, `SRGBColorSpace` qui ne servaient qu'à elle.

Aucun composant ne change dans cette tâche : rien n'importe encore la fabrique, le bureau s'affiche comme avant. Les tests de `src/three/**` n'écrivent aucun littéral de couleur hexadécimal (ils lisent `tints` et `brand`), pour rester dans la règle que vérifiera `src/three/colours.test.ts` (Tâche 15).

- [ ] **Step 1: Écrire le test qui échoue `src/three/uv.test.ts`**

```ts
import { BoxGeometry, PlaneGeometry } from 'three'
import { metreUVs } from './uv'

/** Range of u and v over the vertices whose normal points along `axis` (0 x, 1 y, 2 z). */
function faceExtent(geometry: BoxGeometry, axis: number): [number, number] {
  const normal = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  const us: number[] = []
  const vs: number[] = []
  for (let i = 0; i < normal.count; i++) {
    if (Math.abs([normal.getX(i), normal.getY(i), normal.getZ(i)][axis]) < 0.5) continue
    us.push(uv.getX(i))
    vs.push(uv.getY(i))
  }
  return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)]
}

test('box faces get UVs in metres', () => {
  const box = new BoxGeometry(2, 1, 0.5)
  expect(metreUVs(box)).toBe(box)
  const [x, y, z] = [0, 1, 2].map((axis) => faceExtent(box, axis))
  // x faces: u along z, v along y; y faces: u along x, v along z; z faces: u along x, v along y.
  expect(x[0]).toBeCloseTo(0.5)
  expect(x[1]).toBeCloseTo(1)
  expect(y[0]).toBeCloseTo(2)
  expect(y[1]).toBeCloseTo(0.5)
  expect(z[0]).toBeCloseTo(2)
  expect(z[1]).toBeCloseTo(1)
})

test('offset and swap move and turn the UVs', () => {
  // A 2 x 1 m plane facing +z: u = x, v = y.
  const plain = metreUVs(new PlaneGeometry(2, 1)).getAttribute('uv')
  const moved = metreUVs(new PlaneGeometry(2, 1), { offset: [0.25, 0.5] }).getAttribute('uv')
  const turned = metreUVs(new PlaneGeometry(2, 1), { swap: true }).getAttribute('uv')
  const positions = new PlaneGeometry(2, 1).getAttribute('position')
  for (let i = 0; i < plain.count; i++) {
    expect(plain.getX(i)).toBeCloseTo(positions.getX(i))
    expect(plain.getY(i)).toBeCloseTo(positions.getY(i))
    expect(moved.getX(i)).toBeCloseTo(positions.getX(i) + 0.25)
    expect(moved.getY(i)).toBeCloseTo(positions.getY(i) + 0.5)
    expect(turned.getX(i)).toBeCloseTo(positions.getY(i))
    expect(turned.getY(i)).toBeCloseTo(positions.getX(i))
  }
})
```

Run: `npx vitest run src/three/uv.test.ts`
Expected: FAIL — `Failed to resolve import "./uv"`.

- [ ] **Step 2: Créer `src/three/uv.ts`**

Projection de boîte de Horn.os (`boxProjectUVs`) à l'échelle 1 : un mètre de géométrie vaut une unité d'UV, et chaque matériau répète sa texture tous les `tileMetres` (réglé par `configureTexture`). Contrairement à Horn, la fonction réécrit un attribut `uv` déjà présent.

```ts
// Ported from Horn.os (owner's project): js/lib/shapes.js (boxProjectUVs)
import { BufferAttribute, type BufferGeometry } from 'three'

/**
 * UVs in metres by box projection: each vertex takes the two axes its normal is least aligned with, so a face never
 * samples the texture edge-on, and one UV unit is one metre (textures repeat per TEXTURE_SETS[...].tileMetres).
 * `offset` shifts the result (to break repeats between neighbours), `swap` turns it a quarter (wood grain direction).
 * Rewrites the `uv` attribute and returns the same geometry.
 */
export function metreUVs<T extends BufferGeometry>(geometry: T, options: { offset?: [number, number]; swap?: boolean } = {}): T {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  if (!position || !normal) throw new Error('metreUVs needs a geometry with positions and normals')
  const [du, dv] = options.offset ?? [0, 0]
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    let u: number
    let v: number
    if (nx >= ny && nx >= nz) {
      u = position.getZ(i)
      v = position.getY(i)
    } else if (ny >= nz) {
      u = position.getX(i)
      v = position.getZ(i)
    } else {
      u = position.getX(i)
      v = position.getY(i)
    }
    if (options.swap) [u, v] = [v, u]
    uv[i * 2] = u + du
    uv[i * 2 + 1] = v + dv
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  return geometry
}
```

Run: `npx vitest run src/three/uv.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Écrire le test qui échoue `src/three/merge.test.ts`**

```ts
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Matrix4 } from 'three'
import { at, mergeParts } from './merge'

test('mergeParts joins indexed and non-indexed parts', () => {
  const indexed = new BoxGeometry(1, 1, 1)
  const flat = new BoxGeometry(1, 1, 1).toNonIndexed()
  expect(indexed.index).not.toBeNull()
  const merged = mergeParts([{ geometry: indexed }, { geometry: flat, matrix: at(2, 0, 0) }])
  expect(merged.index).toBeNull()
  expect(merged.getAttribute('position').count).toBe(72)
})

test('mergeParts keeps only position, normal and uv', () => {
  const box = new BoxGeometry(1, 1, 1)
  box.setAttribute('color', new BufferAttribute(new Float32Array(box.getAttribute('position').count * 3), 3))
  box.setAttribute('uv1', box.getAttribute('uv').clone())
  // A triangle with neither normals nor UVs: they are added (computed normals, zero UVs).
  const bare = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  const merged = mergeParts([{ geometry: box }, { geometry: bare }])
  expect(Object.keys(merged.attributes).sort()).toEqual(['normal', 'position', 'uv'])
  const uv = merged.getAttribute('uv')
  expect([uv.getX(uv.count - 1), uv.getY(uv.count - 1)]).toEqual([0, 0])
  const normal = merged.getAttribute('normal')
  expect(normal.getZ(normal.count - 1)).toBeCloseTo(1)
})

test('mergeParts bakes one colour per part when asked', () => {
  const red = new Color(1, 0, 0)
  const merged = mergeParts(
    [{ geometry: new BoxGeometry(), colour: red }, { geometry: new BoxGeometry() }],
    { colours: true },
  )
  const colour = merged.getAttribute('color')
  expect(colour.count).toBe(72)
  expect([colour.getX(0), colour.getY(0), colour.getZ(0)]).toEqual([1, 0, 0])
  expect([colour.getX(35), colour.getY(35), colour.getZ(35)]).toEqual([1, 0, 0])
  expect([colour.getX(36), colour.getY(36), colour.getZ(36)]).toEqual([1, 1, 1])
  expect(mergeParts([{ geometry: new BoxGeometry(), colour: red }]).hasAttribute('color')).toBe(false)
})

test('mergeParts leaves its inputs untouched', () => {
  const box = new BoxGeometry(1, 1, 1)
  const before = Array.from(box.getAttribute('position').array)
  const merged = mergeParts([{ geometry: box, matrix: at(1, 2, 3, [0, Math.PI / 2, 0], 2) }])
  expect(Array.from(box.getAttribute('position').array)).toEqual(before)
  expect(box.index).not.toBeNull()
  merged.computeBoundingBox()
  const corners = [...merged.boundingBox!.min.toArray(), ...merged.boundingBox!.max.toArray()]
  corners.forEach((n, i) => expect(n).toBeCloseTo([0, 1, 2, 2, 3, 4][i]))
  expect(at(1, 2, 3).equals(new Matrix4().makeTranslation(1, 2, 3))).toBe(true)
})
```

Run: `npx vitest run src/three/merge.test.ts`
Expected: FAIL — `Failed to resolve import "./merge"`.

- [ ] **Step 4: Créer `src/three/merge.ts`**

```ts
// Ported from Horn.os (owner's project): js/lib/merge.js
import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/*
 * Merging small static pieces into single meshes. A shelf of books built as seventy meshes is seventy draw calls and
 * seventy entries in the shadow pass; baked into one geometry it is one of each, and the pieces keep their own colours
 * through a vertex-colour attribute. Only merge pieces that never move relative to each other.
 */

const KEEP = ['position', 'normal', 'uv']

export interface Part {
  geometry: BufferGeometry
  matrix?: Matrix4
  colour?: Color
}

/**
 * Bakes parts into one non-indexed BufferGeometry with position, normal and uv (zero UVs where a part has none),
 * each part moved by its matrix; with `colours`, a 'color' attribute holds each part's colour (white by default).
 * Inputs are cloned, never touched: several of them come from shared caches.
 */
export function mergeParts(parts: readonly Part[], options: { colours?: boolean } = {}): BufferGeometry {
  const white = new Color(1, 1, 1)
  const prepared = parts.map(({ geometry, matrix, colour }) => {
    // mergeGeometries refuses a mix of indexed and non-indexed inputs: going non-indexed everywhere always works.
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name)
    g.morphAttributes = {}
    const count = g.getAttribute('position').count
    if (!g.hasAttribute('uv')) g.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
    if (!g.hasAttribute('normal')) g.computeVertexNormals()
    if (matrix) g.applyMatrix4(matrix)
    if (options.colours) {
      const c = colour ?? white
      const values = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) values.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('color', new BufferAttribute(values, 3))
    }
    return g
  })
  const merged = mergeGeometries(prepared, false)
  for (const g of prepared) g.dispose()
  if (!merged) throw new Error('mergeParts: the parts could not be merged')
  return merged
}

/** The transform of one part, as a matrix: position, Euler rotation (radians) and uniform scale. */
export function at(x: number, y: number, z: number, rotation: [number, number, number] = [0, 0, 0], scale = 1): Matrix4 {
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromEuler(new Euler(rotation[0], rotation[1], rotation[2])),
    new Vector3(scale, scale, scale),
  )
}
```

Run: `npx vitest run src/three/merge.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Écrire le test qui échoue `src/three/noise.test.ts`**

```ts
import { Color, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'
import { noiseTexture, speckleTexture } from './noise'
import { tints } from './tints'

const pixels = (texture: { image: { data: unknown } }) => texture.image.data as Uint8Array

test('noise is the same for the same seed', () => {
  const a = noiseTexture({ size: 32, seed: 4 })
  expect(noiseTexture({ size: 32, seed: 4 })).toBe(a)
  const b = noiseTexture({ size: 32, seed: 4, repeat: 2 })
  expect(b).not.toBe(a)
  expect(pixels(b)).toEqual(pixels(a))
  expect(b.repeat.toArray()).toEqual([2, 2])
  expect(pixels(noiseTexture({ size: 32, seed: 5 }))).not.toEqual(pixels(a))
  const plain = noiseTexture()
  expect(plain.image.width).toBe(64)
  expect(plain.colorSpace).toBe(NoColorSpace)
  expect(plain.wrapS).toBe(RepeatWrapping)
  expect(plain.generateMipmaps).toBe(true)
  expect(plain.minFilter).toBe(LinearMipmapLinearFilter)
  expect(noiseTexture({ srgb: true }).colorSpace).toBe(SRGBColorSpace)
})

test('noise stays within its range', () => {
  const data = pixels(noiseTexture({ size: 32, min: 0.8, max: 0.9, seed: 7 }))
  const values: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    expect(data[i + 1]).toBe(data[i])
    expect(data[i + 2]).toBe(data[i])
    expect(data[i + 3]).toBe(255)
    values.push(data[i])
  }
  expect(Math.min(...values)).toBeGreaterThanOrEqual(Math.round(0.8 * 255))
  expect(Math.max(...values)).toBeLessThanOrEqual(Math.round(0.9 * 255))
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(5)
})

test('speckle starts from its base colour and repeats', () => {
  const options = { base: tints.potGlazes.terracotta, dots: tints.potDots.terracotta, seed: 5, size: 64, count: 200 }
  const texture = speckleTexture(options)
  expect(speckleTexture({ ...options })).toBe(texture)
  const data = pixels(texture)
  const hex = new Color(tints.potGlazes.terracotta).getHex()
  const base = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
  let plain = 0
  for (let i = 0; i < data.length; i += 4) if (data[i] === base[0] && data[i + 1] === base[1] && data[i + 2] === base[2]) plain++
  const total = data.length / 4
  expect(plain / total).toBeGreaterThan(0.6)
  expect(plain).toBeLessThan(total)
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect(texture.wrapS).toBe(RepeatWrapping)
  expect(texture.wrapT).toBe(RepeatWrapping)
  expect(texture.repeat.toArray()).toEqual([3, 1])
  expect(speckleTexture({ ...options, repeat: [2, 1] }).repeat.toArray()).toEqual([2, 1])
})
```

Run: `npx vitest run src/three/noise.test.ts`
Expected: FAIL — `Failed to resolve import "./noise"`.

- [ ] **Step 6: Créer `src/three/tints.ts` et `src/three/noise.ts`**

`src/three/tints.ts` (clés et valeurs de départ exactes ; les valeurs se règlent sur captures, les clés ne se renomment jamais) :

```ts
import { brand } from '../core/brand'

/** Material tints that are not brand colours. Brand colours come from core/brand.ts only. */
export const tints = {
  floor: '#c8a27a', wall: '#b9ad9c', ceiling: '#e6e0d6', skirting: '#8f8577', slats: '#c99a68', oak: '#d2a878', walnut: '#a8774f',
  chairFabric: '#7d7368', sofaFabric: brand.blueGrey, cushion: brand.lime, rug: '#b8aa96',
  blackMetal: '#2a2b2d', brushedMetal: '#b9bcc0', consoleShell: '#c9c6bd', consoleDark: '#3a3d40',
  porcelain: brand.onDark, visor: brand.nearBlack, glass: '#dfe8ee', warmLight: '#ffd29a', posterPaper: '#f1ece2',
  leafGreens: ['#30552c', '#3b6136', '#274525', '#446d3b', '#213d21', '#365730'], stem: '#4a6b3a', soil: '#241c15',
  potGlazes: { terracotta: '#a5613f', cream: '#d8cdb8', slate: '#555b5e', brass: '#8a6a34' },
  potDots: { terracotta: ['#7a3a1f', '#d88a5f', '#5a2a14'], cream: ['#8a857a', '#b8b2a6', '#5c574f'], slate: ['#2a2b2d', '#6d7275', '#3f4447'], brass: ['#5e4520', '#b08a4a', '#3d2c12'] },
  hangingGlazes: { white: '#ece8df', terracotta: '#b8663f', sage: '#8fa38c', charcoal: '#3a3b3d' },
  cord: '#dccdb0',
  bookCovers: ['#1f3b57', '#6b1f1f', '#2f4f3a', '#c9962b', '#ece6d8', '#2b2b2d', '#1f5e63', '#b4552d', '#d8cbb0', '#4f5d6b', '#d9b44a', '#c98f8f', '#f5f2ea', '#394a2c', '#7d3c5a', '#223a70', '#e24a2f', '#0f0f10', '#6d8a9c', '#a7b59a', '#5a3a22', '#8c1c1c', '#e9e2cf'],
  bookInks: ['#e8d9b0', '#e2c27a', '#e6d49c', '#1f1f1f', '#2a2a2a', '#d9c089', '#f1ead8', '#f6eee0', '#3a2f24', '#f0ebe0', '#2a2419', '#2e2020', '#b3462d', '#e3cf8e', '#f3e7ef', '#f2c14e', '#ffffff', '#15212a', '#2c3526', '#e8c98a', '#f0d9a0', '#1d3b5a'],
  bookPages: ['#efe6d2', '#e4d8bd', '#d8c9a8'],
  city: {
    brick: ['#9a5a44', '#8a4e3a', '#a8664c', '#7e4a3a', '#c9a36a', '#94604a'],
    glass: ['#3a4550', '#2e3a44', '#55606a', '#44505a'],
    concrete: ['#b8b4ac', '#a9a59e', '#c6c1b8', '#9d9a94'],
    plaster: ['#e8e0d0', '#f0ead8', '#d9cdb5', '#e6d6c0', '#d8dcd6'],
    roofUnit: '#9a9da0', waterTank: '#6d5a48', grass: '#6a8a4a', paving: '#8f8a82', asphalt: '#3a3c3f', gravel: '#c2b59c',
    trunk: '#5a4a3c', kerb: '#b8b3aa', hedge: '#3f5f32', laneMark: '#dedbd2', lampPole: '#2a2c2e', lampGlow: '#ffc47a',
    carBodies: ['#2c3e50', '#c0392b', '#ecf0f1', '#7f8c8d', '#1e1e1e', '#2e86c1', '#d4ac0d'], carCabin: '#1c2228',
    headlight: '#fff4dc', taillight: '#ff2a1a', bird: '#2a2c30',
  },
} as const
```

`src/three/noise.ts` — textures calculées en mémoire (`DataTexture`, aucun canvas : elles marchent aussi dans jsdom), avec le générateur LCG de Horn (`s = s * 1664525 + 1013904223`) ; le bruit est une somme de trois octaves de bruit de valeur bouclé (raccord parfait en répétition) ; la moucheture reprend `speckle()` de Horn (même tirage, même ordre : couleur, opacité, taille, x, y), en points de 1 à 2 px qui bouclent sur les bords.

```ts
// Ported from Horn.os (owner's project): js/scene/models.js (speckle), drawn into a DataTexture instead of a canvas
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'

/*
 * Small procedural textures computed in memory (no canvas, so they also work in the unit tests): a grey value noise
 * that breaks up flat colours and roughness, and Horn.os' glaze speckle for pots. Both are cached and never disposed.
 */

export interface NoiseOptions {
  size?: number
  min?: number
  max?: number
  seed?: number
  repeat?: number
  srgb?: boolean
}
export interface SpeckleOptions {
  base: string
  dots: readonly string[]
  seed: number
  size?: number
  count?: number
  repeat?: [number, number]
}

/** Horn.os' LCG: the same seed gives the same texture on every run. Returns numbers in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function dataTexture(data: Uint8Array, size: number, repeat: [number, number], srgb: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  texture.needsUpdate = true
  return texture
}

/** Three octaves of tileable value noise (lattices of 4, 8 and 16 cells across the texture), in [0, 1). */
const OCTAVES = [
  { cells: 4, weight: 0.5 },
  { cells: 8, weight: 0.3 },
  { cells: 16, weight: 0.2 },
] as const
const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function valueNoise(size: number, seed: number): Float32Array {
  const random = lcg(seed)
  const out = new Float32Array(size * size)
  for (const { cells, weight } of OCTAVES) {
    const lattice = new Float32Array(cells * cells)
    for (let i = 0; i < lattice.length; i++) lattice[i] = random()
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells
      const y0 = Math.floor(fy)
      const y1 = (y0 + 1) % cells
      const ty = smooth(fy - y0)
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells
        const x0 = Math.floor(fx)
        const x1 = (x0 + 1) % cells
        const tx = smooth(fx - x0)
        const top = lerp(lattice[y0 * cells + x0], lattice[y0 * cells + x1], tx)
        const bottom = lerp(lattice[y1 * cells + x0], lattice[y1 * cells + x1], tx)
        out[y * size + x] += weight * lerp(top, bottom, ty)
      }
    }
  }
  return out
}

const noiseCache = new Map<string, DataTexture>()

/** Grey value noise between `min` and `max` (0..1), RGBA8, tileable, with mipmaps. Defaults: 64 px, 0.85..1, seed 1, repeat 1, linear. */
export function noiseTexture(options: NoiseOptions = {}): DataTexture {
  const { size = 64, min = 0.85, max = 1, seed = 1, repeat = 1, srgb = false } = options
  const key = JSON.stringify([size, min, max, seed, repeat, srgb])
  const cached = noiseCache.get(key)
  if (cached) return cached
  const noise = valueNoise(size, seed)
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < noise.length; i++) {
    const value = Math.round((min + (max - min) * noise[i]) * 255)
    data[i * 4] = value
    data[i * 4 + 1] = value
    data[i * 4 + 2] = value
    data[i * 4 + 3] = 255
  }
  const texture = dataTexture(data, size, [repeat, repeat], srgb)
  noiseCache.set(key, texture)
  return texture
}

/** sRGB bytes of a CSS colour. */
function bytes(colour: string): [number, number, number] {
  const hex = new Color(colour).getHex()
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
}

const speckleCache = new Map<string, DataTexture>()

/**
 * A glaze: the base colour with `count` small translucent dots of the `dots` colours (Horn.os speckle: same LCG,
 * same draw order, dots of 1 to 2 px that wrap around the edges). sRGB. Defaults: 256 px, 1200 dots, repeat 3 x 1.
 */
export function speckleTexture(options: SpeckleOptions): DataTexture {
  const { base, dots, seed, size = 256, count = 1200, repeat = [3, 1] } = options
  const key = JSON.stringify([base, dots, seed, size, count, repeat])
  const cached = speckleCache.get(key)
  if (cached) return cached
  const data = new Uint8Array(size * size * 4)
  const [r, g, b] = bytes(base)
  for (let i = 0; i < size * size; i++) data.set([r, g, b, 255], i * 4)
  const palette = dots.map(bytes)
  const random = lcg(seed)
  for (let n = 0; n < count; n++) {
    const colour = palette[Math.floor(random() * palette.length)]
    const alpha = 0.15 + random() * 0.35
    const width = Math.max(1, Math.round(0.6 + random() * 1.8))
    const x = Math.floor(random() * size)
    const y = Math.floor(random() * size)
    for (let dy = 0; dy < width; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const at = (((y + dy) % size) * size + ((x + dx) % size)) * 4
        for (let c = 0; c < 3; c++) data[at + c] = Math.round(data[at + c] + (colour[c] - data[at + c]) * alpha)
      }
    }
  }
  const texture = dataTexture(data, size, repeat, true)
  speckleCache.set(key, texture)
  return texture
}
```

Run: `npx vitest run src/three/noise.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Écrire le test qui échoue `src/three/audit.test.ts`**

```ts
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture } from 'three'
import { isTextured, markExempt, untexturedMeshes } from './audit'

const box = new BoxGeometry()
const textured = (name: string) => new MeshStandardMaterial({ name, map: new Texture(), roughnessMap: new Texture() })
const plain = (name = '') => new MeshStandardMaterial({ name })
function named<T extends { name: string }>(object: T, name: string): T {
  object.name = name
  return object
}

test('a textured mesh passes', () => {
  const root = named(new Group(), 'base')
  root.add(new Mesh(box, textured('oak')))
  root.add(new Mesh(box, new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() })))
  expect(untexturedMeshes(root)).toEqual([])
  expect(isTextured(textured('oak'))).toBe(true)
  expect(isTextured(new MeshStandardMaterial({ map: new Texture() }))).toBe(false)
  expect(isTextured(new MeshStandardMaterial({ roughnessMap: new Texture() }))).toBe(false)
})

test('an untextured mesh is reported with its path', () => {
  const root = named(new Group(), 'base')
  const table = named(new Group(), 'table')
  const anonymous = new Group()
  root.add(table)
  table.add(anonymous)
  anonymous.add(named(new Mesh(box, plain('oak')), 'top'))
  anonymous.add(new Mesh(box, plain()))
  root.add(named(new InstancedMesh(box, new MeshBasicMaterial(), 2), 'chairs'))
  expect(untexturedMeshes(root)).toEqual(['base/table/top#oak', 'base/table#MeshStandardMaterial', 'base/chairs#MeshBasicMaterial'])
})

test('an exempt material or ancestor is skipped', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, markExempt(plain('glass'), 'glass')), 'pane'))
  const outdoor = markExempt(named(new Group(), 'outdoor'), 'sky')
  outdoor.add(named(new Mesh(box, plain('facade')), 'city'))
  root.add(outdoor)
  expect(untexturedMeshes(root)).toEqual([])
  const sky = markExempt(new Group(), 'sky')
  const inner = named(new Group(), 'inner')
  sky.add(inner)
  inner.add(new Mesh(box, plain('cloud')))
  expect(untexturedMeshes(inner)).toEqual([])
})

test('hidden meshes and hidden ancestors are skipped', () => {
  const root = named(new Group(), 'base')
  const hidden = named(new Mesh(box, plain('a')), 'hidden')
  hidden.visible = false
  const folder = named(new Group(), 'folder')
  folder.visible = false
  folder.add(new Mesh(box, plain('b')))
  root.add(hidden, folder)
  expect(untexturedMeshes(root)).toEqual([])
  const parent = new Group()
  parent.visible = false
  const child = named(new Group(), 'decor')
  parent.add(child)
  child.add(new Mesh(box, plain('c')))
  expect(untexturedMeshes(child)).toEqual([])
})

test('multi-material meshes are checked material by material', () => {
  const root = named(new Group(), 'base')
  root.add(named(new Mesh(box, [textured('wood'), plain('paint'), markExempt(plain('bulb'), 'emissive')]), 'lamp'))
  expect(untexturedMeshes(root)).toEqual(['base/lamp#paint'])
})
```

Run: `npx vitest run src/three/audit.test.ts`
Expected: FAIL — `Failed to resolve import "./audit"`.

- [ ] **Step 8: Créer `src/three/audit.ts`**

Les ancêtres de la racine comptent aussi : un groupe `decor` masqué pendant sa compilation (Tâche 12) n'est pas audité, et un groupe placé sous un parent exempté l'est aussi.

```ts
import type { Material, Mesh, Object3D } from 'three'

/*
 * Material audit (spec criterion 1): every visible surface of the office uses a textured PBR material, except
 * emissive materials, glass, screens and the sky. The test API exposes untexturedMeshes() to the e2e tests.
 */

export const EXEMPTIONS = ['emissive', 'glass', 'screen', 'sky'] as const
export type Exemption = (typeof EXEMPTIONS)[number]

/** Marks a material, or an object and everything below it, as exempt from the audit. Returns the target. */
export function markExempt<T extends { userData: Record<string, unknown> }>(target: T, reason: Exemption): T {
  target.userData.auditExempt = reason
  return target
}

const isExempt = (target: { userData: Record<string, unknown> }) =>
  (EXEMPTIONS as readonly unknown[]).includes(target.userData.auditExempt)

/** A colour map and at least one surface map (normal or roughness). */
export function isTextured(material: Material): boolean {
  const maps = material as Material & { map?: unknown; normalMap?: unknown; roughnessMap?: unknown }
  return Boolean(maps.map) && Boolean(maps.normalMap || maps.roughnessMap)
}

/**
 * Visible meshes (Mesh, InstancedMesh, SkinnedMesh; the object and all its ancestors visible) whose material, or one
 * of its materials, is neither textured nor exempt. An object is exempt when it or an ancestor is marked.
 * Entries read `path#material`: path = names of the named ancestors (from `root`) and of the mesh, joined by '/';
 * material = its name, or its type when it has none.
 */
export function untexturedMeshes(root: Object3D): string[] {
  let exemptAbove = false
  for (let above = root.parent; above; above = above.parent) {
    if (!above.visible) return []
    if (isExempt(above)) exemptAbove = true
  }
  const found: string[] = []
  const visit = (object: Object3D, path: readonly string[], exempt: boolean) => {
    if (!object.visible) return
    const names = object.name ? [...path, object.name] : path
    const skip = exempt || isExempt(object)
    const mesh = object as Partial<Mesh>
    if (!skip && mesh.isMesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        if (!isExempt(material) && !isTextured(material)) found.push(`${names.join('/')}#${material.name || material.type}`)
      }
    }
    for (const child of object.children) visit(child, names, skip)
  }
  visit(root, [], exemptAbove)
  return found
}
```

Run: `npx vitest run src/three/audit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Écrire le test qui échoue `src/three/textures.test.ts`**

```ts
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { TEXTURE_SET_IDS, textureUrl } from './assets'
import { MAX_ANISOTROPY, configureTexture, textureSetUrls } from './textures'

test('colour maps are sRGB, data maps are linear', () => {
  expect(configureTexture(new Texture(), 'color', 1, 8).colorSpace).toBe(SRGBColorSpace)
  expect(configureTexture(new Texture(), 'normal', 1, 8).colorSpace).toBe(NoColorSpace)
  expect(configureTexture(new Texture(), 'arm', 1, 8).colorSpace).toBe(NoColorSpace)
})

test('textures repeat once per tile in metres', () => {
  const texture = configureTexture(new Texture(), 'color', 2, MAX_ANISOTROPY)
  expect(texture.wrapS).toBe(RepeatWrapping)
  expect(texture.wrapT).toBe(RepeatWrapping)
  expect(texture.repeat.toArray()).toEqual([0.5, 0.5])
  expect(texture.anisotropy).toBe(8)
  expect(configureTexture(new Texture(), 'normal', 0.5, 4).repeat.toArray()).toEqual([2, 2])
})

test('configuring twice changes nothing', () => {
  const texture = new Texture()
  configureTexture(texture, 'color', 2, 8)
  expect(texture.version).toBe(1)
  expect(configureTexture(texture, 'normal', 5, 2)).toBe(texture)
  expect(texture.version).toBe(1)
  expect(texture.colorSpace).toBe(SRGBColorSpace)
  expect(texture.repeat.toArray()).toEqual([0.5, 0.5])
  expect(texture.anisotropy).toBe(8)
})

test('texture URLs list colour, normal and ARM for every set', () => {
  const urls = textureSetUrls()
  expect(urls).toHaveLength(TEXTURE_SET_IDS.length * 3)
  expect(new Set(urls).size).toBe(urls.length)
  TEXTURE_SET_IDS.forEach((id, index) => {
    expect(urls.slice(index * 3, index * 3 + 3)).toEqual([textureUrl(id, 'color'), textureUrl(id, 'normal'), textureUrl(id, 'arm')])
  })
  expect(urls[0]).toMatch(/assets\/textures\/plank_flooring_04_color\.webp$/)
})
```

Run: `npx vitest run src/three/textures.test.ts`
Expected: FAIL — `Failed to resolve import "./textures"`.

- [ ] **Step 10: Créer `src/three/textures.ts`**

Le chargeur unique : un seul `useTexture` de drei pour les 24 fichiers (une seule suspension), puis chaque texture est configurée une fois. drei envoie les textures au GPU dans un `useEffect` (`gl.initTexture`), donc après leur configuration, qui a lieu pendant le rendu. Le même objet `TextureSets` est rendu à tous les composants (cache par tableau de textures, que le cache de `useLoader` garde identique), ce qui permet à `useMaterials` de ne construire les matériaux qu'une fois.

```ts
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { TEXTURE_MAPS, type TextureMap } from '../assets/paths'
import { TEXTURE_SET_IDS, TEXTURE_SETS, textureUrl, type TextureSetId } from './assets'

/** Sharp floors and walls at grazing angles, without paying for 16x on an integrated GPU. */
export const MAX_ANISOTROPY = 8

/** One PBR texture set: colour (sRGB), normal (OpenGL convention) and ARM (R ambient occlusion, G roughness, B metalness). */
export interface PbrTextures {
  color: Texture
  normal: Texture
  arm: Texture
}
export type TextureSets = Record<TextureSetId, PbrTextures>

/** Every texture file of the room, in a fixed order: for each set of TEXTURE_SET_IDS, its colour, normal and ARM maps. */
export function textureSetUrls(): string[] {
  return TEXTURE_SET_IDS.flatMap((id) => TEXTURE_MAPS.map((map) => textureUrl(id, map)))
}

/**
 * The one place where a loaded texture is set up: colour space (only colour maps are sRGB), repeat in metres
 * (geometry UVs are in metres, so one repeat covers `tileMetres`) and anisotropy. Idempotent: a texture shared by
 * several materials is configured once, and later calls change nothing.
 */
export function configureTexture(texture: Texture, map: TextureMap, tileMetres: number, anisotropy: number): Texture {
  if (texture.userData.configured) return texture
  texture.colorSpace = map === 'color' ? SRGBColorSpace : NoColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(1 / tileMetres, 1 / tileMetres)
  texture.anisotropy = anisotropy
  texture.userData.configured = true
  texture.needsUpdate = true
  return texture
}

/** TextureSets per loaded texture array: every component gets the same object (the material cache relies on it). */
const sets = new WeakMap<Texture[], TextureSets>()

/** All PBR texture sets of the room: one suspension for every file, then configured once. Use inside the Canvas. */
export function useTextureSets(): TextureSets {
  const gl = useThree((state) => state.gl)
  const textures = useTexture(textureSetUrls())
  const cached = sets.get(textures)
  if (cached) return cached
  const anisotropy = Math.min(MAX_ANISOTROPY, gl.capabilities.getMaxAnisotropy())
  const built = {} as TextureSets
  TEXTURE_SET_IDS.forEach((id, index) => {
    const { tileMetres } = TEXTURE_SETS[id]
    const [color, normal, arm] = TEXTURE_MAPS.map((map, k) => configureTexture(textures[index * 3 + k], map, tileMetres, anisotropy))
    built[id] = { color, normal, arm }
  })
  sets.set(textures, built)
  return built
}
```

Run: `npx vitest run src/three/textures.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 11: Écrire le test qui échoue `src/three/materials.test.ts`**

`buildMaterials` est pure : le test lui donne des `Texture` vides, sans chargement ni DOM.

```ts
import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three'
import { brand } from '../core/brand'
import { TEXTURE_SET_IDS } from './assets'
import { isTextured } from './audit'
import { ENV_MAP_INTENSITY, buildMaterials, pbrMaterial, type MaterialKey } from './materials'
import type { TextureSets } from './textures'
import { tints } from './tints'

function fakeSets(): TextureSets {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  return sets
}

const KEYS: MaterialKey[] = [
  'floor', 'wall', 'ceiling', 'skirting', 'slats', 'oak', 'walnut', 'chairFabric', 'sofaFabric', 'cushion', 'rug',
  'blackMetal', 'brushedMetal', 'consoleShell', 'consoleDark', 'porcelain', 'glass', 'screenOff',
  'limeGlow', 'mintGlow', 'logoLime', 'logoMint', 'logoInk', 'signBack', 'ceilingStrip', 'lampShade',
]

test('every shared material is textured or exempt', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  expect(Object.keys(m)).toEqual(KEYS)
  for (const key of KEYS) {
    const material = m[key]
    expect(isTextured(material) || typeof material.userData.auditExempt === 'string', key).toBe(true)
    expect(material.name).toBe(key)
    if (key === 'porcelain' || key === 'glass') expect(material, key).toBeInstanceOf(MeshPhysicalMaterial)
    else {
      expect(material, key).toBeInstanceOf(MeshStandardMaterial)
      expect(material, key).not.toBeInstanceOf(MeshPhysicalMaterial)
    }
  }
  expect(m.floor.map).toBe(sets.floor.color)
  expect(m.floor.normalMap).toBe(sets.floor.normal)
  expect(m.floor.roughnessMap).toBe(sets.floor.arm)
  expect(m.floor.aoMap).toBe(sets.floor.arm)
  expect(m.floor.envMapIntensity).toBe(ENV_MAP_INTENSITY.surface)
  expect(m.ceiling.map).toBe(sets.wall.color)
  expect(m.rug.map).toBe(sets.carpet.color)
  expect(isTextured(m.porcelain)).toBe(true)
})

test('metal sets use the ARM blue channel for metalness', () => {
  const sets = fakeSets()
  const m = buildMaterials(sets)
  for (const key of ['blackMetal', 'brushedMetal'] as const) {
    expect(m[key].metalness, key).toBe(1)
    expect(m[key].metalnessMap, key).toBe(sets[key].arm)
    expect(m[key].roughnessMap, key).toBe(sets[key].arm)
  }
  for (const key of ['floor', 'oak', 'walnut', 'chairFabric', 'rug', 'consoleShell'] as const) {
    expect(m[key].metalness, key).toBe(0)
    expect(m[key].metalnessMap, key).toBeNull()
  }
  expect(m.consoleShell.roughness).toBe(0.7)
  expect(m.oak.roughness).toBe(1)
  const custom = pbrMaterial(sets.oak, { name: 'custom', tint: tints.oak, metal: false, roughness: 0.6, envMapIntensity: ENV_MAP_INTENSITY.model })
  expect(custom).toMatchObject({ name: 'custom', roughness: 0.6, envMapIntensity: 0.8, metalness: 0 })
  expect(custom.aoMap).toBe(sets.oak.arm)
})

test('glass is transparent and marked as glass', () => {
  const m = buildMaterials(fakeSets())
  expect(m.glass).toMatchObject({ transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, depthWrite: false, side: DoubleSide })
  expect(m.glass.transmission).toBe(0)
  expect(m.glass.userData.auditExempt).toBe('glass')
  expect(m.screenOff.userData.auditExempt).toBe('screen')
  for (const key of ['limeGlow', 'mintGlow', 'logoLime', 'logoMint', 'logoInk', 'signBack', 'ceilingStrip', 'lampShade'] as const) {
    expect(m[key].userData.auditExempt, key).toBe('emissive')
  }
  expect([m.signBack.emissiveIntensity, m.ceilingStrip.emissiveIntensity, m.lampShade.emissiveIntensity]).toEqual([0, 0, 0])
  expect([m.limeGlow.emissiveIntensity, m.mintGlow.emissiveIntensity, m.logoInk.emissiveIntensity]).toEqual([0.8, 0.6, 0.2])
  expect(m.porcelain).toMatchObject({ roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 })
})

test('tints come from tints.ts and brand.ts', () => {
  const m = buildMaterials(fakeSets())
  const expected: Record<MaterialKey, string> = {
    floor: tints.floor, wall: tints.wall, ceiling: tints.ceiling, skirting: tints.skirting, slats: tints.slats,
    oak: tints.oak, walnut: tints.walnut, chairFabric: tints.chairFabric, sofaFabric: brand.blueGrey, cushion: brand.lime,
    rug: tints.rug, blackMetal: tints.blackMetal, brushedMetal: tints.brushedMetal, consoleShell: tints.consoleShell,
    consoleDark: tints.consoleDark, porcelain: brand.onDark, glass: tints.glass, screenOff: brand.ink,
    limeGlow: brand.lime, mintGlow: brand.mint, logoLime: brand.lime, logoMint: brand.mint, logoInk: brand.onDark,
    signBack: brand.surface1, ceilingStrip: tints.warmLight, lampShade: tints.warmLight,
  }
  for (const key of KEYS) expect(m[key].color.getHexString(), key).toBe(new Color(expected[key]).getHexString())
  expect(m.limeGlow.emissive.getHexString()).toBe(new Color(brand.lime).getHexString())
  expect(m.signBack.emissive.getHexString()).toBe(new Color(brand.onDark).getHexString())
  expect(m.lampShade.emissive.getHexString()).toBe(new Color(tints.warmLight).getHexString())
  expect([tints.sofaFabric, tints.cushion, tints.porcelain, tints.visor]).toEqual([brand.blueGrey, brand.lime, brand.onDark, brand.nearBlack])
})
```

Run: `npx vitest run src/three/materials.test.ts`
Expected: FAIL — `buildMaterials is not a function` (et `ENV_MAP_INTENSITY` indéfini) : `materials.ts` n'exporte encore que l'ancienne fonction.

- [ ] **Step 12: Réécrire `src/three/materials.ts`**

La fabrique PBR occupe le haut du fichier. L'ancien code (`skyTexture`, `build`, cache, `materials()`) est conservé tel quel en fin de fichier, sous une bannière, pour que les composants actuels continuent de fonctionner jusqu'à leur migration (Tâches 6 à 11) ; son type s'appelle maintenant `LegacyMaterials`, car `Materials` désigne la fabrique et aucun fichier n'importait l'ancien type.

```ts
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type MeshStandardMaterialParameters,
} from 'three'
import { brand } from '../core/brand'
import { TEXTURE_SETS, type TextureSetId } from './assets'
import { markExempt } from './audit'
import { noiseTexture } from './noise'
import { useTextureSets, type PbrTextures, type TextureSets } from './textures'
import { tints } from './tints'

/* ------------------------------------------------------------------ *
 *  PBR materials of the redesigned office (spec 2026-10-06, section 5)
 * ------------------------------------------------------------------ */

/** How strongly each kind of surface reflects the scene environment (Lightformers, scaled per phase). */
export const ENV_MAP_INTENSITY = { surface: 1, model: 0.8, plant: 0.45 } as const

/**
 * A textured PBR material from one texture set: colour map tinted by `tint`, normal map, and the ARM map read three
 * ways (R ambient occlusion, G roughness, B metalness; metalness only for metal sets).
 */
export function pbrMaterial(
  textures: PbrTextures,
  options: { name: string; tint: string; metal: boolean; roughness?: number; envMapIntensity?: number },
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    name: options.name,
    color: options.tint,
    map: textures.color,
    normalMap: textures.normal,
    roughnessMap: textures.arm,
    aoMap: textures.arm,
    metalnessMap: options.metal ? textures.arm : null,
    metalness: options.metal ? 1 : 0,
    roughness: options.roughness ?? 1,
    envMapIntensity: options.envMapIntensity ?? ENV_MAP_INTENSITY.surface,
  })
}

/** Every shared material of the office. Pure: works on plain Texture objects (unit tests) as on loaded ones. */
export function buildMaterials(sets: TextureSets) {
  const pbr = (name: string, set: TextureSetId, tint: string, roughness?: number) =>
    pbrMaterial(sets[set], { name, tint, metal: TEXTURE_SETS[set].metal, roughness })
  const glow = (name: string, colour: string, emissiveIntensity: number, extra: MeshStandardMaterialParameters = {}) =>
    markExempt(new MeshStandardMaterial({ name, color: colour, emissive: colour, emissiveIntensity, ...extra }), 'emissive')
  return {
    floor: pbr('floor', 'floor', tints.floor),
    wall: pbr('wall', 'wall', tints.wall),
    ceiling: pbr('ceiling', 'wall', tints.ceiling),
    skirting: pbr('skirting', 'wall', tints.skirting),
    slats: pbr('slats', 'oak', tints.slats),
    oak: pbr('oak', 'oak', tints.oak),
    walnut: pbr('walnut', 'walnut', tints.walnut),
    chairFabric: pbr('chairFabric', 'fabric', tints.chairFabric),
    sofaFabric: pbr('sofaFabric', 'fabric', tints.sofaFabric),
    cushion: pbr('cushion', 'fabric', tints.cushion),
    rug: pbr('rug', 'carpet', tints.rug),
    blackMetal: pbr('blackMetal', 'blackMetal', tints.blackMetal),
    brushedMetal: pbr('brushedMetal', 'brushedMetal', tints.brushedMetal),
    consoleShell: pbr('consoleShell', 'wall', tints.consoleShell, 0.7),
    consoleDark: pbr('consoleDark', 'wall', tints.consoleDark, 0.7),
    // Lacquered porcelain: a slight colour and roughness variation under a clear coat, so it reflects the phase.
    porcelain: new MeshPhysicalMaterial({
      name: 'porcelain',
      color: tints.porcelain,
      map: noiseTexture({ size: 128, min: 0.93, max: 1, seed: 3, srgb: true }),
      roughness: 0.22,
      roughnessMap: noiseTexture({ size: 128, min: 0.8, max: 1, seed: 5 }),
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    // A thin pane: faint, reflective, no physical transmission (that would cost a second render of the scene).
    glass: markExempt(
      new MeshPhysicalMaterial({
        name: 'glass',
        color: tints.glass,
        transparent: true,
        opacity: 0.08,
        roughness: 0.05,
        metalness: 0,
        envMapIntensity: 1.5,
        depthWrite: false,
        side: DoubleSide,
      }),
      'glass',
    ),
    screenOff: markExempt(new MeshStandardMaterial({ name: 'screenOff', color: brand.ink, roughness: 0.3, metalness: 0.1 }), 'screen'),
    limeGlow: glow('limeGlow', brand.lime, 0.8),
    mintGlow: glow('mintGlow', brand.mint, 0.6),
    // Logo, sign and ceiling lights: their emissive intensity follows the time of day (lighting/emissive.ts, Task 7).
    logoLime: glow('logoLime', brand.lime, 0.4),
    logoMint: glow('logoMint', brand.mint, 0.4),
    logoInk: glow('logoInk', brand.onDark, 0.2),
    signBack: markExempt(
      new MeshStandardMaterial({ name: 'signBack', color: brand.surface1, emissive: brand.onDark, emissiveIntensity: 0 }),
      'emissive',
    ),
    ceilingStrip: glow('ceilingStrip', tints.warmLight, 0, { roughness: 0.4 }),
    lampShade: glow('lampShade', tints.warmLight, 0, { roughness: 0.4 }),
  }
}

export type Materials = ReturnType<typeof buildMaterials>
export type MaterialKey = keyof Materials

/** Materials per TextureSets: built once, shared by every component, never disposed (the office lives as long as the page). */
const built = new WeakMap<TextureSets, Materials>()

/** The shared PBR materials. Suspends until the texture sets are loaded; use inside the Canvas. */
export function useMaterials(): Materials {
  const sets = useTextureSets()
  let materials = built.get(sets)
  if (!materials) {
    materials = buildMaterials(sets)
    built.set(sets, materials)
  }
  return materials
}

/* ------------------------------------------------------------------ *
 *  Flat materials of the first office, kept until no component calls materials() (removed in Task 11)
 * ------------------------------------------------------------------ */

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
    warmGlow: new MeshBasicMaterial({ color: new Color('#FFD29A').multiplyScalar(1.15), toneMapped: false }),
    coveGlow: new MeshBasicMaterial({ color: new Color('#FFC98A').multiplyScalar(0.75), toneMapped: false }),
    lime: new MeshStandardMaterial({ color: brand.lime, emissive: brand.lime, emissiveIntensity: 0.45 }),
    mint: new MeshStandardMaterial({ color: brand.mint, emissive: brand.mint, emissiveIntensity: 0.35 }),
    ink: new MeshStandardMaterial({ color: brand.nearBlack, roughness: 0.45 }),
    logoLight: new MeshStandardMaterial({ color: brand.onDark, emissive: brand.onDark, emissiveIntensity: 0.15, roughness: 0.6 }),
    porcelain: new MeshPhysicalMaterial({
      color: '#F4F6F5',
      emissive: '#ffffff',
      emissiveIntensity: 0.06,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }),
    window: new MeshBasicMaterial({ map: skyTexture(), toneMapped: false }),
  }
}

/** @deprecated Flat materials of the first office: use Materials and useMaterials(). */
export type LegacyMaterials = ReturnType<typeof build>

let cache: LegacyMaterials | null = null

/**
 * Shared flat materials, created on first use (inside the Canvas).
 * @deprecated Use useMaterials() (textured PBR materials). Deleted with this section in Task 11.
 */
export function materials(): LegacyMaterials {
  cache ??= build()
  return cache
}
```

Run: `npx vitest run src/three`
Expected: PASS — les 22 nouveaux tests (uv 2, merge 4, noise 3, audit 5, textures 4, materials 4) avec les tests existants de `src/three` (`objects`, `logo`, `robot/*`) ; sortie sans avertissement.

- [ ] **Step 13: Vérifier et commiter**

Run: `npm run check`
Expected: PASS ; `tsc` ne signale rien (les composants appellent toujours `materials()`, dont le type de retour garde les mêmes clés) ; « Initial JS (gzip) » augmente au plus de quelques Ko (`materials.ts`, importé par les accessoires, entraîne désormais `textures.ts`, `noise.ts`, `audit.ts`, `tints.ts` et `assets.ts` dans le chunk initial ; ce qui n'est pas utilisé est éliminé au build) et reste sous 1,50 MB ; `No test API (__academy) in the production JS`.

Run: `npx playwright test tests/e2e/office.spec.ts -g "laptop"`
Expected: PASS — le bureau s'affiche et se parcourt exactement comme avant (rien de visible ne change dans cette tâche).

```bash
git add src/three/uv.ts src/three/uv.test.ts src/three/merge.ts src/three/merge.test.ts src/three/tints.ts src/three/noise.ts src/three/noise.test.ts src/three/audit.ts src/three/audit.test.ts src/three/textures.ts src/three/textures.test.ts src/three/materials.ts src/three/materials.test.ts
git commit -m "feat: PBR material kit: texture loader, metre UVs, procedural noise, part merging, tints and material audit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Plan de la salle

**Files:**
- Create: `src/three/plants/types.ts`, `src/zones/office/footprints.ts`, `src/zones/office/framing.ts`
- Modify: `src/zones/office/layout.ts` (réécriture : constantes, `TABLE`, `tableHalfWidthAt`, `chairRing`, `rail`, `objects` ; ni `flights` ni `lights`), `src/zones/office/tune.ts` (`TUNABLE`), `src/zones/office/camera/railMath.ts` (`PARALLAX`), `src/zones/office/camera/CameraRig.tsx` (import de `PARALLAX`), `src/zones/office/Room.tsx` (import de `ROOM`), `src/zones/office/OfficeScene.tsx` (état de la Tâche 5)
- Test: `src/zones/office/footprints.test.ts` (nouveau), `src/zones/office/layout.test.ts` (réécriture)

**Interfaces:**
- Consumes: `Via` (`src/core/store.ts`, inchangé) ; `CatmullRomCurve3`, `PerspectiveCamera`, `Vector3` de three ; `makeRail` (`src/zones/office/camera/railMath.ts`, inchangé).
- Produces (`src/zones/office/layout.ts`) : `Vec3`, `Pose`, `Placement` (inchangés) ; `ROOM = { width: 10, depth: 12, height: 3.2, x0: -5, x1: 5, z0: -6, z1: 6 }` ; `WALL_T = 0.2` ; `CAMERA = { fov: 45, near: 0.1, far: 1000 }` ; `GLAZING` (side, back, sideMullionsZ, backMullionsX, mullion, transomY, glassInset) ; `BANQUETTE` ; `SLAT_WALL` ; `RUG` ; `CONTACT_SHADOW_Y = 0.02` ; `CEILING_LINES` ; `SKIRTING` ; `SHELVES` ; `TABLE` (gagne `topThickness: 0.04`, `edgeRadius: 0.015`) ; `tableHalfWidthAt(z: number): number` ; `chairRing(): Placement[]` ; `layout.rail` (trois poses : vue d'ensemble `(2.0, 2.5, 5.8) → (0.4, 0.95, −1.3)`, intermédiaire `(0.2, 1.8, 2.3) → (−2.4, 1.4, −4.6)`, présentation `(−1.5, 1.35, −1.4) → (−1.5, 1.6, −5.97)`) ; `layout.objects` avec les clés `table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo, clock, cabinet, coffeeTable, shelves, pendants, frames, plants, hangingPlants, largePlants { pottedPlant, pachira }, vases, shelfBooks` ; `layout.flights`, `layout.screen`, `layout.ada`, `layout.lights` inchangés ; `layoutVersion`, `bumpLayout()`. `ROOM` n'est plus exporté par `Room.tsx`.
- Produces (`src/three/plants/types.ts`, types seuls, aucun import) : `PlantKind`, `PotGlaze`, `HangingGlaze`, `PlantPlacement`, `HangingPlacement`, `VasePlant`, `VasePlacement`, `ShelfBooksSpec` (code du Step 3).
- Produces (`src/zones/office/footprints.ts`) : `interface Box { name: string; min: Vec3; max: Vec3 }` ; `SIZES: Record<string, Vec3>` (valeurs du code du Step 3 ; l'enseigne `logo` y mesure 0,9 × 1,116 × 0,12 m, la plaque rétroéclairée de la Tâche 10) ; `boxFor(name: string, placement: Placement, size: Vec3, options?: { below?: number }): Box` (x et z échangés quand `|sin(rotationY)| > 0.5` ; la boîte va de `y - below` à `y + size[1]`) ; `sceneBoxes(): Box[]` (noms, dans cet ordre : `table`, `chair-0`…`chair-7`, `microphone-0`…`microphone-5`, `sideboard`, `lamp`, `laptop`, `tvStand`, `tv`, `retroConsole`, `sofa`, `logo`, `clock`, `cabinet`, `coffeeTable`, `shelves`, `pendant-0`…`pendant-2`, `frame-0`, `frame-1`, `plant-0`…`plant-7`, `hangingPlant-0`, `hangingPlant-1`, `pottedPlant`, `pachira`, `vase-0`, `vase-1`, `banquette`, `ada` ; une plante suspendue est tout entière sous son crochet, un pothos laisse pendre ses tiges 0,6 m sous son pot, l'enseigne est centrée verticalement sur sa position) ; `segmentHitsBox(a: Vec3, b: Vec3, box: Box): boolean`.
- Produces (`src/zones/office/framing.ts`) : `interface GlazingShare { total: number; back: number }` ; `SCREEN_BANDS = { hudBottom: 0.08, panelTop: 0.77 }` ; `glazingFraction(pose: Pose, aspect: number, options?: { samples?: number; parallax?: [number, number] }): GlazingShare` (exacte par défaut, comme les mesures de l'architecte ; avec `samples`, comptage de rayons) ; `projectPoint(pose: Pose, aspect: number, point: Vec3, parallax?: [number, number]): { u: number; v: number; inFront: boolean }` ; `projectBox(pose: Pose, aspect: number, box: Box): { u0: number; u1: number; v0: number; v1: number }`.
- Produces (`src/zones/office/camera/railMath.ts`) : `PARALLAX = { x: 0.35, y: 0.18 }` (retiré de `CameraRig.tsx`, qui l'importe). Le rail garde trois points.
- Produces (`src/zones/office/tune.ts`) : `TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'tvStand', 'tv', 'retroConsole', 'sofa', 'logo', 'clock', 'cabinet', 'coffeeTable', 'shelves']` ; `layoutSnapshot()` garde les clés `rail, flights, objects, screen, ada, lights`.

La salle ne change pas encore à l'écran : seuls le cadrage de la vue d'ensemble, le rail et le plan (positions de tout le mobilier et du décor à venir) changent. L'ancien caisson procédural (`object="cabinet"`) sert de meuble télé sous le nom de scène `tvStand`, à sa place actuelle ; le nom `cabinet` désigne désormais le caisson à tiroirs du décor (Tâche 12), contre le mur de droite.

Les tests de cadrage mesurent exactement ce que l'architecte a mesuré pour choisir `rail[0]` (`.superpowers/scratch-framing/`) : la caméra de `Stage.tsx` (fov 45°), la cible décalée par la parallaxe du pointeur comme dans `CameraRig` (`x + PARALLAX.x`, `y - PARALLAX.y` aux extrêmes), et la part de la baie calculée exactement par projection et découpage des deux rectangles vitrés (les faces intérieures d'une pièce convexe ne se masquent jamais entre elles). Le comptage de rayons de `glazingFraction(…, { samples })` sert de recoupement : 0,13893 contre 0,13896 en 16:9. Valeurs obtenues avec le code ci-dessous (scratch) : part de la baie 13,90 % en 16:9 et 16,30 % en 1280 × 600 au repos, 12,25 % et 14,73 % à la pire parallaxe ; coin rétro u 0,882…0,980, v 0,526…0,660 (121 px sur 900, 80 px sur 600) ; centre du laptop (0,335 ; 0,565) ; point intermédiaire 25,7 % ; vue présentation 18,4 %, entièrement sur le retour vitré.

Écart assumé au test « every object stays inside the room » : les boîtes des plantes de la banquette (`SIZES` × échelle) dépassent la façade (la monstera de 0,67 m de large centrée à x = −4,705 atteint x = −5,04), et la boîte de traîne du pothos posé à 0,42 m descend sous le sol. Ce sont des bornes larges, pas les feuillages réels : le test vérifie les plantes par leur pot (position ± r, hauteur h) et toutes les autres boîtes en entier. Les feuillages réels, eux, restent dans la pièce : la Tâche 14 (« banquette plants keep their leaves inside the glazing ») mesure la géométrie générée de chaque plante de la banquette, vase compris, et exige x > −4,96 (face intérieure des montants et de la traverse). D'où la monstera à l'échelle 0,7 en x = −4,705, la fougère à 0,95 en x = −4,67 et le vase rond en x = −4,74 (mesuré dans le scratch du plan : feuilles jusqu'à x = −4,952, −4,940 et −4,949 ; aux valeurs de départ, la monstera atteignait x = −5,073 et la fougère −5,039, au-delà du verre en x = −5,02).

- [ ] **Step 1: Écrire le test qui échoue `src/zones/office/footprints.test.ts`**

```ts
import { SIZES, boxFor, sceneBoxes, segmentHitsBox, type Box } from './footprints'
import { ROOM, layout } from './layout'

const named = (name: string) => {
  const box = sceneBoxes().find((b) => b.name === name)
  if (!box) throw new Error(`no box named ${name}`)
  return box
}

test('boxes swap width and depth when turned a quarter', () => {
  expect(boxFor('a', { position: [1, 0, 2] }, [2, 1, 4])).toEqual({ name: 'a', min: [0, 0, 0], max: [2, 1, 4] })
  expect(boxFor('b', { position: [1, 0, 2], rotationY: -Math.PI / 2 }, [2, 1, 4])).toEqual({ name: 'b', min: [-1, 0, 1], max: [3, 1, 3] })
  // Turned less than 30 degrees: still counted as facing +z.
  expect(boxFor('c', { position: [0, 0, 0], rotationY: 0.5 }, [2, 1, 4]).max).toEqual([1, 1, 2])
  // In the room: the TV stand faces -x, so its 1.7 m length runs along z.
  const stand = named('tvStand')
  expect(stand.max[0] - stand.min[0]).toBeCloseTo(SIZES.tvStand[2])
  expect(stand.max[2] - stand.min[2]).toBeCloseTo(SIZES.tvStand[0])
})

test('hanging boxes extend below their hook', () => {
  expect(boxFor('h', { position: [0, 3, 0] }, [0.5, 0, 0.5], { below: 1.5 })).toEqual({ name: 'h', min: [-0.25, 1.5, -0.25], max: [0.25, 3, 0.25] })
  for (const name of ['hangingPlant-0', 'hangingPlant-1']) {
    const box = named(name)
    expect(box.max[1], name).toBe(ROOM.height)
    expect(box.min[1], name).toBeCloseTo(ROOM.height - SIZES.hangingPlant[1])
  }
  // The pothos on the banquette trails its vines below the bench top.
  expect(named('plant-4').min[1]).toBeLessThan(layout.objects.plants[4].position[1])
  // The sign is centred on its position.
  const logo = named('logo')
  expect((logo.min[1] + logo.max[1]) / 2).toBeCloseTo(layout.objects.logo.position[1])
})

test('segmentHitsBox finds crossings and misses', () => {
  const unit: Box = { name: 'unit', min: [0, 0, 0], max: [1, 1, 1] }
  expect(segmentHitsBox([-1, 0.5, 0.5], [2, 0.5, 0.5], unit)).toBe(true) // straight through
  expect(segmentHitsBox([-1, -1, 0.5], [2, 2, 0.5], unit)).toBe(true) // diagonal
  expect(segmentHitsBox([0.5, 0.5, 0.5], [3, 3, 3], unit)).toBe(true) // starts inside
  expect(segmentHitsBox([1, 0.5, -1], [1, 0.5, 2], unit)).toBe(true) // slides along a face: endpoints and faces count
  expect(segmentHitsBox([-1, 2, 0.5], [2, 2, 0.5], unit)).toBe(false) // passes above
  expect(segmentHitsBox([-1, 0.5, 0.5], [-0.1, 0.5, 0.5], unit)).toBe(false) // stops short
  expect(segmentHitsBox([0.5, 0.5, 2], [0.5, 0.5, 2], unit)).toBe(false) // a single point outside
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/zones/office/footprints.test.ts`
Expected: FAIL — `Error: Failed to resolve import "./footprints" from "src/zones/office/footprints.test.ts". Does the file exist?`

- [ ] **Step 3: Créer `src/three/plants/types.ts`, réécrire `src/zones/office/layout.ts`, créer `src/zones/office/footprints.ts`**

`src/three/plants/types.ts` (types seuls, sans import : le générateur de plantes de la Tâche 13 et le plan les partagent) :

```ts
/*
 * Placement types of the plants, vases and shelf books (src/zones/office/layout.ts). Types only, no import:
 * the plant generators (Task 13) and the layout share them without depending on each other.
 */
type Vec3 = [number, number, number]

export type PlantKind = 'monstera' | 'palm' | 'fern' | 'pothos' | 'succulent' | 'herb'
export type PotGlaze = 'terracotta' | 'cream' | 'slate' | 'brass' | 'none'
export type HangingGlaze = 'white' | 'terracotta' | 'sage' | 'charcoal'

/** A plant in its pot. position: bottom centre of the pot; r, h: pot radius and height; sway: amplitude in radians (0 = still); fall: direction of trailing vines (radians about y). */
export interface PlantPlacement {
  kind: PlantKind
  position: Vec3
  pot: PotGlaze
  r: number
  h: number
  scale: number
  seed: number
  sway: number
  fall?: number
}

/** A plant hanging from the ceiling. position: the hook; vines and length in metres; drop: cord length below the hook. */
export interface HangingPlacement {
  position: Vec3
  seed: number
  glaze: HangingGlaze
  vines: number
  length: number
  drop: number
}

/** A plant growing out of a vase: no pot of its own. */
export type VasePlant = Omit<PlantPlacement, 'position' | 'pot'>

export interface VasePlacement {
  model: 'vaseTall' | 'vaseRound'
  position: Vec3
  rotationY?: number
  plant: VasePlant
}

/** A row of books standing on a shelf board between x0 and x1, at height y, depth centred on z. */
export interface ShelfBooksSpec {
  x0: number
  x1: number
  y: number
  z: number
  seed: number
}
```

`src/zones/office/layout.ts` en entier. Les nouvelles constantes sont des exports séparés : `layout` garde ses six clés de premier niveau (piège de `tune.test.ts`). `flights` et `lights` ne changent pas ici (Tâches 11 et 7). Aucun caractère non ASCII dans le code.

```ts
import type { Via } from '../../core/store'
import type { HangingPlacement, PlantPlacement, ShelfBooksSpec, VasePlacement } from '../../three/plants/types'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export interface Placement {
  position: Vec3
  rotationY?: number
}

/** The meeting room: 10 x 12 m, 3.2 m under the ceiling. The screen wall is z = -6, the glazing x = -5. */
export const ROOM = { width: 10, depth: 12, height: 3.2, x0: -5, x1: 5, z0: -6, z1: 6 } as const
/** Walls, floor and ceiling are 20 cm slabs: they cast shadows and show their thickness at the edge of the glazing. */
export const WALL_T = 0.2
/** The office camera. `far` holds the 400 m sky dome and the city around it (outdoor/cityPlan.ts). */
export const CAMERA = { fov: 45, near: 0.1, far: 1000 } as const
/** Floor-to-ceiling glazing: the left facade, and its return on the back wall behind Ada. */
export const GLAZING = {
  side: { x: -5, z0: -6, z1: 4.4 }, // left facade, floor to ceiling
  back: { z: -6, x0: -5, x1: -3.4 }, // return on the back wall, behind Ada
  sideMullionsZ: [-4.8, -3.6, -2.4, -1.2, 0, 1.2, 2.4, 3.6],
  backMullionsX: [-4.2],
  mullion: { width: 0.05, depth: 0.08 },
  transomY: 0.45,
  glassInset: 0.02, // glass planes at x = -5.02 and z = -6.02
} as const
/** Low bench along the glazing, with plants on it. */
export const BANQUETTE = { x0: -4.98, x1: -4.53, z0: -4.9, z1: 1.2, height: 0.42 } as const
/** Vertical oak slats behind the wall screen: z from -6 to -5.97, floor to ceiling. */
export const SLAT_WALL = { x0: -3.32, x1: 1.36, depth: 0.03, slat: 0.045, gap: 0.015 } as const
export const RUG = { center: [-1.0, -1.8] as const, size: [4.2, 6.8] as const, thickness: 0.012 } as const
/** Height of the contact shadows: above the 12 mm rug, so no flat surface shares their height. */
export const CONTACT_SHADOW_Y = 0.02
/** Two recessed light lines in the ceiling, along z. */
export const CEILING_LINES = [
  { x: -2.6, z0: -5.0, z1: 2.2 },
  { x: 0.6, z0: -5.0, z1: 2.2 },
] as const
export const SKIRTING = { height: 0.08, depth: 0.015 } as const
/** Wall shelves of the lounge corner: board bottoms at 1.3 and 1.75 m (tops at 1.325 and 1.775). */
export const SHELVES = { width: 1.4, depth: 0.24, thickness: 0.025, boards: [1.3, 1.75] } as const

export const TABLE = { center: { x: -1.0, z: -1.8 }, radii: { x: 1.25, z: 2.5 }, topY: 0.75, topThickness: 0.04, edgeRadius: 0.015 }

/** Racetrack top: straight sides for |dz| <= radii.z - radii.x, semicircular ends of radius radii.x, 0 beyond the ends. */
export function tableHalfWidthAt(z: number): number {
  const { radii } = TABLE
  const straight = radii.z - radii.x
  const dz = Math.abs(z - TABLE.center.z)
  if (dz <= straight) return radii.x
  const d = dz - straight
  return d >= radii.x ? 0 : Math.sqrt(radii.x * radii.x - d * d)
}

/** Four chairs on each long side, 0.5 m out from the racetrack edge, turned toward it. */
export function chairRing(): Placement[] {
  return [-3.6, -2.4, -1.2, 0.0].flatMap((z) => {
    const offset = tableHalfWidthAt(z) + 0.5
    return [
      { position: [TABLE.center.x - offset, 0, z] as Vec3, rotationY: Math.PI / 2 },
      { position: [TABLE.center.x + offset, 0, z] as Vec3, rotationY: -Math.PI / 2 },
    ]
  })
}

/**
 * Single source of truth for the office: camera rail, flights, furniture and decor.
 * Units are metres. The room spans x -5..5, z -6..6; the screen wall is at z = -6.
 * The object is mutable on purpose: the tuning panel (?tune) edits it live.
 * Keep its top-level keys (tune.ts layoutSnapshot): new constants are separate exports above.
 */
export const layout = {
  rail: [
    // overview: retro corner and laptop in frame, glazing 13.9 % of a 16:9 frame
    { position: [2.0, 2.5, 5.8], target: [0.4, 0.95, -1.3] },
    // intermediate: turns toward the facade, glazing 25.7 % (the city opens up)
    { position: [0.2, 1.8, 2.3], target: [-2.4, 1.4, -4.6] },
    // presentation, unchanged
    { position: [-1.5, 1.35, -1.4], target: [-1.5, 1.6, -5.97] },
  ] as Pose[],
  flights: {
    laptop: { position: [-0.8, 0.95, 0.39], target: [-0.8, 0.87, 0.1] },
    tv: { position: [3.95, 0.8, -1.4], target: [4.35, 0.78, -1.4] },
  } as Record<Via, Pose>,
  objects: {
    table: { position: [TABLE.center.x, 0, TABLE.center.z] } as Placement,
    chairs: chairRing(),
    microphones: [-3.0, -1.8, -0.6].flatMap((z) => [
      { position: [TABLE.center.x - 0.72, TABLE.topY, z] as Vec3, rotationY: -Math.PI / 2 },
      { position: [TABLE.center.x + 0.72, TABLE.topY, z] as Vec3, rotationY: Math.PI / 2 },
    ]) as Placement[],
    sideboard: { position: [-0.9, 0, -5.62] } as Placement, // two model units at local x = +/-1.22
    lamp: { position: [1.3, 0.68, -5.62] } as Placement,
    laptop: { position: [-0.8, TABLE.topY, 0.25], rotationY: 0 } as Placement,
    tvStand: { position: [4.62, 0, -1.4], rotationY: -Math.PI / 2 } as Placement,
    tv: { position: [4.6, 0.5, -1.4], rotationY: -Math.PI / 2 } as Placement,
    retroConsole: { position: [4.5, 0.5, -0.9], rotationY: -Math.PI / 2 } as Placement,
    sofa: { position: [2.9, 0, -1.4], rotationY: Math.PI / 2 } as Placement,
    logo: { position: [2.6, 1.95, -5.93], rotationY: 0 } as Placement,
    clock: { position: [1.75, 2.19, -5.975], rotationY: 0 } as Placement, // bottom of the normalised clock; dial centre at y 2.35
    cabinet: { position: [4.74, 0, -4.2], rotationY: -Math.PI / 2 } as Placement, // drawer_cabinet (decor)
    coffeeTable: { position: [3.85, 0, -1.4], rotationY: 0 } as Placement,
    shelves: { position: [3.95, 0, -5.87], rotationY: 0 } as Placement,
    pendants: [-3.0, -1.8, -0.6].map((z) => ({ position: [-1.0, 2.248, z] as Vec3 })) as Placement[], // bottom of the globe; top touches the ceiling
    frames: [
      { position: [4.99, 1.24, -3.1], rotationY: -Math.PI / 2 },
      { position: [4.99, 1.24, 0.3], rotationY: -Math.PI / 2 },
    ] as Placement[],
    plants: [
      // the first five stand on the banquette: their leaves stay clear of the facade frame (decor.test.ts, Task 14)
      { kind: 'succulent', position: [-4.755, 0.42, -4.3], pot: 'cream', r: 0.07, h: 0.08, scale: 1, seed: 5, sway: 0 },
      { kind: 'monstera', position: [-4.705, 0.42, -3.0], pot: 'cream', r: 0.16, h: 0.22, scale: 0.7, seed: 11, sway: 0.006 },
      { kind: 'fern', position: [-4.67, 0.42, -1.2], pot: 'slate', r: 0.13, h: 0.16, scale: 0.95, seed: 23, sway: 0.008 },
      { kind: 'succulent', position: [-4.755, 0.42, -0.4], pot: 'terracotta', r: 0.06, h: 0.07, scale: 1, seed: 9, sway: 0 },
      { kind: 'pothos', position: [-4.755, 0.42, 0.5], pot: 'terracotta', r: 0.1, h: 0.12, scale: 1, seed: 31, sway: 0.01, fall: Math.PI / 2 },
      // the palm left its old place, where it hid part of the retro corner from the overview
      { kind: 'palm', position: [4.45, 0, -2.9], pot: 'slate', r: 0.2, h: 0.32, scale: 0.9, seed: 41, sway: 0.006 },
      { kind: 'herb', position: [3.45, 1.775, -5.87], pot: 'terracotta', r: 0.06, h: 0.08, scale: 1, seed: 47, sway: 0 },
      { kind: 'pothos', position: [4.5, 1.775, -5.87], pot: 'cream', r: 0.07, h: 0.09, scale: 0.8, seed: 53, sway: 0.008, fall: 0 },
    ] as PlantPlacement[],
    hangingPlants: [
      { position: [-4.25, 3.2, -3.8], seed: 3, glaze: 'white', vines: 11, length: 0.9, drop: 0.55 },
      { position: [-4.25, 3.2, -0.2], seed: 7, glaze: 'sage', vines: 9, length: 0.8, drop: 0.5 },
    ] as HangingPlacement[],
    largePlants: {
      pottedPlant: { position: [-4.4, 0, 1.75], rotationY: 0.6 } as Placement,
      pachira: { position: [-4.45, 0, -5.45], rotationY: 0 } as Placement, // in the clay pot scaled x 1.6, tree 1.55 m tall standing at y 0.325
    },
    vases: [
      { model: 'vaseTall', position: [-3.2, 0.68, -5.62], plant: { kind: 'pothos', r: 0.08, h: 0.1, scale: 0.8, seed: 71, sway: 0.008, fall: 0 } },
      { model: 'vaseRound', position: [-4.74, 0.42, -2.1], plant: { kind: 'fern', r: 0.08, h: 0.1, scale: 0.6, seed: 73, sway: 0.008 } },
    ] as VasePlacement[],
    shelfBooks: [
      { x0: 3.3, x1: 4.6, y: 1.325, z: -5.87, seed: 61 },
      { x0: 3.75, x1: 4.3, y: 1.775, z: -5.87, seed: 67 },
    ] as ShelfBooksSpec[],
  },
  screen: { position: [-1.0, 1.9, -5.93] as Vec3, size: [4.0, 2.25] as [number, number] },
  ada: { position: [-3.15, 1.1, -4.85], rotationY: 0.5 } as Placement,
  lights: {
    hemisphere: { sky: '#FFE6C7', ground: '#1A1512', intensity: 0.5 },
    key: { position: [3, 6, 4] as Vec3, intensity: 1.2, color: '#FFE2BF' },
    fills: [
      { position: [-1.0, 2.95, -2.0] as Vec3, intensity: 8, distance: 9, color: '#FFC98A' },
      { position: [3.6, 2.9, -1.4] as Vec3, intensity: 5, distance: 7, color: '#FFC98A' },
    ],
    screenGlow: { position: [-1.0, 1.9, -5.3] as Vec3, intensity: 1.2, color: '#9FB8C8' },
  },
}

/** Bumped by the tuning panel so the camera rig rebuilds its curves. */
export const layoutVersion = { current: 0 }

export function bumpLayout() {
  layoutVersion.current += 1
}
```

`src/zones/office/footprints.ts` :

```ts
import type { PlantKind } from '../../three/plants/types'
import { BANQUETTE, layout, type Placement, type Vec3 } from './layout'

/*
 * Footprints of everything in the office, as axis-aligned boxes in world space. The layout tests use them to keep
 * sightlines clear (camera -> laptop, camera -> retro corner, presentation view -> wall screen) and every object
 * inside the room. Sizes are generous outer bounds of the real objects, not their exact shapes.
 */

export interface Box {
  name: string
  min: Vec3
  max: Vec3
}

/** Local size [width x, height y, depth z] of each kind of object: origin at the bottom centre, front +z (metres). */
export const SIZES: Record<string, Vec3> = {
  table: [2.5, 0.75, 5.0],
  chair: [0.56, 0.9, 0.56],
  microphone: [0.1, 0.42, 0.22],
  sideboard: [4.88, 0.68, 0.684],
  lamp: [0.28, 0.48, 0.28],
  laptop: [0.34, 0.24, 0.26],
  tvStand: [1.7, 0.5, 0.5],
  tv: [0.4, 0.42, 0.36],
  retroConsole: [0.62, 0.08, 0.3],
  sofa: [2.0, 0.8, 0.9],
  logo: [0.9, 1.116, 0.12], // the backlit sign of Task 10 (plate around the 0.72 x 0.936 m mark), centred vertically on its position
  clock: [0.33, 0.33, 0.05],
  cabinet: [1.15, 1.89, 0.5],
  coffeeTable: [0.6, 0.39, 1.21],
  shelves: [1.4, 1.8, 0.24],
  pendant: [0.44, 0.952, 0.44],
  frame: [0.6, 0.85, 0.02],
  pottedPlant: [0.7, 1.34, 0.7],
  pachira: [1.1, 1.9, 1.1],
  vaseTall: [0.21, 0.41, 0.21],
  vaseRound: [0.19, 0.35, 0.19],
  hangingPlant: [0.5, 1.45, 0.5], // all of it below the ceiling hook
  ada: [0.66, 1.05, 0.5], // from her base at y 1.1 up to 2.15
  // plants, multiplied by their scale
  monstera: [0.95, 0.95, 0.95],
  palm: [1.1, 1.3, 1.1],
  fern: [0.85, 0.6, 0.85],
  pothos: [0.5, 0.45, 0.5],
  succulent: [0.2, 0.15, 0.2],
  herb: [0.25, 0.25, 0.25],
}

/** How far a plant's trailing vines hang below the base of its pot. */
const TRAILING: Partial<Record<PlantKind, number>> = { pothos: 0.6 }

/** World box of an object: x and z swap when it is turned a quarter; `below` extends the box downward (hanging plants, trailing vines). */
export function boxFor(name: string, placement: Placement, size: Vec3, options: { below?: number } = {}): Box {
  const [x, y, z] = placement.position
  const turned = Math.abs(Math.sin(placement.rotationY ?? 0)) > 0.5
  const width = turned ? size[2] : size[0]
  const depth = turned ? size[0] : size[2]
  return {
    name,
    min: [x - width / 2, y - (options.below ?? 0), z - depth / 2],
    max: [x + width / 2, y + size[1], z + depth / 2],
  }
}

/** Every object of the office, by scene name. Recomputed from `layout` on each call (the tuning panel edits it). */
export function sceneBoxes(): Box[] {
  const o = layout.objects
  const boxes: Box[] = [boxFor('table', o.table, SIZES.table)]
  o.chairs.forEach((chair, i) => boxes.push(boxFor(`chair-${i}`, chair, SIZES.chair)))
  o.microphones.forEach((mic, i) => boxes.push(boxFor(`microphone-${i}`, mic, SIZES.microphone)))
  for (const name of ['sideboard', 'lamp', 'laptop', 'tvStand', 'tv', 'retroConsole', 'sofa'] as const) {
    boxes.push(boxFor(name, o[name], SIZES[name]))
  }
  const [lx, ly, lz] = o.logo.position
  boxes.push(boxFor('logo', { position: [lx, ly - SIZES.logo[1] / 2, lz], rotationY: o.logo.rotationY }, SIZES.logo))
  for (const name of ['clock', 'cabinet', 'coffeeTable', 'shelves'] as const) boxes.push(boxFor(name, o[name], SIZES[name]))
  o.pendants.forEach((pendant, i) => boxes.push(boxFor(`pendant-${i}`, pendant, SIZES.pendant)))
  o.frames.forEach((frame, i) => boxes.push(boxFor(`frame-${i}`, frame, SIZES.frame)))
  o.plants.forEach((plant, i) => {
    const [w, h, d] = SIZES[plant.kind]
    const s = plant.scale
    boxes.push(boxFor(`plant-${i}`, plant, [w * s, h * s, d * s], { below: TRAILING[plant.kind] ?? 0 }))
  })
  o.hangingPlants.forEach((hanging, i) => {
    const [w, h, d] = SIZES.hangingPlant
    boxes.push(boxFor(`hangingPlant-${i}`, hanging, [w, 0, d], { below: h }))
  })
  boxes.push(boxFor('pottedPlant', o.largePlants.pottedPlant, SIZES.pottedPlant))
  boxes.push(boxFor('pachira', o.largePlants.pachira, SIZES.pachira))
  o.vases.forEach((vase, i) => boxes.push(boxFor(`vase-${i}`, vase, SIZES[vase.model])))
  boxes.push({ name: 'banquette', min: [BANQUETTE.x0, 0, BANQUETTE.z0], max: [BANQUETTE.x1, BANQUETTE.height, BANQUETTE.z1] })
  boxes.push(boxFor('ada', layout.ada, SIZES.ada))
  return boxes
}

/** Slab test: does the segment a -> b (endpoints included) touch the box? */
export function segmentHitsBox(a: Vec3, b: Vec3, box: Box): boolean {
  let t0 = 0
  let t1 = 1
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k]
    if (Math.abs(d) < 1e-12) {
      if (a[k] < box.min[k] || a[k] > box.max[k]) return false
      continue
    }
    let ta = (box.min[k] - a[k]) / d
    let tb = (box.max[k] - a[k]) / d
    if (ta > tb) [ta, tb] = [tb, ta]
    t0 = Math.max(t0, ta)
    t1 = Math.min(t1, tb)
    if (t0 > t1) return false
  }
  return true
}
```

- [ ] **Step 4: Relancer les tests du plan**

Run: `npx vitest run src/zones/office/footprints.test.ts src/zones/office/layout.test.ts src/zones/office/tune.test.ts src/zones/office/camera/railMath.test.ts`
Expected: PASS — 25 tests (`footprints` 3, l'ancien `layout.test.ts` 5, `tune` 3, `railMath` 14). L'ancien test des chaises passe encore (une chaise hors du plateau ovale l'est aussi du plateau racetrack), et celui de la lampe aussi (x 1,3 − 0,13 > 1,0). `railMath.test.ts` ne change pas : le rail garde trois points, passe par `rail[1]` à t = 0,5 et finit sur la cible de `rail[2]`.

- [ ] **Step 5: Réécrire `src/zones/office/layout.test.ts` (tests qui échouent)**

Les trois tests de l'écran mural restent tels quels ; le test des chaises passe au plateau racetrack (distance au bord du plateau, en forme de capsule) et celui de la lampe aux nouvelles dimensions (rayon 0,14, hauteur 0,48, cadre de l'écran de 3 cm). Les seuils de cadrage sont ceux de la résolution « Seuils de la baie » des Global Constraints (mesure moins une petite marge). Les noms de tests qui portent un caractère non ASCII l'écrivent en échappement `\uXXXX` : le nom affiché reste exactement celui du plan.

```ts
import { PARALLAX, makeRail } from './camera/railMath'
import { SIZES, sceneBoxes, segmentHitsBox, type Box } from './footprints'
import { SCREEN_BANDS, glazingFraction, projectBox, projectPoint } from './framing'
import { GLAZING, ROOM, SLAT_WALL, TABLE, chairRing, layout, tableHalfWidthAt, type Pose, type Vec3 } from './layout'
import { SCREEN_PX, screenDistanceFactor } from './WallScreen3D'

/*
 * Framing thresholds: the measurement minus a small margin (plan, Task 5). 1600 x 900 (16:9) is the reference
 * screen; 1280 x 600 is the smallest supported viewport (spec 1, section 8.6).
 */
const WIDE = 16 / 9
const SMALL = 1280 / 600
const { hudBottom, panelTop } = SCREEN_BANDS
/** The four extremes of the pointer parallax (CameraRig): look target + (+/-PARALLAX.x, -/+PARALLAX.y, 0). */
const EXTREMES: [number, number][] = [
  [PARALLAX.x, PARALLAX.y],
  [PARALLAX.x, -PARALLAX.y],
  [-PARALLAX.x, PARALLAX.y],
  [-PARALLAX.x, -PARALLAX.y],
]

const boxes = sceneBoxes()
function named(name: string): Box {
  const box = boxes.find((b) => b.name === name)
  if (!box) throw new Error(`no box named ${name}`)
  return box
}
const centre = (box: Box): Vec3 => [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2) as Vec3
const corners = (box: Box): Vec3[] =>
  [box.min[0], box.max[0]].flatMap((x) => [box.min[1], box.max[1]].flatMap((y) => [box.min[2], box.max[2]].map((z): Vec3 => [x, y, z])))
const union = (name: string, a: Box, b: Box): Box => ({
  name,
  min: [0, 1, 2].map((k) => Math.min(a.min[k], b.min[k])) as Vec3,
  max: [0, 1, 2].map((k) => Math.max(a.max[k], b.max[k])) as Vec3,
})
/** Names of the boxes, other than `allowed`, that the segment a -> b touches. */
const blockers = (a: Vec3, b: Vec3, allowed: string[]) =>
  boxes.filter((box) => !allowed.includes(box.name) && segmentHitsBox(a, b, box)).map((box) => box.name)
const overview = (): Pose => layout.rail[0]
/** The retro corner: the TV and the console together. */
const retroCorner = () => union('retroCorner', named('tv'), named('retroConsole'))

function expectInFrame(p: { u: number; v: number; inFront: boolean }, u: [number, number], v: [number, number], label: string) {
  expect(p.inFront, label).toBe(true)
  expect(p.u, label).toBeGreaterThanOrEqual(u[0])
  expect(p.u, label).toBeLessThanOrEqual(u[1])
  expect(p.v, label).toBeGreaterThanOrEqual(v[0])
  expect(p.v, label).toBeLessThanOrEqual(v[1])
}

/** Distance from a floor point to the racetrack outline (a 2D capsule around the table's long axis). */
function distanceToTableEdge(x: number, z: number): number {
  const { center, radii } = TABLE
  const straight = radii.z - radii.x
  const nearestZ = Math.min(center.z + straight, Math.max(center.z - straight, z))
  return Math.hypot(x - center.x, z - nearestZ) - radii.x
}

test('eight chairs sit outside the racetrack table, 45 cm clear, and face it', () => {
  const chairs = chairRing()
  expect(chairs).toHaveLength(8)
  for (const chair of chairs) {
    const [x, , z] = chair.position
    expect(distanceToTableEdge(x, z), `chair at ${x}, ${z}`).toBeGreaterThanOrEqual(0.45)
    expect(chair.rotationY).toBe(x < TABLE.center.x ? Math.PI / 2 : -Math.PI / 2)
  }
  expect(chairs.map((c) => +c.position[0].toFixed(4))).toEqual([-2.6225, 0.6225, -2.75, 0.75, -2.75, 0.75, -2.6225, 0.6225])
})

test('the table keeps its 2.5 \u00d7 5 m footprint', () => {
  const { center, radii } = TABLE
  expect(tableHalfWidthAt(center.z)).toBe(1.25)
  expect(tableHalfWidthAt(center.z - 1.25)).toBe(1.25)
  expect(tableHalfWidthAt(center.z + 1.875)).toBeCloseTo(Math.sqrt(1.25 ** 2 - 0.625 ** 2))
  expect(tableHalfWidthAt(center.z + radii.z)).toBe(0)
  expect(tableHalfWidthAt(center.z - radii.z - 0.1)).toBe(0)
  expect(SIZES.table).toEqual([2 * radii.x, TABLE.topY, 2 * radii.z])
  expect(layout.objects.table.position).toEqual([center.x, 0, center.z])
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

test('the lamp stands on the sideboard, clear of the screen', () => {
  const [radius, height] = [SIZES.lamp[0] / 2, SIZES.lamp[1]] // 0.14 and 0.48 m
  const [lx, ly, lz] = layout.objects.lamp.position
  const [bx, by, bz] = layout.objects.sideboard.position
  expect(ly).toBeCloseTo(by + SIZES.sideboard[1])
  expect(lx - radius).toBeGreaterThanOrEqual(bx - SIZES.sideboard[0] / 2)
  expect(lx + radius).toBeLessThanOrEqual(bx + SIZES.sideboard[0] / 2)
  expect(lz).toBeCloseTo(bz)
  // The wall screen and its 3 cm frame (WallScreen3D).
  const [sx, sy] = layout.screen.position
  const [w, h] = [layout.screen.size[0] + 0.03, layout.screen.size[1] + 0.03]
  const outsideX = lx + radius < sx - w / 2 || lx - radius > sx + w / 2
  const outsideY = ly + height < sy - h / 2 || ly > sy + h / 2
  expect(outsideX || outsideY).toBe(true)
})

test('the clock hangs on the back wall, clear of the screen frame and the logo', () => {
  const clock = named('clock')
  const logo = named('logo')
  expect(clock.min[2]).toBeCloseTo(ROOM.z0) // against the plaster
  expect(clock.min[0]).toBeGreaterThan(SLAT_WALL.x1) // beyond the oak slats
  const frameRight = layout.screen.position[0] + (layout.screen.size[0] + 0.03) / 2
  expect(clock.min[0]).toBeGreaterThan(frameRight)
  expect(clock.max[0]).toBeLessThan(logo.min[0])
  expect(clock.max[1]).toBeLessThan(ROOM.height)
})

test('every object stays inside the room', () => {
  const lo = [ROOM.x0, 0, ROOM.z0]
  const hi = [ROOM.x1, ROOM.height, ROOM.z1]
  const inside = (min: number[], max: number[], label: string) => {
    for (let k = 0; k < 3; k++) {
      expect(min[k], `${label} min ${k}`).toBeGreaterThanOrEqual(lo[k] - 1e-9)
      expect(max[k], `${label} max ${k}`).toBeLessThanOrEqual(hi[k] + 1e-9)
    }
  }
  for (const box of boxes) if (!box.name.startsWith('plant-')) inside(box.min, box.max, box.name)
  // Plants are held by their pot: the canopy bounds of the banquette plants (SIZES x scale) lean on the glass,
  // and the pothos trails are a generous bound below the bench top.
  layout.objects.plants.forEach(({ position: [x, y, z], r, h }, i) => inside([x - r, y, z - r], [x + r, y + h, z + r], `plant-${i} pot`))
})

// Spec criterion 3 (amended): the most glazing compatible with the retro corner; measured 13.9 % (16:9) and 16.3 % (1280 x 600),
// 12.3 % and 14.7 % at the worst parallax extreme.
test('the overview shows as much glazing as the retro corner allows', () => {
  expect(glazingFraction(overview(), WIDE).total).toBeGreaterThanOrEqual(0.135)
  expect(glazingFraction(overview(), SMALL).total).toBeGreaterThanOrEqual(0.155)
  for (const parallax of EXTREMES) {
    expect(glazingFraction(overview(), WIDE, { parallax }).total, `16:9 ${parallax}`).toBeGreaterThanOrEqual(0.12)
    expect(glazingFraction(overview(), SMALL, { parallax }).total, `1280 x 600 ${parallax}`).toBeGreaterThanOrEqual(0.14)
  }
  // The exact share (clipped projection of the glass rectangles) agrees with a count of rays.
  const counted = glazingFraction(overview(), WIDE, { samples: 400 })
  expect(Math.abs(counted.total - glazingFraction(overview(), WIDE).total)).toBeLessThan(0.004)
})

// Review focus 5: the whole TV and console, clear of the HUD and the welcome panel, seen from every pointer position.
test('the overview keeps the retro corner in frame', () => {
  const corner = retroCorner()
  const atRest = projectBox(overview(), WIDE, corner)
  expect(atRest.u0).toBeGreaterThanOrEqual(0.02)
  expect(atRest.u1).toBeLessThanOrEqual(0.99)
  expect(atRest.v0).toBeGreaterThanOrEqual(hudBottom)
  expect(atRest.v1).toBeLessThanOrEqual(panelTop)
  expect((atRest.v1 - atRest.v0) * 900).toBeGreaterThanOrEqual(100)
  const small = projectBox(overview(), SMALL, corner)
  expect((small.v1 - small.v0) * 600).toBeGreaterThanOrEqual(60)
  for (const parallax of EXTREMES) {
    expectInFrame(projectPoint(overview(), WIDE, centre(corner), parallax), [0.01, 0.98], [hudBottom, panelTop], `parallax ${parallax}`)
  }
  for (const point of [centre(corner), ...corners(corner)]) {
    expect(blockers(overview().position, point, ['tv', 'retroConsole', 'tvStand']), `sightline to ${point}`).toEqual([])
  }
})

test('the TV picture faces the overview camera', () => {
  const { position, rotationY = 0 } = layout.objects.tv
  const normal: Vec3 = [Math.sin(rotationY), 0, Math.cos(rotationY)]
  // Front face of the normalised television_02 model (0.35 m deep), at the height of its picture.
  const picture: Vec3 = [position[0] + normal[0] * 0.175, position[1] + 0.235, position[2] + normal[2] * 0.175]
  const toCamera = overview().position.map((c, k) => c - picture[k])
  const cos = toCamera.reduce((sum, d, k) => sum + d * normal[k], 0) / Math.hypot(...toCamera)
  expect((Math.acos(cos) * 180) / Math.PI).toBeLessThanOrEqual(73)
})

test('the wall screen and Ada stay in the overview', () => {
  expectInFrame(projectPoint(overview(), WIDE, layout.screen.position), [0.05, 0.95], [hudBottom, panelTop], 'wall screen')
  expectInFrame(projectPoint(overview(), WIDE, centre(named('ada'))), [0.05, 0.95], [hudBottom, panelTop], 'Ada')
})

// Spec section 3, "Contrainte": nothing hides the laptop in the overview.
test('nothing stands between the overview camera and the laptop', () => {
  expect(blockers(overview().position, centre(named('laptop')), ['laptop', 'table'])).toEqual([])
})

// Review focus 5: the e2e hover aims at this point (about 537 x 509 px at 1600 x 900).
test('the laptop stays clear of the HUD and the welcome panel', () => {
  const laptop = centre(named('laptop'))
  expectInFrame(projectPoint(overview(), WIDE, laptop), [0.2, 0.8], [hudBottom, 0.7], 'at rest')
  for (const parallax of EXTREMES) {
    expectInFrame(projectPoint(overview(), WIDE, laptop, parallax), [0.05, 0.95], [hudBottom, panelTop], `parallax ${parallax}`)
  }
})

test('the city opens up along the rail', () => {
  const middle = makeRail(layout.rail)(0.5)
  const pose: Pose = { position: middle.position.toArray() as Vec3, target: middle.target.toArray() as Vec3 }
  expect(glazingFraction(pose, WIDE).total).toBeGreaterThan(glazingFraction(overview(), WIDE).total + 0.05)
})

test('the city shows behind Ada in the presentation view', () => {
  const presentation = layout.rail[2]
  expect(glazingFraction(presentation, WIDE).back).toBeGreaterThanOrEqual(0.17)
  // The line of sight to Ada's head (0.84 m above her base), carried on to the back wall, lands in the glass return.
  const head: Vec3 = [layout.ada.position[0], layout.ada.position[1] + 0.84, layout.ada.position[2]]
  const [cx, cy, cz] = presentation.position
  const t = (GLAZING.back.z - cz) / (head[2] - cz)
  const x = cx + (head[0] - cx) * t
  const y = cy + (head[1] - cy) * t
  expect(x).toBeGreaterThanOrEqual(GLAZING.back.x0)
  expect(x).toBeLessThanOrEqual(GLAZING.back.x1)
  expect(y).toBeGreaterThanOrEqual(0)
  expect(y).toBeLessThanOrEqual(ROOM.height)
})

test('nothing hides the wall screen in the presentation view', () => {
  // The useful area of the screen, inset from its edges (the microphone heads already bite its bottom 6 cm in spec 1).
  const from = layout.rail[2].position
  const z = layout.screen.position[2]
  for (const x of [-2.8, -1.9, -1.0, -0.1, 0.8]) {
    for (const y of [0.95, 1.9, 2.85]) expect(blockers(from, [x, y, z], []), `screen point ${x}, ${y}`).toEqual([])
  }
})
```

- [ ] **Step 6: Lancer le test pour le voir échouer**

Run: `npx vitest run src/zones/office/layout.test.ts`
Expected: FAIL — `Error: Failed to resolve import "./framing" from "src/zones/office/layout.test.ts". Does the file exist?`

- [ ] **Step 7: Exporter `PARALLAX` depuis `railMath.ts` et créer `src/zones/office/framing.ts`**

Dans `src/zones/office/camera/railMath.ts`, remplacer exactement la ligne

```ts
export const RAIL_SMOOTH_TIME = 0.35
```

par

```ts
export const RAIL_SMOOTH_TIME = 0.35
/** Pointer parallax: the look target moves up to x sideways and y up or down (CameraRig; the framing tests use the extremes). */
export const PARALLAX = { x: 0.35, y: 0.18 }
```

Dans `src/zones/office/camera/CameraRig.tsx`, remplacer exactement le bloc

```ts
import {
  FLIGHT_SECONDS,
  RAIL_SMOOTH_TIME,
```

par

```ts
import {
  FLIGHT_SECONDS,
  PARALLAX,
  RAIL_SMOOTH_TIME,
```

puis remplacer exactement le bloc

```ts
const PARALLAX = { x: 0.35, y: 0.18 }

export function CameraRig() {
```

par

```ts
export function CameraRig() {
```

`src/zones/office/framing.ts` (projection et découpage repris des scripts de mesure `.superpowers/scratch-framing/lib.mjs`) :

```ts
import { PerspectiveCamera, Vector3 } from 'three'
import type { Box } from './footprints'
import { CAMERA, GLAZING, ROOM, type Pose, type Vec3 } from './layout'

/*
 * What a camera pose shows: the share of the frame covered by the glazing, and where points and boxes land on screen.
 * The layout tests use it to hold the measured framing of spec criterion 3. Same method as the measurements that chose
 * the rail (plan, Task 5): the camera of Stage.tsx (CAMERA), looking at the pose target, shifted by the pointer
 * parallax when asked; the glazing share is exact, by clipping the projected glass rectangles.
 */

export interface GlazingShare {
  /** Fraction of the frame covered by glazing (side facade and back return). */
  total: number
  /** The part of it on the back return, behind Ada. */
  back: number
}

/** Screen bands kept free by the DOM at 1600 x 900: HUD on top (~70 px), welcome / dialogue panel at the bottom (~200 px). */
export const SCREEN_BANDS = { hudBottom: 0.08, panelTop: 0.77 } as const

/** The office camera at a pose; parallax shifts the target like CameraRig: (+x, -y). */
function poseCamera(pose: Pose, aspect: number, parallax: [number, number] = [0, 0]): PerspectiveCamera {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far)
  camera.position.set(...pose.position)
  camera.lookAt(pose.target[0] + parallax[0], pose.target[1] - parallax[1], pose.target[2])
  camera.updateMatrixWorld()
  return camera
}

const H = ROOM.height
const { side, back } = GLAZING
const SIDE_GLASS: Vec3[] = [
  [side.x, 0, side.z0],
  [side.x, 0, side.z1],
  [side.x, H, side.z1],
  [side.x, H, side.z0],
]
const BACK_GLASS: Vec3[] = [
  [back.x0, 0, back.z],
  [back.x1, 0, back.z],
  [back.x1, H, back.z],
  [back.x0, H, back.z],
]

type Point2 = { x: number; y: number }

/** Keeps the part of a polygon (camera space) in front of the near plane (the camera looks down -z). */
function clipNear(points: Vector3[], near: number): Vector3[] {
  const out: Vector3[] = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    const aIn = a.z <= -near
    const bIn = b.z <= -near
    if (aIn) out.push(a)
    if (aIn !== bIn) out.push(a.clone().lerp(b, (-near - a.z) / (b.z - a.z)))
  })
  return out
}

/** Keeps the part of a 2D polygon on one side of a line x = value or y = value. */
function clipEdge(points: Point2[], axis: 'x' | 'y', value: number, keepBelow: boolean): Point2[] {
  const inside = (p: Point2) => (keepBelow ? p[axis] <= value : p[axis] >= value)
  const out: Point2[] = []
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    if (inside(a)) out.push(a)
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis])
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  })
  return out
}

function area(points: Point2[]): number {
  let sum = 0
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  })
  return Math.abs(sum) / 2
}

/**
 * Exact fraction of the frame covered by a planar quad: clipped by the near plane, projected, clipped by the frame,
 * then measured. The inner faces of a convex room never hide one another, so this is what the camera sees of them.
 */
function screenShare(camera: PerspectiveCamera, quad: readonly Vec3[]): number {
  const inCamera = clipNear(quad.map((p) => new Vector3(...p).applyMatrix4(camera.matrixWorldInverse)), camera.near)
  if (inCamera.length < 3) return 0
  let polygon: Point2[] = inCamera.map((p) => {
    const ndc = p.clone().applyMatrix4(camera.projectionMatrix)
    return { x: ndc.x, y: ndc.y }
  })
  const edges: [axis: 'x' | 'y', value: number, keepBelow: boolean][] = [
    ['x', 1, true],
    ['x', -1, false],
    ['y', 1, true],
    ['y', -1, false],
  ]
  for (const [axis, value, keepBelow] of edges) {
    polygon = clipEdge(polygon, axis, value, keepBelow)
    if (polygon.length < 3) return 0
  }
  return area(polygon) / 4 // the frame spans 2 x 2 in normalised device coordinates
}

/** Estimate by counting rays: each ray's first hit on the six inner planes of the room (a cross-check of screenShare). */
function countRays(camera: PerspectiveCamera, aspect: number, samples: number): GlazingShare {
  const rows = Math.round(samples / aspect)
  const origin = camera.position
  const direction = new Vector3()
  let sideHits = 0
  let backHits = 0
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < samples; i++) {
      direction.set(((i + 0.5) / samples) * 2 - 1, 1 - ((j + 0.5) / rows) * 2, 0.5).unproject(camera).sub(origin).normalize()
      const tx = direction.x < 0 ? (ROOM.x0 - origin.x) / direction.x : (ROOM.x1 - origin.x) / direction.x
      const ty = direction.y < 0 ? -origin.y / direction.y : (ROOM.height - origin.y) / direction.y
      const tz = direction.z < 0 ? (ROOM.z0 - origin.z) / direction.z : (ROOM.z1 - origin.z) / direction.z
      const t = Math.min(tx, ty, tz)
      if (t === tx && direction.x < 0 && origin.z + t * direction.z <= side.z1) sideHits++
      else if (t === tz && direction.z < 0 && origin.x + t * direction.x <= back.x1) backHits++
    }
  }
  const count = samples * rows
  return { total: (sideHits + backHits) / count, back: backHits / count }
}

/**
 * Share of the frame covered by the glazing, seen from `pose` in a frame of the given aspect (width / height).
 * Exact by default; with `samples`, a count of samples x round(samples / aspect) rays instead.
 * `parallax` shifts the look target by (parallax[0], -parallax[1], 0), as the pointer does in CameraRig.
 */
export function glazingFraction(pose: Pose, aspect: number, options: { samples?: number; parallax?: [number, number] } = {}): GlazingShare {
  const camera = poseCamera(pose, aspect, options.parallax)
  if (options.samples) return countRays(camera, aspect, options.samples)
  const sideShare = screenShare(camera, SIDE_GLASS)
  const backShare = screenShare(camera, BACK_GLASS)
  return { total: sideShare + backShare, back: backShare }
}

/** Where a world point lands in the frame: u, v in 0..1 from the top-left; inFront when it is between the near and far planes. */
export function projectPoint(pose: Pose, aspect: number, point: Vec3, parallax?: [number, number]): { u: number; v: number; inFront: boolean } {
  const ndc = new Vector3(...point).project(poseCamera(pose, aspect, parallax))
  return { u: (ndc.x + 1) / 2, v: (1 - ndc.y) / 2, inFront: ndc.z > -1 && ndc.z < 1 }
}

/** Screen extent of a box: the bounds of its 8 projected corners. */
export function projectBox(pose: Pose, aspect: number, box: Box): { u0: number; u1: number; v0: number; v1: number } {
  const extent = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity }
  for (const x of [box.min[0], box.max[0]]) {
    for (const y of [box.min[1], box.max[1]]) {
      for (const z of [box.min[2], box.max[2]]) {
        const { u, v } = projectPoint(pose, aspect, [x, y, z])
        extent.u0 = Math.min(extent.u0, u)
        extent.u1 = Math.max(extent.u1, u)
        extent.v0 = Math.min(extent.v0, v)
        extent.v1 = Math.max(extent.v1, v)
      }
    }
  }
  return extent
}
```

- [ ] **Step 8: Relancer les tests du cadrage**

Run: `npx vitest run src/zones/office/layout.test.ts src/zones/office/camera`
Expected: PASS — `layout.test.ts` 17 tests, `railMath.test.ts` 14 tests ; sortie sans avertissement.

- [ ] **Step 9: Réglage, pièce et scène : `tune.ts`, `Room.tsx`, `OfficeScene.tsx`**

Dans `src/zones/office/tune.ts`, remplacer exactement la ligne

```ts
export const TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'cabinet', 'tv', 'retroConsole', 'sofa', 'logo'] as const
```

par

```ts
export const TUNABLE = ['ada', 'screen', 'table', 'sideboard', 'lamp', 'laptop', 'tvStand', 'tv', 'retroConsole', 'sofa', 'logo', 'clock', 'cabinet', 'coffeeTable', 'shelves'] as const
```

(`applyTransform` reste valable : chaque entrée de `layout.objects` nommée dans `TUNABLE` est un `Placement`. Le panneau `?tune` ne trouve pas encore `clock`, `cabinet`, `coffeeTable` ni `shelves` dans la scène, il n'affiche alors aucune poignée, comme aujourd'hui pour un nom absent.)

Dans `src/zones/office/Room.tsx`, remplacer exactement le bloc

```tsx
import { materials } from '../../three/materials'

export const ROOM = { width: 10, depth: 12, height: 3.2 }
```

par

```tsx
import { materials } from '../../three/materials'
import { ROOM } from './layout'
```

Dans `src/zones/office/OfficeScene.tsx`, remplacer exactement la ligne

```tsx
  const { table, chairs, microphones, sideboard, lamp, laptop, cabinet, tv, retroConsole, sofa, logo } = layout.objects
```

par

```tsx
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo } = layout.objects
```

puis la ligne

```tsx
      <SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} />
```

par

```tsx
      <SceneObject object="cabinet" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
```

Run: `npm run typecheck`
Expected: PASS.

Run: `npx vitest run src/zones/office`
Expected: PASS (dont `footprints` 3, `layout` 17, `tune` 3, `railMath` 14, `presets` 5) ; sortie sans avertissement.

- [ ] **Step 10: Vérifier le projet**

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » quasi inchangé (≈ 0,5 MB, budget 1,50 MB) ; `No test API (__academy) in the production JS`.

- [ ] **Step 11: Vérifier le survol réel du laptop en vue d'ensemble (e2e)**

Run: `npx playwright test tests/e2e/office.spec.ts -g "laptop"`
Expected: PASS — « the real 3D laptop and the TV lead to their zones and back » : le centre projeté du laptop est vers (537 ; 509) px en 1600 × 900, hors du HUD et du panneau d'accueil (mesuré à (534 ; 507) par `screenPosition` dans le scratch du plan).

Les tests e2e réécrivent des captures de `docs/evidence/office/` (ici `03-hover-laptop.png`, `04-workshop-soon.png`, `10-dungeon-soon.png`). Elles ne se commitent pas avant la Tâche 15, qui les régénère toutes :

Run: `git checkout -- docs/evidence/office`
Expected: `git status --short docs/evidence` n'affiche plus rien.

- [ ] **Step 12: Captures de revue**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-5`
Expected: `saved .superpowers\review-shots\task-5\day-overview.png` puis `saved .superpowers\review-shots\task-5\day-presentation.png`, code de sortie 0.

Ce que le contrôleur regarde : la salle est encore l'ancienne (petite fenêtre, rideaux), seul le cadrage change. Dans `day-overview.png`, le coin rétro (télé et console) est entier dans le quart droit, vers x 1410…1570 px, y 475…600 px ; le laptop est dégagé vers (537 ; 509) ; l'écran mural et Ada sont dans le haut du cadre ; rien du HUD ni du panneau d'accueil ne couvre le laptop ni la télé. Attendu et provisoire : le pied de la lampe s'enfonce de 4,5 cm dans l'ancien buffet procédural (0,725 m de haut ; le modèle de 0,68 m arrive en Tâche 11). `day-presentation.png` ne change presque pas par rapport à la Tâche 4 (buffet et lampe avancés de 10 cm).

- [ ] **Step 13: Commit**

```bash
git add src/three/plants/types.ts src/zones/office/layout.ts src/zones/office/layout.test.ts src/zones/office/footprints.ts src/zones/office/footprints.test.ts src/zones/office/framing.ts src/zones/office/tune.ts src/zones/office/camera/railMath.ts src/zones/office/camera/CameraRig.tsx src/zones/office/Room.tsx src/zones/office/OfficeScene.tsx
git commit -m "feat: room plan for the redesign: glazing, rail toward the facade, racetrack table, decor placements and framing tests

The overview keeps the retro corner in frame with 13.9 % glazing (16:9), the city opens up along the rail (25.7 %)
and shows behind Ada in the presentation view (18.4 %).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: La pièce et la baie vitrée

**Files:**
- Create: `src/zones/office/room/plan.ts`, `src/zones/office/room/Glazing.tsx`
- Modify: `src/zones/office/Room.tsx` (réécriture), `src/zones/office/OfficeScene.tsx` (état de la Tâche 6)
- Test: `src/zones/office/room/plan.test.ts`

**Interfaces:**
- Consumes (Tâche 4) : `useMaterials(): Materials`, `buildMaterials(sets: TextureSets)`, `type MaterialKey` (`src/three/materials.ts`) ; `metreUVs(geometry, options?: { offset?: [number, number]; swap?: boolean })` (`src/three/uv.ts`) ; `mergeParts(parts: readonly Part[]): BufferGeometry`, `at(x, y, z, rotation?, scale?): Matrix4` (`src/three/merge.ts`) ; `TEXTURE_SET_IDS` (`src/three/assets.ts`, Tâche 2) ; `type TextureSets` (`src/three/textures.ts`). (Tâche 5) : `ROOM`, `WALL_T`, `GLAZING`, `BANQUETTE`, `SLAT_WALL`, `RUG`, `CONTACT_SHADOW_Y`, `CEILING_LINES`, `SKIRTING`, `layout`, `Vec3`.
- Produces (`src/zones/office/room/plan.ts`, données pures) : `interface BoxSpec { name: string; center: Vec3; size: Vec3; material: MaterialKey; castShadow: boolean; receiveShadow: boolean }` ; `interface PaneSpec { name: string; center: Vec3; size: [number, number]; rotationY: number }` ; `shellBoxes(): BoxSpec[]` (`floor`, `ceiling`, `wall-back`, `wall-right`, `wall-front`, `wall-left`, `skirting-back|right|front|left`) ; `glazingFrameBoxes(): BoxSpec[]` (`post-corner`, `post-side-0`…`post-side-7`, `post-side-end`, `post-back-0`, `post-back-end`, `transom-side`, `transom-back`) ; `glassPanes(): PaneSpec[]` (`glass-side`, `glass-back`) ; `slatBoxes(): BoxSpec[]` (`slat-0`…`slat-77`) ; `banquetteBoxes(): BoxSpec[]` ; `ceilingLineBoxes(): BoxSpec[]` (`ceiling-channel-i`, `ceiling-strip-i`) ; `rugBox(): BoxSpec` ; `FLAT_LEVELS: readonly { name: string; y: number }[]` (sol 0, tapis 0,012, ombres de contact 0,02). Boîtes exactes : celles du code du Step 3, vérifiées par `plan.test.ts`.
- Produces (`src/zones/office/room/Glazing.tsx`) : `Glazing()` (groupe `glazing` : cadre en blackMetal qui porte et reçoit les ombres, verre `m.glass` sans ombre) ; `PlanBox({ spec, material }: { spec: BoxSpec; material: Material })` (une boîte du plan, UV en mètres).
- Produces (`src/zones/office/Room.tsx`) : `Room()` (groupe `room` : coques, banquette, lignes de plafond, tapis, mur de tasseaux fusionné en un maillage `slat-wall`, `<Glazing />`). Plus aucun appel à l'ancienne fonction `materials()`.

Les murs, le sol et le plafond sont des boîtes de 20 cm qui portent et reçoivent les ombres (le soleil de la Tâche 7 entre seulement par la baie) ; le verre n'a pas d'ombre ; rien de plat ne partage une hauteur (règle Horn.os). Le verre du retour s'arrête à x = −3,4, à gauche de l'écran mural : aucun objet transparent ne passe devant le trou de l'écran DOM. Tant que le dehors n'existe pas (Tâche 8), la baie montre le fond uni `brand.ink` ; l'éclairage reste l'ancien jusqu'à la Tâche 7.

- [ ] **Step 1: Écrire le test qui échoue `src/zones/office/room/plan.test.ts`**

```ts
import { Texture } from 'three'
import { TEXTURE_SET_IDS } from '../../../three/assets'
import { buildMaterials } from '../../../three/materials'
import type { TextureSets } from '../../../three/textures'
import { CONTACT_SHADOW_Y, GLAZING, ROOM, RUG, SLAT_WALL, WALL_T, layout, type Vec3 } from '../layout'
import {
  FLAT_LEVELS,
  banquetteBoxes,
  ceilingLineBoxes,
  glassPanes,
  glazingFrameBoxes,
  rugBox,
  shellBoxes,
  slatBoxes,
  type BoxSpec,
  type PaneSpec,
} from './plan'

const contains = (box: BoxSpec, p: Vec3) => [0, 1, 2].every((k) => Math.abs(p[k] - box.center[k]) <= box.size[k] / 2 + 1e-9)
/** Is p on the pane (within 5 cm of its plane)? Its width runs along x before it turns by rotationY. */
function onPane(pane: PaneSpec, p: Vec3): boolean {
  const dx = p[0] - pane.center[0]
  const dz = p[2] - pane.center[2]
  const along = dx * Math.cos(pane.rotationY) - dz * Math.sin(pane.rotationY)
  const across = dx * Math.sin(pane.rotationY) + dz * Math.cos(pane.rotationY)
  return Math.abs(along) <= pane.size[0] / 2 + 1e-9 && Math.abs(p[1] - pane.center[1]) <= pane.size[1] / 2 + 1e-9 && Math.abs(across) < 0.05
}
/** Midpoints of 10 cm steps between a and b. */
const steps = (a: number, b: number) => Array.from({ length: Math.round((b - a) * 10) }, (_, i) => a + (i + 0.5) / 10)
const top = (box: BoxSpec) => box.center[1] + box.size[1] / 2
const bottom = (box: BoxSpec) => box.center[1] - box.size[1] / 2

test('walls leave the glazing open and close everything else', () => {
  const walls = shellBoxes().filter((b) => b.name.startsWith('wall-'))
  const panes = glassPanes()
  const inWall = (p: Vec3) => walls.some((w) => contains(w, p))
  const onGlass = (p: Vec3) => panes.some((pane) => onPane(pane, p))
  for (const wall of walls) expect(Math.min(...wall.size), wall.name).toBeCloseTo(WALL_T)
  for (const y of [0.1, ROOM.height / 2, ROOM.height - 0.1]) {
    for (const z of steps(ROOM.z0, ROOM.z1)) {
      const glazed = z < GLAZING.side.z1
      expect(inWall([ROOM.x0 - WALL_T / 2, y, z]), `left wall at z ${z}`).toBe(!glazed)
      expect(onGlass([ROOM.x0 - GLAZING.glassInset, y, z]), `side glass at z ${z}`).toBe(glazed)
      expect(inWall([ROOM.x1 + WALL_T / 2, y, z]), `right wall at z ${z}`).toBe(true)
    }
    for (const x of steps(ROOM.x0, ROOM.x1)) {
      const glazed = x < GLAZING.back.x1
      expect(inWall([x, y, ROOM.z0 - WALL_T / 2]), `back wall at x ${x}`).toBe(!glazed)
      expect(onGlass([x, y, ROOM.z0 - GLAZING.glassInset]), `back glass at x ${x}`).toBe(glazed)
      expect(inWall([x, y, ROOM.z1 + WALL_T / 2]), `front wall at x ${x}`).toBe(true)
    }
  }
  const floor = shellBoxes().find((b) => b.name === 'floor')!
  const ceiling = shellBoxes().find((b) => b.name === 'ceiling')!
  expect(top(floor)).toBe(0)
  expect(bottom(ceiling)).toBeCloseTo(ROOM.height)
  for (const x of [ROOM.x0 - 0.1, 0, ROOM.x1 + 0.1]) {
    for (const z of [ROOM.z0 - 0.1, 0, ROOM.z1 + 0.1]) {
      expect(contains(floor, [x, -0.05, z])).toBe(true)
      expect(contains(ceiling, [x, ROOM.height + 0.05, z])).toBe(true)
    }
  }
})

test('mullions stand at most 1.25 m apart along the fa\u00e7ade and the return', () => {
  const posts = glazingFrameBoxes().filter((b) => b.name.startsWith('post-'))
  const along = (values: number[]) => [...values].sort((a, b) => a - b)
  const sideZ = along(posts.filter((p) => p.center[0] === GLAZING.side.x).map((p) => p.center[2]))
  const backX = along(posts.filter((p) => p.center[2] === GLAZING.back.z).map((p) => p.center[0]))
  for (const [run, values, start, end] of [
    ['facade', sideZ, GLAZING.side.z0, GLAZING.side.z1],
    ['return', backX, GLAZING.back.x0, GLAZING.back.x1],
  ] as const) {
    expect(values[0], run).toBe(start)
    expect(end - values[values.length - 1], run).toBeLessThan(0.05)
    for (let i = 1; i < values.length; i++) expect(values[i] - values[i - 1], `${run} gap ${i}`).toBeLessThanOrEqual(1.25 + 1e-9)
  }
  for (const post of posts) expect(post.size[1], post.name).toBe(ROOM.height)
  const transoms = glazingFrameBoxes().filter((b) => b.name.startsWith('transom-'))
  expect(transoms.map((t) => t.center[1])).toEqual([GLAZING.transomY, GLAZING.transomY])
})

test('slats cover the wall behind the screen and stop before the glass', () => {
  const slats = slatBoxes()
  expect(slats).toHaveLength(78)
  const left = Math.min(...slats.map((s) => s.center[0] - s.size[0] / 2))
  const right = Math.max(...slats.map((s) => s.center[0] + s.size[0] / 2))
  expect(left).toBeCloseTo(SLAT_WALL.x0)
  expect(right).toBeLessThanOrEqual(SLAT_WALL.x1 + 1e-9)
  // Wider than the wall screen and its 3 cm frame...
  const [sx] = layout.screen.position
  const half = (layout.screen.size[0] + 0.03) / 2
  expect(left).toBeLessThan(sx - half)
  expect(right).toBeGreaterThan(sx + half)
  // ...but clear of the end post of the glass return.
  const endPost = glazingFrameBoxes().find((b) => b.name === 'post-back-end')!
  expect(left).toBeGreaterThan(endPost.center[0] + endPost.size[0] / 2)
  for (const slat of slats) {
    expect(slat.center[2] - slat.size[2] / 2, slat.name).toBeCloseTo(ROOM.z0) // against the wall
    expect(slat.center[2] + slat.size[2] / 2, slat.name).toBeLessThan(layout.screen.position[2] - 0.03) // behind the screen frame
    expect(slat.size[1], slat.name).toBe(ROOM.height)
  }
})

test('nothing laid flat shares a height', () => {
  const levels = FLAT_LEVELS.map((level) => level.y).sort((a, b) => a - b)
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeGreaterThanOrEqual(0.005)
  const rug = rugBox()
  expect(bottom(rug)).toBeCloseTo(0)
  expect(top(rug)).toBeCloseTo(RUG.thickness)
  expect(FLAT_LEVELS.map((level) => level.y)).toEqual([0, RUG.thickness, CONTACT_SHADOW_Y])
  expect(top(shellBoxes().find((b) => b.name === 'floor')!)).toBe(0)
})

test('the ceiling lines sit just under the ceiling, inside the room', () => {
  const lines = ceilingLineBoxes()
  expect(lines).toHaveLength(4)
  for (const line of lines) {
    expect(top(line), line.name).toBeLessThanOrEqual(ROOM.height + 1e-9)
    expect(top(line), line.name).toBeGreaterThan(ROOM.height - 0.02)
    expect(line.castShadow, line.name).toBe(false)
    for (const k of [0, 2] as const) {
      const lo = k === 0 ? ROOM.x0 : ROOM.z0
      const hi = k === 0 ? ROOM.x1 : ROOM.z1
      expect(line.center[k] - line.size[k] / 2, line.name).toBeGreaterThan(lo)
      expect(line.center[k] + line.size[k] / 2, line.name).toBeLessThan(hi)
    }
  }
  for (const i of [0, 1]) {
    const channel = lines.find((b) => b.name === `ceiling-channel-${i}`)!
    const strip = lines.find((b) => b.name === `ceiling-strip-${i}`)!
    expect(bottom(strip)).toBeLessThan(bottom(channel)) // the glowing strip shows below its channel
    expect(strip.size[0]).toBeLessThan(channel.size[0])
    expect(strip.material).toBe('ceilingStrip')
  }
})

test('every box uses a shared material key', () => {
  const sets = {} as TextureSets
  for (const id of TEXTURE_SET_IDS) sets[id] = { color: new Texture(), normal: new Texture(), arm: new Texture() }
  const keys = Object.keys(buildMaterials(sets))
  const all = [...shellBoxes(), ...glazingFrameBoxes(), ...slatBoxes(), ...banquetteBoxes(), ...ceilingLineBoxes(), rugBox()]
  for (const box of all) expect(keys, box.name).toContain(box.material)
  expect(new Set(all.map((b) => b.name)).size).toBe(all.length)
  expect(shellBoxes().filter((b) => b.name.startsWith('wall-')).every((b) => b.material === 'wall' && b.castShadow && b.receiveShadow)).toBe(true)
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/zones/office/room/plan.test.ts`
Expected: FAIL — `Error: Failed to resolve import "./plan" from "src/zones/office/room/plan.test.ts". Does the file exist?`

- [ ] **Step 3: Créer `src/zones/office/room/plan.ts`**

Les boîtes se calculent à partir des constantes de `layout.ts` ; elles donnent exactement les boîtes attendues (par exemple `wall-back` centre (0,9 ; 1,6 ; −6,1), taille (8,6 ; 3,2 ; 0,2) ; `post-side-end` en z = 4,375 ; 78 tasseaux).

```ts
import type { MaterialKey } from '../../../three/materials'
import {
  BANQUETTE,
  CEILING_LINES,
  CONTACT_SHADOW_Y,
  GLAZING,
  ROOM,
  RUG,
  SKIRTING,
  SLAT_WALL,
  WALL_T,
  type Vec3,
} from '../layout'

/*
 * The room as boxes: slabs, walls, skirting, glazing frame, slats, banquette, ceiling lines and rug. Pure data
 * (Room.tsx and Glazing.tsx turn it into meshes), so the tests can check that walls close the room, that the glazing
 * stays open and that nothing flat shares a height with something else (Horn.os rule: no coplanar surfaces).
 */

export interface BoxSpec {
  name: string
  center: Vec3
  size: Vec3
  material: MaterialKey
  castShadow: boolean
  receiveShadow: boolean
}

/** A glass pane: a plane of `size` [width, height], turned by rotationY (its width runs along x before turning). */
export interface PaneSpec {
  name: string
  center: Vec3
  size: [number, number]
  rotationY: number
}

const H = ROOM.height
const MID = H / 2

const box = (name: string, center: Vec3, size: Vec3, material: MaterialKey, castShadow = true, receiveShadow = true): BoxSpec => ({
  name,
  center,
  size,
  material,
  castShadow,
  receiveShadow,
})

/** Floor and ceiling slabs, the four walls (open where the glazing is) and the skirting. */
export function shellBoxes(): BoxSpec[] {
  const t = WALL_T
  const outerW = ROOM.width + 2 * t
  const outerD = ROOM.depth + 2 * t
  const backX0 = GLAZING.back.x1 // the back wall starts where the glass return ends
  const leftZ0 = GLAZING.side.z1 // the left wall starts where the facade glazing ends
  const k = SKIRTING.height
  const s = SKIRTING.depth
  return [
    box('floor', [0, -t / 4, 0], [outerW, t / 2, outerD], 'floor', false, true),
    box('ceiling', [0, H + t / 4, 0], [outerW, t / 2, outerD], 'ceiling'),
    box('wall-back', [(backX0 + ROOM.x1 + t) / 2, MID, ROOM.z0 - t / 2], [ROOM.x1 + t - backX0, H, t], 'wall'),
    box('wall-right', [ROOM.x1 + t / 2, MID, 0], [t, H, outerD], 'wall'),
    box('wall-front', [0, MID, ROOM.z1 + t / 2], [outerW, H, t], 'wall'),
    box('wall-left', [ROOM.x0 - t / 2, MID, (leftZ0 + ROOM.z1 + t) / 2], [t, H, ROOM.z1 + t - leftZ0], 'wall'),
    box('skirting-back', [(backX0 + ROOM.x1) / 2, k / 2, ROOM.z0 + s / 2], [ROOM.x1 - backX0, k, s], 'skirting', false, true),
    box('skirting-right', [ROOM.x1 - s / 2, k / 2, 0], [s, k, ROOM.depth], 'skirting', false, true),
    box('skirting-front', [0, k / 2, ROOM.z1 - s / 2], [ROOM.width, k, s], 'skirting', false, true),
    box('skirting-left', [ROOM.x0 + s / 2, k / 2, (leftZ0 + ROOM.z1) / 2], [s, k, ROOM.z1 - leftZ0], 'skirting', false, true),
  ]
}

/** Black aluminium frame of the glazing: corner post, mullions, end posts and the low transoms. */
export function glazingFrameBoxes(): BoxSpec[] {
  const { side, back, mullion, transomY } = GLAZING
  const w = mullion.width
  const d = mullion.depth
  const metal = (name: string, center: Vec3, size: Vec3) => box(name, center, size, 'blackMetal')
  return [
    metal('post-corner', [side.x, MID, back.z], [d, H, d]),
    ...GLAZING.sideMullionsZ.map((z, i) => metal(`post-side-${i}`, [side.x, MID, z], [d, H, w])),
    metal('post-side-end', [side.x, MID, side.z1 - w / 2], [d, H, w]),
    ...GLAZING.backMullionsX.map((x, i) => metal(`post-back-${i}`, [x, MID, back.z], [w, H, d])),
    metal('post-back-end', [back.x1 - w / 2, MID, back.z], [w, H, d]),
    metal('transom-side', [side.x, transomY, (side.z0 + side.z1) / 2], [d, w, side.z1 - side.z0]),
    metal('transom-back', [back.x1 - (back.x1 - back.x0) / 2, transomY, back.z], [back.x1 - back.x0, w, d]),
  ]
}

/** The two glass planes, 2 cm outside the inner face of the room. */
export function glassPanes(): PaneSpec[] {
  const { side, back, glassInset } = GLAZING
  return [
    { name: 'glass-side', center: [side.x - glassInset, MID, (side.z0 + side.z1) / 2], size: [side.z1 - side.z0, H], rotationY: Math.PI / 2 },
    { name: 'glass-back', center: [(back.x0 + back.x1) / 2, MID, back.z - glassInset], size: [back.x1 - back.x0, H], rotationY: 0 },
  ]
}

/** Vertical oak slats behind the wall screen, floor to ceiling (Room.tsx merges them into one mesh). */
export function slatBoxes(): BoxSpec[] {
  const { x0, x1, depth, slat, gap } = SLAT_WALL
  const slats: BoxSpec[] = []
  for (let i = 0; ; i++) {
    const x = x0 + i * (slat + gap)
    if (x + slat > x1 + 1e-9) break
    slats.push(box(`slat-${i}`, [x + slat / 2, MID, ROOM.z0 + depth / 2], [slat, H, depth], 'slats'))
  }
  return slats
}

/** Oak bench top on a black steel base, along the glazing. */
export function banquetteBoxes(): BoxSpec[] {
  const { x0, x1, z0, z1, height } = BANQUETTE
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const top = 0.04
  return [
    box('banquette-top', [cx, height - top / 2, cz], [x1 - x0, top, z1 - z0], 'oak'),
    box('banquette-base', [cx, (height - top) / 2, cz], [x1 - x0 - 0.06, height - top, z1 - z0 - 0.06], 'blackMetal'),
  ]
}

/** Each ceiling line: a black channel against the ceiling and the emissive strip just below it. No shadows. */
export function ceilingLineBoxes(): BoxSpec[] {
  return CEILING_LINES.flatMap((line, i) => {
    const length = line.z1 - line.z0
    const z = (line.z0 + line.z1) / 2
    return [
      box(`ceiling-channel-${i}`, [line.x, H - 0.005, z], [0.1, 0.01, length], 'blackMetal', false, false),
      box(`ceiling-strip-${i}`, [line.x, H - 0.012, z], [0.06, 0.004, length], 'ceilingStrip', false, false),
    ]
  })
}

export function rugBox(): BoxSpec {
  return box('rug', [RUG.center[0], RUG.thickness / 2, RUG.center[1]], [RUG.size[0], RUG.thickness, RUG.size[1]], 'rug', false, true)
}

/** Every height where something is laid flat on the floor: all distinct, so nothing flickers in the depth test. */
export const FLAT_LEVELS: readonly { name: string; y: number }[] = [
  { name: 'floor', y: 0 },
  { name: 'rug', y: RUG.thickness },
  { name: 'contact shadows', y: CONTACT_SHADOW_Y },
]
```

- [ ] **Step 4: Relancer le test**

Run: `npx vitest run src/zones/office/room/plan.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Créer `src/zones/office/room/Glazing.tsx` et réécrire `src/zones/office/Room.tsx`**

`PlanBox` vit dans `Glazing.tsx` et `Room.tsx` l'importe : la baie et la pièce s'en servent toutes les deux, sans import circulaire. Chaque boîte reçoit des UV en mètres (`metreUVs`), donc chaque texture garde sa taille réelle (`tileMetres`) ; ses géométries sont libérées au démontage (le mode lecture démonte la scène).

`src/zones/office/room/Glazing.tsx` :

```tsx
import { useEffect, useMemo } from 'react'
import { BoxGeometry, type Material } from 'three'
import { useMaterials } from '../../../three/materials'
import { metreUVs } from '../../../three/uv'
import { glassPanes, glazingFrameBoxes, type BoxSpec } from './plan'

/** One box of the room plan, with UVs in metres so its PBR textures keep their real size. */
export function PlanBox({ spec, material }: { spec: BoxSpec; material: Material }) {
  const geometry = useMemo(() => metreUVs(new BoxGeometry(...spec.size)), [spec])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh
      name={spec.name}
      position={spec.center}
      geometry={geometry}
      material={material}
      castShadow={spec.castShadow}
      receiveShadow={spec.receiveShadow}
    />
  )
}

/**
 * The glazing: thin, faintly reflective glass (no transmission, no shadow) in a black aluminium frame. The posts and
 * transoms cast shadows, so the sun draws the frame on the floor. Nothing transparent stands in front of the wall
 * screen: the glass return ends at x = -3.4, left of it.
 */
export function Glazing() {
  const m = useMaterials()
  const frame = useMemo(glazingFrameBoxes, [])
  const panes = useMemo(glassPanes, [])
  return (
    <group name="glazing">
      {frame.map((spec) => (
        <PlanBox key={spec.name} spec={spec} material={m[spec.material]} />
      ))}
      {panes.map((pane) => (
        <mesh key={pane.name} name={pane.name} position={pane.center} rotation-y={pane.rotationY} material={m.glass}>
          <planeGeometry args={pane.size} />
        </mesh>
      ))}
    </group>
  )
}
```

`src/zones/office/Room.tsx` en entier (les 78 tasseaux en un seul maillage : un appel de dessin et un seul objet dans la passe d'ombre ; chaque tasseau décale ses UV pour ne pas répéter le même fil) :

```tsx
import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'
import { useMaterials } from '../../three/materials'
import { at, mergeParts } from '../../three/merge'
import { metreUVs } from '../../three/uv'
import { Glazing, PlanBox } from './room/Glazing'
import { banquetteBoxes, ceilingLineBoxes, rugBox, shellBoxes, slatBoxes } from './room/plan'

/** The 78 oak slats as one mesh (one draw call, one shadow caster); each slat starts its grain somewhere else. */
function SlatWall() {
  const m = useMaterials()
  const geometry = useMemo(() => {
    const parts = slatBoxes().map((slat, i) => ({
      geometry: metreUVs(new BoxGeometry(...slat.size), { offset: [(i * 0.37) % 1, (i * 0.61) % 1] }),
      matrix: at(...slat.center),
    }))
    const merged = mergeParts(parts)
    for (const part of parts) part.geometry.dispose()
    return merged
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="slat-wall" geometry={geometry} material={m.slats} castShadow receiveShadow />
}

/**
 * The meeting room: 20 cm slabs and walls that cast and receive shadows, the glazing on the left facade and behind
 * Ada, the slat wall behind the screen, the banquette along the glass, the ceiling lines and the rug.
 */
export function Room() {
  const m = useMaterials()
  const boxes = useMemo(() => [...shellBoxes(), ...banquetteBoxes(), ...ceilingLineBoxes(), rugBox()], [])
  return (
    <group name="room">
      {boxes.map((spec) => (
        <PlanBox key={spec.name} spec={spec} material={m[spec.material]} />
      ))}
      <SlatWall />
      <Glazing />
    </group>
  )
}
```

Dans `src/zones/office/OfficeScene.tsx` (état de la Tâche 6 : les ombres de contact passent au-dessus du tapis de 12 mm), remplacer exactement la ligne

```tsx
import { layout } from './layout'
```

par

```tsx
import { CONTACT_SHADOW_Y, layout } from './layout'
```

puis la ligne

```tsx
        position={[layout.ada.position[0], 0.006, layout.ada.position[2]]}
```

par

```tsx
        position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]}
```

puis la ligne

```tsx
        position={[table.position[0], 0.006, table.position[2]]}
```

par

```tsx
        position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]}
```

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Vérifier le projet**

Run: `npm run check`
Expected: PASS ; tests sans avertissement ; « Initial JS (gzip) » quasi inchangé ; `No test API (__academy) in the production JS`.

- [ ] **Step 7: Vérifier que le laptop reste survolable (e2e)**

La pièce est neuve autour du laptop : on vérifie qu'aucun mur, montant ou tasseau ne bloque le survol réel.

Run: `npx playwright test tests/e2e/office.spec.ts -g "laptop"`
Expected: PASS.

Run: `git checkout -- docs/evidence/office`
Expected: les captures réécrites par l'e2e sont rétablies (elles se régénèrent en Tâche 15).

- [ ] **Step 8: Captures de revue**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-6`
Expected: `saved …\task-6\day-overview.png` et `saved …\task-6\day-presentation.png`, code de sortie 0.

Ce que le contrôleur regarde : murs grège texturés, parquet en lames à l'échelle réelle (environ 2 m par motif), plafond clair avec ses deux lignes noires et leur bande, tapis sous la table sans scintillement au bord, banquette en chêne le long de la vitre ; la baie du sol au plafond sur toute la façade gauche visible, montants noirs tous les 1,2 m, traverse basse à 45 cm, retour vitré derrière Ada ; l'épaisseur des murs visible au bord de la baie (x = −3,4 sur le mur du fond, z = 4,4 sur le mur de gauche) ; derrière l'écran, les tasseaux verticaux. Attendu et provisoire : la baie montre le fond sombre (le ciel et la ville arrivent en Tâche 8) et l'éclairage est encore l'ancien (Tâche 7). Si le fil du chêne des tasseaux paraît horizontal, remplacer dans `SlatWall` (`Room.tsx`) `{ offset: [(i * 0.37) % 1, (i * 0.61) % 1] }` par `{ offset: [(i * 0.37) % 1, (i * 0.61) % 1], swap: true }`, puis relancer la capture.

- [ ] **Step 9: Commit**

```bash
git add src/zones/office/room src/zones/office/Room.tsx src/zones/office/OfficeScene.tsx
git commit -m "feat: PBR room shell with floor-to-ceiling glazing, slat wall, banquette, ceiling lines and rug

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Lumière, cycle et niveaux de qualité

**Files:**
- Create: `src/zones/office/lighting/rig.ts`, `src/zones/office/lighting/live.ts`, `src/zones/office/lighting/PhaseDriver.tsx`, `src/zones/office/lighting/Lights.tsx`, `src/zones/office/lighting/OfficeEnvironment.tsx`, `src/zones/office/lighting/emissive.ts`
- Delete: `src/zones/office/Lights.tsx`
- Modify: `src/zones/office/layout.ts` (bloc `lights`), `src/app/quality.ts` (réécriture : réglages par niveau, rastériseurs logiciels), `src/app/Stage.tsx` (état de la Tâche 7, avec la règle des rastériseurs logiciels), `src/zones/office/OfficeScene.tsx` (état de la Tâche 7)
- Test: `src/zones/office/lighting/rig.test.ts`, `src/zones/office/lighting/live.test.ts`, `src/app/quality.test.ts` (réécriture : les six tests existants inchangés, trois nouveaux)

**Interfaces:**
- Consumes (Tâche 3) : `Phase`, `PHASES`, `PhaseTransition`, `PHASE_SECONDS`, `CLOCK_MINUTES`, `phaseProgress(startedAt, now)`, `easePhase(k)`, `clockMinutes(from, to, e)` (`src/core/phase.ts`) ; `Preset`, `PRESETS`, `SUN_TARGET`, `clonePreset(preset)`, `mixPreset(a, b, t, out?)` (`src/zones/office/lighting/presets.ts`) ; `appStore` avec `phase`, `phaseTransition`, `finishPhaseTransition()` (`src/core/store.ts`). (Tâche 4) : `useMaterials(): Materials` et les matériaux `ceilingStrip`, `lampShade`, `signBack`, `logoLime`, `logoMint`, `logoInk`. (Tâche 5) : `CAMERA`, `CEILING_LINES`, `GLAZING`, `ROOM`, `WALL_T`, `layout`. (Tâche 6) : `Room()`.
- Produces (`src/zones/office/lighting/rig.ts`) : `RIG` (valeurs de départ exactes du Step 7) ; `type RigLightKind = 'directional' | 'hemisphere' | 'rectArea' | 'spot' | 'point'` ; `rigLights(settings: QualitySettings): { name: string; kind: RigLightKind }[]` (toujours `sun`, `sky-fill`, `window-light`, `lamp-light`, `screen-glow` ; plus `ceiling-light-0`, `ceiling-light-1`, `pendant-light` si `settings.accentLights`).
- Produces (`src/zones/office/lighting/live.ts`) : `interface LiveLighting { preset: Preset; minutes: number; finished: boolean }` ; `computeLive(phase: Phase, transition: PhaseTransition | null, now: number, out?: LiveLighting): LiveLighting` (au repos : copie de `PRESETS[phase]` ; en transition : mélange adouci ; une fois `k >= 1` : exactement `PRESETS[to]`, `finished = true`) ; `type LightingApplier = (preset: Readonly<Preset>, minutes: number) => void` ; `registerLightingApplier(apply: LightingApplier): () => void` ; `applyLighting(preset: Readonly<Preset>, minutes: number): void` ; `useLightingApplier(apply: LightingApplier): void`.
- Produces : `PhaseDriver(): null` ; `Lights({ settings }: { settings: QualitySettings })` (lumières nommées de `rigLights`, seul `sun` projette des ombres) ; `OfficeEnvironment()` (`<Environment resolution={256} frames={1}>` de quatre `Lightformer`) ; `useEmissiveLevels(m: Materials): void` (`src/zones/office/lighting/emissive.ts`).
- Produces (`src/app/quality.ts`) : `interface QualitySettings { dpr: number | [number, number]; shadowMapSize: 0 | 1024 | 2048; accentLights: boolean; animatePlants: boolean; animateCityWindows: boolean }` ; `QUALITY_SETTINGS: Record<Quality, QualitySettings>` (table de la spec §7, code du Step 3) ; `useQualitySettings(): QualitySettings` ; `dprFor(q)` renvoie `QUALITY_SETTINGS[q].dpr` ; en plus du contrat : `SOFTWARE_DPR = 0.5`, `isSoftwareRenderer(renderer: string): boolean`, `interface RendererInfoSource`, `rendererName(gl: RendererInfoSource): string`, et `reduceQuality(state, event: 'decline' | 'incline' | 'software')` (`'software'` : `low`, réglé pour de bon). `Quality`, `QualityContext`, `nextQuality`, `INITIAL_QUALITY`, `QualityState` inchangés.
- Produces (`layout.lights`) : `{ screenGlow: { position }, pendant: { position }, lamp: { position, target } }` (Step 10).
- Produces (`src/app/quality.ts`, rendu logiciel) : `SoftwareRendererContext` (contexte React, `false` par défaut) et `useSoftwareRenderer(): boolean` ; la Tâche 8 s'en sert pour cacher les arbres de la rue sans GPU.
- Produces (`Stage.tsx`) : caméra `{ ...CAMERA, position: layout.rail[0].position }` (far 1000) ; `<div className="stage" data-testid="stage" data-quality={quality.level}>` ; `dpr={software ? SOFTWARE_DPR : QUALITY_SETTINGS[quality.level].dpr}` ; dans `onCreated`, un rastériseur logiciel passe `software` à vrai et envoie `'software'` au réducteur ; `<SoftwareRendererContext.Provider value={software}>` enveloppe tout le contenu de `QualityContext.Provider`. La Tâche 12 garde ces lignes telles quelles.

Une seule valeur pilote tout (§4) : `PhaseDriver` calcule chaque image l'éclairage courant et le passe à l'exposition, à `scene.environmentIntensity` et à chaque appliqueur enregistré (lumières, matériaux émissifs ; la Tâche 8 y branche le ciel et la ville, la Tâche 11 les aiguilles de l'horloge). Les appliqueurs écrivent dans les objets three.js : React ne se rend pas à chaque image. Les lumières qu'une phase éteint restent montées à intensité 0 : changer le nombre de lumières recompilerait tous les matériaux au milieu d'une transition. R3F ne recalcule pas la projection d'une caméra d'ombre : `Lights` règle le cadre d'ombre une fois et appelle `updateProjectionMatrix()` (les props `shadow-camera-*` de l'ancien `Lights.tsx` n'avaient jamais pris effet). Un changement de taille de carte d'ombre (`high` ↔ `medium`) jette l'ancienne carte (`shadow.map.dispose(); shadow.map = null`).

**Rastériseurs logiciels (résolution du plan, critère 4).** Les e2e tournent en rendu logiciel (SwiftShader, §7). Mesure du scratch du plan, 1600 × 900, médiane du temps d'image : bureau actuel 117 ms ; après cette tâche 450 ms (niveau `high`, puis `medium` quand le moniteur décline) ; après la Tâche 8, environ 1 s. À ces cadences, deux parcours existants dépassent leurs 90 s (« scroll to the presentation view, learn a topic and keep the progress », « everything works from the keyboard » : la ligne d'Ada est déjà écrite quand le test la regarde). Le moniteur de performances descend trop lentement pour les sauver. Règle ajoutée : quand le nom du rendu WebGL désigne un rastériseur sans GPU (SwiftShader, llvmpipe, softpipe, Basic Render Driver), `Stage` passe tout de suite au niveau `low`, réglé, dessine à `SOFTWARE_DPR` = 0,35 (un huitième des pixels) et le signale par `SoftwareRendererContext`, que la Tâche 8 lit pour cacher les arbres de la rue. Ces deux réductions tiennent le parcours le plus long sous 60 % de son délai jusqu'à la fin du plan (résolution « Rendu logiciel des e2e » des Global Constraints ; mesuré dans le scratch du plan : 38,7 s après la Tâche 8, 45,1 s après la Tâche 14 ; à demi-résolution avec les arbres, il prenait 84 s sur 90 dès la Tâche 8). Le PC de référence (Radeon 860M, ANGLE D3D11) n'est pas concerné : le tableau des niveaux de la spec s'y applique tel quel. Conséquence acceptée : les captures que l'e2e écrit dans `docs/evidence/office/` sont rendues au niveau `low`, à 0,35 de résolution ; les six captures de preuve des phases (Tâche 16) passent par `scripts/shots.mjs`, sur le vrai GPU.

- [ ] **Step 1: Réécrire `src/app/quality.test.ts` (tests qui échouent)**

Les six tests existants ne changent pas ; trois s'ajoutent : la table des niveaux de la spec, la reconnaissance des rastériseurs logiciels (noms réels relevés dans Chromium : SwiftShader de l'e2e et Radeon 860M du PC de référence) et le passage immédiat au niveau `low`.

```ts
import {
  INITIAL_QUALITY,
  QUALITY_SETTINGS,
  SOFTWARE_DPR,
  dprFor,
  isSoftwareRenderer,
  nextQuality,
  reduceQuality,
  rendererName,
  type QualityState,
} from './quality'

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

test('a fast machine keeps high quality however often it reports an incline', () => {
  let state: QualityState = INITIAL_QUALITY
  for (let i = 0; i < 20; i++) state = reduceQuality(state, 'incline')
  expect(state).toEqual({ level: 'high', changes: 0, settled: false })
  expect(state).toBe(INITIAL_QUALITY)
})

test('sustained declines step down to low, then stay there without settling', () => {
  let state: QualityState = INITIAL_QUALITY
  const levels: string[] = []
  for (let i = 0; i < 20; i++) {
    state = reduceQuality(state, 'decline')
    levels.push(state.level)
  }
  expect(levels.slice(0, 3)).toEqual(['medium', 'low', 'low'])
  expect(new Set(levels)).toEqual(new Set(['medium', 'low']))
  expect(state).toEqual({ level: 'low', changes: 2, settled: false })
})

test('flip-flopping between levels settles on low for good', () => {
  let state: QualityState = INITIAL_QUALITY
  for (const event of ['decline', 'incline', 'decline', 'incline'] as const) state = reduceQuality(state, event)
  expect(state).toMatchObject({ level: 'low', settled: true })
  const settled = state
  expect(reduceQuality(settled, 'incline')).toBe(settled)
  expect(reduceQuality(settled, 'decline')).toBe(settled)
})

// Spec section 7: what each tier keeps.
test('each tier matches the spec table', () => {
  expect(QUALITY_SETTINGS.high).toEqual({ dpr: [1, 1.5], shadowMapSize: 2048, accentLights: true, animatePlants: true, animateCityWindows: true })
  expect(QUALITY_SETTINGS.medium).toEqual({ dpr: 1, shadowMapSize: 1024, accentLights: false, animatePlants: true, animateCityWindows: true })
  expect(QUALITY_SETTINGS.low).toEqual({ dpr: 1, shadowMapSize: 0, accentLights: false, animatePlants: false, animateCityWindows: false })
  for (const quality of ['high', 'medium', 'low'] as const) expect(dprFor(quality)).toBe(QUALITY_SETTINGS[quality].dpr)
})

test('software rasterizers are recognised by their renderer name', () => {
  expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true)
  expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true)
  expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true)
  expect(isSoftwareRenderer('ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false)
  expect(isSoftwareRenderer('Apple M2')).toBe(false)
  // Chrome masks the name behind WEBGL_debug_renderer_info; other browsers give it directly.
  const context = (renderer: string, unmasked: string | null) => ({
    RENDERER: 1,
    getParameter: (name: number) => (name === 1 ? renderer : unmasked),
    getExtension: () => (unmasked === null ? null : { UNMASKED_RENDERER_WEBGL: 2 }),
  })
  expect(rendererName(context('WebKit WebGL', 'ANGLE (Google, SwiftShader driver)'))).toBe('ANGLE (Google, SwiftShader driver)')
  expect(rendererName(context('llvmpipe (LLVM 15.0.7, 256 bits)', null))).toBe('llvmpipe (LLVM 15.0.7, 256 bits)')
  expect(rendererName(context('WebKit WebGL', null))).toBe('WebKit WebGL')
})

test('a software rasterizer settles on low at once, at a reduced resolution', () => {
  expect(reduceQuality(INITIAL_QUALITY, 'software')).toEqual({ level: 'low', changes: 0, settled: true })
  const settled = reduceQuality(INITIAL_QUALITY, 'software')
  expect(reduceQuality(settled, 'incline')).toBe(settled)
  expect(SOFTWARE_DPR).toBe(0.35)
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/app/quality.test.ts`
Expected: FAIL — « each tier matches the spec table » : `TypeError: Cannot read properties of undefined (reading 'high')` ; « software rasterizers are recognised by their renderer name » : `TypeError: isSoftwareRenderer is not a function` ; « a software rasterizer settles on low at once, at a reduced resolution » : `AssertionError: expected { level: 'medium', changes: 1, …(1) } to deeply equal { level: 'low', changes: +0, …(1) }`. Les 6 tests existants passent.

- [ ] **Step 3: Réécrire `src/app/quality.ts`**

```ts
import { createContext, useContext } from 'react'

export type Quality = 'high' | 'medium' | 'low'

export const QualityContext = createContext<Quality>('high')

/** What a quality tier turns on (spec section 7). */
export interface QualitySettings {
  dpr: number | [number, number]
  /** Sun shadow map in pixels; 0: no dynamic shadow. */
  shadowMapSize: 0 | 1024 | 2048
  /** Ceiling-line area lights and the pendant light. */
  accentLights: boolean
  animatePlants: boolean
  /** City windows switch on and off over time; frozen when false. */
  animateCityWindows: boolean
}

export const QUALITY_SETTINGS: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 1.5], shadowMapSize: 2048, accentLights: true, animatePlants: true, animateCityWindows: true },
  medium: { dpr: 1, shadowMapSize: 1024, accentLights: false, animatePlants: true, animateCityWindows: true },
  low: { dpr: 1, shadowMapSize: 0, accentLights: false, animatePlants: false, animateCityWindows: false },
}

/** The settings of the current tier. Inside the Canvas (Stage provides QualityContext). */
export function useQualitySettings(): QualitySettings {
  return QUALITY_SETTINGS[useContext(QualityContext)]
}

/**
 * A rasterizer without GPU (SwiftShader in the e2e browser, llvmpipe, the Windows Basic Render Driver) draws the
 * office at a few frames per second: Stage starts it on the low tier, settled, at SOFTWARE_DPR.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render/i
export const SOFTWARE_DPR = 0.35

export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer)
}

/**
 * True once Stage has found a software rasterizer: the office then hides what costs the most per frame and no journey
 * needs (the street trees, Task 8). Never true on a GPU: the spec's tier table applies unchanged on the reference PC.
 */
export const SoftwareRendererContext = createContext(false)

/** Inside the Canvas (Stage provides SoftwareRendererContext). */
export function useSoftwareRenderer(): boolean {
  return useContext(SoftwareRendererContext)
}

/** The part of a WebGL context that rendererName reads. */
export interface RendererInfoSource {
  RENDERER: number
  getParameter(name: number): unknown
  getExtension(name: 'WEBGL_debug_renderer_info'): { UNMASKED_RENDERER_WEBGL: number } | null
}

/** The renderer's real name: Chrome reports "WebKit WebGL" and keeps the real one behind WEBGL_debug_renderer_info. */
export function rendererName(gl: RendererInfoSource): string {
  const name = String(gl.getParameter(gl.RENDERER))
  if (!/^webkit webgl$/i.test(name)) return name
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : name
}

const ORDER: Quality[] = ['low', 'medium', 'high']

export function nextQuality(current: Quality, event: 'decline' | 'incline' | 'fallback'): Quality {
  if (event === 'fallback') return 'low'
  const index = ORDER.indexOf(current) + (event === 'incline' ? 1 : -1)
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, index))]
}

export function dprFor(quality: Quality): number | [number, number] {
  return QUALITY_SETTINGS[quality].dpr
}

export interface QualityState {
  level: Quality
  changes: number
  settled: boolean
}
export const INITIAL_QUALITY: QualityState = { level: 'high', changes: 0, settled: false }
const MAX_CHANGES = 3

/**
 * Only real level changes count as flip-flops; after too many, settle on low for good.
 * 'software': the renderer has no GPU (isSoftwareRenderer), settle on low at once.
 */
export function reduceQuality(state: QualityState, event: 'decline' | 'incline' | 'software'): QualityState {
  if (event === 'software') return { level: 'low', changes: state.changes, settled: true }
  if (state.settled) return state
  const level = nextQuality(state.level, event)
  if (level === state.level) return state
  const changes = state.changes + 1
  if (changes > MAX_CHANGES) return { level: nextQuality(level, 'fallback'), changes, settled: true }
  return { level, changes, settled: false }
}
```

- [ ] **Step 4: Relancer le test**

Run: `npx vitest run src/app/quality.test.ts`
Expected: PASS (9 tests ; valeurs de `dprFor` inchangées).

- [ ] **Step 5: Écrire les tests qui échouent `src/zones/office/lighting/rig.test.ts` et `live.test.ts`**

Les tests de `src/zones/office/**` n'écrivent aucun littéral de couleur hexadécimal (règle des couleurs, contrôlée en Tâche 15) : `new RectAreaLight()` garde sa couleur par défaut.

`src/zones/office/lighting/rig.test.ts` :

```ts
import { OrthographicCamera, RectAreaLight, Vector3 } from 'three'
import { QUALITY_SETTINGS, type Quality } from '../../../app/quality'
import { PHASES } from '../../../core/phase'
import { GLAZING, ROOM, WALL_T } from '../layout'
import { PRESETS, SUN_TARGET, mixPreset } from './presets'
import { RIG, rigLights } from './rig'

/** Sun positions of the three phases and of the blends each transition passes through. */
function sunPositions(): { label: string; position: Vector3 }[] {
  return PHASES.flatMap((phase, i) => {
    const next = PHASES[(i + 1) % PHASES.length]
    return [0, 0.25, 0.5, 0.75].map((t) => ({ label: `${phase} to ${next} at ${t}`, position: mixPreset(PRESETS[phase], PRESETS[next], t).sunPosition }))
  })
}

const names = (quality: Quality) => rigLights(QUALITY_SETTINGS[quality]).map((light) => light.name)
const ALWAYS = ['sun', 'sky-fill', 'window-light', 'lamp-light', 'screen-glow']

test('every preset sends the sun through the glazing', () => {
  for (const { label, position } of sunPositions()) {
    expect(position.x, label).toBeLessThan(GLAZING.side.x) // outside the facade
    // Where the ray from the sun to the table centre crosses the facade plane.
    const t = (GLAZING.side.x - position.x) / (SUN_TARGET.x - position.x)
    const y = position.y + (SUN_TARGET.y - position.y) * t
    const z = position.z + (SUN_TARGET.z - position.z) * t
    expect(y, label).toBeGreaterThan(0)
    expect(y, label).toBeLessThan(ROOM.height)
    expect(z, label).toBeGreaterThan(GLAZING.side.z0)
    expect(z, label).toBeLessThan(GLAZING.side.z1)
  }
})

test('the shadow camera holds the whole room for every sun position', () => {
  // The shell with its walls and slabs: everything that casts a shadow inside.
  const corners: Vector3[] = []
  for (const x of [ROOM.x0 - WALL_T, ROOM.x1 + WALL_T]) {
    for (const y of [-WALL_T / 2, ROOM.height + WALL_T / 2]) {
      for (const z of [ROOM.z0 - WALL_T, ROOM.z1 + WALL_T]) corners.push(new Vector3(x, y, z))
    }
  }
  const { left, right, top, bottom, near, far } = RIG.sun.camera
  for (const { label, position } of sunPositions()) {
    // As DirectionalLightShadow does: an orthographic camera at the light, looking at its target.
    const camera = new OrthographicCamera(left, right, top, bottom, near, far)
    camera.position.copy(position)
    camera.lookAt(SUN_TARGET)
    camera.updateMatrixWorld()
    for (const corner of corners) {
      const p = corner.clone().applyMatrix4(camera.matrixWorldInverse)
      expect(p.x, label).toBeGreaterThan(left)
      expect(p.x, label).toBeLessThan(right)
      expect(p.y, label).toBeGreaterThan(bottom)
      expect(p.y, label).toBeLessThan(top)
      expect(-p.z, label).toBeGreaterThan(near)
      expect(-p.z, label).toBeLessThan(far)
    }
  }
})

test('the window light covers the fa\u00e7ade', () => {
  const { position, lookAt, width, height } = RIG.window
  expect(width).toBeCloseTo(GLAZING.side.z1 - GLAZING.side.z0) // 10.4 m
  expect(height).toBe(ROOM.height)
  expect(position[1]).toBeCloseTo(ROOM.height / 2)
  expect(position[2]).toBeCloseTo((GLAZING.side.z0 + GLAZING.side.z1) / 2)
  expect(position[0] - GLAZING.side.x).toBeGreaterThan(0) // just inside the glass
  expect(position[0] - GLAZING.side.x).toBeLessThan(0.05)
  // Turned as Lights.tsx turns it: it shines into the room (lights shine along their local -z), its width along the facade.
  const light = new RectAreaLight()
  light.position.set(...position)
  light.lookAt(...lookAt)
  expect(new Vector3(0, 0, -1).applyQuaternion(light.quaternion).x).toBeCloseTo(1)
  expect(Math.abs(new Vector3(1, 0, 0).applyQuaternion(light.quaternion).z)).toBeCloseTo(1)
})

test('accent lights exist only on the high tier', () => {
  expect(names('high')).toEqual([...ALWAYS, 'ceiling-light-0', 'ceiling-light-1', 'pendant-light'])
  expect(names('medium')).toEqual(ALWAYS)
  expect(names('low')).toEqual(ALWAYS)
  // One shadow caster: the only directional light.
  expect(rigLights(QUALITY_SETTINGS.high).filter((light) => light.kind === 'directional').map((light) => light.name)).toEqual(['sun'])
})

test('the light count never depends on the phase', () => {
  // Lights a phase switches off stay mounted at intensity 0: adding or removing a light would recompile every
  // material in the middle of a transition. rigLights only takes the quality settings.
  expect(PRESETS.day.lampIntensity).toBe(0)
  expect(PRESETS.day.ceiling).toBe(0)
  for (const quality of ['high', 'medium', 'low'] as const) {
    expect(names(quality), quality).toContain('lamp-light')
    expect(rigLights(QUALITY_SETTINGS[quality])).toEqual(rigLights({ ...QUALITY_SETTINGS[quality] }))
  }
  expect(names('high')).toContain('pendant-light')
  expect(rigLights.length).toBe(1)
})
```

`src/zones/office/lighting/live.test.ts` (Review focus 1 : « a finished transition lands exactly on the target preset ») :

```ts
import { CLOCK_MINUTES, PHASES, PHASE_SECONDS, type PhaseTransition } from '../../../core/phase'
import { applyLighting, computeLive, registerLightingApplier } from './live'
import { PRESETS, mixPreset } from './presets'

const MS = PHASE_SECONDS * 1000

test('without a transition the live lighting is the phase preset', () => {
  for (const phase of PHASES) {
    const live = computeLive(phase, null, 123)
    expect(live.preset, phase).toEqual(PRESETS[phase])
    // A copy: an applier can never change the presets.
    expect(live.preset.sunColor).not.toBe(PRESETS[phase].sunColor)
    expect(live.preset.sunPosition).not.toBe(PRESETS[phase].sunPosition)
    expect(live.minutes).toBe(CLOCK_MINUTES[phase])
    expect(live.finished).toBe(false)
  }
})

test('mid-transition values are the eased mix', () => {
  const transition: PhaseTransition = { from: 'day', to: 'sunset', startedAt: 1000 }
  // A quarter of the time is 1/16 of the way (cubic ease in and out).
  const quarter = computeLive('sunset', transition, 1000 + MS / 4)
  const expected = mixPreset(PRESETS.day, PRESETS.sunset, 0.0625)
  expect(quarter.finished).toBe(false)
  expect(quarter.preset.sunIntensity).toBeCloseTo(expected.sunIntensity)
  quarter.preset.sunPosition.toArray().forEach((n, i) => expect(n).toBeCloseTo(expected.sunPosition.getComponent(i)))
  expect(quarter.preset.skyHorizon.r).toBeCloseTo(expected.skyHorizon.r)
  expect(quarter.preset.environment).toBeCloseTo(expected.environment)
  // Half the time is half the way.
  const half = computeLive('sunset', transition, 1000 + MS / 2)
  expect(half.preset.sunIntensity).toBeCloseTo((PRESETS.day.sunIntensity + PRESETS.sunset.sunIntensity) / 2)
})

// Review focus 1: the transition ends exactly on the next phase, nothing half applied.
test('a finished transition lands exactly on the target preset', () => {
  const transition: PhaseTransition = { from: 'night', to: 'day', startedAt: 5000 }
  expect(computeLive('day', transition, 5000 + MS - 16).finished).toBe(false)
  for (const now of [5000 + MS, 5000 + MS + 1, 5000 + 60_000]) {
    const live = computeLive('day', transition, now)
    expect(live.finished).toBe(true)
    expect(live.preset).toEqual(PRESETS.day)
    expect(live.minutes).toBe(CLOCK_MINUTES.day)
  }
  // It writes into the object it is given, the one PhaseDriver keeps from frame to frame.
  const out = computeLive('night', null, 0)
  expect(computeLive('day', transition, 5000 + MS, out)).toBe(out)
  expect(out.preset).toEqual(PRESETS.day)
})

test("appliers receive each frame's preset and can unregister", () => {
  const seen: [number, number][] = []
  const stop = registerLightingApplier((preset, minutes) => {
    seen.push([preset.sunIntensity, minutes])
  })
  const other = vi.fn()
  const stopOther = registerLightingApplier(other)
  applyLighting(PRESETS.day, CLOCK_MINUTES.day)
  applyLighting(PRESETS.night, CLOCK_MINUTES.night)
  stop()
  applyLighting(PRESETS.sunset, CLOCK_MINUTES.sunset)
  expect(seen).toEqual([
    [PRESETS.day.sunIntensity, CLOCK_MINUTES.day],
    [PRESETS.night.sunIntensity, CLOCK_MINUTES.night],
  ])
  expect(other).toHaveBeenCalledTimes(3)
  expect(other).toHaveBeenLastCalledWith(PRESETS.sunset, CLOCK_MINUTES.sunset)
  stopOther()
  applyLighting(PRESETS.day, CLOCK_MINUTES.day)
  expect(other).toHaveBeenCalledTimes(3)
})

test('the clock turns forward during a transition', () => {
  const transition: PhaseTransition = { from: 'night', to: 'day', startedAt: 0 }
  let previous = CLOCK_MINUTES.night
  let turned = 0
  for (let i = 1; i <= 10; i++) {
    const minutes = computeLive('day', transition, (i / 10) * MS).minutes
    const step = (minutes - previous + 1440) % 1440
    expect(step, `step ${i}`).toBeLessThan(720) // never backwards
    turned += step
    previous = minutes
  }
  expect(turned).toBeCloseTo(15 * 60) // 23:00 to 14:00, through midnight
  expect(computeLive('day', transition, MS / 2).minutes).toBe(6 * 60 + 30)
})
```

- [ ] **Step 6: Lancer les tests pour les voir échouer**

Run: `npx vitest run src/zones/office/lighting/rig.test.ts src/zones/office/lighting/live.test.ts`
Expected: FAIL — `Failed to resolve import "./rig" from "src/zones/office/lighting/rig.test.ts"` et `Failed to resolve import "./live" from "src/zones/office/lighting/live.test.ts"`.

- [ ] **Step 7: Créer `src/zones/office/lighting/rig.ts` et `src/zones/office/lighting/live.ts`**

`src/zones/office/lighting/rig.ts` (valeurs de départ ; les couleurs des lumières vivent ici et dans `presets.ts`) :

```ts
import type { QualitySettings } from '../../../app/quality'
import { CEILING_LINES, type Vec3 } from '../layout'

/*
 * The light rig of the office (Horn.os office.js buildLights, refitted to a 10 x 12 m room): one shadow caster (the
 * sun, the moon at night) coming in sideways through the glazing, a sky fill, the daylight of the whole facade as
 * an area light, and the practical lights of the room. Colours of lights live here and in presets.ts only.
 * Intensities follow the time of day through presets.ts (Lights.tsx applies them); these are the fixed parts.
 */
export const RIG = {
  sun: { shadowBias: -0.0004, normalBias: 0.02, camera: { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 26 } },
  window: { position: [-4.97, 1.6, -0.8] as Vec3, lookAt: [0, 1.6, -0.8] as Vec3, width: 10.4, height: 3.2 },
  ceilingLines: { y: 3.18, width: 0.12, length: 7.2, nits: 12 }, // RectAreaLights rotated [-PI/2, 0, 0], one per CEILING_LINES entry
  pendant: { candela: 6, distance: 6, decay: 2, colour: '#ffd9a8' },
  lamp: { colour: '#ffd6a0', angle: 0.75, penumbra: 0.6, distance: 3, decay: 2 },
  screenGlow: { colour: '#9fb8c8', distance: 4, decay: 2 },
  emissivePeak: 2.5,
  environment: {
    resolution: 256,
    lightformers: [
      { name: 'window', position: [-6, 1.6, -0.8], rotation: [0, Math.PI / 2, 0], scale: [10, 3], intensity: 1.6, colour: '#e8f0ff' },
      { name: 'ceiling', position: [-1, 4, -1.5], rotation: [Math.PI / 2, 0, 0], scale: [6, 8], intensity: 0.8, colour: '#fff1dc' },
      { name: 'camera-side', position: [0, 1.6, 8], rotation: [0, Math.PI, 0], scale: [10, 3], intensity: 0.35, colour: '#f3ece2' },
      { name: 'floor-bounce', position: [-1, -1, -1.5], rotation: [-Math.PI / 2, 0, 0], scale: [8, 10], intensity: 0.25, colour: '#c8a782' },
    ],
  },
} as const

export type RigLightKind = 'directional' | 'hemisphere' | 'rectArea' | 'spot' | 'point'

/**
 * The lights of a quality tier, by scene name. The list never depends on the phase: a light that a phase switches
 * off stays mounted at intensity 0, because a change in the number of lights recompiles every material.
 */
export function rigLights(settings: QualitySettings): { name: string; kind: RigLightKind }[] {
  const lights: { name: string; kind: RigLightKind }[] = [
    { name: 'sun', kind: 'directional' },
    { name: 'sky-fill', kind: 'hemisphere' },
    { name: 'window-light', kind: 'rectArea' },
    { name: 'lamp-light', kind: 'spot' },
    { name: 'screen-glow', kind: 'point' },
  ]
  if (settings.accentLights) {
    CEILING_LINES.forEach((_, i) => lights.push({ name: `ceiling-light-${i}`, kind: 'rectArea' }))
    lights.push({ name: 'pendant-light', kind: 'point' })
  }
  return lights
}
```

`src/zones/office/lighting/live.ts` — à la fin d'une transition, l'éclairage est une copie exacte du préréglage cible (un mélange à 1 peut différer d'une erreur d'arrondi) :

```ts
import { useEffect, useLayoutEffect, useRef } from 'react'
import { CLOCK_MINUTES, clockMinutes, easePhase, phaseProgress, type Phase, type PhaseTransition } from '../../../core/phase'
import { PRESETS, clonePreset, mixPreset, type Preset } from './presets'

/*
 * The lighting of the current frame, and the components that apply it. One value drives everything (spec section 4):
 * PhaseDriver computes the live preset once per frame and hands it to every registered applier (lights, sky, city,
 * emissive materials, clock hands), which only write into three.js objects: nothing re-renders React per frame.
 */

export interface LiveLighting {
  preset: Preset
  /** The time the wall clock shows, in minutes after midnight. */
  minutes: number
  /** The transition has reached its end: PhaseDriver clears it. */
  finished: boolean
}

/** Copies a preset into `out` (a blend of the preset with itself at 0 is an exact copy). */
const copyInto = (preset: Preset, out: Preset) => mixPreset(preset, preset, 0, out)

/**
 * The lighting at `now` (performance.now() milliseconds): the phase preset at rest, the eased blend of a running
 * transition, and exactly the target preset once the transition is over. Writes into `out` when given.
 */
export function computeLive(phase: Phase, transition: PhaseTransition | null, now: number, out?: LiveLighting): LiveLighting {
  const live = out ?? { preset: clonePreset(PRESETS[phase]), minutes: CLOCK_MINUTES[phase], finished: false }
  if (!transition) {
    copyInto(PRESETS[phase], live.preset)
    live.minutes = CLOCK_MINUTES[phase]
    live.finished = false
    return live
  }
  const k = phaseProgress(transition.startedAt, now)
  if (k >= 1) {
    // Land exactly on the target: a blend at 1 can be off by a rounding error.
    copyInto(PRESETS[transition.to], live.preset)
    live.minutes = CLOCK_MINUTES[transition.to]
    live.finished = true
    return live
  }
  const e = easePhase(k)
  mixPreset(PRESETS[transition.from], PRESETS[transition.to], e, live.preset)
  live.minutes = clockMinutes(transition.from, transition.to, e)
  live.finished = false
  return live
}

/** Writes the live lighting into three.js objects. Must not keep or change the preset it receives. */
export type LightingApplier = (preset: Readonly<Preset>, minutes: number) => void

const appliers = new Set<LightingApplier>()

/** Adds an applier; returns the function that removes it. */
export function registerLightingApplier(apply: LightingApplier): () => void {
  appliers.add(apply)
  return () => {
    appliers.delete(apply)
  }
}

/** Hands the live lighting to every registered applier (PhaseDriver, once per frame). */
export function applyLighting(preset: Readonly<Preset>, minutes: number): void {
  for (const apply of appliers) apply(preset, minutes)
}

/** Registers `apply` while the component is mounted; always calls its latest version. */
export function useLightingApplier(apply: LightingApplier): void {
  const latest = useRef(apply)
  useLayoutEffect(() => {
    latest.current = apply
  })
  useEffect(() => registerLightingApplier((preset, minutes) => latest.current(preset, minutes)), [])
}
```

- [ ] **Step 8: Relancer les tests**

Run: `npx vitest run src/zones/office/lighting`
Expected: PASS — `rig` 5, `live` 5, `presets` 5 ; sortie sans avertissement. Les tests de `rig` vérifient aussi les positions du soleil pendant les transitions (mélanges à 0,25, 0,5, 0,75) : le soleil entre toujours par la baie et la caméra d'ombre (±10 × ±8 m, 1 à 26 m) contient toujours la coque entière (marge mesurée : x jusqu'à 9,95 au coucher, profondeur jusqu'à 21,4).

- [ ] **Step 9: Créer `PhaseDriver.tsx`, `Lights.tsx`, `OfficeEnvironment.tsx` et `emissive.ts`**

`src/zones/office/lighting/PhaseDriver.tsx` :

```tsx
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { appStore } from '../../../core/store'
import { applyLighting, computeLive } from './live'

/**
 * Drives the time of day. Every frame: the live lighting (the phase, or the eased blend of a running transition) goes
 * to the tone-mapping exposure, the environment strength and every registered applier; a transition that has landed
 * is cleared. Written every frame on purpose: drei's <Environment> resets scene.environmentIntensity to 1 whenever it
 * renders again, and a component mounted later (the decor) gets the current values on its first frame.
 */
export function PhaseDriver(): null {
  const live = useMemo(() => computeLive(appStore.getState().phase, null, 0), [])
  useFrame(({ gl, scene }) => {
    const state = appStore.getState()
    computeLive(state.phase, state.phaseTransition, performance.now(), live)
    gl.toneMappingExposure = live.preset.exposure
    scene.environmentIntensity = live.preset.environment
    applyLighting(live.preset, live.minutes)
    if (live.finished) state.finishPhaseTransition()
  })
  return null
}
```

`src/zones/office/lighting/Lights.tsx` — rend exactement les lumières de `rigLights(settings)`, sous leurs noms ; `RectAreaLightUniformsLib.init()` au niveau du module (tables de calcul en mémoire, aucun téléchargement) ; les lignes de plafond prennent la couleur chaude de la suspension (`RIG.pendant.colour`, `RIG.ceilingLines` n'a pas de couleur) :

```tsx
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Object3D, type DirectionalLight, type HemisphereLight, type PointLight, type RectAreaLight, type SpotLight } from 'three'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import type { QualitySettings } from '../../../app/quality'
import { CEILING_LINES, layout } from '../layout'
import { useLightingApplier } from './live'
import { SUN_TARGET } from './presets'
import { RIG, rigLights } from './rig'

// Area lights need their lookup tables in the WebGL renderer, once, before the first one is drawn.
RectAreaLightUniformsLib.init()

/**
 * The named lights of the office (rig.ts). Only the sun casts shadows: 2048 px on the high tier, 1024 on medium,
 * none on low. Colours, intensities and the sun's position follow the time of day through one applier.
 */
export function Lights({ settings }: { settings: QualitySettings }) {
  const sun = useRef<DirectionalLight>(null)
  const sky = useRef<HemisphereLight>(null)
  const facade = useRef<RectAreaLight>(null)
  const lamp = useRef<SpotLight>(null)
  const glow = useRef<PointLight>(null)
  const pendant = useRef<PointLight>(null)
  const ceiling = useRef<(RectAreaLight | null)[]>([])
  const sunTarget = useMemo(() => new Object3D(), [])
  const lampTarget = useMemo(() => new Object3D(), [])
  const shadowSize = settings.shadowMapSize

  useLayoutEffect(() => {
    // R3F does not refresh a shadow camera's projection: set the frustum here, once, and update it.
    const shadow = sun.current!.shadow
    Object.assign(shadow.camera, RIG.sun.camera)
    shadow.camera.updateProjectionMatrix()
    shadow.bias = RIG.sun.shadowBias
    shadow.normalBias = RIG.sun.normalBias
    // Lights shine along their local -z: turn the facade light toward the room.
    facade.current!.lookAt(...RIG.window.lookAt)
  }, [])

  useEffect(() => {
    const shadow = sun.current?.shadow
    if (!shadow || shadowSize === 0) return
    shadow.mapSize.set(shadowSize, shadowSize)
    // A new size only takes effect with a new shadow map.
    shadow.map?.dispose()
    shadow.map = null
  }, [shadowSize])

  useLightingApplier((p) => {
    if (sun.current) {
      sun.current.color.copy(p.sunColor)
      sun.current.intensity = p.sunIntensity
      sun.current.position.copy(p.sunPosition)
    }
    if (sky.current) {
      sky.current.color.copy(p.hemiSky)
      sky.current.groundColor.copy(p.hemiGround)
      sky.current.intensity = p.hemiIntensity
    }
    if (facade.current) {
      facade.current.color.copy(p.windowColor)
      facade.current.intensity = p.windowIntensity
    }
    if (lamp.current) lamp.current.intensity = p.lampIntensity
    if (glow.current) glow.current.intensity = p.screenGlow
    for (const light of ceiling.current) if (light) light.intensity = RIG.ceilingLines.nits * p.ceiling
    if (pendant.current) pendant.current.intensity = RIG.pendant.candela * p.ceiling
  })

  const elements: Record<string, ReactNode> = {
    sun: <directionalLight ref={sun} name="sun" target={sunTarget} castShadow={shadowSize > 0} />,
    'sky-fill': <hemisphereLight ref={sky} name="sky-fill" />,
    'window-light': <rectAreaLight ref={facade} name="window-light" position={RIG.window.position} width={RIG.window.width} height={RIG.window.height} />,
    'lamp-light': (
      <spotLight
        ref={lamp}
        name="lamp-light"
        position={layout.lights.lamp.position}
        target={lampTarget}
        color={RIG.lamp.colour}
        angle={RIG.lamp.angle}
        penumbra={RIG.lamp.penumbra}
        distance={RIG.lamp.distance}
        decay={RIG.lamp.decay}
        intensity={0}
      />
    ),
    'screen-glow': (
      <pointLight
        ref={glow}
        name="screen-glow"
        position={layout.lights.screenGlow.position}
        color={RIG.screenGlow.colour}
        distance={RIG.screenGlow.distance}
        decay={RIG.screenGlow.decay}
        intensity={0}
      />
    ),
    'pendant-light': (
      <pointLight
        ref={pendant}
        name="pendant-light"
        position={layout.lights.pendant.position}
        color={RIG.pendant.colour}
        distance={RIG.pendant.distance}
        decay={RIG.pendant.decay}
        intensity={0}
      />
    ),
  }
  CEILING_LINES.forEach((line, i) => {
    elements[`ceiling-light-${i}`] = (
      <rectAreaLight
        ref={(light) => {
          ceiling.current[i] = light
        }}
        name={`ceiling-light-${i}`}
        position={[line.x, RIG.ceilingLines.y, (line.z0 + line.z1) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={RIG.ceilingLines.width}
        height={RIG.ceilingLines.length}
        color={RIG.pendant.colour}
        intensity={0}
      />
    )
  })

  return (
    <>
      <primitive object={sunTarget} position={SUN_TARGET} />
      <primitive object={lampTarget} position={layout.lights.lamp.target} />
      {rigLights(settings).map(({ name }) => (
        <Fragment key={name}>{elements[name]}</Fragment>
      ))}
    </>
  )
}
```

`src/zones/office/lighting/OfficeEnvironment.tsx` — jamais `preset` ni `files` (aucun CDN) ; des enfants stables, sinon drei refait la capture et remet `environmentIntensity` à 1 à chaque rendu du parent :

```tsx
import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'
import { RIG } from './rig'

/**
 * The reflections of the room, built in the scene from Lightformers (no HDR file, no CDN): the glazing, the ceiling,
 * a dim panel on the camera side so nothing facing the camera goes black, and the warm bounce of the floor
 * (Horn.os D&D environment). Captured once; only scene.environmentIntensity changes with the phase (PhaseDriver).
 */
export function OfficeEnvironment() {
  // Stable children: drei captures the environment again, and resets the environment strength, whenever they change.
  const formers = useMemo(
    () =>
      RIG.environment.lightformers.map((former) => (
        <Lightformer
          key={former.name}
          form="rect"
          position={[...former.position]}
          rotation={[...former.rotation]}
          scale={[...former.scale]}
          intensity={former.intensity}
          color={former.colour}
        />
      )),
    [],
  )
  return (
    <Environment resolution={RIG.environment.resolution} frames={1}>
      {formers}
    </Environment>
  )
}
```

`src/zones/office/lighting/emissive.ts` :

```ts
import type { Materials } from '../../../three/materials'
import { useLightingApplier } from './live'
import { RIG } from './rig'

/**
 * Emissive levels of the shared materials through the day: the ceiling strips and the lamp shade light up at dusk,
 * brighter than white at night (Horn.os rule: practicals above 1.0); the Athena sign is discreet by day, bright at night.
 */
export function useEmissiveLevels(m: Materials): void {
  useLightingApplier((p) => {
    m.ceilingStrip.emissiveIntensity = p.bulb * RIG.emissivePeak
    m.lampShade.emissiveIntensity = Math.min(1, p.lampIntensity) * RIG.emissivePeak
    m.signBack.emissiveIntensity = p.sign
    m.logoLime.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoMint.emissiveIntensity = 0.4 + 0.4 * p.sign
    m.logoInk.emissiveIntensity = 0.2 + 0.3 * p.sign
  })
}
```

- [ ] **Step 10: Brancher la lumière : `layout.ts`, ancien `Lights.tsx`, `OfficeScene.tsx`, `Stage.tsx`**

Dans `src/zones/office/layout.ts`, remplacer exactement le bloc

```ts
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

par

```ts
  lights: {
    screenGlow: { position: [-1.0, 1.9, -5.3] as Vec3 },
    pendant: { position: [-1.0, 2.1, -1.8] as Vec3 },
    lamp: { position: [1.3, 1.12, -5.5] as Vec3, target: [1.3, 0.68, -4.9] as Vec3 },
  },
```

Supprimer l'ancien rig (plus rien ne lit `hemisphere`, `key` ni `fills`) :

Run: `git rm src/zones/office/Lights.tsx`
Expected: `rm 'src/zones/office/Lights.tsx'`.

`src/zones/office/OfficeScene.tsx` en entier (état de la Tâche 7) :

```tsx
import { ContactShadows } from '@react-three/drei'
import { useQualitySettings } from '../../app/quality'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
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
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="cabinet" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <WallScreen3D />
      <AdaController />
      <ContactShadows
        position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]}
        scale={1.4}
        opacity={0.35}
        blur={2.5}
        far={1.6}
        resolution={256}
        frames={1}
      />
      <ContactShadows
        position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]}
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

`src/app/Stage.tsx` en entier (état de la Tâche 7 : caméra `CAMERA` avec `far` 1000 pour le dôme de 400 m de la Tâche 8, pixel ratio du niveau, `data-quality` lu par `scripts/perf.mjs`, règle des rastériseurs logiciels ; la classe `stage`, le canvas et `TestApiBridge` ne changent pas) :

```tsx
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useReducer, useState } from 'react'
import { appStore, useApp } from '../core/store'
import { CAMERA, layout } from '../zones/office/layout'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import {
  INITIAL_QUALITY,
  QUALITY_SETTINGS,
  QualityContext,
  SOFTWARE_DPR,
  SoftwareRendererContext,
  isSoftwareRenderer,
  reduceQuality,
  rendererName,
} from './quality'
import { SceneReadySignal } from './SceneReadySignal'
import { TestApiBridge } from './TestApiBridge'
import { onContextLost } from './webgl'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const [quality, dispatchQuality] = useReducer(reduceQuality, INITIAL_QUALITY)
  const [software, setSoftware] = useState(false)
  return (
    <div className="stage" data-testid="stage" data-quality={quality.level}>
      <Canvas
        shadows="percentage"
        dpr={software ? SOFTWARE_DPR : QUALITY_SETTINGS[quality.level].dpr}
        frameloop={active ? 'always' : 'demand'}
        camera={{ ...CAMERA, position: layout.rail[0].position }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Without a GPU (the e2e browser), the low tier at SOFTWARE_DPR keeps the office usable.
          if (isSoftwareRenderer(rendererName(gl.getContext()))) {
            setSoftware(true)
            dispatchQuality('software')
          }
          gl.domElement.addEventListener(
            'webglcontextlost',
            onContextLost(gl.domElement, () => appStore.getState().reportWebglLost()),
            { once: true },
          )
        }}
      >
        <PerformanceMonitor
          onDecline={() => dispatchQuality('decline')}
          onIncline={() => dispatchQuality('incline')}
        >
          <QualityContext.Provider value={quality.level}>
            <SoftwareRendererContext.Provider value={software}>
              {import.meta.env.DEV && <TestApiBridge />}
              <Suspense fallback={null}>
                <OfficeScene />
                {/* Inside the boundary, after the scene: while the scene suspends (textures, models), the loading screen stays. */}
                <SceneReadySignal />
              </Suspense>
              {TuneMode && tuneEnabled && (
                <Suspense fallback={null}>
                  <TuneMode />
                </Suspense>
              )}
            </SoftwareRendererContext.Provider>
          </QualityContext.Provider>
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}
```

Run: `npm run typecheck`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS ; sortie sans avertissement.

- [ ] **Step 11: Vérifier le projet**

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » ≈ 0,5 MB (budget 1,50 MB) ; `No test API (__academy) in the production JS`.

- [ ] **Step 12: Parcours e2e du bureau**

`Stage.tsx` change (caméra, pixel ratio, rastériseurs logiciels) : tous les parcours du bureau. Le navigateur de l'e2e est SwiftShader : le bureau s'y dessine au niveau `low`, à `SOFTWARE_DPR` (0,35).

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS (9 tests) — sans `?phase=`, la phase vient de l'heure locale ; aucun test de parcours ne dépend de la lumière. Sans la règle des rastériseurs logiciels, « scroll to the presentation view, learn a topic and keep the progress » et « everything works from the keyboard » échouent ici (mesuré dans le scratch du plan) : si l'un d'eux échoue, vérifier d'abord que `[data-testid="stage"]` porte `data-quality="low"` pendant le test. Avec la règle, le test le plus long tient sous 54 s, 60 % de son délai de 90 s (dans le scratch du plan, il prenait 38,7 s après la Tâche 8, dehors compris).

Run: `git checkout -- docs/evidence/office`
Expected: les captures réécrites par l'e2e sont rétablies (Tâche 15).

- [ ] **Step 13: Captures de revue des trois phases**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-7 --phases day,sunset,night`
Expected: six fichiers `day-overview.png`, `day-presentation.png`, `sunset-…`, `night-…`, code de sortie 0.

Ce que le contrôleur regarde (direction artistique : tons moyens, rien d'éblouissant) : le jour, une tache de soleil rasante entre par la baie sur le sol et la table, avec l'ombre des montants, sans zone blanche brûlée ; la face de la pièce à l'ombre garde ses textures lisibles. Au coucher, lumière orange très basse, longues ombres des montants qui montent sur le mur de droite, lignes de plafond faiblement allumées, lampe du buffet allumée. La nuit, pièce éclairée par les lignes de plafond (au-dessus de 1,0 : elles « brillent »), la suspension (niveau `high`) et la lampe ; lune bleue faible ; rien de noir bouché. Attendu et provisoire : la baie montre le fond sombre (Tâche 8) ; l'ancienne lampe procédurale porte encore sa propre `pointLight` chaude (supprimée en Tâche 10) ; l'enseigne et le logo n'utilisent pas encore les matériaux réglés par `useEmissiveLevels` (Tâche 10).

- [ ] **Step 14: Régler les valeurs sur captures (seulement si un critère ci-dessus échoue)**

Les valeurs de départ de `presets.ts` et `rig.ts` ont donné une image équilibrée dans le scratch du plan (textures provisoires). Si une capture échoue à un critère de l'étape 13, ajuster, une valeur à la fois, puis relancer `npx vitest run src/zones/office/lighting` (PASS exigé : il revérifie que le soleil passe par la baie et que la caméra d'ombre contient la pièce) et l'étape 13 :
- zone brûlée de jour : baisser `PRESETS.day.sunIntensity` par pas de 0,4, puis `windowIntensity` par pas de 0,4 ;
- pièce trop sombre à l'ombre : monter `hemiIntensity` de la phase par pas de 0,05 (jamais au-delà de 0,6 : la profondeur des ombres vient de la faible lumière de remplissage) ;
- nuit trop sombre ou trop claire : `RIG.ceilingLines.nits` par pas de 4, `RIG.pendant.candela` par pas de 2, `lampIntensity` de la phase par pas de 0,3 ;
- `environment` et `exposure` ne se touchent pas (spec §4).
Les valeurs finales restent dans `presets.ts` et `rig.ts` ; chaque valeur changée s'ajoute au message de commit de l'étape 15 sur une ligne de la forme `Tuned on screenshots: PRESETS.day.sunIntensity 4.2 -> 3.8`.

- [ ] **Step 15: Commit**

```bash
git add src/zones/office/lighting src/zones/office/layout.ts src/zones/office/OfficeScene.tsx src/app/quality.ts src/app/quality.test.ts src/app/Stage.tsx
git commit -m "feat: day cycle lighting: one live preset per frame, named light rig, Lightformer environment and quality tiers

Software rasterizers (the e2e browser) start on the low tier at a reduced resolution (SOFTWARE_DPR 0.35), so the spec 1 journeys keep their pace.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ciel et ville

**Files:**
- Create: `src/zones/office/outdoor/cityPlan.ts`, `src/zones/office/outdoor/shaders.ts`, `src/zones/office/outdoor/resources.ts`, `src/zones/office/outdoor/Sky.tsx`, `src/zones/office/outdoor/Clouds.tsx`, `src/zones/office/outdoor/City.tsx`, `src/zones/office/outdoor/Street.tsx`, `src/zones/office/outdoor/Outdoor.tsx`
- Modify: `src/zones/office/OfficeScene.tsx` (état de la Tâche 8)
- Test: `src/zones/office/outdoor/cityPlan.test.ts`

**Interfaces:**
- Consumes (Tâche 3) : `PRESETS`, `SUN_TARGET`, `type Preset` (`presets.ts`) ; `appStore` (`reducedMotion`). (Tâche 4) : `tints.city` (`src/three/tints.ts`). (Tâche 5) : `CAMERA`, `GLAZING`. (Tâche 7) : `useLightingApplier(apply)` (`lighting/live.ts`), `useQualitySettings()` (`src/app/quality.ts`, champ `animateCityWindows`), `useSoftwareRenderer(): boolean` (`src/app/quality.ts`).
- Produces (`src/zones/office/outdoor/cityPlan.ts`, pur) : `OUTDOOR = { originX: -2.7, groundY: -24, streetX: -13, park: { x0: -19, x1: -62 }, domeRadius: 400, fogNear: 60, fogFar: 420, cloudWrap: 280 }` ; `CITY_STYLES = { brick: 0, glass: 1, concrete: 2, plaster: 3 }` ; `interface BuildingSpec { x; z; w; d; h; style: 0 | 1 | 2 | 3; tone }` ; `buildingPlan(seed?: number): BuildingSpec[]` (graine 7 par défaut) ; en plus du contrat : `seeded(seed: number): () => number` (LCG de Horn), `interface RoofItem { x; y; z; sx; sy; sz }`, `interface CityLayout { buildings; units: RoofItem[]; tanks: RoofItem[]; beacons: { x; y; z; phase }[] }`, `cityLayout(seed?: number): CityLayout` (même suite de tirages que Horn : bâtiments, équipements de toit, phases des balises).
- Produces (`shaders.ts`) : `SKY_VERTEX`, `SKY_FRAGMENT`, `FACADE_VERTEX`, `FACADE_FRAGMENT`, `BEACON_VERTEX`, `BEACON_FRAGMENT`, `LAMP_GLOW_VERTEX`, `LAMP_GLOW_FRAGMENT`, `CAR_LIGHT_VERTEX`, `CAR_LIGHT_FRAGMENT` (GLSL de Horn, avec `#include <tonemapping_fragment>` et `#include <colorspace_fragment>` pour le dôme et les façades).
- Produces (`resources.ts`, fichier ajouté au contrat) : `canvasTexture(width, height, draw, options?: { repeat?: [number, number]; srgb?: boolean }): CanvasTexture` ; `disposeTree(root: Object3D): void`.
- Produces : `Sky()`, `Clouds()`, `Birds()` (dans `Clouds.tsx`), `City()`, `Street()`, `Outdoor()` (groupe `outdoor` en `x = OUTDOOR.originX`, `userData.auditExempt = 'sky'`) ; dans `OfficeScene`, le brouillard `<fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />` enfant direct de la scène et `<Outdoor />` juste avant `<Room />`.

Portage de Horn.os `js/scene/city.js` en entier : dôme de ciel (dégradé, disque solaire, étoiles), nuages cumulus et cirrus qui dérivent, oiseaux le jour, bâtiments instanciés dont les façades sont dessinées dans le shader (brique, mur-rideau, béton, enduit) avec leurs fenêtres qui s'allument la nuit chacune à son heure, équipements de toit, balises des tours, rue huit étages plus bas (chaussée, trottoirs, bordures, parc, haies, arbres en cartes de feuillage, réverbères qui s'allument, voitures dans les deux sens avec leurs feux). Seuls changent : `scene.add` remplacé par du JSX (`<primitive>` des objets construits comme chez Horn, libérés au démontage par `disposeTree`, car R3F ne libère jamais un `primitive`), `apply(p)` remplacé par des appliqueurs (`useLightingApplier`), `update(t, dt)` par des `useFrame`, les couleurs prises dans `tints.city` (règle des couleurs ; les peintres de canvas calculent leurs `rgb()` / `rgba()` comme chez Horn) et la direction du soleil, prise entre la position du soleil et `SUN_TARGET` (Horn utilisait la position seule, son bureau étant à l'origine). Les uniformes de départ sont ceux de `PRESETS.day`. Rien dehors ne porte ni ne reçoit d'ombre (défaut de R3F et de three). La caméra voit jusqu'à 1000 m (Tâche 7) : le dôme de 400 m, centré sur le groupe décalé de 2,7 m, et le bâtiment le plus lointain (≈ 550 m) y tiennent.

Mouvements réduits : nuages immobiles et oiseaux masqués, voitures arrêtées aussi (décision du plan : même principe que la spec §8, aucune animation de décor quand l'utilisateur la refuse). Niveau `low` : fenêtres de la ville figées (`uTime` des façades ne bouge plus). Le soleil du dôme suit la directionnelle à chaque image, pendant les transitions comprises. Sans GPU (`useSoftwareRenderer()`, rendu logiciel des e2e), `Street` cache ses arbres : leurs 6 000 cartes de feuillage à test alpha coûtaient plus que tout le reste de l'image, et aucun parcours ne les regarde (résolution « Rendu logiciel des e2e » des Global Constraints). Ils restent construits, pour que les tirages qui les suivent (réverbères, voitures) ne changent pas.

- [ ] **Step 1: Écrire le test qui échoue `src/zones/office/outdoor/cityPlan.test.ts`**

```ts
import { CAMERA, GLAZING } from '../layout'
import { CITY_STYLES, OUTDOOR, buildingPlan, cityLayout, seeded } from './cityPlan'

test('the city is the same on every run', () => {
  expect(buildingPlan()).toEqual(buildingPlan(7))
  expect(cityLayout()).toEqual(cityLayout(7))
  expect(buildingPlan(8)).not.toEqual(buildingPlan(7))
  expect(buildingPlan().length).toBeGreaterThan(150)
  // Horn.os' generator: the same numbers for the same seed, always in [0, 1).
  const a = seeded(19)
  const b = seeded(19)
  for (let i = 0; i < 1000; i++) {
    const n = a()
    expect(n).toBe(b())
    expect(n).toBeGreaterThanOrEqual(0)
    expect(n).toBeLessThan(1)
  }
})

test('no building stands between the fa\u00e7ade and the park', () => {
  for (const b of buildingPlan()) expect(b.x + b.w / 2).toBeLessThanOrEqual(OUTDOOR.park.x1)
})

test('only towers rise above 55 m, and none above 170 m', () => {
  const plan = buildingPlan()
  const towers = plan.filter((b) => b.h > 55)
  expect(towers.length).toBeGreaterThan(0)
  for (const b of plan) {
    expect(b.h).toBeGreaterThanOrEqual(10)
    expect(b.h).toBeLessThan(170)
  }
  // A building above 55 m is a tower: a glass or concrete one, with a warning light on top.
  for (const b of towers) expect([CITY_STYLES.glass, CITY_STYLES.concrete]).toContain(b.style)
  expect(cityLayout().beacons).toHaveLength(towers.length)
})

test('the sky dome fits inside the camera far plane', () => {
  expect(OUTDOOR.domeRadius + Math.abs(OUTDOOR.originX) + 8).toBeLessThan(CAMERA.far)
  // So do the farthest building corners, seen from anywhere in the room.
  for (const b of buildingPlan()) {
    const x = Math.abs(b.x + OUTDOOR.originX) + b.w / 2 + 8
    const z = Math.abs(b.z) + b.d / 2 + 8
    expect(Math.hypot(x, z, OUTDOOR.groundY - b.h)).toBeLessThan(CAMERA.far)
  }
})

test('the street lies far below the office floor', () => {
  expect(OUTDOOR.groundY).toBeLessThanOrEqual(-20) // eighth floor
  // The near pavement (8.5 m from the centre line) stays outside the facade, and the park is across the street.
  expect(OUTDOOR.streetX + OUTDOOR.originX + 8.5).toBeLessThan(GLAZING.side.x)
  expect(OUTDOOR.park.x0).toBeLessThan(OUTDOOR.streetX)
  expect(OUTDOOR.park.x1).toBeLessThan(OUTDOOR.park.x0)
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/zones/office/outdoor/cityPlan.test.ts`
Expected: FAIL — `Error: Failed to resolve import "./cityPlan" from "src/zones/office/outdoor/cityPlan.test.ts". Does the file exist?`

- [ ] **Step 3: Créer `src/zones/office/outdoor/cityPlan.ts`**

Même ordre de tirages que Horn (l'ordre d'évaluation des arguments de `add(…)` compte) : la ville est identique à celle de Horn.os.

```ts
// Ported from Horn.os (owner's project): js/scene/city.js
/*
 * The plan of the city seen through the glazing: the office is on the eighth floor of a building on a tree-lined
 * street, with a park across it and the city beyond. Where the buildings stand, how tall, in which style, with their
 * rooftop plant and the beacons of the towers. Pure (no three.js): the same seed gives the same city on every run.
 */

/** Horn.os coordinates (its window wall is x = -2.3); the outdoor group is moved by originX so that wall lands on ours (x = -5). */
export const OUTDOOR = {
  originX: -2.7,
  groundY: -24, // the office is on the eighth floor
  streetX: -13, // centre line of the street, parallel to the facade
  park: { x0: -19, x1: -62 }, // a park across the street, then the city
  domeRadius: 400,
  fogNear: 60,
  fogFar: 420,
  cloudWrap: 280,
} as const

export const CITY_STYLES = { brick: 0, glass: 1, concrete: 2, plaster: 3 } as const

/** Centre x, z; w = extent along x, d = extent along z (Horn add(x, z, w, d, h)); tone in 0..1 picks a colour of the style. */
export interface BuildingSpec {
  x: number
  z: number
  w: number
  d: number
  h: number
  style: 0 | 1 | 2 | 3
  tone: number
}

/** A box standing on a roof: position of its base centre and its size. */
export interface RoofItem {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
}

export interface CityLayout {
  buildings: BuildingSpec[]
  units: RoofItem[]
  tanks: RoofItem[]
  /** Aircraft warning lights, one on top of each building taller than 55 m; phase in radians. */
  beacons: { x: number; y: number; z: number; phase: number }[]
}

/** Horn.os' LCG (s = s * 1664525 + 1013904223): numbers in [0, 1), the same sequence for the same seed. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Horn buildBuildings, in the same order of draws: buildings, then rooftop plant, then beacon phases. */
export function cityLayout(seed = 7): CityLayout {
  const r = seeded(seed)
  const { park, groundY } = OUTDOOR
  const buildings: BuildingSpec[] = []
  const pickStyle = (h: number): BuildingSpec['style'] => {
    const k = r()
    if (h > 55) return k < 0.7 ? CITY_STYLES.glass : CITY_STYLES.concrete
    if (k < 0.35) return CITY_STYLES.brick
    if (k < 0.6) return CITY_STYLES.concrete
    if (k < 0.85) return CITY_STYLES.plaster
    return CITY_STYLES.glass
  }
  const add = (x: number, z: number, w: number, d: number, h: number) => {
    buildings.push({ x, z, w, d, h, style: pickStyle(h), tone: r() })
  }

  // A row of low blocks along the far side of the park.
  for (let z = -160; z < 160; ) {
    const w = 12 + r() * 16
    const d = 14 + r() * 8
    add(park.x1 - d / 2 - r() * 3, z + w / 2, d, w - 0.8, 10 + r() * 13)
    z += w
  }
  // Then a grid of blocks, with more towers in the distance.
  for (let gx = 0; gx < 13; gx++) {
    for (let gz = 0; gz < 20; gz++) {
      if (r() < 0.2) continue
      const x = park.x1 - 50 - gx * 28 - r() * 10
      const z = -280 + gz * 28 + r() * 10
      const far = Math.min(1, gx / 5)
      const tower = r() < 0.1 + far * 0.12
      const h = tower ? 60 + r() * 110 : 12 + r() * 34 * (0.5 + far)
      add(x, z, 14 + r() * 12, 14 + r() * 12, h)
    }
  }

  // Rooftop plant: air-handling units and water tanks on the lower roofs.
  const units: RoofItem[] = []
  const tanks: RoofItem[] = []
  for (const b of buildings) {
    if (b.style === CITY_STYLES.glass || r() < 0.3) continue
    const n = 1 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const x = b.x + (r() - 0.5) * b.w * 0.6
      const z = b.z + (r() - 0.5) * b.d * 0.6
      const y = groundY + b.h
      if (r() < 0.25) tanks.push({ x, y, z, sx: 2.4, sy: 3, sz: 2.4 })
      else units.push({ x, y, z, sx: 2 + r() * 3, sy: 1.2 + r(), sz: 1.5 + r() * 2 })
    }
  }

  const beacons = buildings.filter((b) => b.h > 55).map((b) => ({ x: b.x, y: groundY + b.h + 1, z: b.z, phase: r() * 6.28 }))
  return { buildings, units, tanks, beacons }
}

/** The buildings of the city (Horn buildBuildings layout), default seed 7. */
export function buildingPlan(seed = 7): BuildingSpec[] {
  return cityLayout(seed).buildings
}
```

- [ ] **Step 4: Relancer le test**

Run: `npx vitest run src/zones/office/outdoor/cityPlan.test.ts`
Expected: PASS (5 tests). Valeurs obtenues dans le scratch du plan : plus de 150 bâtiments ; tous derrière le parc (x + w/2 ≤ −62) ; aucun au-delà de 170 m ; ceux qui dépassent 55 m sont en verre ou en béton et portent une balise.

- [ ] **Step 5: Créer `src/zones/office/outdoor/shaders.ts` et `src/zones/office/outdoor/resources.ts`**

`src/zones/office/outdoor/shaders.ts` (GLSL de Horn, sans changement ; `GROUND_Y` est un `define` fourni par `City.tsx`) :

```ts
// Ported from Horn.os (owner's project): js/scene/city.js
/*
 * GLSL of the outdoor: the sky dome (gradient, sun, stars), the facades drawn in the shader (four styles, windows
 * that light up at night each on its own clock, shopfronts, fog) and the additive lights (tower beacons, street lamp
 * glows, car lights). The dome and the facades include three's tone mapping and colour space chunks, so they follow
 * the exposure of the phase like the room does.
 */

export const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

export const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop, uHorizon, uSunDir, uSunColor;
  uniform float uSunSize, uStars, uTime;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 1400.0 / uSunSize) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
    vec3 cell = floor(d * 380.0);
    float st = step(0.9975, hash(cell));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 40.0);
    col += vec3(st * tw * uStars * smoothstep(0.04, 0.3, h));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export const FACADE_VERTEX = /* glsl */ `
  attribute vec3 aTone;
  attribute float aStyle;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTone;
  varying float vId;
  varying float vHeight;
  varying float vStyle;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vTone = aTone;
    vStyle = aStyle;
    vId = float(gl_InstanceID);
    vHeight = instanceMatrix[1][1];
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

export const FACADE_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDir, uSunColor, uAmbient, uSky, uSkyTop, uFogColor;
  uniform float uNight, uTime, uFogNear, uFogFar;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTone;
  varying float vId;
  varying float vHeight;
  varying float vStyle;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 V = normalize(vWorld - cameraPosition);
    float dist = length(vWorld - cameraPosition);
    float diff = max(dot(n, normalize(uSunDir)), 0.0);
    vec3 light = uAmbient + uSunColor * diff;
    float st = floor(vStyle + 0.5);
    bool isBrick = st < 0.5;
    bool isGlass = abs(st - 1.0) < 0.5;
    bool isConcrete = abs(st - 2.0) < 0.5;
    vec3 col;
    if (abs(n.y) > 0.5) {
      col = vTone * 0.5 * light; // roofs: membrane and gravel
    } else {
      float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
      float y = vWorld.y - GROUND_Y;
      float face = abs(n.x) > 0.5 ? sign(n.x) : 2.0 + sign(n.z);
      vec2 cs = isGlass ? vec2(1.6, 3.6) : isConcrete ? vec2(4.2, 3.4) : vec2(3.0, 3.4);
      float gy = y - 4.6; // the ground floor is taller
      vec2 cell = floor(vec2(u, gy) / cs);
      vec2 f = fract(vec2(u, gy) / cs);
      vec3 seed = vec3(cell, vId * 7.0 + face);
      vec4 win = isGlass ? vec4(0.03, 0.97, 0.1, 0.98) : isConcrete ? vec4(0.0, 1.0, 0.36, 0.86) : vec4(0.25, 0.75, 0.3, 0.82);
      float upper = step(0.0, gy) * step(y, vHeight - 1.2);
      float inWin = box(f, win) * upper;
      float inFrame = box(f, win + vec4(-0.035, 0.035, -0.03, 0.02)) * (1.0 - box(f, win)) * upper * (isGlass ? 0.0 : 1.0);
      float sill = box(f, vec4(win.x - 0.05, win.y + 0.05, win.z - 0.06, win.z - 0.03)) * upper * (isGlass || isConcrete ? 0.0 : 1.0);

      vec3 wall = vTone;
      if (isBrick) {
        float row = floor(y / 0.075);
        vec2 b = vec2(u / 0.25 + mod(row, 2.0) * 0.5, y / 0.075);
        float fade = 1.0 - smoothstep(18.0, 70.0, dist);
        float mortar = max(step(0.88, fract(b.x)), step(0.8, fract(b.y)));
        wall *= (1.0 - mortar * 0.22 * fade) * (0.9 + 0.2 * hash(vec3(floor(b), vId)) * fade);
      } else if (isConcrete) {
        wall *= 0.93 + 0.07 * step(0.5, fract(gy / cs.y + 0.25));
      } else {
        wall *= 0.97 + 0.03 * hash(vec3(floor(vec2(u, y) * 0.5), vId));
      }
      vec3 lit = wall * light;

      // glass: interior, blinds, and a Fresnel reflection of the sky
      vec3 R = reflect(V, n);
      vec3 skyRefl = mix(uSky, uSkyTop, smoothstep(0.0, 0.5, R.y));
      skyRefl += uSunColor * pow(max(dot(R, normalize(uSunDir)), 0.0), 250.0) * 1.5;
      float fres = 0.3 + 0.7 * pow(1.0 - max(dot(-V, n), 0.0), 3.0);
      vec3 interior = vec3(0.05, 0.055, 0.065) * (0.6 + 0.8 * hash(seed + 5.0));
      float wy = (f.y - win.z) / (win.w - win.z);
      float blind = step(0.55, hash(seed + 13.0)) * step(1.0 - hash(seed + 21.0) * 0.7, wy);
      interior = mix(interior, vec3(0.78, 0.74, 0.66) * (uAmbient * 0.7), blind);
      vec3 glassDay = mix(interior, skyRefl * (isGlass ? 0.8 : 0.55), fres);
      // at night every window keeps its own clock: it switches on and off at its own period
      float period = 6.0 + hash(seed) * 30.0;
      float epoch = floor((uTime + hash(seed + 3.0) * period) / period);
      float floorLit = isGlass ? step(0.4, hash(vec3(cell.y, vId, floor((uTime + vId) / 40.0)))) : 1.0;
      float on = step(0.55 - 0.25 * uNight, hash(seed + epoch)) * floorLit;
      vec3 warm = mix(vec3(1.0, 0.72, 0.4), vec3(0.8, 0.88, 1.0), step(0.75, hash(seed + 9.0)));
      vec3 glassNight = mix(skyRefl * 0.2 + 0.01, warm * (0.7 + 0.6 * hash(seed + 11.0)) * mix(1.0, 0.5, blind), on);
      vec3 glass = mix(glassDay, glassNight, uNight);

      vec3 frame = (abs(st - 3.0) < 0.5 ? vec3(0.92) : vec3(0.16, 0.16, 0.17)) * light;
      col = lit;
      col = mix(col, wall * 1.15 * light, sill);
      col = mix(col, frame, inFrame);
      col = mix(col, glass, inWin);

      // shopfronts along the street, lit warm at night
      float bay = fract(u / 6.0);
      float shop = step(0.6, y) * step(y, 3.9) * step(0.08, bay) * step(bay, 0.92);
      vec3 shopDay = mix(vec3(0.07), skyRefl * 0.5, fres);
      vec3 shopNight = vec3(1.0, 0.8, 0.55) * (0.7 + 0.5 * hash(vec3(floor(u / 6.0), vId, 2.0)));
      col = mix(col, mix(shopDay, shopNight, uNight), shop);
      col *= mix(1.0, 0.8, step(y, 0.4)); // plinth
    }
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export const BEACON_VERTEX = /* glsl */ `
  attribute float aPhase;
  varying float vA;
  uniform float uTime, uNight;
  void main() {
    vA = step(0.55, fract(uTime * 0.5 + aPhase)) * (0.25 + 0.75 * uNight);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 900.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`

export const BEACON_FRAGMENT = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.15, 0.1, vA * smoothstep(0.5, 0.0, d));
  }`

export const LAMP_GLOW_VERTEX = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`

export const LAMP_GLOW_FRAGMENT = /* glsl */ `
  uniform float uOn;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, uOn * a * a);
  }`

export const CAR_LIGHT_VERTEX = /* glsl */ `
  void main() { gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`

export const CAR_LIGHT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uNight;
  void main() { gl_FragColor = vec4(uColor * (0.4 + 2.2 * uNight), 1.0); }`
```

`src/zones/office/outdoor/resources.ts` :

```ts
// Ported from Horn.os (owner's project): js/scene/city.js (canvasTexture)
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Material, type Mesh, type Object3D, type Texture } from 'three'

/*
 * GPU resources of the outdoor, which is built outside React (like Horn.os) and rendered as <primitive> objects:
 * painted canvas textures, and their disposal (R3F never disposes a primitive).
 */

/** A texture painted on a 2D canvas: sRGB unless told otherwise, repeated when `repeat` is given, anisotropy 8. */
export function canvasTexture(
  width: number,
  height: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  options: { repeat?: [number, number]; srgb?: boolean } = {},
): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvasTexture: no 2D canvas context')
  draw(context, width, height)
  const texture = new CanvasTexture(canvas)
  if (options.srgb ?? true) texture.colorSpace = SRGBColorSpace
  if (options.repeat) {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(...options.repeat)
  }
  texture.anisotropy = 8
  return texture
}

/** Disposes every geometry, material and material texture under `root`, each once. */
export function disposeTree(root: Object3D): void {
  const geometries = new Set<{ dispose: () => void }>()
  const materials = new Set<Material>()
  root.traverse((object) => {
    const mesh = object as Partial<Mesh>
    if (mesh.geometry) geometries.add(mesh.geometry)
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of list) materials.add(material)
  })
  for (const material of materials) {
    for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) (value as Texture).dispose()
    material.dispose()
  }
  for (const geometry of geometries) geometry.dispose()
}
```

- [ ] **Step 6: Créer `src/zones/office/outdoor/Sky.tsx` et `src/zones/office/outdoor/Clouds.tsx`**

`src/zones/office/outdoor/Sky.tsx` (dôme dessiné en premier, `renderOrder` −100, sans écriture de profondeur) :

```tsx
// Ported from Horn.os (owner's project): js/scene/city.js (buildSky)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { useLightingApplier } from '../lighting/live'
import { PRESETS, SUN_TARGET } from '../lighting/presets'
import { OUTDOOR } from './cityPlan'
import { disposeTree } from './resources'
import { SKY_FRAGMENT, SKY_VERTEX } from './shaders'

function buildSky() {
  const day = PRESETS.day
  const uniforms = {
    uTop: { value: day.skyTop.clone() },
    uHorizon: { value: day.skyHorizon.clone() },
    uSunDir: { value: new Vector3().subVectors(day.sunPosition, SUN_TARGET).normalize() },
    uSunColor: { value: day.sunDisc.clone() },
    uSunSize: { value: day.sunSize },
    uStars: { value: day.stars },
    uTime: { value: 0 },
  }
  const material = new ShaderMaterial({ uniforms, side: BackSide, depthWrite: false, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT })
  const mesh = new Mesh(new SphereGeometry(OUTDOOR.domeRadius, 48, 24), material)
  mesh.name = 'sky'
  mesh.renderOrder = -100 // drawn first, behind everything
  return { mesh, uniforms }
}

/** The sky dome: horizon-to-zenith gradient, a sun disc that follows the directional light, stars at night. */
export function Sky() {
  const sky = useMemo(buildSky, [])
  useEffect(() => () => disposeTree(sky.mesh), [sky])
  useLightingApplier((p) => {
    const u = sky.uniforms
    u.uTop.value.copy(p.skyTop)
    u.uHorizon.value.copy(p.skyHorizon)
    u.uSunDir.value.subVectors(p.sunPosition, SUN_TARGET).normalize()
    u.uSunColor.value.copy(p.sunDisc)
    u.uSunSize.value = p.sunSize
    u.uStars.value = p.stars
  })
  useFrame(({ clock }) => {
    sky.uniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={sky.mesh} />
}
```

`src/zones/office/outdoor/Clouds.tsx` (nuages et oiseaux ; les oiseaux sont placés une première fois à la construction, pour ne jamais apparaître à l'origine du groupe) :

```tsx
// Ported from Horn.os (owner's project): js/scene/city.js (buildClouds, buildBirds)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type Texture,
} from 'three'
import { appStore } from '../../../core/store'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { OUTDOOR, seeded } from './cityPlan'
import { canvasTexture, disposeTree } from './resources'

/* Clouds: cumulus with flat, shaded bases, and high cirrus streaks. */

function cumulusTexture(seed: number) {
  return canvasTexture(512, 256, (g, w, h) => {
    const r = seeded(seed)
    const base = h * 0.72
    for (let i = 0; i < 60; i++) {
      const x = 70 + r() * 370
      const spread = 1 - Math.abs(x - 256) / 200
      const y = base - r() * 90 * Math.max(0.2, spread)
      const rad = 18 + r() * 42 * Math.max(0.3, spread)
      const grd = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad)
      grd.addColorStop(0, 'rgba(255,255,255,0.9)')
      grd.addColorStop(0.6, 'rgba(245,247,250,0.6)')
      grd.addColorStop(1, 'rgba(235,240,246,0)')
      g.fillStyle = grd
      g.beginPath()
      g.arc(x, y, rad, 0, Math.PI * 2)
      g.fill()
    }
    // shade the underside and cut it flat
    g.globalCompositeOperation = 'source-atop'
    const sh = g.createLinearGradient(0, base - 70, 0, base + 10)
    sh.addColorStop(0, 'rgba(160,172,190,0)')
    sh.addColorStop(1, 'rgba(150,162,182,0.75)')
    g.fillStyle = sh
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'destination-out'
    const cut = g.createLinearGradient(0, base, 0, base + 18)
    cut.addColorStop(0, 'rgba(0,0,0,0)')
    cut.addColorStop(1, 'rgba(0,0,0,1)')
    g.fillStyle = cut
    g.fillRect(0, base, w, h - base)
  })
}

function cirrusTexture(seed: number) {
  return canvasTexture(512, 128, (g, w, h) => {
    const r = seeded(seed)
    for (let i = 0; i < 90; i++) {
      const x = r() * w
      const y = h / 2 + (r() - 0.5) * 50
      g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`
      g.lineWidth = 2 + r() * 6
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + 60, y - 8 + r() * 16, x + 120 + r() * 80, y + (r() - 0.5) * 20)
      g.stroke()
    }
  })
}

function buildClouds() {
  const group = new Group()
  group.name = 'clouds'
  const r = seeded(31)
  const materials: MeshBasicMaterial[] = []
  const add = (texture: Texture, w: number, h: number, x: number, y: number, z: number, speed: number, opacity: number) => {
    const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false, opacity })
    material.userData.base = opacity
    materials.push(material)
    const mesh = new Mesh(new PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.rotation.y = Math.PI / 2
    mesh.userData.speed = speed
    group.add(mesh)
  }
  for (let i = 0; i < 16; i++) {
    const w = 60 + r() * 110
    add(cumulusTexture(100 + i), w, w * 0.5, -170 - r() * 200, 45 + r() * 70, -260 + r() * 520, 0.6 + r() * 1.2, 0.95)
  }
  for (let i = 0; i < 5; i++) add(cirrusTexture(200 + i), 260, 60, -360, 150 + r() * 40, -240 + r() * 480, 0.3, 0.8)
  return { group, materials }
}

/** Drifting clouds, tinted by the phase; still when the user asks for reduced motion. */
export function Clouds() {
  const clouds = useMemo(buildClouds, [])
  useEffect(() => () => disposeTree(clouds.group), [clouds])
  useLightingApplier((p) => {
    for (const material of clouds.materials) {
      material.color.copy(p.cloudColor)
      material.opacity = p.cloudOpacity * (material.userData.base as number)
    }
  })
  useFrame((_, delta) => {
    if (appStore.getState().reducedMotion) return
    const dt = Math.min(0.05, delta)
    for (const cloud of clouds.group.children) {
      cloud.position.z += (cloud.userData.speed as number) * dt
      if (cloud.position.z > OUTDOOR.cloudWrap) cloud.position.z = -OUTDOOR.cloudWrap
    }
  })
  return <primitive object={clouds.group} />
}

/* Birds: two small flocks crossing the sky by day. */

interface Flock {
  birds: Group[]
  x: number
  y: number
  z: number
  speed: number
}

function buildBirds() {
  const group = new Group()
  group.name = 'birds'
  const r = seeded(51)
  const material = new MeshBasicMaterial({ color: tints.city.bird, side: DoubleSide, fog: true })
  const wing = new BufferGeometry()
  wing.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0.9, 0.05, -0.15, 0.15, 0, 0.35], 3))
  const flocks: Flock[] = []
  for (let f = 0; f < 2; f++) {
    const flock: Flock = { birds: [], x: -60 - r() * 60, y: OUTDOOR.groundY + 40 + r() * 25, z: -150 + r() * 100, speed: 7 + r() * 3 }
    for (let i = 0; i < 7; i++) {
      const bird = new Group()
      const left = new Mesh(wing, material)
      const right = new Mesh(wing, material)
      right.scale.x = -1
      bird.add(left, right)
      bird.scale.setScalar(0.9)
      bird.userData = { left, right, off: new Vector3((r() - 0.5) * 4, (r() - 0.5) * 2, -Math.abs(i - 3) * 2.2), phase: r() * 6 }
      group.add(bird)
      flock.birds.push(bird)
    }
    flocks.push(flock)
  }
  const update = (t: number, dt: number) => {
    for (const flock of flocks) {
      flock.z += flock.speed * dt
      if (flock.z > 220) flock.z = -220
      for (const bird of flock.birds) {
        const u = bird.userData as { left: Mesh; right: Mesh; off: Vector3; phase: number }
        bird.position.set(flock.x + u.off.x, flock.y + u.off.y + Math.sin(t * 0.6 + u.phase) * 0.8, flock.z + u.off.z)
        const flap = Math.sin(t * 9 + u.phase) * 0.6
        u.left.rotation.z = flap
        u.right.rotation.z = -flap
      }
    }
  }
  update(0, 0)
  return { group, update }
}

/** Birds by day only, and never when the user asks for reduced motion. */
export function Birds() {
  const birds = useMemo(buildBirds, [])
  useEffect(() => () => disposeTree(birds.group), [birds])
  useLightingApplier((p) => {
    birds.group.visible = p.night < 0.6 && !appStore.getState().reducedMotion
  })
  useFrame(({ clock }, delta) => {
    if (birds.group.visible) birds.update(clock.elapsedTime, Math.min(0.05, delta))
  })
  return <primitive object={birds.group} />
}
```

- [ ] **Step 7: Créer `src/zones/office/outdoor/City.tsx` et `src/zones/office/outdoor/Street.tsx`**

`src/zones/office/outdoor/City.tsx` (les teintes des façades viennent de `tints.city` par style ; `Color.set` les convertit en linéaire, comme chez Horn) :

```tsx
// Ported from Horn.os (owner's project): js/scene/city.js (buildBuildings)
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import { useQualitySettings } from '../../../app/quality'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { PRESETS, SUN_TARGET } from '../lighting/presets'
import { CITY_STYLES, OUTDOOR, cityLayout, type RoofItem } from './cityPlan'
import { disposeTree } from './resources'
import { BEACON_FRAGMENT, BEACON_VERTEX, FACADE_FRAGMENT, FACADE_VERTEX } from './shaders'

/** Facade colours of each style (tints.ts), indexed by CITY_STYLES. */
const TONES: Record<number, readonly string[]> = {
  [CITY_STYLES.brick]: tints.city.brick,
  [CITY_STYLES.glass]: tints.city.glass,
  [CITY_STYLES.concrete]: tints.city.concrete,
  [CITY_STYLES.plaster]: tints.city.plaster,
}

function roofMesh(geometry: BufferGeometry, material: MeshStandardMaterial, items: RoofItem[]) {
  const mesh = new InstancedMesh(geometry, material, items.length)
  const matrix = new Matrix4()
  const identity = new Quaternion()
  items.forEach((item, i) => mesh.setMatrixAt(i, matrix.compose(new Vector3(item.x, item.y, item.z), identity, new Vector3(item.sx, item.sy, item.sz))))
  mesh.frustumCulled = false
  return mesh
}

function buildCity() {
  const { buildings, units, tanks, beacons } = cityLayout()
  const day = PRESETS.day

  // Buildings: one instanced unit box, the facades drawn in the shader.
  const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const uniforms = {
    uSunDir: { value: new Vector3().subVectors(day.sunPosition, SUN_TARGET).normalize() },
    uSunColor: { value: day.sunColor.clone().multiplyScalar(day.sunIntensity * 0.22) },
    uAmbient: { value: day.cityAmbient.clone() },
    uNight: { value: day.night },
    uTime: { value: 0 },
    uSky: { value: day.skyHorizon.clone() },
    uSkyTop: { value: day.skyTop.clone() },
    uFogColor: { value: day.skyHorizon.clone() },
    uFogNear: { value: OUTDOOR.fogNear },
    uFogFar: { value: OUTDOOR.fogFar },
  }
  const material = new ShaderMaterial({
    uniforms,
    defines: { GROUND_Y: OUTDOOR.groundY.toFixed(1) },
    vertexShader: FACADE_VERTEX,
    fragmentShader: FACADE_FRAGMENT,
  })
  const mesh = new InstancedMesh(geometry, material, buildings.length)
  mesh.name = 'buildings'
  const tones = new Float32Array(buildings.length * 3)
  const styles = new Float32Array(buildings.length)
  const matrix = new Matrix4()
  const identity = new Quaternion()
  const colour = new Color()
  buildings.forEach((b, i) => {
    mesh.setMatrixAt(i, matrix.compose(new Vector3(b.x, OUTDOOR.groundY, b.z), identity, new Vector3(b.w, b.h, b.d)))
    const list = TONES[b.style]
    colour.set(list[Math.floor(b.tone * list.length)])
    tones.set([colour.r, colour.g, colour.b], i * 3)
    styles[i] = b.style
  })
  geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 3))
  geometry.setAttribute('aStyle', new InstancedBufferAttribute(styles, 1))
  mesh.frustumCulled = false

  // Rooftop plant: air-handling units and water tanks on the lower roofs.
  const unitMesh = roofMesh(
    new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new MeshStandardMaterial({ color: tints.city.roofUnit, roughness: 0.7, metalness: 0.3 }),
    units,
  )
  const tankMesh = roofMesh(new CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0), new MeshStandardMaterial({ color: tints.city.waterTank, roughness: 0.9 }), tanks)

  // Aircraft warning lights on the towers.
  const beaconGeometry = new BufferGeometry()
  beaconGeometry.setAttribute('position', new BufferAttribute(new Float32Array(beacons.flatMap((b) => [b.x, b.y, b.z])), 3))
  beaconGeometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(beacons.map((b) => b.phase)), 1))
  const beaconUniforms = { uTime: { value: 0 }, uNight: { value: day.night } }
  const beaconPoints = new Points(
    beaconGeometry,
    new ShaderMaterial({
      uniforms: beaconUniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: BEACON_VERTEX,
      fragmentShader: BEACON_FRAGMENT,
    }),
  )
  beaconPoints.frustumCulled = false

  const group = new Group()
  group.name = 'city'
  group.add(mesh, unitMesh, tankMesh, beaconPoints)
  return { group, uniforms, beaconUniforms }
}

/** The city: instanced buildings whose windows light up at night, each on its own clock (frozen on the low tier). */
export function City() {
  const settings = useQualitySettings()
  const city = useMemo(buildCity, [])
  useEffect(() => () => disposeTree(city.group), [city])
  useLightingApplier((p) => {
    const u = city.uniforms
    u.uSunDir.value.subVectors(p.sunPosition, SUN_TARGET).normalize()
    u.uSunColor.value.copy(p.sunColor).multiplyScalar(p.sunIntensity * 0.22)
    u.uAmbient.value.copy(p.cityAmbient)
    u.uNight.value = p.night
    u.uSky.value.copy(p.skyHorizon)
    u.uSkyTop.value.copy(p.skyTop)
    u.uFogColor.value.copy(p.skyHorizon)
    city.beaconUniforms.uNight.value = p.night
  })
  useFrame(({ clock }) => {
    if (settings.animateCityWindows) city.uniforms.uTime.value = clock.elapsedTime
    city.beaconUniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={city.group} />
}
```

`src/zones/office/outdoor/Street.tsx` (textures peintes au montage, comme chez Horn : quelques dizaines de millisecondes sur le fil principal, une fois) :

```tsx
// Ported from Horn.os (owner's project): js/scene/city.js (ground textures, buildTrees, buildStreet)
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Material,
} from 'three'
import { useSoftwareRenderer } from '../../../app/quality'
import { appStore } from '../../../core/store'
import { tints } from '../../../three/tints'
import { useLightingApplier } from '../lighting/live'
import { OUTDOOR, seeded } from './cityPlan'
import { canvasTexture, disposeTree } from './resources'
import { CAR_LIGHT_FRAGMENT, CAR_LIGHT_VERTEX, LAMP_GLOW_FRAGMENT, LAMP_GLOW_VERTEX } from './shaders'

const { groundY: GROUND_Y, streetX: STREET_X, park: PARK } = OUTDOOR

/* Ground textures, painted. */

function grassTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = tints.city.grass
      g.fillRect(0, 0, w, h)
      const r = seeded(3)
      for (let i = 0; i < 60; i++) {
        const grd = g.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 40 + r() * 90)
        grd.addColorStop(0, `rgba(${r() < 0.5 ? '90,120,60' : '120,140,70'},0.35)`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grd
        g.fillRect(0, 0, w, h)
      }
      for (let i = 0; i < 26000; i++) {
        const v = r()
        g.fillStyle = v < 0.33 ? 'rgba(60,90,40,0.5)' : v < 0.66 ? 'rgba(140,165,85,0.45)' : 'rgba(100,130,60,0.5)'
        g.fillRect(r() * w, r() * h, 1, 2 + r() * 3)
      }
    },
    { repeat: [120, 120] },
  )
}

function paverTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = tints.city.paving
      g.fillRect(0, 0, w, h)
      const r = seeded(8)
      const pw = 64
      const ph = 32
      for (let y = 0; y < h; y += ph) {
        const off = (y / ph) % 2 ? pw / 2 : 0
        for (let x = -pw; x < w + pw; x += pw) {
          const v = 170 + r() * 30
          g.fillStyle = `rgb(${v},${v - 4},${v - 10})`
          g.fillRect(x + off + 2, y + 2, pw - 4, ph - 4)
        }
      }
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(0,0,0,${r() * 0.08})`
        g.fillRect(r() * w, r() * h, 2, 2)
      }
    },
    { repeat: [8, 600] },
  )
}

function asphaltTexture() {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = tints.city.asphalt
      g.fillRect(0, 0, w, h)
      const r = seeded(12)
      for (let i = 0; i < 30000; i++) {
        const v = 40 + r() * 50
        g.fillStyle = `rgba(${v},${v},${v + 3},0.5)`
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = `rgba(20,20,22,${0.15 + r() * 0.2})`
        g.fillRect(r() * w, r() * h, 30 + r() * 120, 20 + r() * 60)
      }
    },
    { repeat: [2, 90] },
  )
}

function gravelTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = tints.city.gravel
      g.fillRect(0, 0, w, h)
      const r = seeded(15)
      for (let i = 0; i < 9000; i++) {
        const v = 150 + r() * 70
        g.fillStyle = `rgba(${v},${v - 10},${v - 30},0.6)`
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
      }
    },
    { repeat: [2, 160] },
  )
}

/* Trees: trunk, branches, and cards of painted leaves. */

function foliageTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = seeded(21)
    const cx = w / 2
    const cy = h / 2
    const greens = [
      [78, 112, 52],
      [96, 132, 60],
      [62, 96, 44],
      [110, 142, 70],
    ]
    for (let i = 0; i < 4200; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * (w * 0.44)
      const x = cx + Math.cos(a) * d
      const y = cy + Math.sin(a) * d * 0.9
      const shade = 0.55 + 0.45 * (1 - y / h) * (0.7 + 0.3 * r()) // lighter on top
      const base = greens[Math.floor(r() * 4)]
      g.fillStyle = `rgb(${Math.round(base[0] * shade)},${Math.round(base[1] * shade)},${Math.round(base[2] * shade)})`
      g.save()
      g.translate(x, y)
      g.rotate(r() * Math.PI)
      g.beginPath()
      g.ellipse(0, 0, 7 + r() * 7, 3.5 + r() * 3.5, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  })
}

function buildTrees(r: () => number) {
  const spots: [number, number, number][] = []
  for (const side of [-1, 1]) for (let z = -130; z < 130; z += 8 + r() * 3) spots.push([STREET_X + side * 6.8 + (r() - 0.5) * 0.6, z, 0.9 + r() * 0.35])
  for (let i = 0; i < 150; i++) spots.push([PARK.x0 - 3 - r() * (PARK.x0 - PARK.x1 - 6), -150 + r() * 300, 0.8 + r() * 0.6])

  const trunkGeometry = new CylinderGeometry(0.12, 0.24, 5, 8).translate(0, 2.5, 0)
  const branchGeometry = new CylinderGeometry(0.03, 0.09, 2.6, 6).translate(0, 1.3, 0)
  const cardGeometry = new PlaneGeometry(1, 1)
  const trunks: Matrix4[] = []
  const branches: Matrix4[] = []
  const cards: Matrix4[] = []
  const cardTint: number[] = []
  const q = new Quaternion()
  const e = new Euler()
  for (const [x, z, s] of spots) {
    trunks.push(new Matrix4().compose(new Vector3(x, GROUND_Y, z), q.identity(), new Vector3(s, s, s)))
    const crown = new Vector3(x, GROUND_Y + 6.6 * s, z)
    for (let k = 0; k < 4; k++) {
      e.set(0.55 + r() * 0.35, r() * Math.PI * 2, 0, 'YXZ')
      branches.push(new Matrix4().compose(new Vector3(x, GROUND_Y + (3.4 + r() * 1.2) * s, z), new Quaternion().setFromEuler(e), new Vector3(s, s, s)))
    }
    for (let k = 0; k < 30; k++) {
      // points in a squashed ellipsoid, denser towards the outside
      const a = r() * Math.PI * 2
      const up = r() * 2 - 1
      const rad = 0.55 + 0.45 * Math.sqrt(r())
      const dir = new Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up))
      const p = crown.clone().add(new Vector3(dir.x * 2.4 * s * rad, dir.y * 1.8 * s * rad, dir.z * 2.4 * s * rad))
      e.set((r() - 0.5) * 1.2, r() * Math.PI * 2, (r() - 0.5) * 0.6, 'YXZ')
      const size = (1.7 + r() * 1.1) * s
      cards.push(new Matrix4().compose(p, new Quaternion().setFromEuler(e), new Vector3(size, size, size)))
      // darker inside and underneath: a cheap ambient occlusion
      cardTint.push(0.62 + 0.38 * (0.5 + 0.5 * dir.y) * (0.7 + 0.3 * rad) + (r() - 0.5) * 0.1)
    }
  }
  const bark = new MeshStandardMaterial({ color: tints.city.trunk, roughness: 1 })
  const trunkMesh = new InstancedMesh(trunkGeometry, bark, trunks.length)
  trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m))
  const branchMesh = new InstancedMesh(branchGeometry, bark, branches.length)
  branches.forEach((m, i) => branchMesh.setMatrixAt(i, m))
  const leaves = new MeshStandardMaterial({ map: foliageTexture(), alphaTest: 0.5, side: DoubleSide, roughness: 0.9 })
  const cardMesh = new InstancedMesh(cardGeometry, leaves, cards.length)
  const c = new Color()
  cards.forEach((m, i) => {
    cardMesh.setMatrixAt(i, m)
    cardMesh.setColorAt(i, c.setRGB(cardTint[i], cardTint[i] * (0.98 + r() * 0.06), cardTint[i] * 0.95))
  })
  for (const mesh of [trunkMesh, branchMesh, cardMesh]) mesh.frustumCulled = false
  return [trunkMesh, branchMesh, cardMesh]
}

/* The street: road, pavements, park, trees, lamps, traffic. */

interface Car {
  dir: number
  lane: number
  z: number
  speed: number
  colour: string
}

function buildStreet() {
  const group = new Group()
  group.name = 'street'
  const r = seeded(19)
  const flat = (w: number, d: number, material: Material, x: number, y: number, z: number, rotZ = 0) => {
    const mesh = new Mesh(new PlaneGeometry(w, d), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = rotZ
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  flat(900, 900, new MeshStandardMaterial({ map: grassTexture(), roughness: 1 }), -200, GROUND_Y - 0.02, 0)
  flat(9, 400, new MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.92 }), STREET_X, GROUND_Y, 0)
  const pavers = new MeshStandardMaterial({ map: paverTexture(), roughness: 0.95 })
  for (const side of [-1, 1]) flat(4, 400, pavers, STREET_X + side * 6.5, GROUND_Y + 0.12, 0)
  // kerbs
  const kerbMaterial = new MeshStandardMaterial({ color: tints.city.kerb, roughness: 0.9 })
  for (const side of [-1, 1]) {
    const kerb = new Mesh(new BoxGeometry(0.3, 0.14, 400), kerbMaterial)
    kerb.position.set(STREET_X + side * 4.6, GROUND_Y + 0.05, 0)
    group.add(kerb)
  }
  // the park: a gravel path, low hedges along its edge
  flat(3, 400, new MeshStandardMaterial({ map: gravelTexture(), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, GROUND_Y + 0.01, 0, 0.12)
  const hedge = new Mesh(new BoxGeometry(1.1, 1.0, 400), new MeshStandardMaterial({ color: tints.city.hedge, roughness: 1 }))
  hedge.position.set(PARK.x0 - 3.2, GROUND_Y + 0.5, 0)
  group.add(hedge)
  // lane markings
  const dash = new InstancedMesh(new PlaneGeometry(0.15, 2.5).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: tints.city.laneMark }), 80)
  const m4 = new Matrix4()
  for (let i = 0; i < 80; i++) dash.setMatrixAt(i, m4.makeTranslation(STREET_X, GROUND_Y + 0.02, -200 + i * 5))
  group.add(dash)

  // Always built (the seeded draws of what follows stay the same); Street hides them without a GPU (see below).
  const trees = buildTrees(r)
  group.add(...trees)

  // Street lamps on the near pavement, with glows that come on in the evening.
  const lampPositions: Vector3[] = []
  for (let z = -100; z < 100; z += 18) lampPositions.push(new Vector3(STREET_X + 5, GROUND_Y, z + 4))
  const pole = new InstancedMesh(
    new CylinderGeometry(0.07, 0.1, 5.5, 6).translate(0, 2.75, 0),
    new MeshStandardMaterial({ color: tints.city.lampPole, roughness: 0.6 }),
    lampPositions.length,
  )
  lampPositions.forEach((p, i) => pole.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)))
  group.add(pole)
  const glowGeometry = new BufferGeometry()
  glowGeometry.setAttribute('position', new BufferAttribute(new Float32Array(lampPositions.flatMap((p) => [p.x - 0.4, p.y + 5.5, p.z])), 3))
  const glowUniforms = { uOn: { value: 0 }, uColor: { value: new Color(tints.city.lampGlow) }, uSize: { value: 1400 } }
  const glows = new Points(
    glowGeometry,
    new ShaderMaterial({
      uniforms: glowUniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: LAMP_GLOW_VERTEX,
      fragmentShader: LAMP_GLOW_FRAGMENT,
    }),
  )
  glows.frustumCulled = false
  group.add(glows)

  // Traffic: cars both ways, with headlights and tail lights.
  const N = 26
  const bodies = tints.city.carBodies
  const cars: Car[] = []
  for (let i = 0; i < N; i++) {
    const dir = i % 2 ? 1 : -1
    cars.push({ dir, lane: STREET_X + dir * -1.9, z: -180 + r() * 360, speed: 7 + r() * 6, colour: bodies[Math.floor(r() * bodies.length)] })
  }
  const body = new InstancedMesh(new BoxGeometry(1.8, 1.1, 4.2).translate(0, 0.75, 0), new MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 }), N)
  const cabin = new InstancedMesh(
    new BoxGeometry(1.6, 0.6, 2.2).translate(0, 1.55, -0.2),
    new MeshStandardMaterial({ color: tints.city.carCabin, roughness: 0.2, metalness: 0.6 }),
    N,
  )
  cars.forEach((car, i) => body.setColorAt(i, new Color(car.colour)))
  const lightUniforms: { uNight: { value: number }; uColor: { value: Color } }[] = []
  const lightMaterial = (colour: string) => {
    const uniforms = { uNight: { value: 0 }, uColor: { value: new Color(colour) } }
    lightUniforms.push(uniforms)
    return new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: CAR_LIGHT_VERTEX,
      fragmentShader: CAR_LIGHT_FRAGMENT,
    })
  }
  const heads = new InstancedMesh(new PlaneGeometry(1.5, 0.22).translate(0, 0.8, 2.12), lightMaterial(tints.city.headlight), N)
  const tails = new InstancedMesh(new PlaneGeometry(1.5, 0.18).rotateY(Math.PI).translate(0, 0.85, -2.12), lightMaterial(tints.city.taillight), N)
  group.add(body, cabin, heads, tails)
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  const unit = new Vector3(1, 1, 1)
  const place = () => {
    cars.forEach((car, i) => {
      q.setFromAxisAngle(up, car.dir > 0 ? 0 : Math.PI)
      m4.compose(new Vector3(car.lane, GROUND_Y, car.z), q, unit)
      body.setMatrixAt(i, m4)
      cabin.setMatrixAt(i, m4)
      heads.setMatrixAt(i, m4)
      tails.setMatrixAt(i, m4)
    })
    for (const mesh of [body, cabin, heads, tails]) mesh.instanceMatrix.needsUpdate = true
  }
  place()
  for (const mesh of [body, cabin, heads, tails, dash, pole]) mesh.frustumCulled = false

  return {
    group,
    trees,
    glowUniforms,
    lightUniforms,
    update(dt: number) {
      for (const car of cars) {
        car.z += car.dir * car.speed * dt
        if (car.z > 190) car.z = -190
        if (car.z < -190) car.z = 190
      }
      place()
    },
  }
}

/**
 * The street eight floors down: road, pavements, trees, the park; lamps and car lights come on with the night.
 * Without a GPU (the e2e browser), the trees stay hidden: their 6 000 alpha-tested foliage cards cost more than the
 * rest of the frame, and no journey looks at them.
 */
export function Street() {
  const street = useMemo(buildStreet, [])
  const software = useSoftwareRenderer()
  useEffect(() => () => disposeTree(street.group), [street])
  useLayoutEffect(() => {
    for (const tree of street.trees) tree.visible = !software
  }, [street, software])
  useLightingApplier((p) => {
    street.glowUniforms.uOn.value = Math.max(0, p.night * 1.1 - 0.1)
    for (const uniforms of street.lightUniforms) uniforms.uNight.value = p.night
  })
  useFrame((_, delta) => {
    // Traffic stands still when the user asks for reduced motion.
    if (!appStore.getState().reducedMotion) street.update(Math.min(0.05, delta))
  })
  return <primitive object={street.group} />
}
```

- [ ] **Step 8: Créer `src/zones/office/outdoor/Outdoor.tsx` et l'ajouter à la scène**

```tsx
// Ported from Horn.os (owner's project): js/scene/city.js (buildCity)
import { useThree } from '@react-three/fiber'
import { useLightingApplier } from '../lighting/live'
import { City } from './City'
import { OUTDOOR } from './cityPlan'
import { Birds, Clouds } from './Clouds'
import { Sky } from './Sky'
import { Street } from './Street'

/**
 * The view through the glazing: sky dome, clouds and birds, the city, the street eight floors down. Real geometry, so
 * the camera's moves give true parallax. Moved by OUTDOOR.originX so Horn.os' window wall lands on ours. Exempt from
 * the material audit (it is the sky, spec section 9); nothing out here casts or receives shadows. The scene fog
 * (OfficeScene) takes the horizon colour of the phase, so the distant city melts into the sky.
 */
export function Outdoor() {
  const scene = useThree((state) => state.scene)
  useLightingApplier((p) => {
    scene.fog?.color.copy(p.skyHorizon)
  })
  return (
    <group name="outdoor" position-x={OUTDOOR.originX} userData={{ auditExempt: 'sky' }}>
      <Sky />
      <Clouds />
      <Birds />
      <City />
      <Street />
    </group>
  )
}
```

Dans `src/zones/office/OfficeScene.tsx` (état de la Tâche 7 → état de la Tâche 8), remplacer exactement la ligne

```tsx
import { PhaseDriver } from './lighting/PhaseDriver'
```

par

```tsx
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
```

puis la ligne

```tsx
      <color attach="background" args={[brand.ink]} />
```

par (le brouillard est un enfant direct de la scène : un `attach="fog"` dans un groupe s'attacherait au groupe)

```tsx
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
```

puis le bloc

```tsx
      <Lights settings={settings} />
      <Room />
```

par

```tsx
      <Lights settings={settings} />
      <Outdoor />
      <Room />
```

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Vérifier le projet**

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » ≈ 0,52 MB (mesuré dans le scratch du plan avec les Tâches 1 à 8 ; budget 1,50 MB) ; `No test API (__academy) in the production JS`.

- [ ] **Step 10: Parcours e2e du bureau (rendu logiciel, socle plus lourd)**

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS (9 tests), et le test le plus long (« scroll to the presentation view, learn a topic and keep the progress ») sous 54 s, 60 % de son délai de 90 s. Mesuré dans le scratch du plan avec la règle des rastériseurs logiciels (Tâche 7 : niveau `low`, `SOFTWARE_DPR` 0,35) et les arbres de la rue cachés : suite en 2,3 min, test le plus long en 38,7 s, socle prêt en 5 s environ. À demi-résolution avec les arbres visibles, ce test prenait 84 s sur 90 (les 6 000 cartes de feuillage coûtaient plus que tout le reste de l'image). Les Tâches 9 à 14 ajoutent le mobilier et le décor sur cette marge (45,1 s mesurés après la Tâche 14) : un dépassement se traite en allégeant le rendu sur rastériseur logiciel, jamais en relevant un délai ni en retirant un parcours ; vérifier d'abord que `[data-testid="stage"]` porte `data-quality="low"` et que les arbres sont cachés.

Run: `git checkout -- docs/evidence/office`
Expected: les captures réécrites par l'e2e sont rétablies (Tâche 15).

- [ ] **Step 11: Captures de revue des trois phases**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-8 --phases day,sunset,night`
Expected: six fichiers, code de sortie 0. Les shaders du dehors compilent : dans le scratch du plan, la console n'a montré aucune erreur, seulement l'avertissement de précision X4122 du compilateur D3D sur un chunk interne de three.

Ce que le contrôleur regarde : par la baie, le jour, un ciel bleu dégradé vers un horizon clair, des nuages, des immeubles de brique, de verre, de béton et d'enduit avec leurs fenêtres, les arbres et la rue en contrebas, la ville lointaine fondue dans la couleur de l'horizon ; au coucher, ciel orangé, façades chaudes, premières fenêtres allumées ; la nuit, ciel bleu nuit étoilé, fenêtres allumées irrégulièrement, réverbères, phares, balises rouges des tours. En vue présentation, la ville derrière Ada dans le retour vitré. Rien du dehors ne se voit à travers les murs ; le dôme n'est coupé nulle part. Si une couleur du dehors détonne, la régler seulement dans `presets.ts` (`skyTop`, `skyHorizon`, `sunDisc`, `cityAmbient`, `cloudColor`, `cloudOpacity`) puis relancer `npx vitest run src/zones/office` et cette étape ; citer les valeurs changées dans le message de commit.

- [ ] **Step 12: Commit**

```bash
git add src/zones/office/outdoor src/zones/office/OfficeScene.tsx
git commit -m "feat: sky dome and instanced city ported from Horn.os, driven by the day cycle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Mobilier en code (table, chaises, micros, laptop) et Ada

**Files:**
- Create: `src/three/shapes.ts`, `src/three/props/chairParts.ts`, `src/three/props/ChairSet.tsx`
- Modify: `src/three/props/Table.tsx`, `src/three/props/Microphone.tsx`, `src/three/props/Laptop.tsx`, `src/three/robot/Ada.tsx` (réécritures complètes), `src/three/objects.tsx` (retrait de `'chair'`), `src/zones/office/OfficeScene.tsx` (état de la Tâche 9)
- Delete: `src/three/props/Chair.tsx`
- Test: `src/three/shapes.test.ts`, `src/three/props/chairParts.test.ts`

**Interfaces:**
- Consumes (Tâche 4) : `useMaterials(): Materials` et ses clés `oak`, `blackMetal`, `chairFabric`, `brushedMetal`, `limeGlow`, `porcelain`, `logoLime`, `logoMint`, `consoleDark` (`src/three/materials.ts`) ; `metreUVs<T extends BufferGeometry>(geometry: T, options?: { offset?: [number, number]; swap?: boolean }): T` (`src/three/uv.ts`) ; `interface Part { geometry: BufferGeometry; matrix?: Matrix4; colour?: Color }`, `mergeParts(parts: readonly Part[], options?: { colours?: boolean }): BufferGeometry`, `at(x: number, y: number, z: number, rotation?: [number, number, number], scale?: number): Matrix4` (`src/three/merge.ts`) ; `tints.visor` (`src/three/tints.ts`).
- Consumes (Tâche 5, `src/zones/office/layout.ts`) : `TABLE` (`radii`, `topY`, `topThickness` 0.04, `edgeRadius` 0.015), `type Placement`, `layout.objects.chairs` (= `chairRing()`) ; `OfficeScene.tsx` dans son état de la Tâche 8.
- Produces (`src/three/shapes.ts`) : `roundedBox(w: number, h: number, d: number, r = 0.008, curve = 3): BufferGeometry` (boîte centrée de taille exacte, rayon plafonné au tiers du plus petit côté, UV en mètres, géométrie indexée, mise en cache par arguments : ne jamais la libérer) ; `racetrackTop(width: number, length: number, thickness: number, edgeRadius: number): BufferGeometry` (plateau en stade, x = largeur, z = longueur, y de 0 à `thickness`, UV en mètres, indexé) ; `between(a: Vector3, b: Vector3, r0: number, r1: number, segments = 14): Part` (cylindre effilé de `a` à `b`, UV à reprojeter après fusion).
- Produces (`src/three/props/chairParts.ts`) : `CHAIR = { seatTop: 0.46, backTop: 0.9, half: 0.28 }`, `interface ChairParts { shell: BufferGeometry; base: BufferGeometry }`, `chairParts(): ChairParts` (mêmes objets à chaque appel).
- Produces (`src/three/props/ChairSet.tsx`) : `ChairSet({ placements }: { placements: Placement[] })` — groupe `chairs`, deux `<Instances>` drei (coque `chairFabric`, piètement `blackMetal`), instances de la coque nommées `chair-<i>`.
- Produces (`src/three/objects.tsx`) : `ObjectName` sans `'chair'` (le reste du fichier est inchangé jusqu'à la Tâche 10).

Trois choix de `shapes.ts`, par rapport à Horn.os : la taille est exacte (le biseau d'une extrusion three.js élargit le contour de `bevel` de chaque côté ; on part d'un contour réduit d'autant), les UV sont en mètres (`metreUVs`, donc chaque matériau répète sa texture tous les `tileMetres`), et la géométrie est indexée (`mergeVertices`). Ce dernier point compte pour le contour de survol : `Outlines` de drei appelle `toCreasedNormals` sur la géométrie de son parent, qui réécrit les normales en place si la géométrie n'est pas indexée et la libère au démontage ; sur une géométrie indexée, il travaille sur une copie. Les géométries des accessoires uniques sont construites une fois au niveau du module (comme `chairParts()`), jamais libérées : le bureau vit autant que la page.

Ada : la géométrie, le visage et les gestes ne changent pas (`face.test.ts`, `geometry.test.ts`, `motion.test.ts` passent sans modification). Les deux littéraux hexadécimaux de la visière disparaissent (`tints.visor`, `brand.onDark`), ce que vérifiera `colours.test.ts` (Tâche 15). Les carrés « ink » du logo de poitrine restent sombres (`consoleDark`, texturé) : avec `logoInk` (blanc émissif) ils disparaîtraient sur la coque blanche.

- [ ] **Step 1: Écrire le test qui échoue `src/three/shapes.test.ts`**

```ts
import { Box3, CylinderGeometry, Vector3, type BufferGeometry } from 'three'
import { between, racetrackTop, roundedBox } from './shapes'

function bounds(geometry: BufferGeometry): Box3 {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}

function expectBox(geometry: BufferGeometry, min: [number, number, number], max: [number, number, number]) {
  const box = bounds(geometry)
  box.min.toArray().forEach((value, i) => expect(value).toBeCloseTo(min[i], 5))
  box.max.toArray().forEach((value, i) => expect(value).toBeCloseTo(max[i], 5))
}

/** Largest extent of the uv attribute along u or v. */
function uvSpan(geometry: BufferGeometry): number {
  const uv = geometry.getAttribute('uv')
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (let i = 0; i < uv.count; i++) {
    u0 = Math.min(u0, uv.getX(i))
    u1 = Math.max(u1, uv.getX(i))
    v0 = Math.min(v0, uv.getY(i))
    v1 = Math.max(v1, uv.getY(i))
  }
  return Math.max(u1 - u0, v1 - v0)
}

test('the racetrack top spans exactly its width and length', () => {
  const top = racetrackTop(2.5, 5.0, 0.04, 0.015)
  expectBox(top, [-1.25, 0, -2.5], [1.25, 0.04, 2.5])
  expect(top.index).not.toBeNull()
  // Straight sides for |z| <= 1.25, semicircular ends of radius 1.25 beyond: no vertex outside the stadium
  // (to 0.1 mm: the bevel of a polygonal arc bulges by a few micrometres at its corners).
  const position = top.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const beyond = Math.max(0, Math.abs(position.getZ(i)) - 1.25)
    expect(Math.hypot(x, beyond)).toBeLessThanOrEqual(1.25 + 1e-4)
  }
  // UVs in metres: the top face spans almost 5 m along its length (the rounded edge takes the last millimetres).
  expect(uvSpan(top)).toBeGreaterThan(4.9)
  expect(uvSpan(top)).toBeLessThanOrEqual(5 + 1e-6)
})

test('rounded boxes cap their radius at a third of the smallest side', () => {
  // A 6 cm board asked for a 50 cm radius gets 2 cm, the same geometry as asking for 2 cm.
  expect(roundedBox(1, 1, 0.06, 0.5)).toBe(roundedBox(1, 1, 0.06, 0.02))
  expectBox(roundedBox(1, 1, 0.06, 0.5), [-0.5, -0.5, -0.03], [0.5, 0.5, 0.03])
  // Exact sizes whichever axis is the thinnest (the extrusion axis turns with it).
  expectBox(roundedBox(0.5, 0.3, 0.1, 0.02), [-0.25, -0.15, -0.05], [0.25, 0.15, 0.05])
  expectBox(roundedBox(0.5, 0.1, 0.4, 0.02), [-0.25, -0.05, -0.2], [0.25, 0.05, 0.2])
  expectBox(roundedBox(0.1, 0.5, 0.3, 0.02), [-0.05, -0.25, -0.15], [0.05, 0.25, 0.15])
})

test('rounded boxes are cached by size', () => {
  const panel = roundedBox(0.34, 0.22, 0.012, 0.006)
  expect(roundedBox(0.34, 0.22, 0.012, 0.006)).toBe(panel)
  expect(roundedBox(0.34, 0.22, 0.013, 0.006)).not.toBe(panel)
  expect(panel.index).not.toBeNull()
  expect(Object.keys(panel.attributes).sort()).toEqual(['normal', 'position', 'uv'])
  expect(uvSpan(panel)).toBeLessThanOrEqual(0.34 + 1e-6)
})

test('between joins its two points', () => {
  const a = new Vector3(0.1, 0.06, 0)
  const b = new Vector3(0.3, 0.02, 0.2)
  const part = between(a, b, 0.016, 0.011, 10)
  const length = a.distanceTo(b)
  const cylinder = part.geometry as CylinderGeometry
  expect(cylinder.parameters).toMatchObject({ radiusBottom: 0.016, radiusTop: 0.011, radialSegments: 10 })
  expect(cylinder.parameters.height).toBeCloseTo(length)
  const start = new Vector3(0, -length / 2, 0).applyMatrix4(part.matrix!)
  const end = new Vector3(0, length / 2, 0).applyMatrix4(part.matrix!)
  expect(start.distanceTo(a)).toBeLessThan(1e-9)
  expect(end.distanceTo(b)).toBeLessThan(1e-9)
})
```

Run: `npx vitest run src/three/shapes.test.ts`
Expected: FAIL — `Failed to resolve import "./shapes" from "src/three/shapes.test.ts"`.

- [ ] **Step 2: Créer `src/three/shapes.ts`**

```ts
// Ported from Horn.os (owner's project): js/lib/shapes.js (roundedBox, along, between)
import { CylinderGeometry, ExtrudeGeometry, Matrix4, Quaternion, Shape, Vector3, type BufferGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Part } from './merge'
import { metreUVs } from './uv'

/*
 * Rounded shapes for the furniture built in code. Nothing in the real world has a knife edge: a BoxGeometry does, and a
 * room built from them reads as blocked out. Three changes from Horn.os: the sizes are exact (the bevel is taken inside
 * the outline instead of growing it), the UVs are in metres (each material repeats its texture per tileMetres), and the
 * geometries are indexed (drei's Outlines then outlines a copy instead of rewriting the normals of a shared geometry).
 */

const cache = new Map<string, BufferGeometry>()

function roundedRect(w: number, h: number, r: number): Shape {
  const shape = new Shape()
  const x = w / 2
  const y = h / 2
  const radius = Math.min(r, x * 0.999, y * 0.999)
  shape.moveTo(-x + radius, -y)
  shape.lineTo(x - radius, -y)
  shape.quadraticCurveTo(x, -y, x, -y + radius)
  shape.lineTo(x, y - radius)
  shape.quadraticCurveTo(x, y, x - radius, y)
  shape.lineTo(-x + radius, y)
  shape.quadraticCurveTo(-x, y, -x, y - radius)
  shape.lineTo(-x, -y + radius)
  shape.quadraticCurveTo(-x, -y, -x + radius, -y)
  return shape
}

/**
 * A centred box of exactly w x h x d with every edge softened by `r` (capped at a third of the smallest side, so a
 * thin panel never collapses), UVs in metres. Cached by its arguments: never dispose the result.
 */
export function roundedBox(w: number, h: number, d: number, r = 0.008, curve = 3): BufferGeometry {
  const radius = Math.max(0.0005, Math.min(r, Math.min(w, h, d) / 3))
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${radius.toFixed(4)}|${curve}`
  const hit = cache.get(key)
  if (hit) return hit
  // Extrude along the thinnest axis (Horn.os): the two large faces are the rounded rectangle itself.
  let a: number
  let b: number
  let t: number
  let spin: 'x' | 'y' | null
  if (d <= w && d <= h) [a, b, t, spin] = [w, h, d, null]
  else if (h <= w && h <= d) [a, b, t, spin] = [w, d, h, 'x']
  else [a, b, t, spin] = [d, h, w, 'y']
  const bevel = Math.min(radius, t / 2.01)
  // The bevel pushes the outline out by `bevel` all round: start from an outline that much smaller.
  const extruded = new ExtrudeGeometry(roundedRect(a - 2 * bevel, b - 2 * bevel, Math.max(0.0005, radius - bevel)), {
    depth: t - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: curve,
    curveSegments: curve + 1,
  })
  // The extrusion runs from -bevel to t - bevel: centre it.
  extruded.translate(0, 0, -t / 2 + bevel)
  if (spin === 'x') extruded.rotateX(-Math.PI / 2)
  else if (spin === 'y') extruded.rotateY(Math.PI / 2)
  const geometry = mergeVertices(metreUVs(extruded))
  extruded.dispose()
  cache.set(key, geometry)
  return geometry
}

/**
 * A stadium-shaped slab (the meeting table top): `width` along x, `length` along z with semicircular ends of radius
 * width / 2, from y = 0 to y = thickness, its edge rounded by `edgeRadius`. Exact size, UVs in metres, indexed.
 */
export function racetrackTop(width: number, length: number, thickness: number, edgeRadius: number): BufferGeometry {
  const bevel = Math.max(0.0005, Math.min(edgeRadius, thickness / 2.01, width / 4))
  const r = width / 2 - bevel
  const straight = Math.max(0, (length - width) / 2)
  const shape = new Shape()
  shape.moveTo(r, -straight)
  shape.lineTo(r, straight)
  shape.absarc(0, straight, r, 0, Math.PI, false)
  shape.lineTo(-r, -straight)
  shape.absarc(0, -straight, r, Math.PI, Math.PI * 2, false)
  const extruded = new ExtrudeGeometry(shape, {
    depth: thickness - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  })
  // Extrusion from -bevel to thickness - bevel, then laid flat: shape y becomes -z (symmetric), extrusion becomes +y.
  extruded.translate(0, 0, bevel)
  extruded.rotateX(-Math.PI / 2)
  const geometry = mergeVertices(metreUVs(extruded))
  extruded.dispose()
  return geometry
}

const UP = new Vector3(0, 1, 0)

/**
 * A tapered cylinder from `a` (radius r0) to `b` (radius r1), as a part for mergeParts: legs, stems and spokes join
 * their two points exactly. Its UVs are not in metres: run metreUVs on the merged geometry.
 */
export function between(a: Vector3, b: Vector3, r0: number, r1: number, segments = 14): Part {
  const direction = b.clone().sub(a)
  return {
    geometry: new CylinderGeometry(r1, r0, direction.length(), segments, 1, false),
    matrix: new Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()),
      new Vector3(1, 1, 1),
    ),
  }
}
```

Run: `npx vitest run src/three/shapes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Écrire le test qui échoue `src/three/props/chairParts.test.ts`**

```ts
import type { BufferGeometry } from 'three'
import { CHAIR, chairParts } from './chairParts'

function bounds(geometry: BufferGeometry) {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}

/** Vertices whose UV is not a pair of their own coordinates in metres (box projection: u is x or z, v is y or z). */
function nonMetreUVs(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-5
  let wrong = 0
  for (let i = 0; i < uv.count; i++) {
    const [x, y, z, u, v] = [position.getX(i), position.getY(i), position.getZ(i), uv.getX(i), uv.getY(i)]
    if (!(near(u, x) || near(u, z)) || !(near(v, y) || near(v, z))) wrong++
  }
  return wrong
}

test('chair parts stand on the floor with UVs in metres', () => {
  const { shell, base } = chairParts()
  const b = bounds(base)
  const s = bounds(shell)
  expect(b.min.y).toBeCloseTo(0, 6)
  // The seat rests on the seat plate; the back stays under 0.9 m.
  expect(s.min.y).toBeGreaterThanOrEqual(b.max.y - 0.001)
  expect(s.max.y).toBeLessThanOrEqual(CHAIR.backTop)
  expect(s.max.y).toBeGreaterThan(CHAIR.backTop - 0.05)
  for (const box of [b, s]) {
    for (const value of [box.min.x, box.max.x, box.min.z, box.max.z]) expect(Math.abs(value)).toBeLessThanOrEqual(CHAIR.half)
  }
  // Both parts are re-projected after merging (cylinders come with 0..1 UVs).
  expect(nonMetreUVs(base)).toBe(0)
  expect(nonMetreUVs(shell)).toBe(0)
})

test('all chairs share one geometry per part', () => {
  const first = chairParts()
  const second = chairParts()
  expect(second).toBe(first)
  expect(second.shell).toBe(first.shell)
  expect(second.base).toBe(first.base)
  expect(first.shell).not.toBe(first.base)
})
```

Run: `npx vitest run src/three/props/chairParts.test.ts`
Expected: FAIL — `Failed to resolve import "./chairParts" from "src/three/props/chairParts.test.ts"`.

- [ ] **Step 4: Créer `src/three/props/chairParts.ts`**

Coque : assise de 7 cm (dessus à 0.46 m) et dossier incliné de 0.12 rad (haut sous 0.9 m). Piètement : pastilles au sol, quatre branches en diagonale depuis un moyeu, colonne, platine sous l'assise. Les deux pièces sont reprojetées en mètres après fusion (les cylindres de `between` arrivent avec des UV 0..1).

```ts
import { Vector3, type BufferGeometry } from 'three'
import { at, mergeParts, type Part } from '../merge'
import { between, roundedBox } from '../shapes'
import { metreUVs } from '../uv'

/** Meeting chair, in metres: origin on the floor at its centre, front +z (footprint 0.56 x 0.9 x 0.56 in layout). */
export const CHAIR = { seatTop: 0.46, backTop: 0.9, half: 0.28 } as const

export interface ChairParts {
  /** Upholstered seat and back (chairFabric). */
  shell: BufferGeometry
  /** Four-spoke swivel base: glides, spokes, hub, column and seat plate (blackMetal). */
  base: BufferGeometry
}

function shellGeometry(): BufferGeometry {
  // Re-projected after merging, like the base: the fabric weave runs the same way on every chair part.
  return metreUVs(
    mergeParts([
      // Seat cushion, 7 cm thick, its top at 0.46 m.
      { geometry: roundedBox(0.5, 0.07, 0.48, 0.03), matrix: at(0, CHAIR.seatTop - 0.035, 0.01) },
      // Back, leaning 0.12 rad backwards, its top just under 0.9 m.
      { geometry: roundedBox(0.48, 0.42, 0.06, 0.025), matrix: at(0, 0.68, -0.22, [-0.12, 0, 0]) },
    ]),
  )
}

function baseGeometry(): BufferGeometry {
  const hub = new Vector3(0, 0.06, 0)
  const parts: Part[] = [
    between(new Vector3(0, 0.03, 0), new Vector3(0, 0.09, 0), 0.04, 0.035, 20),
    between(hub, new Vector3(0, 0.38, 0), 0.025, 0.022, 16),
    { geometry: roundedBox(0.3, 0.02, 0.3, 0.005), matrix: at(0, 0.38, 0) },
  ]
  // Four spokes on the diagonals, each ending on a small glide that stands on the floor.
  for (let k = 0; k < 4; k++) {
    const angle = Math.PI / 4 + (k * Math.PI) / 2
    const tip = new Vector3(Math.cos(angle) * 0.25, 0.025, Math.sin(angle) * 0.25)
    parts.push(between(hub, tip, 0.016, 0.011, 10))
    parts.push(between(new Vector3(tip.x, 0, tip.z), tip, 0.018, 0.018, 12))
  }
  // Cylinders come with 0..1 UVs: re-project the whole base in metres.
  return metreUVs(mergeParts(parts))
}

let parts: ChairParts | null = null

/** The two geometries shared by every chair, built once and never disposed (the office lives as long as the page). */
export function chairParts(): ChairParts {
  parts ??= { shell: shellGeometry(), base: baseGeometry() }
  return parts
}
```

Run: `npx vitest run src/three/props/chairParts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Créer `src/three/props/ChairSet.tsx`**

```tsx
import { Instance, Instances } from '@react-three/drei'
import type { Placement } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { chairParts } from './chairParts'

/**
 * The meeting chairs as two instanced meshes, the upholstered shell and the metal base, sharing the geometries of
 * chairParts(): two draw calls for all of them. One instance per placement, the shell instances named chair-<i>.
 * frustumCulled is off: an instanced mesh computes its bounding sphere once, possibly before the instances are placed,
 * and the chairs are on screen in every view anyway.
 */
export function ChairSet({ placements }: { placements: Placement[] }) {
  const m = useMaterials()
  const { shell, base } = chairParts()
  return (
    <group name="chairs">
      <Instances limit={placements.length} geometry={shell} material={m.chairFabric} castShadow receiveShadow frustumCulled={false}>
        {placements.map((chair, index) => (
          <Instance key={index} name={`chair-${index}`} position={chair.position} rotation-y={chair.rotationY ?? 0} />
        ))}
      </Instances>
      <Instances limit={placements.length} geometry={base} material={m.blackMetal} castShadow receiveShadow frustumCulled={false}>
        {placements.map((chair, index) => (
          <Instance key={index} position={chair.position} rotation-y={chair.rotationY ?? 0} />
        ))}
      </Instances>
    </group>
  )
}
```

- [ ] **Step 6: Réécrire `src/three/props/Table.tsx`, `src/three/props/Microphone.tsx` et `src/three/props/Laptop.tsx`**

`src/three/props/Table.tsx` :

```tsx
import type { BufferGeometry } from 'three'
import { TABLE } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { racetrackTop, roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Each T leg: a steel column on a foot bar across the table, at z = -1.3 and +1.3 from the centre. */
const LEG = { column: [0.08, 0.71, 0.08], foot: [0.9, 0.03, 0.12], z: 1.3 } as const

let parts: { top: BufferGeometry; legs: BufferGeometry } | null = null

function tableParts() {
  const [cw, ch, cd] = LEG.column
  const [fw, fh, fd] = LEG.foot
  parts ??= {
    // 2.5 x 5 m racetrack: the footprint of TABLE.radii, straight sides and semicircular ends (see tableHalfWidthAt).
    top: racetrackTop(TABLE.radii.x * 2, TABLE.radii.z * 2, TABLE.topThickness, TABLE.edgeRadius),
    legs: mergeParts(
      [-LEG.z, LEG.z].flatMap((z) => [
        { geometry: roundedBox(cw, ch, cd, 0.006), matrix: at(0, ch / 2, z) },
        { geometry: roundedBox(fw, fh, fd, 0.008), matrix: at(0, fh / 2, z) },
      ]),
    ),
  }
  return parts
}

/** Meeting table: oak racetrack top (its surface at TABLE.topY, 0.75 m) on two black steel T legs. Origin on the floor. */
export function Table(props: ObjectProps) {
  const m = useMaterials()
  const { top, legs } = tableParts()
  return (
    <group {...props}>
      <mesh geometry={top} position-y={TABLE.topY - TABLE.topThickness} material={m.oak} castShadow receiveShadow />
      <mesh geometry={legs} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
```

`src/three/props/Microphone.tsx` (mêmes dimensions et même inclinaison qu'avant) :

```tsx
import { CylinderGeometry, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

interface MicrophoneParts {
  base: BufferGeometry
  neck: BufferGeometry
  head: BufferGeometry
  ring: BufferGeometry
}

let parts: MicrophoneParts | null = null

/** Geometries shared by the six microphones, built once. */
function microphoneParts(): MicrophoneParts {
  parts ??= {
    base: roundedBox(0.1, 0.02, 0.07, 0.006),
    neck: metreUVs(new CylinderGeometry(0.005, 0.005, 0.34, 8)),
    head: metreUVs(new CylinderGeometry(0.012, 0.01, 0.05, 12)),
    ring: new CylinderGeometry(0.0125, 0.0125, 0.004, 12),
  }
  return parts
}

/** Conference microphone: brushed metal base and gooseneck, black head, lime ring. The gooseneck leans toward +z. */
export function Microphone(props: ObjectProps) {
  const m = useMaterials()
  const g = microphoneParts()
  return (
    <group {...props}>
      <mesh geometry={g.base} position-y={0.01} material={m.brushedMetal} castShadow receiveShadow />
      <group position-y={0.02} rotation-x={0.45}>
        <mesh geometry={g.neck} position-y={0.17} material={m.brushedMetal} castShadow />
        <mesh geometry={g.head} position-y={0.35} material={m.blackMetal} castShadow />
        <mesh geometry={g.ring} position-y={0.376} material={m.limeGlow} />
      </group>
    </group>
  )
}
```

`src/three/props/Laptop.tsx` (mêmes dimensions, image d'écran inchangée ; le plan d'écran est exempté `screen` ; les deux `HoverOutline` restent) :

```tsx
import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { brand } from '../../core/brand'
import { HoverOutline } from '../interactive'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
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

/** Aluminium laptop at the end of the table: base, lid leaning back 15 degrees, and its glowing screen (audit: screen). */
export function Laptop(props: ObjectProps) {
  const m = useMaterials()
  const texture = useMemo(screenTexture, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group {...props}>
      <mesh geometry={roundedBox(0.34, 0.018, 0.24, 0.008)} position-y={0.009} material={m.brushedMetal} castShadow receiveShadow>
        <HoverOutline />
      </mesh>
      {/* hinge at the back edge; the lid leans back 15 degrees */}
      <group position={[0, 0.018, -0.12]} rotation-x={-0.26}>
        <mesh geometry={roundedBox(0.34, 0.22, 0.012, 0.006)} position={[0, 0.11, -0.006]} material={m.brushedMetal} castShadow>
          <HoverOutline />
        </mesh>
        <mesh position={[0, 0.112, 0.0008]} userData={{ auditExempt: 'screen' }}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
```

- [ ] **Step 7: Réécrire `src/three/robot/Ada.tsx` (matériaux seulement)**

Diff par rapport au fichier actuel : `materials()` → `useMaterials()` ; ceinture `m.mint` → `m.limeGlow` ; logo de poitrine en `logoLime` / `logoMint` / `consoleDark` sur des `roundedBox` (UV en mètres pour le matériau texturé) ; visière `color={tints.visor}`, `emissive={brand.onDark}`, `userData={{ auditExempt: 'glass' }}` ; halo `userData={{ auditExempt: 'emissive' }}`. Tout le reste est identique.

```tsx
import type { ThreeElements } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, LatheGeometry, SRGBColorSpace, type Group } from 'three'
import type { Gesture, Mood } from '../../content/schema'
import { brand } from '../../core/brand'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import { tints } from '../tints'
import { FACE_H, FACE_W, drawFace, eyeShapes, faceKey, quantizePulse } from './face'
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
  gradient.addColorStop(0, `${brand.lime}e6`)
  gradient.addColorStop(1, `${brand.lime}00`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Arm() {
  const m = useMaterials()
  return (
    <mesh position-y={-ADA.armLength / 2} scale={[0.055, ADA.armLength / 2, 0.085]} material={m.porcelain} castShadow>
      <sphereGeometry args={[1, 24, 16]} />
    </mesh>
  )
}

/** The five-square mark on the chest: lime and mint glow; the "ink" squares stay dark on the white shell, as before. */
function ChestLogo() {
  const m = useMaterials()
  const byColor = { lime: m.logoLime, mint: m.logoMint, ink: m.consoleDark }
  const z = bodyRadiusAt(ADA.chestY) + 0.002
  return (
    <group position={[0, ADA.chestY, z]}>
      {logoBoxes(0.0011).map((box, index) => (
        <mesh
          key={index}
          geometry={roundedBox(box.size[0], box.size[1], 0.006, 0.001)}
          position={[box.position[0], box.position[1], 0]}
          material={byColor[box.color]}
        />
      ))}
    </group>
  )
}

export function Ada({ mood, gesture, gestureKey, speaking, reducedMotion, lookAt, ...group }: AdaProps) {
  const m = useMaterials()
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
    const pulse = speaking && !reducedMotion ? quantizePulse(0.5 + 0.5 * Math.sin(time * 18)) : 0
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
        <mesh position-y={ADA.beltY} rotation-x={Math.PI / 2} material={m.limeGlow}>
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
            {/* Black lacquered glass over the face: the face texture glows through it, unchanged. */}
            <meshPhysicalMaterial
              color={tints.visor}
              roughness={0.1}
              clearcoat={1}
              emissive={brand.onDark}
              emissiveMap={face.texture}
              emissiveIntensity={1.4}
              toneMapped={false}
              userData={{ auditExempt: 'glass' }}
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
      <mesh position-y={-0.02} rotation-x={-Math.PI / 2} raycast={() => null} userData={{ auditExempt: 'emissive' }}>
        <circleGeometry args={[0.3, 48]} />
        <meshBasicMaterial map={halo} transparent opacity={0.55} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}
```

Run: `npx vitest run src/three/robot`
Expected: PASS — `face.test.ts`, `geometry.test.ts`, `motion.test.ts` inchangés.

- [ ] **Step 8: Retirer `'chair'` du registre et brancher `ChairSet`**

Supprimer `src/three/props/Chair.tsx` :

Run: `git rm src/three/props/Chair.tsx`

Réécrire `src/three/objects.tsx` (le fichier actuel sans `Chair` ; la Tâche 10 le refait entièrement) :

```tsx
import { useGLTF } from '@react-three/drei'
import { useMemo, type ComponentType } from 'react'
import { Cabinet } from './props/Cabinet'
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

/** The chairs are no longer an object of their own: props/ChairSet.tsx draws all of them as instances. */
export type ObjectName =
  | 'table'
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
 * Declare a GLB in public/models to replace an object's procedural version, e.g. { sofa: publicUrl('models/sofa.glb') }
 * (`publicUrl` is in src/core/publicUrl.ts: a URL under public/ must never start with `/`, or a subfolder host breaks).
 * The model must share the procedural origin (floor level, centred) and orientation (front = +z), in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {}

const procedural: Record<ObjectName, ComponentType<ObjectProps>> = {
  table: Table,
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
  const { scene } = useGLTF(url, false)
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

Réécrire `src/zones/office/OfficeScene.tsx` (état de la Tâche 9). Diff attendu par rapport à l'état de la Tâche 8 : l'import `import { ChairSet } from '../../three/props/ChairSet'` et la ligne `<ChairSet placements={chairs} />` à la place des huit `<SceneObject object="chair" …/>`, et les deux `<ContactShadows>` écrites chacune sur une seule ligne (mêmes props) ; rien d'autre.

```tsx
import { ContactShadows } from '@react-three/drei'
import { useQualitySettings } from '../../app/quality'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <Outdoor />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      <ChairSet placements={chairs} />
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <SceneObject object="sideboard" name="sideboard" position={sideboard.position} />
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="cabinet" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <WallScreen3D />
      <AdaController />
      <ContactShadows position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]} scale={1.4} opacity={0.35} blur={2.5} far={1.6} resolution={256} frames={1} />
      <ContactShadows position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]} scale={[5, 7.5]} opacity={0.55} blur={2.4} far={1.4} resolution={512} frames={1} />
    </>
  )
}
```

Run: `npm run typecheck`
Expected: PASS (plus aucune référence à `Chair` ni à `'chair'`).

- [ ] **Step 9: Vérifier**

Run: `npm run check`
Expected: PASS — tous les tests Vitest passent, dont les 6 nouveaux (`shapes` 4, `chairParts` 2) ; sortie sans avertissement ; « Initial JS (gzip) » ≤ 1.50 MB ; `No test API (__academy) in the production JS`.

Run: `npx playwright test tests/e2e/office.spec.ts -g "laptop"`
Expected: PASS — le laptop refait reste survolable à son centre projeté en vue d'ensemble (libellé « Prompt Workshop ») et le clic mène à l'atelier.

- [ ] **Step 10: Captures de revue**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-9`
Expected: `saved .superpowers\review-shots\task-9\day-overview.png` puis `…\day-presentation.png`, code de sortie 0.

À regarder par le contrôleur : plateau en stade en chêne, veinage visible, chant arrondi, deux pieds en T noirs ; huit chaises tournées vers la table, coque en tissu, piètement quatre branches, aucune chaise dans la table ni dans une autre ; six micros en métal brossé, bague lime ; laptop en aluminium avec son écran ; Ada en porcelaine laquée (reflets du vernis), ceinture lime légèrement lumineuse, visière noire brillante avec le visage lisible, logo de poitrine lime / menthe et carrés sombres ; aucune surface de ces objets en aplat sans texture.

- [ ] **Step 11: Commit**

```bash
git add src/three/shapes.ts src/three/shapes.test.ts src/three/props/chairParts.ts src/three/props/chairParts.test.ts src/three/props/ChairSet.tsx src/three/props/Table.tsx src/three/props/Microphone.tsx src/three/props/Laptop.tsx src/three/robot/Ada.tsx src/three/objects.tsx src/zones/office/OfficeScene.tsx
git commit -m "feat: textured furniture in code: racetrack oak table, instanced chairs, brushed microphones, aluminium laptop, Ada's lacquered porcelain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Registre des modèles et mobilier en code (canapé, lampe, meuble télé, étagères, console, enseigne, cadre d'écran)

**Files:**
- Create: `src/three/gltf.ts`, `src/three/props/TvStand.tsx`, `src/three/props/Shelves.tsx`
- Modify: `src/three/objects.tsx` (réécriture : `ObjectName`, `OBJECT_NAMES`, `ModelProps`, `GltfObject`, `glbModels = {}`), `src/three/props/Sofa.tsx`, `src/three/props/Lamp.tsx`, `src/three/props/RetroConsole.tsx`, `src/three/props/LogoCubes.tsx`, `src/zones/office/WallScreen3D.tsx` (réécritures complètes), `src/zones/office/OfficeScene.tsx` (état de la Tâche 10)
- Delete: `src/three/props/Cabinet.tsx`
- Test: `src/three/gltf.test.ts`, `src/three/objects.test.ts`

**Interfaces:**
- Consumes (Tâche 2, `src/three/assets.ts`) : `GLASS_MATERIAL = /_glass$/`, `MODELS: Record<ModelId, ModelSpec>`, `type ModelId`, `modelUrl(model: ModelId): string`.
- Consumes (Tâche 4) : `ENV_MAP_INTENSITY.model` (0.8), `useMaterials()` et ses clés `sofaFabric`, `cushion`, `blackMetal`, `walnut`, `brushedMetal`, `lampShade`, `oak`, `consoleShell`, `consoleDark`, `limeGlow`, `mintGlow`, `logoLime`, `logoMint`, `logoInk`, `signBack`, `screenOff` ; `markExempt(target, reason)` (`src/three/audit.ts`) ; `metreUVs`, `mergeParts`, `at`.
- Consumes (Tâche 5) : `SHELVES = { width: 1.4, depth: 0.24, thickness: 0.025, boards: [1.3, 1.75] }`, `layout.objects.tvStand`, `layout.objects.shelves`, `layout.screen` ; (Tâche 9) `roundedBox`, `between` ; `HoverOutline` (`src/three/interactive.tsx`, inchangé) ; `publicUrl` (`src/core/publicUrl.ts`).
- Produces (`src/three/gltf.ts`) : `cloneModel(scene: Object3D): Object3D`, `prepareModel(root: Object3D): void` (ombres portées et reçues ; un maillage dont tous les matériaux sont du verre reçoit les ombres sans en porter ; chaque matériau une fois via `userData.prepared` : `envMapIntensity = ENV_MAP_INTENSITY.model`, verre marqué `glass`), `scaleToHeight(root: Object3D, height: number): void`, `normaliseModel(root: Object3D): Vector3`, `meshesOf(root: Object3D): Mesh[]`.
- Produces (`src/three/objects.tsx`) : `type ObjectName` (Tâche 10 : `'table' | 'laptop' | 'retroConsole' | 'sofa' | 'logoCubes' | 'lamp' | 'microphone' | 'tvStand' | 'shelves' | 'sideboard' | 'crtTv'`) ; `OBJECT_NAMES` (`as const satisfies readonly ObjectName[]`, même ordre ; le test vérifie à la compilation qu'il couvre exactement l'union) ; `glbModels: Partial<Record<ObjectName, string>> = {}` ; `interface ModelProps extends ObjectProps { outline?: boolean; height?: number; onModel?: (root: Object3D) => void }` ; `type ObjectSource` et `resolveObject(name, models = glbModels)` inchangés ; `hasSource(name: ObjectName, models = glbModels): boolean` (ajout : un modèle déclaré ou un composant procédural dessine l'objet) ; `SceneObject({ object, outline, height, onModel, ...props }: ModelProps & { object: ObjectName })` (lève une erreur si rien ne dessine l'objet ; l'`AssetBoundary` de la Tâche 12 l'attrape dans le décor).
- Produces (accessoires) : `TvStand(props: ObjectProps)` et `TV_STAND = { width: 1.7, height: 0.5, depth: 0.5, legHeight: 0.1 }` ; `Shelves(props: ObjectProps)` ; `SOFA = { width: 2.0, height: 0.8, depth: 0.9, legHeight: 0.12 }` ; `LAMP = { footRadius: 0.09, footHeight: 0.03, stemRadius: 0.008, stemHeight: 0.3, shadeRadius: 0.14, top: 0.48 }`.

`GltfObject` (interne au registre) charge par `useGLTF(url, false, true)` (Draco désactivé, décodeur meshopt intégré à drei : aucun CDN), prépare une copie par placement (`cloneModel`, `prepareModel`, `scaleToHeight` si `height`, `normaliseModel`), appelle `onModel(root)` une fois par copie dans un `useLayoutEffect`, et, avec `outline`, place un `HoverOutline` dans chaque maillage du modèle par `createPortal` de `@react-three/fiber` (le contexte React, donc l'état de survol de l'`Interactive`, traverse le portail). Aucun préchargement au niveau du module. `glbModels` reste vide dans cette tâche : le piège de `objects.test.ts` (le canapé reste procédural avec le `glbModels` par défaut) tient jusqu'au bout.

La console garde sa géométrie : les `RoundedBox` de drei deviennent des `roundedBox` aux mêmes dimensions et rayons (UV en mètres pour les matériaux texturés), les petites boîtes texturées aussi. L'enseigne : la plaque rétroéclairée entoure la marque de 9 cm de chaque côté (0.90 × 1.116 m) ; la marque elle-même mesure 0.72 × 0.936 m (`logoBoxes(0.012)`), une plaque de 0.62 m de haut ne la couvrirait pas.

- [ ] **Step 1: Écrire le test qui échoue `src/three/gltf.test.ts`**

```ts
import { Box3, BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from 'three'
import { cloneModel, meshesOf, normaliseModel, prepareModel, scaleToHeight } from './gltf'
import { ENV_MAP_INTENSITY } from './materials'

/** A loaded-model stand-in: a group holding a 1 x 2 x 0.5 m box away from the origin. */
function model(material = new MeshStandardMaterial({ name: 'wood' })) {
  const root = new Group()
  const box = new Mesh(new BoxGeometry(1, 2, 0.5), material)
  box.position.set(3, 5, -2)
  root.add(box)
  return root
}

const bounds = (root: Group) => new Box3().setFromObject(root)

test('normaliseModel stands a model on the floor, centred', () => {
  const root = model()
  const size = normaliseModel(root)
  expect(size.toArray()).toEqual([1, 2, 0.5])
  const box = bounds(root)
  expect(box.min.y).toBeCloseTo(0)
  const centre = box.getCenter(new Vector3())
  expect(centre.x).toBeCloseTo(0)
  expect(centre.z).toBeCloseTo(0)
})

test('scaleToHeight scales uniformly', () => {
  const root = model()
  scaleToHeight(root, 1)
  expect(root.scale.toArray()).toEqual([0.5, 0.5, 0.5])
  normaliseModel(root)
  const size = bounds(root).getSize(new Vector3())
  expect(size.y).toBeCloseTo(1)
  expect(size.x).toBeCloseTo(0.5)
  expect(size.z).toBeCloseTo(0.25)
  expect(bounds(root).min.y).toBeCloseTo(0)
})

test('prepareModel turns shadows on and marks glass', () => {
  const root = model(new MeshStandardMaterial({ name: 'wall_clock' }))
  const glass = new Mesh(new BoxGeometry(), new MeshPhysicalMaterial({ name: 'wall_clock_glass', transparent: true, opacity: 0.4 }))
  root.add(glass)
  prepareModel(root)
  const [body, pane] = meshesOf(root)
  expect([body.castShadow, body.receiveShadow]).toEqual([true, true])
  expect([pane.castShadow, pane.receiveShadow]).toEqual([false, true])
  expect((pane.material as MeshPhysicalMaterial).userData.auditExempt).toBe('glass')
  expect((body.material as MeshStandardMaterial).userData.auditExempt).toBeUndefined()
})

test('prepareModel sets the environment strength once per shared material', () => {
  const shared = new MeshStandardMaterial({ name: 'cabinet' })
  const loaded = model(shared)
  const first = cloneModel(loaded)
  const second = cloneModel(loaded)
  expect(meshesOf(first)[0]).not.toBe(meshesOf(loaded)[0])
  expect(meshesOf(first)[0].material).toBe(shared)
  prepareModel(first)
  expect(shared.envMapIntensity).toBe(ENV_MAP_INTENSITY.model)
  // A later tweak survives the preparation of another copy: each material is prepared once.
  shared.envMapIntensity = 0.3
  prepareModel(second)
  expect(shared.envMapIntensity).toBe(0.3)
  expect(meshesOf(second)[0].castShadow).toBe(true)
})
```

Run: `npx vitest run src/three/gltf.test.ts`
Expected: FAIL — `Failed to resolve import "./gltf" from "src/three/gltf.test.ts"`.

- [ ] **Step 2: Créer `src/three/gltf.ts`**

```ts
// Ported from Horn.os (owner's project): js/scene/models.js (model)
import { Box3, Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { GLASS_MATERIAL } from './assets'
import { markExempt } from './audit'
import { ENV_MAP_INTENSITY } from './materials'

/*
 * Preparing the CC0 models for the office: a copy per placement, shadows, a softer environment reflection than the
 * surfaces built in code, glass exempt from the material audit, and a common frame (standing on y = 0, centred on x and
 * z, front +z) so that a layout position is the same for a model as for a procedural object.
 */

/** A placeable copy of a loaded model: nodes are cloned, geometries and materials stay shared with the loader cache. */
export function cloneModel(scene: Object3D): Object3D {
  return scene.clone(true)
}

/** Every mesh below `root`, root included. */
export function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })
  return meshes
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material])

/**
 * Shadows on (glass receives but casts none: a pane would darken what it covers), and each material once, however many
 * copies share it (userData.prepared): environment strength ENV_MAP_INTENSITY.model, glass marked for the audit.
 */
export function prepareModel(root: Object3D): void {
  for (const mesh of meshesOf(root)) {
    const materials = materialsOf(mesh)
    mesh.castShadow = !materials.every((material) => GLASS_MATERIAL.test(material.name))
    mesh.receiveShadow = true
    for (const material of materials) {
      if (material.userData.prepared) continue
      material.userData.prepared = true
      const standard = material as MeshStandardMaterial
      if (standard.isMeshStandardMaterial) standard.envMapIntensity = ENV_MAP_INTENSITY.model
      if (GLASS_MATERIAL.test(material.name)) markExempt(material, 'glass')
    }
  }
}

/** Uniform scale so that the bounding box of `root` is `height` metres tall. */
export function scaleToHeight(root: Object3D, height: number): void {
  const size = new Box3().setFromObject(root).getSize(new Vector3())
  if (size.y > 0) root.scale.multiplyScalar(height / size.y)
}

/** Moves `root` so that its bounding box stands on y = 0, centred on x and z. Returns the size of the box. */
export function normaliseModel(root: Object3D): Vector3 {
  const box = new Box3().setFromObject(root)
  const centre = box.getCenter(new Vector3())
  root.position.x -= centre.x
  root.position.y -= box.min.y
  root.position.z -= centre.z
  root.updateMatrixWorld(true)
  return box.getSize(new Vector3())
}
```

Run: `npx vitest run src/three/gltf.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: Réécrire `src/three/objects.test.ts` (le test existant reste, deux tests s'ajoutent)**

`expectTypeOf` est un global de Vitest (`globals: true`) ; il ne fait rien à l'exécution, `npm run typecheck` échoue si `OBJECT_NAMES` et `ObjectName` divergent.

```ts
import { publicUrl } from '../core/publicUrl'
import { MODELS, modelUrl, type ModelId } from './assets'
import { OBJECT_NAMES, glbModels, hasSource, resolveObject, type ObjectName } from './objects'

test('objects are procedural unless a GLB is declared', () => {
  expect(resolveObject('sofa')).toEqual({ kind: 'procedural' })
  expect(resolveObject('sofa', { sofa: 'models/sofa.glb' })).toEqual({ kind: 'glb', url: 'models/sofa.glb' })
})

test('every object name has a source', () => {
  // Compile-time: OBJECT_NAMES lists exactly the ObjectName union (npm run typecheck fails otherwise).
  expectTypeOf<(typeof OBJECT_NAMES)[number]>().toEqualTypeOf<ObjectName>()
  expect(new Set(OBJECT_NAMES).size).toBe(OBJECT_NAMES.length)
  for (const name of OBJECT_NAMES) expect(hasSource(name), name).toBe(true)
  expect(hasSource('sofa', {})).toBe(true)
})

test('declared models live under assets/models', () => {
  const catalogue = (Object.keys(MODELS) as ModelId[]).map(modelUrl)
  for (const [name, url] of Object.entries(glbModels)) {
    expect(url, name).toMatch(/assets\/models\/[a-z0-9_]+\.glb$/)
    expect(url!.startsWith(publicUrl('assets/models/')), name).toBe(true)
    expect(catalogue, name).toContain(url)
  }
})
```

Run: `npx vitest run src/three/objects.test.ts`
Expected: FAIL — « every object name has a source » : `TypeError: Cannot read properties of undefined (reading 'length')` (`OBJECT_NAMES` n'existe pas encore) ; les deux autres tests passent.

- [ ] **Step 4: Créer `src/three/props/TvStand.tsx` et `src/three/props/Shelves.tsx`**

`src/three/props/TvStand.tsx` (l'ancien caisson procédural servait de meuble télé depuis la Tâche 5) :

```tsx
import type { BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Low media unit of the retro corner, 1.7 x 0.5 x 0.5 m: oak carcass on black steel legs, its top at 0.5 m. Front +z. */
export const TV_STAND = { width: 1.7, height: 0.5, depth: 0.5, legHeight: 0.1 } as const

let parts: { carcass: BufferGeometry; metal: BufferGeometry } | null = null

function tvStandParts() {
  const { width, height, depth, legHeight } = TV_STAND
  const body = height - legHeight
  parts ??= {
    carcass: roundedBox(width, body, depth, 0.012),
    metal: mergeParts([
      // Four square legs, set in from the corners.
      ...[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => ({
          geometry: roundedBox(0.035, legHeight, 0.035, 0.004),
          matrix: at(sx * (width / 2 - 0.07), legHeight / 2, sz * (depth / 2 - 0.06)),
        })),
      ),
      // The gap between the two doors and their pulls, just proud of the front.
      { geometry: roundedBox(0.006, body - 0.08, 0.004, 0.001), matrix: at(0, legHeight + body / 2, depth / 2 + 0.002) },
      ...[-1, 1].map((sx) => ({ geometry: roundedBox(0.12, 0.012, 0.012, 0.003), matrix: at(sx * 0.12, height - 0.08, depth / 2 + 0.006) })),
    ]),
  }
  return parts
}

export function TvStand(props: ObjectProps) {
  const m = useMaterials()
  const { carcass, metal } = tvStandParts()
  const { height, legHeight } = TV_STAND
  return (
    <group {...props}>
      <mesh geometry={carcass} position-y={legHeight + (height - legHeight) / 2} material={m.oak} castShadow receiveShadow />
      <mesh geometry={metal} material={m.blackMetal} castShadow receiveShadow />
    </group>
  )
}
```

`src/three/props/Shelves.tsx` :

```tsx
import type { BufferGeometry } from 'three'
import { SHELVES } from '../../zones/office/layout'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'

/** Bracket positions along each board, from its centre. */
const BRACKET_X = [-0.55, 0.55] as const

let parts: { boards: BufferGeometry; brackets: BufferGeometry } | null = null

function shelfParts() {
  const { width, depth, thickness, boards } = SHELVES
  const back = -depth / 2
  parts ??= {
    boards: mergeParts(boards.map((bottom) => ({ geometry: roundedBox(width, thickness, depth, 0.004), matrix: at(0, bottom + thickness / 2, 0) }))),
    // An L bracket under each end of each board: a plate screwed to the wall and an arm under the board.
    brackets: mergeParts(
      boards.flatMap((bottom) =>
        BRACKET_X.flatMap((x) => [
          { geometry: roundedBox(0.03, 0.16, 0.006, 0.002), matrix: at(x, bottom - 0.08, back + 0.003) },
          { geometry: roundedBox(0.03, 0.006, depth - 0.04, 0.002), matrix: at(x, bottom - 0.003, back + (depth - 0.04) / 2) },
        ]),
      ),
    ),
  }
  return parts
}

/** Two oak wall shelves on black brackets (SHELVES: boards at 1.3 and 1.75 m). Origin on the floor, against the wall, front +z. */
export function Shelves(props: ObjectProps) {
  const m = useMaterials()
  const { boards, brackets } = shelfParts()
  return (
    <group {...props}>
      <mesh geometry={boards} material={m.oak} castShadow receiveShadow />
      <mesh geometry={brackets} material={m.blackMetal} castShadow />
    </group>
  )
}
```

- [ ] **Step 5: Réécrire `src/three/objects.tsx`**

```tsx
import { useGLTF } from '@react-three/drei'
import { createPortal } from '@react-three/fiber'
import { Fragment, useLayoutEffect, useMemo, type ComponentType } from 'react'
import type { Object3D } from 'three'
import { cloneModel, meshesOf, normaliseModel, prepareModel, scaleToHeight } from './gltf'
import { HoverOutline } from './interactive'
import { CrtTv } from './props/CrtTv'
import { Lamp } from './props/Lamp'
import { Laptop } from './props/Laptop'
import { LogoCubes } from './props/LogoCubes'
import { Microphone } from './props/Microphone'
import { RetroConsole } from './props/RetroConsole'
import { Shelves } from './props/Shelves'
import { Sideboard } from './props/Sideboard'
import { Sofa } from './props/Sofa'
import { Table } from './props/Table'
import { TvStand } from './props/TvStand'
import type { ObjectProps } from './types'

export type ObjectName =
  | 'table' | 'laptop' | 'retroConsole' | 'sofa' | 'logoCubes' | 'lamp' | 'microphone' // procedural (existing)
  | 'tvStand' | 'shelves' // procedural, Task 10
  | 'sideboard' | 'crtTv' // procedural until Task 11, then GLB

/** Every object name, in the order of the union (objects.test.ts checks that they match). */
export const OBJECT_NAMES = [
  'table', 'laptop', 'retroConsole', 'sofa', 'logoCubes', 'lamp', 'microphone',
  'tvStand', 'shelves',
  'sideboard', 'crtTv',
] as const satisfies readonly ObjectName[]

/**
 * CC0 models that draw an object instead of its procedural version: public/assets/models/<asset id>.glb, declared in
 * scripts/assets/manifest.json and src/three/assets.ts (MODELS), always through modelUrl() (publicUrl, no leading '/').
 * A model is normalised on load (standing on y = 0, centred on x and z); its front must face +z, in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {}

const procedural: Partial<Record<ObjectName, ComponentType<ObjectProps>>> = {
  table: Table,
  laptop: Laptop,
  retroConsole: RetroConsole,
  sofa: Sofa,
  logoCubes: LogoCubes,
  lamp: Lamp,
  microphone: Microphone,
  tvStand: TvStand,
  shelves: Shelves,
  sideboard: Sideboard,
  crtTv: CrtTv,
}

export interface ModelProps extends ObjectProps {
  /** Lime hover outline on every mesh of a model (interactive models, inside an <Interactive>). */
  outline?: boolean
  /** Scale the model uniformly to this height, in metres, before normalising it. */
  height?: number
  /** Called once per placed copy, after preparation: the place to find named nodes and materials. */
  onModel?: (root: Object3D) => void
}

export type ObjectSource = { kind: 'procedural' } | { kind: 'glb'; url: string }

export function resolveObject(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): ObjectSource {
  const url = models[name]
  return url ? { kind: 'glb', url } : { kind: 'procedural' }
}

/** A declared model or a procedural component can draw the object. */
export function hasSource(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): boolean {
  return Boolean(models[name]) || procedural[name] !== undefined
}

function GltfObject({ url, outline = false, height, onModel, ...props }: ModelProps & { url: string }) {
  // Draco off, drei's built-in meshopt decoder on: nothing is fetched from a CDN.
  const { scene } = useGLTF(url, false, true)
  const root = useMemo(() => {
    const copy = cloneModel(scene)
    prepareModel(copy)
    if (height) scaleToHeight(copy, height)
    normaliseModel(copy)
    return copy
  }, [scene, height])
  // Once per copy, on purpose: a new onModel function on a later render does not run again.
  useLayoutEffect(() => {
    onModel?.(root)
  }, [root])
  const meshes = useMemo(() => (outline ? meshesOf(root) : []), [outline, root])
  return (
    <group {...props}>
      <primitive object={root} />
      {meshes.map((mesh) => (
        <Fragment key={mesh.uuid}>{createPortal(<HoverOutline />, mesh)}</Fragment>
      ))}
    </group>
  )
}

export function SceneObject({ object, outline, height, onModel, ...props }: ModelProps & { object: ObjectName }) {
  const source = resolveObject(object)
  if (source.kind === 'glb') return <GltfObject url={source.url} outline={outline} height={height} onModel={onModel} {...props} />
  const Procedural = procedural[object]
  if (!Procedural) throw new Error(`Nothing draws "${object}": declare its model in glbModels.`)
  return <Procedural {...props} />
}
```

Run: `npx vitest run src/three/objects.test.ts src/three/gltf.test.ts`
Expected: PASS (3 + 4 tests).

- [ ] **Step 6: Réécrire le canapé, la lampe, la console et l'enseigne**

`src/three/props/Sofa.tsx` (même gabarit 2.0 × 0.8 × 0.9 m, pieds fins de 12 cm, deux coussins lime) :

```tsx
import { Vector3, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import { at, mergeParts } from '../merge'
import { between, roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/** Two-seat sofa, 2.0 x 0.8 x 0.9 m including its legs, front +z. */
export const SOFA = { width: 2.0, height: 0.8, depth: 0.9, legHeight: 0.12 } as const

let parts: { upholstery: BufferGeometry; pillows: BufferGeometry; legs: BufferGeometry } | null = null

function sofaParts() {
  const leg = SOFA.legHeight
  parts ??= {
    // Base, two seat cushions, back and arms in one geometry (one draw call), re-projected in metres after merging.
    upholstery: metreUVs(
      mergeParts([
        { geometry: roundedBox(2.0, 0.26, 0.9, 0.05), matrix: at(0, leg + 0.13, 0) },
        ...[-0.405, 0.405].map((x) => ({ geometry: roundedBox(0.79, 0.14, 0.66, 0.05), matrix: at(x, leg + 0.33, 0.08) })),
        { geometry: roundedBox(2.0, 0.42, 0.22, 0.07), matrix: at(0, leg + 0.47, -0.34) },
        ...[-0.9, 0.9].map((x) => ({ geometry: roundedBox(0.2, 0.5, 0.9, 0.07), matrix: at(x, leg + 0.25, 0) })),
      ]),
    ),
    // Two lime throw pillows leaning on the back.
    pillows: metreUVs(mergeParts([-0.45, 0.45].map((x) => ({ geometry: roundedBox(0.4, 0.3, 0.12, 0.05), matrix: at(x, 0.64, -0.17, [-0.25, 0, 0]) })))),
    // Four thin tapered legs.
    legs: metreUVs(
      mergeParts([-0.9, 0.9].flatMap((x) => [-0.36, 0.36].map((z) => between(new Vector3(x, 0, z), new Vector3(x, leg, z), 0.012, 0.018, 12)))),
    ),
  }
  return parts
}

export function Sofa(props: ObjectProps) {
  const m = useMaterials()
  const { upholstery, pillows, legs } = sofaParts()
  return (
    <group {...props}>
      <mesh geometry={upholstery} material={m.sofaFabric} castShadow receiveShadow />
      <mesh geometry={pillows} material={m.cushion} castShadow receiveShadow />
      <mesh geometry={legs} material={m.blackMetal} castShadow />
    </group>
  )
}
```

`src/three/props/Lamp.tsx` (aucune lumière dans le composant : `lamp-light` est dans `lighting/Lights.tsx`) :

```tsx
import { CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three'
import { useMaterials } from '../materials'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/** Table lamp of the sideboard, in metres: radius 0.14 and 0.48 high. Its light is lamp-light, in lighting/Lights.tsx. */
export const LAMP = { footRadius: 0.09, footHeight: 0.03, stemRadius: 0.008, stemHeight: 0.3, shadeRadius: 0.14, top: 0.48 } as const

let parts: { foot: BufferGeometry; stem: BufferGeometry; shade: BufferGeometry } | null = null

function lampParts() {
  parts ??= {
    foot: metreUVs(new CylinderGeometry(LAMP.footRadius, LAMP.footRadius, LAMP.footHeight, 32)),
    stem: metreUVs(new CylinderGeometry(LAMP.stemRadius, LAMP.stemRadius, LAMP.stemHeight, 12)),
    // An opal globe cut a little below its equator, so the stem disappears into it.
    shade: new SphereGeometry(LAMP.shadeRadius, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
  }
  return parts
}

/** Walnut foot, brushed metal stem, opal dome that glows with the phase (lampShade, see lighting/emissive.ts). */
export function Lamp(props: ObjectProps) {
  const m = useMaterials()
  const { foot, stem, shade } = lampParts()
  return (
    <group {...props}>
      <mesh geometry={foot} position-y={LAMP.footHeight / 2} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={stem} position-y={LAMP.footHeight + LAMP.stemHeight / 2} material={m.brushedMetal} castShadow />
      <mesh geometry={shade} position-y={LAMP.top - LAMP.shadeRadius} material={m.lampShade} />
    </group>
  )
}
```

`src/three/props/RetroConsole.tsx` :

```tsx
import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { HoverOutline } from '../interactive'
import { logoBoxes } from '../logo'
import { useMaterials } from '../materials'
import { roundedBox } from '../shapes'
import type { ObjectProps } from '../types'
import { metreUVs } from '../uv'

/** A made-up 90s console: rounded grey case, the brand squares as buttons, a pad and a cable. Same shapes as before, retextured. */
export function RetroConsole(props: ObjectProps) {
  const m = useMaterials()
  const cable = useMemo(
    () =>
      metreUVs(
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
      ),
    [],
  )
  useEffect(() => () => cable.dispose(), [cable])
  const buttons = logoBoxes(0.0012)
  const byColor = { lime: m.limeGlow, mint: m.mintGlow, ink: m.consoleDark }
  return (
    <group {...props}>
      <mesh geometry={roundedBox(0.36, 0.07, 0.26, 0.02)} position-y={0.035} material={m.consoleShell} castShadow receiveShadow>
        <HoverOutline />
      </mesh>
      <mesh geometry={roundedBox(0.2, 0.004, 0.08, 0.001)} position={[0, 0.071, -0.04]} material={m.consoleDark} />
      <group position={[0.11, 0.072, 0.07]} rotation-x={-Math.PI / 2}>
        {buttons.map((button, index) => (
          <mesh
            key={index}
            geometry={roundedBox(button.size[0], button.size[1], 0.004, 0.001)}
            position={[button.position[0], button.position[1], 0.002]}
            material={byColor[button.color]}
          />
        ))}
      </group>
      <group position={[0.27, 0, 0.02]}>
        <mesh geometry={roundedBox(0.16, 0.03, 0.07, 0.012)} position-y={0.015} material={m.consoleShell} castShadow />
        <mesh geometry={roundedBox(0.03, 0.004, 0.01, 0.001)} position={[-0.045, 0.031, 0]} material={m.consoleDark} />
        <mesh geometry={roundedBox(0.01, 0.004, 0.03, 0.001)} position={[-0.045, 0.031, 0]} material={m.consoleDark} />
        <mesh position={[0.04, 0.031, -0.008]} material={m.limeGlow}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
        <mesh position={[0.058, 0.031, 0.008]} material={m.mintGlow}>
          <cylinderGeometry args={[0.007, 0.007, 0.004, 12]} />
        </mesh>
      </group>
      <mesh geometry={cable} material={m.consoleDark} />
    </group>
  )
}
```

`src/three/props/LogoCubes.tsx` :

```tsx
import { LOGO_H, LOGO_W, logoBoxes } from '../logo'
import { useMaterials } from '../materials'
import type { ObjectProps } from '../types'

/** Metres per SVG unit of the mark: 0.72 m wide, 0.936 m high. */
const SCALE = 0.012
/** The backlit plate shows this much around the mark. */
const MARGIN = 0.09

/**
 * The Athena sign on the back wall: the five-square mark as cubes in front of a plate that glows behind them, discreet
 * by day and bright at night (signBack and the logo materials follow the phase, see lighting/emissive.ts). Front +z.
 */
export function LogoCubes(props: ObjectProps) {
  const m = useMaterials()
  const byColor = { lime: m.logoLime, mint: m.logoMint, ink: m.logoInk }
  return (
    <group {...props}>
      <mesh position-z={0.005} material={m.signBack}>
        <boxGeometry args={[LOGO_W * SCALE + 2 * MARGIN, LOGO_H * SCALE + 2 * MARGIN, 0.01]} />
      </mesh>
      {logoBoxes(SCALE).map((box, index) => (
        <mesh key={index} position={[box.position[0], box.position[1], 0.05]} material={byColor[box.color]} castShadow>
          <boxGeometry args={[box.size[0], box.size[1], 0.1]} />
        </mesh>
      ))}
    </group>
  )
}
```

- [ ] **Step 7: Réécrire `src/zones/office/WallScreen3D.tsx` (cadre fin, trou DOM conservé)**

Cadre noir de 4.03 × 2.28 × 0.03 m en z local −0.016 (sa face avant 1 mm derrière le plan), plan `screenOff` inchangé, `<Html>` inchangé et enveloppé dans un groupe exempté `screen`. `SCREEN_PX` et `screenDistanceFactor` ne changent pas (`layout.test.ts`).

```tsx
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useScreenRef } from '../../core/selectors'
import { useMaterials } from '../../three/materials'
import { roundedBox } from '../../three/shapes'
import { ScreenContent } from '../../visuals/ScreenContent'
import { layout } from './layout'

export const SCREEN_PX = { width: 1280, height: 720 }
/** The thin black bezel shows this much around the screen, all round. */
const BEZEL = 0.015

/** drei <Html transform> maps 1 CSS pixel to distanceFactor / 400 world units. */
export function screenDistanceFactor(widthMetres: number): number {
  return (widthMetres / SCREEN_PX.width) * 400
}

export function WallScreen3D() {
  const m = useMaterials()
  const screen = useScreenRef()
  // Mounting <Html> during the Canvas's first commit loses its content when drei's portal target settles.
  const connected = useThree((state) => state.events.connected)
  const { position, size } = layout.screen
  return (
    <group position={position} name="screen">
      <mesh geometry={roundedBox(size[0] + 2 * BEZEL, size[1] + 2 * BEZEL, 0.03, 0.004)} position-z={-0.016} material={m.blackMetal} castShadow receiveShadow />
      <mesh material={m.screenOff}>
        <planeGeometry args={size} />
      </mesh>
      {/* The DOM page and drei's occlusion plane are a screen: exempt from the material audit. */}
      <group userData={{ auditExempt: 'screen' }}>
        {/* Sits below the DOM overlay (z-index 10) and never catches the pointer. occlude="blending" lets foreground meshes hide it. */}
        {connected && (
          <Html
            transform
            occlude="blending"
            distanceFactor={screenDistanceFactor(size[0])}
            position-z={0.003}
            zIndexRange={[5, 0]}
            pointerEvents="none"
            wrapperClass="wall-screen"
          >
            <ScreenContent screen={screen} />
          </Html>
        )}
      </group>
    </group>
  )
}
```

- [ ] **Step 8: Supprimer le caisson procédural et mettre `OfficeScene.tsx` à l'état de la Tâche 10**

Run: `git rm src/three/props/Cabinet.tsx`

Réécrire `src/zones/office/OfficeScene.tsx`. Diff attendu par rapport à l'état de la Tâche 9 : `shelves` lu dans `layout.objects`, `object="cabinet"` → `object="tvStand"` sur la ligne du meuble télé, et la ligne des étagères après l'enseigne.

```tsx
import { ContactShadows } from '@react-three/drei'
import { useQualitySettings } from '../../app/quality'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo, shelves } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <Outdoor />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      <ChairSet placements={chairs} />
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <SceneObject object="sideboard" name="sideboard" position={sideboard.position} />
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="tvStand" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <SceneObject object="shelves" name="shelves" position={shelves.position} rotation-y={shelves.rotationY} />
      <WallScreen3D />
      <AdaController />
      <ContactShadows position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]} scale={1.4} opacity={0.35} blur={2.5} far={1.6} resolution={256} frames={1} />
      <ContactShadows position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]} scale={[5, 7.5]} opacity={0.55} blur={2.4} far={1.4} resolution={512} frames={1} />
    </>
  )
}
```

- [ ] **Step 9: Vérifier**

Run: `npm run check`
Expected: PASS — tous les tests passent, dont `gltf` (4) et `objects` (3) ; `tsc` sans erreur (le contrôle de type d'`OBJECT_NAMES` compris) ; sortie sans avertissement ; « Initial JS (gzip) » ≤ 1.50 MB ; `No test API (__academy) in the production JS`. Seuls `props/Sideboard.tsx` et `props/CrtTv.tsx` appellent encore `materials()` (supprimés à la Tâche 11).

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS — tous les parcours du bureau, dont le texte de l'écran mural (le trou DOM sous le nouveau cadre), le survol du laptop et le vol vers la télé.

- [ ] **Step 10: Captures de revue**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-10 --phases day,night`
Expected: quatre PNG `day-overview`, `day-presentation`, `night-overview`, `night-presentation` dans `.superpowers/review-shots/task-10/`, code de sortie 0.

À regarder : canapé bleu-gris en tissu sur pieds fins, deux coussins lime appuyés au dossier ; lampe du buffet (pied en noyer, tige brossée, globe opale éteint le jour et lumineux la nuit) ; meuble télé en chêne sur pieds noirs, télé et console posées dessus ; étagères en chêne sur consoles noires à droite de l'enseigne ; console retexturée (coque grise mate, boutons lime et menthe) ; enseigne : cubes de la marque devant une plaque discrète le jour et franchement lumineuse la nuit ; écran mural bordé d'un cadre noir fin, contenu DOM visible et net dans la vue présentation.

- [ ] **Step 11: Commit**

```bash
git add src/three/gltf.ts src/three/gltf.test.ts src/three/objects.tsx src/three/objects.test.ts src/three/props/TvStand.tsx src/three/props/Shelves.tsx src/three/props/Sofa.tsx src/three/props/Lamp.tsx src/three/props/RetroConsole.tsx src/three/props/LogoCubes.tsx src/zones/office/WallScreen3D.tsx src/zones/office/OfficeScene.tsx
git commit -m "feat: model registry with shadows and hover outlines, textured sofa, lamp, TV stand, shelves, console, backlit sign and screen bezel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Modèles du socle, télé recalée, horloge cliquable et bouton « Time of day »

**Files:**
- Create: `src/zones/office/clockHands.ts`, `src/zones/office/WallClock.tsx`
- Modify: `src/three/objects.tsx` (réécriture : trois GLB du socle, `'clock'`), `src/three/materials.ts` (suppression de la section des matériaux plats et de ses imports), `src/zones/office/OfficeScene.tsx` (état de la Tâche 11), `src/zones/office/CrtScreen.tsx` (import de `CRT_SCREEN`, exemption `screen`), `src/zones/office/layout.ts` (`flights.tv`), `src/core/store.ts` (`HoverTarget`), `src/zones/office/interactions.ts`, `src/ui/Hud.tsx`, `content/en/ui.json` ; seulement si l'alignement sur captures l'exige : `src/three/assets.ts` (`CRT_SCREEN`)
- Delete: `src/three/props/Sideboard.tsx`, `src/three/props/CrtTv.tsx`
- Test: `src/zones/office/clockHands.test.ts`, `src/zones/office/interactions.test.ts`, `src/ui/Hud.test.tsx`, `src/zones/office/layout.test.ts`

**Interfaces:**
- Consumes (Tâche 2, `src/three/assets.ts`) : `modelUrl('sideboard' | 'television' | 'wallClock')`, `MODEL_PARTS.clockHands = { hour: 'wall_clock_hours_hand', minute: 'wall_clock_minute_hand', second: 'wall_clock_second_hand' }`, `CRT_SCREEN = { width, height, center: [x, y, z] }` (repère normalisé de `television_02`, avant +z).
- Consumes (Tâche 3) : `CLOCK_MINUTES` (`src/core/phase.ts`) ; `AppState.advancePhase(): void`, `phase`, `phaseTransition` (`src/core/store.ts`).
- Consumes (Tâche 7, `src/zones/office/lighting/live.ts`) : `type LightingApplier = (preset: Readonly<Preset>, minutes: number) => void`, `useLightingApplier(apply: LightingApplier): void` (appelé à chaque image par `PhaseDriver`, `minutes` avance pendant une transition).
- Consumes (Tâche 10, `src/three/objects.tsx`) : `SceneObject` avec `outline` et `onModel`, `OBJECT_NAMES`, `hasSource` ; (Tâche 5) `layout.objects.clock`, `layout.objects.sideboard`, `layout.objects.tv`.
- Produces (`src/zones/office/clockHands.ts`) : `handRestAngle(positions: ArrayLike<number>, itemSize = 3): number`, `handAngles(minutes: number): { hour: number; minute: number; second: number }`, `handRotationZ(target: number, rest: number): number`.
- Produces (`src/zones/office/WallClock.tsx`) : `WallClock()` — `<Interactive id="clock">` autour de `<SceneObject object="clock" name="clock" outline …/>`.
- Produces : `HoverTarget = 'laptop' | 'tv' | 'ada' | 'clock'` ; `objectActions.clock = () => appStore.getState().advancePhase()` ; `labelKey.clock = 'objects.clock'` ; bouton « Time of day » du HUD (rôle `button`) ; clés `hud.timeOfDay` (« Time of day ») et `objects.clock` (« Change the time of day ») ; `layout.flights.tv = { position: [4.05, 0.74, -1.4], target: [4.42, 0.735, -1.4] }` ; `ObjectName` gagne `'clock'` ; `glbModels = { sideboard, crtTv, clock }` ; `materials.ts` n'exporte plus `materials()` ni `LegacyMaterials`.

L'horloge GLB est construite sans quantification (manifeste, Tâche 1) : ses nœuds d'aiguilles ont une transformation identité (test de la Tâche 2) et leur géométrie est en mètres dans le repère du cadran, axe à l'origine. L'angle de repos de chaque aiguille se lit donc sur sa géométrie brute, et `rotation.z` la fait tourner autour de l'axe. glTF-Transform écrit des tampons de sommets entrelacés : les positions se lisent attribut par attribut (`getX`, `getY`, `getZ`), jamais par `attribute.array`. Un clic sur l'horloge pendant une transition est ignoré par `advancePhase` (Tâche 3).

Le vol vers la télé : l'image de `television_02` est à `tv.position + rotationY(CRT_SCREEN.center)`, soit (4.423 ; 0.735 ; −1.4), tournée vers −x ; la caméra s'arrête 37 cm devant et vise son centre.

- [ ] **Step 1: Écrire le test qui échoue `src/zones/office/clockHands.test.ts`**

```ts
import { Vector3 } from 'three'
import { CLOCK_MINUTES } from '../../core/phase'
import { handAngles, handRestAngle, handRotationZ } from './clockHands'

test('the hands show 14:00, 19:30 and 23:00', () => {
  const day = handAngles(CLOCK_MINUTES.day)
  expect(day.hour).toBeCloseTo(Math.PI / 3)
  expect(day.minute).toBeCloseTo(0)
  const sunset = handAngles(CLOCK_MINUTES.sunset)
  expect(sunset.hour).toBeCloseTo(1.25 * Math.PI)
  expect(sunset.minute).toBeCloseTo(Math.PI)
  const night = handAngles(CLOCK_MINUTES.night)
  expect(night.hour).toBeCloseTo((11 * Math.PI) / 6)
  expect(night.minute).toBeCloseTo(0)
  expect([day.second, sunset.second, night.second]).toEqual([0, 0, 0])
  // Halfway from night to day the clock passes 03:30 (clockMinutes 210): hour hand past 3, minute hand on 6.
  expect(handAngles(210).hour).toBeCloseTo(3.5 * (Math.PI / 6))
  expect(handAngles(210).minute).toBeCloseTo(Math.PI)
})

test("the rest angle is read from the hand's farthest vertex", () => {
  // A hand pointing at 3 o'clock, its counterweight short of the axis on the other side.
  const threeOClock = [0, 0, 0.002, 0.11, 0.004, 0.002, 0.12, 0, 0.002, -0.03, 0, 0.002]
  expect(handRestAngle(threeOClock)).toBeCloseTo(Math.PI / 2)
  expect(handRestAngle([0, 0.02, 0, 0, 0.14, 0, 0.003, 0.1, 0])).toBeCloseTo(0)
  expect(handRestAngle([0, -0.13, 0, 0.01, 0.02, 0])).toBeCloseTo(Math.PI)
  // Interleaved or 4-wide data: itemSize steps over the extra values.
  expect(handRestAngle([0.12, 0, 0, 9, -0.05, 0, 0, 9], 4)).toBeCloseTo(Math.PI / 2)
})

test('positive angles turn the hands clockwise', () => {
  const z = new Vector3(0, 0, 1)
  // From 12 to 3 o'clock: the tip goes from +y to +x seen from the front.
  const tip = new Vector3(0, 0.14, 0).applyAxisAngle(z, handRotationZ(Math.PI / 2, 0))
  expect(tip.x).toBeCloseTo(0.14)
  expect(tip.y).toBeCloseTo(0)
  // A hand modelled at 3 o'clock, sent to 6 o'clock.
  const modelled = new Vector3(0.12, 0, 0).applyAxisAngle(z, handRotationZ(Math.PI, Math.PI / 2))
  expect(modelled.x).toBeCloseTo(0)
  expect(modelled.y).toBeCloseTo(-0.12)
  expect(handRotationZ(1, 1)).toBeCloseTo(0)
})
```

Run: `npx vitest run src/zones/office/clockHands.test.ts`
Expected: FAIL — `Failed to resolve import "./clockHands" from "src/zones/office/clockHands.test.ts"`.

- [ ] **Step 2: Créer `src/zones/office/clockHands.ts`**

```ts
/*
 * The hands of the wall_clock model. Angles are radians clockwise from 12 o'clock, seen from the front of the dial (+z);
 * the dial lies in the model's XY plane with the hands' axis at the origin, so a hand turns with its node's rotation.z.
 */

/** Rest angle of a hand: the direction of its vertex farthest from the axis (its tip), atan2(x, y). */
export function handRestAngle(positions: ArrayLike<number>, itemSize = 3): number {
  let farthest = -1
  let angle = 0
  for (let i = 0; i + 1 < positions.length; i += itemSize) {
    const x = positions[i]
    const y = positions[i + 1]
    const distance = x * x + y * y
    if (distance > farthest) {
      farthest = distance
      angle = Math.atan2(x, y)
    }
  }
  return angle
}

/** Hand angles for a time of day in minutes after midnight. The second hand rests on 12. */
export function handAngles(minutes: number): { hour: number; minute: number; second: number } {
  return { hour: ((minutes / 60) % 12) * (Math.PI / 6), minute: (minutes % 60) * (Math.PI / 30), second: 0 }
}

/** rotation.z that turns a hand from its rest angle to `target`: clockwise seen from +z is a negative z rotation. */
export function handRotationZ(target: number, rest: number): number {
  return -(target - rest)
}
```

Run: `npx vitest run src/zones/office/clockHands.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Étendre les tests de l'horloge, du HUD et du vol vers la télé (tests qui échouent)**

À la fin de `src/zones/office/interactions.test.ts`, ajouter :

```ts

test('the wall clock moves to the next phase', () => {
  resetAppStore({ phase: 'day', phaseTransition: null })
  objectActions.clock()
  expect(appStore.getState().phase).toBe('sunset')
  expect(appStore.getState().phaseTransition).toMatchObject({ from: 'day', to: 'sunset' })
})
```

Dans `src/ui/Hud.test.tsx`, remplacer exactement la ligne

```ts
import { appStore } from '../core/store'
```

par

```ts
import { appStore, type AppState } from '../core/store'
```

et ajouter à la fin du fichier :

```tsx

test('the Time of day button advances the phase', async () => {
  resetAppStore({ phase: 'day', phaseTransition: null })
  render(<Hud />)
  await userEvent.click(screen.getByRole('button', { name: 'Time of day' }))
  expect(appStore.getState().phase).toBe('sunset')
})

test('the Time of day button only shows in the 3D office', () => {
  const hidden: [string, Partial<AppState>][] = [
    ['reading mode', { readingMode: true }],
    ['no WebGL', { webgl: 'unavailable' }],
    ['another zone', { zone: 'workshop' }],
  ]
  for (const [name, overrides] of hidden) {
    resetAppStore(overrides)
    const { unmount } = render(<Hud />)
    expect(screen.queryByRole('button', { name: 'Time of day' }), name).not.toBeInTheDocument()
    unmount()
  }
  resetAppStore()
  render(<Hud />)
  expect(screen.getByRole('button', { name: 'Time of day' })).toBeInTheDocument()
})
```

Dans `src/zones/office/layout.test.ts` (fichier de la Tâche 5), ajouter à la suite des imports existants la ligne

```ts
import { CRT_SCREEN } from '../../three/assets'
```

et à la fin du fichier ce test (calcul en nombres simples, sans nouvel import de `three`, pour ne heurter aucun nom des tests de la Tâche 5) :

```ts

// Task 11: the flight into the TV ends in front of the television_02 picture, looking at its centre.
test('the TV flight ends 30 to 50 cm in front of the TV picture, aimed at its centre', () => {
  const { position, rotationY = 0 } = layout.objects.tv
  const [cx, cy, cz] = CRT_SCREEN.center
  const cos = Math.cos(rotationY)
  const sin = Math.sin(rotationY)
  // The picture centre and its normal (+z of the TV), turned by rotationY about y.
  const picture = [position[0] + cx * cos + cz * sin, position[1] + cy, position[2] - cx * sin + cz * cos]
  const normal = [sin, 0, cos]
  const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const { position: eye, target } = layout.flights.tv
  const distance = dot(sub(eye, picture), normal)
  expect(distance).toBeGreaterThanOrEqual(0.3)
  expect(distance).toBeLessThanOrEqual(0.5)
  // The line of sight crosses the picture plane within 2 cm of its centre.
  const aim = sub(target, eye)
  const k = dot(sub(picture, eye), normal) / dot(aim, normal)
  const hit = eye.map((value, i) => value + aim[i] * k)
  expect(Math.hypot(...sub(hit, picture))).toBeLessThan(0.02)
})
```

Run: `npx vitest run src/zones/office/interactions.test.ts src/ui/Hud.test.tsx src/zones/office/layout.test.ts`
Expected: FAIL — « the wall clock moves to the next phase » (`objectActions.clock is not a function`) ; les deux tests « Time of day » (`Unable to find an accessible element with the role "button" and name "Time of day"`) ; « the TV flight ends 30 to 50 cm in front of the TV picture, aimed at its centre » (le vol actuel vise 4 cm au-dessus du centre de l'image : `expected 0.0413… to be less than 0.02`). Les autres tests passent.

- [ ] **Step 4: Horloge cliquable, bouton du HUD, textes et vol vers la télé**

Dans `src/core/store.ts`, remplacer exactement la ligne

```ts
export type HoverTarget = 'laptop' | 'tv' | 'ada'
```

par

```ts
export type HoverTarget = 'laptop' | 'tv' | 'ada' | 'clock'
```

Réécrire `src/zones/office/interactions.ts` :

```ts
import { appStore, type HoverTarget } from '../../core/store'

/** What each clickable object does. Shared by 3D clicks and the dev test API. */
export const objectActions: Record<HoverTarget, () => void> = {
  laptop: () => appStore.getState().requestZone('workshop', 'laptop'),
  tv: () => appStore.getState().requestZone('dungeon', 'tv'),
  ada: () => appStore.getState().pokeAda(),
  clock: () => appStore.getState().advancePhase(),
}

/** i18n key of the tooltip shown next to the pointer while an object is hovered. */
export const labelKey = {
  laptop: 'objects.laptop',
  tv: 'objects.tv',
  ada: 'objects.ada',
  clock: 'objects.clock',
} as const satisfies Record<HoverTarget, string>
```

Dans `content/en/ui.json`, remplacer exactement

```json
    "exitReadingMode": "3D mode"
  },
```

par

```json
    "exitReadingMode": "3D mode",
    "timeOfDay": "Time of day"
  },
```

puis exactement

```json
    "ada": "Ada"
  },
```

par

```json
    "ada": "Ada",
    "clock": "Change the time of day"
  },
```

Réécrire `src/ui/Hud.tsx` (le bouton se place juste avant celui du mode lecture ; diff : le sélecteur `officeIn3D`, `advancePhase` lu dans `appStore.getState()` et le bouton) :

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
  const expandOpen = useApp((s) => s.expandOpen)
  // The keyboard way to the wall clock: only where the 3D office is on screen.
  const officeIn3D = useApp((s) => s.zone === 'office' && s.webgl === 'ok' && !s.readingMode)
  const { setSound, setLang, setReadingMode, advancePhase } = appStore.getState()
  const seenCount = content.topics.filter((topic) => seen.includes(topic.id)).length

  return (
    <header className="hud panel" inert={expandOpen}>
      <div className="hud__brand">
        <Logo className="hud__logo" />
        <span className="hud__name">{t('app.name')}</span>
      </div>
      <div className="hud__tools">
        <span className="hud__progress" data-testid="progress">
          {t('hud.progress', { seen: seenCount, total: content.topics.length })}
        </span>
        {officeIn3D && (
          <Button size="sm" variant="solid" onClick={() => advancePhase()}>
            {t('hud.timeOfDay')}
          </Button>
        )}
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

Dans `src/zones/office/layout.ts`, remplacer exactement la ligne

```ts
    tv: { position: [3.95, 0.8, -1.4], target: [4.35, 0.78, -1.4] },
```

par

```ts
    tv: { position: [4.05, 0.74, -1.4], target: [4.42, 0.735, -1.4] },
```

Run: `npx vitest run src/zones/office/interactions.test.ts src/ui/Hud.test.tsx src/zones/office/layout.test.ts src/ui/ObjectLabel.test.tsx src/app/testApi.test.ts`
Expected: PASS ; `tsc` accepte `labelKey` (`satisfies Record<HoverTarget, string>`) et `objectActions` avec la nouvelle cible.

- [ ] **Step 5: Créer `src/zones/office/WallClock.tsx`**

```tsx
import { useRef } from 'react'
import type { Mesh, Object3D } from 'three'
import { MODEL_PARTS } from '../../three/assets'
import { Interactive } from '../../three/interactive'
import { SceneObject } from '../../three/objects'
import { handAngles, handRestAngle, handRotationZ } from './clockHands'
import { objectActions } from './interactions'
import { layout } from './layout'
import { useLightingApplier } from './lighting/live'

type Hand = keyof typeof MODEL_PARTS.clockHands

interface HandNode {
  hand: Hand
  node: Object3D
  rest: number
}

/**
 * Vertex positions of a hand node, read attribute by attribute: glTF-Transform writes interleaved vertex buffers, so the
 * raw array of the attribute is not a plain list of positions. The clock GLB is not quantised: these are metres in the
 * dial's frame, axis at the origin.
 */
function handPositions(node: Object3D): number[] {
  const values: number[] = []
  node.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const position = mesh.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) values.push(position.getX(i), position.getY(i), position.getZ(i))
  })
  return values
}

/**
 * The wall clock (Poly Haven wall_clock): a click moves the office to the next phase, like the HUD's Time of day button.
 * Its hands show the phase's time (14:00, 19:30, 23:00) and turn forward during a transition (lighting/live.ts minutes).
 */
export function WallClock() {
  const hands = useRef<HandNode[]>([])
  const { position, rotationY } = layout.objects.clock
  useLightingApplier((_preset, minutes) => {
    const angles = handAngles(minutes)
    for (const { hand, node, rest } of hands.current) node.rotation.z = handRotationZ(angles[hand], rest)
  })
  return (
    <Interactive id="clock" onActivate={objectActions.clock}>
      <SceneObject
        object="clock"
        name="clock"
        outline
        position={position}
        rotation-y={rotationY}
        onModel={(root) => {
          hands.current = (Object.keys(MODEL_PARTS.clockHands) as Hand[]).flatMap((hand) => {
            const node = root.getObjectByName(MODEL_PARTS.clockHands[hand])
            return node ? [{ hand, node, rest: handRestAngle(handPositions(node)) }] : []
          })
        }}
      />
    </Interactive>
  )
}
```

- [ ] **Step 6: Les trois modèles du socle dans le registre**

Supprimer les deux accessoires remplacés par des modèles :

Run: `git rm src/three/props/Sideboard.tsx src/three/props/CrtTv.tsx`

Réécrire `src/three/objects.tsx` :

```tsx
import { useGLTF } from '@react-three/drei'
import { createPortal } from '@react-three/fiber'
import { Fragment, useLayoutEffect, useMemo, type ComponentType } from 'react'
import type { Object3D } from 'three'
import { modelUrl } from './assets'
import { cloneModel, meshesOf, normaliseModel, prepareModel, scaleToHeight } from './gltf'
import { HoverOutline } from './interactive'
import { Lamp } from './props/Lamp'
import { Laptop } from './props/Laptop'
import { LogoCubes } from './props/LogoCubes'
import { Microphone } from './props/Microphone'
import { RetroConsole } from './props/RetroConsole'
import { Shelves } from './props/Shelves'
import { Sofa } from './props/Sofa'
import { Table } from './props/Table'
import { TvStand } from './props/TvStand'
import type { ObjectProps } from './types'

export type ObjectName =
  | 'table' | 'laptop' | 'retroConsole' | 'sofa' | 'logoCubes' | 'lamp' | 'microphone' // procedural (existing)
  | 'tvStand' | 'shelves' // procedural, Task 10
  | 'sideboard' | 'crtTv' // GLB since Task 11
  | 'clock' // GLB, Task 11

/** Every object name, in the order of the union (objects.test.ts checks that they match). */
export const OBJECT_NAMES = [
  'table', 'laptop', 'retroConsole', 'sofa', 'logoCubes', 'lamp', 'microphone',
  'tvStand', 'shelves',
  'sideboard', 'crtTv',
  'clock',
] as const satisfies readonly ObjectName[]

/**
 * CC0 models that draw an object instead of its procedural version: public/assets/models/<asset id>.glb, declared in
 * scripts/assets/manifest.json and src/three/assets.ts (MODELS), always through modelUrl() (publicUrl, no leading '/').
 * A model is normalised on load (standing on y = 0, centred on x and z); its front must face +z, in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {
  sideboard: modelUrl('sideboard'),
  crtTv: modelUrl('television'),
  clock: modelUrl('wallClock'),
}

const procedural: Partial<Record<ObjectName, ComponentType<ObjectProps>>> = {
  table: Table,
  laptop: Laptop,
  retroConsole: RetroConsole,
  sofa: Sofa,
  logoCubes: LogoCubes,
  lamp: Lamp,
  microphone: Microphone,
  tvStand: TvStand,
  shelves: Shelves,
}

export interface ModelProps extends ObjectProps {
  /** Lime hover outline on every mesh of a model (interactive models, inside an <Interactive>). */
  outline?: boolean
  /** Scale the model uniformly to this height, in metres, before normalising it. */
  height?: number
  /** Called once per placed copy, after preparation: the place to find named nodes and materials. */
  onModel?: (root: Object3D) => void
}

export type ObjectSource = { kind: 'procedural' } | { kind: 'glb'; url: string }

export function resolveObject(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): ObjectSource {
  const url = models[name]
  return url ? { kind: 'glb', url } : { kind: 'procedural' }
}

/** A declared model or a procedural component can draw the object. */
export function hasSource(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): boolean {
  return Boolean(models[name]) || procedural[name] !== undefined
}

function GltfObject({ url, outline = false, height, onModel, ...props }: ModelProps & { url: string }) {
  // Draco off, drei's built-in meshopt decoder on: nothing is fetched from a CDN.
  const { scene } = useGLTF(url, false, true)
  const root = useMemo(() => {
    const copy = cloneModel(scene)
    prepareModel(copy)
    if (height) scaleToHeight(copy, height)
    normaliseModel(copy)
    return copy
  }, [scene, height])
  // Once per copy, on purpose: a new onModel function on a later render does not run again.
  useLayoutEffect(() => {
    onModel?.(root)
  }, [root])
  const meshes = useMemo(() => (outline ? meshesOf(root) : []), [outline, root])
  return (
    <group {...props}>
      <primitive object={root} />
      {meshes.map((mesh) => (
        <Fragment key={mesh.uuid}>{createPortal(<HoverOutline />, mesh)}</Fragment>
      ))}
    </group>
  )
}

export function SceneObject({ object, outline, height, onModel, ...props }: ModelProps & { object: ObjectName }) {
  const source = resolveObject(object)
  if (source.kind === 'glb') return <GltfObject url={source.url} outline={outline} height={height} onModel={onModel} {...props} />
  const Procedural = procedural[object]
  if (!Procedural) throw new Error(`Nothing draws "${object}": declare its model in glbModels.`)
  return <Procedural {...props} />
}
```

Dans `src/zones/office/CrtScreen.tsx`, remplacer exactement

```ts
import { logoBoxes } from '../../three/logo'
import { CRT_SCREEN } from '../../three/props/CrtTv'
```

par

```ts
import { CRT_SCREEN } from '../../three/assets'
import { logoBoxes } from '../../three/logo'
```

puis exactement

```tsx
    <group position={position} rotation-y={rotationY}>
```

par

```tsx
    <group position={position} rotation-y={rotationY} userData={{ auditExempt: 'screen' }}>
```

(l'image « press start » et le bruit du vol sont un écran pour l'audit ; leurs plans restent à 1 et 2 mm devant `CRT_SCREEN.center`, sur la vitre du modèle).

- [ ] **Step 7: `OfficeScene.tsx` à l'état de la Tâche 11**

Diff attendu par rapport à l'état de la Tâche 10 : l'import de `WallClock`, le buffet devenu un groupe `sideboard` de deux unités du modèle (2,44 m chacune, en x local ±1.22), `outline` sur la télé, `<WallClock />` avant `<WallScreen3D />`.

```tsx
import { ContactShadows } from '@react-three/drei'
import { useQualitySettings } from '../../app/quality'
import { brand } from '../../core/brand'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { WallClock } from './WallClock'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo, shelves } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <Outdoor />
      <Room />
      <SceneObject object="table" name="table" position={table.position} />
      <ChairSet placements={chairs} />
      {microphones.map((mic, index) => (
        <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
      ))}
      <group name="sideboard" position={sideboard.position}>
        <SceneObject object="sideboard" position={[-1.22, 0, 0]} />
        <SceneObject object="sideboard" position={[1.22, 0, 0]} />
      </group>
      <SceneObject object="lamp" name="lamp" position={lamp.position} />
      <Interactive id="laptop" onActivate={objectActions.laptop}>
        <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
      </Interactive>
      <SceneObject object="tvStand" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
      <Interactive id="tv" onActivate={objectActions.tv}>
        <SceneObject object="crtTv" name="tv" outline position={tv.position} rotation-y={tv.rotationY} />
        <CrtScreen />
        <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
      </Interactive>
      <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
      <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
      <SceneObject object="shelves" name="shelves" position={shelves.position} rotation-y={shelves.rotationY} />
      <WallClock />
      <WallScreen3D />
      <AdaController />
      <ContactShadows position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]} scale={1.4} opacity={0.35} blur={2.5} far={1.6} resolution={256} frames={1} />
      <ContactShadows position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]} scale={[5, 7.5]} opacity={0.55} blur={2.4} far={1.4} resolution={512} frames={1} />
    </>
  )
}
```

- [ ] **Step 8: Supprimer les matériaux plats de la première version**

Plus aucun composant n'appelle `materials()`. Dans `src/three/materials.ts` (état de la Tâche 4), remplacer exactement le bloc d'import

```ts
import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type MeshStandardMaterialParameters,
} from 'three'
```

par

```ts
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three'
```

puis supprimer tout le texte depuis la bannière

```ts
/* ------------------------------------------------------------------ *
 *  Flat materials of the first office, kept until no component calls materials() (removed in Task 11)
 * ------------------------------------------------------------------ */
```

jusqu'à la fin du fichier (`skyTexture`, `build`, `LegacyMaterials`, `cache`, `materials()`). Le fichier se termine désormais par :

```ts
/** The shared PBR materials. Suspends until the texture sets are loaded; use inside the Canvas. */
export function useMaterials(): Materials {
  const sets = useTextureSets()
  let materials = built.get(sets)
  if (!materials) {
    materials = buildMaterials(sets)
    built.set(sets, materials)
  }
  return materials
}
```

Run: `git grep -n "materials()\|LegacyMaterials\|props/CrtTv\|props/Sideboard\|props/Cabinet\|props/Chair'" -- src`
Expected: aucune ligne.

- [ ] **Step 9: Vérifier**

Run: `npm run check`
Expected: PASS — tous les tests passent, dont `clockHands` (3), « the wall clock moves to the next phase », les deux tests « Time of day » et le test du vol vers la télé ; `objects.test.ts` vérifie maintenant les trois URL déclarées (`assets/models/modern_wooden_cabinet.glb`, `television_02.glb`, `wall_clock.glb`, par `modelUrl`) et que `'clock'` a une source ; `noUnusedLocals` ne signale rien dans `materials.ts` ; « Initial JS (gzip) » ≤ 1.50 MB ; `No test API (__academy) in the production JS`.

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS — tous les parcours : le socle attend maintenant trois GLB de plus avant `sceneReady` (largement sous les 60 s en rendu logiciel), le laptop reste survolable en vue d'ensemble, `clickObject('tv')` vole jusqu'à la télé puis mène au donjon.

- [ ] **Step 10: Captures de revue et alignement de l'image de la télé**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-11 --views overview,presentation,tv`
Expected: `day-overview.png`, `day-presentation.png`, `day-tv.png` dans `.superpowers/review-shots/task-11/`, code de sortie 0.

À regarder : les deux unités du buffet sous l'écran (4,88 m, la lampe sur l'extrémité droite, rien devant l'écran), leurs façades tournées vers la pièce (si c'est le dos qui se voit, le modèle a sa face avant en −z : ajouter `rotation-y={Math.PI}` aux deux `SceneObject object="sideboard"` d'`OfficeScene.tsx`) ; la télé `television_02` sur son meuble, contour de survol absent au repos ; l'image « press start » (titre pixelisé, logo) posée exactement sur la vitre du modèle dans `day-overview.png` et, sur `day-tv.png`, le bruit du vol plein cadre sur la vitre, sans débord sur le boîtier ni bande de vitre nue ; l'horloge sur le mur du fond, à gauche de l'enseigne, qui marque 14:00 (petite aiguille sur le 2, grande sur le 12) : une aiguille sur le 10 trahirait un sens de rotation inversé.

Si l'image ne tombe pas sur la vitre, corriger `CRT_SCREEN` dans `src/three/assets.ts` : `width` et `height` à la taille de la vitre, `center[0]` et `center[1]` sur son centre ; `center[2]` reste au plus 6 mm devant la face avant du modèle (test de la Tâche 2). Si `center[1]` change, reporter le même décalage sur `layout.flights.tv` (`position[1]` et `target[1]`) pour que le vol vise toujours le centre. Puis :

Run: `npx vitest run src/assets/assets.test.ts src/zones/office/layout.test.ts`
Expected: PASS (« the CRT picture sits just in front of the television », « the TV flight ends 30 to 50 cm in front of the TV picture, aimed at its centre »), puis relancer la commande de captures et revérifier l'alignement.

- [ ] **Step 11: Commit**

```bash
git add src/zones/office/clockHands.ts src/zones/office/clockHands.test.ts src/zones/office/WallClock.tsx src/three/objects.tsx src/three/materials.ts src/zones/office/OfficeScene.tsx src/zones/office/CrtScreen.tsx src/zones/office/layout.ts src/zones/office/layout.test.ts src/core/store.ts src/zones/office/interactions.ts src/zones/office/interactions.test.ts src/ui/Hud.tsx src/ui/Hud.test.tsx content/en/ui.json src/three/assets.ts
git commit -m "feat: sideboard, CRT and wall clock models; the clock and the Time of day button change the phase; TV picture and flight re-aimed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`src/three/assets.ts` n'entre dans le commit que si `CRT_SCREEN` a été corrigé au Step 10.)

---

### Task 12: Chargement en deux étages et décor en modèles (caisson, table basse, suspensions, cadres)

**Files:**
- Create: `src/three/AssetBoundary.tsx`, `src/zones/office/decor/DecorStage.tsx`, `src/zones/office/decor/Decor.tsx`, `src/zones/office/decor/Pendants.tsx`, `src/zones/office/decor/PictureFrames.tsx`, `src/zones/office/decor/posters.ts`
- Modify: `src/app/SceneReadySignal.tsx` (réécriture), `src/app/Stage.tsx` (état de la Tâche 12), `src/zones/office/OfficeScene.tsx` (état final), `src/three/objects.tsx` (quatre GLB du décor) ; seulement si les captures montrent le caisson à l'envers : `src/zones/office/layout.ts` (`objects.cabinet.rotationY`)
- Test: `src/three/AssetBoundary.test.tsx`, `src/zones/office/decor/posters.test.ts`

**Interfaces:**
- Consumes (Tâche 2, `src/three/assets.ts`) : `modelUrl('drawerCabinet' | 'coffeeTable' | 'pendantLamp' | 'pictureFrame')`, `MODEL_PARTS.pendantBulb = 'modern_ceiling_globe'`, `MODEL_PARTS.frameArtwork = 'hanging_picture_frame_01_artwork'`.
- Consumes (Tâche 3, `src/core/store.ts`) : `sceneReady`, `setSceneReady(ready: boolean)`, `decorReady`, `setDecorReady(ready: boolean)`.
- Consumes (Tâche 4) : `markExempt`, `noiseTexture(options?: NoiseOptions): DataTexture`, `tints.warmLight`, `tints.posterPaper`, `MAX_ANISOTROPY` (`src/three/textures.ts`) ; `brand` (`src/core/brand.ts`).
- Consumes (Tâche 5) : `layout.objects.cabinet`, `coffeeTable`, `pendants: Placement[]`, `frames: Placement[]` ; (Tâche 7) `useLightingApplier`, `RIG.emissivePeak` (2.5), `Preset.bulb` ; (Tâche 10) `meshesOf`, `SceneObject` (`onModel`), `OBJECT_NAMES`, `glbModels` ; (Tâche 11) `OfficeScene.tsx` et `objects.tsx` dans leur état de la Tâche 11 ; `Stage.tsx` dans son état de la Tâche 7 (règle des rastériseurs logiciels comprise : `SOFTWARE_DPR`, `SoftwareRendererContext`, `isSoftwareRenderer`, `rendererName` de `src/app/quality.ts`).
- Produces : `SceneReadySignal({ target }: { target: RefObject<Object3D | null> })` ; `DecorStage({ children }: { children: ReactNode })` (groupe `decor`, sa propre `Suspense`) ; `class AssetBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }>` (annule le `reportError()` de R3F pour les erreurs qu'elle a traitées) ; `Decor()` (état de la Tâche 12, que la Tâche 14 complète) ; `Pendants()` (noms `pendant-0`…`pendant-2`) ; `PictureFrames()` (noms `frame-0`, `frame-1`) ; `posters.ts` : `POSTER_COLOURS = ['lime', 'mint', 'blueGrey', 'ink', 'surface3']`, `type PosterColour`, `interface PosterShape { kind: 'rect' | 'circle'; x: number; y: number; w: number; h: number; colour: PosterColour }`, `interface PosterDesign { paper: string; shapes: PosterShape[] }`, `POSTER_SIZE = { width: 512, height: 724 }`, `posterDesign(seed: number): PosterDesign`, `posterTexture(design: PosterDesign, width?: number, height?: number): CanvasTexture`.
- Produces : `ObjectName` gagne `'cabinet' | 'coffeeTable' | 'pendant' | 'pictureFrame'` (GLB) ; `div.stage` porte `data-scene-ready` et `data-decor-ready` (`"true"` / `"false"`) ; scène : groupes `base` et `decor`.

Le chargement en deux étages (spec §7) :
- **Socle.** Tout ce que la première image montre est dans le groupe `base` d'`OfficeScene`, sous la `Suspense` de `Stage` (textures, buffet, télé, horloge). `SceneReadySignal` masque ce groupe dès son montage, compile tous les shaders de la scène par `gl.compileAsync(scene, camera)` (la compilation parcourt aussi les objets masqués ; les lumières, l'environnement et le `PhaseDriver` sont hors du groupe, donc pris en compte), réaffiche le groupe, laisse passer une image de chauffe, puis met `sceneReady` à vrai : l'écran de chargement disparaît sur une image déjà compilée. Une erreur de compilation n'empêche pas l'affichage ; un échec de chargement du socle passe par le chemin existant (`ErrorBoundary` de `App`, mode lecture).
- **Décor.** Monté seulement quand `sceneReady` est vrai, donc téléchargé après la première image, dans sa propre `Suspense` (`DecorStage`) : le bureau reste affiché pendant ce temps. Chaque objet est dans une `AssetBoundary` : un modèle introuvable ou corrompu est omis (avertissement en développement) sans retenir les autres. La racine de R3F 9.8.1 signale pourtant toute erreur attrapée par une frontière avec `reportError()` (un événement `error` de `window`, affiché comme non intercepté et vu comme « page error » par Playwright, qui fait échouer l'e2e « a missing décor model leaves the office usable ») : `AssetBoundary` mémorise les erreurs qu'elle a traitées et annule (`preventDefault`) exactement ces événements-là. `DecorReadySignal` compile le groupe contre la scène (`compileAsync(group, camera, scene)`), l'affiche, puis met `decorReady` à vrai.
- **Ombres de contact.** Avec `frames={1}`, drei 10.7.9 redessine une ombre de contact une fois après chaque rendu du composant (son compteur d'images est une variable locale du rendu). `OfficeScene` se rend de nouveau quand `sceneReady` passe à vrai, après l'image de chauffe : les ombres sont donc redessinées avec le socle visible, alors que leur première image l'avait trouvé masqué. `OfficeScene.tsx` garde exactement son état final ; seul un commentaire l'explique.

- [ ] **Step 1: Écrire le test qui échoue `src/three/AssetBoundary.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { AssetBoundary } from './AssetBoundary'

function Missing(): never {
  throw new Error('Could not load assets/models/potted_plant_01.glb: 404')
}

let errorSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  // React reports every error caught by a boundary on console.error: expected here, kept out of the test output.
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  errorSpy.mockRestore()
  warnSpy.mockRestore()
})

test('renders its children', () => {
  render(
    <AssetBoundary name="frames">
      <p>poster</p>
    </AssetBoundary>,
  )
  expect(screen.getByText('poster')).toBeInTheDocument()
  expect(warnSpy).not.toHaveBeenCalled()
})

// Review focus 3: a missing decor model leaves everything else in place.
test('a failing d\u00e9cor item renders nothing and warns in development', () => {
  render(
    <div data-testid="decor">
      <AssetBoundary name="pottedPlant">
        <p>plant</p>
        <Missing />
      </AssetBoundary>
      <p>coffee table</p>
    </div>,
  )
  expect(screen.getByTestId('decor')).toHaveTextContent(/^coffee table$/)
  expect(warnSpy).toHaveBeenCalledTimes(1)
  expect(warnSpy).toHaveBeenCalledWith('Decor item "pottedPlant" failed to load and is left out.', expect.any(Error))
})

// Review focus 3: R3F reports every caught error with reportError(); the boundary cancels that report, and only that one.
test('an error it has handled is not reported as uncaught', () => {
  const error = new Error('Could not load assets/models/potted_plant_01.glb: 404')
  function Failing(): never {
    throw error
  }
  render(
    <AssetBoundary name="pottedPlant">
      <Failing />
    </AssetBoundary>,
  )
  const reported = (thrown: Error) => {
    const event = new ErrorEvent('error', { error: thrown, cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(reported(error)).toBe(true)
  expect(reported(new Error('something else'))).toBe(false)
})
```

Run: `npx vitest run src/three/AssetBoundary.test.tsx`
Expected: FAIL — `Failed to resolve import "./AssetBoundary" from "src/three/AssetBoundary.test.tsx"`.

- [ ] **Step 2: Créer `src/three/AssetBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  /** Shown in the development warning. */
  name: string
  children: ReactNode
}

/**
 * Errors an AssetBoundary has handled. R3F's root reports every error a boundary catches with reportError(), which
 * fires a window "error" event and shows it as uncaught (a page error for Playwright, an exception in the console);
 * the listener below cancels exactly these events, so a missing decor model ends as one warning, nothing more.
 */
const handled = new WeakSet<object>()
let mounted = 0

function cancelHandledError(event: ErrorEvent) {
  const { error } = event
  if (typeof error === 'object' && error !== null && handled.has(error)) event.preventDefault()
}

/**
 * Error boundary of one decor item (spec section 8): when its model cannot load (404, network cut, corrupt file), the
 * item is left out and the rest of the office carries on. Development builds say so once in the console.
 */
export class AssetBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(error: unknown) {
    if (typeof error === 'object' && error !== null) handled.add(error)
    return { failed: true }
  }

  componentDidMount() {
    if (mounted++ === 0) window.addEventListener('error', cancelHandledError)
  }

  componentWillUnmount() {
    if (--mounted === 0) window.removeEventListener('error', cancelHandledError)
  }

  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn(`Decor item "${this.props.name}" failed to load and is left out.`, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
```

Run: `npx vitest run src/three/AssetBoundary.test.tsx`
Expected: PASS (3 tests), sortie propre (les messages attendus de React et l'avertissement sont interceptés par les espions du test).

- [ ] **Step 3: Écrire le test qui échoue `src/zones/office/decor/posters.test.ts`**

```ts
import { brand } from '../../../core/brand'
import { tints } from '../../../three/tints'
import { POSTER_COLOURS, posterDesign } from './posters'

const SEEDS = [101, 103, 1, 7, 42, 2026]

test('posters use only brand colours on paper', () => {
  for (const seed of SEEDS) {
    const { paper, shapes } = posterDesign(seed)
    expect(paper).toBe(tints.posterPaper)
    expect(shapes.length, `seed ${seed}`).toBeGreaterThanOrEqual(5)
    expect(shapes.length, `seed ${seed}`).toBeLessThanOrEqual(9)
    for (const shape of shapes) {
      expect(POSTER_COLOURS).toContain(shape.colour)
      expect(brand[shape.colour]).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(['rect', 'circle']).toContain(shape.kind)
      // Inside the sheet.
      expect(shape.x).toBeGreaterThanOrEqual(0)
      expect(shape.y).toBeGreaterThanOrEqual(0)
      expect(shape.w).toBeGreaterThan(0)
      expect(shape.h).toBeGreaterThan(0)
      expect(shape.x + shape.w).toBeLessThanOrEqual(1)
      expect(shape.y + shape.h).toBeLessThanOrEqual(1)
    }
  }
})

test('posters are the same on every run', () => {
  expect(posterDesign(101)).toEqual(posterDesign(101))
  expect(posterDesign(103)).toEqual(posterDesign(103))
})

test('the two frames show different posters', () => {
  expect(posterDesign(101)).not.toEqual(posterDesign(103))
})
```

Run: `npx vitest run src/zones/office/decor/posters.test.ts`
Expected: FAIL — `Failed to resolve import "./posters" from "src/zones/office/decor/posters.test.ts"`.

- [ ] **Step 4: Créer `src/zones/office/decor/posters.ts`**

`posterDesign` est pure et testée ; `posterTexture` dessine sur un canvas (DOM, jamais appelée par un test unitaire : jsdom n'a pas `getContext`). Les formes et le grain du papier reprennent l'affiche du bureau de Horn.os, sans ses lettres.

```ts
// Ported from Horn.os (owner's project): js/scene/office.js (buildArt: the composition and the paper grain), LCG kept
import { CanvasTexture, SRGBColorSpace } from 'three'
import { brand } from '../../../core/brand'
import { MAX_ANISOTROPY } from '../../../three/textures'
import { tints } from '../../../three/tints'

/** Brand colours a poster may use (keys of core/brand.ts). */
export const POSTER_COLOURS = ['lime', 'mint', 'blueGrey', 'ink', 'surface3'] as const
export type PosterColour = (typeof POSTER_COLOURS)[number]
/** One shape, in 0..1 poster coordinates from the top left. A circle fills the largest disc of its box. */
export interface PosterShape {
  kind: 'rect' | 'circle'
  x: number
  y: number
  w: number
  h: number
  colour: PosterColour
}
export interface PosterDesign {
  paper: string
  shapes: PosterShape[]
}
/** Pixel size of a poster: the 0.594 x 0.841 m artwork of hanging_picture_frame_01 (ISO A ratio). */
export const POSTER_SIZE = { width: 512, height: 724 } as const

/** Horn.os' LCG: the same seed gives the same poster on every run. Returns numbers in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * An abstract Swiss-style composition in the Athena colours, after the print in Horn.os' office: a disc, a slab, a
 * column, a stair and a base line, placed by the seed. Pure (no DOM). Never any letter: posters carry no text.
 */
export function posterDesign(seed: number): PosterDesign {
  const random = lcg(seed)
  const range = (min: number, max: number) => min + (max - min) * random()
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]
  const aspect = POSTER_SIZE.width / POSTER_SIZE.height
  const shapes: PosterShape[] = []
  // A disc in the upper half, in an accent colour (its box is square in pixels).
  const disc = range(0.3, 0.45)
  shapes.push({ kind: 'circle', x: range(0.08, 0.92 - disc), y: range(0.08, 0.28), w: disc, h: disc * aspect, colour: pick(['lime', 'mint'] as const) })
  // A slab across the middle, and a column standing under it.
  const slab = { x: range(0.08, 0.2), y: range(0.48, 0.56), w: range(0.5, 0.72), h: range(0.03, 0.05) }
  shapes.push({ kind: 'rect', ...slab, colour: pick(['blueGrey', 'ink'] as const) })
  const columnWidth = range(0.05, 0.08)
  shapes.push({ kind: 'rect', x: range(slab.x, slab.x + 0.25), y: slab.y + slab.h, w: columnWidth, h: range(0.2, 0.28), colour: pick(POSTER_COLOURS) })
  // A stair of one to five steps rising to the right, standing on the base line.
  const steps = 1 + Math.floor(random() * 5)
  const stairColour = pick(['ink', 'blueGrey', 'surface3'] as const)
  for (let k = 0; k < steps; k++) {
    const h = 0.05 * (k + 1)
    shapes.push({ kind: 'rect', x: 0.52 + k * 0.07, y: 0.88 - h, w: 0.07, h, colour: stairColour })
  }
  // The base line.
  shapes.push({ kind: 'rect', x: 0.08, y: 0.9, w: 0.84, h: 0.006, colour: 'ink' })
  return { paper: tints.posterPaper, shapes }
}

/** The poster painted on a canvas: paper with a light grain, then the shapes. sRGB, glTF UV convention (no flip). */
export function posterTexture(design: PosterDesign, width: number = POSTER_SIZE.width, height: number = POSTER_SIZE.height): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = design.paper
  ctx.fillRect(0, 0, width, height)
  const grain = lcg(12)
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = grain() < 0.5 ? 'rgba(120,100,70,0.05)' : 'rgba(255,255,255,0.06)'
    ctx.fillRect(grain() * width, grain() * height, 1 + grain() * 2, 1 + grain() * 2)
  }
  for (const shape of design.shapes) {
    ctx.fillStyle = brand[shape.colour]
    const [x, y, w, h] = [shape.x * width, shape.y * height, shape.w * width, shape.h * height]
    if (shape.kind === 'rect') {
      ctx.fillRect(x, y, w, h)
    } else {
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = MAX_ANISOTROPY
  // The artwork mesh comes from a glTF file, whose UVs expect unflipped images.
  texture.flipY = false
  return texture
}
```

Run: `npx vitest run src/zones/office/decor/posters.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Les quatre modèles du décor dans le registre**

Dans `src/three/objects.tsx` (état de la Tâche 11), remplacer exactement

```ts
  | 'clock' // GLB, Task 11
```

par

```ts
  | 'clock' // GLB, Task 11
  | 'cabinet' | 'coffeeTable' | 'pendant' | 'pictureFrame' // GLB, Task 12 (decor)
```

puis exactement

```ts
  'clock',
] as const satisfies readonly ObjectName[]
```

par

```ts
  'clock',
  'cabinet', 'coffeeTable', 'pendant', 'pictureFrame',
] as const satisfies readonly ObjectName[]
```

puis exactement

```ts
  clock: modelUrl('wallClock'),
}
```

par

```ts
  clock: modelUrl('wallClock'),
  cabinet: modelUrl('drawerCabinet'),
  coffeeTable: modelUrl('coffeeTable'),
  pendant: modelUrl('pendantLamp'),
  pictureFrame: modelUrl('pictureFrame'),
}
```

Run: `npx vitest run src/three/objects.test.ts`
Expected: PASS (3 tests ; sept URL déclarées, toutes sous `assets/models/` et présentes dans `MODELS`).

- [ ] **Step 6: Créer les objets du décor**

`src/zones/office/decor/Pendants.tsx` (le matériau de l'ampoule est partagé par les trois copies : un seul appliqueur règle son intensité, `bulb × RIG.emissivePeak`, éteinte le jour) :

```tsx
import { useRef } from 'react'
import type { MeshStandardMaterial, Object3D } from 'three'
import { MODEL_PARTS } from '../../../three/assets'
import { markExempt } from '../../../three/audit'
import { meshesOf } from '../../../three/gltf'
import { SceneObject } from '../../../three/objects'
import { tints } from '../../../three/tints'
import { layout } from '../layout'
import { useLightingApplier } from '../lighting/live'
import { RIG } from '../lighting/rig'

/** Finds the bulb material of a pendant copy and makes it a warm emissive (one material, shared by the three copies). */
function bulbsOf(root: Object3D): MeshStandardMaterial[] {
  const bulbs: MeshStandardMaterial[] = []
  for (const mesh of meshesOf(root)) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const bulb = material as MeshStandardMaterial
      if (bulb.name !== MODEL_PARTS.pendantBulb || !bulb.isMeshStandardMaterial) continue
      markExempt(bulb, 'emissive')
      bulb.emissive.set(tints.warmLight)
      bulbs.push(bulb)
    }
  }
  return bulbs
}

/** Three glass pendants above the table (Poly Haven modern_ceiling_lamp_01): off by day, lit at sunset and night. */
export function Pendants() {
  const bulbs = useRef(new Set<MeshStandardMaterial>())
  useLightingApplier((preset) => {
    for (const bulb of bulbs.current) bulb.emissiveIntensity = preset.bulb * RIG.emissivePeak
  })
  return (
    <>
      {layout.objects.pendants.map((pendant, index) => (
        <SceneObject
          key={index}
          object="pendant"
          name={`pendant-${index}`}
          position={pendant.position}
          rotation-y={pendant.rotationY ?? 0}
          onModel={(root) => {
            for (const bulb of bulbsOf(root)) bulbs.current.add(bulb)
          }}
        />
      ))}
    </>
  )
}
```

`src/zones/office/decor/PictureFrames.tsx` (chaque cadre clone le matériau de son œuvre ; l'affiche et ce clone sont libérés au démontage ; la texture de bruit est partagée et mise en cache, jamais libérée) :

```tsx
import { useEffect, useRef } from 'react'
import type { MeshStandardMaterial, Object3D } from 'three'
import { MODEL_PARTS } from '../../../three/assets'
import { meshesOf } from '../../../three/gltf'
import { noiseTexture } from '../../../three/noise'
import { SceneObject } from '../../../three/objects'
import { layout } from '../layout'
import { posterDesign, posterTexture } from './posters'

/** One poster per frame, in layout order. */
const POSTER_SEEDS = [101, 103] as const

/** Two picture frames on the right wall (Poly Haven hanging_picture_frame_01), each with its own Athena poster. */
export function PictureFrames() {
  // The posters and their materials belong to this component: freed when the office goes away.
  const owned = useRef<{ dispose: () => void }[]>([])
  useEffect(
    () => () => {
      for (const item of owned.current) item.dispose()
      owned.current = []
    },
    [],
  )
  /** Gives this copy's artwork its own material: the poster as colour, a fine paper noise as roughness. */
  const hangPoster = (root: Object3D, seed: number) => {
    for (const mesh of meshesOf(root)) {
      const artwork = mesh.material as MeshStandardMaterial
      if (Array.isArray(mesh.material) || artwork.name !== MODEL_PARTS.frameArtwork) continue
      const poster = posterTexture(posterDesign(seed))
      const material = artwork.clone()
      material.map = poster
      material.roughnessMap = noiseTexture({ seed: 17 })
      material.needsUpdate = true
      mesh.material = material
      owned.current.push(poster, material)
    }
  }
  return (
    <>
      {layout.objects.frames.map((frame, index) => (
        <SceneObject
          key={index}
          object="pictureFrame"
          name={`frame-${index}`}
          position={frame.position}
          rotation-y={frame.rotationY ?? 0}
          onModel={(root) => hangPoster(root, POSTER_SEEDS[index % POSTER_SEEDS.length])}
        />
      ))}
    </>
  )
}
```

`src/zones/office/decor/Decor.tsx` (état de la Tâche 12 ; la Tâche 14 y ajoute les plantes, les vases et les livres) :

```tsx
import { AssetBoundary } from '../../../three/AssetBoundary'
import { SceneObject } from '../../../three/objects'
import { layout } from '../layout'
import { Pendants } from './Pendants'
import { PictureFrames } from './PictureFrames'

/** The decor stage: loaded after the first image, each item left out on its own if it fails (AssetBoundary). */
export function Decor() {
  const { cabinet, coffeeTable } = layout.objects
  return (
    <>
      <AssetBoundary name="cabinet"><SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} /></AssetBoundary>
      <AssetBoundary name="coffeeTable"><SceneObject object="coffeeTable" name="coffeeTable" position={coffeeTable.position} rotation-y={coffeeTable.rotationY} /></AssetBoundary>
      <AssetBoundary name="pendants"><Pendants /></AssetBoundary>
      <AssetBoundary name="frames"><PictureFrames /></AssetBoundary>
    </>
  )
}
```

`src/zones/office/decor/DecorStage.tsx` :

```tsx
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { Group } from 'three'
import { appStore } from '../../../core/store'

/**
 * Hides the decor group until its shaders are compiled against the live scene (lights and environment included), then
 * shows it and sets decorReady. A failed compilation still shows the decor: a stall beats a missing room.
 */
function DecorReadySignal({ target }: { target: RefObject<Group | null> }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  useLayoutEffect(() => {
    if (target.current) target.current.visible = false
  }, [target])
  useEffect(() => {
    const group = target.current
    if (!group) return
    let cancelled = false
    Promise.resolve()
      .then(() => gl.compileAsync(group, camera, scene))
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('Decor shaders did not compile ahead of time.', error)
      })
      .then(() => {
        if (cancelled) return
        group.visible = true
        if (!appStore.getState().decorReady) appStore.getState().setDecorReady(true)
        invalidate()
      })
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, invalidate, target])
  return null
}

/**
 * Second loading stage (spec section 7): its own Suspense boundary, so the office shows while the decor loads.
 * Mounted once the base is ready (OfficeScene), so the decor downloads after the first image.
 */
export function DecorStage({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null)
  return (
    <Suspense fallback={null}>
      <group name="decor" ref={group}>
        {children}
      </group>
      <DecorReadySignal target={group} />
    </Suspense>
  )
}
```

- [ ] **Step 7: Réécrire `src/app/SceneReadySignal.tsx`**

```tsx
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { Object3D } from 'three'
import { appStore } from '../core/store'

type Stage = 'compiling' | 'warm' | 'ready' | 'done'

/**
 * First loading stage (spec section 7, as in Horn.os): the base group stays hidden while every shader it needs compiles
 * (compileAsync, against the scene's lights and environment, which live outside the group), then one warm frame draws
 * it, and only the frame after that sets sceneReady (the loading screen goes away). A failed compilation still shows the
 * office. invalidate() keeps it moving when the canvas renders on demand (another zone on screen).
 */
export function SceneReadySignal({ target }: { target: RefObject<Object3D | null> }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const stage = useRef<Stage>('compiling')

  useLayoutEffect(() => {
    if (target.current) target.current.visible = false
  }, [target])

  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => gl.compileAsync(scene, camera))
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return
        if (target.current) target.current.visible = true
        stage.current = 'warm'
        invalidate()
      })
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera, invalidate, target])

  useFrame(() => {
    if (stage.current === 'warm') {
      // This frame is the warm-up: the base is drawn once before anyone sees it.
      stage.current = 'ready'
      invalidate()
    } else if (stage.current === 'ready') {
      stage.current = 'done'
      if (!appStore.getState().sceneReady) appStore.getState().setSceneReady(true)
    }
  })
  return null
}
```

- [ ] **Step 8: `OfficeScene.tsx` à son état final**

État final du fichier, avec le commentaire des ombres de contact. Diff par rapport à l'état de la Tâche 11 : imports de `useRef`, `Group`, `SceneReadySignal`, `useApp`, `Decor`, `DecorStage` ; `sceneReady` et la ref `base` ; tout ce qui est entre `<Outdoor />` et `<AdaController />` passe dans `<group name="base" ref={base}>` ; après les ombres de contact, `<SceneReadySignal target={base} />` et le décor monté quand `sceneReady` est vrai.

```tsx
import { ContactShadows } from '@react-three/drei'
import { useRef } from 'react'
import type { Group } from 'three'
import { useQualitySettings } from '../../app/quality'
import { SceneReadySignal } from '../../app/SceneReadySignal'
import { brand } from '../../core/brand'
import { useApp } from '../../core/store'
import { Interactive } from '../../three/interactive'
import { useMaterials } from '../../three/materials'
import { SceneObject } from '../../three/objects'
import { ChairSet } from '../../three/props/ChairSet'
import { AdaController } from './AdaController'
import { CameraRig } from './camera/CameraRig'
import { CrtScreen } from './CrtScreen'
import { Decor } from './decor/Decor'
import { DecorStage } from './decor/DecorStage'
import { objectActions } from './interactions'
import { CONTACT_SHADOW_Y, layout } from './layout'
import { useEmissiveLevels } from './lighting/emissive'
import { Lights } from './lighting/Lights'
import { OfficeEnvironment } from './lighting/OfficeEnvironment'
import { PhaseDriver } from './lighting/PhaseDriver'
import { PRESETS } from './lighting/presets'
import { OUTDOOR } from './outdoor/cityPlan'
import { Outdoor } from './outdoor/Outdoor'
import { Room } from './Room'
import { WallClock } from './WallClock'
import { WallScreen3D } from './WallScreen3D'

export function OfficeScene() {
  const settings = useQualitySettings()
  const materials = useMaterials()
  useEmissiveLevels(materials)
  const sceneReady = useApp((s) => s.sceneReady)
  const base = useRef<Group>(null)
  const { table, chairs, microphones, sideboard, lamp, laptop, tvStand, tv, retroConsole, sofa, logo, shelves } = layout.objects
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <fog attach="fog" args={[PRESETS.day.skyHorizon, OUTDOOR.fogNear, OUTDOOR.fogFar]} />
      <CameraRig />
      <OfficeEnvironment />
      <PhaseDriver />
      <Lights settings={settings} />
      <group name="base" ref={base}>
        <Outdoor />
        <Room />
        <SceneObject object="table" name="table" position={table.position} />
        <ChairSet placements={chairs} />
        {microphones.map((mic, index) => (
          <SceneObject key={index} object="microphone" name={`microphone-${index}`} position={mic.position} rotation-y={mic.rotationY} />
        ))}
        <group name="sideboard" position={sideboard.position}>
          <SceneObject object="sideboard" position={[-1.22, 0, 0]} />
          <SceneObject object="sideboard" position={[1.22, 0, 0]} />
        </group>
        <SceneObject object="lamp" name="lamp" position={lamp.position} />
        <Interactive id="laptop" onActivate={objectActions.laptop}>
          <SceneObject object="laptop" name="laptop" position={laptop.position} rotation-y={laptop.rotationY} />
        </Interactive>
        <SceneObject object="tvStand" name="tvStand" position={tvStand.position} rotation-y={tvStand.rotationY} />
        <Interactive id="tv" onActivate={objectActions.tv}>
          <SceneObject object="crtTv" name="tv" outline position={tv.position} rotation-y={tv.rotationY} />
          <CrtScreen />
          <SceneObject object="retroConsole" name="retroConsole" position={retroConsole.position} rotation-y={retroConsole.rotationY} />
        </Interactive>
        <SceneObject object="sofa" name="sofa" position={sofa.position} rotation-y={sofa.rotationY} />
        <SceneObject object="logoCubes" name="logo" position={logo.position} rotation-y={logo.rotationY} />
        <SceneObject object="shelves" name="shelves" position={shelves.position} rotation-y={shelves.rotationY} />
        <WallClock />
        <WallScreen3D />
        <AdaController />
      </group>
      {/* frames={1}: drei draws a contact shadow once per render of the component. OfficeScene renders again when
          sceneReady turns true, so the shadows are drawn once more with the base visible (it is hidden while compiling). */}
      <ContactShadows position={[layout.ada.position[0], CONTACT_SHADOW_Y, layout.ada.position[2]]} scale={1.4} opacity={0.35} blur={2.5} far={1.6} resolution={256} frames={1} />
      <ContactShadows position={[table.position[0], CONTACT_SHADOW_Y, table.position[2]]} scale={[5, 7.5]} opacity={0.55} blur={2.4} far={1.4} resolution={512} frames={1} />
      <SceneReadySignal target={base} />
      {sceneReady && (
        <DecorStage>
          <Decor />
        </DecorStage>
      )}
    </>
  )
}
```

- [ ] **Step 9: `Stage.tsx` à l'état de la Tâche 12**

Diff attendu par rapport à l'état de la Tâche 7 : plus d'import ni de rendu de `SceneReadySignal` (il vit dans `OfficeScene`) ; la `Suspense` ne contient plus que `<OfficeScene />` ; `sceneReady` et `decorReady` lus dans le store et posés sur `div.stage` en `data-scene-ready` / `data-decor-ready` (lus par `scripts/perf.mjs` en production, où l'API de test n'existe pas). Tout le reste de la Tâche 7 reste tel quel, en particulier la règle des rastériseurs logiciels : l'état `software`, `dpr={software ? SOFTWARE_DPR : …}`, le test de `onCreated` et le `SoftwareRendererContext.Provider`. Fichier complet :

```tsx
import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, lazy, useReducer, useState } from 'react'
import { appStore, useApp } from '../core/store'
import { CAMERA, layout } from '../zones/office/layout'
import { OfficeScene } from '../zones/office/OfficeScene'
import { isTuneEnabled } from '../zones/office/tune'
import {
  INITIAL_QUALITY,
  QUALITY_SETTINGS,
  QualityContext,
  SOFTWARE_DPR,
  SoftwareRendererContext,
  isSoftwareRenderer,
  reduceQuality,
  rendererName,
} from './quality'
import { TestApiBridge } from './TestApiBridge'
import { onContextLost } from './webgl'

const TuneMode = import.meta.env.DEV ? lazy(() => import('../zones/office/TuneMode')) : null
const tuneEnabled = isTuneEnabled(window.location.search, import.meta.env.DEV)

export function Stage() {
  const active = useApp((s) => s.zone === 'office' || s.transition !== null)
  const sceneReady = useApp((s) => s.sceneReady)
  const decorReady = useApp((s) => s.decorReady)
  const [quality, dispatchQuality] = useReducer(reduceQuality, INITIAL_QUALITY)
  const [software, setSoftware] = useState(false)
  return (
    <div
      className="stage"
      data-testid="stage"
      data-quality={quality.level}
      data-scene-ready={String(sceneReady)}
      data-decor-ready={String(decorReady)}
    >
      <Canvas
        shadows="percentage"
        dpr={software ? SOFTWARE_DPR : QUALITY_SETTINGS[quality.level].dpr}
        frameloop={active ? 'always' : 'demand'}
        camera={{ ...CAMERA, position: layout.rail[0].position }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Without a GPU (the e2e browser), the low tier at SOFTWARE_DPR keeps the office usable.
          if (isSoftwareRenderer(rendererName(gl.getContext()))) {
            setSoftware(true)
            dispatchQuality('software')
          }
          gl.domElement.addEventListener(
            'webglcontextlost',
            onContextLost(gl.domElement, () => appStore.getState().reportWebglLost()),
            { once: true },
          )
        }}
      >
        <PerformanceMonitor
          onDecline={() => dispatchQuality('decline')}
          onIncline={() => dispatchQuality('incline')}
        >
          <QualityContext.Provider value={quality.level}>
            <SoftwareRendererContext.Provider value={software}>
              {import.meta.env.DEV && <TestApiBridge />}
              {/* The base (textures and three models) suspends here; SceneReadySignal and the decor stage live in OfficeScene. */}
              <Suspense fallback={null}>
                <OfficeScene />
              </Suspense>
              {TuneMode && tuneEnabled && (
                <Suspense fallback={null}>
                  <TuneMode />
                </Suspense>
              )}
            </SoftwareRendererContext.Provider>
          </QualityContext.Provider>
        </PerformanceMonitor>
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 10: Vérifier**

Run: `npm run check`
Expected: PASS — tous les tests passent, dont `AssetBoundary` (3) et `posters` (3) ; sortie sans avertissement ; « Initial JS (gzip) » ≤ 1.50 MB ; `No test API (__academy) in the production JS`.

Run: `npm run e2e`
Expected: PASS — tous les parcours (`office.spec.ts`, `reading.spec.ts`) : `sceneReady` arrive après la compilation et l'image de chauffe, sous 60 s en rendu logiciel ; les tests de parcours n'attendent pas le décor ; le mode lecture ne charge toujours aucun asset 3D.

- [ ] **Step 11: Captures de revue**

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-12 --phases day,night --wait-decor`
Expected: `day-overview.png`, `day-presentation.png`, `night-overview.png`, `night-presentation.png` dans `.superpowers/review-shots/task-12/`, aucun avertissement « the decor was not ready », code de sortie 0.

À regarder : le caisson à tiroirs contre le mur de droite, tiroirs tournés vers la pièce (la face avant des modèles est +z ; si c'est le dos qui se voit, corriger `layout.objects.cabinet.rotationY` de π, sans toucher sa position) ; la table basse devant le canapé ; les trois suspensions en verre au-dessus de la table, éteintes le jour, allumées (ampoules chaudes) la nuit, sans toucher la vue de l'écran mural ; les deux cadres du mur de droite, chacun avec une affiche différente aux couleurs Athena (disque lime ou menthe, aplats, escalier, aucune lettre, image à l'endroit) ; ombres de contact présentes sous la table et sous Ada ; aucune différence d'éclairage entre le socle et le décor.

- [ ] **Step 12: Commit**

```bash
git add src/three/AssetBoundary.tsx src/three/AssetBoundary.test.tsx src/zones/office/decor src/app/SceneReadySignal.tsx src/app/Stage.tsx src/zones/office/OfficeScene.tsx src/three/objects.tsx src/zones/office/layout.ts
git commit -m "feat: two-stage loading (compiled base with a warm frame, decor in its own Suspense) and decor models: cabinet, coffee table, pendants, Athena posters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`src/zones/office/layout.ts` n'entre dans le commit que si `objects.cabinet.rotationY` a été corrigé au Step 11 ; relancer alors `npx vitest run src/zones/office` avant de commiter.)

---

### Task 13: Générateurs de plantes et de livres

**Files:**
- Create: `src/three/plants/leaf.ts`, `src/three/plants/plantGeometry.ts`, `src/three/plants/hanging.ts`, `src/three/plants/plantMaterials.ts`, `src/three/plants/sway.ts`, `src/three/plants/Plant.tsx`, `src/three/plants/HangingPlant.tsx`, `src/three/shelfBooks.ts`, `src/three/Books.tsx`
- Test: `src/three/plants/sway.test.ts`, `src/three/plants/plant.test.ts`, `src/three/plants/hanging.test.ts`, `src/three/books.test.ts`

Deux modules de géométrie ne portent pas le nom de leur composant, pour une raison de plateforme : `plants/plantGeometry.ts` (et non `plants/plant.ts`) et `shelfBooks.ts` (et non `books.ts`). Sous Windows (NTFS, insensible à la casse), `import { Plant } from './plants/Plant'` se résout sur `plant.ts` avant `Plant.tsx` (l'extension `.ts` passe avant `.tsx`) : tsc s'arrête sur `TS1149 … differs from already included file name … only in casing` et Vite chargerait le mauvais module ; idem pour `./Books` et `books.ts` (vérifié dans la copie de travail). Les noms exportés sont ceux du bloc Interfaces ci-dessous, et les fichiers de test s'appellent `plant.test.ts` et `books.test.ts`.

**Interfaces:**
- Consumes (Tâche 4) : `mergeParts(parts: readonly Part[], options?: { colours?: boolean }): BufferGeometry`, `at(x, y, z, rotation?, scale?): Matrix4`, `type Part` (`src/three/merge.ts`) ; `noiseTexture(options?: NoiseOptions): DataTexture`, `speckleTexture(options: SpeckleOptions): DataTexture` (`src/three/noise.ts`, défaut `repeat` [3, 1] pour la moucheture) ; `tints` (`leafGreens`, `stem`, `soil`, `potGlazes`, `potDots`, `hangingGlazes`, `cord`, `bookCovers`, `bookInks`, `bookPages`) ; `ENV_MAP_INTENSITY` (`src/three/materials.ts`) ; `isTextured(material)` (`src/three/audit.ts`, tests).
- Consumes (Tâche 5) : `PlantKind`, `PotGlaze`, `HangingGlaze`, `PlantPlacement`, `HangingPlacement`, `ShelfBooksSpec` (`src/three/plants/types.ts`) ; dans les tests : `SIZES` (`src/zones/office/footprints.ts`, clés `monstera`, `palm`, `fern`, `pothos`, `succulent`, `herb`, `hangingPlant`), `layout.objects.plants`, `layout.objects.hangingPlants`, `layout.objects.shelfBooks`, `SHELVES` (`src/zones/office/layout.ts`).
- Consumes (Tâche 9) : `between(a: Vector3, b: Vector3, r0: number, r1: number, segments?: number): Part` (`src/three/shapes.ts`).
- Produces (noms exacts) :
  - `src/three/plants/leaf.ts` : `interface LeafOptions { kind?: 'oval' | 'heart' | 'blade' | 'round'; len?: number; wid?: number; split?: boolean; steps?: number; droop?: number; fold?: number }`, `leafGeometry(options?: LeafOptions): BufferGeometry`.
  - `src/three/plants/plantGeometry.ts` : `interface PlantGeometry { pot: BufferGeometry | null; canopy: BufferGeometry }`, `interface PlantOptions { r; h; pot: PotGlaze; scale; seed; fall? }`, `plantGeometry(kind: PlantKind, options: PlantOptions): PlantGeometry` (cache par arguments).
  - `src/three/plants/hanging.ts` : `interface HangingGeometry { cords; pot; canopy }` (trois `BufferGeometry`), `type HangingOptions = Omit<HangingPlacement, 'position'>`, `hangingGeometry(options: HangingOptions): HangingGeometry` (cache par options), et en plus `interface Vine { points: Vector3[]; out: Vector3 }`, `hangingVines(options: Pick<HangingOptions, 'seed' | 'vines' | 'length' | 'drop'>): Vine[]`, `HANGING_POT = { r: 0.09, h: 0.11 }`, `VINE_REACH = 0.19`.
  - `src/three/plants/plantMaterials.ts` : `interface PlantMaterials { canopy; pots: Record<Exclude<PotGlaze, 'none'>, MeshStandardMaterial>; hangingPots: Record<HangingGlaze, MeshStandardMaterial>; cord }`, `plantMaterials(): PlantMaterials` (singleton construit au premier appel).
  - `src/three/plants/sway.ts` : `swayRotation(time: number, amplitude: number, phase: number): { x: number; z: number }` et en plus `useSway(target: RefObject<Object3D | null>, amplitude: number, phase: number, enabled: boolean): void` (balance x et z à chaque image, remet à 0 quand `enabled` est faux ; utilisé par la Tâche 14 pour les grandes plantes).
  - `src/three/plants/Plant.tsx` : `Plant({ placement, animate, name }: { placement: PlantPlacement; animate: boolean; name?: string })`.
  - `src/three/plants/HangingPlant.tsx` : `HangingPlant({ placement, animate, name }: { placement: HangingPlacement; animate: boolean; name?: string })`, `HANGING_SWAY = 0.02`.
  - `src/three/shelfBooks.ts` : `type BookKind = 'paperback' | 'hardback' | 'art'`, `interface SpineDesign { cover: number; ink: number; bands: { y: number; h: number }[]; kind: BookKind }`, `spineDesign(index: number, seed: number): SpineDesign`, `shelfBooksGeometry(spec: ShelfBooksSpec): BufferGeometry`, `bookAtlasTexture(): CanvasTexture`, `booksMaterial(): MeshStandardMaterial`, et en plus `ATLAS = { cols: 16, rows: 8, cellWidth: 128, cellHeight: 256 }`, `SPINE_CELLS = 125`, `ATLAS_SEED = 42`, `BOOK_SHELF_DEPTH = 0.24`, `INK_CONTRAST = 0.25`.
  - `src/three/Books.tsx` : `Books({ spec, name }: { spec: ShelfBooksSpec; name?: string })`.

Portée : spec §3 « Plantes » et « Étagères … avec des livres » ; portage de Horn.os `js/lib/plants.js`, `js/scene/hanging.js` (et le profil de `planter` de `js/scene/models.js`), `js/scene/books.js`. Chaque fichier porté commence par `// Ported from Horn.os (owner's project): <chemin>` et garde le LCG de Horn (`s = s * 1664525 + 1013904223`). Deux maillages par plante (pot, feuillage fusionné), trois par plante suspendue (cordes, pot, feuillage), un par rangée de livres. Rien n'est encore affiché : la Tâche 14 monte ces composants dans le décor.

Écarts assumés par rapport à Horn.os, tous imposés par les empreintes de `footprints.ts` (Tâche 5), qui servent aux tests de dégagement du laptop et du coin rétro (le palmier du coin salon est en `[4.45, 0, -2.9]`, échelle 0.9) :
- hauteurs mesurées dans la copie de travail avec les valeurs de Horn : monstera 1,004 m pour 0,855 permis, palmier 1,592 m pour 1,17, vrilles du pothos des étagères 0,61 m sous le pot pour 0,48, plante suspendue 0,70 m de large pour 0,50 et 1,46 m de haut pour 1,45 ;
- valeurs retenues (le pire de 25 graines par placement du plan, rapport à l'empreinte) : monstera 0,954 en hauteur, palmier 0,975, herbe 0,960, fougère 0,919 en largeur, pothos 0,518 × échelle sous le pot (0,6 permis), plantes suspendues ±0,218 m et 1,38 m au plus ;
- les dos de livres sont abstraits (couleur, bandes, une barre de titre, une marque) : aucun texte (Global Constraints) ; les livres d'art sont moins profonds (0,18 à 0,20 m au lieu de 0,23 à 0,26) pour tenir dans les 0,24 m de l'étagère contre le mur.

- [ ] **Step 1: Écrire le test qui échoue `src/three/plants/sway.test.ts`**

```ts
import { swayRotation } from './sway'

test('sway stays within its amplitude', () => {
  const amplitude = 0.01
  const zs: number[] = []
  for (let t = 0; t < 60; t += 0.37) {
    const { x, z } = swayRotation(t, amplitude, 2.1)
    expect(Math.abs(z)).toBeLessThanOrEqual(amplitude)
    expect(Math.abs(x)).toBeLessThanOrEqual(amplitude * 0.6)
    zs.push(z)
  }
  expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(amplitude)
  // The phase sets plants apart: two seeds never sway in step.
  expect(swayRotation(3, amplitude, 11).z).not.toBeCloseTo(swayRotation(3, amplitude, 23).z, 6)
})

test('no amplitude, no sway', () => {
  for (const t of [0, 1.3, 42]) {
    const { x, z } = swayRotation(t, 0, 5)
    expect(Math.abs(x) + Math.abs(z)).toBe(0)
  }
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/three/plants/sway.test.ts`
Expected: FAIL — `Failed to resolve import "./sway" from "src/three/plants/sway.test.ts"`.

- [ ] **Step 3: Créer `src/three/plants/sway.ts`**

Le balancement de Horn.os (boucle d'animation de `office.js`) : deux sinus de périodes incommensurables autour de l'origine de l'objet (base du pot, ou crochet d'une plante suspendue, qui devient un pendule). `useSway` n'écrit que x et z : la rotation propre d'un placement (y) reste intacte.

```ts
// Ported from Horn.os (owner's project): js/scene/office.js (the swaying loop of the animation frame)
import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Object3D } from 'three'

/**
 * A slow, uneven sway: two sines of incommensurate periods so the motion never visibly repeats. Radians, about the
 * object's origin (a pot's base, or a hanging plant's hook, where it is a pendulum).
 */
export function swayRotation(time: number, amplitude: number, phase: number): { x: number; z: number } {
  return { z: Math.sin(time * 0.7 + phase) * amplitude, x: Math.cos(time * 0.53 + phase) * amplitude * 0.6 }
}

/**
 * Sways `target` every frame while `enabled` (quality tier and reduced motion decide), and stands it still otherwise.
 * Only x and z rotations are written: a placement's own turn (y) is left alone.
 */
export function useSway(target: RefObject<Object3D | null>, amplitude: number, phase: number, enabled: boolean): void {
  useFrame(({ clock }) => {
    const object = target.current
    if (!object) return
    const { x, z } = enabled ? swayRotation(clock.elapsedTime, amplitude, phase) : { x: 0, z: 0 }
    object.rotation.x = x
    object.rotation.z = z
  })
}
```

Run: `npx vitest run src/three/plants/sway.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Écrire le test qui échoue `src/three/plants/plant.test.ts`**

Les tests des plantes lisent le plan réel de la salle : chaque plante de `layout.objects.plants`, avec sa graine et 24 autres (au cas où le mode réglage changerait une graine), doit tenir dans son empreinte. L'option `below` du pothos (0,6 × échelle sous le pot) est celle que `footprints.ts` passe à `boxFor`. « Le même à chaque fois » se vérifie en rechargeant le module (cache vide) avec un `Math.random` truqué : seul le LCG décide (three appelle `Math.random` pour les `uuid`, on ne peut donc pas exiger qu'il ne soit jamais appelé).

```ts
import { Box3, Color, DoubleSide, type BufferGeometry } from 'three'
import { SIZES } from '../../zones/office/footprints'
import { layout } from '../../zones/office/layout'
import { isTextured } from '../audit'
import { ENV_MAP_INTENSITY } from '../materials'
import { tints } from '../tints'
import { plantGeometry, type PlantGeometry } from './plantGeometry'
import { plantMaterials } from './plantMaterials'
import type { PlantKind } from './types'

/** zones/office/footprints.ts: pothos vines may hang this far (x scale) below the pot (`below` of boxFor). */
const BELOW: Partial<Record<PlantKind, number>> = { pothos: 0.6 }
const KINDS: PlantKind[] = ['monstera', 'palm', 'fern', 'pothos', 'succulent', 'herb']

const positions = (geometry: BufferGeometry) => Array.from(geometry.getAttribute('position').array)
function bounds(plant: PlantGeometry): Box3 {
  const box = new Box3().setFromBufferAttribute(plant.canopy.getAttribute('position') as never)
  if (plant.pot) box.union(new Box3().setFromBufferAttribute(plant.pot.getAttribute('position') as never))
  return box
}
const key = (r: number, g: number, b: number) => [r, g, b].map((n) => n.toFixed(5)).join(',')
const colourKey = (colour: string) => {
  const c = new Color(colour)
  return key(c.r, c.g, c.b)
}

test('a plant is the same on every run', async () => {
  const options = { r: 0.16, h: 0.22, pot: 'cream' as const, scale: 0.9, seed: 11 }
  const first = plantGeometry('monstera', options)
  expect(plantGeometry('monstera', { ...options })).toBe(first)
  // A fresh module (empty cache) with a rigged Math.random builds the very same plant: only Horn.os' LCG decides.
  vi.resetModules()
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  const again = (await import('./plantGeometry')).plantGeometry('monstera', options)
  random.mockRestore()
  expect(again).not.toBe(first)
  expect(positions(again.canopy)).toEqual(positions(first.canopy))
  expect(positions(again.pot!)).toEqual(positions(first.pot!))
  expect(positions(plantGeometry('monstera', { ...options, seed: 12 }).canopy)).not.toEqual(positions(first.canopy))
})

test('each kind stays within its footprint', () => {
  // Every plant of the layout, with its own seed and 24 others: the footprints keep the laptop and the retro corner clear.
  for (const [index, placement] of layout.objects.plants.entries()) {
    const [w, h, d] = SIZES[placement.kind].map((n) => n * placement.scale)
    const below = (BELOW[placement.kind] ?? 0) * placement.scale
    for (const seed of [placement.seed, ...Array.from({ length: 24 }, (_, i) => i + 1)]) {
      const box = bounds(plantGeometry(placement.kind, { ...placement, seed }))
      const label = `plant-${index} (${placement.kind}) seed ${seed}`
      expect(Math.max(-box.min.x, box.max.x), label).toBeLessThanOrEqual(w / 2)
      expect(Math.max(-box.min.z, box.max.z), label).toBeLessThanOrEqual(d / 2)
      expect(box.max.y, label).toBeLessThanOrEqual(h)
      expect(box.min.y, label).toBeGreaterThanOrEqual(-below - 1e-9)
    }
  }
})

test('a potless plant has no pot', () => {
  const soil = colourKey(tints.soil)
  const potless = plantGeometry('fern', { r: 0.08, h: 0.1, pot: 'none', scale: 0.6, seed: 73 })
  expect(potless.pot).toBeNull()
  const colours = potless.canopy.getAttribute('color')
  for (let i = 0; i < colours.count; i++) expect(key(colours.getX(i), colours.getY(i), colours.getZ(i))).not.toBe(soil)
  const potted = plantGeometry('fern', { r: 0.08, h: 0.1, pot: 'slate', scale: 0.6, seed: 73 })
  expect(potted.pot).not.toBeNull()
  const pot = new Box3().setFromBufferAttribute(potted.pot!.getAttribute('position') as never)
  expect(pot.min.y).toBeCloseTo(0, 6)
  expect(pot.max.y).toBeCloseTo(0.1, 6)
  // Without a pot the plant grows from the origin, so it can stand on a vase's rim.
  expect(new Box3().setFromBufferAttribute(potless.canopy.getAttribute('position') as never).max.y).toBeLessThan(
    new Box3().setFromBufferAttribute(potted.canopy.getAttribute('position') as never).max.y,
  )
})

test('pothos vines fall toward their fall direction', () => {
  const h = 0.12
  for (const fall of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const seed of [31, 53, 71]) {
      const { canopy } = plantGeometry('pothos', { r: 0.1, h, pot: 'terracotta', scale: 1, seed, fall })
      const position = canopy.getAttribute('position')
      let x = 0
      let z = 0
      // Below the rim there are only vines: their mean horizontal offset points where they fall.
      for (let i = 0; i < position.count; i++) {
        if (position.getY(i) < h * 0.96 - 0.05) {
          x += position.getX(i)
          z += position.getZ(i)
        }
      }
      const angle = Math.atan2(x, z)
      const off = Math.abs(Math.atan2(Math.sin(angle - fall), Math.cos(angle - fall)))
      expect(off, `fall ${fall.toFixed(2)} seed ${seed}`).toBeLessThan(0.9)
    }
  }
})

test('the canopy carries leaf colours and UVs', () => {
  const allowed = new Set([...tints.leafGreens, tints.stem, tints.soil].map(colourKey))
  const greens = new Set(tints.leafGreens.map(colourKey))
  for (const kind of KINDS) {
    const { canopy } = plantGeometry(kind, { r: 0.12, h: 0.14, pot: 'terracotta', scale: 1, seed: 7 })
    const count = canopy.getAttribute('position').count
    expect(canopy.getAttribute('uv').count, kind).toBe(count)
    const colours = canopy.getAttribute('color')
    expect(colours.count, kind).toBe(count)
    const seen = new Set<string>()
    for (let i = 0; i < count; i++) {
      const k = key(colours.getX(i), colours.getY(i), colours.getZ(i))
      expect(allowed.has(k), `${kind}: ${k}`).toBe(true)
      if (greens.has(k)) seen.add(k)
    }
    expect(seen.size, kind).toBeGreaterThanOrEqual(2)
  }
})

test('every plant material is textured', () => {
  const m = plantMaterials()
  expect(plantMaterials()).toBe(m)
  const all = [m.canopy, m.cord, ...Object.values(m.pots), ...Object.values(m.hangingPots)]
  expect(all).toHaveLength(10)
  for (const material of all) expect(isTextured(material), material.name).toBe(true)
  expect(m.canopy).toMatchObject({ vertexColors: true, side: DoubleSide, roughness: 0.68, envMapIntensity: ENV_MAP_INTENSITY.plant })
  expect(m.pots.brass.metalness).toBe(0.7)
})
```

- [ ] **Step 5: Lancer le test pour le voir échouer**

Run: `npx vitest run src/three/plants/plant.test.ts`
Expected: FAIL — `Failed to resolve import "./plantGeometry" from "src/three/plants/plant.test.ts"`.

- [ ] **Step 6: Créer `src/three/plants/leaf.ts`**

```ts
// Ported from Horn.os (owner's project): js/lib/plants.js
import { Shape, ShapeGeometry, Vector2, type BufferGeometry } from 'three'

/*
 * One leaf: a flat outline bent twice, down along its length (droop) and up along its width (fold). A flat card
 * vanishes edge-on and catches the light as one tone; the second bend makes a canopy read as many surfaces.
 */

/**
 * Half-width of the leaf as a fraction of its widest point, along its length. The exponent separates a laurel from
 * a banana: below 0.5 the leaf is nearly parallel-sided with a sudden tip, above 0.8 it is almost a circle.
 */
const PROFILE = {
  oval: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.6),
  heart: (t: number) => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.48),
  blade: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.26),
  round: (t: number) => Math.pow(Math.sin(Math.PI * t), 0.9),
}

/**
 * The slits of a monstera leaf, as bands of `t` where the outline dives toward the midrib. Three, cut two fifths of
 * the way in: four deep slits chop the leaf into five lobes, which reads as a conifer at screen size.
 */
const SLITS = [0.34, 0.56, 0.76]
const cut = (t: number) => (SLITS.some((c) => Math.abs(t - c) < 0.026) ? 0.44 : 1)

export interface LeafOptions {
  kind?: keyof typeof PROFILE
  len?: number
  wid?: number
  split?: boolean
  steps?: number
  droop?: number
  fold?: number
}

/**
 * One leaf growing along +y from the origin, facing +z, in metres. `split` adds the monstera slits; `steps` is per
 * side (small leaves get fewer outline points). UVs are the outline coordinates, in metres.
 */
export function leafGeometry({ kind = 'oval', len = 0.2, wid = 0.1, split = false, steps = 26, droop = 0.35, fold = 0.35 }: LeafOptions = {}): BufferGeometry {
  const profile = PROFILE[kind]
  const points: Vector2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = profile(t) * (split ? cut(t) : 1)
    points.push(new Vector2((r * wid) / 2, t * len))
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const r = profile(t) * (split ? cut(t) : 1)
    points.push(new Vector2((-r * wid) / 2, t * len))
  }
  const geometry = new ShapeGeometry(new Shape(points))
  // `droop` arcs the leaf away from the stem, quadratically so the base stays stiff; `fold` lifts both edges
  // relative to the midrib. A bent leaf keeps its arc length, so it covers less ground.
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const t = Math.max(0, position.getY(i) / len)
    position.setZ(i, -droop * len * t * t + fold * Math.abs(x))
    position.setY(i, position.getY(i) * (1 - 0.14 * t * t))
  }
  geometry.computeVertexNormals()
  return geometry
}
```

- [ ] **Step 7: Créer `src/three/plants/plantGeometry.ts`**

`plant()` de Horn.os, géométrie seule : le pot (corps et lèvre fusionnés) d'un côté, tout le reste (feuilles, tiges, terre) fusionné avec une couleur par sommet de l'autre. Le tirage du LCG suit l'ordre de Horn ; seules les quatre hauteurs du commentaire d'en-tête changent.

```ts
// Ported from Horn.os (owner's project): js/lib/plants.js
import { CircleGeometry, Color, CylinderGeometry, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import { at, mergeParts, type Part } from '../merge'
import { tints } from '../tints'
import { leafGeometry } from './leaf'
import type { PlantKind, PotGlaze } from './types'

/*
 * Houseplants as geometry. Every plant bakes its whole canopy (leaves, stems and the soil disc) into one geometry
 * whose leaf colours ride on a vertex attribute, and its pot (body and rim) into another: two meshes per plant,
 * whatever grows in it. Horn.os' LCG makes each plant the same on every run.
 *
 * Four heights differ from Horn.os so that every plant stays inside its footprint (zones/office/footprints.ts), which
 * the layout tests use to keep the laptop and the retro corner clear: monstera petioles rise 0.2-0.4 (Horn 0.34-0.7),
 * palm canes stand 0.45 x k (Horn 0.8 x k) with fronds curled 0.5 (Horn 0.9), pothos vines drop 0.35-0.6
 * (Horn 0.4-0.9), herb stems rise 0.04-0.12 with leaves of 0.03-0.06 (Horn 0.04-0.14 and 0.035-0.065). All x scale.
 */

export interface PlantGeometry {
  /** Pot body and rim, with UVs around the pot; null for a potless plant (one standing in a vase). */
  pot: BufferGeometry | null
  /** Leaves, stems and soil in one geometry, with a 'color' attribute and UVs (leaves: outline in metres). */
  canopy: BufferGeometry
}
export interface PlantOptions {
  /** Pot radius and height, in metres. */
  r: number
  h: number
  pot: PotGlaze
  /** Multiplies the size of the foliage (not of the pot). */
  scale: number
  seed: number
  /** Pothos only: direction (radians about +y, 0 = +z) the vines spill toward; random directions when omitted. */
  fall?: number
}

/** Horn.os' LCG: numbers in [0, 1), the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const UP = new Vector3(0, 1, 0)
const cache = new Map<string, PlantGeometry>()

/** One plant standing on the origin (bottom of the pot). Cached by its arguments, never disposed: placements share it. */
export function plantGeometry(kind: PlantKind, options: PlantOptions): PlantGeometry {
  const { r, h, pot, scale, seed, fall } = options
  const key = JSON.stringify([kind, r, h, pot, scale, seed, fall ?? null])
  const cached = cache.get(key)
  if (cached) return cached
  const built = buildPlant(kind, r, h, pot, scale, seed, fall ?? null)
  cache.set(key, built)
  return built
}

function buildPlant(kind: PlantKind, r: number, h: number, pot: PotGlaze, scale: number, seed: number, fall: number | null): PlantGeometry {
  const rand = seeded(seed)
  const greens = tints.leafGreens.map((colour) => new Color(colour))
  const stem = new Color(tints.stem)
  const pick = () => greens[Math.floor(rand() * greens.length)]
  const parts: Part[] = []

  // The pot: body and rim share a material, so they merge; the soil rides in the canopy with a brown vertex colour.
  let potGeometry: BufferGeometry | null = null
  if (pot !== 'none') {
    const body = new CylinderGeometry(r, r * 0.76, h, 18)
    const rim = new CylinderGeometry(r * 1.07, r * 1.07, h * 0.12, 18)
    potGeometry = mergeParts([
      { geometry: body, matrix: at(0, h / 2, 0) },
      { geometry: rim, matrix: at(0, h * 0.94, 0) },
    ])
    body.dispose()
    rim.dispose()
    parts.push({ geometry: new CircleGeometry(r * 0.95, 18).rotateX(-Math.PI / 2), matrix: at(0, h * 0.97, 0), colour: new Color(tints.soil) })
  }
  const base = pot === 'none' ? 0 : h * 0.96

  // A stem is a part, not a mesh: it merges with the canopy.
  const stemPart = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, radius: number) => {
    const a = new Vector3(x0, y0, z0)
    const dir = new Vector3(x1, y1, z1).sub(a)
    const length = dir.length()
    if (length < 1e-4) return
    const matrix = new Matrix4().compose(a.clone().addScaledVector(dir, 0.5), new Quaternion().setFromUnitVectors(UP, dir.normalize()), new Vector3(1, 1, 1))
    parts.push({ geometry: new CylinderGeometry(radius * 0.7, radius, length, 5), matrix, colour: stem })
  }
  // One leaf, grown along +y, pitched away from vertical by `tilt` and swung round the stem by `yaw`.
  const leafPart = (geometry: BufferGeometry, x: number, y: number, z: number, yaw: number, tilt: number, roll = 0) => {
    const matrix = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(tilt, yaw, roll, 'YXZ')), new Vector3(1, 1, 1))
    parts.push({ geometry, matrix, colour: pick() })
  }

  if (kind === 'monstera') {
    // Big, few, each leaf on its own long petiole reaching out of the pot at its own angle.
    const n = 8
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rand() * 0.5
      const reach = (0.2 + rand() * 0.24) * scale
      const rise = (0.2 + rand() * 0.2) * scale
      const ex = Math.sin(yaw) * reach
      const ez = Math.cos(yaw) * reach
      stemPart(0, base, 0, ex, base + rise, ez, 0.009 * scale)
      const length = (0.26 + rand() * 0.1) * scale
      leafPart(leafGeometry({ kind: 'heart', len: length, wid: length * 0.92, split: true, steps: 44, droop: 0.5, fold: 0.22 }), ex, base + rise, ez, yaw + Math.PI, 1.15 + rand() * 0.35)
    }
  } else if (kind === 'palm') {
    // Three canes of different heights with a crown each: one cane reads as a lamp post with leaves.
    const canes = [1, 0.72, 0.48]
    canes.forEach((k, ci) => {
      const lean = (rand() - 0.5) * 0.12
      const top = base + 0.45 * k * scale
      const tx = lean * 0.7
      stemPart(ci * 0.03 - 0.03, base, ci * 0.02 - 0.02, tx, top, 0, 0.026 * scale * k)
      for (let i = 0; i < 8; i++) {
        const yaw = (i / 8) * Math.PI * 2 + ci * 0.7
        const length = (0.38 + rand() * 0.16) * scale * Math.max(0.7, k)
        leafPart(leafGeometry({ kind: 'blade', len: length, wid: length * 0.24, steps: 16, droop: 0.5, fold: 0.5 }), tx, top, 0, yaw, 0.95 + rand() * 0.6)
      }
    })
  } else if (kind === 'fern') {
    // Fronds: a spine with paired leaflets, the whole frond arching over.
    for (let f = 0; f < 9; f++) {
      const yaw = (f / 9) * Math.PI * 2 + rand() * 0.4
      const length = (0.3 + rand() * 0.12) * scale
      const tilt = 0.75 + rand() * 0.5
      const dir = new Vector3(Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt))
      const segments = 7
      let previous = new Vector3(0, base, 0)
      for (let k = 1; k <= segments; k++) {
        const t = k / segments
        const p = new Vector3(0, base, 0).addScaledVector(dir, length * t)
        p.y -= 0.55 * length * t * t // the arch
        stemPart(previous.x, previous.y, previous.z, p.x, p.y, p.z, 0.004 * scale)
        for (const side of [-1, 1]) {
          const leaflet = length * 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.006
          leafPart(leafGeometry({ kind: 'oval', len: leaflet, wid: leaflet * 0.42, steps: 9, droop: 0.3, fold: 0.3 }), p.x, p.y, p.z, yaw + side * 1.5, 1.5)
        }
        previous = p
      }
    }
  } else if (kind === 'pothos') {
    // The trailing one: a small crown, then vines that spill over the edge of whatever it stands on.
    for (let i = 0; i < 5; i++) {
      const yaw = (i / 5) * Math.PI * 2 + rand()
      const length = (0.07 + rand() * 0.04) * scale
      const x = Math.sin(yaw) * length * 0.5
      const z = Math.cos(yaw) * length * 0.5
      stemPart(0, base, 0, x, base + length * 0.7, z, 0.005 * scale)
      leafPart(leafGeometry({ kind: 'heart', len: length, wid: length * 0.8, steps: 16, droop: 0.4, fold: 0.3 }), x, base + length * 0.7, z, yaw + Math.PI, 1.0 + rand() * 0.4)
    }
    const vines = 3 + Math.floor(rand() * 2)
    for (let v = 0; v < vines; v++) {
      // `fall` aims them: loose vines on a shelf hang straight through the shelf behind them.
      const yaw = fall === null ? rand() * Math.PI * 2 : fall + (rand() - 0.5) * 1.7
      const drop = (0.35 + rand() * 0.25) * scale
      const out = (0.06 + rand() * 0.07) * scale
      let previous = new Vector3(0, base, 0)
      for (let k = 1; k <= 9; k++) {
        const t = k / 9
        // Out fast, then straight down: gravity takes over within a hand's width.
        const p = new Vector3(
          Math.sin(yaw) * out * Math.pow(t, 0.4) + Math.sin(t * 7 + v) * 0.012 * scale,
          base - drop * t * t,
          Math.cos(yaw) * out * Math.pow(t, 0.4) + Math.cos(t * 6 + v) * 0.012 * scale,
        )
        stemPart(previous.x, previous.y, previous.z, p.x, p.y, p.z, 0.0035 * scale)
        const leaf = (0.035 + rand() * 0.022) * scale
        leafPart(leafGeometry({ kind: 'heart', len: leaf, wid: leaf * 0.82, steps: 12, droop: 0.4, fold: 0.28 }), p.x, p.y, p.z, rand() * Math.PI * 2, 1.9 + rand() * 0.8)
        previous = p
      }
    }
  } else if (kind === 'succulent') {
    // Three tiers of fat little paddles, each turned off the one below.
    const tiers = [
      { n: 5, radius: 0.055, tilt: 1.35, length: 0.062 },
      { n: 5, radius: 0.034, tilt: 1.0, length: 0.05 },
      { n: 4, radius: 0.016, tilt: 0.55, length: 0.035 },
    ]
    tiers.forEach((tier, ti) => {
      for (let i = 0; i < tier.n; i++) {
        const yaw = (i / tier.n) * Math.PI * 2 + ti * 0.6
        const length = tier.length * scale
        leafPart(
          leafGeometry({ kind: 'round', len: length, wid: length * 0.66, steps: 11, droop: 0.2, fold: 0.5 }),
          Math.sin(yaw) * tier.radius * scale,
          base + ti * 0.012 * scale,
          Math.cos(yaw) * tier.radius * scale,
          yaw + Math.PI,
          tier.tilt,
        )
      }
    })
  } else {
    // 'herb': the bushy catch-all for a shelf.
    for (let i = 0; i < 26; i++) {
      const yaw = rand() * Math.PI * 2
      const up = (0.04 + rand() * 0.08) * scale
      const out = (0.02 + rand() * 0.06) * scale
      const x = Math.sin(yaw) * out
      const z = Math.cos(yaw) * out
      stemPart(0, base, 0, x, base + up, z, 0.004 * scale)
      const length = (0.03 + rand() * 0.03) * scale
      leafPart(leafGeometry({ kind: 'oval', len: length, wid: length * 0.55, steps: 10, droop: 0.35, fold: 0.3 }), x, base + up, z, yaw + Math.PI, 0.9 + rand() * 0.9)
    }
  }

  const canopy = mergeParts(parts, { colours: true })
  for (const part of parts) part.geometry.dispose()
  return { pot: potGeometry, canopy }
}
```

- [ ] **Step 8: Créer `src/three/plants/plantMaterials.ts`**

Les finitions de Horn.os (`plants.js` pour les pots, `models.js` pour les émaux suspendus), chacune avec une carte de couleur et une carte de rugosité pour l'audit. Les mouchetures `white` et `terracotta` de Horn sont exactement `tints.potDots.cream` et `tints.potDots.terracotta` ; `charcoal` reprend `tints.potDots.slate` ; `sage` n'a pas d'entrée dans `tints.potDots` (dont les clés sont fixées) : ses trois teintes sont calculées depuis `tints.hangingGlazes.sage` (aucun littéral de couleur, règle de la Tâche 15).

```ts
// Ported from Horn.os (owner's project): js/lib/plants.js (canopy and pot finishes), js/scene/models.js (glazes)
import { Color, DoubleSide, MeshStandardMaterial } from 'three'
import { ENV_MAP_INTENSITY } from '../materials'
import { noiseTexture, speckleTexture } from '../noise'
import { tints } from '../tints'
import type { HangingGlaze, PotGlaze } from './types'

/*
 * The few materials every plant shares: one canopy (leaf colours ride on the vertex colours), one per pot glaze and
 * hanging glaze, one for the macrame cords. Each has a colour map and a roughness map, so the material audit
 * counts them as textured. Built on first use (never at import: reading mode loads no 3D), never disposed.
 */

export interface PlantMaterials {
  canopy: MeshStandardMaterial
  pots: Record<Exclude<PotGlaze, 'none'>, MeshStandardMaterial>
  hangingPots: Record<HangingGlaze, MeshStandardMaterial>
  cord: MeshStandardMaterial
}

/** Horn.os finishes: matt terracotta, satin cream and slate, brushed brass. */
const POT_FINISH: Record<Exclude<PotGlaze, 'none'>, { roughness: number; metalness: number; envMapIntensity: number; seed: number }> = {
  terracotta: { roughness: 0.82, metalness: 0, envMapIntensity: 0.7, seed: 5 },
  cream: { roughness: 0.55, metalness: 0, envMapIntensity: 0.9, seed: 3 },
  slate: { roughness: 0.6, metalness: 0, envMapIntensity: 0.8, seed: 9 },
  brass: { roughness: 0.38, metalness: 0.7, envMapIntensity: 1.4, seed: 11 },
}
const HANGING_FINISH: Record<HangingGlaze, { roughness: number; seed: number }> = {
  white: { roughness: 0.55, seed: 3 },
  terracotta: { roughness: 0.9, seed: 5 },
  sage: { roughness: 0.6, seed: 7 },
  charcoal: { roughness: 0.7, seed: 9 },
}

/** Speckle colours of a glaze with no entry in tints.potDots: two darker shades and one lighter. */
function shades(base: string): string[] {
  const colour = new Color(base)
  const lighter = colour.clone().lerp(new Color(1, 1, 1), 0.3)
  return [colour.clone().multiplyScalar(0.55), lighter, colour.clone().multiplyScalar(0.35)].map((c) => `#${c.getHexString()}`)
}

let shared: PlantMaterials | null = null

export function plantMaterials(): PlantMaterials {
  if (shared) return shared
  const pots = {} as PlantMaterials['pots']
  for (const glaze of Object.keys(POT_FINISH) as (keyof typeof POT_FINISH)[]) {
    const { seed, ...finish } = POT_FINISH[glaze]
    pots[glaze] = new MeshStandardMaterial({
      name: `pot-${glaze}`,
      map: speckleTexture({ base: tints.potGlazes[glaze], dots: tints.potDots[glaze], seed }),
      roughnessMap: noiseTexture(),
      ...finish,
    })
  }
  const hangingDots: Record<HangingGlaze, readonly string[]> = {
    white: tints.potDots.cream,
    terracotta: tints.potDots.terracotta,
    sage: shades(tints.hangingGlazes.sage),
    charcoal: tints.potDots.slate,
  }
  const hangingPots = {} as PlantMaterials['hangingPots']
  for (const glaze of Object.keys(HANGING_FINISH) as HangingGlaze[]) {
    const { roughness, seed } = HANGING_FINISH[glaze]
    hangingPots[glaze] = new MeshStandardMaterial({
      name: `hanging-${glaze}`,
      map: speckleTexture({ base: tints.hangingGlazes[glaze], dots: hangingDots[glaze], seed }),
      roughnessMap: noiseTexture(),
      roughness,
      envMapIntensity: ENV_MAP_INTENSITY.model,
    })
  }
  shared = {
    // Leaves are thin enough to be lit from behind: double-sided, one material for every canopy in the room.
    canopy: new MeshStandardMaterial({
      name: 'canopy',
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.68,
      envMapIntensity: ENV_MAP_INTENSITY.plant,
      map: noiseTexture({ size: 64, min: 0.8, max: 1, seed: 13, repeat: 10, srgb: true }),
      roughnessMap: noiseTexture({ seed: 19, repeat: 10 }),
    }),
    pots,
    hangingPots,
    cord: new MeshStandardMaterial({
      name: 'cord',
      color: tints.cord,
      map: noiseTexture({ srgb: true }),
      roughness: 0.95,
      roughnessMap: noiseTexture(),
    }),
  }
  return shared
}
```

Run: `npx vitest run src/three/plants/plant.test.ts`
Expected: PASS (6 tests), en 2 s environ (200 plantes construites pour les empreintes).

- [ ] **Step 9: Écrire le test qui échoue `src/three/plants/hanging.test.ts`**

```ts
import { Box3 } from 'three'
import { SIZES } from '../../zones/office/footprints'
import { layout } from '../../zones/office/layout'
import { HANGING_POT, VINE_REACH, hangingGeometry, hangingVines } from './hanging'

test('a hanging plant hangs below its hook', () => {
  const [w, h, d] = SIZES.hangingPlant
  for (const placement of layout.objects.hangingPlants) {
    for (const seed of [placement.seed, 1, 2, 4, 5, 8]) {
      const plant = hangingGeometry({ ...placement, seed })
      const box = new Box3()
      for (const geometry of [plant.cords, plant.pot, plant.canopy]) box.union(new Box3().setFromBufferAttribute(geometry.getAttribute('position') as never))
      const label = `${placement.glaze} seed ${seed}`
      // Nothing above the hook (the cords' end caps may tilt half a millimetre past it).
      expect(box.max.y, label).toBeLessThan(0.001)
      expect(box.min.y, label).toBeGreaterThanOrEqual(-h)
      expect(Math.max(-box.min.x, box.max.x), label).toBeLessThanOrEqual(w / 2)
      expect(Math.max(-box.min.z, box.max.z), label).toBeLessThanOrEqual(d / 2)
      const pot = new Box3().setFromBufferAttribute(plant.pot.getAttribute('position') as never)
      expect(pot.max.y, label).toBeCloseTo(-placement.drop, 6)
      expect(pot.max.y - pot.min.y, label).toBeCloseTo(HANGING_POT.h, 6)
    }
  }
  expect(hangingGeometry({ ...layout.objects.hangingPlants[0] })).toBe(hangingGeometry({ ...layout.objects.hangingPlants[0] }))
})

test('vines follow their count and length', () => {
  for (const { vines, length, drop, seed } of [
    { vines: 11, length: 0.9, drop: 0.55, seed: 3 },
    { vines: 9, length: 0.8, drop: 0.5, seed: 7 },
    { vines: 4, length: 0.5, drop: 0.3, seed: 12 },
  ]) {
    const paths = hangingVines({ vines, length, drop, seed })
    expect(paths).toHaveLength(vines)
    for (const { points } of paths) {
      const fall = points[0].y + 0.03 - points[points.length - 1].y
      expect(fall).toBeGreaterThanOrEqual(0.45 * length - 1e-9)
      expect(fall).toBeLessThanOrEqual(0.95 * length + 1e-9)
      // From the soil, over the rim (at most 3 cm above it), then down past the bottom of the pot.
      for (const p of points) {
        expect(p.y).toBeLessThan(-drop + 0.03)
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(VINE_REACH + 1e-9)
      }
      expect(points[points.length - 1].y).toBeLessThan(-drop - HANGING_POT.h)
    }
  }
  const few = hangingGeometry({ seed: 5, glaze: 'white', vines: 4, length: 0.9, drop: 0.55 })
  const many = hangingGeometry({ seed: 5, glaze: 'white', vines: 11, length: 0.9, drop: 0.55 })
  expect(many.canopy.getAttribute('position').count).toBeGreaterThan(2 * few.canopy.getAttribute('position').count)
})
```

Run: `npx vitest run src/three/plants/hanging.test.ts`
Expected: FAIL — `Failed to resolve import "./hanging" from "src/three/plants/hanging.test.ts"`.

- [ ] **Step 10: Créer `src/three/plants/hanging.ts`**

`hangingPlant()` de Horn.os, géométrie seule, en trois morceaux fusionnés. Écarts : les feuilles sont fusionnées dans le feuillage commun (couleurs de `tints.leafGreens` par sommet) au lieu d'un `InstancedMesh` à texture de feuille ; les vrilles ont leur propre flux LCG (`hangingVines`, testable) et sont resserrées pour tenir dans l'empreinte de 0,5 m (départ 0,05 au lieu de 0,07, pas 0,02 + 0,004 au lieu de 0,04 + 0,01, écart ±0,015 au lieu de ±0,02, longueur 0,45 à 0,95 au lieu de 0,45 à 1,05, points de contrôle ramenés à `VINE_REACH` de l'axe).

```ts
// Ported from Horn.os (owner's project): js/scene/hanging.js (planter profile from js/scene/models.js)
import {
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  LatheGeometry,
  Matrix4,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import { at, mergeParts, type Part } from '../merge'
import { between } from '../shapes'
import { tints } from '../tints'
import type { HangingPlacement } from './types'

/*
 * A golden pothos in a macrame hanger: a glazed pot, a crown of leaves, and vines falling from the rim with a
 * heart-shaped leaf every few centimetres, smaller toward the tip. Geometry only, in three merged pieces (cords,
 * pot, canopy), origin at the ceiling hook, everything below it. Horn.os' vines are narrowed here to fit the
 * 0.5 m footprint of a hanging plant (zones/office/footprints.ts): they fall straight down from the rim.
 */

export interface HangingGeometry {
  /** Four cords from under the pot to the hook, their knots and the tassel. */
  cords: BufferGeometry
  /** The turned planter (lathe profile with a rolled rim), UVs around it. */
  pot: BufferGeometry
  /** Vines, crown leaves and the soil disc, with a 'color' attribute and UVs. */
  canopy: BufferGeometry
}
export type HangingOptions = Omit<HangingPlacement, 'position'>
export interface Vine {
  /** Control points of the vine, from the soil down. */
  points: Vector3[]
  /** Horizontal direction the vine leaves the pot in. */
  out: Vector3
}

/** Pot of every hanging planter, in metres (Horn.os defaults). */
export const HANGING_POT = { r: 0.09, h: 0.11 } as const
/** Vine control points stay within this distance of the hook axis; the leaves add about 3 cm. */
export const VINE_REACH = 0.19

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Height of the pot's bottom and of its soil, below the hook. */
function potLevels(drop: number): { potY: number; soilY: number } {
  const potY = -drop - HANGING_POT.h
  return { potY, soilY: potY + HANGING_POT.h * 0.88 }
}

/**
 * The vines of a hanging plant: `vines` of them, spread round the rim, each falling `length` x 0.45 to 0.95 below
 * the soil. Their own LCG stream: the same options give the same vines.
 */
export function hangingVines(options: Pick<HangingOptions, 'seed' | 'vines' | 'length' | 'drop'>): Vine[] {
  const { seed, vines, length, drop } = options
  const rand = seeded(seed)
  const { soilY } = potLevels(drop)
  const result: Vine[] = []
  for (let v = 0; v < vines; v++) {
    const a = (v / vines) * Math.PI * 2 + rand() * 0.5
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const fall = length * (0.45 + rand() * 0.5)
    const start = new Vector3(out.x * HANGING_POT.r * 0.8, soilY + 0.01, out.z * HANGING_POT.r * 0.8)
    const points = [start, start.clone().addScaledVector(out, 0.05).add(new Vector3(0, 0.03, 0))]
    let p = points[1].clone()
    const steps = 6
    for (let k = 1; k <= steps; k++) {
      p = p.clone().addScaledVector(out, 0.02 * (1 - k / steps) + 0.004).add(new Vector3((rand() - 0.5) * 0.03, -fall / steps, (rand() - 0.5) * 0.03))
      const radial = Math.hypot(p.x, p.z)
      if (radial > VINE_REACH) p.set((p.x * VINE_REACH) / radial, p.y, (p.z * VINE_REACH) / radial)
      points.push(p)
    }
    result.push({ points, out })
  }
  return result
}

/** One leaf: a cupped heart, tip up (+y, 1 unit long before scaling), attached at the notch (origin). */
let leafShape: BufferGeometry | null = null
function hangingLeaf(): BufferGeometry {
  if (leafShape) return leafShape
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.22, -0.1, 0.6, 0.18, 0.42, 0.58)
  shape.bezierCurveTo(0.32, 0.8, 0.1, 0.92, 0, 1.0)
  shape.bezierCurveTo(-0.1, 0.92, -0.32, 0.8, -0.42, 0.58)
  shape.bezierCurveTo(-0.6, 0.18, -0.22, -0.1, 0, 0)
  const geometry = new ShapeGeometry(shape, 10)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    uv.setXY(i, x + 0.5, y)
    // Cupped across the width, the tip curling back a little.
    position.setZ(i, -0.35 * x * x + 0.18 * y * y)
  }
  geometry.computeVertexNormals()
  leafShape = geometry
  return geometry
}

/** Horn.os planter: a lathe profile with a rolled rim, standing on y = 0. */
function planterGeometry(r: number, h: number): BufferGeometry {
  const profile = [
    new Vector2(0, 0),
    new Vector2(r * 0.7, 0),
    new Vector2(r * 0.76, h * 0.03),
    new Vector2(r * 0.92, h * 0.45),
    new Vector2(r, h * 0.92),
    new Vector2(r * 1.04, h * 0.97),
    new Vector2(r * 1.02, h),
    new Vector2(r * 0.93, h),
    new Vector2(r * 0.9, h * 0.9),
  ]
  return new LatheGeometry(profile, 48)
}

const cache = new Map<string, HangingGeometry>()

/** A hanging plant below its hook (origin). The same options give the same plant; cached by its options. */
export function hangingGeometry(options: HangingOptions): HangingGeometry {
  const { seed, glaze, vines, length, drop } = options
  const key = JSON.stringify([seed, glaze, vines, length, drop])
  const cached = cache.get(key)
  if (cached) return cached
  const built = buildHanging({ seed, glaze, vines, length, drop })
  cache.set(key, built)
  return built
}

function buildHanging(options: HangingOptions): HangingGeometry {
  const { seed, drop } = options
  const { r: potR, h: potH } = HANGING_POT
  const { potY, soilY } = potLevels(drop)
  // Vines have their own stream (hangingVines); leaves, crown and tassel use this one.
  const rand = seeded(seed * 31 + 17)
  const greens = tints.leafGreens.map((colour) => new Color(colour))
  const stem = new Color(tints.stem)
  const pick = () => greens[Math.floor(rand() * greens.length)]

  const pot = planterGeometry(potR, potH).translate(0, potY, 0)

  // Macrame: four cords from under the pot up to the hook, knotted at the rim, and a tassel under the pot.
  const cordParts: Part[] = []
  const apex = new Vector3(0, 0, 0)
  const under = new Vector3(0, potY - 0.05, 0)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const rim = new Vector3(Math.cos(a) * potR * 1.06, potY + potH * 1.02, Math.sin(a) * potR * 1.06)
    const belly = new Vector3(Math.cos(a) * potR * 0.95, potY + potH * 0.35, Math.sin(a) * potR * 0.95)
    cordParts.push(between(under, belly, 0.0025, 0.0025, 5), between(belly, rim, 0.0025, 0.0025, 5), between(rim, apex, 0.0025, 0.0025, 5))
    cordParts.push({ geometry: new SphereGeometry(0.007, 8, 6), matrix: at(rim.x, rim.y + 0.03, rim.z) })
  }
  cordParts.push({ geometry: new SphereGeometry(0.012, 10, 8), matrix: at(0, -0.02, 0) })
  cordParts.push({ geometry: new SphereGeometry(0.014, 10, 8), matrix: at(under.x, under.y, under.z) })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    cordParts.push(between(under, new Vector3(Math.cos(a) * 0.012, under.y - 0.09 - rand() * 0.03, Math.sin(a) * 0.012), 0.002, 0.0015, 4))
  }
  const cords = mergeParts(cordParts)
  for (const part of cordParts) part.geometry.dispose()

  // Soil, vines and leaves, all baked into the canopy.
  const parts: Part[] = [{ geometry: new CircleGeometry(potR * 0.9, 40).rotateX(-Math.PI / 2), matrix: at(0, soilY, 0), colour: new Color(tints.soil) }]
  const leaf = hangingLeaf()
  const down = new Vector3(0, -1, 0)
  const place = (p: Vector3, tipDir: Vector3, faceDir: Vector3, size: number, twist: number) => {
    const yAxis = tipDir.clone().normalize()
    let zAxis = faceDir.clone().sub(yAxis.clone().multiplyScalar(faceDir.dot(yAxis))).normalize()
    const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize()
    zAxis = new Vector3().crossVectors(xAxis, yAxis)
    const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis)
    matrix.multiply(new Matrix4().makeRotationY(twist))
    matrix.scale(new Vector3(size, size, size))
    matrix.setPosition(p)
    parts.push({ geometry: leaf, matrix, colour: pick() })
  }
  for (const { points, out } of hangingVines(options)) {
    const curve = new CatmullRomCurve3(points)
    parts.push({ geometry: new TubeGeometry(curve, 40, 0.0022, 5, false), colour: stem })
    const n = Math.floor(curve.getLength() / 0.042)
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.5)
      const position = curve.getPointAt(t)
      const tangent = curve.getTangentAt(t)
      const side = i % 2 ? 1 : -1
      const sideways = new Vector3().crossVectors(tangent, out).normalize().multiplyScalar(side)
      // Leaves hang tip-down, turned outward, alternating left and right.
      const tip = down.clone().multiplyScalar(0.7).add(sideways.clone().multiplyScalar(0.6)).add(out.clone().multiplyScalar(0.25))
      const face = out.clone().add(new Vector3(0, 0.35, 0)).add(sideways.clone().multiplyScalar(0.3))
      place(position, tip, face, 0.06 - t * 0.028 + (rand() - 0.5) * 0.008, (rand() - 0.5) * 0.5)
    }
  }
  // The crown: bigger leaves standing up out of the pot.
  for (let i = 0; i < 12; i++) {
    const a = rand() * Math.PI * 2
    const out = new Vector3(Math.cos(a), 0, Math.sin(a))
    const base = new Vector3(out.x * potR * 0.4 * rand(), soilY + 0.005, out.z * potR * 0.4 * rand())
    const top = base.clone().addScaledVector(out, 0.03 + rand() * 0.05).add(new Vector3(0, 0.05 + rand() * 0.06, 0))
    parts.push({ ...between(base, top, 0.0025, 0.002, 5), colour: stem })
    const tip = out.clone().multiplyScalar(0.6).add(new Vector3(0, 0.5 + rand() * 0.4, 0))
    place(top, tip, out.clone().add(new Vector3(0, 0.6, 0)), 0.065 + rand() * 0.02, (rand() - 0.5) * 0.6)
  }
  const canopy = mergeParts(parts, { colours: true })
  for (const part of parts) if (part.geometry !== leaf) part.geometry.dispose()
  return { cords, pot, canopy }
}
```

Run: `npx vitest run src/three/plants`
Expected: PASS (10 tests : sway 2, plant 6, hanging 2). Une plante suspendue compte de 9 000 à 12 000 triangles, en un seul maillage de feuillage.

- [ ] **Step 11: Écrire le test qui échoue `src/three/books.test.ts`**

Le test lit le disque (vérification qu'aucun texte n'est dessiné) : il tourne en environnement `node`. L'atlas lui-même (`bookAtlasTexture`, canvas) n'est pas testé en unitaire (jsdom n'a pas `getContext`) : la Tâche 14 le juge sur captures.

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Box3, Color } from 'three'
import { SHELVES, layout } from '../zones/office/layout'
import { ATLAS, ATLAS_SEED, BOOK_SHELF_DEPTH, INK_CONTRAST, SPINE_CELLS, shelfBooksGeometry, spineDesign } from './shelfBooks'
import { tints } from './tints'

const luminance = (colour: string) => {
  const c = new Color(colour)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

test('books fill the shelf span without overflowing', () => {
  expect(BOOK_SHELF_DEPTH).toBe(SHELVES.depth)
  // Room above each board: up to the next board, or 0.5 m on the top one.
  const boardTops = SHELVES.boards.map((y) => y + SHELVES.thickness)
  for (const spec of layout.objects.shelfBooks) {
    const box = new Box3().setFromBufferAttribute(shelfBooksGeometry(spec).getAttribute('position') as never)
    const label = JSON.stringify(spec)
    // 1 mm tolerance: a hardback's spine is 0.8 mm wider than its boards.
    expect(box.min.x, label).toBeGreaterThanOrEqual(spec.x0 - 0.001)
    expect(box.max.x, label).toBeLessThanOrEqual(spec.x1 + 0.001)
    expect(box.max.x - box.min.x, label).toBeGreaterThan(0.8 * (spec.x1 - spec.x0))
    expect(box.min.y, label).toBeGreaterThanOrEqual(spec.y - 0.001)
    const above = boardTops.find((top) => top > spec.y + 0.01)
    const ceiling = above === undefined ? spec.y + 0.5 : above - SHELVES.thickness
    expect(box.max.y, label).toBeLessThan(ceiling)
    expect(box.min.z, label).toBeGreaterThanOrEqual(spec.z - SHELVES.depth / 2)
    expect(box.max.z, label).toBeLessThanOrEqual(spec.z + SHELVES.depth / 2)
  }
})

test('every book maps into an atlas cell', () => {
  for (const spec of layout.objects.shelfBooks) {
    const uv = shelfBooksGeometry(spec).getAttribute('uv')
    // Non-indexed: each run of three vertices is one triangle, and a triangle never straddles two cells.
    for (let i = 0; i < uv.count; i += 3) {
      const us = [uv.getX(i), uv.getX(i + 1), uv.getX(i + 2)]
      const vs = [uv.getY(i), uv.getY(i + 1), uv.getY(i + 2)]
      for (const n of [...us, ...vs]) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(1)
      }
      const column = (u: number) => u * ATLAS.cols
      const row = (v: number) => v * ATLAS.rows
      expect(Math.floor(column(Math.min(...us)) + 1e-6)).toBe(Math.floor(column(Math.max(...us)) - 1e-6))
      expect(Math.floor(row(Math.min(...vs)) + 1e-6)).toBe(Math.floor(row(Math.max(...vs)) - 1e-6))
    }
  }
})

test('spine designs use the palette and carry no text', () => {
  const kinds = new Set<string>()
  for (let i = 0; i < SPINE_CELLS; i++) {
    const design = spineDesign(i, ATLAS_SEED)
    expect(spineDesign(i, ATLAS_SEED)).toEqual(design)
    expect(Object.keys(design).sort()).toEqual(['bands', 'cover', 'ink', 'kind'])
    expect(Number.isInteger(design.cover) && design.cover >= 0 && design.cover < tints.bookCovers.length).toBe(true)
    expect(Number.isInteger(design.ink) && design.ink >= 0 && design.ink < tints.bookInks.length).toBe(true)
    expect(Math.abs(luminance(tints.bookInks[design.ink]) - luminance(tints.bookCovers[design.cover]))).toBeGreaterThanOrEqual(INK_CONTRAST)
    for (const band of design.bands) {
      expect(band.y).toBeGreaterThanOrEqual(0)
      expect(band.h).toBeGreaterThan(0)
      expect(band.y + band.h).toBeLessThanOrEqual(1)
    }
    kinds.add(design.kind)
  }
  expect([...kinds].sort()).toEqual(['art', 'hardback', 'paperback'])
  // The atlas painter never draws letters (spec: no procedural texture carries text).
  const source = readFileSync(fileURLToPath(new URL('./shelfBooks.ts', import.meta.url)), 'utf8')
  expect(source).not.toMatch(/fillText|strokeText|measureText|\.font\s*=/)
})
```

Run: `npx vitest run src/three/books.test.ts`
Expected: FAIL — `Failed to resolve import "./shelfBooks" from "src/three/books.test.ts"`.

- [ ] **Step 12: Créer `src/three/shelfBooks.ts`**

`books.js` de Horn.os : même atlas (16 × 8 cases de 128 × 256 px, les trois dernières pour les tranches de pages), mêmes livres (broché d'une pièce, relié avec plats qui débordent du bloc de pages), mêmes rangées, piles et livre penché. Différences : le dos est décrit par `spineDesign` (pur, testé) et peint sans texte ; le genre du dessin (broché, relié, art) suit le genre du livre ; le plan d'une étagère se déduit de sa largeur (rangée, pile de livres d'art, rangée de brochés et un livre penché sur l'étagère large ; une rangée et un livre penché sur l'étroite) ; le livre penché repose sur son arête inférieure gauche (chez Horn il s'enfonce d'1 cm dans la planche) ; une pile qui ne tient pas est sautée ; les livres sont en coordonnées de la pièce.

```ts
// Ported from Horn.os (owner's project): js/scene/books.js
import { BoxGeometry, CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace, type BufferGeometry } from 'three'
import { mergeParts, type Part } from './merge'
import { noiseTexture } from './noise'
import type { ShelfBooksSpec } from './plants/types'
import { tints } from './tints'

/*
 * Shelf books: cloth hardbacks whose boards overhang the page block, glossy paperbacks and tall art books, standing,
 * leaning and stacked. Every spine is painted into one atlas and each shelf row is baked into one geometry, so a
 * shelf is one draw call. Unlike Horn.os, the spines are abstract (colour, bands, a title bar, a mark): no text.
 */

/** 2048 x 2048 atlas: 16 x 8 cells of 128 x 256 px. The last three cells are page edges, the others spines. */
export const ATLAS = { cols: 16, rows: 8, cellWidth: 128, cellHeight: 256 } as const
const CELLS = ATLAS.cols * ATLAS.rows
const PAGE_CELLS = [CELLS - 1, CELLS - 2, CELLS - 3]
/** Number of spine cells (cells 0 to SPINE_CELLS - 1). */
export const SPINE_CELLS = CELLS - PAGE_CELLS.length
/** Seed of the atlas: the spine of cell i is spineDesign(i, ATLAS_SEED). */
export const ATLAS_SEED = 42
/** Shelf depth the books must fit in (SHELVES.depth in zones/office/layout.ts; books.test.ts checks it). */
export const BOOK_SHELF_DEPTH = 0.24
/** Spines stand this far behind the front edge of the shelf; the deepest book (0.2 m) then clears the wall. */
const FRONT_INSET = 0.03
/** Smallest luminance difference (linear) between a cover and its ink: the bands and marks must read. */
export const INK_CONTRAST = 0.25

export type BookKind = 'paperback' | 'hardback' | 'art'
/**
 * One spine: `cover` and `ink` index tints.bookCovers and tints.bookInks; `bands` are horizontal rules across the
 * spine, `y` and `h` as fractions of the spine height from its head. Abstract on purpose: a design never holds text.
 */
export interface SpineDesign {
  cover: number
  ink: number
  bands: { y: number; h: number }[]
  kind: BookKind
}

/** Horn.os' LCG: numbers in [0, 1), the same sequence for the same seed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const luminance = (colour: string) => {
  const c = new Color(colour)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

/** The design of spine cell `index`, the same on every run for the same seed. */
export function spineDesign(index: number, seed: number): SpineDesign {
  const rand = seeded(seed * 1000003 + index * 7919)
  rand()
  const roll = rand()
  const kind: BookKind = roll < 0.45 ? 'paperback' : roll < 0.85 ? 'hardback' : 'art'
  const cover = Math.floor(rand() * tints.bookCovers.length)
  const coverLum = luminance(tints.bookCovers[cover])
  const readable = tints.bookInks.map((ink, i) => ({ i, d: Math.abs(luminance(ink) - coverLum) })).filter(({ d }) => d >= INK_CONTRAST)
  const ink = readable[Math.floor(rand() * readable.length)].i
  let bands: { y: number; h: number }[]
  if (kind === 'hardback') {
    // Gilt rules at head and tail.
    bands = [
      { y: 0.047, h: 0.01 },
      { y: 0.07, h: 0.004 },
      { y: 0.926, h: 0.004 },
      { y: 0.945, h: 0.01 },
    ]
  } else if (kind === 'art') {
    // Raised bands, as on a leather binding.
    bands = [0.086, 0.234, 0.766, 0.914].map((y) => ({ y: y - 0.012, h: 0.024 }))
  } else {
    // A paperback: a broad colour block across the spine, or nothing.
    bands = rand() < 0.35 ? [{ y: 0.66, h: 0.2 }] : []
  }
  return { cover, ink, bands, kind }
}

/** Spine cells of each kind, from the atlas designs. */
let cellsByKind: Record<BookKind, number[]> | null = null
function spineCells(kind: BookKind): number[] {
  if (!cellsByKind) {
    cellsByKind = { paperback: [], hardback: [], art: [] }
    for (let i = 0; i < SPINE_CELLS; i++) cellsByKind[spineDesign(i, ATLAS_SEED).kind].push(i)
  }
  return cellsByKind[kind]
}

/* ------------------------------------------------------------------ *
 *  Atlas (DOM: canvas)
 * ------------------------------------------------------------------ */

function paintSpine(g: CanvasRenderingContext2D, x0: number, y0: number, design: SpineDesign, rand: () => number) {
  const W = ATLAS.cellWidth
  const H = ATLAS.cellHeight
  const cover = tints.bookCovers[design.cover]
  const ink = tints.bookInks[design.ink]
  g.fillStyle = cover
  g.fillRect(x0, y0, W, H)
  if (design.kind === 'hardback') {
    // Cloth: a fine weave.
    for (let y = 0; y < H; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.04})`
      g.fillRect(x0, y0 + y, W, 1)
    }
    for (let x = 0; x < W; x += 2) {
      g.fillStyle = `rgba(255,255,255,${0.025 + rand() * 0.03})`
      g.fillRect(x0 + x, y0, 1, H)
    }
  } else if (design.kind === 'art') {
    // Leather: a mottled grain, and a darker label panel between the raised bands.
    for (let k = 0; k < 260; k++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)'
      g.beginPath()
      g.ellipse(x0 + rand() * W, y0 + rand() * H, 1 + rand() * 4, 1 + rand() * 3, rand() * 3, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = 'rgba(0,0,0,0.45)'
    g.fillRect(x0 + 10, y0 + 74, W - 20, H - 150)
    g.strokeStyle = ink
    g.lineWidth = 1.5
    g.strokeRect(x0 + 14, y0 + 78, W - 28, H - 158)
  } else {
    // Paper: a glossy sheen across the spine.
    const sheen = g.createLinearGradient(x0, 0, x0 + W, 0)
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.12)')
    sheen.addColorStop(0.6, 'rgba(255,255,255,0)')
    g.fillStyle = sheen
    g.fillRect(x0, y0, W, H)
  }
  g.fillStyle = ink
  for (const band of design.bands) {
    if (design.kind === 'art') {
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(x0, y0 + band.y * H, W, band.h * H)
      g.fillStyle = ink
      g.fillRect(x0 + 6, y0 + band.y * H, W - 12, 1.5)
      g.fillRect(x0 + 6, y0 + (band.y + band.h) * H - 1.5, W - 12, 1.5)
    } else {
      g.globalAlpha = design.kind === 'paperback' ? 0.9 : 1
      g.fillRect(x0 + (design.kind === 'paperback' ? 0 : 6), y0 + band.y * H, W - (design.kind === 'paperback' ? 0 : 12), band.h * H)
      g.globalAlpha = 1
    }
  }
  // Where a title would be: an abstract bar up the spine, and a short one at the foot. Never letters.
  g.fillStyle = ink
  const bar = design.kind === 'art' ? 0.34 : 0.4 + ((design.cover + design.ink) % 3) * 0.06
  g.globalAlpha = 0.85
  g.fillRect(x0 + W * 0.42, y0 + H * (0.46 - bar / 2), W * 0.16, H * bar)
  g.fillRect(x0 + W * 0.44, y0 + H * 0.8, W * 0.12, H * 0.07)
  g.globalAlpha = 1
  if (design.kind === 'paperback') {
    // A publisher's mark: a plain disc.
    g.beginPath()
    g.arc(x0 + W / 2, y0 + H - 18, 8, 0, Math.PI * 2)
    g.fill()
  }
  // A rounded spine: shaded toward both edges, a little wear at head and tail.
  const round = g.createLinearGradient(x0, 0, x0 + W, 0)
  round.addColorStop(0, 'rgba(0,0,0,0.38)')
  round.addColorStop(0.18, 'rgba(0,0,0,0.05)')
  round.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  round.addColorStop(0.82, 'rgba(0,0,0,0.05)')
  round.addColorStop(1, 'rgba(0,0,0,0.38)')
  g.fillStyle = round
  g.fillRect(x0, y0, W, H)
  for (let k = 0; k < 40; k++) {
    const y = rand() < 0.5 ? 8 + rand() * 10 : H - 8 - rand() * 10
    g.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.1})`
    g.fillRect(x0 + rand() * W, y0 + y, 1 + rand() * 4, 1)
  }
  // A plain swatch of the cover colour in the cell's bottom 6 px: covers and boards sample it, the spine face never does.
  g.fillStyle = cover
  g.fillRect(x0, y0 + H - 6, W, 6)
}

function paintPages(g: CanvasRenderingContext2D, x0: number, y0: number, tone: string, rand: () => number) {
  g.fillStyle = tone
  g.fillRect(x0, y0, ATLAS.cellWidth, ATLAS.cellHeight)
  for (let y = 0; y < ATLAS.cellHeight; y += 1.5) {
    g.fillStyle = `rgba(90,70,40,${0.04 + rand() * 0.08})`
    g.fillRect(x0, y0 + y, ATLAS.cellWidth, 0.7)
  }
  const edge = g.createLinearGradient(0, y0, 0, y0 + ATLAS.cellHeight)
  edge.addColorStop(0, 'rgba(120,95,60,0.18)')
  edge.addColorStop(0.1, 'rgba(0,0,0,0)')
  edge.addColorStop(0.9, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(120,95,60,0.18)')
  g.fillStyle = edge
  g.fillRect(x0, y0, ATLAS.cellWidth, ATLAS.cellHeight)
}

let atlas: CanvasTexture | null = null

/** Every spine and page edge in one sRGB texture (2048 x 2048). Painted once, on first use (needs the DOM). */
export function bookAtlasTexture(): CanvasTexture {
  if (atlas) return atlas
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS.cols * ATLAS.cellWidth
  canvas.height = ATLAS.rows * ATLAS.cellHeight
  const g = canvas.getContext('2d')!
  const rand = seeded(ATLAS_SEED)
  for (let i = 0; i < CELLS; i++) {
    const x0 = (i % ATLAS.cols) * ATLAS.cellWidth
    const y0 = Math.floor(i / ATLAS.cols) * ATLAS.cellHeight
    const page = PAGE_CELLS.indexOf(i)
    if (page >= 0) paintPages(g, x0, y0, tints.bookPages[page], rand)
    else paintSpine(g, x0, y0, spineDesign(i, ATLAS_SEED), rand)
  }
  atlas = new CanvasTexture(canvas)
  atlas.colorSpace = SRGBColorSpace
  atlas.anisotropy = 8
  return atlas
}

let material: MeshStandardMaterial | null = null

/** The one material of every shelf of books: the atlas, with a little roughness variation. */
export function booksMaterial(): MeshStandardMaterial {
  material ??= new MeshStandardMaterial({ name: 'books', map: bookAtlasTexture(), roughness: 0.7, roughnessMap: noiseTexture({ seed: 29 }) })
  return material
}

/* ------------------------------------------------------------------ *
 *  Geometry
 * ------------------------------------------------------------------ */

interface Rect {
  u: number
  v: number
  w: number
  h: number
}
interface FaceRect extends Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

/** Atlas rectangle of a cell, in UV space (v up). */
function cellRect(cell: number): Rect {
  return { u: (cell % ATLAS.cols) / ATLAS.cols, v: 1 - (Math.floor(cell / ATLAS.cols) + 1) / ATLAS.rows, w: 1 / ATLAS.cols, h: 1 / ATLAS.rows }
}

/** Remaps the UVs of a BoxGeometry face by face (faces: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z = spine, 5 -z). */
function mapFaces(geometry: BoxGeometry, faceRect: (face: number) => FaceRect): BoxGeometry {
  const uv = geometry.getAttribute('uv')
  for (let face = 0; face < 6; face++) {
    const r = faceRect(face)
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k
      uv.setXY(i, r.u + r.w * (r.x0 + uv.getX(i) * (r.x1 - r.x0)), r.v + r.h * (r.y0 + uv.getY(i) * (r.y1 - r.y0)))
    }
  }
  return geometry
}

function paperback(w: number, h: number, d: number, spine: number, pages: number): BoxGeometry[] {
  const s = cellRect(spine)
  const p = cellRect(pages)
  return [
    mapFaces(new BoxGeometry(w, h, d), (f) =>
      f === 4
        ? { ...s, x0: 0.02, x1: 0.98, y0: 0.035, y1: 0.99 }
        : f === 0 || f === 1
          ? { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 }
          : { ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 },
    ),
  ]
}

/** A hardback: a page block inset from the boards, two boards and a spine. */
function hardback(w: number, h: number, d: number, spine: number, pages: number): BoxGeometry[] {
  const s = cellRect(spine)
  const p = cellRect(pages)
  const board = Math.min(0.0028, w * 0.12)
  const over = 0.003 // the boards overhang the pages at head, tail and fore-edge
  const cover = { ...s, x0: 0.3, x1: 0.7, y0: 0.004, y1: 0.018 }
  const block = mapFaces(new BoxGeometry(w - 2 * board, h - 2 * over, d - over - board), () => ({ ...p, x0: 0.05, x1: 0.95, y0: 0.05, y1: 0.95 }))
  block.translate(0, 0, (over - board) / 2)
  const parts = [block]
  for (const side of [-1, 1]) {
    const b = mapFaces(new BoxGeometry(board, h, d - board * 0.6), () => cover)
    b.translate(side * (w / 2 - board / 2), 0, -board * 0.3)
    parts.push(b)
  }
  const back = mapFaces(new BoxGeometry(w + 0.0008, h, board), (f) => (f === 4 ? { ...s, x0: 0, x1: 1, y0: 0.035, y1: 1 } : cover))
  back.translate(0, 0, d / 2 - board / 2)
  parts.push(back)
  return parts
}

interface Book {
  w: number
  h: number
  d: number
  kind: BookKind
}
type Run =
  | { kind: 'gap'; width: number }
  | { kind: 'stack'; type: BookKind; count: number }
  | { kind: 'row'; type?: BookKind; width?: number; lean?: boolean }

/** How a shelf is filled: a wide shelf gets a row, a stack of art books and a row of paperbacks with a leaning book. */
function shelfPlan(span: number): Run[] {
  if (span >= 0.9) {
    return [
      { kind: 'row', width: span * 0.36 },
      { kind: 'gap', width: 0.05 },
      { kind: 'stack', type: 'art', count: 3 },
      { kind: 'gap', width: 0.05 },
      { kind: 'row', type: 'paperback', lean: true },
    ]
  }
  return [
    { kind: 'gap', width: 0.03 },
    { kind: 'row', lean: true },
  ]
}

/** Room left at the end of a row for its leaning book. */
const LEAN_ROOM = 0.14
const LEAN_ANGLE = 0.32

/**
 * One shelf of books between spec.x0 and spec.x1, standing on y = spec.y, in room coordinates: spines face +z,
 * FRONT_INSET behind the front edge of a shelf BOOK_SHELF_DEPTH deep centred on spec.z. UVs point into the atlas.
 */
export function shelfBooksGeometry(spec: ShelfBooksSpec): BufferGeometry {
  const rand = seeded(spec.seed)
  const front = spec.z + BOOK_SHELF_DEPTH / 2 - FRONT_INSET
  const parts: Part[] = []
  const sizes: Record<BookKind, () => Book> = {
    paperback: () => ({ w: 0.016 + rand() * 0.014, h: 0.18 + rand() * 0.025, d: 0.12 + rand() * 0.015, kind: 'paperback' }),
    hardback: () => ({ w: 0.026 + rand() * 0.022, h: 0.225 + rand() * 0.04, d: 0.15 + rand() * 0.03, kind: 'hardback' }),
    art: () => ({ w: 0.018 + rand() * 0.02, h: 0.29 + rand() * 0.04, d: 0.18 + rand() * 0.02, kind: 'art' }),
  }
  const pick = (cells: readonly number[]) => cells[Math.floor(rand() * cells.length)]
  const build = (b: Book) => (b.kind === 'paperback' ? paperback : hardback)(b.w, b.h, b.d, pick(spineCells(b.kind)), pick(PAGE_CELLS))
  const place = (geometries: BoxGeometry[], move: (g: BoxGeometry) => void) => {
    for (const geometry of geometries) {
      move(geometry)
      parts.push({ geometry })
    }
  }
  let x = spec.x0
  for (const run of shelfPlan(spec.x1 - spec.x0)) {
    if (run.kind === 'gap') {
      x += run.width
      continue
    }
    if (run.kind === 'stack') {
      // Books lying flat, largest at the bottom, spines to the room; skipped when it does not fit.
      // Each book is pushed back by up to 8 mm and slid right by up to 1.2 cm: never past the front or the stack's end.
      const books = Array.from({ length: run.count }, (_, i) => {
        const b = sizes[run.type]()
        b.h *= 1 - i * 0.05
        b.d *= 1 - i * 0.04
        return { b, dx: rand() * 0.012, dz: rand() * 0.008 }
      })
      const length = Math.max(...books.map(({ b }) => b.h)) + 0.012
      if (x + length > spec.x1) continue
      let y = spec.y
      for (const { b, dx, dz } of books) {
        const bottom = y
        place(build(b), (g) => g.rotateZ(-Math.PI / 2).translate(x + dx + b.h / 2, bottom + b.w / 2, front - dz - b.d / 2))
        y += b.w
      }
      x += length + 0.012
      continue
    }
    // A standing row, spines not quite in line.
    const end = Math.min(spec.x1 - (run.lean ? LEAN_ROOM : 0), x + (run.width ?? spec.x1 - x))
    while (x < end - 0.02) {
      const b = sizes[run.type ?? (rand() < 0.55 ? 'hardback' : 'paperback')]()
      if (x + b.w > end) break
      const back = rand() * 0.008
      const at = x
      place(build(b), (g) => g.translate(at + b.w / 2, spec.y + b.h / 2, front - b.d / 2 - back))
      x += b.w + 0.0012
    }
    if (run.lean) {
      // The last book of the run tipped against its neighbours, if it fits: it rests on its bottom-left edge.
      const b = sizes.hardback()
      const pivot = x + Math.sin(LEAN_ANGLE) * b.h
      if (pivot + b.w * Math.cos(LEAN_ANGLE) > spec.x1) continue
      place(build(b), (g) => g.translate(b.w / 2, b.h / 2, 0).rotateZ(LEAN_ANGLE).translate(pivot, spec.y, front - b.d / 2))
      x = pivot + b.w + 0.01
    }
  }
  const geometry = mergeParts(parts)
  for (const part of parts) part.geometry.dispose()
  return geometry
}
```

Run: `npx vitest run src/three/books.test.ts`
Expected: PASS (3 tests). Mesures de la copie de travail : étagère basse x 3,2996…4,5507, y ≥ 1,3246, z −5,9786…−5,7800 (2 016 sommets) ; étagère haute x 3,7796…4,2487 (1 440 sommets) ; dessins : 55 brochés, 51 reliés, 19 livres d'art.

- [ ] **Step 13: Créer les composants `Plant.tsx`, `HangingPlant.tsx` et `Books.tsx`**

Aucun test unitaire (rendu R3F) : ils sont montés et capturés à la Tâche 14. Les géométries des plantes viennent des caches (jamais libérées) ; celle d'une rangée de livres est libérée au démontage ; les matériaux sont des singletons. Les plantes portent et reçoivent les ombres, comme chez Horn.os.

`src/three/plants/Plant.tsx` :

```tsx
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { plantGeometry } from './plantGeometry'
import { plantMaterials } from './plantMaterials'
import { useSway } from './sway'
import type { PlantPlacement } from './types'

/**
 * A generated plant: its pot and its canopy, two meshes. The canopy sways about the pot's base when `animate`
 * (quality tier and reduced motion) and the placement asks for it (`sway` > 0); the sway's phase is the seed.
 */
export function Plant({ placement, animate, name }: { placement: PlantPlacement; animate: boolean; name?: string }) {
  const { kind, position, pot, r, h, scale, seed, sway, fall } = placement
  const geometry = useMemo(() => plantGeometry(kind, { r, h, pot, scale, seed, fall }), [kind, r, h, pot, scale, seed, fall])
  const materials = plantMaterials()
  const canopy = useRef<Group>(null)
  useSway(canopy, sway, seed, animate && sway > 0)
  return (
    <group name={name} position={position}>
      {geometry.pot && pot !== 'none' && <mesh geometry={geometry.pot} material={materials.pots[pot]} castShadow receiveShadow />}
      <group ref={canopy}>
        <mesh geometry={geometry.canopy} material={materials.canopy} castShadow receiveShadow />
      </group>
    </group>
  )
}
```

`src/three/plants/HangingPlant.tsx` :

```tsx
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { hangingGeometry } from './hanging'
import { plantMaterials } from './plantMaterials'
import { useSway } from './sway'
import type { HangingPlacement } from './types'

/** Pendulum amplitude of a hanging plant, in radians about its hook (Horn.os). */
export const HANGING_SWAY = 0.02

/** A hanging plant: cords, pot and canopy below the ceiling hook at `placement.position`, swinging about it when `animate`. */
export function HangingPlant({ placement, animate, name }: { placement: HangingPlacement; animate: boolean; name?: string }) {
  const { position, seed, glaze, vines, length, drop } = placement
  const geometry = useMemo(() => hangingGeometry({ seed, glaze, vines, length, drop }), [seed, glaze, vines, length, drop])
  const materials = plantMaterials()
  const pendulum = useRef<Group>(null)
  useSway(pendulum, HANGING_SWAY, seed, animate)
  return (
    <group name={name} position={position}>
      <group ref={pendulum}>
        <mesh geometry={geometry.cords} material={materials.cord} castShadow />
        <mesh geometry={geometry.pot} material={materials.hangingPots[glaze]} castShadow receiveShadow />
        <mesh geometry={geometry.canopy} material={materials.canopy} castShadow receiveShadow />
      </group>
    </group>
  )
}
```

`src/three/Books.tsx` :

```tsx
import { useEffect, useMemo } from 'react'
import { booksMaterial, shelfBooksGeometry } from './shelfBooks'
import type { ShelfBooksSpec } from './plants/types'

/** One shelf of books in room coordinates: one merged mesh with the shared atlas material. */
export function Books({ spec, name }: { spec: ShelfBooksSpec; name?: string }) {
  const geometry = useMemo(() => shelfBooksGeometry(spec), [spec])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name={name} geometry={geometry} material={booksMaterial()} castShadow receiveShadow />
}
```

Run: `npx tsc -p .`
Expected: aucune sortie (code de sortie 0) ; en particulier aucun `TS1149` de casse de nom de fichier.

- [ ] **Step 14: Vérifier et commiter**

Run: `npx vitest run src/three/plants src/three/books.test.ts`
Expected: PASS (13 tests), sortie sans avertissement.

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » inchangé à quelques Ko près (aucun composant n'importe encore les plantes ni les livres) ; `No test API (__academy) in the production JS`.

```bash
git add src/three/plants/leaf.ts src/three/plants/plantGeometry.ts src/three/plants/hanging.ts src/three/plants/plantMaterials.ts src/three/plants/sway.ts src/three/plants/Plant.tsx src/three/plants/HangingPlant.tsx src/three/plants/sway.test.ts src/three/plants/plant.test.ts src/three/plants/hanging.test.ts src/three/shelfBooks.ts src/three/Books.tsx src/three/books.test.ts
git commit -m "feat: plant, hanging plant and shelf book generators ported from Horn.os

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Plantes, vases et livres dans le décor

**Files:**
- Create: `src/zones/office/decor/LargePlants.tsx`, `src/zones/office/decor/Vases.tsx`
- Modify: `src/zones/office/decor/Decor.tsx` (réécriture : état final), `src/three/objects.tsx` (trois déclarations : `ObjectName`, `OBJECT_NAMES`, `glbModels`)
- Test: `src/zones/office/decor/decor.test.ts`

**Interfaces:**
- Consumes (Tâche 13) : `Plant({ placement, animate, name })` (`src/three/plants/Plant.tsx`), `HangingPlant({ placement, animate, name })` (`src/three/plants/HangingPlant.tsx`), `Books({ spec, name })` (`src/three/Books.tsx`), `useSway(target, amplitude, phase, enabled)` (`src/three/plants/sway.ts`).
- Consumes (Tâche 12) : `AssetBoundary` (`src/three/AssetBoundary.tsx`), `Pendants`, `PictureFrames` (`src/zones/office/decor/`), l'état de `Decor.tsx` de fin de Tâche 12 ; (Tâche 10) `SceneObject({ object, outline, height, onModel, ...props }: ModelProps & { object: ObjectName })`, `resolveObject(name, models?)`, `OBJECT_NAMES` (`src/three/objects.tsx`) ; (Tâche 7) `useQualitySettings(): QualitySettings` (`animatePlants`) ; (Tâche 3) `useApp((s) => s.reducedMotion)` ; (Tâche 2) `MODELS`, `modelUrl(model: ModelId)`, `type ModelId` (`src/three/assets.ts`) ; (Tâche 5) `layout.objects.{cabinet, coffeeTable, plants, hangingPlants, largePlants, vases, shelfBooks, shelves}`, `BANQUETTE`, `SHELVES`, `type Vec3` (`src/zones/office/layout.ts`), `SIZES` (`src/zones/office/footprints.ts`, clés `vaseTall`, `vaseRound`, `sideboard`), `type VasePlacement` (`src/three/plants/types.ts`).
- Produces : `Decor()` final ; `LargePlants({ animate }: { animate: boolean })`, `LARGE_PLANT_SWAY = 0.006`, `PACHIRA = { potScale: 1.6, height: 1.55, base: 0.325 }` ; `Vases({ animate }: { animate: boolean })`, `VASE_HEIGHTS: Record<VasePlacement['model'], number>` (`vaseTall` 0.4, `vaseRound` 0.34), `RIM_INSET = 0.03`, `vasePlantPosition(vase: VasePlacement): Vec3` ; dans `objects.tsx`, `ObjectName` et `OBJECT_NAMES` gagnent `'pottedPlant' | 'pachira' | 'vaseTall' | 'vaseRound' | 'clayPot'`, et `glbModels` les cinq URL (état final du registre). Noms de scène : `plant-0`…`plant-7`, `hangingPlant-0`, `hangingPlant-1`, `books-0`, `books-1`, `pottedPlant`, `pachira`, `vase-0`, `vase-1`, `vasePlant-0`, `vasePlant-1`.

Portée : spec §3 « Plantes » (grandes plantes Poly Haven, pots `ceramic_vase_01`, `ceramic_vase_04`, `planter_pot_clay`) et « Étagères » ; §7 plantes animées en `high` et `medium`, immobiles en `low` (`animatePlants`) ; §8 feuilles immobiles en « réduire les animations ». Le décor reste dans sa propre frontière `Suspense` (Tâche 12) : les plantes générées et les livres ne téléchargent rien ; les cinq modèles passent par des `AssetBoundary` (un échec omet le groupe, le reste s'affiche). Les placements viennent tous de `layout.objects` (Tâche 5) et ont été vérifiés là-bas contre le rayon caméra → laptop et le coin rétro ; la Tâche 13 garantit que chaque plante générée tient dans son empreinte.

- [ ] **Step 1: Écrire le test qui échoue `src/zones/office/decor/decor.test.ts`**

```ts
import { MODELS, modelUrl, type ModelId } from '../../../three/assets'
import { OBJECT_NAMES, resolveObject, type ObjectName } from '../../../three/objects'
import { plantGeometry } from '../../../three/plants/plantGeometry'
import { SIZES } from '../footprints'
import { BANQUETTE, GLAZING, SHELVES, layout } from '../layout'
import { RIM_INSET, VASE_HEIGHTS, vasePlantPosition } from './Vases'

/** Outer radius of a generated pot: its rim is 7 % wider than its body (three/plants/plantGeometry.ts). */
const rimRadius = (r: number) => r * 1.07

test('banquette plants stand on the banquette', () => {
  const onBanquette = layout.objects.plants.filter((plant) => plant.position[0] < BANQUETTE.x1)
  expect(onBanquette).toHaveLength(5)
  for (const plant of onBanquette) {
    const [x, y, z] = plant.position
    const r = rimRadius(plant.r)
    expect(y, plant.kind).toBe(BANQUETTE.height)
    expect(x - r).toBeGreaterThanOrEqual(BANQUETTE.x0)
    expect(x + r).toBeLessThanOrEqual(BANQUETTE.x1)
    expect(z - r).toBeGreaterThanOrEqual(BANQUETTE.z0)
    expect(z + r).toBeLessThanOrEqual(BANQUETTE.z1)
  }
  const round = layout.objects.vases.find((vase) => vase.model === 'vaseRound')!
  const half = SIZES.vaseRound[0] / 2
  expect(round.position[1]).toBe(BANQUETTE.height)
  expect(round.position[0] - half).toBeGreaterThanOrEqual(BANQUETTE.x0)
  expect(round.position[0] + half).toBeLessThanOrEqual(BANQUETTE.x1)
})

test('banquette plants keep their leaves inside the glazing', () => {
  // The inner face of the facade frame (mullions and transom): no generated leaf reaches it, nor the glass behind it.
  const frame = GLAZING.side.x + GLAZING.mullion.depth / 2
  const onBanquette = [
    ...layout.objects.plants.filter((plant) => plant.position[0] < BANQUETTE.x1),
    ...layout.objects.vases
      .filter((vase) => vase.position[0] < BANQUETTE.x1)
      .map((vase) => ({ ...vase.plant, pot: 'none' as const, position: vasePlantPosition(vase) })),
  ]
  expect(onBanquette).toHaveLength(6)
  for (const { kind, position, r, h, pot, scale, seed, fall } of onBanquette) {
    const { canopy } = plantGeometry(kind, { r, h, pot, scale, seed, fall })
    canopy.computeBoundingBox()
    expect(position[0] + canopy.boundingBox!.min.x, `${kind} at z ${position[2]}`).toBeGreaterThan(frame)
  }
})

test('shelf plants and books stand on a shelf board', () => {
  const [sx, , sz] = layout.objects.shelves.position
  const tops = SHELVES.boards.map((bottom) => bottom + SHELVES.thickness)
  const span = { x0: sx - SHELVES.width / 2, x1: sx + SHELVES.width / 2, z0: sz - SHELVES.depth / 2, z1: sz + SHELVES.depth / 2 }
  const onShelves = layout.objects.plants.filter((plant) => plant.position[1] > 1)
  expect(onShelves).toHaveLength(2)
  for (const plant of onShelves) {
    const [x, y, z] = plant.position
    const r = rimRadius(plant.r)
    expect(tops, plant.kind).toContain(y)
    expect(x - r).toBeGreaterThanOrEqual(span.x0)
    expect(x + r).toBeLessThanOrEqual(span.x1)
    expect(z - r).toBeGreaterThanOrEqual(span.z0)
    expect(z + r).toBeLessThanOrEqual(span.z1)
  }
  for (const books of layout.objects.shelfBooks) {
    expect(tops).toContain(books.y)
    expect(books.z).toBe(sz)
    expect(books.x0).toBeGreaterThanOrEqual(span.x0)
    expect(books.x1).toBeLessThanOrEqual(span.x1)
    // Books and pots never share the same stretch of a board.
    for (const plant of onShelves.filter((p) => p.position[1] === books.y)) {
      const r = rimRadius(plant.r)
      expect(plant.position[0] + r <= books.x0 || plant.position[0] - r >= books.x1, `${plant.kind} and books at ${books.y}`).toBe(true)
    }
  }
})

test('vase plants sit at the rim of their vase', () => {
  expect(layout.objects.vases).toHaveLength(2)
  for (const vase of layout.objects.vases) {
    const height = VASE_HEIGHTS[vase.model]
    // The footprint box is the vase plus a centimetre of margin.
    expect(height).toBeLessThanOrEqual(SIZES[vase.model][1])
    expect(height).toBeGreaterThan(SIZES[vase.model][1] - 0.02)
    const [x, y, z] = vasePlantPosition(vase)
    expect([x, z]).toEqual([vase.position[0], vase.position[2]])
    expect(y).toBeCloseTo(vase.position[1] + height - RIM_INSET, 9)
    expect('pot' in vase.plant).toBe(false)
  }
  // The tall vase stands on the sideboard top, the round one on the banquette.
  const tall = layout.objects.vases.find((vase) => vase.model === 'vaseTall')!
  expect(tall.position[1]).toBe(SIZES.sideboard[1])
})

test('every d\u00e9cor model is declared in the registry', () => {
  const decorModels: [ObjectName, ModelId][] = [
    ['cabinet', 'drawerCabinet'],
    ['coffeeTable', 'coffeeTable'],
    ['pendant', 'pendantLamp'],
    ['pictureFrame', 'pictureFrame'],
    ['pottedPlant', 'pottedPlant'],
    ['pachira', 'pachira'],
    ['vaseTall', 'vaseTall'],
    ['vaseRound', 'vaseRound'],
    ['clayPot', 'clayPot'],
  ]
  for (const [name, model] of decorModels) {
    expect(OBJECT_NAMES, name).toContain(name)
    expect(resolveObject(name), name).toEqual({ kind: 'glb', url: modelUrl(model) })
    expect(MODELS[model].stage, name).toBe('decor')
  }
})
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run src/zones/office/decor/decor.test.ts`
Expected: FAIL — `Failed to resolve import "./Vases" from "src/zones/office/decor/decor.test.ts"` (puis, une fois `Vases.tsx` créé, les erreurs de type `'pottedPlant'` n'est pas un `ObjectName` tant que le registre n'est pas complété).

- [ ] **Step 3: Déclarer les cinq modèles dans `src/three/objects.tsx`**

Les trois déclarations `ObjectName`, `OBJECT_NAMES` et `glbModels` gagnent les cinq modèles, sous la forme que leur a donnée la Tâche 12 (Step 5) ; le reste du fichier (`procedural`, `ModelProps`, `hasSource`, `GltfObject`, `SceneObject`, `resolveObject`) ne bouge pas. Les cinq noms sont des modèles seulement, comme `'clock'`, `'cabinet'`, `'coffeeTable'`, `'pendant'` et `'pictureFrame'` : la table `procedural` (partielle) n'en a pas besoin, et `as const satisfies readonly ObjectName[]` garde la vérification de type du test « every object name has a source » (Tâche 10).

Dans `src/three/objects.tsx` (état de la Tâche 12), remplacer exactement

```ts
  | 'cabinet' | 'coffeeTable' | 'pendant' | 'pictureFrame' // GLB, Task 12 (decor)
```

par

```ts
  | 'cabinet' | 'coffeeTable' | 'pendant' | 'pictureFrame' // GLB, Task 12 (decor)
  | 'pottedPlant' | 'pachira' | 'vaseTall' | 'vaseRound' | 'clayPot' // GLB, Task 14 (decor)
```

puis exactement

```ts
  'cabinet', 'coffeeTable', 'pendant', 'pictureFrame',
] as const satisfies readonly ObjectName[]
```

par

```ts
  'cabinet', 'coffeeTable', 'pendant', 'pictureFrame',
  'pottedPlant', 'pachira', 'vaseTall', 'vaseRound', 'clayPot',
] as const satisfies readonly ObjectName[]
```

puis exactement

```ts
  pictureFrame: modelUrl('pictureFrame'),
}
```

par

```ts
  pictureFrame: modelUrl('pictureFrame'),
  pottedPlant: modelUrl('pottedPlant'),
  pachira: modelUrl('pachira'),
  vaseTall: modelUrl('vaseTall'),
  vaseRound: modelUrl('vaseRound'),
  clayPot: modelUrl('clayPot'),
}
```

Run: `npx vitest run src/three/objects.test.ts`
Expected: PASS — y compris « objects are procedural unless a GLB is declared » (le canapé reste procédural), « every object name has a source » et « declared models live under assets/models » (Tâche 10).

- [ ] **Step 4: Créer `src/zones/office/decor/Vases.tsx`**

Les deux vases Poly Haven à leur taille d'origine (hauteurs mesurées sur les fichiers Poly Haven : 0,40 et 0,34 m ; leurs empreintes de `footprints.ts` font 1 cm de plus), chacun avec une petite plante générée sans pot, posée 3 cm sous l'embouchure pour qu'aucun jour ne se voie entre la lèvre et les tiges.

```tsx
import { SceneObject } from '../../../three/objects'
import { Plant } from '../../../three/plants/Plant'
import type { VasePlacement } from '../../../three/plants/types'
import { layout, type Vec3 } from '../layout'

/** Height of the two Poly Haven vases as loaded (no scaling), in metres. */
export const VASE_HEIGHTS: Record<VasePlacement['model'], number> = { vaseTall: 0.4, vaseRound: 0.34 }
/** A vase plant sits this far inside the vase's mouth, so no gap shows between the rim and the stems. */
export const RIM_INSET = 0.03

/** Where the potless plant of a vase stands: on the vase's axis, just inside its rim. */
export function vasePlantPosition(vase: VasePlacement): Vec3 {
  const [x, y, z] = vase.position
  return [x, y + VASE_HEIGHTS[vase.model] - RIM_INSET, z]
}

/** The two ceramic vases, each with a small generated plant growing out of it. */
export function Vases({ animate }: { animate: boolean }) {
  return (
    <>
      {layout.objects.vases.map((vase, index) => (
        <group key={index}>
          <SceneObject object={vase.model} name={`vase-${index}`} position={vase.position} rotation-y={vase.rotationY ?? 0} />
          <Plant name={`vasePlant-${index}`} placement={{ ...vase.plant, position: vasePlantPosition(vase), pot: 'none' }} animate={animate} />
        </group>
      ))}
    </>
  )
}
```

- [ ] **Step 5: Créer `src/zones/office/decor/LargePlants.tsx`**

Les deux plantes de sol Poly Haven : `pottedPlant` (son propre pot) à sa place ; le pachira dans `planter_pot_clay` agrandi × 1,6, l'arbre ramené à 1,55 m et posé à y 0,325. Le balancement de groupe (amplitude 0,006, comme `furnish()` de Horn.os) passe par `useSway` ; seul l'arbre du pachira bouge, son pot reste immobile. Les phases (1,3 et 4,7) écartent les deux plantes.

```tsx
import { useRef } from 'react'
import type { Group } from 'three'
import { SceneObject } from '../../../three/objects'
import { useSway } from '../../../three/plants/sway'
import { layout } from '../layout'

/** Sway of the two large plants, in radians about their base (Horn.os furnish()). */
export const LARGE_PLANT_SWAY = 0.006
/** The money tree: the clay planter scaled up, the tree scaled to its height and standing on the planter's soil line. */
export const PACHIRA = { potScale: 1.6, height: 1.55, base: 0.325 } as const

/** The Poly Haven floor plants: a large potted plant by the glazing, a money tree in a clay planter in the back corner. */
export function LargePlants({ animate }: { animate: boolean }) {
  const { pottedPlant, pachira } = layout.objects.largePlants
  const potted = useRef<Group>(null)
  const tree = useRef<Group>(null)
  useSway(potted, LARGE_PLANT_SWAY, 1.3, animate)
  useSway(tree, LARGE_PLANT_SWAY, 4.7, animate)
  return (
    <>
      <group name="pottedPlant" position={pottedPlant.position} rotation-y={pottedPlant.rotationY ?? 0}>
        <group ref={potted}>
          <SceneObject object="pottedPlant" />
        </group>
      </group>
      <group name="pachira" position={pachira.position} rotation-y={pachira.rotationY ?? 0}>
        <SceneObject object="clayPot" scale={PACHIRA.potScale} />
        <group ref={tree} position-y={PACHIRA.base}>
          <SceneObject object="pachira" height={PACHIRA.height} />
        </group>
      </group>
    </>
  )
}
```

Run: `npx vitest run src/zones/office/decor/decor.test.ts`
Expected: PASS (5 tests). « banquette plants keep their leaves inside the glazing » mesure la géométrie réellement générée : feuilles jusqu'à x = −4,952 (monstera), −4,940 (fougère) et −4,949 (fougère du vase rond) pour une limite à −4,96 (mesuré dans le scratch du plan). S'il échoue, c'est un placement de la banquette dans `layout.ts` (Tâche 5) qui a changé : le corriger là, jamais en desserrant ce test.

- [ ] **Step 6: Réécrire `src/zones/office/decor/Decor.tsx` (état final)**

```tsx
import { useQualitySettings } from '../../../app/quality'
import { useApp } from '../../../core/store'
import { AssetBoundary } from '../../../three/AssetBoundary'
import { Books } from '../../../three/Books'
import { SceneObject } from '../../../three/objects'
import { HangingPlant } from '../../../three/plants/HangingPlant'
import { Plant } from '../../../three/plants/Plant'
import { layout } from '../layout'
import { LargePlants } from './LargePlants'
import { Pendants } from './Pendants'
import { PictureFrames } from './PictureFrames'
import { Vases } from './Vases'

/**
 * The decor stage (spec section 7): everything that loads after the first image. A model that fails is left out by its
 * AssetBoundary; generated plants and books need no download. Plants sway on the high and medium tiers, never
 * with reduced motion.
 */
export function Decor() {
  const settings = useQualitySettings()
  const reducedMotion = useApp((s) => s.reducedMotion)
  const animate = settings.animatePlants && !reducedMotion
  const { cabinet, coffeeTable, plants, hangingPlants, shelfBooks } = layout.objects
  return (
    <>
      <AssetBoundary name="cabinet"><SceneObject object="cabinet" name="cabinet" position={cabinet.position} rotation-y={cabinet.rotationY} /></AssetBoundary>
      <AssetBoundary name="coffeeTable"><SceneObject object="coffeeTable" name="coffeeTable" position={coffeeTable.position} rotation-y={coffeeTable.rotationY} /></AssetBoundary>
      <AssetBoundary name="pendants"><Pendants /></AssetBoundary>
      <AssetBoundary name="frames"><PictureFrames /></AssetBoundary>
      <AssetBoundary name="largePlants"><LargePlants animate={animate} /></AssetBoundary>
      <AssetBoundary name="vases"><Vases animate={animate} /></AssetBoundary>
      {plants.map((placement, index) => <Plant key={index} name={`plant-${index}`} placement={placement} animate={animate} />)}
      {hangingPlants.map((placement, index) => <HangingPlant key={index} name={`hangingPlant-${index}`} placement={placement} animate={animate} />)}
      {shelfBooks.map((spec, index) => <Books key={index} name={`books-${index}`} spec={spec} />)}
    </>
  )
}
```

Run: `npx tsc -p .`
Expected: aucune sortie (code de sortie 0).

- [ ] **Step 7: Vérifier, parcours e2e et captures**

Run: `npm run check`
Expected: PASS ; « Initial JS (gzip) » augmente de quelques Ko (générateurs de plantes et de livres, entrés dans le chunk initial avec le décor, spec §7) et reste sous 1,50 MB ; `No test API (__academy) in the production JS`.

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS (9 tests) — le laptop reste survolable en vue d'ensemble pendant et après le chargement du décor ; aucune erreur de page ; le test le plus long tient sous 54 s, 60 % de son délai de 90 s (mesuré dans le scratch du plan, avec des modèles de remplacement : 45,1 s, suite en 2,7 min). Au-delà, ne relever aucun délai : vérifier `data-quality="low"` sur `[data-testid="stage"]` pendant le test, puis remettre la mesure au contrôleur (le levier prévu est l'allègement du rendu sans GPU des Tâches 7 et 8).

Run: `node scripts/shots.mjs --out .superpowers/review-shots/task-14 --phases day,sunset,night --wait-decor`
Expected: six fichiers `day-overview.png` … `night-presentation.png` dans `.superpowers/review-shots/task-14/`, sans avertissement « the decor was not ready » (non commités).

Ce que le contrôleur regarde sur ces captures :
- vue d'ensemble : sur la banquette, de l'arrière vers l'avant, succulente, monstera, vase rond et sa fougère, fougère, succulente, pothos dont les vrilles tombent vers la pièce ; les deux plantes suspendues devant la vitre ; la grande plante en pot à l'avant gauche ; le pachira dans son pot de terre cuite, dans l'angle du fond derrière Ada (tronc posé dans le pot, sans vide visible entre le pot et l'arbre) ; le palmier derrière le coin télé, qui ne masque ni la télé ni la console ; les livres debout, couchés et penché sur les deux planches des étagères, l'herbe et le pothos sur la planche haute ; le grand vase et son pothos au bout gauche du buffet ;
- aucun pot ne flotte ni ne s'enfonce (banquette à 0,42 m, planche haute à 1,775 m), aucun dos de livre ne porte de lettre, le laptop et le coin rétro restent entièrement dégagés ;
- aucune feuille de la banquette ne touche la vitre ni un montant (le test de l'étape 5 le garantit pour les plantes générées) ; le pachira (modèle Poly Haven, que ce test ne mesure pas) ne traverse ni la vitre de la façade ni celle du retour, dans l'angle du fond : sinon, le signaler avec la capture ;
- les vrilles des deux pothos (banquette, planche haute des étagères) : le générateur les fait sortir de 6 à 13 cm puis tomber, si bien qu'elles passent dans la banquette ou sous la planche au lieu de pendre devant leur bord (mesuré dans le scratch du plan) : le signaler avec la capture, c'est un réglage de la Tâche 13 à décider sur image ;
- coucher et nuit : les feuilles et les pots restent sombres et mats (pas de reflet « plastique »), les livres gardent des couleurs lisibles sous les suspensions.

- [ ] **Step 8: Commiter**

```bash
git add src/zones/office/decor/LargePlants.tsx src/zones/office/decor/Vases.tsx src/zones/office/decor/Decor.tsx src/zones/office/decor/decor.test.ts src/three/objects.tsx
git commit -m "feat: generated plants, hanging plants, vases, large plants and shelf books in the decor stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Audit, API de test et parcours de bout en bout

**Files:**
- Create: `tests/e2e/redesign.spec.ts`, `src/three/colours.test.ts`
- Modify: `src/app/testApi.ts` (réécriture : `LightingSnapshot`, méthodes optionnelles `lighting`, `untexturedMeshes`), `src/app/TestApiBridge.tsx` (réécriture), `tests/e2e/office.spec.ts` (une ligne de `openOffice`)
- Régénérés et commités : `docs/evidence/office/01-overview.png` … `14-small-reading.png`

**Interfaces:**
- Consumes (Tâche 3) : `installTestApi(store, win?)`, `AcademyTestApi` (`state`, `clickObject`, `setPhase`, `rail`, `screenPosition?`), `type Phase`, `AppState.phase`, `AppState.phaseTransition`, `AppState.sceneReady`, `AppState.decorReady`, `AppState.railTarget` ; (Tâche 4) `untexturedMeshes(root: Object3D): string[]` (`src/three/audit.ts`, entrées `chemin#matériau`) ; (Tâche 7) lumières nommées `sun`, `window-light`, `lamp-light`, `gl.toneMappingExposure` et `scene.environmentIntensity` écrits à chaque image par `PhaseDriver` ; (Tâche 11) `HoverTarget` avec `'clock'`, bouton « Time of day », libellé « Change the time of day », objet de scène `clock` ; (Tâche 12) groupes de scène `base` et `decor`, `decorReady`, `AssetBoundary` ; (Tâche 14) groupes `pottedPlant`, `cabinet` du décor.
- Produces : `interface LightingSnapshot { phase; transitioning; exposure; environmentIntensity; sunIntensity; sunColor; windowIntensity; lampIntensity }` ; `AcademyTestApi.lighting?: () => LightingSnapshot` et `AcademyTestApi.untexturedMeshes?: () => string[]`, ajoutées et retirées par `TestApiBridge` comme `screenPosition` ; les huit tests e2e du Step 1 ; `openOffice` d'`office.spec.ts` ouvre `/?phase=day…` (captures identiques quelle que soit l'heure) ; la règle des couleurs vérifiée par `src/three/colours.test.ts`.

Portée : spec §9 « e2e » (horloge, bouton au clavier, `?phase=night`, audit des matériaux) ; §1 critères 1 (tout est texturé), 2 (cycle), 3 (coin rétro survolable dès la vue d'ensemble), 4 (parcours de la spec 1), 6 (hébergement) ; §8 (décor manquant) ; Global Constraints « Couleurs ». L'API de test reste réservée au développement : `TestApiBridge` n'est monté que derrière `import.meta.env.DEV` (`Stage.tsx`, inchangé), et `npm run budget` échoue si `__academy` atteint un chunk de production.

- [ ] **Step 1: Écrire le test e2e qui échoue `tests/e2e/redesign.spec.ts`**

Mêmes fixtures que les autres parcours (`tests/e2e/fixtures.ts`, inchangé : toute erreur de page fait échouer le test). Les aides `openOffice`, `waitForDecor`, `screenPosition` et `settledPosition` sont propres à ce fichier (copies de celles d'`office.spec.ts`, qui restent locales) ; `hover` reprend exactement la procédure de survol du laptop d'`office.spec.ts` (viser, laisser la parallaxe se poser, viser de nouveau). Les tests qui attendent le décor gardent le délai par défaut de 90 s : chaque attente est bornée à 60 s (`READY_MS`, la borne du socle en rendu logiciel, spec §7), et le scratch du plan les a mesurés à 17 s au plus (aucun délai relevé, résolution « Rendu logiciel des e2e »).

```ts
import type { Page } from '@playwright/test'
import { expect, state, test } from './fixtures'

/*
 * Journeys of the office redesign (spec 2026-10-06, section 9): time of day, wall clock, keyboard, material audit,
 * self-hosting, a failing decor model, and the laptop and retro corner still reachable once the decor has loaded.
 */

/** Software rendering: each stage (the base, then the decor) is awaited at most 60 s, within the test's 90 s. */
const READY_MS = 60_000

/** Opens the office with a query (for example '?phase=night') from a blank page, and waits for the base stage. */
async function openOffice(page: Page, query = '?phase=day') {
  await page.goto('about:blank')
  await page.goto(`/${query}#/office`)
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
}

async function waitForDecor(page: Page) {
  await page.waitForFunction(() => window.__academy?.state().decorReady === true, undefined, { timeout: READY_MS })
}

const screenPosition = (page: Page, name: string) => page.evaluate((n) => window.__academy!.screenPosition!(n), name)
const lighting = (page: Page) => page.evaluate(() => window.__academy!.lighting!())

type Point = { x: number; y: number }

/** Copy of office.spec.ts: waits until a named object stops moving on screen (camera, rail easing and parallax settled). */
async function settledPosition(page: Page, name: string) {
  let previous = null as Point | null
  await expect
    .poll(
      async () => {
        const current = await screenPosition(page, name)
        const moved = previous && current ? Math.hypot(current.x - previous.x, current.y - previous.y) : Infinity
        previous = current
        return moved
      },
      { intervals: [200], timeout: 20_000 },
    )
    .toBeLessThan(1)
  return previous
}

/** Puts the pointer on the centre of a named object the way office.spec.ts hovers the laptop (aim, let the parallax settle, aim again). */
async function hover(page: Page, name: string): Promise<Point> {
  const approx = await settledPosition(page, name)
  expect(approx, `${name} is on screen`).not.toBeNull()
  await page.mouse.move(approx!.x, approx!.y)
  const exact = await settledPosition(page, name)
  await page.mouse.move(exact!.x, exact!.y)
  return exact!
}

test('?phase=night opens the office at night', async ({ page }) => {
  await openOffice(page, '?phase=night')
  expect((await state(page)).phase).toBe('night')
  await expect.poll(async () => (await lighting(page)).exposure).toBeCloseTo(1.15, 2)
  const night = await lighting(page)
  expect(night.phase).toBe('night')
  expect(night.environmentIntensity).toBeCloseTo(0.05, 2)
  expect(night.transitioning).toBe(false)
  // Read once at start-up, never written back.
  await expect(page).toHaveURL(/\?phase=night#\/office$/)
})

test('clicking the wall clock moves to the next phase', async ({ page }) => {
  await openOffice(page, '?phase=day')
  const day = await lighting(page)
  expect(day.environmentIntensity).toBeCloseTo(0.32, 2)
  const clock = await hover(page, 'clock')
  await expect(page.locator('.object-label')).toHaveText('Change the time of day')
  await page.mouse.click(clock.x, clock.y)
  const clicked = await state(page)
  expect(clicked.phase).toBe('sunset')
  expect(clicked.phaseTransition).toMatchObject({ from: 'day', to: 'sunset' })
  await expect.poll(async () => (await state(page)).phaseTransition, { timeout: 6_000 }).toBeNull()
  const sunset = await lighting(page)
  expect(sunset.transitioning).toBe(false)
  expect(sunset.environmentIntensity).toBeCloseTo(0.18, 2)
  expect(sunset.exposure).toBeCloseTo(1.0, 2)
  expect(sunset.sunColor).not.toBe(day.sunColor)
})

test('the Time of day button works from the keyboard', async ({ page }) => {
  await openOffice(page, '?phase=day')
  const button = page.getByRole('button', { name: 'Time of day' })
  await expect(button).toBeVisible()
  const focused = () => button.evaluate((element) => element === document.activeElement)
  for (let i = 0; i < 25 && !(await focused()); i++) await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await state(page)).phase).toBe('sunset')
})

test('every visible surface of the office is textured', async ({ page }) => {
  await openOffice(page)
  await waitForDecor(page)
  // Entries read `path#material`; only emissive, glass, screen and sky materials may be untextured (and are marked so).
  expect(await page.evaluate(() => window.__academy!.untexturedMeshes!())).toEqual([])
})

test('nothing is fetched from another site', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const foreign: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin) foreign.push(request.url())
  })
  await page.goto('/?phase=day#/office')
  await page.waitForFunction(() => window.__academy?.state().sceneReady === true, undefined, { timeout: READY_MS })
  await waitForDecor(page)
  // No Draco decoder from gstatic, no drei environment from githack, no font or texture from a CDN.
  expect(foreign).toEqual([])
})

test('a missing d\u00e9cor model leaves the office usable', async ({ page }) => {
  await page.route('**/assets/models/potted_plant_01.glb', (route) => route.abort())
  await openOffice(page)
  await waitForDecor(page)
  // The large plants are left out; the rest of the decor is there.
  expect(await screenPosition(page, 'pottedPlant')).toBeNull()
  expect(await screenPosition(page, 'cabinet')).not.toBeNull()
  await hover(page, 'laptop')
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
})

test('the laptop stays hoverable once the d\u00e9cor has loaded', async ({ page }) => {
  await openOffice(page)
  await waitForDecor(page)
  await hover(page, 'laptop')
  await expect(page.locator('.object-label')).toHaveText('Prompt Workshop')
})

test('the retro corner is hoverable from the overview', async ({ page }) => {
  await openOffice(page, '?phase=day')
  await waitForDecor(page)
  expect((await state(page)).railTarget).toBe(0)
  const tv = await hover(page, 'tv')
  await expect(page.locator('.object-label')).toHaveText('The Dungeon')
  // A real click: the console and the TV lead to the dungeon straight from the overview.
  await page.mouse.click(tv.x, tv.y)
  await expect(page.getByRole('heading', { name: 'The Dungeon' })).toBeVisible()
})
```

Run: `npx tsc -p .`
Expected: FAIL — `tests/e2e/redesign.spec.ts` : `Property 'lighting' does not exist on type 'AcademyTestApi'` et `Property 'untexturedMeshes' does not exist on type 'AcademyTestApi'` (le fichier est dans `include` de `tsconfig.json`).

- [ ] **Step 2: Réécrire `src/app/testApi.ts`**

```ts
import type { StoreApi } from 'zustand/vanilla'
import type { Phase } from '../core/phase'
import type { AppState, HoverTarget } from '../core/store'
import { objectActions } from '../zones/office/interactions'

/** What the lighting of the 3D office is right now (read by the e2e tests of the time of day). */
export interface LightingSnapshot {
  phase: Phase
  transitioning: boolean
  /** gl.toneMappingExposure */
  exposure: number
  /** scene.environmentIntensity */
  environmentIntensity: number
  /** Light named 'sun' (NaN when it is missing). */
  sunIntensity: number
  /** '#' + the sun's colour as hex ('' when it is missing). */
  sunColor: string
  /** Light named 'window-light'. */
  windowIntensity: number
  /** Light named 'lamp-light'. */
  lampIntensity: number
}

export interface AcademyTestApi {
  state: () => AppState
  clickObject: (target: HoverTarget) => void
  /** Sets the time of day at once, without a transition. */
  setPhase: (phase: Phase) => void
  /** Moves the camera rail target: 0 is the overview, 1 the presentation view. */
  rail: (t: number) => void
  /** Pixel position of a named 3D object's centre; added by TestApiBridge once the canvas is ready. */
  screenPosition?: (name: string) => { x: number; y: number } | null
  /** Current exposure, environment and named light levels; added by TestApiBridge. */
  lighting?: () => LightingSnapshot
  /** Material audit of the scene groups 'base' and 'decor' (`path#material` entries); added by TestApiBridge. */
  untexturedMeshes?: () => string[]
}

declare global {
  interface Window {
    __academy?: AcademyTestApi
  }
}

/** Development-only hooks for Playwright. Never installed in production builds. */
export function installTestApi(store: StoreApi<AppState>, win: Window = window) {
  win.__academy = {
    state: () => store.getState(),
    clickObject: (target) => objectActions[target](),
    setPhase: (phase) => store.getState().setPhase(phase),
    rail: (t) => store.getState().setRailTarget(t),
  }
}
```

- [ ] **Step 3: Réécrire `src/app/TestApiBridge.tsx`**

Les méthodes qui lisent la scène s'ajoutent quand le canvas est prêt et se retirent au démontage, comme `screenPosition`. `lighting()` lit l'état (phase, transition), `gl.toneMappingExposure`, `scene.environmentIntensity` et les lumières nommées par la Tâche 7 ; une lumière absente donne `NaN` (Playwright transmet `NaN`) plutôt qu'une valeur plausible. `untexturedMeshes()` audite les groupes `base` et `decor` (un groupe absent ou masqué, comme le décor pendant sa compilation, ne compte pas).

```tsx
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Box3, Vector3, type Light } from 'three'
import { appStore } from '../core/store'
import { untexturedMeshes } from '../three/audit'
import type { LightingSnapshot } from './testApi'

/** Scene groups covered by the material audit (spec section 9): the base stage and the decor stage. */
const AUDITED_GROUPS = ['base', 'decor']

/** Development only (mounted behind import.meta.env.DEV): adds the canvas-side methods of window.__academy. */
export function TestApiBridge() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const api = window.__academy
    if (!api) return
    api.screenPosition = (name) => {
      const object = scene.getObjectByName(name)
      if (!object) return null
      const centre = new Box3().setFromObject(object).getCenter(new Vector3()).project(camera)
      return { x: ((centre.x + 1) / 2) * size.width, y: ((1 - centre.y) / 2) * size.height }
    }
    api.lighting = (): LightingSnapshot => {
      const light = (name: string) => scene.getObjectByName(name) as Light | undefined
      const sun = light('sun')
      const { phase, phaseTransition } = appStore.getState()
      return {
        phase,
        transitioning: phaseTransition !== null,
        exposure: gl.toneMappingExposure,
        environmentIntensity: scene.environmentIntensity,
        sunIntensity: sun?.intensity ?? Number.NaN,
        sunColor: sun ? `#${sun.color.getHexString()}` : '',
        windowIntensity: light('window-light')?.intensity ?? Number.NaN,
        lampIntensity: light('lamp-light')?.intensity ?? Number.NaN,
      }
    }
    api.untexturedMeshes = () =>
      AUDITED_GROUPS.flatMap((name) => {
        const root = scene.getObjectByName(name)
        return root ? untexturedMeshes(root) : []
      })
    return () => {
      delete api.screenPosition
      delete api.lighting
      delete api.untexturedMeshes
    }
  }, [scene, camera, size, gl])

  return null
}
```

Run: `npx tsc -p .`
Expected: aucune sortie (code de sortie 0).

Run: `npx vitest run src/app/testApi.test.ts`
Expected: PASS (les tests existants et ceux de la Tâche 3 : `installTestApi` n'a pas changé).

- [ ] **Step 4: Vérifier les exemptions des écrans**

L'image « press start » et le bruit de `CrtScreen` sont des `meshBasicMaterial` à texture de canvas, sans carte de rugosité : l'audit les compterait comme non texturés s'ils n'étaient pas marqués `screen` (exemption de la spec : « les écrans »). La Tâche 11 (Step 6) a marqué leur groupe ; le modèle `television_02` garde ses propres textures (aucune exemption), l'écran du laptop est marqué en Tâche 9 et le groupe de l'écran mural en Tâche 10. Rien à modifier ici :

Run: `git grep -n "auditExempt" -- src/zones/office/CrtScreen.tsx src/zones/office/WallScreen3D.tsx src/three/props/Laptop.tsx`
Expected: trois lignes, chacune avec `auditExempt: 'screen'` (une par fichier).

- [ ] **Step 5: Lancer les nouveaux parcours une première fois**

Run: `npx playwright test tests/e2e/redesign.spec.ts`
Expected: PASS (8 tests) en 2 min environ (rendu logiciel ; mesuré dans le scratch du plan : 8 à 17 s par test). Les tests qui échouent ici désignent la tâche fautive :
- « every visible surface of the office is textured » : le message liste des entrées `chemin#matériau`. Un objet qui doit être texturé reçoit un matériau de `useMaterials()` (ou garde les textures de son GLB) dans le fichier de la tâche qui le crée ; seul un émissif, un verre, un écran ou le ciel se marque `markExempt(…)` (ou `userData={{ auditExempt: '…' }}` sur son groupe). Les écrans sont déjà exemptés (Step 4).
- « nothing is fetched from another site » : le message liste les URL étrangères (une adresse `gstatic` signale un `useGLTF` sans `false, true` ; `githack`, un `<Environment>` avec `preset` ou `files`).
- « clicking the wall clock moves to the next phase », « the retro corner is hoverable from the overview » : `screenPosition('clock')` ou `screenPosition('tv')` nul signale un nom de scène manquant (Tâche 11).

- [ ] **Step 6: Écrire `src/three/colours.test.ts`**

La règle des couleurs (Global Constraints) : aucun littéral `#rgb`, `#rrggbb` ou `0xrrggbb` dans `src/three/**` et `src/zones/office/**`, tests compris, hors `src/three/tints.ts`, `src/zones/office/lighting/presets.ts`, `src/zones/office/lighting/rig.ts` et `src/three/robot/face.ts` (inchangé). Le test vérifie aussi qu'il lit bien du code (une liste vide passerait sinon sans rien prouver). Son expression régulière ne se reconnaît pas elle-même (`#(` et `0x[` ne sont pas des couleurs).

```ts
// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * Colour rule of the redesign: brand colours come from core/brand.ts, material tints from three/tints.ts, light, sky
 * and fog colours from the two lighting modules. No other file of the 3D code (tests included) writes a hex colour.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SCANNED = ['src/three', 'src/zones/office']
const ALLOWED = ['src/three/tints.ts', 'src/zones/office/lighting/presets.ts', 'src/zones/office/lighting/rig.ts', 'src/three/robot/face.ts']
/** #rgb, #rrggbb and 0xrrggbb, not followed by another letter or digit. */
const HEX_COLOUR = /#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_])|\b0x[0-9a-f]{6}(?![0-9a-z_])/gi

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
    .filter((file) => /\.tsx?$/.test(file))
}

test('colour literals live only in the tint and lighting modules', () => {
  const files = SCANNED.flatMap(sourceFiles)
  // The scan really reads the 3D code: a broken path would make it pass on nothing.
  expect(files).toContain('src/three/tints.ts')
  expect(files).toContain('src/zones/office/OfficeScene.tsx')
  const offenders: string[] = []
  for (const file of files.filter((f) => !ALLOWED.includes(f))) {
    readFileSync(join(ROOT, file), 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        for (const match of line.matchAll(HEX_COLOUR)) offenders.push(`${file}:${index + 1} ${match[0]}`)
      })
  }
  expect(offenders).toEqual([])
  // The allowed modules do hold the colours.
  expect(readFileSync(join(ROOT, 'src/three/tints.ts'), 'utf8')).toMatch(HEX_COLOUR)
})
```

Run: `npx vitest run src/three/colours.test.ts`
Expected: PASS (1 test). Les Tâches 7, 9, 10 et 11 ont retiré les dernières couleurs en dur (bloc `lights` de `layout.ts`, `Lamp.tsx`, visière d'`Ada.tsx`, ancien `materials()`) : sur l'arbre de départ, ce même test listait 27 lignes `fichier:ligne #couleur` dans ces quatre fichiers (vérifié dans la copie de travail). S'il en liste encore, déplacer chaque teinte de matériau dans `tints.ts` (clé existante ou valeur calculée) et chaque couleur de lumière, de ciel ou de brouillard dans `presets.ts` / `rig.ts`, puis relancer.

- [ ] **Step 7: Ouvrir les parcours de la spec 1 en plein jour**

Les captures de `docs/evidence/office/` doivent être identiques quelle que soit l'heure locale (sinon la phase dépend de l'heure du lancement). Dans `tests/e2e/office.spec.ts`, remplacer exactement la ligne

```ts
  await page.goto(`/${hash}`)
```

par

```ts
  await page.goto(`/?phase=day${hash}`)
```

C'est la seule modification du fichier : les liens profonds (`#/office?topic=…`) gardent leur hash après `?phase=day`, et le test de survol du laptop vise toujours son centre projeté (≈ (537 ; 509) px avec la vue d'ensemble de la Tâche 5).

Run: `npx playwright test tests/e2e/office.spec.ts`
Expected: PASS (9 tests) ; les captures `01` à `04`, `07` à `13` de `docs/evidence/office/` sont réécrites en phase de jour.

- [ ] **Step 8: Lancer tous les parcours puis vérifier**

Run: `npm run e2e`
Expected: PASS (19 tests : `office.spec.ts` 9, `reading.spec.ts` 2, `redesign.spec.ts` 8) ; les quatorze captures de `docs/evidence/office/` sont régénérées ; le test le plus long tient sous 54 s, 60 % de son délai de 90 s (mesuré dans le scratch du plan, avec des modèles de remplacement : 42,0 s pour « scroll to the presentation view, learn a topic and keep the progress », suite complète en 4,4 min, tests du décor en 17 s au plus). Au-delà, ne relever aucun délai : vérifier `data-quality="low"` sur `[data-testid="stage"]` pendant le test, puis remettre la mesure au contrôleur (le levier prévu est l'allègement du rendu sans GPU des Tâches 7 et 8).

Run: `npm run check`
Expected: PASS ; `No test API (__academy) in the production JS` (le pont gagne deux méthodes mais reste derrière `import.meta.env.DEV`).

Ouvrir `docs/evidence/office/01-overview.png`, `03-hover-laptop.png` et `11-small-overview.png` : bureau refait en phase de jour, coin rétro à droite, baie et ville à gauche, laptop entouré de son contour lime sur `03`.

- [ ] **Step 9: Commiter**

```bash
git add tests/e2e/redesign.spec.ts tests/e2e/office.spec.ts src/three/colours.test.ts src/app/testApi.ts src/app/TestApiBridge.tsx docs/evidence/office/*.png
git commit -m "test: redesign journeys, material audit and colour rule, evidence regenerated at day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Task 16: Preuves, performances et README

**Files:**
- Create: `scripts/perf.mjs`, `docs/evidence/office/phase-day-overview.png`, `docs/evidence/office/phase-day-presentation.png`, `docs/evidence/office/phase-sunset-overview.png`, `docs/evidence/office/phase-sunset-presentation.png`, `docs/evidence/office/phase-night-overview.png`, `docs/evidence/office/phase-night-presentation.png`
- Modify: `docs/evidence/office/perf.md` (réécrit par `scripts/perf.mjs`), `README.md`, `package.json` (script `"perf"`)
- Régénérés et commités : `docs/evidence/office/01-overview.png` … `14-small-reading.png` (dernier `npm run e2e`)

**Interfaces:**
- Consumes (Tâche 3) : `node scripts/shots.mjs --out <dir> [--phases …] [--views …] [--prefix <text>] [--wait-decor]` ; (Tâches 7 et 12) attributs `data-quality`, `data-scene-ready`, `data-decor-ready` sur `[data-testid="stage"]` (lus en production, où l'API de test n'existe pas) ; l'écran de chargement `.loading` (`LoadingScreen`) ; le mode lecture `main[aria-label="Reading mode"]` (`ReadingMode`, libellé `hud.readingMode`) ; la ligne `Initial JS (gzip): <x> MB` de `scripts/check-bundle.mjs`.
- Produces : `scripts/perf.mjs` (`node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out <file>]`, script npm `perf`), les six captures de preuve, `perf.md` mesuré, le README à jour.

Portée : spec §9 « Preuves » (6 captures, 3 phases × vue d'ensemble et vue présentation ; captures existantes régénérées ; `perf.md` remesuré par phase sur le PC de référence, sans valeur inventée, une case non mesurable marquée « non mesuré » avec sa raison) ; §1 critères 5 et 8 ; README (sections « Time of day », « 3D assets (CC0) », « Evidence and performance », mises à jour de « Replace a procedural object with a 3D model » et de « Tune the 3D layout »). Aucun test unitaire nouveau : `perf.mjs` se vérifie par son exécution (une copie de travail l'a fait tourner sur la version de production de l'ancien bureau : 3 phases mesurées, cases du décor « non mesuré (décor non prêt après 60 s) », comme attendu sans étage de décor).

Toutes les mesures et captures de cette tâche se font sur le PC de référence (Radeon 860M intégrée, Chromium avec interface, `--use-angle=d3d11`, 1600 × 900), sur secteur, fenêtre du navigateur au premier plan, sans autre charge (ni e2e, ni build en parallèle).

- [ ] **Step 1: Créer `scripts/perf.mjs` et le script npm**

Le script mesure la version de production servie par `vite preview` (il le lance sur le port 4173 si rien n'y répond, et l'arrête à la fin). Pour chaque phase, un navigateur neuf (le premier chargement est un démarrage à froid) et `--runs` chargements dans des contextes neufs, en `deviceScaleFactor` 1,5 (canvas de 2400 px, comme le `perf.md` précédent). Les instants « bureau affiché » et « décor chargé » sont relevés par un `MutationObserver` installé avant les scripts de la page, au changement de DOM exact (plus de sondage à 10 ms) ; un passage en mode lecture (échec du socle) est détecté et noté. Les images/s comptent les `requestAnimationFrame` pendant 5 s, 3 s après l'affichage (vue d'ensemble) puis 3 s après la molette (vue présentation). Machine, cartes graphiques (CIM de Windows), moteur WebGL de la page, version du navigateur, fréquence d'affichage, commit et JS initial sont lus, jamais recopiés. Toute valeur absente s'écrit « non mesuré » avec sa raison, et le verdict d'un critère qui en dépend vaut « non vérifiable ».

```js
// Performance of the production build on the reference PC (spec 2026-10-06, criterion 5), for each time of day:
// time until the office shows, time until the decor has loaded, frames per second in the overview and in the
// presentation view, and the quality tier at the end. Writes the Markdown of docs/evidence/office/perf.md.
// Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]
// Without --out the Markdown goes to the standard output. Starts `vite preview` on port 4173 when nothing answers there.
// A value that cannot be measured is written "non mesure" with its reason: nothing is ever estimated.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const DEFAULT_URL = 'http://localhost:4173'
const PHASES = ['day', 'sunset', 'night']
const PHASE_LABELS = { day: 'Jour', sunset: 'Coucher', night: 'Nuit' }
const LOAD_TIMEOUT_MS = 60_000
const SETTLE_MS = 3_000
const SAMPLE_MS = 5_000
const VIEWPORT = { width: 1600, height: 900 }
const SCALE = 1.5
const TARGETS = { fps: 60, officeMs: 3_000, decorMs: 8_000, initialJsMiB: 1.5 }
const NOT_MEASURED = 'non mesur\u00e9'

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: DEFAULT_URL },
    runs: { type: 'string', default: '3' },
    out: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
})
const usage = 'Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]'
if (values.help) {
  console.log(usage)
  process.exit(0)
}
const runs = Number.parseInt(values.runs, 10)
if (!Number.isInteger(runs) || runs < 1 || runs > 10) {
  console.error(`--runs must be a whole number from 1 to 10. ${usage}`)
  process.exit(1)
}
const base = values.url.replace(/\/+$/, '')

async function serverAnswers() {
  try {
    return (await fetch(base)).ok
  } catch {
    return false
  }
}

/** Starts `vite preview` on port 4173 (the production build in dist/) and waits for it; returns the child process. */
async function startPreview() {
  if (base !== DEFAULT_URL) throw new Error(`nothing answers on ${base}; start the server or leave --url out`)
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` first')
  const child = spawn('npx vite preview --port 4173 --strictPort', { shell: true, stdio: 'ignore', detached: process.platform !== 'win32' })
  const deadline = Date.now() + LOAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await serverAnswers()) return child
    await sleep(500)
  }
  stopServer(child)
  throw new Error(`vite preview did not answer on ${base} within ${LOAD_TIMEOUT_MS / 1000} s`)
}

function stopServer(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM')
}

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

/** The machine as Windows describes it (CIM), or the reason it cannot be read. */
function machine() {
  const cpu = os.cpus()[0]?.model.trim() ?? NOT_MEASURED
  const ram = `${Math.round(os.totalmem() / 1024 ** 3)} Go de RAM`
  const system = `${os.version()} ${os.release()}`
  if (process.platform !== 'win32') return { model: `${NOT_MEASURED} (hors Windows)`, cpu, ram, system, gpus: `${NOT_MEASURED} (hors Windows)` }
  const cim = (query) => run('powershell', ['-NoProfile', '-Command', query])
  const model = cim('$c = Get-CimInstance Win32_ComputerSystem; "$($c.Manufacturer) $($c.Model)"') ?? `${NOT_MEASURED} (CIM indisponible)`
  const gpus =
    cim('(Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name) ($($_.CurrentRefreshRate) Hz)" }) -join ", "') ??
    `${NOT_MEASURED} (CIM indisponible)`
  return { model, cpu, ram, system, gpus }
}

/** Initial JS (gzip) as scripts/check-bundle.mjs reports it, in MiB. */
function initialJs() {
  const output = run('node', ['scripts/check-bundle.mjs'])
  const match = output?.match(/Initial JS \(gzip\): ([\d.]+) MB/)
  return match ? Number(match[1]) : null
}

/** requestAnimationFrame rate over SAMPLE_MS: what the page really draws (capped by the display). */
const fpsInPage = (ms) =>
  new Promise((resolve) => {
    let frames = 0
    const start = performance.now()
    const tick = (now) => {
      frames++
      if (now - start < ms) requestAnimationFrame(tick)
      else resolve((frames / (now - start)) * 1000)
    }
    requestAnimationFrame(tick)
  })

/**
 * Installed before any page script: records performance.now() (ms since the navigation started) at the first DOM
 * change where the office shows (stage marked data-scene-ready, canvas present, loading screen gone), where the decor
 * is ready, and where the site fell back to reading mode (the base stage failed).
 */
function recordMarks() {
  const marks = {}
  window.perfMarks = marks
  const check = () => {
    const now = performance.now()
    const stage = document.querySelector('[data-testid="stage"]')
    if (marks.office === undefined && stage?.getAttribute('data-scene-ready') === 'true' && stage.querySelector('canvas') && !document.querySelector('.loading')) marks.office = now
    if (marks.decor === undefined && stage?.getAttribute('data-decor-ready') === 'true') marks.decor = now
    if (marks.reading === undefined && document.querySelector('main[aria-label="Reading mode"]')) marks.reading = now
  }
  new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true })
}

/** The mark once it exists, or 'reading' when the site fell back to reading mode first; null after the timeout. */
async function waitForMark(page, name) {
  try {
    const handle = await page.waitForFunction(
      (key) => {
        const marks = window.perfMarks ?? {}
        if (marks[key] !== undefined) return Math.round(marks[key])
        return marks.reading !== undefined ? 'reading' : false
      },
      name,
      { timeout: LOAD_TIMEOUT_MS },
    )
    return await handle.jsonValue()
  } catch {
    return null
  }
}

async function measureLoad(browser, phase) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  await context.addInitScript(recordMarks)
  const page = await context.newPage()
  await page.bringToFront()
  const result = { officeMs: null, decorMs: null, overview: null, presentation: null, quality: null, notes: [] }
  try {
    await page.goto(`${base}/?phase=${phase}#/office`)
    const office = await waitForMark(page, 'office')
    if (typeof office !== 'number') {
      result.notes.push(office === 'reading' ? 'le socle a \u00e9chou\u00e9, le site est pass\u00e9 en mode lecture' : `bureau non affich\u00e9 apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
      return result
    }
    result.officeMs = office
    const decor = await waitForMark(page, 'decor')
    if (typeof decor === 'number') result.decorMs = decor
    else result.notes.push(decor === 'reading' ? 'le site est pass\u00e9 en mode lecture pendant le chargement du d\u00e9cor' : `d\u00e9cor non pr\u00eat apr\u00e8s ${LOAD_TIMEOUT_MS / 1000} s`)
    await sleep(SETTLE_MS)
    result.overview = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    await page.mouse.move(800, 300)
    await page.mouse.wheel(0, -1500)
    await sleep(SETTLE_MS)
    result.presentation = Math.round(await page.evaluate(fpsInPage, SAMPLE_MS))
    result.quality = await page.getAttribute('[data-testid="stage"]', 'data-quality')
  } catch (error) {
    result.notes.push(`erreur : ${error.message.split('\n')[0]}`)
  } finally {
    await context.close()
  }
  return result
}

/** WebGL renderer string and display refresh rate, read from a blank page of the same browser. */
async function probe(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
  const page = await context.newPage()
  await page.bringToFront()
  await page.setContent('<canvas></canvas>')
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2')
    if (!gl) return null
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  })
  const refresh = Math.round(await page.evaluate(fpsInPage, 2000))
  await context.close()
  return { renderer, refresh }
}

const cell = (items, unit = '') =>
  items.map((value) => (value === null ? NOT_MEASURED : `${value}${unit}`)).join(' \u00b7 ')
const verdict = (items, ok) => (items.length === 0 || items.some((value) => value === null) ? 'non v\u00e9rifiable' : items.every(ok) ? 'oui' : 'non')

let server = null
try {
  if (!(await serverAnswers())) server = await startPreview()
  const results = {}
  let browserVersion = null
  let probed = null
  for (const phase of PHASES) {
    // A fresh browser per phase: its first load is a cold start (empty HTTP and shader caches).
    const browser = await chromium.launch({ headless: false, args: ['--use-angle=d3d11'] })
    browserVersion ??= browser.version()
    probed ??= await probe(browser)
    results[phase] = []
    for (let i = 0; i < runs; i++) {
      const load = await measureLoad(browser, phase)
      console.error(`${phase} #${i + 1}: ${JSON.stringify(load)}`)
      results[phase].push(load)
    }
    await browser.close()
  }

  const commit = run('git', ['rev-parse', '--short', 'HEAD']) ?? NOT_MEASURED
  const dirty = run('git', ['status', '--porcelain'])
  const host = machine()
  const js = initialJs()
  const today = new Date().toISOString().slice(0, 10)
  const column = (pick, unit) => PHASES.map((phase) => cell(results[phase].map(pick), unit))
  const all = (pick) => PHASES.flatMap((phase) => results[phase].map(pick))
  const notes = PHASES.flatMap((phase) => results[phase].flatMap((load, i) => load.notes.map((note) => `- ${PHASE_LABELS[phase]}, chargement ${i + 1} : ${note}.`)))
  const firstDecor = PHASES.map((phase) => results[phase][0].decorMs)
  const row = (label, cells, target) => `| ${label} | ${cells.join(' | ')} | ${target} |`

  const lines = [
    '# Mesures \u2014 bureau refait (refonte visuelle)',
    '',
    `- Date : ${today}`,
    `- Commit : ${commit}${dirty ? ' (avec des modifications locales non commit\u00e9es)' : ''} ; version de production : \`npm run build\` de ce commit, servie par \`vite preview\``,
    `- Machine : ${host.model} ; ${host.cpu} ; ${host.ram} ; ${host.system}`,
    `- Cartes graphiques (Windows) : ${host.gpus}`,
    `- Moteur WebGL de la page : ${probed.renderer ?? `${NOT_MEASURED} (WebGL 2 indisponible)`}`,
    `- Navigateur : Chromium ${browserVersion} de Playwright, avec interface, \`--use-angle=d3d11\`, fen\u00eatre ${VIEWPORT.width} \u00d7 ${VIEWPORT.height}, facteur d'\u00e9chelle 1,5 (canvas de ${VIEWPORT.width * SCALE} px de large)`,
    `- Fr\u00e9quence d'affichage mesur\u00e9e sur une page vide : ${probed.refresh} images/s`,
    '',
    `Chaque case donne les ${runs} chargements dans l'ordre (le premier est un d\u00e9marrage \u00e0 froid du navigateur), s\u00e9par\u00e9s par \u00ab \u00b7 \u00bb.`,
    '',
    `| Mesure | ${PHASES.map((phase) => PHASE_LABELS[phase]).join(' | ')} | Cible |`,
    `|---|${PHASES.map(() => '---').join('|')}|---|`,
    row("Images/s, vue d'ensemble", column((load) => load.overview, ''), `\u2265 ${TARGETS.fps}`),
    row('Images/s, vue pr\u00e9sentation', column((load) => load.presentation, ''), `\u2265 ${TARGETS.fps}`),
    row('Bureau affich\u00e9 apr\u00e8s', column((load) => load.officeMs, ' ms'), `< ${TARGETS.officeMs} ms`),
    row('D\u00e9cor charg\u00e9 apr\u00e8s', column((load) => load.decorMs, ' ms'), `< ${TARGETS.decorMs} ms au 1er chargement`),
    row('Niveau de qualit\u00e9 \u00e0 la fin', column((load) => load.quality, ''), 'pas `low`'),
    `| JS initial (gzip) | ${js === null ? `${NOT_MEASURED} (scripts/check-bundle.mjs sans r\u00e9sultat : lancer \`npm run build\`)` : `${js.toFixed(2).replace('.', ',')} Mo`} | | | \u2264 1,50 Mo |`,
    '',
    '## Crit\u00e8re 5 de la spec',
    '',
    `- Au moins ${TARGETS.fps} images/s dans chaque vue et chaque phase : ${verdict([...all((load) => load.overview), ...all((load) => load.presentation)], (fps) => fps >= TARGETS.fps)}.`,
    `- Le niveau de qualit\u00e9 ne tombe pas \u00e0 \`low\` : ${verdict(all((load) => load.quality), (quality) => quality !== 'low')}.`,
    `- Bureau affich\u00e9 en moins de ${TARGETS.officeMs / 1000} s : ${verdict(all((load) => load.officeMs), (ms) => ms < TARGETS.officeMs)}.`,
    `- Tous les d\u00e9cors charg\u00e9s en moins de ${TARGETS.decorMs / 1000} s au premier chargement : ${verdict(firstDecor, (ms) => ms < TARGETS.decorMs)}.`,
    `- JS initial \u2264 ${TARGETS.initialJsMiB.toFixed(2).replace('.', ',')} Mo : ${verdict([js], (mib) => mib <= TARGETS.initialJsMiB)}.`,
    ...(notes.length > 0 ? ['', '## Valeurs non mesur\u00e9es', '', ...notes] : []),
    '',
    '## M\u00e9thode',
    '',
    `- \`node scripts/perf.mjs --runs ${runs}\` apr\u00e8s \`npm run build\`. Un navigateur neuf par phase, ${runs} chargements par phase, chacun dans un contexte neuf ; la phase est forc\u00e9e par \`?phase=\`.`,
    '- Bureau affich\u00e9 : `performance.now()` (depuis le d\u00e9but de la navigation) \u00e0 la premi\u00e8re modification du DOM o\u00f9 `[data-testid="stage"]` porte `data-scene-ready="true"`, o\u00f9 le canvas existe et o\u00f9 l\'\u00e9cran de chargement a disparu (`MutationObserver` install\u00e9 avant les scripts de la page).',
    '- D\u00e9cor charg\u00e9 : m\u00eame horloge, \u00e0 la premi\u00e8re modification du DOM o\u00f9 `data-decor-ready="true"` (plantes, livres, cadres, suspensions, caisson et table basse affich\u00e9s, ou omis apr\u00e8s un \u00e9chec).',
    `- Images/s : nombre de \`requestAnimationFrame\` pendant ${SAMPLE_MS / 1000} s, ${SETTLE_MS / 1000} s apr\u00e8s l'affichage (vue d'ensemble), puis ${SETTLE_MS / 1000} s apr\u00e8s un d\u00e9filement \u00e0 la molette vers la vue pr\u00e9sentation. La fen\u00eatre du navigateur reste au premier plan pendant la mesure.`,
    '- Niveau de qualit\u00e9 : attribut `data-quality` de la sc\u00e8ne \u00e0 la fin du chargement (r\u00e9gl\u00e9 par le `PerformanceMonitor` de drei).',
    '- JS initial : sortie de `scripts/check-bundle.mjs` (gzip du chunk d\'entr\u00e9e et de ses imports statiques, en Mio).',
    '- Les mesures du premier bureau (sous-projet 1, 2026-09-30, commit f2336b4) restent dans l\'historique git de ce fichier.',
    '',
  ]
  const markdown = lines.join('\n')
  if (values.out) {
    writeFileSync(values.out, markdown)
    console.error(`wrote ${values.out}`)
  } else {
    console.log(markdown)
  }
} catch (error) {
  console.error(`perf failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (server) stopServer(server)
}
```

Dans `package.json`, remplacer exactement le bloc (état laissé par la Tâche 3)

```json
    "assets:build": "node --disable-warning=ExperimentalWarning scripts/assets/build.mjs",
    "shots": "node scripts/shots.mjs"
  },
```

par

```json
    "assets:build": "node --disable-warning=ExperimentalWarning scripts/assets/build.mjs",
    "shots": "node scripts/shots.mjs",
    "perf": "node scripts/perf.mjs"
  },
```

Run: `node scripts/perf.mjs --help`
Expected: `Usage: npm run build && node scripts/perf.mjs [--url http://localhost:4173] [--runs 3] [--out docs/evidence/office/perf.md]`, code de sortie 0, aucun navigateur ouvert.

Run: `node scripts/perf.mjs --runs 0`
Expected: `--runs must be a whole number from 1 to 10. Usage: …`, code de sortie 1.

```bash
git add scripts/perf.mjs package.json
git commit -m "feat: performance script for the production build, per time of day

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Ce commit vient avant la mesure : `perf.md` citera son identifiant, sur un arbre propre.

- [ ] **Step 2: Mesurer les performances sur le PC de référence**

Run: `npm run build`
Expected: build réussi (`dist/` est ignoré par git).

Run: `npm run perf -- --out docs/evidence/office/perf.md`
Expected (5 minutes environ) : trois fenêtres Chromium s'ouvrent l'une après l'autre (une par phase) ; la sortie d'erreur affiche neuf lignes `day #1: {"officeMs":…,"decorMs":…,"overview":…,"presentation":…,"quality":"…","notes":[]}` … `night #3: …`, puis `wrote docs/evidence/office/perf.md` ; code de sortie 0 ; `vite preview` est arrêté à la fin.

Lire `docs/evidence/office/perf.md` :
- l'en-tête donne la date, le commit du Step 1 sans mention de modification locale, la machine (`ASUSTeK COMPUTER INC. ROG Zephyrus G16 GA605KP…`, `AMD Ryzen AI 7 350 w/ Radeon 860M`), les deux cartes graphiques et le moteur WebGL de la page, qui doit nommer la Radeon 860M (`ANGLE (AMD, AMD Radeon(TM) 860M Graphics …, D3D11)`) : s'il nomme la RTX 5070, la mesure ne vaut pas pour le PC de référence ; s'arrêter et le signaler au contrôleur (le choix de la carte graphique de Chromium relève des paramètres graphiques de Windows, que seul le propriétaire règle), puis relancer ce step ;
- chaque case est une valeur mesurée ou « non mesuré » ; chaque « non mesuré » a sa ligne dans « Valeurs non mesurées » avec la raison (rien n'est complété à la main) ;
- la section « Critère 5 de la spec » donne un verdict par critère. Si l'un vaut « non » ou « non vérifiable », ne rien retoucher dans `perf.md` : passer aux étapes suivantes, puis le signaler au contrôleur avec le fichier (le critère 5 est contraignant et se traite hors de cette tâche).

- [ ] **Step 3: Enregistrer les six captures de preuve**

Run: `node scripts/shots.mjs --out docs/evidence/office --prefix phase- --phases day,sunset,night --wait-decor`
Expected: six lignes `saved docs\evidence\office\phase-day-overview.png`, `…phase-day-presentation.png`, `…phase-sunset-overview.png`, `…phase-sunset-presentation.png`, `…phase-night-overview.png`, `…phase-night-presentation.png`, sans avertissement « the decor was not ready » ; code de sortie 0.

Ce que le propriétaire et le contrôleur jugent sur ces six images (critère 8, niveau Horn.os au minimum) :
- vue d'ensemble, jour : coin rétro entier à droite (télé de face, console), laptop dégagé au bout de la table, baie vitrée sur la gauche avec la ville au soleil, ombres nettes du soleil par la baie, parquet, tapis, tasseaux et murs texturés, plantes partout ;
- vue présentation : l'écran mural lisible et net, Ada à sa gauche, la ville visible derrière Ada par le retour vitré ;
- coucher : lumière orangée rasante et ombres longues, suspensions et lignes de plafond allumées faiblement, lampe du buffet allumée, fenêtres de la ville qui commencent à s'allumer ;
- nuit : ciel sombre étoilé, fenêtres de la ville allumées, suspensions, lignes de plafond, lampe et enseigne Athena lumineuses, rien d'éblouissant ;
- dans les trois phases : aucune surface plate sans texture, aucun objet qui flotte ou traverse un mur, aucun texte sur les dos de livres ni sur les affiches.

- [ ] **Step 4: Mettre à jour `README.md`**

Remplacer exactement le paragraphe d'introduction

```markdown
Internal, PC-only training site to learn prompting. A 3D office (three.js, React Three Fiber) where Ada, a robot assistant, explains the basics of generative AI while a wall screen shows diagrams. The laptop leads to the prompt workshop and the retro console to the dungeon (both coming in later sub-projects).
```

par

```markdown
Internal, PC-only training site to learn prompting. A 3D office (three.js, React Three Fiber), a glazed agency meeting room over a 3D city lit for day, sunset or night, where Ada, a robot assistant, explains the basics of generative AI while a wall screen shows diagrams. The laptop leads to the prompt workshop and the retro console to the dungeon (both coming in later sub-projects).
```

Puis remplacer exactement la fin du fichier, de `## Tune the 3D layout` jusqu'à la dernière ligne :

````markdown
## Tune the 3D layout

Open http://localhost:5173/?tune (development only). Pick an object, drag it, edit the camera rail, then "copy layout" and paste the values into `src/zones/office/layout.ts`.

## Replace a procedural object with a 3D model

Put the file in `public/models/` and declare it in `glbModels` (`src/three/objects.tsx`) with `publicUrl('models/<file>.glb')` from `src/core/publicUrl.ts`, for example `{ sofa: publicUrl('models/sofa.glb') }`. Never write a URL under `public/` with a leading `/`: the site must keep working when it is served from a subfolder. The model must share the procedural object's origin (floor level, centred), orientation (front = +z) and scale (metres).

## Project docs

- Spec: `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`
- Plan: `docs/superpowers/plans/2026-09-29-athena-prompt-academy-office.md`
````

par

````markdown
## Time of day

The office opens in the phase of the local time: day from 07:00 to 17:59, sunset from 18:00 to 20:59, night from 21:00 to 06:59. Click the wall clock, or use the "Time of day" button in the top bar (it works from the keyboard), to move to the next phase: the lights, the sky and the city change over 2.5 s, at once with reduced motion. To force a phase, put `?phase=day`, `?phase=sunset` or `?phase=night` before the hash, for example http://localhost:5173/?phase=night#/office. The parameter is read once at start-up and never written back.

## Tune the 3D layout

Open http://localhost:5173/?tune (development only). Pick an object, drag it, edit the camera rail, then "copy layout" and paste the values into `src/zones/office/layout.ts`. Tunable objects: Ada, the wall screen, the table, the sideboard, the lamp, the laptop, the TV stand, the TV, the retro console, the sofa, the logo, the wall clock, the drawer cabinet, the coffee table and the shelves. Plants, vases and books are placed in `layout.objects` (`plants`, `hangingPlants`, `largePlants`, `vases`, `shelfBooks`).

`npm run test` checks the result: the overview keeps the retro corner, the laptop and its share of glazing, nothing stands between the overview camera and the laptop, and every generated plant stays inside its footprint (`src/zones/office/footprints.ts`).

## 3D assets (CC0)

Every texture and model comes from Poly Haven or ambientCG (CC0) and is served by the site from `public/assets/`: nothing is fetched from a CDN at run time. `scripts/assets/manifest.json` lists each asset: id, source, API URL, licence, resolution, use and loading stage (`base` for the first image, `decor` after it).

```bash
npm run assets:fetch   # downloads the listed sources into assets-src/ (ignored by git), checking sizes and checksums
npm run assets:build   # WebP textures, meshopt-compressed GLB models, public/assets/CREDITS.md, budget check
```

Both accept `-- --only <id>[,<id>]`. The prepared files and `public/assets/CREDITS.md` are committed, so the site builds without the network. `npm run test` checks that every file is listed in `CREDITS.md` as CC0-1.0 with its exact size, and the budgets: `public/assets` at most 18 MiB, files needed for the first image at most 6 MiB, no file of 3 MiB or more.

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

The first command saves the overview and the presentation view in each phase (Chromium in a real window on the GPU, 1600 x 900). The last two measure the production build in each phase (frames per second, office shown, decor loaded, quality tier) and write `docs/evidence/office/perf.md`. Both open browser windows: leave the machine alone while they run.

## Project docs

- Spec: `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md`
- Plan: `docs/superpowers/plans/2026-09-29-athena-prompt-academy-office.md`
- Office redesign spec: `docs/superpowers/specs/2026-10-06-athena-prompt-academy-office-redesign-design.md`
- Office redesign plan: `docs/superpowers/plans/2026-10-06-athena-prompt-academy-office-redesign.md`
````

- [ ] **Step 5: Vérification finale**

Run: `npm run check`
Expected: PASS ; `No test API (__academy) in the production JS`.

Run: `npm run e2e`
Expected: PASS (19 tests) ; les quatorze captures `01` à `14` de `docs/evidence/office/` sont régénérées sur l'état final.

Run: `git status --short`
Expected: `README.md`, `docs/evidence/office/perf.md`, les six `docs/evidence/office/phase-*.png` et les captures `01` à `14` régénérées ; rien d'autre.

- [ ] **Step 6: Commiter les preuves**

```bash
git add README.md docs/evidence/office/perf.md docs/evidence/office/*.png
git commit -m "docs: evidence per time of day, performance measured on the reference PC, README for the redesign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Remettre au contrôleur : les six `phase-*.png`, `perf.md` et, si un verdict du critère 5 vaut « non » ou « non vérifiable », la ligne concernée.
