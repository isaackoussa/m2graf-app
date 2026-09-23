const { blobStore, httpMethod, rawBody, studentMasters, keysFor } = require('../lib/common');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours

exports.handler = async (event) => {
  if (httpMethod(event) !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (process.env.VERIFY_MODE !== 'on') {
    return { statusCode: 500, body: JSON.stringify({ error: 'config' }) };
  }

  let email, token;
  try {
    ({ email, token } = JSON.parse(rawBody(event)));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  if (!email || !EMAIL_RE.test(email) || !token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  email = email.trim().toLowerCase();

  const sessionsStore = blobStore('m2graf-sessions');
  const session = await sessionsStore.get(token, { type: 'json' });
  if (!session || session.email !== email) {
    return { statusCode: 401, body: JSON.stringify({ error: 'invalid_session' }) };
  }
  if (Date.now() - new Date(session.createdAt).getTime() > SESSION_MAX_AGE_MS) {
    await sessionsStore.delete(token);
    return { statusCode: 401, body: JSON.stringify({ error: 'expired_session' }) };
  }

  const studentsStore = blobStore('m2graf-students');
  let student = await studentsStore.get(email, { type: 'json' });
  const now = new Date().toISOString();
  if (!student) {
    student = { email, opens: 0, blocked: false, firstSeen: now, lastSeen: now };
  }
  if (student.blocked) {
    return { statusCode: 403, body: JSON.stringify({ error: 'blocked' }) };
  }
  const masters = studentMasters(student);
  if (!Array.isArray(student.masters)) student.masters = masters;
  const { keys, missing } = keysFor(masters);
  if (!Object.keys(keys).length) {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: ' + missing.join(', ') + ' manquant' }) };
  }
  student.opens = (student.opens || 0) + 1;
  student.lastSeen = now;
  await studentsStore.set(email, JSON.stringify(student));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys, masters }),
  };
};
