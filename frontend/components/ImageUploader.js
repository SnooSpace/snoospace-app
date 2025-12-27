import React, { useState, useRef } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { uploadMultipleImages } from "../api/cloudinary";
import { useCrop } from "./MediaCrop";

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

const ImageUploader = ({
  maxImages = 10,
  onImagesChange,
  initialImages = [],
  style,
  enableCrop = true, // Enable crop by default for feed posts
  cropPreset = "feed_portrait", // Default to 4:5 with toggle to 1:1
}) => {
  const [images, setImages] = useState(initialImages);
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

      // Get image URIs
      const imageUris = result.assets.map((asset) => asset.uri);

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

      // Add cropped images to the list
      const newImageUris = croppedResults.map((r) => r.uri);
      const updatedImages = [...images, ...newImageUris].slice(0, maxImages);
      setImages(updatedImages);
      if (onImagesChange) {
        onImagesChange(updatedImages);
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

  // Edit/crop an existing image
  const handleEditImage = async (index) => {
    if (!enableCrop) return;

    try {
      const result = await cropImage(images[index], cropPreset);
      if (result) {
        const updatedImages = [...images];
        updatedImages[index] = result.uri;
        setImages(updatedImages);
        if (onImagesChange) {
          onImagesChange(updatedImages);
        }
      }
    } catch (error) {
      console.error("Error editing image:", error);
    }
  };

  const removeImage = (index) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    if (onImagesChange) {
      onImagesChange(updatedImages);
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
      <View style={styles.imageGrid}>
        {images.map((imageUri, index) => (
          <View key={index} style={styles.imageContainer}>
            <TouchableOpacity
              onPress={() => handleEditImage(index)}
              activeOpacity={enableCrop ? 0.7 : 1}
              disabled={!enableCrop}
            >
              <Image source={{ uri: imageUri }} style={styles.image} />
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
              <Ionicons name="close-circle" size={24} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ))}

        {images.length < maxImages && (
          <TouchableOpacity
            style={styles.addMoreButton}
            onPress={handleAddImages}
          >
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        Photos ({images.length}/{maxImages})
      </Text>
      {renderImageGrid()}
    </View>
  );
};

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
    gap: 8,
  },
  imageContainer: {
    position: "relative",
    width: (width - 60) / 3,
    height: (width - 60) / 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  addMoreButton: {
    width: (width - 60) / 3,
    height: (width - 60) / 3,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  uploadButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
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
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    padding: 4,
  },
});

export default ImageUploader;
