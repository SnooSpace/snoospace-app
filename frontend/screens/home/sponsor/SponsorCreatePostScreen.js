import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ImageUploader from '../../../components/ImageUploader';
import EntityTagSelector from '../../../components/EntityTagSelector';
import { CommonActions } from '@react-navigation/native';
import { apiPost } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import { uploadMultipleImages } from '../../../api/cloudinary';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function SponsorCreatePostScreen({ navigation }) {
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isPosting, setIsPosting] = useState(false);

  const handleImageSelect = (selectedImages) => {
    setImages(selectedImages);
  };

  const handleEntityTag = (entities) => {
    setTaggedEntities(entities);
  };

  const handlePost = async () => {
    if (!caption.trim() && images.length === 0) {
      Alert.alert('Error', 'Please add a caption or image to your post');
      return;
    }

    try {
      setIsPosting(true);

      // Ensure every image is a Cloudinary URL
      let finalImages = images;
      const needsUpload = images.some(uri => !/^https:\/\//.test(uri));
      if (needsUpload) {
        finalImages = await uploadMultipleImages(images, () => {});
        if (!finalImages || !Array.isArray(finalImages) || finalImages.length === 0) {
          console.error('Image upload failed or returned empty:', finalImages);
          Alert.alert('Error', 'Image upload failed. No images to post.');
          setIsPosting(false);
          return;
        }
      }

      // Debug log before posting
      console.log('[SponsorPost] Posting with imageUrls:', finalImages);

      const token = await getAuthToken();
      const postRes = await apiPost('/posts', {
        caption: caption.trim() || null,
        imageUrls: finalImages, // must be camelCase, matches backend
        taggedEntities,
      }, 15000, token);
      if (!postRes.success) throw new Error('Could not create post');
      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setCaption('');
            setImages([]);
            setTaggedEntities([]);
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'SponsorHome' }],
              })
            );
          }
        }
      ]);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', error?.message || 'Failed to create post. Images: ' + JSON.stringify(images));
    } finally {
      setIsPosting(false);
    }
  };

  const handleCancel = () => {
    if (caption.trim() || images.length > 0) {
      Alert.alert(
        'Discard Post',
        'Are you sure you want to discard this post?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setCaption('');
              setImages([]);
              setTaggedEntities([]);
              navigation.goBack();
            }
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Create Post</Text>
          
          <TouchableOpacity
            onPress={handlePost}
            style={[
              styles.postButton,
              (!caption.trim() && images.length === 0) && styles.postButtonDisabled
            ]}
            disabled={!caption.trim() && images.length === 0 || isPosting}
          >
            <Text style={[
              styles.postButtonText,
              (!caption.trim() && images.length === 0) && styles.postButtonTextDisabled
            ]}>
              {isPosting ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Author Info */}
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              <Ionicons name="briefcase" size={24} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>TechCorp Solutions</Text>
              <Text style={styles.authorType}>Sponsor</Text>
            </View>
          </View>

          {/* Caption Input */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Share your brand story, sponsored events, or community initiatives..."
              value={caption}
              onChangeText={setCaption}
              multiline
              textAlignVertical="top"
              placeholderTextColor={LIGHT_TEXT_COLOR}
            />
          </View>

          {/* Image Uploader */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Add Photos</Text>
            <ImageUploader
              onImagesChange={handleImageSelect}
              maxImages={5}
            />
          </View>

          {/* Entity Tagging */}
          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>Tag Communities & Venues</Text>
            <EntityTagSelector
              onEntitiesSelected={handleEntityTag}
              placeholder="Tag communities, venues, or other sponsors"
            />
          </View>

          {/* Tagged Entities Display */}
          {taggedEntities.length > 0 && (
            <View style={styles.taggedEntitiesContainer}>
              <Text style={styles.taggedEntitiesTitle}>Tagged:</Text>
              <View style={styles.taggedEntitiesList}>
                {taggedEntities.map((entity, index) => (
                  <View key={index} style={styles.taggedEntity}>
                    <Text style={styles.taggedEntityText}>
                      {entity.name} ({entity.type})
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const newTagged = taggedEntities.filter((_, i) => i !== index);
                        setTaggedEntities(newTagged);
                      }}
                      style={styles.removeTagButton}
                    >
                      <Ionicons name="close" size={16} color={LIGHT_TEXT_COLOR} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Post Guidelines */}
          <View style={styles.guidelinesContainer}>
            <Text style={styles.guidelinesTitle}>Sponsor Post Guidelines</Text>
            <Text style={styles.guidelinesText}>
              • Showcase your brand activations and sponsored events{'\n'}
              • Share community initiatives and partnerships{'\n'}
              • Tag relevant communities and venues{'\n'}
              • Be transparent about sponsored content{'\n'}
              • Follow community guidelines and values
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelButton: {
    padding: 5,
  },
  cancelText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  postButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postButtonTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  authorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  authorType: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  captionContainer: {
    paddingVertical: 20,
  },
  captionInput: {
    fontSize: 16,
    color: TEXT_COLOR,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imageSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  tagSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  taggedEntitiesContainer: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  taggedEntitiesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  taggedEntitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taggedEntity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  taggedEntityText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginRight: 5,
  },
  removeTagButton: {
    padding: 2,
  },
  guidelinesContainer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  guidelinesText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 18,
  },
});
