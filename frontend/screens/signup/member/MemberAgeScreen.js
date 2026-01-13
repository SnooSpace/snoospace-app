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
import GlassBackButton from "../../../components/GlassBackButton";
import {
  updateSignupDraft,
  deleteSignupDraft,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import AgeConfirmationModal from "../../../components/modals/AgeConfirmationModal";

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
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(0);
  const [formattedBirthDate, setFormattedBirthDate] = useState("");

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

    // Format birth date: "30 November 2004"
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const formattedDate = `${birthDate.getDate()} ${
      months[birthDate.getMonth()]
    } ${birthDate.getFullYear()}`;

    setCalculatedAge(age);
    setFormattedBirthDate(formattedDate);
    setShowAgeModal(true);
  };

  const onConfirmAge = async () => {
    setShowAgeModal(false);
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
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <GlassBackButton
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("MemberProfilePic", {
                email,
                accessToken,
                refreshToken,
                name,
              });
            }
          }}
          style={styles.backButton}
        />

        <TouchableOpacity
          onPress={() => setShowCancelModal(true)}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
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

      <AgeConfirmationModal
        visible={showAgeModal}
        age={calculatedAge}
        birthDate={formattedBirthDate}
        onConfirm={onConfirmAge}
        onEdit={() => setShowAgeModal(false)}
      />
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
  contentContainer: {
    flex: 1,
    paddingHorizontal: 25,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 28, // Adjusted to 28 to match Gender screen
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },
  form: {
    marginBottom: 20,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "500",
  },
  input: {
    marginBottom: 30, // Increased spacing
    position: "relative",
    alignItems: "center", // Center the input container
  },
  inputControl: {
    height: 50,
    width: "100%",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 1,
    color: "transparent",
    borderWidth: 0, // Removed border
    zIndex: 2,
  },
  inputControlFocused: {
    // No specific focus style needed for the invisible input itself
  },
  inputOverflow: {
    backgroundColor: "transparent", // Removed background
    zIndex: 1,
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center", // Center the characters
    alignItems: "center",
    gap: 8, // Add gap between characters
  },
  inputCharContainer: {
    width: 30,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#000",
  },
  inputCharContainerSlash: {
    width: 20,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 0, // No underline for slash
  },
  inputChar: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
  },
  inputCharEmpty: {
    // No placeholder needed for empty lines in this design, or could clearly show empty space
    // But user image implies just the line is visible when empty.
  },
  slashText: {
    fontSize: 24,
    fontWeight: "400",
    color: "#C7C7CC", // Lighter color for slash
  },
  btnContainer: {
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
  },
});
