import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import {
  ArrowLeft,
  ChevronRight,
  Users,
  Instagram,
  UserX,
  BarChart2,
  Bell,
  Smartphone,
  HelpCircle,
  Info,
  LogOut,
  Trash2,
  TrendingUp,
} from "lucide-react-native";
import {
  COLORS,
  FONTS,
  SHADOWS,
  BORDER_RADIUS,
} from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import EventBus from "../../../utils/EventBus";
import Constants from "expo-constants";
import DynamicStatusBar from "../../../components/DynamicStatusBar";
import AccountSwitcherModal from "../../../components/modals/AccountSwitcherModal";
import AddAccountModal from "../../../components/modals/AddAccountModal";
import { getActiveAccount } from "../../../api/auth";

// ─── Animated toggle (same premium switch from SettingsModal) ─────────────────
function AnimatedSwitch({ value, onValueChange, activeColor = "#2962FF" }) {
  const translateX = useSharedValue(value ? 22 : 2);

  useEffect(() => {
    translateX.value = withSpring(value ? 22 : 2, {
      mass: 0.8,
      stiffness: 150,
      damping: 15,
    });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      translateX.value,
      [2, 22],
      ["#E5E5EA", activeColor],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[switchStyles.track, trackStyle]}>
        <Animated.View style={[switchStyles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const switchStyles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    padding: 2,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
});

function SettingsRow({
  icon: Icon,
  iconColor = COLORS.textPrimary,
  label,
  sublabel,
  onPress,
  rightElement,
  isFirst,
  isLast,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        rowStyles.row,
        isFirst && rowStyles.rowFirst,
        isLast && rowStyles.rowLast,
        !isLast && rowStyles.rowWithBorder,
        pressed && onPress && { backgroundColor: "#F2F2F7" },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[rowStyles.iconBox, { backgroundColor: `${iconColor}14` }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={rowStyles.labelWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        {sublabel ? <Text style={rowStyles.sublabel}>{sublabel}</Text> : null}
      </View>
      {rightElement !== undefined ? (
        rightElement
      ) : onPress ? (
        <ChevronRight size={18} color={COLORS.textSecondary} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  rowFirst: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  rowLast: {
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  rowWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  labelWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sublabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

function SectionLabel({ title }) {
  return <Text style={sectionStyles.label}>{title}</Text>;
}

const sectionStyles = StyleSheet.create({
  label: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
});

function Card({ children, style }) {
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.sm,
    shadowOpacity: 0.04,
    marginBottom: 24,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen({ route, navigation }) {
  const {
    profile: initialProfile,
    accountType,
    hapticsEnabled: initialHaptics,
    onLogoutPress,
    onAddAccountPress,
  } = route?.params || {};

  const [profile, setProfile] = useState(initialProfile);

  useEffect(() => {
    if (route.params?.profile) {
      setProfile(route.params.profile);
    }
  }, [route.params?.profile]);

  useEffect(() => {
    const unsub = EventBus.on("profile:updated", ({ profile: updatedProfile }) => {
      setProfile(updatedProfile);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const isCommunity = accountType === "community" || profile?.community_type != null;

  const [hapticsEnabled, setHapticsEnabled] = React.useState(
    initialHaptics ?? true,
  );

  const appVersion =
    Constants.expoConfig?.version || Constants.manifest?.version || "—";

  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [activeAccount, setActiveAccount] = useState(null);

  useEffect(() => {
    async function loadActive() {
      try {
        const acc = await getActiveAccount();
        setActiveAccount(acc);
      } catch (err) {
        console.error("Error loading active account:", err);
      }
    }
    loadActive();
  }, [showAccountSwitcher]);

  const handleToggleHaptics = async (val) => {
    setHapticsEnabled(val);
    await HapticsService.setEnabled(val);
    if (val) HapticsService.triggerImpactLight();
  };

  const handleLogout = () => {
    HapticsService.triggerImpactLight();
    navigation.goBack();
    // Small delay so the screen pops before the modal appears
    setTimeout(
      () => EventBus.emit("settings:action", { action: "logout" }),
      150,
    );
  };

  const handleAddAccount = () => {
    HapticsService.triggerImpactLight();
    navigation.goBack();
    setTimeout(
      () => EventBus.emit("settings:action", { action: "add_account" }),
      150,
    );
  };

  const handleSwitchAccount = () => {
    HapticsService.triggerImpactLight();
    setShowAccountSwitcher(true);
  };

  const handleDeleteAccount = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("DeleteAccount");
  };

  const handleHelp = () => {
    HapticsService.triggerImpactLight();
    Alert.alert("Help & Support", "Help & Support will be available soon.");
  };

  const handleAbout = () => {
    HapticsService.triggerImpactLight();
    Alert.alert(
      `SnooSpace v${appVersion}`,
      "Terms of Service, Privacy Policy, and Community Guidelines will be available soon.",
      [{ text: "OK" }],
    );
  };

  // Local reactive instagram state — updated via EventBus when LinkedAccountsScreen saves
  const [instagramUsername, setInstagramUsername] = useState(
    profile?.instagram_username || null,
  );

  // Keep in sync when LinkedAccountsScreen links/unlinks
  useEffect(() => {
    const unsub = EventBus.on("instagram:updated", ({ username }) => {
      setInstagramUsername(username || null);
      setProfile((prev) => prev ? { ...prev, instagram_username: username || null } : prev);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <View style={styles.container}>
      <DynamicStatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── ACCOUNT ─────────────────────────────────── */}
          <SectionLabel title="Account" />
          <Card>
            <SettingsRow
              icon={Users}
              iconColor="#2962FF"
              label="Switch / Add Account"
              sublabel="Manage your SnooSpace accounts"
              onPress={handleSwitchAccount}
              isFirst
            />
            <SettingsRow
              icon={Instagram}
              iconColor="#EC4899"
              label="Linked Accounts"
              sublabel={
                instagramUsername ? `@${instagramUsername}` : "Not linked"
              }
              onPress={() =>
                navigation.navigate("LinkedAccounts", {
                  instagramUsername,
                })
              }
              isLast
            />
          </Card>

          {/* ── MONETIZATION (community accounts only) ──── */}
          {isCommunity && (
            <>
              <SectionLabel title="Monetization" />
              <Card>
                <SettingsRow
                  icon={TrendingUp}
                  iconColor="#8B5CF6"
                  label="Sponsorship Preferences"
                  sublabel="Configure what kind of sponsors you're open to"
                  onPress={() =>
                    navigation.navigate("CommunityMonetization", { profile })
                  }
                  isFirst
                  isLast
                />
              </Card>
            </>
          )}

          {/* ── BLOCKED ACCOUNTS ────────────────────────── */}
          <SectionLabel title="Blocked Accounts" />
          <Card>
            <SettingsRow
              icon={UserX}
              iconColor="#E53E3E"
              label="Blocked Accounts"
              sublabel="Manage who you've blocked"
              onPress={() => navigation.navigate("BlockedAccounts")}
              isFirst
              isLast
            />
          </Card>

          {/* ── MY ACTIVITY ─────────────────────────────── */}
          <SectionLabel title="My Activity" />
          <Card>
            <SettingsRow
              icon={BarChart2}
              iconColor="#8B5CF6"
              label="My Activity"
              sublabel="How SnooSpace understands you"
              onPress={() => {
                HapticsService.triggerImpactLight();
                navigation.navigate("MyDataScreen");
              }}
              isFirst
              isLast
            />
          </Card>

          {/* ── PREFERENCES ─────────────────────────────── */}
          <SectionLabel title="Preferences" />
          <Card>
            <SettingsRow
              icon={Bell}
              iconColor="#F59E0B"
              label="Notifications"
              onPress={() =>
                Alert.alert(
                  "Notifications",
                  "Notification settings coming soon.",
                )
              }
              isFirst
            />
            <SettingsRow
              icon={Smartphone}
              iconColor="#10B981"
              label="App Haptics"
              sublabel="Vibration feedback on interactions"
              rightElement={
                <AnimatedSwitch
                  value={hapticsEnabled}
                  onValueChange={handleToggleHaptics}
                  activeColor="#2962FF"
                />
              }
              isLast
            />
          </Card>

          {/* ── SUPPORT & LEGAL ─────────────────────────── */}
          <SectionLabel title="Support & Legal" />
          <Card>
            <SettingsRow
              icon={HelpCircle}
              iconColor="#2962FF"
              label="Help & Support"
              onPress={handleHelp}
              isFirst
            />
            <SettingsRow
              icon={Info}
              iconColor={COLORS.textSecondary}
              label="About"
              sublabel={`Version ${appVersion}`}
              onPress={handleAbout}
              isLast
            />
          </Card>

          {/* ── ACCOUNT ACTIONS ─────────────────────────── */}
          <SectionLabel title="Account Actions" />
          <Card style={{ marginBottom: 12 }}>
            <SettingsRow
              icon={LogOut}
              iconColor="#007AFF"
              label="Logout"
              onPress={handleLogout}
              isFirst
              isLast
              rightElement={null}
            />
          </Card>
          <Card style={{ marginBottom: 40 }}>
            <SettingsRow
              icon={Trash2}
              iconColor="#FF3B30"
              label="Delete Account"
              onPress={handleDeleteAccount}
              isFirst
              isLast
              rightElement={
                <ChevronRight size={18} color="#FF3B30" strokeWidth={2} />
              }
            />
          </Card>
        </ScrollView>
      </SafeAreaView>

      {showAccountSwitcher && (
        <AccountSwitcherModal
          visible={showAccountSwitcher}
          onClose={() => setShowAccountSwitcher(false)}
          currentAccountId={
            activeAccount?.id
              ? `${activeAccount.type || "member"}_${activeAccount.id}`
              : undefined
          }
          currentProfile={
            profile
              ? { ...profile, type: activeAccount?.type || "member" }
              : null
          }
          onAccountSwitch={(account) => {
            // Navigate to correct home screen based on account type
            const routeName =
              account.type === "member"
                ? "MemberHome"
                : account.type === "community"
                  ? "CommunityHome"
                  : account.type === "sponsor"
                    ? "SponsorHome"
                    : account.type === "venue"
                      ? "VenueHome"
                      : "Landing";

            // Get the ROOT navigator (go up the parent chain)
            let rootNavigator = navigation;
            while (rootNavigator.getParent && rootNavigator.getParent()) {
              rootNavigator = rootNavigator.getParent();
            }

            console.log("[AccountSwitch] Resetting to:", routeName);
            rootNavigator.reset({
              index: 0,
              routes: [{ name: routeName }],
            });
          }}
          onAddAccount={() => {
            setShowAddAccountModal(true);
          }}
          onLoginRequired={(account) => {
            setShowAccountSwitcher(false);
            let rootNavigator = navigation;
            while (rootNavigator.getParent && rootNavigator.getParent()) {
              rootNavigator = rootNavigator.getParent();
            }
            rootNavigator.navigate("Login", {
              isAddingAccount: true,
              email: account.email,
            });
          }}
        />
      )}

      {showAddAccountModal && (
        <AddAccountModal
          visible={showAddAccountModal}
          onClose={() => setShowAddAccountModal(false)}
          onLoginExisting={() => {
            navigation.navigate("Login", { isAddingAccount: true });
          }}
          onCreateNew={() => {
            navigation.navigate("Landing", { fromSwitcher: true });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    backgroundColor: "#FFFFFF",
    minHeight: 56,
  },
  backBtn: {
    padding: 12,
  },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 48,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
});
