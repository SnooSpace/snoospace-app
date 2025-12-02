import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadEventGallery } from '../api/upload';

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * EventGalleryUpload - Upload and manage additional event gallery images (0-20 images)
 * Features: grid view, delete, reorder
 */
const EventGalleryUpload = ({ images = [], onChange, maxImages = 20 }) => {
  const [uploading, setUploading] = useState(false);

  const pickImages = async () => {
    const remainingSlots = maxImages - images.length;
    
    if (remainingSlots <=0) {
      Alert.alert('Limit Reached', `You can upload up to ${maxImages} gallery images.`);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: Math.min(remainingSlots, 10), // Max 10 at a time
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);

        // Upload all selected images to Cloudinary
        const imageUris = result.assets.map(asset => asset.uri);
        const uploadResult = await uploadEventGallery(imageUris);

        if (uploadResult?.data && Array.isArray(uploadResult.data)) {
          const newImages = uploadResult.data.map((img, index) => ({
            url: img.url,
            cloudinary_public_id: img.public_id,
            order: images.length + index,
          }));

          onChange([...images, ...newImages]);
        }

        setUploading(false);
      }
    } catch (error) {
      console.error('Error uploading gallery images:', error);
      Alert.alert('Error', 'Failed to upload images. Please try again.');
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

  const renderGalleryItem = ({ item, index }) => (
    <View style={styles.galleryItem}>
      <Image source={{ uri: item.url }} style={styles.galleryImage} />
      
      {/* Order badge */}
      <View style={styles.orderBadge}>
        <Text style={styles.orderText}>{index + 1}</Text>
      </View>

      {/* Delete button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeImage(index)}
      >
        <Ionicons name="close-circle" size={24} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Event Gallery (Optional)</Text>
        <Text style={styles.subtitle}>
          {images.length}/{maxImages} images • Additional photos for your event
        </Text>
      </View>

      {images.length > 0 && (
        <FlatList
          data={images}
          renderItem={renderGalleryItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={3}
          columnWrapperStyle={styles.row}
          scrollEnabled={false}
        />
      )}

      {/* Add images button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={pickImages}
        disabled={uploading || images.length >= maxImages}
      >
        {uploading ? (
          <ActivityIndicator color={PRIMARY_COLOR} />
        ) : (
          <>
            <Ionicons name="images-outline" size={32} color={PRIMARY_COLOR} />
            <Text style={styles.addButtonText}>
              {images.length === 0 ? 'Add Gallery Images' : 'Add More Images'}
            </Text>
            <Text style={styles.addButtonSubtext}>
              {maxImages - images.length} slots remaining
            </Text>
          </>
        )}
      </TouchableOpacity>

      {images.length === 0 && (
        <Text style={styles.emptyText}>
          Gallery images help showcase your event. You can add up to {maxImages} photos.
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
    marginBottom: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  row: {
    marginBottom: 10,
    justifyContent: 'flex-start',
  },
  galleryItem: {
    width: '31%',
    aspectRatio: 1,
    marginRight: '3.5%',
    position: 'relative',
    marginBottom: 10,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  orderBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  addButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: LIGHT_TEXT_COLOR,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    marginTop: 10,
  },
  addButtonText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  addButtonSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  emptyText: {
    textAlign: 'center',
    color: LIGHT_TEXT_COLOR,
    fontSize: 12,
    marginTop: 15,
    paddingHorizontal: 20,
  },
});

export default EventGalleryUpload;
