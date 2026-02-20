# Diff Details

Date : 2026-02-19 23:08:51

Directory c:\\Users\\sanja\\OneDrive\\Documents\\Harshith\\SnooSpace

Total : 207 files,  30905 codes, 2345 comments, 2620 blanks, all 35870 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [admin/package-lock.json](/admin/package-lock.json) | JSON | 188 | 0 | 0 | 188 |
| [admin/package.json](/admin/package.json) | JSON | 3 | 0 | 0 | 3 |
| [admin/src/app/(dashboard)/categories/page.tsx](/admin/src/app/(dashboard)/categories/page.tsx) | TypeScript JSX | 378 | 11 | 15 | 404 |
| [admin/src/app/(dashboard)/colleges/page.tsx](/admin/src/app/(dashboard)/colleges/page.tsx) | TypeScript JSX | 890 | 23 | 40 | 953 |
| [admin/src/components/layout/sidebar.tsx](/admin/src/components/layout/sidebar.tsx) | TypeScript JSX | 6 | 0 | 0 | 6 |
| [admin/src/components/ui/collapsible.tsx](/admin/src/components/ui/collapsible.tsx) | TypeScript JSX | 28 | 0 | 6 | 34 |
| [admin/src/components/ui/image-cropper.tsx](/admin/src/components/ui/image-cropper.tsx) | TypeScript JSX | 153 | 3 | 17 | 173 |
| [admin/src/components/ui/slider.tsx](/admin/src/components/ui/slider.tsx) | TypeScript JSX | 58 | 0 | 6 | 64 |
| [admin/src/lib/api.ts](/admin/src/lib/api.ts) | TypeScript | 176 | 20 | 23 | 219 |
| [backend/config/db.js](/backend/config/db.js) | JavaScript | 105 | 0 | 0 | 105 |
| [backend/controllers/cardExtensionController.js](/backend/controllers/cardExtensionController.js) | JavaScript | 281 | 42 | 52 | 375 |
| [backend/controllers/categoryController.js](/backend/controllers/categoryController.js) | JavaScript | 192 | 33 | 32 | 257 |
| [backend/controllers/challengeController.js](/backend/controllers/challengeController.js) | JavaScript | 472 | 61 | 63 | 596 |
| [backend/controllers/collegeController.js](/backend/controllers/collegeController.js) | JavaScript | 312 | 56 | 37 | 405 |
| [backend/controllers/communityController.js](/backend/controllers/communityController.js) | JavaScript | 12 | 1 | 0 | 13 |
| [backend/controllers/eventController.js](/backend/controllers/eventController.js) | JavaScript | 12 | -1 | 2 | 13 |
| [backend/controllers/messageController.js](/backend/controllers/messageController.js) | JavaScript | -7 | 1 | -2 | -8 |
| [backend/controllers/opportunityController.js](/backend/controllers/opportunityController.js) | JavaScript | 867 | 70 | 125 | 1,062 |
| [backend/controllers/pollController.js](/backend/controllers/pollController.js) | JavaScript | 20 | 11 | 3 | 34 |
| [backend/controllers/postController.js](/backend/controllers/postController.js) | JavaScript | 810 | 75 | 84 | 969 |
| [backend/controllers/qnaController.js](/backend/controllers/qnaController.js) | JavaScript | 0 | 1 | 0 | 1 |
| [backend/controllers/saveController.js](/backend/controllers/saveController.js) | JavaScript | 162 | 24 | 25 | 211 |
| [backend/controllers/shareController.js](/backend/controllers/shareController.js) | JavaScript | 217 | 33 | 35 | 285 |
| [backend/controllers/uploadController.js](/backend/controllers/uploadController.js) | JavaScript | 39 | 5 | -1 | 43 |
| [backend/controllers/viewsController.js](/backend/controllers/viewsController.js) | JavaScript | 174 | 52 | 29 | 255 |
| [backend/routes/index.js](/backend/routes/index.js) | JavaScript | 225 | 22 | 11 | 258 |
| [backend/scripts/README.md](/backend/scripts/README.md) | Markdown | 89 | 0 | 45 | 134 |
| [backend/scripts/add\_crop\_metadata\_migration.sql](/backend/scripts/add_crop_metadata_migration.sql) | MS SQL | 4 | 2 | 2 | 8 |
| [backend/scripts/add\_expires\_at\_column.sql](/backend/scripts/add_expires_at_column.sql) | MS SQL | 3 | 5 | 4 | 12 |
| [backend/scripts/add\_media\_types\_column.sql](/backend/scripts/add_media_types_column.sql) | MS SQL | 2 | 3 | 3 | 8 |
| [backend/scripts/add\_unique\_conversation\_constraint.sql](/backend/scripts/add_unique_conversation_constraint.sql) | MS SQL | 6 | 4 | 5 | 15 |
| [backend/scripts/add\_video\_thumbnail\_migration.sql](/backend/scripts/add_video_thumbnail_migration.sql) | MS SQL | 3 | 5 | 3 | 11 |
| [backend/scripts/card\_timing\_system\_migration.sql](/backend/scripts/card_timing_system_migration.sql) | MS SQL | 50 | 28 | 21 | 99 |
| [backend/scripts/check\_duplicates.js](/backend/scripts/check_duplicates.js) | JavaScript | 56 | 3 | 7 | 66 |
| [backend/scripts/check\_results.log](/backend/scripts/check_results.log) | Log | 24 | 0 | 5 | 29 |
| [backend/scripts/cleanup\_duplicate\_conversations.sql](/backend/scripts/cleanup_duplicate_conversations.sql) | MS SQL | 64 | 23 | 13 | 100 |
| [backend/scripts/cleanup\_duplicates\_safe.sql](/backend/scripts/cleanup_duplicates_safe.sql) | MS SQL | 98 | 38 | 18 | 154 |
| [backend/scripts/community\_categories\_migration.sql](/backend/scripts/community_categories_migration.sql) | MS SQL | 32 | 16 | 6 | 54 |
| [backend/scripts/create\_challenge\_tagging\_tables.js](/backend/scripts/create_challenge_tagging_tables.js) | JavaScript | 84 | 13 | 13 | 110 |
| [backend/scripts/db\_state.json](/backend/scripts/db_state.json) | JSON | 81 | 0 | 0 | 81 |
| [backend/scripts/drop\_sponsor\_types\_constraint.sql](/backend/scripts/drop_sponsor_types_constraint.sql) | MS SQL | 1 | 8 | 3 | 12 |
| [backend/scripts/fix\_bidirectional\_dupes.js](/backend/scripts/fix_bidirectional_dupes.js) | JavaScript | 80 | 14 | 13 | 107 |
| [backend/scripts/fix\_poll\_votes\_constraint.sql](/backend/scripts/fix_poll_votes_constraint.sql) | MS SQL | 6 | 4 | 5 | 15 |
| [backend/scripts/opportunities\_migration.sql](/backend/scripts/opportunities_migration.sql) | MS SQL | 112 | 26 | 25 | 163 |
| [backend/scripts/post\_edit\_tracking\_migration.sql](/backend/scripts/post_edit_tracking_migration.sql) | MS SQL | 7 | 6 | 5 | 18 |
| [backend/scripts/qualified\_views\_migration.sql](/backend/scripts/qualified_views_migration.sql) | MS SQL | 31 | 17 | 9 | 57 |
| [backend/scripts/run\_card\_timing\_migration.js](/backend/scripts/run_card_timing_migration.js) | JavaScript | 30 | 6 | 9 | 45 |
| [backend/scripts/run\_challenge\_enhanced\_migration.js](/backend/scripts/run_challenge_enhanced_migration.js) | JavaScript | 83 | 12 | 12 | 107 |
| [backend/scripts/run\_fix\_poll\_votes\_constraint.js](/backend/scripts/run_fix_poll_votes_constraint.js) | JavaScript | 34 | 2 | 8 | 44 |
| [backend/scripts/run\_qualified\_views\_migration.js](/backend/scripts/run_qualified_views_migration.js) | JavaScript | 43 | 12 | 12 | 67 |
| [backend/utils/cardState.js](/backend/utils/cardState.js) | JavaScript | 98 | 42 | 26 | 166 |
| [backend/utils/cloudinaryVideo.js](/backend/utils/cloudinaryVideo.js) | JavaScript | 41 | 44 | 10 | 95 |
| [frontend/App.js](/frontend/App.js) | JavaScript | 38 | 2 | 3 | 43 |
| [frontend/api/client.js](/frontend/api/client.js) | JavaScript | 128 | 66 | 18 | 212 |
| [frontend/api/cloudinary.js](/frontend/api/cloudinary.js) | JavaScript | 72 | 16 | 10 | 98 |
| [frontend/api/opportunities.js](/frontend/api/opportunities.js) | JavaScript | 71 | 69 | 14 | 154 |
| [frontend/components/CategorySelector.js](/frontend/components/CategorySelector.js) | JavaScript | 5 | 0 | 0 | 5 |
| [frontend/components/ChipSelector.js](/frontend/components/ChipSelector.js) | JavaScript | -86 | -1 | -4 | -91 |
| [frontend/components/CommentsModal.js](/frontend/components/CommentsModal.js) | JavaScript | -77 | 3 | -7 | -81 |
| [frontend/components/CountdownTimer.js](/frontend/components/CountdownTimer.js) | JavaScript | 39 | 6 | 14 | 59 |
| [frontend/components/CreatePostScreen.js](/frontend/components/CreatePostScreen.js) | JavaScript | 286 | 10 | 15 | 311 |
| [frontend/components/DeletePostModal.js](/frontend/components/DeletePostModal.js) | JavaScript | 148 | 0 | 8 | 156 |
| [frontend/components/DiscoverFilterSheet.js](/frontend/components/DiscoverFilterSheet.js) | JavaScript | 340 | 13 | 25 | 378 |
| [frontend/components/DynamicStatusBar.js](/frontend/components/DynamicStatusBar.js) | JavaScript | 22 | 11 | 5 | 38 |
| [frontend/components/EditorialPostCard.js](/frontend/components/EditorialPostCard.js) | JavaScript | 767 | 44 | 60 | 871 |
| [frontend/components/EmailChangeModal.js](/frontend/components/EmailChangeModal.js) | JavaScript | 126 | 1 | 5 | 132 |
| [frontend/components/EntityTagSelector.js](/frontend/components/EntityTagSelector.js) | JavaScript | 144 | 21 | 6 | 171 |
| [frontend/components/EventCard.js](/frontend/components/EventCard.js) | JavaScript | 1 | 0 | 0 | 1 |
| [frontend/components/FollowerList.js](/frontend/components/FollowerList.js) | JavaScript | 21 | 5 | 5 | 31 |
| [frontend/components/FullscreenVideoModal.js](/frontend/components/FullscreenVideoModal.js) | JavaScript | 491 | 17 | 37 | 545 |
| [frontend/components/GradientButton.js](/frontend/components/GradientButton.js) | JavaScript | 3 | 0 | 0 | 3 |
| [frontend/components/GradientSafeArea.js](/frontend/components/GradientSafeArea.js) | JavaScript | 61 | 11 | 7 | 79 |
| [frontend/components/HomeFeedScreen.js](/frontend/components/HomeFeedScreen.js) | JavaScript | 380 | 54 | 42 | 476 |
| [frontend/components/HomeGreetingHeader.js](/frontend/components/HomeGreetingHeader.js) | JavaScript | 101 | 23 | 14 | 138 |
| [frontend/components/ImageUploader.js](/frontend/components/ImageUploader.js) | JavaScript | 697 | 53 | 52 | 802 |
| [frontend/components/KeyboardAwareToolbar.js](/frontend/components/KeyboardAwareToolbar.js) | JavaScript | 32 | 1 | 3 | 36 |
| [frontend/components/MediaCrop/BatchCropScreen.js](/frontend/components/MediaCrop/BatchCropScreen.js) | JavaScript | 182 | 25 | 25 | 232 |
| [frontend/components/MediaCrop/CropPresets.js](/frontend/components/MediaCrop/CropPresets.js) | JavaScript | 59 | 28 | 11 | 98 |
| [frontend/components/MediaCrop/CropScreen.js](/frontend/components/MediaCrop/CropScreen.js) | JavaScript | 56 | 5 | 4 | 65 |
| [frontend/components/MediaCrop/CropUtils.js](/frontend/components/MediaCrop/CropUtils.js) | JavaScript | 12 | 3 | 3 | 18 |
| [frontend/components/MediaCrop/CropView.js](/frontend/components/MediaCrop/CropView.js) | JavaScript | 42 | 12 | 2 | 56 |
| [frontend/components/MediaCrop/index.js](/frontend/components/MediaCrop/index.js) | JavaScript | 2 | 0 | 0 | 2 |
| [frontend/components/MediaCrop/useCrop.js](/frontend/components/MediaCrop/useCrop.js) | JavaScript | 1 | 1 | 0 | 2 |
| [frontend/components/MentionInput.js](/frontend/components/MentionInput.js) | JavaScript | -100 | 1 | -4 | -103 |
| [frontend/components/MentionSearchDropdown.js](/frontend/components/MentionSearchDropdown.js) | JavaScript | 253 | 2 | 12 | 267 |
| [frontend/components/OpportunityFeedCard.js](/frontend/components/OpportunityFeedCard.js) | JavaScript | 678 | 16 | 34 | 728 |
| [frontend/components/PostCard.js](/frontend/components/PostCard.js) | JavaScript | -328 | -14 | -24 | -366 |
| [frontend/components/PremiumHeader.js](/frontend/components/PremiumHeader.js) | JavaScript | 107 | 20 | 15 | 142 |
| [frontend/components/ProfilePostFeed.js](/frontend/components/ProfilePostFeed.js) | JavaScript | 230 | 18 | 22 | 270 |
| [frontend/components/ProfileTabIcon.js](/frontend/components/ProfileTabIcon.js) | JavaScript | 84 | 1 | 10 | 95 |
| [frontend/components/QualifiedViewWrapper.js](/frontend/components/QualifiedViewWrapper.js) | JavaScript | 6 | 11 | 3 | 20 |
| [frontend/components/RangeSlider.js](/frontend/components/RangeSlider.js) | JavaScript | 187 | 0 | 22 | 209 |
| [frontend/components/RemovalRequestsModal.js](/frontend/components/RemovalRequestsModal.js) | JavaScript | 392 | 8 | 17 | 417 |
| [frontend/components/RichTextEditor.js](/frontend/components/RichTextEditor.js) | JavaScript | 38 | 1 | 1 | 40 |
| [frontend/components/ShareModal.js](/frontend/components/ShareModal.js) | JavaScript | 389 | 1 | 19 | 409 |
| [frontend/components/SharedPostCard.js](/frontend/components/SharedPostCard.js) | JavaScript | 416 | 25 | 31 | 472 |
| [frontend/components/SnooSpaceLogo.js](/frontend/components/SnooSpaceLogo.js) | JavaScript | 33 | 2 | 3 | 38 |
| [frontend/components/StyledText.js](/frontend/components/StyledText.js) | JavaScript | 13 | 12 | 6 | 31 |
| [frontend/components/ThemeChip.js](/frontend/components/ThemeChip.js) | JavaScript | 35 | 0 | 2 | 37 |
| [frontend/components/TicketMessageCard.js](/frontend/components/TicketMessageCard.js) | JavaScript | -360 | -4 | -11 | -375 |
| [frontend/components/UnexpectedLogoutBanner.js](/frontend/components/UnexpectedLogoutBanner.js) | JavaScript | 26 | 0 | 0 | 26 |
| [frontend/components/UnsavedChangesModal.js](/frontend/components/UnsavedChangesModal.js) | JavaScript | 140 | 0 | 7 | 147 |
| [frontend/components/VideoPlayer.js](/frontend/components/VideoPlayer.js) | JavaScript | 545 | 92 | 63 | 700 |
| [frontend/components/feedback/SuccessCard.js](/frontend/components/feedback/SuccessCard.js) | JavaScript | 403 | 12 | 26 | 441 |
| [frontend/components/modals/CreateEventModal.js](/frontend/components/modals/CreateEventModal.js) | JavaScript | 746 | 20 | 28 | 794 |
| [frontend/components/modals/DraftRecoveryModal.js](/frontend/components/modals/DraftRecoveryModal.js) | JavaScript | 2 | 0 | 0 | 2 |
| [frontend/components/modals/HeadsEditorModal.js](/frontend/components/modals/HeadsEditorModal.js) | JavaScript | 421 | 5 | 19 | 445 |
| [frontend/components/modals/PollVotersModal.js](/frontend/components/modals/PollVotersModal.js) | JavaScript | 309 | 0 | 12 | 321 |
| [frontend/components/modals/SettingsModal.js](/frontend/components/modals/SettingsModal.js) | JavaScript | -3 | 0 | 0 | -3 |
| [frontend/components/posts/AnimatedProgressBar.js](/frontend/components/posts/AnimatedProgressBar.js) | JavaScript | 36 | 5 | 8 | 49 |
| [frontend/components/posts/ChallengeCreateForm.js](/frontend/components/posts/ChallengeCreateForm.js) | JavaScript | 72 | 2 | 9 | 83 |
| [frontend/components/posts/ChallengeEditModal.js](/frontend/components/posts/ChallengeEditModal.js) | JavaScript | 366 | 2 | 22 | 390 |
| [frontend/components/posts/ChallengePostCard.js](/frontend/components/posts/ChallengePostCard.js) | JavaScript | 632 | 13 | 33 | 678 |
| [frontend/components/posts/PollCreateForm.js](/frontend/components/posts/PollCreateForm.js) | JavaScript | 75 | 1 | 4 | 80 |
| [frontend/components/posts/PollEditModal.js](/frontend/components/posts/PollEditModal.js) | JavaScript | 288 | 2 | 18 | 308 |
| [frontend/components/posts/PollPostCard.js](/frontend/components/posts/PollPostCard.js) | JavaScript | 395 | 8 | 32 | 435 |
| [frontend/components/posts/PostTypeSelector.js](/frontend/components/posts/PostTypeSelector.js) | JavaScript | -56 | 3 | 3 | -50 |
| [frontend/components/posts/PromptCreateForm.js](/frontend/components/posts/PromptCreateForm.js) | JavaScript | 62 | 6 | 5 | 73 |
| [frontend/components/posts/PromptEditModal.js](/frontend/components/posts/PromptEditModal.js) | JavaScript | 295 | 2 | 17 | 314 |
| [frontend/components/posts/PromptPostCard.js](/frontend/components/posts/PromptPostCard.js) | JavaScript | 298 | 6 | 24 | 328 |
| [frontend/components/posts/QnACreateForm.js](/frontend/components/posts/QnACreateForm.js) | JavaScript | 87 | 5 | 6 | 98 |
| [frontend/components/posts/QnAEditModal.js](/frontend/components/posts/QnAEditModal.js) | JavaScript | 341 | 2 | 20 | 363 |
| [frontend/components/posts/QnAPostCard.js](/frontend/components/posts/QnAPostCard.js) | JavaScript | 228 | 19 | 30 | 277 |
| [frontend/components/ui/CustomDatePicker.js](/frontend/components/ui/CustomDatePicker.js) | JavaScript | 569 | 63 | 56 | 688 |
| [frontend/components/ui/CustomTimePicker.js](/frontend/components/ui/CustomTimePicker.js) | JavaScript | 459 | 8 | 31 | 498 |
| [frontend/constants/theme.js](/frontend/constants/theme.js) | JavaScript | 73 | 5 | 5 | 83 |
| [frontend/context/VideoContext.js](/frontend/context/VideoContext.js) | JavaScript | 82 | 21 | 19 | 122 |
| [frontend/contexts/StatusBarManager.js](/frontend/contexts/StatusBarManager.js) | JavaScript | 40 | 14 | 10 | 64 |
| [frontend/hooks/useQualifiedView.js](/frontend/hooks/useQualifiedView.js) | JavaScript | 115 | 30 | 26 | 171 |
| [frontend/hooks/useVideoQualifiedView.js](/frontend/hooks/useVideoQualifiedView.js) | JavaScript | 127 | 27 | 32 | 186 |
| [frontend/navigation/BottomTabNavigator.js](/frontend/navigation/BottomTabNavigator.js) | JavaScript | 28 | -1 | 0 | 27 |
| [frontend/navigation/CommunityBottomTabNavigator.js](/frontend/navigation/CommunityBottomTabNavigator.js) | JavaScript | -14 | -5 | -3 | -22 |
| [frontend/navigation/CommunityDashboardStackNavigator.js](/frontend/navigation/CommunityDashboardStackNavigator.js) | JavaScript | 14 | 0 | 0 | 14 |
| [frontend/navigation/CommunityHomeStackNavigator.js](/frontend/navigation/CommunityHomeStackNavigator.js) | JavaScript | 24 | 0 | 0 | 24 |
| [frontend/navigation/DiscoverStackNavigator.js](/frontend/navigation/DiscoverStackNavigator.js) | JavaScript | 7 | 0 | 0 | 7 |
| [frontend/navigation/HomeStackNavigator.js](/frontend/navigation/HomeStackNavigator.js) | JavaScript | 7 | 0 | 0 | 7 |
| [frontend/navigation/ProfileStackNavigator.js](/frontend/navigation/ProfileStackNavigator.js) | JavaScript | 2 | 0 | 0 | 2 |
| [frontend/package-lock.json](/frontend/package-lock.json) | JSON | 364 | 0 | 0 | 364 |
| [frontend/package.json](/frontend/package.json) | JSON | 5 | 0 | 0 | 5 |
| [frontend/screens/SavedPostsScreen.js](/frontend/screens/SavedPostsScreen.js) | JavaScript | 274 | 3 | 25 | 302 |
| [frontend/screens/auth/AuthGate.js](/frontend/screens/auth/AuthGate.js) | JavaScript | 71 | 3 | 4 | 78 |
| [frontend/screens/auth/LandingScreen.js](/frontend/screens/auth/LandingScreen.js) | JavaScript | 6 | 0 | 2 | 8 |
| [frontend/screens/discover/ActivityInsightsScreen.js](/frontend/screens/discover/ActivityInsightsScreen.js) | JavaScript | -30 | 4 | 9 | -17 |
| [frontend/screens/discover/DiscoverScreen.js](/frontend/screens/discover/DiscoverScreen.js) | JavaScript | 20 | -1 | 2 | 21 |
| [frontend/screens/discover/EditDiscoverProfileScreen.js](/frontend/screens/discover/EditDiscoverProfileScreen.js) | JavaScript | 282 | 7 | 16 | 305 |
| [frontend/screens/discover/OpenerSelectionScreen.js](/frontend/screens/discover/OpenerSelectionScreen.js) | JavaScript | 75 | 1 | 0 | 76 |
| [frontend/screens/discover/ProfileFeedScreen.js](/frontend/screens/discover/ProfileFeedScreen.js) | JavaScript | -258 | -16 | -29 | -303 |
| [frontend/screens/events/YourEventsScreen.js](/frontend/screens/events/YourEventsScreen.js) | JavaScript | 323 | 7 | 15 | 345 |
| [frontend/screens/home/ChallengeSubmissionsScreen.js](/frontend/screens/home/ChallengeSubmissionsScreen.js) | JavaScript | 530 | 9 | 15 | 554 |
| [frontend/screens/home/ChallengeSubmitScreen.js](/frontend/screens/home/ChallengeSubmitScreen.js) | JavaScript | 216 | 6 | 8 | 230 |
| [frontend/screens/home/QnAQuestionsScreen.js](/frontend/screens/home/QnAQuestionsScreen.js) | JavaScript | 190 | 5 | 12 | 207 |
| [frontend/screens/home/community/ApplicantDetailScreen.js](/frontend/screens/home/community/ApplicantDetailScreen.js) | JavaScript | 548 | 0 | 27 | 575 |
| [frontend/screens/home/community/ApplicantsListScreen.js](/frontend/screens/home/community/ApplicantsListScreen.js) | JavaScript | 408 | 0 | 22 | 430 |
| [frontend/screens/home/community/CommunityCreatePostScreen.js](/frontend/screens/home/community/CommunityCreatePostScreen.js) | JavaScript | 349 | 16 | 13 | 378 |
| [frontend/screens/home/community/CommunityDashboardScreen.js](/frontend/screens/home/community/CommunityDashboardScreen.js) | JavaScript | 58 | -2 | 5 | 61 |
| [frontend/screens/home/community/CommunityHomeFeedScreen.js](/frontend/screens/home/community/CommunityHomeFeedScreen.js) | JavaScript | -471 | -16 | -34 | -521 |
| [frontend/screens/home/community/CreateOpportunityScreen.js](/frontend/screens/home/community/CreateOpportunityScreen.js) | JavaScript | 2,256 | 20 | 111 | 2,387 |
| [frontend/screens/home/community/OpportunitiesListScreen.js](/frontend/screens/home/community/OpportunitiesListScreen.js) | JavaScript | 463 | 1 | 19 | 483 |
| [frontend/screens/home/member/ApplyToOpportunityScreen.js](/frontend/screens/home/member/ApplyToOpportunityScreen.js) | JavaScript | 660 | 7 | 34 | 701 |
| [frontend/screens/home/member/OpportunityViewScreen.js](/frontend/screens/home/member/OpportunityViewScreen.js) | JavaScript | 702 | 1 | 24 | 727 |
| [frontend/screens/messages/ChatScreen.js](/frontend/screens/messages/ChatScreen.js) | JavaScript | 226 | 30 | 17 | 273 |
| [frontend/screens/profile/UniversalFollowersScreen.js](/frontend/screens/profile/UniversalFollowersScreen.js) | JavaScript | 157 | 9 | 20 | 186 |
| [frontend/screens/profile/UniversalFollowingScreen.js](/frontend/screens/profile/UniversalFollowingScreen.js) | JavaScript | 153 | 12 | 22 | 187 |
| [frontend/screens/profile/community/CommunityFollowersListScreen.js](/frontend/screens/profile/community/CommunityFollowersListScreen.js) | JavaScript | -88 | -1 | -8 | -97 |
| [frontend/screens/profile/community/CommunityFollowingListScreen.js](/frontend/screens/profile/community/CommunityFollowingListScreen.js) | JavaScript | -88 | -1 | -8 | -97 |
| [frontend/screens/profile/community/CommunityProfileScreen.js](/frontend/screens/profile/community/CommunityProfileScreen.js) | JavaScript | 198 | 28 | 15 | 241 |
| [frontend/screens/profile/community/CommunityPublicProfileScreen.js](/frontend/screens/profile/community/CommunityPublicProfileScreen.js) | JavaScript | 152 | 3 | 6 | 161 |
| [frontend/screens/profile/community/EditCommunityProfileConstants.js](/frontend/screens/profile/community/EditCommunityProfileConstants.js) | JavaScript | 117 | 2 | 8 | 127 |
| [frontend/screens/profile/community/EditCommunityProfileScreen.js](/frontend/screens/profile/community/EditCommunityProfileScreen.js) | JavaScript | 332 | 5 | 14 | 351 |
| [frontend/screens/profile/member/EditProfileConstants.js](/frontend/screens/profile/member/EditProfileConstants.js) | JavaScript | 192 | 3 | 7 | 202 |
| [frontend/screens/profile/member/EditProfileScreen.js](/frontend/screens/profile/member/EditProfileScreen.js) | JavaScript | 473 | 14 | 34 | 521 |
| [frontend/screens/profile/member/FollowersListScreen.js](/frontend/screens/profile/member/FollowersListScreen.js) | JavaScript | -109 | -6 | -8 | -123 |
| [frontend/screens/profile/member/FollowingListScreen.js](/frontend/screens/profile/member/FollowingListScreen.js) | JavaScript | -76 | -1 | -8 | -85 |
| [frontend/screens/profile/member/MemberProfileScreen.js](/frontend/screens/profile/member/MemberProfileScreen.js) | JavaScript | -159 | 2 | -3 | -160 |
| [frontend/screens/profile/member/MemberPublicProfileScreen.js](/frontend/screens/profile/member/MemberPublicProfileScreen.js) | JavaScript | -350 | 1 | -13 | -362 |
| [frontend/screens/profile/sponsor/SponsorProfileScreen.js](/frontend/screens/profile/sponsor/SponsorProfileScreen.js) | JavaScript | 8 | 0 | 1 | 9 |
| [frontend/screens/profile/venue/VenueProfileScreen.js](/frontend/screens/profile/venue/VenueProfileScreen.js) | JavaScript | 8 | 0 | 1 | 9 |
| [frontend/screens/search/SearchScreen.js](/frontend/screens/search/SearchScreen.js) | JavaScript | 25 | 1 | 0 | 26 |
| [frontend/screens/signup/community/CollegeClubTypeScreen.js](/frontend/screens/signup/community/CollegeClubTypeScreen.js) | JavaScript | 12 | 1 | 1 | 14 |
| [frontend/screens/signup/community/CollegeHeadsScreen.js](/frontend/screens/signup/community/CollegeHeadsScreen.js) | JavaScript | 405 | 25 | 29 | 459 |
| [frontend/screens/signup/community/CollegeSearchScreen.js](/frontend/screens/signup/community/CollegeSearchScreen.js) | JavaScript | 36 | 5 | 4 | 45 |
| [frontend/screens/signup/community/CollegeSubtypeSelectScreen.js](/frontend/screens/signup/community/CollegeSubtypeSelectScreen.js) | JavaScript | 13 | 1 | 1 | 15 |
| [frontend/screens/signup/community/CommunityBioScreen.js](/frontend/screens/signup/community/CommunityBioScreen.js) | JavaScript | 84 | 5 | 3 | 92 |
| [frontend/screens/signup/community/CommunityCategoryScreen.js](/frontend/screens/signup/community/CommunityCategoryScreen.js) | JavaScript | 87 | 3 | 5 | 95 |
| [frontend/screens/signup/community/CommunityEmailScreen.js](/frontend/screens/signup/community/CommunityEmailScreen.js) | JavaScript | -26 | -1 | -3 | -30 |
| [frontend/screens/signup/community/CommunityHeadNameScreen.js](/frontend/screens/signup/community/CommunityHeadNameScreen.js) | JavaScript | 67 | 2 | 4 | 73 |
| [frontend/screens/signup/community/CommunityLocationQuestionScreen.js](/frontend/screens/signup/community/CommunityLocationQuestionScreen.js) | JavaScript | 78 | 3 | 5 | 86 |
| [frontend/screens/signup/community/CommunityLocationScreen.js](/frontend/screens/signup/community/CommunityLocationScreen.js) | JavaScript | 95 | 13 | 7 | 115 |
| [frontend/screens/signup/community/CommunityLogoscreen.js](/frontend/screens/signup/community/CommunityLogoscreen.js) | JavaScript | 68 | 4 | 5 | 77 |
| [frontend/screens/signup/community/CommunityNameScreen.js](/frontend/screens/signup/community/CommunityNameScreen.js) | JavaScript | 54 | 2 | 4 | 60 |
| [frontend/screens/signup/community/CommunityOtpScreen.js](/frontend/screens/signup/community/CommunityOtpScreen.js) | JavaScript | 123 | 14 | 17 | 154 |
| [frontend/screens/signup/community/CommunityPhoneNoScreen.js](/frontend/screens/signup/community/CommunityPhoneNoScreen.js) | JavaScript | 70 | 2 | 4 | 76 |
| [frontend/screens/signup/community/CommunitySignupNavigator.js](/frontend/screens/signup/community/CommunitySignupNavigator.js) | JavaScript | 7 | 0 | 0 | 7 |
| [frontend/screens/signup/community/CommunitySponsorTypeSelect.js](/frontend/screens/signup/community/CommunitySponsorTypeSelect.js) | JavaScript | 24 | 1 | 2 | 27 |
| [frontend/screens/signup/community/CommunityTypeSelectScreen.js](/frontend/screens/signup/community/CommunityTypeSelectScreen.js) | JavaScript | 12 | 1 | 1 | 14 |
| [frontend/screens/signup/community/CommunityUsernameScreen.js](/frontend/screens/signup/community/CommunityUsernameScreen.js) | JavaScript | 14 | 1 | 1 | 16 |
| [frontend/screens/signup/community/IndividualLocationScreen.js](/frontend/screens/signup/community/IndividualLocationScreen.js) | JavaScript | 403 | 14 | 25 | 442 |
| [frontend/screens/signup/community/StudentCommunityThemeScreen.js](/frontend/screens/signup/community/StudentCommunityThemeScreen.js) | JavaScript | 12 | 1 | 1 | 14 |
| [frontend/screens/signup/member/MemberOtpScreen.js](/frontend/screens/signup/member/MemberOtpScreen.js) | JavaScript | 16 | 3 | 3 | 22 |
| [frontend/services/LocationTracker.js](/frontend/services/LocationTracker.js) | JavaScript | 19 | 4 | -1 | 22 |
| [frontend/services/ViewQueueService.js](/frontend/services/ViewQueueService.js) | JavaScript | 143 | 64 | 35 | 242 |
| [frontend/services/postService.js](/frontend/services/postService.js) | JavaScript | 46 | 11 | 11 | 68 |
| [frontend/utils/LikeStateManager.js](/frontend/utils/LikeStateManager.js) | JavaScript | 78 | 25 | 15 | 118 |
| [frontend/utils/accountManager.js](/frontend/utils/accountManager.js) | JavaScript | 20 | 2 | 2 | 24 |
| [frontend/utils/cardTiming.js](/frontend/utils/cardTiming.js) | JavaScript | 96 | 56 | 28 | 180 |
| [frontend/utils/opportunityDraftStorage.js](/frontend/utils/opportunityDraftStorage.js) | JavaScript | 61 | 32 | 15 | 108 |
| [frontend/utils/signupDraftManager.js](/frontend/utils/signupDraftManager.js) | JavaScript | 163 | 53 | 18 | 234 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details