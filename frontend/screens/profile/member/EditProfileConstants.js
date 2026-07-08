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
  UtensilsCrossed,
  Mountain,
  Gamepad2,
  PartyPopper,
  Car,
  PawPrint,
  Zap,
} from "lucide-react-native";

// Interest Categories Configuration matching updated "My Vibes" spec
export const INTEREST_CATEGORIES = {
  LIFESTYLE: {
    label: "Lifestyle",
    bg: "#FFF3E0", // Warm beige
    text: "#E65100",
    icon: User,
    keywords: [
      "fashion",
      "volunteering",
      "beauty & skincare",
      "minimalism & sustainable living",
      "home & design",
      "spirituality"
    ],
  },
  SPORTS: {
    label: "Sports & Fitness",
    bg: "#E3F2FD", // Soft Blue
    text: "#1565C0",
    icon: Dumbbell,
    keywords: [
      "sports",
      "fitness",
      "run club",
      "badminton",
      "basketball",
      "football",
      "cycling",
      "yoga",
      "gym & weightlifting",
      "swimming",
      "martial arts"
    ],
  },
  ARTS: {
    label: "Arts & Culture",
    bg: "#FCE4EC", // Soft Pink
    text: "#C2185B",
    icon: Art,
    keywords: [
      "art & culture",
      "photography",
      "theatre & drama",
      "poetry & writing",
      "dance",
      "design & architecture",
      "crafts & diy"
    ],
  },
  ENTERTAINMENT: {
    label: "Entertainment",
    bg: "#F3E5F5", // Lavender
    text: "#7B1FA2",
    icon: Clapperboard,
    keywords: [
      "music",
      "movies",
      "books",
      "tv & streaming",
      "anime & comics",
      "board games",
      "stand-up comedy",
      "k-pop"
    ],
  },
  FOOD: {
    label: "Food & Drink",
    bg: "#FFF8E1", // Amber
    text: "#F57F17",
    icon: UtensilsCrossed,
    keywords: [
      "food & drink",
      "bar hopping",
      "cafe hopping",
      "foodie",
      "drinks",
      "home cooking & baking",
      "vegan & vegetarian"
    ],
  },
  OUTDOORS: {
    label: "Outdoors & Adventure",
    bg: "#E8F5E9", // Mint
    text: "#2E7D32",
    icon: Mountain,
    keywords: [
      "travel",
      "adventure",
      "camping",
      "hiking & trekking",
      "backpacking",
      "road trips",
      "beach & water sports"
    ],
  },
  TECH: {
    label: "Tech & Gaming",
    bg: "#E0F7FA", // Cyan
    text: "#006064",
    icon: Gamepad2,
    keywords: [
      "technology",
      "gaming",
      "esports",
      "ai & data science",
      "startups & entrepreneurship",
      "vr & ar"
    ],
  },
  SOCIAL: {
    label: "Social",
    bg: "#EDE7F6", // Deep Purple Light
    text: "#4527A0",
    icon: PartyPopper,
    keywords: [
      "networking",
      "making friends",
      "coffee chats",
      "public speaking",
      "language exchange",
      "speed friending",
      "dating"
    ],
  },
  AUTOMOTIVE: {
    label: "Automotive",
    bg: "#F1F5F9", // Slate grey
    text: "#475569",
    icon: Car,
    keywords: [
      "cars",
      "bikes",
      "motorsport fandom",
      "ev & sustainable mobility"
    ],
  },
  PETS: {
    label: "Pets & Animals",
    bg: "#ECFDF5", // Light emerald
    text: "#047857",
    icon: PawPrint,
    keywords: [
      "dog owner",
      "cat owner",
      "pet adoption & rescue"
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
  const lower = interest.toLowerCase().trim();

  for (const key in INTEREST_CATEGORIES) {
    const category = INTEREST_CATEGORIES[key];
    if (
      category.keywords.some((k) => lower.includes(k)) ||
      key === interest.toUpperCase().trim()
    ) {
      return category;
    }
  }
  return INTEREST_CATEGORIES.DEFAULT;
};
