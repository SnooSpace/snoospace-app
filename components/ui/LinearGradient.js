import React from "react";
import Constants from "expo-constants";

let RNLinearGradient = null;
let ExpoLinearGradient = null;

// Determine if we are running inside the Expo Go client
const isExpoGo = Constants.appOwnership === "expo";

if (isExpoGo) {
  // If in Expo Go, fallback to the Expo module so the app doesn't crash
  ExpoLinearGradient = require("expo-linear-gradient").LinearGradient;
} else {
  // Otherwise, use the pure React Native production library
  RNLinearGradient = require("react-native-linear-gradient").default;
}

export default function LinearGradient(props) {
  if (isExpoGo) {
    return <ExpoLinearGradient {...props} />;
  }
  return <RNLinearGradient {...props} />;
}
