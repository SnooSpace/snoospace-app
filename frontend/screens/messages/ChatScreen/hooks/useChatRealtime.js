import { useState, useEffect } from "react";
import { InteractionManager } from "react-native";
import useRealtimeSubscription from "../../../../hooks/useRealtimeSubscription";
import { markMessageRead } from "../../../../api/messages";

export default function useChatRealtime({
  currentConversationId,
  currentUser,
  addNewMessage,
  updateMessageById,
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => task.cancel?.();
  }, []);

  useRealtimeSubscription({
    table: "messages",
    event: "*",
    filter: ready && currentConversationId
      ? `conversation_id=eq.${currentConversationId}`
      : null,
    onData: (payload) => {
      if (payload.eventType === "INSERT") {
        const m = payload.new;
        if (currentUser?.id && String(m.sender_id) === String(currentUser.id)) {
          return;
        }
        addNewMessage({
          id: m.id,
          senderId: m.sender_id,
          senderType: m.sender_type,
          messageText: m.message_text,
          messageType: m.message_type,
          metadata: m.metadata,
          isDeleted: m.is_deleted,
          deletedByType: m.deleted_by_type,
          replyToMessageId: m.reply_to_message_id,
          isRead: m.is_read,
          createdAt: m.created_at,
        });
        markMessageRead(m.id).catch(() => {});
      } else if (payload.eventType === "UPDATE") {
        updateMessageById(payload.new.id, {
          isDeleted: payload.new.is_deleted,
          deletedByType: payload.new.deleted_by_type,
          messageText: payload.new.is_deleted ? null : payload.new.message_text,
        });
      }
    },
  });
}
