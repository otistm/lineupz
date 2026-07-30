/**
 * QA gates for quiet resolution + draft/sponsor meta.
 * 1. Correctness — under-the-hood rolls stay sane
 * 2. Draft / sponsors / lineage upgrades
 * 3. Design — seats, sequence and gear are the levers
 */
import {
  simNight,
  boardSetup,
  battingOrder,
  computeLinks,
  contactChance,
  stuffAgainst,
  modifiersFor,
  zoneOf,
  lookAt,
  resolvePA,
  advanceRunners,
  stateOf,
  CONTACT_BASE,
  CONTACT_STEP,
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
import { HITTERS, GEAR, PITCHERS, LADDER, ECONOMY, SETS, SPONSORS } from '../src/data/catalog.js';

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

function winRate(lineup, gearMap, pitcher, target, N, seed) {
  const rng = mulberry32(seed);
  let wins = 0, broke = 0;
  for (let i = 0; i < N; i++) {
    const r = simNight(lineup, gearMap, pitcher, rng);
    if (r.runs >= target) wins++;
    if (r.broke) broke++;
  }
  return { win: wins / N, broke: broke / N };
}

/* ---------- quiet contact rule (engine-only; not player-facing) ---------- */
{
  check('even HIT vs stuff is the quiet base', Math.abs(contactChance(5, 5) - CONTACT_BASE) < 1e-9);
  check('each point of difference is the quiet step',
    Math.abs(contactChance(7, 5) - (CONTACT_BASE + 2 * CONTACT_STEP)) < 1e-9,
    `HIT 7 vs stuff 5 = ${(contactChance(7, 5) * 100).toFixed(0)}%`);
  check('contact chance is monotonic and clamped',
    contactChance(1, 12) >= 0.05 && contactChance(14, 0) <= 0.9 && contactChance(8, 4) > contactChance(6, 4));

  const rng = mulberry32(3);
  const bat = { HIT: 6, POW: 5, OUT: 0, arch: 'SPARK' };
  const rate = (stuff) => {
    let on = 0;
    const N = 40000;
    for (let i = 0; i < N; i++) if (resolvePA(bat, stuff, { runners: 0, state: 'FRESH' }, rng).reached) on++;
    return on / N;
  };
  const got = rate(6);
  check('resolvePA obeys contactChance', Math.abs(got - contactChance(6, 6)) < 0.01,
    `rolled ${(got * 100).toFixed(1)}% vs stated ${(contactChance(6, 6) * 100).toFixed(0)}%`);
}

/* ---------- fatigue and familiarity, both in STUFF ---------- */
{
  const k = P('koufax65');
  const fresh = stuffAgainst(k, 'FRESH', 0), gassed = stuffAgainst(k, 'GASSED', 0);
  check('his STUFF falls as the tank empties', gassed <= fresh - 4, `fresh ${fresh} → gassed ${gassed}`);
  check("Koufax's Fresh edge is on his card", fresh === k.stuff + k.freshEdge);
  check('a second look hands him +1 STUFF', stuffAgainst(k, 'GASSED', 1) - gassed === lookAt(1).stuff);
  const p = P('pedro00');
  check('Pedro fades slower than Koufax',
    stuffAgainst(p, 'GASSED', 0) - p.stuff > stuffAgainst(k, 'GASSED', 0) - k.stuff);
}

/* ---------- damage: POW is the hit, and how far it goes ---------- */
{
  const rng = mulberry32(9);
  const soft = { HIT: 20, POW: 2, OUT: 0, arch: 'GRINDER' };
  const big = { HIT: 20, POW: 12, OUT: 0, arch: 'SLUGGER' };
  const run = (e) => {
    let dmg = 0, homers = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const r = resolvePA(e, 0, { runners: 0, state: 'FRESH' }, rng);
      dmg += r.damage; if (r.type === 'HR') homers++;
    }
    return { dmg: dmg / N, hr: homers / N };
  };
  const a = run(soft), b = run(big);
  check('POW is the damage', b.dmg > a.dmg * 2.5, `pow 2 → ${a.dmg.toFixed(1)}, pow 12 → ${b.dmg.toFixed(1)}`);
  check('only a stacked bat leaves the yard', a.hr === 0 && b.hr > 0.1, `pow 12 homers ${(b.hr * 100).toFixed(0)}%`);

  const gr = { HIT: 0, POW: 3, OUT: 2, arch: 'GRINDER' };
  const out = resolvePA(gr, 20, { runners: 0, state: 'FRESH' }, mulberry32(5));
  check("a grinder's out still costs him", !out.reached && out.damage === 2);
  const vsMaddux = resolvePA(gr, 20, { runners: 0, state: 'FRESH', noOutDamage: true }, mulberry32(5));
  check('Maddux pays nothing for outs', vsMaddux.damage === 0);
}

