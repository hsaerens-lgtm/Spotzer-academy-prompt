# Donjon : mesure de performance

- Date : 2026-10-15
- Build de production servi par `vite preview`, Chromium de Playwright avec interface, `--use-angle=d3d11`, fenêtre 1600 × 900, facteur d'échelle 1.5 (canvas de 1600 px de large).
- GPU et écran : NVIDIA GeForce RTX 5070 Laptop GPU, non mesuré (pas d'écran) ; AMD Radeon(TM) 860M Graphics, 240 Hz
- Scénario : étage 1, 10 s par mesure en tournant d'un quart de tour toutes les 500 ms ; 3 mesures, chacune dans un contexte neuf.

| Mesure | Valeur | Objectif |
|---|---|---|
| Images/s (médiane de 3) | 240.1 | 60 |
| Images/s (plus basse) | 240.0 | 60 |
| Morceau de la zone donjon (gzip) | 44 Kio | chargé à la demande |
| Vue 3D et post-traitement (gzip) | 22 Kio | chargé à la demande |
| Générateur de PDF (gzip) | 493 Kio | chargé au clic sur Download PDF |

La fréquence mesurée est plafonnée par celle de l'écran (requestAnimationFrame) : une valeur égale à la fréquence de l'écran veut dire que le donjon suit sans perdre d'image.
