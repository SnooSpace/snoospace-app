import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  X,
  Plus,
  Camera,
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
} from "lucide-react-native";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../constants/theme";

import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useNavigation } from "@react-navigation/native";
import { uploadMultipleImages, uploadMultipleMedia } from "../api/cloudinary";

import {
  useCrop,
  findClosestVideoPreset,
  createNaturalVideoPreset,
} from "./MediaCrop";
import VideoPlayer from "./VideoPlayer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// Mock Feed Card Header for Preview
const FeedCardHeader = ({ name = "You" }) => (
  <View style={styles.previewHeader}>
    <View style={styles.previewAvatar} />
    <View>
      <Text style={styles.previewName}>{name}</Text>
      <Text style={styles.previewTime}>Just now • Public</Text>
    </View>
    <View style={{ flex: 1 }} />
    <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
  </View>
);

// Mock Feed Card Footer for Preview
const FeedCardFooter = () => (
  <View style={styles.previewFooter}>
    <View style={styles.previewActionRow}>
      <Ionicons name="heart-outline" size={24} color="#333" />
      <Ionicons name="chatbubble-outline" size={24} color="#333" />
      <Ionicons name="paper-plane-outline" size={24} color="#333" />
      <View style={{ flex: 1 }} />
      <Ionicons name="bookmark-outline" size={24} color="#333" />
    </View>
  </View>
);

/**
 * Normalize image orientation by processing through ImageManipulator.
 * This ensures EXIF orientation is applied to the pixel data.
 *
 * NOTE: Currently bypassed because BatchCropScreen now does a two-step
 * crop process (resize then crop) which handles orientation as a side effect.
 * This avoids double-processing the image unnecessarily.
 */
const normalizeImageOrientation = async (uri) => {
  // Bypassed - BatchCropScreen's two-step process handles normalization
  return uri;
};

const { width } = Dimensions.get("window");

const LEGACY_COLORS = {
  primary: "#0072FF",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  border: "#E5E5E5",
};

