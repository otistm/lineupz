/* Pure shop helpers — Node + browser. No DOM. */
import {
  HITTERS, GEAR, ECONOMY, SETS, SET_WEIGHTS, SPONSORS,
} from '../data/catalog.js';

export function sellPrice(item) {
  return Math.max(1, Math.floor(item.cost * ECONOMY.sellRate));
}

export const setRank = (set) => (SETS[set] ? SETS[set].rank : 0);

export function hitterById(id) {
  return HITTERS.find((h) => h.id === id) || null;
}

/** Map lineage → owned card id for the current roster. */
export function ownedByLineage(ownedIds) {
  const map = new Map();
  for (const id of ownedIds) {
    const h = hitterById(id);
    if (h) map.set(h.lineage, h);
  }
  return map;
}

/** True if `card` is a higher set of a lineage already owned. */
export function isUpgrade(card, ownedIds) {
  const have = ownedByLineage(ownedIds).get(card.lineage);
  if (!have) return false;
  return setRank(card.set) > setRank(have.set);
}

/** Same lineage already owned at equal or higher set — not buyable as a new seat. */
export function isDowngradeOrDupe(card, ownedIds) {
  const have = ownedByLineage(ownedIds).get(card.lineage);
  if (!have) return false;
  return setRank(card.set) <= setRank(have.set);
}

/** Gold to buy: full cost, or discounted upgrade. */
export function buyCost(card, ownedIds) {
  const have = ownedByLineage(ownedIds).get(card.lineage);
  if (!have) return card.cost;
  if (setRank(card.set) <= setRank(have.set)) return Infinity;
  return Math.max(1, Math.ceil(card.cost - have.cost * ECONOMY.upgradeDiscount));
}

function pickSet(weights, rng) {
  const keys = Object.keys(weights);
  const total = keys.reduce((a, k) => a + (weights[k] || 0), 0);
  if (total <= 0) return 'BASE';
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k] || 0;
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Prefer upgrade offers for owned lineages (~35% of slots when available),
 * else a fresh card of the rolled set that isn't a downgrade/dupe.
 */
export function generateDraft(rung, ownedIds, rng = Math.random) {
  const weights = SET_WEIGHTS[Math.min(rung, SET_WEIGHTS.length - 1)];
  const owned = [...ownedIds];
  const taken = new Set(ownedIds);
  const byLin = ownedByLineage(owned);
  const offers = [];
  const slots = ECONOMY.draftSlots;

  let upgradePool = HITTERS.filter((h) => isUpgrade(h, owned) && !taken.has(h.id));
  // One card per lineage per row: two sets of the same career are both valid
  // upgrades, so ownership alone won't keep them apart.
  const usedLins = new Set();
  const free = (h) => !taken.has(h.id) && !usedLins.has(h.lineage);

  for (let i = 0; i < slots; i++) {
    let pick = null;
    // Soft bias toward upgrades
    upgradePool = upgradePool.filter(free);
    if (upgradePool.length && rng() < 0.35) {
      const idx = Math.floor(rng() * upgradePool.length);
      pick = upgradePool.splice(idx, 1)[0];
    }
    if (!pick) {
      const set = pickSet(weights, rng);
      const ok = (h) => free(h) && !isDowngradeOrDupe(h, owned);
      const pool = HITTERS.filter((h) => h.set === set && ok(h));
      const fallback = HITTERS.filter(ok);
      const src = pool.length ? pool : fallback;
      if (!src.length) continue;
      pick = src[Math.floor(rng() * src.length)];
    }
    taken.add(pick.id);
    usedLins.add(pick.lineage);
    owned.push(pick.id);
    byLin.set(pick.lineage, pick);
    const cost = buyCost(pick, ownedIds);
    const upgrade = isUpgrade(pick, ownedIds);
    offers.push({
      kind: 'batter',
      uid: offerUid(pick.id),
      id: pick.id,
      cost,
      upgrade,
      fromId: upgrade ? ownedByLineage(ownedIds).get(pick.lineage)?.id : null,
    });
  }
  // Late-run edge case: every lineage already owned at peak — still return what we could fill.
  return shuffle(offers, rng);
}

/** Stable per-offer handle so the UI can track a card across re-renders (shelves allow duplicates). */
let offerSeq = 0;
function offerUid(id) {
  return `${id}#${++offerSeq}`;
}

function gearForTags(tags) {
  return GEAR.filter((g) => (g.tags || []).some((t) => tags.includes(t)));
}

function pickFrom(pool, rng, counts) {
  const scored = pool.map((g) => {
    const n = counts.get(g.id) || 0;
    return { g, w: Math.max(0.25, 3 - n) };
  });
  const total = scored.reduce((a, x) => a + x.w, 0);
  let r = rng() * total;
  for (const s of scored) {
    r -= s.w;
    if (r < 0) return s.g;
  }
  return scored[scored.length - 1]?.g || null;
}

/** Three sponsors each visit, each with a short gear list from their tags. */
export function generateSponsors(rng = Math.random) {
  const order = shuffle([...SPONSORS], rng);
  return order.map((sp) => {
    const pool = gearForTags(sp.tags);
    const counts = new Map();
    const offers = [];
    for (let i = 0; i < ECONOMY.sponsorOfferSlots; i++) {
      const g = pickFrom(pool.length ? pool : GEAR, rng, counts);
      if (!g) break;
      counts.set(g.id, (counts.get(g.id) || 0) + 1);
      offers.push({ kind: 'gear', uid: offerUid(g.id), id: g.id, cost: g.cost, sold: false });
    }
    return { id: sp.id, n: sp.n, blurb: sp.blurb, tags: sp.tags, offers };
  });
}

/** @deprecated mixed shop — use generateDraft / generateSponsors */
export function generateShop(rung, ownedIds, looseGear, rng = Math.random) {
  return generateDraft(rung, ownedIds, rng);
}

export function seatedCount(lineup) {
  return lineup.filter(Boolean).length;
}

export function canPlay(lineup) {
  return seatedCount(lineup) >= ECONOMY.minSeated;
}
