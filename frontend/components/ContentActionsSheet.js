/**
 * ContentActionsSheet
 *
 * A lightweight two-step menu:
 *   1. The ⋯ button renders inline — pass `onOpen` to trigger.
 *   2. Tapping ⋯ shows a bottom-sheet with a "Report [label]" row.
 *   3. Tapping "Report" closes the menu and opens the full ReportSheet.
 *
 * Usage:
 *   <ContentActionsSheet
 *     type="post"           // 'post' | 'open_plan' | 'event' | 'member'
 *     targetId={post.id}
 *     targetName={post.author_name}
 *     label="Post"          // shown in sheet: "Report Post"
 *   />
 *
 * The component renders the ⋯ button + all modals together. Just drop it
 * in the author row of any card.
 */

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from "react-native";
import { MoreHorizontal, Flag, X } from "lucide-react-native";
import ReportSheet from "./ReportSheet";
import { FONTS, COLORS } from "../constants/theme";

const { height: SCREEN_H } = Dimensions.get("window");

export default function ContentActionsSheet({
  type,
  targetId,
  targetName,
  label,           // e.g. "Poll", "Post", "Event", "Open Plan"
  iconColor = "#94A3B8",
  iconSize = 20,
  hitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeMenu = (callback) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      slideAnim.setValue(SCREEN_H);
      overlayOpacity.setValue(0);
      if (callback) callback();
    });
  };

  const handleReportPress = () => {
    closeMenu(() => setReportVisible(true));
  };

  return (
    <>
      {/* ⋯ Trigger Button */}
      <TouchableOpacity
        onPress={openMenu}
        hitSlop={hitSlop}
        activeOpacity={0.7}
      >
        <MoreHorizontal size={iconSize} color={iconColor} strokeWidth={2} />
      </TouchableOpacity>

      {/* Action Sheet Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeMenu()}
        statusBarTranslucent
      >
        {/* Dimmed overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => closeMenu()} />
        </Animated.View>

        {/* Sliding Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Sheet Title */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Options</Text>
            <TouchableOpacity onPress={() => closeMenu()} hitSlop={8}>
              <X size={18} color="#94A3B8" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Report Row */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleReportPress}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconBox}>
              <Flag size={18} color="#EF4444" strokeWidth={2} />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>
                Report {label || type}
              </Text>
              <Text style={styles.actionSub}>
                Help us keep SnooSpace safe
              </Text>
            </View>
          </TouchableOpacity>

          {/* Bottom safe-area spacer */}
          <View style={styles.bottomSpacer} />
        </Animated.View>
      </Modal>

      {/* Full Report Sheet (step 2) */}
      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        type={type}
        targetId={targetId}
        targetName={targetName}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#1E293B",
    letterSpacing: 0.1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#EF4444",
    lineHeight: 20,
  },
  actionSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  bottomSpacer: {
    height: 28,
  },
});
