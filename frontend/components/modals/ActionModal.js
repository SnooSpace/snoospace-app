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

  // Sort actions to put cancel at the bottom
  const sortedActions = [...(actions || [])].sort((a, b) => {
    if (a.style === "cancel") return 1;
    if (b.style === "cancel") return -1;
    return 0;
  });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView
            intensity={25}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.contentContainer}>
                {(title || message) && (
                  <View style={styles.textContainer}>
                    {title && <Text style={styles.title}>{title}</Text>}
                    {message && <Text style={styles.message}>{message}</Text>}
                  </View>
                )}

                {sortedActions.map((action, index) => {
                  const isCancel = action.style === "cancel";
                  const isDestructive = action.style === "destructive";

                  // Add separator if it's not the first element, or if there's a header before it
                  const needsTopBorder = index > 0 || title || message;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.actionButton,
                        needsTopBorder && {
                          borderTopWidth: 1,
                          borderTopColor: "rgba(0,0,0,0.06)",
                        },
                        isCancel && styles.cancelButton,
                      ]}
                      onPress={() => {
                        action.onPress && action.onPress();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          isDestructive && styles.destructiveText,
                          isCancel && styles.cancelText,
                        ]}
                      >
                        {action.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Darker, premium overlay
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  container: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 24, // Modern large radius
    ...SHADOWS.large,
    overflow: "hidden",
  },
  textContainer: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  actionButton: {
    width: "100%",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  cancelButton: {
    backgroundColor: COLORS.textPrimary, // Almost black
    borderTopWidth: 0,
  },
  actionText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for interactive
    fontSize: 16,
    color: COLORS.primary,
  },
  destructiveText: {
    color: COLORS.error,
  },
  cancelText: {
    color: COLORS.surface,
  },
});
