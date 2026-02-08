const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { rateLimitOtp } = require("../middleware/rateLimit");
const { validateBody, normalizeEmail } = require("../middleware/validators");
const AuthController = require("../controllers/authController");
const MemberController = require("../controllers/memberController");
const CommunityController = require("../controllers/communityController");
const SponsorController = require("../controllers/sponsorController");
const VenueController = require("../controllers/venueController");
const UsernameController = require("../controllers/usernameController");
const PostController = require("../controllers/postController");
const CommentController = require("../controllers/commentController");
const FollowController = require("../controllers/followController");
const NotificationController = require("../controllers/notificationController");
const AccountController = require("../controllers/accountController");
const EventController = require("../controllers/eventController");
const UploadController = require("../controllers/uploadController");
const CatalogController = require("../controllers/catalogController");
const MessageController = require("../controllers/messageController");
const SearchController = require("../controllers/searchController");
const DiscoverController = require("../controllers/discoverController");
const CategoryController = require("../controllers/categoryController");
const PollController = require("../controllers/pollController");
const PromptController = require("../controllers/promptController");
const QnAController = require("../controllers/qnaController");
const ChallengeController = require("../controllers/challengeController");
const CardExtensionController = require("../controllers/cardExtensionController");
const PronounController = require("../controllers/pronounController");
const AnalyticsController = require("../controllers/analyticsController");
const ModerationController = require("../controllers/moderationController");
const CollegeController = require("../controllers/collegeController");
const OpportunityController = require("../controllers/opportunityController");
const ViewsController = require("../controllers/viewsController");
const ShareController = require("../controllers/shareController");
const SaveController = require("../controllers/saveController");
const { adminAuthMiddleware } = require("../middleware/adminAuth");

const router = express.Router();

// Health
router.get("/health", (req, res) => res.json({ status: "ok" }));
router.get("/db/health", async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const r = await pool.query("SELECT 1 as ok");
    res.json({ status: "ok", result: r.rows[0] });
  } catch (err) {
    console.error("/db/health error:", err && err.stack ? err.stack : err);
    res.status(500).json({
      status: "error",
      message: err && err.message ? err.message : undefined,
      code: err && err.code ? err.code : undefined,
      detail: err && err.detail ? err.detail : undefined,
      hint: err && err.hint ? err.hint : undefined,
    });
  }
});

// ============================================
// ADMIN AUTHENTICATION (No auth required for login)
// ============================================
router.post("/admin/login", CategoryController.adminLogin);
router.post("/admin/create", CategoryController.createAdmin); // TODO: Protect in production

// ============================================
// ADMIN ANALYTICS (Protected)
// ============================================
router.get(
  "/admin/analytics/overview",
  adminAuthMiddleware,
  AnalyticsController.getOverview,
);
router.get(
  "/admin/analytics/users",
  adminAuthMiddleware,
  AnalyticsController.getUserAnalytics,
);
router.get(
  "/admin/analytics/events",
  adminAuthMiddleware,
  AnalyticsController.getEventAnalytics,
);
router.get(
  "/admin/analytics/engagement",
  adminAuthMiddleware,
  AnalyticsController.getEngagementAnalytics,
);
router.get(
  "/admin/analytics/advanced",
  adminAuthMiddleware,
  AnalyticsController.getAdvancedAnalytics,
);

// ============================================
// ADMIN MODERATION (Protected)
// ============================================
// Reports
router.get(
  "/admin/reports",
  adminAuthMiddleware,
  ModerationController.getReports,
);
router.get(
  "/admin/reports/stats",
  adminAuthMiddleware,
  ModerationController.getReportStats,
);
router.get(
  "/admin/reports/:id",
  adminAuthMiddleware,
  ModerationController.getReportById,
);
router.post(
  "/admin/reports/:id/resolve",
  adminAuthMiddleware,
  ModerationController.resolveReport,
);

// User Restrictions
router.get(
  "/admin/restrictions",
  adminAuthMiddleware,
  ModerationController.getRestrictions,
);
router.get(
  "/admin/restrictions/check",
  adminAuthMiddleware,
  ModerationController.checkUserRestriction,
);
router.post(
  "/admin/restrictions",
  adminAuthMiddleware,
  ModerationController.restrictUser,
);
router.post(
  "/admin/restrictions/:id/revoke",
  adminAuthMiddleware,
  ModerationController.revokeRestriction,
);

