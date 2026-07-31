import {
  HITTERS, GEAR, CHARMS, PITCHERS, TEAMS, ECONOMY, SETS, NODE_LABELS, EVENTS, LADDER_DEFS,
  UNLOCK_ORDER, buildLadder,
} from '../data/catalog.js';
import {
  ARCH_INFO,
  STATE_INFO,
  LINK_TYPES,
  INNING_CAP,
  boardSetup,
  battingOrder,
  stuffAgainst,
  modifiersFor,
  zoneOf,
  lookAt,
  stateOf,
  resolvePA,
  advanceRunners,
  sumCharmEffect,
} from '../engine/sim.js';
import {
  generateDraft,
  generateSponsors,
  sellPrice,
  canPlay,
  seatedCount,
  buyCost,
  isUpgrade,
  ownedByLineage,
} from '../engine/shop.js';
import {
  generateRunMap, appendAct, startActNav, advanceNav, retryBossNav, nodeById, goldForNode,
  allNodes, HEX, hexPath, hexWall,
} from '../engine/map.js';
import {
  applyEventEffect, claimFreeBatter, removeOwnedCard, settlePendingBet,
} from '../engine/events.js';
import {
  loadMeta, ladderForRun, unlockAfterBeat, nextPitcherAfter,
} from './meta.js';
import { createLinkField, LINK_COLOR } from './linkfield.js';
import { createField } from './field.js';
import { createNightIntro } from './nightIntro.js';

/* =================== plain language =================== */
const RESULT = {
  OUT: { word: 'OUT',      kind: 'out', tell: 'is out' },
  '1B': { word: 'SINGLE',  kind: 'hit', tell: 'singles' },
  '2B': { word: 'DOUBLE',  kind: 'hit', tell: 'doubles' },
  HR:  { word: 'HOME RUN', kind: 'hit', tell: 'HITS IT OUT' },
};
const STATE_BANNER = {
  LABORING: 'PITCHER IS LABORING',
  GASSED: 'PITCHER IS GASSED',
  BROKEN: 'PITCHER IS BROKEN',
};
const RULES_KEY = 'lineup.hideRules';

/** Post-pitch cause line — ability/state language, never duel math.
 *  info: { pit, e, state, seen, look, mods, damage } */
function tellFor(r, info) {
  const bits = [];
  const pit = info.pit || {};
  if (!r.reached) {
    if (r.softContact) bits.push('cutter eats soft contact');
    else if (pit.efficient) bits.push("outs don't cost the pitcher");
    else if (info.damage > 0) bits.push(`still costs the pitcher · −${info.damage}`);
    else if (info.state === 'FRESH') bits.push('the pitcher was Fresh');
    else bits.push('put away');
    if (info.seen > 0 && (pit.lookMul || 1) > 1) bits.push('the Book');
    else if (info.seen > 0) bits.push('the pitcher has seen this bat');
    else if (pit.linkTax && info.e?.linked) bits.push('link tax');
    else if (pit.topTax && info.state === 'FRESH' && info.e?.zone === 'TOP') bits.push('top of the order tax');
    else if (pit.muteCloser && info.state === 'FRESH' && info.e?.arch === 'CLOSER') bits.push('Closer muted');
  } else {
    if (r.stretch) bits.push('stretches it');
    else if (info.mods?.some((m) => m.key === 'SLUGGER')) bits.push('+3 STAM DMG');
    else if (info.mods?.some((m) => m.key === 'CLOSER')) bits.push('2 outs');
    else if (info.mods?.some((m) => m.key === 'PATIENT')) bits.push('first look');
    else if (info.mods?.some((m) => m.key === 'RALLY')) bits.push('runners on');
    else if (r.type === 'HR') bits.push('clears the yard');
    else if (r.type === '2B') bits.push('hard contact');
    else if (r.type === '1B') bits.push('puts it in play');
    if (info.damage > 0) bits.push(`−${info.damage}`);
    if (info.seen > 0 && bits.length < 2) {
      bits.push((pit.lookMul || 1) > 1 ? 'the Book' : info.look.label);
    }
  }
  return bits.slice(0, 2).join(' · ');
}

function showTell(card, text) {
  let el = card.querySelector('.tell');
  if (!el) {
    el = document.createElement('div');
    el.className = 'tell';
    card.appendChild(el);
  }
  el.textContent = text || '';
  el.classList.toggle('show', !!text);
  return el;
}

function clearTell(card) {
  const el = card?.querySelector('.tell');
  if (el) { el.classList.remove('show'); el.textContent = ''; }
}

/* =================== state =================== */
const byId = (id) => HITTERS.find((h) => h.id === id)
  || GEAR.find((g) => g.id === id)
  || CHARMS.find((c) => c.id === id);
const ladder = () => S.ladder || [];
const pitcherOf = (rung) => PITCHERS.find((p) => p.id === ladder()[rung]?.pitcher);

function setLabel(set) {
  return SETS[set]?.short || set || '';
}
function setCss(set) {
  return (set || 'BASE').toLowerCase().replace(/_/g, '-');
}

function refreshDraft() {
  S.draft = generateDraft(S.rung, S.owned);
}
function refreshSponsors() {
  S.sponsors = generateSponsors();
  S.chosenSponsor = null;
}

function freshRun(meta = loadMeta()) {
  const runLadder = ladderForRun(meta);
  const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const map = generateRunMap(runLadder.length, seed);
  const S0 = {
    lineup: Array(9).fill(null),
    gearMap: {},
    loose: [],
    owned: [],
    charms: [],
    draft: [],
    sponsors: [],
    chosenSponsor: null,
    gold: ECONOMY.startGold,
    lives: ECONOMY.startLives,
    rung: 0,
    ladder: runLadder,
    runSeed: seed,
    map,
    mapNav: startActNav(map.acts[0]),
    event: null,
    eventFollowup: null,
    pendingBet: null, // scrimmage stake — pays out only after tonight settles
    // title → map → draft|sponsors|event → dugout → playing → won|lost|champion|dead
    phase: 'title',
    playing: false,
    dealt: false,
    lastSnap: null,
  };
  return S0;
}
let S = freshRun();
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =================== audio =================== */
let AC = null;
const audio = {
  ready() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); },
  noise(dur, freq, q, gain, type) {
    if (!AC) return;
    const n = Math.max(1, Math.floor(AC.sampleRate * dur));
    const buf = AC.createBuffer(1, n, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = AC.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(AC.destination); src.start();
  },
  tone(freq, dur, gain, type, delay) {
    if (!AC) return;
    const t0 = AC.currentTime + (delay || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  cheer(big) {
    if (!AC) return;
    const dur = big ? 1.5 : 0.7, n = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, t * 1.6)) * Math.pow(1 - t, 0.6); }
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = big ? 900 : 700; f.Q.value = 0.55;
    const g = AC.createGain(); g.gain.value = big ? 0.34 : 0.16;
    src.connect(f).connect(g).connect(AC.destination); src.start();
  },
  snap() { this.noise(0.05, 2600, 4, 0.13); this.tone(140, 0.1, 0.17, 'triangle'); },
  lift() { this.tone(540, 0.05, 0.05, 'square'); },
  reject() { this.tone(92, 0.14, 0.11, 'sawtooth'); },
  crack() { this.noise(0.08, 1900, 1.2, 0.34); this.tone(220, 0.09, 0.12, 'triangle'); },
  whiff() { this.noise(0.14, 560, 0.7, 0.1, 'lowpass'); },
  homer() { this.crack(); this.cheer(true); [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 0.12, 'triangle', 0.1 + i * 0.09)); },
  groan(deep) { [220, 165, deep ? 98 : 131].forEach((f, i) => this.tone(f, 0.4, 0.1, 'sawtooth', i * 0.09)); },
  tick() { this.tone(1200, 0.012, 0.02, 'square'); },
  bell() { [880, 1108].forEach((f, i) => this.tone(f, 0.4, 0.08, 'sine', i * 0.06)); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 0.11, 'triangle', i * 0.11)); this.cheer(true); },
  lose() { [330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 0.11, 'sawtooth', i * 0.17)); },
  coin() { this.tone(880, 0.06, 0.07, 'square'); this.tone(1320, 0.08, 0.05, 'sine', 0.05); },
  spark(cold) {
    if (cold) { this.tone(430, 0.1, 0.045, 'triangle'); this.tone(300, 0.14, 0.035, 'sine', 0.06); return; }
    this.tone(700, 0.07, 0.05, 'triangle'); this.tone(1080, 0.1, 0.04, 'sine', 0.05);
  },
  rally(n) { const f = 440 * Math.pow(1.18, Math.min(6, n)); this.tone(f, 0.12, 0.06, 'triangle'); this.tone(f * 1.5, 0.14, 0.035, 'sine', 0.05); },
  windup() { this.tone(180, 0.5, 0.028, 'sawtooth'); },
};

/* =================== particles =================== */
const fxc = document.getElementById('fx'), fctx = fxc.getContext('2d');
let parts = [];
function sizeFx() { fxc.width = innerWidth * devicePixelRatio; fxc.height = innerHeight * devicePixelRatio; fctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
addEventListener('resize', sizeFx); sizeFx();
function burst(x, y, o) {
  if (REDUCED) return;
  o = Object.assign({ n: 14, spread: 2.6, up: 2.2, size: 3, life: 600, colors: ['#F2EDE0'], grav: 0.05 }, o);
  for (let i = 0; i < o.n; i++) {
    const a = Math.random() * Math.PI * 2, v = 0.4 + Math.random() * o.spread;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - Math.random() * o.up,
      s: o.size * (0.5 + Math.random()), r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
      born: performance.now(), life: o.life * (0.6 + Math.random() * 0.7),
      c: o.colors[Math.floor(Math.random() * o.colors.length)], grav: o.grav });
  }
}
let rings = [], balls = [];
/** Expanding contact ring — reads as impact without hiding the card. */
function ring(x, y, o) {
  if (REDUCED) return;
  o = Object.assign({ r0: 10, r1: 130, life: 620, c: '255,179,71', w: 4 }, o);
  rings.push({ x, y, born: performance.now(), ...o });
}
/** A batted ball that actually leaves the card — bigger hit, bigger arc. */
function ballArc(el, power) {
  if (REDUCED) return;
  const c = ctr(el);
  const dir = Math.random() < 0.5 ? -1 : 1;
  balls.push({
    x: c.x, y: c.y - 10,
    vx: dir * (1.4 + power * 1.5) * (0.8 + Math.random() * 0.5),
    vy: -(5.4 + power * 2.1),
    grav: 0.15, s: 3.2 + power * 0.5,
    born: performance.now(), life: 640 + power * 320, trail: 0,
  });
}

function fxLoop(now) {
  fctx.clearRect(0, 0, innerWidth, innerHeight);

  rings = rings.filter((g) => now - g.born < g.life);
  for (const g of rings) {
    const k = (now - g.born) / g.life, e = 1 - Math.pow(1 - k, 3);
    fctx.save();
    fctx.strokeStyle = `rgba(${g.c},${(1 - k) * 0.85})`;
    fctx.lineWidth = g.w * (1 - k * 0.7);
    fctx.beginPath(); fctx.arc(g.x, g.y, g.r0 + (g.r1 - g.r0) * e, 0, Math.PI * 2); fctx.stroke();
    fctx.restore();
  }

  balls = balls.filter((b) => now - b.born < b.life);
  for (const b of balls) {
    b.x += b.vx; b.y += b.vy; b.vy += b.grav;
    if (++b.trail % 2 === 0) burst(b.x, b.y, { n: 1, spread: 0.5, up: 0, size: 2, life: 340, colors: ['#FFF0CE'], grav: 0.02 });
    const k = (now - b.born) / b.life;
    fctx.save();
    fctx.globalAlpha = Math.max(0, 1 - k * k);
    fctx.fillStyle = '#FFF7E4';
    fctx.shadowColor = 'rgba(255,206,122,.95)'; fctx.shadowBlur = 16;
    fctx.beginPath(); fctx.arc(b.x, b.y, b.s, 0, Math.PI * 2); fctx.fill();
    fctx.restore();
  }

  parts = parts.filter((p) => now - p.born < p.life);
  for (const p of parts) {
    const k = (now - p.born) / p.life;
    p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.r += p.vr;
    fctx.save(); fctx.globalAlpha = 1 - k; fctx.translate(p.x, p.y); fctx.rotate(p.r);
    fctx.fillStyle = p.c; fctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7); fctx.restore();
  }
  requestAnimationFrame(fxLoop);
}
requestAnimationFrame(fxLoop);
const ctr = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const chalkPuff = (el) => { const c = ctr(el); burst(c.x, c.y, { n: 12, colors: ['#F2EDE0', '#D9D2C0'], size: 3, life: 520 }); };
const dirtPuff = (el) => { const c = ctr(el); burst(c.x, c.y + 14, { n: 10, colors: ['#B4764A', '#8C5836'], size: 3.4, up: 1.4, life: 480 }); };
/** Dust when a card lands in a lineup slot. */
const dustDrop = (el) => {
  if (!el || REDUCED) return;
  const c = ctr(el);
  burst(c.x, c.y + 20, { n: 18, colors: ['#C4A574', '#8C5836', '#E8DCC4', '#B4764A'], size: 3.8, up: 2.2, spread: 3.2, life: 620, grav: 0.08 });
  burst(c.x, c.y + 8, { n: 8, colors: ['#F2EDE0', '#D9D2C0'], size: 2.4, up: 1.2, life: 420 });
};

/** Fly gold chips between a source element and the wallet. dir: -1 spend (out of stash), +1 earn (into stash). */
function goldFly(amount, otherEl, dir = -1) {
  if (REDUCED || !amount) return;
  const wallet = $('#gold');
  if (!wallet) return;
  const w = ctr(wallet);
  const o = otherEl ? ctr(otherEl) : w;
  // Buy: stash → card. Sell: card → stash.
  const x0 = dir < 0 ? w.x : o.x;
  const y0 = dir < 0 ? w.y : o.y;
  const x1 = dir < 0 ? o.x : w.x;
  const y1 = dir < 0 ? o.y : w.y;
  const n = Math.min(8, Math.max(3, Math.abs(amount)));
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'gold-fly';
    el.innerHTML = '<span class="gold-ico"></span>';
    el.style.left = `${x0 + (Math.random() - 0.5) * 10}px`;
    el.style.top = `${y0 + (Math.random() - 0.5) * 10}px`;
    document.body.appendChild(el);
    const delay = i * 40;
    requestAnimationFrame(() => {
      el.style.transition = `transform 480ms cubic-bezier(.22,1,.36,1) ${delay}ms, opacity 480ms ease ${delay}ms`;
      el.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) scale(.7)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 700 + delay);
  }
  wallet.classList.remove('gold-pulse');
  void wallet.offsetWidth;
  wallet.classList.add('gold-pulse');
}
function fireworks(el) {
  const c = ctr(el);
  burst(c.x, c.y, { n: 46, colors: ['#FFB347', '#FFCE7A', '#F2EDE0', '#E8503A'], size: 4, spread: 4.4, up: 3.4, life: 1150, grav: 0.06 });
  setTimeout(() => burst(c.x, c.y - 70, { n: 28, colors: ['#FFB347', '#FFCE7A'], size: 3.4, spread: 3.4, life: 900 }), 170);
}
function confetti() {
  if (REDUCED) return;
  for (let i = 0; i < 3; i++) setTimeout(() => burst(innerWidth * (0.25 + i * 0.25), innerHeight * 0.32,
    { n: 40, colors: ['#5ED89A', '#FFB347', '#F2EDE0', '#78B7FF'], size: 5, spread: 4.6, up: 4, life: 1500, grav: 0.08 }), i * 160);
}
function shake() { if (REDUCED) return; document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }

/* =================== the synergy field ===================
   Every link is drawn as a live rope between the two cards, so a good sequence
   is something you can see before a single pitch is thrown. */
const linkField = createLinkField(document.getElementById('linkfx'), { reduced: REDUCED });
const WRAP_STRIP = 64; // the cable tray under the order, where every rope runs
let linkRopes = []; // parallel to the field's groups: which link each rope is

/* Ropes drop out of the giver's card, run along a lane under the board, and climb
   into the batter they help. Longest spans take the lowest lane so nothing crosses. */
