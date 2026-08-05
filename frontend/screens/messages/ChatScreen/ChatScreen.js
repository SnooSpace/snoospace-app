import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Platform,
  Keyboard,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useKeyboardHandler,
} from "react-native-keyboard-controller";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { ArrowLeft } from "lucide-react-native";

import SnooLoader from "../../../components/ui/SnooLoader";
import { mainStyles, PRIMARY_COLOR } from "./ChatScreen.styles";

import useChatAlerts from "./hooks/useChatAlerts";
import useChatRecipient from "./hooks/useChatRecipient";
import useGroupMessaging from "./hooks/useGroupMessaging";
import useChatMessages from "./hooks/useChatMessages";
import useChatInitialization from "./hooks/useChatInitialization";
import useChatRealtime from "./hooks/useChatRealtime";
import useChatSocket from "./hooks/useChatSocket";
import useChatTyping from "./hooks/useChatTyping";
import useChatUploads from "./hooks/useChatUploads";
import useChatModeration from "./hooks/useChatModeration";

import ChatHeader from "./components/ChatHeader";
import BlockBanner from "./components/BlockBanner";
import ChatMessageList from "./components/ChatMessageList";
import ChatInputArea from "./components/ChatInputArea";
import ChatModals from "./components/ChatModals";
import MessageRow, { TimestampSeparator } from "./components/MessageRow";

