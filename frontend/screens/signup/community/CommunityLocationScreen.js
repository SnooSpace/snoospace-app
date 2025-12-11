import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  TextInput,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "../../../components/Progressbar";
import { getCurrentLocation, hasLocationPermission, requestLocationPermission } from "../../../utils/location";
import { reverseGeocodeStructured } from "../../../utils/geocoding";
import { isValidGoogleMapsUrl } from "../../../utils/validateGoogleMapsUrl";
import { parseGoogleMapsLink } from "../../../utils/googleMapsParser";

// --- Consistent Design Constants ---
const PRIMARY_COLOR = "#5f27cd";
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";
const BACKGROUND_COLOR = "#ffffff";
const SUCCESS_COLOR = "#34C759";
const ERROR_COLOR = "#FF3B30";

const CommunityLocationScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, categories } = route.params || {};
  
  // Location state
  const [location, setLocation] = useState(null);
  const [displayAddress, setDisplayAddress] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  
  // Loading states
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isParsingUrl, setIsParsingUrl] = useState(false);
  
  // Validation state
  const [urlValid, setUrlValid] = useState(null); // null = not validated, true/false = valid/invalid

  // Validate URL on change
  useEffect(() => {
    if (!locationUrl.trim()) {
      setUrlValid(null);
      return;
    }
    
    const valid = isValidGoogleMapsUrl(locationUrl);
    setUrlValid(valid);
    
    // Auto-parse if valid
    if (valid) {
      parseUrl(locationUrl);
    } else {
      // Clear location if URL becomes invalid
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
        setDisplayAddress(parsedLocation.address || `${parsedLocation.lat}, ${parsedLocation.lng}`);
      } else {
        // URL is valid but coordinates couldn't be extracted - store URL only
        // This is fine for communities, they can just use the URL to show location
        setLocation({
          googleMapsUrl: url,
        });
        setDisplayAddress("Location saved as Google Maps link");
      }
    } catch (error) {
      console.error("Error parsing Google Maps URL:", error);
      // Still allow URL-only if it's a valid Google Maps URL
      if (isValidGoogleMapsUrl(url)) {
        setLocation({
          googleMapsUrl: url,
        });
        setDisplayAddress("Location saved as Google Maps link");
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
        Alert.alert("Error", "Could not get your location. Please try again or paste a Google Maps link.");
        setIsLoadingGps(false);
        return;
      }

      // Reverse geocode to get address
      const addressData = await reverseGeocodeStructured(currentLocation.lat, currentLocation.lng);
      
      setLocation({
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        address: addressData.address,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
      });
      setDisplayAddress(addressData.address || `${currentLocation.lat}, ${currentLocation.lng}`);
      
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

  const handleContinue = () => {
    // Allow continuing with either GPS coordinates OR just a valid Google Maps URL
    const hasValidLocation = location && (location.lat || location.googleMapsUrl);
    
    if (!hasValidLocation) {
      Alert.alert("Location Required", "Please use your current location or paste a Google Maps link.");
      return;
    }

    navigation.navigate("CommunityPhone", {
      email,
      accessToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
    });
  };

  const handleBack = () => {
    navigation.goBack();
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
          {/* Header Row */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Text style={styles.stepText}>Step 5 of 9</Text>
            <ProgressBar progress={56} />
          </View>

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
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <Ionicons name="locate" size={22} color={PRIMARY_COLOR} />
              )}
              <Text style={styles.gpsButtonText}>
                {isLoadingGps ? "Getting location..." : "Use My Current Location"}
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
                urlValid === true && styles.urlInputValid,
                urlValid === false && styles.urlInputInvalid,
              ]}
              value={locationUrl}
              onChangeText={setLocationUrl}
              placeholder="Paste Google Maps link here..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              multiline={false}
            />

            {/* URL Validation Indicator */}
            {isParsingUrl && (
              <View style={styles.validationRow}>
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                <Text style={styles.parsingText}>Parsing location...</Text>
              </View>
            )}
            
            {urlValid === true && !isParsingUrl && (
              <View style={styles.validationRow}>
                <Ionicons name="checkmark-circle" size={20} color={SUCCESS_COLOR} />
                <Text style={styles.validText}>Valid Google Maps link</Text>
              </View>
            )}
            
            {urlValid === false && (
              <View style={styles.validationRow}>
                <Ionicons name="close-circle" size={20} color={ERROR_COLOR} />
                <Text style={styles.invalidText}>Invalid URL - must be from Google Maps</Text>
              </View>
            )}

            {/* Display Address */}
            {displayAddress && !isParsingUrl && (
              <View style={styles.addressContainer}>
                <Ionicons name="location" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.addressText} numberOfLines={3}>
                  {displayAddress}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer with Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue || isParsingUrl}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
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
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  contentBody: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 30,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0e6ff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
  },
  gpsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontWeight: "500",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 12,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    backgroundColor: "#f8f9fa",
    color: TEXT_COLOR,
  },
  urlInputValid: {
    borderColor: SUCCESS_COLOR,
  },
  urlInputInvalid: {
    borderColor: ERROR_COLOR,
  },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  parsingText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
  },
  validText: {
    fontSize: 14,
    color: SUCCESS_COLOR,
    fontWeight: "500",
  },
  invalidText: {
    fontSize: 14,
    color: ERROR_COLOR,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0e6ff",
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
    gap: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
});

export default CommunityLocationScreen;