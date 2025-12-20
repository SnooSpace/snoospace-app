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

// Auth (Legacy - will be deprecated)
router.post("/auth/send-otp", normalizeEmail, validateBody(['email']), rateLimitOtp, AuthController.sendOtp);
router.post("/auth/verify-otp", normalizeEmail, validateBody(['email','token']), rateLimitOtp, AuthController.verifyOtp);
router.post("/auth/refresh", AuthController.refresh);
router.get("/auth/callback", AuthController.callback);
router.get("/me", authMiddleware, AuthController.me);
router.post("/auth/check-email", normalizeEmail, validateBody(['email']), AuthController.checkEmail);
router.post("/auth/get-user-profile", authMiddleware, normalizeEmail, validateBody(['email']), AuthController.getUserProfile);
router.post("/auth/login/start", normalizeEmail, validateBody(['email']), rateLimitOtp, AuthController.loginStart);
router.get("/auth/validate-token", authMiddleware, AuthController.validateToken);

// Auth V2 - OTP-Only Multi-Account (New)
const AuthV2Controller = require("../controllers/authControllerV2");
router.post("/auth/v2/send-otp", normalizeEmail, validateBody(['email']), rateLimitOtp, AuthV2Controller.sendOtp);
router.post("/auth/v2/verify-otp", normalizeEmail, validateBody(['email','token']), rateLimitOtp, AuthV2Controller.verifyOtp);
router.post("/auth/v2/create-session", AuthV2Controller.createSessionEndpoint);
router.post("/auth/v2/refresh", AuthV2Controller.refreshToken);
router.post("/auth/v2/logout", AuthV2Controller.logout);
router.get("/auth/v2/sessions", AuthV2Controller.getDeviceSessions);
router.get("/auth/v2/validate", AuthV2Controller.validateToken);

// Members
router.post("/members/signup", MemberController.signup);
router.get("/members/profile", authMiddleware, MemberController.getProfile);
router.patch("/members/profile", authMiddleware, MemberController.patchProfile);
router.post("/members/profile/photo", authMiddleware, MemberController.updatePhoto);
router.post("/members/username", authMiddleware, MemberController.changeUsernameEndpoint);
router.post("/members/email/change/start", authMiddleware, rateLimitOtp, normalizeEmail, validateBody(['email']), MemberController.startEmailChange);
router.post("/members/email/change/verify", authMiddleware, rateLimitOtp, normalizeEmail, validateBody(['email', 'otp']), MemberController.verifyEmailChange);
router.get("/members/search", authMiddleware, MemberController.searchMembers);
router.get("/members/:id/public", authMiddleware, MemberController.getPublicMember);
router.post("/members/location", authMiddleware, MemberController.updateLocation);

// Communities
router.post("/communities/signup", CommunityController.signup);
router.get("/communities/profile", authMiddleware, CommunityController.getProfile);
router.patch("/communities/profile", authMiddleware, CommunityController.patchProfile);
router.post("/communities/profile/logo", authMiddleware, CommunityController.updateLogo);
router.post("/communities/username", authMiddleware, CommunityController.changeUsernameEndpoint);
router.post("/communities/email/change/start", authMiddleware, rateLimitOtp, normalizeEmail, validateBody(['email']), CommunityController.startEmailChange);
router.post("/communities/email/change/verify", authMiddleware, rateLimitOtp, normalizeEmail, validateBody(['email', 'otp']), CommunityController.verifyEmailChange);
router.post("/communities/location", authMiddleware, CommunityController.updateLocation);
router.get("/communities/search", authMiddleware, CommunityController.searchCommunities);
router.get("/communities/:id/public", authMiddleware, CommunityController.getPublicCommunity);
router.patch("/communities/heads", authMiddleware, CommunityController.patchHeads);

// Sponsors
router.post("/sponsors/signup", SponsorController.signup);
router.post("/sponsors/profile/logo", authMiddleware, SponsorController.updateLogo);
router.get("/sponsors/search", authMiddleware, SponsorController.searchSponsors);

