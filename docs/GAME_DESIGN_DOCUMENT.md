# MUSHROOM FOREST

## A cozy breeding, collecting, and forest-life game

**Game Design Document | Version 0.9 | November 2026**

> **Design direction:** Begin with three ordinary mushrooms. Breed them,
> generation by generation, into prized specialists. Give them meaningful
> work, grow a shared forest ecosystem, and trade exceptional genetics
> with friends.

---

## 0. Document Control

### 0.1 Change log

| Version | Date | Summary |
|---|---|---|
| 0.1 | Nov 2026 | Initial design: forest, jobs, breeding, sharing, MVP scope. |
| 0.2 | Nov 2026 | Expansion: three randomized starters; eight job stats; attribute-driven base stats; RGB colour stat budget; Advanced Traits; Perks; Mutations; stat caps; ordered breeding resolution; staged breeding unlocks; discovery-driven job unlocks; friend genetic donors; forest clock and weather; centralized configuration; anti-exploit rules; required test plan. Conflicts with v0.1 are resolved in place and listed in Appendix A. |
| 0.3 | Nov 2026 | Owner decisions D-1 to D-15 applied (Appendix B): Rare attributes slightly stronger; Perks, Mutations and Weather/Time promoted to MVP Must-have; day/night follows real local time; one free breeding, then the soft currency **Glimmer**; development stages strictly linear in the listed order; balance simulation of 20+ generations required before probabilities are locked. |
| 0.4 | Nov 2026 | One continuous forest (D-16): every clearing and job lives on the same forest screen. The forest grows when the player expands it north, east, south or west of a clearing; each story clearing's structures spawn at random positions in the new clearing. Quiet glades (plain clearings) can be bought for building space after the Woodland Workshop. Save schema 2 with migration. |
| 0.5 | Nov 2026 | Wild, randomly generated expansions that must be cleaned up (clutter and thicket) and organised (every structure can be moved); a river that grows with each expansion and must be bridged; drag-and-drop breeding pen; signposts removed; mushrooms shown at 65% size. |
| 0.6 | Nov 2026 | Colour genetics redone (D-18): two colour genes per mushroom (one may be hidden and resurface in offspring), colour sports to neighbouring shades, and larger heritable colour shifts. Save schema 3. |
| 0.7 | Nov 2026 | Auto-jobs (D-19): mushrooms take the job that suits them best, overflow to their next best, and are swapped off when a better-suited mushroom arrives; player pins and breaks still work. |
| 0.8 | Nov 2026 | Breeding Pens are buildings you buy and place (D-20): one incubation per pen, up to 3; tapping a pen opens the breeding menu; Spore/Moonlit Cradle become pen upgrades. A Store screen (D-21) with Workstations, Housing, Breeding, Decor, Paths & Bridges and Ground tabs. Save schema 4 (old Breeding Nook → pen). |
| 0.9 | Nov 2026 | Mushroom art overhaul (D-22): parts-based generator on a 30×36 frame with per-lobe shading, stems that set the cap's height, a real **second colour** for all patterns, drab stem palette. New growth forms that each lean into one kind of work — Tuftcap, Lumpcap, Tippedcap, Shaggy Inkcap; Lanky, Stubby and Warty stems; Beads, Shaggy scales and Glassy sheen markings; Inky drips. Save schema 5 (mushrooms get a second colour and a stem colour). Breeding Pens, Mushroom Homes and Cozy Homes now cover 3×3 tiles (D-23). Land tiles blend into each other with rounded, faded edges; shorelines stay crisp (D-24). Spiky stats (D-25): each attribute feeds one or two stats and budgets are 1.5× (base total 93). Stat spider graphs on the mushroom detail and in the breeding pen (both parents overlaid); app icon and web manifest. |

### 0.2 Conventions

- **Config:** `keyName` marks a value that must live in centralized
  configuration (Section 19). Every number in this document marked this
  way is an initial balance value, not a permanent decision.
- **Stat abbreviations** used in tables: CUL Cultivation, MYC Mycology,
  FOR Foraging, CON Construction, MAG Magic, ANI Animal Care, DIS Local
  Discovery, SOC Social Craft.
- **MUST / SHOULD / MAY** carry their usual requirement meanings.
- "Owned" mushrooms belong to the player. "Guests" are imported friend
  mushrooms (Section 14). "Wild Visitors" are temporary habitat
  mushrooms (Section 5.6).

---

## 1. Executive Summary

Mushroom Forest is a cozy, pixel-art browser game about cultivating a
magical woodland, breeding highly individual mushroom creatures, and
building a living forest community.

Every player begins with exactly **three ordinary, randomized
mushrooms**. Each mushroom's appearance is made of **ordinary
attributes** (cap shape, colour, stem, markings, gills, glow), and those
attributes deterministically produce its **eight job stats**. Through
breeding, offspring recombine attributes and can gradually accumulate
three deeper layers of genetic progression:

1. **Advanced Traits** — permanent, inheritable +4 stat bonuses.
2. **Perks** — up to three conditional behaviours that strengthen across
   generations.
3. **Mutations** — extremely rare visual transformations with a
   substantial gameplay bonus (maximum one per mushroom).

Mushrooms live and work in the player's forest. They wander, gather,
cultivate, build, tend other inhabitants, and visibly contribute to the
place they call home. There are no expeditions or combat. New jobs
unlock as the player **discovers** new habitats and landmarks, then
**builds or restores** the workstation that enables the job.

Breeding is the central long-term progression system. A mushroom several
generations removed from the starters — carrying multiple inherited
Advanced Traits, three developed Perks, and a rare Mutation — should feel
like a genuinely prized creature, and a desirable genetic donor for
friends.

The game is a single-player web app hosted on GitHub Pages. Social play
in the MVP uses portable, validated mushroom share codes/files; no
server is required. Live multiplayer, accounts, cloud saves, and
server-authoritative trades are future backend features.

---

## 2. Product Pillars

- **Breeding is the central long-term progression and collection
  system.** Every mushroom is an individual with a lineage, appearance,
  stats, temperament, and up to three layers of inheritable genetic
  bonuses. Stronger mushrooms are *bred*, never bought or rolled.
- **Work and forest development drive world progression.** Mushrooms
  produce resources and improve the forest while remaining visible in the
  world; forest discoveries and construction unlock new jobs, areas, and
  breeding mechanics.
- **Specialization over universal power.** A mushroom with 90
  Construction is not automatically good at Cultivation or Magic. Each
  job rewards a different stat profile, so a varied collection always
  matters.
- **The forest is the home, not a menu.** The player shapes habitats and
  watches a small ecosystem operate.
- **Social sharing creates genetic discovery.** Friends exchange mushroom
  genetics without losing their original creatures; exceptional
  mushrooms become valued donors.
- **Cozy, low-pressure play.** Progress continues offline, mushrooms are
  never lost through work or breeding, and players are encouraged to
  decorate and experiment.
- **Readable, extensible, configurable systems.** Attributes, traits,
  perks, mutations, jobs, plants, resources, structures, and all balance
  numbers are data-driven and centrally configured.

---

## 3. Target Platform and Technical Constraints

| Area | Requirement |
|---|---|
| Platform | Responsive web app; prioritize mobile portrait layouts, but support desktop. |
| Hosting | GitHub Pages static hosting, deployable from a repository subpath. |
| Runtime | Client-side HTML/CSS/JavaScript or the project's existing framework. No backend for the MVP. |
| Persistence | Local save in browser storage (prefer IndexedDB for structured data; localStorage is acceptable for a small prototype). |
| Offline progress | Save a timestamp and calculate elapsed production on return. Clamp unreasonable elapsed time; prevent negative or duplicate rewards (Section 13.4). |
| Determinism | All gameplay randomness (breeding, chance-based perks, weather, discoveries) uses seeded RNG so results are reproducible and refresh-safe (Section 20). |
| Social sharing | MVP: export/import a mushroom as a compact JSON file or encoded share code. Validate imported data, recalculate all derived values, assign a new local instance ID, and preserve lineage/genetics (Section 14). |
| Multiplayer limitation | GitHub Pages alone cannot securely store shared accounts, synchronize forests, or validate online trades. Real-time visits/trading are later backend features. |
| Save safety | Version the save schema; support migration; provide manual export/import backup. Never overwrite a valid save with an invalid import. |
| Configuration | All probabilities, stat distributions, caps, perk rules, timers, and costs live in centralized, versioned configuration (Section 19). |
| Performance | Lightweight and touch-friendly. Avoid heavy libraries unless the existing project already uses them. |

---

## 4. Core Gameplay Loop

1. **Shape the forest:** place terrain, plants, water features,
   decorations, and work structures to create useful habitats.
2. **Discover:** workers and habitats reveal new areas, resources,
   landmarks, Wild Visitors, and rare habitats.
3. **Build and restore:** gather materials to construct or restore
   workstations, which unlock jobs and breeding upgrades.
4. **Breed:** pair two mushrooms to create a spore cluster, incubate it,
   and reveal an offspring with inherited attributes and, once unlocked,
   inherited or newly developed Advanced Traits, Perks, and Mutations.
5. **Assign work:** place mushrooms into jobs suited to their stats,
   Perks, and temperament.
6. **Grow the ecosystem:** workers gather resources, cultivate plants,
   expand mycelium, construct structures, and attract forest life.
7. **Specialize:** select and line-breed mushrooms toward stronger
   specialists for particular jobs.
8. **Share:** exchange mushroom genetics with friends, breed with their
   donors, and compare discoveries.

The short session should be satisfying: collect outputs, check workers,
claim or start a breeding cycle, make one small change. The long-term
session is about planning habitats, completing collections, optimizing
job teams, developing lineages, and discovering rare genetic
combinations.

---

## 5. The Forest World

### 5.1 World presentation

Present a cozy, living forest clearing in a crisp 32-bit-inspired
pixel-art style. Mushrooms must be visually readable at small sizes, with
bold dark outlines, rich cap colours, warm highlights, and distinct
silhouettes. Use the supplied mushroom sprite reference as the primary
inspiration for cap shapes, stems, markings, palette variety, and rarity
expression. Do not reproduce the reference sprites; create original
modular assets that can be recombined (Section 17).

### 5.2 Player-controlled world elements

- Terrain and habitat tiles: grass, damp soil, moss, leaf litter, stone,
  shallow water, deep shade, magical ground.
- Plants, flowers, fungi, trees, fallen logs, rocks, ponds, and
  decorative objects.
- Workstations and structures that unlock or improve jobs (Section 12).
- The Breeding Station and its upgrades (Section 10).
- Mushroom homes or resting spots that provide identity, resident
  capacity (Section 6.8), and optional comfort bonuses.

### 5.3 Habitat influence

Objects and terrain influence which plants, resources, Wild Visitors,
discoveries, and (once unlocked) spontaneous Mutation weights can occur.
The player must be able to understand habitat requirements through
tooltips or the Field Guide. Avoid opaque spawn rules: show discovered
requirements and provide hints for undiscovered combinations.

### 5.4 Visible simulation

Mushrooms move around the forest, travel to work locations, perform
short work animations, carry visible items where practical, and return
to a home/rest point. If the player owns more mushrooms than can be
animated smoothly, use a visible active population cap
(Config: `visibleMushroomCap`, default 10) and represent remaining
workers through efficient background simulation. Background workers
produce exactly the same results as animated ones.

### 5.5 Forest time and weather (new)

Perks and Mutations reference time of day and weather, so the forest
follows the **player's real local time** (decision D-10).

- **Day phases:** the device's local clock maps every timestamp to one
  phase (Config: `dayPhaseHours`): **Dawn** 05:00–08:00, **Day**
  08:00–18:00, **Dusk** 18:00–21:00, **Night** 21:00–05:00.
- **Weather:** each local calendar date has seeded weather derived from
  `hash(worldSeed, localDate)`: Clear, Cloudy, or Rain
  (Config: `weatherWeights`, default 65 / 20 / 15). Rain occupies one or
  two seeded windows of 1–3 hours that day (Config: `rainWindows`).
  Weather is game weather, not a real forecast, and needs no network.
- **Offline resolution** applies the same mapping to every cycle in the
  elapsed window, so a player who closes the game in the evening still
  receives Night Shift and Morning Dew results for the night and dawn
  that passed while they were away. Time-conditional Perks are therefore
  useful for every play schedule.
- **Time zones:** phase mapping uses the device's current time-zone
  offset at resolution time. A time-zone change only affects cycles not
  yet resolved.
- **Presentation:** day/night tinting, rain overlay, fireflies at night.
  Visuals never decide gameplay; they read from the simulation.
- *Labelled limitation:* a player can change the device clock or time
  zone to force "Night" or "Dawn". Gains are small (time Perks are
  capped by `productivityBonusCap`) and offline time remains clamped
  (Section 13.4).

### 5.6 Wild Visitors (clarifies v0.1 "attract and discover mushrooms")

Suitable habitats occasionally attract a **Wild Visitor** mushroom.

- Wild Visitors appear for a limited time (Config: `wildVisitorStayHours`,
  default 12 hours) at a habitat that matches their requirements.
- They carry only ordinary attributes, possibly including Uncommon
  attributes tied to that habitat. They never carry Advanced Traits,
  Perks, or Mutations.
- They can be used as one parent in a breeding while present. They
  cannot be assigned to jobs and never join the collection; they are
  breeding partners only (decision D-9).
- Their purpose is to widen the ordinary gene pool and reward habitat
  building, without bypassing breeding progression.

---

## 6. Mushroom Creatures

### 6.1 Individual identity

Every mushroom is a persistent individual, not a disposable worker
token. Each has a unique ID, name, generation, parents/lineage, genome,
derived stats, temperament, and current assignment. Mushrooms are never
consumed by breeding and never lost through work.

