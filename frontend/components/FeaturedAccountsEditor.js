import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Image,
  Alert,
  Animated,
  Platform,
  Keyboard,
  ScrollView,
} from "react-native";
import {
  Mic,
  Music,
  Briefcase,
  Store,
  MessageSquare,
  User,
  Trash2,
  Plus,
  X,
  Search,
  ChevronRight,
  PenLine,
  ArrowLeft,
  Camera,
  Sparkles,
  Guitar,
  Disc3,
  MicVocal,
  Ribbon,
} from "lucide-react-native";
import { useCrop } from "./MediaCrop";
import { LinearGradient } from "expo-linear-gradient";
import { uploadPerformerPhoto } from "../api/upload";
import { searchAccounts as searchAccountsAPI } from "../api/search";
import SnooLoader from "./ui/SnooLoader";

const TOKENS = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  surface: "#F5F8FF",
  background: "#FFFFFF",
  border: "#E6ECF8",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  error: "#EF4444",
  success: "#10B981",
  radius: { xs: 8, sm: 12, md: 14, lg: 16, xl: 24 },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
  },
  fonts: {
    regular: "Manrope-Regular",
    medium: "Manrope-Medium",
    semibold: "Manrope-SemiBold",
    bold: "BasicCommercial-Bold",
  },
};

/**
 * FeaturedAccountsEditor - Add performers, DJs, sponsors, vendors
 * Supports: account search/linking OR manual entry
 */
