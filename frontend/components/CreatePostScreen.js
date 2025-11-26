import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../api/client";
import ImageUploader from "./ImageUploader";
import MentionInput from "./MentionInput";
import { getAuthToken } from "../api/auth";
import { uploadMultipleImages } from "../api/cloudinary";
import EventBus from "../utils/EventBus";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
};

const CreatePostScreen = ({ navigation, route, onPostCreated }) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Load current user profile for self-tagging
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const email = await AsyncStorage.getItem("auth_email");
        const token = await getAuthToken();
        if (!email || !token) return;
        
        const userProfileResponse = await apiPost(
          "/auth/get-user-profile",
          { email },
          15000,
          token
        );
        
        const userData = userProfileResponse?.profile;
        if (userData) {
          setCurrentUser({
            id: userData.id,
            type: userData.user_type || 'member',
            name: userData.full_name || userData.name || '',
            username: userData.username || '',
            profile_photo_url: userData.profile_photo_url || userData.logo_url || null,
          });
        }
      } catch (error) {
        console.error('Error loading current user for tagging:', error);
        // Silent fail - self-tagging just won't be available
      }
    };
    
    loadCurrentUser();
  }, []);

  const handleImagesChange = (newImages) => {
    setImages(newImages);
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


      // 5. Success: navigate to Home tab
      Alert.alert("Success", "Post created successfully!", [
        { 
          text: "OK", 
          onPress: () => {
            // Navigate to Home tab for all roles
            // First, close the CreatePost screen
            navigation.goBack();
            
            // Then navigate to Home tab
            // Use setTimeout to ensure goBack completes first
            setTimeout(() => {
              // Find the tab navigator by traversing up the navigation tree
              let currentNav = navigation;
              let tabNavigator = null;
              
              console.log('[CreatePostScreen] Starting navigation tree traversal');
              
              // Try to find the tab navigator (has jumpTo method)
              for (let i = 0; i < 5; i++) {
                const parent = currentNav.getParent();
                if (!parent) {
                  console.log(`[CreatePostScreen] No parent at level ${i}`);
                  break;
                }
                
                console.log(`[CreatePostScreen] Level ${i}:`, {
                  hasJumpTo: !!parent.jumpTo,
                  hasNavigate: !!parent.navigate,
                  state: parent.getState?.()
                });
                
                if (parent.jumpTo) {
                  tabNavigator = parent;
                  console.log(`[CreatePostScreen] Found tab navigator at level ${i}`);
                  break;
                }
                currentNav = parent;
              }
              
              if (tabNavigator && tabNavigator.jumpTo) {
                console.log('[CreatePostScreen] Jumping to Home tab');
                // For tab navigators, use jumpTo to switch to Home tab
                tabNavigator.jumpTo('Home');
              } else {
                console.log('[CreatePostScreen] Tab navigator not found, trying alternative navigation');
                // Alternative: Try to navigate to the home screen directly
                try {
                  const root = navigation.getParent()?.getParent();
                  if (root && root.navigate) {
                    // For Community, navigate to CommunityHome and then to Home tab
                    root.navigate('CommunityHome', { screen: 'Home' });
                  }
                } catch (error) {
                  console.log('[CreatePostScreen] Alternative navigation failed:', error);
                }
              }
            }, 100);
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

  const canSubmit = images.length > 0 && (caption.trim() || taggedEntities.length > 0);

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={handleCancel}
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

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Caption Input with @ Mention Support */}
          <View style={styles.captionContainer}>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              onTaggedEntitiesChange={setTaggedEntities}
              placeholder="What's on your mind? Use @ to mention someone..."
              placeholderTextColor={COLORS.textLight}
              maxLength={2000}
              style={styles.mentionInput}
              currentUser={currentUser}
            />
            <Text style={styles.characterCount}>
              {caption.length}/2000
            </Text>
          </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  captionContainer: {
    marginTop: 16,
    marginBottom: 12,
  },
  mentionInput: {
    flex: 1,
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
});

export default CreatePostScreen;
