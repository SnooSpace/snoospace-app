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
    const auditPrependRef = React.useRef(null);

    React.useEffect(() => {
      global.__PAGINATION_AUDIT_CALLBACK__ = (auditBefore, prependedCount) => {
        auditPrependRef.current = {
          beforeId: auditBefore.beforeId,
          beforeIndex: auditBefore.beforeIndex,
          prependedCount,
        };
      };
      return () => {
        delete global.__PAGINATION_AUDIT_CALLBACK__;
      };
    }, []);

    const handleViewableItemsChanged = React.useCallback(
      (info) => {
        visibleItemsRef.current = info.viewableItems;
        if (onViewableItemsChangedRef && onViewableItemsChangedRef.current) {
          onViewableItemsChangedRef.current(info);
        }
        if (auditPrependRef.current) {
          const audit = auditPrependRef.current;
          auditPrependRef.current = null;
          const topItemAfter =
            info.viewableItems && info.viewableItems.length > 0
              ? info.viewableItems[0]
              : null;
          const topIdAfter =
            topItemAfter?.item?.data?.id || topItemAfter?.item?.id || "unknown";
          const topIndexAfter = topItemAfter?.index ?? -1;

          const topItemTypeAfter = topItemAfter?.item?.type || "unknown";
          const wasVisibleItemStillVisible = info.viewableItems?.some(
            (v) => (v.item?.data?.id || v.item?.id) === audit.beforeId,
          );
          const isAnchoredToNewItem =
            topIndexAfter >= 0 && topIndexAfter < audit.prependedCount;

          console.log(`[PAGINATION-AUDIT-RESULT] ========================================`);
          console.log(`[PAGINATION-AUDIT-RESULT] 1. First visible item ID BEFORE prepend: ${audit.beforeId} (type: ${audit.beforeType})`);
          console.log(`[PAGINATION-AUDIT-RESULT] 2. First visible item index BEFORE prepend: ${audit.beforeIndex}`);
          console.log(`[PAGINATION-AUDIT-RESULT] 3. Number of prepended items: ${audit.prependedCount}`);
          console.log(`[PAGINATION-AUDIT-RESULT] 4. First visible item ID AFTER prepend: ${topIdAfter} (type: ${topItemTypeAfter})`);
          console.log(`[PAGINATION-AUDIT-RESULT] 5. First visible item index AFTER prepend: ${topIndexAfter}`);
          console.log(`[PAGINATION-AUDIT-RESULT] 6. Previously visible message STILL visible?: ${wasVisibleItemStillVisible}`);
          console.log(`[PAGINATION-AUDIT-RESULT] 7. FlashList anchored to item type: ${topItemTypeAfter} at index: ${topIndexAfter} (${topIdAfter})`);
          console.log(`[PAGINATION-AUDIT-RESULT] 8. Anchored to NEWLY PREPENDED item (index < ${audit.prependedCount})?: ${isAnchoredToNewItem}`);
          console.log(`[PAGINATION-AUDIT-RESULT] ========================================`);
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
                ListHeaderComponent={renderListHeader}
                drawDistance={250}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  mainStyles.listContent,
                  { paddingBottom: 12 + insets.bottom },
                ]}
                maintainVisibleContentPosition={{
                  autoscrollToBottomThreshold: 0.2,
                  minIndexForVisible: 1,
                  startRenderingFromBottom: true,
                }}
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

                    global.__PAGINATION_AUDIT_BEFORE__ = {
                      beforeId,
                      beforeIndex,
                      beforeType,
                    };
                    console.log(`[PAGINATION-AUDIT-TRIGGER] StartReached triggered. Top visible item BEFORE: id=${beforeId}, index=${beforeIndex}`);
                    loadOlderMessages(currentConversationId);
                  }
                }}
                onScroll={() => {}}
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
