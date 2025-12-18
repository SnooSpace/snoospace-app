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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from "../../../components/Progressbar";


const CommunityLocationQuestionScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, logo_url, bio, category, categories } = route.params || {};

  const handleYes = () => {
    navigation.navigate("CommunityLocation", {
      email, accessToken, refreshToken, name, logo_url, bio, category, categories,
    });
  };

  const handleNo = () => {
    navigation.navigate("CommunityPhone", {
      email, accessToken, refreshToken, name, logo_url, bio, category, categories, location: null,
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
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 5 of 9</Text>
          <ProgressBar progress={56} />
        </View>

        {/* Content */}
        <View style={styles.contentBody}>
          <Text style={styles.mainTitle}>Do you have a permanent location?</Text>
          <Text style={styles.subtitle}>
            This helps us show your community to nearby members and sponsors.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.yesButtonContainer}
              onPress={handleYes}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.yesButton}
              >
                <Text style={styles.buttonText}>Yes</Text>
              </LinearGradient>
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
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0, 
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  contentBody: {
    flex: 1,
    paddingTop: 40,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 60,
  },
  buttonContainer: {
    gap: 20,
  },
  yesButtonContainer: {
    width: "100%",
    borderRadius: 15,
    ...SHADOWS.primaryGlow,
  },
  yesButton: {
    width: "100%",
    height: 70,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  noButton: {
    width: "100%",
    height: 70,
    backgroundColor: COLORS.background,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "700",
  },
  noButtonText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "700",
  },
});

export default CommunityLocationQuestionScreen;