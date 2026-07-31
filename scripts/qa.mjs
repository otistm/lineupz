/**
 * QA gates for exact (deterministic) resolution + draft/sponsor meta.
 * 1. Correctness — nothing rolls; every outcome is the numbers
 * 2. Draft / sponsors / lineage upgrades
 * 3. Design — seats, sequence and gear are the levers
 */
import {
  simNight,
  boardSetup,
  battingOrder,
  computeLinks,
  beatsWall,
  stuffAgainst,
  modifiersFor,
  zoneOf,
  lookAt,
  resolvePA,
  advanceRunners,
  stateOf,
  DOUBLE_AT,
  HOMER_AT,
} from '../src/engine/sim.js';
import {
  generateDraft,
  generateSponsors,
  sellPrice,
  canPlay,
  seatedCount,
  buyCost,
  isUpgrade,
  ownedByLineage,
} from '../src/engine/shop.js';
import {
  HITTERS, GEAR, CHARMS, PITCHERS, TEAMS, LADDER, ECONOMY, SETS, SPONSORS,
  EVENTS, UNLOCK_ORDER, START_UNLOCKED, buildLadder, LADDER_DEFS,
} from '../src/data/catalog.js';
import {
  generateRunMap, appendAct, assertActReachable, startActNav, advanceNav, retryBossNav, goldForNode,
} from '../src/engine/map.js';
import { applyEventEffect, claimFreeBatter } from '../src/engine/events.js';
import { ARCH_INFO } from '../src/engine/sim.js';

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

let failed = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
}

const rng0 = () => 0; // the engine never rolls — any rng is ignored
const night = (lineup, gearMap, pid) => simNight(lineup, gearMap, P(pid), rng0);

/* ---------- the one rule: beat his wall — exact, no rolls ---------- */
{
  check('a bat is on iff HIT beats the wall', beatsWall(8, 7) && !beatsWall(7, 7) && !beatsWall(6, 7));
  const bat = { HIT: 6, POW: 5, OUT: 0, arch: 'RALLY' };
  const over = resolvePA(bat, 5, { runners: 0, state: 'FRESH' }, rng0);
  const even = resolvePA(bat, 6, { runners: 0, state: 'FRESH' }, rng0);
  check('HIT over the wall is on; matching it is out', over.reached && !even.reached,
    `HIT 6 vs wall 5 on, vs wall 6 out`);
  const again = resolvePA(bat, 5, { runners: 0, state: 'FRESH' }, rng0);
  check('identical inputs, identical outcome', JSON.stringify(over) === JSON.stringify(again));
}

/* ---------- fatigue and familiarity, both in STUFF ---------- */
{
  const k = P('koufax65');
  const fresh = stuffAgainst(k, 'FRESH', 0), gassed = stuffAgainst(k, 'GASSED', 0);
  check('his STUFF falls as the tank empties', gassed <= fresh - 4, `fresh ${fresh} → gassed ${gassed}`);
  check("Koufax's Fresh edge is on his card", fresh === k.stuff + k.freshEdge);
  check("Moyer paces himself between innings", P('longman').recover === 3);
  check('a second look hands him +1 STUFF', stuffAgainst(k, 'GASSED', 1) - gassed === lookAt(1).stuff);
  const p = P('pedro00');
  check('Pedro fades slower than Koufax',
    stuffAgainst(p, 'GASSED', 0) - p.stuff > stuffAgainst(k, 'GASSED', 0) - k.stuff);
}

/* ---------- damage: STAM DMG is exactly the number on the card ---------- */
{
  const pa = (pow) => resolvePA({ HIT: 20, POW: pow, OUT: 0, arch: 'GRINDER' }, 0, { runners: 0, state: 'FRESH' }, rng0);
  check('STAM DMG is the damage, exactly', pa(2).damage === 2 && pa(7).damage === 7 && pa(12).damage === 12);
  check('distance is read off the same number',
    pa(DOUBLE_AT - 1).type === '1B' && pa(DOUBLE_AT).type === '2B' && pa(HOMER_AT).type === 'HR',
    `1B under ${DOUBLE_AT}, 2B at ${DOUBLE_AT}, HR at ${HOMER_AT}`);

  const gr = { HIT: 0, POW: 3, OUT: 2, arch: 'GRINDER' };
  const out = resolvePA(gr, 20, { runners: 0, state: 'FRESH' }, rng0);
  check("a grinder's out still costs him", !out.reached && out.damage === 2);
  const vsMaddux = resolvePA(gr, 20, { runners: 0, state: 'FRESH', noOutDamage: true }, rng0);
  check('Maddux pays nothing for outs', vsMaddux.damage === 0);
}

