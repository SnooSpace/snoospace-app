import { useState, useEffect, useRef } from "react";
import { getGroupParticipants } from "../../../../api/messages";

export default function useGroupMessaging({
  isGroup,
  currentConversationId,
  initialMessagingRestricted = false,
  initialMyGroupRole = null,
}) {
  const [groupStatus, setGroupStatus] = useState("ACTIVE");
  const [messagingRestricted, setMessagingRestricted] = useState(
    initialMessagingRestricted,
  );
  const [myGroupRole, setMyGroupRole] = useState(initialMyGroupRole);
  const groupParticipantsRef = useRef([]);

  useEffect(() => {
    if (!isGroup || !currentConversationId) return;
    (async () => {
      try {
        const gpRes = await getGroupParticipants(currentConversationId);
        setMessagingRestricted(gpRes.messagingRestricted || false);
        if (gpRes._myRole) setMyGroupRole(gpRes._myRole);
        if (gpRes.participants)
          groupParticipantsRef.current = gpRes.participants;
      } catch {
        /* non-fatal */
      }
    })();
  }, [isGroup, currentConversationId]);

  return {
    groupStatus,
    setGroupStatus,
    messagingRestricted,
    setMessagingRestricted,
    myGroupRole,
    setMyGroupRole,
    groupParticipantsRef,
  };
}
