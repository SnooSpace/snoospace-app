import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { FONTS } from "../../constants/theme";

const CustomAlertModal = ({
  visible,
  title,
  message,
  onClose,
  primaryAction,
  secondaryAction,
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
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              <View style={styles.content}>
                {title && <Text style={styles.title}>{title}</Text>}
                {message && <Text style={styles.message}>{message}</Text>}
              </View>

              <View style={styles.buttonContainer}>
                {secondaryAction && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => {
                      secondaryAction.onPress();
                      onClose();
                    }}
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
                      primaryAction.style === "destructive" &&
                        styles.destructiveButton,
                    ]}
                    onPress={() => {
                      primaryAction.onPress();
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        primaryAction.style === "destructive" &&
                          styles.destructiveButtonText,
                      ]}
                    >
                      {primaryAction.text}
                    </Text>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertBox: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
  },
  content: {
    padding: 24,
    paddingBottom: 20,
  },
  title: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButton: {
    borderRightWidth: 1,
    borderRightColor: "#F1F5F9",
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#64748B",
  },
  primaryButton: {
    backgroundColor: "#FFFFFF",
  },
  destructiveButton: {
    backgroundColor: "#FEF2F2",
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#0F172A",
  },
  destructiveButtonText: {
    color: "#DC2626",
  },
});

export default CustomAlertModal;
