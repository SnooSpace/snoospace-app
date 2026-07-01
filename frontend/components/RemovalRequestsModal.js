/**
 * RemovalRequestsModal
 * Modal for challenge hosts to review & approve/reject submission removal requests
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from "react-native";
import SwipeableModal from "./modals/SwipeableModal";
import {
  X,
  CircleCheck,
  CircleX,
  User,
  MessageCircle,
  TriangleAlert,
  Check,
  Info,
} from "lucide-react-native";
import { apiGet, apiPatch } from "../api/client";
import { getAuthToken } from "../api/auth";
import { COLORS, SPACING, FONTS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";
import CustomAlertModal from "./ui/CustomAlertModal";

const RemovalRequestsModal = ({
  visible,
  onClose,
  postId,
  onRequestReviewed,
  onContactUser, // (submissionLike) => void — opens DM sheet in parent
}) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);

  // Custom Alert Modal State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });

  const showAlert = (title, message, buttons = null, icon = null, iconColor = null) => {
    if (!buttons || buttons.length === 0) {
      const isSuccess = title.toLowerCase().includes("success") || title.toLowerCase().includes("sent");
      const isError = title.toLowerCase().includes("error") || title.toLowerCase().includes("fail");
      setAlertConfig({
        title,
        message,
        primaryAction: {
          text: "OK",
          onPress: () => setAlertVisible(false),
        },
        secondaryAction: null,
        icon: icon || (isSuccess ? CircleCheck : isError ? CircleX : Info),
        iconColor: iconColor || (isSuccess ? "#34C759" : isError ? "#FF3B30" : COLORS.primary),
      });
      setAlertVisible(true);
      return;
    }

    const cancelBtn = buttons.find((b) => b.style === "cancel" || b.text.toLowerCase() === "cancel");
    const actionBtn = buttons.find((b) => b.style !== "cancel" && b.text.toLowerCase() !== "cancel");

    setAlertConfig({
      title,
      message,
      primaryAction: actionBtn
        ? {
            text: actionBtn.text,
            style: actionBtn.style,
            onPress: () => {
              setAlertVisible(false);
              actionBtn.onPress?.();
            },
          }
        : null,
      secondaryAction: cancelBtn
        ? {
            text: cancelBtn.text,
            onPress: () => {
              setAlertVisible(false);
              cancelBtn.onPress?.();
            },
          }
        : null,
      icon: icon || (actionBtn?.style === "destructive" ? TriangleAlert : Info),
      iconColor: iconColor || (actionBtn?.style === "destructive" ? "#FF3B30" : COLORS.primary),
    });
    setAlertVisible(true);
  };

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

    showAlert(
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
              setRequests((prev) => prev.filter((r) => r.id !== requestId));
              if (onRequestReviewed) {
                onRequestReviewed(requestId, status);
              }
            } catch (error) {
              showAlert(
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
        {/* Requester Info row */}
        <View style={styles.requesterRow}>
          {item.requester_photo ? (
            <Image
              source={{ uri: item.requester_photo }}
              style={styles.requesterAvatar}
            />
          ) : (
            <View style={[styles.requesterAvatar, styles.avatarPlaceholder]}>
              <User size={18} color="#999" />
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

          {/* Contact User — opens DM sheet */}
          {onContactUser && (
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => {
                onClose(); // close modal first so DM sheet can open behind
                onContactUser({
                  participant_id: item.requester_id,
                  participant_type: item.requester_type,
                  participant_name: item.requester_name || "User",
                  participant_photo_url: item.requester_photo || null,
                });
              }}
              activeOpacity={0.7}
            >
              <MessageCircle size={15} color="#2962FF" />
              <Text style={styles.contactButtonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reason */}
        {item.reason && (
          <Text style={styles.reasonText}>"{item.reason}"</Text>
        )}

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
              <SnooLoader size="small" color={COLORS.error} />
            ) : (
              <>
                <X size={18} color={COLORS.error} />
                <Text style={styles.rejectButtonText}>
                  Reject
                </Text>
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
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.approveButtonText}>
                  Approve
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <CircleCheck size={48} color="#34C759" />
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptySubtitle}>No pending removal requests</Text>
    </View>
  );

  return (
    <>
      <SwipeableModal
        visible={visible}
        onClose={onClose}
        sheetStyle={styles.container}
        backdropColor="rgba(0,0,0,0.5)"
        header={
          <View collapsable={false} style={styles.header}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Removal Requests</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Review requests from participants to remove their submissions
            </Text>
          </View>
        }
      >

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
      </SwipeableModal>

      <CustomAlertModal
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={() => setAlertVisible(false)}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
      />
    </>
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
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  requestDate: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#999",
    marginTop: 2,
  },
  // Contact User button
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#C7D9FF",
  },
  contactButtonText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#2962FF",
  },
  reasonText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.semiBold,
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  submissionPreviewText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  submissionType: {
    fontSize: 12,
    fontFamily: FONTS.medium,
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
    backgroundColor: "rgba(229, 62, 62, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(229, 62, 62, 0.2)",
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.error,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
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
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#999",
    marginTop: 4,
  },
});

export default RemovalRequestsModal;
