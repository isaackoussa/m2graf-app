// Fonctions partagées par les fonctions Netlify de MasterGraf.
const { getStore } = require('@netlify/blobs');

function blobStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

function httpMethod(event) {
  return event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method) || '';
}
function rawBody(event) {
  if (!event.body) return '{}';
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
}
function headerValue(event, name) {
  const headers = event.headers || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}
function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours

// ---- Masters ----
// M2 = contenu historique (public/app.enc, clé APP_KEY)
// M1 = contenu Master 1 (public/app-m1.enc, clé APP_KEY_M1)
const MASTERS = ['M1', 'M2'];

function cleanMaster(m) {
  m = String(m || '').toUpperCase();
  return MASTERS.includes(m) ? m : null;
}

// Les comptes créés avant l'arrivée du M1 n'ont pas de champ "masters" : ils étaient tous en M2.
function studentMasters(student) {
  if (!student || !Array.isArray(student.masters)) return ['M2'];
  const list = student.masters.map(cleanMaster).filter(Boolean);
  return list.length ? list : ['M2'];
}

const KEY_ENV = { M1: 'APP_KEY_M1', M2: 'APP_KEY' };

// Clés de déchiffrement des formations auxquelles l'étudiant a droit.
// Retourne { keys, missing } — missing liste les variables d'environnement absentes.
function keysFor(masters) {
  const keys = {};
  const missing = [];
  for (const m of masters) {
    const v = process.env[KEY_ENV[m]];
    if (v) keys[m] = v; else missing.push(KEY_ENV[m]);
  }
  return { keys, missing };
}

// Vérifie un couple (email, jeton de session). Retourne { email, student } ou { error, status }.
async function checkSession(email, token) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || !token) return { status: 401, error: 'invalid_session' };
  const sessionsStore = blobStore('m2graf-sessions');
  const session = await sessionsStore.get(String(token), { type: 'json' });
  if (!session || session.email !== email) return { status: 401, error: 'invalid_session' };
  if (Date.now() - new Date(session.createdAt).getTime() > SESSION_MAX_AGE_MS) {
    await sessionsStore.delete(String(token));
    return { status: 401, error: 'expired_session' };
  }
  const student = await blobStore('m2graf-students').get(email, { type: 'json' });
  if (student && student.blocked) return { status: 403, error: 'blocked' };
  return { email, student };
}

function isAdmin(event) {
  const k = headerValue(event, 'x-admin-key');
  return !!(process.env.ADMIN_KEY && k && k === process.env.ADMIN_KEY);
}

module.exports = {
  blobStore, httpMethod, rawBody, headerValue, json,
  EMAIL_RE, SESSION_MAX_AGE_MS, MASTERS, cleanMaster, studentMasters, keysFor,
  checkSession, isAdmin,
};
