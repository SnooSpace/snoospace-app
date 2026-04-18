import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  Keyboard,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  X,
  Search,
  GraduationCap,
  MapPin,
  ChevronRight,
  Trash2,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import SnooLoader from "../ui/SnooLoader";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

/**
 * CollegePickerModal — Search-based college/campus picker for members.
 *
 * Props:
 * - visible: boolean
 * - onClose: () => void
 * - onSelect: ({ campusId, collegeId, collegeName, campusName, campusCity }) => void
 * - onClear: () => void  — remove college selection
 * - currentCampusId: string | null
 */
export default function CollegePickerModal({
  visible,
  onClose,
  onSelect,
  onClear,
  currentCampusId,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchTimeout = useRef(null);
  const inputRef = useRef(null);

  // Debounced search
  const handleSearch = useCallback(
    (text) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (text.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }

      searchTimeout.current = setTimeout(async () => {
        setLoading(true);
        setSearched(true);
        try {
          const token = await getAuthToken();
          const data = await apiGet(
            `/colleges?search=${encodeURIComponent(text.trim())}&limit=20`,
            10000,
            token
          );
          // The search returns campus-level results with college info
          setResults(data?.results || data?.colleges || []);
        } catch (err) {
          console.error("[CollegePickerModal] Search failed:", err);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 350);
    },
    []
  );

  useEffect(() => {
    if (visible) {
      setQuery("");
      setResults([]);
      setSearched(false);
      // Focus input after modal animation
      setTimeout(() => inputRef.current?.focus(), 400);
    }
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [visible]);

  if (!visible) return null;

  const handleSelectItem = (item) => {
    Keyboard.dismiss();
    onSelect({
      campusId: item.campus_id || item.id,
      collegeId: item.college_id,
      collegeName: item.college_name || item.name,
      campusName: item.campus_name,
      campusCity: item.city || item.campus_city,
    });
    onClose();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      activeOpacity={0.7}
      onPress={() => handleSelectItem(item)}
    >
      {/* College Icon */}
      <View style={styles.resultIcon}>
        <GraduationCap size={18} color="#2962FF" strokeWidth={1.8} />
      </View>

      {/* Info */}
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.college_name || item.name}
        </Text>
        {item.campus_name && (
          <View style={styles.campusRow}>
            <MapPin size={11} color="#6B7280" strokeWidth={2} />
            <Text style={styles.resultCampus} numberOfLines={1}>
              {item.campus_name}
              {item.city || item.campus_city
                ? `, ${item.city || item.campus_city}`
                : ""}
            </Text>
          </View>
        )}
      </View>

      <ChevronRight size={16} color="#D1D5DB" strokeWidth={2} />
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheetContainer}>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Select Your College</Text>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <View style={styles.searchContainer}>
                <Search size={18} color="#9CA3AF" strokeWidth={2} />
                <TextInput
                  ref={inputRef}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={handleSearch}
                  placeholder="Search for your college..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setQuery("");
                      setResults([]);
                      setSearched(false);
                    }}
                  >
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Remove current college button was removed as requested */}

              {/* Results Container */}
              <View style={styles.resultsContainer}>
                {loading ? (
                  <View style={styles.loadingWrap}>
                    <SnooLoader size="medium" />
                  </View>
                ) : (
                  <FlatList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item, idx) =>
                      String(item.campus_id || item.id || idx)
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={
                      searched ? (
                        <View style={styles.emptyWrap}>
                          <GraduationCap
                            size={32}
                            color="#D1D5DB"
                            strokeWidth={1.5}
                          />
                          <Text style={styles.emptyTitle}>No colleges found</Text>
                          <Text style={styles.emptySubtext}>
                            Try a different name or abbreviation
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.emptyWrap}>
                          <Search size={32} color="#D1D5DB" strokeWidth={1.5} />
                          <Text style={styles.emptySubtext}>
                            Start typing to search for your college
                          </Text>
                        </View>
                      )
                    }
                  />
                )}
              </View>
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
  sheetContainer: {
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
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 18,
    color: "#0F172A",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#0F172A",
    padding: 0,
  },

  listContent: {
    paddingBottom: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#0F172A",
    lineHeight: 20,
  },
  campusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  resultCampus: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#6B7280",
    flexShrink: 1,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#374151",
  },
  emptySubtext: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
