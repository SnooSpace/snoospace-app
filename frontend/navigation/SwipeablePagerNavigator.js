import React, { useState, useEffect } from 'react';
import { View, Dimensions, StyleSheet, Platform, Pressable } from 'react-native';
import { useNavigationBuilder, createNavigatorFactory, CommonActions } from '@react-navigation/native';
import { TabRouter } from '@react-navigation/routers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  useAnimatedRef,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { House, Search, Compass, Calendar, LayoutGrid, Inbox } from 'lucide-react-native';

import ProfileTabIcon from '../components/ProfileTabIcon';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import EventBus from '../utils/EventBus';
import { getAllAccounts, getActiveAccount, switchAccount } from '../api/auth';
import hapticsService from '../services/HapticsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------- TAB BAR ----------------
const ProfileTabButton = ({ index, onTabPress, children, style, navigation }) => {
  const navigateToProfile = () => {
    onTabPress(index);
  };

  const cycleNextAccount = async () => {
    try {
      const allAccounts = await getAllAccounts();
      const loggedInAccounts = allAccounts.filter(a => a.isLoggedIn !== false && a.authToken);
      
      if (loggedInAccounts.length <= 1) {
        navigateToProfile();
        return;
      }

      hapticsService.triggerImpactLight();

      const activeAccount = await getActiveAccount();
      const activeCompositeId = activeAccount ? `${activeAccount.type}_${activeAccount.id}` : null;

      let currentIndex = loggedInAccounts.findIndex(
        (acc) => `${acc.type}_${acc.id}` === activeCompositeId
      );

      if (currentIndex === -1) currentIndex = 0;

      const nextAccount = loggedInAccounts[(currentIndex + 1) % loggedInAccounts.length];
      const nextCompositeId = `${nextAccount.type}_${nextAccount.id}`;

      console.log(`[DoubleTapCycle] Switching to ${nextCompositeId}`);
      await switchAccount(nextCompositeId);

      const routeName =
        nextAccount.type === "member" ? "MemberHome" :
        nextAccount.type === "community" ? "CommunityHome" :
        nextAccount.type === "sponsor" ? "SponsorHome" :
        nextAccount.type === "venue" ? "VenueHome" : "Landing";

      let rootNav = navigation;
      while (rootNav.getParent && rootNav.getParent()) {
        rootNav = rootNav.getParent();
      }

      rootNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: routeName }],
        })
      );
    } catch (error) {
      console.error("[DoubleTapCycle] Error cycling account:", error);
      navigateToProfile(); // Fallback
    }
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd(() => {
      runOnJS(cycleNextAccount)();
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDelay(250)
    .onEnd(() => {
      runOnJS(navigateToProfile)();
    });

  const gesture = Gesture.Exclusive(doubleTap, singleTap);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const AnimatedTabBar = ({ state, onTabPress, translateX, insets, role, navigation }) => {
  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Platform.OS === "ios" ? Math.max(20, insets.bottom) : 10 }]}>
      {Platform.OS === "ios" ? (
        <View style={StyleSheet.absoluteFill}>
          <BlurView tint="systemChromeMaterialLight" intensity={100} style={StyleSheet.absoluteFill} />
          <View style={styles.iosDivider} />
        </View>
      ) : (
        <View style={styles.androidBackground}>
          <View style={styles.androidDivider} />
        </View>
      )}

      <View style={styles.tabBarContent}>
        {state.routes.map((route, index) => {
          let IconComponent;
          if (route.name === "Home") IconComponent = House;
          else if (route.name === "Search") IconComponent = Search;
          else if (route.name === "Discover") IconComponent = Compass;
          else if (route.name === "YourEvents") IconComponent = Calendar;
          else if (route.name === "Dashboard") IconComponent = LayoutGrid;
          else if (route.name === "Requests") IconComponent = Inbox;

          const inputRange = [
            -(index + 1) * SCREEN_WIDTH,
            -index * SCREEN_WIDTH,
            -(index - 1) * SCREEN_WIDTH,
          ];

          const iconStyle = useAnimatedStyle(() => {
            const scale = interpolate(translateX.value, inputRange, [1, 1.2, 1], Extrapolation.CLAMP);
            const translateY = interpolate(translateX.value, inputRange, [0, -4, 0], Extrapolation.CLAMP);
            return {
              transform: [{ scale }, { translateY }],
            };
          });

          const activeOpacityStyle = useAnimatedStyle(() => {
            const opacity = interpolate(translateX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
            return { opacity, position: 'absolute' };
          });

          const inactiveOpacityStyle = useAnimatedStyle(() => {
            const opacity = interpolate(translateX.value, inputRange, [1, 0, 1], Extrapolation.CLAMP);
            return { opacity };
          });

          if (route.name === "Profile") {
            return (
              <ProfileTabButton key={route.key} index={index} onTabPress={onTabPress} style={styles.tabButton} navigation={navigation}>
                <Animated.View style={iconStyle}>
                  {/* Inactive Icon Layer */}
                  <Animated.View style={inactiveOpacityStyle}>
                    <ProfileTabIcon focused={false} color="#999999" userType={role} />
                  </Animated.View>

                  {/* Active Icon Layer (Cross-fades on top) */}
                  <Animated.View style={activeOpacityStyle}>
                    <ProfileTabIcon focused={true} color="#3565F2" userType={role} />
                  </Animated.View>
                </Animated.View>
              </ProfileTabButton>
            );
          }

          return (
            <Pressable key={route.key} onPress={() => onTabPress(index)} style={styles.tabButton}>
              <Animated.View style={iconStyle}>
                {/* Inactive Icon Layer */}
                <Animated.View style={inactiveOpacityStyle}>
                  <IconComponent size={26} color="#999999" fill="transparent" strokeWidth={2.2} />
                </Animated.View>

                {/* Active Icon Layer (Cross-fades on top) */}
                <Animated.View style={activeOpacityStyle}>
                  <IconComponent size={26} color="#3565F2" fill="rgba(53, 101, 242, 0.15)" strokeWidth={2.5} />
                </Animated.View>
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};


// ---------------- MAIN NAVIGATOR ----------------
function SwipeablePagerNavigator({ initialRouteName, children, screenOptions, role = "member" }) {

  const { state, navigation, descriptors } = useNavigationBuilder(TabRouter, {
    initialRouteName,
    children,
    screenOptions,
  });

  const insets = useSafeAreaInsets();

  // ---------------- SHARED VALUES ----------------
  const translateX = useSharedValue(-state.index * SCREEN_WIDTH);
  const currentIndex = useSharedValue(state.index);

  // ---------------- LOAD SCREENS ----------------
  const [loaded, setLoaded] = useState([]);

  useEffect(() => {
    setLoaded(prev => {
      const next = [...prev];
      if (!next.includes(state.index)) next.push(state.index);
      if (state.index > 0 && !next.includes(state.index - 1)) next.push(state.index - 1);
      if (state.index < state.routes.length - 1 && !next.includes(state.index + 1)) next.push(state.index + 1);
      return next;
    });
  }, [state.index]);

  const scrollViewRef = useAnimatedRef();

  // ⚠️  INTENTIONALLY NO useEffect syncing state.index → scrollTo.
  //  That pattern caused a double-scroll race: tab press called scrollTo,
  //  then navigation changed state.index, which fired the effect and called
  //  scrollTo AGAIN — fighting the first scroll and causing glitches.
  //  Instead, tab press is the ONLY initiator of scrollTo; navigation
  //  state is updated only AFTER the scroll settles (see handleSnap).

  // ---------------- SNAP HANDLER ----------------
  // Called on the JS thread once the scroll view has fully settled.
  const handleSnap = (index) => {
    if (state.routes && state.routes[index]) {
      navigation.navigate(state.routes[index].name);
    }
  };

  // ---------------- TAB PRESS ----------------
  // Only drives the scroll view. Navigation (handleSnap) fires automatically
  // once onMomentumEnd / onScrollEndDrag detects the final resting position.
  const handleTabPress = (index) => {
    // Guard: already on this tab
    if (currentIndex.value === index) return;
    currentIndex.value = index;

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    }
    // ❌ Do NOT call navigation.navigate here.
    //    Doing so changes state.index immediately, which would cause any
    //    state.index-watching useEffect to fire another scrollTo, racing
    //    with the one above.  Let onMomentumEnd / onScrollEndDrag do it.
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      // Keep translateX in sync so tab bar animates while dragging
      translateX.value = -e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      // Fired after a SWIPE settles (native momentum)
      const index = Math.round(e.contentOffset.x / SCREEN_WIDTH);
      currentIndex.value = index;
      runOnJS(handleSnap)(index);
    },
    onScrollEndDrag: (e) => {
      // Fired after a PROGRAMMATIC scrollTo (animated:true) or a drag-with-
      // no-momentum also ends here.  This catches tab-press animated scrolls
      // that don't generate a momentum phase.
      const index = Math.round(e.contentOffset.x / SCREEN_WIDTH);
      // Only update if this looks like it has actually snapped to a page
      // boundary (i.e. the scroll ended exactly on a page, not mid-drag).
      const offset = e.contentOffset.x % SCREEN_WIDTH;
      const snapped = offset < 2 || offset > SCREEN_WIDTH - 2;
      if (snapped) {
        currentIndex.value = index;
        runOnJS(handleSnap)(index);
      }
    },
  });

  // ---------------- RENDER ----------------
  const currentRoute = state.routes[state.index];
  const currentDescriptor = descriptors[currentRoute.key];
  const shouldHideTabBar = currentDescriptor.options.tabBarStyle?.display === 'none';

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        scrollEnabled={!shouldHideTabBar}
        style={styles.pager}
        // directionalLockEnabled tells iOS to commit to ONE axis per gesture.
        // When a nested carousel is scrolling horizontally, iOS automatically
        // decides that scroll belongs to the inner view, preventing the pager
        // from stealing it.  On Android, nestedScrollEnabled on the child
        // ScrollView does the equivalent job.
        directionalLockEnabled={true}
        // disableScrollViewPanResponder prevents RN's JS-thread PanResponder
        // from fighting with Reanimated's native scroll handler.
        disableScrollViewPanResponder={true}
      >
        {state.routes.map((route, index) => {
          const isLoaded = loaded.includes(index);

          return (
            <View key={route.key} style={styles.page}>
              {isLoaded ? descriptors[route.key].render() : null}
            </View>
          );
        })}
      </Animated.ScrollView>

      {!shouldHideTabBar && (
        <AnimatedTabBar
          state={state}
          onTabPress={handleTabPress}
          translateX={translateX}
          insets={insets}
          role={role}
          navigation={navigation}
        />
      )}
    </View>
  );
}

export const createSwipeablePagerNavigator = createNavigatorFactory(SwipeablePagerNavigator);


// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1 },

  pager: {
    flex: 1,
  },

  page: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === "ios" ? 95 : 80,
    paddingTop: 12,
  },

  iosDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.2)",
  },

  androidBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
  },

  androidDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
  },

  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
  },

  tabButton: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});