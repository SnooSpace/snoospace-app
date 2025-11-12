import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost, apiGet } from "../../../api/client";
import ImageUploader from "../../../components/ImageUploader";
import EntityTagSelector from "../../../components/EntityTagSelector";
import { getAuthToken } from "../../../api/auth";
import { uploadMultipleImages } from "../../../api/cloudinary";
import EventBus from "../../../utils/EventBus";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
};

const CreatePostScreen = ({ navigation, route, onPostCreated }) => {
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [tagSearchResults, setTagSearchResults] = useState([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);

  const handleImagesChange = (newImages) => {
    setImages(newImages);
  };

  const handleEntitiesChange = (entities) => {
    setTaggedEntities(entities);
  };

  const handleCaptionChange = (text) => {
    setCaption(text);
    
    // Detect '@' character
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Check if there's a space after '@' (meaning '@' is not active)
      const afterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');
      
      if (spaceIndex === -1 || spaceIndex > 0) {
        // '@' is active, show search
        setAtPosition(lastAtIndex);
        const query = afterAt.split(' ')[0];
        setTagSearchQuery(query);
        // Minimum 1 character like comments
        if (query.length >= 1) {
          searchForTagging(query);
        } else {
          setShowTagSearch(false);
        }
      } else {
        setShowTagSearch(false);
        setAtPosition(-1);
      }
    } else {
      setShowTagSearch(false);
      setAtPosition(-1);
    }
  };

  const searchForTagging = async (query) => {
    if (query.length < 1) {
      setShowTagSearch(false);
      return;
    }
    
    setTagSearchLoading(true);
    setShowTagSearch(true);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        console.warn('No auth token available for search');
        setTagSearchResults([]);
        setShowTagSearch(false);
        return;
      }

      // Use the same endpoint as EntityTagSelector
      const membersRes = await apiGet(`/members/search?q=${encodeURIComponent(query)}`, 15000, token);
      const members = membersRes.results || membersRes.members || [];
      setTagSearchResults(members);
    } catch (error) {
      console.error('Error searching for tagging:', error);
      setTagSearchResults([]);
    } finally {
      setTagSearchLoading(false);
    }
  };

  const selectTaggedUser = (user) => {
    if (atPosition === -1) return;
    
    const beforeAt = caption.substring(0, atPosition);
    const afterAt = caption.substring(atPosition + 1);
    const spaceIndex = afterAt.indexOf(' ');
    const afterTag = spaceIndex === -1 ? '' : afterAt.substring(spaceIndex);
    
    // Insert username
    const newText = `${beforeAt}@${user.username}${afterTag}`;
    setCaption(newText);
    
    // Add to tagged entities if not already there
    const existing = taggedEntities.find(t => t.id === user.id && t.type === 'member');
    if (!existing) {
      setTaggedEntities([...taggedEntities, {
        id: user.id,
        type: 'member',
        username: user.username,
      }]);
    }
    
    // Hide search
    setShowTagSearch(false);
    setAtPosition(-1);
    setTagSearchQuery('');
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      Alert.alert("No Images", "Please add at least one image to your post");
      return;
    }

    if (!caption.trim() && taggedEntities.length === 0) {
      Alert.alert("Empty Post", "Please add a caption or tag someone");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload images to Cloudinary
      const imageUrls = await uploadMultipleImages(images);
      
      // 2. Prepare tagged entities data
      const taggedEntitiesData = taggedEntities.map(entity => ({
        id: entity.id,
        type: entity.type,
      }));

      // 3. Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      // 4. Send post data to the backend
      await apiPost("/posts", {
        caption: caption.trim(),
        imageUrls,
        taggedEntities: taggedEntitiesData,
      }, 15000, token);

      // Emit event to refresh feed
      EventBus.emit('post-created');

      // 5. Success: navigate back or to Home tab
      Alert.alert("Success", "Post created successfully!", [
        { 
          text: "OK", 
          onPress: () => {
            // Use callback to switch to Home tab if provided (from BottomTabNavigator)
            if (onPostCreated) {
              onPostCreated();
            } else {
              // Navigate back to Profile if we came from there, otherwise go to Home
              const parent = navigation.getParent();
              if (parent) {
                // Check if we're in ProfileStackNavigator
                const state = navigation.getState();
                const routes = state?.routes || [];
                const isFromProfile = routes.some(r => r.name === 'Profile');
                if (isFromProfile) {
                  navigation.goBack();
                } else {
                  // Navigate to Home tab
                  const root = parent.getParent ? parent.getParent() : parent;
                  if (root) {
                    root.navigate('MemberHome', { screen: 'Home' });
                  }
                }
              }
            }
          }
        }
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = images.length > 0 && (caption.trim() || taggedEntities.length > 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            style={[
              styles.shareButton,
              (!canSubmit || isSubmitting) && styles.shareButtonDisabled
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.shareButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {/* Caption Input */}
        <View style={[styles.captionContainer, { position: 'relative' }]}>
          <TextInput
            style={styles.captionInput}
            placeholder="What's on your mind?"
            placeholderTextColor={COLORS.textLight}
            value={caption}
            onChangeText={handleCaptionChange}
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>
            {caption.length}/2000
          </Text>
          {showTagSearch && (
            <View style={styles.tagSearchContainer}>
              {tagSearchLoading ? (
                <View style={styles.tagSearchItem}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : tagSearchResults.length > 0 ? (
                <FlatList
                  data={tagSearchResults}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.tagSearchItem}
                      onPress={() => selectTaggedUser(item)}
                    >
                      <Image
                        source={{
                          uri: item.profile_photo_url || 'https://via.placeholder.com/30',
                        }}
                        style={styles.tagSearchAvatar}
                      />
                      <View style={styles.tagSearchInfo}>
                        <Text style={styles.tagSearchName} numberOfLines={1}>
                          {item.full_name || item.name || 'User'}
                        </Text>
                        <Text style={styles.tagSearchUsername} numberOfLines={1}>
                          @{item.username || 'user'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.tagSearchList}
                  keyboardShouldPersistTaps="handled"
                />
              ) : (
                <View style={styles.tagSearchItem}>
                  <Text style={styles.tagSearchEmpty}>No users found</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Entity Tag Selector */}
        <EntityTagSelector
          onEntitiesChange={handleEntitiesChange}
          initialEntities={taggedEntities}
        />

        {/* Image Uploader */}
        <ImageUploader
          maxImages={10}
          onImagesChange={handleImagesChange}
          initialImages={images}
        />

        {/* Post Guidelines */}
        <View style={styles.guidelinesContainer}>
          <Text style={styles.guidelinesTitle}>Post Guidelines:</Text>
          <Text style={styles.guideline}>• Be respectful and kind</Text>
          <Text style={styles.guideline}>• No spam or inappropriate content</Text>
          <Text style={styles.guideline}>• Tag relevant people and places</Text>
          <Text style={styles.guideline}>• Share meaningful moments</Text>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: 15,
  },
  captionContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.textDark,
    minHeight: 100,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "right",
    marginTop: 8,
  },
  guidelinesContainer: {
    backgroundColor: "#F8F9FA",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  guideline: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 4,
    lineHeight: 18,
  },
  tagSearchContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    maxHeight: 200,
    marginBottom: 4,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tagSearchList: {
    maxHeight: 200,
  },
  tagSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tagSearchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  tagSearchInfo: {
    flex: 1,
  },
  tagSearchName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  tagSearchUsername: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  tagSearchEmpty: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingVertical: 10,
  },
});

export default CreatePostScreen;