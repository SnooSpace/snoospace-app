/**
 * ViewInsightsSheet
 *
 * A reusable animated bottom-sheet modal that shows Unique viewers and
 * Total impressions for any post. Wire it to any card's view-count button.
 *
 * Usage:
 *   const { visible, open, close, stats, loading, sheetAnim } = useViewInsights(post);
 *   <ViewInsightsSheet visible={visible} onClose={close} stats={stats} loading={loading} sheetAnim={sheetAnim} />
 */
import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from "react-native";
import {
  ChartNoAxesCombined,
  X,
  Users,
  RefreshCw,
} from "lucide-react-native";

const formatCount = (n) => {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const ViewInsightsSheet = ({ visible, onClose, stats, loading, sheetAnim }) => {
  const translateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={viewStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[viewStyles.sheet, { transform: [{ translateY }] }]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={viewStyles.handle} />
            <View style={viewStyles.header}>
              <View style={viewStyles.headerLeft}>
                <ChartNoAxesCombined size={18} color="#3565F2" strokeWidth={2} />
                <Text style={viewStyles.headerTitle}>View Insights</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <X size={18} color="#8FA1B8" strokeWidth={2} />
              </Pressable>
            </View>

            {loading ? (
              <View style={viewStyles.loadingRow}>
                <Text style={viewStyles.loadingText}>Loading…</Text>
              </View>
            ) : (
              <>
                <View style={viewStyles.statRow}>
                  <View
                    style={[
                      viewStyles.statIconBox,
                      { backgroundColor: "rgba(53,101,242,0.10)" },
                    ]}
                  >
                    <Users size={18} color="#3565F2" strokeWidth={2} />
                  </View>
                  <View style={viewStyles.statTextCol}>
                    <Text style={viewStyles.statValue}>
                      {formatCount(stats?.unique_views ?? 0)}
                    </Text>
                    <Text style={viewStyles.statLabel}>Unique viewers</Text>
                  </View>
                </View>

                <View style={viewStyles.statRow}>
                  <View
                    style={[
                      viewStyles.statIconBox,
                      { backgroundColor: "rgba(108,77,246,0.10)" },
                    ]}
                  >
                    <RefreshCw size={18} color="#6C4DF6" strokeWidth={2} />
                  </View>
                  <View style={viewStyles.statTextCol}>
                    <Text style={viewStyles.statValue}>
                      {formatCount(stats?.total_views ?? 0)}
                    </Text>
                    <Text style={viewStyles.statLabel}>Total impressions</Text>
                  </View>
                </View>

                <View style={viewStyles.explainerBox}>
                  <Text style={viewStyles.explainerText}>
                    Unique viewers are people who saw this post for the first
                    time. Total impressions include everyone who revisited.
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const viewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 17,
    color: "#1F3A5F",
  },
  loadingRow: {
    paddingVertical: 32,
    alignItems: "center",
  },
  loadingText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#8FA1B8",
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F4F8",
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  statTextCol: {
    flex: 1,
  },
  statValue: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#1F3A5F",
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#8FA1B8",
    marginTop: 2,
  },
  explainerBox: {
    marginTop: 16,
    backgroundColor: "#F7F9FC",
    borderRadius: 12,
    padding: 14,
  },
  explainerText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#8FA1B8",
    lineHeight: 18,
  },
});

export default ViewInsightsSheet;
