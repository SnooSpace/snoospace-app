// screens/LandingScreen.js
import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
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
const GraphicHeader = () => (
  <View style={styles.graphicHeaderContainer}>
    <View
      style={[
        styles.graphicCircle,
        {
          width: 180,
          height: 180,
          backgroundColor: "rgba(238, 169, 102, 0.6)",
          top: 20,
          left: 10,
        },
      ]}
    />
    <View
      style={[
        styles.graphicCircle,
        {
          width: 120,
          height: 120,
          backgroundColor: "rgba(94, 23, 235, 0.4)",
          top: 10,
          left: 120,
        },
      ]}
    />
    <View
      style={[
        styles.graphicCircle,
        {
          width: 80,
          height: 80,
          backgroundColor: "rgba(202, 194, 114, 0.5)",
          top: 100,
          left: 150,
        },
      ]}
    />
    <View
      style={[
        styles.graphicCircle,
        {
          width: 50,
          height: 50,
          backgroundColor: "rgba(238, 169, 102, 0.8)",
          top: 40,
          right: 20,
        },
      ]}
    />
  </View>
);

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
      color={isSelected ? COLORS.white : COLORS.textDark} // Set color based on selection
    />
  </TouchableOpacity>
);

// --- Landing Screen ---
const LandingScreen = ({ navigation }) => {
  const [selectedRole, setSelectedRole] = useState(null);

  const handleSelection = (role) => {
    setSelectedRole(role);
    console.log(`Selected role: ${role}`);
    // Navigate to role-specific signup form
    navigation.navigate("MemberSignup", { selectedRole: role });
  };

  return (
    <View style={styles.screenContainer}>
      <GraphicHeader />

      <View style={styles.contentPadding}>
        <Text style={styles.mainTitle}>Welcome to SnooSpace</Text>
        <Text style={styles.subTitle}>
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

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.buttonText}>LOGIN</Text>
      </TouchableOpacity>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 20,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 40,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginVertical: 75,
    width: "85%",
    alignItems: "center",
    marginLeft: "auto",
    marginRight: "auto",
  },
  secondaryButton: {
    backgroundColor: "#999", // temp grey for signup until you design it
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentPadding: {
    paddingHorizontal: 24,
    paddingTop: 20,
    flex: 1,
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
  actionButtonBase: {
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.textDark,
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.subtext,
    fontWeight: "700",
  },
  graphicHeaderContainer: {
    height: 200,
    width: "100%",
    backgroundColor: COLORS.lightGray,
    overflow: "hidden",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: 40,
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
