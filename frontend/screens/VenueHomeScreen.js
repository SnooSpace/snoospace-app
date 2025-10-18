import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { clearAuthSession } from "../api/auth";

// --- CONSTANTS DEFINED LOCALLY ---
const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
};

const FONT_SIZES = {
  largeHeader: 28,
  body: 16,
  small: 13,
};

const SPACING = {
  horizontal: 24,
  vertical: 20,
};
// ---------------------------------

const VenueHomeScreen = ({ navigation }) => {
  const handleLogout = async () => {
    try {
      // Clear stored authentication data
      await clearAuthSession();
      // Navigate to landing page
      navigation.navigate("Landing");
    } catch (error) {
      console.error('Logout error:', error);
      // Still navigate to landing even if clearing session fails
      navigation.navigate("Landing");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome, Venue!</Text>
          <Text style={styles.subtitle}>You're logged in as a Venue</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            This is your venue dashboard. Here you can:
          </Text>
          <Text style={styles.feature}>• List and manage venue details</Text>
          <Text style={styles.feature}>• Set pricing and slot availability</Text>
          <Text style={styles.feature}>• Add extra conditions</Text>
          <Text style={styles.feature}>• Upload venue media</Text>
          <Text style={styles.feature}>• Track booking inquiries from communities</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.horizontal,
    paddingVertical: SPACING.vertical,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: FONT_SIZES.largeHeader,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textLight,
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
    marginBottom: 20,
    lineHeight: 24,
  },
  feature: {
    fontSize: FONT_SIZES.body,
    color: COLORS.textDark,
    marginBottom: 12,
    paddingLeft: 10,
  },
  logoutButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.body,
    fontWeight: "700",
  },
});

export default VenueHomeScreen;
