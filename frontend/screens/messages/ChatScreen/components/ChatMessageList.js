import React from "react";
import {
  View,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import EmptyChatState from "../../../../components/EmptyChatState";
import { mainStyles, PRIMARY_COLOR } from "../ChatScreen.styles";
import { keyExtractor, overrideItemLayout, computeEstimatedMessageHeight } from "../utils/chatListHelpers";
import {
  logInitialPosition,
  logContentSizeChange,
  logViewableItems,
  logStartupScrollEvent,
  logPostScrollFetchOlder,
  getStoredViewportHeight,
} from "../utils/startupTelemetry";

export const USE_FLATLIST_ISOLATION_TEST = false;

const ChatListHeader = React.memo(({ loadingOlder }) => (
  <View style={{ height: 48, alignItems: "center", justifyContent: "center" }}>
    {loadingOlder ? (
      <ActivityIndicator size="small" color={PRIMARY_COLOR} />
    ) : null}
  </View>
));

const ChatMessageList = React.memo((props) => {
  const {
    flashListRef,
    flatListData,
    renderItem,
    getItemType,
    loadingOlder,
    messagesLoading,
    listRevealOpacity,
    isChatInputFocused,
    containerAnimatedStyle,
    insets,
    hasMore,
    isLoadingRef,
    isScrollingRef,
    canTriggerStartReachedRef,
    isListSettledRef,
    isAtBottomRef,
    currentConversationId,
    loadOlderMessages,
    runInitialCorrectionAndReveal,
    viewabilityConfigRef,
    onViewableItemsChangedRef,
    pendingScrollToBottomRef,
  } = props;

  const listRevealStyle = useAnimatedStyle(() => ({
    opacity: listRevealOpacity ? listRevealOpacity.value : 1,
  }));

  React.useEffect(() => {
    if (flatListData && flatListData.length > 0) {
      const initIdx = flatListData.length - 1;
      logInitialPosition(flatListData, undefined, initIdx, 1000);
    }
  }, [flatListData, currentConversationId]);

  const handleViewableItemsChanged = React.useCallback(
    (info) => {
      logViewableItems(info?.viewableItems, flatListData ? flatListData.length : 0);
      if (onViewableItemsChangedRef && onViewableItemsChangedRef.current) {
        onViewableItemsChangedRef.current(info);
      }
    },
    [onViewableItemsChangedRef, flatListData],
  );

  const viewabilityConfig = React.useMemo(
    () => ({
      itemVisiblePercentThreshold: 10,
    }),
    [],
  );

  const scrollOffsetRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);

  const handleScroll = React.useCallback((e) => {
    if (e?.nativeEvent) {
      const y = e.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = y;
      logStartupScrollEvent(y, contentHeightRef.current);

      // Keep isAtBottomRef in sync with real scroll position so the
      // convergence system and useChatSocket both get an accurate signal.
      // Uses the same gap arithmetic as performFinalPositionAndReveal.
      if (isAtBottomRef) {
        const viewportH = getStoredViewportHeight() || 0;
        const gap = viewportH > 0 ? contentHeightRef.current - (viewportH + y) : Infinity;
        isAtBottomRef.current = gap <= 25;
      }
    }
  }, [isAtBottomRef]);

  const handleContentSizeChange = React.useCallback(
    (w, h) => {
      const now = performance.now();
      contentHeightRef.current = h;
      logContentSizeChange(w, h, flatListData);

      // ── Diagnostic: last-cell estimated vs actual ────────────────────────
      const lastItem = flatListData?.[flatListData.length - 1];
      if (lastItem?.data) {
        const estimated = computeEstimatedMessageHeight(lastItem.data);
        const textLen = lastItem.data.messageText?.length ?? 0;
        const listSettled = isListSettledRef?.current ?? false;
        console.log(
          `[CELL_SIZE_DIAG] t=${now.toFixed(1)}ms` +
          ` actualContentH=${h.toFixed(0)}` +
          ` lastMsgId=${lastItem.data.id}` +
          ` textLen=${textLen}` +
          ` estimatedCellH=${estimated}` +
          ` pendingScroll=${pendingScrollToBottomRef?.current ?? false}` +
          ` listSettled=${listSettled}`,
        );
      }
      // ── [SRFB_TEST] startRenderingFromBottom positioning probe ───────────
      // Reports gap on every ContentSizeChange so we can see on the very first
      // pass whether startRenderingFromBottom positioned us at the true bottom,
      // or whether the DEBOUNCE/HARD_FALLBACK fallback still needs to fire.
      {
        const viewportH = getStoredViewportHeight() || 0;
        const gap = viewportH > 0
          ? h - (viewportH + scrollOffsetRef.current)
          : null;
        console.log(
          `[SRFB_TEST] t=${now.toFixed(1)}ms` +
          ` contentH=${h.toFixed(0)}` +
          ` viewportH=${viewportH}` +
          ` scrollOffset=${scrollOffsetRef.current.toFixed(0)}` +
          ` bottomGap=${gap !== null ? gap.toFixed(1) + "px" : "unknown"}` +
          ` startRenderingFromBottom=true` +
          ` listSettled=${isListSettledRef?.current ?? false}`,
        );
      }
      // ────────────────────────────────────────────────────────────

      // ── Layout-driven scroll fallback (System A) ──────────────────────
      // CRITICAL GUARD: only consume the flag after the list has settled
      // (i.e. isListSettledRef=true, meaning the user has scrolled at least
      // once). Before settlement, the DEBOUNCE/HARD_FALLBACK convergence
      // machine (System B in ChatScreen) owns positioning. Consuming here
      // during the 3-pass oscillation window would fight System B's
      // animated:false scrollToOffset with an animated:true scrollToEnd.
      if (pendingScrollToBottomRef?.current) {
        if (isListSettledRef?.current === true) {
          pendingScrollToBottomRef.current = false;
          const flagClearTime = now;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const scrollTime = performance.now();
              const gap = h - scrollOffsetRef.current;
              console.log(
                `[SCROLL_FALLBACK] CONSUMED` +
                ` +${(scrollTime - flagClearTime).toFixed(1)}ms after onContentSizeChange` +
                ` contentH=${h.toFixed(0)}` +
                ` scrollOffset=${scrollOffsetRef.current.toFixed(0)}` +
                ` bottomGap=${gap.toFixed(0)}px` +
                ` listSettled=true`,
              );
              flashListRef.current?.scrollToEnd({ animated: true });
            });
          });
        } else {
          // List not settled yet — System B owns this. Discard silently and
          // log so we can confirm in testing that System B handled it.
          pendingScrollToBottomRef.current = false;
          console.log(
            `[SCROLL_FALLBACK] DISCARDED (listSettled=false)` +
            ` contentH=${h.toFixed(0)}` +
            ` — System B (convergence machine) owns scroll during initial load`,
          );
        }
      }
      // ────────────────────────────────────────────────────────────

      if (h > 0 && runInitialCorrectionAndReveal) {
        runInitialCorrectionAndReveal(
          h,
          "contentSizeChange",
          () => scrollOffsetRef.current,
          () => contentHeightRef.current,
        );
      }
    },
    [runInitialCorrectionAndReveal, flatListData, pendingScrollToBottomRef, flashListRef, isListSettledRef],
  );

  const flashListContentStyle = React.useMemo(
    () => [mainStyles.listContent, { paddingBottom: 12 + insets.bottom }],
    [insets.bottom],
  );

  const maintainVisibleContentPositionConfig = React.useMemo(
    () => ({
      autoscrollToBottomThreshold: 0.2,
      startRenderingFromBottom: true,
      minIndexForVisible: 1,
    }),
    [],
  );

  const initialScrollIndexValue =
    flatListData && flatListData.length > 0
      ? flatListData.length - 1
      : undefined;

  return (
    <KeyboardAvoidingView
      enabled={isChatInputFocused}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={mainStyles.keyboardView}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
        {messagesLoading ? (
          <View style={mainStyles.loadingOverlay}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          </View>
        ) : (
          <Animated.View style={[{ flex: 1 }, listRevealStyle]}>
            <FlashList
              key={currentConversationId ?? "default"}
              ref={flashListRef}
              data={flatListData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemType={getItemType}
              overrideItemLayout={(layout, item, index, maxSpan) =>
                overrideItemLayout(layout, item, index, maxSpan, flatListData ? flatListData.length : 0)
              }
              estimatedItemSize={70}
              maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
              initialScrollIndex={initialScrollIndexValue}
              ListHeaderComponent={<ChatListHeader loadingOlder={loadingOlder} />}
              extraData={loadingOlder}
              drawDistance={1000}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={flashListContentStyle}
              onScrollBeginDrag={() => {
                if (isScrollingRef) isScrollingRef.current = true;
                if (isListSettledRef) isListSettledRef.current = true;
                canTriggerStartReachedRef.current = true;
              }}
              onMomentumScrollBegin={() => {
                if (isScrollingRef) isScrollingRef.current = true;
                if (isListSettledRef) isListSettledRef.current = true;
              }}
              onMomentumScrollEnd={() => {
                if (isScrollingRef) isScrollingRef.current = false;
                canTriggerStartReachedRef.current = true;
              }}
              onScrollEndDrag={() => {
                if (isScrollingRef) isScrollingRef.current = false;
              }}
              onStartReached={() => {
                if (isListSettledRef) isListSettledRef.current = true;
                if (
                  hasMore &&
                  !isLoadingRef.current &&
                  canTriggerStartReachedRef.current
                ) {
                  logPostScrollFetchOlder("onStartReached");
                  canTriggerStartReachedRef.current = false;
                  loadOlderMessages(currentConversationId);
                }
              }}
              onScroll={handleScroll}
              onContentSizeChange={handleContentSizeChange}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                logInitialPosition(flatListData, height, initialScrollIndexValue, 1000);
              }}
              onStartReachedThreshold={0.5}
              scrollEventThrottle={16}
              ListEmptyComponent={
                !messagesLoading ? (
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                      paddingTop: 100,
                    }}
                  >
                    <EmptyChatState />
                  </View>
                ) : null
              }
              viewabilityConfig={
                viewabilityConfigRef?.current || viewabilityConfig
              }
              onViewableItemsChanged={handleViewableItemsChanged}
            />
          </Animated.View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
});

export default ChatMessageList;
