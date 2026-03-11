const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

let lines = content.split('\n');

// View lines from 580 to 620 to see what we're working with:
console.log("Lines 580-595:");
for(let i=580; i<=595; i++) {
  console.log(`${i}: ${lines[i]}`);
}

// I want to manually delete the offending array of lines that we saw:
// 587: 
// 588:           </View>
// 589:         </View>
// 590: 

// Let's just find `          </View>\n        </View>\n\n\n\n        {/* Card ` using indexOf
let idx = content.indexOf(`          </View>\n        </View>\n\n\n\n        {/* Card 2`);
if(idx > -1) {
  content = content.replace(`          </View>\n        </View>\n\n\n\n        {/* Card 2`, `        {/* Card 2`);
}

let idx2 = content.indexOf(`          </View>\n        </View>\n\n\n\n        {/* Card 3`);
if(idx2 > -1) {
  content = content.replace(`          </View>\n        </View>\n\n\n\n        {/* Card 3`, `        {/* Card 3`);
}

let idx3 = content.indexOf(`          </View>\n        </View>\n\n\n\n        {/* Card 5`);
if(idx3 > -1) {
  content = content.replace(`          </View>\n        </View>\n\n\n\n        {/* Card 5`, `        {/* Card 5`);
}

let idx4 = content.indexOf(`          </View>\n        </View>\n\n\n\n        {/* Card 6`);
if(idx4 > -1) {
  content = content.replace(`          </View>\n        </View>\n\n\n\n        {/* Card 6`, `        {/* Card 6`);
}

fs.writeFileSync(file, content, 'utf8');