function syncLinkField() {
  if (!linkField.ok) return;
  const board = $('#board'), canvas = $('#linkfx');
  if (!board || !canvas) return;
  const { links } = boardSetup(S.lineup, S.gearMap, S.charms);
  canvas.style.height = `${board.offsetHeight + WRAP_STRIP}px`;
  linkField.resize();

  const cardOf = (slot) => document.querySelector(`.pc[data-slot="${slot}"]`);
  const span = (l) => (l.to > l.from ? l.to - l.from : 9 + l.to - l.from);
  const sorted = [...links]
    .map((l) => ({ l, span: span(l) }))
    .sort((x, y) => y.span - x.span);

  const ropes = [];
  linkRopes = [];
  const laneSpans = []; // x-intervals already used, per lane
  const maxRopes = Math.floor(linkField.MAX_SEG / 3);
  for (const { l } of sorted) {
    if (ropes.length >= maxRopes) break;
    const a = cardOf(l.from), b = cardOf(l.to);
    if (!a || !b) continue;
    const ax = a.offsetLeft + a.offsetWidth * 0.5;
    const bx = b.offsetLeft + b.offsetWidth * 0.5;
    const lo = Math.min(ax, bx) - 8, hi = Math.max(ax, bx) + 8;
    let lane = laneSpans.findIndex((used) => used.every((s) => hi < s[0] || lo > s[1]));
    if (lane < 0) { lane = laneSpans.length; laneSpans.push([]); }
    laneSpans[lane].push([lo, hi]);
    const laneY = board.offsetHeight + 18 + (lane % 4) * 13;
    const top = board.offsetHeight - 8; // starts under the card, so it reads as plugged in
    ropes.push({ pts: [[ax, top], [ax, laneY], [bx, laneY], [bx, top]], color: LINK_COLOR[l.type] });
    linkRopes.push(l);
  }
  linkField.setLinks(ropes);
}
const scheduleLinkSync = () => requestAnimationFrame(() => requestAnimationFrame(syncLinkField));
addEventListener('resize', scheduleLinkSync);

/** Light up every rope feeding this spot, and thump the chips that made it. */
function fireLinksInto(slot) {
  const hit = [];
  linkRopes.forEach((l, i) => {
    if (l.to !== slot) return;
    linkField.flash(i, 1.3);
    hit.push(i);
    const chip = document.querySelector(`.linkchip[data-link="${l.from}-${l.to}-${l.type}"]`);
    if (chip) { chip.classList.remove('fire'); void chip.offsetWidth; chip.classList.add('fire'); }
  });
  return hit;
}

/* =================== draft / sponsor helpers =================== */
/** Lineup / roster / rack edits — any stop before the night starts. */
function setupPhaseOk() {
  return !S.playing && ['map', 'event', 'draft', 'sponsors', 'dugout'].includes(S.phase);
}
function assembleOk() {
  return setupPhaseOk();
}
function draftPhaseOk() {
  return S.phase === 'draft' && !S.playing;
}
function sponsorPhaseOk() {
  return S.phase === 'sponsors' && !S.playing;
}

/** Remap owned/lineup/gear when upgrading a lineage to a higher set. */
function upgradeCard(oldId, newCard) {
  if (S.gearMap[oldId]) {
    const kept = [];
    let used = 0;
    for (const g of S.gearMap[oldId]) {
      if (used + g.w <= newCard.cap) { kept.push(g); used += g.w; }
      else S.loose.push(g); // spill if the new version has less socket room
    }
    if (kept.length) S.gearMap[newCard.id] = kept;
    delete S.gearMap[oldId];
  }
  const slot = S.lineup.findIndex((x) => x && x.id === oldId);
  if (slot >= 0) S.lineup[slot] = newCard;
  S.owned = S.owned.filter((id) => id !== oldId);
  if (!S.owned.includes(newCard.id)) S.owned.push(newCard.id);
}

/** Buy a draft batter (new lineage or upgrade). Optional seat index to drop into the order. */
function buyDraft(idx, { silent = false, seat = null, fromEl = null } = {}) {
  if (!draftPhaseOk()) return false;
  const offer = S.draft[idx];
  if (!offer) return false;
  const card = byId(offer.id);
  if (!card) return false;
  const cost = buyCost(card, S.owned);
  if (!Number.isFinite(cost) || S.gold < cost) { audio.reject(); return false; }
  if (isUpgrade(card, S.owned)) {
    const have = ownedByLineage(S.owned).get(card.lineage);
    upgradeCard(have.id, card);
    if (seat != null && seat >= 0 && seat < 9) {
      const occ = S.lineup[seat];
      const here = S.lineup.findIndex((x) => x && x.id === card.id);
      if (here >= 0 && here !== seat) S.lineup[here] = occ || null;
      else if (occ && occ.id !== card.id) { /* bump occupant off the board, keep owned */ }
      S.lineup[seat] = card;
    }
  } else {
    if (S.owned.includes(offer.id)) { audio.reject(); return false; }
    if (ownedByLineage(S.owned).has(card.lineage)) { audio.reject(); return false; }
    S.owned.push(offer.id);
    if (seat != null && seat >= 0 && seat < 9) {
      S.lineup[seat] = card;
    }
  }
  S.gold -= cost;
  // The card leaves the draft row entirely — it now lives on the roster.
  S.draft.splice(idx, 1);
  audio.coin();
  goldFly(cost, fromEl, -1);
  if (!silent) { S.dealt = true; renderWallet(); renderBoard(); renderMarket(); renderTray(); updatePlayButton(); }
  return true;
}

/** Buy gear from the chosen sponsor's offer list. `equipTo` bolts it onto that batter. */
function buySponsorGear(spIdx, offerIdx, { silent = false, fromEl = null, equipTo = null } = {}) {
  if (!sponsorPhaseOk() || !S.chosenSponsor) return false;
  const sp = S.sponsors[spIdx];
  if (!sp || sp.id !== S.chosenSponsor) { audio.reject(); return false; }
  const offer = sp.offers[offerIdx];
  if (!offer) return false;
  if (S.gold < offer.cost) { audio.reject(); return false; }
  const item = byId(offer.id);
  if (equipTo) {
    S.gearMap[equipTo] = [...(S.gearMap[equipTo] || []), item];
    S.lastSnap = item.id;
  } else {
    S.loose.push(item);
  }
  S.gold -= offer.cost;
  // The gear leaves the shelf — it is on the rack or on a batter now.
  sp.offers.splice(offerIdx, 1);
  audio.coin();
  goldFly(offer.cost, fromEl, -1);
  if (!silent) { renderWallet(); renderBoard(); renderMarket(); renderTray(); updatePlayButton(); }
  return true;
}

/** Sell owned batter. Returns { ok, price } or null. */
function sellBatter(id, { silent = false } = {}) {
  if (S.playing) return null;
  // Never allow an empty roster — that soft-locks the dugout with no path back to draft.
  if (S.owned.length <= 1) { audio.reject(); return null; }
  const p = byId(id);
  if (!p || !S.owned.includes(id)) return null;
  const slot = S.lineup.findIndex((x) => x && x.id === id);
  if (slot >= 0) {
    for (const g of S.gearMap[id] || []) S.loose.push(g);
    delete S.gearMap[id];
    S.lineup[slot] = null;
  }
  S.owned = S.owned.filter((x) => x !== id);
  const price = sellPrice(p);
  S.gold += price;
  audio.coin();
  goldFly(price, document.querySelector(`[data-drag-player="${id}"]`) || $('#bench-tray'), +1);
  if (!silent) { S.dealt = true; renderAll(); }
  return { ok: true, price };
}

/** Sell one loose gear piece by id. */
function sellLooseGear(id, { silent = false } = {}) {
  if (S.playing || S.phase === 'playing') return null;
  const i = S.loose.findIndex((g) => g.id === id);
  if (i < 0) return null;
  const from = document.querySelector(`[data-sell-gear="${id}"]`)?.closest('.gitem') || $('#gear-tray');
  const [g] = S.loose.splice(i, 1);
  const price = sellPrice(g);
  S.gold += price;
  audio.coin();
  goldFly(price, from, +1);
  if (!silent) { renderWallet(); renderTray(); renderMarket(); }
  return { ok: true, price, gear: g };
}

/** Sell equipped gear (from a batter track). */
function sellEquippedGear(pid, gid, { silent = false } = {}) {
  if (S.playing || S.phase === 'playing') return null;
  const eq = S.gearMap[pid] || [];
  const i = eq.findIndex((g) => g.id === gid);
  if (i < 0) return null;
  const from = document.querySelector(`[data-gear="${gid}"][data-from="${pid}"]`) || $(`.pc[data-player="${pid}"]`);
  const [g] = eq.splice(i, 1);
  if (!eq.length) delete S.gearMap[pid];
  else S.gearMap[pid] = eq;
  const price = sellPrice(g);
  S.gold += price;
  audio.coin();
  goldFly(price, from, +1);
  if (!silent) { renderWallet(); renderBoard(); renderTray(); renderMarket(); }
  return { ok: true, price, gear: g };
}

function rerollDraft() {
  if (!draftPhaseOk()) return;
  if (S.gold < ECONOMY.rerollCost) { audio.reject(); return; }
  S.gold -= ECONOMY.rerollCost;
  refreshDraft();
  audio.snap();
  renderWallet(); renderMarket();
}

function enterTitlePhase() {
  S = freshRun();
  S.phase = 'title';
  $('#verdict').className = 'verdict';
  clearResults();
  $('#summary').textContent = '';
  updatePlayButton();
  renderAll();
}

const nightIntro = createNightIntro(
  document.getElementById('night-intro'),
  document.getElementById('night-intro-gl'),
);

async function showNightIntro() {
  const el = $('#night-intro');
  const nightEl = $('#night-intro-night');
  const pitEl = $('#night-intro-pit');
  const pit = pitcherOf(S.rung);
  if (!el || !nightEl || !pitEl || !pit) return;
  const n = S.rung + 1;
  const kick = `NIGHT ${n}`;
  const name = pit.n;
  nightEl.textContent = kick;
  pitEl.textContent = name;
  el.setAttribute('aria-hidden', 'false');
  el.classList.remove('out');
  void el.offsetWidth;

  const useGl = !REDUCED && nightIntro.ok;
  el.classList.toggle('gl', useGl);
  el.classList.add('on');
  audio.bell();

  if (useGl) {
    // Stadium-lights hold; Speed / turbo must not skip it.
    await nightIntro.play({ kick, name });
  } else {
    await wait(REDUCED ? 700 : 2400);
  }

  // Soft dissolve so the map eases in under the plate (not a hard cut).
  void el.offsetWidth;
  el.classList.add('out');
  el.classList.remove('on');
  await wait(REDUCED ? 220 : 780);
  el.classList.remove('out', 'gl');
  el.setAttribute('aria-hidden', 'true');
  nightIntro.stop();
}

async function startNewRun() {
  S = freshRun();
  S.phase = 'map';
  S.mapNav = startActNav(S.map.acts[0]);
  $('#verdict').className = 'verdict';
  clearResults();
  $('#summary').textContent = '';
  // Arm the night card before paint so the map never peeks under it.
  const intro = showNightIntro();
  updatePlayButton();
  renderAll();
  await intro;
}

function enterMapPhase({ clearVerdict = true } = {}) {
  S.phase = 'map';
  S.event = null;
  S.eventFollowup = null;
  S.chosenSponsor = null;
  if (clearVerdict) {
    $('#verdict').className = 'verdict';
    clearResults();
    $('#summary').textContent = '';
  }
  updatePlayButton();
  renderAll();
}

function enterDraftPhase() {
  S.phase = 'draft';
  S.chosenSponsor = null;
  refreshDraft();
  $('#verdict').className = 'verdict';
  clearResults();
  $('#summary').textContent = '';
  updatePlayButton();
  renderAll();
}

function enterSponsorsPhase() {
  S.phase = 'sponsors';
  refreshSponsors();
  updatePlayButton();
  renderAll();
}

function enterEventPhase(eventId) {
  const ev = EVENTS.find((e) => e.id === eventId) || EVENTS[Math.floor(Math.random() * EVENTS.length)];
  S.phase = 'event';
  S.event = ev;
  S.eventFollowup = null;
  updatePlayButton();
  renderAll();
}

function enterDugoutPhase() {
  S.phase = 'dugout';
  S.dealt = false;
  clearResults(); // zeros scoreboard / bases; stamina full; Warming up via render
  updatePlayButton();
  renderAll();
}

function finishMapNode(nodeId) {
  const act = S.map.acts[S.rung];
  S.mapNav = advanceNav(act, S.mapNav, nodeId);
  enterMapPhase();
}

function selectMapNode(nodeId) {
  const act = S.map.acts[S.rung];
  const node = nodeById(act, nodeId);
  if (!node || !S.mapNav.available.includes(nodeId)) { audio.reject(); return; }
  S.mapNav = { ...S.mapNav, current: nodeId };
  if (node.kind === 'draft') {
    enterDraftPhase();
    audio.bell();
    return;
  }
  if (node.kind === 'sponsors') {
    enterSponsorsPhase();
    audio.bell();
    return;
  }
  if (node.kind === 'gold') {
    const pay = goldForNode(S.rung);
    S.gold += pay;
    audio.coin();
    finishMapNode(nodeId);
    return;
  }
  if (node.kind === 'event') {
    const pool = EVENTS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    enterEventPhase(pick.id);
    audio.bell();
    return;
  }
  if (node.kind === 'boss') {
    // Stay on this node until the night resolves.
    enterDugoutPhase();
    audio.bell();
  }
}

/* =================== render =================== */
const $ = (s) => document.querySelector(s);
const sign = (v) => `${v > 0 ? '+' : ''}${v}`;
/* Every number is named for what it does: POW is shown as STAM DMG everywhere. */
const KEY_LBL = { HIT: 'HIT', POW: 'STAM DMG' };
/* Gear tags stay short; outs get spelled out so "+1 OUT" never reads as handing him an out. */
const modStr = (g) => Object.entries(g.mods)
  .map(([k, v]) => (k === 'OUT' ? `OUTS COST PITCHER ${sign(v)}` : `${sign(v)} ${KEY_LBL[k] || k}`)).join('  ');
const modLong = (g) => Object.entries(g.mods)
  .map(([k, v]) => (k === 'OUT' ? `outs cost the pitcher ${sign(v)}` : `${sign(v)} ${KEY_LBL[k] || k}`)).join(', ');

/** One-line gimmick the player shops against — ability language, not numbers. */
function gimmickLine(p) {
  return p.note || 'No tricks — just a tank to empty.';
}

function renderWallet() {
  $('#gold').textContent = S.gold;
  $('#gold').classList.toggle('low', S.gold < 2);
  $('#lives').textContent = S.lives;
  $('#lives').classList.toggle('low', S.lives <= 1);
}

/** Which swap-panel is on stage for this phase (map ↔ draft/sponsors/event). */
function stagePanelKey(phase = S.phase) {
  if (phase === 'map') return 'map';
  if (phase === 'draft' || phase === 'sponsors') return 'market';
  if (phase === 'event') return 'event';
  return null;
}

function stagePanelEl(key) {
  if (key === 'map') return $('#path-map');
  if (key === 'market') return $('#market');
  if (key === 'event') return $('#event-panel');
  return null;
}

let activeStageKey = null;
let stageTransit = 0;
const STAGE_MS = 380;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
}

function snapStagePanel(key) {
  stageTransit += 1;
  for (const k of ['map', 'market', 'event']) {
    const el = stagePanelEl(k);
    if (!el) continue;
    el.classList.remove('is-exit', 'is-enter');
    el.classList.toggle('hidden', k !== key);
  }
  activeStageKey = key;
}

function revealStagePanel(el) {
  if (!el) return;
  el.classList.remove('hidden', 'is-exit');
  if (prefersReducedMotion()) {
    el.classList.remove('is-enter');
    return;
  }
  el.classList.add('is-enter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.remove('is-enter'));
  });
}

