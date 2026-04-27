/**
 * useChatPagination
 *
 * Owns all message-list state for the ChatScreen.
 * Uses cursor-based pagination (?before=<ISO>&limit=20) so that
 * prepending older messages never shifts the visible viewport.
 *
 * API surface:
 *   messages           — current flat array of messages (oldest → newest)
 *   hasMore            — true while more older pages exist
 *   loadingOlder       — true while a "load older" request is in flight
 *   loadInitial(id)    — fetch the 20 most-recent messages for a conversation
 *   loadOlderMessages()  — fetch the next page of older messages (cursor walk)
 *   addNewMessage(msg)   — insert a new message, deduped + sorted by timestamp
 *   addNewMessages(arr)  — batch-insert polled messages in one state update
 *   updateMessageById(id, patch) — point-update one message
 *   resetMessages()    — clear all state (use when conversation changes)
 */
import { useState, useRef, useCallback } from "react";
import { getMessages } from "../api/messages";

const PAGE_SIZE = 20;

export default function useChatPagination() {
  const [messages,     setMessages]     = useState([]);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Cursor = ISO timestamp of the oldest message we have fetched.
  // Each "load older" call passes this as ?before=<cursor>.
  const cursorRef       = useRef(null);
  // Guard: prevent concurrent "load older" calls.
  const isLoadingRef    = useRef(false);
  // The conversation currently loaded (used to ignore stale responses).
  const convIdRef       = useRef(null);
  // Track the createdAt of the newest message we have.
  // The polling fallback uses this to request only messages ?after=<newestAt>
  // instead of re-fetching the full recent history every tick.
  const newestAtRef     = useRef(null);

  // ── loadInitial ────────────────────────────────────────────────────────────
  // Fetches the 20 most-recent messages.  Called once per conversation open.
  const loadInitial = useCallback(async (conversationId) => {
    convIdRef.current  = conversationId;
    cursorRef.current  = null;
    newestAtRef.current = null;
    setMessages([]);
    setHasMore(false);

    try {
      const res = await getMessages(conversationId, { limit: PAGE_SIZE });
      if (convIdRef.current !== conversationId) return; // stale response

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
  }, []);

  // ── loadOlderMessages ──────────────────────────────────────────────────────
  // Fetches the next page of older messages and PREPENDS them.
  // Called by FlashList's onEndReached (which fires when scrolling up in an
  // inverted list).
  const loadOlderMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    if (isLoadingRef.current) return;   // already in flight
    if (!hasMore) return;               // nothing more to fetch
    if (!cursorRef.current) return;     // no cursor yet (shouldn't happen)

    isLoadingRef.current = true;
    setLoadingOlder(true);

    try {
      const res = await getMessages(conversationId, {
        before: cursorRef.current,
        limit: PAGE_SIZE,
      });
      if (convIdRef.current !== conversationId) return; // stale

      const older = res.messages || [];
      if (older.length > 0) {
        // PREPEND: older messages go before existing ones.
        // FlashList's maintainVisibleContentPosition keeps the viewport stable.
        setMessages(prev => {
          // Deduplicate by id (safety net for edge cases)
          const existingIds = new Set(prev.map(m => m.id));
          const fresh = older.filter(m => !existingIds.has(m.id));
          // Older messages are already sorted ascending from backend;
          // prepending them maintains overall ascending order.
          return [...fresh, ...prev];
        });
        // Advance cursor to the oldest of the newly fetched batch
        cursorRef.current = res.nextCursor || null;
      }
      setHasMore(res.hasMore || false);
    } catch (err) {
      console.error("[useChatPagination] loadOlderMessages error:", err);
    } finally {
      isLoadingRef.current = false;
      setLoadingOlder(false);
    }
  }, [hasMore]);

  // ── addNewMessage ──────────────────────────────────────────────────────────
  // Inserts a new message (outgoing send or Supabase realtime INSERT).
  // • Deduplicates by id.
  // • Sorts by createdAt after insertion so any out-of-order arrival
  //   (clock skew, delayed realtime event) lands in the correct position.
  const addNewMessage = useCallback((msg) => {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev; // deduplicate
      const next = [...prev, msg];
      // Maintain strict oldest → newest order.
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
  // Deduplicates by id and sorts the merged result.
  const addNewMessages = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const fresh = incoming.filter(m => !existingIds.has(m.id));
      if (fresh.length === 0) return prev; // nothing actually new — bail out
      const next = [...prev, ...fresh];
      next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      // Advance newestAt
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
  }, []);

  return {
    messages,
    hasMore,
    loadingOlder,
    loadInitial,
    loadOlderMessages,
    addNewMessage,
    addNewMessages,   // batch insert — used by the polling fallback
    updateMessageById,
    resetMessages,
    newestAtRef,      // forward-cursor ref so polling fetches only new messages
  };
}
