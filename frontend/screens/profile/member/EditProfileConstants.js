// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Interest Categories Configuration
const INTEREST_CATEGORIES = {
  CREATIVE: {
    bg: "#FFEBEE",
    text: "#C62828",
    icon: Palette,
    keywords: ["art", "design", "photo", "fashion", "write", "draw", "dance"],
  },
  MUSIC: {
    bg: "#F3E5F5",
    text: "#7B1FA2",
    icon: Music,
    keywords: ["music", "concert", "fest", "guitar", "piano", "sing"],
  },
  NATURE: {
    bg: "#E8F5E9",
    text: "#2E7D32",
    icon: TreeDeciduous,
    keywords: ["nature", "hik", "camp", "outdoors", "garden", "flower"],
  },
  TECH: {
    bg: "#E0F7FA",
    text: "#00838F",
    icon: Laptop,
    keywords: ["tech", "code", "gam", "pc", "data", "scifi", "ai"],
  },
  FOOD: {
    bg: "#FFF8E1",
    text: "#F9A825",
    icon: Coffee,
    keywords: ["food", "cof", "cook", "bak", "drink", "bar", "cafe"],
  },
  FITNESS: {
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Dumbbell,
    keywords: ["fit", "gym", "run", "sport", "yoga", "ball"],
  },
  TRAVEL: {
    bg: "#E0F2F1",
    text: "#00695C",
    icon: Plane,
    keywords: ["travel", "trip", "explor", "adv"],
  },
  MOVIES: {
    bg: "#F3E5F5",
    text: "#6A1B9A",
    icon: Film,
    keywords: ["movi", "film", "cinem", "show", "netflix"],
  },
  BOOKS: {
    bg: "#FFF3E0",
    text: "#EF6C00",
    icon: BookOpen,
    keywords: ["book", "read", "novel", "lit"],
  },
  MYSTERY: {
    bg: "#ECEFF1",
    text: "#37474F",
    icon: Search,
    keywords: ["crime", "myst", "thrill", "detect"],
  },
  ROMANCE: {
    bg: "#FCE4EC",
    text: "#C2185B",
    icon: Heart,
    keywords: ["roman", "love", "date"],
  },
  DEFAULT: { bg: "#F5F5F5", text: "#424242", icon: Zap, keywords: [] },
};

const getInterestStyle = (interest) => {
  if (!interest) return INTEREST_CATEGORIES.DEFAULT;
  const lower = interest.toLowerCase();

  // Special overrides
  if (lower.includes("bar hopping") || lower.includes("cafe"))
    return INTEREST_CATEGORIES.FOOD;
  if (lower.includes("run")) return INTEREST_CATEGORIES.FITNESS;

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
