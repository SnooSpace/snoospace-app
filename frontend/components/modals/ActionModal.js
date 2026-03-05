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
                    <X size={23} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Actions List */}
                <View style={styles.actionsBox}>
                  {otherActions.map((action, index) => {
                    const styleType = action.style || "secondary"; // default to secondary

                    let buttonStyle = styles.secondaryButton;
                    let textStyle = styles.secondaryText;
                    let iconColor = "#1D1D1F";

                    if (styleType === "primary") {
                      buttonStyle = styles.primaryButton;
                      textStyle = styles.primaryText;
                      iconColor = "#FFFFFF";
                    } else if (styleType === "warning") {
                      buttonStyle = styles.warningButton;
                      textStyle = styles.warningText;
                      iconColor = "#FF9F0A";
                    } else if (styleType === "destructive") {
                      buttonStyle = styles.destructiveButton;
                      textStyle = styles.destructiveText;
                      iconColor = "#FF3B30";
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.actionButton, buttonStyle]}
                        onPress={() => {
                          action.onPress && action.onPress();
                        }}
                        activeOpacity={0.8}
                      >
                        {action.icon && (
                          <View style={styles.actionIcon}>
                            {React.cloneElement(action.icon, {
                              size: 20,
                              color: iconColor,
                            })}
                          </View>
                        )}
                        <Text style={[styles.actionText, textStyle]}>
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
    top: 24,
    right: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 8, // Increase touch target size without background
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  actionIcon: {
    marginRight: 10,
  },
  actionText: {
    fontFamily: "Manrope-SemiBold", // SemiBold for interactive
    fontSize: 16,
  },
  // Button Tier Styles
  primaryButton: {
    backgroundColor: "#1D1D1F",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "#F2F2F7",
  },
  secondaryText: {
    color: "#1D1D1F",
  },
  warningButton: {
    backgroundColor: "#FFF6E5",
  },
  warningText: {
    color: "#FF9F0A",
  },
  destructiveButton: {
    backgroundColor: "#FFEAEA",
  },
  destructiveText: {
    color: "#FF3B30",
  },
});
