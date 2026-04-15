import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
  SectionList,
  Dimensions,
  Keyboard,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, Search, GraduationCap, Check, ChevronRight, Plus } from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";
import { DEGREE_CATEGORIES } from "../../constants/DegreePresets";

const { height: screenHeight } = Dimensions.get("window");

/**
 * DegreePickerModal
 *
 * Bottom-sheet modal for selecting or typing a Degree / Major.
 * Suggestions filter live as the user types.
 * Tapping a suggestion fills the input — the user can still edit
 * before confirming via the "Use this degree" button.
 *
 * Props:
 *   visible         — boolean
 *   initialValue    — string (pre-fills the input on open)
 *   onConfirm(text) — called with the final degree string when user confirms
 *   onClose()       — called when the modal is dismissed
 */
export default function DegreePickerModal({
  visible,
  initialValue = "",
  onConfirm,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [filteredSections, setFilteredSections] = useState([]);
  const inputRef = useRef(null);

  // Initialise query from prop whenever modal opens
  useEffect(() => {
    if (visible) {
      setQuery(initialValue || "");
      // Build fresh filter
      applyFilter(initialValue || "");
      // Auto-focus after slide-in animation
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [visible]);

  const applyFilter = useCallback((text) => {
    const q = text.trim().toLowerCase();
    if (q.length === 0) {
      // Show all sections
      setFilteredSections(DEGREE_CATEGORIES.map((cat) => ({
        title: cat.label,
        data: cat.items,
      })));
    } else {
      // Filter items across all categories
      const filtered = DEGREE_CATEGORIES
        .map((cat) => ({
          title: cat.label,
          data: cat.items.filter((item) => item.toLowerCase().includes(q)),
        }))
        .filter((cat) => cat.data.length > 0);
      setFilteredSections(filtered);
    }
  }, []);

  const handleChangeText = useCallback((text) => {
    setQuery(text);
    applyFilter(text);
  }, [applyFilter]);

  const handleSelectSuggestion = (degree) => {
    Keyboard.dismiss();
    onConfirm(degree.trim());
    onClose();
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    onConfirm(query.trim());
    onClose();
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  if (!visible) return null;

  const hasQuery = query.trim().length > 0;
  
  const isExactMatch = DEGREE_CATEGORIES.some((cat) =>
    cat.items.some((item) => item.toLowerCase() === query.trim().toLowerCase())
  );

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const isSelected = query.trim().toLowerCase() === item.toLowerCase();
    return (
      <TouchableOpacity
        style={[styles.suggestionItem, isSelected && styles.suggestionItemSelected]}
        activeOpacity={0.7}
        onPress={() => handleSelectSuggestion(item)}
      >
        <GraduationCap
          size={16}
          color={isSelected ? COLORS.primary : "#9CA3AF"}
          strokeWidth={1.8}
          style={{ marginRight: 10 }}
        />
        <Text
          style={[styles.suggestionText, isSelected && styles.suggestionTextSelected]}
          numberOfLines={1}
        >
          {item}
        </Text>
        {isSelected && (
          <Check size={16} color={COLORS.primary} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheet}>
              {/* Handle */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.headerTitle}>Degree / Major</Text>
                  <Text style={styles.headerSubtitle}>Select a preset or type your own</Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Search / Type Input */}
              <View style={styles.searchContainer}>
                <Search size={18} color="#9CA3AF" strokeWidth={2} />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={handleChangeText}
                  placeholder="e.g. B.Tech Computer Science"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleConfirm}
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setQuery("");
                      applyFilter("");
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Confirm button — visible when user has typed something custom that is not an exact preset */}
              {hasQuery && !isExactMatch && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Plus size={15} color={COLORS.primary} strokeWidth={2.5} />
                  <Text style={styles.confirmButtonText} numberOfLines={1}>
                    Use "{query.trim()}"
                  </Text>
                </TouchableOpacity>
              )}

              {/* Suggestions */}
              <SectionList
                sections={filteredSections}
                keyExtractor={(item, idx) => `${item}-${idx}`}
                renderSectionHeader={renderSectionHeader}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <GraduationCap size={32} color="#D1D5DB" strokeWidth={1.5} />
                    <Text style={styles.emptyText}>No matching degrees</Text>
                    <Text style={styles.emptySubtext}>
                      Type your degree above and tap "Use this"
                    </Text>
                  </View>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: screenHeight * 0.92,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 18,
    color: "#0F172A",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#9CA3AF",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#0F172A",
    padding: 0,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: `${COLORS.primary}12`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  confirmButtonText: {
    flex: 1,
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: COLORS.primary,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: "#FFFFFF",
  },
  sectionHeaderText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  suggestionItemSelected: {
    backgroundColor: `${COLORS.primary}08`,
  },
  suggestionText: {
    flex: 1,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#374151",
  },
  suggestionTextSelected: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#374151",
  },
  emptySubtext: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
