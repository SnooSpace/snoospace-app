/**
 * CropScreen.js
 * Full-screen modal crop editor with navigation integration.
 * Handles preset selection, image cropping, and export.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import CropView from "./CropView";
import { getPreset, CROP_PRESETS } from "./CropPresets";
import { calculateCropRegion, validateImageSize } from "./CropUtils";
import { COLORS } from "../../constants/theme";

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

  // Current preset configuration
  const preset = getPreset(currentPresetKey);

  // Check if this is a video
  const isVideo =
    imageUri?.toLowerCase().includes(".mp4") ||
    imageUri?.toLowerCase().includes(".mov") ||
    imageUri?.toLowerCase().includes(".webm");

  // Check if this is a feed post mode (allows toggling)
  const isFeedMode = [
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleCancel}
            disabled={processing}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{preset.label}</Text>

          <TouchableOpacity
            style={[
              styles.headerButton,
              styles.confirmButtonWrapper,
              !imageLoaded && styles.buttonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={processing || !imageLoaded}
          >
            <LinearGradient
              colors={
                imageLoaded ? ["#00C6FF", "#0072FF"] : ["#CCCCCC", "#AAAAAA"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.confirmButton}
            >
              {processing || !imageLoaded ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>Done</Text>
              )}
            </LinearGradient>
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
                <Ionicons
                  name={
                    currentPresetKey === "feed_square"
                      ? "square-outline"
                      : "tablet-portrait-outline"
                  }
                  size={18}
                  color="#FFFFFF"
                />
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
              <Ionicons
                name="grid-outline"
                size={22}
                color={showGrid ? COLORS.primary : "#FFFFFF"}
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
                <Ionicons
                  name="scan-outline"
                  size={22}
                  color={showSafeZone ? COLORS.primary : "#FFFFFF"}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 70,
    alignItems: "center",
  },
  confirmButtonWrapper: {
    shadowColor: "#00C6FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "500",
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#333333",
    fontSize: 17,
    fontWeight: "600",
  },
  cropContainer: {
    flex: 1,
  },
  bottomControls: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 32,
  },
  toolButton: {
    alignItems: "center",
    padding: 8,
  },
  toolButtonActive: {
    opacity: 1,
  },
  toolButtonText: {
    color: "#666666",
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },
  toolButtonTextActive: {
    color: COLORS.primary,
    opacity: 1,
  },
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
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 4,
  },
  presetIconActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  presetText: {
    color: "rgba(0, 0, 0, 0.5)",
    fontSize: 11,
    marginTop: 6,
  },
  presetTextActive: {
    color: COLORS.primary,
  },
  aspectToggleButton: {
    position: "absolute",
    left: 16,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  aspectToggleIcon: {
    marginRight: 6,
  },
  aspectToggleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CropScreen;