### 6.2 The genome: five layers

| Layer | What it is | Affects stats? | Starters? | Limit |
|---|---|---|---|---|
| Ordinary attributes | Cap shape, cap colour (+ colour allocation sub-gene), stem, markings, gills/underside, ordinary glow. | Yes — fixed contribution per attribute (Section 7). | Basic tier only | One value per category |
| Cosmetic genes | Second colour (paints every pattern), stem colour (drab palette), pattern seed. | No | Yes | — |
| Advanced Traits | Inheritable +4 bonus to one stat (Section 8.1). | Yes | None | 8 (Config) |
| Perks | Conditional productivity / special behaviour (Section 8.2). | No — productivity modifiers | None | 3 |
| Mutation | Rare visual effect + substantial bonus (Section 8.3). | Yes | None | 1 |
| Temperament | Behavioural modifier (Section 6.5). | No | Yes | 1 |

### 6.3 Derived properties (not inherited directly)

These are always **calculated** from the genome and never stored as
authoritative values (they may be cached for display):

- **Eight job stats** (Section 7).
- **Affinity:** the thematic name of the mushroom's highest final stat,
  used for flavour, sorting, filters, and some habitat attraction.
  Ties break in stat order (CUL → SOC).

  | Highest stat | Affinity |
  |---|---|
  | Cultivation | Bloom |
  | Mycology | Spore |
  | Foraging | Verdant |
  | Construction | Hearth |
  | Magic | Glow |
  | Animal Care | Kin |
  | Local Discovery | Burrow |
  | Social Craft | Shimmer |

- **Genetic Rarity tier** (Section 6.6).

### 6.4 Attribute rarity tiers

Every ordinary attribute has a tier: **Basic**, **Uncommon**, or
**Rare**.

- The starting gene pool contains **Basic** attributes only.
- **Uncommon** attributes enter through Wild Visitors, attribute
  variation during breeding, and friend donors.
- **Rare** attributes enter through attribute variation once a rare
  habitat has been discovered, and through friend donors.
- **Basic and Uncommon attributes share the same category budget.**
  **Rare attributes are slightly stronger:** each spends its category
  budget plus Config: `rareTierBudgetBonus` (default +2) (decision D-1).
  Rare attributes are also more striking visually and often more
  focused. The bonus is deliberately small: a mushroom with Rare
  attributes in all five non-colour categories gains +10 total points
  (76 vs 66), roughly the value of 2–3 Advanced Traits, so common
  mushrooms stay useful and specialization still matters more than tier.

### 6.5 Temperament

Temperament is inherited (Config: `temperamentInheritance`, default 45%
parent A / 45% parent B / 10% random). Effects are small and must never
make a mushroom unusable.

- **Industrious:** −10% work cycle duration.
- **Curious:** small chance (3%) of a bonus item during suitable tasks.
- **Sleepy:** works 15% less often; gains a +15% rested bonus for the
  next cycle after resting.
- **Social:** +5% productivity within 2 tiles of another working
  mushroom.
- **Greedy:** +8% personal bonus finds; contributes 50% less to shared
  synergy bonuses.
- **Mischievous:** in breeding, +25% relative chance of ordinary
  attribute variation when this mushroom is a parent; occasional harmless
  surprise outcomes at work.
- **Gentle:** improves nearby plant growth or visitor comfort by 5%.
- **Stubborn:** +8% productivity in a job held for at least 12 hours
  (Config); the bonus resets on reassignment (no penalty below baseline).

Temperament modifiers count toward the productivity bonus cap
(Section 11.3). All values are Config.

### 6.6 Genetic Rarity (supersedes v0.1 "Rarity" attribute)

Rarity is a **derived, descriptive score**, not an input that changes
probabilities. It makes valuable mushrooms readable at a glance.

| Source | Points |
|---|---|
| Each Uncommon attribute | 1 |
| Each Rare attribute | 3 |
| Each Advanced Trait | 1 |
| Each Perk level | 1 |
| Mutation | 8 |

| Tier | Score |
|---|---|
| Common | 0–2 |
| Uncommon | 3–6 |
| Rare | 7–12 |
| Epic | 13–19 |
| Legendary | 20+ |

Starters always score 0 (Common). Point values and thresholds are
Config. Rarity is shown through palettes, glow, particles, and frames,
not only a coloured label.

### 6.7 Starting mushrooms

Every new player receives **exactly three** randomized mushrooms.

**Hard rules**

- Ordinary attributes are drawn **only from Basic-tier** attributes.
- Colour RGB is drawn from the Basic starter palette (Section 7.4.5).
- No Advanced Traits, no Perks, no Mutation.
- Generation 1, no parents, origin "Starter".
- Every all-Basic mushroom has the same base stat total (66; Section
  7.2), so random luck cannot produce an exceptionally powerful starter.
- No single starter stat may exceed Config: `starterMaxStat`
  (default 28).

**Complementary generation**

Starters are generated by seeded rejection sampling until all
constraints pass (Config: `starterMaxAttempts`, default 500, then fall
back to a curated, valid starter set):

1. Each starter is assigned a different dominant colour group (one
   Red-leaning, one Green-leaning, one Blue-leaning).
2. All three cap shapes are different.
3. At least one starter has Cultivation among its top two stats and at
   least one other starter has Foraging among its top two stats, so both
   starting jobs (Gardener, Forager) have a natural fit.
4. The union of the three starters' top-two stats covers at least five
   of the eight stats.
5. Temperaments are all different.

Players can breed any two of their three starters. Breeding never
consumes parents; both remain permanently in the collection.

### 6.8 Population and storage

- **Residents** live and work in the forest. Resident capacity starts at
  Config: `baseResidentCap` (default 8) and each Mushroom Home adds
  Config: `homeCapacity` (default 2).
- When residents are at capacity, new offspring go to the **Spore
  Archive**: unlimited dormant storage. Archived mushrooms cannot work
  but can be viewed, bred, exported, and moved back to residency when
  space allows.
- A mushroom is never removed automatically, and there is no way to
  release or delete a mushroom in the MVP (decision D-8). Releasing
  ("Return to the Wild") may be reconsidered post-MVP.

---

## 7. Job Stats and Stat Calculation

### 7.1 The eight job stats

| # | Stat | Colour group | Governs |
|---|---|---|---|
| 1 | Cultivation | Red | Growing plants, tending gardens, watering, harvesting crops. |
| 2 | Mycology | Red | Cultivating fungi, spreading spores, producing fungal materials. |
| 3 | Foraging | Red | Gathering berries, wood, dew, and natural materials. |
| 4 | Construction | Green | Building, repairing, crafting, and improving structures. |
| 5 | Magic | Green | Maintaining landmarks, gathering magical energy, enchanting. |
| 6 | Animal Care | Green | Tending creatures, nests, habitats, and wildlife. |
| 7 | Local Discovery | Blue | Digging, investigating, finding buried and hidden things. |
| 8 | Social Craft | Blue | Gifts, decorations, community projects, festival materials. |

Each stat uses a bounded 0–100 scale (Config: `statCap`, default 100).
Each job has one primary stat and may have one secondary stat
(Section 11.1).

### 7.2 Ordinary attributes determine base stats

Every ordinary attribute contributes a **predefined, fixed** stat
distribution. The same attribute always contributes the same
distribution on every mushroom, in every save, forever (for a given
configuration version).

Each attribute **category** has a fixed point budget. Every Basic and
Uncommon attribute in a category spends exactly that budget; every Rare
attribute spends the budget + `rareTierBudgetBonus` (+3). Since v0.9
(decision D-25) every attribute feeds **only one or two stats**, and the
budgets are 1.5× the original ones, so mushrooms come out as spiky
specialists rather than all-rounders:

| Category | Budget | Rare budget | Notes |
|---|---|---|---|
| Cap shape | 27 | 30 | Largest single influence on silhouette and profile. |
| Cap colour | 12 | — | Distributed by RGB (Section 7.4). Colour has no tier and is always exactly 12; it is the one source that spreads across several stats, so it was deliberately not scaled up. |
| Stem | 18 | 21 | |
| Markings | 15 | 18 | "Plain" is a full attribute with its own distribution. |
| Gills / underside | 12 | 15 | |
| Ordinary glow | 9 | 12 | "None" is a full attribute with its own distribution. |
| **Total base** | **93** | **up to 108** | 93 for any mushroom with no Rare attributes; +3 per Rare attribute. |

Consequences:

- Mushrooms without Rare attributes differ only in the **shape** of
  their stat profile, never in total base power. Rare attributes add a
  small amount (+3 each); real power growth comes from Advanced Traits
  and Mutations.
- Adding a future attribute category means adding a new budget; existing
  mushrooms gain that category through migration with a defined default
  attribute.
- Cosmetic genes (accent colour, stem colour, pattern seed) contribute
  zero stats by design.

**Base stat** for each stat = sum of that stat's contributions across
all of the mushroom's ordinary attributes.

### 7.3 Initial attribute contribution tables

All values are Config. Unlisted stats are 0.

Tables are approved as the starting point (decision D-2); Rare rows
include the +2 Rare bonus.

**Cap shape (budget 27; Rare 30)**

| Attribute | Tier | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC |
|---|---|---|---|---|---|---|---|---|---|
| Roundcap | Basic | 9 |  |  | 18 |  |  |  |  |
| Flatcap | Basic |  |  | 15 |  |  |  |  | 12 |
| Bellcap | Basic | 15 |  |  |  |  | 12 |  |  |
| Wavycap | Basic |  | 15 |  |  |  |  | 12 |  |
| Conecap | Basic |  |  |  |  | 15 |  | 12 |  |
| Clustercap | Basic |  | 12 |  |  |  |  |  | 15 |
| Shelfcap | Uncommon |  |  | 12 | 15 |  |  |  |  |
| Frillcap | Uncommon | 12 |  |  |  |  |  |  | 15 |
| Lanterncap | Rare |  |  |  |  | 21 |  |  | 9 |
| Spirecap | Rare |  |  |  |  | 18 |  | 12 |  |
| Tuftcap | Uncommon |  |  | 15 |  | 12 |  |  |  |
| Lumpcap | Uncommon | 9 | 18 |  |  |  |  |  |  |
| Tippedcap | Uncommon |  |  |  |  |  | 15 |  | 12 |
| Shaggy Inkcap | Rare |  |  |  |  | 9 |  | 21 |  |

**Stem (budget 18; Rare 21)**

| Attribute | Tier | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC |
|---|---|---|---|---|---|---|---|---|---|
| Sturdy | Basic |  |  | 6 | 12 |  |  |  |  |
| Slender | Basic |  |  | 12 |  |  |  | 6 |  |
| Bulbous | Basic |  | 12 |  |  |  | 6 |  |  |
| Rooted | Basic | 6 |  |  |  |  |  | 12 |  |
| Ringed | Uncommon |  |  |  |  |  | 6 |  | 12 |
| Twisted | Uncommon |  |  |  |  | 12 |  |  | 6 |
| Crystal-veined | Rare |  |  |  | 9 | 12 |  |  |  |
| Lanky | Basic |  |  |  |  |  |  | 18 |  |
| Stubby | Basic | 6 | 12 |  |  |  |  |  |  |
| Warty | Uncommon |  |  |  |  |  | 12 |  | 6 |

**Markings (budget 15; Rare 18)**

| Attribute | Tier | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC |
|---|---|---|---|---|---|---|---|---|---|
| Plain | Basic | 9 |  |  | 6 |  |  |  |  |
| Spots | Basic |  |  |  |  |  | 15 |  |  |
| Stripes | Basic |  |  |  | 9 |  |  | 6 |  |
| Speckles | Basic |  | 15 |  |  |  |  |  |  |
| Rings | Uncommon |  | 6 |  |  | 9 |  |  |  |
| Patches | Uncommon | 6 |  |  |  |  |  |  | 9 |
| Constellation | Rare |  |  |  |  | 12 |  | 6 |  |
| Beads | Uncommon | 6 | 9 |  |  |  |  |  |  |
| Shaggy scales | Uncommon |  |  |  |  |  |  | 15 |  |
| Glassy sheen | Uncommon |  |  | 9 |  | 6 |  |  |  |

**Gills / underside (budget 12; Rare 15)**

| Attribute | Tier | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC |
|---|---|---|---|---|---|---|---|---|---|
| Fine gills | Basic | 4 | 8 |  |  |  |  |  |  |
| Deep gills | Basic |  | 12 |  |  |  |  |  |  |
| Pored | Basic |  |  | 6 | 6 |  |  |  |  |
| Ridged | Uncommon |  |  |  | 12 |  |  |  |  |
| Toothed | Uncommon |  |  | 4 |  |  |  | 8 |  |
| Velvet | Rare |  |  |  |  |  | 9 |  | 6 |
| Inky drips | Uncommon |  |  |  |  | 6 |  | 6 |  |

**Ordinary glow (budget 9; Rare 12) — distinct from Mutation glow effects.**

| Attribute | Tier | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC |
|---|---|---|---|---|---|---|---|---|---|
| No glow | Basic | 5 |  | 4 |  |  |  |  |  |
| Faint | Basic |  |  |  |  | 4 |  |  | 5 |
| Soft | Uncommon |  |  |  |  | 6 | 3 |  |  |
| Pulse | Uncommon |  |  |  |  |  |  | 9 |  |
| Radiant | Rare |  |  |  |  | 12 |  |  |  |

The Basic pool (6 × 6 × 4 × 3 × 2 shapes/stems/markings/gills/glows,
times colour) far exceeds the MVP requirement of 12 visual combinations.

