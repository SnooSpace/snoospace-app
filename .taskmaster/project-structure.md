## Project Structure

### Repository Tree (Current State)

```
backend/
  config/
    db.js                    # PostgreSQL connection & schema setup
  controllers/
    authController.js        # OTP auth, user profile endpoints ✅
    communityController.js   # Community signup & management ✅
    memberController.js      # Member signup, profile, search, edit, email change, location ✅
    notificationController.js # Notifications CRUD ✅
    accountController.js     # Account deletion ✅
    catalogController.js     # Catalog endpoints (interests) ✅
    sponsorController.js     # Sponsor signup & profile ✅
    venueController.js       # Venue signup & profile ✅
    postController.js        # Posts CRUD, feed, likes ✅
    commentController.js     # Comment system ✅
    followController.js      # Follow/unfollow system ✅
    eventController.js       # Events, swipes, matches ✅
    usernameController.js    # Username validation ✅
  middleware/
    auth.js                  # Supabase auth middleware ✅
    rateLimit.js            # Rate limiting for OTP endpoints ✅
    validators.js           # Input validation helpers ✅
  routes/
    index.js                # Main API routes ✅
  server.js                 # Express server setup ✅
  supabase.js              # Supabase client config ✅
  package.json
  package-lock.json

frontend/
  api/
    auth.js                 # Auth utilities & session management ✅
    client.js               # API client with auth headers ✅
    members.js              # Member API functions (profile, search, follow, etc.) ✅
    communities.js          # Community API functions (profile, search, follow, etc.) ✅
  components/
    Progressbar.js          # Progress indicator component ✅
    PostCard.js             # Post display with interactions ✅
    AttendeeCard.js         # Bumble-style swipe card for events ✅
    MatchModal.js           # Match celebration modal ✅
    NextEventRequestModal.js # Request to attend next event ✅
    ImageUploader.js        # Multi-image upload component ✅
    UserCard.js             # User profile card ✅
    FollowButton.js         # Follow/unfollow button ✅
    EntityTagSelector.js    # Entity tagging selector ✅
    ChipSelector.js         # Multi-select chip component for interests ✅
    EmailChangeModal.js     # Email change OTP modal ✅
    LocationPicker/         # Business location picker components ✅
      LocationPicker.js     # Main location picker with GPS, search, map
      LocationConfirmationModal.js # "Are you at business?" modal
      AddressSearchBar.js   # Search bar with Nominatim integration
      SearchResultsList.js   # Dropdown search results
      MapView.js             # Map with draggable marker
      ConfirmationScreen.js  # Final location confirmation
  data/
    mockData.js             # Centralized mock data for all user types ✅
  navigation/
    AppNavigator.js         # Main navigation setup ✅
    BottomTabNavigator.js   # Member bottom tabs ✅
    MemberStackNavigator.js # Member stack (profile, edit, search, etc.) ✅
    CommunityBottomTabNavigator.js # Community tabs (React Navigation) ✅
    CommunityStackNavigator.js      # Community stack (public profile, followers, following, edit) ✅
    CommunityProfileStackNavigator.js # Community profile stack (profile, edit, public, followers, following) ✅
    SponsorBottomTabNavigator.js   # Sponsor tabs ✅
    VenueBottomTabNavigator.js     # Venue tabs ✅
    ProfileStackNavigator.js # Profile stack navigator ✅
  screens/
    auth/
      AuthGate.js           # Auth state routing ✅
      LandingScreen.js      # Role selection landing ✅
      signin/
        LoginScreen.js     # Email login ✅
        LoginOtpScreen.js   # OTP verification ✅
    signup/
      member/               # Complete multi-step signup ✅
      community/            # Complete multi-step signup ✅
      sponsor/              # Complete multi-step signup ✅
      venue/                # Complete multi-step signup ✅
    home/
      member/
        HomeFeedScreen.js        # Feed + dashboard entry ✅
        CreatePostScreen.js     # Create post ✅
      community/
        CommunityHomeFeedScreen.js # Post feed ✅
        CommunityDashboardScreen.js # Metrics dashboard ✅
        CommunityEventsScreen.js    # Events list ✅
        CommunityRequestsScreen.js  # Collaboration requests ✅
        CommunitySearchScreen.js    # General search (members, communities, etc.) ✅
      search/
        SearchScreen.js             # Member search ✅
        CommunitySearchScreen.js    # Community search (for members) ✅
        CommunityCreatePostScreen.js # Create post ✅
      sponsor/
        SponsorHomeFeedScreen.js  # Feed + dashboard entry ✅
        SponsorBrowseScreen.js     # Browse communities ✅
        SponsorOffersScreen.js    # Manage offers ✅
        SponsorCreatePostScreen.js # Create post ✅
      venue/
        VenueHomeFeedScreen.js    # Feed + dashboard entry ✅
        VenueBrowseScreen.js      # Browse communities ✅
        VenueBookingsScreen.js    # Manage bookings ✅
        VenueCreatePostScreen.js  # Create post ✅
    profile/
      member/
        MemberProfileScreen.js    # Own profile with edit, posts grid, follow counts ✅
        MemberPublicProfileScreen.js # Public profile view with follow button ✅
        EditProfileScreen.js      # Edit bio, username, email (OTP), phone, pronouns, interests, location ✅
        FollowersListScreen.js    # List of followers ✅
        FollowingListScreen.js   # List of following ✅
      community/
        CommunityProfileScreen.js # Profile with logout & edit button ✅
        EditCommunityProfileScreen.js # Edit profile (bio, username, email OTP, phone, category, sponsor_types, location, logo) ✅
        CommunityPublicProfileScreen.js # Public profile with posts grid, follow button ✅
        CommunityFollowersListScreen.js # Followers list ✅
        CommunityFollowingListScreen.js # Following list ✅
      sponsor/
        SponsorProfileScreen.js  # Profile with logout ✅
      venue/
        VenueProfileScreen.js    # Profile with logout ✅
    matching/
      MatchingScreen.js          # Event-based matching (Bumble-style) ✅
    search/
      SearchScreen.js             # Member search with debounced input, pagination ✅
    notifications/
      NotificationsScreen.js      # Notifications list with unread badge, mark read/all ✅
  App.js
  index.js
  package.json
  package-lock.json
  babel.config.js

.taskmaster/
  docs/
    PRD.md                  # Product Requirements Document
    social-posts-implementation.md # Current implementation notes for posts/likes/comments ✅
  tasks/
    README.md               # Task organization guide
    backlog.md              # Prioritized product backlog
    backlog-posts.md        # Next steps for social posts feature (shared across roles)
    frontend.md             # Frontend development tasks
    backend.md              # Backend development tasks
    operations.md           # Auth, storage, CI/CD tasks
  project-structure.md      # This file
```

