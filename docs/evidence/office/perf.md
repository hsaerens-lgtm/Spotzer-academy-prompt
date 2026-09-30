# Mesures — bureau (sous-projet 1)

- Date : 2026-09-30
- Machine : ASUS ROG Zephyrus G16 (GA605KP), AMD Ryzen AI 7 350, 31 Go de RAM, Windows 11 ; carte graphique AMD Radeon 860M (intégrée, utilisée par défaut par le navigateur)
- Navigateur : Chromium de Playwright 153.0.8010.12 (sans interface, GPU matériel via ANGLE D3D11), fenêtre 1600 × 900, facteur d'échelle 1,5

| Mesure | Valeur | Cible |
|---|---|---|
| Images/s, vue d'ensemble | 54 | 60 |
| Images/s, vue présentation | 52 | 60 |
| Bureau affiché après | 383–408 ms (cache chaud), 722 ms (premier chargement) | < 3000 ms |
| JS initial (gzip) | 0,39 Mo | ≤ 1,50 Mo |

Valeurs du tableau : Radeon 860M, version de production (`npm run build`, servie par `vite preview`).

## Autres mesures

- Radeon 860M, développement (`npm run dev`) : 52 images/s en vue d'ensemble, 49 en vue présentation (juste sous 50), bureau affiché après 693–697 ms (cache chaud) et 1237 ms (premier chargement).
- RTX 5070 Laptop, production (navigateur forcé sur le GPU performant) : 60 images/s dans les deux vues, bureau affiché après 393 ms (cache chaud) et 3239 ms au premier chargement, réveil de la carte discrète compris.
- JS initial identique sur la RTX 5070 : 0,39 Mo gzip.

## Méthode

- Mesures du plan : comptage des `requestAnimationFrame` sur 5 s, puis délai jusqu'à l'affichage du bureau (canvas présent, écran de chargement disparu).
- Le navigateur intégré était masqué, donc le rendu y était en pause : les mesures ont été faites avec le Chromium de Playwright.
- Chromium sans interface plafonne `requestAnimationFrame` à 60 Hz : 60 est le maximum mesurable.
- Mesuré au commit a2e3570 ; les changements de la tâche 21 (API de test, pont) n'affectent pas le rendu.

## Niveau de qualité atteint

- Niveau `high` (dpr 1,5, soit un canvas de 2400 px, ombres dynamiques) dans toutes les mesures.
- `PerformanceMonitor` n'a jamais signalé de baisse : à 60 Hz, sa borne basse est de 40 images/s.
- Sur le GPU intégré, la vue présentation en développement est à 49 images/s, juste sous le seuil de 50 ; en production elle reste à 52.

## Correctif de qualité adaptative (a2e3570)

- Avant a2e3570, la qualité adaptative retombait au niveau `low` après environ 10 s sur les machines rapides.
- Cause : le `PerformanceMonitor` de drei compte chaque hausse comme une oscillation.
- Cas mesuré : navigateur intégré, écran 120 Hz, 120 images/s, qualité `low`.
- Correctif : seuls les vrais changements de niveau sont comptés désormais (`reduceQuality`).