**Growth forms (v0.9, D-22).** The newer shapes are deliberately
focused so that very different-looking mushrooms do very different work.
Built with matching parts, the four reference looks land in four job
families (checked by a test):

| Look | Parts | Best job |
|---|---|---|
| Glassy tuft | Tuftcap, Slender, Glassy sheen, Soft glow | Dew Collector (Foraging) |
| Weeping lump | Lumpcap, Stubby, Beads, Toothed | Mycologist (Mycology) |
| Tipped warty cap | Tippedcap, Warty, Spots, Velvet | Nest Tender (Animal) |
| Shaggy inkcap | Shaggy Inkcap, Lanky, Shaggy scales, Inky drips, Pulse | Night Watcher (Discovery) |

Wild Visitors bring them in from matching habitats: water (Tuftcap,
Glassy sheen), damp soil and logs (Lumpcap, Beads), flowers (Tippedcap,
Warty), deep shade (Shaggy scales, Inky drips). Shaggy Inkcap is a Rare
variation from Conecap, Spirecap or Bellcap lines.

### 7.4 Colour-based stat distribution

Colour works differently from other attributes. Every colour contributes
**exactly 12 points** (Config: `colorBudget`), regardless of brightness.
Only the **primary cap colour** drives stats; the second colour and stem
colour are cosmetic.

#### 7.4.1 Colour groups

| Channel | Stats |
|---|---|
| Red | Cultivation, Mycology, Foraging |
| Green | Construction, Magic, Animal Care |
| Blue | Local Discovery, Social Craft |

#### 7.4.2 Step 1 — channel shares (group points)

1. Read the cap colour as integers `R, G, B` in 0–255.
2. If `R + G + B = 0`, use the neutral fallback `(1, 1, 1)`
   (Config: `colorZeroFallback`), producing 4 / 4 / 4.
3. Raw share for each channel = `channel / (R + G + B) × 12`.
4. Convert to integers with the **largest-remainder method**: take the
   floor of each share; distribute the remaining points one at a time to
   the channels with the largest fractional remainders; break exact ties
   in the order Red → Green → Blue.

Because shares are normalized by the channel total, brightness does not
matter: `(255, 0, 0)` and `(80, 0, 0)` are both pure red.

| Colour | RGB | Red pts | Green pts | Blue pts |
|---|---|---|---|---|
| Pure red | 255, 0, 0 | 12 | 0 | 0 |
| Yellow | 255, 255, 0 | 6 | 6 | 0 |
| White | 255, 255, 255 | 4 | 4 | 4 |
| Grey | 128, 128, 128 | 4 | 4 | 4 |
| Amber | 255, 170, 0 | 7 | 5 | 0 |
| Black (fallback) | 0, 0, 0 | 4 | 4 | 4 |

*Amber check: shares 7.2 / 4.8 / 0 → floors 7 / 4 / 0 (11 points) →
largest remainder (.8) goes to Green → 7 / 5 / 0.*

#### 7.4.3 Step 2 — within-group allocation (colour allocation sub-gene)

Each mushroom carries a **colour allocation sub-gene** with one entry per
group. Each entry has:

- **Template** — the weight shape:

  | Template | 3-stat group weights | 2-stat group (Blue) weights |
  |---|---|---|
  | Focus | 1 : 0 : 0 | 1 : 0 |
  | Lean | 2 : 1 : 0 | 2 : 1 |
  | Even | 1 : 1 : 1 | 1 : 1 |

- **Order** — a permutation of the group's stats, saying which stat
  receives the first weight, which the second, and so on.

Group points are split by the weights using the same largest-remainder
method; exact ties go to the stat earlier in the order.

Examples (matching the design brief):

- **Yellow** (6 / 6 / 0) with Red = Lean [CUL, MYC, FOR] and Green =
  Lean [CON, MAG, ANI] → CUL 4, MYC 2, FOR 0, CON 4, MAG 2, ANI 0,
  DIS 0, SOC 0.
- **White** (4 / 4 / 4) with Red = Focus [MYC, …], Green = Focus
  [CON, …], Blue = Focus [SOC, DIS] → MYC 4, CON 4, SOC 4, all others 0.
- **Even** with 4 points over three stats → 2 / 1 / 1 (tie to the first
  in order).

The sub-gene is stored in the genome and inherited (Section 9.4.2). The
allocation is **purely a function of the stored RGB and sub-gene**: it is
never re-rolled when stats are refreshed, recalculated, imported, or
migrated.

#### 7.4.4 Colour for collections

For the Field Guide, each RGB value is mapped to its nearest **named
colour family** (Config: `colorFamilies`, ~24 entries with lightness
variants). Collection completion is tracked by family; the exact RGB is
still shown on the detail screen.

#### 7.4.5 Starter palette

Starters draw their cap colour from a Basic palette (Config:
`starterPalette`), for example Brick Red, Amber, Butter Yellow, Moss,
Fern, Sky, Slate Blue, Plum, Cream, and Chestnut, with a small seeded
jitter (±10 per channel). Unusual colours (Ghost White, Midnight,
Iridescent families) arise only through breeding.

### 7.5 Final stat calculation

```
Final Stat = min( statCap,
                  Ordinary Attribute Contributions
                + Advanced Trait Bonuses
                + Mutation Bonuses )
```

- Perks are **not** included. Perks modify productivity, chances, and
  behaviours at work time (Section 11.3).
- Temperament is not included.
- Caps are enforced in game logic (the stat calculator), never only in
  the UI.
- When an uncapped total exceeds 100, the excess is recorded as
  **overflow** and shown on the detail screen ("Construction 100
  (+6 capped)"), so players understand why a bonus had no further effect.

### 7.6 Worked example

"Bramble": Roundcap, Sturdy stem, Spots, Pored gills, No glow, Amber cap
(255, 170, 0), colour allocation Red = Lean [CUL, MYC, FOR], Green =
Focus [CON, MAG, ANI].

Colour: Red 7 → Lean → 4.67 / 2.33 / 0 → 5 / 2 / 0; Green 5 → Focus →
CON 5.

| Source | CUL | MYC | FOR | CON | MAG | ANI | DIS | SOC | Total |
|---|---|---|---|---|---|---|---|---|---|
| Roundcap | 9 |  |  | 18 |  |  |  |  | 27 |
| Sturdy |  |  | 6 | 12 |  |  |  |  | 18 |
| Spots |  |  |  |  |  | 15 |  |  | 15 |
| Pored |  |  | 6 | 6 |  |  |  |  | 12 |
| No glow | 5 |  | 4 |  |  |  |  |  | 9 |
| Amber | 5 | 2 |  | 5 |  |  |  |  | 12 |
| **Base** | **19** | **2** | **16** | **41** | **0** | **15** | **0** | **0** | **93** |

Bramble is a Hearth (Construction) mushroom. Two inherited Construction
traits (+8) would raise Construction to 49.

### 7.7 Balance envelope

With the initial tables:

- Ordinary mushrooms: base total 93 (up to 108 with five Rare
  attributes); profiles are spiky — typically one or two stats in the
  25–45 range and several at or near 0. The theoretical maximum single
  base stat is 66 from Basic attributes and 83 with Uncommon and Rare
  ones (for example a Shaggy Inkcap, Lanky, Shaggy scales, Toothed,
  Pulse line in Local Discovery).
- Advanced Traits: up to 8 × 4 = +32.
- Mutation: up to +18 on one stat.
- A deeply line-bred specialist can therefore reach the 100 cap in one
  stat, while remaining weak elsewhere; surplus is recorded as overflow.

This makes the 100 cap meaningful only at the extreme end and makes
specialization, not universal power, the outcome of long-term breeding.

---

## 8. Genetic Progression Layers

### 8.1 Advanced Traits

Advanced Traits are permanent, inheritable genetic bonuses introduced
through breeding.

**Effect:** each Advanced Trait grants exactly **+4** (Config:
`advancedTraitBonus`) to one job stat.

**Rules**

- Starters cannot have Advanced Traits.
- Each breeding can introduce **at most one** new Advanced Trait.
- A new trait targets one stat chosen **uniformly at random**
  (decision D-3; Config: `advancedTraitStatWeighting`, default uniform)
  from **eligible stats**: stats where the offspring's current value (ordinary
  attributes + already-inherited traits) + 4 ≤ the stat cap. If no stat
  is eligible, no new trait is created.
- Traits are inherited by later generations (Section 9.4.3).
- Maximum Config: `maxAdvancedTraits` (default 8) trait entries per
  mushroom. Multiple traits may target the same stat; that is how
  specialists are built.
- An inherited trait always keeps its original stat. If, in a new
  mushroom, it would push the stat above 100, the stat is clamped and the
  overflow recorded (Section 7.5). Traits are never silently retargeted.

**Trait record**

| Field | Purpose |
|---|---|
| `traitUid` | Globally unique ID created when the trait first appears. Shared by all descendants who inherit it. |
| `stat` | Affected stat. |
| `bonus` | +4 (stored for audit; validated against config on load/import). |
| `originMushroomId`, `originName`, `originGeneration` | Mushroom in which the trait first appeared. |
| `originForestId` | Forest (local player ID) where it appeared; preserved through sharing. |
| `originBreedingId` | Breeding record that created it. |

