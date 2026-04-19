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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Search, Check, Send, Link } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as NavigationBar from "expo-navigation-bar"; // ← ADD THIS
import * as Clipboard from "expo-clipboard";
import { getRecentChatUsers, sharePost } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import SnooLoader from "./ui/SnooLoader";

const ShareModal = ({ visible, onClose, post }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [recentUsers, setRecentUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // ─── Fix: control Android nav bar colour to match the modal sheet ───
  const wasVisible = React.useRef(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (visible) {
      wasVisible.current = true;
      NavigationBar.setBackgroundColorAsync("#FFFFFF").catch(() => {});
      NavigationBar.setButtonStyleAsync("dark").catch(() => {});
    } else if (wasVisible.current) {
      // Restore whatever your app's default nav bar colour is
      NavigationBar.setBackgroundColorAsync("transparent").catch(() => {});
      NavigationBar.setButtonStyleAsync("light").catch(() => {});
    }
  }, [visible]);
  // ────────────────────────────────────────────────────────────────────

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
      Alert.alert(
        "Success",
        `Shared with ${selectedUsers.length} ${selectedUsers.length === 1 ? "person" : "people"}`,
      );
      onClose();
    } catch (error) {
      console.error("Failed to share post:", error);
      Alert.alert("Error", "Failed to share post");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const token = await getAuthToken();
      const link = `https://snoospace.app/post/${post.id}`;
      await Clipboard.setStringAsync(link);
      await sharePost(post.id, [], "copy_link", null, token);
      EventBus.emit("post-share-updated", { postId: post.id, increment: 1 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Link Copied", "Post link copied to clipboard");
      onClose();
    } catch (error) {
      console.error("Failed to copy link:", error);
      Alert.alert("Error", error.message || "Failed to copy link");
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
    const displayName = item.full_name || item.name || "User";

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleUserSelection(item);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatarContainer}>
          {item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={[styles.userAvatar, isSelected && styles.selectedAvatar]}
            />
          ) : (
            <View
              style={[
                styles.userAvatar,
                styles.userAvatarPlaceholder,
                isSelected && styles.selectedAvatar,
              ]}
            >
              <Text style={styles.userAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkmarkOverlay}>
              <Check size={14} color="#FFF" strokeWidth={3} />
            </View>
          )}
        </View>
        <Text
          style={[styles.userName, isSelected && styles.selectedUserName]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  const getPostImage = () => {
    if (!post?.image_urls) return null;
    const urls = Array.isArray(post.image_urls) ? post.image_urls.flat() : [];
    return urls.find(
      (url) => typeof url === "string" && url.startsWith("http"),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardStickyView
            style={{ width: "100%" }}
            offset={{ opened: Platform.OS === "android" ? insets.bottom : 0 }}
          >
            <View
              style={[
                styles.container,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Share</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color="#1D1D1F" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

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
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        {searchQuery ? "No users found" : "No recent chats"}
                      </Text>
                    </View>
                  }
                />
              )}

              {/* Bottom Actions */}
              <View style={styles.bottomActions}>
                {selectedUsers.length > 0 && (
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
                )}
                <TouchableOpacity
                  style={styles.copyLinkButton}
                  onPress={handleCopyLink}
                >
                  <Link size={14} color="#1A1826" strokeWidth={2.5} />
                  <Text style={styles.copyLinkText}>Copy Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardStickyView>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(26, 24, 38, 0.75)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 18,
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
  loadingContainer: {
    padding: 60,
    alignItems: "center",
  },
  usersList: {
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 20,
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
    paddingTop: 16,
    gap: 12,
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
  copyLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    alignSelf: "center",
    marginTop: 8,
    gap: 6,
  },
  copyLinkText: {
    color: "#1A1826",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
  },
});

export default ShareModal;
