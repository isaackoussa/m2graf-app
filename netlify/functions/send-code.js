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
const CODE_TTL_MS = 10 * 60 * 1000;     // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000;   // 30 secondes entre deux envois

exports.handler = async (event) => {
  if (httpMethod(event) !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (process.env.VERIFY_MODE !== 'on') {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: VERIFY_MODE non actif' }) };
  }
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const MAIL_FROM = process.env.MAIL_FROM;
  if (!BREVO_API_KEY || !MAIL_FROM) {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: service mail non configuré' }) };
  }

  let email;
  try {
    ({ email } = JSON.parse(rawBody(event)));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_email' }) };
  }
  email = email.trim().toLowerCase();

  const codesStore = blobStore('m2graf-codes');
  const existing = await codesStore.get(email, { type: 'json' });
  const now = Date.now();
  if (existing && (now - existing.sentAt) < RESEND_COOLDOWN_MS) {
    return { statusCode: 429, body: JSON.stringify({ error: 'too_soon' }) };
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await codesStore.set(email, JSON.stringify({
    code, sentAt: now, expiresAt: now + CODE_TTL_MS, attempts: 0,
  }));
  console.log('send-code: email=', email, 'code généré=', code, 'siteID configuré=', !!process.env.NETLIFY_SITE_ID);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: MAIL_FROM, name: 'M2 GRAF' },
      to: [{ email }],
      subject: 'Ton code de connexion M2 GRAF',
      htmlContent:
        '<p>Voici ton code de connexion à M2 GRAF :</p>' +
        '<p style="font-size:28px;font-weight:bold;letter-spacing:4px;">' + code + '</p>' +
        '<p>Ce code est valable 10 minutes. Si tu n\'es pas à l\'origine de cette demande, ignore ce message.</p>',
    }),
  });

  if (!res.ok) {
    let details = '';
    try { details = await res.text(); } catch (e) {}
    console.error('Brevo send failed:', res.status, details);
    return { statusCode: 502, body: JSON.stringify({ error: 'mail_send_failed', brevoStatus: res.status, brevoBody: details }) };
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
};
