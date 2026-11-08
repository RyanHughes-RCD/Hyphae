# MUSHROOM FOREST

## A cozy breeding, collecting, and forest-life game

**Game Design Document \| Version 0.1 \| November 2026**

> **Design direction:** Breed distinctive mushroom creatures, give them
> meaningful work, and watch a shared forest ecosystem grow.

## 1. Executive Summary

Mushroom Forest is a cozy, pixel-art browser game about cultivating a
magical woodland, breeding highly individual mushroom creatures, and
building a living forest community. Players shape habitats, discover
resources, breed mushrooms with inheritable visual and functional
traits, assign them useful work, and gradually transform an empty
clearing into a thriving ecosystem.

The central fantasy is not commanding an army or sending creatures away
on expeditions. Mushrooms live in the player's forest. They wander,
gather, cultivate, build, tend other inhabitants, and visibly contribute
to the place they call home.

The game is designed first as a single-player web app hosted on GitHub
Pages. The initial social feature should use portable mushroom sharing
(export/import or shareable genetic codes) rather than requiring a
server. True live multiplayer, accounts, cloud saves, and
server-authoritative breeding are future options that require a backend.

## 2. Product Pillars

-   **Breeding is the primary collection mechanic:** every mushroom is
    an individual with a lineage, appearance, affinities, work traits,
    and temperament.
-   **Work is the primary progression mechanic:** mushrooms produce
    resources and improve the forest while remaining visible in the
    world.
-   **The forest is the home, not a menu:** the player shapes habitats
    and watches a small ecosystem operate.
-   **Social sharing creates genetic discovery:** friends can exchange
    mushroom genetics without losing their original creatures.
-   **Cozy, low-pressure play:** progress continues offline, there are
    no combat expeditions, and players are encouraged to decorate and
    experiment.
-   **Readable, extensible systems:** new mushroom species, traits,
    jobs, plants, resources, and structures should be data-driven.

## 3. Target Platform and Technical Constraints

  -----------------------------------------------------------------------
  Area                                Requirement
  ----------------------------------- -----------------------------------
  Platform                            Responsive web app; prioritize
                                      mobile portrait layouts, but
                                      support desktop.

  Hosting                             GitHub Pages static hosting.

  Runtime                             Client-side HTML/CSS/JavaScript or
                                      the project's existing framework.
                                      Do not introduce a backend for the
                                      MVP.

  Persistence                         Local save in browser storage
                                      (prefer IndexedDB for structured
                                      data; localStorage is acceptable
                                      for a small prototype).

  Offline progress                    Save a timestamp and calculate
                                      elapsed production when the player
                                      returns. Clamp unreasonable elapsed
                                      time and prevent negative or
                                      duplicate rewards.

  Social sharing                      MVP: export/import a mushroom as a
                                      compact JSON file or encoded share
                                      code. Validate imported data and
                                      assign a new local instance ID
                                      while preserving lineage/genetics.

  Multiplayer limitation              GitHub Pages alone cannot securely
                                      store shared accounts, synchronize
                                      forests, or validate online trades.
                                      Treat real-time visits/trading as a
                                      later backend feature.

  Save safety                         Version the save schema; support
                                      migration; provide manual
                                      export/import backup. Never
                                      overwrite a valid save with an
                                      invalid import.

  Performance                         Keep the game lightweight and
                                      touch-friendly. Avoid heavy
                                      libraries unless the existing
                                      project already uses them.
  -----------------------------------------------------------------------

## 4. Core Gameplay Loop

1.  **Shape the forest:** place terrain, plants, water features,
    decorations, and work structures to create useful habitats.
2.  **Attract and discover mushrooms:** suitable habitats and conditions
    create opportunities to discover wild mushrooms, spores, or breeding
    materials.
3.  **Breed:** pair two mushrooms to create a spore cluster, incubate
    it, and reveal an offspring with inherited traits and possible
    mutations.
4.  **Assign work:** place mushrooms into jobs suited to their
    affinities, stats, traits, and temperament.
5.  **Grow the ecosystem:** workers gather resources, cultivate plants,
    expand mycelium, construct structures, and attract new forest life.
6.  **Unlock and specialize:** use resources and discoveries to expand
    the forest and create new breeding goals.
7.  **Share:** exchange mushroom genetics with friends, then breed new
    lineages and compare discoveries.

The short session should be satisfying (collect outputs, check workers,
start a breeding cycle, make one small change). The long-term session
should be about planning habitats, completing collections, optimizing
job teams, and discovering rare genetic combinations.

