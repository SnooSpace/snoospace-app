import React from "react";
import { View, Dimensions } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";

// Define the default order of bottom tabs (Member)
const DEFAULT_TABS = ["Home", "Search", "Discover", "YourEvents", "Profile"];
const SWIPE_THRESHOLD = Dimensions.get("window").width * 0.2;

export default function TabSwipeHandler({
  children,
  currentTab,
  tabs = DEFAULT_TABS,
}) {
  const navigation = useNavigation();

  const handleSwipe = (direction) => {
    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    if (direction === "left") {
      // Swipe left means moving finger to the left -> going to the NEXT tab
      if (currentIndex < tabs.length - 1) {
        navigation.navigate(tabs[currentIndex + 1]);
      }
    } else if (direction === "right") {
      // Swipe right means moving finger to the right -> going to the PREVIOUS tab
      if (currentIndex > 0) {
        navigation.navigate(tabs[currentIndex - 1]);
      }
    }
  };

  const pan = Gesture.Pan()
    .hitSlop({ left: 40 })
    // Require a significant horizontal movement (40px) before activating.
    // This allows child ScrollViews and FlatLists (like Carousels) to consume the gesture first.
    // Require a very clear, deliberate horizontal movement (e.g., 100px) before activating.
    // This allows child ScrollViews and FlatLists (like Carousels and the main Feed) to scroll easily.
    .activeOffsetX([-100, 100])
    // If the user scrolls vertically even slightly (15px), cancel this horizontal swipe gesture
    // This prevents diagonal scrolling from accidentally triggering a tab switch.
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onEnd((event) => {
      // Once ended, check if the velocity or translation was enough to trigger a tab switch
      const { translationX, velocityX } = event;

      const isFast = Math.abs(velocityX) > 400;
      const isFar = Math.abs(translationX) > SWIPE_THRESHOLD;

      if (isFast || isFar) {
        if (translationX < 0) {
          handleSwipe("left");
        } else {
          handleSwipe("right");
        }
      }
    });

  return (
    <GestureDetector gesture={pan}>
      {/* Use plain View — NOT Reanimated Animated.View.
          Animated.View inside a GestureDetector interacts with @react-navigation/stack's
          back gesture evaluator, causing a transient translateX on the pager page
          (visible as a leftward drift + grey strip during back navigation). */}
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}
