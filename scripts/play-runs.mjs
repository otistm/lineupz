/**
 * Strategic bot: play N full runs through draft → sponsors → dugout → night.
 * Uses every system (buy, upgrade, reroll, sell, sponsor pick, gear equip, sequence).
 * Reports win rate, failure modes, and assertion failures (implementation bugs).
 */
import { simNight, boardSetup, computeLinks } from '../src/engine/sim.js';
import {
  generateDraft, generateSponsors, sellPrice, buyCost, isUpgrade, hitterById,
} from '../src/engine/shop.js';
import { HITTERS, GEAR, PITCHERS, LADDER, ECONOMY } from '../src/data/catalog.js';

const N_RUNS = Number(process.argv[2]) || 50;

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const H = (id) => HITTERS.find((h) => h.id === id);
const G = (id) => GEAR.find((g) => g.id === id);
const P = (id) => PITCHERS.find((p) => p.id === id);

function assert(cond, msg, bugs) {
  if (!cond) bugs.push(msg);
}

function archWeight(arch, pit) {
  if (pit.efficient) {
    if (arch === 'GRINDER') return 0.35;
    if (arch === 'SPARK' || arch === 'SLUGGER') return 1.35;
    return 1.1;
  }
  if (pit.freshEdge) {
    if (arch === 'GRINDER') return 1.4;
    if (arch === 'SPARK') return 1.15;
    return 1;
  }
  if (pit.recover) {
    if (arch === 'SPARK' || arch === 'RALLY') return 1.3;
    return 1;
  }
  if (pit.stubborn) {
    if (arch === 'SLUGGER') return 1.25;
    if (arch === 'SPARK') return 1.15;
    return 1.05;
  }
  return 1;
}

function cardScore(card, pit, owned, cost) {
  const power = card.HIT + card.POW * 0.95 + (card.set === 'WORLD_SERIES' ? 2 : card.set === 'ALL_STAR' ? 1 : 0);
  const value = power / Math.max(1, cost);
  const up = isUpgrade(card, owned) ? 1.35 : 1;
  return value * archWeight(card.arch, pit) * up;
}

function gearScore(g, pit) {
  let s = 0;
  const m = g.mods || {};
  if (pit.efficient) {
    s += (m.HIT || 0) * 3 + (m.POW || 0) * 2.5 + (m.OUT || 0) * 0.1;
  } else if (pit.freshEdge) {
    s += (m.OUT || 0) * 3.5 + (m.HIT || 0) * 1.5 + (m.POW || 0) * 1.2;
  } else {
    s += (m.HIT || 0) * 2 + (m.POW || 0) * 2.2 + (m.OUT || 0) * 1.8;
  }
  return s / Math.max(1, g.cost);
}

function sponsorPreference(pit) {
  if (pit.efficient) return ['batco', 'cage', 'pinetar'];
  if (pit.freshEdge) return ['pinetar', 'batco', 'cage'];
  if (pit.recover) return ['batco', 'cage', 'pinetar'];
  return ['cage', 'batco', 'pinetar'];
}

function targetSeats(rung, gold) {
  const base = [4, 6, 7, 8, 9][Math.min(rung, 4)];
  if (gold < 4) return Math.max(1, base - 2);
  return base;
}

function fresh(rng) {
  return {
    lineup: Array(9).fill(null),
    gearMap: {},
    loose: [],
    owned: [],
    draft: [],
    sponsors: [],
    chosenSponsor: null,
    gold: ECONOMY.startGold,
    lives: ECONOMY.startLives,
    rung: 0,
    rng,
  };
}

function upgradeInPlace(S, oldId, newCard) {
  if (S.gearMap[oldId]) {
    const kept = [];
    let used = 0;
    for (const g of S.gearMap[oldId]) {
      if (used + g.w <= newCard.cap) { kept.push(g); used += g.w; }
      else S.loose.push(g);
    }
    if (kept.length) S.gearMap[newCard.id] = kept;
    delete S.gearMap[oldId];
  }
  const slot = S.lineup.findIndex((x) => x && x.id === oldId);
  if (slot >= 0) S.lineup[slot] = newCard;
  S.owned = S.owned.filter((id) => id !== oldId);
  if (!S.owned.includes(newCard.id)) S.owned.push(newCard.id);
}

