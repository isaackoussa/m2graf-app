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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours

exports.handler = async (event) => {
  if (httpMethod(event) !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (process.env.VERIFY_MODE !== 'on') {
    return { statusCode: 500, body: JSON.stringify({ error: 'config' }) };
  }
  const APP_KEY = process.env.APP_KEY;
  if (!APP_KEY) {
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
  student.opens = (student.opens || 0) + 1;
  student.lastSeen = now;
  await studentsStore.set(email, JSON.stringify(student));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: APP_KEY }),
  };
};
