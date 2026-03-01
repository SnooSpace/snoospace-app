import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, TouchableWithoutFeedback, Platform, ScrollView } from "react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import SnooLoader from "../ui/SnooLoader";

const PollEditModal = ({ visible, onClose, post, onSave, isLoading }) => {
  const [question, setQuestion] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize form with post data
  useEffect(() => {
    if (post && visible) {
      setQuestion(post.type_data?.question || "");
      setExpiresAt(post.expires_at ? new Date(post.expires_at) : null);
    }
  }, [post, visible]);

  const handleSave = () => {
    const updates = {};

    // Only include changed fields
    if (question.trim() !== post.type_data?.question) {
      updates.question = question.trim();
    }

    if (expiresAt) {
      const originalExpiry = post.expires_at
        ? new Date(post.expires_at).getTime()
        : null;
      const newExpiry = expiresAt.getTime();
      if (originalExpiry !== newExpiry) {
        updates.expires_at = expiresAt.toISOString();
      }
    }

    onSave(updates);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpiresAt(selectedDate);
    }
  };

  const clearDate = () => {
    setExpiresAt(null);
  };

  const formatDate = (date) => {
    if (!date) return "No deadline";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isValid = question.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Edit Poll</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#1D1D1F" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {/* Question Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Question</Text>
                  <TextInput
                    style={styles.textInput}
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="Enter your poll question..."
                    placeholderTextColor="#999"
                    multiline
                    maxLength={200}
                  />
                  <Text style={styles.charCount}>{question.length}/200</Text>
                </View>

                {/* Deadline */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Deadline</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color="#5B6B7C"
                    />
                    <Text style={styles.dateButtonText}>
                      {formatDate(expiresAt)}
                    </Text>
                  </TouchableOpacity>
                  {expiresAt && (
                    <TouchableOpacity
                      onPress={clearDate}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>Clear Deadline</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={expiresAt || new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </ScrollView>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.saveButton,
                    (!isValid || isLoading) && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!isValid || isLoading}
                >
                  {isLoading ? (
                    <SnooLoader size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.saveButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    maxHeight: "80%",
    ...SHADOWS.large,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1D1D1F",
    fontFamily: FONTS.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 8,
    fontFamily: FONTS.medium,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1D1D1F",
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "right",
    marginTop: 4,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 15,
    color: "#1D1D1F",
    flex: 1,
  },
  clearButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  clearButtonText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: "#F2F2F7",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
    fontFamily: FONTS.semiBold,
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  saveButtonDisabled: {
    backgroundColor: "#B0D4FF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
});

export default PollEditModal;
