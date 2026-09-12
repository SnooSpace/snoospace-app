/**
 * ticketVisuals.js
 * Intelligent Ticket Theming, SVG Shapes & Color Allocation Engine for SnooSpace
 *
 * Ensures:
 * 1. Known ticket types (VIP, Virtual, Early Bird, Couple, Student, General, Men, Women, Invite Only)
 *    get their dedicated vibrant color palette and distinct SVG cutout shape.
 * 2. Unallocated / custom tickets get fresh, vibrant colors that haven't been used yet on screen,
 *    cycling through distinct ticket shapes so no two tickets look identical.
 * 3. Handles gender-based edge cases cleanly.
 * 4. Only authentic access restrictions (Men Pass, Women Pass, Invite Only) get tag badges,
 *    preventing redundant artificial tags (like "VIP Access" above "VIP").
 */

export const TICKET_SHAPES = {
  // 1. Classic cinema stub: smooth rounded circular cutouts
  classic: {
    id: "classic",
    path: "M 20,0 L 440,0 a 20,20 0 0,0 40,0 L 580,0 q 20,0 20,20 L 600,100 a 20,20 0 0,0 0,40 L 600,220 q 0,20 -20,20 L 480,240 a 20,20 0 0,0 -40,0 L 20,240 q -20,0 -20,-20 L 0,140 a 20,20 0 0,0 0,-40 L 0,20 q 0,-20 20,-20 Z",
    dashArray: "5 5",
    dashCap: "butt",
  },

  // 2. Luxury VIP: angled diamond notches at perforation and sides, with consistent smooth corners
  luxury: {
    id: "luxury",
    path: "M 20,0 L 444,0 L 460,18 L 476,0 L 580,0 q 20,0 20,20 L 600,104 L 582,120 L 600,136 L 600,220 q 0,20 -20,20 L 476,240 L 460,222 L 444,240 L 20,240 q -20,0 -20,-20 L 0,136 L 18,120 L 0,104 L 0,20 q 0,-20 20,-20 Z",
    dashArray: "8 4 2 4",
    dashCap: "square",
  },

  // 3. Digital / Cyber: 90° stepped orthogonal tech cutouts, with consistent smooth corners
  digital: {
    id: "digital",
    path: "M 20,0 L 444,0 L 444,16 L 476,16 L 476,0 L 580,0 q 20,0 20,20 L 600,104 L 584,104 L 584,136 L 600,136 L 600,220 q 0,20 -20,20 L 476,240 L 476,224 L 444,224 L 444,240 L 20,240 q -20,0 -20,-20 L 0,136 L 16,136 L 16,104 L 0,104 L 0,20 q 0,-20 20,-20 Z",
    dashArray: "3 4",
    dashCap: "square",
  },

  // 4. Wave / Scallop: Soft flowing curves with pill notches
  scallop: {
    id: "scallop",
    path: "M 20,0 L 440,0 a 20,16 0 0,0 40,0 L 580,0 q 20,0 20,20 L 600,96 a 16,24 0 0,0 0,48 L 600,220 q 0,20 -20,20 L 480,240 a 20,16 0 0,0 -40,0 L 20,240 q -20,0 -20,-20 L 0,144 a 16,24 0 0,0 0,-48 L 0,20 q 0,-20 20,-20 Z",
    dashArray: "2 6",
    dashCap: "round",
  },

  // 5. Hex Geometric: Inward hexagonal insets
  geometric: {
    id: "geometric",
    path: "M 20,0 L 442,0 L 452,16 L 468,16 L 478,0 L 580,0 q 20,0 20,20 L 600,102 L 584,112 L 584,128 L 600,138 L 600,220 q 0,20 -20,20 L 478,240 L 468,224 L 452,224 L 442,240 L 20,240 q -20,0 -20,-20 L 0,138 L 16,128 L 16,112 L 0,102 L 0,20 q 0,-20 20,-20 Z",
    dashArray: "8 4",
    dashCap: "butt",
  },
};

// Shape rotation order for custom/unallocated tickets
export const SHAPE_ROTATION = ["classic", "luxury", "digital", "scallop", "geometric"];

