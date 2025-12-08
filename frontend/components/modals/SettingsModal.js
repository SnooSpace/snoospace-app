import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PropTypes from "prop-types";

/**
 * Reusable settings modal that mirrors the layout/behavior originally
 * implemented inside the member profile screen.
 */
export default function SettingsModal({
  visible,
  onClose,
  onNotificationsPress,
  onPrivacyPress,
  onHelpPress,
  onAddAccountPress,
  onLogoutPress,
  onDeleteAccountPress,
  hapticsEnabled,
  onToggleHaptics,
  textColor = "#1D1D1F",
  lightTextColor = "#8E8E93",
}) {
  const handleAction = (callback) => {
    if (typeof onClose === "function") {
      onClose();
    }
    if (typeof callback === "function") {
      callback();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>
              Settings
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(onNotificationsPress)}
            >
              <Ionicons
                name="notifications-outline"
                size={24}
                color={textColor}
              />
              <Text style={[styles.settingsOptionText, { color: textColor }]}>
                Notifications
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(onPrivacyPress)}
            >
              <Ionicons name="shield-outline" size={24} color={textColor} />
              <Text style={[styles.settingsOptionText, { color: textColor }]}>
                Privacy
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(onHelpPress)}
            >
              <Ionicons
                name="help-circle-outline"
                size={24}
                color={textColor}
              />
              <Text style={[styles.settingsOptionText, { color: textColor }]}>
                Help & Support
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
            </TouchableOpacity>

            {/* Haptics Toggle */}
            <View style={styles.settingsOption}>
              <Ionicons
                name="phone-portrait-outline"
                size={24}
                color={textColor}
              />
              <Text style={[styles.settingsOptionText, { color: textColor }]}>
                Enable App Haptics
              </Text>
              <Switch
                trackColor={{ false: "#767577", true: "#34C759" }} // Use IOS green for true
                thumbColor={Platform.OS === 'android' ? "#f4f3f4" : ""}
                ios_backgroundColor="#3e3e3e"
                onValueChange={onToggleHaptics}
                value={hapticsEnabled}
              />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(onAddAccountPress)}
            >
              <Ionicons name="person-add-outline" size={24} color={textColor} />
              <Text style={[styles.settingsOptionText, { color: textColor }]}>
                Add account
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsOption, styles.logoutOption]}
              onPress={() => handleAction(onLogoutPress)}
            >
              <Ionicons name="log-out-outline" size={24} color="#007AFF" />
              <Text style={[styles.settingsOptionText, styles.logoutText]}>
                Logout
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(onDeleteAccountPress)}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              <Text style={[styles.settingsOptionText, styles.deleteText]}>
                Delete Account
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
            </TouchableOpacity>

            <View style={styles.divider} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  settingsOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    gap: 15,
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
  },
  logoutOption: {
    marginTop: 10,
  },
  logoutText: {
    color: "#007AFF",
  },
  deleteText: {
    color: "#FF3B30",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 10,
  },
});

SettingsModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onNotificationsPress: PropTypes.func,
  onPrivacyPress: PropTypes.func,
  onHelpPress: PropTypes.func,
  onAddAccountPress: PropTypes.func,
  onLogoutPress: PropTypes.func,
  onDeleteAccountPress: PropTypes.func,
  hapticsEnabled: PropTypes.bool,
  onToggleHaptics: PropTypes.func,
  textColor: PropTypes.string,
  lightTextColor: PropTypes.string,
};

