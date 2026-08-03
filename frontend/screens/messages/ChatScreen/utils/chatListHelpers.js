import { isCardUnavailableSync } from "../../../../utils/cardAvailabilityCache";
import {
  isPostUnavailable,
} from "../../../../components/SharedPostCard";
import {
  isOpportunityUnavailable,
} from "../../../../components/SharedOpportunityCard";
import {
  isEventUnavailable,
} from "../../../../components/SharedEventCard";
import {
  isPlanUnavailable,
} from "../../../../components/SharedPlanCard";

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

  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const older = messages[i - 1];

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

    const isFirstOfDay = !older || msg._dateString !== older._dateString;
    const isDifferentSenderOrTime =
      isFirstOfDay ||
      !older ||
      older.senderId !== msg.senderId ||
      Math.abs((msg._time || 0) - (older._time || 0)) > 60000;

    msg._showAvatar = isDifferentSenderOrTime;
    msg._showSenderName =
      isGroup && (!older || older.senderId !== msg.senderId);

    if (isFirstOfDay) {
      result.push({
        type: "separator",
        id: `sep-${msg._dateString || msg.id}`,
        label: formatSeparatorLabel(msg.createdAt),
      });
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

export const keyExtractor = (item) =>
  item.type === "message" ? String(item.data.id) : item.id;

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

export const overrideItemLayout = (layout, item) => {
  if (!item) return;
  if (item.type === "separator") {
    layout.size = 36;
    return;
  }
  const msg = item.data;
  if (!msg) return;
  if (msg.messageType === "system") {
    layout.size = 32;
    return;
  }
  if (msg.isDeleted) {
    layout.size = 40;
    return;
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
    layout.size = 202;
    return;
  }

  if (isCard) {
    if (isCardUnavailable(msg.messageType, msg.metadata)) {
      layout.size = 44;
      return;
    }
    layout.size = 240;
    return;
  }

  let size = 55;
  if (msg._showSenderName) size += 18;
  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) size += 63;
  const len = msg.messageText ? msg.messageText.length : 0;
  if (len > 115) size += 40 + Math.ceil((len - 115) / 38) * 20;
  else if (len > 75) size += 40;
  else if (len > 35) size += 20;
  layout.size = size;
};

export const getItemTypeHelper = (item, { currentUser, isGroup, recipient, recipientId }) => {
  if (!item) return "unknown";
  if (item.type === "date_separator" || item.type === "separator")
    return "date_separator";
  if (item.type === "system") return "system";
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
        msg.media ||
        (msg.mediaUrl ? [{ url: msg.mediaUrl, type: mType }] : []);
      const count = mediaList.length;
      if (count <= 1) return `image_single${dir}`;
      if (count === 2) return `image_grid2${dir}`;
      if (count === 3) return `image_grid3${dir}`;
      return `image_grid4${dir}`;
    }

    if (msg.replyToId) return `text_reply${dir}`;
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