// Audit Log
router.get(
  "/admin/audit-log",
  adminAuthMiddleware,
  ModerationController.getAuditLog,
);

// ============================================
// ADMIN CATEGORY MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/categories",
  adminAuthMiddleware,
  CategoryController.getAllCategoriesAdmin,
);
router.post(
  "/admin/categories",
  adminAuthMiddleware,
  CategoryController.createCategory,
);
router.patch(
  "/admin/categories/:categoryId",
  adminAuthMiddleware,
  CategoryController.updateCategory,
);
router.delete(
  "/admin/categories/:categoryId",
  adminAuthMiddleware,
  CategoryController.deleteCategory,
);
router.post(
  "/admin/categories/reorder",
  adminAuthMiddleware,
  CategoryController.reorderCategories,
);

// ============================================
// ADMIN INTEREST MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/interests",
  adminAuthMiddleware,
  CategoryController.getAllInterestsAdmin,
);
router.post(
  "/admin/interests",
  adminAuthMiddleware,
  CategoryController.createInterest,
);
router.patch(
  "/admin/interests/:interestId",
  adminAuthMiddleware,
  CategoryController.updateInterest,
);
router.delete(
  "/admin/interests/:interestId",
  adminAuthMiddleware,
  CategoryController.deleteInterest,
);

// ============================================
// ADMIN PRONOUNS MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/pronouns",
  adminAuthMiddleware,
  PronounController.getAllPronounsAdmin,
);
router.post(
  "/admin/pronouns",
  adminAuthMiddleware,
  PronounController.createPronoun,
);
router.patch(
  "/admin/pronouns/:id",
  adminAuthMiddleware,
  PronounController.updatePronoun,
);
router.delete(
  "/admin/pronouns/:id",
  adminAuthMiddleware,
  PronounController.deletePronoun,
);
router.post(
  "/admin/pronouns/reorder",
  adminAuthMiddleware,
  PronounController.reorderPronouns,
);

// ============================================
// PUBLIC ROUTES
// ============================================
router.get("/api/categories", CategoryController.getDiscoverCategories);
router.get("/api/interests", CategoryController.getSignupInterests);
router.get("/api/pronouns", PronounController.getParamPronouns); // New Route
router.get("/api/users/check", UsernameController.checkUsername);

// ============================================
// ADMIN USER MANAGEMENT (Protected)
// ============================================
router.get("/admin/users", adminAuthMiddleware, CategoryController.getAllUsers);
router.get(
  "/admin/users/:userId",
  adminAuthMiddleware,
  CategoryController.getUserById,
);
router.patch(
  "/admin/users/:userId",
  adminAuthMiddleware,
  CategoryController.updateUser,
);
router.delete(
  "/admin/users/:userId",
  adminAuthMiddleware,
  CategoryController.deleteUser,
);

// ============================================
// ADMIN POST MANAGEMENT (Protected)
// ============================================
router.get("/admin/posts", adminAuthMiddleware, CategoryController.getAllPosts);
// IMPORTANT: Specific routes must come BEFORE wildcard routes
router.get(
  "/admin/posts/:postId/likes",
  adminAuthMiddleware,
  CategoryController.getPostLikesAdmin,
);
router.get(
  "/admin/posts/:postId/comments",
  adminAuthMiddleware,
  CategoryController.getPostCommentsAdmin,
);
router.delete(
  "/admin/posts/:postId",
  adminAuthMiddleware,
  CategoryController.deletePostAdmin,
);
router.get(
  "/admin/posts/:userId/:userType",
  adminAuthMiddleware,
  CategoryController.getUserPostsAdmin,
);
router.delete(
  "/admin/comments/:commentId",
  adminAuthMiddleware,
  CategoryController.deleteCommentAdmin,
);
router.post(
  "/admin/posts/cleanup-orphaned",
  adminAuthMiddleware,
  CategoryController.cleanupOrphanedPosts,
);

// Sponsor Types routes
router.get("/catalog/sponsor-types", CategoryController.getSponsorTypes); // Public endpoint for mobile
router.get(
  "/admin/sponsor-types",
  adminAuthMiddleware,
  CategoryController.getAllSponsorTypesAdmin,
);
router.post(
  "/admin/sponsor-types",
  adminAuthMiddleware,
  CategoryController.createSponsorType,
);
router.put(
  "/admin/sponsor-types/:id",
  adminAuthMiddleware,
  CategoryController.updateSponsorType,
);
router.delete(
  "/admin/sponsor-types/:id",
  adminAuthMiddleware,
  CategoryController.deleteSponsorType,
);

