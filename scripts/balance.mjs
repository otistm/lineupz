/* Tuning harness for shop-progression boards. */
import { simNight, boardSetup } from '../src/engine/sim.js';
import { generateDraft, generateSponsors, sellPrice, canPlay } from '../src/engine/shop.js';
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
const G = (id) => GEAR.find((g) => g.id === id);
const P = (id) => PITCHERS.find((p) => p.id === id);

function run(lineup, gearMap, pitcher, target, N, seed) {
  const rng = mulberry32(seed);
  let wins = 0, total = 0, broke = 0;
  for (let i = 0; i < N; i++) {
    const r = simNight(lineup, gearMap, pitcher, rng);
    total += r.runs;
    if (r.runs >= target) wins++;
    if (r.broke) broke++;
  }
  return { win: wins / N, mean: total / N, broke: broke / N };
}

/** Early-run scrappy: starters + 3 cheap buys (~12g), 6 seated, holes skipped */
const SCRAPPY = [
  H('ozzie87'), H('pudge99'), H('bench72'), H('griffey97'), H('schmidt80'), H('arod96'),
  null, null, null,
];
const SCRAPPY_GEAR = {};

/** Mid-run funded rare board */
const MID = ['gwynn94', 'morgan76', 'griffey97', 'gehrig27', 'rickey85', 'mantle56', 'bench72', 'ozzie87', 'bonds01'].map(H);
const MID_GEAR = { morgan76: [G('donut')], gwynn94: [G('ash')], mantle56: [G('cork')] };

/** Full legend endgame */
const FUNDED = ['gwynn94', 'ruth27', 'ichiro04', 'williams41', 'gehrig27', 'mays65', 'morgan76', 'trout12', 'ozzie87'].map(H);
const FUNDED_GEAR = {
  williams41: [G('donut'), G('tar')],
  morgan76: [G('guard')],
  ruth27: [G('maple')],
  gwynn94: [G('cleats')],
  ichiro04: [G('ash'), G('helmet')],
};

const THIN = [H('ozzie87'), H('pudge99'), H('bench72'), null, null, null, null, null, null];

const N = 4000;
console.log('=== ladder vs progression boards ===');
console.log('scrappy (5) vs Opening Night:', fmt(run(SCRAPPY, SCRAPPY_GEAR, P('longman'), LADDER[0].target, N, 11)));
console.log('mid vs Surgeon:           ', fmt(run(MID, MID_GEAR, P('maddux95'), LADDER[1].target, N, 12)));
console.log('funded vs Pedro:          ', fmt(run(FUNDED, FUNDED_GEAR, P('pedro00'), LADDER[4].target, N, 13)));
console.log('thin (3) vs Opening:      ', fmt(run(THIN, {}, P('longman'), LADDER[0].target, N, 14)));
console.log('underfunded vs Pedro:     ', fmt(run(SCRAPPY, {}, P('pedro00'), LADDER[4].target, N, 15)));

console.log('\n=== sequence lever (mid board vs Maddux) ===');
const GOOD = ['gwynn94', 'ruth27', 'ichiro04', 'griffey97', 'morgan76', 'bench72', 'williams41', 'gehrig27', 'ozzie87'].map(H);
const BAD = ['ozzie87', 'gwynn94', 'morgan76', 'ichiro04', 'williams41', 'ruth27', 'griffey97', 'bench72', 'gehrig27'].map(H);
console.log(`  good (${boardSetup(GOOD, MID_GEAR).links.length} links):`, fmt(run(GOOD, MID_GEAR, P('maddux95'), 2, N, 42)));
console.log(`  bad  (${boardSetup(BAD, MID_GEAR).links.length} links):`, fmt(run(BAD, MID_GEAR, P('maddux95'), 2, N, 42)));

console.log('\n=== draft / sponsor smoke ===');
{
  const rng = mulberry32(99);
  const draft = generateDraft(0, [], rng);
  const sponsors = generateSponsors(rng);
  console.log('  start gold', ECONOMY.startGold, 'lives', ECONOMY.startLives, 'minSeated', ECONOMY.minSeated);
  console.log('  draft0:', draft.map((o) => `${o.id}@${o.cost}${o.upgrade ? '*' : ''}`).join(', '));
  console.log('  sponsors:', sponsors.map((s) => `${s.n}:${s.offers.length}`).join(', '));
  console.log('  canPlay scrappy', canPlay(SCRAPPY), 'thin', canPlay(THIN));
  console.log('  sell ozzie', sellPrice(H('ozzie87')));
}

function fmt(s) {
  return `win ${(s.win * 100).toFixed(1)}%  mean ${s.mean.toFixed(2)}  broke ${(s.broke * 100).toFixed(0)}%`;
}
