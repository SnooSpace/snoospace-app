import { useEffect } from "react";
import { getSocket } from "../../../../services/socketService";
import { markMessageRead } from "../../../../api/messages";
import { appendMessageToCache } from "../../../../services/conversationCache";
import { NotificationConsumptionService } from "../../../../services/NotificationConsumptionService";

const INITIAL_MESSAGES_LIMIT = 30;

export default function useChatSocket({
  currentConversationId,
  currentUser,
  addNewMessage,
  updateMessageById,
  setGroupStatus,
  loadInitial,
  isAtBottomRef,
  flashListRef,
  pendingScrollToBottomRef,
}) {
  useEffect(() => {
    if (!currentConversationId) return;

    const socket = getSocket();
    if (socket) {
      socket.emit("join_chat", currentConversationId);
    }

    return () => {
      if (socket) {
        socket.emit("leave_chat", currentConversationId);
      }
    };
  }, [currentConversationId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentConversationId) return;

    const handleNewChatMessage = (msg) => {
      if (currentUser?.id && String(msg.senderId) === String(currentUser.id)) {
        return;
      }
      addNewMessage({
        id: msg.id,
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderUsername: msg.senderUsername,
        senderPhotoUrl: msg.senderPhotoUrl,
        messageText: msg.messageText,
        messageType: msg.messageType,
        metadata: msg.metadata,
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        replyToMessageId: msg.replyToMessageId,
        replyPreview: msg.replyPreview,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      });

      appendMessageToCache(currentConversationId, {
        id: msg.id,
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderUsername: msg.senderUsername,
        senderPhotoUrl: msg.senderPhotoUrl,
        messageText: msg.messageText,
        messageType: msg.messageType,
        metadata: msg.metadata,
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        replyToMessageId: msg.replyToMessageId,
        replyPreview: msg.replyPreview,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      });

      if (isAtBottomRef.current) {
        // Fix B: signal ChatMessageList to scroll after the next real layout
        // pass, so the new (potentially tall) cell's height is already known.
        if (pendingScrollToBottomRef) {
          pendingScrollToBottomRef.current = true;
          console.log(
            `[SCROLL_FLAG] pendingScrollToBottom SET by receiver at t=${performance.now().toFixed(1)}ms msgId=${msg.id}`,
          );
        }
      }

      markMessageRead(msg.id).catch(() => {});
      NotificationConsumptionService.consumeChat(currentConversationId).catch(
        console.error,
      );
    };

    const handleMessageUpdated = (msg) => {
      updateMessageById(msg.id, {
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        messageText: msg.messageText,
      });
    };

    const handleGroupStatusChanged = ({ conversationId, status }) => {
      if (Number(conversationId) === Number(currentConversationId)) {
        setGroupStatus(status);
        loadInitial(currentConversationId, INITIAL_MESSAGES_LIMIT).catch(
          console.error,
        );
      }
    };

    socket.on("new_chat_message", handleNewChatMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("group_status_changed", handleGroupStatusChanged);

    return () => {
      socket.off("new_chat_message", handleNewChatMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("group_status_changed", handleGroupStatusChanged);
    };
  }, [
    currentConversationId,
    currentUser,
    addNewMessage,
    updateMessageById,
    loadInitial,
    setGroupStatus,
    isAtBottomRef,
    flashListRef,
  ]);
}
