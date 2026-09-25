import React, { useState, useCallback } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView,
  RefreshControl, Alert,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { getAuthToken } from "../../api/auth";
import { apiGet, apiPost } from "../../api/client";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import SnooLoader from "../../components/ui/SnooLoader";
import ActiveBadge from "../../components/badges/ActiveBadge";
import SwipeableModal from "../../components/modals/SwipeableModal";
import {
  ArrowLeft, UserPlus, Users, Check, X, MessageCircle,
  ExternalLink, ChevronRight, Inbox, Clock,
} from "lucide-react-native";

const EDGES = ["top"];

export default function ConnectionsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [respondingTo, setRespondingTo] = useState(null);

  // Connection Profile Sheet state
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Hide the bottom tab bar on this screen
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  const loadData = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const [connectionsRes, pendingRes, sentRes] = await Promise.all([
        apiGet("/connections", 15000, token).catch(() => ({ connections: [] })),
        apiGet("/connections/pending", 15000, token).catch(() => ({ requests: [] })),
        apiGet("/connections/sent", 15000, token).catch(() => ({ requests: [] })),
      ]);

      setConnections(connectionsRes.connections || []);
      setPendingRequests(pendingRes.requests || []);
      setSentRequests(sentRes.requests || []);
    } catch (error) {
      console.error("Error loading connections:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleRespond = useCallback(async (requestId, action) => {
    HapticsService.triggerImpactMedium();
    setRespondingTo(requestId);
    try {
      const token = await getAuthToken();
      await apiPost(`/connections/${requestId}/respond`, { action }, 15000, token);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (action === "accept") loadData();
    } catch (error) {
      Alert.alert("Error", "Failed to respond to request. Please try again.");
    } finally {
      setRespondingTo(null);
    }
  }, [loadData]);

  const handleConnectionPress = useCallback((connection) => {
    HapticsService.triggerImpactLight();
    setSelectedConnection(connection);
    setSheetVisible(true);
  }, []);

  const handleMessage = useCallback(async () => {
    if (!selectedConnection) return;
    setSheetVisible(false);
    navigation.navigate("Chat", {
      recipientId: selectedConnection.member_id,
      recipientType: "member",
      recipientName: selectedConnection.member_name,
      recipientAvatar: selectedConnection.member_photo,
    });
  }, [selectedConnection, navigation]);

  const handleViewProfile = useCallback(() => {
    if (!selectedConnection) return;
    setSheetVisible(false);
    navigation.navigate("MemberPublicProfile", { memberId: selectedConnection.member_id });
  }, [selectedConnection, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={EDGES}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connections</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = connections.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={EDGES}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Pending Received Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <UserPlus size={18} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.sectionTitle}>Pending Requests</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRequests.length}</Text>
              </View>
            </View>

            {pendingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <Image source={{ uri: request.from_member_photo }} style={styles.requestAvatar} contentFit="cover" />
                <View style={styles.requestInfo}>
                  <View style={styles.requestNameRow}>
                    <Text style={styles.requestName} numberOfLines={1}>{request.from_member_name}</Text>
                    <ActiveBadge lastActiveAt={request.from_member_last_active} size="small" />
                  </View>
                  {request.event_title && (
                    <Text style={styles.requestContext} numberOfLines={1}>From {request.event_title}</Text>
                  )}
                  {request.message && (
                    <View style={styles.icebreakerBubble}>
                      <Text style={styles.icebreakerText} numberOfLines={2}>"{request.message}"</Text>
                    </View>
                  )}
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleRespond(request.id, "accept")}
                      disabled={respondingTo === request.id}
                      activeOpacity={0.7}
                    >
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleRespond(request.id, "decline")}
                      disabled={respondingTo === request.id}
                      activeOpacity={0.7}
                    >
                      <X size={16} color="#64748B" strokeWidth={2.5} />
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Sent Requests (Awaiting response) */}
        {sentRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Clock size={18} color="#F59E0B" strokeWidth={2} />
                <Text style={styles.sectionTitle}>Awaiting Response</Text>
              </View>
              <Text style={styles.connectionCount}>{sentRequests.length}</Text>
            </View>

            {sentRequests.map((request) => (
              <View key={request.id} style={styles.sentCard}>
                <Image source={{ uri: request.to_member_photo }} style={styles.connectionAvatar} contentFit="cover" />
                <View style={styles.connectionInfo}>
                  <Text style={styles.connectionName} numberOfLines={1}>{request.to_member_name}</Text>
                  <View style={styles.connectionMeta}>
                    {request.event_title && (
                      <Text style={styles.connectionEvent} numberOfLines={1}>Sent from {request.event_title}</Text>
                    )}
                    <ActiveBadge lastActiveAt={request.to_member_last_active} size="small" />
                  </View>
                  {request.message && (
                    <Text style={styles.sentNoteText} numberOfLines={1}>Note: "{request.message}"</Text>
                  )}
                </View>
                <View style={styles.pendingPill}>
                  <Text style={styles.pendingPillText}>Pending</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Connections */}
        <View style={styles.section}>
          {connections.length > 0 && (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Users size={18} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.sectionTitle}>Your Connections</Text>
              </View>
              <Text style={styles.connectionCount}>{connections.length}</Text>
            </View>
          )}

          {isEmpty ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Inbox size={48} color="#CBD5E1" strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No connections yet</Text>
              <Text style={styles.emptySubtext}>
                Connect with people at events to see them here.
              </Text>
            </View>
          ) : connections.length === 0 ? null : (
            connections.map((connection) => (
              <TouchableOpacity
                key={connection.connection_id}
                style={styles.connectionRow}
                onPress={() => handleConnectionPress(connection)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: connection.member_photo }} style={styles.connectionAvatar} contentFit="cover" />
                <View style={styles.connectionInfo}>
                  <Text style={styles.connectionName} numberOfLines={1}>{connection.member_name}</Text>
                  <View style={styles.connectionMeta}>
                    {connection.event_title && (
                      <Text style={styles.connectionEvent} numberOfLines={1}>Met at {connection.event_title}</Text>
                    )}
                    <ActiveBadge lastActiveAt={connection.member_last_active} size="small" />
                  </View>
                </View>
                <ChevronRight size={18} color="#CBD5E1" strokeWidth={2} />
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Connection Profile Sheet */}
      <SwipeableModal
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        sheetStyle={sheetStyles.sheet}
        backdropColor="rgba(0,0,0,0.4)"
      >
        {selectedConnection && (
          <View style={sheetStyles.container}>
            <View style={sheetStyles.handle} />
            <View style={sheetStyles.profileHeader}>
              <Image source={{ uri: selectedConnection.member_photo }} style={sheetStyles.avatar} contentFit="cover" />
              <View style={sheetStyles.profileInfo}>
                <Text style={sheetStyles.name}>{selectedConnection.member_name}</Text>
                <ActiveBadge lastActiveAt={selectedConnection.member_last_active} size="medium" />
              </View>
            </View>

            {selectedConnection.event_title && (
              <View style={sheetStyles.contextRow}>
                <Text style={sheetStyles.contextLabel}>Connected at</Text>
                <Text style={sheetStyles.contextValue}>{selectedConnection.event_title}</Text>
              </View>
            )}

            {selectedConnection.icebreaker_message && (
              <View style={sheetStyles.icebreakerSection}>
                <Text style={sheetStyles.icebreakerLabel}>Their note</Text>
                <View style={sheetStyles.icebreakerCard}>
                  <Text style={sheetStyles.icebreakerText}>"{selectedConnection.icebreaker_message}"</Text>
                </View>
              </View>
            )}

            <View style={sheetStyles.ctaRow}>
              <TouchableOpacity style={sheetStyles.messageCta} onPress={handleMessage} activeOpacity={0.7}>
                <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
                <Text style={sheetStyles.messageCtaText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sheetStyles.profileCta} onPress={handleViewProfile} activeOpacity={0.7}>
                <ExternalLink size={20} color={COLORS.primary} strokeWidth={2} />
                <Text style={sheetStyles.profileCtaText}>View Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SwipeableModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.08)",
  },
  backButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: "BasicCommercial-Black", color: COLORS.textPrimary },
  content: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  badge: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, minWidth: 26, alignItems: "center" },
  badgeText: { fontSize: 12, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  connectionCount: { fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textSecondary },

  // Pending cards
  requestCard: {
    flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.03)",
  },
  requestAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#E2E8F0" },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  requestName: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, flexShrink: 1 },
  requestContext: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  icebreakerBubble: {
    backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 8, borderWidth: 1, borderColor: "rgba(59,130,246,0.08)",
  },
  icebreakerText: { fontSize: 13, fontFamily: FONTS.regular, color: "#1E40AF", fontStyle: "italic", lineHeight: 18 },
  requestActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  acceptButton: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#22C55E", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  acceptText: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  declineButton: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  declineText: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#64748B" },

  // Sent cards
  sentCard: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#F8FAFC",
  },
  sentNoteText: { fontSize: 12, fontFamily: FONTS.regular, color: "#94A3B8", marginTop: 2, fontStyle: "italic" },
  pendingPill: { backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  pendingPillText: { fontSize: 12, fontFamily: FONTS.semiBold, color: "#B45309" },

  // Connection rows
  connectionRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F8FAFC",
  },
  connectionAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E2E8F0" },
  connectionInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  connectionName: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  connectionMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  connectionEvent: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.textSecondary, flexShrink: 1 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
});

const sheetStyles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: "#FFFFFF", paddingBottom: 20 },
  container: { padding: 20 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 20 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E2E8F0" },
  profileInfo: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontFamily: "BasicCommercial-Bold", color: COLORS.textPrimary },
  contextRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 12,
  },
  contextLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  contextValue: { fontSize: 14, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, flexShrink: 1, textAlign: "right" },
  icebreakerSection: { marginBottom: 16 },
  icebreakerLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginBottom: 6 },
  icebreakerCard: { backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(59,130,246,0.08)" },
  icebreakerText: { fontSize: 14, fontFamily: FONTS.regular, color: "#1E40AF", fontStyle: "italic", lineHeight: 20 },
  ctaRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  messageCta: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14,
  },
  messageCtaText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  profileCta: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 14, paddingVertical: 14,
  },
  profileCtaText: { fontSize: 16, fontFamily: FONTS.semiBold, color: COLORS.primary },
});
