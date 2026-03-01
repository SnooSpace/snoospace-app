import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Trophy } from "lucide-react-native";
import { apiGet } from "../api/client";
import { getAuthToken } from "../api/auth";
import { COLORS, FONTS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

// Local overrides if needed, but mostly using theme
const LOCAL_COLORS = {
  challenge: "#FF6B35", // Deep orange
  challengeLight: "#FFF3ED",
};

/**
 * EntityTagSelector — Challenge Tagging Component
 *
 * Two-step flow:
 *   Step 1: Search for a community
 *   Step 2: Pick an active challenge from that community
 *
 * Only one challenge can be tagged per post.
 */
const EntityTagSelector = ({
  onEntitiesChange,
  initialEntities = [],
  style,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  // ... (lines 40-209 unchanged)

  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntities, setSelectedEntities] = useState(initialEntities);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Two-step challenge flow
  const [step, setStep] = useState("community"); // 'community' | 'challenge'
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);

  useEffect(() => {
    if (onEntitiesChange) {
      onEntitiesChange(selectedEntities);
    }
  }, [selectedEntities]);

  const hasChallenge = selectedEntities.some((e) => e.type === "challenge");

  // ─── Step 1: Search communities ───────────────────────────────
  const searchCommunities = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      const res = await apiGet(
        `/communities/search?query=${encodeURIComponent(query)}`,
        15000,
        token,
      );
      const communities = (res.results || []).map((c) => ({
        id: c.id,
        name: c.name,
        username: c.username,
        logo_url: c.logo_url,
      }));
      setSearchResults(communities);
      setShowResults(communities.length > 0 || query.length > 0);
    } catch (error) {
      console.error("Error searching communities:", error);
      setSearchResults([]);
      setShowResults(query.length > 0);
    } finally {
      setIsSearching(false);
    }
  };

  // ─── Step 2: Fetch active challenges for selected community ───
  const fetchChallengesForCommunity = async (communityId) => {
    setIsLoadingChallenges(true);
    try {
      const token = await getAuthToken();
      const res = await apiGet(
        `/challenges/search?communityId=${communityId}`,
        15000,
        token,
      );
      setChallenges(res.challenges || []);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      setChallenges([]);
    } finally {
      setIsLoadingChallenges(false);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (step === "community") {
      searchCommunities(text);
    }
    // For challenge step, filter locally
  };

  const selectCommunity = (community) => {
    setSelectedCommunity(community);
    setStep("challenge");
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    fetchChallengesForCommunity(community.id);
  };

  const selectChallenge = (challenge) => {
    if (hasChallenge) {
      Alert.alert("Limit Reached", "You can only tag one challenge per post.");
      return;
    }

    const challengeEntity = {
      id: challenge.id,
      type: "challenge",
      name:
        challenge.title || challenge.caption?.substring(0, 50) || "Challenge",
      communityName: selectedCommunity?.name,
      communityId: selectedCommunity?.id,
      expires_at: challenge.expires_at,
      is_joined: challenge.is_joined,
    };

    const newSelected = [...selectedEntities, challengeEntity];
    setSelectedEntities(newSelected);

    // Reset flow
    setSearchQuery("");
    setShowResults(false);
    setStep("community");
    setSelectedCommunity(null);
    setChallenges([]);
  };

  const removeEntity = (entityId) => {
    const newSelected = selectedEntities.filter((e) => e.id !== entityId);
    setSelectedEntities(newSelected);
  };

  const goBackToCommunities = () => {
    setStep("community");
    setSelectedCommunity(null);
    setChallenges([]);
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  // ─── Filtered challenges (client-side filter when user types) ─
  const filteredChallenges =
    searchQuery.length > 0
      ? challenges.filter(
          (c) =>
            (c.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.caption || "").toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : challenges;

  // ─── Render ───────────────────────────────────────────────────
  const renderCommunityResults = () => {
    if (isSearching) {
      return (
        <View style={[styles.resultsContainer, { padding: 20 }]}>
          <SnooLoader size="small" color={LOCAL_COLORS.challenge} />
        </View>
      );
    }

    if (searchResults.length === 0 && searchQuery.length > 0) {
      return (
        <View style={styles.resultsContainer}>
          <Text style={[styles.noResults, { fontFamily: 'Manrope-Medium' }]}>No communities found</Text>
        </View>
      );
    }

    return (
      <View
        style={styles.resultsContainer}
        onTouchStart={onInteractionStart}
        onTouchEnd={onInteractionEnd}
        onTouchCancel={onInteractionEnd}
      >
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id.toString()}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: community }) => (
            <TouchableOpacity
              style={styles.resultItem}
              onPress={() => selectCommunity(community)}
            >
              {community.logo_url ? (
                <Image
                  source={{ uri: community.logo_url }}
                  style={styles.resultAvatar}
                />
              ) : (
                <View style={[styles.resultAvatar, styles.avatarPlaceholder]}>
                  <Ionicons name="people" size={18} color="#999" />
                </View>
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{community.name}</Text>
                {community.username && (
                  <Text style={styles.resultHandle}>@{community.username}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  const renderChallengeList = () => {
    if (isLoadingChallenges) {
      return (
        <View style={[styles.resultsContainer, { padding: 20 }]}>
          <SnooLoader size="small" color={LOCAL_COLORS.challenge} />
        </View>
      );
    }

    if (filteredChallenges.length === 0) {
      return (
        <View style={styles.resultsContainer}>
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={32} color="#CCC" />
            <Text style={[styles.noResults, { fontFamily: 'Manrope-Medium' }]}>
              {challenges.length === 0
                ? "No active challenges in this community"
                : "No matching challenges"}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={styles.resultsContainer}
        onTouchStart={onInteractionStart}
        onTouchEnd={onInteractionEnd}
        onTouchCancel={onInteractionEnd}
      >
        <FlatList
          data={filteredChallenges}
          keyExtractor={(item) => item.id.toString()}
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: challenge }) => (
            <TouchableOpacity
              style={styles.challengeItem}
              onPress={() => selectChallenge(challenge)}
            >
              <View style={styles.challengeIcon}>
                <Trophy
                  size={20}
                  color={LOCAL_COLORS.challenge}
                  strokeWidth={2}
                />
              </View>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle} numberOfLines={1}>
                  {challenge.title ||
                    challenge.caption?.substring(0, 50) ||
                    "Challenge"}
                </Text>
                {challenge.expires_at && (
                  <Text style={styles.challengeExpiry}>
                    Ends {new Date(challenge.expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              {challenge.is_joined && (
                <View style={styles.joinedBadge}>
                  <Text style={styles.joinedText}>Joined</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  // If already tagged, show minimal "tagged" state
  if (hasChallenge) {
    return null; // The banner in CreatePostScreen handles displaying the tag
  }

  return (
    <View style={[styles.container, style]}>
      {/* Step indicator / breadcrumb */}
      <View style={styles.stepHeader}>
        {step === "challenge" && selectedCommunity && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={goBackToCommunities}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={LOCAL_COLORS.challenge}
            />
          </TouchableOpacity>
        )}
        <View style={styles.stepBadge}>
          <Trophy size={16} color={LOCAL_COLORS.challenge} strokeWidth={2.5} />
          <Text style={styles.stepText}>
            {step === "community"
              ? "Select a community"
              : `${selectedCommunity?.name} › Challenges`}
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={
            step === "community"
              ? "Search communities..."
              : "Search challenges..."
          }
          placeholderTextColor="rgba(0,0,0,0.4)" // ~60% opacity look on dark text
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery("");
              setSearchResults([]);
              setShowResults(false);
            }}
          >
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {step === "community" && showResults && renderCommunityResults()}
      {step === "challenge" && renderChallengeList()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  // Step header
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: "#333", // Dark grey
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
    padding: 0,
  },
  // Results
  resultsContainer: {
    maxHeight: 250,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  noResults: {
    textAlign: "center",
    color: "#999",
    fontSize: 13,
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  // Community result items
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
  },
  resultHandle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
    opacity: 0.6,
    marginTop: 2,
  },
  // Challenge items
  challengeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  challengeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LOCAL_COLORS.challengeLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
  },
  challengeExpiry: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
    opacity: 0.6,
    marginTop: 2,
  },
  joinedBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 13,
  },
  joinedText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#5DB075", // Softer green
    letterSpacing: 0.3,
  },
});

export default EntityTagSelector;
