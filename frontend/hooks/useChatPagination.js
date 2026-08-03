/**
 * useChatPagination
 *
 * Owns all message-list state for the ChatScreen.
 * Uses cursor-based pagination (?before=<ISO>&limit=N) so that
 * prepending older messages never shifts the visible viewport.
 *
 * Array order contract:
 *   messages  — oldest → newest  (index 0 = oldest, last index = newest)
 *
 * This matches FlashList v2's documented chat pattern:
 *   maintainVisibleContentPosition={{
 *     autoscrollToBottomThreshold: 0.2,
 *     startRenderingFromBottom: true,
 *   }}
 * The list renders in normal chronological order; v2's native
 * autoscrollToBottomThreshold keeps the view pinned to the bottom
 * automatically when new messages are appended, eliminating the need
 * for reactive scrollToEnd / onContentSizeChange correction logic.
 *
 * ── FIX (post-audit) ────────────────────────────────────────────────────────
 * Older-message prepends used to be split into two chunks and committed via
 * two separate setMessages calls one requestAnimationFrame apart. That forced
 * FlashList's maintainVisibleContentPosition engine to recompute the scroll
 * anchor twice in two consecutive frames against two different array states —
 * the direct cause of messages visibly flicking out and snapping back during
 * fast scroll-up. Every prepend path below now commits in a SINGLE setMessages
 * call, so maintainVisibleContentPosition only has to anchor once per batch.
 *
 * API surface:
 *   messages           — current flat array of messages (oldest → newest)
 *   hasMore            — true while more older pages exist
 *   loadingOlder       — true while a "load older" request is in flight
 *   loadInitial(id, limit?) — fetch the most-recent messages for a conversation.
 *                            limit defaults to OLDER_PAGE_SIZE but callers should
 *                            pass a viewport-derived value for the initial fetch.
 *   loadOlderMessages()  — fetch the next page of older messages (cursor walk)
 *   addNewMessage(msg)   — insert a new message, deduped + sorted by timestamp
 *   addNewMessages(arr)  — batch-insert polled messages in one state update
 *   updateMessageById(id, patch) — point-update one message
 *   resetMessages()    — clear all state (use when conversation changes)
 */
import { useState, useRef, useCallback } from "react";
import { getMessages } from "../api/messages";
import { setCachedConversation } from "../services/conversationCache";

const OLDER_PAGE_SIZE = 12; // fixed page size for "load older" pagination

