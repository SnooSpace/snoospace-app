const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

// The issue: the original script matched `</View>\n\n        {/* Card 2:`
// But the actual file content looks like:
//         </View>
//
//           </View>
//         </View>
//
//
//
//         {/* Card 2: About Me */}

// Let's just fix it by matching the exact incorrect structure.
// The incorrect structure has a `</View>` closing the `inputGroupLast`, then the `</View>` for `cardContent`, then `</View>` for the old card, then two extra `</View>` tags.

// Let's replace the whole sequence between the end of the last input group and the next card comment.
// Card 1 to Card 2:
content = content.replace(
  /<\/View>\n\s*<\/View>\n\n\s*<\/View>\n\s*<\/View>\n\n\n\n\s*\{\/\* Card 2: About Me \*\/\}/g,
  `</View>\n        </View>\n      </View>\n\n        {/* Card 2: About Me */}`
);

// Card 2 to Card 3:
content = content.replace(
  /<\/View>\n\s*<\/View>\n\n\s*<\/View>\n\s*<\/View>\n\n\n\n\s*\{\/\* Card 3: Occupation \*\/\}/g,
  `</View>\n        </View>\n      </View>\n\n        {/* Card 3: Occupation */}`
);

// Card 3 to Card 5:
content = content.replace(
  /<\/View>\n\s*<\/View>\n\n\s*<\/View>\n\s*<\/View>\n\n\n\n\s*\{\/\* Card 5: My Vibes/g,
  `</View>\n        </View>\n      </View>\n\n        {/* Card 5: My Vibes`
);

// Card 5 to Card 6:
content = content.replace(
  /<\/View>\n\s*<\/View>\n\n\s*<\/View>\n\s*<\/View>\n\n\n\n\s*\{\/\* Card 6: Private Details/g,
  `</View>\n        </View>\n      </View>\n\n        {/* Card 6: Private Details`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up duplicated View tags");