## 5. The Forest World

### 5.1 World presentation

Present a cozy, living forest clearing in a crisp 32-bit-inspired
pixel-art style. Mushrooms should be visually readable at small sizes,
with bold dark outlines, rich cap colors, warm highlights, and distinct
silhouettes. Use the supplied mushroom sprite reference as the primary
inspiration for cap shapes, stems, markings, palette variety, and rarity
expression. Do not simply reproduce the reference sprites; create
original modular assets that can be recombined.

### 5.2 Player-controlled world elements

-   Terrain and habitat tiles (grass, damp soil, moss, leaf litter,
    stone, shallow water, deep shade, magical ground).
-   Plants, flowers, fungi, trees, fallen logs, rocks, ponds, and
    decorative objects.
-   Workstations and structures that unlock or improve jobs.
-   Mushroom homes or resting spots that provide identity and optional
    comfort bonuses.

### 5.3 Habitat influence

Objects and terrain should influence which wild mushrooms, plants, and
resources can appear. The player should be able to understand habitat
requirements through tooltips or a field guide. Avoid opaque spawn
rules: show discovered requirements and provide hints for undiscovered
combinations.

### 5.4 Visible simulation

Mushrooms should move around the forest, travel to work locations,
perform short work animations, carry visible items where practical, and
return to a home/rest point. If the player owns more mushrooms than can
be animated smoothly, use a visible active population cap and represent
remaining workers through efficient background simulation.

## 6. Mushroom Creatures

### 6.1 Individual identity

Every mushroom is a persistent individual, not a disposable worker
token. Each has a unique ID, name, generation, parents/lineage,
appearance genes, affinity, work traits, temperament, and current
assignment.

### 6.2 Genetic and character data

  -----------------------------------------------------------------------
  Attribute                           Design purpose
  ----------------------------------- -----------------------------------
  Cap shape                           Inherited visual silhouette;
                                      e.g. round, flat, bell, wavy,
                                      clustered.

  Cap palette / color genes           Inherited base color and accent
                                      color; allow blended palettes.

  Markings                            Spots, stripes, speckles, rings,
                                      patches, gradients, or unusual
                                      patterns.

  Stem                                Shape, thickness, length, and color
                                      variation.

  Glow                                None to strong; can affect
                                      appearance and certain magical
                                      jobs.

  Affinity                            Primary ecological leaning such as
                                      Bloom, Spore, Glow, Spirit,
                                      Verdant, or Shimmer. These are
                                      thematic examples and can be
                                      renamed.

  Work traits                         Specific bonuses or special
                                      behaviors, such as Efficient
                                      Waterer or Curious Forager.

  Temperament                         Behavioral modifier such as
                                      Industrious, Curious, Sleepy,
                                      Social, Greedy, Gentle,
                                      Mischievous, or Stubborn.

  Rarity                              Affects the probability of unusual
                                      genes, trait count, and visual
                                      effects; rarity must not make
                                      common mushrooms obsolete.

  Stats                               Numeric job capabilities. Use a
                                      clear bounded scale (recommended
                                      0--100) and tune through
                                      playtesting.
  -----------------------------------------------------------------------

### 6.3 Personality and behavior

-   **Industrious:** shorter work cycle or more consistent output.
-   **Curious:** small chance to discover bonus items during suitable
    tasks.
-   **Sleepy:** works less often but may gain a rested bonus after
    downtime.
-   **Social:** gains a modest bonus near compatible mushrooms or
    friends.
-   **Greedy:** gathers extra personal finds but contributes less to
    shared group bonuses.
-   **Mischievous:** small chance of unexpected outcomes or mutations in
    compatible tasks.
-   **Gentle:** improves nearby plants or animal comfort.
-   **Stubborn:** excels in its assigned specialty but has a penalty
    when frequently reassigned.

Personality should add charm and small strategic differences, not punish
players or make a beloved mushroom unusable.

## 7. Jobs and Forest Work

