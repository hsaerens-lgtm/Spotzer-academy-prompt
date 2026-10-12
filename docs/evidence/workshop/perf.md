# Mesures — atelier (sous-projet 2)

- Date : 2026-10-07
- Machine : ASUS ROG Zephyrus G16 (GA605KP), AMD Ryzen AI 7 350, 31 Go de RAM, Windows 11 Home ; carte graphique AMD Radeon 860M (intégrée), celle que le navigateur utilise (chaîne du moteur WebGL : « ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11) »)
- Navigateur : Chromium 153.0.8010.12 de Playwright 1.63.0, dans une vraie fenêtre (avec interface), lancé avec `--use-angle=d3d11` ; fenêtre 1600 × 900, DPR 1,5 (le facteur d'échelle de Windows) ; canvas du chantier de 846 × 456 px (564 × 304 px CSS)

| Mesure | Valeur | Cible |
|---|---|---|
| Images/s pendant l'animation du chantier | 240 (239,8 à 240,2) ; 232 la 1re fois (231,6 à 232), chargement de Rapier compris | 60 |
| Réponse affichée après Build & test, 1re fois (Rapier chargé) | 5,49 s (5 484 à 5 488 ms, trois démarrages à froid) | — |
| Réponse affichée après Build & test, fois suivantes | 5,11 s (5 106 à 5 112 ms) | ≈ 5 s d'animation |
| JS initial du site (gzip) | 0,40 Mo | ≤ 1,50 Mo |
| Chunk Rapier (gzip, chargé à la demande) | 1,57 Mo (1 644 230 octets ; 4,13 Mo non compressé) | — |

- 240 images/s est le plafond de l'écran (240 Hz ; 240 `requestAnimationFrame` par seconde mesurés page au repos) : la carte graphique intégrée reste très au-dessus de la cible de 60 images/s pendant toute l'animation.
- La 1re fois, l'image la plus longue dure 58 à 63 ms (compilation du WASM de Rapier) ; ensuite 5 à 12 ms.
- Un bâtiment qui s'effondre (blocs Task et Format seuls, `COLLAPSED · VAGUE`) donne les mêmes valeurs : 231,8 images/s et 5 485 ms la 1re fois, puis 240,4 et 240 images/s, 5 108 et 5 106 ms.
- Correcteur avec la vraie IA (critère 5 de la spec, rapport en ≤ 15 s environ) : non mesuré. Ce poste n'a pas de clé OpenAI, les parcours de test n'appellent jamais OpenAI, et l'essai réel avec la clé se fait à la demande du propriétaire (spec, §7).

## Méthode

- Mesures faites le 2026-10-07 sur le PC de référence, par l'implémenteur de la tâche 16, avec la version de production du commit qui contient ce fichier : `npm run build`, puis `npx vite preview --port 4180 --strictPort`.
- Le navigateur est piloté par un script Playwright avec interface (`headless: false`). Il ouvre `#/workshop` et remplit la mission 1 avec son prompt d'exemple *Excellent* (Role, Task, Context, Format).
- Pour chaque essai, dans la page :
  - un clic sur *Build & test* ;
  - le script du plan compte les `requestAnimationFrame` pendant 5 s à partir du clic, comme pour le bureau (`docs/evidence/office/perf.md`). La réponse arrive après 5,1 s, donc ces 5 s tombent entièrement dans l'animation ;
  - le temps jusqu'à l'apparition du niveau (`HOLDS · EXCELLENT`) dans `AI_OUTPUT.TXT`, l'animation comprise. La réponse n'apparaît qu'à la fin du chantier.
- Entre deux essais, une espace ajoutée au bloc Format change le prompt, et le *Build & test* suivant rejoue toute l'animation.
- 1re fois : trois démarrages à froid. Chaque démarrage lance un navigateur neuf, avec un profil et un cache vides : le chunk du chantier (`BuilderScene3D`, 13,8 Ko gzip) et Rapier se chargent au premier *Build & test*. Fois suivantes : les essais 2 à 4 du premier démarrage et l'essai 2 des deux autres.
- JS initial : `npm run budget` (« Initial JS (gzip): 0.40 MB »). Chunk Rapier : `dist/assets/rapier-*.js`, compressé avec le gzip de Node comme dans `npm run budget`. Vite affiche 1 669 kB pour ce chunk, avec ses propres réglages.
