import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, TouchableOpacity, Modal, TextInput, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Reply, Copy, Trash2, Bell, BellOff, Flag, ShieldOff, UserX, ArrowLeft } from "lucide-react-native";

import SwipeableModal from "../../../../components/modals/SwipeableModal";
import ProfilePostFeed from "../../../../components/profile/ProfilePostFeed";
import CommentsModal from "../../../../components/modals/CommentsModal";
import MediaViewerTimeline from "../../../../components/media/MediaViewerTimeline";
import CustomAlertModal from "../../../../components/ui/CustomAlertModal";

import { optionsStyles } from "./MessageOptionsModal.styles";
import { actionSheetStyles, REPORT_REASONS } from "./ChatActionsSheet.styles";

export const MessageOptionsModal = ({
  visible,
  isMyMessage,
  optionsTarget,
  onReply,
  onCopy,
  onUnsend,
  onCancel,
}) => {
  if (!visible) return null;
  const isTextMessage =
    !!optionsTarget?.messageText &&
    !optionsTarget?.isDeleted &&
    (!optionsTarget?.messageType || optionsTarget?.messageType === "text");

  return (
    <View
      style={[
        optionsStyles.overlay,
        { alignItems: isMyMessage ? "flex-end" : "flex-start" },
      ]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={optionsStyles.menu}>
        <TouchableOpacity style={optionsStyles.option} onPress={onReply}>
          <View
            style={[
              optionsStyles.iconBox,
              { backgroundColor: "rgba(53, 101, 242, 0.12)" },
            ]}
          >
            <Reply size={18} color="#3565F2" strokeWidth={2.5} />
          </View>
          <Text style={optionsStyles.optionText}>Reply</Text>
        </TouchableOpacity>

        {isTextMessage && (
          <TouchableOpacity style={optionsStyles.option} onPress={onCopy}>
            <View
              style={[
                optionsStyles.iconBox,
                { backgroundColor: "rgba(53, 101, 242, 0.12)" },
              ]}
            >
              <Copy size={18} color="#3565F2" strokeWidth={2.5} />
            </View>
            <Text style={optionsStyles.optionText}>Copy</Text>
          </TouchableOpacity>
        )}

        {isMyMessage && (
          <TouchableOpacity style={optionsStyles.option} onPress={onUnsend}>
            <View
              style={[
                optionsStyles.iconBox,
                { backgroundColor: "rgba(229, 57, 53, 0.12)" },
              ]}
            >
              <Trash2 size={18} color="#E53935" strokeWidth={2.5} />
            </View>
            <Text style={[optionsStyles.optionText, { color: "#E53935" }]}>
              Unsend
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const ChatActionsSheet = ({
  visible,
  onClose,
  onDeleteChat,
  onReport,
  onMute,
  isMuted,
  onBlock,
  onUnblock,
  youHaveBlocked,
  isGroup,
}) => {
  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={actionSheetStyles.sheet}
    >
      <View style={actionSheetStyles.handle} />

      <TouchableOpacity
        style={actionSheetStyles.row}
        onPress={onMute}
        activeOpacity={0.7}
      >
        <View
          style={[
            actionSheetStyles.iconBox,
            {
              backgroundColor: isMuted
                ? "rgba(52,199,89,0.1)"
                : "rgba(255,159,10,0.1)",
            },
          ]}
        >
          {isMuted ? (
            <Bell size={20} color="#34C759" strokeWidth={2.5} />
          ) : (
            <BellOff size={20} color="#FF9F0A" strokeWidth={2.5} />
          )}
        </View>
        <View style={actionSheetStyles.rowText}>
          <Text style={actionSheetStyles.rowLabel}>
            {isMuted ? "Unmute Chat" : "Mute Chat"}
          </Text>
          <Text style={actionSheetStyles.rowSub}>
            {isMuted
              ? "Turn notifications back on"
              : "Silence notifications for this chat"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={actionSheetStyles.divider} />

      <TouchableOpacity
        style={actionSheetStyles.row}
        onPress={onDeleteChat}
        activeOpacity={0.7}
      >
        <View
          style={[
            actionSheetStyles.iconBox,
            { backgroundColor: "rgba(229, 57, 53, 0.1)" },
          ]}
        >
          <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
        </View>
        <View style={actionSheetStyles.rowText}>
          <Text style={actionSheetStyles.rowLabel}>Delete Chat</Text>
          <Text style={actionSheetStyles.rowSub}>
            Removes this chat from your inbox only
          </Text>
        </View>
      </TouchableOpacity>

      <View style={actionSheetStyles.divider} />

      <TouchableOpacity
        style={actionSheetStyles.row}
        onPress={onReport}
        activeOpacity={0.7}
      >
        <View
          style={[
            actionSheetStyles.iconBox,
            { backgroundColor: "rgba(255, 152, 0, 0.1)" },
          ]}
        >
          <Flag size={20} color="#FF9800" strokeWidth={2.5} />
        </View>
        <View style={actionSheetStyles.rowText}>
          <Text style={actionSheetStyles.rowLabel}>Report Chat</Text>
          <Text style={actionSheetStyles.rowSub}>
            Report abusive or harmful content
          </Text>
        </View>
      </TouchableOpacity>

      {!isGroup && (
        <>
          <View style={actionSheetStyles.divider} />
          <TouchableOpacity
            style={actionSheetStyles.row}
            onPress={youHaveBlocked ? onUnblock : onBlock}
            activeOpacity={0.7}
          >
            <View
              style={[
                actionSheetStyles.iconBox,
                {
                  backgroundColor: youHaveBlocked
                    ? "rgba(53, 101, 242, 0.08)"
                    : "rgba(229, 57, 53, 0.08)",
                },
              ]}
            >
              {youHaveBlocked ? (
                <ShieldOff size={20} color="#3565F2" strokeWidth={2.5} />
              ) : (
                <UserX size={20} color="#E53935" strokeWidth={2.5} />
              )}
            </View>
            <View style={actionSheetStyles.rowText}>
              <Text
                style={[
                  actionSheetStyles.rowLabel,
                  youHaveBlocked && { color: "#3565F2" },
                  !youHaveBlocked && { color: "#E53935" },
                ]}
              >
                {youHaveBlocked ? "Unblock User" : "Block User"}
              </Text>
              <Text style={actionSheetStyles.rowSub}>
                {youHaveBlocked
                  ? "Remove block and restore access"
                  : "They won't be able to message or find you"}
              </Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </SwipeableModal>
  );
};

export const ReportReasonSheet = ({ visible, onClose, onSelect }) => {
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState("");
  const otherInputRef = useRef(null);

  const slideVal = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setOtherMode(false);
      setOtherText("");
      slideVal.value = 0;
      slideVal.value = withSpring(1, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [visible]);

  useEffect(() => {
    if (otherMode) {
      slideVal.value = 0;
      slideVal.value = withSpring(1, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [otherMode]);

  const animatedSheetStyle = useAnimatedStyle(() => {
    const translateY = (1 - slideVal.value) * 300;
    return {
      transform: [{ translateY }],
    };
  });

  if (otherMode) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          style={{ flex: 1 }}
        >
          <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
            <Animated.View
              style={[
                actionSheetStyles.sheet,
                animatedSheetStyle,
                { paddingBottom: 24 },
              ]}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{ width: "100%" }}
              >
                <View style={actionSheetStyles.handle} />

                <TouchableOpacity
                  onPress={() => {
                    setOtherMode(false);
                    setOtherText("");
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={18} color="#8FA1B8" strokeWidth={2} />
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 13,
                      color: "#8FA1B8",
                      marginLeft: 6,
                    }}
                  >
                    Back
                  </Text>
                </TouchableOpacity>

                <Text
                  style={{
                    fontFamily: "BasicCommercial-Bold",
                    fontSize: 18,
                    color: "#1F3A5F",
                    marginBottom: 6,
                  }}
                >
                  Tell us more
                </Text>
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 13,
                    color: "#8FA1B8",
                    marginBottom: 16,
                  }}
                >
                  Please describe what happened so we can review it properly.
                </Text>

                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#E5E5EA",
                    borderRadius: 14,
                    backgroundColor: "#F8F9FB",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: 4,
                    minHeight: 90,
                  }}
                >
                  <TextInput
                    ref={otherInputRef}
                    value={otherText}
                    onChangeText={setOtherText}
                    placeholder="Describe the issue…"
                    placeholderTextColor="#B0BEC5"
                    multiline
                    maxLength={500}
                    autoFocus
                    style={{
                      fontFamily: "Manrope-Regular",
                      fontSize: 14.5,
                      color: "#1F3A5F",
                      textAlignVertical: "top",
                      minHeight: 70,
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 11,
                    color: "#B0BEC5",
                    alignSelf: "flex-end",
                    marginBottom: 14,
                  }}
                >
                  {otherText.length} / 500
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    const trimmed = otherText.trim();
                    if (!trimmed) return;
                    onSelect({
                      key: "other",
                      label: "Other",
                      details: trimmed,
                    });
                  }}
                  activeOpacity={otherText.trim().length > 0 ? 0.7 : 1}
                  style={{
                    backgroundColor:
                      otherText.trim().length > 0 ? "#1F3A5F" : "#E0E0E0",
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-SemiBold",
                      fontSize: 15,
                      color: "#FFFFFF",
                    }}
                  >
                    Submit Report
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardStickyView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
        <Animated.View style={[actionSheetStyles.sheet, animatedSheetStyle]}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%" }}
          >
            <View style={actionSheetStyles.handle} />
            <Text
              style={{
                fontFamily: "BasicCommercial-Bold",
                fontSize: 18,
                color: "#1F3A5F",
                marginBottom: 16,
              }}
            >
              Why are you reporting?
            </Text>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[actionSheetStyles.row, { paddingVertical: 12 }]}
                onPress={() => {
                  if (r.key === "other") {
                    setOtherMode(true);
                  } else {
                    onSelect(r);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 15,
                    color: "#1F3A5F",
                    flex: 1,
                  }}
                >
                  {r.label}
                </Text>
                {r.key === "other" && (
                  <ArrowLeft
                    size={16}
                    color="#B0BEC5"
                    strokeWidth={2}
                    style={{ transform: [{ rotate: "180deg" }] }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const ChatModals = React.memo(
  ({
    optionsTarget,
    isGroup,
    currentUser,
    recipient,
    recipientId,
    onReply,
    onCopy,
    onUnsend,
    onCancelOptions,
    chatActionsVisible,
    onCloseChatActions,
    onDeleteChat,
    onReport,
    onMute,
    isMuted,
    onBlock,
    onUnblock,
    youHaveBlocked,
    reportSheetVisible,
    onCloseReportSheet,
    onSelectReportReason,
    sharedPostModalVisible,
    selectedSharedPost,
    onCloseSharedPostModal,
    onLikeUpdate,
    onComment,
    navigation,
    commentsModalState,
    onCloseCommentsModal,
    viewerVisible,
    mediaTimeline,
    viewerIndex,
    onCloseViewer,
    onReplyViewer,
    alertConfig,
    hideAlert,
    composerRef,
    setSelectedReply,
  }) => {
    return (
      <>
        {!!optionsTarget && (
          <MessageOptionsModal
            visible={!!optionsTarget}
            optionsTarget={optionsTarget}
            isMyMessage={
              isGroup
                ? String(optionsTarget?.senderId) ===
                    String(currentUser?.id) &&
                  (optionsTarget?.senderType || "member") ===
                    (currentUser?.type || "member")
                : optionsTarget?.senderId !== (recipient?.id || recipientId)
            }
            onReply={() => {
              const isOwnMsg = isGroup
                ? String(optionsTarget?.senderId) ===
                    String(currentUser?.id) &&
                  (optionsTarget?.senderType || "member") ===
                    (currentUser?.type || "member")
                : optionsTarget?.senderId !== (recipient?.id || recipientId);
              onReply({
                id: optionsTarget.id,
                messageText: optionsTarget.messageText,
                senderName: isOwnMsg
                  ? "You"
                  : optionsTarget.senderName || recipient?.name,
                isDeleted: optionsTarget.isDeleted,
              });
              onCancelOptions();
              setTimeout(() => composerRef.current?.focus(), 100);
            }}
            onCopy={() => onCopy(optionsTarget?.messageText)}
            onUnsend={() => {
              onUnsend(optionsTarget.id);
              onCancelOptions();
            }}
            onCancel={onCancelOptions}
          />
        )}

        {chatActionsVisible && (
          <ChatActionsSheet
            visible={chatActionsVisible}
            onClose={onCloseChatActions}
            onDeleteChat={onDeleteChat}
            onReport={onReport}
            onMute={onMute}
            isMuted={isMuted}
            onBlock={onBlock}
            onUnblock={onUnblock}
            youHaveBlocked={youHaveBlocked}
            isGroup={isGroup}
          />
        )}

        {reportSheetVisible && (
          <ReportReasonSheet
            visible={reportSheetVisible}
            onClose={onCloseReportSheet}
            onSelect={onSelectReportReason}
          />
        )}

        {sharedPostModalVisible && selectedSharedPost && (
          <ProfilePostFeed
            visible={sharedPostModalVisible}
            posts={[selectedSharedPost]}
            initialPostId={selectedSharedPost.id}
            onClose={onCloseSharedPostModal}
            currentUserId={currentUser?.id}
            currentUserType={currentUser?.type || "member"}
            onLikeUpdate={onLikeUpdate}
            onComment={onComment}
            navigation={navigation}
          />
        )}

        {commentsModalState.visible && (
          <CommentsModal
            visible={commentsModalState.visible}
            postId={commentsModalState.postId}
            postType={commentsModalState.postType}
            onClose={onCloseCommentsModal}
          />
        )}

        {viewerVisible && (
          <MediaViewerTimeline
            timeline={mediaTimeline}
            initialIndex={viewerIndex}
            visible={viewerVisible}
            onClose={onCloseViewer}
            onReply={onReplyViewer}
          />
        )}

        {alertConfig.visible && (
          <CustomAlertModal onClose={hideAlert} {...alertConfig} />
        )}
      </>
    );
  },
);

export default ChatModals;
