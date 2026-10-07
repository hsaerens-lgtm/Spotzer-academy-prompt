# Athena Prompt Academy — Refonte visuelle du bureau — Design

- Date : 2026-10-06
- Statut : section « La pièce » validée par le propriétaire en conversation (2026-10-06) ; sections 4 à 10 rédigées avec les recommandations du brainstorm, à valider à la relecture de cette spec.
- S'appuie sur : `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md` (spec 1). Cette spec remplace ses parties visuelles (pièce, matériaux, lumière) ; les parcours, l'interface DOM, le dialogue, les chapitres et le mode lecture de la spec 1 restent valables.
- Référence de qualité : le bureau de Horn.os (`github.com/hsaerens-lgtm/Horn.os`, projet du propriétaire). C'est le **niveau minimal** à atteindre.

## 1. Objectif et critères de réussite

Refaire entièrement le rendu du bureau 3D : une salle de réunion d'agence moderne, réaliste et chaleureuse, avec des textures sur tous les objets, des plantes partout, une grande baie vitrée sur une ville 3D et un cycle jour → coucher → nuit à lumière dynamique. La disposition de la salle et tous les parcours de la spec 1 sont conservés.

Critères de réussite :

1. **Tout est texturé.** Chaque surface visible du bureau utilise un matériau PBR avec au moins une carte de couleur et une carte de normales ou de rugosité, ou un modèle CC0 avec ses propres textures. Seuls les matériaux émissifs, le verre, les écrans et le ciel en sont dispensés. Un audit des matériaux exposé par l'API de test le vérifie (§9).
2. **Cycle de lumière.**
   - L'heure locale choisit la phase à l'arrivée : jour 07:00–17:59, coucher 18:00–20:59, nuit 21:00–06:59.
   - Un clic sur l'horloge murale, ou le bouton « Time of day » du HUD, passe à la phase suivante. La transition dure 2,5 s et l'on voit le soleil bouger.
   - `?phase=day|sunset|night` force une phase.
   - En mode « réduire les animations », le changement est instantané.
3. **La ville se voit.** La vue d'ensemble garde un cadrage proche de l'actuel, où le coin rétro et le laptop restent visibles, avec la baie vitrée sur la plus grande part d'image compatible, environ 19 %. Le seuil exact est mesuré et fixé dans le plan. La ville se découvre en se déplaçant le long du rail et apparaît derrière Ada dans la vue présentation. (Amendement du 2026-10-07, choix B du propriétaire : on peut bouger la caméra, il n'est donc pas nécessaire de sacrifier le coin rétro pour viser un quart de l'image.)
4. **Les parcours de la spec 1 passent toujours.** Tous les tests e2e existants restent verts : survol et clic du laptop, télé, défilement du rail, texte de l'écran mural, format 1280 × 600.
5. **Performances sur le PC de référence** (Radeon 860M intégrée, 1600 × 900, échelle 1,5) :
   - au moins 60 images/s en vue d'ensemble et en vue présentation, dans chaque phase ;
   - le niveau de qualité ne doit pas tomber à `low` ;
   - bureau affiché en moins de 3 s (production) ;
   - tous les décors chargés en moins de 8 s au premier chargement (production locale).
6. **Budget et hébergement.**
   - Le JS initial reste ≤ 1,5 Mo gzip.
   - Tous les assets sont hébergés par le site.
   - Aucun appel à un CDN à l'exécution : ni décodeur Draco de gstatic, ni environnement drei de githack.
