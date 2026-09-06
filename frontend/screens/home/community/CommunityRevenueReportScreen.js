/**
 * CommunityRevenueReportScreen.js
 *
 * Full revenue report screen for community dashboard.
 * Reached via navigation.navigate("CommunityRevenueReport", { period })
 * from the "View full revenue report" link on CommunityDashboardScreen.
 *
 * Sections:
 *  1. Header + GlassBackButton + inline period picker
 *  2. Summary stats grid with % change vs previous period
 *  3. Revenue-over-time CartesianChart (victory-native)
 *  4. Per-event FlatList table
 *  5. Refunds summary card
 *  6. Discount performance list
 *  7. Repeat buyers stat card
 *  8. Failed payments footnote
 *  9. Payouts coming soon card
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CartesianChart, Area, Line } from "victory-native";
import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  TrendingUp,
  TrendingDown,
  Tag,
  RotateCcw,
  Users,
  AlertTriangle,
  Wallet,
  Clock,
} from "lucide-react-native";

import { COLORS, FONTS } from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import InsightCard from "../../../components/insights/InsightCard";
import StatGrid from "../../../components/insights/StatGrid";
import { getCommunityRevenueReport } from "../../../api/events";

// ── Constants ─────────────────────────────────────────────────────────────────
const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_W = SCREEN_WIDTH - 32 - 28;

const PERIOD_OPTIONS = [
  { label: "Last 7 days",   value: "7d"  },
  { label: "Last 15 days",  value: "15d" },
  { label: "Last 30 days",  value: "30d" },
  { label: "Last 3 months", value: "90d" },
  { label: "All time",      value: "all" },
];
const PERIOD_LABELS = {
  "7d":  "Last 7 days",
  "15d": "Last 15 days",
  "30d": "Last 30 days",
  "90d": "Last 3 months",
  "all": "All time",
};

const ACCENT  = "#2563EB";
const SUCCESS = "#10B981";
const DANGER  = "#EF4444";
const MUTED   = "#9CA3AF";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatINR = (n) => {
  if (n == null) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  return Math.round(n).toLocaleString("en-IN");
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SellThroughBadge = ({ rate }) => {
  if (rate == null) {
    return <Text style={styles.sellThroughUnlimited}>Unlimited</Text>;
  }
  const color = rate >= 75 ? SUCCESS : rate >= 40 ? "#F59E0B" : MUTED;
  return (
    <View style={[styles.sellThroughBadge, { borderColor: color + "44" }]}>
      <Text style={[styles.sellThroughText, { color }]}>{rate}%</Text>
    </View>
  );
};

const RevenueChart = ({ timeseries }) => {
  if (!timeseries || timeseries.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Not enough data for this period</Text>
      </View>
    );
  }
  const data = timeseries.map((d, i) => ({ idx: i, revenue: d.revenue }));
  return (
    <CartesianChart
      data={data}
      xKey="idx"
      yKeys={["revenue"]}
      width={CHART_W}
      height={160}
      domainPadding={{ left: 8, right: 8, top: 12 }}
      axisOptions={{ font: null, labelColor: MUTED, lineColor: "#F3F4F6", tickCount: 4 }}
    >
      {({ points, chartBounds }) => (
        <>
          <Area points={points.revenue} y0={chartBounds.bottom} color={ACCENT} opacity={0.12} curveType="monotoneX" />
          <Line points={points.revenue} color={ACCENT} strokeWidth={2} curveType="monotoneX" />
        </>
      )}
    </CartesianChart>
  );
};

const EventRow = ({ item, isLast }) => (
  <View style={[styles.eventRow, isLast && styles.eventRowLast]}>
    <View style={styles.eventRowHeader}>
      <Text style={styles.eventRowName} numberOfLines={1}>{item.eventName}</Text>
      <SellThroughBadge rate={item.sellThroughRate} />
    </View>
    <View style={styles.eventRowStats}>
      <View style={styles.eventRowStat}>
        <Text style={styles.eventRowStatLabel}>TICKETS</Text>
        <Text style={styles.eventRowStatValue}>{item.ticketsSold}</Text>
      </View>
      <View style={styles.eventRowStat}>
        <Text style={styles.eventRowStatLabel}>GROSS</Text>
        <Text style={styles.eventRowStatValue}>{"₹" + formatINR(item.grossRevenue)}</Text>
      </View>
      <View style={styles.eventRowStat}>
        <Text style={styles.eventRowStatLabel}>DISCOUNTS</Text>
        <Text style={[styles.eventRowStatValue, item.discountAmount > 0 && { color: "#F59E0B" }]}>
          {item.discountAmount > 0 ? ("-₹" + formatINR(item.discountAmount)) : "—"}
        </Text>
      </View>
      <View style={styles.eventRowStat}>
        <Text style={styles.eventRowStatLabel}>NET</Text>
        <Text style={[styles.eventRowStatValue, { color: ACCENT }]}>{"₹" + formatINR(item.netRevenue)}</Text>
      </View>
    </View>
    {item.refundCount > 0 && (
      <View style={styles.eventRowRefund}>
        <RotateCcw size={11} color={DANGER} />
        <Text style={styles.eventRowRefundText}>
          {item.refundCount + " refund" + (item.refundCount > 1 ? "s" : "") + " · ₹" + formatINR(item.refundAmount)}
        </Text>
      </View>
    )}
  </View>
);

const DiscountRow = ({ item, isLast }) => (
  <View style={[styles.discountRow, isLast && styles.discountRowLast]}>
    <View style={styles.discountLeft}>
      <Tag size={13} color={ACCENT} />
      <Text style={styles.discountCode}>{item.code}</Text>
      <View style={styles.discountTypePill}>
        <Text style={styles.discountTypePillText}>
          {item.discountType === "percentage" ? (item.discountValue + "%") : ("₹" + item.discountValue)}
        </Text>
      </View>
    </View>
    <View style={styles.discountRight}>
      <Text style={styles.discountUsed}>{item.timesUsed + "×"}</Text>
      <Text style={styles.discountSaved}>{"₹" + formatINR(item.totalSaved) + " saved"}</Text>
    </View>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CommunityRevenueReportScreen({ navigation, route }) {
  const initialPeriod = route.params?.period || "30d";

  const [period, setPeriod]             = useState(initialPeriod);
  const [showDropdown, setShowDropdown] = useState(false);
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState(null);

  const load = useCallback(async (p, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const res = await getCommunityRevenueReport(p);
      if (res && res.success) {
        setData(res);
      } else {
        setError("Failed to load report. Pull to refresh.");
      }
    } catch (err) {
      console.error("[RevenueReport] load error:", err);
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period]);

  const onRefresh = () => { setRefreshing(true); load(period, true); };

  const selectPeriod = (value) => {
    setShowDropdown(false);
    if (value !== period) setPeriod(value);
  };

  const buildStats = () => {
    if (!data || !data.summary) return [];
    const s = data.summary;
    const fmtPct = (pct, positive) => {
      if (pct == null) return { sub: "vs prev. period", subColor: MUTED };
      const up = pct >= 0;
      return { sub: (up ? "+" : "") + pct + "% vs prev.", subColor: up ? SUCCESS : DANGER };
    };
    const revPct  = fmtPct(s.revenuePctChange);
    const tickPct = fmtPct(s.ticketsPctChange);
    return [
      { label: "Total Revenue",  value: "₹" + formatINR(s.totalRevenue),  sub: revPct.sub,  subColor: revPct.subColor  },
      { label: "Tickets Sold",   value: s.ticketsSold ?? "—",              sub: tickPct.sub, subColor: tickPct.subColor },
      { label: "Avg Price",      value: s.avgPrice ? "₹" + formatINR(s.avgPrice) : "—", sub: "net, post-discount" },
      { label: "Active Events",  value: s.activeEventsCount ?? "—",        sub: "upcoming events" },
    ];
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            HapticsService.triggerBack?.();
            navigation.goBack();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <ArrowLeft size={22} color="#111827" strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue Report</Text>
        <TouchableOpacity
          style={[styles.periodPill, showDropdown && styles.periodPillOpen]}
          onPress={() => setShowDropdown((v) => !v)}
        >
          <Text style={styles.periodPillText}>{PERIOD_LABELS[period]}</Text>
          <ChevronDown size={13} color={MUTED} />
        </TouchableOpacity>
      </View>

      {/* Period dropdown — absolute overlay with tap-outside dismiss */}
      {showDropdown && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowDropdown(false)}
          />
          <View style={styles.dropdown}>
            {PERIOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dropdownItem, period === opt.value && styles.dropdownItemActive]}
                onPress={() => selectPeriod(opt.value)}
              >
                <Text style={[styles.dropdownText, period === opt.value && styles.dropdownTextActive]}>{opt.label}</Text>
                {period === opt.value && <CircleCheck size={13} color={ACCENT} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Loading / Error / Content */}
      {loading && !data ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.centeredStateText}>Loading report…</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredState}>
          <AlertTriangle size={32} color={MUTED} />
          <Text style={styles.centeredStateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(period)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => { if (showDropdown) setShowDropdown(false); }}
        >
          {/* 1. Summary */}
          <InsightCard title="Summary" subtitle={PERIOD_LABELS[period] + " vs previous period"}>
            <StatGrid stats={buildStats()} />
          </InsightCard>

          {/* 2. Revenue chart */}
          <InsightCard
            title="Revenue over time"
            subtitle={period === "all" ? "Monthly · last 12 months" : "Daily"}
          >
            <RevenueChart timeseries={data && data.timeseries} />
          </InsightCard>

          {/* 3. Per-event table */}
          <InsightCard title="By event" subtitle="Gross → discounts → net · sell-through where capacity is known">
            {data && data.perEvent && data.perEvent.length > 0 ? (
              <View>
                {data.perEvent.map((item, i) => (
                  <EventRow key={item.eventId} item={item} isLast={i === data.perEvent.length - 1} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyStateText}>No events found for this period.</Text>
            )}
          </InsightCard>

          {/* 4. Refunds summary */}
          <InsightCard title="Refunds">
            {data && data.refundsSummary && data.refundsSummary.count > 0 ? (
              <View style={styles.refundsRow}>
                <View style={styles.refundsStat}>
                  <Text style={styles.refundsValue}>{data.refundsSummary.count}</Text>
                  <Text style={styles.refundsLabel}>REFUNDS ISSUED</Text>
                </View>
                <View style={styles.refundsDivider} />
                <View style={styles.refundsStat}>
                  <Text style={[styles.refundsValue, { color: DANGER }]}>{"₹" + formatINR(data.refundsSummary.amount)}</Text>
                  <Text style={styles.refundsLabel}>TOTAL REFUNDED</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyStateText}>No refunds in this period.</Text>
            )}
          </InsightCard>

          {/* 5. Discount performance */}
          <InsightCard title="Discount codes" subtitle="Codes redeemed during this period">
            {data && data.discountPerformance && data.discountPerformance.length > 0 ? (
              <View>
                {data.discountPerformance.map((item, i) => (
                  <DiscountRow key={item.code + i} item={item} isLast={i === data.discountPerformance.length - 1} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Tag size={20} color={MUTED} />
                <Text style={styles.emptyStateText}>No discount codes used this period.</Text>
              </View>
            )}
          </InsightCard>

          {/* 6. Repeat buyers */}
          <InsightCard title="Repeat buyers">
            <View style={styles.repeatRow}>
              <View style={styles.repeatIcon}>
                <Users size={20} color={ACCENT} />
              </View>
              <Text style={styles.repeatText}>
                <Text style={styles.repeatCount}>{(data && data.repeatBuyers && data.repeatBuyers.count) ?? "—"}</Text>
                {" member" + ((data && data.repeatBuyers && data.repeatBuyers.count) !== 1 ? "s" : "") + " bought tickets to more than one event this period."}
              </Text>
            </View>
          </InsightCard>

          {/* 7. Failed payments footnote — only shown when > 0 */}
          {data && data.failedPayments && data.failedPayments.count > 0 && (
            <View style={styles.failedRow}>
              <AlertTriangle size={13} color={MUTED} />
              <Text style={styles.failedText}>
                {data.failedPayments.count + " failed payment attempt" + (data.failedPayments.count !== 1 ? "s" : "") + " recorded this period."}
              </Text>
            </View>
          )}

          {/* 8. Payouts — coming soon */}
          <InsightCard title="Payouts" style={styles.payoutsCard}>
            <View style={styles.payoutsRow}>
              <View style={styles.payoutsIcon}>
                <Wallet size={20} color={MUTED} />
              </View>
              <View style={styles.payoutsContent}>
                <Text style={styles.payoutsTitle}>Payout history</Text>
                <Text style={styles.payoutsSub}>Detailed payout ledger is being built. Settlement reports will appear here.</Text>
              </View>
              <View style={styles.payoutsComingSoon}>
                <Clock size={12} color={MUTED} />
                <Text style={styles.payoutsComingSoonText}>Soon</Text>
              </View>
            </View>
          </InsightCard>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: "#FFFFFF" },
  header:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  backButton:       { padding: 4, marginRight: 8, alignItems: "center", justifyContent: "center" },
  headerTitle:      { flex: 1, fontFamily: FONTS.primary, fontSize: 18, color: "#111827" },
  periodPill:       { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: "#E5E7EB" },
  periodPillOpen:   { backgroundColor: "#E8EFFE", borderColor: "#C7D9FB" },
  periodPillText:   { fontFamily: FONTS.medium, fontSize: 12, color: "#374151" },
  dropdown:         { position: "absolute", top: 58, right: 16, backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 6, minWidth: 158, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 10, zIndex: 999, borderWidth: 1, borderColor: "#EEEEEE" },
  dropdownItem:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 16 },
  dropdownItemActive:{ backgroundColor: "rgba(37,99,235,0.05)" },
  dropdownText:     { fontFamily: FONTS.medium, fontSize: 13, color: "#374151" },
  dropdownTextActive:{ fontFamily: FONTS.semiBold, color: ACCENT },
  scroll:           { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent:    { padding: 16, paddingBottom: 32 },
  centeredState:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32, backgroundColor: "#F9FAFB" },
  centeredStateText:{ fontFamily: FONTS.regular, fontSize: 14, color: MUTED, textAlign: "center" },
  retryBtn:         { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: ACCENT, borderRadius: 20 },
  retryBtnText:     { fontFamily: FONTS.semiBold, fontSize: 14, color: "#FFFFFF" },
  chartEmpty:       { height: 80, alignItems: "center", justifyContent: "center" },
  chartEmptyText:   { fontFamily: FONTS.regular, fontSize: 13, color: MUTED },
  eventRow:         { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  eventRowLast:     { borderBottomWidth: 0 },
  eventRowHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  eventRowName:     { flex: 1, fontFamily: FONTS.semiBold, fontSize: 14, color: "#111827", marginRight: 8 },
  eventRowStats:    { flexDirection: "row" },
  eventRowStat:     { flex: 1 },
  eventRowStatLabel:{ fontFamily: FONTS.medium, fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  eventRowStatValue:{ fontFamily: FONTS.semiBold, fontSize: 13, color: "#111827" },
  eventRowRefund:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  eventRowRefundText:{ fontFamily: FONTS.medium, fontSize: 11, color: DANGER },
  sellThroughBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  sellThroughText:  { fontFamily: FONTS.semiBold, fontSize: 11 },
  sellThroughUnlimited:{ fontFamily: FONTS.medium, fontSize: 11, color: MUTED, fontStyle: "italic" },
  refundsRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 8 },
  refundsStat:      { alignItems: "center" },
  refundsValue:     { fontFamily: FONTS.semiBold, fontSize: 22, color: "#111827", marginBottom: 2 },
  refundsLabel:     { fontFamily: FONTS.medium, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  refundsDivider:   { width: 1, height: 40, backgroundColor: "#EEEEEE" },
  discountRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  discountRowLast:  { borderBottomWidth: 0 },
  discountLeft:     { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  discountCode:     { fontFamily: FONTS.semiBold, fontSize: 13, color: "#111827" },
  discountTypePill: { backgroundColor: "#EFF6FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  discountTypePillText:{ fontFamily: FONTS.medium, fontSize: 11, color: ACCENT },
  discountRight:    { alignItems: "flex-end", gap: 2 },
  discountUsed:     { fontFamily: FONTS.semiBold, fontSize: 13, color: "#111827" },
  discountSaved:    { fontFamily: FONTS.regular, fontSize: 11, color: SUCCESS },
  emptyState:       { alignItems: "center", paddingVertical: 16, gap: 6 },
  emptyStateText:   { fontFamily: FONTS.regular, fontSize: 13, color: MUTED, textAlign: "center", paddingVertical: 8 },
  repeatRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  repeatIcon:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  repeatText:       { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: "#374151", lineHeight: 20 },
  repeatCount:      { fontFamily: FONTS.semiBold, fontSize: 15, color: "#111827" },
  failedRow:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, paddingBottom: 8 },
  failedText:       { fontFamily: FONTS.regular, fontSize: 12, color: MUTED },
  payoutsCard:      { opacity: 0.75 },
  payoutsRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  payoutsIcon:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  payoutsContent:   { flex: 1 },
  payoutsTitle:     { fontFamily: FONTS.semiBold, fontSize: 13, color: "#374151", marginBottom: 2 },
  payoutsSub:       { fontFamily: FONTS.regular, fontSize: 12, color: MUTED, lineHeight: 17 },
  payoutsComingSoon:{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  payoutsComingSoonText:{ fontFamily: FONTS.medium, fontSize: 11, color: MUTED },
  bottomSpacer:     { height: 40 },
});
