# Athena Prompt Academy — Spec 3 : le donjon

- **Date** : 2026-10-15
- **Statut** : implémentée (2026-10-15)
- **Périmètre** : sous-projet 3 sur 3 (zone « donjon », accessible par la télé et la console rétro du bureau)
- **S'appuie sur** : spec 1 — `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md` (socle, bureau, Ada, sujets, progression) et spec 2 — `docs/superpowers/specs/2026-10-06-athena-prompt-academy-workshop-design.md` (atelier, moteur d'évaluation des prompts). Tout ce qu'elles fixent reste valable sauf mention contraire au §2.

---

## 1. Objectif

Le donjon est l'épreuve finale de l'académie. Le bureau enseigne (13 sujets), l'atelier fait pratiquer (6 missions) ; le donjon **vérifie** ce qui a été appris et délivre un **certificat PDF**.

C'est un **dungeon crawler rétro à la première personne**, case par case, rendu en pixel art 3D derrière un filtre de vieille console (style « années 90 » original, sans copie d'une console existante). Des **gardiens** barrent les couloirs et posent des questions ; un **boss** final demande d'écrire un vrai prompt, noté hors ligne par le moteur de l'atelier. Trois erreurs, et le joueur est **éjecté** vers le bureau, où Ada lui dit quoi revoir.

Deux étages :

1. **Étage 1 — « The Dungeon »** : 13 gardiens, un par sujet du bureau, puis le boss « The Vague Prompt ». Pour tous les publics.
2. **Étage 2 — « The Deep »** : débloqué après la réussite de l'étage 1. Très difficile, pour les super-utilisateurs et les développeurs : 15 gardiens sur 5 domaines techniques (sécurité, conformité, monitoring, prompting avancé, infrastructure), puis un boss qui demande de durcir un system prompt. Certificat « Expert » séparé.

### Public et contraintes

