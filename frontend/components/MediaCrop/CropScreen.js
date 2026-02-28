/**
 * CropScreen.js
 * Full-screen modal crop editor with navigation integration.
 * Handles preset selection, image cropping, and export.
 */

import React, { useState, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  X,
  Grid3x3,
  ScanLine,
  Square,
  RectangleVertical,
} from "lucide-react-native";
import * as ImageManipulator from "expo-image-manipulator";
import CropView from "./CropView";
import { getPreset, CROP_PRESETS } from "./CropPresets";
import { calculateCropRegion, validateImageSize } from "./CropUtils";
import { COLORS } from "../../constants/theme";
import SnooLoader from "../ui/SnooLoader";

/**
 * CropScreen Component
 * Full-screen crop editor with preset selection and export.
 *
 * @param {Object} props
 * @param {Object} props.route - Navigation route with params
 * @param {Object} props.navigation - Navigation object
 *
 * Route params:
 * - imageUri: URI of image to crop
 * - presetKey: Initial preset key (e.g., 'avatar', 'banner')
 * - allowPresetChange: Allow switching between presets
 * - onComplete: Callback with cropped image URI and metadata
 * - onCancel: Callback when cancelled
 */
const CropScreen = ({ route, navigation }) => {
  const {
    imageUri,
    presetKey = "avatar",
    customPreset = null, // NEW: Custom preset object for natural video aspect ratio
    allowPresetChange = false,
    initialCropData = null, // For position restoration on re-edit
    onComplete,
    onCancel,
  } = route?.params || {};

  const [currentPresetKey, setCurrentPresetKey] = useState(presetKey);
  const [processing, setProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // Current preset configuration - use custom preset if provided, otherwise look up by key
  const preset = customPreset || getPreset(currentPresetKey);

  // Check if this is a video
  const isVideo =
    imageUri?.toLowerCase().includes(".mp4") ||
    imageUri?.toLowerCase().includes(".mov") ||
    imageUri?.toLowerCase().includes(".webm");

  // Check if this is a feed post mode (allows toggling)
  // Disable toggling when using a custom preset (natural video aspect ratio)
  const isFeedMode =
    !customPreset &&
    [
      "feed_square",
      "feed_portrait",
      "feed_landscape",
      "feed_landscape_photo",
      "story", // Video support
    ].includes(currentPresetKey);

  // Toggle between feed aspect ratios
  const handleAspectToggle = useCallback(() => {
    if (isVideo) {
      // Toggle between video presets: 9:16 -> 4:5 -> 1:1 -> 16:9 -> 9:16
      if (currentPresetKey === "story") {
        setCurrentPresetKey("feed_portrait");
      } else if (currentPresetKey === "feed_portrait") {
        setCurrentPresetKey("feed_square");
      } else if (currentPresetKey === "feed_square") {
        setCurrentPresetKey("feed_landscape");
      } else {
        setCurrentPresetKey("story");
      }
    } else {
      // Existing logic for images
      if (currentPresetKey === "feed_square") {
        setCurrentPresetKey("feed_portrait");
      } else if (currentPresetKey === "feed_portrait") {
        setCurrentPresetKey("feed_square");
      }
    }
  }, [currentPresetKey, isVideo]);

  // Store crop data from CropView
  const cropDataRef = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
    imageWidth: 0,
    imageHeight: 0,
    frameWidth: 0,
    frameHeight: 0,
  });

  // Handle crop data updates from CropView
  const handleCropChange = useCallback(
    (data) => {
      cropDataRef.current = data;
      // Mark image as loaded when we have valid dimensions
      if (data.imageWidth && data.imageHeight && !imageLoaded) {
        setImageLoaded(true);
      }
    },
    [imageLoaded],
  );

  // Handle image load and validate dimensions (skip for re-edit since image was already approved)
  const handleImageLoad = useCallback(
    ({ width, height }) => {
      // Skip validation for re-edit mode - the image was already approved during initial selection
      if (initialCropData) {
        return;
      }

      const validation = validateImageSize(
        width,
        height,
        preset.minWidth,
        preset.minHeight,
      );

      if (!validation.valid) {
        Alert.alert("Image Too Small", validation.message, [
          { text: "OK", onPress: () => handleCancel() },
        ]);
      }
    },
    [preset, initialCropData],
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onCancel]);

  // Handle crop confirmation
  const handleConfirm = useCallback(async () => {
    const cropData = cropDataRef.current;

    if (!cropData.imageWidth || !cropData.imageHeight) {
      Alert.alert("Error", "Image not loaded properly. Please try again.");
      return;
    }

    setProcessing(true);

    try {
      // Calculate the effective scale on original image
      // displayWidth/imageWidth is the initial scale to fill the frame
      // cropData.scale is the additional zoom applied on top
      const initialScale = cropData.displayWidth / cropData.imageWidth || 1;
      const effectiveScale = initialScale * cropData.scale;

      if (isVideo) {
        // For videos, skip ImageManipulator and return metadata
        const cropMetadata = {
          preset: currentPresetKey,
          aspectRatio: preset.aspectRatio,
          scale: cropData.scale,
          translateX: cropData.translateX,
          translateY: cropData.translateY,
          displayWidth: cropData.displayWidth,
          displayHeight: cropData.displayHeight,
          originalWidth: cropData.imageWidth,
          originalHeight: cropData.imageHeight,
          originalUri: imageUri,
          mediaType: "video",
          timestamp: Date.now(),
        };

        if (onComplete) {
          onComplete({
            uri: imageUri, // Keep original URI
            width: cropData.imageWidth,
            height: cropData.imageHeight,
            metadata: cropMetadata,
          });
        }

        if (navigation.canGoBack()) navigation.goBack();
        return;
      }

      // Calculate crop region in original image coordinates
      const cropRegion = calculateCropRegion({
        imageWidth: cropData.imageWidth,
        imageHeight: cropData.imageHeight,
        frameWidth: cropData.frameWidth,
        frameHeight: cropData.frameHeight,
        scale: effectiveScale,
        translateX: cropData.translateX,
        translateY: cropData.translateY,
        displayWidth: cropData.displayWidth,
        displayHeight: cropData.displayHeight,
      });

      // WORKAROUND: expo-image-manipulator ignores originY on direct ImagePicker URIs
      // Step 1: Resize to exact dimensions to force re-encoding (creates a new image buffer)
      const reEncodedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: cropData.imageWidth } }], // Resize to same width (forces re-encode)
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );

      // Step 2: Now crop the re-encoded image
      const cropParams = {
        originX: Math.round(cropRegion.originX),
        originY: Math.round(cropRegion.originY),
        width: Math.round(cropRegion.width),
        height: Math.round(cropRegion.height),
      };

      const actions = [{ crop: cropParams }];

      // Add final resize if needed
      if (cropRegion.width > preset.recommendedWidth) {
        actions.push({ resize: { width: preset.recommendedWidth } });
      }

      const result = await ImageManipulator.manipulateAsync(
        reEncodedImage.uri, // Use re-encoded image, not original
        actions,
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      );

      // Build crop metadata for storage
      const cropMetadata = {
        preset: currentPresetKey,
        aspectRatio: preset.aspectRatio,
        scale: cropData.scale,
        translateX: cropData.translateX,
        translateY: cropData.translateY,
        originalWidth: cropData.imageWidth,
        originalHeight: cropData.imageHeight,
        originalUri: imageUri, // Store original URI for re-editing
        outputWidth: result.width,
        outputHeight: result.height,
        timestamp: Date.now(),
      };

      // Call completion callback
      if (onComplete) {
        onComplete({
          uri: result.uri,
          width: result.width,
          height: result.height,
          metadata: cropMetadata,
        });
      }

      // Navigate back
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Crop error:", error);
      Alert.alert("Error", "Failed to crop image. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [imageUri, currentPresetKey, preset, navigation, onComplete]);

  // Toggle grid visibility
  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  // Toggle safe zone visibility
  const handleToggleSafeZone = useCallback(() => {
    setShowSafeZone((prev) => !prev);
  }, []);

  // Handle preset change
  const handlePresetChange = useCallback((key) => {
    setCurrentPresetKey(key);
  }, []);

  // Available presets for selection
  const availablePresets = allowPresetChange
    ? Object.values(CROP_PRESETS).filter(
        (p) => p.key !== "story", // Exclude story from general selection
      )
    : [preset];

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          {/* Cancel — X icon */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={processing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={22} color="#1A1A1A" strokeWidth={2} />
          </TouchableOpacity>

          {/* Title */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{preset.label}</Text>
            </View>
          </View>

          {/* Done button — solid pill */}
          <TouchableOpacity
            style={[
              styles.doneButton,
              (!imageLoaded || processing) && styles.doneButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={processing || !imageLoaded}
            activeOpacity={0.85}
          >
            {processing || !imageLoaded ? (
              <SnooLoader size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Crop View */}
        <View style={styles.cropContainer}>
          <CropView
            imageUri={imageUri}
            aspectRatio={preset.aspectRatio}
            maxZoom={preset.maxZoom}
            showGrid={showGrid}
            isCircular={preset.isCircular}
            safeZone={preset.safeZone}
            showSafeZone={showSafeZone && preset.safeZone !== null}
            onCropChange={handleCropChange}
            onImageLoad={handleImageLoad}
            initialScale={initialCropData?.scale}
            initialTranslateX={initialCropData?.translateX}
            initialTranslateY={initialCropData?.translateY}
            mediaType={isVideo ? "video" : "image"}
          />

          {/* Floating Aspect Ratio Toggle Button (for feed posts) */}
          {isFeedMode && (
            <TouchableOpacity
              style={styles.aspectToggleButton}
              onPress={handleAspectToggle}
            >
              <View style={styles.aspectToggleIcon}>
                {currentPresetKey === "feed_square" ? (
                  <Square size={16} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <RectangleVertical
                    size={16}
                    color="#FFFFFF"
                    strokeWidth={2}
                  />
                )}
              </View>
              <Text style={styles.aspectToggleText}>
                {currentPresetKey === "feed_square"
                  ? "1:1"
                  : currentPresetKey === "feed_portrait"
                    ? "4:5"
                    : currentPresetKey === "feed_landscape"
                      ? "16:9"
                      : currentPresetKey === "story"
                        ? "9:16"
                        : "4:5"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Controls */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomControls}>
          {/* Toolbar */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={[styles.toolButton, showGrid && styles.toolButtonActive]}
              onPress={handleToggleGrid}
            >
              <Grid3x3
                size={20}
                color={showGrid ? COLORS.primary : "#888888"}
                strokeWidth={1.75}
              />
              <Text
                style={[
                  styles.toolButtonText,
                  showGrid && styles.toolButtonTextActive,
                ]}
              >
                Grid
              </Text>
            </TouchableOpacity>

            {preset.safeZone && (
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  showSafeZone && styles.toolButtonActive,
                ]}
                onPress={handleToggleSafeZone}
              >
                <ScanLine
                  size={20}
                  color={showSafeZone ? COLORS.primary : "#888888"}
                  strokeWidth={1.75}
                />
                <Text
                  style={[
                    styles.toolButtonText,
                    showSafeZone && styles.toolButtonTextActive,
                  ]}
                >
                  Safe Zone
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Aspect Ratio Presets */}
          {allowPresetChange && availablePresets.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetContainer}
            >
              {availablePresets.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.presetButton,
                    currentPresetKey === p.key && styles.presetButtonActive,
                  ]}
                  onPress={() => handlePresetChange(p.key)}
                >
                  <View
                    style={[
                      styles.presetIcon,
                      {
                        aspectRatio: p.aspectRatio[0] / p.aspectRatio[1],
                      },
                      currentPresetKey === p.key && styles.presetIconActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.presetText,
                      currentPresetKey === p.key && styles.presetTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    color: "#1A1A1A",
    fontFamily: "BasicCommercial-Bold",
    letterSpacing: 0.1,
  },
  // ── Done button ─────────────────────────────────────────────────────────────
  doneButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  doneButtonDisabled: {
    backgroundColor: "#B0C4DE",
    shadowOpacity: 0,
    elevation: 0,
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    letterSpacing: 0.2,
  },
  // ── Crop Area ────────────────────────────────────────────────────────────────
  cropContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  // ── Bottom Controls ──────────────────────────────────────────────────────────
  bottomControls: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8E8E8",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 40,
  },
  toolButton: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toolButtonActive: {},
  toolButtonText: {
    color: "#888888",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "Manrope-Medium",
  },
  toolButtonTextActive: {
    color: COLORS.primary,
  },
  // ── Preset Row ───────────────────────────────────────────────────────────────
  presetContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  presetButton: {
    alignItems: "center",
    marginRight: 16,
  },
  presetButtonActive: {},
  presetIcon: {
    width: 36,
    height: 36,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 5,
  },
  presetIconActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  presetText: {
    color: "rgba(0, 0, 0, 0.45)",
    fontSize: 11,
    marginTop: 6,
    fontFamily: "Manrope-Regular",
  },
  presetTextActive: {
    color: COLORS.primary,
    fontFamily: "Manrope-SemiBold",
  },
  // ── Aspect Toggle Pill ───────────────────────────────────────────────────────
  aspectToggleButton: {
    position: "absolute",
    left: 16,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  aspectToggleIcon: {},
  aspectToggleText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Manrope-Medium",
  },
});

export default CropScreen;
