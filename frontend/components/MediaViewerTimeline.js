import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Modal, Dimensions, TouchableOpacity, Text, Image } from "react-native";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, useAnimatedScrollHandler } from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

function MediaItem({ item, isActive }) {
  if (item.type === "video") {
    return <VideoItem item={item} isActive={isActive} />;
  }
  return (
    <View style={styles.mediaContainer}>
      <Image source={{ uri: item.uri }} style={styles.media} resizeMode="contain" />
    </View>
  );
}

function VideoItem({ item, isActive }) {
  const player = useVideoPlayer(item.uri, player => {
    player.loop = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.mediaContainer}>
      <VideoView
        player={player}
        style={styles.media}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls
      />
    </View>
  );
}

export default function MediaViewerTimeline({ timeline, initialIndex, visible, onClose, onEndReached }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef(null);

  // We need to jump to the initialIndex exactly once when opened
  useEffect(() => {
    if (visible && flatListRef.current) {
      setCurrentIndex(initialIndex);
      // Wait a tick for layout, then jump
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handleScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_W);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < timeline.length) {
      setCurrentIndex(newIndex);
    }
  };

  const handleMomentumScrollEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(x / SCREEN_W);
    if (newIndex === timeline.length - 1 && onEndReached) {
      onEndReached();
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.FlatList
          ref={flatListRef}
          data={timeline}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          renderItem={({ item, index }) => (
            <MediaItem item={item} isActive={index === currentIndex} />
          )}
          windowSize={5}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          removeClippedSubviews={true}
        />

        {/* Header */}
        <View style={[styles.header, { top: insets.top + 10 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={24} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerText}>
            {currentIndex + 1} / {timeline.length}
          </Text>
          <View style={{ width: 40 }} /> {/* balance */}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mediaContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    color: "#FFF",
    fontFamily: "Manrope-Medium",
    fontSize: 16,
  },
});
