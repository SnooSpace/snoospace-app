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
let lastContentSizeTimestamp = 0;

let postScrollTrackingActive = false;
let postScrollRequestedTimestamp = 0;
let postScrollRequestedHeight = 0;
let postScrollRequestedLayoutVersion = 0;
let postScrollRequestedReason = "";
let postScrollFetchOccurred = false;
let postScrollContentHeightChanged = false;
let postScrollVerifiedConvergenceLogged = false;
let lastKnownOffsetY = null;
let lastKnownLastMessageVisible = false;
let contentSize1Height = 0;

let timerGenerationCounter = 0;

export function getMonotonicNow() {
  return global.performance && typeof global.performance.now === "function"
    ? global.performance.now()
    : Date.now();
}

export function resetStartupTelemetry(conversationId) {
  mountTimestamp = getMonotonicNow();
  currentConvId = conversationId;
  layoutVersion = 0;
  previousContentHeight = 0;
  initialPositionLogged = false;
  storedViewportHeight = 0;
  lastLoggedOffsetY = null;
  overrideIndexMap = new Map();
  overridePassCount = 0;
  lastContentSizeTimestamp = 0;
  timerGenerationCounter = 0;
  contentSize1Height = 0;

  postScrollTrackingActive = false;
  postScrollRequestedTimestamp = 0;
  postScrollRequestedHeight = 0;
  postScrollRequestedLayoutVersion = 0;
  postScrollRequestedReason = "";
  postScrollFetchOccurred = false;
  postScrollContentHeightChanged = false;
  postScrollVerifiedConvergenceLogged = false;
  lastKnownOffsetY = null;
  lastKnownLastMessageVisible = false;

  console.log(`[STARTUP-TELEMETRY] Init conversationId=${conversationId} at t=0ms (monotonic)`);
}

