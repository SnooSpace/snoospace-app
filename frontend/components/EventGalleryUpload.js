import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, FlatList, Alert, Animated, TouchableWithoutFeedback } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { Images, Plus, X } from "lucide-react-native";
import { uploadEventGallery } from "../api/upload";
import { COLORS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";

/**
 * EventGalleryUpload - Upload and manage additional event gallery images (0-20 images)
 * Features: grid view, delete, reorder, Instagram-style crop for each image
 */
const EventGalleryUpload = ({ images = [], onChange, maxImages = 20 }) => {
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation();
  const resolveRef = useRef(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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
      Alert.alert(
        "Limit Reached",
        `You can upload up to ${maxImages} gallery images.`,
      );
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: Math.min(remainingSlots, 10), // Max 10 at a time
      });

      if (!result.canceled && result.assets.length > 0) {
        // Get image URIs directly - no slow normalization needed
        const imageUris = result.assets.map((asset) => asset.uri);

        // Navigate to BatchCropScreen with selected images
        const croppedResults = await new Promise((resolve) => {
          resolveRef.current = resolve;

          navigation.navigate("BatchCropScreen", {
            imageUris: imageUris,
            defaultPreset: "feed_portrait", // 4:5 default
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
        if (!croppedResults || croppedResults.length === 0) {
          return;
        }

        setUploading(true);

        try {
          // Upload all cropped images to Cloudinary
          const imageUris = croppedResults.map((r) => r.uri);
          const uploadResults = await uploadEventGallery(imageUris);

          if (uploadResults && Array.isArray(uploadResults)) {
            const newImages = uploadResults.map((img, index) => ({
              url: img.url,
              cloudinary_public_id: img.public_id,
              order: images.length + index,
              crop_metadata: croppedResults[index]?.metadata,
            }));

            onChange([...images, ...newImages]);
          }

          setUploading(false);
        } catch (uploadError) {
          console.error("Error uploading gallery images:", uploadError);
          Alert.alert("Error", "Failed to upload images. Please try again.");
          setUploading(false);
        }
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to pick images. Please try again.");
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

  const renderGalleryItem = ({ item, index }) => (
    <View style={styles.galleryItem}>
      <Image source={{ uri: item.url }} style={styles.galleryImage} />

      {/* Delete button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeImage(index)}
      >
        <X size={14} color="#FFFFFF" strokeWidth={3} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.cardContainer}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Images size={20} color={"#4B5563"} />
          </View>
          <Text style={styles.title}>Event Gallery • Optional</Text>
        </View>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>
            {images.length} / {maxImages}
          </Text>
        </View>
      </View>

      {images.length === 0 ? (
        <TouchableWithoutFeedback
          onPress={pickImages}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={uploading || images.length >= maxImages}
        >
          <Animated.View
            style={[styles.uploadTile, { transform: [{ scale: scaleAnim }] }]}
          >
            {uploading ? (
              <SnooLoader size="large" color={"#4B5563"} />
            ) : (
              <>
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor: "#F3F4F6",
                      marginBottom: 12,
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                    },
                  ]}
                >
                  <Plus size={24} color="#6B7280" />
                </View>
                <Text style={styles.addText}>Add Gallery Images</Text>
                <Text style={styles.addTextSub}>
                  Showcase your event (up to {maxImages} photos)
                </Text>
              </>
            )}
          </Animated.View>
        </TouchableWithoutFeedback>
      ) : (
        <View>
          <FlatList
            data={images}
            renderItem={renderGalleryItem}
            keyExtractor={(item, index) => index.toString()}
            numColumns={3}
            columnWrapperStyle={styles.row}
            scrollEnabled={false}
          />
          {images.length < maxImages && (
            <TouchableOpacity
              style={styles.smallAddTile}
              onPress={pickImages}
              disabled={uploading}
            >
              {uploading ? (
                <SnooLoader color={"#4B5563"} />
              ) : (
                <>
                  <Plus
                    size={20}
                    color={"#4B5563"}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.smallAddText, { fontFamily: 'Manrope-Medium' }]}>
                    Add More Gallery Images
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
    backgroundColor: "#F3F4F6", // lighter gray-blue/neutral tint
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    marginTop: 2,
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
    borderColor: "#E8EDF4",
  },
  addText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#1C1F26",
    marginBottom: 4,
  },
  addTextSub: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    textAlign: "center",
  },
  row: {
    marginBottom: 10,
    justifyContent: "flex-start",
  },
  galleryItem: {
    width: "31%",
    aspectRatio: 1,
    marginRight: "3.5%",
    position: "relative",
    marginBottom: 10,
  },
  galleryImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#E8EDF4",
  },
  deleteButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
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

export default EventGalleryUpload;
