import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GraduationCap, BadgeCheck, Clock } from "lucide-react-native";
import { FONTS } from "../constants/theme";

/**
 * CollegeChip — Displays college affiliation with verification status.
 *
 * Props:
 * - collegeInfo: { college_name, college_abbreviation, college_status, campus_name, campus_city, college_subtype, club_type }
 * - onPress: () => void — opens College Hub sheet
 * - compact: boolean — smaller variant for search cards
 */
export default function CollegeChip({ collegeInfo, onPress, compact = false }) {
  if (!collegeInfo) return null;

  const isPending = collegeInfo.college_status === "pending";

  // Subtypes: 'event', 'club', 'student_community' (actual DB values)
  const subtypeLabel = getSubtypeLabel(collegeInfo.college_subtype, collegeInfo.club_type);

  // Display name: abbreviation > name > fallback based on subtype
  const displayName =
    collegeInfo.college_abbreviation ||
    collegeInfo.college_name ||
    (subtypeLabel ? `College ${subtypeLabel}` : "College");

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        isPending && styles.containerPending,
        compact && styles.containerCompact,
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconWrap,
          isPending && styles.iconWrapPending,
          compact && styles.iconWrapCompact,
        ]}
      >
        <GraduationCap
          size={compact ? 12 : 14}
          color={isPending ? "#9CA3AF" : "#2962FF"}
          strokeWidth={2}
        />
      </View>

      {/* College name + optional subtype */}
      <View style={styles.textWrap}>
        <Text
          style={[
            styles.collegeName,
            isPending && styles.collegeNamePending,
            compact && styles.collegeNameCompact,
          ]}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        {subtypeLabel && !compact && (
          <Text
            style={[
              styles.subtypeLabel,
              isPending && styles.subtypeLabelPending,
            ]}
            numberOfLines={1}
          >
            {subtypeLabel}
          </Text>
        )}
      </View>

      {/* Status indicator */}
      {isPending ? (
        <View style={styles.pendingBadge}>
          <Clock size={10} color="#D97706" strokeWidth={2.5} />
          <Text style={styles.pendingText}>Pending</Text>
        </View>
      ) : (
        <BadgeCheck
          size={compact ? 12 : 14}
          color="#16A34A"
          strokeWidth={2}
          style={styles.verifiedIcon}
        />
      )}
    </TouchableOpacity>
  );
}

function getSubtypeLabel(collegeSubtype, clubType) {
  if (!collegeSubtype) return null;
  switch (collegeSubtype) {
    // Actual DB values used in signup flow
    case "club":
      if (clubType === "official_club") return "Official Club";
      if (clubType === "department") return "Department";
      if (clubType === "society") return "Society";
      return "Club";
    case "event":
      return "Event";
    case "student_community":
      return "Student Community";
    // Legacy values (for backwards compat)
    case "college_council":
      return "College Council";
    case "official_club":
      return clubType
        ? clubType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "Official Club";
    case "student_organization":
      return "Student Organization";
    case "independent_group":
      return "Independent Group";
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  containerPending: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    opacity: 0.85,
  },
  containerCompact: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  iconWrapPending: {
    backgroundColor: "#F3F4F6",
  },
  iconWrapCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 4,
  },
  textWrap: {
    flexShrink: 1,
    marginRight: 6,
  },
  collegeName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#1E40AF",
    lineHeight: 17,
  },
  collegeNamePending: {
    color: "#6B7280",
  },
  collegeNameCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  subtypeLabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 11,
    color: "#3B82F6",
    lineHeight: 14,
    marginTop: 1,
  },
  subtypeLabelPending: {
    color: "#9CA3AF",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  pendingText: {
    fontFamily: "Manrope-Medium",
    fontSize: 10,
    color: "#D97706",
    lineHeight: 13,
  },
  verifiedIcon: {
    marginLeft: 2,
  },
});
