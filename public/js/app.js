// MasterGraf — application (après déverrouillage : navigation, cours, graphiques, code, quiz, fichiers).
let DATA = null;          // matières de la formation affichée
let GLOSSARY = null;
let LS_KEY = null;
let currentEmail = null;
let currentToken = null;
let currentMaster = 'M2';
const CONTENT = {};       // { M1: { items, glossary }, M2: {…} } — contenus déchiffrés
let AVAILABLE = [];       // formations accessibles au compte
let PROFILE = null;       // { email, principal, firstSeen, opens }

const MASTER_INFO = {
  M1: { label: 'Master 1', short: 'M1', semestres: ['S7', 'S8'], enc: '/app-m1.enc' },
  M2: { label: 'Master 2', short: 'M2', semestres: ['S9', 'S10'], enc: '/app.enc' },
};
const LANG_LABELS = { python: 'Python', r: 'R', excel: 'Excel', vba: 'VBA', sas: 'SAS' };
const LANG_ORDER = ['python', 'r', 'excel', 'vba', 'sas'];

function GENS(){ return (currentMaster === 'M1' ? window.GENERATORS_M1 : window.GENERATORS_M2) || {}; }
// Graphiques d'une matière : [{ v: visualisation, s: index de la section après laquelle l'afficher (null = fin du cours) }]
function VIZ(id){
  return (((window.VISUALS || {})[currentMaster] || {})[id] || []).map(e => Array.isArray(e) ? { v: e[0], s: e[1] } : { v: e, s: null });
}
function semLabel(s){ return 'Semestre ' + String(s).replace(/^S/, ''); }

function loadProgress(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch(e){ return {}; }
}
function saveProgress(p){ try { if(LS_KEY) localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch(e){} }
let progress = {};

let state = { view: 'home', matiereId: null, tab: 'cours', quiz: null };

const root = document.getElementById('view-root');
const listEl = document.getElementById('matiere-list');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

document.getElementById('menu-btn').addEventListener('click', () => {
  sidebar.classList.add('open'); overlay.classList.add('show');
});
overlay.addEventListener('click', closeSidebar);
function closeSidebar(){ sidebar.classList.remove('open'); overlay.classList.remove('show'); }

function toggleRead(id){
  const p = progress[id] || {};
  p.read = !p.read;
  progress[id] = p; saveProgress(progress);
  renderSidebar();
  updateReadButton();
}

function updateReadButton(){
  const btn = document.getElementById('mark-read-btn');
  if(!btn) return;
  const isRead = progress[state.matiereId] && progress[state.matiereId].read;
  btn.textContent = isRead ? '✓ Lu' : 'Marquer comme lu';
  btn.classList.toggle('is-read', !!isRead);
}

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ---------------- Formation (M1 / M2) ---------------- */
function setMaster(m){
  if(!CONTENT[m]) return;
  currentMaster = m;
  DATA = CONTENT[m].items;
  GLOSSARY = CONTENT[m].glossary || [];
  // M2 garde l'ancienne clé de progression pour ne rien perdre
  LS_KEY = (m === 'M2' ? 'm2graf_progress_' : 'mastergraf_' + m.toLowerCase() + '_progress_') + currentEmail;
  progress = loadProgress();
  try { localStorage.setItem('mastergraf_master_' + currentEmail, m); } catch(e){}
  document.getElementById('side-kicker').textContent = 'IUA · ' + MASTER_INFO[m].label + ' GRAF';
  renderMasterSwitch();
}

function renderMasterSwitch(){
  const box = document.getElementById('master-switch');
  const list = AVAILABLE.filter(m => CONTENT[m]);
  if(list.length < 2){ box.style.display = 'none'; return; }
  box.style.display = 'flex';
  box.innerHTML = list.map(m => '<button data-m="' + m + '" class="' + (m === currentMaster ? 'active' : '') + '">' + MASTER_INFO[m].label + '</button>').join('');
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    setMaster(b.dataset.m);
    state = { view: 'home', matiereId: null, tab: 'cours', quiz: null };
    setActiveLink(null); renderSidebar(); renderHome(); closeSidebar();
  }));
}

/* ---------------- Sidebar ---------------- */
function renderSidebar(){
  const doneCount = DATA.filter(m => progress[m.id] && progress[m.id].read).length;
  document.getElementById('progress-text').textContent = doneCount + ' / ' + DATA.length;
  document.getElementById('progress-fill').style.width = (doneCount/DATA.length*100) + '%';

  let html = '';
  let curSem = null;
  DATA.forEach((m, i) => {
    if(m.semestre !== curSem){
      curSem = m.semestre;
      html += '<div class="sem-label">' + semLabel(curSem) + '</div>';
    }
    const done = progress[m.id] && progress[m.id].read;
    const active = state.matiereId === m.id;
    html += '<div class="mat-item' + (active?' active':'') + (done?' done':'') + '" data-id="' + m.id + '">' +
      '<span class="dot">' + (done ? '✓' : '') + '</span>' +
      '<span class="num">' + (i+1) + '.</span>&nbsp;' + esc(m.titre) +
    '</div>';
  });
  listEl.innerHTML = html;
  listEl.querySelectorAll('.mat-item').forEach(el => {
    el.addEventListener('click', () => { openMatiere(parseInt(el.dataset.id)); closeSidebar(); });
  });
}

/* ---------------- Home ---------------- */
function renderHome(){
  const info = MASTER_INFO[currentMaster];
  const doneCount = DATA.filter(m => progress[m.id] && progress[m.id].read).length;
  const quizzed = DATA.filter(m => progress[m.id] && progress[m.id].bestScore !== undefined);
  const avgScore = quizzed.length ? Math.round(quizzed.reduce((a,m)=>a + progress[m.id].bestScore/progress[m.id].total, 0) / quizzed.length * 100) : null;
  const totalExercices = DATA.reduce((a,m)=>a+m.exercices.length,0);
  const totalViz = DATA.reduce((a,m)=>a+VIZ(m.id).length,0);
  const sems = [...new Set(DATA.map(m => m.semestre))];

  let html = '<div class="home-hero">' +
    '<div class="kicker">Cahier d\'étude · ' + info.label + '</div>' +
    '<h2>' + info.label + ' — Gestion des Risques<br>en Assurance et Finance</h2>' +
    '<p>Les ' + DATA.length + ' matières des ' + sems.map(s => s.replace('S', '')).join(' et ').replace(/^/, 'semestres ') + ', en fiches de cours, graphiques interactifs, exercices corrigés, quiz et codes prêts à l\'emploi (Python, R, Excel, VBA' + (DATA.some(m => m.code && m.code.sas) ? ', SAS' : '') + ').</p>' +
  '</div>';

  html += '<div class="stat-row">' +
    '<div class="stat-card"><div class="n">' + doneCount + '/' + DATA.length + '</div><div class="l">Matières lues</div></div>' +
    '<div class="stat-card"><div class="n">' + (avgScore===null ? '—' : avgScore+'%') + '</div><div class="l">Score moyen quiz</div></div>' +
    '<div class="stat-card"><div class="n">' + totalExercices + '</div><div class="l">Exercices corrigés</div></div>' +
    '<div class="stat-card"><div class="n">' + totalViz + '</div><div class="l">Graphiques interactifs</div></div>' +
  '</div>';

  sems.forEach(sem => {
    const list = DATA.filter(m => m.semestre === sem);
    html += '<div class="sem-block"><h3>' + semLabel(sem) + '</h3>';
    list.forEach(m => {
      const done = progress[m.id] && progress[m.id].read;
      const nv = VIZ(m.id).length;
      html += '<div class="home-card' + (done?' done':'') + '" data-id="' + m.id + '">' +
        '<div class="idx">' + (done ? '✓' : (m.id+1)) + '</div>' +
        '<div class="body"><div class="t">' + esc(m.titre) + '</div><div class="m">' +
          (m.credits ? m.credits + ' crédits · ' : '') + m.sections.length + ' sections · ' + m.exercices.length + ' exercices · ' + m.quiz.length + ' questions' + (nv ? ' · ' + nv + ' graphique' + (nv > 1 ? 's' : '') : '') +
        '</div></div>' +
      '</div>';
    });
    html += '</div>';
  });

  root.innerHTML = html;
  root.querySelectorAll('.home-card').forEach(el => {
    el.addEventListener('click', () => openMatiere(parseInt(el.dataset.id)));
  });
}

