## Backend Tasks (Node.js + Express)

### ✅ P0 — Completed (Foundations)
- [x] Express server with health endpoint
  1. ✅ Initialize Express app with CORS and JSON parsing
  2. ✅ Add GET /health returning app/version/status
- [x] Supabase auth middleware (verify OTP session)
  1. ✅ Initialize Supabase client with service role key (server-side)
  2. ✅ Middleware to validate bearer token and attach user
  3. ✅ Role extraction and guard helpers
- [x] PostgreSQL connection and migration runner
  1. ✅ Configure pool/ORM
  2. ✅ Migration CLI and baseline migration
  3. ✅ Env-based config (dev/prod)
- [x] Profiles CRUD (Member, Community, Sponsor, Venue)
  1. ✅ Upsert endpoints per role with comprehensive validation
  2. ✅ Admin-only read for community head private details
  3. ✅ Validation schemas with proper error handling
  4. ✅ Venue pricing system with multiple types (per head, hourly, daily)
  5. ✅ Database schema with proper constraints and defaults
- [x] Rate limiting and input validation
  1. ✅ Add rate limiter per IP/route
  2. ✅ Centralized zod/joi validation

### 🚧 P1 — In Progress (Core Features)
- [ ] Communities: CRUD + filters (city/theme)
  1. Create/list/update endpoints
  2. Query by city/theme with pagination
- [ ] Events: create with required fields, QR media URL
  1. Validation of required fields
  2. Persist payment_qr_url
  3. List/detail endpoints
- [ ] Event registration; gate exact location until registered
  1. Register endpoint linking member to event
  2. Detail handler hides exact_location if not registered
- [ ] Signed URL endpoints for Firebase uploads
  1. POST to request signed upload URL by resource type
  2. Validate content-type and size

### 📋 P1 — Next Priority (Core Features)
- [ ] APIs — Communities & Events
  1. Communities: CRUD, search, filters (city/theme)
  2. Events: create/update with required fields and QR media URL
  3. Event registration flow; gate exact location until registered
- [ ] APIs — Sponsors & Venues
  1. Sponsors: directory, filters, outreach initiation
  2. Venues: CRUD, media, capacity, price, slot availability, inquiries
- [ ] Media Handling
  1. Signed URL generation for Firebase Storage uploads/downloads
  2. Validation and content-type checks

### 🔮 P2 — Future Features
- [ ] APIs — Stories & Moderation
  1. Stories: create/list, 24h TTL cleanup job
  2. Admin moderation endpoints
- [ ] APIs — Matching & Monetization
  1. Attendee roster endpoint per event
  2. Like/send-like endpoints
  3. Paid reveal endpoint (entitlement check)

### ✅ Setup (Completed)
- ✅ Express server scaffolding and health endpoint
- ✅ Supabase auth middleware (verify email OTP sessions)
- ✅ Configure PostgreSQL client and migrations

### ✅ APIs — Users & Roles (Completed)
- ✅ Create/update profiles: Member, Community, Sponsor, Venue
- ✅ Admin-only read for private community head details
- ✅ Role-based access control utilities

### Observability & Ops
- ✅ Structured logging and error handling policy
- ✅ Rate limiting and input validation
- [ ] Performance monitoring and metrics
- [ ] Database query optimization


