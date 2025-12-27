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
import { COLORS, SHADOWS } from "../../constants/theme";

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
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <View style={styles.contentContainer}>
                <View style={styles.textContainer}>
                  {title && <Text style={styles.title}>{title}</Text>}
                  {message && <Text style={styles.message}>{message}</Text>}
                </View>

                {sortedActions.map((action, index) => {
                  const isCancel = action.style === "cancel";
                  const isDestructive = action.style === "destructive";

                  // Add separator if not the first item (text container is first)
                  const showSeparator = true;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.actionButton,
                        { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
                        isCancel && styles.cancelButton,
                      ]}
                      onPress={() => {
                        action.onPress && action.onPress();
                      }}
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  container: {
    width: "100%",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    ...SHADOWS.md,
    overflow: "hidden",
  },
  textContainer: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
  },
  actionButton: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelButton: {
    backgroundColor: "#1D1D1F",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  destructiveText: {
    color: "#FF3B30",
  },
  cancelText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