/** Fade map ↔ location panels instead of hard-cutting display. */
function syncStagePanels(nextKey) {
  if (nextKey === activeStageKey) {
    // Same panel (e.g. still market) — ensure it's visible after a cancelled transit.
    const el = stagePanelEl(nextKey);
    if (el && el.classList.contains('hidden') && !el.classList.contains('is-exit')) {
      el.classList.remove('hidden');
    }
    return;
  }

  const prevKey = activeStageKey;
  const prev = stagePanelEl(prevKey);
  const next = stagePanelEl(nextKey);

  if (prefersReducedMotion() || !prev || prev.classList.contains('hidden')) {
    snapStagePanel(nextKey);
    if (next) revealStagePanel(next);
    return;
  }

  const token = ++stageTransit;
  activeStageKey = nextKey;
  prev.classList.add('is-exit');
  prev.classList.remove('is-enter');

  const finish = () => {
    if (token !== stageTransit) return;
    prev.classList.add('hidden');
    prev.classList.remove('is-exit');
    // Hide any other stage panels that aren't the target.
    for (const k of ['map', 'market', 'event']) {
      if (k === nextKey || k === prevKey) continue;
      const other = stagePanelEl(k);
      other?.classList.add('hidden');
      other?.classList.remove('is-exit', 'is-enter');
    }
    revealStagePanel(next);
  };

  const onEnd = (e) => {
    if (e.target !== prev || (e.propertyName && e.propertyName !== 'opacity')) return;
    prev.removeEventListener('transitionend', onEnd);
    clearTimeout(failSafe);
    finish();
  };
  prev.addEventListener('transitionend', onEnd);
  const failSafe = setTimeout(() => {
    prev.removeEventListener('transitionend', onEnd);
    finish();
  }, STAGE_MS);
}

function renderPhaseChrome() {
  document.body.dataset.phase = S.phase;
  const draft = $('#draft');
  const sponsors = $('#sponsors');
  const dugout = $('#dugout');
  const title = $('#title-screen');
  draft?.classList.toggle('hidden', S.phase !== 'draft');
  sponsors?.classList.toggle('hidden', S.phase !== 'sponsors');
  title?.classList.toggle('hidden', S.phase !== 'title');
  syncStagePanels(stagePanelKey(S.phase));
  // Board stays live while shopping: draft cards drop into the order and
  // sponsor gear drops straight onto a batter.
  $('#board-wrap')?.classList.remove('locked');
  // The field only takes the stage for the night itself.
  const sb = $('#scoreboard');
  const live = S.playing || ['playing', 'won', 'lost'].includes(S.phase);
  if (sb) {
    const wasHidden = sb.classList.contains('hidden');
    sb.classList.toggle('hidden', !live);
    sb.classList.toggle('live', live && wasHidden);
  }
  dugout?.classList.toggle('assemble', setupPhaseOk());
  // Setup chrome leaves the stage for the night: rack/roster, how-it-works, phases.
  const nightOn = S.playing || ['playing', 'won', 'lost', 'champion', 'dead'].includes(S.phase);
  // Keep dugout visible on map/event so roster/charms stay in view; hide only on title/night.
  if (S.phase === 'map' || S.phase === 'event' || S.phase === 'draft' || S.phase === 'sponsors' || S.phase === 'dugout') {
    dugout?.classList.remove('hidden');
  }
  if (S.phase === 'title' || nightOn) dugout?.classList.add('hidden');
  document.querySelector('.top-row')?.classList.toggle('hidden', S.phase === 'title' || nightOn);
  document.querySelector('.topbar')?.classList.toggle('hidden', S.phase === 'title');
  $('#board-wrap')?.classList.toggle('hidden', S.phase === 'title');
}

/** Lineages the current draft can upgrade — used to pair shop and lineup cards. */
function upgradeableLineages() {
  const out = new Set();
  if (S.phase !== 'draft') return out;
  for (const o of S.draft) {
    const c = byId(o.id);
    if (c && isUpgrade(c, S.owned)) out.add(c.lineage);
  }
  return out;
}
const UP_CHEV = '<span class="up-chev" aria-hidden="true"></span>';

function tipAttr(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Arch chip with hover tip for the full ability. */
function archTag(arch) {
  const info = ARCH_INFO[arch] || { label: arch, ability: '' };
  return `<span class="arch a-${arch}" data-tip="${tipAttr(info.ability)}" tabindex="0">${info.label}</span>`;
}

/** Body-level tip so card stacking can't cover it. */
function tipEl() {
  let el = $('#game-tip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'game-tip';
    el.className = 'game-tip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
  }
  return el;
}

function showTip(anchor, text) {
  if (!anchor || !text) return;
  const tip = tipEl();
  tip.textContent = text;
  tip.classList.add('on');
  const r = anchor.getBoundingClientRect();
  const pad = 10;
  // Measure after show (opacity alone keeps layout).
  const tw = tip.offsetWidth || 200;
  const th = tip.offsetHeight || 48;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.top - th - pad;
  if (y < 8) y = r.bottom + pad;
  x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function hideTip() {
  $('#game-tip')?.classList.remove('on');
}

function initTips() {
  let host = null;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || el === host) return;
    host = el;
    showTip(el, el.getAttribute('data-tip'));
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || el !== host) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    host = null;
    hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) return;
    host = el;
    showTip(el, el.getAttribute('data-tip'));
  });
  document.addEventListener('focusout', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || el !== host) return;
    host = null;
    hideTip();
  });
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
}

function renderDraft() {
  const reroll = $('#reroll');
  if (reroll) {
    reroll.innerHTML = `Reroll · <span class="gold-ico"></span>${ECONOMY.rerollCost}`;
    reroll.disabled = S.gold < ECONOMY.rerollCost;
  }
  const row = $('#draft-row');
  if (!row) return;
  row.innerHTML = S.draft.map((o, i) => {
    const item = byId(o.id);
    const cost = buyCost(item, S.owned);
    // Infinite cost = a set you already match or beat, so there is nothing to buy.
    const locked = !Number.isFinite(cost);
    const afford = !locked && S.gold >= cost;
    // Live check: ownership shifts as you buy, so the badge can't come from generation time.
    const isUp = !locked && isUpgrade(item, S.owned);
    const cls = [
      'pc', 'draft-pc',
      locked ? 'locked' : afford ? '' : 'cant',
      isUp ? 'upgrade' : '',
      `set-${setCss(item.set)}`,
    ].filter(Boolean).join(' ');
    const drag = locked ? '' : `data-draft="${i}"`;
    return `<div class="${cls}" data-flip="d:${o.uid || o.id}" ${drag}>
      ${isUp ? UP_CHEV : ''}
      <div class="pc-head">
        <span class="set-badge s-${setCss(item.set)}">${setLabel(item.set)}</span>
        ${archTag(item.arch)}
      </div>
      <div class="pc-body">
        <div class="pname">${item.n}</div>
        <div class="pmeta">${item.y} · ${item.team}${isUp ? ' · Upgrade' : ''}</div>
        <div class="bignums">
          <div class="bignum k-HIT"><span class="bn-lbl">HIT</span><span class="bn-v">${item.HIT}</span></div>
          <div class="bignum k-POW"><span class="bn-lbl">STAM DMG</span><span class="bn-v">${item.POW}</span></div>
        </div>
        <div class="prole">${ARCH_INFO[item.arch].role}</div>
        <div class="pc-cost-row ${afford ? 'afford' : ''}">${locked ? 'Owned' : `<span class="gold-ico"></span>${cost}`}</div>
      </div>
      <div class="stamp"></div>
      <div class="tell"></div>
      <div class="countbar"><i></i></div>
    </div>`;
  }).join('');
}

function renderSponsors() {
  const live = $('#sponsor-gold-live');
  if (live) live.innerHTML = `<span class="gold-ico"></span>${S.gold}`;
  const hint = $('#sponsor-hint');
  if (hint) {
    hint.textContent = S.chosenSponsor
      ? 'Buy what you need, then return to the map.'
      : 'Three shops — pick one for gear, or continue without.';
  }
  const trio = $('#sponsor-trio');
  if (!trio) return;
  trio.innerHTML = S.sponsors.map((sp, si) => {
    const chosen = S.chosenSponsor === sp.id;
    const closed = S.chosenSponsor && !chosen;
    const offers = sp.offers.map((o, oi) => {
      const item = byId(o.id);
      const afford = S.gold >= o.cost;
      const cls = !chosen ? 'locked' : afford ? '' : 'cant';
      const data = chosen ? `data-sponsor-offer="${si}:${oi}"` : '';
      return `<div class="shop-card gear-card ${cls}" data-flip="s:${o.uid || `${sp.id}:${o.id}`}" ${data}>
        <span class="sc-kind">gear · w${item.w}</span>
        <span class="sc-name">${item.n}</span>
        <span class="sc-meta">${modLong(item)}</span>
        <span class="sc-cost ${afford && chosen ? 'afford' : ''}"><span class="gold-ico"></span>${o.cost}</span>
      </div>`;
    }).join('');
    return `<div class="sponsor-panel ${chosen ? 'chosen' : ''} ${closed ? 'closed' : ''}" data-sponsor="${sp.id}">
      <button type="button" class="sponsor-pick" data-pick-sponsor="${sp.id}" ${S.chosenSponsor && !chosen ? 'disabled' : ''}>
        <span class="sp-name">${sp.n}</span>
        <span class="sp-blurb">${sp.blurb}</span>
        <span class="sp-cta">${chosen ? 'Your shop' : closed ? 'Closed' : 'Choose'}</span>
      </button>
      <div class="sponsor-offers">${offers}</div>
    </div>`;
  }).join('');
}

function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return `#${(1 << 24 | ch(16) << 16 | ch(8) << 8 | ch(0)).toString(16).slice(1)}`;
}

function hexTileState(t) {
  if (S.mapNav?.here === t.id || S.mapNav?.current === t.id) return 'here';
  if (S.mapNav?.available?.includes(t.id)) return 'open';
  if (S.mapNav?.visited?.includes(t.id)) return 'visited';
  return 'locked';
}

function hexPeekBlurb(t, r) {
  const meta = NODE_LABELS[t.kind] || { blurb: '' };
  if (t.kind === 'gold') return `Take +${goldForNode(S.rung)}g and keep walking.`;
  if (t.kind === 'boss') {
    const pit = PITCHERS.find((p) => p.id === r?.pitcher);
    return pit
      ? `Face ${pit.n}. Score ${r.target}+ runs in three innings.`
      : meta.blurb;
  }
  return meta.blurb;
}

function showHexPeek(id) {
  const act = S.map?.acts[S.rung];
  const t = act && nodeById(act, id);
  const peek = $('#hex-peek');
  const stage = $('#hex-stage');
  if (!t || !peek || !stage) return;
  const r = ladder()[S.rung];
  const meta = NODE_LABELS[t.kind] || { label: t.kind, color: '#F2EDE0' };
  const st = hexTileState(t);
  const eye = {
    here: 'You are here',
    visited: 'Already played',
  }[st];
  peek.innerHTML = `${eye ? `<div class="eye">${eye}</div>` : ''}
    <h3 style="color:${meta.color === '#F2EDE0' ? 'var(--ink)' : meta.color}">${meta.label}</h3>
    <p>${hexPeekBlurb(t, r)}</p>`;
  peek.style.boxShadow = `0 4px 0 ${meta.color}, 0 14px 28px rgba(0,0,0,.45)`;

  const face = document.querySelector(`.hex-tile[data-id="${id}"] .face`);
  if (!face) { peek.classList.add('on'); return; }
  const wr = stage.getBoundingClientRect();
  const fr = face.getBoundingClientRect();
  let x = fr.right - wr.left + 14;
  if (x + 260 > wr.width - 8) x = fr.left - wr.left - 274;
  x = Math.max(8, Math.min(x, wr.width - 268));
  let y = fr.top - wr.top + fr.height / 2 - 48;
  y = Math.max(8, Math.min(y, wr.height - 100));
  peek.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  peek.classList.add('on');
}

function hideHexPeek() {
  $('#hex-peek')?.classList.remove('on');
  document.querySelectorAll('.hex-tile.focus').forEach((el) => el.classList.remove('focus'));
}

function renderMap() {
  const title = $('#map-title');
  const r = ladder()[S.rung];
  const pit = r ? PITCHERS.find((p) => p.id === r.pitcher) : null;
  if (title) title.textContent = pit ? `Path to ${pit.n}` : 'The path';

  const field = $('#hex-field');
  if (!field || !S.map) return;
  const act = S.map.acts[S.rung];
  if (!act) { field.innerHTML = ''; hideHexPeek(); return; }

  const { S: hs, WALL, CW, CH } = HEX;
  const parts = [`<svg class="hex-map" viewBox="0 0 ${CW} ${CH}" role="application" aria-label="Tonight's path">
    <defs>
      <linearGradient id="hex-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".14"/>
        <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#17140F" stop-opacity=".08"/>
      </linearGradient>
      <radialGradient id="hex-aceglow">
        <stop offset="0" stop-color="#E8503A" stop-opacity=".4"/>
        <stop offset="1" stop-color="#E8503A" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="hex-openglow">
        <stop offset="0" stop-color="#FFB347" stop-opacity=".45"/>
        <stop offset="1" stop-color="#FFB347" stop-opacity="0"/>
      </radialGradient>
      <filter id="hex-soft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="8"/>
      </filter>
      <filter id="hex-shadow" x="-50%" y="-40%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#0A130E" flood-opacity=".55"/>
      </filter>
    </defs>`];

  const order = allNodes(act).slice().sort((a, b) => (a.y - a.lift) - (b.y - b.lift) || a.x - b.x);
  for (const t of order) {
    const meta = NODE_LABELS[t.kind] || { label: t.kind, color: '#F2EDE0', short: t.kind };
    const st = hexTileState(t);
    const isAce = t.kind === 'boss';
    const cx = t.x, cy = t.y - t.lift;
    const s = isAce ? hs * 1.08 : hs;
    const wh = WALL + Math.min(t.lift, 4) + (isAce ? 6 : 0);
    // Chalk cards when live, turf when locked — same language as lineup .pc / dugout.
    let face, wall, rim, ink;
    if (st === 'here' || st === 'open') {
      face = mixHex('#F2EDE0', meta.color, isAce ? 0.22 : 0.12);
      wall = '#8C5836';
      rim = st === 'here' ? '#FFB347' : (isAce ? '#E8503A' : '#17140F');
      ink = isAce ? '#E8503A' : (meta.color === '#F2EDE0' ? '#17140F' : meta.color);
    } else if (st === 'visited') {
      face = mixHex('#1C3B2D', '#5ED89A', 0.18);
      wall = '#122A20';
      rim = 'rgba(94,216,154,.55)';
      ink = 'rgba(242,237,224,.55)';
    } else {
      face = mixHex('#122A20', '#1C3B2D', 0.45);
      wall = '#0A130E';
      rim = 'rgba(242,237,224,.18)';
      ink = 'rgba(242,237,224,.28)';
    }

    parts.push(`<g class="hex-tile ${st}" data-id="${t.id}" data-map-node="${t.id}">`);
    if (isAce && (st === 'open' || st === 'here')) {
      parts.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(s * 1.95).toFixed(0)}" ry="${(s * 1.75).toFixed(0)}" fill="url(#hex-aceglow)"/>`);
    }
    if (st === 'open' && !isAce) {
      parts.push(`<ellipse class="glow" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(s * 1.55).toFixed(0)}" ry="${(s * 1.4).toFixed(0)}" fill="url(#hex-openglow)" filter="url(#hex-soft)"/>`);
    }
    parts.push(`<path d="${hexWall(cx, cy, s, wh)}" fill="${wall}" stroke="#0A130E" stroke-width="1.2"/>`);
    parts.push(`<path d="${hexPath(cx, cy, s)}" fill="#0A130E" filter="url(#hex-shadow)" opacity=".35"/>`);
    parts.push(`<path class="face" d="${hexPath(cx, cy, s)}" fill="${face}" stroke="${rim}" stroke-width="${st === 'here' ? 2.6 : st === 'open' ? 2.2 : 1.5}"/>`);
    if (st === 'open' || st === 'here') {
      parts.push(`<path d="${hexPath(cx, cy, s)}" fill="url(#hex-sheen)"/>`);
    }
    parts.push(`<text class="cap" x="${cx.toFixed(1)}" y="${(cy + (isAce ? 26 : 18)).toFixed(1)}" fill="${ink}">${meta.short || meta.label}</text>`);
    if (st === 'here') {
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${(cy - s * 0.62).toFixed(1)}" r="4.2" fill="#FFB347" stroke="#17140F" stroke-width="1.2"/>`);
    }
    parts.push('</g>');
  }

  parts.push('</svg>');
  field.innerHTML = parts.join('');
  hideHexPeek();
}

