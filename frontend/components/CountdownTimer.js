/**
 * CountdownTimer Component
 * Real-time countdown timer with color-coded urgency
 */

import React, { useState, useEffect } from "react";
import { Text } from "react-native";
import {
  getTimeRemaining,
  formatCountdown,
  getUrgencyColor,
} from "../utils/cardTiming";

const CountdownTimer = ({ expiresAt, style, prefix = "" }) => {
  const [display, setDisplay] = useState("");
  const [color, setColor] = useState("#9CA3AF");

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const remaining = getTimeRemaining(expiresAt);
      const formatted = formatCountdown(expiresAt);

      setDisplay(formatted);
      setColor(getUrgencyColor(remaining));
    };

    // Initial update
    update();

    // Determine update frequency based on time remaining
    const remaining = getTimeRemaining(expiresAt);
    const hours = remaining / (1000 * 60 * 60);

    let updateInterval;
    if (hours < 1) {
      updateInterval = 10000; // Update every 10 seconds if < 1h
    } else {
      updateInterval = 60000; // Update every minute otherwise
    }

    const interval = setInterval(update, updateInterval);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!display) return null;

  return (
    <Text style={[style, { color }]}>
      {prefix}
      {display}
    </Text>
  );
};

export default CountdownTimer;
