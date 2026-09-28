// Motion design de MasterGraf, avec Motion (https://motion.dev, licence MIT), chargé depuis vendor/motion.
// Principe : des mouvements courts (150 à 300 ms) qui expliquent ce qui change ; rien au défilement,
// rien sur le curseur. Tout est coupé si l'appareil demande de réduire les animations.
(function(){
  const M = window.Motion;
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const on = () => !!M && !reduce.matches;
  const EASE = [0.22, 1, 0.36, 1];                       // sortie douce
  const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 1 };
  const MAX_STAGGER = 18;                                 // au-delà, les éléments arrivent sans décalage

  function anim(el, kf, opts){ try { return M.animate(el, kf, opts); } catch(e){ return null; } }
  function rise(list, delayStep, dist){
    const els = Array.from(list).filter(Boolean);
    if(!els.length) return;
    const head = els.slice(0, MAX_STAGGER), tail = els.slice(MAX_STAGGER);
    anim(head, { opacity: [0, 1], y: [dist, 0] }, { duration: 0.28, ease: EASE, delay: M.stagger(delayStep) });
    if(tail.length) anim(tail, { opacity: [0, 1] }, { duration: 0.2, delay: delayStep * MAX_STAGGER });
  }

  // Curseur glissant sous l'élément actif d'un groupe (onglets, sélecteurs segmentés)
  const lastPos = {};
  function slider(container, activeSel, key, cls, tries){
    if(!container) return;
    const active = container.querySelector(activeSel);
    let ind = container.querySelector(':scope > .' + cls);
    if(!active){ if(ind) ind.remove(); return; }
    // Conteneur pas encore affiché (application encore masquée) : on réessaie à l'image suivante
    if(!active.offsetWidth){
      if((tries || 0) < 60) requestAnimationFrame(() => slider(container, activeSel, key, cls, (tries || 0) + 1));
      return;
    }
    if(!ind){ ind = document.createElement('span'); ind.className = cls; ind.setAttribute('aria-hidden', 'true'); container.appendChild(ind); }
    container.classList.add('has-' + cls);
    const pos = { x: active.offsetLeft, w: active.offsetWidth };
    const prev = lastPos[key];
    lastPos[key] = pos;
    if(on() && prev && (prev.x !== pos.x || prev.w !== pos.w)){
      ind.style.width = pos.w + 'px';
      anim(ind, { x: [prev.x, pos.x], scaleX: [prev.w / pos.w, 1] }, SPRING);
      ind.style.transformOrigin = '0 50%';
    } else {
      ind.style.width = pos.w + 'px';
      ind.style.transform = 'translateX(' + pos.x + 'px)';
    }
  }

  let lastViewKey = null;
  const UI = {
    // Nouveau contenu dans la zone principale
    view(root){
      const st = typeof state !== 'undefined' ? state : null;   // état global défini dans app.js
      const key = st ? st.view + ':' + st.matiereId : '';
      const sameMatiere = !!st && st.view === 'matiere' && key === lastViewKey;
      lastViewKey = key;
      UI.tabs(root);
      if(!on()) return;
      if(sameMatiere){
        const tc = root.querySelector('#tab-content');
        if(tc) anim(tc, { opacity: [0, 1], y: [6, 0] }, { duration: 0.22, ease: EASE });
        return;
      }
      anim(root, { opacity: [0, 1] }, { duration: 0.18 });
      rise(root.querySelectorAll('.home-hero, .crumbs, .mat-title-row, .mat-meta, .tabs, .locked-box'), 0.03, 8);
      rise(root.querySelectorAll('.resume-card, .stat-row, .sem-block, .fiche, .exo-card, .file-card, .search-hit, .doc-history-item, .profile-card, .profile-section, .dict-entry, #doc-upload-box, #file-upload-box'), 0.03, 10);
    },
    tabs(root){ slider(root.querySelector('.tabs'), '.tab-btn.active', 'tabs', 'tab-ind'); },
    segmented(box){ slider(box, 'button.active', 'master', 'seg-thumb'); },
    codeSwitch(box){ slider(box, '.code-lang-btn.active', 'code', 'seg-thumb'); },
    // Quiz : question et options qui arrivent, puis retour visuel sur la réponse
    quizQuestion(tc){
      if(!on()) return;
      rise(tc.querySelectorAll('.q-text, .q-opt, .quiz-result > *'), 0.04, 8);
    },
    quizAnswer(tc){
      if(!on()) return;
      const good = tc.querySelector('.q-opt.correct'), bad = tc.querySelector('.q-opt.wrong');
      if(good) anim(good, { scale: [0.985, 1] }, { type: 'spring', stiffness: 600, damping: 18 });
      if(bad) anim(bad, { x: [0, -5, 5, -3, 3, 0] }, { duration: 0.32, ease: 'easeOut' });
      const exp = tc.querySelector('.q-explain, .q-next');
      if(exp) rise(tc.querySelectorAll('.q-explain, .q-next'), 0.05, 6);
    },
    // Coche « Lu », bouton copié, etc.
    pop(el){
      if(!on() || !el) return;
      anim(el, { scale: [0.6, 1], opacity: [0, 1] }, { type: 'spring', stiffness: 700, damping: 22 });
    },
    // Contenu d'un bloc <details> qu'on déplie (fiche, démonstration)
    reveal(details){
      if(!on() || !details.open) return;
      const kids = Array.from(details.children).filter(k => k.tagName !== 'SUMMARY');
      rise(kids, 0.03, 6);
    },
    // Écran de connexion
    gate(){
      if(!on()) return;
      rise(document.querySelectorAll('.ga-main h2, .ga-main p, .ga-list li'), 0.05, 10);
      rise(document.querySelectorAll('#gate-card > *:not([style*="display:none"])'), 0.035, 8);
    },
    step(el){
      if(!on() || !el) return;
      anim(el, { opacity: [0, 1], x: [12, 0] }, { duration: 0.24, ease: EASE });
    },
  };

  // Taille de fenêtre modifiée : curseurs repositionnés sans animation
  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      [['.tabs', '.tab-btn.active', 'tabs', 'tab-ind'], ['#master-switch', 'button.active', 'master', 'seg-thumb']].forEach(([sel, act, key, cls]) => {
        delete lastPos[key]; slider(document.querySelector(sel), act, key, cls);
      });
      document.querySelectorAll('.code-switch').forEach(sw => { delete lastPos.code; slider(sw, '.code-lang-btn.active', 'code', 'seg-thumb'); });
    }, 120);
  });

  // Blocs dépliables : animation à l'ouverture
  document.addEventListener('toggle', (e) => { if(e.target && e.target.tagName === 'DETAILS') UI.reveal(e.target); }, true);

  // Chaque nouvel écran dans la zone principale (remplacement de son contenu)
  const root = document.getElementById('view-root');
  if(root && window.MutationObserver) new MutationObserver(() => UI.view(root)).observe(root, { childList: true });

  window.UI = UI;
  if(document.getElementById('gate') && getComputedStyle(document.getElementById('gate')).display !== 'none') UI.gate();
})();
