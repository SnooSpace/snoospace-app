import { useMemo, useRef, useEffect } from "react";
import useChatPagination from "../../../../hooks/useChatPagination";
import useMessageInteractions from "./useMessageInteractions";
import useMessageViewer from "./useMessageViewer";
import useReplyState from "./useReplyState";
import { buildMessageList, getItemTypeHelper } from "../utils/chatListHelpers";
import { getCachedConversation } from "../../../../services/conversationCache";

export default function useChatMessages({
  conversationId,
  isGroup,
  currentUser,
  recipient,
  recipientId,
  flashListRef,
  navigationRef,
  showAlert,
  hideAlert,
}) {
  const initialCacheEntry = conversationId
    ? getCachedConversation(conversationId)
    : null;
  const initialMessagesRef = useRef(initialCacheEntry?.messages || []);
  const initialHasMoreRef = useRef(
    initialCacheEntry?.hasMore !== undefined ? initialCacheEntry.hasMore : true,
  );

  const pagination = useChatPagination(
    initialMessagesRef.current,
    initialHasMoreRef.current,
  );

  const flatListData = useMemo(
    () => buildMessageList(pagination.messages, isGroup),
    [pagination.messages, isGroup],
  );

  const recipientRef = useRef(recipient);
  useEffect(() => {
    recipientRef.current = recipient;
  }, [recipient]);

  const replyState = useReplyState({ recipientRef });

  const interactions = useMessageInteractions({
    flatListData,
    flashListRef,
    updateMessageById: pagination.updateMessageById,
    navigationRef,
    showAlert,
    hideAlert,
  });

  const viewer = useMessageViewer({
    messages: pagination.messages,
    isGroup,
    currentUser,
    recipient,
    recipientId,
  });

  const getItemType = useMemo(() => {
    return (item) =>
      getItemTypeHelper(item, {
        currentUser,
        isGroup,
        recipient,
        recipientId,
      });
  }, [currentUser?.id, currentUser?.type, isGroup, recipient?.id, recipientId]);

  const flatListDataRef = useRef(flatListData);
  useEffect(() => {
    flatListDataRef.current = flatListData;
  }, [flatListData]);

  return {
    ...pagination,
    flatListData,
    flatListDataRef,
    getItemType,
    ...replyState,
    ...interactions,
    ...viewer,
    recipientRef,
  };
}