/* ---------- abilities ---------- */
{
  const rally = { HIT: 5, POW: 4, OUT: 0, arch: 'RALLY' };
  const empty = modifiersFor(rally, 'FRESH', { runners: 0 });
  const loaded = modifiersFor(rally, 'FRESH', { runners: 3 });
  check('rally man scales with runners on', empty.length === 0 && loaded[0].HIT === 3 && loaded[0].POW === 3);
  const slug = { HIT: 5, POW: 7, OUT: 0, arch: 'SLUGGER' };
  check('slugger only feeds once he is Gassed',
    modifiersFor(slug, 'FRESH', { runners: 0 }).length === 0 &&
    modifiersFor(slug, 'GASSED', { runners: 0 })[0].POW === 3);
  const a = advanceRunners([{ arch: 'SPARK' }, null, { arch: 'RALLY' }], { bases: 4, type: 'HR', reached: true }, { arch: 'SLUGGER' }, mulberry32(2));
  check('home run scores everyone + batter', a.runs === 3 && a.bases.every((x) => x === null));
}

/* ---------- lineup position ---------- */
{
  const lineup = Array(9).fill(H('bench72'));
  const { eff } = boardSetup(lineup, {});
  check('top of the order adds HIT', eff[0].HIT === H('bench72').HIT + 1);
  check('the heart adds POW', eff[4].POW === H('bench72').POW + 2);
  check('the bottom makes his outs cost', eff[7].OUT === 1 && zoneOf(8).key === 'BOTTOM');
}

/* ---------- seats and gaps ---------- */
{
  const five = [H('ozzie87'), null, H('pudge99'), null, H('bench72'), null, H('griffey97'), null, H('arod96')];
  const nine = ['ozzie87', 'pudge99', 'bench72', 'griffey97', 'arod96', 'schmidt80', 'gwynn94', 'gehrig27', 'rickey85'].map(H);
  check('batting order skips empty seats', battingOrder(five).join(',') === '0,2,4,6,8');
  check('links follow the batting order across gaps', computeLinks(five).length > 0, `${computeLinks(five).length} links`);

  const rng = mulberry32(21);
  let dFive = 0, dNine = 0;
  const p = P('koufax65');
  for (let i = 0; i < 2000; i++) {
    dFive += p.pool - simNight(five, {}, p, rng).stamina;
    dNine += p.pool - simNight(nine, {}, p, rng).stamina;
  }
  check('a full order wears him down harder than a short one', dNine / dFive > 1.2,
    `nine ${(dNine / 2000).toFixed(1)} vs five ${(dFive / 2000).toFixed(1)} stamina`);
}
check('state thresholds ordered', stateOf(100, 100) === 'FRESH' && stateOf(50, 100) === 'LABORING' && stateOf(20, 100) === 'GASSED' && stateOf(5, 100) === 'BROKEN');
{
  const lineup = ['gwynn94', 'ruth27', 'morgan76', 'ichiro04', 'bench72', 'griffey97', 'williams41', 'ozzie87', 'gehrig27'].map(H);
  const { eff, links } = boardSetup(lineup, {});
  check('spark→slugger lights Table set', links.some((l) => l.type === 'TABLESET'), `${links.length} links`);
  check('a link covers the weakness of the bat it feeds', eff[1].HIT >= H('ruth27').HIT + 3,
    `Ruth HIT ${H('ruth27').HIT} → ${eff[1].HIT}`);
}

