const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/signup/member/MemberPronounsScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Imports
content = content.replace(
  'import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView } from "react-native";',
  'import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, ImageBackground } from "react-native";\nimport { BlurView } from "expo-blur";\nimport wave from "../../../assets/wave.png";'
);

// 2. Wrap SafeAreaView with ImageBackground
content = content.replace(
  '<SafeAreaView style={styles.safeArea}>',
  '<ImageBackground source={wave} style={styles.backgroundImage} imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: 1 }] }} blurRadius={10}>\n    <SafeAreaView style={styles.safeArea}>'
);

// Close ImageBackground at the end of component
content = content.replace(
  '    </SafeAreaView>\n  );\n};',
  '    </SafeAreaView>\n    </ImageBackground>\n  );\n};'
);

// 3. Add role to SignupHeader
content = content.replace(
  '<SignupHeader\n        onBack',
  '<SignupHeader\n        role="People"\n        onBack'
);

// 4. Refactor Content & Footer
const contentStart = '{/* Content Section */}';
const footerEnd = '      </View>';

const replacementDom = `{/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What are your pronouns?</Text>
          <Text style={styles.subtitle}>Select up to {MAX_SELECTIONS}</Text>

          <View style={styles.card}>
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              {/* Pronouns List */}
              <View style={styles.pronounsList}>
                {loading ? (
                  <SnooLoader size="large" color={COLORS.primary} />
                ) : allPronouns.length === 0 ? (
                  <Text style={[styles.subtitle, { fontFamily: 'Manrope-Medium' }]}>No pronouns available</Text>
                ) : (
                  <>
                    {allPronouns.map((pronoun) => (
                      <PronounRow
                        key={pronoun}
                        label={pronoun}
                        isSelected={selectedPronouns.includes(pronoun)}
                        onPress={togglePronoun}
                        disabled={
                          preferNotToSaySelected && pronoun !== PREFER_NOT_TO_SAY
                        }
                      />
                    ))}
                    {/* Prefer not to say option */}
                    <PronounRow
                      key={PREFER_NOT_TO_SAY}
                      label={PREFER_NOT_TO_SAY}
                      isSelected={preferNotToSaySelected}
                      onPress={togglePronoun}
                      disabled={hasOtherPronounSelected}
                    />
                  </>
                )}
              </View>

              {/* Visible on Profile Toggle */}
              <TouchableOpacity
                style={[
                  styles.visibilityToggle,
                  preferNotToSaySelected && styles.visibilityToggleDisabled,
                ]}
                onPress={() =>
                  !preferNotToSaySelected && setVisibleOnProfile(!visibleOnProfile)
                }
                activeOpacity={preferNotToSaySelected ? 1 : 0.7}
                disabled={preferNotToSaySelected}
              >
                <View
                  style={[
                    styles.toggleCheckbox,
                    visibleOnProfile &&
                      !preferNotToSaySelected &&
                      styles.toggleCheckboxSelected,
                    preferNotToSaySelected && styles.checkboxDisabled,
                  ]}
                >
                  {visibleOnProfile && !preferNotToSaySelected && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={COLORS.textInverted}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.visibilityText,
                    preferNotToSaySelected && styles.visibilityTextDisabled,
                  ]}
                >
                  Visible on profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Next Button */}
          <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
            <TouchableOpacity
              style={[
                styles.nextButtonContainer,
                isButtonDisabled && styles.nextButtonDisabled,
                { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
              ]}
              onPress={handleNext}
              activeOpacity={0.8}
              disabled={isButtonDisabled}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                <Text style={styles.buttonText}>Next</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>`;

let newContent = content.substring(0, content.indexOf(contentStart)) + replacementDom + content.substring(content.indexOf(footerEnd) + footerEnd.length);
// Remove the lingering </ScrollView> that was between content and footer originally but now needs to move
newContent = newContent.replace('</ScrollView>\n\n      {/* Fixed Footer Section */}\n      <View style={styles.footer}>', '');
// re-add </ScrollView> properly before CancelSignupModal
newContent = newContent.replace('{/* Cancel Confirmation Modal */}', '</ScrollView>\n\n      {/* Cancel Confirmation Modal */}');

// 5. Update Styles
let stylesPart = newContent.substring(newContent.indexOf('const styles = StyleSheet.create({'));
stylesPart = stylesPart.replace(
  '  safeArea: {\n    flex: 1,\n    backgroundColor: COLORS.background,\n    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,\n  },',
  '  backgroundImage: {\n    flex: 1,\n    width: "100%",\n    height: "100%",\n    backgroundColor: COLORS.background,\n  },\n  safeArea: {\n    flex: 1,\n    backgroundColor: "transparent",\n    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,\n  },'
);

stylesPart = stylesPart.replace(
  '  title: {\n    fontSize: 28,\n    fontWeight: "bold",',
  '  title: {\n    fontSize: 34,\n    fontFamily: "BasicCommercial-Black",\n    letterSpacing: -1,'
);

stylesPart = stylesPart.replace(
  '  subtitle: {\n    fontSize: 14,\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },',
  '  subtitle: {\n    fontSize: 15,\n    fontFamily: "Manrope-Regular",\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },\n  card: {\n    backgroundColor: "rgba(255, 255, 255, 0.2)",\n    borderRadius: 24,\n    ...Platform.select({\n      ios: {\n        ...SHADOWS.xl,\n        shadowOpacity: 0.10,\n        shadowRadius: 24,\n      },\n      android: {\n        elevation: 0,\n      },\n    }),\n    borderWidth: 1,\n    borderColor: "rgba(255, 255, 255, 0.9)",\n    overflow: "hidden",\n  },\n  cardContent: {\n    padding: 24,\n  },'
);

stylesPart = stylesPart.replace(
  '  pronounText: {\n    fontSize: 16,\n    color: COLORS.textPrimary,\n  },',
  '  pronounText: {\n    fontSize: 16,\n    fontFamily: "Manrope-Medium",\n    color: COLORS.textPrimary,\n  },'
);

stylesPart = stylesPart.replace(
  '  visibilityText: {\n    fontSize: 16,\n    color: COLORS.textPrimary,\n  },',
  '  visibilityText: {\n    fontSize: 15,\n    fontFamily: "Manrope-Regular",\n    color: COLORS.textPrimary,\n  },'
);

// Replace button styles
const nextBtnRegex = /nextButtonContainer: {[\s\S]*?buttonText: {[\s\S]*?},/m;
const newBtnStyles = `nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },`;

stylesPart = stylesPart.replace(nextBtnRegex, newBtnStyles);

// Remove footer styles entirely
stylesPart = stylesPart.replace(/  \/\/ --- Footer Styles ---\n  footer: {[\s\S]*?visibilityToggle:/m, '  visibilityToggle:');

newContent = newContent.substring(0, newContent.indexOf('const styles = StyleSheet.create({')) + stylesPart;

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully updated MemberPronounsScreen.js");