function initHexMapEvents() {
  const field = $('#hex-field');
  if (!field || field.dataset.bound) return;
  field.dataset.bound = '1';
  field.addEventListener('pointerover', (e) => {
    if (S.phase !== 'map') return;
    const g = e.target.closest('.hex-tile');
    if (!g) return;
    document.querySelectorAll('.hex-tile.focus').forEach((el) => el.classList.remove('focus'));
    g.classList.add('focus');
    showHexPeek(g.dataset.id);
  });
  field.addEventListener('pointerleave', hideHexPeek);
}

function renderEvent() {
  const ev = S.event;
  const live = $('#event-gold-live');
  if (live) live.innerHTML = `<span class="gold-ico"></span>${S.gold}`;
  $('#event-title').textContent = ev?.title || 'Encounter';
  $('#event-body').textContent = ev?.body || '';
  const choices = $('#event-choices');
  const follow = $('#event-followup');
  if (!choices) return;
  if (S.eventFollowup) {
    choices.innerHTML = '';
    follow?.classList.remove('hidden');
    renderEventFollowup();
    return;
  }
  follow?.classList.add('hidden');
  if (follow) follow.innerHTML = '';
  choices.innerHTML = (ev?.choices || []).map((c, i) =>
    `<button type="button" class="act" data-event-choice="${i}">${c.label}</button>`).join('');
}

function renderEventFollowup() {
  const fu = S.eventFollowup;
  const host = $('#event-followup');
  if (!host || !fu) return;
  if (fu.type === 'draftOne') {
    host.innerHTML = `<div class="chalk-h"><span>Pick one — free</span></div>
      <div class="shop-row draft-row" id="event-draft-row"></div>`;
    const row = $('#event-draft-row');
    if (!row) return;
    row.innerHTML = fu.offers.map((o, i) => {
      const item = byId(o.id);
      if (!item) return '';
      return `<button type="button" class="pc draft-pc set-${setCss(item.set)}" data-event-pick="${i}">
        <div class="pc-head">
          <span class="set-badge s-${setCss(item.set)}">${setLabel(item.set)}</span>
          ${archTag(item.arch)}
        </div>
        <div class="pc-body">
          <div class="pname">${item.n}</div>
          <div class="pmeta">${item.y} · ${item.team}</div>
          <div class="bignums">
            <div class="bignum k-HIT"><span class="bn-lbl">HIT</span><span class="bn-v">${item.HIT}</span></div>
            <div class="bignum k-POW"><span class="bn-lbl">STAM DMG</span><span class="bn-v">${item.POW}</span></div>
          </div>
          <div class="prole">${ARCH_INFO[item.arch].role}</div>
          <div class="pc-cost-row afford">FREE</div>
        </div>
      </button>`;
    }).join('');
    return;
  }
  if (fu.type === 'removeCard') {
    host.innerHTML = `<div class="chalk-h"><span>Sell one card — full sticker</span></div>
      <div class="event-choices" id="event-remove-row"></div>`;
    const row = $('#event-remove-row');
    if (!row) return;
    row.innerHTML = S.owned.map((id) => {
      const p = byId(id);
      if (!p) return '';
      return `<button type="button" class="act" data-event-remove="${id}">${p.n} · +${p.cost}g</button>`;
    }).join('') + `<button type="button" class="act ghost" data-event-skip-remove="1">Skip · +1g</button>`;
  }
}

function renderMarket() {
  renderPhaseChrome();
  if (S.phase === 'map') renderMap();
  else if (S.phase === 'event') renderEvent();
  else if (S.phase === 'draft') renderDraft();
  else if (S.phase === 'sponsors') renderSponsors();
}

function updatePlayButton() {
  const btn = $('#play');
  if (!btn) return;
  if (S.phase === 'title' || S.phase === 'map' || S.phase === 'event') {
    btn.disabled = true;
    btn.textContent = S.phase === 'map' ? 'PICK A NODE' : '…';
    return;
  }
  if (S.phase === 'dead') { btn.disabled = true; btn.textContent = 'RUN OVER'; return; }
  if (S.playing || S.phase === 'playing') { btn.disabled = true; btn.textContent = 'IN PLAY…'; return; }
  if (S.phase === 'won' || S.phase === 'lost') { btn.disabled = true; btn.textContent = '…'; return; }
  if (S.phase === 'draft' || S.phase === 'sponsors') {
    btn.disabled = false;
    btn.textContent = 'DONE · MAP';
    return;
  }
  const ok = canPlay(S.lineup);
  btn.disabled = !ok;
  btn.textContent = ok ? 'PLAY BALL' : 'SEAT A BAT';
}

function advanceFromPlayButton() {
  if (S.phase === 'draft') {
    leaveDraftNode();
    return;
  }
  if (S.phase === 'sponsors') {
    leaveSponsorsNode();
    return;
  }
  if (S.phase === 'dugout') {
    // Real nights ignore any leftover playtest turbo from the browser console.
    TURBO = 1;
    return playRound();
  }
}

function leaveDraftNode() {
  const nodeId = S.mapNav?.current;
  if (!nodeId) { enterMapPhase(); return; }
  audio.bell();
  finishMapNode(nodeId);
}

function leaveSponsorsNode() {
  const nodeId = S.mapNav?.current;
  if (!nodeId) { enterMapPhase(); return; }
  audio.bell();
  finishMapNode(nodeId);
}

function renderBoard() {
  const { eff, links } = boardSetup(S.lineup, S.gearMap, S.charms);
  const first = !S.dealt;
  const upLins = upgradeableLineages();
  $('#board').innerHTML = S.lineup.map((p, i) => {
    const ds = first ? `style="animation-delay:${i * 55}ms"` : '';
    const dc = first ? ' deal' : '';
    const zone = zoneOf(i);
    if (!p) return `<div class="pc slot-empty${dc}" ${ds} data-slot="${i}">
      <div class="pc-body empty-body">
        <div class="empty-slot-n">${i + 1}</div>
        <div class="zline" title="${zone.label}">${zone.label} · ${zone.gives}</div>
      </div>
      <div class="track empty-track"></div>
      <div class="stamp"></div>
      <div class="tell"></div>
      <div class="countbar"><i></i></div></div>`;

    const eq = S.gearMap[p.id] || [];
    const used = eq.reduce((a, g) => a + g.w, 0);
    const cells = Array.from({ length: p.cap - used }, () => `<div class="gcell"></div>`).join('');
    const items = eq.map((g) => `<div class="gitem w${g.w}${S.lastSnap === g.id ? ' snapped' : ''}" data-gear="${g.id}" data-from="${p.id}" title="${g.n} — ${modLong(g)}">
      <span class="gi-n">${g.n}</span><span class="gi-v">${modStr(g)}</span></div>`).join('');

    const e = eff[i];
    const base = { HIT: p.HIT, POW: p.POW };
    const stats = ['HIT', 'POW'].map((k) => {
      const v = Math.round(e[k]), d = e[k] - base[k];
      return `<div class="bignum k-${k}">
        <span class="bn-lbl">${KEY_LBL[k]}</span>
        <span class="bn-v ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${v}</span>
      </div>`;
    }).join('');

    /* A rope leaving this card shows its chip on the right; the wrap-around rope
       into the leadoff man shows on the left of the card it feeds. */
    const chips = links
      .filter((l) => (l.to > l.from ? l.from === i : l.to === i))
      .map((l) => {
        const t = LINK_TYPES[l.type], wrap = l.to < l.from;
        const icon = {
          WORN: '⚒', TABLESET: '⚑', ATTRITION: '⛏', IGNITE: '✦',
          CLEANUP: '⚡', SHUTDOWN: '▣', WALKOFF: '◇', LONG_AB: '◷',
        }[l.type] || '•';
        const tip = t.tip || `${t.label} — ${t.gives}`;
        return `<span class="linkchip l-${l.type}${wrap ? ' is-wrap' : ''}" data-link="${l.from}-${l.to}-${l.type}"
          data-tip="${tipAttr(tip)}" tabindex="0"><i class="linkchip-ico" aria-hidden="true">${icon}</i></span>`;
      }).join('');

    const canUp = upLins.has(p.lineage);
    return `<div class="pc set-${setCss(p.set)}${dc}${canUp ? ' upgrade' : ''}" ${ds} data-slot="${i}" data-player="${p.id}" data-drag-player="${p.id}">
      ${canUp ? UP_CHEV : ''}
      <div class="pc-head"><span class="ord">${i + 1}</span><span class="set-badge s-${setCss(p.set)}">${setLabel(p.set)}</span>${archTag(p.arch)}</div>
      <div class="pc-body">
        <div class="pname">${p.n}</div>
        <div class="pmeta">${p.y} · ${p.team}</div>
        <div class="bignums">${stats}</div>
        <div class="prole">${ARCH_INFO[p.arch].role}</div>
      </div>
      <div class="track" data-track="${p.id}">${items}${cells}</div>
      ${chips}
      <div class="stamp"></div>
      <div class="tell"></div>
      <div class="countbar"><i></i></div>
    </div>`;
  }).join('');
  S.dealt = true; S.lastSnap = null;
  scheduleLinkSync();
}

function renderScorecard() {
  let html = '';
  for (let f = 0; f < 3; f++) {
    html += `<div class="sc-lbl" id="sc-lbl-${f}">Inning ${f + 1}</div>`;
    for (let s = 0; s < 9; s++) {
      const off = !S.lineup[s];
      html += `<div class="sc-cell${off ? ' off' : ''}" id="sc-${f}-${s}"${off ? ' title="empty seat — skipped, not an out"' : ''}></div>`;
    }
  }
  $('#sc-grid').innerHTML = html;
}

function applyOppTeamTheme(teamKey) {
  const team = TEAMS[teamKey] || TEAMS.yankees;
  const el = $('#opp');
  if (!el) return team;
  el.style.setProperty('--opp-primary', team.primary);
  el.style.setProperty('--opp-secondary', team.secondary);
  el.style.setProperty('--opp-accent', team.accent);
  el.style.setProperty('--opp-glow', `${team.secondary}22`);
  el.dataset.team = teamKey || '';
  return team;
}

function renderOpponent() {
  const r = ladder()[S.rung], p = pitcherOf(S.rung);
  if (!r || !p) return;
  const team = applyOppTeamTheme(p.team);
  $('#opp-eyebrow').textContent = `Tonight — opponent ${S.rung + 1} · ${r.name}`;
  $('#opp-name').textContent = p.n;
  const teamEl = $('#opp-team');
  if (teamEl) teamEl.textContent = `${team.n}${p.y !== '—' ? ` · ${p.y}` : ''}`;
  const sub = $('#opp-sub');
  if (sub) { sub.textContent = ''; sub.hidden = true; }
  $('#target-num').textContent = r.target;
  $('#need').textContent = `${r.target} to win`;
  $('#stam-note').innerHTML = gimmickLine(p);
  if (['dugout', 'draft', 'sponsors', 'map', 'event'].includes(S.phase)) {
    setWarmingUp(p.pool);
  } else if (!S.playing && S.phase !== 'playing') {
    setStamina(p.pool, p.pool);
  }
  if (!S.playing) setWall(freshWall());
}

/** Dugout / pre-play: full tank, label Warming up — Fresh only after first pitch. */
function setWarmingUp(pool) {
  const fill = $('#stam-fill');
  fill.style.width = '100%';
  fill.className = 'stam-fill s-WARMING';
  const st = $('#stam-state');
  st.textContent = 'Warming up';
  st.className = 'stam-state s-WARMING';
  const num = $('#stam-num');
  if (num) num.textContent = `${pool} / ${pool}`;
  placeWallBadge(100);
}

/* --- the PITCH badge: one labeled red number riding the stamina bar's edge.
       A bat gets on when its HIT beats this. It rides the fill, so emptying
       the pitcher's stamina visibly drags the pitch down with it. --- */
function setWall(n, { flash = false } = {}) {
  const badge = $('#wall-badge');
  const num = $('#wall-num');
  if (!badge || !num) return;
  const v = String(Math.max(0, Math.round(n)));
  const changed = num.textContent !== v;
  num.textContent = v;
  if ((flash || changed) && !REDUCED) {
    badge.classList.remove('flash');
    void badge.offsetWidth;
    badge.classList.add('flash');
  }
}
/** Keep the pitch badge pinned to the fill edge. */
function placeWallBadge(pct) {
  const badge = $('#wall-badge');
  if (badge) badge.style.left = `${Math.max(5, Math.min(95, pct))}%`;
}
/** Tonight's Fresh pitch — what the draft shops against. */
const freshWall = () => {
  const p = pitcherOf(S.rung);
  return p ? stuffAgainst(p, 'FRESH', 0, S.charms) : 0;
};

/** His tank and state — the only pitcher numbers the player watches. */
function setStamina(stamina, pool) {
  const state = stateOf(stamina, pool);
  const pct = Math.max(0, stamina / pool * 100);
  const fill = $('#stam-fill');
  fill.style.width = `${pct}%`;
  fill.className = `stam-fill s-${state}`;
  const st = $('#stam-state');
  st.textContent = STATE_INFO[state].label;
  st.className = `stam-state s-${state}`;
  const num = $('#stam-num');
  if (num) num.textContent = `${Math.round(stamina)} / ${pool}`;
  placeWallBadge(pct);
}

/** amount > 0: wear float. freeOut: muted "0" so Maddux's gimmick lands in the moment.
    kind: 'pow' (contact bite) | 'wear' (out-tax) — different ink so the two drains read apart. */
function drainFloat(amount, { freeOut = false, kind = 'pow' } = {}) {
  if (REDUCED) return;
  if (amount <= 0 && !freeOut) return;
  const bar = $('#stam-bar');
  if (!bar) return;
  const r = bar.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = freeOut ? 'drain-float free' : `drain-float ${kind === 'wear' ? 'wear' : 'pow'}`;
  el.textContent = freeOut ? '0' : `−${Math.round(amount)}`;
  el.style.left = `${r.left + r.width * (0.15 + Math.random() * 0.6)}px`;
  el.style.top = `${r.top - 6}px`;
  el.style.position = 'fixed';
  document.body.appendChild(el);
  if (!freeOut) {
    bar.classList.remove('hitflash', 'wearflash');
    void bar.offsetWidth;
    bar.classList.add(kind === 'wear' ? 'wearflash' : 'hitflash');
  }
  setTimeout(() => el.remove(), 950);
}

/** POW / OUT drain flies from the bat into his tank — the glossary without words.
    The −N itself makes the trip, so the number on the card is the number that lands. */
function stamBite(fromEl, amount, { kind = 'pow', freeOut = false } = {}) {
  if (freeOut) { drainFloat(0, { freeOut: true }); return; }
  if (!(amount > 0)) return;
  const bar = $('#stam-bar');
  if (!bar || !fromEl || REDUCED) { drainFloat(amount, { kind }); return; }
  const a = ctr(fromEl);
  const b = ctr(bar);
  const dur = 560;

  const chip = document.createElement('span');
  chip.className = `dmg-chip ${kind}`;
  chip.textContent = `−${Math.round(amount)}`;
  chip.style.left = `${a.x}px`;
  chip.style.top = `${a.y}px`;
  document.body.appendChild(chip);
  requestAnimationFrame(() => {
    chip.style.transition = `transform ${dur}ms cubic-bezier(.3,.9,.35,1), opacity 160ms ease ${dur - 120}ms`;
    chip.style.transform = `translate(-50%,-50%) translate(${b.x - a.x}px, ${b.y - a.y}px) scale(.75)`;
    chip.style.opacity = '0';
  });
  setTimeout(() => chip.remove(), dur + 120);

  // A few loose bits ride along so the chip reads as matter leaving the bat.
  const n = Math.min(8, Math.max(2, Math.round(amount * 0.6)));
  const colors = kind === 'wear'
    ? ['#B4764A', '#8C5836', '#C4895A']
    : ['#FFB347', '#FFCE7A', '#FFF0CE'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = `stam-bit ${kind}`;
    el.style.left = `${a.x + (Math.random() - 0.5) * 18}px`;
    el.style.top = `${a.y + (Math.random() - 0.5) * 18}px`;
    el.style.background = colors[i % colors.length];
    document.body.appendChild(el);
    const delay = i * 34;
    const jx = (Math.random() - 0.5) * 44;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${dur}ms cubic-bezier(.22,1,.36,1) ${delay}ms, opacity ${dur}ms ease ${delay}ms`;
      el.style.transform = `translate(${b.x - a.x + jx}px, ${b.y - a.y}px) scale(.55)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), dur + 220 + delay);
  }
  // Float lands as the chip arrives.
  setTimeout(() => drainFloat(amount, { kind }), dur - 60);
}

