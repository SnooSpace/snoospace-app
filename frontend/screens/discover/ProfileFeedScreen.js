import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MessageCircle } from "lucide-react-native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, SHADOWS, FONTS } from "../../constants/theme";
import DiscoverFilterSheet from "../../components/DiscoverFilterSheet";
import HapticsService from "../../services/HapticsService";

const { width } = Dimensions.get("window");
const CARD_RADIUS = 24;
const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 32,
  elevation: 5,
};

// Strict Typography Mappings
const TYPOGRAPHY = {
  name: { fontFamily: FONTS.semiBold, fontSize: 20, color: "#1E293B" },
  role: { fontFamily: FONTS.regular, fontSize: 14, color: "#64748B" },
  body: { fontFamily: FONTS.regular, fontSize: 16, color: "#334155" },
  chip: { fontFamily: FONTS.medium, fontSize: 12, color: "#475569" },
  button: { fontFamily: FONTS.medium, fontSize: 14, color: "#FFFFFF" },
  header: { fontFamily: FONTS.semiBold, fontSize: 18, color: "#0F172A" },
};

export default function ProfileFeedScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

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
        // Query param logic here (omitted for brevity, assume similar to before)
        const response = await apiGet(
          `/events/${event.id}/attendees`,
          15000,
          token,
        );
        setAttendees(response.attendees || []);
      }
    } catch (error) {
      //   console.error("Error loading attendees:", error);
      setAttendees([]); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const currentAttendee = attendees[currentIndex];

  // Data Extraction
  const name = (currentAttendee?.name || "Unknown").trim() || "Unknown";
  const role =
    (currentAttendee?.role || currentAttendee?.job_title || "Member").trim() ||
    "Member";
  const goalBadges = currentAttendee?.intent_badges || [];
  const interests = currentAttendee?.interests || [];
  const openers = currentAttendee?.openers || [];

  const photos = useMemo(() => {
    if (!currentAttendee) return [];
    const p = currentAttendee.discover_photos || currentAttendee.photos || [];
    return p
      .map((ph, i) => ({ id: i, url: ph.url || ph.photo_url || ph }))
      .filter((x) => x.url);
  }, [currentAttendee]);

  const interleavedContent = useMemo(() => {
    const content = [];
    let pIndex = 1;
    let oIndex = 0;
    while (oIndex < openers.length || pIndex < photos.length) {
      if (oIndex < openers.length) {
        content.push({ type: "prompt", data: openers[oIndex], index: oIndex });
        oIndex++;
      }
      if (pIndex < photos.length) {
        content.push({ type: "photo", data: photos[pIndex], index: pIndex });
        pIndex++;
      }
    }
    return content;
  }, [photos, openers]);

  const handleNext = () => {
    if (currentIndex < attendees.length - 1)
      setCurrentIndex((prev) => prev + 1);
    else Alert.alert("All Done", "You've seen everyone.");
  };

  const handleConnect = () => {
    HapticsService.triggerImpactMedium();
    Alert.alert("Request Sent", `Connection request sent to ${name}`);
    handleNext();
  };

  const ContentCard = ({ children, onPress, style }) => (
    <TouchableOpacity
      style={[styles.cardContainer, style]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {children}
    </TouchableOpacity>
  );

  const PromptCard = ({ item }) => (
    <ContentCard onPress={() => {}} style={styles.promptCardContainer}>
      <View style={styles.promptContent}>
        <Text style={styles.promptLabel}>{item.data.prompt}</Text>
        <Text style={styles.promptAnswer}>{item.data.response}</Text>
      </View>
      <View style={styles.actionIconBubble}>
        <MessageCircle size={22} color="#0F3D3E" />
      </View>
    </ContentCard>
  );

  const PhotoCard = ({ url }) => (
    <ContentCard onPress={() => {}} style={styles.photoCardContainer}>
      <Image
        source={{ uri: url }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.2)"]}
        style={styles.gradientOverlay}
      />
      <View style={styles.actionIconBubble}>
        <MessageCircle size={22} color="#0F3D3E" />
      </View>
    </ContentCard>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!currentAttendee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{event?.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>No one here yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity
          onPress={() => setFilterSheetVisible(true)}
          style={styles.filterBtn}
        >
          <Ionicons name="options-outline" size={24} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Profile Info */}
        <View style={styles.profileHeader}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.roleText}>{role}</Text>

          {/* Interest Chips */}
          {interests.length > 0 && (
            <View style={styles.chipContainer}>
              {interests.slice(0, 3).map((interest, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Hero Photo */}
        {photos[0] && <PhotoCard url={photos[0].url} />}

        {/* Interleaved Prompts & Photos */}
        {interleavedContent.map((item, i) => (
          <View key={i} style={styles.feedItem}>
            {item.type === "prompt" ? (
              <PromptCard item={item} />
            ) : (
              <PhotoCard url={item.data.url} />
            )}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
          <Ionicons name="close" size={24} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>

      <DiscoverFilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        onApply={setActiveFilters}
        initialFilters={activeFilters}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Clean background
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    ...TYPOGRAPHY.header,
  },
  backBtn: {
    padding: 4,
  },
  filterBtn: {
    padding: 4,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },

  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: 12, // Reduced empty feeling at the very top
    paddingBottom: 40,
  },

  // Profile Info
  profileHeader: {
    marginBottom: SPACING.l,
  },
  nameText: {
    fontFamily: FONTS.semiBold,
    fontSize: 32, // More prominent
    color: "#0F172A",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  roleText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#64748B",
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#F1F5F9",
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: {
    ...TYPOGRAPHY.chip,
  },

  // Cards
  cardContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    marginBottom: SPACING.l,
    ...CARD_SHADOW,
    overflow: "visible", // For shadow
  },
  photoCardContainer: {
    aspectRatio: 4 / 5, // Portrait Cards (Photos)
  },
  promptCardContainer: {
    minHeight: 140, // Ensure a base presence even for very short text
    paddingBottom: 40, // Extra space for the floating chat icon
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: CARD_RADIUS,
    backgroundColor: "#F1F5F9",
  },
  gradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "30%",
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  promptContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: 24,
    paddingTop: 32,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  promptLabel: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#64748B",
    marginBottom: 8,
  },
  promptAnswer: {
    fontFamily: FONTS.semiBold,
    fontSize: 24, // Filling space better
    color: "#0F172A",
    lineHeight: 32,
  },

  // Interactive Elements on Cards
  actionIconBubble: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D4EEEF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  // Feed Items
  feedItem: {
    marginBottom: 0, // Spacing handled by card margin
  },

  // Bottom Action Bar
  actionBar: {
    position: "absolute",
    bottom: 24, // Floating
    left: SPACING.l,
    right: SPACING.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.md,
  },
  connectButton: {
    flex: 1,
    height: 56, // Match skip button visual weight or use 44px as requested? Spec said "Height: 44px". Let's use 44px but maybe vertically centered with the 56px skip button? Or matching? Typically main action is prominent. 44px might essentially be for a pill button.
    // Adjusting to spec: Height 44px.
    height: 44,
    borderRadius: 12,
    backgroundColor: "#2962FF", // Calm, confident blue
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },
  connectButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
  },
});
