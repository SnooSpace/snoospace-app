import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { launchImageLibraryAsync, MediaTypeOptions } from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { uploadImage } from "../../api/cloudinary";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const PRIMARY = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT = COLORS.textSecondary;
const BG = COLORS.surface;

const { width, height } = Dimensions.get("window");

export default function HeadsEditorModal({
  visible,
  initialHeads = [],
  onCancel,
  onSave,
  maxHeads = 3,
}) {
  const [heads, setHeads] = useState(() => initialHeads.map((h) => ({ ...h })));
  const [saving, setSaving] = useState(false);
  const [linkingIndex, setLinkingIndex] = useState(-1);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState("");

  useEffect(() => {
    if (visible) {
      // Haptics on appear
      HapticsService.triggerImpactLight();

      setHeads(initialHeads.map((h) => ({ ...h })));
      setLinkingIndex(-1);
      setMemberQuery("");
      setMemberResults([]);
      setMemberLoading(false);
      setMemberSearchError("");
    }
  }, [initialHeads, visible]);

  const canAdd = useMemo(
    () => heads.length < maxHeads,
    [heads.length, maxHeads]
  );

  const setPrimary = (idx) => {
    setHeads((prev) => prev.map((h, i) => ({ ...h, is_primary: i === idx })));
    HapticsService.triggerSelection();
  };

  const updateField = (idx, key, value) => {
    setHeads((prev) =>
      prev.map((h, i) => {
        if (i !== idx) return h;
        let nextValue = value;
        if (key === "phone") {
          nextValue = (value || "").replace(/[^0-9]/g, "").slice(0, 10);
        }
        return { ...h, [key]: nextValue };
      })
    );
  };

  const addHead = () => {
    if (!canAdd) return;
    setHeads((prev) => [
      ...prev,
      {
        name: "",
        is_primary: prev.length === 0,
        email: null,
        phone: null,
        profile_pic_url: null,
        member_id: null,
        member_username: null,
        member_photo_url: null,
      },
    ]);
    HapticsService.triggerSelection();
  };

  const removeHead = (idx) => {
    const next = heads.filter((_, i) => i !== idx);
    // ensure exactly one primary
    if (next.length > 0 && !next.some((h) => h.is_primary))
      next[0].is_primary = true;
    setHeads(next);
    HapticsService.triggerImpactMedium();
  };

  const clearLink = (idx) => {
    updateField(idx, "member_id", null);
    updateField(idx, "member_username", null);
    updateField(idx, "member_photo_url", null);
  };

  const openLinkModal = (idx) => {
    setLinkingIndex(idx);
    const existingUsername = heads[idx]?.member_username || "";
    setMemberQuery(existingUsername);
    setMemberResults([]);
    setMemberSearchError("");
    if (existingUsername && existingUsername.trim().length >= 2) {
      searchMembers(existingUsername.trim());
    }
  };

  const closeLinkModal = () => {
    setLinkingIndex(-1);
    setMemberQuery("");
    setMemberResults([]);
    setMemberLoading(false);
    setMemberSearchError("");
  };

  const searchMembers = async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMemberResults([]);
      setMemberSearchError("");
      return;
    }
    try {
      setMemberLoading(true);
      setMemberSearchError("");
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }
      const res = await apiGet(
        `/members/search?q=${encodeURIComponent(trimmed)}`,
        15000,
        token
      );
      const results = res?.results || [];
      setMemberResults(results);
      if (results.length === 0) {
        setMemberSearchError("No members found");
      }
    } catch (error) {
      setMemberResults([]);
      setMemberSearchError(error?.message || "Failed to search members");
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (linkingIndex === -1) return;
    if (!memberQuery || memberQuery.trim().length < 2) {
      setMemberResults([]);
      setMemberSearchError("");
      return;
    }
    const handler = setTimeout(() => {
      searchMembers(memberQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [memberQuery, linkingIndex]);

  const handleSelectMember = (member) => {
    if (linkingIndex === -1) return;
    updateField(linkingIndex, "member_id", member.id);
    updateField(
      linkingIndex,
      "member_username",
      member.username || member.full_name || member.name || "member"
    );
    updateField(
      linkingIndex,
      "member_photo_url",
      member.profile_photo_url || null
    );
    closeLinkModal();
    HapticsService.triggerSelection();
  };

  const pickAvatar = async (idx) => {
    try {
      const picker = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (picker.canceled || !picker.assets || !picker.assets[0]) return;
      const url = await uploadImage(picker.assets[0].uri);
      updateField(idx, "profile_pic_url", url);
    } catch (e) {
      Alert.alert("Upload failed", e?.message || "Could not upload");
    }
  };

  const validate = (list) => {
    if (!list || list.length === 0) return "Add at least one head";
    if (list.filter((h) => h.is_primary).length !== 1)
      return "Exactly one head must be primary";
    for (const h of list) {
      if (!h.name || !h.name.trim()) return "Head name is required";
      if (h.phone && !/^\d{10}$/.test(h.phone))
        return "Head phone numbers must be 10 digits";
    }
    return null;
  };

  // Sanitize function to normalize data for comparison
  const sanitizeHead = (h) => {
    const phoneDigits = h.phone
      ? h.phone.replace(/[^0-9]/g, "").slice(0, 10)
      : null;
    const memberIdValue =
      h.member_id != null ? parseInt(h.member_id, 10) : null;
    const memberId =
      Number.isFinite(memberIdValue) && memberIdValue > 0
        ? memberIdValue
        : null;
    return {
      name: h.name ? h.name.trim() : "",
      is_primary: h.is_primary || false,
      email: h.email && h.email.trim() ? h.email.trim() : null,
      phone: phoneDigits && phoneDigits.length === 10 ? phoneDigits : null,
      profile_pic_url: h.profile_pic_url || null,
      member_id: memberId,
      member_username:
        h.member_username && h.member_username.trim()
          ? h.member_username.trim()
          : null,
      member_photo_url: h.member_photo_url || null,
    };
  };

  // Check if changes exist by comparing sanitized versions
  const hasChanges = useMemo(() => {
    const sanitizedCurrent = heads.map(sanitizeHead);
    const sanitizedInitial = initialHeads.map(sanitizeHead);
    return (
      JSON.stringify(sanitizedCurrent) !== JSON.stringify(sanitizedInitial)
    );
  }, [heads, initialHeads]);

  const handleSave = async () => {
    const sanitizedHeads = heads.map((h) => {
      const phoneDigits = h.phone
        ? h.phone.replace(/[^0-9]/g, "").slice(0, 10)
        : null;
      const memberIdValue =
        h.member_id != null ? parseInt(h.member_id, 10) : null;
      const memberId =
        Number.isFinite(memberIdValue) && memberIdValue > 0
          ? memberIdValue
          : null;
      return {
        ...h,
        name: h.name ? h.name.trim() : "",
        email: h.email ? h.email.trim() : null,
        phone: phoneDigits && phoneDigits.length === 10 ? phoneDigits : null,
        member_id: memberId,
        member_username: h.member_username ? h.member_username.trim() : null,
        member_photo_url: h.member_photo_url || null,
      };
    });
    const err = validate(sanitizedHeads);
    if (err) {
      HapticsService.triggerNotificationWarning();
      Alert.alert("Invalid", err);
      return;
    }
    if (saving) return;
    try {
      setSaving(true);
      await onSave(sanitizedHeads);
      HapticsService.triggerNotificationSuccess();
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.avatar} onPress={() => pickAvatar(index)}>
        {item.profile_pic_url ? (
          <Image
            source={{ uri: item.profile_pic_url }}
            style={styles.avatarImg}
          />
        ) : (
          <Ionicons name="person-circle-outline" size={48} color={LIGHT_TEXT} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <TextInput
          value={item.name}
          onChangeText={(t) => updateField(index, "name", t)}
          placeholder="Head name"
          placeholderTextColor={LIGHT_TEXT}
          style={styles.input}
        />
        <TextInput
          value={item.email || ""}
          onChangeText={(t) => updateField(index, "email", t)}
          placeholder="Email (optional)"
          placeholderTextColor={LIGHT_TEXT}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          value={item.phone || ""}
          onChangeText={(t) => updateField(index, "phone", t)}
          placeholder="Phone (optional)"
          placeholderTextColor={LIGHT_TEXT}
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={10}
        />
        {item.member_id && (
          <Text style={styles.linkedInfo}>
            Linked to @{item.member_username || item.member_id}
          </Text>
        )}
        <View style={styles.linkActions}>
          <TouchableOpacity
            onPress={() => openLinkModal(index)}
            style={styles.linkButton}
          >
            <Ionicons name="person-add-outline" size={16} color={PRIMARY} />
            <Text style={styles.linkButtonText}>
              {item.member_id ? "Change linked member" : "Link member profile"}
            </Text>
          </TouchableOpacity>
          {item.member_id && (
            <TouchableOpacity
              onPress={() => clearLink(index)}
              style={styles.unlinkButton}
            >
              <Text style={styles.unlinkText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.inline}>
          <TouchableOpacity
            onPress={() => setPrimary(index)}
            style={[
              styles.primaryBtn,
              item.is_primary ? styles.primaryActive : null,
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                item.is_primary ? { color: "#fff" } : null,
              ]}
            >
              {item.is_primary ? "Primary" : "Set as Primary"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeHead(index)}
            style={styles.removeBtn}
          >
            <Text style={styles.removeText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
        statusBarTranslucent={true}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Edit Community Heads</Text>
              <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={heads}
              keyExtractor={(_, i) => String(i)}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              style={styles.list}
            />

            <View style={styles.footer}>
              <TouchableOpacity
                disabled={!canAdd}
                onPress={addHead}
                style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}
              >
                <Ionicons name="add" size={20} color={PRIMARY} />
                <Text style={styles.addText}>Add Head</Text>
              </TouchableOpacity>
              <Text style={styles.limitText}>Up to {maxHeads} heads</Text>
            </View>

            <View style={styles.actions}>
              {/* Cancel Button - Ghost Style */}
              <TouchableOpacity
                onPress={onCancel}
                style={styles.ghostButton}
                activeOpacity={0.7}
              >
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </TouchableOpacity>

              {/* Save Button - Primary Gradient Support */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !hasChanges}
                style={[
                  styles.gradientButtonContainer,
                  !hasChanges && styles.disabledButtonContainer,
                ]}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    hasChanges ? COLORS.primaryGradient : ["#E5E5EA", "#E5E5EA"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.gradientButtonText,
                        !hasChanges && styles.disabledButtonText,
                      ]}
                    >
                      Save Changes
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={linkingIndex !== -1}
        transparent
        animationType="slide"
        onRequestClose={closeLinkModal}
      >
        <View style={styles.linkOverlay}>
          <View style={[styles.linkSheet, SHADOWS.md]}>
            <View style={styles.linkHeader}>
              <Text style={styles.linkTitle}>Link Member Profile</Text>
              <TouchableOpacity onPress={closeLinkModal} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={memberQuery}
              onChangeText={setMemberQuery}
              placeholder="Search members by name or username"
              placeholderTextColor={LIGHT_TEXT}
              style={styles.linkSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {memberQuery.trim().length < 2 ? (
              <Text style={styles.linkHint}>
                Type at least 2 characters to search
              </Text>
            ) : memberLoading ? (
              <View style={styles.linkLoading}>
                <ActivityIndicator size="small" color={PRIMARY} />
              </View>
            ) : memberResults.length === 0 ? (
              <Text style={styles.linkHint}>
                {memberSearchError || "No members found"}
              </Text>
            ) : (
              <FlatList
                data={memberResults}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.linkResultItem}
                    onPress={() => handleSelectMember(item)}
                  >
                    {item.profile_photo_url ? (
                      <Image
                        source={{ uri: item.profile_photo_url }}
                        style={styles.linkResultAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.linkResultAvatar,
                          styles.linkResultAvatarPlaceholder,
                        ]}
                      >
                        <Ionicons name="person" size={18} color={LIGHT_TEXT} />
                      </View>
                    )}
                    <View style={styles.linkResultMeta}>
                      <Text style={styles.linkResultName} numberOfLines={1}>
                        {item.full_name || item.name || "Member"}
                      </Text>
                      <Text style={styles.linkResultUsername} numberOfLines={1}>
                        @{item.username || "user"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={LIGHT_TEXT}
                    />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => (
                  <View style={styles.linkSeparator} />
                )}
                style={styles.linkResults}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
  },
  modalContainer: {
    backgroundColor: BG,
    borderRadius: 24, // Increased Radius
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    ...SHADOWS.md, // Elevation
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20, // Larger Title
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  list: {
    maxHeight: height * 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start", // Align top for multiline
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5", // Sublime separator
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    marginTop: 4,
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: TEXT_COLOR,
    marginBottom: 8,
    fontSize: 15,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  linkedInfo: {
    fontSize: 13,
    color: LIGHT_TEXT,
    marginBottom: 4,
  },
  linkActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: BORDER_RADIUS.s,
    backgroundColor: "rgba(25, 118, 210, 0.05)", // Subtle tint
  },
  linkButtonText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 13,
  },
  unlinkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  unlinkText: {
    color: COLORS.error,
    fontWeight: "600",
    fontSize: 13,
  },
  primaryBtn: {
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
  },
  primaryActive: {
    backgroundColor: PRIMARY,
  },
  primaryText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 12,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeText: {
    color: COLORS.error,
    fontWeight: "600",
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  addText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 15,
  },
  limitText: {
    color: LIGHT_TEXT,
    fontSize: 13,
  },
  actions: {
    padding: 20,
    flexDirection: "row",
    gap: 16,
    justifyContent: "flex-end",
    backgroundColor: BG, // Ensure opaque over list
  },
  ghostButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  ghostButtonText: {
    color: PRIMARY,
    fontWeight: "600",
    fontSize: 16,
  },
  gradientButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    minWidth: 120,
  },
  disabledButtonContainer: {
    shadowOpacity: 0,
    elevation: 0,
  },
  gradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gradientButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  disabledButtonText: {
    color: "#8E8E93",
  },

  // Link Modal Styles
  linkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  linkSheet: {
    backgroundColor: BG,
    borderRadius: 20,
    padding: 20,
    maxHeight: "80%",
    width: "100%",
  },
  linkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  linkTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  linkSearchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: TEXT_COLOR,
    fontSize: 16,
  },
  linkHint: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: "center",
    marginTop: 16,
  },
  linkLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
  linkResults: {
    marginTop: 12,
    maxHeight: 300,
  },
  linkResultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  linkResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  linkResultAvatarPlaceholder: {
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  linkResultMeta: {
    flex: 1,
  },
  linkResultName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  linkResultUsername: {
    fontSize: 14,
    color: LIGHT_TEXT,
  },
  linkSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});
