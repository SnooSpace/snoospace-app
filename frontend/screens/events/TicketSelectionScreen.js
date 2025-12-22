/**
 * TicketSelectionScreen - Choose tickets for an event
 * Shows list of ticket types with Add/quantity controls
 * Dynamic bottom bar with cart total and Checkout button
 * Filters tickets by user's gender (from profile)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import { getActiveAccount } from '../../api/auth';

const BACKGROUND_COLOR = '#0A0A0A';
const CARD_BACKGROUND = '#1A1A1A';
const TEXT_COLOR = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const PRIMARY_COLOR = COLORS.primary;

export default function TicketSelectionScreen({ route, navigation }) {
  const { event } = route.params;
  const insets = useSafeAreaInsets();
  
  // Cart state: { ticketId: quantity }
  const [cart, setCart] = useState({});
  const [userGender, setUserGender] = useState(null);

  // Load user's gender on mount
  useEffect(() => {
    const loadUserGender = async () => {
      try {
        const account = await getActiveAccount();
        // Gender is stored in member data
        if (account?.gender) {
          setUserGender(account.gender);
        }
      } catch (error) {
        console.log('Could not load user gender:', error);
      }
    };
    loadUserGender();
  }, []);

  // Filter tickets by user's gender
  const filteredTickets = useMemo(() => {
    if (!event.ticket_types) return [];
    
    return event.ticket_types.filter(ticket => {
      const restriction = ticket.gender_restriction || 'all';
      // Show ticket if it's for 'all' genders OR matches user's gender
      return restriction === 'all' || restriction === userGender;
    });
  }, [event.ticket_types, userGender]);
  
  // Calculate cart totals
  const { totalItems, totalAmount } = useMemo(() => {
    let items = 0;
    let amount = 0;
    
    Object.entries(cart).forEach(([ticketId, qty]) => {
      if (qty > 0) {
        const ticket = filteredTickets.find(t => t.id?.toString() === ticketId || t.name === ticketId);
        if (ticket) {
          items += qty;
          amount += qty * (parseFloat(ticket.base_price) || 0);
        }
      }
    });
    
    return { totalItems: items, totalAmount: amount };
  }, [cart, filteredTickets]);

  const handleAdd = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    setCart(prev => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }));
  };

  const handleRemove = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    setCart(prev => {
      const newQty = (prev[key] || 0) - 1;
      if (newQty <= 0) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: newQty };
    });
  };

  const getQuantity = (ticket) => {
    const key = ticket.id?.toString() || ticket.name;
    return cart[key] || 0;
  };

  const handleCheckout = () => {
    // Build cart items with ticket details
    const cartItems = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketId, qty]) => {
        const ticket = event.ticket_types.find(t => 
          t.id?.toString() === ticketId || t.name === ticketId
        );
        return { ticket, quantity: qty };
      });
    
    navigation.navigate('Checkout', { 
      event, 
      cartItems,
      totalAmount 
    });
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

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.headerSubtitle}>
            {formatDate(event.event_date)} | {formatTime(event.event_date)}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Choose tickets</Text>
        
        {filteredTickets.map((ticket, index) => {
          const qty = getQuantity(ticket);
          const isSoldOut = ticket.total_quantity && 
            (ticket.sold_count || 0) >= ticket.total_quantity;
          const price = parseFloat(ticket.base_price) || 0;
          
          return (
            <View key={index} style={[styles.ticketCard, isSoldOut && styles.ticketCardDisabled]}>
              <View style={styles.ticketHeader}>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketName}>{ticket.name}</Text>
                  <Text style={styles.ticketPrice}>
                    {price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`}
                  </Text>
                </View>
                
                {!isSoldOut ? (
                  qty === 0 ? (
                    <TouchableOpacity 
                      style={styles.addButton} 
                      onPress={() => handleAdd(ticket)}
                    >
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.quantityControl}>
                      <TouchableOpacity 
                        onPress={() => handleRemove(ticket)}
                        style={styles.qtyButton}
                      >
                        <Text style={styles.qtyButtonText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{qty}</Text>
                      <TouchableOpacity 
                        onPress={() => handleAdd(ticket)}
                        style={styles.qtyButton}
                      >
                        <Text style={styles.qtyButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <View style={styles.soldOutBadge}>
                    <Text style={styles.soldOutText}>Sold Out</Text>
                  </View>
                )}
              </View>
              
              {ticket.description && (
                <View style={styles.ticketDesc}>
                  {ticket.description.split('\n').map((line, i) => (
                    <Text key={i} style={styles.descLine}>− {line.replace(/^[-•]\s*/, '')}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        
        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      {totalItems > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>
              {totalItems} ticket{totalItems > 1 ? 's' : ''}
            </Text>
            <Text style={styles.cartTotal}>
              ₹{totalAmount.toLocaleString('en-IN')}
            </Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginTop: 20,
    marginBottom: 16,
  },
  ticketCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_COLOR,
  },
  ticketCardDisabled: {
    opacity: 0.5,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketInfo: {
    flex: 1,
    marginRight: 16,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  ticketPrice: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: CARD_BACKGROUND,
    borderWidth: 1,
    borderColor: TEXT_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: TEXT_COLOR,
    fontWeight: '600',
    fontSize: 14,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
  },
  qtyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qtyButtonText: {
    color: TEXT_COLOR,
    fontSize: 18,
    fontWeight: '600',
  },
  qtyValue: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
    minWidth: 24,
    textAlign: 'center',
  },
  soldOutBadge: {
    backgroundColor: 'rgba(255,59,48,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  soldOutText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 12,
  },
  ticketDesc: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  descLine: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginBottom: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  cartInfo: {
    flex: 1,
  },
  cartItems: {
    fontSize: 13,
    color: MUTED_TEXT,
  },
  cartTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  checkoutButton: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
});