function renderTray() {
  const gearCount = $('#gear-count');
  const gearTray = $('#gear-tray');
  if (gearCount) gearCount.textContent = `${S.loose.length} on the rack`;
  if (gearTray) {
    gearTray.innerHTML = S.loose.length
      ? S.loose.map((g) => `<div class="gitem w${g.w}" data-gear="${g.id}" title="${g.n} — ${modLong(g)}">
          <span class="gi-n">${g.n}</span><span class="gi-v">${modStr(g)}</span>
          <button type="button" class="sell-btn" data-sell-gear="${g.id}">Sell <span class="gold-ico"></span>${sellPrice(g)}</button>
        </div>`).join('')
      : '';
  }

  const inLineup = new Set(S.lineup.filter(Boolean).map((p) => p.id));
  const bench = S.owned.map(byId).filter((h) => h && !inLineup.has(h.id));
  const benchCount = $('#bench-count');
  const benchTray = $('#bench-tray');
  if (benchCount) benchCount.textContent = setupPhaseOk()
    ? `${bench.length} · drag into the order`
    : `${bench.length} on roster`;
  const canSellBat = S.owned.length > 1;
  const upLins = upgradeableLineages();
  if (benchTray) {
    benchTray.innerHTML = bench.length
      ? bench.map((p) => `<div class="bench${upLins.has(p.lineage) ? ' upgrade' : ''}" data-drag-player="${p.id}">
          ${upLins.has(p.lineage) ? UP_CHEV : ''}
          <div class="bn">${p.n}</div>
          <div class="bs"><span class="set-badge s-${setCss(p.set)}">${setLabel(p.set)}</span> · ${ARCH_INFO[p.arch].label}</div>
          <div class="bb">${ARCH_INFO[p.arch].role}</div>
          ${canSellBat ? `<button type="button" class="sell-btn" data-sell-batter="${p.id}">Sell <span class="gold-ico"></span>${sellPrice(p)}</button>` : ''}
        </div>`).join('')
      : '';
  }

  const charmCount = $('#charm-count');
  const charmTray = $('#charm-tray');
  if (charmCount) charmCount.textContent = `${(S.charms || []).length}`;
  if (charmTray) {
    charmTray.innerHTML = (S.charms || []).length
      ? S.charms.map((c) => `<div class="charm-chip" title="${c.blurb}">
          <div class="cn">${c.n}</div>
          <div class="cb">${c.blurb}</div>
          <button type="button" class="sell-btn" data-sell-charm="${c.id}">Sell <span class="gold-ico"></span>${sellPrice(c)}</button>
        </div>`).join('')
      : '<div class="cb" style="opacity:.5">No charms yet</div>';
  }
}

function renderAll() {
  renderOpponent();
  renderWallet();
  renderBoard();
  renderTray();
  renderMarket();
  updatePlayButton();
}

/* The diamond. Built on first use so the pace divisor is already live. */
let diamond = null;
function theField() {
  if (!diamond) {
    const root = $('#field');
    if (!root) return null;
    diamond = createField(root, { reduced: REDUCED, rate: () => SPEEDS[speedIdx] * TURBO });
  }
  return diamond;
}
function setOuts(n) { document.querySelectorAll('#outs .out-pip').forEach((el, i) => el.classList.toggle('on', i < n)); }

let shownRuns = 0, runAnim = null;
function setRuns(target) {
  const el = $('#runs');
  if (REDUCED) { shownRuns = target; el.textContent = target; return; }
  if (runAnim) clearInterval(runAnim);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  runAnim = setInterval(() => {
    if (shownRuns >= target) { clearInterval(runAnim); runAnim = null; return; }
    shownRuns++; el.textContent = shownRuns; audio.tick();
  }, 70);
}

/* =================== drag (pointer + RAF + settle + FLIP) ===================
   Modern web pattern: Pointer Events + setPointerCapture, activation threshold,
   compositor-only ghost via translate3d in RAF, spring settle on drop, FLIP
   for board reorders. No HTML5 Drag API. */
const DnD = {
  THRESHOLD: 6,
  SETTLE_MS: REDUCED ? 0 : 260,
  EASE: 'cubic-bezier(0.22, 1, 0.36, 1)',
  CARD_RANGE: 130,
  TRACK_RANGE: 100,
};
let drag = null;
let dragRaf = 0;
let hitCache = { cards: [], tracks: [], t: 0 };

