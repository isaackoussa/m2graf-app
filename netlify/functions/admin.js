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

exports.handler = async (event) => {
  const adminKey = headerValue(event, 'x-admin-key');
  if (!process.env.ADMIN_KEY || adminKey !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'unauthorized' }) };
  }

  const store = blobStore('m2graf-students');

  if (httpMethod(event) === 'GET') {
    const { blobs } = await store.list();
    const records = [];
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: 'json' });
      if (rec) records.push(rec);
    }
    records.sort((a, b) => (b.opens || 0) - (a.opens || 0));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    };
  }

  if (httpMethod(event) === 'POST') {
    let body;
    try { body = JSON.parse(rawBody(event)); }
    catch (e) { return { statusCode: 400, body: 'bad request' }; }

    const { email, action } = body;
    if (!email || !['block', 'unblock'].includes(action)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
    }
    const key = email.trim().toLowerCase();
    let record = await store.get(key, { type: 'json' });
    if (!record) return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };
    record.blocked = action === 'block';
    await store.set(key, JSON.stringify(record));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, record }),
    };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
