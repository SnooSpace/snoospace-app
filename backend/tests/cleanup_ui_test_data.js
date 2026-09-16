'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createPool } = require('../config/db');
const supabase = require('../supabase');
const { BUCKET_NAME } = require('../services/communityDocumentStorage');

const pool = createPool();

// Pass IDs as env or args: node cleanup_ui_test_data.js <cvA> <cvB> <storagePath>
const [,, cvA, cvB, storagePath] = process.argv;

async function main() {
  if (cvA) await pool.query('DELETE FROM community_verifications WHERE id=$1', [cvA]);
  if (cvB) await pool.query('DELETE FROM community_verifications WHERE id=$1', [cvB]);
  if (storagePath) {
    await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
    console.log('Storage removed:', storagePath);
  }
  // Restore CommB college affiliation to null
  await pool.query('UPDATE communities SET college_id=NULL, campus_id=NULL WHERE id=85');
  console.log('Cleanup done. Deleted cv ids:', cvA, cvB);
  await pool.end();
}
main().catch(err => { console.error(err); process.exit(1); });
