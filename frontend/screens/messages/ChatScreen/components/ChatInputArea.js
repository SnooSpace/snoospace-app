import React from "react";
import { View } from "react-native";
import KeyboardAwareToolbar from "../../../../components/KeyboardAwareToolbar";
import ChatComposer from "../../../../components/ChatComposer";
import TypingIndicator from "./TypingIndicator";
import ClosedGroupBar from "./ClosedGroupBar";
import LockedAnnouncementBar from "./LockedAnnouncementBar";
import { CHAT_CANVAS_BG } from "../ChatScreen.styles";

const ChatInputArea = React.memo(
  ({
    isChatInputFocused,
    setInputHeight,
    typingUsers,
    isGroup,
    groupStatus,
    messagingRestricted,
    myGroupRole,
    composerRef,
    selectedReply,
    onCloseReply,
    replyBarHeightShared,
    onSend,
    onTyping,
    onFocusChange,
    onShowAlert,
    sending,
    uploadingMedia,
    youHaveBlocked,
    isBlockedByOther,
  }) => {
    return (
      <KeyboardAwareToolbar
        enabled={isChatInputFocused}
        style={{ backgroundColor: CHAT_CANVAS_BG }}
      >
        <View
          style={{
            flexDirection: "column",
            backgroundColor: CHAT_CANVAS_BG,
          }}
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout;
            if (height > 0) {
              setInputHeight(height);
            }
          }}
        >
          <TypingIndicator typingUsers={typingUsers} />

          {isGroup && groupStatus === "CLOSED" ? (
            <ClosedGroupBar isGroup={isGroup} groupStatus={groupStatus} />
          ) : isGroup && messagingRestricted && myGroupRole !== "admin" ? (
            <LockedAnnouncementBar
              isGroup={isGroup}
              messagingRestricted={messagingRestricted}
              myGroupRole={myGroupRole}
            />
          ) : (
            <ChatComposer
              ref={composerRef}
              selectedReply={selectedReply}
              onCloseReply={onCloseReply}
              replyBarHeightShared={replyBarHeightShared}
              onSend={onSend}
              onTyping={onTyping}
              onFocusChange={onFocusChange}
              onShowAlert={onShowAlert}
              sending={sending}
              uploadingMedia={uploadingMedia}
              disabled={youHaveBlocked || isBlockedByOther}
            />
          )}
        </View>
      </KeyboardAwareToolbar>
    );
  },
);

export default ChatInputArea;
