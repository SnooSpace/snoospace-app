import { StyleSheet } from "react-native";

export const optionsStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
    justifyContent: "center",
    paddingHorizontal: 28,
    zIndex: 999,
  },
  menu: {
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    width: 160,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "#E6ECF5",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#1F3A5F",
    marginLeft: 12,
  },
});
