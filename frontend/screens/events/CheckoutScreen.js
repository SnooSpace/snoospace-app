/**
 * CheckoutScreen - Review booking and confirm
 * Shows order summary, timer, promo codes, and confirmation
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKGROUND_COLOR = '#0A0A0A';
const CARD_BACKGROUND = '#1A1A1A';
const TEXT_COLOR = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const PRIMARY_COLOR = '#6B46C1';
const SUCCESS_COLOR = '#34C759';

export default function CheckoutScreen({ route, navigation }) {
  const { event, cartItems, totalAmount } = route.params;
  const insets = useSafeAreaInsets();
  
  // 10-minute countdown timer
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes in seconds
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0 || isConfirmed) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          Alert.alert(
            'Session Expired',
            'Your booking session has expired. Please try again.',
            [{ text: 'OK', onPress: () => navigation.popToTop() }]
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, isConfirmed]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const formatTimeOnly = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase().trim();
    if (!code) return;
    
    const discount = event.discount_codes?.find(
      dc => dc.code.toUpperCase() === code && dc.is_active
    );
    
    if (discount) {
      setAppliedDiscount(discount);
      Alert.alert('Success', `Promo code "${code}" applied!`);
    } else {
      Alert.alert('Invalid Code', 'This promo code is not valid or has expired.');
    }
  };

  const handleRemoveItem = (index) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            if (cartItems.length === 1) {
              navigation.goBack();
            } else {
              // Would need to update cart, for MVP just go back
              navigation.goBack();
            }
          }
        }
      ]
    );
  };

  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;
    
    if (appliedDiscount.discount_type === 'percentage') {
      return (totalAmount * appliedDiscount.discount_value) / 100;
    }
    return Math.min(appliedDiscount.discount_value, totalAmount);
  };

  const discountAmount = calculateDiscount();
  const bookingFee = 0; // As requested, 0 for now
  const finalAmount = totalAmount - discountAmount + bookingFee;

  const handleConfirmBooking = () => {
    setIsConfirmed(true);
    Alert.alert(
      '🎉 Booking Confirmed!',
      `Your tickets for "${event.title}" have been booked successfully.\n\nYou will receive a confirmation email shortly.`,
      [{ 
        text: 'Done', 
        onPress: () => navigation.popToTop()
      }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review your booking</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Timer Bar */}
      <View style={styles.timerBar}>
        <Text style={styles.timerText}>
          Complete your booking in <Text style={styles.timerHighlight}>{formatTime(timeLeft)}</Text> mins
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Event Card */}
        <View style={styles.eventCard}>
          <View style={styles.eventRow}>
            {event.banner_carousel?.[0]?.url ? (
              <Image 
                source={{ uri: event.banner_carousel[0].url }} 
                style={styles.eventThumb}
              />
            ) : (
              <View style={[styles.eventThumb, styles.eventThumbPlaceholder]}>
                <Ionicons name="calendar" size={24} color={MUTED_TEXT} />
              </View>
            )}
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
              <Text style={styles.eventVenue} numberOfLines={1}>
                {event.location_url ? 'Venue' : 'Online Event'}
              </Text>
            </View>
          </View>
          
          <View style={styles.eventMeta}>
            <Text style={styles.eventMetaText}>
              {formatDate(event.event_date)}  |  {formatTimeOnly(event.event_date)}
            </Text>
          </View>
          
          {/* Line Items */}
          {cartItems.map((item, index) => (
            <View key={index} style={styles.lineItem}>
              <View style={styles.lineItemInfo}>
                <Text style={styles.lineItemText}>
                  {item.quantity} x {item.ticket.name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.lineItemPrice}>
                ₹{(item.quantity * parseFloat(item.ticket.base_price || 0)).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
          
          {/* M-Ticket Note */}
          <View style={styles.ticketNote}>
            <Ionicons name="qr-code-outline" size={20} color={MUTED_TEXT} />
            <Text style={styles.ticketNoteText}>
              M-Ticket: Entry using the QR code in your app
            </Text>
          </View>
        </View>

        {/* Offers Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>OFFERS</Text>
        </View>
        
        <View style={styles.offersCard}>
          {event.discount_codes?.some(dc => dc.is_active) && (
            <TouchableOpacity style={styles.offerRow}>
              <Ionicons name="pricetag-outline" size={20} color={TEXT_COLOR} />
              <Text style={styles.offerText}>View all event offers</Text>
              <Ionicons name="chevron-forward" size={20} color={MUTED_TEXT} />
            </TouchableOpacity>
          )}
          
          {/* Promo Code Input */}
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter promo code"
              placeholderTextColor={MUTED_TEXT}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyPromo}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          
          {appliedDiscount && (
            <View style={styles.appliedPromo}>
              <Ionicons name="checkmark-circle" size={16} color={SUCCESS_COLOR} />
              <Text style={styles.appliedPromoText}>
                {appliedDiscount.code} applied - 
                {appliedDiscount.discount_type === 'percentage' 
                  ? ` ${appliedDiscount.discount_value}% off`
                  : ` ₹${appliedDiscount.discount_value} off`}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>PAYMENT SUMMARY</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order amount</Text>
            <Text style={styles.summaryValue}>₹{totalAmount.toLocaleString('en-IN')}</Text>
          </View>
          
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: SUCCESS_COLOR }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: SUCCESS_COLOR }]}>
                -₹{discountAmount.toLocaleString('en-IN')}
              </Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Booking fee (inc. of GST)</Text>
            <Text style={styles.summaryValue}>
              {bookingFee === 0 ? 'Free' : `₹${bookingFee.toLocaleString('en-IN')}`}
            </Text>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>To pay now</Text>
            <Text style={styles.totalValue}>₹{finalAmount.toLocaleString('en-IN')}</Text>
          </View>
        </View>
        
        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity 
          style={styles.confirmButton} 
          onPress={handleConfirmBooking}
          disabled={isConfirmed}
        >
          <Text style={styles.confirmButtonText}>
            {isConfirmed ? 'Booking Confirmed ✓' : 'Confirm Booking ›'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  timerBar: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 13,
    color: MUTED_TEXT,
  },
  timerHighlight: {
    color: '#FF9500',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  eventCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  eventThumbPlaceholder: {
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  eventVenue: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  eventMeta: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  eventMetaText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  lineItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  lineItemText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  removeText: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  lineItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  ticketNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  ticketNoteText: {
    fontSize: 13,
    color: MUTED_TEXT,
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 12,
    color: MUTED_TEXT,
    letterSpacing: 1,
  },
  offersCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  offerText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT_COLOR,
    fontSize: 14,
  },
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: {
    color: TEXT_COLOR,
    fontWeight: '600',
  },
  appliedPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  appliedPromoText: {
    fontSize: 13,
    color: SUCCESS_COLOR,
  },
  summaryCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: MUTED_TEXT,
  },
  summaryValue: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  confirmButton: {
    backgroundColor: TEXT_COLOR,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: BACKGROUND_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
});
