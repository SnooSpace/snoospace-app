import { useState, useEffect } from "react";
import { getConversations } from "../../../../api/messages";
import { getPublicMemberProfile } from "../../../../api/members";

export default function useChatRecipient({
  conversationId,
  recipientId,
  recipientName,
  recipientUsername,
  recipientAvatar,
  recipientType = "member",
  isCreator: initialIsCreator = false,
  isGroup = false,
}) {
  const [recipient, setRecipient] = useState(() => {
    if (recipientId && recipientName) {
      return {
        id: recipientId,
        name: recipientName,
        username: recipientUsername || "",
        profilePhotoUrl: recipientAvatar || null,
        type: recipientType || "member",
        isCreator: !!initialIsCreator,
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(!recipientName && !isGroup);
  const [currentRecipientId, setCurrentRecipientId] = useState(recipientId);
  const [currentRecipientType, setCurrentRecipientType] = useState(recipientType);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [youHaveBlocked, setYouHaveBlocked] = useState(false);

  useEffect(() => {
    if (!conversationId || recipient) return;
    (async () => {
      try {
        const res = await getConversations();
        const conv = res.conversations?.find((c) => c.id === conversationId);
        if (conv?.otherParticipant) {
          setRecipient(conv.otherParticipant);
          const rId = conv.otherParticipant.id;
          const rType = conv.otherParticipant.type || "member";
          if (rId) setCurrentRecipientId(rId);
          if (rType) setCurrentRecipientType(rType);
          if (conv.otherParticipant.isBlockedByOther) setIsBlockedByOther(true);

          if (rId && rType === "member") {
            const p = await getPublicMemberProfile(rId);
            setYouHaveBlocked(!!p?.you_have_blocked);
            setRecipient((prev) => ({
              ...prev,
              isCreator: !!(p?.is_creator_mode_enabled || p?.is_creator || p?.isCreator),
            }));
          }
        }
      } catch (err) {
        console.error("Error loading recipient:", err);
      }
    })();
  }, [conversationId, recipient]);

  useEffect(() => {
    if (
      recipient &&
      recipient.type === "member" &&
      recipient.isCreator === undefined &&
      recipient.id
    ) {
      getPublicMemberProfile(recipient.id)
        .then((p) => {
          if (p?.is_creator_mode_enabled) {
            setRecipient((prev) => ({ ...prev, isCreator: true }));
          }
        })
        .catch(() => {});
    }
  }, [recipient?.id, recipient?.type, recipient?.isCreator]);

  return {
    recipient,
    setRecipient,
    loading,
    setLoading,
    currentRecipientId,
    setCurrentRecipientId,
    currentRecipientType,
    setCurrentRecipientType,
    isBlockedByOther,
    setIsBlockedByOther,
    youHaveBlocked,
    setYouHaveBlocked,
  };
}
