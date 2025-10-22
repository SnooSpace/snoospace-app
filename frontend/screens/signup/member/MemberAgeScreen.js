import React, { useState } from "react";
import {
  StyleSheet,
  Alert,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
  TextInput,
} from "react-native";
import ProgressBar from "../../../components/Progressbar";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow

// --- Design Constants ---
const PRIMARY_COLOR = "#5f27cd"; // Deep purple for the button, progress bar, and selected state
const TEXT_COLOR = "#1e1e1e"; // Dark text color
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for step text
const BORDER_COLOR = "#ced4da"; // Light border color
const BACKGROUND_COLOR = "#ffffff"; // White background

export default function Example({ navigation, route }) {
  const { email, accessToken, phone, name, gender } = route?.params || {};
  const [form, setForm] = useState({});
  const [input, setInput] = useState("");

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <View style={styles.container}>
        {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 4 of 7</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={57} />
          </View>
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
              returnKeyType="done"
              style={styles.inputControl}
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
          onPress={() => {
            if (form.dateOfBirth) {
              // Calculate age properly considering month and day
              const birthDate = new Date(form.dateOfBirth);
              const today = new Date();
              
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              
              // If birthday hasn't occurred this year yet, subtract 1
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              
              Alert.alert("Confirm your age", `You are ${age} years old.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm",
                  onPress: () => {
                    navigation?.navigate?.("MemberInterests", {
                      email,
                      accessToken,
                      phone,
                      name,
                      gender,
                      dob: form.dateOfBirth,
                    });
                  },
                },
              ]);
            } else {
              Alert.alert("Please enter a valid date");
            }
          }}
          style={styles.btn}
        >
          <Text style={styles.btnText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    color: "#1D2A32",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#929292",
  },
  form: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    marginTop: 24,
  },
  backButton: {
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -20,
    marginTop: 50, // Optional: Offset to visually align the icon with the screen edge
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
    color: "transparent", // hides text
    borderWidth: 1,
    borderColor: "#C9D3DB",
    borderStyle: "solid",
    zIndex: 2,
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
  btn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    marginBottom: 50,
  },
  btnText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    color: "#fff",
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
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: "100%",
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
    marginLeft: 5,
  },
  header: {
    paddingVertical: 15,
  },
});