/* ---------- abilities — exact, never a roll ---------- */
{
  const rally = { HIT: 5, POW: 4, OUT: 0, arch: 'RALLY' };
  const empty = modifiersFor(rally, 'FRESH', { runners: 0 });
  const loaded = modifiersFor(rally, 'FRESH', { runners: 3 });
  check('rally man scales with runners on', empty.length === 0 && loaded[0].HIT === 3 && loaded[0].POW === 3);
  const slug = { HIT: 5, POW: 7, OUT: 0, arch: 'SLUGGER' };
  check('slugger only gets +3 STAM DMG once pitcher is Gassed',
    modifiersFor(slug, 'FRESH', { runners: 0 }).length === 0 &&
    modifiersFor(slug, 'GASSED', { runners: 0 })[0].POW === 3);

  const spark = { HIT: 9, POW: 2, OUT: 0, arch: 'SPARK' };
  const fresh = resolvePA(spark, 4, { runners: 0, state: 'FRESH' }, rng0);
  const tired = resolvePA(spark, 4, { runners: 0, state: 'LABORING' }, rng0);
  check('spark stretches every single once the arm tires', fresh.type === '1B' && tired.type === '2B' && tired.stretch);
  const legs = advanceRunners([{ arch: 'SPARK' }, null, null], { bases: 1, type: '1B', reached: true }, { arch: 'RALLY' }, rng0);
  check('spark always takes the extra base on a single', legs.bases[2]?.arch === 'SPARK' && legs.bases[0]?.arch === 'RALLY');

  const a = advanceRunners([{ arch: 'SPARK' }, null, { arch: 'RALLY' }], { bases: 4, type: 'HR', reached: true }, { arch: 'SLUGGER' }, rng0);
  check('home run scores everyone + batter', a.runs === 3 && a.bases.every((x) => x === null));

  const closer = { HIT: 4, POW: 5, OUT: 0, arch: 'CLOSER' };
  check('closer only fires with 2 outs',
    modifiersFor(closer, 'FRESH', { outs: 1 }).length === 0 &&
    modifiersFor(closer, 'FRESH', { outs: 2 })[0].HIT === 2 &&
    modifiersFor(closer, 'FRESH', { outs: 2 })[0].POW === 2);
  const patient = { HIT: 5, POW: 2, OUT: 1, arch: 'PATIENT' };
  check('patient first-look HIT bonus',
    modifiersFor(patient, 'FRESH', { seen: 0 })[0].HIT === 2 &&
    modifiersFor(patient, 'FRESH', { seen: 1 }).length === 0);
  const pOut = resolvePA(patient, 20, { runners: 0, state: 'FRESH', seen: 1 }, rng0);
  check('patient outs wear 1 (from OUT on bat)', !pOut.reached && pOut.damage === 1);
}

/* ---------- lineup position ---------- */
{
  const lineup = Array(9).fill(H('bench72'));
  const { eff } = boardSetup(lineup, {});
  check('top of the order adds HIT', eff[0].HIT === H('bench72').HIT + 1);
  check('the heart adds STAM DMG', eff[4].POW === H('bench72').POW + 2);
  check('the bottom adds out STAM DMG', eff[7].OUT === 1 && zoneOf(8).key === 'BOTTOM');
}

