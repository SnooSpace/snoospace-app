import {
  Palette as Art,
  Dumbbell,
  Globe,
  Briefcase,
  HeartPulse,
  ShoppingBag,
  Store,
  Zap,
} from "lucide-react-native";

// --- Community Categories Configuration ---
export const COMMUNITY_CATEGORIES_CONFIG = {
  ARTS: {
    label: "Arts & Culture",
    bg: "#FCE4EC", // Pink-ish
    text: "#C2185B",
    icon: Art,
    keywords: [
      "art",
      "culture",
      "music",
      "movie",
      "book",
      "photo",
      "fashion",
      "design",
      "creative",
    ],
  },
  LIFESTYLE: {
    label: "Lifestyle",
    bg: "#FFF3E0", // Orange-ish
    text: "#E65100",
    icon: Globe,
    keywords: ["food", "drink", "travel", "outdoor", "adventure", "explore"],
  },
  ACTIVITY: {
    label: "Activity & Sports",
    bg: "#E3F2FD", // Blue-ish
    text: "#1565C0",
    icon: Dumbbell,
    keywords: ["sport", "fitness", "gym", "game", "gaming", "esports"],
  },
  PROFESSIONAL: {
    label: "Professional & Tech",
    bg: "#E0F7FA", // Cyan-ish
    text: "#006064",
    icon: Briefcase,
    keywords: ["tech", "network", "volunteer", "career", "business", "coding"],
  },
  DEFAULT: {
    label: "Other",
    bg: "#F5F5F5",
    text: "#424242",
    icon: Zap,
    keywords: [],
  },
};

export const getCategoryStyle = (category) => {
  if (!category) return COMMUNITY_CATEGORIES_CONFIG.DEFAULT;
  const lower = category.toLowerCase();

  for (const key in COMMUNITY_CATEGORIES_CONFIG) {
    const config = COMMUNITY_CATEGORIES_CONFIG[key];
    if (config.keywords.some((k) => lower.includes(k))) {
      return config;
    }
  }
  return COMMUNITY_CATEGORIES_CONFIG.DEFAULT;
};

// --- Sponsor Types Configuration ---
export const SPONSOR_TYPES_CONFIG = {
  HEALTH: {
    label: "Health & Fitness",
    bg: "#E8F5E9", // Green-ish
    text: "#2E7D32",
    icon: HeartPulse,
    keywords: ["protein", "supplement", "energy", "vitality", "health"],
  },
  COMMERCIAL: {
    label: "Retail & Tech",
    bg: "#F3E5F5", // Purple-ish
    text: "#7B1FA2",
    icon: ShoppingBag,
    keywords: ["apparel", "clothing", "tech", "gadget", "gear"],
  },
  LOCAL: {
    label: "Local",
    bg: "#FFF8E1", // Amber-ish
    text: "#F57F17",
    icon: Store,
    keywords: ["local", "business", "shop", "neighborhood"],
  },
  OPEN: {
    label: "Open",
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Globe,
    keywords: ["open to all"],
  },
  DEFAULT: {
    label: "Other",
    bg: "#F5F5F5",
    text: "#424242",
    icon: Zap,
    keywords: [],
  },
};

export const getSponsorTypeStyle = (type) => {
  if (!type) return SPONSOR_TYPES_CONFIG.DEFAULT;
  const lower = type.toLowerCase();

  if (lower === "open to all") return SPONSOR_TYPES_CONFIG.OPEN;

  for (const key in SPONSOR_TYPES_CONFIG) {
    const config = SPONSOR_TYPES_CONFIG[key];
    if (config.keywords.some((k) => lower.includes(k))) {
      return config;
    }
  }
  return SPONSOR_TYPES_CONFIG.DEFAULT;
};
