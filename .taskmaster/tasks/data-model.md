## Data Model Tasks (PostgreSQL)

### ✅ P0 — Completed (Foundations)
- [x] Define ERD for users, profiles, events, stories, venues ✅
  - Drafted ER diagram with all relationships
  - Documented table fields and constraints
  - Defined cross-type relationships (follows, tagged entities)
- [x] Create initial migrations for core tables ✅
  - Members, Communities, Community_heads, Sponsors, Venues
  - Posts, Post_comments, Post_likes
  - Events, Event_registrations
  - Follows system
  - Lookup tables (interests, cities)
- [x] Add indexes and FKs for main relations ✅
  - Foreign keys for all relationships
  - Indexes for search and queries
  - Constraints for data integrity

### ✅ P1 — Core Features (Completed)
- [x] Complete events and matching schema ✅
  - Events table with all required fields
  - Event_registrations table
  - Event_swipes table
  - Event_matches table
  - Next_event_requests table
- [x] Posts and interactions schema ✅
  - Posts table with author info, images, caption, tags
  - Post_comments table with replies support
  - Post_likes table
- [x] Follow system schema ✅
  - Follows table for cross-type following
- [x] Member photos table ✅
  - Separate table for member photo galleries
- [x] Venue pricing system ✅
  - Multiple pricing types (per_head, hourly, daily)
  - Capacity management
  - Conditions field
- [x] Community collaboration fields ✅
  - Sponsor_types JSONB for communities
  - Community_heads for private admin info
- [x] Pronoun support for members ✅
  - Added pronouns field to members table

### ✅ Core Tables (Implemented)

#### User Tables:
- **members**
  - id (PK), name, email (unique), phone, dob, gender
  - interests (JSONB), username (unique), bio
  - profile_photo_url, pronouns (TEXT[]), location (JSONB: {city, state, country, lat, lng})
  - created_at
- **communities**
  - id (PK), name, logo_url, bio, category, location (TEXT - to be migrated to JSONB)
  - email (unique), phone, sponsor_types (JSONB)
  - username (unique), created_at
- **community_heads** (private info, admin only)
  - id (PK), community_id (FK), name, email, phone
  - profile_pic_url, is_primary
  - created_at
- **sponsors**
  - id (PK), user_id, brand_name, logo_url, bio, category
  - email (unique), phone, requirements
  - interests (JSONB), cities (JSONB)
  - username (unique), created_at
- **venues**
  - id (PK), name, address, city
  - contact_name, contact_email (unique), contact_phone
  - capacity_min, capacity_max
  - price_per_head, hourly_price, daily_price
  - conditions, username (unique)
  - created_at

#### Content Tables:
- **posts**
  - id (PK), author_id, author_type
  - caption, image_urls (JSONB)
  - tagged_entities (JSONB)
  - like_count, comment_count
  - created_at
- **post_comments**
  - id (PK), post_id (FK)
  - commenter_id, commenter_type
  - comment_text, parent_comment_id (FK)
  - like_count, created_at
- **post_likes**
  - id (PK), post_id (FK)
  - liker_id, liker_type
  - created_at (unique on post+liker)

#### Event Tables:
- **events**
  - id (PK), community_id (FK), venue_id (FK nullable)
  - title, description
  - event_date, start_time, end_time
  - entry_fee, city, exact_location
  - max_attendees, is_past
  - payment_qr_url, refund_policy
  - created_at
- **event_registrations**
  - id (PK), event_id (FK), member_id (FK)
  - registration_status (registered, attended, cancelled)
  - registered_at
- **event_swipes**
  - id (PK), event_id (FK), swiper_id (FK), swipee_id (FK)
  - swipe_type (like/pass), created_at
- **event_matches**
  - id (PK), event_id (FK), member1_id (FK), member2_id (FK)
  - match_status (pending, accepted, declined)
  - matched_at
- **next_event_requests**
  - id (PK), event_id (FK)
  - requester_id (FK), target_id (FK)
  - message, status (pending, accepted, declined)
  - created_at

#### Social Tables:
- **follows**
  - id (PK)
  - follower_id, follower_type
  - following_id, following_type
  - created_at
  - Unique on (follower_id, follower_type, following_id, following_type)
- **member_photos**
 - **notifications**
  - id (PK)
  - recipient_id (FK), recipient_type (member/community/sponsor/venue)
  - actor_id, actor_type
  - type (follow, like, comment, etc.)
  - payload (JSONB: actor info, post id, etc.)
  - is_read (BOOLEAN, default false)
  - created_at
  - Indexes: (recipient_id, recipient_type, is_read), (created_at DESC)

  - id (PK), member_id (FK)
  - photo_url, photo_order
  - created_at
- **member_location_history**
  - id (PK), member_id (FK)
  - location (JSONB: {city, state, country, lat, lng})
  - created_at
  - Index: (member_id, created_at DESC)

#### Lookup Tables:
- **interests**
  - id (PK), label
- **cities**
  - id (PK), name

### 🔮 Future Tables
- **stories**
  - id (PK), owner_id, owner_type
  - media_url, media_type
  - created_at, expires_at
- **venue_bookings**
  - id (PK), venue_id (FK), event_id (FK)
  - status, booking_date
  - created_at, confirmed_at
- **collaboration_requests**
  - id (PK), requester_id, requester_type
  - target_id, target_type
  - message, status
  - created_at

### ✅ Database Features Implemented
- ✅ Unique constraints on usernames across all user types
- ✅ Unique constraints on emails for members, communities, sponsors
- ✅ Unique constraint on contact_email for venues
- ✅ Foreign key cascading deletes
- ✅ JSONB fields for flexible data (interests, cities, tags)
- ✅ Timestamp fields for created_at tracking
- ✅ Phone number support across all user types
- ✅ Profile photo support for all user types
- ✅ Bio/description fields for context
- ✅ Capacity and pricing management for venues
- ✅ Event registration status tracking
- ✅ Swipe and match tracking
- ✅ Cross-type following system
- ✅ Post tagging system for mentions
- ✅ Nested comments support
- ✅ Member location history tracking
- ✅ Notifications system with realtime support
- ✅ Account deletion (hard delete)

### 📋 Remaining Schema Tasks
- [ ] Add indexes for performance optimization
  - Search by username
  - Search by city/category
  - Event date queries
  - Post feed queries
- [ ] Add story expiry cleanup job
  - Scheduled job to delete expired stories
- [ ] Add soft-deletes where needed
- [ ] Implement database views for common queries
- [ ] Add full-text search capabilities
- [ ] Optimize JSONB queries with GIN indexes
- [ ] Add database constraints for data validation
  - Check constraints for status fields
  - Check constraints for capacity limits
  - Check constraints for date ranges

### Database Health Checks
- ✅ Connection pooling configured
- ✅ Health check endpoint implemented
- ✅ Error handling for database operations
- ✅ Transaction support for multi-step operations
- [ ] Query performance monitoring
- [ ] Database backup strategy
- [ ] Migration rollback procedures

### Current Schema Status
- **Total Tables**: 20+ 
- **User Types**: 4 (Member, Community, Sponsor, Venue)
- **Content Types**: Posts, Comments, Events
- **Social Features**: Follows, Swipes, Matches
- **Lookup Tables**: Interests, Cities
- **All CRUD Operations**: Implemented
- **Relationships**: Fully defined with FKs
- **Constraints**: Unique, NOT NULL, CHECK constraints in place