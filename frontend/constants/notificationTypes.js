/**
 * Notification Types Registry (Frontend)
 */

export const NotificationTypes = {
  // --- Activity Category ---
  like: {
    category: "activity",
    channel: "activity",
    icon: "❤️",
  },
  comment: {
    category: "activity",
    channel: "activity",
    icon: "💬",
  },
  reply: {
    category: "activity",
    channel: "activity",
    icon: "💬",
  },
  tag: {
    category: "activity",
    channel: "activity",
    icon: "🏷️",
  },
  submission_approved: {
    category: "activity",
    channel: "activity",
    icon: "✅",
  },
  submission_rejected: {
    category: "activity",
    channel: "activity",
    icon: "❌",
  },
  submission_comment: {
    category: "activity",
    channel: "activity",
    icon: "💬",
  },
  prompt_submission: {
    category: "activity",
    channel: "activity",
    icon: "📝",
  },
  qna_question: {
    category: "activity",
    channel: "activity",
    icon: "🙋",
  },
  qna_upvote: {
    category: "activity",
    channel: "activity",
    icon: "👍",
  },
  qna_answered: {
    category: "activity",
    channel: "activity",
    icon: "🎉",
  },
  submission_moderated: {
    category: "activity",
    channel: "activity",
    icon: "🛡️",
  },
  plan_like: {
    category: "activity",
    channel: "activity",
    icon: "❤️",
  },
  plan_comment: {
    category: "activity",
    channel: "activity",
    icon: "💬",
  },
  challenge_submission_like: {
    category: "activity",
    channel: "activity",
    icon: "❤️",
  },

  // --- Communities Category ---
  follow: {
    category: "communities",
    channel: "social",
    icon: "👤",
  },
  creator_follow_received: {
    category: "communities",
    channel: "social",
    icon: "✨",
  },
  circle_request_received: {
    category: "communities",
    channel: "social",
    icon: "🤝",
  },
  circle_request_accepted: {
    category: "communities",
    channel: "social",
    icon: "✅",
  },
  community_circle_invite: {
    category: "communities",
    channel: "social",
    icon: "✉️",
  },

  // --- Messages Category ---
  dm: {
    category: "messages",
    channel: "messages",
    icon: "💬",
  },

  // --- Events Category ---
  event_reminder_24h: {
    category: "events",
    channel: "events",
    icon: "📅",
  },
  event_reminder_1h: {
    category: "events",
    channel: "events",
    icon: "⏰",
  },
  attendance_confirmation: {
    category: "events",
    channel: "events",
    icon: "🎫",
  },
  event_updated: {
    category: "events",
    channel: "events",
    icon: "📝",
  },
  event_rescheduled: {
    category: "events",
    channel: "events",
    icon: "📅",
  },
  event_cancelled: {
    category: "events",
    channel: "events",
    icon: "❌",
  },
  event_deleted: {
    category: "events",
    channel: "events",
    icon: "🗑️",
  },
  event_registration: {
    category: "events",
    channel: "events",
    icon: "🎫",
  },
  tickets_sold_out: {
    category: "events",
    channel: "events",
    icon: "⚠️",
  },
  refund_processed: {
    category: "events",
    channel: "events",
    icon: "💵",
  },
  ticket_gifted: {
    category: "events",
    channel: "events",
    icon: "🎁",
  },
  gift_revoked: {
    category: "events",
    channel: "events",
    icon: "❌",
  },
  event_invite: {
    category: "events",
    channel: "events",
    icon: "✉️",
  },
  invite_request: {
    category: "events",
    channel: "events",
    icon: "✋",
  },
  invite_approved: {
    category: "events",
    channel: "events",
    icon: "✅",
  },
  invite_declined: {
    category: "events",
    channel: "events",
    icon: "❌",
  },
  plan_request: {
    category: "events",
    channel: "events",
    icon: "✋",
  },
  plan_approved: {
    category: "events",
    channel: "events",
    icon: "🎉",
  },
  plan_declined: {
    category: "events",
    channel: "events",
    icon: "❌",
  },
  plan_removed: {
    category: "events",
    channel: "events",
    icon: "❌",
  },

  // --- System Category ---
  removal_request: {
    category: "system",
    channel: "moderation",
    icon: "📋",
  },
  removal_request_review: {
    category: "system",
    channel: "moderation",
    icon: "🛡️",
  },
};

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "activity", label: "Activity" },
  { id: "messages", label: "Messages" },
  { id: "events", label: "Events" },
  { id: "communities", label: "Communities" },
  { id: "system", label: "System" },
];
