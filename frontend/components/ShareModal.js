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
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { getRecentChatUsers, sharePost } from "../api/client";
import { getAuthToken } from "../api/auth";

const ShareModal = ({ visible, onClose, post }) => {
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
      Alert.alert("Link Copied", "Post link copied to clipboard");
      onClose();
    } catch (error) {
      console.error("Failed to copy link:", error);
      console.error("Error details:", error.message, error.data);
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
        onPress={() => toggleUserSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userAvatarContainer}>
          {item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={styles.userAvatar}
            />
          ) : (
            <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
              <Text style={styles.userAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.checkmarkOverlay}>
              <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
            </View>
          )}
        </View>
        <Text style={styles.userName} numberOfLines={1}>
          {displayName}
        </Text>
      </TouchableOpacity>
    );
  };

  // Get first image from post
  const getPostImage = () => {
    if (!post?.image_urls) return null;
    const urls = Array.isArray(post.image_urls) ? post.image_urls.flat() : [];
    return urls.find(
      (url) => typeof url === "string" && url.startsWith("http"),
    );
  };

  const postImage = getPostImage();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Share</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#1D1D1F" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#8E8E93"
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
              <ActivityIndicator size="large" color="#007AFF" />
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
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={20} color="#FFF" />
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
              <Ionicons name="link" size={20} color="#007AFF" />
              <Text style={styles.copyLinkText}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1D1D1F",
  },
  postPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F9F9F9",
    borderRadius: 12,
  },
  postPreviewImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
  },
  postPreviewCaption: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: "#1D1D1F",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  usersList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  userItem: {
    width: "33.33%",
    alignItems: "center",
    marginBottom: 20,
  },
  userAvatarContainer: {
    position: "relative",
    marginBottom: 8,
  },
  userAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#E5E5EA",
  },
  userAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#007AFF",
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FFF",
  },
  checkmarkOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderRadius: 12,
  },
  userName: {
    fontSize: 12,
    color: "#1D1D1F",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
  },
  bottomActions: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  copyLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
    gap: 8,
  },
  copyLinkText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ShareModal;
