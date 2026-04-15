import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PropTypes from "prop-types";

/**
 * Logout Modal - Shows options for logging out
 * - Single account: Simple logout confirmation
 * - Multiple accounts: Option to logout current or all accounts
 */
export default function LogoutModal({
  visible,
  onClose,
  onLogoutCurrent,
  onLogoutAll,
  currentAccount,
  hasMultipleAccounts,
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
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Account Info */}
          {currentAccount && (
            <View style={styles.accountSection}>
              <Image
                source={{
                  uri:
                    currentAccount.profilePicture ||
                    currentAccount.profile_photo_url ||
                    currentAccount.logo_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      currentAccount.username || currentAccount.name || "User"
                    )}&background=6A0DAD&color=FFFFFF`,
                }}
                style={styles.avatar}
              />
              <Text style={styles.username}>
                @{currentAccount.username || currentAccount.name}
              </Text>
            </View>
          )}

          {/* Logout Options */}
          <View style={styles.optionsSection}>
            {hasMultipleAccounts ? (
              <>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    onClose();
                    onLogoutCurrent();
                  }}
                >
                  <Ionicons name="log-out-outline" size={24} color="#1D1D1F" />
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>
                      Log out{" "}
                      {currentAccount?.username
                        ? `@${currentAccount.username}`
                        : "this account"}
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      Switch to another account
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => {
                    onClose();
                    onLogoutAll();
                  }}
                >
                  <Ionicons name="exit-outline" size={24} color="#FF3B30" />
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, styles.dangerText]}>
                      Log out of all accounts
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      You'll need to log in again
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => {
                  onClose();
                  onLogoutAll();
                }}
              >
                <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, styles.dangerText]}>
                    Log out
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    You'll need to log in again
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  accountSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E5EA",
    marginBottom: 12,
  },
  username: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
  },
  optionsSection: {
    paddingVertical: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    color: "#8E8E93",
  },
  dangerText: {
    color: "#FF3B30",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginHorizontal: 20,
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
});

LogoutModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLogoutCurrent: PropTypes.func,
  onLogoutAll: PropTypes.func.isRequired,
  currentAccount: PropTypes.object,
  hasMultipleAccounts: PropTypes.bool,
};

LogoutModal.defaultProps = {
  hasMultipleAccounts: false,
  onLogoutCurrent: () => {},
  currentAccount: null,
};
