import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { UserMinus } from "lucide-react-native";
import PropTypes from "prop-types";
import { COLORS, SPACING, BORDER_RADIUS, FONTS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function RemoveAccountModal({
  visible,
  onClose,
  onConfirm,
  username,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={25}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(26, 24, 38, 0.6)" },
            ]}
          />
        )}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContainer}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Icon Container */}
          <View style={styles.iconContainer}>
            <UserMinus size={24} color={COLORS.error} strokeWidth={2} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Remove Account</Text>

          {/* Description */}
          <Text style={styles.description}>
            Remove @{username} from your accounts? You will need to log in again to access this account.
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            {/* Remove Button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                onClose();
                onConfirm();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

RemoveAccountModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  username: PropTypes.string.isRequired,
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l, // 24
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.xl, // 20
    padding: 24,
    width: width - 48,
    maxWidth: 340,
    alignItems: "center",
    ...SHADOWS.large,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(229, 62, 62, 0.08)", // Light red tint
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.primary, // BasicCommercial-Bold (Structural Rule for major card titles)
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    fontFamily: FONTS.regular, // Manrope-Regular (Body Text Rule)
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold (Functional UI Rule for buttons)
    color: COLORS.textSecondary,
  },
  removeButton: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: COLORS.error, // SOP error color (#E53E3E)
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold (Functional UI Rule for buttons)
    color: "#FFFFFF",
  },
});
