import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { Users, Search, Check, X } from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import SwipeableModal from "../modals/SwipeableModal";

/**
 * CommunityPickerSheet
 *
 * Multi-select picker for communities the current user belongs to (follows or
 * is-circle-member-of). Shown when visibility = 'community_members' in the plan
 * creation / edit flows.
 *
 * Props:
 *   isVisible        {boolean}     – controls modal visibility
 *   onClose          {function}    – called when the sheet is dismissed
 *   selectedIds      {number[]}    – currently selected community IDs (controlled)
 *   onSelectionChange {function}   – called with new number[] when selection changes
 *   currentUserId    {number|null} – the logged-in member's numeric ID
 */
export default function CommunityPickerSheet({
  isVisible,
  onClose,
  selectedIds = [],
  onSelectionChange,
  currentUserId,
}) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch every community the user follows, filtering client-side for search
  const fetchMyCommunities = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const token = await getAuthToken();
      // GET /following/:userId/member returns all types; filter to following_type='community'
      const res = await apiGet(
        `/following/${currentUserId}/member?limit=100&page=1`,
        15000,
        token
      );
      const allFollowing = res?.following || [];
      const communitiesOnly = allFollowing
        .filter((f) => f.following_type === "community")
        .map((f) => ({
          id: f.following_id,
          name: f.following_name,
          username: f.following_username,
          logo_url: f.following_photo_url,
        }));
      setCommunities(communitiesOnly);
    } catch (err) {
      console.warn("[CommunityPickerSheet] fetch error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isVisible) {
      setSearchQuery("");
      fetchMyCommunities();
    }
  }, [isVisible, fetchMyCommunities]);

  const toggleCommunity = useCallback(
    (id) => {
      const numId = parseInt(id, 10);
      const next = selectedIds.includes(numId)
        ? selectedIds.filter((x) => x !== numId)
        : [...selectedIds, numId];
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  const filtered = searchQuery.trim()
    ? communities.filter((c) =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : communities;

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.includes(parseInt(item.id, 10));
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => toggleCommunity(item.id)}
        activeOpacity={0.7}
      >
        {item.logo_url ? (
          <Image
            source={{ uri: item.logo_url }}
            style={styles.logo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Users size={16} color={COLORS.textSecondary} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={styles.communityName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.username ? (
            <Text style={styles.communityUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        <View
          style={[styles.checkbox, isSelected && styles.checkboxSelected]}
        >
          {isSelected && (
            <Check size={12} color="#fff" strokeWidth={2.5} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCount = selectedIds.length;

  return (
    <SwipeableModal
      isVisible={isVisible}
      onClose={onClose}
      maxHeight={0.72}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Select communities</Text>
          {selectedCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Plan will be visible to members of the selected communities.
        {"\n"}Select none to use broad visibility (any shared community).
      </Text>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Search size={15} color={COLORS.textSecondary} strokeWidth={1.8} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search communities…"
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {searchQuery.trim()
              ? "No communities match your search."
              : "You don't follow any communities yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Done CTA */}
      <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>
          {selectedCount > 0
            ? `Done  ·  ${selectedCount} selected`
            : "Done — apply to all shared communities"}
        </Text>
      </TouchableOpacity>
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    ...FONTS.semiBold,
    fontSize: 12,
    color: "#fff",
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    lineHeight: 19,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface || "#F4F4F6",
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginVertical: 2,
    gap: 12,
  },
  rowSelected: {
    backgroundColor: COLORS.primaryUltraLight || "#EEF2FF",
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.border || "#E8E8E8",
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  communityName: {
    ...FONTS.semiBold,
    fontSize: 14,
    color: COLORS.text,
  },
  communityUsername: {
    ...FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border || "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  doneBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneBtnText: {
    ...FONTS.semiBold,
    fontSize: 15,
    color: "#fff",
  },
});