// ============================================
// ADMIN EVENT MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/events/stats",
  adminAuthMiddleware,
  CategoryController.getEventStatsAdmin,
);
router.get(
  "/admin/events",
  adminAuthMiddleware,
  CategoryController.getAllEventsAdmin,
);
router.get(
  "/admin/events/:eventId",
  adminAuthMiddleware,
  CategoryController.getEventByIdAdmin,
);
router.delete(
  "/admin/events/:eventId",
  adminAuthMiddleware,
  CategoryController.deleteEventAdmin,
);
router.patch(
  "/admin/events/:eventId/cancel",
  adminAuthMiddleware,
  CategoryController.cancelEventAdmin,
);

// Auth (Legacy - will be deprecated)
router.post(
  "/auth/send-otp",
  normalizeEmail,
  validateBody(["email"]),
  rateLimitOtp,
  AuthController.sendOtp,
);
router.post(
  "/auth/verify-otp",
  normalizeEmail,
  validateBody(["email", "token"]),
  rateLimitOtp,
  AuthController.verifyOtp,
);
router.post("/auth/refresh", AuthController.refresh);
router.get("/auth/callback", AuthController.callback);
router.get("/me", authMiddleware, AuthController.me);
router.post(
  "/auth/check-email",
  normalizeEmail,
  validateBody(["email"]),
  AuthController.checkEmail,
);
router.post(
  "/auth/get-user-profile",
  authMiddleware,
  normalizeEmail,
  validateBody(["email"]),
  AuthController.getUserProfile,
);
router.post(
  "/auth/login/start",
  normalizeEmail,
  validateBody(["email"]),
  rateLimitOtp,
  AuthController.loginStart,
);
router.get(
  "/auth/validate-token",
  authMiddleware,
  AuthController.validateToken,
);

// Auth V2 - OTP-Only Multi-Account (New)
const AuthV2Controller = require("../controllers/authControllerV2");
router.post(
  "/auth/v2/send-otp",
  normalizeEmail,
  validateBody(["email"]),
  rateLimitOtp,
  AuthV2Controller.sendOtp,
);
router.post(
  "/auth/v2/verify-otp",
  normalizeEmail,
  validateBody(["email", "token"]),
  rateLimitOtp,
  AuthV2Controller.verifyOtp,
);
router.post("/auth/v2/create-session", AuthV2Controller.createSessionEndpoint);
router.post("/auth/v2/refresh", AuthV2Controller.refreshToken);
router.post("/auth/v2/logout", AuthV2Controller.logout);
router.get("/auth/v2/sessions", AuthV2Controller.getDeviceSessions);
router.get("/auth/v2/validate", AuthV2Controller.validateToken);

// Members
router.post("/members/signup", MemberController.signup);
router.get("/members/profile", authMiddleware, MemberController.getProfile);
router.patch("/members/profile", authMiddleware, MemberController.patchProfile);
router.post(
  "/members/profile/photo",
  authMiddleware,
  MemberController.updatePhoto,
);
router.post(
  "/members/username",
  authMiddleware,
  MemberController.changeUsernameEndpoint,
);
router.post(
  "/members/email/change/start",
  authMiddleware,
  rateLimitOtp,
  normalizeEmail,
  validateBody(["email"]),
  MemberController.startEmailChange,
);
router.post(
  "/members/email/change/verify",
  authMiddleware,
  rateLimitOtp,
  normalizeEmail,
  validateBody(["email", "otp"]),
  MemberController.verifyEmailChange,
);
router.get("/members/search", authMiddleware, MemberController.searchMembers);
router.get(
  "/members/:id/public",
  authMiddleware,
  MemberController.getPublicMember,
);
router.post(
  "/members/location",
  authMiddleware,
  MemberController.updateLocation,
);

// Member Signup Draft (Multi-Account System)
router.post("/members/signup/draft", MemberController.createDraft);
router.patch("/members/signup/draft/:id", MemberController.updateDraft);
router.get("/members/signup/resume", MemberController.resumeSignup);
router.post("/members/signup/complete/:id", MemberController.completeSignup);

