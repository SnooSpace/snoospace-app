/**
 * ChallengeSubmitScreen
 * Allows users to submit proof for a challenge (text, image, or video)
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { uploadMultipleImages } from "../../api/cloudinary";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const ChallengeSubmitScreen = ({ route, navigation }) => {
  const { post, participation } = route.params;
  const typeData = post.type_data || {};
  const submissionType = typeData.submission_type || "image";

  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - selectedImages.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => asset.uri);
        setSelectedImages((prev) => [...prev, ...newImages].slice(0, 5));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select images");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera access to take photos",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImages((prev) =>
          [...prev, result.assets[0].uri].slice(0, 5),
        );
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
        videoMaxDuration: 60, // 1 minute max
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to select video");
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera access to record video",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error recording video:", error);
      Alert.alert("Error", "Failed to record video");
    }
  };

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setSelectedVideo(null);
    setVideoThumbnail(null);
  };

  const handleSubmit = async () => {
    // Validate based on submission type
    if (submissionType === "text" && !content.trim()) {
      Alert.alert("Required", "Please add a description of your progress");
      return;
    }
    if (submissionType === "image" && selectedImages.length === 0) {
      Alert.alert("Required", "Please add at least one photo");
      return;
    }
    if (submissionType === "video" && !selectedVideo) {
      Alert.alert("Required", "Please add a video");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getAuthToken();

      // Upload images if any
      let uploadedUrls = [];
      if (selectedImages.length > 0) {
        uploadedUrls = await uploadMultipleImages(selectedImages);
      }

      // Upload video if any (for now, we'll use the local URI - in production, upload to cloud)
      // Video upload is deferred per user request (AWS S3 migration pending)
      let videoUrl = null;
      if (selectedVideo) {
        // TODO: Upload video to cloud storage
        // For now, we'll note that video upload is not yet implemented
        Alert.alert(
          "Video Upload",
          "Video uploading will be available after AWS S3 migration. Your submission has been saved with the description only.",
          [{ text: "OK" }],
        );
        videoUrl = selectedVideo; // Placeholder - won't work in production without cloud upload
      }

      const response = await apiPost(
        `/posts/${post.id}/challenge-submissions`,
        {
          content: content.trim(),
          media_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
          video_url: videoUrl,
          video_thumbnail: videoThumbnail,
        },
        30000,
        token,
      );

      if (response.success) {
        Alert.alert(
          "Submitted! 🎉",
          typeData.require_approval
            ? "Your submission is pending review."
            : "Your submission has been posted!",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error submitting proof:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to submit. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (submissionType === "text") {
      return content.trim().length > 0;
    }
    if (submissionType === "image") {
      return selectedImages.length > 0;
    }
    if (submissionType === "video") {
      return selectedVideo !== null;
    }
    return false;
  };

  const renderImagePicker = () => (
    <View style={styles.mediaPicker}>
      <Text style={styles.sectionLabel}>Add Photos</Text>
      <View style={styles.imagesGrid}>
        {selectedImages.map((uri, index) => (
          <View key={`img-${index}`} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.selectedImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(index)}
            >
              <Ionicons name="close-circle" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ))}
        {selectedImages.length < 5 && (
          <View style={styles.addButtonsRow}>
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Ionicons name="images" size={24} color="#FF9500" />
              <Text style={styles.addImageText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addImageButton} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color="#FF9500" />
              <Text style={styles.addImageText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const renderVideoPicker = () => (
    <View style={styles.mediaPicker}>
      <Text style={styles.sectionLabel}>Add Video</Text>
      {selectedVideo ? (
        <View style={styles.videoWrapper}>
          <Video
            source={{ uri: selectedVideo }}
            style={styles.selectedVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
            shouldPlay={false}
          />
          <TouchableOpacity
            style={styles.removeVideoButton}
            onPress={removeVideo}
          >
            <Ionicons name="close-circle" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.videoButtonsRow}>
          <TouchableOpacity style={styles.videoButton} onPress={pickVideo}>
            <Ionicons name="videocam" size={28} color="#FF9500" />
            <Text style={styles.videoButtonText}>Choose Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoButton} onPress={recordVideo}>
            <Ionicons name="radio-button-on" size={28} color={COLORS.error} />
            <Text style={styles.videoButtonText}>Record Video</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.helperText}>Maximum 60 seconds</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit Proof</Text>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit() || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Challenge Info */}
          <View style={styles.challengeInfo}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={20}
              color="#FF9500"
            />
            <Text style={styles.challengeTitle} numberOfLines={1}>
              {typeData.title}
            </Text>
          </View>

          {/* Description Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Share how you completed this challenge..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={500}
              value={content}
              onChangeText={setContent}
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>

          {/* Media Picker based on submission type */}
          {(submissionType === "image" || submissionType === "any") &&
            renderImagePicker()}
          {(submissionType === "video" || submissionType === "any") &&
            renderVideoPicker()}

          {/* Tips */}
          <View style={styles.tipsSection}>
            <Text style={styles.tipsTitle}>Tips for a great submission:</Text>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.tipText}>Show clear proof of completion</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.tipText}>Add a brief description</Text>
            </View>
            <View style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color="#34C759" />
              <Text style={styles.tipText}>Good lighting helps!</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  submitButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.m,
    minWidth: 70,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.m,
  },
  challengeInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF950010",
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.l,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FF9500",
    marginLeft: SPACING.s,
    flex: 1,
  },
  inputSection: {
    marginBottom: SPACING.l,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  textInput: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  mediaPicker: {
    marginBottom: SPACING.l,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.m,
    marginRight: SPACING.s,
    marginBottom: SPACING.s,
    overflow: "hidden",
  },
  selectedImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addButtonsRow: {
    flexDirection: "row",
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 2,
    borderColor: "#FF9500",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
    backgroundColor: "#FF950010",
  },
  addImageText: {
    fontSize: 12,
    color: "#FF9500",
    marginTop: 4,
  },
  videoWrapper: {
    position: "relative",
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
  },
  selectedVideo: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  videoSelectedText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.s,
  },
  removeVideoButton: {
    position: "absolute",
    top: SPACING.s,
    right: SPACING.s,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 14,
  },
  videoButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  videoButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.l,
    marginHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 2,
    borderColor: "#FF9500",
    borderStyle: "dashed",
    backgroundColor: "#FF950010",
  },
  videoButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#FF9500",
    marginTop: SPACING.xs,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.s,
  },
  tipsSection: {
    backgroundColor: COLORS.screenBackground,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.xl,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: SPACING.s,
  },
});

export default ChallengeSubmitScreen;
