import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Path, Line, G, Ellipse } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { COLORS, FONTS } from "../../constants/theme";

export function getEmptyChatCopy({
  isGroup = false,
  currentUserType = "member",
  currentUserIsCreator = false,
  recipientType = "member",
  recipientIsCreator = false,
} = {}) {
  if (isGroup) {
    return {
      title: "Kick things off!",
      subtitle: "Every great group starts with an awkward first text.",
    };
  }

  const isUserCommunity = currentUserType === "community";
  const isRecipientCommunity = recipientType === "community";

  // Community <-> Community
  if (isUserCommunity && isRecipientCommunity) {
    return {
      title: "Start the conversation.",
      subtitle: "Communities talk too — might as well be first.",
    };
  }

  // Community -> Creator
  if (isUserCommunity && recipientIsCreator) {
    return {
      title: "Say hello!",
      subtitle: "Creators love hearing from their community.",
    };
  }

  // Creator -> Community
  if (currentUserIsCreator && isRecipientCommunity) {
    return {
      title: "Drop a message.",
      subtitle: "It's the easiest way to get noticed.",
    };
  }

  // Community <-> Member (Member messaging Community or Community messaging Member)
  if (isUserCommunity || isRecipientCommunity) {
    return {
      title: "Say hi to the community!",
      subtitle: "They won't bite — promise.",
    };
  }

  // Creator <-> Creator
  if (currentUserIsCreator && recipientIsCreator) {
    return {
      title: "Say hello to your fellow creator.",
      subtitle: "Worst case, nothing happens.",
    };
  }

  // Member -> Creator (a member messaging a creator)
  if (!currentUserIsCreator && recipientIsCreator) {
    return {
      title: "Reach out.",
      subtitle: "Most creators love hearing from people who watch.",
    };
  }

  // Creator -> Member (a creator messaging a member)
  if (currentUserIsCreator && !recipientIsCreator) {
    return {
      title: "Break the ice.",
      subtitle: "They'll probably be excited you noticed them.",
    };
  }

  // Member <-> Member (Default)
  return {
    title: "Say hello! It’s not that deep.",
    subtitle: "Worst case, nothing happens.",
  };
}

function EmptyChatState({ title, subtitle }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [translateY]);

  const floatAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const displayTitle = title || "Say hello! It’s not that deep.";
  const displaySubtitle = subtitle || "Worst case, nothing happens.";

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper (100% UI-thread Reanimated worklet) */}
        <Animated.View style={[styles.floatingWrapper, floatAnimatedStyle]}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            {/* Soft Brand Glow */}
            <Circle
              cx="120"
              cy="120"
              r="80"
              fill="#2563EB"
              fillOpacity={0.08}
            />

            {/* Main Chat Bubble (The Base) */}
            <Path
              d="M70 70H170V140C170 140 170 155 150 155H90L60 175V70Z"
              fill="white"
              stroke="#0F172A"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Stylized UI Lines inside the bubble */}
            <Line
              x1="90"
              y1="95"
              x2="150"
              y2="95"
              stroke="#F0F9FF"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="95"
              x2="130"
              y2="95"
              stroke="#2563EB"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="120"
              x2="150"
              y2="120"
              stroke="#F0F9FF"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="120"
              x2="140"
              y2="120"
              stroke="#22D3EE"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Floating "New/Fresh" Sparkle */}
            <G transform="translate(175, 65)">
              <Path
                d="M0 -12L3 -3L12 0L3 3L0 12L-3 3L-12 0L-3 -3L0 -12Z"
                fill="#2563EB"
                stroke="#0F172A"
                strokeWidth="2"
              />
            </G>

            {/* Decorative Orbiting Elements */}
            <Circle
              cx="65"
              cy="190"
              r="5"
              fill="#22D3EE"
              stroke="#0F172A"
              strokeWidth="2"
            />
            <Circle
              cx="185"
              cy="160"
              r="8"
              fill="#F0F9FF"
              stroke="#0F172A"
              strokeWidth="2.5"
            />

            {/* Dynamic Typing Indicator Dots */}
            <G>
              <Circle cx="110" cy="185" r="3" fill="#0F172A" />
              <Circle
                cx="120"
                cy="185"
                r="3"
                fill="#0F172A"
                fillOpacity={0.4}
              />
              <Circle
                cx="130"
                cy="185"
                r="3"
                fill="#0F172A"
                fillOpacity={0.2}
              />
            </G>
          </Svg>
        </Animated.View>

        {/* Static shadow on the floor */}
        <View style={styles.shadowContainer}>
          <Svg width="128" height="8" viewBox="0 0 128 8" fill="none">
            <Ellipse
              cx="64"
              cy="4"
              rx="64"
              ry="4"
              fill="rgba(30, 58, 138, 0.05)"
            />
          </Svg>
        </View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
      </View>
    </View>
  );
}

export default React.memo(EmptyChatState);

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  illustrationContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginBottom: 20,
  },
  floatingWrapper: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
});