// Communities
router.post("/communities/signup", CommunityController.signup);
router.get(
  "/communities/profile",
  authMiddleware,
  CommunityController.getProfile,
);
router.patch(
  "/communities/profile",
  authMiddleware,
  CommunityController.patchProfile,
);
router.post(
  "/communities/profile/logo",
  authMiddleware,
  CommunityController.updateLogo,
);
router.post(
  "/communities/username",
  authMiddleware,
  CommunityController.changeUsernameEndpoint,
);
router.post(
  "/communities/email/change/start",
  authMiddleware,
  rateLimitOtp,
  normalizeEmail,
  validateBody(["email"]),
  CommunityController.startEmailChange,
);
router.post(
  "/communities/email/change/verify",
  authMiddleware,
  rateLimitOtp,
  normalizeEmail,
  validateBody(["email", "otp"]),
  CommunityController.verifyEmailChange,
);
router.post(
  "/communities/location",
  authMiddleware,
  CommunityController.updateLocation,
);
router.get(
  "/communities/search",
  authMiddleware,
  CommunityController.searchCommunities,
);
router.get(
  "/communities/:id/events/public",
  authMiddleware,
  EventController.getCommunityPublicEvents,
);
router.get(
  "/communities/:id/public",
  authMiddleware,
  CommunityController.getPublicCommunity,
);
router.patch(
  "/communities/heads",
  authMiddleware,
  CommunityController.patchHeads,
);

// ============================================
// COLLEGES & BRANCHES (For Community Signup)
// ============================================
router.get("/colleges", CollegeController.searchColleges);
router.post("/colleges/request", CollegeController.requestCollege);
router.get("/colleges/:id", CollegeController.getCollege);
router.get("/branches", CollegeController.getBranches);
router.get("/catalog/states", CollegeController.getIndianStates);

// ============================================
// COMMUNITY CATEGORIES (For Community Signup)
// ============================================
router.get("/community-categories", CategoryController.getCommunityCategories);
router.post(
  "/community-categories/request",
  CategoryController.requestCommunityCategory,
);

// ============================================
// ADMIN COMMUNITY CATEGORY MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/community-categories",
  adminAuthMiddleware,
  CategoryController.getAllCommunityCategoriesAdmin,
);
router.post(
  "/admin/community-categories",
  adminAuthMiddleware,
  CategoryController.createCommunityCategory,
);
router.patch(
  "/admin/community-categories/:id",
  adminAuthMiddleware,
  CategoryController.updateCommunityCategory,
);
router.delete(
  "/admin/community-categories/:id",
  adminAuthMiddleware,
  CategoryController.deleteCommunityCategory,
);

// ============================================
// ADMIN COLLEGE MANAGEMENT (Protected)
// ============================================
router.get(
  "/admin/colleges/pending-count",
  adminAuthMiddleware,
  CollegeController.adminGetPendingCount,
);
router.get(
  "/admin/colleges",
  adminAuthMiddleware,
  CollegeController.adminGetColleges,
);
router.post(
  "/admin/colleges",
  adminAuthMiddleware,
  CollegeController.adminCreateCollege,
);
router.put(
  "/admin/colleges/:id",
  adminAuthMiddleware,
  CollegeController.adminUpdateCollege,
);
router.delete(
  "/admin/colleges/:id",
  adminAuthMiddleware,
  CollegeController.adminDeleteCollege,
);
router.get(
  "/admin/colleges/:collegeId/campuses",
  adminAuthMiddleware,
  CollegeController.adminGetCampuses,
);
router.post(
  "/admin/campuses",
  adminAuthMiddleware,
  CollegeController.adminCreateCampus,
);
router.put(
  "/admin/campuses/:id",
  adminAuthMiddleware,
  CollegeController.adminUpdateCampus,
);
router.delete(
  "/admin/campuses/:id",
  adminAuthMiddleware,
  CollegeController.adminDeleteCampus,
);

// Sponsors
router.post("/sponsors/signup", SponsorController.signup);
router.post(
  "/sponsors/profile/logo",
  authMiddleware,
  SponsorController.updateLogo,
);
router.get(
  "/sponsors/search",
  authMiddleware,
  SponsorController.searchSponsors,
);

// Venues
router.post("/venues/signup", VenueController.signup);
router.post("/venues/profile/logo", authMiddleware, VenueController.updateLogo);
router.get("/venues/search", authMiddleware, VenueController.searchVenues);

// Global Search
router.get("/search/global", authMiddleware, SearchController.globalSearch);

// Discover
router.get(
  "/discover/feed",
  authMiddleware,
  DiscoverController.getDiscoverFeed,
);
router.get(
  "/discover/suggestions",
  authMiddleware,
  DiscoverController.getSuggestedCommunities,
);

