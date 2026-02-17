import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONTS, SHADOWS } from "../constants/theme";

const MentionSearchDropdown = ({
  visible,
  results = [],
  loading = false,
  onSelect,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 10,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  const people = results.filter((r) => r.type === "member");
  const communities = results.filter((r) => r.type === "community");
  const showSections = people.length > 0 && communities.length > 0;

  const renderItem = (item) => {
    const isCommunity = item.type === "community";
    const profilePhotoUrl = item?.profile_photo_url;
    const fullName =
      item?.full_name || item?.name || (isCommunity ? "Community" : "Member");
    const username = item?.username || "user";

    return (
      <TouchableOpacity
        key={`${item.type}-${item.id}`}
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => onSelect(item)}
      >
        {profilePhotoUrl ? (
          <Image source={{ uri: profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons
              name={isCommunity ? "people" : "person"}
              size={20}
              color={COLORS.textSecondary}
            />
          </View>
        )}

        <View style={styles.infoStack}>
          <Text style={styles.nameText} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={styles.usernameText} numberOfLines={1}>
            @{username}
          </Text>
        </View>

        {isCommunity && (
          <View style={styles.communityBadge}>
            <Ionicons name="trophy-outline" size={12} color="#374151" />
            <Text style={styles.communityBadgeText}>Community</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        style, // Allow overriding base styles (e.g. for positioning)
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching for a different name
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {showSections ? (
            <>
              {people.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>PEOPLE</Text>
                  {people.map(renderItem)}
                </View>
              )}
              {communities.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>COMMUNITIES</Text>
                  {communities.map(renderItem)}
                </View>
              )}
            </>
          ) : (
            results.map(renderItem)
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxHeight: 320,
    zIndex: 1000,
    // Soft elevation shadow: 0 6 24 rgba(0,0,0,0.06)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 8,
    paddingVertical: 8,
    overflow: "hidden",
  },
  scrollContainer: {
    maxHeight: 320,
  },
  centerContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    paddingHorizontal: 16,
    // Hover/Press state handling would be via TouchableOpacity props
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  placeholderAvatar: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  infoStack: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#111827",
    marginBottom: 2,
  },
  usernameText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#6B7280",
  },
  communityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    marginLeft: 8,
  },
  communityBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#374151",
  },
});

export default MentionSearchDropdown;