Traits are displayed with flavourful stat-based names (e.g. "Deep Roots
— +4 Cultivation"), plus "First appeared in Bramble, Gen 2".

**Intended progression**

- Generation 1: ordinary mushroom.
- Generation 2: inherits nothing, gains +4 Cultivation.
- Generation 3: inherits +4 Cultivation and gains +4 Mycology.
- Generation 4: inherits some of those and may develop another.

Because each parental trait is only *probably* inherited, progress
requires selection: players keep the best offspring and breed them
onward.

### 8.2 Perks

Perks provide conditional bonuses, productivity increases, and special
behaviours. They never change stats and never make a mushroom
universally better.

**Rules**

- Maximum **3** Perks per mushroom (Config: `maxPerks`).
- Starters have no Perks.
- Perks are inherited from either parent (Section 9.4.4).
- Breeding has a chance to introduce one new Perk at level 1 if the
  offspring has a free slot and the Perk system is unlocked.
- Matching Perks inherited from both parents combine according to that
  Perk's **combination rule**. Percentages are never simply added.
- Each Perk has discrete strength **levels** with an individual maximum.
- A mushroom cannot hold two copies of the same Perk.

**Combination rules**

| Rule | Both parents, equal level L | Both parents, unequal levels | One parent only |
|---|---|---|---|
| `standard` | L + 1 (guaranteed) | max level; 25% chance of +1 | same level |
| `slow` | L + 1 at 40% chance, else L | max level | same level |
| `fixed` | single strength; no levels | — | — |

Results never exceed the Perk's max level. Rule chances are Config.

*Example:* two parents each have Rain Worker L1 (+3%). Rain Worker uses
`standard`, so an offspring that inherits it gets L2 (+5%).

**Initial Perk catalogue** (all values Config)

| Perk | Condition / effect | Levels | Rule | Related stat |
|---|---|---|---|---|
| Rain Worker | +productivity while raining | 3 / 5 / 7 / 9 / 12% | standard | any |
| Morning Dew | chance of +1 dew per cycle at Dawn | 5 / 8 / 11 / 15% | standard | FOR |
| Treasure Nose | +bonus-find chance while digging | 4 / 6 / 8 / 10 / 13% | slow | DIS |
| Night Shift | +productivity at Night | 4 / 6 / 8 / 10 / 12% | standard | any |
| Early Riser | +productivity at Dawn | 5 / 8 / 11 / 14 / 18% | standard | any |
| Green Thumb | +plant growth speed / harvest output in Cultivation jobs | 5 / 8 / 11 / 14% | standard | CUL |
| Spore Sower | chance to spread an extra fungal patch per cycle | 3 / 5 / 7 / 9% | standard | MYC |
| Team Player | +productivity when another mushroom works within 2 tiles | 3 / 5 / 7 / 10% | standard | SOC |
| Careful Builder | chance to conserve construction materials | 5 / 8 / 11 / 15% | slow | CON |
| Moon Listener | chance of moonlight drop during Night Magic work | 4 / 6 / 9 / 12% | standard | MAG |
| Gentle Keeper | +visitor happiness from Animal Care work | 5 / 8 / 11 / 15% | standard | ANI |
| Gift Wrapper | chance of an extra gift item | 5 / 8 / 12% | slow | SOC |

The v0.1 perk example "Dew Collector" is renamed **Morning Dew** to avoid
clashing with the Dew Collector job.

**Perk record:** `perkId`, `level`, `originMushroomId`,
`originGeneration`, `originForestId`.

**New-Perk selection:** new Perks are drawn from the catalogue, weighted
toward Perks whose related stat is among the offspring's top two stats
(Config: `newPerkAffinityWeight`, default 60% from related Perks,
40% from all). "any" Perks count as related to every stat.

### 8.3 Mutations

Mutations are extremely rare genetic developments and the most exciting
breeding discoveries. Each has:

1. A distinctive **visual effect** (dedicated layered assets, particles,
   and idle/working animation variants).
2. A substantial **gameplay bonus**: stat bonuses (subject to the 100 cap)
   and/or special effects (subject to the productivity bonus cap).

**Rules**

- Maximum **one** Mutation per mushroom.
- Starters cannot have Mutations.
- Mutations can be inherited from mutated parents.
- Mutations can appear spontaneously at very low probability, only when
  no parental Mutation was inherited and the Mutation system is unlocked.
- Two mutated parents still produce at most one Mutation.

**Initial Mutation catalogue** (values Config)

| Mutation | Stat bonus | Special effect | Visual |
|---|---|---|---|
| Starfall Aura | +18 Magic | 5% chance to find stardust per Night work cycle | Star-like particles and slow starfall around the mushroom |
| Verdant Glow | +18 Cultivation | +10% productivity on plant-tending jobs | Green glowing outline, leaf motes |
| Deep-Spore Bloom | +18 Mycology | +15% chance of rare spores | Floating purple spores |
| Prismatic Veil | +5 to each of the carrier's four lowest base stats | — | Multicoloured shimmering outline |

*Prismatic Veil targets are determined when each carrier is created
(ties broken in stat order) and stored in that mushroom's Mutation
instance, so they never change afterwards.*

Future Mutation examples: Firefly Halo (+14 Animal Care, +4 Social Craft,
orbiting fireflies), Moss Crown, Ember Cap, Constellation Veil.

**Mutation record:** `mutationId`, `resolvedBonuses` (stat → amount),
`origin` (`spontaneous` or `inherited`), `originMushroomId`,
`originGeneration`, `originForestId`.

**Spontaneous Mutation selection:** weighted by Config:
`mutationWeights`; habitat modifiers MAY raise weights (e.g. Starfall
Aura ×2 if the Breeding Station is next to the Moonstone Ring). Weights
only choose *which* Mutation appears, never *whether* one appears.

---

## 9. Breeding and Genetics

### 9.1 Breeding flow

1. Open the Breeding Station and select two eligible parents.
2. Review both parents side by side and see inheritance categories and
   hints, without the exact offspring.
3. Pay the breeding cost and start incubation. The complete offspring is
   resolved and sealed at this moment (Section 9.6).
4. A visible spore cluster incubates at the station in real time,
   including offline time.
5. When ready, the player claims it; a short reveal animation plays.
6. The offspring joins the collection (residents or Archive) with a
   unique identity and full lineage.

### 9.2 Eligibility

- Both parents must be distinct individuals.
- At least one parent must be an owned mushroom; the other may be owned,
  a Guest, or a present Wild Visitor.
- A mushroom can be a parent in only one active incubation at a time.
- After breeding, a parent rests for Config: `parentRestMinutes`
  (default 10). Parents keep working while incubation runs.
- Newly revealed offspring can be bred after Config:
  `offspringMaturationMinutes` (default 0 for the MVP).
- Concurrent incubations are limited by Breeding Station slots (Section
  10.2).
- Eligibility and timers are always shown clearly; ineligible mushrooms
  say why.

### 9.3 Generation

Offspring generation = `max(parentA.generation, parentB.generation) + 1`.
Starters, Wild Visitors, and imported mushrooms keep the generation they
arrived with (Wild Visitors are generation 1).

### 9.4 Breeding resolution sequence

The offspring is produced by this exact, ordered sequence. Each step
draws from its own seeded RNG sub-stream (Section 9.6).

1. **Ordinary attributes:** inherit each category from either parent,
   with controlled variation (9.4.1–9.4.2).
2. **Base stats:** calculate ordinary base stats (Section 7).
3. **Inherit Advanced Traits:** a controlled subset of parental traits
   (9.4.3).
4. **New Advanced Trait:** roll for at most one new trait among eligible
   stats.
5. **Inherit Perks:** select eligible parental Perks (9.4.4).
6. **Combine duplicate Perks:** apply each Perk's combination rule.
7. **New Perk:** roll if a slot is free.
8. **Parental Mutation:** resolve inheritance (9.4.5).
9. **Spontaneous Mutation:** only if no parental Mutation was inherited.
10. **Validate:** enforce stat caps, trait limit, perk limit, mutation
    limit, and schema rules; record overflow. If any limit is exceeded,
    trim deterministically (lowest-priority entries first) and log a
    developer warning — this indicates a bug.
11. **Save:** persist the sealed offspring and its complete lineage in
    the breeding record.
12. **Reveal:** on claim, add the offspring to the collection and play
    the reveal.

Steps 3–9 are skipped (producing nothing) for any system that is not yet
unlocked (Section 10), except dormant carry from donors (Section 10.3).

### 9.4.1 Ordinary attribute inheritance

For each attribute category:

- Choose parent A's or parent B's attribute (Config:
  `attributeParentWeight`, default 50 / 50).
- **Attribute variation** (Config: `attributeVariationChance`, default
  6%; ×1.25 if a parent is Mischievous): replace the chosen attribute
  with a related attribute from its data-defined **variation neighbours**
  (e.g. Roundcap ↔ Bellcap ↔ Conecap). Variation may produce an
  attribute not visibly present in either parent.
- Variation can select Uncommon neighbours at any time, and Rare
  neighbours only once a rare habitat has been discovered
  (Config: `rareVariationShare`, default 20% of variations when allowed).
- Config: `firstBreedVariationEnabled` (default false) keeps the very
  first breeding a clean lesson in parent mixing.

This "attribute variation" replaces v0.1's use of the word "mutation" for
new visual genes (Appendix A).

### 9.4.2 Colour inheritance (v0.6, decision D-18)

Colour is inherited like a real gene, so any colour can be bred toward and
hidden colours can surprise the player.

- **Two colour genes** per mushroom (`colorAlleles`), one from each parent.
  Each parent passes on one of its two genes at random.
- **Expression:** genes closer than Config: `colorAlleleBlendDistance`
  (RGB distance 90) blend (seeded t ∈ [0.3, 0.7]); otherwise the cap shows
  one gene (50/50) and the other stays **hidden**, ready to resurface in
  later generations. Two green parents that both hide red produce a red
  offspring about half the time.
- **Colour sports:** each passed-on gene has Config: `colorSportChance` (4%)
  to shift 25–45° around the colour wheel to a neighbouring shade.
- **Colour shifts:** Config: `colorVariationChance` (15%) that the shown
  colour shifts by up to ±60°; the shift is written into the gene behind it,
  so it is inherited.
- **Starters** each show a Basic palette colour and carry a random hidden
  colour from the palette. Wild Visitors do too.
- **Stats are unchanged:** the *shown* colour gives exactly 12 points,
  split by RGB as in Section 7.4. The colour-allocation sub-gene is
  inherited as before.
- **Readability:** the detail screen says whether a mushroom carries a
  hidden colour (without revealing it); the breeding pen lists the parents'
  colours and notes when a hidden colour may appear.
- **Balance check** (200 simulated runs from three green starters): with
  nothing hidden, selective breeding reaches red in a median of 48 breedings
  (196/200 runs); when starters hide random colours, red appears in a
  median of 9–12 breedings. Colours also stay vivid instead of averaging
  toward grey.
- Save schema 3 converts older mushrooms: the shown colour becomes one gene
  and a stable hidden colour is chosen from each mushroom's id. Share codes
  carry an optional `ca` field; codes made before it still import.

### 9.4.3 Advanced Trait inheritance

- Pool the parents' traits by `traitUid`.
- A trait carried by one parent is inherited with Config:
  `traitInheritChanceSingle` (default 50%).
- A trait carried by both parents (shared ancestry) is inherited once,
  with Config: `traitInheritChanceShared` (default 75%).
- If more than the trait cap would be inherited, keep a seeded selection,
  preferring shared traits.
- Then roll for one new trait (Config: `newAdvancedTraitChance`, default
  25%), only if the offspring has a free trait slot.
- Config: `tutorialGuaranteedFirstTrait` (default true): the first
  breeding after Advanced Traits unlock always produces one new trait, to
  teach the system.

### 9.4.4 Perk inheritance

- Pool parental Perks by `perkId`.
- A Perk carried by both parents is inherited with Config:
  `perkInheritChanceShared` (default 90%) and then combined (Section
  8.2).
- A Perk carried by one parent is inherited with Config:
  `perkInheritChanceSingle` (default 50%) at the same level.
- If more than three would be inherited, keep in priority order: combined
  (shared) Perks, then higher level, then seeded random.
- If a slot is free, roll for a new Perk (Config: `newPerkChance`,
  default 8%).

### 9.4.5 Mutation inheritance

- **One mutated parent:** inherit that Mutation with Config:
  `mutationInheritChanceSingle` (default 35%).
- **Two mutated parents:** one Mutation is inherited with Config:
  `mutationInheritChanceBoth` (default 60%). If both parents carry the
  same Mutation, that one is inherited; otherwise the choice is a seeded
  50 / 50. Never both.
- **No parental Mutation inherited** (including when parents had none,
  or the inheritance roll failed): roll spontaneous Mutation with Config:
  `spontaneousMutationChance` (default 0.75%).
- Inherited Mutations re-resolve carrier-dependent bonuses (e.g.
  Prismatic Veil's four lowest stats) for the new carrier.

### 9.5 Probability summary (initial test values)

| Roll | Default | Brief range |
|---|---|---|
| Attribute variation per category | 6% | — |
| New Advanced Trait | 25% | 20–30% |
| Trait inherited (one parent / both) | 50% / 75% | — |
| New Perk (slot available) | 8% | 5–10% |
| Perk inherited (one parent / both) | 50% / 90% | — |
| Mutation inherited (one / both parents) | 35% / 60% | — |
| Spontaneous Mutation | 0.75% | 0.5–1% |

All are independent Config values. Offspring never automatically inherit
every bonus from both parents.

### 9.6 Determinism and sealing

- At incubation start, the game derives an **outcome seed**:
  `hash(save.rngRoot, save.breedingCounter, parentA.uid, parentB.uid)`,
  increments `breedingCounter`, and stores both in the breeding record.
- The full offspring is resolved immediately and **sealed** in the
  breeding record, together with `configVersion`. A later game update
  cannot change a sealed result.
- Each resolution step uses a sub-stream `hash(outcomeSeed, stepName)`,
  so adding a step in future does not shift other steps' results.
- Refreshing, closing, or changing the device clock cannot change the
  offspring. The reveal animation only displays the sealed result.
- Incubations cannot be cancelled in the MVP (prevents cancel-and-retry
  rerolls).
- Because the seed chain is part of the save, restoring an older save
  backup and breeding the same pair again yields the same offspring.

### 9.7 Breeding cost

- The player's **first breeding is free** (Config: `freeBreedingCount`,
  default 1) (decision D-14).
- Every later breeding costs **Glimmer**, the game's soft currency
  (Section 13.2), Config: `breedingCostGlimmer` (default 15). The cost is
  the same whether the partner is owned, a Guest, or a Wild Visitor.
- The cost does not rise with generation or rarity, so breeding prized
  mushrooms is never penalized. Station upgrades MAY add a small
  discount (Config).
- Glimmer is deducted in the same save transaction that creates the
  breeding record. If the player cannot afford a breeding, the button
  shows the shortfall and how to earn Glimmer.

### 9.8 Breeding goals

- Complete cap-shape, colour-family, marking, stem, gill, and glow
  collections.
- Discover every Advanced Trait stat, every Perk, and every Mutation.
- Raise a Perk to its maximum level.
- Breed a mushroom with a particular attribute/Perk/Mutation combination.
- Develop a lineage with high performance in a chosen job.
- Breed a Legendary-rarity mushroom.

### 9.9 Preventing breeding frustration

- Never consume or permanently remove parents.
- Provide clear eligibility, cost, and timer information.
- Avoid a single best pairing: equal base totals, multiple valid
  specialist paths, and job diversity keep many pairings useful.
- Every offspring is useful: new appearance combinations, collection
  progress, lineage progress, or a different stat shape.
- Show the parent-versus-offspring comparison after every reveal.

---

## 10. Breeding Progression and Unlocks

Breeding mechanics are introduced gradually. Each stage has a Field
Guide entry and a brief tutorial (Section 16).

### 10.1 Unlock stages

| Stage | Trigger (Config) | Introduces |
|---|---|---|
| First Breed | Available from the start (Breeding Nook in the Starting Clearing). | Ordinary attribute inheritance, parent/offspring comparison, lineage records. |
| Early Breeding Milestone | 2 completed breedings. | Advanced Traits: offspring can develop permanent +4 stat bonuses. First trait guaranteed (Section 9.4.3). |
| Breeding Workstation Upgrade | Upgrade Breeding Nook → **Spore Cradle** (requires Woodland Workshop; costs planks + spores). | Perks: conditional productivity bonuses. +1 incubation slot. |
| Rare Habitat or Special Milestone | Discover the **Moonstone Ring** rare habitat (found by Excavator or Night Watcher in the Root Hollow) **or** own a Generation 5 mushroom, whichever comes first (approved, decision D-5). | Mutations: rare visual and gameplay transformations. Also enables Rare-tier attribute variation. |
| Later Generations | Own a Generation 6 mushroom and craft the **Spore Lens**. | Breeding insight tools (10.4). |

### 10.2 Breeding Pens and upgrades (v0.8, decision D-20)

Breeding happens in **Breeding Pens**: buildings the player buys in the
Store (8 twigs, 6 leaves) and puts down anywhere their mushrooms can reach.
New games start without one. Each pen grows one spore cluster at a time,
up to Config: `maxPens` (3) pens; a pen with a cluster growing shows it
(glowing when ready to hatch) and cannot be removed. Tapping a pen opens
the breeding menu. The tiers below are now upgrades that apply to every
pen (they no longer add slots).

### 10.2a Former station tiers

| Station | Slots | Incubation time | Unlocks |
|---|---|---|---|
| Breeding Nook | 1 | Config: `incubationMinutes` (default 3 for testing) | Breeding, then Advanced Traits |
| Spore Cradle | 2 | −10% | Perks |
| Moonlit Cradle (later) | 3 | −25% | Mutation weight bonuses near magical habitats |

### 10.3 Locked systems and donor genetics (dormant carry)

Before a system is unlocked, no new entries of that kind are rolled.
If a Guest donor carries genetics from a locked system (e.g. a friend's
Perk before the player has the Spore Cradle):

- Inheritance rolls still happen normally and the offspring may carry
  the genetics.
- Carried entries are **dormant**: they have no gameplay effect and are
  shown as "Dormant — unlocks with the Spore Cradle".
- Dormant entries activate permanently when the system unlocks.

This keeps donors valuable for new players and creates a motivation to
progress, without granting immediate power (approved, decision D-4).

### 10.4 Breeding insight tools

Insight tools give information and limited influence. They must never
guarantee a powerful offspring.

- **Spore Lens** (permanent): shows probability bands for a selected
  pair, e.g. "Cap shape: Roundcap ~47% / Bellcap ~47% / variation ~6%",
  per-trait and per-Perk inheritance odds, and whether a spontaneous
  Mutation roll is possible.
- **Lineage Loom** (permanent): extended family tree and ancestor search
  for traits, Perks, and Mutations.
- **Affinity Tincture** (consumable, crafted with glow dust and gifts):
  for one breeding, *if* a new Advanced Trait appears, there is a 50%
  chance it is drawn from a chosen colour group. It does not raise the
  chance of a trait appearing.
- **Steady Spores** (consumable): raises one chosen parental Perk's
  single-parent inheritance chance to 80% for one breeding.

---

## 11. Jobs and Forest Work

Mushrooms work within the player's forest. There are no away-team
expeditions, combat missions, or creature-loss missions. Jobs have
visible world interactions and produce resources, improve nearby
objects, or unlock discoveries.

### 11.1 Job catalogue (initial)

| Job | Family | Primary | Secondary | Unlock area | Workstation | Output / effect |
|---|---|---|---|---|---|---|
| Gardener | Cultivation | CUL | ANI | Starting Clearing | Garden Bed | Berries, flowers, seeds; plant growth |
| Forager | Foraging | FOR | DIS | Starting Clearing | Wild plants / leaf litter | Twigs, leaves, nuts, small stones |
| Mycologist (Spore Cultivator) | Mycology | MYC | CUL | First Fungal Patch | Spore Bed | Spores, compost, new fungal patches |
| Woodworker | Construction | CON | FOR | Woodland Workshop | Workbench | Planks, bark strips (from twigs/bark) |
| Builder | Construction | CON | SOC | Woodland Workshop | Building Site | Advances structure and restoration projects |
| Dew Collector | Foraging | FOR | MAG | Pond or Creek | Dew Reeds | Dew |
| Waterer | Cultivation | CUL | ANI | Pond or Creek | Water Barrel | Faster plant growth within radius |
| Nest Tender | Animal care | ANI | CUL | Pond or Creek | Reed Nest | Feathers, visitor happiness, egg-warming bonuses |
| Excavator (Root Digger) | Local discovery | DIS | CON | Root Hollow | Dig Site | Roots, clay, buried objects, geodes, rare habitat hints |
| Night Watcher | Local discovery | DIS | MAG | Root Hollow | Lookout Stump | Nocturnal finds, rare habitat discovery (works at Night/Dusk) |
| Enchanter | Magic | MAG | SOC | Enchanted Landmark | Shrine | Glow dust, enchanted plants/objects |
| Spirit Keeper | Magic | MAG | ANI | Enchanted Landmark | Moonlit Grove | Spirit dew, rare visitors |
| Festival Helper | Social craft | SOC | CON | Community Clearing | Gathering Circle | Decorations, festival goods, community projects |
| Gift Maker | Social craft | SOC | MAG | Community Clearing | Gift Table | Gifts and charms (used for insight consumables and decorations) |

Further v0.1 job ideas (Pollinator, Pruner, Decomposer, Mycelium Weaver,
Stoneworker, Weaver, Landscaper, Moonlight Gatherer, Crystal Resonator,
Forest Healer, Insect Keeper, Egg Warmer, Creek Searcher, Burrow
Investigator, Message Carrier, Spore Trader) remain in the content
backlog and use the same primary/secondary stat model.

### 11.2 Job assignment

**Auto-jobs (v0.7, decision D-19).** Mushrooms place themselves. Every
resident is scored for every unlocked, reachable job (its job score, raised
by Perks and Mutations that always help that kind of work), and places are
filled best-fit first across the whole forest. When a station is full, the
best-suited mushrooms get its places and the rest take their next best job;
a better-suited newcomer swaps a weaker worker off. Mushrooms already in the
right place keep their spot and work progress (a tiny preference for the
current job prevents swapping between near-equal choices). This runs after
time passes and after anything that changes the options (hatching,
restoring or building a station, bridges, archiving). The player can still
**pin** a mushroom to a job (it then never moves, and a full job's least
suited unpinned worker steps aside), **let it choose** again, or **give it a
break**. Auto-jobs can be turned off in Settings.

Manual placement (pinning) rules:

- One primary job per mushroom in the MVP.
- The player assigns a mushroom to an unlocked job and, where relevant, a
  target area, workstation, or habitat. Workstations have worker slots.
- Guests, Wild Visitors, and archived mushrooms cannot be assigned.
- Before confirming, show the job score, an estimated output per hour,
  and a qualitative label (Struggling / Steady / Skilled / Expert /
  Master), plus which Perks apply.
- Reassignment never loses the mushroom or its genetics; no harsh
  cooldowns (Stubborn only loses its *bonus*).

### 11.3 Job effectiveness

```
JobScore       = 0.7 × Primary + 0.3 × Secondary        (Primary only if no secondary)
Effectiveness  = 0.5 + 1.5 × (JobScore / 100)           (0.5× at 0, 2.0× at 100)
BonusSum       = min(productivityBonusCap,
                     Σ applicable Perk % + temperament % + Mutation effect % + synergy %)
OutputPerCycle = BaseOutput × Effectiveness × (1 + BonusSum) × HabitatMultiplier
```

- Config: `jobScoreWeights` (0.7 / 0.3), `effectivenessCurve`,
  `productivityBonusCap` (default +60%). The curve stays a straight line
  for now (decision D-11) and may be revisited after playtesting.
- Chance-based effects (bonus finds, extra dew, material conservation)
  roll per cycle using seed `hash(worldSeed, mushroomUid, jobId,
  cycleIndex)`, so live and offline results are reproducible.
- A starter with a job score of ~20 works at 0.8×; a line-bred
  specialist at 80 works at 1.7×. Every mushroom contributes something,
  but specialists are clearly better.

### 11.4 Job synergies

Some jobs become more effective when complementary mushrooms work
nearby, e.g. Waterer + Gardener on a flower bed, Mycologist near a
Decomposer bed, Woodworker + Builder on a bridge project. Synergies add
to `BonusSum`, are discoverable, and are explained in the Field Guide
once found.

### 11.5 Visible work

Use small looping animations and state changes: watering droplets,
carrying a berry, digging at a root, scattering spores, hammering,
glowing beside a landmark. Mutated mushrooms use their Mutation's
idle/working variants. The simulation can be simplified visually, but
the player must always be able to tell what each mushroom is doing.

---

## 12. Forest Development and Job Unlocks

Jobs become available through environmental discovery and forest
expansion. Every job unlock follows three steps:

1. **Discover** the relevant habitat, resource, or landmark.
2. **Gather materials and construct or restore** its workstation.
3. **Unlock** the job in the assignment interface.

Jobs stay locked until both the discovery and the construction condition
are met; this is enforced in game logic.

### 12.0 One forest, grown by the player (v0.4, decision D-16)

All clearings belong to one continuous forest shown on a single, pannable
and zoomable forest screen. The starting clearing sits in the middle.

- **Growing the forest:** when the next story clearing's discovery trigger
  is met (table below), the forest is *ready to grow*. The player taps
  **Expand** and chooses
  **north, east, south or west** of the clearing in view. A new clearing
  opens on that side.
- **Wild generation (v0.5):** each new clearing is generated, not laid out:
  patchy ground from its stage's theme (smooth noise), thicket creeping in
  ragged from every open side, lakes where the theme calls for them, and
  9–15 pieces of clutter (weeds, brambles, loose rocks, fallen branches, and
  — needing the Woodland Workshop's tools — old stumps and boulders). Its
  job and unlock structures spawn as ruins at random land tiles. Everything
  is seeded from the world seed and the clearing's position.
- **Cleaning up and organising:** clearing clutter or cutting back a thicket
  tile (from ground the mushrooms can already reach) yields a few
  resources and pushes the hedge border back. Any structure, including the
  ones that spawned, can be moved to a free reachable tile.
- **The river:** each expansion grows the river. It continues from any
  neighbouring clearing whose river reaches the shared edge, otherwise it
  rises from a spring, and it meanders out through a random open side.
  Water (river and lakes) and thicket block mushrooms: structures can only
  be restored, worked or cleared if they connect to the home clearing.
  **Bridges** (6 twigs, 2 bark) are built on water next to reachable land.
  If a change cuts a workstation off, its workers stop and the player is
  told why.
- **Paths:** a path is laid from the new clearing's centre to the shared
  edge, and from the neighbouring clearing's centre to the same edge.
- **Quiet glades:** once the Woodland Workshop is restored, the player may
  also open plain clearings for extra building space (Config: starting at
  10 planks + 8 stones, rising with each glade). While a story clearing is
  ready, every expansion opens the story clearing, free.
- **The map's edge:** hedge walls line every open side of the forest and
  dense undergrowth fills everything beyond, so the hedges are the physical
  border of the map. Expanding, and clearing thicket, push the border back.
- Mushrooms walk between clearings to reach their workstations; idle
  mushrooms, Guests and Wild Visitors stay in the starting clearing.

### 12.1 Development stages

| Stage | Discovery trigger (initial) | Construct / restore | Unlocks |
|---|---|---|---|
Stages unlock **strictly in this order** (decision D-15); each stage's
discovery requires the previous stage to be completed.

| # | Stage | Discovery trigger (initial) | Construct / restore | Unlocks |
|---|---|---|---|---|
| 1 | **Starting Clearing** | Available at start: garden beds, wild plants, leaf litter, Breeding Nook, Trading Stump. | — | Gardener, Forager, Breeding |
| 2 | **First Fungal Patch** | Foraging leaf litter reveals a damp fallen log (after Config: N forage cycles). | Restore Spore Bed (twigs + leaves) | Mycologist |
| 3 | **Woodland Workshop** | Clearing a fallen-log path (Mycologist decomposes it) reveals an old workshop. | Restore Workbench (twigs + bark + stones) | Woodworker, Builder; basic Mushroom Homes and Spore Cradle become buildable |
| 4 | **Pond or Creek** | Builder repairs the creek path (requires planks). | Dew Reeds, Water Barrel, Reed Nest | Dew Collector, Waterer, Nest Tender |
| 5 | **Root Hollow** | Exposed when creek water recedes from an old root bank. | Dig Site, Lookout Stump | Excavator, Night Watcher; rare habitat discovery (Moonstone Ring) |
| 6 | **Enchanted Landmark** | Glow traces found by Night Watcher lead to an overgrown shrine. | Restore Shrine; grow Moonlit Grove | Enchanter, Spirit Keeper; Moonlit Cradle |
| 7 | **Community Clearing** | Spirit Keeper's visitors reveal a hidden gathering place. | Gathering Circle, Gift Table, Cozy Homes | Festival Helper, Gift Maker; festival decorations; larger homes |

**Keeping every stat useful in a linear order:** Local Discovery and
Social Craft jobs arrive late (stages 5 and 7), so both stats are used
as secondary stats earlier: Forager uses Local Discovery (stage 1) and
Builder uses Social Craft (stage 3). Basic Mushroom Homes are buildable
from the Workshop so resident capacity can grow long before the
Community Clearing.

### 12.2 Rare habitats

Rare habitats (first: **Moonstone Ring**) are special discoveries found
by Local Discovery work. They unlock Mutations (Section 10.1), allow
Rare-tier attribute variation, and may adjust Mutation weights.

### 12.3 Areas as content

Each area is a data definition: tiles, discovery requirements,
structures, jobs, plants, resources, Wild Visitor pools, and Field Guide
entries. New areas must be addable through data files.

---

## 13. Resources, Economy, and Progression

### 13.1 Resource categories

| Category | Examples | Uses |
|---|---|---|
| Natural | Twigs, bark, stones, leaves, berries, nuts, seeds, dew, clay | Planting, building, trading for Glimmer, food |
| Fungal | Spores, rare spores, compost, mycelium threads | Fungal cultivation, soil upgrades, station upgrades |
| Magical | Glow dust, moonlight, spirit dew, stardust, crystal fragments | Enchantment, rare habitats, insight tools, advanced structures |
| Crafted | Planks, woven fiber, polished stone, charms, gifts, decorations | Buildings, workstations, decorations, upgrades, consumables |
| Currency | **Glimmer** (soft currency) | Breeding costs; minor purchases at the Trading Stump |

### 13.2 Glimmer (soft currency)

Glimmer is the forest's in-game currency (decision D-14). It is earned
only through play and can never be bought; there is no premium currency.

- **Earning:**
  - Every completed work cycle yields a small amount of Glimmer
    (Config: `glimmerPerCycle`, default 1, multiplied by Effectiveness and
    rounded down with a seeded remainder roll).
  - Surplus resources can be traded for Glimmer at the **Trading Stump**
    in the Starting Clearing (Config: `tradeRates`, with a daily limit
    per resource, Config: `tradeDailyLimit`, so trading is a top-up, not
    the main source).
  - Milestones and Field Guide discoveries award one-time Glimmer.
- **Spending:** breeding (Section 9.7) and small Trading Stump items
  (seeds, decorations). Buildings and upgrades cost materials, not
  Glimmer, so forest development stays tied to work.
- **Starting balance:** Config: `startingGlimmer` (default 0). With
  default rates, two to three starter workers earn a breeding's cost in
  roughly 10–15 minutes of play.
- **Safety:** imports, Guests, and Wild Visitors never grant Glimmer.
  Glimmer is stored as an integer, cannot go negative, and is earned per
  resolved cycle so offline earnings follow the same duplicate rules as
  resources.

### 13.3 Progression

- Start with a small clearing, three starter mushrooms, a basic garden,
  the Breeding Nook, and two jobs.
- Unlock new jobs and workstations through discovery and construction
  (Section 12).
- Unlock breeding layers through breeding milestones and station
  upgrades (Section 10).
- Expand the forest in sections, each with new terrain, habitats,
  plants, Wild Visitors, and attribute variety.
- Grow specialists by line-breeding for Advanced Traits, Perk levels, and
  Mutations; use them where their stats matter.
- Long-term collection milestones and cosmetic goals ensure progression
  is not only about producing more resources.

### 13.4 Offline progress

- On load, compute `elapsed = now − lastSeenAt`, clamped to
  `[0, offlineCap]` (Config: `offlineCapHours`, default 8).
- If `now < lastSeenAt` (clock moved backward), grant nothing and keep
  `lastSeenAt` unchanged.
- Resolve job cycles, plant growth, incubation, and Wild Visitor arrivals
  over the elapsed window. For performance, resolution MAY aggregate
  cycles per time segment (day phase × weather), but must produce
  deterministic results.
- Each job assignment keeps a `lastResolvedCycle` cursor; cycles at or
  before the cursor are never granted again.
- Display a return summary: resources produced, plants tended, projects
  advanced, discoveries, and incubations ready to claim.

---

## 14. Friend Sharing and Social Play

### 14.1 MVP: portable mushroom exchange

Because GitHub Pages is static hosting, the MVP does not promise
real-time multiplayer. Exchange works like this:

1. The player chooses an owned mushroom and selects **Share**.
2. The game exports a compact, versioned mushroom record as a JSON file
   or an encoded share code (`MF1-…`, base64url with checksum).
3. The player sends it to a friend by any external method.
4. The friend imports it. It is previewed, validated, and added as a
   **Guest** in their Guest Grove.
5. The original owner keeps their mushroom; sharing copies genetics, it
   does not transfer the creature.
6. The receiving player breeds their own mushroom with the Guest. The
   offspring belongs to the breeder and can be exported back.

### 14.2 Genetic donor value

A mushroom with rare attributes, strong Advanced Traits, three high-level
Perks, and a rare Mutation is a desirable donor because its genetics can
enter another player's population through normal inheritance rolls.

- Sharing preserves the mushroom's complete genetic identity: ordinary
  attributes, colour sub-gene, cosmetic genes, Advanced Traits (with
  their `traitUid` and origin), Perks and levels, Mutation, temperament,
  generation, and lineage summary.
- Before breeding, the player can inspect a Guest's full detail screen:
  attributes, recalculated stats, traits, Perks, Mutation, origin forest,
  and lineage.
- Offspring lineage records both parents, including the friend's
  mushroom (stored as a lineage snapshot so it survives if the Guest is
  later removed).
- Guest genetics are subject to all normal inheritance chances; a Guest
  never guarantees its bonuses.

### 14.3 Guest rules

- Guests cannot work, produce, or grant resources, currency, unlocks, or
  progression.
- At least one parent in any breeding must be owned (no Guest × Guest).
- Guest Grove capacity: Config: `guestCap` (default 10). Removing a
  Guest requires confirmation and does not affect offspring.
- Guests cannot be re-exported in the MVP; owned offspring of Guests can
  (decision D-6).
- Guest genetics from locked systems are carried dormant (Section 10.3).

### 14.4 Import validation and safety

Validation is all-or-nothing; any failure rejects the import with a clear
message and leaves the save untouched.

- **Format:** payload ≤ Config: `maxSharePayloadBytes` (default 4 KB);
  valid encoding and checksum; supported share schema version. Records
  from a newer game version with unknown content IDs are rejected with
  "This mushroom needs a newer version of Mushroom Forest."
- **Content IDs:** every attribute, Perk, and Mutation ID exists in the
  receiver's content definitions.
- **Values:** RGB integers 0–255; colour sub-gene templates and orders
  valid; generation an integer ≥ 1; Perk levels within 1..max; trait
  bonus equals config; trait stats valid.
- **Limits:** ≤ 8 traits, ≤ 3 distinct Perks, ≤ 1 Mutation.
- **Plausibility** (catches hand-edited records): traits ≤
  `min(8, 2^(generation−1) − 1)`; a Perk at level L requires generation ≥
  L + 1; a Mutation requires generation ≥ 2.
- **Strings:** name and forest name ≤ 24 characters, trimmed, control
  characters removed, rendered as text only (never HTML).
- **Never trusted:** stat totals, rarity, productivity, or any resource
  quantity in the payload are ignored; all derived values are recalculated
  from validated genetics.
- **Identity:** the Guest receives a new local instance ID; its
  `originalId`, `originForestId`, and lineage metadata are preserved.
- **Duplicates:** a stable `shareId` (hash of canonical genetic payload +
  origin IDs) prevents importing the same mushroom twice; importing a
  mushroom from your own forest is rejected.
- Imported content is never executed.

**Static-hosting limitation (labelled):** without a server, the game
cannot prove a share code was bred legitimately. Validation guarantees
every import is a *legal* mushroom within all caps and plausibility
rules, but a determined player could hand-craft a legal, high-end
record. Server-validated provenance is a future backend feature.

### 14.5 Future online features

A later backend could add player profiles, friend lists, asynchronous
breeding requests, a public mushroom market, cloud saves, signed
provenance, and server-validated trades. The share record and breeding
resolver are kept modular so these can be added without rewriting the
breeding system.

---

## 15. User Interface and Screens

### 15.1 Screen overview

| Screen | Key contents |
|---|---|
| Forest | Main scene: terrain, plants, structures, visible mushrooms, local-time/weather indicator, Glimmer balance, resource summary, navigation. |
| Mushroom Detail | See 15.2. |
| Collection | Owned residents, Archive, Guests; filters by affinity, rarity, generation, job, trait, Perk, Mutation. |
| Field Guide | See Section 16. |
| Breeding | See 15.3. |
| Jobs | Unlocked and locked jobs (with unlock requirements), eligible mushrooms ranked by job score, estimated output, active assignments. |
| Inventory | Resources, seeds, spores, crafted items, consumables, discoveries; sorting and filtering. |
| Build / Decorate | Place, move, rotate (if supported), remove; costs, habitat influence, restoration projects. |
| Sharing | Export mushroom (code + file), import (paste or file), validation results, Guest preview, Guest Grove list. |
| Settings | Sound, animation, accessibility, save export/import, reset with confirmation, version information. |

### 15.1a The Store (v0.8, decision D-21)

Everything that can be put down is bought in the **Store** (a bottom-menu
tab), organised in tabs: Workstations (extra copies of any unlocked job's
station), Housing, Breeding (pens and pen upgrades), Decor (including
Sprite Workshop decorations), Paths & Bridges, and Ground (terrain paint).
Each item shows its art, what it does, its cost, how many you own, and why
it is locked. Buying enters placement: tap free spots to put down one or
more, then Done. Build mode keeps Clear, Move, Remove and Paint.

### 15.2 Mushroom Detail screen

- Full animated sprite, including Mutation visual effect.
- Name (rename), Genetic Rarity tier, Affinity, temperament.
- **Ordinary attributes:** each category with its attribute name, tier,
  and stat contribution; cap colour swatch with RGB, colour family, and
  the 12-point allocation breakdown.
- **Eight job stats:** bar per stat with stacked segments (attributes /
  traits / Mutation) and any capped overflow.
- **Advanced Traits:** list with stat, +4, origin mushroom and generation.
- **Perks:** name, current level and strength, max level, condition,
  dormant marker if applicable.
- **Mutation:** name, visual preview, bonuses, origin (spontaneous or
  inherited from …).
- Generation number and parent lineage (parents and grandparents, tap to
  navigate; Guest parents shown with origin forest).
- Assigned job, job score, effectiveness label, current productivity
  including active Perk conditions ("Rain Worker active +5%").
- Actions: Assign, Breed, Share, Archive/Move to residents.

### 15.3 Breeding screen

- Select two mushrooms (owned, Guests, present Wild Visitors), with
  eligibility reasons for unavailable ones.
- Parents displayed side by side: sprites, attributes, stats, traits,
  Perks, Mutations.
- **Inheritance categories:** for each attribute category, the two
  candidate attributes plus "variation possible"; trait and Perk pools
  marked "may be inherited"; shared Perks marked "may combine"; Mutation
  status ("may inherit" / "rare spontaneous chance"). No exact outcome
  and, before the Spore Lens, no exact percentages.
- Glimmer cost (or "Free" for the first breeding), incubation time, and
  slot availability; **Begin Breeding**.
- Incubation view: spore cluster at the station with countdown.
- Reveal sequence: attributes first, then new trait/Perk/Mutation
  highlights with distinct celebratory effects.
- Offspring record: parent-versus-offspring comparison and lineage entry.

### 15.4 Mobile-first interaction

Large touch targets, readable text, clear modal close controls, no
essential controls behind hover, safe-area-aware layouts. The forest
must remain usable on a narrow phone screen.

---

## 16. Field Guide and Tutorials

### 16.1 Field Guide sections

| Section | Contents |
|---|---|
| Ordinary Attributes | Every attribute by category, tier, sprite, and exact stat contribution; undiscovered ones shown as silhouettes with habitat hints. |
| Colour | How RGB is split into Red/Green/Blue groups, the 12-point budget, allocation templates, an interactive example, and the colour-family collection. |
| Advanced Traits | Discovered trait stats, total traits bred, notable lineages, stacking milestones. |
| Perks | Perk collection with conditions, levels discovered, max levels, and combination rules once seen. |
| Mutations | Mutation collection with visuals; undiscovered ones shown as mysterious silhouettes with hints. |
| Jobs | Descriptions, primary/secondary stats, workstations, unlock requirements, synergies discovered. |
| Breeding Milestones | Unlock stages, generations reached, collection goals. |
| Habitats & Areas | Areas, habitat requirements, Wild Visitors, rare habitats. |

### 16.2 Tutorials

Every new system has a short, skippable tutorial and a matching Field
Guide entry: first job assignment, first breeding, first Advanced Trait,
Spore Cradle and first Perk, first Mutation unlock, first Guest import,
first insight tool.

---

## 17. Art Direction and Asset System

- Use the supplied mushroom sprite sheet as a visual reference for colour
  variety, cap silhouettes, markings, stems, shadows, and pixel density.
- **Generator (v0.9, D-22).** Mushrooms are 30×36 sprites. The stem is
  drawn first, standing on row 34, and its length decides where the cap
  sits (Stubby 5 rows … Lanky 15). Caps are made in a reference frame
  (bottom on row 23) and moved into place; each lobe is shaded on its own
  with a five-step ramp (highlight, light, base, shade, deep hem) lit
  from the top left, with hue-shifted shadows. Outlines are dark cap or
  stem colour depending on the part they wrap. Tuftcap draws two extra
  bells on their own stalks; Lumpcap sits on the ground and hides its
  stem, with the face on the cap.
- **Colours.** Cap colour (stats), a **second colour** that paints
  spots, stripes, speckles, rings, patches, beads, scales, sheen and stem
  warts, and a stem colour from a drab palette (cream, bone, biscuit,
  tan, fawn, ash, dove, lichen, heather, umber, ochre, sage). Second and
  stem colours are inherited from one parent (or blended when alike) and
  occasionally jump to another palette shade.
- Parts can be redrawn in the Sprite Workshop; edited parts are colour-role
  masks recoloured by each mushroom's genes.
- Build mushrooms from modular layers: cap base, cap highlight/shade
  ramp, markings, gills/underside, stem, feet/base shadow, ordinary glow,
  and Mutation effect layers.
- Cap shading ramps are generated from the stored RGB with a fixed
  palette rule so every colour reads well with dark outlines.
- Consistent pixel scale and nearest-neighbour rendering; no blurry
  scaling.
- Sprites are composed from genes so offspring visibly inherit traits.
- Rarity is readable through unusual palettes, markings, glow,
  particles, or silhouettes, not only a coloured label.
- Each Mutation has defined assets: outline/aura layer, particle system,
  and idle/working animation variants. Ordinary glow is subtle; Mutation
  glow is coloured and animated, so the two never look alike.
- Animation states: idle, walking, working, carrying, resting, and
  special action where practical.
- The forest is warm, cozy, slightly mysterious, and uncluttered.
  Mushrooms are cute and characterful, not overly humanoid.

---

## 18. Data Model

Stable IDs and data-driven definitions; content is separate from UI and
simulation logic.

### 18.1 Content definitions

| Entity | Important fields |
|---|---|
| AttributeDefinition | id, category, name, tier, statContributions{8}, variationNeighbours[], spriteLayerId, habitatSources[] |
| ColorFamilyDefinition | id, name, referenceRgb, lightnessBand |
| PerkDefinition | id, name, description, condition, effectType, levels[], maxLevel, combineRule, relatedStat |
| MutationDefinition | id, name, statBonuses or bonusRule, specialEffects[], visualAssetIds, baseWeight, habitatWeightModifiers |
| JobDefinition | id, name, family, primaryStat, secondaryStat, baseDuration, baseOutput, workstationId, eligibleTargets, unlockRequirement, applicablePerkConditions, animationState |
| AreaDefinition | id, discoveryRequirement, structures[], jobs[], plants[], resources[], wildVisitorPool |
| StructureDefinition | id, cost, buildRequirement, unlocks[], workerSlots |
| PlantDefinition | id, name, habitatRequirements, growthDuration, outputs, rarity, visualAssetId |
| MilestoneDefinition | id, trigger, unlocks[], tutorialId, fieldGuideEntryId |

### 18.2 Runtime records

| Entity | Important fields |
|---|---|
| MushroomInstance | uid, name, createdAt, generation, status (resident / archived / guest / wild), parentIds, lineageSnapshot, genes, advancedTraits[], perks[], mutation, temperament, jobId, targetId, restedState, restUntil, originalId, originForestId, shareId |
| MushroomGenes | capShape, capColor{r,g,b}, colorAllocation{red,green,blue: {template, order[]}}, stem, markings, gills, glow, accentColor, stemColor, patternSeed |
| AdvancedTrait | traitUid, stat, bonus, originMushroomId, originName, originGeneration, originForestId, originBreedingId, dormant |
| PerkInstance | perkId, level, originMushroomId, originGeneration, originForestId, dormant |
| MutationInstance | mutationId, resolvedBonuses, origin, originMushroomId, originGeneration, originForestId, dormant |
| DerivedStats (cache, never authoritative) | base{8}, traitBonus{8}, mutationBonus{8}, final{8}, overflow{8}, affinity, rarityScore |
| WorldObject | id, definitionId, tileX, tileY, rotation, state, growthProgress, storedOutput |
| JobAssignment | mushroomUid, jobId, targetId, assignedAt, lastResolvedCycle |
| ResourceStack | resourceId, quantity |
| BreedingRecord | id, parentAUid, parentBUid, parentSnapshots, startedAt, completesAt, outcomeSeed, breedingCounter, configVersion, sealedOffspring, state (incubating / ready / claimed), claimedAt |
| GuestRecord | mushroomUid, shareId, importedAt, sourceForestName |
| PlayerSave | schemaVersion, configVersion, localPlayerId, forestName, createdAt, lastSeenAt, lastTimezoneOffset, worldSeed, rngRoot, breedingCounter, breedingsCompleted, glimmer, tradeLimitsByDate, world, mushrooms, guests, breedingRecords, inventory, discoveries, unlocks, fieldGuide, settings |

### 18.3 Share record (export format)

`shareSchemaVersion, shareId, name, originalId, originForestId,
originForestName, generation, genes, temperament, advancedTraits[],
perks[], mutation, lineageSummary (parents and grandparents: name,
originalId, generation, forestName), exportedAt, checksum`.

It deliberately contains **no** stats, rarity, resources, or progression.

---

## 19. Centralized Configuration

All balance values live in one versioned configuration module
(`configVersion` stored in saves and sealed breeding records). Initial
groups and keys:

| Group | Keys (defaults) |
|---|---|
| Stats | `statCap` 100; category budgets (18/12/12/10/8/6); `rareTierBudgetBonus` 2; `colorBudget` 12; `colorZeroFallback` (1,1,1); attribute contribution tables |
| Starters | `starterCount` 3; `starterMaxStat` 28; `starterMaxAttempts` 500; `starterPalette`; curated fallback set |
| Advanced Traits | `advancedTraitBonus` 4; `maxAdvancedTraits` 8; `newAdvancedTraitChance` 0.25; `traitInheritChanceSingle` 0.5; `traitInheritChanceShared` 0.75; `advancedTraitStatWeighting` uniform; `tutorialGuaranteedFirstTrait` true |
| Perks | `maxPerks` 3; `newPerkChance` 0.08; `perkInheritChanceSingle` 0.5; `perkInheritChanceShared` 0.9; combine-rule chances; `newPerkAffinityWeight` 0.6; perk level tables |
| Mutations | `maxMutations` 1; `spontaneousMutationChance` 0.0075; `mutationInheritChanceSingle` 0.35; `mutationInheritChanceBoth` 0.6; `mutationWeights`; mutation bonuses |
| Inheritance | `attributeParentWeight` 0.5; `attributeVariationChance` 0.06; `rareVariationShare` 0.2; `firstBreedVariationEnabled` false; `colorBlendRange` [0.3,0.7]; `colorJitter` 12; `colorVariationHueShift` 30; `temperamentInheritance` |
| Breeding | `incubationMinutes` 3; `parentRestMinutes` 10; `offspringMaturationMinutes` 0; `freeBreedingCount` 1; `breedingCostGlimmer` 15; station slots, speed modifiers and discounts |
| Economy | `startingGlimmer` 0; `glimmerPerCycle` 1; `tradeRates`; `tradeDailyLimit`; milestone rewards |
| Unlocks | milestone triggers (Section 10.1), area discovery triggers (Section 12.1) |
| Jobs | `jobScoreWeights` 0.7/0.3; `effectivenessCurve`; `productivityBonusCap` 0.6; job durations and outputs; temperament values |
| World | `dayPhaseHours` (Dawn 5–8, Day 8–18, Dusk 18–21, Night 21–5); `weatherWeights` 65/20/15; `rainWindows`; `wildVisitorStayHours` 12; `visibleMushroomCap` 10; `baseResidentCap` 8; `homeCapacity` 2 |
| Offline | `offlineCapHours` 8 |
| Rarity | point values and tier thresholds (Section 6.6) |
| Sharing | `maxSharePayloadBytes` 4096; `guestCap` 10; name length 24 |

Configuration is data, not scattered constants; game logic reads it
through one accessor so tests can inject alternative values.

---

## 20. Anti-Exploit and Technical Requirements

- **Sealed breeding:** the outcome seed is generated and saved at
  incubation start and the offspring is resolved and sealed immediately
  (Section 9.6). Refreshing never rerolls; changing the device clock never
  changes the outcome.
- **Clock handling:** elapsed time is clamped to `[0, offlineCap]`; a
  backward clock grants nothing. *Labelled limitation:* moving the device
  clock forward can finish timers early on a static, local-only game; the
  outcome is unaffected and the offline cap limits production gains.
- **Single claim:** breeding records move incubating → ready → claimed in
  one atomic save transaction that also adds the offspring; a claimed
  record can never produce another offspring.
- **No duplicate production:** per-assignment `lastResolvedCycle`
  cursors, covering resources and Glimmer.
- **Currency integrity:** Glimmer is an integer that cannot go negative;
  spending and the action it pays for happen in one save transaction.
- **Logic-level caps:** stat cap, trait cap, Perk cap, Mutation cap,
  productivity bonus cap, and Perk max levels are enforced in the
  simulation and on every load and import, not just in the UI.
- **Recalculate, never trust:** stats, rarity, and productivity are
  always derived from validated genetics. Imported or loaded stat values
  are ignored.
- **Save integrity:** schema-validated load; on corruption, keep the last
  valid save and offer the backup flow. Invalid imports never overwrite a
  valid save.
- **Centralized configuration:** all probabilities, distributions, caps,
  and Perk rules live in Section 19's configuration.
- **Dev controls** (behind a development flag only): grant resources,
  unlock stages, advance time, force trait/Perk/Mutation rolls, generate
  test mushrooms of any generation, and inspect sealed outcomes.

---

## 21. Quality and Acceptance Principles

- Playable on a phone in portrait orientation and usable with touch.
- Refreshing or closing the browser never erases a valid save.
- No mushroom can be permanently lost through work or breeding.
- Breeding creates persistent offspring with recorded parents.
- Work has a meaningful, visible or clearly reported outcome.
- Different jobs and genetic specialties have distinct uses; no single
  stat profile is best for every job.
- Imported mushrooms cannot inject resources, unlocks, scripts, illegal
  bonuses, or invalid data.
- The app deploys correctly under a GitHub Pages project subpath.
- Clear empty states, error messages, confirmations for destructive
  actions, and a way to export a backup.

---

## 22. Test Plan

Automated tests run against the simulation layer (no UI) with injectable
configuration and seeds.

### 22.1 Required tests

| # | Test | Verification |
|---|---|---|
| 1 | New player receives exactly three basic mushrooms | Over many seeds, a new save has exactly 3 mushrooms, all Basic-tier attributes, generation 1, starter-palette colours. |
| 2 | Starters have no Advanced Traits, Perks, or Mutations | All three lists empty / null for every generated starter. |
| 3 | Identical ordinary attributes → identical stat contributions | Two mushrooms with identical attributes and colour genes produce identical base stats, across reloads and recalculation. |
| 4 | Every colour gene contributes exactly 12 points | Property test over random and edge RGB (incl. 0,0,0 and single channels): colour contribution sums to 12. |
| 5 | Yellow distributes 6 / 6 / 0 | (255,255,0) → Red 6, Green 6, Blue 0. |
| 6 | White distributes 4 / 4 / 4 | (255,255,255) → 4 / 4 / 4; brightness invariance: (100,100,100) identical. |
| 7 | Advanced Traits give exactly +4 to one eligible stat | A new trait changes exactly one stat by +4; never targets a stat with < 4 headroom. |
| 8 | No stat can exceed 100 | Max-power fixtures (max attributes + 8 same-stat traits + Mutation) clamp at 100 and record overflow. |
| 9 | No mushroom can have more than three Perks | Breed two 3-Perk parents with disjoint Perks many times; offspring ≤ 3. |
| 10 | No mushroom can have more than one Mutation | Across many breedings and imports, mutation count ≤ 1. |
| 11 | Two mutated parents cannot produce two Mutations | Force inheritance chances to 100%; offspring has exactly one. |
| 12 | Duplicate Perks follow their upgrade rules | Rain Worker L1 × L1 → L2; unequal levels → max (± configured chance); `slow` rule respected; never exceeds max level. |
| 13 | Spontaneous Mutation rolls only without inherited Mutation | Instrumented RNG: spontaneous roll invoked iff no parental Mutation inherited. |
| 14 | Refreshing during incubation cannot change the offspring | Start incubation, serialize, reload, change clock, change config version: claimed offspring equals sealed result. |
| 15 | Invalid imports cannot grant illegal bonuses | Fuzzed and hand-crafted payloads (9 traits, bonus 5, unknown IDs, level > max, implausible generation, injected stats/resources, oversized strings) are rejected or recalculated; save unchanged on rejection. |
| 16 | Jobs stay locked until discovery and construction | Each job unavailable until both its discovery flag and workstation completion are true; assignment API rejects locked jobs. |

### 22.2 Balance simulation (required before locking probabilities)

Per decision D-12, the probability defaults in Section 9.5 are approved
**provisionally** and must be validated with a headless breeding
simulation before they are treated as final:

- Simulate at least 20 generations of breeding (many seeds) under
  several player strategies: random pairing, line-breeding toward one
  stat, and breeding with a strong Guest donor.
- Report per generation: average and best single stat, Advanced Trait
  counts, Perk counts and levels, Mutation frequency, and Rarity tier
  distribution.
- Targets to check: starters stay below 30 in every stat; meaningful
  specialists (60+ in one stat) appear only after several selective
  generations; the first Mutation typically appears within a reasonable
  play period after unlock; 100-stat mushrooms remain very rare; no
  single strategy dominates.
- The simulation reuses the real breeding resolver and configuration (no
  separate balance math), and its report is kept with the config
  version.

### 22.3 Additional recommended tests

- Every mushroom without Rare attributes has a base stat total of 66;
  each Rare attribute adds exactly `rareTierBudgetBonus`; every
  attribute row sums to its category's (Basic/Uncommon or Rare) budget.
- Day-phase mapping: fixed timestamps and time-zone offsets map to the
  expected Dawn/Day/Dusk/Night; weather is identical for the same
  `worldSeed` and local date.
- First breeding is free; the second is rejected without enough Glimmer
  and deducts exactly the configured cost when affordable; imports never
  change Glimmer.
- Stages unlock only in the listed order.
- Largest-remainder rounding: Amber (255,170,0) → 7 / 5 / 0; tie-breaks
  follow Red → Green → Blue and allocation order.
- Colour allocation is unchanged after recalculation, migration, and
  export/import round trips.
- Starter generation constraints (distinct groups, Gardener/Forager fit,
  stat cap) hold for 10,000 seeds; fallback set used when attempts run
  out.
- Locked systems produce no new entries; donor entries arrive dormant
  and activate on unlock.
- At most one new Advanced Trait per breeding; trait cap 8 respected.
- Breeding never modifies either parent.
- Offline: double load does not double-grant; backward clock grants
  nothing; elapsed beyond 8 h is clamped.
- Share round trip: export → import in a second save preserves genetics,
  assigns new uid, rejects duplicate import and own-forest import.
- Productivity bonus cap is respected with all Perks/temperament active.

---

## 23. MVP Scope

### Must have

- A playable, responsive forest scene with a small editable grid or
  placement system.
- At least 3 habitat/terrain types and a small set of plants, fungi, and
  decorative objects.
- Three randomized, complementary, Basic-only starter mushrooms.
- All six ordinary attribute categories with Basic and Uncommon content
  (at least 12 visual combinations; the Basic pool alone provides far
  more), plus the RGB colour stat system.
- The eight job stats with derived base stats and the 100 cap.
- Persistent mushroom identities, names, stats, Affinity, temperament.
- At least 4 functional jobs: Gardener, Forager, Mycologist, Woodworker,
  each unlocked through its development stage.
- A working breeding cycle with sealed seeded resolution, attribute
  inheritance and variation, lineage, and generation tracking.
- Advanced Traits with the Early Breeding Milestone unlock.
- Perks with the Spore Cradle unlock (initial catalogue of 8–12).
- Mutations with the Moonstone Ring / Generation 5 unlock (initial four,
  with visuals).
- Real-local-time day/night phases and seeded weather (required by
  Perks).
- Glimmer currency, Trading Stump, and the breeding cost.
- A Field Guide with Ordinary Attributes, Colour, Advanced Traits,
  Perks, Mutations, and Jobs sections.
- The development stages needed to reach the Perk and Mutation unlocks
  (through Root Hollow), including the Moonstone Ring rare habitat.
- Offline production and a return summary.
- Save/load, schema versioning, and manual save export/import.
- Mushroom export/import sharing with full validation and Guests.
- Centralized configuration and the required test suite (Section 22.1).

### Should have

- Visible walking and job animations.
- Basic job synergies.
- Enchanted Landmark and Community Clearing stages.
- Wild Visitors.

### Not in MVP

- Combat, battles, expeditions, or sending mushrooms away from the forest.
- Real-time multiplayer, accounts, cloud saves, or live friend visits.
- Payments, premium currency, ads, or monetization.
- Large procedural worlds or complex pathfinding.
- Dozens of jobs before the core loop is proven.
- Breeding insight tools (planned for Expansion).
- Hidden/recessive (carrier) genes.
- Releasing or deleting mushrooms.
- Re-sharing Guests.

---

## 24. Suggested Build Phases

| Phase | Deliverable | Acceptance criteria |
|---|---|---|
| 0. Foundation | Project setup, responsive layout, save model, centralized config, content definitions, seeded RNG utilities, test harness. | Runs locally and on GitHub Pages subpath; save/load survives refresh; config accessor and RNG sub-streams tested. |
| 1. Genetics core | Attribute tables, colour system, stat calculator, starter generator, sprite composition. | Tests 1–6 and 8 pass; three starters render and look visibly different. |
| 2. Forest prototype | Place terrain/objects; display mushrooms; basic movement. | Player can create a small habitat and see mushrooms in the world. |
| 3. Work loop | Gardener, Forager, then Fungal Patch and Workshop unlocks; inventory; Glimmer and Trading Stump; job scores; production timers. | Each job produces a distinct output; assignment, output, and Glimmer persist; test 16 passes. |
| 4. Breeding | Breeding Station, sealed resolution, attribute inheritance/variation, lineage, Advanced Traits, milestone unlocks, Glimmer cost; headless balance simulator. | Offspring differ visibly and genetically; parents unchanged; tests 7, 14 pass; first simulation report produced. |
| 5. Collection and polish | Mushroom Detail, Field Guide, reveal animation, offline return summary. | Player can understand stats and discoveries; offline production consistent. |
| 6. Social exchange | Share codes/files, validation, Guests, dormant carry. | Two separate browser saves exchange mushrooms; test 15 passes. |
| 7. Perks, Mutations, time | Local-time phases, weather, Spore Cradle, Perks, Pond/Creek and Root Hollow, Moonstone Ring, Mutations and visuals. | Tests 9–13 pass; Perks visibly activate in the right conditions; 20+ generation simulation reviewed and probabilities confirmed. This completes the MVP. |
| 8. Expansion | Enchanted Landmark, Community Clearing, synergies, Wild Visitors, insight tools, more content. | New content added through data files without rewriting core systems. |

---

## 25. Instructions to the Development Agent (Claude)

Build this as an iterative extension of the existing repository if one
is provided. Before changing code, inspect the repository, identify its
framework, current architecture, assets, and existing save system. Do
not discard or rewrite working systems without explaining why and
obtaining approval.

1. Start by reporting the existing project structure and a short
   implementation plan.
2. Implement in small, testable phases (Section 24). Keep the app
   runnable after each phase.
3. Preserve existing functionality, assets, and player saves. Add
   migrations when changing save data.
4. Use modular, data-driven definitions for attributes, colours, traits,
   Perks, Mutations, jobs, plants, resources, areas, and structures.
5. Keep game simulation logic (including the stat calculator and the
   breeding resolver) separate from rendering and UI.
6. Keep every balance value in centralized configuration (Section 19).
7. Make GitHub Pages deployment work from a repository subpath, not only
   localhost.
8. Do not add backend-dependent features to the MVP. Clearly label any
   feature that cannot be delivered securely with static hosting.
9. Add developer/test controls (Section 20) behind a development flag.
10. Implement the required tests (Section 22.1) alongside the systems
    they cover.
11. After each phase, summarize files changed, features implemented,
    known limitations, and manual test steps.
12. Do not claim a feature is complete unless it is implemented and
    tested.

---

## 26. Design Decisions

Defaults chosen for the first prototype. All remain configurable.

| Decision | v0.2 choice | Notes |
|---|---|---|
| Game title | Working title: Mushroom Forest | |
| World layout | Small grid-based clearing with free decoration layer if feasible | |
| Starting population | Exactly 3 randomized Basic mushrooms | Supersedes v0.1 "6–10" and "two starters". |
| Visible population | Up to 10 animated; rest simulated in background | |
| Resident capacity | 8 + 2 per Mushroom Home; overflow to Spore Archive | |
| Stat scale | 0–100 per stat, hard cap 100 | |
| Base stat total | 66 without Rare attributes; +2 per Rare attribute (max 76) | D-1 |
| Colour budget | 12 points, RGB-normalized, largest-remainder rounding | |
| Advanced Trait | +4, max 8, max one new per breeding | |
| Perks | Max 3, level-based, per-Perk combination rules | |
| Mutations | Max 1, spontaneous 0.75% | |
| Breeding duration | 3 minutes for testing; rebalance later | |
| Offline cap | 8 hours | |
| Day/night | Player's real local time; seeded weather per local date | D-10 |
| Currency | Glimmer, earned only through play | D-14 |
| Breeding cost | First breeding free, then 15 Glimmer | D-14 |
| Stage order | Strictly linear, as listed in Section 12.1 | D-15 |
| Rarity tiers | Common, Uncommon, Rare, Epic, Legendary — derived score | |
| Social exchange | JSON file plus compact share code | |
| Visual scale | Consistent pixel grid based on target phone viewport | |
| Game tone | Cozy, whimsical, slightly mysterious | |

Appendix B records the owner's decisions and the few new items they
raise.

---

## 27. First Playable Milestone

The first playable milestone proves the central promise with the
smallest possible slice:

- A small forest clearing with a few placeable habitat objects.
- **Three** randomized starter mushrooms with distinct appearances and
  complementary stat profiles, each showing its eight stats.
- A Gardener job that visibly tends a plant and produces a resource.
- A Forager job that visibly gathers a different resource.
- A Breeding Nook that combines any two starters and produces a visibly
  mixed offspring, with parents unchanged.
- Advanced Traits unlocking after the second breeding, with the first
  trait visible on the offspring's detail screen.
- A collection screen showing parents, offspring, and lineage.
- A working local save that survives refresh, including mid-incubation.

If this slice is enjoyable, expand the job roster, habitats, Perks,
Mutations, social sharing, and genetic depth. If it is not, improve the
feel of breeding and visible forest life before adding more content.

---

## Appendix A — Resolved conflicts with v0.1

| v0.1 statement | v0.2 resolution |
|---|---|
| "Work is the primary progression mechanic." | Breeding is the central long-term progression system; work and forest development drive world progression and unlocks. |
| Start with "a few common mushrooms" / "6–10 visible mushrooms" / "two starter mushrooms". | Exactly three randomized Basic starters. The visible cap (10) remains for later populations. |
| Affinity as an independent gene (Bloom, Spore, Glow, Spirit, Verdant, Shimmer). | Affinity is derived from the highest final stat, with one name per stat. It grants no bonus. |
| "Work traits" such as Efficient Waterer, Curious Forager. | Replaced by Perks (conditional bonuses) and Advanced Traits (stat bonuses). |
| Rarity affects gene probability, trait count, and visual effects. | Rarity is a derived descriptive score. Probabilities come only from configuration; attribute tiers affect visuals and collections, not stat budgets. |
| "Rare mutations can introduce a gene not visibly present in either parent." | Renamed **attribute variation** (ordinary genes). "Mutation" now means the rare top-tier genetic layer. |
| MVP "low-probability mutation". | Satisfied by attribute variation; the full Mutation system is also MVP Must-have (D-7), gated behind its unlock. |
| Glow as a single gene that can affect magical jobs. | Split into ordinary glow (attribute, budget 6) and Mutation glow effects. |
| Stats "tuned through playtesting" with no derivation. | Stats are fully derived: attributes + traits + Mutation, capped at 100. |
| Habitats "create opportunities to discover wild mushrooms". | Wild Visitors: temporary, ordinary-only donors; they do not join the collection in the MVP. |
| Perk example "Dew Collector" vs job "Dew Collector". | Perk renamed Morning Dew. |
| Social Craft listed last in progression, leaving Blue-group stats unused. | Stages stay linear in the listed order (D-15); Forager uses Local Discovery and Builder uses Social Craft as secondary stats so both are useful early. |
| Mushroom Homes listed only in the final Community Clearing. | Basic homes are buildable from the Workshop; the Community Clearing adds larger homes. |
| Day/night as a Should-have visual only. | Day/night follows real local time and, with seeded weather, is MVP Must-have because Perks depend on it. |
| "Payments, premium currency … not in MVP" and no currency defined. | Glimmer is a soft currency earned only through play; premium currency remains excluded. |
| v0.1 Section 8.4 "never consume parents". | Retained and extended: parents are never modified by breeding. |

---

## Appendix B — Owner decisions (v0.3)

| ID | Decision | Outcome |
|---|---|---|
| D-1 | Base stat budgets | Rare attributes are slightly stronger: +2 to their category budget (`rareTierBudgetBonus`). Basic and Uncommon remain equal. |
| D-2 | Attribute contribution tables | Approved as listed (Rare rows updated for D-1). |
| D-3 | Advanced Trait stat targeting | Uniformly random among eligible stats. |
| D-4 | Donor genetics for locked systems | Inherited but inactive (dormant) until the system is unlocked. |
| D-5 | Mutation unlock trigger | Moonstone Ring discovery or Generation 5, whichever comes first. |
| D-6 | Re-exporting Guests | Not allowed. Owned offspring of Guests can be shared. |
| D-7 | Advanced Traits, Perks, Mutations in MVP | All three are MVP Must-have. |
| D-8 | Releasing mushrooms | Excluded. |
| D-9 | Wild Visitors | Breeding partners only; never join the collection. |
| D-10 | Time of day | Real local time. |
| D-11 | Job effectiveness curve | Straight line (0.5×–2.0×) for now. |
| D-12 | Probability defaults | Approved provisionally; must be validated by a 20+ generation simulation (Section 22.2). |
| D-13 | Affinity | Derived from highest final stat, 8 names. Approved. |
| D-14 | Breeding cost | One free breeding, then Glimmer (soft currency). |
| D-15 | Development stage order | Strictly linear, in the order listed. |
| D-25 | Spiky stats | Every attribute feeds one or two stats; category budgets ×1.5 (27/18/15/12/9, Rare +3); colour stays at 12. |
| D-24 | Ground blending | Neighbouring land types meet in rounded, wandering edges with a short stepped fade (also across clearings); water shorelines stay crisp. |
| D-23 | Big buildings | Breeding Pens, Mushroom Homes and Cozy Homes cover 3×3 tiles, centred on the tile you tap. |
| D-22 | Mushroom art | Parts-based 30×36 generator; second colour paints patterns; drab stems; focused growth forms map to distinct job families. |
| D-21 | Store | A Store screen with tabs for workstations, housing, breeding, decor, paths & bridges and ground. |
| D-20 | Breeding Pens | Buy-and-place pens; one incubation each (max 3); tap to breed; cradles are pen upgrades. |
| D-19 | Job assignment | Automatic best-fit placement with swapping; player can pin, unpin or rest a mushroom; toggle in Settings. |
| D-18 | Colour genetics | Two colour genes (shown + hidden), sports, and larger heritable shifts. |
| D-17 | Breeding parent selection | Drag and drop (or tap) mushrooms into a breeding pen. |
| D-16 | Forest layout | One continuous forest; the player expands it north, east, south or west, and new job structures spawn at random in the new clearing. |

### B.1 New items raised by these decisions

These have working defaults in the document and do not block
implementation, but may need your review:

| ID | Item | Working default |
|---|---|---|
| N-1 | Currency name | "Glimmer" |
| N-2 | How Glimmer is earned | 1 per work cycle × effectiveness; capped daily trading at the Trading Stump; milestone rewards |
| N-3 | Breeding price | 15 Glimmer, flat (does not rise with generation or rarity) |
| N-4 | Local-time phase hours | Dawn 05–08, Day 08–18, Dusk 18–21, Night 21–05 |
| N-5 | Rare budget bonus size | +2 per Rare attribute (max +10 total) |

### B.2 Balance simulation findings (first implementation)

The first 20-generation simulation (`tools/simulate.js`, report in
`docs/balance-report.txt`) with the approved defaults found:

- Starters behave as intended: best single stat averages 16.6 and never
  exceeds 28.
- **Specialization is slower than intended.** Selective line-breeding for
  one stat reaches only about 35 after 20 generations, and no 60+
  specialists appear. Cause: new Advanced Traits target a uniformly random
  stat (D-3), so only 1 in 8 helps the bred-for stat, and off-target
  traits fill the 8-entry cap. Raising probabilities to the top of their
  ranges only reaches about 38.
- Mutations: the first one appears after a median of about 40 breedings once
  unlocked; a strong donor raises mutation rates in offspring to about 25%.

| ID | Item | Options |
|---|---|---|
| N-6 | Specialization speed | (a) keep uniform targeting and accept slow specialization; (b) weight new traits toward the offspring's top stats; (c) let the Breeding Insight tools (Affinity Tincture) steer traits; (d) raise the trait cap or let new traits replace the weakest-fit trait when full |
