# Athena Prompt Academy — Spec 1 : socle et bureau

- **Date** : 2026-09-29
- **Statut** : en revue
- **Périmètre** : sous-projet 1 sur 3 (socle technique + zone « bureau »)
- **Specs suivantes** : 2 — Atelier prompt (laptop) · 3 — Donjon (test + certificat)

---

## 1. Objectif

Un site web interactif en 3D (three.js) pour apprendre à prompter, destiné à un **usage interne** (employés Spotzer / Online Essentials). Le site est en **anglais** d'abord, conçu dès le départ pour devenir **multilingue**.

L'expérience se déroule dans un bureau 3D. Un robot assistant, **Ada**, y explique les bases de l'IA générative sous forme de dialogue, pendant qu'un grand écran mural affiche des schémas. Depuis ce bureau, on accède à deux autres zones : l'**atelier prompt** (via un ordinateur portable posé sur la table) et le **donjon** (via une télé cathodique et une console rétro).

### Public et contraintes

| Contrainte | Valeur |
|---|---|
| Public | Mixte : non-techniques (commercial, support) et techniques. Chaque sujet a une partie vulgarisée et une partie « Go deeper ». |
| Appareils | **PC uniquement** (Chrome / Edge récents, écran ≥ 1280 × 720). Pas de version mobile. |
| Données | Aucun backend, aucun compte. Progression stockée localement dans le navigateur. |
| Charte | Athena (extension « dark editorial » d'Online Essentials) : couleurs, typographies, logo. |
| Langue | Interface et contenu en anglais ; architecture i18n dès la v1. |

### Critères de succès (sous-projet 1)

1. Le site s'ouvre sur la **vue d'ensemble** du bureau ; la molette amène à la **vue présentation** et en revient.
2. Les **13 sujets** sont accessibles, chacun avec sa partie simple, sa partie « Go deeper », ses visuels synchronisés et sa phrase-clé.
3. La progression (sujets vus) survit à un rechargement de page.
4. Le portable et la télé sont cliquables : vol de caméra → écran « Coming soon » de la zone → retour au bureau.
5. La démo interactive **Tokens** découpe une phrase saisie par l'utilisateur avec un vrai tokenizer.
6. Le **mode lecture** (sans 3D) s'active quand WebGL est indisponible et donne accès au même contenu.
7. Tout le parcours est faisable **au clavier seul**.
8. 60 images/s visées sur le PC de référence (portable de bureau à GPU intégré) ; mesure fournie.
9. Tous les tests passent ; tout le contenu est validé automatiquement.
10. Respect de la charte : palette, typographies, une seule ligne Playfair italique par écran, aucun emoji.

---

## 2. Découpage du projet

| # | Sous-projet | Contenu | Spec |
|---|---|---|---|
| 1 | **Socle + bureau** | Architecture, charte, i18n, progression, bureau 3D, Ada, 13 sujets, écran mural, points d'entrée vers 2 et 3 | **Ce document** |
| 2 | Atelier prompt | Interface « PC classique », construction d'un prompt, Ada en assistant façon Clippy | À écrire |
| 3 | Donjon | Dungeon crawler rétro à la 1re personne, pixel art 3D, filtre vieille console, quiz, éjection après 3 erreurs, certificat téléchargeable | À écrire |

Le socle est conçu pour accueillir 2 et 3 sans modification de ses interfaces.

---

## 3. Décisions prises

| Sujet | Décision | Raison |
|---|---|---|
| Stack | React + React Three Fiber + drei, Vite, TypeScript | Interface riche (dialogues, faux PC, certificat) + 3D ; stack déjà maîtrisée |
| Réalisme | Stylisé « premium », entièrement procédural (code) | Cohérent avec Athena, léger, aucun problème de licence ; remplaçable par des modèles GLB plus tard |
| Robot | Original, inspiré de l'esprit d'EVE (Wall-E) sans la copier ; nommé **Ada** | Droits d'auteur Pixar/Disney |
| Console du donjon | Style « années 90 » original, pas de réplique SNES | Trade dress Nintendo |
| Résultats | Rien d'enregistré côté serveur ; certificat téléchargeable en fin de donjon (spec 3) | Pas de backend, pas de données personnelles stockées |
| Voix d'Ada | Bips synthétisés au rythme du texte (pas de TTS) | Indépendant de la langue, zéro asset |
| Moteur externe | Rogue Engine écarté | Son propre framework de composants et format de scène, incompatible avec R3F ; licence entreprise à payer |

---

## 4. Architecture globale

### 4.1 Stack et versions (vérifiées le 2026-09-29)

| Paquet | Version | Rôle |
|---|---|---|
| react / react-dom | 19.3 | UI |
| three | 0.186 | Moteur 3D |
| @react-three/fiber | 9.8 | three.js en React (peer : react ≥ 19 < 19.4) |
| @react-three/drei | 10.7 | Helpers : `Html`, `CameraControls`, `ContactShadows`, `PerformanceMonitor`, `useProgress`, `TransformControls` |
| maath | 0.10 | Amortissements (`easing.damp`) |
| zustand | 5 | État global |
| i18next / react-i18next | 26 / 17 | Traductions |
| zod | 4 | Validation du contenu |
| gpt-tokenizer | 4 | Démo Tokens (chargée à la demande) |
| leva | 0.10 | Mode réglage (dev uniquement) |
| @fontsource/montserrat, @fontsource/playfair-display | 5.3 | Polices auto-hébergées (pas d'appel à Google Fonts) |
| vite / @vitejs/plugin-react | 8 / 6 | Build |
| typescript | 7 si Vite, Vitest et la vérification de types le supportent sans friction ; sinon 5.9. Vérifié à la 1re étape du plan. | Typage |
| vitest / @testing-library/react / @playwright/test | 5 / 16 / 1.63 | Tests |

`@react-three/postprocessing` n'est **pas** installé dans ce sous-projet (utile au donjon, spec 3).

### 4.2 Organisation du code

```
src/
  app/            App, coquille, navigation entre zones, transitions, ErrorBoundary
  core/
    store.ts      état global (zustand)
    progress.ts   lecture/écriture de la progression (localStorage)
    i18n.ts       configuration i18next
    brand.ts      constantes de couleur pour la 3D (miroir des tokens CSS)
    router.ts     synchronisation zone ↔ hash d'URL
  brand/          oe-tokens.css, athena.css, logo-mark.svg (copiés depuis la charte)
  ui/             composants DOM Athena : Button, Kicker, DialogueBox, TopicMenu, Hud, LoadingScreen
  three/
    materials.ts  matériaux partagés (porcelaine, bois sombre, tissu, émissif lime)
    objects.ts    registre des objets (procédural ↔ GLB)
    robot/        Ada : géométrie, visage, animations, humeurs, gestes
  dialogue/       moteur de dialogue (TS pur, sans React)
  zones/
    office/       scène du bureau, rail de caméra, interactions, overlay
    workshop/     écran « Coming soon » (sous-projet 2)
    dungeon/      écran « Coming soon » (sous-projet 3)
  visuals/        visuels de l'écran mural (un dossier par sujet) + registre
content/
  en/
    ui.json
    chapters.json
    topics/<id>.json
tests/
  e2e/            Playwright
```

### 4.3 Un seul canvas, des zones interchangeables

- Un **unique `<Canvas>` R3F** est monté pour toute la vie de l'application. Les transitions entre zones (vol de caméra puis fondu) sont donc continues.
- Chaque zone respecte le même contrat :

```ts
type ZoneId = 'office' | 'workshop' | 'dungeon';

interface ZoneModule {
  id: ZoneId;
  Scene?: React.ComponentType;   // rendu dans le Canvas partagé
  Overlay?: React.ComponentType; // DOM par-dessus le Canvas
}

// chargement paresseux : chaque zone est un import dynamique
const zones: Record<ZoneId, () => Promise<ZoneModule>>;
```

- Le socle ne connaît rien de l'intérieur des zones. Changer de zone : `goTo(zone, { via?: 'laptop' | 'tv' })`. Le paramètre `via` déclenche le vol de caméra vers l'objet avant le fondu.
- Quand une zone sans scène 3D est active (ex. atelier plein écran DOM), le canvas passe en `frameloop="demand"` (rendu en pause).

### 4.4 État global (zustand)

```ts
interface AppState {
  zone: ZoneId;
  office: {
    railT: number;             // 0 = vue d'ensemble, 1 = vue présentation
    activeTopic: string | null;
  };
  dialogue: DialogueState | null; // voir §6.4
  progress: Progress;            // voir §4.6
  settings: { sound: boolean; lang: 'en' };
  webgl: 'ok' | 'unavailable';   // détecté au démarrage
}
```

### 4.5 Navigation par l'URL

- `#/office`, `#/workshop`, `#/dungeon` : zone active.
- `#/office?topic=tokens` : ouvre directement un sujet en vue présentation.
- Hash inconnu → `#/office`. Le bouton « précédent » du navigateur revient à la zone précédente.

### 4.6 Progression

- Clé `localStorage` : `athena-prompt-academy:v1`.

```ts
interface Progress {
  version: 1;
  topicsSeen: string[];        // un sujet est « vu » quand sa partie simple est terminée
  deeperSeen: string[];        // parties « Go deeper » terminées
  workshopDone: boolean;       // renseigné par la spec 2
  dungeon: { passed: boolean; bestScore: number } | null; // renseigné par la spec 3
  firstVisitDone: boolean;     // masque les indications de première visite
}
```

- Toute lecture/écriture est enveloppée dans un `try/catch`. Stockage indisponible ou donnée corrompue / de version inconnue → progression vide en mémoire, le site fonctionne normalement.
- Les réglages (`sound`, `lang`) sont stockés sous la clé séparée `athena-prompt-academy:settings`.

### 4.7 Charte dans le code

- `oe-tokens.css` et `athena.css` sont copiés tels quels dans `src/brand/`. Le `@import` Google Fonts de `fonts.css` est remplacé par les paquets `@fontsource` (Montserrat 400/500/600/700/800, Playfair Display 700 italique).
- `core/brand.ts` expose les mêmes couleurs pour les matériaux 3D : `ink #0B0D0E`, `surface1 #121517`, `surface2 #181C1F`, `surface3 #1F2429`, `lime #58FC73`, `mint #4DDBB8`, `blueGrey #2F4858`, `onDark #F4F6F5`, `warn #FF9500`, `danger #EF4444`.
- Règles de la charte appliquées partout : un seul accent (lime) pour l'action et le « bon » ; une seule ligne Playfair italique par écran ; boutons en pilule ; pas d'emoji ; pas de glassmorphism.

### 4.8 Registre d'objets (procédural ↔ GLB)

Chaque objet de la scène (`Robot`, `Laptop`, `CrtTv`, `RetroConsole`, `Sofa`, `Chair`, `Table`, `WallScreen`, `LogoCubes`…) est obtenu via le registre `three/objects.ts`. Par défaut il renvoie le composant procédural ; si un fichier `public/models/<nom>.glb` est déclaré dans le registre, il renvoie le modèle chargé à la place, avec les mêmes props (position, rotation, échelle, callbacks d'interaction). Aucun GLB n'est livré dans ce sous-projet.

### 4.9 Traductions

- Aucune chaîne visible dans le code : tout passe par `t('…')` (UI) ou par les fichiers de contenu (sujets).
- Ajouter une langue = créer `content/<lang>/` avec la même structure. Un test vérifie que chaque langue présente possède toutes les clés et tous les sujets de `en`.
- Sélecteur de langue dans le HUD : affiché, avec la seule entrée `EN` en v1.

---

## 5. Zone « bureau »

### 5.1 Décor

Salle de réunion sombre inspirée de la photo de référence, traduite en Athena :

- Murs en `surface1`/`surface2`, **gorge lumineuse chaude** au plafond (bande émissive + lumière rectangulaire) et sous le meuble bas du mur du fond.
- **Table ovale** en bois sombre, fauteuils arrondis en tissu gris chaud tout autour, 4 à 6 micros de conférence (détail).
- **Fenêtre** sur le mur gauche : plan émissif en dégradé « fin de journée », voilage.
- **Logo Athena en cubes 3D** (5 blocs lime/mint/noir, proportions de `logo-mark.svg`) sur le mur droit, légèrement émissif.
- **Écran mural** au centre du mur du fond (voir §7).
- **Coin salon** côté droit de la pièce : un **canapé** face à une **télé cathodique** posée sur un meuble bas contre le mur, avec la **console années 90** (boîtier gris arrondi, boutons rappelant les carrés du logo) reliée par un câble. La télé affiche un écran titre en pixel art avec « PRESS START » clignotant.
- **Portable** ouvert sur la table, côté caméra, écran faiblement lumineux.

Éclairage : une lumière d'ambiance chaude, une lumière principale qui projette des ombres (carte d'ombre 1024), les bandes émissives, `ContactShadows` statiques sous Ada et sous les objets de la table.

### 5.2 Deux vues et le rail de caméra

| Vue | `railT` | Position | Cadre |
|---|---|---|---|
| **Vue d'ensemble** (défaut) | 0 | Entrée de la pièce, légèrement surélevée | Toute la salle : table + portable, Ada et l'écran au fond, logo, coin salon à droite |
| **Vue présentation** | 1 | Milieu de la table, hauteur d'yeux assis | Ada à gauche, écran mural ≈ 60 % de la largeur de la fenêtre |

- La position et le point visé suivent deux courbes (`CatmullRomCurve3`) paramétrées par `railT`.
- **Molette** (sur le canvas uniquement, pas sur les panneaux DOM) : fait varier une cible `railT` ∈ [0, 1] ; la valeur affichée la rejoint avec `easing.damp` (mouvement amorti, bornes fermes).
- **Clavier** : ↑ / ↓ déplacent la cible de 0,25 ; `Home` / `End` vont aux extrémités.
- **Choisir un sujet** anime `railT` jusqu'à 1.
- **Parallaxe souris** : quelques degrés de rotation de la caméra autour de sa position, amortie ; désactivée en `prefers-reduced-motion`.
- Première visite : indication discrète « Scroll to take a seat » en vue d'ensemble, disparaît au premier défilement.

### 5.3 Interactions

- **Objets cliquables** : portable, télé/console (et Ada, qui fait un geste de salut au clic).
- **Survol** : contour lime via le composant `Outlines` de drei (coque inversée, sans post-traitement), curseur `pointer`, étiquette DOM (« Prompt Workshop », « The Dungeon »).
- **Clic sur le portable** : vol de caméra (≈ 1,2 s) jusqu'à ce que l'écran du portable remplisse la vue → fondu → `goTo('workshop')`.
- **Clic sur la télé** : vol de caméra jusqu'à l'écran de la télé → effet de neige / changement de chaîne (≈ 0,6 s) → `goTo('dungeon')`.
- Les deux clics fonctionnent depuis n'importe quelle position du rail.
- **Écrans « Coming soon »** (workshop, dungeon) : carte Athena plein écran, titre de la zone, une phrase d'annonce, bouton **Back to the office** qui ramène à la vue d'ensemble.

### 5.4 Interface par-dessus la 3D (DOM)

- **HUD haut** : à gauche le logo et « Athena Prompt Academy » ; à droite sélecteur de langue, bouton son, compteur « n/13 topics ».
- **Barre d'accueil** (vue d'ensemble, aucun sujet actif) : message d'accueil d'Ada et trois boutons pilule — **Learn the basics** (→ vue présentation + menu des sujets), **Prompt workshop** (= clic portable), **The dungeon** (= clic télé). C'est l'alternative accessible aux clics 3D.
- **Bulle de dialogue** (bas de l'écran, carte Athena) : texte d'Ada en machine à écrire ; indicateur « suivant ».
- **Menu des sujets** : onglets par chapitre, sujets en pilules ; un sujet vu porte une coche lime ; les parties « Go deeper » vues ont un second indicateur.
- Première visite : Ada signale « Psst — the laptop and the old console are clickable too. »

---

## 6. Ada, le robot

### 6.1 Apparence (procédurale)

- **Tête** : sphère aplatie (≈ 1 : 0,85), séparée du corps par un espace (flotte au-dessus). Matériau porcelaine : `MeshPhysicalMaterial` blanc, `clearcoat` élevé, rugosité faible.
- **Visière** : calotte noire brillante couvrant l'avant de la tête.
- **Yeux** : deux formes lime (`#58FC73`) émissives dessinées dans une `CanvasTexture` appliquée à la visière, redessinée uniquement quand l'expression ou le clignement change.
- **Corps** : forme d'œuf effilée vers le bas (`LatheGeometry`), même porcelaine, fine ligne mint (`#4DDBB8`) en ceinture, logo 5 carrés en léger relief sur la poitrine.
- **Bras** : deux ailerons allongés (ellipsoïdes étirés) flottant le long du corps, sans épaule visible.
- **Pas de jambes** ; halo lime très doux et ombre de contact sous le robot.
- Différences délibérées avec EVE : yeux lime, logo, tête plus ronde, visière plus large, ligne mint.

### 6.2 Animations (procédurales, `useFrame`)

Couches additives, toutes amorties :

| Couche | Comportement |
|---|---|
| Flottement | Sinusoïde verticale lente, légère oscillation |
| Regard | Les yeux et la tête suivent légèrement la souris |
| Clignement | Aléatoire, toutes les 3 à 6 s |
| Parole | Pulsation des yeux et petits hochements pendant l'écriture du texte |
| Geste | Déclenché par une réplique (voir 6.3) |

`prefers-reduced-motion` : flottement et gestes réduits à des mouvements minimes, pas de rotation complète.

### 6.3 Humeurs et gestes

- **Humeurs** (forme des yeux) : `neutral`, `happy` (^ ^), `thinking` (points qui défilent), `surprised` (grands ronds), `encouraging` (clin d'œil).
- **Gestes** : `none`, `wave`, `pointScreen` (le corps pivote vers l'écran, un bras se tend), `spin` (tour complet, contente), `nod`, `shrug`.

### 6.4 Moteur de dialogue (`src/dialogue/`)

TypeScript pur, sans React, testable isolément.

```ts
type Section = 'basics' | 'deeper';

interface DialogueState {
  topicId: string;
  section: Section;
  beatIndex: number;
  phase: 'typing' | 'waiting' | 'choices';
}

// actions
start(topicId): DialogueState
advance(state): DialogueState        // termine l'écriture, ou passe à la réplique suivante, ou → 'choices'
chooseDeeper(state): DialogueState   // section = 'deeper', beatIndex = 0
```

- En fin de `basics` : choix **Go deeper** · **Next: \<titre du sujet suivant\>** · **All topics** ; le sujet est marqué vu.
- En fin de `deeper` : choix **Next: …** · **All topics** ; la partie approfondie est marquée vue.
- Chaque réplique qui porte `screen` fait passer le visuel de l'écran mural à cette étape ; `mood` et `gesture` pilotent Ada.
- Contrôles : clic sur la bulle ou `Espace` / `Entrée` = `advance` ; `Échap` = retour au menu des sujets.

### 6.5 Son

- **Bips d'Ada** : générés via Web Audio (oscillateur court, hauteur légèrement aléatoire autour d'une note de base, un bip toutes les 2 à 3 lettres, silence sur la ponctuation).
- **Ambiance** : fond sonore de pièce très discret, synthétisé (bruit filtré) — aucun fichier audio requis.
- Le son démarre au premier clic de l'utilisateur (contrainte des navigateurs) ; bouton son dans le HUD ; réglage mémorisé.

### 6.6 Réutilisation

`<Ada />` est un composant autonome (props : `mood`, `gesture`, `speaking`, `lookAt`). L'atelier (spec 2) pourra l'afficher dans une petite vue 3D incrustée (`View` de drei) en assistant façon Clippy.

---

## 7. Contenu et écran mural

### 7.1 Les 13 sujets

| Chapitre (`chapter`) | Sujets (`id` — titre) |
|---|---|
| `basics` — The basics | `what-is-ai` — What is AI? · `generative-ai` — What is generative AI? · `llm` — What is an LLM? |
| `how-it-works` — How it works | `tokens` — Tokens · `context-window` — The context window · `hallucinations` — Why AI makes things up |
| `talking-to-ai` — Talking to AI | `prompt` — What is a prompt? · `multimodal` — Multimodal AI |
| `going-further` — Going further | `agents` — Agents · `tools` — Tools · `skills` — Skills · `mcp` — MCP |
| `bonus` — Bonus | `ai-safety-at-work` — Using AI safely at work |

Le sujet `prompt` se termine en invitant à ouvrir le portable (atelier). Exemples d'outils cités de façon générique (« an assistant like ChatGPT, Claude or Copilot »).

### 7.2 Format des fichiers

```
content/en/ui.json            chaînes d'interface (clé → texte)
content/en/chapters.json      [{ "id": "basics", "title": "The basics" }, …] dans l'ordre
content/en/topics/<id>.json   un fichier par sujet
```

```json
{
  "id": "tokens",
  "chapter": "how-it-works",
  "title": "Tokens",
  "teaser": "How AI actually reads your words",
  "reviewed": "2026-09-29",
  "basics": [
    { "say": "…", "mood": "happy", "gesture": "pointScreen", "screen": "tokens:1" }
  ],
  "deeper": [
    { "say": "…", "screen": "tokens:4" }
  ],
  "takeaway": "AI reads chunks, not words — and every chunk counts.",
  "next": "context-window"
}
```

Règles validées par un schéma zod (test automatique) :

- `id` unique, égal au nom du fichier ; `chapter` existe dans `chapters.json`.
- `basics` et `deeper` non vides ; chaque `say` ≤ 220 caractères.
- `mood` et `gesture` ∈ listes du §6.3.
- `screen` au format `<visualId>:<step>` ; le visuel existe dans le registre et l'étape ≤ son nombre d'étapes.
- `next` pointe vers un sujet existant, ou vaut `null` pour le dernier.
- Pas d'emoji dans les textes.

### 7.3 Visuels de l'écran mural

- L'écran mural contient du DOM réel via `<Html transform>` de drei (texte net, traduisible, SVG animable).
- Chaque visuel est un composant React `({ step }: { step: number }) => JSX` qui se construit progressivement, enregistré dans `visuals/registry.ts` avec son nombre d'étapes et une **description textuelle** (accessibilité).
- Bouton **Expand** : ouvre le visuel courant dans un calque DOM plein écran (hors 3D), mêmes étapes.

| Sujet | Visuel |
|---|---|
| `what-is-ai` | Cercles imbriqués : AI ⊃ machine learning ⊃ deep learning ⊃ generative AI |
| `generative-ai` | « Reconnaître » (étiquette sur une photo) vs « créer » (texte/image générés à partir d'une description) |
| `llm` | Phrase à compléter + barres de probabilité des mots suivants ; « trained on a huge library » |
| `tokens` | Phrase découpée en morceaux colorés + compteur ; **démo interactive** (§7.4) |
| `context-window` | Fenêtre qui glisse sur une longue conversation ; les anciens messages sortent du cadre |
| `hallucinations` | Réponse assurée mais fausse vs réponse vérifiée ; « plausible ≠ true » |
| `prompt` | Anatomie d'une consigne : rôle, tâche, contexte, format → invitation vers le portable |
| `multimodal` | Entrées texte / image / audio → modèle → sorties |
| `agents` | Boucle autour d'un objectif : plan → act → observe → repeat |
| `tools` | L'IA appelle calculatrice / recherche / agenda et reçoit le résultat |
| `skills` | Classeur de fiches-recettes que l'IA ouvre quand la tâche le demande |
| `mcp` | Métaphore USB-C : une prise standard qui relie l'IA à de nombreux outils et sources |
| `ai-safety-at-work` | Feu tricolore : vert (info publique), orange (anonymiser), rouge (jamais : données clients, mots de passe, confidentiel) + « verify before you share » |

Règles de lisibilité : texte ≥ 20 px équivalent en vue présentation sur un écran 1080p ; ≤ 12 mots par libellé ; fond `surface1` ; lime pour l'élément à regarder ; une seule ligne Playfair italique par visuel (le titre).

### 7.4 Démo Tokens

- Champ texte pré-rempli (« Prompting is a skill you can learn. »), l'utilisateur tape sa phrase.
- Découpage par `gpt-tokenizer` (encodage `o200k_base`), chargé en import dynamique à l'ouverture de la démo uniquement.
- Affichage : chaque token en pastille colorée (alternance de 2 teintes neutres + lime au survol), compteur « n tokens · m characters ».
- Mention : « Each AI model splits text a little differently. »
- Échec du chargement du tokenizer → message « The live demo couldn't load. » et le visuel animé reste disponible.

### 7.5 Rédaction

- Rédaction initiale des 13 sujets (basics + deeper) en anglais par Claude, validation par le propriétaire du projet.
- Ton d'Ada : tutoiement (« you »), phrases courtes, métaphores du quotidien, chaque terme technique expliqué à sa première apparition, aucun emoji, pas de jargon marketing.
- Chaque fichier porte une date `reviewed`.
- Les identifiants de sujets serviront au donjon (spec 3) pour renvoyer vers le sujet à revoir.

---

## 8. Robustesse, performance, accessibilité

### 8.1 Chargement

- Écran de chargement Athena (logo + barre de progression `useProgress`).
- Objectif : bureau affiché en < 3 s sur le réseau de l'entreprise.
- Chargés à la demande : zones `workshop` et `dungeon`, tokenizer, visuels lourds.
- Budget : JavaScript initial ≤ 1,5 Mo compressé (gzip) ; vérifié à chaque build.

### 8.2 Performance

- Cible : 60 images/s sur un portable de bureau à GPU intégré.
- Une seule lumière à ombres ; `ContactShadows` en `frames={1}` (calculées une fois).
- `PerformanceMonitor` : en cas de baisse, réduction du `dpr` (1,5 → 1) puis désactivation des ombres dynamiques.
- Rendu en pause (`frameloop="demand"`) quand une zone DOM plein écran est active ou que l'onglet est masqué.

### 8.3 Mode lecture (sans 3D)

- Au démarrage, test de disponibilité de WebGL 2. Indisponible → mode lecture automatique : menu des sujets, bulle de dialogue et visuels de l'écran affichés en page 2D, mêmes contenus et même moteur de dialogue ; accès aux écrans « Coming soon » par boutons.
- Perte de contexte WebGL en cours de session → bascule en mode lecture avec un message.
- Le mode lecture est aussi accessible manuellement (lien « Reading mode » dans le HUD).

### 8.4 Erreurs

- `ErrorBoundary` par zone : carte Athena « Something went wrong » + bouton **Back to the office**.
- Progression illisible ou stockage indisponible → progression vide, aucune erreur visible.
- Contenu invalide : bloqué par les tests avant mise en ligne ; en exécution, un sujet invalide est masqué du menu plutôt que de planter.

### 8.5 Accessibilité

- Parcours complet au clavier : `Tab` / `Maj+Tab`, `Entrée`, `Espace` (dialogue), `↑`/`↓` (rail), `Échap` (retour).
- Focus visible (anneau lime) sur tous les éléments interactifs.
- `prefers-reduced-motion` : vols de caméra remplacés par des fondus, texte affiché d'un coup, parallaxe et gestes amples désactivés.
- Visuels de l'écran : description textuelle exposée aux lecteurs d'écran ; bulle de dialogue en `aria-live="polite"`.
- Contrastes conformes aux couleurs de la charte (texte clair sur `ink`/`surface`).

### 8.6 Cible technique

Chrome et Edge récents ; écran ≥ 1280 × 720. En dessous : message conseillant un écran plus grand (le site reste utilisable).

---

## 9. Tests et preuves

| Niveau | Outil | Couverture |
|---|---|---|
| Unitaires | Vitest | Moteur de dialogue ; progression (lecture, écriture, stockage indisponible, données corrompues) ; store (navigation entre zones, rail) ; router (hash ↔ zone) |
| Contenu | Vitest + zod | Toutes les règles du §7.2 ; complétude des traductions ; cohérence visuels ↔ étapes |
| Composants | Testing Library | DialogueBox, TopicMenu, Hud, barre d'accueil, écrans « Coming soon », mode lecture |
| Parcours | Playwright (Chromium) | Chargement → vue d'ensemble → molette vers vue présentation → choisir un sujet → dérouler → Go deeper → compteur mis à jour → rechargement (progression conservée) → clic portable → Coming soon → retour → clic télé → Coming soon → retour ; parcours clavier seul ; mode lecture forcé |
| Preuves | Captures | Vue d'ensemble, vue présentation, un visuel par chapitre, écrans Coming soon, mode lecture ; mesure d'images/s sur le PC de référence ; taille du bundle |

Les interactions 3D sont testées en E2E via des attributs de test sur le DOM et une API de test (`window.__academy.clickObject('laptop')`), pas par des coordonnées de pixels. Cette API n'existe que dans le serveur de développement Vite (`import.meta.env.DEV`) ; Playwright tourne contre ce serveur, et le build de production ne l'inclut pas.

---

## 10. Outils de développement

- **Mode réglage** (`?tune`, développement uniquement) : panneau `leva` + `TransformControls` de drei pour déplacer les objets du décor et les points du rail de caméra, avec bouton « copier les valeurs » vers le presse-papiers.
- Script `npm run check` : types + tests + validation du contenu + build.

---

## 11. Déploiement

Build statique (`vite build` → `dist/`), hébergeable sur n'importe quel serveur de fichiers statiques. Le choix de l'hébergement interne n'est pas couvert par cette spec et ne bloque pas le développement.

---

## 12. Hors périmètre de cette spec

- Contenu et interactions de l'**atelier prompt** (spec 2).
- **Donjon**, quiz, éjection, **certificat** (spec 3).
- Langues autres que l'anglais (l'architecture les permet ; traductions non livrées).
- Modèles GLB réalisés dans Blender ou générés par IA.
- Toute forme de backend, compte utilisateur ou suivi centralisé.
- Voix de synthèse (TTS).