// Venues
router.post("/venues/signup", VenueController.signup);
router.post("/venues/profile/logo", authMiddleware, VenueController.updateLogo);
router.get("/venues/search", authMiddleware, VenueController.searchVenues);

// Global Search
router.get("/search/global", authMiddleware, SearchController.globalSearch);

// Username management
router.post("/username/check", UsernameController.checkUsername);
router.post("/username/set", authMiddleware, UsernameController.setUsername);

// Posts
router.post("/posts", authMiddleware, PostController.createPost);
router.get("/posts/feed", authMiddleware, PostController.getFeed);
router.get("/posts/explore", authMiddleware, PostController.getExplore);
router.get("/posts/:postId", PostController.getPost);
router.get("/posts/user/:userId/:userType", authMiddleware, PostController.getUserPosts);
router.post("/posts/:postId/like", authMiddleware, PostController.likePost);
router.delete("/posts/:postId/like", authMiddleware, PostController.unlikePost);
router.delete("/posts/:postId", authMiddleware, PostController.deletePost);

// Comments
router.post("/posts/:postId/comments", authMiddleware, CommentController.createComment);
router.post("/comments/:commentId/reply", authMiddleware, CommentController.replyToComment);
router.get("/posts/:postId/comments", authMiddleware, CommentController.getPostComments);
router.delete("/comments/:commentId", authMiddleware, CommentController.deleteComment);
router.post("/comments/:commentId/like", authMiddleware, CommentController.likeComment);
router.delete("/comments/:commentId/like", authMiddleware, CommentController.unlikeComment);

// Follow system
router.post("/follow", authMiddleware, FollowController.follow);
router.delete("/follow", authMiddleware, FollowController.unfollow);
router.get("/followers/:userId/:userType", FollowController.getFollowers);
router.get("/following/:userId/:userType", FollowController.getFollowing);
router.get("/follow/status", authMiddleware, FollowController.getFollowStatus);
router.get("/follow/counts/:userId/:userType", FollowController.getFollowCounts);

// Notifications
router.get("/notifications", authMiddleware, NotificationController.listNotifications);
router.get("/notifications/unread-count", authMiddleware, NotificationController.unreadCount);
router.patch("/notifications/:id/read", authMiddleware, NotificationController.markRead);
router.patch("/notifications/read-all", authMiddleware, NotificationController.markAllRead);

// Account
router.delete("/account", authMiddleware, AccountController.deleteAccount);

// Events and matching
router.post("/events", authMiddleware, EventController.createEvent);
router.get("/events/my-events", authMiddleware, EventController.getMyEvents);
router.get("/events/discover", authMiddleware, EventController.discoverEvents);
router.get("/events/search", authMiddleware, EventController.searchEvents);
router.get("/events/:eventId/attendees", authMiddleware, EventController.getEventAttendees);
router.post("/events/:eventId/swipe", authMiddleware, EventController.recordSwipe);
router.get("/events/:eventId/matches", authMiddleware, EventController.getEventMatches);
router.post("/events/:eventId/request-next", authMiddleware, EventController.requestNextEvent);
router.get("/events/community", authMiddleware, EventController.getCommunityEvents);

// Upload (Cloudinary)
router.post("/upload/event-banner", authMiddleware, UploadController.uploadEventBanner);
router.post("/upload/event-gallery", authMiddleware, UploadController.uploadEventGallery);
router.post("/upload/performer-photo", authMiddleware, UploadController.uploadPerformerPhoto);
router.delete("/upload/:publicId", authMiddleware, UploadController.deleteUploadedImage);

// Catalog
router.get("/catalog/interests", authMiddleware, CatalogController.getInterests);

// Messages
router.get("/messages/conversations", authMiddleware, MessageController.getConversations);
router.get("/messages/conversations/:conversationId", authMiddleware, MessageController.getMessages);
router.post("/messages", authMiddleware, MessageController.sendMessage);
router.put("/messages/:messageId/read", authMiddleware, MessageController.markMessageRead);
router.get("/messages/unread-count", authMiddleware, MessageController.getUnreadCount);

// Search
router.get("/search/accounts", authMiddleware, SearchController.searchAccounts);

module.exports = router;