const FeaturedAccountsEditor = ({ accounts = [], onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState(null); // 'search' or 'manual'
  const [role, setRole] = useState("performer");
  const { pickAndCrop } = useCrop();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Manual entry state
  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualPhoto, setManualPhoto] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const roles = [
    { value: "performer", label: "Performer", icon: Guitar },
    { value: "dj", label: "DJ", icon: Disc3 },
    { value: "sponsor", label: "Sponsor", icon: Briefcase },
    { value: "vendor", label: "Vendor", icon: Store },
    { value: "speaker", label: "Speaker", icon: MicVocal },
    { value: "chief_guest", label: "Chief Guest", icon: Ribbon },
  ];

  const startAdd = () => {
    setShowModal(true);
    setMode(null);
    setRole("performer");
    setSearchQuery("");
    setSearchResults([]);
    setManualName("");
    setManualDescription("");
    setManualPhoto(null);
  };

  const handleSearchAccounts = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await searchAccountsAPI(query);

      if (response?.results) {
        setSearchResults(response.results);
      }
    } catch (error) {
      console.error("Error searching accounts:", error);
      Alert.alert("Error", "Failed to search accounts");
    } finally {
      setSearching(false);
    }
  };

  const linkAccount = (account) => {
    const newAccount = {
      linked_account_id: account.id,
      linked_account_type: account.type,
      role,
      display_name: null,
      description: null,
      profile_photo_url: null,
      order: accounts.length,
      // Store account data for display
      _accountData: {
        name: account.display_name || account.name,
        username: account.username,
        photo: account.profile_photo_url || account.logo_url,
      },
    };

    onChange([...accounts, newAccount]);
    setShowModal(false);
  };

  const pickPhoto = async () => {
    try {
      const result = await pickAndCrop("avatar");
      if (result) {
        setManualPhoto(result.uri);
      }
    } catch (e) {
      console.log("Photo crop cancelled or failed", e);
    }
  };

  const addManual = async () => {
    if (!manualName.trim()) {
      Alert.alert("Required", "Please enter a name");
      return;
    }

    // Upload photo if provided
    let photoUrl = null;
    let cloudinaryId = null;

    if (manualPhoto) {
      try {
        const uploadResult = await uploadPerformerPhoto(manualPhoto);
        photoUrl = uploadResult?.url;
        cloudinaryId = uploadResult?.public_id;
      } catch (error) {
        Alert.alert("Warning", "Failed to upload photo, continuing without it");
      }
    }

    const newAccount = {
      linked_account_id: null,
      linked_account_type: null,
      role,
      display_name: manualName.trim(),
      description: manualDescription.trim() || null,
      profile_photo_url: photoUrl,
      cloudinary_public_id: cloudinaryId,
      order: accounts.length,
    };

    onChange([...accounts, newAccount]);
    setShowModal(false);
  };

  const removeAccount = (index) => {
    const updated = accounts.filter((_, i) => i !== index);
    const reordered = updated.map((a, i) => ({ ...a, order: i }));
    onChange(reordered);
  };

  const renderAccount = ({ item, index }) => {
    // Check multiple sources for name/photo:
    // 1. _accountData (set when adding new linked account in UI)
    // 2. account_name/account_photo (from database JOIN in getCommunityEvents)
    // 3. display_name/profile_photo_url (for manual entries)
    const accountName =
      item._accountData?.name || item.account_name || item.display_name;
    const accountPhoto =
      item._accountData?.photo || item.account_photo || item.profile_photo_url;
    const isLinked = !!item.linked_account_id;

    return (
      <View style={styles.accountCard}>
        <View style={styles.accountInfo}>
          {accountPhoto && (
            <Image source={{ uri: accountPhoto }} style={styles.accountPhoto} />
          )}
          {!accountPhoto && (
            <View style={[styles.accountPhoto, styles.photoPlaceholder]}>
              <User size={24} color={TOKENS.textMuted} />
            </View>
          )}

          <View style={styles.accountDetails}>
            <Text style={styles.accountName}>{accountName}</Text>
            <Text style={styles.accountRole}>
              {roles.find((r) => r.value === item.role)?.label}
              {isLinked && " • Linked Account"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => removeAccount(index)}
          style={styles.actionIconButton}
        >
          <Trash2 size={18} color={TOKENS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 2️⃣ Strengthen Section Header Hierarchy */}
      <View style={styles.sectionHeaderNew}>
        <View style={styles.sectionHeaderTitleRow}>
          <View style={styles.sectionHeaderIconContainer}>
            <Sparkles size={24} color={TOKENS.primary} strokeWidth={2} />
          </View>
          <Text style={styles.sectionHeaderTitle}>
            Partners & Performers
            <Text style={styles.sectionHeaderOptional}> • (Optional)</Text>
          </Text>
        </View>
        <Text style={styles.sectionHeaderCounter}>
          {accounts.length} added • Performers, DJs, Sponsors, Speakers, etc.
        </Text>
        <Text style={styles.sectionHeaderHelper}>
          Highlight key people, performers, or contributors for your event.
        </Text>
      </View>

      {accounts.length > 0 && (
        <FlatList
          data={accounts}
          renderItem={renderAccount}
          keyExtractor={(item, index) => index.toString()}
          scrollEnabled={false}
          style={{ marginBottom: 15 }}
        />
      )}

      {accounts.length < 5 ? (
        <TouchableOpacity
          style={styles.actionTile}
          onPress={startAdd}
          activeOpacity={0.8}
        >
          <Plus size={22} color={TOKENS.primary} strokeWidth={2.5} />
          <Text style={styles.actionTileTitle}>Add Person or Brand</Text>
        </TouchableOpacity>
      ) : null}

      {/* Add Account Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                paddingBottom:
                  Platform.OS === "ios"
                    ? keyboardHeight + 40
                    : keyboardHeight + 24,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={28} color={TOKENS.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Role Selection */}
              <View style={styles.section}>
                <Text style={styles.label}>Role </Text>
                <View style={styles.rolesGrid}>
                  {roles.map((r) => {
                    const IconComp = r.icon;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[
                          styles.roleButton,
                          role === r.value && styles.roleButtonSelected,
                        ]}
                        onPress={() => setRole(r.value)}
                      >
                        <IconComp
                          size={18}
                          color={role === r.value ? "#FFFFFF" : TOKENS.primary}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.roleText,
                            role === r.value && styles.roleTextSelected,
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Mode Selection */}
              {!mode && (
                <View style={styles.section}>
                  <Text style={styles.label}>Add Method</Text>
                  <TouchableOpacity
                    style={styles.modeButton}
                    onPress={() => setMode("search")}
                  >
                    <Search size={22} color={TOKENS.primary} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modeTitle}>
                        Link Existing Account
                      </Text>
                      <Text style={styles.modeSubtitle}>
                        Search for DJs, sponsors, venues
                      </Text>
                    </View>
                    <ChevronRight
                      size={20}
                      color={TOKENS.textMuted}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modeButton}
                    onPress={() => setMode("manual")}
                  >
                    <PenLine size={22} color={TOKENS.primary} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modeTitle}>Manual Entry</Text>
                      <Text style={styles.modeSubtitle}>
                        For performers without accounts
                      </Text>
                    </View>
                    <ChevronRight
                      size={20}
                      color={TOKENS.textMuted}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Search Mode */}
              {mode === "search" && (
                <View style={styles.section}>
                  <TouchableOpacity
                    onPress={() => setMode(null)}
                    style={styles.backButton}
                  >
                    <ArrowLeft
                      size={18}
                      color={TOKENS.primary}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.backText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Search Accounts</Text>
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      handleSearchAccounts(text);
                    }}
                    placeholder="Search by name or username..."
                    placeholderTextColor={TOKENS.textMuted}
                  />

                  {searching && (
                    <SnooLoader
                      style={{ marginTop: 20 }}
                      color={TOKENS.primary}
                    />
                  )}

                  {searchResults.map((result) => (
                    <TouchableOpacity
                      key={`${result.type}-${result.id}`}
                      style={styles.searchResult}
                      onPress={() => linkAccount(result)}
                    >
                      <Image
                        source={{
                          uri: result.profile_photo_url || result.logo_url,
                        }}
                        style={styles.resultPhoto}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>
                          {result.display_name || result.name}
                        </Text>
                        <Text style={styles.resultUsername}>
                          @{result.username}
                        </Text>
                      </View>
                      <Text style={styles.resultType}>{result.type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Manual Mode */}
              {mode === "manual" && (
                <View style={styles.section}>
                  <TouchableOpacity
                    onPress={() => setMode(null)}
                    style={styles.backButton}
                  >
                    <ArrowLeft
                      size={18}
                      color={TOKENS.primary}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.backText}>Back</Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Photo • (Optional)</Text>
                  <TouchableOpacity
                    style={styles.photoUpload}
                    onPress={pickPhoto}
                    activeOpacity={0.8}
                  >
                    {manualPhoto ? (
                      <Image
                        source={{ uri: manualPhoto }}
                        style={styles.uploadedPhoto}
                      />
                    ) : (
                      <View
                        style={{
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <User
                          size={32}
                          color={TOKENS.textMuted}
                          strokeWidth={1.5}
                        />
                      </View>
                    )}
                    <View style={styles.cameraIconBadge}>
                      <Camera size={14} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.label}>Name </Text>
                  <TextInput
                    style={styles.input}
                    value={manualName}
                    onChangeText={setManualName}
                    placeholder="Full name..."
                    placeholderTextColor={TOKENS.textMuted}
                  />

                  <Text style={styles.label}>Description • (Optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={manualDescription}
                    onChangeText={setManualDescription}
                    placeholder="Brief bio or description..."
                    placeholderTextColor={TOKENS.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={addManual}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={TOKENS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveButtonGradient}
                    >
                      <Text style={styles.saveButtonText}>Add Account</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  sectionHeaderNew: {
    marginBottom: 0,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionHeaderIconContainer: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 22,
    color: TOKENS.textPrimary,
  },
  sectionHeaderCounter: {
    fontFamily: TOKENS.fonts.medium,
    fontSize: 13,
    color: TOKENS.textPrimary,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeaderHelper: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  surfaceContainer: {
    backgroundColor: "#F4F7FB",
    borderRadius: 24,
    padding: 20,
    marginTop: 16,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  accountInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  accountPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  photoPlaceholder: {
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  accountDetails: {
    flex: 1,
    paddingRight: 12,
  },
  accountName: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.textPrimary,
  },
  accountRole: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: TOKENS.textSecondary,
    marginTop: 2,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  actionTile: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginTop: 12, // Gap from list to button if list is present
  },
  actionTileTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.primary,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  modalTitle: {
    fontFamily: TOKENS.fonts.bold,
    fontSize: 22,
    color: "#111827",
  },
  sectionHeaderOptional: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 14,
    color: "#9CA3AF",
  },
  closeButton: {
    padding: 4,
  },
  section: {
    // padding: 20, removed internal padding since modalContent already pads
  },
  label: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
    marginTop: 20,
  },
  rolesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6ECF8",
    backgroundColor: "#F9FAFB",
  },
  roleButtonSelected: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  roleText: {
    marginLeft: 6,
    fontFamily: TOKENS.fonts.medium,
    fontSize: 14,
    color: TOKENS.textSecondary,
  },
  roleTextSelected: {
    color: "#FFFFFF",
    fontFamily: TOKENS.fonts.semibold,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  modeTitle: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.textPrimary,
    marginLeft: 12,
  },
  modeSubtitle: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 13,
    color: TOKENS.textSecondary,
    marginLeft: 12,
    marginTop: 2,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 4,
  },
  backText: {
    marginLeft: 6,
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 15,
    color: TOKENS.primary,
  },
  searchInput: {
    fontFamily: TOKENS.fonts.medium,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TOKENS.textPrimary,
    backgroundColor: "#F9FAFB",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    marginTop: 10,
  },
  resultPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  resultName: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 14,
    color: TOKENS.textPrimary,
  },
  resultUsername: {
    fontFamily: TOKENS.fonts.regular,
    fontSize: 13,
    color: TOKENS.textSecondary,
    marginTop: 2,
  },
  resultType: {
    fontFamily: TOKENS.fonts.semibold,
    fontSize: 11,
    color: TOKENS.primary,
    textTransform: "capitalize",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoUpload: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
    marginTop: 12,
  },
  uploadedPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: TOKENS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    fontFamily: TOKENS.fonts.medium,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TOKENS.textPrimary,
    backgroundColor: "#F9FAFB",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
    paddingTop: 16,
  },
  saveButton: {
    borderRadius: 16,
    marginTop: 36,
  },
  saveButtonGradient: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontFamily: TOKENS.fonts.semibold,
    color: "#FFFFFF",
    fontSize: 16,
  },
});

export default FeaturedAccountsEditor;
