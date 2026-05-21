import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, TouchableWithoutFeedback, Platform, ScrollView, Switch } from "react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import CustomDatePicker from "../ui/CustomDatePicker";
import { Ionicons } from "@expo/vector-icons";
import { Eye } from "lucide-react-native";
import SnooLoader from "../ui/SnooLoader";

const ChallengeEditModal = ({ visible, onClose, post, onSave, isLoading }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const [deadline, setDeadline] = useState(null);
  const [showProofsImmediately, setShowProofsImmediately] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize form with post data
  useEffect(() => {
    if (post && visible) {
      setTitle(post.type_data?.title || "");
      setDescription(post.type_data?.description || "");
      setTargetCount(String(post.type_data?.target_count || ""));
      // Deadline lives on post.expires_at, not inside type_data
      setDeadline(post.expires_at ? new Date(post.expires_at) : null);
      // show_proofs_immediately defaults to true if not set
      setShowProofsImmediately(post.type_data?.show_proofs_immediately !== false);
    }
  }, [post, visible]);

  const handleSave = () => {
    const updates = {};

    // Only include changed fields
    if (title.trim() !== post.type_data?.title) {
      updates.title = title.trim();
    }

    if (description.trim() !== post.type_data?.description) {
      updates.description = description.trim();
    }

    if (targetCount) {
      const newTargetCount = parseInt(targetCount, 10);
      const currentTargetCount = post.type_data?.target_count || 0;
      if (newTargetCount !== currentTargetCount) {
        updates.target_count = newTargetCount;
      }
    }

    // Send expires_at (not deadline) — matches the DB column name used by all other post types
    const originalExpiry = post.expires_at
      ? new Date(post.expires_at).getTime()
      : null;
    const newExpiry = deadline ? deadline.getTime() : null;
    if (newExpiry !== originalExpiry) {
      updates.expires_at = deadline ? deadline.toISOString() : null;
    }

    // Send show_proofs_immediately only if it changed
    const originalShowProofs = post.type_data?.show_proofs_immediately !== false;
    if (showProofsImmediately !== originalShowProofs) {
      updates.show_proofs_immediately = showProofsImmediately;
    }

    onSave(updates);
  };

  const handleDateConfirm = ({ startDate }) => {
    setShowDatePicker(false);
    if (startDate) {
      setDeadline(startDate);
    }
  };

  const clearDate = () => {
    setDeadline(null);
    // Clearing deadline resets proofs to immediately visible (same as create form)
    setShowProofsImmediately(true);
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

  const currentTargetCount = post?.type_data?.target_count || 0;
  const isValidTargetCount =
    !targetCount || parseInt(targetCount, 10) >= currentTargetCount;
  const isValid = title.trim().length > 0 && isValidTargetCount;

  // Toggle is only interactive when a deadline is set
  const hasDeadline = !!deadline;

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
                <Text style={styles.title}>Edit Challenge</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#1D1D1F" />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {/* Title Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Challenge title..."
                    placeholderTextColor="#999"
                    maxLength={100}
                  />
                  <Text style={styles.charCount}>{title.length}/100</Text>
                </View>

                {/* Description Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={styles.textInput}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe the challenge..."
                    placeholderTextColor="#999"
                    multiline
                    maxLength={500}
                  />
                  <Text style={styles.charCount}>{description.length}/500</Text>
                </View>

                {/* Target Count (for progress challenges) */}
                {post?.type_data?.challenge_type === "progress" && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Target Count</Text>
                    <TextInput
                      style={[
                        styles.input,
                        !isValidTargetCount && styles.inputError,
                      ]}
                      value={targetCount}
                      onChangeText={setTargetCount}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                    />
                    {!isValidTargetCount && (
                      <Text style={styles.errorText}>
                        Must be ≥ {currentTargetCount} (current value)
                      </Text>
                    )}
                    <Text style={styles.helperText}>
                      Can only increase, not decrease
                    </Text>
                  </View>
                )}

                {/* Deadline */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Deadline (Optional)</Text>
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
                      {formatDate(deadline)}
                    </Text>
                  </TouchableOpacity>
                  {deadline && (
                    <TouchableOpacity
                      onPress={clearDate}
                      style={styles.clearButton}
                    >
                      <Text style={styles.clearButtonText}>Clear Deadline</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Show Proofs Immediately toggle — only enabled when deadline exists */}
                <View style={[styles.toggleRow, !hasDeadline && styles.toggleRowDisabled]}>
                  <View style={styles.toggleLeft}>
                    <View style={styles.toggleIconBox}>
                      <Eye
                        size={18}
                        color={hasDeadline ? "#1D1D1F" : "#B0B8C1"}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={styles.toggleTextBlock}>
                      <Text style={[styles.toggleTitle, !hasDeadline && styles.toggleTitleDisabled]}>
                        Show proofs immediately
                      </Text>
                      <Text style={styles.toggleSubtitle}>
                        {hasDeadline
                          ? showProofsImmediately
                            ? "Submissions visible as they're approved"
                            : "Hidden from others until challenge ends"
                          : "Set a deadline to hide proofs until it ends"}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={showProofsImmediately}
                    onValueChange={hasDeadline ? setShowProofsImmediately : undefined}
                    disabled={!hasDeadline}
                    trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>

                <CustomDatePicker
                  visible={showDatePicker}
                  onClose={() => setShowDatePicker(false)}
                  startDate={deadline ? new Date(deadline) : null}
                  onConfirm={handleDateConfirm}
                  minDate={new Date()}
                  singleMode={true}
                />
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
    maxHeight: "85%",
    ...SHADOWS.large,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
  },
  title: {
    fontSize: 20,
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
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1D1D1F",
    fontFamily: FONTS.regular,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#1D1D1F",
    fontFamily: FONTS.regular,
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#DC2626",
  },
  charCount: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "right",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
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
    fontFamily: FONTS.regular,
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
  // ── Show Proofs toggle ──────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#F8F9FB",
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  toggleRowDisabled: {
    opacity: 0.45,
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
    marginRight: 12,
  },
  toggleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  toggleTextBlock: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#1D1D1F",
    marginBottom: 2,
  },
  toggleTitleDisabled: {
    color: "#8E8E93",
  },
  toggleSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#8E8E93",
    lineHeight: 16,
  },
  // ── Action buttons ──────────────────────────────────────────────────────────
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
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

export default ChallengeEditModal;
