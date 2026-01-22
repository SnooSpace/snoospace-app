import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { getApplications } from "../../../api/opportunities";

const COLORS = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  primary: "#007AFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const STATUS_CONFIG = {
  pending: { label: "New", color: COLORS.primary, icon: "time-outline" },
  shortlisted: { label: "Shortlisted", color: COLORS.success, icon: "star" },
  rejected: { label: "Rejected", color: COLORS.error, icon: "close-circle" },
  withdrawn: {
    label: "Withdrawn",
    color: COLORS.textLight,
    icon: "arrow-undo",
  },
};

export default function ApplicantsListScreen({ route, navigation }) {
  const { opportunityId, opportunityTitle } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applications, setApplications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all"); // 'all', 'pending', 'shortlisted', 'rejected'

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [activeFilter]),
  );

  const loadApplications = async () => {
    try {
      if (!refreshing) setLoading(true);
      const statusFilter = activeFilter === "all" ? null : activeFilter;
      const response = await getApplications(opportunityId, {
        status: statusFilter,
      });
      if (response?.success) {
        setApplications(response.applications || []);
      }
    } catch (error) {
      console.error("Error loading applications:", error);
      setApplications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const handleViewApplication = (application) => {
    navigation.navigate("ApplicantDetail", {
      applicationId: application.id,
      opportunityId,
    });
  };

  const getFilteredCount = (status) => {
    if (status === "all") return applications.length;
    return applications.filter((a) => a.status === status).length;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderApplicationCard = ({ item }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <TouchableOpacity
        style={styles.applicationCard}
        onPress={() => handleViewApplication(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {item.applicant_photo ? (
              <Image
                source={{ uri: item.applicant_photo }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {item.applicant_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.applicantName} numberOfLines={1}>
              {item.applicant_name || "Unknown"}
            </Text>
            <Text style={styles.applicantUsername} numberOfLines={1}>
              @{item.applicant_username || "unknown"} · {item.applied_role}
            </Text>
            <Text style={styles.appliedDate}>
              {formatDate(item.created_at)}
            </Text>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.color + "15" },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={14}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Portfolio indicator */}
        {item.portfolio_link && (
          <View style={styles.portfolioIndicator}>
            <Ionicons name="link-outline" size={14} color={COLORS.primary} />
            <Text style={styles.portfolioText}>Portfolio attached</Text>
          </View>
        )}

        <View style={styles.cardArrow}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>
        {activeFilter === "all"
          ? "No applications yet"
          : `No ${activeFilter} applications`}
      </Text>
      <Text style={styles.emptySubtitle}>
        Applications will appear here when people apply.
      </Text>
    </View>
  );

  const filters = [
    { key: "all", label: "All" },
    { key: "pending", label: "New" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Applications</Text>
          {opportunityTitle && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {opportunityTitle}
            </Text>
          )}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              activeFilter === filter.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === filter.key && styles.filterTabTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={applications}
          renderItem={renderApplicationCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textLight,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  applicationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
  },
  infoContainer: {
    flex: 1,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  applicantUsername: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  appliedDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  portfolioIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  portfolioText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  cardArrow: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
