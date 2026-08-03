import { useState, useEffect, useCallback } from "react";
import { getSocket } from "../../../../services/socketService";

export default function useChatTyping({ currentConversationId, currentUser }) {
  const [typingUsers, setTypingUsers] = useState({});

  const handleTypingToggle = useCallback(
    (isTyping) => {
      const socket = getSocket();
      if (!socket || !currentConversationId || !currentUser) return;
      if (isTyping) {
        socket.emit("typing_start", {
          chatId: currentConversationId,
          userId: currentUser.id,
          userName: currentUser.name || "Someone",
        });
      } else {
        socket.emit("typing_stop", {
          chatId: currentConversationId,
          userId: currentUser.id,
        });
      }
    },
    [currentConversationId, currentUser],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUserTyping = ({ userId, userName }) => {
      if (currentUser?.id && String(userId) === String(currentUser.id)) return;
      setTypingUsers((prev) => ({ ...prev, [userId]: userName }));
    };

    const handleUserStoppedTyping = ({ userId }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    };

    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    return () => {
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
    };
  }, []);

  return {
    typingUsers,
    handleTypingToggle,
  };
}
