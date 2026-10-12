# Mesures — bureau refait (refonte visuelle)

- Date : 2026-10-12
- Commit : bce1018 ; version de production : `npm run build` de ce commit, servie par `vite preview`
- Machine : ASUSTeK COMPUTER INC. ROG Zephyrus G16 GA605KP_GA605KP ; AMD Ryzen AI 7 350 w/ Radeon 860M ; 31 Go de RAM ; Windows 11 Home 10.0.26200
- Cartes graphiques (Windows) : NVIDIA GeForce RTX 5070 Laptop GPU ( Hz), AMD Radeon(TM) 860M Graphics (240 Hz)
- Moteur WebGL de la page : ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11)
- Navigateur : Chromium 153.0.8010.12 de Playwright, avec interface, `--use-angle=d3d11`, fenêtre 1600 × 900, facteur d'échelle 1,5 (canvas de 2400 px de large)
- Fréquence d'affichage mesurée sur une page vide : 240 images/s

Chaque case donne les 3 chargements dans l'ordre (le premier est un démarrage à froid du navigateur), séparés par « · ».

| Mesure | Jour | Coucher | Nuit | Cible |
|---|---|---|---|---|
| Images/s, vue d'ensemble | 76 · 74 · 73 | 74 · 72 · 71 | 75 · 72 · 72 | ≥ 60 |
| Images/s, vue présentation | 83 · 81 · 82 | 81 · 81 · 81 | 81 · 81 · 81 | ≥ 60 |
| Bureau affiché après | 3615 ms · 2032 ms · 2019 ms | 3613 ms · 2028 ms · 2041 ms | 3571 ms · 2043 ms · 2026 ms | < 3000 ms |
| Décor chargé après | 4474 ms · 2396 ms · 2403 ms | 4416 ms · 2401 ms · 2418 ms | 4402 ms · 2410 ms · 2397 ms | < 8000 ms au 1er chargement |
| Niveau de qualité à la fin | high · high · high | high · high · high | high · high · high | pas `low` |
| JS initial (gzip) | 0,44 Mo | | | ≤ 1,50 Mo |

## Critère 5 de la spec

- Au moins 60 images/s dans chaque vue et chaque phase : oui.
- Le niveau de qualité ne tombe pas à `low` : oui.
- Bureau affiché en moins de 3 s : non.
- Tous les décors chargés en moins de 8 s au premier chargement : oui.
- JS initial ≤ 1,50 Mo : oui.

## Méthode

- `node scripts/perf.mjs --runs 3` après `npm run build`. Un navigateur neuf par phase, 3 chargements par phase, chacun dans un contexte neuf ; la phase est forcée par `?phase=`.
- Bureau affiché : `performance.now()` (depuis le début de la navigation) à la première modification du DOM où `[data-testid="stage"]` porte `data-scene-ready="true"`, où le canvas existe et où l'écran de chargement a disparu (`MutationObserver` installé avant les scripts de la page).
- Décor chargé : même horloge, à la première modification du DOM où `data-decor-ready="true"` (plantes, livres, cadres, suspensions, caisson et table basse affichés, ou omis après un échec).
- Images/s : nombre de `requestAnimationFrame` pendant 5 s, 3 s après l'affichage (vue d'ensemble), puis 3 s après un défilement à la molette vers la vue présentation. La fenêtre du navigateur reste au premier plan pendant la mesure.
- Niveau de qualité : attribut `data-quality` de la scène à la fin du chargement (réglé par le `PerformanceMonitor` de drei).
- JS initial : sortie de `scripts/check-bundle.mjs` (gzip du chunk d'entrée et de ses imports statiques, en Mio).
- Les mesures du premier bureau (sous-projet 1, 2026-09-30, commit f2336b4) restent dans l'historique git de ce fichier.
