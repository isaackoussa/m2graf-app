// Générateurs d'exercices, de quiz et de code — Master 1 (ids alignés sur le contenu M1).
// Chaque générateur : exo(rnd, rndf) → { enonce, etapes, solution } ; quiz → { q, options, a, exp } ;
// code → { python, r, excel, vba } avec les mêmes valeurs tirées au hasard.
(function(){
  const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pc = (v, d = 1) => fr(v * 100, d) + ' %';
  const Phi = x => MGChart.num.normCdf(x);
  const fact = k => { let f = 1; for(let i = 2; i <= k; i++) f *= i; return f; };

  window.GENERATORS_M1 = {
    // 0 Gestion financière — annuité constante et capacité de remboursement
    0: {
      exo(rnd, rndf){
        const K = rnd(10, 200) * 1e6, i = rndf(0.06, 0.14, 3), n = rnd(3, 10);
        const v = Math.pow(1 + i, -n), a = K * i / (1 - v);
        return {
          enonce: `Un crédit de ${fr(K)} FCFA est remboursé par annuités constantes sur ${n} ans au taux de ${pc(i)}. Calculer l'annuité, puis les intérêts et l'amortissement de la première année.`,
          etapes: [`(1 + i)^−n = ${fr(1 + i, 3)}^−${n} = ${fr(v, 5)}`, `a = K·i/(1 − (1+i)^−n) = ${fr(K * i)} / ${fr(1 - v, 5)}`, `Intérêts année 1 = K × i = ${fr(K * i)} FCFA`],
          solution: `Annuité ≈ ${fr(a)} FCFA ; année 1 : intérêts ${fr(K * i)}, amortissement ${fr(a - K * i)} FCFA.`,
        };
      },
      quiz(rnd, rndf){
        const dettes = rnd(100, 900), caf = rnd(40, 250), cr = dettes / caf;
        return {
          q: `Dettes financières = ${dettes} M, CAF = ${caf} M. La capacité de remboursement est-elle conforme à la norme usuelle (≤ 4 ans) ?`,
          options: cr <= 4 ? ['Oui', 'Non'] : ['Non', 'Oui'], a: 0,
          exp: `${dettes}/${caf} = ${fr(cr, 2)} années de CAF ${cr <= 4 ? '≤' : '>'} 4.`,
        };
      },
      code(rnd, rndf){
        const K = rnd(10, 200) * 1e6, i = rndf(0.06, 0.14, 3), n = rnd(3, 10);
        return {
          python: `K, i, n = ${K}, ${i}, ${n}\na = K * i / (1 - (1 + i) ** -n)\ncrd = K\nfor t in range(1, n + 1):\n    interet = crd * i; amort = a - interet; crd -= amort\n    print(t, round(interet), round(amort), round(max(crd, 0)))\nprint("Annuité =", round(a))`,
          r: `K <- ${K}; i <- ${i}; n <- ${n}\na <- K * i / (1 - (1 + i)^-n)\ncrd <- K\nfor (t in 1:n) { int <- crd * i; am <- a - int; crd <- crd - am; cat(t, round(int), round(am), round(max(crd, 0)), "\\n") }`,
          excel: `H1 ${K}   H2 ${i}   H3 ${n}\nH4 (annuité) =VPM(H2;H3;-H1)\n' Intérêts de l'année t : =INTPER(H2;t;H3;-H1)   Amortissement : =PRINCPER(H2;t;H3;-H1)`,
          vba: `Sub Annuite()\n    Dim K As Double, i As Double, n As Integer\n    K = ${K}: i = ${i}: n = ${n}\n    MsgBox "Annuité = " & Format(K * i / (1 - (1 + i) ^ (-n)), "# ##0") & " FCFA"\nEnd Sub`,
        };
      },
    },

    // 1 Droit des affaires — règle proportionnelle de capitaux
    1: {
      exo(rnd, rndf){
        const vr = rnd(10, 50) * 10, va = rnd(5, vr / 10) * 10, d = rnd(1, Math.floor(vr / 10)) * 10;
        const ind = Math.min(d, vr) * Math.min(1, va / vr);
        return {
          enonce: `Un bien d'une valeur réelle de ${vr} M FCFA est assuré pour ${va} M. Un sinistre cause ${d} M de dommages. Quelle indemnité ?`,
          etapes: [va >= vr ? 'Pas de sous-assurance : valeur assurée ≥ valeur réelle.' : `Sous-assurance : rapport VA/VR = ${va}/${vr} = ${fr(va / vr, 3)}`, `Indemnité = ${d} × ${fr(Math.min(1, va / vr), 3)}`],
          solution: `Indemnité = ${fr(ind, 1)} M FCFA ; découvert de l'assuré = ${fr(d - ind, 1)} M.`,
        };
      },
      quiz(rnd, rndf){
        const pp = rnd(20, 60) * 10000, pd = pp + rnd(5, 30) * 10000, d = rnd(2, 20) * 1e6;
        const ind = d * pp / pd;
        return {
          q: `Fausse déclaration non intentionnelle : prime payée ${fr(pp)}, prime due ${fr(pd)} FCFA, sinistre ${fr(d)} FCFA. Indemnité ?`,
          options: [`${fr(ind)} FCFA`, `${fr(d)} FCFA`, '0 FCFA (nullité)', `${fr(d * pd / pp)} FCFA`], a: 0,
          exp: `Art. 19 CIMA : réduction proportionnelle = ${fr(d)} × ${fr(pp)}/${fr(pd)}. La nullité (art. 18) suppose la mauvaise foi.`,
        };
      },
      code(rnd, rndf){
        const vr = rnd(10, 50) * 10, va = rnd(5, vr / 10) * 10, d = rnd(1, Math.floor(vr / 10)) * 10;
        return {
          python: `vr, va, d = ${vr}, ${va}, ${d}\nind = d * min(1, va / vr)\nprint(f"Indemnité = {ind:.1f} M FCFA")`,
          r: `vr <- ${vr}; va <- ${va}; d <- ${d}\nd * min(1, va / vr)`,
          excel: `A2 ${d}   B2 ${va}   C2 ${vr}\nD2 =SI(B2>=C2;A2;A2*B2/C2)`,
          vba: `MsgBox "Indemnité = " & ${d} * Application.Min(1, ${va} / ${vr}) & " M FCFA"`,
        };
      },
    },

    // 2 Probabilité — loi de Poisson
    2: {
      exo(rnd, rndf){
        const l = rndf(0.05, 0.6, 2), p0 = Math.exp(-l), p1 = l * p0;
        return {
          enonce: `Le nombre annuel de sinistres d'un assuré suit une Poisson de paramètre ${fr(l, 2)}. Calculer P(N = 0), P(N = 1) et P(N ≥ 2).`,
          etapes: [`P(N = 0) = e^−${fr(l, 2)} = ${fr(p0, 4)}`, `P(N = 1) = ${fr(l, 2)} × e^−${fr(l, 2)} = ${fr(p1, 4)}`, `P(N ≥ 2) = 1 − ${fr(p0, 4)} − ${fr(p1, 4)}`],
          solution: `P(N=0) ≈ ${pc(p0, 2)} ; P(N=1) ≈ ${pc(p1, 2)} ; P(N≥2) ≈ ${pc(1 - p0 - p1, 2)}.`,
        };
      },
      quiz(rnd, rndf){
        const pr = rndf(0.1, 0.4, 2), pa = rndf(0.15, 0.4, 2), pn = rndf(0.02, 0.12, 2);
        const post = pa * pr / (pa * pr + pn * (1 - pr));
        const opts = [post, pr, pa, pa * pr].map(v => pc(v));
        return {
          q: `${pc(pr, 0)} des assurés sont à risque (P(sinistre) = ${fr(pa, 2)}), les autres ont P(sinistre) = ${fr(pn, 2)}. Sachant qu'un assuré a un sinistre, probabilité qu'il soit à risque ?`,
          options: opts, a: 0,
          exp: `Bayes : ${fr(pa, 2)}×${fr(pr, 2)} / (${fr(pa, 2)}×${fr(pr, 2)} + ${fr(pn, 2)}×${fr(1 - pr, 2)}) = ${fr(post, 3)}.`,
        };
      },
      code(rnd, rndf){
        const l = rndf(0.05, 0.6, 2);
        return {
          python: `from scipy.stats import poisson\nlam = ${l}\nprint(poisson.pmf([0, 1], lam), 1 - poisson.cdf(1, lam))`,
          r: `lam <- ${l}\ndpois(0:1, lam); 1 - ppois(1, lam)`,
          excel: `B1 ${l}\nB2 =LOI.POISSON.N(0;B1;FAUX)\nB3 =LOI.POISSON.N(1;B1;FAUX)\nB4 =1-LOI.POISSON.N(1;B1;VRAI)`,
          vba: `Sub Poisson()\n    Dim l As Double: l = ${l}\n    MsgBox "P(N>=2) = " & Format(1 - Application.Poisson_Dist(1, l, True), "0.0000")\nEnd Sub`,
        };
      },
    },

    // 3 Statistique — intervalle de confiance
    3: {
      exo(rnd, rndf){
        const n = rnd(40, 400), m = rnd(200, 800) * 1000, s = rnd(80, 300) * 1000, z = 1.96, e = s / Math.sqrt(n);
        return {
          enonce: `Sur ${n} sinistres, le coût moyen est ${fr(m)} FCFA et l'écart-type ${fr(s)} FCFA. Construire l'IC à 95 % du coût moyen.`,
          etapes: [`Erreur standard = ${fr(s)}/√${n} = ${fr(e)}`, `Marge = 1,96 × ${fr(e)} = ${fr(z * e)}`],
          solution: `IC95% = [${fr(m - z * e)} ; ${fr(m + z * e)}] FCFA.`,
        };
      },
      quiz(rnd, rndf){
        const p0 = rndf(0.05, 0.2, 2), n = rnd(200, 1000), x = Math.round(n * (p0 + rndf(-0.03, 0.06, 3)));
        const zc = (x / n - p0) / Math.sqrt(p0 * (1 - p0) / n);
        return {
          q: `Fréquence de référence ${pc(p0, 0)}. Sur ${n} contrats, ${x} sinistrés. La fréquence est-elle significativement plus élevée (test unilatéral, α = 5 %) ?`,
          options: zc > 1.645 ? ['Oui, on rejette H₀', 'Non, on ne rejette pas H₀'] : ['Non, on ne rejette pas H₀', 'Oui, on rejette H₀'], a: 0,
          exp: `z = (${fr(x / n, 3)} − ${fr(p0, 2)})/√(${fr(p0, 2)}×${fr(1 - p0, 2)}/${n}) = ${fr(zc, 2)} ${zc > 1.645 ? '>' : '≤'} 1,645.`,
        };
      },
      code(rnd, rndf){
        const n = rnd(40, 400), m = rnd(200, 800) * 1000, s = rnd(80, 300) * 1000;
        return {
          python: `import numpy as np\nn, m, s = ${n}, ${m}, ${s}\ne = 1.96 * s / np.sqrt(n)\nprint(f"IC95% = [{m - e:,.0f} ; {m + e:,.0f}]")`,
          r: `n <- ${n}; m <- ${m}; s <- ${s}\nm + c(-1, 1) * qnorm(0.975) * s / sqrt(n)`,
          excel: `B1 ${n}   B2 ${m}   B3 ${s}\nB4 (marge) =INTERVALLE.CONFIANCE.NORMAL(0,05;B3;B1)\nB5 =B2-B4   B6 =B2+B4`,
          vba: `Sub IC()\n    Dim marge As Double\n    marge = Application.Confidence_Norm(0.05, ${s}, ${n})\n    MsgBox "IC95% = [" & Format(${m} - marge, "# ##0") & " ; " & Format(${m} + marge, "# ##0") & "]"\nEnd Sub`,
        };
      },
    },

    // 4 Économie de l'assurance — prime maximale (utilité √w)
    4: {
      exo(rnd, rndf){
        const w = rnd(4, 25), L = rnd(1, w - 1), p = rndf(0.05, 0.3, 2);
        const Eu = (1 - p) * Math.sqrt(w) + p * Math.sqrt(w - L), EC = Eu * Eu;
        return {
          enonce: `Un agent de richesse ${w} M FCFA, d'utilité u(w) = √w, risque de perdre ${L} M avec probabilité ${fr(p, 2)}. Calculer l'équivalent certain et la prime maximale d'assurance.`,
          etapes: [`E[u] = ${fr(1 - p, 2)}×√${w} + ${fr(p, 2)}×√${w - L} = ${fr(Eu, 4)}`, `EC = E[u]² = ${fr(EC, 4)} M`, `Prime pure = ${fr(p, 2)} × ${L} = ${fr(p * L, 3)} M`],
          solution: `Prime maximale = ${w} − ${fr(EC, 4)} = ${fr(w - EC, 4)} M FCFA (prime de risque ${fr(w - EC - p * L, 4)} M).`,
        };
      },
      quiz(rnd, rndf){
        const pp = rnd(30, 120) * 1000, sec = rndf(0.02, 0.1, 2), ch = rndf(0.15, 0.35, 2), P = pp * (1 + sec) / (1 - ch);
        return {
          q: `Prime pure ${fr(pp)} FCFA, chargement de sécurité ${pc(sec, 0)} de la prime pure, chargements commerciaux ${pc(ch, 0)} de la prime commerciale. Prime commerciale ?`,
          options: [`${fr(P)} FCFA`, `${fr(pp * (1 + sec + ch))} FCFA`, `${fr(pp * (1 + sec))} FCFA`, `${fr(pp / (1 - ch))} FCFA`], a: 0,
          exp: `P = ${fr(pp)} × ${fr(1 + sec, 2)} / (1 − ${fr(ch, 2)}) = ${fr(P)} FCFA.`,
        };
      },
      code(rnd, rndf){
        const w = rnd(4, 25), L = rnd(1, w - 1), p = rndf(0.05, 0.3, 2);
        return {
          python: `import numpy as np\nw, L, p = ${w}, ${L}, ${p}\nEu = (1 - p) * np.sqrt(w) + p * np.sqrt(w - L)\nprint("Prime max =", w - Eu**2, " prime pure =", p * L)`,
          r: `w <- ${w}; L <- ${L}; p <- ${p}\nEu <- (1 - p) * sqrt(w) + p * sqrt(w - L)\nc(prime_max = w - Eu^2, prime_pure = p * L)`,
          excel: `B1 ${w}   B2 ${L}   B3 ${p}\nB4 (E[u]) =(1-B3)*RACINE(B1)+B3*RACINE(B1-B2)\nB5 (prime max) =B1-B4^2`,
          vba: `Function PrimeMaxRacine(w As Double, L As Double, p As Double) As Double\n    PrimeMaxRacine = w - ((1 - p) * Sqr(w) + p * Sqr(w - L)) ^ 2\nEnd Function\n' =PrimeMaxRacine(${w};${L};${p})`,
        };
      },
    },

    // 5 Processus stochastiques I — chaîne à deux états
    5: {
      exo(rnd, rndf){
        const a = rndf(0.05, 0.4, 2), b = rndf(0.2, 0.8, 2), pi0 = b / (a + b);
        return {
          enonce: `Un assuré passe de « sans sinistre » (0) à « sinistré » (1) avec probabilité ${fr(a, 2)} et revient de 1 à 0 avec probabilité ${fr(b, 2)}. Trouver la loi stationnaire.`,
          etapes: ['π₀ = π₀(1 − a) + π₁ b ⇒ π₀ a = π₁ b', `π₀ = b/(a + b) = ${fr(b, 2)}/${fr(a + b, 2)}`],
          solution: `π = (${fr(pi0, 4)} ; ${fr(1 - pi0, 4)}) : à long terme ${pc(1 - pi0)} des assurés sont dans l'état sinistré.`,
        };
      },
      quiz(rnd, rndf){
        const k = rnd(1, 6), N = rnd(k + 2, 15);
        return {
          q: `Marche aléatoire symétrique partant de ${k}. Probabilité d'atteindre 0 avant ${N} ?`,
          options: [fr(1 - k / N, 3), fr(k / N, 3), '0,5', fr(Math.pow(0.5, k), 3)], a: 0,
          exp: `Pour p = 1/2 : P(ruine) = 1 − k/N = 1 − ${k}/${N}.`,
        };
      },
      code(rnd, rndf){
        const a = rndf(0.05, 0.4, 2), b = rndf(0.2, 0.8, 2);
        return {
          python: `import numpy as np\nP = np.array([[${1 - a}, ${a}], [${b}, ${1 - b}]])\nprint(np.linalg.matrix_power(P, 50)[0])   # ≈ loi stationnaire`,
          r: `P <- matrix(c(${1 - a}, ${a}, ${b}, ${1 - b}), 2, byrow = TRUE)\nmu <- c(1, 0); for (i in 1:50) mu <- mu %*% P; mu`,
          excel: `' P en B2:C3\nB2 ${fr(1 - a, 2)}   C2 ${fr(a, 2)}\nB3 ${fr(b, 2)}   C3 ${fr(1 - b, 2)}\nE2 (π0) =B3/(C2+B3)   F2 (π1) =1-E2`,
          vba: `Function Pi0(a As Double, b As Double) As Double\n    Pi0 = b / (a + b)\nEnd Function\n' =Pi0(${a};${b})`,
        };
      },
    },

    // 6 Mathématiques de la finance — VAN
    6: {
      exo(rnd, rndf){
        const I = rnd(50, 200), F = rnd(15, 60), n = rnd(3, 8), i = rndf(0.06, 0.15, 2);
        const an = (1 - Math.pow(1 + i, -n)) / i, van = -I + F * an;
        return {
          enonce: `Un investissement de ${I} M FCFA génère ${F} M par an pendant ${n} ans. Calculer la VAN au taux de ${pc(i, 0)}. Le projet est-il rentable ?`,
          etapes: [`aₙ = (1 − ${fr(1 + i, 2)}^−${n})/${fr(i, 2)} = ${fr(an, 4)}`, `VAN = −${I} + ${F} × ${fr(an, 4)}`],
          solution: `VAN = ${fr(van, 2)} M FCFA → projet ${van > 0 ? 'rentable' : 'non rentable'} au taux de ${pc(i, 0)}.`,
        };
      },
      quiz(rnd, rndf){
        const r1 = rndf(0.02, 0.06, 3), r2 = r1 + rndf(0.002, 0.02, 3), f = (1 + r2) ** 2 / (1 + r1) - 1;
        return {
          q: `Taux zéro-coupon : 1 an = ${pc(r1, 1)}, 2 ans = ${pc(r2, 1)}. Taux forward 1 an dans 1 an ?`,
          options: [pc(f, 2), pc((r1 + r2) / 2, 2), pc(r2 - r1, 2), pc(r2, 2)], a: 0,
          exp: `f = (1 + r₂)²/(1 + r₁) − 1 = ${pc(f, 2)}.`,
        };
      },
      code(rnd, rndf){
        const I = rnd(50, 200), F = rnd(15, 60), n = rnd(3, 8), i = rndf(0.06, 0.15, 2);
        return {
          python: `import numpy_financial as npf   # pip install numpy-financial\nflux = [-${I}] + [${F}] * ${n}\nprint("VAN =", npf.npv(${i}, flux), " TRI =", npf.irr(flux))`,
          r: `flux <- c(-${I}, rep(${F}, ${n}))\nsum(flux / (1 + ${i})^(0:${n}))\nuniroot(function(r) sum(flux / (1 + r)^(0:${n})), c(-0.9, 1))$root`,
          excel: `B2 -${I}\nB3:B${2 + n} ${F}\nD1 (VAN) =B2+VAN(${fr(i, 2)};B3:B${2 + n})\nD2 (TRI) =TRI(B2:B${2 + n})`,
          vba: `Sub VANTRI()\n    Dim f(0 To ${n}) As Double, t As Integer\n    f(0) = -${I}\n    For t = 1 To ${n}: f(t) = ${F}: Next t\n    MsgBox "TRI = " & Format(Application.Irr(f), "0.00%")\nEnd Sub`,
        };
      },
    },

    // 7 Modélisation linéaire — test de Student sur un coefficient
    7: {
      exo(rnd, rndf){
        const b = rndf(-5, 15, 2), se = rndf(0.8, 5, 2), n = rnd(30, 300), t = b / se;
        return {
          enonce: `Dans une régression à ${n} observations et 3 variables, un coefficient vaut ${fr(b, 2)} avec une erreur standard de ${fr(se, 2)}. Est-il significatif à 5 % ?`,
          etapes: [`t = ${fr(b, 2)}/${fr(se, 2)} = ${fr(t, 3)}`, `ddl = ${n} − 4 = ${n - 4} ; seuil ≈ 1,97`],
          solution: `|t| = ${fr(Math.abs(t), 2)} ${Math.abs(t) > 1.97 ? '> 1,97 : coefficient significatif' : '≤ 1,97 : non significatif'} à 5 %.`,
        };
      },
      quiz(rnd, rndf){
        const r2 = rndf(0.1, 0.9, 2), n = rnd(20, 200), p = rnd(2, 8), adj = 1 - (1 - r2) * (n - 1) / (n - p - 1);
        return {
          q: `R² = ${fr(r2, 2)}, n = ${n}, p = ${p} variables. R² ajusté ?`,
          options: [fr(adj, 3), fr(r2, 3), fr(r2 * p / n, 3), fr(1 - r2, 3)], a: 0,
          exp: `R²aj = 1 − (1 − R²)(n − 1)/(n − p − 1) = ${fr(adj, 3)}.`,
        };
      },
      code(rnd, rndf){
        const b0 = rnd(1, 10), b1 = rndf(0.5, 3, 2), s = rndf(0.5, 3, 1);
        return {
          python: `import numpy as np, statsmodels.api as sm\nrng = np.random.default_rng(1)\nx = rng.uniform(0, 10, 100); y = ${b0} + ${b1} * x + rng.normal(0, ${s}, 100)\nprint(sm.OLS(y, sm.add_constant(x)).fit().summary())`,
          r: `set.seed(1); x <- runif(100, 0, 10); y <- ${b0} + ${b1} * x + rnorm(100, 0, ${s})\nsummary(lm(y ~ x))`,
          excel: `A2 =ALEA()*10              (recopier sur 100 lignes)\nB2 =${b0}+${fr(b1, 2)}*A2+LOI.NORMALE.INVERSE.N(ALEA();0;${fr(s, 1)})\nD1 =PENTE(B2:B101;A2:A101)   D2 =ORDONNEE.ORIGINE(B2:B101;A2:A101)   D3 =COEFFICIENT.DETERMINATION(B2:B101;A2:A101)`,
          vba: `Sub RegressionSimple()\n    MsgBox "Pente = " & Application.Slope(Range("B2:B101"), Range("A2:A101")) & vbCrLf & _\n           "R² = " & Application.RSq(Range("B2:B101"), Range("A2:A101"))\nEnd Sub`,
        };
      },
    },

    // 11 Data mining — matrice de confusion
    11: {
      exo(rnd, rndf){
        const P = rnd(100, 500), Nn = rnd(3000, 10000), vp = rnd(Math.round(P * 0.5), Math.round(P * 0.95)), fp = rnd(Math.round(Nn * 0.01), Math.round(Nn * 0.1));
        const sens = vp / P, spec = (Nn - fp) / Nn, prec = vp / (vp + fp), f1 = 2 * prec * sens / (prec + sens);
        return {
          enonce: `Sur ${P} fraudes et ${Nn} dossiers honnêtes, le modèle détecte ${vp} fraudes et signale ${fp} dossiers honnêtes. Calculer sensibilité, spécificité, précision et F1.`,
          etapes: [`Sensibilité = ${vp}/${P}`, `Spécificité = ${Nn - fp}/${Nn}`, `Précision = ${vp}/(${vp} + ${fp})`],
          solution: `Sensibilité ${pc(sens)}, spécificité ${pc(spec)}, précision ${pc(prec)}, F1 = ${fr(f1, 3)}.`,
        };
      },
      quiz(rnd, rndf){
        const b = rndf(-1.5, 1.5, 2), or = Math.exp(b);
        return {
          q: `Dans une régression logistique, le coefficient d'une variable binaire vaut ${fr(b, 2)}. Quel est l'odds-ratio ?`,
          options: [fr(or, 2), fr(b, 2), fr(1 / (1 + Math.exp(-b)), 2), fr(-b, 2)], a: 0,
          exp: `OR = e^${fr(b, 2)} = ${fr(or, 2)} : la cote est multipliée par ${fr(or, 2)}.`,
        };
      },
      code(rnd, rndf){
        const d = rndf(0.5, 2.5, 1);
        return {
          python: `import numpy as np\nfrom sklearn.metrics import roc_auc_score, confusion_matrix\nrng = np.random.default_rng(0)\ny = np.r_[np.zeros(1000), np.ones(1000)]\nscore = np.r_[rng.normal(0, 1, 1000), rng.normal(${d}, 1, 1000)]\nprint("AUC =", roc_auc_score(y, score))\nprint(confusion_matrix(y, score > ${fr(d / 2, 2).replace(',', '.')}))`,
          r: `library(pROC); set.seed(0)\ny <- rep(0:1, each = 1000); score <- c(rnorm(1000), rnorm(1000, ${d}))\nauc(roc(y, score))   # théorique : pnorm(${d}/sqrt(2)) = ${fr(Phi(d / Math.SQRT2), 3)}`,
          excel: `' Scores en A2:A2001, cible en B2:B2001, seuil en E1\nC2 =SI(A2>$E$1;1;0)\nE3 (VP) =NB.SI.ENS(C:C;1;B:B;1)   E4 (FP) =NB.SI.ENS(C:C;1;B:B;0)\nE6 (sensibilité) =E3/NB.SI(B:B;1)`,
          vba: `' Voir la fonction AUC (Mann-Whitney) dans l'onglet Code du cours\n' =AUC(A2:A2001;B2:B2001)   → attendu ≈ ${fr(Phi(d / Math.SQRT2), 3)}`,
        };
      },
    },

    // 12 Modélisation non linéaire — GLM Poisson log
    12: {
      exo(rnd, rndf){
        const b0 = rndf(-3, -1.5, 2), b1 = rndf(0.1, 0.6, 2), b2 = rndf(-0.4, 0.4, 2);
        const eta = b0 + b1 + b2, lam = Math.exp(eta);
        return {
          enonce: `GLM Poisson (lien log) : constante ${fr(b0, 2)}, jeune conducteur ${fr(b1, 2)}, véhicule utilitaire ${fr(b2, 2)}. Fréquence d'un jeune conducteur en véhicule utilitaire ?`,
          etapes: [`η = ${fr(b0, 2)} + ${fr(b1, 2)} + ${fr(b2, 2)} = ${fr(eta, 2)}`, `λ = e^η`, `Coefficients multiplicatifs : e^${fr(b1, 2)} = ${fr(Math.exp(b1), 3)} ; e^${fr(b2, 2)} = ${fr(Math.exp(b2), 3)}`],
          solution: `Fréquence ≈ ${pc(lam, 2)} (base : ${pc(Math.exp(b0), 2)}).`,
        };
      },
      quiz(rnd, rndf){
        const d0 = rnd(3000, 9000), dd = rndf(1, 15, 1), ddl = rnd(1, 3), crit = [3.84, 5.99, 7.81][ddl - 1];
        return {
          q: `Ajouter une variable à ${ddl + 1} modalités fait baisser la déviance de ${fr(d0, 0)} à ${fr(d0 - dd, 1)}. Est-elle significative à 5 % ?`,
          options: dd > crit ? ['Oui', 'Non'] : ['Non', 'Oui'], a: 0,
          exp: `ΔD = ${fr(dd, 1)} à comparer à χ²₀,₉₅(${ddl}) = ${fr(crit, 2)}.`,
        };
      },
      code(rnd, rndf){
        const b0 = rndf(-3, -1.5, 2), b1 = rndf(0.1, 0.6, 2);
        return {
          python: `import numpy as np, pandas as pd, statsmodels.api as sm, statsmodels.formula.api as smf\nrng = np.random.default_rng(1); n = 10000\ndf = pd.DataFrame({"jeune": rng.integers(0, 2, n), "expo": rng.uniform(.2, 1, n)})\ndf["nb"] = rng.poisson(df.expo * np.exp(${b0} + ${b1} * df.jeune))\nm = smf.glm("nb ~ jeune", df, family=sm.families.Poisson(), offset=np.log(df.expo)).fit()\nprint(np.exp(m.params))`,
          r: `set.seed(1); n <- 10000\ndf <- data.frame(jeune = rbinom(n, 1, .5), expo = runif(n, .2, 1))\ndf$nb <- rpois(n, df$expo * exp(${b0} + ${b1} * df$jeune))\nexp(coef(glm(nb ~ jeune + offset(log(expo)), family = poisson, data = df)))`,
          excel: `' Tarif multiplicatif\nB1 (β0) ${fr(b0, 2)}   B2 (β jeune) ${fr(b1, 2)}\nB4 (fréquence base)  =EXP(B1)\nB5 (fréquence jeune) =EXP(B1+B2)\nB6 (coef. jeune)     =EXP(B2)`,
          vba: `Function FrequenceGLM(b0 As Double, b1 As Double, jeune As Integer) As Double\n    FrequenceGLM = Exp(b0 + b1 * jeune)\nEnd Function\n' =FrequenceGLM(${b0};${b1};1)`,
        };
      },
    },

    // 13 Processus stochastiques II — Poisson composé
    13: {
      exo(rnd, rndf){
        const l = rnd(5, 30), T = rnd(1, 6), m = rnd(2, 8) * 100000, s = rnd(1, 6) * 100000;
        const lt = l * T, E = lt * m, V = lt * (s * s + m * m);
        return {
          enonce: `Sinistres selon un Poisson de ${l} par mois ; montants i.i.d. de moyenne ${fr(m)} et d'écart-type ${fr(s)} FCFA. Espérance et écart-type de la charge sur ${T} mois ?`,
          etapes: [`λt = ${lt}`, `E[S] = λt·E[X] = ${fr(E)}`, `E[X²] = σ² + μ² = ${fr(s * s + m * m)}`, `V(S) = λt·E[X²] = ${fr(V)}`],
          solution: `E[S] = ${fr(E)} FCFA ; σ(S) = ${fr(Math.sqrt(V))} FCFA.`,
        };
      },
      quiz(rnd, rndf){
        const l = rnd(4, 30), j = rnd(1, 10), p = Math.exp(-l * j / 30);
        return {
          q: `${l} sinistres par mois en moyenne (mois de 30 jours). Probabilité d'aucun sinistre pendant ${j} jours ?`,
          options: [pc(p), pc(1 - p), pc(j / 30), pc(Math.exp(-l))], a: 0,
          exp: `N ~ Poisson(${l}×${j}/30 = ${fr(l * j / 30, 2)}) ⇒ P(N = 0) = e^−${fr(l * j / 30, 2)}.`,
        };
      },
      code(rnd, rndf){
        const mu = rndf(0.02, 0.15, 2), s = rndf(0.1, 0.4, 2);
        return {
          python: `import numpy as np\nrng = np.random.default_rng(); n, dt = 252, 1/252\nz = rng.standard_normal(n)\nS = 100 * np.exp(np.cumsum((${mu} - ${s}**2/2) * dt + ${s} * np.sqrt(dt) * z))\nprint(S[-1])`,
          r: `n <- 252; dt <- 1/252\nS <- 100 * exp(cumsum((${mu} - ${s}^2/2) * dt + ${s} * sqrt(dt) * rnorm(n)))\nplot(S, type = "l")`,
          excel: `A2 100\nA3 =A2*EXP((${fr(mu, 2)}-${fr(s, 2)}^2/2)/252+${fr(s, 2)}*RACINE(1/252)*LOI.NORMALE.STANDARD.INVERSE.N(ALEA()))\n' recopier sur 252 lignes puis tracer une courbe`,
          vba: `Sub GBM()\n    Dim k As Integer, S As Double: S = 100: Randomize\n    For k = 1 To 252\n        S = S * Exp((${mu} - ${s} ^ 2 / 2) / 252 + ${s} * Sqr(1 / 252) * Application.Norm_S_Inv(Rnd()))\n        Cells(k + 1, 1).Value = S\n    Next k\nEnd Sub`,
        };
      },
    },

    // 14 Stat & proba numériques — inversion
    14: {
      exo(rnd, rndf){
        const a = rndf(1.2, 4, 1), xm = rnd(1, 10) * 1000, u = rndf(0.5, 0.99, 2), x = xm * Math.pow(1 - u, -1 / a);
        return {
          enonce: `Simuler une Pareto de paramètres x_m = ${fr(xm)} et α = ${fr(a, 1)} par inversion, pour U = ${fr(u, 2)}.`,
          etapes: [`F(x) = 1 − (x_m/x)^α ⇒ x = x_m (1 − U)^(−1/α)`, `(1 − ${fr(u, 2)})^(−1/${fr(a, 1)}) = ${fr(Math.pow(1 - u, -1 / a), 4)}`],
          solution: `X = ${fr(x)} (quantile d'ordre ${fr(u, 2)} de la Pareto).`,
        };
      },
      quiz(rnd, rndf){
        const l = rndf(0.5, 5, 1), u = rndf(0.1, 0.9, 2), x = -Math.log(u) / l;
        return {
          q: `Pour simuler une exponentielle E(${fr(l, 1)}) avec U = ${fr(u, 2)}, on obtient :`,
          options: [fr(x, 4), fr(u / l, 4), fr(Math.exp(-l * u), 4), fr(l * u, 4)], a: 0,
          exp: `X = −ln(U)/λ = −ln(${fr(u, 2)})/${fr(l, 1)} (1 − U et U ont la même loi).`,
        };
      },
      code(rnd, rndf){
        const a = rndf(1.2, 4, 1), xm = rnd(1, 10) * 1000;
        return {
          python: `import numpy as np\nU = np.random.default_rng().random(100000)\nX = ${xm} * U ** (-1 / ${a})\nprint("q99 simulé :", np.quantile(X, .99), " théorique :", ${xm} * 0.01 ** (-1 / ${a}))`,
          r: `X <- ${xm} * runif(1e5)^(-1/${a})\nc(quantile(X, .99), ${xm} * 0.01^(-1/${a}))`,
          excel: `A2 =${xm}*ALEA()^(-1/${fr(a, 1)})     (recopier sur 10 000 lignes)\nC1 =CENTILE.INCLURE(A2:A10001;0,99)\nC2 =${xm}*0,01^(-1/${fr(a, 1)})`,
          vba: `Function SimPareto(xm As Double, alpha As Double) As Double\n    SimPareto = xm * (1 - Rnd()) ^ (-1 / alpha)\nEnd Function\n' =SimPareto(${xm};${a})`,
        };
      },
    },

    // 15 Monte Carlo — précision
    15: {
      exo(rnd, rndf){
        const n = rnd(1, 20) * 5000, m = rndf(5, 20, 2), s = rndf(5, 30, 1), h = rndf(0.02, 0.1, 2);
        const e = s / Math.sqrt(n), need = Math.ceil(Math.pow(1.96 * s / h, 2));
        return {
          enonce: `Avec ${fr(n)} simulations, un prix estimé à ${fr(m, 2)} présente un écart-type des payoffs de ${fr(s, 1)}. Donner l'IC à 95 %, puis le nombre de simulations pour une demi-largeur de ${fr(h, 2)}.`,
          etapes: [`Erreur standard = ${fr(s, 1)}/√${n} = ${fr(e, 4)}`, `IC = ${fr(m, 2)} ± 1,96 × ${fr(e, 4)}`, `n = (1,96 × ${fr(s, 1)}/${fr(h, 2)})²`],
          solution: `IC95% = [${fr(m - 1.96 * e, 3)} ; ${fr(m + 1.96 * e, 3)}] ; il faut environ ${fr(need)} simulations.`,
        };
      },
      quiz(rnd, rndf){
        const k = [2, 3, 4, 5, 10][rnd(0, 4)];
        return {
          q: `Pour diviser par ${k} la largeur de l'intervalle de confiance Monte Carlo, il faut multiplier le nombre de simulations par :`,
          options: [String(k * k), String(k), fr(Math.sqrt(k), 2), String(2 * k)], a: 0,
          exp: `L'erreur décroît en 1/√n : il faut ${k}² = ${k * k} fois plus de simulations.`,
        };
      },
      code(rnd, rndf){
        const s = rndf(0.1, 0.5, 2), K = rnd(80, 120);
        return {
          python: `import numpy as np\nrng = np.random.default_rng(); n = 100000\nZ = rng.standard_normal(n)\npay = np.exp(-0.05) * np.maximum(100 * np.exp(0.05 - ${s}**2/2 + ${s} * Z) - ${K}, 0)\nprint(pay.mean(), "±", 1.96 * pay.std() / np.sqrt(n))`,
          r: `n <- 1e5; Z <- rnorm(n)\npay <- exp(-0.05) * pmax(100 * exp(0.05 - ${s}^2/2 + ${s} * Z) - ${K}, 0)\nc(prix = mean(pay), demi_IC = 1.96 * sd(pay) / sqrt(n))`,
          excel: `A2 =EXP(-0,05)*MAX(100*EXP(0,05-${fr(s, 2)}^2/2+${fr(s, 2)}*LOI.NORMALE.STANDARD.INVERSE.N(ALEA()))-${K};0)\n' recopier sur 10 000 lignes\nC1 =MOYENNE(A2:A10001)   C2 =1,96*ECARTYPE.STANDARD(A2:A10001)/RACINE(10000)`,
          vba: `Function CallMC(n As Long) As Double\n    Dim i As Long, s As Double, z As Double\n    For i = 1 To n\n        z = Application.Norm_S_Inv(Rnd())\n        s = s + Application.Max(100 * Exp(0.05 - ${s} ^ 2 / 2 + ${s} * z) - ${K}, 0)\n    Next i\n    CallMC = Exp(-0.05) * s / n\nEnd Function`,
        };
      },
    },

    // 16 Modèles de durée — exponentielle censurée
    16: {
      exo(rnd, rndf){
        const n = rnd(5, 8), T = [], d = [];
        for(let i = 0; i < n; i++){ T.push(rnd(1, 9)); d.push(Math.random() < 0.6 ? 1 : 0); }
        if(!d.some(x => x)) d[0] = 1;
        const D = d.reduce((a, b) => a + b, 0), S = T.reduce((a, b) => a + b, 0), l = D / S;
        return {
          enonce: `Durées avant résiliation (années) : ${T.map((t, i) => t + (d[i] ? '' : '+')).join(', ')} (+ = contrat encore actif). Estimer λ (loi exponentielle) et P(T > 3).`,
          etapes: [`Nombre de résiliations Σδ = ${D}`, `Exposition totale Σt = ${S}`, `λ̂ = ${D}/${S} = ${fr(l, 4)}`],
          solution: `λ̂ ≈ ${fr(l, 4)} ; durée moyenne ${fr(1 / l, 2)} ans ; P(T > 3) = e^(−3λ̂) ≈ ${pc(Math.exp(-3 * l))}.`,
        };
      },
      quiz(rnd, rndf){
        const b = rndf(-1, 1.2, 2);
        return {
          q: `Dans un modèle de Cox, β = ${fr(b, 2)} pour une variable binaire. Hazard ratio ?`,
          options: [fr(Math.exp(b), 3), fr(b, 3), fr(1 - Math.exp(-b), 3), fr(Math.exp(-b), 3)], a: 0,
          exp: `HR = e^β = ${fr(Math.exp(b), 3)} : le risque instantané est multiplié par ${fr(Math.exp(b), 3)}.`,
        };
      },
      code(rnd, rndf){
        const k = rndf(0.5, 3, 1), eta = rnd(2, 10);
        return {
          python: `import numpy as np\nfrom lifelines import KaplanMeierFitter\nrng = np.random.default_rng(1)\nT = ${eta} * rng.weibull(${k}, 300); C = rng.uniform(0, ${2 * eta}, 300)\nkm = KaplanMeierFitter().fit(np.minimum(T, C), T <= C)\nprint(km.predict(${eta}), " théorique :", np.exp(-1))`,
          r: `library(survival); set.seed(1)\nT <- rweibull(300, ${k}, ${eta}); C <- runif(300, 0, ${2 * eta})\nkm <- survfit(Surv(pmin(T, C), T <= C) ~ 1)\nsummary(km, times = ${eta}); exp(-1)`,
          excel: `' Survie Weibull k = ${fr(k, 1)}, η = ${eta}\nA2 (t)   B2 =EXP(-(A2/${eta})^${fr(k, 1)})\nC2 (hasard) =${fr(k, 1)}/${eta}*(A2/${eta})^(${fr(k, 1)}-1)`,
          vba: `Function SurvieWeibull(t As Double, k As Double, eta As Double) As Double\n    SurvieWeibull = Exp(-(t / eta) ^ k)\nEnd Function\n' =SurvieWeibull(${eta};${k};${eta}) → e^-1`,
        };
      },
    },

    // 17 Ingénierie financière — parité call-put
    17: {
      exo(rnd, rndf){
        const S = rnd(80, 120), K = rnd(80, 120), r = rndf(0.02, 0.08, 3), T = rnd(1, 3) / 2, C = rndf(3, 20, 2);
        const P = C - S + K * Math.exp(-r * T);
        return {
          enonce: `S₀ = ${S}, K = ${K}, r = ${pc(r)}, T = ${fr(T, 1)} an, prix du call = ${fr(C, 2)}. Déduire le prix du put européen.`,
          etapes: [`K·e^(−rT) = ${K} × ${fr(Math.exp(-r * T), 5)} = ${fr(K * Math.exp(-r * T), 3)}`, `P = C − S₀ + K·e^(−rT)`],
          solution: P > 0 ? `P ≈ ${fr(P, 3)}.` : `P = ${fr(P, 3)} < 0 : impossible, le call est sous-évalué (arbitrage : acheter le call).`,
        };
      },
      quiz(rnd, rndf){
        const f = rndf(1, 1.3, 3), P = [rndf(0.97, 0.99, 3)]; P.push(P[0] - rndf(0.03, 0.05, 3)); P.push(P[1] - rndf(0.03, 0.05, 3));
        const sw = (1 - P[2]) / (P[0] + P[1] + P[2]);
        return {
          q: `Facteurs d'actualisation : ${P.map(p => fr(p, 3)).join(' ; ')}. Taux swap 3 ans (paiements annuels) ?`,
          options: [pc(sw, 2), pc(1 - P[2], 2), pc((1 - P[2]) / 3, 2), pc(1 / P[2] - 1, 2)], a: 0,
          exp: `(1 − P₃)/ΣPᵢ = ${fr(1 - P[2], 3)}/${fr(P[0] + P[1] + P[2], 3)}.`,
        };
      },
      code(rnd, rndf){
        const K = rnd(90, 110), s = rndf(0.15, 0.4, 2);
        return {
          python: `import numpy as np, matplotlib.pyplot as plt\nST = np.linspace(50, 150, 200); K, prime = ${K}, ${fr(s * 30, 2).replace(',', '.')}\nplt.plot(ST, np.maximum(ST - K, 0) + np.maximum(K - ST, 0) - 2 * prime, label="Straddle")\nplt.axhline(0, color="k"); plt.legend(); plt.show()`,
          r: `ST <- seq(50, 150, length = 200); K <- ${K}; prime <- ${fr(s * 30, 2).replace(',', '.')}\nplot(ST, pmax(ST - K, 0) + pmax(K - ST, 0) - 2 * prime, type = "l", ylab = "Gain"); abline(h = 0)`,
          excel: `A2:A102  (S_T de 50 à 150)\nB2 =MAX(A2-${K};0)+MAX(${K}-A2;0)-2*${fr(s * 30, 2)}\n' Graphique en nuage de points avec courbes`,
          vba: `Function GainStraddle(ST As Double, K As Double, primeTotale As Double) As Double\n    GainStraddle = Application.Max(ST - K, 0) + Application.Max(K - ST, 0) - primeTotale\nEnd Function`,
        };
      },
    },

    // 18 Finance quantitative — MEDAF et Black-Scholes
    18: {
      exo(rnd, rndf){
        const S = rnd(80, 120), K = rnd(80, 120), r = rndf(0.02, 0.08, 3), s = rndf(0.15, 0.4, 2), T = 1;
        const d1 = (Math.log(S / K) + (r + s * s / 2) * T) / (s * Math.sqrt(T)), d2 = d1 - s * Math.sqrt(T);
        const C = S * Phi(d1) - K * Math.exp(-r * T) * Phi(d2);
        return {
          enonce: `Call européen : S = ${S}, K = ${K}, r = ${pc(r)}, σ = ${pc(s, 0)}, T = 1 an. Calculer le prix et le delta.`,
          etapes: [`d₁ = [ln(${S}/${K}) + (${fr(r, 3)} + ${fr(s, 2)}²/2)] / ${fr(s, 2)} = ${fr(d1, 4)}`, `d₂ = d₁ − σ = ${fr(d2, 4)}`, `N(d₁) = ${fr(Phi(d1), 4)} ; N(d₂) = ${fr(Phi(d2), 4)}`],
          solution: `C ≈ ${fr(C, 3)} ; Δ = ${fr(Phi(d1), 3)}.`,
        };
      },
      quiz(rnd, rndf){
        const rf = rndf(0.02, 0.06, 3), rm = rf + rndf(0.03, 0.08, 3), b = rndf(0.5, 1.6, 2), er = rf + b * (rm - rf);
        return {
          q: `r_f = ${pc(rf)}, E[R_M] = ${pc(rm)}, β = ${fr(b, 2)}. Rentabilité exigée selon le MEDAF ?`,
          options: [pc(er, 2), pc(b * rm, 2), pc(rf + b * rm, 2), pc(rm - rf, 2)], a: 0,
          exp: `E[R] = ${pc(rf)} + ${fr(b, 2)} × (${pc(rm)} − ${pc(rf)}) = ${pc(er, 2)}.`,
        };
      },
      code(rnd, rndf){
        const S = rnd(80, 120), K = rnd(80, 120), s = rndf(0.15, 0.4, 2);
        return {
          python: `from scipy.stats import norm\nimport numpy as np\nS, K, r, s, T = ${S}, ${K}, 0.05, ${s}, 1\nd1 = (np.log(S/K) + (r + s**2/2)*T) / (s*np.sqrt(T)); d2 = d1 - s*np.sqrt(T)\nprint("Call =", S*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2), " delta =", norm.cdf(d1))`,
          r: `S <- ${S}; K <- ${K}; r <- 0.05; s <- ${s}; T <- 1\nd1 <- (log(S/K) + (r + s^2/2)*T)/(s*sqrt(T)); d2 <- d1 - s*sqrt(T)\nc(call = S*pnorm(d1) - K*exp(-r*T)*pnorm(d2), delta = pnorm(d1))`,
          excel: `B1 ${S}   B2 ${K}   B3 0,05   B4 ${fr(s, 2)}   B5 1\nB6 =(LN(B1/B2)+(B3+B4^2/2)*B5)/(B4*RACINE(B5))\nB7 =B6-B4*RACINE(B5)\nB8 (call) =B1*LOI.NORMALE.STANDARD.N(B6;VRAI)-B2*EXP(-B3*B5)*LOI.NORMALE.STANDARD.N(B7;VRAI)\nB9 (delta) =LOI.NORMALE.STANDARD.N(B6;VRAI)`,
          vba: `' Voir BlackScholes() dans l'onglet Code du cours\n' =BlackScholes(${S};${K};0,05;${s};1)`,
        };
      },
    },

    // 19 VBA — fonction de tarification
    19: {
      exo(rnd, rndf){
        const cv = rnd(4, 14), age = rnd(18, 70), zone = Math.random() < 0.5 ? 'Abidjan' : 'Bouaké';
        let p = 80000 * (1 + 0.05 * Math.max(cv - 7, 0)); const et = [`Base × (1 + 5 % × max(${cv} − 7, 0)) = ${fr(p)}`];
        if(age < 25){ p *= 1.5; et.push(`Âge ${age} < 25 : × 1,5 = ${fr(p)}`); }
        if(zone === 'Abidjan'){ p *= 1.2; et.push(`Zone Abidjan : × 1,2 = ${fr(p)}`); }
        return {
          enonce: `Avec la fonction PrimeAuto du cours (base 80 000 FCFA, +5 %/CV au-delà de 7, ×1,5 si < 25 ans, ×1,2 à Abidjan), que renvoie =PrimeAuto(${cv};${age};"${zone}") ?`,
          etapes: et,
          solution: `${fr(p)} FCFA.`,
        };
      },
      quiz(rnd, rndf){
        const n = rnd(10, 60) * 1000;
        return {
          q: `Pour classer ${fr(n)} sinistres en VBA, la méthode la plus rapide est :`,
          options: ['Charger la plage dans un tableau, calculer en mémoire, réécrire en un bloc', 'Boucler avec Range.Select sur chaque cellule', 'Recalculer le classeur à chaque ligne', 'Utiliser une formule par cellule écrite une à une'], a: 0,
          exp: 'Un seul échange feuille ↔ VBA dans chaque sens au lieu de ' + fr(n * 2) + '.',
        };
      },
      code(rnd, rndf){
        const seuil = rnd(1, 10) * 1e6;
        return {
          vba: `Sub ClasserSinistres()\n    Dim v As Variant, r() As Variant, n As Long, i As Long\n    n = Cells(Rows.Count, 3).End(xlUp).Row - 1\n    v = Range("C2").Resize(n, 1).Value\n    ReDim r(1 To n, 1 To 1)\n    For i = 1 To n\n        r(i, 1) = IIf(v(i, 1) > ${seuil}, "Grave", "Attritionnel")\n    Next i\n    Range("D2").Resize(n, 1).Value = r\nEnd Sub`,
          excel: `D2 =SI(C2>${seuil};"Grave";"Attritionnel")\nF1 (nb graves) =NB.SI(C:C;">${seuil}")\nF2 (part)      =SOMME.SI(C:C;">${seuil}")/SOMME(C:C)`,
          python: `import pandas as pd\nsin = pd.read_excel("sinistres.xlsx")\nsin["classe"] = (sin.montant > ${seuil}).map({True: "Grave", False: "Attritionnel"})\nprint(sin.classe.value_counts())`,
          r: `sin <- readxl::read_excel("sinistres.xlsx")\nsin$classe <- ifelse(sin$montant > ${seuil}, "Grave", "Attritionnel")\ntable(sin$classe)`,
        };
      },
    },

    // 21 Statistique non paramétrique — Spearman
    21: {
      exo(rnd, rndf){
        const n = rnd(5, 8), a = [...Array(n).keys()].map(i => i + 1), b = a.slice();
        for(let i = 0; i < n; i++){ const j = Math.min(n - 1, i + rnd(0, 2)); [b[i], b[j]] = [b[j], b[i]]; }
        const d2 = a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0), rho = 1 - 6 * d2 / (n * (n * n - 1));
        return {
          enonce: `Rangs de ${n} agences selon le chiffre d'affaires (${a.join(', ')}) et selon le ratio S/P (${b.join(', ')}). Calculer la corrélation de Spearman.`,
          etapes: [`dᵢ = ${a.map((v, i) => v - b[i]).join(', ')}`, `Σdᵢ² = ${d2}`, `ρ = 1 − 6×${d2}/(${n}×(${n}² − 1))`],
          solution: `ρ = ${fr(rho, 3)}.`,
        };
      },
      quiz(rnd, rndf){
        const n = rnd(20, 400), D = rndf(0.05, 0.25, 3), c = 1.36 / Math.sqrt(n);
        return {
          q: `Test de Kolmogorov-Smirnov : n = ${n}, D = ${fr(D, 3)}. Conclusion à 5 % ?`,
          options: D > c ? ['On rejette l\'adéquation', 'On ne rejette pas'] : ['On ne rejette pas l\'adéquation', 'On rejette'], a: 0,
          exp: `Valeur critique ≈ 1,36/√${n} = ${fr(c, 3)} ; D ${D > c ? '>' : '≤'} ${fr(c, 3)}.`,
        };
      },
      code(rnd, rndf){
        const n = rnd(20, 60), shift = rndf(0, 1.5, 1);
        return {
          python: `import numpy as np\nfrom scipy import stats\nrng = np.random.default_rng(1)\nA = rng.lognormal(12, 1, ${n}); B = rng.lognormal(12 + ${shift}, 1, ${n})\nprint(stats.mannwhitneyu(A, B))`,
          r: `set.seed(1); A <- rlnorm(${n}, 12, 1); B <- rlnorm(${n}, 12 + ${shift}, 1)\nwilcox.test(A, B)`,
          excel: `' Groupes empilés en A2:A${2 * n + 1}, étiquettes en B\nC2 =RANG.MOYEN(A2;$A$2:$A$${2 * n + 1};1)\nE1 (R_A) =SOMME.SI(B:B;"A";C:C)\nE2 (U)   =E1-${n}*(${n}+1)/2\nE3 (z)   =(E2-${n * n / 2})/RACINE(${n}*${n}*(${2 * n}+1)/12)`,
          vba: `' Voir KSExpo() dans l'onglet Code du cours pour le test de Kolmogorov-Smirnov`,
        };
      },
    },
  };
})();
