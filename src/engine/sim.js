/* LINEUP — pure resolution. No DOM. Node + browser.

   The player strategizes with sequence, abilities, links, and pitcher gimmicks.
   HIT / POW / stuff / stamina still resolve under the hood so nights feel varied,
   but that math is not meant to be the player's surface. */

/* ---------- the one rule ---------- */
export const CONTACT_BASE = 0.35; // even HIT vs STUFF reaches base this often
export const CONTACT_STEP = 0.05; // per point of difference
export const CONTACT_MIN = 0.05, CONTACT_MAX = 0.85;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function contactChance(hit, stuff) {
  return clamp(CONTACT_BASE + (hit - stuff) * CONTACT_STEP, CONTACT_MIN, CONTACT_MAX);
}

/* ---------- hit quality: how well he got it decides damage and distance ----------
   One roll around POW, so a bigger bat is both a bigger hit and a bigger dent.
   Extra bases have to be earned by stacking POW, not handed out. */
export const SWING_LOW = 0.6, SWING_HIGH = 1.5; // POW × this range
export const DOUBLE_AT = 9.5;
export const HOMER_AT = 13;

/* ---------- archetypes: one ability each ---------- */
export const ARCH_INFO = {
  SPARK:   { label: 'Spark',   role: 'Stretches singles · takes the extra base',
    ability: 'Stretches singles into doubles, and takes the extra base ahead of the next bat.' },
  GRINDER: { label: 'Grinder', role: 'Even his outs cost stamina',
    ability: 'Long at-bats — even when he makes an out the pitcher pays stamina.' },
  SLUGGER: { label: 'Slugger', role: 'Feeds once he is Gassed',
    ability: 'Feeds on fatigue: hits harder once the pitcher is Gassed or worse.' },
  RALLY:   { label: 'Rally',   role: 'Heats up with runners on',
    ability: 'Gets hotter for every runner already on base.' },
};
export const OUT_DAMAGE = { GRINDER: 2 };

/* ---------- fatigue: emptying the tank unlocks the lineup ---------- */
export const STATE_INFO = {
  FRESH:    { label: 'Fresh',    stuff: 0 },
  LABORING: { label: 'Laboring', stuff: -2 },
  GASSED:   { label: 'Gassed',   stuff: -4 },
  BROKEN:   { label: 'BROKEN',   stuff: -6 },
};
export const THRESH = { LABORING: 0.65, GASSED: 0.38, BROKEN: 0.12 };

export function stateOf(stamina, pool) {
  const k = stamina / pool;
  if (k > THRESH.LABORING) return 'FRESH';
  if (k > THRESH.GASSED) return 'LABORING';
  if (k > THRESH.BROKEN) return 'GASSED';
  return 'BROKEN';
}

/* ---------- familiarity: a bat he has already seen is easier to handle ---------- */
export const LOOKS = [
  { stuff: 0, label: 'first look' },
  { stuff: 1, label: 'second look' },
  { stuff: 3, label: 'third look' },
  { stuff: 5, label: 'fourth look' },
];
export const lookAt = (seen) => LOOKS[Math.min(seen, LOOKS.length - 1)];

/** Quiet contact wall for the resolver — not a player-facing number. */
export function stuffAgainst(pitcher, state, seen = 0) {
  const fade = STATE_INFO[state].stuff * (pitcher.stubborn || 1);
  const edge = pitcher.freshEdge && state === 'FRESH' ? pitcher.freshEdge : 0;
  return Math.max(0, Math.round(pitcher.stuff + fade + edge + lookAt(seen).stuff));
}

/* ---------- the order ---------- */
/** Seated slots in batting order. Empty seats are skipped, never outs. */
export function battingOrder(lineup) {
  const order = [];
  for (let i = 0; i < 9; i++) if (lineup[i]) order.push(i);
  return order;
}

/* ---------- where a bat sits matters on its own ---------- */
export const ZONES = [
  { key: 'TOP',    label: 'Top of the order',    gives: 'gets on base',           HIT: 1, POW: 0, OUT: 0 },
  { key: 'HEART',  label: 'Heart of the order',  gives: 'drives them in',         HIT: 0, POW: 2, OUT: 0 },
  { key: 'BOTTOM', label: 'Bottom of the order', gives: 'outs still cost him',    HIT: 0, POW: 0, OUT: 1 },
];
export const zoneOf = (slot) => ZONES[Math.floor(slot / 3)];

/* ---------- links: neighbours in the batting order feed each other ---------- */
export const LINK_TYPES = {
  WORN:      { label: 'Worn down', gives: 'softens the next bat',              short: 'softens next', HIT: 2 },
  TABLESET:  { label: 'Table set', gives: 'sets the table for the slugger',    short: 'sets table', HIT: 3 },
  ATTRITION: { label: 'Attrition', gives: 'both grinders wear him harder',     short: 'wear harder', OUT: 1, both: true },
  IGNITE:    { label: 'Ignition',  gives: 'lights the rally man',              short: 'lights rally', POW: 2 },
};

export function computeLinks(lineup) {
  const order = battingOrder(lineup);
  const links = [];
  if (order.length < 2) return links;
  for (let k = 0; k < order.length; k++) {
    const i = order[k], j = order[(k + 1) % order.length];
    const a = lineup[i], b = lineup[j];
    if (a.arch === 'GRINDER') links.push({ from: i, to: j, type: 'WORN' });
    if (a.arch === 'GRINDER' && b.arch === 'GRINDER') links.push({ from: i, to: j, type: 'ATTRITION' });
    if (a.arch === 'SPARK' && b.arch === 'SLUGGER') links.push({ from: i, to: j, type: 'TABLESET' });
    if (a.arch === 'SPARK' && b.arch === 'RALLY') links.push({ from: i, to: j, type: 'IGNITE' });
  }
  return links;
}

