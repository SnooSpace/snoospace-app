import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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

            {/* Debug: Clear Account Data */}
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => handleAction(async () => {
                Alert.alert(
                  'Clear Account Data?',
                  'This will clear all saved accounts and encryption keys. You will need to restart the app. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear & Restart',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          const { emergencyClearAll } = require('../../utils/emergencyClear');
                          await emergencyClearAll();
                          Alert.alert(
                            'Data Cleared',
                            'Please close and restart the app now.',
                            [{
                              text: 'OK',
                              onPress: () => {
                                // Force reload
                                if (typeof window !== 'undefined' && window.location) {
                                  window.location.reload();
                                }
                              }
                            }]
                          );
                        } catch (error) {
                          console.error('Clear error:', error);
                          Alert.alert('Error', 'Failed to clear account data');
                        }
                      }
                    }
                  ]
                );
              })}
            >
              <Ionicons name="trash-bin-outline" size={24} color="#FF9500" />
              <Text style={[styles.settingsOptionText, { color: '#FF9500' }]}>
                Clear Account Data
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={lightTextColor}
              />
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
  textColor: PropTypes.string,
  lightTextColor: PropTypes.string,
};

