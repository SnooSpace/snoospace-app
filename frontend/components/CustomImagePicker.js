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
  Animated,
  ScrollView,
  Pressable,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ChevronDown, Check, Image as ImageIcon, Video, Clock, Grid2x2 } from "lucide-react-native";
import { COLORS, FONTS } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = 2;
const THUMB_SIZE = Math.floor((SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS);

// Special album IDs that are not real MediaLibrary albums
const RECENTS_ID = "__recents__";
const VIDEOS_ID = "__videos__";

/**
 * CustomImagePicker
 *
 * A full-screen modal photo picker that shows numbered selection badges
 * in tap order (Instagram-style) instead of plain checkmarks.
 * Includes an Instagram-style album/folder dropdown in the header.
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
  videoMaxDuration = null, // seconds; videos longer than this are greyed out
}) {
  const insets = useSafeAreaInsets();

  const [assets, setAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]); // Ordered array of selected asset ids
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const afterRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Album state
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState({ id: RECENTS_ID, title: "Recents" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Load albums when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    loadAlbums();
  }, [visible]);

  // Load first page when modal becomes visible or album changes
  useEffect(() => {
    if (!visible) return;
    setSelectedAssets([]);
    setAssets([]);
    afterRef.current = null;
    loadAssets(true);
  }, [visible, selectedAlbum]);

  const loadAlbums = async () => {
    try {
      const fetchedAlbums = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });

      // Sort by asset count descending, filter out empty
      const sorted = fetchedAlbums
        .filter((a) => a.assetCount > 0)
        .sort((a, b) => b.assetCount - a.assetCount);

      setAlbums(sorted);
    } catch (e) {
      console.error("[CustomImagePicker] getAlbumsAsync failed:", e?.message || e);
    }
  };

  const loadAssets = useCallback(
    async (reset = false) => {
      if (isFetchingRef.current) return;
      if (!reset && !hasNextPage && assets.length > 0) return;

      isFetchingRef.current = true;
      setLoading(true);

      try {
        // Determine media type based on album selection
        let mediaType;
        if (selectedAlbum.id === VIDEOS_ID) {
          mediaType = [MediaLibrary.MediaType.video];
        } else if (allowVideos) {
          mediaType = [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];
        } else {
          mediaType = [MediaLibrary.MediaType.photo];
        }

        // Determine album filter
        const albumParam =
          selectedAlbum.id === RECENTS_ID || selectedAlbum.id === VIDEOS_ID
            ? undefined
            : selectedAlbum.id;

        const result = await MediaLibrary.getAssetsAsync({
          mediaType,
          first: 60,
          after: reset ? undefined : afterRef.current,
          sortBy: [MediaLibrary.SortBy.creationTime],
          album: albumParam,
        });

        afterRef.current = result.endCursor;
        setHasNextPage(result.hasNextPage);
        setAssets((prev) => (reset ? result.assets : [...prev, ...result.assets]));
      } catch (e) {
        console.error("[CustomImagePicker] getAssetsAsync failed:", e?.message || e);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [hasNextPage, assets.length, allowVideos, selectedAlbum]
  );

  const isVideoTooLong = useCallback(
    (item) =>
      item.mediaType === "video" &&
      videoMaxDuration !== null &&
      item.duration > videoMaxDuration,
    [videoMaxDuration]
  );

  const toggleAsset = useCallback(
    (asset) => {
      // Block selection of over-limit videos
      if (isVideoTooLong(asset)) return;
      setSelectedAssets((prev) => {
        const existingIndex = prev.findIndex((a) => a.id === asset.id);
        if (existingIndex !== -1) {
          return prev.filter((a) => a.id !== asset.id);
        }
        if (prev.length >= selectionLimit) {
          return prev;
        }
        return [...prev, asset];
      });
    },
    [selectionLimit, isVideoTooLong]
  );

  const handleDone = useCallback(() => {
    onDone(selectedAssets);
  }, [selectedAssets, onDone]);

  const getSelectionIndex = (assetId) => {
    const idx = selectedAssets.findIndex((a) => a.id === assetId);
    return idx === -1 ? null : idx + 1; // 1-based
  };

  // ── Dropdown open / close ───────────────────────────────────
  const openDropdown = () => {
    setIsDropdownOpen(true);
    Animated.parallel([
      Animated.spring(dropdownAnim, {
        toValue: 1,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDropdown = () => {
    Animated.parallel([
      Animated.timing(dropdownAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setIsDropdownOpen(false));
  };

  const handleAlbumSelect = (album) => {
    setSelectedAlbum(album);
    closeDropdown();
  };

  const toggleDropdown = () => {
    if (isDropdownOpen) closeDropdown();
    else openDropdown();
  };

  // ── Render helpers ───────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }) => {
      const tooLong      = isVideoTooLong(item);
      const selectionNumber = getSelectionIndex(item.id);
      const isSelected = selectionNumber !== null;

      return (
        <TouchableOpacity
          activeOpacity={tooLong ? 1 : 0.85}
          onPress={() => !tooLong && toggleAsset(item)}
          style={styles.thumbWrapper}
        >
          <Image
            source={{ uri: item.uri }}
            style={[styles.thumb, tooLong && styles.thumbDisabled]}
            resizeMode="cover"
          />

          {/* Grey-out overlay for too-long videos */}
          {tooLong && <View style={styles.tooLongOverlay} />}

          {/* Dim overlay when selected */}
          {isSelected && !tooLong && <View style={styles.selectedDim} />}

          {/* Selection badge — only shown for valid assets */}
          {!tooLong && (
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
          )}

          {/* Video duration badge */}
          {item.mediaType === "video" && (
            <View style={[styles.videoBadge, tooLong && styles.videoBadgeTooLong]}>
              <Text style={[styles.videoDuration, tooLong && styles.videoDurationTooLong]}>
                {tooLong ? "Too long" : formatDuration(item.duration)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedAssets, toggleAsset, isVideoTooLong]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getAlbumIcon = (albumId, albumTitle) => {
    if (albumId === RECENTS_ID) return <Clock size={18} color="#0A0A0A" strokeWidth={1.5} />;
    if (albumId === VIDEOS_ID) return <Video size={18} color="#0A0A0A" strokeWidth={1.5} />;
    const titleLower = (albumTitle || "").toLowerCase();
    if (titleLower.includes("video")) return <Video size={18} color="#0A0A0A" strokeWidth={1.5} />;
    if (titleLower.includes("screenshot")) return <Grid2x2 size={18} color="#0A0A0A" strokeWidth={1.5} />;
    return <ImageIcon size={18} color="#0A0A0A" strokeWidth={1.5} />;
  };

  // Header dropdown trigger
  const renderAlbumTrigger = () => {
    const chevronRotate = dropdownAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    });

    return (
      <TouchableOpacity
        onPress={toggleDropdown}
        style={styles.albumTrigger}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        activeOpacity={0.75}
      >
        <Text style={styles.albumTriggerText}>{selectedAlbum.title}</Text>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }], marginLeft: 3 }}>
          <ChevronDown size={16} color="#0A0A0A" strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + (Platform.OS === "android" ? 8 : 0) },
      ]}
    >
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={22} color="#0A0A0A" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Tappable album title in center */}
      {renderAlbumTrigger()}

      <View style={styles.headerRight}>
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
            Done{selectedAssets.length > 0 ? ` ${selectedAssets.length}` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Build the full album list for the dropdown
  const buildAlbumList = () => {
    const special = [
      { id: RECENTS_ID, title: "Recents", assetCount: null },
      ...(allowVideos ? [{ id: VIDEOS_ID, title: "Videos", assetCount: null }] : []),
    ];
    return [...special, ...albums];
  };

  const renderDropdown = () => {
    if (!isDropdownOpen) return null;

    const albumList = buildAlbumList();

    const translateY = dropdownAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-20, 0],
    });

    const headerHeight = insets.top + (Platform.OS === "android" ? 8 : 0) + 56; // approx header

    return (
      <>
        {/* Dark overlay behind dropdown */}
        <Animated.View
          style={[
            styles.dropdownOverlay,
            { opacity: overlayAnim },
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={closeDropdown} />
        </Animated.View>

        {/* Dropdown panel */}
        <Animated.View
          style={[
            styles.dropdown,
            {
              top: headerHeight,
              opacity: dropdownAnim,
              transform: [{ translateX: -110 }, { translateY }],
            },
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            style={{ maxHeight: 340 }}
          >
            {albumList.map((album) => {
              const isActive = album.id === selectedAlbum.id;
              return (
                <TouchableOpacity
                  key={album.id}
                  onPress={() => handleAlbumSelect(album)}
                  style={[styles.albumRow, isActive && styles.albumRowActive]}
                  activeOpacity={0.7}
                >
                  {/* Icon container */}
                  <View style={styles.albumIconContainer}>
                    {getAlbumIcon(album.id, album.title)}
                  </View>

                  {/* Album info */}
                  <View style={styles.albumInfo}>
                    <Text style={[styles.albumName, isActive && styles.albumNameActive]}>
                      {album.title}
                    </Text>
                    {album.assetCount != null && (
                      <Text style={styles.albumCount}>{album.assetCount}</Text>
                    )}
                  </View>

                  {/* Active checkmark */}
                  {isActive && (
                    <Check size={18} color="#0A0A0A" strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No Photos</Text>
        <Text style={styles.emptySubtitle}>
          {selectedAlbum.id === RECENTS_ID
            ? "Your camera roll is empty."
            : `No photos found in "${selectedAlbum.title}".`}
        </Text>
      </View>
    );
  };

  const renderFooter = () =>
    loading ? (
      <ActivityIndicator color="#0A0A0A" style={{ marginVertical: 20 }} />
    ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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

        {/* Dropdown (rendered after main content so it's on top) */}
        {renderDropdown()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.screenBackground,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  headerRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Album trigger (header center) ───────────────────────
  albumTrigger: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.05)",
    gap: 4,
  },
  albumTriggerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#0A0A0A",
    letterSpacing: 0.2,
  },

  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  doneBtnDisabled: {
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  doneBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  doneBtnTextDisabled: {
    color: "rgba(0,0,0,0.3)",
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
    backgroundColor: "rgba(255,255,255,0.4)",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeNumber: {
    fontFamily: FONTS.semiBold,
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
  videoBadgeTooLong: {
    backgroundColor: "rgba(180,0,0,0.75)",
  },
  videoDuration: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#FFFFFF",
  },
  videoDurationTooLong: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: "#FFFFFF",
  },

  // ── Too-long video overlay ───────────────────────────────
  thumbDisabled: {
    opacity: 0.45,
  },
  tooLongOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  // ── Bottom bar ───────────────────────────────────────────
  selectionBar: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  selectionBarText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "rgba(0,0,0,0.6)",
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
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#0A0A0A",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "rgba(0,0,0,0.5)",
    textAlign: "center",
  },

  // ── Dropdown overlay ────────────────────────────────────
  dropdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 20,
  },

  // ── Dropdown panel ───────────────────────────────────────
  dropdown: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -110 }],
    width: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 30,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  albumRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 12,
  },
  albumRowActive: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  albumIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "rgba(0,0,0,0.75)",
  },
  albumNameActive: {
    fontFamily: FONTS.semiBold,
    color: "#0A0A0A",
  },
  albumCount: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
    marginTop: 1,
  },
});
