import { useState, useEffect, useRef } from "react";
import { Keyboard, InteractionManager } from "react-native";
import { TriangleAlert } from "lucide-react-native";

import { getActiveAccount } from "../../../../api/auth";
import { getMessages, resolveConversation, getGroupParticipants } from "../../../../api/messages";
import { getPublicMemberProfile } from "../../../../api/members";
import { getPublicCommunity } from "../../../../api/communities";
import { getPostById } from "../../../../api/posts";
import EventBus from "../../../../utils/EventBus";
import { NotificationConsumptionService } from "../../../../services/NotificationConsumptionService";
import { getCachedConversation, setCachedConversation } from "../../../../services/conversationCache";

const INITIAL_MESSAGES_LIMIT = 30;

export default function useChatInitialization({
  conversationId,
  recipientId,
  recipientType = "member",
  isGroup = false,
  tappedAt,
  navigation,
  loadInitial,
  addNewMessages,
  bootstrapPaginationState,
  setGroupStatus,
  recipient,
  setRecipient,
  setCurrentConversationId,
  setCurrentRecipientId,
  setCurrentRecipientType,
  setYouHaveBlocked,
  setLoading,
  showAlert,
  hideAlert,
  runInitialCorrectionAndRevealRef,
  isLoadingRef,
  sharedPostModalVisible,
  selectedSharedPost,
  setSelectedSharedPost,
  setMessagingRestricted,
  setMyGroupRole,
}) {
  const [currentUser, setCurrentUser] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(() => {
    if (conversationId) {
      const cached = getCachedConversation(conversationId);
      return !cached || cached.messages.length === 0;
    }
    return !recipientId;
  });

  const t0Ref = useRef(
    global.performance ? global.performance.now() : Date.now(),
  );
  const firstRenderRef = useRef(true);

  useEffect(() => {
    getActiveAccount().then((acc) => {
      if (acc) {
        setCurrentUser({
          id: acc.id,
          type: acc.type || "member",
          name: acc.name,
          username: acc.username,
          avatarUri: acc.profilePicture || acc.profile_picture || null,
        });
      }
    });
  }, []);

  useEffect(() => {
    const unsubStart = navigation.addListener("transitionStart", () => {});
    const unsubEnd = navigation.addListener("transitionEnd", () => {});
    return () => {
      unsubStart();
      unsubEnd();
    };
  }, [navigation]);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      Keyboard.dismiss();
    });
    const unsubscribeRemove = navigation.addListener("beforeRemove", () => {
      Keyboard.dismiss();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeRemove();
      Keyboard.dismiss();
    };
  }, [navigation]);

  useEffect(() => {
    const init = async () => {
      if (conversationId) {
        const cached = getCachedConversation(conversationId);
        const RECONCILE_SKIP_WINDOW_MS = 60_000;
        const cacheAgeMs = cached ? Date.now() - cached.cachedAt : Infinity;
        const skipReconcile = cached && cacheAgeMs < RECONCILE_SKIP_WINDOW_MS;
        if (cached && cached.messages.length > 0) {
          addNewMessages(cached.messages);
          setMessagesLoading(false);
        } else {
          setMessagesLoading(true);
        }

        setCurrentConversationId(conversationId);
        try {
          let freshMsgs = [];
          let hasOlderMessages = false;

          if (cached && cached.messages.length > 0) {
            if (skipReconcile) {
              hasOlderMessages = cached.hasMore ?? false;
              bootstrapPaginationState({
                conversationId,
                cursor:
                  cached.messages.length > 0
                    ? cached.messages[0].createdAt
                    : null,
                hasMore: hasOlderMessages,
                newestAt:
                  cached.messages.length > 0
                    ? cached.messages[cached.messages.length - 1].createdAt
                    : null,
              });
            } else {
              const newestCachedAt =
                cached.messages.length > 0
                  ? cached.messages[cached.messages.length - 1].createdAt
                  : null;
              const isDeltaReconcile = Boolean(newestCachedAt);
              const reconcileParams = isDeltaReconcile
                ? { after: newestCachedAt }
                : { limit: 20 };
              const reconcileRes = await getMessages(
                conversationId,
                reconcileParams,
              );
              freshMsgs = reconcileRes?.messages || [];

              if (isDeltaReconcile) {
                hasOlderMessages = cached.hasMore ?? false;
              } else {
                hasOlderMessages = reconcileRes?.hasMore ?? false;
              }

              if (reconcileRes?.status) setGroupStatus(reconcileRes.status);
              bootstrapPaginationState({
                conversationId,
                cursor:
                  cached.messages.length > 0
                    ? cached.messages[0].createdAt
                    : null,
                hasMore: hasOlderMessages,
                newestAt:
                  freshMsgs.length > 0
                    ? freshMsgs[freshMsgs.length - 1].createdAt
                    : newestCachedAt,
              });
            }
          } else {
            const loadRes = await loadInitial(
              conversationId,
              INITIAL_MESSAGES_LIMIT,
            );
            if (loadRes?.status) setGroupStatus(loadRes.status);
            freshMsgs = loadRes?.messages || [];
            hasOlderMessages = loadRes?.hasMore ?? false;
          }

          if (freshMsgs.length > 0) {
            addNewMessages(freshMsgs);
          }
          if (freshMsgs.length > 0 || !cached) {
            const messagesForCache = cached
              ? [...(cached.messages || []), ...freshMsgs]
              : freshMsgs;
            setCachedConversation(conversationId, {
              messages: messagesForCache,
              hasMore: hasOlderMessages,
            });
          }

          EventBus.emit("messages-read");
          NotificationConsumptionService.consumeChat(conversationId).catch(
            console.error,
          );
          if (isGroup) {
            try {
              const gpRes = await getGroupParticipants(conversationId);
              setMessagingRestricted(gpRes.messagingRestricted || false);
              if (gpRes._myRole) setMyGroupRole(gpRes._myRole);
            } catch {
              /* non-fatal */
            }
          }
        } catch (err) {
          console.error("Background fetch failed:", err);
          if (!cached || cached.messages.length === 0) {
            throw err;
          }
        } finally {
          setMessagesLoading(false);
        }
      } else if (recipientId) {
        setMessagesLoading(true);
        const resolvedRes = await resolveConversation(
          recipientId,
          recipientType,
        );

        const resolvedConvId = resolvedRes?.conversationId || null;

        let recipientPromise = Promise.resolve(null);
        if (!recipient) {
          if ((recipientType || "member") === "community") {
            recipientPromise = getPublicCommunity(recipientId).then((p) => ({
              id: p.id,
              name: p.name,
              username: p.username,
              profilePhotoUrl: p.logo_url,
              type: "community",
            }));
          } else {
            recipientPromise = getPublicMemberProfile(recipientId).then(
              (p) => ({
                id: p.id,
                name: p.full_name || p.name,
                username: p.username,
                profilePhotoUrl: p.profile_photo_url,
                you_have_blocked: !!p?.you_have_blocked,
                type: "member",
              }),
            );
          }
        }

        const promises = [recipientPromise];
        let loadInitialIndex = -1;
        if (resolvedConvId) {
          loadInitialIndex = promises.length;
          promises.push(loadInitial(resolvedConvId, INITIAL_MESSAGES_LIMIT));
        }

        const results = await Promise.all(promises);
        const loadRes =
          loadInitialIndex !== -1 ? results[loadInitialIndex] : null;
        if (loadRes?.status) setGroupStatus(loadRes.status);

        const recipientResult = results[0];

        if (recipientResult) {
          setRecipient(recipientResult);
          if (recipientResult.type === "member") {
            setYouHaveBlocked(!!recipientResult.you_have_blocked);
          }
        }

        if (resolvedConvId) {
          setCurrentConversationId(resolvedConvId);
          const freshMsgs = loadRes?.messages || [];
          if (freshMsgs.length > 0) {
            setCachedConversation(resolvedConvId, {
              messages: freshMsgs,
              hasMore: loadRes?.hasMore ?? false,
            });
          }
          EventBus.emit("messages-read");
          NotificationConsumptionService.consumeChat(resolvedConvId).catch(
            console.error,
          );
        } else {
          setCurrentConversationId(null);
        }
        setCurrentRecipientId(recipientId);
        setCurrentRecipientType(recipientType || "member");
      }
    };

    const run = async () => {
      try {
        await init();
      } catch (err) {
        console.error("Error initializing conversation:", err);
        showAlert({
          title: "Error",
          message: err?.message || "Failed to load conversation.",
          primaryAction: {
            text: "OK",
            onPress: () => {
              hideAlert();
              navigation.goBack();
            },
          },
          icon: TriangleAlert,
        });
      } finally {
        setLoading(false);
        setMessagesLoading(false);
      }
    };

    const interaction = InteractionManager.runAfterInteractions(() => {
      run();
    });
    return () => interaction.cancel();
  }, [conversationId, recipientId, recipientType]);

  useEffect(() => {
    const targetPostId =
      selectedSharedPost?.id ||
      selectedSharedPost?.postId ||
      selectedSharedPost?.post_id;
    if (sharedPostModalVisible && targetPostId) {
      let isMounted = true;
      const loadFreshPost = async () => {
        try {
          const response = await getPostById(targetPostId);
          const post = response.post || response;
          if (isMounted && post) {
            setSelectedSharedPost(post);
          }
        } catch (err) {
          console.error("Failed to fetch fresh shared post details:", err);
        }
      };
      loadFreshPost();
      return () => {
        isMounted = false;
      };
    }
  }, [
    sharedPostModalVisible,
    selectedSharedPost?.id,
    selectedSharedPost?.postId,
    selectedSharedPost?.post_id,
  ]);

  return {
    currentUser,
    messagesLoading,
    setMessagesLoading,
    t0Ref,
    firstRenderRef,
  };
}
