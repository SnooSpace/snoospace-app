# Backlog – Social Posts (Next Steps)

Status: ongoing

## 🚧 In Progress
- [/] **Fix Like Synchronization Across Screens** (Community viewing Member posts)
  - [x] Added EventBus listener in MemberPublicProfileScreen to receive like updates
  - [ ] Add EventBus.emit in MemberPublicProfileScreen's PostModal handleLikeToggle
  - [ ] Update parent posts state when modal likes/unlikes
  - [ ] Test bidirectional sync (home feed ↔ profile modal)
  - **Issue**: PostModal updates local state but doesn't broadcast changes via EventBus
  - **Impact**: Likes in profile modal don't sync to home feed and vice versa

## 📋 Next Up
- [ ] Generalize Member PostModal into a shared component (props: post, onClose, onLikeUpdate, onOpenComments)
- [ ] Port profile posts grid (3-col) to Community/Sponsor/Venue with same sizing math
- [ ] Wire CommentsModal embedded mode for Community/Sponsor/Venue PostModal
- [ ] Consolidate API helpers for like/unlike/delete across user types
- [ ] Add E2E test plan for like/unlike without flicker and comments persistence
- [ ] Implement pull-to-refresh on profile posts grid (optional; current page scrolls parent)

Notes
- Keep buffered like updates pattern to avoid parent re-render per tap
- Keep comments modal anchored to bottom with `embedded` mode and zero bottom margin on input
- EventBus pattern: PostCard emits 'post-like-updated', screens listen and update state