// Semantic ticket categories mapped to custom aesthetics
// NOTE: Only genuine event creation restrictions (Men Pass, Women Pass, Invite Only)
// receive a tag badge. General, VIP, Virtual, etc. display their title cleanly without redundant tags.
export const SEMANTIC_THEMES = {
  // VIP / Premium
  vip: {
    id: "vip",
    color: "#7C3AED", // Royal Violet
    borderColorStart: "#A78BFA",
    borderColorEnd: "#7C3AED",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F5F3FF",
    tag: null, // Title already says "VIP" - no redundant tag
    shape: "luxury",
    iconName: null,
  },

  // Virtual / Online stream
  virtual: {
    id: "virtual",
    color: "#0891B2", // Digital Teal / Cyan
    borderColorStart: "#38BDF8",
    borderColorEnd: "#0891B2",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F0FDFA",
    tag: null, // Title already says "Virtual Entry" - no redundant tag
    shape: "digital",
    iconName: null,
  },

  // General / Regular admission
  general: {
    id: "general",
    color: "#059669", // Emerald Mint
    borderColorStart: "#10B981",
    borderColorEnd: "#059669",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F0FDF4",
    tag: null, // Title already says "General" - no redundant tag
    shape: "classic",
    iconName: null,
  },

  // Early Access / Early bird
  early_bird: {
    id: "early_bird",
    color: "#D97706", // Sunburst Amber
    borderColorStart: "#FBBF24",
    borderColorEnd: "#D97706",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FFFBEB",
    tag: null,
    shape: "geometric",
    iconName: null,
  },

  // Couple / Duo
  couple: {
    id: "couple",
    color: "#DB2777", // Vibrant Pink / Magenta
    borderColorStart: "#F472B6",
    borderColorEnd: "#DB2777",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FDF2F8",
    tag: null,
    shape: "scallop",
    iconName: null,
  },

  // Men Pass (actual event creation access restriction)
  male: {
    id: "male",
    color: "#2563EB", // Cobalt Azure
    borderColorStart: "#60A5FA",
    borderColorEnd: "#2563EB",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#EFF6FF",
    tag: "Men Pass",
    tagBg: "rgba(37, 99, 235, 0.1)",
    tagColor: "#1D4ED8",
    shape: "geometric",
    iconName: "User",
  },

  // Women Pass (actual event creation access restriction)
  female: {
    id: "female",
    color: "#E11D48", // Vivid Rose
    borderColorStart: "#FB7185",
    borderColorEnd: "#E11D48",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FFF1F2",
    tag: "Women Pass",
    tagBg: "rgba(225, 29, 72, 0.1)",
    tagColor: "#BE123C",
    shape: "scallop",
    iconName: "Sparkles",
  },

  // Student / Academic
  student: {
    id: "student",
    color: "#4F46E5", // Electric Indigo
    borderColorStart: "#818CF8",
    borderColorEnd: "#4F46E5",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#EEF2FF",
    tag: null,
    shape: "classic",
    iconName: null,
  },

  // Invite only (actual event creation visibility option)
  invite_only: {
    id: "invite_only",
    color: "#6D28D9", // Deep Royal Violet
    borderColorStart: "#A78BFA",
    borderColorEnd: "#6D28D9",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FAF5FF",
    tag: "Invite Only",
    tagBg: "rgba(109, 40, 217, 0.1)",
    tagColor: "#5B21B6",
    shape: "luxury",
    iconName: "Lock",
  },
};

// Curated Pool of Unallocated Vibrant Themes
export const DYNAMIC_PALETTES = [
  {
    id: "sunset_orange",
    color: "#EA580C", // Vibrant Sunset Tangerine
    borderColorStart: "#FB923C",
    borderColorEnd: "#EA580C",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FFF7ED",
    tagBg: "rgba(234, 88, 12, 0.1)",
    tagColor: "#C2410C",
  },
  {
    id: "ocean_teal",
    color: "#0D9488", // Deep Ocean Teal
    borderColorStart: "#2DD4BF",
    borderColorEnd: "#0D9488",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F0FDFA",
    tagBg: "rgba(13, 148, 136, 0.1)",
    tagColor: "#0F766E",
  },
  {
    id: "electric_indigo",
    color: "#4F46E5", // Modern Indigo
    borderColorStart: "#818CF8",
    borderColorEnd: "#4F46E5",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#EEF2FF",
    tagBg: "rgba(79, 70, 229, 0.1)",
    tagColor: "#3730A3",
  },
  {
    id: "vivid_fuchsia",
    color: "#C026D3", // Vivid Fuchsia
    borderColorStart: "#E879F9",
    borderColorEnd: "#C026D3",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FDF4FF",
    tagBg: "rgba(192, 38, 211, 0.1)",
    tagColor: "#A21CAF",
  },
  {
    id: "sky_azure",
    color: "#0284C7", // Sky Azure
    borderColorStart: "#38BDF8",
    borderColorEnd: "#0284C7",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F0F9FF",
    tagBg: "rgba(2, 132, 199, 0.1)",
    tagColor: "#0369A1",
  },
  {
    id: "crimson_ruby",
    color: "#BE123C", // Deep Crimson
    borderColorStart: "#FB7185",
    borderColorEnd: "#BE123C",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#FFF1F2",
    tagBg: "rgba(190, 18, 60, 0.1)",
    tagColor: "#9F1239",
  },
  {
    id: "emerald_forest",
    color: "#059669", // Emerald
    borderColorStart: "#34D399",
    borderColorEnd: "#059669",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F0FDF4",
    tagBg: "rgba(5, 150, 105, 0.1)",
    tagColor: "#047857",
  },
  {
    id: "royal_violet",
    color: "#7C3AED", // Royal Violet
    borderColorStart: "#A78BFA",
    borderColorEnd: "#7C3AED",
    bgColorStart: "#FFFFFF",
    bgColorEnd: "#F5F3FF",
    tagBg: "rgba(124, 58, 237, 0.1)",
    tagColor: "#6D28D9",
  },
];