Mushrooms work within the player's forest. There are no away-team
expeditions, combat missions, or creature-loss missions. Jobs should
have visible world interactions and produce resources, improve nearby
objects, or unlock discoveries.

  -----------------------------------------------------------------------
  Job family              Example jobs            Outputs / effects
  ----------------------- ----------------------- -----------------------
  Cultivation             Gardener, Waterer,      Plant growth, flower
                          Fertilizer, Pollinator, yields, seed
                          Pruner                  production, hybrid
                                                  flower chances, soil
                                                  improvement.

  Foraging                Berry Picker, Nut       Berries, seeds, nuts,
                          Gatherer, Wood          twigs, bark, stones,
                          Gatherer, Stone         minerals, dew.
                          Collector, Dew          
                          Collector               

  Mycology                Spore Cultivator,       Spores, compost, fungal
                          Mycelium Weaver,        patches, network links,
                          Decomposer, Spore       discoveries.
                          Harvester, Fungal       
                          Researcher              

  Construction            Woodworker,             Structures, furniture,
                          Stoneworker, Weaver,    paths, nests, bridges,
                          Builder, Landscaper     habitat improvements.

  Magic                   Enchanter, Moonlight    Magical materials,
                          Gatherer, Crystal       enchanted plants, rare
                          Resonator, Forest       visitors, landmark
                          Healer, Spirit Keeper   effects.

  Animal care             Nest Tender, Insect     Animal habitats, insect
                          Keeper, Egg Warmer,     colonies, incubation
                          Animal Feeder, Creature bonuses, visitor
                          Caretaker               happiness.

  Local discovery         Root Digger, Hollow     Hidden objects,
                          Searcher, Creek         underground materials,
                          Searcher, Burrow        local discoveries,
                          Investigator, Night     nocturnal finds.
                          Watcher                 

  Social craft            Gift Maker, Festival    Friend gifts, event
                          Helper, Message         goods, social crafting,
                          Carrier, Spore Trader   breeding materials.
  -----------------------------------------------------------------------

### 7.1 Job assignment

-   A mushroom can have one primary job at a time in the MVP.
-   The player assigns a mushroom to a job and, where relevant, a target
    area, workstation, or habitat.
-   Job effectiveness is determined by relevant stats, affinity, work
    traits, temperament, habitat suitability, and nearby synergies.
-   Show a clear estimated output or qualitative efficiency before
    confirming an assignment.
-   Allow reassignment without losing the mushroom or its progress;
    avoid harsh cooldowns in the initial version.

### 7.2 Job synergies

Some jobs should become more effective when complementary mushrooms work
nearby. Example: a Waterer plus a Pollinator improves a flower patch; a
Decomposer plus a Spore Cultivator accelerates a fungal bed; a
Woodworker plus a Stoneworker can contribute to a bridge project.
Synergies should be discoverable and explained once found.

### 7.3 Visible work

Use small looping animations and state changes: watering can or
droplets, carrying a berry, digging at a root, scattering spores,
hammering a structure, or glowing beside a landmark. The simulation can
be simplified visually, but the player should be able to tell what each
mushroom is doing.

## 8. Breeding and Genetics

### 8.1 Breeding flow

1.  Select two eligible parent mushrooms.
2.  Review a preview of likely inherited categories, without revealing
    the exact offspring.
3.  Start a breeding cycle that creates a visible spore cluster or
    mushroom egg/bulb.
4.  Allow incubation to progress in real time, including offline time.
5.  Reveal the offspring with a short, delightful hatch/reveal
    animation.
6.  Add the offspring to the collection with a unique identity and
    recorded lineage.

### 8.2 Inheritance rules

-   Offspring inherit a mixture of visual genes from both parents;
    inheritance should be weighted but not fully predictable.
-   Affinities and work traits can be inherited, recombined, or
    occasionally skipped.
-   Rare mutations can introduce a gene not visibly present in either
    parent. Keep mutation odds low enough that discoveries feel special.
-   Rarity should influence the chance of unusual combinations, not
    guarantee a powerful offspring.
-   Allow common mushrooms to produce valuable specialist offspring
    through thoughtful pairing.
-   Record both parents and generation number so players can follow
    lineages.

### 8.3 Breeding goals

Support long-term goals such as completing cap-shape and color
collections, discovering all markings, breeding a mushroom with a
particular affinity/trait combination, producing a rare mutation, and
developing a lineage with high performance in a chosen job.

### 8.4 Preventing breeding frustration

-   Never consume or permanently remove parent mushrooms.
-   Provide clear breeding eligibility and timer information.
-   Avoid a single best pairing; preserve multiple viable breeding
    paths.
-   Give players useful outcomes even when offspring are not rare (new
    appearance combinations, lineage progress, or breeding materials).

## 9. Friend Sharing and Social Play

### 9.1 MVP: portable mushroom exchange

