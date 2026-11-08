# Mushroom Forest

A cozy pixel-art browser game about breeding mushroom creatures, giving them
meaningful work, and growing a magical forest. Single-player, runs entirely in
the browser, hosted as a static site (GitHub Pages). No backend, no build step,
no dependencies.

The full design is in [`docs/GAME_DESIGN_DOCUMENT.md`](docs/GAME_DESIGN_DOCUMENT.md).

## Play locally

Any static file server works (ES modules need `http://`, not `file://`):

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

**Controls:** drag to look around the forest, pinch to zoom (mouse wheel or
trackpad pinch on desktop), and tap a mushroom or
structure for details. When the forest is ready to grow, tap **Expand** and
choose north, east, south or west — new ground is wild, so clear it (Build →
Clear), bridge the river, and move things where you want them. Breed by
dragging two mushrooms into the pen. Add `?dev` to the URL to show developer
tools (grant resources, unlock everything, skip time, force rolls, generate
test mushrooms, override day phase/weather).

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` runs the tests and deploys on
every push to `main`. One-time setup: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. All paths are relative, so the game
works under a project subpath such as `https://<user>.github.io/<repo>/`.

## Tests and balance simulation

```bash
npm test                         # 31 tests: the 16 required (GDD 22.1) + additional
node tools/simulate.js 20 60     # 20-round balance simulation, 60 runs per strategy
node tools/simulate.js 20 60 --set traits.newAdvancedTraitChance=0.3
```

## Architecture

```
index.html, styles.css      app shell (mobile-first)
src/config.js               ALL balance numbers (centralized, versioned)
src/content/                data-only definitions: attributes, perks, mutations,
                            jobs, structures, stages/areas, resources
src/core/                   pure simulation — no DOM, explicit `now`, seeded RNG
  stats.js                  attribute + RGB colour stats, caps, rarity, affinity
  genetics.js               starters, wild visitors, 12-step breeding resolver
  game.js                   state, jobs, offline progress, building, economy, unlocks
  time.js                   real-local-time day phases, seeded weather
  share.js                  share codes + import validation
  save.js                   localStorage save, backup, schema validation/migration
src/render/                 procedural pixel-art sprites and the forest canvas
src/ui/                     app controller and screens
tests/                      node:test suites
tools/simulate.js           headless balance simulator (reuses the real resolver)
```

Key guarantees (see GDD Section 20): breeding outcomes are resolved and sealed
when incubation starts; stats are always recalculated from genetics (never
trusted from saves or imports); every cap is enforced in simulation code;
offline progress is clamped to 8 hours and a backward clock grants nothing.

## Art and font credits

- **Pixeloid** font by GGBotNet (<https://ggbot.net/fonts/>), licensed under the
  SIL Open Font License 1.1 — see `assets/fonts/OFL-LICENSE.txt`.
- Grass backdrop (`assets/art/grass.webp`) and shrubbery border
  (`assets/art/hedge-strip*.webp`) supplied by the project owner; trimmed and
  rotated copies of the originals.
- Canopy shadow overlay (`assets/art/canopy-shadow.webp`) supplied by the project
  owner; its alpha mask stored as greyscale at half size.
- Mushrooms, structures and terrain features are drawn procedurally in code.
