/* Target-tuning sweep. Shows how order size, sequence and investment move the
   needle against each arm's STUFF and tank. */
import { simNight, boardSetup, battingOrder, contactChance, stuffAgainst } from '../src/engine/sim.js';
import { HITTERS, GEAR, PITCHERS, LADDER } from '../src/data/catalog.js';

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
const pad = (ids) => { const l = ids.map(H); while (l.length < 9) l.push(null); return l; };

function run(lineup, gearMap, pitcher, N, seed) {
  const rng = mulberry32(seed);
  const hist = new Map();
  let total = 0, broke = 0, drainTotal = 0;
  for (let i = 0; i < N; i++) {
    const r = simNight(lineup, gearMap, pitcher, rng);
    total += r.runs; if (r.broke) broke++;
    drainTotal += pitcher.pool - r.stamina;
    hist.set(r.runs, (hist.get(r.runs) || 0) + 1);
  }
  const atLeast = (t) => { let c = 0; for (const [k, v] of hist) if (k >= t) c += v; return c / N; };
  return { mean: total / N, broke: broke / N, drain: drainTotal / N, atLeast };
}

const N = 4000;
const BOARDS = {
  'start 5 commons':  { l: pad(['ozzie87', 'pudge99', 'bench72', 'griffey97', 'arod96']), g: {} },
  'start 6 commons':  { l: pad(['ozzie87', 'pudge99', 'bench72', 'griffey97', 'schmidt80', 'arod96']), g: {} },
  '7 commons + gear': { l: pad(['ozzie87', 'griffey97', 'pudge99', 'schmidt80', 'bench72', 'arod96', 'gwynn94']), g: { schmidt80: [G('tar')] } },
  '8 mixed rares':    { l: pad(['gwynn94', 'griffey97', 'morgan76', 'bench72', 'rickey85', 'mantle56', 'ozzie87', 'arod96']), g: { morgan76: [G('donut')], gwynn94: [G('ash')] } },
  '9 rares + gear':   { l: pad(['gwynn94', 'mantle56', 'morgan76', 'bonds01', 'rickey85', 'gehrig27', 'pudge99', 'griffey97', 'bench72']), g: { morgan76: [G('donut')], bonds01: [G('tar')], mantle56: [G('cork')] } },
  'legends sequenced': {
    l: pad(['gwynn94', 'ruth27', 'ichiro04', 'mays65', 'ozzie87', 'trout12', 'williams41', 'morgan76', 'gehrig27']),
    g: { williams41: [G('donut'), G('tar')], morgan76: [G('guard')], ruth27: [G('maple')], gwynn94: [G('cleats')], ichiro04: [G('ash'), G('helmet')] },
  },
  '9 legends loaded': {
    l: pad(['gwynn94', 'ruth27', 'ichiro04', 'williams41', 'gehrig27', 'mays65', 'morgan76', 'trout12', 'ozzie87']),
    g: { williams41: [G('donut'), G('tar')], morgan76: [G('guard')], ruth27: [G('maple')], gwynn94: [G('cleats')], ichiro04: [G('ash'), G('helmet')] },
  },
};

for (let rung = 0; rung < LADDER.length; rung++) {
  const p = P(LADDER[rung].pitcher);
  const wall = stuffAgainst(p, 'FRESH', 0), open = stuffAgainst(p, 'GASSED', 0);
  console.log(`\n=== rung ${rung + 1} ${LADDER[rung].name} — ${p.n} (STUFF ${wall} → ${open}, pool ${p.pool}, target ${LADDER[rung].target}) ===`);
  for (const [name, b] of Object.entries(BOARDS)) {
    const s = run(b.l, b.g, p, N, 100 + rung * 7);
    const eff = boardSetup(b.l, b.g).eff.filter(Boolean);
    const reach = eff.reduce((a, e) => a + contactChance(e.HIT, wall), 0) / eff.length;
    const cols = [1, 2, 3, 4, 5].map((t) => `${t}+ ${(s.atLeast(t) * 100).toFixed(0)}%`).join('  ');
    console.log(
      `  ${name.padEnd(18)} seats ${battingOrder(b.l).length}  links ${String(boardSetup(b.l, b.g).links.length).padStart(2)}  ` +
      `reach ${(reach * 100).toFixed(0)}%  mean ${s.mean.toFixed(2)}  drain ${s.drain.toFixed(0)}/${p.pool}  broke ${(s.broke * 100).toFixed(0)}%  |  ${cols}`,
    );
  }
}
