import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../api/client";
import { getAuthToken } from "../api/auth";
import { globalSearch } from "../api/search";
import MentionSearchDropdown from "./MentionSearchDropdown";

const COLORS = {
  primary: "#5f27cd",
  textDark: "#1e1e1e",
  textLight: "#6c757d",
  background: "#FFFFFF",
  border: "#E5E5EA",
};

const MentionInput = ({
  value = "",
  onChangeText,
  placeholder = "Write a caption...",
  placeholderTextColor = COLORS.textLight,
  style,
  inputStyle,
  inputContainerStyle,
  dropdownStyle,
  maxLength = 2000,
  onTaggedEntitiesChange,
}) => {
  const [text, setText] = useState(value);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef(null);
  const cursorPositionRef = useRef(0);

  useEffect(() => {
    if (onChangeText) {
      onChangeText(text);
    }
  }, [text, onChangeText]);

  useEffect(() => {
    if (onTaggedEntitiesChange) {
      onTaggedEntitiesChange(taggedEntities);
    }
  }, [taggedEntities, onTaggedEntitiesChange]);

  const searchEntities = async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const token = await getAuthToken();
      if (!token) {
        setSearchResults([]);
        return;
      }
      // Use global search to get both members and communities
      const res = await globalSearch(trimmed, { limit: 20, offset: 0 });
      const allResults = res?.results || [];
      // Include both members and communities for mentions
      const entityResults = allResults.filter(
        (r) => r.type === "member" || r.type === "community",
      );
      // Filter out null/undefined and ensure each item has required properties
      const validResults = entityResults
        .filter((e) => e != null && typeof e === "object" && e.id)
        .map((e) => ({
          ...e,
          type: e.type, // Keep original type (member or community)
          profile_photo_url: e.profile_photo_url || e.logo_url || null,
          full_name: e.full_name || e.name || "",
          name: e.name || e.full_name || "",
          username: e.username || "",
        }));
      setSearchResults(validResults);
    } catch (error) {
      console.error("Error searching entities:", error);
      // Don't show error to user, just silently fail
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleTextChange = (newText) => {
    setText(newText);

    const currentCursorPosition = cursorPositionRef.current ?? 0;
    if (currentCursorPosition <= 0) {
      setShowSearch(false);
      setSearchQuery("");
      return;
    }

    const boundedCursorPos = Math.min(currentCursorPosition, newText.length);
    const charBeforeCursor = newText[boundedCursorPos - 1];

    // If cursor sits on whitespace or we don't have a valid char, mention is done
    if (!charBeforeCursor || /\s/.test(charBeforeCursor)) {
      setShowSearch(false);
      setSearchQuery("");
      return;
    }

    // Find @ mentions in the text up to the cursor
    const atIndex = newText.lastIndexOf("@", boundedCursorPos - 1);
    if (atIndex === -1 || atIndex >= boundedCursorPos) {
      setShowSearch(false);
      setSearchQuery("");
      return;
    }

    const mentionSlice = newText.substring(atIndex + 1, boundedCursorPos);
    if (/\s/.test(mentionSlice)) {
      setShowSearch(false);
      setSearchQuery("");
      return;
    }

    const afterAt = newText.substring(atIndex + 1);
    const spaceIndex = afterAt.indexOf(" ");
    const newlineIndex = afterAt.indexOf("\n");
    const endIndex =
      spaceIndex !== -1 && newlineIndex !== -1
        ? Math.min(spaceIndex, newlineIndex)
        : spaceIndex !== -1
          ? spaceIndex
          : newlineIndex !== -1
            ? newlineIndex
            : afterAt.length;

    const mentionQuery = afterAt.substring(0, endIndex);
    if (mentionQuery.length >= 1) {
      setSearchQuery(mentionQuery);
      setShowSearch(true);
      if (mentionQuery.length >= 2) {
        searchEntities(mentionQuery);
      } else {
        setSearchResults([]);
      }
    } else {
      setShowSearch(false);
      setSearchQuery("");
    }
  };

  const handleSelectionChange = (event) => {
    const position = event.nativeEvent.selection.start;
    cursorPositionRef.current = position;
    setCursorPosition(position);
  };

  const selectEntity = (entity) => {
    const atIndex = text.lastIndexOf("@", cursorPosition);
    if (atIndex !== -1) {
      const beforeAt = text.substring(0, atIndex);
      const afterAt = text.substring(atIndex + 1);
      const spaceIndex = afterAt.indexOf(" ");
      const newlineIndex = afterAt.indexOf("\n");
      const endIndex =
        spaceIndex !== -1 && newlineIndex !== -1
          ? Math.min(spaceIndex, newlineIndex)
          : spaceIndex !== -1
            ? spaceIndex
            : newlineIndex !== -1
              ? newlineIndex
              : afterAt.length;

      const mentionText = `@${entity.username || entity.full_name || entity.name} `;
      const newText = beforeAt + mentionText + afterAt.substring(endIndex);
      setText(newText);
      setShowSearch(false);
      setSearchQuery("");
      const newCursorPos = beforeAt.length + mentionText.length;
      cursorPositionRef.current = newCursorPos;
      setCursorPosition(newCursorPos);
      requestAnimationFrame(() => {
        if (inputRef.current?.setNativeProps) {
          inputRef.current.setNativeProps({
            selection: { start: newCursorPos, end: newCursorPos },
          });
        }
      });

      // Add to tagged entities if not already present
      const isAlreadyTagged = taggedEntities.some(
        (e) => e.id === entity.id && e.type === entity.type,
      );
      if (!isAlreadyTagged) {
        setTaggedEntities([
          ...taggedEntities,
          {
            id: entity.id,
            type: entity.type || "member",
            username: entity.username,
            name: entity.full_name || entity.name,
          },
        ]);
      }

      // Focus back on input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  const removeTag = (entityId, entityType) => {
    setTaggedEntities(
      taggedEntities.filter(
        (e) => !(e.id === entityId && e.type === entityType),
      ),
    );
    // Remove @mention from text
    const username = taggedEntities.find(
      (e) => e.id === entityId && e.type === entityType,
    )?.username;
    if (username) {
      const mention = `@${username}`;
      const newText = text.replace(
        new RegExp(mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        "",
      );
      setText(newText);
    }
  };

  const renderTag = (entity, index) => {
    const username = entity.username || entity.name;
    return (
      <View key={`${entity.id}-${entity.type}-${index}`} style={styles.tagChip}>
        <Text style={styles.tagText}>@{username}</Text>
        <TouchableOpacity
          onPress={() => removeTag(entity.id, entity.type)}
          style={styles.tagRemove}
        >
          <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inputContainer, inputContainerStyle]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, inputStyle]}
          value={text}
          onChangeText={handleTextChange}
          onSelectionChange={handleSelectionChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
        />
        {taggedEntities.length > 0 && (
          <View style={styles.tagsContainer}>
            {taggedEntities.map((entity, index) => renderTag(entity, index))}
          </View>
        )}
      </View>

      <MentionSearchDropdown
        visible={showSearch}
        results={searchResults}
        loading={isSearching}
        onSelect={selectEntity}
        style={dropdownStyle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  inputContainer: {
    // Removed default border and background to allow for "borderless" look
  },
  input: {
    paddingHorizontal: 0, // Let parent handle padding
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textDark,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  tagText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
  tagRemove: {
    padding: 2,
  },
});

export default MentionInput;
