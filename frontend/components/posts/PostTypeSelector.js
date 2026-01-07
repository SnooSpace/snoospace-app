/**
 * PostTypeSelector
 * Allows community admins to select post type when creating a new post
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const POST_TYPES = [
  {
    id: "media",
    label: "Photo",
    icon: "image",
    iconFamily: "ionicons",
    description: "Share images with your community",
    color: "#1976D2",
  },
  {
    id: "poll",
    label: "Poll",
    icon: "poll",
    iconFamily: "material",
    description: "Ask your community to vote",
    color: "#7B1FA2",
  },
  {
    id: "prompt",
    label: "Prompt",
    icon: "chat-question",
    iconFamily: "material",
    description: "Collect responses from members",
    color: "#00838F",
  },
  {
    id: "qna",
    label: "Q&A",
    icon: "frequently-asked-questions",
    iconFamily: "material",
    description: "Host a Q&A session",
    color: "#5856D6",
  },
  {
    id: "challenge",
    label: "Challenge",
    icon: "trophy-outline",
    iconFamily: "material",
    description: "Create a community challenge",
    color: "#FF9500",
  },
];

const PostTypeSelector = ({ selectedType, onSelectType, disabled = false }) => {
  const renderIcon = (type) => {
    if (type.iconFamily === "material") {
      return (
        <MaterialCommunityIcons
          name={type.icon}
          size={24}
          color={selectedType === type.id ? "#FFFFFF" : type.color}
        />
      );
    }
    return (
      <Ionicons
        name={type.icon}
        size={24}
        color={selectedType === type.id ? "#FFFFFF" : type.color}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Post Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typesContainer}
      >
        {POST_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeCard,
                isSelected && { backgroundColor: type.color },
                disabled && styles.disabled,
              ]}
              onPress={() => !disabled && onSelectType(type.id)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  isSelected && styles.iconContainerSelected,
                ]}
              >
                {renderIcon(type)}
              </View>
              <Text
                style={[
                  styles.typeLabel,
                  isSelected && styles.typeLabelSelected,
                ]}
              >
                {type.label}
              </Text>
              <Text
                style={[
                  styles.typeDescription,
                  isSelected && styles.typeDescriptionSelected,
                ]}
                numberOfLines={2}
              >
                {type.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
    paddingHorizontal: SPACING.m,
  },
  typesContainer: {
    paddingHorizontal: SPACING.m,
    gap: SPACING.s,
  },
  typeCard: {
    width: 120,
    padding: SPACING.m,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.s,
    ...SHADOWS.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.s,
  },
  iconContainerSelected: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  typeLabelSelected: {
    color: "#FFFFFF",
  },
  typeDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 14,
  },
  typeDescriptionSelected: {
    color: "rgba(255,255,255,0.8)",
  },
});

export default PostTypeSelector;