/* ---------------- Matiere ---------------- */
function openMatiere(id, tab){
  state.view = 'matiere';
  state.matiereId = id;
  state.tab = tab || 'cours';
  state.quiz = null;
  setActiveLink(null);
  renderSidebar();
  renderMatiere();
  window.scrollTo(0,0);
}

function hasCode(m){ return m.code && Object.keys(m.code).length > 0; }

function renderMatiere(){
  const m = DATA.find(x => x.id === state.matiereId);
  const isRead = progress[m.id] && progress[m.id].read;
  const gen = GENS()[m.id];
  let html = (m.ue ? '<div class="mat-ue">UE — ' + esc(m.ue) + '</div>' : '') +
    '<div class="mat-title-row"><h2>' + esc(m.titre) + '</h2>' +
      '<button id="mark-read-btn" class="btn-mark' + (isRead?' is-read':'') + '">' + (isRead ? '✓ Lu' : 'Marquer comme lu') + '</button>' +
    '</div>' +
    (m.credits ? '<div class="mat-meta">' + m.credits + ' crédits · ' + semLabel(m.semestre) + '</div>' : '') +
    '<div class="tabs">' +
      '<button class="tab-btn' + (state.tab==='cours'?' active':'') + '" data-tab="cours">Cours</button>' +
      '<button class="tab-btn' + (state.tab==='exercices'?' active':'') + '" data-tab="exercices">Exercices (' + m.exercices.length + (gen ? '+' : '') + ')</button>' +
      (hasCode(m) || (gen && gen.code) ? '<button class="tab-btn' + (state.tab==='code'?' active':'') + '" data-tab="code">Code</button>' : '') +
      '<button class="tab-btn' + (state.tab==='quiz'?' active':'') + '" data-tab="quiz">Quiz (' + m.quiz.length + (gen ? '+' : '') + ')</button>' +
    '</div>' +
    '<div id="tab-content"></div>';
  root.innerHTML = html;

  document.getElementById('mark-read-btn').addEventListener('click', () => toggleRead(m.id));

  root.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    state.tab = b.dataset.tab; state.quiz = null; renderMatiere();
  }));

  const tc = document.getElementById('tab-content');
  if(state.tab === 'cours' || state.tab === 'graphiques'){
    tc.innerHTML = renderCours(m);
    bindVizCards(m);
  } else if(state.tab === 'exercices'){
    tc.innerHTML = renderExercices(m);
    bindGeneratorExo(m);
  } else if(state.tab === 'code'){
    tc.innerHTML = renderCode(m);
    bindCodeToggles(m);
  } else {
    renderQuizTab(m, tc);
  }
}

function rnd(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function rndf(min, max, dec){ const v = Math.random()*(max-min)+min; return parseFloat(v.toFixed(dec)); }

function footerNav(m, suffix, tabFor){
  const idx = DATA.findIndex(x => x.id === m.id);
  const prev = DATA[idx-1], next = DATA[idx+1];
  setTimeout(() => {
    const pb = document.getElementById('nav-prev-' + suffix), nb = document.getElementById('nav-next-' + suffix);
    if(pb && prev) pb.addEventListener('click', () => openMatiere(prev.id, tabFor(prev)));
    if(nb && next) nb.addEventListener('click', () => openMatiere(next.id, tabFor(next)));
  });
  return '<div class="mat-footer-nav">' +
    '<button ' + (!prev?'disabled':'') + ' id="nav-prev-' + suffix + '">← ' + (prev ? esc(prev.titre) : '') + '</button>' +
    '<button ' + (!next?'disabled':'') + ' id="nav-next-' + suffix + '">' + (next ? esc(next.titre) : '') + ' →</button>' +
  '</div>';
}

/* ---------------- Formules (KaTeX) et théorie ---------------- */
// Rend une expression LaTeX ; repli en texte brut si KaTeX n'est pas chargé
function tex(src, display){
  if(window.katex){
    try { return katex.renderToString(src, { displayMode: !!display, throwOnError: false, strict: 'ignore' }); } catch(e){}
  }
  return '<code class="tex">' + esc(src) + '</code>';
}
// Texte avec formules en ligne $…$ (contenus marqués math: true) ; une ligne « $$…$$ » est une formule centrée
function rich(text, m){
  text = String(text == null ? '' : text);
  if(!m || !m.math || text.indexOf('$') < 0) return esc(text);
  if(/^\$\$[\s\S]+\$\$$/.test(text.trim())) return tex(text.trim().slice(2, -2), true);
  return text.split(/(\$[^$]+\$)/g).map(part =>
    part.length > 2 && part[0] === '$' && part[part.length - 1] === '$' ? tex(part.slice(1, -1), false) : esc(part)).join('');
}
// Sur petit écran, coupe une formule en plusieurs lignes à ses séparateurs « , \\qquad » (hors accolades)
function splitTex(t){
  const parts = []; let depth = 0, cur = '';
  for(let i = 0; i < t.length; i++){
    const c = t[i];
    if(c === '{') depth++;
    else if(c === '}') depth--;
    if(depth === 0 && t.startsWith('\\qquad', i) && cur.trim() && !/^\\qquad\s*$/.test(cur)){
      parts.push(cur.replace(/,\s*$/, '')); cur = ''; i += 5; continue;
    }
    if(depth === 0 && t.startsWith(',', i) && /^,\s*\\quad(?!\w)/.test(t.slice(i))){
      parts.push(cur); cur = ''; i = i + t.slice(i).match(/^,\s*\\quad/)[0].length - 1; continue;
    }
    cur += c;
  }
  if(cur.trim()) parts.push(cur);
  return parts.map(x => x.trim()).filter(Boolean);
}
function formulaBlock(sec){
  if(sec.tex){
    let list = Array.isArray(sec.tex) ? sec.tex : [sec.tex];
    if(window.innerWidth < 700) list = [].concat(...list.map(splitTex));
    return '<div class="formule formule-tex">' + list.map(t => '<div class="fx">' + tex(t, true) + '</div>').join('') + '</div>';
  }
  // Formule en texte (contenu M2) : une relation par ligne pour qu'elle reste lisible sur mobile
  return '<div class="formule">' + String(sec.formule).split(/\s+;\s+/).map(f => '<div class="fx-line">' + esc(f) + '</div>').join('') + '</div>';
}
function theorieBlock(t, m){
  const line = x => /^\$\$[\s\S]+\$\$$/.test(String(x).trim()) ? '<div class="fx">' + rich(x, m) + '</div>' : '<p>' + rich(x, m) + '</p>';
  return '<div class="theorie"><div class="th-head"><span class="th-type">' + esc(t.type || 'Théorème') + '</span>' +
      (t.titre ? '<span class="th-titre">' + rich(t.titre, m) + '</span>' : '') + '</div>' +
    '<div class="th-enonce">' + (t.enonce || []).map(line).join('') + '</div>' +
    (t.preuve && t.preuve.length ? '<details class="th-preuve"><summary>' + esc(t.preuveTitre || 'Voir la démonstration') + '</summary>' +
      '<ol>' + t.preuve.map(x => '<li>' + rich(x, m) + '</li>').join('') + '</ol><div class="qed">∎</div></details>' : '') +
    (t.interpretation ? '<p class="th-interp"><b>À retenir :</b> ' + rich(t.interpretation, m) + '</p>' : '') +
  '</div>';
}

function renderCours(m){
  let h = '';
  if(m.objectifs && m.objectifs.length){
    h += '<div class="objectifs"><h4>Objectifs pédagogiques</h4><ul>' +
      m.objectifs.map(o => '<li>' + rich(o, m) + '</li>').join('') + '</ul></div>';
  }
  const viz = VIZ(m.id);
  let k = 0;
  const cards = s => viz.filter(e => e.s === s).map(e => vizCard(e.v, k++)).join('');
  m.sections.forEach((sec, i) => {
    h += '<div class="section-block"><h3>' + esc(sec.titre) + '</h3>';
    (sec.paragraphs||[]).forEach(p => h += '<p>' + rich(p, m) + '</p>');
    if(sec.formule || sec.tex) h += formulaBlock(sec);
    if(sec.codeLine) h += '<pre class="code-line"><code>' + esc(sec.codeLine) + '</code></pre>';
    if(sec.bullets) h += '<ul>' + sec.bullets.map(b => '<li>' + rich(b, m) + '</li>').join('') + '</ul>';
    (sec.theorie || []).forEach(t => h += theorieBlock(t, m));
    if(sec.exemple) h += '<div class="exemple"><h5>' + esc(sec.exemple.titre || 'Exemple de calcul') + '</h5><ol>' +
      (sec.exemple.lignes || []).map(l => '<li>' + rich(l, m) + '</li>').join('') + '</ol></div>';
    h += cards(i);
    h += '</div>';
  });
  // Graphiques sans section précise (ou section absente) : en fin de cours
  const rest = viz.filter(e => e.s == null || e.s >= m.sections.length);
  if(rest.length){
    h += '<div class="section-block"><h3>Graphiques interactifs</h3>' + rest.map(e => vizCard(e.v, k++)).join('') + '</div>';
  }
  h += footerNav(m, 'cours', () => 'cours');
  return h;
}

/* ---------------- Graphiques interactifs ---------------- */
function fmtParam(p, v){
  if(p.fmt) return p.fmt(v);
  const dec = String(p.step).includes('.') ? String(p.step).split('.')[1].length : 0;
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function vizCard(v, i){
  return '<div class="viz-card" id="viz-' + i + '">' +
    '<div class="viz-kicker">Graphique interactif</div>' +
    '<h3>' + esc(v.titre) + '</h3><p class="viz-exp">' + esc(v.explication) + '</p>' +
    '<div class="viz-params">' + v.params.map(p =>
      '<div><label for="viz-' + i + '-' + p.id + '"><span>' + esc(p.label) + '</span><b id="viz-' + i + '-' + p.id + '-v"></b></label>' +
      '<input type="range" id="viz-' + i + '-' + p.id + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + p.value + '"></div>'
    ).join('') + '</div>' +
    '<div class="viz-chart"></div>' +
    '<div class="viz-calc"><h5>Détail du calcul</h5><ol></ol></div>' +
    '<div class="viz-result"></div>' +
  '</div>';
}

// Active les graphiques insérés dans le cours (même ordre que renderCours)
function bindVizCards(m){
  const viz = VIZ(m.id);
  const ordered = [];
  m.sections.forEach((_, i) => viz.filter(e => e.s === i).forEach(e => ordered.push(e.v)));
  viz.filter(e => e.s == null || e.s >= m.sections.length).forEach(e => ordered.push(e.v));
  vizUpdaters = [];
  ordered.forEach((v, i) => {
    const card = document.getElementById('viz-' + i);
    if(!card) return;
    const update = () => {
      const p = {};
      v.params.forEach(pp => {
        const val = parseFloat(document.getElementById('viz-' + i + '-' + pp.id).value);
        p[pp.id] = val;
        document.getElementById('viz-' + i + '-' + pp.id + '-v').textContent = fmtParam(pp, val);
      });
      try {
        const out = v.compute(p);
        MGChart.render(card.querySelector('.viz-chart'), out.chart);
        card.querySelector('.viz-calc ol').innerHTML = (out.calcul || []).map(l => '<li>' + esc(l) + '</li>').join('');
        card.querySelector('.viz-result').textContent = out.resultat || '';
      } catch(err){
        console.error('Visualisation', v.titre, err);
        card.querySelector('.viz-result').textContent = 'Paramètres hors domaine — ajuste les curseurs.';
      }
    };
    let pending = false;
    v.params.forEach(pp => document.getElementById('viz-' + i + '-' + pp.id).addEventListener('input', () => {
      if(pending) return; pending = true;
      requestAnimationFrame(() => { pending = false; update(); });
    }));
    update();
    vizUpdaters.push(update);
  });
}

// Redessine les graphiques quand la largeur change (rotation du téléphone, fenêtre)
let vizUpdaters = [], vizResizeTimer = null, lastVizWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if(Math.abs(window.innerWidth - lastVizWidth) < 40) return;
  clearTimeout(vizResizeTimer);
  vizResizeTimer = setTimeout(() => {
    lastVizWidth = window.innerWidth;
    if(state.view === 'matiere' && state.tab === 'cours') vizUpdaters.forEach(u => u());
  }, 200);
});

