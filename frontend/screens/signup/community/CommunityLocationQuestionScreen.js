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
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GlassBackButton from "../../../components/GlassBackButton";

const CommunityLocationQuestionScreen = ({ navigation, route }) => {
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

  const handleYes = () => {
    navigation.navigate("CommunityLocation", commonParams);
  };

  const handleNo = () => {
    // Skip phone/heads for non-organization types
    if (isOrganization) {
      navigation.navigate("CommunityPhone", {
        ...commonParams,
        location: null,
      });
    } else {
      // Go directly to username for non-organization types
      navigation.navigate("CommunityUsername", {
        ...commonParams,
        location: null,
      });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <GlassBackButton onPress={handleBack} style={styles.backButton} />
        </View>

        {/* Content */}
        <View style={styles.contentBody}>
          <Text style={styles.mainTitle}>
            Do you have a permanent location?
          </Text>
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
