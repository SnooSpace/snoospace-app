const fs = require('fs');
const file = 'c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/signup/community/CommunityLogoscreen.js';

let lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

// 1. Find line with `{/* Profile Picture Upload Area */}`
let uploadAreaIdx = lines.findIndex(l => l.includes('{/* Profile Picture Upload Area */}'));

lines.splice(uploadAreaIdx, 0,
  '          <View style={styles.card}>',
  '            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />',
  '            <View style={styles.cardContent}>'
);

// 2. We need to delete the footer section and place it before `</ScrollView>`
let scrollViewCloseIdx = lines.findIndex(l => l.includes('</ScrollView>'));
let footerStartIdx = lines.findIndex(l => l.includes('{/* Fixed Footer/Button Section */}'));
let cancelModalIdx = lines.findIndex(l => l.includes('{/* Cancel Confirmation Modal */}'));

// Extract the next button from the footer. It starts inside `<View style={styles.footer}>` (index footerStartIdx+1) and ends before cancel modal.
// Wait, the footer is from footerStartIdx to cancelModalIdx - 2.
// Alternatively, I will just insert the new button text before </ScrollView>, and delete the entire footer.

let newCode = `          </TouchableOpacity>
          {/* Next Button moved inside the Card */}
          <View style={{ width: "100%", marginTop: 40 }}>
            <TouchableOpacity
              style={[
                styles.nextButtonContainer,
                isButtonDisabled && styles.disabledButton,
              ]}
              onPress={handleNext}
              disabled={isButtonDisabled}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                {isLoading ? (
                  <SnooLoader color={COLORS.textInverted} size="small" />
                ) : (
                  <Text style={[styles.buttonText, { fontFamily: 'Manrope-SemiBold' }]}>Next</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>`;

// Find scrollViewCloseIdx again since splicing changed indices
scrollViewCloseIdx = lines.findIndex(l => l.includes('</ScrollView>'));

// Insert the new closing and button code before </ScrollView>. Wait, there's `          </TouchableOpacity>\n        </View>` BEFORE `</ScrollView>`.
// So insert it instead of the old closing tag and view.
let touchableCloseIdx = scrollViewCloseIdx - 2;
// delete the old `          </TouchableOpacity>` and `        </View>` before `</ScrollView>`
lines.splice(touchableCloseIdx, 2, ...newCode.split('\n'));

// Now find footer again
footerStartIdx = lines.findIndex(l => l.includes('{/* Fixed Footer/Button Section */}'));
cancelModalIdx = lines.findIndex(l => l.includes('{/* Cancel Confirmation Modal */}'));

if (footerStartIdx !== -1 && cancelModalIdx !== -1) {
  // delete footer
  lines.splice(footerStartIdx, cancelModalIdx - footerStartIdx);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('done');
