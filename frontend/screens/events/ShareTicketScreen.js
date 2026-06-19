import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Image, Switch, Alert, StatusBar, Animated, Easing } from "react-native";
import { Pressable as GHPressable, GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import Svg, { Circle, Rect, Path, Ellipse } from "react-native-svg";
import { apiGet, apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

const ShareTicketScreen = ({ navigation, route }) => {
  const { events = [] } = route.params || {};

  // Step management: 1 = select event, 2 = configure gift
  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedTicketType, setSelectedTicketType] = useState(null);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Gift configuration
  const [recipientSearch, setRecipientSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [canReshare, setCanReshare] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  // Load ticket types when event is selected
  const handleEventSelect = async (event) => {
    setSelectedEvent(event);
    setLoadingTickets(true);
    try {
      const token = await getAuthToken();
      const response = await apiGet(`/events/${event.id}`, 15000, token);

      console.log("[ShareTicketScreen] Event response:", {
        eventId: event.id,
        all_ticket_types: response?.event?.all_ticket_types?.length,
        ticket_types: response?.event?.ticket_types?.length,
      });

      // Use all_ticket_types if available (for community owner), otherwise use ticket_types
      const tickets =
        response?.event?.all_ticket_types ||
        response?.event?.ticket_types ||
        [];

      console.log("[ShareTicketScreen] Tickets loaded:", tickets);

      setTicketTypes(tickets);
      if (tickets.length === 1) {
        setSelectedTicketType(tickets[0]);
      }

      if (tickets.length === 0) {
        Alert.alert("No Tickets", "This event has no ticket types to share.");
      }

      setStep(2);
    } catch (error) {
      console.error("Error loading ticket types:", error);
      Alert.alert("Error", "Failed to load ticket types");
    } finally {
      setLoadingTickets(false);
    }
  };

  // Search for users
  const handleSearch = async (query) => {
    setRecipientSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const token = await getAuthToken();
      // Use the existing /members/search endpoint
      const response = await apiGet(
        `/members/search?q=${encodeURIComponent(query)}&limit=10`,
        10000,
        token
      );
      // Map the results to include type field
      const members = (response?.results || []).map((m) => ({
        ...m,
        type: "member",
      }));
      setSearchResults(members);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Send the gift
  const handleSendGift = async () => {
    if (!selectedEvent || !selectedTicketType || !selectedRecipient) {
      Alert.alert(
        "Missing Info",
        "Please select event, ticket type, and recipient."
      );
      return;
    }

    setSending(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/events/${selectedEvent.id}/gifts`,
        {
          ticketTypeId: selectedTicketType.id,
          recipientId: selectedRecipient.id,
          recipientType: selectedRecipient.type || "member",
          quantity: quantity,
          canReshare: canReshare,
          message: message.trim() || null,
        },
        15000,
        token
      );

      const isFree = parseFloat(selectedTicketType.base_price) === 0;
      Alert.alert(
        "Success! 🎉",
        isFree
          ? `Ticket sent to ${selectedRecipient.name}! They're now registered for the event.`
          : `Invitation sent to ${selectedRecipient.name}! They'll be notified to register.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Gift error:", error);
      Alert.alert("Error", error.message || "Failed to send gift");
    } finally {
      setSending(false);
    }
  };

  const renderEventSelection = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {events.length > 0 && <Text style={styles.stepTitle}>Select an Event</Text>}
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.illustrationContainer}>
            <Animated.View style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}>
              <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
                <Circle cx="120" cy="120" r="80" fill="#2563EB" fillOpacity="0.08" />
                
                {/* Ticket Shape */}
                <Rect x="60" y="80" width="120" height="70" rx="12" stroke="#0F172A" strokeWidth="4" fill="white" />
                <Path d="M60 115C68 115 68 105 60 105" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="#F8FAFC" />
                <Path d="M180 115C172 115 172 105 180 105" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="#F8FAFC" />
                
                {/* Ticket Stripes (Brand Blue) */}
                <Rect x="75" y="80" width="15" height="70" fill="#2563EB" fillOpacity="0.2" />
                <Path d="M90 80V150" stroke="#0F172A" strokeWidth="3" strokeDasharray="4 4" />
                
                {/* Spotlight Beam */}
                <Path d="M120 40L160 160H80L120 40Z" fill="#22D3EE" fillOpacity="0.1" />
                <Circle cx="120" cy="45" r="8" fill="white" stroke="#0F172A" strokeWidth="3" />
                
                {/* Calendar Icon element */}
                <Rect x="110" y="100" width="40" height="35" rx="4" stroke="#0F172A" strokeWidth="3" fill="white" />
                <Rect x="110" y="100" width="40" height="10" rx="2" fill="#2563EB" stroke="#0F172A" strokeWidth="3" />
                
                {/* Floating Stars */}
                <Path d="M185 70L187 75H192L188 78L189 83L185 80L181 83L182 78L178 75H183L185 70Z" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
                <Circle cx="55" cy="90" r="4" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
              </Svg>
            </Animated.View>
            <View style={styles.shadowContainer}>
              <Svg width="128" height="8" viewBox="0 0 128 8" fill="none">
                <Ellipse cx="64" cy="4" rx="64" ry="4" fill="rgba(30, 58, 138, 0.05)" />
              </Svg>
            </View>
          </View>
          <Text style={styles.emptyText}>No upcoming events</Text>
          <Text style={styles.emptySubtext}>
            Create an event first to share tickets
          </Text>
        </View>
      ) : (
        events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventItem}
            onPress={() => handleEventSelect(event)}
            disabled={loadingTickets}
          >
            <Image
              source={{
                uri: event.banner_url || "https://via.placeholder.com/60",
              }}
              style={styles.eventImage}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle} numberOfLines={1}>
                {event.title}
              </Text>
              <Text style={styles.eventDate}>
                {new Date(event.event_date).toLocaleDateString()}
              </Text>
            </View>
            {loadingTickets && selectedEvent?.id === event.id ? (
              <SnooLoader size="small" color={PRIMARY_COLOR} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={LIGHT_TEXT_COLOR}
              />
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderGiftForm = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Selected Event */}
      <View style={styles.selectedEventCard}>
        <Image
          source={{
            uri: selectedEvent?.banner_url || "https://via.placeholder.com/40",
          }}
          style={styles.selectedEventImage}
        />
        <Text style={styles.selectedEventTitle} numberOfLines={1}>
          {selectedEvent?.title}
        </Text>
      </View>

      {/* Ticket Type Selection */}
      <Text style={styles.label}>Ticket Type</Text>
      {ticketTypes.length === 0 ? (
        <View style={styles.noTicketsContainer}>
          <Ionicons name="ticket-outline" size={32} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.noTicketsText}>No ticket types available</Text>
        </View>
      ) : (
        <View style={styles.ticketTypesContainer}>
          {ticketTypes.map((ticket) => {
            const isInviteOnly = ticket.visibility === "invite_only";
            return (
              <TouchableOpacity
                key={ticket.id}
                style={[
                  styles.ticketTypeItem,
                  selectedTicketType?.id === ticket.id &&
                    styles.ticketTypeSelected,
                  isInviteOnly && styles.ticketTypeInviteOnly,
                ]}
                onPress={() => setSelectedTicketType(ticket)}
              >
                <View style={styles.ticketTypeHeader}>
                  <Text
                    style={[
                      styles.ticketTypeName,
                      selectedTicketType?.id === ticket.id &&
                        styles.ticketTypeNameSelected,
                    ]}
                  >
                    {ticket.name}
                  </Text>
                  {isInviteOnly && (
                    <View style={styles.inviteOnlyBadge}>
                      <Ionicons name="lock-closed" size={10} color="#FF6B6B" />
                      <Text style={styles.inviteOnlyText}>Invite</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.ticketTypePrice,
                    selectedTicketType?.id === ticket.id &&
                      styles.ticketTypePriceSelected,
                  ]}
                >
                  {parseFloat(ticket.base_price) === 0
                    ? "Free"
                    : `₹${ticket.base_price}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Recipient Search */}
      <Text style={styles.label}>Send to</Text>
      {selectedRecipient ? (
        <View style={styles.selectedRecipient}>
          <Image
            source={{
              uri:
                selectedRecipient.profile_photo_url ||
                selectedRecipient.logo_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  selectedRecipient.name
                )}&background=007AFF&color=fff`,
            }}
            style={styles.recipientAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recipientName}>{selectedRecipient.name}</Text>
            <Text style={styles.recipientUsername}>
              @{selectedRecipient.username}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedRecipient(null);
              setRecipientSearch("");
            }}
          >
            <Ionicons name="close-circle" size={24} color={LIGHT_TEXT_COLOR} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={LIGHT_TEXT_COLOR} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or username..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={recipientSearch}
              onChangeText={handleSearch}
            />
            {searching && (
              <SnooLoader size="small" color={PRIMARY_COLOR} />
            )}
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.map((user) => (
                <TouchableOpacity
                  key={`${user.type}_${user.id}`}
                  style={styles.searchResultItem}
                  onPress={() => {
                    setSelectedRecipient(user);
                    setSearchResults([]);
                  }}
                >
                  <Image
                    source={{
                      uri:
                        user.profile_photo_url ||
                        user.logo_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          user.name
                        )}&background=007AFF&color=fff`,
                    }}
                    style={styles.searchResultAvatar}
                  />
                  <View>
                    <Text style={styles.searchResultName}>{user.name}</Text>
                    <Text style={styles.searchResultUsername}>
                      @{user.username} · {user.type}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Quantity */}
      <Text style={styles.label}>Quantity</Text>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => setQuantity(Math.max(1, quantity - 1))}
        >
          <Ionicons name="remove" size={20} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => setQuantity(Math.min(10, quantity + 1))}
        >
          <Ionicons name="add" size={20} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Can Reshare Toggle */}
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Allow re-sharing</Text>
          <Text style={styles.toggleSubtext}>
            Recipient can share tickets with others
          </Text>
        </View>
        <Switch
          value={canReshare}
          onValueChange={setCanReshare}
          trackColor={{ false: "#E5E5EA", true: PRIMARY_COLOR }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Message */}
      <Text style={styles.label}>Personal Message (optional)</Text>
      <TextInput
        style={styles.messageInput}
        placeholder="Add a personal note..."
        placeholderTextColor={LIGHT_TEXT_COLOR}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={200}
      />

      {/* Send Button */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!selectedTicketType || !selectedRecipient) &&
            styles.sendButtonDisabled,
        ]}
        onPress={handleSendGift}
        disabled={!selectedTicketType || !selectedRecipient || sending}
      >
        {sending ? (
          <SnooLoader color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="gift" size={20} color="#FFFFFF" />
            <Text style={[styles.sendButtonText, { fontFamily: 'Manrope-SemiBold' }]}>
              {parseFloat(selectedTicketType?.base_price || 0) === 0
                ? "Send Ticket"
                : "Send Invite"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Bottom spacing to account for tab bar */}
      <View style={{ height: 120 }} />
    </ScrollView>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Header */}
        <View style={styles.header}>
          <GHPressable
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </GHPressable>
          <Text style={styles.headerTitle}>
            {step === 1 ? "Share Tickets" : "Gift Details"}
          </Text>
          <View style={{ width: 54 }} />
        </View>

        {/* Content */}
        {step === 1 ? renderEventSelection() : renderGiftForm()}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: TEXT_COLOR,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  illustrationContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 16,
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_COLOR,
    fontFamily: "Manrope-SemiBold",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontFamily: "Manrope-Regular",
    marginTop: 8,
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    marginBottom: 12,
    gap: 14,
  },
  eventImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#E5E5EA",
  },
  eventTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  eventDate: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
    marginLeft: -10,
  },
  backButtonText: {
    fontSize: 15,
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  selectedEventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F0F8FF",
    borderRadius: 14,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + "30",
  },
  selectedEventImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  selectedEventTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    marginBottom: 10,
    marginTop: 20,
  },
  noTicketsContainer: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
  },
  noTicketsText: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
  },
  ticketTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  ticketTypeItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E5EA",
  },
  ticketTypeSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  ticketTypeName: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  ticketTypeNameSelected: {
    color: "#FFFFFF",
  },
  ticketTypePrice: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: LIGHT_TEXT_COLOR,
    marginTop: 3,
  },
  ticketTypePriceSelected: {
    color: "#FFFFFF",
  },
  ticketTypeInviteOnly: {
    borderColor: "#FF6B6B60",
    backgroundColor: "#FFF5F5",
  },
  ticketTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF6B6B20",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  inviteOnlyText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: "#FF6B6B",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: TEXT_COLOR,
  },
  searchResults: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchResultName: {
    fontSize: 15,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  searchResultUsername: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  selectedRecipient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#F0FFF4",
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#22C55E30",
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  recipientName: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
  },
  recipientUsername: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  quantityText: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    minWidth: 36,
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  toggleLabel: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  toggleSubtext: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: LIGHT_TEXT_COLOR,
    marginTop: 3,
  },
  messageInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: TEXT_COLOR,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 18,
    borderRadius: 18,
    marginTop: 28,
    gap: 10,
  },
  sendButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  sendButtonText: {
    fontSize: 17,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
});

export default ShareTicketScreen;
