// Entry point. Uses only relative paths so it works under a GitHub Pages project subpath.
import { App } from './ui/app.js';

const root = document.getElementById('app');
try {
  const app = new App(root);
  app.start();
  window.__mushroomForest = app; // handy for debugging in the console
} catch (err) {
  console.error(err);
  root.textContent = 'Sorry — Mushroom Forest failed to start: ' + err.message;
}