const ImageUploader = forwardRef(
  (
    {
      maxImages = 10,
      minRequired = 0, // Minimum required photos
      onImagesChange,
      onAspectRatiosChange, // Callback to pass aspect ratios to parent
      onMediaTypesChange, // NEW: Callback to pass media types to parent
      onCropMetadataChange, // NEW: Callback to pass crop metadata to parent
      initialImages = [],
      initialAspectRatios = [], // Initial aspect ratios
      initialMediaTypes = [], // NEW: Initial media types ('image' | 'video')
      caption = "", // NEW: Caption for preview
      currentUser = null, // NEW: User data for preview
      style,
      enableCrop = true, // Enable crop by default for feed posts
      cropPreset = "feed_portrait", // Default to 4:5 with toggle to 1:1
      horizontal = false, // Support horizontal media tray
      hingeStyle = false, // Enable Hinge-style 2x3 grid
      allowVideos = false, // NEW: Enable video picking
      containerPadding = 48, // Optional: Horizontal padding subtracted from width
    },
    ref,
  ) => {
    useImperativeHandle(ref, () => ({
      pick: (targetIndex) => handleAddImages(targetIndex),
      pickVideo: () =>
        handleAddImages(null, ImagePicker.MediaTypeOptions.Videos),
      openCamera: async () => {
        // Direct camera logic can be added here if needed
        handleAddImages(); // Fallback to library for now or implement camera specifically
      },
    }));

    // Initialize state with fixed-size arrays for Hinge mode (sparse), or dense for normal mode
    const initializeState = (items, totalSlots) => {
      if (hingeStyle) {
        // Create full array of length maxImages, filled with items + nulls
        const arr = new Array(totalSlots).fill(null);
        items.forEach((item, i) => {
          if (i < totalSlots) arr[i] = item;
        });
        return arr;
      }
      return items;
    };

    const [images, setImages] = useState(() =>
      initializeState(initialImages, maxImages),
    );
    // For auxiliary arrays in Hinge mode, we need to ensure they match images format
    // But since they start empty, we just init with empty or null-filled based on mode
    const [originalUris, setOriginalUris] = useState(() =>
      hingeStyle ? new Array(maxImages).fill(null) : [],
    );
    const [aspectRatios, setAspectRatios] = useState(() => {
      if (hingeStyle) {
        const arr = new Array(maxImages).fill(null);
        initialAspectRatios.forEach((r, i) => {
          if (i < maxImages) arr[i] = r;
        });
        return arr;
      }
      return initialAspectRatios;
    });
    const [presetKeys, setPresetKeys] = useState(() =>
      hingeStyle ? new Array(maxImages).fill(null) : [],
    );
    const [cropMetadata, setCropMetadata] = useState(() =>
      hingeStyle ? new Array(maxImages).fill(null) : [],
    );
    // NEW: Track media types (image or video)
    const [mediaTypes, setMediaTypes] = useState(() => {
      if (hingeStyle) {
        const arr = new Array(maxImages).fill(null);
        initialMediaTypes.forEach((t, i) => {
          if (i < maxImages) arr[i] = t;
        });
        return arr;
      }
      return initialMediaTypes;
    });

    const [uploading, setUploading] = useState(false);
    const [progressByIndex, setProgressByIndex] = useState({});
    const [selectedForReorder, setSelectedForReorder] = useState(null); // Index of photo selected for reordering

    // NEW: Video Preview State
    const [previewVideoUri, setPreviewVideoUri] = useState(null);
    const [previewVideoMetadata, setPreviewVideoMetadata] = useState(null);
    const [previewVideoIndex, setPreviewVideoIndex] = useState(null);
    const [isVideoPreviewVisible, setIsVideoPreviewVisible] = useState(false);

    const { cropImage } = useCrop();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const resolveRef = useRef(null);
    const hasInitializedRef = useRef(false);

    // Sync initialImages when they change (e.g., after API load)
    React.useEffect(() => {
      // Only initialize once - don't overwrite user edits
      if (!hasInitializedRef.current && initialImages.length > 0) {
        hasInitializedRef.current = true;
        setImages(initializeState(initialImages, maxImages));
      }
    }, [initialImages]);

    // Swap two images for reordering (works for both dense and sparse/fixed arrays)
    const swapImages = (indexA, indexB) => {
      console.log("[ImageUploader] swapImages called:", { indexA, indexB });
      console.log("[ImageUploader] URL at position A:", images[indexA]);
      console.log("[ImageUploader] URL at position B:", images[indexB]);
      console.log(
        "[ImageUploader] Are they the same?",
        images[indexA] === images[indexB],
      );

      const swap = (arr) => {
        const newArr = [...arr];
        // Ensure indices exist if array was shorter (though ideally shouldn't happen in fixed mode)
        if (hingeStyle) {
          // Fixed mode: indices are always valid
          [newArr[indexA], newArr[indexB]] = [newArr[indexB], newArr[indexA]];
        } else {
          // Dense mode: normal swap
          [newArr[indexA], newArr[indexB]] = [newArr[indexB], newArr[indexA]];
        }
        return newArr;
      };

      const newImages = swap(images);
      const newOriginalUris = swap(originalUris);
      const newAspectRatios = swap(aspectRatios);
      const newPresetKeys = swap(presetKeys);
      const newCropMetadata = swap(cropMetadata);

      console.log(
        "[ImageUploader] After swap - newImages:",
        newImages.map((img, i) =>
          img ? `[${i}]: ${img.substring(0, 30)}...` : `[${i}]: null`,
        ),
      );

      setImages(newImages);
      setOriginalUris(newOriginalUris);
      setAspectRatios(newAspectRatios);
      setPresetKeys(newPresetKeys);
      setCropMetadata(newCropMetadata);
      setSelectedForReorder(null);

      if (onImagesChange) {
        // Filter out nulls for parent if in Hinge mode
        onImagesChange(hingeStyle ? newImages.filter(Boolean) : newImages);
      }
      if (onAspectRatiosChange) {
        onAspectRatiosChange(
          hingeStyle
            ? newAspectRatios.filter((r, i) => newImages[i])
            : newAspectRatios,
        );
      }
      if (onCropMetadataChange) {
        onCropMetadataChange(
          hingeStyle
            ? newCropMetadata.filter((m, i) => newImages[i])
            : newCropMetadata,
        );
      }
    };

    // Handle photo tap for reordering
    const handlePhotoTapForReorder = (index) => {
      if (selectedForReorder === null) {
        // First tap - select this photo
        setSelectedForReorder(index);
      } else if (selectedForReorder === index) {
        // Tapped same photo - deselect
        setSelectedForReorder(null);
      } else {
        // Tapped different photo - swap them
        swapImages(selectedForReorder, index);
      }
    };

    // Unified Add Function
    // Can be called with specific targetIndex (for Hinge mode) or auto-find (default)
    const handleAddImages = async (
      targetIndex = null,
      specificMediaType = null,
    ) => {
      // In Hinge mode, we count non-null images
      const currentCount = hingeStyle
        ? images.filter(Boolean).length
        : images.length;
      const remainingSlots = maxImages - currentCount;

      if (remainingSlots <= 0) {
        Alert.alert(
          "Limit Reached",
          `You can only add up to ${maxImages} images.`,
        );
        return;
      }

      const isCropEnabled = enableCrop;

      // ... logic continues in helper functions, but we refactor here to support targetIndex
      await launchPicker(
        targetIndex,
        remainingSlots,
        isCropEnabled,
        specificMediaType,
      );
    };

    const launchPicker = async (
      targetIndex,
      remainingSlots,
      isCropEnabled,
      specificMediaType,
    ) => {
      try {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please grant access to your photo library.",
          );
          return;
        }

        // For hinge mode "replace/fill specific slot", we only pick 1 image
        // Otherwise pick up to remaining
        const isSingleReplace =
          targetIndex !== null && typeof targetIndex === "number";
        const selectionLimit = isSingleReplace
          ? 1
          : Math.min(remainingSlots, 10);

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            specificMediaType ||
            (allowVideos
              ? ImagePicker.MediaTypeOptions.All
              : ImagePicker.MediaTypeOptions.Images),
          allowsMultipleSelection: !isSingleReplace,
          quality: 1,
          selectionLimit: selectionLimit,
        });

        if (result.canceled || result.assets.length === 0) return;

        const rawAssets = result.assets;

        if (isCropEnabled) {
          processWithCrop(rawAssets, targetIndex);
        } else {
          processWithoutCrop(rawAssets, targetIndex);
        }
      } catch (error) {
        console.error("Error picking images:", error);
      }
    };

    // Process media WITH crop (images go through crop, videos skip it)
    const processWithCrop = async (assets, targetIndex) => {
      // Separate videos and images
      const videoAssets = assets.filter((a) => a.type?.startsWith("video"));
      const imageAssets = assets.filter((a) => !a.type?.startsWith("video"));

      // CRITICAL FIX: Skip crop screen entirely for videos
      // Process videos directly with their natural aspect ratio
      // User can optionally edit from preview modal later
      if (videoAssets.length > 0) {
        console.log(
          "[ImageUploader] Processing videos directly (skipping crop screen)",
        );
        const videoResults = videoAssets.map((asset) => {
          // Calculate natural aspect ratio
          const naturalAspectRatio =
            asset.width && asset.height ? asset.width / asset.height : 16 / 9;

          console.log("[ImageUploader] Video natural dimensions:", {
            width: asset.width,
            height: asset.height,
            aspectRatio: naturalAspectRatio.toFixed(3),
          });

          return {
            uri: asset.uri,
            width: asset.width || 1920,
            height: asset.height || 1080,
            metadata: {
              originalUri: asset.uri,
              aspectRatio: naturalAspectRatio,
              mediaType: "video",
              // No crop applied - natural video
              hasUserCrop: false,
              scale: 1,
              translateX: 0,
              translateY: 0,
            },
          };
        });

        updateStateWithResults(videoResults, targetIndex);
        return;
      }

      // For images only - go through crop screen
      const urisToProcess = imageAssets.map((asset) => asset.uri);

      if (urisToProcess.length === 0) return;

      let croppedResults = [];

      // Navigate to BatchCropScreen for images only
      const existingPreset = presetKeys.find((p) => p != null);
      const shouldLock = images.filter(Boolean).length > 0 && existingPreset;
      const targetDefaultPreset = existingPreset || cropPreset;

      croppedResults = await new Promise((resolve) => {
        resolveRef.current = resolve;
        navigation.navigate("BatchCropScreen", {
          imageUris: urisToProcess,
          defaultPreset: targetDefaultPreset,
          lockedPreset: shouldLock ? existingPreset : null,
          onComplete: (results) => {
            if (resolveRef.current) {
              resolveRef.current(results);
              resolveRef.current = null;
            }
          },
          onCancel: () => {
            if (resolveRef.current) {
              resolveRef.current(null);
              resolveRef.current = null;
            }
          },
        });
      });

      if (!croppedResults) return;

      updateStateWithResults(croppedResults, targetIndex);
    };

    // Process media WITHOUT crop
    const processWithoutCrop = (assets, targetIndex) => {
      const results = assets.map((a) => {
        const isVideo = a.type?.startsWith("video");
        let aspectRatio = 0.8; // Default 4:5
        if (a.width && a.height) {
          aspectRatio = a.width / a.height;
        }
        return {
          uri: a.uri,
          metadata: {
            originalUri: a.uri,
            aspectRatio: aspectRatio,
            mediaType: isVideo ? "video" : "image",
          },
        };
      });
      updateStateWithResults(results, targetIndex);
    };

    const updateStateWithResults = (results, targetIndex) => {
      const newImageUris = results.map((r) => r.uri);
      const newOriginalUris = results.map(
        (r) => r.metadata?.originalUri || r.uri,
      );
      const newAspectRatios = results.map(
        (r) => r.metadata?.aspectRatio || 0.8,
      );
      const newPresetKeys = results.map(
        (r) => r.metadata?.preset || cropPreset,
      );
      const newCropMetadata = results.map((r) => r.metadata || {});
      // NEW: Track media types
      const newMediaTypes = results.map(
        (r) => r.metadata?.mediaType || "image",
      );

      if (hingeStyle) {
        // Sparse update
        const nextImages = [...images];
        const nextOriginals = [...originalUris];
        const nextRatios = [...aspectRatios];
        const nextPresets = [...presetKeys];
        const nextMeta = [...cropMetadata];
        const nextMediaTypes = [...mediaTypes];

        let resultIdx = 0;

        // If targetIndex provided, start filling there
        if (targetIndex !== null) {
          // If targeting a specific slot, fill it
          nextImages[targetIndex] = newImageUris[0];
          nextOriginals[targetIndex] = newOriginalUris[0];
          nextRatios[targetIndex] = newAspectRatios[0];
          nextPresets[targetIndex] = newPresetKeys[0];
          nextMeta[targetIndex] = newCropMetadata[0];
          nextMediaTypes[targetIndex] = newMediaTypes[0];
          // If more results (not expected if selectionLimit=1), could fill subsequent empty slots
        } else {
          // Auto-fill empty slots
          for (
            let i = 0;
            i < maxImages && resultIdx < newImageUris.length;
            i++
          ) {
            if (nextImages[i] === null) {
              nextImages[i] = newImageUris[resultIdx];
              nextOriginals[i] = newOriginalUris[resultIdx];
              nextRatios[i] = newAspectRatios[resultIdx];
              nextPresets[i] = newPresetKeys[resultIdx];
              nextMeta[i] = newCropMetadata[resultIdx];
              nextMediaTypes[i] = newMediaTypes[resultIdx];
              resultIdx++;
            }
          }
        }

        setImages(nextImages);
        setOriginalUris(nextOriginals);
        setAspectRatios(nextRatios);
        setPresetKeys(nextPresets);
        setCropMetadata(nextMeta);
        setMediaTypes(nextMediaTypes);

        if (onImagesChange) onImagesChange(nextImages.filter(Boolean));
        if (onAspectRatiosChange)
          onAspectRatiosChange(nextRatios.filter((_, i) => nextImages[i]));
        if (onMediaTypesChange)
          onMediaTypesChange(nextMediaTypes.filter((_, i) => nextImages[i]));
        if (onCropMetadataChange)
          onCropMetadataChange(nextMeta.filter((_, i) => nextImages[i]));
      } else {
        // Dense update (append)
        const updatedImages = [...images, ...newImageUris].slice(0, maxImages);
        const updatedOriginalUris = [...originalUris, ...newOriginalUris].slice(
          0,
          maxImages,
        );
        const updatedAspectRatios = [...aspectRatios, ...newAspectRatios].slice(
          0,
          maxImages,
        );
        const updatedPresetKeys = [...presetKeys, ...newPresetKeys].slice(
          0,
          maxImages,
        );
        const updatedCropMetadata = [...cropMetadata, ...newCropMetadata].slice(
          0,
          maxImages,
        );
        const updatedMediaTypes = [...mediaTypes, ...newMediaTypes].slice(
          0,
          maxImages,
        );

        setImages(updatedImages);
        setOriginalUris(updatedOriginalUris);
        setAspectRatios(updatedAspectRatios);
        setPresetKeys(updatedPresetKeys);
        setCropMetadata(updatedCropMetadata);
        setMediaTypes(updatedMediaTypes);

        if (onImagesChange) onImagesChange(updatedImages);
        if (onAspectRatiosChange) onAspectRatiosChange(updatedAspectRatios);
        if (onMediaTypesChange) onMediaTypesChange(updatedMediaTypes);
        if (onCropMetadataChange) onCropMetadataChange(updatedCropMetadata);
      }
    };

    // Edit/crop an existing image or video - uses ORIGINAL URI and saved preset
    const handleEditImage = async (index) => {
      if (!enableCrop) return;

      try {
        // Use ORIGINAL URI (not cropped) for re-editing, and the saved preset
        const originalUri = originalUris[index] || images[index];
        const savedPreset = presetKeys[index] || cropPreset;
        const savedCropData = cropMetadata[index] || null;
        const thisMediaType = mediaTypes[index];

        console.log("[ImageUploader] Re-editing media:", {
          index,
          originalUri: originalUri.substring(0, 50) + "...",
          savedPreset,
          mediaType: thisMediaType,
          hasSavedCropData: !!savedCropData,
        });

        const isVideo = thisMediaType === "video";

        // For videos: Create a custom preset using natural dimensions
        // This allows pan/zoom within the natural aspect ratio (no forced presets)
        let customPreset = null;
        if (isVideo) {
          // Get natural dimensions from saved crop data or use defaults
          const videoWidth =
            savedCropData?.originalWidth || savedCropData?.imageWidth || 1920;
          const videoHeight =
            savedCropData?.originalHeight || savedCropData?.imageHeight || 1080;

          customPreset = createNaturalVideoPreset(videoWidth, videoHeight);
          console.log("[ImageUploader] Created natural video preset:", {
            width: videoWidth,
            height: videoHeight,
            aspectRatio: videoWidth / videoHeight,
          });
        }

        // Pass saved crop data for position restoration
        const result = await cropImage(originalUri, savedPreset, {
          initialCropData: savedCropData,
          customPreset: customPreset, // Use natural aspect ratio for videos
        });

        if (result) {
          // Update cropped image URI
          const updatedImages = [...images];
          updatedImages[index] = result.uri;

          // Update aspect ratio - for videos, use the natural aspect ratio
          const updatedAspectRatios = [...aspectRatios];
          if (isVideo && customPreset) {
            // Keep natural aspect ratio
            updatedAspectRatios[index] = aspectRatios[index];
          } else {
            updatedAspectRatios[index] =
              result.metadata?.aspectRatio || aspectRatios[index];
          }

          const updatedPresetKeys = [...presetKeys];
          updatedPresetKeys[index] =
            result.metadata?.preset || presetKeys[index];

          // Update crop metadata with new position and hasUserCrop flag
          const updatedCropMetadata = [...cropMetadata];
          const newMetadata = result.metadata || cropMetadata[index];

          // Mark as user-cropped if transforms were applied
          if (newMetadata) {
            const hasUserCrop =
              (newMetadata.scale && Math.abs(newMetadata.scale - 1) > 0.01) ||
              Math.abs(newMetadata.translateX || 0) > 0.5 ||
              Math.abs(newMetadata.translateY || 0) > 0.5;
            newMetadata.hasUserCrop = hasUserCrop;
          }

          updatedCropMetadata[index] = newMetadata;

          setImages(updatedImages);
          setAspectRatios(updatedAspectRatios);
          setPresetKeys(updatedPresetKeys);
          setCropMetadata(updatedCropMetadata);

          if (onImagesChange) {
            onImagesChange(updatedImages);
          }
          if (onAspectRatiosChange) {
            onAspectRatiosChange(updatedAspectRatios);
          }
          if (onCropMetadataChange) {
            onCropMetadataChange(updatedCropMetadata);
          }
        }
      } catch (error) {
        console.error("Error editing image:", error);
      }
    };

    const removeImage = (index) => {
      // Clear preview if removing the currently previewed video
      if (index === previewVideoIndex) {
        closeVideoPreview();
      }

      if (hingeStyle) {
        // Sparse removal: set to null
        const update = (arr, val) => {
          const copy = [...arr];
          copy[index] = val;
          return copy;
        };
        const nextImages = update(images, null);
        const nextOriginals = update(originalUris, null);
        const nextRatios = update(aspectRatios, null);
        const nextPresets = update(presetKeys, null);
        const nextMeta = update(cropMetadata, null);

        // Also update media types
        const nextMediaTypes = update(mediaTypes, null);
        setMediaTypes(nextMediaTypes);

        setImages(nextImages);
        setOriginalUris(nextOriginals);
        setAspectRatios(nextRatios);
        setPresetKeys(nextPresets);
        setCropMetadata(nextMeta);

        if (onImagesChange) onImagesChange(nextImages.filter(Boolean));
        if (onAspectRatiosChange)
          onAspectRatiosChange(nextRatios.filter((_, i) => nextImages[i]));
        if (onMediaTypesChange)
          onMediaTypesChange(nextMediaTypes.filter((_, i) => nextImages[i]));
        if (onCropMetadataChange)
          onCropMetadataChange(nextMeta.filter((_, i) => nextImages[i]));
      } else {
        // Dense removal: filter out
        const updatedImages = images.filter((_, i) => i !== index);
        const updatedOriginalUris = originalUris.filter((_, i) => i !== index);
        const updatedAspectRatios = aspectRatios.filter((_, i) => i !== index);
        const updatedPresetKeys = presetKeys.filter((_, i) => i !== index);
        const updatedCropMetadata = cropMetadata.filter((_, i) => i !== index);
        const updatedMediaTypes = mediaTypes.filter((_, i) => i !== index);

        setImages(updatedImages);
        setOriginalUris(updatedOriginalUris);
        setAspectRatios(updatedAspectRatios);
        setPresetKeys(updatedPresetKeys);
        setCropMetadata(updatedCropMetadata);
        setMediaTypes(updatedMediaTypes);

        if (onImagesChange) {
          onImagesChange(updatedImages);
        }
        if (onAspectRatiosChange) {
          onAspectRatiosChange(updatedAspectRatios);
        }
        if (onMediaTypesChange) {
          onMediaTypesChange(updatedMediaTypes);
        }
        if (onCropMetadataChange) {
          onCropMetadataChange(updatedCropMetadata);
        }
      }
    };

    // NEW: Handle thumbnail tap
    const handleThumbnailTap = (index) => {
      const isVideo = mediaTypes[index] === "video";
      if (isVideo) {
        // Show Preview for Video
        const uri = images[index];
        const metadata = { ...(cropMetadata[index] || {}) }; // Clone to avoid mutation
        // Override aspectRatio in metadata with current aspectRatios state if available
        const currentAspectRatio = aspectRatios[index];

        console.log("[ImageUploader] handleThumbnailTap for video:", {
          index,
          currentAspectRatio,
          cropMetadataAspectRatio: cropMetadata[index]?.aspectRatio,
          aspectRatiosArray: aspectRatios,
        });

        if (currentAspectRatio) {
          metadata.aspectRatio = currentAspectRatio;
        }

        setPreviewVideoUri(uri);
        setPreviewVideoMetadata(metadata);
        setPreviewVideoIndex(index);
        setIsVideoPreviewVisible(true);
      } else {
        // Edit Image (existing behavior)
        handleEditImage(index);
      }
    };

    const closeVideoPreview = () => {
      setIsVideoPreviewVisible(false);
      setPreviewVideoUri(null);
      setPreviewVideoMetadata(null);
      setPreviewVideoIndex(null);
    };

    const handleEditFromPreview = () => {
      if (previewVideoIndex !== null) {
        closeVideoPreview();
        // Small delay to allow modal to close before navigating
        setTimeout(() => {
          handleEditImage(previewVideoIndex);
        }, 300);
      }
    };

    const uploadAll = async () => {
      if (!images || images.length === 0) return;
      try {
        setUploading(true);
        setProgressByIndex({});

        // Identify valid indices (non-null) to preserve sparse array structure if needed
        const validIndices = images
          .map((uri, index) => (uri ? index : -1))
          .filter((index) => index !== -1);

        if (validIndices.length === 0) return;

        // Construct media items only for valid images/videos
        const mediaItems = validIndices.map((index) => ({
          uri: images[index],
          type: mediaTypes[index] || "image",
        }));

        const uploadedResults = await uploadMultipleMedia(
          mediaItems,
          (index, progress) => {
            // Map the dense index back to original sparse index for progress tracking
            const originalIndex = validIndices[index];
            setProgressByIndex((prev) => ({
              ...prev,
              [originalIndex]: progress,
            }));
          },
        );

        // Update images state with uploaded URLs, maintaining original positions
        const newImages = [...images];
        uploadedResults.forEach((result, i) => {
          const originalIndex = validIndices[i];
          newImages[originalIndex] = result.url;
        });

        setImages(newImages);
        if (onImagesChange) onImagesChange(newImages);
        Alert.alert("Uploaded", "All media uploaded successfully.");
      } catch (e) {
        console.error("Upload error:", e);
        Alert.alert("Upload Failed", e?.message || "Could not upload media");
      } finally {
        setUploading(false);
      }
    };
    // Render Hinge-style 2x3 grid
    const renderHingeGrid = () => {
      // 3 columns
      const numColumns = 3;
      const gap = 12;
      // Use prop-based padding if available, fallback to 48 (legacy SPACING.l * 2)
      const activePadding = containerPadding;

      // Calculate available width and subtract extra buffer for rounding errors/borders
      const availableWidth = width - activePadding - 2;
      const slotWidth = Math.floor(
        (availableWidth - gap * (numColumns - 1)) / numColumns,
      );
      const slotHeight = slotWidth * 1.25; // 4:5 aspect ratio
      const isRequired = (index) => index < minRequired;
      const actualImageCount = images.filter(Boolean).length;
      const needsMorePhotos = actualImageCount < minRequired;

      // Create a render key based on image positions to force re-render
      const gridRenderKey = images
        .map((img, i) => (img ? img.slice(-20) : "null"))
        .join("-");
      console.log("[ImageUploader] Rendering grid with key:", gridRenderKey);

      return (
        <View>
          <View key={gridRenderKey} style={styles.hingeGrid}>
            {Array.from({ length: maxImages }).map((_, index) => {
              const imageUri = images[index];
              const isEmpty = !imageUri;
              const isRequiredSlot = isRequired(index);
              const isSelected = selectedForReorder === index;

              // Use consistent key based only on index position
              const slotKey = `grid-slot-${index}`;

              if (isEmpty) {
                return (
                  <TouchableOpacity
                    key={slotKey}
                    style={[
                      styles.hingeSlot,
                      { width: slotWidth, height: slotHeight },
                      isRequiredSlot && styles.hingeSlotRequired,
                    ]}
                    onPress={() => handleAddImages(index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.hingeSlotIconContainer}>
                      <Ionicons
                        name="person-add-outline"
                        size={24}
                        color={
                          isRequiredSlot ? "#B8627D" : LEGACY_COLORS.textLight
                        }
                      />
                      <View
                        style={[
                          styles.hingeSlotPlus,
                          isRequiredSlot && styles.hingeSlotPlusRequired,
                        ]}
                      >
                        <Plus size={10} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }

              return (
                <View
                  key={slotKey}
                  style={[
                    styles.hingePhotoContainer,
                    { width: slotWidth, height: slotHeight },
                    isSelected && styles.hingePhotoSelected,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handlePhotoTapForReorder(index)}
                    onLongPress={() => handleEditImage(index)}
                    activeOpacity={0.7}
                    style={styles.imageTouch}
                  >
                    <Image
                      key={`img-${index}-${imageUri}`}
                      source={{ uri: imageUri }}
                      style={styles.image}
                      resizeMode="contain"
                      onError={(e) =>
                        console.log(
                          "[ImageUploader] Image load error at index",
                          index,
                          ":",
                          e.nativeEvent.error,
                        )
                      }
                      onLoad={() =>
                        console.log(
                          "[ImageUploader] Image loaded successfully at index",
                          index,
                        )
                      }
                    />
                    {isSelected && (
                      <View style={styles.hingeSelectedOverlay}>
                        <Ionicons
                          name="swap-horizontal"
                          size={32}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                    {enableCrop && !isSelected && (
                      <View style={styles.editHint}>
                        <Ionicons name="crop" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.hingeRemoveButton}
                    onPress={() => {
                      setSelectedForReorder(null);
                      removeImage(index);
                    }}
                  >
                    <X size={14} color="#333" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Required indicator and hint */}
          <View style={styles.hingeFooter}>
            <View style={styles.hingeRequiredRow}>
              <Text
                style={[
                  styles.hingeRequiredText,
                  needsMorePhotos && styles.hingeRequiredTextError,
                ]}
              >
                {minRequired} photos required
              </Text>
              {needsMorePhotos && <View style={styles.hingeErrorDot} />}
            </View>
            <Text style={styles.hingeHintText}>
              {selectedForReorder !== null
                ? "Tap another photo to swap"
                : "Tap to reorder, hold to edit"}
            </Text>
          </View>
        </View>
      );
    };

    const renderImageGrid = () => {
      // Use Hinge-style grid if enabled
      if (hingeStyle) {
        return renderHingeGrid();
      }

      if (images.length === 0) {
        if (horizontal) return null;
        return (
          <TouchableOpacity style={styles.addButton} onPress={handleAddImages}>
            <Camera
              size={40}
              color={COLORS.editorial.textSecondary}
              strokeWidth={2}
            />
            <Text style={styles.addButtonText}>Add Photos</Text>
            <Text style={styles.addButtonSubtext}>
              Tap to select up to {maxImages} images
            </Text>
          </TouchableOpacity>
        );
      }

      return (
        <ScrollView
          horizontal={horizontal}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.imageGrid,
            horizontal && styles.horizontalImageGrid,
          ]}
        >
          {images.map((imageUri, index) => {
            const ar = aspectRatios[index];
            // aspectRatio decimal: width/height. If ar is [4,5], ratio is 0.8
            const ratio = Array.isArray(ar)
              ? ar[0] / ar[1]
              : typeof ar === "number"
                ? ar
                : 1;

            // Adjusted sizes for premium look
            // For horizontal tray, use variable heights to balance visual weight (constant area-ish)
            // For grid, fix width and let height vary by ratio (as before)
            let thumbWidth, thumbHeight;

            if (horizontal) {
              if (ratio > 1.5) {
                // Landscape (e.g. 1.91:1) - shorter to prevent being too huge
                thumbHeight = 120;
              } else if (ratio > 0.9) {
                // Square (1:1) - increased size to balance visual weight with Portrait
                thumbHeight = 200;
              } else {
                // Portrait (4:5) - match 1:1's width (180px)
                // 180 / 0.8 = 225
                thumbHeight = 225;
              }

              thumbWidth = thumbHeight * ratio;

              // Cap width to prevent ultra-wide thumbnails (just in case)
              if (thumbWidth > 320) thumbWidth = 320;
              // Enforce min width to be tappable
              if (thumbWidth < 80) thumbWidth = 80;
            } else {
              thumbWidth = (width - 60) / 2;
              thumbHeight = thumbWidth / ratio;
            }

            return (
              <View
                key={`${index}-${imageUri}`}
                style={[
                  styles.imageContainer,
                  { width: thumbWidth, height: thumbHeight },
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleThumbnailTap(index)}
                  onLongPress={() => handleEditImage(index)} // Allow direct edit via long press
                  activeOpacity={enableCrop ? 0.7 : 1}
                  disabled={!enableCrop}
                  style={styles.imageTouch}
                >
                  {mediaTypes[index] === "video" && cropMetadata[index] ? (
                    // Video Thumbnail with Crop Transform
                    // Only apply transforms if the video is actually zoomed/panned
                    // Otherwise just use cover mode to fill the frame
                    (() => {
                      const metadata = cropMetadata[index];
                      const hasTransform =
                        (metadata.scale &&
                          Math.abs(metadata.scale - 1) > 0.01) ||
                        (metadata.translateX &&
                          Math.abs(metadata.translateX) > 0.5) ||
                        (metadata.translateY &&
                          Math.abs(metadata.translateY) > 0.5);

                      if (!hasTransform) {
                        // No meaningful transform - just show video filling frame
                        return (
                          <Image
                            source={{ uri: imageUri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="contain"
                          />
                        );
                      }

                      // Has transform - apply it
                      return (
                        <View
                          style={{
                            width: "100%",
                            height: "100%",
                            overflow: "hidden",
                            backgroundColor: "#000",
                          }}
                          pointerEvents="none"
                        >
                          <View
                            style={{
                              width: "100%",
                              height: "100%",
                              transform: [
                                { scale: metadata.scale || 1 },
                                {
                                  translateX:
                                    (metadata.translateX || 0) *
                                    (metadata.displayWidth
                                      ? thumbWidth / metadata.displayWidth
                                      : 1),
                                },
                                {
                                  translateY:
                                    (metadata.translateY || 0) *
                                    (metadata.displayHeight
                                      ? thumbHeight / metadata.displayHeight
                                      : 1),
                                },
                              ],
                            }}
                          >
                            <Image
                              source={{ uri: imageUri }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="contain"
                            />
                          </View>
                        </View>
                      );
                    })()
                  ) : (
                    // Standard Image/Video Thumbnail (fallback)
                    <Image
                      source={{ uri: imageUri, cache: "reload" }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  )}
                  {enableCrop && (
                    <View style={styles.editHint}>
                      <Ionicons
                        name={mediaTypes[index] === "video" ? "play" : "crop"}
                        size={14}
                        color="#fff"
                      />
                    </View>
                  )}
                </TouchableOpacity>
                {typeof progressByIndex[index] === "number" && uploading ? (
                  <View style={styles.progressOverlay}>
                    <Text style={styles.progressText}>
                      {progressByIndex[index]}%
                    </Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <X size={16} color={LEGACY_COLORS.white} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            );
          })}

          {images.length < maxImages && (
            <TouchableOpacity
              style={[
                styles.addMoreButton,
                horizontal && { width: 100, height: 120 },
              ]}
              onPress={handleAddImages}
            >
              <MaskedView
                maskElement={
                  <View
                    style={{
                      backgroundColor: "transparent",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Plus size={32} color="black" strokeWidth={2.5} />
                  </View>
                }
              >
                <LinearGradient
                  colors={["#448AFF", "#2962FF"]}
                  style={{ width: 32, height: 32 }}
                />
              </MaskedView>
            </TouchableOpacity>
          )}
        </ScrollView>
      );
    };

    // Render Video Preview Modal
    const renderVideoPreviewModal = () => {
      if (!isVideoPreviewVisible || !previewVideoUri) return null;

      const metadata = previewVideoMetadata || {};
      const scale = metadata.scale || 1;

      // Calculate scale factor for translation based on preview dimensions vs original crop dimensions
      const contentWidth = width - EDITORIAL_SPACING.cardPadding * 2;

      // Get aspect ratio
      const aspectRatio = Array.isArray(metadata.aspectRatio)
        ? metadata.aspectRatio[0] / metadata.aspectRatio[1]
        : metadata.aspectRatio || 0.8;

      const contentHeight = contentWidth / aspectRatio;

      // Scale factors for X and Y based on the actual display size vs crop size
      const scaleFactorX = metadata.displayWidth
        ? contentWidth / metadata.displayWidth
        : 1;
      const scaleFactorY = metadata.displayHeight
        ? contentHeight / metadata.displayHeight
        : 1;

      const translateX = (metadata.translateX || 0) * scaleFactorX;
      const translateY = (metadata.translateY || 0) * scaleFactorY;

      console.log("[ImageUploader] Video Preview Transform:", {
        aspectRatio,
        scale,
        translateX,
        translateY,
        metadata: {
          scale: metadata.scale,
          translateX: metadata.translateX,
          translateY: metadata.translateY,
          displayWidth: metadata.displayWidth,
          displayHeight: metadata.displayHeight,
          aspectRatio: metadata.aspectRatio,
        },
        calculated: {
          contentWidth,
          contentHeight,
          scaleFactorX,
          scaleFactorY,
        },
      });

      // Transform style for the video content
      // Only apply transforms if the video is actually zoomed/panned
      const hasTransform =
        (scale && Math.abs(scale - 1) > 0.01) ||
        (translateX && Math.abs(translateX) > 0.5) ||
        (translateY && Math.abs(translateY) > 0.5);

      const transformStyle = hasTransform
        ? {
            transform: [
              { scale: scale },
              { translateX: translateX },
              { translateY: translateY },
            ],
          }
        : {};

      return (
        <Modal
          visible={isVideoPreviewVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={closeVideoPreview}
          statusBarTranslucent={true}
        >
          <SafeAreaView
            style={[styles.previewContainer, { paddingTop: insets.top }]}
          >
            {/* Detailed Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeVideoPreview}
                style={styles.modalCloseButton}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Preview</Text>
              <TouchableOpacity
                onPress={handleEditFromPreview}
                style={styles.modalEditButton}
              >
                <Text style={styles.modalEditText}>Edit Crop</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.previewScroll}
              contentContainerStyle={styles.previewScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Feed Card Mockup - Editorial Style */}
              <View style={styles.feedCard}>
                {/* Author Row */}
                <View style={styles.authorRow}>
                  <View style={styles.authorInfo}>
                    {currentUser?.profile_photo_url ? (
                      <Image
                        source={{ uri: currentUser.profile_photo_url }}
                        style={styles.profileImage}
                      />
                    ) : (
                      <View style={styles.profileImagePlaceholder}>
                        <Text style={styles.profileInitials}>
                          {currentUser?.name?.charAt(0)?.toUpperCase() || "Y"}
                        </Text>
                      </View>
                    )}
                    <View style={styles.authorTextContainer}>
                      <View style={styles.authorNameRow}>
                        <Text style={styles.displayName}>
                          {currentUser?.name || "You"}
                        </Text>
                      </View>
                      <View style={styles.usernameRow}>
                        <Text style={styles.username}>
                          @{currentUser?.username || "username"}
                        </Text>
                        <Text style={styles.separator}>•</Text>
                        <Text style={styles.timestamp}>just now</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Caption */}
                {caption && (
                  <View style={styles.textContainer}>
                    <Text style={styles.postText}>{caption}</Text>
                  </View>
                )}

                {/* Media Container */}
                <View style={styles.mediaContainer}>
                  {/* Let VideoPlayer handle its own sizing based on aspect ratio */}
                  {/* Don't apply transforms here - VideoPlayer uses CONTAIN mode */}
                  <VideoPlayer
                    source={previewVideoUri}
                    aspectRatio={aspectRatio}
                    autoplay={true}
                    muted={false}
                    loop={true}
                    showControls={false}
                    containerWidth={contentWidth}
                  />
                </View>

                {/* Engagement Row */}
                <View style={styles.engagementRow}>
                  <View style={styles.engagementButton}>
                    <Heart
                      size={EDITORIAL_SPACING.iconSize}
                      color={COLORS.editorial.textSecondary}
                    />
                    <Text style={styles.engagementCount}>0</Text>
                  </View>
                  <View style={styles.engagementButton}>
                    <MessageCircle
                      size={EDITORIAL_SPACING.iconSize}
                      color={COLORS.editorial.textSecondary}
                    />
                    <Text style={styles.engagementCount}>0</Text>
                  </View>
                  <View style={styles.engagementButton}>
                    <ChartNoAxesCombined
                      size={EDITORIAL_SPACING.iconSize}
                      color={COLORS.editorial.textSecondary}
                    />
                    <Text style={styles.engagementCount}>0</Text>
                  </View>
                  <View style={styles.engagementButton}>
                    <Send
                      size={EDITORIAL_SPACING.iconSize}
                      color={COLORS.editorial.textSecondary}
                    />
                  </View>
                  <View style={styles.engagementButton}>
                    <Bookmark
                      size={EDITORIAL_SPACING.iconSize}
                      color={COLORS.editorial.textSecondary}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      );
    };

    return (
      <View
        style={[
          styles.container,
          style,
          horizontal &&
            (hingeStyle ? images.filter(Boolean).length : images.length) ===
              0 && { marginBottom: 0, height: 0 },
        ]}
      >
        {!horizontal && (
          <Text style={styles.label}>
            Photos ({hingeStyle ? images.filter(Boolean).length : images.length}
            /{maxImages})
          </Text>
        )}
        {renderImageGrid()}
        {renderVideoPreviewModal()}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: LEGACY_COLORS.textDark,
    marginBottom: 12,
  },
  addButton: {
    height: 120,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: LEGACY_COLORS.primary,
    marginTop: 8,
  },
  addButtonSubtext: {
    fontSize: 12,
    color: LEGACY_COLORS.textLight,
    marginTop: 4,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  horizontalImageGrid: {
    flexWrap: "nowrap",
    paddingRight: 20,
    gap: 12,
    alignItems: "center", // Center thumbnails vertically
  },
  imageContainer: {
    position: "relative",
    borderRadius: 12, // Increased for premium look
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  imageTouch: {
    width: "100%",
    height: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  addMoreButton: {
    width: (width - 60) / 2,
    height: 120, // Match default thumb height concept
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  addMoreText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 8,
  },
  uploadButton: {
    marginTop: 12,
    backgroundColor: LEGACY_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  uploadButtonDisabled: {
    backgroundColor: "#C7B8F5",
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  progressOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  editHint: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    padding: 6,
  },

  // Hinge-style grid
  hingeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  hingeSlot: {
    borderWidth: 2,
    borderColor: "#E5E5E5",
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  hingeSlotRequired: {
    borderColor: "#D4899B",
    backgroundColor: "#FFF8F9",
  },
  hingeSlotIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  hingeSlotPlus: {
    position: "absolute",
    bottom: -4,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#999999",
    alignItems: "center",
    justifyContent: "center",
  },
  hingeSlotPlusRequired: {
    backgroundColor: "#B8627D",
  },
  hingePhotoContainer: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F0F0F0",
  },
  hingePhotoSelected: {
    borderWidth: 3,
    borderColor: LEGACY_COLORS.primary,
  },
  hingeSelectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  hingeRemoveButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  hingeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  hingeRequiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hingeRequiredText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  hingeRequiredTextError: {
    color: "#B8627D",
  },
  hingeErrorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E74C3C",
  },
  hingeHintText: {
    fontSize: 12,
    color: "#999999",
  },

  // Preview Modal Styles
  previewContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  previewScroll: {
    flex: 1,
  },
  previewScrollContent: {
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  modalCloseButton: {
    padding: 8,
    marginLeft: -8,
  },
  modalEditButton: {
    padding: 8,
    marginRight: -8,
  },
  modalEditText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  feedCard: {
    backgroundColor: COLORS.editorial.background,
    paddingVertical: EDITORIAL_SPACING.cardPadding,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.editorial.border,
    marginHorizontal: EDITORIAL_SPACING.cardPadding, // Visual separation in preview
    borderRadius: BORDER_RADIUS.lg,
  },
  // Author Row Styles
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: EDITORIAL_SPACING.sectionGap,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImagePlaceholder: {
    width: EDITORIAL_SPACING.profileImageSize,
    height: EDITORIAL_SPACING.profileImageSize,
    borderRadius: EDITORIAL_SPACING.profileImageSize / 2,
    backgroundColor: COLORS.editorial.mediaPlaceholder,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitials: {
    ...EDITORIAL_TYPOGRAPHY.displayName,
    color: COLORS.textSecondary,
  },
  authorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  displayName: {
    ...EDITORIAL_TYPOGRAPHY.displayName,
    flexShrink: 1,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  username: {
    ...EDITORIAL_TYPOGRAPHY.username,
  },
  separator: {
    ...EDITORIAL_TYPOGRAPHY.username,
    marginHorizontal: 6,
  },
  timestamp: {
    ...EDITORIAL_TYPOGRAPHY.timestamp,
  },
  // Text Styles
  textContainer: {
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: EDITORIAL_SPACING.sectionGap,
  },
  postText: {
    ...EDITORIAL_TYPOGRAPHY.postText,
  },
  // Media Styles
  mediaContainer: {
    paddingHorizontal: EDITORIAL_SPACING.cardPadding,
    marginBottom: 8,
    alignItems: "center", // Center video horizontally
  },
  mediaWrapper: {
    width: "100%",
    borderRadius: EDITORIAL_SPACING.mediaCornerRadius,
    backgroundColor: COLORS.editorial.mediaPlaceholder,
  },
  // Engagement Styles
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: EDITORIAL_SPACING.cardPadding + 4,
    marginTop: 0,
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    minWidth: 40,
    justifyContent: "center",
  },
  engagementCount: {
    ...EDITORIAL_TYPOGRAPHY.engagementCount,
    marginLeft: EDITORIAL_SPACING.iconCountGap,
  },
  profileImage: {
    width: EDITORIAL_SPACING.profileImageSize,
    height: EDITORIAL_SPACING.profileImageSize,
    borderRadius: EDITORIAL_SPACING.profileImageSize / 2,
    backgroundColor: COLORS.editorial.mediaPlaceholder,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.editorial.accent,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  verifiedIcon: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

export default ImageUploader;
