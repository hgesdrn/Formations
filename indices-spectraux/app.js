// Paysage fictif, déterministe : 100 × 50 pixels, identique avant et après.
const W = 100, H = 50, N = W * H;
const BAND_KEYS = Object.keys(BANDS);

const state = { sensor: 'landsat', index: 'NDVI', disturbance: 'feu', cls: 'resineux', severity: 1, view: 'index' };

// ---------- Générateur pseudo-aléatoire et bruit ----------
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noiseField(seed, cell) {
  const r = rng(seed), gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
  const g = Array.from({ length: gw * gh }, r);
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = s(fx - x0), ty = s(fy - y0), at = (i, j) => g[(y0 + j) * gw + x0 + i];
    const a = at(0, 0) + (at(1, 0) - at(0, 0)) * tx;
    const b = at(0, 1) + (at(1, 1) - at(0, 1)) * tx;
    return a + (b - a) * ty;
  };
}
function fbm(seed) {
  const o = [noiseField(seed, 16), noiseField(seed + 1, 8), noiseField(seed + 2, 4)];
  return (x, y) => (o[0](x, y) * 4 + o[1](x, y) * 2 + o[2](x, y)) / 7;
}
const clamp01 = v => Math.max(0, Math.min(1, v));

// ---------- Construction du paysage ----------
const classIdx = Object.fromEntries(CLASSES.map((c, i) => [c.key, i]));
const land = new Uint8Array(N);
const footprint = {};
const pixNoise = new Float32Array(N * BAND_KEYS.length);

(function build() {
  const relief = fbm(11), forest = fbm(23), shore = fbm(37);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const dLake = Math.hypot((x - 74) / 1.4, y - 17) - (8 + shore(x, y) * 6);
    const river = x < 66 && Math.abs(y - (30 + 5 * Math.sin(x / 9))) < 1.1;
    const road = Math.abs(y - (6 + x * 0.42)) < 0.8 && x < 60;
    const village = Math.hypot(x - 10, y - 43) < 3.5 + relief(x, y) * 2;
    const h = relief(x, y), f = forest(x, y);
    let c;
    if (dLake < 0 || river) c = 'eau';
    else if (road || village) c = 'anthro';
    else if (dLake < 3 || h < 0.33) c = 'humide';
    else if (h > 0.74) c = 'solnu';
    else if (f < 0.5) c = 'resineux';
    else if (f < 0.62) c = 'mixte';
    else c = 'feuillus';
    land[i] = classIdx[c];
  }

  const r = rng(99);
  for (let k = 0; k < pixNoise.length; k++) pixNoise[k] = 1 + (r() - 0.5) * 0.12;

  const fireN = fbm(51), tbeN = fbm(61), livN = fbm(71), winN = fbm(81);
  const cuts = [[8, 14, 12, 7], [27, 20, 9, 11], [44, 10, 13, 7], [22, 36, 10, 8], [50, 32, 12, 9], [38, 40, 8, 6]];
  for (const k of Object.keys(DISTURBANCES)) footprint[k] = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const dFire = Math.hypot((x - 38) / 1.5, y - 26) - (17 + fireN(x, y) * 10);
    footprint.feu[i] = dFire < 0 ? (fireN(x + 50, y) > 0.38 ? 1 : 0.35) : 0;
    footprint.tbe[i] = clamp01((tbeN(x, y) - 0.38) * 4);
    footprint.livree[i] = clamp01((livN(x, y) - 0.4) * 4);
    footprint.coupe[i] = cuts.some(([cx, cy, w, h]) => x >= cx && x < cx + w && y >= cy && y < cy + h) ? 1 : 0;
    const strip = ((x + y * 0.7) / 9) % 1 < 0.28;
    footprint.chablis[i] = strip && winN(x, y) > 0.5 && x > 15 && x < 70 ? 1 : 0;
  }
})();

// ---------- Calculs ----------
const sensorBands = () => SENSORS[state.sensor].bands;

function mix(a, b, s) {
  const o = {};
  for (const k of BAND_KEYS) o[k] = a[k] + (b[k] - a[k]) * s;
  return o;
}
function classSpectrum(cls, s) {
  const c = CLASSES[classIdx[cls]], d = DISTURBANCES[state.disturbance];
  return mix(c.s, d.target, s * (d.affects[cls] || 0));
}
function pixelSpectrum(i, disturbed) {
  const c = CLASSES[land[i]];
  let sp = c.s;
  if (disturbed) {
    const d = DISTURBANCES[state.disturbance];
    sp = mix(sp, d.target, state.severity * footprint[state.disturbance][i] * (d.affects[c.key] || 0));
  }
  const o = {};
  BAND_KEYS.forEach((k, j) => (o[k] = sp[k] * pixNoise[i * BAND_KEYS.length + j]));
  return o;
}

