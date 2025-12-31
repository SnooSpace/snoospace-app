import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useNavigation } from "@react-navigation/native";
import { uploadMultipleImages } from "../api/cloudinary";
import { useCrop } from "./MediaCrop";

/**
 * Normalize image orientation by processing through ImageManipulator.
 * This ensures EXIF orientation is applied to the pixel data.
 *
 * NOTE: Currently bypassed because BatchCropScreen now does a two-step
 * crop process (resize then crop) which handles orientation as a side effect.
 * This avoids double-processing the image unnecessarily.
 */
const normalizeImageOrientation = async (uri) => {
  // Bypassed - BatchCropScreen's two-step process handles normalization
  return uri;
};

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#0072FF",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  border: "#E5E5E5",
};

const ImageUploader = forwardRef(
  (
    {
      maxImages = 10,
      onImagesChange,
      onAspectRatiosChange, // NEW: Callback to pass aspect ratios to parent
      initialImages = [],
      initialAspectRatios = [], // NEW: Initial aspect ratios
      style,
      enableCrop = true, // Enable crop by default for feed posts
      cropPreset = "feed_portrait", // Default to 4:5 with toggle to 1:1
      horizontal = false, // Support horizontal media tray
    },
    ref
  ) => {
    useImperativeHandle(ref, () => ({
      pick: handleAddImages,
      openCamera: async () => {
        // Direct camera logic can be added here if needed
        handleAddImages(); // Fallback to library for now or implement camera specifically
      },
    }));

    const [images, setImages] = useState(initialImages); // Cropped URIs for display/upload
    const [originalUris, setOriginalUris] = useState([]); // Original URIs for re-editing
    const [aspectRatios, setAspectRatios] = useState(initialAspectRatios); // Track aspect ratios
    const [presetKeys, setPresetKeys] = useState([]); // Track preset keys (e.g., 'feed_portrait', 'feed_square')
    const [cropMetadata, setCropMetadata] = useState([]); // Full crop data (scale, translateX, translateY) for re-edit
    const [uploading, setUploading] = useState(false);
    const [progressByIndex, setProgressByIndex] = useState({});
    const { cropImage } = useCrop();
    const navigation = useNavigation();
    const resolveRef = useRef(null);

    // Add multiple images with batch crop
    const handleAddMultipleWithCrop = async () => {
      const remainingSlots = maxImages - images.length;

      if (remainingSlots <= 0) {
        Alert.alert(
          "Limit Reached",
          `You can only add up to ${maxImages} images.`
        );
        return;
      }

      try {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please grant access to your photo library."
          );
          return;
        }

        // Multi-select images
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 1,
          selectionLimit: Math.min(remainingSlots, 10),
        });

        if (result.canceled || result.assets.length === 0) return;

        // Get image URIs and normalize orientation
        // This ensures EXIF orientation is baked into pixels so crop coordinates match
        const rawImageUris = result.assets.map((asset) => asset.uri);
        const imageUris = await Promise.all(
          rawImageUris.map((uri) => normalizeImageOrientation(uri))
        );

        console.log(
          "[ImageUploader] Normalized",
          imageUris.length,
          "images for crop"
        );

        // Navigate to BatchCropScreen for cropping
        const croppedResults = await new Promise((resolve) => {
          resolveRef.current = resolve;

          navigation.navigate("BatchCropScreen", {
            imageUris: imageUris,
            defaultPreset: cropPreset, // Default to feed_portrait (4:5) with toggle
            onComplete: (results) => {
              if (resolveRef.current) {
                resolveRef.current(results);
                resolveRef.current = null;
              }
            },
            onCancel: () => {
              if (resolveRef.current) {
                resolveRef.current(null);
                resolveRef.current = null;
              }
            },
          });
        });

        // User cancelled cropping
        if (!croppedResults || croppedResults.length === 0) return;

        // Extract data from crop results
        const newImageUris = croppedResults.map((r) => r.uri);
        const newOriginalUris = croppedResults.map(
          (r) => r.metadata?.originalUri || r.uri
        );
        const newAspectRatios = croppedResults.map(
          (r) => r.metadata?.aspectRatio || 0.8
        );
        const newPresetKeys = croppedResults.map(
          (r) => r.metadata?.preset || cropPreset
        );

        // Update all state arrays
        const updatedImages = [...images, ...newImageUris].slice(0, maxImages);
        const updatedOriginalUris = [...originalUris, ...newOriginalUris].slice(
          0,
          maxImages
        );
        const updatedAspectRatios = [...aspectRatios, ...newAspectRatios].slice(
          0,
          maxImages
        );
        const updatedPresetKeys = [...presetKeys, ...newPresetKeys].slice(
          0,
          maxImages
        );

        // NEW: Store full crop metadata for re-editing
        const newCropMetadata = croppedResults.map((r) => r.metadata || {});

        console.log(
          "[ImageUploader] Storing crop metadata:",
          newCropMetadata.map((m) => ({
            preset: m.preset,
            scale: m.scale,
            translateX: m.translateX,
            translateY: m.translateY,
          }))
        );

        const updatedCropMetadata = [...cropMetadata, ...newCropMetadata].slice(
          0,
          maxImages
        );

        setImages(updatedImages);
        setOriginalUris(updatedOriginalUris);
        setAspectRatios(updatedAspectRatios);
        setPresetKeys(updatedPresetKeys);
        setCropMetadata(updatedCropMetadata);

        if (onImagesChange) {
          onImagesChange(updatedImages);
        }
        if (onAspectRatiosChange) {
          onAspectRatiosChange(updatedAspectRatios);
        }
      } catch (error) {
        console.error("Error picking images:", error);
        Alert.alert("Error", `Failed to pick images: ${error.message}`);
      }
    };

    // Add multiple images without crop (original behavior)
    const handleAddMultiple = async () => {
      try {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Permission to access camera roll is required!"
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: true,
          quality: 0.8,
          selectionLimit: maxImages - images.length,
        });

        if (!result.canceled && result.assets) {
          const newImages = result.assets.map((asset) => asset.uri);
          const updatedImages = [...images, ...newImages].slice(0, maxImages);
          setImages(updatedImages);
          if (onImagesChange) {
            onImagesChange(updatedImages);
          }
        }
      } catch (error) {
        console.error("Error picking images:", error);
        Alert.alert("Error", `Failed to pick images: ${error.message}`);
      }
    };

    // Unified add function based on enableCrop prop
    const handleAddImages = enableCrop
      ? handleAddMultipleWithCrop
      : handleAddMultiple;

    // Edit/crop an existing image - uses ORIGINAL URI and saved preset
    const handleEditImage = async (index) => {
      if (!enableCrop) return;

      try {
        // Use ORIGINAL URI (not cropped) for re-editing, and the saved preset
        const originalUri = originalUris[index] || images[index];
        const savedPreset = presetKeys[index] || cropPreset;
        const savedCropData = cropMetadata[index] || null;

        console.log("[ImageUploader] Re-editing image:", {
          index,
          originalUri: originalUri.substring(0, 50) + "...",
          savedPreset,
          hasSavedCropData: !!savedCropData,
        });

        // Pass saved crop data for position restoration
        const result = await cropImage(originalUri, savedPreset, {
          initialCropData: savedCropData,
        });

        if (result) {
          // Update cropped image URI
          const updatedImages = [...images];
          updatedImages[index] = result.uri;

          // Update aspect ratio and preset if changed
          const updatedAspectRatios = [...aspectRatios];
          updatedAspectRatios[index] =
            result.metadata?.aspectRatio || aspectRatios[index];

          const updatedPresetKeys = [...presetKeys];
          updatedPresetKeys[index] =
            result.metadata?.preset || presetKeys[index];

          // Update crop metadata with new position
          const updatedCropMetadata = [...cropMetadata];
          updatedCropMetadata[index] = result.metadata || cropMetadata[index];

          setImages(updatedImages);
          setAspectRatios(updatedAspectRatios);
          setPresetKeys(updatedPresetKeys);
          setCropMetadata(updatedCropMetadata);

          if (onImagesChange) {
            onImagesChange(updatedImages);
          }
          if (onAspectRatiosChange) {
            onAspectRatiosChange(updatedAspectRatios);
          }
        }
      } catch (error) {
        console.error("Error editing image:", error);
      }
    };

    const removeImage = (index) => {
      const updatedImages = images.filter((_, i) => i !== index);
      const updatedOriginalUris = originalUris.filter((_, i) => i !== index);
      const updatedAspectRatios = aspectRatios.filter((_, i) => i !== index);
      const updatedPresetKeys = presetKeys.filter((_, i) => i !== index);
      const updatedCropMetadata = cropMetadata.filter((_, i) => i !== index);

      setImages(updatedImages);
      setOriginalUris(updatedOriginalUris);
      setAspectRatios(updatedAspectRatios);
      setPresetKeys(updatedPresetKeys);
      setCropMetadata(updatedCropMetadata);

      if (onImagesChange) {
        onImagesChange(updatedImages);
      }
      if (onAspectRatiosChange) {
        onAspectRatiosChange(updatedAspectRatios);
      }
    };

    const uploadAll = async () => {
      if (!images || images.length === 0) return;
      try {
        setUploading(true);
        setProgressByIndex({});

        const uploadedUrls = await uploadMultipleImages(
          images,
          (index, progress) => {
            setProgressByIndex((prev) => ({ ...prev, [index]: progress }));
          }
        );

        setImages(uploadedUrls);
        if (onImagesChange) onImagesChange(uploadedUrls);
        Alert.alert("Uploaded", "All images uploaded successfully.");
      } catch (e) {
        console.error("Upload error:", e);
        Alert.alert("Upload Failed", e?.message || "Could not upload images");
      } finally {
        setUploading(false);
      }
    };

    const renderImageGrid = () => {
      if (images.length === 0) {
        if (horizontal) return null;
        return (
          <TouchableOpacity style={styles.addButton} onPress={handleAddImages}>
            <Ionicons name="camera-outline" size={40} color={COLORS.primary} />
            <Text style={styles.addButtonText}>Add Photos</Text>
            <Text style={styles.addButtonSubtext}>
              Tap to select up to {maxImages} images
            </Text>
          </TouchableOpacity>
        );
      }

      return (
        <ScrollView
          horizontal={horizontal}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.imageGrid,
            horizontal && styles.horizontalImageGrid,
          ]}
        >
          {images.map((imageUri, index) => {
            const ar = aspectRatios[index];
            // aspectRatio decimal: width/height. If ar is [4,5], ratio is 0.8
            const ratio = Array.isArray(ar)
              ? ar[0] / ar[1]
              : typeof ar === "number"
              ? ar
              : 1;

            // Adjusted sizes for premium look
            const thumbWidth = horizontal ? 140 : (width - 60) / 2;
            const thumbHeight = horizontal ? 180 : thumbWidth / ratio;

            return (
              <View
                key={`${index}-${imageUri}`}
                style={[
                  styles.imageContainer,
                  { width: thumbWidth, height: thumbHeight },
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleEditImage(index)}
                  activeOpacity={enableCrop ? 0.7 : 1}
                  disabled={!enableCrop}
                  style={styles.imageTouch}
                >
                  <Image
                    source={{ uri: imageUri, cache: "reload" }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  {enableCrop && (
                    <View style={styles.editHint}>
                      <Ionicons name="crop" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
                {typeof progressByIndex[index] === "number" && uploading ? (
                  <View style={styles.progressOverlay}>
                    <Text style={styles.progressText}>
                      {progressByIndex[index]}%
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            );
          })}

          {images.length < maxImages && (
            <TouchableOpacity
              style={[
                styles.addMoreButton,
                horizontal && { width: 140, height: 180 },
              ]}
              onPress={handleAddImages}
            >
              <Ionicons name="add" size={32} color={COLORS.primary} />
              {horizontal && <Text style={styles.addMoreText}>Add more</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
      );
    };

    return (
      <View
        style={[
          styles.container,
          style,
          horizontal && images.length === 0 && { marginBottom: 0, height: 0 },
        ]}
      >
        {!horizontal && (
          <Text style={styles.label}>
            Photos ({images.length}/{maxImages})
          </Text>
        )}
        {renderImageGrid()}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 12,
  },
  addButton: {
    height: 120,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 8,
  },
  addButtonSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  horizontalImageGrid: {
    flexWrap: "nowrap",
    paddingRight: 20,
    gap: 12,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12, // Increased for premium look
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  imageTouch: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  addMoreButton: {
    width: (width - 60) / 2,
    height: 120, // Match default thumb height concept
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 8,
  },
  uploadButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  uploadButtonDisabled: {
    backgroundColor: "#C7B8F5",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  progressOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  editHint: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    padding: 6,
  },
});

export default ImageUploader;
