import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import DiscoverFilterSheet from "../../components/DiscoverFilterSheet";
import HapticsService from "../../services/HapticsService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_ASPECT_RATIO = 4 / 5;
const HORIZONTAL_MARGIN = SPACING.m;

// Hinge-style color palette
const HINGE_COLORS = {
  background: "#F5F5F5",
  cardBg: "#FFFFFF",
  textPrimary: "#1D1D1F",
  textSecondary: "#666666",
  textMuted: "#999999",
  badgeBg: "#F0F0F0",
  badgeText: "#333333",
  interestBg: "#E8E8E8",
  interestText: "#333333",
  iconBg: "#FFFFFF",
  iconColor: "#333333",
  border: "#E5E5E5",
};

// ===== ProfilePhotoCard Component =====
const ProfilePhotoCard = ({ photoUrl, onMessagePress }) => {
  return (
    <View style={styles.photoCardContainer}>
      <Image
        source={{ uri: photoUrl }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      {/* Message Icon Overlay */}
      <TouchableOpacity
        style={styles.messageIconButton}
        onPress={onMessagePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name="chatbubble-outline"
          size={20}
          color={HINGE_COLORS.iconColor}
        />
      </TouchableOpacity>
    </View>
  );
};

// ===== PromptCard Component =====
const PromptCard = ({ prompt, answer, onMessagePress }) => {
  return (
    <View style={styles.promptCard}>
      <Text style={styles.promptLabel}>{prompt}</Text>
      <Text style={styles.promptAnswer}>{answer}</Text>
      {/* Message Icon */}
      <TouchableOpacity
        style={styles.promptMessageButton}
        onPress={onMessagePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name="chatbubble-outline"
          size={20}
          color={HINGE_COLORS.iconColor}
        />
      </TouchableOpacity>
    </View>
  );
};

// ===== GoalBadge Component =====
const GoalBadge = ({ text }) => {
  return (
    <View style={styles.goalBadge}>
      <Text style={styles.goalBadgeText}>{text}</Text>
    </View>
  );
};

// ===== ContentLikeModal Component =====
const ContentLikeModal = ({
  visible,
  onClose,
  onSend,
  contentType,
  contentData,
  attendeeName,
}) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    onSend(message);
    setMessage("");
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={handleClose}
          >
            <Ionicons name="close" size={24} color={HINGE_COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Content Preview */}
          <View style={styles.modalPreview}>
            {contentType === "photo" ? (
              <Image
                source={{ uri: contentData }}
                style={styles.modalPreviewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.modalPreviewPrompt}>
                <Text style={styles.modalPreviewPromptText} numberOfLines={3}>
                  {contentData?.response || contentData?.answer || contentData}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.modalTitle}>
            Send a message to {attendeeName}
          </Text>

          {/* Message Input */}
          <TextInput
            style={styles.modalInput}
            placeholder="Add a message... (optional)"
            placeholderTextColor={HINGE_COLORS.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={300}
          />

          {/* Send Button */}
          <TouchableOpacity
            style={styles.modalSendButton}
            onPress={handleSend}
            activeOpacity={0.8}
          >
            <Text style={styles.modalSendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ===== Main ProfileFeedScreen (Hinge-Style) =====
export default function ProfileFeedScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skippedIds, setSkippedIds] = useState(new Set());
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);

  useEffect(() => {
    if (event) {
      loadAttendees();
    }
  }, [event, activeFilters]);

  const loadAttendees = async (filters = activeFilters) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (token) {
        // Build query string with filters
        let queryParams = [];
        if (filters.badges && filters.badges.length > 0) {
          queryParams.push(`badges=${filters.badges.join(",")}`);
        }
        if (filters.interests && filters.interests.length > 0) {
          queryParams.push(`interests=${filters.interests.join(",")}`);
        }
        if (filters.ageMin) {
          queryParams.push(`ageMin=${filters.ageMin}`);
        }
        if (filters.ageMax) {
          queryParams.push(`ageMax=${filters.ageMax}`);
        }
        const queryString =
          queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

        const response = await apiGet(
          `/events/${event.id}/attendees${queryString}`,
          15000,
          token
        );
        setAttendees(response.attendees || []);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error loading attendees:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  };

  const currentAttendee = attendees[currentIndex];

  // Extract data from current attendee
  const name = currentAttendee?.name || "Unknown";
  const age = currentAttendee?.age;
  const pronouns = currentAttendee?.pronouns;
  const goalBadges = currentAttendee?.intent_badges || [];
  const interests = currentAttendee?.interests || [];
  const openers = currentAttendee?.openers || [];

  // Get photos
  const photos = useMemo(() => {
    if (!currentAttendee) return [];

    const discoverPhotos = currentAttendee?.discover_photos || [];
    const memberPhotos = currentAttendee?.photos || [];

    let allPhotos = [];

    if (discoverPhotos.length > 0) {
      allPhotos = discoverPhotos
        .map((p, i) => ({
          id: i,
          url: typeof p === "string" ? p : p.url || p.photo_url || "",
        }))
        .filter((p) => p.url);
    }

    if (allPhotos.length === 0 && memberPhotos.length > 0) {
      allPhotos = memberPhotos.map((p, i) => ({
        id: i,
        url: p.photo_url || "",
      }));
    }

    if (allPhotos.length === 0) {
      allPhotos = [{ id: 0, url: "https://via.placeholder.com/400x500" }];
    }

    return allPhotos;
  }, [currentAttendee]);

  // Build interleaved content
  const interleavedContent = useMemo(() => {
    const content = [];
    let photoIndex = 1; // Skip hero photo
    let promptIndex = 0;

    // Interleave: Prompt → Photo → Prompt → Photo...
    while (promptIndex < openers.length || photoIndex < photos.length) {
      if (promptIndex < openers.length) {
        content.push({
          type: "prompt",
          data: openers[promptIndex],
          index: promptIndex,
        });
        promptIndex++;
      }
      if (photoIndex < photos.length) {
        content.push({
          type: "photo",
          data: photos[photoIndex],
          index: photoIndex,
        });
        photoIndex++;
      }
    }

    return content;
  }, [photos, openers]);

  const heroPhoto = photos[0]?.url;

  // Handlers
  const handleContentMessage = (type, data, index) => {
    HapticsService.triggerImpactLight();
    setSelectedContent({
      type,
      data: type === "photo" ? data.url : data,
      index,
    });
    setMessageModalVisible(true);
  };

  const handleSendMessage = (message) => {
    // In a real app, this would send the connection request with context
    console.log("Sending message:", {
      attendeeId: currentAttendee?.id,
      contentType: selectedContent?.type,
      contentIndex: selectedContent?.index,
      message,
    });
    setMessageModalVisible(false);
    goToNextProfile();
  };

  const handleConnect = () => {
    HapticsService.triggerImpactMedium();
    Alert.alert("Connection Request", `Send connection request to ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Connect",
        onPress: () => {
          Alert.alert("Request Sent", `Connection request sent to ${name}`);
          goToNextProfile();
        },
      },
    ]);
  };

  const handleSkip = () => {
    HapticsService.triggerImpactLight();
    if (currentAttendee) {
      setSkippedIds((prev) => new Set([...prev, currentAttendee.id]));
    }
    goToNextProfile();
  };

  const goToNextProfile = () => {
    if (currentIndex < attendees.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      Alert.alert("All Done", "You've seen everyone at this event!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFilterPress = () => {
    HapticsService.triggerImpactLight();
    setFilterSheetVisible(true);
  };

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
  };

  // Count active filter groups
  const activeFilterCount =
    (activeFilters.badges?.length > 0 ? 1 : 0) +
    (activeFilters.interests?.length > 0 ? 1 : 0) +
    (activeFilters.ageMin || activeFilters.ageMax ? 1 : 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading people...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentAttendee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={HINGE_COLORS.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{event?.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons
            name="people-outline"
            size={60}
            color={HINGE_COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No one here yet</Text>
          <Text style={styles.emptyText}>
            Be the first to connect at this event
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={HINGE_COLORS.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{event?.title || "Networking"}</Text>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilterCount > 0 && styles.filterButtonActive,
          ]}
          onPress={handleFilterPress}
        >
          <Ionicons
            name="options-outline"
            size={24}
            color={
              activeFilterCount > 0 ? COLORS.primary : HINGE_COLORS.textPrimary
            }
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Scrollable Profile Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <Text style={styles.name}>{name}</Text>

        {/* Pronouns */}
        {pronouns && <Text style={styles.pronouns}>{pronouns}</Text>}

        {/* Hero Photo */}
        <ProfilePhotoCard
          photoUrl={heroPhoto}
          onMessagePress={() => handleContentMessage("photo", photos[0], 0)}
        />

        {/* Age with Cake Emoji */}
        {age && (
          <View style={styles.ageRow}>
            <Text style={styles.ageText}>🎂 {age}</Text>
          </View>
        )}

        {/* Goal Badges */}
        {goalBadges.length > 0 && (
          <View style={styles.goalBadgesContainer}>
            {goalBadges.map((badge, index) => (
              <GoalBadge key={index} text={badge} />
            ))}
          </View>
        )}

        {/* Interleaved Content (Prompts & Photos) */}
        {interleavedContent.map((item, idx) => {
          if (item.type === "prompt") {
            return (
              <PromptCard
                key={`prompt-${item.index}`}
                prompt={
                  item.data.prompt || "A topic I could talk about for hours..."
                }
                answer={item.data.response || ""}
                onMessagePress={() =>
                  handleContentMessage("prompt", item.data, item.index)
                }
              />
            );
          } else {
            return (
              <ProfilePhotoCard
                key={`photo-${item.index}`}
                photoUrl={item.data.url}
                onMessagePress={() =>
                  handleContentMessage("photo", item.data, item.index)
                }
              />
            );
          }
        })}

        {/* Shared Interests - Always at the end */}
        {interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.interestsLabel}>Shared interests</Text>
            <View style={styles.interestsList}>
              {interests.map((interest, index) => (
                <View key={index} style={styles.interestPill}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom Padding for action bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color={HINGE_COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.connectButton}
          onPress={handleConnect}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={20} color="#FFFFFF" />
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>

      {/* Content Like Modal */}
      <ContentLikeModal
        visible={messageModalVisible}
        onClose={() => setMessageModalVisible(false)}
        onSend={handleSendMessage}
        contentType={selectedContent?.type}
        contentData={selectedContent?.data}
        attendeeName={name}
      />

      {/* Filter Sheet */}
      <DiscoverFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={activeFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HINGE_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING.m,
    fontSize: 16,
    color: HINGE_COLORS.textSecondary,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: HINGE_COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  emptyText: {
    fontSize: 14,
    color: HINGE_COLORS.textSecondary,
    marginTop: SPACING.s,
    textAlign: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: HINGE_COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: HINGE_COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: HINGE_COLORS.textPrimary,
  },
  filterButton: {
    padding: SPACING.xs,
    position: "relative",
  },
  filterButtonActive: {
    backgroundColor: "#F0F7FF",
    borderRadius: 8,
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_MARGIN,
    paddingTop: SPACING.l,
  },

  // Name & Pronouns
  name: {
    fontSize: 28,
    fontWeight: "bold",
    color: HINGE_COLORS.textPrimary,
    marginBottom: 4,
  },
  pronouns: {
    fontSize: 15,
    color: HINGE_COLORS.textSecondary,
    marginBottom: SPACING.m,
  },

  // Photo Card
  photoCardContainer: {
    width: "100%",
    aspectRatio: PHOTO_ASPECT_RATIO,
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
    marginBottom: SPACING.m,
    backgroundColor: HINGE_COLORS.cardBg,
    ...SHADOWS.sm,
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  messageIconButton: {
    position: "absolute",
    bottom: SPACING.m,
    right: SPACING.m,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HINGE_COLORS.iconBg,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.md,
  },

  // Age Row
  ageRow: {
    marginBottom: SPACING.m,
  },
  ageText: {
    fontSize: 16,
    color: HINGE_COLORS.textPrimary,
    fontWeight: "500",
  },

  // Goal Badges
  goalBadgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
    marginBottom: SPACING.l,
  },
  goalBadge: {
    backgroundColor: HINGE_COLORS.badgeBg,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.pill,
  },
  goalBadgeText: {
    fontSize: 14,
    fontWeight: "500",
    color: HINGE_COLORS.badgeText,
  },

  // Prompt Card
  promptCard: {
    backgroundColor: HINGE_COLORS.cardBg,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    ...SHADOWS.sm,
  },
  promptLabel: {
    fontSize: 14,
    color: HINGE_COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  promptAnswer: {
    fontSize: 22,
    fontWeight: "700",
    color: HINGE_COLORS.textPrimary,
    lineHeight: 28,
  },
  promptMessageButton: {
    position: "absolute",
    bottom: SPACING.m,
    right: SPACING.m,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HINGE_COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },

  // Interests Section
  interestsSection: {
    marginTop: SPACING.m,
    marginBottom: SPACING.l,
  },
  interestsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: HINGE_COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  interestsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
  },
  interestPill: {
    backgroundColor: HINGE_COLORS.interestBg,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.pill,
  },
  interestText: {
    fontSize: 14,
    fontWeight: "500",
    color: HINGE_COLORS.interestText,
  },

  // Action Bar
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: 34,
    backgroundColor: HINGE_COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: HINGE_COLORS.border,
    gap: SPACING.m,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: HINGE_COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: HINGE_COLORS.cardBg,
  },
  connectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.pill,
    gap: 8,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: HINGE_COLORS.cardBg,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.l,
    paddingBottom: 40,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    padding: SPACING.xs,
  },
  modalPreview: {
    marginVertical: SPACING.m,
    alignItems: "center",
  },
  modalPreviewImage: {
    width: 120,
    height: 150,
    borderRadius: BORDER_RADIUS.m,
  },
  modalPreviewPrompt: {
    backgroundColor: HINGE_COLORS.background,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    maxWidth: "80%",
  },
  modalPreviewPromptText: {
    fontSize: 16,
    fontWeight: "600",
    color: HINGE_COLORS.textPrimary,
    textAlign: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: HINGE_COLORS.textPrimary,
    textAlign: "center",
    marginBottom: SPACING.m,
  },
  modalInput: {
    backgroundColor: HINGE_COLORS.background,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 16,
    color: HINGE_COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: SPACING.m,
  },
  modalSendButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
  },
  modalSendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
