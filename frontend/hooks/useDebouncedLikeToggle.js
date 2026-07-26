import { useRef, useState, useCallback, useEffect } from 'react';

const DEBOUNCE_MS = 500;

// ─────────────────────────────────────────────────────────────────────────────
// Default isAlreadyInStateError implementation.
//
// api/client.js's buildError() sets:
//   err.message = data.error  (the backend string)
//   err.status  = res.status  (the HTTP status code)
//
// Backend returns for redundant like/unlike:
//   400 { error: "Post already liked" }
//   400 { error: "Post not liked" }
//   400 { error: "Already liked" }        ← opportunities endpoint variant
//   400 { error: "Not liked" }            ← opportunities endpoint variant
//   400 { error: "Event already liked" }  ← events endpoint variant
// ─────────────────────────────────────────────────────────────────────────────
const ALREADY_IN_STATE_MESSAGES = [
  'post already liked',
  'post not liked',
  'already liked',
  'not liked',
  'event already liked',
];

export function defaultIsAlreadyInStateError(err) {
  if (err?.status !== 400) return false;
  const msg = (err?.message || '').toLowerCase();
  return ALREADY_IN_STATE_MESSAGES.some((s) => msg.includes(s));
}

/**
 * useDebouncedLikeToggle
 *
 * Shared hook for all like/unlike interactions across every card type.
 * Replaces the per-card isLikingRef guard + handleLike pattern.
 *
 * Behaviour contract:
 *  • Every tap updates UI instantly — zero blocking, no disabled state.
 *  • Rapid taps are debounced: only ONE network request fires per burst,
 *    reflecting the net state after the burst settles.
 *  • If a request is in-flight when the debounce fires, the new sync is
 *    queued and retried automatically in the finally block.
 *  • Net-no-op bursts (even # of taps, back to original state) fire ZERO
 *    network requests.
 *  • On genuine server failure: UI reverts to last confirmed state.
 *  • On "already in that state" 400: treated as a silent confirmation, not
 *    an error — UI stays as-is, count is not double-adjusted.
 *
 * @param {object} params
 * @param {string|number} params.itemId           - post/event/opportunity id
 * @param {boolean}        params.initialIsLiked
 * @param {number}         params.initialLikeCount
 * @param {() => Promise}  params.likeEndpoint    - async fn that calls the like API
 * @param {() => Promise}  params.unlikeEndpoint  - async fn that calls the unlike API
 * @param {(isLiked: boolean, likeCount: number) => void} [params.onConfirmed]
 *   Called ONLY after the server confirms the action. Use this for EventBus
 *   emissions and parent onLike lifts — NOT on every optimistic tap.
 * @param {(err: any) => boolean} [params.isAlreadyInStateError]
 *   Return true if the error means the server already agrees with the
 *   desired state (idempotent 400). Defaults to checking the known backend
 *   message strings from api/client.js's buildError().
 *
 * @returns {{ isLiked: boolean, likeCount: number, toggle: () => void, reset: (isLiked: boolean, count: number) => void }}
 */
export function useDebouncedLikeToggle({
  itemId,
  initialIsLiked,
  initialLikeCount,
  likeEndpoint,
  unlikeEndpoint,
  onConfirmed,
  isAlreadyInStateError = defaultIsAlreadyInStateError,
}) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);

  // Refs — readable synchronously from any closure, never stale.
  const desiredStateRef   = useRef(initialIsLiked);   // what the user wants right now
  const confirmedStateRef = useRef(initialIsLiked);   // last state the server confirmed
  const confirmedCountRef = useRef(initialLikeCount); // last count the server confirmed
  const inFlightRef       = useRef(false);            // true while a request is in-flight
  const debounceTimerRef  = useRef(null);

  // ── reset ─────────────────────────────────────────────────────────────────
  // Call this when the underlying item changes (cell recycle / useRecyclingState
  // equivalent). The caller is responsible for triggering this on itemId change
  // via a useEffect([post.id]).
  const reset = useCallback((nextIsLiked, nextLikeCount) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    desiredStateRef.current   = nextIsLiked;
    confirmedStateRef.current = nextIsLiked;
    confirmedCountRef.current = nextLikeCount;
    inFlightRef.current       = false;
    setIsLiked(nextIsLiked);
    setLikeCount(nextLikeCount);
  }, []);

  // ── syncToServer ──────────────────────────────────────────────────────────
  // Fires the actual network request for whatever desiredStateRef says right now.
  // Safe to call while in-flight — it will no-op and schedule a retry in finally.
  const syncToServer = useCallback(async () => {
    if (inFlightRef.current) return; // another request is already in-flight; retry in finally
    const target = desiredStateRef.current;
    if (target === confirmedStateRef.current) return; // net no-op — skip the network

    inFlightRef.current = true;
    try {
      await (target ? likeEndpoint() : unlikeEndpoint());

      // Server confirmed — advance confirmed refs
      confirmedStateRef.current = target;
      confirmedCountRef.current = confirmedCountRef.current + (target ? 1 : -1);
      onConfirmed?.(target, confirmedCountRef.current);

    } catch (err) {
      if (isAlreadyInStateError(err)) {
        // Server already agrees with target — treat as silent confirmation.
        // Do NOT adjust confirmedCountRef; the count is already right on the server.
        confirmedStateRef.current = target;
        onConfirmed?.(target, confirmedCountRef.current);
      } else {
        // Genuine failure — revert UI to the last server-confirmed state.
        desiredStateRef.current = confirmedStateRef.current;
        setIsLiked(confirmedStateRef.current);
        setLikeCount(confirmedCountRef.current);
      }
    } finally {
      inFlightRef.current = false;
      // If the user tapped again while this request was in-flight, desired
      // state may have moved — sync again immediately (no extra debounce).
      if (desiredStateRef.current !== confirmedStateRef.current) {
        syncToServer();
      }
    }
  }, [likeEndpoint, unlikeEndpoint, onConfirmed, isAlreadyInStateError]);

  // ── toggle ────────────────────────────────────────────────────────────────
  // The only function cards need to call on button press.
  const toggle = useCallback(() => {
    const next = !desiredStateRef.current;
    desiredStateRef.current = next;

    // Instant optimistic UI — no await, no disabled state, no guard check.
    setIsLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));

    // (Re)start debounce window
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(syncToServer, DEBOUNCE_MS);
  }, [syncToServer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return { isLiked, likeCount, toggle, reset };
}
