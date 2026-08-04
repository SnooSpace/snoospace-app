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

export const contentHeightAuditTracker = {
  knownHeights: new Map(),
  lastReportedContentH: 0,

  logRowLayout(msg, measuredH) {
    if (!msg || !msg.id) return;
    const id = msg.id;
    const type = msg.messageType || "unknown";
    const existing = this.knownHeights.get(id) || {
      type,
      height: 0,
      prevHeight: 0,
      delta: 0,
      layoutCount: 0,
    };

    existing.prevHeight = existing.height;
    existing.height = measuredH;
    existing.delta = existing.prevHeight > 0 ? existing.height - existing.prevHeight : 0;
    existing.layoutCount += 1;
    this.knownHeights.set(id, existing);

    if (existing.layoutCount > 1 && existing.delta !== 0) {
      console.warn(
        `⚠️ [ROW-HEIGHT-SHIFT] msgId=${id} | type=${type} | prevH=${existing.prevHeight}px -> newH=${measuredH}px | delta=${existing.delta > 0 ? "+" : ""}${existing.delta}px | layout#=${existing.layoutCount}`,
      );
    }
  },

  logContentSizeChange(newContentH) {
    const prevH = this.lastReportedContentH;
    const contentDelta = newContentH - prevH;
    this.lastReportedContentH = newContentH;

    if (prevH > 0 && Math.abs(contentDelta) > 10) {
      let sumMeasured = 0;
      const changedRows = [];
      this.knownHeights.forEach((data, id) => {
        sumMeasured += data.height;
        if (data.delta !== 0 && data.layoutCount > 1) {
          changedRows.push(`msgId=${id}(${data.type}: ${data.delta > 0 ? "+" : ""}${data.delta}px)`);
        }
      });

      console.log(
        `🔍 [CONTENT-SIZE-AUDIT] ContentH: ${prevH}px -> ${newContentH}px (delta: ${contentDelta > 0 ? "+" : ""}${contentDelta}px) | Sum Measured Rows: ${sumMeasured}px | Recently Changed Rows: ${changedRows.length > 0 ? changedRows.join(", ") : "NONE (FlashList Geometry Refinement)"}`,
      );
    }
  },
};

export const virtualizationAuditTracker = {
  activeMsgs: new Map(),

  logMount(msg, estH, scrollY) {
    if (!msg || !msg.id) return;
    const isLong = Boolean(msg.messageText && msg.messageText.length > 200);
    if (!isLong) return;

    const id = msg.id;
    const existing = this.activeMsgs.get(id) || {
      mountCount: 0,
      unmountCount: 0,
      layoutCount: 0,
      heights: [],
      lastMountTime: performance.now(),
    };
    existing.mountCount += 1;
    existing.lastMountTime = performance.now();
    this.activeMsgs.set(id, existing);

    console.log(
      `[VIRTUALIZATION-AUDIT][MOUNT #${existing.mountCount}] msgId=${id} | len=${msg.messageText.length} | estH=${estH}px | scrollY=${Math.round(scrollY)}px`,
    );
  },

  logUnmount(msgId) {
    const existing = this.activeMsgs.get(msgId);
    if (existing) {
      existing.unmountCount += 1;
      const lifetime = (performance.now() - existing.lastMountTime).toFixed(1);
      console.log(
        `[VIRTUALIZATION-AUDIT][UNMOUNT #${existing.unmountCount}] msgId=${msgId} | lifetime=${lifetime}ms`,
      );
    }
  },

  logLayout(msg, measuredH) {
    const id = msg?.id;
    const existing = this.activeMsgs.get(id);
    if (existing) {
      existing.layoutCount += 1;
      existing.heights.push(measuredH);
      const isReMeasured = existing.layoutCount > 1;
      const initialH = existing.heights[0];
      const delta = measuredH - initialH;
      console.log(
        `[VIRTUALIZATION-AUDIT][LAYOUT #${existing.layoutCount}] msgId=${id} | measuredH=${measuredH}px | firstH=${initialH}px | deltaFromFirst=${delta}px | reMeasured=${isReMeasured}`,
      );
    }
  },
};

