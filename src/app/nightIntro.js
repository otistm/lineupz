/* Fullscreen WebGL night card — stadium lights warm up over the type plate.
   Ported from the night1-jamie-moyer reference; fonts are LINEUPZ's.
   Field bed is solid black. */

/* Hold through lamp cut-out; CSS handles the dissolve to the map. */
const LOOP = 6.55;

const VS = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }
`;

const FS = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uT;
uniform sampler2D uTex;

const float PI = 3.14159265;

float sat(float x){ return clamp(x,0.0,1.0); }
float span(float t,float a,float b){ return sat((t-a)/(b-a)); }

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*0.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),f.x),
             mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),f.x), f.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  mat2 m = mat2(0.80,0.60,-0.60,0.80);
  for(int i=0;i<4;i++){ v += a*vnoise(p); p = m*p*2.02; a *= 0.5; }
  return v;
}

vec3 T(vec2 uv){
  if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return vec3(0.0);
  return texture2D(uTex, uv).rgb;
}

vec2 lampState(float fi, float t){
  float ord = mod(fi*3.0, 4.0);
  float t0  = 0.24 + ord*0.34;
  float dt  = t - t0;
  float on  = step(0.0, dt);

  float strike = exp(-max(dt,0.0)*24.0) * on * 1.25;
  float wu     = sat(dt/1.70);
  float ramp   = pow(wu, 2.3) * on;

  float fl = 1.0 + (hash11(floor(t*17.0) + fi*7.3) - 0.5) * 1.35 * (1.0 - wu);
  ramp *= max(fl, 0.12);

  float e = strike + ramp;

  float blast = span(t, 2.80, 3.10);
  e *= mix(1.0, 1.30, blast);
  e += exp(-pow((t-3.02)/0.09, 2.0)) * 0.70 * on;

  float off  = 5.60 + mod(fi, 2.0)*0.44;
  float dOff = max(t - off, 0.0);
  float cut  = step(off, t);
  e = e * exp(-dOff*8.5) + cut * exp(-dOff*1.7) * 0.055;

  float warmth = sat(wu*1.3) * exp(-dOff*3.2);
  return vec2(max(e,0.0), warmth);
}

vec3 lampColor(float warmth){
  return mix(vec3(1.00,0.30,0.06), vec3(0.80,0.88,1.00), smoothstep(0.0,1.0,warmth));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p  = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
  float aspect = uRes.x / uRes.y;
  float t = uT;

  float hy = -0.30;
  float gm = smoothstep(hy+0.004, hy-0.004, p.y);

  vec3 col = mix(vec3(0.004,0.006,0.014), vec3(0.016,0.024,0.048), sat(0.55 - p.y*0.5));
  col += vec3(0.010,0.014,0.030) * fbm(p*1.4 + vec2(uTime*0.02, 0.0));
  col *= 1.0 - gm;

  float bw = min(0.185, aspect*0.115);
  float bh = bw*0.44;
  vec2  cell = vec2(bw/6.0, bh/3.0);

  vec3 fixtures = vec3(0.0);
  vec3 illum    = vec3(0.0);
  vec3 field    = vec3(0.0);
  float E = 0.0;
  float bugs = 0.0;
  float hous = 0.0;

  for(int i=0;i<4;i++){
    float fi = float(i);
    vec2  st = lampState(fi, t);
    float en = st.x;
    vec3  lc = lampColor(st.y);
    E += en*0.25;

    vec2 C = vec2((0.115 + fi*0.2567 - 0.5)*aspect, 0.395);
    vec2 q = p - C;

    float inRect = step(abs(q.x), bw*0.5) * step(abs(q.y), bh*0.5);
    hous = max(hous, inRect);

    vec2 g  = q/cell;
    vec2 id = floor(g) + 0.5;
    vec2 bc = id*cell;
    float d = length(q - bc);
    float jit = 0.72 + 0.56*hash21(id + fi*13.7);
    float be  = en*jit*inRect;
    fixtures += lc * be * (exp(-d*d/0.00013)*1.5 + exp(-d*26.0)*0.30);

    for(int r=0;r<3;r++){
      float ry = (float(r)-1.0)*cell.y;
      float dy = q.y - ry;
      float sx = smoothstep(bw*0.72, bw*0.26, abs(q.x));
      fixtures += lc * en * exp(-dy*dy/0.000055) * (0.30*sx + 0.07*exp(-abs(q.x)*3.2));
    }

    float dd = length(q*vec2(0.70,1.55));
    fixtures += lc * en * (exp(-dd*4.2)*0.50 + exp(-abs(q.x)*70.0)*exp(-abs(q.y)*5.5)*0.20);

    illum += lc * en * exp(-length(p-C)*1.85);

    vec2 pc = vec2(C.x*1.30, hy - 0.13);
    float pd = length((p - pc)*vec2(0.62, 2.30));
    field += lc * en * exp(-pd*pd*2.6);

    vec2 bq = (p - C)*vec2(5.5,5.5) + vec2(sin(uTime*0.7+fi)*0.6, uTime*0.09);
    vec2 bid = floor(bq), bf = fract(bq)-0.5;
    float br = hash21(bid + fi*31.0);
    bf += 0.34*vec2(sin(uTime*3.1+br*40.0), cos(uTime*2.4+br*27.0));
    bugs += step(0.90, br) * smoothstep(0.15,0.0,length(bf)) * en * exp(-length(p-C)*2.6);
  }

  /* Field bed — solid black; lamp pools still skim the plane. */
  col += gm * field * 0.06;

  col *= 1.0 - hous*0.80;
  col += fixtures;
  col += vec3(1.0,0.88,0.70) * bugs * 0.55;

  float gate = pow(sat(E*1.25), 1.7);
  vec3 lit = illum * gate * 0.85;

  /* Sharp type plate — sample dead on texel centres, no offset halo copies. */
  vec3 s0 = T(uv);
  float nameC = smoothstep(0.28, 0.52, s0.g);
  float kickC = smoothstep(0.28, 0.52, s0.r);
  float ruleC = smoothstep(0.22, 0.50, s0.b);

  vec3 board = nameC * vec3(0.96,0.975,1.00) * lit;
  board += kickC * vec3(1.06,0.90,0.72) * lit * 0.90;
  board += ruleC * vec3(1.05,0.82,0.58) * lit * 0.75;
  col += board;

  float blast = exp(-pow((t-3.02)/0.11, 2.0));
  col += vec3(0.70,0.78,0.98) * blast * 0.30;
  col += vec3(0.55,0.62,0.85) * exp(-abs(p.y-0.395)*7.0) * blast * 0.45;
  col += vec3(0.62,0.70,0.92) * E * 0.030;
  col *= mix(1.0, 0.88, sat(E*1.2-0.55));

  float vig = 1.0 - 0.90*dot(p*vec2(0.60,0.94), p*vec2(0.60,0.94));
  col *= sat(vig);
  col *= 0.968 + 0.032*sin(gl_FragCoord.y*PI);
  col += (hash21(gl_FragCoord.xy + fract(uTime)*137.0) - 0.5) * 0.034;
  /* Fade in only — CSS crossfades out to the map so we don't cut from black. */
  col *= span(t,0.0,0.20);

  col = col/(1.0+col*0.50);
  col = pow(max(col,1e-5), vec3(0.90));
  gl_FragColor = vec4(col,1.0);
}
`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[nightIntro]', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function faces() {
  let displayOK = false;
  let deckOK = false;
  try {
    displayOK = document.fonts?.check?.('400 100px "Alfa Slab One"');
    deckOK = document.fonts?.check?.('800 40px "Big Shoulders Display"');
  } catch (_) {}
  return {
    display: displayOK
      ? '400 %spx "Alfa Slab One"'
      : '900 %spx Impact, Haettenschweiler, "Arial Black", sans-serif',
    deck: deckOK
      ? '800 %spx "Big Shoulders Display"'
      : '700 %spx "Helvetica Neue", Arial, sans-serif',
    condense: displayOK ? 0.98 : 0.92,
  };
}

