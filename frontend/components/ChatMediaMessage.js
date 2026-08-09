/**
 * ChatMediaMessage
 *
 * Renders image / video / multi_media chat bubbles.
 *
 * VIDEO BEHAVIOR (Instagram-style):
 *   - Shows static thumbnail (Cloudinary first-frame transform) with a centered play button
 *   - Tap opens the fullscreen MediaViewerTimeline where the video plays
 *   - No autoplay in the chat list — keeps scrolling smooth and saves bandwidth
 *
 * IMAGE OPTIMIZATION:
 * Static thumbnails remain as-is (Cloudinary URLs are OS-level cached after first load).
 *
 * ── FIX (post-audit) ────────────────────────────────────────────────────────
 * This component is rendered inside FlashList cells recycled by getItemType
 * pools (e.g. image_single_in, image_grid2_out, etc.). Two things needed
 * fixing for correct recycling behavior:
 *
 *   1. ImageItem/VideoItem used plain useState(false) for thumbError. Since
 *      FlashList reuses the same component instance across different items
 *      of the same recycling pool, a thumbnail load failure on message A
 *      would leave thumbError=true carried over when the cell was recycled
 *      for message B — showing a broken-image placeholder for a perfectly
 *      valid image until something else forced a remount. Switched to
 *      useRecyclingState keyed on [mediaId, url] so the error state resets
 *      automatically whenever the cell is recycled to a different item.
 *
 *   2. renderContent() manually assembles multiple sibling media elements
 *      for the 2/3/4-image grid layouts (not via .map(), but the same
 *      "multiple keyed siblings" situation the docs warn about). Raw
 *      key={mediaId} on VideoItem/ImageItem is replaced with
 *      useMappingHelper's getMappingKey so recycling isn't defeated by
 *      React treating each grid slot as an unrelated component identity
 *      across recycles.
 */
import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Film, Image as ImageIcon, Play } from "lucide-react-native";
import { useRecyclingState, useMappingHelper } from "@shopify/flash-list";
import { getOptimizedImageUrl } from "../utils/imageUtils";

const { width: SCREEN_W } = Dimensions.get("window");
const BUBBLE_MAX_W = Math.min(SCREEN_W * 0.68, 260);
const BUBBLE_H     = 200;
const OUTGOING_BG  = "#E6F0FF";
const INCOMING_BG  = "#FFFFFF";
const DELETED_COLOR = "#A0A0A0";

/**
 * Derives a JPEG thumbnail from a Cloudinary video URL (first frame, 480px cap).
 * Returns null for non-Cloudinary URLs.
 */
