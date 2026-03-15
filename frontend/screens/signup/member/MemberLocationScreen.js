import React, { useRef, useState, useEffect } from "react";
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
  Linking,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { MapPin, CheckCircle2 } from "lucide-react-native";

import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";
// Removed local constants in favor of theme constants

const LocationInputScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns,
    showPronouns,
    gender,
    location: initialLocation,
    prefill,
    fromCommunitySignup,
  } = route.params || {};

  // Use prefill.location as fallback when no explicit location was passed
  const prefillLocation = prefill?.location ?? null;

  const [location, setLocation] = useState(
    initialLocation || prefillLocation || {
      address: "",
      city: "",
      state: "",
      country: "",
      lat: null,
      lng: null,
    },
  );
  // Track whether the current value came from the community prefill
  const [isPrefilled, setIsPrefilled] = useState(
    !initialLocation && !!prefillLocation?.city,
  );
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const navigatedRef = useRef(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (hasLocation)
  useEffect(() => {
    if (location.city && location.city.trim().length > 0) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [location.city && location.city.trim().length > 0]);

  // Hydrate from draft if route.params is missing location AND no prefill
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!initialLocation || !initialLocation.city) {
        // Skip draft hydration if we already have a prefill location
        if (prefillLocation?.city) return;
        const draftData = await getDraftData();
        if (draftData?.location && draftData.location.city) {
          console.log("[MemberLocationScreen] Hydrating from draft");
          setLocation(draftData.location);
          setIsPrefilled(false);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);

    if (fromCommunitySignup) {
      navigation.navigate("Celebration", {
        role: "Community",
        fromCommunitySignup: true,
        createdPeopleProfile: false,
      });
    } else {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      });
    }
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
          ],
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
        setIsPrefilled(false);
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          // Update client-side draft with location
          try {
            await updateSignupDraft("MemberLocation", { location: resolved });
            console.log("[MemberLocationScreen] Draft updated with location");
          } catch (e) {
            console.log(
              "[MemberLocationScreen] Draft update failed:",
              e.message,
            );
          }
          navigation.navigate("MemberInterests", {
            email,
            accessToken,
            refreshToken,
            name,
            profile_photo_url,
            dob,
            pronouns,
            showPronouns,
            gender,
            location: resolved,
            prefill,
            fromCommunitySignup,
          });
        } else {
          // Location was updated (user came back) - just update draft, don't auto-navigate
          try {
            await updateSignupDraft("MemberLocation", { location: resolved });
            console.log("[MemberLocationScreen] Location updated in draft");
          } catch (e) {
            console.log(
              "[MemberLocationScreen] Draft update failed:",
              e.message,
            );
          }
        }
      } else {
        const resolved = { ...location, lat: latitude, lng: longitude };
        setLocation(resolved);
        if (!navigatedRef.current) {
          navigatedRef.current = true;
          // Update client-side draft
          try {
            await updateSignupDraft("MemberLocation", { location: resolved });
          } catch (e) {
            console.log(
              "[MemberLocationScreen] Draft update failed:",
              e.message,
            );
          }
          navigation.navigate("MemberInterests", {
            email,
            accessToken,
            refreshToken,
            name,
            profile_photo_url,
            dob,
            pronouns,
            showPronouns,
            gender,
            location: resolved,
            prefill,
            fromCommunitySignup,
          });
        } else {
          // Location was updated - just update draft
          try {
            await updateSignupDraft("MemberLocation", { location: resolved });
          } catch (e) {
            console.log(
              "[MemberLocationScreen] Draft update failed:",
              e.message,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleNext = async () => {
    triggerTransitionHaptic();
    // Update client-side draft
    try {
      await updateSignupDraft("MemberLocation", { location });
      console.log("[MemberLocationScreen] Draft updated");
    } catch (e) {
      console.log("[MemberLocationScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberInterests", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob,
      pronouns,
      showPronouns,
      gender,
      location: location,
      prefill,
      fromCommunitySignup,
    });
  };

  // Computed: check if location is already set
  const hasLocation = location.city && location.city.trim().length > 0;

  // Button disabled (for Next button when no location)
  const isButtonDisabled = !hasLocation;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          role="People"
          onBack={() => {
            triggerTransitionHaptic();
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("MemberGender", {
                email,
                accessToken,
                refreshToken,
                name,
                profile_photo_url,
                dob,
                pronouns,
                showPronouns,
                gender,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              Where's your world?
            </Animated.Text>

            <Animated.View 
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Location Card - shown when location is set */}
                {hasLocation && (
                  <View style={styles.locationCard}>
                    <View style={styles.locationCardContent}>
                      <CheckCircle2
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
                    {isPrefilled && (
                      <View style={{
                        marginTop: 10,
                        alignSelf: "flex-start",
                        backgroundColor: "rgba(116, 173, 242, 0.12)",
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderWidth: 1,
                        borderColor: "rgba(116, 173, 242, 0.25)",
                      }}>
                        <Text style={{
                          fontSize: 12,
                          fontFamily: "Manrope-Medium",
                          color: COLORS.primary,
                        }}>
                          Imported from your community
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Use/Update Current Location Button */}
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={handleGetLocation}
                  disabled={loadingLocation}
                >
                  {loadingLocation ? (
                    <SnooLoader size="small" color={COLORS.textPrimary} />
                  ) : (
                    <MapPin
                      size={20}
                      color={COLORS.textPrimary}
                    />
                  )}
                  <Text
                    style={[
                      styles.locationButtonText,
                      { fontFamily: "Manrope-SemiBold" },
                    ]}
                  >
                    {loadingLocation
                      ? "Getting location..."
                      : hasLocation
                        ? "Update Location"
                        : "Use Current Location"}
                  </Text>
                </TouchableOpacity>

                {/* Helper text */}
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    color: COLORS.textSecondary,
                    marginTop: 8,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  We only use your location while the app is open to show nearby
                  events and improve recommendations.
                </Text>
              </View>
            </Animated.View>

            {/* Next Button */}
            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
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
              </Animated.View>
            </View>
          </View>
        </ScrollView>

        {/* Cancel Confirmation Modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1,
    marginTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    padding: 24,
  },
  // Location Card Styles
  locationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
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
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
  locationCountry: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    backgroundColor: "rgba(255,255,255,0.7)",
    marginBottom: 12,
  },
  locationButtonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    marginLeft: 8,
  },
  // --- Footer/Button Styles Extracted ---
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
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



