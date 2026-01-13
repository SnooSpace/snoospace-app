// screens/LandingScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const FONT_SIZES = {
  header: 32,
  subtext: 16,
  small: 14,
};

// --- Graphic Header ---
const GraphicHeader = () => {
  const { width } = useWindowDimensions();
  const height = Math.round(width * 0.65); // Taller, more impressive header

  return (
    <View style={[styles.graphicHeaderContainer, { height }]}>
      <LinearGradient
        colors={COLORS.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.graphicGradient}
      >
        {/* Abstract Fluid Shapes */}
        <View
          style={[
            styles.abstractCircle,
            {
              width: width * 0.8,
              height: width * 0.8,
              top: -width * 0.2,
              left: -width * 0.2,
              backgroundColor: "rgba(255, 255, 255, 0.1)",
            },
          ]}
        />
        <View
          style={[
            styles.abstractCircle,
            {
              width: width * 0.6,
              height: width * 0.6,
              bottom: -width * 0.1,
              right: -width * 0.1,
              backgroundColor: "rgba(255, 255, 255, 0.15)",
            },
          ]}
        />
        {/* Decorative "Star" or "Sparkle" to imply excitement */}
        <Ionicons 
          name="sparkles" 
          size={40} 
          color="rgba(255,255,255,0.3)" 
          style={{ position: 'absolute', top: '30%', right: '20%' }} 
        />
      </LinearGradient>
    </View>
  );
};

// --- Selection Item ---
const SelectionItem = ({ title, subtitle, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.selectionItem,
      isSelected && styles.primarySelectionItem, // Border highlight
      // Add shadow to all items for depth
      SHADOWS.sm,
    ]}
    onPress={() => {
      // Trigger haptic selection feedback
      HapticsService.triggerSelection();
      onPress();
    }}
    activeOpacity={0.8}
  >
    <View style={{ flex: 1, marginRight: 10 }}>
      <Text
        style={[
          styles.selectionTitle,
          isSelected && styles.primarySelectionText,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.selectionSubtitle,
          isSelected && styles.primarySelectionText,
        ]}
      >
        {subtitle}
      </Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={22}
      // Use Primary Blue for the icon as requested (closest to gradient)
      color={isSelected ? COLORS.primary : COLORS.primary} 
    />
  </TouchableOpacity>
);

// --- Landing Screen ---
const LandingScreen = ({ navigation }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const { width } = useWindowDimensions();
  const isSmallWidth = width < 360;

  const handleSelection = (role) => {
    setSelectedRole(role);
    console.log(`Selected role: ${role}`);
    // Navigate to role-specific signup form after short delay to feel selection? 
    // Or instant. Implementing instant as per original design.
    switch (role) {
      case "member":
        navigation.navigate("MemberSignup", { selectedRole: role });
        break;
      case "community":
        navigation.navigate("CommunitySignup", { selectedRole: role });
        break;
      case "sponsor":
        navigation.navigate("SponsorSignup", { selectedRole: role });
        break;
      case "venue":
        navigation.navigate("VenueSignup", { selectedRole: role });
        break;
      default:
        console.log("Unknown role:", role);
    }
  };

  const handleLoginPress = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("Login");
  };

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <GraphicHeader />
        
        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <View style={styles.contentContainer}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.mainTitle}>Welcome to SnooSpace</Text>
              <Text style={styles.subTitle}>
                Choose how you want to join our universe.
              </Text>
            </View>

            <View style={styles.selectionList}>
              <SelectionItem
                title="People"
                subtitle="Join events and connect"
                isSelected={selectedRole === "member"}
                onPress={() => handleSelection("member")}
              />
              <SelectionItem
                title="Community"
                subtitle="Host events and grow"
                isSelected={selectedRole === "community"}
                onPress={() => handleSelection("community")}
              />
              <SelectionItem
                title="Sponsor"
                subtitle="Support communities"
                isSelected={selectedRole === "sponsor"}
                onPress={() => handleSelection("sponsor")}
              />
              <SelectionItem
                title="Venue"
                subtitle="Host amazing events"
                isSelected={selectedRole === "venue"}
                onPress={() => handleSelection("venue")}
              />
            </View>

            <View style={styles.spacer} />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleLoginPress}
              style={styles.loginButtonContainer}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>LOGIN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30, // Bottom padding
  },
  graphicHeaderContainer: {
    width: "100%",
    overflow: "hidden",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: 20,
    backgroundColor: COLORS.background,
    // Add a shadow to the header curve itself for depth
    ...SHADOWS.md,
    shadowColor: COLORS.primary, // Tinted shadow
    elevation: 10,
  },
  graphicGradient: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  abstractCircle: {
    position: "absolute",
    borderRadius: 999,
  },
  contentContainer: {
    paddingHorizontal: 24,
    flex: 1,
  },
  headerTextContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: FONT_SIZES.header,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: FONT_SIZES.subtext,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  selectionList: {
    gap: 12,
  },
  selectionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.pill, // Fully rounded pill shape
    backgroundColor: COLORS.surface,
    // Soft subtle shadow
    ...SHADOWS.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: "transparent", // Default border
  },
  primarySelectionItem: {
    borderColor: COLORS.primary, // Highlight border color
    backgroundColor: "#F0F8FF", // Very subtle blue tint background on active
  },
  selectionTitle: {
    fontSize: 16, // Slightly larger
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  selectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  primarySelectionText: {
    color: COLORS.primary, // Text turns blue when selected
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  loginButtonContainer: {
    width: "100%",
    // Apply Glow effect to the container
    ...SHADOWS.primaryGlow,
    shadowOpacity: 0.4, // Make it pop
  },
  loginButton: {
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
});

export default LandingScreen;
