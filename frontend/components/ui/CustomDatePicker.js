import React, { useState, useMemo, useEffect } from "react";
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
import { BlurView } from "expo-blur";

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

const CustomDatePicker = ({
  visible,
  onClose,
  date,
  onChange,
  minDate,
  maxDate,
  disabledDates = [],
}) => {
  const [currentMonth, setCurrentMonth] = useState(date || new Date());
  // Internal pending selection; committed on Confirm
  const [pickedDate, setPickedDate] = useState(date || null);

  // When the modal opens, sync pickedDate to the current prop value
  useEffect(() => {
    if (visible) {
      setPickedDate(date || null);
      setCurrentMonth(date || new Date());
    }
  }, [visible]);

  // Default constraints
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

  // Helper to get days in month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to get day offset (0-6)
  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(month, year);
    const startDay = getFirstDayOfMonth(month, year);

    const days = [];
    // Padding for empty days
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [currentMonth]);

  const isDateDisabled = (day) => {
    if (!day) return true;
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);

    if (d < effectiveMinDate) return true;
    if (d > effectiveMaxDate) return true;

    if (disabledDates.some((disabled) => isSameDay(d, new Date(disabled)))) {
      return true;
    }

    return false;
  };

  const canGoPrev = useMemo(() => {
    const prevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    // maximize prevMonth to end of that month for loose comparison
    const endOfPrevMonth = new Date(
      prevMonth.getFullYear(),
      prevMonth.getMonth() + 1,
      0,
    );
    return endOfPrevMonth >= effectiveMinDate;
  }, [currentMonth, effectiveMinDate]);

  const canGoNext = useMemo(() => {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    return nextMonth <= effectiveMaxDate;
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

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isToday = (d) => {
    const today = new Date();
    return isSameDay(d, today);
  };

  const handleSelectDate = (day) => {
    if (day && !isDateDisabled(day)) {
      // Store locally; parent is only updated on Confirm
      const newDate = new Date(date || new Date());
      newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      setPickedDate(newDate);
    }
  };

  const handleConfirm = () => {
    if (pickedDate && onChange) {
      onChange(pickedDate);
    }
    onClose();
  };

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
              <Text style={styles.title}>Select Date</Text>
            </View>

            {/* Calendar Controls */}
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

            {/* Days Header */}
            <View style={styles.weekRow}>
              {DAYS_OF_WEEK.map((day) => (
                <Text key={day} style={styles.weekDayText}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {calendarDays.map((day, index) => {
                const isSelected = isSameDay(day, pickedDate);
                const isCurrentDay = isToday(day);
                const isDisabled = isDateDisabled(day);

                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[styles.dayCell, isDisabled && { opacity: 0.4 }]}
                    onPress={() => handleSelectDate(day)}
                    disabled={isDisabled}
                  >
                    {isSelected ? (
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
              disabled={!pickedDate}
            >
              <LinearGradient
                colors={
                  pickedDate ? BRAND.primaryGradient : ["#C4C4C4", "#C4C4C4"]
                }
                style={styles.confirmButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmButtonText}>Confirm Date</Text>
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
    marginBottom: 20,
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
    // justifyContent: 'space-around',
    // Using space-around might mess up alignment if row is not full.
    // Better to have fixed width or just percentage.
  },
  dayCell: {
    width: "14.28%", // 100% / 7
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
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
  selectedDayText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: "#FFFFFF",
  },
  confirmButtonContainer: {
    marginTop: 24,
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
