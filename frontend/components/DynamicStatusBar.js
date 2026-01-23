import React from "react";
import { StatusBar } from "expo-status-bar";
import { useStatusBar } from "../contexts/StatusBarManager";

/**
 * DynamicStatusBar - Smart status bar wrapper
 *
 * Automatically syncs with StatusBarManager context or uses
 * explicit style prop. Handles platform differences.
 *
 * @param {string} style - Override style ('light-content' or 'dark-content')
 * @param {boolean} translucent - Android translucent mode
 * @param {string} backgroundColor - Android background color
 */
const DynamicStatusBar = ({
  style: styleProp,
  translucent = true,
  backgroundColor = "transparent",
  ...props
}) => {
  const { statusBarStyle, animated } = useStatusBar();

  // Use explicit prop or fall back to context
  const finalStyle = styleProp || statusBarStyle;

  return (
    <StatusBar
      style={finalStyle}
      translucent={translucent}
      backgroundColor={backgroundColor}
      animated={animated}
      {...props}
    />
  );
};

export default DynamicStatusBar;
