const fs = require('fs');

const file = "c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/profile/member/EditProfileScreen.js";
let content = fs.readFileSync(file, 'utf8');

// The exact string to remove is:
//           </View>
//         </View>
//
//
//
//         {/* Card [N]

// Let's just do exact string replacement to be extremely safe.

const exactReplacement1 = `          </View>
        </View>

          </View>
        </View>



        {/* Card 2: About Me */}`;

const desired1 = `          </View>
        </View>

        {/* Card 2: About Me */}`;

content = content.replace(exactReplacement1, desired1);


const exactReplacement2 = `          </View>
        </View>

          </View>
        </View>



        {/* Card 3: Occupation */}`;

const desired2 = `          </View>
        </View>

        {/* Card 3: Occupation */}`;

content = content.replace(exactReplacement2, desired2);


const exactReplacement3 = `          </View>
        </View>

          </View>
        </View>



        {/* Card 5: My Vibes (Scalable Redesign) */}`;

const desired3 = `          </View>
        </View>

        {/* Card 5: My Vibes (Scalable Redesign) */}`;

content = content.replace(exactReplacement3, desired3);


const exactReplacement4 = `          </View>
        </View>

          </View>
        </View>



        {/* Card 6: Private Details */}`;

const desired4 = `          </View>
        </View>

        {/* Card 6: Private Details */}`;

content = content.replace(exactReplacement4, desired4);

fs.writeFileSync(file, content, 'utf8');
console.log("Cleaned up duplicated View tags precisely");
