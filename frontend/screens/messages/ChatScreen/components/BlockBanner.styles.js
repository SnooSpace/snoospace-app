import { StyleSheet } from "react-native";

export const blockBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF1F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE4E6",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  text: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#BE123C",
    flexShrink: 1,
  },
  btn: {
    backgroundColor: "#E11D48",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 12,
  },
  btnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
