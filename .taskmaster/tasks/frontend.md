## Frontend Tasks (React Native)

### P0 — Immediate
- [ ] Landing screen with 4 role cards
  1. Scaffold screen route in navigator
  2. Build four tappable cards with role icons
  3. Wire navigation to auth flow with selected role
- [ ] Email OTP request + verification flow (Supabase)
  1. Add email input + validation
  2. Call Supabase sign-in with OTP/magic link
  3. Implement verification screen and status states
  4. Handle deep links (if magic link) and errors
- [ ] Persist session and redirect to role setup
  1. Initialize Supabase auth listener
  2. Store session securely
  3. Implement app-level gate that routes to role setup
- [ ] Minimal role setup forms: Member, Community, Sponsor, Venue
  1. Define per-role required fields
  2. Build forms with validation and progress
  3. Submit to backend profile endpoints
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
- [ ] Role-based navigation guards
  1. Central guard HOC/hook
  2. Redirect unauthorized roles
  3. Unit test routes for access

### Setup
- Install and configure navigation, state, theming
- Integrate Supabase client for email OTP
- Configure Firebase Storage SDK

### Onboarding & Auth
- Landing screen with 4 role cards
- Email OTP: request, verify, session handling
- Role-specific profile forms (minimal fields)

### Member
- Community listing/search
- Event listing and details (hide exact location until registered)
- Stories feed and create story (photo/video, 24h)
- Swipe-to-match UI and paid reveal flow

### Community
- Event create/edit form (title, desc, themes, date/time, fee, city, venue, media, refund policy, exact location gated, payment QR)
- Promo posts/videos
- Collaboration requests
- Venue browsing & booking initiation

### Sponsor
- Community directory with filters (city/theme)
- Profile view and contact/offer initiation

### Venue
- Venue create/edit listing (media, capacity, price, slots, conditions)
- Inquiry tracking list

### Admin
- Content moderation views (stories, posts)
- Metrics overview stubs

### Cross-Cutting
- Media picker/upload to Firebase Storage
- Multi-select UI for cities/interests
- Role-based navigation guards
- Error states, loading, empty states


