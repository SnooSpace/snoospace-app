const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/signup/member/MemberAgeScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Imports
content = content.replace(
  'import {\n  Animated,',
  'import {\n  ImageBackground,\n  Animated,'
);
content = content.replace(
  'import { Ionicons } from "@expo/vector-icons";',
  'import { Ionicons } from "@expo/vector-icons";\nimport { BlurView } from "expo-blur";\nimport wave from "../../../assets/wave.png";'
);

// 2. Wrap SafeAreaView with ImageBackground
content = content.replace(
  '<SafeAreaView style={styles.safeArea}>',
  '<ImageBackground source={wave} style={styles.backgroundImage} imageStyle={{ opacity: 0.3, transform: [{ rotate: "90deg" }] }} blurRadius={10}>\n    <SafeAreaView style={styles.safeArea}>'
);

// Close ImageBackground at the end of component
content = content.replace(
  '    </SafeAreaView>\n  );\n}',
  '    </SafeAreaView>\n    </ImageBackground>\n  );\n}'
);

// 3. Add role to SignupHeader
content = content.replace(
  '<SignupHeader\n        onBack',
  '<SignupHeader\n        role="People"\n        onBack'
);

// 4. Wrap form in Card and move button
const formStart = '{/* Input */}\n        <View style={styles.form}>';
const formEnd = '          ) : null}\n        </View>';
const buttonSection = `        {/* Button */}
        <TouchableOpacity
          onPress={handleNext}
          style={styles.btnContainer}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btn}
          >
            <Text style={styles.btnText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>`;

const newFormAndButton = `{/* Input */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            <View style={styles.form}>
${content.substring(content.indexOf(formStart) + formStart.length, content.indexOf(formEnd))}          ) : null}
            </View>
          </View>
        </View>

        {/* Next Button Moved Outside Card */}
        <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
          <TouchableOpacity
            style={[
              styles.nextButtonContainer,
              { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
            ]}
            onPress={handleNext}
            activeOpacity={0.8}
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
        </View>`;

const oldSection = content.substring(content.indexOf(formStart), content.indexOf(buttonSection) + buttonSection.length);
content = content.replace(oldSection, newFormAndButton);

// 5. Update Styles
let stylesPart = content.substring(content.indexOf('const styles = StyleSheet.create({'));
stylesPart = stylesPart.replace(
  '  safeArea: {\n    flex: 1,\n    backgroundColor: COLORS.background,\n    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,\n  },',
  '  backgroundImage: {\n    flex: 1,\n    width: "100%",\n    height: "100%",\n    backgroundColor: COLORS.background,\n  },\n  safeArea: {\n    flex: 1,\n    backgroundColor: "transparent",\n    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,\n  },'
);

stylesPart = stylesPart.replace(
  '  title: {\n    fontSize: 28, // Adjusted to 28 to match Gender screen\n    fontWeight: "bold",',
  '  title: {\n    fontSize: 34,\n    fontFamily: "BasicCommercial-Black",\n    letterSpacing: -1,'
);

stylesPart = stylesPart.replace(
  '  subtitle: {\n    fontSize: 16,\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },',
  '  subtitle: {\n    fontSize: 15,\n    fontFamily: "Manrope-Regular",\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },\n  card: {\n    backgroundColor: "rgba(255, 255, 255, 0.2)",\n    borderRadius: 24,\n    ...Platform.select({\n      ios: {\n        ...SHADOWS.xl,\n        shadowOpacity: 0.10,\n        shadowRadius: 24,\n      },\n      android: {\n        elevation: 0,\n      },\n    }),\n    borderWidth: 1,\n    borderColor: "rgba(255, 255, 255, 0.9)",\n    overflow: "hidden",\n  },\n  cardContent: {\n    padding: 24,\n  },'
);

// Replace button styles
const oldBtnStyles = `  btnContainer: {
    marginTop: 20, // Added some top margin
    marginBottom: 50,
    borderRadius: 12,
    ...SHADOWS.primaryGlow,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
  },
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    color: COLORS.textInverted,
  },`;

const newBtnStyles = `  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
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

stylesPart = stylesPart.replace(oldBtnStyles, newBtnStyles);
content = content.substring(0, content.indexOf('const styles = StyleSheet.create({')) + stylesPart;

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated MemberAgeScreen.js");
