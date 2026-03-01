import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Image, Switch, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet, apiPost } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS } from "../../constants/theme";
import SnooLoader from "../ui/SnooLoader";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

const ShareTicketModal = ({ visible, onClose, events = [], onGiftSent }) => {
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

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setStep(1);
      setSelectedEvent(null);
      setSelectedTicketType(null);
      setTicketTypes([]);
      setRecipientSearch("");
      setSearchResults([]);
      setSelectedRecipient(null);
      setQuantity(1);
      setCanReshare(false);
      setMessage("");
    }
  }, [visible]);

  // Load ticket types when event is selected
  const handleEventSelect = async (event) => {
    setSelectedEvent(event);
    setLoadingTickets(true);
    try {
      const token = await getAuthToken();
      const response = await apiGet(`/events/${event.id}`, 15000, token);

      // Debug logging
      console.log("[ShareTicketModal] Event response:", {
        eventId: event.id,
        all_ticket_types: response?.event?.all_ticket_types?.length,
        ticket_types: response?.event?.ticket_types?.length,
      });

      // Use all_ticket_types if available (for community owner), otherwise use ticket_types
      const tickets =
        response?.event?.all_ticket_types ||
        response?.event?.ticket_types ||
        [];

      console.log("[ShareTicketModal] Tickets loaded:", tickets);

      // Always set ticket types
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
      const response = await apiGet(
        `/search/users?q=${encodeURIComponent(query)}&limit=10`,
        10000,
        token
      );
      setSearchResults(response?.users || []);
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
          ticket_type_id: selectedTicketType.id,
          recipient_id: selectedRecipient.id,
          recipient_type: selectedRecipient.type || "member",
          quantity: quantity,
          can_reshare: canReshare,
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
        [{ text: "OK", onPress: onClose }]
      );

      if (onGiftSent) onGiftSent(response);
    } catch (error) {
      console.error("Gift error:", error);
      Alert.alert("Error", error.message || "Failed to send gift");
    } finally {
      setSending(false);
    }
  };

  const renderEventSelection = () => (
    <ScrollView style={{ maxHeight: 400 }}>
      <Text style={styles.stepTitle}>Select an Event</Text>
      {events.length === 0 ? (
        <Text style={styles.emptyText}>No upcoming events</Text>
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
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          setStep(1);
          setSelectedEvent(null);
          setSelectedTicketType(null);
        }}
      >
        <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
        <Text style={styles.backButtonText}>Back to events</Text>
      </TouchableOpacity>

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
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 1 ? "Share Tickets" : "Gift Details"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {step === 1 ? renderEventSelection() : renderGiftForm()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  closeButton: {
    padding: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    padding: 20,
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  eventImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  eventDate: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  selectedEventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F0F8FF",
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + "30",
  },
  selectedEventImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  selectedEventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 16,
  },
  ticketTypesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  ticketTypeItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  ticketTypeSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  ticketTypeName: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  ticketTypeNameSelected: {
    color: "#FFFFFF",
  },
  ticketTypePrice: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  ticketTypePriceSelected: {
    color: "#FFFFFF",
  },
  ticketTypeInviteOnly: {
    borderColor: "#FF6B6B40",
    backgroundColor: "#FFF0F0",
  },
  ticketTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inviteOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FF6B6B20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inviteOnlyText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FF6B6B",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_COLOR,
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    maxHeight: 150,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  searchResultUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  selectedRecipient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F0FFF4",
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#22C55E30",
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  recipientUsername: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  quantityText: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_COLOR,
    minWidth: 30,
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  toggleSubtext: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  messageInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: TEXT_COLOR,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    gap: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

export default ShareTicketModal;
