import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
  useDerivedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  Circle,
  Rect,
  Path,
  G,
  Polygon,
  Ellipse,
  Line,
  Text as SvgText,
} from "react-native-svg";
import {
  Camera,
  Video as VideoIcon,
  Image as ImageIcon,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const { width } = Dimensions.get("window");

// --- CUSTOM SVG ILLUSTRATIONS ---

const MediaIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="mediaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#4F46E5" />
        <Stop offset="100%" stopColor="#06B6D4" />
      </SvgLinearGradient>
    </Defs>
    
    <Circle cx={100} cy={100} r={80} fill="#D1FAE5" opacity={0.5} />
    
    <G>
      <Rect x={40} y={60} width={120} height={80} rx={15} fill="url(#mediaGrad)" />
      <Rect x={75} y={45} width={50} height={20} rx={6} fill="#4F46E5" />
      
      <Circle cx={100} cy={100} r={30} fill="white" />
      <Circle cx={100} cy={100} r={22} fill="#E2E8F0" />
      <Polygon points="93,88 93,112 113,100" fill="#4F46E5" />
      
      <Circle cx={140} cy={75} r={8} fill="#F59E0B" />
      <Circle cx={140} cy={75} r={12} fill="#F59E0B" opacity={0.3} />
      
      <G transform="translate(140, 110)">
        <Circle cx={15} cy={15} r={18} fill="#059669" stroke="white" strokeWidth={3} />
        <Path d="M7 15 L12 20 L23 9" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
    
    <Circle cx={30} cy={40} r={4} fill="#F59E0B" />
    <Circle cx={170} cy={50} r={5} fill="#06B6D4" />
    <Circle cx={40} cy={160} r={3} fill="#4F46E5" />
  </Svg>
);

const PollsIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="pollGrad1" x1="0%" y1="100%" x2="0%" y2="0%">
        <Stop offset="0%" stopColor="#4F46E5" />
        <Stop offset="100%" stopColor="#06B6D4" />
      </SvgLinearGradient>
      <SvgLinearGradient id="pollGrad2" x1="0%" y1="100%" x2="0%" y2="0%">
        <Stop offset="0%" stopColor="#8B5CF6" />
        <Stop offset="100%" stopColor="#F472B6" />
      </SvgLinearGradient>
    </Defs>

    <Path d="M 30 160 L 170 160" stroke="#CBD5E1" strokeWidth={4} strokeLinecap="round" />
    
    <G>
      <Rect x={45} y={100} width={25} height={55} rx={5} fill="url(#pollGrad1)" opacity={0.6} />
      <Rect x={85} y={60} width={25} height={95} rx={5} fill="url(#pollGrad2)" opacity={0.8} />
      <Rect x={125} y={40} width={25} height={115} rx={5} fill="url(#pollGrad1)" />

      <Path d="M 50 85 L 55 90 L 65 80" fill="none" stroke="#059669" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M 130 20 L 137 27 L 148 15" fill="none" stroke="#059669" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      <G transform="translate(145, 105)">
        <Circle cx={15} cy={15} r={22} fill="white" />
        <Circle cx={15} cy={15} r={18} fill="#10B981" />
        <Path d="M7 15 L12 20 L23 9" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const QnaIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="qBubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#4F46E5" />
        <Stop offset="100%" stopColor="#8B5CF6" />
      </SvgLinearGradient>
      <SvgLinearGradient id="aBubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#06B6D4" />
        <Stop offset="100%" stopColor="#3B82F6" />
      </SvgLinearGradient>
    </Defs>
    
    <G>
      <G transform="translate(30, 40)">
        <Path d="M 20 0 L 70 0 C 81 0 90 9 90 20 L 90 60 C 90 71 81 80 70 80 L 40 80 L 10 105 L 20 80 C 9 80 0 71 0 60 L 0 20 C 0 9 9 0 20 0 Z" fill="url(#qBubbleGrad)" />
        <SvgText x={45} y={55} fontFamily="Arial" fontWeight="900" fontSize={40} fill="white" textAnchor="middle">?</SvgText>
      </G>

      <G transform="translate(80, 80)">
        <Path d="M 20 0 L 70 0 C 81 0 90 9 90 20 L 90 60 C 90 71 81 80 70 80 L 70 105 L 50 80 L 20 80 C 9 80 0 71 0 60 L 0 20 C 0 9 9 0 20 0 Z" fill="url(#aBubbleGrad)" />
        <SvgText x={45} y={55} fontFamily="Arial" fontWeight="900" fontSize={40} fill="white" textAnchor="middle">!</SvgText>
      </G>

      <G transform="translate(145, 125)">
        <Circle cx={18} cy={18} r={22} fill="white" />
        <Circle cx={18} cy={18} r={18} fill="#10B981" />
        <Path d="M9 18 L15 24 L27 12" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const PromptIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="paperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#ffffff" />
        <Stop offset="100%" stopColor="#f1f5f9" />
      </SvgLinearGradient>
      <SvgLinearGradient id="penGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F59E0B" />
        <Stop offset="100%" stopColor="#EA580C" />
      </SvgLinearGradient>
    </Defs>

    <Circle cx={100} cy={100} r={65} fill="#E0E7FF" opacity={0.6} />

    <G>
      <G x={40} y={30} rotation={-5} originX={42.5} originY={55}>
        <Rect x={0} y={0} width={85} height={110} rx={8} fill="url(#paperGrad)" stroke="#E2E8F0" strokeWidth={2} />
        <Rect x={15} y={25} width={55} height={6} rx={3} fill="#CBD5E1" />
        <Rect x={15} y={45} width={40} height={6} rx={3} fill="#CBD5E1" />
        <Rect x={15} y={65} width={50} height={6} rx={3} fill="#CBD5E1" />
        <Rect x={15} y={85} width={30} height={6} rx={3} fill="#CBD5E1" />
      </G>

      <Path d="M 75 105 C 100 130, 130 90, 155 65" fill="none" stroke="#F59E0B" strokeWidth={4} strokeDasharray="10, 5" opacity={0.8} />

      <G x={130} y={35} rotation={-20} originX={2.5} originY={30}>
        <Path d="M 10 -10 L 25 5 L -10 65 L -20 70 L -15 60 Z" fill="url(#penGrad)" />
        <Polygon points="-10,65 -20,70 -15,60" fill="#1E293B" />
        <Path d="M 5 -5 L 20 10" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      </G>

      <G transform="translate(130, 120)">
        <Circle cx={18} cy={18} r={20} fill="white" />
        <Circle cx={18} cy={18} r={16} fill="#10B981" />
        <Path d="M8 18 L14 24 L27 11" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const ChallengeIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="trophyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#FCD34D" />
        <Stop offset="100%" stopColor="#D97706" />
      </SvgLinearGradient>
    </Defs>

    <Ellipse cx={100} cy={165} rx={60} ry={10} fill="#E2E8F0" />

    <G>
      <Path d="M 60 70 C 40 70, 40 100, 65 105" fill="none" stroke="url(#trophyGrad)" strokeWidth={8} strokeLinecap="round" />
      <Path d="M 140 70 C 160 70, 160 100, 135 105" fill="none" stroke="url(#trophyGrad)" strokeWidth={8} strokeLinecap="round" />

      <Path d="M 60 40 L 140 40 L 130 110 C 130 130, 70 130, 70 110 Z" fill="url(#trophyGrad)" />
      <Path d="M 70 50 L 130 50" stroke="#FDE68A" strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      
      <Rect x={90} y={125} width={20} height={25} fill="#B45309" />
      <Path d="M 75 150 L 125 150 L 135 160 L 65 160 Z" fill="#78350F" />

      <Polygon points="100,60 105,75 120,75 108,85 112,100 100,90 88,100 92,85 80,75 95,75" fill="white" opacity={0.8} />

      <G transform="translate(110, 100)">
        <Circle cx={20} cy={20} r={22} fill="#10B981" stroke="white" strokeWidth={4} />
        <Path d="M10 20 L16 26 L30 12" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const OpportunityIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="doorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#06B6D4" />
        <Stop offset="100%" stopColor="#4F46E5" />
      </SvgLinearGradient>
    </Defs>

    <Circle cx={100} cy={100} r={70} fill="#CCFBF1" opacity={0.7} />
    
    <G>
      <Path d="M 60 40 L 140 40 L 140 160 L 60 160 Z" fill="none" stroke="#94A3B8" strokeWidth={6} />
      <Path d="M 60 40 L 100 25 L 100 145 L 60 160 Z" fill="url(#doorGrad)" />
      <Circle cx={90} cy={95} r={4} fill="white" />

      <Polygon points="100,25 150,50 150,150 100,145" fill="#FEF08A" opacity={0.4} />
      <Path d="M 110 70 L 130 50 M 110 100 L 140 90 M 110 130 L 130 130" stroke="#FDE047" strokeWidth={4} strokeLinecap="round" />

      <Path d="M 150 40 L 155 30 L 160 40 L 170 45 L 160 50 L 155 60 L 150 50 L 140 45 Z" fill="#F59E0B" />
      <Path d="M 40 80 L 43 73 L 50 70 L 43 67 L 40 60 L 37 67 L 30 70 L 37 73 Z" fill="#059669" />
      
      <G transform="translate(120, 110)">
        <Circle cx={18} cy={18} r={20} fill="white" />
        <Circle cx={18} cy={18} r={16} fill="#10B981" />
        <Path d="M8 18 L14 24 L27 11" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const EventIllustration = () => (
  <Svg width={140} height={140} viewBox="0 0 200 200">
    <Defs>
      <SvgLinearGradient id="eventGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#F43F5E" />
        <Stop offset="100%" stopColor="#F97316" />
      </SvgLinearGradient>
    </Defs>

    <Circle cx={100} cy={100} r={65} fill="#FFE4E6" opacity={0.6} />

    <G>
      <G x={0} y={5} rotation={-10} originX={100} originY={100}>
        <Path 
          d="M 35 60 L 165 60 L 165 85 C 145 85, 145 115, 165 115 L 165 140 L 35 140 L 35 115 C 55 115, 55 85, 35 85 Z" 
          fill="url(#eventGrad)" 
        />
        <Line x1="125" y1="64" x2="125" y2="136" stroke="white" strokeWidth={3} strokeDasharray="6,5" opacity={0.8} />
        
        <G transform="translate(-10, -5)">
          <Polygon points="90,85 94,95 105,95 96,102 99,112 90,106 81,112 84,102 75,95 86,95" fill="white" />
        </G>
        
        <Rect x="135" y="75" width="5" height="50" rx={2} fill="white" opacity="0.9" />
        <Rect x="144" y="75" width="2" height="50" rx="1" fill="white" opacity="0.9" />
        <Rect x="150" y="75" width="6" height="50" rx={2} fill="white" opacity="0.9" />
      </G>

      <Circle cx={40} cy={50} r={5} fill="#F59E0B" />
      <Rect x={155} y={40} width={8} height={8} rx={2} fill="#F43F5E" rotation={45} originX={159} originY={44} />
      <Circle cx={160} cy={155} r={4} fill="#F97316" />

      <G transform="translate(135, 125)">
        <Circle cx={18} cy={18} r={22} fill="white" />
        <Circle cx={18} cy={18} r={18} fill="#10B981" />
        <Path d="M9 18 L15 24 L27 12" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </G>
  </Svg>
);