/* ---------- seats and gaps ---------- */
{
  const five = [H('ozzie87'), null, H('pudge99'), null, H('bench72'), null, H('griffey97'), null, H('arod96')];
  const nine = ['ozzie87', 'pudge99', 'bench72', 'griffey97', 'arod96', 'schmidt80', 'gwynn94', 'gehrig27', 'rickey85'].map(H);
  check('batting order skips empty seats', battingOrder(five).join(',') === '0,2,4,6,8');
  check('links follow the batting order across gaps', computeLinks(five).length > 0, `${computeLinks(five).length} links`);

  // Looks are the tax on a short order: he learns the lone bat and closes the wall.
  const solo = [H('ichiro04'), null, null, null, null, null, null, null, null];
  const soloN = night(solo, {}, 'longman');
  const nineN = night(nine, {}, 'longman');
  check('he learns a short order — looks close the wall', soloN.runs <= 2 && nineN.runs > soloN.runs,
    `solo ${soloN.runs} runs vs nine ${nineN.runs}`);
}
check('state thresholds ordered', stateOf(100, 100) === 'FRESH' && stateOf(50, 100) === 'LABORING' && stateOf(20, 100) === 'GASSED' && stateOf(5, 100) === 'BROKEN');
{
  const lineup = ['gwynn94', 'ruth27', 'morgan76', 'ichiro04', 'bench72', 'griffey97', 'williams41', 'ozzie87', 'gehrig27'].map(H);
  const { eff, links } = boardSetup(lineup, {});
  check('spark→slugger lights Table set', links.some((l) => l.type === 'TABLESET'), `${links.length} links`);
  check('a link covers the weakness of the bat it feeds', eff[1].HIT >= H('ruth27').HIT + 3,
    `Ruth HIT ${H('ruth27').HIT} → ${eff[1].HIT}`);

  const newLinks = [H('ruth27'), H('ortiz04'), H('morgan76'), H('boggs87'), H('gwynn94'), null, null, null, null];
  const nl = computeLinks(newLinks);
  check('slugger→closer lights Cleanup', nl.some((l) => l.type === 'CLEANUP'));
  check('closer→grinder lights Shutdown', nl.some((l) => l.type === 'SHUTDOWN'));
  check('patient→spark lights Walk-off', nl.some((l) => l.type === 'WALKOFF'));
  check('ARCH_INFO covers every hitter arch', HITTERS.every((h) => ARCH_INFO[h.arch]));
}

/* ---------- draft / sponsors / career cards ---------- */
{
  check('every hitter has lineage, set, cost, HIT/POW',
    HITTERS.every((h) => h.HIT > 0 && h.POW > 0 && h.cost > 0 && h.lineage && SETS[h.set]));
  check('gear only speaks in HIT, POW and OUT',
    GEAR.every((g) => g.cost > 0 && Object.keys(g.mods).every((k) => ['HIT', 'POW', 'OUT'].includes(k))));
  check('every pitcher has a gimmick note and a tank', PITCHERS.every((p) => p.pool > 0 && p.note && p.tip));
  check('every pitcher has a known team', PITCHERS.every((p) => p.team && TEAMS[p.team]));
  check('three sponsors', SPONSORS.length === 3);
  check('empty start + thin open', ECONOMY.startGold >= 10 && ECONOMY.startLives === 4 && ECONOMY.minSeated === 1);
  check('draft slots', ECONOMY.draftSlots === 6);

  const draft = generateDraft(0, [], mulberry32(7));
  check('draft offers batters only', draft.length === 6 && draft.every((o) => o.kind === 'batter'));
  check('draft excludes owned', !generateDraft(0, ['ozzie87'], mulberry32(8)).some((o) => o.id === 'ozzie87'));

  // Two sets of one career are both upgrades, so a row must still show only one of them.
  let lineDupe = null;
  for (let s = 0; s < 400 && !lineDupe; s++) {
    for (const roster of [[], ['pudge91-rc'], ['pudge91-rc', 'jeter96-rc', 'ozzie82-rc']]) {
      const row = generateDraft(s % 5, roster, mulberry32(900 + s));
      const lins = row.map((o) => H(o.id).lineage);
      const ids = row.map((o) => o.id);
      if (new Set(lins).size !== lins.length) lineDupe = `lineage twice: ${lins.join(',')}`;
      else if (new Set(ids).size !== ids.length) lineDupe = `card twice: ${ids.join(',')}`;
      if (lineDupe) break;
    }
  }
  check('draft never offers one lineage twice', !lineDupe, lineDupe || 'clean over 400 seeds');

  const owned = ['jeter96-rc'];
  const ws = H('jeter00-ws');
  check('WS Jeter is an upgrade over Rookie', isUpgrade(ws, owned));
  const cost = buyCost(ws, owned);
  check('upgrade costs less than full sticker', cost < ws.cost && cost === Math.ceil(ws.cost - H('jeter96-rc').cost * ECONOMY.upgradeDiscount),
    `cost ${cost}`);
  check('ownedByLineage maps jeter', ownedByLineage(owned).get('jeter')?.id === 'jeter96-rc');

  const sponsors = generateSponsors(mulberry32(11));
  check('sponsor visit rolls three shops', sponsors.length === 3);
  check('each sponsor has gear offers', sponsors.every((s) => s.offers.length === ECONOMY.sponsorOfferSlots
    && s.offers.every((o) => o.kind === 'gear')));

  check('sell price ~60%', sellPrice(H('ozzie87')) === Math.max(1, Math.floor(3 * 0.6)));
  const empty = Array(9).fill(null);
  const one = [H('ozzie87'), null, null, null, null, null, null, null, null];
  check('canPlay allows 1+ seated', !canPlay(empty) && canPlay(one) && seatedCount(one) === 1);

  // Soft-lock guards (mirrors app rules): never advance an empty roster; upgrades remap gear.
  check('draft can start empty but offers are buyable',
    generateDraft(0, [], mulberry32(3)).some((o) => H(o.id).cost <= ECONOMY.startGold));
}

