import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

// Brand System Colors - Strictly Enforced
const BRAND = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  surface: "#F5F8FF",
  border: "#E6ECF8",
  textPrimary: "#111827",
  textMuted: "#6B7280",
  background: "#FFFFFF",
};

const FONTS = {
  regular: "Manrope-Regular",
  medium: "Manrope-Medium",
  semibold: "Manrope-SemiBold",
};

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 3; // Number of items visible at once
const PADDING_Vertical = ((VISIBLE_ITEMS - 1) * ITEM_HEIGHT) / 2;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const PERIODS = ["AM", "PM"];

const CustomTimePicker = ({ visible, onClose, time, onChange }) => {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState("AM");

  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const periodRef = useRef(null);

  // Initialize state from props & Scroll to position
  useEffect(() => {
    if (visible && time) {
      let h = time.getHours();
      const m = time.getMinutes();
      const p = h >= 12 ? "PM" : "AM";

      h = h % 12;
      h = h ? h : 12; // 0 should be 12

      setSelectedHour(h);
      setSelectedMinute(m.toString().padStart(2, "0"));
      setSelectedPeriod(p);

      // Scroll to position after short delay to allow layout
      setTimeout(() => {
        if (hoursRef.current) {
          const hourIndex = HOURS.indexOf(h);
          if (hourIndex !== -1) {
            hoursRef.current.scrollTo({
              y: hourIndex * ITEM_HEIGHT,
              animated: false,
            });
          }
        }
        if (minutesRef.current) {
          const minuteIndex = MINUTES.indexOf(m.toString().padStart(2, "0"));
          if (minuteIndex !== -1) {
            minutesRef.current.scrollTo({
              y: minuteIndex * ITEM_HEIGHT,
              animated: false,
            });
          }
        }
        if (periodRef.current) {
          const periodIndex = PERIODS.indexOf(p);
          if (periodIndex !== -1) {
            periodRef.current.scrollTo({
              y: periodIndex * ITEM_HEIGHT,
              animated: false,
            });
          }
        }
      }, 100);
    }
  }, [visible, time]);

  const handleConfirm = () => {
    if (onChange) {
      const newTime = new Date(time || new Date());
      let h = selectedHour;
      if (selectedPeriod === "PM" && h !== 12) h += 12;
      if (selectedPeriod === "AM" && h === 12) h = 0;

      newTime.setHours(h);
      newTime.setMinutes(parseInt(selectedMinute, 10));
      onChange(newTime);
    }
    onClose();
  };

  const renderItem = ({ item, index, type, selectedValue }) => {
    const isSelected = item === selectedValue;
    return (
      <View style={[styles.wheelItem, { height: ITEM_HEIGHT }]}>
        <Text
          style={[styles.wheelText, isSelected && styles.wheelTextSelected]}
        >
          {item}
        </Text>
      </View>
    );
  };

  const getItemLayout = (_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  // Calculate generic initial scroll index helper
  // This is a simplified version. For a robust production app,
  // you might want to wait for onLayout or use `initialScrollIndex`.

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Time</Text>
          </View>

          {/* Wheels Container */}
          <View style={styles.wheelsContainer}>
            {/* Selection Highlight (Background) */}
            <View style={styles.selectionOverlay} pointerEvents="none" />

            {/* Hours */}
            <View style={styles.column}>
              <ScrollView
                ref={hoursRef}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingVertical: (150 - ITEM_HEIGHT) / 2,
                }}
                onMomentumScrollEnd={(ev) => {
                  const index = Math.round(
                    ev.nativeEvent.contentOffset.y / ITEM_HEIGHT,
                  );
                  const val = HOURS[index];
                  if (val !== undefined) setSelectedHour(val);
                }}
              >
                {HOURS.map((item, index) =>
                  renderItem({
                    item,
                    index,
                    type: "hour",
                    selectedValue: selectedHour,
                  }),
                )}
              </ScrollView>
            </View>

            {/* Minutes */}
            <View style={styles.column}>
              <ScrollView
                ref={minutesRef}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingVertical: (150 - ITEM_HEIGHT) / 2,
                }}
                onMomentumScrollEnd={(ev) => {
                  const index = Math.round(
                    ev.nativeEvent.contentOffset.y / ITEM_HEIGHT,
                  );
                  const val = MINUTES[index];
                  if (val !== undefined) setSelectedMinute(val);
                }}
              >
                {MINUTES.map((item, index) =>
                  renderItem({
                    item,
                    index,
                    type: "minute",
                    selectedValue: selectedMinute,
                  }),
                )}
              </ScrollView>
            </View>

            {/* Period */}
            <View style={styles.column}>
              <ScrollView
                ref={periodRef}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingVertical: (150 - ITEM_HEIGHT) / 2,
                }}
                onMomentumScrollEnd={(ev) => {
                  const index = Math.round(
                    ev.nativeEvent.contentOffset.y / ITEM_HEIGHT,
                  );
                  const val = PERIODS[index];
                  if (val !== undefined) setSelectedPeriod(val);
                }}
              >
                {PERIODS.map((item, index) =>
                  renderItem({
                    item,
                    index,
                    type: "period",
                    selectedValue: selectedPeriod,
                  }),
                )}
              </ScrollView>
            </View>
          </View>

          {/* Confirm Button */}
          <View style={styles.confirmButtonContainer}>
            <TouchableOpacity onPress={handleConfirm}>
              <LinearGradient
                colors={BRAND.primaryGradient}
                style={styles.confirmButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmButtonText}>Confirm Time</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: BRAND.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    width: "100%",
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 18,
    color: BRAND.textPrimary,
  },
  wheelsContainer: {
    flexDirection: "row",
    height: 150,
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  selectionOverlay: {
    position: "absolute",
    height: ITEM_HEIGHT,
    width: "100%",
    top: (150 - ITEM_HEIGHT) / 2,
    backgroundColor: BRAND.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
    zIndex: -1,
  },
  column: {
    flex: 1,
    height: 150,
    alignItems: "center",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  wheelText: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    color: BRAND.textMuted,
    opacity: 0.4,
    textAlign: "center",
    textAlignVertical: "center",
  },
  wheelTextSelected: {
    fontFamily: FONTS.semibold,
    fontSize: 22,
    color: BRAND.textPrimary,
    opacity: 1,
  },
  confirmButtonContainer: {
    width: "100%",
  },
  confirmButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  confirmButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default CustomTimePicker;
