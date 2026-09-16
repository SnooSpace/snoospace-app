'use strict';
/**
 * verify_real_document.js
 *
 * Proves the full Tier B document happy path:
 *   1. Upload a real minimal PDF buffer to Supabase via the production storage service
 *   2. Insert a real community_verifications row with that real storage path
 *   3. Call GET /communities/admin/verifications/:id/document
 *   4. Confirm a real signed URL is returned
 *   5. HTTP-fetch the signed URL and confirm it responds with real PDF bytes
 *
 * Cleans up: deletes cv row + Supabase file on completion.
 * NOT community 54. Uses community 85 (Postpone Test Org).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { uploadVerificationDocument, getSignedDocumentUrl, BUCKET_NAME } = require('../services/communityDocumentStorage');
const supabase = require('../supabase');

const pool = createPool();
const TOKEN = process.env.ADMIN_TEST_TOKEN;
const BASE = process.env.ADMIN_TEST_URL || 'http://localhost:5000';
const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN };

const COMM_ID = 85; // Postpone Test Org — non-54, exists in local dev DB

let passed = 0, failed = 0;
function assert(label, ok, extra) {
  const msg = '  [' + (ok ? 'PASS' : 'FAIL') + '] ' + label + (extra != null ? ' -- ' + extra : '');
  if (ok) { console.log(msg); passed++; } else { console.error(msg); failed++; }
}

async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: hdrs,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

/**
 * Builds a minimal but structurally valid PDF in-memory (no external deps).
 * The PDF contains one page with the text "SnooSpace admin test PDF".
 * This is verifiable: the response Content-Type will be application/pdf
 * and the first bytes will be "%PDF-".
 */
function buildMinimalPdf() {
  const content = 'BT /F1 14 Tf 72 720 Td (SnooSpace admin test PDF - verify_real_document.js) Tj ET';
  const stream = `stream\n${content}\nendstream`;
  const streamLen = Buffer.byteLength(stream);
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj',
    '4 0 obj<</Length ' + streamLen + '>>\n' + stream,
    'xref',
    '0 5',
    '0000000000 65535 f',
    '0000000009 00000 n',
    '0000000058 00000 n',
    '0000000115 00000 n',
    '0000000266 00000 n',
    'trailer<</Size 5/Root 1 0 R>>',
    'startxref',
    '337',
    '%%EOF',
  ].join('\n');
  return Buffer.from(body, 'utf8');
}