function renderExercices(m){
  let h = '';
  if(!m.exercices.length){
    h += '<p class="exo-intro">Pas d\'exercice fixe pour cette matière — utilise le générateur ci-dessous.</p>';
  } else {
    h += '<p class="exo-intro">Cherche à résoudre chaque exercice avant de dérouler les étapes et la solution.</p>';
    m.exercices.forEach((ex, i) => {
      h += '<div class="exo-card">' +
        '<div class="exo-head"><span class="exo-num">Exercice ' + (i+1) + '</span><span class="exo-title">' + esc(ex.titre) + '</span></div>' +
        '<p class="exo-enonce">' + esc(ex.enonce) + '</p>' +
        '<button class="btn-ghost exo-toggle" data-exo="' + i + '">Afficher la correction</button>' +
        '<div class="exo-correction" id="exo-corr-' + i + '" style="display:none;">' +
          '<div class="exo-etapes"><h5>Étapes</h5><ol>' + ex.etapes.map(e => '<li>' + esc(e) + '</li>').join('') + '</ol></div>' +
          '<div class="exo-solution"><h5>Solution</h5><p>' + esc(ex.solution) + '</p></div>' +
        '</div>' +
      '</div>';
    });
  }
  h += '<div id="gen-exo-zone"></div>';
  h += footerNav(m, 'ex', () => 'exercices');

  setTimeout(() => {
    document.querySelectorAll('.exo-toggle').forEach(b => b.addEventListener('click', () => {
      const i = b.dataset.exo;
      const box = document.getElementById('exo-corr-' + i);
      const showing = box.style.display !== 'none';
      box.style.display = showing ? 'none' : 'block';
      b.textContent = showing ? 'Afficher la correction' : 'Masquer la correction';
    }));
  });
  return h;
}

/* ---------------- Générateur d'exercices ---------------- */
function bindGeneratorExo(m){
  const gen = GENS()[m.id];
  const zone = document.getElementById('gen-exo-zone');
  if(!zone) return;
  if(!gen){ zone.innerHTML = ''; return; }
  zone.innerHTML =
    '<div class="gen-box">' +
      '<div class="gen-head"><span class="gen-badge">Générateur</span><span class="gen-title">Exercices supplémentaires à volonté</span></div>' +
      '<p class="gen-desc">Chaque clic génère un nouvel exercice avec des valeurs différentes — entraîne-toi autant que tu veux.</p>' +
      '<button class="btn-primary" id="gen-new-exo">Générer un exercice</button>' +
      '<div id="gen-exo-content"></div>' +
    '</div>';
  document.getElementById('gen-new-exo').addEventListener('click', () => showGeneratedExo(gen));
}

function showGeneratedExo(gen){
  const ex = gen.exo(rnd, rndf);
  const zone = document.getElementById('gen-exo-content');
  zone.innerHTML =
    '<div class="exo-card gen-generated">' +
      '<div class="exo-head"><span class="exo-num">Généré</span></div>' +
      '<p class="exo-enonce">' + esc(ex.enonce) + '</p>' +
      '<button class="btn-ghost exo-toggle" id="gen-toggle">Afficher la correction</button>' +
      '<div class="exo-correction" id="gen-corr" style="display:none;">' +
        '<div class="exo-etapes"><h5>Étapes</h5><ol>' + ex.etapes.map(e => '<li>' + esc(e) + '</li>').join('') + '</ol></div>' +
        '<div class="exo-solution"><h5>Solution</h5><p>' + esc(ex.solution) + '</p></div>' +
      '</div>' +
    '</div>';
  document.getElementById('gen-toggle').addEventListener('click', () => {
    const box = document.getElementById('gen-corr');
    const showing = box.style.display !== 'none';
    box.style.display = showing ? 'none' : 'block';
    document.getElementById('gen-toggle').textContent = showing ? 'Afficher la correction' : 'Masquer la correction';
  });
}

/* ---------------- Code (Python, R, Excel, VBA, SAS) ---------------- */
let codeLang = 'python';
function langsOf(code){ return LANG_ORDER.filter(l => code && code[l]); }

function codeBlock(code, prefix, lang){
  const langs = langsOf(code);
  if(!langs.includes(lang)) lang = langs[0];
  return '<div class="code-switch">' + langs.map(l =>
      '<button class="code-lang-btn' + (l === lang ? ' active' : '') + '" data-' + prefix + 'lang="' + l + '">' + LANG_LABELS[l] + '</button>').join('') +
    '</div>' +
    langs.map(l => '<div class="code-block" data-' + prefix + 'block="' + l + '" style="display:' + (l === lang ? 'block' : 'none') + ';">' +
      '<button class="code-copy" data-copy>Copier</button><pre><code>' + esc(code[l]) + '</code></pre></div>').join('');
}

