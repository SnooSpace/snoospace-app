import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, StyleSheet, Modal, Dimensions, TouchableOpacity, Text, Image, FlatList, Pressable } from "react-native";
import { X } from "lucide-react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, useAnimatedScrollHandler } from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function MediaItem({ item, isActive, onPress }) {
  if (item.type === "video") {
    return <VideoItem item={item} isActive={isActive} onPress={onPress} />;
  }
  return (
    <Pressable style={styles.mediaContainer} onPress={onPress}>
      <Image source={{ uri: item.uri }} style={styles.media} resizeMode="contain" />
    </Pressable>
  );
}

function VideoItem({ item, isActive, onPress }) {
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
    <Pressable style={styles.mediaContainer} onPress={onPress}>
      <VideoView
        player={player}
        style={styles.media}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        nativeControls={false} // Disable native controls to let our overlay tap work
      />
    </Pressable>
  );
}

export default function MediaViewerTimeline({ timeline, initialIndex, visible, onClose, onEndReached, onReply }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const flatListRef = useRef(null);

  // Animations
  const opacitySV = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible && flatListRef.current) {
      setCurrentIndex(initialIndex);
      setOverlaysVisible(true);
      opacitySV.value = 1;
      translateY.value = 0;
      scale.value = 1;
      bgOpacity.value = 1;
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const toggleOverlays = () => {
    const nextState = !overlaysVisible;
    setOverlaysVisible(nextState);
    opacitySV.value = withTiming(nextState ? 1 : 0, { duration: 200 });
  };

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

  const handleClose = useCallback(() => {
    translateY.value = 0;
    bgOpacity.value = 1;
    scale.value = 1;
    onClose();
  }, [onClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      translateY.value = e.translationY;
      const progress = Math.min(Math.abs(e.translationY) / SCREEN_H, 1);
      bgOpacity.value = 1 - progress * 0.8;
      scale.value = 1 - progress * 0.2;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > 120 || Math.abs(e.velocityY) > 800) {
        bgOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(Math.sign(e.translationY) * SCREEN_H, { duration: 250 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        bgOpacity.value = withTiming(1);
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 255, 255, ${bgOpacity.value})`,
  }));

  const overlaysAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }));

  if (!visible) return null;

  const currentItem = timeline[currentIndex];

  return (
    <Modal visible={visible} transparent={true} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
              <AnimatedFlatList
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
                  <MediaItem item={item} isActive={index === currentIndex} onPress={toggleOverlays} />
                )}
                windowSize={5}
                initialNumToRender={5}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
              />
            </Animated.View>
          </GestureDetector>

          {/* Header */}
          <Animated.View style={[styles.header, { top: insets.top + 10 }, overlaysAnimatedStyle]} pointerEvents={overlaysVisible ? "auto" : "none"}>
            <View style={styles.headerLeft}>
              <Image source={{ uri: currentItem?.avatarUri }} style={styles.headerAvatar} />
              <View>
                <Text style={styles.headerName}>{currentItem?.senderName}</Text>
                <Text style={styles.headerTime}>{formatTime(currentItem?.createdAt)}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={24} color="#000000" strokeWidth={2.5} />
            </TouchableOpacity>
          </Animated.View>

          {/* Footer (Reply) */}
          <Animated.View style={[styles.footer, { bottom: insets.bottom + 20 }, overlaysAnimatedStyle]} pointerEvents={overlaysVisible ? "auto" : "none"}>
            <TouchableOpacity style={styles.replyButton} onPress={() => { if (onReply && currentItem) onReply(currentItem); }}>
              <Text style={styles.replyText}>Reply...</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerName: {
    color: "#000",
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
  },
  headerTime: {
    color: "rgba(0,0,0,0.5)",
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  footer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  replyButton: {
    backgroundColor: "rgba(245,245,245,0.95)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  replyText: {
    color: "#000",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
});
