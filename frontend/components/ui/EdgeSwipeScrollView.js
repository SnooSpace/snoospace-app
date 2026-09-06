import React, { useRef, useCallback } from "react";
import { ScrollView } from "react-native-gesture-handler";
import EventBus from "../../utils/EventBus";
import HapticsService from "../../services/HapticsService";

/**
 * EdgeSwipeScrollView
 * 
 * Uses react-native-gesture-handler's ScrollView with `disallowInterruption={true}`
 * so parent Pan gestures (SwipeablePagerNavigator) NEVER interrupt or steal touches
 * while the user is browsing/scrolling items in the row.
 * 
 * Only when a row's end is reached AND the user continues swiping past that end
 * (i.e. swiping right at the leftmost edge, or swiping left at the rightmost edge),
 * it triggers a smooth tab navigation transition via `navigate-tab-delta`.
 */
const EdgeSwipeScrollView = React.forwardRef(({
  children,
  onScroll,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onScrollBeginDrag,
  onScrollEndDrag,
  onMomentumScrollEnd,
  scrollEventThrottle = 16,
  ...props
}, ref) => {
  const scrollXRef = useRef(0);
  const contentWidthRef = useRef(0);
  const layoutWidthRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const startScrollXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    isDraggingRef.current = true;
    hasNavigatedRef.current = false;
    const { pageX, pageY } = e.nativeEvent;
    touchStartXRef.current = pageX;
    touchStartYRef.current = pageY;
    startScrollXRef.current = scrollXRef.current;

    // Immediately disable parent tab swipe so this row has full priority
    EventBus.emit("disable-tab-swipe");

    onTouchStart?.(e);
  }, [onTouchStart]);

  const handleScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollXRef.current = contentOffset.x;
    contentWidthRef.current = contentSize.width;
    layoutWidthRef.current = layoutMeasurement.width;

    onScroll?.(e);
  }, [onScroll]);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current || hasNavigatedRef.current) {
      onTouchMove?.(e);
      return;
    }

    const { pageX, pageY } = e.nativeEvent;
    const deltaX = pageX - touchStartXRef.current;
    const deltaY = pageY - touchStartYRef.current;

    // Only process if horizontal intent is clear and has passed initial slop
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && Math.abs(deltaX) > 40) {
      const maxScroll = Math.max(0, contentWidthRef.current - layoutWidthRef.current);
      const currentX = scrollXRef.current;
      const startX = startScrollXRef.current;

      // 1. Left boundary reached and user is swiping right (wants previous tab)
      if ((startX <= 4 || currentX <= 2) && deltaX > 45) {
        hasNavigatedRef.current = true;
        HapticsService.triggerImpactLight();
        EventBus.emit("navigate-tab-delta", -1);
      }
      // 2. Right boundary reached and user is swiping left (wants next tab)
      else if ((startX >= maxScroll - 4 || currentX >= maxScroll - 2) && deltaX < -45) {
        hasNavigatedRef.current = true;
        HapticsService.triggerImpactLight();
        EventBus.emit("navigate-tab-delta", 1);
      }
    }

    onTouchMove?.(e);
  }, [onTouchMove]);

  const handleTouchEnd = useCallback((e) => {
    isDraggingRef.current = false;
    hasNavigatedRef.current = false;
    EventBus.emit("enable-tab-swipe");

    onTouchEnd?.(e);
  }, [onTouchEnd]);

  const handleTouchCancel = useCallback((e) => {
    isDraggingRef.current = false;
    hasNavigatedRef.current = false;
    EventBus.emit("enable-tab-swipe");

    onTouchCancel?.(e);
  }, [onTouchCancel]);

  const handleScrollBeginDrag = useCallback((e) => {
    EventBus.emit("disable-tab-swipe");
    onScrollBeginDrag?.(e);
  }, [onScrollBeginDrag]);

  const handleScrollEndDrag = useCallback((e) => {
    EventBus.emit("enable-tab-swipe");
    onScrollEndDrag?.(e);
  }, [onScrollEndDrag]);

  const handleMomentumScrollEnd = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollXRef.current = contentOffset.x;
    contentWidthRef.current = contentSize.width;
    layoutWidthRef.current = layoutMeasurement.width;

    EventBus.emit("enable-tab-swipe");
    onMomentumScrollEnd?.(e);
  }, [onMomentumScrollEnd]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      disallowInterruption={true}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      {...props}
    >
      {children}
    </ScrollView>
  );
});

EdgeSwipeScrollView.displayName = "EdgeSwipeScrollView";

export default EdgeSwipeScrollView;
