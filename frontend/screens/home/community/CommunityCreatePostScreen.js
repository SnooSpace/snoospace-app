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
import { apiPost } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityCreatePostScreen({ navigation }) {
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleImageSelect = (selectedUris) => {
    // selectedUris is an array of strings (local URIs before upload, HTTPS URLs after upload)
    setImages(selectedUris);
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
      setErrorMsg('');
      
      const token = await getAuthToken();
      
      // Use provided image URLs directly (after Upload to Cloud they will be HTTPS URLs)
      const imageUrls = images && images.length > 0 
        ? images 
        : [];
      
      const response = await apiPost('/posts', {
        caption: caption.trim() || null,
        imageUrls: imageUrls,
        taggedEntities: taggedEntities.length > 0 ? taggedEntities : null
      }, 15000, token);
      
      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setCaption('');
            setImages([]);
            setTaggedEntities([]);
            // Navigate back and refresh feed
            navigation.goBack();
            // Simple approach: use navigation events to trigger refresh
            setTimeout(() => {
              navigation.getParent()?.navigate('CommunityHomeFeed', { refresh: Date.now() });
            }, 100);
          }
        }
      ]);
      
    } catch (error) {
      console.error('Error creating post:', error);
      setErrorMsg(error?.message || 'Failed to create post');
      Alert.alert('Error', error?.message || 'Failed to create post. Please try again.');
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
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity onPress={handlePost} disabled={isPosting}>
                <Text style={styles.retryText}>{isPosting ? 'Posting...' : 'Retry'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {/* Author Info */}
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              <Ionicons name="people" size={24} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>Tech Mumbai</Text>
              <Text style={styles.authorType}>Community</Text>
            </View>
          </View>

          {/* Caption Input */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="What's happening in your community?"
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
            <Text style={styles.sectionTitle}>Tag People & Places</Text>
            <EntityTagSelector
              onEntitiesSelected={handleEntityTag}
              placeholder="Tag members, communities, sponsors, or venues"
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
            <Text style={styles.guidelinesTitle}>Community Post Guidelines</Text>
            <Text style={styles.guidelinesText}>
              • Share updates about community events and activities{'\n'}
              • Tag relevant members and partners{'\n'}
              • Keep content relevant to your community{'\n'}
              • Be respectful and inclusive
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
