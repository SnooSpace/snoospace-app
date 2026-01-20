import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";

import { COLORS } from "../../../constants/theme";
import { getOpportunities } from "../../../api/opportunities";

const PRIMARY_COLOR = "#007AFF";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function OpportunitiesListScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [activeTab, setActiveTab] = useState("active"); // 'active', 'closed', 'draft'

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

  const handleCreateOpportunity = () => {
    navigation.navigate("CreateOpportunity");
  };

  const handleViewOpportunity = (opportunity) => {
    navigation.navigate("OpportunityDetail", { opportunityId: opportunity.id });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#34C759";
      case "closed":
        return "#8E8E93";
      case "draft":
        return "#FF9500";
      default:
        return LIGHT_TEXT_COLOR;
    }
  };

  const renderOpportunityCard = ({ item }) => (
    <TouchableOpacity
      style={styles.opportunityCard}
      onPress={() => handleViewOpportunity(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.opportunityTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}20` },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <Text
            style={[styles.statusText, { color: getStatusColor(item.status) }]}
          >
            {item.status === "active" ? "Accepting" : item.status}
          </Text>
        </View>
      </View>

      {/* Role Tags */}
      <View style={styles.tagsContainer}>
        {item.opportunity_types?.slice(0, 3).map((type, index) => (
          <View key={index} style={styles.roleTag}>
            <Text style={styles.roleTagText}>{type}</Text>
          </View>
        ))}
        {item.opportunity_types?.length > 3 && (
          <Text style={styles.moreRoles}>
            +{item.opportunity_types.length - 3}
          </Text>
        )}
      </View>

      {/* Payment & Stats */}
      <View style={styles.cardFooter}>
        <View style={styles.paymentInfo}>
          <Ionicons name="cash-outline" size={14} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.paymentText}>
            {item.payment_nature === "paid" ? "Paid" : item.payment_nature}
            {item.budget_range ? ` · ${item.budget_range}` : ""}
          </Text>
        </View>
        <View style={styles.applicantsInfo}>
          <Ionicons name="people-outline" size={14} color={PRIMARY_COLOR} />
          <Text style={styles.applicantsText}>
            {item.applicant_count || 0} applicants
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="briefcase-outline" size={64} color={LIGHT_TEXT_COLOR} />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === "draft"
          ? "No drafts yet"
          : activeTab === "closed"
            ? "No closed opportunities"
            : "Create your first opportunity"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "active"
          ? "Stop using Google Forms. Get structured applications with portfolio samples you can compare."
          : "Opportunities you create will appear here."}
      </Text>
      {activeTab === "active" && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={handleCreateOpportunity}
        >
          <LinearGradient
            colors={["#00C6FF", "#007AFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyButtonGradient}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Create Opportunity</Text>
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Opportunities</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateOpportunity}
        >
          <LinearGradient
            colors={["#00C6FF", "#007AFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {["active", "closed", "draft"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={opportunities}
          renderItem={renderOpportunityCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_COLOR}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  addButton: {
    borderRadius: 20,
    overflow: "hidden",
  },
  addButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
  },
  activeTab: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  opportunityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: `${PRIMARY_COLOR}10`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: "500",
    color: PRIMARY_COLOR,
  },
  moreRoles: {
    fontSize: 12,
    fontWeight: "500",
    color: LIGHT_TEXT_COLOR,
    alignSelf: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  paymentInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  paymentText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  applicantsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  applicantsText: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
