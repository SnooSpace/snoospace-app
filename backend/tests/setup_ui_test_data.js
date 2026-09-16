'use strict';
/**
 * setup_ui_test_data.js
 *
 * Inserts two pending cv rows for the browser UI screenshot session:
 *   Row A: community 86 (Cancel Test Org, non-college) — Tier A community_verified
 *   Row B: community 85 (Postpone Test Org) with real college affiliation + real Supabase PDF — Tier B registered_org
 *
 * Prints: COMM_A_CV_ID=<n>  COMM_B_CV_ID=<n>  STORAGE_PATH=<path>
 * Run cleanup_ui_test_data.js after the browser session.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { uploadVerificationDocument, BUCKET_NAME } = require('../services/communityDocumentStorage');

const pool = createPool();
const COMM_A_ID = 86; // Cancel Test Org — non-college
const COMM_B_ID = 85; // Postpone Test Org — gets temp college affiliation

function buildMinimalPdf() {
  const content = 'BT /F1 14 Tf 72 720 Td (SnooSpace UI Test — Tier B Verification Document) Tj ET';
  const stream = 'stream\n' + content + '\nendstream';
  const streamLen = Buffer.byteLength(stream);
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj',
    '4 0 obj<</Length ' + streamLen + '>>\n' + stream,
    'xref\n0 5',
    '0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n',
    'trailer<</Size 5/Root 1 0 R>>',
    'startxref\n337\n%%EOF',
  ].join('\n');
  return Buffer.from(body, 'utf8');
}

async function main() {
  try {
    // Find a real college
    const colRes = await pool.query('SELECT id, name FROM colleges ORDER BY id LIMIT 1');
    if (!colRes.rows.length) { console.error('NO_COLLEGES'); process.exit(1); }
    const college = colRes.rows[0];
    const camRes = await pool.query('SELECT id, campus_name FROM campuses WHERE college_id=$1 LIMIT 1', [college.id]);
    const campus = camRes.rows[0] || null;

    // Set college affiliation on CommB
    await pool.query('UPDATE communities SET college_id=$1, campus_id=$2 WHERE id=$3',
                     [college.id, campus ? campus.id : null, COMM_B_ID]);

    // Upload real PDF for Tier B
    const pdfBuf = buildMinimalPdf();
    const storagePath = await uploadVerificationDocument(COMM_B_ID, pdfBuf, 'ui_test_verification.pdf');

    // Insert Tier A row (non-college, community_verified)
    const rA = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'community_verified','pending',NULL) RETURNING id",
      [COMM_A_ID]);
    const cvA = rA.rows[0].id;

    // Insert Tier B row (college-affiliated, registered_org, real PDF)
    const rB = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'registered_org','pending',$2) RETURNING id",
      [COMM_B_ID, storagePath]);
    const cvB = rB.rows[0].id;

    console.log('COMM_A_CV_ID=' + cvA);
    console.log('COMM_B_CV_ID=' + cvB);
    console.log('STORAGE_PATH=' + storagePath);
    console.log('COLLEGE=' + college.name);
    console.log('CAMPUS=' + (campus ? campus.campus_name : 'none'));
    console.log('ORIG_COLLEGE_ID=null');
  } finally {
    await pool.end();
  }
}
main().catch(err => { console.error('Fatal:', err); process.exit(1); });
