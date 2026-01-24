/**
 * QualifiedViewWrapper Component
 *
 * Legacy wrapper - view tracking is now handled directly in EditorialPostCard.
 * This component is kept for potential future use with other card types.
 *
 * For reference, EditorialPostCard handles:
 * - Image/text posts: dwell time (1.5s/2s)
 * - Video posts: unmute, fullscreen, 2s playback
 */
import React from "react";
import { View } from "react-native";

const QualifiedViewWrapper = ({ children }) => {
  // Tracking now handled directly in EditorialPostCard
  return <View collapsable={false}>{children}</View>;
};

export default QualifiedViewWrapper;
