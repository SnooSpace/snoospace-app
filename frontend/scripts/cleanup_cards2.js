const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

// The exact string in the file (normalized to avoid space issues)
// Instead of matching exact spaces, let's use replace with regex for the duplicated closing views.

// This identifies exactly two adjacent occurrences of `</View>\n        </View>\n` separated by some whitespace.
content = content.replace(
  /<\/View>\n\s*<\/View>\n\n\s*<\/View>\n\s*<\/View>\n\n\n\n\s*\{\/\*(.*?)\*\//g,
  `</View>\n        </View>\n\n\n\n        {/*$1*/`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up duplicated View tags");
