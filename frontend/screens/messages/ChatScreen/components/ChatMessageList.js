import React from "react";
import { View, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated from "react-native-reanimated";
import EmptyChatState from "../../../../components/EmptyChatState";
import { mainStyles, PRIMARY_COLOR } from "../ChatScreen.styles";
import { keyExtractor, overrideItemLayout, prependMetrics, contentHeightAuditTracker } from "../utils/chatListHelpers";

export const longMsgTracer = {
  scrollY: 0,
  viewportHeight: 800,
  logEvent(stage, details) {
    const t = performance.now().toFixed(2);
    console.log(`[PHASE2-TIMELINE][t=${t}ms][Y=${Math.round(this.scrollY)}] ${stage} | ${details}`);
  },
};

const ChatMessageList = React.memo(
  ({
    flashListRef,
    flatListData,
    renderItem,
    getItemType,
    renderListHeader,
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
    currentConversationId,
    loadOlderMessages,
    runInitialCorrectionAndReveal,
    viewabilityConfigRef,
    onViewableItemsChangedRef,
  }) => {
    const handleViewableItemsChanged = React.useCallback(
      (info) => {
        if (onViewableItemsChangedRef && onViewableItemsChangedRef.current) {
          onViewableItemsChangedRef.current(info);
        }
      },
      [onViewableItemsChangedRef],
    );

    const viewabilityConfig = React.useMemo(
      () => ({
        itemVisiblePercentThreshold: 10,
      }),
      [],
    );

    const maintainVisibleContentPositionConfig = React.useMemo(
      () => ({
        autoscrollToBottomThreshold: 0.2,
        minIndexForVisible: 1,
        startRenderingFromBottom: true,
      }),
      [],
    );

    const scrollOffsetRef = React.useRef(0);
    const contentHeightRef = React.useRef(0);
    const lastScrollTimeRef = React.useRef(Date.now());
    const handleScroll = React.useCallback((e) => {
      if (e?.nativeEvent) {
        const y = e.nativeEvent.contentOffset.y;
        scrollOffsetRef.current = y;
        longMsgTracer.scrollY = y;
        if (e.nativeEvent.layoutMeasurement?.height) {
          longMsgTracer.viewportHeight = e.nativeEvent.layoutMeasurement.height;
        }

        const now = Date.now();
        const delta = now - lastScrollTimeRef.current;
        lastScrollTimeRef.current = now;
        if (delta > 32) {
          longMsgTracer.logEvent(
            "STEP 6: Scroll Frame Lag",
            `gap=${delta}ms | Y=${Math.round(y)}`,
          );
        }
      }
    }, []);

    const handleContentSizeChange = React.useCallback(
      (w, h) => {
        contentHeightAuditTracker.logContentSizeChange(h);
        if (contentHeightRef.current > 0 && Math.abs(h - contentHeightRef.current) > 20) {
          longMsgTracer.logEvent(
            "STEP 5: ContentSizeChange",
            `h:${contentHeightRef.current}px -> ${h}px (delta: ${h - contentHeightRef.current}px)`,
          );
        }
        contentHeightRef.current = h;
        if (prependMetrics.active) {
          if (!prependMetrics.tFirstContentSizeChange) {
            prependMetrics.tFirstContentSizeChange = performance.now();
          }
          prependMetrics.recordContentHeightEvent(h);
        }
        if (h > 0 && runInitialCorrectionAndReveal) {
          runInitialCorrectionAndReveal(h, "contentSizeChange");
        }
      },
      [runInitialCorrectionAndReveal],
    );

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
            <Animated.View
              style={[{ flex: 1 }, { opacity: listRevealOpacity }]}
            >
              <FlashList
                ref={flashListRef}
                data={flatListData}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemType={getItemType}
                overrideItemLayout={overrideItemLayout}
                estimatedItemSize={70}
                ListHeaderComponent={renderListHeader}
                drawDistance={1200}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  mainStyles.listContent,
                  { paddingBottom: 12 + insets.bottom },
                ]}
                maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
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
                  if (prependMetrics.active) prependMetrics.scheduleDump();
                }}
                onScrollEndDrag={() => {
                  if (isScrollingRef) isScrollingRef.current = false;
                  if (prependMetrics.active) prependMetrics.scheduleDump();
                }}
                onStartReached={() => {
                  if (isListSettledRef) isListSettledRef.current = true;
                  if (
                    hasMore &&
                    !isLoadingRef.current &&
                    canTriggerStartReachedRef.current
                  ) {
                    canTriggerStartReachedRef.current = false;
                    loadOlderMessages(currentConversationId);
                  }
                }}
                onBlankArea={(blankAreaEvent) => {
                  if (blankAreaEvent.blankArea > 0 && prependMetrics.active) {
                    if (!prependMetrics.tBlankStart) {
                      prependMetrics.tBlankStart = performance.now();
                    }
                    prependMetrics.blankEventsCount++;
                    prependMetrics.tBlankEnd = performance.now();
                    prependMetrics.blankDurationMs =
                      prependMetrics.tBlankEnd - prependMetrics.tBlankStart;
                  }
                }}
                onScroll={handleScroll}
                onContentSizeChange={handleContentSizeChange}
                onStartReachedThreshold={0.5}
                scrollEventThrottle={16}
                ListEmptyComponent={
                  !messagesLoading ? (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: 200,
                      }}
                    >
                      <EmptyChatState
                        onLayout={() => {
                          listRevealOpacity.value = 1;
                        }}
                      />
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
  },
);

export default ChatMessageList;
