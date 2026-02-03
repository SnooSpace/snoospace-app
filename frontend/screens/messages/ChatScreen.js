import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Platform,
  Alert,
  Animated as RNAnimated,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft, Send } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { getMessages, sendMessage, getConversations } from "../../api/messages";
import { getPublicMemberProfile } from "../../api/members";
import { getPublicCommunity } from "../../api/communities";
import { confirmGiftRSVP } from "../../api/events";
import EventBus from "../../utils/EventBus";
import { COLORS } from "../../constants/theme";
import KeyboardAwareToolbar from "../../components/KeyboardAwareToolbar";
import TicketMessageCard from "../../components/TicketMessageCard";
import SharedPostCard from "../../components/SharedPostCard";
import ProfilePostFeed from "../../components/ProfilePostFeed";

const PRIMARY_COLOR = "#3565F2"; // Branded Blue
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const SEND_BUTTON_PRESSED = "#2E56D6";

// Message bubble colors - Refined Palette
const CHAT_CANVAS_BG = "#F7F9FC";
const OUTGOING_MESSAGE_BG = "#E6F0FF";
const INCOMING_MESSAGE_BG = "#FFFFFF";
const INCOMING_MESSAGE_BORDER = "#E6ECF5";
const MESSAGE_TEXT_COLOR = "#1F3A5F";

