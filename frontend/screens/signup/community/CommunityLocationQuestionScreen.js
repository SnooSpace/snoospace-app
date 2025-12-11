import React from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform, 
  StatusBar, 
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
// import ProgressBar from "../../../components/Progressbar"; // <<< Removed the problematic import

// --- Consistent Design Constants ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = "#5f27cd"; // Deep Purple - Used for buttons AND progress fill
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";
const BACKGROUND_COLOR = "#ffffff";
const TRACK_COLOR = "#e0e0e0"; // Light gray for the progress bar background/track

/**
 * Custom Simple Progress Bar Component (Reimplementation)
 * @param {number} progress - The percentage (e.g., 56 for 56%)
 */
const SimpleProgressBar = ({ progress }) => {
  return (
    <View style={progressBarStyles.track}>
      <View style={[progressBarStyles.fill, { width: `${progress}%` }]} />
    </View>
  );
};

const progressBarStyles = StyleSheet.create({
  track: {
    height: 8, // Define the bar height
    width: '100%',
    backgroundColor: TRACK_COLOR,
    borderRadius: 4,
    overflow: 'hidden', // Essential to clip the fill
  },
  fill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
  }
});


const CommunityLocationQuestionScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, categories } = route.params || {};

  const handleYes = () => {
    navigation.navigate("CommunityLocation", {
      email, accessToken, name, logo_url, bio, category, categories,
    });
  };

  const handleNo = () => {
    navigation.navigate("CommunityPhone", {
      email, accessToken, name, logo_url, bio, category, categories, location: null,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      <View style={styles.container}> 
        
        {/* Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 5 of 9</Text>
          {/* FIX: Using the newly defined SimpleProgressBar */}
          <SimpleProgressBar progress={56} />
        </View>

        {/* Content */}
        <View style={styles.contentBody}>
          <Text style={styles.mainTitle}>Do you have a permanent location?</Text>
          <Text style={styles.subtitle}>
            This helps us show your community to nearby members and sponsors.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.yesButton}
              onPress={handleYes}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Yes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.noButton}
              onPress={handleNo}
              activeOpacity={0.8}
            >
              <Text style={styles.noButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    backgroundColor: BACKGROUND_COLOR,
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
    width: "100%",
    marginBottom: 40,
    // The bar itself has height 8, so 20 is sufficient for step text + bar
    height: 20, 
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  contentBody: {
    flex: 1,
    paddingTop: 40,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 60,
  },
  buttonContainer: {
    gap: 20,
  },
  yesButton: {
    width: "100%",
    height: 70,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  noButton: {
    width: "100%",
    height: 70,
    backgroundColor: BACKGROUND_COLOR,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  noButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 18,
    fontWeight: "700",
  },
});

export default CommunityLocationQuestionScreen;