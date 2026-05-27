import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, RefreshControl, Alert, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  useAnimatedReaction,
  runOnJS
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import SnooLoader from "../../components/ui/SnooLoader";
import {
  ArrowLeft,
  Eye,
  UserPlus,
  ChartNoAxesColumn,
  Users,
  ChevronRight,
  Rocket,
} from "lucide-react-native";

const EDGES = ["top"];

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "Recently";
  const now = new Date();
  const date = new Date(timestamp);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return "This week";
};

// Helper for counting numbers running on UI thread via Reanimated timing
const CountingNumber = React.memo(({ value, duration = 300 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const count = useSharedValue(0);

  useEffect(() => {
    count.value = 0;
    count.value = withTiming(value || 0, { duration });
  }, [value, duration]);

  useAnimatedReaction(
    () => count.value,
    (nextVal) => {
      runOnJS(setDisplayValue)(Math.floor(nextVal));
    }
  );

  return <Text style={styles.statNumber}>{displayValue}</Text>;
});

export default function ActivityInsightsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // Animation values using high-performance useSharedValue
  const card1Opacity = useSharedValue(0);
  const card1TranslateY = useSharedValue(8);
  const card2Opacity = useSharedValue(0);
  const card2TranslateY = useSharedValue(8);
  const card1Scale = useSharedValue(1);
  const card2Scale = useSharedValue(1);

  const sectionOpacity = useSharedValue(0);
  const pulseAnim = useSharedValue(1);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      const [insightsRes, pendingRes] = await Promise.all([
        apiGet("/activity/insights", 15000, token).catch(() => ({
          insights: {},
          recentActivity: [],
        })),
        apiGet("/connections/pending", 15000, token).catch(() => ({
          requests: [],
        })),
      ]);

      setInsights(insightsRes.insights || {});
      setRecentActivity(insightsRes.recentActivity || []);
      setPendingRequests(pendingRes.requests || []);
    } catch (error) {
      console.error("Error loading activity:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    if (!loading) {
      // Trigger card load animations using native-backed timing staggers
      card1Opacity.value = withTiming(1, { duration: 400 });
      card1TranslateY.value = withTiming(0, { duration: 400 });

      card2Opacity.value = withDelay(80, withTiming(1, { duration: 400 }));
      card2TranslateY.value = withDelay(80, withTiming(0, { duration: 400 }));

      // Section fade-in
      sectionOpacity.value = withDelay(480, withTiming(1, { duration: 300 }));

      // Infinite pulse animation for empty state icon offloaded to native thread
      pulseAnim.value = withRepeat(
        withTiming(0.96, { duration: 1250 }),
        -1,
        true
      );
    }
  }, [loading]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCardPress = useCallback((scaleValue) => {
    HapticsService.triggerImpactLight();
    scaleValue.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withSpring(1, { damping: 12, stiffness: 120 })
    );
  }, []);

  const getActivityIcon = useCallback((type) => {
    switch (type) {
      case "profile_view":
        return <Eye size={18} color={COLORS.textSecondary} strokeWidth={1.5} />;
      case "connection":
        return (
          <UserPlus size={18} color={COLORS.textSecondary} strokeWidth={1.5} />
        );
      case "group_join":
        return (
          <Users size={18} color={COLORS.textSecondary} strokeWidth={1.5} />
        );
      default:
        return (
          <Rocket size={18} color={COLORS.textSecondary} strokeWidth={1.5} />
        );
    }
  }, []);

  // Staggered Row Component
  const ActivityRow = React.memo(({ activity, index }) => {
    const rowOpacity = useSharedValue(0);
    const rowTranslateX = useSharedValue(-6);

    useEffect(() => {
      rowOpacity.value = withDelay(index * 40, withTiming(1, { duration: 300 }));
      rowTranslateX.value = withDelay(index * 40, withTiming(0, { duration: 300 }));
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: rowOpacity.value,
      transform: [{ translateX: rowTranslateX.value }],
    }));

    return (
      <Animated.View style={[styles.activityRow, animatedStyle]}>
        <View style={styles.activityIconContainer}>
          {getActivityIcon(activity.type)}
        </View>
        <View style={styles.activityTextContainer}>
          <Text style={styles.activityPrimaryText}>
            {activity.text || "Updated your profile"}
          </Text>
          <Text style={styles.activitySecondaryText}>
            {formatTimeAgo(activity.timestamp)}
          </Text>
        </View>
      </Animated.View>
    );
  });

  const card1AnimatedStyle = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [
      { translateY: card1TranslateY.value },
      { scale: card1Scale.value },
    ],
  }));

  const card2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [
      { translateY: card2TranslateY.value },
      { scale: card2Scale.value },
    ],
  }));

  const sectionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sectionOpacity.value,
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={EDGES}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity & Insights</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <Animated.View style={[{ flex: 1 }, card1AnimatedStyle]}>
            <Pressable
              onPress={() => handleCardPress(card1Scale)}
              style={({ pressed }) => [
                styles.statCard,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.statIconContainer}>
                <Eye size={24} color={COLORS.primary} strokeWidth={2} />
              </View>
              <CountingNumber value={insights?.viewsThisWeek || 0} />
              <Text style={styles.statLabel}>Profile views</Text>
              <Text style={styles.statHelperText}>
                Share posts to increase visibility
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, card2AnimatedStyle]}>
            <Pressable
              onPress={() => handleCardPress(card2Scale)}
              style={({ pressed }) => [
                styles.statCard,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.statIconContainer}>
                <UserPlus size={24} color={COLORS.primary} strokeWidth={2} />
              </View>
              <CountingNumber value={insights?.connectionsThisWeek || 0} />
              <Text style={styles.statLabel}>New connections</Text>
              <Text style={styles.statHelperText}>
                Engage in groups to meet people
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Recent Activity */}
        <Animated.View style={[styles.section, sectionAnimatedStyle]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Animated.View style={pulseAnimatedStyle}>
                <ChartNoAxesColumn size={48} color={COLORS.textSecondary} />
              </Animated.View>
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>
                Attend events and connect with people to see your activity
                timeline here.
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {recentActivity.map((activity, index) => (
                <ActivityRow key={index} activity={activity} index={index} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* View Connections Button */}
        <TouchableOpacity
          style={styles.viewConnectionsButton}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Connections")}
        >
          <View style={styles.viewConnectionsIcon}>
            <Users size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.viewConnectionsText}>View All Connections</Text>
          <ChevronRight size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E8F4FD",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statHelperText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  activityList: {
    gap: 4,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityPrimaryText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  activitySecondaryText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  viewConnectionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  viewConnectionsIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E8F4FD",
    justifyContent: "center",
    alignItems: "center",
  },
  viewConnectionsText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
    flex: 1,
    marginLeft: 12,
  },
});
