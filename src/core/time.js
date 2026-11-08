// Real-local-time day phases and seeded weather (GDD 5.5).
import { getConfig } from '../config.js';
import { makeRng, hash } from './rng.js';

/** Local wall-clock parts for a timestamp, given a timezone offset in minutes
 *  (same sign convention as Date#getTimezoneOffset: UTC - local). */
export function localParts(ts, tzOffsetMin) {
  const d = new Date(ts - tzOffsetMin * 60000);
  return {
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
    dateKey: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
  };
}

export function currentTzOffset() {
  return new Date().getTimezoneOffset();
}

export function phaseAtHour(hour, cfg = getConfig()) {
  const p = cfg.world.dayPhaseHours;
  if (hour >= p.night || hour < p.dawn) return 'night';
  if (hour < p.day) return 'dawn';
  if (hour < p.dusk) return 'day';
  return 'dusk';
}

export function phaseAt(ts, tzOffsetMin) {
  return phaseAtHour(localParts(ts, tzOffsetMin).hour);
}

const weatherCache = new Map();

/** Weather for a local calendar date: { kind, rain: [[startHour, endHour], ...] } */
export function weatherForDate(worldSeed, dateKey, cfg = getConfig()) {
  const key = worldSeed + '|' + dateKey + '|' + cfg.configVersion;
  if (weatherCache.has(key)) return weatherCache.get(key);
  const rng = makeRng(hash(worldSeed, 'weather', dateKey));
  const w = cfg.world.weatherWeights;
  const kind = rng.weighted(Object.keys(w), (k) => w[k]);
  const rain = [];
  if (kind === 'rain') {
    const rw = cfg.world.rainWindows;
    const n = rng.int(rw.min, rw.max);
    for (let i = 0; i < n; i++) {
      const start = rng.int(0, 21);
      rain.push([start, Math.min(24, start + rng.int(rw.minHours, rw.maxHours))]);
    }
  }
  const out = { kind, rain };
  if (weatherCache.size > 200) weatherCache.clear();
  weatherCache.set(key, out);
  return out;
}

/** Conditions at a moment: { phase, raining, weather } */
export function conditionsAt(ts, worldSeed, tzOffsetMin, override = null) {
  const { hour, dateKey } = localParts(ts, tzOffsetMin);
  const weather = weatherForDate(worldSeed, dateKey);
  let raining = weather.rain.some(([s, e]) => hour >= s && hour < e);
  let phase = phaseAtHour(hour);
  if (override?.phase) phase = override.phase;
  if (override?.weather) raining = override.weather === 'rain';
  return { phase, raining, weather: raining ? 'rain' : weather.kind === 'rain' ? 'cloudy' : weather.kind, hour };
}
