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
  Modal,
  Alert,
  ScrollView,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { COLORS, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { apiGet, apiPost } from "../../../api/client";
import { updateCommunitySignupDraft, getCommunityDraftData } from "../../../utils/signupDraftManager";
import SnooLoader from "../../../components/ui/SnooLoader";

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
  const [newCollegeCampus, setNewCollegeCampus] = useState("");
  const [newCollegeCity, setNewCollegeCity] = useState("");
  const [newCollegeState, setNewCollegeState] = useState("");
  const [newCollegeWebsite, setNewCollegeWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingCollegeId, setPendingCollegeId] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Hydrate from draft if needed
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!route.params?.college_id) {
        const draftData = await getCommunityDraftData();
        if (draftData?.college_name) {
          console.log("[CollegeSearch] Hydrating from draft");
          setSearchQuery(draftData.college_name);
          // We could also trigger a search here, but if it's already selected and they are at this screen,
          // it might be because they want to RE-SELECT or they are at this step.
          // Since getCommunityResumeScreen returns CURRENT step, if they are here,
          // it means they haven't finished this step.
        }
      }
    };
    hydrateFromDraft();
  }, []);

  // Animation values
  const searchScale = useSharedValue(1);

  const animatedSearchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchScale.value }],
  }));

  useEffect(() => {
    searchScale.value = withSpring(isSearchFocused ? 1.02 : 1, {
      damping: 15,
      stiffness: 120,
    });
  }, [isSearchFocused]);

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
        `/colleges?search=${encodeURIComponent(query)}`,
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
        e.message,
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
      !newCollegeCampus.trim() ||
      !newCollegeCity.trim() ||
      !newCollegeState.trim()
    ) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost("/colleges/request", {
        college_name: newCollegeName.trim(),
        campus_name: newCollegeCampus.trim(),
        city: newCollegeCity.trim(),
        area: newCollegeState.trim(),
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
          ],
        );
      }
    } catch (error) {
      console.error("Error requesting college:", error);
      Alert.alert(
        "Error",
        "Failed to submit college request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCollegeItem = ({ item }) => {
    // If campus_name exists, show it as the primary name (for multi-campus colleges)
    // Otherwise, show the college name
    const displayName = item.campus_name ? item.campus_name : item.name;
    // For subtitle: if there's a campus, show "College Name â€¢ City"
    // Otherwise, just show "City,"
    const subtitle = item.campus_name
      ? `${item.name} â€¢ ${item.city}`
      : `${item.city},`;

    return (
      <TouchableOpacity
        style={styles.collegeItem}
        onPress={() => handleCollegeSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.collegeIcon}>
          <Ionicons name="school-outline" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.collegeInfo}>
          <Text style={styles.collegeName}>{displayName}</Text>
          <Text style={styles.collegeLocation}>{subtitle}</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          role="Communities"
          onBack={handleBack}
          onCancel={() => {}}
          hideCancel={true}
        />

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.headerTitle}>
              <Animated.Text
                entering={FadeInDown.delay(100).duration(600).springify()}
                style={styles.title}
              >
                Select your college
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={styles.globalHelperText}
              >
                Search for your college or request to add a new one
              </Animated.Text>
            </View>

            <Animated.View
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
            <BlurView
              intensity={60}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cardContent}>
              {/* Search Input */}
                <Animated.View style={[styles.searchContainer, animatedSearchStyle]}>
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
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
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
                </Animated.View>

              {/* Loading indicator */}
              {loading && (
                <View style={styles.loadingContainer}>
                  <SnooLoader size="small" color={COLORS.primary} />
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
                <Animated.View entering={FadeInDown.delay(500).duration(600).springify()}>
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
                </Animated.View>
              </View>
            </Animated.View>
          </View>

        {/* Request College Modal */}
        <Modal
          visible={showRequestModal}
          transparent={true}
          animationType="slide"
          statusBarTranslucent={true}
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
                    placeholder="e.g., VIT University"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newCollegeName}
                    onChangeText={setNewCollegeName}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Campus Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g., Vellore Campus"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newCollegeCampus}
                    onChangeText={setNewCollegeCampus}
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
                      <SnooLoader color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.submitButtonText,
                          { fontFamily: "Manrope-SemiBold" },
                        ]}
                      >
                        Submit Request
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingBottom: 40,
    marginTop: 40,
  },
  headerTitle: {
    marginBottom: 40,
    paddingRight: 10,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
    lineHeight: 38,
  },
  globalHelperText: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
  },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    flex: 1,
    padding: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
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
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
  },
  collegeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(116, 173, 242, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  collegeInfo: {
    flex: 1,
  },
  collegeName: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  collegeLocation: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
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
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
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
    borderColor: "rgba(116, 173, 242, 0.5)",
    borderStyle: "dashed",
    borderRadius: 16,
  },
  requestButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
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
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "Manrope-SemiBold",
  },
});

export default CollegeSearchScreen;



