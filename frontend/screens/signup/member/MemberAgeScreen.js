import React, { useState } from "react";
import {
  StyleSheet,
  Alert,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
  TextInput,
  Platform,
  StatusBar,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import {
  updateSignupDraft,
  deleteSignupDraft,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

// --- Design Constants ---
// Removed local constants in favor of theme constants

export default function Example({ navigation, route }) {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob: initialDob,
  } = route?.params || {};
  const [form, setForm] = useState(
    initialDob ? { dateOfBirth: initialDob } : {}
  );
  const [input, setInput] = useState(
    initialDob
      ? initialDob.replace(/-/g, "").slice(4) +
          initialDob.replace(/-/g, "").slice(0, 4)
      : ""
  );
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleInputChange = (value) => {
    setInput(value);

    if (value.length === 8) {
      try {
        const year = parseInt(value.slice(4, 8), 10);

        if (Number.isNaN(year) || year < 1900 || year > 2025) {
          throw new Error("Invalid year.");
        }

        const month = parseInt(value.slice(0, 2), 10);

        if (Number.isNaN(month) || month < 1 || month > 12) {
          throw new Error("Invalid month.");
        }

        const day = parseInt(value.slice(2, 4), 10);
        const maxDaysInMonth = new Date(year, month, 0).getDate();

        if (Number.isNaN(day) || day < 1 || day > maxDaysInMonth) {
          throw new Error("Invalid day.");
        }

        setForm({ dateOfBirth: `${year}-${month}-${day}` });
      } catch (_) {
        Alert.alert("Invalid date entered, try again.");
        setInput("");
      }
    }
  };

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const handleNext = async () => {
    if (!form.dateOfBirth) {
      Alert.alert("Please enter a valid date");
      return;
    }

    // Calculate age
    const birthDate = new Date(form.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    Alert.alert("Confirm your age", `You are ${age} years old.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          // Update client-side draft
          try {
            await updateSignupDraft("MemberAge", { dob: form.dateOfBirth });
            console.log("[MemberAgeScreen] Draft updated with dob");
          } catch (e) {
            console.log("[MemberAgeScreen] Draft update failed:", e.message);
          }

          navigation?.navigate?.("MemberPronouns", {
            email,
            accessToken,
            refreshToken,
            name,
            profile_photo_url,
            dob: form.dateOfBirth,
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MemberProfilePic", {
                  email,
                  accessToken,
                  refreshToken,
                  name,
                });
              }
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowCancelModal(true)}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.title}>Enter your Birthday</Text>
        <Text style={styles.subtitle}>
          Provide your birth date to complete your profile.
        </Text>

        {/* Input */}
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

                return (
                  <Text key={index} style={styles.inputChar}>
                    {placeholder === "/" || !current ? (
                      <Text style={styles.inputCharEmpty}>{placeholder}</Text>
                    ) : (
                      current
                    )}
                  </Text>
                );
              })}
            </View>
          </View>

          <Text style={styles.subtitle}>
            Your profile will show your age, not your date of birth.
          </Text>
        </View>

        {/* Button */}
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
        </TouchableOpacity>
      </View>

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 31,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  form: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginTop: 24,
  },
  backButton: {
    padding: 15,
    marginLeft: -15, // Adjusted to match other screens
  },
  header: {
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    // Removed marginTop: 50
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.primary || "#007AFF",
    fontWeight: "500",
  },
  input: {
    marginBottom: 16,
    position: "relative",
  },
  inputControl: {
    height: 50,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 1,
    color: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "solid",
    zIndex: 2,
  },
  inputControlFocused: {
    borderColor: COLORS.primary,
  },
  inputOverflow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    zIndex: 1,
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  inputChar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    lineHeight: 50,
    fontSize: 28,
    textAlign: "center",
    fontWeight: "600",
  },
  inputCharEmpty: {
    color: "#BBB9BC",
    fontWeight: "400",
  },
  btnContainer: {
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
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  progressBarActive: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: "100%",
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
    marginLeft: 5,
  },
  header: {
    paddingVertical: 15,
  },
});
