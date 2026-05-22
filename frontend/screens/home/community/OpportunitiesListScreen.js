import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import {
  ArrowLeft,
  Plus,
  Briefcase,
  Users,
  Banknote,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react-native";

import { COLORS, FONTS, BORDER_RADIUS } from "../../../constants/theme";
import { getOpportunities, closeOpportunity } from "../../../api/opportunities";
import SnooLoader from "../../../components/ui/SnooLoader";

const TABS = [
  { key: "active", label: "Active" },
  { key: "closed", label: "Closed" },
  { key: "draft", label: "Drafts" },
];

const getStatusConfig = (status) => {
  switch (status) {
    case "active":
      return { label: "Accepting", color: COLORS.success, bg: "rgba(52, 199, 89, 0.08)" };
    case "closed":
      return { label: "Closed", color: COLORS.textMuted, bg: "rgba(107, 114, 128, 0.08)" };
    case "draft":
      return { label: "Draft", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.08)" };
    default:
      return { label: status, color: COLORS.textMuted, bg: "rgba(107, 114, 128, 0.08)" };
  }
};

const getNatureLabel = (nature, trialType) => {
  if (nature === "paid") return "Paid";
  if (nature === "trial") return trialType === "paid_trial" ? "Paid Trial" : "Free Trial";
  if (nature === "revenue_share") return "Rev Share";
  if (nature === "exposure") return "Exposure";
  return nature || "Paid";
};

export default function OpportunitiesListScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState("active");

  useFocusEffect(
    useCallback(() => {
      loadOpportunities();
    }, [activeTab]),
  );

  const loadOpportunities = async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await getOpportunities(activeTab);
      if (response?.success) {
        setOpportunities(response.opportunities || []);
      }
    } catch (error) {
      console.error("Error loading opportunities:", error);
      setOpportunities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOpportunities();
  };

  const handleCreate = () => {
    navigation.navigate("CreateOpportunity");
  };

  const handleEdit = (opportunity) => {
    navigation.navigate("CreateOpportunity", { opportunityToEdit: opportunity });
  };

  const handleViewApplicants = (opportunity) => {
    navigation.navigate("ApplicantsList", {
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
    });
  };

  const handleDelete = (opportunity) => {
    Alert.alert(
      "Delete Opportunity",
      `Are you sure you want to delete "${opportunity.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await closeOpportunity(opportunity.id, "delete");
              setOpportunities((prev) => prev.filter((o) => o.id !== opportunity.id));
            } catch (error) {
              console.error("Error deleting opportunity:", error);
              Alert.alert("Error", "Failed to delete opportunity");
            }
          },
        },
      ],
    );
  };

  const renderCard = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);
    const natureLabel = getNatureLabel(item.payment_nature, item.trial_type);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleViewApplicants(item)}
        activeOpacity={0.85}
      >
        {/* Title + Status row */}
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Role chips */}
        {item.opportunity_types?.length > 0 && (
          <View style={styles.chipsRow}>
            {item.opportunity_types.slice(0, 3).map((type, idx) => (
              <View key={idx} style={styles.roleChip}>
                <Text style={styles.roleChipText}>{type}</Text>
              </View>
            ))}
            {item.opportunity_types.length > 3 && (
              <Text style={styles.moreChips}>+{item.opportunity_types.length - 3}</Text>
            )}
          </View>
        )}

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Banknote size={13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>
              {natureLabel}
              {item.budget_range ? ` · ${item.budget_range}` : ""}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Users size={13} color={COLORS.primary} strokeWidth={2} />
            <Text style={[styles.metaText, { color: COLORS.primary }]}>
              {item.applicant_count || 0} applicant{item.applicant_count !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEdit(item)}
            activeOpacity={0.7}
          >
            <Pencil size={14} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color={COLORS.error} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleViewApplicants(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewButtonText}>View Applicants</Text>
            <ChevronRight size={14} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Briefcase size={32} color={COLORS.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "draft"
          ? "No drafts yet"
          : activeTab === "closed"
            ? "No closed opportunities"
            : "No opportunities yet"}
      </Text>
      <Text style={styles.emptyBody}>
        {activeTab === "active"
          ? "Create your first opportunity and start receiving structured applications."
          : "Opportunities you create will appear here."}
      </Text>
      {activeTab === "active" && (
        <TouchableOpacity style={styles.emptyCtaWrap} onPress={handleCreate} activeOpacity={0.85}>
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyCtaGradient}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.emptyCtaText}>Create Opportunity</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Opportunities</Text>
        <TouchableOpacity
          style={styles.headerAdd}
          onPress={handleCreate}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerAddGradient}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={opportunities}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
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
    backgroundColor: COLORS.screenBackground,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerAdd: {
    borderRadius: 999,
    overflow: "hidden",
  },
  headerAddGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    flexGrow: 1,
  },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 21,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.2,
  },

  // Role chips
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  roleChip: {
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleChipText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.primary,
  },
  moreChips: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    alignSelf: "center",
  },

  // Meta
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Card actions
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.2)",
    backgroundColor: "rgba(41, 98, 255, 0.04)",
  },
  editButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(229, 62, 62, 0.2)",
    backgroundColor: "rgba(229, 62, 62, 0.04)",
  },
  viewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  viewButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyCtaWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyCtaGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyCtaText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
