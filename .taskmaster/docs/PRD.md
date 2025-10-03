## SnooSpace – Product Requirements Document (PRD)

### 1. Overview

SnooSpace is a social engagement platform connecting **Members**, **Communities**, **Sponsors**, and **Venues**. The app facilitates event creation, community engagement, sponsorship collaborations, venue selection, and member networking through a swipe-to-match feature.

---

### 2. User Types

- **Member**
- **Community**
- **Sponsor**
- **Venue (Cafés & Restaurants)**

---

### 3. Onboarding Flow

#### 3.1 Landing Screen (Logged Out Users)

Display four role cards:

1. Member
2. Community
3. Sponsor
4. Venue

#### 3.2 Member Onboarding

- **Auth**: Email-based OTP only (no passwords).
- **Collect**: Name, Email, Phone Number, Age/Date of Birth, Gender, City, Interests (multi-select)
- **Post-Login**:
  - Browse/search communities to join
  - Participate in events
  - Swipe-to-match with attendees
  - Post and view Stories (photo/video, 24-hour expiry)

#### 3.3 Community Onboarding

- **Sign Up Fields**:
  - Community Name, Short Bio
  - Community Head(s): Name (min 1), Email, Phone Number (visible only to Admin)
  - Logo upload
  - City/Cities (multi-select)
  - Themes/Interests (multi-select)
- **Post-Login**:
  - Create event cards
  - Add promotional posts/videos
  - Optional public community head profile
  - Add refund policy
  - View sponsors & other communities
  - Send collaboration requests
  - Browse & book venues for events

#### 3.4 Sponsor Onboarding

- **Sign Up Fields**:
  - Brand Name, Short Bio, Logo
  - Target Audience/Interests (multi-select)
  - Sponsorship Requirements (text)
  - Phone Number, Email
  - Cities willing to sponsor in (multi-select)
- **Post-Login**:
  - View community profiles
  - Filter by city/theme
  - Reach out for sponsorship deals

#### 3.5 Venue Onboarding (Cafés & Restaurants)

- **Sign Up Fields**:
  - Venue Name, Logo/Image
  - Address + City
  - Contact Person: Name, Phone Number, Email
  - Capacity (min & max)
  - Price per head
  - Available time slots
  - Extra conditions (optional notes, e.g., “music must end by 10pm”)
- **Post-Login**:
  - Manage and update listings
  - Track bookings or interest from communities
  - Add promotional images/videos

---

### 4. Event Creation (Community)

Required fields for creating an event:

- Event Title, Description
- Themes/Interests
- Date, Start Time, End Time
- Entry Fee
- City
- Venue (select from Venues list or custom location)
- Optional: Promo videos/images
- Refund Policy
- Exact Location (visible only after registration)
- Payment QR code upload
- Optional community head info in footer

---

### 5. Member Features

- Join communities
- Attend events
- Swipe-to-Match:
  - View attendees
  - Send likes
  - Pay to see who liked them
- Profile setup: photos + interests
- Stories:
  - Post photo/video updates
  - 24-hour expiry
  - View stories from members, communities, and sponsors

---

### 6. Sponsor Features

- Search/filter communities
- View sponsorship compatibility
- Initiate offers
- Discover venues available for sponsorship tie-ups

---

### 7. Community Features

- Event management
- Promotions
- Refund policies
- Collaborations with other communities
- Sponsor outreach
- Venue browsing & booking
- View sponsors’ target cities/interests

---

### 8. Venue Features (Cafés & Restaurants)

- List and manage venue details
- Set pricing and slot availability
- Add extra conditions
- Upload venue media
- Receive booking interest from communities
- Analytics: number of inquiries, confirmed bookings

---

### 9. Admin Dashboard

- Core metrics: members, communities, sponsors, venues
- Event engagement
- Sponsorship & venue deals tracking
- User data management
- Community head private details
- Content moderation (including stories)

---

### 10. Monetization

- Swipe-to-Match premium unlock
- Sponsorship commissions
- Event promotion boosts
- Venue listing upgrades (featured venues, promoted slots)

---

### 11. Privacy

- Community head details → only Admin
- Exact event location → only registered members
- Matching data → private until match
- Venue contracts → visible only to community & venue owner

---

### 12. Technical Requirements

- Multi-select for cities/interests
- Media upload (images/videos)
- Stories support (ephemeral content)
- Secure QR payment uploads
- Role-based dashboards (Member, Community, Sponsor, Venue, Admin)
- Email-based OTP authentication (no passwords)

---

### 13. Tech Stack

- **Frontend**: React Native
- **Backend**: Node.js with Express
- **Auth**: Supabase (email OTP only)
- **Database**: PostgreSQL
- **File Storage**: Firebase Storage


