import React from "react";
import { View, Text } from "react-native";
import { LockKeyhole, Megaphone } from "lucide-react-native";
import { mainStyles, ACCENT } from "../ChatScreen.styles";

const LockedAnnouncementBar = React.memo(({ isGroup, messagingRestricted, myGroupRole }) => {
  if (!isGroup || !messagingRestricted || myGroupRole === "admin") return null;

  return (
    <View style={mainStyles.lockedBar}>
      <View style={mainStyles.lockedBarIcon}>
        <LockKeyhole size={16} color={ACCENT} strokeWidth={2} />
      </View>
      <Text style={mainStyles.lockedBarText}>
        Only admins can send messages
      </Text>
      <View style={mainStyles.lockedBarBadge}>
        <Megaphone
          size={12}
          color="#8FA1B8"
          strokeWidth={2}
          style={{ marginRight: 4 }}
        />
        <Text style={mainStyles.lockedBarBadgeText}>Announcement</Text>
      </View>
    </View>
  );
});

export default LockedAnnouncementBar;
