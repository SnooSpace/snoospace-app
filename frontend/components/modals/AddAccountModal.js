import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { X } from "lucide-react-native";
import PropTypes from "prop-types";

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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add account</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#1D1D1F" />
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
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
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
    fontFamily: "BasicCommercialBold",
    color: "#1D1D1F",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    right: 0,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: "#0095F6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: "#0095F6",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

AddAccountModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLoginExisting: PropTypes.func,
  onCreateNew: PropTypes.func,
};
