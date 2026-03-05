import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";

const { width } = Dimensions.get("window");

/**
 * Custom Action Modal to replace native Alerts
 *
 * @param {boolean} visible - Modal visibility
 * @param {string} title - Modal title
 * @param {string} message - Modal message/description
 * @param {Array} actions - Array of action objects { text, onPress, style: 'default' | 'destructive' | 'cancel' }
 * @param {Function} onClose - Function to call when backdrop is pressed
 */
export default function ActionModal({
  visible,
  title,
  message,
  actions = [],
  onClose,
}) {
  if (!visible) return null;

  const cancelAction = actions?.find((a) => a.style === "cancel");
  const otherActions = actions?.filter((a) => a.style !== "cancel") || [];

  const handleDismiss = () => {
    if (cancelAction && cancelAction.onPress) {
      cancelAction.onPress();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <BlurView
            intensity={25}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.contentContainer}>
                {/* Header with Title and Dismiss Button */}
                <View style={styles.headerContainer}>
                  {(title || message) && (
                    <View style={styles.headerTextContainer}>
                      {title && <Text style={styles.title}>{title}</Text>}
                      {message && <Text style={styles.message}>{message}</Text>}
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.closeCircle}
                    onPress={handleDismiss}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Actions List */}
                <View style={styles.actionsBox}>
                  {otherActions.map((action, index) => {
                    const isDestructive = action.style === "destructive";

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.actionButton,
                          isDestructive && styles.destructiveButton,
                        ]}
                        onPress={() => {
                          action.onPress && action.onPress();
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            isDestructive && styles.destructiveText,
                          ]}
                        >
                          {action.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)", // Darker, premium overlay
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  container: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 28, // Modern large radius
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    overflow: "hidden",
    paddingBottom: 24,
  },
  headerContainer: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 20,
    position: "relative",
  },
  headerTextContainer: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  closeCircle: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "BasicCommercial-Bold", // Bold for section title
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontFamily: "Manrope-Regular", // Regular for helper text
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  actionsBox: {
    paddingHorizontal: 24,
    gap: 12,
  },
  actionButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9", // Soft background for standard actions
  },
  destructiveButton: {
    backgroundColor: "rgba(239, 68, 68, 0.08)", // Soft red for destructive actions
  },
  actionText: {
    fontFamily: "Manrope-SemiBold", // SemiBold for interactive
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  destructiveText: {
    color: COLORS.error,
  },
});
