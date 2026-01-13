export const COLORS = {
  // Brand
  primaryGradient: ["#90CAF9", "#1976D2"], // Sky Blue -> Darker Blue (Requested)
  primary: "#1976D2", // Blue fallback
  secondary: "#00BFA5", // Teal (Accent/CTA)

  // Backgrounds
  background: "#FAF9F7", // Clean Off-White
  surface: "#FFFFFF", // Card background
  screenBackground: "#FAF9F7", // Align with standard background

  // Typography
  textPrimary: "#1D1D1F", // Nearly black
  textSecondary: "#8E8E93", // Gray
  textInverted: "#FFFFFF", // White text on dark/gradient

  // Functional
  error: "#FF3B30",
  success: "#34C759",
  border: "#E5E5EA",

  // Semantic Pastels for Tags
  // Pairs of [Background, TextColor]
  semantic: [
    { bg: "#E3F2FD", text: "#1565C0" }, // Blue
    { bg: "#E8F5E9", text: "#2E7D32" }, // Green
    { bg: "#FFF3E0", text: "#EF6C00" }, // Orange
    { bg: "#F3E5F5", text: "#7B1FA2" }, // Purple
    { bg: "#FFEBEE", text: "#C62828" }, // Red
    { bg: "#E0F7FA", text: "#00838F" }, // Cyan
    { bg: "#FBE9E7", text: "#D84315" }, // Deep Orange
    { bg: "#FFF8E1", text: "#F9A825" }, // Amber
  ],
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 80,
};

export const BORDER_RADIUS = {
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  pill: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryGlow: {
    shadowColor: "#1976D2", // Blue Glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
};

export const LAYOUT = {
  scrollContainerPaddingHorizontal: 20,
  contentContainerPaddingHorizontal: 25,
  contentContainerMarginTop: 20,
};
