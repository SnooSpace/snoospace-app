import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "../api/client";
import { getAuthToken } from "../api/auth";
import { getGradientForName, getInitials } from "../utils/AvatarGenerator";
import SnooLoader from "./ui/SnooLoader";

const PRIMARY_COLOR = "#007AFF";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";
const SUCCESS_COLOR = "#22C55E";
const WARNING_COLOR = "#F59E0B";
const DANGER_COLOR = "#EF4444";

/**
 * GiftTreeView - Displays the gift sharing chain for tickets
 * Shows who gifted tickets and who they re-shared them with
 *
 * @param {Object} props
 * @param {string|number} props.eventId - Event ID
 * @param {string|number} props.giftId - Root gift ID (optional - shows all gifts if not provided)
 */
const GiftTreeView = ({ eventId, giftId = null, onUserPress }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [giftTree, setGiftTree] = useState([]);

  useEffect(() => {
    loadGiftTree();
  }, [eventId, giftId]);

  const loadGiftTree = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      const endpoint = giftId
        ? `/events/${eventId}/gifts/${giftId}/tree`
        : `/events/${eventId}/gifts`;
      const response = await apiGet(endpoint, 15000, token);

      if (response?.gifts) {
        // Build tree structure from flat list
        const tree = buildTree(response.gifts);
        setGiftTree(tree);
      } else if (response?.gift) {
        setGiftTree([response.gift]);
      }
    } catch (err) {
      console.error("Error loading gift tree:", err);
      setError(err?.message || "Failed to load gift data");
    } finally {
      setLoading(false);
    }
  };

  // Build tree structure from flat gift list
  const buildTree = (gifts) => {
    const giftMap = new Map();
    const roots = [];

    // First pass: create map
    gifts.forEach((gift) => {
      giftMap.set(gift.id, { ...gift, children: [] });
    });

    // Second pass: build tree
    gifts.forEach((gift) => {
      const node = giftMap.get(gift.id);
      if (gift.parent_gift_id && giftMap.has(gift.parent_gift_id)) {
        giftMap.get(gift.parent_gift_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return SUCCESS_COLOR;
      case "used":
        return LIGHT_TEXT_COLOR;
      case "revoked":
        return DANGER_COLOR;
      case "expired":
        return WARNING_COLOR;
      default:
        return LIGHT_TEXT_COLOR;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return "checkmark-circle";
      case "used":
        return "checkbox";
      case "revoked":
        return "close-circle";
      case "expired":
        return "time";
      default:
        return "help-circle";
    }
  };

  const renderGiftNode = (gift, depth = 0) => {
    const statusColor = getStatusColor(gift.status);
    const hasChildren = gift.children?.length > 0;

    return (
      <View key={gift.id} style={styles.nodeContainer}>
        {/* Connection lines */}
        {depth > 0 && (
          <View style={styles.connectionLineContainer}>
            <View style={[styles.verticalLine, { height: 20 }]} />
            <View style={styles.horizontalLine} />
          </View>
        )}

        {/* Gift card */}
        <View style={[styles.giftCard, { marginLeft: depth * 24 }]}>
          {/* Header with status */}
          <View style={styles.cardHeader}>
            <View style={styles.recipientInfo}>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() =>
                  onUserPress?.(gift.recipient_id, gift.recipient_type)
                }
              >
                {gift.recipient_photo ? (
                  <Image
                    source={{ uri: gift.recipient_photo }}
                    style={styles.avatar}
                  />
                ) : (
                  <LinearGradient
                    colors={getGradientForName(gift.recipient_name || "G")}
                    style={styles.avatar}
                  >
                    <Text style={styles.avatarText}>
                      {getInitials(gift.recipient_name || "G")}
                    </Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              <View style={styles.nameContainer}>
                <Text style={styles.recipientName} numberOfLines={1}>
                  {gift.recipient_name || "Unknown"}
                </Text>
                <Text style={styles.recipientUsername}>
                  @{gift.recipient_username || "user"}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor + "20" },
              ]}
            >
              <Ionicons
                name={getStatusIcon(gift.status)}
                size={12}
                color={statusColor}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {gift.status?.charAt(0).toUpperCase() + gift.status?.slice(1)}
              </Text>
            </View>
          </View>

          {/* Gift details */}
          <View style={styles.giftDetails}>
            <View style={styles.detailRow}>
              <Ionicons
                name="ticket-outline"
                size={14}
                color={LIGHT_TEXT_COLOR}
              />
              <Text style={styles.detailText}>
                {gift.quantity || gift.original_quantity} ticket
                {(gift.quantity || gift.original_quantity) > 1 ? "s" : ""}
              </Text>
            </View>
            {gift.ticket_type_name && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="pricetag-outline"
                  size={14}
                  color={LIGHT_TEXT_COLOR}
                />
                <Text style={styles.detailText}>{gift.ticket_type_name}</Text>
              </View>
            )}
            {gift.can_reshare && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="share-outline"
                  size={14}
                  color={PRIMARY_COLOR}
                />
                <Text style={[styles.detailText, { color: PRIMARY_COLOR }]}>
                  Can reshare ({gift.remaining_quantity || 0} left)
                </Text>
              </View>
            )}
          </View>

          {/* Message */}
          {gift.message && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>"{gift.message}"</Text>
            </View>
          )}

          {/* Revoked info */}
          {gift.status === "revoked" && gift.revoked_reason && (
            <View style={styles.revokedBanner}>
              <Ionicons name="warning" size={14} color={DANGER_COLOR} />
              <Text style={styles.revokedText}>{gift.revoked_reason}</Text>
            </View>
          )}

          {/* Gifted date */}
          <Text style={styles.dateText}>
            {gift.created_at
              ? `Sent ${new Date(gift.created_at).toLocaleDateString()}`
              : ""}
          </Text>
        </View>

        {/* Render children */}
        {hasChildren && (
          <View style={styles.childrenContainer}>
            {gift.children.map((child) => renderGiftNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <SnooLoader size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading gift history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={LIGHT_TEXT_COLOR}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadGiftTree}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (giftTree.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="gift-outline" size={48} color={LIGHT_TEXT_COLOR} />
        <Text style={styles.emptyText}>No gifts sent yet</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Ionicons name="git-branch-outline" size={20} color={PRIMARY_COLOR} />
        <Text style={styles.headerTitle}>Gift Sharing Tree</Text>
      </View>
      {giftTree.map((gift) => renderGiftNode(gift, 0))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  nodeContainer: {
    marginBottom: 12,
  },
  connectionLineContainer: {
    position: "absolute",
    left: 16,
    top: -20,
  },
  verticalLine: {
    width: 2,
    backgroundColor: "#E5E7EB",
  },
  horizontalLine: {
    height: 2,
    width: 20,
    backgroundColor: "#E5E7EB",
  },
  giftCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  recipientInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  nameContainer: {
    flex: 1,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  recipientUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  giftDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  messageContainer: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    color: TEXT_COLOR,
    fontStyle: "italic",
  },
  revokedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  revokedText: {
    fontSize: 12,
    color: DANGER_COLOR,
    flex: 1,
  },
  dateText: {
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
  },
  childrenContainer: {
    marginTop: 8,
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E7EB",
    paddingLeft: 8,
  },
});

export default GiftTreeView;
