import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Modal,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = 2;
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

/**
 * CustomImagePicker
 *
 * A full-screen modal photo picker that shows numbered selection badges
 * in tap order (Instagram-style) instead of plain checkmarks.
 *
 * Props:
 *   visible          - boolean, controls modal visibility
 *   onClose          - () => void, called when user taps X or cancels
 *   onDone           - (assets: Asset[]) => void, called with selected assets
 *   selectionLimit   - max number of photos user can select (default 10)
 *   allowVideos      - whether to show videos in picker (default false)
 */
export default function CustomImagePicker({
  visible,
  onClose,
  onDone,
  selectionLimit = 10,
  allowVideos = false,
}) {
  const insets = useSafeAreaInsets();

  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]); // Ordered array of selected asset ids
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const afterRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Load first page when modal becomes visible (permission already granted by caller)
  useEffect(() => {
    if (!visible) return;
    setSelectedAssets([]);
    setAssets([]);
    afterRef.current = null;
    loadAssets(true);
  }, [visible]);

  const loadAssets = useCallback(
    async (reset = false) => {
      if (isFetchingRef.current) return;
      if (!reset && !hasNextPage && assets.length > 0) return;

      isFetchingRef.current = true;
      setLoading(true);

      try {
        const mediaType = allowVideos
          ? [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
          : [MediaLibrary.MediaType.photo];

        console.log("[CustomImagePicker] Fetching assets, reset:", reset, "after:", afterRef.current);

        const result = await MediaLibrary.getAssetsAsync({
          mediaType,
          first: 60,
          after: reset ? undefined : afterRef.current,
          sortBy: [MediaLibrary.SortBy.creationTime],
        });

        console.log("[CustomImagePicker] Got", result.assets.length, "assets, hasNextPage:", result.hasNextPage);

        afterRef.current = result.endCursor;
        setHasNextPage(result.hasNextPage);
        setAssets((prev) => (reset ? result.assets : [...prev, ...result.assets]));
      } catch (e) {
        console.error("[CustomImagePicker] getAssetsAsync failed:", e?.message || e);
        setHasPermission(false); // Treat fetch failure as permission denied for UI
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [hasNextPage, assets.length, allowVideos]
  );

  const toggleAsset = useCallback(
    (asset) => {
      setSelectedAssets((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === asset.id);
        if (existingIndex !== -1) {
          // Deselect
          return prev.filter((a) => a.id !== asset.id);
        }
        if (prev.length >= selectionLimit) {
          // Limit reached — do nothing
          return prev;
        }
        // Select
        return [...prev, asset];
      });
    },
    [selectionLimit]
  );

  const handleDone = useCallback(() => {
    onDone(selectedAssets);
  }, [selectedAssets, onDone]);

  const getSelectionIndex = (assetId) => {
    const idx = selectedAssets.findIndex((a) => a.id === assetId);
    return idx === -1 ? null : idx + 1; // 1-based
  };

  const renderItem = useCallback(
    ({ item }) => {
      const selectionNumber = getSelectionIndex(item.id);
      const isSelected = selectionNumber !== null;

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleAsset(item)}
          style={styles.thumbWrapper}
        >
          <Image
            source={{ uri: item.uri }}
            style={styles.thumb}
            resizeMode="cover"
          />

          {/* Dim overlay when selected */}
          {isSelected && <View style={styles.selectedDim} />}

          {/* Selection badge — numbered circle or empty outline */}
          <View
            style={[
              styles.badge,
              isSelected ? styles.badgeSelected : styles.badgeUnselected,
            ]}
          >
            {isSelected && (
              <Text style={styles.badgeNumber}>{selectionNumber}</Text>
            )}
          </View>

          {/* Video duration badge */}
          {item.mediaType === "video" && (
            <View style={styles.videoBadge}>
              <Text style={styles.videoDuration}>
                {formatDuration(item.duration)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedAssets, toggleAsset]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + (Platform.OS === "android" ? 8 : 0) },
      ]}
    >
      <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={22} color="#FFFFFF" strokeWidth={2} />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Select Photos</Text>

      <TouchableOpacity
        onPress={handleDone}
        style={[
          styles.doneBtn,
          selectedAssets.length === 0 && styles.doneBtnDisabled,
        ]}
        disabled={selectedAssets.length === 0}
      >
        <Text
          style={[
            styles.doneBtnText,
            selectedAssets.length === 0 && styles.doneBtnTextDisabled,
          ]}
        >
          Done{selectedAssets.length > 0 ? ` (${selectedAssets.length})` : ""}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Photos</Text>
        <Text style={styles.emptySubtitle}>
          Your camera roll is empty.
        </Text>
      </View>
    );
  };

  const renderFooter = () =>
    loading ? (
      <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 20 }} />
    ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        {renderHeader()}

        <FlatList
          data={assets}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: insets.bottom + 16 },
          ]}
          columnWrapperStyle={styles.row}
          onEndReached={() => loadAssets(false)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          // Re-render when selection changes
          extraData={selectedAssets}
          removeClippedSubviews={false}
        />

        {/* Bottom selection count bar */}
        {selectedAssets.length > 0 && (
          <View
            style={[
              styles.selectionBar,
              { paddingBottom: insets.bottom + 8 },
            ]}
          >
            <Text style={styles.selectionBarText}>
              {selectedAssets.length} of {selectionLimit} selected
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#0A0A0A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
  doneBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  doneBtnText: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 14,
    color: "#0A0A0A",
  },
  doneBtnTextDisabled: {
    color: "rgba(255,255,255,0.4)",
  },

  // ── Grid ─────────────────────────────────────────────────
  grid: {
    gap: GAP,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    position: "relative",
    overflow: "hidden",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  selectedDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  // ── Selection badge ──────────────────────────────────────
  badge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeUnselected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  badgeSelected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
  },
  badgeNumber: {
    fontFamily: "Manrope_700Bold",
    fontSize: 13,
    color: "#0A0A0A",
    lineHeight: 16,
  },

  // ── Video badge ──────────────────────────────────────────
  videoBadge: {
    position: "absolute",
    bottom: 5,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    fontFamily: "Manrope_500Medium",
    fontSize: 11,
    color: "#FFFFFF",
  },

  // ── Bottom bar ───────────────────────────────────────────
  selectionBar: {
    backgroundColor: "rgba(10,10,10,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  selectionBarText: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },

  // ── Empty state ──────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: "Manrope_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
});
