## Backend Tasks (Node.js + Express)

### P0 — Immediate
- [ ] Express server with health endpoint
  1. Initialize Express app with CORS and JSON parsing
  2. Add GET /health returning app/version/status
- [ ] Supabase auth middleware (verify OTP session)
  1. Initialize Supabase client with service role key (server-side)
  2. Middleware to validate bearer token and attach user
  3. Role extraction and guard helpers
- [ ] PostgreSQL connection and migration runner
  1. Configure pool/ORM
  2. Migration CLI and baseline migration
  3. Env-based config (dev/prod)
- [ ] Profiles CRUD (Member, Community, Sponsor, Venue)
  1. Upsert endpoints per role
  2. Admin-only read for community head private details
  3. Validation schemas
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
- [ ] Stories create/list with 24h TTL cleanup job
  1. Create endpoint (media_url, type)
  2. List endpoint (feed)
  3. Scheduled cleanup job removing expired
- [ ] Rate limiting and input validation
  1. Add rate limiter per IP/route
  2. Centralized zod/joi validation

### Setup
- Express server scaffolding and health endpoint
- Supabase auth middleware (verify email OTP sessions)
- Configure PostgreSQL client and migrations

### APIs — Users & Roles
- Create/update profiles: Member, Community, Sponsor, Venue
- Admin-only read for private community head details
- Role-based access control utilities

### APIs — Communities & Events
- Communities: CRUD, search, filters (city/theme)
- Events: create/update with required fields and QR media URL
- Event registration flow; gate exact location until registered

### APIs — Sponsors & Venues
- Sponsors: directory, filters, outreach initiation
- Venues: CRUD, media, capacity, price, slot availability, inquiries

### APIs — Stories & Moderation
- Stories: create/list, 24h TTL cleanup job
- Admin moderation endpoints

### APIs — Matching & Monetization
- Attendee roster endpoint per event
- Like/send-like endpoints
- Paid reveal endpoint (entitlement check)

### Media Handling
- Signed URL generation for Firebase Storage uploads/downloads
- Validation and content-type checks

### Observability & Ops
- Structured logging and error handling policy
- Rate limiting and input validation


