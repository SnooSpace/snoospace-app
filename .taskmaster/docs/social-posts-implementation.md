# Social Posts - Current Implementation Notes (Member)

This document captures how posts, likes, comments, modals, and the profile grid are implemented today for the Member user type. Mirror these patterns for Community, Sponsor, and Venue when extending the feature set.

## Recent Fixes / Notes

- Unified `is_liked` normalization so every PostCard/PostModal trusts `post.is_liked === true`. This eliminated stale booleans that previously came from legacy props.
- `EventBus` now broadcasts both `post-like-updated` and `post-comment-updated` events from Home feeds, profile screens, and the `CommentsModal`. All profile screens listen and merge those payloads into their `posts` arrays plus any open PostModal state.
- When posts reload after navigation (e.g., refetch on focus), we preserve the locally updated `is_liked` + counts to avoid reverting hearts to the wrong state.
- `CommentsModal` avatar resolution checks both `profile_photo_url` (members) and `logo_url` (communities) so the composer shows the real image before & after sending comments.
- Member profile header now wraps `displayName` + pronouns with `flexWrap` to prevent overlap on long names.

## Components and Files

- `frontend/screens/profile/member/MemberProfileScreen.js`
  - Owns the profile UI, posts grid, and the full-screen PostModal component (in-file).
  - Maintains `posts` state and user profile.
  - Uses a 3-column grid based on `FlatList` with `numColumns={3}` and calculated tile sizes.
  - Uses a buffered approach for like updates to avoid unnecessary parent re-renders.
  - Integrates an embedded `CommentsModal` overlay inside the PostModal so the post remains visible.

- `frontend/components/CommentsModal.js`
  - Displays list of comments, supports like/unlike on comments, and posting new comments.
  - Has an `embedded` mode for rendering as an overlay inside another modal (PostModal), ensuring correct z-ordering and background.
  - Uses `KeyboardAvoidingView` to keep the input visible over the keyboard.

## Post Grid (Profile)

- Implemented via `FlatList` with `numColumns={3}` and `columnWrapperStyle` to control gaps.
- Tile size formula: `(screenWidth - 40 - (gap * 2)) / 3`, where container padding is 20 on each side and `gap` is 10 between items.
- Disabled `scrollEnabled` to let the parent `ScrollView` control scrolling.

Key snippet:

```jsx
const gap = 10;
const itemSize = (screenWidth - 40 - (gap * 2)) / 3;

<FlatList
  numColumns={3}
  columnWrapperStyle={{ justifyContent: 'flex-start', marginBottom: gap }}
  renderItem={({ item, index }) => (
    <TouchableOpacity style={{ width: itemSize, height: itemSize, marginRight: (index + 1) % 3 === 0 ? 0 : gap }} />
  )}
  scrollEnabled={false}
/>
```

## Full Post Modal (PostModal)

- PostModal is defined inline in `MemberProfileScreen.js`.
- It manages local UI state for likes and comment count to avoid flicker and parent re-renders.
- Parent updates are buffered in a ref via the `onLikeUpdate` callback and only applied once on modal close.
- Comments are opened as an embedded overlay (see below), no navigation or stacking issues.

Like/unlike behavior:

1. PostModal manages `isLiked` and `likes` locally.
2. Calls backend endpoints:
   - Like: `POST /posts/:postId/like`
   - Unlike: `DELETE /posts/:postId/like`
3. On success, calls `onLikeUpdate(postId, isLiked, likeCount)` which buffers the change (no parent state writes while modal is open).
4. On modal close, the buffered update is applied to `posts` in the parent.

Benefits:
- No parent re-render per tap.
- Avoids flicker and stale prop overwrites.

## Comments Modal

- `CommentsModal` supports two modes:
  - Default modal (transparent overlay, `presentationStyle="overFullScreen"`).
  - Embedded overlay (`embedded` prop) for rendering inside PostModal.

Embedded specifics:
- We render the `CommentsModal` as a sibling to the PostModal's `SafeAreaView` to avoid SafeArea bottom padding pushing it up.
- Styles ensure the sheet anchors to the bottom: `embeddedContainer` uses `justifyContent: 'flex-end'` and the input container has `marginBottom: 0`.

Posting comments:
- `handlePostComment` enriches the new comment with the current user profile fields if required (name, username, `profile_photo_url`).
- After posting, we append locally, clear input, and notify parent via `onCommentCountChange(newCount)`.

Comment like/unlike:
- Optimistic update of `is_liked` and `like_count` per comment.
- Endpoints:
  - Like: `POST /comments/:commentId/like`
  - Unlike: `DELETE /comments/:commentId/like`
- On error, revert the optimistic change.

## Backend (relevant bits)

- Post delete: `DELETE /posts/:postId` with ownership checks. UI removes the post locally and closes overlays.
- Get post: robust JSON parsing for `image_urls` and `tagged_entities`.
- Get comments: returns `like_count` and `is_liked` for authenticated users; we normalize `like_count` to numbers on the client.

## Modal Z-Ordering & Behavior

- `PostModal` remains visible while `CommentsModal` is open (embedded overlay). Background while commenting is the post view itself.
- We removed previous logic that hid the PostModal when comments open.

## Patterns to Reuse for Community, Sponsor, Venue

- Use the same PostModal local state pattern for like/unlike to prevent flicker.
- Use the buffered parent update strategy via a ref, applied on modal close.
- Reuse `CommentsModal` as-is; pass `embedded` for overlays within PostModal.
- Adopt the 3-column `FlatList` grid with explicit gap math and disabled inner scrolling.

## Known Good Defaults

- Gap between tiles: `10`.
- Container padding: `20` each side.
- `KeyboardAvoidingView` behavior: iOS `padding`, Android `height`.
- Comments input container: `marginBottom: 0`.

## Open Items / Next Steps

- Port Member implementation to Community, Sponsor, and Venue profiles.
- Extract PostModal into a shared component with minimal props to reduce duplication.
- Centralize API helpers for like/unlike and delete across user types.


