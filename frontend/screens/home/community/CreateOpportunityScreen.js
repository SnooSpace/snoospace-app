import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";

import { COLORS } from "../../../constants/theme";
import {
  createOpportunity,
  updateOpportunity,
  getOpportunityDetail,
} from "../../../api/opportunities";
import { getActiveAccount } from "../../../api/auth";
import {
  saveOpportunityDraft,
  loadOpportunityDraft,
  deleteOpportunityDraft,
  hasOpportunityDraft,
  formatLastSaved,
} from "../../../utils/opportunityDraftStorage";
import EventBus from "../../../utils/EventBus";

const PRIMARY_COLOR = "#007AFF";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";
const BORDER_COLOR = "#E5E7EB";

// Predefined opportunity types
const OPPORTUNITY_TYPES = [
  "Video Editor",
  "Motion Designer",
  "Thumbnail Designer",
  "Photographer",
  "Community Manager",
  "Content Writer",
  "Social Media Manager",
  "Event Crew",
];

// Tool presets per role
const TOOL_PRESETS = {
  "Video Editor": [
    "CapCut",
    "Premiere Pro",
    "Final Cut",
    "DaVinci Resolve",
    "After Effects",
  ],
  "Motion Designer": [
    "After Effects",
    "Blender",
    "Cinema 4D",
    "Fusion",
    "Nuke",
  ],
  "Thumbnail Designer": ["Photoshop", "Canva", "Illustrator", "Figma"],
  Photographer: ["Lightroom", "Photoshop", "Capture One"],
  "Community Manager": ["Discord", "Slack", "Notion"],
  "Content Writer": ["Google Docs", "Notion", "Grammarly"],
  "Social Media Manager": ["Buffer", "Hootsuite", "Later", "Canva"],
  "Event Crew": [],
};

// Sample types per role
const SAMPLE_TYPES = {
  "Video Editor": [
    "Reels / Shorts",
    "Long-form",
    "Vlogs",
    "Tutorials",
    "Music Videos",
  ],
  "Motion Designer": [
    "Intros / Outros",
    "Animated Graphics",
    "3D Work",
    "Logo Animations",
  ],
  "Thumbnail Designer": [
    "YouTube Thumbnails",
    "Social Media Graphics",
    "Podcast Covers",
  ],
  Photographer: [
    "Event Coverage",
    "Product Photography",
    "Portraits",
    "Lifestyle",
  ],
};

const TOTAL_STEPS = 8;

