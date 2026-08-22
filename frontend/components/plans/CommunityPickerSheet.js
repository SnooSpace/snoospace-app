import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Users, Search, Check, X, Sparkles } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, FONTS } from "../../constants/theme";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { searchCommunities } from "../../api/communities";
import SwipeableModal from "../modals/SwipeableModal";
import HapticsService from "../../services/HapticsService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const RECENT_COMMUNITIES_KEY = "@snoospace_recent_communities";

/**
 * CommunityPickerSheet
 *
 * Multi-select picker for communities when visibility = 'community_members'.
 * Features:
 *   - Matches exact height (85% screen) and corner radius of parent HostPlan modal
 *   - Fast-pick section showing the last 3 interacted communities
 *   - Real-time debounced search bar
 *   - Smoothly scrollable result list
 *   - Multi-select toggle with haptics
 */
export default function CommunityPickerSheet({
  visible,
  isVisible,
  onClose,
  selectedIds = [],
  onSelectionChange,
  currentUserId,
}) {
  const isModalVisible = visible !== undefined ? visible : isVisible;

  const [followedCommunities, setFollowedCommunities] = useState([]);
  const [recentCommunities, setRecentCommunities] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchTimerRef = useRef(null);

  // Load recent communities from AsyncStorage
  const loadRecentCommunities = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_COMMUNITIES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentCommunities(parsed);
        }
      }
    } catch (e) {
      console.warn("[CommunityPickerSheet] Failed to load recent communities:", e);
    }
  }, []);

  // Save selected communities to recent list in AsyncStorage
  const saveToRecent = useCallback(
    async (community) => {
      if (!community || !community.id) return;
      try {
        const stored = await AsyncStorage.getItem(RECENT_COMMUNITIES_KEY);
        let list = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(list)) list = [];
        
        // Put the most recent on top, deduplicate by ID, keep max 10
        const updated = [
          community,
          ...list.filter((c) => String(c.id) !== String(community.id)),
        ].slice(0, 10);

        await AsyncStorage.setItem(RECENT_COMMUNITIES_KEY, JSON.stringify(updated));
        setRecentCommunities(updated);
      } catch (e) {
        console.warn("[CommunityPickerSheet] Failed to save recent community:", e);
      }
    },
    []
  );

  // Fetch followed communities
  const fetchFollowedCommunities = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await apiGet(
        `/following/${currentUserId}/member?limit=100&page=1`,
        15000,
        token
      );
      const allFollowing = res?.following || [];
      const communitiesOnly = allFollowing
        .filter((f) => f.following_type === "community")
        .map((f) => ({
          id: parseInt(f.following_id, 10),
          name: f.following_name,
          username: f.following_username,
          logo_url: f.following_photo_url,
          category: f.following_category,
        }));
      setFollowedCommunities(communitiesOnly);
    } catch (err) {
      console.warn("[CommunityPickerSheet] fetch error:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isModalVisible) {
      setSearchQuery("");
      setSearchResults([]);
      loadRecentCommunities();
      fetchFollowedCommunities();
    }
  }, [isModalVisible, loadRecentCommunities, fetchFollowedCommunities]);

  // Handle Search typing with debounce
  const handleSearchChange = useCallback(
    (text) => {
      setSearchQuery(text);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      const trimmed = text.trim();
      if (!trimmed || trimmed.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const res = await searchCommunities(trimmed, { limit: 30 });
          const remoteResults = (res?.results || []).map((c) => ({
            id: parseInt(c.id, 10),
            name: c.name,
            username: c.username,
            logo_url: c.logo_url,
            category: c.category,
          }));
          setSearchResults(remoteResults);
        } catch (err) {
          console.warn("[CommunityPickerSheet] search error:", err?.message);
        } finally {
          setSearching(false);
        }
      }, 250);
    },
    []
  );

  // Toggle selection for a community
  const toggleCommunity = useCallback(
    (community) => {
      HapticsService.triggerImpactLight();
      const numId = parseInt(community.id, 10);
      const next = selectedIds.includes(numId)
        ? selectedIds.filter((x) => x !== numId)
        : [...selectedIds, numId];
      onSelectionChange(next);

      // Add to recent interactions if newly selected
      if (!selectedIds.includes(numId)) {
        saveToRecent(community);
      }
    },
    [selectedIds, onSelectionChange, saveToRecent]
  );

  // Fast-pick top 3 interacted communities:
  // Priority: Recent stored communities, then fallback to followed communities
  const fastPickCommunities = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Add from recent interactions
    for (const c of recentCommunities) {
      const id = parseInt(c.id, 10);
      if (!seen.has(id)) {
        seen.add(id);
        list.push(c);
        if (list.length === 3) break;
      }
    }

    // 2. Fill up to 3 from followed communities if needed
    if (list.length < 3) {
      for (const c of followedCommunities) {
        const id = parseInt(c.id, 10);
        if (!seen.has(id)) {
          seen.add(id);
          list.push(c);
          if (list.length === 3) break;
        }
      }
    }

    return list.slice(0, 3);
  }, [recentCommunities, followedCommunities]);

  // Combined list for display
  const displayList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return followedCommunities;
    }

    // When searching: combine local matches with remote search results, deduplicating by ID
    const seen = new Set();
    const combined = [];

    // Local followed matches first
    for (const c of followedCommunities) {
      if (
        c.name?.toLowerCase().includes(query) ||
        c.username?.toLowerCase().includes(query)
      ) {
        const id = parseInt(c.id, 10);
        if (!seen.has(id)) {
          seen.add(id);
          combined.push(c);
        }
      }
    }

    // Remote search results
    for (const c of searchResults) {
      const id = parseInt(c.id, 10);
      if (!seen.has(id)) {
        seen.add(id);
        combined.push(c);
      }
    }

    return combined;
  }, [searchQuery, followedCommunities, searchResults]);

  const selectedCount = selectedIds.length;

  const renderFastPickItem = (item) => {
    const isSelected = selectedIds.includes(parseInt(item.id, 10));
    return (
      <TouchableOpacity
        key={String(item.id)}
        style={[styles.fastPickChip, isSelected && styles.fastPickChipSelected]}
        onPress={() => toggleCommunity(item)}
        activeOpacity={0.75}
      >
        {item.logo_url ? (
          <Image
            source={{ uri: item.logo_url }}
            style={styles.fastPickLogo}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.fastPickLogo, styles.logoFallback]}>
            <Users size={14} color={COLORS.textSecondary} strokeWidth={1.8} />
          </View>
        )}
        <Text style={[styles.fastPickName, isSelected && styles.fastPickNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.fastPickCheckbox, isSelected && styles.fastPickCheckboxSelected]}>
          {isSelected && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.includes(parseInt(item.id, 10));
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={() => toggleCommunity(item)}
        activeOpacity={0.7}
      >
        {item.logo_url ? (
          <Image
            source={{ uri: item.logo_url }}
            style={styles.logo}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Users size={18} color={COLORS.textSecondary} strokeWidth={1.8} />
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
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={2.5} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Select communities</Text>
          {selectedCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <X size={20} color={COLORS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SwipeableModal
      visible={isModalVisible}
      onClose={onClose}
      avoidKeyboard={false}
      header={renderHeader()}
      sheetStyle={styles.sheet}
    >
      <View style={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Select one or more communities to share this plan with their members.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <Search size={16} color={COLORS.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search communities..."
            placeholderTextColor={COLORS.textMuted || "#94A3B8"}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color="#7C3AED" />}
          {searchQuery.length > 0 && !searching && (
            <TouchableOpacity onPress={() => handleSearchChange("")} hitSlop={8}>
              <X size={16} color={COLORS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Fast Pick Section (Default top 3 interacted/recent communities) */}
        {!searchQuery.trim() && fastPickCommunities.length > 0 && (
          <View style={styles.fastPickSection}>
            <View style={styles.sectionHeaderRow}>
              <Sparkles size={13} color="#7C3AED" strokeWidth={2} />
              <Text style={styles.sectionHeaderTitle}>FAST PICK · RECENT</Text>
            </View>
            <View style={styles.fastPickRow}>
              {fastPickCommunities.map(renderFastPickItem)}
            </View>
          </View>
        )}

        {/* Section title for list */}
        <View style={styles.listSectionHeader}>
          <Text style={styles.listSectionTitle}>
            {searchQuery.trim() ? "SEARCH RESULTS" : "ALL COMMUNITIES"}
          </Text>
          <Text style={styles.listCountText}>
            {displayList.length} {displayList.length === 1 ? "community" : "communities"}
          </Text>
        </View>

        {/* Scrollable Community List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : displayList.length === 0 ? (
          <View style={styles.center}>
            <Users size={32} color={COLORS.textMuted || "#94A3B8"} strokeWidth={1.5} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? "No communities found" : "No communities in circle or followed yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? `No communities matching "${searchQuery}"`
                : "Join community circles or follow communities to easily select them when posting open plans."}
            </Text>
          </View>
        ) : (
          <SwipeableModal.FlatList
            data={displayList}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
          />
        )}

        {/* Done Floating / Bottom Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.doneBtn,
              selectedCount === 0 && styles.doneBtnDisabled,
            ]}
            onPress={onClose}
            disabled={selectedCount === 0}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.doneBtnText,
                selectedCount === 0 && styles.doneBtnTextDisabled,
              ]}
            >
              {selectedCount > 0
                ? `Done · ${selectedCount} selected`
                : "Done"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.85,
    maxHeight: SCREEN_HEIGHT * 0.85,
    overflow: "hidden",
  },
  contentContainer: {
    flex: 1,
  },
  headerWrap: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border || "#E2E8F0",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border || "#CBD5E1",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: FONTS.primary || "BasicCommercial-Bold",
    fontSize: 18,
    color: "#0F172A",
  },
  badge: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  closeBtn: {
    padding: 4,
    borderRadius: 16,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary || "#64748B",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
  },
  fastPickSection: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: "#7C3AED",
    letterSpacing: 0.6,
  },
  fastPickRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "nowrap",
  },
  fastPickChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fastPickChipSelected: {
    backgroundColor: "#FAF5FF",
    borderColor: "#8B5CF6",
  },
  fastPickLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E2E8F0",
  },
  fastPickName: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#1E293B",
  },
  fastPickNameSelected: {
    fontFamily: FONTS.semiBold,
    color: "#6D28D9",
  },
  fastPickCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  fastPickCheckboxSelected: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  listSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  listSectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  listCountText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#94A3B8",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 110,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 3,
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowSelected: {
    backgroundColor: "#FAF5FF",
    borderColor: "#DDD6FE",
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  logoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
  },
  communityName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#0F172A",
  },
  communityUsername: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 4,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 38 : 28,
  },
  doneBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBtnDisabled: {
    backgroundColor: "#E2E8F0",
  },
  doneBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  doneBtnTextDisabled: {
    color: "#94A3B8",
  },
});