7. **Licences.** Uniquement des assets CC0 (Poly Haven, ambientCG), plus le code du propriétaire repris de Horn.os. Chaque fichier sous `public/assets/` figure dans `public/assets/CREDITS.md` avec sa source, sa licence et sa taille ; un test le vérifie.
8. **Preuves.** Captures des 3 phases × 2 vues (vue d'ensemble, vue présentation). Le propriétaire juge le niveau Horn.os sur ces captures.

## 2. Décisions prises au brainstorm

| Question | Décision |
|---|---|
| Ambiance | Cycle jour → coucher → nuit, lumière dynamique (C) |
| Pièce | Même salle de réunion et même disposition, tout refait en qualité pro (A) |
| Dehors | Ville 3D (base `city.js` de Horn.os, améliorée) et dôme de ciel qui suit le soleil (A) |
| Pilotage du cycle | Heure locale à l'arrivée, horloge murale cliquable, `?phase=` (A) |
| Ada | Même forme et mêmes mouvements, matériaux plus propres (A) |
| Direction artistique | Agence moderne et chaleureuse, tons moyens, rien d'éblouissant ; charte Athena par touches (A) |
| Approche technique | Temps réel PBR, Horn.os porté et amélioré, sans post-traitement (A) |
| Assets | CC0 uniquement, hébergés par le site, listés avec source, poids et licence |
| Branche | `feat/office-redesign`, dans son propre worktree, en parallèle de l'atelier |

Le ciel est le dôme de Horn.os (dégradé, disque solaire, étoiles, nuages) et non le `Sky` de three.js : ce dernier n'a ni nuit ni étoiles et il est surexposé à l'exposition d'un intérieur.

## 3. La pièce (validée)

**Plan conservé.** La salle garde ses dimensions (10 × 12 m, 3,20 m sous plafond ; x de −5 à 5, z de −6 à 6) et chaque élément interactif reste à sa place, à quelques centimètres près :
- la table au centre avec 8 chaises et le laptop au bout ;
- l'écran de présentation au fond ;
- Ada à gauche de l'écran ;
- le coin télé et console à droite.

Les noms des groupes de la scène sont conservés : `laptop`, `tv`, `ada`, `screen`, `table`, `sideboard`, `lamp`, `cabinet`, `retroConsole`, `sofa`, `logo`. Le mode réglage (`?tune`) continue de fonctionner.

**Baie vitrée.**
- Le mur de gauche (x = −5) devient une façade vitrée du sol au plafond, de l'angle du fond jusqu'au-delà du cadrage de la vue d'ensemble.
- Montants en aluminium noir tous les 1,2 m environ, une traverse basse, et une banquette basse le long de la vitre avec des plantes.
- La vitre tourne sur environ 1,6 m sur le mur du fond, entre l'angle et l'écran, derrière Ada.
- Le verre est une vitre fine, légèrement réfléchissante (opacité faible, reflets de l'environnement, sans transmission physique).

**Caméra.**
- Le rail garde ses trois points : vue d'ensemble, intermédiaire, présentation.
- Le point de la vue d'ensemble est ajusté pour montrer le plus de façade possible sans perdre le coin rétro (télé et console) ni le laptop (voir critère 3).
- La vue présentation reste la même ; la ville y apparaît derrière Ada grâce au retour vitré.
- Les vols vers le laptop et la télé sont réajustés si les modèles changent de taille.

**Murs, sol, plafond.**
- Murs en enduit grège, ton moyen et chaud.
- Derrière l'écran, un mur de tasseaux de chêne verticaux.
- Parquet en chêne en lames ; grand tapis en laine sous la table.
- Plafond avec deux lignes de lumière encastrées et trois suspensions en verre au-dessus de la table.
- Plinthes et épaisseur de mur visibles au bord de la baie.

**Mobilier, entièrement texturé.**

| Élément | Réalisation |
|---|---|
| Table | En code : plateau en chêne aux bords arrondis (forme « racetrack »), deux pieds en acier noir. Même encombrement que la table actuelle. |
| 8 chaises | En code : coque garnie de tissu, piétement 4 branches en métal noir, géométrie partagée (instances). |
| 6 micros | En code : base et col de cygne en métal brossé, bague lime. |
| Laptop | En code : aluminium, écran actuel conservé ; reste dégagé dans la vue d'ensemble. |
| Écran mural | Écran DOM actuel conservé, cadre refait (bord noir fin). |
| Buffet sous l'écran | Modèle Poly Haven `modern_wooden_cabinet`. |
| Lampe sur le buffet | En code (lampe moderne), avec sa propre lumière. |
| Caisson côté droit | Modèle Poly Haven `drawer_cabinet`. |
| Coin rétro | Télé cathodique Poly Haven `television_02` et console actuelle retexturée ; l'écran animé « press start » est conservé et recalé sur le modèle. |
| Canapé et table basse | Canapé en code (tissu, piétement fin) ; table basse Poly Haven `modern_coffee_table_01`. |
| Étagères murales | En code, avec des livres (générateur `books.js` de Horn.os) et des petites plantes. |
| Cadres | Poly Haven `hanging_picture_frame_01`, affiches aux couleurs Athena. |
| Horloge murale | Poly Haven `wall_clock`, aiguilles animées, cliquable. |
| Suspensions | Poly Haven `modern_ceiling_lamp_01` × 3. |
| Plantes | Générateur de plantes de Horn.os (monstera, palmier, fougère, pothos, succulentes, plantes suspendues) et modèles Poly Haven pour les grandes plantes (`potted_plant_01`, `pachira_aquatica_01`) et les pots (`ceramic_vase_01`, `ceramic_vase_04`, `planter_pot_clay`). |

**Charte Athena.**
- Le logo devient une enseigne rétroéclairée sur le mur du fond : discrète le jour, lumineuse la nuit.
- Accents lime : coussins, bagues des micros, anneau d'Ada, voyants.
- Couleurs de marque uniquement depuis `src/core/brand.ts`.

**Contrainte.** Aucun objet ne masque le laptop dans la vue d'ensemble : son point central reste survolable (test e2e existant), et un test de plan vérifie qu'aucune boîte de décor ne coupe le rayon caméra → laptop.

## 4. Lumière et cycle

**Module de phase** (pur, testé) :
- `Phase = 'day' | 'sunset' | 'night'` ;
- `phaseForTime(date)` applique les bornes du §1 ;
- `PRESETS[phase]` et `mixPreset(a, b, t)` repris de `daycycle.js` de Horn.os (données et interpolation) ;
- `nextPhase(phase)`.

L'état global gagne :
- `phase` ;
- une transition en cours `{ from, to, startedAt }` ;
- `advancePhase()`.

`?phase=` est lu au démarrage et n'est pas réécrit dans l'URL.

**Éclairage par phase.** Les valeurs de départ sont celles de Horn.os, réglées pour une salle de 10 × 12 m ; les valeurs finales sont consignées dans le code.

| | Jour | Coucher | Nuit |
|---|---|---|---|
| Soleil / lune (directionnelle, seule à projeter des ombres, entre par la baie, rasante) | blanc chaud, fort | orange, très bas, ombres longues | bleu froid, faible |
| Ciel (hémisphère) | clair | chaud | très faible |
| Environnement (construit dans la scène avec `Lightformer`, aucun fichier HDR externe) | 0,32 | 0,18 | 0,05 |
| Lumière de baie (`RectAreaLight` à la taille de la façade, sans ombre) | froide, forte | orange | bleue, faible |
| Lignes de plafond et suspensions | éteintes | allumées faiblement | allumées |
| Lampe du buffet | éteinte | allumée | allumée |
| Enseigne Athena | discrète | moyenne | lumineuse |
| Lueur de l'écran mural | faible | moyenne | marquée |
| Exposition (ACES) | 1,0 | 1,0 | 1,15 |

**Règles reprises de Horn.os, mesurées là-bas :**
- lumière latérale ;
- une seule lumière projette des ombres ;
- peu de lumière de remplissage ;
- émissifs au-dessus de 1,0 ;
- pas de surfaces coplanaires.

**Ombres.** Carte de 2048 px en qualité `high`, 1024 en `medium`, aucune en `low`. Le cadre d'ombre est ajusté à la salle.

**Dehors.**
- Dôme de ciel (dégradé, disque solaire, étoiles la nuit, nuages) et ville instanciée de Horn.os, portés en R3F.
- Façades dessinées dans le shader, fenêtres qui s'allument la nuit chacune à son heure, rue et éclairage public.
- Brouillard de la couleur de l'horizon pour fondre la ville au loin.
- Le `far` de la caméra est relevé pour contenir le dôme.
- Le soleil du dôme suit la directionnelle.

**Transitions.**
- Une seule valeur `t` (0 → 1 sur 2,5 s, adoucie) pilote, par `mixPreset`, toutes les lumières, l'exposition, les couleurs du ciel et du brouillard et la position du soleil.
- Les aiguilles de l'horloge tournent pendant la transition.
- En mode « réduire les animations » ou en mode lecture, le passage est instantané.

## 5. Matériaux, assets et chaîne de préparation

**Sources** (toutes CC0) :
- Poly Haven : modèles et textures ;
- ambientCG : textures manquantes, par exemple le métal noir et les tissus unis ;
- le code de Horn.os (propriétaire) : `plants.js`, `hanging.js`, `books.js`, `merge.js`, `shapes.js`, `city.js`, `daycycle.js`.

**Textures** (couleur + normales + ARM ou rugosité, 1k ; 2k pour le sol et les murs) :

| Surface | Texture de départ |
|---|---|
| Sol | Poly Haven `plank_flooring_04` |
| Murs | Poly Haven `beige_wall_001`, teintée grège |
| Tasseaux, plateau de table, étagères | Poly Haven `oak_veneer_05` |
| Noyer (lampe, détails) | Poly Haven `american_walnut_veneer` (déjà dans Horn.os) |
| Tissu des chaises et du canapé | ambientCG `Fabric036` ou `Fabric039` (unis) |
| Tapis | ambientCG `Carpet016` |
| Métal noir | ambientCG `Metal046A` |
| Métal brossé (micros, laptop) | ambientCG `Metal027` |

Le choix final entre deux variantes proches se fait sur captures, sans changer la liste des sources.

**Chaîne de préparation**, outils de développement uniquement, jamais dans le site :
- `scripts/assets/manifest.json` liste chaque asset : identifiant, source, URL de l'API, licence, résolution, usage.
- `scripts/assets/fetch.mjs` télécharge les fichiers listés dans `assets-src/` (ignoré par git), avec un contrôle de taille.
- `scripts/assets/build.mjs` (glTF-Transform) prépare les fichiers :
  - textures réduites à la résolution du manifeste et converties en WebP ;
  - géométrie compressée en meshopt ;
  - géométrie simplifiée pour les modèles trop lourds (les grandes plantes Poly Haven font 70 à 96 k triangles) ;
  - dédoublonnage et élagage.
  
  Il écrit `public/assets/models/*.glb` et `public/assets/textures/*.webp` et génère `public/assets/CREDITS.md`.
- Les fichiers produits sont commités : le build du site n'a pas besoin du réseau.
- Nouvelles dépendances de développement : `@gltf-transform/core`, `@gltf-transform/functions`, `@gltf-transform/extensions`, `meshoptimizer` et `sharp`, versions exactes.

**Budgets d'assets** (vérifiés par un test) :
- `public/assets` ≤ 18 Mo au total ;
- assets nécessaires à la première image ≤ 6 Mo ;
- aucun fichier ≥ 3 Mo.

**À l'exécution.**
- Les modèles sont chargés par `useGLTF` avec meshopt, sans Draco.
- Les textures passent par un chargeur unique qui règle l'espace colorimétrique, l'anisotropie et la répétition.
- Tous les chemins passent par `publicUrl()`.
- `materials.ts` devient une fabrique de matériaux PBR à partir de jeux de textures.
- Les modèles GLB passent par le registre `objects.tsx`, qui gagne l'activation des ombres et le contour de survol pour les modèles interactifs.

## 6. Ada, écran mural et interactions

**Ada.**
- La géométrie, le visage, les expressions et les mouvements ne changent pas, et leurs tests non plus.
- Matériaux :
  - coque en porcelaine laquée (vernis `clearcoat`, légère variation de rugosité par une petite texture de bruit) qui reflète l'environnement de la phase ;
  - visière en verre noir laqué, avec le visage émissif inchangé ;
  - ceinture et anneau lime légèrement lumineux ;
  - halo conservé.

**Écran mural.** L'écran reste une page HTML derrière le canvas, avec son « trou » transparent. C'est la raison de l'absence de post-traitement. Le cadre est refait et la lueur de l'écran suit la phase.

**Horloge.**
- Nouvel objet interactif `clock`, avec l'étiquette « Change the time of day » (`ui.json`). Un clic appelle `advancePhase()`.
- Les aiguilles indiquent une heure représentative de la phase (14:00, 19:30, 23:00) et tournent pendant les transitions.
- Pour le clavier, un bouton « Time of day » dans le HUD fait la même chose.
- L'API de test gagne `setPhase(phase)` et `phase` dans `state()`.

**Télé.** Le modèle `television_02` remplace la télé en code. L'écran animé « press start » et le bruit pendant le vol sont recalés sur la vitre du modèle, et le contour de survol est conservé.

## 7. Chargement, performances et qualité

**Deux étages de chargement.**
1. Le *socle* : pièce, baie, ciel, ville, table, chaises, écran, Ada, laptop, télé, buffet. Il conditionne `sceneReady` et la disparition de l'écran de chargement. Les shaders sont compilés avant la première image (`compileAsync` et une image de chauffe, comme Horn.os).
2. Le *décor* : plantes, livres, cadres, suspensions, caisson, table basse. Il se charge ensuite dans sa propre frontière `Suspense`, sans bloquer.

**Niveaux de qualité.** Le moniteur de performances existant pilote le niveau.

| Niveau | Effet |
|---|---|
| `high` | dpr ≤ 1,5 ; carte d'ombre 2048 ; toutes les lumières ; plantes animées |
| `medium` | dpr 1 ; carte d'ombre 1024 ; lumières d'appoint réduites |
| `low` | dpr 1 ; pas d'ombre dynamique ; plantes immobiles ; fenêtres de la ville figées |

**Contrôles.**
- Le JS du ciel, de la ville et des plantes entre dans le chunk initial, qui reste ≤ 1,5 Mo gzip.
- Les tests e2e tournent en rendu logiciel. Le socle doit être prêt en moins de 60 s dans ces conditions ; le décor n'est pas attendu par les tests de parcours.

## 8. Robustesse

- **Échec d'un asset du décor** : l'objet est omis, avec un avertissement en console en développement. Le reste de la scène continue.
- **Échec du socle** : chemin existant de la spec 1, c'est-à-dire bascule en mode lecture avec le bandeau « 3D stopped working ».
- **Perte du contexte WebGL** : inchangé.
- **« Réduire les animations »** : pas de transition animée, feuilles et nuages immobiles, Ada immobile comme aujourd'hui.
- **Petits écrans et mode lecture** : inchangés. Le mode lecture ne charge aucun asset 3D.

## 9. Tests et preuves

**Unitaires :**
- `phaseForTime` aux bornes (06:59, 07:00, 17:59, 18:00, 20:59, 21:00) ;
- `mixPreset` aux extrémités et au milieu ;
- `PRESETS` complets pour chaque phase ;
- `nextPhase` cyclique ;
- manifeste d'assets valide ;
- chaque fichier de `public/assets` présent dans `CREDITS.md` avec la licence CC0 ;
- budgets d'assets ;
- tests de plan mis à jour : baie, chaises, dégagement de l'écran, rayon caméra → laptop libre.

**e2e :**
- tous les parcours de la spec 1 ;
- clic sur l'horloge → la phase change (état et paramètres de lumière via l'API de test) ;
- bouton « Time of day » au clavier ;
- `?phase=night` → phase de nuit ;
- audit des matériaux : la liste des maillages visibles sans carte de texture est vide en dehors d'une liste autorisée (émissifs, verre, écrans, ciel).

**Preuves :**
- `docs/evidence/office/` gagne 6 captures (3 phases × vue d'ensemble et vue présentation) ;
- les captures existantes sont régénérées ;
- `perf.md` est remesuré sur le PC de référence pour chaque phase, sans valeur inventée : une case non mesurable est marquée « non mesuré » avec la raison.

## 10. Hors périmètre

- Le faux PC de l'atelier, le donjon, d'autres pièces.
- Le post-traitement (bloom, occlusion ambiante) et l'éclairage précalculé.
- La synchronisation des aiguilles avec l'heure réelle en dehors des phases.
- Les mobiles.

## 11. Coexistence avec l'atelier

- La refonte avance sur `feat/office-redesign`, dans le worktree `C:\Users\Horn S\Desktop\athena-office-redesign`, en parallèle de `feat/prompt-workshop`.
- Fichiers susceptibles de se chevaucher à la fusion :
  - `tests/e2e/office.spec.ts` et `docs/evidence/office/*` (la tâche 16 de l'atelier y touche) ;
  - `src/ui/Hud.tsx` (l'atelier masque le HUD dans sa zone ; la refonte y ajoute le bouton « Time of day ») ;
  - `content/en/ui.json` ;
  - `src/app/store.ts`.
- La deuxième branche fusionnée résout ces conflits et régénère les captures.
- Aucune fusion dans `main` sans l'accord du propriétaire.