function edgeDist(r, x, y) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}
function refreshHitCache(force) {
  const now = performance.now();
  if (!force && now - hitCache.t < 48) return;
  hitCache.t = now;
  // Only lineup slots and equippable tracks are drop targets. Draft/sponsor
  // cards share the .pc/.track chrome, so they must never enter the cache.
  hitCache.cards = [...document.querySelectorAll('#board .pc[data-slot]')].map((el) => ({ el, r: el.getBoundingClientRect() }));
  hitCache.tracks = [...document.querySelectorAll('#board .track[data-track]')].map((el) => ({ el, r: el.getBoundingClientRect() }));
  const market = document.getElementById('market');
  hitCache.shop = market && !market.classList.contains('hidden')
    ? { el: market, r: market.getBoundingClientRect() }
    : null;
  hitCache.trays = {};
  for (const id of ['gear-tray', 'bench-tray']) {
    const el = document.getElementById(id);
    // The tray shell stays hittable even when empty, so aim at its container.
    const box = el?.parentElement || el;
    if (box) hitCache.trays[id] = { el: box, r: box.getBoundingClientRect() };
  }
}
function trayZoneAt(id, x, y) {
  refreshHitCache(false);
  const t = hitCache.trays?.[id];
  if (!t) return null;
  return edgeDist(t.r, x, y) < DnD.TRACK_RANGE ? { el: t.el, rect: t.r } : null;
}
function sellZoneAt(x, y) {
  refreshHitCache(false);
  const s = hitCache.shop;
  if (!s) return null;
  const r = s.r;
  if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { el: s.el, rect: r };
  return null;
}
function nearestTrackAt(x, y, d) {
  refreshHitCache(false);
  let best = null, bd = DnD.TRACK_RANGE;
  for (const t of hitCache.tracks) {
    const dist = edgeDist(t.r, x, y);
    if (dist < bd) { bd = dist; best = t; }
  }
  if (!best) return null;
  const pid = best.el.dataset.track, p = byId(pid), g = byId(d.id);
  if (!p || !g) return null;
  const eq = (S.gearMap[pid] || []).filter((it) => !(d.from === pid && it.id === d.id));
  return { el: best.el, pid, fits: eq.reduce((a, i) => a + i.w, 0) + g.w <= p.cap, rect: best.r };
}
function nearestCardAt(x, y) {
  refreshHitCache(false);
  let best = null, bd = DnD.CARD_RANGE;
  for (const c of hitCache.cards) {
    const dist = edgeDist(c.r, x, y);
    if (dist < bd) { bd = dist; best = c; }
  }
  return best ? { el: best.el, rect: best.r } : null;
}
function clearDropHints() {
  // Board only: the drag ghost is a clone of a .pc and must keep the transform
  // that pins it to the cursor.
  document.querySelectorAll('#board .track').forEach((t) => t.classList.remove('ok', 'bad'));
  document.querySelectorAll('#board .pc').forEach((r) => {
    r.classList.remove('dropzone', 'drop-reject', 'shift-left', 'shift-right');
    if (!r.classList.contains('at-bat')) r.style.transform = '';
  });
  document.getElementById('market')?.classList.remove('sell-hot');
  document.querySelectorAll('.chips.tray-hot').forEach((t) => t.classList.remove('tray-hot'));
  document.body.classList.remove('dragging-shop', 'dragging-owned');
}
function paintDropHints(d, x, y) {
  clearDropHints();
  const shopEl = document.getElementById('market');

  if (d.kind === 'draft') {
    document.body.classList.add('dragging-shop');
    const offer = S.draft[d.draftIdx];
    if (!offer) return;
    const cost = buyCost(byId(offer.id), S.owned);
    const afford = Number.isFinite(cost) && S.gold >= cost;
    const c = nearestCardAt(x, y);
    if (c) { c.el.classList.add(afford ? 'dropzone' : 'drop-reject'); return; }
    if (afford && trayZoneAt('bench-tray', x, y)) document.getElementById('bench-tray')?.classList.add('tray-hot');
    return;
  }

  if (d.kind === 'sponsorGear') {
    document.body.classList.add('dragging-shop');
    const offer = S.sponsors[d.spIdx]?.offers[d.offerIdx];
    if (!offer) return;
    const afford = S.gold >= offer.cost;
    const t = nearestTrackAt(x, y, d);
    if (t) { t.el.classList.add(afford && t.fits ? 'ok' : 'bad'); return; }
    if (afford && trayZoneAt('gear-tray', x, y)) document.getElementById('gear-tray')?.classList.add('tray-hot');
    return;
  }

  document.body.classList.add('dragging-owned');
  const sell = sellZoneAt(x, y);
  if (sell) {
    shopEl?.classList.add('sell-hot');
    return;
  }
  if (d.kind === 'gear') {
    const t = nearestTrackAt(x, y, d);
    if (t) t.el.classList.add(t.fits ? 'ok' : 'bad');
  } else if (d.kind === 'player') {
    const c = nearestCardAt(x, y);
    if (!c) return;
    c.el.classList.add('dropzone');
    const target = +c.el.dataset.slot;
    const cur = S.lineup.findIndex((pl) => pl && pl.id === d.id);
    if (cur < 0 || cur === target) return;
    // Other cards slide out of the way toward the vacated slot.
    document.querySelectorAll('#board .pc[data-slot]').forEach((el) => {
      if (el === c.el || el.classList.contains('drag-origin')) return;
      const s = +el.dataset.slot;
      if (cur < target && s > cur && s <= target) el.classList.add('shift-left');
      if (cur > target && s >= target && s < cur) el.classList.add('shift-right');
    });
  }
}
function placeGhost(ghost, x, y, lifted) {
  // Compositor-only: left/top fixed at 0, position via translate3d
  const rot = lifted ? -3.5 : 0;
  const scale = lifted ? 1.07 : 1;
  ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;
}
function scheduleGhostMove(d) {
  if (dragRaf) return;
  dragRaf = requestAnimationFrame(() => {
    dragRaf = 0;
    if (!d.active || !d.ghost) return;
    placeGhost(d.ghost, d.x, d.y, true);
    paintDropHints(d, d.x, d.y);
  });
}
function liftDrag(d) {
  if (d.active) return;
  d.active = true;
  const ghost = d.el.cloneNode(true);
  ghost.id = 'ghost';
  ghost.classList.remove('dragging');
  ghost.querySelectorAll('.sell-btn').forEach((b) => b.remove());
  // A deep clone answers to every [data-*] hook the real card does. Strip them so
  // no render or hint pass can grab the ghost and stomp its cursor transform.
  for (const el of [ghost, ...ghost.querySelectorAll('*')]) {
    for (const key of Object.keys(el.dataset)) delete el.dataset[key];
  }
  ghost.style.width = `${d.w}px`;
  ghost.style.height = `${d.h}px`;
  ghost.style.left = '0';
  ghost.style.top = '0';
  ghost.style.transition = 'none';
  ghost.style.willChange = 'transform';
  document.body.appendChild(ghost);
  d.ghost = ghost;
  d.el.classList.add('dragging', 'drag-origin');
  document.body.classList.add('grabbing', 'is-dragging');
  placeGhost(ghost, d.x, d.y, false);
  // Next frame: spring into lifted pose, then kill transition so pointer tracking stays 1:1.
  requestAnimationFrame(() => {
    if (!d.ghost) return;
    d.ghost.classList.add('ghost-live');
    d.ghost.style.transition = `transform 160ms ${DnD.EASE}, opacity 140ms ${DnD.EASE}`;
    placeGhost(d.ghost, d.x, d.y, true);
    requestAnimationFrame(() => { if (d.ghost) d.ghost.style.transition = 'none'; });
  });
  refreshHitCache(true);
  audio.lift();
}
const FLIP_SEL = '.pc[data-player], .pc[data-slot], [data-flip]';
const flipKey = (el) => el.dataset.flip || el.dataset.player || el.dataset.slot;
function captureFlip(selector) {
  const map = new Map();
  document.querySelectorAll(selector).forEach((el) => {
    const key = flipKey(el);
    if (key == null) return;
    map.set(String(key), el.getBoundingClientRect());
  });
  return map;
}
function playFlip(selector, first) {
  if (REDUCED || !first?.size) return;
  document.querySelectorAll(selector).forEach((el) => {
    const key = flipKey(el);
    const a = first.get(String(key));
    if (!a) return;
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    void el.offsetWidth;
    el.style.transition = `transform ${DnD.SETTLE_MS}ms ${DnD.EASE}`;
    el.style.transform = '';
    const clear = () => { el.style.transition = ''; el.style.transform = ''; };
    el.addEventListener('transitionend', clear, { once: true });
    setTimeout(clear, DnD.SETTLE_MS + 40);
  });
}
function settleGhost(d, targetRect, landed, then) {
  if (!d.ghost) { then(); return; }
  if (REDUCED || !targetRect) {
    d.ghost.remove(); d.ghost = null; then(); return;
  }
  const ghost = d.ghost;
  const gx = targetRect.left + targetRect.width / 2;
  const gy = targetRect.top + targetRect.height / 2;
  ghost.classList.add('ghost-settle');
  ghost.style.transition = `transform ${DnD.SETTLE_MS}ms ${DnD.EASE}, opacity ${DnD.SETTLE_MS}ms ${DnD.EASE}`;
  // A card that lands stays solid all the way in; a rejected one fades home.
  const scale = landed ? Math.min(1, (targetRect.width || d.w) / (d.w || 1)) : 0.96;
  ghost.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate(-50%, -50%) rotate(0deg) scale(${scale.toFixed(3)})`;
  ghost.style.opacity = landed ? '1' : '0.35';
  const done = () => { ghost.remove(); if (d.ghost === ghost) d.ghost = null; then(); };
  ghost.addEventListener('transitionend', done, { once: true });
  setTimeout(done, DnD.SETTLE_MS + 40);
}
function endDragCleanup(d) {
  if (dragRaf) { cancelAnimationFrame(dragRaf); dragRaf = 0; }
  d.el.classList.remove('dragging', 'drag-origin');
  document.body.classList.remove('grabbing', 'is-dragging');
  clearDropHints();
  try { d.el.releasePointerCapture?.(d.pointerId); } catch (_) {}
}
function applyDraftDrop(d, x, y) {
  const offer = S.draft[d.draftIdx];
  if (!offer) return { ok: false, rect: d.originRect };
  const card = byId(offer.id);
  const cost = buyCost(card, S.owned);
  const hit = nearestCardAt(x, y);
  const bench = hit ? null : trayZoneAt('bench-tray', x, y);
  // Dropped back on the shelf (or anywhere neutral) — no sale.
  if (!hit && !bench) return { ok: false, rect: d.originRect };
  if (!Number.isFinite(cost) || S.gold < cost) {
    audio.reject();
    return { ok: false, rect: d.originRect };
  }
  const seat = hit ? +hit.el.dataset.slot : null;
  if (!buyDraft(d.draftIdx, { silent: true, seat, fromEl: d.el })) {
    return { ok: false, rect: d.originRect };
  }
  audio.snap();
  if (!hit) return { ok: true, rect: bench.rect, bought: true };
  dustDrop(hit.el);
  return { ok: true, rect: hit.rect, slot: seat, bought: true };
}

function applySponsorGearDrop(d, x, y) {
  const sp = S.sponsors[d.spIdx];
  const offer = sp?.offers[d.offerIdx];
  if (!offer) return { ok: false, rect: d.originRect };
  if (S.gold < offer.cost) {
    audio.reject();
    return { ok: false, rect: d.originRect };
  }
  const t = nearestTrackAt(x, y, { id: offer.id, from: null });
  if (t && !t.fits) {
    audio.reject();
    return { ok: false, rect: d.originRect };
  }
  const rack = t ? null : trayZoneAt('gear-tray', x, y);
  if (!t && !rack) return { ok: false, rect: d.originRect };
  const equipTo = t ? t.pid : null;
  if (!buySponsorGear(d.spIdx, d.offerIdx, { silent: true, fromEl: d.el, equipTo })) {
    return { ok: false, rect: d.originRect };
  }
  audio.snap();
  if (!t) return { ok: true, rect: rack.rect, bought: true };
  dirtPuff(t.el);
  return { ok: true, rect: t.rect, thumpPid: t.pid, bought: true };
}

function applyGearDrop(d, x, y) {
  const g = byId(d.id);
  const sell = sellZoneAt(x, y);
  if (sell) {
    const res = d.from
      ? sellEquippedGear(d.from, d.id, { silent: true })
      : sellLooseGear(d.id, { silent: true });
    if (!res) return { ok: false, rect: d.originRect };
    return { ok: true, rect: sell.rect, sold: true };
  }
  const t = nearestTrackAt(x, y, d);
  if (!t || !t.fits) {
    if (!t && d.from) {
      // unequip to rack (not a sale)
      S.gearMap[d.from] = (S.gearMap[d.from] || []).filter((it) => it.id !== g.id);
      if (!(S.gearMap[d.from] || []).length) delete S.gearMap[d.from];
      S.loose.push(g);
      audio.snap();
      return { ok: true, rect: d.originRect, unequipped: true };
    }
    if (t && !t.fits) audio.reject();
    return { ok: false, rect: d.originRect };
  }
  if (d.from === t.pid) return { ok: false, rect: t.rect };
  if (d.from) {
    S.gearMap[d.from] = (S.gearMap[d.from] || []).filter((it) => it.id !== g.id);
    if (!(S.gearMap[d.from] || []).length) delete S.gearMap[d.from];
  } else {
    const i = S.loose.findIndex((it) => it.id === g.id);
    if (i >= 0) S.loose.splice(i, 1);
  }
  S.gearMap[t.pid] = [...(S.gearMap[t.pid] || []), g];
  S.lastSnap = g.id;
  dirtPuff(t.el);
  audio.snap();
  return { ok: true, rect: t.rect, thumpPid: t.pid };
}
function applyPlayerDrop(d, x, y) {
  const p = byId(d.id);
  if (!p || !S.owned.includes(p.id)) return { ok: false, rect: d.originRect };
  const sell = sellZoneAt(x, y);
  if (sell) {
    const res = sellBatter(p.id, { silent: true });
    if (!res) return { ok: false, rect: d.originRect };
    return { ok: true, rect: sell.rect, sold: true };
  }
  const hit = nearestCardAt(x, y);
  const cur = S.lineup.findIndex((pl) => pl && pl.id === p.id);
  if (!hit) {
    // drag out of a slot with nowhere to land → unseat to roster (keep owned)
    if (cur >= 0) {
      S.lineup[cur] = null;
      audio.snap();
      return { ok: true, rect: d.originRect, emptied: true };
    }
    return { ok: false, rect: d.originRect };
  }
  const target = +hit.el.dataset.slot, occ = S.lineup[target];
  if (occ && occ.id === p.id) return { ok: false, rect: hit.rect };
  if (cur >= 0) S.lineup[cur] = occ || null;
  S.lineup[target] = p;
  dustDrop(hit.el);
  chalkPuff(hit.el);
  audio.snap();
  return { ok: true, rect: hit.rect, slot: target };
}
function commitAfterSettle(d, result) {
  const first = captureFlip(FLIP_SEL);
  // Keep dealt=true so cards don't re-run the deal animation and fight FLIP.
  S.dealt = true;
  renderBoard();
  renderTray();
  renderMarket();
  updatePlayButton();
  playFlip(FLIP_SEL, first);
  if (result?.slot != null) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`.pc[data-slot="${result.slot}"]`);
      if (el) {
        el.classList.add('thump');
        el.addEventListener('animationend', () => el.classList.remove('thump'), { once: true });
      }
    });
  } else if (result?.thumpPid) {
    const card = document.querySelector(`.pc[data-player="${result.thumpPid}"]`);
    if (card) {
      card.classList.add('thump');
      card.addEventListener('animationend', () => card.classList.remove('thump'), { once: true });
    }
  }
}

document.addEventListener('pointerdown', (e) => {
  audio.ready();
  if (e.button != null && e.button !== 0) return;
  if (e.target.closest('.sell-btn')) return;
  if (e.target.closest('.sponsor-pick')) return;
  if (S.playing || drag) return;
  if (!setupPhaseOk()) return;

  const draftEl = e.target.closest('[data-draft]');
  const spEl = draftEl ? null : e.target.closest('[data-sponsor-offer]');
  const gearEl = e.target.closest('[data-gear]');
  // Prefer gear over the parent player card when starting on a dirt-strip item.
  const playerEl = gearEl ? null : e.target.closest('[data-drag-player]');

  if (draftEl) {
    if (!draftPhaseOk()) return;
    if (!S.draft[+draftEl.dataset.draft]) return;
  } else if (spEl) {
    if (!sponsorPhaseOk()) return;
    const [si, oi] = spEl.dataset.sponsorOffer.split(':').map(Number);
    if (!S.sponsors[si]?.offers[oi]) return;
  } else if (gearEl || playerEl) {
    // Seat bats / move gear anytime before the night — map, shops, dugout.
  } else {
    return;
  }

  e.preventDefault();
  const src = draftEl || spEl || gearEl || playerEl;
  const rect = src.getBoundingClientRect();

  if (draftEl) {
    const idx = +draftEl.dataset.draft;
    drag = { kind: 'draft', draftIdx: idx, id: S.draft[idx].id, el: src };
  } else if (spEl) {
    const [si, oi] = spEl.dataset.sponsorOffer.split(':').map(Number);
    drag = { kind: 'sponsorGear', spIdx: si, offerIdx: oi, id: S.sponsors[si].offers[oi].id, el: src };
  } else if (gearEl) {
    drag = { kind: 'gear', id: gearEl.dataset.gear, from: gearEl.dataset.from || null, el: src };
  } else {
    drag = { kind: 'player', id: playerEl.dataset.dragPlayer, el: src };
  }

  Object.assign(drag, {
    active: false,
    ghost: null,
    pointerId: e.pointerId,
    x0: e.clientX, y0: e.clientY,
    x: e.clientX, y: e.clientY,
    w: rect.width, h: rect.height,
    originRect: rect,
  });
  try { src.setPointerCapture(e.pointerId); } catch (_) {}
  src.classList.add('drag-armed');
});

document.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.active) {
    if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) < DnD.THRESHOLD) return;
    drag.el.classList.remove('drag-armed');
    liftDrag(drag);
  }
  scheduleGhostMove(drag);
});

function finishPointer(e) {
  if (!drag || (e.pointerId != null && e.pointerId !== drag.pointerId)) return;
  const d = drag;
  drag = null;
  d.el.classList.remove('drag-armed');
  if (!d.active) {
    endDragCleanup(d);
    // Click (no drag): buy into roster / rack
    if (d.kind === 'draft') buyDraft(d.draftIdx, { fromEl: d.el });
    else if (d.kind === 'sponsorGear') buySponsorGear(d.spIdx, d.offerIdx, { fromEl: d.el });
    return;
  }
  clearDropHints();
  let result;
  if (d.kind === 'draft') result = applyDraftDrop(d, d.x, d.y);
  else if (d.kind === 'sponsorGear') result = applySponsorGearDrop(d, d.x, d.y);
  else if (d.kind === 'gear') result = applyGearDrop(d, d.x, d.y);
  else result = applyPlayerDrop(d, d.x, d.y);
  const settleTo = result.ok ? result.rect : d.originRect;
  endDragCleanup(d);
  settleGhost(d, settleTo, result.ok, () => {
    commitAfterSettle(d, result);
    if (result.sold || result.bought) renderWallet();
  });
}
document.addEventListener('pointerup', finishPointer);
document.addEventListener('pointercancel', finishPointer);

/* =================== foil tracking =================== */
/* All-Star and World Series nameplates carry a highlight that sits where the
   light would catch the card, so it follows the cursor across the whole card
   rather than just the header strip. Writes are coalesced to one per frame. */
const FOIL_SEL = '.pc.set-all-star, .pc.set-world-series';
let foilHead = null;
let foilPend = null;
let foilRaf = 0;
function paintFoil() {
  foilRaf = 0;
  const { head, x, y } = foilPend;
  head.style.setProperty('--hx', `${x.toFixed(1)}%`);
  head.style.setProperty('--hy', `${y.toFixed(1)}%`);
}
function clearFoil() {
  if (!foilHead) return;
  foilHead.style.removeProperty('--hx');
  foilHead.style.removeProperty('--hy');
  foilHead = null;
}
document.addEventListener('pointermove', (e) => {
  if (drag || REDUCED) return;
  const card = e.target.closest?.(FOIL_SEL);
  const head = card?.querySelector(':scope > .pc-head') || null;
  if (head !== foilHead) { clearFoil(); foilHead = head; }
  if (!head) return;
  const r = card.getBoundingClientRect();
  if (!r.width || !r.height) return;
  foilPend = { head, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  if (!foilRaf) foilRaf = requestAnimationFrame(paintFoil);
}, { passive: true });
document.addEventListener('pointerleave', clearFoil);

/* =================== play =================== */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Night pacing — every beat is long enough to read. A plate appearance goes:
   what this spot has going for it → windup → the pitch → the result lands. */
const PACE = REDUCED
  ? { boost: 20, windup: 50, pitch: 20, out: 80, hit: 100, hr: 160, walk: 100, inningGap: 80, banner: 80, stateHold: 80 }
  : { boost: 340, windup: 1250, pitch: 320, out: 900, hit: 1500, hr: 2400, walk: 1100, inningGap: 1400, banner: 1250, stateHold: 1400 };

const SPEEDS = [1, 1.5, 2];
const SPEED_KEY = 'lineup.speed';
let speedIdx = 0;
/** Playtest-only divisor. Never written by the Speed button — and never left sticky into a real night. */
let TURBO = 1;
const hold = (ms) => wait(ms / (SPEEDS[speedIdx] * TURBO));
function paintSpeed() {
  const b = $('#speed');
  if (b) b.innerHTML = `Speed &middot; ${SPEEDS[speedIdx]}&times;`;
}
function initSpeed() {
  TURBO = 1;
  try {
    const i = SPEEDS.indexOf(Number(localStorage.getItem(SPEED_KEY)));
    if (i >= 0) speedIdx = i;
  } catch (_) {}
  paintSpeed();
}
function cycleSpeed() {
  TURBO = 1;
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  try { localStorage.setItem(SPEED_KEY, String(SPEEDS[speedIdx])); } catch (_) {}
  paintSpeed(); audio.tick();
}

async function banner(text) {
  const b = $('#inning-banner');
  if (!b) { await hold(PACE.banner); return; }
  b.textContent = text;
  b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  await hold(PACE.banner);
}

/* ---------- rally: consecutive men reaching, and the heat it puts on the field ---------- */
function setRally(n) {
  const el = $('#rally');
  const num = $('#rally-n');
  if (num) num.textContent = n;
  if (el) {
    el.classList.toggle('hot', n >= 2);
    el.classList.toggle('blaze', n >= 4);
  }
  linkField.setHeat(Math.min(1, n / 4));
}

/* ---------- the payoff beat: links, abilities, and his state — no duel math ---------- */
function boostList(slot, e, info) {
  const out = [];
  for (const l of linkRopes) {
    if (l.to !== slot) continue;
    const t = LINK_TYPES[l.type];
    const from = S.lineup[l.from];
    out.push({ cls: `b-${l.type}`, text: t.label.toUpperCase(), note: from ? `from ${from.n} · ${t.gives}` : t.gives, link: true });
  }
  for (const m of info.mods) {
    out.push({ cls: 'b-heat', text: m.label.toUpperCase(), note: m.detail });
  }
  const si = STATE_INFO[info.state];
  if (info.state === 'FRESH') out.push({ cls: 'b-cold', text: 'PITCHER IS FRESH', note: 'wear the pitcher down', cold: true });
  else out.push({ cls: 'b-tired', text: `PITCHER IS ${si.label.toUpperCase()}`, note: 'the lineup opens up' });
  if (info.seen > 0) {
    out.push({ cls: 'b-cold', text: info.look.label.toUpperCase(), note: 'the pitcher has a read on this bat', cold: true });
  }
  return out.slice(0, 4);
}

async function showBoosts(card, list) {
  const host = document.createElement('div');
  host.className = 'boosts';
  card.appendChild(host);
  let warm = false;
  for (const b of list) {
    const el = document.createElement('span');
    el.className = `boost ${b.cls}`;
    el.innerHTML = `${b.text}${b.note ? `<i>${b.note}</i>` : ''}`;
    host.appendChild(el);
    if (b.link) { fireLinksInto(+card.dataset.slot); warm = true; }
    if (!b.cold) warm = true;
    audio.spark(b.cold);
    await hold(PACE.boost);
  }
  if (warm) card.classList.add('link-hot');
  return host;
}

/* --- the stat cells are the actors: live values, pops, and flying chips --- */
const bigCell = (card, k) => card?.querySelector(`.bignum.k-${k}`);

/** Write a live value into a card's HIT/POW cell. base = the printed card stat. */
function setBig(card, k, v, base, { quiet = false } = {}) {
  const cell = bigCell(card, k);
  const el = cell?.querySelector('.bn-v');
  if (!el) return;
  const next = String(Math.round(v));
  const changed = el.textContent !== next;
  el.textContent = next;
  el.classList.toggle('up', v > base);
  el.classList.toggle('dn', v < base);
  if (changed && !quiet && !REDUCED) {
    cell.classList.remove('tick');
    void cell.offsetWidth;
    cell.classList.add('tick');
  }
}

/** Pop a cell — this stat is the one doing the work right now. */
function fireCell(cell, cls = 'firing') {
  if (!cell || REDUCED) return;
  cell.classList.remove('firing', 'lost');
  void cell.offsetWidth;
  cell.classList.add(cls);
}

/** A labeled chip that flies from one element to another (HIT to the duel, wall to the duel). */
function statChip(fromEl, toEl, text, kind = 'hit', dur = 480) {
  if (REDUCED || !fromEl || !toEl) return;
  const a = ctr(fromEl), b = ctr(toEl);
  const el = document.createElement('span');
  el.className = `stat-chip ${kind}`;
  el.textContent = text;
  el.style.left = `${a.x}px`;
  el.style.top = `${a.y}px`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transition = `transform ${dur}ms cubic-bezier(.3,.9,.35,1), opacity 150ms ease ${dur - 100}ms`;
    el.style.transform = `translate(-50%,-50%) translate(${b.x - a.x}px, ${b.y - a.y}px) scale(.6)`;
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), dur + 100);
}

/* --- the duel at the mound: HIT vs WALL, exact numbers, one winner ---
   The encounter happens in the middle of the diamond, where the play actually is:
   the bat's HIT slides in from the order, his WALL slides in from the stamina bar,
   and whichever number is bigger wins. Nothing is rolled. */
function duelEls() {
  const host = $('#duel');
  return host ? { host, hit: $('#duel-hit'), wall: $('#duel-wall') } : null;
}
function duelShow(hit, wall) {
  const d = duelEls();
  if (!d) return;
  d.host.className = 'duel live';
  d.hit.textContent = hit;
  d.wall.textContent = wall;
}
function duelResolve(reached) {
  const d = duelEls();
  if (!d) return;
  d.host.classList.add(reached ? 'bat-wins' : 'arm-wins');
}
function duelHide() {
  const d = duelEls();
  if (d) d.host.className = 'duel';
}

/** He answers an out with a green pulse — the wall held, no harm done. */
function barHeld() {
  const bar = $('#stam-bar');
  if (!bar || REDUCED) return;
  bar.classList.remove('held', 'hitflash', 'wearflash');
  void bar.offsetWidth;
  bar.classList.add('held');
}

/** Countbar fills while the duel is up at the mound; then the card swings. */
async function windup(card) {
  const bar = card.querySelector('.countbar i');
  const dur = PACE.windup / (SPEEDS[speedIdx] * TURBO);
  audio.windup();
  card.classList.add('loading');
  if (bar) bar.style.width = '0';
  const t0 = performance.now();
  await new Promise((res) => {
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      if (bar) bar.style.width = `${k * 100}%`;
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  card.classList.remove('loading');
  card.classList.add('swing');
  audio.tick();
  await hold(PACE.pitch);
  card.classList.remove('swing');
  if (bar) bar.style.width = '0';
}

function markScorecard(f, slot, html) {
  const cell = document.getElementById(`sc-${f}-${slot}`);
  if (cell) cell.insertAdjacentHTML('beforeend', html);
}

function clearResults() {
  renderScorecard();
  document.querySelectorAll('.countbar i').forEach((b) => b.style.width = '0');
  document.querySelectorAll('#innings .inn-pip').forEach((f) => f.classList.remove('on', 'live'));
  document.querySelectorAll('.pc').forEach((c) => {
    c.classList.remove('at-bat', 'link-hot', 'loading', 'swing');
  });
  duelHide();
  document.querySelectorAll('.boosts').forEach((b) => b.remove());
  document.querySelectorAll('.stamp').forEach((s) => { s.className = 'stamp'; s.textContent = ''; });
  document.querySelectorAll('.tell').forEach((t) => { t.classList.remove('show'); t.textContent = ''; });
  setRally(0);
  $('#board').classList.remove('playing');
  setOuts(0); theField()?.clear();
  shownRuns = 0; $('#runs').textContent = '0';
  $('#log-head').textContent = '—';
  $('#log').innerHTML = '';
  $('#summary').textContent = '';
  $('#verdict-top').innerHTML = '';
  const expand = $('#pbp-expand');
  if (expand) expand.hidden = true;
  closePlayByPlay();
  const p = pitcherOf(S.rung);
  setStamina(p.pool, p.pool);
  setWall(freshWall());
}

function openPlayByPlay() {
  const src = $('#log');
  const overlay = $('#pbp-overlay');
  const dest = $('#pbp-log');
  if (!src || !overlay || !dest || !src.innerHTML.trim()) return;
  dest.innerHTML = src.innerHTML;
  const score = $('#pbp-score');
  if (score) score.textContent = $('#log-head')?.textContent || '—';
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pbp-open');
  $('#pbp-close')?.focus();
}

function closePlayByPlay() {
  const overlay = $('#pbp-overlay');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('pbp-open');
}

function showVerdict(kind, topHtml) {
  $('#verdict-top').innerHTML = topHtml;
  $('#verdict').className = `verdict show ${kind}`;
  requestAnimationFrame(() => {
    $('#verdict')?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' });
  });
}

async function playRound() {
  if (S.playing || S.phase !== 'dugout') return;
  if (!canPlay(S.lineup)) { audio.reject(); return; }
  audio.ready();
  setRulesCollapsed(true);
  S.playing = true; S.phase = 'playing';
  updatePlayButton();
  renderPhaseChrome();
  clearResults();
  // First pitch of the night: he is Fresh (clearResults already set full tank + Fresh).
  setStamina(pitcherOf(S.rung).pool, pitcherOf(S.rung).pool);
  $('#verdict').className = 'verdict';
  $('#board').classList.add('playing');

  const rung = ladder()[S.rung], pit = pitcherOf(S.rung);
  const { eff } = boardSetup(S.lineup, S.gearMap, S.charms);
  const order = battingOrder(S.lineup);
  const rng = Math.random;
  // Re-query each PA — board may re-render; never trust a stale NodeList across innings.
  const logLines = [];
  const looks = Array(9).fill(0);
  let stamina = pit.pool, pos = 0, totalRuns = 0, totalDrain = 0, brokeInning = 0;
  let tankTimer = 0; // pending delayed bar paint — the tank chips when the −N arrives
  const inningRuns = [];

  try {
    if (!order.length) throw new Error('nobody is seated');
    let walkOff = false;
    for (let f = 0; f < 3 && !walkOff; f++) {
      if (f > 0 && pit.recover) {
        const before = stamina;
        stamina = Math.min(pit.pool, stamina + pit.recover);
        if (stamina > before) {
          setStamina(stamina, pit.pool);
          logLines.push(`<span class="inn-div">The pitcher catches his breath — <b>+${Math.round(stamina - before)}</b> stamina back</span>`);
          await hold(PACE.stateHold);
        }
      }
      let bases = [null, null, null], outs = 0, runs = 0, chain = 0, innFaced = 0;
      setOuts(0); setRally(0);
      theField()?.clear();
      document.querySelectorAll('#innings .inn-pip').forEach((el, i) => el.classList.toggle('live', i === f));
      await banner(`INNING ${f + 1}`); audio.bell();

      const leadSlot = order[pos % order.length];
      logLines.push(`<span class="inn-div">Inning ${f + 1} — first up: <span class="lead">${S.lineup[leadSlot].n}</span> (spot ${leadSlot + 1})</span>`);

      while (outs < 3 && innFaced < INNING_CAP && !walkOff) {
        const slot = order[pos % order.length];
        const p = S.lineup[slot], e = eff[slot];
        const card = document.querySelector(`.pc[data-slot="${slot}"]`);
        pos++; innFaced++;
        if (!p || !e || !card) continue; // seat vanished mid-night: skip it, never an out

        const seen = looks[slot]++;
        const look = lookAt(seen);
        const stateBefore = stateOf(stamina, pit.pool);
        const runners = bases.filter(Boolean).length;
        const stuff = stuffAgainst(pit, stateBefore, seen, S.charms, {
          zone: e.zone, linked: e.linked, runners,
        });
        const mods = modifiersFor(e, stateBefore, {
          runners, outs, seen, charms: S.charms,
          muteCloser: !!pit.muteCloser,
          denyFirstLook: !!pit.denyFirstLook,
        });
        const ctx = {
          runners, state: stateBefore, mods, outs, seen, charms: S.charms,
          noOutDamage: pit.efficient,
          outDamageScale: pit.halfOuts ? 0.5 : undefined,
          noStretch: !!pit.noStretch,
          softContact: !!pit.softContact,
          muteCloser: !!pit.muteCloser,
          denyFirstLook: !!pit.denyFirstLook,
        };

        // Next batter is up: clear every prior stamp / duel so only this AB can leave a mark.
        duelHide();
        document.querySelectorAll('.pc').forEach((c) => {
          c.classList.remove('at-bat', 'link-hot');
          clearTell(c);
          const s = c.querySelector('.stamp');
          if (s) { s.className = 'stamp'; s.textContent = ''; }
        });
        // Cells fall back to their resting effective values once a bat steps out.
        document.querySelectorAll('#board .pc[data-player]').forEach((c) => {
          const cs = +c.dataset.slot, ce = eff[cs], cp = S.lineup[cs];
          if (!ce || !cp) return;
          setBig(c, 'HIT', ce.HIT, cp.HIT, { quiet: true });
          setBig(c, 'POW', ce.POW, cp.POW, { quiet: true });
          ['HIT', 'POW'].forEach((k) => bigCell(c, k)?.classList.remove('firing', 'lost', 'tick'));
        });
        document.querySelectorAll('.boosts').forEach((b) => b.remove());
        card.classList.add('at-bat');
        setStamina(stamina, pit.pool);
        // The wall this bat faces right now — his stuff, his state, his read on this bat.
        setWall(stuff);
        const stampEl = card.querySelector('.stamp');
        clearTell(card);

        // 1. links, abilities, and his state — no duel math
        const boostHost = await showBoosts(card, boostList(slot, e, { mods, state: stateBefore, seen, look }));

        // 2. the duel at the mound — exact numbers, no roll: the bat's HIT slides in
        //    from the card, his WALL slides in from the stamina bar, bigger number wins.
        const r = resolvePA(e, stuff, ctx, rng);
        setBig(card, 'HIT', r.hit, p.HIT);
        setBig(card, 'POW', r.pow, p.POW);
        const hitCell = bigCell(card, 'HIT');
        const powCell = bigCell(card, 'POW');
        fireCell(hitCell);
        setWall(stuff, { flash: true });
        duelShow(r.hit, stuff);
        statChip(hitCell, $('#duel-hit'), r.hit, 'hit');
        statChip($('#wall-badge'), $('#duel-wall'), stuff, 'arm');
        await windup(card);
        duelResolve(r.reached);
        boostHost?.remove();
        // The verdict lands on the stat that was tested.
        if (r.reached) fireCell(hitCell);
        else { fireCell(hitCell, 'lost'); barHeld(); }

        // 3. the result — STAM DMG bites the tank; OUT wear is a different clay trail
        const d = Math.min(stamina, r.damage); // an empty tank cannot lose more
        stamina -= d;
        totalDrain += d;
        const freeOut = !r.reached && pit.efficient;
        const drainKind = r.reached ? 'pow' : 'wear';
        if (r.reached && d > 0) fireCell(powCell);
        stamBite(r.reached ? ($('#duel') || card) : card, d, { kind: drainKind, freeOut });
        // The tank visibly chips when the −N arrives, not before.
        clearTimeout(tankTimer);
        if (!REDUCED && d > 0) {
          const shown = stamina;
          tankTimer = setTimeout(() => setStamina(shown, pit.pool), 480);
        } else {
          setStamina(stamina, pit.pool);
        }
        const stateAfter = stateOf(stamina, pit.pool);

        const cause = tellFor(r, {
          pit, e, state: stateBefore, seen, look, mods, damage: d,
        });
        const R = RESULT[r.type];
        if (stampEl) {
          stampEl.textContent = R.word;
          stampEl.className = 'stamp show s-' + R.kind + (R.word.length > 6 ? ' long' : '');
        }
        showTell(card, cause);

        // The token the diamond follows: the engine carries this same object
        // from base to base, so the man on second is the man who reached first.
        const tok = { arch: e.arch, spot: slot + 1 };

        let scored = 0;
        if (!r.reached) {
          outs++; chain = 0; setOuts(outs); setRally(0); audio.whiff();
          theField()?.retire({ batter: tok, word: R.word });
          ring(ctr(card).x, ctr(card).y, { c: '232,80,58', r1: 90, life: 460, w: 3 });
          dirtPuff(card);
          card.classList.add('whiffed');
          card.addEventListener('animationend', () => card.classList.remove('whiffed'), { once: true });
        } else {
          const before = bases;
          const a = advanceRunners(before, r, tok, rng, { noStretch: !!pit.noStretch });
          bases = a.bases; scored = a.runs; runs += scored; totalRuns += scored;
          chain++;
          setRally(chain);
          // Runs tick over as each man actually touches home.
          let crossed = totalRuns - scored;
          theField()?.play({
            before, after: bases, batter: tok,
            word: R.word, kind: r.type === 'HR' ? 'big' : R.kind,
            score: () => setRuns(Math.min(totalRuns, ++crossed)),
          });
          fireLinksInto(slot); // the ropes that fed this bat just got paid
          const c = ctr(card);
          // Weight the contact flash by POW so hard contact reads as power, not just "a hit."
          const pow = r.pow || e.POW || 1;
          const arcPow = r.type === 'HR' ? 4.2
            : r.type === '2B' ? 2.4 + Math.min(1.2, pow / 12)
            : 1 + Math.min(1.4, pow / 10);
          if (r.type === 'HR') {
            audio.homer(); fireworks(card); shake();
            ring(c.x, c.y, { c: '255,240,206', r1: 280 + pow * 8, life: 900, w: 6 });
            ballArc(card, arcPow); linkField.flashAll(1.1);
          } else {
            audio.crack(); chalkPuff(card);
            ring(c.x, c.y, {
              c: r.type === '2B' ? '255,206,122' : '255,179,71',
              r1: 110 + pow * 10 + r.bases * 28,
              life: 560 + pow * 18,
              w: 3 + Math.min(3, pow / 5),
            });
            ballArc(card, arcPow);
            if (scored) audio.cheer(false);
          }
          if (chain > 1) audio.rally(chain);
        }

        markScorecard(f, slot,
          `<span class="mark m-${R.kind}" title="${p.n} ${R.tell}${cause ? ` — ${cause}` : ''}">${R.word}${scored ? `<span class="rbi">+${scored}</span>` : ''}</span>`);

        const causeNote = cause ? ` <span class="idle">· ${cause}</span>` : '';
        logLines.push(`<div class="ln ${r.reached ? 'r-hit' : 'r-out'}">
          <span class="who">${p.n}</span>
          <span class="res"><b>${R.tell}</b>${causeNote}${scored ? ` <span class="scored">· ${scored} run${scored > 1 ? 's' : ''} score</span>` : ''}</span></div>`);

        // Hold on the result so the stamp / tell / diamond / stamina change can land.
        await hold(r.type === 'HR' ? PACE.hr : r.reached ? PACE.hit : PACE.out);
        if (shownRuns < totalRuns) setRuns(totalRuns); // net, if a man is still rounding
        clearTell(card);

        // Target reached — night is over. Don't keep pitching after you've already won.
        if (totalRuns >= rung.target) {
          walkOff = true;
          logLines.push(`<span class="inn-div" style="color:var(--bulb)">That's enough — ${totalRuns} of ${rung.target}</span>`);
          await banner("THAT'S ENOUGH");
          break;
        }

        if (stateAfter !== stateBefore) {
          if (stateAfter === 'BROKEN') brokeInning = f + 1;
          logLines.push(`<span class="inn-div" style="color:var(--bulb)">${STATE_BANNER[stateAfter]} — the lineup opens up</span>`);
          audio.groan(stateAfter === 'BROKEN');
          linkField.flashAll(1.3);
          if (stateAfter === 'BROKEN') { shake(); fireworks($('#stam-bar')); }
          await banner(STATE_BANNER[stateAfter]);
          await hold(PACE.stateHold);
        }
      }
      if (outs < 3 && !walkOff) {
        logLines.push(`<span class="inn-div">Side retired — the pitcher escapes the inning</span>`);
      }
      theField()?.strand(); // whoever is left on walks off as the inning turns
      inningRuns.push(runs);
      const pip = document.querySelectorAll('#innings .inn-pip')[f];
      if (pip) { pip.classList.remove('live'); pip.classList.add('on'); }
      if (!walkOff) await hold(PACE.inningGap);
    }

    const finalState = stateOf(stamina, pit.pool);
    $('#log-head').textContent = `${totalRuns} of ${rung.target}`;
    $('#log').innerHTML = logLines.join('');
    const expand = $('#pbp-expand');
    if (expand) expand.hidden = !logLines.length;
    const topLook = Math.max(...looks);
    $('#summary').innerHTML =
      `You scored <b>${totalRuns}</b> (${inningRuns.join(' · ')} by inning) and needed <b>${rung.target}</b>. ` +
      `Your <b>${order.length}</b> bats emptied <b>${Math.round(totalDrain)}</b> of the pitcher's stamina — the pitcher finished <b>${STATE_INFO[finalState].label}</b>` +
      `${brokeInning ? `, broken in inning <b>${brokeInning}</b>` : ''}. ` +
      (topLook < 3
        ? `No bat came up more than <b>${topLook}×</b>, so the pitcher never got much of a read.`
        : order.length < 8
          ? `The pitcher got up to <b>${topLook} looks</b> at the same bat. <b>More seats spread the looks out.</b>`
          : `Long innings gave the pitcher up to <b>${topLook} looks</b> at some bats — a bat the pitcher has seen is easier to put away.`);

    finishRound(totalRuns, rung, finalState, brokeInning);
  } catch (err) {
    console.error('playRound failed', err);
    showVerdict('lose', `<div class="v-title">SOMETHING BROKE</div>
      <div class="v-body">The night stalled mid-play. Try again from the map.<br><span style="opacity:.7">${String(err?.message || err)}</span></div>
      <button class="act go" id="retry-shop" style="flex:0 0 auto">BACK TO MAP</button>`);
    S.mapNav = retryBossNav(S.map.acts[S.rung]);
    S.phase = 'lost';
  } finally {
    S.playing = false;
    document.querySelectorAll('.pc').forEach((c) => {
      c.classList.remove('at-bat', 'link-hot', 'loading', 'swing');
      clearTell(c);
    });
    document.querySelectorAll('.boosts').forEach((b) => b.remove());
    setRally(0);
    $('#board')?.classList.remove('playing');
    updatePlayButton();
  }
}