export default function CreateOpportunityScreen({ navigation, route }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const opportunityToEdit = route.params?.opportunityToEdit;
  const isEditing = !!opportunityToEdit;

  // Draft state
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);
  const [userId, setUserId] = useState(null);

  // Hide tab bar when this screen is open
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: "none" } });
    }
    return () => {
      if (parent) {
        parent.setOptions({ tabBarStyle: undefined });
      }
    };
  }, [navigation]);

  // Step 1: Basics
  const [title, setTitle] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [customType, setCustomType] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Step 2: Intent & Scope
  const [workType, setWorkType] = useState("one_time");
  const [workMode, setWorkMode] = useState("remote");
  const [eventId, setEventId] = useState(null);

  // Step 3: Core Requirements
  const [experienceLevel, setExperienceLevel] = useState("any");
  const [availability, setAvailability] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [timezone, setTimezone] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Step 4: Skill Groups
  const [skillGroups, setSkillGroups] = useState([]);
  const [eligibilityMode, setEligibilityMode] = useState("any_one");
  const [customTool, setCustomTool] = useState("");
  const [showCustomToolInput, setShowCustomToolInput] = useState({});
  const [customSampleType, setCustomSampleType] = useState("");
  const [showCustomSampleInput, setShowCustomSampleInput] = useState({});

  // Step 5: Compensation
  const [paymentType, setPaymentType] = useState("fixed");
  const [budgetRange, setBudgetRange] = useState("");
  const [paymentNature, setPaymentNature] = useState("paid");

  // Step 6: Questions
  const [questions, setQuestions] = useState([]);

  // Step 7: Visibility
  const [visibility, setVisibility] = useState("public");
  const [notifyTalent, setNotifyTalent] = useState(true);

  // Check for draft on mount (only if NOT editing)
  useEffect(() => {
    if (isEditing) {
      loadEditData();
    } else {
      checkForDraft();
    }
  }, []);

  const loadEditData = async () => {
    if (!opportunityToEdit) return;

    // ALWAYS fetch fresh data from the server when editing
    // This ensures we have the latest version including any updates made elsewhere
    let data = opportunityToEdit; // Start with passed data as fallback

    try {
      setSaving(true);
      const response = await getOpportunityDetail(opportunityToEdit.id);
      console.log(
        "[EditData] API Response received, expires_at:",
        response?.opportunity?.expires_at,
      );
      if (response?.success && response?.opportunity) {
        data = response.opportunity;
      } else {
        // Fallback to passed data if API fails
        console.warn("Failed to fetch latest opportunity, using passed data");
      }
    } catch (error) {
      console.error("Error fetching full opportunity details for edit:", error);
      // Continue with passed data on error
    } finally {
      setSaving(false);
    }

    setTitle(data.title || "");
    setSelectedTypes(data.opportunity_types || data.roles || []);
    setWorkType(data.work_type || "one_time");
    setWorkMode(data.work_mode || "remote");
    setEventId(data.event_id || null);
    setExperienceLevel(data.experience_level || "any");
    setAvailability(data.availability || "");
    setTurnaround(data.turnaround || "");
    setTimezone(data.timezone || "");
    setSkillGroups(data.skill_groups || []);
    setEligibilityMode(data.eligibility_mode || "any_one");
    setPaymentType(data.payment_type || "fixed");
    setBudgetRange(data.budget_range || "");
    setPaymentNature(data.payment_nature || "paid");
    setQuestions(data.questions || []);
    setVisibility(data.visibility || "public");
    setNotifyTalent(data.notify_talent !== false);

    if (data.expires_at) {
      console.log(
        "[EditData] Setting expiresAt to:",
        new Date(data.expires_at),
      );
      setExpiresAt(new Date(data.expires_at));
    } else {
      console.log("[EditData] No expires_at found, setting null");
      setExpiresAt(null);
    }
  };

  const checkForDraft = async () => {
    try {
      const account = await getActiveAccount();
      if (!account?.id) return;
      const compositeId = `${account.type}_${account.id}`;
      setUserId(compositeId);
      const hasDraft = await hasOpportunityDraft(compositeId);
      if (hasDraft) {
        const draft = await loadOpportunityDraft(compositeId);
        if (draft?.lastSaved) {
          setDraftLastSaved(draft.lastSaved);
          setShowDraftPrompt(true);
        }
      }
    } catch (error) {
      console.error("Error checking for draft:", error);
    }
  };

  const getCurrentFormData = () => ({
    title,
    selectedTypes,
    workType,
    workMode,
    eventId,
    experienceLevel,
    availability,
    turnaround,
    timezone,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    skillGroups,
    eligibilityMode,
    paymentType,
    budgetRange,
    paymentNature,
    questions,
    visibility,
    notifyTalent,
  });

  const saveDraft = async (silent = false) => {
    try {
      let uid = userId;
      if (!uid) {
        const account = await getActiveAccount();
        if (!account?.id) return;
        uid = `${account.type}_${account.id}`;
        setUserId(uid);
      }
      await saveOpportunityDraft(uid, currentStep, getCurrentFormData());
      if (!silent) {
        Alert.alert("Draft Saved", "Your opportunity draft has been saved.");
      }
    } catch (error) {
      if (!silent) Alert.alert("Error", "Failed to save draft.");
    }
  };

  const loadDraftData = async () => {
    try {
      const draft = await loadOpportunityDraft(userId);
      if (draft?.data) {
        setTitle(draft.data.title || "");
        setSelectedTypes(draft.data.selectedTypes || []);
        setWorkType(draft.data.workType || "one_time");
        setWorkMode(draft.data.workMode || "remote");
        setEventId(draft.data.eventId || null);
        setExperienceLevel(draft.data.experienceLevel || "any");
        setAvailability(draft.data.availability || "");
        setTurnaround(draft.data.turnaround || "");
        setTimezone(draft.data.timezone || "");
        setExpiresAt(
          draft.data.expiresAt ? new Date(draft.data.expiresAt) : null,
        );
        setSkillGroups(draft.data.skillGroups || []);
        setEligibilityMode(draft.data.eligibilityMode || "any_one");
        setPaymentType(draft.data.paymentType || "fixed");
        setBudgetRange(draft.data.budgetRange || "");
        setPaymentNature(draft.data.paymentNature || "paid");
        setQuestions(draft.data.questions || []);
        setVisibility(draft.data.visibility || "public");
        setNotifyTalent(draft.data.notifyTalent !== false);
        setCurrentStep(draft.currentStep || 1);
      }
      setShowDraftPrompt(false);
    } catch (error) {
      console.error("Error loading draft:", error);
      Alert.alert("Error", "Failed to load draft.");
      setShowDraftPrompt(false);
    }
  };

  const deleteDraftAndStartFresh = async () => {
    try {
      if (userId) await deleteOpportunityDraft(userId);
    } catch (error) {
      console.error("Error deleting draft:", error);
    }
    setShowDraftPrompt(false);
  };

  const handleClose = () => {
    if (isEditing) {
      navigation.goBack();
      return;
    }
    if (title.trim() === "" && selectedTypes.length === 0) {
      navigation.goBack();
      return;
    }
    Alert.alert("Save Draft?", "Would you like to save your progress?", [
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          if (userId) await deleteOpportunityDraft(userId);
          navigation.goBack();
        },
      },
      { text: "Cancel", style: "cancel" },
      {
        text: "Save Draft",
        onPress: async () => {
          await saveDraft(true);
          navigation.goBack();
        },
      },
    ]);
  };

  // Initialize skill groups when types change
  useEffect(() => {
    const existingRoles = skillGroups.map((g) => g.role);
    const newGroups = selectedTypes
      .filter((type) => !existingRoles.includes(type))
      .map((type) => ({
        role: type,
        tools: [],
        sample_type: null,
      }));

    const updatedGroups = skillGroups.filter((g) =>
      selectedTypes.includes(g.role),
    );
    setSkillGroups([...updatedGroups, ...newGroups]);
  }, [selectedTypes]);

  const toggleType = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    } else if (selectedTypes.length < 5) {
      setSelectedTypes([...selectedTypes, type]);
    } else {
      Alert.alert(
        "Maximum 5 roles",
        "You can select up to 5 opportunity types.",
      );
    }
  };

  const addCustomType = () => {
    if (customType.trim() && selectedTypes.length < 5) {
      setSelectedTypes([...selectedTypes, customType.trim()]);
      setCustomType("");
      setShowCustomInput(false);
    }
  };

  const updateSkillGroup = (role, field, value) => {
    setSkillGroups(
      skillGroups.map((g) => (g.role === role ? { ...g, [field]: value } : g)),
    );
  };

  const toggleTool = (role, tool) => {
    const group = skillGroups.find((g) => g.role === role);
    if (!group) return;

    const tools = group.tools.includes(tool)
      ? group.tools.filter((t) => t !== tool)
      : [...group.tools, tool];

    updateSkillGroup(role, "tools", tools);
  };

  const addCustomTool = (role) => {
    if (!customTool.trim()) return;
    const group = skillGroups.find((g) => g.role === role);
    if (!group) return;

    const newTools = [...group.tools, customTool.trim()];
    updateSkillGroup(role, "tools", newTools);
    setCustomTool("");
    setShowCustomToolInput({ ...showCustomToolInput, [role]: false });
  };

  const addCustomSampleType = (role) => {
    if (!customSampleType.trim()) return;
    updateSkillGroup(role, "sample_type", customSampleType.trim());
    setCustomSampleType("");
    setShowCustomSampleInput({ ...showCustomSampleInput, [role]: false });
  };

  const addQuestion = () => {
    if (questions.length >= 4) {
      Alert.alert(
        "Maximum 4 questions",
        "You can add up to 4 custom questions.",
      );
      return;
    }
    setQuestions([
      ...questions,
      {
        question_type: "short_text",
        prompt: "",
        required: false,
      },
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    if (field === "required" && value === true) {
      const requiredCount = questions.filter((q) => q.required).length;
      if (requiredCount >= 2) {
        Alert.alert(
          "Maximum 2 required",
          "You can only have 2 required questions.",
        );
        return;
      }
    }
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!title.trim()) {
          Alert.alert("Required", "Please enter an opportunity title.");
          return false;
        }
        if (selectedTypes.length === 0) {
          Alert.alert("Required", "Select at least one role.");
          return false;
        }
        return true;
      case 3:
        if (!availability.trim()) {
          Alert.alert("Required", "Please specify availability requirements.");
          return false;
        }
        if (!turnaround.trim()) {
          Alert.alert("Required", "Please specify expected turnaround.");
          return false;
        }
        return true;
      case 4:
        const hasAnySelection = skillGroups.some(
          (g) => g.tools.length > 0 || g.sample_type,
        );
        if (!hasAnySelection) {
          Alert.alert(
            "Required",
            "Configure at least one skill group with tools or sample type.",
          );
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      // On step 1, use handleClose to show draft save prompt
      handleClose();
    }
  };

  const handlePublish = async (asDraft = false) => {
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        opportunity_types: selectedTypes,
        work_type: workType,
        work_mode: workMode,
        event_id: eventId,
        experience_level: experienceLevel,
        availability: availability.trim(),
        turnaround: turnaround.trim(),
        timezone: timezone.trim() || null,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        payment_type: paymentType,
        budget_range: budgetRange.trim() || null,
        payment_nature: paymentNature,
        eligibility_mode: eligibilityMode,
        visibility,
        notify_talent: notifyTalent,
        skill_groups: skillGroups,
        questions,
        status: asDraft ? "draft" : "active",
      };

      let response;
      if (isEditing && !asDraft) {
        response = await updateOpportunity(opportunityToEdit.id, payload);
      } else {
        response = await createOpportunity(payload);
      }

      if (response?.success) {
        Alert.alert(
          asDraft
            ? "Draft Saved"
            : isEditing
              ? "Opportunity Updated"
              : "Opportunity Published",
          asDraft
            ? "Your opportunity draft has been saved."
            : isEditing
              ? "Your opportunity has been successfully updated."
              : "Your opportunity is now live!",
          [
            {
              text: "OK",
              onPress: () => {
                if (response.opportunity) {
                  EventBus.emit("opportunityUpdated", response.opportunity);
                }
                navigation.goBack();
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error creating opportunity:", error);
      const errorMsg =
        error?.details || error?.message || "Failed to save opportunity.";
      Alert.alert("Error", errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Render step content
  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Basics</Text>
      <Text style={styles.stepDescription}>
        What role are you looking to fill?
      </Text>

      <Text style={styles.label}>Opportunity Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder='e.g., "Looking for a Video Editor"'
        placeholderTextColor={LIGHT_TEXT_COLOR}
        maxLength={80}
      />
      <Text style={styles.charCount}>{title.length}/80</Text>

      <Text style={styles.label}>
        What roles are you hiring for? *
        <Text style={styles.hint}> ({selectedTypes.length}/5)</Text>
      </Text>
      <View style={styles.chipsContainer}>
        {OPPORTUNITY_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.chip,
              selectedTypes.includes(type) && styles.chipSelected,
              selectedTypes.length >= 5 &&
                !selectedTypes.includes(type) &&
                styles.chipDisabled,
            ]}
            onPress={() => toggleType(type)}
            disabled={
              selectedTypes.length >= 5 && !selectedTypes.includes(type)
            }
          >
            <Text
              style={[
                styles.chipText,
                selectedTypes.includes(type) && styles.chipTextSelected,
              ]}
            >
              {type}
            </Text>
            {selectedTypes.includes(type) && (
              <Ionicons
                name="checkmark"
                size={16}
                color="#FFFFFF"
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>
        ))}

        {/* Custom types added by user */}
        {selectedTypes
          .filter((t) => !OPPORTUNITY_TYPES.includes(t))
          .map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, styles.chipSelected]}
              onPress={() => toggleType(type)}
            >
              <Text style={styles.chipTextSelected}>{type}</Text>
              <Ionicons
                name="close"
                size={16}
                color="#FFFFFF"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          ))}

        {/* Add Custom */}
        {!showCustomInput && selectedTypes.length < 5 && (
          <TouchableOpacity
            style={[styles.chip, styles.chipAdd]}
            onPress={() => setShowCustomInput(true)}
          >
            <Ionicons name="add" size={16} color={PRIMARY_COLOR} />
            <Text style={styles.chipAddText}>Custom</Text>
          </TouchableOpacity>
        )}
      </View>

      {showCustomInput && (
        <View style={styles.customInputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={customType}
            onChangeText={setCustomType}
            placeholder="Enter custom role"
            placeholderTextColor={LIGHT_TEXT_COLOR}
            autoFocus
          />
          <TouchableOpacity style={styles.addButton} onPress={addCustomType}>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowCustomInput(false);
              setCustomType("");
            }}
          >
            <Ionicons name="close" size={20} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Work Details</Text>
      <Text style={styles.stepDescription}>
        Define the scope and nature of work.
      </Text>

      <Text style={styles.label}>Work Type</Text>
      <View style={styles.optionsRow}>
        {[
          { value: "one_time", label: "One-time", icon: "flash-outline" },
          { value: "ongoing", label: "Ongoing", icon: "repeat-outline" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionCard,
              workType === opt.value && styles.optionCardSelected,
            ]}
            onPress={() => setWorkType(opt.value)}
          >
            <Ionicons
              name={opt.icon}
              size={24}
              color={workType === opt.value ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
            />
            <Text
              style={[
                styles.optionLabel,
                workType === opt.value && styles.optionLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Work Mode</Text>
      <View style={styles.optionsRow}>
        {[
          { value: "remote", label: "Remote", icon: "laptop-outline" },
          { value: "on_site", label: "On-site", icon: "location-outline" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionCard,
              workMode === opt.value && styles.optionCardSelected,
            ]}
            onPress={() => setWorkMode(opt.value)}
          >
            <Ionicons
              name={opt.icon}
              size={24}
              color={workMode === opt.value ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
            />
            <Text
              style={[
                styles.optionLabel,
                workMode === opt.value && styles.optionLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Core Requirements</Text>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={PRIMARY_COLOR} />
        <Text style={styles.infoText}>
          These requirements apply to ALL applicants regardless of role.
        </Text>
      </View>

      <Text style={styles.label}>Experience Level</Text>
      <View style={styles.dropdownContainer}>
        {["any", "beginner", "intermediate", "advanced"].map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.dropdownItem,
              experienceLevel === level && styles.dropdownItemSelected,
            ]}
            onPress={() => setExperienceLevel(level)}
          >
            <Text
              style={[
                styles.dropdownItemText,
                experienceLevel === level && styles.dropdownItemTextSelected,
              ]}
            >
              {level === "any"
                ? "Any Level"
                : level.charAt(0).toUpperCase() + level.slice(1)}
            </Text>
            {experienceLevel === level && (
              <Ionicons name="checkmark" size={18} color={PRIMARY_COLOR} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Availability *</Text>
      <TextInput
        style={styles.input}
        value={availability}
        onChangeText={setAvailability}
        placeholder="e.g., 10 hrs/week OR 3 videos/week"
        placeholderTextColor={LIGHT_TEXT_COLOR}
        maxLength={100}
      />

      <Text style={styles.label}>Expected Turnaround *</Text>
      <TextInput
        style={styles.input}
        value={turnaround}
        onChangeText={setTurnaround}
        placeholder="e.g., 48 hours per video"
        placeholderTextColor={LIGHT_TEXT_COLOR}
        maxLength={100}
      />

      <Text style={styles.label}>Timezone Preference (Optional)</Text>
      <TextInput
        style={styles.input}
        value={timezone}
        onChangeText={setTimezone}
        placeholder="e.g., IST, EST, or Any"
        placeholderTextColor={LIGHT_TEXT_COLOR}
      />

      <Text style={styles.label}>Application Deadline (Optional)</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={{ color: expiresAt ? TEXT_COLOR : LIGHT_TEXT_COLOR }}>
          {expiresAt
            ? expiresAt.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "Select Deadline"}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={expiresAt || new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setExpiresAt(selectedDate);
            }
          }}
        />
      )}
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Skill Requirements</Text>
      <Text style={styles.stepDescription}>
        Configure requirements for each role. Applicants can apply if they match
        ANY ONE role.
      </Text>

      <View style={styles.eligibilityToggle}>
        <TouchableOpacity
          style={[
            styles.eligibilityOption,
            eligibilityMode === "any_one" && styles.eligibilityOptionSelected,
          ]}
          onPress={() => setEligibilityMode("any_one")}
        >
          <Text
            style={[
              styles.eligibilityText,
              eligibilityMode === "any_one" && styles.eligibilityTextSelected,
            ]}
          >
            Match ANY ONE skill
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.eligibilityOption,
            eligibilityMode === "multiple" && styles.eligibilityOptionSelected,
          ]}
          onPress={() => setEligibilityMode("multiple")}
        >
          <Text
            style={[
              styles.eligibilityText,
              eligibilityMode === "multiple" && styles.eligibilityTextSelected,
            ]}
          >
            Match MULTIPLE
          </Text>
        </TouchableOpacity>
      </View>

      {eligibilityMode === "multiple" && (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={18} color="#FF9500" />
          <Text style={styles.warningText}>
            This will significantly reduce applications (~85% fewer).
          </Text>
        </View>
      )}

      {skillGroups.map((group) => (
        <View key={group.role} style={styles.skillGroupCard}>
          <Text style={styles.skillGroupTitle}>🎬 {group.role}</Text>

          <Text style={styles.skillGroupLabel}>Tools Required</Text>
          <View style={styles.toolsContainer}>
            {/* Preset tools */}
            {(TOOL_PRESETS[group.role] || []).map((tool) => (
              <TouchableOpacity
                key={tool}
                style={[
                  styles.toolChip,
                  group.tools.includes(tool) && styles.toolChipSelected,
                ]}
                onPress={() => toggleTool(group.role, tool)}
              >
                <Text
                  style={[
                    styles.toolChipText,
                    group.tools.includes(tool) && styles.toolChipTextSelected,
                  ]}
                >
                  {tool}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Custom tools added by user */}
            {group.tools
              .filter((t) => !(TOOL_PRESETS[group.role] || []).includes(t))
              .map((tool) => (
                <TouchableOpacity
                  key={tool}
                  style={[styles.toolChip, styles.toolChipSelected]}
                  onPress={() => toggleTool(group.role, tool)}
                >
                  <Text style={styles.toolChipTextSelected}>{tool}</Text>
                  <Ionicons
                    name="close"
                    size={14}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              ))}

            {/* Add Custom Tool Button */}
            {!showCustomToolInput[group.role] && (
              <TouchableOpacity
                style={[styles.toolChip, styles.chipAdd]}
                onPress={() =>
                  setShowCustomToolInput({
                    ...showCustomToolInput,
                    [group.role]: true,
                  })
                }
              >
                <Ionicons name="add" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.chipAddText}>Custom</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Custom Tool Input */}
          {showCustomToolInput[group.role] && (
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={customTool}
                onChangeText={setCustomTool}
                placeholder="Enter custom tool"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                autoFocus
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addCustomTool(group.role)}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCustomToolInput({
                    ...showCustomToolInput,
                    [group.role]: false,
                  });
                  setCustomTool("");
                }}
              >
                <Ionicons name="close" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sample Type Expected - Always show this section */}
          <Text style={styles.skillGroupLabel}>Sample Type Expected</Text>
          <View style={styles.sampleTypesContainer}>
            {/* Preset sample types */}
            {(SAMPLE_TYPES[group.role] || []).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.sampleTypeChip,
                  group.sample_type === type && styles.sampleTypeChipSelected,
                ]}
                onPress={() =>
                  updateSkillGroup(group.role, "sample_type", type)
                }
              >
                <Text
                  style={[
                    styles.sampleTypeText,
                    group.sample_type === type && styles.sampleTypeTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Custom sample type if not in presets */}
            {group.sample_type &&
              !(SAMPLE_TYPES[group.role] || []).includes(group.sample_type) && (
                <TouchableOpacity
                  style={[styles.sampleTypeChip, styles.sampleTypeChipSelected]}
                  onPress={() =>
                    updateSkillGroup(group.role, "sample_type", null)
                  }
                >
                  <Text style={styles.sampleTypeTextSelected}>
                    {group.sample_type}
                  </Text>
                  <Ionicons
                    name="close"
                    size={14}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              )}

            {/* Add Custom Sample Type Button */}
            {!showCustomSampleInput[group.role] && (
              <TouchableOpacity
                style={[styles.sampleTypeChip, styles.chipAdd]}
                onPress={() =>
                  setShowCustomSampleInput({
                    ...showCustomSampleInput,
                    [group.role]: true,
                  })
                }
              >
                <Ionicons name="add" size={16} color={PRIMARY_COLOR} />
                <Text style={styles.chipAddText}>Custom</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Custom Sample Type Input */}
          {showCustomSampleInput[group.role] && (
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={customSampleType}
                onChangeText={setCustomSampleType}
                placeholder="Enter custom sample type"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                autoFocus
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addCustomSampleType(group.role)}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCustomSampleInput({
                    ...showCustomSampleInput,
                    [group.role]: false,
                  });
                  setCustomSampleType("");
                }}
              >
                <Ionicons name="close" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );

  const renderStep5 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Compensation</Text>
      <Text style={styles.stepDescription}>
        How will you compensate the selected talent?
      </Text>

      <Text style={styles.label}>Payment Type</Text>
      <View style={styles.optionsRow}>
        {[
          { value: "fixed", label: "Fixed" },
          { value: "monthly", label: "Monthly" },
          { value: "per_deliverable", label: "Per Deliverable" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.paymentTypeChip,
              paymentType === opt.value && styles.paymentTypeChipSelected,
            ]}
            onPress={() => setPaymentType(opt.value)}
          >
            <Text
              style={[
                styles.paymentTypeText,
                paymentType === opt.value && styles.paymentTypeTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Budget Range (Optional)</Text>
      <TextInput
        style={styles.input}
        value={budgetRange}
        onChangeText={setBudgetRange}
        placeholder="e.g., ₹5,000 - ₹10,000"
        placeholderTextColor={LIGHT_TEXT_COLOR}
      />

      <Text style={styles.label}>Payment Nature</Text>
      <View style={styles.paymentNatureContainer}>
        {[
          { value: "paid", label: "Paid", icon: "cash-outline" },
          { value: "trial", label: "Trial-based", icon: "hourglass-outline" },
          {
            value: "revenue_share",
            label: "Revenue Share",
            icon: "pie-chart-outline",
          },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.paymentNatureCard,
              paymentNature === opt.value && styles.paymentNatureCardSelected,
            ]}
            onPress={() => setPaymentNature(opt.value)}
          >
            <Ionicons
              name={opt.icon}
              size={20}
              color={
                paymentNature === opt.value ? PRIMARY_COLOR : LIGHT_TEXT_COLOR
              }
            />
            <Text
              style={[
                styles.paymentNatureLabel,
                paymentNature === opt.value &&
                  styles.paymentNatureLabelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {paymentNature === "trial" && (
        <View style={styles.infoBox}>
          <Ionicons name="bulb-outline" size={18} color="#FF9500" />
          <Text style={styles.infoText}>
            Consider offering a small stipend for trial work.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderStep6 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Application Questions</Text>

      <View style={styles.infoBox}>
        <Ionicons name="bulb-outline" size={18} color={PRIMARY_COLOR} />
        <Text style={styles.infoText}>
          Keep this short. Fewer questions = better quality applicants.
        </Text>
      </View>

      <View style={styles.autoIncludedBox}>
        <Text style={styles.autoIncludedTitle}>
          Auto-Included (Not editable)
        </Text>
        <View style={styles.autoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.autoItemText}>Applicant Profile</Text>
        </View>
        <View style={styles.autoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.autoItemText}>Skill Applied For</Text>
        </View>
        <View style={styles.autoItem}>
          <Ionicons name="checkmark-circle" size={16} color="#34C759" />
          <Text style={styles.autoItemText}>Portfolio Samples</Text>
        </View>
      </View>

      <Text style={styles.label}>Your Questions (max 4)</Text>

      {questions.map((q, index) => (
        <View key={index} style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Question {index + 1}</Text>
            <TouchableOpacity onPress={() => removeQuestion(index)}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.questionInput}
            value={q.prompt}
            onChangeText={(text) => updateQuestion(index, "prompt", text)}
            placeholder="Enter your question"
            placeholderTextColor={LIGHT_TEXT_COLOR}
            multiline
          />
          <View style={styles.requiredRow}>
            <Text style={styles.requiredLabel}>Required</Text>
            <Switch
              value={q.required}
              onValueChange={(val) => updateQuestion(index, "required", val)}
              trackColor={{ false: "#E5E7EB", true: `${PRIMARY_COLOR}50` }}
              thumbColor={q.required ? PRIMARY_COLOR : "#FFFFFF"}
            />
          </View>
        </View>
      ))}

      {questions.length < 4 && (
        <TouchableOpacity
          style={styles.addQuestionButton}
          onPress={addQuestion}
        >
          <Ionicons name="add" size={20} color={PRIMARY_COLOR} />
          <Text style={styles.addQuestionText}>
            Add Question ({4 - questions.length} remaining)
          </Text>
        </TouchableOpacity>
      )}

      {questions.length > 2 && (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={18} color="#FF9500" />
          <Text style={styles.warningText}>
            Each additional question reduces completion rate by ~15%.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderStep7 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Visibility</Text>
      <Text style={styles.stepDescription}>
        Who should see this opportunity?
      </Text>

      <View style={styles.visibilityOptions}>
        {[
          {
            value: "public",
            title: "Public",
            description: "Anyone on SnooSpace can discover",
            icon: "globe-outline",
          },
          {
            value: "community",
            title: "Community Only",
            description: "Only members of your community",
            icon: "people-outline",
          },
          {
            value: "invite",
            title: "Invite Only",
            description: "Share link manually",
            icon: "link-outline",
          },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.visibilityCard,
              visibility === opt.value && styles.visibilityCardSelected,
            ]}
            onPress={() => setVisibility(opt.value)}
          >
            <View style={styles.visibilityRadio}>
              <View
                style={[
                  styles.radioOuter,
                  visibility === opt.value && styles.radioOuterSelected,
                ]}
              >
                {visibility === opt.value && <View style={styles.radioInner} />}
              </View>
            </View>
            <Ionicons
              name={opt.icon}
              size={24}
              color={
                visibility === opt.value ? PRIMARY_COLOR : LIGHT_TEXT_COLOR
              }
            />
            <View style={styles.visibilityText}>
              <Text
                style={[
                  styles.visibilityTitle,
                  visibility === opt.value && styles.visibilityTitleSelected,
                ]}
              >
                {opt.title}
              </Text>
              <Text style={styles.visibilityDescription}>
                {opt.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.notifyRow}>
        <View style={styles.notifyInfo}>
          <Text style={styles.notifyTitle}>Notify relevant talent</Text>
          <Text style={styles.notifyDescription}>
            Push notification to matching profiles
          </Text>
        </View>
        <Switch
          value={notifyTalent}
          onValueChange={setNotifyTalent}
          trackColor={{ false: "#E5E7EB", true: `${PRIMARY_COLOR}50` }}
          thumbColor={notifyTalent ? PRIMARY_COLOR : "#FFFFFF"}
        />
      </View>
    </ScrollView>
  );

  const renderStep8 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Review & Publish</Text>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>
          {title || "Untitled Opportunity"}
        </Text>

        <View style={styles.reviewRoles}>
          {selectedTypes.map((type, i) => (
            <View key={i} style={styles.reviewRoleChip}>
              <Text style={styles.reviewRoleText}>{type}</Text>
            </View>
          ))}
        </View>

        <View style={styles.reviewRow}>
          <Ionicons
            name="briefcase-outline"
            size={18}
            color={LIGHT_TEXT_COLOR}
          />
          <Text style={styles.reviewText}>
            {workType === "one_time" ? "One-time" : "Ongoing"} ·{" "}
            {workMode === "remote" ? "Remote" : "On-site"}
          </Text>
        </View>

        <View style={styles.reviewRow}>
          <Ionicons name="cash-outline" size={18} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.reviewText}>
            {paymentType.replace("_", " ")} ·{" "}
            {paymentNature === "paid" ? "Paid" : paymentNature}
            {budgetRange ? ` · ${budgetRange}` : ""}
          </Text>
        </View>

        <View style={styles.reviewRow}>
          <Ionicons name="eye-outline" size={18} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.reviewText}>
            {visibility === "public"
              ? "Public"
              : visibility === "community"
                ? "Community Only"
                : "Invite Only"}
          </Text>
        </View>

        <View style={styles.reviewDivider} />

        <Text style={styles.reviewSectionTitle}>Core Requirements</Text>
        <Text style={styles.reviewBullet}>
          • {experienceLevel === "any" ? "Any" : experienceLevel} experience
          level
        </Text>
        <Text style={styles.reviewBullet}>• {availability}</Text>
        <Text style={styles.reviewBullet}>• {turnaround}</Text>
        {expiresAt && (
          <Text style={styles.reviewBullet}>
            • Deadline:{" "}
            {expiresAt.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        )}

        <View style={styles.reviewDivider} />

        <Text style={styles.reviewSectionTitle}>Application Eligibility</Text>
        <Text style={styles.reviewBullet}>
          ✓ Match {eligibilityMode === "any_one" ? "ANY ONE" : "MULTIPLE"} skill
          group{eligibilityMode !== "any_one" ? "s" : ""}
        </Text>

        <Text style={styles.reviewSectionTitle}>
          Questions ({questions.length})
        </Text>
        {questions.map((q, i) => (
          <Text key={i} style={styles.reviewBullet}>
            • {q.prompt || "(Empty question)"}
          </Text>
        ))}
        {questions.length === 0 && (
          <Text style={styles.reviewBullet}>• No custom questions</Text>
        )}
      </View>

      <Text style={styles.editHint}>Tap any section above to edit</Text>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      case 7:
        return renderStep7();
      case 8:
        return renderStep8();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Opportunity" : "Create Opportunity"}
          </Text>
          {isEditing ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCurrentStep(TOTAL_STEPS)}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: PRIMARY_COLOR, fontWeight: "600" },
                ]}
              >
                Review
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(currentStep / TOTAL_STEPS) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Step Content */}
        {renderCurrentStep()}

        {/* Footer */}
        <View style={styles.footer}>
          {currentStep === TOTAL_STEPS ? (
            <View style={styles.publishButtons}>
              {!isEditing && (
                <TouchableOpacity
                  style={styles.draftButton}
                  onPress={() => handlePublish(true)}
                  disabled={saving}
                >
                  <Text style={styles.draftButtonText}>Save as Draft</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.publishButton}
                onPress={() => handlePublish(false)}
                disabled={saving}
              >
                <LinearGradient
                  colors={["#00C6FF", "#007AFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.publishGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="rocket" size={20} color="#FFFFFF" />
                      <Text style={styles.publishButtonText}>
                        {isEditing ? "Update Opportunity" : "Publish"}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <LinearGradient
                colors={["#00C6FF", "#007AFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextGradient}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Draft Resume Modal */}
      <Modal
        visible={showDraftPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDraftPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.draftPromptCard}>
            <View style={styles.draftPromptIcon}>
              <Ionicons name="document-text" size={32} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.draftPromptTitle}>Resume Draft?</Text>
            <Text style={styles.draftPromptMessage}>
              You have an unsaved opportunity draft
              {draftLastSaved ? ` from ${formatLastSaved(draftLastSaved)}` : ""}
              .
            </Text>
            <View style={styles.draftPromptButtons}>
              <TouchableOpacity
                style={styles.draftPromptSecondary}
                onPress={deleteDraftAndStartFresh}
              >
                <Text style={styles.draftPromptSecondaryText}>Start Fresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.draftPromptPrimary}
                onPress={loadDraftData}
              >
                <LinearGradient
                  colors={["#00C6FF", "#007AFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.draftPromptPrimaryGradient}
                >
                  <Text style={styles.draftPromptPrimaryText}>Resume</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  cancelButton: {
    padding: 4,
  },
  cancelText: {
    fontSize: 15,
    color: "#FF3B30",
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 16,
  },
  hint: {
    fontWeight: "400",
    color: LIGHT_TEXT_COLOR,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: "right",
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  chipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  chipAdd: {
    backgroundColor: "#FFFFFF",
    borderColor: PRIMARY_COLOR,
    borderStyle: "dashed",
  },
  chipAddText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginLeft: 4,
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  optionCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}08`,
  },
  optionLabel: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontWeight: "500",
  },
  optionLabelSelected: {
    color: PRIMARY_COLOR,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: `${PRIMARY_COLOR}10`,
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_COLOR,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E6",
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#996600",
    lineHeight: 18,
  },
  dropdownContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: "hidden",
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  dropdownItemSelected: {
    backgroundColor: `${PRIMARY_COLOR}10`,
  },
  dropdownItemText: {
    fontSize: 15,
    color: TEXT_COLOR,
  },
  dropdownItemTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  eligibilityToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  eligibilityOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  eligibilityOptionSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eligibilityText: {
    fontSize: 13,
    fontWeight: "500",
    color: LIGHT_TEXT_COLOR,
  },
  eligibilityTextSelected: {
    color: PRIMARY_COLOR,
  },
  skillGroupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  skillGroupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  skillGroupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
    marginBottom: 8,
    marginTop: 12,
  },
  toolsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toolChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toolChipSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  toolChipText: {
    fontSize: 13,
    color: TEXT_COLOR,
  },
  toolChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  sampleTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sampleTypeChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sampleTypeChipSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}10`,
  },
  sampleTypeText: {
    fontSize: 13,
    color: TEXT_COLOR,
  },
  sampleTypeTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  paymentTypeChip: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  paymentTypeChipSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
  paymentTypeText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  paymentTypeTextSelected: {
    color: "#FFFFFF",
  },
  paymentNatureContainer: {
    gap: 10,
    marginBottom: 16,
  },
  paymentNatureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  paymentNatureCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}08`,
  },
  paymentNatureLabel: {
    fontSize: 15,
    color: TEXT_COLOR,
  },
  paymentNatureLabelSelected: {
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  autoIncludedBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  autoIncludedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#166534",
    marginBottom: 12,
  },
  autoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  autoItemText: {
    fontSize: 14,
    color: "#166534",
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  questionInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: TEXT_COLOR,
    minHeight: 60,
    textAlignVertical: "top",
  },
  requiredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  requiredLabel: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  addQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${PRIMARY_COLOR}10`,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  addQuestionText: {
    fontSize: 15,
    fontWeight: "500",
    color: PRIMARY_COLOR,
  },
  visibilityOptions: {
    gap: 12,
    marginBottom: 24,
  },
  visibilityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  visibilityCardSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}08`,
  },
  visibilityRadio: {
    width: 24,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: PRIMARY_COLOR,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY_COLOR,
  },
  visibilityText: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  visibilityTitleSelected: {
    color: PRIMARY_COLOR,
  },
  visibilityDescription: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  notifyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
  },
  notifyInfo: {
    flex: 1,
  },
  notifyTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  notifyDescription: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  reviewRoles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  reviewRoleChip: {
    backgroundColor: `${PRIMARY_COLOR}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewRoleText: {
    fontSize: 13,
    fontWeight: "500",
    color: PRIMARY_COLOR,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: 16,
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 8,
  },
  reviewBullet: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 4,
  },
  editHint: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    backgroundColor: COLORS.background,
  },
  nextButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  nextGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  publishButtons: {
    flexDirection: "row",
    gap: 12,
  },
  draftButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  publishButton: {
    flex: 2,
    borderRadius: 12,
    overflow: "hidden",
  },
  publishGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  draftPromptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  draftPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${PRIMARY_COLOR}15`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  draftPromptTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  draftPromptMessage: {
    fontSize: 15,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  draftPromptButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  draftPromptSecondary: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  draftPromptSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  draftPromptPrimary: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  draftPromptPrimaryGradient: {
    paddingVertical: 14,
    alignItems: "center",
  },
  draftPromptPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
