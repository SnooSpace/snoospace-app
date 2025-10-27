## Project Structure

### Repository Tree (Current State)

```
backend/
  config/
    db.js                    # PostgreSQL connection & schema setup
  controllers/
    authController.js        # OTP auth, user profile endpoints ✅
    communityController.js   # Community signup & management ✅
    memberController.js      # Member signup & profile ✅
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
  data/
    mockData.js             # Centralized mock data for all user types ✅
  navigation/
    AppNavigator.js         # Main navigation setup ✅
    BottomTabNavigator.js   # Member bottom tabs ✅
    CommunityBottomTabNavigator.js # Community tabs ✅
    SponsorBottomTabNavigator.js   # Sponsor tabs ✅
    VenueBottomTabNavigator.js     # Venue tabs ✅
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
        MemberHomeScreen.js      # Dashboard ✅
        HomeFeedScreen.js        # Post feed ✅
        CreatePostScreen.js     # Create post ✅
      community/
        CommunityHomeScreen.js  # Dashboard ✅
        CommunityHomeFeedScreen.js # Post feed ✅
        CommunityDashboardScreen.js # Metrics dashboard ✅
        CommunityEventsScreen.js    # Events list ✅
        CommunityRequestsScreen.js  # Collaboration requests ✅
        CommunitySearchScreen.js    # Search functionality ✅
        CommunityCreatePostScreen.js # Create post ✅
      sponsor/
        SponsorHomeScreen.js     # Dashboard ✅
        SponsorHomeFeedScreen.js  # Post feed ✅
        SponsorBrowseScreen.js     # Browse communities ✅
        SponsorOffersScreen.js    # Manage offers ✅
        SponsorCreatePostScreen.js # Create post ✅
      venue/
        VenueHomeScreen.js        # Dashboard ✅
        VenueHomeFeedScreen.js    # Post feed ✅
        VenueBrowseScreen.js      # Browse communities ✅
        VenueBookingsScreen.js    # Manage bookings ✅
        VenueCreatePostScreen.js  # Create post ✅
    profile/
      member/
        MemberProfileScreen.js    # Profile with logout ✅
      community/
        CommunityProfileScreen.js # Profile with logout ✅
      sponsor/
        SponsorProfileScreen.js  # Profile with logout ✅
      venue/
        VenueProfileScreen.js    # Profile with logout ✅
    matching/
      MatchingScreen.js          # Event-based matching (Bumble-style) ✅
    search/
      SearchScreen.js             # Search interface ✅
  App.js
  index.js
  package.json
  package-lock.json
  babel.config.js

.taskmaster/
  docs/
    PRD.md                  # Product Requirements Document
  tasks/
    README.md               # Task organization guide
    backlog.md              # Prioritized product backlog
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

#### 🚧 In Progress (P1 - Core Features)
- **Media Upload**: Firebase Storage integration configured, upload UI ready ✅
- **Real API Integration**: Currently using mock data in some screens, backend ready ⚠️

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
11. **Search & Browse**: Find communities, sponsors, venues ✅
12. **Mock Data**: Comprehensive mock data for all user types ✅

### Current Architecture
- **Backend**: RESTful API with controllers for each feature area
- **Frontend**: Component-based architecture with reusable components
- **Navigation**: Stack + Bottom Tab navigators for seamless UX
- **State Management**: Local state with AsyncStorage for persistence
- **API Integration**: Structured API client with auth headers