function bindCodeBlock(scope, prefix){
  scope.querySelectorAll('[data-' + prefix + 'lang]').forEach(b => b.addEventListener('click', () => {
    codeLang = b.getAttribute('data-' + prefix + 'lang');
    scope.querySelectorAll('[data-' + prefix + 'lang]').forEach(x => x.classList.toggle('active', x === b));
    scope.querySelectorAll('[data-' + prefix + 'block]').forEach(x => x.style.display = x.getAttribute('data-' + prefix + 'block') === codeLang ? 'block' : 'none');
  }));
  scope.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const txt = b.parentElement.querySelector('code').textContent;
    try { await navigator.clipboard.writeText(txt); b.textContent = 'Copié ✓'; } catch(e){ b.textContent = 'Sélectionne et copie'; }
    setTimeout(() => b.textContent = 'Copier', 1600);
  }));
}

function renderCode(m){
  let h = '';
  if(hasCode(m)){
    h += '<p class="exo-intro">Extraits de code illustrant les calculs du cours — à adapter à tes propres données. Choisis ton outil :</p>' +
      '<div id="main-code">' + codeBlock(m.code, 'm', codeLang) + '</div>';
  }
  h += '<div id="gen-code-zone"></div>';
  h += footerNav(m, 'code', x => (hasCode(x) || (GENS()[x.id] && GENS()[x.id].code)) ? 'code' : 'cours');
  return h;
}

function bindCodeToggles(m){
  const mc = document.getElementById('main-code');
  if(mc) bindCodeBlock(mc, 'm');
  bindGeneratorCode(m);
}

function bindGeneratorCode(m){
  const gen = GENS()[m.id];
  const zone = document.getElementById('gen-code-zone');
  if(!zone) return;
  if(!gen || typeof gen.code !== 'function'){ zone.innerHTML = ''; return; }
  zone.innerHTML =
    '<div class="gen-box">' +
      '<div class="gen-head"><span class="gen-badge">Générateur</span><span class="gen-title">Nouvel exemple de code à volonté</span></div>' +
      '<p class="gen-desc">Chaque clic génère un nouveau petit script (Python, R, Excel, VBA) avec des valeurs différentes, prêt à copier-coller.</p>' +
      '<button class="btn-primary" id="gen-new-code">Générer un exemple</button>' +
      '<div id="gen-code-content" style="margin-top:16px;"></div>' +
    '</div>';
  document.getElementById('gen-new-code').addEventListener('click', () => {
    const c = gen.code(rnd, rndf);
    const box = document.getElementById('gen-code-content');
    box.innerHTML = codeBlock(c, 'g', codeLang);
    bindCodeBlock(box, 'g');
  });
}