export default function ChatScreen({ route, navigation }) {
  const {
    conversationId,
    recipientId,
    recipientType = "member",
  } = route.params || {};
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState(null);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  const [currentRecipientType, setCurrentRecipientType] =
    useState(recipientType);
  const [currentRecipientId, setCurrentRecipientId] = useState(recipientId);
  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);
  const supabaseRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const [rsvpLoading, setRsvpLoading] = useState({});
  const [sharedPostModalVisible, setSharedPostModalVisible] = useState(false);
  const [selectedSharedPost, setSelectedSharedPost] = useState(null);
  const [sharedPosts, setSharedPosts] = useState({}); // Track shared posts by ID for state updates
  const insets = useSafeAreaInsets();

  // Reanimated keyboard tracking for manual Android handling
  const keyboardHeight = useSharedValue(0);

  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      // Smooth timing animation for fluid movement
      keyboardHeight.value = withTiming(e.height, {
        duration: e.duration > 0 ? e.duration : 250,
        easing: Easing.out(Easing.exp),
      });
    },
    onInteractive: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
  });

  const androidContainerStyle = useAnimatedStyle(() => {
    // Only apply on Android where we disabled KeyboardAvoidingView
    if (Platform.OS !== "android") return {};
    return {
      // Use transform for hardware-accelerated, lag-free movement
      transform: [{ translateY: -keyboardHeight.value }],
    };
  });

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes from the left edge
        // Don't interfere with FlatList scrolling
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
    }),
  ).current;

  // Get or create conversation
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        if (conversationId) {
          setCurrentConversationId(conversationId);
          await loadMessages(conversationId);
        } else if (recipientId) {
          // Need to find or create conversation
          const conversationsRes = await getConversations();
          const existingConv = conversationsRes.conversations?.find(
            (conv) => conv.otherParticipant.id === recipientId,
          );

          if (existingConv) {
            setCurrentConversationId(existingConv.id);
            await loadMessages(existingConv.id);
          } else {
            // Will create conversation when first message is sent
            setCurrentConversationId(null);
          }

          // Load recipient profile based on type
          let recipientProfile;
          const actualRecipientType = recipientType || "member";
          setCurrentRecipientId(recipientId);
          setCurrentRecipientType(actualRecipientType);
          if (actualRecipientType === "community") {
            recipientProfile = await getPublicCommunity(recipientId);
            setRecipient({
              id: recipientProfile.id,
              name: recipientProfile.name,
              username: recipientProfile.username,
              profilePhotoUrl: recipientProfile.logo_url,
            });
          } else {
            // Default to member
            recipientProfile = await getPublicMemberProfile(recipientId);
            setRecipient({
              id: recipientProfile.id,
              name: recipientProfile.full_name || recipientProfile.name,
              username: recipientProfile.username,
              profilePhotoUrl: recipientProfile.profile_photo_url,
            });
          }
        }
      } catch (error) {
        console.error("Error initializing conversation:", error);
        Alert.alert(
          "Error",
          error?.message || "Failed to load conversation. Please try again.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      } finally {
        setLoading(false);
      }
    };

    initializeConversation();
  }, [conversationId, recipientId, recipientType]);

  // Load recipient info if we have conversationId
  useEffect(() => {
    const loadRecipientFromConversation = async () => {
      if (conversationId && !recipient) {
        try {
          const conversationsRes = await getConversations();
          const conv = conversationsRes.conversations?.find(
            (c) => c.id === conversationId,
          );
          if (conv && conv.otherParticipant) {
            setRecipient(conv.otherParticipant);
            // Store recipient ID and type from conversation
            if (conv.otherParticipant.id) {
              setCurrentRecipientId(conv.otherParticipant.id);
            }
            if (conv.otherParticipant.type) {
              setCurrentRecipientType(conv.otherParticipant.type);
            }
          }
        } catch (error) {
          console.error("Error loading recipient:", error);
        }
      }
    };

    loadRecipientFromConversation();
  }, [conversationId, recipient]);

  const loadMessages = async (convId) => {
    try {
      const response = await getMessages(convId);
      setMessages(response.messages || []);

      // Emit event to refresh unread count (messages are marked as read in getMessages)
      EventBus.emit("messages-read");

      // Scroll to latest message (offset 0 for inverted list)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 100);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Initialize Supabase client (optional - for realtime updates)
  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      // No Supabase config, skip realtime
      return;
    }

    (async () => {
      try {
        const mod = await import("@supabase/supabase-js");
        if (mod && mod.createClient) {
          supabaseRef.current = mod.createClient(url, key);
        }
      } catch (err) {
        // Supabase module not installed or failed to load - continue without realtime
        console.log("Supabase not available, realtime updates disabled");
      }
    })();
  }, []);

  // Set up realtime subscription or polling fallback
  useEffect(() => {
    if (!currentConversationId) return;

    // Try to use Supabase realtime if available
    if (supabaseRef.current) {
      // Subscribe to messages table changes
      const channel = supabaseRef.current
        .channel(`messages:${currentConversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${currentConversationId}`,
          },
          (payload) => {
            // Add new message to state
            const newMessage = payload.new;
            setMessages((prev) => {
              // Check if message already exists
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              return [
                ...prev,
                {
                  id: newMessage.id,
                  senderId: newMessage.sender_id,
                  senderType: newMessage.sender_type,
                  messageText: newMessage.message_text,
                  isRead: newMessage.is_read,
                  createdAt: newMessage.created_at,
                },
              ];
            });

            // Scroll to latest message
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({
                offset: 0,
                animated: true,
              });
            }, 100);
          },
        )
        .subscribe();

      subscriptionRef.current = channel;

      return () => {
        if (subscriptionRef.current && supabaseRef.current) {
          supabaseRef.current.removeChannel(subscriptionRef.current);
        }
      };
    } else {
      // Fallback: Poll for new messages every 3 seconds
      const pollForMessages = async () => {
        try {
          const response = await getMessages(currentConversationId, {
            page: 1,
            limit: 50,
          });
          const newMessages = response.messages || [];

          setMessages((prev) => {
            // Only update if we have new messages
            if (newMessages.length > prev.length) {
              return newMessages;
            }
            return prev;
          });
        } catch (error) {
          console.error("Error polling messages:", error);
        }
      };

      // Poll immediately and then every 3 seconds
      pollForMessages();
      pollingIntervalRef.current = setInterval(pollForMessages, 3000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [currentConversationId]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    const text = messageText.trim();
    setMessageText("");
    setSending(true);

    try {
      // Determine recipient ID and type - use stored values with fallbacks
      const finalRecipientId =
        currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType =
        currentRecipientType || recipientType || recipient?.type || "member";

      if (!finalRecipientId) {
        throw new Error("Recipient information is missing. Please try again.");
      }

      let convId = currentConversationId;

      // If no conversation exists, create one by sending message
      const emitUpdate = (messagePayload) => {
        if (!messagePayload) return;
        const otherParticipantPayload = recipient
          ? {
              id: recipient.id,
              name: recipient.name,
              username: recipient.username,
              profilePhotoUrl: recipient.profilePhotoUrl,
              type: currentRecipientType || finalRecipientType,
            }
          : {
              id: finalRecipientId,
              name: recipient?.name || "",
              username: recipient?.username || "",
              profilePhotoUrl: recipient?.profilePhotoUrl || "",
              type: currentRecipientType || finalRecipientType,
            };

        EventBus.emit("conversation-updated", {
          conversationId: convId,
          lastMessage: messagePayload.messageText || text,
          lastMessageAt: messagePayload.createdAt || new Date().toISOString(),
          otherParticipant: otherParticipantPayload,
        });

        // Emit new-message event to trigger unread count refresh on other screens
        EventBus.emit("new-message");
      };

      if (!convId) {
        const response = await sendMessage(
          finalRecipientId,
          text,
          finalRecipientType,
        );
        convId = response.message.conversationId;
        setCurrentConversationId(convId);

        // Add message to state optimistically
        setMessages((prev) => [...prev, response.message]);
        emitUpdate(response.message);
      } else {
        // Send message to existing conversation
        const response = await sendMessage(
          finalRecipientId,
          text,
          finalRecipientType,
        );

        // Add message to state optimistically
        setMessages((prev) => [...prev, response.message]);
        emitUpdate(response.message);
      }

      // Scroll to latest message (offset 0 for inverted list)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessageText(text); // Restore text on error
      Alert.alert(
        "Error",
        error?.message || "Failed to send message. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const renderMessage = ({ item, index }) => {
    const isMyMessage = item.senderId !== (recipient?.id || recipientId);

    // Instagram-style avatar logic: show only for incoming messages on last message of group
    const reversedMessages = [...messages].reverse();
    const reversedIndex = messages.length - 1 - index;
    const nextMessage = reversedMessages[reversedIndex + 1];

    let showAvatar = false;
    if (!isMyMessage) {
      // Show avatar if:
      // 1. This is the last message (visually first since inverted)
      // 2. OR next message (visually above) is from different sender
      // 3. OR time gap with next message is > 60 seconds
      if (!nextMessage) {
        showAvatar = true;
      } else if (nextMessage.senderId !== item.senderId) {
        showAvatar = true;
      } else {
        const currentTime = new Date(item.createdAt);
        const nextTime = new Date(nextMessage.createdAt);
        const timeDiff = Math.abs(currentTime - nextTime);
        showAvatar = timeDiff > 60000; // 60 seconds
      }
    }

    // Handle ticket-type messages with special card
    if (item.messageType === "ticket" && item.metadata) {
      const handleRSVP = async (response) => {
        const giftId = item.metadata.giftId;
        if (!giftId) {
          Alert.alert("Error", "Unable to process RSVP");
          return;
        }

        setRsvpLoading((prev) => ({ ...prev, [item.id]: true }));
        try {
          const result = await confirmGiftRSVP(giftId, response);
          if (result.success) {
            // Update the message locally to reflect new status
            setMessages((prevMessages) =>
              prevMessages.map((msg) => {
                if (msg.id === item.id) {
                  return {
                    ...msg,
                    metadata: {
                      ...msg.metadata,
                      status: result.status,
                    },
                  };
                }
                return msg;
              }),
            );
            Alert.alert(
              response === "going" ? "You're In! 🎉" : "Maybe Next Time",
              result.message,
            );
          }
        } catch (error) {
          console.error("RSVP error:", error);
          Alert.alert("Error", error?.message || "Failed to confirm RSVP");
        } finally {
          setRsvpLoading((prev) => ({ ...prev, [item.id]: false }));
        }
      };

      return (
        <View style={styles.messageContainer}>
          <TicketMessageCard
            metadata={item.metadata}
            isFromMe={isMyMessage}
            senderName={recipient?.name}
            loading={rsvpLoading[item.id]}
            onViewEvent={() => {
              // Navigate using root navigator for proper EventDetails layout
              const rootNav = navigation.getParent()?.getParent() || navigation;
              rootNav.navigate("EventDetails", {
                eventId: item.metadata.eventId,
              });
            }}
            onConfirmGoing={() => handleRSVP("going")}
            onDecline={() => handleRSVP("not_going")}
          />
          {/* Sender profile icon below ticket card */}
          {!isMyMessage && (
            <Image
              source={{
                uri:
                  recipient?.profilePhotoUrl ||
                  "https://via.placeholder.com/30",
              }}
              style={styles.messageAvatar}
            />
          )}
        </View>
      );
    }

    // Handle post-share messages with Instagram-style preview card
    if (item.messageType === "post_share" && item.metadata) {
      return (
        <View style={styles.messageContainer}>
          <SharedPostCard
            metadata={item.metadata}
            onPress={(postId, postData) => {
              // Store post data for state updates
              setSharedPosts((prev) => ({ ...prev, [postId]: postData }));
              // Open fullscreen post view modal
              setSelectedSharedPost(postData);
              setSharedPostModalVisible(true);
            }}
          />
          {/* Sender profile icon below shared post card */}
          {!isMyMessage && (
            <Image
              source={{
                uri:
                  recipient?.profilePhotoUrl ||
                  "https://via.placeholder.com/30",
              }}
              style={styles.messageAvatar}
            />
          )}
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage
            ? styles.myMessageContainer
            : styles.otherMessageContainer,
        ]}
      >
        {!isMyMessage &&
          (showAvatar ? (
            <Image
              source={{
                uri:
                  recipient?.profilePhotoUrl ||
                  "https://via.placeholder.com/30",
              }}
              style={styles.messageAvatar}
            />
          ) : (
            // Placeholder to maintain alignment for messages in the same block
            <View style={{ width: 30, marginRight: 8 }} />
          ))}

        {isMyMessage ? (
          <View style={[styles.messageBubble, styles.myMessageBubble]}>
            <Text style={[styles.messageText, styles.myMessageText]}>
              {item.messageText}
            </Text>
            <Text style={[styles.messageTime, styles.myMessageTime]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        ) : (
          <View style={[styles.messageBubble, styles.otherMessageBubble]}>
            <Text style={[styles.messageText, styles.otherMessageText]}>
              {item.messageText}
            </Text>
            <Text style={[styles.messageTime, styles.otherMessageTime]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Solid Header Area (including Status Bar) */}
      <View style={{ backgroundColor: "#FFFFFF", zIndex: 10 }}>
        <View style={{ height: insets.top }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </TouchableOpacity>
          {recipient && (
            <>
              <Image
                source={{
                  uri:
                    recipient.profilePhotoUrl ||
                    "https://via.placeholder.com/32",
                }}
                style={styles.headerAvatar}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {recipient.name || "User"}
                </Text>
                <Text style={styles.headerUsername} numberOfLines={1}>
                  @{recipient.username || "user"}
                </Text>
              </View>
            </>
          )}
          <View style={{ width: 40 }} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Animated.View style={[{ flex: 1 }, androidContainerStyle]}>
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            inverted
            onLayout={() => {
              // Scroll to end after layout (for inverted list, end is visually at bottom)
              setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                  offset: 0,
                  animated: false,
                });
              }, 100);
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the conversation!</Text>
              </View>
            }
          />
        </Animated.View>
      </KeyboardAvoidingView>

      <KeyboardAwareToolbar>
        <View style={styles.inputContent}>
          <View style={[styles.inputWrapper, { overflow: "hidden" }]}>
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#8FA1B8"
              selectionColor="#8FA1B8"
              cursorColor="#8FA1B8"
              underlineColorAndroid="transparent"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!messageText.trim() || sending) && styles.sendButtonDisabled,
              pressed &&
                !(!messageText.trim() || sending) && {
                  backgroundColor: SEND_BUTTON_PRESSED,
                },
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={20} color="#FFFFFF" strokeWidth={2.6} />
            )}
          </Pressable>
        </View>
      </KeyboardAwareToolbar>

      {/* Fullscreen Post Modal for Shared Posts */}
      {sharedPostModalVisible && selectedSharedPost && (
        <ProfilePostFeed
          visible={sharedPostModalVisible}
          posts={[selectedSharedPost]}
          initialPostId={selectedSharedPost.id}
          onClose={() => {
            setSharedPostModalVisible(false);
            setSelectedSharedPost(null);
          }}
          currentUserId={selectedSharedPost.author_id}
          currentUserType={selectedSharedPost.author_type}
          onLikeUpdate={(postId, isLiked) => {
            // Update the selected post's like state
            setSelectedSharedPost((prev) => ({
              ...prev,
              is_liked: isLiked,
              isLiked: isLiked,
              like_count: Math.max(
                0,
                (prev.like_count || 0) + (isLiked ? 1 : -1),
              ),
            }));
          }}
          onComment={(postId, newCount) => {
            // Update the selected post's comment count
            setSelectedSharedPost((prev) => ({
              ...prev,
              comment_count: newCount,
            }));
          }}
          navigation={navigation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CHAT_CANVAS_BG,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)", // Very subtle border
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 16,
    color: "#1F3A5F",
  },
  headerUsername: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 130, // Visual bottom - large padding to clear absolute Toolbar + gap
    paddingBottom: 30, // Visual top - standard spacing from header
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-end",
  },
  myMessageContainer: {
    justifyContent: "flex-end",
  },
  otherMessageContainer: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: OUTGOING_MESSAGE_BG, // Soft blue tint
  },
  otherMessageBubble: {
    backgroundColor: INCOMING_MESSAGE_BG,
    borderWidth: 1,
    borderColor: INCOMING_MESSAGE_BORDER,
    // Very soft shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    lineHeight: 22.5, // 1.5x for readability
    marginBottom: 4,
  },
  myMessageText: {
    color: MESSAGE_TEXT_COLOR,
  },
  otherMessageText: {
    color: MESSAGE_TEXT_COLOR,
  },
  messageTime: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    alignSelf: "flex-end",
    opacity: 0.65, // 65% opacity for subtle timestamp
  },
  myMessageTime: {
    color: MESSAGE_TEXT_COLOR,
  },
  otherMessageTime: {
    color: MESSAGE_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  inputContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "#D9E2F2",
    minHeight: 44,
    paddingHorizontal: 12, // Move padding here to isolate the input
    paddingVertical: 4,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    minHeight: 44, // Ensure it fills the wrapper
    fontFamily: "Manrope-Regular",
    fontSize: 14.5,
    color: "#1F3A5F",
    backgroundColor: "#f9f9f5", // Temporary tint for debugging
    textAlignVertical: "center",
    borderWidth: 0,
    borderBottomWidth: 0, // Extra protection for Android
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    alignItems: "center",
    justifyContent: "center",
    // Floating shadow for button
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: LIGHT_TEXT_COLOR,
    shadowOpacity: 0,
    elevation: 0,
  },
});