/**
 * Detects the semantic category of a ticket based on restrictions, visibility, and keywords.
 */
export const detectTicketCategory = (ticket) => {
  const restriction = (ticket?.gender_restriction || "all").toLowerCase().trim();
  const visibility = (ticket?.visibility || "public").toLowerCase().trim();
  const name = (ticket?.name || "").toLowerCase().trim();
  const desc = (ticket?.description || "").toLowerCase().trim();

  // 1. Gender restriction - Male (explicit restriction or unambiguous title)
  if (restriction === "male" || /\b(men|male|stag|gents|boy|boys)\b/i.test(name)) {
    return "male";
  }

  // 2. Gender restriction - Female (explicit restriction or unambiguous title)
  if (restriction === "female" || /\b(women|female|ladies|lady|girl|girls|vixen|vixens)\b/i.test(name)) {
    return "female";
  }

  // 3. Invite Only
  if (visibility === "invite_only" || /\b(invite\s*only|private|exclusive)\b/i.test(name)) {
    return "invite_only";
  }

  // 4. VIP / Premium
  if (
    /\b(vip|v\.i\.p|backstage|all\s*access|executive|platinum|gold|box\s*stand|box)\b/i.test(name) ||
    /\b(vip|box\s*stand|backstage)\b/i.test(desc)
  ) {
    return "vip";
  }

  // 5. Virtual / Streaming
  if (
    /\b(virtual|stream|streamed|online|webinar|digital|zoom)\b/i.test(name) ||
    /\b(virtually\s*streamed|online\s*access|stream)\b/i.test(desc)
  ) {
    return "virtual";
  }

  // 6. Early Bird
  if (/\b(early\s*bird|early\s*access|phase\s*1|presale)\b/i.test(name)) {
    return "early_bird";
  }

  // 7. Couple / Duo
  if (/\b(couple|duo|pair|2\s*tickets|two\s*person)\b/i.test(name)) {
    return "couple";
  }

  // 8. Student
  if (/\b(student|college|campus|academic|youth)\b/i.test(name)) {
    return "student";
  }

  // 9. General / Regular
  if (/\b(general|regular|standard|standard\s*entry|admission)\b/i.test(name)) {
    return "general";
  }

  return null;
};

/**
 * 2-Pass Ticket Theme Resolution
 * Resolves a dictionary of ticket themes keyed by ticket id / name.
 * Guarantees distinct colors and varied shapes across all tickets on screen.
 */
export const resolveEventTicketThemes = (ticketTypes = []) => {
  const allocatedColors = new Set();
  const themeMap = {};

  // Pass 1: Semantic identification
  ticketTypes.forEach((ticket, index) => {
    const key = ticket.id?.toString() || ticket.name || String(index);
    const categoryKey = detectTicketCategory(ticket);

    if (categoryKey && SEMANTIC_THEMES[categoryKey]) {
      const sem = SEMANTIC_THEMES[categoryKey];
      themeMap[key] = {
        ...sem,
        shapeVariant: sem.shape,
        category: categoryKey,
        isSemantic: true,
      };
      allocatedColors.add(sem.color.toLowerCase());
    }
  });

  // Pass 2: Allocate fresh unallocated vibrant colors and varied shapes
  let poolIdx = 0;
  let shapeIdx = 0;

  ticketTypes.forEach((ticket, index) => {
    const key = ticket.id?.toString() || ticket.name || String(index);
    if (!themeMap[key]) {
      // Find an unallocated palette
      let chosenPalette = null;
      for (let i = 0; i < DYNAMIC_PALETTES.length; i++) {
        const candidate = DYNAMIC_PALETTES[(poolIdx + i) % DYNAMIC_PALETTES.length];
        if (!allocatedColors.has(candidate.color.toLowerCase())) {
          chosenPalette = candidate;
          poolIdx = (poolIdx + i + 1) % DYNAMIC_PALETTES.length;
          break;
        }
      }
      if (!chosenPalette) {
        chosenPalette = DYNAMIC_PALETTES[poolIdx % DYNAMIC_PALETTES.length];
        poolIdx = (poolIdx + i + 1) % DYNAMIC_PALETTES.length;
      }

      allocatedColors.add(chosenPalette.color.toLowerCase());

      // Pick next varied shape
      const chosenShape = SHAPE_ROTATION[shapeIdx % SHAPE_ROTATION.length];
      shapeIdx++;

      themeMap[key] = {
        id: chosenPalette.id,
        color: chosenPalette.color,
        borderColorStart: chosenPalette.borderColorStart,
        borderColorEnd: chosenPalette.borderColorEnd,
        bgColorStart: chosenPalette.bgColorStart,
        bgColorEnd: chosenPalette.bgColorEnd,
        tag: null,
        tagBg: chosenPalette.tagBg,
        tagColor: chosenPalette.tagColor,
        shapeVariant: chosenShape,
        iconName: null,
        category: "custom",
        isSemantic: false,
      };
    }
  });

  return themeMap;
};
