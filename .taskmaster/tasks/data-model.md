## Data Model Tasks (PostgreSQL)

### P0 — Immediate
- [ ] Define ERD for users, profiles, events, stories, venues
  1. Draft ER diagram and review with team
  2. Document table fields and constraints
- [ ] Create initial migrations for core tables
  1. users, role profiles, interests, cities
  2. events, attendees, stories, likes
- [ ] Seed interests and cities
  1. Create seed lists for cities (major metros) and interests
  2. Idempotent seed scripts
- [ ] Add indexes and FKs for main relations
  1. FKs: users->profiles, events->communities, attendees->events/users
  2. Indexes: search by city/theme, recent stories, upcoming events
- [ ] TTL or job policy for stories expiry
  1. Expires_at default + index
  2. Cleanup job or DB policy to purge

### Core Tables
- users (id, role, email, phone, created_at)
- member_profiles (user_id FK, name, dob, gender, city)
- community_profiles (user_id FK, name, bio, logo_url)
- community_heads_private (community_id FK, name, email, phone)
- sponsor_profiles (user_id FK, brand_name, bio, logo_url)
- venue_profiles (user_id FK, name, address, city, contact_name, phone, email, capacity_min, capacity_max, price_per_head)

### Taxonomy
- interests (id, label)
- cities (id, name)
- user_interests (user_id, interest_id)
- user_cities (user_id, city_id)

### Events
- events (id, community_id, title, description, theme_ids, date, start_time, end_time, entry_fee, city_id, venue_id nullable, custom_location, refund_policy, exact_location, payment_qr_url, created_at)
- event_attendees (event_id, member_id, status)

### Stories
- stories (id, owner_user_id, media_url, media_type, created_at, expires_at)

### Matching
- likes (event_id, liker_member_id, likee_member_id, created_at)
- entitlements (member_id, feature, granted_until)

### Sponsors & Venues
- sponsor_targets (sponsor_id, interest_id, city_id)
- venue_media (venue_id, media_url, media_type)
- venue_slots (venue_id, slot_time, available)
- venue_inquiries (venue_id, community_id, status, notes, created_at)

### Admin & Moderation
- moderation_flags (content_type, content_id, reason, status, created_at)

### Tasks
- Design migrations for all tables with indexes and FKs
- Add soft-deletes where applicable
- Write seed scripts for interests and cities