/** Grow the run ladder + map when the player clears the current last arm. */
function extendRunLadder(fromPitcherId) {
  const { newlyUnlocked, nextId } = unlockAfterBeat(fromPitcherId);
  const onLadder = new Set(ladder().map((r) => r.pitcher));
  // Prefer a freshly unlocked arm; else any next catalog arm not yet on this run;
  // else rematch the arm just beaten so the run never soft-ends.
  let addId = null;
  let rematch = false;
  if (newlyUnlocked && !onLadder.has(newlyUnlocked)) addId = newlyUnlocked;
  else if (nextId && !onLadder.has(nextId)) addId = nextId;
  else {
    const later = nextPitcherAfter(fromPitcherId);
    if (later && !onLadder.has(later)) addId = later;
    else {
      addId = fromPitcherId;
      rematch = true;
    }
  }
  const def = LADDER_DEFS[addId];
  if (!def) return { newlyUnlocked, next: null, rematch: false };
  S.ladder.push({ ...def });
  appendAct(S.map, S.ladder.length - 1);
  return { newlyUnlocked, next: S.ladder[S.ladder.length - 1], rematch };
}

function finishRound(runs, rung, finalState, brokeInning) {
  const won = runs >= rung.target;
  const pit = pitcherOf(S.rung);
  const charmWin = sumCharmEffect(S.charms, 'goldOnWin');
  const charmLoss = sumCharmEffect(S.charms, 'lossGoldBonus');

  // Scrimmage bets cash only after the night settles — stake was already paid.
  const bet = settlePendingBet({ gold: S.gold, pendingBet: S.pendingBet }, won);
  S.gold = bet.state.gold;
  S.pendingBet = null;
  const betLine = bet.log ? `<br>${bet.log}.` : '';

  // Complete the boss node on the map whenever the night ends.
  const bossNodeId = S.mapNav?.current;
  if (bossNodeId && won) {
    S.mapNav = advanceNav(S.map.acts[S.rung], S.mapNav, bossNodeId);
  }

  if (won) {
    const pay = ECONOMY.winGold(S.rung) + charmWin;
    S.gold += pay;

    let newlyUnlocked = null;
    // Clearing the last arm on the current ladder unlocks the next pitcher
    // and appends a fresh map act — the run keeps going until lives hit 0.
    if (S.rung === ladder().length - 1) {
      const ext = extendRunLadder(pit.id);
      newlyUnlocked = ext.newlyUnlocked;
    } else {
      ({ newlyUnlocked } = unlockAfterBeat(pit.id));
    }

    S.phase = 'won';
    const next = ladder()[S.rung + 1];
    const np = PITCHERS.find((p) => p.id === next.pitcher);
    const unlockLine = newlyUnlocked
      ? `<br>Unlocked <b>${LADDER_DEFS[newlyUnlocked]?.name || newlyUnlocked}</b> — a new path is open.`
      : '';
    const rematchNote = next.pitcher === pit.id
      ? ' Full ladder cleared — rematch and keep going until lives run out.'
      : '';
    showVerdict('win', `<div class="v-title">YOU WIN</div>
      <div class="v-body">Scored <b>${runs}</b>, needed <b>${rung.target}</b>${brokeInning ? ` — and you <b>broke the pitcher</b> in inning ${brokeInning}` : ''}.
      Earned <span class="v-reward">+${pay}g</span>${bet.payout ? ` · bet <span class="v-reward">+${bet.payout}g</span>` : ''} (now <b>${S.gold}g</b>). Lives: <b>${S.lives}</b>.${betLine}${unlockLine}<br>
      Next: <b>${next.name}</b> — ${np.n}. ${np.note || 'Walk the next path.'}${rematchNote}</div>
      <button class="act go" id="advance" style="flex:0 0 auto">NEXT MAP</button>`);
    audio.win(); confetti();
    renderWallet(); updatePlayButton();
    return;
  }

  S.lives -= 1;
  const lossPay = ECONOMY.lossGold + charmLoss;
  S.gold += lossPay;
  const excuse = finalState === 'FRESH'
    ? 'The pitcher never left Fresh — draft wear (Grinders, Patients, sponsor gear that makes outs cost the pitcher) or fill more seats.'
    : finalState === 'BROKEN'
      ? 'You broke the pitcher but could not cash it in — resequence so Sluggers, Closers, and Rally men feast on the collapse.'
      : `The pitcher finished ${STATE_INFO[finalState].label} — close. Return to the path and try again.`;

  if (S.lives <= 0) {
    S.phase = 'dead';
    showVerdict('lose', `<div class="v-title">THE RUN IS OVER</div>
      <div class="v-body">You scored <b>${runs}</b> and needed <b>${rung.target}</b> against ${pit.n}.
      No lives left — that is the only way a run ends. You made it to opponent <b>${S.rung + 1}</b>.${betLine}<br>${excuse}</div>
      <button class="act go" id="restart" style="flex:0 0 auto">BACK TO TITLE</button>`);
    audio.lose();
    renderWallet(); updatePlayButton();
    renderPhaseChrome();
    return;
  }

  // Reopen the pre-boss layer for another crack at the path.
  S.mapNav = retryBossNav(S.map.acts[S.rung]);
  S.phase = 'lost';
  showVerdict('lose', `<div class="v-title">THE PITCHER HELD YOU</div>
    <div class="v-body">Scored <b>${runs}</b>, needed <b>${rung.target}</b>. Lost a life — <b>${S.lives}</b> left.
    Consolation <span class="v-reward">+${lossPay}g</span> (now <b>${S.gold}g</b>).${betLine}<br>
    ${excuse} The same pitcher is waiting — walk the path again.</div>
    <button class="act go" id="retry-shop" style="flex:0 0 auto">BACK TO MAP</button>`);
  audio.lose();
  renderWallet(); updatePlayButton();
}