/* ---------------- Quiz ---------------- */
function shuffleArr(arr){
  const a = arr.slice();
  for(let i = a.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// Mélange aussi l'ordre des options (la bonne réponse n'est plus toujours la première)
function shuffleOptions(q){
  const order = shuffleArr(q.options.map((_, i) => i));
  return { q: q.q, options: order.map(i => q.options[i]), a: order.indexOf(q.a), exp: q.exp };
}

function buildQuizPool(m){
  const gen = GENS()[m.id];
  let pool = m.quiz.slice();
  if(gen){
    for(let k=0;k<6;k++) pool.push(gen.quiz(rnd, rndf));
  }
  return shuffleArr(pool).map(shuffleOptions);
}

function renderQuizTab(m, tc){
  const gen = GENS()[m.id];
  if(!m.quiz.length && !gen){
    tc.innerHTML = '<div id="quiz-intro"><p>Aucun quiz pour cette matière.</p></div>';
    return;
  }
  if(!state.quiz){
    const best = progress[m.id] && progress[m.id].bestScore !== undefined ? progress[m.id] : null;
    const totalDisponible = m.quiz.length + (gen ? 6 : 0);
    tc.innerHTML = '<div id="quiz-intro">' +
      '<div class="big-icon">📝</div>' +
      '<p>' + totalDisponible + ' questions (' + (gen ? 'banque + générées aléatoirement, différentes à chaque tentative' : 'banque fixe') + ') pour tester ta compréhension de "' + esc(m.titre) + '".' +
      (best ? '<br>Meilleur score : <strong>' + best.bestScore + '/' + best.total + '</strong>' : '') + '</p>' +
      '<button class="btn-primary" id="start-quiz">Commencer le quiz</button>' +
    '</div>';
    document.getElementById('start-quiz').addEventListener('click', () => {
      state.quiz = { qi: 0, score: 0, answered: false, selected: null, order: buildQuizPool(m) };
      renderQuizTab(m, tc);
    });
    return;
  }

  const qz = state.quiz;
  if(qz.qi >= qz.order.length){
    const pct = Math.round(qz.score/qz.order.length*100);
    const p = progress[m.id] || {};
    if(p.bestScore === undefined || qz.score > p.bestScore){ p.bestScore = qz.score; p.total = qz.order.length; }
    progress[m.id] = p; saveProgress(progress); renderSidebar();

    tc.innerHTML = '<div class="quiz-result">' +
      '<div class="score">' + qz.score + '<span>/' + qz.order.length + '</span></div>' +
      '<div class="msg">' + (pct >= 75 ? 'Bien maîtrisé — continue ainsi.' : pct >= 50 ? 'Correct, quelques notions à revoir.' : 'Relis le cours puis retente le quiz.') + '</div>' +
      '<button class="btn-ghost" id="retry-quiz">Refaire le quiz</button> ' +
      '<button class="btn-primary" id="back-cours">Revoir le cours</button>' +
    '</div>';
    document.getElementById('retry-quiz').addEventListener('click', () => {
      state.quiz = { qi: 0, score: 0, answered: false, selected: null, order: buildQuizPool(m) };
      renderQuizTab(m, tc);
    });
    document.getElementById('back-cours').addEventListener('click', () => {
      state.tab = 'cours'; state.quiz = null; renderMatiere();
    });
    return;
  }

  const q = qz.order[qz.qi];
  let h = '<div class="q-progress">Question ' + (qz.qi+1) + ' / ' + qz.order.length + '</div>' +
    '<div class="q-track"><div class="q-track-fill" style="width:' + (qz.qi/qz.order.length*100) + '%"></div></div>' +
    '<div class="q-text">' + esc(q.q) + '</div>';
  q.options.forEach((opt, oi) => {
    let cls = 'q-opt';
    if(qz.answered){
      if(oi === q.a) cls += ' correct';
      else if(oi === qz.selected) cls += ' wrong';
    }
    h += '<button class="' + cls + '" data-oi="' + oi + '" ' + (qz.answered?'disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(qz.answered){
    h += '<div class="q-explain">' + esc(q.exp) + '</div>' +
      '<div class="q-next"><button class="btn-primary" id="next-q">' + (qz.qi+1 < qz.order.length ? 'Question suivante →' : 'Voir le résultat') + '</button></div>';
  }
  tc.innerHTML = h;

  if(!qz.answered){
    tc.querySelectorAll('.q-opt').forEach(b => b.addEventListener('click', () => {
      const oi = parseInt(b.dataset.oi);
      qz.answered = true; qz.selected = oi;
      if(oi === q.a) qz.score++;
      renderQuizTab(m, tc);
    }));
  } else {
    document.getElementById('next-q').addEventListener('click', () => {
      qz.qi++; qz.answered = false; qz.selected = null;
      renderQuizTab(m, tc);
    });
  }
}

function highlightSnippet(snippet, q){
  const lower = snippet.toLowerCase();
  const pos = lower.indexOf(q);
  if(pos < 0) return esc(snippet);
  return esc(snippet.slice(0,pos)) + '<mark>' + esc(snippet.slice(pos,pos+q.length)) + '</mark>' + esc(snippet.slice(pos+q.length));
}

/* ---------------- Search ---------------- */
function renderSearch(query){
  const q = query.trim().toLowerCase();
  if(!q){ state.view='home'; setActiveLink(null); renderHome(); return; }
  setActiveLink(null);
  const hits = [];
  DATA.forEach(m => {
    m.sections.forEach(sec => {
      const hay = (sec.titre + ' ' + (sec.paragraphs||[]).join(' ') + ' ' + (sec.bullets||[]).join(' ') + ' ' + (sec.formule||'')).toLowerCase();
      if(hay.includes(q)){
        const src = [...(sec.paragraphs||[]), ...(sec.bullets||[])].find(t => t.toLowerCase().includes(q)) || (sec.paragraphs && sec.paragraphs[0]) || '';
        const pos = src.toLowerCase().indexOf(q);
        const snippet = pos >= 0 ? '…' + src.slice(Math.max(0,pos-40), pos+80) + '…' : src.slice(0,100);
        hits.push({ m, sec, snippet });
      }
    });
  });
  let html = '<div class="home-hero"><div class="kicker">Recherche · ' + MASTER_INFO[currentMaster].label + '</div><h2>« ' + esc(query) + ' »</h2>' +
    '<p>' + hits.length + ' résultat(s)</p></div>';
  hits.slice(0,40).forEach(h => {
    html += '<div class="search-hit" data-id="' + h.m.id + '">' +
      '<div class="h-ue">' + esc(h.m.titre) + ' — ' + esc(h.sec.titre) + '</div>' +
      '<div class="h-snip">' + highlightSnippet(h.snippet, q) + '</div>' +
    '</div>';
  });
  root.innerHTML = html;
  root.querySelectorAll('.search-hit').forEach(el => el.addEventListener('click', () => openMatiere(parseInt(el.dataset.id))));
}

document.getElementById('search-input').addEventListener('input', (e) => {
  renderSearch(e.target.value);
});

/* ---------------- Navigation latérale ---------------- */
document.getElementById('sidebar-head').addEventListener('click', () => {
  state.view = 'home'; state.matiereId = null; setActiveLink(null); renderSidebar(); renderHome();
});
document.querySelector('#sidebar-head').style.cursor = 'pointer';

function openSection(view, linkId, render){
  document.getElementById(linkId).addEventListener('click', () => {
    state.view = view; state.matiereId = null; setActiveLink(linkId);
    renderSidebar(); render();
    closeSidebar();
    window.scrollTo(0,0);
  });
}
openSection('dictionnaire', 'dictionnaire-link', () => renderDictionnaire(''));
openSection('documents', 'documents-link', renderDocuments);
openSection('fichiers', 'fichiers-link', renderFichiers);
openSection('profil', 'profil-link', renderProfil);
document.getElementById('topbar-profile').addEventListener('click', () => document.getElementById('profil-link').click());

function setActiveLink(id){
  ['profil-link', 'dictionnaire-link', 'documents-link', 'fichiers-link'].forEach(l => document.getElementById(l).classList.toggle('active', l === id));
}

/* ---------------- Mes documents (résumé IA) ---------------- */
function mdToHtml(md){
  const lines = (md || '').split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if(line.startsWith('## ')){
      if(inList){ html += '</ul>'; inList = false; }
      html += '<h2>' + esc(line.slice(3)) + '</h2>';
    } else if(line.startsWith('- ') || line.startsWith('* ')){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>' + esc(line.slice(2)) + '</li>';
    } else if(line === ''){
      if(inList){ html += '</ul>'; inList = false; }
    } else {
      if(inList){ html += '</ul>'; inList = false; }
      html += '<p>' + esc(line) + '</p>';
    }
  }
  if(inList) html += '</ul>';
  return html;
}

function renderDocuments(){
  let html = '<div class="home-hero">' +
    '<div class="kicker">Assistant de lecture</div>' +
    '<h2>Mes documents</h2>' +
    '<p>Dépose un PDF ou un Word (.docx) de cours (max 4 Mo) — l\'IA en tire un résumé structuré et les notions clés, adapté au niveau ' + MASTER_INFO[currentMaster].label + ' GRAF. Pour partager une photo d\'examen avec ta promo, utilise plutôt « Annales & fichiers partagés ».</p>' +
  '</div>';

  html += '<div id="doc-upload-box">' +
    '<select id="doc-matiere">' +
      '<option value="">Aucune matière en particulier</option>' +
      DATA.map(m => '<option value="' + esc(m.titre) + '">' + esc(m.titre) + '</option>').join('') +
    '</select>' +
    '<input type="file" id="doc-file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">' +
    '<button class="btn-primary" id="doc-submit">Analyser le document</button>' +
    '<div id="doc-upload-msg"></div>' +
  '</div>';

  html += '<div id="doc-result"></div>';
  html += '<h3 style="font-family:\'Source Serif 4\',serif;color:var(--navy);font-size:18px;margin:32px 0 14px;">Historique</h3>';
  html += '<div id="doc-history"><p style="color:var(--muted);font-size:13.5px;">Chargement…</p></div>';

  root.innerHTML = html;
  document.getElementById('doc-submit').addEventListener('click', submitDocUpload);
  loadDocHistory();
}

function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function submitDocUpload(){
  const fileInput = document.getElementById('doc-file');
  const matiereTitre = document.getElementById('doc-matiere').value;
  const msgEl = document.getElementById('doc-upload-msg');
  const btn = document.getElementById('doc-submit');
  const file = fileInput.files[0];

  if(!file){ msgEl.textContent = 'Choisis un fichier PDF ou Word.'; msgEl.className = 'err'; return; }
  if(file.size > 4 * 1024 * 1024){ msgEl.textContent = 'Fichier trop volumineux (max 4 Mo).'; msgEl.className = 'err'; return; }
  if(!currentEmail){ msgEl.textContent = 'Session expirée, recharge la page.'; msgEl.className = 'err'; return; }

  btn.disabled = true;
  btn.textContent = 'Analyse en cours…';
  msgEl.textContent = '';
  msgEl.className = '';

  try {
    const fileBase64 = await fileToBase64(file);
    const res = await fetch('/api/summarize-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, filename: file.name, fileBase64, matiereTitre: matiereTitre || null, master: currentMaster }),
    });

    if(res.status === 413){ msgEl.textContent = 'Fichier trop volumineux pour le serveur (max 4 Mo).'; msgEl.className = 'err'; return; }
    if(res.status === 403){ msgEl.textContent = "Cet accès a été bloqué. Contacte l'administrateur."; msgEl.className = 'err'; return; }
    if(!res.ok){
      const { error } = await res.json().catch(() => ({}));
      msgEl.textContent = error === 'pdf_parse_failed' || error === 'empty_pdf'
        ? "Impossible de lire ce fichier (peut-être un scan sans texte). Réessaie avec un autre fichier."
        : "Échec de l'analyse. Réessaie dans un instant.";
      msgEl.className = 'err';
      return;
    }

    const { doc } = await res.json();
    msgEl.textContent = 'Analyse terminée.';
    msgEl.className = 'ok';
    showDocSummary(doc);
    loadDocHistory();
    fileInput.value = '';
  } catch(err){
    console.error('submitDocUpload error:', err);
    msgEl.textContent = 'Connexion impossible. Réessaie.';
    msgEl.className = 'err';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyser le document';
  }
}

function showDocSummary(doc){
  const el = document.getElementById('doc-result');
  el.innerHTML = '<div class="doc-summary">' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">' + esc(doc.filename) + (doc.matiereTitre ? ' — ' + esc(doc.matiereTitre) : '') + '</div>' +
    mdToHtml(doc.summary) +
  '</div>';
}

async function loadDocHistory(){
  const el = document.getElementById('doc-history');
  if(!el || !currentEmail) return;
  try {
    const res = await fetch('/api/summarize-doc?email=' + encodeURIComponent(currentEmail));
    if(!res.ok){ el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">Historique indisponible.</p>'; return; }
    const { docs } = await res.json();
    if(!docs.length){ el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">Aucun document analysé pour l\'instant.</p>'; return; }
    el.innerHTML = docs.map(d =>
      '<div class="doc-history-item" data-id="' + esc(d.id) + '">' +
        '<div class="dh-title">' + esc(d.filename) + '</div>' +
        '<div class="dh-meta">' + (d.matiereTitre ? esc(d.matiereTitre) + ' — ' : '') + new Date(d.createdAt).toLocaleDateString('fr-FR') + '</div>' +
      '</div>'
    ).join('');
    el.querySelectorAll('.doc-history-item').forEach(item => {
      const doc = docs.find(d => d.id === item.dataset.id);
      item.addEventListener('click', () => { showDocSummary(doc); window.scrollTo(0,0); });
    });
  } catch(err){
    console.error('loadDocHistory error:', err);
    el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">Historique indisponible.</p>';
  }
}

/* ---------------- Annales & fichiers partagés ---------------- */
const FILE_CATEGORIES = ['Examen', 'Rattrapage', 'Partiel / Devoir', 'TD / Exercices', 'Cours / Support', 'Corrigé', 'Autre'];
const MAX_UPLOAD = 4 * 1024 * 1024;
let FILES = [];
const blobCache = {};

function authHeaders(){ return { 'x-email': currentEmail || '', 'x-token': currentToken || '' }; }

function fileIcon(mime){
  if(mime.startsWith('image/')) return '🖼️';
  if(mime === 'application/pdf') return '📕';
  if(mime.includes('word')) return '📘';
  if(mime.includes('sheet') || mime === 'text/csv') return '📗';
  return '📄';
}
function fmtSize(b){ return b > 1048576 ? (b / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo' : Math.round(b / 1024) + ' Ko'; }

function renderFichiers(){
  const years = []; const y0 = new Date().getFullYear();
  for(let y = y0; y >= y0 - 8; y--) years.push((y - 1) + '-' + y);
  let html = '<div class="home-hero">' +
    '<div class="kicker">Partage entre étudiants · ' + MASTER_INFO[currentMaster].label + '</div>' +
    '<h2>Annales &amp; fichiers partagés</h2>' +
    '<p>Photos des examens des années précédentes, sujets de TD, corrigés, supports… Tout ce que tu déposes ici est visible par les étudiants de ton ' + MASTER_INFO[currentMaster].label + '. Les photos sont automatiquement compressées.</p>' +
  '</div>';

  html += '<div id="file-upload-box"><h3>Ajouter un fichier</h3><div class="fu-grid">' +
    '<select id="fu-matiere" class="fu-full"><option value="">Matière (optionnel)</option>' + DATA.map(m => '<option value="' + esc(m.titre) + '">' + esc(m.titre) + '</option>').join('') + '</select>' +
    '<select id="fu-cat">' + FILE_CATEGORIES.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>' +
    '<select id="fu-annee"><option value="">Année universitaire</option>' + years.map(y => '<option>' + y + '</option>').join('') + '</select>' +
    '<input id="fu-titre" class="fu-full" type="text" maxlength="160" placeholder="Titre (ex. Examen final session 1)">' +
    '<input id="fu-file" class="fu-full" type="file" multiple accept="image/*,application/pdf,.pdf,.docx,.xlsx,.xlsm,.csv,.txt">' +
    '<button class="btn-primary fu-full" id="fu-submit">Déposer</button>' +
  '</div><div id="file-upload-msg"></div></div>';

  html += '<div class="files-filters">' +
    '<input id="ff-q" type="search" placeholder="Rechercher un fichier…">' +
    '<select id="ff-mat"><option value="">Toutes les matières</option>' + DATA.map(m => '<option value="' + esc(m.titre) + '">' + esc(m.titre) + '</option>').join('') + '</select>' +
    '<select id="ff-cat"><option value="">Toutes les catégories</option>' + FILE_CATEGORIES.map(c => '<option>' + esc(c) + '</option>').join('') + '</select>' +
  '</div>';
  html += '<div id="file-list"><p style="color:var(--muted);font-size:13.5px;">Chargement…</p></div>';
  root.innerHTML = html;

  document.getElementById('fu-submit').addEventListener('click', submitFiles);
  ['ff-q', 'ff-mat', 'ff-cat'].forEach(id => document.getElementById(id).addEventListener('input', renderFileList));
  loadFiles();
}

async function loadFiles(){
  const el = document.getElementById('file-list');
  try {
    const res = await fetch('/api/files', { headers: authHeaders() });
    if(res.status === 401){ el.innerHTML = '<p class="err" style="color:var(--red);font-size:13.5px;">Session expirée : déconnecte-toi puis reconnecte-toi avec ton code.</p>'; return; }
    if(!res.ok){ el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">Liste indisponible pour le moment.</p>'; return; }
    const data = await res.json();
    FILES = (data.files || []).filter(f => f.master === currentMaster);
    renderFileList();
  } catch(e){
    el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">Connexion impossible.</p>';
  }
}

function renderFileList(){
  const el = document.getElementById('file-list');
  if(!el) return;
  const q = (document.getElementById('ff-q').value || '').toLowerCase();
  const mat = document.getElementById('ff-mat').value, cat = document.getElementById('ff-cat').value;
  const list = FILES.filter(f => (!mat || f.matiere === mat) && (!cat || f.categorie === cat) &&
    (!q || (f.titre + ' ' + (f.matiere || '') + ' ' + f.filename + ' ' + (f.annee || '')).toLowerCase().includes(q)));
  if(!list.length){
    el.innerHTML = '<p style="color:var(--muted);font-size:13.5px;">' + (FILES.length ? 'Aucun fichier ne correspond aux filtres.' : 'Aucun fichier partagé pour l\'instant — sois le premier à déposer une annale !') + '</p>';
    return;
  }
  el.innerHTML = '<div class="file-grid">' + list.map(f =>
    '<div class="file-card">' +
      '<div class="file-thumb" data-open="' + esc(f.id) + '" id="thumb-' + esc(f.id) + '">' + fileIcon(f.mime) + '</div>' +
      '<div class="file-body"><span class="file-tag">' + esc(f.categorie) + (f.annee ? ' · ' + esc(f.annee) : '') + '</span>' +
        '<div class="ft">' + esc(f.titre) + '</div>' +
        '<div class="fm">' + (f.matiere ? esc(f.matiere) + '<br>' : '') + new Date(f.createdAt).toLocaleDateString('fr-FR') + ' · ' + fmtSize(f.size) + '</div></div>' +
      '<div class="file-actions"><button data-open="' + esc(f.id) + '">Ouvrir</button>' + (f.mine ? '<button class="del" data-del="' + esc(f.id) + '">Supprimer</button>' : '') + '</div>' +
    '</div>').join('') + '</div>';
  el.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openFile(b.dataset.open)));
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteFile(b.dataset.del)));
  // Vignettes des images (chargées une par une)
  list.filter(f => f.mime.startsWith('image/')).forEach(async f => {
    const url = await fetchFileUrl(f.id);
    const t = document.getElementById('thumb-' + f.id);
    if(url && t) t.innerHTML = '<img alt="" src="' + url + '">';
  });
}

async function fetchFileUrl(id){
  if(blobCache[id]) return blobCache[id];
  try {
    const res = await fetch('/api/files?id=' + encodeURIComponent(id), { headers: authHeaders() });
    if(!res.ok) return null;
    blobCache[id] = URL.createObjectURL(await res.blob());
    return blobCache[id];
  } catch(e){ return null; }
}

async function openFile(id){
  const f = FILES.find(x => x.id === id);
  if(!f) return;
  const url = await fetchFileUrl(id);
  if(!url){ alert('Impossible d\'ouvrir ce fichier.'); return; }
  const v = document.getElementById('viewer'), c = document.getElementById('viewer-content');
  if(f.mime.startsWith('image/')) c.innerHTML = '<img alt="' + esc(f.titre) + '" src="' + url + '">';
  else if(f.mime === 'application/pdf') c.innerHTML = '<iframe title="' + esc(f.titre) + '" src="' + url + '"></iframe>';
  else c.innerHTML = '<div style="color:#fff;font-size:15px;text-align:center;">Aperçu indisponible pour ce type de fichier.<br>Utilise le bouton Télécharger.</div>';
  const dl = document.getElementById('viewer-dl');
  dl.href = url; dl.setAttribute('download', f.filename);
  v.classList.add('show');
}
document.getElementById('viewer-close').addEventListener('click', () => document.getElementById('viewer').classList.remove('show'));
document.getElementById('viewer').addEventListener('click', (e) => { if(e.target.id === 'viewer') e.currentTarget.classList.remove('show'); });
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') document.getElementById('viewer').classList.remove('show'); });

async function deleteFile(id){
  if(!confirm('Supprimer ce fichier pour tout le monde ?')) return;
  const res = await fetch('/api/files?id=' + encodeURIComponent(id), { method: 'DELETE', headers: authHeaders() });
  if(res.ok){ FILES = FILES.filter(f => f.id !== id); renderFileList(); }
  else alert('Suppression impossible.');
}

// Compresse une photo (téléphone) : max 2000 px de côté, JPEG qualité 0,82 (réessaie plus bas si > 4 Mo)
function compressImage(file){
  return new Promise((resolve) => {
    if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !file.type.startsWith('image/')) return resolve(null);
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const tryQ = (q) => cv.toBlob(b => {
        if(b && b.size > MAX_UPLOAD && q > 0.4) return tryQ(q - 0.15);
        resolve(b);
      }, 'image/jpeg', q);
      tryQ(0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function submitFiles(){
  const input = document.getElementById('fu-file'), msg = document.getElementById('file-upload-msg'), btn = document.getElementById('fu-submit');
  const files = [...input.files];
  if(!files.length){ msg.textContent = 'Choisis au moins un fichier (photo, PDF, Word, Excel).'; msg.className = 'err'; return; }
  btn.disabled = true; msg.className = '';
  let ok = 0; const errors = [];
  for(const [k, file] of files.entries()){
    msg.textContent = 'Envoi ' + (k + 1) + '/' + files.length + ' : ' + file.name + '…';
    try {
      let blob = file, mime = file.type || 'application/octet-stream', name = file.name;
      if(mime.startsWith('image/')){
        const c = await compressImage(file);
        if(!c){ errors.push(file.name + ' (image illisible — format HEIC ? exporte-la en JPEG)'); continue; }
        blob = c; mime = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg';
      }
      if(!mime || mime === 'application/octet-stream'){
        const ext = name.split('.').pop().toLowerCase();
        mime = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', csv: 'text/csv', txt: 'text/plain' }[ext] || mime;
      }
      if(blob.size > MAX_UPLOAD){ errors.push(file.name + ' (plus de 4 Mo)'); continue; }
      const dataBase64 = await fileToBase64(blob);
      const titre = document.getElementById('fu-titre').value.trim();
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({
          master: currentMaster,
          matiere: document.getElementById('fu-matiere').value || null,
          categorie: document.getElementById('fu-cat').value,
          annee: document.getElementById('fu-annee').value || null,
          titre: titre ? (files.length > 1 ? titre + ' (' + (k + 1) + ')' : titre) : name,
          filename: name, mime, dataBase64,
        }),
      });
      if(res.ok){ const { file: f } = await res.json(); FILES.unshift(f); ok++; }
      else {
        const { error } = await res.json().catch(() => ({}));
        errors.push(file.name + ' (' + ({ type_not_allowed: 'type non accepté', file_too_large: 'trop volumineux', quota: 'quota atteint', invalid_session: 'session expirée', expired_session: 'session expirée' }[error] || 'erreur serveur') + ')');
      }
    } catch(e){ errors.push(file.name + ' (connexion)'); }
  }
  btn.disabled = false;
  input.value = '';
  msg.textContent = (ok ? ok + ' fichier(s) déposé(s). ' : '') + (errors.length ? 'Échec : ' + errors.join(', ') : '');
  msg.className = errors.length ? 'err' : 'ok';
  renderFileList();
}

/* ---------------- Mon profil ---------------- */
function initialOf(email){ return (email || '?').trim().charAt(0).toUpperCase() || '?'; }

function updateProfileChips(){
  const ini = initialOf(currentEmail);
  document.getElementById('side-avatar').textContent = ini;
  document.getElementById('topbar-profile').textContent = ini;
  document.getElementById('side-email').textContent = currentEmail || '';
}

function progressOf(m){
  const key = (m === 'M2' ? 'm2graf_progress_' : 'mastergraf_' + m.toLowerCase() + '_progress_') + currentEmail;
  let p = {};
  try { p = JSON.parse(localStorage.getItem(key)) || {}; } catch(e){}
  const items = CONTENT[m] ? CONTENT[m].items : [];
  const read = items.filter(x => p[x.id] && p[x.id].read).length;
  const quizzed = items.filter(x => p[x.id] && p[x.id].bestScore !== undefined);
  const avg = quizzed.length ? Math.round(quizzed.reduce((a, x) => a + p[x.id].bestScore / p[x.id].total, 0) / quizzed.length * 100) : null;
  return { read, total: items.length, avg };
}

function renderProfil(){
  const pr = PROFILE || { email: currentEmail };
  const principal = pr.principal || currentMaster;
  let html = '<div class="home-hero"><div class="kicker">Compte</div><h2>Mon profil</h2></div>';
  html += '<div class="profile-card"><span class="avatar">' + esc(initialOf(currentEmail)) + '</span><div class="who">' +
    '<div class="em">' + esc(currentEmail) + '</div>' +
    '<div class="meta">Ma formation : <b>' + MASTER_INFO[principal].label + ' GRAF</b>' +
      (pr.firstSeen ? '<br>Inscrit depuis le ' + new Date(pr.firstSeen).toLocaleDateString('fr-FR') : '') +
      (pr.opens ? ' · ' + pr.opens + ' connexion' + (pr.opens > 1 ? 's' : '') : '') + '</div>' +
  '</div></div>';

  const g = progressOf(principal);
  html += '<div class="profile-section"><h3>Ma progression — ' + MASTER_INFO[principal].label + '</h3><p class="hint">Matières marquées comme lues et score moyen aux quiz, sur cet appareil.</p>' +
    '<div class="prog-row"><span class="pl">' + MASTER_INFO[principal].label + '</span>' +
      '<span class="pt"><i style="width:' + (g.total ? g.read / g.total * 100 : 0) + '%"></i></span>' +
      '<span class="pv">' + g.read + '/' + g.total + ' lues' + (g.avg !== null ? ' · quiz ' + g.avg + ' %' : '') + '</span></div>' +
  '</div>';

  html += '<div class="profile-section"><h3>Se déconnecter</h3><p class="hint">Ferme ta session sur cet appareil. Pour revenir, il faudra demander un nouveau code par e-mail. Ta progression reste enregistrée sur cet appareil.</p>' +
    '<button class="btn-danger" id="logout-btn">Se déconnecter</button></div>';
  root.innerHTML = html;

  document.getElementById('logout-btn').addEventListener('click', logout);
}

async function logout(){
  if(!confirm('Se déconnecter de MasterGraf sur cet appareil ?')) return;
  const btn = document.getElementById('logout-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Déconnexion…'; }
  try {
    await fetch('/api/resume', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, token: currentToken, action: 'logout' }),
    });
  } catch(e){}
  try { localStorage.removeItem(SESSION_KEY); } catch(e){}
  location.reload();
}

/* ---------------- Dictionnaire ---------------- */
function renderDictionnaire(query){
  const q = (query||'').trim().toLowerCase();
  const matieresById = {}; DATA.forEach(m => matieresById[m.id] = m);
  const filtered = GLOSSARY.filter(g =>
    !q || g.terme.toLowerCase().includes(q) || g.def.toLowerCase().includes(q)
  ).sort((a,b) => a.terme.localeCompare(b.terme, 'fr'));

  let html = '<div class="home-hero">' +
    '<div class="kicker">Vocabulaire transversal · ' + MASTER_INFO[currentMaster].label + '</div>' +
    '<h2>Dictionnaire des notions clés</h2>' +
    '<p>' + GLOSSARY.length + ' termes et expressions clés couvrant les ' + DATA.length + ' matières. Recherche un mot ou clique une matière pour filtrer.</p>' +
  '</div>';
  html += '<input type="text" id="dict-search" placeholder="Rechercher un terme…" value="' + esc(query||'') + '">';
  html += '<div id="dict-results"></div>';
  root.innerHTML = html;

  function renderList(list){
    if(!list.length){
      document.getElementById('dict-results').innerHTML = '<p style="color:var(--muted);margin-top:20px;">Aucun terme trouvé.</p>';
      return;
    }
    let curLetter = null;
    let h = '';
    list.forEach(g => {
      const letter = g.terme[0].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if(letter !== curLetter){ curLetter = letter; h += '<div class="dict-letter">' + letter + '</div>'; }
      const chips = (g.mats||[]).map(mid => matieresById[mid] ? '<span class="dict-chip" data-id="' + mid + '">' + esc(matieresById[mid].titre) + '</span>' : '').join('');
      h += '<div class="dict-entry"><div class="dict-term">' + esc(g.terme) + '</div>' +
        '<div class="dict-def">' + esc(g.def) + '</div>' +
        '<div class="dict-chips">' + chips + '</div></div>';
    });
    document.getElementById('dict-results').innerHTML = h;
    document.querySelectorAll('.dict-chip').forEach(c => c.addEventListener('click', () => openMatiere(parseInt(c.dataset.id))));
  }
  renderList(filtered);

  document.getElementById('dict-search').addEventListener('input', (e) => {
    const nq = e.target.value.trim().toLowerCase();
    const list = GLOSSARY.filter(g => !nq || g.terme.toLowerCase().includes(nq) || g.def.toLowerCase().includes(nq))
      .sort((a,b) => a.terme.localeCompare(b.terme, 'fr'));
    renderList(list);
  });
}

/* ---------------- Déverrouillage & déchiffrement ---------------- */
const SESSION_KEY = 'm2graf_session_v1'; // { email, token }
let pendingEmail = null;
let pendingMaster = 'M2';

function hexToBytes(hex){
  const arr = new Uint8Array(hex.length/2);
  for(let i=0;i<arr.length;i++) arr[i] = parseInt(hex.substr(i*2,2),16);
  return arr;
}
function base64ToBytes(b64){
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function decryptContent(url, hexKey){
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error('fetch_enc_failed');
  const b64 = (await res.text()).trim();
  const raw = base64ToBytes(b64);
  const iv = raw.slice(0, 12);
  const combined = raw.slice(12); // ciphertext || authTag, format attendu par Web Crypto
  const keyBytes = hexToBytes(hexKey);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, combined);
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

function showGateMsg(text, kind){
  const el = document.getElementById('gate-msg');
  el.textContent = text;
  el.className = kind || '';
}

function showEmailStep(){
  document.getElementById('gate-step-email').style.display = 'block';
  document.getElementById('gate-step-code').style.display = 'none';
}
function showCodeStep(email){
  document.getElementById('gate-email-display').textContent = email;
  document.getElementById('gate-step-email').style.display = 'none';
  document.getElementById('gate-step-code').style.display = 'block';
  document.getElementById('gate-code').value = '';
  document.getElementById('gate-code').focus();
}

let isSendingCode = false;
let isVerifyingCode = false;

// keys = { M1?: hex, M2?: hex } ; masters = formations du compte ; preferred = formation à afficher
async function finishUnlock(keys, masters, email, token, preferred, profile){
  currentEmail = email;
  PROFILE = profile || { email };
  updateProfileChips();
  if(token){ currentToken = token; try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email, token })); } catch(e){} }
  AVAILABLE = (masters && masters.length ? masters : Object.keys(keys)).filter(m => keys[m]);
  const results = await Promise.allSettled(AVAILABLE.map(async m => { CONTENT[m] = await decryptContent(MASTER_INFO[m].enc, keys[m]); }));
  const failed = results.filter(r => r.status === 'rejected');
  AVAILABLE = AVAILABLE.filter(m => CONTENT[m]);
  if(!AVAILABLE.length) throw (failed[0] && failed[0].reason) || new Error('aucun contenu');
  let saved = null;
  try { saved = localStorage.getItem('mastergraf_master_' + email); } catch(e){}
  // Priorité : choix fait à la connexion, puis formation principale du serveur (l'admin peut la changer), puis dernier choix de l'appareil
  const pick = [preferred, PROFILE.principal, saved, AVAILABLE[0]].find(m => m && CONTENT[m]);
  setMaster(pick);
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderSidebar();
  renderHome();
  if(preferred && !CONTENT[preferred]){
    root.insertAdjacentHTML('afterbegin', '<div class="viz-result" style="background:#FBEAE5;color:var(--red);margin-bottom:24px;">Le contenu du ' +
      MASTER_INFO[preferred].label + ' est momentanément indisponible. Réessaie plus tard ou contacte l\'administrateur.</div>');
  }
}