/* ---------- draft / sponsors / career cards ---------- */
{
  check('every hitter has lineage, set, cost, HIT/POW',
    HITTERS.every((h) => h.HIT > 0 && h.POW > 0 && h.cost > 0 && h.lineage && SETS[h.set]));
  check('gear only speaks in HIT, POW and OUT',
    GEAR.every((g) => g.cost > 0 && Object.keys(g.mods).every((k) => ['HIT', 'POW', 'OUT'].includes(k))));
  check('every pitcher has a gimmick note and a tank', PITCHERS.every((p) => p.pool > 0 && p.note && p.tip));
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

/* ---------- progression difficulty ---------- */
const SCRAPPY = [H('ozzie87'), H('pudge99'), H('bench72'), H('griffey97'), H('schmidt80'), H('arod96'), null, null, null];
const FUNDED = ['gwynn94', 'ruth27', 'ichiro04', 'williams41', 'gehrig27', 'mays65', 'morgan76', 'trout12', 'ozzie87'].map(H);
const FUNDED_GEAR = {
  williams41: [G('donut'), G('tar')],
  morgan76: [G('guard')],
  ruth27: [G('maple')],
  gwynn94: [G('cleats')],
  ichiro04: [G('ash'), G('helmet')],
};
const N = 3000;

{
  const { win } = winRate(SCRAPPY, {}, P('longman'), LADDER[0].target, N, 11);
  check('scrappy board clears Opening Night in band', win >= 0.6 && win <= 0.95, `win ${(win * 100).toFixed(1)}% ∈ [60, 95]`);
}
{
  const funded = winRate(FUNDED, FUNDED_GEAR, P('pedro00'), LADDER[4].target, N, 13).win;
  const weak = winRate(SCRAPPY, {}, P('pedro00'), LADDER[4].target, N, 15).win;
  check('funded board clears Pedro in band', funded >= 0.35 && funded <= 0.8, `win ${(funded * 100).toFixed(1)}%`);
  check('underfunded board struggles vs Pedro', weak <= 0.25 && funded - weak >= 0.2,
    `weak ${(weak * 100).toFixed(1)}% vs funded ${(funded * 100).toFixed(1)}%`);
}
{
  /* seats you buy are the main lever: same tier, more of them */
  const five = winRate([H('ozzie87'), H('pudge99'), H('bench72'), H('griffey97'), H('arod96'), null, null, null, null],
    {}, P('koufax65'), LADDER[2].target, N, 17).win;
  const nine = winRate(['ozzie87', 'pudge99', 'bench72', 'griffey97', 'arod96', 'schmidt80', 'gwynn94', 'gehrig27', 'rickey85'].map(H),
    {}, P('koufax65'), LADDER[2].target, N, 17).win;
  check('filling the order beats a short order', nine >= five * 1.5, `five ${(five * 100).toFixed(1)}% vs nine ${(nine * 100).toFixed(1)}%`);
}
{
  /* same nine bats, same gear — only the order changes.
     GOOD: grinders and sparks ahead of the bats they feed, sluggers in the heart.
     BAD: pop wasted at the top, sparks wasted in the heart, links landing nowhere. */
  const GEAR_M = { morgan76: [G('donut')], gwynn94: [G('ash')], ruth27: [G('cork')] };
  const GOOD = ['morgan76', 'gwynn94', 'ichiro04', 'ruth27', 'ozzie87', 'mays65', 'williams41', 'bench72', 'gehrig27'].map(H);
  const BAD = ['ruth27', 'mays65', 'bench72', 'gwynn94', 'ichiro04', 'ozzie87', 'morgan76', 'williams41', 'gehrig27'].map(H);
  const g = winRate(GOOD, GEAR_M, P('maddux95'), 4, 4000, 42).win;
  const b = winRate(BAD, GEAR_M, P('maddux95'), 4, 4000, 42).win;
  check('sequence lever ≥ 5pp on mid board', g - b >= 0.05, `good ${(g * 100).toFixed(1)}% vs bad ${(b * 100).toFixed(1)}%`);
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll QA checks passed.');
