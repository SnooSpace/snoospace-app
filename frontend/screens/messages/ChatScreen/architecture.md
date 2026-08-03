# ChatScreen Architecture & Developer Guide

This document defines the modular architecture, hook dependency contracts, state ownership rules, end-to-end event flows, and developer invariants for the `ChatScreen` module (`frontend/screens/messages/ChatScreen/`).

---

## 1. High-Level System Architecture

`ChatScreen` acts strictly as an **orchestrator component**. It owns no direct business logic, feature timers, or subscription state itself. Instead, it composes specialized feature hooks and passes referentially stable state and callbacks to memoized sub-components.

```
ChatScreen (Orchestrator Component: ~380 lines)
│
├── [State & Composition Hooks]
│   ├── useChatAlerts (Alert modal state)
│   ├── useChatRecipient (Direct message recipient profile & block status)
│   ├── useGroupMessaging (Group status & admin restrictions)
│   ├── useChatMessages (Composite hook owning pagination, interactions, viewer, reply state)
│   │   ├── useChatPagination (Messages array, cursor walk, atomic commit)
│   │   ├── useReplyState (Selected reply target & preview state)
│   │   ├── useMessageInteractions (Highlighting, scroll-to-message, copy)
│   │   └── useMessageViewer (Media viewer modal state & timeline)
│   ├── useChatInitialization (Initial data resolution, cache hydration, background sync)
│   ├── useChatRealtime (Supabase Postgres change stream listener)
│   ├── useChatSocket (Socket.io event listener: new_chat_message, join/leave room)
│   ├── useChatTyping (Typing indicators & socket emission)
│   ├── useChatUploads (Text & multi-media upload pipeline)
│   └── useChatModeration (Block, unblock, report modal & action sheet handlers)
│
└── [Memoized Sub-Components]
    ├── ChatHeader (Navigation back, recipient avatar, mute/info options)
    ├── BlockBanner (Blocked user alert & unblock CTA)
    ├── ChatMessageList (FlashList v2 list canvas with maintainVisibleContentPosition)
    │   └── MessageRow (Memoized row renderer using _msgWrapperCache)
    ├── ChatInputArea (Composer text input, media picker button, typing indicator)
    │   ├── TypingIndicator (Animated typing dots)
    │   ├── ClosedGroupBar (Closed group lock banner)
    │   └── LockedAnnouncementBar (Admin-only announcement lock bar)
    └── ChatModals (Message options sheet, report reason picker, custom alerts)
```

---

## 2. Hook Dependency Contracts

Feature hooks must **never** import one another. Cross-feature coordination occurs strictly in `ChatScreen` via dependency injection.

| Hook Name | Primary Responsibility | Inputs | Key Outputs | Subscriptions & Cleanups |
| :--- | :--- | :--- | :--- | :--- |
| `useChatAlerts` | Manages custom alert modal state | None | `alertConfig`, `showAlert`, `hideAlert` | None |
| `useChatRecipient` | Resolves DM recipient profile & block state | `conversationId`, `recipientId`, `recipientName`, `recipientAvatar`, `recipientType`, `isGroup` | `recipient`, `currentRecipientId`, `isBlockedByOther`, `youHaveBlocked` | Async profile resolution |
| `useGroupMessaging` | Manages group restrictions & admin roles | `isGroup`, `currentConversationId`, `initialMessagingRestricted`, `initialMyGroupRole` | `groupStatus`, `messagingRestricted`, `myGroupRole` | Async group participant resolution |
| `useChatMessages` | Composes pagination, viewer, reply, and interactions | `conversationId`, `isGroup`, `currentUser`, `recipient`, `recipientId`, `flashListRef`, `navigationRef`, `showAlert`, `hideAlert` | `messages`, `flatListData`, `getItemType`, `replyState`, `interactions`, `viewer` | Composes 4 child hooks |
| `useChatInitialization` | Handles cache hydration, initial fetch & background reconcile | `conversationId`, `recipientId`, `recipientType`, `isGroup`, `navigation`, `loadInitial`, `addNewMessages`, `bootstrapPaginationState`, etc. | `currentUser`, `messagesLoading` | Navigation listener cleanups (`transitionEnd`, `blur`, `beforeRemove`) |
| `useChatRealtime` | Listens to Supabase `postgres_changes` on `messages` table | `currentConversationId`, `currentUser`, `addNewMessage`, `updateMessageById` | None | Supabase channel `.unsubscribe()` / `removeChannel()` on unmount |
| `useChatSocket` | Manages Socket.io room joins & chat message events | `currentConversationId`, `currentUser`, `addNewMessage`, `updateMessageById`, `setGroupStatus`, `loadInitial`, `isAtBottomRef`, `flashListRef` | None | `socket.emit('join_chat')`, `socket.emit('leave_chat')`, `socket.off()` cleanups |
| `useChatTyping` | Tracks typing users & emits typing events | `currentConversationId`, `currentUser` | `typingUsers`, `handleTypingToggle` | `socket.on('user_typing')` & `socket.off()` cleanups |
| `useChatUploads` | Manages text send & Cloudinary multi-media upload pipeline | `currentConversationId`, `currentRecipientId`, `recipientId`, `selectedReply`, `addNewMessage`, `composerRef`, `flashListRef`, etc. | `sending`, `uploadingMedia`, `uploadProgress`, `handleSendPayload` | Upload progress state tracking |
| `useChatModeration` | Manages user blocking, unblocking, and message reporting | `currentRecipientId`, `currentRecipientType`, `recipient`, `setYouHaveBlocked`, `showAlert`, `hideAlert` | `optionsModalVisible`, `reportSheetVisible`, `handleBlockUser`, `handleReportUser`, etc. | Action sheet modal state |

