import React, { useState, useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { Clock } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

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

const CustomTimePicker = ({ visible, onClose, time, onChange, minTime }) => {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState("AM");
  const [showError, setShowError] = useState(false);

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
            hoursRef.current.scrollToIndex({
              index: hourIndex,
              animated: false,
            });
          }
        }
        if (minutesRef.current) {
          const minuteIndex = MINUTES.indexOf(m.toString().padStart(2, "0"));
          if (minuteIndex !== -1) {
            minutesRef.current.scrollToIndex({
              index: minuteIndex,
              animated: false,
            });
          }
        }
        if (periodRef.current) {
          const periodIndex = PERIODS.indexOf(p);
          if (periodIndex !== -1) {
            periodRef.current.scrollToIndex({
              index: periodIndex,
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

      // Validation
      if (minTime && newTime < minTime) {
        setShowError(true);
        return;
      }

      onChange(newTime);
    }
    onClose();
  };

  const handleAutoCorrect = () => {
    if (onChange && minTime) {
      onChange(minTime);
      setShowError(false);
      onClose();
    }
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
              <FlatList
                ref={hoursRef}
                data={HOURS}
                keyExtractor={(item) => `h-${item}`}
                renderItem={({ item, index }) =>
                  renderItem({
                    item,
                    index,
                    type: "hour",
                    selectedValue: selectedHour,
                  })
                }
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                style={{ width: "100%" }}
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
                getItemLayout={getItemLayout}
              />
            </View>

            {/* Minutes */}
            <View style={styles.column}>
              <FlatList
                ref={minutesRef}
                data={MINUTES}
                keyExtractor={(item) => `m-${item}`}
                renderItem={({ item, index }) =>
                  renderItem({
                    item,
                    index,
                    type: "minute",
                    selectedValue: selectedMinute,
                  })
                }
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                style={{ width: "100%" }}
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
                getItemLayout={getItemLayout}
              />
            </View>

            {/* Period */}
            <View style={styles.column}>
              <FlatList
                ref={periodRef}
                data={PERIODS}
                keyExtractor={(item) => `p-${item}`}
                renderItem={({ item, index }) =>
                  renderItem({
                    item,
                    index,
                    type: "period",
                    selectedValue: selectedPeriod,
                  })
                }
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                style={{ width: "100%" }}
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
                getItemLayout={getItemLayout}
              />
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

        {/* Custom Error Modal Overlay */}
        {showError && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorContainer}>
              <View style={styles.errorIconContainer}>
                <Clock size={32} color={BRAND.primary} />
              </View>
              <Text style={styles.errorTitle}>Invalid Time</Text>
              <Text style={styles.errorText}>
                The selected time is in the past. We've adjusted it for you.
              </Text>

              <TouchableOpacity
                style={styles.errorConfirmButton}
                onPress={handleAutoCorrect}
              >
                <LinearGradient
                  colors={BRAND.primaryGradient}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.errorConfirmButtonText}>
                    Use Earliest Available Time
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.errorCancelButton}
                onPress={() => setShowError(false)}
              >
                <Text style={styles.errorCancelButtonText}>
                  Select Another Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  // Error Modal Styles
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 24,
  },
  errorContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BRAND.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 20,
    color: BRAND.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: BRAND.textMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  errorConfirmButton: {
    width: "100%",
    marginBottom: 12,
  },
  gradientButton: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  errorConfirmButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  errorCancelButton: {
    paddingVertical: 12,
  },
  errorCancelButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: BRAND.textMuted,
  },
});

export default CustomTimePicker;