function getElapsedMs() {
  const now = getMonotonicNow();
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

export function getStoredViewportHeight() {
  return storedViewportHeight;
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
  const now = global.performance ? global.performance.now() : Date.now();
  const timeSinceLast = lastContentSizeTimestamp === 0 ? 0 : (now - lastContentSizeTimestamp).toFixed(1);
  lastContentSizeTimestamp = now;

  if (layoutVersion === 1) {
    contentSize1Height = height;
  }

  const delta = previousContentHeight === 0 ? 0 : height - previousContentHeight;
  const isFirst = layoutVersion === 1;
  const sumEstH = computeSumEstimatedHeight(flatListData);
  const estDiff = sumEstH > 0 ? height - sumEstH : 0;

  console.log(
    `[STARTUP-TELEMETRY][Stage 2: ContentSizeChange #${layoutVersion}] t=+${getElapsedMs()}ms dt=+${timeSinceLast}ms layoutVersion=${layoutVersion} w=${width} h=${height} delta=${delta >= 0 ? "+" : ""}${delta}px estDiff=${estDiff >= 0 ? "+" : ""}${estDiff}px viewportH=${storedViewportHeight || "unknown"} isFirst=${isFirst}`
  );
  previousContentHeight = height;

  checkPostScrollConvergence(lastKnownOffsetY, height, lastKnownLastMessageVisible, "onContentSizeChange");
}

export function logLayoutConvergence(reason, quietMs, finalHeight) {
  console.log(
    `[STARTUP-TELEMETRY][Stage 2.5: CONVERGENCE ACHIEVED] t=+${getElapsedMs()}ms reason=${reason} quietFor=${quietMs != null ? quietMs.toFixed(1) + "ms" : "N/A"} layoutVersion=${layoutVersion} finalContentH=${finalHeight}px`
  );
}

export function logTimerCreated(timerType, durationMs, contentHeight) {
  timerGenerationCounter += 1;
  const genId = `${timerType}_#${timerGenerationCounter}`;
  const now = getMonotonicNow();
  const createdElapsed = (now - mountTimestamp).toFixed(1);
  const intendedExpirationElapsed = (now + durationMs - mountTimestamp).toFixed(1);

  const meta = {
    genId,
    timerType,
    createdTime: now,
    createdElapsed,
    durationMs,
    intendedExpirationTime: now + durationMs,
    intendedExpirationElapsed,
  };

  console.log(
    `[TIMER-LIFECYCLE][CREATED] genId=${genId} type=${timerType} duration=${durationMs}ms createdT=+${createdElapsed}ms intendedExpirationT=+${intendedExpirationElapsed}ms contentH=${contentHeight || previousContentHeight}px`
  );

  return meta;
}

export function logTimerFired(timerMeta, contentHeight, quietForMs) {
  if (!timerMeta) return;
  const now = getMonotonicNow();
  const actualFiredElapsed = (now - mountTimestamp).toFixed(1);
  const latenessMs = (now - timerMeta.intendedExpirationTime).toFixed(1);
  const quietStr = typeof quietForMs === "number" ? `${quietForMs.toFixed(1)}ms` : "N/A";

  console.log(
    `[TIMER-LIFECYCLE][FIRED] genId=${timerMeta.genId} type=${timerMeta.timerType} createdT=+${timerMeta.createdElapsed}ms intendedExpirationT=+${timerMeta.intendedExpirationElapsed}ms actualFiredT=+${actualFiredElapsed}ms lateness=${latenessMs >= 0 ? "+" : ""}${latenessMs}ms quietFor=${quietStr} contentH=${contentHeight || previousContentHeight}px`
  );
}

export function logTimerCleared(timerMeta, clearReason, contentHeight) {
  if (!timerMeta) return;
  const now = getMonotonicNow();
  const clearedElapsed = (now - mountTimestamp).toFixed(1);
  const remainingMs = (timerMeta.intendedExpirationTime - now).toFixed(1);

  console.log(
    `[TIMER-LIFECYCLE][CLEARED] genId=${timerMeta.genId} type=${timerMeta.timerType} createdT=+${timerMeta.createdElapsed}ms intendedExpirationT=+${timerMeta.intendedExpirationElapsed}ms clearedT=+${clearedElapsed}ms remainingMs=${remainingMs}ms reason=${clearReason} contentH=${contentHeight || previousContentHeight}px`
  );
}

export function logContentSizeTimerInspection(height, activeHardTimerMeta, activeDebounceTimerMeta) {
  const now = getMonotonicNow();
  const elapsed = (now - mountTimestamp).toFixed(1);
  const hardRem = activeHardTimerMeta ? (activeHardTimerMeta.intendedExpirationTime - now).toFixed(1) : "none";
  const debRem = activeDebounceTimerMeta ? (activeDebounceTimerMeta.intendedExpirationTime - now).toFixed(1) : "none";

  console.log(
    `[TIMER-LIFECYCLE][CONTENT_SIZE_INSPECT] t=+${elapsed}ms layoutVersion=${layoutVersion} contentH=${height}px remainingHardMs=${hardRem} (gen=${activeHardTimerMeta?.genId || "none"}) remainingDebounceMs=${debRem} (gen=${activeDebounceTimerMeta?.genId || "none"})`
  );
}

export function logStateInvalidated(prevVersion, newVersion, oldHeight, newHeight, delta, passNumber) {
  console.log(
    `[STATE-MACHINE][INVALIDATED] t=+${getElapsedMs()}ms prevVersion=${prevVersion} newVersion=${newVersion} oldH=${oldHeight}px newH=${newHeight}px delta=${delta >= 0 ? "+" : ""}${delta.toFixed(1)}px pass=${passNumber}/5`
  );
}

export function logInvalidationLimitReached(passNumber, currentVersion, currentHeight, delta) {
  console.log(
    `[STATE-MACHINE][INVALIDATION_LIMIT_REACHED] t=+${getElapsedMs()}ms pass=${passNumber}/5 currentVersion=${currentVersion} currentH=${currentHeight}px delta=${delta >= 0 ? "+" : ""}${delta.toFixed(1)}px - stopping automatic invalidation`
  );
}

export function logPerformFinalPositionInvoked(reason, offsetY, contentHeight, isLastMessageVisible) {
  postScrollTrackingActive = true;
  postScrollRequestedTimestamp = global.performance ? global.performance.now() : Date.now();
  postScrollRequestedHeight = contentHeight || previousContentHeight;
  postScrollRequestedLayoutVersion = layoutVersion;
  postScrollRequestedReason = reason;
  postScrollFetchOccurred = false;
  postScrollContentHeightChanged = false;
  postScrollVerifiedConvergenceLogged = false;
  if (offsetY !== undefined && offsetY !== null) {
    lastKnownOffsetY = offsetY;
  }
  if (isLastMessageVisible !== undefined && isLastMessageVisible !== null) {
    lastKnownLastMessageVisible = isLastMessageVisible;
  }

  const liveH = contentHeight || previousContentHeight;
  const gap = computeBottomGap(liveH, storedViewportHeight, lastKnownOffsetY);

  const staleMax1 = (contentSize1Height > 0 && storedViewportHeight > 0)
    ? (contentSize1Height - storedViewportHeight)
    : undefined;
  const targetMaxOffset = (liveH > 0 && storedViewportHeight > 0)
    ? (liveH - storedViewportHeight)
    : undefined;

  console.log(
    `[POST-SCROLL-TRACE][INVOKED] t=+${getElapsedMs()}ms reason=${reason} layoutVersion=${layoutVersion} contentH=${liveH}px viewportH=${storedViewportHeight}px offsetY=${lastKnownOffsetY !== null ? lastKnownOffsetY.toFixed(1) : "unknown"} bottomGap=${gap} lastMessageVisible=${lastKnownLastMessageVisible}`
  );
  console.log(
    `[GEOMETRY-TRACE][SCROLL_TO_END_REQUESTED] t=+${getElapsedMs()}ms reason=${reason} layoutVersion=${layoutVersion} liveH=${liveH}px targetMaxOffset=${targetMaxOffset !== undefined ? targetMaxOffset.toFixed(1) : "unknown"}px currentOffsetY=${lastKnownOffsetY !== null ? lastKnownOffsetY.toFixed(1) : "unknown"}px staleContentSize1=${contentSize1Height}px staleMaxOffset1=${staleMax1 !== undefined ? staleMax1.toFixed(1) : "unknown"}px`
  );

  checkPostScrollConvergence(lastKnownOffsetY, liveH, lastKnownLastMessageVisible, "performFinalPositionInvoked");
}

export function logPostScrollFetchOlder(details = "") {
  if (postScrollTrackingActive) {
    postScrollFetchOccurred = true;
    const now = global.performance ? global.performance.now() : Date.now();
    const elapsed = (now - postScrollRequestedTimestamp).toFixed(1);
    console.log(
      `[POST-SCROLL-TRACE][FETCH-OLDER OCCURRED] t=+${getElapsedMs()}ms layoutVersion=${layoutVersion} elapsedSinceScrollReq=${elapsed}ms details=${details}`
    );
  }
}

export function checkPostScrollConvergence(offsetY, contentHeight, isLastMessageVisible, triggerSource) {
  if (offsetY !== undefined && offsetY !== null) {
    lastKnownOffsetY = offsetY;
  }
  if (isLastMessageVisible !== undefined && isLastMessageVisible !== null) {
    lastKnownLastMessageVisible = isLastMessageVisible;
  }

  const liveH = contentHeight || previousContentHeight;

  if (contentSize1Height > 0 && lastKnownOffsetY !== null && storedViewportHeight > 0) {
    const staleMax1 = contentSize1Height - storedViewportHeight;
    if (Math.abs(lastKnownOffsetY - staleMax1) < 15 || Math.abs(lastKnownOffsetY - contentSize1Height) < 15) {
      console.log(
        `[GEOMETRY-TRACE][STALLED AT STALE BOUNDARY] t=+${getElapsedMs()}ms offsetY=${lastKnownOffsetY.toFixed(1)}px matches staleContentSize1=${contentSize1Height}px (staleMaxOffset1=${staleMax1.toFixed(1)}px) targetMaxOffset=${(liveH - storedViewportHeight).toFixed(1)}px distanceToTarget=${(liveH - storedViewportHeight - lastKnownOffsetY).toFixed(1)}px triggerSource=${triggerSource}`
      );
    }
  }

  if (postScrollTrackingActive && !postScrollVerifiedConvergenceLogged) {
    if (liveH !== postScrollRequestedHeight && postScrollRequestedHeight > 0) {
      if (!postScrollContentHeightChanged) {
        postScrollContentHeightChanged = true;
        console.log(
          `[POST-SCROLL-TRACE][CONTENT-HEIGHT CHANGED] t=+${getElapsedMs()}ms reqH=${postScrollRequestedHeight}px currentH=${liveH}px delta=${(liveH - postScrollRequestedHeight).toFixed(1)}px triggerSource=${triggerSource}`
        );
      }
    }

    const gapNumber = (storedViewportHeight > 0 && lastKnownOffsetY !== null)
      ? (liveH - (storedViewportHeight + lastKnownOffsetY))
      : Infinity;
    const isBottomGapVerified = gapNumber <= 25;
    const isVerified = isBottomGapVerified && lastKnownLastMessageVisible;

    if (isVerified) {
      postScrollVerifiedConvergenceLogged = true;
      const now = global.performance ? global.performance.now() : Date.now();
      const timeToConvergence = (now - postScrollRequestedTimestamp).toFixed(1);

      console.log(
        `[POST-SCROLL-TRACE][VERIFIED BOTTOM CONVERGENCE ACHIEVED] t=+${getElapsedMs()}ms triggerSource=${triggerSource} timeSinceScrollReq=${timeToConvergence}ms requestedReason=${postScrollRequestedReason} reqH=${postScrollRequestedHeight}px finalH=${liveH}px contentHeightChanged=${postScrollContentHeightChanged} fetchOccurred=${postScrollFetchOccurred} offsetY=${lastKnownOffsetY.toFixed(1)} bottomGap=${gapNumber.toFixed(1)}px lastMessageVisible=${lastKnownLastMessageVisible}`
      );
    }
  }
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

  checkPostScrollConvergence(offsetY, liveContentH, lastKnownLastMessageVisible, "onScroll");
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

  checkPostScrollConvergence(lastKnownOffsetY, previousContentHeight, lastVisible, "onViewableItemsChanged");
}
