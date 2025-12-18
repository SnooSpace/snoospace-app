import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadEventBanner } from '../api/upload';

import { COLORS } from '../constants/theme';

// Local constants removed in favor of theme constants

/**
 * ImageCarouselUpload - Upload and manage carousel images (1-5 images)
 * Features: drag to reorder, delete, set primary, preview
 */
const ImageCarouselUpload = ({ images = [], onChange, maxImages = 5 }) => {
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit Reached', `You can upload up to ${maxImages} images.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        
        // Upload to Cloudinary
        const uploadResult = await uploadEventBanner(result.assets[0].uri);

        if (uploadResult?.url) {
          const newImage = {
            url: uploadResult.url,
            cloudinary_public_id: uploadResult.public_id,
            order: images.length,
          };
          
          onChange([...images, newImage]);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const newImages = images.filter((_, i) => i !== index);
            // Update orders
            const reorderedImages = newImages.map((img, i) => ({ ...img, order: i }));
            onChange(reorderedImages);
          },
        },
      ]
    );
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Banner Carousel</Text>
        <Text style={styles.subtitle}>
          {images.length}/{maxImages} images • First image is primary
        </Text>
      </View>

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
                <Text style={styles.primaryText}>Primary</Text>
              </View>
            )}

            {/* Image order */}
            <View style={styles.orderBadge}>
              <Text style={styles.orderText}>{index + 1}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              {index > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.setPrimaryButton]}
                  onPress={() => setPrimaryImage(index)}
                >
                  <Ionicons name="star" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add image button */}
        {images.length < maxImages && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={40} color={COLORS.primary} />
                <Text style={styles.addText}>Add Image</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {images.length === 0 && (
        <Text style={styles.emptyText}>
          Add up to {maxImages} banner images. First image will be the primary banner.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  imageWrapper: {
    marginRight: 15,
    position: 'relative',
  },
  image: {
    width: 200,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  orderBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setPrimaryButton: {
    backgroundColor: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  addButton: {
    width: 200,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  addText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
});

export default ImageCarouselUpload;
