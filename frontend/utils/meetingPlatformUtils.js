/**
 * Meeting Platform Utilities
 * Detects, formats, and styles virtual meeting platforms from URL or explicit field.
 */

export const PLATFORM_PRESETS = [
  { id: "google_meet", name: "Google Meet", domain: "meet.google.com", color: "#00897B", bg: "rgba(0, 137, 123, 0.1)" },
  { id: "zoom", name: "Zoom", domain: "zoom.us", color: "#2D8CFF", bg: "rgba(45, 140, 255, 0.1)" },
  { id: "teams", name: "Microsoft Teams", domain: "teams.microsoft.com", color: "#505AC9", bg: "rgba(80, 90, 201, 0.1)" },
  { id: "youtube", name: "YouTube Live", domain: "youtube.com", color: "#FF0000", bg: "rgba(255, 0, 0, 0.1)" },
  { id: "discord", name: "Discord", domain: "discord.gg", color: "#5865F2", bg: "rgba(88, 101, 242, 0.1)" },
  { id: "twitch", name: "Twitch", domain: "twitch.tv", color: "#9146FF", bg: "rgba(145, 70, 255, 0.1)" },
  { id: "x_spaces", name: "X Spaces", domain: "x.com", color: "#1D9BF0", bg: "rgba(29, 155, 240, 0.1)" },
  { id: "luma", name: "Luma", domain: "lu.ma", color: "#EB5757", bg: "rgba(235, 87, 87, 0.1)" },
  { id: "webex", name: "Cisco Webex", domain: "webex.com", color: "#00BCEB", bg: "rgba(0, 188, 235, 0.1)" },
];

/**
 * Detect meeting platform metadata from link or saved platform name
 * @param {string} url - Meeting link URL
 * @param {string} explicitPlatform - Optional saved platform name
 */
export function detectMeetingPlatform(url = "", explicitPlatform = "") {
  if (explicitPlatform && explicitPlatform.trim()) {
    const trimmed = explicitPlatform.trim();
    const preset = PLATFORM_PRESETS.find(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase() || p.id.toLowerCase() === trimmed.toLowerCase()
    );
    if (preset) {
      return {
        id: preset.id,
        name: preset.name,
        color: preset.color,
        bg: preset.bg,
        isCustom: false,
      };
    }
    return {
      id: "custom",
      name: trimmed,
      color: "#2563EB",
      bg: "rgba(37, 99, 235, 0.1)",
      isCustom: true,
    };
  }

  if (!url || typeof url !== "string") {
    return {
      id: "virtual",
      name: "Online Event",
      color: "#2563EB",
      bg: "rgba(37, 99, 235, 0.1)",
      isCustom: false,
    };
  }

  const clean = url.toLowerCase().trim();

  if (clean.includes("meet.google.com")) {
    return { id: "google_meet", name: "Google Meet", color: "#00897B", bg: "rgba(0, 137, 123, 0.1)", isCustom: false };
  }
  if (clean.includes("zoom.us") || clean.includes("zoomgov.com")) {
    return { id: "zoom", name: "Zoom", color: "#2D8CFF", bg: "rgba(45, 140, 255, 0.1)", isCustom: false };
  }
  if (clean.includes("teams.microsoft.com") || clean.includes("teams.live.com")) {
    return { id: "teams", name: "Microsoft Teams", color: "#505AC9", bg: "rgba(80, 90, 201, 0.1)", isCustom: false };
  }
  if (clean.includes("youtube.com") || clean.includes("youtu.be")) {
    return { id: "youtube", name: "YouTube Live", color: "#FF0000", bg: "rgba(255, 0, 0, 0.1)", isCustom: false };
  }
  if (clean.includes("discord.gg") || clean.includes("discord.com")) {
    return { id: "discord", name: "Discord", color: "#5865F2", bg: "rgba(88, 101, 242, 0.1)", isCustom: false };
  }
  if (clean.includes("twitch.tv")) {
    return { id: "twitch", name: "Twitch", color: "#9146FF", bg: "rgba(145, 70, 255, 0.1)", isCustom: false };
  }
  if (clean.includes("x.com/i/spaces") || clean.includes("twitter.com/i/spaces")) {
    return { id: "x_spaces", name: "X Spaces", color: "#1D9BF0", bg: "rgba(29, 155, 240, 0.1)", isCustom: false };
  }
  if (clean.includes("lu.ma")) {
    return { id: "luma", name: "Luma", color: "#EB5757", bg: "rgba(235, 87, 87, 0.1)", isCustom: false };
  }
  if (clean.includes("webex.com")) {
    return { id: "webex", name: "Cisco Webex", color: "#00BCEB", bg: "rgba(0, 188, 235, 0.1)", isCustom: false };
  }

  return {
    id: "virtual",
    name: "Online Event",
    color: "#2563EB",
    bg: "rgba(37, 99, 235, 0.1)",
    isCustom: false,
  };
}
