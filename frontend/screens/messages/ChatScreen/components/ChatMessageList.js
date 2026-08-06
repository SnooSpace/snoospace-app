import React from "react";
import {
  View,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Animated from "react-native-reanimated";
import EmptyChatState from "../../../../components/EmptyChatState";
import { mainStyles, PRIMARY_COLOR } from "../ChatScreen.styles";
import { keyExtractor, overrideItemLayout } from "../utils/chatListHelpers";

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
  } = props;

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

  const scrollOffsetRef = React.useRef(0);
  const contentHeightRef = React.useRef(0);

  const handleScroll = React.useCallback((e) => {
    if (e?.nativeEvent) {
      scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    }
  }, []);

  const handleContentSizeChange = React.useCallback(
    (w, h) => {
      contentHeightRef.current = h;
      if (h > 0 && runInitialCorrectionAndReveal) {
        runInitialCorrectionAndReveal(h, "contentSizeChange");
      }
    },
    [runInitialCorrectionAndReveal],
  );

  const flashListContentStyle = React.useMemo(
    () => [mainStyles.listContent, { paddingBottom: 12 + insets.bottom }],
    [insets.bottom],
  );

  const maintainVisibleContentPositionConfig = React.useMemo(
    () => ({
      autoscrollToBottomThreshold: 0,
      minIndexForVisible: 1,
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
          <Animated.View style={{ flex: 1 }}>
            <FlashList
              ref={flashListRef}
              data={flatListData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemType={getItemType}
              overrideItemLayout={overrideItemLayout}
              estimatedItemSize={70}
              maintainVisibleContentPosition={maintainVisibleContentPositionConfig}
              initialScrollIndex={
                flatListData && flatListData.length > 0
                  ? flatListData.length - 1
                  : undefined
              }
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
                  canTriggerStartReachedRef.current = false;
                  loadOlderMessages(currentConversationId);
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
