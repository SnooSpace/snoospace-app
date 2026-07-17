/**
 * OpportunityCreateForm
 * Creator-only form for posting Opportunities (collabs, projects, gigs).
 * Follows the exact design patterns of ChallengeCreateForm.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import {
  Briefcase,
  Users,
  Zap,
  DollarSign,
  Clock,
  Pencil,
  Gift,
} from "lucide-react-native";
import CustomDatePicker from "../ui/CustomDatePicker";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const OPPORTUNITY_TYPES = [
  { id: "collab",   label: "Collab",   description: "Creative project", icon: Users },
  { id: "gig",      label: "Gig",      description: "Paid short-term",  icon: DollarSign },
  { id: "project",  label: "Project",  description: "Build together",   icon: Briefcase },
];

const COMPENSATION_TYPES = [
  { id: "paid",      label: "Paid",       icon: DollarSign },
  { id: "rev_share", label: "Rev Share",  icon: Zap },
  { id: "unpaid",    label: "Unpaid",     icon: Gift },
];

const OpportunityCreateForm = ({ onDataChange, disabled }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [opportunityType, setOpportunityType] = useState("collab");
  const [compensationType, setCompensationType] = useState("unpaid");
  const [compensationDetails, setCompensationDetails] = useState("");
  const [spotsTotal, setSpotsTotal] = useState(1);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Sync to parent on every field change
  useEffect(() => {
    onDataChange?.({
      title: title.trim(),
      description: description.trim(),
      opportunity_type: opportunityType,
      compensation_type: compensationType,
      compensation_details: compensationDetails.trim(),
      spots_total: spotsTotal,
      deadline: hasDeadline && deadline ? deadline.toISOString() : null,
    });
  }, [title, description, opportunityType, compensationType, compensationDetails, spotsTotal, hasDeadline, deadline]);

  const formatDeadline = (date) =>
    date
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";

  return (
    <View style={styles.container}>
      {/* Hero card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.subtleLabel}>POST AN OPPORTUNITY</Text>
          <Briefcase size={20} color="#7C3AED" strokeWidth={2} />
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Looking for a video editor"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          editable={!disabled}
          multiline
        />
        <Text style={styles.charCount}>{title.length}/100</Text>

        <Text style={styles.descriptionLabel}>What are you looking for?</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe the role, skills needed, timeline, and what you'll build together."
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
          editable={!disabled}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{description.length}/1000</Text>
      </View>

      {/* Opportunity type */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Type</Text>
        <View style={styles.typeRow}>
          {OPPORTUNITY_TYPES.map((t) => {
            const isSelected = opportunityType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setOpportunityType(t.id);
                }}
                activeOpacity={0.85}
                disabled={disabled}
              >
                <t.icon
                  size={20}
                  color={isSelected ? "#7C3AED" : COLORS.textSecondary}
                  strokeWidth={2.5}
                />
                <Text style={[styles.typeCardLabel, isSelected && styles.typeCardLabelSelected]}>
                  {t.label}
                </Text>
                <Text style={styles.typeCardSub}>{t.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Compensation */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Compensation</Text>
        <View style={styles.compRow}>
          {COMPENSATION_TYPES.map((c) => {
            const isSelected = compensationType === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.compChip, isSelected && styles.compChipSelected]}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setCompensationType(c.id);
                }}
                activeOpacity={0.85}
                disabled={disabled}
              >
                <c.icon size={14} color={isSelected ? "#7C3AED" : COLORS.textSecondary} strokeWidth={2.5} />
                <Text style={[styles.compChipLabel, isSelected && styles.compChipLabelSelected]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {compensationType !== "unpaid" && (
          <TextInput
            style={styles.compDetailsInput}
            placeholder={compensationType === "paid" ? "e.g. ₹5,000 per edit" : "e.g. 20% of revenue"}
            placeholderTextColor={COLORS.textMuted}
            value={compensationDetails}
            onChangeText={setCompensationDetails}
            maxLength={200}
            editable={!disabled}
          />
        )}
      </View>

      {/* Settings card */}
      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Settings</Text>

        {/* Spots available */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={styles.iconBox}>
              <Users size={18} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.settingTitle}>Spots available</Text>
              <Text style={styles.settingSub}>How many people you need</Text>
            </View>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => spotsTotal > 1 && setSpotsTotal((p) => p - 1)}
              disabled={disabled || spotsTotal <= 1}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{spotsTotal}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => spotsTotal < 50 && setSpotsTotal((p) => p + 1)}
              disabled={disabled || spotsTotal >= 50}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Deadline toggle */}
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingLeft}>
            <View style={styles.iconBox}>
              <Clock size={18} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.settingTitle}>Application deadline</Text>
              <Text style={styles.settingSub}>When to stop accepting applicants</Text>
            </View>
          </View>
          <Switch
            value={hasDeadline}
            onValueChange={(v) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setHasDeadline(v);
              if (v && !deadline) {
                const d = new Date();
                d.setDate(d.getDate() + 14);
                d.setHours(23, 59, 0, 0);
                setDeadline(d);
              }
            }}
            trackColor={{ false: "#E5E7EB", true: "#7C3AED" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E7EB"
            disabled={disabled}
          />
        </View>

        {hasDeadline && (
          <TouchableOpacity
            style={styles.deadlineChip}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Pencil size={14} color="#7C3AED" strokeWidth={2.5} />
            <Text style={styles.deadlineText}>
              {deadline ? formatDeadline(deadline) : "Pick a date"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <CustomDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        startDate={deadline ? new Date(deadline) : null}
        onConfirm={({ startDate }) => {
          setShowDatePicker(false);
          if (startDate) {
            const d = new Date(startDate);
            d.setHours(23, 59, 0, 0);
            setDeadline(d);
          }
        }}
        minDate={new Date()}
        singleMode
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 40 },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  heroHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  subtleLabel: { fontSize: 11, fontFamily: FONTS.bold, color: "#7C3AED", opacity: 0.7, letterSpacing: 1, textTransform: "uppercase" },

  titleInput: { fontFamily: FONTS.regular, fontSize: 18, color: COLORS.textPrimary, lineHeight: 26, padding: 0, minHeight: 30 },
  charCount: { fontSize: 11, fontFamily: FONTS.medium, color: "#9CA3AF", textAlign: "right", marginTop: 4, marginBottom: 16 },

  descriptionLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.textSecondary, opacity: 0.7, marginBottom: 8 },
  descriptionInput: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 100,
  },

  sectionGroup: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontFamily: "BasicCommercial-Bold", color: COLORS.textPrimary, marginBottom: 14 },

  typeRow: { flexDirection: "row", gap: 10 },
  typeCard: { flex: 1, backgroundColor: "#F8F9FB", borderRadius: 20, padding: 14, gap: 4 },
  typeCardSelected: { backgroundColor: "#F5F0FF", borderWidth: 1, borderColor: "#7C3AED" },
  typeCardLabel: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.textSecondary },
  typeCardLabelSelected: { color: "#7C3AED" },
  typeCardSub: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted },

  compRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  compChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: "#F8F9FB",
  },
  compChipSelected: { borderColor: "#7C3AED", backgroundColor: "#F5F0FF" },
  compChipLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  compChipLabelSelected: { color: "#7C3AED" },
  compDetailsInput: {
    backgroundColor: "#F8F9FB", borderRadius: 12, padding: 14,
    fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary,
    borderWidth: 1, borderColor: COLORS.border,
  },

  settingsCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 3 },
  cardTitle: { fontSize: 16, fontFamily: "BasicCommercial-Bold", color: COLORS.textPrimary, marginBottom: 16 },

  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  settingTitle: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  settingSub: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },

  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  stepBtnText: { fontSize: 18, fontFamily: FONTS.medium, color: COLORS.textPrimary, lineHeight: 22 },
  stepValue: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, minWidth: 24, textAlign: "center" },

  deadlineChip: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F5F0FF", alignSelf: "flex-start" },
  deadlineText: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#7C3AED" },
});

export default React.memo(OpportunityCreateForm);
