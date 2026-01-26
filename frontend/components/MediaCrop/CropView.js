/**
 * CropView.js
 * Core gesture-enabled crop component using Reanimated and Gesture Handler.
 * Provides Instagram-style pinch, pan, and double-tap interactions.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Video, ResizeMode } from "expo-av";
import CropOverlay from "./CropOverlay";
import { calculateBounds, calculateInitialScale, clamp } from "./CropUtils";

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedVideo = Animated.createAnimatedComponent(Video);

// Spring configuration for smooth animations
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

/**
 * CropView Component
 * Gesture-enabled image crop view with pinch-to-zoom, pan, and double-tap.
 *
 * @param {Object} props
 * @param {string} props.imageUri - URI of the image to crop
 * @param {Array} props.aspectRatio - [width, height] aspect ratio
 * @param {number} props.maxZoom - Maximum zoom level (default 5)
 * @param {boolean} props.showGrid - Show rule-of-thirds grid
 * @param {boolean} props.isCircular - Circular crop mask (for avatars)
 * @param {Object} props.safeZone - Safe zone indicator
 * @param {boolean} props.showSafeZone - Show safe zone overlay
 * @param {Function} props.onCropChange - Callback with crop metadata
 * @param {Function} props.onImageLoad - Callback when image loads with dimensions
 * @param {number} props.initialScale - Initial scale for position restoration
 * @param {number} props.initialScale - Initial scale for position restoration
 * @param {number} props.initialTranslateX - Initial X translation for position restoration
 * @param {number} props.initialTranslateY - Initial Y translation for position restoration
 * @param {string} props.mediaType - 'image' or 'video'
 */
