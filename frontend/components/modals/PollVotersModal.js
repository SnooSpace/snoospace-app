import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { X, HatGlasses } from "lucide-react-native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import SnooLoader from "../ui/SnooLoader";
import { COLORS, FONTS } from "../../constants/theme";
import SwipeableModal from "./SwipeableModal";

const PollVotersModal = ({ visible, onClose, postId, options }) => {
  const [loading, setLoading] = useState(true);
  const [votersByOption, setVotersByOption] = useState({});
  const [selectedOption, setSelectedOption] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    if (visible && postId) {
      fetchVoters();
    }
  }, [visible, postId]);

  const fetchVoters = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await apiGet(
        `/posts/${postId}/poll-voters`,
        10000,
        token,
      );

      console.log("[PollVotersModal] Fetched data:", {
        voters_by_option: response.voters_by_option,
        total_votes: response.total_votes,
      });
      setVotersByOption(response.voters_by_option || {});
      setTotalVotes(response.total_votes || 0);
    } catch (error) {
      console.error("Error fetching poll voters:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderVoter = ({ item }) => {
    const isVoterAnon = item.is_anonymous === true || !item.voter_username;
    return (
      <View style={styles.voterItem}>
        {isVoterAnon ? (
          <View style={styles.anonVoterAvatar}>
            <HatGlasses size={22} color={COLORS.primary || "#3b65e4"} strokeWidth={2} />
          </View>
        ) : (
          <Image
            source={
              item.voter_photo_url
                ? { uri: item.voter_photo_url }
                : { uri: "https://via.placeholder.com/44" }
            }
            style={styles.voterAvatar}
          />
        )}
        <View style={styles.voterInfo}>
          <Text style={styles.voterName}>{item.voter_name || "Anonymous"}</Text>
          {!isVoterAnon && (
            <Text style={styles.voterUsername}>@{item.voter_username}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>No votes yet</Text>
    </View>
  );

  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.modalContainer}
    >
      {/* Handle bar */}
      <View style={styles.handleBar} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Poll Results</Text>
          <Text style={styles.headerSubtitle}>
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#1D1D1F" />
        </TouchableOpacity>
      </View>

      {/* Option Tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          data={options}
          keyExtractor={(item, index) => `tab-${index}`}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const voteCount = votersByOption[item.index]?.length || 0;
            return (
              <TouchableOpacity
                style={[
                  styles.tab,
                  selectedOption === item.index && styles.tabActive,
                ]}
                onPress={() => setSelectedOption(item.index)}
              >
                <Text
                  style={[
                    styles.tabText,
                    selectedOption === item.index && styles.tabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.text}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    selectedOption === item.index && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      selectedOption === item.index &&
                        styles.tabBadgeTextActive,
                    ]}
                  >
                    {voteCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Voters List */}
      <View style={styles.votersListContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color="#3b65e4" />
          </View>
        ) : (
          <FlatList
            data={votersByOption[selectedOption] || []}
            keyExtractor={(item, index) =>
              `voter-${item.voter_id}-${item.voter_type}-${index}`
            }
            renderItem={renderVoter}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={styles.votersList}
          />
        )}
      </View>
    </SwipeableModal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: Dimensions.get("window").height * 0.8,
    paddingBottom: 20,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: "#1D1D1F",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#6B7280",
  },
  closeButton: {
    padding: 4,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    paddingVertical: 12,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: "#F5F5F7",
    gap: 8,
  },
  tabActive: {
    backgroundColor: "#3b65e4",
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#5B6B7C",
    maxWidth: 120,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  tabBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  tabBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#5B6B7C",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  votersListContainer: {
    flex: 1,
  },
  votersList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  voterItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F7",
  },
  voterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F0",
    marginRight: 12,
  },
  anonVoterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(59, 101, 228, 0.08)",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  voterInfo: {
    flex: 1,
  },
  voterName: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#1D1D1F",
    marginBottom: 2,
  },
  voterUsername: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#6B7280",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: "#9CA3AF",
  },
});

export default PollVotersModal;
