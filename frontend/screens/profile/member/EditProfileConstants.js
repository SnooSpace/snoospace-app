import { Platform, UIManager } from "react-native";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import {
  User,
  Dumbbell,
  Palette as Art,
  Clapperboard,
  Utensils,
  Mountain,
  Gamepad2,
  PartyPopper,
  Zap,
} from "lucide-react-native";

// Interest Categories Configuration
export const INTEREST_CATEGORIES = {
  LIFESTYLE: {
    label: "Lifestyle",
    bg: "#FFF3E0", // Warm beige
    text: "#E65100",
    icon: User,
    keywords: [
      "lifestyle",
      "dating",
      "fashion",
      "volunteer",
      "cars",
      "bikes",
      "driving",
      "meditation",
    ],
  },
  SPORTS: {
    label: "Sports & Fitness",
    bg: "#E3F2FD", // Soft Blue
    text: "#1565C0",
    icon: Dumbbell,
    keywords: [
      "sport",
      "gym",
      "run",
      "fitness",
      "yoga",
      "football",
      "basketball",
      "cricket",
      "badminton",
      "cycling",
    ],
  },
  ARTS: {
    label: "Arts & Culture",
    bg: "#FCE4EC", // Soft Pink
    text: "#C2185B",
    icon: Art,
    keywords: [
      "art",
      "design",
      "creative",
      "draw",
      "paint",
      "write",
      "photo",
      "culture",
      "history",
    ],
  },
  ENTERTAINMENT: {
    label: "Entertainment",
    bg: "#F3E5F5", // Lavender
    text: "#7B1FA2",
    icon: Clapperboard,
    keywords: [
      "movie",
      "film",
      "music",
      "concert",
      "book",
      "read",
      "netflix",
      "cinema",
      "show",
      "anime",
      "manga",
    ],
  },
  FOOD: {
    label: "Food & Drink",
    bg: "#FFF8E1", // Amber
    text: "#F57F17",
    icon: Utensils,
    keywords: [
      "food",
      "cook",
      "bake",
      "drink",
      "coffee",
      "cafe",
      "bar",
      "wine",
      "beer",
      "dining",
    ],
  },
  OUTDOORS: {
    label: "Outdoors & Adventure",
    bg: "#E8F5E9", // Mint
    text: "#2E7D32",
    icon: Mountain,
    keywords: [
      "nature",
      "hike",
      "camp",
      "travel",
      "adventure",
      "explore",
      "mountain",
      "beach",
    ],
  },
  TECH: {
    label: "Tech & Gaming",
    bg: "#E0F7FA", // Cyan
    text: "#006064",
    icon: Gamepad2,
    keywords: [
      "tech",
      "game",
      "gaming",
      "code",
      "ai",
      "pc",
      "console",
      "science",
      "data",
    ],
  },
  SOCIAL: {
    label: "Social",
    bg: "#EDE7F6", // Deep Purple Light
    text: "#4527A0",
    icon: PartyPopper,
    keywords: [
      "social",
      "party",
      "club",
      "event",
      "meetup",
      "chat",
      "friends",
      "networking",
    ],
  },
  DEFAULT: {
    label: "Other",
    bg: "#F5F5F5",
    text: "#424242",
    icon: Zap,
    keywords: [],
  },
};

export const getInterestStyle = (interest) => {
  if (!interest) return INTEREST_CATEGORIES.DEFAULT;
  const lower = interest.toLowerCase();

  // Special overrides
  if (lower.includes("bar hopping") || lower.includes("cafe"))
    return INTEREST_CATEGORIES.FOOD;
  if (lower.includes("run")) return INTEREST_CATEGORIES.SPORTS;

  for (const key in INTEREST_CATEGORIES) {
    const category = INTEREST_CATEGORIES[key];
    if (
      category.keywords.some((k) => lower.includes(k)) ||
      key === interest.toUpperCase()
    ) {
      return category;
    }
  }
  return INTEREST_CATEGORIES.DEFAULT;
};