const CropView = ({
  imageUri,
  aspectRatio = [1, 1],
  maxZoom = 5,
  showGrid = true,
  isCircular = false,
  safeZone = null,
  showSafeZone = false,
  onCropChange,
  onImageLoad,
  initialScale,
  initialTranslateX,
  initialTranslateY,
  mediaType = "image",
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  // Calculate frame dimensions based on aspect ratio and screen size
  const padding = 40;
  const maxWidth = screenWidth - padding;
  const maxHeight = screenHeight * 0.6; // Max 60% of screen height
  const ratio = aspectRatio[0] / aspectRatio[1];

  let frameWidth = maxWidth;
  let frameHeight = frameWidth / ratio;

  if (frameHeight > maxHeight) {
    frameHeight = maxHeight;
    frameWidth = frameHeight * ratio;
  }

  // Debug log to trace initial values
  console.log("[CropView] Initialized with:", {
    initialScale,
    initialTranslateX,
    initialTranslateY,
    hasInitialValues: !!(
      initialScale ||
      initialTranslateX ||
      initialTranslateY
    ),
  });

  // Shared values for transforms - initialize with saved values if provided
  const scale = useSharedValue(initialScale || 1);
  const translateX = useSharedValue(initialTranslateX || 0);
  const translateY = useSharedValue(initialTranslateY || 0);

  // Saved values for gesture continuity - also use initial values
  const savedScale = useSharedValue(initialScale || 1);
  const savedTranslateX = useSharedValue(initialTranslateX || 0);
  const savedTranslateY = useSharedValue(initialTranslateY || 0);

  // Focal point for pinch gestures
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Image dimensions (set after load)
  const imageWidth = useSharedValue(0);
  const imageHeight = useSharedValue(0);

  // Display dimensions (shared values for worklet access)
  const displayWidth = useSharedValue(0);
  const displayHeight = useSharedValue(0);

  // Display dimensions for React rendering (synced with shared values)
  const [displayDimensions, setDisplayDimensions] = useState({
    width: 0,
    height: 0,
  });

  // Report crop changes to parent
  const reportCropChange = useCallback(() => {
    if (onCropChange && imageWidth.value && imageHeight.value) {
      onCropChange({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
        imageWidth: imageWidth.value,
        imageHeight: imageHeight.value,
        frameWidth,
        frameHeight,
        // Use shared values to avoid stale closure issues
        displayWidth: displayWidth.value,
        displayHeight: displayHeight.value,
      });
    }
  }, [onCropChange, frameWidth, frameHeight]);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      "worklet";
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      "worklet";
      const newScale = savedScale.value * event.scale;

      // With displayDimensions already filling frame, scale=1 is minimum
      // Allow slight overscale during gesture for feel, snap back on end
      const minScale = 1;
      const maxScale = maxZoom;

      // Clamp scale within bounds with slight overscale allowance
      scale.value = clamp(newScale, minScale * 0.8, maxScale * 1.1);
    })
    .onEnd(() => {
      "worklet";
      // With displayDimensions already filling frame, scale=1 is minimum
      const minScale = 1;
      const maxScaleVal = maxZoom;

      // Snap scale to valid range
      const clampedScale = clamp(scale.value, minScale, maxScaleVal);
      scale.value = withSpring(clampedScale, SPRING_CONFIG);
      savedScale.value = clampedScale;

      // Calculate pan limits based on scaled display dimensions
      const scaledWidth = displayWidth.value * clampedScale;
      const scaledHeight = displayHeight.value * clampedScale;
      const maxTranslateX = Math.max(0, (scaledWidth - frameWidth) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - frameHeight) / 2);

      // Clamp translation
      translateX.value = withSpring(
        clamp(translateX.value, -maxTranslateX, maxTranslateX),
        SPRING_CONFIG,
      );
      translateY.value = withSpring(
        clamp(translateY.value, -maxTranslateY, maxTranslateY),
        SPRING_CONFIG,
      );
      savedTranslateX.value = clamp(
        translateX.value,
        -maxTranslateX,
        maxTranslateX,
      );
      savedTranslateY.value = clamp(
        translateY.value,
        -maxTranslateY,
        maxTranslateY,
      );

      runOnJS(reportCropChange)();
    });

  // Pan gesture for moving image
  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .minPointers(1)
    .maxPointers(2)
    .onUpdate((event) => {
      "worklet";
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      "worklet";
      // Calculate pan limits based on scaled display dimensions
      const scaledWidth = displayWidth.value * scale.value;
      const scaledHeight = displayHeight.value * scale.value;
      const maxTranslateX = Math.max(0, (scaledWidth - frameWidth) / 2);
      const maxTranslateY = Math.max(0, (scaledHeight - frameHeight) / 2);

      // Clamp to prevent empty areas
      translateX.value = withSpring(
        clamp(translateX.value, -maxTranslateX, maxTranslateX),
        SPRING_CONFIG,
      );
      translateY.value = withSpring(
        clamp(translateY.value, -maxTranslateY, maxTranslateY),
        SPRING_CONFIG,
      );

      savedTranslateX.value = clamp(
        translateX.value,
        -maxTranslateX,
        maxTranslateX,
      );
      savedTranslateY.value = clamp(
        translateY.value,
        -maxTranslateY,
        maxTranslateY,
      );

      runOnJS(reportCropChange)();
    });

  // Double-tap to toggle between scale=1 (fill) and 1.5x zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      // Toggle between scale=1 (fill) and 1.5x zoom
      const isAtFillScale = Math.abs(scale.value - 1) < 0.1;
      const targetScale = isAtFillScale ? Math.min(1.5, maxZoom) : 1;

      scale.value = withSpring(targetScale, SPRING_CONFIG);
      translateX.value = withSpring(0, SPRING_CONFIG);
      translateY.value = withSpring(0, SPRING_CONFIG);

      savedScale.value = targetScale;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;

      runOnJS(reportCropChange)();
    });

  // Compose gestures: simultaneous pinch + pan, with double-tap
  const composedGestures = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  // Animated image style
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Handle image load
  const handleImageLoad = useCallback(
    (event) => {
      // Handle both Image 'onLoad' event and Video 'onLoad' status
      let width, height;

      if (mediaType === "video" && event && event.naturalSize) {
        // Video component returns status object with naturalSize
        width = event.naturalSize.width;
        height = event.naturalSize.height;
      } else if (mediaType === "video" && event && event.isLoaded) {
        // Android Video component - try to get dimensions from the event
        // The video is loaded but dimensions might not be in naturalSize
        // We'll use a fallback approach
        console.log(
          "[CropView] Video loaded on Android, using fallback dimensions",
        );
        // For now, use standard HD video dimensions as fallback
        // This will be updated when we can properly detect video dimensions
        width = 1080;
        height = 1920;
      } else if (event && event.nativeEvent && event.nativeEvent.source) {
        // Image component returns nativeEvent with source
        width = event.nativeEvent.source.width;
        height = event.nativeEvent.source.height;
      } else {
        console.warn("[CropView] Unknown load event structure:", event);
        return;
      }

      imageWidth.value = width;
      imageHeight.value = height;

      // Calculate initial scale to fill frame (cover behavior)
      const initialScaleValue = calculateInitialScale({
        imageWidth: width,
        imageHeight: height,
        frameWidth,
        frameHeight,
        mode: "fill",
      });

      // Set display dimensions so image fills the frame at initial scale
      // The image will be sized to fill the frame, then we apply scale=1
      const scaledWidth = width * initialScaleValue;
      const scaledHeight = height * initialScaleValue;

      // Set shared values for worklet access
      displayWidth.value = scaledWidth;
      displayHeight.value = scaledHeight;

      // Set React state for rendering
      setDisplayDimensions({
        width: scaledWidth,
        height: scaledHeight,
      });

      // DEBUG: Log dimensions to verify display sizing
      console.log("[CropView] handleImageLoad dimensions:", {
        originalImage: {
          width,
          height,
          aspectRatio: (width / height).toFixed(3),
        },
        frame: { width: frameWidth, height: frameHeight },
        initialScaleValue,
        displaySize: { width: scaledWidth, height: scaledHeight },
        extendsOutsideFrame: {
          horizontally: scaledWidth > frameWidth,
          vertically: scaledHeight > frameHeight,
          verticalOverflow: scaledHeight - frameHeight,
        },
      });

      // ONLY reset position when there are NO saved initial values
      // When re-editing, preserve the saved position
      const hasInitialValues = !!(
        initialScale ||
        initialTranslateX ||
        initialTranslateY
      );

      if (!hasInitialValues) {
        // New crop - start fresh at scale=1 (since image is already sized to fill)
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        console.log("[CropView] Preserving initial position:", {
          scale: initialScale,
          translateX: initialTranslateX,
          translateY: initialTranslateY,
        });
        // Re-edit - use the saved position values (already set in useSharedValue init)
        // Just make sure saved values match current values for gesture continuity
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      }

      if (onImageLoad) {
        onImageLoad({ width, height, initialScale: initialScaleValue });
      }

      // Report initial crop state directly (avoid stale callback issues)
      if (onCropChange) {
        onCropChange({
          scale: scale.value,
          translateX: translateX.value,
          translateY: translateY.value,
          imageWidth: width,
          imageHeight: height,
          frameWidth,
          frameHeight,
          displayWidth: scaledWidth,
          displayHeight: scaledHeight,
        });
      }
    },
    [frameWidth, frameHeight, onImageLoad, onCropChange],
  );

  return (
    <View style={styles.container}>
      {/* Dark overlay background */}
      <View style={styles.overlayBackground} />

      {/* Crop frame container */}
      <View
        style={[
          styles.frameContainer,
          {
            width: frameWidth,
            height: frameHeight,
            borderRadius: isCircular ? frameWidth / 2 : 0,
          },
        ]}
      >
        <GestureDetector gesture={composedGestures}>
          <Animated.View style={styles.imageWrapper}>
            {mediaType === "video" ? (
              <AnimatedVideo
                source={{ uri: imageUri }}
                style={[
                  animatedImageStyle,
                  displayDimensions.width > 0
                    ? {
                        width: displayDimensions.width,
                        height: displayDimensions.height,
                      }
                    : {
                        width: "100%",
                        height: "100%",
                      },
                ]}
                onLoad={handleImageLoad}
                resizeMode={ResizeMode.COVER}
                shouldPlay={true}
                isLooping={true}
                isMuted={true}
              />
            ) : (
              <AnimatedImage
                source={{ uri: imageUri }}
                style={[
                  animatedImageStyle,
                  // Use calculated dimensions if available, otherwise fill container
                  displayDimensions.width > 0
                    ? {
                        width: displayDimensions.width,
                        height: displayDimensions.height,
                      }
                    : {
                        width: frameWidth * 2,
                        height: frameHeight * 2,
                      },
                ]}
                onLoad={handleImageLoad}
                resizeMode="cover"
              />
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Overlay with grid and corners */}
      <CropOverlay
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        showGrid={showGrid}
        isCircular={isCircular}
        safeZone={safeZone}
        showSafeZone={showSafeZone}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 245, 245, 0.85)",
  },
  frameContainer: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  imageWrapper: {
    // Use width/height: '100%' and overflow: 'visible' to allow image to extend beyond
    // The parent frameContainer's overflow: 'hidden' will handle clipping
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  image: {
    // Removed static dimensions - now using dynamic displayDimensions
  },
});

export default CropView;