// ============================================
// OPPORTUNITIES / HIRING
// ============================================
router.post(
  "/opportunities",
  authMiddleware,
  OpportunityController.createOpportunity,
);
router.get(
  "/opportunities",
  authMiddleware,
  OpportunityController.getOpportunities,
);
// IMPORTANT: Specific paths must come BEFORE wildcard :id
router.get(
  "/opportunities/followed",
  authMiddleware,
  OpportunityController.getFollowedOpportunities,
);
router.get(
  "/opportunities/:id",
  authMiddleware,
  OpportunityController.getOpportunityDetail,
);
router.patch(
  "/opportunities/:id",
  authMiddleware,
  OpportunityController.updateOpportunity,
);
router.delete(
  "/opportunities/:id",
  authMiddleware,
  OpportunityController.closeOpportunity,
);
router.get(
  "/discover/opportunities",
  authMiddleware,
  OpportunityController.discoverOpportunities,
);

// Applications
router.post(
  "/opportunities/apply",
  authMiddleware,
  OpportunityController.applyToOpportunity,
);
router.get(
  "/opportunities/:id/applications",
  authMiddleware,
  OpportunityController.getApplications,
);
router.get(
  "/opportunities/applications/:id",
  authMiddleware,
  OpportunityController.getApplicationDetail,
);
router.patch(
  "/opportunities/applications/:id",
  authMiddleware,
  OpportunityController.updateApplicationStatus,
);

// Activity & Insights
const ActivityController = require("../controllers/activityController");
router.post(
  "/activity/view",
  authMiddleware,
  ActivityController.logProfileView,
);
router.get(
  "/activity/insights",
  authMiddleware,
  ActivityController.getActivityInsights,
);
router.get(
  "/connections/pending",
  authMiddleware,
  ActivityController.getPendingRequests,
);
router.get("/connections", authMiddleware, ActivityController.getConnections);
router.post(
  "/connections/request",
  authMiddleware,
  ActivityController.sendConnectionRequest,
);
router.post(
  "/connections/:requestId/respond",
  authMiddleware,
  ActivityController.respondToRequest,
);

// Discover Feed V2 (Category-based)
router.get(
  "/discover/v2/feed",
  authMiddleware,
  CategoryController.getDiscoverFeedV2,
);
router.get(
  "/discover/categories",
  authMiddleware,
  CategoryController.getDiscoverCategories,
);
router.get(
  "/discover/categories/:categoryId",
  authMiddleware,
  CategoryController.getCategoryById,
);
router.get(
  "/discover/categories/:categoryId/events",
  authMiddleware,
  CategoryController.getEventsByCategory,
);

// Event Categories
router.get(
  "/events/:eventId/categories",
  authMiddleware,
  CategoryController.getEventCategories,
);
router.patch(
  "/events/:eventId/categories",
  authMiddleware,
  CategoryController.assignEventCategories,
);

// Signup Interests (Dynamic)
router.get("/catalog/signup-interests", CategoryController.getSignupInterests);

// Admin: Category Management
router.get(
  "/admin/categories",
  authMiddleware,
  CategoryController.getAllCategoriesAdmin,
);
router.post(
  "/admin/categories",
  authMiddleware,
  CategoryController.createCategory,
);
router.patch(
  "/admin/categories/:categoryId",
  authMiddleware,
  CategoryController.updateCategory,
);
router.delete(
  "/admin/categories/:categoryId",
  authMiddleware,
  CategoryController.deleteCategory,
);
router.post(
  "/admin/categories/reorder",
  authMiddleware,
  CategoryController.reorderCategories,
);
router.patch(
  "/admin/events/:eventId/categories/:categoryId/featured",
  authMiddleware,
  CategoryController.toggleEventFeatured,
);

// Admin: Interest Management
router.get(
  "/admin/interests",
  authMiddleware,
  CategoryController.getAllInterestsAdmin,
);
router.post(
  "/admin/interests",
  authMiddleware,
  CategoryController.createInterest,
);
router.patch(
  "/admin/interests/:interestId",
  authMiddleware,
  CategoryController.updateInterest,
);
router.delete(
  "/admin/interests/:interestId",
  authMiddleware,
  CategoryController.deleteInterest,
);

// Username management
router.post("/username/check", UsernameController.checkUsername);
router.post("/username/set", authMiddleware, UsernameController.setUsername);

