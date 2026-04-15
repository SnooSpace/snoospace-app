const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

// The file has several spots where we have:
//           </View>
//         </View>
//
//           </View>
//         </View>
//
//
//
//         {/* Card [N]

// Let's print out lines 580 to 600 to see what EXACTLY is there
const lines = content.split('\n');
console.log("--- Lines 580-600 ---");
for (let i = 580; i < 600; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}

// I will just remove lines 587, 588 from the output if they are the offending ones.
// Currently I know lines 587 and 588 are `          </View>` and `        </View>`
// But wait, it's actually:
// 586:         </View>
// 587: 
// 588:           </View>
// 589:         </View>
// 590: 
// 591: 
// 592: 
// 593:         {/* Card 2: About Me */}

// So we want to remove lines 587-589.
