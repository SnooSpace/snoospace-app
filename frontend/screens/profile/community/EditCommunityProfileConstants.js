import {
  Palette,
  Music,
  Clapperboard,
  Book,
  Camera,
  Drama,
  PenLine,
  Activity,
  LayoutTemplate,
  Hammer,
  Shirt,
  Sparkles,
  Footprints,
  Gem,
  ShoppingBag,
  Aperture,
  User,
  Plane,
  UtensilsCrossed,
  Tent,
  HeartHandshake,
  PawPrint,
  Flame,
  Leaf,
  Trophy,
  Dumbbell,
  Gamepad2,
  Bike,
  Flower,
  Monitor,
  MountainSnow,
  Timer,
  Swords,
  Waves,
  Briefcase,
  Code,
  HandHeart,
  Rocket,
  LineChart,
  Megaphone,
  PenTool,
  GraduationCap,
  BrainCircuit,
  Building,
  Scale,
  Users,
  Handshake,
  Coffee,
  Languages,
  MapPin,
  BookOpenCheck,
  Heart,
  Shuffle,
  Globe,
  School,
  Microscope,
  Pencil,
  Wrench,
  Mic,
  ClipboardList,
  Baby,
  Accessibility,
  BookOpen,
  Dice5,
  Tv,
  Disc,
  Video,
  Car,
  Flag,
  Zap,
  Map,
  HeartPulse,
  Store,
  ChefHat,
  Wine,
  Backpack,
  Laptop,
  Salad,
} from "lucide-react-native";

// --- Community Categories Configuration ---
export const COMMUNITY_CATEGORIES_CONFIG = {
  ARTS_CULTURE: {
    label: "Arts & Culture",
    bg: "#FCE4EC",
    text: "#C2185B",
    icon: Palette,
  },
  FASHION_BEAUTY: {
    label: "Fashion & Beauty",
    bg: "#F3E5F5",
    text: "#7B1FA2",
    icon: Shirt,
  },
  LIFESTYLE: {
    label: "Lifestyle",
    bg: "#FFF3E0",
    text: "#E65100",
    icon: User,
  },
  ACTIVITY_SPORTS: {
    label: "Activity & Sports",
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Activity,
  },
  PROFESSIONAL_TECH: {
    label: "Professional & Tech",
    bg: "#E0F7FA",
    text: "#006064",
    icon: Briefcase,
  },
  SOCIAL_MEETUPS: {
    label: "Social & Meetups",
    bg: "#EDE7F6",
    text: "#4527A0",
    icon: Users,
  },
  ACADEMICS_LEARNING: {
    label: "Academics & Learning",
    bg: "#E8EAF6",
    text: "#1A237E",
    icon: GraduationCap,
  },
  IDENTITY_COMMUNITY: {
    label: "Identity & Community",
    bg: "#FFEBEE",
    text: "#C62828",
    icon: HeartHandshake,
  },
  ENTERTAINMENT_FANDOM: {
    label: "Entertainment & Fandom",
    bg: "#FFF8E1",
    text: "#F57F17",
    icon: Clapperboard,
  },
  CAUSES_IMPACT: {
    label: "Causes & Impact",
    bg: "#E8F5E9",
    text: "#2E7D32",
    icon: Leaf,
  },
  AUTOMOTIVE_MOTORSPORTS: {
    label: "Automotive & Motorsports",
    bg: "#ECEFF1",
    text: "#37474F",
    icon: Car,
  },
  FOOD_DRINK: {
    label: "Food & Drink",
    bg: "#FFF3E0",
    text: "#E65100",
    icon: UtensilsCrossed,
  },
  TRAVEL_EXPLORATION: {
    label: "Travel & Exploration",
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Plane,
  },
  PETS_ANIMALS: {
    label: "Pets & Animals",
    bg: "#E8F5E9",
    text: "#2E7D32",
    icon: PawPrint,
  },
  HEALTH_SUPPORT: {
    label: "Health & Support",
    bg: "#E0F7FA",
    text: "#006064",
    icon: HeartHandshake,
  },
  DEFAULT: {
    label: "Other",
    bg: "#F5F5F5",
    text: "#424242",
    icon: Zap,
  },
};