Because GitHub Pages is static hosting, the first release should not
promise real-time multiplayer. Implement a portable exchange flow:

1.  Player chooses a mushroom and selects Share.
2.  Game exports a compact, versioned mushroom record as a JSON file or
    encoded share code.
3.  Player sends the file/code to a friend using any external messaging
    method.
4.  Friend imports it into their own forest.
5.  Imported mushroom is added as a breeding guest or genetic donor; the
    original owner keeps their mushroom.
6.  The receiving player can breed with the guest and optionally export
    an offspring or breeding result back.

### 9.2 Import validation and safety

-   Validate schema version, gene values, trait IDs, string lengths, and
    payload size.
-   Do not execute imported content or trust imported resource
    quantities.
-   Imported mushrooms must not grant currency, materials, unlocks, or
    arbitrary progression.
-   Assign a new local instance ID while preserving source lineage
    metadata.
-   Prevent duplicate imports where practical using a stable share ID or
    hash.

### 9.3 Future online features

A later backend could add player profiles, friend lists, asynchronous
breeding requests, a public mushroom market, cloud saves, and
server-validated trades. Keep the MVP data model modular so these can be
added without rewriting the breeding system.

## 10. Resources, Economy, and Progression

### 10.1 Resource categories

  -----------------------------------------------------------------------
  Category                Examples                Uses
  ----------------------- ----------------------- -----------------------
  Natural                 Twigs, bark, stones,    Basic crafting,
                          leaves, berries, nuts,  planting, building,
                          seeds                   food.

  Fungal                  Spores, caps, compost,  Breeding, fungal
                          mycelium threads        cultivation, soil
                                                  upgrades.

  Magical                 Glow dust, moonlight,   Enchantment, rare
                          spirit dew, crystal     habitats, advanced
                          fragments               structures.

  Crafted                 Planks, woven fiber,    Buildings,
                          polished stone, charms  workstations,
                                                  decorations, upgrades.
  -----------------------------------------------------------------------

### 10.2 Progression

-   Start with a small clearing, a few common mushrooms, a basic garden,
    and a limited set of jobs.
-   Unlock new jobs and workstations through simple milestones,
    discoveries, and crafted structures.
-   Expand the forest in sections, each with new terrain, habitat
    conditions, plants, and possible mushroom genetics.
-   Use specialist mushrooms to improve production and unlock rare
    ecological interactions.
-   Introduce long-term collection milestones and cosmetic goals so
    progression is not only about producing more resources.

### 10.3 Offline progress

When the game loads, calculate elapsed time since the last save and
resolve eligible work cycles. Use a configurable offline cap for
balancing (initial suggestion: 8 hours, adjustable). Display a return
summary showing resources produced, plants tended, projects advanced,
and discoveries. Store deterministic timestamps and avoid granting the
same cycle twice.

## 11. User Interface and Screens

  -----------------------------------------------------------------------
  Screen                              Key contents
  ----------------------------------- -----------------------------------
  Forest                              Main playable scene; terrain,
                                      plants, structures, visible
                                      mushrooms, resource summary,
                                      navigation.

  Mushroom Detail                     Sprite, name, rarity, generation,
                                      parents, genetics, stats,
                                      temperament, current job, rename
                                      and assign controls.

  Collection / Field Guide            Discovered mushrooms, silhouettes
                                      for unknown entries, gene/trait
                                      indexes, lineage filters, rarity
                                      and affinity filters.

  Breeding                            Parent selection, inheritance
                                      hints, breeding timer, spore
                                      cluster/egg, reveal sequence,
                                      offspring record.

  Jobs                                Available job types, eligible
                                      mushrooms, work requirements,
                                      output estimates, active
                                      assignments.

  Inventory                           Resources, seeds, spores, crafted
                                      items, geodes or discoveries,
                                      sorting and filtering.

  Build / Decorate                    Place, move, rotate if supported,
                                      and remove objects; show costs and
                                      habitat influence.

  Sharing                             Export mushroom, import file/code,
                                      preview imported mushroom,
                                      validation errors, breeding guest
                                      list.

  Settings                            Sound, animation, accessibility,
                                      save export/import, reset with
                                      confirmation, version information.
  -----------------------------------------------------------------------

Mobile-first interaction: large touch targets, readable text, clear
modal close controls, no essential controls hidden behind hover, and
layouts that respect device safe areas. The forest should remain usable
on a narrow phone screen.

## 12. Art Direction and Asset System

