#!/usr/bin/env node
// Outil de modification du contenu du Master 2 (sans les sources d'origine).
//
//   node tools/build-m2.js --import   → déchiffre public/app.enc vers tools/m2/contenu.json (à modifier)
//   node tools/build-m2.js            → rechiffre tools/m2/contenu.json vers public/app.enc
//                                        et sauvegarde les sources chiffrées dans tools/m2-sources.enc
//   node tools/build-m2.js --unpack   → restaure tools/m2/contenu.json depuis tools/m2-sources.enc
//
// Clé : variable d'environnement APP_KEY, sinon fichier APP_KEY.txt à la racine.
// C'est la MÊME clé que celle configurée sur Netlify : rien à changer après un build.
// Le dépôt étant public, tools/m2/ (en clair) n'est jamais commité.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(__dirname, 'm2');
const SRC_FILE = path.join(SRC_DIR, 'contenu.json');
const KEY_FILE = path.join(ROOT, 'APP_KEY.txt');
const ENC = path.join(ROOT, 'public', 'app.enc');
const SRC_ENC = path.join(__dirname, 'm2-sources.enc');

function loadKey() {
  let hex = (process.env.APP_KEY || '').trim();
  if (!hex && fs.existsSync(KEY_FILE)) hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('Clé APP_KEY absente ou invalide : mets-la dans APP_KEY.txt (racine du projet) ou dans la variable APP_KEY.');
  }
  return Buffer.from(hex, 'hex');
}
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
  if (!Array.isArray(items) || !items.length) errs.push('items manquant');
  (items || []).forEach((m, i) => {
    const where = 'matière ' + m.id + ' (' + m.titre + ')';
    if (m.id !== i) errs.push('ids non consécutifs à la position ' + i + ' (les graphiques et générateurs dépendent de ces ids)');
    for (const k of ['semestre', 'titre', 'sections', 'exercices', 'quiz']) if (m[k] == null) errs.push(where + ' : champ ' + k + ' manquant');
    (m.quiz || []).forEach((q, j) => { if (!(q.a >= 0 && q.a < q.options.length)) errs.push(where + ' : quiz ' + j + ' réponse hors bornes'); });
  });
  (glossary || []).forEach(g => (g.mats || []).forEach(id => { if (!items[id]) errs.push('glossaire « ' + g.terme + ' » : matière ' + id + ' inconnue'); }));
  if (errs.length) throw new Error('Contenu invalide :\n  ' + errs.join('\n  '));
}

function importEnc() {
  const key = loadKey();
  let data;
  try { data = JSON.parse(decrypt(key, fs.readFileSync(ENC, 'utf8'))); }
  catch (e) { throw new Error('Impossible de déchiffrer public/app.enc : la clé ne correspond pas à ce fichier.'); }
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.writeFileSync(SRC_FILE, JSON.stringify(data, null, 2));
  console.log(`Contenu M2 extrait (${data.items.length} matières) → tools/m2/contenu.json`);
}

function build() {
  const key = loadKey();
  const data = JSON.parse(fs.readFileSync(SRC_FILE, 'utf8'));
  validate(data);
  const json = JSON.stringify(data);
  fs.writeFileSync(ENC, encrypt(key, json));
  fs.writeFileSync(SRC_ENC, encrypt(key, json));
  const n = k => data.items.reduce((a, m) => a + (m[k] || []).length, 0);
  console.log(`OK : ${data.items.length} matières, ${n('exercices')} exercices, ${n('quiz')} questions, ${(data.glossary || []).length} termes.`);
  console.log('→ public/app.enc et tools/m2-sources.enc régénérés (même clé APP_KEY, rien à changer sur Netlify).');
}

function unpack() {
  const key = loadKey();
  fs.mkdirSync(SRC_DIR, { recursive: true });
  fs.writeFileSync(SRC_FILE, JSON.stringify(JSON.parse(decrypt(key, fs.readFileSync(SRC_ENC, 'utf8'))), null, 2));
  console.log('Sources restaurées dans tools/m2/contenu.json');
}

if (process.argv.includes('--import')) importEnc();
else if (process.argv.includes('--unpack')) unpack();
else build();
