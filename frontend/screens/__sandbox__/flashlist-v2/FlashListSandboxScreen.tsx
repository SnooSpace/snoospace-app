//FlashListsandboxScreen.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatRow, getRowType } from "./types";
import { renderChatRow } from "./MessageRow";
import { generateMessagePage, fetchOlderMessages } from "./mockMessages";

const PAGE_SIZE = 30;

export default function FlashListSandboxScreen() {
  const insets = useSafeAreaInsets();
  // Convention: index 0 = newest message. Older history lives at the
  // END of the array. Combined with inverted={true} below, index 0
  // renders at the bottom of the screen — the standard inverted-chat
  // pattern, and the one we picked deliberately.
  const [messages, setMessages] = useState<ChatRow[]>(() =>
    generateMessagePage(0, PAGE_SIZE, Date.now())
  );
  const [cursor, setCursor] = useState(() => Date.now());
  const [pageIndex, setPageIndex] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  const listRef = useRef<FlashListRef<ChatRow>>(null);

  // --- Why this is structured the way it is -----------------------------
  //
  // The earlier "auto-scroll" wasn't code forcing a scroll — it was the
  // USER'S OWN momentum. Flicking hard enough to hit the load-more zone
  // often means the finger is already off-screen and the list is still
  // coasting under its own physics. Before pagination, that momentum
  // would simply hit the end of the content and stop/bounce. The moment
  // we appended new rows WHILE that momentum was still live, more
  // scrollable space suddenly existed, so the existing momentum sailed
  // straight into it — no separate auto-scroll, just physics continuing
  // into content that didn't exist a moment ago.
  //
  // Fix: decouple "fetch the data" from "commit the data into the list".
  // We fetch as soon as the threshold is hit (no perceived lag), but we
  // only call setMessages — the actual append — once scrolling has gone
  // fully idle. If the fetch resolves while momentum is still live, we
  // hold the result and commit it the moment things go still.
  const isFetchingRef = useRef(false);
  const isScrollIdleRef = useRef(true);
  const pendingOlderRef = useRef<{
    rows: ChatRow[];
    nextCursor: number;
    hasMore: boolean;
  } | null>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const commitOlderRows = useCallback(() => {
    const pending = pendingOlderRef.current;
    if (!pending) return;
    pendingOlderRef.current = null;
    setMessages((prev) => [...prev, ...pending.rows]);
    setCursor(pending.nextCursor);
    setPageIndex((p) => p + 1);
    setHasMore(pending.hasMore);
    setIsLoadingOlder(false);
    isFetchingRef.current = false;
  }, []);

  // Every scroll event marks us as "in motion" and pushes out the idle
  // deadline. Only once events stop arriving for 150ms do we consider
  // the gesture (drag AND any momentum that follows it) fully finished —
  // at which point we commit any pagination result that was waiting.
  const handleScroll = useCallback(() => {
    isScrollIdleRef.current = false;
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = setTimeout(() => {
      isScrollIdleRef.current = true;
      commitOlderRows();
    }, 150);
  }, [commitOlderRows]);

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    };
  }, []);

  // --- Pagination: loading OLDER messages -------------------------------
  //
  // IMPORTANT: because we're inverted with index 0 = newest, the "end"
  // of the data array (higher indices, older messages) is what sits
  // visually at the TOP of the screen. Reaching the top while scrolling
  // up is therefore reaching the *end* of the array — so we use
  // onEndReached, not onStartReached, to fetch older history. Don't
  // swap these without re-checking the mental model above.
  const handleEndReached = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;
    isFetchingRef.current = true;
    setIsLoadingOlder(true);
    try {
      const { rows, nextCursor, hasMore: more } = await fetchOlderMessages(
        pageIndex,
        cursor
      );
      if (isScrollIdleRef.current) {
        // Scrolling already stopped by the time the fetch resolved —
        // commit right away, there's no live momentum to worry about.
        pendingOlderRef.current = { rows, nextCursor, hasMore: more };
        commitOlderRows();
      } else {
        // Still mid-gesture — hold the result. handleScroll's idle
        // timer will call commitOlderRows() once things go still.
        pendingOlderRef.current = { rows, nextCursor, hasMore: more };
      }
    } catch (e) {
      isFetchingRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [hasMore, pageIndex, cursor, commitOlderRows]);

  // --- Sending a new message (prepended to index 0 = newest) -----------
  const [draft, setDraft] = useState("");
  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    const newMessage: ChatRow = {
      id: `local_${Date.now()}`,
      type: "text",
      timestamp: Date.now(),
      senderId: "me",
      isOwn: true,
      text: trimmed,
    };

    setMessages((prev) => [newMessage, ...prev]);
    setDraft("");

    // Since index 0 sits at the visual bottom (inverted), scrolling to
    // index 0 is scrolling to the newest message / bottom of the chat.
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: 0, animated: true });
    });
  }, [draft]);

  // Rendered above the list in inverted layout terms — because inverted
  // flips render order, ListFooterComponent ends up visually at the TOP,
  // right where a "loading older messages" spinner belongs.
  // Fixed height always — only the spinner's visibility toggles.
  // Letting this container mount/unmount (null vs content) causes a
  // second size change that stacks on top of maintainVisibleContentPosition's
  // own compensation, which is what produces the extra "auto-scroll" jolt.
  const ListFooterComponent = useCallback(() => {
    return (
      <View style={styles.loadingFooter}>
        {isLoadingOlder ? <ActivityIndicator size="small" /> : null}
      </View>
    );
  }, [isLoadingOlder]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlashList
        ref={listRef}
        data={messages}
        renderItem={renderChatRow}
        keyExtractor={(item) => item.id}
        getItemType={getRowType}
        inverted
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Drives the idle-detection that gates when a pagination result
        // actually gets committed into the list — see handleScroll above.
        onScroll={handleScroll}
        scrollEventThrottle={16}
        drawDistance={250}
        ListFooterComponent={ListFooterComponent}
        // Enabled by default in v2, but being explicit here: this is
        // what keeps the visible content stable while older pages get
        // appended off-screen at the top during fast upward scrolling —
        // directly targets the "items flick out and back in" symptom.
        maintainVisibleContentPosition={{
          autoscrollToBottomThreshold: 0.1,
        }}
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom || 8 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          style={styles.input}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  listContent: { paddingVertical: 8 },
  loadingFooter: { height: 48, justifyContent: "center", alignItems: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  sendText: { color: "#fff", fontWeight: "600" },
});