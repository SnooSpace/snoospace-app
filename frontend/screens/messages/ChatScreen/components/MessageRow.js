import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { User, Video, Image as ImageIcon } from "lucide-react-native";

import ChatMediaMessage from "../../../../components/ChatMediaMessage";
import TicketMessageCard from "../../../../components/TicketMessageCard";
import SharedPostCard from "../../../../components/SharedPostCard";
import SharedOpportunityCard from "../../../../components/SharedOpportunityCard";
import SharedEventCard from "../../../../components/SharedEventCard";
import SharedPlanCard from "../../../../components/SharedPlanCard";
import MessageInteractionLayer from "./MessageInteractionLayer";
import { formatTime, avatarColorFor, formatSeparatorLabel, computeEstimatedMessageHeight, getMessageCategory } from "../utils/chatListHelpers";
import { mainStyles } from "../ChatScreen.styles";
import { sepStyles, quoteStyles, MESSAGE_TEXT_COLOR, MAX_BUBBLE_WIDTH } from "./MessageRow.styles";

export const GroupAvatar = ({ photoUrl, name, size = 30 }) => {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = avatarColorFor(name);
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          marginRight: 8,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={photoUrl}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        marginRight: 8,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Manrope-SemiBold",
          fontSize: size * 0.38,
          color: "#FFFFFF",
        }}
      >
        {initials}
      </Text>
    </View>
  );
};

export const TimestampSeparator = React.memo(({ label }) => {
  return (
    <View style={sepStyles.row}>
      <Text style={sepStyles.label}>{label}</Text>
    </View>
  );
});

