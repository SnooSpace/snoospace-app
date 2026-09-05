/**
 * Calibration Script: Face Verification Thresholds
 * File: backend/scratch/calibrate_thresholds.js
 * 
 * Purpose:
 * Measures real Euclidean distance values returned by matchVideoToReferences()
 * using genuine recorded videos and real profile photos, to check whether the
 * existing thresholds (<= 0.55 match, >= 0.85 no_match) are correctly placed.
 * 
 * NOTE:
 * - Read-only calibration pass.
 * - Zero modifications to production code (faceMatchService.js, verificationsController.js, memberController.js).
 * - Zero threshold value changes in faceMatchService.js.
 * - Zero database writes.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createPool } = require('../config/db');
const { matchVideoToReferences } = require('../services/faceMatchService');

// =============================================================================
// TEST CASES CONFIGURATION
//
// Fill in real member IDs after seeding test accounts with real photos and
// real recorded videos through the actual app.
//
// Each entry format:
// {
//   label: string,
//   memberId: number,
//   expectedOutcome: 'same_person' | 'different_person'
// }
// =============================================================================
const TEST_CASES = [
  // Examples: Replace with your actual seeded test accounts:
  // { label: 'Alice - Genuine Selfie Video', memberId: 101, expectedOutcome: 'same_person' },
  // { label: 'Bob - Genuine Selfie Video', memberId: 102, expectedOutcome: 'different_person' },
];

/**
 * Fetch eligible reference photos for a member using the exact query from faceMatchService.js.
 * 
 * @param {number|string} memberId 
 * @param {import('pg').Pool} pool 
 * @returns {Promise<{ photo_url: string, face_embedding: any }[]>}
 */
async function fetchEligibleReferencePhotos(memberId, pool) {
  const memberRes = await pool.query(
    `SELECT discover_photos FROM members WHERE id = $1`,
    [memberId]
  );
  if (memberRes.rows.length === 0) return [];

  const rawPhotos = memberRes.rows[0].discover_photos;
  const currentPhotos = Array.isArray(rawPhotos)
    ? rawPhotos
    : (typeof rawPhotos === 'string' ? JSON.parse(rawPhotos || '[]') : []);

  if (!currentPhotos || currentPhotos.length === 0) return [];

  const refRes = await pool.query(
    `SELECT photo_url, face_embedding
     FROM photo_face_verifications
     WHERE member_id = $1
       AND face_eligible = TRUE
       AND photo_url = ANY($2::text[])
       AND face_embedding IS NOT NULL`,
    [memberId, currentPhotos]
  );

  return refRes.rows;
}

/**
 * Fetch the member's most recent user_verifications row to get the video's
 * Cloudinary public_id (video_storage_path).
 * 
 * @param {number|string} memberId 
 * @param {import('pg').Pool} pool 
 * @returns {Promise<any|null>}
 */
async function fetchLatestVerification(memberId, pool) {
  const verRes = await pool.query(
    `SELECT id, user_id, video_storage_path, status, match_score,
            decision_source, rejection_reason, submitted_at, reviewed_at
     FROM user_verifications
     WHERE user_id = $1
     ORDER BY submitted_at DESC, id DESC
     LIMIT 1`,
    [memberId]
  );
  return verRes.rows[0] || null;
}

/**
 * Snapshot database rows for all test member IDs before/after to guarantee zero writes.
 * 
 * @param {number[]} memberIds 
 * @param {import('pg').Pool} pool 
 * @returns {Promise<{ members: any[], verifications: any[] }>}
 */
async function captureDbSnapshot(memberIds, pool) {
  if (!memberIds || memberIds.length === 0) {
    return { members: [], verifications: [] };
  }

  const memRes = await pool.query(
    `SELECT id, is_verified, verified_at, verification_tier, verified_reference_photos
     FROM members
     WHERE id = ANY($1::bigint[])
     ORDER BY id ASC`,
    [memberIds]
  );

  const verRes = await pool.query(
    `SELECT id, user_id, status, video_storage_path, match_score,
            decision_source, rejection_reason, submitted_at, reviewed_at
     FROM user_verifications
     WHERE user_id = ANY($1::bigint[])
     ORDER BY id ASC`,
    [memberIds]
  );

  return {
    members: memRes.rows,
    verifications: verRes.rows,
  };
}

/**
 * Compare two database snapshots and verify whether any rows or columns were mutated.
 */
function verifyZeroDbWrites(before, after) {
  const beforeJson = JSON.stringify(before);
  const afterJson = JSON.stringify(after);

  const identical = beforeJson === afterJson;
  return {
    identical,
    beforeCount: {
      members: before?.members?.length ?? 0,
      verifications: before?.verifications?.length ?? 0,
    },
    afterCount: {
      members: after?.members?.length ?? 0,
      verifications: after?.verifications?.length ?? 0,
    },
  };
}