function getCloudinaryVideoThumb(videoUrl) {
  if (!videoUrl || !videoUrl.includes("cloudinary.com")) return null;
  try {
    return videoUrl
      .replace("/video/upload/", "/video/upload/so_0,w_480,h_480,c_fill,q_auto,f_jpg/")
      .replace(/\.[^./?#]+($|\?)/, ".jpg$1");
  } catch {
    return null;
  }
}

// ── Deleted bubble ─────────────────────────────────────────────────────────────
function DeletedMediaBubble({ isMyMessage, messageType }) {
  return (
    <View style={[
      bubbleStyles.wrapper,
      isMyMessage ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft,
    ]}>
      <View style={[
        bubbleStyles.deletedBubble,
        isMyMessage ? bubbleStyles.myDeletedBubble : bubbleStyles.otherDeletedBubble,
      ]}>
        {messageType === "video"
          ? <Film size={13} color={DELETED_COLOR} strokeWidth={2} style={{ marginRight: 5 }} />
          : <ImageIcon size={13} color={DELETED_COLOR} strokeWidth={2} style={{ marginRight: 5 }} />
        }
        <Text style={bubbleStyles.deletedText}>
          {messageType === "video" ? "Video was removed" : "Media was removed"}
        </Text>
      </View>
    </View>
  );
}

// ── Single image item ──────────────────────────────────────────────────────────
function ImageItem({ item, isMyMessage, styleOverrides, mediaId, isUploading, uploadProgress, onOpenViewer }) {
  const rawUrl = item?.url || null;
  // FIX: useRecyclingState resets thumbError automatically whenever this
  // cell gets recycled to a different mediaId/url, instead of carrying a
  // stale error flag over from whatever item previously occupied this cell.
  const [thumbError, setThumbError] = useRecyclingState(false, [mediaId, rawUrl]);
  // Downscale to the actual rendered bubble width — avoids loading full-res
  // camera uploads (3000px+) into a 260dp cell.
  const mediaUrl = getOptimizedImageUrl(rawUrl, { width: BUBBLE_MAX_W, quality: 'auto:good' });

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => { if (rawUrl && !isUploading && onOpenViewer) onOpenViewer(mediaId); }}
      style={[
        bubbleStyles.mediaBubble,
        isMyMessage ? bubbleStyles.myBubble : bubbleStyles.otherBubble,
        styleOverrides,
      ]}
    >
      {thumbError || !mediaUrl ? (
        <View style={bubbleStyles.errorThumb}>
          <ImageIcon size={28} color="#B0BEC5" strokeWidth={1.5} />
        </View>
      ) : (
        <Image
          source={{ uri: mediaUrl }}
          style={bubbleStyles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={String(mediaId)}
          onError={() => setThumbError(true)}
        />
      )}
      {isUploading && (
        <View style={overlayStyles.container}>
          <View style={overlayStyles.pill}>
            <Text style={overlayStyles.text}>{Math.round(uploadProgress * 100)}%</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Single video item ──────────────────────────────────────────────────────────
// Instagram-style: shows static thumbnail + play button.
// Tap opens the fullscreen MediaViewerTimeline (same as images).
function VideoItem({ item, isMyMessage, styleOverrides, mediaId, onOpenViewer }) {
  const mediaUrl     = item?.url || null;
  // Video thumbnails are already downscaled by getCloudinaryVideoThumb (480px cap) — leave as-is.
  const thumbnailUrl = item?.thumbnail_url || getCloudinaryVideoThumb(mediaUrl) || null;
  // FIX: same recycling-safe reset as ImageItem above.
  const [thumbError, setThumbError] = useRecyclingState(false, [mediaId, thumbnailUrl]);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => { if (mediaUrl && onOpenViewer) onOpenViewer(mediaId); }}
      style={[
        bubbleStyles.mediaBubble,
        isMyMessage ? bubbleStyles.myBubble : bubbleStyles.otherBubble,
        styleOverrides,
      ]}
    >
      {thumbError || !thumbnailUrl ? (
        <View style={[bubbleStyles.errorThumb, bubbleStyles.videoPlaceholder]}>
          <Film size={32} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
        </View>
      ) : (
        <Image
          source={{ uri: thumbnailUrl }}
          style={bubbleStyles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={String(mediaId)}
          onError={() => setThumbError(true)}
        />
      )}

      {/* Centered play button overlay */}
      <View style={bubbleStyles.playOverlay} pointerEvents="none">
        <View style={bubbleStyles.playButton}>
          <Play size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
        </View>
      </View>


    </TouchableOpacity>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
function ChatMediaMessage({
  message,
  isMyMessage,
  uploadProgress = null,
  onOpenViewer,
}) {
  const { messageType, metadata, messageText, isDeleted } = message;
  const isUploading = uploadProgress !== null && uploadProgress < 1;
  // FIX: getMappingKey provides recycling-safe keys for the manually
  // assembled sibling grid items in renderContent() below (2/3/4-image
  // layouts), instead of a raw key={mediaId} that defeats recycling.
  const { getMappingKey } = useMappingHelper();

  if (isDeleted) {
    return <DeletedMediaBubble isMyMessage={isMyMessage} messageType={messageType} />;
  }

  const renderMediaItem = (item, index = 0, styleOverrides = {}, isMulti = false) => {
    const isVideo  = item?.resource_type === "video" || item?.type === "video" || messageType === "video";
    const mediaId  = isMulti ? `${message.id}_${index}` : message.id;
    const mappingKey = getMappingKey(mediaId, index);

    if (isVideo) {
      return (
        <VideoItem
          key={mappingKey}
          item={item}
          isMyMessage={isMyMessage}
          styleOverrides={styleOverrides}
          mediaId={mediaId}
          onOpenViewer={onOpenViewer}
        />
      );
    }

    return (
      <ImageItem
        key={mappingKey}
        item={item}
        isMyMessage={isMyMessage}
        styleOverrides={styleOverrides}
        mediaId={mediaId}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onOpenViewer={onOpenViewer}
      />
    );
  };

  const renderContent = () => {
    if (messageType === "multi_media" && Array.isArray(metadata)) {
      if (metadata.length === 2) {
        return (
          <View style={{ flexDirection: "row", gap: 2, width: BUBBLE_MAX_W, height: BUBBLE_H, borderRadius: 18, overflow: "hidden" }}>
            {renderMediaItem(metadata[0], 0, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
            {renderMediaItem(metadata[1], 1, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
          </View>
        );
      }
      if (metadata.length === 3) {
        return (
          <View style={{ width: BUBBLE_MAX_W, height: BUBBLE_H, borderRadius: 18, overflow: "hidden", gap: 2 }}>
            <View style={{ flexDirection: "row", flex: 1, gap: 2 }}>
              {renderMediaItem(metadata[0], 0, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
              {renderMediaItem(metadata[1], 1, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
            </View>
            {renderMediaItem(metadata[2], 2, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
          </View>
        );
      }
      if (metadata.length >= 4) {
        return (
          <View style={{ width: BUBBLE_MAX_W, height: BUBBLE_H, borderRadius: 18, overflow: "hidden", gap: 2 }}>
            <View style={{ flexDirection: "row", flex: 1, gap: 2 }}>
              {renderMediaItem(metadata[0], 0, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
              {renderMediaItem(metadata[1], 1, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
            </View>
            <View style={{ flexDirection: "row", flex: 1, gap: 2 }}>
              {renderMediaItem(metadata[2], 2, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
              <View style={{ flex: 1 }}>
                {renderMediaItem(metadata[3], 3, { width: "auto", height: "auto", flex: 1, borderRadius: 0 }, true)}
                {metadata.length > 4 && (
                  <View style={bubbleStyles.moreOverlay}>
                    <Text style={bubbleStyles.moreText}>+{metadata.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      }
      if (metadata.length === 1) {
        return renderMediaItem(metadata[0], 0, {}, true);
      }
    }

    // Single image/video
    return renderMediaItem(metadata, 0);
  };

  return (
    <View style={[bubbleStyles.wrapper, isMyMessage ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft]}>
      {renderContent()}
      {!!messageText && (
        <View style={[
          bubbleStyles.captionBubble,
          isMyMessage ? bubbleStyles.myCaptionBubble : bubbleStyles.otherCaptionBubble,
        ]}>
          <Text style={[
            bubbleStyles.captionText,
            isMyMessage ? bubbleStyles.myCaptionText : bubbleStyles.otherCaptionText,
          ]}>
            {messageText}
          </Text>
        </View>
      )}
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  text: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

const bubbleStyles = StyleSheet.create({
  wrapper:      { marginBottom: 2 },
  wrapperRight: { alignItems: "flex-end" },
  wrapperLeft:  { alignItems: "flex-start" },

  mediaBubble: {
    width:        BUBBLE_MAX_W,
    height:       BUBBLE_H,
    borderRadius: 18,
    overflow:     "hidden",
  },
  myBubble: {
    backgroundColor: OUTGOING_BG,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: INCOMING_BG,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E6ECF5",
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  errorThumb: {
    width: "100%", height: "100%",
    backgroundColor: "#F0F4F8",
    alignItems: "center", justifyContent: "center",
  },
  videoPlaceholder: {
    backgroundColor: "#1A202C",
  },
  // Centered play button for video thumbnails
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
    paddingLeft: 2,
  },

  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  moreText: {
    color: "#FFF", fontFamily: "Manrope-Bold", fontSize: 24,
  },
  captionBubble: {
    marginTop: 2,
    maxWidth: BUBBLE_MAX_W,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18,
  },
  myCaptionBubble: {
    backgroundColor: OUTGOING_BG,
    borderBottomRightRadius: 4,
  },
  otherCaptionBubble: {
    backgroundColor: INCOMING_BG,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: "#E6ECF5",
  },
  captionText: {
    fontFamily: "Manrope-Regular", fontSize: 15, lineHeight: 20,
  },
  myCaptionText:   { color: "#1F3A5F" },
  otherCaptionText: { color: "#1F3A5F" },

  deletedBubble: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    borderWidth: 1, borderColor: "#EAEAEA",
  },
  myDeletedBubble:    { borderBottomRightRadius: 4 },
  otherDeletedBubble: { borderBottomLeftRadius: 4 },
  deletedText: {
    fontFamily: "Manrope-Regular", fontSize: 14, color: DELETED_COLOR, fontStyle: "italic",
  },
});

export default React.memo(ChatMediaMessage);