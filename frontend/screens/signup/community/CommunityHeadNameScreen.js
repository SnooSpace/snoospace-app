/**
 * CommunityHeadNameScreen.js
 *
 * Combined head name + profile photo screen for Organization and Individual
 * community types. Each head card lets the user enter a name, role, AND pick
 * a photo inline — matching the CollegeHeadsScreen pattern exactly.
 *
 * Uploads all photos on "Next" then navigates straight to CommunityPhone,
 * skipping the now-redundant CommunityHeadProfilePic screen.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { exitSignupToAuthGate } from "../../../utils/signupNavigation";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
  ImageBackground,
  Image,
  Pressable,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { XCircle, PlusCircle, Camera, Link, User, X, ChevronRight } from "lucide-react-native";
import { apiGet } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import {
  COLORS,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";
import { useCrop } from "../../../components/MediaCrop";
import { uploadImage } from "../../../api/cloudinary";

const AVATAR_SIZE = 64;

// ---------------------------------------------------------------------------
// HeadEntry — single card with avatar, name, and role
// ---------------------------------------------------------------------------
const HeadEntry = ({
  index,
  name,
  role,
  photoUri,
  linkedMember,
  onNameChange,
  onRoleChange,
  onRemove,
  onPickPhoto,
  onLinkMember,
  onUnlinkMember,
  isRequired,
  showRemove,
  isIndividual,
}) => {
  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);

  const nameScale = useSharedValue(1);
  const roleScale = useSharedValue(1);

  const animatedNameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
  }));
  const animatedRoleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: roleScale.value }],
  }));

  useEffect(() => {
    nameScale.value = withSpring(nameFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [nameFocused]);

  useEffect(() => {
    roleScale.value = withSpring(roleFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [roleFocused]);

  return (
    <View style={styles.headEntry}>
      {/* Entry header row */}
      <View style={styles.entryHeader}>
        <Text style={styles.entryLabel}>
          {isRequired
            ? isIndividual
              ? "You (Required)"
              : "Organizer 1 (Required)"
            : `Organizer ${index + 1} (Optional)`}
        </Text>
        {showRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <XCircle size={22} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar + inputs row */}
      <View style={styles.entryBody}>
        {/* Avatar picker */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onPickPhoto}
          activeOpacity={0.8}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Camera size={24} color={COLORS.textTertiary || "#999"} strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <View style={styles.cameraBadgeInner}>
              <Camera size={10} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Name + Role inputs */}
        <View style={styles.inputsColumn}>
          <Animated.View style={animatedNameStyle}>
            <TextInput
              style={[styles.input, nameFocused && styles.inputFocused]}
              placeholder={isIndividual ? "Your name" : "Name"}
              placeholderTextColor={COLORS.textSecondary}
              value={name}
              onChangeText={onNameChange}
              autoCapitalize="words"
              editable={!linkedMember}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </Animated.View>

          <Animated.View style={animatedRoleStyle}>
            <TextInput
              style={[styles.input, styles.inputRole, roleFocused && styles.inputFocused]}
              placeholder={isIndividual ? "e.g., Organizer, Host (Optional)" : "Role (Optional)"}
              placeholderTextColor={COLORS.textSecondary}
              value={role}
              onChangeText={onRoleChange}
              autoCapitalize="words"
              onFocus={() => setRoleFocused(true)}
              onBlur={() => setRoleFocused(false)}
            />
          </Animated.View>
        </View>
      </View>

      {/* Link Member Profile row */}
      <View style={styles.linkRow}>
        {linkedMember ? (
          <View style={styles.linkedBadge}>
            <User size={12} color="#4A90D9" />
            <Text style={styles.linkedBadgeText} numberOfLines={1}>
              @{linkedMember.username || linkedMember.full_name || "member"}
            </Text>
            <TouchableOpacity onPress={onUnlinkMember} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={13} color="#4A90D9" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.linkButton} onPress={onLinkMember} activeOpacity={0.7}>
            <Link size={13} color="#4A90D9" />
            <Text style={styles.linkButtonText}>Link member profile</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
const CommunityHeadNameScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    phone,
    secondary_phone,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
    heads: initialHeads,
    sponsor_types,
  } = route.params || {};

  const [params, setParams] = useState({
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    phone,
    secondary_phone,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    sponsor_types,
  });

  const isIndividual = params.community_type === "individual_organizer";

  // Each entry: { name, role, photoUri (local), uploadedUrl (remote), linkedMember (object|null) }
  const initialHeadState = isIndividual
    ? [{ name: "", role: "", photoUri: null, uploadedUrl: null, linkedMember: null }]
    : [
        { name: "", role: "", photoUri: null, uploadedUrl: null, linkedMember: null },
        { name: "", role: "", photoUri: null, uploadedUrl: null, linkedMember: null },
      ];

  const [heads, setHeads] = useState(initialHeadState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Member search / link sheet state
  const [linkingIndex, setLinkingIndex] = useState(-1);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const searchTimeout = useRef(null);
  const searchInputRef = useRef(null);
  // Keep a ref so doSearch always reads the latest token even if params hydrate after mount
  const accessTokenRef = useRef(accessToken || null);
  useEffect(() => {
    if (params.accessToken) accessTokenRef.current = params.accessToken;
  }, [params.accessToken]);

  const { pickAndCrop } = useCrop();

  // Member search helpers — mirrors HeadsEditorModal.searchMembers exactly
  const doSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setMemberResults([]); return; }
    try {
      setMemberLoading(true);
      // Token resolution priority:
      // 1. accessTokenRef (set from route params / draft hydration)
      // 2. getAuthToken() → reads active account from accountManager
      // 3. sessionManager.getActiveSession() → last-resort during signup flow
      let token = accessTokenRef.current;
      if (!token) token = await getAuthToken();
      if (!token) {
        try {
          const { getActiveSession } = require("../../../utils/sessionManager");
          const session = await getActiveSession();
          if (session?.accessToken) token = session.accessToken;
        } catch (_) {}
      }

      console.log("[CommunityHeadName] doSearch token present:", !!token, "length:", token?.length);

      if (!token) {
        console.warn("[CommunityHeadName] No auth token available for member search");
        setMemberResults([]);
        return;
      }

      const res = await apiGet(
        `/members/search?q=${encodeURIComponent(trimmed)}`,
        15000,
        token,
      );
      const results = res?.results || [];
      console.log("[CommunityHeadName] Search results count:", results.length);
      setMemberResults(results);
    } catch (e) {
      console.error("[CommunityHeadName] Member search error:", e?.message, e?.status);
      setMemberResults([]);
    } finally {
      setMemberLoading(false);
    }
  }, []); // no deps — reads token via ref, always fresh

  useEffect(() => {
    if (linkingIndex === -1) return;
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(memberQuery), 350);
    return () => clearTimeout(searchTimeout.current);
  }, [memberQuery, linkingIndex, doSearch]);

  const openLinkSheet = (idx) => {
    setLinkingIndex(idx);
    setMemberQuery("");
    setMemberResults([]);
  };

  const closeLinkSheet = () => {
    setLinkingIndex(-1);
    setMemberQuery("");
    setMemberResults([]);
  };

  const handleSelectMember = (member) => {
    const next = [...heads];
    next[linkingIndex] = {
      ...next[linkingIndex],
      name: member.full_name || member.name || "",
      photoUri: member.profile_photo_url || next[linkingIndex].photoUri,
      uploadedUrl: member.profile_photo_url || null,
      linkedMember: member,
    };
    setHeads(next);
    closeLinkSheet();
  };

  const handleUnlinkMember = (idx) => {
    const next = [...heads];
    next[idx] = { ...next[idx], linkedMember: null, name: "", photoUri: null, uploadedUrl: null };
    setHeads(next);
  };

  // Animation
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const isButtonDisabled = !heads[0].name.trim() || !heads[0].photoUri || isSubmitting;

  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  // ---------------------------------------------------------------------------
  // Draft hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initScreen = async () => {
      try {
        await updateCommunitySignupDraft("CommunityHeadName", {});
      } catch (e) {
        console.log("[CommunityHeadNameScreen] Step update failed:", e.message);
      }

      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // Hydrate heads (name & role; restore uploaded URL as preview)
      if (draftData.heads && draftData.heads.length > 0) {
        const hydrated = draftData.heads.map((h) => ({
          name: h.name || "",
          role: h.role || "",
          photoUri: h.profile_pic_url || null,
          uploadedUrl: h.profile_pic_url || null,
        }));
        // Ensure minimum count
        const minCount = isIndividual ? 1 : 2;
        while (hydrated.length < minCount) {
          hydrated.push({ name: "", role: "", photoUri: null, uploadedUrl: null });
        }
        setHeads(hydrated);
      }

      // Hydrate shared params
      const updatedParams = { ...params };
      let paramChanged = false;
      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "phone", "secondary_phone",
        "community_type", "college_id", "college_name", "college_subtype",
        "club_type", "community_theme", "college_pending", "isStudentCommunity",
        "sponsor_types",
      ];
      keysToHydrate.forEach((key) => {
        if (
          !params[key] &&
          draftData[key] !== undefined &&
          draftData[key] !== null
        ) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });
      if (paramChanged) {
        setParams(updatedParams);
        // Keep ref in sync immediately — don't wait for useEffect
        if (updatedParams.accessToken) {
          accessTokenRef.current = updatedParams.accessToken;
        }
      }
    };
    initScreen();
  }, []);

  // ---------------------------------------------------------------------------
  // Head management helpers
  // ---------------------------------------------------------------------------
  const updateHead = (index, field, value) => {
    const next = [...heads];
    next[index] = { ...next[index], [field]: value };
    setHeads(next);
  };

  const addHead = () => {
    setHeads([...heads, { name: "", role: "", photoUri: null, uploadedUrl: null }]);
  };

  const removeHead = (index) => {
    const minCount = isIndividual ? 1 : 2;
    if (heads.length > minCount) {
      setHeads(heads.filter((_, i) => i !== index));
    }
  };

  const handlePickPhoto = async (index) => {
    try {
      const result = await pickAndCrop("avatar");
      if (result) {
        const next = [...heads];
        next[index] = {
          ...next[index],
          photoUri: result.uri,
          uploadedUrl: null, // mark as needing upload
        };
        setHeads(next);
      }
    } catch (error) {
      console.error("[CommunityHeadNameScreen] Photo pick error:", error);
      Alert.alert("Error", `Failed to pick image: ${error.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Next — upload all local photos in parallel, then navigate to CommunityPhone
  // ---------------------------------------------------------------------------
  const handleNext = async () => {
    if (!heads[0].name.trim() || !heads[0].photoUri) {
      Alert.alert("Required", "Please provide a name and profile photo for the primary head.");
      return;
    }

    setIsSubmitting(true);
    try {
      const validHeads = heads.filter((h) => h.name.trim());

      // Upload any new local photos in parallel
      const uploadedHeads = await Promise.all(
        validHeads.map(async (h, idx) => {
          let picUrl = h.uploadedUrl || null;

          if (h.photoUri && !h.photoUri.startsWith("http")) {
            try {
              picUrl = await uploadImage(h.photoUri, () => {});
            } catch (uploadErr) {
              console.warn(
                `[CommunityHeadNameScreen] Photo upload failed for head ${idx}:`,
                uploadErr.message
              );
              // Non-fatal: continue without photo
            }
          } else if (h.photoUri && h.photoUri.startsWith("http")) {
            picUrl = h.photoUri; // already uploaded remote URL
          }

          return {
            name: h.name.trim(),
            role: h.role.trim() || null,
            is_primary: idx === 0,
            profile_pic_url: picUrl,
          };
        })
      );

      // Primary head photo kept as head_photo_url for legacy compat
      const headPhotoUrl = uploadedHeads[0]?.profile_pic_url || null;

      // Save to draft (marking step as CommunityHeadName, skipping HeadProfilePic)
      try {
        await updateCommunitySignupDraft("CommunityHeadName", {
          heads: uploadedHeads,
          head_photo_url: headPhotoUrl,
        });
      } catch (e) {
        console.log("[CommunityHeadNameScreen] Draft update failed (non-critical):", e.message);
      }

      // Navigate straight to CommunityPhone (skipping CommunityHeadProfilePic)
      navigation.navigate("CommunityPhone", {
        ...params,
        heads: uploadedHeads,
        head_photo_url: headPhotoUrl,
      });
    } catch (err) {
      console.error("[CommunityHeadNameScreen] handleNext error:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      const prevScreen = isIndividual ? "IndividualLocation" : "CommunityLocation";
      navigation.replace(prevScreen, { ...params });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    exitSignupToAuthGate(navigation);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <SignupHeader
            role="Community"
            onBack={handleBack}
            onCancel={() => setShowCancelModal(true)}
          />

          {/* Scrollable content */}
          <ScrollView
            style={styles.contentScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentArea}>
              {/* Title */}
              <View style={styles.headerTitle}>
                <Animated.Text
                  entering={FadeInDown.delay(100).duration(600).springify()}
                  style={styles.mainTitle}
                >
                  Put a face to your community
                </Animated.Text>
                <Animated.Text
                  entering={FadeInDown.delay(200).duration(600).springify()}
                  style={styles.globalHelperText}
                >
                  Members connect better when they know who leads them. Add a photo — it only takes a second.
                </Animated.Text>
              </View>

              {/* Head cards */}
              <Animated.View
                entering={FadeInDown.delay(300).duration(600).springify()}
                style={styles.card}
              >
                <BlurView
                  intensity={60}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cardContent}>
                  {heads.map((head, index) => (
                    <Animated.View
                      key={index}
                      entering={FadeInDown.delay(400 + index * 80)
                        .duration(600)
                        .springify()}
                    >
                      <HeadEntry
                        index={index}
                        name={head.name}
                        role={head.role}
                        photoUri={head.photoUri}
                        onNameChange={(v) => updateHead(index, "name", v)}
                        onRoleChange={(v) => updateHead(index, "role", v)}
                        onRemove={() => removeHead(index)}
                        onPickPhoto={() => handlePickPhoto(index)}
                        isRequired={index === 0}
                        showRemove={isIndividual ? false : index >= 2}
                        isIndividual={isIndividual}
                        linkedMember={head.linkedMember}
                        onLinkMember={() => openLinkSheet(index)}
                        onUnlinkMember={() => handleUnlinkMember(index)}
                      />
                    </Animated.View>
                  ))}

                  {/* Add more button — hidden for Individual organizers */}
                  {!isIndividual && (
                    <TouchableOpacity style={styles.addButton} onPress={addHead} activeOpacity={0.7}>
                      <View style={styles.addButtonIconContainer}>
                        <PlusCircle size={20} color={COLORS.primary} strokeWidth={2.5} />
                      </View>
                      <Text style={styles.addButtonText}>Add Another Organizer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>

              {/* Next button */}
              <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
                <Animated.View
                  entering={FadeInDown.delay(600).duration(600).springify()}
                  style={animatedButtonStyle}
                >
                  <TouchableOpacity
                    style={[
                      styles.nextButtonContainer,
                      isButtonDisabled && styles.disabledButton,
                      { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                    ]}
                    onPress={handleNext}
                    disabled={isButtonDisabled}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={COLORS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextButton}
                    >
                      {isSubmitting ? (
                        <View style={styles.loadingRow}>
                          <SnooLoader
                            size="small"
                            color={COLORS.textInverted}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.buttonText}>Uploading…</Text>
                        </View>
                      ) : (
                        <Text style={styles.buttonText}>Next</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Cancel modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />

        {/* Member search bottom sheet */}
        <Modal
          visible={linkingIndex !== -1}
          transparent
          animationType="fade"
          onRequestClose={closeLinkSheet}
          statusBarTranslucent
          onShow={() => {
            setTimeout(() => {
              searchInputRef.current?.focus();
            }, 100);
          }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          >
            <Pressable style={styles.sheetOverlay} onPress={closeLinkSheet}>
              <Pressable onPress={(e) => e.stopPropagation()} style={{ width: "100%" }}>
                <View style={styles.sheet}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Link Member Profile</Text>
                    <TouchableOpacity onPress={closeLinkSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={22} color="#1a2d4a" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.sheetHint}>Search by name or @username. Their photo and name will be imported automatically.</Text>
                  <TextInput
                    ref={searchInputRef}
                    style={styles.sheetInput}
                    placeholder="Search members…"
                    placeholderTextColor="#9CA3AF"
                    value={memberQuery}
                    onChangeText={setMemberQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {memberLoading ? (
                    <View style={styles.sheetLoader}>
                      <SnooLoader size="small" color={COLORS.primary} />
                    </View>
                  ) : memberResults.length === 0 && memberQuery.trim().length >= 2 ? (
                    <Text style={styles.sheetEmpty}>No members found</Text>
                  ) : (
                    <FlatList
                      data={memberResults}
                      keyExtractor={(m) => String(m.id)}
                      style={styles.sheetList}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles.sheetItem} onPress={() => handleSelectMember(item)} activeOpacity={0.7}>
                          {item.profile_photo_url ? (
                            <Image source={{ uri: item.profile_photo_url }} style={styles.sheetAvatar} />
                          ) : (
                            <View style={[styles.sheetAvatar, styles.sheetAvatarPlaceholder]}>
                              <User size={18} color="#9CA3AF" />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sheetItemName} numberOfLines={1}>{item.full_name || item.name || "Member"}</Text>
                            <Text style={styles.sheetItemUsername} numberOfLines={1}>@{item.username || "user"}</Text>
                          </View>
                          <ChevronRight size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                      )}
                      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.04)" }} />}
                    />
                  )}
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F7FA",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: { flex: 1 },
  contentScrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentArea: { marginTop: 40 },
  headerTitle: {
    marginBottom: 32,
    paddingRight: 10,
  },
  mainTitle: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: "#1a2d4a",
    marginBottom: 10,
    letterSpacing: -1,
    lineHeight: 38,
  },
  globalHelperText: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#6B7A8D",
    lineHeight: 22,
  },

  /* Card */
  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: { elevation: 0 },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: { padding: 20, gap: 16 },

  /* Head entry card */
  headEntry: {
    backgroundColor: "rgba(116, 173, 242, 0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.18)",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  entryLabel: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#6B7A8D",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  removeButton: { padding: 4 },

  /* Avatar + inputs */
  entryBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  avatarButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "visible",
    position: "relative",
    flexShrink: 0,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(116, 173, 242, 0.4)",
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cameraBadgeInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#4A90D9",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Inputs column */
  inputsColumn: { flex: 1, gap: 10 },
  input: {
    height: 48,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    color: "#1a2d4a",
  },
  inputRole: {
    height: 44,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },

  /* Add button */
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 12,
  },
  addButtonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#4A90D9",
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
  },

  /* Next button */
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  disabledButton: { opacity: 0.6, shadowOpacity: 0 },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  /* Link row inside each head card */
  linkRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(74, 144, 217, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 144, 217, 0.2)",
  },
  linkButtonText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#4A90D9",
  },
  linkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "rgba(74, 144, 217, 0.12)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 144, 217, 0.3)",
    maxWidth: "80%",
  },
  linkedBadgeText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#4A90D9",
    flexShrink: 1,
  },

  /* Member search bottom sheet */
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: "90%",
    minHeight: 280,
    width: "100%",
    ...SHADOWS.xl,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: "#1a2d4a",
  },
  sheetHint: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7A8D",
    marginBottom: 14,
    lineHeight: 18,
  },
  sheetInput: {
    height: 48,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#1a2d4a",
    marginBottom: 12,
  },
  sheetLoader: {
    paddingVertical: 24,
    alignItems: "center",
  },
  sheetEmpty: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
  },
  sheetList: { maxHeight: 280 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  sheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sheetAvatarPlaceholder: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetItemName: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#1a2d4a",
  },
  sheetItemUsername: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7A8D",
  },
});

export default CommunityHeadNameScreen;
