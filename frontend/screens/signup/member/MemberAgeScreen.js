import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WheelPickerExpo from 'react-native-wheel-picker-expo';

const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#ffffff';
const SCREEN_WIDTH = Dimensions.get('window').width;

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BirthdayInputScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, gender } = route.params || {};

  const [month, setMonth] = useState('Jan');
  const [day, setDay] = useState(1);
  const [year, setYear] = useState(2000);

  // Calculate days in selected month/year (leap years handled)
  const getDaysInMonth = (m, y) => {
    const monthIndex = months.indexOf(m);
    return new Date(y, monthIndex + 1, 0).getDate();
  };
  const daysInCurrentMonth = getDaysInMonth(month, year);
  if (day > daysInCurrentMonth) setDay(daysInCurrentMonth);

  const handleNext = () => {
    const monthIndex = months.indexOf(month) + 1;
    const dob = `${year}-${String(monthIndex).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    navigation.navigate('MemberInterests', { email, accessToken, phone, name, gender, dob });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarActive, { width: '50%' }]} />
          <View style={styles.progressBarInactive} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>When's your birthday?</Text>
        <Text style={styles.subtitle}>This won't be part of your public profile.</Text>

        <View style={styles.pickerWrapper}>
          {/* Highlight overlay */}
          <View style={styles.pickerHighlightOverlay} />

          {/* Month Wheel */}
          <WheelPickerExpo
            data={months}
            selectedIndex={months.indexOf(month)}
            onChange={(index) => setMonth(months[index])}
            itemTextStyle={styles.wheelItemText}
            selectedItemTextStyle={styles.selectedWheelItemText}
            height={150}
            width={SCREEN_WIDTH / 3.2}
            isCurved={true}
            isAtmospheric={true}
            indicatorWidth={2}
            indicatorColor={PRIMARY_COLOR}
          />

          {/* Day Wheel */}
          <WheelPickerExpo
            data={Array.from({ length: daysInCurrentMonth }, (_, i) => (i + 1).toString())}
            selectedIndex={day - 1}
            onChange={(index) => setDay(index + 1)}
            itemTextStyle={styles.wheelItemText}
            selectedItemTextStyle={styles.selectedWheelItemText}
            height={150}
            width={SCREEN_WIDTH / 4}
            isCurved={true}
            isAtmospheric={true}
            indicatorWidth={2}
            indicatorColor={PRIMARY_COLOR}
          />

          {/* Year Wheel */}
          <WheelPickerExpo
            data={Array.from({ length: 100 }, (_, i) => (2025 - i).toString())}
            selectedIndex={2025 - year}
            onChange={(index) => setYear(2025 - index)}
            itemTextStyle={styles.wheelItemText}
            selectedItemTextStyle={styles.selectedWheelItemText}
            height={150}
            width={SCREEN_WIDTH / 4}
            isCurved={true}
            isAtmospheric={true}
            indicatorWidth={2}
            indicatorColor={PRIMARY_COLOR}
          />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 10 },
  backButton: { paddingRight: 15 },
  progressBarContainer: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e9ecef', overflow: 'hidden', flexDirection: 'row', marginRight: 20 },
  progressBarActive: { height: '100%', backgroundColor: PRIMARY_COLOR, borderRadius: 2 },
  progressBarInactive: { flex: 1, height: '100%' },
  contentContainer: { flex: 1, paddingHorizontal: 25, marginTop: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: TEXT_COLOR, marginBottom: 5 },
  subtitle: { fontSize: 14, color: LIGHT_TEXT_COLOR, marginBottom: 40 },

  pickerWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'relative', height: 150 },
  pickerHighlightOverlay: {
    position: 'absolute',
    top: '33.33%',
    width: '100%',
    height: '33.33%',
    backgroundColor: PRIMARY_COLOR + '20',
    borderRadius: 10,
    zIndex: 10,
    pointerEvents: 'none',
  },
  wheelItemText: { fontSize: 20, color: LIGHT_TEXT_COLOR, textAlign: 'center' },
  selectedWheelItemText: { fontSize: 24, fontWeight: '700', color: TEXT_COLOR },

  footer: { padding: 20, backgroundColor: BACKGROUND_COLOR, borderTopWidth: 0 },
  nextButton: { backgroundColor: PRIMARY_COLOR, paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});

export default BirthdayInputScreen;
