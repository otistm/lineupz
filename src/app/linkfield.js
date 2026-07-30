/* LINEUP — the synergy field.
   A single WebGL quad behind the order draws every active link as a living rope:
   chalk-grained core, travelling beads that show which way the help flows, and a
   heat haze that swells while a rally is running. Purely decorative: if WebGL is
   missing the game plays exactly the same, just quieter. */

const MAX_SEG = 36;
const MAX_DPR = 1.5; // decorative layer: keep the fill cheap

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
#define MAX ${MAX_SEG}
uniform vec2 uRes;
uniform float uTime;
uniform float uHeat;
uniform int uCount;
uniform vec2 uA[MAX];
uniform vec2 uB[MAX];
uniform vec3 uCol[MAX];
uniform float uFlash[MAX];

float hash(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.07))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col = vec3(0.0);
  float ink = 0.0;

  for (int i = 0; i < MAX; i++){
    if (i >= uCount) break;
    vec2 a = uA[i], b = uB[i];
    vec2 ba = b - a, pa = p - a;
    float len2 = max(dot(ba, ba), 1.0);
    float t = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    float d = length(pa - ba * t);
    if (d > 46.0) continue;
    float fl = uFlash[i];

    float breathe = 0.82 + 0.18 * sin(uTime * 2.1 + float(i) * 1.7);
    float w = 2.6 + 1.3 * uHeat + 5.5 * fl;
    float core = exp(-(d * d) / (w * w));
    float halo = exp(-(d * d) / (150.0 + 320.0 * uHeat + 1100.0 * fl));

    // beads run from the giver toward the batter being helped
    float bp = fract(t * 1.15 - uTime * (0.34 + 0.5 * uHeat + 1.3 * fl) + float(i) * 0.21);
    float bead = exp(-pow((bp - 0.5) * 8.0, 2.0)) * exp(-(d * d) / (42.0 + 160.0 * fl));

    float grain = 0.78 + 0.44 * noise(p * 0.075 + vec2(uTime * 0.4, -uTime * 0.22));
    float amp = (0.9 + 0.6 * uHeat + 1.8 * fl) * breathe;

    col += uCol[i] * ((core * 1.35 + bead * 1.7) * grain + halo * 0.16) * amp;
    ink += core * 1.2 + bead * 0.8 + halo * 0.1;
  }

  float haze = uHeat * uHeat * (0.045 + 0.05 * noise(p * 0.018 + vec2(uTime * 0.12, uTime * 0.07)));
  col += vec3(1.0, 0.70, 0.32) * haze;

  float a = clamp(ink * 0.85 + haze * 4.0, 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(1.6)), a);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('linkfield shader failed', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

const NOOP = {
  ok: false,
  setLinks() {}, flash() {}, flashAll() {}, setHeat() {}, resize() {}, clear() {},
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{reduced?: boolean}} opts
 */
export function createLinkField(canvas, { reduced = false } = {}) {
  if (!canvas) return NOOP;
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false, depth: false,
      preserveDrawingBuffer: true, // so the field shows up in screen captures
    });
  } catch (_) { gl = null; }
  if (!gl) return NOOP;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return NOOP;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('linkfield link failed', gl.getProgramInfoLog(prog));
    return NOOP;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, 'uRes'),
    time: gl.getUniformLocation(prog, 'uTime'),
    heat: gl.getUniformLocation(prog, 'uHeat'),
    count: gl.getUniformLocation(prog, 'uCount'),
    a: gl.getUniformLocation(prog, 'uA'),
    b: gl.getUniformLocation(prog, 'uB'),
    col: gl.getUniformLocation(prog, 'uCol'),
    flash: gl.getUniformLocation(prog, 'uFlash'),
  };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* segment data, flattened from link paths */
  const A = new Float32Array(MAX_SEG * 2);
  const B = new Float32Array(MAX_SEG * 2);
  const C = new Float32Array(MAX_SEG * 3);
  const F = new Float32Array(MAX_SEG);
  const groupOf = new Int32Array(MAX_SEG).fill(-1);
  let count = 0;
  let heat = 0, heatTarget = 0;
  let w = 0, h = 0;
  let running = false, last = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    w = cw; h = ch;
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, canvas.width, canvas.height);
  }

  /** links: [{ id, pts:[[x,y],...], color:[r,g,b] }] in CSS px, canvas-relative */
  function setLinks(links) {
    count = 0;
    for (let li = 0; li < links.length; li++) {
      const { pts, color } = links[li];
      for (let k = 0; k + 1 < pts.length && count < MAX_SEG; k++) {
        const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
        A[count * 2] = pts[k][0] * dpr;      A[count * 2 + 1] = pts[k][1] * dpr;
        B[count * 2] = pts[k + 1][0] * dpr;  B[count * 2 + 1] = pts[k + 1][1] * dpr;
        C[count * 3] = color[0]; C[count * 3 + 1] = color[1]; C[count * 3 + 2] = color[2];
        groupOf[count] = li;
        count++;
      }
    }
    for (let i = count; i < MAX_SEG; i++) { F[i] = 0; groupOf[i] = -1; }
    start();
  }

  function flash(group, amount = 1) {
    for (let i = 0; i < count; i++) if (groupOf[i] === group) F[i] = Math.min(1.6, F[i] + amount);
    start();
  }
  function flashAll(amount = 0.7) { for (let i = 0; i < count; i++) F[i] = Math.min(1.6, F[i] + amount); start(); }
  function setHeat(v) { heatTarget = Math.max(0, Math.min(1, v)); start(); }
  function clear() { count = 0; heat = heatTarget = 0; draw(0); }

  function draw(t) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!count && heat < 0.01) return;
    gl.uniform1f(U.time, t);
    gl.uniform1f(U.heat, heat);
    gl.uniform1i(U.count, count);
    gl.uniform2fv(U.a, A);
    gl.uniform2fv(U.b, B);
    gl.uniform3fv(U.col, C);
    gl.uniform1fv(U.flash, F);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    heat += (heatTarget - heat) * Math.min(1, dt * 4);
    let live = heat > 0.01;
    for (let i = 0; i < count; i++) {
      if (F[i] > 0.001) { F[i] *= Math.exp(-dt * 3.4); live = true; } else F[i] = 0;
    }
    draw(now / 1000);
    // Reduced motion gets the ropes drawn, but held still. Hidden tabs stop entirely.
    if (!reduced && !document.hidden && (count || live)) requestAnimationFrame(frame);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true; last = performance.now();
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  resize();
  addEventListener('resize', () => { resize(); start(); });
  /** Debug: how much light is actually on the field right now. */
  function probe() {
    const cw = canvas.width, ch = canvas.height;
    const px = new Uint8Array(4 * cw * ch);
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0, lit = 0, peak = 0;
    for (let i = 0; i < px.length; i += 4) {
      const v = px[i] + px[i + 1] + px[i + 2];
      sum += v; if (v > 24) lit++; if (v > peak) peak = v;
    }
    return { segments: count, heat: Number(heat.toFixed(2)), litPixels: lit, peak, avg: Math.round(sum / (cw * ch)) };
  }

  return { ok: true, setLinks, flash, flashAll, setHeat, resize, clear, probe, MAX_SEG };
}

export const LINK_COLOR = {
  WORN:      [0.78, 0.50, 0.31],
  TABLESET:  [1.00, 0.72, 0.30],
  ATTRITION: [0.62, 0.40, 0.24],
  IGNITE:    [0.38, 0.87, 0.62],
};
