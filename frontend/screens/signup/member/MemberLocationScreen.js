import React, { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow and location icon

import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
// Removed local constants in favor of theme constants

const LocationInputScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    phone,
    name,
    gender,
    pronouns,
    showPronouns,
    dob,
    interests,
  } = route.params || {};
  const [location, setLocation] = useState({
    address: "",
    city: "",
    state: "",
    country: "",
    lat: null,
    lng: null,
  });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const navigatedRef = useRef(false);

  const handleGetLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to auto-detect your location.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                try {
                  Linking.openSettings();
                } catch {}
              },
            },
          ]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (reverseGeocode && reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const resolved = {
          address: addr.street || addr.name || "",
          city: addr.city || addr.subAdministrativeArea || "",
          state: addr.region || addr.administrativeArea || "",
          country: addr.country || "",
          lat: latitude,
          lng: longitude,
        };
        setLocation(resolved);
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigation.navigate("MemberProfilePic", {
            email,
            accessToken,
            refreshToken,
            phone,
            name,
            gender,
            pronouns,
            showPronouns,
            dob,
            interests,
            location: resolved,
          });
        }
      } else {
        const resolved = { ...location, lat: latitude, lng: longitude };
        setLocation(resolved);
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          navigation.navigate("MemberProfilePic", {
            email,
            accessToken,
            refreshToken,
            phone,
            name,
            gender,
            pronouns,
            showPronouns,
            dob,
            interests,
            location: resolved,
          });
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleNext = () => {
    navigation.navigate("MemberProfilePic", {
      email,
      accessToken,
      refreshToken,
      phone,
      name,
      gender,
      pronouns,
      showPronouns,
      dob,
      interests,
      location: location,
    });
  };

  // Button disabled (kept as fallback, but we auto-navigate on success)
  const isButtonDisabled = !location.city || location.city.trim().length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Where are you located?</Text>

          {/* Use Current Location Button */}
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="location" size={20} color={COLORS.primary} />
            )}
            <Text style={styles.locationButtonText}>
              {loadingLocation ? "Getting location..." : "Use Current Location"}
            </Text>
          </TouchableOpacity>

          {/* Helper text */}
          <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>
            We only use your location while the app is open to show nearby
            events and improve recommendations.
          </Text>
        </View>
      </ScrollView>

      {/* No footer button needed; we auto-advance after locating. Keep hidden fallback button for safety. */}
      <View style={[styles.footer, { display: "none" }]}>
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
            <Text style={styles.buttonText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 5,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1, // Pushes back button to the left
    textAlign: "center",
    marginLeft: -40, // Adjust to center the text visually
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  // ProgressBar handles active fill
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 40,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: "#f8f9fa", // Light background for the input field
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },
  locationIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 0, // Ensures text is centered vertically
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 12,
  },
  locationButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  locationFields: {
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: "#FFFFFF",
  },
  locationInput: {
    marginBottom: 0,
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    marginBottom: 50,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -15, // Optional: Offset to visually align the icon with the screen edge
  },
  // Map Picker Modal Styles
  mapModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mapCloseButton: {
    padding: 8,
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  mapConfirmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  mapConfirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  mapSearchContainer: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 5,
    backgroundColor: "transparent",
  },
  map: {
    flex: 1,
  },
});

export default LocationInputScreen;
