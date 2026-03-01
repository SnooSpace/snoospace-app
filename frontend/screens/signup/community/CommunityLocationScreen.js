import React, { useState, useEffect, useRef } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  StyleSheet, View, TouchableOpacity, Text, TextInput, SafeAreaView, Platform, StatusBar, Alert, KeyboardAvoidingView, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  getCurrentLocation,
  hasLocationPermission,
  requestLocationPermission,
} from "../../../utils/location";
import { reverseGeocodeStructured } from "../../../utils/geocoding";
import { isValidGoogleMapsUrl } from "../../../utils/validateGoogleMapsUrl";
import { parseGoogleMapsLink } from "../../../utils/googleMapsParser";
import { useLocationName } from "../../../utils/locationNameCache";

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
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityLocationScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    // NEW: Community type fields
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft, // True when resumed from draft (no navigation history)
  } = route.params || {};

  // Determine if this is an organization type (requires phone/heads)
  const isOrganization = !community_type || community_type === "organization";

  // Build common params to pass forward
  const commonParams = {
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
  };

  // Location state
  const [location, setLocation] = useState(null);
  const [displayAddress, setDisplayAddress] = useState("");
  const [locationUrl, setLocationUrl] = useState("");

  // Loading states
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isParsingUrl, setIsParsingUrl] = useState(false);

  // Validation state
  const [urlValid, setUrlValid] = useState(null);
  const [isUrlFocused, setIsUrlFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Track already-parsed URLs to prevent re-parsing on screen revisit
  const parsedUrlsRef = useRef(new Set());

  // Use the locationName hook to resolve the location name from Google Maps URL
  const resolvedLocationName = useLocationName(
    location?.googleMapsUrl || null,
    { fallback: "Loading location..." }
  );

  // Hydrate from draft
  useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getCommunityDraftData();
      if (draftData?.location) {
        console.log("[CommunityLocationScreen] Hydrating from draft");
        setLocation(draftData.location);
        if (draftData.location.address) {
          setDisplayAddress(draftData.location.address);
        } else if (draftData.location.googleMapsUrl) {
          // Mark this URL as already parsed to prevent re-parsing
          parsedUrlsRef.current.add(draftData.location.googleMapsUrl);
          setLocationUrl(draftData.location.googleMapsUrl);
          setUrlValid(true);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  // Validate URL on change
  useEffect(() => {
    if (!locationUrl.trim()) {
      setUrlValid(null);
      return;
    }

    const valid = isValidGoogleMapsUrl(locationUrl);
    setUrlValid(valid);

    // Auto-parse if valid AND not already parsed
    if (valid) {
      // Skip parsing if this URL was already parsed (e.g., restored from draft)
      if (!parsedUrlsRef.current.has(locationUrl)) {
        parseUrl(locationUrl);
      }
    } else {
      // Clear location if URL becomes invalid
      parsedUrlsRef.current.delete(locationUrl);
      setLocation(null);
      setDisplayAddress("");
    }
  }, [locationUrl]);

  const parseUrl = async (url) => {
    setIsParsingUrl(true);
    try {
      const parsedLocation = await parseGoogleMapsLink(url);
      if (parsedLocation && parsedLocation.lat && parsedLocation.lng) {
        // Full location with coordinates
        setLocation({
          lat: parsedLocation.lat,
          lng: parsedLocation.lng,
          address: parsedLocation.address,
          city: parsedLocation.city,
          state: parsedLocation.state,
          country: parsedLocation.country,
          googleMapsUrl: url,
        });
        setDisplayAddress(
          parsedLocation.address ||
            `${parsedLocation.lat}, ${parsedLocation.lng}`
        );
      } else {
        // URL is valid but coordinates couldn't be extracted - store URL only
        // This is fine for communities, they can just use the URL to show location
        setLocation({
          googleMapsUrl: url,
        });
      }
      // Mark as parsed to prevent re-parsing on screen revisit
      parsedUrlsRef.current.add(url);
    } catch (error) {
      console.error("Error parsing Google Maps URL:", error);
      // Still allow URL-only if it's a valid Google Maps URL
      if (isValidGoogleMapsUrl(url)) {
        setLocation({
          googleMapsUrl: url,
        });
        // Mark as parsed
        parsedUrlsRef.current.add(url);
      } else {
        setLocation(null);
        setDisplayAddress("");
      }
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLoadingGps(true);
    try {
      // Check/request permission
      const hasPermission = await hasLocationPermission();
      if (!hasPermission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          Alert.alert(
            "Location Permission Required",
            "Please enable location permission in your device settings to use this feature."
          );
          setIsLoadingGps(false);
          return;
        }
      }

      // Get current location
      const currentLocation = await getCurrentLocation();
      if (!currentLocation) {
        Alert.alert(
          "Error",
          "Could not get your location. Please try again or paste a Google Maps link."
        );
        setIsLoadingGps(false);
        return;
      }

      // Reverse geocode to get address
      const addressData = await reverseGeocodeStructured(
        currentLocation.lat,
        currentLocation.lng
      );

      setLocation({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        address: addressData.address,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
      });
      setDisplayAddress(
        addressData.address || `${currentLocation.lat}, ${currentLocation.lng}`
      );

      // Clear URL field since we used GPS
      setLocationUrl("");
      setUrlValid(null);
    } catch (error) {
      console.error("Error getting current location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    } finally {
      setIsLoadingGps(false);
    }
  };

  const handleContinue = async () => {
    // Allow continuing with either GPS coordinates OR just a valid Google Maps URL
    const hasValidLocation =
      location && (location.lat || location.googleMapsUrl);

    if (!hasValidLocation) {
      Alert.alert(
        "Location Required",
        "Please use your current location or paste a Google Maps link."
      );
      return;
    }

    // Save location to draft
    try {
      await updateCommunitySignupDraft("CommunityLocation", { location });
      console.log("[CommunityLocationScreen] Draft updated with location");
    } catch (e) {
      console.log(
        "[CommunityLocationScreen] Draft update failed (non-critical):",
        e.message
      );
    }

    // Skip phone/heads for non-organization types
    if (isOrganization) {
      navigation.navigate("CommunityPhone", {
        ...commonParams,
        location,
      });
    } else if (community_type === "college_affiliated") {
      // College communities go to heads screen (for adding coordinator/members)
      navigation.navigate("CollegeHeads", {
        ...commonParams,
        location,
      });
    } else {
      // Individual organizers go directly to username
      navigation.navigate("CommunityUsername", {
        ...commonParams,
        location,
      });
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Determine previous screen based on community type
      // - Student communities skip Category, go back to Bio
      // - Other college types (event, club) skip LocationQuestion, go back to Category
      // - Organizations go back to LocationQuestion
      let previousScreen;
      if (isStudentCommunity) {
        previousScreen = "CommunityBio";
      } else if (community_type === "college_affiliated") {
        previousScreen = "CommunityCategory";
      } else {
        previousScreen = "CommunityLocationQuestion";
      }

      navigation.replace(previousScreen, {
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

  // Allow continuing with either GPS coordinates OR just a valid Google Maps URL
  const canContinue = location && (location.lat || location.googleMapsUrl);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <SignupHeader
            onBack={handleBack}
            onCancel={() => setShowCancelModal(true)}
          />

          {/* Content */}
          <View style={styles.contentBody}>
            <Text style={styles.mainTitle}>Add your location</Text>
            <Text style={styles.subtitle}>
              This helps members and sponsors find your community
            </Text>

            {/* Use Current Location Button */}
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={handleUseCurrentLocation}
              disabled={isLoadingGps}
            >
              {isLoadingGps ? (
                <SnooLoader size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="locate" size={22} color={COLORS.primary} />
              )}
              <Text style={[styles.gpsButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
                {isLoadingGps
                  ? "Getting location..."
                  : "Use My Current Location"}
              </Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Maps URL Input */}
            <Text style={styles.label}>Paste a Google Maps link</Text>
            <Text style={styles.helperText}>
              Open Google Maps → Search location → Tap Share → Copy link
            </Text>

            <TextInput
              style={[
                styles.urlInput,
                isUrlFocused && styles.urlInputFocused,
                urlValid === true && styles.urlInputValid,
                urlValid === false && styles.urlInputInvalid,
              ]}
              value={locationUrl}
              onChangeText={setLocationUrl}
              onFocus={() => setIsUrlFocused(true)}
              onBlur={() => setIsUrlFocused(false)}
              placeholder="Paste Google Maps link here..."
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              multiline={false}
            />

            {/* URL Validation Indicator */}
            {isParsingUrl && (
              <View style={styles.validationRow}>
                <SnooLoader size="small" color={COLORS.primary} />
                <Text style={[styles.parsingText, { fontFamily: 'Manrope-Medium' }]}>Parsing location...</Text>
              </View>
            )}

            {urlValid === true && !isParsingUrl && (
              <View style={styles.validationRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={COLORS.success || "#34C759"}
                />
                <Text style={styles.validText}>Valid Google Maps link</Text>
              </View>
            )}

            {urlValid === false && (
              <View style={styles.validationRow}>
                <Ionicons name="close-circle" size={20} color={COLORS.error} />
                <Text style={styles.invalidText}>
                  Invalid URL - must be from Google Maps
                </Text>
              </View>
            )}

            {/* Display Address - show decoded location like event cards */}
            {location && !isParsingUrl && (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.addressText} numberOfLines={3}>
                  {displayAddress || resolvedLocationName}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer with Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButtonContainer,
              !canContinue && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canContinue || isParsingUrl}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueButton}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={COLORS.textInverted}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 15,
    paddingBottom: 10,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },
  progressContainer: {
    marginBottom: 30,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  contentBody: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.inputBackground || "#f0e6ff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
  },
  gpsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    color: COLORS.textPrimary,
  },
  urlInputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  urlInputValid: {
    borderColor: COLORS.success || "#34C759",
  },
  urlInputInvalid: {
    borderColor: COLORS.error,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  parsingText: {
    fontSize: 14,
    color: COLORS.primary,
  
    fontFamily: "Manrope-Regular",
  },
  validText: {
    fontSize: 14,
    color: COLORS.success || "#34C759",
    fontWeight: "500",
  },
  invalidText: {
    fontSize: 14,
    color: COLORS.error,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.inputBackground || "#f0e6ff",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  continueButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  continueButtonText: {
    fontSize: 17,
    color: COLORS.textInverted,
  
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityLocationScreen;
