import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getAuthToken } from "../../api/auth";
import { apiGet, apiPost } from "../../api/client";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import {
  ArrowLeft,
  Eye,
  UserPlus,
  ChartNoAxesColumn,
  Users,
  ChevronRight,
  User,
  Coffee,
  Rocket,
} from "lucide-react-native";

// Helper for counting numbers
const CountingNumber = ({ value, duration = 300 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    countRef.setValue(0);
    const listener = countRef.addListener(({ value }) => {
      setDisplayValue(Math.floor(value));
    });

    Animated.timing(countRef, {
      toValue: value || 0,
      duration: duration,
      useNativeDriver: false, // Cannot use native driver for listeners that update state
    }).start();

    return () => {
      countRef.removeListener(listener);
    };
  }, [value]);

  return <Text style={styles.statNumber}>{displayValue}</Text>;
};

export default function ActivityInsightsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // Animation values
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(8)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateY = useRef(new Animated.Value(8)).current;
  const card1Scale = useRef(new Animated.Value(1)).current;
  const card2Scale = useRef(new Animated.Value(1)).current;

  const sectionOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  useEffect(() => {
    if (!loading) {
      // Trigger card load animations
      Animated.stagger(80, [
        Animated.parallel([
          Animated.timing(card1Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(card1TranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(card2Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(card2TranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Section fade-in
        Animated.timing(sectionOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });

      // Infinite pulse animation for empty state icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.96,
            duration: 1250,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1250,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [loading]);

  const loadData = async () => {
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
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCardPress = (scaleValue) => {
    HapticsService.triggerImpactLight();
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

  const getActivityIcon = (type) => {
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
  };

  // Staggered Row Component
  const ActivityRow = ({ activity, index }) => {
    const rowOpacity = useRef(new Animated.Value(0)).current;
    const rowTranslateX = useRef(new Animated.Value(-6)).current;

    useEffect(() => {
      Animated.delay(index * 40).start(() => {
        Animated.parallel([
          Animated.timing(rowOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(rowTranslateX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, [index]);

    return (
      <Animated.View
        style={[
          styles.activityRow,
          { opacity: rowOpacity, transform: [{ translateX: rowTranslateX }] },
        ]}
      >
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
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
          <Animated.View
            style={[
              {
                flex: 1,
                opacity: card1Opacity,
                transform: [
                  { translateY: card1TranslateY },
                  { scale: card1Scale },
                ],
              },
            ]}
          >
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

          <Animated.View
            style={[
              {
                flex: 1,
                opacity: card2Opacity,
                transform: [
                  { translateY: card2TranslateY },
                  { scale: card2Scale },
                ],
              },
            ]}
          >
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
        <Animated.View style={[styles.section, { opacity: sectionOpacity }]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
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
