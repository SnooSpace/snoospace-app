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
  // 1. Classic cinema stub: authentic semicircular perforation notches with scooped corners & serrated deckled edge
  classic: {
    id: "classic",
    path: "M 26,0 L 442,0 a 18,18 0 0,0 36,0 L 585,0 q 15,0 15,20 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 q 0,20 -15,20 L 478,240 a 18,18 0 0,0 -36,0 L 26,240 a 26,26 0 0,0 -26,-26 L 0,26 a 26,26 0 0,0 26,-26 Z",
    dashArray: "6 6",
    dashCap: "round",
  },

  // 2. Luxury VIP: diamond perforation notches with scooped corners & serrated deckled edge
  luxury: {
    id: "luxury",
    path: "M 26,0 L 444,0 L 460,18 L 476,0 L 585,0 q 15,0 15,20 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 q 0,20 -15,20 L 476,240 L 460,222 L 444,240 L 26,240 a 26,26 0 0,0 -26,-26 L 0,26 a 26,26 0 0,0 26,-26 Z",
    dashArray: "8 4",
    dashCap: "round",
  },

  // 3. Digital: 90° stepped orthogonal notches with scooped corners & serrated deckled edge
  digital: {
    id: "digital",
    path: "M 26,0 L 444,0 L 444,16 L 476,16 L 476,0 L 585,0 q 15,0 15,20 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 q 0,20 -15,20 L 476,240 L 476,224 L 444,224 L 444,240 L 26,240 a 26,26 0 0,0 -26,-26 L 0,26 a 26,26 0 0,0 26,-26 Z",
    dashArray: "4 4",
    dashCap: "square",
  },

  // 4. Wave / Scallop: Soft pill notches with scooped corners & serrated deckled edge
  scallop: {
    id: "scallop",
    path: "M 26,0 L 440,0 a 20,16 0 0,0 40,0 L 585,0 q 15,0 15,20 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 q 0,20 -15,20 L 480,240 a 20,16 0 0,0 -40,0 L 26,240 a 26,26 0 0,0 -26,-26 L 0,26 a 26,26 0 0,0 26,-26 Z",
    dashArray: "3 5",
    dashCap: "round",
  },

  // 5. Geometric: Hexagonal insets with scooped corners & serrated deckled edge
  geometric: {
    id: "geometric",
    path: "M 26,0 L 442,0 L 452,16 L 468,16 L 478,0 L 585,0 q 15,0 15,20 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 a 5,12.5 0 0,0 0,25 q 0,20 -15,20 L 478,240 L 468,224 L 452,224 L 442,240 L 26,240 a 26,26 0 0,0 -26,-26 L 0,26 a 26,26 0 0,0 26,-26 Z",
    dashArray: "8 4",
    dashCap: "round",
  },
};

// Shape rotation order for custom/unallocated tickets
export const SHAPE_ROTATION = ["classic", "luxury", "digital", "scallop", "geometric"];

