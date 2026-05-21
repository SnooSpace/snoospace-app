import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  FlatList,
} from "react-native";
import {
  Trophy,
  ChevronRight,
  Search,
  CircleX,
  ArrowLeft,
  Users,
  Image as ImageIcon,
  Video,
} from "lucide-react-native";
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
 * The selected entity now includes `submission_type` so CreatePostScreen
 * can lock the media picker to the correct type.
 */
const EntityTagSelector = ({
  onEntitiesChange,
  initialEntities = [],
  style,
  onInteractionStart,
  onInteractionEnd,
  // Optional: parent can intercept challenge selection to show a conflict modal.
  // Called as onBeforeChallengeSelect(challenge, proceed) — call proceed() to confirm.
  onBeforeChallengeSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
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
      // Pass through submission_type so CreatePostScreen can lock the media picker
      submission_type: challenge.type_data?.submission_type || "image",
    };

    const commitSelection = () => {
      const newSelected = [...selectedEntities, challengeEntity];
      setSelectedEntities(newSelected);
      // Reset flow
      setSearchQuery("");
      setShowResults(false);
      setStep("community");
      setSelectedCommunity(null);
      setChallenges([]);
    };

    if (onBeforeChallengeSelect) {
      // Let parent validate (e.g. conflict with existing media) before committing
      onBeforeChallengeSelect(challenge, commitSelection);
    } else {
      commitSelection();
    }
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
            (c.caption || "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
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
          <Text style={[styles.noResults, { fontFamily: "Manrope-Medium" }]}>
            No communities found
          </Text>
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
                  <Users size={18} color="#999" strokeWidth={2} />
                </View>
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{community.name}</Text>
                {community.username && (
                  <Text style={styles.resultHandle}>
                    @{community.username}
                  </Text>
                )}
              </View>
              <ChevronRight size={18} color="#CCC" strokeWidth={2} />
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
            <Trophy size={32} color="#CCC" strokeWidth={1.5} />
            <Text style={[styles.noResults, { fontFamily: "Manrope-Medium" }]}>
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
          renderItem={({ item: challenge }) => {
            const subType = challenge.type_data?.submission_type || "image";
            return (
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
                  <View style={styles.challengeMeta}>
                    {/* Submission type pill */}
                    <View style={styles.subTypePill}>
                      {subType === "video" ? (
                        <Video size={10} color="#7C3AED" strokeWidth={2} />
                      ) : (
                        <ImageIcon size={10} color="#D97706" strokeWidth={2} />
                      )}
                      <Text
                        style={[
                          styles.subTypePillText,
                          {
                            color:
                              subType === "video" ? "#7C3AED" : "#D97706",
                          },
                        ]}
                      >
                        {subType === "video" ? "Video" : "Photo"}
                      </Text>
                    </View>
                    {challenge.expires_at && (
                      <Text style={styles.challengeExpiry}>
                        Ends{" "}
                        {new Date(challenge.expires_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                {challenge.is_joined && (
                  <View style={styles.joinedBadge}>
                    <Text style={styles.joinedText}>Joined</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
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
            <ArrowLeft size={18} color={LOCAL_COLORS.challenge} strokeWidth={2} />
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
        <Search size={18} color="#999" strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            step === "community"
              ? "Search communities..."
              : "Search challenges..."
          }
          placeholderTextColor="rgba(0,0,0,0.4)"
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
            <CircleX size={18} color="#CCC" strokeWidth={2} />
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
    color: "#333",
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
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
  },
  challengeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  subTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subTypePillText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
  },
  challengeExpiry: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
    opacity: 0.5,
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
    color: "#5DB075",
    letterSpacing: 0.3,
  },
});

export default EntityTagSelector;
