/**
 * RemovalRequestsModal
 * Modal for challenge hosts to review & approve/reject submission removal requests
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, FlatList, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPatch } from "../api/client";
import { getAuthToken } from "../api/auth";
import { COLORS, SPACING, FONTS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

const RemovalRequestsModal = ({
  visible,
  onClose,
  postId,
  onRequestReviewed,
}) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!postId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const response = await apiGet(
        `/posts/${postId}/removal-requests`,
        15000,
        token,
      );
      if (response.success) {
        setRequests(response.requests || []);
      }
    } catch (error) {
      console.error("Error fetching removal requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible && postId) {
      fetchRequests();
    }
  }, [visible, postId, fetchRequests]);

  const handleReview = async (requestId, status) => {
    const actionLabel = status === "approved" ? "approve" : "reject";

    Alert.alert(
      `${status === "approved" ? "Approve" : "Reject"} Removal?`,
      status === "approved"
        ? "This will permanently delete the submission."
        : "The user will be notified that their request was declined.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status === "approved" ? "Approve" : "Reject",
          style: status === "approved" ? "destructive" : "default",
          onPress: async () => {
            setReviewingId(requestId);
            try {
              const token = await getAuthToken();
              await apiPatch(
                `/submission-removal-requests/${requestId}`,
                { status },
                15000,
                token,
              );
              // Remove from list
              setRequests((prev) => prev.filter((r) => r.id !== requestId));
              if (onRequestReviewed) {
                onRequestReviewed(requestId, status);
              }
            } catch (error) {
              Alert.alert(
                "Error",
                error.message || `Failed to ${actionLabel} request`,
              );
            } finally {
              setReviewingId(null);
            }
          },
        },
      ],
    );
  };

  const renderRequest = ({ item }) => {
    const isReviewing = reviewingId === item.id;

    return (
      <View style={styles.requestCard}>
        {/* Requester Info */}
        <View style={styles.requesterRow}>
          {item.requester_photo ? (
            <Image
              source={{ uri: item.requester_photo }}
              style={styles.requesterAvatar}
            />
          ) : (
            <View style={[styles.requesterAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={18} color="#999" />
            </View>
          )}
          <View style={styles.requesterInfo}>
            <Text style={styles.requesterName}>
              {item.requester_name || "User"}
            </Text>
            <Text style={styles.requestDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Reason */}
        {item.reason && <Text style={styles.reasonText}>"{item.reason}"</Text>}

        {/* Submission Preview */}
        <View style={styles.submissionPreview}>
          <Text style={styles.submissionPreviewLabel}>Submission:</Text>
          {item.submission_content && (
            <Text style={styles.submissionPreviewText} numberOfLines={2}>
              {item.submission_content}
            </Text>
          )}
          {item.submission_type && (
            <Text style={styles.submissionType}>
              Type: {item.submission_type}
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleReview(item.id, "rejected")}
            disabled={isReviewing}
          >
            {isReviewing ? (
              <SnooLoader size="small" color="#FF3B30" />
            ) : (
              <>
                <Ionicons name="close" size={18} color="#FF3B30" />
                <Text style={[styles.rejectButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleReview(item.id, "approved")}
            disabled={isReviewing}
          >
            {isReviewing ? (
              <SnooLoader size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={[styles.approveButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle-outline" size={48} color="#34C759" />
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>No pending removal requests</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Removal Requests</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Review requests from participants to remove their submissions
            </Text>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <SnooLoader size="large" color="#FF9500" />
            </View>
          ) : (
            <FlatList
              data={requests}
              renderItem={renderRequest}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={renderEmpty}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    minHeight: 300,
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E5E5",
    borderRadius: 3,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    textAlign: "center",
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Request card
  requestCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  requesterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  requesterAvatar: {
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
  requesterInfo: {
    flex: 1,
  },
  requesterName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  requestDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  reasonText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  submissionPreview: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  submissionPreviewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  submissionPreviewText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  submissionType: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  // Actions
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: "#FF3B30",
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#34C759",
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
});

export default RemovalRequestsModal;
