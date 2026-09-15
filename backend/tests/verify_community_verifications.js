'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const pool = createPool();
const TOKEN = process.env.ADMIN_TEST_TOKEN;
const BASE = process.env.ADMIN_TEST_URL || 'http://localhost:5000';
const hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN };
let passed = 0, failed = 0;
const ids = [];
let origCollegeState = null;
const COMM_A_ID = 86; // Cancel Test Org — non-college
const COMM_B_ID = 85; // Postpone Test Org — gets temp college affiliation

async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: hdrs, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  return { status: res.status, body: json };
}

function assert(label, ok, extra) {
  const msg = '  [' + (ok ? 'PASS' : 'FAIL') + '] ' + label + (extra != null ? ' -- ' + extra : '');
  if (ok) { console.log(msg); passed++; } else { console.error(msg); failed++; }
}

async function main() {
  console.log('\n====================================================');
  console.log('Community Verification Admin Page — Test Suite');
  console.log('====================================================\n');
  console.log('TOKEN:', TOKEN ? 'present (' + TOKEN.slice(0,20) + '...)' : 'MISSING');
  console.log('BASE_URL:', BASE);
  try {
    // Find a real college for affiliation test
    const colRes = await pool.query('SELECT id, name FROM colleges ORDER BY id LIMIT 1');
    if (!colRes.rows.length) throw new Error('No colleges in DB');
    const college = colRes.rows[0];
    const camRes = await pool.query('SELECT id, campus_name FROM campuses WHERE college_id=$1 LIMIT 1', [college.id]);
    const campus = camRes.rows[0] || null;
    console.log('College for affiliation test: id=' + college.id + ' name="' + college.name + '"');
    console.log('Campus: ' + (campus ? campus.campus_name : 'none (will test NULL campus)'));

    // Save & temporarily set college affiliation on CommB
    const origRes = await pool.query('SELECT college_id, campus_id FROM communities WHERE id=$1', [COMM_B_ID]);
    origCollegeState = { college_id: origRes.rows[0].college_id, campus_id: origRes.rows[0].campus_id };
    await pool.query('UPDATE communities SET college_id=$1, campus_id=$2 WHERE id=$3',
                     [college.id, campus ? campus.id : null, COMM_B_ID]);
    console.log('Set CommB (id=' + COMM_B_ID + ') college_id=' + college.id + ' campus_id=' + (campus ? campus.id : null));

    // Insert 3 test verification rows
    const r1 = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'community_verified','pending',NULL) RETURNING *",
      [COMM_A_ID]);
    const v1 = r1.rows[0]; ids.push(v1.id);
    console.log('\nInserted Tier A pending: cv.id=' + v1.id + ' community_id=' + COMM_A_ID + ' (non-college)');

    const r2 = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'registered_org','pending','test/dummy_doc_admintest.pdf') RETURNING *",
      [COMM_B_ID]);
    const v2 = r2.rows[0]; ids.push(v2.id);
    console.log('Inserted Tier B pending: cv.id=' + v2.id + ' community_id=' + COMM_B_ID + ' (college-affiliated)');

    const r3 = await pool.query(
      "INSERT INTO community_verifications (community_id,tier,status,document_storage_path) VALUES ($1,'community_verified','pending',NULL) RETURNING *",
      [COMM_A_ID]);
    const v3 = r3.rows[0]; ids.push(v3.id);
    console.log('Inserted Tier A (reject test): cv.id=' + v3.id);

    // === SCENARIO 1: New context fields in adminGetAll ===
    console.log('\n=== SCENARIO 1: New context fields in GET /communities/admin/verifications ===');
    const list = await api('GET', '/communities/admin/verifications?status=pending&limit=100');
    assert('GET returns HTTP 200', list.status === 200, 'got ' + list.status);
    assert('response has verifications array', Array.isArray(list.body.verifications));

    const row1 = list.body.verifications?.find(v => v.id === v1.id);
    const row2 = list.body.verifications?.find(v => v.id === v2.id);
    assert('Row1 (non-college Tier A) present in list', !!row1, 'id=' + v1.id);
    assert('Row2 (college Tier B) present in list', !!row2, 'id=' + v2.id);

    if (row1) {
      console.log('\nRow1 full API payload:');
      console.log(JSON.stringify(row1, null, 2));
      assert('community_type field present', 'community_type' in row1, 'value=' + row1.community_type);
      assert('community_created_at field present', 'community_created_at' in row1);
      assert('follower_count is a number', typeof row1.follower_count === 'number', 'value=' + row1.follower_count);
      assert('college_name field present', 'college_name' in row1);
      assert('campus_name field present', 'campus_name' in row1);
      assert('college_name is null for non-college community', row1.college_name === null, 'got=' + JSON.stringify(row1.college_name));
      assert('campus_name is null for non-college community', row1.campus_name === null, 'got=' + JSON.stringify(row1.campus_name));
    }

    if (row2) {
      console.log('\nRow2 full API payload:');
      console.log(JSON.stringify(row2, null, 2));
      assert('college_name populated for college-affiliated community', !!row2.college_name, 'value="' + row2.college_name + '"');
      assert('college_name matches DB join result', row2.college_name === college.name, 'got="' + row2.college_name + '" expected="' + college.name + '"');
      if (campus) {
        assert('campus_name populated when campus set', row2.campus_name === campus.campus_name, 'got="' + row2.campus_name + '" expected="' + campus.campus_name + '"');
      } else {
        assert('campus_name null when no campus', row2.campus_name === null, 'got=' + row2.campus_name);
      }
      assert('community_type present on college row', 'community_type' in row2, 'value=' + row2.community_type);
      assert('follower_count is number on college row', typeof row2.follower_count === 'number', 'value=' + row2.follower_count);
    }

    // === SCENARIO 2: Tier A approval ===
    console.log('\n=== SCENARIO 2: Tier A (community_verified) approval ===');
    const appr = await api('PATCH', '/communities/admin/verifications/' + v1.id, { status: 'approved' });
    console.log('PATCH /communities/admin/verifications/' + v1.id + ' -> HTTP ' + appr.status);
    console.log(JSON.stringify(appr.body, null, 2));
    assert('Approve returns 200', appr.status === 200, 'got ' + appr.status);
    assert('verification.status=approved', appr.body.verification?.status === 'approved');
    assert('verification.reviewed_at set', !!appr.body.verification?.reviewed_at, appr.body.verification?.reviewed_at);
    assert('community badge in response', !!appr.body.community, 'community=' + JSON.stringify(appr.body.community));

    const listAppr = await api('GET', '/communities/admin/verifications?status=approved&limit=100');
    const approvedRow = listAppr.body.verifications?.find(v => v.id === v1.id);
    assert('Approved row appears in approved filter list', !!approvedRow);
    assert('Approved row status=approved in list', approvedRow?.status === 'approved');
    assert('Approved row has reviewed_at in list', !!approvedRow?.reviewed_at, approvedRow?.reviewed_at);

    // === SCENARIO 3: Rejection enforcement + reason persistence ===
    console.log('\n=== SCENARIO 3: Rejection enforcement + persistence ===');
    const noReason = await api('PATCH', '/communities/admin/verifications/' + v3.id, { status: 'rejected' });
    console.log('PATCH (no rejection_reason) -> HTTP ' + noReason.status);
    console.log(JSON.stringify(noReason.body, null, 2));
    assert('Reject without reason = 400', noReason.status === 400, 'got ' + noReason.status);
    assert('error=rejection_reason_required', noReason.body.error === 'rejection_reason_required', 'got="' + noReason.body.error + '"');

    const REASON = 'Test: community name mimics known verified org — automated test, safe to discard';
    const withReason = await api('PATCH', '/communities/admin/verifications/' + v3.id, { status: 'rejected', rejection_reason: REASON });
    console.log('\nPATCH (with rejection_reason) -> HTTP ' + withReason.status);
    console.log(JSON.stringify(withReason.body, null, 2));
    assert('Reject with reason = 200', withReason.status === 200, 'got ' + withReason.status);
    assert('verification.status=rejected', withReason.body.verification?.status === 'rejected');
    assert('rejection_reason in response', withReason.body.verification?.rejection_reason === REASON,
           'got="' + withReason.body.verification?.rejection_reason + '"');
    assert('reviewed_at set on reject', !!withReason.body.verification?.reviewed_at);
    assert('reviewed_by set (admin id)', !!withReason.body.verification?.reviewed_by);

    const dbRow = await pool.query(
      'SELECT id,status,rejection_reason,reviewed_at,reviewed_by FROM community_verifications WHERE id=$1',
      [v3.id]);
    console.log('\nDirect DB state after rejection:');
    console.log(JSON.stringify(dbRow.rows[0], null, 2));
    assert('DB status=rejected', dbRow.rows[0].status === 'rejected');
    assert('DB rejection_reason correct', dbRow.rows[0].rejection_reason === REASON,
           'got="' + dbRow.rows[0].rejection_reason + '"');
    assert('DB reviewed_at populated', !!dbRow.rows[0].reviewed_at);
    assert('DB reviewed_by set', !!dbRow.rows[0].reviewed_by);

    const listRej = await api('GET', '/communities/admin/verifications?status=rejected&limit=100');
    const rejRow = listRej.body.verifications?.find(v => v.id === v3.id);
    assert('Rejected row visible in rejected list on reopen', !!rejRow);
    assert('rejection_reason persists on reopen via list API', rejRow?.rejection_reason === REASON,
           'got="' + rejRow?.rejection_reason + '"');

    // === SCENARIO 4: Document endpoint ===
    console.log('\n=== SCENARIO 4: Document URL endpoint (Tier B + Tier A 404) ===');
    const docB = await api('GET', '/communities/admin/verifications/' + v2.id + '/document');
    console.log('GET /communities/admin/verifications/' + v2.id + '/document (Tier B) -> HTTP ' + docB.status);
    console.log(JSON.stringify(docB.body, null, 2));
    // dummy path 'test/dummy_doc_admintest.pdf' will cause a Supabase storage error (500) — expected
    const docOk = docB.status === 200 || docB.status === 500;
    assert('Tier B document endpoint reachable (200=real URL, 500=storage error for dummy path)', docOk, 'status=' + docB.status);
    if (docB.status === 200) {
      assert('url field is string', typeof docB.body.url === 'string', (docB.body.url || '').slice(0,80));
    }

    const docA = await api('GET', '/communities/admin/verifications/' + v1.id + '/document');
    console.log('\nGET /communities/admin/verifications/' + v1.id + '/document (Tier A, no doc) -> HTTP ' + docA.status);
    console.log(JSON.stringify(docA.body, null, 2));
    assert('Tier A document endpoint returns 404', docA.status === 404, 'got ' + docA.status);
    assert('error=no_document', docA.body.error === 'no_document', 'got="' + docA.body.error + '"');

    // === SCENARIO 5: Resolved rows read-only state ===
    console.log('\n=== SCENARIO 5: Resolved rows expose complete read-only state ===');
    assert('Approved row status != pending', approvedRow?.status !== 'pending', 'status=' + approvedRow?.status);
    assert('Approved row has reviewed_at', !!approvedRow?.reviewed_at, approvedRow?.reviewed_at);
    assert('Approved row no rejection_reason', !approvedRow?.rejection_reason, 'got="' + approvedRow?.rejection_reason + '"');
    assert('Rejected row status != pending', rejRow?.status !== 'pending', 'status=' + rejRow?.status);
    assert('Rejected row has reviewed_at', !!rejRow?.reviewed_at, rejRow?.reviewed_at);
    assert('Rejected row has rejection_reason', !!rejRow?.rejection_reason);

    console.log('\n====================================================');
    console.log('FINAL: ' + passed + ' passed, ' + failed + ' failed');
    console.log('====================================================\n');
  } finally {
    // Restore CommB college affiliation
    if (origCollegeState !== null) {
      await pool.query('UPDATE communities SET college_id=$1, campus_id=$2 WHERE id=$3',
                       [origCollegeState.college_id, origCollegeState.campus_id, COMM_B_ID]);
      console.log('Restored CommB college_id=' + origCollegeState.college_id);
    }
    // Delete test rows
    if (ids.length) {
      await pool.query('DELETE FROM community_verifications WHERE id = ANY($1::int[])', [ids]);
      const chk = await pool.query('SELECT id FROM community_verifications WHERE id = ANY($1::int[])', [ids]);
      console.log('Cleanup: deleted ids=[' + ids.join(',') + '] remaining=' + chk.rows.length + ' (should be 0)');
    }
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}
main().catch(err => { console.error('Fatal:', err); process.exit(1); });
