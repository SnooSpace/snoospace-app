const fs = require('fs');

// ─── ChallengeSubmitScreen ────────────────────────────────────────────────────
const submitPath = 'c:/Dev/SnooSpace/frontend/screens/home/ChallengeSubmitScreen.js';
let submit = fs.readFileSync(submitPath, 'utf8');

// 1. Destructure onSubmitSuccess from route.params
submit = submit.replace(
  `const { post, participation } = route.params;`,
  `const { post, participation, onSubmitSuccess } = route.params;`
);

// 2. Call onSubmitSuccess before going back on success
submit = submit.replace(
  `              text: "OK",\r\n              onPress: () => navigation.goBack(),`,
  `              text: "OK",\r\n              onPress: () => {\r\n                if (onSubmitSuccess) onSubmitSuccess();\r\n                navigation.goBack();\r\n              },`
);

// 3. Replace close icon with arrow-back
submit = submit.replace(
  `<Ionicons name="close" size={24} color={COLORS.textPrimary} />`,
  `<Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />`
);

// 4. Hero card JSX: replace challengeInfo section with heroCard + description
submit = submit.replace(
  `          {/* Challenge Info */}\r\r\n          <View style={styles.challengeInfo}>\r\r\n            <MaterialCommunityIcons\r\r\n              name="trophy-outline"\r\r\n              size={20}\r\r\n              color="#FF9500"\r\r\n            />\r\r\n            <Text style={styles.challengeTitle} numberOfLines={1}>\r\r\n              {typeData.title}\r\r\n            </Text>\r\r\n          </View>`,
  `          {/* Challenge Info */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconContainer}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={28}
                color="#FF9500"
              />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroSubtitle}>Challenge</Text>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {typeData.title}
              </Text>
              {typeData.description ? (
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {typeData.description}
                </Text>
              ) : null}
            </View>
          </View>`
);

// 5. Remove description row from guidelines card
submit = submit.replace(
  `            {typeData.description && (\r\r\n              <View style={[styles.guidelineRow, { marginTop: 4 }]}>\r\r\n                <Ionicons\r\r\n                  name="information-circle-outline"\r\r\n                  size={16}\r\r\n                  color={COLORS.textSecondary}\r\r\n                />\r\r\n                <Text style={styles.guidelineText}>{typeData.description}</Text>\r\r\n              </View>\r\r\n            )}`,
  ``
);

// 6. Styles: container white background
submit = submit.replace(
  `  container: {\r\r\n    flex: 1,\r\r\n    backgroundColor: COLORS.surface,\r\r\n  },`,
  `  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },`
);

// 7. Header styles
submit = submit.replace(
  `  header: {\r\r\n    flexDirection: "row",\r\r\n    alignItems: "center",\r\r\n    justifyContent: "space-between",\r\r\n    paddingHorizontal: SPACING.m,\r\r\n    paddingVertical: SPACING.s,\r\r\n    borderBottomWidth: 1,\r\r\n    borderBottomColor: COLORS.border,\r\r\n  },`,
  `  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    backgroundColor: "#FFFFFF",
  },`
);

// 8. headerTitle
submit = submit.replace(
  `  headerTitle: {\r\r\n    fontSize: 17,\r\r\n    fontWeight: "600",\r\r\n    color: COLORS.textPrimary,\r\r\n  },`,
  `  headerTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
  },`
);

// 9. submitButton
submit = submit.replace(
  `  submitButton: {\r\r\n    backgroundColor: "#FF9500",\r\r\n    paddingHorizontal: SPACING.m,\r\r\n    paddingVertical: SPACING.xs,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    minWidth: 70,\r\r\n    alignItems: "center",\r\r\n  },`,
  `  submitButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },`
);

// 10. submitButtonText
submit = submit.replace(
  `  submitButtonText: {\r\r\n    fontSize: 14,\r\r\n    color: "#FFFFFF",\r\r\n  \r\r\n    fontFamily: "Manrope-SemiBold",\r\r\n  },`,
  `  submitButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
  },`
);

// 11. keyboardView
submit = submit.replace(
  `  keyboardView: {\r\r\n    flex: 1,\r\r\n  },`,
  `  keyboardView: {
    flex: 1,
    backgroundColor: "#F8F9FB",
  },`
);

// 12. content padding
submit = submit.replace(
  `  content: {\r\r\n    flex: 1,\r\r\n    padding: SPACING.m,\r\r\n  },`,
  `  content: {
    flex: 1,
    padding: 20,
  },`
);

