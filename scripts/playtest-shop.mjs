/**
 * Headless smoke of the draft → sponsors → dugout → night loop.
 * Mirrors app state transitions without DOM.
 */
import { simNight } from '../src/engine/sim.js';
import { generateDraft, generateSponsors, sellPrice, canPlay, buyCost } from '../src/engine/shop.js';
import { HITTERS, GEAR, PITCHERS, LADDER, ECONOMY } from '../src/data/catalog.js';

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const H = (id) => HITTERS.find((h) => h.id === id);

function byId(id) {
  return HITTERS.find((h) => h.id === id) || GEAR.find((g) => g.id === id);
}

function fresh() {
  const rng = mulberry32(2026);
  return {
    lineup: Array(9).fill(null),
    gearMap: {},
    loose: [],
    owned: [],
    draft: generateDraft(0, [], rng),
    sponsors: [],
    chosenSponsor: null,
    gold: ECONOMY.startGold,
    lives: ECONOMY.startLives,
    rung: 0,
    phase: 'draft',
    rng,
  };
}

function buyCheapestBatters(S, n) {
  const bought = [];
  while (bought.length < n) {
    const idx = S.draft.findIndex((o) => {
      if (o.sold || o.kind !== 'batter') return false;
      const card = byId(o.id);
      const cost = buyCost(card, S.owned);
      return Number.isFinite(cost) && S.gold >= cost;
    });
    if (idx < 0) break;
    const o = S.draft[idx];
    const card = byId(o.id);
    const cost = buyCost(card, S.owned);
    S.gold -= cost;
    S.owned.push(o.id);
    o.sold = true;
    bought.push(o.id);
  }
  return bought;
}

function seatFirst(S, count) {
  const ids = S.owned.slice(0, count);
  for (let i = 0; i < 9; i++) S.lineup[i] = i < ids.length ? byId(ids[i]) : null;
}

const S = fresh();
console.log('start', { gold: S.gold, lives: S.lives, owned: S.owned, draft: S.draft.map((o) => `${o.id}@${o.cost}`) });
if (!canPlay(S.lineup)) console.log('play gated: need', ECONOMY.minSeated, '(empty start OK)');

const bought = buyCheapestBatters(S, 3);
S.phase = 'sponsors';
S.sponsors = generateSponsors(S.rng);
S.chosenSponsor = S.sponsors[0].id;
const gear = S.sponsors[0].offers[0];
if (gear && S.gold >= gear.cost) {
  S.gold -= gear.cost;
  S.loose.push(byId(gear.id));
  gear.sold = true;
}
S.phase = 'dugout';
seatFirst(S, Math.max(1, bought.length));
console.log('after draft+sponsor', {
  gold: S.gold, bought, gear: S.loose.map((g) => g.id),
  seated: S.lineup.filter(Boolean).map((p) => p.id), canPlay: canPlay(S.lineup),
});
if (!canPlay(S.lineup)) {
  console.error('FAIL: could not seat from draft');
  process.exit(1);
}

const pit = PITCHERS.find((p) => p.id === LADDER[0].pitcher);
const night = simNight(S.lineup, S.gearMap, pit, S.rng);
const won = night.runs >= LADDER[0].target;
console.log('night1', { runs: night.runs, target: LADDER[0].target, won, finalState: night.finalState });

if (won) {
  const pay = ECONOMY.winGold(0);
  S.gold += pay;
  S.rung = 1;
  S.phase = 'draft';
  S.draft = generateDraft(S.rung, S.owned, S.rng);
  console.log('advance draft', { gold: S.gold, pay, rung: S.rung, draft: S.draft.map((o) => `${o.id}@${o.cost}`) });
} else {
  S.lives -= 1;
  S.gold += ECONOMY.lossGold;
  S.phase = 'draft';
  S.draft = generateDraft(S.rung, S.owned, S.rng);
  console.log('retry draft', { gold: S.gold, lives: S.lives, rung: S.rung, draftLen: S.draft.length });
}

const sell = sellPrice(H('ozzie87'));
console.log('sell ozzie', sell, 'expected', Math.max(1, Math.floor(3 * ECONOMY.sellRate)));

console.log('PASS  draft→sponsors→dugout→night meta loop');
