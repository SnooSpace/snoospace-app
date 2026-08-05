import { StyleSheet, Dimensions } from "react-native";
import { COLORS } from "../../../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const MAX_BUBBLE_WIDTH = Math.round(SCREEN_WIDTH * 0.70);
export const MESSAGE_TEXT_COLOR = "#1F3A5F";
export const LIGHT_TEXT = COLORS.textSecondary;

export const sepStyles = StyleSheet.create({
  row: { alignItems: "center", marginVertical: 12 },
  label: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: LIGHT_TEXT,
    opacity: 0.7,
  },
});

export const quoteStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 2,
    maxWidth: MAX_BUBBLE_WIDTH,
  },
  replyLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#8FA1B8",
    marginBottom: 4,
  },
  myReplyLabel: {
    alignSelf: "flex-end",
    marginRight: 4,
  },
  otherReplyLabel: {
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  container: {
    flexDirection: "row",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: "100%",
  },
  myContainer: {
    backgroundColor: "rgba(230, 240, 255, 0.6)",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherContainer: {
    backgroundColor: "rgba(247, 249, 252, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(229, 229, 234, 0.5)",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  verticalBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  myVerticalBar: {
    backgroundColor: "#A0C4FF",
  },
  otherVerticalBar: {
    backgroundColor: "#C8D3E0",
  },
  content: {
    flexShrink: 1,
    justifyContent: "center",
  },
  text: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  myText: {
    color: "rgba(31, 58, 95, 0.8)",
  },
  otherText: {
    color: "rgba(31, 58, 95, 0.8)",
  },
  deletedText: {
    color: "#A0A0A0",
    fontStyle: "italic",
    fontFamily: "Manrope-Regular",
  },
  postShareRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  postShareLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#3565F2",
  },
});
