import { useState, useCallback } from "react";
import { Trash2, Bell, BellOff, CircleCheck, TriangleAlert, UserX } from "lucide-react-native";

import {
  unsendMessage,
  hideConversation,
  reportConversation,
  muteConversation,
  unmuteConversation,
} from "../../../../api/messages";
import { blockUser, unblockUser } from "../../../../api/plans";
import EventBus from "../../../../utils/EventBus";
import { updateMessageInCache } from "../../../../services/conversationCache";
import { INITIAL_MESSAGES_LIMIT } from "../chatConfig";

export default function useChatModeration({
  currentConversationId,
  currentRecipientId,
  recipientId,
  recipient,
  initialIsMuted = false,
  initialMutedUntil = null,
  youHaveBlocked,
  setYouHaveBlocked,
  navigation,
  updateMessageById,
  loadInitial,
  showAlert,
  hideAlert,
}) {
  const [chatActionsVisible, setChatActionsVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(initialIsMuted);
  const [mutedUntil, setMutedUntil] = useState(initialMutedUntil);
  const [unblocking, setUnblocking] = useState(false);

  const handleUnsend = useCallback(
    async (id) => {
      // Optimistic update: mark deleted in React state immediately
      updateMessageById(id, {
        isDeleted: true,
        deletedByType: "sender",
        messageText: null,
      });

      // Keep the in-memory conversation cache in sync so a cache-hit reopen
      // doesn't repaint the original message text before the reconcile fetch.
      updateMessageInCache(currentConversationId, id, {
        isDeleted: true,
        deletedByType: "sender",
        messageText: null,
      });

      // Notify ConversationsListScreen so its preview row updates immediately
      // without waiting for the next useFocusEffect reload.
      EventBus.emit("conversation-last-message-updated", {
        conversationId: currentConversationId,
        lastMessage: "Message unsent",
      });

      try {
        await unsendMessage(id);
      } catch (err) {
        console.error("Unsend error:", err);
        showAlert({
          title: "Error",
          message: "Could not unsend message.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
        // Rollback React state
        updateMessageById(id, {
          isDeleted: false,
          deletedByType: null,
          messageText: undefined,
        });
        // Rollback cache — revert to original shape without the patch.
        // We can't know the original messageText here, so clearing the cache
        // entry is safer than leaving it with a wrong isDeleted:false + null text.
        // The next loadInitial / reconcile fetch will repopulate it correctly.
        updateMessageInCache(currentConversationId, id, {
          isDeleted: false,
          deletedByType: null,
        });
      }
    },
    [currentConversationId, updateMessageById, showAlert, hideAlert],
  );

  const handleDeleteChat = useCallback(() => {
    setChatActionsVisible(false);
    setTimeout(() => {
      showAlert({
        title: "Delete Chat",
        message:
          "This chat will be removed from your inbox. The other person won't be notified.",
        icon: Trash2,
        iconColor: "#E53935",
        secondaryAction: { text: "Cancel", onPress: hideAlert },
        primaryAction: {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            hideAlert();
            try {
              await hideConversation(currentConversationId);
              EventBus.emit("conversation-deleted", {
                conversationId: currentConversationId,
              });
              navigation.goBack();
            } catch (err) {
              showAlert({
                title: "Error",
                message: err?.message || "Failed to delete chat.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        },
      });
    }, 300);
  }, [currentConversationId, navigation, showAlert, hideAlert]);

  const handleMuteChat = useCallback(() => {
    setChatActionsVisible(false);
    if (isMuted) {
      setTimeout(async () => {
        try {
          await unmuteConversation(currentConversationId);
          setIsMuted(false);
          setMutedUntil(null);
          showAlert({
            title: "Unmuted",
            message: "You'll now receive notifications for this conversation.",
            icon: Bell,
            iconColor: "#34C759",
            primaryAction: { text: "OK", onPress: hideAlert },
          });
        } catch {
          showAlert({
            title: "Error",
            message: "Failed to unmute. Please try again.",
            primaryAction: { text: "OK", onPress: hideAlert },
            icon: TriangleAlert,
          });
        }
      }, 300);
    } else {
      const MUTE_DURATIONS = [
        { label: "For 1 hour", ms: 60 * 60 * 1000 },
        { label: "For 8 hours", ms: 8 * 60 * 60 * 1000 },
        { label: "For 24 hours", ms: 24 * 60 * 60 * 1000 },
        { label: "Until I change it", ms: null },
      ];
      setTimeout(() => {
        showAlert({
          title: "Mute Notifications",
          message: "How long would you like to mute this conversation?",
          icon: BellOff,
          iconColor: "#FF9F0A",
          secondaryAction: { text: "Cancel", onPress: hideAlert },
          durationOptions: MUTE_DURATIONS,
          onDurationSelect: async (dur) => {
            hideAlert();
            const until = dur.ms
              ? new Date(Date.now() + dur.ms).toISOString()
              : null;
            try {
              await muteConversation(currentConversationId, until);
              setIsMuted(true);
              setMutedUntil(until);
            } catch {
              showAlert({
                title: "Error",
                message: "Failed to mute. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        });
      }, 300);
    }
  }, [currentConversationId, isMuted, showAlert, hideAlert]);

  const handleStartReport = useCallback(() => {
    setChatActionsVisible(false);
    setTimeout(() => setReportSheetVisible(true), 300);
  }, []);

  const handleBlockUser = useCallback(() => {
    setChatActionsVisible(false);
    setTimeout(() => {
      const recipientName = recipient?.name || "this user";
      showAlert({
        title: `Block ${recipientName}?`,
        message:
          "They won't be able to message you or find your profile. You can unblock them anytime from Settings → Blocked Users.",
        icon: UserX,
        iconColor: "#E53935",
        secondaryAction: { text: "Cancel", onPress: hideAlert },
        primaryAction: {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            hideAlert();
            try {
              const token = await (
                await import("../../../../api/auth")
              ).getAuthToken();
              await blockUser(
                currentRecipientId || recipientId || recipient?.id,
                token,
              );
              showAlert({
                title: "Blocked",
                message: `${recipientName} has been blocked.`,
                icon: CircleCheck,
                iconColor: "#34C759",
                primaryAction: {
                  text: "OK",
                  onPress: () => {
                    hideAlert();
                    navigation.goBack();
                  },
                },
              });
            } catch (err) {
              showAlert({
                title: "Error",
                message:
                  err?.message || "Failed to block user. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        },
      });
    }, 300);
  }, [recipient, currentRecipientId, recipientId, navigation, showAlert, hideAlert]);

  const handleUnblockUser = useCallback(async () => {
    const finalRecipientId = currentRecipientId || recipientId || recipient?.id;
    if (!finalRecipientId) return;
    try {
      setUnblocking(true);
      const token = await (await import("../../../../api/auth")).getAuthToken();
      await unblockUser(finalRecipientId, token);
      setYouHaveBlocked(false);
      if (currentConversationId) {
        await loadInitial(currentConversationId, INITIAL_MESSAGES_LIMIT);
      }
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to unblock user. Please try again.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: TriangleAlert,
        iconColor: "#E53935",
      });
    } finally {
      setUnblocking(false);
    }
  }, [
    currentRecipientId,
    recipientId,
    recipient?.id,
    currentConversationId,
    loadInitial,
    setYouHaveBlocked,
    showAlert,
    hideAlert,
  ]);

  const handleReportReason = useCallback(
    async (reason) => {
      setReportSheetVisible(false);

      if (!currentConversationId) {
        setTimeout(() => {
          showAlert({
            title: "Cannot Report",
            message:
              "This conversation hasn't started yet. Send a message first.",
            primaryAction: { text: "OK", onPress: hideAlert },
            icon: TriangleAlert,
          });
        }, 300);
        return;
      }

      try {
        await reportConversation(
          currentConversationId,
          reason.key,
          reason.details || reason.label,
        );
        setTimeout(() => {
          showAlert({
            title: "Report Submitted",
            message:
              "Thanks for letting us know. Our team will review this conversation.",
            icon: CircleCheck,
            iconColor: "#34C759",
            primaryAction: { text: "OK", onPress: hideAlert },
          });
        }, 300);
      } catch (err) {
        const alreadyReported =
          err?.message?.toLowerCase().includes("unique") ||
          err?.message?.toLowerCase().includes("already") ||
          err?.status === 409;
        setTimeout(() => {
          showAlert({
            title: alreadyReported ? "Already Reported" : "Error",
            message: alreadyReported
              ? "You've already reported this conversation. Our team is reviewing it."
              : err?.message || "Failed to submit report. Please try again.",
            primaryAction: { text: "OK", onPress: hideAlert },
            icon: alreadyReported ? CircleCheck : TriangleAlert,
            iconColor: alreadyReported ? "#FF9800" : undefined,
          });
        }, 300);
      }
    },
    [currentConversationId, showAlert, hideAlert],
  );

  return {
    chatActionsVisible,
    setChatActionsVisible,
    reportSheetVisible,
    setReportSheetVisible,
    isMuted,
    mutedUntil,
    unblocking,
    handleUnsend,
    handleDeleteChat,
    handleMuteChat,
    handleStartReport,
    handleBlockUser,
    handleUnblockUser,
    handleReportReason,
  };
}
