# Mesures — bureau (sous-projet 1)

- Date : 2026-09-30
- Machine : ASUS ROG Zephyrus G16 (GA605KP), AMD Ryzen AI 7 350, 31 Go de RAM, Windows 11 ; carte graphique AMD Radeon 860M (intégrée, celle que le navigateur utilise par défaut)
- Navigateur : Chromium 153.0.8010.12 de Playwright 1.63.0, dans une vraie fenêtre (avec interface), fenêtre 1600 × 900, facteur d'échelle 1,5 (canvas de 2400 px de large)

| Mesure | Production | Dev | Cible |
|---|---|---|---|
| Images/s, vue d'ensemble | 240 | 240 | 60 |
| Images/s, vue présentation | 238 | 237 | 60 |
| Bureau affiché après, 1er chargement | 1554 ms | 1879 ms | < 3000 ms |
| Bureau affiché après, 2e chargement | 1356 ms | 1573 ms | < 3000 ms |
| Bureau affiché après, 3e chargement | 1401 ms | 1651 ms | < 3000 ms |
| JS initial (gzip) | 0,39 Mo | — | ≤ 1,50 Mo |

- 240 images/s est le plafond de l'écran (240 Hz) : la carte graphique intégrée reste très au-dessus de la cible de 60 images/s, en qualité maximale.
- Un essai antérieur avec interface, au commit a2e3570, avait donné 228 et 219 images/s en production.

## Méthode

- Mesures faites par le contrôleur le 2026-09-30 au commit f2336b4 ; la version de production est le `npm run build` de ce commit.
- Production : `vite preview` de `npm run build`. Dev : `npm run dev`.
- Toutes les valeurs viennent de la Radeon 860M, via ANGLE Direct3D11 (chaîne du moteur WebGL : « ANGLE (AMD, AMD Radeon(TM) 860M Graphics …, D3D11) »). La NVIDIA GeForce RTX 5070 Laptop est présente sur la machine mais n'a pas servi à ces mesures.
- Images/s : le script du plan, qui compte les `requestAnimationFrame` pendant 5 s. Il a tourné 3 s après l'apparition du bureau (vue d'ensemble), puis de nouveau 3 s après un défilement à la molette vers la vue présentation.
- Bureau affiché après : `performance.now()` au moment où le canvas existe et où l'écran de chargement a disparu, sondé toutes les 10 ms. Trois chargements de page, chacun dans un contexte de navigateur neuf du même navigateur ; le premier est le démarrage à froid.
- Fréquence de l'écran : 240 Hz. Les bornes de `PerformanceMonitor` (drei) en découlent : `refreshrate > 100 ? [60, 100] : [40, 60]`, donc [60, 100] ici.

## Niveau de qualité atteint

- Niveau `high` (dpr 1,5, ombres dynamiques) à la fin de chaque mesure.
- `PerformanceMonitor` n'a jamais signalé de baisse : `reduceQuality` est resté à `{ level: 'high', changes: 0 }`.

## Correctif de qualité adaptative (a2e3570)

- Avant a2e3570, la qualité adaptative retombait au niveau `low` environ 10 s après le démarrage sur les machines rapides.
- Cause : le `PerformanceMonitor` de drei compte chaque hausse comme une oscillation, même quand la qualité est déjà `high` ; avec `flipflops={3}`, il appelait alors `onFallback`.
- Observé dans le navigateur intégré de Claude : 120 images/s, qualité `low`, canvas à dpr 1.
- Correctif : `reduceQuality` ne compte que les vrais changements de niveau, et ne se fixe sur `low` qu'après plus de 3 d'entre eux.
