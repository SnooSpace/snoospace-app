const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

// Card 3 ends before Card 5. Lines around 835-840. Let's find exactly the pattern:
// 836:           </View>
// 837:         </View>
// 838: 
// 839: 
// 840: 
// 841:         {/* Card 5: My Vibes (Scalable Redesign) */}

let foundCard5 = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('        {/* Card 5: My Vibes (Scalable Redesign) */}')) {
    if (lines[i-4] === '          </View>' && lines[i-3] === '        </View>' && lines[i-2] === '' && lines[i-1] === '') {
      lines.splice(i-4, 4);
      foundCard5 = true;
      console.log('Fixed tags before Card 5');
      break;
    }
  }
}

// Card 5 ends before Card 6. Let's find exactly the pattern before Card 6
let foundCard6 = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('        {/* Card 6: Private Details */}')) {
    if (lines[i-4] === '          </View>' && lines[i-3] === '        </View>' && lines[i-2] === '' && lines[i-1] === '') {
      lines.splice(i-4, 4);
      foundCard6 = true;
      console.log('Fixed tags before Card 6');
      break;
    }
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log("Completed specific line removals.");
