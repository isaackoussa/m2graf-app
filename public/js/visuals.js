// MasterGraf — graphiques d'explication interactifs, par formation et par matière.
// Chaque visualisation : { titre, explication, params: [{ id, label, min, max, step, value, fmt }],
//   compute(p) → { chart: spec MGChart, calcul: [lignes], resultat } }
// Les calculs sont refaits à chaque mouvement de curseur et détaillés sous le graphique.
(function(){
  const N = MGChart.num;
  const f2 = v => N.fmt(v, 2), f3 = v => N.fmt(v, 3), f4 = v => N.fmt(v, 4), f0 = v => N.fmt(v, 0);
  const pct = v => N.pct(v, 1), pct2 = v => N.pct(v, 2);
  const range = N.range;

  // Histogramme : renvoie des points [centre, densité]
  function histo(data, nb, lo, hi){
    lo = lo != null ? lo : Math.min(...data); hi = hi != null ? hi : Math.max(...data);
    const w = (hi - lo) / nb, c = new Array(nb).fill(0);
    data.forEach(x => { const k = Math.floor((x - lo) / w); if(k >= 0 && k < nb) c[k]++; });
    return c.map((v, k) => [lo + (k + 0.5) * w, v / (data.length * w)]);
  }
  function quantile(sorted, q){ const i = (sorted.length - 1) * q, a = Math.floor(i); return sorted[a] + (sorted[Math.min(a + 1, sorted.length - 1)] - sorted[a]) * (i - a); }
  function bs(S, K, r, s, T){
    const d1 = (Math.log(S / K) + (r + s * s / 2) * T) / (s * Math.sqrt(T)), d2 = d1 - s * Math.sqrt(T);
    return { d1, d2, call: S * N.normCdf(d1) - K * Math.exp(-r * T) * N.normCdf(d2), put: K * Math.exp(-r * T) * N.normCdf(-d2) - S * N.normCdf(-d1) };
  }
  function matMul(a, b){ return a.map(r => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0))); }

  // ---------- Visualisations réutilisables ----------
  const V = {
    amortissement: {
      titre: "Tableau d'amortissement à annuités constantes",
      explication: "Chaque annuité rembourse d'abord les intérêts sur le capital restant dû, puis le capital. Au fil du temps, la part d'intérêts diminue et celle de l'amortissement augmente.",
      params: [
        { id: 'K', label: 'Capital emprunté (M FCFA)', min: 5, max: 500, step: 5, value: 50 },
        { id: 'i', label: 'Taux annuel (%)', min: 1, max: 20, step: 0.25, value: 9 },
        { id: 'n', label: 'Durée (années)', min: 2, max: 25, step: 1, value: 6 },
      ],
      compute(p){
        const K = p.K * 1e6, i = p.i / 100, n = p.n;
        const a = K * i / (1 - Math.pow(1 + i, -n));
        let crd = K; const I = [], A = [];
        for(let t = 1; t <= n; t++){ const it = crd * i; I.push([t, it]); A.push([t, a - it]); crd -= a - it; }
        return {
          chart: { xlabel: 'Année', ylabel: 'FCFA', xticks: range(1, n, n - 1), xfmt: v => String(Math.round(v)),
            series: [{ name: 'Intérêts', type: 'bar', points: I }, { name: 'Amortissement du capital', type: 'bar', points: A }] },
          calcul: [
            `a = K·i / (1 − (1+i)^−n) = ${N.fcfa(K)} × ${f4(i)} / (1 − ${f4(1 + i)}^−${n})`,
            `(1+i)^−n = ${f4(Math.pow(1 + i, -n))} ⇒ dénominateur = ${f4(1 - Math.pow(1 + i, -n))}`,
            `Année 1 : intérêts = ${N.fcfa(I[0][1])}, amortissement = ${N.fcfa(A[0][1])}`,
            `Coût total du crédit = n·a − K = ${N.fcfa(n * a - K)}`,
          ],
          resultat: `Annuité constante ≈ ${N.fcfa(a)}`,
        };
      },
    },
    levier: {
      titre: "Effet de levier financier",
      explication: "La rentabilité des capitaux propres (ROE) augmente avec l'endettement tant que la rentabilité économique dépasse le coût de la dette. Dans le cas contraire, l'endettement détruit de la rentabilité (effet de massue).",
      params: [
        { id: 'roa', label: 'Rentabilité économique ROA (%)', min: 0, max: 25, step: 0.5, value: 12 },
        { id: 'i', label: 'Coût de la dette i (%)', min: 1, max: 20, step: 0.5, value: 8 },
        { id: 'dcp', label: 'Endettement D/CP', min: 0, max: 4, step: 0.1, value: 1.5 },
      ],
      compute(p){
        const roa = p.roa / 100, i = p.i / 100;
        const pts = range(0, 4, 40).map(d => [d, roa + (roa - i) * d]);
        const roe = roa + (roa - i) * p.dcp;
        return {
          chart: { xlabel: 'D / CP', ylabel: 'ROE', yfmt: v => N.pct(v, 0), xfmt: v => f2(v),
            series: [{ name: 'ROE', type: 'line', points: pts }, { name: 'Point choisi', type: 'scatter', points: [[p.dcp, roe]], slot: 1 }],
            hlines: [{ y: roa, label: 'ROA' }] },
          calcul: [`ROE = ROA + (ROA − i) × D/CP`, `= ${pct(roa)} + (${pct(roa)} − ${pct(i)}) × ${f2(p.dcp)}`],
          resultat: `ROE = ${pct(roe)} — levier ${roa > i ? 'positif' : roa < i ? 'négatif (massue)' : 'neutre'}`,
        };
      },
    },
    sousAssurance: {
      titre: "Règle proportionnelle de capitaux",
      explication: "En cas de sous-assurance, l'assureur n'indemnise que dans le rapport valeur assurée / valeur réelle. L'écart entre la droite du dommage et celle de l'indemnité est le découvert supporté par l'assuré.",
      params: [
        { id: 'vr', label: 'Valeur réelle (M FCFA)', min: 50, max: 500, step: 10, value: 200 },
        { id: 'va', label: 'Valeur assurée (M FCFA)', min: 10, max: 500, step: 10, value: 150 },
        { id: 'd', label: 'Dommage (M FCFA)', min: 0, max: 500, step: 5, value: 80 },
      ],
      compute(p){
        const r = Math.min(1, p.va / p.vr), dm = Math.min(p.d, p.vr);
        const xs = range(0, p.vr, 20);
        return {
          chart: { xlabel: 'Dommage (M FCFA)', ylabel: 'M FCFA',
            series: [{ name: 'Dommage', type: 'line', points: xs.map(x => [x, x]), dash: true }, { name: 'Indemnité', type: 'line', points: xs.map(x => [x, x * r]) }],
            vlines: [{ x: dm, label: 'Sinistre' }] },
          calcul: [`Rapport VA/VR = ${p.va}/${p.vr} = ${f3(r)}`, `Indemnité = ${dm} × ${f3(r)}`],
          resultat: `Indemnité = ${f2(dm * r)} M FCFA ; découvert de l'assuré = ${f2(dm * (1 - r))} M`,
        };
      },
    },
    poissonBinom: {
      titre: "Lois de Poisson et binomiale",
      explication: "La binomiale B(n, p) compte les succès parmi n essais ; quand n est grand et p petit, elle se rapproche d'une Poisson de paramètre λ = np — c'est pourquoi la Poisson modélise le nombre de sinistres.",
      params: [
        { id: 'n', label: 'Nombre d\'essais n', min: 2, max: 200, step: 1, value: 20 },
        { id: 'p', label: 'Probabilité p (%)', min: 1, max: 60, step: 1, value: 10 },
      ],
      compute(p){
        const n = p.n, q = p.p / 100, l = n * q, kmax = Math.min(n, Math.ceil(l + 5 * Math.sqrt(l) + 5));
        const ks = range(0, kmax, kmax);
        return {
          chart: { xlabel: 'k', ylabel: 'P(N = k)', xfmt: v => String(Math.round(v)),
            series: [{ name: `Binomiale(${n} ; ${f2(q)})`, type: 'bar', points: ks.map(k => [k, N.binomPmf(k, n, q)]) },
                     { name: `Poisson(${f2(l)})`, type: 'bar', points: ks.map(k => [k, N.poissonPmf(k, l)]) }] },
          calcul: [`E = np = ${f2(l)} pour les deux lois`, `V(binomiale) = np(1−p) = ${f3(l * (1 - q))} ; V(Poisson) = λ = ${f3(l)}`, `P(N = 0) : binomiale ${f4(Math.pow(1 - q, n))}, Poisson ${f4(Math.exp(-l))}`],
          resultat: `Écart maximal entre les deux lois : ${f4(Math.max(...ks.map(k => Math.abs(N.binomPmf(k, n, q) - N.poissonPmf(k, l)))))}`,
        };
      },
    },
    tcl: {
      titre: "Théorème central limite",
      explication: "La moyenne de n coûts de sinistres exponentiels (loi très asymétrique) suit une loi Gamma. Quand n grandit, elle devient de plus en plus proche d'une normale : c'est ce qui permet de calculer un chargement de sécurité sur un grand portefeuille.",
      params: [{ id: 'n', label: 'Taille n de l\'échantillon', min: 1, max: 60, step: 1, value: 5 }],
      compute(p){
        const n = p.n, mu = 1, sd = 1 / Math.sqrt(n);
        const xs = range(0.001, 3, 150);
        const gam = x => Math.exp(n * Math.log(n) + (n - 1) * Math.log(x) - n * x - N.logGamma(n));
        return {
          chart: { xlabel: 'Moyenne empirique (en unités de coût moyen)', ylabel: 'Densité',
            series: [{ name: 'Loi exacte (Gamma)', type: 'area', points: xs.map(x => [x, gam(x)]) }, { name: 'Approximation normale', type: 'line', points: xs.map(x => [x, N.normPdf(x, mu, sd)]), dash: true }] },
          calcul: [`X̄ₙ ~ Gamma(n = ${n}, taux n) : E = 1, σ = 1/√n = ${f3(sd)}`, `Asymétrie de X̄ₙ = 2/√n = ${f3(2 / Math.sqrt(n))} (0 pour une normale)`],
          resultat: n >= 30 ? 'Approximation normale très bonne' : n >= 10 ? 'Approximation acceptable' : 'Asymétrie encore marquée : l\'approximation normale sous-estime la queue droite',
        };
      },
    },
    studentNormale: {
      titre: "Loi de Student et intervalle de confiance",
      explication: "Quand σ est inconnu et estimé, on utilise la loi de Student à n − 1 degrés de liberté, aux queues plus épaisses que la normale : l'intervalle de confiance est plus large pour les petits échantillons.",
      params: [
        { id: 'n', label: 'Taille d\'échantillon n', min: 2, max: 60, step: 1, value: 6 },
        { id: 'c', label: 'Niveau de confiance (%)', min: 80, max: 99.5, step: 0.5, value: 95 },
      ],
      compute(p){
        const nu = p.n - 1;
        const tpdf = x => Math.exp(N.logGamma((nu + 1) / 2) - N.logGamma(nu / 2)) / Math.sqrt(nu * Math.PI) * Math.pow(1 + x * x / nu, -(nu + 1) / 2);
        // quantile de Student par dichotomie sur la fonction de répartition numérique
        const xs = range(-6, 6, 240);
        const alpha = 1 - p.c / 100;
        let lo = 0, hi = 60;
        const cdf = t => { let s = 0; const h = t / 400; for(let i = 0; i < 400; i++){ const a = i * h, b = a + h; s += (tpdf(a) + 4 * tpdf((a + b) / 2) + tpdf(b)) * h / 6; } return 0.5 + s; };
        for(let k = 0; k < 50; k++){ const m = (lo + hi) / 2; if(cdf(m) < 1 - alpha / 2) lo = m; else hi = m; }
        const tq = (lo + hi) / 2, zq = N.normInv(1 - alpha / 2);
        return {
          chart: { xlabel: 'x', ylabel: 'Densité',
            series: [{ name: `Student (${nu} ddl)`, type: 'line', points: xs.map(x => [x, tpdf(x)]) }, { name: 'Normale N(0,1)', type: 'line', points: xs.map(x => [x, N.normPdf(x)]), dash: true }],
            vlines: [{ x: tq, label: 't = ' + f3(tq) }, { x: -tq }] },
          calcul: [`Quantile de Student t(${nu} ; ${f3(1 - alpha / 2)}) = ${f3(tq)}`, `Quantile normal z = ${f3(zq)}`, `IC = x̄ ± t·s/√n : largeur relative ${f2(tq / zq)} fois celle de l'IC normal`],
          resultat: `Pour n = ${p.n}, l'IC de Student est ${pct((tq / zq) - 1)} plus large`,
        };
      },
    },
    puissance: {
      titre: "Puissance d'un test sur une moyenne",
      explication: "La puissance est la probabilité de détecter un écart réel δ. Elle augmente avec la taille d'échantillon et avec l'écart à détecter, et diminue quand on exige un risque α plus faible.",
      params: [
        { id: 'delta', label: 'Écart à détecter δ/σ', min: 0.05, max: 1.5, step: 0.05, value: 0.3 },
        { id: 'alpha', label: 'Risque α (%)', min: 1, max: 10, step: 0.5, value: 5 },
        { id: 'n', label: 'Taille n', min: 5, max: 400, step: 5, value: 60 },
      ],
      compute(p){
        const z = N.normInv(1 - p.alpha / 100 / 2);
        const pw = n => N.normCdf(p.delta * Math.sqrt(n) - z) + N.normCdf(-p.delta * Math.sqrt(n) - z);
        const need = Math.ceil(Math.pow((z + N.normInv(0.8)) / p.delta, 2));
        return {
          chart: { xlabel: 'Taille d\'échantillon n', ylabel: 'Puissance', ymax: 1, yfmt: v => N.pct(v, 0),
            series: [{ name: 'Puissance 1 − β', type: 'line', points: range(2, 400, 100).map(n => [n, pw(n)]) }],
            hlines: [{ y: 0.8, label: '80 %' }], vlines: [{ x: p.n, label: 'n choisi' }] },
          calcul: [`Test bilatéral : z₁₋α/₂ = ${f3(z)}`, `Puissance(n) ≈ Φ(δ√n − z) + Φ(−δ√n − z)`, `Pour n = ${p.n} : Φ(${f3(p.delta * Math.sqrt(p.n) - z)}) ≈ ${pct(pw(p.n))}`],
          resultat: `Puissance = ${pct(pw(p.n))} ; n nécessaire pour 80 % : ${need}`,
        };
      },
    },
    utilite: {
      titre: "Utilité espérée et prime maximale",
      explication: "Pour un agent averse au risque (utilité logarithmique, concave), l'équivalent certain est inférieur à la richesse espérée. La différence entre la richesse initiale et l'équivalent certain est la prime maximale qu'il accepte de payer pour s'assurer.",
      params: [
        { id: 'w', label: 'Richesse initiale (M FCFA)', min: 2, max: 50, step: 1, value: 10 },
        { id: 'L', label: 'Perte possible (M FCFA)', min: 0.5, max: 45, step: 0.5, value: 6 },
        { id: 'p', label: 'Probabilité de perte (%)', min: 1, max: 60, step: 1, value: 10 },
      ],
      compute(p){
        const L = Math.min(p.L, p.w - 0.1), q = p.p / 100;
        const Ew = p.w - q * L, Eu = (1 - q) * Math.log(p.w) + q * Math.log(p.w - L), EC = Math.exp(Eu);
        const xs = range(Math.max(0.1, p.w - L - 1), p.w + 1, 80);
        return {
          chart: { xlabel: 'Richesse (M FCFA)', ylabel: 'Utilité ln(w)',
            series: [{ name: 'u(w) = ln w', type: 'line', points: xs.map(x => [x, Math.log(x)]) },
                     { name: 'Corde (loterie)', type: 'line', points: [[p.w - L, Math.log(p.w - L)], [p.w, Math.log(p.w)]], dash: true },
                     { name: 'E[u(W)]', type: 'scatter', points: [[Ew, Eu]] }],
            vlines: [{ x: EC, label: 'EC' }, { x: Ew, label: 'E[W]' }] },
          calcul: [`E[W] = ${f2(p.w)} − ${f2(q)} × ${f2(L)} = ${f3(Ew)} M`, `E[u] = ${f2(1 - q)}·ln(${p.w}) + ${f2(q)}·ln(${f2(p.w - L)}) = ${f4(Eu)}`, `EC = e^E[u] = ${f3(EC)} M ; prime de risque = ${f3(Ew - EC)} M`],
          resultat: `Prime maximale = ${f3(p.w - EC)} M FCFA (prime pure ${f3(q * L)} M) — chargement acceptable ${pct((p.w - EC) / (q * L) - 1)}`,
        };
      },
    },
    markovBM: {
      titre: "Convergence d'un système bonus-malus",
      explication: "Chaque année sans sinistre, l'assuré descend d'une classe ; en cas de sinistre, il remonte en classe malus. Quelle que soit la classe de départ, la répartition converge vers la loi stationnaire π = πP.",
      params: [{ id: 'q', label: 'Probabilité de sinistre annuelle (%)', min: 1, max: 50, step: 1, value: 10 }],
      compute(p){
        const s = p.q / 100, P = [[1 - s, 0, s], [1 - s, 0, s], [0, 1 - s, s]];
        let mu = [[0, 1, 0]]; const L = [[], [], []];
        for(let t = 0; t <= 12; t++){ mu[0].forEach((v, k) => L[k].push([t, v])); mu = matMul(mu, P); }
        const pi2 = s, pi1 = (1 - s) * s, pi0 = 1 - pi1 - pi2;
        return {
          chart: { xlabel: 'Année', ylabel: 'Proportion d\'assurés', ymax: 1, yfmt: v => N.pct(v, 0), xfmt: v => String(Math.round(v)),
            series: [{ name: 'Bonus (0)', type: 'line', points: L[0] }, { name: 'Neutre (1)', type: 'line', points: L[1] }, { name: 'Malus (2)', type: 'line', points: L[2] }] },
          calcul: [`π₂ = P(sinistre) = ${f3(pi2)}`, `π₁ = (1 − s)·π₂ = ${f3(pi1)}`, `π₀ = 1 − π₁ − π₂ = ${f3(pi0)}`],
          resultat: `Loi stationnaire π = (${pct(pi0)} ; ${pct(pi1)} ; ${pct(pi2)})`,
        };
      },
    },
    ruineJoueur: {
      titre: "Ruine du joueur",
      explication: "Probabilité qu'une réserve qui gagne 1 (probabilité p) ou perd 1 à chaque période tombe à 0 avant d'atteindre N. Dès que p > 1/2, la probabilité de ruine décroît géométriquement avec la réserve initiale.",
      params: [
        { id: 'p', label: 'Probabilité de gain p (%)', min: 40, max: 70, step: 1, value: 55 },
        { id: 'N', label: 'Objectif N', min: 5, max: 60, step: 1, value: 20 },
      ],
      compute(p){
        const q = 1 - p.p / 100, pp = p.p / 100, r = q / pp;
        const ruin = k => Math.abs(pp - 0.5) < 1e-9 ? 1 - k / p.N : (Math.pow(r, k) - Math.pow(r, p.N)) / (1 - Math.pow(r, p.N));
        const pts = range(0, p.N, p.N).map(k => [k, ruin(k)]);
        return {
          chart: { xlabel: 'Réserve initiale k', ylabel: 'P(ruine)', ymax: 1, yfmt: v => N.pct(v, 0), xfmt: v => String(Math.round(v)),
            series: [{ name: 'Probabilité de ruine', type: 'line', points: pts }] },
          calcul: [`r = q/p = ${f4(r)}`, `P(ruine | k) = (rᵏ − r^N)/(1 − r^N)`, `k = 3 : ${pct(ruin(3))} ; k = 10 : ${pct(ruin(Math.min(10, p.N)))}`],
          resultat: pp > 0.5 ? `Horizon infini : P(ruine | k) = rᵏ, soit ${pct(Math.pow(r, 3))} pour k = 3` : 'p ≤ 1/2 : la ruine est certaine face à un adversaire infiniment riche',
        };
      },
    },
    obligation: {
      titre: "Prix d'une obligation, duration et convexité",
      explication: "Le prix d'une obligation baisse quand le taux monte, selon une courbe convexe. La tangente (duration modifiée) donne l'approximation au premier ordre ; la convexité explique pourquoi elle sous-estime le prix.",
      params: [
        { id: 'c', label: 'Coupon (%)', min: 0, max: 12, step: 0.5, value: 6 },
        { id: 'n', label: 'Maturité (années)', min: 1, max: 30, step: 1, value: 10 },
        { id: 'y', label: 'Taux de rendement (%)', min: 1, max: 15, step: 0.25, value: 7 },
      ],
      compute(p){
        const price = y => { let s = 0; for(let t = 1; t <= p.n; t++) s += (p.c + (t === p.n ? 100 : 0)) / Math.pow(1 + y, t); return s; };
        const y0 = p.y / 100, P0 = price(y0);
        let D = 0; for(let t = 1; t <= p.n; t++) D += t * (p.c + (t === p.n ? 100 : 0)) / Math.pow(1 + y0, t);
        D /= P0; const Dm = D / (1 + y0);
        const ys = range(0.005, 0.16, 80);
        return {
          chart: { xlabel: 'Taux de rendement', ylabel: 'Prix (% du nominal)', xfmt: v => N.pct(v, 0),
            series: [{ name: 'Prix exact', type: 'line', points: ys.map(y => [y, price(y)]) }, { name: 'Approximation par la duration', type: 'line', points: ys.map(y => [y, P0 * (1 - Dm * (y - y0))]), dash: true }],
            vlines: [{ x: y0, label: 'y = ' + N.pct(y0, 2) }] },
          calcul: [`P = Σ Fₜ/(1+y)ᵗ = ${f2(P0)} % du nominal`, `Duration de Macaulay D = ${f3(D)} ans`, `Duration modifiée = D/(1+y) = ${f3(Dm)}`, `+1 point de taux ⇒ ΔP/P ≈ −${f2(Dm)} % (exact : ${f2((price(y0 + 0.01) / P0 - 1) * 100)} %)`],
          resultat: `Prix ${f2(P0)} ; duration ${f2(D)} ans`,
        };
      },
    },
    binomialCRR: {
      titre: "Modèle binomial → Black-Scholes",
      explication: "Le prix d'un call calculé dans un arbre binomial (Cox-Ross-Rubinstein) oscille puis converge vers le prix de Black-Scholes quand le nombre de périodes augmente.",
      params: [
        { id: 'S', label: 'Prix du sous-jacent S₀', min: 60, max: 140, step: 1, value: 100 },
        { id: 'K', label: 'Prix d\'exercice K', min: 60, max: 140, step: 1, value: 100 },
        { id: 's', label: 'Volatilité σ (%)', min: 5, max: 60, step: 1, value: 20 },
        { id: 'r', label: 'Taux sans risque (%)', min: 0, max: 10, step: 0.25, value: 5 },
      ],
      compute(p){
        const T = 1, s = p.s / 100, r = p.r / 100;
        const crr = n => {
          const dt = T / n, u = Math.exp(s * Math.sqrt(dt)), d = 1 / u, q = (Math.exp(r * dt) - d) / (u - d);
          let tot = 0;
          for(let k = 0; k <= n; k++) tot += Math.exp(N.logGamma(n + 1) - N.logGamma(k + 1) - N.logGamma(n - k + 1) + k * Math.log(q) + (n - k) * Math.log(1 - q)) * Math.max(p.S * Math.pow(u, k) * Math.pow(d, n - k) - p.K, 0);
          return tot * Math.exp(-r * T);
        };
        const b = bs(p.S, p.K, r, s, T);
        const pts = range(1, 100, 99).map(n => [n, crr(Math.round(n))]);
        const u1 = Math.exp(s / Math.sqrt(10)), q1 = (Math.exp(r / 10) - 1 / u1) / (u1 - 1 / u1);
        return {
          chart: { xlabel: 'Nombre de périodes n', ylabel: 'Prix du call', xfmt: v => String(Math.round(v)),
            series: [{ name: 'Binomial CRR', type: 'line', points: pts }], hlines: [{ y: b.call, label: 'Black-Scholes ' + f2(b.call) }] },
          calcul: [`n = 10 : u = e^(σ√Δt) = ${f4(u1)}, d = 1/u, q = ${f4(q1)}`, `CRR(10) = ${f4(crr(10))} ; CRR(100) = ${f4(crr(100))}`, `Black-Scholes : d₁ = ${f3(b.d1)}, d₂ = ${f3(b.d2)}`],
          resultat: `Prix Black-Scholes = ${f4(b.call)}`,
        };
      },
    },
    regression: {
      titre: "Régression linéaire et moindres carrés",
      explication: "Nuage de points simulé autour d'une droite vraie. Les MCO ajustent la droite qui minimise la somme des carrés des résidus. Plus le bruit est fort, plus le R² baisse et plus l'estimation de la pente est incertaine.",
      params: [
        { id: 'n', label: 'Nombre d\'observations', min: 5, max: 200, step: 5, value: 40 },
        { id: 'b', label: 'Pente vraie β₁', min: -3, max: 3, step: 0.1, value: 1.2 },
        { id: 'sig', label: 'Écart-type du bruit σ', min: 0.1, max: 6, step: 0.1, value: 1.5 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const g = N.rng(p.seed * 7919), pts = [];
        for(let i = 0; i < p.n; i++){ const x = g.u() * 10; pts.push([x, 3.8 + p.b * x + p.sig * g.z()]); }
        const mx = pts.reduce((a, q) => a + q[0], 0) / p.n, my = pts.reduce((a, q) => a + q[1], 0) / p.n;
        let sxy = 0, sxx = 0, sct = 0; pts.forEach(q => { sxy += (q[0] - mx) * (q[1] - my); sxx += (q[0] - mx) ** 2; sct += (q[1] - my) ** 2; });
        const b1 = sxy / sxx, b0 = my - b1 * mx;
        let scr = 0; pts.forEach(q => scr += (q[1] - b0 - b1 * q[0]) ** 2);
        const s2 = scr / (p.n - 2), se = Math.sqrt(s2 / sxx);
        return {
          chart: { xlabel: 'x', ylabel: 'y',
            series: [{ name: 'Observations', type: 'scatter', points: pts }, { name: 'Droite MCO', type: 'line', points: [[0, b0], [10, b0 + 10 * b1]], slot: 1 }, { name: 'Droite vraie', type: 'line', points: [[0, 3.8], [10, 3.8 + 10 * p.b]], dash: true, slot: 2 }] },
          calcul: [`x̄ = ${f3(mx)}, ȳ = ${f3(my)}`, `β̂₁ = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² = ${f2(sxy)}/${f2(sxx)} = ${f4(b1)}`, `β̂₀ = ȳ − β̂₁x̄ = ${f4(b0)}`, `se(β̂₁) = ${f4(se)} ⇒ t = ${f2(b1 / se)}`],
          resultat: `ŷ = ${f3(b0)} + ${f3(b1)}x ; R² = ${f3(1 - scr / sct)}`,
        };
      },
    },
    roc: {
      titre: "Courbe ROC et matrice de confusion",
      explication: "Les scores des bons et mauvais payeurs sont modélisés par deux lois normales. Plus elles sont séparées, plus l'AUC est élevée. Le seuil détermine le compromis entre fraudes/défauts détectés (sensibilité) et fausses alertes.",
      params: [
        { id: 'd', label: 'Séparation des scores (d)', min: 0, max: 3, step: 0.05, value: 1.2 },
        { id: 's', label: 'Seuil de décision', min: -2, max: 4, step: 0.05, value: 1 },
      ],
      compute(p){
        const pts = range(-5, 7, 120).map(t => [1 - N.normCdf(t), 1 - N.normCdf(t - p.d)]).reverse();
        const auc = N.normCdf(p.d / Math.SQRT2);
        const fpr = 1 - N.normCdf(p.s), tpr = 1 - N.normCdf(p.s - p.d);
        return {
          chart: { xlabel: 'Taux de faux positifs (1 − spécificité)', ylabel: 'Sensibilité', xmin: 0, xmax: 1, ymin: 0, ymax: 1, xfmt: v => N.pct(v, 0), yfmt: v => N.pct(v, 0),
            series: [{ name: 'Courbe ROC', type: 'area', points: [[0, 0], ...pts, [1, 1]] }, { name: 'Modèle aléatoire', type: 'line', points: [[0, 0], [1, 1]], dash: true, slot: 2 }, { name: 'Seuil choisi', type: 'scatter', points: [[fpr, tpr]], slot: 1 }] },
          calcul: [`AUC = Φ(d/√2) = Φ(${f3(p.d / Math.SQRT2)}) = ${f3(auc)}`, `Gini = 2·AUC − 1 = ${f3(2 * auc - 1)}`, `Au seuil ${f2(p.s)} : sensibilité ${pct(tpr)}, spécificité ${pct(1 - fpr)}`],
          resultat: `AUC = ${f3(auc)} — sur 1 000 négatifs et 1 000 positifs : VP = ${f0(tpr * 1000)}, FP = ${f0(fpr * 1000)}`,
        };
      },
    },
    surdispersion: {
      titre: "Poisson ou binomiale négative ?",
      explication: "À moyenne égale, la binomiale négative a une variance plus grande (hétérogénéité du portefeuille) : plus de zéros et plus d'assurés avec plusieurs sinistres. Un GLM Poisson sur de telles données sous-estime les écarts-types.",
      params: [
        { id: 'm', label: 'Fréquence moyenne λ', min: 0.05, max: 3, step: 0.05, value: 0.8 },
        { id: 'phi', label: 'Surdispersion V/E', min: 1.05, max: 5, step: 0.05, value: 2 },
      ],
      compute(p){
        const m = p.m, r = m / (p.phi - 1), q = r / (r + m);
        const nb = k => Math.exp(N.logGamma(k + r) - N.logGamma(r) - N.logGamma(k + 1) + r * Math.log(q) + k * Math.log(1 - q));
        const kmax = Math.max(6, Math.ceil(m + 4 * Math.sqrt(m * p.phi)));
        const ks = range(0, kmax, kmax);
        return {
          chart: { xlabel: 'Nombre de sinistres k', ylabel: 'P(N = k)', xfmt: v => String(Math.round(v)),
            series: [{ name: 'Poisson', type: 'bar', points: ks.map(k => [k, N.poissonPmf(k, m)]) }, { name: 'Binomiale négative', type: 'bar', points: ks.map(k => [k, nb(k)]) }] },
          calcul: [`Même moyenne : E[N] = ${f2(m)}`, `Poisson : V = ${f2(m)} ; BN : V = ${f2(m * p.phi)} (r = ${f3(r)})`, `P(N = 0) : Poisson ${pct(N.poissonPmf(0, m))}, BN ${pct(nb(0))}`],
          resultat: `Écarts-types Poisson sous-estimés d'un facteur √${f2(p.phi)} = ${f2(Math.sqrt(p.phi))}`,
        };
      },
    },
    brownien: {
      titre: "Mouvement brownien géométrique",
      explication: "Trajectoires simulées du modèle de Black-Scholes : S_t = S₀ exp((μ − σ²/2)t + σW_t). La dérive fixe la tendance, la volatilité l'amplitude des fluctuations. Changez le tirage pour voir d'autres scénarios.",
      params: [
        { id: 'mu', label: 'Dérive μ (%/an)', min: -20, max: 30, step: 1, value: 8 },
        { id: 's', label: 'Volatilité σ (%/an)', min: 5, max: 80, step: 1, value: 25 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const g = N.rng(p.seed * 104729), n = 250, dt = 1 / n, mu = p.mu / 100, s = p.s / 100, series = [];
        const finals = [];
        for(let j = 0; j < 5; j++){
          let S = 100; const pts = [[0, S]];
          for(let k = 1; k <= n; k++){ S *= Math.exp((mu - s * s / 2) * dt + s * Math.sqrt(dt) * g.z()); pts.push([k * dt, S]); }
          finals.push(S); series.push({ name: 'Trajectoire ' + (j + 1), type: 'line', points: pts, width: 1.5 });
        }
        series.push({ name: 'E[S_t] = S₀e^(μt)', type: 'line', points: range(0, 1, 20).map(t => [t, 100 * Math.exp(mu * t)]), dash: true, slot: 7 });
        return {
          chart: { xlabel: 'Temps (années)', ylabel: 'Prix', series },
          calcul: [`E[S₁] = 100·e^μ = ${f2(100 * Math.exp(mu))}`, `Médiane de S₁ = 100·e^(μ−σ²/2) = ${f2(100 * Math.exp(mu - s * s / 2))}`, `Intervalle à 95 % de S₁ : [${f2(100 * Math.exp(mu - s * s / 2 - 1.96 * s))} ; ${f2(100 * Math.exp(mu - s * s / 2 + 1.96 * s))}]`],
          resultat: `Valeurs finales simulées : ${finals.map(f2).join(' ; ')}`,
        };
      },
    },
    poissonProcess: {
      titre: "Processus de Poisson (arrivée des sinistres)",
      explication: "Trajectoire du nombre cumulé de sinistres : les temps entre deux sinistres sont exponentiels de moyenne 1/λ. La droite λt est l'espérance du processus.",
      params: [
        { id: 'l', label: 'Intensité λ (sinistres par mois)', min: 0.5, max: 30, step: 0.5, value: 12 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 3 },
      ],
      compute(p){
        const g = N.rng(p.seed * 31337), T = 3; let t = 0, k = 0; const pts = [[0, 0]], gaps = [];
        while(true){ const e = -Math.log(1 - g.u()) / p.l; if(t + e > T) break; t += e; gaps.push(e); k++; pts.push([t, k]); }
        pts.push([T, k]);
        return {
          chart: { xlabel: 'Temps (mois)', ylabel: 'Nombre cumulé de sinistres',
            series: [{ name: 'N(t) simulé', type: 'step', points: pts }, { name: 'E[N(t)] = λt', type: 'line', points: [[0, 0], [T, p.l * T]], dash: true }] },
          calcul: [`Temps inter-arrivées ~ Exp(λ) : moyenne 1/λ = ${f3(1 / p.l)} mois (${f2(30 / p.l)} jours)`, `N(3) ~ Poisson(${f2(3 * p.l)}) : E = V = ${f2(3 * p.l)}`, `P(aucun sinistre en 5 jours) = e^(−λ·5/30) = ${pct(Math.exp(-p.l / 6))}`],
          resultat: `${k} sinistres simulés sur 3 mois (attendu ${f2(3 * p.l)})`,
        };
      },
    },
    inversion: {
      titre: "Simulation par la méthode d'inversion (Pareto)",
      explication: "On transforme des uniformes U par X = x_m·U^(−1/α). L'histogramme des valeurs simulées épouse la densité théorique ; plus α est petit, plus la queue est épaisse (sinistres graves).",
      params: [
        { id: 'a', label: 'Paramètre de queue α', min: 1.1, max: 5, step: 0.1, value: 2.5 },
        { id: 'n', label: 'Nombre de tirages', min: 100, max: 20000, step: 100, value: 2000 },
      ],
      compute(p){
        const g = N.rng(97), xm = 1000, data = [];
        for(let i = 0; i < p.n; i++) data.push(xm * Math.pow(1 - g.u(), -1 / p.a));
        const hi = xm * Math.pow(0.02, -1 / p.a);
        const h = histo(data, 30, xm, hi);
        const dens = x => p.a * Math.pow(xm, p.a) / Math.pow(x, p.a + 1);
        const sorted = data.slice().sort((a, b) => a - b);
        return {
          chart: { xlabel: 'Montant du sinistre', ylabel: 'Densité',
            series: [{ name: 'Histogramme simulé', type: 'bar', points: h }, { name: 'Densité théorique', type: 'line', points: range(xm, hi, 80).map(x => [x, dens(x)]) }] },
          calcul: [`X = ${xm}·U^(−1/${f2(p.a)})`, `U = 0,9 ⇒ X = ${f0(xm * Math.pow(0.1, -1 / p.a))} (quantile 90 %)`, `Quantile 99 % : simulé ${f0(quantile(sorted, 0.99))}, théorique ${f0(xm * Math.pow(0.01, -1 / p.a))}`],
          resultat: `Moyenne simulée ${f0(data.reduce((a, b) => a + b, 0) / p.n)} (théorique ${p.a > 1 ? f0(p.a * xm / (p.a - 1)) : '∞'})`,
        };
      },
    },
    newton: {
      titre: "Newton-Raphson : calcul d'un TRI",
      explication: "On cherche le taux qui annule la VAN d'un investissement de 100 suivi de flux constants. Chaque itération de Newton suit la tangente jusqu'à l'axe : la convergence est très rapide.",
      params: [
        { id: 'F', label: 'Flux annuel', min: 15, max: 80, step: 1, value: 30 },
        { id: 'n', label: 'Nombre d\'années', min: 2, max: 15, step: 1, value: 5 },
        { id: 'i0', label: 'Point de départ i₀ (%)', min: 0, max: 40, step: 1, value: 5 },
      ],
      compute(p){
        const van = i => { let s = -100; for(let t = 1; t <= p.n; t++) s += p.F / Math.pow(1 + i, t); return s; };
        const dvan = i => { let s = 0; for(let t = 1; t <= p.n; t++) s -= t * p.F / Math.pow(1 + i, t + 1); return s; };
        let i = p.i0 / 100; const it = [i];
        for(let k = 0; k < 6; k++){ i = i - van(i) / dvan(i); it.push(i); }
        return {
          chart: { xlabel: 'Taux i', ylabel: 'VAN', xfmt: v => N.pct(v, 0),
            series: [{ name: 'VAN(i)', type: 'line', points: range(0, 0.6, 120).map(x => [x, van(x)]) }, { name: 'Itérés de Newton', type: 'scatter', points: it.filter(x => x >= 0 && x <= 0.6).map(x => [x, van(x)]), slot: 1 }],
            hlines: [{ y: 0 }] },
          calcul: it.slice(0, 5).map((x, k) => `i${k} = ${N.pct(x, 4)}   VAN = ${f4(van(x))}`),
          resultat: `TRI ≈ ${N.pct(i, 3)}`,
        };
      },
    },
    mcConvergence: {
      titre: "Convergence d'un estimateur Monte Carlo",
      explication: "Estimation du prix d'un call européen par simulation. L'estimation fluctue puis se stabilise ; la bande de confiance à 95 % se resserre en 1/√n. Les variables antithétiques réduisent nettement la largeur de la bande.",
      params: [
        { id: 's', label: 'Volatilité σ (%)', min: 5, max: 60, step: 1, value: 20 },
        { id: 'anti', label: 'Antithétique (0 = non, 1 = oui)', min: 0, max: 1, step: 1, value: 0 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const s = p.s / 100, r = 0.05, S0 = 100, K = 100, g = N.rng(p.seed * 2027), nmax = 20000;
        const pay = z => Math.exp(-r) * Math.max(S0 * Math.exp(r - s * s / 2 + s * z) - K, 0);
        let sum = 0, sum2 = 0; const est = [], lo = [], hi = [];
        for(let i = 1; i <= nmax; i++){
          const z = g.z(); const x = p.anti ? (pay(z) + pay(-z)) / 2 : pay(z);
          sum += x; sum2 += x * x;
          if(i % 200 === 0){ const m = sum / i, sd = Math.sqrt(Math.max(0, sum2 / i - m * m)); est.push([i, m]); lo.push([i, m - 1.96 * sd / Math.sqrt(i)]); hi.push([i, m + 1.96 * sd / Math.sqrt(i)]); }
        }
        const exact = bs(S0, K, r, s, 1).call, last = est[est.length - 1][1], half = hi[hi.length - 1][1] - last;
        return {
          chart: { xlabel: 'Nombre de simulations', ylabel: 'Prix estimé',
            series: [{ name: 'Estimation', type: 'line', points: est }, { name: 'Borne 95 %', type: 'line', points: hi, dash: true, slot: 1 }, { name: 'Borne 95 % ', type: 'line', points: lo, dash: true, slot: 1 }],
            hlines: [{ y: exact, label: 'Black-Scholes ' + f3(exact) }] },
          calcul: [`Payoff actualisé = e^(−rT)·max(S_T − K, 0)`, `n = ${nmax} : estimation ${f4(last)} ± ${f4(half)}`, `Erreur réelle = ${f4(last - exact)}`],
          resultat: `IC 95 % : [${f3(last - half)} ; ${f3(last + half)}] — prix exact ${f3(exact)}`,
        };
      },
    },
    varCharge: {
      titre: "Charge annuelle simulée : VaR et TVaR",
      explication: "Simulation de la charge totale d'un portefeuille (nombre de sinistres Poisson, coûts log-normaux). La VaR à 99,5 % correspond au capital de solvabilité ; la TVaR mesure la gravité moyenne au-delà.",
      params: [
        { id: 'l', label: 'Nombre moyen de sinistres λ', min: 5, max: 300, step: 5, value: 50 },
        { id: 'sig', label: 'Volatilité des coûts σ (log)', min: 0.2, max: 2, step: 0.1, value: 1 },
        { id: 'a', label: 'Niveau de la VaR (%)', min: 90, max: 99.9, step: 0.1, value: 99.5 },
      ],
      compute(p){
        const g = N.rng(4242), nsim = 4000, S = [];
        const pois = l => { if(l > 60){ return Math.max(0, Math.round(l + Math.sqrt(l) * g.z())); } let k = 0, pr = Math.exp(-l), F = pr; const u = g.u(); while(u > F){ k++; pr *= l / k; F += pr; } return k; };
        for(let i = 0; i < nsim; i++){ const n = pois(p.l); let s = 0; for(let j = 0; j < n; j++) s += Math.exp(12 + p.sig * g.z()); S.push(s / 1e6); }
        S.sort((a, b) => a - b);
        const mean = S.reduce((a, b) => a + b, 0) / nsim, v = quantile(S, p.a / 100), tail = S.filter(x => x >= v), tv = tail.reduce((a, b) => a + b, 0) / tail.length;
        const th = p.l * Math.exp(12 + p.sig * p.sig / 2) / 1e6;
        return {
          chart: { xlabel: 'Charge annuelle (M FCFA)', ylabel: 'Densité', series: [{ name: 'Charge simulée', type: 'bar', points: histo(S, 40, S[0], quantile(S, 0.999)) }],
            vlines: [{ x: mean, label: 'Moyenne' }, { x: v, label: 'VaR ' + f2(p.a) + ' %' }] },
          calcul: [`E[S] = λ·e^(μ+σ²/2) = ${f2(th)} M (simulé ${f2(mean)} M)`, `VaR ${f2(p.a)} % = quantile empirique = ${f2(v)} M`, `TVaR = moyenne des ${tail.length} scénarios ≥ VaR = ${f2(tv)} M`],
          resultat: `Capital au-delà de la moyenne : ${f2(v - mean)} M FCFA (${pct(v / mean - 1)} de la charge moyenne)`,
        };
      },
    },
    survie: {
      titre: "Loi de Weibull : survie et taux de hasard",
      explication: "Le paramètre de forme k détermine l'évolution du risque : k < 1, hasard décroissant (arrêt de travail, résiliation) ; k = 1, constant (exponentielle) ; k > 1, croissant (vieillissement).",
      params: [
        { id: 'k', label: 'Forme k', min: 0.3, max: 4, step: 0.05, value: 1.5 },
        { id: 'eta', label: 'Échelle η (années)', min: 1, max: 20, step: 0.5, value: 6 },
        { id: 't', label: 'Horizon t', min: 0.5, max: 20, step: 0.5, value: 3 },
      ],
      compute(p){
        const S = t => Math.exp(-Math.pow(t / p.eta, p.k)), h = t => p.k / p.eta * Math.pow(t / p.eta, p.k - 1);
        const ts = range(0.01, 3 * p.eta, 120);
        const mean = p.eta * Math.exp(N.logGamma(1 + 1 / p.k));
        return {
          chart: { xlabel: 'Durée t', ylabel: 'Probabilité de survie', ymax: 1, yfmt: v => N.pct(v, 0),
            series: [{ name: 'Weibull S(t)', type: 'line', points: ts.map(t => [t, S(t)]) }, { name: 'Exponentielle de même échelle', type: 'line', points: ts.map(t => [t, Math.exp(-t / p.eta)]), dash: true }],
            vlines: [{ x: p.t, label: 't = ' + f2(p.t) }] },
          calcul: [`S(t) = exp(−(t/η)ᵏ) = exp(−(${f2(p.t)}/${f2(p.eta)})^${f2(p.k)}) = ${f4(S(p.t))}`, `h(t) = (k/η)(t/η)^(k−1) = ${f4(h(p.t))}`, `Durée moyenne = η·Γ(1 + 1/k) = ${f2(mean)}`],
          resultat: `P(T > ${f2(p.t)}) = ${pct(S(p.t))} — hasard ${p.k > 1.001 ? 'croissant' : p.k < 0.999 ? 'décroissant' : 'constant'}`,
        };
      },
    },
    kaplanMeier: {
      titre: "Estimateur de Kaplan-Meier",
      explication: "Survie estimée sur un échantillon simulé de contrats avec censure (fin d'observation). Chaque marche correspond à un événement ; plus la censure est forte, moins il reste d'individus observés en fin de période.",
      params: [
        { id: 'n', label: 'Nombre de contrats', min: 10, max: 400, step: 10, value: 60 },
        { id: 'c', label: 'Durée d\'observation maximale', min: 1, max: 15, step: 0.5, value: 6 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 2 },
      ],
      compute(p){
        const g = N.rng(p.seed * 7), obs = [];
        for(let i = 0; i < p.n; i++){ const T = -4 * Math.log(1 - g.u()), C = g.u() * p.c; obs.push([Math.min(T, C), T <= C ? 1 : 0]); }
        obs.sort((a, b) => a[0] - b[0]);
        let S = 1, atRisk = p.n; const pts = [[0, 1]], lines = []; let ev = 0;
        for(let i = 0; i < obs.length;){
          const t = obs[i][0]; let d = 0, c = 0;
          while(i < obs.length && obs[i][0] === t){ obs[i][1] ? d++ : c++; i++; }
          if(d){ S *= 1 - d / atRisk; pts.push([t, S]); ev += d; if(lines.length < 3) lines.push(`t = ${f2(t)} : n = ${atRisk}, d = ${d} ⇒ Ŝ = ${f4(S)}`); }
          atRisk -= d + c;
        }
        pts.push([p.c, S]);
        return {
          chart: { xlabel: 'Durée (années)', ylabel: 'Survie estimée', ymax: 1, ymin: 0, yfmt: v => N.pct(v, 0),
            series: [{ name: 'Kaplan-Meier', type: 'step', points: pts }, { name: 'Vraie survie e^(−t/4)', type: 'line', points: range(0, p.c, 50).map(t => [t, Math.exp(-t / 4)]), dash: true }] },
          calcul: [`Ŝ(t) = Π (1 − dⱼ/nⱼ)`, ...lines, `${ev} événements observés, ${p.n - ev} censures`],
          resultat: `Ŝ(${f2(p.c)}) = ${pct(S)} (vraie valeur ${pct(Math.exp(-p.c / 4))})`,
        };
      },
    },
    payoffs: {
      titre: "Profils de gain des stratégies optionnelles",
      explication: "Gain net à maturité (primes Black-Scholes déduites) en fonction du prix final du sous-jacent. Le straddle parie sur une forte variation, le put protecteur plafonne la perte, le spread haussier limite gain et coût.",
      params: [
        { id: 'K', label: 'Prix d\'exercice K', min: 70, max: 130, step: 1, value: 100 },
        { id: 's', label: 'Volatilité σ (%)', min: 5, max: 60, step: 1, value: 20 },
      ],
      compute(p){
        const s = p.s / 100, r = 0.05, S0 = 100, K2 = p.K + 15;
        const c1 = bs(S0, p.K, r, s, 1), c2 = bs(S0, K2, r, s, 1);
        const ST = range(50, 150, 100);
        return {
          chart: { xlabel: 'Prix du sous-jacent à maturité S_T', ylabel: 'Gain net',
            series: [
              { name: 'Straddle', type: 'line', points: ST.map(x => [x, Math.max(x - p.K, 0) + Math.max(p.K - x, 0) - c1.call - c1.put]) },
              { name: 'Put protecteur', type: 'line', points: ST.map(x => [x, x + Math.max(p.K - x, 0) - S0 - c1.put]) },
              { name: `Spread haussier ${p.K}/${K2}`, type: 'line', points: ST.map(x => [x, Math.max(x - p.K, 0) - Math.max(x - K2, 0) - (c1.call - c2.call)]) },
            ], hlines: [{ y: 0 }] },
          calcul: [`Call(K = ${p.K}) = ${f3(c1.call)} ; Put(K = ${p.K}) = ${f3(c1.put)}`, `Parité : C − P = ${f3(c1.call - c1.put)} = S₀ − Ke^(−rT) = ${f3(S0 - p.K * Math.exp(-r))}`, `Straddle : points morts à ${f2(p.K - c1.call - c1.put)} et ${f2(p.K + c1.call + c1.put)}`],
          resultat: `Perte maximale du put protecteur : ${f2(S0 + c1.put - p.K)}`,
        };
      },
    },
    markowitz: {
      titre: "Frontière efficiente à deux actifs",
      explication: "Combinaisons de deux actifs risqués. Plus la corrélation est faible, plus la courbe se creuse vers la gauche : la diversification réduit le risque sans sacrifier la rentabilité.",
      params: [
        { id: 'rho', label: 'Corrélation ρ', min: -1, max: 1, step: 0.05, value: 0.2 },
        { id: 's1', label: 'Volatilité actif 1 (%)', min: 5, max: 40, step: 1, value: 20 },
        { id: 's2', label: 'Volatilité actif 2 (%)', min: 5, max: 60, step: 1, value: 30 },
      ],
      compute(p){
        const s1 = p.s1 / 100, s2 = p.s2 / 100, m1 = 0.08, m2 = 0.14, cov = p.rho * s1 * s2;
        const pts = range(0, 1, 60).map(w => { const v = w * w * s1 * s1 + (1 - w) ** 2 * s2 * s2 + 2 * w * (1 - w) * cov; return [Math.sqrt(Math.max(v, 0)), w * m1 + (1 - w) * m2]; });
        let w1 = (s2 * s2 - cov) / (s1 * s1 + s2 * s2 - 2 * cov); w1 = Math.max(0, Math.min(1, w1));
        const smin = Math.sqrt(Math.max(0, w1 * w1 * s1 * s1 + (1 - w1) ** 2 * s2 * s2 + 2 * w1 * (1 - w1) * cov));
        return {
          chart: { xlabel: 'Volatilité σ', ylabel: 'Rentabilité espérée', xmin: 0, xfmt: v => N.pct(v, 0), yfmt: v => N.pct(v, 1),
            series: [{ name: 'Portefeuilles', type: 'line', points: pts }, { name: 'Variance minimale', type: 'scatter', points: [[smin, w1 * m1 + (1 - w1) * m2]], slot: 1 }, { name: 'Actifs', type: 'scatter', points: [[s1, m1], [s2, m2]], slot: 2 }] },
          calcul: [`cov = ρσ₁σ₂ = ${f4(cov)}`, `w₁* = (σ₂² − cov)/(σ₁² + σ₂² − 2cov) = ${f3(w1)}`, `σ_min = ${pct(smin)}`],
          resultat: `Portefeuille de variance minimale : ${pct(w1)} actif 1, ${pct(1 - w1)} actif 2, σ = ${pct(smin)}`,
        };
      },
    },
    blackScholes: {
      titre: "Prix d'un call et delta (Black-Scholes)",
      explication: "Prix du call en fonction du cours du sous-jacent, comparé à sa valeur intrinsèque. L'écart est la valeur temps, maximale à la monnaie. La pente de la courbe est le delta, utilisé pour la couverture.",
      params: [
        { id: 'K', label: 'Prix d\'exercice K', min: 60, max: 140, step: 1, value: 100 },
        { id: 's', label: 'Volatilité σ (%)', min: 5, max: 80, step: 1, value: 20 },
        { id: 'T', label: 'Maturité T (années)', min: 0.05, max: 3, step: 0.05, value: 1 },
        { id: 'S', label: 'Cours actuel S', min: 50, max: 150, step: 1, value: 100 },
      ],
      compute(p){
        const r = 0.05, s = p.s / 100, xs = range(40, 160, 120), b = bs(p.S, p.K, r, s, p.T);
        const gamma = N.normPdf(b.d1) / (p.S * s * Math.sqrt(p.T));
        return {
          chart: { xlabel: 'Cours du sous-jacent S', ylabel: 'Prix du call',
            series: [{ name: 'Prix Black-Scholes', type: 'line', points: xs.map(x => [x, bs(x, p.K, r, s, p.T).call]) }, { name: 'Valeur intrinsèque', type: 'line', points: xs.map(x => [x, Math.max(x - p.K, 0)]), dash: true }, { name: 'Cours actuel', type: 'scatter', points: [[p.S, b.call]], slot: 2 }] },
          calcul: [`d₁ = [ln(S/K) + (r + σ²/2)T]/(σ√T) = ${f4(b.d1)}`, `d₂ = d₁ − σ√T = ${f4(b.d2)}`, `C = S·N(d₁) − K·e^(−rT)·N(d₂) = ${f2(p.S)} × ${f4(N.normCdf(b.d1))} − ${f2(p.K * Math.exp(-r * p.T))} × ${f4(N.normCdf(b.d2))}`, `Γ = ${f4(gamma)} ; Vega = ${f3(p.S * N.normPdf(b.d1) * Math.sqrt(p.T))}`],
          resultat: `Call = ${f3(b.call)} ; Δ = ${f3(N.normCdf(b.d1))} ; valeur temps = ${f3(b.call - Math.max(p.S - p.K, 0))}`,
        };
      },
    },
    kde: {
      titre: "Estimation de densité par noyau",
      explication: "Chaque observation porte une petite cloche gaussienne de largeur h. Une fenêtre trop petite donne une courbe hérissée (variance), une fenêtre trop grande efface la structure (biais). La règle de Silverman propose un compromis.",
      params: [
        { id: 'h', label: 'Fenêtre h', min: 0.05, max: 2, step: 0.05, value: 0.4 },
        { id: 'n', label: 'Taille de l\'échantillon', min: 20, max: 1000, step: 10, value: 200 },
      ],
      compute(p){
        const g = N.rng(555), x = [];
        for(let i = 0; i < p.n; i++) x.push(g.u() < 0.7 ? 11 + 0.6 * g.z() : 13.5 + 0.5 * g.z());
        const m = x.reduce((a, b) => a + b, 0) / p.n, sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (p.n - 1));
        const srt = x.slice().sort((a, b) => a - b), iqr = quantile(srt, 0.75) - quantile(srt, 0.25);
        const hs = 0.9 * Math.min(sd, iqr / 1.34) * Math.pow(p.n, -0.2);
        const kde = (t, h) => x.reduce((s, xi) => s + N.normPdf((t - xi) / h), 0) / (p.n * h);
        const ts = range(8.5, 16, 150);
        const vrai = t => 0.7 * N.normPdf(t, 11, 0.6) + 0.3 * N.normPdf(t, 13.5, 0.5);
        return {
          chart: { xlabel: 'Logarithme du coût du sinistre', ylabel: 'Densité',
            series: [{ name: 'Histogramme', type: 'bar', points: histo(x, 30, 8.5, 16) }, { name: 'Noyau (h choisi)', type: 'line', points: ts.map(t => [t, kde(t, p.h)]), slot: 1 }, { name: 'Vraie densité', type: 'line', points: ts.map(t => [t, vrai(t)]), dash: true, slot: 2 }] },
          calcul: [`f̂(x) = (1/nh) Σ φ((x − Xᵢ)/h), n = ${p.n}`, `σ̂ = ${f3(sd)}, IQR = ${f3(iqr)}`, `Silverman : h = 0,9·min(σ̂, IQR/1,34)·n^(−1/5) = ${f3(hs)}`],
          resultat: p.h < hs * 0.6 ? 'Fenêtre trop petite : courbe trop irrégulière' : p.h > hs * 1.8 ? 'Fenêtre trop grande : la bimodalité disparaît' : 'Fenêtre proche de l\'optimum de Silverman',
        };
      },
    },
    ksTest: {
      titre: "Fonction de répartition empirique et test de Kolmogorov-Smirnov",
      explication: "On compare la fonction de répartition empirique de durées simulées (Gamma) à une loi exponentielle de moyenne choisie. L'écart vertical maximal D est la statistique du test.",
      params: [
        { id: 'm', label: 'Moyenne de l\'exponentielle testée', min: 5, max: 40, step: 1, value: 20 },
        { id: 'n', label: 'Taille de l\'échantillon', min: 20, max: 500, step: 10, value: 100 },
      ],
      compute(p){
        const g = N.rng(808), x = [];
        for(let i = 0; i < p.n; i++){ x.push(-10.5 * Math.log((1 - g.u()) * (1 - g.u()))); } // Gamma(2, 10,5) : moyenne 21
        x.sort((a, b) => a - b);
        let D = 0, at = 0;
        x.forEach((v, i) => { const F = 1 - Math.exp(-v / p.m); const d = Math.max(Math.abs((i + 1) / p.n - F), Math.abs(F - i / p.n)); if(d > D){ D = d; at = v; } });
        const crit = 1.36 / Math.sqrt(p.n);
        const emp = [[0, 0]]; x.forEach((v, i) => emp.push([v, (i + 1) / p.n]));
        return {
          chart: { xlabel: 'Durée (jours)', ylabel: 'F(x)', ymax: 1, yfmt: v => N.pct(v, 0),
            series: [{ name: 'Répartition empirique Fₙ', type: 'step', points: emp }, { name: `Exponentielle (moyenne ${p.m})`, type: 'line', points: range(0, x[x.length - 1], 100).map(t => [t, 1 - Math.exp(-t / p.m)]), dash: true }],
            vlines: [{ x: at, label: 'D max' }] },
          calcul: [`D = sup |Fₙ(x) − F₀(x)| = ${f4(D)} (atteint en x ≈ ${f2(at)})`, `Valeur critique à 5 % ≈ 1,36/√n = ${f4(crit)}`],
          resultat: D > crit ? `D > ${f3(crit)} : on rejette l'adéquation à l'exponentielle` : `D ≤ ${f3(crit)} : on ne rejette pas l'adéquation`,
        };
      },
    },
    // ---------------- M2 ----------------
    acf: {
      titre: "Autocorrélations (ACF) d'un AR(1)",
      explication: "Pour un AR(1), l'autocorrélation théorique au retard h vaut φʰ : elle décroît géométriquement (ACF qui s'amortit, PACF coupée après 1). Les points montrent l'ACF estimée sur une série simulée ; hors de la bande ±1,96/√n, une autocorrélation est significative.",
      params: [
        { id: 'phi', label: 'Coefficient φ', min: -0.95, max: 0.95, step: 0.05, value: 0.7 },
        { id: 'n', label: 'Longueur de la série', min: 50, max: 1000, step: 50, value: 200 },
      ],
      compute(p){
        const g = N.rng(21), x = []; let v = 0;
        for(let t = 0; t < p.n + 50; t++){ v = p.phi * v + g.z(); if(t >= 50) x.push(v); }
        const m = x.reduce((a, b) => a + b, 0) / p.n, c0 = x.reduce((a, b) => a + (b - m) ** 2, 0);
        const acf = h => { let s = 0; for(let t = 0; t < p.n - h; t++) s += (x[t] - m) * (x[t + h] - m); return s / c0; };
        const hs = range(1, 15, 14), band = 1.96 / Math.sqrt(p.n);
        return {
          chart: { xlabel: 'Retard h', ylabel: 'ρ(h)', ymin: -1, ymax: 1, xfmt: v => String(Math.round(v)),
            series: [{ name: 'ACF théorique φʰ', type: 'bar', points: hs.map(h => [h, Math.pow(p.phi, h)]) }, { name: 'ACF estimée', type: 'scatter', points: hs.map(h => [h, acf(h)]), slot: 1 }],
            hlines: [{ y: band, label: '+1,96/√n' }, { y: -band, label: '−1,96/√n' }] },
          calcul: [`ρ(1) = φ = ${f3(p.phi)} (estimé ${f3(acf(1))})`, `ρ(5) = φ⁵ = ${f3(Math.pow(p.phi, 5))} (estimé ${f3(acf(5))})`, `Bande de significativité : ±1,96/√${p.n} = ±${f3(band)}`],
          resultat: `Dernier retard significatif (théorique) : h = ${hs.filter(h => Math.abs(Math.pow(p.phi, h)) > band).pop() || 0}`,
        };
      },
    },
    gev: {
      titre: "Loi des valeurs extrêmes généralisée (GEV)",
      explication: "Densité de la GEV standard selon l'indice de forme ξ, comparée à la loi de Gumbel (ξ = 0). Un ξ positif épaissit la queue droite : les maxima très élevés deviennent nettement plus probables.",
      params: [{ id: 'xi', label: 'Indice de forme ξ', min: -0.5, max: 0.8, step: 0.05, value: 0.3 }],
      compute(p){
        const xi = p.xi;
        const dens = (x, k) => {
          if(Math.abs(k) < 1e-6){ const t = Math.exp(-x); return t * Math.exp(-t); }
          const z = 1 + k * x; if(z <= 0) return 0;
          const t = Math.pow(z, -1 / k); return Math.pow(z, -1 / k - 1) * Math.exp(-t);
        };
        const cdf = (x, k) => Math.abs(k) < 1e-6 ? Math.exp(-Math.exp(-x)) : (1 + k * x <= 0 ? (k > 0 ? 0 : 1) : Math.exp(-Math.pow(1 + k * x, -1 / k)));
        const xs = range(-3, 8, 220);
        const q = pr => Math.abs(xi) < 1e-6 ? -Math.log(-Math.log(pr)) : (Math.pow(-Math.log(pr), -xi) - 1) / xi;
        return {
          chart: { xlabel: 'x (maximum normalisé)', ylabel: 'Densité',
            series: [{ name: `GEV ξ = ${f2(xi)}`, type: 'area', points: xs.map(x => [x, dens(x, xi)]) }, { name: 'Gumbel (ξ = 0)', type: 'line', points: xs.map(x => [x, dens(x, 0)]), dash: true }] },
          calcul: [`H(x) = exp[−(1 + ξx)^(−1/ξ)]`, `P(M > 5) = ${f4(1 - cdf(5, xi))} contre ${f4(1 - cdf(5, 0))} pour Gumbel`, `Niveau de retour 100 blocs (quantile 99 %) = ${f3(q(0.99))} contre ${f3(-Math.log(-Math.log(0.99)))} (Gumbel)`],
          resultat: xi > 0.02 ? 'Domaine de Fréchet : queue lourde (finance, assurance)' : xi < -0.02 ? `Domaine de Weibull : support borné (x ≤ ${f2(-1 / xi)})` : 'Domaine de Gumbel : queue exponentielle',
        };
      },
    },
    garch: {
      titre: "Volatilité conditionnelle GARCH(1,1)",
      explication: "σ²ₜ = ω + α·r²ₜ₋₁ + β·σ²ₜ₋₁. Après un choc, la volatilité monte puis revient vers son niveau de long terme √(ω/(1 − α − β)), d'autant plus lentement que α + β est proche de 1 (persistance) : c'est le regroupement de volatilité observé sur la BRVM.",
      params: [
        { id: 'a', label: 'α (réaction aux chocs)', min: 0.01, max: 0.3, step: 0.01, value: 0.08 },
        { id: 'b', label: 'β (persistance)', min: 0.5, max: 0.98, step: 0.01, value: 0.9 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const a = p.a, b = Math.min(p.b, 0.999 - a), lt = 0.0001, w = lt * (1 - a - b), g = N.rng(p.seed * 17);
        let s2 = lt; const vol = [];
        for(let t = 0; t < 500; t++){ const r = Math.sqrt(s2) * g.z(); vol.push([t, Math.sqrt(s2 * 252)]); s2 = w + a * r * r + b * s2; }
        const half = Math.log(0.5) / Math.log(a + b);
        return {
          chart: { xlabel: 'Jour', ylabel: 'Volatilité annualisée', yfmt: v => N.pct(v, 0),
            series: [{ name: 'σₜ (annualisée)', type: 'line', points: vol, width: 1.5 }], hlines: [{ y: Math.sqrt(lt * 252), label: 'Long terme' }] },
          calcul: [`ω = σ²_LT (1 − α − β) = ${w.toExponential(2)}`, `Persistance α + β = ${f3(a + b)}`, `Demi-vie d'un choc = ln(0,5)/ln(α + β) = ${f2(half)} jours`, `Volatilité de long terme = √(252·ω/(1 − α − β)) = ${pct(Math.sqrt(lt * 252))}`],
          resultat: `Un choc de volatilité se dissipe de moitié en ${f0(half)} jours`,
        };
      },
    },
    kupiec: {
      titre: "Backtesting de la VaR : test de Kupiec",
      explication: "Si la VaR à 99 % est bien calibrée, le nombre d'exceptions sur 250 jours suit une loi binomiale B(250 ; 1 %). Le test de Kupiec compare le nombre observé à cette loi ; le « feu tricolore » de Bâle classe le modèle en zone verte, orange ou rouge.",
      params: [
        { id: 'x', label: 'Exceptions observées', min: 0, max: 20, step: 1, value: 6 },
        { id: 'c', label: 'Niveau de la VaR (%)', min: 95, max: 99.5, step: 0.5, value: 99 },
      ],
      compute(p){
        const T = 250, q = 1 - p.c / 100, x = p.x;
        const ks = range(0, 20, 20);
        const ll = (k, pr) => (T - k) * Math.log(1 - pr) + (k > 0 ? k * Math.log(pr) : 0);
        const phat = x / T, lr = -2 * (ll(x, q) - (x === 0 ? T * Math.log(1) : ll(x, phat)));
        let cum = 0; for(let k = 0; k < x; k++) cum += N.binomPmf(k, T, q);
        const zone = p.c === 99 ? (x <= 4 ? 'verte' : x <= 9 ? 'orange' : 'rouge') : null;
        return {
          chart: { xlabel: 'Nombre d\'exceptions sur 250 jours', ylabel: 'Probabilité', xfmt: v => String(Math.round(v)),
            series: [{ name: `Binomiale(250 ; ${f3(q)})`, type: 'bar', points: ks.map(k => [k, N.binomPmf(k, T, q)]) }], vlines: [{ x, label: 'Observé' }] },
          calcul: [`Attendu : 250 × ${f3(q)} = ${f2(T * q)} exceptions`, `LR_uc = −2 ln[(1−p)^{T−x} pˣ] + 2 ln[(1−x/T)^{T−x} (x/T)ˣ] = ${f3(lr)}`, `Seuil χ²(1) à 5 % = 3,841 ; P(X ≥ ${x}) = ${pct(1 - cum)}`],
          resultat: (lr > 3.841 ? 'Modèle rejeté (LR > 3,84)' : 'Modèle non rejeté (LR ≤ 3,84)') + (zone ? ` — zone ${zone} du feu tricolore de Bâle` : ''),
        };
      },
    },
    copule: {
      titre: "Copule gaussienne ou copule de Clayton ?",
      explication: "Deux copules de même corrélation de rang (tau de Kendall). La copule de Clayton concentre les points dans le coin inférieur gauche : les pertes extrêmes arrivent ensemble (dépendance de queue), ce que la copule gaussienne ignore — la diversification y est surestimée.",
      params: [
        { id: 'tau', label: 'Tau de Kendall τ', min: 0.05, max: 0.85, step: 0.05, value: 0.5 },
        { id: 'type', label: 'Copule : 0 = gaussienne, 1 = Clayton', min: 0, max: 1, step: 1, value: 1 },
      ],
      compute(p){
        const g = N.rng(77), n = 700, pts = [], th = 2 * p.tau / (1 - p.tau), rho = Math.sin(Math.PI * p.tau / 2);
        for(let i = 0; i < n; i++){
          if(p.type){ const u = g.u(), w = g.u(); const v = Math.pow(Math.pow(u, -th) * (Math.pow(w, -th / (1 + th)) - 1) + 1, -1 / th); pts.push([u, v]); }
          else { const z1 = g.z(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * g.z(); pts.push([N.normCdf(z1), N.normCdf(z2)]); }
        }
        const both = pts.filter(q => q[0] < 0.05 && q[1] < 0.05).length;
        const lambda = p.type ? Math.pow(2, -1 / th) : 0;
        return {
          chart: { xlabel: 'U₁ (rang de la perte 1)', ylabel: 'U₂', xmin: 0, xmax: 1, ymin: 0, ymax: 1,
            series: [{ name: p.type ? 'Clayton' : 'Gaussienne', type: 'scatter', points: pts, r: 2.2, slot: p.type ? 1 : 0 }] },
          calcul: [p.type ? `Clayton : θ = 2τ/(1 − τ) = ${f3(th)}` : `Gaussienne : ρ = sin(πτ/2) = ${f3(rho)}`, `Dépendance de queue inférieure λ_L = ${p.type ? '2^(−1/θ) = ' + f3(lambda) : '0'}`, `Points dans le coin 5 % × 5 % : ${both} (indépendance : ${f2(n * 0.0025)})`],
          resultat: p.type ? `Clayton : ${pct(lambda)} de chances que le risque 2 soit extrême quand le risque 1 l'est` : 'Gaussienne : pas de dépendance de queue',
        };
      },
    },
    duration: {
      titre: "Immunisation actif-passif (ALM)",
      explication: "Valeur de l'actif, du passif et de la situation nette (actif − passif) selon la variation des taux. Quand la duration de l'actif est inférieure à celle du passif, une baisse des taux dégrade la situation nette ; l'immunisation consiste à rapprocher les deux durations (pondérées par les valeurs).",
      params: [
        { id: 'da', label: 'Duration de l\'actif (ans)', min: 1, max: 15, step: 0.2, value: 5.2 },
        { id: 'dl', label: 'Duration du passif (ans)', min: 1, max: 15, step: 0.2, value: 7.8 },
      ],
      compute(p){
        const A0 = 800, L0 = 750, y0 = 0.05;
        const val = (V0, D, dy) => V0 * Math.pow((1 + y0) / (1 + y0 + dy), D);
        const dys = range(-0.03, 0.03, 60);
        const gap = p.da - (L0 / A0) * p.dl;
        return {
          chart: { xlabel: 'Variation des taux', ylabel: 'Situation nette (Mds FCFA)', xfmt: v => N.pct(v, 1),
            series: [{ name: 'Actif − passif', type: 'line', points: dys.map(d => [d, val(A0, p.da, d) - val(L0, p.dl, d)]) }], hlines: [{ y: A0 - L0, label: 'Aujourd\'hui' }, { y: 0 }] },
          calcul: [`Gap de duration = D_A − (L/A)·D_L = ${f2(p.da)} − (750/800) × ${f2(p.dl)} = ${f3(gap)}`, `ΔSN ≈ −A·gap·Δy/(1+y) : pour Δy = −1 %, ΔSN ≈ ${f2(A0 * gap * 0.01 / 1.05)}`, `Situation nette si −2 % : ${f2(val(A0, p.da, -0.02) - val(L0, p.dl, -0.02))} ; si +2 % : ${f2(val(A0, p.da, 0.02) - val(L0, p.dl, 0.02))}`],
          resultat: Math.abs(gap) < 0.3 ? 'Bilan quasi immunisé contre les petits mouvements de taux' : gap < 0 ? 'Gap négatif : exposé à une BAISSE des taux' : 'Gap positif : exposé à une HAUSSE des taux',
        };
      },
    },
    euler: {
      titre: "Allocation du capital : méthode d'Euler",
      explication: "Deux lignes d'activité aux pertes gaussiennes. Le capital global (VaR 99,5 %) est inférieur à la somme des capitaux isolés ; la méthode d'Euler répartit ce capital diversifié selon la contribution marginale de chaque ligne — la somme des contributions retombe exactement sur le total.",
      params: [
        { id: 's1', label: 'Écart-type ligne 1 (Mds)', min: 5, max: 60, step: 1, value: 30 },
        { id: 's2', label: 'Écart-type ligne 2 (Mds)', min: 5, max: 60, step: 1, value: 20 },
        { id: 'rho', label: 'Corrélation ρ', min: -0.5, max: 1, step: 0.05, value: 0.3 },
      ],
      compute(p){
        const z = 2.576, sp = Math.sqrt(p.s1 ** 2 + p.s2 ** 2 + 2 * p.rho * p.s1 * p.s2);
        const e1 = z * p.s1 * (p.s1 + p.rho * p.s2) / sp, e2 = z * p.s2 * (p.s2 + p.rho * p.s1) / sp;
        return {
          chart: { xlabel: 'Ligne d\'activité', ylabel: 'Capital (Mds FCFA)', xticks: [1, 2], xfmt: v => 'Ligne ' + Math.round(v),
            series: [{ name: 'Capital isolé', type: 'bar', points: [[1, z * p.s1], [2, z * p.s2]] }, { name: 'Contribution d\'Euler', type: 'bar', points: [[1, e1], [2, e2]] }] },
          calcul: [`Capital global = z·σ_p = 2,576 × ${f2(sp)} = ${f2(z * sp)}`, `Euler ligne 1 = z·σ₁(σ₁ + ρσ₂)/σ_p = ${f2(e1)}`, `Euler ligne 2 = z·σ₂(σ₂ + ρσ₁)/σ_p = ${f2(e2)}`, `Somme = ${f2(e1 + e2)} = capital global ✓`],
          resultat: `Bénéfice de diversification : ${f2(z * (p.s1 + p.s2) - z * sp)} Mds (${pct(1 - sp / (p.s1 + p.s2))})`,
        };
      },
    },
    primeTemp: {
      titre: "Prime d'une temporaire décès selon l'âge",
      explication: "Prime annuelle pure d'une assurance temporaire décès (capital 10 M FCFA), calculée avec une loi de mortalité de Gompertz-Makeham et le principe d'équivalence. La prime croît presque exponentiellement avec l'âge à la souscription ; un taux technique plus élevé la réduit.",
      params: [
        { id: 'n', label: 'Durée du contrat (ans)', min: 1, max: 30, step: 1, value: 10 },
        { id: 'i', label: 'Taux technique (%)', min: 0, max: 6, step: 0.25, value: 3.5 },
        { id: 'x', label: 'Âge à la souscription', min: 20, max: 65, step: 1, value: 40 },
      ],
      compute(p){
        const A = 0.0005, B = 3e-5, c = 1.1, v = 1 / (1 + p.i / 100), C = 1e7;
        const q = x => 1 - Math.exp(-(A + B / Math.log(c) * (Math.pow(c, x + 1) - Math.pow(c, x))));
        const prime = x => { let kp = 1, Ad = 0, a = 0; for(let k = 0; k < p.n; k++){ a += Math.pow(v, k) * kp; Ad += Math.pow(v, k + 1) * kp * q(x + k); kp *= 1 - q(x + k); } return { P: C * Ad / a, Ad, a }; };
        const r = prime(p.x);
        return {
          chart: { xlabel: 'Âge à la souscription', ylabel: 'Prime annuelle (FCFA)', xfmt: v => String(Math.round(v)),
            series: [{ name: 'Prime pure annuelle', type: 'line', points: range(20, 65, 45).map(x => [x, prime(x).P]) }, { name: 'Âge choisi', type: 'scatter', points: [[p.x, r.P]], slot: 1 }] },
          calcul: [`q₍${p.x}₎ = ${f4(q(p.x))}`, `A¹ₓ:ₙ = Σ v^(k+1)·ₖpₓ·qₓ₊ₖ = ${f4(r.Ad)}`, `äₓ:ₙ = Σ vᵏ·ₖpₓ = ${f4(r.a)}`, `P = C·A¹ₓ:ₙ / äₓ:ₙ`],
          resultat: `Prime annuelle pure ≈ ${N.fcfa(r.P)} (prime unique ${N.fcfa(C * r.Ad)})`,
        };
      },
    },
    bfcl: {
      titre: "Chain Ladder ou Bornhuetter-Ferguson ?",
      explication: "Charge ultime estimée pour une année de survenance récente selon le degré de développement (facteur cumulé restant). Chain Ladder multiplie le payé ; Bornhuetter-Ferguson ajoute au payé la part non encore développée de l'ultime a priori. Plus l'année est jeune (facteur élevé), plus Chain Ladder devient instable.",
      params: [
        { id: 'paye', label: 'Payé observé (M FCFA)', min: 10, max: 500, step: 10, value: 150 },
        { id: 'apriori', label: 'Ultime a priori (M FCFA)', min: 100, max: 2000, step: 50, value: 800 },
        { id: 'f', label: 'Facteur cumulé restant', min: 1, max: 8, step: 0.1, value: 4 },
      ],
      compute(p){
        const fs = range(1, 8, 70);
        const cl = f => p.paye * f, bf = f => p.paye + (1 - 1 / f) * p.apriori;
        return {
          chart: { xlabel: 'Facteur cumulé restant (année plus récente →)', ylabel: 'Ultime (M FCFA)',
            series: [{ name: 'Chain Ladder', type: 'line', points: fs.map(f => [f, cl(f)]) }, { name: 'Bornhuetter-Ferguson', type: 'line', points: fs.map(f => [f, bf(f)]) }],
            vlines: [{ x: p.f, label: 'f = ' + f2(p.f) }], hlines: [{ y: p.apriori, label: 'A priori' }] },
          calcul: [`% développé = 1/f = ${pct(1 / p.f)}`, `Chain Ladder = ${p.paye} × ${f2(p.f)} = ${f2(cl(p.f))}`, `BF = ${p.paye} + (1 − 1/${f2(p.f)}) × ${p.apriori} = ${f2(bf(p.f))}`],
          resultat: `Écart CL − BF = ${f2(cl(p.f) - bf(p.f))} M FCFA ; provision BF = ${f2(bf(p.f) - p.paye)} M`,
        };
      },
    },
    ruinePaths: {
      titre: "Trajectoires de réserve (Cramér-Lundberg)",
      explication: "Simulation de la réserve U(t) = u + ct − S(t) avec sinistres exponentiels. Les primes font monter la réserve en continu, chaque sinistre la fait chuter. La proportion de trajectoires qui passent sous zéro estime la probabilité de ruine, comparée à la formule exacte.",
      params: [
        { id: 'u', label: 'Réserve initiale u (M)', min: 0, max: 40, step: 1, value: 10 },
        { id: 'theta', label: 'Chargement θ (%)', min: 1, max: 50, step: 1, value: 15 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const g = N.rng(p.seed * 101), mu = 2, lam = 1, th = p.theta / 100, c = (1 + th) * lam * mu, T = 60;
        const series = []; let ruined = 0; const nsim = 400;
        for(let s = 0; s < nsim; s++){
          let t = 0, U = p.u, dead = false; const pts = [[0, U]];
          while(true){
            const e = -Math.log(1 - g.u()) / lam;
            if(t + e > T){ pts.push([T, U + c * (T - t)]); break; }
            t += e; U += c * e; pts.push([t, U]);
            U -= -mu * Math.log(1 - g.u()); pts.push([t, U]);
            if(U < 0){ dead = true; break; }
          }
          if(dead) ruined++;
          if(s < 6) series.push({ name: 'Trajectoire ' + (s + 1), type: 'line', points: pts, width: 1.3 });
        }
        const R = th / ((1 + th) * mu), psi = Math.exp(-R * p.u) / (1 + th);
        return {
          chart: { xlabel: 'Temps', ylabel: 'Réserve U(t)', series, hlines: [{ y: 0, label: 'Ruine' }] },
          calcul: [`c = (1 + θ)λμ = ${f3(c)} par unité de temps`, `R = θ/((1 + θ)μ) = ${f4(R)}`, `ψ(u) exacte = e^(−Ru)/(1 + θ) = ${pct(psi)}`, `Simulation (horizon ${T}) : ${ruined}/${nsim} ruinées = ${pct(ruined / nsim)}`],
          resultat: `Probabilité de ruine ≈ ${pct(psi)} (borne de Lundberg ${pct(Math.exp(-R * p.u))})`,
        };
      },
    },
    irb: {
      titre: "Bâle II IRB : exigence de fonds propres selon la PD",
      explication: "Formule réglementaire de l'approche IRB (modèle à un facteur de Vasicek, quantile 99,9 %) pour une exposition sur entreprise. L'exigence K croît avec la probabilité de défaut (PD), mais de façon concave : la corrélation réglementaire diminue quand la PD augmente.",
      params: [
        { id: 'lgd', label: 'LGD (%)', min: 10, max: 90, step: 5, value: 45 },
        { id: 'm', label: 'Maturité effective M (ans)', min: 1, max: 5, step: 0.5, value: 2.5 },
        { id: 'pd', label: 'PD de l\'emprunteur (%)', min: 0.03, max: 20, step: 0.01, value: 1 },
      ],
      compute(p){
        const K = pd => {
          const e = (1 - Math.exp(-50 * pd)) / (1 - Math.exp(-50));
          const rho = 0.12 * e + 0.24 * (1 - e), b = Math.pow(0.11852 - 0.05478 * Math.log(pd), 2);
          const k = (p.lgd / 100) * (N.normCdf((N.normInv(pd) + Math.sqrt(rho) * N.normInv(0.999)) / Math.sqrt(1 - rho)) - pd) * (1 + (p.m - 2.5) * b) / (1 - 1.5 * b);
          return { k: Math.max(k, 0), rho };
        };
        const r = K(p.pd / 100);
        return {
          chart: { xlabel: 'Probabilité de défaut (PD)', ylabel: 'Exigence K (% de l\'EAD)', xfmt: v => N.pct(v, 0), yfmt: v => N.pct(v, 0),
            series: [{ name: 'K(PD)', type: 'line', points: range(0.0005, 0.2, 120).map(pd => [pd, K(pd).k]) }, { name: 'PD choisie', type: 'scatter', points: [[p.pd / 100, r.k]], slot: 1 }] },
          calcul: [`Corrélation réglementaire ρ = ${f4(r.rho)}`, `K = LGD·[N((N⁻¹(PD) + √ρ·N⁻¹(0,999))/√(1 − ρ)) − PD] × ajustement de maturité = ${pct2(r.k)}`, `RWA = 12,5 × K × EAD = ${f2(12.5 * r.k * 100)} % de l'EAD`],
          resultat: `Fonds propres pour 1 Md FCFA d'exposition : ${f2(r.k * 1000)} M FCFA (pondération ${pct(12.5 * r.k)})`,
        };
      },
    },
    ar1: {
      titre: "Processus AR(1) et autocorrélations",
      explication: "Xₜ = φXₜ₋₁ + εₜ. Si |φ| < 1 la série est stationnaire et ses autocorrélations décroissent géométriquement (φᵏ) ; quand φ → 1 on se rapproche d'une marche aléatoire (racine unitaire, ADF non rejeté).",
      params: [
        { id: 'phi', label: 'Coefficient φ', min: -0.95, max: 1, step: 0.05, value: 0.7 },
        { id: 'seed', label: 'Tirage n°', min: 1, max: 50, step: 1, value: 1 },
      ],
      compute(p){
        const g = N.rng(p.seed * 11), n = 200; let x = 0; const pts = [];
        for(let t = 0; t < n; t++){ x = p.phi * x + g.z(); pts.push([t, x]); }
        return {
          chart: { xlabel: 'Temps', ylabel: 'Xₜ', series: [{ name: 'AR(1) simulé', type: 'line', points: pts, width: 1.5 }] },
          calcul: [`Autocorrélations théoriques ρ(k) = φᵏ : ρ(1) = ${f3(p.phi)}, ρ(2) = ${f3(p.phi ** 2)}, ρ(5) = ${f3(p.phi ** 5)}`, Math.abs(p.phi) < 1 ? `Variance stationnaire = σ²/(1 − φ²) = ${f3(1 / (1 - p.phi ** 2))}` : 'φ = 1 : marche aléatoire, variance croissante avec t'],
          resultat: Math.abs(p.phi) < 1 ? 'Série stationnaire (retour vers 0)' : 'Racine unitaire : différencier la série (d = 1)',
        };
      },
    },
    gpd: {
      titre: "Queues de distribution : GPD selon ξ",
      explication: "Probabilité de dépasser un montant au-delà du seuil, pour une loi de Pareto généralisée. ξ > 0 : queue lourde (Fréchet), ξ = 0 : exponentielle (Gumbel), ξ < 0 : support borné (Weibull).",
      params: [
        { id: 'xi', label: 'Paramètre de forme ξ', min: -0.5, max: 1, step: 0.05, value: 0.3 },
        { id: 'sig', label: 'Échelle σ', min: 0.5, max: 5, step: 0.1, value: 1 },
      ],
      compute(p){
        const surv = y => Math.abs(p.xi) < 1e-6 ? Math.exp(-y / p.sig) : Math.max(0, Math.pow(Math.max(0, 1 + p.xi * y / p.sig), -1 / p.xi));
        const ys = range(0, 10, 120);
        return {
          chart: { xlabel: 'Excès au-dessus du seuil', ylabel: 'P(excès > y)', ymax: 1, yfmt: v => N.pct(v, 0),
            series: [{ name: `GPD ξ = ${f2(p.xi)}`, type: 'line', points: ys.map(y => [y, surv(y)]) }, { name: 'Exponentielle (ξ = 0)', type: 'line', points: ys.map(y => [y, Math.exp(-y / p.sig)]), dash: true }] },
          calcul: [`P(Y > y) = (1 + ξy/σ)^(−1/ξ)`, `P(Y > 5) = ${f4(surv(5))} contre ${f4(Math.exp(-5 / p.sig))} pour l'exponentielle`, p.xi < 0 ? `Borne supérieure : y_max = −σ/ξ = ${f2(-p.sig / p.xi)}` : p.xi >= 1 ? 'ξ ≥ 1 : espérance infinie' : `Espérance des excès = σ/(1 − ξ) = ${f3(p.sig / (1 - p.xi))}`],
          resultat: p.xi > 0.02 ? 'Domaine de Fréchet (queue lourde)' : p.xi < -0.02 ? 'Domaine de Weibull (support borné)' : 'Domaine de Gumbel',
        };
      },
    },
    varNormale: {
      titre: "VaR paramétrique et Expected Shortfall",
      explication: "Distribution normale du P&L d'un portefeuille. La VaR est le quantile de perte ; l'Expected Shortfall est la perte moyenne dans la zone au-delà.",
      params: [
        { id: 'V', label: 'Valeur du portefeuille (M FCFA)', min: 100, max: 5000, step: 100, value: 1000 },
        { id: 'vol', label: 'Volatilité journalière (%)', min: 0.2, max: 5, step: 0.1, value: 1.5 },
        { id: 'a', label: 'Confiance (%)', min: 90, max: 99.9, step: 0.1, value: 99 },
        { id: 'h', label: 'Horizon (jours)', min: 1, max: 20, step: 1, value: 1 },
      ],
      compute(p){
        const s = p.V * p.vol / 100 * Math.sqrt(p.h), z = N.normInv(p.a / 100), v = s * z, es = s * N.normPdf(z) / (1 - p.a / 100);
        const xs = range(-4 * s, 4 * s, 160);
        return {
          chart: { xlabel: 'Perte (M FCFA)', ylabel: 'Densité', series: [{ name: 'Distribution des pertes', type: 'area', points: xs.map(x => [x, N.normPdf(x, 0, s)]) }], vlines: [{ x: v, label: 'VaR' }, { x: es, label: 'ES' }] },
          calcul: [`σ(h) = V·σ_j·√h = ${f2(s)} M`, `z(${f2(p.a)} %) = ${f3(z)}`, `VaR = σ(h)·z = ${f2(v)} M`, `ES = σ(h)·φ(z)/(1 − α) = ${f2(es)} M`],
          resultat: `VaR = ${f2(v)} M FCFA ; ES = ${f2(es)} M FCFA`,
        };
      },
    },
    agregation: {
      titre: "Agrégation de deux SCR et diversification",
      explication: "Le capital agrégé √(S₁² + S₂² + 2ρS₁S₂) est inférieur à la somme simple dès que ρ < 1. Le bénéfice de diversification est d'autant plus fort que la corrélation est faible.",
      params: [
        { id: 's1', label: 'SCR module 1', min: 10, max: 200, step: 5, value: 60 },
        { id: 's2', label: 'SCR module 2', min: 10, max: 200, step: 5, value: 40 },
        { id: 'rho', label: 'Corrélation ρ', min: -1, max: 1, step: 0.05, value: 0.25 },
      ],
      compute(p){
        const ag = r => Math.sqrt(Math.max(0, p.s1 ** 2 + p.s2 ** 2 + 2 * r * p.s1 * p.s2)), a = ag(p.rho);
        return {
          chart: { xlabel: 'Corrélation ρ', ylabel: 'Capital', xfmt: v => f2(v),
            series: [{ name: 'SCR agrégé', type: 'line', points: range(-1, 1, 80).map(r => [r, ag(r)]) }, { name: 'Somme simple', type: 'line', points: [[-1, p.s1 + p.s2], [1, p.s1 + p.s2]], dash: true }],
            vlines: [{ x: p.rho, label: 'ρ = ' + f2(p.rho) }] },
          calcul: [`SCR = √(${p.s1}² + ${p.s2}² + 2×${f2(p.rho)}×${p.s1}×${p.s2}) = ${f2(a)}`, `Bénéfice = ${p.s1 + p.s2} − ${f2(a)} = ${f2(p.s1 + p.s2 - a)}`],
          resultat: `Diversification : ${pct((p.s1 + p.s2 - a) / (p.s1 + p.s2))} de la somme simple`,
        };
      },
    },
    raroc: {
      titre: "RAROC et création de valeur",
      explication: "Le RAROC rapporte le résultat ajusté du risque au capital économique alloué. Une activité crée de la valeur si son RAROC dépasse le taux de rendement exigé (hurdle rate).",
      params: [
        { id: 'res', label: 'Résultat attendu', min: 0, max: 40, step: 1, value: 15 },
        { id: 'el', label: 'Pertes attendues', min: 0, max: 20, step: 0.5, value: 4 },
        { id: 'hr', label: 'Hurdle rate (%)', min: 5, max: 25, step: 0.5, value: 15 },
      ],
      compute(p){
        const caps = range(10, 150, 70), hr = p.hr / 100;
        return {
          chart: { xlabel: 'Capital alloué', ylabel: 'RAROC', yfmt: v => N.pct(v, 0), series: [{ name: 'RAROC', type: 'line', points: caps.map(c => [c, (p.res - p.el) / c]) }], hlines: [{ y: hr, label: 'Hurdle rate' }] },
          calcul: [`RAROC = (Résultat − Pertes attendues)/Capital = ${f2(p.res - p.el)}/Capital`, `Capital maximal pour créer de la valeur = ${f2(p.res - p.el)}/${f3(hr)} = ${f2((p.res - p.el) / hr)}`, `EVA (capital 60) = ${f2(p.res - p.el - hr * 60)}`],
          resultat: `L'activité crée de la valeur tant que le capital alloué < ${f2((p.res - p.el) / hr)}`,
        };
      },
    },
    mortalite: {
      titre: "Loi de Gompertz-Makeham : mortalité et survie",
      explication: "La force de mortalité μₓ = A + B·cˣ croît exponentiellement avec l'âge. On en déduit la courbe de survie ₜpₓ utilisée pour calculer primes et provisions en assurance vie.",
      params: [
        { id: 'B', label: 'B (×10⁻⁵)', min: 0.5, max: 10, step: 0.5, value: 3 },
        { id: 'c', label: 'c', min: 1.05, max: 1.14, step: 0.005, value: 1.1 },
        { id: 'x', label: 'Âge de l\'assuré', min: 20, max: 80, step: 1, value: 40 },
      ],
      compute(p){
        const A = 0.0005, B = p.B * 1e-5, lc = Math.log(p.c);
        const H = (x, t) => A * t + B / lc * (Math.pow(p.c, x + t) - Math.pow(p.c, x));
        const ts = range(0, 110 - p.x, 110 - p.x);
        const e = ts.reduce((s, t) => s + Math.exp(-H(p.x, t)), 0) - 0.5;
        return {
          chart: { xlabel: 'Âge', ylabel: 'Probabilité de survie', ymax: 1, yfmt: v => N.pct(v, 0), xfmt: v => String(Math.round(v)),
            series: [{ name: `ₜp₍${p.x}₎`, type: 'area', points: ts.map(t => [p.x + t, Math.exp(-H(p.x, t))]) }] },
          calcul: [`μ₍${p.x}₎ = A + B·c^x = ${f4(A + B * Math.pow(p.c, p.x))}`, `q₍${p.x}₎ ≈ 1 − exp(−∫μ) = ${f4(1 - Math.exp(-H(p.x, 1)))}`, `₁₀p₍${p.x}₎ = ${f4(Math.exp(-H(p.x, 10)))}`],
          resultat: `Espérance de vie résiduelle à ${p.x} ans ≈ ${f2(e)} ans`,
        };
      },
    },
    chainLadder: {
      titre: "Cadence de développement (Chain Ladder)",
      explication: "Les facteurs de développement projettent les montants payés vers la charge ultime. La cadence cumulée indique la part de la charge ultime déjà payée à chaque âge ; la provision est la part restante.",
      params: [
        { id: 'f1', label: 'Facteur f₁ (1→2)', min: 1.05, max: 3, step: 0.05, value: 1.8 },
        { id: 'decay', label: 'Décroissance des facteurs', min: 0.2, max: 0.8, step: 0.05, value: 0.45 },
        { id: 'paye', label: 'Payé cumulé année 1 (M)', min: 10, max: 500, step: 10, value: 100 },
      ],
      compute(p){
        const f = []; for(let j = 0; j < 6; j++) f.push(1 + (p.f1 - 1) * Math.pow(p.decay, j));
        const cum = []; let prod = 1; for(let j = f.length - 1; j >= 0; j--){ prod *= f[j]; cum[j] = prod; }
        const pattern = [1 / cum[0]]; let c = pattern[0]; for(let j = 0; j < f.length; j++){ c *= f[j]; pattern.push(c); }
        return {
          chart: { xlabel: 'Année de développement', ylabel: '% de la charge ultime', ymax: 1, yfmt: v => N.pct(v, 0), xfmt: v => String(Math.round(v)),
            series: [{ name: 'Cadence cumulée', type: 'bar', points: pattern.map((v, j) => [j + 1, Math.min(v, 1)]) }] },
          calcul: [`Facteurs : ${f.map(f3).join(' ; ')}`, `Facteur cumulé f₁→ult = Π fⱼ = ${f3(cum[0])}`, `Charge ultime = ${p.paye} × ${f3(cum[0])} = ${f2(p.paye * cum[0])} M`],
          resultat: `Provision (IBNR + IBNER) = ${f2(p.paye * (cum[0] - 1))} M`,
        };
      },
    },
    credibilite: {
      titre: "Facteur de crédibilité de Bühlmann",
      explication: "Z = n/(n + k) pondère l'expérience individuelle face à l'expérience collective. Plus k est grand (variance intra-risque forte relativement à la variance inter-risques), plus il faut d'années pour être crédible.",
      params: [
        { id: 'k', label: 'k = σ²/τ²', min: 1, max: 500, step: 1, value: 200 },
        { id: 'n', label: 'Années d\'exposition n', min: 1, max: 500, step: 1, value: 50 },
      ],
      compute(p){
        const Z = p.n / (p.n + p.k);
        return {
          chart: { xlabel: 'n', ylabel: 'Z', ymax: 1, ymin: 0, yfmt: v => N.pct(v, 0), series: [{ name: 'Z = n/(n + k)', type: 'line', points: range(0, 500, 100).map(n => [n, n / (n + p.k)]) }], vlines: [{ x: p.n, label: 'n choisi' }], hlines: [{ y: 0.5, label: '50 %' }] },
          calcul: [`Z = ${p.n}/(${p.n} + ${p.k}) = ${f4(Z)}`, `Prime = Z × individuel + (1 − Z) × collectif`, `n pour Z = 50 % : n = k = ${p.k}`],
          resultat: `Crédibilité individuelle : ${pct(Z)}`,
        };
      },
    },
    lundberg: {
      titre: "Borne de Lundberg : ruine et réserve initiale",
      explication: "Dans le modèle de Cramér-Lundberg avec sinistres exponentiels, la probabilité de ruine est ψ(u) = (1/(1+θ))·e^(−Ru). La réserve initiale et le chargement de sécurité θ la font chuter exponentiellement.",
      params: [
        { id: 'theta', label: 'Chargement de sécurité θ (%)', min: 1, max: 60, step: 1, value: 20 },
        { id: 'm', label: 'Coût moyen d\'un sinistre (M)', min: 0.5, max: 10, step: 0.5, value: 2 },
      ],
      compute(p){
        const th = p.theta / 100, R = th / ((1 + th) * p.m);
        const us = range(0, 60, 120);
        return {
          chart: { xlabel: 'Réserve initiale u (M FCFA)', ylabel: 'Probabilité de ruine', ymax: 1, yfmt: v => N.pct(v, 0),
            series: [{ name: 'ψ(u) exacte', type: 'line', points: us.map(u => [u, Math.exp(-R * u) / (1 + th)]) }, { name: 'Borne e^(−Ru)', type: 'line', points: us.map(u => [u, Math.exp(-R * u)]), dash: true }] },
          calcul: [`Coefficient d'ajustement R = θ/((1+θ)·μ) = ${f4(R)}`, `ψ(20) = ${f4(Math.exp(-R * 20) / (1 + th))}`, `Réserve pour ψ ≤ 1 % : u = ln(100/(1+θ))/R = ${f2(Math.log(100 / (1 + th)) / R)} M`],
          resultat: `Pour une ruine ≤ 1 %, il faut u ≈ ${f2(Math.log(100 / (1 + th)) / R)} M FCFA`,
        };
      },
    },
    ratioSolva: {
      titre: "Ratio de solvabilité et choc sur les fonds propres",
      explication: "Ratio = fonds propres éligibles / exigence de capital. Un choc de marché réduit les fonds propres : on visualise le ratio selon l'ampleur du choc, par rapport au seuil réglementaire de 100 %.",
      params: [
        { id: 'fp', label: 'Fonds propres (Mds)', min: 20, max: 300, step: 5, value: 150 },
        { id: 'scr', label: 'Exigence de capital (Mds)', min: 20, max: 300, step: 5, value: 100 },
      ],
      compute(p){
        const chocs = range(0, 0.6, 60);
        const rupture = 1 - p.scr / p.fp;
        return {
          chart: { xlabel: 'Choc sur les fonds propres', ylabel: 'Ratio', xfmt: v => N.pct(v, 0), yfmt: v => N.pct(v, 0),
            series: [{ name: 'Ratio après choc', type: 'line', points: chocs.map(c => [c, p.fp * (1 - c) / p.scr]) }], hlines: [{ y: 1, label: 'Seuil 100 %' }] },
          calcul: [`Ratio initial = ${p.fp}/${p.scr} = ${pct(p.fp / p.scr)}`, rupture > 0 ? `Choc maximal supportable = 1 − SCR/FP = ${pct(rupture)}` : 'Déjà sous le seuil réglementaire'],
          resultat: `Ratio = ${pct(p.fp / p.scr)}`,
        };
      },
    },
  };

  // Rattachement aux matières (ids alignés sur le contenu de chaque formation).
  // [visualisation, n° de section] : le graphique s'affiche dans le cours juste après cette section.
  window.VISUALS = {
    M1: {
      0: [[V.levier, 3], [V.amortissement, 4]], 1: [[V.sousAssurance, 4]], 2: [[V.poissonBinom, 2], [V.tcl, 4]],
      3: [[V.studentNormale, 2], [V.puissance, 3]], 4: [[V.utilite, 1]], 5: [[V.markovBM, 1], [V.ruineJoueur, 3]],
      6: [[V.obligation, 2], [V.binomialCRR, 4]], 7: [[V.regression, 1]], 8: [[V.regression, 2], [V.kde, 2]], 9: [[V.regression, 2]],
      11: [[V.roc, 4]], 12: [[V.surdispersion, 3], [V.regression, 4]], 13: [[V.poissonProcess, 0], [V.brownien, 3]],
      14: [[V.inversion, 1], [V.newton, 2]], 15: [[V.mcConvergence, 1], [V.varCharge, 3]], 16: [[V.kaplanMeier, 2], [V.survie, 3]],
      17: [[V.payoffs, 3]], 18: [[V.markowitz, 1], [V.blackScholes, 3]], 19: [[V.amortissement, 3]], 21: [[V.ksTest, 1], [V.kde, 3]],
    },
    M2: {
      0: [[V.acf, 0], [V.ar1, 1]], 1: [[V.gev, 1], [V.gpd, 2]], 2: [[V.brownien, 0], [V.blackScholes, 1], [V.garch, 2]],
      3: [[V.varNormale, 1], [V.kupiec, 3]], 4: [[V.copule, 1], [V.duration, 2], [V.agregation, 3]], 5: [[V.euler, 1], [V.raroc, 2]],
      6: [[V.mortalite, 0], [V.primeTemp, 2]], 7: [[V.varCharge, 0], [V.chainLadder, 2], [V.bfcl, 3]], 8: [[V.surdispersion, 0], [V.credibilite, 1]],
      9: [[V.ruinePaths, 1], [V.lundberg, 2]], 11: [[V.irb, 1]], 12: [[V.ratioSolva, 1], [V.agregation, 2]],
    },
  };
})();
