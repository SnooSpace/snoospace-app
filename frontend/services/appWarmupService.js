import { AppState } from "react-native";
import { Image } from "expo-image";
import { getConversations } from "../api/messages";
import { fetchUnreadCount } from "../api/notifications";

// ─── Shared module-level cache ────────────────────────────────────────────────
// This is the same variable read by ConversationsListScreen on mount.
// Writing here before the screen opens means useState(cachedConversations)
// initialises with real data → no loading spinner, no first-fetch delay.
//
// Exported so ConversationsListScreen can also import it and keep one truth.
export let warmedConversations = null;

/** Called by ConversationsListScreen to read the warm cache on mount. */
export function readWarmConversationsCache() {
  return warmedConversations;
}

/** Called by ConversationsListScreen after its own fetch to keep caches in sync. */
export function writeWarmConversationsCache(conversations) {
  warmedConversations = conversations;
}

/** Called on account switch / logout to prevent stale data leaking across sessions. */
export function clearWarmConversationsCache() {
  warmedConversations = null;
}

// ─── Warmup state ─────────────────────────────────────────────────────────────
let isWarmed = false;
let warmupInProgress = false;
let appStateSubscription = null;
let currentPhaseTimeout = null;

const metrics = {
  startedAt: 0,
  finishedAt: 0,
  duration: 0,
  phasesCompleted: [],
  imagesPrefetched: 0,
  skippedTasks: [],
  chatOpenWasWarm: false,
};

// ─── Idle scheduler ───────────────────────────────────────────────────────────
const runOnIdle = (callback) => {
  if (typeof requestIdleCallback === "function") {
    return requestIdleCallback(callback, { timeout: 2000 });
  }
  return setTimeout(callback, 200);
};

const cancelIdle = (id) => {
  if (typeof cancelIdleCallback === "function") {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

// ─── Service ──────────────────────────────────────────────────────────────────
/**
 * App Warmup Service
 *
 * Orchestration-only: fetches data and caches assets during idle time.
 * Does not process business logic, build models, or own analytics.
 *
 * Phases:
 *   B – Data:   fetch conversations list + unread notification count
 *   C – Assets: prefetch decoded avatar/group images
 */
export const AppWarmupService = {
  /**
   * Start the warmup pipeline.
   * Runs once per app session (or after invalidate()).
   * Cancels automatically if the app moves to background.
   */
  start() {
    if (isWarmed || warmupInProgress) return;

    console.log("[AppWarmupService] Starting (Phases B → C)...");
    warmupInProgress = true;
    metrics.startedAt = performance.now();

    // Stop if user backgrounds the app
    appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next.match(/inactive|background/)) {
        console.log("[AppWarmupService] Backgrounded — cancelling.");
        AppWarmupService.cancel();
      }
    });

    AppWarmupService._runPhaseB();
  },

  // ── Phase B: Data prefetch ─────────────────────────────────────────────────
  _runPhaseB() {
    currentPhaseTimeout = runOnIdle(async () => {
      try {
        console.log("[AppWarmupService] Phase B — data prefetch");

        // Fetch in parallel; only unread count for notifications (cheap),
        // full list for conversations (so the cache hit is real).
        const [convsRes] = await Promise.all([
          getConversations().catch(() => null),
          fetchUnreadCount().catch(() => null), // warms the notifications endpoint; result used by context
        ]);

        const conversations = convsRes?.conversations || [];

        // Write into the shared cache that ConversationsListScreen reads on mount.
        // This is what makes the cache hit real: the screen's useState() sees
        // actual data and skips the loading spinner entirely.
        warmedConversations = conversations;

        metrics.phasesCompleted.push("B(data)");
        AppWarmupService._runPhaseC(conversations);
      } catch (err) {
        console.warn("[AppWarmupService] Phase B error:", err.message);
        metrics.skippedTasks.push("B");
        AppWarmupService._finish();
      }
    });
  },

  // ── Phase C: Asset prefetch ────────────────────────────────────────────────
  _runPhaseC(conversations = []) {
    currentPhaseTimeout = runOnIdle(async () => {
      try {
        console.log("[AppWarmupService] Phase C — asset prefetch");

        const uris = new Set();
        conversations.slice(0, 12).forEach((conv) => {
          // Skip conversations where the other side has blocked the user
          if (!conv.isGroup && conv.otherParticipant?.isBlockedByOther) return;
          const uri = conv.isGroup
            ? conv.groupAvatarUrl
            : conv.otherParticipant?.profilePhotoUrl;
          if (uri) uris.add(uri);
        });

        if (uris.size > 0) {
          await Promise.all(
            Array.from(uris).map((uri) =>
              Image.prefetch(uri)
                .then(() => { metrics.imagesPrefetched += 1; })
                .catch(() => {})
            )
          );
        }

        metrics.phasesCompleted.push("C(assets)");
        AppWarmupService._finish();
      } catch (err) {
        console.warn("[AppWarmupService] Phase C error:", err.message);
        metrics.skippedTasks.push("C");
        AppWarmupService._finish();
      }
    });
  },

  // ── Internals ──────────────────────────────────────────────────────────────
  _finish() {
    isWarmed = true;
    warmupInProgress = false;
    metrics.finishedAt = performance.now();
    metrics.duration = metrics.finishedAt - metrics.startedAt;

    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }

    console.log(
      `[AppWarmupService] Done. ${metrics.duration.toFixed(1)}ms | ` +
      `phases: ${metrics.phasesCompleted.join(", ")} | ` +
      `images: ${metrics.imagesPrefetched} | ` +
      `skipped: ${metrics.skippedTasks.join(", ") || "none"}`
    );
  },

  cancel() {
    warmupInProgress = false;
    if (currentPhaseTimeout) {
      cancelIdle(currentPhaseTimeout);
      currentPhaseTimeout = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },

  isWarmed: () => isWarmed,

  /**
   * Reset warmup state — call on account switch so the new session preloads
   * fresh data rather than reading a stale warm cache.
   */
  invalidate() {
    isWarmed = false;
    warmupInProgress = false;
    warmedConversations = null;
    metrics.phasesCompleted = [];
    metrics.imagesPrefetched = 0;
    metrics.skippedTasks = [];
  },

  /**
   * Log whether the first Chat open was a warm cache hit.
   * Call this from the MessageCircle icon press handler.
   */
  recordChatOpen() {
    metrics.chatOpenWasWarm = isWarmed;
    console.log(
      `[AppWarmupService] Chat opened — warm cache hit: ${isWarmed ? "YES ✅" : "NO ❌"}`
    );
  },
};
