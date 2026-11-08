// Deterministic hashing and seeded PRNG (GDD 9.6, 20).

/** 32-bit string/number hash (cyrb53 folded to an unsigned 32-bit int). */
export function hash(...parts) {
  const str = parts.map((p) => String(p)).join('|');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Hex string hash, useful for IDs. */
export function hashHex(...parts) {
  return hash(...parts).toString(16).padStart(8, '0') + hash('x', ...parts).toString(16).padStart(8, '0');
}

/** mulberry32 PRNG wrapped with helpers. */
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    chance: (p) => next() < p,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (items, weightFn) => {
      const total = items.reduce((s, it) => s + weightFn(it), 0);
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (const it of items) {
        r -= weightFn(it);
        if (r < 0) return it;
      }
      return items[items.length - 1];
    },
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
  return rng;
}

/** Independent sub-stream so adding a step never shifts other steps. */
export function subRng(seed, name) {
  return makeRng(hash(seed, name));
}

/** Non-deterministic seed for new saves (crypto when available). */
export function freshSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    return a[0].toString(16) + a[1].toString(16);
  }
  return Math.floor(Math.random() * 2 ** 32).toString(16) + Date.now().toString(16);
}
