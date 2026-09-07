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
 * Get effective end time for an event.
 * end_datetime is a required field as of the schema fix — all events created
 * or edited via the app will always have a real end_datetime.
 * The fallback to start + 1h is kept ONLY as a narrow defensive path for
 * any pre-existing cached objects that might not have been refreshed yet.
 */
export function getEffectiveEndTime(event) {
  if (event.end_datetime) {
    return new Date(event.end_datetime);
  }

  // Defensive fallback for legacy cached objects only — not expected for any
  // event created or edited after the end_datetime required-field rollout.
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

/**
 * Checks if a location string is empty, placeholder, or generic "Selected Location"
 * @param {string|null|undefined} loc
 * @returns {boolean}
 */
export function isGenericOrSelectedLocation(loc) {
  if (!loc || typeof loc !== "string") return true;
  const lower = loc.trim().toLowerCase();
  return (
    lower === "" ||
    lower === "selected location" ||
    lower === "selected_location" ||
    lower === "location tbd" ||
    lower === "venue tbd" ||
    lower === "tbd"
  );
}

/**
 * Resolves event mode, display text, and icon name for event cards.
 * - Shows mode of event ("Hybrid", "In-Person", "Virtual") instead of "Selected Location"
 * - Returns appropriate Lucide icon name: "Layers" for Hybrid, "Video" for Virtual, "MapPin" for In-Person
 * @param {Object} event - Event object
 * @param {string|null} [customLocation] - Optional override location name
 * @returns {{
 *   eventType: 'in-person' | 'virtual' | 'hybrid',
 *   isVirtual: boolean,
 *   isHybrid: boolean,
 *   isInPerson: boolean,
 *   modeLabel: 'Hybrid' | 'Virtual' | 'In-Person',
 *   displayText: string,
 *   iconName: 'Layers' | 'Video' | 'MapPin'
 * }}
 */
export function getEventModeDetails(event, customLocation = null) {
  const eventType = (event?.event_type || event?.eventType || "in-person").toLowerCase();
  const isHybrid = eventType === "hybrid";
  const isVirtual = eventType === "virtual";
  const isInPerson = !isHybrid && !isVirtual;

  const rawLoc = (
    customLocation ||
    event?.location_name ||
    event?.venue_name ||
    event?.location ||
    event?.address ||
    ""
  ).trim();

  const isGeneric = isGenericOrSelectedLocation(rawLoc);

  let modeLabel = "In-Person";
  let iconName = "MapPin";

  if (isHybrid) {
    modeLabel = "Hybrid";
    iconName = "Layers";
  } else if (isVirtual) {
    modeLabel = "Virtual";
    iconName = "Video";
  } else {
    modeLabel = "In-Person";
    iconName = "MapPin";
  }

  let displayText;
  if (isVirtual) {
    displayText =
      !isGeneric &&
      rawLoc.toLowerCase() !== "virtual event" &&
      rawLoc.toLowerCase() !== "online / virtual event" &&
      rawLoc.toLowerCase() !== "online event"
        ? rawLoc
        : "Virtual";
  } else if (isGeneric) {
    // Replace "Selected location" or generic/empty text with mode of event
    displayText = modeLabel;
  } else {
    displayText = rawLoc;
  }

  return {
    eventType,
    isVirtual,
    isHybrid,
    isInPerson,
    modeLabel,
    displayText,
    iconName,
  };
}
