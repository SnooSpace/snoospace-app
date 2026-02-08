export const COLORS = {
  // Brand
  primaryGradient: ["#448AFF", "#2962FF"], // Updated Brand Gradient
  primary: "#2962FF", // Brand Blue
  secondary: "#00BFA5", // Teal (Accent/CTA)

  // Backgrounds
  background: "#faf9f7", // Soft Off-White
  surface: "#FFFFFF", // Card background
  screenBackground: "#F9FAFB", // Light Gray for screen backgrounds

  // Typography
  textPrimary: "#111827", // Almost Black
  textSecondary: "#6B7280", // Cool Gray
  textMuted: "#9CA3AF", // Lighter Gray
  textInverted: "#FFFFFF", // White text on dark/gradient

  // Editorial Feed Colors
  editorial: {
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    background: "#FFFFFF",
    feedBackground: "#FAFAFA",
    border: "#E5E7EB",
    accent: "#2962FF", // Match Primary
    mediaPlaceholder: "#E5E7EB",
  },

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

  // Status Bar Gradients
  // Premium gradients for creating contrast with white status bar icons
  statusBarGradients: {
    primary: ["rgba(25, 118, 210, 0.15)", "rgba(25, 118, 210, 0)"],
    secondary: ["rgba(66, 133, 244, 0.12)", "rgba(66, 133, 244, 0)"],
    neutral: ["rgba(0, 0, 0, 0.05)", "rgba(0, 0, 0, 0)"],
  },
};

export const FONTS = {
  primary: "BasicCommercial-Bold",
  black: "BasicCommercial-Black",
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semiBold: "Manrope-SemiBold",
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
  large: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGlow: {
    shadowColor: "#1976D2", // Blue Glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
};

// Editorial Feed Typography Tokens
export const EDITORIAL_TYPOGRAPHY = {
  displayName: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: COLORS.editorial.textPrimary,
    marginBottom: 2, // Slight adjustment for optical alignment
  },
  username: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.editorial.textSecondary,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.editorial.textSecondary,
  },
  postText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22, // ~1.46 line-height
    color: COLORS.editorial.textPrimary,
  },
  engagementCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.editorial.textMuted,
  },
  followButton: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
};

// Editorial Feed Spacing Tokens
export const EDITORIAL_SPACING = {
  cardPadding: 16,
  sectionGap: 12,
  mediaGap: 14,
  engagementGroupGap: 24,
  iconCountGap: 4,
  profileImageSize: 44,
  iconSize: 23,
  mediaCornerRadius: 12,
};

export const LAYOUT = {
  scrollContainerPaddingHorizontal: 20,
  contentContainerPaddingHorizontal: 25,
  contentContainerMarginTop: 20,
};
