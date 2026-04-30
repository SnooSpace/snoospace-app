import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, { runOnJS } from 'react-native-reanimated';

// Define the order of bottom tabs
const TABS = ["Home", "Search", "Discover", "YourEvents", "Profile"];

export default function TabSwipeHandler({ children, currentTab }) {
  const navigation = useNavigation();

  const handleSwipe = (direction) => {
    const currentIndex = TABS.indexOf(currentTab);
    if (currentIndex === -1) return;

    if (direction === 'left') {
      // Swipe left means moving finger to the left -> going to the NEXT tab
      if (currentIndex < TABS.length - 1) {
        navigation.navigate(TABS[currentIndex + 1]);
      }
    } else if (direction === 'right') {
      // Swipe right means moving finger to the right -> going to the PREVIOUS tab
      if (currentIndex > 0) {
        navigation.navigate(TABS[currentIndex - 1]);
      }
    }
  };

  const pan = Gesture.Pan()
    // Require a significant horizontal movement (40px) before activating.
    // This allows child ScrollViews and FlatLists (like Carousels) to consume the gesture first.
    // If the carousel is at the edge and cannot consume the gesture, this handler will eventually activate.
    .activeOffsetX([-50, 50])
    // If the user scrolls vertically more than 20px, cancel this horizontal swipe gesture
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      // Once ended, check if the velocity or translation was enough to trigger a tab switch
      const { translationX, velocityX } = event;
      
      const isFast = Math.abs(velocityX) > 400;
      const isFar = Math.abs(translationX) > Dimensions.get('window').width * 0.2;

      if (isFast || isFar) {
        if (translationX < 0) {
          runOnJS(handleSwipe)('left');
        } else {
          runOnJS(handleSwipe)('right');
        }
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{ flex: 1 }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
