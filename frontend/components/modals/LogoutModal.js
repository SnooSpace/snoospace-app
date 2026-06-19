import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LogOut, UserMinus } from "lucide-react-native";
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
  const defaultAvatar = currentAccount
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
        currentAccount.username || currentAccount.name || "User",
      )}&background=3565F2&color=FFFFFF`
    : "";

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
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            {currentAccount && (
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri:
                      currentAccount.profilePicture ||
                      currentAccount.profile_photo_url ||
                      currentAccount.logo_url ||
                      defaultAvatar,
                  }}
                  style={styles.avatar}
                />
              </View>
            )}
            <Text style={styles.headerTitle}>Log Out</Text>
            <Text style={styles.headerSubtitle}>
              Are you sure you want to log out of SnooSpace?
            </Text>

            {currentAccount && (
              <View style={styles.accountBadge}>
                <Text style={styles.accountBadgeText}>
                  {currentAccount.username ? `@${currentAccount.username}` : (currentAccount.name || 'Account')}
                </Text>
              </View>
            )}
          </View>

          {/* Options Section */}
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
                  <View style={[styles.iconContainer, styles.primaryIconBg]}>
                    <LogOut size={20} color="#3565F2" strokeWidth={2} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>
                      Log out current account
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      {`Log out of ${currentAccount?.username ? `@${currentAccount.username}` : (currentAccount?.name || 'this account')}`}
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
                  <View style={[styles.iconContainer, styles.dangerIconBg]}>
                    <UserMinus size={20} color="#FF3B30" strokeWidth={2} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={[styles.optionTitle, styles.dangerText]}>
                      Log out of all accounts
                    </Text>
                    <Text style={styles.optionSubtitle}>
                      You will need to sign in again for all accounts
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
                <View style={[styles.iconContainer, styles.dangerIconBg]}>
                  <LogOut size={20} color="#FF3B30" strokeWidth={2} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, styles.dangerText]}>
                    Log Out
                  </Text>
                  <Text style={styles.optionSubtitle}>
                    Confirm logging out of this account
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
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  avatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "rgba(53, 101, 242, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Black",
    color: "#1D1D1F",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  accountBadge: {
    backgroundColor: "rgba(53, 101, 242, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
  },
  accountBadgeText: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#3565F2",
  },
  optionsSection: {
    paddingVertical: 8,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryIconBg: {
    backgroundColor: "rgba(53, 101, 242, 0.08)",
  },
  dangerIconBg: {
    backgroundColor: "rgba(255, 59, 48, 0.08)",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#1D1D1F",
    marginBottom: 1,
  },
  optionSubtitle: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
  },
  dangerText: {
    color: "#FF3B30",
  },
  divider: {
    height: 1,
    backgroundColor: "#F2F2F7",
    marginHorizontal: 24,
  },
  cancelButton: {
    backgroundColor: "#F2F2F7",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#1D1D1F",
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