/**
 * Compute descriptive statistics (min, max, avg, stdDev) for distance arrays.
 */
function computeStats(distances) {
  if (!distances || distances.length === 0) {
    return { count: 0, min: null, max: null, avg: null, stdDev: null };
  }

  const min = Math.min(...distances);
  const max = Math.max(...distances);
  const sum = distances.reduce((acc, d) => acc + d, 0);
  const avg = Number((sum / distances.length).toFixed(4));

  const variance = distances.reduce((acc, d) => acc + Math.pow(d - avg, 2), 0) / distances.length;
  const stdDev = Number(Math.sqrt(variance).toFixed(4));

  return {
    count: distances.length,
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    avg,
    stdDev,
  };
}

/**
 * Format a neat ASCII table.
 */
function printAsciiTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxRowLen = rows.reduce((max, r) => Math.max(max, String(r[i] ?? '').length), 0);
    return Math.max(h.length, maxRowLen);
  });

  const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const formatRow = (r) => '|' + r.map((c, i) => ' ' + String(c ?? '').padEnd(colWidths[i]) + ' ').join('|') + '|';

  console.log(separator);
  console.log(formatRow(headers));
  console.log(separator);
  rows.forEach(r => console.log(formatRow(r)));
  console.log(separator);
}

/**
 * Main calibration runner.
 * 
 * @param {Array<{ label: string, memberId: number, expectedOutcome: 'same_person' | 'different_person' }>} [customTestCases]
 */