function fmt(tpl, size) {
  return tpl.replace('%s', size.toFixed(2));
}

function tracked(g, text, spacing) {
  let w = 0;
  for (let i = 0; i < text.length; i++) w += g.measureText(text[i]).width + spacing;
  return w - spacing;
}

function drawTracked(g, text, cx, y, spacing) {
  let x = cx - tracked(g, text, spacing) / 2;
  for (let i = 0; i < text.length; i++) {
    g.fillText(text[i], x, y);
    x += g.measureText(text[i]).width + spacing;
  }
}

function diamond(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  g.fill();
}

/**
 * Bind a WebGL night intro to a host element that contains a canvas.
 * Returns { ok, play({ kick, name }), stop }.
 */
export function createNightIntro(host, canvas) {
  if (!host || !canvas) return { ok: false, play: async () => {}, stop() {} };

  const gl = canvas.getContext('webgl', {
    antialias: false, alpha: false, depth: false, stencil: false,
    powerPreference: 'high-performance',
  }) || canvas.getContext('experimental-webgl', {
    antialias: false, alpha: false,
  });

  if (!gl) return { ok: false, play: async () => {}, stop() {} };

  const vs = compile(gl, gl.VERTEX_SHADER, VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return { ok: false, play: async () => {}, stop() {} };

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[nightIntro]', gl.getProgramInfoLog(prog));
    return { ok: false, play: async () => {}, stop() {} };
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uT = gl.getUniformLocation(prog, 'uT');
  const uTex = gl.getUniformLocation(prog, 'uTex');

  const plateTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, plateTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(uTex, 0);

  const tc = document.createElement('canvas');
  const tg = tc.getContext('2d');
  let kick = 'NIGHT 1';
  let name = 'LINEUPZ';
  let W = 0;
  let H = 0;
  let raf = 0;
  let start = 0;
  let running = false;
  let resolvePlay = null;

  function buildPlate(w, h) {
    tc.width = w;
    tc.height = h;
    const g = tg;
    const F = faces();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';

    const cx = w * 0.5;
    const cy = h * 0.52;
    const targetW = Math.min(w * 0.78, h * 1.50);

    g.font = fmt(F.display, 200);
    let nameSize = 200 * targetW / (g.measureText(name).width * F.condense);
    nameSize = Math.min(nameSize, h * 0.28);

    g.font = fmt(F.display, nameSize);
    const nameW = g.measureText(name).width;
    const nameY = cy + nameSize * 0.34;
    g.fillStyle = '#00ff00';
    g.save();
    g.translate(cx, 0);
    g.scale(F.condense, 1);
    g.translate(-cx, 0);
    g.fillText(name, cx - nameW / 2, nameY);
    g.restore();

    const kickSize = nameSize * 0.155;
    const track = kickSize * 0.52;
    g.font = fmt(F.deck, kickSize);
    const kickY = cy - nameSize * 0.50;
    const kickW = tracked(g, kick, track);
    g.fillStyle = '#ff0000';
    drawTracked(g, kick, cx, kickY, track);

    g.fillStyle = '#0000ff';
    const lh = Math.max(1, Math.round(h * 0.0020));
    const ly = Math.round(kickY - kickSize * 0.30);
    const gap = kickSize * 1.35;
    const len = nameSize * 0.55;
    g.fillRect(cx - kickW / 2 - gap - len, ly, len, lh);
    g.fillRect(cx + kickW / 2 + gap, ly, len, lh);
    diamond(g, cx - kickW / 2 - gap * 0.5, ly + lh / 2, kickSize * 0.15);
    diamond(g, cx + kickW / 2 + gap * 0.5, ly + lh / 2, kickSize * 0.15);

    const uy = Math.round(cy + nameSize * 0.60);
    const grad = g.createLinearGradient(cx - targetW / 2, 0, cx + targetW / 2, 0);
    grad.addColorStop(0.00, 'rgba(0,0,255,0)');
    grad.addColorStop(0.20, 'rgba(0,0,255,1)');
    grad.addColorStop(0.80, 'rgba(0,0,255,1)');
    grad.addColorStop(1.00, 'rgba(0,0,255,0)');
    g.fillStyle = grad;
    g.fillRect(cx - targetW / 2, uy, targetW, Math.max(2, lh * 1.5));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plateTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let w = Math.max(2, Math.round(host.clientWidth * dpr));
    let h = Math.max(2, Math.round(host.clientHeight * dpr));
    const scale = Math.min(1, 3200 / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    W = w;
    H = h;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(uRes, w, h);
    buildPlate(w, h);
  }

  const onResize = () => { if (running) resize(); };
  window.addEventListener('resize', onResize);

  function frame(now) {
    if (!running) return;
    const e = (now - start) / 1000;
    drawAt(e, now / 1000);
    if (e >= LOOP) {
      running = false;
      raf = 0;
      if (resolvePlay) {
        const r = resolvePlay;
        resolvePlay = null;
        r();
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (resolvePlay) {
      const r = resolvePlay;
      resolvePlay = null;
      r();
    }
  }

  function drawAt(t, wallTime = performance.now() / 1000) {
    if (!W || !H) resize();
    gl.useProgram(prog);
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, wallTime);
    gl.uniform1f(uT, Math.max(0, Math.min(t, LOOP)));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, plateTex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  async function play({ kick: k, name: n }) {
    kick = String(k || 'NIGHT 1').toUpperCase();
    // Pitcher plate stays title case (catalog names); only the night kicker is capped.
    name = String(n || 'Lineupz');
    stop();
    resize();
    buildPlate(W, H);
    // Swap in webfonts if they land mid-loop without blocking the first frame.
    try {
      document.fonts?.ready?.then(() => { if (running) buildPlate(W, H); });
    } catch (_) {}
    start = performance.now();
    running = true;
    drawAt(0, start / 1000);
    return new Promise((resolve) => {
      resolvePlay = resolve;
      raf = requestAnimationFrame(frame);
    });
  }

  return { ok: true, play, stop };
}
