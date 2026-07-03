import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { connectSocket } from '../services/socketService';
import EventBus from '../utils/EventBus';

/**
 * useAppResume
 *
 * Central foreground-resume coordinator. Runs a single ordered sequence of
 * actions when the app transitions from background/inactive → active.
 *
 * Ordering rationale:
 *   1. Refresh auth state — check storage for logout/session changes first,
 *      so subsequent socket registration uses a valid identity.
 *   2. Reconnect socket — re-register user room after auth is confirmed.
 *   3. Emit 'appResumed' — any other subsystem that needs to react to foreground
 *      can subscribe via EventBus.on('appResumed') without needing another
 *      AppState listener.
 *
 * What this hook does NOT do:
 *   - Does not clear cachedToken (Phase 1 makes the cache self-healing via
 *     updateAccountTokens; clearing on every foreground would defeat the cache).
 *   - Does not duplicate logic already handled by subsystem-level AppState listeners
 *     (feed polling, profile counts, session tracker, view queue).
 *   - Does not replace useTokenRefresh's own AppState listener — token refresh
 *     continues to run independently and in parallel.
 *
 * Resume lock:
 *   Certain OEM Android devices (Samsung, Xiaomi) emit multiple rapid AppState
 *   transitions on a single foreground event. The resumeInProgress ref ensures
 *   only one resume sequence executes at a time.
 *
 * @param {object}   deps
 * @param {Function} deps.onRefreshAuthState — from AuthStateContext.refreshAuthState
 */
export function useAppResume({ onRefreshAuthState } = {}) {
  const appStateRef = useRef(AppState.currentState);
  const resumeInProgress = useRef(false);

  // Keep the latest callback in a ref so the AppState handler always calls
  // the current version without needing to re-subscribe on every render.
  const onRefreshAuthStateRef = useRef(onRefreshAuthState);
  useEffect(() => {
    onRefreshAuthStateRef.current = onRefreshAuthState;
  }, [onRefreshAuthState]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        // Only fire on background/inactive → active transition
        if (!prev.match(/inactive|background/) || nextState !== 'active') {
          return;
        }

        // Resume lock — guard against OEM multi-fire
        if (resumeInProgress.current) {
          console.log('[AppResume] Resume already in progress, skipping duplicate event');
          return;
        }
        resumeInProgress.current = true;

        try {
          console.log('[AppResume] Foreground detected — running resume sequence');

          // ── Step 1: Refresh auth state ────────────────────────────────────
          try {
            if (typeof onRefreshAuthStateRef.current === 'function') {
              await onRefreshAuthStateRef.current();
            }
          } catch (e) {
            console.warn('[AppResume] Auth state refresh failed:', e?.message);
          }

          // ── Step 2: Reconnect socket ──────────────────────────────────────
          try {
            await connectSocket();
          } catch (e) {
            console.warn('[AppResume] Socket reconnect failed:', e?.message);
          }

          // ── Step 3: Broadcast appResumed ──────────────────────────────────
          EventBus.emit('appResumed');

          console.log('[AppResume] Done.');
        } finally {
          // Always release the lock so future foreground events can run
          resumeInProgress.current = false;
        }
      }
    );

    return () => subscription.remove();
  // Empty deps: subscribe once, never re-subscribe.
  // The ref above ensures we always call the latest onRefreshAuthState.
  }, []);
}
