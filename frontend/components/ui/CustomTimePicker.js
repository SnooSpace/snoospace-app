import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Clock, X, Check } from "lucide-react-native";
import * as Haptics from "expo-haptics";

// Apple-Grade Theme Tokens
const BRAND = {
  primary: "#2B59FF",
  primaryGradient: ["#325FFB", "#234DEE"],
  selectionBg: "#EBF1FF",
  selectionBorder: "#DCE6FC",
  selectionDivider: "#D0DEFC",
  textActive: "#2552ED",
  textPrimary: "#111827",
  textMuted: "#94A3B8",
  borderLight: "#F1F5F9",
  background: "#FFFFFF",
};

const FONTS = {
  display: "BasicCommercialBold",
  bold: "Manrope-Bold",
  semibold: "Manrope-SemiBold",
  medium: "Manrope-Medium",
  regular: "Manrope-Regular",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 220px
const CAPSULE_HEIGHT = 48;

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) =>
  i.toString().padStart(2, "0")
);
const PERIODS = ["AM", "PM"];

const HOUR_ITEMS = HOURS.map((h) => ({ label: String(h), value: h }));
const MINUTE_ITEMS = MINUTES.map((m) => ({ label: m, value: m }));
const PERIOD_ITEMS = PERIODS.map((p) => ({ label: p, value: p }));

/**
 * 120fps Smooth Optical Wheel Item
 * Clean 2D scaling + opacity + color transition.
 * No vertical translation to ensure 100% horizontal alignment on baseline.
 */
const WheelItem = React.memo(({ item, index, scrollY, onPress }) => {
  const animatedTextStyle = useAnimatedStyle(() => {
    const itemOffset = index * ITEM_HEIGHT;
    const diff = (scrollY.value - itemOffset) / ITEM_HEIGHT;
    const absDiff = Math.abs(diff);

    // Continuous 2D optical depth curve
    const clampedDiff = Math.min(2.5, absDiff);
    const factor = Math.max(0, 1 - clampedDiff / 2.5); // 1 at center -> 0 at distance >= 2.5

    const scale = 0.68 + 0.32 * Math.pow(factor, 1.3);
    const opacity = 0.25 + 0.75 * factor;

    const color = interpolateColor(
      clampedDiff,
      [0, 0.5, 1.2],
      [BRAND.textActive, BRAND.textActive, BRAND.textMuted]
    );

    return {
      transform: [{ scale }],
      opacity,
      color,
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.wheelItem}
    >
      <Animated.Text style={[styles.wheelItemText, animatedTextStyle]}>
        {item.label}
      </Animated.Text>
    </TouchableOpacity>
  );
});

/**
 * High-Momentum Native Wheel with Direct Snapping & Zero Bounce
 */
const NativeWheel = React.memo(
  ({ items, selectedIndex, onSelect, width = 62 }) => {
    const scrollRef = useRef(null);
    const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);
    const lastHapticIdx = useSharedValue(selectedIndex);
    const isTapping = useSharedValue(false);
    const isDragging = useSharedValue(false);
    const isMomentum = useSharedValue(false);
    const itemCount = items.length;

    // Synchronize initial position and external time prop changes
    useEffect(() => {
      if (!isDragging.value && !isMomentum.value && !isTapping.value) {
        scrollY.value = selectedIndex * ITEM_HEIGHT;
        lastHapticIdx.value = selectedIndex;
        scrollRef.current?.scrollTo({
          y: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }
    }, [selectedIndex]);

    const triggerHaptic = useCallback(() => {
      try {
        Haptics.selectionAsync();
      } catch {}
    }, []);

    const handleCommit = useCallback(
      (idx) => {
        const bounded = Math.max(0, Math.min(itemCount - 1, idx));
        onSelect(items[bounded].value);
      },
      [items, itemCount, onSelect]
    );

    const scrollHandler = useAnimatedScrollHandler({
      onBeginDrag: () => {
        isDragging.value = true;
        isTapping.value = false;
        isMomentum.value = false;
      },
      onScroll: (e) => {
        scrollY.value = e.contentOffset.y;
        const idx = Math.round(e.contentOffset.y / ITEM_HEIGHT);

        if (isDragging.value && !isTapping.value) {
          if (idx !== lastHapticIdx.value && idx >= 0 && idx < itemCount) {
            lastHapticIdx.value = idx;
            runOnJS(triggerHaptic)();
          }
        }
      },
      onMomentumBegin: () => {
        isMomentum.value = true;
      },
      onEndDrag: (e) => {
        isDragging.value = false;
        if (!isMomentum.value) {
          const targetY = e.contentOffset.y;
          const idx = Math.max(
            0,
            Math.min(itemCount - 1, Math.round(targetY / ITEM_HEIGHT))
          );
          runOnJS(handleCommit)(idx);
        }
      },
      onMomentumEnd: (e) => {
        isDragging.value = false;
        isTapping.value = false;
        isMomentum.value = false;
        const targetY = e.contentOffset.y;
        const idx = Math.max(
          0,
          Math.min(itemCount - 1, Math.round(targetY / ITEM_HEIGHT))
        );
        runOnJS(handleCommit)(idx);
      },
    });

    const handleItemPress = useCallback(
      (index) => {
        isTapping.value = true;
        isDragging.value = false;
        isMomentum.value = false;
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}

        scrollRef.current?.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: true,
        });
        handleCommit(index);
      },
      [handleCommit]
    );

    return (
      <View style={{ width, height: WHEEL_HEIGHT }}>
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start" // Direct linear snap without secondary center bounce
          disableIntervalMomentum={false}
          decelerationRate="fast" // Crisp lock-in without bounce
          nestedScrollEnabled={true}
          bounces={false}
          overScrollMode="never"
          contentContainerStyle={styles.wheelContent}
        >
          {items.map((item, index) => (
            <WheelItem
              key={String(item.value)}
              item={item}
              index={index}
              scrollY={scrollY}
              onPress={() => handleItemPress(index)}
            />
          ))}
        </Animated.ScrollView>
      </View>
    );
  }
);