const fmt = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2).replace('.', ',');
const fmtSigned = v => (v > 0 ? '+' : '') + fmt(v);

// ---------- Couleurs ----------
const hex = h => [1, 3, 5].map(j => parseInt(h.slice(j, j + 2), 16));
// [valeur, couleur] : arrêts placés là où les indices varient le plus.
const RAMPS = {
  veg:   [[-1, '#543005'], [0, '#D8B365'], [0.3, '#F6E8C3'], [0.6, '#7FBC41'], [0.9, '#1B5E20'], [1, '#1B5E20']],
  water: [[-1, '#1B5E20'], [-0.5, '#7FBC41'], [0, '#F6E8C3'], [0.3, '#6BAED6'], [1, '#08306B']],
};
for (const k in RAMPS) RAMPS[k] = RAMPS[k].map(([v, c]) => [v, hex(c)]);
function rampColor(v, ramp) {
  let j = 0;
  while (j < ramp.length - 2 && v > ramp[j + 1][0]) j++;
  const [v0, c0] = ramp[j], [v1, c1] = ramp[j + 1], f = clamp01((v - v0) / (v1 - v0));
  return c0.map((c, k) => c + (c1[k] - c) * f);
}
const rampOf = () => RAMPS[INDICES[state.index].ramp || 'veg'];
const CLASS_RGB = CLASSES.map(c => hex(c.color));