export const ReplyQuote = ({ replyPreview, isMyMessage, onPress, msgId }) => {
  React.useEffect(() => {
    console.log(`[REPLYQUOTE-MOUNT] msgId=${msgId || "unknown"}`);
  }, [msgId]);

  const isPostShare =
    replyPreview.isPostShare ||
    (!replyPreview.isDeleted && replyPreview.messageText === "Shared a post");

  return (
    <View style={quoteStyles.wrapper}>
      <Text
        style={[
          quoteStyles.replyLabel,
          isMyMessage ? quoteStyles.myReplyLabel : quoteStyles.otherReplyLabel,
        ]}
      >
        {isMyMessage ? "You replied" : "Replied to you"}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          quoteStyles.container,
          isMyMessage ? quoteStyles.myContainer : quoteStyles.otherContainer,
        ]}
      >
        <View
          style={[
            quoteStyles.verticalBar,
            isMyMessage
              ? quoteStyles.myVerticalBar
              : quoteStyles.otherVerticalBar,
          ]}
        />
        <View style={quoteStyles.content}>
          {replyPreview.isDeleted ? (
            <Text
              style={[quoteStyles.text, quoteStyles.deletedText]}
              numberOfLines={1}
            >
              This message was unsent
            </Text>
          ) : isPostShare ? (
            <>
              <View style={quoteStyles.postShareRow}>
                <ImageIcon
                  size={12}
                  color="#3565F2"
                  strokeWidth={2}
                  style={{ marginRight: 4 }}
                />
                <Text style={quoteStyles.postShareLabel}>Shared a post</Text>
              </View>
              {(replyPreview.postAuthorUsername ||
                replyPreview.postCaption) && (
                <Text
                  style={[
                    quoteStyles.text,
                    isMyMessage ? quoteStyles.myText : quoteStyles.otherText,
                    { opacity: 0.75 },
                  ]}
                  numberOfLines={1}
                >
                  {replyPreview.postAuthorUsername
                    ? `@${replyPreview.postAuthorUsername}`
                    : ""}
                  {replyPreview.postAuthorUsername && replyPreview.postCaption
                    ? " ∙ "
                    : ""}
                  {replyPreview.postCaption
                    ? replyPreview.postCaption.slice(0, 50)
                    : ""}
                </Text>
              )}
            </>
          ) : (
            <View style={quoteStyles.postShareRow}>
              {(replyPreview.messageType === "image" ||
                replyPreview.messageType === "video" ||
                replyPreview.messageType === "multi_media") &&
                (replyPreview.messageType === "video" ? (
                  <Video
                    size={12}
                    color={MESSAGE_TEXT_COLOR}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                ) : (
                  <ImageIcon
                    size={12}
                    color={MESSAGE_TEXT_COLOR}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                ))}
              <Text
                style={[
                  quoteStyles.text,
                  isMyMessage ? quoteStyles.myText : quoteStyles.otherText,
                ]}
                numberOfLines={2}
              >
                {replyPreview.messageText ||
                  (replyPreview.messageType === "video"
                    ? "Video"
                    : replyPreview.messageType === "image"
                      ? "Photo"
                      : "Media")}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

export const ReplyQuoteSkeleton = ({ isMyMessage }) => {
  return (
    <View style={quoteStyles.wrapper}>
      <Text
        style={[
          quoteStyles.replyLabel,
          isMyMessage ? quoteStyles.myReplyLabel : quoteStyles.otherReplyLabel,
        ]}
      >
        {isMyMessage ? "You replied" : "Replied"}
      </Text>
      <View
        style={[
          quoteStyles.container,
          isMyMessage ? quoteStyles.myContainer : quoteStyles.otherContainer,
          { height: 42, opacity: 0.35, backgroundColor: "#D0D9E8" },
        ]}
      />
    </View>
  );
};

const MessageRow = React.memo(
  ({
    item,
    isMyMessage,
    showAvatar,
    showSenderName,
    isGroup,
    currentUser,
    recipient,
    recipientId,
    isBlockedByOther,
    rsvpLoading,
    isHighlighted,
    onHighlightDone,
    onReply,
    onLongPress,
    onRSVP,
    onOpenViewer,
    onPressPostShare,
    onPressUser,
    onPressOpportunity,
    onPressEvent,
    onPressPlan,
    onPressReplyQuote,
    navigationRef,
    activeRowId,
    activeRowIdShared,
    setActiveRowId,
  }) => {
    const renderStartMs = performance.now();
    const msg = item.data;
    const isLongMessage = Boolean(msg?.messageText && msg.messageText.length > 200);

    const handleSwipe = React.useCallback(
      ({ payload }) => {
        if (onReply && payload) {
          onReply({
            id: payload.id,
            messageText: payload.messageText,
            senderName: isMyMessage
              ? "You"
              : payload.senderName || recipient?.name,
            isDeleted: payload.isDeleted,
          });
        }
      },
      [onReply, isMyMessage, recipient],
    );

    const handleLongPress = React.useCallback(
      ({ payload }) => {
        if (onLongPress && payload) {
          onLongPress(payload);
        }
      },
      [onLongPress],
    );

    if (msg.messageType === "system") {
      return (
        <View style={mainStyles.systemRow}>
          <Text style={mainStyles.systemText}>{msg.messageText}</Text>
        </View>
      );
    }

    const showUserIcon =
      !isGroup && (!recipient?.profilePhotoUrl || isBlockedByOther);
    const avatarEl =
      !isMyMessage &&
      (showAvatar ? (
        isGroup ? (
          <GroupAvatar photoUrl={msg.senderPhotoUrl} name={msg.senderName} />
        ) : showUserIcon ? (
          <View style={mainStyles.messageAvatarFallback}>
            <User size={16} color="#8FA1B8" strokeWidth={1.5} />
          </View>
        ) : (
          <Image
            source={{ uri: recipient.profilePhotoUrl }}
            style={mainStyles.messageAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={String(msg.senderId || recipientId)}
          />
        )
      ) : (
        <View style={{ width: 30, marginRight: 8 }} />
      ));

    if (msg.isDeleted) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View>
            {showSenderName && (
              <Text style={mainStyles.groupSenderName}>
                {msg.senderName || "Unknown"}
              </Text>
            )}
            <View
              style={[
                mainStyles.messageBubble,
                isMyMessage
                  ? mainStyles.myMessageBubble
                  : mainStyles.otherMessageBubble,
                mainStyles.deletedBubble,
              ]}
            >
              <Text style={mainStyles.deletedText}>This message was unsent</Text>
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "ticket" && msg.metadata) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View>
            {showSenderName && (
              <Text style={mainStyles.groupSenderName}>
                {msg.senderName || "Unknown"}
              </Text>
            )}
            <TicketMessageCard
              metadata={msg.metadata}
              isFromMe={isMyMessage}
              senderName={recipient?.name}
              loading={rsvpLoading}
              onViewEvent={() => {
                const nav = navigationRef.current;
                const n = nav?.getParent()?.getParent() || nav;
                n?.navigate("EventDetails", { eventId: msg.metadata.eventId });
              }}
              onConfirmGoing={() => onRSVP(msg, "going")}
              onDecline={() => onRSVP(msg, "not_going")}
            />
          </View>
        </View>
      );
    }

    if (
      msg.messageType === "image" ||
      msg.messageType === "video" ||
      msg.messageType === "multi_media"
    ) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View collapsable={false}>
            <View collapsable={false}>
              {showSenderName && (
                <Text style={mainStyles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <ChatMediaMessage
                message={msg}
                isMyMessage={isMyMessage}
                uploadProgress={null}
                onOpenViewer={onOpenViewer}
              />
              <Text
                style={[
                  mainStyles.messageTime,
                  isMyMessage ? mainStyles.myMessageTime : mainStyles.otherMessageTime,
                  {
                    marginRight: isMyMessage ? 4 : 0,
                    marginLeft: isMyMessage ? 0 : 4,
                    marginTop: 2,
                  },
                ]}
              >
                {formatTime(msg.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "post_share" && msg.metadata) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View collapsable={false}>
            <View collapsable={false}>
              {showSenderName && (
                <Text style={mainStyles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedPostCard
                metadata={msg.metadata}
                isMyMessage={isMyMessage}
                onPress={onPressPostShare}
                onUserPress={onPressUser}
              />
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "opportunity_share" && msg.metadata) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View collapsable={false}>
            <View collapsable={false}>
              {showSenderName && (
                <Text style={mainStyles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedOpportunityCard
                metadata={msg.metadata}
                isMyMessage={isMyMessage}
                onPress={onPressOpportunity}
              />
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "event_share" && msg.metadata) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View collapsable={false}>
            <View collapsable={false}>
              {showSenderName && (
                <Text style={mainStyles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedEventCard
                metadata={msg.metadata}
                isMyMessage={isMyMessage}
                onPress={onPressEvent}
              />
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "plan_share" && msg.metadata) {
      return (
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View collapsable={false}>
            <View collapsable={false}>
              {showSenderName && (
                <Text style={mainStyles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedPlanCard
                metadata={msg.metadata}
                isMyMessage={isMyMessage}
                onPress={onPressPlan}
              />
            </View>
          </View>
        </View>
      );
    }

    if (msg.replyToMessageId) {
      console.log(
        `[ROW-RENDER] msgId=${msg.id} replyId=${msg.replyToMessageId} hasPreview=${Boolean(msg.replyPreview)} renderReply=${Boolean(msg.replyToMessageId && msg.replyPreview)}`,
      );
    }

    const bubbleContent = (
      <View
        collapsable={false}
        style={{
          alignItems: isMyMessage ? "flex-end" : "flex-start",
          maxWidth: "100%",
        }}
      >
        {msg.replyToMessageId ? (
          <View>
            {msg.replyPreview ? (
              <ReplyQuote
                msgId={msg.id}
                replyPreview={msg.replyPreview}
                isMyMessage={isMyMessage}
                onPress={() => onPressReplyQuote(msg.replyToMessageId)}
              />
            ) : (
              <ReplyQuoteSkeleton isMyMessage={isMyMessage} />
            )}
          </View>
        ) : null}
        <View
          style={[
            mainStyles.messageBubble,
            isMyMessage ? mainStyles.myMessageBubble : mainStyles.otherMessageBubble,
            msg.replyPreview &&
              (isMyMessage
                ? mainStyles.myMessageBubbleReplied
                : mainStyles.otherMessageBubbleReplied),
          ]}
        >
          <Text
            style={[
              mainStyles.messageText,
              isMyMessage ? mainStyles.myMessageText : mainStyles.otherMessageText,
              { maxWidth: MAX_BUBBLE_WIDTH - 28 },
            ]}
          >
            {msg.messageText}
          </Text>
          <Text
            style={[
              mainStyles.messageTime,
              isMyMessage ? mainStyles.myMessageTime : mainStyles.otherMessageTime,
            ]}
          >
            {formatTime(msg.createdAt)}
          </Text>
        </View>
      </View>
    );

    const isFirstOfDay = msg._isFirstOfDay;
    const dateLabel = msg._dateSeparatorLabel || (isFirstOfDay ? formatSeparatorLabel(msg.createdAt) : null);

    return (
      <View>
        {isFirstOfDay && dateLabel ? (
          <TimestampSeparator label={dateLabel} />
        ) : null}
        <View
          style={[
            mainStyles.messageContainer,
            isMyMessage
              ? mainStyles.myMessageContainer
              : mainStyles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View style={{ flex: 1 }}>
            {showSenderName && (
              <Text style={mainStyles.groupSenderName}>
                {msg.senderName || "Unknown"}
              </Text>
            )}
            <View collapsable={false}>
              <MessageInteractionLayer
                itemKey={msg.id}
                isMyMessage={isMyMessage}
                onSwipe={handleSwipe}
                onLongPress={handleLongPress}
                payload={msg}
                activeRowId={activeRowId}
                activeRowIdShared={activeRowIdShared}
                setActiveRowId={setActiveRowId}
              >
                {bubbleContent}
              </MessageInteractionLayer>
            </View>
          </View>
        </View>
      </View>
    );
  },
  (prev, next) => {
    const prevMsg = prev.item?.data;
    const nextMsg = next.item?.data;

    if (!prevMsg || !nextMsg) return false;
    if (prevMsg !== nextMsg && prevMsg.id !== nextMsg.id) return false;
    if (prevMsg.messageText !== nextMsg.messageText) return false;
    if (prevMsg.isDeleted !== nextMsg.isDeleted) return false;
    if (prevMsg._isFirstOfDay !== nextMsg._isFirstOfDay) return false;
    if (prevMsg._showAvatar !== nextMsg._showAvatar) return false;
    if (prevMsg._showSenderName !== nextMsg._showSenderName) return false;
    if (prev.isMyMessage !== next.isMyMessage) return false;
    if (prev.showAvatar !== next.showAvatar) return false;
    if (prev.showSenderName !== next.showSenderName) return false;
    if (prev.isGroup !== next.isGroup) return false;
    if (prev.currentUser?.id !== next.currentUser?.id) return false;
    if (prev.recipient?.id !== next.recipient?.id) return false;
    if (prev.isBlockedByOther !== next.isBlockedByOther) return false;
    if (prev.isHighlighted !== next.isHighlighted) return false;
    if (prev.rsvpLoading !== next.rsvpLoading) return false;

    return true;
  },
);

export default MessageRow;
