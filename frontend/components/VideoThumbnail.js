/**
 * VideoThumbnail.js
 * Shows the first frame of a video at a given size, with crop transforms applied.
 * Designed for use in the ImageUploader grid where hooks are needed.
 */
import React, { memo } from "react";
import { View, StyleSheet } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

const VideoThumbnail = memo(({ uri, width, height, cropMetadata }) => {
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.muted = true;
    p.loop = false;
    // Must call play() so expo-video decodes and renders the first frame.
    // We pause immediately in onFirstFrameRender to freeze at frame 0.
    p.play();
  });

  const scale = cropMetadata?.scale || 1;
  // displayWidth is the crop-frame width when the crop was done
  const displayWidth = cropMetadata?.displayWidth || width;
  const scaleFactor = displayWidth > 0 ? width / displayWidth : 1;
  const translateX = (cropMetadata?.translateX || 0) * scaleFactor;
  const translateY = (cropMetadata?.translateY || 0) * scaleFactor;

  const hasTransform =
    Math.abs(scale - 1) > 0.01 ||
    Math.abs(translateX) > 0.5 ||
    Math.abs(translateY) > 0.5;

  return (
    <View style={[styles.container, { width, height }]}>
      <View
        style={[
          styles.inner,
          hasTransform && {
            transform: [{ scale }, { translateX }, { translateY }],
          },
        ]}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          onFirstFrameRender={() => {
            // Freeze at the first frame — we only wanted play() to trigger decoding
            player.pause();
            player.currentTime = 0;
          }}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    overflow: "hidden",
  },
  inner: {
    width: "100%",
    height: "100%",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

export default VideoThumbnail;
