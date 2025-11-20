import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ProgressBar from "../../../components/Progressbar";
import LocationPicker from "../../../components/LocationPicker/LocationPicker";

// --- Consistent Design Constants ---
const PRIMARY_COLOR = "#5f27cd";       // Deep purple
const TEXT_COLOR = "#1e1e1e";         // Dark text
const LIGHT_TEXT_COLOR = "#6c757d";   // Lighter grey for step text
const BACKGROUND_COLOR = "#ffffff";   // White background

const CommunityLocationScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, categories } = route.params || {};
  const [showLocationPicker, setShowLocationPicker] = useState(true);
  const [location, setLocation] = useState(null);

  const handleLocationSelected = (selectedLocation) => {
    setLocation(selectedLocation);
    setShowLocationPicker(false);
    // Navigate to next screen with location object
    navigation.navigate("CommunityPhone", {
      email,
      accessToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location: selectedLocation,
    });
  };

  const handleCancel = () => {
    // Treat 'Cancel' as 'Go Back'
    setShowLocationPicker(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 1. Location Picker Component (Base Layer, taking up all space) */}
      <View style={styles.locationPickerWrapper}>
        <LocationPicker
          businessName={name}
          onLocationSelected={handleLocationSelected}
          onCancel={handleCancel}
        />
      </View>

      {/* 2. Header and Progress Bar (Absolute Overlay Layer) */}
      <View style={styles.headerOverlay}>
        
        {/* Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 5 of 9</Text>
          <ProgressBar progress={56} /> 
        </View>
        
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    // paddingTop is controlled by headerOverlay's top value now
  },
  
  // FIX: Absolute positioning container for header/progress bar
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === "android" ? StatusBar.currentHeight : 0,
    left: 0,
    right: 0,
    zIndex: 100, // Highest zIndex ensures it renders on top of the map
    backgroundColor: BACKGROUND_COLOR, // Crucial: ensures the map doesn't show through the header area
    paddingBottom: 20, // Add padding at the bottom of the overlay for separation
  },
  
  // --- Header Styles (Consistent) ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles (Consistent) ---
  progressContainer: {
    // This padding is now relative to the absolute overlay container
    paddingHorizontal: 20,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  
  // Wrapper for the LocationPicker now takes up all available space
  locationPickerWrapper: {
    flex: 1, 
    // The LocationPicker content still needs to start rendering below the overlay.
    // We add paddingTop to visually shift the map content start point down.
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 120 : 120, // Estimate combined height of status bar + overlay content
  },
});

export default CommunityLocationScreen;