// Posts
router.post("/posts", authMiddleware, PostController.createPost);
router.get("/posts/feed", authMiddleware, PostController.getFeed);
router.get("/posts/explore", authMiddleware, PostController.getExplore);
router.get("/posts/:postId", PostController.getPost);
router.get(
  "/posts/user/:userId/:userType",
  authMiddleware,
  PostController.getUserPosts,
);
router.post("/posts/:postId/like", authMiddleware, PostController.likePost);
router.delete("/posts/:postId/like", authMiddleware, PostController.unlikePost);
router.delete("/posts/:postId", authMiddleware, PostController.deletePost);

// Post Views (Qualified View System)
router.post(
  "/posts/views/batch",
  authMiddleware,
  ViewsController.submitViewsBatch,
);
router.get(
  "/posts/views/check",
  authMiddleware,
  ViewsController.getViewedPosts,
);
router.get(
  "/posts/:postId/analytics",
  authMiddleware,
  ViewsController.getPostViewAnalytics,
);

// Share routes
router.post("/posts/:postId/share", authMiddleware, ShareController.sharePost);
router.get(
  "/posts/:postId/shares",
  authMiddleware,
  ShareController.getPostShares,
);
router.get(
  "/chat/recent-users",
  authMiddleware,
  ShareController.getRecentChatUsers,
);

// Save routes
router.post("/posts/:postId/save", authMiddleware, SaveController.savePost);
router.delete("/posts/:postId/save", authMiddleware, SaveController.unsavePost);
router.get("/saved-posts", authMiddleware, SaveController.getSavedPosts);
router.post(
  "/posts/save-status/batch",
  authMiddleware,
  SaveController.checkSaveStatus,
);

// Poll routes
router.post("/posts/:postId/vote", authMiddleware, PollController.vote);
router.delete("/posts/:postId/vote", authMiddleware, PollController.removeVote);
router.get("/posts/:postId/results", authMiddleware, PollController.getResults);
router.get(
  "/posts/:postId/vote-status",
  authMiddleware,
  PollController.getVoteStatus,
);

// Prompt submission routes
router.post(
  "/posts/:postId/submissions",
  authMiddleware,
  PromptController.submitResponse,
);
router.get(
  "/posts/:postId/submissions",
  authMiddleware,
  PromptController.getSubmissions,
);
router.get(
  "/posts/:postId/my-submission",
  authMiddleware,
  PromptController.getMySubmission,
);
router.patch(
  "/submissions/:submissionId/status",
  authMiddleware,
  PromptController.moderateSubmission,
);
router.patch(
  "/submissions/:submissionId/pin",
  authMiddleware,
  PromptController.pinSubmission,
);
router.post(
  "/submissions/:submissionId/replies",
  authMiddleware,
  PromptController.createReply,
);
router.get(
  "/submissions/:submissionId/replies",
  authMiddleware,
  PromptController.getReplies,
);
router.patch(
  "/replies/:replyId/hide",
  authMiddleware,
  PromptController.hideReply,
);

// Q&A routes
router.post(
  "/posts/:postId/questions",
  authMiddleware,
  QnAController.submitQuestion,
);
router.get(
  "/posts/:postId/questions",
  authMiddleware,
  QnAController.getQuestions,
);
router.post(
  "/questions/:questionId/upvote",
  authMiddleware,
  QnAController.upvoteQuestion,
);
router.delete(
  "/questions/:questionId/upvote",
  authMiddleware,
  QnAController.removeUpvote,
);
router.post(
  "/questions/:questionId/answer",
  authMiddleware,
  QnAController.answerQuestion,
);
router.patch(
  "/questions/:questionId",
  authMiddleware,
  QnAController.moderateQuestion,
);
router.patch(
  "/answers/:answerId/best",
  authMiddleware,
  QnAController.markBestAnswer,
);
router.post("/posts/:postId/experts", authMiddleware, QnAController.addExpert);
router.delete(
  "/posts/:postId/experts/:expertId",
  authMiddleware,
  QnAController.removeExpert,
);
router.get("/posts/:postId/experts", authMiddleware, QnAController.getExperts);

