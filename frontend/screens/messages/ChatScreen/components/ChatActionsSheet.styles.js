import { StyleSheet } from "react-native";

export const actionSheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 20,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: "Manrope-SemiBold", fontSize: 16, color: "#1F3A5F" },
  rowSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#8FA1B8",
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
});

export const REPORT_REASONS = [
  { key: "harassment", label: "Harassment or bullying" },
  { key: "spam", label: "Spam or unwanted content" },
  { key: "hate_speech", label: "Hate speech or discrimination" },
  { key: "threats", label: "Threats or violence" },
  { key: "inappropriate_content", label: "Inappropriate content" },
  { key: "other", label: "Other" },
];
