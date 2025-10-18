## Project Structure

### Repository Tree (Current State)

```
backend/
  config/
    db.js                    # PostgreSQL connection & schema setup
  controllers/
    authController.js        # OTP auth, user profile endpoints
    communityController.js   # Community signup & management
    memberController.js      # Member signup & profile
    sponsorController.js     # Sponsor signup & profile
    venueController.js       # Venue signup & profile
  middleware/
    auth.js                  # Supabase auth middleware
    rateLimit.js            # Rate limiting for OTP endpoints
    validators.js           # Input validation helpers
  routes/
    index.js                # Main API routes
  server.js                 # Express server setup
  supabase.js              # Supabase client config
  package.json
  package-lock.json

frontend/
  api/
    auth.js                 # Auth utilities & session management
    client.js               # API client with auth headers
  components/
    Progressbar.js          # Progress indicator component
  navigation/
    AppNavigator.js         # Main navigation setup
  screens/
    AuthGate.js             # Auth state routing
    LandingScreen.js        # Role selection landing
    CommunityHomeScreen.js  # Community dashboard
    MemberHomeScreen.js     # Member dashboard
    SponsorHomeScreen.js    # Sponsor dashboard
    VenueHomeScreen.js      # Venue dashboard
    signin/
      LoginScreen.js        # Email login
      LoginOtpScreen.js     # OTP verification
    signup/
      member/
        MemberSignupNavigator.js
        MemberEmailScreen.js
        MemberOtpScreen.js
        MemberPhoneScreen.js
        MemberNameScreen.js
        MemberGenderScreen.js
        MemberAgeScreen.js
        MemberInterestsScreen.js
        MemberLocationScreen.js
        MemberProfilePicScreen.js
      community/
        CommunitySignupNavigator.js
        CommunityEmailScreen.js
        CommunityOtpScreen.js
        CommunityPhoneNoScreen.js
        CommunityNameScreen.js
        CommunityBioScreen.js
        CommunityCategoryScreen.js
        CommunityLocationScreen.js
        CommunityLogoscreen.js
        CommunityHeadNameScreen.js
        CommunitySponsorTypeSelect.js
      sponsor/
        SponsorSignupNavigator.js
        SponsorEmailScreen.js
        SponsorOtpScreen.js
        SponsorDetailsScreen.js
      venue/
        VenueSignupNavigator.js
        VenueEmailScreen.js
        VenueOtpScreen.js
        VenueDetailsScreen.js
  App.js
  index.js
  package.json
  package-lock.json

.taskmaster/
  docs/
    PRD.md                  # Product Requirements Document
  tasks/
    README.md               # Task organization guide
    backlog.md              # Prioritized product backlog
    frontend.md             # Frontend development tasks
    backend.md              # Backend development tasks
    data-model.md           # Database schema tasks
    operations.md           # Auth, storage, CI/CD tasks
  project-structure.md      # This file
```

### Current Implementation Status

#### ✅ Completed (P0 - Foundations)
- **Auth System**: Complete OTP-based authentication with Supabase
- **Database Schema**: Core tables for all user types (members, communities, sponsors, venues)
- **Backend API**: Auth endpoints, user profile management, signup flows
- **Frontend Navigation**: Role-based routing and auth gates
- **Signup Flows**: Complete multi-step signup for all user types
- **Session Management**: Persistent auth with secure token storage

#### 🚧 In Progress (P1 - Core Features)
- **Home Screens**: Basic dashboards for each user type
- **Event Management**: Community event creation and management
- **Media Upload**: Firebase Storage integration for images/videos

#### 📋 Next Priority (P1 - Core Features)
- **Community Features**: Event creation, member management
- **Member Features**: Community browsing, event registration
- **Sponsor Features**: Community discovery and outreach
- **Venue Features**: Booking management and inquiries

#### 🔮 Future (P2+ - Advanced Features)
- **Stories**: Ephemeral content with 24h expiry
- **Matching**: Swipe-to-match at events
- **Monetization**: Premium features and payment integration
- **Admin Dashboard**: Content moderation and analytics

### Technical Stack Status
- **Frontend**: React Native with Expo ✅
- **Backend**: Node.js + Express ✅
- **Database**: PostgreSQL with connection pooling ✅
- **Auth**: Supabase email OTP ✅
- **Storage**: Firebase Storage (configured, pending integration) 🚧
- **Navigation**: React Navigation with role-based guards ✅


