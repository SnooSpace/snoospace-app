/**
 * conversationCache.js — In-memory LRU cache for recently-viewed conversations.
 *
 * Purpose: Eliminate the 200-780ms blocking fetch every time the user reopens
 * a chat they were just in. On cache hit, ChatScreen paints real messages
 * on the first frame while a background reconcile fetch merges any new arrivals.
 *
 * Design mirrors api/auth.js's cachedProfileMap / inFlightProfileRequests pattern:
 *   - Module-level Map (lives for the JS process lifetime)
 *   - Keyed by conversationId (string)
 *   - LRU eviction at MAX_CACHED_CONVERSATIONS entries
 *   - Cleared on account switch to prevent cross-account leakage
 *
 * NOT persisted to disk: messages are sensitive and the warm-path benefit
 * (same session, same user) doesn't require cross-session persistence.
 * For cold-start message hydration, a separate AsyncStorage path would be needed.
 *
 * TTL: Entries older than CACHE_TTL_MS are treated as stale and ignored, so
 * a conversation reopened after a long background session gets fresh data.
 */

import authEventEmitter from "../utils/authEventEmitter";

const MAX_CACHED_CONVERSATIONS = 10;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — generous for a warm session

/**
 * Internal cache Map.
 * Values: { messages: Array, cursor: string|null, cachedAt: number }
 *
 * LRU access order is maintained by deleting + re-inserting on every read/write
 * (Map preserves insertion order, so the oldest entry is always Map.entries().next()).
 */
const conversationCache = new Map();

// Clear on account switch — prevents cross-account data leakage
authEventEmitter.on("accountSwitched", () => {
  conversationCache.clear();
});

// ── LRU helpers ─────────────────────────────────────────────────────────────

function evictIfNeeded() {
  if (conversationCache.size < MAX_CACHED_CONVERSATIONS) return;
  // Map preserves insertion order; the first entry is the least-recently-used.
  const oldestKey = conversationCache.keys().next().value;
  conversationCache.delete(oldestKey);
}

function touchEntry(conversationId, entry) {
  // Re-insert to move to end (most-recently-used position in insertion order)
  conversationCache.delete(conversationId);
  conversationCache.set(conversationId, entry);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the cached entry for this conversation, or null if:
 *   - no entry exists
 *   - the entry is older than CACHE_TTL_MS
 *
 * A cache hit moves the entry to the MRU end of the eviction order.
 *
 * @param {string|number} conversationId
 * @returns {{ messages: Array, cursor: string|null, cachedAt: number } | null}
 */
export function getCachedConversation(conversationId) {
  const key = String(conversationId);
  const entry = conversationCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    conversationCache.delete(key);
    return null;
  }

  // Touch (LRU update) without mutating the entry itself
  touchEntry(key, entry);
  return entry;
}

/**
 * Stores or updates the cache entry for a conversation.
 * Caps the stored message array at 30 most-recent messages to bound memory.
 * Evicts the LRU conversation if the cache is full.
 *
 * cursor is always auto-derived from messages[0].createdAt (the oldest stored
 * message after trimming) — callers must NOT pass a cursor. Deriving it here
 * guarantees the cursor is always consistent with the actual stored messages
 * regardless of query type or previous bad data.
 *
 * @param {string|number} conversationId
 * @param {{ messages: Array, hasMore: boolean }} param1
 */
export function setCachedConversation(conversationId, { messages, hasMore }) {
  const key = String(conversationId);
  evictIfNeeded();

  const wasTrimmed = Array.isArray(messages) && messages.length > 20;
  const trimmed = Array.isArray(messages) ? messages.slice(-20) : [];
  const oldestTime = trimmed.length > 0 ? trimmed[0].createdAt : null;

  const finalHasMore = wasTrimmed ? true : (hasMore !== undefined ? hasMore : true);

  const entry = {
    messages: trimmed,
    cursor: oldestTime,
    hasMore: finalHasMore,
    cachedAt: Date.now(),
  };
  conversationCache.delete(key); // ensure re-insert at MRU end
  conversationCache.set(key, entry);
}

/**
 * Appends a single new message to the cached entry for a conversation.
 * No-ops if no entry exists yet (nothing to append to).
 * Advances the cachedAt timestamp so the TTL window extends with live activity.
 * Trims to the last 30 messages to prevent unbounded growth during long sessions.
 *
 * @param {string|number} conversationId
 * @param {Object} newMessage
 */
export function appendMessageToCache(conversationId, newMessage) {
  const key = String(conversationId);
  const entry = conversationCache.get(key);
  if (!entry) return; // no entry to append to — no-op

  // Deduplicate by id (same guard as addNewMessage in useChatPagination)
  if (entry.messages.some((m) => m.id === newMessage.id)) return;

  const newMessages = [...entry.messages, newMessage].slice(-30);
  const updated = {
    messages: newMessages,
    // Recompute cursor: if trimming evicted the oldest message, the cursor
    // must advance to the new oldest. Always derive from messages[0].
    cursor: newMessages.length > 0 ? newMessages[0].createdAt : entry.cursor,
    hasMore: entry.hasMore !== undefined ? entry.hasMore : true,
    cachedAt: Date.now(), // extend TTL — conversation is still active
  };
  touchEntry(key, updated);
}

/**
 * Removes a single conversation's cache entry.
 * Call when a conversation is deleted/hidden so stale data isn't shown on reopen.
 *
 * @param {string|number} conversationId
 */
export function clearConversationCache(conversationId) {
  conversationCache.delete(String(conversationId));
}
