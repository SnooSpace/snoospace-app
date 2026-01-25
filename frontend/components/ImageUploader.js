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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useNavigation } from "@react-navigation/native";
import { uploadMultipleImages } from "../api/cloudinary";
import { useCrop } from "./MediaCrop";

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

const COLORS = {
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
      initialImages = [],
      initialAspectRatios = [], // Initial aspect ratios
      initialMediaTypes = [], // NEW: Initial media types ('image' | 'video')
      style,
      enableCrop = true, // Enable crop by default for feed posts
      cropPreset = "feed_portrait", // Default to 4:5 with toggle to 1:1
      horizontal = false, // Support horizontal media tray
      hingeStyle = false, // Enable Hinge-style 2x3 grid
      allowVideos = false, // NEW: Enable video picking
    },
    ref,
  ) => {
    useImperativeHandle(ref, () => ({
      pick: handleAddImages,
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
    const { cropImage } = useCrop();
    const navigation = useNavigation();
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
    const handleAddImages = async (targetIndex = null) => {
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
      await launchPicker(targetIndex, remainingSlots, isCropEnabled);
    };

    const launchPicker = async (targetIndex, remainingSlots, isCropEnabled) => {
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
          mediaTypes: allowVideos
            ? ImagePicker.MediaTypeOptions.All
            : ImagePicker.MediaTypeOptions.Images,
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

    // Process media WITH crop (only for images, videos skip crop)
    const processWithCrop = async (assets, targetIndex) => {
      // Separate images from videos - videos don't need cropping
      const imageAssets = assets.filter((a) => !a.type?.startsWith("video"));
      const videoAssets = assets.filter((a) => a.type?.startsWith("video"));

      let croppedResults = [];

      // Process images through crop screen
      if (imageAssets.length > 0) {
        const rawImageUris = imageAssets.map((asset) => asset.uri);
        const imageUris = await Promise.all(
          rawImageUris.map((uri) => normalizeImageOrientation(uri)),
        );

        // Navigate to BatchCropScreen for images
        // If there are already images, lock the preset to the first image's preset
        const existingPreset = presetKeys.find((p) => p != null);
        const shouldLock = images.filter(Boolean).length > 0 && existingPreset;
        
        croppedResults = await new Promise((resolve) => {
          resolveRef.current = resolve;
          navigation.navigate("BatchCropScreen", {
            imageUris: imageUris,
            defaultPreset: existingPreset || cropPreset,
            lockedPreset: shouldLock ? existingPreset : null, // Lock if images exist
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

        if (!croppedResults) croppedResults = [];
        // Mark all as images
        croppedResults = croppedResults.map((r) => ({
          ...r,
          metadata: { ...r.metadata, mediaType: "image" },
        }));
      }

      // Process videos (no cropping, just get aspect ratio and snap to allowed)
      const videoResults = videoAssets.map((asset) => {
        // Calculate raw aspect ratio from width/height if available
        let rawRatio = 16 / 9; // Default
        if (asset.width && asset.height) {
          rawRatio = asset.width / asset.height;
        }

        // Snap to nearest allowed ratio: 1:1 (1.0), 4:5 (0.8), 16:9 (1.77)
        // This ensures the EditorialPostCard renders the container correctly
        let snappedRatio = 1.0;
        const diff1 = Math.abs(rawRatio - 1.0);
        const diffPortrait = Math.abs(rawRatio - 0.8);
        const diffLandscape = Math.abs(rawRatio - 1.77);

        if (diffPortrait < diff1 && diffPortrait < diffLandscape) {
          snappedRatio = 0.8;
        } else if (diffLandscape < diff1 && diffLandscape < diffPortrait) {
          snappedRatio = 1.77; // 16:9
        } else {
          snappedRatio = 1.0;
        }

        console.log("[ImageUploader] Snapped video ratio:", {
          raw: rawRatio,
          snapped: snappedRatio,
        });

        return {
          uri: asset.uri,
          metadata: {
            originalUri: asset.uri,
            aspectRatio: snappedRatio,
            preset: "video",
            mediaType: "video",
          },
        };
      });

      const allResults = [...croppedResults, ...videoResults];
      if (allResults.length === 0) return;
      updateStateWithResults(allResults, targetIndex);
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
      }
    };

    // Edit/crop an existing image - uses ORIGINAL URI and saved preset
    const handleEditImage = async (index) => {
      if (!enableCrop) return;

      try {
        // Use ORIGINAL URI (not cropped) for re-editing, and the saved preset
        const originalUri = originalUris[index] || images[index];
        const savedPreset = presetKeys[index] || cropPreset;
        const savedCropData = cropMetadata[index] || null;

        console.log("[ImageUploader] Re-editing image:", {
          index,
          originalUri: originalUri.substring(0, 50) + "...",
          savedPreset,
          hasSavedCropData: !!savedCropData,
        });

        // Pass saved crop data for position restoration
        const result = await cropImage(originalUri, savedPreset, {
          initialCropData: savedCropData,
        });

        if (result) {
          // Update cropped image URI
          const updatedImages = [...images];
          updatedImages[index] = result.uri;

          // Update aspect ratio and preset if changed
          const updatedAspectRatios = [...aspectRatios];
          updatedAspectRatios[index] =
            result.metadata?.aspectRatio || aspectRatios[index];

          const updatedPresetKeys = [...presetKeys];
          updatedPresetKeys[index] =
            result.metadata?.preset || presetKeys[index];

          // Update crop metadata with new position
          const updatedCropMetadata = [...cropMetadata];
          updatedCropMetadata[index] = result.metadata || cropMetadata[index];

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
        }
      } catch (error) {
        console.error("Error editing image:", error);
      }
    };

    const removeImage = (index) => {
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

        setImages(nextImages);
        setOriginalUris(nextOriginals);
        setAspectRatios(nextRatios);
        setPresetKeys(nextPresets);
        setCropMetadata(nextMeta);

        if (onImagesChange) onImagesChange(nextImages.filter(Boolean));
        if (onAspectRatiosChange)
          onAspectRatiosChange(nextRatios.filter((_, i) => nextImages[i]));
      } else {
        // Dense removal: filter out
        const updatedImages = images.filter((_, i) => i !== index);
        const updatedOriginalUris = originalUris.filter((_, i) => i !== index);
        const updatedAspectRatios = aspectRatios.filter((_, i) => i !== index);
        const updatedPresetKeys = presetKeys.filter((_, i) => i !== index);
        const updatedCropMetadata = cropMetadata.filter((_, i) => i !== index);

        setImages(updatedImages);
        setOriginalUris(updatedOriginalUris);
        setAspectRatios(updatedAspectRatios);
        setPresetKeys(updatedPresetKeys);
        setCropMetadata(updatedCropMetadata);

        if (onImagesChange) {
          onImagesChange(updatedImages);
        }
        if (onAspectRatiosChange) {
          onAspectRatiosChange(updatedAspectRatios);
        }
      }
    };

    const uploadAll = async () => {
      if (!images || images.length === 0) return;
      try {
        setUploading(true);
        setProgressByIndex({});

        const uploadedUrls = await uploadMultipleImages(
          images,
          (index, progress) => {
            setProgressByIndex((prev) => ({ ...prev, [index]: progress }));
          },
        );

        setImages(uploadedUrls);
        if (onImagesChange) onImagesChange(uploadedUrls);
        Alert.alert("Uploaded", "All images uploaded successfully.");
      } catch (e) {
        console.error("Upload error:", e);
        Alert.alert("Upload Failed", e?.message || "Could not upload images");
      } finally {
        setUploading(false);
      }
    };

    // Render Hinge-style 2x3 grid
    const renderHingeGrid = () => {
      // 3 columns
      const numColumns = 3;
      const gap = 12;
      const containerPadding = 48; // Assumes SPACING.l is 24px (24*2=48)

      // Calculate available width and subtract extra buffer for rounding errors/borders
      const availableWidth = width - containerPadding - 2;
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
                        color={isRequiredSlot ? "#B8627D" : COLORS.textLight}
                      />
                      <View
                        style={[
                          styles.hingeSlotPlus,
                          isRequiredSlot && styles.hingeSlotPlusRequired,
                        ]}
                      >
                        <Ionicons name="add" size={12} color="#FFFFFF" />
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
                      resizeMode="cover"
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
                    <Ionicons name="close" size={14} color="#333" />
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
            <Ionicons name="camera-outline" size={40} color={COLORS.primary} />
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
                  onPress={() => handleEditImage(index)}
                  activeOpacity={enableCrop ? 0.7 : 1}
                  disabled={!enableCrop}
                  style={styles.imageTouch}
                >
                  <Image
                    source={{ uri: imageUri, cache: "reload" }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  {enableCrop && (
                    <View style={styles.editHint}>
                      <Ionicons name="crop" size={14} color="#fff" />
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
                  <Ionicons name="close" size={16} color={COLORS.white} />
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
              <Ionicons name="add" size={32} color={COLORS.primary} />
              {horizontal && <Text style={styles.addMoreText}>Add more</Text>}
            </TouchableOpacity>
          )}
        </ScrollView>
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
    color: COLORS.textDark,
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
    color: COLORS.primary,
    marginTop: 8,
  },
  addButtonSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
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
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  addMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 8,
  },
  uploadButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
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
    borderColor: COLORS.primary,
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
});

export default ImageUploader;
