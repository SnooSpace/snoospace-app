import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import PropTypes from "prop-types";
import { COLORS, FONTS } from "../../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Add Account Modal - Instagram-style
 * Offers option to log into existing account or create new one
 */
export default function AddAccountModal({
  visible,
  onClose,
  onLoginExisting,
  onCreateNew,
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

  function handleLoginExisting() {
    onClose();
    if (onLoginExisting) {
      onLoginExisting();
    }
  }

  function handleCreateNew() {
    onClose();
    if (onCreateNew) {
      onCreateNew();
    }
  }

  if (!shouldRender) return null;

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
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add account</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color="#0F172A" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          {/* Log into existing account button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLoginExisting}
          >
            <Text style={styles.primaryButtonText}>
              Log into existing account
            </Text>
          </TouchableOpacity>

          {/* Create new account button */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCreateNew}
          >
            <Text style={styles.secondaryButtonText}>Create new account</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 30,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E5EA",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    position: "relative",
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.primary,
    color: "#0F172A",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
});

AddAccountModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLoginExisting: PropTypes.func,
  onCreateNew: PropTypes.func,
};
