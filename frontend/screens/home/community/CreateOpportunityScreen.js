import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
  Modal,
  Animated,
  Keyboard,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check,
  X,
  Plus,
  Zap,
  Repeat,
  Monitor,
  MapPin,
  Info,
  CheckCircle2,
  Trash2,
  Globe,
  Users,
  Link,
  Banknote,
  Hourglass,
  PieChart,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Briefcase,
  Target,
  Settings,
  Layers,
  CircleDollarSign,
  HelpCircle,
  Eye,
  FileCheck,
  Award,
  Coins,
  ArrowRight,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  Gift,
  GraduationCap,
  Star,
  ListChecks,
  Pencil,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import CustomDatePicker from "../../../components/ui/CustomDatePicker";
import OpportunitySuccessModal from "../../../components/modals/OpportunitySuccessModal";

import { COLORS, FONTS, SHADOWS } from "../../../constants/theme";
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
import SnooLoader from "../../../components/ui/SnooLoader";

const MODAL_TOKENS = {
  primary: "#2962FF",
  primaryGradient: ["#448AFF", "#2962FF"],
  surface: "#FFFFFF",
  background: "#F8FAFC",
  border: "rgba(255, 255, 255, 0.6)",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  error: "#EF4444",
  success: "#10B981",
  radius: {
    xs: 8,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 24,
  },
};
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

const parseBudgetRange = (str) => {
  if (!str) return { currency: "₹", min: "", max: "" };
  const clean = str.trim();
  let currencySymbol = "₹";
  if (clean.includes("$")) {
    currencySymbol = "$";
  } else if (clean.includes("₹")) {
    currencySymbol = "₹";
  }
  
  // Remove currency symbols
  const numbersOnly = clean.replace(/[₹$]/g, "");
  // Split by range delimiter (dash, to, etc.)
  const parts = numbersOnly.split("-");
  let minVal = "";
  let maxVal = "";
  if (parts.length > 0) {
    minVal = parts[0].replace(/,/g, "").trim();
  }
  if (parts.length > 1) {
    maxVal = parts[1].replace(/,/g, "").trim();
  }
  return { currency: currencySymbol, min: minVal, max: maxVal };
};

