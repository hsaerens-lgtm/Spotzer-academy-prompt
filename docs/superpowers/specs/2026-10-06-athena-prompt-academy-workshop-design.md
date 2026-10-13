# Athena Prompt Academy — Spec 2 : l'atelier prompt

- **Date** : 2026-10-06
- **Statut** : en revue
- **Périmètre** : sous-projet 2 sur 3 (zone « atelier », accessible par le portable du bureau)
- **S'appuie sur** : spec 1 — `docs/superpowers/specs/2026-09-29-athena-prompt-academy-office-design.md` (socle, bureau, Ada, contenu, progression). Tout ce que la spec 1 fixe reste valable sauf mention contraire au §2.
- **Spec suivante** : 3 — Donjon (test + certificat)

---

## 1. Objectif

L'atelier est la suite pratique de la théorie du bureau. Le sujet *prompt* du bureau enseigne les quatre pièces d'un bon prompt (rôle, tâche, contexte, format) et se termine par « the laptop on the table is your workshop ». Ici, on **construit** des prompts.

Métaphore centrale : **un prompt est un bâtiment**. Chaque instruction est un bloc ; la qualité de chaque bloc devient un matériau (pierre, bois, carton) ; un moteur physique 3D montre si le bâtiment tient quand l'IA le « lit » puis pose son poids dessus (l'exécution du prompt). Tout se passe dans un **faux PC** au style rétro années 90 aux couleurs Athena, avec Ada en assistante façon Clippy.

L'atelier comporte deux parties :

1. **Les missions** (cœur) : 6 situations concrètes, réponses de l'IA **simulées** (pré-écrites, 100 % hors ligne), jugées par un moteur de règles.
2. **Le correcteur** (annexe) : un programme du faux PC où l'on soumet **n'importe quel prompt** à une vraie IA (OpenAI, via un petit serveur proxy) qui le note bloc par bloc, construit le même bâtiment, explique ce qui tient ou non, propose une version améliorée et peut exécuter les deux versions.

### Public et contraintes

Identiques à la spec 1 : usage interne, PC uniquement, anglais d'abord (multilingue prévu), public mixte, charte Athena. Ajouts : le correcteur seul dépend d'un serveur (§4.9) ; tout le reste fonctionne en fichiers statiques.

### Critères de succès (sous-projet 2)

