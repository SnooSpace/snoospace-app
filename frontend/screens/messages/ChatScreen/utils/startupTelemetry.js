/**
 * startupTelemetry.js
 * Non-intrusive runtime telemetry for ChatScreen startup pipeline.
 * Collects empirical metrics without modifying behavior.
 */

import { computeEstimatedMessageHeight } from "./chatListHelpers";

let mountTimestamp = 0;
let currentConvId = null;
let layoutVersion = 0;
let previousContentHeight = 0;
let initialPositionLogged = false;
let storedViewportHeight = 0;
let lastLoggedOffsetY = null;

let overrideIndexMap = new Map();
let overridePassCount = 0;

export function resetStartupTelemetry(conversationId) {
  mountTimestamp = global.performance ? global.performance.now() : Date.now();
  currentConvId = conversationId;
  layoutVersion = 0;
  previousContentHeight = 0;
  initialPositionLogged = false;
  storedViewportHeight = 0;
  lastLoggedOffsetY = null;
  overrideIndexMap = new Map();
  overridePassCount = 0;
  console.log(`[STARTUP-TELEMETRY] Init conversationId=${conversationId} at t=0ms`);
}

function getElapsedMs() {
  const now = global.performance ? global.performance.now() : Date.now();
  return (now - mountTimestamp).toFixed(1);
}

export function getCurrentLayoutVersion() {
  return layoutVersion;
}

export function computeSumEstimatedHeight(flatListData) {
  if (!flatListData || flatListData.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < flatListData.length; i++) {
    const item = flatListData[i];
    if (!item) continue;
    if (item.type === "date_separator" || item.type === "separator") {
      total += 28;
    } else if (item.data) {
      total += computeEstimatedMessageHeight(item.data);
    }
  }
  return Math.round(total);
}

export function computeBottomGap(contentHeight, viewportHeight, scrollOffset) {
  if (!contentHeight || !viewportHeight || scrollOffset === undefined || scrollOffset === null) {
    return "unknown";
  }
  const gap = contentHeight - (viewportHeight + scrollOffset);
  return `${gap >= 0 ? "+" : ""}${gap.toFixed(1)}px`;
}

export function logOverrideItemLayout(index, size, totalItems) {
  if (index === undefined || index === null) return;
  overrideIndexMap.set(index, size || 0);

  if (totalItems && (index === totalItems - 1 || overrideIndexMap.size === totalItems)) {
    overridePassCount += 1;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    overrideIndexMap.forEach((sz) => {
      sum += sz;
      if (sz < min) min = sz;
      if (sz > max) max = sz;
    });

    console.log(
      `[STARTUP-TELEMETRY][overrideItemLayout Pass #${overridePassCount}] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} uniqueIndices=${overrideIndexMap.size}/${totalItems} sumAssignedSize=${sum.toFixed(1)}px minSize=${min}px maxSize=${max}px avgSize=${(sum / (overrideIndexMap.size || 1)).toFixed(1)}px`
    );
    overrideIndexMap.clear();
  }
}

export function summarizeComposition(flatListData) {
  if (!flatListData || flatListData.length === 0) return { total: 0 };
  const recent = flatListData.slice(-30);
  const counts = {
    total: recent.length,
    plain_text: 0,
    multiline_text: 0,
    reply: 0,
    image: 0,
    video: 0,
    shared_post: 0,
    shared_event: 0,
    shared_opportunity: 0,
    shared_plan: 0,
    system: 0,
    deleted: 0,
    other: 0,
  };

  recent.forEach((item) => {
    if (item.type === "separator" || item.type === "date_separator") return;
    const msg = item.data;
    if (!msg) return;
    if (msg.messageType === "system") {
      counts.system++;
      return;
    }
    if (msg.isDeleted) {
      counts.deleted++;
      return;
    }
    if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) {
      counts.reply++;
    }
    const mType = msg.messageType;
    if (mType === "image" || mType === "multi_media") counts.image++;
    else if (mType === "video") counts.video++;
    else if (mType === "post_share") counts.shared_post++;
    else if (mType === "event_share") counts.shared_event++;
    else if (mType === "opportunity_share") counts.shared_opportunity++;
    else if (mType === "plan_share") counts.shared_plan++;
    else if (mType === "text" || !mType) {
      const text = msg.messageText || "";
      if (text.includes("\n") || text.length > 50) counts.multiline_text++;
      else counts.plain_text++;
    } else {
      counts.other++;
    }
  });

  return counts;
}

export function logInitialPosition(flatListData, viewportHeight, initialScrollIndexProp, drawDistanceProp) {
  if (viewportHeight && viewportHeight > 0) {
    storedViewportHeight = viewportHeight;
  }
  if (initialPositionLogged && (!viewportHeight || storedViewportHeight === viewportHeight)) return;
  initialPositionLogged = true;

  const count = flatListData ? flatListData.length : 0;
  const comp = summarizeComposition(flatListData);
  const sumEstH = computeSumEstimatedHeight(flatListData);

  console.log(
    `[STARTUP-TELEMETRY][Stage 1: Initial Native Position] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} msgCount=${count} initialScrollIndex=${initialScrollIndexProp !== undefined ? initialScrollIndexProp : "undefined"} viewportH=${storedViewportHeight || "unknown"} sumEstimatedH=${sumEstH}px composition=${JSON.stringify(comp)} flashListConfig={"drawDistance":${drawDistanceProp ?? 250},"estimatedItemSize":70,"hasHeader":true,"maintainVisibleContentPosition":true}`
  );
}

