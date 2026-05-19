import { useFocusEffect } from "@react-navigation/native";
/**
 * ChallengeSubmitScreen
 * Allows users to submit proof for a challenge (text, image, or video)
 */

import React, { useCallback, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ImageIcon, Camera as CameraIcon } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { apiGet, apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { uploadMultipleImages } from "../../api/cloudinary";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";
import HapticsService from "../../services/HapticsService";
import CustomImagePicker from "../../components/CustomImagePicker";
import { useToast } from "../../context/ToastContext";

const ChallengeSubmitScreen = ({ route, navigation }) => {

  const { post, participation, onSubmitSuccess } = route.params;
  const typeData = post.type_data || {};
  const submissionType = typeData.submission_type || "image";
  const { showToast } = useToast();

  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomPickerVisible, setIsCustomPickerVisible] = useState(false);

  // expo-video player for video preview
  const videoPreviewPlayer = useVideoPlayer(
    selectedVideo ? { uri: selectedVideo } : null,
    (p) => {
      p.muted = true;
      p.loop = false;
    }
  );

  // Submission status
  const [statusLoading, setStatusLoading] = useState(true);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  // Fetch submission status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/submission-status`,
          10000,
          token,
        );
        if (response.success) {
          setSubmissionStatus(response);
        }
      } catch (error) {
        console.error("Error fetching submission status:", error);
      } finally {
        setStatusLoading(false);
      }
    };
    fetchStatus();
  }, [post.id]);

  const canSubmitMore = submissionStatus?.can_submit !== false;

  const pickImage = () => {
    setIsCustomPickerVisible(true);
  };

  const handleCustomPickerDone = (assets) => {
    setIsCustomPickerVisible(false);
    if (assets && assets.length > 0) {
      const newImages = assets.map((asset) => asset.uri);
      setSelectedImages((prev) => [...prev, ...newImages].slice(0, 5));
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
        videoMaxDuration: 60,
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
    if (!canSubmitMore) {
      Alert.alert(
        "Submission Limit Reached",
        `You have already submitted ${submissionStatus.max} time(s) for this challenge.`,
      );
      return;
    }

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

      let uploadedUrls = [];
      if (selectedImages.length > 0) {
        uploadedUrls = await uploadMultipleImages(selectedImages);
      }

      let videoUrl = null;
      if (selectedVideo) {
        Alert.alert(
          "Video Upload",
          "Video uploading will be available after AWS S3 migration. Your submission has been saved with the description only.",
          [{ text: "OK" }],
        );
        videoUrl = selectedVideo;
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
        showToast(
          "Submitted! 🎉",
          typeData.require_approval
            ? "Your submission is pending review by the host."
            : "Your submission has been posted!",
          "success"
        );
        if (onSubmitSuccess) onSubmitSuccess();
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error submitting proof:", error);
      const errorMsg = error?.message || "Failed to submit. Please try again.";
      if (errorMsg.includes("can only submit")) {
        Alert.alert("Submission Limit Reached", errorMsg);
      } else {
        Alert.alert("Error", errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (!canSubmitMore) return false;
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

  const getSubmissionTypeLabel = () => {
    switch (submissionType) {
      case "video":
        return "Video";
      case "image":
        return "Photo";
      case "text":
        return "Text";
      default:
        return "Any";
    }
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
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={() => {
                HapticsService.triggerImpactLight();
                pickImage();
              }}
            >
              <ImageIcon size={30} color="#2962FF" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={() => {
                HapticsService.triggerImpactLight();
                takePhoto();
              }}
            >
              <CameraIcon size={30} color="#2962FF" strokeWidth={2} />
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
          <VideoView
            player={videoPreviewPlayer}
            style={styles.selectedVideo}
            nativeControls={true}
            contentFit="contain"
            allowsFullscreen={false}
            allowsPictureInPicture={false}
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
            <Ionicons name="videocam" size={28} color="#2962FF" />
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

  if (statusLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer} pointerEvents="none">
          <Text style={styles.headerTitle}>Submit Proof</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSubmit() || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit() || isSubmitting}
        >
          {isSubmitting ? (
            <SnooLoader size="small" color="#FFFFFF" />
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
          <View style={styles.heroCard}>
            <View style={styles.heroIconContainer}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={28}
                color="#2962FF"
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroSubtitle}>Challenge</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {typeData.title}
              </Text>
              {typeData.description ? (
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {typeData.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Submission Limit Reached Banner */}
          {!canSubmitMore && (
            <View style={styles.limitReachedBanner}>
              <Ionicons name="warning" size={20} color="#FF3B30" />
              <View style={styles.limitReachedContent}>
                <Text style={styles.limitReachedTitle}>
                  Submission Limit Reached
                </Text>
                <Text style={styles.limitReachedText}>
                  You have already used all {submissionStatus?.max || 1}{" "}
                  submission(s) for this challenge.
                  {typeData.require_approval
                    ? " If your submission was rejected, you may submit again."
                    : ""}
                </Text>
              </View>
            </View>
          )}

          {/* Guidelines Card */}
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Submission Guidelines</Text>

            {/* Submission Type */}
            <View style={styles.guidelineRow}>
              <Ionicons
                name="document-text-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.guidelineText}>
                Submission type:{" "}
                <Text style={styles.guidelineHighlight}>
                  {getSubmissionTypeLabel()}
                </Text>
              </Text>
            </View>

            {/* Submissions Allowed */}
            <View style={styles.guidelineRow}>
              <Ionicons
                name="layers-outline"
                size={16}
                color={COLORS.textSecondary}
              />
              <Text style={styles.guidelineText}>
                Submissions allowed:{" "}
                <Text style={styles.guidelineHighlight}>
                  {submissionStatus?.max || 1} per user
                </Text>
              </Text>
            </View>

            {/* Remaining with dots */}
            {submissionStatus && (
              <View style={styles.guidelineRow}>
                <Ionicons
                  name={
                    canSubmitMore
                      ? "checkmark-circle-outline"
                      : "close-circle-outline"
                  }
                  size={16}
                  color={canSubmitMore ? "#34C759" : "#FF3B30"}
                />
                <Text
                  style={[
                    styles.guidelineText,
                    !canSubmitMore && { color: "#FF3B30" },
                  ]}
                >
                  Remaining:{" "}
                  <Text style={styles.guidelineHighlight}>
                    {submissionStatus.remaining}
                  </Text>
                </Text>
                <View style={styles.limitDots}>
                  {Array.from({ length: submissionStatus.max || 1 }).map((_, i) => {
                    const usedCount =
                      (submissionStatus.max || 1) - (submissionStatus.remaining || 0);
                    return (
                      <View
                        key={i}
                        style={[
                          styles.limitDot,
                          i < usedCount && styles.limitDotFilled,
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            {/* Requires Approval */}
            {typeData.require_approval && (
              <View style={styles.guidelineRow}>
                <Ionicons name="time-outline" size={16} color="#2962FF" />
                <Text style={styles.guidelineText}>
                  Submissions require{" "}
                  <Text style={styles.guidelineHighlight}>host approval</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Only show input fields if user can still submit */}
          {canSubmitMore && (
            <>
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
                <Text style={styles.tipsTitle}>
                  Tips for a great submission:
                </Text>
                <View style={styles.tipRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                  <Text style={styles.tipText}>
                    Show clear proof of completion
                  </Text>
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
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <CustomImagePicker
        visible={isCustomPickerVisible}
        onClose={() => setIsCustomPickerVisible(false)}
        onDone={handleCustomPickerDone}
        selectionLimit={5 - selectedImages.length}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    backgroundColor: "#FFFFFF",
  },
  closeButton: {
    padding: SPACING.xs,
  },
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
  },
  submitButton: {
    backgroundColor: "#2962FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
    // Soft glow shadow
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    // Glowing border styling
    borderWidth: 1.5,
    borderColor: "rgba(255, 200, 100, 0.4)",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  keyboardView: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
  },
  heroDescription: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#4B5563",
    marginTop: 6,
    lineHeight: 19,
  },
  // Submission limit reached banner
  limitReachedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF0F0",
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.m,
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: "#FF3B3020",
  },
  limitReachedContent: {
    flex: 1,
  },
  limitReachedTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#FF3B30",
    marginBottom: 4,
  },
  limitReachedText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#CC2D26",
    lineHeight: 18,
  },
  // Guidelines card
  guidelinesCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  guidelinesTitle: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
    marginBottom: 16,
  },
  guidelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  guidelineText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
    flex: 1,
  },
  guidelineHighlight: {
    fontFamily: "Manrope-SemiBold",
    color: "#111827",
  },
  // Limit dots (Q&A style)
  limitDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  limitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  limitDotFilled: {
    backgroundColor: "#34C759",
  },
  inputSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#111827",
    minHeight: 140,
    textAlignVertical: "top",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 8,
    marginRight: 8,
  },
  mediaPicker: {
    marginBottom: 24,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageWrapper: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 20,
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
    width: "100%",
    gap: 20,
  },
  addImageButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFEEDD",
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  addImageText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#2962FF",
    marginTop: 8,
  },
  videoWrapper: {
    position: "relative",
    borderRadius: 20,
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
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    marginTop: 8,
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
    gap: 12,
  },
  videoButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: "#FFF8F0",
  },
  videoButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#2962FF",
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  tipsSection: {
    backgroundColor: "#F4F6F9",
    padding: 20,
    borderRadius: 24,
    marginBottom: 40,
  },
  tipsTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#111827",
    marginBottom: 16,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
    marginLeft: 12,
  },
});

export default ChallengeSubmitScreen;