// ---------- Carte ----------
function drawMap(canvas, disturbed) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H);
  const idx = INDICES[state.index], ramp = rampOf(), sel = classIdx[state.cls];
  let sum = 0, n = 0;
  for (let i = 0; i < N; i++) {
    const v = idx.f(pixelSpectrum(i, disturbed));
    if (land[i] === sel) { sum += v; n++; }
    let rgb = state.view === 'index' ? rampColor(v, ramp) : CLASS_RGB[land[i]];
    if (land[i] !== sel) rgb = rgb.map(c => c + (128 - c) * 0.35);
    img.data.set([rgb[0], rgb[1], rgb[2], 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return n ? sum / n : NaN;
}

function renderMaps() {
  const name = CLASSES[classIdx[state.cls]].name;
  const mB = drawMap(document.getElementById('mapBefore'), false);
  const mA = drawMap(document.getElementById('mapAfter'), true);
  document.getElementById('tagBefore').textContent = `Avant · ${name} ${state.index} moyen ${fmt(mB)}`;
  document.getElementById('tagAfter').textContent =
    `Après ${DISTURBANCES[state.disturbance].name.toLowerCase()} · ${fmt(mA)} (${fmtSigned(mA - mB)})`;

  const res = Math.max(...INDICES[state.index].bands.map(b => sensorBands()[b].res));
  document.getElementById('scale').textContent = `Pixel ${res} m · ${(W * res / 1000).toLocaleString('fr-CA')} km × ${(H * res / 1000).toLocaleString('fr-CA')} km`;

  const lg = document.getElementById('legend');
  if (state.view === 'index') {
    const stops = rampOf().map(([v, c]) => `rgb(${c}) ${(v + 1) * 50}%`).join(',');
    const ticks = [-1, -0.5, 0, 0.5, 1].map(v => `<span style="left:${(v + 1) * 50}%">${fmt(v)}</span>`).join('');
    lg.innerHTML = `<div class="ramp"><div class="bar" style="background:linear-gradient(90deg,${stops})"></div><div class="ticks">${ticks}</div></div>`;
  } else {
    lg.innerHTML = CLASSES.map(c =>
      `<span class="sw${c.key === state.cls ? ' on' : ''}" data-k="${c.key}"><i style="background:${c.color}"></i>${c.name}</span>`).join('');
  }
}

// ---------- Graphiques ----------
const YMAX = 0.5;
function chartSVG(sp) {
  const keys = INDICES[state.index].bands, sb = sensorBands();
  const w = 300, h = 210, L = 34, R = 290, T = 14, B = 170;
  const y = v => B - (v / YMAX) * (B - T);
  const slot = (R - L) / keys.length, bw = Math.min(52, slot * 0.55);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img"><g class="grid">`;
  for (let t = 0; t <= YMAX + 1e-9; t += 0.1) {
    s += `<line x1="${L}" x2="${R}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t)}</text>`;
  }
  s += '</g>';
  keys.forEach((k, j) => {
    const v = sp[k], cx = L + slot * (j + 0.5), x = cx - bw / 2, top = y(v), r = Math.min(4, B - top);
    s += `<path d="M${x},${B}V${top + r}q0,-${r} ${r},-${r}H${x + bw - r}q${r},0 ${r},${r}V${B}Z" fill="${BANDS[k].color}">` +
         `<title>${BANDS[k].label} · ${sb[k].id} · ${sb[k].nm} nm · ${sb[k].res} m : ${fmt(v)}</title></path>`;
    s += `<text class="val" x="${cx}" y="${top - 5}" text-anchor="middle">${fmt(v)}</text>`;
    s += `<text class="bandlbl" x="${cx}" y="${B + 16}" text-anchor="middle">${BANDS[k].label}</text>`;
    s += `<text class="bandid" x="${cx}" y="${B + 30}" text-anchor="middle">${sb[k].id} · ${sb[k].nm} nm</text>`;
  });
  return s + '</svg>';
}

function chartCard(el, title, sp, ref) {
  const idx = INDICES[state.index], v = idx.f(sp);
  const sym = idx.expr.replace(/\{(\w+)\}/g, (_, k) => BANDS[k].label);
  const num = idx.expr.replace(/\{(\w+)\}/g, (_, k) => fmt(sp[k]));
  const delta = ref === undefined ? '' : `<span class="delta">Δ ${fmtSigned(v - ref)}</span>`;
  el.innerHTML = `<h2>${title}</h2>${chartSVG(sp)}
    <div class="formula">${state.index} = ${sym}</div>
    <div class="formula">${state.index} = ${num}</div>
    <div class="result">${fmt(v)}${delta}</div>`;
  return v;
}

function renderCharts() {
  const before = classSpectrum(state.cls, 0), after = classSpectrum(state.cls, state.severity);
  const name = CLASSES[classIdx[state.cls]].name;
  const vB = chartCard(document.getElementById('chartBefore'), `${name} · non perturbé`, before);
  chartCard(document.getElementById('chartAfter'), `${name} · ${DISTURBANCES[state.disturbance].name.toLowerCase()}`, after, vB);
}

// ---------- Contrôles ----------
function renderControls() {
  document.querySelectorAll('#sensor button').forEach(b => b.classList.toggle('on', b.dataset.v === state.sensor));
  document.querySelectorAll('#view button').forEach(b => b.classList.toggle('on', b.dataset.v === state.view));
  const sel = document.getElementById('index');
  sel.innerHTML = Object.entries(INDICES).map(([k, v]) => {
    const ok = !v.sensors || v.sensors.includes(state.sensor);
    return `<option value="${k}"${ok ? '' : ' disabled'}>${k}${ok ? '' : ' (Sentinel-2)'}</option>`;
  }).join('');
  sel.value = state.index;
  document.getElementById('disturbance').value = state.disturbance;
  document.getElementById('cls').value = state.cls;
  document.getElementById('sevOut').textContent = Math.round(state.severity * 100) + ' %';
}

function render() {
  const avail = INDICES[state.index].sensors;
  if (avail && !avail.includes(state.sensor)) state.index = 'NDVI';
  renderControls();
  renderCharts();
  renderMaps();
}

function init() {
  document.getElementById('disturbance').innerHTML =
    Object.entries(DISTURBANCES).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('');
  document.getElementById('cls').innerHTML = CLASSES.map(c => `<option value="${c.key}">${c.name}</option>`).join('');

  const on = (id, ev, fn) => document.getElementById(id).addEventListener(ev, e => { fn(e); render(); });
  on('sensor', 'click', e => { if (e.target.dataset.v) state.sensor = e.target.dataset.v; });
  on('view', 'click', e => { if (e.target.dataset.v) state.view = e.target.dataset.v; });
  on('index', 'change', e => (state.index = e.target.value));
  on('disturbance', 'change', e => (state.disturbance = e.target.value));
  on('cls', 'change', e => (state.cls = e.target.value));
  on('severity', 'input', e => (state.severity = e.target.value / 100));
  on('legend', 'click', e => { const k = e.target.closest('[data-k]')?.dataset.k; if (k) state.cls = k; });

  // Cliquer sur un pixel choisit sa classe.
  for (const id of ['mapBefore', 'mapAfter']) {
    on(id, 'click', e => {
      const r = e.target.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / r.width * W), y = Math.floor((e.clientY - r.top) / r.height * H);
      state.cls = CLASSES[land[y * W + x]].key;
    });
  }
  render();
}
init();
