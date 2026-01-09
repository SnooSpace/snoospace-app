/**
 * Event State Utilities
 * Handles event state determination, visibility rules, and attendance logic
 */

// Event states
export const EVENT_STATES = {
  UPCOMING: "upcoming",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

/**
 * Get effective end time for an event
 * If end_datetime is missing, default to start + 1 hour
 */
export function getEffectiveEndTime(event) {
  if (event.end_datetime) {
    return new Date(event.end_datetime);
  }

  const start = new Date(event.start_datetime || event.event_date);
  return new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
}

/**
 * Determine event state based on current time
 * @param {Object} event - Event object with start_datetime, end_datetime, is_cancelled
 * @param {Date|string} serverTime - Server time for accurate comparison
 * @returns {string} One of EVENT_STATES values
 */
export function getEventState(event, serverTime) {
  if (!event) return null;

  // Cancelled overrides all time-based states
  if (event.is_cancelled) {
    return EVENT_STATES.CANCELLED;
  }

  const now = serverTime ? new Date(serverTime) : new Date();
  const start = new Date(event.start_datetime || event.event_date);
  const end = getEffectiveEndTime(event);

  if (now >= end) {
    return EVENT_STATES.COMPLETED;
  }

  if (now >= start) {
    return EVENT_STATES.ONGOING;
  }

  return EVENT_STATES.UPCOMING;
}

/**
 * Determine if "View Attendees" CTA should be shown
 * Rules:
 * - Hidden for cancelled events
 * - Hidden for community owners (they have separate dashboard)
 * - Visible when now >= start - 24 hours
 */
export function shouldShowViewAttendees(event, serverTime, userType) {
  if (!event) return false;

  // Never show for cancelled events
  if (event.is_cancelled) {
    return false;
  }

  // Never show for community owners
  if (userType === "community") {
    return false;
  }

  const now = serverTime ? new Date(serverTime) : new Date();
  const start = new Date(event.start_datetime || event.event_date);
  const twentyFourHoursBefore = new Date(start.getTime() - 24 * 60 * 60 * 1000);

  return now >= twentyFourHoursBefore;
}

/**
 * Determine if attendance confirmation should be asked
 * Rules:
 * - User must be registered
 * - Event must NOT be cancelled
 * - Attendance not yet confirmed
 * - Event must be ongoing or completed
 */
export function shouldAskAttendance(
  event,
  serverTime,
  isRegistered,
  attendanceStatus
) {
  if (!event || !isRegistered) return false;

  // Never ask for cancelled events
  if (event.is_cancelled) {
    return false;
  }

  // Already confirmed
  if (attendanceStatus) {
    return false;
  }

  const state = getEventState(event, serverTime);

  // Only ask for ongoing or completed events
  return state === EVENT_STATES.ONGOING || state === EVENT_STATES.COMPLETED;
}

/**
 * Get bottom bar configuration based on event state
 */
export function getBottomBarConfig(event, serverTime, isRegistered, userType) {
  const state = getEventState(event, serverTime);

  if (state === EVENT_STATES.CANCELLED) {
    return {
      showLeftContent: true,
      leftContent: "cancelled",
      showPrimaryButton: false,
      showViewAttendees: false,
    };
  }

  if (state === EVENT_STATES.UPCOMING) {
    return {
      showLeftContent: true,
      leftContent: isRegistered ? "registered" : "price",
      showPrimaryButton: true,
      primaryButtonText: isRegistered ? "View Your Ticket" : "Book tickets",
      showViewAttendees: false, // Never in bottom bar for upcoming
    };
  }

  // ONGOING or COMPLETED
  const showAttendees = shouldShowViewAttendees(event, serverTime, userType);

  return {
    showLeftContent: true,
    leftContent: isRegistered ? "registered" : "price",
    showPrimaryButton: true,
    primaryButtonText: "View Your Ticket",
    showViewAttendees: isRegistered && showAttendees,
  };
}

/**
 * Get View Attendees button state
 * Always visible for members (except cancelled events), but locked before 24h
 */
export function getViewAttendeesState(event, serverTime, userType) {
  if (!event) return { visible: false };

  // Never show for cancelled events
  if (event.is_cancelled) {
    return { visible: false };
  }

  // Never show for community owners
  if (userType === "community") {
    return { visible: false };
  }

  const now = serverTime ? new Date(serverTime) : new Date();
  const start = new Date(event.start_datetime || event.event_date);
  const unlockTime = new Date(start.getTime() - 24 * 60 * 60 * 1000);

  return {
    visible: true,
    locked: now < unlockTime,
    unlockTime: unlockTime,
  };
}

/**
 * Get registration progress data for the progress bar
 * @param {number} registrationCount - Current registrations
 * @param {number|null} totalPublicCapacity - Public ticket capacity (null = unlimited)
 * @param {number|null} totalCapacity - Total ticket capacity (null = unlimited)
 * @param {boolean} isMostlyInviteOnly - Whether event is mostly invite-only
 */
export function getRegistrationProgress(
  registrationCount,
  totalPublicCapacity,
  totalCapacity,
  isMostlyInviteOnly
) {
  const registered = registrationCount || 0;

  // Use total capacity if mostly invite-only, otherwise use public capacity
  const capacity = isMostlyInviteOnly ? totalCapacity : totalPublicCapacity;

  // Unlimited capacity
  if (capacity === null || capacity === undefined || capacity === 0) {
    return {
      registered,
      capacity: null,
      percentage: null,
      unlimited: true,
      soldOut: false,
      almostFull: false,
    };
  }

  const percentage = Math.min((registered / capacity) * 100, 100);
  const soldOut = registered >= capacity;
  const almostFull = !soldOut && registered >= capacity * 0.8;

  return {
    registered,
    capacity,
    percentage,
    unlimited: false,
    soldOut,
    almostFull,
  };
}

/**
 * Get progress bar color based on fill percentage
 * Green (0-60%) → Amber (60-80%) → Red (80%+)
 */
export function getProgressBarColor(percentage) {
  if (percentage === null || percentage === undefined) {
    return "#10B981"; // Default green
  }

  if (percentage >= 80) {
    return "#EF4444"; // Red
  }

  if (percentage >= 60) {
    return "#F59E0B"; // Amber
  }

  return "#10B981"; // Green
}
