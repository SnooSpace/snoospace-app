import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ShieldOff } from "lucide-react-native";
import { blockBannerStyles } from "./BlockBanner.styles";

const BlockBanner = React.memo(({ youHaveBlocked, onUnblock, unblocking }) => {
  if (!youHaveBlocked) return null;

  return (
    <View style={blockBannerStyles.banner}>
      <View style={blockBannerStyles.left}>
        <ShieldOff
          size={18}
          color="#E11D48"
          strokeWidth={2}
          style={{ marginRight: 8 }}
        />
        <Text style={blockBannerStyles.text}>You've blocked this user</Text>
      </View>
      <TouchableOpacity
        style={blockBannerStyles.btn}
        onPress={onUnblock}
        disabled={unblocking}
        activeOpacity={0.75}
      >
        <Text style={blockBannerStyles.btnText}>
          {unblocking ? "Unblocking…" : "Unblock"}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default BlockBanner;
