/* Hex island map — pure generation + navigation. No DOM.
   Flat-top hexes, legs left → right, boss alone on the far right.
   From a tile you travel to the hexes it touches in the next leg. */

import { ECONOMY } from '../data/catalog.js';

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Short island — sized for Lineup's four stop kinds + a boss. */
export const HEX_LEGS = 7;
export const HEX_ACE_LEG = HEX_LEGS - 1;
/** Lanes per leg, left → right. Boss leg is always width 1. */
const HEX_PROFILE = [2, 3, 3, 3, 2, 2, 1];

const KIND_POOL = ['draft', 'sponsors', 'gold', 'event'];
const KIND_WEIGHTS = { draft: 32, sponsors: 22, gold: 22, event: 24 };

/* Hex layout constants (flat top). Shared by the SVG renderer. */
export const HEX = {
  S: 68,                          // centre → corner
  get LANEH() { return Math.sqrt(3) * this.S; },
  get LEGW() { return 1.5 * this.S; },
  WALL: 14,
  CW: 1020,
  CH: 580,
};

/** Next-leg lanes reachable from (lane, leg). */
const fwd = (lane, leg) => (leg % 2 === 0 ? [lane - 1, lane] : [lane, lane + 1]);
/** Inverse — which prior lanes can reach this lane. */
const par = (lane, leg) => (leg % 2 === 0 ? [lane, lane + 1] : [lane - 1, lane]);

function spanOptions(leg, ahead, P, W) {
  const [a, b] = ahead;
  const out = [];
  for (let p = P[0]; p + W - 1 <= P[1]; p++) {
    const q = p + W - 1;
    let ok = true;
    for (let L = a; L <= b; L++) {
      const [u, v] = par(L, leg);
      if (!(u >= p && u <= q) && !(v >= p && v <= q)) { ok = false; break; }
    }
    if (ok) out.push([p, q]);
  }
  return out;
}

function pickKind(rng, actIndex, leg, neighbors) {
  const weights = { ...KIND_WEIGHTS };
  weights.event += actIndex * 2;
  // Soft anti-repeat from previous tiles that feed this one.
  for (const n of neighbors) {
    if (n.kind && weights[n.kind] != null) weights[n.kind] *= 0.35;
  }
  if (leg === 0) return 'draft';
  if (leg === 3) {
    // Mid-island payday bias
    weights.gold *= 2.2;
  }
  if (leg >= HEX_ACE_LEG - 1) weights.sponsors *= 1.6;

  const keys = KIND_POOL;
  const total = keys.reduce((a, k) => a + (weights[k] || 0), 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k] || 0;
    if (r < 0) return k;
  }
  return 'event';
}

/**
 * One act = a small hex island ending in tonight's pitcher.
 * Nodes keep `kind` / `edges` / `layer` so the rest of the app stays stable.
 */
export function generateAct(actIndex, rng) {
  const spans = new Array(HEX_LEGS);
  spans[HEX_ACE_LEG] = [0, 0];
  for (let leg = HEX_ACE_LEG - 1; leg >= 0; leg--) {
    const [a, b] = spans[leg + 1];
    const P = leg % 2 === 0 ? [a, b + 1] : [a - 1, b];
    let W = Math.min(HEX_PROFILE[leg], P[1] - P[0] + 1);
    let opts = [];
    while (!opts.length && W <= P[1] - P[0] + 1) {
      opts = spanOptions(leg, [a, b], P, W);
      if (!opts.length) W++;
    }
    spans[leg] = opts.length ? opts[Math.floor(rng() * opts.length)] : [P[0], P[1]];
  }

  const grid = spans.map(() => ({}));
  const all = [];
  let idc = 0;
  for (let leg = 0; leg < HEX_LEGS; leg++) {
    for (let lane = spans[leg][0]; lane <= spans[leg][1]; lane++) {
      const t = {
        id: `a${actIndex}-h${idc++}`,
        act: actIndex,
        layer: leg,
        leg,
        lane,
        kind: null,
        edges: [],
        next: [],
        prev: [],
      };
      grid[leg][lane] = t;
      all.push(t);
    }
  }

  for (let leg = 0; leg < HEX_ACE_LEG; leg++) {
    for (const k of Object.keys(grid[leg])) {
      const t = grid[leg][k];
      for (const nl of fwd(t.lane, leg)) {
        const u = grid[leg + 1][nl];
        if (u) { t.next.push(u); u.prev.push(t); }
      }
    }
  }

  const boss = grid[HEX_ACE_LEG][spans[HEX_ACE_LEG][0]];
  boss.kind = 'boss';

  for (let leg = 0; leg < HEX_ACE_LEG; leg++) {
    for (const k of Object.keys(grid[leg])) {
      const t = grid[leg][k];
      t.kind = pickKind(rng, actIndex, leg, t.prev);
    }
  }
  // Guarantee at least one draft stop on the island.
  if (!all.some((t) => t.kind === 'draft')) {
    const seed = all.find((t) => t.kind !== 'boss');
    if (seed) seed.kind = 'draft';
  }

  // Layout positions for the SVG renderer.
  // Bounds include lift (drawn upward), extruded walls, and ace scale so tiles
  // aren't clipped by the viewBox / stage overflow.
  let minY = Infinity, maxY = -Infinity;
  for (const t of all) {
    t.x = (HEX.CW - (HEX_LEGS - 1) * HEX.LEGW - 2 * HEX.S) / 2 + HEX.S + t.leg * HEX.LEGW;
    t.y = t.lane * HEX.LANEH + (t.leg % 2 ? HEX.LANEH / 2 : 0);
    t.lift = Math.round(rng() * 6);
    const scale = t.kind === 'boss' ? 1.08 : 1;
    const half = (HEX.LANEH / 2) * scale;
    const wall = HEX.WALL + Math.min(t.lift, 4) + (t.kind === 'boss' ? 6 : 0);
    minY = Math.min(minY, t.y - t.lift - half);
    maxY = Math.max(maxY, t.y + half + wall);
  }
  const pad = 42;
  const oy = (HEX.CH - (maxY - minY) - pad * 2) / 2 + pad - minY;
  for (const t of all) t.y += oy;

  // Normalize edges to ids (app navigation API).
  for (const t of all) {
    t.edges = t.next.map((n) => n.id);
  }

  // layers[leg] — sorted by lane, for strip-compat helpers / QA.
  const layers = [];
  for (let leg = 0; leg < HEX_LEGS; leg++) {
    layers.push(
      Object.values(grid[leg]).sort((a, b) => a.lane - b.lane),
    );
  }

  return {
    act: actIndex,
    spans,
    grid,
    all,
    layers,
    bossId: boss.id,
    top: Math.min(...all.map((t) => t.y - t.lift - HEX.LANEH / 2)),
  };
}

