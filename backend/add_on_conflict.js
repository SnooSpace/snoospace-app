const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'local_data.sql');
const destPath = path.join(__dirname, 'local_data_import_ready.sql');

console.log('🔄 Cleaning, wrapping and adding ON CONFLICT DO NOTHING to all INSERTs...');

if (!fs.existsSync(srcPath)) {
  console.error('❌ Source file local_data.sql does not exist!');
  process.exit(1);
}

const fileContent = fs.readFileSync(srcPath, 'utf8');
const lines = fileContent.split('\n');

const cleanedLines = [];

cleanedLines.push('-- ============================================================');
cleanedLines.push('-- SnooSpace Hosted Database Data Import Script');
cleanedLines.push('-- Automatically wrapped to disable foreign key checks temporarily');
cleanedLines.push('-- ============================================================');
cleanedLines.push('BEGIN;');
cleanedLines.push("SET session_replication_role = 'replica';");
cleanedLines.push('');

let currentStatement = '';
let inInsert = false;

for (let line of lines) {
  const trimmed = line.trim();
  
  if (trimmed.startsWith('\\') || (trimmed.includes('set_config') && trimmed.includes('search_path'))) {
    continue;
  }
  
  if (trimmed.startsWith('INSERT INTO ')) {
    inInsert = true;
    currentStatement = line;
  } else if (inInsert) {
    currentStatement += '\n' + line;
  } else {
    cleanedLines.push(line);
    continue;
  }
  
  if (trimmed.endsWith(');')) {
    inInsert = false;
    // Replace the trailing ); with ) ON CONFLICT DO NOTHING;
    const lastIndex = currentStatement.lastIndexOf(');');
    if (lastIndex !== -1) {
      currentStatement = currentStatement.substring(0, lastIndex) + ') ON CONFLICT DO NOTHING;';
    }
    cleanedLines.push(currentStatement);
    currentStatement = '';
  }
}

cleanedLines.push('');
cleanedLines.push('-- Re-enable constraints and triggers');
cleanedLines.push("SET session_replication_role = 'origin';");
cleanedLines.push('COMMIT;');

fs.writeFileSync(destPath, cleanedLines.join('\n'), 'utf8');
console.log('✅ Created local_data_import_ready.sql successfully with global ON CONFLICT resolution!');
console.log('File size:', (fs.statSync(destPath).size / 1024 / 1024).toFixed(2), 'MB');
process.exit(0);
