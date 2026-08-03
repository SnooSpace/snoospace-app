import { useState, useRef, useCallback, useEffect } from "react";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { TriangleAlert, PartyPopper } from "lucide-react-native";
import { confirmGiftRSVP } from "../../../../api/events";
import { COLORS } from "../../../../constants/theme";

export default function useMessageInteractions({
  flatListData,
  flashListRef,
  updateMessageById,
  navigationRef,
  showAlert,
  hideAlert,
}) {
  const [rsvpLoading, setRsvpLoading] = useState({});
  const rsvpLoadingRef = useRef({});
  const [optionsTarget, setOptionsTarget] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const [sharedPostModalVisible, setSharedPostModalVisible] = useState(false);
  const [selectedSharedPost, setSelectedSharedPost] = useState(null);
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });

  const messageIndexMapRef = useRef({});
  useEffect(() => {
    const map = {};
    flatListData.forEach((item, idx) => {
      if (item.type === "message") map[item.data.id] = idx;
    });
    messageIndexMapRef.current = map;
  }, [flatListData]);

  const scrollToMessage = useCallback(
    (targetId) => {
      const idx = messageIndexMapRef.current[targetId];
      if (idx == null) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      flashListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
      setHighlightedMessageId(String(targetId));
    },
    [flashListRef],
  );

  const clearHighlight = useCallback(() => {
    setHighlightedMessageId(null);
  }, []);

  const handleLongPress = useCallback((msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOptionsTarget(msg);
  }, []);

  const handleCopyMessage = useCallback(
    async (text) => {
      if (text) {
        await Clipboard.setStringAsync(text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setOptionsTarget(null);
    },
    [],
  );

  const handleRSVP = useCallback(
    async (msg, response) => {
      const giftId = msg.metadata?.giftId;
      if (!giftId) {
        showAlert({
          title: "Error",
          message: "Unable to process RSVP",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
        return;
      }
      const nextLoadingState = { ...rsvpLoadingRef.current, [msg.id]: true };
      rsvpLoadingRef.current = nextLoadingState;
      setRsvpLoading(nextLoadingState);
      try {
        const result = await confirmGiftRSVP(giftId, response);
        if (result.success) {
          updateMessageById(msg.id, {
            metadata: { ...msg.metadata, status: result.status },
          });
          showAlert({
            title: response === "going" ? "You're In! 🎁" : "Maybe Next Time",
            message: result.message,
            primaryAction: { text: "Sweet!", onPress: hideAlert },
            icon: PartyPopper,
            iconColor: COLORS.primary,
          });
        }
      } catch (err) {
        showAlert({
          title: "Error",
          message: err?.message || "Failed to confirm RSVP",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      } finally {
        const doneState = { ...rsvpLoadingRef.current, [msg.id]: false };
        rsvpLoadingRef.current = doneState;
        setRsvpLoading(doneState);
      }
    },
    [updateMessageById, showAlert, hideAlert],
  );

  const handlePressPostShare = useCallback((postId, postData) => {
    if (!postData) return;

    const pType = postData.post_type || postData.type || "media";

    if (pType === "opportunity") {
      const nav = navigationRef.current;
      const n = nav?.getParent()?.getParent() || nav;
      n?.navigate("OpportunityView", {
        opportunityId: postId || postData.id,
        opportunity: postData,
      });
      return;
    }

    setSelectedSharedPost(postData);
    setSharedPostModalVisible(true);
  }, [navigationRef]);

  const handlePressUser = useCallback((userId, userType) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    if (userType === "community") {
      n?.navigate("CommunityPublicProfile", {
        communityId: userId,
        viewerRole: "member",
      });
    } else {
      n?.navigate("MemberPublicProfile", { memberId: userId });
    }
  }, [navigationRef]);

  const handlePressOpportunity = useCallback((opportunityId, metadata) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("OpportunityView", {
      opportunityId,
      opportunity: { id: opportunityId, ...metadata },
    });
  }, [navigationRef]);

  const handlePressEvent = useCallback((eventId) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("EventDetails", { eventId });
  }, [navigationRef]);

  const handlePressPlan = useCallback((planId) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("PlanDetail", { planId });
  }, [navigationRef]);

  return {
    rsvpLoading,
    rsvpLoadingRef,
    optionsTarget,
    setOptionsTarget,
    highlightedMessageId,
    scrollToMessage,
    clearHighlight,
    handleLongPress,
    handleCopyMessage,
    handleRSVP,
    handlePressPostShare,
    handlePressUser,
    handlePressOpportunity,
    handlePressEvent,
    handlePressPlan,
    sharedPostModalVisible,
    setSharedPostModalVisible,
    selectedSharedPost,
    setSelectedSharedPost,
    commentsModalState,
    setCommentsModalState,
  };
}
