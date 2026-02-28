import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";
import MentionInput from "./MentionInput";
import MentionTextRenderer from "./MentionTextRenderer";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

/**
 * RichTextEditor - Basic text editor with formatting and character count
 * Supports: bold, italic, underline, bullets (minimal features for now)
 */
const RichTextEditor = ({
  value,
  onChange,
  onTaggedEntitiesChange,
  minLength = 50,
  maxLength = 2000,
  placeholder,
  variant = "default",
}) => {
  const [charCount, setCharCount] = useState(value?.length || 0);
  const [showPreview, setShowPreview] = useState(false);
  const [taggedEntities, setTaggedEntities] = useState([]);

  const handleTextChange = (text) => {
    setCharCount(text.length);
    onChange(text);
  };

  const handleTaggedEntitiesChange = (entities) => {
    setTaggedEntities(entities);
    if (onTaggedEntitiesChange) {
      onTaggedEntitiesChange(entities);
    }
  };

  const isValid = charCount >= minLength;
  const isMinimal = variant === "minimal";

  return (
    <View style={[styles.container, isMinimal && styles.minimalContainer]}>
      {!isMinimal && (
        <View style={styles.header}>
          <Text style={styles.label}>Event Description *</Text>
          <Text style={[styles.charCount, !isValid && styles.charCountInvalid]}>
            {charCount}/{maxLength}
            {!isValid && ` (min ${minLength})`}
          </Text>
        </View>
      )}

      {/* Simple Toolbar */}
      <View style={[styles.toolbar, isMinimal && styles.minimalToolbar]}>
        {!isMinimal && (
          <>
            <TouchableOpacity style={styles.toolButton} disabled>
              <Ionicons
                name="text-outline"
                size={isMinimal ? 24 : 20}
                color={LIGHT_TEXT_COLOR}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setShowPreview(!showPreview)}
            >
              <Ionicons
                name={showPreview ? "create-outline" : "eye-outline"}
                size={isMinimal ? 24 : 20}
                color={showPreview ? COLORS.primary : LIGHT_TEXT_COLOR}
              />
            </TouchableOpacity>
          </>
        )}

        {isMinimal && (
          <View
            style={{
              flex: 1,
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <Text
              style={[
                styles.minimalCharCount,
                !isValid && charCount > 0 && { color: "#EF4444" },
              ]}
            >
              {charCount}/{maxLength}
            </Text>
          </View>
        )}
      </View>

      {/* Text Input */}
      {!showPreview ? (
        <View
          style={[
            styles.inputContainer,
            isMinimal && styles.minimalInputContainer,
          ]}
        >
          <MentionInput
            value={value}
            onChangeText={handleTextChange}
            onTaggedEntitiesChange={handleTaggedEntitiesChange}
            placeholder={
              placeholder ||
              (isMinimal
                ? "Tell people what makes this event special..."
                : "Tell people what makes this event special...")
            }
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={maxLength}
            inputStyle={[
              styles.mentionInput,
              isMinimal && styles.minimalMentionInput,
            ]}
            inputContainerStyle={[
              styles.mentionInputContainer,
              isMinimal && styles.minimalMentionInputContainer,
            ]}
          />
        </View>
      ) : (
        <View style={[styles.preview, isMinimal && styles.minimalPreview]}>
          <MentionTextRenderer
            text={value || "No description yet..."}
            taggedEntities={taggedEntities}
            textStyle={[
              styles.previewText,
              isMinimal && styles.minimalPreviewText,
            ]}
            mentionStyle={styles.mentionText}
          />
        </View>
      )}

      {/* Helper Text */}
      {!isMinimal && !isValid && charCount > 0 && (
        <Text style={styles.helperText}>
          Add at least {minLength - charCount} more characters
        </Text>
      )}

      {!isMinimal && isValid && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.validText}>Description looks good!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  minimalContainer: {
    marginVertical: 0,
    marginTop: -8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  charCount: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    fontFamily: "Manrope-Medium",
  },
  minimalCharCount: {
    fontSize: 13,
    color: "#9CA3AF",
    fontFamily: "Manrope-Medium",
  },
  charCountInvalid: {
    color: "#FF3B30",
  },
  toolbar: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E5E5EA",
  },
  minimalToolbar: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 12,
  },
  toolButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 6,
  },
  // Replaced textInput with specific styles for MentionInput
  inputContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#E5E5EA",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  minimalInputContainer: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  mentionInputContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    minHeight: 150,
  },
  minimalMentionInputContainer: {
    paddingHorizontal: 24,
    paddingVertical: 0,
    minHeight: 200,
  },
  mentionInput: {
    fontSize: 18,
    color: TEXT_COLOR,
    textAlignVertical: "top",
    paddingTop: 0,
  },
  minimalMentionInput: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: "Manrope-Regular",
    color: "#1F2937",
  },
  mentionText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  preview: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#E5E5EA",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 15,
    backgroundColor: "#FAFAFA",
    minHeight: 150,
  },
  minimalPreview: {
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  previewText: {
    fontSize: 14,
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  minimalPreviewText: {
    fontSize: 18,
    lineHeight: 26,
    color: "#1F2937",
    fontFamily: "Manrope-Regular",
  },
  helperText: {
    fontSize: 12,
    color: "#FF3B30",
    marginTop: 8,
  },
  checkmark: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  validText: {
    fontSize: 12,
    color: "#34C759",
    marginLeft: 6,
    fontWeight: "600",
  },
});

export default RichTextEditor;
