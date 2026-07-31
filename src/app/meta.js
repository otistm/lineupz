/* Meta progression — pitcher unlocks across runs. Browser only (localStorage). */
import {
  UNLOCK_ORDER, START_UNLOCKED, LADDER_DEFS, PITCHERS, buildLadder,
} from '../data/catalog.js';

const META_KEY = 'lineup.meta';

export function defaultMeta() {
  return { unlocked: UNLOCK_ORDER.slice(0, START_UNLOCKED) };
}

function normalizeUnlocked(ids) {
  const set = new Set(ids.filter((id) => UNLOCK_ORDER.includes(id)));
  // Contiguous prefix through farthest unlocked arm (plus always keep starters).
  let farthest = START_UNLOCKED - 1;
  for (let i = 0; i < UNLOCK_ORDER.length; i++) {
    if (set.has(UNLOCK_ORDER[i])) farthest = Math.max(farthest, i);
  }
  return UNLOCK_ORDER.slice(0, farthest + 1);
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    const unlocked = Array.isArray(parsed?.unlocked) ? parsed.unlocked : [];
    return { unlocked: normalizeUnlocked(unlocked) };
  } catch (_) {
    return defaultMeta();
  }
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ unlocked: meta.unlocked }));
  } catch (_) { /* private mode */ }
}

/** Next pitcher id in unlock order after `pitcherId`, or null at the end. */
export function nextPitcherAfter(pitcherId) {
  const idx = UNLOCK_ORDER.indexOf(pitcherId);
  if (idx < 0 || idx >= UNLOCK_ORDER.length - 1) return null;
  return UNLOCK_ORDER[idx + 1];
}

/** Beat a pitcher for the first time → unlock the next arm in UNLOCK_ORDER. */
export function unlockAfterBeat(pitcherId) {
  const meta = loadMeta();
  const idx = UNLOCK_ORDER.indexOf(pitcherId);
  if (idx < 0) return { meta, newlyUnlocked: null, nextId: null };
  const next = UNLOCK_ORDER[idx + 1] || null;
  const need = UNLOCK_ORDER.slice(0, idx + 1);
  if (next) need.push(next);
  const before = new Set(meta.unlocked);
  meta.unlocked = normalizeUnlocked([...meta.unlocked, ...need]);
  saveMeta(meta);
  const newlyUnlocked = next && !before.has(next) && meta.unlocked.includes(next) ? next : null;
  return { meta, newlyUnlocked, nextId: next };
}

export function ladderForRun(meta = loadMeta()) {
  return buildLadder(meta.unlocked);
}

export function nextUnlockTease(meta = loadMeta()) {
  const n = meta.unlocked.length;
  if (n >= UNLOCK_ORDER.length) return null;
  const id = UNLOCK_ORDER[n];
  const def = LADDER_DEFS[id];
  const pit = PITCHERS.find((p) => p.id === id);
  return { id, name: def?.name || id, pitcher: pit?.n || id };
}

export function resetMeta() {
  const meta = defaultMeta();
  saveMeta(meta);
  return meta;
}
