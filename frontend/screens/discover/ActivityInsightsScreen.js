import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getAuthToken } from "../../api/auth";
import { apiGet, apiPost } from "../../api/client";
import { COLORS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

export default function ActivityInsightsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) return;

      // Load insights and pending requests in parallel
      const [insightsRes, pendingRes] = await Promise.all([
        apiGet("/activity/insights", 15000, token),
        apiGet("/connections/pending", 15000, token),
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

  const handleRespondToRequest = async (requestId, action) => {
    try {
      const token = await getAuthToken();
      await apiPost(
        `/connections/${requestId}/respond`,
        { action },
        15000,
        token
      );
      HapticsService.triggerNotificationSuccess();

      // Remove from list
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

      if (action === "accept") {
        Alert.alert("Connected!", "You're now connected.");
      }
    } catch (error) {
      console.error("Error responding:", error);
      Alert.alert("Error", "Failed to respond. Please try again.");
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
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
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
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
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="eye-outline" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.statNumber}>
              {insights?.viewsThisWeek || 0}
            </Text>
            <Text style={styles.statLabel}>Profile views</Text>
            {insights?.viewsChange !== 0 && (
              <View
                style={[
                  styles.changeBadge,
                  insights?.viewsChange > 0
                    ? styles.changeBadgePositive
                    : styles.changeBadgeNegative,
                ]}
              >
                <Ionicons
                  name={insights?.viewsChange > 0 ? "arrow-up" : "arrow-down"}
                  size={12}
                  color={insights?.viewsChange > 0 ? "#10B981" : "#EF4444"}
                />
                <Text
                  style={[
                    styles.changeText,
                    {
                      color: insights?.viewsChange > 0 ? "#10B981" : "#EF4444",
                    },
                  ]}
                >
                  {Math.abs(insights?.viewsChange || 0)}%
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons
                name="people-outline"
                size={24}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.statNumber}>
              {insights?.connectionsThisWeek || 0}
            </Text>
            <Text style={styles.statLabel}>New connections</Text>
            <Text style={styles.statSubtext}>this week</Text>
          </View>
        </View>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Connection Requests</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequests.length}</Text>
              </View>
            </View>

            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestAvatar}>
                  {request.from_member_photo ? (
                    <Image
                      source={{ uri: request.from_member_photo }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={24}
                      color={COLORS.textSecondary}
                    />
                  )}
                </View>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>
                    {request.from_member_name}
                  </Text>
                  {request.message && (
                    <Text style={styles.requestMessage} numberOfLines={1}>
                      "{request.message}"
                    </Text>
                  )}
                  {request.event_title && (
                    <Text style={styles.requestEvent}>
                      from {request.event_title}
                    </Text>
                  )}
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleRespondToRequest(request.id, "accept")}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() =>
                      handleRespondToRequest(request.id, "decline")
                    }
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          {recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="pulse-outline"
                size={48}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>
                Attend events and connect with people to see activity here
              </Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <View
                  style={[
                    styles.activityIcon,
                    activity.type === "connection"
                      ? styles.activityIconConnection
                      : styles.activityIconView,
                  ]}
                >
                  <Ionicons
                    name={activity.type === "connection" ? "people" : "eye"}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.activityContent}>
                  {activity.type === "connection" ? (
                    <Text style={styles.activityText}>
                      Connected with{" "}
                      <Text style={styles.activityHighlight}>
                        {activity.member_name}
                      </Text>
                    </Text>
                  ) : (
                    <Text style={styles.activityText}>
                      Viewed by {activity.count}{" "}
                      {activity.count === 1 ? "person" : "people"}
                      {activity.event_title && (
                        <Text>
                          {" "}
                          at{" "}
                          <Text style={styles.activityHighlight}>
                            {activity.event_title}
                          </Text>
                        </Text>
                      )}
                    </Text>
                  )}
                  <Text style={styles.activityTime}>
                    {formatTimeAgo(activity.timestamp)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* View Connections Button */}
        <TouchableOpacity
          style={styles.viewConnectionsButton}
          onPress={() => navigation.navigate("Connections")}
        >
          <Ionicons name="people" size={20} color={COLORS.primary} />
          <Text style={styles.viewConnectionsText}>View All Connections</Text>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={COLORS.textSecondary}
          />
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
    fontSize: 17,
    fontWeight: "700",
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
    flex: 1,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
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
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 2,
  },
  changeBadgePositive: {
    backgroundColor: "#D1FAE5",
  },
  changeBadgeNegative: {
    backgroundColor: "#FEE2E2",
  },
  changeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  requestMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  requestEvent: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityIconConnection: {
    backgroundColor: "#10B981",
  },
  activityIconView: {
    backgroundColor: "#6366F1",
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  activityHighlight: {
    fontWeight: "600",
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  viewConnectionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  viewConnectionsText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
  },
});