async function runCalibration(customTestCases = null) {
  console.log('\n======================================================================');
  console.log('       FACE VERIFICATION THRESHOLD CALIBRATION TOOL (READ-ONLY)       ');
  console.log('======================================================================\n');

  const activeTestCases = customTestCases || TEST_CASES;
  const pool = createPool();

  try {
    if (!activeTestCases || activeTestCases.length === 0) {
      console.warn('⚠️  No test cases found in TEST_CASES array.');
      console.log('To calibrate thresholds:');
      console.log('  1. Open backend/scratch/calibrate_thresholds.js');
      console.log('  2. Populate the TEST_CASES array at the top with your seeded test accounts:');
      console.log('     const TEST_CASES = [');
      console.log('       { label: "Person A selfie video", memberId: 101, expectedOutcome: "same_person" },');
      console.log('       { label: "Person B video vs Person A profile", memberId: 102, expectedOutcome: "different_person" },');
      console.log('     ];');
      console.log('  3. Re-run: node backend/scratch/calibrate_thresholds.js\n');

      console.log('--- Current Accounts with Profile Photos in Database ---');
      const sampleMems = await pool.query(
        `SELECT m.id, m.name, jsonb_array_length(COALESCE(m.discover_photos, '[]'::jsonb)) as photo_count,
                (SELECT count(*) FROM photo_face_verifications pf WHERE pf.member_id = m.id AND pf.face_eligible = TRUE) as eligible_refs,
                (SELECT count(*) FROM user_verifications uv WHERE uv.user_id = m.id) as ver_count
         FROM members m
         WHERE jsonb_array_length(COALESCE(m.discover_photos, '[]'::jsonb)) > 0
            OR EXISTS (SELECT 1 FROM user_verifications uv WHERE uv.user_id = m.id)
         LIMIT 10`
      );

      if (sampleMems.rows.length > 0) {
        console.table(sampleMems.rows.map(r => ({
          'Member ID': r.id,
          'Name': r.name,
          'Profile Photos': r.photo_count,
          'Eligible Face References': r.eligible_refs,
          'Verifications Recorded': r.ver_count,
        })));
      } else {
        console.log('No members with discover_photos or verifications found yet.');
      }
      return;
    }

    const testMemberIds = [...new Set(activeTestCases.map(tc => Number(tc.memberId)).filter(Boolean))];

    // 1. Audit DB state BEFORE running matchVideoToReferences
    console.log(`[DB Audit] Capturing baseline DB state for ${testMemberIds.length} test member(s)...`);
    const dbBefore = await captureDbSnapshot(testMemberIds, pool);

    const results = [];
    const samePersonDistances = [];
    const diffPersonDistances = [];

    console.log(`\nEvaluating ${activeTestCases.length} test case(s)...\n`);

    for (let i = 0; i < activeTestCases.length; i++) {
      const tc = activeTestCases[i];
      const memberId = tc.memberId;
      console.log(`[${i + 1}/${activeTestCases.length}] Evaluating: "${tc.label}" (Member ID: ${memberId})...`);

      // A. Fetch eligible references using the exact query from faceMatchService.js
      const eligibleRefs = await fetchEligibleReferencePhotos(memberId, pool);

      // B. Fetch latest verification row for video_storage_path (Cloudinary public_id)
      const latestVer = await fetchLatestVerification(memberId, pool);

      if (!latestVer || !latestVer.video_storage_path) {
        console.warn(`  ⚠️  Missing verification video for Member ID ${memberId}`);
        results.push({
          label: tc.label,
          memberId,
          expectedOutcome: tc.expectedOutcome,
          distance: 'N/A',
          classification: 'no_video',
          agrees: 'no (no video)',
          framesEligible: '0/3',
          matchedPhotoUrl: 'N/A',
          eligibleRefsCount: eligibleRefs.length,
        });
        continue;
      }

      const videoPublicId = latestVer.video_storage_path;

      // C. Call matchVideoToReferences directly (side-effect-free service call)
      let matchResult;
      try {
        matchResult = await matchVideoToReferences(videoPublicId, memberId, pool);
      } catch (err) {
        console.error(`  ❌ matchVideoToReferences failed for Member ID ${memberId}:`, err.message);
        results.push({
          label: tc.label,
          memberId,
          expectedOutcome: tc.expectedOutcome,
          distance: 'ERROR',
          classification: 'error',
          agrees: 'no (error)',
          framesEligible: 'N/A',
          matchedPhotoUrl: 'N/A',
          eligibleRefsCount: eligibleRefs.length,
        });
        continue;
      }

      const distance = typeof matchResult.distance === 'number' ? matchResult.distance : null;
      const classification = matchResult.status;
      const framesEligible = `${matchResult.framesAnalyzed ?? 0}/3`;
      const matchedPhotoUrl = matchResult.matchedPhotoUrl || 'None';

      // Evaluate agreement with expectation
      // same_person expects 'match' (distance <= 0.55)
      // different_person expects 'no_match' (distance >= 0.85)
      let agrees = 'no';
      if (tc.expectedOutcome === 'same_person') {
        if (classification === 'match') {
          agrees = 'yes';
        } else if (classification === 'uncertain') {
          agrees = 'no (uncertain)';
        } else {
          agrees = `no (${classification})`;
        }
      } else if (tc.expectedOutcome === 'different_person') {
        if (classification === 'no_match') {
          agrees = 'yes';
        } else if (classification === 'uncertain') {
          agrees = 'no (uncertain)';
        } else {
          agrees = `no (${classification})`;
        }
      }

      if (distance !== null) {
        if (tc.expectedOutcome === 'same_person') {
          samePersonDistances.push(distance);
        } else if (tc.expectedOutcome === 'different_person') {
          diffPersonDistances.push(distance);
        }
      }

      results.push({
        label: tc.label,
        memberId,
        expectedOutcome: tc.expectedOutcome,
        distance: distance !== null ? distance.toFixed(4) : 'N/A',
        classification,
        agrees,
        framesEligible,
        matchedPhotoUrl: matchedPhotoUrl !== 'None' ? matchedPhotoUrl.split('/').pop() : 'None',
        eligibleRefsCount: eligibleRefs.length,
        numericDistance: distance,
      });
    }

    // 2. Audit DB state AFTER running match calls
    console.log(`\n[DB Audit] Checking post-execution DB state for ${testMemberIds.length} test member(s)...`);
    const dbAfter = await captureDbSnapshot(testMemberIds, pool);
    const writeCheck = verifyZeroDbWrites(dbBefore, dbAfter);

    // =========================================================================
    // SECTION 1: SUMMARY TABLE
    // Columns: label | expectedOutcome | distance | current classification | agrees?
    // Plus supplementary columns: frames (eligible/3) | eligible refs
    // =========================================================================
    console.log('\n======================================================================');
    console.log('                      CALIBRATION RESULTS TABLE                       ');
    console.log('======================================================================');

    const headers = [
      'label',
      'expectedOutcome',
      'distance',
      'current classification',
      'agrees with expectation?',
      'frames (eligible/3)',
      'eligible refs',
    ];

    const tableRows = results.map(r => [
      r.label,
      r.expectedOutcome,
      r.distance,
      r.classification,
      r.agrees,
      r.framesEligible,
      r.eligibleRefsCount,
    ]);

    printAsciiTable(headers, tableRows);

    // =========================================================================
    // SECTION 2: CLUSTER STATS
    // Across all 'same_person' cases vs across all 'different_person' cases
    // =========================================================================
    console.log('\n======================================================================');
    console.log('                        CLUSTER STATISTICS                            ');
    console.log('======================================================================');

    const sameStats = computeStats(samePersonDistances);
    const diffStats = computeStats(diffPersonDistances);

    const statsHeaders = ['Cohort', 'Count', 'Min Distance', 'Max Distance', 'Avg Distance', 'Std Dev'];
    const statsRows = [
      [
        'same_person',
        sameStats.count,
        sameStats.min !== null ? sameStats.min.toFixed(4) : 'N/A',
        sameStats.max !== null ? sameStats.max.toFixed(4) : 'N/A',
        sameStats.avg !== null ? sameStats.avg.toFixed(4) : 'N/A',
        sameStats.stdDev !== null ? sameStats.stdDev.toFixed(4) : 'N/A',
      ],
      [
        'different_person',
        diffStats.count,
        diffStats.min !== null ? diffStats.min.toFixed(4) : 'N/A',
        diffStats.max !== null ? diffStats.max.toFixed(4) : 'N/A',
        diffStats.avg !== null ? diffStats.avg.toFixed(4) : 'N/A',
        diffStats.stdDev !== null ? diffStats.stdDev.toFixed(4) : 'N/A',
      ],
    ];

    printAsciiTable(statsHeaders, statsRows);

    // =========================================================================
    // SECTION 3: SEPARATION & THRESHOLD ANALYSIS
    // =========================================================================
    console.log('\n======================================================================');
    console.log('                 SEPARATION & THRESHOLD ANALYSIS                      ');
    console.log('======================================================================');
    console.log('Current Threshold Boundaries in faceMatchService.js:');
    console.log('  • MATCH:     distance <= 0.5500');
    console.log('  • UNCERTAIN: 0.5500 < distance < 0.8500  (manual review fallback)');
    console.log('  • NO MATCH:  distance >= 0.8500\n');

    if (sameStats.count > 0 && diffStats.count > 0) {
      const separationGap = Number((diffStats.min - sameStats.max).toFixed(4));
      console.log(`Cluster Separation Gap: min(different_person) - max(same_person) = ${separationGap}`);

      if (separationGap > 0) {
        console.log(`✅ POSITIVE GAP: Distinct cluster separation observed (margin = ${separationGap}).`);
      } else {
        console.log(`⚠️ OVERLAP DETECTED: max(same_person) (${sameStats.max}) exceeds min(different_person) (${diffStats.min}).`);
        console.log(`   Overlap range: [${diffStats.min.toFixed(4)}, ${sameStats.max.toFixed(4)}]`);
      }

      console.log('\nThreshold Alignment:');
      if (sameStats.max <= 0.55) {
        console.log(`  • same_person max (${sameStats.max}) <= 0.55: Captured by auto-match.`);
      } else {
        console.log(`  • same_person max (${sameStats.max}) > 0.55: Fell into uncertain/no_match.`);
      }

      if (diffStats.min >= 0.85) {
        console.log(`  • different_person min (${diffStats.min}) >= 0.85: Captured by auto-reject.`);
      } else {
        console.log(`  • different_person min (${diffStats.min}) < 0.85: Fell below no_match.`);
      }
    } else {
      console.log('Cohort breakdown:');
      if (sameStats.count === 0) console.log('  • No numeric distances for same_person cohort.');
      if (diffStats.count === 0) console.log('  • No numeric distances for different_person cohort.');
      console.log('Add real member IDs with completed verifications to observe cluster separation.');
    }

    // =========================================================================
    // SECTION 4: DATABASE WRITE AUDIT
    // =========================================================================
    console.log('\n======================================================================');
    console.log('                       DATABASE WRITE AUDIT                           ');
    console.log('======================================================================');
    if (writeCheck.identical) {
      console.log('✅ CONFIRMED: Calling matchVideoToReferences directly triggered ZERO database writes.');
      console.log(`   - Evaluated Member IDs: ${testMemberIds.join(', ')}`);
      console.log(`   - members rows before/after: ${writeCheck.beforeCount.members} / ${writeCheck.afterCount.members}`);
      console.log(`   - user_verifications rows before/after: ${writeCheck.beforeCount.verifications} / ${writeCheck.afterCount.verifications}`);
      console.log('   - members verification columns (is_verified, verification_tier, verified_reference_photos) remained identical.');
      console.log('   - user_verifications columns (status, match_score, decision_source, reviewed_at) remained identical.');
    } else {
      console.error('❌ ALERT: Database mutation detected during calibration run!');
      console.error('   Before:', dbBefore);
      console.error('   After:', dbAfter);
    }
    console.log('======================================================================\n');

  } catch (error) {
    console.error('Fatal error during calibration execution:', error);
  } finally {
    await pool.end();
  }
}

// Execute if run directly
if (require.main === module) {
  runCalibration();
}

module.exports = {
  runCalibration,
  fetchEligibleReferencePhotos,
  fetchLatestVerification,
  computeStats,
  verifyZeroDbWrites,
};
