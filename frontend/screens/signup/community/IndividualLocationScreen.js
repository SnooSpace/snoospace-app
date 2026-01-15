/**
 * IndividualLocationScreen.js
 *
 * GPS-based location screen for Individual Organizers.
 * Based on MemberLocationScreen but with custom text for community organizers.
 */

import React, { useState, useEffect, useRef } from "react";
import { CommonActions } from "@react-navigation/native";
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
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const IndividualLocationScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
    location: initialLocation,
  } = route.params || {};

  const [location, setLocation] = useState(
    initialLocation || {
      address: "",
      city: "",
      state: "",
      country: "",
      lat: null,
      lng: null,
    }
  );
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const navigatedRef = useRef(false);

  // Update step on mount and hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark step
      try {
        await updateCommunitySignupDraft("IndividualLocation", {});
        console.log(
          "[IndividualLocationScreen] Step set to IndividualLocation"
        );
      } catch (e) {
        console.log(
          "[IndividualLocationScreen] Step update failed:",
          e.message
        );
      }

      // Hydrate from draft
      if (!initialLocation || !initialLocation.city) {
        const draftData = await getCommunityDraftData();
        if (draftData?.location && draftData.location.city) {
          console.log("[IndividualLocationScreen] Hydrating from draft");
          setLocation(draftData.location);
        }
      }
    };
    initScreen();
  }, []);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // No navigation history (resumed from draft) - replace to previous screen
      navigation.replace("CommunityCategory", {
        email,
        accessToken,
        refreshToken,
        name,
        logo_url,
        bio,
        category,
        categories,
        community_type,
        college_id,
        college_name,
        college_subtype,
        club_type,
        community_theme,
        college_pending,
        isStudentCommunity,
      });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      })
    );
  };

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

        // Update draft with location
        try {
          await updateCommunitySignupDraft("IndividualLocation", {
            location: resolved,
          });
          console.log("[IndividualLocationScreen] Draft updated with location");
        } catch (e) {
          console.log(
            "[IndividualLocationScreen] Draft update failed:",
            e.message
          );
        }
      } else {
        const resolved = { ...location, lat: latitude, lng: longitude };
        setLocation(resolved);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleNext = async () => {
    // Update draft
    try {
      await updateCommunitySignupDraft("IndividualLocation", { location });
      console.log("[IndividualLocationScreen] Draft updated");
    } catch (e) {
      console.log("[IndividualLocationScreen] Draft update failed:", e.message);
    }

    // Individual organizers go directly to Username (skip Phone/Heads)
    navigation.navigate("CommunityUsername", {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      community_type,
      college_id,
      college_name,
      college_subtype,
      club_type,
      community_theme,
      college_pending,
      isStudentCommunity,
    });
  };

  // Check if location is set
  const hasLocation = location.city && location.city.trim().length > 0;
  const isButtonDisabled = !hasLocation;

  return (
    <SafeAreaView style={styles.safeArea}>
      <SignupHeader
        onBack={handleBack}
        onCancel={() => setShowCancelModal(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Where are you located?</Text>

          {/* Location Card - shown when location is set */}
          {hasLocation && (
            <View style={styles.locationCard}>
              <View style={styles.locationCardContent}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={COLORS.success || "#00C851"}
                />
                <View style={styles.locationCardText}>
                  <Text style={styles.locationCity}>
                    {location.city}
                    {location.state ? `, ${location.state}` : ""}
                  </Text>
                  {location.country && (
                    <Text style={styles.locationCountry}>
                      {location.country}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Use/Update Current Location Button */}
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
              {loadingLocation
                ? "Getting location..."
                : hasLocation
                ? "Update Location"
                : "Use Current Location"}
            </Text>
          </TouchableOpacity>

          {/* Custom text for Individual Organizers */}
          <Text style={styles.helperText}>
            This city will be set as your primary event location. This doesn't
            mean you always have to host events in this location.
          </Text>
        </View>
      </ScrollView>

      {/* Footer with Next button - visible when location is set */}
      {hasLocation && (
        <View style={styles.footer}>
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
      )}

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 30,
  },
  locationCard: {
    backgroundColor: "#F0FFF4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#00C85133",
  },
  locationCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationCardText: {
    marginLeft: 12,
    flex: 1,
  },
  locationCity: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  locationCountry: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 16,
  },
  locationButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
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
});

export default IndividualLocationScreen;
