import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { apiPost } from "../api/client";

// --- CONSTANTS DEFINED LOCALLY ---
const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  inputBorder: "#E0E0E0",
  white: "#fff",
  success: "#4CAF50",
};

const FONT_SIZES = {
  largeHeader: 28,
  body: 16,
  small: 13,
};

const SPACING = {
  horizontal: 24,
  vertical: 20,
};
// ---------------------------------

const STEPS = {
  EMAIL: 0,
  OTP: 1,
  PHONE: 2,
  NAME: 3,
  GENDER: 4,
  DOB: 5,
  INTERESTS: 6,
  PROFILE_PIC: 7,
  PHOTOS: 8,
  COMPLETE: 9,
};

const GENDER_OPTIONS = ["Male", "Female", "Non-binary"];
const INTEREST_OPTIONS = [
  "Technology", "Music", "Sports", "Art", "Travel", "Food", "Fitness",
  "Gaming", "Photography", "Reading", "Movies", "Dancing", "Cooking"
];

const MemberSignupScreen = ({ navigation, route }) => {
  const { selectedRole } = route.params || {};
  const [currentStep, setCurrentStep] = useState(STEPS.EMAIL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    phone: "",
    name: "",
    gender: "",
    dob: "",
    interests: [],
    profilePic: null,
    photos: [],
  });

  const handleNext = async () => {
    setError("");
    setLoading(true);

    try {
      switch (currentStep) {
        case STEPS.EMAIL:
          await apiPost("/auth/send-otp", { email: formData.email });
          setCurrentStep(STEPS.OTP);
          break;
        
        case STEPS.OTP:
          const resp = await apiPost("/auth/verify-otp", { 
            email: formData.email, 
            token: formData.otp 
          });
          // Store access token for later use
          formData.accessToken = resp.data?.session?.access_token;
          setCurrentStep(STEPS.PHONE);
          break;
        
        case STEPS.PHONE:
          if (!/^\d{10}$/.test(formData.phone)) {
            setError("Phone must be 10 digits");
            return;
          }
          setCurrentStep(STEPS.NAME);
          break;
        
        case STEPS.NAME:
          if (!formData.name.trim()) {
            setError("Name is required");
            return;
          }
          setCurrentStep(STEPS.GENDER);
          break;
        
        case STEPS.GENDER:
          if (!formData.gender) {
            setError("Please select a gender");
            return;
          }
          setCurrentStep(STEPS.DOB);
          break;
        
        case STEPS.DOB:
          if (!formData.dob) {
            setError("Date of birth is required");
            return;
          }
          setCurrentStep(STEPS.INTERESTS);
          break;
        
        case STEPS.INTERESTS:
          if (formData.interests.length < 3) {
            setError("Please select at least 3 interests");
            return;
          }
          setCurrentStep(STEPS.PROFILE_PIC);
          break;
        
        case STEPS.PROFILE_PIC:
          setCurrentStep(STEPS.PHOTOS);
          break;
        
        case STEPS.PHOTOS:
          // Complete signup
          await apiPost("/members/signup", {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            dob: formData.dob,
            gender: formData.gender,
            city: "Bengaluru", // TODO: Get from location
            interests: formData.interests,
          });
          setCurrentStep(STEPS.COMPLETE);
          break;
        
        case STEPS.COMPLETE:
          navigation.navigate("MemberHome");
          break;
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.EMAIL) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const toggleInterest = (interest) => {
    const newInterests = formData.interests.includes(interest)
      ? formData.interests.filter(i => i !== interest)
      : [...formData.interests, interest];
    setFormData({ ...formData, interests: newInterests });
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.EMAIL:
        return (
          <View>
            <Text style={styles.title}>Enter your email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />
          </View>
        );

      case STEPS.OTP:
        return (
          <View>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to {formData.email}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={formData.otp}
              onChangeText={(text) => setFormData({ ...formData, otp: text })}
            />
          </View>
        );

      case STEPS.PHONE:
        return (
          <View>
            <Text style={styles.title}>Enter your phone number</Text>
            <TextInput
              style={styles.input}
              placeholder="9999999999"
              keyboardType="number-pad"
              maxLength={10}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
            />
          </View>
        );

      case STEPS.NAME:
        return (
          <View>
            <Text style={styles.title}>What's your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
          </View>
        );

      case STEPS.GENDER:
        return (
          <View>
            <Text style={styles.title}>What's your gender?</Text>
            {GENDER_OPTIONS.map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[
                  styles.optionButton,
                  formData.gender === gender && styles.selectedOption
                ]}
                onPress={() => setFormData({ ...formData, gender })}
              >
                <Text style={[
                  styles.optionText,
                  formData.gender === gender && styles.selectedOptionText
                ]}>
                  {gender}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case STEPS.DOB:
        return (
          <View>
            <Text style={styles.title}>When were you born?</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={formData.dob}
              onChangeText={(text) => setFormData({ ...formData, dob: text })}
            />
          </View>
        );

      case STEPS.INTERESTS:
        return (
          <View>
            <Text style={styles.title}>What are your interests?</Text>
            <Text style={styles.subtitle}>Select at least 3 (max 7)</Text>
            <ScrollView style={styles.interestsContainer}>
              {INTEREST_OPTIONS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    formData.interests.includes(interest) && styles.selectedInterest
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[
                    styles.interestText,
                    formData.interests.includes(interest) && styles.selectedInterestText
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.counter}>
              {formData.interests.length}/7 selected
            </Text>
          </View>
        );

      case STEPS.PROFILE_PIC:
        return (
          <View>
            <Text style={styles.title}>Add a profile picture</Text>
            <Text style={styles.subtitle}>This will be your main profile photo</Text>
            <TouchableOpacity style={styles.photoButton}>
              <Text style={styles.photoButtonText}>+ Add Photo</Text>
            </TouchableOpacity>
          </View>
        );

      case STEPS.PHOTOS:
        return (
          <View>
            <Text style={styles.title}>Add more photos</Text>
            <Text style={styles.subtitle}>Show people who you are (optional)</Text>
            <TouchableOpacity style={styles.photoButton}>
              <Text style={styles.photoButtonText}>+ Add Photos</Text>
            </TouchableOpacity>
          </View>
        );

      case STEPS.COMPLETE:
        return (
          <View style={styles.completeContainer}>
            <Text style={styles.title}>Welcome to SnooSpace!</Text>
            <Text style={styles.subtitle}>
              Your member profile has been created successfully.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepIndicator}>
              Step {currentStep + 1} of {Object.keys(STEPS).length - 1}
            </Text>
          </View>

          <ScrollView style={styles.content}>
            {renderStep()}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.nextButton, loading && styles.disabledButton]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Loading..." : 
               currentStep === STEPS.COMPLETE ? "Get Started" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.horizontal,
    paddingVertical: SPACING.vertical,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: FONT_SIZES.body,
    color: COLORS.primary,
  },
  stepIndicator: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBorder,
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
    marginBottom: 20,
  },
  optionButton: {
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "10",
  },
  optionText: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  interestsContainer: {
    maxHeight: 300,
    marginBottom: 20,
  },
  interestChip: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  selectedInterest: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  interestText: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textDark,
  },
  selectedInterestText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  counter: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
    textAlign: "center",
  },
  photoButton: {
    height: 100,
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  photoButtonText: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
  },
  completeContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
  errorText: {
    color: "red",
    fontSize: FONT_SIZES.small,
    textAlign: "center",
    marginTop: 10,
  },
});

export default MemberSignupScreen;
