/**
 * salesTiming.js - Sales window timing and status utility.
 *
 * Mirrors the exact effective-end-date logic enforced in reserveTickets
 * (backend/controllers/eventController.js: Defect 2):
 *   effectiveStart = ticket.sale_start_at
 *   effectiveEnd = ticket.sale_end_at || event.start_datetime || event.event_date
 */

export function formatUpcomingLabel(startDate) {
  if (!startDate) return "Opens Soon";
  const date = startDate instanceof Date ? startDate : new Date(startDate);
  if (isNaN(date.getTime())) return "Opens Soon";

  const d = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  const t = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Opens ${d}, ${t}`;
}

export function formatEndingSoonLabel(msRemaining) {
  if (msRemaining <= 0) return "Sales Closed";

  const totalMinutes = Math.floor(msRemaining / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    return `Closes in ${days}d ${hours}h`;
  }
  if (hours >= 1) {
    return `Closes in ${hours}h ${minutes}m`;
  }
  return `Closes in ${Math.max(1, minutes)}m`;
}

/**
 * Formats a Date object to Meetup style: 'Friday, 25 September at 5:55 pm'
 *
 * @param {Date|string|number} date
 * @returns {string}
 */
export function formatRegistrationCloseDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";

  const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-IN", { month: "long" });
  const time = d
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();

  return `${weekday}, ${day} ${month} at ${time}`;
}

/**
 * Computes sales window status and metadata for a given ticket and event.
 *
 * @param {object} ticket - Ticket type object (sale_start_at, sale_end_at, name, etc.)
 * @param {object} event - Event object (start_datetime, event_date, etc.)
 * @param {Date|number} [now=new Date()] - Reference timestamp (optional, defaults to now)
 * @returns {{
 *   status: 'upcoming' | 'active' | 'ending_soon' | 'closed',
 *   effectiveStart: Date | null,
 *   effectiveEnd: Date | null,
 *   msRemaining: number | null,
 *   label: string | null
 * }}
 */
export function getSalesStatus(ticket, event, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();

  const effectiveStart = ticket?.sale_start_at
    ? new Date(ticket.sale_start_at)
    : null;

  const eventDateStr = event?.start_datetime || event?.event_date || null;
  const effectiveEnd = ticket?.sale_end_at
    ? new Date(ticket.sale_end_at)
    : eventDateStr
      ? new Date(eventDateStr)
      : null;

  const msRemaining =
    effectiveEnd && !isNaN(effectiveEnd.getTime())
      ? effectiveEnd.getTime() - nowMs
      : null;

  // 1. Upcoming check: effectiveStart exists and is in the future
  if (
    effectiveStart &&
    !isNaN(effectiveStart.getTime()) &&
    effectiveStart.getTime() > nowMs
  ) {
    return {
      status: "upcoming",
      effectiveStart,
      effectiveEnd,
      msRemaining,
      label: formatUpcomingLabel(effectiveStart),
    };
  }

  // 2. Closed check: effectiveEnd exists and has passed (or is right now)
  if (effectiveEnd && !isNaN(effectiveEnd.getTime()) && msRemaining <= 0) {
    return {
      status: "closed",
      effectiveStart,
      effectiveEnd,
      msRemaining: 0,
      label: "Sales Closed",
    };
  }

  // 3. Ending soon check: effectiveEnd exists and is within 48 hours
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  if (
    effectiveEnd &&
    !isNaN(effectiveEnd.getTime()) &&
    msRemaining > 0 &&
    msRemaining <= FORTY_EIGHT_HOURS_MS
  ) {
    return {
      status: "ending_soon",
      effectiveStart,
      effectiveEnd,
      msRemaining,
      label: formatEndingSoonLabel(msRemaining),
    };
  }

  // 4. Normal active sales (no near deadline)
  return {
    status: "active",
    effectiveStart,
    effectiveEnd,
    msRemaining,
    label: null,
  };
}

/**
 * Computes event-level registration timing for display in the Meetup-style row.
 *
 * @param {object} event - Event object (start_datetime, event_date, ticket_types, etc.)
 * @param {Date|number} [now=new Date()] - Reference timestamp (optional, defaults to now)
 * @returns {{
 *   status: 'active' | 'upcoming' | 'closed' | 'none',
 *   label: string | null,
 *   closeDate: Date | null,
 *   color: string
 * }}
 */
export function getRegistrationTiming(event, now = new Date()) {
  if (!event) {
    return { status: "none", label: null, closeDate: null, color: "#D97706" };
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const nowMs = nowDate.getTime();
  const tickets = event?.ticket_types;

  const eventDateStr = event?.start_datetime || event?.event_date || null;
  const fallbackDate = eventDateStr ? new Date(eventDateStr) : null;

  // Case 1: Tickets exist
  if (tickets && tickets.length > 0) {
    const statuses = tickets.map((t) => getSalesStatus(t, event, nowDate));
    const allClosed =
      statuses.length > 0 && statuses.every((s) => s.status === "closed");
    const allUpcoming =
      statuses.length > 0 && statuses.every((s) => s.status === "upcoming");

    if (allClosed) {
      return {
        status: "closed",
        label: "Registrations closed",
        closeDate: null,
        color: "#DC2626",
      };
    }

    if (allUpcoming) {
      const starts = statuses
        .map((s) => s.effectiveStart)
        .filter((d) => d && !isNaN(d.getTime()));
      const earliestStart =
        starts.length > 0
          ? new Date(Math.min(...starts.map((d) => d.getTime())))
          : null;

      return {
        status: "upcoming",
        label: earliestStart
          ? `Registrations open ${formatRegistrationCloseDate(earliestStart)}`
          : "Registrations opening soon",
        closeDate: earliestStart,
        color: "#2563EB",
      };
    }

    // Active registrations: find latest effectiveEnd among active or ending_soon tickets
    const activeOrEnding = statuses.filter(
      (s) => s.status === "active" || s.status === "ending_soon"
    );
    const ends = (activeOrEnding.length > 0 ? activeOrEnding : statuses)
      .map((s) => s.effectiveEnd)
      .filter((d) => d && !isNaN(d.getTime()));

    const latestEnd =
      ends.length > 0
        ? new Date(Math.max(...ends.map((d) => d.getTime())))
        : fallbackDate;

    if (latestEnd && !isNaN(latestEnd.getTime())) {
      if (latestEnd.getTime() <= nowMs) {
        return {
          status: "closed",
          label: "Registrations closed",
          closeDate: latestEnd,
          color: "#DC2626",
        };
      }
      return {
        status: "active",
        label: `Registrations close ${formatRegistrationCloseDate(latestEnd)}`,
        closeDate: latestEnd,
        color: "#D97706",
      };
    }
  }

  // Case 2: No ticket types, fallback to event start datetime
  if (fallbackDate && !isNaN(fallbackDate.getTime())) {
    if (fallbackDate.getTime() <= nowMs) {
      return {
        status: "closed",
        label: "Registrations closed",
        closeDate: fallbackDate,
        color: "#DC2626",
      };
    }
    return {
      status: "active",
      label: `Registrations close ${formatRegistrationCloseDate(fallbackDate)}`,
      closeDate: fallbackDate,
      color: "#D97706",
    };
  }

  return { status: "none", label: null, closeDate: null, color: "#D97706" };
}

export default getSalesStatus;

