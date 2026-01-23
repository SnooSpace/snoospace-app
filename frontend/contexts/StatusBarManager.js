import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";

const StatusBarContext = createContext();

/**
 * StatusBarManager - Centralized status bar style management
 *
 * Provides global control over status bar appearance with smooth transitions.
 * Automatically resets to default style when screens unmount.
 */
export const StatusBarManagerProvider = ({ children }) => {
  const [statusBarStyle, setStatusBarStyle] = useState("light-content");
  const [animated, setAnimated] = useState(true);

  const updateStatusBarStyle = (style, shouldAnimate = true) => {
    setStatusBarStyle(style);
    setAnimated(shouldAnimate);
  };

  const value = {
    statusBarStyle,
    setStatusBarStyle: updateStatusBarStyle,
    animated,
  };

  return (
    <StatusBarContext.Provider value={value}>
      {children}
    </StatusBarContext.Provider>
  );
};

/**
 * Hook to access status bar manager
 */
export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error(
      "useStatusBar must be used within StatusBarManagerProvider",
    );
  }
  return context;
};

/**
 * Hook to temporarily set status bar style for a screen
 * Automatically resets to default on unmount
 */
export const useStatusBarStyle = (style, options = {}) => {
  const { setStatusBarStyle } = useStatusBar();
  const { animated = true, resetStyle = "light-content" } = options;

  useEffect(() => {
    setStatusBarStyle(style, animated);

    return () => {
      // Reset to default on unmount
      setStatusBarStyle(resetStyle, animated);
    };
  }, [style, animated, resetStyle, setStatusBarStyle]);
};
