import React, { useEffect, useState } from "react";
import { useEventVerification } from "../../context/EventVerificationContext";
import EventVerificationPopup from "./EventVerificationPopup";
import EventBus from "../../utils/EventBus";

/**
 * The event verification popup (RSVP / attendance confirmation) is strictly
 * restricted to the 5 primary bottom navigation root screens:
 *  1. HomeFeedScreen (Home tab)
 *  2. SearchScreen / Explore (Search tab)
 *  3. DiscoverScreen (Discover tab)
 *  4. YourEventsScreen (Your Events tab)
 *  5. MemberProfileScreen (Profile tab)
 *
 * Any sub-screens navigated from these screens (e.g. PlansVerificationScreen,
 * SettingsScreen, ChatScreen, NotificationsScreen, etc.) must hide the modal,
 * and it will re-appear when the user returns to any of the 5 allowed screens
 * (provided the prompt has not been answered).
 */
export const ALLOWED_VERIFICATION_POPUP_ROUTES = new Set([
  // 1. HomeFeedScreen
  "HomeFeed",
  "HomeFeedScreen",
  "Home",
  "MemberHomeFeed",
  "CommunityHomeFeed",

  // 2. Explore / Search Screen
  "SearchMain",
  "SearchScreen",
  "Explore",
  "ExploreScreen",
  "Search",
  "CommunitySearchHome",

  // 3. Discover Screen
  "DiscoverHome",
  "DiscoverScreen",
  "Discover",

  // 4. Your Events Screen
  "YourEventsList",
  "YourEventsScreen",
  "YourEvents",
  "Events",

  // 5. Profile Screen
  "ProfileHome",
  "MemberProfileScreen",
  "ProfileScreen",
  "Profile",
  "CommunityProfileScreen",
]);

export default function EventVerificationOverlay({ currentRouteName: propRouteName, navigationRef }) {
  const { activePopup, loading, handleConfirm, handleReject, handleAskLater } = useEventVerification();
  const [currentRoute, setCurrentRoute] = useState(propRouteName || null);

  useEffect(() => {
    if (propRouteName) {
      setCurrentRoute(propRouteName);
    }
  }, [propRouteName]);

  useEffect(() => {
    // If we don't have a route yet and navigationRef is ready, read it immediately
    if (!currentRoute && navigationRef?.current?.isReady?.()) {
      const active = navigationRef.current.getCurrentRoute()?.name;
      if (active) setCurrentRoute(active);
    }

    const unsub = EventBus.on("active-screen-changed", (routeName) => {
      setCurrentRoute(routeName);
    });

    return () => {
      unsub();
    };
  }, [navigationRef]);

  // If there is no active popup to display, render nothing
  if (!activePopup) return null;

  const activeRoute = propRouteName || currentRoute;
  const isAllowedScreen = activeRoute ? ALLOWED_VERIFICATION_POPUP_ROUTES.has(activeRoute) : false;

  // Strictly hide if the user is on any sub-screen
  if (!isAllowedScreen) {
    return null;
  }

  return (
    <EventVerificationPopup
      activePopup={activePopup}
      loading={loading}
      onConfirm={handleConfirm}
      onReject={handleReject}
      onAskLater={handleAskLater}
    />
  );
}
