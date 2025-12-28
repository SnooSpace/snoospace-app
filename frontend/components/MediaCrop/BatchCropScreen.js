/**
 * BatchCropScreen.js
 * Multi-image batch crop editor with thumbnail strip.
 * Allows selecting multiple images, cropping each one, then returning all results.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import CropView from "./CropView";
import { getPreset } from "./CropPresets";
import { calculateCropRegion } from "./CropUtils";
import { COLORS } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const THUMBNAIL_SIZE = 60;

/**
 * BatchCropScreen Component
 * Multi-image crop editor with thumbnail strip at bottom.
 *
 * Route params:
 * - imageUris: Array of image URIs to crop
 * - defaultPreset: Initial preset key ('feed_portrait' or 'feed_square')
 * - onComplete: Callback with array of cropped image results
 * - onCancel: Callback when cancelled
 */
const BatchCropScreen = ({ route, navigation }) => {
  const {
    imageUris = [],
    defaultPreset = "feed_portrait",
    onComplete,
    onCancel,
  } = route?.params || {};

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPresetKey, setCurrentPresetKey] = useState(defaultPreset);
  const [processing, setProcessing] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // Track crop data for each image
  const [cropDataMap, setCropDataMap] = useState({});

  // Track which images have been cropped
  const [croppedImages, setCroppedImages] = useState({});

  // Current image URI
  const currentImageUri = imageUris[currentIndex] || "";

  // Current preset configuration
  const preset = getPreset(currentPresetKey);

  // Check if this is a feed post mode (allows 1:1 <-> 4:5 toggle)
  const isFeedMode = [
    "feed_square",
    "feed_portrait",
    "feed_landscape",
  ].includes(currentPresetKey);

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
      // Store crop data for current image
      setCropDataMap((prev) => ({
        ...prev,
        [currentIndex]: { ...data, presetKey: currentPresetKey },
      }));
    },
    [currentIndex, currentPresetKey]
  );

  // Toggle between feed aspect ratios (1:1 <-> 4:5)
  const handleAspectToggle = useCallback(() => {
    if (currentPresetKey === "feed_square") {
      setCurrentPresetKey("feed_portrait");
    } else {
      setCurrentPresetKey("feed_square");
    }
  }, [currentPresetKey]);

  // Handle thumbnail tap to switch image
  const handleThumbnailPress = useCallback(
    (index) => {
      // Save current crop data before switching
      setCropDataMap((prev) => ({
        ...prev,
        [currentIndex]: { ...cropDataRef.current, presetKey: currentPresetKey },
      }));
      setCurrentIndex(index);
    },
    [currentIndex, currentPresetKey]
  );

  // Mark current image as cropped when user explicitly crops it
  const handleCropCurrent = useCallback(async () => {
    const cropData = cropDataRef.current;

    if (!cropData.imageWidth || !cropData.imageHeight) {
      return;
    }

    try {
      const initialScale = cropData.displayWidth / cropData.imageWidth || 1;
      const effectiveScale = initialScale * cropData.scale;

      console.log(
        "[DEBUG Crop] cropData:",
        JSON.stringify({
          imageWidth: cropData.imageWidth,
          imageHeight: cropData.imageHeight,
          displayWidth: cropData.displayWidth,
          displayHeight: cropData.displayHeight,
          frameWidth: cropData.frameWidth,
          frameHeight: cropData.frameHeight,
          scale: cropData.scale,
          translateX: cropData.translateX,
          translateY: cropData.translateY,
        })
      );
      console.log(
        "[DEBUG Crop] initialScale:",
        initialScale,
        "effectiveScale:",
        effectiveScale
      );

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

      console.log("[DEBUG Crop] cropRegion:", JSON.stringify(cropRegion));

      const result = await ImageManipulator.manipulateAsync(
        currentImageUri,
        [
          {
            crop: {
              originX: Math.round(cropRegion.originX),
              originY: Math.round(cropRegion.originY),
              width: Math.round(cropRegion.width),
              height: Math.round(cropRegion.height),
            },
          },
          ...(cropRegion.width > preset.recommendedWidth
            ? [{ resize: { width: preset.recommendedWidth } }]
            : []),
        ],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log(
        "[DEBUG Crop] ImageManipulator result:",
        JSON.stringify({
          width: result.width,
          height: result.height,
          uri: result.uri,
        })
      );

      // Mark as cropped with the result
      setCroppedImages((prev) => ({
        ...prev,
        [currentIndex]: {
          uri: result.uri,
          width: result.width,
          height: result.height,
          metadata: {
            preset: currentPresetKey,
            aspectRatio: preset.aspectRatio,
            originalUri: currentImageUri,
          },
        },
      }));

      // Auto-advance to next uncropped image
      const nextUncropped = imageUris.findIndex(
        (_, i) => i > currentIndex && !croppedImages[i]
      );
      if (nextUncropped !== -1) {
        setCurrentIndex(nextUncropped);
      }
    } catch (error) {
      console.error("Crop error:", error);
      Alert.alert("Error", "Failed to crop image. Please try again.");
    }
  }, [
    currentImageUri,
    currentIndex,
    currentPresetKey,
    preset,
    croppedImages,
    imageUris,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onCancel]);

  // Handle done - crop all remaining images and return results
  const handleDone = useCallback(async () => {
    setProcessing(true);

    try {
      const results = [];

      for (let i = 0; i < imageUris.length; i++) {
        // If already cropped, use existing result
        if (croppedImages[i]) {
          console.log(
            "[DEBUG Done] Using pre-cropped image:",
            JSON.stringify({
              index: i,
              width: croppedImages[i].width,
              height: croppedImages[i].height,
            })
          );
          results.push(croppedImages[i]);
          continue;
        }

        // Otherwise, crop with current/default settings
        const imageUri = imageUris[i];
        const savedCropData = cropDataMap[i] || cropDataRef.current;
        const presetKey = savedCropData.presetKey || currentPresetKey;
        const currentPreset = getPreset(presetKey);

        // If no crop data, just resize the image
        if (!savedCropData.imageWidth || !savedCropData.imageHeight) {
          const result = await ImageManipulator.manipulateAsync(imageUri, [], {
            compress: 0.85,
            format: ImageManipulator.SaveFormat.JPEG,
          });
          results.push({
            uri: result.uri,
            width: result.width,
            height: result.height,
            metadata: {
              preset: presetKey,
              aspectRatio: currentPreset.aspectRatio,
              originalUri: imageUri,
            },
          });
          continue;
        }

        const initialScale =
          savedCropData.displayWidth / savedCropData.imageWidth || 1;
        const effectiveScale = initialScale * savedCropData.scale;

        const cropRegion = calculateCropRegion({
          imageWidth: savedCropData.imageWidth,
          imageHeight: savedCropData.imageHeight,
          frameWidth: savedCropData.frameWidth,
          frameHeight: savedCropData.frameHeight,
          scale: effectiveScale,
          translateX: savedCropData.translateX,
          translateY: savedCropData.translateY,
          displayWidth: savedCropData.displayWidth,
          displayHeight: savedCropData.displayHeight,
        });

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [
            {
              crop: {
                originX: Math.round(cropRegion.originX),
                originY: Math.round(cropRegion.originY),
                width: Math.round(cropRegion.width),
                height: Math.round(cropRegion.height),
              },
            },
            ...(cropRegion.width > currentPreset.recommendedWidth
              ? [{ resize: { width: currentPreset.recommendedWidth } }]
              : []),
          ],
          {
            compress: 0.85,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        results.push({
          uri: result.uri,
          width: result.width,
          height: result.height,
          metadata: {
            preset: presetKey,
            aspectRatio: currentPreset.aspectRatio,
            originalUri: imageUri,
          },
        });
      }

      if (onComplete) {
        onComplete(results);
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (error) {
      console.error("Batch crop error:", error);
      Alert.alert("Error", "Failed to process images. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [
    imageUris,
    croppedImages,
    cropDataMap,
    currentPresetKey,
    navigation,
    onComplete,
  ]);

  // Count cropped images
  const croppedCount = Object.keys(croppedImages).length;
  const allCropped = croppedCount === imageUris.length;

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

          <Text style={styles.headerTitle}>
            {currentIndex + 1} of {imageUris.length}
          </Text>

          <TouchableOpacity
            style={[styles.headerButton, styles.doneButtonWrapper]}
            onPress={handleDone}
            disabled={processing}
          >
            <LinearGradient
              colors={["#00C6FF", "#0072FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.doneButton}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.doneText}>Done</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Crop View */}
        <View style={styles.cropContainer}>
          <CropView
            key={`${currentIndex}-${currentPresetKey}`}
            imageUri={currentImageUri}
            aspectRatio={preset.aspectRatio}
            maxZoom={preset.maxZoom}
            showGrid={showGrid}
            isCircular={false}
            onCropChange={handleCropChange}
          />

          {/* Aspect Ratio Toggle Button - only for feed presets */}
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
                {currentPresetKey === "feed_square" ? "1:1" : "4:5"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom Controls with Thumbnail Strip */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomControls}>
          {/* Tool buttons */}
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>
              {currentIndex + 1}/{imageUris.length}
            </Text>
            <TouchableOpacity
              style={[styles.toolButton, showGrid && styles.toolButtonActive]}
              onPress={() => setShowGrid(!showGrid)}
            >
              <Ionicons
                name="grid-outline"
                size={20}
                color={showGrid ? COLORS.primary : "#666666"}
              />
            </TouchableOpacity>
          </View>

          {/* Thumbnail Strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailContainer}
          >
            {imageUris.map((uri, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.thumbnailWrapper,
                  currentIndex === index && styles.thumbnailActive,
                ]}
                onPress={() => handleThumbnailPress(index)}
              >
                <Image source={{ uri }} style={styles.thumbnail} />

                {/* Cropped checkmark */}
                {croppedImages[index] && (
                  <View style={styles.croppedBadge}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}

                {/* Current indicator */}
                {currentIndex === index && (
                  <View style={styles.currentIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  doneButtonWrapper: {
    shadowColor: "#00C6FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  doneButton: {
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
  doneText: {
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
    paddingTop: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 14,
    color: "#666666",
    fontWeight: "500",
  },
  toolButton: {
    padding: 8,
  },
  toolButtonActive: {
    opacity: 1,
  },
  thumbnailContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  thumbnailWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    marginRight: 10,
  },
  thumbnailActive: {
    borderColor: COLORS.primary,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
  },
  croppedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
  },
  currentIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.primary,
  },
  aspectToggleButton: {
    position: "absolute",
    left: 16,
    bottom: 16,
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
  cropCurrentButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34C759",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cropCurrentText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
});

export default BatchCropScreen;
