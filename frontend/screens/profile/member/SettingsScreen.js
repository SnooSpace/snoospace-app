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
  Modal,
  Animated as RNAnimated,
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
  Zap,
  X,
  BarChart,
  Briefcase,
  Trophy,
  MessageCircle,
  Sparkles,
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
import { getActiveAccount, getAuthToken } from "../../../api/auth";
import { apiPatch } from "../../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const [hapticsEnabled, setHapticsEnabled] = useState(
    HapticsService.isEnabled,
  );

  useEffect(() => {
    async function loadHaptics() {
      const val = await HapticsService.getEnabled();
      setHapticsEnabled(val);
    }
    loadHaptics();
  }, []);

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

  // ── Creator Mode ──────────────────────────────────────────────────────────
  // Priority: AsyncStorage > profile prop (profile prop can be stale when
  // Settings is reopened after toggling while it was open)
  const [isCreatorModeEnabled, setIsCreatorModeEnabled] = useState(
    profile?.is_creator_mode_enabled === true,
  );
  const [isTogglingCreator, setIsTogglingCreator] = useState(false);
  const [showCreatorOnboarding, setShowCreatorOnboarding] = useState(false);
  const [showCreatorInfo, setShowCreatorInfo] = useState(false);

  const slideAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (showCreatorOnboarding || showCreatorInfo) {
      slideAnim.setValue(0);
      RNAnimated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [showCreatorOnboarding, showCreatorInfo]);

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });
  const CREATOR_ONBOARDED_KEY = "creator_mode_onboarded";
  const CREATOR_MODE_CACHE_KEY = "creator_mode_enabled";

  // On mount: read the persisted value from AsyncStorage so the toggle is
  // always correct even when Settings is closed and reopened.
  useEffect(() => {
    AsyncStorage.getItem(CREATOR_MODE_CACHE_KEY).then((val) => {
      if (val !== null) setIsCreatorModeEnabled(val === "true");
    });
  }, []);

  // Keep in sync when the parent profile prop updates (e.g. from EventBus)
  useEffect(() => {
    if (profile?.is_creator_mode_enabled !== undefined) {
      setIsCreatorModeEnabled(profile.is_creator_mode_enabled === true);
      AsyncStorage.setItem(CREATOR_MODE_CACHE_KEY, String(profile.is_creator_mode_enabled === true));
    }
  }, [profile?.is_creator_mode_enabled]);

  const handleToggleCreatorMode = async (val) => {
    if (isTogglingCreator) return;
    HapticsService.triggerImpactLight();
    // Optimistic update + persist immediately
    setIsCreatorModeEnabled(val);
    await AsyncStorage.setItem(CREATOR_MODE_CACHE_KEY, String(val));
    setIsTogglingCreator(true);
    try {
      const token = await getAuthToken();
      await apiPatch("/members/me/creator-mode", { enabled: val }, 10000, token);
      // Broadcast to MemberProfileScreen so its `profile` state updates
      EventBus.emit("profile:updated", {
        profile: { ...profile, is_creator_mode_enabled: val },
      });
      // First-time onboarding: show the explainer when turned ON
      if (val) {
        const alreadyOnboarded = await AsyncStorage.getItem(CREATOR_ONBOARDED_KEY);
        if (!alreadyOnboarded) {
          await AsyncStorage.setItem(CREATOR_ONBOARDED_KEY, "true");
          setShowCreatorOnboarding(true);
        }
      }
    } catch (err) {
      // Revert on failure
      setIsCreatorModeEnabled(!val);
      await AsyncStorage.setItem(CREATOR_MODE_CACHE_KEY, String(!val));
      Alert.alert("Couldn't update", "Failed to change Creator Mode. Please try again.");
      console.error("[Settings] toggleCreatorMode error:", err.message);
    } finally {
      setIsTogglingCreator(false);
    }
  };

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

          {/* ── CREATOR (members only) ──────────────────────── */}
          {!isCommunity && (
            <>
              <SectionLabel title="Creator" />
              <Card>
                <SettingsRow
                  icon={Zap}
                  iconColor="#7C3AED"
                  label={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontFamily: FONTS.medium, fontSize: 15, color: COLORS.textPrimary }}>
                        Creator Mode
                      </Text>
                      {isCreatorModeEnabled && (
                        <Pressable
                          onPress={() => setShowCreatorInfo(true)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Info size={14} color="#9CA3AF" strokeWidth={2} />
                        </Pressable>
                      )}
                    </View>
                  }
                  sublabel={
                    isCreatorModeEnabled
                      ? "On · Audience insights & post types unlocked"
                      : "Off · Enable to unlock creator features"
                  }
                  isFirst
                  isLast={!isCreatorModeEnabled}
                  rightElement={
                    <AnimatedSwitch
                      value={isCreatorModeEnabled}
                      onValueChange={handleToggleCreatorMode}
                      activeColor="#7C3AED"
                    />
                  }
                />
                {isCreatorModeEnabled && (
                  <SettingsRow
                    icon={TrendingUp}
                    iconColor="#8B5CF6"
                    label="Monetization"
                    sublabel="Sponsorship preferences"
                    onPress={() =>
                      navigation.navigate("CreatorMonetization", { profile })
                    }
                    isLast
                  />
                )}
              </Card>
            </>
          )}

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

      {/* ── Creator Mode first-time onboarding modal ── */}
      {showCreatorOnboarding && (
        <Modal
          transparent
          visible={showCreatorOnboarding}
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setShowCreatorOnboarding(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
            onPress={() => setShowCreatorOnboarding(false)}
          >
            <RNAnimated.View
              style={[creatorModalStyles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
              {/* Handle */}
              <View style={creatorModalStyles.handle} />

              {/* Header */}
              <View style={creatorModalStyles.header}>
                <View style={creatorModalStyles.iconRing}>
                  <Zap size={26} color="#7C3AED" strokeWidth={2.5} />
                </View>
                <Text style={creatorModalStyles.title}>Creator Mode is ON</Text>
                <Text style={creatorModalStyles.subtitle}>
                  You've unlocked a new layer of tools built for personal creators.
                </Text>
              </View>

              {/* Feature list */}
              {[
                { icon: BarChart,      color: "#3B82F6", label: "Audience Dashboard",      sub: "Follow quality, Audience Score & reach analytics on your Profile" },
                { icon: Sparkles,      color: "#8B5CF6", label: "All Post Types",           sub: "Create Polls, Prompts, Q&As, Challenges & Opportunities" },
                { icon: Users,         color: "#10B981", label: "Creator Activity Tab",     sub: "See your creator-scoped insights in My Activity" },
                { icon: Trophy,        color: "#F59E0B", label: "Create Challenges",        sub: "Launch challenges that your followers can submit to" },
                { icon: Briefcase,     color: "#EC4899", label: "Post Opportunities",       sub: "Find collaborators, team members & paid gigs" },
                { icon: TrendingUp,    color: "#7C3AED", label: "Monetization Settings",   sub: "Set your sponsorship preferences so brands can find you" },
              ].map(({ icon: Icon, color, label, sub }) => (
                <View key={label} style={creatorModalStyles.featureRow}>
                  <View style={[creatorModalStyles.featureIcon, { backgroundColor: color + "18" }]}>
                    <Icon size={18} color={color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={creatorModalStyles.featureLabel}>{label}</Text>
                    <Text style={creatorModalStyles.featureSub}>{sub}</Text>
                  </View>
                </View>
              ))}

              {/* CTA */}
              <TouchableOpacity
                style={creatorModalStyles.cta}
                onPress={() => setShowCreatorOnboarding(false)}
                activeOpacity={0.85}
              >
                <Text style={creatorModalStyles.ctaText}>Got it, let's go!</Text>
              </TouchableOpacity>
              </Pressable>
            </RNAnimated.View>
          </Pressable>
        </Modal>
      )}

      {/* ── Creator info sheet (i icon, subsequent enables) ── */}
      {showCreatorInfo && (
        <Modal
          transparent
          visible={showCreatorInfo}
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setShowCreatorInfo(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
            onPress={() => setShowCreatorInfo(false)}
          >
            <RNAnimated.View
              style={[creatorModalStyles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <View style={creatorModalStyles.handle} />
              <View style={creatorModalStyles.header}>
                <Text style={creatorModalStyles.title}>What Creator Mode unlocks</Text>
              </View>
              {[
                { icon: BarChart,   color: "#3B82F6", label: "Audience Dashboard",    sub: "Analytics on your Profile" },
                { icon: Sparkles,   color: "#8B5CF6", label: "All Post Types",         sub: "Polls, Prompts, Q&As, Challenges, Opportunities" },
                { icon: Users,      color: "#10B981", label: "Creator Activity Tab",   sub: "Creator-scoped insights in My Activity" },
                { icon: Trophy,     color: "#F59E0B", label: "Create Challenges",      sub: "Launch challenges for your followers" },
                { icon: Briefcase,  color: "#EC4899", label: "Post Opportunities",     sub: "Collabs, gigs & projects" },
                { icon: TrendingUp, color: "#7C3AED", label: "Monetization Settings", sub: "Sponsorship preferences" },
              ].map(({ icon: Icon, color, label, sub }) => (
                <View key={label} style={creatorModalStyles.featureRow}>
                  <View style={[creatorModalStyles.featureIcon, { backgroundColor: color + "18" }]}>
                    <Icon size={18} color={color} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={creatorModalStyles.featureLabel}>{label}</Text>
                    <Text style={creatorModalStyles.featureSub}>{sub}</Text>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={creatorModalStyles.cta}
                onPress={() => setShowCreatorInfo(false)}
                activeOpacity={0.85}
              >
                <Text style={creatorModalStyles.ctaText}>Close</Text>
              </TouchableOpacity>
              </Pressable>
            </RNAnimated.View>
          </Pressable>
        </Modal>
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

const creatorModalStyles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  iconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F5F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#111827",
    marginBottom: 2,
  },
  featureSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  cta: {
    marginTop: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
