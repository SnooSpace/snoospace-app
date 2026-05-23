import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Lightbulb,
} from "lucide-react-native";
import { applyToOpportunity } from "../../../api/opportunities";
import SnooLoader from "../../../components/ui/SnooLoader";
import { COLORS, FONTS, BORDER_RADIUS, SPACING } from "../../../constants/theme";

export default function ApplyToOpportunityScreen({ route, navigation }) {
  const { opportunity } = route.params || {};
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Application data
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [portfolioLink, setPortfolioLink] = useState("");
  const [portfolioNote, setPortfolioNote] = useState("");
  const [answers, setAnswers] = useState({});

  // Input focus states for active border animations
  const [isUrlFocused, setIsUrlFocused] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState(null);

  const hasQuestions = opportunity?.questions?.length > 0;
  const TOTAL_STEPS = hasQuestions ? 3 : 2;

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return "Select Role";
      case 2:
        return "Portfolio";
      case 3:
        return "Questions";
      default:
        return "Apply";
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!selectedRole) {
          Alert.alert("Required", "Please select a role to apply for.");
          return false;
        }
        return true;
      case 2:
        return true;
      case 3:
        const requiredUnanswered = (opportunity.questions || []).find(
          (q) => q.required && (!answers[q.id] || !answers[q.id].trim())
        );
        if (requiredUnanswered) {
          Alert.alert("Required", "Please answer all required questions.");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Incorporate selected skills into the portfolio note field cleanly for DB storage
      let finalPortfolioNote = portfolioNote.trim();
      if (selectedSkills.length > 0) {
        const skillsHeader = `Applied with skills: ${selectedSkills.join(", ")}`;
        finalPortfolioNote = finalPortfolioNote
          ? `${skillsHeader}\n\n${finalPortfolioNote}`
          : skillsHeader;
      }

      const applicationData = {
        opportunity_id: opportunity.id,
        applied_role: selectedRole,
        portfolio_link: portfolioLink.trim() || null,
        portfolio_note: finalPortfolioNote || null,
        responses: Object.entries(answers).map(([questionId, answer]) => ({
          question_id: questionId,
          answer: answer,
        })),
      };

      await applyToOpportunity(applicationData);

      Alert.alert(
        "Application Submitted!",
        "Your application has been sent. The creator will review it soon.",
        [{ text: "OK", onPress: () => navigation.popToTop() }]
      );
    } catch (error) {
      console.error("Error submitting application:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to submit application. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Role Selection & Individual Chip Selection Logic
  const handleToggleSkill = (role, skill) => {
    if (selectedRole !== role) {
      // Switched role completely: set role, and select only this specific skill
      setSelectedRole(role);
      setSelectedSkills([skill]);
    } else {
      // Toggle skill inside active role
      if (selectedSkills.includes(skill)) {
        setSelectedSkills(selectedSkills.filter((s) => s !== skill));
      } else {
        setSelectedSkills([...selectedSkills, skill]);
      }
    }
  };

  const handleSelectRoleHeader = (role, allSkills) => {
    if (selectedRole === role) {
      // Toggle selection of all skills
      const allSelected = allSkills.every((s) => selectedSkills.includes(s));
      if (allSelected) {
        setSelectedSkills([]);
      } else {
        setSelectedSkills([...allSkills]);
      }
    } else {
      setSelectedRole(role);
      setSelectedSkills([...allSkills]); // Select all by default when clicking header
    }
  };

  const renderStep1 = () => {
    const roles = opportunity?.opportunity_types || [];
    const eligibilityMode = opportunity?.eligibility_mode || "any_one";

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Which role are you applying for?</Text>
        <Text style={styles.stepSubtitle}>
          {eligibilityMode === "any_one"
            ? "Select the role that best matches your skills"
            : "Select your primary role for this application"}
        </Text>

        <View style={styles.rolesContainer}>
          {roles.map((role, index) => {
            const skillGroup = opportunity.skill_groups?.find(
              (g) => g.role === role
            );
            const isSelected = selectedRole === role;
            const tools = skillGroup?.tools || [];
            const sampleType = skillGroup?.sample_type;

            return (
              <View
                key={index}
                style={[
                  styles.roleCard,
                  isSelected && styles.roleCardActive,
                ]}
              >
                {/* Header Row: Radio Button & Job Title */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.roleCardHeader}
                  onPress={() => handleSelectRoleHeader(role, tools)}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.roleCardTitle}>{role}</Text>
                </TouchableOpacity>

                {/* Sub-Chips: Individually Selectable tools */}
                {tools.length > 0 && (
                  <View style={styles.roleToolsRow}>
                    {tools.map((tool, i) => {
                      const isSkillSelected = isSelected && selectedSkills.includes(tool);
                      return (
                        <TouchableOpacity
                          key={i}
                          activeOpacity={0.8}
                          onPress={() => handleToggleSkill(role, tool)}
                          style={[
                            styles.roleToolChip,
                            isSkillSelected && styles.roleToolChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleToolText,
                              isSkillSelected && styles.roleToolTextSelected,
                            ]}
                          >
                            {tool}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Expected Sample Information */}
                {sampleType && (
                  <View style={styles.sampleTypeInfo}>
                    <View style={styles.iconMiniContainer}>
                      <FileText size={14} color={COLORS.textSecondary} />
                    </View>
                    <Text style={styles.sampleTypeText}>
                      Work Sample Expected: {sampleType}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Step 2: Portfolio & Sample Submission Details
  const renderStep2 = () => {
    const skillGroup = opportunity?.skill_groups?.find(
      (g) => g.role === selectedRole
    );
    const sampleType = skillGroup?.sample_type;

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Share your portfolio</Text>
        <Text style={styles.stepSubtitle}>
          {sampleType
            ? `Include a ${sampleType} sample if you have one`
            : "Add a link to your portfolio or relevant work"}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Portfolio / Sample Link</Text>
          <TextInput
            style={[
              styles.textInput,
              isUrlFocused && styles.textInputFocused,
            ]}
            placeholder="https://yourportfolio.com or drive link"
            placeholderTextColor={COLORS.textMuted}
            value={portfolioLink}
            onChangeText={setPortfolioLink}
            autoCapitalize="none"
            keyboardType="url"
            onFocus={() => setIsUrlFocused(true)}
            onBlur={() => setIsUrlFocused(false)}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Additional Notes (optional)</Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              isNoteFocused && styles.textInputFocused,
            ]}
            placeholder="Tell them about your experience, relevant projects, or why you'd be a great fit..."
            placeholderTextColor={COLORS.textMuted}
            value={portfolioNote}
            onChangeText={setPortfolioNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            onFocus={() => setIsNoteFocused(true)}
            onBlur={() => setIsNoteFocused(false)}
          />
        </View>

        {/* Tip Box */}
        <View style={styles.tipBox}>
          <View style={styles.tipIconContainer}>
            <Lightbulb size={20} color="#EF6C00" />
          </View>
          <Text style={styles.tipText}>
            Tip: Applications with portfolio links get 3x more responses!
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Step 3: Custom Questions from Creator
  const renderStep3 = () => {
    const questions = opportunity?.questions || [];

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Answer a few questions</Text>
        <Text style={styles.stepSubtitle}>
          The creator wants to know more about you
        </Text>

        <View style={styles.questionsContainer}>
          {questions.map((question, index) => {
            const isLongText = question.question_type === "long_text";
            const isFocused = focusedQuestion === question.id;

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
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header Navigation */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              {currentStep}/{TOTAL_STEPS}
            </Text>
          </View>
        </View>

        {/* Flat Segmented Progress Bar */}
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

        {/* Floating Premium CTA Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={submitting}
            activeOpacity={0.8}
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
                    {currentStep === TOTAL_STEPS
                      ? "Submit Application"
                      : "Continue"}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  keyboardView: {
    flex: 1,
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepContentInner: {
    padding: 24,
    paddingBottom: 110,
  },
  stepTitle: {
    fontFamily: FONTS.black,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleCardActive: {
    borderColor: COLORS.primary,
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
    borderColor: COLORS.primary,
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
    color: COLORS.textPrimary,
  },
  roleToolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginLeft: 34,
    marginBottom: 16,
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
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderColor: COLORS.primary,
  },
  roleToolText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#4B5563",
  },
  roleToolTextSelected: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  sampleTypeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 34,
  },
  iconMiniContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(107, 114, 128, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  sampleTypeText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  inputGroup: {
    marginBottom: 24,
  },
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
  textInputFocused: {
    borderColor: COLORS.primary,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: BORDER_RADIUS.l,
    marginTop: 10,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(239, 108, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#D84315",
    lineHeight: 18,
  },
  questionsContainer: {
    gap: 24,
  },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: 20,
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
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  nextButton: {
    borderRadius: BORDER_RADIUS.pill,
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
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
