/**
 * signupNavigation.js
 *
 * Centralizes "exit signup flow" navigation for community (and other) signup flows.
 *
 * Problem: The CommunitySignupNavigator is a NESTED stack inside AppNavigator.
 * When cancel/back tries to reset to "AuthGate", it resets the NESTED stack,
 * not the root AppNavigator — causing loops and broken cancel.
 *
 * Solution: Always walk up to the root navigator before resetting.
 */

import { CommonActions } from "@react-navigation/native";

/**
 * Get the root navigator so we can reset it.
 * Walks up the parent chain from any nested navigator.
 */
function getRootNavigator(navigation) {
  let nav = navigation;
  while (nav.getParent && nav.getParent()) {
    nav = nav.getParent();
  }
  return nav;
}

/**
 * Exit the signup flow entirely and go to AuthGate.
 * Works correctly whether signup was launched from:
 *  - Landing (no prior accounts)
 *  - AccountSwitcher (already logged in, CommunitySignup is a nested route)
 */
export function exitSignupToAuthGate(navigation) {
  const root = getRootNavigator(navigation);
  root.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    })
  );
}

/**
 * Exit the signup flow and go back to Landing.
 */
export function exitSignupToLanding(navigation) {
  const root = getRootNavigator(navigation);
  root.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Landing" }],
    })
  );
}

/**
 * Smart back: if we can go back within the signup stack, do so.
 * Otherwise exit to AuthGate (handles the "first screen" edge case).
 */
export function signupBack(navigation) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    exitSignupToAuthGate(navigation);
  }
}
