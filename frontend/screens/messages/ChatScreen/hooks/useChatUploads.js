import { useState } from "react";
import { UserX, TriangleAlert } from "lucide-react-native";
import { sendMessage } from "../../../../api/messages";
import { uploadChatMedia } from "../../../../api/upload";
import EventBus from "../../../../utils/EventBus";
import { appendMessageToCache } from "../../../../services/conversationCache";

export default function useChatUploads({
  currentConversationId,
  currentRecipientId,
  currentRecipientType,
  recipientId,
  recipientType = "member",
  recipient,
  selectedReply,
  setSelectedReply,
  addNewMessage,
  setCurrentConversationId,
  composerRef,
  flashListRef,
  showAlert,
  hideAlert,
  handleUnblockUser,
}) {
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSendPayload = async ({ text, attachments }) => {
    const hasText = text && text.length > 0;
    const hasMedia = attachments && attachments.length > 0;
    if ((!hasText && !hasMedia) || sending || uploadingMedia) return;

    const replyId = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    const attachmentsSnap = attachments ? [...attachments] : [];

    setSelectedReply(null);
    setSending(true);

    try {
      const finalRecipientId =
        currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType =
        currentRecipientType || recipientType || recipient?.type || "member";
      if (!finalRecipientId && !currentConversationId)
        throw new Error("Recipient information is missing.");

      if (attachmentsSnap.length === 0) {
        const response = await sendMessage({
          conversationId: currentConversationId || undefined,
          recipientId: currentConversationId ? undefined : finalRecipientId,
          recipientType: finalRecipientType,
          messageText: text,
          messageType: "text",
          reply_to_message_id: replyId,
          metadata: null,
        });
        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!currentConversationId)
          setCurrentConversationId(msg.conversationId);
        addNewMessage(msg);
        appendMessageToCache(msg.conversationId, msg);
        EventBus.emit("conversation-updated", {
          conversationId: msg.conversationId,
          lastMessage: msg.messageText,
          lastMessageAt: msg.createdAt,
          otherParticipant: recipient
            ? { ...recipient, type: finalRecipientType }
            : { id: finalRecipientId, type: finalRecipientType },
        });
      } else {
        setUploadingMedia(true);
        setUploadProgress(0);

        const totalItems = attachmentsSnap.length;
        const progressArr = new Array(totalItems).fill(0);

        const uploadedItems = await Promise.all(
          attachmentsSnap.map((attachment, idx) =>
            uploadChatMedia(attachment.uri, attachment.type, {
              onProgress: (p) => {
                progressArr[idx] = p;
                const avg = progressArr.reduce((a, b) => a + b, 0) / totalItems;
                setUploadProgress(avg);
              },
            }).then((u) => ({ uploaded: u, type: attachment.type })),
          ),
        );

        setUploadingMedia(false);

        let resolvedConvId = currentConversationId;
        const isMulti = uploadedItems.length > 1;
        const messageType = isMulti ? "multi_media" : uploadedItems[0].type;

        const metadata = isMulti
          ? uploadedItems.map(({ uploaded }, idx) => ({
              url: uploaded.url,
              public_id: uploaded.public_id,
              resource_type: uploaded.resource_type,
              duration: uploaded.duration,
              thumbnail_url: uploaded.thumbnail_url,
              width: uploaded.width,
              height: uploaded.height,
              mute_audio: attachmentsSnap[idx]?.muteAudio ?? false,
            }))
          : {
              url: uploadedItems[0].uploaded.url,
              public_id: uploadedItems[0].uploaded.public_id,
              resource_type: uploadedItems[0].uploaded.resource_type,
              duration: uploadedItems[0].uploaded.duration,
              thumbnail_url: uploadedItems[0].uploaded.thumbnail_url,
              width: uploadedItems[0].uploaded.width,
              height: uploadedItems[0].uploaded.height,
              mute_audio: attachmentsSnap[0]?.muteAudio ?? false,
            };

        const response = await sendMessage({
          conversationId: resolvedConvId || undefined,
          recipientId: resolvedConvId ? undefined : finalRecipientId,
          recipientType: finalRecipientType,
          messageText: text,
          messageType: messageType,
          reply_to_message_id: replyId,
          metadata,
        });

        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!resolvedConvId) resolvedConvId = msg.conversationId;
        if (!currentConversationId && resolvedConvId)
          setCurrentConversationId(resolvedConvId);
        addNewMessage(msg);
        appendMessageToCache(resolvedConvId, msg);

        const previewLabel = isMulti
          ? `${uploadedItems.length} ≡ƒô╖ Media`
          : messageType === "image"
            ? "≡ƒô╖ Photo"
            : "≡ƒÄÑ Video";

        EventBus.emit("conversation-updated", {
          conversationId: resolvedConvId,
          lastMessage: previewLabel,
          lastMessageAt: msg.createdAt,
          otherParticipant: recipient
            ? { ...recipient, type: finalRecipientType }
            : { id: finalRecipientId, type: finalRecipientType },
        });
      }

      EventBus.emit("new-message");
      composerRef.current?.clear();
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("Error sending message:", err);
      if (err?.status === 403 && err?.data?.error === "you_have_blocked") {
        showAlert({
          title: "You've blocked this user",
          message: "Unblock them first to send messages.",
          primaryAction: {
            text: "Unblock",
            onPress: () => {
              hideAlert();
              handleUnblockUser();
            },
          },
          secondaryAction: { text: "Cancel", onPress: hideAlert },
          icon: UserX,
        });
      } else {
        showAlert({
          title: "Error",
          message: err?.message || "Failed to send message.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      }
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  return {
    sending,
    uploadingMedia,
    uploadProgress,
    handleSendPayload,
  };
}
