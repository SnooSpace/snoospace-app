import { StyleSheet } from "react-native";
import { COLORS } from "../../../../constants/theme";

export const chatHeaderStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  headerInfo: { flexDirection: "row", alignItems: "center" },
  headerName: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 16,
    color: "#1F3A5F",
  },
  headerUsername: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