/* =================== rules strip =================== */
function setRulesCollapsed(collapsed) {
  const el = $('#rules');
  if (!el) return;
  el.classList.toggle('collapsed', collapsed);
  const btn = $('#rules-toggle');
  if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  try { localStorage.setItem(RULES_KEY, collapsed ? '1' : '0'); } catch (_) {}
}
function initRules() {
  let hide = false;
  try { hide = localStorage.getItem(RULES_KEY) === '1'; } catch (_) {}
  setRulesCollapsed(hide);
}

/* =================== events =================== */
function applyRunBag(bag) {
  S.gold = bag.gold;
  S.owned = bag.owned;
  S.loose = bag.loose;
  S.charms = bag.charms;
  S.gearMap = bag.gearMap;
  if (bag.lineup) S.lineup = bag.lineup;
  if ('pendingBet' in bag) S.pendingBet = bag.pendingBet;
}

function resolveEventChoice(choiceIdx) {
  if (S.phase !== 'event' || !S.event) return;
  const choice = S.event.choices[choiceIdx];
  if (!choice) return;
  const { state, followup, done } = applyEventEffect({
    gold: S.gold,
    owned: S.owned,
    loose: S.loose,
    charms: S.charms,
    gearMap: S.gearMap,
    lineup: S.lineup,
    rung: S.rung,
    pendingBet: S.pendingBet,
  }, choice.effect);
  applyRunBag(state);
  if (!done) {
    audio.reject();
    renderWallet();
    renderEvent();
    return;
  }
  audio.coin();
  if (followup) {
    S.eventFollowup = followup;
    renderWallet();
    renderTray();
    renderEvent();
    return;
  }
  // Finish the event node.
  const nodeId = S.mapNav?.current;
  if (nodeId) finishMapNode(nodeId);
  else enterMapPhase();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#rules-gotit')) { setRulesCollapsed(true); return; }
  if (e.target.closest('#rules-toggle')) { setRulesCollapsed(!$('#rules').classList.contains('collapsed')); return; }

  if (e.target.closest('#pbp-expand')) { openPlayByPlay(); return; }
  if (e.target.closest('#pbp-close') || e.target.closest('#pbp-backdrop')) { closePlayByPlay(); return; }

  if (e.target.closest('#speed')) { cycleSpeed(); return; }

  if (e.target.closest('#new-run')) { startNewRun(); return; }

  const mapNode = e.target.closest('[data-map-node]');
  if (mapNode) {
    selectMapNode(mapNode.dataset.mapNode);
    return;
  }

  const evChoice = e.target.closest('[data-event-choice]');
  if (evChoice) {
    resolveEventChoice(+evChoice.dataset.eventChoice);
    return;
  }
  const evPick = e.target.closest('[data-event-pick]');
  if (evPick && S.eventFollowup?.type === 'draftOne') {
    const offer = S.eventFollowup.offers[+evPick.dataset.eventPick];
    if (!offer) return;
    const { state, ok } = claimFreeBatter({
      gold: S.gold, owned: S.owned, loose: S.loose, charms: S.charms,
      gearMap: S.gearMap, lineup: S.lineup, rung: S.rung,
    }, offer.id);
    if (!ok) { audio.reject(); return; }
    applyRunBag(state);
    audio.snap();
    const nodeId = S.mapNav?.current;
    if (nodeId) finishMapNode(nodeId);
    else enterMapPhase();
    return;
  }
  const evRemove = e.target.closest('[data-event-remove]');
  if (evRemove && S.eventFollowup?.type === 'removeCard') {
    const { state, ok } = removeOwnedCard({
      gold: S.gold, owned: S.owned, loose: S.loose, charms: S.charms,
      gearMap: S.gearMap, lineup: S.lineup, rung: S.rung,
    }, evRemove.dataset.eventRemove);
    if (!ok) { audio.reject(); return; }
    applyRunBag(state);
    audio.coin();
    const nodeId = S.mapNav?.current;
    if (nodeId) finishMapNode(nodeId);
    else enterMapPhase();
    return;
  }
  if (e.target.closest('[data-event-skip-remove]')) {
    S.gold += 1;
    audio.coin();
    const nodeId = S.mapNav?.current;
    if (nodeId) finishMapNode(nodeId);
    else enterMapPhase();
    return;
  }

  if (e.target.closest('#reroll')) { rerollDraft(); return; }

  // Draft cards are bought via pointer (click or drag) — avoid double-buy here.

  const pickSp = e.target.closest('[data-pick-sponsor]');
  if (pickSp) {
    if (!sponsorPhaseOk()) return;
    S.chosenSponsor = pickSp.dataset.pickSponsor;
    audio.snap();
    renderMarket();
    updatePlayButton();
    return;
  }
  // Sponsor gear is bought via pointer (click or drag) — avoid double-buy here.

  const sellB = e.target.closest('[data-sell-batter]');
  if (sellB) { sellBatter(sellB.dataset.sellBatter); return; }
  const sellG = e.target.closest('[data-sell-gear]');
  if (sellG) { sellLooseGear(sellG.dataset.sellGear); return; }
  const sellC = e.target.closest('[data-sell-charm]');
  if (sellC) {
    const id = sellC.dataset.sellCharm;
    const i = S.charms.findIndex((c) => c.id === id);
    if (i < 0) return;
    const [c] = S.charms.splice(i, 1);
    S.gold += sellPrice(c);
    audio.coin();
    renderWallet(); renderTray();
    return;
  }

  if (e.target.closest('#play')) return advanceFromPlayButton();

  if (e.target.closest('#advance')) {
    S.rung++;
    S.mapNav = startActNav(S.map.acts[S.rung]);
    const intro = showNightIntro();
    enterMapPhase();
    void intro;
    return;
  }
  if (e.target.closest('#retry-shop')) {
    enterMapPhase();
    audio.bell();
    return;
  }
  if (e.target.closest('#restart') || (e.target.closest('#reset') && !S.playing)) {
    enterTitlePhase();
    audio.bell();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePlayByPlay();
});

initRules();
initSpeed();
initTips();
initHexMapEvents();

/* Title bed: loop the reel; if it never loads, peel it off so title-bg.png shows. */
{
  const vid = $('#title-bg-video');
  if (vid) {
    const bail = () => { vid.remove(); };
    vid.addEventListener('error', bail);
    vid.querySelector('source')?.addEventListener('error', bail);
    const kick = () => { vid.play?.().catch(() => {}); };
    vid.addEventListener('loadeddata', kick);
    kick();
  }
}

renderAll();
renderScorecard();
theField()?.clear();
scheduleLinkSync();

/* Dev / playtest hook — seat a board and run a night without hand-dragging. */
window.__lineup = {
  state: () => ({
    gold: S.gold, lives: S.lives, phase: S.phase, playing: S.playing, rung: S.rung,
    seated: seatedCount(S.lineup), links: boardSetup(S.lineup, S.gearMap, S.charms).links.length,
    owned: [...S.owned], charms: S.charms.map((c) => c.id), chosenSponsor: S.chosenSponsor,
    ladder: ladder().map((r) => r.pitcher),
    runs: $('#runs')?.textContent, stamina: $('#stam-state')?.textContent,
    summary: $('#summary')?.textContent, verdict: $('#verdict-top')?.textContent?.trim().slice(0, 200),
  }),
  /** Playtest divisor. Call with no args to read; with a number to set. Always ≥ 1. */
  turbo: (n) => (n == null ? TURBO : (TURBO = Math.max(1, Number(n) || 1))),
  field: () => ({ ok: linkField.ok, ropes: linkRopes.length, ...(linkField.probe ? linkField.probe() : {}) }),
  /** The diamond, for eyeballing basepath moves without a whole night. */
  diamond: () => theField(),
  /** Seat owned bats into slots (dugout assemble without drag). */
  putOwned(count = 2) {
    S.phase = 'dugout';
    S.lineup = Array(9).fill(null);
    S.owned.slice(0, count).forEach((id, i) => { S.lineup[i] = byId(id); });
    S.dealt = false;
    renderAll();
    return window.__lineup.state();
  },
  /** Seat a board without playing — for eyeballing links and layout. */
  seat({ seat = 6, gaps = false, ids = null, rung = 0 } = {}) {
    S = freshRun();
    S.ladder = buildLadder(UNLOCK_ORDER);
    S.map = generateRunMap(S.ladder.length, S.runSeed);
    S.rung = Math.min(rung, S.ladder.length - 1);
    S.mapNav = startActNav(S.map.acts[S.rung]);
    S.phase = 'dugout';
    const pool = ids ? ids.map(byId) : HITTERS.filter((h, _, arr) => {
      // one card per lineage for auto-seat
      return arr.find((x) => x.lineage === h.lineage) === h;
    });
    const bats = pool.filter(Boolean).slice(0, seat);
    for (const h of bats) if (!S.owned.includes(h.id)) S.owned.push(h.id);
    S.lineup = Array(9).fill(null);
    const seats = gaps ? [0, 2, 4, 6, 8, 1, 3, 5, 7] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    bats.forEach((h, i) => { S.lineup[seats[i]] = h; });
    S.dealt = false;
    renderAll(); renderScorecard();
    return window.__lineup.state();
  },
  /** seat: how many bats. gaps: leave holes between them. ids: explicit roster. */
  async quickNight({ seat = 6, gaps = false, ids = null, rung = 0 } = {}) {
    if (S.playing) return { error: 'already playing' };
    S = freshRun();
    S.ladder = buildLadder(UNLOCK_ORDER);
    S.map = generateRunMap(S.ladder.length, S.runSeed);
    S.rung = Math.min(rung, S.ladder.length - 1);
    const boss = S.map.acts[S.rung].layers.at(-1)[0];
    S.mapNav = { ...startActNav(S.map.acts[S.rung]), current: boss.id, available: [boss.id] };
    S.phase = 'dugout';
    const pool = ids
      ? ids.map(byId)
      : HITTERS.filter((h, _, arr) => arr.find((x) => x.lineage === h.lineage) === h);
    const bats = pool.filter(Boolean).slice(0, seat);
    for (const h of bats) if (!S.owned.includes(h.id)) S.owned.push(h.id);
    S.lineup = Array(9).fill(null);
    const seats = gaps ? [0, 2, 4, 6, 8, 1, 3, 5, 7] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    bats.forEach((h, i) => { S.lineup[seats[i]] = h; });
    S.dealt = false;
    $('#verdict').className = 'verdict';
    renderAll();
    renderScorecard();
    try {
      await playRound();
      return window.__lineup.state();
    } finally {
      // Never leave a console turbo divisor sticky in the live tab.
      TURBO = 1;
    }
  },
};
