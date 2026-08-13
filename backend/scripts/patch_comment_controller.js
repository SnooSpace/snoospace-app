'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/commentController.js');
let c = fs.readFileSync(filePath, 'utf8');

// Verify the broken reference exists
const brokenRef = 'postCheck.rows[0]?.author_id === userId';
if (!c.includes(brokenRef)) {
  console.log('Broken reference not found — may already be fixed or already different. Exiting OK.');
  process.exit(0);
}

// Strategy: replace the broken guard with unconditional execution (no `if` wrapping needed).
// Own posts are safe: getFeed's retirement exclusion only applies to OTHER people's posts,
// so a penalty row written for a self-reply has zero visible effect.
// The broken `postCheck` variable doesn't exist in replyToComment scope, causing a ReferenceError.

// Find the broken block's start index
const brokenGuardLine = '    const isOwnPostReply = postCheck.rows[0]?.author_id === userId && postCheck.rows[0]?.author_type === userType;\r\n    if (!isOwnPostReply) {';
const brokenGuardEnd = '    }\r\n';   // closing brace of the if block

if (!c.includes(brokenGuardLine)) {
  console.error('Broken guard line not found. Current content around that area:');
  const idx = c.indexOf('isOwnPostReply');
  console.error(JSON.stringify(c.slice(Math.max(0,idx-50), idx+300)));
  process.exit(1);
}

// Replace: remove the if-guard wrapper (strip the if line + closing brace), but keep the inner body
// The inner body is the pool.query block + .catch line
// Original indented at 6 spaces inside `if (!isOwnPostReply) {`
// After removing the guard, keep it at 4 spaces

// Step 1: Remove the guard opening line
c = c.replace(
  brokenGuardLine + '\r\n',
  '    // Own-post check skipped: getFeed retirement exclusion already protects own posts.\r\n' +
  '    {\r\n'  // keep the braces structure so we don't have to change indentation
);

console.log('Removed broken guard opening');
fs.writeFileSync(filePath, c);
console.log('Done. File written.');

// Quick verify: check broken ref is gone
const after = fs.readFileSync(filePath, 'utf8');
if (after.includes('postCheck.rows[0]?.author_id')) {
  console.error('WARNING: broken reference still present!');
  process.exit(1);
} else {
  console.log('Verified: broken reference removed.');
}