function chosenMaster(){
  const r = document.querySelector('input[name="gate-master"]:checked');
  return r ? r.value : 'M2';
}

async function sendCode(email, isResend){
  if(isSendingCode) return;
  isSendingCode = true;
  const btn = document.getElementById(isResend ? 'gate-resend' : 'gate-submit-email');
  btn.disabled = true;
  const originalText = btn.textContent;
  if(!isResend) btn.textContent = 'Envoi…';
  showGateMsg('', '');
  if(!isResend) pendingMaster = chosenMaster();
  try {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, master: pendingMaster }),
    });
    if(res.status === 429){
      showGateMsg('Un code a déjà été envoyé il y a moins de 30 secondes. Vérifie tes messages (et tes spams).', 'err');
    } else if(!res.ok){
      showGateMsg("Impossible d'envoyer le code pour le moment. Réessaie dans un instant.", 'err');
    } else {
      pendingEmail = email;
      showCodeStep(email);
      showGateMsg('Code envoyé — pense à vérifier tes spams si tu ne le vois pas.', '');
    }
  } catch(err){
    console.error('sendCode error:', err);
    showGateMsg('Connexion impossible. Vérifie ta connexion internet.', 'err');
  } finally {
    isSendingCode = false;
    btn.disabled = false;
    if(!isResend) btn.textContent = originalText;
  }
}

