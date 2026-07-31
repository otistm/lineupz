/* Encounter effect resolver. Pure — mutates a plain run-state bag the app owns. */
import { CHARMS, ECONOMY, GEAR, SPONSORS } from '../data/catalog.js';
import {
  generateDraft,
  hitterById,
  sellPrice,
  isUpgrade,
  ownedByLineage,
} from './shop.js';

function pickRandom(arr, rng) {
  if (!arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function charmById(id) {
  return CHARMS.find((c) => c.id === id) || null;
}

/** Charms not already held. */
export function availableCharms(ownedCharmIds) {
  const have = new Set(ownedCharmIds);
  return CHARMS.filter((c) => !have.has(c.id));
}

/**
 * Apply a choice effect.
 * state: { gold, owned, loose, charms, gearMap, lineup, rung }
 * Returns { state, log, followup } where followup may be
 *   { type: 'draftOne', offers } | { type: 'removeCard' } | null
 */
export function applyEventEffect(state, effect, rng = Math.random) {
  const next = {
    gold: state.gold,
    owned: [...state.owned],
    loose: [...(state.loose || [])],
    charms: [...(state.charms || [])],
    gearMap: { ...state.gearMap },
    lineup: state.lineup,
    rung: state.rung,
  };
  const log = [];
  let followup = null;
  let done = true;
  const type = effect?.type;

  if (type === 'gainGold') {
    const n = effect.n || 0;
    next.gold += n;
    log.push(`+${n}g`);
  } else if (type === 'loseGold') {
    const n = Math.min(next.gold, effect.n || 0);
    next.gold -= n;
    log.push(`−${n}g`);
  } else if (type === 'riskGold') {
    const n = effect.n || 0;
    if (rng() < 0.5) {
      next.gold += n * 2;
      log.push(`Won the bet · +${n * 2}g`);
    } else {
      const lost = Math.min(next.gold, n);
      next.gold -= lost;
      log.push(`Lost the bet · −${lost}g`);
    }
  } else if (type === 'draftOne') {
    const offers = generateDraft(next.rung, next.owned, rng).slice(0, ECONOMY.eventDraftSlots);
    // Free picks — cost 0 in the followup UI.
    followup = {
      type: 'draftOne',
      offers: offers.map((o) => ({ ...o, cost: 0, free: true })),
    };
    log.push('Pick a free bat');
  } else if (type === 'gearOne') {
    const tags = pickRandom(SPONSORS, rng)?.tags || ['hit'];
    const pool = GEAR.filter((g) => (g.tags || []).some((t) => tags.includes(t)));
    const g = pickRandom(pool.length ? pool : GEAR, rng);
    if (g) {
      next.loose.push({ ...g });
      log.push(`Gained ${g.n}`);
    }
  } else if (type === 'gainCharm') {
    const pool = availableCharms(next.charms.map((c) => c.id));
    const c = effect.id ? charmById(effect.id) : pickRandom(pool, rng);
    if (c && !next.charms.some((x) => x.id === c.id)) {
      next.charms.push({ ...c });
      log.push(`Gained charm · ${c.n}`);
    } else {
      next.gold += 3;
      log.push('No new charm — +3g instead');
    }
  } else if (type === 'payForCharm') {
    const cost = effect.n || 0;
    if (next.gold < cost) {
      log.push('Not enough gold');
      done = false;
    } else {
      next.gold -= cost;
      const pool = availableCharms(next.charms.map((c) => c.id));
      const c = pickRandom(pool, rng);
      if (c) {
        next.charms.push({ ...c });
        log.push(`Paid ${cost}g · gained ${c.n}`);
      } else {
        next.gold += cost;
        log.push('No charms left — gold refunded');
        done = false;
      }
    }
  } else if (type === 'removeCard') {
    if (!next.owned.length) {
      next.gold += 2;
      log.push('Empty roster — +2g');
    } else {
      followup = { type: 'removeCard' };
      log.push('Choose a card to sell at full sticker');
    }
  } else {
    log.push('Nothing happens');
  }

  return { state: next, log, followup, done };
}

/** Grant a free batter (or upgrade) from an event followup. */
export function claimFreeBatter(state, cardId) {
  const card = hitterById(cardId);
  if (!card) return { state, ok: false };
  const next = {
    ...state,
    owned: [...state.owned],
    gearMap: { ...state.gearMap },
    lineup: state.lineup ? [...state.lineup] : state.lineup,
  };
  const have = ownedByLineage(next.owned).get(card.lineage);
  if (have) {
    if (!isUpgrade(card, next.owned)) return { state, ok: false };
    const idx = next.owned.indexOf(have.id);
    if (idx >= 0) next.owned[idx] = card.id;
    // Remap gear + lineup seat
    if (next.gearMap[have.id]) {
      next.gearMap[card.id] = next.gearMap[have.id];
      delete next.gearMap[have.id];
    }
    if (next.lineup) {
      next.lineup = next.lineup.map((p) => (p && p.id === have.id ? card : p));
    }
  } else {
    next.owned.push(card.id);
  }
  return { state: next, ok: true, card };
}

/** Full-sticker remove (event buyback). */
export function removeOwnedCard(state, cardId) {
  const card = hitterById(cardId);
  if (!card || !state.owned.includes(cardId)) return { state, ok: false };
  const next = {
    gold: state.gold + card.cost,
    owned: state.owned.filter((id) => id !== cardId),
    loose: [...(state.loose || [])],
    charms: [...(state.charms || [])],
    gearMap: { ...state.gearMap },
    lineup: state.lineup ? state.lineup.map((p) => (p && p.id === cardId ? null : p)) : state.lineup,
    rung: state.rung,
  };
  // Unequip gear to loose
  for (const g of next.gearMap[cardId] || []) next.loose.push(g);
  delete next.gearMap[cardId];
  return { state: next, ok: true, gold: card.cost, card };
}

export { sellPrice, charmById };
