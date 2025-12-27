/**
 * useCrop.js
 * Hook for easy integration of the CropScreen with any component.
 * Handles navigation to CropScreen and returns a promise with the result.
 */

import { useCallback, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * useCrop Hook
 * Provides methods to pick and crop images using the CropScreen.
 *
 * @returns {Object} { pickAndCrop, cropImage }
 *
 * Usage:
 *   const { pickAndCrop } = useCrop();
 *
 *   const handleAvatarChange = async () => {
 *     const result = await pickAndCrop('avatar');
 *     if (result) {
 *       setAvatarUrl(result.uri);
 *     }
 *   };
 */
export const useCrop = () => {
  const navigation = useNavigation();
  const resolveRef = useRef(null);
  const rejectRef = useRef(null);

  /**
   * Pick an image from the library and navigate to crop screen
   * @param {string} presetKey - Crop preset key ('avatar', 'banner', 'event', etc.)
   * @param {Object} options - Additional options
   * @param {boolean} options.allowPresetChange - Allow changing aspect ratio
   * @returns {Promise<Object|null>} Cropped image result or null if cancelled
   */
  const pickAndCrop = useCallback(
    async (presetKey = "avatar", options = {}) => {
      try {
        // Request permission
        const permissionResult = await requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          throw new Error("Permission to access photos is required.");
        }

        // Pick image from library (without built-in editing)
        const pickerResult = await launchImageLibraryAsync({
          mediaTypes: MediaTypeOptions.Images,
          allowsEditing: false, // We use our custom crop screen
          quality: 1, // Keep full quality for cropping
        });

        if (pickerResult.canceled || !pickerResult.assets?.[0]) {
          return null;
        }

        const imageUri = pickerResult.assets[0].uri;

        // Navigate to crop screen directly - React Native Image handles orientation
        return new Promise((resolve, reject) => {
          resolveRef.current = resolve;
          rejectRef.current = reject;

          navigation.navigate("CropScreen", {
            imageUri: imageUri,
            presetKey,
            allowPresetChange: options.allowPresetChange || false,
            onComplete: (result) => {
              if (resolveRef.current) {
                resolveRef.current(result);
                resolveRef.current = null;
                rejectRef.current = null;
              }
            },
            onCancel: () => {
              if (resolveRef.current) {
                resolveRef.current(null);
                resolveRef.current = null;
                rejectRef.current = null;
              }
            },
          });
        });
      } catch (error) {
        console.error("pickAndCrop error:", error);
        throw error;
      }
    },
    [navigation]
  );

  /**
   * Crop an existing image URI
   * @param {string} imageUri - URI of image to crop
   * @param {string} presetKey - Crop preset key
   * @param {Object} options - Additional options
   * @returns {Promise<Object|null>} Cropped image result or null if cancelled
   */
  const cropImage = useCallback(
    async (imageUri, presetKey = "avatar", options = {}) => {
      try {
        // Navigate to crop screen directly - orientation handled by Image component
        return new Promise((resolve, reject) => {
          resolveRef.current = resolve;
          rejectRef.current = reject;

          navigation.navigate("CropScreen", {
            imageUri: imageUri,
            presetKey,
            allowPresetChange: options.allowPresetChange || false,
            onComplete: (result) => {
              if (resolveRef.current) {
                resolveRef.current(result);
                resolveRef.current = null;
                rejectRef.current = null;
              }
            },
            onCancel: () => {
              if (resolveRef.current) {
                resolveRef.current(null);
                resolveRef.current = null;
                rejectRef.current = null;
              }
            },
          });
        });
      } catch (error) {
        console.error("cropImage error:", error);
        throw error;
      }
    },
    [navigation]
  );

  return { pickAndCrop, cropImage };
};

export default useCrop;