// 13. challengeInfo → heroCard styles
submit = submit.replace(
  `  challengeInfo: {\r\r\n    flexDirection: "row",\r\r\n    alignItems: "center",\r\r\n    backgroundColor: "#FF950010",\r\r\n    padding: SPACING.m,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    marginBottom: SPACING.m,\r\r\n  },\r\r\n  challengeTitle: {\r\r\n    fontSize: 14,\r\r\n    fontWeight: "500",\r\r\n    color: "#FF9500",\r\r\n    marginLeft: SPACING.s,\r\r\n    flex: 1,\r\r\n  },`,
  `  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
  },
  heroDescription: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#4B5563",
    marginTop: 6,
    lineHeight: 19,
  },`
);

// 14. guidelinesCard
submit = submit.replace(
  `  // Guidelines card\r\r\n  guidelinesCard: {\r\r\n    backgroundColor: COLORS.screenBackground,\r\r\n    padding: SPACING.m,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    marginBottom: SPACING.l,\r\r\n  },`,
  `  // Guidelines card
  guidelinesCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },`
);

// 15. guidelinesTitle
submit = submit.replace(
  `  guidelinesTitle: {\r\r\n    fontSize: 14,\r\r\n    fontWeight: "700",\r\r\n    color: COLORS.textPrimary,\r\r\n    marginBottom: SPACING.s,\r\r\n  },`,
  `  guidelinesTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#111827",
    marginBottom: 16,
  },`
);

// 16. guidelineRow
submit = submit.replace(
  `  guidelineRow: {\r\r\n    flexDirection: "row",\r\r\n    alignItems: "center",\r\r\n    gap: SPACING.s,\r\r\n    marginBottom: 6,\r\r\n  },`,
  `  guidelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },`
);

// 17. guidelineText
submit = submit.replace(
  `  guidelineText: {\r\r\n    fontSize: 13,\r\r\n    color: COLORS.textSecondary,\r\r\n    flex: 1,\r\r\n  },`,
  `  guidelineText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
    flex: 1,
  },`
);

// 18. guidelineHighlight
submit = submit.replace(
  `  guidelineHighlight: {\r\r\n    fontWeight: "600",\r\r\n    color: COLORS.textPrimary,\r\r\n  },`,
  `  guidelineHighlight: {
    fontFamily: "Manrope-SemiBold",
    color: "#111827",
  },`
);

// 19. inputSection
submit = submit.replace(
  `  inputSection: {\r\r\n    marginBottom: SPACING.l,\r\r\n  },`,
  `  inputSection: {
    marginBottom: 24,
  },`
);

// 20. sectionLabel
submit = submit.replace(
  `  sectionLabel: {\r\r\n    fontSize: 14,\r\r\n    fontWeight: "600",\r\r\n    color: COLORS.textPrimary,\r\r\n    marginBottom: SPACING.s,\r\r\n  },`,
  `  sectionLabel: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#111827",
    marginBottom: 12,
  },`
);

// 21. textInput
submit = submit.replace(
  `  textInput: {\r\r\n    backgroundColor: COLORS.screenBackground,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    padding: SPACING.m,\r\r\n    fontSize: 15,\r\r\n    color: COLORS.textPrimary,\r\r\n    minHeight: 100,\r\r\n    textAlignVertical: "top",\r\r\n  },`,
  `  textInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#111827",
    minHeight: 140,
    textAlignVertical: "top",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },`
);

// 22. charCount
submit = submit.replace(
  `  charCount: {\r\r\n    fontSize: 12,\r\r\n    color: COLORS.textSecondary,\r\r\n    textAlign: "right",\r\r\n    marginTop: 4,\r\r\n  },`,
  `  charCount: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 8,
    marginRight: 8,
  },`
);

// 23. mediaPicker
submit = submit.replace(
  `  mediaPicker: {\r\r\n    marginBottom: SPACING.l,\r\r\n  },`,
  `  mediaPicker: {
    marginBottom: 24,
  },`
);

// 24. imagesGrid
submit = submit.replace(
  `  imagesGrid: {\r\r\n    flexDirection: "row",\r\r\n    flexWrap: "wrap",\r\r\n  },`,
  `  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },`
);

// 25. imageWrapper
submit = submit.replace(
  `  imageWrapper: {\r\r\n    width: 100,\r\r\n    height: 100,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    marginRight: SPACING.s,\r\r\n    marginBottom: SPACING.s,\r\r\n    overflow: "hidden",\r\r\n  },`,
  `  imageWrapper: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
  },`
);