// Semantic ticket categories mapped to custom solid retro duotone aesthetics
export const SEMANTIC_THEMES = {
  // VIP / Premium (Electric Cobalt Theme - matches Reference Ticket 2)
  vip: {
    id: "vip",
    color: "#2563EB",
    bgColor: "#2563EB",
    textColor: "#FFFFFF",
    mutedTextColor: "#BFDBFE",
    accentColor: "#93C5FD",
    stubBgColor: "#1D4ED8",
    barcodeColor: "#FFFFFF",
    borderColor: "#1E40AF",
    borderColorStart: "#1E40AF",
    borderColorEnd: "#2563EB",
    bgColorStart: "#2563EB",
    bgColorEnd: "#1D4ED8",
    tag: null,
    shape: "classic",
    iconName: "Crown",
  },

  // Virtual / Online stream (Pastel Mint / Cyan - matches Reference Ticket 1)
  virtual: {
    id: "virtual",
    color: "#0891B2",
    bgColor: "#D5F0EE",
    textColor: "#1E3A8A",
    mutedTextColor: "#2563EB",
    accentColor: "#1D4ED8",
    stubBgColor: "#C5EBE9",
    barcodeColor: "#1E3A8A",
    borderColor: "#AEE2E0",
    borderColorStart: "#AEE2E0",
    borderColorEnd: "#0891B2",
    bgColorStart: "#D5F0EE",
    bgColorEnd: "#C5EBE9",
    tag: null,
    shape: "classic",
    iconName: "Video",
  },

  // General / Regular admission (Soft Sage Mint)
  general: {
    id: "general",
    color: "#059669",
    bgColor: "#D1FAE5",
    textColor: "#064E3B",
    mutedTextColor: "#047857",
    accentColor: "#059669",
    stubBgColor: "#C2F5DC",
    barcodeColor: "#064E3B",
    borderColor: "#A7F3D0",
    borderColorStart: "#A7F3D0",
    borderColorEnd: "#059669",
    bgColorStart: "#D1FAE5",
    bgColorEnd: "#C2F5DC",
    tag: null,
    shape: "classic",
    iconName: "Ticket",
  },

  // Early Access / Early bird (Sunset Peach / Warm Terracotta)
  early_bird: {
    id: "early_bird",
    color: "#EA580C",
    bgColor: "#FED7AA",
    textColor: "#7C2D12",
    mutedTextColor: "#9A3412",
    accentColor: "#C2410C",
    stubBgColor: "#FDCBA0",
    barcodeColor: "#7C2D12",
    borderColor: "#FDBA74",
    borderColorStart: "#FDBA74",
    borderColorEnd: "#EA580C",
    bgColorStart: "#FED7AA",
    bgColorEnd: "#FDCBA0",
    tag: null,
    shape: "classic",
    iconName: "Zap",
  },

  // Couple / Duo (Soft Pastel Rose)
  couple: {
    id: "couple",
    color: "#E11D48",
    bgColor: "#FFE4E6",
    textColor: "#881337",
    mutedTextColor: "#BE123C",
    accentColor: "#E11D48",
    stubBgColor: "#FED2D6",
    barcodeColor: "#881337",
    borderColor: "#FDA4AF",
    borderColorStart: "#FDA4AF",
    borderColorEnd: "#E11D48",
    bgColorStart: "#FFE4E6",
    bgColorEnd: "#FED2D6",
    tag: null,
    shape: "classic",
    iconName: "Users",
  },

  // Men Pass
  male: {
    id: "male",
    color: "#2563EB",
    bgColor: "#DBEAFE",
    textColor: "#1E3A8A",
    mutedTextColor: "#1D4ED8",
    accentColor: "#2563EB",
    stubBgColor: "#BFDBFE",
    barcodeColor: "#1E3A8A",
    borderColor: "#93C5FD",
    borderColorStart: "#93C5FD",
    borderColorEnd: "#2563EB",
    bgColorStart: "#DBEAFE",
    bgColorEnd: "#BFDBFE",
    tag: "Men Pass",
    shape: "classic",
    iconName: "User",
  },

  // Women Pass
  female: {
    id: "female",
    color: "#E11D48",
    bgColor: "#FCE7F3",
    textColor: "#831843",
    mutedTextColor: "#9D174D",
    accentColor: "#DB2777",
    stubBgColor: "#FBCFE8",
    barcodeColor: "#831843",
    borderColor: "#F472B6",
    borderColorStart: "#F472B6",
    borderColorEnd: "#E11D48",
    bgColorStart: "#FCE7F3",
    bgColorEnd: "#FBCFE8",
    tag: "Women Pass",
    shape: "classic",
    iconName: "Sparkles",
  },

  // Student / Academic (Soft Pastel Lilac)
  student: {
    id: "student",
    color: "#7C3AED",
    bgColor: "#EDE9FE",
    textColor: "#4C1D95",
    mutedTextColor: "#6D28D9",
    accentColor: "#7C3AED",
    stubBgColor: "#E4DCFD",
    barcodeColor: "#4C1D95",
    borderColor: "#DDD6FE",
    borderColorStart: "#DDD6FE",
    borderColorEnd: "#7C3AED",
    bgColorStart: "#EDE9FE",
    bgColorEnd: "#E4DCFD",
    tag: null,
    shape: "classic",
    iconName: "Ticket",
  },

  // Invite only (Midnight Indigo)
  invite_only: {
    id: "invite_only",
    color: "#4338CA",
    bgColor: "#E0E7FF",
    textColor: "#1E1B4B",
    mutedTextColor: "#3730A3",
    accentColor: "#4338CA",
    stubBgColor: "#C7D2FE",
    barcodeColor: "#1E1B4B",
    borderColor: "#A5B4FC",
    borderColorStart: "#A5B4FC",
    borderColorEnd: "#4338CA",
    bgColorStart: "#E0E7FF",
    bgColorEnd: "#C7D2FE",
    tag: "Invite Only",
    shape: "classic",
    iconName: "Lock",
  },
};

