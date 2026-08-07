import { isCardUnavailableSync } from "../../../../utils/cardAvailabilityCache";
import { isPostUnavailable } from "../../../../components/SharedPostCard";
import { isOpportunityUnavailable } from "../../../../components/SharedOpportunityCard";
import { isEventUnavailable } from "../../../../components/SharedEventCard";
import { isPlanUnavailable } from "../../../../components/SharedPlanCard";
import { MAX_BUBBLE_WIDTH } from "../ChatScreen.styles";
import { logOverrideItemLayout } from "./startupTelemetry";

export const getMessageCategory = (msg) => {
  if (!msg) return "UNKNOWN";
  if (msg.messageType === "system") return "SYSTEM";
  if (msg.isDeleted) return "DELETED";
  const isImageOrVideo =
    msg.messageType === "image" ||
    msg.messageType === "video" ||
    msg.messageType === "multi_media";
  if (isImageOrVideo) return "IMAGE";

  const isCard =
    msg.messageType === "post_share" ||
    msg.messageType === "opportunity_share" ||
    msg.messageType === "event_share" ||
    msg.messageType === "plan_share" ||
    msg.messageType === "ticket";
  if (isCard) return "CARD";

  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) return "REPLY";
  return "TEXT";
};

export const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

export const formatSeparatorLabel = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && now.getDate() === d.getDate()) return "Today";
  if (diff < 2 * oneDay) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

export const _msgWrapperCache = new Map();

export const buildMessageList = (messages, isGroup) => {
  if (!messages || messages.length === 0) return [];
  if (_msgWrapperCache.size > 1000) _msgWrapperCache.clear();

  const messageLookup = new Map();
  for (let i = 0; i < messages.length; i++) {
    if (messages[i] && messages[i].id != null) {
      messageLookup.set(String(messages[i].id), messages[i]);
    }
  }

  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const older = messages[i - 1];

    const prevHasReplyPreview = Boolean(msg.replyPreview);
    const replyId = msg.replyToMessageId || msg.replyToId;
    if (replyId && !msg.replyPreview) {
      const refMsg = messageLookup.get(String(replyId));
      if (refMsg) {
        msg.replyPreview = {
          messageText: refMsg.messageText,
          senderName: refMsg.senderName,
          messageType: refMsg.messageType,
          isDeleted: refMsg.isDeleted,
          postAuthorUsername: refMsg.postAuthorUsername,
          postCaption: refMsg.postCaption,
        };
        _msgWrapperCache.delete(msg.id);
      }
    }

    if (msg && !msg._time) {
      const d = new Date(msg.createdAt);
      msg._time = d.getTime();
      msg._dateString = d.toDateString();
    }
    if (older && !older._time) {
      const d = new Date(older.createdAt);
      older._time = d.getTime();
      older._dateString = d.toDateString();
    }

    let isFirstOfDay = !older || msg._dateString !== older._dateString;
    if (msg._isFirstOfDay === true) {
      isFirstOfDay = true;
    }
    const isDifferentSenderOrTime =
      isFirstOfDay ||
      !older ||
      older.senderId !== msg.senderId ||
      Math.abs((msg._time || 0) - (older._time || 0)) > 60000;
    const showSenderName =
      isGroup && (!older || older.senderId !== msg.senderId);

    const prevFirstOfDay = msg._isFirstOfDay;
    const prevAvatar = msg._showAvatar;
    const prevSender = msg._showSenderName;

    const hasChanged =
      prevFirstOfDay !== isFirstOfDay ||
      prevAvatar !== isDifferentSenderOrTime ||
      prevSender !== showSenderName;

    if (hasChanged) {
      msg._isFirstOfDay = isFirstOfDay;
      msg._dateSeparatorLabel = isFirstOfDay
        ? formatSeparatorLabel(msg.createdAt)
        : null;
      msg._showAvatar = isDifferentSenderOrTime;
      msg._showSenderName = showSenderName;
      _msgWrapperCache.delete(msg.id);
    }

    let wrapper = _msgWrapperCache.get(msg.id);
    if (!wrapper || wrapper.data !== msg) {
      wrapper = { type: "message", data: msg };
      _msgWrapperCache.set(msg.id, wrapper);
    }
    result.push(wrapper);
  }

  return result;
};

export const keyExtractor = (item) => String(item.data.id);

