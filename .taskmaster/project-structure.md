## Project Structure

### Repository Tree (high-level)

```
backend/
  package.json
  server.js
  routes.js
  supabase.js
frontend/
  App.js
  index.js
  navigation/
    AppNavigator.js
  screens/
    LandingScreen.js
    EmailInputScreen.js
    VerificationScreen.js
.taskmaster/
  docs/PRD.md
  tasks/
    README.md
    backlog.md
    frontend.md
    backend.md
    data-model.md
    operations.md
```

### Current Task

- Source: `.taskmaster/tasks`
- Executing: [completed] Complete auth flow with OTP + member signup + protected routes

### Task Status Snapshot

- Frontend (P0 — Immediate): completed
- Backend (P0 — Immediate): completed
- Data Model (P0 — Immediate): completed
- Operations (P0 — Immediate): completed

Notes:
- Frontend: API client + OTP screens wired to backend
- Backend: OTP endpoints + member signup + auth middleware + protected routes working
- Data Model: members table with constraints created
- Auth: Complete flow tested (OTP → verify → signup → protected routes)
- Next: Build role setup screens or implement other user types


