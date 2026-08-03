//MessageRow.tsx

import React, { memo } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import {
  ChatRow,
  TextMessage,
  MediaMessage,
  PostShareMessage,
  DateSeparator,
} from "./types";

// --- Date separator -------------------------------------------------

function DateSeparatorRowBase({ item }: { item: DateSeparator }) {
  return (
    <View style={styles.dateWrap}>
      <View style={styles.datePill}>
        <Text style={styles.dateText}>{item.label}</Text>
      </View>
    </View>
  );
}
export const DateSeparatorRow = memo(DateSeparatorRowBase);

// --- Text message -----------------------------------------------------

function TextMessageRowBase({ item }: { item: TextMessage }) {
  return (
    <View
      style={[
        styles.rowWrap,
        item.isOwn ? styles.rowWrapOwn : styles.rowWrapOther,
      ]}
    >
      <View
        style={[
          styles.bubble,
          item.isOwn ? styles.bubbleOwn : styles.bubbleOther,
        ]}
      >
        <Text style={item.isOwn ? styles.textOwn : styles.textOther}>
          {item.text}
        </Text>
      </View>
    </View>
  );
}
// No key props anywhere inside — required for FlashList recycling to work.
export const TextMessageRow = memo(TextMessageRowBase);

// --- Media message ------------------------------------------------------

const MEDIA_WIDTH = 220;

function MediaMessageRowBase({ item }: { item: MediaMessage }) {
  // Height is derived from a known aspectRatio, never from the loaded
  // image's natural size. This keeps row height stable BEFORE the image
  // decodes, which is what actually prevents the "pop/shift" during
  // fast scroll — FlashList never has to react to a late size change.
  const height = MEDIA_WIDTH / item.aspectRatio;

  return (
    <View
      style={[
        styles.rowWrap,
        item.isOwn ? styles.rowWrapOwn : styles.rowWrapOther,
      ]}
    >
      <View style={styles.mediaBubble}>
        <Image
          source={{ uri: item.uri }}
          style={{ width: MEDIA_WIDTH, height, borderRadius: 12 }}
          resizeMode="cover"
        />
        {item.caption ? (
          <Text style={styles.mediaCaption}>{item.caption}</Text>
        ) : null}
      </View>
    </View>
  );
}
export const MediaMessageRow = memo(MediaMessageRowBase);

// --- Shared post card -----------------------------------------------------

function PostShareRowBase({ item }: { item: PostShareMessage }) {
  return (
    <View
      style={[
        styles.rowWrap,
        item.isOwn ? styles.rowWrapOwn : styles.rowWrapOther,
      ]}
    >
      <Pressable style={styles.postCard}>
        <Image
          source={{ uri: item.post.thumbnailUri }}
          style={styles.postThumb}
          resizeMode="cover"
        />
        <View style={styles.postTextWrap}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {item.post.title}
          </Text>
          <Text style={styles.postAuthor}>{item.post.authorName}</Text>
        </View>
      </Pressable>
    </View>
  );
}
export const PostShareRow = memo(PostShareRowBase);

// --- Dispatcher used by renderItem ----------------------------------------

// Kept outside the component tree passed to FlashList so it's a stable
// reference — pass THIS function as renderItem, do not inline a new
// arrow function on every render of the parent screen.
export function renderChatRow({ item }: { item: ChatRow }) {
  switch (item.type) {
    case "date":
      return <DateSeparatorRow item={item} />;
    case "text":
      return <TextMessageRow item={item} />;
    case "media":
      return <MediaMessageRow item={item} />;
    case "post":
      return <PostShareRow item={item} />;
  }
}

const styles = StyleSheet.create({
  dateWrap: {
    alignItems: "center",
    paddingVertical: 10,
  },
  datePill: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: { fontSize: 12, color: "#4b5563", fontWeight: "600" },

  rowWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: "row",
  },
  rowWrapOwn: { justifyContent: "flex-end" },
  rowWrapOther: { justifyContent: "flex-start" },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  bubbleOwn: { backgroundColor: "#2563eb", borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#e5e7eb", borderBottomLeftRadius: 4 },
  textOwn: { color: "#fff", fontSize: 15 },
  textOther: { color: "#111827", fontSize: 15 },

  mediaBubble: { maxWidth: "78%" },
  mediaCaption: { marginTop: 4, fontSize: 13, color: "#374151" },

  postCard: {
    flexDirection: "row",
    maxWidth: "82%",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    overflow: "hidden",
  },
  postThumb: { width: 72, height: 72 },
  postTextWrap: { flex: 1, padding: 8, justifyContent: "center" },
  postTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  postAuthor: { fontSize: 12, color: "#6b7280", marginTop: 4 },
});
