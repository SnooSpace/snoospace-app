import { useState, useCallback } from "react";

export default function useReplyState({ recipientRef }) {
  const [selectedReply, setSelectedReply] = useState(null);

  const handleReply = useCallback(
    (msg, isMyMessage) => {
      setSelectedReply({
        id: msg.id,
        messageText:
          msg.messageType === "multi_media"
            ? "Media"
            : msg.messageType === "image"
              ? "Photo"
              : msg.messageType === "video"
                ? "Video"
                : msg.messageText,
        messageType: msg.messageType,
        senderName: isMyMessage
          ? "You"
          : msg.senderName || recipientRef.current?.name,
        isDeleted: msg.isDeleted,
        isPostShare: msg.messageType === "post_share",
        postAuthorUsername:
          msg.metadata?.authorUsername || msg.metadata?.author_username,
        postCaption: msg.metadata?.caption,
      });
    },
    [recipientRef],
  );

  return {
    selectedReply,
    setSelectedReply,
    handleReply,
  };
}
