import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
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
import { apiGet, apiPost } from "../../../api/client";
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";

// Debounce helper
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

/**
 * College Search Screen
 * Allows user to search for their college or request a new one
 */
const CollegeSearchScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, community_type } =
    route.params || {};

  const [searchQuery, setSearchQuery] = useState("");
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Request modal state
  const [newCollegeName, setNewCollegeName] = useState("");
  const [newCollegeCity, setNewCollegeCity] = useState("");
  const [newCollegeState, setNewCollegeState] = useState("");
  const [newCollegeWebsite, setNewCollegeWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingCollegeId, setPendingCollegeId] = useState(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search colleges when query changes
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      searchColleges(debouncedSearch);
    } else {
      setColleges([]);
    }
  }, [debouncedSearch]);

  const searchColleges = async (query) => {
    setLoading(true);
    try {
      const response = await apiGet(
        `/colleges?search=${encodeURIComponent(query)}`
      );
      setColleges(response?.colleges || []);
    } catch (error) {
      console.error("Error searching colleges:", error);
      setColleges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeSelect = async (college) => {
    console.log("[CollegeSearch] Selected college:", college.id, college.name);

    // Save college data to draft
    try {
      await updateCommunitySignupDraft("CollegeSearch", {
        college_id: college.id,
        college_name: college.name,
      });
      console.log("[CollegeSearch] Draft updated with college data");
    } catch (e) {
      console.log(
        "[CollegeSearch] Draft update failed (non-critical):",
        e.message
      );
    }

    navigation.navigate("CollegeSubtypeSelect", {
      email,
      accessToken,
      refreshToken,
      community_type,
      college_id: college.id,
      college_name: college.name,
    });
  };

  const handleRequestCollege = async () => {
    if (
      !newCollegeName.trim() ||
      !newCollegeCity.trim() ||
      !newCollegeState.trim()
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost("/colleges/request", {
        name: newCollegeName.trim(),
        city: newCollegeCity.trim(),
        state: newCollegeState.trim(),
        website: newCollegeWebsite.trim() || null,
      });

      console.log("[CollegeSearch] College request response:", response);
      setPendingCollegeId(response?.college_id);
      setShowRequestModal(false);

      // If the college was auto-approved or already exists, navigate to subtype
      if (response?.status === "approved") {
        navigation.navigate("CollegeSubtypeSelect", {
          email,
          accessToken,
          refreshToken,
          community_type,
          college_id: response.college_id,
          college_name: newCollegeName.trim(),
        });
      } else {
        // Show confirmation and let user continue
        Alert.alert(
          "Request Submitted",
          "Thanks! We'll add this college shortly. You can continue setting up your profile.",
          [
            {
              text: "Continue",
              onPress: () => {
                // Navigate with pending college
                navigation.navigate("CollegeSubtypeSelect", {
                  email,
                  accessToken,
                  refreshToken,
                  community_type,
                  college_id: response?.college_id,
                  college_name: newCollegeName.trim(),
                  college_pending: true,
                });
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error("Error requesting college:", error);
      Alert.alert(
        "Error",
        "Failed to submit college request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCollegeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.collegeItem}
      onPress={() => handleCollegeSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.collegeIcon}>
        <Ionicons name="school-outline" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.collegeInfo}>
        <Text style={styles.collegeName}>{item.name}</Text>
        <Text style={styles.collegeLocation}>
          {item.city}, {item.state}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <GlassBackButton onPress={handleBack} style={styles.backButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Select your college</Text>
        <Text style={styles.subtitle}>
          Search for your college or request to add a new one
        </Text>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={COLORS.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for your college..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        {/* College List */}
        {!loading && colleges.length > 0 && (
          <FlatList
            data={colleges}
            keyExtractor={(item) => item.id}
            renderItem={renderCollegeItem}
            style={styles.collegeList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Empty state */}
        {!loading && searchQuery.length >= 2 && colleges.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyStateText}>No colleges found</Text>
            <Text style={styles.emptyStateSubtext}>
              Can't find your college? Request to add it below.
            </Text>
          </View>
        )}

        {/* Request new college button */}
        <TouchableOpacity
          style={styles.requestButton}
          onPress={() => setShowRequestModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={COLORS.primary}
          />
          <Text style={styles.requestButtonText}>
            Can't find your college? Request add
          </Text>
        </TouchableOpacity>
      </View>

      {/* Request College Modal */}
      <Modal
        visible={showRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request New College</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>College Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., VIT Vellore"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newCollegeName}
                  onChangeText={setNewCollegeName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Vellore"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newCollegeCity}
                  onChangeText={setNewCollegeCity}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>State *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., Tamil Nadu"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newCollegeState}
                  onChangeText={setNewCollegeState}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Official Website (Optional)
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://www.vit.ac.in"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newCollegeWebsite}
                  onChangeText={setNewCollegeWebsite}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleRequestCollege}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButtonGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  collegeList: {
    flex: 1,
  },
  collegeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground || "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  collegeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight || "#e8f4ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  collegeInfo: {
    flex: 1,
  },
  collegeName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  collegeLocation: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderRadius: 12,
  },
  requestButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default CollegeSearchScreen;
