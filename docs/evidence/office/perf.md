# Mesures — bureau refait (refonte visuelle)

- Date : 2026-10-13
- Commit : 72911c9 ; version de production : `npm run build` de ce commit, servie par `vite preview`
- Machine : ASUSTeK COMPUTER INC. ROG Zephyrus G16 GA605KP_GA605KP ; AMD Ryzen AI 7 350 w/ Radeon 860M ; 31 Go de RAM ; Windows 11 Home 10.0.26200
- Cartes graphiques (Windows), avec la fréquence de leur écran : NVIDIA GeForce RTX 5070 Laptop GPU, 60 Hz ; AMD Radeon(TM) 860M Graphics, 240 Hz
- Moteur WebGL de la scène : ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11) (contexte de l'application, `powerPreference` `high-performance`)
- Navigateur : Chromium 153.0.8010.12 de Playwright, avec interface, `--use-angle=d3d11`, fenêtre 1600 × 900, facteur d'échelle 1,5 (canvas de 2400 px de large, lu sur la page)
- Fréquence d'affichage mesurée sur une page vide : 223 images/s

Chaque case donne les 3 chargements dans l'ordre (le premier est un démarrage à froid du navigateur), séparés par « · ».

| Mesure | Jour | Coucher | Nuit | Cible |
|---|---|---|---|---|
| Images/s, vue d'ensemble | 103 · 100 · 97 | 100 · 102 · 100 | 102 · 101 · 101 | ≥ 60 |
| Images/s, vue présentation | 106 · 105 · 110 | 108 · 104 · 112 | 108 · 109 · 112 | ≥ 60 |
| Bureau affiché après | 2148 ms · 1284 ms · 1171 ms | 2114 ms · 1243 ms · 1085 ms | 1923 ms · 1285 ms · 1234 ms | < 3000 ms |
| Décor chargé après | 3202 ms · 1634 ms · 1522 ms | 2943 ms · 1592 ms · 1435 ms | 2725 ms · 1644 ms · 1587 ms | < 8000 ms au 1er chargement |
| Niveau de qualité autour des mesures | high · high · high | high · high · high | high · high · high | jamais `low` |
| JS initial (gzip) | 0,44 Mo | | | ≤ 1,50 Mo |

## Critère 5 de la spec

- Au moins 60 images/s dans chaque vue et chaque phase : oui.
- Le niveau de qualité ne tombe pas à `low` : oui.
- Bureau affiché en moins de 3 s : oui.
- Tous les décors chargés en moins de 8 s au premier chargement : oui.
- JS initial ≤ 1,50 Mo : oui.

## Méthode

- `node scripts/perf.mjs --runs 3` après `npm run build` ; le script vérifie que le serveur envoie le `dist/index.html` de ce dossier. Un navigateur jetable mesure d'abord la fréquence d'affichage, puis un navigateur neuf par phase fait 3 chargements, chacun dans un contexte neuf ; la phase est forcée par `?phase=`.
- Bureau affiché : `performance.now()` (depuis le début de la navigation) à la première modification du DOM où `[data-testid="stage"]` porte `data-scene-ready="true"`, où le canvas existe et où l'écran de chargement a disparu (`MutationObserver` installé avant les scripts de la page, débranché dès que les deux instants sont relevés).
- Décor chargé : même horloge, à la première modification du DOM où `data-decor-ready="true"` (plantes, livres, cadres, suspensions, caisson et table basse affichés, ou omis après un échec).
- Images/s : nombre de `requestAnimationFrame` pendant 5 s, 3 s après le chargement du décor (vue d'ensemble ; après les 60 s d'attente s'il n'est pas prêt), puis 3 s après un défilement à la molette vers la vue présentation. Rien n'est mesuré quand le site passe en mode lecture.
- Niveau de qualité : attribut `data-quality` de la scène (réglé par le `PerformanceMonitor` de drei), relevé juste avant et juste après chacune des deux mesures d'images/s ; la case donne les niveaux successifs, sans répétition (un seul niveau quand il n'a pas changé).
- Moteur WebGL : chaîne `UNMASKED_RENDERER_WEBGL` du contexte WebGL 2 du canvas de la scène, celui de l'application ; largeur du canvas lue sur la page à la fin de chaque chargement.
- Premier plan : le script met chaque page au premier plan (`page.bringToFront()`), sans pouvoir vérifier que la fenêtre y reste : Playwright émule le focus (`document.hasFocus()` vaut toujours vrai) et garde le rendu des fenêtres masquées (`--disable-backgrounding-occluded-windows`). Ces mesures ne valent donc que prises sur secteur, sans autre charge, le navigateur laissé au premier plan sans que personne ne touche à la machine.
- JS initial : sortie de `scripts/check-bundle.mjs` (gzip du chunk d'entrée et de ses imports statiques, en Mio).
- Les mesures du premier bureau (sous-projet 1, 2026-09-30, commit f2336b4) restent dans l'historique git de ce fichier.
