import React from "react";
import { View, Text, TouchableOpacity, Keyboard } from "react-native";
import { Image } from "expo-image";
import { ArrowLeft, MoreVertical, UserX } from "lucide-react-native";
import { chatHeaderStyles } from "./ChatHeader.styles";

const ChatHeader = React.memo(
  ({
    navigation,
    isGroup,
    groupName,
    currentConversationId,
    recipient,
    recipientId,
    currentRecipientId,
    currentRecipientType,
    isBlockedByOther,
    onPressMore,
  }) => {
    return (
      <View style={chatHeaderStyles.header}>
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            navigation.goBack();
          }}
          style={chatHeaderStyles.backButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
        </TouchableOpacity>

        {isGroup ? (
          <>
            <TouchableOpacity
              style={[
                chatHeaderStyles.headerInfo,
                {
                  flexDirection: "column",
                  alignItems: "flex-start",
                },
              ]}
              onPress={() =>
                navigation.navigate("GroupInfo", {
                  conversationId: currentConversationId,
                  groupName,
                })
              }
              activeOpacity={0.7}
            >
              <Text style={chatHeaderStyles.headerName} numberOfLines={1}>
                {groupName || "Group"}
              </Text>
              <Text style={chatHeaderStyles.headerUsername}>
                Tap to view info
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={{ padding: 8 }} onPress={onPressMore}>
              <MoreVertical size={22} color="#8FA1B8" strokeWidth={2} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {recipient && (
              <TouchableOpacity
                style={chatHeaderStyles.headerInfo}
                activeOpacity={0.7}
                onPress={() => {
                  if (isBlockedByOther) return;
                  const nav = navigation.getParent()?.getParent() || navigation;
                  if (currentRecipientType === "community") {
                    nav.navigate("CommunityPublicProfile", {
                      communityId: currentRecipientId || recipientId,
                      viewerRole: "member",
                    });
                  } else {
                    nav.navigate("MemberPublicProfile", {
                      memberId: currentRecipientId || recipientId,
                    });
                  }
                }}
              >
                {isBlockedByOther ? (
                  <View
                    style={[
                      chatHeaderStyles.headerAvatar,
                      {
                        backgroundColor: "#EFEFF4",
                        alignItems: "center",
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <UserX size={18} color="#8E8E93" strokeWidth={1.5} />
                  </View>
                ) : (
                  <Image
                    source={{ uri: recipient.profilePhotoUrl }}
                    style={chatHeaderStyles.headerAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={String(recipientId)}
                  />
                )}
                <View>
                  <Text style={chatHeaderStyles.headerName} numberOfLines={1}>
                    {isBlockedByOther
                      ? "Snoospace User"
                      : recipient.name || "User"}
                  </Text>
                  {!isBlockedByOther && (
                    <Text
                      style={chatHeaderStyles.headerUsername}
                      numberOfLines={1}
                    >
                      @{recipient.username || "user"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={{ padding: 8 }} onPress={onPressMore}>
              <MoreVertical size={22} color="#8FA1B8" strokeWidth={2} />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  },
);

export default ChatHeader;