-   Use the supplied mushroom sprite sheet as a visual reference for
    color variety, cap silhouettes, markings, stems, shadows, and pixel
    density.
-   Build mushrooms from modular layers where feasible: cap base, cap
    highlight, spots/markings, underside, stem, feet/base shadow,
    glow/effects.
-   Use consistent pixel scale and nearest-neighbor rendering; avoid
    blurry scaling.
-   Create original sprite combinations from data-driven genes so
    offspring can visibly inherit their parents' traits.
-   Make rarity readable through unusual palettes, markings, glow,
    particles, or silhouettes, not only a colored rarity label.
-   Include idle, walking, working, carrying, resting, and
    special-action animation states where practical.
-   Keep the forest warm, cozy, slightly mysterious, and uncluttered.
    The mushrooms should be cute and characterful, not overly humanoid.

## 13. MVP Scope

### Must have

-   A playable, responsive forest scene with a small editable grid or
    placement system.
-   At least 3 habitat/terrain types and a small set of plants, fungi,
    and decorative objects.
-   At least 12 mushroom visual combinations using modular or
    data-driven genes.
-   Persistent mushroom identities, names, basic stats, affinities, and
    temperaments.
-   At least 4 functional jobs: Gardener, Forager, Mycologist, and
    Woodworker (or equivalent).
-   A working breeding cycle with inheritance, lineage, and a
    low-probability mutation.
-   A collection/Field Guide screen.
-   Offline production and a return summary.
-   Save/load, schema versioning, and manual save export/import.
-   Mushroom export/import sharing that works without a server.

### Should have

-   Visible mushroom walking and job animations.
-   Basic job synergies.
-   A few buildable structures and workstation requirements.
-   Day/night visual variation.
-   A small number of rare habitat discoveries and special mushroom
    variants.

### Not in MVP

-   Combat, battles, expeditions, or sending mushrooms away from the
    forest.
-   Real-time multiplayer, accounts, cloud saves, or live friend visits.
-   Payments, premium currency, ads, or monetization.
-   Large procedural worlds or complex pathfinding.
-   Dozens of jobs before the core loop is proven.

## 14. Suggested Build Phases

  -----------------------------------------------------------------------
  Phase                   Deliverable             Acceptance criteria
  ----------------------- ----------------------- -----------------------
  0\. Foundation          Project setup,          Runs locally and on
                          responsive layout, save GitHub Pages; save/load
                          model, data             survives refresh; no
                          definitions.            hard-coded absolute
                                                  paths.

  1\. Forest prototype    Place terrain/objects;  Player can create a
                          display mushrooms;      small habitat and see
                          basic movement and      mushrooms in the world.
                          interactions.           

  2\. Work loop           Implement 4 jobs,       Each job produces a
                          resource inventory, job distinct useful output;
                          assignment, production  assignment and output
                          timers.                 persist.

  3\. Breeding            Parent selection,       Offspring differ
                          incubation,             visibly and
                          inheritance, mutation,  genetically; parent
                          lineage.                mushrooms remain
                                                  unchanged.

  4\. Collection and      Field Guide, detail     Player can understand
  polish                  pages, animations,      and track discoveries;
                          offline return summary. offline production is
                                                  consistent.

  5\. Social exchange     Export/import mushroom  Two separate browser
                          records and breeding    saves can exchange
                          guests.                 mushrooms using a file
                                                  or code; imports are
                                                  validated.

  6\. Expansion           More jobs, habitats,    New content can be
                          structures, synergies,  added through data
                          rare variants.          files without rewriting
                                                  core systems.
  -----------------------------------------------------------------------

## 15. Data Model Guidance

Use stable IDs and data-driven definitions. Keep content separate from
UI and simulation logic. Suggested conceptual entities:

  -----------------------------------------------------------------------
  Entity                              Important fields
  ----------------------------------- -----------------------------------
  MushroomInstance                    id, name, createdAt, generation,
                                      parentIds/sourceLineage, genes,
                                      affinity, traits, temperament,
                                      stats, jobId, targetId,
                                      restedState.

  MushroomGenes                       capShape, primaryColor,
                                      secondaryColor, markings,
                                      stemShape, stemColor, glowLevel,
                                      patternSeed.

  JobDefinition                       id, name, family, requiredStats,
                                      affinityBonuses, baseDuration,
                                      baseOutput, eligibleTargets,
                                      animationState.

  PlantDefinition                     id, name, habitatRequirements,
                                      growthDuration, outputs, rarity,
                                      visualAssetId.

  WorldObject                         id, definitionId, tileX, tileY,
                                      rotation, state, growthProgress,
                                      storedOutput.

  ResourceStack                       resourceId, quantity.

  BreedingRecord                      id, parentAId, parentBId,
                                      startedAt, completesAt,
                                      offspringId, outcomeSeed.

  PlayerSave                          schemaVersion, playerId/localId,
                                      createdAt, lastSeenAt, world,
                                      mushrooms, inventory, discoveries,
                                      settings.
  -----------------------------------------------------------------------

