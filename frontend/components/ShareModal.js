import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { X, Search, Check, Send, Lock, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { searchShareRecipients, sharePost, shareOpportunity, shareEvent } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import SnooLoader from "./ui/SnooLoader";
import SwipeableModal from "./modals/SwipeableModal";
import { SHADOWS } from "../constants/theme";
import { useToast } from "../context/ToastContext";

const DEBOUNCE_MS = 350;

export default function ShareModal({ visible, onClose, post }) {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const debounceTimer = useRef(null);
  const lastQuery = useRef(null);

  // ─── Load / search recipients ────────────────────────────────────────────────
  const fetchRecipients = useCallback(async (q) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await searchShareRecipients(q, token);
      setUsers(response.users || []);
    } catch (error) {
      console.error("Failed to load share recipients:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedUsers([]);
      setSearchQuery("");
      lastQuery.current = null;
      fetchRecipients("");
    }
  }, [visible]);

  // Debounce search query changes
  useEffect(() => {
    if (!visible) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      if (searchQuery !== lastQuery.current) {
        lastQuery.current = searchQuery;
        fetchRecipients(searchQuery);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery, visible]);

  // ─── Selection ───────────────────────────────────────────────────────────────
  const toggleUserSelection = (user) => {
    const isSelected = selectedUsers.some(
      (u) => u.id === user.id && u.type === user.type,
    );
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(
        (u) => !(u.id === user.id && u.type === user.type),
      ));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // ─── Send ────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (selectedUsers.length === 0) return;
    try {
      setSending(true);
      const token = await getAuthToken();
      const recipients = selectedUsers.map((u) => ({
        id: u.id,
        type: u.type,
        // For group chats, pass the conversationId so the backend routes correctly
        ...(u.type === "group" ? { conversationId: u.conversationId } : {}),
      }));

      // Route to the correct share endpoint based on content type
      const isOpportunity =
        post?.post_type === "opportunity" ||
        post?.itemType === "opportunity" ||
        !!post?.opportunity_types;

      const isEvent =
        post?.itemType === "event" ||
        post?.post_type === "event";

      if (isOpportunity) {
        await shareOpportunity(post.id, recipients, "internal", null, token);
      } else if (isEvent) {
        await shareEvent(post.id, recipients, "internal", null, token);
      } else {
        await sharePost(post.id, recipients, "internal", null, token);
      }

      EventBus.emit("post-share-updated", {
        postId: post.id,
        increment: selectedUsers.length,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        "Shared successfully",
        `Shared with ${selectedUsers.length} ${selectedUsers.length === 1 ? "person" : "people"}`,
      );
      onClose();
    } catch (error) {
      console.error("Failed to share post:", error);
      const msg = error?.message?.includes("restricted")
        ? "This group only allows admins to share posts."
        : "Failed to share. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSending(false);
    }
  };

  // ─── Render item ─────────────────────────────────────────────────────────────
  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.some(
      (u) => u.id === item.id && u.type === item.type,
    );
    const isRestricted = item.shareRestricted === true;
    const isGroup = item.isGroup === true;
    const displayName = item.full_name || item.name || "Group";

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => {
          if (isRestricted) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleUserSelection(item);
        }}
        activeOpacity={isRestricted ? 1 : 0.7}
      >
        <View style={styles.userAvatarContainer}>
          {/* Group chat: always show Users icon placeholder */}
          {isGroup ? (
            <View
              style={[
                styles.userAvatar,
                styles.groupAvatarPlaceholder,
                isSelected && styles.selectedAvatar,
                isRestricted && styles.restrictedAvatar,
              ]}
            >
              {item.profile_photo_url ? (
                <Image
                  source={{ uri: item.profile_photo_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Users
                  size={24}
                  color={isRestricted ? "#8E8E93" : "#007AFF"}
                  strokeWidth={1.8}
                />
              )}
            </View>
          ) : item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={[
                styles.userAvatar,
                isSelected && styles.selectedAvatar,
                isRestricted && styles.restrictedAvatar,
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                styles.userAvatar,
                styles.userAvatarPlaceholder,
                isSelected && styles.selectedAvatar,
                isRestricted && styles.restrictedAvatar,
              ]}
            >
              <Text style={[styles.userAvatarText, isRestricted && styles.restrictedAvatarText]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Check badge */}
          {isSelected && !isRestricted && (
            <View style={styles.checkmarkOverlay}>
              <Check size={14} color="#FFF" strokeWidth={3} />
            </View>
          )}
          {/* Lock badge */}
          {isRestricted && (
            <View style={styles.lockOverlay}>
              <Lock size={13} color="#FFF" strokeWidth={2.5} />
            </View>
          )}
        </View>

        <Text
          style={[
            styles.userName,
            isSelected && !isRestricted && styles.selectedUserName,
            isRestricted && styles.restrictedUserName,
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleClose = () => onClose();

  const emptyText = searchQuery
    ? "No results found"
    : "No recent conversations";

  return (
    <SwipeableModal
      visible={visible}
      onClose={handleClose}
      sheetStyle={styles.modalContent}
      useBlur={true}
      blurIntensity={20}
      blurTint="dark"
      statusBarTranslucent={true}
      header={
        <View collapsable={false}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color="#1D1D1F" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardStickyView style={styles.keyboardView}>
          {/* Body */}
          <View style={styles.body}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search
                size={18}
                color="#8E8E93"
                strokeWidth={2}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search people, groups…"
                placeholderTextColor="#8E8E93"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="#8E8E93" strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>

            {/* Section label */}
            {!searchQuery && (
              <Text style={styles.sectionLabel}>Recent</Text>
            )}

            {/* Users Grid */}
            <View style={styles.usersListContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <SnooLoader size="large" color="#007AFF" />
                </View>
              ) : (
                <FlatList
                  data={users}
                  renderItem={renderUser}
                  keyExtractor={(item) => `${item.type}_${item.id}`}
                  numColumns={3}
                  contentContainerStyle={styles.usersList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>{emptyText}</Text>
                    </View>
                  }
                />
              )}
            </View>

            {/* Send Button */}
            {selectedUsers.length > 0 && (
              <View style={styles.bottomActions}>
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <SnooLoader color="#FFF" />
                  ) : (
                    <>
                      <Send size={18} color="#FFF" strokeWidth={2.5} />
                      <Text style={styles.sendButtonText}>
                        Send to {selectedUsers.length}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardStickyView>
      </TouchableWithoutFeedback>
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(26, 24, 38, 0.75)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    width: "100%",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    width: "100%",
    ...SHADOWS.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#1A1826",
    letterSpacing: -0.3,
  },
  closeButton: {
    position: "absolute",
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {},
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#1A1826",
    padding: 0,
  },
  sectionLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#8E8E93",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: -8,
  },
  usersListContainer: {
    maxHeight: 380,
  },
  usersList: {
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: 60,
    alignItems: "center",
  },
  userItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 24,
  },
  userAvatarContainer: {
    position: "relative",
    marginBottom: 10,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
  },
  selectedAvatar: {
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  userAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E6F0FF",
  },
  groupAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFF4FF",
  },
  userAvatarText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#007AFF",
  },
  checkmarkOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#007AFF",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#1A1826",
    textAlign: "center",
    paddingHorizontal: 8,
    opacity: 0.8,
  },
  selectedUserName: {
    fontFamily: "Manrope-SemiBold",
    color: "#007AFF",
    opacity: 1,
  },
  // Restricted styles
  restrictedAvatar: {
    opacity: 0.35,
  },
  restrictedAvatarText: {
    color: "#8E8E93",
  },
  restrictedUserName: {
    opacity: 0.4,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
  },
  lockOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#8E8E93",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    padding: 60,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#8E8E93",
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonText: {
    color: "#FFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
});