export function generateRunMap(ladderLength, seed = Date.now()) {
  const rng = mulberry32(seed >>> 0);
  const acts = [];
  for (let a = 0; a < ladderLength; a++) {
    acts.push(generateAct(a, rng));
  }
  return { seed: seed >>> 0, acts };
}

export function appendAct(map, actIndex) {
  const rng = mulberry32((map.seed + (actIndex + 1) * 9973) >>> 0);
  const act = generateAct(actIndex, rng);
  map.acts.push(act);
  return act;
}

export function allNodes(act) {
  return act.all || act.layers.flat();
}

export function nodeById(act, id) {
  return allNodes(act).find((n) => n.id === id) || null;
}

/** Fresh navigation: any sandlot tile on the left edge. */
export function startActNav(act) {
  const layer0 = (act.layers[0] || []).map((n) => n.id);
  return {
    act: act.act,
    visited: [],
    available: layer0,
    current: null,
    here: null,
  };
}

/** After completing `nodeId`, stand there and open the hexes it touches ahead. */
export function advanceNav(act, nav, nodeId) {
  const node = nodeById(act, nodeId);
  if (!node) return nav;
  const visited = [...new Set([...nav.visited, nodeId])];
  let available;
  if (node.kind === 'boss') {
    available = [];
  } else {
    available = (node.edges || []).filter((id) => !visited.includes(id));
  }
  return { ...nav, visited, available, current: null, here: nodeId };
}

/** Loss: reopen every hex that touches the boss. */
export function retryBossNav(act) {
  const boss = nodeById(act, act.bossId);
  const approaches = allNodes(act)
    .filter((n) => (n.edges || []).includes(act.bossId))
    .map((n) => n.id);
  const approachSet = new Set(approaches);
  const keepVisited = allNodes(act)
    .filter((n) => n.id !== act.bossId && !approachSet.has(n.id) && n.layer < (boss?.layer ?? 99))
    .map((n) => n.id);
  // Prefer keeping any already-cleared deep path; fall back to everything before approaches.
  const visited = keepVisited.length
    ? keepVisited
    : allNodes(act)
      .filter((n) => n.layer < (approaches[0] != null
        ? (nodeById(act, approaches[0])?.layer ?? boss.layer)
        : boss.layer))
      .map((n) => n.id);
  return {
    act: act.act,
    visited: [...new Set(visited)],
    available: approaches.length ? approaches : (act.layers[act.layers.length - 2] || []).map((n) => n.id),
    current: null,
    here: null,
  };
}

export function goldForNode(rung) {
  return ECONOMY.nodeGold(rung);
}

/** Reachability smoke: every node reachable from leg 0. */
export function assertActReachable(act) {
  const start = (act.layers[0] || []).map((n) => n.id);
  const seen = new Set(start);
  const q = [...start];
  while (q.length) {
    const id = q.shift();
    const n = nodeById(act, id);
    for (const e of n?.edges || []) {
      if (seen.has(e)) continue;
      seen.add(e);
      q.push(e);
    }
  }
  return allNodes(act).every((n) => seen.has(n.id));
}

/** Flat-top hex path `d` for SVG. */
export function hexPath(cx, cy, s) {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    d += `${i ? 'L' : 'M'}${(cx + s * Math.cos(a)).toFixed(1)} ${(cy + s * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

/** Extruded lower wall under a hex. */
export function hexWall(cx, cy, s, h) {
  const p = (k) => [
    cx + s * Math.cos((Math.PI / 180) * 60 * k),
    cy + s * Math.sin((Math.PI / 180) * 60 * k),
  ];
  const v = [p(3), p(2), p(1), p(0)];
  let d = `M${v.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}`;
  for (let i = v.length - 1; i >= 0; i--) {
    d += `L${v[i][0].toFixed(1)} ${(v[i][1] + h).toFixed(1)}`;
  }
  return `${d}Z`;
}
