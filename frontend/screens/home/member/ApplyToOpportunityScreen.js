import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Lightbulb,
  Link,
  Plus,
  MessageCircleQuestionMark,
  Eye,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  FileCheck,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react-native";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import { applyToOpportunity } from "../../../api/opportunities";
import { BACKEND_BASE_URL } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import SnooLoader from "../../../components/ui/SnooLoader";
import { COLORS, FONTS, BORDER_RADIUS } from "../../../constants/theme";

// ──────────────────────────────────────────────────────
//  Dynamic pitch prompts by role keyword
// ──────────────────────────────────────────────────────
const PITCH_PROMPTS = {
  "video editor": "What's a project you edited that you're most proud of, and why?",
  "video editing": "What's a project you edited that you're most proud of, and why?",
  editor: "What's a project you edited that you're most proud of, and why?",
  "graphic designer": "Walk us through your design process in 2–3 sentences.",
  "graphic design": "Walk us through your design process in 2–3 sentences.",
  designer: "What design work defines your style? Tell us in your own words.",
  photographer: "What's your visual style, and what kind of work lights you up?",
  photography: "What's your visual style, and what kind of work lights you up?",
  videographer: "Describe your approach to storytelling through video.",
  writer: "What's a piece you wrote that you feel best represents your voice?",
  copywriter: "What's a piece you wrote that you feel best represents your voice?",
  developer: "What's a project you built that you're genuinely proud of?",
  "web developer": "What's a project you built that you're genuinely proud of?",
  animator: "What's your favourite piece you've animated, and what made it work?",
  illustrator: "Describe your illustration style and the kind of projects that excite you.",
  "social media": "What content strategy or campaign are you most proud of building?",
  "content creator": "Describe your content approach — what makes your work stand out?",
  marketer: "Tell us about a campaign or initiative you drove end-to-end.",
  "marketing": "Tell us about a campaign or initiative you drove end-to-end.",
};

const PITCH_MIN = 80;
const PITCH_MAX = 700;

function getDynamicPitchPrompt(role) {
  if (!role) return "Why are you the right person for this? Be specific.";
  const lowerRole = role.toLowerCase();
  for (const key of Object.keys(PITCH_PROMPTS)) {
    if (lowerRole.includes(key)) return PITCH_PROMPTS[key];
  }
  return "Why are you the right person for this? Be specific.";
}

// ──────────────────────────────────────────────────────
//  Upload resume to Cloudinary via backend
// ──────────────────────────────────────────────────────
async function uploadResumeToCloudinary(fileUri, fileName) {
  const token = await getAuthToken();
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName || "resume.pdf",
    type: "application/pdf",
  });

  const response = await fetch(`${BACKEND_BASE_URL}/upload/resume`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Upload failed");
  return data.url;
}

function formatSubmittedTime(date) {
  if (!date) return "";
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[date.getMonth()];
  const day = date.getDate();
  
  return `${formattedHours}:${formattedMinutes} ${ampm} • ${monthStr} ${day}`;
}

