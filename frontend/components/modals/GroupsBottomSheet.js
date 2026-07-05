import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Users, Lock, ChevronRight, X, MessageSquare } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import SwipeableModal from "./SwipeableModal";
import { getGroupsByOwner, selfJoinGroup } from "../../api/messages";
import { COLORS, FONTS } from "../../constants/theme";
import SnooLoader from "../ui/SnooLoader";

export default function GroupsBottomSheet({
  visible,
  onClose,
  ownerId,
  ownerType,
  ownerName,
  navigation,
}) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState(null);

  // Load groups when sheet becomes visible
  useEffect(() => {
    if (visible && ownerId) {
      loadGroups();
    }
  }, [visible, ownerId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await getGroupsByOwner(ownerId, ownerType);
      if (res?.success) {
        setGroups(res.groups || []);
      }
    } catch (err) {
      console.error("GroupsBottomSheet error loading groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (group) => {
    if (joiningGroupId) return;
    setJoiningGroupId(group.id);
    try {
      const res = await selfJoinGroup(group.id);
      if (res?.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
        
        // Update local list state
        setGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...g, isMember: true } : g))
        );

        onClose();

        // Navigate to the chat screen
        navigation.navigate("Chat", {
          conversationId: group.id,
          isGroup: true,
          groupName: group.groupName,
        });
      }
    } catch (err) {
      console.error("GroupsBottomSheet join error:", err);
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleNavigateToChat = (group) => {
    onClose();
    navigation.navigate("Chat", {
      conversationId: group.id,
      isGroup: true,
      groupName: group.groupName,
    });
  };

  const renderGroupItem = ({ item }) => {
    const isPrivate = !item.communityAutoJoin || item.adminOnlyInvite;
    const isJoining = joiningGroupId === item.id;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        activeOpacity={item.isMember ? 0.7 : 0.95}
        onPress={() => item.isMember && handleNavigateToChat(item)}
      >
        <View style={styles.groupInfo}>
          {/* Avatar Container with rounded container and soft tinted background */}
          <View style={styles.avatarContainer}>
            {item.groupAvatarUrl ? (
              <Image source={{ uri: item.groupAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Users size={20} color="#3565F2" strokeWidth={2} />
              </View>
            )}
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.groupName}
            </Text>
            {isPrivate && !item.isMember && (
              <View style={styles.statusRow}>
                <Lock size={12} color="#64748B" strokeWidth={2} />
                <Text style={styles.statusText}>Invite Only</Text>
              </View>
            )}
            {item.isMember && (
              <View style={styles.statusRow}>
                <MessageSquare size={12} color="#3565F2" strokeWidth={2} />
                <Text style={[styles.statusText, { color: "#3565F2" }]}>Member</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action button */}
        <View style={styles.actionColumn}>
          {item.isMember ? (
            <TouchableOpacity
              style={styles.actionButtonJoined}
              onPress={() => handleNavigateToChat(item)}
            >
              <Text style={styles.actionTextJoined}>Open</Text>
              <ChevronRight size={14} color="#475569" strokeWidth={2} />
            </TouchableOpacity>
          ) : isPrivate ? (
            <View style={styles.actionButtonDisabled}>
              <Text style={styles.actionTextDisabled}>Private</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionButtonJoin}
              onPress={() => handleJoin(item)}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionTextJoin}>Join</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer} collapsable={false}>
      {/* Header indicator bar */}
      <View style={styles.indicator} />

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
        <X size={18} color="#64748B" strokeWidth={2.2} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Group Chats</Text>
        <Text style={styles.subtitle}>
          Active chat rooms by {ownerName || "this account"}
        </Text>
      </View>
    </View>
  );

  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      header={renderHeader()}
      sheetStyle={styles.sheet}
      useBlur={true}
      blurTint="dark"
    >
      {loading ? (
        <View style={styles.loaderContainer}>
          <SnooLoader size="large" color="#3565F2" />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={32} color="#64748B" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No chat groups available</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  indicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginTop: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#64748B",
  },
  list: {
    maxHeight: 400,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  loaderContainer: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    height: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#64748B",
  },
  groupCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  groupInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: "rgba(53, 101, 242, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  groupName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#64748B",
  },
  actionColumn: {
    alignItems: "flex-end",
  },
  actionButtonJoin: {
    backgroundColor: "#3565F2",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 16,
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextJoin: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  actionButtonJoined: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    paddingVertical: 6,
    paddingLeft: 14,
    paddingRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextJoined: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#475569",
    marginRight: 2,
  },
  actionButtonDisabled: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextDisabled: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#64748B",
  },
});
