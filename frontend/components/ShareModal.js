import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { X, Search, Check, Send, Lock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getRecentChatUsers, sharePost } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import SnooLoader from "./ui/SnooLoader";
import { SHADOWS } from "../constants/theme";
import { useToast } from "../context/ToastContext";

export default function ShareModal({ visible, onClose, post }) {
  const { showToast } = useToast();
  // --- State & Functionality ---
  const [searchQuery, setSearchQuery] = useState("");
  const [recentUsers, setRecentUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRecentUsers();
      setSelectedUsers([]);
      setSearchQuery("");
    }
  }, [visible]);

  const loadRecentUsers = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await getRecentChatUsers(token);
      setRecentUsers(response.users || []);
    } catch (error) {
      console.error("Failed to load recent users:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (user) => {
    const isSelected = selectedUsers.some(
      (u) => u.id === user.id && u.type === user.type,
    );
    if (isSelected) {
      setSelectedUsers(
        selectedUsers.filter(
          (u) => !(u.id === user.id && u.type === user.type),
        ),
      );
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0) return;
    try {
      setSending(true);
      const token = await getAuthToken();
      const recipients = selectedUsers.map((u) => ({ id: u.id, type: u.type }));
      await sharePost(post.id, recipients, "internal", null, token);
      EventBus.emit("post-share-updated", {
        postId: post.id,
        increment: selectedUsers.length,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        "Shared successfully",
        `Shared with ${selectedUsers.length} ${selectedUsers.length === 1 ? "person" : "people"}`
      );
      onClose();
    } catch (error) {
      console.error("Failed to share post:", error);
      Alert.alert("Error", "Failed to share post");
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = recentUsers.filter(
    (user) =>
      (user.full_name || user.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (user.username || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderUser = ({ item }) => {
    const isSelected = selectedUsers.some(
      (u) => u.id === item.id && u.type === item.type,
    );
    const isRestricted = item.shareRestricted === true;
    const displayName = item.full_name || item.name || "User";

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => {
          if (isRestricted) return; // Blocked — do nothing
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleUserSelection(item);
        }}
        activeOpacity={isRestricted ? 1 : 0.7}
      >
        <View style={styles.userAvatarContainer}>
          {item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={[
                styles.userAvatar,
                isSelected && styles.selectedAvatar,
                isRestricted && styles.restrictedAvatar,
              ]}
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
          {isSelected && !isRestricted && (
            <View style={styles.checkmarkOverlay}>
              <Check size={14} color="#FFF" strokeWidth={3} />
            </View>
          )}
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

  const handleClose = () => {
    onClose();
  };

  // --- Render (Mirrored exactly from EmailChangeModal) ---
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
      navigationBarTranslucent={Platform.OS === 'android'}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardStickyView style={styles.keyboardView}>
              <View style={styles.modalContent}>
                
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

                {/* Body Content */}
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
                      placeholder="Search"
                      placeholderTextColor="#8E8E93"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  {/* Users Grid */}
                  <View style={styles.usersListContainer}>
                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <SnooLoader size="large" color="#007AFF" />
                      </View>
                    ) : (
                      <FlatList
                        data={filteredUsers}
                        renderItem={renderUser}
                        keyExtractor={(item) => `${item.type}_${item.id}`}
                        numColumns={3}
                        contentContainerStyle={styles.usersList}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                          <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                              {searchQuery ? "No users found" : "No recent chats"}
                            </Text>
                          </View>
                        }
                      />
                    )}
                  </View>

                  {/* Bottom Actions */}
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
              </View>
            </KeyboardStickyView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(26, 24, 38, 0.75)",
    justifyContent: "flex-end", // Bottom sheet style
  },
  keyboardView: {
    width: "100%",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24, // Safe area padding
    width: "100%",
    ...SHADOWS.medium,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // Share modal centers title
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
  body: {
    // We let the FlatList expand but need to contain it within modalContent
  },
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
  usersListContainer: {
    maxHeight: 400, // Limit height so it scrolls if too many users
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