// 26. addButtonsRow
submit = submit.replace(
  `  addButtonsRow: {\r\r\n    flexDirection: "row",\r\r\n  },`,
  `  addButtonsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },`
);

// 27. addImageButton (no border)
submit = submit.replace(
  `  addImageButton: {\r\r\n    width: 100,\r\r\n    height: 100,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    borderWidth: 2,\r\r\n    borderColor: "#FF9500",\r\r\n    borderStyle: "dashed",\r\r\n    alignItems: "center",\r\r\n    justifyContent: "center",\r\r\n    marginRight: SPACING.s,\r\r\n    backgroundColor: "#FF950010",\r\r\n  },`,
  `  addImageButton: {
    flex: 1,
    height: 110,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8F0",
  },`
);

// 28. addImageText
submit = submit.replace(
  `  addImageText: {\r\r\n    fontSize: 12,\r\r\n    color: "#FF9500",\r\r\n    marginTop: 4,\r\r\n  },`,
  `  addImageText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#FF9500",
    marginTop: 8,
  },`
);

// 29. videoWrapper
submit = submit.replace(
  `  videoWrapper: {\r\r\n    position: "relative",\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    overflow: "hidden",\r\r\n  },`,
  `  videoWrapper: {
    position: "relative",
    borderRadius: 20,
    overflow: "hidden",
  },`
);

// 30. videoSelectedText
submit = submit.replace(
  `  videoSelectedText: {\r\r\n    color: COLORS.textSecondary,\r\r\n    fontSize: 14,\r\r\n    marginTop: SPACING.s,\r\r\n  },`,
  `  videoSelectedText: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    marginTop: 8,
  },`
);

// 31. videoButtonsRow
submit = submit.replace(
  `  videoButtonsRow: {\r\r\n    flexDirection: "row",\r\r\n    justifyContent: "space-around",\r\r\n  },`,
  `  videoButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },`
);

// 32. videoButton (no border)
submit = submit.replace(
  `  videoButton: {\r\r\n    flex: 1,\r\r\n    alignItems: "center",\r\r\n    paddingVertical: SPACING.l,\r\r\n    marginHorizontal: SPACING.xs,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    borderWidth: 2,\r\r\n    borderColor: "#FF9500",\r\r\n    borderStyle: "dashed",\r\r\n    backgroundColor: "#FF950010",\r\r\n  },`,
  `  videoButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: "#FFF8F0",
  },`
);

// 33. videoButtonText
submit = submit.replace(
  `  videoButtonText: {\r\r\n    fontSize: 13,\r\r\n    fontWeight: "500",\r\r\n    color: "#FF9500",\r\r\n    marginTop: SPACING.xs,\r\r\n  },`,
  `  videoButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#FF9500",
    marginTop: 8,
  },`
);

// 34. helperText
submit = submit.replace(
  `  helperText: {\r\r\n    fontSize: 12,\r\r\n    color: COLORS.textSecondary,\r\r\n    textAlign: "center",\r\r\n    marginTop: SPACING.s,\r\r\n  },`,
  `  helperText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },`
);

// 35. tipsSection
submit = submit.replace(
  `  tipsSection: {\r\r\n    backgroundColor: COLORS.screenBackground,\r\r\n    padding: SPACING.m,\r\r\n    borderRadius: BORDER_RADIUS.m,\r\r\n    marginBottom: SPACING.xl,\r\r\n  },`,
  `  tipsSection: {
    backgroundColor: "#F4F6F9",
    padding: 20,
    borderRadius: 24,
    marginBottom: 40,
  },`
);

// 36. tipsTitle
submit = submit.replace(
  `  tipsTitle: {\r\r\n    fontSize: 14,\r\r\n    fontWeight: "600",\r\r\n    color: COLORS.textPrimary,\r\r\n    marginBottom: SPACING.s,\r\r\n  },`,
  `  tipsTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: "#111827",
    marginBottom: 16,
  },`
);

// 37. tipRow
submit = submit.replace(
  `  tipRow: {\r\r\n    flexDirection: "row",\r\r\n    alignItems: "center",\r\r\n    marginBottom: SPACING.xs,\r\r\n  },`,
  `  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },`
);

// 38. tipText
submit = submit.replace(
  `  tipText: {\r\r\n    fontSize: 13,\r\r\n    color: COLORS.textSecondary,\r\r\n    marginLeft: SPACING.s,\r\r\n  },`,
  `  tipText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#4B5563",
    marginLeft: 12,
  },`
);

fs.writeFileSync(submitPath, submit);
console.log('ChallengeSubmitScreen updated successfully');