/* ---------- progression difficulty — exact nights, no bands ---------- */
const SCRAPPY = [H('ozzie87'), H('pudge99'), H('bench72'), H('griffey97'), H('schmidt80'), H('arod96'), null, null, null];
const FUNDED = ['gwynn94', 'ruth27', 'ichiro04', 'williams41', 'gehrig27', 'mays65', 'morgan76', 'trout12', 'ozzie87'].map(H);
const FUNDED_GEAR = {
  williams41: [G('donut'), G('tar')],
  morgan76: [G('guard')],
  ruth27: [G('maple')],
  gwynn94: [G('cleats')],
  ichiro04: [G('ash'), G('helmet')],
};

{
  const open = night(SCRAPPY, {}, 'longman');
  check('scrappy board clears Opening Night', open.runs >= LADDER[0].target, `${open.runs} of ${LADDER[0].target}`);

  // Maddux blanks a board with no wear and no wall-beaters — the wall holds, he stays Fresh.
  const blank = night(SCRAPPY, {}, 'maddux95');
  check('no height, no wear — the Surgeon blanks you', blank.runs === 0 && blank.finalState === 'FRESH',
    `${blank.runs} runs, he finished ${blank.finalState}`);

  const funded = night(FUNDED, FUNDED_GEAR, 'pedro00');
  const weak = night(SCRAPPY, {}, 'pedro00');
  check('funded wear board breaks Pedro and cashes in', funded.broke && funded.runs >= LADDER[4].target,
    `${funded.runs} of ${LADDER[4].target}, he finished ${funded.finalState}`);
  check('underfunded board is blanked by Pedro', weak.runs < LADDER[4].target, `${weak.runs} runs`);
}
{
  /* same three bats, only the order changes — the WORN link lands on Ruth (flips him
     over the fresh wall) or is wasted on Schmidt (who stays under it either way). */
  const SEQ_GOOD = [H('morgan76'), H('ruth27'), H('schmidt80'), null, null, null, null, null, null];
  const SEQ_BAD = [H('morgan76'), H('schmidt80'), H('ruth27'), null, null, null, null, null, null];
  const g = night(SEQ_GOOD, {}, 'koufax65');
  const b = night(SEQ_BAD, {}, 'koufax65');
  check('sequence is the lever — same bats, different night', g.runs > b.runs && g.broke && !b.broke,
    `good order ${g.runs} runs (${g.finalState}) vs bad order ${b.runs} (${b.finalState})`);
}