1. Le portable du bureau (clic 3D ou bouton « Prompt workshop » de la barre d'accueil) mène au faux PC ; « Back to the office » ramène à la vue d'ensemble. Le bouton de la barre d'accueil affiche la progression (« 2/6 »).
2. Les 6 missions se jouent de bout en bout : niveau 1 en blocs, niveau 2 en texte libre avec les conseils d'Ada en direct, niveau 3 en correction d'un mauvais prompt.
3. Le bâtiment 3D est reproductible et son issue (tient / penche / s'effondre) correspond au niveau de réponse pour **chaque prompt d'exemple** de chaque mission (test automatique). Bouton « Skip » ; mouvement réduit → état final direct ; sans WebGL ou en mode lecture → vue 2D.
4. Les missions réussies, `workshopDone` et « My prompts » sont conservés dans le navigateur ; copier et effacer fonctionnent.
5. Correcteur avec proxy et clé : rapport, bâtiment, prompt amélioré et « Run both » en ≤ 15 s environ ; sans proxy : message « The corrector is offline », le reste de l'atelier fonctionne.
6. La clé OpenAI n'apparaît nulle part dans le site construit (contrôle automatique sur `dist/`).
7. Parcours complet au clavier seul ; résultats et commentaires d'Ada annoncés aux lecteurs d'écran.
8. Le JS initial du site ne change pas de budget (≤ 1,5 Mo gzip) ; l'atelier et le moteur physique se chargent à la demande ; le chantier tourne à 60 images/s sur le PC de référence (GPU intégré), mesure fournie.
9. Six fichiers de mission validés, chacun avec au moins 3 prompts d'exemple, en anglais, relus par le propriétaire du projet.

---

## 2. Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Réponses de l'IA dans les missions | Simulées, pré-écrites, 3 niveaux (vague / passable / excellent) | Fiables, gratuites, hors ligne ; la relation cause → effet est visible |
| Déroulé | 6 missions guidées, aide dégressive en 3 niveaux | Prend les débutants par la main et finit par l'écriture libre |
| Thèmes | Tâches génériques dans le contexte de l'entreprise (agence web pour petites entreprises) | Concret sans inventer de processus internes ; ajustable à la relecture |
| Style du faux PC | Hybride : chrome rétro années 90 (barres de titre, biseaux, barre des tâches) aux couleurs Athena | Nostalgie « PC classique » + charte ; original, pas de copie de Windows |
| Police du chrome | **VT323** (licence OFL, `@fontsource/vt323`), chargée seulement dans l'atelier | Rendu rétro identique partout ; seule exception aux deux polices de la charte, limitée au chrome ; le texte saisi et les réponses restent en Montserrat |
| Ada dans l'atelier | Ada **2D vectorielle** (SVG), animée en CSS | Reconnaissable, légère, fonctionne sans 3D |
| Jugement | Moteur de règles par mission, qualité par bloc, bouton « It's already there » | Explicable et testable ; le bouton couvre les limites de la détection par mots-clés |
| Progression | Toutes les missions ouvertes, ordre conseillé, badge « Start here » | Public mixte, comme les sujets du bureau |
| Approche technique | Missions en JSON validé par zod + moteur pur testé + zone DOM | Suit les motifs du socle ; relecture et traduction sans code |
| Métaphore | Le prompt est un bâtiment de blocs ; qualité → matériau ; physique réelle | Rend la solidité d'un prompt visible et tangible |
| Saisie | Niveau 1 : blocs ; niveaux 2–3 : texte libre reconstruit en blocs | Comprendre l'anatomie, puis l'appliquer en écriture réelle |
| Physique | **3D**, Rapier (`@dimforge/rapier3d-compat`), utilisée directement (sans `@react-three/rapier`) | Choix du propriétaire ; utilisation directe pour partager la même simulation entre l'interface et les tests |
| Rendu du chantier | Un **second `<Canvas>`** R3F dans la fenêtre BUILDER ; le canvas du bureau est en pause | Isole le chantier de l'écran mural (`occlude="blending"`) du bureau ; dérogation au « canvas unique » de la spec 1 |
| Correcteur | Vraie IA OpenAI (Responses API, Structured Outputs) via un **proxy** Node qui garde la clé | La clé ne doit jamais être lisible dans le navigateur |
| « Run both » | Inclus : exécute le prompt d'origine et le prompt amélioré, réponses côte à côte | Preuve concrète de l'amélioration |
| Spec 1 « aucun backend » | Amendée : un serveur **optionnel**, pour le correcteur seulement | Sans lui, tout le reste fonctionne en statique |

---

## 3. Expérience utilisateur

### 3.1 Entrée et sortie

- Entrée : clic sur le portable (vol de caméra → fondu, comportement de la spec 1) ou bouton « Prompt workshop » de la barre d'accueil (libellé suivi de la progression, ex. « Prompt workshop · 2/6 »). En mode lecture, le bouton ouvre l'atelier directement (pas de vol).
- Sortie : bouton « ← Back to the office » de la barre des tâches, ou bouton précédent du navigateur → vue d'ensemble du bureau.
- `Échap` ne quitte **pas** l'atelier (on tape du texte) ; il ferme seulement la bulle d'Ada.

### 3.2 Le faux PC

Fond `ink` avec trame de points. Fenêtres **fixes** (pas de glisser-déposer), chrome rétro : barre de titre lime (`PROMPT_STUDIO.EXE — MISSION 1`) ou gris-bleu pour les fenêtres secondaires, bordures biseautées, police VT323 pour le chrome.

Disposition (1600 × 900, mode compact jusqu'à 1280 × 600), en deux colonnes depuis l'allègement du 2026-10-13 (le studio à gauche, le résultat à droite ; plus d'icônes du bureau ni de colonne des missions) :

| Zone | Contenu |
|---|---|
| `PROMPT_STUDIO.EXE` (gauche) | Bouton **All missions 2/6** dans la barre de titre : la liste des missions (3 niveaux × 2 missions, coches lime pour les missions réussies, badge « Start here » sur la première non réussie de l'ordre conseillé) se déroule par-dessus le studio et se referme au choix d'une mission, avec Échap ou par un clic ailleurs. Puis la situation, l'éditeur (blocs ou texte libre), boutons **Build & test** (`Ctrl+Entrée`) et **Copy my prompt** |
| `BUILDER.EXE` (droite, haut) | Le chantier 3D (§3.5), jauge de stabilité, boutons Skip / Reset view ; occupe toute la hauteur au-dessus d'Ada tant qu'aucun test n'a été lancé |
| `AI_OUTPUT.TXT` (droite, milieu) | Apparaît avec le premier résultat (dès l'ouverture en niveau 3) : la réponse simulée et son niveau (`HOLDS · EXCELLENT`, `LEANING · PASSABLE`, `COLLAPSED · VAGUE`) ; bascule **Before / After** après réussite |
| Ada (coin bas droit) | Bulle de commentaire + boutons contextuels |
| Barre des tâches | Bouton `■ ATHENA` (menu : Missions, My prompts, Corrector, Back to the office), onglets des fenêtres, Sound, ← Back to the office, compteur `2/6` |

`MY_PROMPTS.TXT` et `CORRECTOR.EXE` s'ouvrent depuis la barre des tâches à la place de la vue des missions (`MY_PROMPTS.TXT` sur toute la largeur, `CORRECTOR.EXE` dans la colonne du studio avec son propre chantier et sa propre sortie) ; l'onglet Missions y ramène.

### 3.3 Ada en 2D

- Composant `Ada2D` (SVG) : même silhouette que l'Ada 3D (corps en goutte porcelaine, tête ovale, visière noire, yeux LED lime, liseré mint, deux bras). Humeurs de la spec 1 (`neutral`, `happy`, `thinking`, `encouraging`, `surprised`) traduites en formes d'yeux ; geste `point` (bras levé vers la fenêtre concernée).
- Animations CSS : flottement, clignement ; désactivées avec `prefers-reduced-motion`.
- Bulle : texte écrit à la machine avec les bips d'Ada (moteur de son de la spec 1, respecte le réglage Sound), sans capturer le clavier ; affichage immédiat en mouvement réduit.
- Les textes d'Ada viennent du contenu (§5) ; aucune phrase codée en dur dans les composants.

### 3.4 Les 6 missions

Contexte commun : une agence web qui crée des sites et la présence en ligne de petites entreprises.

| # | Niveau · mode | Mission (id) | Ce que l'apprenant doit apprendre à ajouter |
|---|---|---|---|
| 1 | 1 · blocs | The delayed website (`delayed-website`) — email à la boulangerie Martin : lancement repoussé d'une semaine | Contexte (client, raison, nouvelle date), ton, longueur |
| 2 | 1 · blocs | Meeting notes for your manager (`meeting-notes`) — notes brutes fournies à transformer en résumé | Public, structure (décisions / prochaines étapes), puces |
| 3 | 2 · libre | A post for a florist (`florist-post`) — offre de fête des mères sur les réseaux sociaux | Rôle, plateforme, ton, longueur, appel à l'action |
| 4 | 2 · libre | A support answer (`support-hours`) — un client demande comment changer ses horaires d'ouverture sur son site | Rôle, question exacte du client, étapes simples, ton aimable |
| 5 | 3 · correction | The vague Services page (`plumber-services`) — « write a services page » pour un plombier | Qui est le client, liste des services, zone, ton, longueur |
| 6 | 3 · correction | The too-long newsletter (`newsletter`) — un prompt qui produit un pavé | Public, limite de longueur, structure, un message clé |

Ordre conseillé = ordre du tableau. Toutes les missions sont ouvertes dès le départ.

### 3.5 Les blocs et le bâtiment

**Types de blocs et place dans le bâtiment** (de bas en haut) :

| Bloc | Élément du bâtiment | Obligatoire |
|---|---|---|
| `role` — Role | Dalle de fondation | Oui (selon la mission) |
| `task` — Task | Rez-de-chaussée | Oui |
| `context` — Context | Étage | Oui |
| `format` — Format | Toit | Oui |
| `example` — Example | Pilier qui renforce les étages | Non (bonus) |
| `constraint` — Constraint | Contreventements qui empêchent de vaciller | Non (bonus) |

Les places sont **fixes** : l'ordre de saisie ne change pas l'ordre du bâtiment.

**Qualité → matériau.** Chaque mission définit, pour chaque bloc, des **détails attendus** (ex. Contexte = nom du client + raison + nouvelle date). Soit `r` = part des détails présents :

| Qualité | Condition | Matériau | Propriétés physiques |
|---|---|---|---|
| 3 | `r = 1` | Pierre | Large, lourde, forte adhérence, centrée |
| 2 | `r ≥ 0,5` | Bois | Un peu plus étroite, densité moyenne, léger décalage |
| 1 | `r > 0`, ou texte présent sans aucun détail | Carton | Étroite, légère, glissante, décalée, plus fine |
| 0 | Bloc absent (champ vide en mode blocs ; aucun détail détecté en texte libre) | Trou | Pas de corps : les blocs du dessus tombent dans le vide |

**Contradiction** : la mission peut déclarer des paires contradictoires (ex. « short / brief » contre « in detail / thorough »). Si les deux sont détectées, le bloc concerné **se fissure** : il est remplacé par deux demi-blocs que l'impact de l'IA écarte.

**Bonus** : un bloc Exemple présent ajoute deux piliers (stabilité accrue) ; un bloc Contrainte ajoute des contreventements (le bâtiment vacille moins). Ils valent un compliment d'Ada mais ne conditionnent jamais la réussite.

**Niveau de réponse** (décidé par les règles, la physique l'illustre) :

- **Excellent** : tous les blocs obligatoires en pierre et aucune contradiction → mission réussie.
- **Vague** : au moins un bloc obligatoire absent, ou moyenne de qualité des blocs obligatoires < 1,5.
- **Passable** : tous les autres cas.

**Animation de lecture** (≈ 4 s, cadencée en pas de simulation, pas en temps réel) :

1. *Pose* : les blocs descendent un à un à leur place (≈ 1 s).
2. *Lecture* : une ligne lime « AI READING… » monte étage par étage ; chaque bloc s'illumine avec son matériau, et la phrase du prompt qui l'a produit est surlignée dans l'éditeur (≈ 1,5 s).
3. *Charge* : le bloc « AI » tombe sur le toit — l'IA pose son poids en exécutant le prompt (≈ 1,5 s de simulation).
4. *Issue* : **tient** (Excellent), **penche** (Passable) ou **s'effondre** (Vague) ; jauge de stabilité et réponse simulée s'affichent.

Bouton **Skip** (saute à l'état final, calculé instantanément). Caméra : rotation horizontale libre, inclinaison limitée, zoom borné, pas de translation, bouton **Reset view**. Sons courts optionnels (choc de bloc, grondement d'effondrement) synthétisés par le moteur de son existant.

**Vue 2D** (sans WebGL, en mode lecture, ou si le chargement du moteur physique échoue) : pile de blocs en HTML/CSS avec matériau, trous et fissures, la même jauge et le même texte ; pas de simulation.

### 3.6 Déroulé selon le niveau

- **Niveau 1 — blocs** : quatre blocs pré-placés (Role, Task, Context, Format), chacun avec un champ texte et un exemple grisé ; bouton « + Add a block » pour Example et Constraint. **Build & test** est actif dès qu'un bloc contient du texte. Chaque bloc affiche son matériau après le test.
- **Niveau 2 — texte libre** : un seul champ. Ada joue Clippy : après 2 s sans frappe et au moins 8 mots, elle propose le conseil du **premier bloc obligatoire absent ou en carton** (« It looks like you're writing a prompt! Who should the AI be? »). Chaque conseil apparaît au plus une fois par tentative ; « Not now » coupe les conseils pour la mission. Le niveau n'est calculé qu'au **Build & test** ; les blocs sont reconstruits depuis le texte, et un clic sur un bloc du chantier surligne la phrase correspondante.
- **Niveau 3 — correction** : le champ contient le mauvais prompt, le chantier montre déjà son bâtiment effondré et `AI_OUTPUT.TXT` sa réponse *Vague* ; Ada : « This prompt gave that answer. Can you fix it? ». Bouton **Reset** pour revenir au prompt de départ.

### 3.7 Commentaires d'Ada et « It's already there »

- Après chaque test, Ada commente le **bloc le plus faible** en langage de chantier (« The Context floor is cardboard: the AI doesn't know who the client is, why it's late or the new date — so everything above it leans. Reinforce it? »), avec **Edit my prompt** (place le curseur dans le bloc ou la phrase concernés) et **It's already there**.
- **It's already there** porte sur le détail qu'Ada vient de citer : elle s'excuse et montre ce qu'elle cherchait (« Sorry, I missed it! I was looking for something like "next Friday" »). Le détail compte comme présent pour le reste de la mission ; le niveau et le bâtiment sont recalculés.

### 3.8 Réussite, Before / After, My prompts

- Mission réussie : réponse *Excellent*, bâtiment qui tient, Ada joyeuse avec sa phrase de réussite et la leçon à retenir. La mission est cochée ; le prompt réussi est enregistré dans **My prompts**.
- Boutons **Next mission** (prochaine non réussie dans l'ordre conseillé) et **Before / After** (première tentative et tentative réussie côte à côte : prompt, matériaux, réponse ; en mémoire seulement).
- Les 6 missions réussies : Ada félicite, `workshopDone` passe à vrai, elle évoque la console du bureau pour le test (sous-projet 3).
- **My prompts** : liste des prompts réussis (titre de mission + texte assemblé), **Copy** par prompt, **Clear my prompts** avec confirmation.
- **Copy my prompt** (Prompt Studio) et **Copy** utilisent le presse-papiers ; en cas d'échec, le texte est sélectionné et Ada propose `Ctrl+C`.

### 3.9 Le correcteur (`CORRECTOR.EXE`)

- Champ « Paste or write any prompt » (4 000 caractères max, compteur) et ligne facultative « What is it for? » (200 caractères max).
- Avertissement permanent : « Don't paste confidential client information or personal data — this text is sent to OpenAI. »
- **Check my prompt** → (indicateur d'attente rétro, ≤ 30 s)
  1. **Le bâtiment** : même chantier et même animation, à partir des qualités 0–3 données par l'IA pour chaque bloc et de ses contradictions.
  2. **Le rapport** : note /100, verdict (holds / leans / collapses), résumé ; pour chaque bloc : matériau, ce qui tient, ce qui manque, extrait du prompt concerné ; fissures expliquées. Ada en reprend l'essentiel dans sa bulle.
  3. **Le prompt amélioré** : ajouts surlignés, liste des changements, bouton **Copy**.
- **Run both** : exécute le prompt d'origine et le prompt amélioré (deux appels parallèles, réponses plafonnées) et affiche les deux réponses côte à côte, titrées « Your prompt » / « Improved prompt ».
- Hors ligne (`/api/health` indisponible ou `corrector: false`) : la fenêtre affiche « The corrector is offline » et une phrase expliquant qu'il faut le serveur ; l'icône reste visible.

---

## 4. Architecture

### 4.1 Nouvelles dépendances (vérifiées le 2026-10-06)

| Paquet | Version | Usage |
|---|---|---|
| `@dimforge/rapier3d-compat` | 0.21 (ligne 0.21.x, à figer au plan) | Physique 3D (WASM intégré), chargée à la demande |
| `@fontsource/vt323` | 5.3 | Police du chrome rétro, importée par la zone atelier seulement |

Rien d'autre côté client : `@react-three/fiber`, `drei` (`OrbitControls`), `zustand`, `zod`, `i18next` existent déjà. Le proxy n'ajoute aucun paquet : Node 24 (`http`, `fetch` natif, `--env-file-if-exists`) et `zod` déjà présent.

### 4.2 Organisation du code

```
content/en/workshop/
  blocks.json            définition des 6 types de blocs (nom, métaphore, ce qu'est un bon bloc) — partagée avec le proxy
  missions.json          ordre, niveaux, ids
  missions/<id>.json     une mission par fichier (§5)
src/workshop/
  engine/                pur, sans React ni DOM : normalize, match, evaluate, assemblePrompt, tips
  building/              pur : plan du bâtiment (blueprint), matériaux, simulation Rapier, mesure de l'issue
  schema.ts              schémas zod des fichiers atelier + types
src/zones/workshop/
  index.tsx              workshopZone : ZoneModule { Overlay }
  WorkshopApp.tsx        bureau, fenêtres, barre des tâches
  store.ts               état de l'écran (zustand vanilla)
  ui/                    Window, TitleBar, Taskbar, BevelButton, BlockField… (chrome rétro)
  missions/              MissionList, PromptStudio, BlockEditor, FreeEditor, AiOutput, BeforeAfter
  builder/               BuilderWindow, BuilderCanvas (R3F), BuildingView, Builder2D
  corrector/             CorrectorWindow, Report, ImprovedPrompt, RunBoth, api.ts
  myPrompts/             MyPromptsWindow
  ada/                   Ada2D (SVG), AdaBubble
server/
  index.ts               serveur HTTP : /api/* + fichiers de dist/ en production
  correct.ts             appel OpenAI « grade », schéma JSON strict, validation zod
  run.ts                 appel OpenAI « run »
  rateLimit.ts           limites par IP et globales
  rubric.ts              consignes du correcteur, construites depuis blocks.json
scripts/dev.mjs          lance Vite et le proxy ensemble en développement
```

`src/zones/workshop/` remplace l'écran « Coming soon » de la spec 1 (son composant est supprimé pour l'atelier, conservé pour le donjon).

### 4.3 Moteur d'évaluation (`src/workshop/engine/`)

```ts
type BlockType = 'role' | 'task' | 'context' | 'format' | 'example' | 'constraint'
type Quality = 0 | 1 | 2 | 3
type Tier = 'vague' | 'passable' | 'excellent'

type PromptInput =
  | { mode: 'blocks'; blocks: Partial<Record<BlockType, string>> }
  | { mode: 'free' | 'fix'; text: string }

interface DetailResult { id: string; met: boolean; source: 'detected' | 'override' | 'none'; span?: [number, number] }
interface BlockResult { type: BlockType; quality: Quality; details: DetailResult[]; cracked: boolean; spans: [number, number][] }
interface Evaluation { blocks: BlockResult[]; tier: Tier; passed: boolean; weakest: BlockType | null; conflicts: string[] }

function evaluate(mission: Mission, input: PromptInput, overrides: ReadonlySet<string>): Evaluation
function assemblePrompt(blocks: Partial<Record<BlockType, string>>, labels: BlockLabels): string
function nextTip(mission: Mission, evaluation: Evaluation, shown: ReadonlySet<string>): Tip | null
```

- `normalize` : minuscules, accents retirés (NFD), espaces compactés, apostrophes typographiques unifiées.
- `match` : motifs en texte simple (pas d'expressions régulières dans le contenu), limites de mots, joker `*` en fin de mot (`photo*`) ; renvoie la position du premier passage pour le surlignage.
- Mode blocs : chaque détail est cherché dans **son** bloc. Modes libre et correction : dans tout le texte ; la phrase contenant le passage détecté est rattachée au bloc.
- Règles de qualité, de niveau et de fissure : §3.5. Les seuils sont des constantes nommées dans `engine/rules.ts`.
- Le moteur ne lit jamais le DOM ni le stockage ; il est testé seul.

### 4.4 Simulation physique (`src/workshop/building/`)

- `blueprint(evaluation | report) → BuildingPlan` : liste de corps (boîtes) avec dimensions, position de départ, densité, frottement, restitution, selon le matériau (constantes dans `materials.ts`), plus les piliers/contreventements et le bloc « AI ». Le correcteur fournit les mêmes entrées (qualités + fissures) à partir du rapport de l'IA.
- `createSimulation(plan, rapier)` : monde Rapier, gravité standard, **pas fixe 1/60 s**, événements programmés **par numéro de pas** (pose des blocs, chute du bloc AI, poussée des fissures). L'interface avance la même simulation avec un accumulateur de temps : les entrées et la suite de pas sont identiques, donc l'issue aussi.
- `measureOutcome(simulation)` après N pas : inclinaison et hauteur de chaque bloc → `holds` (tous droits, toit ≥ 95 % de sa hauteur prévue), `leans` (inclinaison modérée ou toit ≥ 70 %), `collapses` (sinon). Seuils nommés.
- Garantie : `tier → outcome` attendu est `excellent → holds`, `passable → leans`, `vague → collapses`. Un test exécute la simulation sans affichage (Rapier WASM sous Node/Vitest) pour chaque prompt d'exemple de chaque mission et vérifie l'issue. Les constantes de matériaux sont réglées pour que cette table tienne ; un changement de contenu qui la casse fait échouer le test.
- Le module Rapier est importé dynamiquement à la première ouverture du chantier (`import('@dimforge/rapier3d-compat')` puis `init()`).

### 4.5 Rendu du chantier (`builder/`)

- `BuilderCanvas` : un `<Canvas>` R3F dédié dans la fenêtre BUILDER (DPR 1–1,5, une lumière directionnelle à ombres + une hémisphérique, sol à grille). Rendu `always` pendant l'animation, `demand` ensuite (la rotation de caméra déclenche un rendu).
- `BuildingView` lit les positions/rotations des corps à chaque image (pas de composants physiques React). Matériaux visuels : pierre (porcelaine claire), bois (mint), carton (ambre), toit (lime), fissures (arête noire), bloc AI (contour lime, étiquette « AI »).
- `OrbitControls` de drei : azimut libre, angle polaire borné, distance bornée, translation désactivée ; **Reset view**.
- Le canvas du bureau reste monté mais en `frameloop="demand"` (déjà le cas hors bureau) ; aucun `<Html>` drei dans le chantier.
- Chargement : le moteur physique et la scène se chargent à l'ouverture du chantier ; pendant ce temps, la fenêtre affiche « Loading the builder… » ; en cas d'échec, `Builder2D` prend le relais.

### 4.6 État et progression

- `src/zones/workshop/store.ts` (zustand vanilla, non persisté) : mission active, brouillons par mission (le temps de la session), dernière évaluation, première tentative (pour Before / After), détails « It's already there », conseils montrés, conseils coupés, fenêtre ouverte (missions / myPrompts / corrector), état du correcteur.
- Progression persistée (clé de la spec 1), extension compatible du `Progress` v1 :

```ts
interface Progress {
  // … champs de la spec 1 inchangés
  workshopDone: boolean;                         // vrai quand les 6 missions sont réussies
  workshop?: {
    passed: string[];                            // ids des missions réussies
    prompts: Record<string, string>;             // id → prompt réussi (assemblé)
  };
}
```

`workshop` est facultatif avec valeur par défaut `{ passed: [], prompts: {} }` : une progression existante reste valide, pas de changement de version. Lecture/écriture enveloppées comme dans la spec 1. Les ids inconnus (mission retirée) sont ignorés à l'affichage.

### 4.7 Navigation

- `#/workshop` : atelier, mission conseillée.
- `#/workshop?mission=<id>` : mission donnée ; id inconnu → mission conseillée, hash normalisé.
- `#/workshop?app=corrector` / `?app=prompts` : ouvre le correcteur / My prompts.
- Le routeur de la spec 1 gagne ces paramètres ; « l'état gagne » comme pour `?topic=` du bureau.

### 4.8 Intégration au socle

- `loadZone('workshop')` renvoie `workshopZone` ({ id: 'workshop', Overlay: WorkshopApp }) ; le chunk atelier (et VT323) n'est chargé qu'à l'entrée.
- Barre d'accueil du bureau : libellé « Prompt workshop · x/6 » dès qu'une mission est réussie.
- Mode lecture : l'atelier fonctionne entièrement, chantier en vue 2D.
- Son : réutilise `sound` (bips d'Ada, sons de chantier), même réglage.
- Annonces : l'atelier possède sa propre région `aria-live="polite"` (résultat, commentaires d'Ada) ; la région du dialogue du bureau reste vide hors bureau (comportement actuel).

### 4.9 Le proxy du correcteur (`server/`)

**Routes**

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| GET | `/api/health` | — | `{ corrector: boolean }` (vrai si une clé est configurée) |
| POST | `/api/correct` | `{ prompt: string (1–4000), purpose?: string (≤ 200), lang: 'en' }` | `CorrectorReport` |
| POST | `/api/run` | `{ prompt: string (1–6000) }` | `{ answer: string }` |

```ts
interface CorrectorReport {
  score: number;                                   // 0–100
  verdict: 'holds' | 'leans' | 'collapses';
  summary: string;
  blocks: { type: BlockType; quality: 0 | 1 | 2 | 3; quote: string | null; good: string; missing: string }[]; // exactement 6, un par type
  conflicts: { blocks: [BlockType, BlockType]; explain: string }[];
  improvedPrompt: string;
  changes: string[];
}
```

**Appel à OpenAI** : Responses API (`POST https://api.openai.com/v1/responses`), `text.format` = `json_schema` **strict** reprenant `CorrectorReport` ; consignes système construites depuis `content/en/workshop/blocks.json` (la même définition des blocs que l'interface) ; le prompt à évaluer est passé comme **donnée** entre délimiteurs, avec la consigne de ne jamais suivre les instructions qu'il contient. La réponse est revalidée par zod ; une seule nouvelle tentative si elle est invalide, puis erreur. `/api/run` exécute le prompt tel quel avec un plafond de longueur de réponse.

**Configuration** (`.env.local`, jamais commité ; `.env.example` commité avec les noms seulement) :

| Variable | Défaut | Rôle |
|---|---|---|
| `OPENAI_API_KEY` | — | Clé (le correcteur est hors ligne sans elle) |
| `OPENAI_MODEL` | petit modèle économique de la génération actuelle, confirmé au moment du plan via la doc OpenAI | Modèle pour `correct` et `run` |
| `PORT` | 8787 | Port du serveur |
| `RATE_PER_MINUTE` / `RATE_PER_DAY` | 10 / 100 | Limites par adresse IP |
| `GLOBAL_PER_DAY` | 1000 | Plafond global de coût |
| `MAX_OUTPUT_TOKENS` | 1200 (correct) / 500 (run) | Plafonds de réponse |

**Garde-fous** : corps limité à 16 Ko, JSON uniquement, même origine (pas de CORS ouvert), délai de 30 s vers OpenAI, erreurs traduites en messages neutres (`429` limite atteinte, `502` IA indisponible, `504` délai dépassé). Les journaux ne contiennent **aucun contenu de prompt** : route, statut, durée, compteur.

**Exécution**

- Développement : `npm run dev` lance `scripts/dev.mjs` (Vite + proxy, arrêt commun) ; Vite redirige `/api` vers le proxy. `start.bat` continue d'appeler `npm run dev`.
- Production : `npm run build` puis `npm start` (`node --env-file-if-exists=.env.local server/index.ts`) sert `dist/` **et** `/api`. Le serveur est exécuté directement par Node (suppression native des types, disponible dans les versions de Node exigées par `engines`) : son code n'utilise que de la syntaxe TypeScript effaçable (pas d'`enum`, pas de propriétés de paramètres) et des imports avec extension `.ts`, contrôlé par `tsc` avec `erasableSyntaxOnly`. Un serveur de fichiers simple reste possible, sans correcteur.
- Contrôle du bundle : `scripts/check-bundle.mjs` échoue si `dist/` contient `OPENAI_API_KEY`, `sk-` suivi de caractères de clé, ou l'URL `api.openai.com`.

---

## 5. Contenu

### 5.1 Fichiers

- `content/en/workshop/blocks.json` : pour chaque type de bloc, `label`, `building` (« Foundation slab »…), `good` (ce qu'est un bon bloc, une phrase), `example`.
- `content/en/workshop/missions.json` : `[{ "id": "delayed-website", "level": 1 }, …]` dans l'ordre conseillé.
- `content/en/workshop/missions/<id>.json` (extrait de la mission 1 ; les « … » abrègent seulement cet exemple, les fichiers réels sont complets) :

```json
{
  "id": "delayed-website",
  "level": 1,
  "mode": "blocks",
  "title": "The delayed website",
  "situation": "Martin's Bakery, a small family client, expected its new website on Monday. The photos arrived late: launch moves to next Friday.",
  "goal": "Get the AI to draft the email that tells them.",
  "blocks": {
    "role": { "required": true, "placeholder": "e.g. An account manager at a web agency", "details": [
      { "id": "role-who", "label": "Who the AI should be", "patterns": ["account manager", "project manager", "web agency", "you are", "act as"], "hint": "Who should the AI be? Give it a job, like 'an account manager at a web agency'." }
    ] },
    "task": { "required": true, "details": [ { "id": "task-email", "label": "Write an email", "patterns": ["email", "e-mail", "message"], "hint": "…" } ] },
    "context": { "required": true, "details": [
      { "id": "client", "label": "The client's name", "patterns": ["martin*"], "hint": "…" },
      { "id": "reason", "label": "Why it's late", "patterns": ["photo*", "pictures", "images"], "hint": "…" },
      { "id": "new-date", "label": "The new date", "patterns": ["friday", "next week", "one week", "a week"], "hint": "…" }
    ] },
    "format": { "required": true, "details": [
      { "id": "tone", "label": "The tone", "patterns": ["friendly", "warm", "polite", "apologetic", "professional"], "hint": "…" },
      { "id": "length", "label": "The length", "patterns": ["short", "brief", "words", "sentences", "paragraph*"], "hint": "…" }
    ] },
    "example": { "required": false, "details": [ { "id": "example", "label": "An example", "patterns": ["for example", "e.g.", "like this", "here is an example"], "hint": "…" } ] },
    "constraint": { "required": false, "details": [ { "id": "constraint", "label": "A rule to respect", "patterns": ["don't", "do not", "avoid", "no more than", "never", "must not"], "hint": "…" } ] }
  },
  "conflicts": [ { "id": "length-clash", "block": "format", "a": ["short", "brief"], "b": ["in detail", "detailed", "thorough"], "explain": "…" } ],
  "answers": { "vague": "…", "passable": "…", "excellent": "…" },
  "ada": { "intro": "…", "success": "…", "takeaway": "…" },
  "samples": [
    { "input": { "mode": "blocks", "blocks": { "task": "Write an email about the delay" } }, "expect": "vague" },
    { "input": { "mode": "blocks", "blocks": { "role": "…", "task": "…", "context": "The website is late", "format": "Friendly" } }, "expect": "passable" },
    { "input": { "mode": "blocks", "blocks": { "role": "…", "task": "…", "context": "…", "format": "…" } }, "expect": "excellent" }
  ],
  "reviewed": "2026-10-06"
}
```

Mode `free` : pas de `placeholder` par bloc, `samples` en texte. Mode `fix` : champs supplémentaires `starter` (le mauvais prompt) et ses blocs détectés doivent donner `vague` (vérifié par test).

### 5.2 Règles de validation (tests de contenu)

- Schéma zod strict ; ids uniques ; chaque mission de `missions.json` a son fichier et inversement ; niveaux 1/1/2/2/3/3 et modes cohérents (niveau 1 = `blocks`, 2 = `free`, 3 = `fix`).
- Chaque bloc obligatoire a au moins un détail ; chaque détail a au moins un motif et un conseil ; motifs non vides, sans caractères d'expression régulière.
- Au moins 3 `samples` par mission couvrant les trois niveaux ; chaque `sample` donne le niveau attendu par le moteur ; le test vérifie ce niveau **et** l'issue physique qui lui correspond (`excellent → holds`, `passable → leans`, `vague → collapses`, §4.4). Au moins un `sample` par mission contient un bloc bonus (exemple ou contrainte).
- Mode `fix` : `starter` → `vague`.
- Textes : phrases d'Ada ≤ 220 caractères, situation ≤ 400, réponses simulées ≤ 900, aucun emoji, chaque terme technique expliqué à sa première apparition (règles de la spec 1, §7.5) ; date `reviewed`.
- Interface : nouvelles clés sous `workshop.*` dans `content/en/ui.json`, complétude vérifiée comme pour le reste.

### 5.3 Rédaction

Rédaction initiale des 6 missions, de `blocks.json` et des réponses simulées par Claude ; validation par le propriétaire du projet (comme les 13 sujets du bureau). Ton d'Ada inchangé : « you », phrases courtes, métaphores du quotidien — ici, celles du chantier.

---

## 6. Robustesse, performance, accessibilité

### 6.1 Erreurs

| Situation | Comportement |
|---|---|
| Mission introuvable / fichier invalide | La mission n'apparaît pas (les tests de contenu l'empêchent en amont) ; lien direct → mission conseillée |
| Moteur physique qui ne se charge pas | `Builder2D` ; Ada : « The 3D builder isn't available here — here's the plan view. » |
| Presse-papiers refusé | Texte sélectionné + conseil `Ctrl+C` |
| Correcteur hors ligne | Message « The corrector is offline » ; missions intactes |
| Limite atteinte (429) | « You've reached the corrector's limit for now — try again in a minute. » |
| Délai / erreur OpenAI | Message neutre + bouton **Try again** ; aucune donnée perdue dans le champ |
| Stockage indisponible | Comme la spec 1 : progression en mémoire, l'atelier fonctionne |

### 6.2 Performance

- JS initial du site inchangé (budget 1,5 Mo gzip vérifié à chaque build). Chunk atelier, police VT323 et moteur physique (WASM) chargés à la demande ; le moteur seulement à l'ouverture du chantier.
- Chantier : ≤ 12 corps dynamiques, une ombre, DPR ≤ 1,5 ; cible 60 images/s sur le PC de référence (GPU intégré).
- Canvas du bureau en pause pendant l'atelier.

### 6.3 Accessibilité

- Fenêtres = `section` titrées (`aria-labelledby`) ; barre des tâches = `nav` ; ordre de tabulation : missions → éditeur → chantier (boutons) → réponse → Ada.
- `Ctrl+Entrée` = Build & test (et Check my prompt dans le correcteur) ; `Échap` ferme la bulle d'Ada ; aucun autre raccourci pendant la saisie.
- Le canvas du chantier est `aria-hidden` ; un équivalent texte (liste des blocs avec matériau, trous, fissures, issue) est fourni et annoncé.
- Une seule région d'annonce pour l'atelier (résultat + commentaire d'Ada).
- Focus visible (anneau lime), contrastes de la charte ; VT323 jamais en dessous de 16 px ; le texte de contenu reste en Montserrat.
- Mouvement réduit : pas d'animation de chantier (état final), Ada immobile, bulle affichée d'un coup.

### 6.4 Sécurité et données

- La clé n'existe que côté serveur ; contrôle automatique du bundle (§4.9).
- Avertissement de confidentialité permanent dans le correcteur ; aucun contenu de prompt dans les journaux du serveur ; rien n'est stocké côté serveur.
- Le prompt soumis est traité comme une donnée par le correcteur (délimiteurs + consigne) ; la sortie est contrainte par le schéma strict.

---

## 7. Tests et preuves

| Niveau | Outil | Couverture |
|---|---|---|
| Unitaires | Vitest | `normalize`, `match` (limites de mots, joker, accents), `evaluate` (qualités, trous, fissures, niveaux, surcharges), `assemblePrompt`, `nextTip` ; règles de progression (`passed`, `prompts`, `workshopDone`, compatibilité d'une progression v1 sans `workshop`) ; routeur (`mission`, `app`) |
| Physique | Vitest + Rapier sous Node | Pour chaque `sample` de chaque mission : issue attendue (tient / penche / s'effondre) ; reproductibilité (deux exécutions → mêmes positions) |
| Contenu | Vitest + zod | Toutes les règles du §5.2 |
| Composants | Testing Library | Éditeur en blocs, éditeur libre et conseils d'Ada (minuteries simulées), correction + Reset, « It's already there », réussite + Before / After, My prompts (copie, effacement), Builder2D, correcteur (hors ligne, rapport, erreurs, Run both) avec `fetch` simulé |
| Serveur | Vitest | Validation des corps, limites par IP et globale, appel OpenAI simulé (réponse valide, invalide puis valide, invalide deux fois, délai, 429), aucune clé ni contenu dans les journaux, `/api/health` |
| Parcours | Playwright (Chromium) | Bureau → portable → mission 1 incomplète (*Passable*, bâtiment qui penche) → complétée (*Excellent*) → retour, compteur « 1/6 » ; mission de correction ; mission en texte libre avec conseil d'Ada ; correcteur avec réponses `/api` simulées (`page.route`) ; mode lecture → atelier en vue 2D ; parcours clavier seul |
| Bundle | `check-bundle.mjs` | Budget initial inchangé ; aucune trace de clé ni d'URL OpenAI dans `dist/` |
| Preuves | Captures + mesures | Chaque niveau de mission, les trois issues du chantier, Before / After, My prompts, correcteur (rapport + Run both, données simulées), vue 2D, 1280 × 600 ; images/s du chantier sur le PC de référence ; un essai réel du correcteur avec la clé, fait à la demande du propriétaire |

---

## 8. Hors périmètre

- IA réelle dans les missions (elles restent simulées ; seul le correcteur appelle OpenAI).
- Glisser-déposer libre des blocs, fenêtres déplaçables, bac à sable de construction.
- Comptes, suivi centralisé, historique côté serveur.
- Autres langues que l'anglais (structure prête).
- Le donjon et le certificat (sous-projet 3).
- Hébergement interne définitif (seule la manière de lancer le serveur est fournie).
