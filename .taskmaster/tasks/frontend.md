## Frontend Tasks (React Native)

### ✅ P0 — Completed (Foundations)
- [x] Landing screen with 4 role cards ✅
  - Scaffolded screen route in navigator
  - Built four tappable cards with role icons
  - Wired navigation to auth flow with selected role
- [x] Email OTP request + verification flow (Supabase) ✅
  - Email input + validation
  - Supabase sign-in with OTP
  - Verification screen and status states
  - Deep links and error handling
- [x] Persist session and redirect to role setup ✅
  - Supabase auth listener
  - Secure session storage
  - App-level gate routing to role setup
- [x] Complete role setup forms: Member, Community, Sponsor, Venue ✅
  - Defined per-role required fields with validation
  - Built multi-step forms with progress indicators
  - Submit to backend profile endpoints
  - Session persistence on signup completion
  - Venue pricing system with multiple types
- [x] Role-based navigation guards ✅
  - Central guard via auth middleware
  - Redirect unauthorized roles
  - Route protection implemented
- [x] Bottom tab navigation for all user types ✅
  - Member BottomTabNavigator (Home, Search, Matching, Post, Profile)
  - Community BottomTabNavigator (Home, Search, Dashboard, Create, Profile)
  - Sponsor BottomTabNavigator (Home, Browse, Offers, Create, Profile)
  - Venue BottomTabNavigator (Home, Browse, Bookings, Create, Profile)
- [x] Profile screens with logout functionality ✅
  - Member, Community, Sponsor, Venue profiles
  - Settings modal with logout
  - Proper AsyncStorage clearing and navigation reset
- [x] Home/Feed screens for all user types ✅
  - Member home with feed
  - Community dashboard and feed
  - Sponsor home with opportunities
  - Venue home with inquiries
- [x] Post system with interaction ✅
  - PostCard component with likes, comments
  - Feed display for all user types
  - Post creation screens
- [x] Follow system ✅
  - Follow/unfollow buttons
  - Follow status checking
  - Follow counts display
- [x] Event-based matching interface ✅
  - Bumble-style swipe cards (AttendeeCard)
  - Match celebration modal
  - Next event request modal
  - Event list with attendee matching
- [x] Comprehensive component library ✅
  - PostCard, AttendeeCard, MatchModal
  - ImageUploader, UserCard, FollowButton
  - EntityTagSelector, Progressbar
- [x] Search and browse functionality ✅
  - Community search screen
  - Sponsor browse screen
  - Venue browse screen
  - Member search interface

### 🚧 P1 — In Progress (Core Features)
- [ ] Replace mock data with real API calls
  - Connect ImageUploader to real backend signed URLs
  - Connect all screens to real backend endpoints
  - Handle loading, error, and empty states properly
- [ ] Complete media upload integration
  - Request signed URLs from backend
  - Upload images to Firebase Storage
  - Show progress indicators
  - Handle errors gracefully

### 📋 P1 — Next Priority (Core Features)
- [ ] Community Features (Replicate Member features)
  - Edit Profile screen (EditCommunityProfileScreen.js)
  - Community search screen (CommunitySearchScreen.js)
  - Public community profile screen (CommunityPublicProfileScreen.js)
  - Community followers/following lists
  - Community API client (communities.js)
  - Community Stack Navigator
  - Business Location Picker component (for signup and edit)
- [ ] Member Features (Remaining)
  - Connect community browse to real API
  - Event registration flow integration
  - Real post feed from API (partially done)
- [ ] Community Features
  - Complete event creation form with all fields
  - Event management (edit, delete)
  - Member management interface
  - Venue booking request system
  - Sponsor collaboration requests
- [ ] Sponsor Features
  - Community directory with real data
  - Send collaboration offers
  - Track offer responses
  - Manage target audience
- [ ] Venue Features
  - Venue listing management
  - Booking inquiry tracking
  - Availability calendar
  - Pricing updates
- [ ] Cross-cutting Features
  - Push notifications for interactions
  - Real-time updates for likes/comments
  - Profile editing for all user types
  - Image gallery views

### ✅ Recently Completed (since last update)
- Persistent login with automatic access token refresh (access + refresh tokens)
- Member search screen (SearchScreen.js) with debounced input, pagination, and public profile drill-in
- Member public profile screen (MemberPublicProfileScreen.js) with 3-column posts grid, follow button, follower/following counts
- Follow/Unfollow in search and public profile with optimistic UI updates
- Followers/Following list screens (FollowersListScreen.js, FollowingListScreen.js) with pagination
- Notifications screen (NotificationsScreen.js): list, unread badge, mark read/all, realtime subscription
- Notification banner component (Instagram-style), correct safe area placement
- Delete Account: settings action with type "delete" confirmation, hard delete for all roles
- Profile photo update fix + circular loading indicator during upload
- Profile/post grids sizing corrected to 3-column design
- Edit Profile (Member) - EditProfileScreen.js: bio, username, email change via OTP, phone (no OTP), pronouns, interests (catalog + custom), and auto location (GPS)
- Member API client (members.js): Complete API functions for all Member features
- Member Stack Navigator (MemberStackNavigator.js): Navigation for profile, edit, search, notifications
- New components: ChipSelector, EmailChangeModal
- expo-location dependency added for GPS location
- Post like-state persistence fixes (Member/Community Home + Profile + PostModal) with EventBus merging and strict `is_liked` normalization
- Member public profile header layout fixes (name/pronouns flex wrap) to prevent overlap
- CommentsModal avatar handling updated to prefer `logo_url` so communities see their logos while typing/sending comments

### 🔮 P2 — Future Features
- [ ] Stories feed and create story (photo/video, 24h)
- [ ] Enhanced matching UI with filters
- [ ] Collaboration request management UI
- [ ] Admin dashboard views
- [ ] Metrics overview and analytics
- [ ] Advanced search with filters

### ✅ Setup (Completed)
- ✅ Installed and configured navigation, state, theming
- ✅ Integrated Supabase client for email OTP
- ✅ Configured Firebase Storage SDK
- ✅ Set up bottom tab navigators
- ✅ Created comprehensive mock data
- ✅ Built reusable component library

### Cross-Cutting Features
- ✅ Role-based navigation guards
- ⚠️ Media picker/upload to Firebase Storage (UI ready, integration pending)
- ✅ Multi-select UI for interests (signup and edit profile)
- ✅ Error states, loading, empty states (PostCard, forms)
- ✅ Form validation and progress indicators (all signup flows)
- ✅ Comprehensive logout handling for all user types
- ✅ Session persistence across app restarts with refresh logic

### Component Status
- ✅ Progressbar.js - Reusable progress indicator
- ✅ PostCard.js - Post display with interactions
- ✅ AttendeeCard.js - Bumble-style swipe card
- ✅ MatchModal.js - Match celebration animation
- ✅ NextEventRequestModal.js - Event request form
- ✅ ImageUploader.js - Multi-image selection and upload
- ✅ UserCard.js - User profile preview
- ✅ FollowButton.js - Follow/unfollow toggle
- ✅ EntityTagSelector.js - Tag users/communities in posts
- ✅ ChipSelector.js - Multi-select chip component for interests
- ✅ EmailChangeModal.js - Email change OTP verification modal