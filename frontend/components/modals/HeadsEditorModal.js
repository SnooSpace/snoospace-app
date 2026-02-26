import React, { useMemo, useState, useEffect, useCallback } from "react";
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
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from "react-native";
import {
  User,
  Camera,
  Link,
  Trash2,
  X,
  PlusCircle,
  ChevronRight,
  Star,
} from "lucide-react-native";
import { useCrop } from "../MediaCrop";
import { LinearGradient } from "expo-linear-gradient";
import { uploadImage } from "../../api/cloudinary";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import {
  COLORS,
  SHADOWS,
  BORDER_RADIUS,
  SPACING,
  FONTS,
} from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const PRIMARY = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT = COLORS.textSecondary;
const BG = COLORS.surface;

const { width, height } = Dimensions.get("window");

const AnimatedStar = ({ isPrimary, onPress }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const glow = React.useRef(new Animated.Value(isPrimary ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isPrimary ? 1.2 : 1,
        useNativeDriver: true,
        friction: 4,
        tension: 40,
      }),
      Animated.timing(glow, {
        toValue: isPrimary ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 40,
      }).start();
    });
  }, [isPrimary]);

  return (
    <TouchableOpacity
      style={[styles.starContainer, isPrimary && styles.starContainerPrimary]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isPrimary ? (
        <LinearGradient
          colors={["#FFF1F2", "#FFE4E6"]}
          style={styles.starGradient}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Star size={18} color="#E11D48" fill="#E11D48" />
          </Animated.View>
        </LinearGradient>
      ) : (
        <Animated.View style={{ transform: [{ scale }] }}>
          <Star size={18} color="#D1D5DB" />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

export default function HeadsEditorModal({
  visible,
  initialHeads = [],
  onCancel,
  onSave,
  maxHeads = 3,
}) {
  const { pickAndCrop } = useCrop();
  const [croppingIndex, setCroppingIndex] = useState(-1);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: null, // "import" | "options"
    title: "",
    message: "",
    data: null, // Context data (e.g., member info, index)
  });

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
    [heads.length, maxHeads],
  );

  const setPrimary = useCallback(
    (idx) => {
      setHeads((prev) => prev.map((h, i) => ({ ...h, is_primary: i === idx })));
      HapticsService.triggerSelection();
    },
    [setHeads],
  );

  const updateField = useCallback(
    (idx, key, value) => {
      setHeads((prev) =>
        prev.map((h, i) => {
          if (i !== idx) return h;
          let nextValue = value;
          if (key === "phone") {
            nextValue = (value || "").replace(/[^0-9]/g, "").slice(0, 10);
          }
          return { ...h, [key]: nextValue };
        }),
      );
    },
    [setHeads],
  );

  const addHead = useCallback(() => {
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
  }, [canAdd, setHeads]);

  const removeHead = useCallback(
    (idx) => {
      setHeads((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        // ensure exactly one primary
        if (next.length > 0 && !next.some((h) => h.is_primary)) {
          next[0].is_primary = true;
        }
        return next;
      });
      HapticsService.triggerImpactMedium();
    },
    [setHeads],
  );

  const clearLink = useCallback(
    (idx) => {
      updateField(idx, "member_id", null);
      updateField(idx, "member_username", null);
      updateField(idx, "member_photo_url", null);
    },
    [updateField],
  );

  const openLinkModal = useCallback(
    (idx) => {
      setLinkingIndex(idx);
      const existingUsername = heads[idx]?.member_username || "";
      setMemberQuery(existingUsername);
      setMemberResults([]);
      setMemberSearchError("");
      if (existingUsername && existingUsername.trim().length >= 2) {
        searchMembers(existingUsername.trim());
      }
    },
    [heads, searchMembers],
  );

  const closeLinkModal = useCallback(() => {
    setLinkingIndex(-1);
    setMemberQuery("");
    setMemberResults([]);
    setMemberLoading(false);
    setMemberSearchError("");
  }, []);

  const searchMembers = useCallback(async (query) => {
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
        token,
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
  }, []);

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
  }, [memberQuery, linkingIndex, searchMembers]);

  const handleSelectMember = useCallback(
    (member) => {
      if (linkingIndex === -1) return;
      const idx = linkingIndex;
      updateField(idx, "member_id", member.id);
      updateField(
        idx,
        "member_username",
        member.username || member.full_name || member.name || "member",
      );
      updateField(idx, "member_photo_url", member.profile_photo_url || null);
      closeLinkModal();
      HapticsService.triggerSelection();

      // Prompt to auto-import profile pic if the linked member has one
      if (member.profile_photo_url) {
        setAlertConfig({
          visible: true,
          type: "import",
          title: "Import Profile Photo",
          message: `Use ${
            member.full_name || member.name || member.username || "this member"
          }'s profile photo as this head's avatar?`,
          data: { index: idx, photoUrl: member.profile_photo_url },
        });
      }
    },
    [linkingIndex, updateField, closeLinkModal],
  );

  const doCropAndUpload = useCallback(
    async (idx) => {
      try {
        setCroppingIndex(idx);
        const result = await pickAndCrop("avatar");
        setCroppingIndex(-1);
        if (!result) return;
        const url = await uploadImage(result.uri);
        updateField(idx, "profile_pic_url", url);
        HapticsService.triggerNotificationSuccess();
      } catch (e) {
        setCroppingIndex(-1);
        Alert.alert("Upload failed", e?.message || "Could not upload");
      }
    },
    [updateField, pickAndCrop],
  );

  const removeAvatar = useCallback(
    (idx) => {
      updateField(idx, "profile_pic_url", null);
      HapticsService.triggerImpactMedium();
    },
    [updateField],
  );

  const pickAvatar = useCallback(
    (idx, hasPhoto) => {
      if (hasPhoto) {
        setAlertConfig({
          visible: true,
          type: "options",
          title: "Profile Photo",
          message: "What would you like to do?",
          data: { index: idx },
        });
      } else {
        doCropAndUpload(idx);
      }
    },
    [doCropAndUpload],
  );

  const confirmUnlink = useCallback((idx) => {
    setAlertConfig({
      visible: true,
      type: "unlink",
      title: "Unlink Profile",
      message:
        "Are you sure you want to remove the link to this member profile?",
      data: { index: idx },
    });
  }, []);

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

  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={styles.card}>
        <AnimatedStar
          isPrimary={item.is_primary}
          onPress={() => setPrimary(index)}
        />

        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => pickAvatar(index, !!item.profile_pic_url)}
              activeOpacity={0.9}
            >
              {item.profile_pic_url ? (
                <Image
                  source={{
                    uri: item.profile_pic_url,
                  }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={24} color={LIGHT_TEXT} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Camera size={12} color={COLORS.textPrimary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.cardContent}>
            <TextInput
              value={item.name}
              onChangeText={(t) => updateField(index, "name", t)}
              placeholder="Head Name"
              placeholderTextColor={LIGHT_TEXT}
              style={styles.inputName}
            />

            <View style={styles.inputGroup}>
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
            </View>

            {/* Linked Member Section */}
            <View style={styles.linkedSection}>
              {item.member_id ? (
                <View style={styles.linkedRow}>
                  <View style={styles.linkedBadge}>
                    <Text style={styles.linkedLabel}>
                      Linked to @{item.member_username || item.member_id}
                    </Text>
                  </View>
                  <View style={styles.linkedActions}>
                    <TouchableOpacity onPress={() => openLinkModal(index)}>
                      <Text style={styles.actionTextNeutral}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmUnlink(index)}>
                      <Text style={styles.actionTextDestructive}>Unlink</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => openLinkModal(index)}
                  style={styles.linkButton}
                >
                  <Link size={14} color={TEXT_COLOR} />
                  <Text style={styles.linkButtonText}>Link Member Profile</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Delete Row */}
            <View style={styles.footerRow}>
              <View /> {/* Spacer */}
              <TouchableOpacity
                onPress={() => removeHead(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    ),
    [
      setPrimary,
      updateField,
      pickAvatar,
      openLinkModal,
      confirmUnlink,
      removeHead,
    ],
  );

  return (
    <>
      <Modal
        visible={visible && croppingIndex === -1}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                <View style={styles.header}>
                  <Text style={styles.title}>Edit Community Heads</Text>
                  <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
                    <X size={24} color={TEXT_COLOR} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={heads}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={renderItem}
                  contentContainerStyle={styles.listContent}
                  style={styles.list}
                />

                <View style={styles.footerContainer}>
                  <TouchableOpacity
                    onPress={addHead}
                    style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}
                    disabled={!canAdd}
                    activeOpacity={0.7}
                  >
                    <View style={styles.addIconContainer}>
                      <PlusCircle size={18} color="#6366F1" />
                    </View>
                    <Text style={styles.addText}>Add Community Head</Text>
                  </TouchableOpacity>
                  <Text style={styles.limitText}>
                    {heads.length}/{maxHeads} heads used
                  </Text>
                </View>

                <View style={styles.actionArea}>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || !hasChanges}
                    style={[
                      styles.saveButton,
                      (!hasChanges || saving) && styles.disabledSaveButton,
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={onCancel}
                    style={styles.discardButton}
                  >
                    <Text style={styles.discardButtonText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={linkingIndex !== -1}
        transparent
        animationType="slide"
        onRequestClose={closeLinkModal}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={closeLinkModal}>
          <View style={styles.linkOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.linkSheet, SHADOWS.md]}>
                <View style={styles.linkHeader}>
                  <Text style={styles.linkTitle}>Link Member Profile</Text>
                  <TouchableOpacity
                    onPress={closeLinkModal}
                    style={{ padding: 4 }}
                  >
                    <X size={22} color={TEXT_COLOR} />
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
                            <User size={18} color={LIGHT_TEXT} />
                          </View>
                        )}
                        <View style={styles.linkResultMeta}>
                          <Text style={styles.linkResultName} numberOfLines={1}>
                            {item.full_name || item.name || "Member"}
                          </Text>
                          <Text
                            style={styles.linkResultUsername}
                            numberOfLines={1}
                          >
                            @{item.username || "user"}
                          </Text>
                        </View>
                        <ChevronRight size={18} color={LIGHT_TEXT} />
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Custom Alert Modal */}
      <Modal
        visible={alertConfig.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setAlertConfig((prev) => ({ ...prev, visible: false }))
        }
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback
          onPress={() =>
            setAlertConfig((prev) => ({ ...prev, visible: false }))
          }
        >
          <View style={styles.alertOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.alertContainer}>
                {alertConfig.type === "options" && (
                  <TouchableOpacity
                    style={styles.alertCloseBtn}
                    onPress={() =>
                      setAlertConfig((prev) => ({ ...prev, visible: false }))
                    }
                  >
                    <X size={24} color={TEXT_COLOR} />
                  </TouchableOpacity>
                )}

                <Text style={styles.alertTitle}>{alertConfig.title}</Text>
                <Text style={styles.alertMessage}>{alertConfig.message}</Text>

                {alertConfig.type === "import" && (
                  <View style={styles.alertActionsRow}>
                    <TouchableOpacity
                      style={styles.alertBtn}
                      onPress={() =>
                        setAlertConfig((prev) => ({ ...prev, visible: false }))
                      }
                    >
                      <Text style={styles.alertBtnTextCancel}>NO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.alertBtn}
                      onPress={() => {
                        const { index, photoUrl } = alertConfig.data;
                        updateField(index, "profile_pic_url", photoUrl);
                        HapticsService.triggerNotificationSuccess();
                        setAlertConfig((prev) => ({ ...prev, visible: false }));
                      }}
                    >
                      <Text style={styles.alertBtnTextPrimary}>YES</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {alertConfig.type === "unlink" && (
                  <View style={styles.alertActionsRow}>
                    <TouchableOpacity
                      style={styles.alertBtn}
                      onPress={() =>
                        setAlertConfig((prev) => ({ ...prev, visible: false }))
                      }
                    >
                      <Text style={styles.alertBtnTextCancel}>CANCEL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.alertBtn}
                      onPress={() => {
                        const { index } = alertConfig.data;
                        clearLink(index);
                        setAlertConfig((prev) => ({ ...prev, visible: false }));
                      }}
                    >
                      <Text style={styles.alertBtnTextDestructive}>UNLINK</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {alertConfig.type === "options" && (
                  <View style={styles.alertActionsStack}>
                    <TouchableOpacity
                      style={styles.alertStackBtn}
                      onPress={() => {
                        const { index } = alertConfig.data;
                        setAlertConfig((prev) => ({ ...prev, visible: false }));
                        setTimeout(() => doCropAndUpload(index), 200);
                      }}
                    >
                      <Text style={styles.alertStackBtnTextBlue}>
                        CHANGE PHOTO
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.alertStackBtn}
                      onPress={() => {
                        const { index } = alertConfig.data;
                        removeAvatar(index);
                        setAlertConfig((prev) => ({ ...prev, visible: false }));
                      }}
                    >
                      <Text style={styles.alertStackBtnTextRed}>
                        REMOVE PHOTO
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: BG,
    borderRadius: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    ...SHADOWS.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    fontFamily: FONTS.primary, // BasicCommercial Bold
  },
  list: {
    maxHeight: height * 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  // Card Styles
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    position: "relative",
  },
  starContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  starContainerPrimary: {
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  starGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeader: {
    flexDirection: "row",
    gap: 16,
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#fff",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    gap: 12,
  },
  inputName: {
    fontFamily: FONTS.primary, // BasicCommercial Bold
    fontSize: 16,
    color: TEXT_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingVertical: 8,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 10,
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FONTS.medium, // Manrope Medium
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  linkedSection: {
    marginTop: 4,
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  linkedBadge: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  linkedLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: FONTS.medium,
  },
  linkedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionTextNeutral: {
    fontSize: 13,
    color: TEXT_COLOR,
    fontFamily: FONTS.medium,
  },
  actionTextDestructive: {
    fontSize: 13,
    color: COLORS.error,
    fontFamily: FONTS.medium,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkButtonText: {
    fontSize: 14,
    color: TEXT_COLOR,
    fontFamily: "BasicCommercial-Bold",
    marginLeft: 6,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 12,
  },
  // Footer
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    backgroundColor: "#F8FAFC", // Slate 50
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0", // Slate 200
    ...SHADOWS.sm,
    shadowColor: "#000",
    shadowOpacity: 0.03,
  },
  addIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EFF6FF", // Blue 50 (Muted Sapphire Tint)
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE", // Blue 100
  },
  addText: {
    color: "#475569", // Slate 600
    fontWeight: "600",
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  limitText: {
    fontSize: 12,
    color: LIGHT_TEXT,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  actionArea: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    ...SHADOWS.primaryGlow,
  },
  disabledSaveButton: {
    backgroundColor: "#E5E5EA",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: FONTS.medium,
    fontWeight: "600",
  },
  discardButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  discardButtonText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
  // Link Modal Styles
  linkOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
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
    fontFamily: "BasicCommercial-Black",
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
    fontFamily: FONTS.medium,
  },
  linkHint: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: "center",
    marginTop: 16,
    fontFamily: FONTS.medium,
  },
  linkLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
  linkResults: {
    maxHeight: height * 0.4,
  },
  linkResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  linkResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
  },
  linkResultAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  linkResultMeta: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  linkResultName: {
    fontSize: 15,
    color: TEXT_COLOR,
    fontFamily: "BasicCommercial-Bold",
    marginBottom: 2,
  },
  linkResultUsername: {
    fontSize: 13,
    color: LIGHT_TEXT,
    fontFamily: "Manrope-Medium",
  },
  linkSeparator: {
    height: 1,
    backgroundColor: "#F2F2F7",
  },

  // Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    ...SHADOWS.md,
    position: "relative",
  },
  alertTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary, // BasicCommercial
    color: "#000",
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "700",
  },
  alertMessage: {
    fontSize: 15,
    fontFamily: FONTS.medium, // Manrope
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  alertActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 12,
  },
  alertBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alertBtnTextCancel: {
    fontSize: 14,
    color: COLORS.primary, // Using primary color for consistency with reference
    letterSpacing: 0.5,
    fontFamily: FONTS.semiBold,
  },
  alertBtnTextPrimary: {
    fontSize: 14,
    color: COLORS.primary,
    letterSpacing: 0.5,
    fontFamily: FONTS.semiBold,
  },
  alertBtnTextDestructive: {
    fontSize: 14,
    color: COLORS.error,
    letterSpacing: 0.5,
    fontFamily: FONTS.semiBold,
  },
  alertActionsStack: {
    width: "100%",
    gap: 16,
    alignItems: "center",
  },
  alertStackBtn: {
    paddingVertical: 8,
  },
  alertStackBtnTextBlue: {
    fontSize: 14,
    color: "#007AFF", // Standard blue for action
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: FONTS.semiBold,
  },
  alertStackBtnTextRed: {
    fontSize: 14,
    color: "#d32f2f",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: FONTS.semiBold,
  },
  alertCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
});
