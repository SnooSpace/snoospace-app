import React from "react";
import { View, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated from "react-native-reanimated";
import EmptyChatState from "../../../../components/EmptyChatState";
import { mainStyles, PRIMARY_COLOR } from "../ChatScreen.styles";
import {
  keyExtractor,
  overrideItemLayout,
} from "../utils/chatListHelpers";

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
    currentConversationId,
    loadOlderMessages,
    runInitialCorrectionAndReveal,
    viewabilityConfigRef,
    onViewableItemsChangedRef,
  }) => {
    const visibleItemsRef = React.useRef([]);
    const frozenBeforeSnapshotRef = React.useRef(null);

    React.useEffect(() => {
      console.log("[FLASHLIST-LIFECYCLE] ChatMessageList MOUNTED ✅");
      return () => console.log("[FLASHLIST-LIFECYCLE] ChatMessageList UNMOUNTED 🔴");
    }, []);

    const prevRenderItemRef = React.useRef(renderItem);
    React.useEffect(() => {
      const isSame = prevRenderItemRef.current === renderItem;
      console.log(
        `[RENDERITEM-DIAG] Is renderItem identity stable (===)?: ${isSame ? "SAME ✅" : "CHANGED 🔴"}`,
      );
      prevRenderItemRef.current = renderItem;
    }, [renderItem]);

    React.useEffect(() => {
      global.__PAGINATION_AUDIT_CALLBACK__ = (prependedCount) => {
        console.log("[AUDIT] __PAGINATION_AUDIT_CALLBACK__ invoked.");
        const before = frozenBeforeSnapshotRef.current;
        console.log("[AUDIT] Captured frozen snapshot in callback closure:", before);

        if (!before) {
          console.log("[AUDIT] No frozen BEFORE snapshot found in ref!");
          return;
        }

        const runAuditCheck = (label) => {
          const currentViewable = visibleItemsRef.current || [];
          const topItemAfter =
            currentViewable.length > 0 ? currentViewable[0] : null;
          const topIdAfter =
            topItemAfter?.item?.data?.id || topItemAfter?.item?.id || "unknown";
          const topIndexAfter = topItemAfter?.index ?? -1;
          const topItemTypeAfter = topItemAfter?.item?.type || "unknown";

          const targetMsgAfter = flatListData?.find(
            (it) => String(it.data?.id) === String(before.beforeId),
          )?.data;

          const wasVisibleItemStillVisible = currentViewable.some(
            (v) => String(v.item?.data?.id || v.item?.id) === String(before.beforeId),
          );
          const isAnchoredToNewItem =
            topIndexAfter >= 0 && topIndexAfter < prependedCount;

          const isSameMsgObject =
            before.beforeMsgData && targetMsgAfter
              ? before.beforeMsgData === targetMsgAfter
              : false;

          const afterOffset = scrollOffsetRef.current;
          const afterHeight = contentHeightRef.current;
          const expectedOffsetDelta = afterHeight - before.beforeHeight;
          const actualOffsetDelta = afterOffset - before.beforeOffset;

          console.log(`[PAGINATION-AUDIT-${label}] ========================================`);
          console.log(`[PAGINATION-AUDIT-${label}] POST-PREPEND AUDIT (${label}):`);
          console.log(`  BEFORE: topId=${before.beforeId}, index=${before.beforeIndex}, offset=${before.beforeOffset.toFixed(1)}px, contentHeight=${before.beforeHeight.toFixed(1)}px`);
          console.log(`  AFTER:  topId=${topIdAfter} (type: ${topItemTypeAfter}), index=${topIndexAfter}, offset=${afterOffset.toFixed(1)}px, contentHeight=${afterHeight.toFixed(1)}px`);
          console.log(`  EXPECTED offset delta (newH - oldH): ${expectedOffsetDelta.toFixed(1)}px`);
          console.log(`  ACTUAL offset delta (newOffset - oldOffset): ${actualOffsetDelta.toFixed(1)}px`);
          console.log(`  ANCHOR PRESERVED?: ${wasVisibleItemStillVisible ? "YES ✅" : "NO ❌"} (anchored to prepended item?: ${isAnchoredToNewItem})`);
          console.log(`  ANCHOR OBJECT JS REF (===): ${isSameMsgObject}`);
          console.log(`[PAGINATION-AUDIT-${label}] ========================================`);
        };

        requestAnimationFrame(() => {
          console.log("[AUDIT] RAF timer fired");
          runAuditCheck("RAF");
        });
        setTimeout(() => {
          console.log("[AUDIT] T50 timer fired");
          runAuditCheck("T50");
        }, 50);
        setTimeout(() => {
          console.log("[AUDIT] T150 timer fired");
          runAuditCheck("T150");
        }, 150);
        setTimeout(() => {
          console.log("[AUDIT] T300 timer fired");
          runAuditCheck("T300");
        }, 300);
      };

      return () => {
        delete global.__PAGINATION_AUDIT_CALLBACK__;
      };
    }, [flatListData]);

    const handleViewableItemsChanged = React.useCallback(
      (info) => {
        visibleItemsRef.current = info.viewableItems;
        const firstVisible = info.viewableItems && info.viewableItems.length > 0 ? info.viewableItems[0] : null;
        const firstId = firstVisible?.item?.data?.id || firstVisible?.item?.id || "none";
        console.log(`[LIFECYCLE-TIMELINE] onViewableItemsChanged fired — count=${info.viewableItems.length}, topId=${firstId}, topIndex=${firstVisible?.index}`);

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

    /*
    const maintainVisibleContentPositionConfig = React.useMemo(
      () => ({
        autoscrollToBottomThreshold: 0.2,
        minIndexForVisible: 1,
      }),
      [],
    );
    */

    const scrollOffsetRef = React.useRef(0);
    const contentHeightRef = React.useRef(0);
    const handleScroll = React.useCallback((e) => {
      if (e?.nativeEvent?.contentOffset?.y !== undefined) {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }
    }, []);

    const handleContentSizeChange = React.useCallback((w, h) => {
      contentHeightRef.current = h;
    }, []);

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
              {console.log(
                `[DATA-ORDER-CHECK] total=${flatListData?.length}, headIds=[${flatListData?.slice(0, 3).map((m) => m.data?.id).join(",")}] ... tailIds=[${flatListData?.slice(-3).map((m) => m.data?.id).join(",")}]`,
              )}
              {console.log(
                `[COMPOSER-INSET-DIAG] paddingBottom=${12 + insets.bottom}px, insets.bottom=${insets.bottom}px`,
              )}
              <FlashList
                ref={flashListRef}
                data={flatListData}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemType={getItemType}
                overrideItemLayout={undefined}
                ListHeaderComponent={renderListHeader}
                drawDistance={250}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  mainStyles.listContent,
                  { paddingBottom: 12 + insets.bottom },
                ]}
                maintainVisibleContentPosition={undefined}
                onScrollBeginDrag={() => {
                  if (isScrollingRef) isScrollingRef.current = true;
                  canTriggerStartReachedRef.current = true;
                }}
                onMomentumScrollBegin={() => {
                  if (isScrollingRef) isScrollingRef.current = true;
                }}
                onMomentumScrollEnd={() => {
                  if (isScrollingRef) isScrollingRef.current = false;
                  canTriggerStartReachedRef.current = true;
                }}
                onScrollEndDrag={() => {
                  if (isScrollingRef) isScrollingRef.current = false;
                }}
                onStartReached={() => {
                  if (
                    hasMore &&
                    !isLoadingRef.current &&
                    canTriggerStartReachedRef.current
                  ) {
                    canTriggerStartReachedRef.current = false;
                    const topItemBefore =
                      visibleItemsRef.current && visibleItemsRef.current.length > 0
                        ? visibleItemsRef.current[0]
                        : null;
                    const beforeId =
                      topItemBefore?.item?.data?.id || topItemBefore?.item?.id || "unknown";
                    const beforeIndex = topItemBefore?.index ?? -1;
                    const beforeType = topItemBefore?.item?.type || "unknown";
                    const beforeOffset = scrollOffsetRef.current;
                    const beforeHeight = contentHeightRef.current;

                    const beforeMsgData = topItemBefore?.item?.data;
                    const frozenBeforeSnapshot = Object.freeze({
                      beforeId,
                      beforeIndex,
                      beforeType,
                      beforeMsgData,
                      beforeOffset,
                      beforeHeight,
                    });
                    frozenBeforeSnapshotRef.current = frozenBeforeSnapshot;
                    console.log(`[PAGINATION-AUDIT-TRIGGER] Frozen BEFORE Snapshot captured: topId=${beforeId}, index=${beforeIndex}, offset=${beforeOffset.toFixed(1)}px, contentHeight=${beforeHeight.toFixed(1)}px`);
                    loadOlderMessages(currentConversationId);
                  }
                }}
                onScroll={handleScroll}
                onContentSizeChange={handleContentSizeChange}
                onStartReachedThreshold={0.5}
                scrollEventThrottle={16}
                onLayout={() => {
                  runInitialCorrectionAndReveal();
                }}
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