async function verifyCode(email, code){
  if(isVerifyingCode) return;
  isVerifyingCode = true;
  const btn = document.getElementById('gate-submit-code');
  btn.disabled = true;
  btn.textContent = 'Vérification…';
  showGateMsg('', '');
  try {
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if(res.status === 403){
      showGateMsg("Cet accès a été bloqué. Contacte l'administrateur.", 'err');
      showEmailStep();
      return;
    }
    if(res.status === 400){
      const { error } = await res.json().catch(() => ({}));
      showGateMsg(
        error === 'expired' ? 'Ce code a expiré, demande-en un nouveau.' :
        error === 'wrong_code' ? 'Code incorrect, réessaie.' :
        'Code invalide, demande-en un nouveau.', 'err'
      );
      return;
    }
    if(res.status === 429){
      showGateMsg('Trop de tentatives. Demande un nouveau code.', 'err');
      showEmailStep();
      return;
    }
    if(!res.ok){
      showGateMsg("Le service est momentanément indisponible. Réessaie dans un instant.", 'err');
      return;
    }
    const { keys, masters, token, profile } = await res.json();
    try {
      await finishUnlock(keys || {}, masters, email, token, pendingMaster, profile);
    } catch(decryptErr){
      console.error('Erreur de déchiffrement du contenu:', decryptErr);
      showGateMsg("Erreur au déchiffrement du contenu : " + (decryptErr && decryptErr.message ? decryptErr.message : decryptErr), 'err');
    }
  } catch(err){
    console.error('verifyCode error:', err);
    showGateMsg("Connexion impossible. Vérifie ta connexion internet et réessaie.", 'err');
  } finally {
    isVerifyingCode = false;
    btn.disabled = false;
    btn.textContent = 'Vérifier le code';
  }
}

