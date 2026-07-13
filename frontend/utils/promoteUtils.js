/**
 * promoteUtils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised logic for the "Promote" feature — determines whether an event
 * or open plan is currently promotable, and provides human-readable reasons
 * when it is not.
 *
 * Rules
 * ──────
 * EVENTS
 *   ✅ Promotable  : upcoming, not cancelled, and still at least 1 hour before start
 *   ❌ Not promotable:
 *       - is_past === true (backend-flagged as past)
 *       - event_date < now  (client-side guard)
 *       - event_date is within the next 1 hour  ("starting soon")
 *       - status === 'cancelled'
 *
 * OPEN PLANS
 *   ✅ Promotable  : status is 'upcoming' or 'open', not full, not cancelled/completed
 *   ❌ Not promotable:
 *       - status === 'cancelled' or 'completed'
 *       - scheduled_at is in the past (plan already happened)
 *       - scheduled_at is within the next 1 hour
 *       - plan is full (all spots accepted) — still show button, just warn
 *
 * Returns { canPromote: boolean, reason: string | null }
 * When canPromote is false, `reason` is a short user-facing message.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * @param {object} event - event object from backend
 * @returns {{ canPromote: boolean, reason: string | null }}
 */
export function getEventPromoteState(event) {
  if (!event) return { canPromote: false, reason: 'Event not found' };

  // Backend already flagged as past
  if (event.is_past) {
    return { canPromote: false, reason: 'This event has already happened' };
  }

  // Explicit cancelled status
  if (event.status === 'cancelled') {
    return { canPromote: false, reason: 'This event has been cancelled' };
  }

  const eventDate = event.event_date || event.start_datetime;
  if (eventDate) {
    const eventMs  = new Date(eventDate).getTime();
    const nowMs    = Date.now();
    const msUntil  = eventMs - nowMs;

    if (msUntil < 0) {
      // Already started (client-side guard, backend should have flagged is_past)
      return { canPromote: false, reason: 'This event has already started' };
    }

    if (msUntil < ONE_HOUR_MS) {
      const minsLeft = Math.ceil(msUntil / 60000);
      return {
        canPromote: false,
        reason: `Event starts in ${minsLeft} min — too close to promote`,
      };
    }
  }

  return { canPromote: true, reason: null };
}

/**
 * @param {object} plan - open plan object from backend
 * @returns {{ canPromote: boolean, reason: string | null }}
 */
export function getPlanPromoteState(plan) {
  if (!plan) return { canPromote: false, reason: 'Plan not found' };

  if (plan.status === 'cancelled') {
    return { canPromote: false, reason: 'This plan has been cancelled' };
  }

  if (plan.status === 'completed') {
    return { canPromote: false, reason: 'This plan is already completed' };
  }

  const acceptedN = plan.accepted_count || 0;
  const maxAccepted = plan.max_accepted || 0;
  if (maxAccepted > 0 && acceptedN >= maxAccepted) {
    return { canPromote: false, reason: 'This plan is already full' };
  }

  const scheduledAt = plan.scheduled_at;
  if (scheduledAt) {
    const planMs  = new Date(scheduledAt).getTime();
    const nowMs   = Date.now();
    const msUntil = planMs - nowMs;

    // Past plans (3h buffer for "live" window)
    const THREE_HOURS_MS = 3 * ONE_HOUR_MS;
    if (nowMs > planMs + THREE_HOURS_MS) {
      return { canPromote: false, reason: 'This plan has already happened' };
    }

    // Starting very soon
    if (msUntil > 0 && msUntil < ONE_HOUR_MS) {
      const minsLeft = Math.ceil(msUntil / 60000);
      return {
        canPromote: false,
        reason: `Plan starts in ${minsLeft} min — too close to promote`,
      };
    }
  }

  return { canPromote: true, reason: null };
}

/**
 * Format a human-readable "Promotes reset on…" label.
 * @param {string|Date} resetsAt  - ISO timestamp when quota resets
 * @returns {string}
 */
export function formatQuotaResetLabel(resetsAt) {
  if (!resetsAt) return '';
  const d = new Date(resetsAt);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day:     'numeric',
    month:   'short',
  });
}