export default function ApplyToOpportunityScreen({ route, navigation }) {
  const { opportunity } = route.params || {};
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1 — Role
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState([]);

  // Step 2 — Pitch
  const [introPitch, setIntroPitch] = useState("");
  const [isPitchFocused, setIsPitchFocused] = useState(false);

  // Step 3 — Attachments
  const [portfolioLinks, setPortfolioLinks] = useState([""]);
  const [resumeFile, setResumeFile] = useState(null); // { name, uri, url }
  const [resumeUploading, setResumeUploading] = useState(false);
  const [isLinkFocused, setIsLinkFocused] = useState(null);

  // Step 4 — Creator Questions
  const [answers, setAnswers] = useState({});
  const [focusedQuestion, setFocusedQuestion] = useState(null);

  // Step 5 — Applicant Questions
  const [applicantQuestions, setApplicantQuestions] = useState([""]);
  const [focusedAQ, setFocusedAQ] = useState(null);

  const successAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const [submittedAt, setSubmittedAt] = useState(null);

  useEffect(() => {
    if (submitted) {
      // Animate success scale and opacity
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();

      // Loop glow pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [submitted]);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    icon: null,
    iconColor: "#E53E3E",
    primaryAction: null,
  });

  const showAlert = (title, message, icon = AlertCircle, iconColor = "#E53E3E", primaryAction = null) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      icon,
      iconColor,
      primaryAction: primaryAction || { text: "OK", onPress: hideAlert },
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const hasQuestions = opportunity?.questions?.length > 0;
  const requiresResume = opportunity?.requires_resume === true;

  // Dynamic step list
  const STEPS = [
    "role",
    "pitch",
    "attachments",
    ...(hasQuestions ? ["questions"] : []),
    "ask",
    "review",
  ];
  const TOTAL_STEPS = STEPS.length;
  const currentStepKey = STEPS[currentStep - 1];

  const selectedRoleSkillGroup = opportunity?.skill_groups?.find((g) => g.role === selectedRole);
  const selectedRoleTools = selectedRoleSkillGroup?.tools || [];
  const isRoleSelectionValid = !!selectedRole && (selectedRoleTools.length === 0 || selectedSkills.length > 0);

  const getIsStepValid = () => {
    switch (currentStepKey) {
      case "role":
        return isRoleSelectionValid;
      case "pitch":
        return introPitch.trim().length >= PITCH_MIN;
      case "attachments": {
        const hasLink = portfolioLinks.some((l) => l.trim().length > 0);
        const hasFile = !!resumeFile;
        return requiresResume ? hasFile : (hasLink || hasFile);
      }
      case "questions":
        return !(opportunity?.questions || []).some(
          (q) => q.required && (!answers[q.id] || !answers[q.id].trim())
        );
      default:
        return true;
    }
  };

  const isNextDisabled = submitting || !getIsStepValid();

  const getStepTitle = () => {
    switch (currentStepKey) {
      case "role": return "Select Role";
      case "pitch": return "Your Pitch";
      case "attachments": return "Attachments";
      case "questions": return "Questions";
      case "ask": return "Ask Them";
      case "review": return "Review";
      default: return "Apply";
    }
  };

  // ── Validation ──────────────────────────────────────
  const validateStep = () => {
    switch (currentStepKey) {
      case "role":
        if (!isRoleSelectionValid) {
          showAlert("Required", "Please select a role to apply for.");
          return false;
        }
        return true;
      case "pitch":
        if (introPitch.trim().length < PITCH_MIN) {
          showAlert("Too short", `Your pitch needs at least ${PITCH_MIN} characters. Be specific — it makes a difference.`);
          return false;
        }
        return true;
      case "attachments": {
        const hasLink = portfolioLinks.some((l) => l.trim().length > 0);
        const hasFile = !!resumeFile;
        if (requiresResume && !hasFile) {
          showAlert("Required", "Please upload a resume (PDF) to proceed.");
          return false;
        }
        if (!hasLink && !hasFile) {
          showAlert("Required", "Please provide at least one portfolio link or upload a file.");
          return false;
        }
        return true;
      }
      case "questions": {
        const required = (opportunity?.questions || []).find(
          (q) => q.required && (!answers[q.id] || !answers[q.id].trim())
        );
        if (required) {
          showAlert("Required", "Please answer all required questions.");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  // ── Submit ───────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const validLinks = portfolioLinks.filter((l) => l.trim());
      const validAQ = applicantQuestions.filter((q) => q.trim());

      const applicationData = {
        opportunity_id: opportunity.id,
        applied_role: selectedRole,
        // Legacy fields for backward compat
        portfolio_link: validLinks[0] || null,
        portfolio_note: selectedSkills.length > 0
          ? `Applied with skills: ${selectedSkills.join(", ")}`
          : null,
        // New fields
        intro_pitch: introPitch.trim() || null,
        portfolio_links: validLinks,
        resume_url: resumeFile?.url || null,
        applicant_questions: validAQ,
        responses: Object.entries(answers).map(([questionId, answer]) => ({
          question_id: questionId,
          answer,
        })),
      };

      await applyToOpportunity(applicationData);

      // Animate success
      setSubmittedAt(new Date());
      setSubmitted(true);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (error) {
      showAlert(
        "Submission Failed",
        error.message || "Failed to submit application. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Role helpers ─────────────────────────────────────
  const handleToggleSkill = (role, skill) => {
    if (selectedRole !== role) {
      setSelectedRole(role);
      setSelectedSkills([skill]);
    } else {
      const nextSkills = selectedSkills.includes(skill)
        ? selectedSkills.filter((s) => s !== skill)
        : [...selectedSkills, skill];
      setSelectedSkills(nextSkills);
      if (nextSkills.length === 0) {
        setSelectedRole(null);
      }
    }
  };

  const handleSelectRoleHeader = (role, allSkills) => {
    if (selectedRole === role) {
      if (allSkills.length === 0) {
        setSelectedRole(null);
        setSelectedSkills([]);
      } else {
        const allSelected = allSkills.every((s) => selectedSkills.includes(s));
        if (allSelected) {
          setSelectedRole(null);
          setSelectedSkills([]);
        } else {
          setSelectedSkills([...allSkills]);
        }
      }
    } else {
      setSelectedRole(role);
      setSelectedSkills([...allSkills]);
    }
  };

  // ── Portfolio link helpers ───────────────────────────
  const updateLink = (idx, val) => {
    const next = [...portfolioLinks];
    next[idx] = val;
    setPortfolioLinks(next);
  };
  const addLink = () => {
    if (portfolioLinks.length < 3) setPortfolioLinks([...portfolioLinks, ""]);
  };
  const removeLink = (idx) => {
    setPortfolioLinks(portfolioLinks.filter((_, i) => i !== idx));
  };

  // ── Resume picker ────────────────────────────────────
  const handlePickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      // Validate size (10MB limit)
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        showAlert("File too large", "The maximum file size allowed is 10MB.", AlertCircle, "#E53E3E");
        return;
      }

      setResumeUploading(true);
      try {
        const url = await uploadResumeToCloudinary(asset.uri, asset.name);
        setResumeFile({ name: asset.name, uri: asset.uri, url });
      } catch (err) {
        // Store locally even if upload fails — will retry on submit
        setResumeFile({ name: asset.name, uri: asset.uri, url: null, localOnly: true });
        showAlert("Upload notice", "Resume saved locally. We'll try uploading again on submit.", Info, COLORS.primary);
      } finally {
        setResumeUploading(false);
      }
    } catch (err) {
      console.error("Document picker error:", err);
    }
  };

  const handlePreviewResume = async () => {
    if (resumeFile?.url || resumeFile?.uri) {
      try {
        await Linking.openURL(resumeFile.url || resumeFile.uri);
      } catch (err) {
        showAlert("Error", "Unable to open document preview.", AlertTriangle, "#EF6C00");
      }
    }
  };

  // ── Applicant question helpers ───────────────────────
  const updateAQ = (idx, val) => {
    const next = [...applicantQuestions];
    next[idx] = val;
    setApplicantQuestions(next);
  };
  const addAQ = () => {
    if (applicantQuestions.length < 2) setApplicantQuestions([...applicantQuestions, ""]);
  };
  const removeAQ = (idx) => {
    setApplicantQuestions(applicantQuestions.filter((_, i) => i !== idx));
  };

  // ─────────────────────────────────────────────────────
  //  CONTEXT CARD — shown at top of every step
  // ─────────────────────────────────────────────────────
  const renderContextCard = () => {
    if (!opportunity) return null;
    const initial = (opportunity.creator_name || "S").charAt(0).toUpperCase();
    return (
      <View style={styles.contextCard}>
        <View style={styles.contextAvatar}>
          {opportunity.creator_photo ? (
            <Image source={{ uri: opportunity.creator_photo }} style={styles.contextAvatarImg} />
          ) : (
            <Text style={styles.contextAvatarText}>{initial}</Text>
          )}
        </View>
        <View style={styles.contextTextCol}>
          <Text style={styles.contextOpTitle} numberOfLines={1}>
            {opportunity.title}
          </Text>
          <Text style={styles.contextCreator} numberOfLines={1}>
            {opportunity.creator_name || opportunity.community_name}
          </Text>
        </View>
        {selectedRole && (
          <View style={styles.contextRolePill}>
            <Text style={styles.contextRoleText} numberOfLines={1}>{selectedRole}</Text>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────
  //  STEP 1 — Role Selection
  // ─────────────────────────────────────────────────────
  const renderStep1 = () => {
    const roles = opportunity?.opportunity_types || [];
    const eligibilityMode = opportunity?.eligibility_mode || "any_one";

    return (
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false}>
        {renderContextCard()}
        <Text style={styles.stepTitle}>Which role are you applying for?</Text>
        <Text style={styles.stepSubtitle}>
          {eligibilityMode === "any_one"
            ? "Select the role that best matches your skills"
            : "Select your primary role for this application"}
        </Text>

        <View style={styles.rolesContainer}>
          {roles.map((role, index) => {
            const skillGroup = opportunity.skill_groups?.find((g) => g.role === role);
            const isSelected = selectedRole === role;
            const tools = skillGroup?.tools || [];
            const sampleType = skillGroup?.sample_type;

            return (
              <View key={index} style={[styles.roleCard, isSelected && styles.roleCardActive]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.roleCardHeader}
                  onPress={() => handleSelectRoleHeader(role, tools)}
                >
                  <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.roleCardTitle, isSelected && styles.roleCardTitleActive]}>{role}</Text>
                </TouchableOpacity>

                {tools.length > 0 && (
                  <View style={styles.roleToolsRow}>
                    {tools.map((tool, i) => {
                      const isSkillSelected = isSelected && selectedSkills.includes(tool);
                      return (
                        <TouchableOpacity
                          key={i}
                          activeOpacity={0.8}
                          onPress={() => handleToggleSkill(role, tool)}
                          style={[styles.roleToolChip, isSkillSelected && styles.roleToolChipSelected]}
                        >
                          <Text style={[styles.roleToolText, isSkillSelected && styles.roleToolTextSelected]}>
                            {tool}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {isSelected && sampleType && (
                  <View style={styles.sampleTypeInfo}>
                    <View style={styles.iconMiniContainer}>
                      <FileText size={14} color={COLORS.textSecondary} />
                    </View>
                    <Text style={styles.sampleTypeText}>Work sample expected: {sampleType}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────
  //  STEP 2 — Pitch
  // ─────────────────────────────────────────────────────
  const renderStep2 = () => {
    const prompt = getDynamicPitchPrompt(selectedRole);
    const charCount = introPitch.length;
    const hasMin = charCount >= PITCH_MIN;
    const isOverMax = charCount > PITCH_MAX;

    return (
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false}>
        {renderContextCard()}
        <Text style={styles.stepTitle}>Make your case</Text>
        <Text style={styles.stepSubtitle}>
          This is your moment. One specific answer beats a dozen generic ones.
        </Text>

        {/* Dynamic prompt card */}
        <View style={styles.promptCard}>
          <View style={styles.promptIconContainer}>
            <Sparkles size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.promptText}>"{prompt}"</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Your pitch</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              styles.pitchTextArea,
              isPitchFocused && styles.textInputFocused,
              isOverMax && styles.textInputError,
            ]}
            placeholder="Write something specific. Avoid generic intros..."
            placeholderTextColor={COLORS.textMuted}
            value={introPitch}
            onChangeText={(t) => t.length <= PITCH_MAX + 20 && setIntroPitch(t)}
            multiline
            textAlignVertical="top"
            onFocus={() => setIsPitchFocused(true)}
            onBlur={() => setIsPitchFocused(false)}
          />
          {/* Character counter */}
          <View style={styles.charCountRow}>
            <Text style={[
              styles.charCountText,
              hasMin && !isOverMax && styles.charCountGreen,
              isOverMax && styles.charCountRed,
            ]}>
              {charCount}/{PITCH_MAX}
            </Text>
            {!hasMin && (
              <Text style={styles.charCountHint}>min {PITCH_MIN} characters</Text>
            )}
          </View>
        </View>

        <View style={styles.tipBox}>
          <View style={styles.tipIconContainer}>
            <Lightbulb size={18} color="#EF6C00" />
          </View>
          <Text style={styles.tipText}>
            Be specific about a past project, your process, or why this opportunity excites you. Creators can tell the difference.
          </Text>
        </View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────
  //  STEP 3 — Attachments
  // ─────────────────────────────────────────────────────
  const renderStep3 = () => {
    const skillGroup = opportunity?.skill_groups?.find((g) => g.role === selectedRole);
    const sampleType = skillGroup?.sample_type;

    return (
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderContextCard()}
        <Text style={styles.stepTitle}>Share your portfolio</Text>
        <Text style={styles.stepSubtitle}>
          {sampleType
            ? `Include a ${sampleType} if you have one. Links to your work get 3× more responses.`
            : "Links to your work get 3× more responses."}
        </Text>

        {/* Portfolio links */}
        <View style={styles.attachSection}>
          <View style={styles.attachSectionHeader}>
            <View style={styles.attachSectionIconWrap}>
              <Link size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.attachSectionTitle}>Portfolio Links</Text>
            <Text style={styles.attachSectionCount}>{portfolioLinks.filter(l => l.trim()).length}/3</Text>
          </View>

          {portfolioLinks.map((link, idx) => (
            <View key={idx} style={styles.linkRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.linkInput,
                  isLinkFocused === idx && styles.textInputFocused,
                ]}
                placeholder={
                  idx === 0
                    ? "Example: https://yourportfolio.com or drive link"
                    : idx === 1
                    ? "Example: https://behance.net/yourprofile"
                    : "Example: https://github.com/yourhandle"
                }
                placeholderTextColor={COLORS.textMuted}
                value={link}
                onChangeText={(v) => updateLink(idx, v)}
                autoCapitalize="none"
                keyboardType="url"
                onFocus={() => setIsLinkFocused(idx)}
                onBlur={() => setIsLinkFocused(null)}
              />
              {portfolioLinks.length > 1 && (
                <TouchableOpacity
                  style={styles.removeLinkBtn}
                  onPress={() => removeLink(idx)}
                  activeOpacity={0.7}
                >
                  <X size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {portfolioLinks.length < 3 && (
            <TouchableOpacity style={styles.addLinkBtn} onPress={addLink} activeOpacity={0.7}>
              <Plus size={16} color={COLORS.primary} />
              <Text style={styles.addLinkText}>Add another link</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Resume / Attachment Section */}
        <View style={[styles.attachSection, { marginTop: 20 }]}>
          <View style={styles.attachSectionHeader}>
            <View style={styles.attachSectionIconWrap}>
              <FileCheck size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.attachSectionTitle}>
              {requiresResume ? "Resume" : "Attachment / Resume"}
            </Text>
            {requiresResume ? (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            ) : (
              <View style={[styles.requiredBadge, { backgroundColor: "rgba(107, 114, 128, 0.08)" }]}>
                <Text style={[styles.requiredText, { color: COLORS.textSecondary }]}>Optional</Text>
              </View>
            )}
          </View>

          {resumeFile ? (
            <View style={styles.resumeUploadedCard}>
              <View style={styles.resumeFileIcon}>
                <FileText size={20} color={COLORS.primary} />
              </View>
              <View style={styles.resumeFileInfo}>
                <Text style={styles.resumeFileName} numberOfLines={1}>{resumeFile.name}</Text>
                {resumeFile.localOnly ? (
                  <Text style={[styles.resumeFileStatus, { color: "#D84315" }]}>⚠ Will upload on submit</Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Check size={12} color={COLORS.success} strokeWidth={3} />
                    <Text style={[styles.resumeFileStatus, { marginTop: 0 }]}>Uploaded</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={handlePreviewResume}
                style={[styles.resumeRemoveBtn, { marginRight: 8 }]}
                activeOpacity={0.7}
              >
                <Eye size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setResumeFile(null)}
                style={styles.resumeRemoveBtn}
                activeOpacity={0.7}
              >
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                style={styles.resumePickBtn}
                onPress={handlePickResume}
                activeOpacity={0.8}
                disabled={resumeUploading}
              >
                {resumeUploading ? (
                  <SnooLoader color={COLORS.primary} />
                ) : (
                  <>
                    <Upload size={18} color={COLORS.primary} />
                    <Text style={styles.resumePickText}>
                      {requiresResume ? "Upload Resume (PDF)" : "Upload File (PDF)"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.uploadLimitText}>Max file size: 10MB • PDF only</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────
  //  STEP 4 — Creator Questions (conditional)
  // ─────────────────────────────────────────────────────
  const renderStepQuestions = () => {
    const questions = opportunity?.questions || [];

    return (
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false}>
        {renderContextCard()}
        <Text style={styles.stepTitle}>Answer a few questions</Text>
        <Text style={styles.stepSubtitle}>The creator wants to know a bit more about you.</Text>

        <View style={styles.questionsContainer}>
          {questions.map((question, index) => {
            const isLongText = question.question_type === "long_text";
            const isFocused = focusedQuestion === question.id;
            const answerLen = (answers[question.id] || "").length;

            return (
              <View key={question.id || index} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Q{index + 1}</Text>
                  {question.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.questionPrompt}>{question.prompt}</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    isLongText && styles.textArea,
                    isFocused && styles.textInputFocused,
                  ]}
                  placeholder="Your answer..."
                  placeholderTextColor={COLORS.textMuted}
                  value={answers[question.id] || ""}
                  onChangeText={(text) =>
                    setAnswers({ ...answers, [question.id]: text })
                  }
                  multiline={isLongText}
                  numberOfLines={isLongText ? 4 : 1}
                  textAlignVertical={isLongText ? "top" : "center"}
                  onFocus={() => setFocusedQuestion(question.id)}
                  onBlur={() => setFocusedQuestion(null)}
                />
                {isLongText && (
                  <Text style={styles.charCountText}>{answerLen} characters</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────
  //  STEP 5 — Ask the Creator
  // ─────────────────────────────────────────────────────
  const renderStepAsk = () => (
    <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false}>
      {renderContextCard()}
      <Text style={styles.stepTitle}>Any questions for them?</Text>
      <Text style={styles.stepSubtitle}>
        Optional — but a good question shows you've thought it through. They'll see this with your application.
      </Text>

      <View style={styles.askContainer}>
        {applicantQuestions.map((q, idx) => (
          <View key={idx} style={styles.aqRow}>
            <View style={styles.aqNumberBubble}>
              <Text style={styles.aqNumber}>{idx + 1}</Text>
            </View>
            <TextInput
              style={[
                styles.textInput,
                styles.aqInput,
                focusedAQ === idx && styles.textInputFocused,
              ]}
              placeholder={
                idx === 0
                  ? "e.g. What does success look like in the first month?"
                  : "Ask another question..."
              }
              placeholderTextColor={COLORS.textMuted}
              value={q}
              onChangeText={(v) => updateAQ(idx, v)}
              onFocus={() => setFocusedAQ(idx)}
              onBlur={() => setFocusedAQ(null)}
            />
            {applicantQuestions.length > 1 && (
              <TouchableOpacity style={styles.removeLinkBtn} onPress={() => removeAQ(idx)}>
                <X size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {applicantQuestions.length < 2 && (
          <TouchableOpacity style={styles.addLinkBtn} onPress={addAQ} activeOpacity={0.7}>
            <Plus size={16} color={COLORS.primary} />
            <Text style={styles.addLinkText}>Add another question</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tipBox, { marginTop: 16 }]}>
        <View style={styles.tipIconContainer}>
          <MessageCircleQuestionMark size={18} color="#EF6C00" />
        </View>
        <Text style={styles.tipText}>
          Good questions show initiative. Ask about the team, workflow, expectations — not things clearly listed in the posting.
        </Text>
      </View>
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────
  //  STEP 6 — Review & Submit
  // ─────────────────────────────────────────────────────
  const renderStepReview = () => {
    const validLinks = portfolioLinks.filter((l) => l.trim());
    const validAQ = applicantQuestions.filter((q) => q.trim());
    const skillGroup = opportunity?.skill_groups?.find((g) => g.role === selectedRole);

    return (
      <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepInner} showsVerticalScrollIndicator={false}>
        {renderContextCard()}
        <Text style={styles.stepTitle}>Review your application</Text>
        <Text style={styles.stepSubtitle}>
          Give it one last look before you send it.
        </Text>

        <View style={styles.reviewCard}>
          {/* Role */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionLabel}>APPLYING FOR</Text>
            <Text style={styles.reviewSectionValue}>{selectedRole}</Text>
            {selectedSkills.length > 0 && (
              <Text style={styles.reviewSectionSub}>Skills: {selectedSkills.join(", ")}</Text>
            )}
          </View>

          <View style={styles.reviewDivider} />

          {/* Pitch */}
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionLabel}>YOUR PITCH</Text>
            <Text style={styles.reviewPitchText} numberOfLines={4}>{introPitch}</Text>
          </View>

          {/* Portfolio */}
          {validLinks.length > 0 && (
            <>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionLabel}>PORTFOLIO</Text>
                {validLinks.map((l, i) => (
                  <View key={i} style={styles.reviewLinkRow}>
                    <Link size={13} color={COLORS.primary} />
                    <Text style={styles.reviewLinkText} numberOfLines={1}>{l}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Resume */}
          {resumeFile && (
            <>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionLabel}>RESUME</Text>
                <View style={styles.reviewLinkRow}>
                  <FileText size={13} color={COLORS.primary} />
                  <Text style={styles.reviewLinkText}>{resumeFile.name}</Text>
                </View>
              </View>
            </>
          )}

          {/* Creator questions */}
          {hasQuestions && Object.keys(answers).length > 0 && (
            <>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionLabel}>YOUR ANSWERS</Text>
                {(opportunity?.questions || []).map((q, i) => {
                  const ans = answers[q.id];
                  if (!ans) return null;
                  return (
                    <View key={q.id || i} style={{ marginBottom: 10 }}>
                      <Text style={styles.reviewQLabel}>{q.prompt}</Text>
                      <Text style={styles.reviewQAnswer} numberOfLines={2}>{ans}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Applicant questions */}
          {validAQ.length > 0 && (
            <>
              <View style={styles.reviewDivider} />
              <View style={styles.reviewSection}>
                <Text style={styles.reviewSectionLabel}>YOUR QUESTIONS FOR THEM</Text>
                {validAQ.map((q, i) => (
                  <View key={i} style={styles.reviewLinkRow}>
                    <MessageCircleQuestionMark size={13} color={COLORS.primary} />
                    <Text style={styles.reviewLinkText}>{q}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────
  //  SUCCESS STATE
  // ─────────────────────────────────────────────────────
  const renderSuccess = () => {
    const scale = successAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
    });
    const opacity = successAnim;

    const glowScale = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.25],
    });
    const glowOpacity = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 0],
    });

    const checkScale = glowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.06],
    });

    return (
      <View style={styles.successContainer}>
        <Animated.View style={[styles.successContent, { transform: [{ scale }], opacity }]}>
          {/* Celebratory Check Circle with pulsing glow & breathing effect */}
          <View style={styles.successIconWrapper}>
            <Animated.View
              style={[
                styles.successGlowRing,
                {
                  transform: [{ scale: glowScale }],
                  opacity: glowOpacity,
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <LinearGradient
                colors={["rgba(52, 199, 89, 0.12)", "rgba(52, 199, 89, 0.03)"]}
                style={styles.successCheckCircle}
              >
                <CheckCircle2 size={52} color={COLORS.success} />
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={styles.successTitle}>You're in the running.</Text>
          <Text style={styles.successSubtitle}>
            <Text style={{ fontFamily: FONTS.semiBold, color: COLORS.textPrimary }}>
              {opportunity?.creator_name || "The creator"}
            </Text>
            {" "}will review your application and get back to you.
          </Text>

          {/* Standalone Chips */}
          <View style={styles.successChipsRow}>
            <View style={styles.successRolePill}>
              <Text style={styles.successRoleText}>Applied for {selectedRole}</Text>
            </View>
            {selectedSkills && selectedSkills.map((skill, index) => (
              <View key={index} style={styles.successSkillPill}>
                <Text style={styles.successSkillText}>{skill}</Text>
              </View>
            ))}
          </View>

          {/* Next-step message */}
          <Text style={styles.successNextStep}>
            You can continue exploring other opportunities while your application is being reviewed.
          </Text>

          {/* Button actions */}
          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.successSecondaryText}>Continue browsing</Text>
              <ArrowRight size={18} color={COLORS.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => navigation.popToTop()}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.successPrimaryGradient}
              >
                <Text style={styles.successPrimaryText}>Go Home</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────
  //  RENDER CURRENT STEP
  // ─────────────────────────────────────────────────────
  const renderCurrentStep = () => {
    switch (currentStepKey) {
      case "role": return renderStep1();
      case "pitch": return renderStep2();
      case "attachments": return renderStep3();
      case "questions": return renderStepQuestions();
      case "ask": return renderStepAsk();
      case "review": return renderStepReview();
      default: return null;
    }
  };

  // ─────────────────────────────────────────────────────
  //  GUARD
  // ─────────────────────────────────────────────────────
  if (!opportunity) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Opportunity not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────
  //  MAIN RENDER
  // ─────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderSuccess()}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <ArrowLeft size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        {/* Segmented progress dots */}
        <View style={styles.progressDotsContainer}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i < currentStep && styles.progressDotFilled,
                i === currentStep - 1 && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Step content */}
        {renderCurrentStep()}

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              isNextDisabled && { opacity: 0.5 }
            ]}
            onPress={handleNext}
            disabled={isNextDisabled}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextGradient}
            >
              {submitting ? (
                <SnooLoader color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === TOTAL_STEPS ? "Submit Application" : "Next"}
                  </Text>
                  {currentStep === TOTAL_STEPS ? (
                    <Check size={20} color="#FFFFFF" />
                  ) : (
                    <ArrowRight size={20} color="#FFFFFF" />
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Skip for optional steps */}
          {(currentStepKey === "ask") && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => setCurrentStep(currentStep + 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.skipText}>Skip — no questions</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={hideAlert}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
        primaryAction={alertConfig.primaryAction}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  keyboardView: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  goBackText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },

  // ── Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  stepIndicator: {
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  stepText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
  },

  // ── Progress dots
  progressDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  progressDotFilled: {
    backgroundColor: COLORS.primary,
    opacity: 0.4,
  },
  progressDotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
    opacity: 1,
  },

  // ── Step scroll
  stepScroll: {
    flex: 1,
  },
  stepInner: {
    padding: 24,
    paddingBottom: 120,
  },

  // ── Context card
  contextCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  contextAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  contextAvatarImg: {
    width: "100%",
    height: "100%",
  },
  contextAvatarText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  contextTextCol: {
    flex: 1,
  },
  contextOpTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  contextCreator: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contextRolePill: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
    flexShrink: 0,
  },
  contextRoleText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.primary,
    maxWidth: 80,
  },

  // ── Step titles
  stepTitle: {
    fontFamily: FONTS.black,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },

  // ── Role cards
  rolesContainer: { gap: 14 },
  roleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleCardActive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  roleCardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textSecondary,
  },
  roleCardTitleActive: {
    color: COLORS.textPrimary,
  },
  roleToolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginLeft: 34,
    marginBottom: 14,
  },
  roleToolChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: "transparent",
  },
  roleToolChipSelected: {
    backgroundColor: "rgba(52, 199, 89, 0.08)",
    borderColor: COLORS.success,
  },
  roleToolText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#4B5563",
  },
  roleToolTextSelected: {
    fontFamily: FONTS.semiBold,
    color: COLORS.success,
  },
  sampleTypeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 34,
    backgroundColor: "#F3F4F6",
    padding: 10,
    borderRadius: BORDER_RADIUS.m,
  },
  iconMiniContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  sampleTypeText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // ── Pitch step
  promptCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(41, 98, 255, 0.04)",
    borderRadius: BORDER_RADIUS.l,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.1)",
    marginBottom: 20,
  },
  promptIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(41, 98, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  promptText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  pitchTextArea: {
    minHeight: 150,
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  charCountText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  charCountGreen: { color: "#34C759" },
  charCountRed: { color: COLORS.error },
  charCountHint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // ── Shared inputs
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInputFocused: { borderColor: COLORS.primary },
  textInputError: { borderColor: COLORS.error },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },

  // ── Tip box
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: BORDER_RADIUS.l,
  },
  tipIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239, 108, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#D84315",
    lineHeight: 18,
  },

  // ── Attachments step
  attachSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  attachSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  attachSectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  attachSectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
  },
  attachSectionCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  linkInput: {
    flex: 1,
  },
  removeLinkBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  addLinkText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  // Resume
  resumePickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: BORDER_RADIUS.m,
    paddingVertical: 16,
    backgroundColor: "rgba(41, 98, 255, 0.05)",
  },
  resumePickText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  uploadLimitText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  resumeUploadedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(52, 199, 89, 0.05)",
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.2)",
    padding: 14,
  },
  resumeFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  resumeFileInfo: { flex: 1 },
  resumeFileName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  resumeFileStatus: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resumeRemoveBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Questions step
  questionsContainer: { gap: 20 },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  questionNumber: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.s,
  },
  requiredBadge: {
    backgroundColor: "rgba(229, 62, 62, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.s,
  },
  requiredText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.error,
  },
  questionPrompt: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 14,
  },

  // ── Ask step
  askContainer: { gap: 12 },
  aqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aqNumberBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aqNumber: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  aqInput: {
    flex: 1,
  },

  // ── Review step
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  reviewSection: {
    padding: 18,
  },
  reviewSectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  reviewSectionValue: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  reviewSectionSub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  reviewPitchText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 21,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  reviewLinkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  reviewLinkText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  reviewQLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reviewQAnswer: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  // ── Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    gap: 10,
    alignItems: "center",
  },
  nextButton: {
    height: 56,
    minWidth: 160,
    borderRadius: 28,
    overflow: "hidden",
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  nextGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingHorizontal: 32,
    gap: 8,
  },
  nextButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // ── Success screen
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: COLORS.screenBackground,
  },
  successContent: {
    width: "100%",
    alignItems: "center",
  },
  successIconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: 110,
    height: 110,
    marginBottom: 28,
  },
  successGlowRing: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "rgba(52, 199, 89, 0.4)",
    backgroundColor: "rgba(52, 199, 89, 0.04)",
  },
  successCheckCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontFamily: FONTS.black,
    fontSize: 28,
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  successSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  successChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successRolePill: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
  },
  successRoleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  successSkillPill: {
    backgroundColor: "rgba(41, 98, 255, 0.04)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.15)",
  },
  successSkillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  successNextStep: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  successActions: {
    width: "100%",
    gap: 12,
  },
  successPrimaryBtn: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    overflow: "hidden",
  },
  successPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  successPrimaryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  successSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  successSecondaryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.primary,
  },
});
