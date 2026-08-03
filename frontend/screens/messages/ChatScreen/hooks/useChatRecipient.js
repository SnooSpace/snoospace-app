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
          }
        }
      } catch (err) {
        console.error("Error loading recipient:", err);
      }
    })();
  }, [conversationId, recipient]);

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
