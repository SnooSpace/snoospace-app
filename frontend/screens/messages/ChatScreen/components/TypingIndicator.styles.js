import { StyleSheet } from "react-native";
import { COLORS } from "../../../../constants/theme";

export const typingStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "transparent",
  },
  text: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  boldText: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
    height: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textSecondary,
    marginHorizontal: 1.5,
  },
});