async function resumeSession(email, token){
  try {
    const res = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    });
    if(!res.ok){
      try { localStorage.removeItem(SESSION_KEY); } catch(e){}
      if(res.status === 403) showGateMsg("Cet accès a été bloqué. Contacte l'administrateur.", 'err');
      else showGateMsg('', '');
      showEmailStep();
      return;
    }
    const { keys, masters, profile } = await res.json();
    currentToken = token;
    try {
      await finishUnlock(keys || {}, masters, email, null, null, profile);
    } catch(decryptErr){
      console.error('Erreur de déchiffrement (resume):', decryptErr);
      try { localStorage.removeItem(SESSION_KEY); } catch(e){}
      showGateMsg('', '');
      showEmailStep();
    }
  } catch(err){
    console.error('resumeSession error:', err);
    showEmailStep();
  }
}

document.getElementById('gate-form-email').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('gate-email').value.trim().toLowerCase();
  if(!email) return;
  sendCode(email, false);
});

document.getElementById('gate-form-code').addEventListener('submit', (e) => {
  e.preventDefault();
  const code = document.getElementById('gate-code').value.trim();
  if(!code || !pendingEmail) return;
  verifyCode(pendingEmail, code);
});

document.getElementById('gate-resend').addEventListener('click', () => {
  if(pendingEmail) sendCode(pendingEmail, true);
});

document.getElementById('gate-change-email').addEventListener('click', () => {
  pendingEmail = null;
  showGateMsg('', '');
  showEmailStep();
});

(function initGate(){
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if(saved && saved.email && saved.token){
      showGateMsg('Reconnexion…', '');
      resumeSession(saved.email, saved.token);
    }
  } catch(e){}
})();
