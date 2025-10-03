## Operations, Auth, and Storage Tasks

### P0 — Immediate
- [ ] Configure Supabase project with email OTP enabled
  1. Enable passwordless email OTP/magic links
  2. Create service role key and restrict usage
- [ ] Create Firebase project and storage buckets
  1. Buckets: stories, event-media, venue-media, qr-codes
  2. Set lifecycle policies (optional)
- [ ] Define .env templates and local dev configs
  1. `.env.example` for frontend/backend
  2. Document variable descriptions
- [ ] Write Firebase Storage security rules (stories, QR, venue media)
  1. Allow reads per privacy rules; writes for owners
  2. Validate content type and size
- [ ] Backend signed URL flow validated end-to-end
  1. Create signed URL endpoint
  2. Frontend upload integration test
- [ ] CI for lint/typecheck on push
  1. GitHub Actions or equivalent workflow
  2. Cache dependencies and fail on error

### Environment & Secrets
- Define .env templates for frontend and backend
- Store Supabase URL/anon/service keys securely
- Configure Firebase project and bucket per environment

### Auth (Supabase Email OTP)
- Enable passwordless email OTP in Supabase
- Implement magic link/OTP verification on frontend
- Session persistence and renewal
- Role assignment on first login

### Storage (Firebase)
- Create buckets for stories, event media, venue media, QR codes
- Write security rules aligned with privacy (registered-only access, admin-only private data)
- Generate signed upload/download URLs via backend

### CI/CD & Quality
- Linting and type checks on push/PR
- Basic test scaffolding
- Release build workflows (Android/iOS)

### Moderation & Compliance
- Admin tools to review/remove stories
- Logging and audit trails for admin actions


