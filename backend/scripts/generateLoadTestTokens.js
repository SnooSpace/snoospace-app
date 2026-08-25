'use strict';
/**
 * Load Test Token Generator
 * 
 * Generates offline V2 JWT access tokens for all synthetic members (is_load_test = true)
 * using the server's JWT_SECRET and standard payload claims.
 * 
 * Writes generated tokens to `scripts/loadtest_tokens.json` and `loadtest/loadtest_tokens.json`
 * for consumption by the k6 load testing script.
 * 
 * Usage:
 *   node scripts/generateLoadTestTokens.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const { createPool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

async function generateTokens() {
  const pool = createPool();
  const startTime = Date.now();

  console.log('================================================================');
  console.log('🔑 Generating Load Test Authentication Tokens (V2 JWT)');
  console.log('   Target: All members WHERE is_load_test = true');
  console.log('================================================================\n');

  try {
    const res = await pool.query(`
      SELECT id, email 
      FROM members 
      WHERE is_load_test = true 
      ORDER BY id ASC
    `);

    const members = res.rows;
    if (members.length === 0) {
      throw new Error(
        'No synthetic members found (is_load_test = true). ' +
        'Please run `node scripts/seedLoadTestData.js` first.'
      );
    }

    console.log(`Found ${members.length} synthetic members. Signing JWTs...`);

    const tokenEntries = members.map((member, index) => {
      const token = jwt.sign(
        {
          role: 'authenticated',
          sub: `member_${member.id}`,
          userId: member.id,
          userType: 'member',
          email: member.email,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return {
        userId: member.id,
        token: token,
      };
    });

    const jsonContent = JSON.stringify(tokenEntries, null, 2);

    // Save to scripts/ directory
    const scriptsPath = path.resolve(__dirname, 'loadtest_tokens.json');
    fs.writeFileSync(scriptsPath, jsonContent, 'utf8');
    console.log(`  ✓ Written ${tokenEntries.length} tokens to: ${scriptsPath}`);

    // Save copy to loadtest/ directory for convenient k6 SharedArray access
    const loadtestDir = path.resolve(__dirname, '../loadtest');
    if (!fs.existsSync(loadtestDir)) {
      fs.mkdirSync(loadtestDir, { recursive: true });
    }
    const loadtestPath = path.resolve(loadtestDir, 'loadtest_tokens.json');
    fs.writeFileSync(loadtestPath, jsonContent, 'utf8');
    console.log(`  ✓ Written ${tokenEntries.length} tokens to: ${loadtestPath}`);

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n================================================================');
    console.log(`🎉 Token Generation Completed Successfully in ${elapsedSeconds}s!`);
    console.log(`   Total Tokens Generated: ${tokenEntries.length}`);
    console.log('   Ready for k6 load testing.');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Token generation failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generateTokens();