// Challenge routes
router.post(
  "/posts/:postId/join",
  authMiddleware,
  ChallengeController.joinChallenge,
);
router.delete(
  "/posts/:postId/join",
  authMiddleware,
  ChallengeController.leaveChallenge,
);
router.get(
  "/posts/:postId/participants",
  authMiddleware,
  ChallengeController.getParticipants,
);
router.get(
  "/posts/:postId/participant-previews",
  authMiddleware,
  ChallengeController.getParticipantPreviews,
);
router.post(
  "/posts/:postId/challenge-submissions",
  authMiddleware,
  ChallengeController.submitProof,
);
router.get(
  "/posts/:postId/challenge-submissions",
  authMiddleware,
  ChallengeController.getSubmissions,
);
router.patch(
  "/posts/:postId/progress",
  authMiddleware,
  ChallengeController.updateProgress,
);
router.post(
  "/posts/:postId/complete",
  authMiddleware,
  ChallengeController.markComplete,
);
router.patch(
  "/challenge-submissions/:id/status",
  authMiddleware,
  ChallengeController.moderateSubmission,
);
router.patch(
  "/challenge-submissions/:id/feature",
  authMiddleware,
  ChallengeController.featureSubmission,
);
router.patch(
  "/participants/:id/highlight",
  authMiddleware,
  ChallengeController.highlightParticipant,
);
router.post(
  "/challenge-submissions/:id/like",
  authMiddleware,
  ChallengeController.likeSubmission,
);
router.delete(
  "/challenge-submissions/:id/like",
  authMiddleware,
  ChallengeController.unlikeSubmission,
);

// ============================================
// CARD EXTENSION & STATE MANAGEMENT
// ============================================
router.post(
  "/posts/:postId/extend",
  authMiddleware,
  CardExtensionController.extendCard,
);
router.get(
  "/posts/:postId/extensions",
  authMiddleware,
  CardExtensionController.getExtensionHistory,
);
router.post(
  "/posts/:postId/close",
  authMiddleware,
  CardExtensionController.closeOpportunity,
);
router.post(
  "/posts/:postId/resolve",
  authMiddleware,
  CardExtensionController.resolveQnA,
);

// Comments
router.post(
  "/posts/:postId/comments",
  authMiddleware,
  CommentController.createComment,
);
router.post(
  "/comments/:commentId/reply",
  authMiddleware,
  CommentController.replyToComment,
);
router.get(
  "/posts/:postId/comments",
  authMiddleware,
  CommentController.getPostComments,
);
router.delete(
  "/comments/:commentId",
  authMiddleware,
  CommentController.deleteComment,
);
router.post(
  "/comments/:commentId/like",
  authMiddleware,
  CommentController.likeComment,
);
router.delete(
  "/comments/:commentId/like",
  authMiddleware,
  CommentController.unlikeComment,
);

// Follow system
router.post("/follow", authMiddleware, FollowController.follow);
router.delete("/follow", authMiddleware, FollowController.unfollow);
router.get("/followers/:userId/:userType", FollowController.getFollowers);
router.get("/following/:userId/:userType", FollowController.getFollowing);
router.get("/follow/status", authMiddleware, FollowController.getFollowStatus);
router.get(
  "/follow/counts/:userId/:userType",
  FollowController.getFollowCounts,
);

// Notifications
router.get(
  "/notifications",
  authMiddleware,
  NotificationController.listNotifications,
);
router.get(
  "/notifications/unread-count",
  authMiddleware,
  NotificationController.unreadCount,
);
router.patch(
  "/notifications/:id/read",
  authMiddleware,
  NotificationController.markRead,
);
router.patch(
  "/notifications/read-all",
  authMiddleware,
  NotificationController.markAllRead,
);

// Account
router.delete("/account", authMiddleware, AccountController.deleteAccount);

