import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Easing,
  Pressable,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  User,
  Camera,
  Link,
  Trash2,
  X,
  PlusCircle,
  ChevronRight,
  ArrowLeft,
} from "lucide-react-native";
import { useCrop } from "../../../components/MediaCrop";
import { LinearGradient } from "expo-linear-gradient";
import { uploadImage } from "../../../api/cloudinary";
import { apiGet } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import { updateCommunityHeads } from "../../../api/communities";
import {
  COLORS,
  SHADOWS,
  BORDER_RADIUS,
  SPACING,
  FONTS,
} from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import SnooLoader from "../../../components/ui/SnooLoader";

const PRIMARY = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT = COLORS.textSecondary;
const BG = "#FFFFFF";

const { width } = Dimensions.get("window");

export default function CommunityHostsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { pickAndCrop } = useCrop();
  const [croppingIndex, setCroppingIndex] = useState(-1);

  // Hide parent tab bar on mount, restore on unmount
  useEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: "none" },
    });
    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation]);

  const { initialHeads = [], maxHeads = 10 } = route.params || {};

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    type: null, // "import" | "options" | "unlink"
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

  const canAdd = useMemo(
    () => heads.length < maxHeads,
    [heads.length, maxHeads],
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
          }'s profile photo as this host's avatar?`,
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
    if (!list || list.length === 0) return "Add at least one host";
    if (list.filter((h) => h.is_primary).length !== 1)
      return "Exactly one host must be primary";
    for (const h of list) {
      if (!h.name || !h.name.trim()) return "Host name is required";
      if (h.phone && !/^\d{10}$/.test(h.phone))
        return "Host phone numbers must be 10 digits";
    }
    return null;
  };

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
      await updateCommunityHeads(sanitizedHeads);
      HapticsService.triggerNotificationSuccess();
      navigation.goBack();
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update hosts");
    } finally {
      setSaving(false);
    }
  };

  const renderItem = useCallback(
    ({ item, index }) => {
      const hostLabel = `HOST #${index + 1}`;

      return (
        <View style={styles.hostSection}>
          {/* Host Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleLabel}>{hostLabel}</Text>
            {heads.length > 1 && (
              <TouchableOpacity
                onPress={() => removeHead(index)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color={COLORS.error} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.hostCardBody}>
            {/* Avatar & Host Name row */}
            <View style={styles.avatarRowContainer}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={() => pickAvatar(index, !!item.profile_pic_url)}
                activeOpacity={0.9}
              >
                {item.profile_pic_url ? (
                  <Image
                    source={{ uri: item.profile_pic_url }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={22} color={LIGHT_TEXT} />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Camera size={10} color={COLORS.textPrimary} />
                </View>
              </TouchableOpacity>

              <View style={styles.nameInputContainer}>
                <Text style={styles.fieldLabel}>HOST NAME</Text>
                <TextInput
                  value={item.name}
                  onChangeText={(t) => updateField(index, "name", t)}
                  placeholder="Host Name"
                  placeholderTextColor={LIGHT_TEXT}
                  style={styles.inputName}
                />
              </View>
            </View>

            {/* Email & Phone fields in horizontal layout */}
            <View style={styles.formRow}>
              <View style={styles.formColumn}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <TextInput
                  value={item.email || ""}
                  onChangeText={(t) => updateField(index, "email", t)}
                  placeholder="Email (optional)"
                  placeholderTextColor={LIGHT_TEXT}
                  style={styles.inputField}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
                <TextInput
                  value={item.phone || ""}
                  onChangeText={(t) => updateField(index, "phone", t)}
                  placeholder="Phone (optional)"
                  placeholderTextColor={LIGHT_TEXT}
                  style={styles.inputField}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
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
                  activeOpacity={0.7}
                >
                  <View style={styles.linkIconContainer}>
                    <Link size={14} color={COLORS.primary} />
                  </View>
                  <Text style={styles.linkButtonText}>Link Member Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    },
    [
      heads,
      updateField,
      pickAvatar,
      openLinkModal,
      confirmUnlink,
      removeHead,
    ],
  );

  const renderFooter = useCallback(
    () => (
      <View style={styles.footerContainer}>
        <TouchableOpacity
          onPress={addHead}
          style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}
          disabled={!canAdd}
          activeOpacity={0.7}
        >
          <View style={styles.addIconContainer}>
            <PlusCircle size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.addText}>Add Community Host</Text>
        </TouchableOpacity>
        <Text style={styles.limitText}>
          {heads.length}/{maxHeads} hosts used
        </Text>
      </View>
    ),
    [addHead, canAdd, heads.length, maxHeads],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {linkingIndex === -1 ? (
        <View style={styles.screenContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Community Hosts</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={heads}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            ListFooterComponent={renderFooter}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 95 },
            ]}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />

          {/* Absolute Positioned Premium Floating Pill Save Changes Button */}
          <View
            style={[
              styles.floatingActionContainer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !hasChanges}
              style={[
                styles.saveButton,
                (!hasChanges || saving) && styles.disabledSaveButton,
              ]}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  hasChanges && !saving
                    ? COLORS.primaryGradient
                    : ["#E2E8F0", "#E2E8F0"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <SnooLoader color="#FFFFFF" size="small" />
                ) : (
                  <Text
                    style={[
                      styles.saveButtonText,
                      (!hasChanges || saving) && styles.disabledSaveButtonText,
                    ]}
                  >
                    Save Changes
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.linkContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.linkHeaderInline}>
              <TouchableOpacity
                onPress={closeLinkModal}
                style={styles.backButtonInline}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={22} color={TEXT_COLOR} />
              </TouchableOpacity>
              <Text style={styles.linkTitleInline}>Link Member Profile</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 24 }}>
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Search members by name or username"
                placeholderTextColor={LIGHT_TEXT}
                style={styles.linkSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
              />

              {memberQuery.trim().length < 2 ? (
                <Text
                  style={[
                    styles.linkHint,
                    { fontFamily: FONTS.medium, marginTop: 24 },
                  ]}
                >
                  Type at least 2 characters to search
                </Text>
              ) : memberLoading ? (
                <View style={styles.linkLoading}>
                  <SnooLoader size="small" color={PRIMARY} />
                </View>
              ) : memberResults.length === 0 ? (
                <Text style={[styles.linkHint, { marginTop: 24 }]}>
                  {memberSearchError || "No members found"}
                </Text>
              ) : (
                <View style={styles.resultsContainer}>
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
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

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
        <Pressable
          style={styles.alertOverlay}
          onPress={() =>
            setAlertConfig((prev) => ({ ...prev, visible: false }))
          }
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
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
                    style={styles.alertBtnCancel}
                    onPress={() =>
                      setAlertConfig((prev) => ({ ...prev, visible: false }))
                    }
                  >
                    <Text style={styles.alertBtnTextCancel}>NO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.alertBtnPrimary}
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
                    style={styles.alertBtnCancel}
                    onPress={() =>
                      setAlertConfig((prev) => ({ ...prev, visible: false }))
                    }
                  >
                    <Text style={styles.alertBtnTextCancel}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.alertBtnDestructive}
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
                    style={styles.alertStackBtnPrimary}
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
                    style={styles.alertStackBtnDestructive}
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
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    color: TEXT_COLOR,
    fontFamily: FONTS.black,
  },
  list: {
    flex: 1,
    backgroundColor: BG,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  // Host Section Styles
  hostSection: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitleLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
    letterSpacing: 1,
  },
  hostCardBody: {
    gap: 16,
  },
  avatarRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F5F9",
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  nameInputContainer: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: LIGHT_TEXT,
    letterSpacing: 0.8,
  },
  inputName: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: "#F8FAFC",
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  formColumn: {
    flex: 1,
    gap: 6,
  },
  inputField: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: "#F8FAFC",
  },
  // Link Section Styles in Host
  linkedSection: {
    marginTop: 4,
  },
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#EEF2F6",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  linkedBadge: {
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  linkedLabel: {
    fontSize: 12,
    color: COLORS.primary,
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
    fontFamily: FONTS.semiBold,
  },
  actionTextDestructive: {
    fontSize: 13,
    color: COLORS.error,
    fontFamily: FONTS.semiBold,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  linkIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  linkButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
  // List Footer
  footerContainer: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
    alignItems: "center",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    width: "100%",
  },
  addIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  addText: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  limitText: {
    fontSize: 12,
    color: LIGHT_TEXT,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  // Floating Actions Footer
  floatingActionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  saveButton: {
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  disabledSaveButton: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    height: 50,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  disabledSaveButtonText: {
    color: "#94A3B8",
  },
  // Link Section Styles
  linkContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  linkHeaderInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  backButtonInline: {
    padding: 4,
  },
  linkTitleInline: {
    fontSize: 20,
    color: TEXT_COLOR,
    fontFamily: FONTS.black,
  },
  linkSearchInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    color: TEXT_COLOR,
    fontSize: 14,
    fontFamily: FONTS.medium,
    marginTop: 16,
    marginBottom: 4,
  },
  linkHint: {
    fontSize: 14,
    color: LIGHT_TEXT,
    textAlign: "center",
    marginTop: 32,
    fontFamily: FONTS.regular,
  },
  linkLoading: {
    paddingVertical: 20,
    alignItems: "center",
  },
  resultsContainer: {
    marginTop: 12,
    flex: 1,
  },
  linkResults: {
    flex: 1,
  },
  linkResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 8,
  },
  linkResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
  },
  linkResultAvatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  linkResultMeta: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  linkResultName: {
    fontSize: 14,
    color: TEXT_COLOR,
    fontFamily: FONTS.semiBold,
    marginBottom: 2,
  },
  linkResultUsername: {
    fontSize: 12,
    color: LIGHT_TEXT,
    fontFamily: FONTS.medium,
  },
  linkSeparator: {
    height: 0,
  },
  // Alert Modal Styles
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.l,
  },
  alertContainer: {
    width: "100%",
    maxWidth: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    ...SHADOWS.md,
    position: "relative",
  },
  alertTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    textAlign: "center",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  alertActionsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  alertBtnCancel: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  alertBtnTextCancel: {
    fontSize: 14,
    color: "#475569",
    fontFamily: FONTS.semiBold,
  },
  alertBtnPrimary: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  alertBtnTextPrimary: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  alertBtnDestructive: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.error,
  },
  alertBtnTextDestructive: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  alertActionsStack: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  alertStackBtnPrimary: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  alertStackBtnTextBlue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  alertStackBtnDestructive: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  alertStackBtnTextRed: {
    fontSize: 14,
    color: COLORS.error,
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
