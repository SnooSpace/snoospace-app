import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight } from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const THUMB_SIZE = 72;
const THUMB_GAP = 8;

// ── Memoized Thumbnail Component ─────────────────────────────
const Thumbnail = React.memo(({ item, index, isSelected, onPress, isLast }) => {
  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
      activeOpacity={0.8}
      style={[
        styles.thumbWrapper,
        isSelected && styles.thumbWrapperActive,
        !isLast && { marginRight: THUMB_GAP },
      ]}
    >
      {/* Inner view handles clipping separately — fixes Android overflow/borderRadius bug */}
      <View style={styles.thumbInner}>
        <Image
          source={{ uri: item.image_url || item.url }}
          style={styles.thumbImage}
          resizeMode="cover"
        />
      </View>
    </TouchableOpacity>
  );
});

export default function EventGalleryScreen({ route, navigation }) {
  const {
    images = [],
    eventTitle = "Gallery",
    initialIndex = 0,
  } = route.params || {};
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const mainListRef = useRef(null);
  const thumbScrollRef = useRef(null);

  const scrollThumbTo = useCallback((index) => {
    // Small delay to ensure layout is ready
    setTimeout(() => {
      // Calculate position to center the thumbnail
      const itemOffset = index * (THUMB_SIZE + THUMB_GAP);
      const halfScreenWidth = SCREEN_WIDTH / 2;
      const xPosition = itemOffset - halfScreenWidth + THUMB_SIZE / 2 + 16; // 16 for paddingHorizontal

      thumbScrollRef.current?.scrollTo({
        x: Math.max(0, xPosition),
        animated: true,
      });
    }, 50);
  }, []);

  const goToIndex = useCallback(
    (index) => {
      if (index < 0 || index >= images.length) return;
      setCurrentIndex(index);
      mainListRef.current?.scrollToIndex({ index, animated: true });
      scrollThumbTo(index);
    },
    [images.length, scrollThumbTo],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      setCurrentIndex(idx);
      scrollThumbTo(idx);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // ── Main carousel item ────────────────────────────────────
  const renderMainItem = useCallback(({ item }) => {
    const imageUrl = item.image_url || item.url;
    return (
      <View style={styles.mainItemWrapper}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.mainImage}
          resizeMode="cover"
        />
      </View>
    );
  }, []);

  const getItemLayout = useCallback(
    (_, index) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={22} color="#1D1D1F" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {eventTitle}
          </Text>
          <Text style={styles.headerSubtitle}>Gallery</Text>
        </View>
      </View>

      {/* ── Main Carousel ───────────────────────────────── */}
      <FlatList
        ref={mainListRef}
        data={images}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderMainItem}
        horizontal
        pagingEnabled
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        style={styles.mainList}
      />

      {/* ── Bottom Bar ──────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {/* Counter + next arrow */}
        <TouchableOpacity
          style={styles.counterRow}
          onPress={() => goToIndex(currentIndex + 1)}
          disabled={currentIndex >= images.length - 1}
          activeOpacity={0.7}
        >
          <Text style={styles.counterText}>
            {currentIndex + 1}/{images.length}
          </Text>
          <ChevronRight
            size={18}
            color={currentIndex >= images.length - 1 ? "#C7C7CC" : "#1D1D1F"}
            strokeWidth={2}
          />
        </TouchableOpacity>

        {/* Thumbnail strip */}
        <ScrollView
          ref={thumbScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbStrip}
          style={styles.thumbList}
        >
          {images.map((item, index) => (
            <Thumbnail
              key={`thumb-${index}`}
              item={item}
              index={index}
              isSelected={currentIndex === index}
              onPress={goToIndex}
              isLast={index === images.length - 1}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.52;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  backBtn: {
    marginRight: 12,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: "#1D1D1F",
    lineHeight: 22,
  },
  headerSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 1,
  },

  /* ── Main carousel ── */
  mainList: {
    flex: 1,
  },
  mainItemWrapper: {
    width: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  mainImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
    borderRadius: 16,
  },

  /* ── Bottom bar ── */
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E5EA",
    zIndex: 10,
    elevation: 10,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  counterText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#1D1D1F",
    marginRight: 4,
  },

  /* ── Thumbnails ── */
  thumbList: {
    maxHeight: THUMB_SIZE + 4,
    zIndex: 11,
  },
  thumbStrip: {
    paddingHorizontal: 16,
  },

  // Outer wrapper — handles border & opacity only (NO overflow: hidden)
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    opacity: 0.55,
  },
  thumbWrapperActive: {
    opacity: 1,
    borderWidth: 2.5,
    borderColor: "#2962FF",
    borderRadius: 12,
  },

  // Inner view — handles clipping independently, fixes Android ghost thumbnail bug
  thumbInner: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
  },

  thumbImage: {
    width: "100%",
    height: "100%",
  },
});