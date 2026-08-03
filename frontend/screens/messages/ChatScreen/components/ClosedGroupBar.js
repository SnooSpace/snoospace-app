import React from "react";
import { View, Text } from "react-native";
import { LockKeyhole } from "lucide-react-native";
import { mainStyles } from "../ChatScreen.styles";

const ClosedGroupBar = React.memo(({ isGroup, groupStatus }) => {
  if (!isGroup || groupStatus !== "CLOSED") return null;

  return (
    <View style={mainStyles.closedBar}>
      <View style={mainStyles.closedBarHeader}>
        <LockKeyhole
          size={18}
          color="#FF3B30"
          strokeWidth={2.2}
          style={{ marginRight: 8 }}
        />
        <Text style={mainStyles.closedBarTitle}>
          This group has been closed
        </Text>
      </View>
      <Text style={mainStyles.closedBarSubtext}>
        Past conversations remain available, but new messages cannot
        be sent.
      </Text>
    </View>
  );
});

export default ClosedGroupBar;