// Curated Pool of Unallocated Solid Retro Themes
export const DYNAMIC_PALETTES = [
  {
    id: "cyan_mint",
    color: "#0891B2",
    bgColor: "#D5F0EE",
    textColor: "#1E3A8A",
    mutedTextColor: "#2563EB",
    accentColor: "#1D4ED8",
    stubBgColor: "#C5EBE9",
    barcodeColor: "#1E3A8A",
    borderColor: "#AEE2E0",
    borderColorStart: "#AEE2E0",
    borderColorEnd: "#0891B2",
    bgColorStart: "#D5F0EE",
    bgColorEnd: "#C5EBE9",
  },
  {
    id: "electric_cobalt",
    color: "#2563EB",
    bgColor: "#2563EB",
    textColor: "#FFFFFF",
    mutedTextColor: "#BFDBFE",
    accentColor: "#93C5FD",
    stubBgColor: "#1D4ED8",
    barcodeColor: "#FFFFFF",
    borderColor: "#1E40AF",
    borderColorStart: "#1E40AF",
    borderColorEnd: "#2563EB",
    bgColorStart: "#2563EB",
    bgColorEnd: "#1D4ED8",
  },
  {
    id: "sunset_peach",
    color: "#EA580C",
    bgColor: "#FED7AA",
    textColor: "#7C2D12",
    mutedTextColor: "#9A3412",
    accentColor: "#C2410C",
    stubBgColor: "#FDCBA0",
    barcodeColor: "#7C2D12",
    borderColor: "#FDBA74",
    borderColorStart: "#FDBA74",
    borderColorEnd: "#EA580C",
    bgColorStart: "#FED7AA",
    bgColorEnd: "#FDCBA0",
  },
  {
    id: "royal_lilac",
    color: "#7C3AED",
    bgColor: "#EDE9FE",
    textColor: "#4C1D95",
    mutedTextColor: "#6D28D9",
    accentColor: "#7C3AED",
    stubBgColor: "#E4DCFD",
    barcodeColor: "#4C1D95",
    borderColor: "#DDD6FE",
    borderColorStart: "#DDD6FE",
    borderColorEnd: "#7C3AED",
    bgColorStart: "#EDE9FE",
    bgColorEnd: "#E4DCFD",
  },
  {
    id: "emerald_sage",
    color: "#059669",
    bgColor: "#D1FAE5",
    textColor: "#064E3B",
    mutedTextColor: "#047857",
    accentColor: "#059669",
    stubBgColor: "#C2F5DC",
    barcodeColor: "#064E3B",
    borderColor: "#A7F3D0",
    borderColorStart: "#A7F3D0",
    borderColorEnd: "#059669",
    bgColorStart: "#D1FAE5",
    bgColorEnd: "#C2F5DC",
  },
  {
    id: "sunburst_gold",
    color: "#D97706",
    bgColor: "#FEF08A",
    textColor: "#713F12",
    mutedTextColor: "#854D0E",
    accentColor: "#B45309",
    stubBgColor: "#FDE972",
    barcodeColor: "#713F12",
    borderColor: "#FDE047",
    borderColorStart: "#FDE047",
    borderColorEnd: "#D97706",
    bgColorStart: "#FEF08A",
    bgColorEnd: "#FDE972",
  },
  {
    id: "ruby_rose",
    color: "#E11D48",
    bgColor: "#FFE4E6",
    textColor: "#881337",
    mutedTextColor: "#BE123C",
    accentColor: "#E11D48",
    stubBgColor: "#FED2D6",
    barcodeColor: "#881337",
    borderColor: "#FDA4AF",
    borderColorStart: "#FDA4AF",
    borderColorEnd: "#E11D48",
    bgColorStart: "#FFE4E6",
    bgColorEnd: "#FED2D6",
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
        poolIdx = (poolIdx + 1) % DYNAMIC_PALETTES.length;
      }

      allocatedColors.add(chosenPalette.color.toLowerCase());

      // Pick next varied shape
      const chosenShape = SHAPE_ROTATION[shapeIdx % SHAPE_ROTATION.length];
      shapeIdx++;

      themeMap[key] = {
        ...chosenPalette,
        tag: null,
        shapeVariant: chosenShape,
        iconName: chosenPalette.iconName || "Ticket",
        category: "custom",
        isSemantic: false,
      };
    }
  });

  return themeMap;
};
