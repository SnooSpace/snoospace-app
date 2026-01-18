/**
 * CollegeHeadsScreen.js
 *
 * Heads screen for College-affiliated communities.
 * Features: name + role fields, 2 initial entries, 1 required, '+' button to add more.
 */

import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

/**
 * Head Entry Component with Name and Role
 */
const HeadEntry = ({
  index,
  name,
  role,
  onNameChange,
  onRoleChange,
  onRemove,
  isRequired,
  showRemove,
}) => {
  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);

  return (
    <View style={styles.headEntry}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryLabel}>
          {isRequired ? "Head 1 (Required)" : `Head ${index + 1} (Optional)`}
        </Text>
        {showRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <Ionicons name="close-circle" size={22} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={[styles.input, nameFocused && styles.inputFocused]}
        placeholder="Name"
        placeholderTextColor={COLORS.textSecondary}
        value={name}
        onChangeText={onNameChange}
        autoCapitalize="words"
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
      />

      <TextInput
        style={[styles.input, roleFocused && styles.inputFocused]}
        placeholder="Role (e.g., Coordinator, President, Organizer)"
        placeholderTextColor={COLORS.textSecondary}
        value={role}
        onChangeText={onRoleChange}
        autoCapitalize="words"
        onFocus={() => setRoleFocused(true)}
        onBlur={() => setRoleFocused(false)}
      />
    </View>
  );
};

/**
 * Main Screen Component
 */
const CollegeHeadsScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
  } = route.params || {};

  // Initial 2 entries
  const [heads, setHeads] = useState([
    { name: "", role: "" },
    { name: "", role: "" },
  ]);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Update step on mount and hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark step
      try {
        await updateCommunitySignupDraft("CollegeHeads", {});
        console.log("[CollegeHeadsScreen] Step set to CollegeHeads");
      } catch (e) {
        console.log("[CollegeHeadsScreen] Step update failed:", e.message);
      }

      // Hydrate from draft
      const draftData = await getCommunityDraftData();
      if (draftData?.heads && draftData.heads.length > 0) {
        console.log("[CollegeHeadsScreen] Hydrating from draft");
        const hydratedHeads = draftData.heads.map((h) => ({
          name: h.name || "",
          role: h.role || "",
        }));
        // Ensure at least 2 entries
        while (hydratedHeads.length < 2) {
          hydratedHeads.push({ name: "", role: "" });
        }
        setHeads(hydratedHeads);
      }
    };
    initScreen();
  }, []);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Student communities skip Category AND Location, go back to Bio
      // Other college types go back to Location
      const previousScreen = isStudentCommunity
        ? "CommunityBio"
        : "CommunityLocation";

      navigation.replace(previousScreen, {
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
      });
    }
  };

  const updateHead = (index, field, value) => {
    const newHeads = [...heads];
    newHeads[index] = { ...newHeads[index], [field]: value };
    setHeads(newHeads);
  };

  const addHead = () => {
    setHeads([...heads, { name: "", role: "" }]);
  };

  const removeHead = (index) => {
    if (heads.length > 2) {
      const newHeads = heads.filter((_, i) => i !== index);
      setHeads(newHeads);
    }
  };

  const handleNext = async () => {
    // Validate first head is filled
    if (!heads[0].name.trim()) {
      Alert.alert("Required", "Please enter at least one head name.");
      return;
    }

    // Build heads array for submission (filter out empty entries)
    const validHeads = heads
      .filter((h) => h.name.trim())
      .map((h, idx) => ({
        name: h.name.trim(),
        role: h.role.trim() || null,
        is_primary: idx === 0,
      }));

    // Save heads to draft
    try {
      await updateCommunitySignupDraft("CollegeHeads", { heads: validHeads });
      console.log("[CollegeHeadsScreen] Draft updated with heads");
    } catch (e) {
      console.log(
        "[CollegeHeadsScreen] Draft update failed (non-critical):",
        e.message
      );
    }

    // College communities go directly to Username (skip Phone and SponsorType)
    navigation.navigate("CommunityUsername", {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      heads: validHeads,
      community_type,
      college_id,
      college_name,
      college_subtype,
      club_type,
      community_theme,
      college_pending,
      isStudentCommunity,
    });
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      })
    );
  };

  // First head name is required
  const isButtonDisabled = !heads[0].name.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <SignupHeader
          onBack={handleBack}
          onCancel={() => setShowCancelModal(true)}
        />

        {/* Scrollable Content */}
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentArea}>
            <Text style={styles.mainTitle}>Who manages this community?</Text>
            <Text style={styles.subtitle}>
              Add the people who handle this page with their roles.
            </Text>

            {/* Head Entries */}
            {heads.map((head, index) => (
              <HeadEntry
                key={index}
                index={index}
                name={head.name}
                role={head.role}
                onNameChange={(value) => updateHead(index, "name", value)}
                onRoleChange={(value) => updateHead(index, "role", value)}
                onRemove={() => removeHead(index)}
                isRequired={index === 0}
                showRemove={index >= 2}
              />
            ))}

            {/* Add More Button */}
            <TouchableOpacity style={styles.addButton} onPress={addHead}>
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.addButtonText}>Add Another Head</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer / Next Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButtonContainer,
              isButtonDisabled && styles.disabledButton,
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
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  contentScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  contentArea: {
    marginTop: 20,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  headEntry: {
    marginBottom: 20,
    backgroundColor: COLORS.cardBackground || "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  entryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  removeButton: {
    padding: 4,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.inputBackground || "#fff",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    marginBottom: 30,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
});

export default CollegeHeadsScreen;