Identiques aux specs 1 et 2 : usage interne, PC uniquement (≥ 1280 × 720, mode compact jusqu'à 1280 × 600), anglais d'abord (multilingue prévu), charte Athena. Le donjon fonctionne **entièrement en fichiers statiques** : aucun appel serveur, aucune IA en ligne.

### Critères de succès (sous-projet 3)

1. La télé du bureau (clic 3D ou bouton « The dungeon » de la barre d'accueil) mène à l'écran titre du donjon ; « Back to the office » ramène à la vue d'ensemble. Le bouton de la barre d'accueil indique l'étage réussi (« The dungeon · passed »).
2. L'étage 1 se joue de bout en bout au clavier et à la souris : déplacement case par case, 13 gardiens (un par sujet, question tirée au hasard), boss noté par le moteur de l'atelier, victoire ou éjection.
3. Trois erreurs à l'étage 1 éjectent vers le bureau ; Ada y liste les sujets manqués avec un bouton qui ouvre chacun.
4. La victoire affiche le score sur 100, enregistre `passed` et le meilleur score, et propose le certificat PDF : nom saisi par la personne (jamais enregistré), date, score, sujets couverts, charte Athena. Le PDF s'ouvre dans un lecteur standard.
5. L'étage 2 n'est accessible qu'après la réussite de l'étage 1 ; il applique ses règles propres (2 cœurs, questions à réponses multiples, corrections à la fin) et délivre un certificat « Expert ».
6. Le rendu est en pixel art (basse résolution, palette Athena tramée, scanlines) et tient 60 images/s sur le PC de référence (GPU intégré) ; mesure fournie.
7. Sans WebGL, en mode lecture ou si le rendu 3D échoue, le donjon se joue en **aventure textuelle** avec les mêmes questions, les mêmes boss et le même certificat.
8. Parcours complet au clavier seul ; questions, résultats et événements importants annoncés aux lecteurs d'écran.
9. Le JS initial du site ne change pas de budget (≤ 1,5 Mo gzip) ; le donjon, le post-traitement et le générateur de PDF se chargent à la demande.
10. Le contenu est validé automatiquement (§5.2) et relu par le propriétaire du projet : au moins 4 questions par sujet (étage 1), au moins 6 par domaine (étage 2), deux boss.

---

## 2. Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Déplacement | **Case par case** sur une grille (pas, recul, quart de tour, pas de côté), à la Eye of the Beholder | Choix du propriétaire ; jouable au clavier seul, fiable à tester |
| Épreuves | QCM et « quel prompt est le meilleur ? » chez les gardiens ; boss qui fait **écrire un prompt** noté par le moteur de l'atelier | Vérifie le savoir et le savoir-faire ; réutilise un moteur déjà testé |
| Accès | Ouvert à tous, avec un **avertissement** à l'entrée s'il reste des sujets ou des missions | Les experts ne sont pas bloqués ; les débutants sont orientés |
| Durée de l'étage 1 | **Un gardien par sujet** (13) puis le boss, environ 10 minutes | Chaque sujet est vérifié : le certificat a un sens |
| Erreurs | 3 cœurs (étage 1), 2 cœurs (étage 2) ; un gardien s'efface même après une mauvaise réponse | Reprend « éjection après 3 erreurs » de la spec 1 ; une partie avance toujours |
| Palier expert | **Étage 2 débloqué après l'étage 1**, rejouable depuis l'écran titre, certificat « Expert » séparé | Demande du propriétaire ; les débutants n'y tombent pas par erreur |
| Difficulté experte | 15 gardiens (3 par domaine), questions « cochez toutes les bonnes réponses » et scénarios d'incident, 2 cœurs, **corrections à la fin seulement**, boss de durcissement d'un system prompt | « Très dur » par le fond et par les règles, sans chronomètre |
| Style visuel | **Pixel art dessiné par le code** : textures et sprites définis en grilles de caractères, aucun fichier externe | Aucune licence à gérer, style homogène, cohérent avec la spec 1 (« procédural ») |
| Rendu | Une **Canvas R3F propre au donjon** + **post-traitement** (`@react-three/postprocessing`) : pixellisation, palette Athena tramée (effet maison), scanlines, vignettage | Choix du propriétaire ; même motif que le chantier de l'atelier (second canvas, celui du bureau en pause) |
| Logique | TypeScript pur dans `src/dungeon/` (carte, déplacement, tirage, automate de partie, score), sans React ni three | Testable sans 3D ; partagée par le rendu 3D et l'aventure textuelle |
| Partie en cours | **En mémoire seulement** : quitter le donjon ou recharger recommence l'étage | Simple ; un étage dure ≈ 10 minutes |
| Certificat | **PDF A4 paysage** généré dans le navigateur (`pdf-lib` + `@pdf-lib/fontkit`, chargés à la demande) | Format attendu pour l'envoyer à un manager ; aucune donnée ne sort du navigateur |
| Nom sur le certificat | Saisi à chaque téléchargement, **jamais enregistré** | Pas de donnée personnelle stockée (spec 1) |
| Valeur du certificat | Mention en pied de page : « Self-assessed internal training, not an official qualification » | Sans serveur, le certificat n'est pas vérifiable : on ne prétend pas le contraire |
| Police du donjon | **VT323** (déjà utilisée par l'atelier) pour le chrome et les dialogues ; Montserrat pour les textes longs (explications, prompts) | Aucune nouvelle police d'interface ; lisibilité des textes longs |
| Ada dans le donjon | Portrait pixel art d'Ada sur l'écran titre et dans les conseils du boss ; le débrief d'éjection se fait au bureau, par l'Ada 3D | Le donjon reste un monde à part ; Ada accompagne sans encombrer |

---

## 3. Expérience utilisateur

### 3.1 Entrée et écran titre

- Entrée : clic sur la télé (vol de caméra → neige / changement de chaîne → donjon, comportement de la spec 1) ou bouton « The dungeon » de la barre d'accueil. En mode lecture, le bouton ouvre directement l'aventure textuelle.
- **Écran titre** plein écran, pixel art : « THE DUNGEON », portrait d'Ada, « PRESS START » clignotant (fixe en mouvement réduit).
  - S'il reste des sujets non vus ou des missions non réussies : « 4 topics and 2 workshop missions left. The guardians will ask about every topic. » avec **Go to the office** et **Enter anyway**.
  - Si l'étage 1 est réussi : deux entrées, **Floor 1 · The Dungeon** et **Floor 2 · The Deep**, et **Download my certificate again** pour chaque étage réussi (§3.9).
- Sortie : **← Back to the office** sur l'écran titre et dans le menu de pause (`Échap`), ou bouton précédent du navigateur. Quitter pendant une partie l'abandonne (confirmation : « Leave the dungeon? Your run will be lost. »).

### 3.2 Exploration

- Grille de cases d'1 m ; caméra à hauteur d'yeux, champ de vision 70°.
- Commandes :

| Action | Clavier | Souris |
|---|---|---|
| Avancer / reculer | `↑` `↓` ou `W` `S` (`Z` en AZERTY via `event.code`) | Flèches à l'écran |
| Tourner d'un quart de tour | `←` `→` ou `A` `D` (`Q` `D` en AZERTY) | Flèches à l'écran |
| Pas de côté | `Q` `E` (`A` `E` en AZERTY) | — |
| Pause | `Échap` | Bouton pause |

- Chaque mouvement dure 180 ms (instantané en mouvement réduit) ; une seule commande peut attendre pendant un mouvement. Un mur ou un gardien non vaincu bloque : petit choc de caméra et son sourd.
- **HUD** (DOM, VT323) : cœurs en haut à gauche, compteur « Guardians 4/13 » au centre, **mini-carte** en haut à droite (cases déjà vues, position et orientation du joueur, gardiens vaincus barrés).
- Décor : murs de pierre, dalles, plafond voûté, torches animées (3 images), portes ; quelques culs-de-sac portent des **inscriptions** murales (phrases-clés des sujets) en guise de récompense d'exploration.

### 3.3 Les gardiens

- Chaque gardien **barre le passage** : le chemin principal ne peut pas le contourner. La rencontre s'ouvre dès que le joueur se tient devant lui, face à lui.
- Étage 1 : un gardien par sujet, dans l'ordre des chapitres du bureau (What is AI → … → AI safety at work). Chaque gardien a un nom à thème (« The Token Goblin », « The Hallucination Ghost », « The Context Hoarder »…) et un sprite 32 × 32.
- **Boîte de dialogue** rétro en bas d'écran : nom du gardien, question, réponses numérotées (`1`–`4` ou clic, `Entrée` pour valider). Les réponses sont mélangées à chaque partie.
- Formats (§5.1) : `choice` (4 choix, une bonne réponse) ; `bestPrompt` (une situation et 2 ou 3 prompts, un meilleur) ; à l'étage 2 seulement, `multi` (4 à 6 choix, au moins 2 bons, « cochez toutes les bonnes réponses », tout juste ou faux) et les scénarios d'incident (une situation avant la question).
- **Bonne réponse** : le gardien éclate en pixels, sa phrase-clé s'affiche (« Tokens are the AI's unit of reading and billing. »), la porte s'ouvre.
- **Mauvaise réponse** :
  - étage 1 : un cœur perdu, le gardien explique la bonne réponse (explication du contenu) et ajoute « Review: Tokens » ; puis il s'efface ;
  - étage 2 : un cœur perdu, « Wrong. » seulement ; l'explication attend l'écran de corrections (§3.6) ; puis il s'efface.

### 3.4 Le boss de l'étage 1 — « The Vague Prompt »

- Un golem de blocs de carton (sprite 64 × 64) dans la dernière salle. Il présente une **situation** et un **mauvais prompt** (format d'une mission de niveau 3 de l'atelier).
- Le joueur réécrit le prompt dans un champ de texte (Montserrat, `Ctrl+Entrée` pour valider) ; le moteur de l'atelier (`evaluate`) le note.
  - **Excellent** : le golem s'effondre bloc par bloc → victoire.
  - **Passable** ou **Vague** : le golem frappe, un cœur perdu ; le portrait d'Ada donne le conseil du bloc le plus faible (`adviceFor`, mêmes phrases que l'atelier) ; nouvel essai.
- « It's already there » de l'atelier n'existe pas ici : c'est une épreuve.

### 3.5 Fin de partie

- **Éjection** (dernier cœur perdu) : écran « GAME OVER · You were thrown out of the dungeon ».
  - Étage 1 : retour au bureau (vue d'ensemble), où Ada fait un **débrief** : « The guardians caught you on Tokens and Hallucinations. Want to review them? » avec un bouton par sujet manqué (ouvre le sujet en vue présentation) et **Not now**.
  - Étage 2 : écran de corrections (§3.6), puis **Back to the office** ou **Try again** ; les domaines n'ayant pas de sujet au bureau, pas de débrief d'Ada.
- **Victoire** : écran de score — score sur 100, détail (gardiens réussis, essais du boss), meilleur score, puis le certificat (§3.9). À l'étage 1, un escalier apparaît : **Go down to The Deep** (ou retour à l'écran titre).

### 3.6 L'étage 2 — « The Deep »

- Carte plus grande et plus sombre (torches plus rares, palette tirée vers le bleu-gris). 15 gardiens : 3 par domaine, dans l'ordre sécurité, conformité, monitoring, prompting avancé, infrastructure ; noms à thème (« The Injection Wraith », « The Compliance Sphinx »…).
- 2 cœurs. Pas d'explication pendant la partie.
- **Boss « The Leaky Agent »** : un agent de support qui fuit ses instructions. Situation : un assistant client qui lit des emails et des pages web ; le joueur doit écrire son **system prompt durci**. Détails attendus (mission au format de l'atelier) : rôle et périmètre, tâche, contenu non fiable délimité et traité comme des données, refus de révéler les instructions ou des secrets, refus hors périmètre, format de sortie imposé. Le bloc Contrainte y est **obligatoire**. Excellent requis ; sinon un cœur perdu et le conseil d'Ada.
- **Écran de corrections** (victoire comme éjection) : chaque question posée, la réponse donnée, la bonne réponse et l'explication, avec la source pour les faits datés (§5.3). Puis **Back to the office** ou **Try again**.

### 3.7 L'aventure textuelle

- Utilisée sans WebGL, en mode lecture, ou si le rendu 3D échoue en cours de partie (la partie continue : même automate, même état).
- Le labyrinthe se réduit à son chemin principal : une ligne de description (« A narrow corridor. Torches flicker. The Token Goblin blocks the way. »), puis la rencontre dans la même boîte de dialogue ; **Continue** mène au gardien suivant. Mêmes cœurs, même boss, même score, même certificat.

### 3.8 Sons

Bips synthétisés par le moteur de son du socle (respecte le réglage Sound) : pas, choc contre un mur, bonne réponse (arpège montant), mauvaise réponse (descendant), gardien vaincu, coup du boss, victoire, éjection. Le moteur gagne une fonction `jingle(notes)` (suite de notes courtes) ; aucun fichier audio.

### 3.9 Le certificat

- Proposé à la victoire et, ensuite, depuis l'écran titre (**Download my certificate again**). Un champ **Your name** (1 à 60 caractères, lettres, espaces, `'` et `-`), puis **Download PDF**. Le nom n'est conservé que le temps de la page.
- PDF A4 paysage, aux couleurs Athena : fond encre, cadre lime, logo cubes, titre « Certificate of completion » (étage 1) ou « Expert certificate » (étage 2), une ligne en Playfair Display italique (« has braved the dungeon of the Athena Prompt Academy »), le nom, la date de la meilleure réussite, le score, la liste des 13 sujets ou des 5 domaines, et en pied de page « Self-assessed internal training, not an official qualification ».
- Nom du fichier : `athena-prompt-academy-certificate.pdf` ou `athena-prompt-academy-expert-certificate.pdf`.

---

## 4. Architecture

### 4.1 Nouvelles dépendances (vérifiées le 2026-10-15)

| Paquet | Version | Licence | Rôle |
|---|---|---|---|
| `@react-three/postprocessing` | 3.1.3 | MIT | Chaîne d'effets en R3F (`EffectComposer`, `Pixelation`, `Scanline`, `Vignette`, `createEffectComponent`) ; pairs : react ^19, three ≥ 0.156, @react-three/fiber ≥ 9.7 |
| `postprocessing` | 6.39.5 | Zlib | Moteur des effets ; pair : three ≥ 0.168 < 0.187 (le projet est en 0.186.1) |
| `pdf-lib` | 1.17.1 | MIT | Génération du PDF dans le navigateur |
| `@pdf-lib/fontkit` | 1.1.1 | MIT | Incorporation des polices de la charte dans le PDF |

Versions publiées depuis plus de deux semaines (la 3.2.0 de `@react-three/postprocessing`, du 2026-10-10, est écartée). Toutes ne sont importées que par la zone du donjon (chargée à la demande), et `pdf-lib` / `fontkit` seulement au premier clic sur **Download PDF**.

### 4.2 Organisation du code

```
src/dungeon/                 logique pure (aucun import de React ni de three)
  model.ts                   types et schémas zod du contenu (questions, gardiens, étages)
  content.ts                 chargement et validation de content/<lang>/dungeon/
  map.ts                     cartes en texte → grille ; chemin principal ; voisinages
  movement.ts                pose (case + orientation), pas, quarts de tour, collisions
  random.ts                  générateur à graine (mulberry32), mélange
  questions.ts               tirage sans répétition, mélange des réponses, correction (dont « tout juste »)
  run.ts                     automate d'une partie : états, cœurs, rencontres, boss, score, corrections
  score.ts                   barèmes des deux étages
  certificate.ts             mise en page du PDF (import dynamique de pdf-lib et fontkit)
src/zones/dungeon/
  index.tsx                  ZoneModule (remplace l'écran « Coming soon »)
  DungeonApp.tsx             écran titre, HUD, dialogues, fin de partie, pause ; choisit 3D ou texte
  store.ts                   store zustand de la partie (autour de run.ts) et pont de test (dev)
  scene/                     Canvas R3F : DungeonCanvas, Maze (murs, sols, portes), Guardians (sprites),
                             Torches, CameraRig (interpolation des pas), Effects (chaîne de post-traitement)
  pixels/                    textures et sprites en grilles de caractères → CanvasTexture (NearestFilter)
  effects/PaletteEffect.ts   effet maison : quantification vers la palette Athena + tramage de Bayer 4 × 4
  text/TextDungeon.tsx       aventure textuelle
  ui/                        DialogBox, Hud, MiniMap, TitleScreen, ScoreScreen, ReviewScreen, CertificateForm
  dungeon.css
content/en/dungeon/
  floor1.json                gardiens et réserves de questions par sujet
  floor2.json                gardiens et réserves de questions par domaine
  bosses.json                les deux boss (format de mission de l'atelier)
  maps.json                  les deux cartes en texte
```

### 4.3 Logique de jeu (`src/dungeon/`)

**Cartes** (`maps.json`) : une ligne de texte par rangée. `#` mur, `.` sol, `S` départ (avec son orientation dans le JSON), `G` gardien, `B` boss, `>` escalier (étage 1, après victoire), `i` inscription murale. Étage 1 : 15 × 15 environ ; étage 2 : 19 × 19 environ. Les gardiens sont listés dans l'ordre du chemin. Contrôles automatiques : la carte est fermée, tout sol est atteignable, chaque gardien coupe tous les chemins entre le départ et le boss (on ne peut pas le contourner), et un parcours en largeur depuis le départ les rencontre dans l'ordre déclaré.

**Déplacement** : une pose = case + orientation (N, E, S, O). `step(map, pose, command, blocked)` renvoie la nouvelle pose ou `bump`. Les cases des gardiens non vaincus sont bloquantes.

**Tirage** : une graine par partie (horodatage ; injectable en test). Étage 1 : une question par sujet dans sa réserve. Étage 2 : 3 questions distinctes par domaine. Les réponses sont mélangées ; la correction compare des identifiants de réponses, jamais des positions.

**Automate** (`run.ts`), états : `exploring` → `encounter` (question posée) → `answered` (retour affiché) → `exploring` … → `boss` → `bossFeedback` → `victory` ou `ejected`. Chaque transition est une fonction pure `(state, event) → state`. L'état garde : étage, graine, pose, gardiens vaincus, cœurs, réponses données (pour les corrections et le débrief), essais du boss, score.

**Score** (`score.ts`) :

| | Étage 1 | Étage 2 |
|---|---|---|
| Gardien réussi | 5 points (13 → 65) | 4 points (15 → 60) |
| Boss au 1er / 2e / 3e essai | 35 / 25 / 15 | 40 / 25 / — |
| Maximum | 100 | 100 |

Le nombre d'essais du boss est borné par les cœurs restants.

### 4.4 Rendu (`src/zones/dungeon/scene/`)

- **Canvas propre au donjon**, plein écran sous le HUD ; le canvas du bureau est en pause (`frameloop="demand"`, déjà le cas hors du bureau). Pas d'ombres, pas d'antialiasing ; DPR plafonné à 1.
- Murs, sols et plafonds : `InstancedMesh` par type de surface (un appel de dessin chacun), `MeshLambertMaterial` avec les textures pixel art. Lumière : une `PointLight` portée par le joueur (torche, léger scintillement) et les torches murales proches ; brouillard exponentiel couleur encre.
- **Gardiens et boss** : plans face caméra (sprites), animation de flottement en 2 images, explosion en particules de pixels à la défaite.
- **Caméra** : interpolation de la pose sur 180 ms ; choc d'une case sur un mur.
- **Chaîne d'effets** (`EffectComposer`) : `Pixelation` réglée pour une résolution apparente d'environ 320 pixels de large → `PaletteEffect` (quantification vers la palette Athena — encre, surfaces, bleu-gris, lime, menthe, ambre, blanc cassé — avec tramage de Bayer 4 × 4) → `Scanline` → `Vignette`. Étage 2 : palette décalée vers le bleu-gris.
- **Rendu logiciel** (SwiftShader, navigateur des tests e2e) : `Pixelation` et `PaletteEffect` seulement, pour garder des parcours e2e d'une durée raisonnable.
- **Textures et sprites** : définis en grilles de caractères dans `pixels/` (une lettre = une couleur de la palette), convertis une fois en `CanvasTexture` avec `NearestFilter`. Tailles : textures 32 × 32, gardiens 32 × 32, boss 64 × 64, portrait d'Ada 48 × 48.

### 4.5 État, progression et débrief

- La partie en cours vit dans le store du donjon (en mémoire). Les commandes clavier ne sont actives que hors dialogue et hors pause.
- **Progression** (stockage local, schéma de la spec 1) : le champ `dungeon` devient `{ passed: boolean; bestScore: number; passedAt?: string; expert?: { passed: boolean; bestScore: number; passedAt: string } | null }`. Les sauvegardes existantes restent valides (champs optionnels ; une valeur mal formée de `expert` est ignorée seule, comme `workshop`). On n'écrit qu'à la **réussite** d'un étage : `bestScore` garde le maximum, `passedAt` (date ISO) la date de ce meilleur score. L'étage 2 est débloqué si `dungeon.passed`.
- **Débrief** : le store global gagne `dungeonDebrief: { topics: string[] } | null` (non persisté), écrit à l'éjection de l'étage 1. La barre d'accueil du bureau l'affiche par la voix d'Ada à la place de son message d'accueil ; le mode lecture l'affiche en tête de son panneau. Il disparaît avec **Not now** ou à l'ouverture d'un sujet.

### 4.6 Navigation

- `#/dungeon` : écran titre. `#/dungeon?floor=1` et `#/dungeon?floor=2` : un étage en cours (l'étage 2 sans réussite de l'étage 1 retombe sur l'écran titre). Comme l'atelier, entrer dans le donjon ajoute une entrée d'historique ; rien à l'intérieur n'en ajoute ; Précédent ramène au bureau.
- La barre d'accueil du bureau affiche « The dungeon » puis « The dungeon · passed » ; le bouton de l'étiquette 3D de la télé reste « The Dungeon ».

### 4.7 Intégration au socle

- `src/zones/dungeon/index.tsx` exporte un `ZoneModule` dont l'`Overlay` est `DungeonApp` (le composant `ComingSoon` du socle n'a plus d'utilisateur : supprimé avec ses chaînes).
- Le moteur d'évaluation de l'atelier (`src/workshop/engine/evaluate.ts`, `adviceFor`) est importé tel quel ; les boss sont validés par le schéma de mission de l'atelier. Si ce schéma interdit un bloc bonus obligatoire (le bloc Contrainte du boss expert), il est étendu avec un test.
- Le pont de test de développement (`window.__academy`) gagne `dungeon()` (état de la partie) et `dungeonAnswer(correct: boolean)` pour que les e2e passent un étage sans dépendre du tirage.

### 4.8 Le certificat PDF

- `certificate.ts` exporte `makeCertificate({ floor, name, score, date, items }) → Promise<Uint8Array>` ; il importe dynamiquement `pdf-lib` et `@pdf-lib/fontkit`. Le téléchargement passe par un `Blob` et un lien temporaire.
- Polices incorporées (sous-ensembles) : Montserrat Regular et Bold, Playfair Display Italic (OFL). On essaie d'abord les fichiers des paquets `@fontsource` déjà installés ; si `fontkit` ne les lit pas, des fichiers TTF OFL du dépôt `google/fonts` sont ajoutés à `public/assets/fonts/` (téléchargement validé par le propriétaire, crédits mis à jour).
- Logo : les cubes Athena dessinés en rectangles vectoriels (pas d'image).

---

## 5. Contenu

### 5.1 Fichiers

**`floor1.json`** — un gardien par sujet :

```json
{
  "topic": "tokens",
  "guardian": { "name": "The Token Goblin", "sprite": "goblin" },
  "questions": [
    {
      "id": "tokens-1",
      "type": "choice",
      "question": "Why can a long prompt cost more than a short one?",
      "answers": [
        { "id": "a", "text": "The AI bills by the number of tokens it reads and writes.", "correct": true },
        { "id": "b", "text": "Long prompts are sent to a more expensive server.", "correct": false },
        { "id": "c", "text": "The AI charges per sentence, not per word.", "correct": false },
        { "id": "d", "text": "Length never changes the cost.", "correct": false }
      ],
      "explanation": "Models read and write tokens, and usage is billed per token: more text in and out means more tokens."
    }
  ]
}
```

`bestPrompt` : `situation` + 2 ou 3 `prompts` (un `best: true`) + `explanation`.

**`floor2.json`** — par domaine (`security`, `compliance`, `monitoring`, `prompting`, `infrastructure`) : un nom de domaine, 3 gardiens, une réserve de questions `choice`, `multi` (4 à 6 réponses, au moins 2 `correct: true`) ou `choice`/`multi` précédées d'un `scenario` (scénario d'incident). Champ `source` (URL officielle) **obligatoire** pour le domaine conformité et pour tout fait daté.

**`bosses.json`** — deux missions au format de l'atelier (mode `fix`) : situation, prompt de départ, blocs et détails attendus, réponses simulées (`vague` / `passable` / `excellent`), phrases d'Ada.

**`maps.json`** — les deux cartes (§4.3).

### 5.2 Règles de validation (tests de contenu)

- Étage 1 : les 13 identifiants de sujets du bureau, chacun une fois ; au moins 4 questions par sujet. Étage 2 : les 5 domaines, chacun avec 3 gardiens et au moins 6 questions.
- `choice` : exactement 4 réponses, une seule correcte. `multi` : 4 à 6 réponses, au moins 2 correctes et au moins 1 incorrecte. `bestPrompt` : 2 ou 3 prompts, un seul meilleur.
- Aucune réponse « All of the above » / « None of the above » (le mélange les rendrait incohérentes).
- Identifiants de questions uniques ; explication non vide pour chaque question ; longueurs maximales (question 300, réponse 160, explication 400, scénario 400, prompt 600 caractères).
- `source` présent là où il est obligatoire (§5.1), en `https://`.
- Les boss passent le schéma de mission de l'atelier ; pour chacun, un prompt de référence obtient **Excellent** et le prompt de départ **Vague** (test automatique).
- Les cartes passent les contrôles du §4.3 ; le nombre de `G` égale le nombre de gardiens de l'étage.

### 5.3 Rédaction

- Anglais simple, phrases courtes, aucun emoji ; une seule bonne réponse défendable par `choice`, pas de piège sur un mot.
- Étage 1 : chaque question s'appuie sur la partie simple ou « Go deeper » du sujet (pas de notion absente du bureau).
- Étage 2 : niveau développeur et super-utilisateur. Thèmes : injection de prompt directe et indirecte, fuite de données par les outils et les connecteurs, gestion des secrets, permissions des agents ; RGPD (base légale, minimisation, transferts), AI Act européen (niveaux de risque, obligations de transparence, calendrier), conservation des données, propriété des sorties ; évaluations et tests de régression, journalisation sans données personnelles, coût et latence, dérive, mesure des hallucinations ; sorties structurées, few-shot, modèles de raisonnement, température, rôle du system prompt, mise en cache des prompts ; RAG, embeddings et recherche vectorielle, fenêtre de contexte, limites de débit et reprises, routage de modèles, streaming, traitements par lots.
- Les faits datés (lois, calendriers, standards comme l'OWASP Top 10 for LLM Applications) sont écrits « as of 2026 » et sourcés.
- Le propriétaire relit et valide tout le contenu avant la mise en ligne (critère 10).

---

## 6. Robustesse, performance, accessibilité

### 6.1 Erreurs

- Échec de chargement de la zone (import dynamique) : comportement de la spec 1 (message et retour au bureau).
- Échec du rendu 3D ou du post-traitement (`ErrorBoundary` autour du canvas, perte du contexte WebGL) : bascule sur l'aventure textuelle **sans perdre la partie** ; annonce « The 3D view stopped. The dungeon continues in text. ».
- Échec de génération du PDF : message « The certificate could not be created. » et **Try again** ; la victoire reste enregistrée.
- Contenu invalide : refusé par les tests (pas de garde à l'exécution au-delà du schéma).

### 6.2 Performance

- 60 images/s visées sur le PC de référence (GPU intégré) ; la scène est petite (instanciation, une lumière dynamique principale, aucun modèle externe) et le post-traitement travaille surtout à basse résolution. Mesure fournie (même script que le bureau).
- Budget : JS initial du site inchangé (≤ 1,5 Mo gzip) ; le morceau du donjon (zone + post-traitement) et celui du PDF sont mesurés et rapportés.

### 6.3 Accessibilité

- Tout au clavier ; ordre de tabulation : HUD (pause), puis la boîte de dialogue quand elle est ouverte (le focus y entre à l'ouverture et revient au jeu à la fermeture).
- Région `aria-live` du donjon : question posée, résultat (« Correct. The Token Goblin fades away. »), cœurs restants, événements (« A guardian blocks the way. », « Dead end. », « Stairs down. »). Pas d'annonce à chaque pas.
- Mouvement réduit : pas instantanés, pas de clignotement, pas de choc de caméra, explosions remplacées par une disparition.
- Contrastes : la boîte de dialogue et le HUD sont en DOM, hors du filtre de palette, et respectent la charte.

### 6.4 Sécurité et données

- Aucune donnée envoyée ; le nom du certificat n'est ni stocké ni journalisé.
- Le texte saisi pour les boss n'est jamais interprété comme du HTML.

---

## 7. Tests et preuves

- **Unitaires** (`src/dungeon/`) : cartes (fermeture, atteignabilité, gardiens incontournables et dans l'ordre), déplacement et collisions, tirage reproductible avec une graine et sans répétition, mélange et correction (dont `multi`), automate (toutes les transitions, éjection au bon cœur, essais du boss bornés), barèmes, migration de la progression, débrief.
- **Contenu** : règles du §5.2.
- **Certificat** : le PDF généré s'ouvre avec `pdf-lib`, a une page A4 paysage et contient le nom, le score et le titre de l'étage.
- **Composants** : écran titre (avertissement, étage 2 verrouillé ou non), HUD, boîte de dialogue au clavier (`1`–`4`, `Entrée`, cases à cocher de `multi`), boss, écrans de fin, aventure textuelle.
- **Bout en bout** (Playwright) : de la télé du bureau à une victoire à l'étage 1 avec téléchargement du PDF ; une éjection et le débrief d'Ada au bureau ; le déblocage puis une partie de l'étage 2 jusqu'à l'écran de corrections ; l'aventure textuelle en mode lecture ; l'écran 1280 × 600 ; la bascule texte quand WebGL est indisponible. Captures de preuve dans `docs/evidence/dungeon/`.
- **Mesure** : images par seconde et poids des morceaux chargés à la demande, dans `docs/evidence/dungeon/perf.md`.

---

## 8. Hors périmètre

- Sauvegarde d'une partie en cours, classement, partage de score, vérification en ligne d'un certificat.
- Questions générées par une IA ou notées en ligne.
- Combat, inventaire, objets, plusieurs personnages.
- Autres langues que l'anglais (l'architecture i18n est respectée, la traduction viendra plus tard).
- Musique continue (seulement des bips et des jingles synthétisés).
