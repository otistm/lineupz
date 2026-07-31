/* LINEUP — pure resolution. No DOM. Node + browser.

   Nothing rolls. Every plate appearance is exact:
   the bat's HIT beats the PITCH or it doesn't, and STAM DMG is the damage.
   All the variety in a run comes from what the draft and sponsors offer —
   never from the outcome of a strategic choice the player already made. */

/* ---------- the one rule: beat the pitch ---------- */
/** Exact contest — the bat is on iff its HIT is strictly over the pitch. */
export function beatsWall(hit, pitch) {
  return hit > pitch;
}

/* ---------- hit distance: exact STAM DMG thresholds ----------
   The damage a hit deals is exactly the bat's STAM DMG (POW).
   Distance is read off that same number — extra bases are earned by stacking it. */
export const DOUBLE_AT = 8;  // STAM DMG at or over this: a double
export const HOMER_AT = 12;  // STAM DMG at or over this: gone

/* ---------- archetypes: one ability each ----------
   role = short card line in HIT / STAM DMG language.
   ability = fuller hover text. Never talk about "he". */
export const ARCH_INFO = {
  SPARK:   { label: 'Spark',   role: 'Takes the extra base',
    ability: 'Always takes the extra base on the paths. Once the pitcher is past Fresh, every single stretches into a double.' },
  GRINDER: { label: 'Grinder', role: 'Outs still deal STAM DMG',
    ability: 'Even an out deals STAM DMG to the pitcher (unless the pitcher ignores outs).' },
  SLUGGER: { label: 'Slugger', role: '+3 STAM DMG once pitcher is Gassed',
    ability: '+3 STAM DMG once the pitcher is Gassed or Broken.' },
  RALLY:   { label: 'Rally',   role: '+1 HIT & STAM DMG per runner on',
    ability: '+1 HIT and +1 STAM DMG for each runner already on base.' },
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

/* ---------- familiarity: a bat the pitcher has already seen is easier to handle ---------- */
export const LOOKS = [
  { stuff: 0, label: 'first look' },
  { stuff: 1, label: 'second look' },
  { stuff: 3, label: 'third look' },
  { stuff: 5, label: 'fourth look' },
];
export const lookAt = (seen) => LOOKS[Math.min(seen, LOOKS.length - 1)];

/** The pitch a bat has to beat — shown on the stamina bar as the red PITCH badge. */
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
  { key: 'TOP',    label: 'Top of the order',    gives: '+1 HIT',                 HIT: 1, POW: 0, OUT: 0 },
  { key: 'HEART',  label: 'Heart of the order',  gives: '+2 STAM DMG',            HIT: 0, POW: 2, OUT: 0 },
  { key: 'BOTTOM', label: 'Bottom of the order', gives: 'outs +1 STAM DMG',       HIT: 0, POW: 0, OUT: 1 },
];
export const zoneOf = (slot) => ZONES[Math.floor(slot / 3)];

/* ---------- links: neighbours in the batting order feed each other ---------- */
export const LINK_TYPES = {
  WORN:      { label: 'Worn down', gives: 'softens the next bat',              short: 'softens next', HIT: 2 },
  TABLESET:  { label: 'Table set', gives: 'sets the table for the slugger',    short: 'sets table', HIT: 3 },
  ATTRITION: { label: 'Attrition', gives: 'both grinders wear the pitcher harder', short: 'wear harder', OUT: 1, both: true },
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
    mods.push({ key: 'RALLY', label: `+${on} HIT & STAM DMG`, detail: `${on} on base`, HIT: on, POW: on });
  }
  if (e.arch === 'SLUGGER' && (state === 'GASSED' || state === 'BROKEN')) {
    mods.push({ key: 'SLUGGER', label: '+3 STAM DMG', detail: `pitcher is ${STATE_INFO[state].label}`, HIT: 0, POW: 3 });
  }
  return mods;
}
export const sumMods = (mods, key) => mods.reduce((a, m) => a + (m[key] || 0), 0);

/* ---------- one plate appearance — exact, no rolls ---------- */
export function resolvePA(e, stuff, ctx, _rng) {
  const state = ctx.state || 'FRESH';
  const mods = ctx.mods || modifiersFor(e, state, ctx);
  const hit = e.HIT + sumMods(mods, 'HIT');
  const pow = e.POW + sumMods(mods, 'POW');

  if (!beatsWall(hit, stuff)) {
    return { type: 'OUT', reached: false, bases: 0, damage: ctx.noOutDamage ? 0 : e.OUT || 0, hit, pow, wall: stuff };
  }

  let type = '1B', bases = 1, stretch = false;
  if (pow >= HOMER_AT) { type = 'HR'; bases = 4; }
  else if (pow >= DOUBLE_AT) { type = '2B'; bases = 2; }
  // Spark's legs are an ability, not a roll: once the pitcher is tiring he stretches every single.
  else if (e.arch === 'SPARK' && state !== 'FRESH') { type = '2B'; bases = 2; stretch = true; }
  return { type, reached: true, bases, stretch, damage: pow, hit, pow, wall: stuff };
}

/* bases hold {arch} or null. */
export function advanceRunners(bases, r, batter, _rng) {
  let runs = 0;
  const nb = [null, null, null];
  const n = r.bases;
  for (let i = 2; i >= 0; i--) {
    if (!bases[i]) continue;
    // A spark on the bases always takes the extra base on a single — exact, every time.
    const mv = n === 1 && bases[i].arch === 'SPARK' ? 2 : n;
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
