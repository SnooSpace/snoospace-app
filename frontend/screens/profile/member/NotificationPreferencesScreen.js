import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
} from "react-native-reanimated";
import { Pressable } from "react-native";
import {
  ArrowLeft,
  Heart,
  Users,
  MessageCircle,
  Calendar,
  AlertCircle,
  Bell,
} from "lucide-react-native";
import {
  COLORS,
  FONTS,
  BORDER_RADIUS,
} from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "../../../api/notifications";

// Animated toggle (consistent switch design)
function AnimatedSwitch({ value, onValueChange, activeColor = "#2962FF" }) {
  const translateX = useSharedValue(value ? 22 : 2);

  useEffect(() => {
    translateX.value = withSpring(value ? 22 : 2, {
      mass: 0.8,
      stiffness: 150,
      damping: 15,
    });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      translateX.value,
      [2, 22],
      ["#E5E5EA", activeColor],
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[switchStyles.track, trackStyle]}>
        <Animated.View style={[switchStyles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const switchStyles = StyleSheet.create({
  track: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    padding: 2,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
});

function PreferenceRow({
  icon: Icon,
  iconColor,
  label,
  sublabel,
  value,
  onValueChange,
  isFirst,
  isLast,
}) {
  return (
    <View
      style={[
        rowStyles.row,
        isFirst && rowStyles.rowFirst,
        isLast && rowStyles.rowLast,
        !isLast && rowStyles.rowWithBorder,
      ]}
    >
      <View style={[rowStyles.iconBox, { backgroundColor: `${iconColor}14` }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={rowStyles.labelWrap}>
        <Text style={rowStyles.label}>{label}</Text>
        {sublabel ? <Text style={rowStyles.sublabel}>{sublabel}</Text> : null}
      </View>
      <AnimatedSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  rowFirst: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  rowLast: {
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  rowWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  labelWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sublabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

function SectionLabel({ title }) {
  return <Text style={sectionStyles.label}>{title}</Text>;
}

const sectionStyles = StyleSheet.create({
  label: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 0.8,
  },
});

export default function NotificationPreferencesScreen({ navigation }) {
  const [preferences, setPreferences] = useState({
    activity: true,
    communities: true,
    messages: true,
    events: true,
    system: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchNotificationPreferences();
        if (res?.preferences) {
          setPreferences(res.preferences);
        }
      } catch (e) {
        console.warn("Failed to fetch notification preferences", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = useCallback(async (category, currentValue) => {
    HapticsService.triggerImpactMedium();
    const newValue = !currentValue;
    
    // Optimistic update
    setPreferences(prev => ({
      ...prev,
      [category]: newValue
    }));

    try {
      await updateNotificationPreferences(category, newValue);
    } catch (e) {
      console.warn(`Failed to update preference for ${category}`, e);
      // Revert on error
      setPreferences(prev => ({
        ...prev,
        [category]: currentValue
      }));
      Alert.alert("Error", "Failed to update notification settings. Please try again.");
    }
  }, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: "#FFFFFF" }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              HapticsService.triggerImpactLight();
              navigation.goBack();
            }}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#1D1D1F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SectionLabel title="Push Notifications" />
          <View style={styles.card}>
            <PreferenceRow
              icon={Heart}
              iconColor="#FF3B30"
              label="Likes & Comments"
              sublabel="Activity on your plans, questions, and posts"
              value={preferences.activity}
              onValueChange={() => handleToggle("activity", preferences.activity)}
              isFirst
            />
            <PreferenceRow
              icon={Users}
              iconColor="#7C3AED"
              label="Communities & Social"
              sublabel="Circle requests, follows, and groups"
              value={preferences.communities}
              onValueChange={() => handleToggle("communities", preferences.communities)}
            />
            <PreferenceRow
              icon={MessageCircle}
              iconColor="#007AFF"
              label="Direct Messages"
              sublabel="Direct chat messages and chat requests"
              value={preferences.messages}
              onValueChange={() => handleToggle("messages", preferences.messages)}
            />
            <PreferenceRow
              icon={Calendar}
              iconColor="#34C759"
              label="Events"
              sublabel="RSVPs, reminders, and invitations"
              value={preferences.events}
              onValueChange={() => handleToggle("events", preferences.events)}
            />
            <PreferenceRow
              icon={AlertCircle}
              iconColor="#8E8E93"
              label="System & Moderation"
              sublabel="Account security alerts and system announcements"
              value={preferences.system}
              onValueChange={() => handleToggle("system", preferences.system)}
              isLast
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    overflow: "hidden",
    borderRadius: BORDER_RADIUS.xl,
    backgroundColor: "#FFFFFF",
  },
});