export function logContentSizeChange(width, height, flatListData) {
  layoutVersion += 1;
  const delta = previousContentHeight === 0 ? 0 : height - previousContentHeight;
  const isFirst = layoutVersion === 1;
  const sumEstH = computeSumEstimatedHeight(flatListData);
  const estDiff = sumEstH > 0 ? height - sumEstH : 0;

  console.log(
    `[STARTUP-TELEMETRY][Stage 2: ContentSizeChange #${layoutVersion}] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} w=${width} h=${height} delta=${delta >= 0 ? "+" : ""}${delta}px estDiff=${estDiff >= 0 ? "+" : ""}${estDiff}px viewportH=${storedViewportHeight || "unknown"} isFirst=${isFirst}`
  );
  previousContentHeight = height;
}

export function logStartupScrollEvent(offsetY, currentContentHeight) {
  if (lastLoggedOffsetY !== null && Math.abs(offsetY - lastLoggedOffsetY) < 1) {
    return; // deduplicate minor scroll noise
  }
  lastLoggedOffsetY = offsetY;
  const liveContentH = currentContentHeight || previousContentHeight;
  const gap = computeBottomGap(liveContentH, storedViewportHeight, offsetY);
  console.log(
    `[STARTUP-TELEMETRY][onScroll Event] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} offsetY=${offsetY.toFixed(1)} contentH=${liveContentH} viewportH=${storedViewportHeight} bottomGap=${gap}`
  );
}

export function logProgrammaticScroll(methodName, params, currentContentHeight) {
  const liveH = currentContentHeight || previousContentHeight;
  const err = new Error();
  const rawStack = err.stack || "";
  const stackLines = rawStack
    .split("\n")
    .slice(2, 5)
    .map((s) => s.trim())
    .join(" -> ");
  console.log(
    `[STARTUP-TELEMETRY][PROGRAMMATIC SCROLL CALL] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} method=${methodName} params=${JSON.stringify(params)} contentH=${liveH} stack=[${stackLines}]`
  );
}

export function logStageBeforeRAF(contentHeight, scrollOffset) {
  const liveH = contentHeight || previousContentHeight;
  const gap = computeBottomGap(liveH, storedViewportHeight, scrollOffset);
  console.log(
    `[STARTUP-TELEMETRY][Stage 3: rAF scrollToEnd BEFORE] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} offset=${scrollOffset !== undefined ? scrollOffset.toFixed(1) : "unknown"} contentH=${liveH} viewportH=${storedViewportHeight} bottomGap=${gap}`
  );
}

export function logStageAfterRAF(scrollOffset, contentHeight) {
  const liveH = contentHeight || previousContentHeight;
  const gap = computeBottomGap(liveH, storedViewportHeight, scrollOffset);
  console.log(
    `[STARTUP-TELEMETRY][Stage 3: rAF scrollToEnd AFTER] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} offset=${scrollOffset !== undefined ? scrollOffset.toFixed(1) : "unknown"} contentH=${liveH} bottomGap=${gap}`
  );
}

export function logStageBeforeTimeout(scrollOffset, contentHeight) {
  const liveH = contentHeight || previousContentHeight;
  const gap = computeBottomGap(liveH, storedViewportHeight, scrollOffset);
  console.log(
    `[STARTUP-TELEMETRY][Stage 4: setTimeout(120) scrollToEnd BEFORE] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} offset=${scrollOffset !== undefined ? scrollOffset.toFixed(1) : "unknown"} contentH=${liveH} bottomGap=${gap}`
  );
}

export function logStageAfterTimeout(scrollOffset, contentHeight) {
  const liveH = contentHeight || previousContentHeight;
  const gap = computeBottomGap(liveH, storedViewportHeight, scrollOffset);
  console.log(
    `[STARTUP-TELEMETRY][Stage 4: setTimeout(120) scrollToEnd AFTER] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} offset=${scrollOffset !== undefined ? scrollOffset.toFixed(1) : "unknown"} contentH=${liveH} bottomGap=${gap}`
  );
}

export function logOpacityReveal() {
  console.log(
    `[STARTUP-TELEMETRY][Stage 5: Reveal Opacity Animated] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} opacity 0 -> 1`
  );
}

export function logViewableItems(viewableItems, flatListDataLength) {
  if (!viewableItems || viewableItems.length === 0) return;
  const indices = viewableItems.map((v) => v.index).filter((idx) => idx !== undefined && idx !== null);
  if (indices.length === 0) return;
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  const expectedLast = flatListDataLength > 0 ? flatListDataLength - 1 : 0;
  const lastVisible = indices.includes(expectedLast);

  console.log(
    `[STARTUP-TELEMETRY][Viewability Update] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} visibleRange=[${minIdx}..${maxIdx}] count=${indices.length} expectedLastIdx=${expectedLast} lastMessageVisible=${lastVisible}`
  );
}
