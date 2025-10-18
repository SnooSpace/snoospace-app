## Frontend Tasks (React Native)

### ✅ P0 — Completed (Foundations)
- [x] Landing screen with 4 role cards
  1. ✅ Scaffold screen route in navigator
  2. ✅ Build four tappable cards with role icons
  3. ✅ Wire navigation to auth flow with selected role
- [x] Email OTP request + verification flow (Supabase)
  1. ✅ Add email input + validation
  2. ✅ Call Supabase sign-in with OTP/magic link
  3. ✅ Implement verification screen and status states
  4. ✅ Handle deep links (if magic link) and errors
- [x] Persist session and redirect to role setup
  1. ✅ Initialize Supabase auth listener
  2. ✅ Store session securely
  3. ✅ Implement app-level gate that routes to role setup
- [x] Minimal role setup forms: Member, Community, Sponsor, Venue
  1. ✅ Define per-role required fields
  2. ✅ Build forms with validation and progress
  3. ✅ Submit to backend profile endpoints
- [x] Role-based navigation guards
  1. ✅ Central guard HOC/hook
  2. ✅ Redirect unauthorized roles
  3. ✅ Unit test routes for access

### 🚧 P1 — In Progress (Core Features)
- [ ] Event list and details (hide exact location until registered)
  1. List: title, date/time, city, fee, venue label
  2. Detail: show fields; mask exact location until registered
  3. CTA to register; reflect registration state
- [ ] Community list/search
  1. Fetch list with pagination
  2. Search by name; filter by city/theme
  3. Join/follow actions
- [ ] Media picker and upload to Firebase (stories, event QR)
  1. Integrate image/video picker
  2. Request permissions
  3. Obtain signed URL from backend and upload
  4. Show progress and error states
- [ ] Multi-select UI for cities/interests
  1. Chip list with search
  2. Selection state and counters
  3. Submit normalized IDs to backend

### 📋 P1 — Next Priority (Core Features)
- [ ] Member Features
  1. Community listing/search with filters
  2. Event listing and details (hide exact location until registered)
  3. Event registration flow
  4. Profile management and photo uploads
- [ ] Community Features
  1. Event create/edit form (title, desc, themes, date/time, fee, city, venue, media, refund policy, exact location gated, payment QR)
  2. Member management and community settings
  3. Promo posts/videos creation
  4. Venue browsing & booking initiation
- [ ] Sponsor Features
  1. Community directory with filters (city/theme)
  2. Profile view and contact/offer initiation
  3. Target audience management
- [ ] Venue Features
  1. Venue create/edit listing (media, capacity, price, slots, conditions)
  2. Inquiry tracking list
  3. Booking management

### 🔮 P2 — Future Features
- [ ] Stories feed and create story (photo/video, 24h)
- [ ] Swipe-to-match UI and paid reveal flow
- [ ] Collaboration requests between communities
- [ ] Admin dashboard with content moderation views
- [ ] Metrics overview and analytics

### ✅ Setup (Completed)
- ✅ Install and configure navigation, state, theming
- ✅ Integrate Supabase client for email OTP
- ✅ Configure Firebase Storage SDK (pending integration)

### Cross-Cutting Features
- ✅ Role-based navigation guards
- [ ] Media picker/upload to Firebase Storage
- [ ] Multi-select UI for cities/interests
- [ ] Error states, loading, empty states
- [ ] Form validation and progress indicators


