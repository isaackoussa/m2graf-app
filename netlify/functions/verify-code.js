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
const crypto = require('crypto');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 5;

exports.handler = async (event) => {
  if (httpMethod(event) !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (process.env.VERIFY_MODE !== 'on') {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: VERIFY_MODE non actif' }) };
  }
  const APP_KEY = process.env.APP_KEY;
  if (!APP_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: APP_KEY manquant' }) };
  }

  let email, code;
  try {
    ({ email, code } = JSON.parse(rawBody(event)));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  if (!email || !EMAIL_RE.test(email) || !code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  email = email.trim().toLowerCase();
  code = String(code).trim();

  const codesStore = blobStore('m2graf-codes');
  const record = await codesStore.get(email, { type: 'json' });
  console.log('verify-code: email=', email, 'code reçu=', code, 'record trouvé=', JSON.stringify(record));
  if (!record) {
    return { statusCode: 400, body: JSON.stringify({ error: 'no_code' }) };
  }
  if (Date.now() > record.expiresAt) {
    console.log('verify-code: expiré — now=', Date.now(), 'expiresAt=', record.expiresAt);
    await codesStore.delete(email);
    return { statusCode: 400, body: JSON.stringify({ error: 'expired' }) };
  }
  if ((record.attempts || 0) >= MAX_ATTEMPTS) {
    await codesStore.delete(email);
    return { statusCode: 429, body: JSON.stringify({ error: 'too_many_attempts' }) };
  }
  if (record.code !== code) {
    console.log('verify-code: code différent — attendu=', record.code, 'reçu=', code);
    record.attempts = (record.attempts || 0) + 1;
    await codesStore.set(email, JSON.stringify(record));
    return { statusCode: 400, body: JSON.stringify({ error: 'wrong_code' }) };
  }

  // Code correct : code à usage unique, on le supprime
  await codesStore.delete(email);

  // Bookkeeping élève (ouvertures, blocage)
  const studentsStore = blobStore('m2graf-students');
  let student = await studentsStore.get(email, { type: 'json' });
  const now = new Date().toISOString();
  if (!student) {
    student = { email, opens: 0, blocked: false, firstSeen: now, lastSeen: now };
  }
  if (student.blocked) {
    return { statusCode: 403, body: JSON.stringify({ error: 'blocked' }) };
  }
  student.opens = (student.opens || 0) + 1;
  student.lastSeen = now;
  await studentsStore.set(email, JSON.stringify(student));

  // Jeton de session longue durée (évite de redemander un code à chaque visite)
  const token = crypto.randomBytes(24).toString('hex');
  const sessionsStore = blobStore('m2graf-sessions');
  await sessionsStore.set(token, JSON.stringify({ email, createdAt: now }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: APP_KEY, token }),
  };
};