const getPaymentTypeDisplayText = (type) => {
  switch (type) {
    case "fixed":
      return "Fixed";
    case "monthly":
      return "Monthly";
    case "per_deliverable":
      return "Per Deliverable";
    default:
      return type ? (type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")) : "";
  }
};

const TOTAL_STEPS = 11;

export default function CreateOpportunityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const totalSteps = 11;
  const progressPercent = useRef(new Animated.Value(0)).current;
  const [hasReachedReview, setHasReachedReview] = useState(false);

  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalData, setSuccessModalData] = useState({
    title: "",
    message: "",
    isDraft: false,
    opportunity: null,
  });
  const [currency, setCurrency] = useState("₹");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  const scrollViewRef = useRef(null);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // Sync budgetRange string whenever currency, minBudget, maxBudget, paymentNature, or trialType changes
  useEffect(() => {
    if (
      paymentNature === "exposure" ||
      (paymentNature === "trial" && trialType === "free_trial")
    ) {
      setBudgetRange("");
      return;
    }
    if (minBudget || maxBudget) {
      const minStr = minBudget ? `${currency}${minBudget}` : "";
      const maxStr = maxBudget ? `${currency}${maxBudget}` : "";
      if (minStr && maxStr) {
        setBudgetRange(`${minStr} - ${maxStr}`);
      } else {
        setBudgetRange(minStr || maxStr);
      }
    } else {
      setBudgetRange("");
    }
  }, [currency, minBudget, maxBudget, paymentNature, trialType]);

  useEffect(() => {
    Animated.timing(progressPercent, {
      toValue: currentStep / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();

    if (currentStep === TOTAL_STEPS) {
      setHasReachedReview(true);
    }
  }, [currentStep]);
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
  const [workModes, setWorkModes] = useState(["remote"]); // multi-select
  const [eventId, setEventId] = useState(null);

  // Step 3 (NEW): About the Role
  const [aboutRole, setAboutRole] = useState("");
  const [responsibilities, setResponsibilities] = useState([]);
  const [newResponsibility, setNewResponsibility] = useState("");
  const [showResponsibilityInput, setShowResponsibilityInput] = useState(false);
  const [editingResponsibilityIndex, setEditingResponsibilityIndex] = useState(null);
  const [editingResponsibilityText, setEditingResponsibilityText] = useState("");

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

  // Step 5 (new): Compensation
  const [paymentType, setPaymentType] = useState("fixed");
  const [budgetRange, setBudgetRange] = useState("");
  const [paymentNature, setPaymentNature] = useState("paid");
  const [trialType, setTrialType] = useState("paid_trial"); // "paid_trial" | "free_trial"

  const isBudgetRequired =
    paymentNature === "paid" ||
    (paymentNature === "trial" && trialType === "paid_trial") ||
    paymentNature === "revenue_share";

  // Step 6 (new): Who Can Apply
  const [whoCanApply, setWhoCanApply] = useState([]);
  const [customWhoCanApply, setCustomWhoCanApply] = useState("");
  const [showWhoCanApplyInput, setShowWhoCanApplyInput] = useState(false);

  // Step 7 (new): What You'll Gain
  const [gains, setGains] = useState([]);
  const [newGain, setNewGain] = useState("");
  const [showGainInput, setShowGainInput] = useState(false);

  // Step 9: Questions
  const [questions, setQuestions] = useState([]);

  // Step 10: Visibility
  const [visibility, setVisibility] = useState("public");
  const [notifyTalent, setNotifyTalent] = useState(true);

  // Auto-scroll when keyboard inputs appear at the bottom
  useEffect(() => {
    if (showCustomInput && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [showCustomInput]);

  useEffect(() => {
    const isAnyToolOpen = Object.values(showCustomToolInput).some((v) => v);
    const isAnySampleOpen = Object.values(showCustomSampleInput).some((v) => v);
    if ((isAnyToolOpen || isAnySampleOpen) && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [showCustomToolInput, showCustomSampleInput]);

  useEffect(() => {
    if (questions.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  }, [questions.length]);

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
    // Handle both legacy string and new array format for work_mode
    const rawMode = data.work_mode || "remote";
    if (Array.isArray(rawMode)) {
      setWorkModes(rawMode);
    } else if (rawMode === "hybrid") {
      setWorkModes(["remote", "on_site"]);
    } else {
      setWorkModes(rawMode.split(",").map(m => m.trim()));
    }
    setEventId(data.event_id || null);
    setAboutRole(data.about_role || "");
    setResponsibilities(data.responsibilities || []);
    // Parse legacy string or existing array into sample_types on each skill group
    const parsedSkillGroups = (data.skill_groups || []).map((g) => ({
      ...g,
      sample_types: g.sample_types
        ? (Array.isArray(g.sample_types) ? g.sample_types : g.sample_types.split(",").map((s) => s.trim()).filter(Boolean))
        : g.sample_type
          ? g.sample_type.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
    }));
    setExperienceLevel(data.experience_level || "any");
    setAvailability(data.availability || "");
    setTurnaround(data.turnaround || "");
    setTimezone(data.timezone || "");
    setSkillGroups(parsedSkillGroups);
    setEligibilityMode(data.eligibility_mode || "any_one");
    setWhoCanApply(data.who_can_apply || []);
    setGains(data.gains || []);
    setPaymentType(data.payment_type || "fixed");
    const { currency: curr, min: minVal, max: maxVal } = parseBudgetRange(data.budget_range || "");
    setCurrency(curr);
    setMinBudget(minVal);
    setMaxBudget(maxVal);
    setBudgetRange(data.budget_range || "");
    setPaymentNature(data.payment_nature || "paid");
    setTrialType(data.trial_type || "paid_trial");
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
    workModes,
    eventId,
    aboutRole,
    responsibilities,
    experienceLevel,
    availability,
    turnaround,
    timezone,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    skillGroups,
    eligibilityMode,
    whoCanApply,
    gains,
    paymentType,
    budgetRange,
    paymentNature,
    trialType,
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
        setWorkModes(draft.data.workModes || ["remote"]);
        setEventId(draft.data.eventId || null);
        setAboutRole(draft.data.aboutRole || "");
        setResponsibilities(draft.data.responsibilities || []);
        setExperienceLevel(draft.data.experienceLevel || "any");
        setAvailability(draft.data.availability || "");
        setTurnaround(draft.data.turnaround || "");
        setTimezone(draft.data.timezone || "");
        setExpiresAt(
          draft.data.expiresAt ? new Date(draft.data.expiresAt) : null,
        );
        setSkillGroups(draft.data.skillGroups || []);
        setEligibilityMode(draft.data.eligibilityMode || "any_one");
        setWhoCanApply(draft.data.whoCanApply || []);
        setGains(draft.data.gains || []);
        setPaymentType(draft.data.paymentType || "fixed");
        const { currency: curr, min: minVal, max: maxVal } = parseBudgetRange(draft.data.budgetRange || "");
        setCurrency(curr);
        setMinBudget(minVal);
        setMaxBudget(maxVal);
        setBudgetRange(draft.data.budgetRange || "");
        setPaymentNature(draft.data.paymentNature || "paid");
        setTrialType(draft.data.trialType || "paid_trial");
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
    setShowSaveDraftModal(true);
  };

  // Initialize skill groups when types change
  useEffect(() => {
    const existingRoles = skillGroups.map((g) => g.role);
    const newGroups = selectedTypes
      .filter((type) => !existingRoles.includes(type))
      .map((type) => ({
        role: type,
        tools: [],
        sample_types: [],
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
      Keyboard.dismiss();
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
    Keyboard.dismiss();
  };

  const addCustomSampleType = (role) => {
    if (!customSampleType.trim()) return;
    const group = skillGroups.find((g) => g.role === role);
    if (!group) return;
    const trimmed = customSampleType.trim();
    const current = group.sample_types || [];
    if (!current.includes(trimmed)) {
      updateSkillGroup(role, "sample_types", [...current, trimmed]);
    }
    setCustomSampleType("");
    setShowCustomSampleInput({ ...showCustomSampleInput, [role]: false });
    Keyboard.dismiss();
  };

  const toggleSampleType = (role, type) => {
    const group = skillGroups.find((g) => g.role === role);
    if (!group) return;
    const current = group.sample_types || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    updateSkillGroup(role, "sample_types", updated);
  };

  const removeSampleType = (role, type) => {
    const group = skillGroups.find((g) => g.role === role);
    if (!group) return;
    const updated = (group.sample_types || []).filter((t) => t !== type);
    updateSkillGroup(role, "sample_types", updated);
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
      case 3: // About the Role — description AND at least one responsibility required
        if (!aboutRole.trim()) {
          Alert.alert("Required", "Please describe the role before continuing.");
          return false;
        }
        if (responsibilities.length === 0) {
          Alert.alert("Required", "Add at least one key responsibility.");
          return false;
        }
        return true;
      case 4: // Core Requirements
        if (!availability.trim()) {
          Alert.alert("Required", "Please specify availability requirements.");
          return false;
        }
        if (!turnaround.trim()) {
          Alert.alert("Required", "Please specify expected turnaround.");
          return false;
        }
        return true;
      case 5: // Skill Requirements (was step 4)
        const hasAnySelection = skillGroups.some(
          (g) => g.tools.length > 0 || (g.sample_types && g.sample_types.length > 0),
        );
        if (!hasAnySelection) {
          Alert.alert(
            "Required",
            "Configure at least one skill group with tools or sample type.",
          );
          return false;
        }
        return true;
      case 8: // Compensation
        if (isBudgetRequired) {
          if (!minBudget.trim() || !maxBudget.trim()) {
            Alert.alert("Required", "Please specify both the minimum and maximum budget.");
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const isStepFormComplete = (step) => {
    switch (step) {
      case 1:
        return title.trim() !== "" && selectedTypes.length > 0;
      case 2:
        return workModes.length > 0;
      case 3:
        return aboutRole.trim() !== "" && responsibilities.length > 0;
      case 4:
        return availability.trim() !== "" && turnaround.trim() !== "";
      case 5:
        return skillGroups.some((g) => g.tools.length > 0 || (g.sample_types && g.sample_types.length > 0));
      case 6:
        return true; // Who Can Apply — optional
      case 7:
        return true; // What You'll Gain — optional
      case 8:
        return !isBudgetRequired || (minBudget.trim() !== "" && maxBudget.trim() !== "");
      case 9:
        return questions.every((q) => q.prompt.trim() !== "");
      case 10:
        return true; // Visibility
      case 11:
        return true; // Review
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      Keyboard.dismiss();
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      // On step 1, use handleClose to show draft save prompt
      handleClose();
    }
  };

  const handlePublish = async (asDraft = false) => {
    if (!asDraft) {
      // Validate all steps from 1 to TOTAL_STEPS - 1
      for (let s = 1; s < TOTAL_STEPS; s++) {
        if (!validateStep(s)) {
          setCurrentStep(s);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        opportunity_types: selectedTypes,
        work_type: workType,
        work_mode: workModes.includes("remote") && workModes.includes("on_site") ? "hybrid" : workModes[0],
        event_id: eventId,
        about_role: aboutRole.trim() || null,
        responsibilities,
        experience_level: experienceLevel,
        availability: availability.trim(),
        turnaround: turnaround.trim(),
        timezone: timezone.trim() || null,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        payment_type:
          paymentNature === "exposure" ||
          paymentNature === "revenue_share" ||
          (paymentNature === "trial" && trialType === "free_trial")
            ? null
            : paymentType,
        budget_range:
          paymentNature === "exposure" ||
          (paymentNature === "trial" && trialType === "free_trial")
            ? null
            : (budgetRange.trim() || null),
        payment_nature: paymentNature,
        trial_type: paymentNature === "trial" ? trialType : null,
        eligibility_mode: eligibilityMode,
        who_can_apply: whoCanApply,
        gains,
        visibility,
        notify_talent: notifyTalent,
        skill_groups: skillGroups.map((g) => ({
          ...g,
          // Serialize the sample_types array back to the string the backend stores
          sample_type: (g.sample_types && g.sample_types.length > 0)
            ? g.sample_types.join(",")
            : null,
        })),
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
        // Clear the local draft when successfully publishing (not saving as draft)
        if (!asDraft && userId) {
          try { await deleteOpportunityDraft(userId); } catch (_) {}
        }
        setSuccessModalData({
          title: asDraft
            ? "Draft Saved"
            : isEditing
              ? "Opportunity Updated"
              : "Opportunity Published",
          message: asDraft
            ? "Your opportunity draft has been saved."
            : isEditing
              ? "Your opportunity has been successfully updated."
              : "Your opportunity is now live!",
          isDraft: asDraft,
          opportunity: response.opportunity,
        });
        setSuccessModalVisible(true);
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
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Briefcase
                size={22}
                color={MODAL_TOKENS.primary}
                strokeWidth={2}
              />
            </View>
            <Text style={styles.sectionHeaderTitle}>Basics</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            What role are you looking to fill?
          </Text>
        </View>

        <View style={styles.inputContainerNew}>
          <Text style={styles.labelNew}>Opportunity Title *</Text>
          <TextInput
            style={styles.inputNew}
            value={title}
            onChangeText={setTitle}
            placeholder='e.g., "Looking for a Video Editor"'
            placeholderTextColor={MODAL_TOKENS.textMuted}
            maxLength={80}
          />
          <Text style={styles.charCount}>{title.length}/80</Text>

          <Text style={styles.labelNew}>
            What roles are you hiring for? *
            <Text style={styles.hint}> ({selectedTypes.length}/5)</Text>
          </Text>
          <View style={styles.chipsContainerNew}>
            {OPPORTUNITY_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type);
              const isDisabled = selectedTypes.length >= 5 && !isSelected;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelectedNew,
                    isDisabled && styles.chipDisabledNew,
                  ]}
                  onPress={() => toggleType(type)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.chipTextNew,
                      isSelected && styles.chipTextSelectedNew,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom types added by user */}
            {selectedTypes
              .filter((t) => !OPPORTUNITY_TYPES.includes(t))
              .map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, styles.chipSelectedNew]}
                  onPress={() => toggleType(type)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipTextSelectedNew}>{type}</Text>
                  <X
                    size={14}
                    color="#FFFFFF"
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              ))}

            {/* Add Custom */}
            {!showCustomInput && selectedTypes.length <= 4 && (
              <TouchableOpacity
                style={[styles.chip, styles.chipAddNew]}
                onPress={() => setShowCustomInput(true)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={MODAL_TOKENS.primary} />
                <Text style={styles.chipAddTextNew}>Custom</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showCustomInput && (
          <View style={styles.customInputRowNew}>
            <TextInput
              style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
              value={customType}
              onChangeText={setCustomType}
              placeholder="Enter custom role"
              placeholderTextColor={MODAL_TOKENS.textMuted}
              autoFocus
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addCustomType}
              activeOpacity={0.7}
            >
              <Check size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowCancelButton}
              onPress={() => {
                setShowCustomInput(false);
                setCustomType("");
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
            >
              <X size={20} color={MODAL_TOKENS.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </BlurView>
    </KeyboardAwareScrollView>
  );

  const renderStep2 = () => (
    <KeyboardAwareScrollView
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Zap size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Work Details</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            Define the scope and nature of work.
          </Text>
        </View>

        <Text style={styles.labelNew}>Work Type</Text>
        <View style={styles.optionsRow}>
          {[
            { value: "one_time", label: "One-time", Icon: Zap },
            { value: "ongoing", label: "Ongoing", Icon: Repeat },
          ].map((opt) => {
            const isSelected = workType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => setWorkType(opt.value)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    isSelected && styles.optionIconContainerSelected,
                  ]}
                >
                  <opt.Icon
                    strokeWidth={2}
                    size={20}
                    color={isSelected ? MODAL_TOKENS.primary : MODAL_TOKENS.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <View style={styles.cardCheckCircle}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.labelNew}>Work Mode</Text>
        <Text style={styles.multiSelectHint}>Select all that apply</Text>
        <View style={styles.optionsRow}>
          {[
            { value: "remote", label: "Remote", Icon: Monitor },
            { value: "on_site", label: "On-site", Icon: MapPin },
          ].map((opt) => {
            const isSelected = workModes.includes(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => {
                  if (isSelected) {
                    // Prevent deselecting the last option
                    if (workModes.length > 1) {
                      setWorkModes(workModes.filter((m) => m !== opt.value));
                    }
                  } else {
                    setWorkModes([...workModes, opt.value]);
                  }
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    isSelected && styles.optionIconContainerSelected,
                  ]}
                >
                  <opt.Icon
                    strokeWidth={2}
                    size={20}
                    color={isSelected ? MODAL_TOKENS.primary : MODAL_TOKENS.textSecondary}
                  />
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    isSelected && styles.optionLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {isSelected && (
                  <View style={styles.cardCheckCircle}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {workModes.includes("remote") && workModes.includes("on_site") && (
          <View style={styles.infoBox}>
            <Info size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
            <Text style={styles.infoText}>
              Hybrid mode — applicants can work both remotely and on-site.
            </Text>
          </View>
        )}
      </BlurView>
    </KeyboardAwareScrollView>
  );

  // ─── NEW STEP 3: About the Role ──────────────────────────────────────────
  const renderStep3 = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingBottom: isKeyboardVisible ? 400 : 180,
        paddingTop: 12,
      }}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <FileText size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>About the Role</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            Help applicants understand what this role is about.
          </Text>
        </View>

        <Text style={styles.labelNew}>Role Description</Text>
        <TextInput
          style={[styles.inputNew, styles.textareaNew]}
          value={aboutRole}
          onChangeText={setAboutRole}
          placeholder="Describe what this role involves, who you're looking for, and what they'll be working on..."
          placeholderTextColor={MODAL_TOKENS.textMuted}
          multiline
          maxLength={1000}
          textAlignVertical="top"
          onFocus={() => {
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 250);
          }}
        />
        <Text style={styles.charCount}>{aboutRole.length}/1000</Text>

        <Text style={styles.labelNew}>
          Key Responsibilities
          <Text style={styles.hint}> ({responsibilities.length}/10)</Text>
        </Text>

        {responsibilities.map((item, index) =>
          editingResponsibilityIndex === index ? (() => {
            const hasEdits =
              editingResponsibilityText.trim() !== "" &&
              editingResponsibilityText.trim() !== item;
            return (
            // ── Inline edit row ──
            <View key={index} style={styles.customInputRowNew}>
              <TextInput
                style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
                value={editingResponsibilityText}
                onChangeText={setEditingResponsibilityText}
                placeholder="Edit responsibility…"
                placeholderTextColor={MODAL_TOKENS.textMuted}
                autoFocus
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
              />
              <TouchableOpacity
                style={[styles.addButton, !hasEdits && { opacity: 0.35 }]}
                onPress={() => {
                  if (!hasEdits) return;
                  const updated = [...responsibilities];
                  updated[index] = editingResponsibilityText.trim();
                  setResponsibilities(updated);
                  setEditingResponsibilityIndex(null);
                  setEditingResponsibilityText("");
                }}
                activeOpacity={hasEdits ? 0.7 : 1}
                disabled={!hasEdits}
              >
                <Check size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowCancelButton}
                onPress={() => {
                  setEditingResponsibilityIndex(null);
                  setEditingResponsibilityText("");
                  Keyboard.dismiss();
                }}
                activeOpacity={0.7}
              >
                <X size={20} color={MODAL_TOKENS.textMuted} />
              </TouchableOpacity>
            </View>
            );
          })() : (
            // ── Static display row ──
            <View key={index} style={styles.listItemRow}>
              <View style={styles.listBullet} />
              <Text style={styles.listItemText} numberOfLines={2}>{item}</Text>
              <TouchableOpacity
                style={styles.listItemEditButton}
                onPress={() => {
                  setEditingResponsibilityIndex(index);
                  setEditingResponsibilityText(item);
                  setShowResponsibilityInput(false);
                }}
                activeOpacity={0.7}
              >
                <Pencil size={15} color={MODAL_TOKENS.primary} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.listItemDelete}
                onPress={() => setResponsibilities(responsibilities.filter((_, i) => i !== index))}
                activeOpacity={0.7}
              >
                <X size={16} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )
        )}

        {showResponsibilityInput ? (
          <View style={styles.customInputRowNew}>
            <TextInput
              style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
              value={newResponsibility}
              onChangeText={setNewResponsibility}
              placeholder="e.g., Edit 3 short-form videos per week"
              placeholderTextColor={MODAL_TOKENS.textMuted}
              autoFocus
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 250);
              }}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                if (newResponsibility.trim() && responsibilities.length < 10) {
                  setResponsibilities([...responsibilities, newResponsibility.trim()]);
                  setNewResponsibility("");
                  setShowResponsibilityInput(false);
                  Keyboard.dismiss();
                }
              }}
              activeOpacity={0.7}
            >
              <Check size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowCancelButton}
              onPress={() => {
                setShowResponsibilityInput(false);
                setNewResponsibility("");
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
            >
              <X size={20} color={MODAL_TOKENS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : responsibilities.length < 10 && (
          <TouchableOpacity
            style={styles.addListItemButton}
            onPress={() => setShowResponsibilityInput(true)}
            activeOpacity={0.7}
          >
            <Plus size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
            <Text style={styles.addListItemText}>
              Add Responsibility ({10 - responsibilities.length} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </BlurView>
    </ScrollView>
  );

  // ─── STEP 4: Core Requirements (was Step 3) ───────────────────────────────
  const renderStep4 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Target size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Core Requirements</Text>
          </View>
        </View>
        <View style={styles.infoBox}>
          <Info size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
          <Text style={styles.infoText}>
            These requirements apply to ALL applicants regardless of role.
          </Text>
        </View>

        <Text style={styles.labelNew}>Experience Level</Text>
        <View style={styles.dropdownContainer}>
          {["any", "beginner", "intermediate", "advanced"].map((level) => {
            const isSelected = experienceLevel === level;
            return (
              <TouchableOpacity
                key={level}
                style={[
                  styles.dropdownItem,
                  isSelected && styles.dropdownItemSelected,
                ]}
                onPress={() => setExperienceLevel(level)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    isSelected && styles.dropdownItemTextSelected,
                  ]}
                >
                  {level === "any"
                    ? "Any Level"
                    : level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
                {isSelected && (
                  <Check size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.labelNew}>Availability *</Text>
        <TextInput
          style={styles.inputNew}
          value={availability}
          onChangeText={setAvailability}
          placeholder="e.g., 10 hrs/week OR 3 videos/week"
          placeholderTextColor={MODAL_TOKENS.textMuted}
          maxLength={100}
        />

        <Text style={styles.labelNew}>Expected Turnaround *</Text>
        <TextInput
          style={styles.inputNew}
          value={turnaround}
          onChangeText={setTurnaround}
          placeholder="e.g., 48 hours per video"
          placeholderTextColor={MODAL_TOKENS.textMuted}
          maxLength={100}
        />

        <Text style={styles.labelNew}>Timezone Preference (Optional)</Text>
        <TextInput
          style={styles.inputNew}
          value={timezone}
          onChangeText={setTimezone}
          placeholder="e.g., IST, EST, or Any"
          placeholderTextColor={MODAL_TOKENS.textMuted}
        />

        <Text style={styles.labelNew}>Application Deadline (Optional)</Text>
        <TouchableOpacity
          style={styles.datePickerTrigger}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.datePickerLeft}>
            <Calendar size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
            <Text style={styles.datePickerText}>
              {expiresAt
                ? expiresAt.toLocaleDateString("en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Select Deadline"}
            </Text>
          </View>
          {expiresAt ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setExpiresAt(null);
              }}
              style={styles.clearDateButton}
              activeOpacity={0.7}
            >
              <X size={16} color={MODAL_TOKENS.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={18} color={MODAL_TOKENS.textMuted} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <CustomDatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          startDate={expiresAt}
          endDate={null}
          singleMode={true}
          minDate={new Date()}
          onConfirm={({ startDate: newStart }) => {
            setExpiresAt(newStart);
            setShowDatePicker(false);
          }}
        />
      </BlurView>
    </KeyboardAwareScrollView>
  );

  const renderStep5 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Award size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Skill Requirements</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            Configure requirements for each role. Applicants can apply if they match
            ANY ONE role.
          </Text>
        </View>

        <View style={styles.eligibilityToggle}>
          <TouchableOpacity
            style={[
              styles.eligibilityOption,
              eligibilityMode === "any_one" && styles.eligibilityOptionSelected,
            ]}
            onPress={() => setEligibilityMode("any_one")}
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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

        {skillGroups.map((group) => {
          const roleColor = MODAL_TOKENS.primary;
          const roleBg = "rgba(41, 98, 255, 0.04)";
          const roleBorder = "rgba(41, 98, 255, 0.15)";

          return (
            <View
              key={group.role}
              style={[
                styles.skillGroupCard,
                { backgroundColor: roleBg, borderColor: roleBorder }
              ]}
            >
              <Text style={[styles.skillGroupTitle, { color: roleColor }]}>
                {group.role}
              </Text>

              <Text style={styles.skillGroupLabel}>Tools/Skills Required</Text>
              <View style={styles.toolsContainer}>
                {(TOOL_PRESETS[group.role] || []).map((tool) => {
                  const isSelected = group.tools.includes(tool);
                  return (
                    <TouchableOpacity
                      key={tool}
                      style={[
                        styles.toolChip,
                        isSelected && [styles.toolChipSelected, { backgroundColor: roleColor }],
                      ]}
                      onPress={() => toggleTool(group.role, tool)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.toolChipText,
                          isSelected && styles.toolChipTextSelected,
                        ]}
                      >
                        {tool}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {group.tools
                  .filter((t) => !(TOOL_PRESETS[group.role] || []).includes(t))
                  .map((tool) => (
                    <TouchableOpacity
                      key={tool}
                      style={[styles.toolChip, styles.toolChipSelected, { backgroundColor: roleColor }]}
                      onPress={() => toggleTool(group.role, tool)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.toolChipTextSelected}>{tool}</Text>
                      <X
                        size={12}
                        color="#FFFFFF"
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  ))}

                {!showCustomToolInput[group.role] && (
                  <TouchableOpacity
                    style={[styles.toolChip, styles.chipAddNew]}
                    onPress={() =>
                      setShowCustomToolInput({
                        ...showCustomToolInput,
                        [group.role]: true,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Plus size={14} color={roleColor} />
                    <Text style={[styles.chipAddTextNew, { color: roleColor }]}>Custom</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showCustomToolInput[group.role] && (
                <View style={styles.customInputRowNew}>
                  <TextInput
                    style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
                    value={customTool}
                    onChangeText={setCustomTool}
                    placeholder="Enter custom tool"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                    autoFocus
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: roleColor }]}
                    onPress={() => addCustomTool(group.role)}
                    activeOpacity={0.7}
                  >
                    <Check size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowCancelButton}
                    onPress={() => {
                      setShowCustomToolInput({
                        ...showCustomToolInput,
                        [group.role]: false,
                      });
                      setCustomTool("");
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={MODAL_TOKENS.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.skillGroupLabel}>Work Sample Expected</Text>
              <View style={styles.sampleTypesContainer}>
                {(SAMPLE_TYPES[group.role] || []).map((type) => {
                  const currentTypes = group.sample_types || [];
                  const isSelected = currentTypes.includes(type);
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.sampleTypeChip,
                        isSelected && [styles.sampleTypeChipSelected, { borderColor: roleColor, backgroundColor: `${roleColor}10` }],
                      ]}
                      onPress={() => toggleSampleType(group.role, type)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.sampleTypeText,
                          isSelected && [styles.sampleTypeTextSelected, { color: roleColor }],
                        ]}
                      >
                        {type}
                      </Text>
                      {isSelected && (
                        <X size={11} color={roleColor} style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Custom sample types added by the user */}
                {(group.sample_types || [])
                  .filter((t) => !(SAMPLE_TYPES[group.role] || []).includes(t))
                  .map((customType) => (
                    <TouchableOpacity
                      key={customType}
                      style={[styles.sampleTypeChip, styles.sampleTypeChipSelected, { borderColor: roleColor, backgroundColor: `${roleColor}10` }]}
                      onPress={() => removeSampleType(group.role, customType)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sampleTypeTextSelected, { color: roleColor }]}>
                        {customType}
                      </Text>
                      <X size={11} color={roleColor} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  ))}

                {!showCustomSampleInput[group.role] && (
                  <TouchableOpacity
                    style={[styles.sampleTypeChip, styles.chipAddNew]}
                    onPress={() =>
                      setShowCustomSampleInput({
                        ...showCustomSampleInput,
                        [group.role]: true,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Plus size={14} color={roleColor} />
                    <Text style={[styles.chipAddTextNew, { color: roleColor }]}>Custom</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showCustomSampleInput[group.role] && (
                <View style={styles.customInputRowNew}>
                  <TextInput
                    style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
                    value={customSampleType}
                    onChangeText={setCustomSampleType}
                    placeholder="Enter custom sample type"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                    autoFocus
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.addButton, { backgroundColor: roleColor }]}
                    onPress={() => addCustomSampleType(group.role)}
                    activeOpacity={0.7}
                  >
                    <Check size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rowCancelButton}
                    onPress={() => {
                      setShowCustomSampleInput({
                        ...showCustomSampleInput,
                        [group.role]: false,
                      });
                      setCustomSampleType("");
                      Keyboard.dismiss();
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={MODAL_TOKENS.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </BlurView>
    </KeyboardAwareScrollView>
  );

  const renderStep8 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Coins size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Compensation</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            How will you compensate the selected talent?
          </Text>
        </View>

        {/* Payment Type is only shown for paid opportunities or paid trials */}
        {(paymentNature === "paid" || (paymentNature === "trial" && trialType === "paid_trial")) && (
          <>
            <Text style={styles.labelNew}>Payment Type</Text>
            <View style={styles.optionsRow}>
              {[
                { value: "fixed", label: "Fixed" },
                { value: "monthly", label: "Monthly" },
                { value: "per_deliverable", label: "Per Deliverable" },
              ].map((opt) => {
                const isSelected = paymentType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.paymentTypeChip,
                      isSelected && styles.paymentTypeChipSelected,
                    ]}
                    onPress={() => setPaymentType(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.paymentTypeText,
                        isSelected && styles.paymentTypeTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Budget range is shown for paid, paid trial, or revenue share */}
        {(paymentNature === "paid" || 
          (paymentNature === "trial" && trialType === "paid_trial") || 
          paymentNature === "revenue_share") && (
          <>
            <Text style={styles.labelNew}>
              Budget Range{isBudgetRequired ? "" : " (Optional)"}
            </Text>
            <View style={styles.budgetRowContainer}>
              <View style={styles.currencyToggleContainer}>
                {["₹", "$"].map((symbol) => {
                  const isSelected = currency === symbol;
                  return (
                    <TouchableOpacity
                      key={symbol}
                      style={[
                        styles.currencyTogglePill,
                        isSelected && styles.currencyTogglePillSelected,
                      ]}
                      onPress={() => setCurrency(symbol)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.currencyToggleText,
                          isSelected && styles.currencyToggleTextSelected,
                        ]}
                      >
                        {symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.budgetInputsRow}>
                <View style={styles.budgetInputWrapper}>
                  <TextInput
                    style={styles.budgetInput}
                    value={minBudget}
                    onChangeText={setMinBudget}
                    placeholder="Min"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
                <Text style={styles.budgetRangeDash}>-</Text>
                <View style={styles.budgetInputWrapper}>
                  <TextInput
                    style={styles.budgetInput}
                    value={maxBudget}
                    onChangeText={setMaxBudget}
                    placeholder="Max"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>
          </>
        )}

        <Text style={styles.labelNew}>Payment Nature</Text>
        <View style={styles.paymentNatureContainer}>
          {[
            { value: "paid", label: "Paid", Icon: Coins },
            { value: "trial", label: "Trial-based", Icon: Clock },
            { value: "exposure", label: "Exposure / Unpaid", Icon: Eye },
            { value: "revenue_share", label: "Revenue Share", Icon: PieChart },
          ].map((opt) => {
            const isSelected = paymentNature === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.paymentNatureCard,
                  isSelected && styles.paymentNatureCardSelected,
                ]}
                onPress={() => setPaymentNature(opt.value)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    isSelected && styles.optionIconContainerSelected,
                  ]}
                >
                  <opt.Icon
                    size={20}
                    color={isSelected ? MODAL_TOKENS.primary : MODAL_TOKENS.textSecondary}
                    strokeWidth={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.paymentNatureLabel,
                      isSelected && styles.paymentNatureLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    isSelected && styles.radioOuterSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {paymentNature === "trial" && (
          <View style={styles.trialSubTypeContainer}>
            <Text style={styles.labelNew}>Trial Task Type</Text>
            <View style={styles.optionsRow}>
              {[
                { value: "paid_trial", label: "Paid Trial Task", Icon: Coins },
                { value: "free_trial", label: "Free Trial Task", Icon: Clock },
              ].map((opt) => {
                const isSel = trialType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionCard,
                      isSel && styles.optionCardSelected,
                    ]}
                    onPress={() => setTrialType(opt.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.optionIconContainer,
                      isSel && styles.optionIconContainerSelected,
                    ]}>
                      <opt.Icon
                        size={20}
                        color={isSel ? MODAL_TOKENS.primary : MODAL_TOKENS.textSecondary}
                        strokeWidth={2}
                      />
                    </View>
                    <Text style={[
                      styles.optionLabel,
                      isSel && styles.optionLabelSelected,
                    ]}>{opt.label}</Text>
                    {isSel && (
                      <View style={styles.cardCheckCircle}>
                        <Check size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        {paymentNature === "exposure" && (
          <View style={styles.infoBox}>
            <Info size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
            <Text style={styles.infoText}>
              This opportunity offers experience and recognition in place of monetary compensation.
            </Text>
          </View>
        )}
      </BlurView>
    </KeyboardAwareScrollView>
  );

  // ─── NEW STEP 6: Who Can Apply ───────────────────────────────────────
  const renderStep6 = () => {
    const WHO_PRESETS = [
      "Students",
      "Freshers",
      "Working Professionals",
      "Freelancers",
      "Anyone",
    ];
    const toggleWho = (item) => {
      if (whoCanApply.includes(item)) {
        setWhoCanApply(whoCanApply.filter((w) => w !== item));
      } else {
        setWhoCanApply([...whoCanApply, item]);
      }
    };
    return (
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
        bottomOffset={15}
      >
        <BlurView intensity={50} tint="light" style={styles.glassCard}>
          <View style={styles.sectionHeaderNew}>
            <View style={styles.sectionHeaderTitleRow}>
              <View style={styles.sectionHeaderIconContainer}>
                <Users size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
              </View>
              <Text style={styles.sectionHeaderTitle}>Who Can Apply</Text>
            </View>
            <Text style={styles.sectionHeaderHelper}>
              Define your ideal applicant profile. This section is optional.
            </Text>
          </View>

          <Text style={styles.labelNew}>Eligible Applicants</Text>
          <Text style={styles.multiSelectHint}>Select all that apply</Text>
          <View style={styles.chipsContainerNew}>
            {WHO_PRESETS.map((item) => {
              const isSelected = whoCanApply.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelectedNew,
                  ]}
                  onPress={() => toggleWho(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipTextNew,
                    isSelected && styles.chipTextSelectedNew,
                  ]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {whoCanApply
              .filter((w) => !WHO_PRESETS.includes(w))
              .map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, styles.chipSelectedNew]}
                  onPress={() => toggleWho(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipTextSelectedNew}>{item}</Text>
                  <X size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              ))}
            {!showWhoCanApplyInput && (
              <TouchableOpacity
                style={[styles.chip, styles.chipAddNew]}
                onPress={() => setShowWhoCanApplyInput(true)}
                activeOpacity={0.7}
              >
                <Plus size={14} color={MODAL_TOKENS.primary} />
                <Text style={styles.chipAddTextNew}>Custom</Text>
              </TouchableOpacity>
            )}
          </View>

          {showWhoCanApplyInput && (
            <View style={styles.customInputRowNew}>
              <TextInput
                style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
                value={customWhoCanApply}
                onChangeText={setCustomWhoCanApply}
                placeholder="e.g., Design students"
                placeholderTextColor={MODAL_TOKENS.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (customWhoCanApply.trim()) {
                    setWhoCanApply([...whoCanApply, customWhoCanApply.trim()]);
                    setCustomWhoCanApply("");
                    setShowWhoCanApplyInput(false);
                    Keyboard.dismiss();
                  }
                }}
                activeOpacity={0.7}
              >
                <Check size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowCancelButton}
                onPress={() => {
                  setShowWhoCanApplyInput(false);
                  setCustomWhoCanApply("");
                  Keyboard.dismiss();
                }}
                activeOpacity={0.7}
              >
                <X size={20} color={MODAL_TOKENS.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {whoCanApply.length === 0 && (
            <View style={styles.infoBox}>
              <Info size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
              <Text style={styles.infoText}>
                Skip this step to allow anyone to apply, or select specific groups to narrow the pool.
              </Text>
            </View>
          )}
        </BlurView>
      </KeyboardAwareScrollView>
    );
  };

  // ─── NEW STEP 7: What You'll Gain ─────────────────────────────────────
  const renderStep7 = () => {
    const GAIN_PRESETS = [
      "Certificate",
      "Real-world Experience",
      "Letter of Recommendation",
      "Full-time Opportunity",
      "Mentorship",
      "Portfolio Work",
    ];
    return (
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
        bottomOffset={15}
      >
        <BlurView intensity={50} tint="light" style={styles.glassCard}>
          <View style={styles.sectionHeaderNew}>
            <View style={styles.sectionHeaderTitleRow}>
              <View style={styles.sectionHeaderIconContainer}>
                <Gift size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
              </View>
              <Text style={styles.sectionHeaderTitle}>What You'll Gain</Text>
            </View>
            <Text style={styles.sectionHeaderHelper}>
              Optional. Tell applicants what they'll get from this opportunity.
            </Text>
          </View>

          <View style={[styles.infoBox, { marginBottom: 16 }]}>
            <Star size={18} color="#F59E0B" strokeWidth={2} />
            <Text style={[styles.infoText, { color: "#92400E" }]}>
              Opportunities with clear benefits get significantly more quality applicants.
            </Text>
          </View>

          <Text style={styles.labelNew}>Quick Add</Text>
          <View style={styles.chipsContainerNew}>
            {GAIN_PRESETS.map((preset) => {
              const isAdded = gains.includes(preset);
              return (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.chip,
                    isAdded && styles.chipSelectedNew,
                  ]}
                  onPress={() => {
                    if (isAdded) {
                      setGains(gains.filter((g) => g !== preset));
                    } else if (gains.length < 8) {
                      setGains([...gains, preset]);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipTextNew,
                    isAdded && styles.chipTextSelectedNew,
                  ]}>{preset}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.labelNew}>
            Your List
            <Text style={styles.hint}> ({gains.length}/8)</Text>
          </Text>

          {gains.map((item, index) => (
            <View key={index} style={styles.listItemRow}>
              <View style={[styles.listBullet, { backgroundColor: "#F59E0B" }]} />
              <Text style={styles.listItemText} numberOfLines={2}>{item}</Text>
              <TouchableOpacity
                style={styles.listItemDelete}
                onPress={() => setGains(gains.filter((_, i) => i !== index))}
                activeOpacity={0.7}
              >
                <X size={16} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))}

          {showGainInput ? (
            <View style={styles.customInputRowNew}>
              <TextInput
                style={[styles.inputNew, { flex: 1, marginBottom: 0 }]}
                value={newGain}
                onChangeText={setNewGain}
                placeholder="e.g., Paid internship after completion"
                placeholderTextColor={MODAL_TOKENS.textMuted}
                autoFocus
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 300);
                }}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  if (newGain.trim() && gains.length < 8) {
                    setGains([...gains, newGain.trim()]);
                    setNewGain("");
                    setShowGainInput(false);
                    Keyboard.dismiss();
                  }
                }}
                activeOpacity={0.7}
              >
                <Check size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rowCancelButton}
                onPress={() => {
                  setShowGainInput(false);
                  setNewGain("");
                  Keyboard.dismiss();
                }}
                activeOpacity={0.7}
              >
                <X size={20} color={MODAL_TOKENS.textMuted} />
              </TouchableOpacity>
            </View>
          ) : gains.length < 8 && (
            <TouchableOpacity
              style={styles.addListItemButton}
              onPress={() => setShowGainInput(true)}
              activeOpacity={0.7}
            >
              <Plus size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
              <Text style={styles.addListItemText}>
                Add Custom Benefit ({8 - gains.length} remaining)
              </Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </KeyboardAwareScrollView>
    );
  };

  // ─── STEP 8: Compensation (was Step 5) ────────────────────────────────
  const renderStep9 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <HelpCircle size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Application Questions</Text>
          </View>
        </View>

        <View style={styles.autoIncludedBox}>
          <Text style={styles.autoIncludedTitle}>
            Auto-Included (Not editable)
          </Text>
          <View style={styles.autoItem}>
            <CheckCircle2 size={16} color="#16A34A" strokeWidth={2} />
            <Text style={styles.autoItemText}>Applicant Profile</Text>
          </View>
          <View style={styles.autoItem}>
            <CheckCircle2 size={16} color="#16A34A" strokeWidth={2} />
            <Text style={styles.autoItemText}>Skill Applied For</Text>
          </View>
          <View style={styles.autoItem}>
            <CheckCircle2 size={16} color="#16A34A" strokeWidth={2} />
            <Text style={styles.autoItemText}>Portfolio Samples</Text>
          </View>
        </View>

        <Text style={styles.labelNew}>Your Questions (max 4)</Text>

        {questions.map((q, index) => (
          <View key={index} style={styles.questionCard}>
            <View style={styles.questionHeader}>
              <Text style={styles.questionNumber}>Question {index + 1}</Text>
              <TouchableOpacity
                onPress={() => removeQuestion(index)}
                activeOpacity={0.7}
                style={styles.trashIconContainer}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.questionInput}
              value={q.prompt}
              onChangeText={(text) => updateQuestion(index, "prompt", text)}
              placeholder="Enter your question"
              placeholderTextColor={MODAL_TOKENS.textMuted}
              multiline
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 300);
              }}
            />
            <View style={styles.requiredRow}>
              <Text style={styles.requiredLabel}>Required</Text>
              <Switch
                value={q.required}
                onValueChange={(val) => updateQuestion(index, "required", val)}
                trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                thumbColor={q.required ? MODAL_TOKENS.primary : "#FFFFFF"}
              />
            </View>
          </View>
        ))}

        {questions.length <= 3 && (
          <TouchableOpacity
            style={styles.addQuestionButton}
            onPress={addQuestion}
            activeOpacity={0.7}
          >
            <Plus size={18} color={MODAL_TOKENS.primary} strokeWidth={2} />
            <Text style={styles.addQuestionText}>
              Add Question ({4 - questions.length} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </BlurView>
    </KeyboardAwareScrollView>
  );

  const renderStep10 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <Eye size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Visibility</Text>
          </View>
          <Text style={styles.sectionHeaderHelper}>
            Who should see this opportunity?
          </Text>
        </View>

        <View style={styles.visibilityOptions}>
          {[
            {
              value: "public",
              title: "Public",
              description: "Anyone on SnooSpace can discover",
              Icon: Globe,
            },
            {
              value: "community",
              title: "Community Only",
              description: "Only members of your community",
              Icon: Users,
            },
            {
              value: "invite",
              title: "Invite Only",
              description: "Share link manually",
              Icon: Link,
            },
          ].map((opt) => {
            const isSelected = visibility === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.visibilityCard,
                  isSelected && styles.visibilityCardSelected,
                ]}
                onPress={() => setVisibility(opt.value)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    isSelected && styles.optionIconContainerSelected,
                  ]}
                >
                  <opt.Icon
                    size={20}
                    color={isSelected ? MODAL_TOKENS.primary : MODAL_TOKENS.textSecondary}
                    strokeWidth={2}
                  />
                </View>
                <View style={styles.visibilityText}>
                  <Text
                    style={[
                      styles.visibilityTitle,
                      isSelected && styles.visibilityTitleSelected,
                    ]}
                  >
                    {opt.title}
                  </Text>
                  <Text style={styles.visibilityDescription}>
                    {opt.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    isSelected && styles.radioOuterSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
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
            trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
            thumbColor={notifyTalent ? MODAL_TOKENS.primary : "#FFFFFF"}
          />
        </View>
      </BlurView>
    </KeyboardAwareScrollView>
  );

  const renderStep11 = () => (
    <KeyboardAwareScrollView
      ref={scrollViewRef}
      style={styles.stepContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 220, paddingTop: 12 }}
      bottomOffset={15}
    >
      <BlurView intensity={50} tint="light" style={styles.glassCard}>
        <View style={styles.sectionHeaderNew}>
          <View style={styles.sectionHeaderTitleRow}>
            <View style={styles.sectionHeaderIconContainer}>
              <CheckCircle size={22} color={MODAL_TOKENS.primary} strokeWidth={2} />
            </View>
            <Text style={styles.sectionHeaderTitle}>Review & Publish</Text>
          </View>
        </View>

        <View style={styles.reviewCard}>
          {/* Basics -> Step 1 */}
          <TouchableOpacity
            onPress={() => setCurrentStep(1)}
            activeOpacity={0.7}
            style={{ marginBottom: 14 }}
          >
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
          </TouchableOpacity>

          {/* Work Details -> Step 2 */}
          <TouchableOpacity
            style={styles.reviewRow}
            onPress={() => setCurrentStep(2)}
            activeOpacity={0.7}
          >
            <Briefcase strokeWidth={2} size={18} color={MODAL_TOKENS.textSecondary} />
            <Text style={styles.reviewText}>
              {workType === "one_time" ? "One-time" : "Ongoing"} ·{" "}
              {workModes.includes("remote") && workModes.includes("on_site") ? "Hybrid" : workModes.map(m => m === "remote" ? "Remote" : "On-site").join(", ")}
            </Text>
          </TouchableOpacity>

          {/* Compensation -> Step 8 */}
          <TouchableOpacity
            style={styles.reviewRow}
            onPress={() => setCurrentStep(8)}
            activeOpacity={0.7}
          >
            <Banknote size={18} color={MODAL_TOKENS.textSecondary} strokeWidth={2} />
            <Text style={styles.reviewText}>
              {paymentNature === "exposure"
                ? "Exposure / Unpaid"
                : paymentNature === "trial"
                  ? `Trial-based · ${trialType === "paid_trial" ? `Paid Task · ${getPaymentTypeDisplayText(paymentType)}` : "Free Task"}`
                  : paymentNature === "revenue_share"
                    ? "Revenue Share"
                    : `${getPaymentTypeDisplayText(paymentType)} · Paid`}
              {budgetRange && paymentNature !== "exposure" && !(paymentNature === "trial" && trialType === "free_trial") ? ` · ${budgetRange}` : ""}
            </Text>
          </TouchableOpacity>

          {/* Visibility -> Step 10 */}
          <TouchableOpacity
            style={styles.reviewRow}
            onPress={() => setCurrentStep(10)}
            activeOpacity={0.7}
          >
            <Eye size={18} color={MODAL_TOKENS.textSecondary} strokeWidth={2} />
            <Text style={styles.reviewText}>
              {visibility === "public" ? "Public" : visibility === "community" ? "Community Only" : "Invite Only"}
            </Text>
          </TouchableOpacity>

          <View style={styles.reviewDivider} />

          {/* About the Role -> Step 3 */}
          {(aboutRole.trim() || responsibilities.length > 0) && (
            <TouchableOpacity
              onPress={() => setCurrentStep(3)}
              activeOpacity={0.7}
              style={{ marginBottom: 12 }}
            >
              <Text style={styles.reviewSectionTitle}>About the Role</Text>
              {aboutRole.trim() ? (
                <Text style={styles.reviewBullet} numberOfLines={2}>
                  {aboutRole.trim()}
                </Text>
              ) : null}
              {responsibilities.slice(0, 3).map((r, i) => (
                <Text key={i} style={styles.reviewBullet}>• {r}</Text>
              ))}
              {responsibilities.length > 3 && (
                <Text style={styles.reviewBullet}>
                  + {responsibilities.length - 3} more responsibilities
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.reviewDivider} />

          {/* Core Requirements -> Step 4 */}
          <TouchableOpacity
            onPress={() => setCurrentStep(4)}
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <Text style={styles.reviewSectionTitle}>Core Requirements</Text>
            <Text style={styles.reviewBullet}>
              • {experienceLevel === "any" ? "Any" : experienceLevel} experience level
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
          </TouchableOpacity>

          <View style={styles.reviewDivider} />

          {/* Application Eligibility -> Step 5 */}
          <TouchableOpacity
            onPress={() => setCurrentStep(5)}
            activeOpacity={0.7}
            style={{ marginBottom: 12 }}
          >
            <Text style={styles.reviewSectionTitle}>Application Eligibility</Text>
            <Text style={styles.reviewBullet}>
              ✓ Match {eligibilityMode === "any_one" ? "ANY ONE" : "MULTIPLE"} skill
              group{eligibilityMode !== "any_one" ? "s" : ""}
            </Text>
          </TouchableOpacity>

          {/* Who Can Apply -> Step 6 */}
          {whoCanApply.length > 0 && (
            <>
              <View style={styles.reviewDivider} />
              <TouchableOpacity
                onPress={() => setCurrentStep(6)}
                activeOpacity={0.7}
                style={{ marginBottom: 12 }}
              >
                <Text style={styles.reviewSectionTitle}>Who Can Apply</Text>
                <Text style={styles.reviewBullet}>
                  {whoCanApply.join(", ")}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* What You'll Gain -> Step 7 */}
          {gains.length > 0 && (
            <>
              <View style={styles.reviewDivider} />
              <TouchableOpacity
                onPress={() => setCurrentStep(7)}
                activeOpacity={0.7}
                style={{ marginBottom: 12 }}
              >
                <Text style={styles.reviewSectionTitle}>What You'll Gain</Text>
                {gains.slice(0, 4).map((g, i) => (
                  <Text key={i} style={styles.reviewBullet}>• {g}</Text>
                ))}
                {gains.length > 4 && (
                  <Text style={styles.reviewBullet}>+ {gains.length - 4} more</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.reviewDivider} />

          {/* Questions -> Step 9 */}
          <TouchableOpacity
            onPress={() => setCurrentStep(9)}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
        </View>

        <Text style={styles.editHint}>Tap any section above to edit</Text>
      </BlurView>
    </KeyboardAwareScrollView>
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
      case 9:
        return renderStep9();
      case 10:
        return renderStep10();
      case 11:
        return renderStep11();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#F8FAFC", "#EEF2F6", "#E2E8F0"]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.keyboardView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerBackButton} onPress={handleBack} activeOpacity={0.7}>
              <ArrowLeft size={24} color={MODAL_TOKENS.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEditing ? "Edit Opportunity" : "Create Opportunity"}
            </Text>
            {currentStep === TOTAL_STEPS ? (
              <TouchableOpacity style={styles.headerCancelButton} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            ) : isEditing || hasReachedReview ? (
              <TouchableOpacity
                style={styles.headerReviewButton}
                onPress={() => setCurrentStep(TOTAL_STEPS)}
                activeOpacity={0.7}
              >
                <Text style={styles.reviewButtonText}>
                  Review
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.headerCancelButton} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressPercent.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                ]} />
            </View>
          </View>

          {/* Step Content */}
          {renderCurrentStep()}
        </View>

        {/* Footer */}
        {!isKeyboardVisible && (
          <View style={styles.stickyFooter}>
            <View style={[
              styles.footer,
              { paddingBottom: insets.bottom + 24 },
              currentStep === TOTAL_STEPS && { justifyContent: "center" }
            ]}>
              {currentStep === TOTAL_STEPS ? (
                <TouchableOpacity
                  style={styles.publishButton}
                  onPress={() => handlePublish(false)}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={MODAL_TOKENS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.publishGradient}
                  >
                    {saving ? (
                      <SnooLoader color="#FFFFFF" />
                    ) : (
                      <>
                        <Zap size={18} color="#FFFFFF" strokeWidth={2} />
                        <Text style={styles.publishButtonText}>
                          {isEditing ? "Update" : "Publish"}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    !isStepFormComplete(currentStep) && styles.nextButtonDisabled,
                  ]}
                  onPress={handleNext}
                  disabled={!isStepFormComplete(currentStep)}
                  activeOpacity={0.7}
                >
                  {isStepFormComplete(currentStep) ? (
                    <LinearGradient
                      colors={MODAL_TOKENS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.nextGradient}
                    >
                      <Text style={styles.nextButtonText}>Next</Text>
                      <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.nextGradient, { backgroundColor: "rgba(41, 98, 255, 0.2)" }]}>
                      <Text style={[styles.nextButtonText, { color: "rgba(41, 98, 255, 0.45)" }]}>Next</Text>
                      <ArrowRight size={18} color="rgba(41, 98, 255, 0.4)" strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Draft Resume Modal */}
        <Modal
          visible={showDraftPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDraftPrompt(false)}
          statusBarTranslucent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.draftPromptCard}>
              <View style={styles.draftPromptIcon}>
                <FileCheck size={32} color={MODAL_TOKENS.primary} strokeWidth={2} />
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
                  activeOpacity={0.7}
                >
                  <Text style={styles.draftPromptSecondaryText}>Start Fresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.draftPromptPrimary}
                  onPress={loadDraftData}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={MODAL_TOKENS.primaryGradient}
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

        {/* Save Draft Confirmation Modal */}
        <Modal
          visible={showSaveDraftModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSaveDraftModal(false)}
          statusBarTranslucent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.draftPromptCard}>
              <View style={styles.draftPromptIcon}>
                <FileCheck size={32} color={MODAL_TOKENS.primary} strokeWidth={2} />
              </View>
              <Text style={styles.draftPromptTitle}>Save Draft?</Text>
              <Text style={styles.draftPromptMessage}>
                Would you like to save your progress?
              </Text>
              <View style={styles.modalButtonsColumn}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={async () => {
                    setShowSaveDraftModal(false);
                    await saveDraft(true);
                    navigation.goBack();
                  }}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={MODAL_TOKENS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalPrimaryButtonGradient}
                  >
                    <Text style={styles.modalPrimaryButtonText}>Save Draft</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={async () => {
                    setShowSaveDraftModal(false);
                    // Delete the draft so Resume prompt doesn't appear next time
                    try {
                      if (userId) await deleteOpportunityDraft(userId);
                    } catch (e) {
                      console.warn("Failed to delete draft on discard:", e);
                    }
                    navigation.goBack();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalSecondaryButtonText}>Discard Changes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalTertiaryButton}
                  onPress={() => setShowSaveDraftModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalTertiaryButtonText}>Keep Editing</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Opportunity Creation Outcome Success Modal */}
        <OpportunitySuccessModal
          visible={successModalVisible}
          title={successModalData.title}
          message={successModalData.message}
          isDraft={successModalData.isDraft}
          onClose={() => {
            setSuccessModalVisible(false);
            if (successModalData.opportunity) {
              EventBus.emit("opportunityUpdated", successModalData.opportunity);
            }
            navigation.goBack();
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  keyboardView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
    backgroundColor: "transparent",
  },
  headerBackButton: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Black",
    color: "#0F172A",
    textAlign: "center",
    maxWidth: "60%",
  },
  headerCancelButton: {
    position: "absolute",
    right: 16,
    height: 32,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 16,
  },
  headerReviewButton: {
    position: "absolute",
    right: 16,
    height: 32,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(41, 98, 255, 0.1)",
    borderRadius: 16,
  },
  reviewButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#EF4444",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2962FF",
    borderRadius: 3,
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  glassCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    overflow: "hidden",
    marginBottom: 20,
  },
  sectionHeaderNew: {
    marginBottom: 20,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  sectionHeaderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#0F172A",
  },
  sectionHeaderHelper: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#475569",
  },
  inputContainerNew: {
    marginBottom: 10,
  },
  labelNew: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
    marginBottom: 8,
    marginTop: 16,
  },
  inputNew: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#0F172A",
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#94A3B8",
    textAlign: "right",
    marginBottom: 8,
  },
  hint: {
    fontFamily: "Manrope-Regular",
    color: "#94A3B8",
  },
  chipsContainerNew: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    height: 40,
  },
  chipSelectedNew: {
    backgroundColor: "#2962FF",
    borderColor: "#2962FF",
  },
  chipDisabledNew: {
    opacity: 0.35,
  },
  chipTextNew: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
  },
  chipTextSelectedNew: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  chipAddNew: {
    backgroundColor: "rgba(41, 98, 255, 0.05)",
    borderColor: "rgba(41, 98, 255, 0.12)",
    borderWidth: 1,
    borderStyle: "solid",
  },
  chipAddTextNew: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
    marginLeft: 4,
  },
  customInputRowNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  addButton: {
    backgroundColor: "#2962FF",
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
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  optionCardSelected: {
    borderColor: "rgba(41, 98, 255, 0.4)",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionIconContainerSelected: {
    backgroundColor: "rgba(41, 98, 255, 0.12)",
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
  },
  optionLabelSelected: {
    color: "#2962FF",
    fontFamily: "Manrope-SemiBold",
  },
  cardCheckCircle: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2962FF",
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#1E3A8A",
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#B45309",
    lineHeight: 18,
  },
  dropdownContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
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
    borderBottomColor: "rgba(0, 0, 0, 0.04)",
  },
  dropdownItemSelected: {
    backgroundColor: "rgba(41, 98, 255, 0.06)",
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#475569",
  },
  dropdownItemTextSelected: {
    color: "#2962FF",
    fontFamily: "Manrope-SemiBold",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  datePickerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  datePickerText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#0F172A",
  },
  eligibilityToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: 24,
    padding: 4,
    height: 48,
    marginBottom: 16,
  },
  eligibilityOption: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  eligibilityOptionSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  eligibilityText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#67758A",
  },
  eligibilityTextSelected: {
    color: "#2962FF",
    fontFamily: "Manrope-SemiBold",
  },
  skillGroupCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  skillGroupTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    marginBottom: 12,
  },
  skillGroupLabel: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#64748B",
    marginBottom: 8,
    marginTop: 12,
  },
  toolsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toolChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    height: 36,
  },
  toolChipSelected: {
    // dynamically styled
  },
  toolChipText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
  },
  toolChipTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  sampleTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sampleTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    height: 36,
  },
  sampleTypeChipSelected: {
    // dynamically styled
  },
  sampleTypeText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
  },
  sampleTypeTextSelected: {
    fontFamily: "Manrope-SemiBold",
  },
  paymentTypeChip: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    height: 44,
    justifyContent: "center",
  },
  paymentTypeChipSelected: {
    backgroundColor: "#2962FF",
    borderColor: "#2962FF",
  },
  paymentTypeText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
  },
  paymentTypeTextSelected: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  paymentNatureContainer: {
    gap: 10,
    marginBottom: 16,
  },
  paymentNatureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  paymentNatureCardSelected: {
    borderColor: "rgba(41, 98, 255, 0.4)",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  paymentNatureLabel: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#475569",
  },
  paymentNatureLabelSelected: {
    color: "#2962FF",
    fontFamily: "Manrope-SemiBold",
  },
  autoIncludedBox: {
    backgroundColor: "rgba(22, 163, 74, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.15)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  autoIncludedTitle: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#166534",
    marginBottom: 10,
  },
  autoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  autoItemText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#15803D",
  },
  questionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
  },
  trashIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  questionInput: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#0F172A",
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
    fontFamily: "Manrope-Medium",
    color: "#475569",
  },
  addQuestionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginBottom: 16,
  },
  addQuestionText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  visibilityOptions: {
    gap: 12,
    marginBottom: 24,
  },
  visibilityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  visibilityCardSelected: {
    borderColor: "rgba(41, 98, 255, 0.4)",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  visibilityText: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
  },
  visibilityTitleSelected: {
    color: "#2962FF",
  },
  visibilityDescription: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  radioOuterSelected: {
    borderColor: "#2962FF",
    backgroundColor: "#2962FF",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  notifyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    padding: 16,
  },
  notifyInfo: {
    flex: 1,
  },
  notifyTitle: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
  },
  notifyDescription: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#64748B",
    marginTop: 2,
  },
  reviewCard: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    marginBottom: 16,
  },
  reviewTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#0F172A",
    marginBottom: 12,
  },
  reviewRoles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  reviewRoleChip: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewRoleText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  reviewText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#334155",
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    marginVertical: 16,
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#0F172A",
    marginBottom: 8,
    marginTop: 8,
  },
  reviewBullet: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#475569",
    marginBottom: 4,
  },
  editHint: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "transparent",
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  nextButton: {
    borderRadius: 24,
    height: 48,
    width: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  nextGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    gap: 8,
    borderRadius: 24,
  },
  nextButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },
  publishButton: {
    borderRadius: 26,
    height: 52,
    width: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  publishGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    gap: 8,
    borderRadius: 26,
  },
  publishButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
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
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  draftPromptTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#0F172A",
    marginBottom: 8,
  },
  draftPromptMessage: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#64748B",
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
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  draftPromptSecondaryText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#475569",
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
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  // Save Draft modal columns & buttons
  modalButtonsColumn: {
    width: "100%",
    gap: 10,
  },
  modalPrimaryButton: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    height: 48,
  },
  modalPrimaryButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  modalSecondaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#EF4444",
  },
  modalTertiaryButton: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTertiaryButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#64748B",
  },
  // Budget range styles
  budgetRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  currencyToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: 14,
    padding: 3,
    height: 48,
    alignItems: "center",
  },
  currencyTogglePill: {
    width: 38,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 11,
  },
  currencyTogglePillSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  currencyToggleText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#64748B",
  },
  currencyToggleTextSelected: {
    color: "#2962FF",
  },
  budgetInputsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  budgetInputWrapper: {
    flex: 1,
    height: 48,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#0F172A",
  },
  budgetRangeDash: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: "#94A3B8",
  },
  // Date picker and custom row cancellation
  clearDateButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 16,
  },
  rowCancelButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  // New styles for enhanced steps
  textareaNew: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 14,
  },
  multiSelectHint: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#94A3B8",
    marginBottom: 10,
    marginTop: -4,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    gap: 10,
  },
  listBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2962FF",
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#0F172A",
    lineHeight: 20,
  },
  listItemDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  listItemEditButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  addListItemButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  addListItemText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#2962FF",
  },
  trialSubTypeContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
});
