## Data Model Tasks (PostgreSQL)

### ✅ P0 — Completed (Foundations)
- [x] Define ERD for users, profiles, events, stories, venues
  1. ✅ Draft ER diagram and review with team
  2. ✅ Document table fields and constraints
- [x] Create initial migrations for core tables
  1. ✅ users, role profiles, interests, cities
  2. ✅ events, attendees, stories, likes (partial)
- [x] Add indexes and FKs for main relations
  1. ✅ FKs: users->profiles, events->communities, attendees->events/users
  2. ✅ Indexes: search by city/theme, recent stories, upcoming events

### 🚧 P1 — In Progress (Core Features)
- [ ] Seed interests and cities
  1. Create seed lists for cities (major metros) and interests
  2. Idempotent seed scripts
- [ ] TTL or job policy for stories expiry
  1. Expires_at default + index
  2. Cleanup job or DB policy to purge

### ✅ Core Tables (Implemented)
- **members** (id, name, email, phone, dob, gender, city, interests JSONB, created_at)
- **communities** (id, name, logo_url, bio, category, location, email, phone, sponsor_types JSONB, created_at)
- **community_heads** (id, community_id FK, name, email, phone, profile_pic_url, is_primary, created_at)
- **sponsors** (id, brand_name, bio, logo_url, email, phone, requirements, interests JSONB, cities JSONB, created_at)
- **venues** (id, name, address, city, contact_name, contact_email, contact_phone, capacity_min, capacity_max, price_per_head, conditions, created_at)

### ✅ Taxonomy (Implemented)
- **interests** (id, label)
- **cities** (id, name)
- **sponsor_interests** (sponsor_id FK, interest_id FK)
- **sponsor_cities** (sponsor_id FK, city_id FK)

### 📋 Events (Pending Implementation)
- **events** (id, community_id, title, description, theme_ids, date, start_time, end_time, entry_fee, city_id, venue_id nullable, custom_location, refund_policy, exact_location, payment_qr_url, created_at)
- **event_attendees** (event_id, member_id, status)

### 🔮 Stories (Future)
- **stories** (id, owner_user_id, media_url, media_type, created_at, expires_at)

### 🔮 Matching (Future)
- **likes** (event_id, liker_member_id, likee_member_id, created_at)
- **entitlements** (member_id, feature, granted_until)

### 🔮 Sponsors & Venues (Future)
- **venue_media** (venue_id, media_url, media_type)
- **venue_slots** (venue_id, slot_time, available)
- **venue_inquiries** (venue_id, community_id, status, notes, created_at)

### 🔮 Admin & Moderation (Future)
- **moderation_flags** (content_type, content_id, reason, status, created_at)

### 📋 Remaining Tasks
- [ ] Design migrations for events and event_attendees tables
- [ ] Add soft-deletes where applicable
- [ ] Write seed scripts for interests and cities
- [ ] Implement database constraints and validation rules
- [ ] Add performance indexes for search queries
- [ ] Set up database backup and recovery procedures


