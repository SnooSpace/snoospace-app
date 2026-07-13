/**
 * Timing and eligibility utilities for event RSVP/Attendance verification prompts
 */

/**
 * Check if the user should be prompted to verify if they are still going to the event
 * @param {Object} event - Event object
 * @param {Object} verification - Verification record from DB (optional)
 * @returns {boolean}
 */
export function shouldShowRSVP(event, verification) {
  if (!event) return false;

  const now = Date.now();
  const startTime = new Date(event.start_datetime || event.event_date).getTime();
  const diffMs = startTime - now;
  const diffHours = diffMs / (1000 * 60 * 60);

  // Trigger: starts in less than 20 hours, but has not started yet
  if (diffHours <= 0 || diffHours > 20) {
    return false;
  }

  // If already answered, do not prompt
  if (verification) {
    const { status, next_prompt_at, dismiss_count } = verification;

    if (status === "confirmed" || status === "dont_going") {
      return false;
    }

    if (dismiss_count >= 3) {
      return false;
    }

    if (status === "ask_later" && next_prompt_at) {
      const nextPromptTime = new Date(next_prompt_at).getTime();
      if (now < nextPromptTime) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if the user should be prompted to verify if they attended the event
 * @param {Object} event - Event object
 * @param {Object} verification - Verification record from DB (optional)
 * @returns {boolean}
 */
export function shouldShowAttendance(event, verification) {
  if (!event) return false;

  // If already marked as attended/not attended on the registration row, skip
  if (event.attendance_status === "attended" || event.attendance_status === "did_not_attend") {
    return false;
  }

  const now = Date.now();
  const startTime = new Date(event.start_datetime || event.event_date).getTime();
  const diffMs = now - startTime;
  const diffHours = diffMs / (1000 * 60 * 60);

  // Trigger: event started at least 2 hours ago, up to 7 days (168 hours) ago
  if (diffHours < 2 || diffHours > 168) {
    return false;
  }

  // If already answered, do not prompt
  if (verification) {
    const { status, next_prompt_at, dismiss_count } = verification;

    if (status === "confirmed" || status === "did_not_attend") {
      return false;
    }

    if (dismiss_count >= 3) {
      return false;
    }

    if (status === "ask_later" && next_prompt_at) {
      const nextPromptTime = new Date(next_prompt_at).getTime();
      if (now < nextPromptTime) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculate the next prompt timestamp when a user selects 'Ask me later'
 * @param {Object} event - Event object
 * @param {'going' | 'attendance'} type - Prompt type
 * @returns {string} ISO Date string of next prompt time
 */
export function calculateAskLaterCooldown(event, type) {
  const now = Date.now();
  
  if (type === "going") {
    const startTime = new Date(event.start_datetime || event.event_date).getTime();
    const remainingMs = startTime - now;
    // min(1 hour, remaining window / 2), with a safe floor of 5 minutes
    const cooldownMs = Math.max(5 * 60 * 1000, Math.min(60 * 60 * 1000, remainingMs / 2));
    return new Date(now + cooldownMs).toISOString();
  } else {
    // Attendance verification: delay by 6 hours
    return new Date(now + 6 * 60 * 60 * 1000).toISOString();
  }
}
