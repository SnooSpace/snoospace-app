import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

// ─── Brand Tokens ────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  rangeHighlight: "#EAF0FF",
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

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * CustomDatePicker — Intent-based single/range date picker.
 *
 * Props:
 *   visible: boolean
 *   onClose: () => void
 *   startDate?: Date            — currently selected start (or single) date
 *   endDate?: Date | null       — currently selected end date (null for single)
 *   onConfirm: ({ startDate: Date, endDate: Date | null }) => void
 *   minDate?: Date              — defaults to today
 *   maxDate?: Date              — defaults to today + 1 year
 *   disabledDates?: Date[]
 *
 * Selection model (intent-based, no forced range mode):
 *   CASE 1 — Nothing selected → tap sets startDate (single mode)
 *   CASE 2 — Single selected:
 *     • tap same date → no-op
 *     • tap later date → becomes endDate (range mode), if no disabled dates in between
 *     • tap earlier date → resets startDate (stays single)
 *   CASE 3 — Range selected → any tap resets to new single startDate
 */
const CustomDatePicker = ({
  visible,
  onClose,
  startDate: propStartDate,
  endDate: propEndDate,
  onConfirm,
  minDate,
  maxDate,
  disabledDates = [],
}) => {
  // ─── Internal State ──────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(propStartDate || new Date());
  const [internalStart, setInternalStart] = useState(propStartDate || null);
  const [internalEnd, setInternalEnd] = useState(propEndDate || null);
  // "none" | "single" | "range"
  const [selectionMode, setSelectionMode] = useState(
    propStartDate ? (propEndDate ? "range" : "single") : "none",
  );

  // ─── Sync from props on open ─────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      const s = propStartDate || null;
      const e = propEndDate || null;
      setInternalStart(s);
      setInternalEnd(e);
      setSelectionMode(s ? (e ? "range" : "single") : "none");
      setCurrentMonth(s || new Date());
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Constraint Bounds ───────────────────────────────────────────────────
  const effectiveMinDate = useMemo(() => {
    const d = minDate ? new Date(minDate) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);

  const effectiveMaxDate = useMemo(() => {
    const d = maxDate ? new Date(maxDate) : new Date();
    if (!maxDate) d.setFullYear(d.getFullYear() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [maxDate]);

  // ─── Pure Helpers ────────────────────────────────────────────────────────

  /** Normalize to midnight, timezone-safe, non-mutating */
  const normalize = useCallback((d) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
  }, []);

  const isSameDay = useCallback((d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }, []);

  const isToday = useCallback((d) => isSameDay(d, new Date()), [isSameDay]);

  const isDateDisabled = useCallback(
    (day) => {
      if (!day) return true;
      const d = normalize(day);
      if (d < effectiveMinDate) return true;
      if (d > effectiveMaxDate) return true;
      if (disabledDates.some((dd) => isSameDay(d, normalize(new Date(dd)))))
        return true;
      return false;
    },
    [effectiveMinDate, effectiveMaxDate, disabledDates, normalize, isSameDay],
  );

  /** True if any date strictly between start and end is disabled */
  const doesRangeContainDisabledDate = useCallback(
    (start, end) => {
      const cursor = new Date(normalize(start));
      cursor.setDate(cursor.getDate() + 1); // exclude start
      const endNorm = normalize(end);
      while (cursor < endNorm) {
        if (isDateDisabled(cursor)) return true;
        cursor.setDate(cursor.getDate() + 1);
      }
      return false;
    },
    [normalize, isDateDisabled],
  );

  /** True if day is strictly between internalStart and internalEnd */
  const isDateInRange = useCallback(
    (day) => {
      if (!internalStart || !internalEnd || !day) return false;
      const d = normalize(day);
      const s = normalize(internalStart);
      const e = normalize(internalEnd);
      return d > s && d < e;
    },
    [internalStart, internalEnd, normalize],
  );

  // ─── Calendar Grid ───────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentMonth]);

  // ─── Month Navigation Guards ─────────────────────────────────────────────
  const canGoPrev = useMemo(() => {
    const endOfPrevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      0,
    );
    return endOfPrevMonth >= effectiveMinDate;
  }, [currentMonth, effectiveMinDate]);

  const canGoNext = useMemo(() => {
    const firstOfNextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    return firstOfNextMonth <= effectiveMaxDate;
  }, [currentMonth, effectiveMaxDate]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  // ─── Intent-Based Selection Algorithm ───────────────────────────────────
  const handleSelectDate = useCallback(
    (day) => {
      if (!day || isDateDisabled(day)) return;
      const tapped = normalize(day);

      // CASE 3: Range already set → reset to new single
      if (selectionMode === "range") {
        setInternalStart(tapped);
        setInternalEnd(null);
        setSelectionMode("single");
        return;
      }

      // CASE 1: Nothing selected → set single
      if (selectionMode === "none" || !internalStart) {
        setInternalStart(tapped);
        setInternalEnd(null);
        setSelectionMode("single");
        return;
      }

      // CASE 2: Single selected
      const start = normalize(internalStart);

      if (isSameDay(tapped, start)) {
        // Same date tapped → no-op, stay single
        return;
      }

      if (tapped < start) {
        // Earlier date → reset start, stay single
        setInternalStart(tapped);
        setInternalEnd(null);
        setSelectionMode("single");
        return;
      }

      // tapped > start → attempt range
      if (doesRangeContainDisabledDate(start, tapped)) {
        // Silent rejection — disabled date inside range
        return;
      }

      setInternalEnd(tapped);
      setSelectionMode("range");
    },
    [
      selectionMode,
      internalStart,
      isDateDisabled,
      normalize,
      isSameDay,
      doesRangeContainDisabledDate,
    ],
  );

  // ─── Confirmation ────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (selectionMode !== "none" && internalStart && onConfirm) {
      onConfirm({
        startDate: internalStart,
        endDate: selectionMode === "range" ? internalEnd : null,
      });
    }
    onClose();
  };

  const confirmDisabled = selectionMode === "none";

  // ─── Dynamic Title & Button Label ────────────────────────────────────────
  const headerTitle =
    selectionMode === "range" ? "Confirm date range" : "Select date";
  const buttonLabel =
    selectionMode === "range" ? "Confirm Range" : "Confirm Date";

  // ─── Per-Day State ───────────────────────────────────────────────────────
  const getDayState = useCallback(
    (day) => {
      if (!day) return {};
      const isDisabled = isDateDisabled(day);
      const isCurrentDay = isToday(day);
      const isStart = !!internalStart && isSameDay(day, internalStart);
      const isEnd = !!internalEnd && isSameDay(day, internalEnd);
      const inRange = !isDisabled && isDateInRange(day);
      const isSingleDayRange =
        selectionMode === "range" &&
        !!internalStart &&
        !!internalEnd &&
        isSameDay(internalStart, internalEnd);

      return {
        isCurrentDay,
        isDisabled,
        isStart,
        isEnd,
        isInRange: inRange,
        isSingleDayRange,
      };
    },
    [
      selectionMode,
      internalStart,
      internalEnd,
      isDateDisabled,
      isToday,
      isSameDay,
      isDateInRange,
    ],
  );

  // ─── Render ──────────────────────────────────────────────────────────────
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

        <TouchableWithoutFeedback>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{headerTitle}</Text>
            </View>

            {/* Month Navigation */}
            <View style={styles.calendarControls}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={[styles.chevron, !canGoPrev && { opacity: 0.3 }]}
                disabled={!canGoPrev}
              >
                <ChevronLeft size={20} color={BRAND.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTH_NAMES[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </Text>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={[styles.chevron, !canGoNext && { opacity: 0.3 }]}
                disabled={!canGoNext}
              >
                <ChevronRight size={20} color={BRAND.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Day-of-week header */}
            <View style={styles.weekRow}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={styles.weekDayText}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const {
                  isCurrentDay,
                  isDisabled,
                  isStart,
                  isEnd,
                  isInRange,
                  isSingleDayRange,
                } = getDayState(day);

                const isEndpoint = isStart || isEnd;

                const isRangeMode = selectionMode === "range";
                // Range tracking logic
                const showFullRange = isRangeMode && isInRange;
                const showLeftHalf = isRangeMode && !isSingleDayRange && isEnd;
                const showRightHalf =
                  isRangeMode && !isSingleDayRange && isStart;

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[styles.dayCell, isDisabled && { opacity: 0.4 }]}
                    onPress={() => handleSelectDate(day)}
                    disabled={isDisabled}
                  >
                    {/* Range strip backgrounds (behind circle) */}
                    {showFullRange && <View style={styles.rangeFull} />}
                    {showLeftHalf && <View style={styles.rangeHalfLeft} />}
                    {showRightHalf && <View style={styles.rangeHalfRight} />}

                    {/* Circle */}
                    {isEndpoint ? (
                      <LinearGradient
                        colors={BRAND.primaryGradient}
                        style={styles.selectedDay}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={styles.selectedDayText}>
                          {day.getDate()}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          styles.dayCircle,
                          isCurrentDay && styles.todayBorder,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isDisabled && { color: BRAND.textMuted },
                            isInRange && styles.inRangeText,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.confirmButtonContainer}
              onPress={handleConfirm}
              disabled={confirmDisabled}
            >
              <LinearGradient
                colors={
                  confirmDisabled
                    ? ["#C4C4C4", "#C4C4C4"]
                    : BRAND.primaryGradient
                }
                style={styles.confirmButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmButtonText}>{buttonLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
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
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.semibold,
    fontSize: 18,
    color: BRAND.textPrimary,
  },
  calendarControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  monthTitle: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: BRAND.textPrimary,
  },
  chevron: {
    padding: 8,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  weekDayText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: BRAND.textMuted,
    width: 40,
    textAlign: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  // ── Range Backgrounds ──────────────────────────────────────────────
  rangeFull: {
    position: "absolute",
    backgroundColor: BRAND.rangeHighlight,
    height: 36,
    left: -1,
    right: -1,
    top: "50%",
    marginTop: -18,
  },
  rangeHalfLeft: {
    position: "absolute",
    backgroundColor: BRAND.rangeHighlight,
    height: 36,
    left: -1,
    right: "50%",
    marginRight: -18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    top: "50%",
    marginTop: -18,
  },
  rangeHalfRight: {
    position: "absolute",
    backgroundColor: BRAND.rangeHighlight,
    height: 36,
    left: "50%",
    marginLeft: -18,
    right: -1,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    top: "50%",
    marginTop: -18,
  },

  // ── Day circle styles ────────────────────────────────────────────────────
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBorder: {
    borderWidth: 1.5,
    borderColor: BRAND.primary,
  },
  selectedDay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: BRAND.textPrimary,
  },
  inRangeText: {
    fontFamily: FONTS.medium,
    color: BRAND.primary,
  },
  selectedDayText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: "#FFFFFF",
  },

  // ── Confirm button ───────────────────────────────────────────────────────
  confirmButtonContainer: {
    marginTop: 20,
  },
  confirmButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default CustomDatePicker;
