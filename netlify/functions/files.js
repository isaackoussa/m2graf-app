// Banque de fichiers partagés (annales, photos d'examens, TD, supports…)
// Chaque fichier est rattaché à une formation (M1 ou M2) et n'est visible que
// des étudiants inscrits à cette formation.
//
//   GET    /api/files                → liste des fichiers visibles
//   GET    /api/files?id=…           → contenu du fichier (binaire)
//   POST   /api/files                → dépôt { master, matiere, categorie, annee, titre, filename, mime, dataBase64 }
//   DELETE /api/files?id=…           → suppression (auteur du dépôt ou admin)
//
// Authentification : en-têtes x-email + x-token (session étudiant) ou x-admin-key.
const crypto = require('crypto');
const {
  blobStore, httpMethod, rawBody, headerValue, json,
  cleanMaster, studentMasters, checkSession, isAdmin, MASTERS,
} = require('../lib/common');

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 Mo (la requête Netlify est limitée à 6 Mo encodée)
const MAX_FILES_PER_USER = 60;
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel.sheet.macroEnabled.12': 'xlsm',
  'text/plain': 'txt',
  'text/csv': 'csv',
};
const CATEGORIES = ['Examen', 'Rattrapage', 'Partiel / Devoir', 'TD / Exercices', 'Cours / Support', 'Corrigé', 'Autre'];

function clip(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }

async function whoIs(event) {
  if (isAdmin(event)) return { admin: true, email: 'admin', masters: MASTERS.slice() };
  const email = headerValue(event, 'x-email');
  const token = headerValue(event, 'x-token');
  const s = await checkSession(email, token);
  if (s.error) return s;
  return { admin: false, email: s.email, masters: studentMasters(s.student) };
}

exports.handler = async (event) => {
  const method = httpMethod(event);
  const who = await whoIs(event);
  if (who.error) return json(who.status, { error: who.error });

  const meta = blobStore('mastergraf-files-meta');
  const data = blobStore('mastergraf-files-data');
  const qs = event.queryStringParameters || {};

  if (method === 'GET' && qs.id) {
    const rec = await meta.get(String(qs.id), { type: 'json' });
    if (!rec || !who.masters.includes(rec.master)) return json(404, { error: 'not_found' });
    const buf = await data.get(rec.id, { type: 'arrayBuffer' });
    if (!buf) return json(404, { error: 'not_found' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': rec.mime,
        'Content-Disposition': 'inline; filename="' + rec.filename.replace(/[^\w.\- ]/g, '_') + '"',
        'Cache-Control': 'private, max-age=3600',
      },
      body: Buffer.from(buf).toString('base64'),
      isBase64Encoded: true,
    };
  }

  if (method === 'GET') {
    const { blobs } = await meta.list();
    const files = [];
    for (const b of blobs) {
      const rec = await meta.get(b.key, { type: 'json' });
      if (rec && who.masters.includes(rec.master)) {
        files.push({ ...rec, mine: who.admin || rec.uploader === who.email, uploader: who.admin ? rec.uploader : undefined });
      }
    }
    files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(200, { files, categories: CATEGORIES });
  }

  if (method === 'POST') {
    let body;
    try { body = JSON.parse(rawBody(event)); } catch (e) { return json(400, { error: 'bad_request' }); }
    const master = cleanMaster(body.master);
    if (!master || !who.masters.includes(master)) return json(403, { error: 'master_not_allowed' });
    const mime = clip(body.mime, 120).toLowerCase();
    if (!ALLOWED_MIME[mime]) return json(415, { error: 'type_not_allowed' });
    if (!body.dataBase64) return json(400, { error: 'bad_request' });
    const buf = Buffer.from(String(body.dataBase64), 'base64');
    if (!buf.length) return json(400, { error: 'empty_file' });
    if (buf.length > MAX_FILE_BYTES) return json(413, { error: 'file_too_large' });

    if (!who.admin) {
      const { blobs } = await meta.list();
      let count = 0;
      for (const b of blobs) {
        const rec = await meta.get(b.key, { type: 'json' });
        if (rec && rec.uploader === who.email) count++;
      }
      if (count >= MAX_FILES_PER_USER) return json(429, { error: 'quota' });
    }

    const id = crypto.randomBytes(9).toString('hex');
    const categorie = CATEGORIES.includes(body.categorie) ? body.categorie : 'Autre';
    const rec = {
      id,
      master,
      matiere: clip(body.matiere, 160) || null,
      categorie,
      annee: clip(body.annee, 20) || null,
      titre: clip(body.titre, 160) || clip(body.filename, 160) || 'Fichier',
      filename: clip(body.filename, 200) || ('fichier.' + ALLOWED_MIME[mime]),
      mime,
      size: buf.length,
      uploader: who.email,
      createdAt: new Date().toISOString(),
    };
    await data.set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
    await meta.set(id, JSON.stringify(rec));
    return json(200, { file: { ...rec, mine: true } });
  }

  if (method === 'DELETE') {
    const id = String(qs.id || '');
    const rec = id && await meta.get(id, { type: 'json' });
    if (!rec) return json(404, { error: 'not_found' });
    if (!who.admin && rec.uploader !== who.email) return json(403, { error: 'forbidden' });
    await data.delete(id);
    await meta.delete(id);
    return json(200, { ok: true });
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