function buyDraftOffer(S, offer, bugs) {
  const card = H(offer.id);
  assert(card, `draft offer missing card ${offer.id}`, bugs);
  if (!card || offer.sold) return false;
  const cost = buyCost(card, S.owned);
  assert(Number.isFinite(cost), `buyCost not finite for ${offer.id}`, bugs);
  assert(cost === offer.cost || isUpgrade(card, S.owned) || cost === card.cost,
    `stale draft cost ${offer.id}: offer=${offer.cost} live=${cost}`, bugs);
  if (!Number.isFinite(cost) || S.gold < cost) return false;
  if (isUpgrade(card, S.owned)) {
    const have = [...S.owned].map(H).find((h) => h && h.lineage === card.lineage);
    assert(have, `upgrade without owned lineage ${card.lineage}`, bugs);
    upgradeInPlace(S, have.id, card);
  } else {
    if (S.owned.includes(card.id)) return false;
    if (S.owned.map(H).some((h) => h && h.lineage === card.lineage)) {
      bugs.push(`bought dupe lineage ${card.lineage} as ${card.id}`);
      return false;
    }
    S.owned.push(card.id);
  }
  S.gold -= cost;
  offer.sold = true;
  return true;
}

function doDraft(S, pit, bugs) {
  S.draft = generateDraft(S.rung, S.owned, S.rng);
  assert(S.draft.length > 0 && S.draft.length <= ECONOMY.draftSlots,
    `draft slots ${S.draft.length}`, bugs);
  assert(S.draft.every((o) => o.kind === 'batter'), 'draft mixed non-batters', bugs);

  const want = targetSeats(S.rung, S.gold);
  let safety = 0;
  while (safety++ < 8) {
    const scored = S.draft
      .map((o, i) => {
        if (o.sold) return null;
        const card = H(o.id);
        const cost = buyCost(card, S.owned);
        if (!Number.isFinite(cost) || S.gold < cost) return null;
        return { i, o, card, cost, score: cardScore(card, pit, S.owned, cost) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const needSeats = S.owned.length < want;
    const reserve = needSeats ? 0 : Math.min(4, Math.floor(S.gold * 0.25));
    let bought = false;
    for (const pick of scored) {
      if (S.gold - pick.cost < reserve && S.owned.length >= Math.min(want, 3)) continue;
      // Prefer upgrades and filling roster; skip weak late buys
      if (!pick.o.upgrade && S.owned.length >= want && pick.score < 1.6) continue;
      if (buyDraftOffer(S, pick.o, bugs)) { bought = true; break; }
    }
    if (bought) continue;

    // Reroll if thin roster and can afford
    if (S.owned.length < Math.min(3, want) && S.gold >= ECONOMY.rerollCost + 2) {
      S.gold -= ECONOMY.rerollCost;
      S.draft = generateDraft(S.rung, S.owned, S.rng);
      continue;
    }
    break;
  }

  // Sell a weak card only if we can afford something better next (rare)
  if (S.owned.length > want + 1 && S.gold < 3) {
    const weak = S.owned.map(H).filter(Boolean).sort((a, b) => (a.HIT + a.POW) - (b.HIT + b.POW))[0];
    if (weak && weak.set === 'ROOKIE') {
      S.owned = S.owned.filter((id) => id !== weak.id);
      S.lineup = S.lineup.map((p) => (p && p.id === weak.id ? null : p));
      if (S.gearMap[weak.id]) {
        for (const g of S.gearMap[weak.id]) S.loose.push(g);
        delete S.gearMap[weak.id];
      }
      S.gold += sellPrice(weak);
    }
  }
}

function doSponsors(S, pit, bugs) {
  S.sponsors = generateSponsors(S.rng);
  assert(S.sponsors.length === 3, 'sponsor count', bugs);
  assert(new Set(S.sponsors.map((s) => s.id)).size === 3, 'duplicate sponsors', bugs);

  const pref = sponsorPreference(pit);
  S.chosenSponsor = pref.find((id) => S.sponsors.some((s) => s.id === id)) || S.sponsors[0].id;
  const shop = S.sponsors.find((s) => s.id === S.chosenSponsor);
  assert(shop, 'chosen sponsor missing', bugs);

  const ranked = shop.offers
    .map((o, i) => {
      if (o.sold) return null;
      const g = G(o.id);
      if (!g || S.gold < o.cost) return null;
      return { o, g, score: gearScore(g, pit) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // Keep a little gold for the next draft if roster still thin
  const reserve = S.owned.length < 5 ? 3 : 1;
  for (const pick of ranked) {
    if (S.gold - pick.o.cost < reserve) continue;
    if (pick.score < 0.35) continue;
    S.gold -= pick.o.cost;
    S.loose.push(pick.g);
    pick.o.sold = true;
  }
}

function sequenceOwned(ownedIds, pit) {
  const bats = ownedIds.map(H).filter(Boolean);
  // Role buckets for link-friendly order
  const sparks = bats.filter((b) => b.arch === 'SPARK').sort((a, b) => b.HIT - a.HIT);
  const grinders = bats.filter((b) => b.arch === 'GRINDER').sort((a, b) => b.HIT - a.HIT);
  const rallies = bats.filter((b) => b.arch === 'RALLY').sort((a, b) => b.POW - a.POW);
  const sluggers = bats.filter((b) => b.arch === 'SLUGGER').sort((a, b) => b.POW - a.POW);

  const order = [];
  // Pattern: G → S → Slug / Rally alternating, fill with leftovers
  while (order.length < bats.length) {
    if (pit.freshEdge && grinders.length) order.push(grinders.shift());
    else if (sparks.length && (sluggers.length || rallies.length)) {
      order.push(sparks.shift());
      if (sluggers.length) order.push(sluggers.shift());
      else if (rallies.length) order.push(rallies.shift());
    } else if (grinders.length) order.push(grinders.shift());
    else if (sparks.length) order.push(sparks.shift());
    else if (rallies.length) order.push(rallies.shift());
    else if (sluggers.length) order.push(sluggers.shift());
    else break;
  }
  // Place into 9 slots: pack from top, leave empty at end (skips don't create outs)
  const lineup = Array(9).fill(null);
  order.slice(0, 9).forEach((b, i) => { lineup[i] = b; });
  return lineup;
}

function equipGear(S) {
  // Pull equipped back to loose for re-equip, then greedily assign
  for (const pid of Object.keys(S.gearMap)) {
    for (const g of S.gearMap[pid] || []) S.loose.push(g);
  }
  S.gearMap = {};
  const loose = [...S.loose].sort((a, b) => {
    const sa = (a.mods.HIT || 0) + (a.mods.POW || 0) * 1.1 + (a.mods.OUT || 0);
    const sb = (b.mods.HIT || 0) + (b.mods.POW || 0) * 1.1 + (b.mods.OUT || 0);
    return sb - sa;
  });
  S.loose = [];
  const seated = S.lineup.filter(Boolean);
  // Prefer heart/sluggers for POW gear, top for HIT, bottom for OUT
  for (const g of loose) {
    let best = null, bestScore = -1;
    for (let slot = 0; slot < 9; slot++) {
      const p = S.lineup[slot];
      if (!p) continue;
      const eq = S.gearMap[p.id] || [];
      const used = eq.reduce((a, x) => a + x.w, 0);
      if (used + g.w > p.cap) continue;
      let score = 1;
      if (g.mods.POW) score += (p.arch === 'SLUGGER' || p.arch === 'RALLY' ? 3 : 1) + (slot >= 3 && slot <= 5 ? 2 : 0);
      if (g.mods.HIT) score += (p.arch === 'SPARK' ? 3 : 1) + (slot < 3 ? 2 : 0);
      if (g.mods.OUT) score += (p.arch === 'GRINDER' ? 3 : 1) + (slot >= 6 ? 2 : 0);
      score += (p.HIT + p.POW) * 0.05;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      S.gearMap[best.id] = [...(S.gearMap[best.id] || []), g];
    } else {
      S.loose.push(g);
    }
  }
  return seated.length;
}

function doDugout(S, pit, bugs) {
  S.lineup = sequenceOwned(S.owned, pit);
  const n = equipGear(S);
  assert(n >= ECONOMY.minSeated || S.owned.length === 0, 'could not seat owned bats', bugs);
  const { links } = boardSetup(S.lineup, S.gearMap);
  return links.length;
}

function playRun(seed) {
  const bugs = [];
  const rng = mulberry32(seed);
  const S = fresh(rng);
  const nights = [];
  let champion = false;
  let dead = false;
  let attempts = 0;

  while (!champion && !dead && attempts < 40) {
    attempts++;
    const rung = LADDER[S.rung];
    const pit = P(rung.pitcher);
    assert(pit, `missing pitcher ${rung.pitcher}`, bugs);

    const goldBefore = S.gold;
    doDraft(S, pit, bugs);
    doSponsors(S, pit, bugs);
    const links = doDugout(S, pit, bugs);

    if (S.owned.length < 1) {
      bugs.push(`empty roster at rung ${S.rung} with gold ${S.gold}`);
      dead = true;
      break;
    }

    // Sanity: one card per lineage
    const lins = S.owned.map(H).map((h) => h.lineage);
    assert(new Set(lins).size === lins.length, `lineage dupe owned=${S.owned}`, bugs);

    // Gear map keys must be owned
    for (const pid of Object.keys(S.gearMap)) {
      assert(S.owned.includes(pid), `gearMap orphan ${pid}`, bugs);
    }

    const night = simNight(S.lineup, S.gearMap, pit, S.rng);
    const won = night.runs >= rung.target;
    nights.push({
      rung: S.rung, target: rung.target, runs: night.runs, won,
      seated: S.lineup.filter(Boolean).length, links, goldSpent: goldBefore - S.gold + (won ? 0 : 0),
      gold: S.gold, finalState: night.finalState, lives: S.lives,
    });

    if (won && S.rung === LADDER.length - 1) {
      S.gold += ECONOMY.winGold(S.rung);
      champion = true;
      break;
    }
    if (won) {
      S.gold += ECONOMY.winGold(S.rung);
      S.rung++;
      continue;
    }
    S.lives -= 1;
    S.gold += ECONOMY.lossGold;
    if (S.lives <= 0) { dead = true; break; }
  }

  return { seed, champion, dead, rung: S.rung, lives: S.lives, gold: S.gold, nights, bugs, owned: S.owned };
}

const results = [];
const allBugs = [];
let champs = 0;
const dieAt = [0, 0, 0, 0, 0];
const rungClears = [0, 0, 0, 0, 0];
let totalNights = 0;
let upgradeEvents = 0;

for (let i = 0; i < N_RUNS; i++) {
  const r = playRun(1000 + i * 17);
  results.push(r);
  if (r.champion) champs++;
  else if (r.dead) dieAt[r.rung]++;
  for (const n of r.nights) {
    totalNights++;
    if (n.won) rungClears[n.rung]++;
  }
  // Count upgrades present in final roster
  upgradeEvents += r.owned.filter((id) => {
    const h = H(id);
    return h && h.set !== 'ROOKIE';
  }).length;
  for (const b of r.bugs) allBugs.push(`run${i}: ${b}`);
}

const uniqueBugs = [...new Set(allBugs)];
console.log(`=== ${N_RUNS} strategic runs ===`);
console.log(`champions: ${champs}/${N_RUNS} (${((champs / N_RUNS) * 100).toFixed(1)}%)`);
console.log('died at rung:', dieAt.map((n, i) => `${i}:${n}`).join('  '));
console.log('nights cleared by rung:', rungClears.map((n, i) => `${i}:${n}`).join('  '));
console.log(`avg nights/run: ${(totalNights / N_RUNS).toFixed(2)}`);
console.log(`non-rookie cards on final rosters (proxy upgrades/growth): ${upgradeEvents}`);

// Sample a few failures
const fails = results.filter((r) => !r.champion).slice(0, 5);
console.log('\n=== sample failed runs ===');
for (const f of fails) {
  const last = f.nights[f.nights.length - 1];
  console.log(`  seed ${f.seed}: died rung ${f.rung} lives0 gold${f.gold} last ${last?.runs}/${last?.target} seated${last?.seated} links${last?.links} state=${last?.finalState}`);
  console.log(`    path: ${f.nights.map((n) => `${n.won ? 'W' : 'L'}${n.rung}(${n.runs}/${n.target}|${n.seated}b)`).join(' → ')}`);
}

const wins = results.filter((r) => r.champion).slice(0, 3);
console.log('\n=== sample champions ===');
for (const w of wins) {
  console.log(`  seed ${w.seed}: gold${w.gold} owned=${w.owned.length} path=${w.nights.map((n) => `${n.runs}/${n.target}`).join(',')}`);
}

console.log(`\n=== implementation assertions ===`);
console.log(uniqueBugs.length ? `${uniqueBugs.length} unique bug(s):\n${uniqueBugs.map((b) => `  - ${b}`).join('\n')}` : 'none');

// Spot-check upgrade path
{
  const owned = ['jeter96-rc'];
  const cost = buyCost(H('jeter00-ws'), owned);
  const S = { owned: [...owned], lineup: [H('jeter96-rc'), null, null, null, null, null, null, null, null], gearMap: { 'jeter96-rc': [G('ash')] }, loose: [], gold: 20 };
  upgradeInPlace(S, 'jeter96-rc', H('jeter00-ws'));
  assert(S.owned.includes('jeter00-ws') && !S.owned.includes('jeter96-rc'), 'upgrade owned', uniqueBugs);
  assert(S.lineup[0]?.id === 'jeter00-ws', 'upgrade seat', uniqueBugs);
  assert(S.gearMap['jeter00-ws']?.[0]?.id === 'ash' && !S.gearMap['jeter96-rc'], 'upgrade gear remap', uniqueBugs);
  assert(cost < H('jeter00-ws').cost, 'upgrade discount', uniqueBugs);
  console.log(`upgrade spot-check: cost ${cost}, seat ${S.lineup[0].id}, gear ok`);
}

if (uniqueBugs.length) process.exitCode = 1;
