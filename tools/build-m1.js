#!/usr/bin/env node
// Construit le contenu chiffré du Master 1.
//
//   node tools/build-m1.js           → chiffre tools/m1/ vers public/app-m1.enc
//                                      et sauvegarde les sources chiffrées dans tools/m1-sources.enc
//   node tools/build-m1.js --unpack  → restaure tools/m1/ à partir de tools/m1-sources.enc
//
// Clé : variable d'environnement APP_KEY_M1, sinon fichier APP_KEY_M1.txt à la racine
// (créé automatiquement au premier build). Même format que APP_KEY : 64 caractères hexadécimaux.
// Le dépôt étant public, les sources en clair (tools/m1/) ne sont jamais commitées.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(__dirname, 'm1');
const KEY_FILE = path.join(ROOT, 'APP_KEY_M1.txt');
const OUT_ENC = path.join(ROOT, 'public', 'app-m1.enc');
const SRC_ENC = path.join(__dirname, 'm1-sources.enc');

function loadKey(create) {
  let hex = (process.env.APP_KEY_M1 || '').trim();
  if (!hex && fs.existsSync(KEY_FILE)) hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
  if (!hex && create) {
    hex = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(KEY_FILE, hex + '\n');
    console.log('Nouvelle clé créée dans APP_KEY_M1.txt — à copier dans la variable Netlify APP_KEY_M1.');
  }
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Clé APP_KEY_M1 absente ou invalide (64 caractères hexadécimaux attendus).');
  return Buffer.from(hex, 'hex');
}

// Format identique à app.enc : base64( iv[12] || ciphertext || tag[16] ), attendu par Web Crypto
function encrypt(key, text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString('base64');
}
function decrypt(key, b64) {
  const raw = Buffer.from(b64.trim(), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString('utf8');
}

function validate({ items, glossary }) {
  const errs = [];
  items.forEach((m, i) => {
    const where = 'matière ' + m.id + ' (' + m.titre + ')';
    if (m.id !== i) errs.push('ids non consécutifs à la position ' + i);
    for (const k of ['semestre', 'titre', 'ue', 'objectifs', 'sections', 'exercices', 'quiz', 'code']) {
      if (m[k] == null) errs.push(where + ' : champ ' + k + ' manquant');
    }
    (m.quiz || []).forEach((q, j) => {
      if (!(q.a >= 0 && q.a < q.options.length)) errs.push(where + ' : quiz ' + j + ' réponse hors bornes');
    });
    (m.exercices || []).forEach((e, j) => {
      if (!e.enonce || !Array.isArray(e.etapes) || !e.solution) errs.push(where + ' : exercice ' + j + ' incomplet');
    });
  });
  glossary.forEach(g => (g.mats || []).forEach(id => {
    if (!items[id]) errs.push('glossaire « ' + g.terme + ' » : matière ' + id + ' inconnue');
  }));
  if (errs.length) throw new Error('Contenu invalide :\n  ' + errs.join('\n  '));
}

function build() {
  const key = loadKey(true);
  delete require.cache[require.resolve(path.join(SRC_DIR, 'index.js'))];
  const data = require(path.join(SRC_DIR, 'index.js'));
  validate(data);
  fs.writeFileSync(OUT_ENC, encrypt(key, JSON.stringify(data)));

  const sources = {};
  for (const f of fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js')).sort()) {
    sources[f] = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  }
  fs.writeFileSync(SRC_ENC, encrypt(key, JSON.stringify(sources)));

  const nQuiz = data.items.reduce((a, m) => a + m.quiz.length, 0);
  const nExo = data.items.reduce((a, m) => a + m.exercices.length, 0);
  console.log(`OK : ${data.items.length} matières, ${nExo} exercices, ${nQuiz} questions, ${data.glossary.length} termes.`);
  console.log('→ public/app-m1.enc et tools/m1-sources.enc régénérés.');
}

function unpack() {
  const key = loadKey(false);
  const sources = JSON.parse(decrypt(key, fs.readFileSync(SRC_ENC, 'utf8')));
  fs.mkdirSync(SRC_DIR, { recursive: true });
  for (const [f, txt] of Object.entries(sources)) fs.writeFileSync(path.join(SRC_DIR, f), txt);
  console.log('Sources restaurées dans tools/m1/ : ' + Object.keys(sources).join(', '));
}

if (process.argv.includes('--unpack')) unpack(); else build();
