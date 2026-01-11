/**
 * Account Picker Modal
 * Shown when OTP verification returns multiple accounts for the same email
 * User can select one, multiple, or all accounts to log into
 */
import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import PropTypes from "prop-types";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

// Type badges and colors
const TYPE_CONFIG = {
  member: { label: "Member", color: "#5f27cd", icon: "person" },
  community: { label: "Community", color: "#00d2d3", icon: "people" },
  sponsor: { label: "Sponsor", color: "#ff9f43", icon: "business" },
  venue: { label: "Venue", color: "#10ac84", icon: "location" },
};

// Generate gradient colors from name (same logic as AvatarGenerator)
function getGradientForName(name) {
  const gradients = [
    ["#667eea", "#764ba2"],
    ["#f093fb", "#f5576c"],
    ["#4facfe", "#00f2fe"],
    ["#43e97b", "#38f9d7"],
    ["#fa709a", "#fee140"],
    ["#a8edea", "#fed6e3"],
    ["#5ee7df", "#b490ca"],
    ["#d299c2", "#fef9d7"],
  ];

  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || "?";
}

export default function AccountPickerModal({
  visible,
  onClose,
  accounts,
  onSelectAccount,
  onSelectMultiple, // New prop for multi-select
  loading,
  email,
}) {
  const [selectedAccounts, setSelectedAccounts] = useState([]);

  // Reset selection when modal opens or accounts change
  useEffect(() => {
    if (visible) {
      setSelectedAccounts([]);
    }
  }, [visible, accounts]);

  const toggleAccountSelection = (account) => {
    const accountKey = `${account.type}_${account.id}`;
    setSelectedAccounts((prev) => {
      if (prev.some((a) => `${a.type}_${a.id}` === accountKey)) {
        return prev.filter((a) => `${a.type}_${a.id}` !== accountKey);
      }
      return [...prev, account];
    });
  };

  const isSelected = (account) => {
    return selectedAccounts.some(
      (a) => `${a.type}_${a.id}` === `${account.type}_${account.id}`
    );
  };

  const selectAll = () => {
    setSelectedAccounts([...accounts]);
  };

  const handleLogin = () => {
    if (selectedAccounts.length === 1) {
      onSelectAccount(selectedAccounts[0]);
    } else if (selectedAccounts.length > 1 && onSelectMultiple) {
      onSelectMultiple(selectedAccounts);
    }
  };

  const renderAccountItem = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.member;
    const gradient = getGradientForName(item.name || item.username);
    const selected = isSelected(item);

    return (
      <TouchableOpacity
        style={[styles.accountItem, selected && styles.accountItemSelected]}
        onPress={() => toggleAccountSelection(item)}
        disabled={loading}
      >
        {/* Selection checkbox */}
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>

        {/* Avatar */}
        <LinearGradient
          colors={gradient}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>
            {getInitials(item.name || item.username)}
          </Text>
        </LinearGradient>

        {/* Account info */}
        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {item.name || item.username}
          </Text>
          <Text style={styles.accountUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>

        {/* Type badge */}
        <View
          style={[styles.typeBadge, { backgroundColor: config.color + "20" }]}
        >
          <Ionicons name={config.icon} size={12} color={config.color} />
          <Text style={[styles.typeBadgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
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

          {/* Title */}
          <Text style={styles.title}>Multiple Accounts Detected</Text>
          <Text style={styles.subtitle}>
            Select the account(s) you want to log into
          </Text>

          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#5f27cd" />
              <Text style={styles.loadingText}>Logging in...</Text>
            </View>
          )}

          {/* Account list */}
          {!loading && (
            <>
              {/* Login to All button */}
              {accounts.length > 1 && (
                <TouchableOpacity
                  style={styles.loginAllButton}
                  onPress={selectAll}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.loginAllText}>
                    Select All ({accounts.length} accounts)
                  </Text>
                </TouchableOpacity>
              )}

              <FlatList
                data={accounts}
                renderItem={renderAccountItem}
                keyExtractor={(item) => `${item.type}_${item.id}`}
                style={styles.accountList}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                selectedAccounts.length === 0 && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading || selectedAccounts.length === 0}
            >
              <LinearGradient
                colors={
                  selectedAccounts.length > 0
                    ? COLORS.primaryGradient
                    : ["#C7C7CC", "#C7C7CC"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButtonGradient}
              >
                <Text style={styles.loginButtonText}>
                  Login
                  {selectedAccounts.length > 1
                    ? ` (${selectedAccounts.length})`
                    : ""}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    maxHeight: "80%",
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
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1D1D1F",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8E8E93",
  },
  loginAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: COLORS.primary + "10",
    borderRadius: 12,
  },
  loginAllText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  accountList: {
    maxHeight: 280,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  accountItemSelected: {
    backgroundColor: COLORS.primary + "08",
    borderColor: COLORS.primary + "30",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#C7C7CC",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  accountInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  accountName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 2,
  },
  accountUsername: {
    fontSize: 13,
    color: "#8E8E93",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: "#F2F2F7",
  },
  cancelButtonText: {
    color: "#8E8E93",
    fontSize: 16,
    fontWeight: "600",
  },
  loginButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.pill,
    overflow: "hidden",
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: BORDER_RADIUS.pill,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

AccountPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  accounts: PropTypes.array,
  onSelectAccount: PropTypes.func.isRequired,
  onSelectMultiple: PropTypes.func, // New prop for multi-select
  loading: PropTypes.bool,
  email: PropTypes.string,
};

AccountPickerModal.defaultProps = {
  accounts: [],
  onSelectMultiple: null,
  loading: false,
  email: "",
};