export const prependMetrics = {
  active: false,
  tApiResolved: 0,
  tBuildStart: 0,
  tBuildEnd: 0,
  tSetMessages: 0,
  tFirstRaf: 0,
  tFirstContentSizeChange: 0,
  tBlankStart: 0,
  tBlankEnd: 0,
  blankDurationMs: 0,
  newMessagesCount: 0,
  totalMessagesCount: 0,
  renderItemCalls: 0,
  messageRowRenders: 0,
  overrideItemLayoutCalls: 0,
  blankEventsCount: 0,
  heightDeltas: [],
  contentHeightEvents: [],
  dumpTimer: null,

  reset() {
    this.active = false;
    this.tApiResolved = 0;
    this.tBuildStart = 0;
    this.tBuildEnd = 0;
    this.tSetMessages = 0;
    this.tFirstRaf = 0;
    this.tFirstContentSizeChange = 0;
    this.tBlankStart = 0;
    this.tBlankEnd = 0;
    this.blankDurationMs = 0;
    this.newMessagesCount = 0;
    this.totalMessagesCount = 0;
    this.renderItemCalls = 0;
    this.messageRowRenders = 0;
    this.overrideItemLayoutCalls = 0;
    this.blankEventsCount = 0;
    this.heightDeltas = [];
    this.contentHeightEvents = [];
    if (this.dumpTimer) clearTimeout(this.dumpTimer);
    this.dumpTimer = null;
  },

  recordHeightDelta(category, estimatedH, measuredH, msg = null) {
    if (!this.active) return;
    const signedDiff = measuredH - estimatedH;
    const absDiff = Math.abs(signedDiff);
    const itemInfo = {
      category,
      estimatedH,
      measuredH,
      signedDiff,
      absDiff,
      msgId: msg?.id || "N/A",
      messageType: msg?.messageType || category,
      textLength: msg?.messageText ? msg.messageText.length : 0,
      linesCount: msg?._lineCount ?? "N/A",
      hasReply: Boolean(msg?.replyToMessageId || msg?.replyPreview),
      hasMetadata: Boolean(msg?.metadata),
      showSenderName: Boolean(msg?._showSenderName),
      showAvatar: Boolean(msg?._showAvatar),
    };
    this.heightDeltas.push(itemInfo);

    if (absDiff > 100) {
      console.warn(
        `🚨 [ESTIMATION OUTLIER] msgId=${itemInfo.msgId} | type=${itemInfo.messageType} | len=${itemInfo.textLength} | est=${estimatedH}px | measured=${measuredH}px | error=${signedDiff > 0 ? "+" : ""}${signedDiff}px | lines=${itemInfo.linesCount} | reply=${itemInfo.hasReply} | metadata=${itemInfo.hasMetadata}`,
      );
    }
  },

  recordContentHeightEvent(h) {
    if (!this.active) return;
    const t = performance.now();
    const relMs = this.tSetMessages ? (t - this.tSetMessages).toFixed(1) : 0;
    this.contentHeightEvents.push({ h, relMs });
  },

  scheduleDump() {
    if (this.dumpTimer) clearTimeout(this.dumpTimer);
    this.dumpTimer = setTimeout(() => {
      this.dumpSummary();
    }, 1500);
  },

  dumpSummary() {
    if (!this.tSetMessages) return;
    const buildMs = (this.tBuildEnd - this.tBuildStart).toFixed(2);
    const setMsgToRafMs = this.tFirstRaf
      ? (this.tFirstRaf - this.tSetMessages).toFixed(2)
      : "N/A";
    const setMsgToContentHMs = this.tFirstContentSizeChange
      ? (this.tFirstContentSizeChange - this.tSetMessages).toFixed(2)
      : "N/A";
    const totalPipelineMs = this.tFirstRaf
      ? (this.tFirstRaf - this.tApiResolved).toFixed(2)
      : "N/A";

    let contentHTimeline = "";
    if (this.contentHeightEvents.length > 0) {
      contentHTimeline = `\n[CONTENT HEIGHT EMISSION TIMELINE]\n` +
        this.contentHeightEvents
          .map((e, idx) => {
            const prevH = idx > 0 ? this.contentHeightEvents[idx - 1].h : e.h;
            const delta = e.h - prevH;
            return `  • Event ${idx + 1}: t+${e.relMs}ms -> ContentH=${e.h}px (${delta >= 0 ? "+" : ""}${delta}px)`;
          })
          .join("\n");
    }

    let accuracyStats = "";
    let outlierReport = "";

    if (this.heightDeltas.length > 0) {
      const absDiffs = this.heightDeltas.map((d) => d.absDiff);
      const signedDiffs = this.heightDeltas.map((d) => d.signedDiff);

      const sortedAbs = [...absDiffs].sort((a, b) => a - b);
      const sumAbs = sortedAbs.reduce((acc, v) => acc + v, 0);
      const meanAbs = (sumAbs / sortedAbs.length).toFixed(1);

      const sumSigned = signedDiffs.reduce((acc, v) => acc + v, 0);
      const meanSigned = (sumSigned / signedDiffs.length).toFixed(1);

      const sortedSigned = [...signedDiffs].sort((a, b) => a - b);
      const medianSigned = sortedSigned[Math.floor(sortedSigned.length / 2)];
      const p95Signed = sortedSigned[Math.floor(sortedSigned.length * 0.95)];

      const byCat = {};
      this.heightDeltas.forEach((d) => {
        if (!byCat[d.category]) byCat[d.category] = [];
        byCat[d.category].push(d.signedDiff);
      });

      const catLines = Object.keys(byCat)
        .map((cat) => {
          const arr = byCat[cat];
          const catSum = arr.reduce((acc, v) => acc + v, 0);
          const catMean = (catSum / arr.length).toFixed(1);
          return `  • ${cat.padEnd(8, " ")}: Signed Mean = ${catMean > 0 ? "+" : ""}${catMean} px (count = ${arr.length})`;
        })
        .join("\n");

      const outliers = this.heightDeltas.filter((d) => d.absDiff > 100);
      if (outliers.length > 0) {
        outlierReport = `\n[ESTIMATION OUTLIERS (|Error| > 100px): ${outliers.length} rows]\n` +
          outliers
            .map((o) => `  • msgId=${o.msgId} | type=${o.messageType} | textLen=${o.textLength} | est=${o.estimatedH}px | measured=${o.measuredH}px | err=${o.signedDiff > 0 ? "+" : ""}${o.signedDiff}px | lines=${o.linesCount} | reply=${o.hasReply} | meta=${o.hasMetadata}`)
            .join("\n");
      } else {
        outlierReport = `\n[ESTIMATION OUTLIERS (|Error| > 100px)]: NONE\n`;
      }

      accuracyStats = `
[HEIGHT ESTIMATION ACCURACY (Signed: Measured - Estimated)]
• Measured Sample Size : ${sortedAbs.length} rows
• Signed Mean Error    : ${meanSigned > 0 ? "+" : ""}${meanSigned} px
• Absolute Mean Error  : ${meanAbs} px
• Signed Median Error  : ${medianSigned > 0 ? "+" : ""}${medianSigned} px
• Signed 95th Percent  : ${p95Signed > 0 ? "+" : ""}${p95Signed} px

[PER-CATEGORY SIGNED ERROR BREAKDOWN]
${catLines}${outlierReport}`;
    }

    console.log(`
===================== PREPEND METRICS SUMMARY =====================
• New Messages Prepended  : ${this.newMessagesCount}
• Total Messages Count    : ${this.totalMessagesCount}

[PIPELINE TIMING BREAKDOWN]
• Total API -> First RAF  : ${totalPipelineMs} ms
• buildMessageList()      : ${buildMs} ms
• setMessages -> RAF      : ${setMsgToRafMs} ms
• setMessages -> ContentH : ${setMsgToContentHMs} ms
• Blank Area Duration     : ${this.blankDurationMs.toFixed(2)} ms (${this.blankEventsCount} blank events)
${contentHTimeline}

[COUNTERS]
• renderItem Calls       : ${this.renderItemCalls}
• MessageRow Renders     : ${this.messageRowRenders}
• overrideItemLayout     : ${this.overrideItemLayoutCalls}
${accuracyStats}
===================================================================
    `);
    this.reset();
  },
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

  if (prependMetrics.active) {
    prependMetrics.tBuildStart = performance.now();
  }

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

  if (prependMetrics.active) {
    prependMetrics.tBuildEnd = performance.now();
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
  if (!msg) return 70;
  const separatorExtra = msg._isFirstOfDay ? 36 : 0;

  if (msg.messageType === "system") {
    return 28 + separatorExtra;
  }
  if (msg.isDeleted) {
    return 36 + separatorExtra;
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
    return 190 + separatorExtra;
  }

  if (isCard) {
    if (isCardUnavailable(msg.messageType, msg.metadata)) {
      return 40 + separatorExtra;
    }
    return 220 + separatorExtra;
  }

  let size = 38 + 25;
  if (msg._showSenderName) size += 16;
  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) size += 46;

  const text = msg.messageText || "";
  if (text.length > 0) {
    const lines = text.split("\n");
    let lineCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i].length;
      lineCount += Math.max(1, Math.ceil(lineLen / 26));
    }
    const LINE_HEIGHT = 21;
    size += Math.max(0, lineCount - 1) * LINE_HEIGHT;
  }
  return size + separatorExtra;
};

export const overrideItemLayout = (layout, item) => {
  if (prependMetrics.active) {
    prependMetrics.overrideItemLayoutCalls++;
  }

  if (!item || !item.data) return;
  layout.size = computeEstimatedMessageHeight(item.data);
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

    const hasReply = Boolean(msg.replyToId || msg.replyToMessageId);
    const replySuffix = hasReply ? "_reply" : "";

    // Classify text messages into recycling pools by character length!
    const textLen = msg.messageText ? msg.messageText.length : 0;
    let sizeClass = "short";
    if (textLen > 350) {
      sizeClass = "long";
    } else if (textLen > 100) {
      sizeClass = "medium";
    }

    return `text_${sizeClass}${replySuffix}${dir}${sep}`;
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
