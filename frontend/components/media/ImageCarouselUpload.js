import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Alert, Animated, TouchableWithoutFeedback, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { GalleryHorizontal, Plus, Star, Trash2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { uploadEventBanner } from "../../api/upload";
import BatchCropScreen from "./BatchCropScreen";

import { COLORS } from "../../constants/theme";
import SnooLoader from "../ui/SnooLoader";

/**
 * ImageCarouselUpload - Upload and manage carousel images (1-5 images)
 * Features: multi-select, batch crop, drag to reorder, delete, set primary, preview
 * Uses 1:1 square crop for event banners
 */
const ImageCarouselUpload = ({ images = [], onChange, maxImages = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [pendingUris, setPendingUris] = useState([]);

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

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      // Get image URIs and open in-modal batch crop
      const imageUris = result.assets.map((asset) => asset.uri);
      setPendingUris(imageUris);
      setCropModalVisible(true);
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to select images. Please try again.");
    }
  };

  const handleCropComplete = async (croppedResults) => {
    setCropModalVisible(false);
    setPendingUris([]);

    if (!croppedResults || croppedResults.length === 0) return;

    setUploading(true);
    try {
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
      console.error("Error uploading banner images:", error);
      Alert.alert("Error", "Failed to upload images. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setCropModalVisible(false);
    setPendingUris([]);
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
              <SnooLoader
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
        </ScrollView>
      )}

      {images.length > 0 && images.length < maxImages && (
        <TouchableOpacity
          style={styles.smallAddTile}
          onPress={pickImages}
          disabled={uploading}
        >
          {uploading ? (
            <SnooLoader color={COLORS.primary || "#3A57E8"} />
          ) : (
            <>
              <Plus size={20} color={"#4B5563"} style={{ marginRight: 6 }} />
              <Text style={[styles.smallAddText, { fontFamily: 'Manrope-Medium' }]}>Add More Banner Images</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {cropModalVisible && (
        <Modal
          visible={cropModalVisible}
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={handleCropCancel}
        >
          <BatchCropScreen
            imageUris={pendingUris}
            defaultPreset="banner_square"
            lockedPreset="banner_square"
            onComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        </Modal>
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
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#E8EDF4",
    marginTop: 8,
  },
  smallAddText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#4B5563",
  },
});

export default ImageCarouselUpload;
