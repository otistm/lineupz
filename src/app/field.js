/* =====================================================================
   THE DIAMOND — animated basepath tracker.

   The night's engine stays authoritative. This layer never decides
   anything: it reads the base state before and after a plate appearance
   and moves tokens to match, so what the eye follows can never drift
   from what was actually resolved.

   Runners are keyed by the batter object the engine carries from base to
   base, so a man who stops at second keeps the same token he had when he
   reached first.
   ===================================================================== */

const NS = 'http://www.w3.org/2000/svg';

/* Bag centres, in the 540x540 viewBox. Home at the bottom, 2nd at the top. */
const HOME = { x: 270, y: 460 };
const B1 = { x: 460, y: 270 };
const B2 = { x: 270, y: 80 };
const B3 = { x: 80, y: 270 };
const PTS = [HOME, B1, B2, B3, HOME]; // path position 0..4
const CENTER = { x: 270, y: 270 };

const BASE_MS = 370;  // travel time for one base at 1x
const STAGGER = 80;   // lead runner breaks first
const FADE_MS = 360;  // scored / retired tokens leaving the field
const CALL_MS = 1050; // the centre call-out

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Position along the basepath for a fractional base index. */
function posAt(p) {
  if (p <= 0 || p >= 4) return { x: HOME.x, y: HOME.y };
  const i = Math.floor(p);
  const t = p - i;
  const a = PTS[i];
  const b = PTS[i + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function svg(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

/** Ink for the centre call-out, by the weight of the call. */
const CALL_INK = { hit: '#FFB347', big: '#FFF0CE', out: '#E8503A' };

export function createField(root, opts = {}) {
  const runnerLayer = root.querySelector('#runnerLayer');
  const trailLayer = root.querySelector('#trailLayer');
  const callLayer = root.querySelector('#callLayer');
  /** Divisor shared with the night's pacing so runners never outlast a beat. */
  const rate = opts.rate || (() => 1);
  const reduced = !!opts.reduced;

  let runners = [];      // live tokens, lead-first order is not guaranteed
  let running = false;   // is the RAF loop mounted
  let onScore = null;    // fired the moment a token touches home

  /* ---------------- tokens ---------------- */

  function spawn(tok, num, startBase) {
    const g = svg('g', { class: 'runner' });
    // Amber disc against chalk bags — reads as a man, not another base.
    const halo = svg('circle', { r: 19, fill: 'rgba(255,179,71,.28)' });
    const disc = svg('circle', {
      r: 14, fill: '#FFB347', stroke: '#17140F', 'stroke-width': 2.5,
    });
    const label = svg('text', {
      'text-anchor': 'middle', y: 4.6, fill: '#17140F',
      'font-family': 'Big Shoulders Display, sans-serif',
      'font-size': 16, 'font-weight': 800,
    });
    label.textContent = num;
    g.append(halo, disc, label);
    runnerLayer.appendChild(g);

    const trail = svg('path', {
      fill: 'none', stroke: '#FFCE7A', 'stroke-width': 2.6,
      'stroke-dasharray': '3 6', 'stroke-linecap': 'round', opacity: 0,
    });
    trailLayer.appendChild(trail);

    const r = {
      tok, num, g, halo, disc, label, trail,
      base: startBase, pos: startBase, from: startBase, to: startBase,
      t0: 0, dur: 0, fate: null, settled: true, done: true, fadeStart: null,
    };
    place(r);
    runners.push(r);
    return r;
  }

  function place(r) {
    const p = posAt(r.pos);
    r.g.setAttribute('transform', `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`);
    if (r.pos > r.from + 0.02 && r.fadeStart === null) {
      const a = posAt(r.from);
      let d = `M ${a.x} ${a.y}`;
      for (let b = Math.ceil(r.from + 0.001); b < r.pos; b++) d += ` L ${PTS[b].x} ${PTS[b].y}`;
      d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      r.trail.setAttribute('d', d);
      r.trail.setAttribute('opacity', '.62');
    }
  }

  function retireLook(r) {
    r.disc.setAttribute('fill', 'transparent');
    r.disc.setAttribute('stroke', '#E8503A');
    r.label.setAttribute('fill', '#E8503A');
    r.halo.setAttribute('fill', 'rgba(232,80,58,.16)');
    r.trail.setAttribute('stroke', 'rgba(242,237,224,.35)');
  }

  function drop(r) {
    r.g.remove();
    r.trail.remove();
    const i = runners.indexOf(r);
    if (i >= 0) runners.splice(i, 1);
  }

  /* ---------------- the loop ---------------- */

  function loop(now) {
    let active = false;
    for (let i = runners.length - 1; i >= 0; i--) {
      const r = runners[i];
      if (r.done && r.fadeStart === null) continue;
      if (!r.done) {
        active = true;
        const e = (now - r.t0) / r.dur;
        if (e < 0) continue;
        const t = Math.min(1, e);
        r.pos = r.from + (r.to - r.from) * ease(t);
        place(r);
        if (t >= 1 && !r.settled) {
          r.settled = true;
          r.pos = r.to;
          place(r);
          if (r.fate === 'score') { if (onScore) onScore(r); r.fadeStart = now; }
          else if (r.fate === 'out') { retireLook(r); r.fadeStart = now; }
          else { r.base = r.to; r.done = true; r.trail.setAttribute('opacity', '0'); }
        }
      }
      if (r.fadeStart !== null) {
        active = true;
        const f = Math.min(1, (now - r.fadeStart) / (FADE_MS / rate()));
        r.g.setAttribute('opacity', (1 - f).toFixed(3));
        r.trail.setAttribute('opacity', ((1 - f) * 0.55).toFixed(3));
        if (f >= 1) drop(r);
      }
    }
    if (active) requestAnimationFrame(loop);
    else running = false;
  }

  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }

  /** Run every pending move straight to its end state — no frames.
      A man already fading is simply gone: his fate was settled when he
      got there, so he must never be counted a second time. */
  function settleAll() {
    for (let i = runners.length - 1; i >= 0; i--) {
      const r = runners[i];
      if (r.fadeStart !== null) { drop(r); continue; }
      if (r.done) continue;
      r.pos = r.to;
      r.settled = true;
      r.done = true;
      if (r.fate === 'score') { if (onScore) onScore(r); drop(r); }
      else if (r.fate === 'out') { drop(r); }
      else { r.base = r.to; place(r); r.trail.setAttribute('opacity', '0'); }
    }
  }

  function schedule(moves) {
    if (!moves.length) return;
    const now = performance.now();
    const k = rate();
    moves.forEach((m, i) => {
      const r = m.r;
      r.from = r.pos;
      r.to = m.to;
      r.fate = m.fate || null;
      r.settled = false;
      r.done = false;
      r.dur = Math.max(120, Math.abs(m.to - r.from) * BASE_MS) / k;
      r.t0 = now + (i * STAGGER) / k;
    });
    if (reduced) settleAll(); else start();
  }

  /* ---------------- centre call-out ---------------- */

  function shout(text, kind) {
    if (!text || reduced) return;
    callLayer.replaceChildren(); // one call at a time, whatever the speed
    const size = Math.min(62, 1200 / Math.max(3, text.length));
    const t = svg('text', {
      x: CENTER.x, y: CENTER.y + size * 0.34, 'text-anchor': 'middle',
      'font-family': 'Big Shoulders Display, sans-serif', 'font-weight': 800,
      'font-size': size.toFixed(1), 'letter-spacing': 2, opacity: 0,
      fill: CALL_INK[kind] || CALL_INK.hit,
    });
    t.textContent = text;
    callLayer.appendChild(t);
    const life = CALL_MS / rate();
    const t0 = performance.now();
    const step = (now) => {
      const e = (now - t0) / life;
      if (e >= 1) { t.remove(); return; }
      const o = e < 0.12 ? e / 0.12 : e > 0.72 ? (1 - e) / 0.28 : 1;
      const s = 1 + e * 0.1;
      t.setAttribute('opacity', (o * 0.9).toFixed(3));
      t.setAttribute('transform',
        `translate(${CENTER.x},${CENTER.y}) scale(${s.toFixed(3)}) translate(${-CENTER.x},${-CENTER.y})`);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- what main.js drives ---------------- */

  return {
    /** Empty the diamond outright — new night, new inning. */
    clear() {
      runners.forEach((r) => { r.g.remove(); r.trail.remove(); });
      runners = [];
      callLayer.replaceChildren();
    },

    /**
     * Move everyone to match the state the engine just produced.
     * Runners are matched by object identity; anyone missing from the
     * new state scored. The lead runner breaks first.
     */
    play({ before, after, batter, word, kind, score }) {
      onScore = score || null;
      settleAll();
      const moves = [];
      for (let i = 2; i >= 0; i--) {
        const tok = before[i];
        if (!tok) continue;
        let r = runners.find((x) => x.tok === tok);
        if (!r) r = spawn(tok, tok.spot || '', i + 1);
        const at = after.indexOf(tok);
        if (at >= 0) moves.push({ r, to: at + 1 });
        else moves.push({ r, to: 4, fate: 'score' });
      }
      const seat = after.indexOf(batter);
      const b = spawn(batter, batter.spot || '', 0);
      moves.push(seat >= 0 ? { r: b, to: seat + 1 } : { r: b, to: 4, fate: 'score' });
      schedule(moves);
      shout(word, kind);
    },

    /** He's retired: breaks up the line, called out short of the bag.
        He never gets first, so he can never crowd a man already standing there. */
    retire({ batter, word }) {
      onScore = null;
      settleAll();
      schedule([{ r: spawn(batter, batter.spot || '', 0), to: 0.62, fate: 'out' }]);
      shout(word, 'out');
    },

    /** Everyone left on base clears out at the end of a half. */
    strand() {
      settleAll();
      if (!runners.length) return;
      if (reduced) { this.clear(); return; }
      const now = performance.now();
      runners.forEach((r) => {
        if (r.fadeStart === null) { r.fadeStart = now; r.done = true; r.settled = true; }
      });
      start();
    },
  };
}