export const isCardUnavailable = (messageType, metadata) => {
  if (!metadata) return false;
  if (isCardUnavailableSync(messageType, metadata)) return true;

  const cardId =
    metadata.postId ||
    metadata.opportunityId ||
    metadata.eventId ||
    metadata.planId ||
    metadata.id ||
    metadata.opportunity_id ||
    metadata.event_id ||
    metadata.plan_id;
  if (!cardId) return false;

  if (messageType === "post_share") return isPostUnavailable(cardId);
  if (messageType === "opportunity_share")
    return isOpportunityUnavailable(cardId);
  if (messageType === "event_share") return isEventUnavailable(cardId);
  if (messageType === "plan_share") return isPlanUnavailable(cardId);
  return false;
};

export const computeEstimatedMessageHeight = (msg) => {
  if (!msg) return 80;
  const separatorExtra = msg._isFirstOfDay ? 36 : 0;

  if (msg.messageType === "system") {
    return 36 + separatorExtra;
  }
  if (msg.isDeleted) {
    return 44 + separatorExtra;
  }

  const isImageOrVideo =
    msg.messageType === "image" ||
    msg.messageType === "video" ||
    msg.messageType === "multi_media";

  const isCard =
    msg.messageType === "post_share" ||
    msg.messageType === "opportunity_share" ||
    msg.messageType === "event_share" ||
    msg.messageType === "plan_share" ||
    msg.messageType === "ticket";

  if (isImageOrVideo) {
    return 260 + separatorExtra;
  }

  if (isCard) {
    if (isCardUnavailable(msg.messageType, msg.metadata)) {
      return 50 + separatorExtra;
    }
    return 380 + separatorExtra;
  }

  const printableWidth = Math.max(150, MAX_BUBBLE_WIDTH - 28);
  const CHARS_PER_LINE = Math.max(15, Math.floor(printableWidth / 8.7));
  const LINE_HEIGHT = 21;

  let size = 44 + 25;
  if (msg._showSenderName) size += 18;
  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) {
    let replySize = 54;
    const replyText = msg.replyPreview?.messageText || "";
    if (replyText.length > 50) {
      replySize += Math.ceil((replyText.length - 50) / 30) * 18;
    }
    size += replySize;
  }

  const text = msg.messageText || "";
  if (text.length > 0) {
    const lines = text.split("\n");
    let lineCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length;
      lineCount += Math.max(1, Math.ceil(lineLen / CHARS_PER_LINE));
    }
    size += Math.max(0, lineCount - 1) * LINE_HEIGHT;

    if (text.length > 200) {
      const paragraphBreaks = (text.match(/\n\n/g) || []).length;
      size +=
        paragraphBreaks * 12 + Math.min(80, Math.floor(text.length / 150) * 12);
    }
  }
  return size + separatorExtra;
};

export const overrideItemLayout = (
  layout,
  item,
  index,
  maxSpan,
  totalCount,
) => {
  if (!item) return;
  if (item.type === "date_separator" || item.type === "separator") {
    layout.size = 28;
  } else if (item.data) {
    layout.size = computeEstimatedMessageHeight(item.data);
  }
  logOverrideItemLayout(index, layout.size, totalCount);
};

export const getItemTypeHelper = (
  item,
  { currentUser, isGroup, recipient, recipientId },
) => {
  if (!item) return "unknown";
  if (item.type === "date_separator" || item.type === "separator")
    return "date_separator";
  if (item.type === "message") {
    const msg = item.data;
    const isMyMsg = isGroup
      ? String(msg.senderId) === String(currentUser?.id) &&
        (msg.senderType || "member") === (currentUser?.type || "member")
      : msg.senderId !== (recipient?.id || recipientId);
    const dir = isMyMsg ? "_out" : "_in";
    if (msg.isDeleted) return `deleted${dir}`;
    if (msg.messageType === "system") return `system${dir}`;

    const mType = msg.messageType;
    if (mType === "ticket") return `ticket${dir}`;
    if (mType === "event_share") return `event_share${dir}`;
    if (mType === "plan_share") return `plan_share${dir}`;
    if (mType === "opportunity_share") return `opportunity_share${dir}`;
    if (mType === "post_share") return `post_share${dir}`;
    if (mType === "video") return `video${dir}`;

    if (mType === "image" || mType === "multi_media") {
      const mediaList =
        msg.media || (msg.mediaUrl ? [{ url: msg.mediaUrl, type: mType }] : []);
      const count = mediaList.length;
      if (count <= 1) return `image_single${dir}`;
      if (count === 2) return `image_grid2${dir}`;
      if (count === 3) return `image_grid3${dir}`;
      return `image_grid4${dir}`;
    }

    return `text${dir}`;
  }
  return "default";
};

const AVATAR_PALETTE = [
  "#3565F2",
  "#E53935",
  "#00897B",
  "#8E24AA",
  "#F4511E",
  "#1E88E5",
  "#3949AB",
  "#039BE5",
];

export const avatarColorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};
