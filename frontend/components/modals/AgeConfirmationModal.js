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
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";

const { width, height } = Dimensions.get("window");

const GradientText = ({ colors, children, style }) => {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: "transparent" }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
};

export default function AgeConfirmationModal({
  visible,
  age,
  birthDate, // Formatted birth date string
  onConfirm,
  onEdit,
}) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onEdit}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay} pointerEvents="auto">
        {/* Blur effect covering the whole screen */}
        <BlurView
          intensity={Platform.OS === "ios" ? 60 : 90}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.modalContainer}>
          <View style={styles.content}>
            <Text style={styles.title}>
              You{"'"}re {age}
            </Text>
            <Text style={styles.subtitle}>Born {birthDate}</Text>

            <Text style={styles.description}>
              Confirm your age is correct. Let{"'"}s keep our community
              authentic.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onEdit}
              activeOpacity={0.7}
            >
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>

            <View style={styles.verticalDivider} />

            <TouchableOpacity
              style={styles.actionButton}
              onPress={onConfirm}
              activeOpacity={0.7}
            >
              <GradientText
                colors={COLORS.primaryGradient || ["#00B4DB", "#0083B0"]}
                style={styles.confirmText}
              >
                Confirm
              </GradientText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: width - 60,
    maxWidth: 340,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    padding: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 20,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: "#efefef",
    width: "100%",
  },
  actions: {
    flexDirection: "row",
    height: 60,
  },
  actionButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  verticalDivider: {
    width: 1,
    backgroundColor: "#efefef",
    height: "100%",
  },
  editText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