---

## 3. State Ownership Rules

1. **Single Ownership**: Every piece of state has exactly one owner hook.
   - `useChatPagination` owns `messages`, `hasMore`, `loadingOlder`, and pagination cursors.
   - `useReplyState` owns `selectedReply`.
   - `useChatRecipient` owns `recipient` and block flags.
   - `useChatUploads` owns `sending`, `uploadingMedia`, and `uploadProgress`.
2. **No State Duplication**: Shared state is lifted to `ChatScreen` and passed explicitly as parameters into consuming hooks.
3. **No Direct Feature-to-Feature Imports**: A feature hook (e.g. `useChatSocket`) must never import another feature hook (e.g. `useChatUploads`).

---

## 4. End-to-End Event Flow Diagrams

### Send Message Flow
```
User Taps Send Button
       │
       ▼
ChatInputArea → onSend(text, attachments)
       │
       ▼
useChatUploads.handleSendPayload
       ├── [If Media]: Uploads files via uploadChatMedia → Updates uploadProgress
       │
       ▼
API Call: sendMessage({ conversationId, recipientId, messageText, metadata })
       │
       ▼
Response Received → Construct Message Object
       │
       ▼
addNewMessage(msg) → Insert into useChatPagination State (Deduped + Sorted Ascending)
       │
       ▼
EventBus.emit("conversation-updated") & EventBus.emit("new-message")
       │
       ▼
flashListRef.scrollToEnd({ animated: true })
```

### Receive Message Flow (Socket.io & Supabase Realtime)
```
Server Emits "new_chat_message" / Supabase Realtime "INSERT"
       │
       ▼
useChatSocket / useChatRealtime Handler
       │
       ▼
Check: senderId === currentUser.id ?
       ├── YES: Return (Ignore self-emitted duplicate)
       │
       ▼
addNewMessage(msg) → useChatPagination
       │
       ├── Check: prev.some(m => m.id === msg.id) ? Return prev (Deduplicate)
       └── Insert & Sort Ascending (Oldest → Newest)
       │
       ▼
appendMessageToCache(conversationId, msg)
       │
       ▼
If isAtBottom: flashListRef.scrollToEnd({ animated: true })
       │
       ▼
markMessageRead(msg.id) & NotificationConsumptionService.consumeChat()
```

### Scroll-Up Pagination Flow
```
User Scrolls Up → FlashList triggers onStartReached
       │
       ▼
ChatMessageList → loadOlderMessages(currentConversationId)
       │
       ▼
Check: isLoadingRef.current || !hasMoreRef.current || !cursorRef.current
       ├── YES: Bail out (Prevent duplicate in-flight requests)
       │
       ▼
API Call: getMessages(conversationId, { before: cursor, limit: 12 })
       │
       ▼
Single Atomic State Commit: setMessages(prev => [...freshOlder, ...prev])
       │
       ▼
FlashList maintainVisibleContentPosition anchors viewport (Zero Jump)
```

---

## 5. Developer Invariants

To prevent future architectural drift, all modifications to `ChatScreen` must strictly uphold the following invariants:

1. **Memoization Invariant**:
   - `MessageRow` **must** remain wrapped in `React.memo` with its custom shallow comparator.
   - `buildMessageList` **must** use `_msgWrapperCache` to reuse `{ type: "message", data: msg }` references across array updates.

2. **Render Location Invariant**:
   - `renderItem` **must** remain inside `ChatScreen` or `ChatMessageList` as a memoized callback. `ChatMessageList` must never own or re-create `renderItem` logic internally.

3. **Hook Isolation Invariant**:
   - Feature hooks (`useChatSocket`, `useChatRealtime`, `useChatUploads`, etc.) must **never** import one another. All cross-feature coordination occurs in `ChatScreen`.

4. **Subscription Cleanup Invariant**:
   - Every `useEffect` subscribing to Socket.io events (`socket.on`), Supabase channels (`supabase.channel`), navigation listeners (`navigation.addListener`), or EventBus listeners (`EventBus.on`) **must** return a cleanup function (`socket.off`, `channel.unsubscribe`, `unsub()`).

5. **Single Commit Invariant**:
   - Pagination prepends and batch polling updates **must** commit in a **single `setMessages` call** to prevent FlashList viewport jumping.

6. **State Ownership Invariant**:
   - Do not mirror or duplicate state variables across multiple hooks. Always lift shared state to `ChatScreen` and pass it down.
