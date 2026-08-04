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
      if (prevFirstOfDay !== undefined) {
        console.log(
          `[GROUPING-DIFF] id=${msg.id} prevFirstOfDay=${prevFirstOfDay}->${isFirstOfDay} prevAvatar=${prevAvatar}->${isDifferentSenderOrTime} prevSender=${prevSender}->${showSenderName}`,
        );
      }
      msg._isFirstOfDay = isFirstOfDay;
      msg._dateSeparatorLabel = isFirstOfDay ? formatSeparatorLabel(msg.createdAt) : null;
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

export const overrideItemLayout = (layout, item) => {
  if (!item || !item.data) return;
  const msg = item.data;
  const separatorExtra = msg._isFirstOfDay ? 36 : 0;

  if (msg.messageType === "system") {
    layout.size = 28 + separatorExtra;
    return;
  }
  if (msg.isDeleted) {
    layout.size = 36 + separatorExtra;
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
    layout.size = 190 + separatorExtra;
    return;
  }

  if (isCard) {
    if (isCardUnavailable(msg.messageType, msg.metadata)) {
      layout.size = 40 + separatorExtra;
      return;
    }
    layout.size = 220 + separatorExtra;
    return;
  }

  let size = 38;
  if (msg._showSenderName) size += 16;
  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) size += 46;
  const len = msg.messageText ? msg.messageText.length : 0;
  if (len > 115) size += 36 + Math.ceil((len - 115) / 40) * 18;
  else if (len > 75) size += 36;
  else if (len > 35) size += 18;
  layout.size = size + separatorExtra;
};

export const getItemTypeHelper = (item, { currentUser, isGroup, recipient, recipientId }) => {
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
    const sep = msg._isFirstOfDay ? "_sep" : "";
    if (msg.isDeleted) return `deleted${dir}${sep}`;
    if (msg.messageType === "system") return `system${dir}${sep}`;

    const mType = msg.messageType;
    if (mType === "ticket") return `ticket${dir}${sep}`;
    if (mType === "event_share") return `event_share${dir}${sep}`;
    if (mType === "plan_share") return `plan_share${dir}${sep}`;
    if (mType === "opportunity_share") return `opportunity_share${dir}${sep}`;
    if (mType === "post_share") return `post_share${dir}${sep}`;
    if (mType === "video") return `video${dir}${sep}`;

    if (mType === "image" || mType === "multi_media") {
      const mediaList =
        msg.media ||
        (msg.mediaUrl ? [{ url: msg.mediaUrl, type: mType }] : []);
      const count = mediaList.length;
      if (count <= 1) return `image_single${dir}${sep}`;
      if (count === 2) return `image_grid2${dir}${sep}`;
      if (count === 3) return `image_grid3${dir}${sep}`;
      return `image_grid4${dir}${sep}`;
    }

    if (msg.replyToId) return `text_reply${dir}${sep}`;
    return `text${dir}${sep}`;
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
