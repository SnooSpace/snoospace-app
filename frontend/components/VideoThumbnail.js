/**
 * VideoThumbnail.js
 * Shows the first frame of a video at a given size, with crop applied via
 * absolute positioning (not CSS transform, which doesn't work on native VideoView).
 */
import React, { memo } from "react";
import { View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

const VideoThumbnail = memo(({ uri, width, height, cropMetadata }) => {
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });

  // --- Crop-aware sizing via absolute positioning ---
  // CSS transforms on the wrapper View don't propagate reliably to native
  // VideoView surfaces on iOS. Instead we:
  //  1. Size the VideoView to the FULL video height at container width
  //  2. Offset it with position:absolute top/left to show the correct region
  //  3. The outer container's overflow:hidden clips to the thumbnail bounds

  const videoNaturalAR =
    cropMetadata?.videoPixelWidth && cropMetadata?.videoPixelHeight
      ? cropMetadata.videoPixelWidth / cropMetadata.videoPixelHeight
      : null;

  let videoW = width;
  let videoH = height;
  let videoTop = 0;
  let videoLeft = 0;

  if (videoNaturalAR && videoNaturalAR > 0) {
    // Full video height when filling the thumbnail width
    const fullVideoH = width / videoNaturalAR;
    const userScale = cropMetadata?.scale || 1;

    // The CropView displayWidth = CropView frameWidth. Scale crop-space → thumb-space.
    const cropFrameW = cropMetadata?.displayWidth || width;
    const thumbScale = width / cropFrameW;

    // Apply user zoom on top of natural fill
    videoW = width * userScale;
    videoH = fullVideoH * userScale;

    // Center the (possibly zoomed) video, then apply user pan (scaled to thumb space)
    const userTX = (cropMetadata?.translateX || 0) * thumbScale;
    const userTY = (cropMetadata?.translateY || 0) * thumbScale;

    videoLeft = (width - videoW) / 2 + userTX;
    videoTop = (height - videoH) / 2 + userTY;
  }

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "#000",
        overflow: "hidden",
      }}
    >
      <VideoView
        player={player}
        style={{
          position: "absolute",
          width: videoW,
          height: videoH,
          top: videoTop,
          left: videoLeft,
        }}
        contentFit="fill"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => {
          player.pause();
          player.currentTime = 0;
        }}
      />
    </View>
  );
});

export default VideoThumbnail;
