const { getStore } = require('@netlify/blobs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const crypto = require('crypto');

function blobStore(name) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) return getStore({ name, siteID, token });
  return getStore(name);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo (avant encodage base64)
const MAX_TEXT_CHARS = 18000; // texte envoyé à l'IA, tronqué au besoin

const PROMPT_TEMPLATE = (matiereTitre, texte) => {
  const contexte = matiereTitre ? 'Le document ci-dessous concerne la matière : "' + matiereTitre + '".' : '';
  return 'Tu es un assistant pédagogique pour un étudiant en Master 2 Gestion des Risques en Assurance et Finance (GRAF). ' + contexte + '\n\n' +
    'Analyse le document suivant et produis, en français, une réponse structurée en Markdown avec exactement ces sections :\n' +
    '## Résumé\n' +
    '(4 à 6 phrases résumant l\'essentiel du document)\n' +
    '## Notions clés\n' +
    '(liste à puces des notions/termes techniques importants, avec une courte définition chacun)\n' +
    '## Points à retenir pour l\'examen\n' +
    '(liste à puces des points les plus susceptibles d\'être évalués)\n\n' +
    'Reste concis, précis, et adapté au niveau Master 2 en actuariat/finance/gestion des risques.\n\n' +
    'Voici le contenu du document :\n---\n' + texte + '\n---';
};

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'GET') {
    const email = ((event.queryStringParameters || {}).email || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'invalid_email' }) };
    }
    const store = blobStore('m2graf-docs');
    const { blobs } = await store.list({ prefix: email + ':' });
    const docs = [];
    for (const b of blobs) {
      const rec = await store.get(b.key, { type: 'json' });
      if (rec) docs.push(rec);
    }
    docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docs }),
    };
  }

  if (method !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (process.env.VERIFY_MODE !== 'on') {
    return { statusCode: 500, body: JSON.stringify({ error: 'config' }) };
  }
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'config: GEMINI_API_KEY manquant' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  let { email, filename, fileBase64, matiereTitre } = body;
  if (!email || !EMAIL_RE.test(email) || !fileBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad_request' }) };
  }
  email = email.trim().toLowerCase();
  filename = (filename || 'document.pdf').slice(0, 200);

  let buffer;
  try {
    buffer = Buffer.from(fileBase64, 'base64');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_file' }) };
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ error: 'file_too_large' }) };
  }

  // Vérifie que le compte n'est pas bloqué (même logique que le reste de l'app)
  const studentsStore = blobStore('m2graf-students');
  const student = await studentsStore.get(email, { type: 'json' });
  if (student && student.blocked) {
    return { statusCode: 403, body: JSON.stringify({ error: 'blocked' }) };
  }

  const lowerName = filename.toLowerCase();
  const isDocx = lowerName.endsWith('.docx');
  const isPdf = lowerName.endsWith('.pdf');

  let texte;
  try {
    if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      texte = (result.value || '').trim();
    } else if (isPdf) {
      const parsed = await pdfParse(buffer);
      texte = (parsed.text || '').trim();
    } else {
      // Type non déterminé par l'extension : on tente PDF, puis DOCX en repli
      try {
        const parsed = await pdfParse(buffer);
        texte = (parsed.text || '').trim();
      } catch (e1) {
        const result = await mammoth.extractRawText({ buffer });
        texte = (result.value || '').trim();
      }
    }
  } catch (e) {
    console.error('Erreur extraction document:', e);
    return { statusCode: 400, body: JSON.stringify({ error: 'pdf_parse_failed' }) };
  }
  if (!texte) {
    return { statusCode: 400, body: JSON.stringify({ error: 'empty_pdf' }) };
  }
  if (texte.length > MAX_TEXT_CHARS) {
    texte = texte.slice(0, MAX_TEXT_CHARS) + '\\n\\n[... document tronqué ...]';
  }

  const prompt = PROMPT_TEMPLATE(matiereTitre, texte);

  let summary;
  try {
    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Erreur Gemini:', res.status, errBody);
      return { statusCode: 502, body: JSON.stringify({ error: 'ai_failed' }) };
    }
    const data = await res.json();
    summary = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!summary) {
      console.error('Réponse Gemini inattendue:', JSON.stringify(data));
      return { statusCode: 502, body: JSON.stringify({ error: 'ai_empty' }) };
    }
  } catch (e) {
    console.error('Erreur appel Gemini:', e);
    return { statusCode: 502, body: JSON.stringify({ error: 'ai_failed' }) };
  }

  const docId = crypto.randomBytes(8).toString('hex');
  const record = {
    id: docId,
    email,
    filename,
    matiereTitre: matiereTitre || null,
    summary,
    createdAt: new Date().toISOString(),
  };
  const docsStore = blobStore('m2graf-docs');
  await docsStore.set(email + ':' + docId, JSON.stringify(record));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc: record }),
  };
};
