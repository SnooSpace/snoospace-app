import React, { useRef, useEffect } from "react";
import { View, Text, Animated as RNAnimated, Easing as RNEasing } from "react-native";
import { typingStyles } from "./TypingIndicator.styles";

export const TypingDots = () => {
  const dot1 = useRef(new RNAnimated.Value(0)).current;
  const dot2 = useRef(new RNAnimated.Value(0)).current;
  const dot3 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot, delay) => {
      return RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(dot, {
            toValue: -4,
            duration: 350,
            easing: RNEasing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot, {
            toValue: 0,
            duration: 350,
            easing: RNEasing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          RNAnimated.delay(300),
        ]),
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 150);
    const anim3 = animateDot(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={typingStyles.dotsContainer}>
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot1 }] }]}
      />
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot2 }] }]}
      />
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot3 }] }]}
      />
    </View>
  );
};

const TypingIndicator = React.memo(({ typingUsers }) => {
  const typingList = Object.values(typingUsers || {}).filter(Boolean);
  if (typingList.length === 0) return null;

  if (typingList.length === 1) {
    return (
      <View style={typingStyles.container}>
        <Text style={typingStyles.text}>
          <Text style={typingStyles.boldText}>{typingList[0]}</Text> is typing
        </Text>
        <TypingDots />
      </View>
    );
  } else if (typingList.length === 2) {
    return (
      <View style={typingStyles.container}>
        <Text style={typingStyles.text}>
          <Text style={typingStyles.boldText}>{typingList[0]}</Text> and{" "}
          <Text style={typingStyles.boldText}>{typingList[1]}</Text> are
          typing
        </Text>
        <TypingDots />
      </View>
    );
  } else {
    return (
      <View style={typingStyles.container}>
        <Text style={typingStyles.text}>Several people are typing</Text>
        <TypingDots />
      </View>
    );
  }
});

export default TypingIndicator;