/* ---------- map / events / charms / unlocks ---------- */
{
  check('unlock order starts with opener + surgeon',
    UNLOCK_ORDER[0] === 'longman' && UNLOCK_ORDER[1] === 'maddux95' && START_UNLOCKED === 2);
  check('buildLadder respects unlock list', buildLadder(['longman', 'maddux95']).length === 2);
  check('full LADDER has every unlock arm', LADDER.length === UNLOCK_ORDER.length
    && LADDER.every((r, i) => r.pitcher === UNLOCK_ORDER[i]));
  check('every unlock has a ladder def', UNLOCK_ORDER.every((id) => LADDER_DEFS[id]));
  check('new pitchers have gimmicks',
    P('unit95')?.intimidate === 3 && P('ryan73')?.pool >= 70 && P('mo99')?.halfOuts === true);

  const map = generateRunMap(3, 42);
  check('map has one act per ladder rung', map.acts.length === 3);
  check('every act is fully reachable', map.acts.every(assertActReachable));
  const act0 = map.acts[0];
  check('act ends in a boss', act0.layers.at(-1)[0].kind === 'boss');
  check('hex island has multiple stops', (act0.all?.length || 0) >= 6);
  check('act has a draft somewhere before the boss',
    act0.layers.slice(0, -1).flat().some((n) => n.kind === 'draft'));
  let nav = startActNav(act0);
  check('act opens with sandlot (leg 0) choices', nav.available.length === act0.layers[0].length);
  const first = nav.available[0];
  nav = advanceNav(act0, nav, first);
  check('completing a hex opens touching hexes ahead', nav.available.length >= 1 && nav.visited.includes(first) && nav.here === first);
  const retry = retryBossNav(act0);
  const bossApproaches = act0.all.filter((n) => n.edges.includes(act0.bossId)).map((n) => n.id);
  check('loss reopens hexes touching the boss',
    retry.available.length === bossApproaches.length
    && bossApproaches.every((id) => retry.available.includes(id)));
  check('node gold scales with rung', goldForNode(0) === 4 && goldForNode(2) === 6);
  const grown = generateRunMap(2, 99);
  appendAct(grown, 2);
  check('appendAct extends a run map', grown.acts.length === 3 && assertActReachable(grown.acts[2]));

  check('charms catalog is non-empty', CHARMS.length >= 6);
  const tape = CHARMS.find((c) => c.id === 'tape');
  const { eff: charmEff } = boardSetup([H('ozzie87'), null, null, null, null, null, null, null, null], {}, [tape]);
  check('Tape Job charm adds HIT', charmEff[0].HIT === H('ozzie87').HIT + 1 + 1); // zone TOP +1, tape +1
  const scout = CHARMS.find((c) => c.id === 'scout');
  const wall0 = stuffAgainst(P('longman'), 'FRESH', 0, [scout]);
  const wall1 = stuffAgainst(P('longman'), 'FRESH', 0, []);
  check('Scouting Report lowers first-look pitch', wall0 === wall1 - 1);

  const half = resolvePA({ HIT: 0, POW: 0, OUT: 4, arch: 'GRINDER' }, 20,
    { runners: 0, state: 'FRESH', outDamageScale: 0.5 }, rng0);
  check('Rivera half-outs floors damage', half.damage === 2);

  check('events catalog has choices', EVENTS.length >= 8 && EVENTS.every((e) => e.choices?.length >= 2));
  const bag = {
    gold: 10, owned: [], loose: [], charms: [], gearMap: {}, lineup: Array(9).fill(null), rung: 0,
  };
  const gained = applyEventEffect(bag, { type: 'gainGold', n: 5 }, mulberry32(1));
  check('event gainGold pays out', gained.state.gold === 15);
  const draftFu = applyEventEffect(bag, { type: 'draftOne' }, mulberry32(2));
  check('event draftOne opens a free pick', draftFu.followup?.type === 'draftOne' && draftFu.followup.offers.length >= 1);
  const free = claimFreeBatter(bag, draftFu.followup.offers[0].id);
  check('free batter claim adds to roster', free.ok && free.state.owned.length === 1);
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll QA checks passed.');
