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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../api/client";
import ImageUploader from "../../components/ImageUploader";
import EntityTagSelector from "../../components/EntityTagSelector";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
};

const SponsorCreatePostScreen = ({ navigation, route }) => {
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImagesChange = (newImages) => {
    setImages(newImages);
  };

  const handleEntitiesChange = (entities) => {
    setTaggedEntities(entities);
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
      // For now, we'll use placeholder image URLs
      // In a real app, you'd upload to Firebase Storage first
      const imageUrls = images.map((uri, index) => 
        `https://via.placeholder.com/400x400/5E17EB/FFFFFF?text=Image+${index + 1}`
      );

      const taggedEntitiesData = taggedEntities.map(entity => ({
        id: entity.id,
        type: entity.type,
        name: entity.name || entity.brand_name,
        username: entity.username
      }));

      await apiPost("/posts", {
        caption: caption.trim(),
        imageUrls,
        taggedEntities: taggedEntitiesData,
      });

      Alert.alert("Success", "Post created successfully!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = images.length > 0 && (caption.trim() || taggedEntities.length > 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Sponsor Post</Text>
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

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Caption Input */}
        <View style={styles.captionContainer}>
          <TextInput
            style={styles.captionInput}
            placeholder="Share your brand story and updates..."
            placeholderTextColor={COLORS.textLight}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2000}
            textAlignVertical="top"
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

        {/* Entity Tag Selector */}
        <EntityTagSelector
          onEntitiesChange={handleEntitiesChange}
          initialEntities={taggedEntities}
        />

        {/* Sponsor Guidelines */}
        <View style={styles.guidelinesContainer}>
          <Text style={styles.guidelinesTitle}>Sponsor Post Guidelines:</Text>
          <Text style={styles.guideline}>• Showcase your brand and products</Text>
          <Text style={styles.guideline}>• Tag relevant communities and venues</Text>
          <Text style={styles.guideline}>• Share behind-the-scenes content</Text>
          <Text style={styles.guideline}>• Engage with your target audience</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDark,
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
});

export default SponsorCreatePostScreen;
