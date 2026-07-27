import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";

/**
 * DeferredCard
 *
 * Defers rendering of heavy card subtrees (Image/Video, Shared Posts, Tickets, Events)
 * until Frame 1/2 after screen mount. On Frame 0, renders a light zero-cost placeholder
 * matching the target height, preventing JS thread frame drops during list mount.
 */
export default function DeferredCard({
  minHeight = 160,
  borderRadius = 16,
  children,
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // requestAnimationFrame ensures the initial frame (Frame 0) layout completes
    // with zero heavy subtrees, then hydrates the full card on Frame 1/2.
    const animFrame = requestAnimationFrame(() => {
      setIsReady(true);
    });
    return () => cancelAnimationFrame(animFrame);
  }, []);

  if (!isReady) {
    return (
      <View
        style={[
          styles.skeleton,
          { minHeight, borderRadius },
        ]}
      />
    );
  }

  return children;
}

const styles = StyleSheet.create({
  skeleton: {
    width: "100%",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});