export default function ChatScreen({ route, navigation }) {
  const {
    conversationId,
    recipientId,
    recipientType = "member",
    isGroup = false,
    groupName,
    isMuted: initialIsMuted = false,
    mutedUntil: initialMutedUntil = null,
    myGroupRole: initialMyGroupRole = null,
    messagingRestricted: initialMessagingRestricted = false,
    recipientName,
    recipientUsername,
    recipientAvatar,
    tappedAt,
  } = route.params || {};

  const insets = useSafeAreaInsets();
  const flashListRef = useRef(null);
  const composerRef = useRef(null);
  const navigationRef = useRef(navigation);

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  const isAtBottomRef = useRef(true);
  const canTriggerStartReachedRef = useRef(false);
  const hasCorrectedInitialLayoutRef = useRef(false);
  const isListSettledRef = useRef(false);
  const isInitialMountedRef = useRef(false);

  const listRevealOpacity = useSharedValue(0);
  const replyBarHeightShared = useSharedValue(0);
  const [activeRowId, setActiveRowId] = useState(null);
  const activeRowIdShared = useSharedValue(null);

  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  const [inputHeight, setInputHeight] = useState(70);
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const isChatInputFocusedShared = useSharedValue(false);

  useEffect(() => {
    isChatInputFocusedShared.value = isChatInputFocused;
  }, [isChatInputFocused]);

  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
    onMove: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const style = {
      marginBottom: inputHeight,
    };
    if (Platform.OS === "android") {
      style.transform = [{ translateY: -keyboardHeight.value }];
    }
    return style;
  });
  const { alertConfig, showAlert, hideAlert } = useChatAlerts();

  const recipientState = useChatRecipient({
    conversationId,
    recipientId,
    recipientName,
    recipientUsername,
    recipientAvatar,
    recipientType,
    isGroup,
  });

  const groupState = useGroupMessaging({
    isGroup,
    currentConversationId,
    initialMessagingRestricted,
    initialMyGroupRole,
  });

  const messagesState = useChatMessages({
    conversationId,
    isGroup,
    currentUser: null,
    recipient: recipientState.recipient,
    recipientId: recipientState.currentRecipientId || recipientId,
    flashListRef,
    navigationRef,
    showAlert,
    hideAlert,
  });

  const initialCorrectionRafRef = useRef(null);
  const runInitialCorrectionAndRevealRef = useRef(null);

  const runInitialCorrectionAndReveal = useCallback(
    (contentHeight, reason = "contentSizeChange") => {
      if (hasCorrectedInitialLayoutRef.current) return;
      if (isListSettledRef.current) return;
      if (messagesState.isScrollingRef.current) return;
      if (messagesState.messages.length === 0) return;

      hasCorrectedInitialLayoutRef.current = true;

      if (initialCorrectionRafRef.current) {
        cancelAnimationFrame(initialCorrectionRafRef.current);
      }

      initialCorrectionRafRef.current = requestAnimationFrame(() => {
        initialCorrectionRafRef.current = null;
        flashListRef.current?.scrollToEnd({ animated: false });
        if (listRevealOpacity.value === 0) {
          listRevealOpacity.value = withTiming(1, { duration: 50 });
        }
      });
    },
    [messagesState.messages.length, messagesState.isScrollingRef, messagesState.isLoadingRef, listRevealOpacity],
  );

  runInitialCorrectionAndRevealRef.current = runInitialCorrectionAndReveal;

  useEffect(() => {
    if (messagesState.messages.length > 0 && listRevealOpacity.value === 0) {
      if (!hasCorrectedInitialLayoutRef.current) {
        runInitialCorrectionAndReveal();
      } else {
        listRevealOpacity.value = withTiming(1, { duration: 50 });
      }
    }
  }, [messagesState.messages.length, runInitialCorrectionAndReveal, listRevealOpacity]);

  useEffect(() => {
    hasCorrectedInitialLayoutRef.current = false;
    isListSettledRef.current = false;
    isInitialMountedRef.current = false;
    canTriggerStartReachedRef.current = false;
    listRevealOpacity.value = 0;

    return () => {
      if (initialCorrectionRafRef.current) {
        cancelAnimationFrame(initialCorrectionRafRef.current);
      }
    };
  }, [currentConversationId, listRevealOpacity]);

  const initState = useChatInitialization({
    conversationId,
    recipientId,
    recipientType,
    isGroup,
    tappedAt,
    navigation,
    loadInitial: messagesState.loadInitial,
    addNewMessages: messagesState.addNewMessages,
    bootstrapPaginationState: messagesState.bootstrapPaginationState,
    setGroupStatus: groupState.setGroupStatus,
    recipient: recipientState.recipient,
    setRecipient: recipientState.setRecipient,
    setCurrentConversationId,
    setCurrentRecipientId: recipientState.setCurrentRecipientId,
    setCurrentRecipientType: recipientState.setCurrentRecipientType,
    setYouHaveBlocked: recipientState.setYouHaveBlocked,
    setLoading: recipientState.setLoading,
    showAlert,
    hideAlert,
    runInitialCorrectionAndRevealRef,
    isLoadingRef: messagesState.isLoadingRef,
    sharedPostModalVisible: messagesState.sharedPostModalVisible,
    selectedSharedPost: messagesState.selectedSharedPost,
    setSelectedSharedPost: messagesState.setSelectedSharedPost,
    setMessagingRestricted: groupState.setMessagingRestricted,
    setMyGroupRole: groupState.setMyGroupRole,
  });

  useChatRealtime({
    currentConversationId,
    currentUser: initState.currentUser,
    addNewMessage: messagesState.addNewMessage,
    updateMessageById: messagesState.updateMessageById,
  });

  useChatSocket({
    currentConversationId,
    currentUser: initState.currentUser,
    addNewMessage: messagesState.addNewMessage,
    updateMessageById: messagesState.updateMessageById,
    setGroupStatus: groupState.setGroupStatus,
    loadInitial: messagesState.loadInitial,
    isAtBottomRef,
    flashListRef,
  });

  const typingState = useChatTyping({
    currentConversationId,
    currentUser: initState.currentUser,
  });

  const moderationState = useChatModeration({
    currentConversationId,
    currentRecipientId: recipientState.currentRecipientId,
    recipientId,
    recipient: recipientState.recipient,
    initialIsMuted,
    initialMutedUntil,
    youHaveBlocked: recipientState.youHaveBlocked,
    setYouHaveBlocked: recipientState.setYouHaveBlocked,
    navigation,
    updateMessageById: messagesState.updateMessageById,
    loadInitial: messagesState.loadInitial,
    showAlert,
    hideAlert,
  });

  const uploadsState = useChatUploads({
    currentConversationId,
    currentRecipientId: recipientState.currentRecipientId,
    currentRecipientType: recipientState.currentRecipientType,
    recipientId,
    recipientType,
    recipient: recipientState.recipient,
    selectedReply: messagesState.selectedReply,
    setSelectedReply: messagesState.setSelectedReply,
    addNewMessage: messagesState.addNewMessage,
    setCurrentConversationId,
    composerRef,
    flashListRef,
    showAlert,
    hideAlert,
    handleUnblockUser: moderationState.handleUnblockUser,
  });

  const topVisibleMsgIdRef = useRef(null);
  const visibleItemIdsRef = useRef(new Set());
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 10 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const messageItems = viewableItems.filter((v) => v.item?.type === "message");
    if (messageItems.length > 0) {
      topVisibleMsgIdRef.current = messageItems[0].item.data.id;
    }
    const ids = new Set(messageItems.map((v) => v.item?.data?.id));
    visibleItemIdsRef.current = ids;
  });

  const renderListHeader = useCallback(() => {
    return (
      <View
        style={{
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {messagesState.loadingOlder ? (
          <ActivityIndicator size="small" color={PRIMARY_COLOR} />
        ) : null}
      </View>
    );
  }, [messagesState.loadingOlder]);



  const renderItem = useCallback(
    ({ item, index }) => {
      if (__DEV__) {
        console.log(`[RECYCLE] idx=${index} id=${item.data?.id || item.label || "sep"} t=${performance.now().toFixed(1)}`);
      }
      if (item.type === "separator") {
        return <TimestampSeparator label={item.label} />;
      }
      const msg = item.data;
      if (msg.messageType === "system") {
        return (
          <View style={mainStyles.systemRow}>
            <Text style={mainStyles.systemText}>{msg.messageText}</Text>
          </View>
        );
      }
      const isMyMessage = isGroup
        ? String(msg.senderId) === String(initState.currentUser?.id) &&
          (msg.senderType || "member") === (initState.currentUser?.type || "member")
        : initState.currentUser?.id != null
          ? String(msg.senderId) === String(initState.currentUser?.id)
          : String(msg.senderId) !== String(recipientState.recipient?.id ?? recipientId);

      const showAvatar = isMyMessage ? false : Boolean(msg._showAvatar);
      const showSenderName = isMyMessage ? false : Boolean(msg._showSenderName);

      return (
        <MessageRow
          item={item}
          isMyMessage={isMyMessage}
          showAvatar={showAvatar}
          showSenderName={showSenderName}
          isGroup={isGroup}
          currentUser={initState.currentUser}
          recipient={recipientState.recipient}
          recipientId={recipientId}
          isBlockedByOther={recipientState.isBlockedByOther}
          rsvpLoading={messagesState.rsvpLoadingRef.current[msg.id]}
          isHighlighted={String(msg.id) === messagesState.highlightedMessageId}
          onHighlightDone={messagesState.clearHighlight}
          onReply={messagesState.handleReply}
          onLongPress={messagesState.handleLongPress}
          onRSVP={messagesState.handleRSVP}
          onOpenViewer={messagesState.handleOpenViewer}
          onPressPostShare={messagesState.handlePressPostShare}
          onPressUser={messagesState.handlePressUser}
          onPressOpportunity={messagesState.handlePressOpportunity}
          onPressEvent={messagesState.handlePressEvent}
          onPressPlan={messagesState.handlePressPlan}
          onPressReplyQuote={messagesState.scrollToMessage}
          navigationRef={navigationRef}
          activeRowId={activeRowId}
          activeRowIdShared={activeRowIdShared}
          setActiveRowId={setActiveRowId}
        />
      );
    },
    [
      isGroup,
      initState.currentUser,
      recipientState.recipient,
      recipientState.isBlockedByOther,
      recipientId,
      messagesState.highlightedMessageId,
      messagesState.clearHighlight,
      messagesState.handleReply,
      messagesState.handleLongPress,
      messagesState.handleRSVP,
      messagesState.handleOpenViewer,
      messagesState.handlePressPostShare,
      messagesState.handlePressUser,
      messagesState.handlePressOpportunity,
      messagesState.handlePressEvent,
      messagesState.handlePressPlan,
      messagesState.scrollToMessage,
      setActiveRowId,
    ],
  );

  if (recipientState.loading) {
    return (
      <View style={mainStyles.container}>
        <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />
        <View style={mainStyles.header}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              navigation.goBack();
            }}
            style={mainStyles.backButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={mainStyles.headerName}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={mainStyles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={mainStyles.container}>
        <StatusBar style="dark" animated={true} />
        <View style={{ backgroundColor: "#FFFFFF", zIndex: 10 }}>
          <View style={{ height: insets.top }} />
          <ChatHeader
            navigation={navigation}
            isGroup={isGroup}
            groupName={groupName}
            currentConversationId={currentConversationId}
            recipient={recipientState.recipient}
            recipientId={recipientId}
            currentRecipientId={recipientState.currentRecipientId}
            currentRecipientType={recipientState.currentRecipientType}
            isBlockedByOther={recipientState.isBlockedByOther}
            onPressMore={() => moderationState.setChatActionsVisible(true)}
          />
          <BlockBanner
            youHaveBlocked={recipientState.youHaveBlocked}
            onUnblock={moderationState.handleUnblockUser}
            unblocking={moderationState.unblocking}
          />
        </View>

        <ChatMessageList
          flashListRef={flashListRef}
          flatListData={messagesState.flatListData}
          renderItem={renderItem}
          getItemType={messagesState.getItemType}
          renderListHeader={renderListHeader}
          messagesLoading={initState.messagesLoading}
          listRevealOpacity={listRevealOpacity}
          isChatInputFocused={isChatInputFocused}
          containerAnimatedStyle={containerAnimatedStyle}
          insets={insets}
          hasMore={messagesState.hasMore}
          isLoadingRef={messagesState.isLoadingRef}
          isScrollingRef={messagesState.isScrollingRef}
          canTriggerStartReachedRef={canTriggerStartReachedRef}
          isListSettledRef={isListSettledRef}
          currentConversationId={currentConversationId}
          loadOlderMessages={messagesState.loadOlderMessages}
          runInitialCorrectionAndReveal={runInitialCorrectionAndReveal}
          viewabilityConfigRef={viewabilityConfigRef}
          onViewableItemsChangedRef={onViewableItemsChangedRef}
        />

        <ChatInputArea
          isChatInputFocused={isChatInputFocused}
          setInputHeight={setInputHeight}
          typingUsers={typingState.typingUsers}
          isGroup={isGroup}
          groupStatus={groupState.groupStatus}
          messagingRestricted={groupState.messagingRestricted}
          myGroupRole={groupState.myGroupRole}
          composerRef={composerRef}
          selectedReply={messagesState.selectedReply}
          onCloseReply={() => messagesState.setSelectedReply(null)}
          replyBarHeightShared={replyBarHeightShared}
          onSend={uploadsState.handleSendPayload}
          onTyping={typingState.handleTypingToggle}
          onFocusChange={setIsChatInputFocused}
          onShowAlert={showAlert}
          sending={uploadsState.sending}
          uploadingMedia={uploadsState.uploadingMedia}
          youHaveBlocked={recipientState.youHaveBlocked}
          isBlockedByOther={recipientState.isBlockedByOther}
        />

        <ChatModals
          optionsTarget={messagesState.optionsTarget}
          isGroup={isGroup}
          currentUser={initState.currentUser}
          recipient={recipientState.recipient}
          recipientId={recipientId}
          onReply={messagesState.handleReply}
          onCopy={messagesState.handleCopyMessage}
          onUnsend={moderationState.handleUnsend}
          onCancelOptions={() => messagesState.setOptionsTarget(null)}
          chatActionsVisible={moderationState.chatActionsVisible}
          onCloseChatActions={() => moderationState.setChatActionsVisible(false)}
          onDeleteChat={moderationState.handleDeleteChat}
          onReport={moderationState.handleStartReport}
          onMute={moderationState.handleMuteChat}
          isMuted={moderationState.isMuted}
          onBlock={moderationState.handleBlockUser}
          onUnblock={() => {
            moderationState.setChatActionsVisible(false);
            moderationState.handleUnblockUser();
          }}
          youHaveBlocked={recipientState.youHaveBlocked}
          reportSheetVisible={moderationState.reportSheetVisible}
          onCloseReportSheet={() => moderationState.setReportSheetVisible(false)}
          onSelectReportReason={moderationState.handleReportReason}
          sharedPostModalVisible={messagesState.sharedPostModalVisible}
          selectedSharedPost={messagesState.selectedSharedPost}
          onCloseSharedPostModal={() => {
            messagesState.setSharedPostModalVisible(false);
            messagesState.setSelectedSharedPost(null);
          }}
          onLikeUpdate={(postId, isLiked) =>
            messagesState.setSelectedSharedPost((prev) => ({
              ...prev,
              is_liked: isLiked,
              isLiked,
              like_count: Math.max(
                0,
                (prev?.like_count || 0) + (isLiked ? 1 : -1),
              ),
            }))
          }
          onComment={(postId, newCount) =>
            messagesState.setSelectedSharedPost((prev) => ({
              ...prev,
              comment_count: newCount,
            }))
          }
          navigation={navigation}
          commentsModalState={messagesState.commentsModalState}
          onCloseCommentsModal={() =>
            messagesState.setCommentsModalState({
              visible: false,
              postId: null,
              postType: "post",
            })
          }
          viewerVisible={messagesState.viewerVisible}
          mediaTimeline={messagesState.mediaTimeline}
          viewerIndex={messagesState.viewerIndex}
          onCloseViewer={() => messagesState.setViewerVisible(false)}
          onReplyViewer={(mediaItem) => {
            messagesState.setViewerVisible(false);
            messagesState.setSelectedReply({
              id: mediaItem.messageId,
              messageText: mediaItem.type === "video" ? "Video" : "Photo",
              messageType: mediaItem.type === "video" ? "video" : "image",
              senderName: mediaItem.senderName,
              isDeleted: false,
            });
            setTimeout(() => composerRef.current?.focus(), 100);
          }}
          alertConfig={alertConfig}
          hideAlert={hideAlert}
          composerRef={composerRef}
          setSelectedReply={messagesState.setSelectedReply}
        />
      </View>
    </GestureHandlerRootView>
  );
}
