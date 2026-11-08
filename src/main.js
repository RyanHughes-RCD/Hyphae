// Entry point. Uses only relative paths so it works under a GitHub Pages project subpath.
import { App } from './ui/app.js';
import { setSpriteOverrides } from './render/sprites.js';
import { registerCustomDecorations } from './content/world.js';

const root = document.getElementById('app');

/** Sprites edited in the Sprite Workshop (optional: the game draws its own art without them). */
async function loadSprites() {
  try {
    const res = await fetch('assets/sprites.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const json = await res.json();
    const sprites = json && typeof json.sprites === 'object' ? json.sprites : {};
    setSpriteOverrides(sprites);
    registerCustomDecorations(sprites);
  } catch (err) {
    console.warn('Sprite overrides not loaded:', err.message);
  }
}

loadSprites().then(() => {
  try {
    const app = new App(root);
    app.start();
    window.__mushroomForest = app; // handy for debugging in the console
  } catch (err) {
    console.error(err);
    root.textContent = 'Sorry — Mushroom Forest failed to start: ' + err.message;
  }
});