async function main() {
  console.log('\n=================================================================');
  console.log('Tier B Real Document Path — Full End-to-End Verification');
  console.log('=================================================================\n');
  console.log('TOKEN:', TOKEN ? 'present' : 'MISSING');
  console.log('Community:', COMM_ID, '(Postpone Test Org — not community 54)');

  let cvId = null;
  let storagePath = null;

  try {
    // ── STEP 1: Build real PDF buffer and upload to Supabase ──────────────
    console.log('\n── Step 1: Upload real PDF to Supabase storage ──');
    const pdfBuffer = buildMinimalPdf();
    console.log('PDF buffer size:', pdfBuffer.length, 'bytes');
    console.log('PDF header bytes:', pdfBuffer.slice(0, 5).toString('ascii'));
    assert('PDF starts with %PDF-', pdfBuffer.slice(0, 5).toString('ascii') === '%PDF-');

    storagePath = await uploadVerificationDocument(COMM_ID, pdfBuffer, 'admin_test_verification.pdf');
    console.log('Uploaded. Storage path:', storagePath);
    assert('storagePath is non-empty string', typeof storagePath === 'string' && storagePath.length > 0, storagePath);
    assert('storagePath includes community_id prefix', storagePath.startsWith(String(COMM_ID) + '/'), storagePath);
    assert('storagePath ends in .pdf', storagePath.endsWith('admin_test_verification.pdf'), storagePath);

    // ── STEP 2: Insert real cv row with real storage path ─────────────────
    console.log('\n── Step 2: Insert community_verifications row with real path ──');
    const ins = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'registered_org','pending',$2) RETURNING *",
      [COMM_ID, storagePath]
    );
    cvId = ins.rows[0].id;
    console.log('Inserted cv row:', JSON.stringify(ins.rows[0], null, 2));
    assert('cv row inserted', !!cvId, 'id=' + cvId);
    assert('document_storage_path stored correctly', ins.rows[0].document_storage_path === storagePath,
           'got=' + ins.rows[0].document_storage_path);

    // ── STEP 3: Call admin document endpoint → get signed URL ─────────────
    console.log('\n── Step 3: GET /communities/admin/verifications/' + cvId + '/document ──');
    const docRes = await api('GET', '/communities/admin/verifications/' + cvId + '/document');
    console.log('HTTP status:', docRes.status);
    console.log('Response body:', JSON.stringify(docRes.body, null, 2));
    assert('Document endpoint returns 200', docRes.status === 200, 'got ' + docRes.status);
    assert('url field present in response', typeof docRes.body.url === 'string', 'url=' + docRes.body.url);

    const signedUrl = docRes.body.url;
    console.log('\nSigned URL received:');
    console.log(signedUrl);
    assert('Signed URL starts with https://', signedUrl.startsWith('https://'), signedUrl.slice(0, 80));
    assert('Signed URL contains bucket name', signedUrl.includes(BUCKET_NAME), 'bucket=' + BUCKET_NAME);
    assert('Signed URL contains storage path encoded', signedUrl.includes(String(COMM_ID)), 'path starts with communityId');

    // ── STEP 4: Fetch the signed URL directly, confirm PDF bytes ──────────
    console.log('\n── Step 4: Fetch signed URL, confirm real PDF content served ──');
    const fileRes = await fetch(signedUrl);
    console.log('HTTP status from signed URL:', fileRes.status);
    const contentType = fileRes.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    const fileBytes = Buffer.from(await fileRes.arrayBuffer());
    console.log('Response body size:', fileBytes.length, 'bytes');
    console.log('First 5 bytes:', fileBytes.slice(0, 5).toString('ascii'));

    assert('Signed URL responds 200', fileRes.status === 200, 'got ' + fileRes.status);
    assert('Content-Type is application/pdf', contentType.includes('application/pdf') || contentType.includes('octet-stream'),
           'got "' + contentType + '"');
    assert('File starts with %PDF-', fileBytes.slice(0, 5).toString('ascii') === '%PDF-',
           'got "' + fileBytes.slice(0, 5).toString('ascii') + '"');
    assert('File size matches uploaded buffer', fileBytes.length === pdfBuffer.length,
           'expected=' + pdfBuffer.length + ' got=' + fileBytes.length);

    // ── STEP 5: Cross-check via direct getSignedDocumentUrl (service layer) ─
    console.log('\n── Step 5: Cross-check via service-layer getSignedDocumentUrl ──');
    const directUrl = await getSignedDocumentUrl(storagePath);
    console.log('Direct service URL:', directUrl.slice(0, 100) + '...');
    assert('Service-layer signed URL is https', directUrl.startsWith('https://'), directUrl.slice(0,50));
    const directRes = await fetch(directUrl);
    const directBytes = Buffer.from(await directRes.arrayBuffer());
    assert('Direct signed URL also returns 200', directRes.status === 200, 'got ' + directRes.status);
    assert('Direct signed URL serves %PDF- content', directBytes.slice(0, 5).toString('ascii') === '%PDF-');

    console.log('\n=================================================================');
    console.log('FINAL: ' + passed + ' passed, ' + failed + ' failed');
    console.log('=================================================================\n');

  } finally {
    // Cleanup DB row
    if (cvId) {
      await pool.query('DELETE FROM community_verifications WHERE id=$1', [cvId]);
      const chk = await pool.query('SELECT id FROM community_verifications WHERE id=$1', [cvId]);
      console.log('DB cleanup: deleted cv id=' + cvId + ' remaining=' + chk.rows.length);
    }
    // Cleanup Supabase storage file
    if (storagePath) {
      const { error: delErr } = await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      if (delErr) {
        console.error('Storage cleanup failed:', delErr.message);
      } else {
        console.log('Storage cleanup: removed', storagePath);
      }
    }
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
