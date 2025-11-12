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

const COLORS = {
  primary: "#5E17EB",
  accent: "#EFEAFA",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#F9F9F9",
  border: "#E0E0E0",
  lightGray: "#F0F0F0",
  white: "#FFFFFF",
};

const FONT_SIZES = {
  header: 28,
  subtext: 16,
  small: 13,
};

// --- Graphic Header ---
const GraphicHeader = () => {
  const { width } = useWindowDimensions();
  // Scale circles by screen width for responsiveness
  const c1 = Math.round(width * 0.45);
  const c2 = Math.round(width * 0.3);
  const c3 = Math.round(width * 0.2);
  const c4 = Math.round(width * 0.14);
  return (
    <View
      style={[
        styles.graphicHeaderContainer,
        { height: Math.max(160, Math.round(width * 0.45)) },
      ]}
    >
      <View
        style={[
          styles.graphicCircle,
          {
            width: c1,
            height: c1,
            backgroundColor: "rgba(238, 169, 102, 0.6)",
            top: 8,
            left: 8,
          },
        ]}
      />
      <View
        style={[
          styles.graphicCircle,
          {
            width: c2,
            height: c2,
            backgroundColor: "rgba(94, 23, 235, 0.4)",
            top: 0,
            left: Math.min(width * 0.42, 160),
          },
        ]}
      />
      <View
        style={[
          styles.graphicCircle,
          {
            width: c3,
            height: c3,
            backgroundColor: "rgba(202, 194, 114, 0.5)",
            top: Math.round(c1 * 0.55),
            left: Math.min(width * 0.5, 180),
          },
        ]}
      />
      <View
        style={[
          styles.graphicCircle,
          {
            width: c4,
            height: c4,
            backgroundColor: "rgba(238, 169, 102, 0.8)",
            top: Math.round(c1 * 0.2),
            right: 16,
          },
        ]}
      />
    </View>
  );
};

// --- Selection Item ---
const SelectionItem = ({ title, subtitle, isSelected, onPress }) => (
  <TouchableOpacity
    style={[styles.selectionItem, isSelected && styles.primarySelectionItem]}
    onPress={onPress}
  >
    <View>
      <Text
        style={
          isSelected ? styles.primarySelectionTitle : styles.selectionTitle
        }
      >
        {title}
      </Text>
      <Text
        style={
          isSelected
            ? styles.primarySelectionSubtitle
            : styles.selectionSubtitle
        }
      >
        {subtitle}
      </Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={20}
      color={isSelected ? COLORS.white : COLORS.textDark}
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
    // Navigate to role-specific signup form
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

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top"]}>
      <View style={styles.screenContainer}>
        <GraphicHeader />
        <View style={styles.contentWrapper}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.contentPadding,
                isSmallWidth ? { paddingHorizontal: 16 } : null,
              ]}
            >
              <Text
                style={[
                  styles.mainTitle,
                  isSmallWidth
                    ? { fontSize: Math.max(22, FONT_SIZES.header - 4) }
                    : null,
                ]}
              >
                Welcome to SnooSpace
              </Text>
              <Text
                style={[
                  styles.subTitle,
                  isSmallWidth ? { marginBottom: 24 } : null,
                ]}
              >
                Choose how you want to join our universe.
              </Text>

              <View style={styles.selectionList}>
                <SelectionItem
                  title="I'm a Member"
                  subtitle="Join events and connect"
                  isSelected={selectedRole === "member"}
                  onPress={() => handleSelection("member")}
                />
                <SelectionItem
                  title="I'm a Community"
                  subtitle="Host events and grow"
                  isSelected={selectedRole === "community"}
                  onPress={() => handleSelection("community")}
                />
                <SelectionItem
                  title="I'm a Sponsor"
                  subtitle="Support communities"
                  isSelected={selectedRole === "sponsor"}
                  onPress={() => handleSelection("sponsor")}
                />
                <SelectionItem
                  title="I'm a Venue"
                  subtitle="Host amazing events"
                  isSelected={selectedRole === "venue"}
                  onPress={() => handleSelection("venue")}
                />
              </View>
            </View>
          </ScrollView>
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.button,
                isSmallWidth ? { width: "90%", paddingVertical: 16 } : null,
              ]}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.buttonText}>LOGIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentWrapper: {
    flex: 0,
  },
  scrollContent: {
    flexGrow: 0,
  },
  contentPadding: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  mainTitle: {
    fontSize: FONT_SIZES.header,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: FONT_SIZES.subtext,
    color: COLORS.textLight,
    marginBottom: 40,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "85%",
    alignItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 30 : 30,
    backgroundColor: COLORS.background,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  graphicHeaderContainer: {
    height: 200,
    width: "100%",
    backgroundColor: COLORS.lightGray,
    overflow: "hidden",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  graphicCircle: {
    position: "absolute",
    borderRadius: 999,
  },
  selectionList: {
    marginTop: 10,
  },
  selectionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  primarySelectionItem: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectionTitle: {
    fontSize: FONT_SIZES.subtext,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  primarySelectionTitle: {
    fontSize: FONT_SIZES.subtext,
    fontWeight: "600",
    color: "#fff",
  },
  selectionSubtitle: {
    fontSize: FONT_SIZES.small,
    color: COLORS.textLight,
    marginTop: 2,
  },
  primarySelectionSubtitle: {
    fontSize: FONT_SIZES.small,
    color: "#fff",
    opacity: 0.8,
    marginTop: 2,
  },
});

export default LandingScreen;