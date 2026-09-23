const { blobStore, httpMethod, rawBody, cleanMaster, studentMasters, keysFor } = require('../lib/common');
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

  // Bookkeeping élève (ouvertures, blocage, formation)
  const studentsStore = blobStore('m2graf-students');
  let student = await studentsStore.get(email, { type: 'json' });
  const now = new Date().toISOString();
  const chosen = cleanMaster(record.master);
  if (!student) {
    // Inscription : la formation choisie sur l'écran de connexion est enregistrée
    student = { email, opens: 0, blocked: false, firstSeen: now, lastSeen: now, masters: [chosen || 'M2'] };
  } else if (!Array.isArray(student.masters)) {
    // Compte antérieur au M1 : on enregistre le choix fait à cette connexion
    student.masters = [chosen || 'M2'];
  }
  if (student.blocked) {
    return { statusCode: 403, body: JSON.stringify({ error: 'blocked' }) };
  }
  const masters = studentMasters(student);
  const { keys, missing } = keysFor(masters);
  if (!Object.keys(keys).length) {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: ' + missing.join(', ') + ' manquant' }) };
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
    body: JSON.stringify({ keys, masters, token, requested: chosen }),
  };
};