### Current Implementation Status

#### ✅ Completed (P0 - Foundations)

- **Auth System**: Complete OTP-based authentication with Supabase ✅
- **Database Schema**: Core tables for all user types + events, posts, comments, follows, swipes, matches ✅
- **Backend API**: Auth endpoints, user profile management, signup flows, posts, comments, follows, events ✅
- **Frontend Navigation**: Role-based routing with bottom tab navigators for all user types ✅
- **Signup Flows**: Complete multi-step signup for all user types with session persistence ✅
- **Session Management**: Persistent auth with secure token storage, proper logout handling ✅
- **Profile Screens**: All user types with logout functionality working correctly ✅
- **Home Screens**: Dashboards, feeds, and navigation for all 4 user types ✅
- **Search & Browse**: Community/sponsor/venue browsing with filters ✅
- **Post System**: Create posts, feed display, likes, comments with real backend integration ✅
- **Event System**: Event listings, attendee management, swipe matching ✅
- **Matching System**: Bumble-style swipe interface with matches and requests ✅

#### ✅ Recently Completed (Since last update)

- Persistent login with automatic token refresh (access + refresh tokens)
- Member search with debounced input, pagination, and public profile drill-in
- Follow/Unfollow from search results and public profiles with optimistic UI
- In-app notifications (list, unread count, mark read/all) + bell badge
- Realtime notifications (Supabase Realtime) with fallback polling
- Notification banner component positioned below safe area (Instagram-style)
- Account deletion (hard delete) for all roles with type-to-confirm safety
- Member profile photo update fix + loading spinner during upload
- Profile and public profile 3-column image grid sizing fixes
- Member Edit Profile: bio, username, email change (OTP), phone (no OTP), pronouns, interests, and auto location (GPS)
- Community location migration: Changed from TEXT to JSONB with data migration logic
- Business Location Picker: GPS detection, Nominatim search, draggable map marker, confirmation flow
- Community Edit Profile: bio, username, email change (OTP), phone, category, sponsor_types, location (JSONB), logo
- Community Search: Search communities by name/username with follow/unfollow functionality
- Community Public Profile: View community profiles with posts grid, follow button, followers/following counts
- Community Followers/Following Lists: View and manage followers/following with follow/unfollow
- Community API endpoints: getProfile, patchProfile, searchCommunities, getPublicCommunity, updateLocation, email change
- Post like state persistence fixes across Home/Profile/PostModal for Members & Communities (EventBus sync + normalized `is_liked`)
- Pronoun row + name layout cleanup to prevent overlap in `MemberPublicProfileScreen`
- Comments modal avatar now respects community `logo_url` so community posts show correct image when commenting
- Removed unused placeholder HomeScreen components per role to reduce navigation clutter (`MemberHomeScreen`, `CommunityHomeScreen`, `SponsorHomeScreen`, `VenueHomeScreen`)