// Events and matching
router.post("/events", authMiddleware, EventController.createEvent);
router.get("/events/my-events", authMiddleware, EventController.getMyEvents);
router.get(
  "/events/pending-attendance",
  authMiddleware,
  EventController.getPendingAttendanceEvents,
);
router.get("/events/discover", authMiddleware, EventController.discoverEvents);
router.get("/events/search", authMiddleware, EventController.searchEvents);
router.get(
  "/events/:eventId/attendees",
  authMiddleware,
  EventController.getEventAttendees,
);
router.post(
  "/events/:eventId/swipe",
  authMiddleware,
  EventController.recordSwipe,
);
router.get(
  "/events/:eventId/matches",
  authMiddleware,
  EventController.getEventMatches,
);
router.post(
  "/events/:eventId/request-next",
  authMiddleware,
  EventController.requestNextEvent,
);
router.get(
  "/events/community",
  authMiddleware,
  EventController.getCommunityEvents,
);
// Event interest (bookmark) routes - must be before :eventId routes
router.get(
  "/events/interested",
  authMiddleware,
  EventController.getInterestedEvents,
);
router.post(
  "/events/:eventId/interest",
  authMiddleware,
  EventController.toggleEventInterest,
);
// Event registration routes
router.post(
  "/events/:eventId/register",
  authMiddleware,
  EventController.registerForEvent,
);
router.post(
  "/events/:eventId/cancel-registration",
  authMiddleware,
  EventController.cancelRegistration,
);
// Ticket reservation routes (for checkout flow)
router.post(
  "/events/:eventId/reserve-tickets",
  authMiddleware,
  EventController.reserveTickets,
);
router.post(
  "/events/:eventId/release-reservation",
  authMiddleware,
  EventController.releaseReservation,
);
router.get(
  "/events/:eventId/registrations",
  authMiddleware,
  EventController.getEventAttendeesForCommunity,
);
router.get(
  "/events/:eventId/my-ticket",
  authMiddleware,
  EventController.getMyTicket,
);
router.post(
  "/events/:eventId/verify-ticket",
  authMiddleware,
  EventController.verifyTicket,
);
router.get("/events/:eventId", authMiddleware, EventController.getEventById);
router.patch("/events/:eventId", authMiddleware, EventController.updateEvent);
router.delete("/events/:eventId", authMiddleware, EventController.deleteEvent);
router.patch(
  "/events/:eventId/cancel",
  authMiddleware,
  EventController.cancelEvent,
);
// Attendance confirmation
router.post(
  "/events/:eventId/confirm-attendance",
  authMiddleware,
  EventController.confirmAttendance,
);

// ============================================
// TICKET GIFTING SYSTEM
// ============================================
// Community creates ticket gift
router.post(
  "/events/:eventId/gifts",
  authMiddleware,
  EventController.createTicketGift,
);
// Community views all gifts for event
router.get(
  "/events/:eventId/gifts",
  authMiddleware,
  EventController.getEventGifts,
);
// Community revokes a gift (cascade to children)
router.post(
  "/gifts/:giftId/revoke",
  authMiddleware,
  EventController.revokeGift,
);
// Member views their received gifts
router.get("/members/my-gifts", authMiddleware, EventController.getMyGifts);
// Member re-shares a gift to another user
router.post(
  "/gifts/:giftId/reshare",
  authMiddleware,
  EventController.reshareGift,
);
// Member confirms RSVP for free gifted ticket
router.post(
  "/gifts/:giftId/confirm",
  authMiddleware,
  EventController.confirmGiftRSVP,
);

// ============================================
// INVITE REQUESTS
// ============================================
// Member requests invite to invite-only event
router.post(
  "/events/:eventId/request-invite",
  authMiddleware,
  EventController.requestInvite,
);
// Community views invite requests for event
router.get(
  "/events/:eventId/invite-requests",
  authMiddleware,
  EventController.getInviteRequests,
);
// Community responds to invite request
router.post(
  "/invite-requests/:requestId/respond",
  authMiddleware,
  EventController.respondToInviteRequest,
);

// Upload (Cloudinary)
router.post(
  "/upload/event-banner",
  authMiddleware,
  UploadController.uploadEventBanner,
);
router.post(
  "/upload/event-gallery",
  authMiddleware,
  UploadController.uploadEventGallery,
);
router.post(
  "/upload/performer-photo",
  authMiddleware,
  UploadController.uploadPerformerPhoto,
);
router.delete(
  "/upload/:publicId",
  authMiddleware,
  UploadController.deleteUploadedImage,
);

// Admin Upload (College logos)
router.post(
  "/admin/upload/college-logo",
  adminAuthMiddleware,
  UploadController.uploadCollegeLogo,
);

// Catalog
router.get(
  "/catalog/interests",
  authMiddleware,
  CatalogController.getInterests,
);

// Messages
router.get(
  "/messages/conversations",
  authMiddleware,
  MessageController.getConversations,
);
router.get(
  "/messages/conversations/:conversationId",
  authMiddleware,
  MessageController.getMessages,
);
router.post("/messages", authMiddleware, MessageController.sendMessage);
router.put(
  "/messages/:messageId/read",
  authMiddleware,
  MessageController.markMessageRead,
);
router.get(
  "/messages/unread-count",
  authMiddleware,
  MessageController.getUnreadCount,
);

// Search
router.get("/search/accounts", authMiddleware, SearchController.searchAccounts);

module.exports = router;
