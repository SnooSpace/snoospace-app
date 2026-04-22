import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

const CustomAlertModal = ({
  visible,
  title,
  message,
  onClose,
  primaryAction,
  secondaryAction,
  icon: Icon,
  iconColor = "#FF3B30",
  // Optional: mute duration picker
  durationOptions,
  onDurationSelect,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {Platform.OS === "ios" && (
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.alertBox}>
              <View style={styles.content}>
                {Icon && (
                  <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                    <Icon size={28} color={iconColor} strokeWidth={2.5} />
                  </View>
                )}
                
                {title && <Text style={styles.title}>{title}</Text>}
                {message && <Text style={styles.message}>{message}</Text>}
              </View>

              <View style={styles.buttonContainer}>
                {/* Duration options (mute picker) - Instagram Style */}
                {durationOptions && onDurationSelect && (
                  <View style={styles.durationList}>
                    {durationOptions.map((dur, idx) => (
                      <View key={idx} style={{ width: "100%" }}>
                        {idx === 0 && <View style={styles.listSeparator} />}
                        <TouchableOpacity
                          style={styles.durationBtn}
                          onPress={() => onDurationSelect(dur)}
                          activeOpacity={0.5}
                        >
                          <Text style={styles.durationBtnText}>{dur.label}</Text>
                        </TouchableOpacity>
                        <View style={styles.listSeparator} />
                      </View>
                    ))}
                  </View>
                )}

                {/* Standard Cancel + Confirm row */}
                {!durationOptions && (
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {secondaryAction && (
                      <TouchableOpacity
                        style={[styles.button, styles.secondaryButton]}
                        onPress={() => {
                          secondaryAction.onPress?.();
                          onClose();
                        }}
                        activeOpacity={0.6}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {secondaryAction.text}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {primaryAction && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          styles.primaryButton,
                          primaryAction.style === "destructive" && styles.destructiveButton,
                        ]}
                        onPress={() => {
                          primaryAction.onPress?.();
                          onClose();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.primaryButtonText,
                            primaryAction.style === "destructive" && styles.destructiveButtonText,
                          ]}
                        >
                          {primaryAction.text}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Cancel button for duration picker */}
                {durationOptions && secondaryAction && (
                  <TouchableOpacity
                    style={[styles.cancelBtn]}
                    onPress={() => {
                      secondaryAction.onPress?.();
                      onClose();
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.cancelBtnText}>{secondaryAction.text}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Platform.OS === "ios" ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertBox: {
    width: width - 64,
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    overflow: "hidden",
    ...SHADOWS.large,
  },
  content: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  buttonContainer: {
    paddingBottom: 12,
  },
  durationList: {
    width: "100%",
  },
  durationBtn: {
    width: "100%",
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  durationBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#2962FF", // Brand Blue for options
  },
  listSeparator: {
    height: 1,
    backgroundColor: "#F3F4F6",
    width: "100%",
  },
  cancelBtn: {
    width: "100%",
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  cancelBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#4B5563",
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  secondaryButton: {
    backgroundColor: "#F3F4F6",
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 15,
    color: "#4B5563",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  destructiveButton: {
    backgroundColor: "#FEF2F2",
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 15,
    color: "#FFFFFF",
  },
  destructiveButtonText: {
    color: "#DC2626",
  },
});

export default CustomAlertModal;