export const COMMUNITY_CATEGORIES_HIERARCHY = [
  {
    group: "Arts & Culture",
    iconName: "palette",
    icon: Palette,
    bg: "#FCE4EC",
    text: "#C2185B",
    tags: [
      { name: "Music", iconName: "music", icon: Music },
      { name: "Art & Culture", iconName: "palette", icon: Palette },
      { name: "Movies", iconName: "clapperboard", icon: Clapperboard },
      { name: "Books", iconName: "book", icon: Book },
      { name: "Photography", iconName: "camera", icon: Camera },
      { name: "Theatre & Drama", iconName: "drama", icon: Drama },
      { name: "Poetry & Writing", iconName: "pen-line", icon: PenLine },
      { name: "Dance", iconName: "activity", icon: Activity },
      { name: "Design & Architecture", iconName: "layout-template", icon: LayoutTemplate },
      { name: "Crafts & DIY", iconName: "hammer", icon: Hammer }
    ]
  },
  {
    group: "Fashion & Beauty",
    iconName: "shirt",
    icon: Shirt,
    bg: "#F3E5F5",
    text: "#7B1FA2",
    tags: [
      { name: "Fashion & Style", iconName: "shirt", icon: Shirt },
      { name: "Beauty & Skincare", iconName: "sparkles", icon: Sparkles },
      { name: "Streetwear & Sneakers", iconName: "footprints", icon: Footprints },
      { name: "Luxury & Design", iconName: "gem", icon: Gem },
      { name: "Thrifting & Vintage", iconName: "shopping-bag", icon: ShoppingBag },
      { name: "Modeling", iconName: "aperture", icon: Aperture }
    ]
  },
  {
    group: "Lifestyle",
    iconName: "user",
    icon: User,
    bg: "#FFF3E0",
    text: "#E65100",
    tags: [
      { name: "Outdoors", iconName: "tent", icon: Tent },
      { name: "Wellness & Mindfulness", iconName: "heart-handshake", icon: HeartHandshake },
      { name: "Spirituality", iconName: "flame", icon: Flame },
      { name: "Minimalism & Sustainable Living", iconName: "leaf", icon: Leaf }
    ]
  },
  {
    group: "Activity & Sports",
    iconName: "activity",
    icon: Activity,
    bg: "#E3F2FD",
    text: "#1565C0",
    tags: [
      { name: "Sports", iconName: "trophy", icon: Trophy },
      { name: "Fitness", iconName: "dumbbell", icon: Dumbbell },
      { name: "Gaming", iconName: "gamepad-2", icon: Gamepad2 },
      { name: "Running", iconName: "footprints", icon: Footprints },
      { name: "Cycling", iconName: "bike", icon: Bike },
      { name: "Yoga", iconName: "flower", icon: Flower },
      { name: "Esports", iconName: "monitor", icon: Monitor },
      { name: "Adventure Sports", iconName: "mountain-snow", icon: MountainSnow },
      { name: "Gym & Weightlifting", iconName: "dumbbell", icon: Dumbbell },
      { name: "Bodybuilding", iconName: "flame", icon: Flame },
      { name: "CrossFit & HIIT", iconName: "timer", icon: Timer },
      { name: "Calisthenics", iconName: "activity", icon: Activity },
      { name: "Martial Arts", iconName: "swords", icon: Swords },
      { name: "Swimming", iconName: "waves", icon: Waves }
    ]
  },
  {
    group: "Professional & Tech",
    iconName: "briefcase",
    icon: Briefcase,
    bg: "#E0F7FA",
    text: "#006064",
    tags: [
      { name: "Technology", iconName: "code", icon: Code },
      { name: "Volunteering", iconName: "hand-heart", icon: HandHeart },
      { name: "Entrepreneurship & Startups", iconName: "rocket", icon: Rocket },
      { name: "Finance & Investing", iconName: "line-chart", icon: LineChart },
      { name: "Marketing & Growth", iconName: "megaphone", icon: Megaphone },
      { name: "Product & UX Design", iconName: "pen-tool", icon: PenTool },
      { name: "Career Development", iconName: "graduation-cap", icon: GraduationCap },
      { name: "AI & Data Science", iconName: "brain-circuit", icon: BrainCircuit },
      { name: "Consulting", iconName: "briefcase", icon: Briefcase },
      { name: "Real Estate", iconName: "building", icon: Building },
      { name: "Legal & Policy", iconName: "scale", icon: Scale }
    ]
  },
  {
    group: "Social & Meetups",
    iconName: "users",
    icon: Users,
    bg: "#EDE7F6",
    text: "#4527A0",
    tags: [
      { name: "Casual Hangouts", iconName: "users", icon: Users },
      { name: "Making Friends", iconName: "handshake", icon: Handshake },
      { name: "Coffee Chats", iconName: "coffee", icon: Coffee },
      { name: "Language Exchange", iconName: "languages", icon: Languages },
      { name: "Newcomers & Relocation", iconName: "map-pin", icon: MapPin },
      { name: "Study & Co-working", iconName: "book-open-check", icon: BookOpenCheck },
      { name: "Singles & Dating", iconName: "heart", icon: Heart },
      { name: "Speed Friending", iconName: "shuffle", icon: Shuffle },
      { name: "Expats & International Community", iconName: "globe", icon: Globe },
      { name: "Neighborhood & Local Community", iconName: "map-pin", icon: MapPin }
    ]
  },
  {
    group: "Academics & Learning",
    iconName: "graduation-cap",
    icon: GraduationCap,
    bg: "#E8EAF6",
    text: "#1A237E",
    tags: [
      { name: "College Life", iconName: "school", icon: School },
      { name: "Study Groups", iconName: "book", icon: Book },
      { name: "Research & Academia", iconName: "microscope", icon: Microscope },
      { name: "Competitive Exams", iconName: "pencil", icon: Pencil },
      { name: "Skill Development", iconName: "wrench", icon: Wrench },
      { name: "Public Speaking", iconName: "mic", icon: Mic },
      { name: "Test Prep (GRE, GMAT, CAT)", iconName: "clipboard-list", icon: ClipboardList },
      { name: "Higher Education Abroad", iconName: "plane", icon: Plane }
    ]
  },
  {
    group: "Identity & Community",
    iconName: "heart-handshake",
    icon: HeartHandshake,
    bg: "#FFEBEE",
    text: "#C62828",
    tags: [
      { name: "Women's Community", iconName: "users", icon: Users },
      { name: "Men's Community", iconName: "users", icon: Users },
      { name: "LGBTQ+", iconName: "heart", icon: Heart },
      { name: "Cultural & Regional Groups", iconName: "globe", icon: Globe },
      { name: "Faith & Religion", iconName: "church", icon: School },
      { name: "Parents & Family", iconName: "baby", icon: Baby },
      { name: "Alumni Networks", iconName: "school", icon: School },
      { name: "Differently-abled Community", iconName: "accessibility", icon: Accessibility },
      { name: "Senior & 50+ Community", iconName: "users", icon: Users }
    ]
  },
  {
    group: "Entertainment & Fandom",
    iconName: "clapperboard",
    icon: Clapperboard,
    bg: "#FFF8E1",
    text: "#F57F17",
    tags: [
      { name: "Anime & Comics", iconName: "book-open", icon: BookOpen },
      { name: "Board Games", iconName: "dice-5", icon: Dice5 },
      { name: "TV & Streaming", iconName: "tv", icon: Tv },
      { name: "Music Fandom", iconName: "disc", icon: Disc },
      { name: "Sports Fandom", iconName: "trophy", icon: Trophy },
      { name: "K-pop", iconName: "music", icon: Music },
      { name: "Cosplay", iconName: "drama", icon: Drama },
      { name: "Streaming & Content Creation", iconName: "video", icon: Video }
    ]
  },
  {
    group: "Causes & Impact",
    iconName: "leaf",
    icon: Leaf,
    bg: "#E8F5E9",
    text: "#2E7D32",
    tags: [
      { name: "Environment & Sustainability", iconName: "leaf", icon: Leaf },
      { name: "Social Impact", iconName: "hand-heart", icon: HandHeart },
      { name: "Animal Welfare", iconName: "paw-print", icon: PawPrint },
      { name: "Civic Engagement", iconName: "megaphone", icon: Megaphone },
      { name: "Human Rights", iconName: "scale", icon: Scale },
      { name: "Education Access", iconName: "graduation-cap", icon: GraduationCap }
    ]
  },
  {
    group: "Automotive & Motorsports",
    iconName: "car",
    icon: Car,
    bg: "#ECEFF1",
    text: "#37474F",
    tags: [
      { name: "Car Enthusiasts", iconName: "car", icon: Car },
      { name: "Bike & Motorcycle", iconName: "bike", icon: Bike },
      { name: "Motorsport Fandom", iconName: "flag", icon: Flag },
      { name: "EV & Sustainable Mobility", iconName: "zap", icon: Zap },
      { name: "Road Trips & Rallies", iconName: "map", icon: Map },
      { name: "Detailing & Modification", iconName: "wrench", icon: Wrench }
    ]
  },
  {
    group: "Food & Drink",
    iconName: "utensils-crossed",
    icon: UtensilsCrossed,
    bg: "#FFF3E0",
    text: "#E65100",
    tags: [
      { name: "Foodies & Restaurants", iconName: "utensils-crossed", icon: UtensilsCrossed },
      { name: "Home Cooking & Baking", iconName: "chef-hat", icon: ChefHat },
      { name: "Wine & Spirits", iconName: "wine", icon: Wine },
      { name: "Coffee Culture", iconName: "coffee", icon: Coffee },
      { name: "Vegan & Vegetarian", iconName: "leaf", icon: Leaf },
      { name: "Food Blogging & Reviewing", iconName: "camera", icon: Camera }
    ]
  },
  {
    group: "Travel & Exploration",
    iconName: "plane",
    icon: Plane,
    bg: "#E3F2FD",
    text: "#1565C0",
    tags: [
      { name: "Backpacking", iconName: "backpack", icon: Backpack },
      { name: "Solo Travel", iconName: "map", icon: Map },
      { name: "Luxury Travel", iconName: "gem", icon: Gem },
      { name: "Road Trips", iconName: "car", icon: Car },
      { name: "Digital Nomads", iconName: "laptop", icon: Laptop },
      { name: "Travel Photography", iconName: "camera", icon: Camera }
    ]
  },
  {
    group: "Pets & Animals",
    iconName: "paw-print",
    icon: PawPrint,
    bg: "#E8F5E9",
    text: "#2E7D32",
    tags: [
      { name: "Dog Owners", iconName: "paw-print", icon: PawPrint },
      { name: "Cat Lovers", iconName: "paw-print", icon: PawPrint },
      { name: "Pet Adoption & Rescue", iconName: "heart", icon: Heart },
      { name: "Exotic Pets", iconName: "paw-print", icon: PawPrint },
      { name: "Pet Training", iconName: "graduation-cap", icon: GraduationCap },
      { name: "Pet-friendly Meetups", iconName: "users", icon: Users }
    ]
  },
  {
    group: "Health & Support",
    iconName: "heart-handshake",
    icon: HeartHandshake,
    bg: "#E0F7FA",
    text: "#006064",
    tags: [
      { name: "Mental Health Support", iconName: "heart-handshake", icon: HeartHandshake },
      { name: "Chronic Illness Support", iconName: "heart-pulse", icon: HeartPulse },
      { name: "Nutrition & Diet", iconName: "salad", icon: Salad },
      { name: "Sober & Recovery Community", iconName: "hand-heart", icon: HandHeart },
      { name: "New Parents Support", iconName: "baby", icon: Baby }
    ]
  }
];

export const getCategoryStyle = (category) => {
  if (!category) return COMMUNITY_CATEGORIES_CONFIG.DEFAULT;
  const lower = category.toLowerCase().trim();

  // Search in hierarchy
  for (const groupObj of COMMUNITY_CATEGORIES_HIERARCHY) {
    const tagMatch = groupObj.tags.find((t) => t.name.toLowerCase() === lower);
    if (tagMatch) {
      return {
        label: groupObj.group,
        bg: groupObj.bg,
        text: groupObj.text,
        icon: tagMatch.icon,
      };
    }
  }

  // Fallback checking (keywords)
  for (const key in COMMUNITY_CATEGORIES_CONFIG) {
    const config = COMMUNITY_CATEGORIES_CONFIG[key];
    if (config.label.toLowerCase() === lower) {
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