export default function useChatPagination(initialMessages = [], initialHasMore = true) {
  const [messages,     setMessages]     = useState(initialMessages);
  const [hasMore,      setHasMoreState] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const hasMoreRef = useRef(initialHasMore);
  const setHasMore = useCallback((val) => {
    const b = Boolean(val);
    hasMoreRef.current = b;
    setHasMoreState(b);
  }, []);

  const cursorRef       = useRef(null);
  const isLoadingRef    = useRef(false);
  const convIdRef       = useRef(null);
  const newestAtRef     = useRef(null);
  const isScrollingRef  = useRef(false);
  const pendingOlderRef = useRef(null);

  // ── prependOlder ────────────────────────────────────────────────────────────
  // Single, atomic commit path shared by loadOlderMessages and flushPendingOlder.
  // Dedupes against the current array, prepends in ONE setMessages call, updates
  // the cache, and advances cursorRef — all in one pass, so
  // maintainVisibleContentPosition only recomputes its anchor once per batch.
  const prependOlder = useCallback((conversationId, older, resHasMore, resNextCursor) => {
    if (!older || older.length === 0) {
      setHasMore(resHasMore || false);
      return;
    }

    let updatedList = [];
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const fresh = older.filter(m => !existingIds.has(m.id));
      if (fresh.length === 0) {
        updatedList = prev;
        return prev;
      }
      updatedList = [...fresh, ...prev];
      console.log(`[PAGINATION-PREPEND] Prepending ${fresh.length} msgs (single commit). prevLen=${prev.length} newTotal=${updatedList.length}`);
      return updatedList;
    });

    cursorRef.current = resNextCursor || (older.length > 0 ? older[0].createdAt : null);
    setHasMore(resHasMore || false);

    setCachedConversation(conversationId, {
      messages: updatedList,
      hasMore: resHasMore || false,
    });
  }, [setHasMore]);

  const flushPendingOlder = useCallback(() => {
    console.log(`[DIAG-FLUSH-CHECK] flushPendingOlder called. pendingOlderRef.current=${pendingOlderRef.current ? 'SET' : 'null'}`);
    if (!pendingOlderRef.current) return;
    const { older, resHasMore, resNextCursor, conversationId } = pendingOlderRef.current;
    pendingOlderRef.current = null;

    prependOlder(conversationId, older, resHasMore, resNextCursor);
  }, [prependOlder]);

  // ── loadInitial ────────────────────────────────────────────────────────────
  // Fetches the most-recent messages. Called once per conversation open.
  const loadInitial = useCallback(async (conversationId, limit = OLDER_PAGE_SIZE) => {
    convIdRef.current  = conversationId;
    cursorRef.current  = null;
    newestAtRef.current = null;
    pendingOlderRef.current = null;
    setMessages([]);
    setHasMore(false);

    try {
      const res = await getMessages(conversationId, { limit });
      if (convIdRef.current !== conversationId) return; // stale response

      // Backend returns messages oldest-first — store directly, no reversal needed.
      const msgs = res.messages || [];
      setMessages(msgs);
      setHasMore(res.hasMore || false);
      // Cursor = createdAt of the oldest (first) message in the array
      cursorRef.current   = res.nextCursor || null;
      // newestAt = createdAt of the last (newest) message
      newestAtRef.current = msgs.length > 0 ? msgs[msgs.length - 1].createdAt : null;
      return res;
    } catch (err) {
      throw err;
    }
  }, [setHasMore]);

  // ── loadOlderMessages ──────────────────────────────────────────────────────
  // Fetches the next page of older messages and PREPENDS them.
  // Called by FlashList's onStartReached or onScroll trigger.
  const loadOlderMessages = useCallback(async (conversationId) => {
    console.log(`[FRONTEND-PAGINATION] loadOlderMessages called — convId=${conversationId} convIdRef=${convIdRef.current} isLoading=${isLoadingRef.current} hasMoreRef=${hasMoreRef.current} cursorRef=${cursorRef.current} msgsCount=${messages.length}`);

    if (!conversationId) return;
    // Auto-bind convIdRef if uninitialized (e.g. on warm open before bootstrap)
    if (!convIdRef.current) convIdRef.current = conversationId;

    if (isLoadingRef.current) {
      console.log(`[FRONTEND-PAGINATION] BAILED: isLoadingRef is true`);
      return;
    }
    if (!hasMoreRef.current) {
      console.log(`[FRONTEND-PAGINATION] BAILED: hasMoreRef is false`);
      return;
    }

    const effectiveCursor = cursorRef.current || (messages.length > 0 ? messages[0].createdAt : null);
    if (!effectiveCursor) {
      console.log(`[FRONTEND-PAGINATION] BAILED: effectiveCursor is null`);
      return;
    }

    console.log(`[FRONTEND-PAGINATION] FETCHING older messages — before=${effectiveCursor}`);
    isLoadingRef.current = true;
    setLoadingOlder(true);

    try {
      const res = await getMessages(conversationId, {
        before: effectiveCursor,
        limit: OLDER_PAGE_SIZE,
      });
      if (convIdRef.current !== conversationId) {
        console.log(`[FRONTEND-PAGINATION] BAILED: stale response convIdRef=${convIdRef.current} !== ${conversationId}`);
        return;
      }

      const older = res.messages || [];
      console.log(`[FRONTEND-PAGINATION] RECEIVED ${older.length} older messages — res.hasMore=${res.hasMore} res.nextCursor=${res.nextCursor}`);

      if (older.length > 0 && isScrollingRef.current) {
        // [ISOLATION-TEST-DISABLED] defer-until-momentum-end bypass
        console.log(`[DIAG-DEFER-BYPASS] Would have deferred ${older.length} msgs — committing immediately instead. isScrolling=${isScrollingRef.current}`);
        prependOlder(conversationId, older, res.hasMore || false, res.nextCursor);
        // Original defer logic commented out below:
        // pendingOlderRef.current = {
        //   older,
        //   resHasMore: res.hasMore || false,
        //   resNextCursor: res.nextCursor || older[0].createdAt,
        //   conversationId,
        // };
        // cursorRef.current = res.nextCursor || older[0].createdAt;
        // [/ISOLATION-TEST-DISABLED]
      } else {
        // Not scrolling (or nothing came back) — commit immediately, in one
        // atomic setMessages call.
        prependOlder(conversationId, older, res.hasMore || false, res.nextCursor);
      }
    } catch (err) {
      console.error("[useChatPagination] loadOlderMessages error:", err);
    } finally {
      isLoadingRef.current = false;
      setLoadingOlder(false);
    }
  }, [messages, prependOlder]);

  // ── addNewMessage ──────────────────────────────────────────────────────────
  // Inserts a new message (outgoing send or Supabase realtime INSERT).
  // • Deduplicates by id.
  // • Sorts ascending (oldest → newest) after insertion so any out-of-order
  //   arrival (clock skew, delayed realtime event) lands in the correct position.
  //   New messages land at the END of the array (highest index = newest).
  const addNewMessage = useCallback((msg) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev; // deduplicate
      const next = [...prev, msg];
      // Maintain strict oldest → newest order (ascending by createdAt).
      // In the common case (new message is already the newest) the sort is
      // effectively a no-op after the first comparison — O(n) best case.
      next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      // Advance newestAt forward if this message is newer.
      if (!newestAtRef.current || new Date(msg.createdAt) > new Date(newestAtRef.current)) {
        newestAtRef.current = msg.createdAt;
      }
      return next;
    });
  }, []);

  // ── addNewMessages (batch) ─────────────────────────────────────────────────
  // Used by the polling fallback to merge a batch of fresh messages in ONE
  // state update (avoids N individual re-renders for N polled messages).
  // Deduplicates by id and sorts the merged result ascending (oldest → newest).
  const addNewMessages = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const fresh = incoming.filter(m => !existingIds.has(m.id));
      if (fresh.length === 0) return prev; // nothing actually new — bail out
      const next = [...prev, ...fresh];
      next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      // Advance newestAt — newest is now at last index
      const latestInBatch = fresh.reduce((latest, m) =>
        !latest || new Date(m.createdAt) > new Date(latest) ? m.createdAt : latest
      , null);
      if (latestInBatch && (!newestAtRef.current || new Date(latestInBatch) > new Date(newestAtRef.current))) {
        newestAtRef.current = latestInBatch;
      }
      return next;
    });
  }, []);

  // ── updateMessageById ──────────────────────────────────────────────────────
  // Point-updates a single message in the array (unsend, read status, etc.)
  // Only the patched message re-renders; all others are identity-stable.
  const updateMessageById = useCallback((id, patch) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, ...patch } : m)
    );
  }, []);

  // ── resetMessages ──────────────────────────────────────────────────────────
  const resetMessages = useCallback(() => {
    setMessages([]);
    setHasMore(false);
    setLoadingOlder(false);
    cursorRef.current   = null;
    convIdRef.current   = null;
    newestAtRef.current = null;
    isLoadingRef.current = false;
    pendingOlderRef.current = null;
  }, [setHasMore]);

  // ── bootstrapPaginationState ───────────────────────────────────────────────
  // Called by ChatScreen when it hydrates messages from the in-memory cache
  // (cache-HIT path) instead of going through loadInitial. loadInitial is the
  // normal setter for cursorRef / hasMore / newestAtRef — skipping it leaves
  // those uninitialised, so loadOlderMessages hits its !cursorRef guard and
  // silently no-ops, breaking "scroll up for older" on every second open.
  //
  // Call this once after the reconcile getMessages() resolves, passing the
  // authoritative values from the server response.
  const bootstrapPaginationState = useCallback(({
    conversationId,
    cursor,
    hasMore: serverHasMore,
    newestAt,
  }) => {
    convIdRef.current   = conversationId;
    cursorRef.current   = cursor || null;
    newestAtRef.current = newestAt || null;
    const finalHasMore = serverHasMore !== undefined ? Boolean(serverHasMore) : true;
    setHasMore(finalHasMore);
  }, [setHasMore]);

  return {
    messages,
    hasMore,
    loadingOlder,
    loadInitial,
    loadOlderMessages,
    addNewMessage,
    addNewMessages,
    updateMessageById,
    resetMessages,
    bootstrapPaginationState, // cache-HIT path only
    newestAtRef,
    isLoadingRef,
    isScrollingRef,
    flushPendingOlder,
  };
}