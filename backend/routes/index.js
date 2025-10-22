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

// Auth
router.post("/auth/send-otp", normalizeEmail, validateBody(['email']), rateLimitOtp, AuthController.sendOtp);
router.post("/auth/verify-otp", normalizeEmail, validateBody(['email','token']), rateLimitOtp, AuthController.verifyOtp);
router.get("/auth/callback", AuthController.callback);
router.get("/me", authMiddleware, AuthController.me);
router.post("/auth/check-email", normalizeEmail, validateBody(['email']), AuthController.checkEmail);
router.post("/auth/get-user-profile", authMiddleware, normalizeEmail, validateBody(['email']), AuthController.getUserProfile);
router.post("/auth/login/start", normalizeEmail, validateBody(['email']), rateLimitOtp, AuthController.loginStart);

// Members
router.post("/members/signup", MemberController.signup);

// Communities
router.post("/communities/signup", CommunityController.signup);

// Sponsors
router.post("/sponsors/signup", SponsorController.signup);

// Venues
router.post("/venues/signup", VenueController.signup);

// Username management
router.post("/username/check", UsernameController.checkUsername);
router.post("/username/set", authMiddleware, UsernameController.setUsername);

// Posts
router.post("/posts", authMiddleware, PostController.createPost);
router.get("/posts/feed", authMiddleware, PostController.getFeed);
router.get("/posts/explore", authMiddleware, PostController.getExplore);
router.get("/posts/:postId", PostController.getPost);
router.get("/posts/user/:userId/:userType", PostController.getUserPosts);
router.post("/posts/:postId/like", authMiddleware, PostController.likePost);
router.delete("/posts/:postId/like", authMiddleware, PostController.unlikePost);

// Comments
router.post("/posts/:postId/comments", authMiddleware, CommentController.createComment);
router.post("/comments/:commentId/reply", authMiddleware, CommentController.replyToComment);
router.get("/posts/:postId/comments", CommentController.getPostComments);
router.delete("/comments/:commentId", authMiddleware, CommentController.deleteComment);

// Follow system
router.post("/follow", authMiddleware, FollowController.follow);
router.delete("/follow", authMiddleware, FollowController.unfollow);
router.get("/followers/:userId/:userType", FollowController.getFollowers);
router.get("/following/:userId/:userType", FollowController.getFollowing);
router.get("/follow/status", authMiddleware, FollowController.getFollowStatus);
router.get("/follow/counts/:userId/:userType", FollowController.getFollowCounts);

module.exports = router;