#### 🚧 In Progress (P1 - Core Features)

- Media Upload: Firebase Storage integration configured, upload UI ready ✅
- Real API Integration: A few screens still use mock data ⚠️

#### 📋 Next Priority (P1 - Core Features)

- **Connect Mock Data to Real API**: Replace mock data calls with real API endpoints
- **Event Registration Flow**: Complete registration flow for members
- **Sponsor Collaboration Requests**: Outreach system from sponsors to communities
- **Venue Booking Flow**: Complete booking request system
- **Community Collaboration**: Cross-community collaboration features

#### 🔮 Future (P2+ - Advanced Features)

- **Stories**: Ephemeral content with 24h expiry (backend support exists)
- **Payment Integration**: Premium features and payment QR handling
- **Admin Dashboard**: Content moderation and analytics
- **Advanced Matching**: Enhanced matching algorithms
- **Notification System**: Push notifications for interactions

### Technical Stack Status

- **Frontend**: React Native with Expo ✅
- **Backend**: Node.js + Express ✅
- **Database**: PostgreSQL with full schema ✅
- **Auth**: Supabase email OTP ✅
- **Storage**: Firebase Storage (configured, UI ready) ✅
- **Navigation**: React Navigation with role-based guards ✅
- **UI Components**: PostCard, AttendeeCard, MatchModal, ImageUploader, etc. ✅

### Key Features Implemented

1. **Complete Authentication**: Email OTP login/signup for all user types ✅
2. **Role-Based Dashboards**: Unique home screens for Members, Communities, Sponsors, Venues ✅
3. **Signup Flow**: Multi-step profiles with progress indicators ✅
4. **Bottom Tab Navigation**: Custom tab bars for each user type ✅
5. **Profile Screens**: Display and manage profiles with working logout ✅
6. **Post System**: Create, view, like, comment on posts ✅
7. **Feed System**: Personalized feeds for all user types ✅
8. **Matching Interface**: Event-based Bumble-style swiping ✅
9. **Event Management**: List events, show attendees, record swipes ✅
10. **Follow System**: Follow/unfollow users across all types ✅
11. **Member Search**: Debounced search, pagination, public profile ✅
12. **Notifications**: In-app list, unread badge, realtime banner ✅
13. **Delete Account**: Hard delete with confirmation ✅
14. **Persistent Login**: Auto refresh access token ✅
15. **Edit Profile (Member)**: Bio, username, email OTP change, phone, pronouns, interests, auto location ✅
16. **Member Search**: Debounced search with pagination, public profile drill-in ✅
17. **Member Public Profile**: View other members with posts grid, follow button, follower/following counts ✅
18. **Followers/Following Lists**: Paginated lists with user cards ✅
19. **Notifications**: In-app list, unread badge, realtime updates, mark read/all ✅
20. **Account Deletion**: Hard delete with type-to-confirm for all roles ✅
21. **Location Management**: GPS auto-detection, manual selection, location history tracking ✅
22. **Mock Data**: Comprehensive mock data for all user types ✅

### Current Architecture

- **Backend**: RESTful API with controllers for each feature area
- **Frontend**: Component-based architecture with reusable components
- **Navigation**: Stack + Bottom Tab navigators for seamless UX
- **State Management**: Local state with AsyncStorage for persistence
- **API Integration**: Structured API client with auth headers
