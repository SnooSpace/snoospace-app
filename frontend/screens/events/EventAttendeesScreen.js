import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LinearGradient from "../../components/ui/LinearGradient";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";
import {
  ArrowLeft,
  ChevronDown,
  Radio,
  Tag,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react-native";
import SkeletonPlaceholder from "../../components/ui/SkeletonPlaceholder";
import numeral from "numeral";
import { PieChart } from "react-native-svg-charts";
import Svg, { Path, Circle, Polyline } from "react-native-svg";

import { getEventInsights } from "../../api/events";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";
import SnooLoader from "../../components/ui/SnooLoader";

const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1F2937";
const MUTED_TEXT = "#6B7280";
const BORDER_COLOR = "#E5E7EB";
const PRIMARY_COLOR = "#6A0DAD";
const SUCCESS_COLOR = "#10B981";

// Pie chart color palettes
const GENDER_COLORS = { Male: "#007AFF", Female: "#FF2D92", Unknown: "#6B7280", Other: "#6B7280" };
const TICKET_COLORS = ["#6A0DAD", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"];

// Gender colors
const MALE_COLOR = "#007AFF"; // Blue
const FEMALE_COLOR = "#FF2D92"; // Pink
const OTHER_COLOR = "#6B7280"; // Gray for Non-binary

const getGenderAbbrev = (gender) => {
  switch (gender) {
    case "Male": return "M";
    case "Female": return "F";
    case "Non-binary": return "NB";
    default: return "";
  }
};

const getGenderColor = (gender) => {
  switch (gender) {
    case "Male": return MALE_COLOR;
    case "Female": return FEMALE_COLOR;
    default: return OTHER_COLOR;
  }
};

const formatRelativeTime = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/** Animated Counter Component */
const AnimatedCounter = ({ value, prefix = "", format = "0,0" }) => {
  // In a real app we'd use native reanimated text props to animate numbers,
  // but for the static UI phase, we'll just show the formatted value with a fade
  return (
    <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.revenueText}>
      {prefix}
      {numeral(value).format(format)}
    </Animated.Text>
  );
};

const AttendeeListItem = ({ attendee, onPress }) => {
  const gradientColors = getGradientForName(attendee.name);
  const initials = getInitials(attendee.name);
  const genderColor = getGenderColor(attendee.gender);
  const genderAbbrev = getGenderAbbrev(attendee.gender);

  return (
    <TouchableOpacity
      style={styles.attendeeCard}
      onPress={() => onPress?.(attendee)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {attendee.profile_photo_url ? (
        <Image
          source={{ uri: attendee.profile_photo_url }}
          style={styles.avatar}
        />
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
      )}

      {/* Info Section */}
      <View style={styles.infoSection}>
        {/* Name Row with Gender and Age */}
        <View style={styles.nameRow}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {attendee.name}
          </Text>
          {genderAbbrev && (
            <Text style={[styles.genderBadge, { color: genderColor }]}>
              ({genderAbbrev})
            </Text>
          )}
          {attendee.age && (
            <Text style={styles.ageBadge}>{attendee.age}yrs</Text>
          )}
        </View>

        {/* Username */}
        {attendee.username && (
          <Text style={styles.username}>@{attendee.username}</Text>
        )}

        {/* Tickets */}
        {attendee.tickets && attendee.tickets.length > 0 && (
          <View style={styles.ticketsContainer}>
            {attendee.tickets.map((ticket, index) => (
              <View key={index} style={styles.ticketBadge}>
                <Ticket
                  size={12}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.ticketText}>
                  {ticket.ticketName} × {ticket.quantity}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Registration time */}
        {attendee.registered_at && (
          <Text style={styles.registeredTime}>
            Registered {formatRelativeTime(attendee.registered_at)}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <ChevronDown size={20} color={MUTED_TEXT} style={{transform: [{rotate: '-90deg'}]}} />
    </TouchableOpacity>
  );
};

export default function EventAttendeesScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All Tickets");

  const loadInsights = useCallback(async () => {
    if (!event?.id) return;
    try {
      const response = await getEventInsights(event.id);
      if (response?.insights) {
        setInsights(response.insights);
      }
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [event?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Derived data from insights
  const totalRevenue = insights?.totalRevenue ?? 0;
  const ticketsSold = insights?.ticketsSold ?? 0;
  const interestedCount = insights?.interestedCount ?? 0;
  const conversionRate = insights?.conversionRate ?? 0;

  // Build pie chart data from real breakdown
  const genderPieData = (insights?.genderBreakdown ?? []).map((g, i) => ({
    key: g.gender,
    value: g.count,
    svg: { fill: GENDER_COLORS[g.gender] || "#6B7280" },
  }));

  const ticketPieData = (insights?.ticketTypeBreakdown ?? []).map((t, i) => ({
    key: t.ticketName,
    value: t.count,
    svg: { fill: TICKET_COLORS[i % TICKET_COLORS.length] },
  }));

  // Build trend sparkline points from daily data
  const trendPoints = (() => {
    const trend = insights?.dailyTrend ?? [];
    if (trend.length === 0) return "0,60";
    const revenues = trend.map((d) => d.revenue);
    const maxRev = Math.max(...revenues, 1);
    return trend
      .map((d, i) => {
        const x = (i / Math.max(trend.length - 1, 1)) * 300;
        const y = 60 - (d.revenue / maxRev) * 55;
        return `${x.toFixed(0)},${y.toFixed(0)}`;
      })
      .join(" ");
  })();

  // Filter attendees based on active tab
  const filteredAttendees = (insights?.attendees ?? []).filter((a) => {
    if (activeFilter === "Gender") return !!a.gender;
    if (activeFilter === "Ticket Type") return !!a.ticketName;
    return true; // "All Tickets"
  });

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <ArrowLeft size={24} color={TEXT_COLOR} />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>Event Insights</Text>
        <Text style={styles.headerSubtitle}>{event?.title || "Community Event"}</Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      {["All Tickets", "Gender", "Ticket Type"].map((filter) => (
        <TouchableOpacity
          key={filter}
          onPress={() => setActiveFilter(filter)}
          style={[
            styles.filterPill,
            activeFilter === filter && styles.filterPillActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              activeFilter === filter && styles.filterTextActive,
            ]}
          >
            {filter}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <ScrollView style={styles.content}>
          <SkeletonPlaceholder borderRadius={16}>
            <SkeletonPlaceholder.Item width="100%" height={200} marginBottom={16} />
            <SkeletonPlaceholder.Item width="100%" height={150} marginBottom={16} />
            <SkeletonPlaceholder.Item width="100%" height={150} marginBottom={16} />
          </SkeletonPlaceholder>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderHeader()}
      {renderFilters()}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 1. HERO PERFORMANCE CARD */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <LinearGradient
            colors={["#FFFFFF", "#F3E8FF"]}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>Total Revenue</Text>
                <AnimatedCounter value={totalRevenue} prefix="₹" />
              </View>
              <View style={styles.heroSubStats}>
                <Text style={styles.heroSubLabel}>Tickets Sold</Text>
                <Text style={styles.heroSubValue}>{ticketsSold}</Text>
              </View>
            </View>

            <View style={styles.heroMetricsRow}>
              <Text style={styles.heroMetricBadge}>Interested: {interestedCount}</Text>
              <Text style={styles.heroMetricBadge}>Conversion: {conversionRate}%</Text>
            </View>

            {/* Revenue Trend Chart */}
            <View style={styles.heroChartContainer}>
              <Svg height="60" width="100%" preserveAspectRatio="none">
                <Polyline
                  points={trendPoints}
                  fill="none"
                  stroke={PRIMARY_COLOR}
                  strokeWidth="3"
                />
              </Svg>
            </View>

            <View style={styles.insightChip}>
              <TrendingUp size={14} color="#FFFFFF" />
              <Text style={styles.insightChipText}>Last 7 days revenue trend</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 2. DISCOVERY & REACH */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
          <Text style={styles.sectionHeader}>Discovery</Text>
          <View style={styles.discoveryGrid}>
            <View style={styles.discoveryItem}>
              <View style={[styles.iconContainer, { backgroundColor: "#E0F2FE" }]}>
                <Radio size={20} color="#0284C7" />
              </View>
              <Text style={styles.metricValue}>{interestedCount}</Text>
              <Text style={styles.metricLabel}>Interested</Text>
            </View>
            <View style={styles.discoveryItem}>
              <View style={[styles.iconContainer, { backgroundColor: "#FEF3C7" }]}>
                <Ticket size={20} color="#D97706" />
              </View>
              <Text style={styles.metricValue}>{ticketsSold}</Text>
              <Text style={styles.metricLabel}>Tickets Sold</Text>
            </View>
            <View style={styles.discoveryItem}>
              <View style={[styles.iconContainer, { backgroundColor: "#FCE7F3" }]}>
                <TrendingUp size={20} color="#DB2777" />
              </View>
              <Text style={styles.metricValue}>{conversionRate}%</Text>
              <Text style={styles.metricLabel}>Conversion</Text>
            </View>
          </View>
        </Animated.View>

        {/* 3. EVENT FUNNEL */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.card}>
          <Text style={styles.sectionHeader}>Event Funnel</Text>

          <View style={styles.funnelStep}>
            <Text style={styles.funnelLabel}>Interested</Text>
            <Text style={styles.funnelValue}>{interestedCount}</Text>
          </View>
          <View style={styles.funnelArrow}><ChevronDown size={16} color={MUTED_TEXT}/></View>

          <View style={styles.funnelStepPrimary}>
            <Text style={styles.funnelLabelPrimary}>Tickets Sold</Text>
            <Text style={styles.funnelValuePrimary}>{ticketsSold}</Text>
          </View>
        </Animated.View>

        {/* 4. ENGAGEMENT SIGNALS */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.card}>
          <Text style={styles.sectionHeader}>Engagement</Text>
          <View style={styles.engagementGrid}>
            <View style={styles.engagementCell}>
              <View style={[styles.iconContainer, { backgroundColor: "#FEE2E2" }]}>
                <Heart size={20} color="#DC2626" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Likes</Text>
                <Text style={styles.metricValue}>245</Text>
              </View>
            </View>
            <View style={styles.engagementCell}>
              <View style={[styles.iconContainer, { backgroundColor: "#E0E7FF" }]}>
                <MessageCircle size={20} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Comments</Text>
                <Text style={styles.metricValue}>34</Text>
              </View>
            </View>
            <View style={styles.engagementCell}>
              <View style={[styles.iconContainer, { backgroundColor: "#DCFCE7" }]}>
                <Share2 size={20} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Shares</Text>
                <Text style={styles.metricValue}>21</Text>
              </View>
            </View>
            <View style={styles.engagementCell}>
              <View style={[styles.iconContainer, { backgroundColor: "#FEF9C3" }]}>
                <Bookmark size={20} color="#CA8A04" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Saves</Text>
                <Text style={styles.metricValue}>132</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* 5. AUDIENCE INSIGHTS */}
        <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.cardRow}>
          <View style={[styles.card, { flex: 1, marginRight: 8, padding: 16 }]}>
            <Text style={styles.sectionHeaderSmall}>Gender Breakdown</Text>
            {genderPieData.length > 0 ? (
              <>
                <PieChart
                  style={{ height: 120, marginVertical: 16 }}
                  data={genderPieData}
                  innerRadius="60%"
                  padAngle={0.02}
                />
                <View style={styles.legendContainer}>
                  {genderPieData.map((d) => (
                    <View key={d.key} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: d.svg.fill }]} />
                      <Text style={styles.legendText}>{d.key} {d.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.metricLabel, { textAlign: "center", marginTop: 20 }]}>No data yet</Text>
            )}
          </View>

          <View style={[styles.card, { flex: 1, marginLeft: 8, padding: 16 }]}>
            <Text style={styles.sectionHeaderSmall}>Ticket Types</Text>
            {ticketPieData.length > 0 ? (
              <>
                <PieChart
                  style={{ height: 120, marginVertical: 16 }}
                  data={ticketPieData}
                  innerRadius="60%"
                  padAngle={0.02}
                />
                <View style={styles.legendContainer}>
                  {ticketPieData.map((d) => (
                    <View key={d.key} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: d.svg.fill }]} />
                      <Text style={styles.legendText}>{d.key} ×{d.value}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.metricLabel, { textAlign: "center", marginTop: 20 }]}>No data yet</Text>
            )}
          </View>
        </Animated.View>

        {/* 6. OFFERS USED */}
        {(insights?.offersUsed?.length ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.card}>
            <Text style={styles.sectionHeader}>Offers Used</Text>
            {insights.offersUsed.map((offer, idx) => (
              <View key={idx} style={styles.offerRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Tag size={16} color={MUTED_TEXT} />
                  <Text style={styles.offerName}>{offer.code}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.offerCount}>×{offer.timesUsed}</Text>
                  {offer.totalSaved > 0 && (
                    <Text style={[styles.metricLabel, { color: SUCCESS_COLOR }]}>₹{offer.totalSaved.toFixed(0)} saved</Text>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* 7. ATTENDEES LIST */}
        <Animated.View entering={FadeInDown.delay(700).springify()}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionHeader}>Attendees</Text>
            <View style={styles.attendeeCountChip}>
              <Text style={styles.attendeeCountChipText}>{filteredAttendees.length}</Text>
            </View>
          </View>

          {filteredAttendees.length === 0 ? (
            <View style={[styles.card, { alignItems: "center", paddingVertical: 32 }]}>
              <Users size={32} color={MUTED_TEXT} style={{ marginBottom: 8 }} />
              <Text style={[styles.metricLabel, { textAlign: "center" }]}>No attendees yet</Text>
            </View>
          ) : (
            filteredAttendees.map((att) => (
              <AttendeeListItem
                key={att.id + att.registered_at}
                attendee={att}
                onPress={(attendee) => navigation.navigate("MemberPublicProfile", { memberId: attendee.id })}
              />
            ))
          )}
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD_BACKGROUND,
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "BasicCommercialBlack",
    fontSize: 20,
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: BACKGROUND_COLOR,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  filterPillActive: {
    backgroundColor: TEXT_COLOR,
    borderColor: TEXT_COLOR,
  },
  filterText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: MUTED_TEXT,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cardRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: MUTED_TEXT,
    marginBottom: 8,
  },
  revenueText: {
    fontFamily: "BasicCommercialBold",
    fontSize: 36,
    color: TEXT_COLOR,
    lineHeight: 40,
  },
  heroSubStats: {
    alignItems: "flex-end",
  },
  heroSubLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: MUTED_TEXT,
    marginBottom: 4,
  },
  heroSubValue: {
    fontFamily: "BasicCommercialBold",
    fontSize: 24,
    color: PRIMARY_COLOR,
  },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  heroMetricBadge: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: TEXT_COLOR,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: "hidden",
  },
  heroChartContainer: {
    height: 60,
    marginTop: 24,
    marginBottom: 16,
  },
  insightChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEXT_COLOR,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  insightChipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#FFFFFF",
  },
  sectionHeader: {
    fontFamily: "BasicCommercialBold",
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 20,
  },
  sectionHeaderSmall: {
    fontFamily: "BasicCommercialBold",
    fontSize: 15,
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  discoveryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  discoveryItem: {
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  metricValue: {
    fontFamily: "BasicCommercialBold",
    fontSize: 18,
    color: TEXT_COLOR,
  },
  metricLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  funnelStep: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: BACKGROUND_COLOR,
    padding: 16,
    borderRadius: 12,
  },
  funnelArrow: {
    alignItems: "center",
    marginVertical: 4,
  },
  funnelLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: MUTED_TEXT,
  },
  funnelValue: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: TEXT_COLOR,
  },
  funnelStepPrimary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  funnelLabelPrimary: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  funnelValuePrimary: {
    fontFamily: "BasicCommercialBold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  engagementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  engagementCell: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: BACKGROUND_COLOR,
    padding: 12,
    borderRadius: 12,
  },
  legendContainer: {
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: MUTED_TEXT,
  },
  growthRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightChipOutline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightChipOutlineText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: SUCCESS_COLOR,
  },
  offerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BACKGROUND_COLOR,
  },
  offerName: {
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: TEXT_COLOR,
    marginLeft: 12,
  },
  offerCount: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: TEXT_COLOR,
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  attendeeCountChip: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 20, // Align with sectionHeader's bottom margin
  },
  attendeeCountChipText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  attendeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BACKGROUND,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  infoSection: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  attendeeName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: TEXT_COLOR,
  },
  genderBadge: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
  },
  ageBadge: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: MUTED_TEXT,
  },
  username: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  ticketsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  ticketBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  ticketText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: PRIMARY_COLOR,
  },
  registeredTime: {
    fontFamily: "Manrope-Regular",
    fontSize: 11,
    color: MUTED_TEXT,
    marginTop: 6,
  },
  viewAllBtn: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 4,
  },
  viewAllText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: PRIMARY_COLOR,
  },
});
