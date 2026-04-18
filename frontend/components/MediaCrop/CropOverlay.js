/**
 * CropOverlay.js
 * Dark overlay mask with crop frame cutout and optional rule-of-thirds grid.
 * Creates the Instagram-style visual separation between cropped and excluded areas.
 */

import React, { memo } from "react";
import { View, StyleSheet } from "react-native";

/**
 * CropOverlay Component
 * Renders a dark overlay with a transparent cutout for the crop area
 * and an optional rule-of-thirds grid for composition assistance.
 *
 * @param {Object} props
 * @param {number} props.frameWidth - Width of the crop frame
 * @param {number} props.frameHeight - Height of the crop frame
 * @param {boolean} props.showGrid - Whether to show the rule-of-thirds grid
 * @param {boolean} props.isCircular - Whether to render circular mask (for avatars)
 * @param {Object} props.safeZone - Safe zone indicators { left, top, right, bottom } as percentages
 * @param {boolean} props.showSafeZone - Whether to show safe zone overlay
 */
const CropOverlay = ({
  frameWidth,
  frameHeight,
  showGrid = false,
  isCircular = false,
  safeZone = null,
  showSafeZone = false,
}) => {
  const borderRadius = isCircular ? frameWidth / 2 : 0;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Crop frame border */}
      <View
        style={[
          styles.frameBorder,
          {
            width: frameWidth,
            height: frameHeight,
            borderRadius,
          },
        ]}
      >
        {/* Rule of thirds grid */}
        {showGrid && !isCircular && (
          <View style={styles.gridContainer}>
            {/* Vertical lines */}
            <View
              style={[styles.gridLine, styles.gridVertical, { left: "33.33%" }]}
            />
            <View
              style={[styles.gridLine, styles.gridVertical, { left: "66.66%" }]}
            />
            {/* Horizontal lines */}
            <View
              style={[
                styles.gridLine,
                styles.gridHorizontal,
                { top: "33.33%" },
              ]}
            />
            <View
              style={[
                styles.gridLine,
                styles.gridHorizontal,
                { top: "66.66%" },
              ]}
            />
          </View>
        )}

        {/* Safe zone indicator */}
        {showSafeZone && safeZone && (
          <View style={styles.safeZoneContainer}>
            {safeZone.left > 0 && (
              <View
                style={[
                  styles.safeZoneOverlay,
                  {
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${safeZone.left * 100}%`,
                  },
                ]}
              />
            )}
            {safeZone.top > 0 && (
              <View
                style={[
                  styles.safeZoneOverlay,
                  {
                    left: 0,
                    right: 0,
                    top: 0,
                    height: `${safeZone.top * 100}%`,
                  },
                ]}
              />
            )}
            {safeZone.right > 0 && (
              <View
                style={[
                  styles.safeZoneOverlay,
                  {
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${safeZone.right * 100}%`,
                  },
                ]}
              />
            )}
            {safeZone.bottom > 0 && (
              <View
                style={[
                  styles.safeZoneOverlay,
                  {
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${safeZone.bottom * 100}%`,
                  },
                ]}
              />
            )}
          </View>
        )}

        {/* Corner indicators for non-circular crops */}
        {!isCircular && (
          <>
            {/* Top-left corner */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopLeftVert]} />

            {/* Top-right corner */}
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerTopRightVert]} />

            {/* Bottom-left corner */}
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomLeftVert]} />

            {/* Bottom-right corner */}
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <View style={[styles.corner, styles.cornerBottomRightVert]} />
          </>
        )}
      </View>
    </View>
  );
};

const CORNER_SIZE = 20;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  frameBorder: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.3)",
    overflow: "hidden",
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  gridVertical: {
    width: 1,
    top: 0,
    bottom: 0,
  },
  gridHorizontal: {
    height: 1,
    left: 0,
    right: 0,
  },
  safeZoneContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  safeZoneOverlay: {
    position: "absolute",
    backgroundColor: "rgba(255, 165, 0, 0.2)", // Orange tint for safe zone
    borderWidth: 1,
    borderColor: "rgba(255, 165, 0, 0.5)",
    borderStyle: "dashed",
  },
  corner: {
    position: "absolute",
    backgroundColor: "#333333",
  },
  // Top-left
  cornerTopLeft: {
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
  },
  cornerTopLeftVert: {
    top: 0,
    left: 0,
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
  },
  // Top-right
  cornerTopRight: {
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
  },
  cornerTopRightVert: {
    top: 0,
    right: 0,
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
  },
  // Bottom-left
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
  },
  cornerBottomLeftVert: {
    bottom: 0,
    left: 0,
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
  },
  // Bottom-right
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
  },
  cornerBottomRightVert: {
    bottom: 0,
    right: 0,
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
  },
});

export default memo(CropOverlay);
