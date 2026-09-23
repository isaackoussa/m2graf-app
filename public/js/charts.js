// MasterGraf — mini-bibliothèque de graphiques SVG (sans dépendance).
// MGChart.render(el, spec) où spec = {
//   xlabel, ylabel, xmin, xmax, ymin, ymax, xfmt(v), yfmt(v),
//   series: [{ name, type: 'line'|'area'|'bar'|'scatter'|'step', points: [[x,y],…], dash, slot }],
//   vlines: [{ x, label }], hlines: [{ y, label }]
// }
// Couleurs : palette catégorielle validée (ordre fixe), jamais recyclée.
(function(){
  const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
  const NS = 'http://www.w3.org/2000/svg';

  function niceStep(range, target){
    const raw = range / Math.max(target, 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function ticks(min, max, target){
    if(!(max > min)) { max = min + 1; }
    const s = niceStep(max - min, target);
    const out = [];
    for(let v = Math.ceil(min / s) * s; v <= max + s * 1e-9; v += s) out.push(Math.abs(v) < s * 1e-9 ? 0 : v);
    return out;
  }
  function defaultFmt(v){
    const a = Math.abs(v);
    if(a >= 1e9) return (v / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Md';
    if(a >= 1e6) return (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
    if(a >= 1e4) return (v / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' k';
    if(a >= 100) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    if(a >= 1) return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    if(a === 0) return '0';
    return v.toLocaleString('fr-FR', { maximumSignificantDigits: 2 });
  }
  function el(tag, attrs, parent){
    const e = document.createElementNS(NS, tag);
    for(const k in attrs) e.setAttribute(k, attrs[k]);
    if(parent) parent.appendChild(e);
    return e;
  }

  function render(host, spec){
    host.innerHTML = '';
    host.classList.add('mg-chart');
    const series = (spec.series || []).filter(s => s.points && s.points.length);
    // Dimensions en pixels réels du conteneur : le texte garde sa taille sur mobile
    const W = Math.max(280, Math.round(host.clientWidth || 640)), H = W < 520 ? Math.round(W * 0.72) : 340;
    const narrow = W < 520;
    const m = { l: narrow ? 50 : 62, r: 14, t: narrow && spec.ylabel ? 30 : 16, b: 46 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;

    const xs = [], ys = [];
    series.forEach(s => s.points.forEach(p => { if(isFinite(p[0]) && isFinite(p[1])){ xs.push(p[0]); ys.push(p[1]); } }));
    (spec.vlines || []).forEach(v => xs.push(v.x));
    (spec.hlines || []).forEach(h => ys.push(h.y));
    const hasBar = series.some(s => s.type === 'bar');
    let xmin = spec.xmin != null ? spec.xmin : Math.min(...xs);
    let xmax = spec.xmax != null ? spec.xmax : Math.max(...xs);
    let ymin = spec.ymin != null ? spec.ymin : Math.min(0, ...ys);
    let ymax = spec.ymax != null ? spec.ymax : Math.max(...ys);
    if(ymax === ymin) ymax = ymin + 1;
    if(spec.ymax == null) ymax += (ymax - ymin) * 0.06;
    if(hasBar){
      const bx = []; series.filter(s => s.type === 'bar').forEach(s => s.points.forEach(p => bx.push(p[0])));
      const uniq = [...new Set(bx)].sort((a, b) => a - b);
      const gap = uniq.length > 1 ? Math.min(...uniq.slice(1).map((v, i) => v - uniq[i])) : 1;
      if(spec.xmin == null) xmin = Math.min(xmin, uniq[0] - gap / 2);
      if(spec.xmax == null) xmax = Math.max(xmax, uniq[uniq.length - 1] + gap / 2);
      spec._barGap = gap;
    }
    const X = v => m.l + (v - xmin) / (xmax - xmin) * pw;
    const Y = v => m.t + ph - (v - ymin) / (ymax - ymin) * ph;
    const xfmt = spec.xfmt || defaultFmt, yfmt = spec.yfmt || defaultFmt;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || spec.ylabel || 'Graphique' }, host);

    // Grille et axes (récessifs)
    ticks(ymin, ymax, 5).forEach(t => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: 'mg-grid' }, svg);
      el('text', { x: m.l - 8, y: Y(t) + 4, class: 'mg-tick', 'text-anchor': 'end' }, svg).textContent = yfmt(t);
    });
    const xt = spec.xticks || ticks(xmin, xmax, W < 520 ? 4 : 7);
    xt.forEach(t => {
      if(t < xmin - 1e-9 || t > xmax + 1e-9) return;
      el('line', { x1: X(t), x2: X(t), y1: m.t + ph, y2: m.t + ph + 4, class: 'mg-axis' }, svg);
      el('text', { x: X(t), y: m.t + ph + 18, class: 'mg-tick', 'text-anchor': 'middle' }, svg).textContent = xfmt(t);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: Y(Math.max(ymin, Math.min(0, ymax))), y2: Y(Math.max(ymin, Math.min(0, ymax))), class: 'mg-axis' }, svg);
    if(spec.xlabel) el('text', { x: m.l + pw / 2, y: H - 6, class: 'mg-label', 'text-anchor': 'middle' }, svg).textContent = spec.xlabel;
    if(spec.ylabel && narrow) el('text', { x: 4, y: 14, class: 'mg-label', 'text-anchor': 'start' }, svg).textContent = '↑ ' + spec.ylabel;
    else if(spec.ylabel) el('text', { x: 14, y: m.t + ph / 2, class: 'mg-label', 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ph / 2})` }, svg).textContent = spec.ylabel;

    const clip = 'mgclip' + Math.random().toString(36).slice(2, 8);
    const defs = el('defs', {}, svg);
    const cp = el('clipPath', { id: clip }, defs);
    el('rect', { x: m.l, y: m.t, width: pw, height: ph }, cp);
    const plot = el('g', { 'clip-path': `url(#${clip})` }, svg);

    // Séries
    const barSeries = series.filter(s => s.type === 'bar');
    series.forEach((s, si) => {
      const color = SLOTS[(s.slot != null ? s.slot : si) % SLOTS.length];
      s._color = color;
      const pts = s.points.filter(p => isFinite(p[0]) && isFinite(p[1]));
      if(s.type === 'bar'){
        const k = barSeries.indexOf(s), nb = barSeries.length;
        const full = Math.abs(X(xmin + spec._barGap) - X(xmin)) * 0.8;
        const bw = Math.max(2, full / nb - 2);
        pts.forEach(p => {
          const x0 = X(p[0]) - full / 2 + k * (bw + 2);
          const y0 = Y(Math.max(0, ymin)), y1 = Y(p[1]);
          const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y0 - y1));
          const r = Math.min(4, bw / 2, h);
          // barre arrondie seulement côté valeur (extrémité de la donnée)
          const d = p[1] >= 0
            ? `M${x0},${top + h} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${top + h} Z`
            : `M${x0},${top} V${top + h - r} Q${x0},${top + h} ${x0 + r},${top + h} H${x0 + bw - r} Q${x0 + bw},${top + h} ${x0 + bw},${top + h - r} V${top} Z`;
          el('path', { d, fill: color, class: 'mg-bar' }, plot);
        });
      } else if(s.type === 'scatter'){
        pts.forEach(p => el('circle', { cx: X(p[0]), cy: Y(p[1]), r: 4.5, fill: color, class: 'mg-dot' }, plot));
      } else {
        let d = '';
        pts.forEach((p, i) => {
          if(s.type === 'step' && i > 0) d += `H${X(p[0]).toFixed(1)}V${Y(p[1]).toFixed(1)}`;
          else d += (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1);
        });
        if(s.type === 'area' && pts.length){
          const base = Y(Math.max(ymin, 0));
          el('path', { d: d + `L${X(pts[pts.length - 1][0]).toFixed(1)},${base}L${X(pts[0][0]).toFixed(1)},${base}Z`, fill: color, 'fill-opacity': 0.16, stroke: 'none' }, plot);
        }
        el('path', { d, fill: 'none', stroke: color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dash ? '6 4' : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, plot);
      }
    });

    // Repères
    (spec.vlines || []).forEach(v => {
      el('line', { x1: X(v.x), x2: X(v.x), y1: m.t, y2: m.t + ph, class: 'mg-ref' }, svg);
      if(v.label) el('text', { x: Math.min(X(v.x) + 4, W - m.r - 4), y: m.t + 12, class: 'mg-reflabel', 'text-anchor': X(v.x) > W - 120 ? 'end' : 'start' }, svg).textContent = v.label;
    });
    (spec.hlines || []).forEach(h => {
      el('line', { x1: m.l, x2: W - m.r, y1: Y(h.y), y2: Y(h.y), class: 'mg-ref' }, svg);
      if(h.label) el('text', { x: W - m.r - 4, y: Y(h.y) - 5, class: 'mg-reflabel', 'text-anchor': 'end' }, svg).textContent = h.label;
    });

    // Légende (≥ 2 séries)
    if(series.length > 1){
      const lg = document.createElement('div');
      lg.className = 'mg-legend';
      lg.innerHTML = series.map(s => '<span><i style="background:' + s._color + (s.dash ? ';opacity:.7' : '') + '"></i>' + escapeHtml(s.name || '') + '</span>').join('');
      host.appendChild(lg);
    }

    // Survol : réticule + infobulle (valeur la plus proche en x pour chaque série)
    const tip = document.createElement('div');
    tip.className = 'mg-tip';
    host.appendChild(tip);
    const cross = el('line', { y1: m.t, y2: m.t + ph, class: 'mg-cross', visibility: 'hidden' }, svg);
    const hit = el('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' }, svg);
    function nearest(pts, x){
      let best = null, bd = Infinity;
      for(const p of pts){ const d = Math.abs(p[0] - x); if(d < bd){ bd = d; best = p; } }
      return best;
    }
    function move(ev){
      const r = svg.getBoundingClientRect();
      const sx = (ev.clientX - r.left) / r.width * W;
      const xv = xmin + (sx - m.l) / pw * (xmax - xmin);
      let rows = '', px = null;
      series.forEach(s => {
        const p = nearest(s.points, xv);
        if(!p) return;
        if(px === null) px = p[0];
        rows += '<div><i style="background:' + s._color + '"></i>' + escapeHtml(s.name || '') + ' : <b>' + yfmt(p[1]) + '</b></div>';
      });
      if(px === null) return;
      cross.setAttribute('x1', X(px)); cross.setAttribute('x2', X(px)); cross.setAttribute('visibility', 'visible');
      tip.innerHTML = '<div class="mg-tip-x">' + escapeHtml(spec.xlabel || 'x') + ' = ' + xfmt(px) + '</div>' + rows;
      tip.style.display = 'block';
      const hr = host.getBoundingClientRect();
      let left = ev.clientX - hr.left + 12;
      if(left + tip.offsetWidth > hr.width) left = ev.clientX - hr.left - tip.offsetWidth - 12;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, ev.clientY - hr.top - 10) + 'px';
    }
    function leave(){ tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  function escapeHtml(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Outils numériques partagés par les visualisations
  const num = {
    range(a, b, n){ const out = []; for(let i = 0; i <= n; i++) out.push(a + (b - a) * i / n); return out; },
    normPdf(x, m = 0, s = 1){ return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)); },
    normCdf(x){
      const t = 1 / (1 + 0.2316419 * Math.abs(x));
      const d = 0.3989423 * Math.exp(-x * x / 2);
      const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
      return x > 0 ? 1 - p : p;
    },
    normInv(p){
      // Acklam
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
      const pl = 0.02425;
      if(p < pl){ const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      if(p > 1 - pl){ const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      const q = p - 0.5, r = q * q;
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    },
    logGamma(z){
      const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
      if(z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - num.logGamma(1 - z);
      z -= 1; let x = c[0];
      for(let i = 1; i < g + 2; i++) x += c[i] / (z + i);
      const t = z + g + 0.5;
      return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    },
    poissonPmf(k, l){ return Math.exp(-l + k * Math.log(l) - num.logGamma(k + 1)); },
    binomPmf(k, n, p){ return Math.exp(num.logGamma(n + 1) - num.logGamma(k + 1) - num.logGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p)); },
    // Générateur pseudo-aléatoire reproductible (mulberry32) + normale (Box-Muller)
    rng(seed){
      let a = seed >>> 0;
      const u = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
      const z = () => { let v = 0; while(v === 0) v = u(); return Math.sqrt(-2 * Math.log(v)) * Math.cos(2 * Math.PI * u()); };
      return { u, z };
    },
    fmt(v, d = 2){ return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }); },
    pct(v, d = 1){ return (v * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %'; },
    fcfa(v){ return Math.round(v).toLocaleString('fr-FR') + ' FCFA'; },
  };

  window.MGChart = { render, num, SLOTS };
})();