const SuccessCard = ({
  visible,
  type = "media", // media | poll | prompt | qna | challenge | opportunity | event
  data: inputData,
  onPrimaryAction, // "View post"
  onSecondaryAction, // "Create another"
}) => {
  const data = inputData || {};

  // Shared Values for Animation
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.2)), // Slight overshoot for "float up" feel
      });
      // Trigger haptic
      HapticsService.triggerNotificationSuccess();
    } else {
      progress.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  // Derived Animations
  const backdropOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [0, 1]),
  );
  const cardTranslateY = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [50, 0]),
  );
  const cardScale = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [0.95, 1]),
  );
  const contentOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0.3, 1], [0, 1]),
  );

  const rBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const rCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
    opacity: progress.value,
  }));

  const rContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Configuration based on type
  const getConfig = () => {
    switch (type) {
      case "media":
        return {
          accent: "#3B82F6",
          title: "Media Posted!",
          subtitle: "Your image or video is live.",
          primaryAction: "View Post",
        };
      case "poll":
        return {
          accent: "#4F46E5",
          title: "Poll Created!",
          subtitle: "Time to gather some opinions.",
          primaryAction: "View Post",
        };
      case "prompt":
        return {
          accent: "#8B5CF6",
          title: "Prompt Published!",
          subtitle: "You've sparked a new conversation.",
          primaryAction: "View Post",
        };
      case "qna":
        return {
          accent: "#14B8A6",
          title: "Q&A Started!",
          subtitle: "Ready for questions and answers.",
          primaryAction: "View Post",
        };
      case "challenge":
        return {
          accent: "#F59E0B",
          title: "Challenge Issued!",
          subtitle: "The gauntlet has been thrown.",
          primaryAction: "View Post",
        };
      case "opportunity":
        return {
          accent: "#06B6D4",
          title: "Opportunity Shared!",
          subtitle: "You've opened a new door for others.",
          primaryAction: "View Post",
        };
      case "event":
        return {
          accent: "#F43F5E",
          title: "Event Scheduled!",
          subtitle: "Your tickets are ready.",
          primaryAction: "View Post",
        };
      default:
        return {
          accent: COLORS.primary,
          title: "Success",
          subtitle: "Action completed successfully.",
          primaryAction: "Done",
        };
    }
  };

  const config = getConfig();
  const displayTitle = data.customTitle || config.title;
  const displaySubtitle = data.customSubtitle || config.subtitle;

  const renderIllustration = () => {
    switch (type) {
      case "media":
        return <MediaIllustration />;
      case "poll":
        return <PollsIllustration />;
      case "qna":
        return <QnaIllustration />;
      case "prompt":
        return <PromptIllustration />;
      case "challenge":
        return <ChallengeIllustration />;
      case "opportunity":
        return <OpportunityIllustration />;
      case "event":
        return <EventIllustration />;
      default:
        return null;
    }
  };

  // Render specific "Extra Touch" content
  const renderExtraTouch = () => {
    switch (type) {
      case "media":
        return data.thumbnail ? (
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: data.thumbnail }} style={styles.thumbnail} />
            <View style={styles.thumbnailIconOverlay}>
              {data.hasVideo ? (
                <VideoIcon size={16} color="#FFF" />
              ) : (
                <Camera size={16} color="#FFF" />
              )}
            </View>
          </View>
        ) : null;

      case "poll":
        return (
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText} numberOfLines={2}>
              "{data.question || "Poll Question"}"
            </Text>
          </View>
        );

      case "prompt":
        return (
          <View style={styles.quoteContainer}>
            <Text
              style={[styles.quoteText, { fontStyle: "italic" }]}
              numberOfLines={2}
            >
              {data.prompt_text || "Prompt text..."}
            </Text>
          </View>
        );

      case "qna":
        return data.allow_anonymous ? (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>Anonymous allowed</Text>
          </View>
        ) : null;

      case "challenge":
        return (
          <View style={styles.chipsRow}>
            {data.challenge_type && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {data.challenge_type === "single"
                    ? "Single Task"
                    : "Multi Task"}
                </Text>
              </View>
            )}
            {data.target_count && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {data.target_count} Submissions
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dimmed Background */}
        <Animated.View style={[StyleSheet.absoluteFill, rBackdropStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
          </BlurView>
        </Animated.View>

        {/* Success Card */}
        <Animated.View style={[styles.card, rCardStyle]}>
          {/* Top Illustration Container */}
          <Animated.View style={[styles.illustrationContainer, rContentStyle]}>
            {renderIllustration()}
          </Animated.View>

          {/* Text Content */}
          <Animated.View style={[styles.textContainer, rContentStyle]}>
            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.subtitle}>{displaySubtitle}</Text>
          </Animated.View>

          {/* Extra Touch (Thumbnail, Quote, etc.) */}
          <Animated.View style={[styles.extraContent, rContentStyle]}>
            {renderExtraTouch()}
          </Animated.View>

          {/* Actions */}
          <Animated.View style={[styles.actionsContainer, rContentStyle]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onPrimaryAction}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#1E40AF", "#3B82F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryButtonText}>
                  {config.primaryAction}  →
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {onSecondaryAction ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSecondaryAction}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Create another</Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 8,
  },
  illustrationContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  extraContent: {
    marginBottom: 24,
    width: "100%",
    alignItems: "center",
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbnailIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  quoteContainer: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    width: "100%",
  },
  quoteText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  badgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  badgeText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 12,
    color: "#0F766E",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  chipText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 12,
    color: "#C2410C",
  },
  actionsContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  primaryGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold (Compliance Rule 3)
    fontSize: 16,
    color: "#FFFFFF",
  },
  secondaryButton: {
    width: "100%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold (Compliance Rule 3)
    fontSize: 14,
    color: "#6B7280",
  },
});

export default SuccessCard;
