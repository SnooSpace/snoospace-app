## Operations, Auth, and Storage Tasks

### ✅ P0 — Completed (Foundations)
- [x] Configure Supabase project with email OTP enabled
  1. ✅ Enable passwordless email OTP/magic links
  2. ✅ Create service role key and restrict usage
- [x] Define .env templates and local dev configs
  1. ✅ `.env.example` for frontend/backend
  2. ✅ Document variable descriptions

### 🚧 P1 — In Progress (Core Features)
- [ ] Create Firebase project and storage buckets
  1. Buckets: stories, event-media, venue-media, qr-codes
  2. Set lifecycle policies (optional)
- [ ] Write Firebase Storage security rules (stories, QR, venue media)
  1. Allow reads per privacy rules; writes for owners
  2. Validate content type and size
- [ ] Backend signed URL flow validated end-to-end
  1. Create signed URL endpoint
  2. Frontend upload integration test

### 📋 P1 — Next Priority (Core Features)
- [ ] CI for lint/typecheck on push
  1. GitHub Actions or equivalent workflow
  2. Cache dependencies and fail on error
- [ ] Environment & Secrets
  1. Store Supabase URL/anon/service keys securely
  2. Configure Firebase project and bucket per environment
- [ ] Storage (Firebase)
  1. Create buckets for stories, event media, venue media, QR codes
  2. Write security rules aligned with privacy (registered-only access, admin-only private data)
  3. Generate signed upload/download URLs via backend

### 🔮 P2 — Future Features
- [ ] CI/CD & Quality
  1. Basic test scaffolding
  2. Release build workflows (Android/iOS)
- [ ] Moderation & Compliance
  1. Admin tools to review/remove stories
  2. Logging and audit trails for admin actions

### ✅ Auth (Supabase Email OTP) - Completed
- ✅ Enable passwordless email OTP in Supabase
- ✅ Implement magic link/OTP verification on frontend
- ✅ Session persistence and renewal
- ✅ Role assignment on first login

### ✅ Environment & Secrets (Completed)
- ✅ Define .env templates for frontend and backend


