/**
 * CommunityMonetizationScreen.js
 *
 * Post-signup Monetization & Sponsorship settings for community accounts.
 * Moved here from the signup flow — asking about sponsor preferences on day zero
 * felt premature. Communities can configure this once they have some traction.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Sparkles,
  X,
  Plus,
  Info,
  TrendingUp,
  Check,
} from "lucide-react-native";
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import { getSponsorTypes } from "../../../api/client";
import { updateCommunityProfile } from "../../../api/communities";
import { getAuthToken } from "../../../api/auth";
import HapticsService from "../../../services/HapticsService";
import SnooLoader from "../../../components/ui/SnooLoader";
import DynamicStatusBar from "../../../components/DynamicStatusBar";
import { getSponsorTypeStyle } from "./EditCommunityProfileConstants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FALLBACK_SPONSOR_TYPES = [
  "Protein brands",
  "Energy Drinks",
  "Supplements",
  "Apparel",
  "Tech Gadgets",
  "Local Businesses",
  "Food & Beverage",
  "Beauty & Wellness",
  "Entertainment",
];

const TEXT_PRIMARY = COLORS.textPrimary;
const TEXT_SECONDARY = COLORS.textSecondary;
const ACCENT_COLOR = COLORS.primary;

export default function CommunityMonetizationScreen({ route, navigation }) {
  const profile = route?.params?.profile;

  const [sponsoringEnabled, setSponsoringEnabled] = useState(
    Array.isArray(profile?.sponsor_types) && profile.sponsor_types.length > 0
  );
  const [sponsorTypes, setSponsorTypes] = useState(
    profile?.sponsor_types || []
  );
  const [availableTypes, setAvailableTypes] = useState(FALLBACK_SPONSOR_TYPES);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track original values to detect changes
  const [originalEnabled] = useState(
    Array.isArray(profile?.sponsor_types) && profile.sponsor_types.length > 0
  );
  const [originalTypes] = useState(profile?.sponsor_types || []);

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const types = await getSponsorTypes();
        if (Array.isArray(types) && types.length > 0) {
          setAvailableTypes(types.map((t) => t.name || t));
        }
      } catch (e) {
        console.warn("[CommunityMonetization] Could not load sponsor types:", e.message);
      } finally {
        setLoadingTypes(false);
      }
    };
    loadTypes();
  }, []);

  useEffect(() => {
    const sortedNew = [...sponsorTypes].sort().join(",");
    const sortedOld = [...originalTypes].sort().join(",");
    setHasChanges(sponsoringEnabled !== originalEnabled || sortedNew !== sortedOld);
  }, [sponsoringEnabled, sponsorTypes]);

  const toggleType = (type) => {
    HapticsService.triggerSelection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSponsorTypes((prev) => {
      if (type === "Open to All") {
        return prev.includes("Open to All") ? [] : ["Open to All"];
      }
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev.filter((t) => t !== "Open to All"), type];
    });
  };

  const handleSave = async () => {
    if (sponsoringEnabled && sponsorTypes.length < 3 && !sponsorTypes.includes("Open to All")) {
      Alert.alert(
        "Select more types",
        "Please select at least 3 sponsor types, or choose \"Open to All\"."
      );
      return;
    }

    try {
      setSaving(true);
      const token = await getAuthToken();
      await updateCommunityProfile(
        { sponsor_types: sponsoringEnabled ? sponsorTypes : [] },
        token
      );
      HapticsService.triggerNotificationSuccess();
      setHasChanges(false);
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to save sponsorship settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <DynamicStatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowLeft size={24} color={TEXT_PRIMARY} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Monetization</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || saving}
            style={[styles.saveBtn, (!hasChanges || saving) && styles.saveBtnDisabled]}
          >
            {saving ? (
              <SnooLoader size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroIconContainer}>
              <TrendingUp size={28} color={ACCENT_COLOR} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Sponsorship Preferences</Text>
              <Text style={styles.heroSubtitle}>
                Let brands know what kind of partnerships you're open to. Only visible when enabled.
              </Text>
            </View>
          </View>

          {/* Toggle card */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Looking for Sponsors</Text>
                <Text style={styles.toggleSublabel}>
                  {sponsoringEnabled
                    ? "Select the types of sponsors you're open to"
                    : "Turn on to show sponsors you're open to partnerships"}
                </Text>
              </View>
              <Switch
                value={sponsoringEnabled}
                onValueChange={(val) => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSponsoringEnabled(val);
                  HapticsService.triggerSelection();
                }}
                trackColor={{ false: "rgba(0,0,0,0.08)", true: ACCENT_COLOR }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="rgba(0,0,0,0.08)"
              />
            </View>

            {/* Type picker */}
            {sponsoringEnabled && (
              <View style={styles.typePickerSection}>
                <View style={styles.sectionDivider} />
                {loadingTypes ? (
                  <View style={styles.loadingRow}>
                    <SnooLoader size="small" color={ACCENT_COLOR} />
                  </View>
                ) : (
                  <>
                    <Text style={styles.pickLabel}>
                      Select types you're open to (min 3 or "Open to All"):
                    </Text>
                    <View style={styles.chipsWrap}>
                      {["Open to All", ...availableTypes].map((type) => {
                        const isSelected = sponsorTypes.includes(type);
                        const typeStyle = getSponsorTypeStyle(type);
                        return (
                          <TouchableOpacity
                            key={type}
                            activeOpacity={0.7}
                            onPress={() => toggleType(type)}
                            style={[
                              styles.chip,
                              isSelected && {
                                backgroundColor: typeStyle.bg,
                                borderColor: "transparent",
                              },
                            ]}
                          >
                            {isSelected && (
                              <Check size={12} color={typeStyle.text} strokeWidth={3} />
                            )}
                            <Text
                              style={[
                                styles.chipText,
                                isSelected && { color: typeStyle.text, fontFamily: FONTS.semibold },
                              ]}
                            >
                              {type}
                            </Text>
                            {isSelected ? (
                              <X size={12} color={typeStyle.text} strokeWidth={3} />
                            ) : (
                              <Plus size={12} color={TEXT_SECONDARY} strokeWidth={2.5} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Hint when fewer than 3 selected and not "Open to All" */}
                    {!sponsorTypes.includes("Open to All") && sponsorTypes.length < 3 && (
                      <View style={styles.hintRow}>
                        <Info size={13} color={ACCENT_COLOR} strokeWidth={2} />
                        <Text style={styles.hintText}>
                          Select at least 3 types to save, or choose "Open to All"
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* Info note */}
          <View style={styles.infoCard}>
            <Sparkles size={15} color="#8B5CF6" strokeWidth={1.8} />
            <Text style={styles.infoText}>
              Your sponsorship preferences will appear on your public profile and help brands discover relevant communities to partner with.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  safeTop: {
    backgroundColor: "#FFFFFF",
  },
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
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  saveBtn: {
    backgroundColor: ACCENT_COLOR,
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Hero
  heroBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 24,
    backgroundColor: `${ACCENT_COLOR}08`,
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: `${ACCENT_COLOR}1A`,
  },
  heroIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: `${ACCENT_COLOR}14`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.sm,
    shadowOpacity: 0.04,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  toggleLabel: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  toggleSublabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 16,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginHorizontal: 16,
  },
  typePickerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingRow: {
    alignItems: "center",
    paddingVertical: 20,
  },
  pickLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 12,
    lineHeight: 18,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.pill,
  },
  chipText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: TEXT_PRIMARY,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    backgroundColor: `${ACCENT_COLOR}08`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hintText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: ACCENT_COLOR,
    flex: 1,
    lineHeight: 16,
  },

  // Info card
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderRadius: BORDER_RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  infoText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#5B21B6",
    lineHeight: 18,
    flex: 1,
  },
});
