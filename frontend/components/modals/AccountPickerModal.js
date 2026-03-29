/**
 * Account Picker Modal
 * Shown when OTP verification returns multiple accounts for the same email
 * User can select one, multiple, or all accounts to log into
 */
import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, Platform } from "react-native";
import { Check, User, Users, Briefcase, MapPin, Plus, ChevronRight, CheckCircle2, MoveRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import PropTypes from "prop-types";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS, SPACING } from "../../constants/theme";
import MaskedView from "@react-native-masked-view/masked-view";
import SnooLoader from "../ui/SnooLoader";

// Type badges and colors
const TYPE_CONFIG = {
  member: { label: "Member", color: "#64748B", icon: User },
  community: { label: "Community", color: "#00d2d3", icon: Users },
  sponsor: { label: "Sponsor", color: "#ff9f43", icon: Briefcase },
  venue: { label: "Venue", color: "#10ac84", icon: MapPin },
};

const GradientText = (props) => {
  return (
    <View style={props.style}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <Text {...props} style={[props.style, { flex: 0, marginLeft: 0, marginTop: 0, marginBottom: 0, marginRight: 0 }]} />
        }
      >
        <LinearGradient
          colors={COLORS.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        >
          <Text {...props} style={[props.style, { opacity: 0, flex: 0, marginLeft: 0, marginTop: 0, marginBottom: 0, marginRight: 0 }]} />
        </LinearGradient>
      </MaskedView>
    </View>
  );
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
  onGoBack,
  accounts = [],
  onSelectAccount,
  onSelectMultiple,
  onCreateNewProfile,
  loading,
  email,
  loggedInAccountIds = [],
}) {
  const [selectedAccounts, setSelectedAccounts] = useState([]);

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
      (a) => `${a.type}_${account.id}` === `${account.type}_${account.id}`
    );
  };

  const selectAll = () => {
    const selectableAccounts = (accounts || []).filter(
      (acc) => !loggedInAccountIds.includes(`${acc.type}_${acc.id}`)
    );
    setSelectedAccounts([...selectableAccounts]);
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
    const isAlreadyLoggedIn = loggedInAccountIds.includes(
      `${item.type}_${item.id}`
    );

    return (
      <TouchableOpacity
        style={[
          styles.accountItem,
          selected && styles.accountItemSelected,
          isAlreadyLoggedIn && styles.accountItemDisabled,
        ]}
        onPress={() => toggleAccountSelection(item)}
        disabled={loading || isAlreadyLoggedIn}
      >
        {!isAlreadyLoggedIn && (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && (
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            )}
          </View>
        )}

        {isAlreadyLoggedIn && (
          <View style={styles.loggedInIndicator}>
            <CheckCircle2 size={22} color={COLORS.textMuted} strokeWidth={2} />
          </View>
        )}

        <LinearGradient
          colors={gradient}
          style={[styles.avatar, isAlreadyLoggedIn && styles.avatarDisabled]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>
            {getInitials(item.name || item.username)}
          </Text>
        </LinearGradient>

        <View style={styles.accountInfo}>
          <Text
            style={[
              styles.accountName,
              isAlreadyLoggedIn && styles.textDisabled,
            ]}
            numberOfLines={1}
          >
            {item.name || item.username}
          </Text>
          <Text
            style={[
              styles.accountUsername,
              isAlreadyLoggedIn && styles.textDisabled,
            ]}
            numberOfLines={1}
          >
            @{item.username}
          </Text>
        </View>

        {isAlreadyLoggedIn ? (
          <View style={styles.loggedInBadge}>
            <Text style={styles.loggedInBadgeText}>Already logged in</Text>
          </View>
        ) : (
          <View
            style={[styles.typeBadge, { backgroundColor: config.color + "15" }]}
          >
            <config.icon size={12} color={config.color} strokeWidth={2.5} />
            <Text style={[styles.typeBadgeText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {}}
      statusBarTranslucent={true}
    >
      <View
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handleBar} />

          <Text style={styles.title}>Multiple Accounts Detected</Text>
          <Text style={styles.subtitle}>
            Select the account(s) you want to log into
          </Text>

          {loading && (
            <View style={styles.loadingContainer}>
              <SnooLoader size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Logging in...</Text>
            </View>
          )}

          {!loading && (
            <>
              {(accounts || []).length > 1 && (
                <TouchableOpacity
                  style={styles.loginAllButton}
                  onPress={selectAll}
                >
                  <Check size={18} color={COLORS.primary} strokeWidth={2.5} />
                  <Text style={styles.loginAllText}>
                    Select All ({(accounts || []).length} accounts)
                  </Text>
                </TouchableOpacity>
              )}

              <FlatList
                data={accounts || []}
                renderItem={renderAccountItem}
                keyExtractor={(item, index) => `${item.type}_${item.id}_${index}`}
                style={styles.accountList}
                showsVerticalScrollIndicator={false}
              />

              {onCreateNewProfile && (
                <TouchableOpacity
                  style={styles.createNewButton}
                  onPress={onCreateNewProfile}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={["#E9F2FF", "#F5F9FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.createNewIcon}
                  >
                    <Plus size={20} color={COLORS.primary} strokeWidth={2.5} />
                  </LinearGradient>
                  <GradientText style={styles.createNewText}>Create a new profile</GradientText>
                  <MoveRight size={20} color={COLORS.primary} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onGoBack || onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>← Go Back to Email</Text>
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
                  Login{selectedAccounts.length > 1 ? ` (${selectedAccounts.length})` : ""}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
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
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "90%",
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
    fontFamily: "BasicCommercial-Black",
    fontSize: 24,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontFamily: "Manrope-Medium",
  },
  loginAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: COLORS.primary + "10",
    borderRadius: 14,
  },
  loginAllText: {
    color: COLORS.primary,
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    marginLeft: 8,
  },
  accountList: {
    maxHeight: 320,
  },
  accountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  accountItemSelected: {
    backgroundColor: COLORS.primary + "06",
    borderColor: COLORS.primary + "20",
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
  loggedInIndicator: {
    width: 22,
    height: 22,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarDisabled: {
    opacity: 0.6,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
  },
  accountInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  accountName: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 17,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  accountUsername: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  textDisabled: {
    color: COLORS.textMuted,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    marginLeft: 4,
  },
  loggedInBadge: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  loggedInBadgeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: "Manrope-Medium",
  },
  createNewButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: COLORS.surface,
  },
  createNewIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  createNewText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    height: 24,
    justifyContent: 'center',
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: "#F2F2F7",
  },
  cancelButtonText: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  loginButton: {
    flex: 1,
    height: 54,
    borderRadius: BORDER_RADIUS.pill,
    overflow: "hidden",
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.pill,
  },
  loginButtonText: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textInverted,
    fontSize: 16,
  },
  accountItemDisabled: {
    opacity: 0.7,
    backgroundColor: "#F9FAFB",
  },
});

AccountPickerModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onGoBack: PropTypes.func,
  accounts: PropTypes.array,
  onSelectAccount: PropTypes.func.isRequired,
  onSelectMultiple: PropTypes.func,
  onCreateNewProfile: PropTypes.func,
  loading: PropTypes.bool,
  email: PropTypes.string,
  loggedInAccountIds: PropTypes.array,
};
