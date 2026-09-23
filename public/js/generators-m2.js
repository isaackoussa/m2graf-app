// Générateurs d'exercices, de quiz et de code — Master 2 (ids alignés sur le contenu M2).
// Générateurs paramétrés d'exercices et de quiz numériques.
// Un générateur par matière (index aligné sur content.js), quand la matière s'y prête.
// Chaque générateur retourne { enonce, etapes:[...], solution, reponseNum } pour l'exercice,
// et { q, options:[...], a, exp } pour le quiz (options mélangées côté app).
// rnd(min,max) et rndf(min,max,dec) sont fournies par l'app (nombres aléatoires reproductibles par tirage).

window.GENERATORS_M2 = {
  // 0 Séries temporelles — lecture d'un test ADF
  0: {
    exo(rnd, rndf) {
      const stat = rndf(-3.5, -1.0, 2);
      const crit = rndf(-3.2, -2.6, 2);
      const stationnaire = stat < crit;
      return {
        enonce: `Un test de Dickey-Fuller augmenté donne une statistique de ${stat} pour une valeur critique à 5% de ${crit}. La série est-elle stationnaire ?`,
        etapes: [
          "Règle : on rejette H0 (non-stationnarité) si la statistique est INFÉRIEURE (plus négative) que la valeur critique.",
          `Ici, ${stat} ${stationnaire ? "<" : ">"} ${crit}.`,
        ],
        solution: stationnaire
          ? `${stat} < ${crit} : on rejette H0. La série est stationnaire, on peut directement ajuster un ARMA.`
          : `${stat} > ${crit} : on ne rejette pas H0. La série est non stationnaire, il faut la différencier (d=1) avant d'ajuster un ARIMA.`,
      };
    },
    quiz(rnd, rndf) {
      const stat = rndf(-3.5, -1.0, 2);
      const crit = rndf(-3.2, -2.6, 2);
      const stationnaire = stat < crit;
      return {
        q: `Statistique ADF = ${stat}, valeur critique à 5% = ${crit}. Que conclure ?`,
        options: [
          "La série est stationnaire, on rejette H0",
          "La série est non stationnaire, on ne rejette pas H0",
          "Le test est non concluant dans tous les cas",
          "Il faut ajouter une composante saisonnière"
        ],
        a: stationnaire ? 0 : 1,
        exp: stationnaire
          ? `${stat} < ${crit} : la statistique est plus négative que la valeur critique, on rejette H0.`
          : `${stat} > ${crit} : la statistique n'est pas assez négative, on ne rejette pas H0 (non-stationnarité).`,
      };
    },
    code(rnd, rndf) {
      const stat = rndf(-3.5, -1.0, 2);
      const crit = rndf(-3.2, -2.6, 2);
      return {
        python: `import numpy as np\nfrom statsmodels.tsa.stattools import adfuller\n\n# Exemple généré : statistique simulée = ${stat}, seuil = ${crit}\nadf_stat, pvalue = ${stat}, None\nprint(f"ADF = {adf_stat} vs seuil 5% = ${crit}")\nprint("Stationnaire" if adf_stat < ${crit} else "Non stationnaire -> différencier (d=1)")`,
        r: `# Exemple généré : statistique simulée = ${stat}, seuil = ${crit}\nadf_stat <- ${stat}\nseuil <- ${crit}\ncat(if (adf_stat < seuil) "Stationnaire" else "Non stationnaire -> différencier (d=1)", "\\n")`,
        excel: `' B1 = statistique ADF, B2 = valeur critique 5 %
B1  ${stat}
B2  ${crit}
B3  =SI(B1<B2;"Stationnaire : ARMA";"Non stationnaire : différencier (d=1)")`,
        vba: `Function ConclusionADF(stat As Double, crit As Double) As String
    If stat < crit Then ConclusionADF = "Stationnaire" Else ConclusionADF = "Non stationnaire -> d=1"
End Function
' =ConclusionADF(${stat};${crit})`,
      };
    },
  },

  // 1 Statistique des valeurs extrêmes — VaR par GPD
  1: {
    exo(rnd, rndf) {
      const u = rnd(50, 150) * 1000;
      const xi = rndf(0.15, 0.45, 2);
      const sigma = rnd(30, 70) * 1000;
      const n = rnd(500, 2000);
      const Nu = rnd(20, 60);
      const p = 0.995;
      const ratio = (n / Nu) * (1 - p);
      const facteur = Math.pow(ratio, -xi);
      const varP = u + (sigma / xi) * (facteur - 1);
      return {
        enonce: `On ajuste une GPD au-delà du seuil u = ${u.toLocaleString("fr-FR")} FCFA, avec ξ = ${xi} et σ = ${sigma.toLocaleString("fr-FR")}. Sur n = ${n} sinistres, Nu = ${Nu} dépassent le seuil. Calculer la VaR à 99,5%.`,
        etapes: [
          `n/Nu × (1-p) = (${n}/${Nu}) × 0,005 = ${ratio.toFixed(4)}`,
          `${ratio.toFixed(4)}^(-${xi}) ≈ ${facteur.toFixed(3)}`,
          `σ/ξ = ${sigma.toLocaleString("fr-FR")}/${xi} ≈ ${(sigma/xi).toFixed(0)}`,
        ],
        solution: `VaR99,5% ≈ ${Math.round(varP).toLocaleString("fr-FR")} FCFA.`,
      };
    },
    quiz(rnd, rndf) {
      const xi = rndf(-0.3, 0.5, 2);
      let domaine, correct;
      if (xi > 0.02) { domaine = "Fréchet (queue lourde)"; correct = 0; }
      else if (xi < -0.02) { domaine = "Weibull (support borné)"; correct = 2; }
      else { domaine = "Gumbel (décroissance exponentielle)"; correct = 1; }
      return {
        q: `Pour ξ̂ = ${xi}, dans quel domaine d'attraction se situe la distribution ?`,
        options: ["Domaine de Fréchet", "Domaine de Gumbel", "Domaine de Weibull", "Aucun domaine standard"],
        a: correct,
        exp: `ξ = ${xi} ${xi > 0.02 ? "> 0" : xi < -0.02 ? "< 0" : "≈ 0"} → domaine de ${domaine}.`,
      };
    },
    code(rnd, rndf) {
      const u = rnd(50, 150) * 1000;
      const xi = rndf(0.15, 0.45, 2);
      const sigma = rnd(30, 70) * 1000;
      return {
        python: `import numpy as np\n\nu, xi, sigma = ${u}, ${xi}, ${sigma}\nn, Nu, p = 1000, 40, 0.995\nvar_p = u + (sigma/xi) * (((n/Nu)*(1-p))**(-xi) - 1)\nprint(f"VaR 99.5% = {var_p:,.0f} FCFA")`,
        r: `u <- ${u}; xi <- ${xi}; sigma <- ${sigma}\nn <- 1000; Nu <- 40; p <- 0.995\nvar_p <- u + (sigma/xi) * (((n/Nu)*(1-p))^(-xi) - 1)\ncat("VaR 99.5% =", round(var_p), "FCFA\\n")`,
        excel: `' u B1, ξ B2, σ B3, n B4, Nu B5, p B6
B1 ${u}   B2 ${xi}   B3 ${sigma}   B4 1000   B5 40   B6 0,995
B7 (VaR) =B1+(B3/B2)*(((B4/B5)*(1-B6))^(-B2)-1)
B8 (ES)  =(B7+B3-B2*B1)/(1-B2)`,
        vba: `Function VaRGPD(u As Double, xi As Double, sigma As Double, n As Double, Nu As Double, p As Double) As Double
    VaRGPD = u + (sigma / xi) * (((n / Nu) * (1 - p)) ^ (-xi) - 1)
End Function
' =VaRGPD(${u};${xi};${sigma};1000;40;0,995)`,
      };
    },
  },

  // 2 Modélisation des actifs financiers — Black-Scholes
  2: {
    exo(rnd, rndf) {
      const S0 = rnd(80, 130);
      const K = rnd(80, 130);
      const r = rndf(0.02, 0.08, 3);
      const sigma = rndf(0.15, 0.35, 2);
      const T = rnd(1, 2);
      const d1 = (Math.log(S0/K) + (r + sigma*sigma/2)*T) / (sigma*Math.sqrt(T));
      const d2 = d1 - sigma*Math.sqrt(T);
      const Nd1 = normCdf(d1), Nd2 = normCdf(d2);
      const C0 = S0*Nd1 - K*Math.exp(-r*T)*Nd2;
      return {
        enonce: `Calculer le prix d'un call européen : S0=${S0}, K=${K}, r=${(r*100).toFixed(1)}%, σ=${(sigma*100).toFixed(0)}%, T=${T} an(s).`,
        etapes: [
          `d1 = [ln(${S0}/${K}) + (${(r*100).toFixed(1)}%+${(sigma*100).toFixed(0)}%²/2)×${T}] / (${(sigma*100).toFixed(0)}%×√${T}) ≈ ${d1.toFixed(3)}`,
          `d2 = d1 - σ√T ≈ ${d2.toFixed(3)}`,
          `N(d1) ≈ ${Nd1.toFixed(4)}, N(d2) ≈ ${Nd2.toFixed(4)}`,
        ],
        solution: `C0 = S0·N(d1) - K·e^(-rT)·N(d2) ≈ ${C0.toFixed(2)}`,
      };
    },
    quiz(rnd, rndf) {
      const sigmaUp = Math.random() < 0.5;
      return {
        q: `Toutes choses égales par ailleurs, si la volatilité σ augmente, le prix d'un call européen (Black-Scholes) :`,
        options: ["Augmente toujours", "Diminue toujours", "Reste inchangé", "Devient négatif"],
        a: 0,
        exp: "Le call est une option à Vega positif : sa valeur croît avec la volatilité, quelle que soit la direction du mouvement du sous-jacent.",
      };
    },
    code(rnd, rndf) {
      const S0 = rnd(80, 130);
      const K = rnd(80, 130);
      const r = rndf(0.02, 0.08, 3);
      const sigma = rndf(0.15, 0.35, 2);
      return {
        python: `import numpy as np\nfrom scipy.stats import norm\n\nS0, K, r, sigma, T = ${S0}, ${K}, ${r}, ${sigma}, 1\nd1 = (np.log(S0/K) + (r + sigma**2/2)*T) / (sigma*np.sqrt(T))\nd2 = d1 - sigma*np.sqrt(T)\nprix = S0*norm.cdf(d1) - K*np.exp(-r*T)*norm.cdf(d2)\nprint(f"Prix du call = {prix:.2f}")`,
        r: `S0 <- ${S0}; K <- ${K}; r <- ${r}; sigma <- ${sigma}; T <- 1\nd1 <- (log(S0/K) + (r + sigma^2/2)*T) / (sigma*sqrt(T))\nd2 <- d1 - sigma*sqrt(T)\nprix <- S0*pnorm(d1) - K*exp(-r*T)*pnorm(d2)\ncat("Prix du call =", round(prix,2), "\\n")`,
        excel: `' S0 B1, K B2, r B3, σ B4, T B5
B1 ${S0}   B2 ${K}   B3 ${r}   B4 ${sigma}   B5 1
B6 (d1)   =(LN(B1/B2)+(B3+B4^2/2)*B5)/(B4*RACINE(B5))
B7 (d2)   =B6-B4*RACINE(B5)
B8 (call) =B1*LOI.NORMALE.STANDARD.N(B6;VRAI)-B2*EXP(-B3*B5)*LOI.NORMALE.STANDARD.N(B7;VRAI)`,
        vba: `Function CallBS(S As Double, K As Double, r As Double, sigma As Double, T As Double) As Double
    Dim d1 As Double, d2 As Double
    d1 = (Log(S / K) + (r + sigma ^ 2 / 2) * T) / (sigma * Sqr(T)): d2 = d1 - sigma * Sqr(T)
    CallBS = S * Application.Norm_S_Dist(d1, True) - K * Exp(-r * T) * Application.Norm_S_Dist(d2, True)
End Function
' =CallBS(${S0};${K};${r};${sigma};1)`,
      };
    },
  },

  // 3 Modélisation des risques financiers — VaR paramétrique
  3: {
    exo(rnd, rndf) {
      const valeur = rnd(500, 2000) * 1_000_000;
      const vol = rndf(0.8, 2.5, 2);
      const conf = Math.random() < 0.5 ? 99 : 95;
      const z = conf === 99 ? 2.33 : 1.645;
      const varCalc = valeur * (vol/100) * z;
      return {
        enonce: `Portefeuille de ${valeur.toLocaleString("fr-FR")} FCFA, volatilité journalière ${vol}%. Calculer la VaR à 1 jour, confiance ${conf}% (z=${z}).`,
        etapes: [
          `VaR = Valeur × volatilité × z`,
          `= ${valeur.toLocaleString("fr-FR")} × ${vol}% × ${z}`,
        ],
        solution: `VaR${conf}% (1j) ≈ ${Math.round(varCalc).toLocaleString("fr-FR")} FCFA.`,
      };
    },
    quiz(rnd, rndf) {
      const attendu = rndf(0.5, 2, 1);
      const observe = rnd(Math.ceil(attendu*3), Math.ceil(attendu*3)+8);
      return {
        q: `Sur 250 jours à 99% de confiance, on attend environ ${(2.5).toFixed(1)} dépassements. On en observe ${observe}. Que conclure ?`,
        options: [
          "Le modèle sous-estime probablement le risque (trop de dépassements)",
          "Le modèle est parfaitement calibré",
          "Il faut augmenter le niveau de confiance à 99,9%",
          "Le nombre de dépassements est sans importance"
        ],
        a: observe > 4 ? 0 : 1,
        exp: observe > 4
          ? `${observe} dépassements observés contre ${(2.5).toFixed(1)} attendus : écart important, à confirmer par un test de Kupiec.`
          : `${observe} dépassements est proche de l'attendu (${(2.5).toFixed(1)}) : pas d'alerte évidente.`,
      };
    },
    code(rnd, rndf) {
      const valeur = rnd(500, 2000) * 1_000_000;
      const vol = rndf(0.8, 2.5, 2);
      return {
        python: `valeur, vol, z99 = ${valeur}, ${vol}/100, 2.33\nvar_param = valeur * vol * z99\nprint(f"VaR 99% (1j) = {var_param:,.0f} FCFA")`,
        r: `valeur <- ${valeur}; vol <- ${vol}/100; z99 <- 2.33\nvar_param <- valeur * vol * z99\ncat("VaR 99% (1j) =", format(var_param, big.mark=" "), "FCFA\\n")`,
        excel: `' Valeur B1, volatilité journalière B2
B1 ${valeur}   B2 ${vol}%
B3 (VaR 99 % 1j)  =B1*B2*LOI.NORMALE.STANDARD.INVERSE.N(0,99)
B4 (VaR 10j)      =B3*RACINE(10)
' VaR historique : =-CENTILE.INCLURE(rendements;0,01)*B1`,
        vba: `Function VaRParam(valeur As Double, vol As Double, niveau As Double, Optional jours As Integer = 1) As Double
    VaRParam = valeur * vol * Application.Norm_S_Inv(niveau) * Sqr(jours)
End Function
' =VaRParam(${valeur};${vol}/100;0,99)`,
      };
    },
  },

  // 4 Gestion multiple des risques — agrégation
  4: {
    exo(rnd, rndf) {
      const s1 = rnd(30, 80);
      const s2 = rnd(20, 60);
      const corr = rndf(0.1, 0.5, 2);
      const agrege = Math.sqrt(s1*s1 + s2*s2 + 2*corr*s1*s2);
      const benefice = (s1+s2) - agrege;
      return {
        enonce: `SCR module 1 = ${s1}, SCR module 2 = ${s2}, corrélation = ${corr}. Calculer le capital agrégé et le bénéfice de diversification.`,
        etapes: [
          `SCR_agrégé = √(${s1}² + ${s2}² + 2×${corr}×${s1}×${s2})`,
          `= √(${(s1*s1).toFixed(0)} + ${(s2*s2).toFixed(0)} + ${(2*corr*s1*s2).toFixed(1)})`,
        ],
        solution: `SCR agrégé ≈ ${agrege.toFixed(1)}, bénéfice de diversification ≈ ${benefice.toFixed(1)} (soit ${(benefice/(s1+s2)*100).toFixed(0)}% de la somme simple).`,
      };
    },
    quiz(rnd, rndf) {
      const corr = rndf(0, 1, 2);
      return {
        q: `Une corrélation réglementaire de ${corr} entre deux modules de risque, comparée à une corrélation de 1, produit un bénéfice de diversification :`,
        options: ["Plus faible (proche de 0 quand corr→1)", "Plus élevé", "Identique quelle que soit la corrélation", "Négatif"],
        a: 0,
        exp: "Plus la corrélation entre modules est proche de 1, plus l'agrégation se rapproche d'une simple somme : le bénéfice de diversification diminue.",
      };
    },
    code(rnd, rndf) {
      const s1 = rnd(30, 80);
      const s2 = rnd(20, 60);
      const corr = rndf(0.1, 0.5, 2);
      return {
        python: `import numpy as np\ns1, s2, corr = ${s1}, ${s2}, ${corr}\nagrege = np.sqrt(s1**2 + s2**2 + 2*corr*s1*s2)\nprint(f"SCR agrégé = {agrege:.1f}, bénéfice = {(s1+s2)-agrege:.1f}")`,
        r: `s1 <- ${s1}; s2 <- ${s2}; corr <- ${corr}\nagrege <- sqrt(s1^2 + s2^2 + 2*corr*s1*s2)\ncat("SCR agrégé =", round(agrege,1), " bénéfice =", round((s1+s2)-agrege,1), "\\n")`,
        excel: `' SCR1 B1, SCR2 B2, corrélation B3
B1 ${s1}   B2 ${s2}   B3 ${corr}
B4 (agrégé)     =RACINE(B1^2+B2^2+2*B3*B1*B2)
B5 (bénéfice)   =B1+B2-B4
' Forme matricielle : =RACINE(PRODUITMAT(PRODUITMAT(TRANSPOSE(SCR);CORR);SCR))`,
        vba: `Function SCRAgrege(scr As Range, corr As Range) As Double
    SCRAgrege = Sqr(Application.MMult(Application.MMult(Application.Transpose(scr), corr), scr)(1))
End Function`,
      };
    },
  },

  // 5 Allocation du capital économique — RAROC
  5: {
    exo(rnd, rndf) {
      const resultat = rnd(8, 25);
      const pertes = rnd(1, 6);
      const capital = rnd(30, 80);
      const hurdle = rndf(0.10, 0.20, 2);
      const raroc = (resultat - pertes) / capital;
      const creeValeur = raroc > hurdle;
      return {
        enonce: `Résultat attendu = ${resultat}, pertes attendues = ${pertes}, capital alloué = ${capital}, hurdle rate = ${(hurdle*100).toFixed(0)}%. Cette activité crée-t-elle de la valeur ?`,
        etapes: [
          `RAROC = (${resultat} - ${pertes}) / ${capital}`,
        ],
        solution: `RAROC = ${(raroc*100).toFixed(1)}% ${creeValeur ? ">" : "<"} hurdle rate (${(hurdle*100).toFixed(0)}%) → l'activité ${creeValeur ? "crée" : "détruit"} de la valeur.`,
      };
    },
    quiz(rnd, rndf) {
      const raroc = rndf(0.08, 0.30, 2);
      const hurdle = rndf(0.12, 0.18, 2);
      return {
        q: `RAROC = ${(raroc*100).toFixed(1)}%, hurdle rate = ${(hurdle*100).toFixed(1)}%. L'activité crée-t-elle de la valeur ?`,
        options: ["Oui, RAROC > hurdle rate", "Non, RAROC < hurdle rate", "Impossible à dire sans le SCR", "Oui, toujours"],
        a: raroc > hurdle ? 0 : 1,
        exp: `${(raroc*100).toFixed(1)}% ${raroc>hurdle?">":"<"} ${(hurdle*100).toFixed(1)}% : ${raroc>hurdle?"création":"destruction"} de valeur.`,
      };
    },
    code(rnd, rndf) {
      const resultat = rnd(8, 25);
      const pertes = rnd(1, 6);
      const capital = rnd(30, 80);
      return {
        python: `resultat, pertes, capital = ${resultat}, ${pertes}, ${capital}\nraroc = (resultat - pertes) / capital\nprint(f"RAROC = {raroc:.1%}")`,
        r: `resultat <- ${resultat}; pertes <- ${pertes}; capital <- ${capital}\nraroc <- (resultat - pertes) / capital\ncat("RAROC =", round(raroc*100,1), "%\\n")`,
        excel: `' Résultat B1, pertes attendues B2, capital B3, hurdle B4
B1 ${resultat}   B2 ${pertes}   B3 ${capital}   B4 15%
B5 (RAROC) =(B1-B2)/B3
B6 (EVA)   =B1-B2-B4*B3
B7         =SI(B5>B4;"Crée de la valeur";"Détruit de la valeur")`,
        vba: `Function RAROC(resultat As Double, pertes As Double, capital As Double) As Double
    RAROC = (resultat - pertes) / capital
End Function
' =RAROC(${resultat};${pertes};${capital})`,
      };
    },
  },

  // 6 Actuariat vie — prime pure
  6: {
    exo(rnd, rndf) {
      const Mx = rnd(1000, 1500);
      const Mxn = Mx - rnd(150, 350);
      const Nx = rnd(12000, 18000);
      const capital = rnd(5, 20) * 100000;
      const prime = (Mx - Mxn) / Nx * capital;
      return {
        enonce: `Mx = ${Mx}, Mx+n = ${Mxn}, Nx = ${Nx}. Calculer la prime pure d'une temporaire décès pour un capital de ${capital.toLocaleString("fr-FR")} FCFA.`,
        etapes: [
          `Prime pure = (Mx - Mx+n)/Nx × Capital`,
          `= (${Mx} - ${Mxn})/${Nx} × ${capital.toLocaleString("fr-FR")}`,
        ],
        solution: `Prime pure ≈ ${Math.round(prime).toLocaleString("fr-FR")} FCFA.`,
      };
    },
    quiz(rnd, rndf) {
      const chargement = rnd(2, 8);
      const pm = rnd(300, 800) * 1000;
      const rachat = pm * (1 - chargement/100);
      return {
        q: `Une PM de ${pm.toLocaleString("fr-FR")} FCFA a un chargement de rachat de ${chargement}%. Quelle est la valeur de rachat ?`,
        options: [
          `${Math.round(rachat).toLocaleString("fr-FR")} FCFA`,
          `${pm.toLocaleString("fr-FR")} FCFA`,
          `${Math.round(pm*(1+chargement/100)).toLocaleString("fr-FR")} FCFA`,
          "0 FCFA"
        ],
        a: 0,
        exp: `Valeur de rachat = PM × (1 - chargement) = ${pm.toLocaleString("fr-FR")} × ${(1-chargement/100).toFixed(2)} ≈ ${Math.round(rachat).toLocaleString("fr-FR")} FCFA.`,
      };
    },
    code(rnd, rndf) {
      const Mx = rnd(1000, 1500);
      const Mxn = Mx - rnd(150, 350);
      const Nx = rnd(12000, 18000);
      return {
        python: `Mx, Mxn, Nx = ${Mx}, ${Mxn}, ${Nx}\ncapital = 1_000_000\nprime = (Mx - Mxn) / Nx * capital\nprint(f"Prime pure = {prime:,.0f} FCFA")`,
        r: `Mx <- ${Mx}; Mxn <- ${Mxn}; Nx <- ${Nx}\ncapital <- 1000000\nprime <- (Mx - Mxn) / Nx * capital\ncat("Prime pure =", round(prime), "FCFA\\n")`,
        excel: `' Mx B1, Mx+n B2, Nx B3, capital B4
B1 ${Mx}   B2 ${Mxn}   B3 ${Nx}   B4 1000000
B5 (prime pure annuelle) =(B1-B2)/B3*B4
' Table de commutation : Dx =lx*v^x ; Cx =dx*v^(x+1) ; Mx =SOMME(Cx:C_omega) ; Nx =SOMME(Dx:D_omega)`,
        vba: `Function PrimeTemporaire(Mx As Double, Mxn As Double, Nx As Double, capital As Double) As Double
    PrimeTemporaire = (Mx - Mxn) / Nx * capital
End Function
' =PrimeTemporaire(${Mx};${Mxn};${Nx};1000000)`,
      };
    },
  },

  // 7 Actuariat non vie — Chain Ladder
  7: {
    exo(rnd, rndf) {
      const f = rndf(1.05, 1.30, 2);
      const paye = rnd(600, 1000);
      const projection = paye * f;
      const fUltime = rndf(1.02, 1.10, 2);
      const ultime = projection * fUltime;
      return {
        enonce: `Un facteur de développement f = ${f} s'applique à un montant cumulé de ${paye}. Projeter le développement suivant, puis la charge ultime avec un facteur f_ultime = ${fUltime}.`,
        etapes: [
          `Projection = ${paye} × ${f} = ${projection.toFixed(1)}`,
          `Charge ultime = ${projection.toFixed(1)} × ${fUltime}`,
        ],
        solution: `Charge ultime ≈ ${ultime.toFixed(1)}.`,
      };
    },
    quiz(rnd, rndf) {
      const paye = rnd(150, 300);
      const facteurCumule = rnd(3, 6);
      const ultimeApriori = rnd(800, 1200);
      const ultimeBF = paye + (1 - 1/facteurCumule) * ultimeApriori;
      const ultimeCL = paye * facteurCumule;
      return {
        q: `Payé = ${paye}, facteur cumulé = ${facteurCumule}, ultime a priori = ${ultimeApriori}. Quelle méthode donne le résultat le plus élevé ici : Chain Ladder (${ultimeCL}) ou Bornhuetter-Ferguson (${ultimeBF.toFixed(0)}) ?`,
        options: [
          ultimeCL > ultimeBF ? "Chain Ladder" : "Bornhuetter-Ferguson",
          ultimeCL > ultimeBF ? "Bornhuetter-Ferguson" : "Chain Ladder",
          "Les deux donnent exactement le même résultat",
          "Aucune des deux méthodes n'est calculable ici"
        ],
        a: 0,
        exp: `Chain Ladder = ${paye}×${facteurCumule} = ${ultimeCL}. BF = ${paye}+(1-1/${facteurCumule})×${ultimeApriori} = ${ultimeBF.toFixed(0)}.`,
      };
    },
    code(rnd, rndf) {
      const f = rndf(1.05, 1.30, 2);
      const paye = rnd(600, 1000);
      return {
        python: `f, paye = ${f}, ${paye}\nprojection = paye * f\nprint(f"Projection développement suivant = {projection:.1f}")`,
        r: `f <- ${f}; paye <- ${paye}\nprojection <- paye * f\ncat("Projection =", round(projection,1), "\\n")`,
        excel: `' Triangle cumulé en B2:G7 ; facteur de développement j→j+1 :
' =SOMME(C2:C6)/SOMME(B2:B6)   (sommes sur les lignes où les deux colonnes sont connues)
B10 ${f}   B11 ${paye}
B12 (projection) =B11*B10`,
        vba: `Function FacteurCL(colJ As Range, colJ1 As Range) As Double
    Dim i As Long, num As Double, den As Double
    For i = 1 To colJ.Rows.Count
        If colJ1.Cells(i, 1).Value <> "" Then num = num + colJ1.Cells(i, 1).Value: den = den + colJ.Cells(i, 1).Value
    Next i
    FacteurCL = num / den
End Function`,
      };
    },
  },

  // 8 Modèles de prévision — crédibilité
  8: {
    exo(rnd, rndf) {
      const n = rnd(20, 100);
      const k = rnd(150, 300);
      const indiv = rnd(300, 700) * 1000;
      const collectif = rnd(250, 450) * 1000;
      const Z = n / (n + k);
      const prime = Z*indiv + (1-Z)*collectif;
      return {
        enonce: `n = ${n} années d'exposition, k = ${k}, expérience individuelle = ${indiv.toLocaleString("fr-FR")}, expérience collective = ${collectif.toLocaleString("fr-FR")}. Calculer la prime crédibilisée.`,
        etapes: [
          `Z = n/(n+k) = ${n}/(${n}+${k}) = ${Z.toFixed(3)}`,
          `Prime = Z×individuel + (1-Z)×collectif`,
        ],
        solution: `Prime crédibilisée ≈ ${Math.round(prime).toLocaleString("fr-FR")} FCFA.`,
      };
    },
    quiz(rnd, rndf) {
      const n = rnd(10, 500);
      const k = 200;
      const Z = n / (n + k);
      return {
        q: `Avec n = ${n} années d'exposition et k = ${k}, le facteur de crédibilité Z est-il plutôt proche de 0 ou de 1 ?`,
        options: Z < 0.5 ? ["Proche de 0 (peu de crédibilité individuelle)", "Proche de 1 (forte crédibilité individuelle)"] : ["Proche de 1 (forte crédibilité individuelle)", "Proche de 0 (peu de crédibilité individuelle)"],
        a: 0,
        exp: `Z = ${n}/(${n}+${k}) = ${Z.toFixed(2)} : ${Z<0.5 ? "encore assez éloigné de 1, l'expérience collective domine" : "déjà relativement élevé, l'expérience individuelle pèse davantage"}.`,
      };
    },
    code(rnd, rndf) {
      const n = rnd(20, 100);
      const k = rnd(150, 300);
      const indiv = rnd(300, 700) * 1000;
      const collectif = rnd(250, 450) * 1000;
      return {
        python: `n, k, indiv, collectif = ${n}, ${k}, ${indiv}, ${collectif}\nZ = n / (n + k)\nprime = Z*indiv + (1-Z)*collectif\nprint(f"Z = {Z:.2f}, prime crédibilisée = {prime:,.0f}")`,
        r: `n <- ${n}; k <- ${k}; indiv <- ${indiv}; collectif <- ${collectif}\nZ <- n / (n + k)\nprime <- Z*indiv + (1-Z)*collectif\ncat("Z =", round(Z,2), " prime =", round(prime), "\\n")`,
        excel: `' n B1, k B2, individuel B3, collectif B4
B1 ${n}   B2 ${k}   B3 ${indiv}   B4 ${collectif}
B5 (Z)     =B1/(B1+B2)
B6 (prime) =B5*B3+(1-B5)*B4`,
        vba: `Function PrimeCredibilite(n As Double, k As Double, indiv As Double, collectif As Double) As Double
    Dim Z As Double: Z = n / (n + k)
    PrimeCredibilite = Z * indiv + (1 - Z) * collectif
End Function
' =PrimeCredibilite(${n};${k};${indiv};${collectif})`,
      };
    },
  },

  // 9 Théorie du risque — borne de Lundberg
  9: {
    exo(rnd, rndf) {
      const R = rndf(0.0002, 0.0008, 4);
      const u = rnd(20, 80) * 1_000_000;
      const produit = R * u;
      return {
        enonce: `Coefficient de Lundberg R = ${R}, réserve initiale u = ${u.toLocaleString("fr-FR")} FCFA. Donner la borne supérieure de la probabilité de ruine.`,
        etapes: [
          `R × u = ${R} × ${u.toLocaleString("fr-FR")} = ${produit.toFixed(0)}`,
        ],
        solution: `ψ(u) ≤ e^(-${produit.toFixed(0)}) ${produit > 15 ? "≈ 0 (ruine négligeable)" : `≈ ${Math.exp(-produit).toExponential(2)}`}.`,
      };
    },
    quiz(rnd, rndf) {
      const theta = rndf(0, 0.3, 2);
      const zero = theta === 0;
      return {
        q: `Une compagnie applique un chargement de sécurité θ = ${theta}. La ruine est-elle certaine à long terme (ψ(u)=1 pour tout u) ?`,
        options: [
          "Oui, la ruine est certaine (θ nul, aucune marge de sécurité)",
          "Non, la ruine n'est pas certaine (θ strictement positif)",
          "Cela dépend uniquement de la réserve initiale u",
          "Cela dépend uniquement de la loi des sinistres"
        ],
        a: zero ? 0 : 1,
        exp: zero
          ? "Avec θ = 0, aucune marge de sécurité n'est intégrée : la ruine est certaine (ψ(u)=1 pour tout u)."
          : `θ = ${theta} > 0 : la ruine n'est pas certaine, une réserve suffisante permet ψ(u) < 1.`,
      };
    },
    code(rnd, rndf) {
      const R = rndf(0.0002, 0.0008, 4);
      const u = rnd(20, 80) * 1_000_000;
      return {
        python: `import numpy as np\nR, u = ${R}, ${u}\nborne = np.exp(-R * u)\nprint(f"Borne de Lundberg : psi(u) <= {borne:.2e}")`,
        r: `R <- ${R}; u <- ${u}\nborne <- exp(-R * u)\ncat("Borne de Lundberg : psi(u) <=", format(borne, scientific=TRUE), "\\n")`,
        excel: `' R B1, u B2
B1 ${R}   B2 ${u}
B3 (borne de Lundberg) =EXP(-B1*B2)
' R se trouve avec la Valeur cible : 1+(1+θ)·μ·R = M_X(R)`,
        vba: `Function BorneLundberg(R As Double, u As Double) As Double
    BorneLundberg = Exp(-R * u)
End Function
' Coefficient d'ajustement pour sinistres exponentiels de moyenne mu : R = theta / ((1 + theta) * mu)`,
      };
    },
  },

  // 11 Bâle II — ratio McDonough
  11: {
    exo(rnd, rndf) {
      const fp = rnd(30, 60);
      const rwaCredit = rnd(300, 500);
      const rwaMarche = rnd(15, 40);
      const rwaOp = rnd(10, 30);
      const rwaTotal = rwaCredit + rwaMarche + rwaOp;
      const ratio = fp / rwaTotal;
      return {
        enonce: `Fonds propres = ${fp} Mds FCFA. RWA : crédit ${rwaCredit}, marché ${rwaMarche}, opérationnel ${rwaOp} (Mds FCFA). La banque est-elle conforme à Bâle II (min. 8%) ?`,
        etapes: [
          `RWA total = ${rwaCredit} + ${rwaMarche} + ${rwaOp} = ${rwaTotal}`,
          `Ratio = ${fp} / ${rwaTotal}`,
        ],
        solution: `Ratio McDonough = ${(ratio*100).toFixed(1)}% — ${ratio >= 0.08 ? "conforme" : "NON conforme"} (minimum 8%).`,
      };
    },
    quiz(rnd, rndf) {
      const fp = rnd(30, 60);
      const rwaTotal = rnd(350, 600);
      const ratio = fp / rwaTotal;
      return {
        q: `Fonds propres = ${fp}, RWA total = ${rwaTotal} (Mds FCFA). La banque respecte-t-elle le minimum de 8% ?`,
        options: [ratio >= 0.08 ? "Oui, ratio conforme" : "Non, ratio insuffisant", ratio >= 0.08 ? "Non, ratio insuffisant" : "Oui, ratio conforme", "Le minimum réglementaire est 12%", "Cela dépend uniquement du Pilier 2"],
        a: 0,
        exp: `Ratio = ${fp}/${rwaTotal} = ${(ratio*100).toFixed(1)}%, ${ratio>=0.08?"supérieur":"inférieur"} au seuil de 8%.`,
      };
    },
    code(rnd, rndf) {
      const fp = rnd(30, 60);
      const rwaCredit = rnd(300, 500);
      const rwaMarche = rnd(15, 40);
      const rwaOp = rnd(10, 30);
      return {
        python: `fp, rwa_credit, rwa_marche, rwa_op = ${fp}, ${rwaCredit}, ${rwaMarche}, ${rwaOp}\nrwa_total = rwa_credit + rwa_marche + rwa_op\nratio = fp / rwa_total\nprint(f"Ratio McDonough = {ratio:.1%} — conforme: {ratio >= 0.08}")`,
        r: `fp <- ${fp}; rwa_credit <- ${rwaCredit}; rwa_marche <- ${rwaMarche}; rwa_op <- ${rwaOp}\nrwa_total <- rwa_credit + rwa_marche + rwa_op\nratio <- fp / rwa_total\ncat("Ratio McDonough =", round(ratio*100,1), "% — conforme:", ratio >= 0.08, "\\n")`,
        excel: `' Fonds propres B1 ; RWA crédit B2, marché B3, opérationnel B4
B1 ${fp}   B2 ${rwaCredit}   B3 ${rwaMarche}   B4 ${rwaOp}
B5 (ratio)  =B1/SOMME(B2:B4)
B6          =SI(B5>=8%;"Conforme";"Non conforme")`,
        vba: `Function RatioMcDonough(fp As Double, rwa As Range) As Double
    RatioMcDonough = fp / Application.Sum(rwa)
End Function`,
      };
    },
  },

  // 12 Solvabilité II — ratio de solvabilité
  12: {
    exo(rnd, rndf) {
      const fp = rnd(80, 180);
      const scr = rnd(60, 140);
      const ratio = fp / scr;
      return {
        enonce: `Fonds propres éligibles = ${fp} Mds FCFA, SCR = ${scr} Mds FCFA. Calculer le ratio de solvabilité.`,
        etapes: [`Ratio = ${fp} / ${scr}`],
        solution: `Ratio de solvabilité ≈ ${(ratio*100).toFixed(0)}% — ${ratio >= 1 ? "au-dessus" : "en-dessous"} du seuil réglementaire de 100%.`,
      };
    },
    quiz(rnd, rndf) {
      const scr1 = rnd(30, 90);
      const scr2 = rnd(20, 70);
      const corr = rndf(0.1, 0.4, 2);
      const bscr = Math.sqrt(scr1*scr1 + scr2*scr2 + 2*corr*scr1*scr2);
      const somme = scr1+scr2;
      return {
        q: `SCR1=${scr1}, SCR2=${scr2}, corr=${corr}. Le BSCR agrégé (${bscr.toFixed(1)}) est-il inférieur à la somme simple (${somme}) ?`,
        options: ["Oui, toujours (effet de diversification)", "Non, il est toujours supérieur", "Seulement si corr > 0,5", "Seulement si les deux SCR sont égaux"],
        a: 0,
        exp: `BSCR = ${bscr.toFixed(1)} < ${somme} : l'agrégation par corrélation < 1 produit toujours un bénéfice de diversification.`,
      };
    },
    code(rnd, rndf) {
      const fp = rnd(80, 180);
      const scr = rnd(60, 140);
      return {
        python: `fp, scr = ${fp}, ${scr}\nratio = fp / scr\nprint(f"Ratio de solvabilité = {ratio:.0%}")`,
        r: `fp <- ${fp}; scr <- ${scr}\nratio <- fp / scr\ncat("Ratio de solvabilité =", round(ratio*100), "%\\n")`,
        excel: `' Fonds propres B1, SCR B2
B1 ${fp}   B2 ${scr}
B3 (ratio) =B1/B2
B4         =SI(B3>=1;"Au-dessus du seuil";"Sous le seuil de 100 %")`,
        vba: `Function RatioSolvabilite(fp As Double, scr As Double) As Double
    RatioSolvabilite = fp / scr
End Function
' =RatioSolvabilite(${fp};${scr})`,
      };
    },
  },
};

function normCdf(x) {
  // Approximation d'Abramowitz-Stegun de la fonction de répartition normale
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  let p = d * t * (0.3193815 + t*(-0.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274))));
  if (x > 0) p = 1 - p;
  return p;
}

