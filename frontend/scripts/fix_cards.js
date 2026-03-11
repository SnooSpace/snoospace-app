const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*\{\/\* Card 2:/,
  `</View>\n          </View>\n        </View>\n\n        {/* Card 2:`
);

content = content.replace(
  /<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*\{\/\* Card 3:/,
  `</View>\n          </View>\n        </View>\n\n        {/* Card 3:`
);

content = content.replace(
  /<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*\{\/\* Card 5:/,
  `</View>\n          </View>\n        </View>\n\n        {/* Card 5:`
);

content = content.replace(
  /<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*\{\/\* Card 6:/,
  `</View>\n          </View>\n        </View>\n\n        {/* Card 6:`
);

// End 6
content = content.replace(
  /<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<\/View>\n\s*<View style=\{\{\s*height:\s*0\s*\}\}\s*\/>/,
  `</View>\n        </View>\n      </View>\n\n        <View style={{ height: 0 }} />`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed extra </View> tags");
