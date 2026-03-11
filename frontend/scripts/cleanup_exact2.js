const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

// 586:         </View>
// 587: 
// 588:           </View>
// 589:         </View>
// 590: 
// 591: 
// 592: 
// 593:         {/* Card 2: About Me */}

// Same issue before Card 3:
// 610:         </View>
// 611: 
// 612:           </View>
// 613:         </View>
// 614: 
// 615: 
// 616: 
// 617:         {/* Card 3: Occupation */}

// Instead of hardcoding lines (which shift when we delete them), let's write a smarter regex that catches the EXACT spacing:
// Match "\n        </View>\n\n          </View>\n        </View>\n\n\n\n        {/* Card"
// Wait! The spacing is:
// `        </View>\n\n          </View>\n        </View>\n\n\n\n        {/* `

content = content.replace(
  /        <\/View>\n\n          <\/View>\n        <\/View>\n\n\n\n        \{\/\* Card/g,
  `        </View>\n\n        {/* Card`
);

// Check if Card 6 needs fixing:
// Oh, the last card (Card 6) doesn't have a "Card 7" after it, so the regex might not match the end of card 6.
// Let's also check the end.
// At the end of the file we have:
//           </View>
//         </View>
//       </View>
//
//         <View style={{ height: 0 }} />
//
// Wait, my view_file showed lines 580 to 620, so Card 1 and 2 were there.
// I will just write this content out and run the syntax check again to see if it fixed Card 1 and Card 2.

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed lines with regex targeting the exact spacing");
