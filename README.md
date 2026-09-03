# M2 GRAF — déploiement sécurisé

Cette version protège le contenu des cours : les fiches, exercices, quiz et le
dictionnaire sont chiffrés (AES-256-GCM) dans `public/app.enc` et ne sont
déchiffrés, dans le navigateur, qu'après vérification par un code à 6 chiffres
envoyé par e-mail. Sans cette vérification, la clé de déchiffrement n'est
jamais transmise.

## Fichiers sensibles — à NE JAMAIS mettre sur GitHub public

- `APP_KEY.txt` — clé de déchiffrement du contenu (64 caractères hexadécimaux)
- `ADMIN_KEY.txt` — clé d'accès à la console admin

Garde-les de côté. Si tu perds APP_KEY.txt, il faudra régénérer le contenu
chiffré (relancer `node build.js`) : les anciens `app.enc` déployés ne seront
plus lisibles avec la nouvelle clé.

## Service d'envoi d'e-mail (Brevo)

L'envoi du code à 6 chiffres passe par Brevo (le même service que tu utilises
déjà pour SMC Lab — tu peux réutiliser le même compte et la même clé API).

1. Sur app.brevo.com → SMTP & API → API Keys, récupère ta clé API (ou
   crée-en une nouvelle pour ce projet).
2. Vérifie que l'adresse expéditrice que tu vas utiliser (MAIL_FROM) est
   validée dans Brevo → Senders, Domains & Dedicated IPs. Si tu as déjà
   validé une adresse pour SMC Lab, tu peux réutiliser exactement la même ici.

## Résumé de documents par IA (Gemini)

La section "Mes documents" (upload de PDF → résumé automatique) utilise
l'API Gemini de Google (le même service que tu utilises déjà pour
l'assistant IA de SMC Lab — tu peux réutiliser la même clé).

1. Sur aistudio.google.com → Get API key, récupère ta clé (ou réutilise
   celle déjà configurée pour SMC Lab).
2. Cette clé est gratuite (quota généreux) et ne demande pas de carte
   bancaire.

## Déploiement (GitHub → Netlify, comme tes autres apps)

1. Crée un dépôt GitHub avec tout le contenu de ce dossier (`public/`,
   `netlify/`, `netlify.toml`, `package.json`) — SAUF les deux fichiers
   `*_KEY.txt` ci-dessus.
2. Connecte ce dépôt à un nouveau site Netlify.
3. Dans Netlify → Site settings → Environment variables, ajoute :
   - `APP_KEY` = contenu de APP_KEY.txt (ne PAS cocher "secret", la fonction
     doit pouvoir la lire au runtime)
   - `ADMIN_KEY` = contenu de ADMIN_KEY.txt
   - `VERIFY_MODE` = `on`
   - `BREVO_API_KEY` = ta clé API Brevo
   - `MAIL_FROM` = l'adresse expéditrice validée dans Brevo (ex.
     davvpaul36@gmail.com si tu réutilises celle de SMC Lab)
   - `GEMINI_API_KEY` = ta clé API Gemini (pour le résumé de documents)
   - `NETLIFY_SITE_ID` = l'ID de CE site (Site settings → General →
     Site details → "Site ID")
   - `NETLIFY_BLOBS_TOKEN` = un token d'accès personnel Netlify (User
     settings → Applications → Personal access tokens → New access
     token). Ces deux dernières variables contournent un bug connu où
     Netlify n'injecte pas toujours automatiquement l'accès à Netlify
     Blobs dans les fonctions — sans elles, send-code/verify-code/resume/
     admin/summarize-doc échouent avec "MissingBlobsEnvironmentError".
4. Déploie. Netlify installera automatiquement `@netlify/blobs` et
   `pdf-parse` via `package.json`, et déploiera les fonctions dans
   `netlify/functions/`.

Tant que ces variables ne sont pas toutes configurées, personne ne peut
entrer — c'est le comportement voulu, pas une panne.

## Utilisation côté étudiant

1. L'étudiant entre son e-mail → un code à 6 chiffres lui est envoyé
   (valable 10 minutes, un seul essai possible par 30 secondes).
2. Il entre le code (5 tentatives maximum, ensuite il doit redemander un
   code) → le contenu se déchiffre dans son navigateur.
3. Un jeton est ensuite gardé sur son appareil pendant 90 jours : il n'a
   pas besoin de redemander un code à chaque visite, sauf s'il change
   d'appareil/navigateur ou efface ses données.
4. Si tu bloques son adresse dans la console admin, l'accès se referme
   immédiatement à sa prochaine visite (le jeton ne suffit plus).
5. La progression (matières lues, scores aux quiz) est propre à chaque e-mail.
6. Dans "Mes documents", il peut déposer un PDF (max 4 Mo) et obtenir un
   résumé structuré généré par IA (résumé, notions clés, points à retenir),
   avec un historique de ses documents déjà analysés. Seul le résumé est
   conservé côté serveur — le PDF original n'est jamais stocké.

## Console admin

Accessible sur `https://ton-site.netlify.app/admin.html`.

- Demande la clé admin (celle d'ADMIN_KEY.txt) une seule fois, gardée en
  mémoire de session (jamais dans l'URL ni les logs).
- Affiche pour chaque e-mail : nombre d'ouvertures, première/dernière visite,
  statut bloqué/actif.
- Un compte avec un nombre d'ouvertures anormalement élevé (au-delà de 60,
  surligné en rouge) peut signaler une adresse partagée entre plusieurs
  personnes — tu peux la bloquer d'un clic.
- Export CSV de la liste complète des comptes.

## Régénérer le contenu après une modification

Après avoir modifié `content.js`, `quiz.js`, `exercices.js`, `glossary.js`,
`codes.js` ou `generators.js`, relance :

    node build.js

Cela régénère `public/index.html`, `public/app.enc` et une **nouvelle**
APP_KEY à chaque fois. Pense à mettre à jour la variable Netlify `APP_KEY`
avec la nouvelle valeur après chaque reconstruction, sinon le contenu déployé
ne pourra plus être déchiffré.
