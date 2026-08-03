import { useState, useMemo, useRef, useEffect, useCallback } from "react";

export default function useMessageViewer({
  messages,
  isGroup,
  currentUser,
  recipient,
  recipientId,
}) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const mediaTimeline = useMemo(() => {
    const timeline = [];
    messages.forEach((msg) => {
      if (msg.isDeleted) return;
      const isMyMessage = isGroup
        ? String(msg.senderId) === String(currentUser?.id) &&
          (msg.senderType || "member") === (currentUser?.type || "member")
        : currentUser?.id != null
          ? String(msg.senderId) === String(currentUser?.id)
          : String(msg.senderId) !== String(recipient?.id ?? recipientId);
      const senderName = isMyMessage
        ? "You"
        : msg.senderName || recipient?.name;
      const avatarUri = isMyMessage
        ? currentUser?.avatarUri || "https://via.placeholder.com/30"
        : isGroup
          ? msg.senderPhotoUrl || "https://via.placeholder.com/30"
          : recipient?.profilePhotoUrl || "https://via.placeholder.com/30";
      const commonData = {
        messageId: msg.id,
        createdAt: msg.createdAt,
        isMyMessage,
        senderName,
        avatarUri,
      };

      if (msg.messageType === "image" || msg.messageType === "video") {
        if (!msg.metadata?.url) return;
        timeline.push({
          id: msg.id,
          uri: msg.metadata.url,
          type: msg.messageType,
          duration: msg.metadata.duration,
          muteAudio: msg.metadata.mute_audio ?? false,
          width: msg.metadata.width || null,
          height: msg.metadata.height || null,
          indexInMessage: 0,
          ...commonData,
        });
      } else if (
        msg.messageType === "multi_media" &&
        Array.isArray(msg.metadata)
      ) {
        msg.metadata.forEach((item, index) => {
          if (!item.url) return;
          timeline.push({
            id: `${msg.id}_${index}`,
            uri: item.url,
            type: item.resource_type === "video" ? "video" : "image",
            duration: item.duration,
            muteAudio: item.mute_audio ?? false,
            width: item.width || null,
            height: item.height || null,
            indexInMessage: index,
            ...commonData,
          });
        });
      }
    });

    return timeline.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
  }, [messages, isGroup, currentUser, recipient, recipientId]);

  const mediaTimelineRef = useRef([]);
  useEffect(() => {
    mediaTimelineRef.current = mediaTimeline;
  }, [mediaTimeline]);

  const handleOpenViewer = useCallback((mediaId) => {
    const idx = mediaTimelineRef.current.findIndex((m) => m.id === mediaId);
    if (idx !== -1) {
      setViewerIndex(idx);
      setViewerVisible(true);
    }
  }, []);

  return {
    viewerVisible,
    setViewerVisible,
    viewerIndex,
    setViewerIndex,
    mediaTimeline,
    mediaTimelineRef,
    handleOpenViewer,
  };
}
