const fs = require('fs');
const babelParser = require('@babel/parser');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
const content = fs.readFileSync(file, 'utf8');

try {
  babelParser.parse(content, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  console.log("No syntax errors found by Babel!");
} catch (e) {
  console.error("Syntax Error at line:", e.loc?.line, "column:", e.loc?.column);
  console.error(e.message);
}
