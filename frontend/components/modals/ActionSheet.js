import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Lucide from "lucide-react-native";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Modern ActionSheet component that slides up from the bottom.
 *
 * @param {boolean} visible - Whether the sheet is visible
 * @param {Function} onClose - Function to call on dismiss
 * @param {string} title - Optional title
 * @param {string} message - Optional message/subtitle
 * @param {Array} actions - Array of { text, onPress, style, icon }
 */
export default function ActionSheet({
  visible,
  onClose,
  title,
  message,
  actions = [],
}) {
  const [shouldRender, setShouldRender] = React.useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          stiffness: 200,
          damping: 25,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Exit
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  if (!shouldRender) return null;

  // Helper to dynamically render Lucide icons and resolve Ionicons names
  const renderIcon = (iconName, color) => {
    if (!iconName) return null;

    let componentName = iconName;
    if (iconName === "image-outline" || iconName === "image") {
      componentName = "Image";
    } else if (iconName === "trash-outline" || iconName === "trash") {
      componentName = "Trash2";
    } else if (iconName === "chevron-forward") {
      componentName = "ChevronRight";
    } else {
      // Convert kebab-case to PascalCase (e.g., eye-off -> EyeOff)
      componentName = iconName
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    }

    const IconComponent = Lucide[componentName];
    if (!IconComponent) {
      return <Lucide.AlertCircle size={20} color={color} strokeWidth={2} />;
    }

    return <IconComponent size={20} color={color} strokeWidth={2} />;
  };

  return (
    <Modal
      transparent
      visible={shouldRender}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
            <BlurView
              intensity={20}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.indicator} />

          {(title || message) && (
            <View style={styles.header}>
              {title && <Text style={styles.title}>{title}</Text>}
              {message && <Text style={styles.message}>{message}</Text>}
            </View>
          )}

          <View style={styles.optionsArea}>
            {actions.map((action, index) => {
              const isDestructive = action.style === "destructive";
              const isCancel = action.style === "cancel";

              if (isCancel) return null;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.optionButton}
                  onPress={() => {
                    action.onPress && action.onPress();
                    onClose();
                  }}
                >
                  <View style={styles.optionContent}>
                    {action.icon && renderIcon(action.icon, isDestructive ? COLORS.error : "#1D1D1F")}
                    <Text
                      style={[
                        styles.optionText,
                        isDestructive && styles.destructiveText,
                      ]}
                    >
                      {action.text}
                    </Text>
                  </View>
                  <Lucide.ChevronRight size={18} color="#C7C7CC" strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    ...SHADOWS.large,
  },
  indicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#0F172A",
    marginBottom: 4,
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  optionsArea: {
    paddingVertical: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#0F172A",
  },
  destructiveText: {
    color: COLORS.error,
    fontFamily: FONTS.semiBold,
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#0F172A",
  },
});
