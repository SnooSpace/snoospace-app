import React, { useState } from "react";
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
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#5E17EB",
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
  style 
}) => {
  const [images, setImages] = useState(initialImages);

  const handleAddImages = async () => {
    try {
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Permission to access camera roll is required!"
        );
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: maxImages - images.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
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

  const removeImage = (index) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    if (onImagesChange) {
      onImagesChange(updatedImages);
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
            <Image source={{ uri: imageUri }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close-circle" size={24} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        ))}
        
        {images.length < maxImages && (
          <TouchableOpacity style={styles.addMoreButton} onPress={handleAddImages}>
            <Ionicons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Photos ({images.length}/{maxImages})</Text>
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
});

export default ImageUploader;
