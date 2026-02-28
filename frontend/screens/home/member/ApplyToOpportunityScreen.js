import React, { useState, useLayoutEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { applyToOpportunity } from "../../../api/opportunities";
import SnooLoader from "../../../components/ui/SnooLoader";

const COLORS = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  primary: "#007AFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  error: "#EF4444",
};

export default function ApplyToOpportunityScreen({ route, navigation }) {
  const { opportunity } = route.params || {};
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Application data
  const [selectedRole, setSelectedRole] = useState(null);
  const [portfolioLink, setPortfolioLink] = useState("");
  const [portfolioNote, setPortfolioNote] = useState("");
  const [answers, setAnswers] = useState({});

  // Hide tab bar
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

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
        // Portfolio is optional but encouraged
        return true;
      case 3:
        // Check required questions
        const requiredUnanswered = (opportunity.questions || []).find(
          (q) => q.required && (!answers[q.id] || !answers[q.id].trim()),
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
      const applicationData = {
        opportunity_id: opportunity.id,
        applied_role: selectedRole,
        portfolio_link: portfolioLink.trim() || null,
        portfolio_note: portfolioNote.trim() || null,
        responses: Object.entries(answers).map(([questionId, answer]) => ({
          question_id: questionId,
          answer: answer,
        })),
      };

      await applyToOpportunity(applicationData);

      Alert.alert(
        "Application Submitted!",
        "Your application has been sent. The creator will review it soon.",
        [{ text: "OK", onPress: () => navigation.popToTop() }],
      );
    } catch (error) {
      console.error("Error submitting application:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to submit application. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: Role Selection
  const renderStep1 = () => {
    const roles = opportunity?.opportunity_types || [];
    const eligibilityMode = opportunity?.eligibility_mode || "any_one";

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
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
              (g) => g.role === role,
            );
            const isSelected = selectedRole === role;

            return (
              <TouchableOpacity
                key={index}
                style={[styles.roleCard, isSelected && styles.roleCardSelected]}
                onPress={() => setSelectedRole(role)}
              >
                <View style={styles.roleCardHeader}>
                  <View
                    style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.roleCardTitle,
                      isSelected && styles.roleCardTitleSelected,
                    ]}
                  >
                    {role}
                  </Text>
                </View>

                {skillGroup?.tools?.length > 0 && (
                  <View style={styles.roleToolsRow}>
                    {skillGroup.tools.slice(0, 4).map((tool, i) => (
                      <View key={i} style={styles.roleToolChip}>
                        <Text style={styles.roleToolText}>{tool}</Text>
                      </View>
                    ))}
                    {skillGroup.tools.length > 4 && (
                      <Text style={styles.moreTools}>
                        +{skillGroup.tools.length - 4} more
                      </Text>
                    )}
                  </View>
                )}

                {skillGroup?.sample_type && (
                  <View style={styles.sampleTypeInfo}>
                    <Ionicons
                      name="document-outline"
                      size={14}
                      color={COLORS.textLight}
                    />
                    <Text style={styles.sampleTypeText}>
                      Sample needed: {skillGroup.sample_type}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Step 2: Portfolio
  const renderStep2 = () => {
    const skillGroup = opportunity?.skill_groups?.find(
      (g) => g.role === selectedRole,
    );
    const sampleType = skillGroup?.sample_type;

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
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
            style={styles.textInput}
            placeholder="https://yourportfolio.com or drive link"
            placeholderTextColor="#9CA3AF"
            value={portfolioLink}
            onChangeText={setPortfolioLink}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Additional Notes (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Tell them about your experience, relevant projects, or why you'd be a great fit..."
            placeholderTextColor="#9CA3AF"
            value={portfolioNote}
            onChangeText={setPortfolioNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
          <Text style={styles.tipText}>
            Tip: Applications with portfolio links get 3x more responses!
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Step 3: Questions
  const renderStep3 = () => {
    const questions = opportunity?.questions || [];

    return (
      <ScrollView
        style={styles.stepContent}
        contentContainerStyle={styles.stepContentInner}
      >
        <Text style={styles.stepTitle}>Answer a few questions</Text>
        <Text style={styles.stepSubtitle}>
          The creator wants to know more about you
        </Text>

        <View style={styles.questionsContainer}>
          {questions.map((question, index) => (
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
                  question.question_type === "long_text" && styles.textArea,
                ]}
                placeholder="Your answer..."
                placeholderTextColor="#9CA3AF"
                value={answers[question.id] || ""}
                onChangeText={(text) =>
                  setAnswers({ ...answers, [question.id]: text })
                }
                multiline={question.question_type === "long_text"}
                numberOfLines={question.question_type === "long_text" ? 4 : 1}
                textAlignVertical={
                  question.question_type === "long_text" ? "top" : "center"
                }
              />
            </View>
          ))}
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              {currentStep}/{TOTAL_STEPS}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
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
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={submitting}
          >
            <LinearGradient
              colors={["#00C6FF", "#007AFF"]}
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
                  <Ionicons
                    name={
                      currentStep === TOTAL_STEPS
                        ? "checkmark"
                        : "arrow-forward"
                    }
                    size={20}
                    color="#FFFFFF"
                  />
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
    backgroundColor: COLORS.background,
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
    fontSize: 16,
    color: COLORS.textLight,
  },
  goBackText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  stepIndicator: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#E5E7EB",
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
    padding: 20,
    paddingBottom: 100,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
    marginBottom: 24,
  },
  rolesContainer: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  roleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + "08",
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
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
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  roleCardTitleSelected: {
    color: COLORS.primary,
  },
  roleToolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginLeft: 34,
    marginBottom: 8,
  },
  roleToolChip: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleToolText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  moreTools: {
    fontSize: 12,
    color: COLORS.textLight,
    alignSelf: "center",
  },
  sampleTypeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 34,
  },
  sampleTypeText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  questionsContainer: {
    gap: 20,
  },
  questionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredBadge: {
    backgroundColor: COLORS.error + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.error,
  },
  questionPrompt: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  nextButton: {
    borderRadius: 14,
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
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
