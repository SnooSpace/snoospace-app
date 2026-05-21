import { useFocusEffect } from "@react-navigation/native";
/**
 * ChallengeSubmitScreen
 * Allows users to submit proof for a challenge (image or video)
 *
 * Validation rules:
 *  - submission_type = "image"  → must have ≥1 photo, no video picker shown
 *  - submission_type = "video"  → must have 1 video, no image/camera picker shown
 *  - submission_type = "text"   → must have description, no media pickers shown
 *  - Description is always optional (unless type=text)
 */

import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  ArrowLeft,
  Trophy,
  Image as ImageIcon,
  Camera,
  Video,
  Circle,
  CheckCircle,
  XCircle,
  Layers,
  Clock,
  FileText,
  CircleAlert,
  X,
} from "lucide-react-native";
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
  // Only "image", "video", or "text" — "any" is not supported
  const submissionType = typeData.submission_type || "image";
  const maxImagesPerSubmission = Math.min(
    10,
    Math.max(1, parseInt(typeData.max_images_per_submission) || 5),
  );
  const { showToast } = useToast();

  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomPickerVisible, setIsCustomPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState("image");

  // expo-video player for video preview
  const videoPreviewPlayer = useVideoPlayer(
    selectedVideo ? { uri: selectedVideo } : null,
    (p) => {
      p.muted = true;
      p.loop = false;
    },
  );

  // Submission status
  const [statusLoading, setStatusLoading] = useState(true);
  const [submissionStatus, setSubmissionStatus] = useState(null);

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

  // ── Image picking ────────────────────────────────────────────────────────
  const pickImage = async () => {
    if (submissionType !== "image") return; // Guard: image-only picker
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
      ]);
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library in Settings.",
        );
        return;
      }
      setPickerMode("image");
      setIsCustomPickerVisible(true);
    } catch (error) {
      console.error("Error checking permissions for image picking:", error);
      setPickerMode("image");
      setIsCustomPickerVisible(true);
    }
  };

  const handleCustomPickerDone = (assets) => {
    setIsCustomPickerVisible(false);
    if (assets && assets.length > 0) {
      if (pickerMode === "video") {
        setSelectedVideo(assets[0].uri);
      } else {
        const newImages = assets.map((asset) => asset.uri);
        setSelectedImages((prev) =>
          [...prev, ...newImages].slice(0, maxImagesPerSubmission),
        );
      }
    }
  };

  const takePhoto = async () => {
    if (submissionType !== "image") return; // Guard: camera is image-only

    if (selectedImages.length >= maxImagesPerSubmission) {
      showToast(
        "Photo limit reached",
        `You can only add up to ${maxImagesPerSubmission} photo${maxImagesPerSubmission !== 1 ? "s" : ""} per submission.`,
        "error",
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera access to take photos",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImages((prev) => {
          const remaining = maxImagesPerSubmission - prev.length;
          if (remaining <= 0) return prev;
          return [...prev, result.assets[0].uri];
        });
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  // ── Video picking ────────────────────────────────────────────────────────
  const pickVideo = async () => {
    if (submissionType !== "video") return; // Guard: video-only picker
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, [
        "photo",
        "video",
      ]);
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your media library in Settings.",
        );
        return;
      }
      setPickerMode("video");
      setIsCustomPickerVisible(true);
    } catch (error) {
      console.error("Error checking permissions for video picking:", error);
      setPickerMode("video");
      setIsCustomPickerVisible(true);
    }
  };

  const recordVideo = () => {
    if (submissionType !== "video") return; // Guard
    navigation.navigate("ChallengeVideoRecorder", {
      onVideoRecorded: (uri) => {
        setSelectedVideo(uri);
      },
    });
  };

  const removeImage = (index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setSelectedVideo(null);
    setVideoThumbnail(null);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmitMore) {
      Alert.alert(
        "Submission Limit Reached",
        `You have already submitted ${submissionStatus.max} time(s) for this challenge.`,
      );
      return;
    }

    // Per-type media validation
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

    // Extra guard: image challenge must not carry a video, and vice versa
    if (submissionType === "image" && selectedVideo) {
      Alert.alert("Invalid submission", "This challenge requires photos only.");
      return;
    }
    if (submissionType === "video" && selectedImages.length > 0) {
      Alert.alert("Invalid submission", "This challenge requires a video only.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getAuthToken();

      let uploadedUrls = [];
      if (selectedImages.length > 0) {
        uploadedUrls = await uploadMultipleImages(selectedImages);
      }

      const videoUrl = selectedVideo ?? null;

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
          "success",
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
    if (submissionType === "text") return content.trim().length > 0;
    if (submissionType === "image") return selectedImages.length > 0;
    if (submissionType === "video") return selectedVideo !== null;
    return false;
  };

  // ── Submission type banner config ────────────────────────────────────────
  const getTypeBanner = () => {
    switch (submissionType) {
      case "video":
        return {
          icon: <Video size={20} color="#7C3AED" strokeWidth={2} />,
          label: "Video Submission",
          description: `Record or upload a video (max 60s) as your proof. A description is optional but encouraged.`,
          bg: "rgba(245, 243, 255, 0.55)",
          border: "rgba(221, 214, 254, 0.7)",
          iconBg: "rgba(237, 233, 254, 0.7)",
          labelColor: "#7C3AED",
        };
      case "text":
        return {
          icon: <FileText size={20} color="#0891B2" strokeWidth={2} />,
          label: "Text Submission",
          description: `Describe your progress in words. No media required.`,
          bg: "rgba(236, 254, 255, 0.55)",
          border: "rgba(165, 243, 252, 0.7)",
          iconBg: "rgba(207, 250, 254, 0.7)",
          labelColor: "#0891B2",
        };
      default: // "image"
        return {
          icon: <ImageIcon size={20} color="#D97706" strokeWidth={2} />,
          label: "Photo Submission",
          description: `Upload up to ${maxImagesPerSubmission} photo${maxImagesPerSubmission !== 1 ? "s" : ""} as your proof. A description is optional but encouraged.`,
          bg: "rgba(255, 251, 235, 0.55)",
          border: "rgba(253, 230, 138, 0.7)",
          iconBg: "rgba(254, 243, 199, 0.7)",
          labelColor: "#D97706",
        };
    }
  };

  // ── Render pickers ───────────────────────────────────────────────────────
  const renderImagePicker = () => (
    <View style={styles.mediaPicker}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Photos</Text>
        <Text style={styles.sectionLabelCount}>
          {selectedImages.length} / {maxImagesPerSubmission}
        </Text>
      </View>
      
      {selectedImages.length > 0 && (
        <View style={styles.imagesGrid}>
          {selectedImages.map((uri, index) => (
            <View key={`img-${index}`} style={styles.imageWrapper}>
              <Image source={{ uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <X size={14} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {selectedImages.length < maxImagesPerSubmission && (
        <View style={[
          styles.photoButtonsRow,
          selectedImages.length > 0 && { marginTop: 16 }
        ]}>
          <TouchableOpacity
            style={[
              styles.photoButton,
              {
                borderColor: "rgba(245, 158, 11, 0.25)",
                backgroundColor: "rgba(254, 243, 199, 0.55)",
              },
            ]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              pickImage();
            }}
          >
            <ImageIcon size={26} color="#D97706" strokeWidth={2} />
            <Text style={[styles.photoButtonText, { color: "#D97706" }]}>
              Choose Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.photoButton,
              {
                borderColor: "rgba(217, 119, 6, 0.25)",
                backgroundColor: "rgba(254, 243, 199, 0.35)",
              },
            ]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              takePhoto();
            }}
          >
            <Camera size={26} color="#B45309" strokeWidth={2} />
            <Text style={[styles.photoButtonText, { color: "#B45309" }]}>
              Take Photo
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderVideoPicker = () => (
    <View style={styles.mediaPicker}>
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>Video</Text>
      </View>
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
            <X size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.videoButtonsRow}>
          <TouchableOpacity
            style={[
              styles.videoButton,
              {
                borderColor: "rgba(124, 58, 237, 0.2)",
                backgroundColor: "rgba(245, 243, 255, 0.55)",
              },
            ]}
            onPress={pickVideo}
          >
            <Video size={26} color="#7C3AED" strokeWidth={2} />
            <Text style={[styles.videoButtonText, { color: "#7C3AED" }]}>
              Choose Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.videoButton,
              {
                borderColor: "rgba(239, 68, 68, 0.2)",
                backgroundColor: "rgba(254, 242, 242, 0.55)",
              },
            ]}
            onPress={recordVideo}
          >
            <Circle size={26} color="#EF4444" strokeWidth={2} fill="#EF4444" />
            <Text style={[styles.videoButtonText, { color: "#EF4444" }]}>
              Record Video
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.helperText}>Maximum 60 seconds</Text>
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const typeBanner = getTypeBanner();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
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
        <LinearGradient
          colors={["#F9FAFB", "#F1F3F5"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Challenge Info */}
          <BlurView intensity={50} tint="light" style={styles.heroCard}>
            <View style={styles.heroIconContainer}>
              <Trophy size={28} color="#D97706" strokeWidth={1.8} />
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
          </BlurView>

          {/* ── Submission Type Banner ── */}
          <BlurView
            intensity={40}
            tint="light"
            style={[
              styles.typeBanner,
              { backgroundColor: typeBanner.bg, borderColor: typeBanner.border },
            ]}
          >
            <View
              style={[
                styles.typeBannerIconWrap,
                { backgroundColor: typeBanner.iconBg },
              ]}
            >
              {typeBanner.icon}
            </View>
            <View style={styles.typeBannerText}>
              <Text
                style={[styles.typeBannerLabel, { color: typeBanner.labelColor }]}
              >
                {typeBanner.label}
              </Text>
              <Text style={styles.typeBannerDesc}>{typeBanner.description}</Text>
            </View>
          </BlurView>

          {/* Submission Limit Reached Banner */}
          {!canSubmitMore && (
            <BlurView
              intensity={40}
              tint="light"
              style={[
                styles.limitReachedBanner,
                { backgroundColor: "rgba(254, 226, 226, 0.45)", borderColor: "rgba(254, 202, 202, 0.7)" }
              ]}
            >
              <CircleAlert size={20} color="#EF4444" strokeWidth={2} />
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
            </BlurView>
          )}

          {/* Guidelines Card */}
          <BlurView intensity={50} tint="light" style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Submission Guidelines</Text>

            {/* Submissions Allowed */}
            <View style={styles.guidelineRow}>
              <Layers size={16} color={COLORS.textSecondary} strokeWidth={2} />
              <Text style={styles.guidelineText}>
                Submissions allowed:{" "}
                <Text style={styles.guidelineHighlight}>
                  {submissionStatus?.max || 1} per user
                </Text>
              </Text>
            </View>

            {/* Remaining dots */}
            {submissionStatus && (
              <View style={styles.guidelineRow}>
                {canSubmitMore ? (
                  <CheckCircle
                    size={16}
                    color="#22C55E"
                    strokeWidth={2}
                  />
                ) : (
                  <XCircle size={16} color="#EF4444" strokeWidth={2} />
                )}
                <Text
                  style={[
                    styles.guidelineText,
                    !canSubmitMore && { color: "#EF4444" },
                  ]}
                >
                  Remaining:{" "}
                  <Text style={styles.guidelineHighlight}>
                    {submissionStatus.remaining}
                  </Text>
                </Text>
                <View style={styles.limitDots}>
                  {Array.from({ length: submissionStatus.max || 1 }).map(
                    (_, i) => {
                      const usedCount =
                        (submissionStatus.max || 1) -
                        (submissionStatus.remaining || 0);
                      return (
                        <View
                          key={i}
                          style={[
                            styles.limitDot,
                            i < usedCount && styles.limitDotFilled,
                          ]}
                        />
                      );
                    },
                  )}
                </View>
              </View>
            )}

            {/* Requires Approval */}
            {typeData.require_approval && (
              <View style={styles.guidelineRow}>
                <Clock size={16} color="#2962FF" strokeWidth={2} />
                <Text style={styles.guidelineText}>
                  Submissions require{" "}
                  <Text style={styles.guidelineHighlight}>host approval</Text>
                </Text>
              </View>
            )}
          </BlurView>

          {/* Input fields — only if user can still submit */}
          {canSubmitMore && (
            <>
              {/* Media Picker — LOCKED to submission type */}
              {submissionType === "image" && renderImagePicker()}
              {submissionType === "video" && renderVideoPicker()}

              {/* Description (optional for image/video, required for text) */}
              <View style={styles.inputSection}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>Description</Text>
                  {submissionType !== "text" && (
                    <Text style={styles.optionalLabel}>(optional)</Text>
                  )}
                </View>
                <BlurView intensity={50} tint="light" style={styles.textInputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={
                      submissionType === "text"
                        ? "Describe your progress in detail..."
                        : "Tell us more about your submission... (optional)"
                    }
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    maxLength={500}
                    value={content}
                    onChangeText={setContent}
                  />
                </BlurView>
                <Text style={styles.charCount}>{content.length}/500</Text>
              </View>

              {/* Tips */}
              <BlurView intensity={30} tint="light" style={styles.tipsSection}>
                <Text style={styles.tipsTitle}>Tips for a great submission:</Text>
                <View style={styles.tipRow}>
                  <CheckCircle size={16} color="#22C55E" strokeWidth={2} />
                  <Text style={styles.tipText}>Show clear proof of completion</Text>
                </View>
                {submissionType !== "text" && (
                  <View style={styles.tipRow}>
                    <CheckCircle size={16} color="#22C55E" strokeWidth={2} />
                    <Text style={styles.tipText}>
                      Add a description to give context
                    </Text>
                  </View>
                )}
                <View style={styles.tipRow}>
                  <CheckCircle size={16} color="#22C55E" strokeWidth={2} />
                  <Text style={styles.tipText}>
                    {submissionType === "video"
                      ? "Keep it under 60 seconds"
                      : "First photo is primary"}
                  </Text>
                </View>
              </BlurView>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomImagePicker
        visible={isCustomPickerVisible}
        onClose={() => setIsCustomPickerVisible(false)}
        onDone={handleCustomPickerDone}
        selectionLimit={
          pickerMode === "video"
            ? 1
            : maxImagesPerSubmission - selectedImages.length
        }
        allowVideos={pickerMode === "video"}
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
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  // ── Hero card ──────────────────────────────────────────────────────────
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 0,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(217, 119, 6, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.15)",
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
  // ── Submission type banner ─────────────────────────────────────────────
  typeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    overflow: "hidden",
  },
  typeBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  typeBannerText: {
    flex: 1,
  },
  typeBannerLabel: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    marginBottom: 3,
  },
  typeBannerDesc: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
    lineHeight: 18,
  },
  // ── Limit reached ─────────────────────────────────────────────────────
  limitReachedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(254, 226, 226, 0.45)",
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.m,
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: "rgba(254, 202, 202, 0.7)",
    overflow: "hidden",
  },
  limitReachedContent: {
    flex: 1,
  },
  limitReachedTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#EF4444",
    marginBottom: 4,
  },
  limitReachedText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#DC2626",
    lineHeight: 18,
  },
  // ── Guidelines card ────────────────────────────────────────────────────
  guidelinesCard: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 0,
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
    fontFamily: "Manrope-Bold",
    color: "#111827",
  },
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
    backgroundColor: "#22C55E",
  },
  // ── Inputs ────────────────────────────────────────────────────────────
  inputSection: {
    marginBottom: 24,
  },
  sectionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
  },
  sectionLabelCount: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#6B7280",
  },
  optionalLabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#9CA3AF",
  },
  textInputContainer: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 0,
  },
  textInput: {
    padding: 20,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#111827",
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 8,
    marginRight: 8,
  },
  // ── Media pickers ──────────────────────────────────────────────────────
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
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  photoButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  photoButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
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
  removeVideoButton: {
    position: "absolute",
    top: SPACING.s,
    right: SPACING.s,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
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
    borderWidth: 1.5,
  },
  videoButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    marginTop: 8,
  },
  helperText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
  // ── Tips ──────────────────────────────────────────────────────────────
  tipsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    padding: 20,
    borderRadius: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
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
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
  },
});

export default ChallengeSubmitScreen;