const CustomTimePicker = ({ visible, onClose, time, onChange, minTime }) => {
  const initialValues = useMemo(() => {
    const d = time || new Date();
    let h = d.getHours();
    const m = d.getMinutes();
    const p = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return {
      hour: h,
      minute: m.toString().padStart(2, "0"),
      period: p,
      hourIndex: Math.max(0, HOURS.indexOf(h)),
      minuteIndex: Math.max(0, Math.min(59, m)),
      periodIndex: p === "PM" ? 1 : 0,
    };
  }, [time]);

  const [selectedHour, setSelectedHour] = useState(initialValues.hour);
  const [selectedMinute, setSelectedMinute] = useState(initialValues.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(initialValues.period);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedHour(initialValues.hour);
      setSelectedMinute(initialValues.minute);
      setSelectedPeriod(initialValues.period);
      setShowError(false);
    }
  }, [visible, initialValues]);

  const hourIndex = useMemo(
    () => Math.max(0, HOURS.indexOf(selectedHour)),
    [selectedHour]
  );
  const minuteIndex = useMemo(
    () => Math.max(0, Math.min(59, parseInt(selectedMinute, 10))),
    [selectedMinute]
  );
  const periodIndex = useMemo(
    () => (selectedPeriod === "PM" ? 1 : 0),
    [selectedPeriod]
  );

  const handleSelectHour = useCallback((val) => {
    setSelectedHour(val);
  }, []);

  const handleSelectMinute = useCallback((val) => {
    setSelectedMinute(val);
  }, []);

  const handleSelectPeriod = useCallback((val) => {
    setSelectedPeriod(val);
  }, []);

  const handleConfirm = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (onChange) {
      const newTime = new Date(time || new Date());
      let h = selectedHour;
      if (selectedPeriod === "PM" && h !== 12) h += 12;
      if (selectedPeriod === "AM" && h === 12) h = 0;

      newTime.setHours(h);
      newTime.setMinutes(parseInt(selectedMinute, 10));
      newTime.setSeconds(0);
      newTime.setMilliseconds(0);

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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Backdrop tap to dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Floating Centered Card */}
        <View style={styles.dialogCard} pointerEvents="box-none">
          <View style={styles.cardInner}>
            {/* Header Row */}
            <View style={styles.header}>
              <Text style={styles.title}>Select time</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <X size={18} color={BRAND.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Subtle Divider Line */}
            <View style={styles.headerDivider} />

            {/* Wheels Container */}
            <View style={styles.wheelsContainer}>
              {/* Continuous Blue Selection Capsule Background */}
              <View style={styles.selectionCapsule} pointerEvents="none" />

              {/* Top Linear Gradient Vignette (Smooth Fade-in) */}
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.95)",
                  "rgba(255, 255, 255, 0.55)",
                  "rgba(255, 255, 255, 0)",
                ]}
                style={styles.topVignette}
                pointerEvents="none"
              />

              {/* Hours Wheel */}
              <NativeWheel
                items={HOUR_ITEMS}
                selectedIndex={hourIndex}
                onSelect={handleSelectHour}
                width={62}
              />

              {/* Separator Colon */}
              <View style={styles.colonCol} pointerEvents="none">
                <Text style={styles.colonText}>:</Text>
              </View>

              {/* Minutes Wheel */}
              <NativeWheel
                items={MINUTE_ITEMS}
                selectedIndex={minuteIndex}
                onSelect={handleSelectMinute}
                width={62}
              />

              {/* Flow-aligned Vertical Divider with Generous Spacing */}
              <View style={styles.dividerWrapper} pointerEvents="none">
                <View style={styles.capsuleDivider} />
              </View>

              {/* Period Wheel (AM / PM) */}
              <NativeWheel
                items={PERIOD_ITEMS}
                selectedIndex={periodIndex}
                onSelect={handleSelectPeriod}
                width={62}
              />

              {/* Bottom Linear Gradient Vignette (Smooth Fade-out) */}
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0)",
                  "rgba(255, 255, 255, 0.55)",
                  "rgba(255, 255, 255, 0.95)",
                ]}
                style={styles.bottomVignette}
                pointerEvents="none"
              />
            </View>

            {/* Confirm CTA Button */}
            <TouchableOpacity
              style={styles.confirmButtonContainer}
              onPress={handleConfirm}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={BRAND.primaryGradient}
                style={styles.confirmButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
                <Check
                  size={18}
                  color="#FFFFFF"
                  strokeWidth={2.8}
                  style={styles.confirmCheck}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Custom Error Modal Overlay */}
          {showError && (
            <View style={styles.errorOverlay}>
              <View style={styles.errorContainer}>
                <View style={styles.errorIconContainer}>
                  <Clock size={28} color={BRAND.primary} strokeWidth={2.2} />
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
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 324,
    position: "relative",
  },
  cardInner: {
    backgroundColor: BRAND.background,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 17,
    color: BRAND.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  headerDivider: {
    height: 1,
    backgroundColor: BRAND.borderLight,
    width: "100%",
    marginBottom: 8,
  },
  wheelsContainer: {
    flexDirection: "row",
    height: WHEEL_HEIGHT,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 20,
    overflow: "hidden",
  },
  selectionCapsule: {
    position: "absolute",
    height: CAPSULE_HEIGHT,
    left: 4,
    right: 4,
    top: (WHEEL_HEIGHT - CAPSULE_HEIGHT) / 2, // 86px
    backgroundColor: BRAND.selectionBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.selectionBorder,
    zIndex: 0,
  },
  topVignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 42,
    zIndex: 10,
  },
  bottomVignette: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 42,
    zIndex: 10,
  },
  dividerWrapper: {
    width: 20,
    height: WHEEL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  capsuleDivider: {
    width: 1.5,
    height: 26,
    backgroundColor: BRAND.selectionDivider,
    borderRadius: 1,
  },
  colonCol: {
    width: 14,
    height: WHEEL_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  colonText: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: BRAND.textActive,
    lineHeight: 28,
    textAlign: "center",
  },
  wheelContent: {
    paddingTop: ITEM_HEIGHT * 2,
    paddingBottom: ITEM_HEIGHT * 2,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  wheelItemText: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  confirmButtonContainer: {
    width: "100%",
  },
  confirmButton: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  confirmCheck: {
    marginLeft: 6,
  },
  // Error Modal Styles
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 20,
    borderRadius: 24,
  },
  errorContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  errorIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND.selectionBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  errorTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 17,
    color: BRAND.textPrimary,
    marginBottom: 4,
    textAlign: "center",
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: BRAND.textMuted,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  errorConfirmButton: {
    width: "100%",
    marginBottom: 8,
  },
  gradientButton: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BRAND.primary,
  },
  errorConfirmButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  errorCancelButton: {
    paddingVertical: 8,
  },
  errorCancelButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: BRAND.textMuted,
  },
});

export default CustomTimePicker;