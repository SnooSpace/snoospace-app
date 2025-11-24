import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getConversations, sendMessage } from "../../api/messages";
import { getMemberFollowers, getMemberFollowing } from "../../api/members";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiGet, apiPost } from "../../api/client";

const PRIMARY_COLOR = "#6A0DAD";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function ConversationsListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes from the left edge
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 10 &&
          evt.nativeEvent.pageX < 20
        ); // Start from left edge
      },
      onPanResponderRelease: (evt, gestureState) => {
        // If swiped right (positive dx) and far enough, navigate back
        if (gestureState.dx > 100) {
          navigation.goBack();
        }
      },
    })
  ).current;

  const loadConversations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await getConversations();
      setConversations(response.conversations || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const token = await getAuthToken();
      const email = await getAuthEmail();
      if (!token || !email) return;

      // Get current user's ID and type using the universal endpoint
      const profileResponse = await apiPost(
        "/auth/get-user-profile",
        { email },
        10000,
        token
      );
      const currentUserId = profileResponse?.profile?.id;
      const userType = profileResponse?.role;
      if (!currentUserId) return;

      // Only load suggestions for members (communities can't use member-specific APIs)
      if (userType !== "member") {
        setSuggestions([]);
        return;
      }

      // Fetch followers and following
      const [followersRes, followingRes] = await Promise.all([
        getMemberFollowers(currentUserId, { limit: 50, offset: 0 }).catch(
          () => ({ results: [] })
        ),
        getMemberFollowing(currentUserId, { limit: 50, offset: 0 }).catch(
          () => ({ results: [] })
        ),
      ]);

      const followers = followersRes.results || [];
      const following = followingRes.results || [];

      // Combine and deduplicate
      const allUsers = [];
      const seenIds = new Set();

      [...followers, ...following].forEach((user) => {
        if (
          user &&
          user.id &&
          !seenIds.has(user.id) &&
          user.id !== currentUserId
        ) {
          seenIds.add(user.id);
          allUsers.push({
            id: user.id,
            name: user.full_name || user.name,
            username: user.username,
            profilePhotoUrl: user.profile_photo_url,
          });
        }
      });

      // Randomly pick 6-8 suggestions
      const shuffled = allUsers.sort(() => 0.5 - Math.random());
      setSuggestions(shuffled.slice(0, 8));
    } catch (error) {
      console.error("Error loading suggestions:", error);
      // Silently fail - don't show suggestions if there's an error
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!loading && conversations.length === 0) {
      loadSuggestions();
    }
  }, [loading, conversations.length]);

  const handleStartConversation = async (userId, recipientType = "member") => {
    try {
      // Send an empty message to create conversation, or navigate directly
      // For now, navigate to chat screen which will handle conversation creation
      navigation.navigate("Chat", { recipientId: userId, recipientType });
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }) => {
    const participantType = item.otherParticipant?.type || "member";
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() =>
          navigation.navigate("Chat", {
            conversationId: item.id,
            recipientId: item.otherParticipant.id,
            recipientType: participantType,
          })
        }
      >
        <Image
          source={{
            uri:
              item.otherParticipant.profilePhotoUrl ||
              "https://via.placeholder.com/50",
          }}
          style={styles.avatar}
        />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.otherParticipant.name || "User"}
            </Text>
            {item.lastMessageAt && (
              <Text style={styles.conversationTime}>
                {formatTime(item.lastMessageAt)}
              </Text>
            )}
          </View>
          <View style={styles.conversationFooter}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || "No messages yet"}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 9 ? "9+" : String(item.unreadCount)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSuggestion = ({ item }) => (
    <View style={styles.suggestionCard}>
      <Image
        source={{
          uri: item.profilePhotoUrl || "https://via.placeholder.com/50",
        }}
        style={styles.suggestionAvatar}
      />
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {item.name || "User"}
        </Text>
        <Text style={styles.suggestionUsername} numberOfLines={1}>
          @{item.username || "user"}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => handleStartConversation(item.id)}
      >
        <Text style={styles.messageButtonText}>Message</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Start a conversation</Text>

          {loadingSuggestions ? (
            <ActivityIndicator
              size="small"
              color={PRIMARY_COLOR}
              style={{ marginTop: 20 }}
            />
          ) : suggestions.length > 0 ? (
            <>
              <Text style={styles.suggestionsTitle}>Suggestions</Text>
              <FlatList
                data={suggestions}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderSuggestion}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsList}
              />
            </>
          ) : (
            <Text style={styles.emptySubtext}>
              Follow others to start chatting with them
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderConversation}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
              tintColor={PRIMARY_COLOR}
              colors={[PRIMARY_COLOR]}
            />
          }
          ListHeaderComponent={
            suggestions.length > 0 ? (
              <View style={styles.suggestionsSection}>
                <Text style={styles.suggestionsTitle}>Suggestions</Text>
                <FlatList
                  data={suggestions}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderSuggestion}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsList}
                />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginTop: 20,
  },
  suggestionsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  suggestionsList: {
    paddingHorizontal: 16,
  },
  suggestionCard: {
    width: 140,
    marginRight: 12,
    padding: 12,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    alignItems: "center",
  },
  suggestionAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  suggestionInfo: {
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  suggestionUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  messageButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  messageButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  conversationItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 8,
  },
  conversationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