/** Effective HIT / POW / OUT per slot: card + zone + gear + links. Pitcher-free. */
export function boardSetup(lineup, gearMap) {
  const links = computeLinks(lineup);
  const eff = lineup.map((p, slot) => {
    if (!p) return null;
    const z = zoneOf(slot);
    const e = {
      HIT: p.HIT + z.HIT,
      POW: p.POW + z.POW,
      OUT: (OUT_DAMAGE[p.arch] || 0) + z.OUT,
      arch: p.arch, id: p.id, n: p.n, set: p.set, zone: z.key,
    };
    for (const g of gearMap[p.id] || []) for (const k in g.mods) e[k] += g.mods[k];
    return e;
  });
  for (const l of links) {
    const t = LINK_TYPES[l.type];
    const targets = t.both ? [l.from, l.to] : [l.to];
    for (const s of targets) {
      if (!eff[s]) continue;
      eff[s].HIT += t.HIT || 0;
      eff[s].POW += t.POW || 0;
      eff[s].OUT += t.OUT || 0;
    }
  }
  return { eff, links };
}

/* ---------- live modifiers, shared by the sim and the card readout ----------
   ctx: { runners, state }. Returned in the order they should be shown. */
export function modifiersFor(e, state, ctx) {
  const mods = [];
  const on = Math.min(3, ctx.runners || 0);
  if (e.arch === 'RALLY' && on > 0) {
    mods.push({ key: 'RALLY', label: 'Rally man', detail: `${on} on base`, HIT: on, POW: on });
  }
  if (e.arch === 'SLUGGER' && (state === 'GASSED' || state === 'BROKEN')) {
    mods.push({ key: 'SLUGGER', label: 'Feeds on fatigue', detail: `he is ${STATE_INFO[state].label}`, HIT: 0, POW: 3 });
  }
  return mods;
}
export const sumMods = (mods, key) => mods.reduce((a, m) => a + (m[key] || 0), 0);

/* ---------- one plate appearance ---------- */
export function resolvePA(e, stuff, ctx, rng) {
  const mods = ctx.mods || modifiersFor(e, ctx.state || 'FRESH', ctx);
  const hit = e.HIT + sumMods(mods, 'HIT');
  const pow = e.POW + sumMods(mods, 'POW');
  const chance = contactChance(hit, stuff);

  if (rng() >= chance) {
    return { type: 'OUT', reached: false, bases: 0, damage: ctx.noOutDamage ? 0 : e.OUT || 0, chance, hit, pow };
  }

  const swing = pow * (SWING_LOW + rng() * (SWING_HIGH - SWING_LOW));
  let type = '1B', bases = 1, stretch = false;
  if (swing >= HOMER_AT) { type = 'HR'; bases = 4; }
  else if (swing >= DOUBLE_AT) { type = '2B'; bases = 2; }
  else if (e.arch === 'SPARK' && rng() < 0.32) { type = '2B'; bases = 2; stretch = true; }
  return { type, reached: true, bases, stretch, damage: Math.max(1, Math.round(swing)), chance, hit, pow };
}

/* bases hold {arch} or null. */
export function advanceRunners(bases, r, batter, rng) {
  let runs = 0;
  const nb = [null, null, null];
  const n = r.bases;
  for (let i = 2; i >= 0; i--) {
    if (!bases[i]) continue;
    let mv = n;
    if (n === 1 && bases[i].arch === 'SPARK' && rng() < 0.35) mv = 2;
    const to = i + mv;
    if (to >= 3) runs++;
    else nb[to] = bases[i];
  }
  if (n >= 4) runs++;
  else nb[n - 1] = batter;
  return { runs, bases: nb };
}

/* ---------- a whole night: three innings, order and stamina carry over ---------- */
export const INNING_CAP = 11; // mercy cap on plate appearances in one inning

export function simNight(lineup, gearMap, pitcher, rng) {
  const { eff } = boardSetup(lineup, gearMap);
  const order = battingOrder(lineup);
  let stamina = pitcher.pool, pos = 0, runs = 0, faced = 0;
  const looks = Array(9).fill(0);
  const perInning = [];
  if (!order.length) {
    return { runs: 0, perInning: [0, 0, 0], faced: 0, stamina, finalState: stateOf(stamina, pitcher.pool), broke: false };
  }
  for (let f = 0; f < 3; f++) {
    if (f > 0 && pitcher.recover) stamina = Math.min(pitcher.pool, stamina + pitcher.recover);
    let bases = [null, null, null], outs = 0, innRuns = 0, innFaced = 0;
    while (outs < 3 && innFaced < INNING_CAP) {
      const slot = order[pos % order.length];
      const e = eff[slot];
      pos++; faced++; innFaced++;
      const seen = looks[slot]++;
      const state = stateOf(stamina, pitcher.pool);
      const stuff = stuffAgainst(pitcher, state, seen);
      const ctx = { runners: bases.filter(Boolean).length, state, noOutDamage: pitcher.efficient };
      const r = resolvePA(e, stuff, ctx, rng);
      stamina = Math.max(0, stamina - r.damage);
      if (!r.reached) outs++;
      else {
        const a = advanceRunners(bases, r, { arch: e.arch }, rng);
        bases = a.bases; innRuns += a.runs;
      }
    }
    runs += innRuns; perInning.push(innRuns);
  }
  return {
    runs, perInning, faced, stamina,
    finalState: stateOf(stamina, pitcher.pool),
    broke: stateOf(stamina, pitcher.pool) === 'BROKEN',
  };
}
