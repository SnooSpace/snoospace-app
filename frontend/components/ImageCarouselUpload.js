import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { GalleryHorizontal, Plus, Star, Trash2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { uploadEventBanner } from "../api/upload";

import { COLORS } from "../constants/theme";

/**
 * ImageCarouselUpload - Upload and manage carousel images (1-5 images)
 * Features: multi-select, batch crop, drag to reorder, delete, set primary, preview
 * Uses 1:1 square crop for event banners
 */
const ImageCarouselUpload = ({ images = [], onChange, maxImages = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation();
  const resolveRef = useRef(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const pickImages = async () => {
    const remainingSlots = maxImages - images.length;

    if (remainingSlots <= 0) {
      Alert.alert("Limit Reached", `You can upload up to ${maxImages} images.`);
      return;
    }

    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant access to your photo library.",
        );
        return;
      }

      // Multi-select images
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: Math.min(remainingSlots, 5),
      });

      if (result.canceled || result.assets.length === 0) return;

      // Get image URIs
      const imageUris = result.assets.map((asset) => asset.uri);

      // Navigate to BatchCropScreen for 1:1 crop (no aspect toggle)
      const croppedResults = await new Promise((resolve) => {
        resolveRef.current = resolve;

        navigation.navigate("BatchCropScreen", {
          imageUris: imageUris,
          defaultPreset: "banner_square", // 1:1 fixed, no aspect toggle
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

      setUploading(true);

      // Upload all cropped images
      const uploadPromises = croppedResults.map(async (cropResult, index) => {
        const uploadResult = await uploadEventBanner(cropResult.uri);
        return {
          url: uploadResult.url,
          cloudinary_public_id: uploadResult.public_id,
          order: images.length + index,
          crop_metadata: cropResult.metadata,
        };
      });

      const newImages = await Promise.all(uploadPromises);
      onChange([...images, ...newImages]);
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to upload images. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    Alert.alert("Remove Image", "Are you sure you want to remove this image?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const newImages = images.filter((_, i) => i !== index);
          // Update orders
          const reorderedImages = newImages.map((img, i) => ({
            ...img,
            order: i,
          }));
          onChange(reorderedImages);
        },
      },
    ]);
  };

  const setPrimaryImage = (index) => {
    if (index === 0) return; // Already primary

    const newImages = [...images];
    const [primaryImage] = newImages.splice(index, 1);
    newImages.unshift(primaryImage);

    // Update orders
    const reorderedImages = newImages.map((img, i) => ({ ...img, order: i }));
    onChange(reorderedImages);
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <GalleryHorizontal size={20} color={"#4B5563"} />
          </View>
          <Text style={styles.title}>Banner Images</Text>
        </View>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {images.length} / {maxImages} images
          </Text>
        </View>
      </View>

      {images.length === 0 ? (
        <TouchableWithoutFeedback
          onPress={pickImages}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={uploading}
        >
          <Animated.View
            style={[styles.uploadTile, { transform: [{ scale: scaleAnim }] }]}
          >
            {uploading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary || "#3A57E8"}
              />
            ) : (
              <>
                <View
                  style={[
                    styles.gradientCircle,
                    { backgroundColor: "#F3F4F6" },
                  ]}
                >
                  <Plus size={24} color="#6B7280" />
                </View>
                <Text style={styles.addText}>Add Banner Images</Text>
                <Text style={styles.addTextSub}>
                  Up to {maxImages} images • First image is primary
                </Text>
              </>
            )}
          </Animated.View>
        </TouchableWithoutFeedback>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {images.map((image, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: image.url }} style={styles.image} />

              {/* Primary badge */}
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>PRIMARY</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                {index > 0 && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.setPrimaryButton]}
                    onPress={() => setPrimaryImage(index)}
                  >
                    <Star size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => removeImage(index)}
                >
                  <Trash2 size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Small add button at the end */}
          {images.length < maxImages && (
            <TouchableOpacity
              style={styles.smallAddTile}
              onPress={pickImages}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.primary || "#3A57E8"} />
              ) : (
                <>
                  <View style={styles.smallAddIconWrapper}>
                    <Plus size={20} color={COLORS.primary || "#3A57E8"} />
                  </View>
                  <Text style={styles.smallAddText}>Add More</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 15,
    backgroundColor: "#F4F7FB",
    borderRadius: 24,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6", // Neutral grey matching Event Gallery
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#1F2937",
  },
  counterPill: {
    backgroundColor: "#EEF2F8",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    letterSpacing: 0.2,
  },
  uploadTile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6EAF2",
  },
  gradientCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  addText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#1C1F26",
    marginBottom: 4,
  },
  addTextSub: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
  },
  scrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 2, // Slight padding to not clip the shadow of the first item
  },
  imageWrapper: {
    marginRight: 15,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  image: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#E8EDF4",
  },
  primaryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: COLORS.primary || "#3A57E8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Manrope-SemiBold",
    letterSpacing: 0.5,
  },
  actions: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  setPrimaryButton: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 59, 48, 0.8)",
  },
  smallAddTile: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    marginRight: 15,
    marginVertical: 2, // Helps prevent shadow clipping
  },
  smallAddIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F0FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  smallAddText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: COLORS.primary || "#3A57E8",
  },
});

export default ImageCarouselUpload;
