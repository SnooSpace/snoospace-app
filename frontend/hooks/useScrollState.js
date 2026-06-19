import { useRef, useCallback } from 'react';

/**
 * useScrollState
 *
 * Tracks whether the user is actively scrolling.
 * Pass the returned handlers to a FlatList/FlashList to keep
 * isScrollingRef.current accurate. Network callbacks and state
 * update schedulers can read this ref to decide whether to defer
 * an expensive re-render until after the user lifts their finger.
 *
 * Usage:
 *   const { isScrollingRef, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd } = useScrollState();
 *   <FlatList
 *     onScrollBeginDrag={onScrollBeginDrag}
 *     onScrollEndDrag={onScrollEndDrag}
 *     onMomentumScrollEnd={onMomentumScrollEnd}
 *     ...
 *   />
 */
export function useScrollState() {
  const isScrollingRef = useRef(false);

  const onScrollBeginDrag = useCallback(() => {
    isScrollingRef.current = true;
  }, []);

  const onScrollEndDrag = useCallback(() => {
    // onScrollEndDrag fires when finger lifts — momentum may still continue,
    // but user intent to stop has been registered. We reset here and also
    // in onMomentumScrollEnd to cover both cases.
    isScrollingRef.current = false;
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    isScrollingRef.current = false;
  }, []);

  return {
    isScrollingRef,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}
