const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/sanja/OneDrive/Documents/Harshith/SnooSpace/frontend/screens/signup/member/MemberAgeScreen.js';
let content = fs.readFileSync(filePath, 'utf8');

// The file currently has duplicate SafeAreas and styles missed the first pass. 
// We will do a full targeted surgical rewrite of the DOM and styles section.

const domStart = '<View style={styles.contentContainer}>';
const domEnd = '      <AgeConfirmationModal';

const replacementDom = `<ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.contentContainer}>
        {/* Title */}
        <Text style={styles.title}>Enter your Birthday</Text>
        <Text style={styles.subtitle}>
          Provide your birth date to complete your profile.
        </Text>

        {/* Input */}
        <View style={styles.card}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={styles.cardContent}>
            <View style={styles.form}>
              <View style={styles.input}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                  caretHidden={true}
                  keyboardType="number-pad"
                  maxLength={8}
                  onChangeText={handleInputChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  returnKeyType="done"
                  style={[
                    styles.inputControl,
                    isFocused && styles.inputControlFocused,
                  ]}
                  value={input}
                />

                <View style={styles.inputOverflow}>
                  {"MM/DD/YYYY".split("").map((placeholder, index, arr) => {
                    const countDelimiters = arr
                      .slice(0, index)
                      .filter((char) => char === "/").length;
                    const indexWithoutDelimeter = index - countDelimiters;
                    const current = input[indexWithoutDelimeter];
                    const isSlash = placeholder === "/";

                    return (
                      <View
                        key={index}
                        style={
                          isSlash
                            ? styles.inputCharContainerSlash
                            : styles.inputCharContainer
                        }
                      >
                        {isSlash ? (
                          <Text style={styles.slashText}>/</Text>
                        ) : (
                          <Text style={styles.inputChar}>{current || ""}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.formSubtitle}>
                Your profile will show your age, not your date of birth.
              </Text>
              {error ? (
                <Animated.Text
                  style={[
                    styles.errorText,
                    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                  ]}
                >
                  {error}
                </Animated.Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Button */}
        <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
          <TouchableOpacity
            onPress={handleNext}
            style={styles.nextButtonContainer}
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
        </View>
      </View>
      </ScrollView>
`;

let newContent = content.substring(0, content.indexOf(domStart)) + replacementDom + content.substring(content.indexOf(domEnd));

// Fix up the styles that are remaining
newContent = newContent.replace(
  '  title: {\n    fontSize: 28, // Adjusted to 28 to match Gender screen\n    fontWeight: "bold",\n    color: COLORS.textPrimary,\n    marginBottom: 10,\n  },',
  '  title: {\n    fontSize: 34,\n    fontFamily: "BasicCommercial-Black",\n    color: COLORS.textPrimary,\n    marginBottom: 10,\n    letterSpacing: -1,\n  },'
);

newContent = newContent.replace(
  '  subtitle: {\n    fontSize: 16,\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },',
  '  subtitle: {\n    fontSize: 15,\n    fontFamily: "Manrope-Regular",\n    color: COLORS.textSecondary,\n    marginBottom: 30,\n  },\n  formSubtitle: {\n    fontSize: 14,\n    fontFamily: "Manrope-Regular",\n    color: COLORS.textSecondary,\n    textAlign: "center",\n    marginTop: 10,\n  },\n  card: {\n    backgroundColor: "rgba(255, 255, 255, 0.2)",\n    borderRadius: 24,\n    ...Platform.select({\n      ios: {\n        ...SHADOWS.xl,\n        shadowOpacity: 0.10,\n        shadowRadius: 24,\n      },\n      android: {\n        elevation: 0,\n      },\n    }),\n    borderWidth: 1,\n    borderColor: "rgba(255, 255, 255, 0.9)",\n    overflow: "hidden",\n  },\n  cardContent: {\n    padding: 24,\n  },'
);

// Fix button styles again
const btnRegex = /btnContainer: {[\s\S]*?errorText:/m;
const newBtnStyles = `nextButtonContainer: {
    minWidth: 160,
    marginRight: -33,
    paddingHorizontal: 32,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  errorText:`;

newContent = newContent.replace(btnRegex, newBtnStyles);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully fixed MemberAgeScreen.js DOM and styles");