Use seeded randomness for breeding outcomes so a breeding cycle resolves
consistently if the page is refreshed. Never rely on a UI animation to
determine the actual result.

## 16. Quality and Acceptance Principles

-   The game must be playable on a phone in portrait orientation and
    usable with touch.
-   Refreshing or closing the browser must not erase a valid save.
-   No mushroom can be permanently lost through ordinary work or
    breeding.
-   Breeding must create persistent offspring with recorded parents.
-   Work must have a meaningful, visible or clearly reported outcome.
-   Different jobs and genetic specialties must have distinct uses.
-   Imported mushrooms cannot inject resources, unlocks, scripts, or
    invalid data.
-   The app must deploy correctly under a GitHub Pages project subpath;
    avoid assuming the site is hosted at the domain root.
-   Provide clear empty states, error messages, confirmations for
    destructive actions, and a way to export a backup.

## 17. Instructions to the Development Agent (Claude)

Build this as an iterative extension of the existing repository if one
is provided. Before changing code, inspect the repository, identify its
framework, current architecture, assets, and existing save system. Do
not discard or rewrite working systems without explaining why and
obtaining approval.

1.  Start by reporting the existing project structure and a short
    implementation plan.
2.  Implement the MVP in small, testable phases. Keep the app runnable
    after each phase.
3.  Preserve existing functionality, assets, and player saves. Add
    migrations when changing save data.
4.  Use modular, data-driven definitions for mushrooms, genes, jobs,
    plants, resources, and structures.
5.  Keep game simulation logic separate from rendering and UI.
6.  Make GitHub Pages deployment work from a repository subpath, not
    only localhost.
7.  Do not add backend-dependent features to the MVP. Clearly label any
    feature that cannot be delivered securely with static hosting.
8.  Add developer/test controls for quickly granting resources,
    unlocking content, advancing timers, and generating test mushrooms;
    keep them hidden behind a development flag.
9.  After each phase, summarize files changed, features implemented,
    known limitations, and manual test steps.
10. Do not claim a feature is complete unless it is implemented and
    tested.

## 18. Open Design Decisions

These are intentionally left editable. Choose sensible defaults for the
first prototype and keep the underlying systems configurable.

  -----------------------------------------------------------------------
  Decision                Initial recommendation  Final choice / notes
  ----------------------- ----------------------- -----------------------
  Game title              Working title: Mushroom 
                          Forest                  

  World layout            Small grid-based        
                          clearing with free      
                          decoration layer if     
                          feasible                

  Mushroom population     Start with 6--10        
                          visible mushrooms;      
                          support more through    
                          background simulation   

  Breeding duration       Short initial timer     
                          (e.g. 1--5 minutes for  
                          testing; rebalance      
                          later)                  

  Offline cap             8 hours initially;      
                          configurable            

  Stat scale              0--100                  

  Rarity tiers            Common, Uncommon, Rare, 
                          Epic, Legendary; tune   
                          probabilities later     

  Social exchange         JSON file plus compact  
                          share code if payload   
                          size permits            

  Visual scale            Choose a consistent     
                          pixel grid based on     
                          target phone viewport   

  Game tone               Cozy, whimsical,        
                          slightly mysterious     
  -----------------------------------------------------------------------

## 19. First Playable Milestone

The first playable milestone should prove the central promise with the
smallest possible slice:

-   A small forest clearing with a few placeable habitat objects.
-   Two starter mushrooms with distinct appearances and job strengths.
-   A Gardener job that visibly tends a plant and produces a resource.
-   A Forager job that visibly gathers a different resource.
-   A breeding station that combines the two starter mushrooms and
    produces a visibly mixed offspring.
-   A collection screen showing the parents, offspring, and lineage.
-   A working local save that survives refresh.

If this small slice is enjoyable, expand the job roster, habitats,
social sharing, and genetic depth. If it is not enjoyable, improve the
feel of breeding and visible forest life before adding more content.
