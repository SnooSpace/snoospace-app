/**
 * TicketTypesEditor - Component for managing event ticket tiers
 * Used in CreateEventModal and EditEventModal to add/edit/remove ticket types
 */
import React, {
  useState,
  useImperativeHandle,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

const TicketTypesEditor = React.forwardRef(
  (
    {
      ticketTypes = [],
      onChange,
      onAddPress,
      pricingRules = [],
      eventStartDate,
      eventEndDate,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const [showModal, setShowModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [showSalesStartPicker, setShowSalesStartPicker] = useState(false);
    const [showSalesEndPicker, setShowSalesEndPicker] = useState(false);

    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    React.useEffect(() => {
      const showSubscription = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        () => setKeyboardVisible(true),
      );
      const hideSubscription = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        () => setKeyboardVisible(false),
      );

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }, []);

    // Progressive Disclosure States
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [capacityMode, setCapacityMode] = useState("unlimited"); // "unlimited" | "limited"
    const [salesMode, setSalesMode] = useState("duration"); // "duration" | "custom"
    const [genderMode, setGenderMode] = useState("none"); // "none" | "restricted"

    const [currentTicket, setCurrentTicket] = useState({
      name: "",
      description: "",
      base_price: "",
      total_quantity: "",
      visibility: "public",
      gender_restriction: "all",
      min_per_order: "1",
      max_per_order: "10",
      sales_start_date: null,
      sales_end_date: null,
    });

    const resetForm = () => {
      setCurrentTicket({
        name: "",
        description: "",
        base_price: "",
        total_quantity: "",
        visibility: "public",
        gender_restriction: "all",
        min_per_order: "1",
        max_per_order: "10",
        sales_start_date: null,
        sales_end_date: null,
      });
      setEditingIndex(null);
      setShowAdvanced(false);
      setCapacityMode("unlimited");
      setSalesMode("duration");
      setGenderMode("none");
    };

    const openAddModal = () => {
      resetForm();
      setShowModal(true);
    };

    useImperativeHandle(ref, () => ({
      openAddModal,
      openEditModal,
    }));

    const openEditModal = (index) => {
      const ticket = ticketTypes[index];
      setCurrentTicket({
        name: ticket.name || "",
        description: ticket.description || "",
        base_price: ticket.base_price?.toString() || "",
        total_quantity: ticket.total_quantity?.toString() || "",
        visibility: ticket.visibility || "public",
        gender_restriction: ticket.gender_restriction || "all",
        min_per_order: ticket.min_per_order?.toString() || "1",
        max_per_order: ticket.max_per_order?.toString() || "10",
        sales_start_date: ticket.sales_start_date
          ? new Date(ticket.sales_start_date)
          : null,
        sales_end_date: ticket.sales_end_date
          ? new Date(ticket.sales_end_date)
          : null,
      });

      setCapacityMode(ticket.total_quantity ? "limited" : "unlimited");
      setSalesMode(
        ticket.sales_start_date || ticket.sales_end_date
          ? "custom"
          : "duration",
      );
      setGenderMode(
        ticket.gender_restriction && ticket.gender_restriction !== "all"
          ? "restricted"
          : "none",
      );
      setShowAdvanced(false);

      setEditingIndex(index);
      setShowModal(true);
    };

    const handleSave = () => {
      if (!currentTicket.name.trim()) {
        Alert.alert("Required", "Please enter a ticket name");
        return;
      }

      // Sales window hard validation
      if (
        currentTicket.sales_start_date &&
        currentTicket.sales_end_date &&
        currentTicket.sales_end_date < currentTicket.sales_start_date
      ) {
        Alert.alert(
          "Invalid Sales Window",
          "Sales end date cannot be before sales start date.",
        );
        return;
      }
      if (
        currentTicket.sales_end_date &&
        eventStartDate &&
        currentTicket.sales_end_date > new Date(eventStartDate)
      ) {
        Alert.alert(
          "Invalid Sales Window",
          "Sales must close before the event starts.",
        );
        return;
      }

      const ticketData = {
        name: currentTicket.name.trim(),
        description: currentTicket.description.trim() || null,
        base_price: parseFloat(currentTicket.base_price) || 0,
        total_quantity:
          capacityMode === "limited" && currentTicket.total_quantity
            ? parseInt(currentTicket.total_quantity)
            : null,
        visibility: currentTicket.visibility,
        gender_restriction:
          genderMode === "restricted"
            ? currentTicket.gender_restriction
            : "all",
        min_per_order: parseInt(currentTicket.min_per_order) || 1,
        max_per_order: parseInt(currentTicket.max_per_order) || 10,
        is_active: true,
        sales_start_date:
          salesMode === "custom" && currentTicket.sales_start_date
            ? currentTicket.sales_start_date.toISOString()
            : null,
        sales_end_date:
          salesMode === "custom" && currentTicket.sales_end_date
            ? currentTicket.sales_end_date.toISOString()
            : null,
      };

      if (editingIndex !== null) {
        // Update existing
        const updated = [...ticketTypes];
        updated[editingIndex] = { ...updated[editingIndex], ...ticketData };
        onChange(updated);
      } else {
        // Add new
        onChange([...ticketTypes, ticketData]);
      }

      setShowModal(false);
      resetForm();
    };

    const handleDelete = (index) => {
      const ticket = ticketTypes[index];
      const hasSoldTickets = (ticket.sold_count || 0) > 0 || ticket.id;

      // If ticket has sold tickets, show a different warning
      if (hasSoldTickets && (ticket.sold_count || 0) > 0) {
        Alert.alert(
          "Cannot Delete Ticket",
          `This ticket type has ${ticket.sold_count} sold ticket(s). You cannot delete a ticket type that has been purchased by users.\n\nYou can edit the ticket details instead.`,
          [{ text: "OK" }],
        );
        return;
      }

      Alert.alert(
        "Delete Ticket Type",
        "Are you sure you want to delete this ticket type?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              const updated = ticketTypes.filter((_, i) => i !== index);
              onChange(updated);
            },
          },
        ],
      );
    };

    const formatPrice = (price) => {
      if (!price || price === 0) return "Free";
      return `₹${parseFloat(price).toLocaleString("en-IN")}`;
    };

    // --- Dynamic ticket status ---
    const getTicketStatus = useCallback((ticket) => {
      const now = new Date();
      const totalQty = ticket.total_quantity;
      const soldCount = ticket.sold_count || 0;
      if (totalQty && soldCount >= totalQty)
        return { label: "Sold Out", color: "#FEE2E2", textColor: "#991B1B" };
      if (ticket.sales_start_date && new Date(ticket.sales_start_date) > now)
        return { label: "Scheduled", color: "#FEF3C7", textColor: "#92400E" };
      if (ticket.sales_end_date && new Date(ticket.sales_end_date) < now)
        return { label: "Expired", color: "#F3F4F6", textColor: "#6B7280" };
      return { label: "Active", color: "#DCFCE7", textColor: "#166534" };
    }, []);

    // --- Capacity helper text ---
    const getCapacityHelper = useCallback((ticket) => {
      const qty = parseInt(ticket.total_quantity);
      if (!qty) return null;
      const sold = ticket.sold_count || 0;
      const remaining = qty - sold;
      const pct = (sold / qty) * 100;
      if (pct >= 100)
        return { text: "This ticket will show as Sold Out", color: "#EF4444" };
      if (pct >= 75)
        return {
          text: `Only ${remaining} left — selling fast`,
          color: "#F59E0B",
        };
      return { text: `${remaining} spots remaining`, color: "#6B7280" };
    }, []);

    // --- Find active early bird for a ticket ---
    const getEarlyBirdDiscount = useCallback(
      (ticket) => {
        if (!pricingRules || pricingRules.length === 0) return null;
        const now = new Date();
        for (const rule of pricingRules) {
          if (!rule.is_active) continue;
          if (
            rule.rule_type === "early_bird_time" &&
            rule.valid_until &&
            new Date(rule.valid_until) < now
          )
            continue;
          const price = parseFloat(ticket.base_price) || 0;
          if (price <= 0) continue;
          const discounted =
            rule.discount_type === "percentage"
              ? price - (price * (parseFloat(rule.discount_value) || 0)) / 100
              : Math.max(0, price - (parseFloat(rule.discount_value) || 0));
          const savingsPct = Math.round(((price - discounted) / price) * 100);
          return { original: price, discounted, savingsPct };
        }
        return null;
      },
      [pricingRules],
    );

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.label}>Ticketing</Text>
          {ticketTypes.length > 0 && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onAddPress || openAddModal}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.addButtonText}>Add Ticket Type</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Empty State */}
        {/* Empty State */}
        {ticketTypes.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyCardContent}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="ticket"
                  size={24}
                  color="#FFFFFF"
                  style={{ transform: [{ rotate: "-45deg" }] }}
                />
              </View>
              <View style={styles.emptyTextContainer}>
                <Text style={styles.emptyCardTitle}>No tickets added</Text>
                <Text style={styles.emptyCardSubtext}>
                  Add ticket types to enable registrations
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={onAddPress || openAddModal}
            >
              <Text style={styles.emptyAddButtonText}>Add Ticket Type</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Ticket List */}
        {ticketTypes.map((ticket, index) => {
          const totalQty = ticket.total_quantity;
          const soldCount = ticket.sold_count || 0;
          const isSoldOut = totalQty && soldCount >= totalQty;
          const progress = totalQty
            ? Math.min((soldCount / totalQty) * 100, 100)
            : 0;
          const status = getTicketStatus(ticket);
          const earlyBird = getEarlyBirdDiscount(ticket);

          return (
            <View key={index} style={styles.ticketTile}>
              {/* Left Tile Icon */}
              <View style={styles.tileIconContainer}>
                <LinearGradient
                  colors={["#EEF2FF", "#C7D2FE"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tileIconCircle}
                >
                  <Ionicons name="ticket" size={20} color={COLORS.primary} />
                </LinearGradient>
              </View>

              {/* Right Content */}
              <View style={styles.tileContent}>
                <View style={styles.tileHeader}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {ticket.name}
                  </Text>
                  <View
                    style={[
                      styles.tileBadge,
                      { backgroundColor: status.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tileBadgeText,
                        { color: status.textColor },
                      ]}
                    >
                      {status.label}
                    </Text>
                  </View>
                </View>

                {/* Price + Early Bird Discount */}
                {earlyBird ? (
                  <View style={styles.discountPriceRow}>
                    <Text style={styles.tilePriceStruck}>
                      {formatPrice(earlyBird.original)}
                    </Text>
                    <Text style={styles.tilePrice}>
                      {formatPrice(earlyBird.discounted)}
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>
                        {earlyBird.savingsPct}% OFF
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.tilePrice}>
                    {formatPrice(ticket.base_price)}
                  </Text>
                )}

                {ticket.total_quantity ? (
                  <View style={styles.progressSection}>
                    <Text style={styles.progressText}>
                      {soldCount} of {ticket.total_quantity} sold
                    </Text>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progress}%` },
                          isSoldOut && { backgroundColor: "#EF4444" },
                        ]}
                      />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.progressText}>Unlimited capacity</Text>
                )}

                <View style={styles.tileActions}>
                  {ticket.visibility !== "public" && (
                    <View style={styles.visibilityBadge}>
                      <Ionicons
                        name={
                          ticket.visibility === "hidden"
                            ? "eye-off"
                            : "lock-closed"
                        }
                        size={12}
                        color="#6B7280"
                      />
                      <Text style={styles.visibilityText}>
                        {ticket.visibility === "hidden"
                          ? "Hidden"
                          : "Invite Only"}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(index)}
                  >
                    <Ionicons name="pencil" size={14} color="#6B7280" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(index)}
                  >
                    <Ionicons
                      name={soldCount > 0 ? "lock-closed" : "trash"}
                      size={14}
                      color={soldCount > 0 ? "#9CA3AF" : "#EF4444"}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: soldCount > 0 ? "#9CA3AF" : "#EF4444" },
                      ]}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Add/Edit Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent
          statusBarTranslucent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.sheetHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingIndex !== null
                    ? "Edit Ticket Type"
                    : "Add Ticket Type"}
                </Text>
              </View>

              <KeyboardAwareScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 150 }}
                bottomOffset={80}
              >
                {/* BASICS */}
                <Text style={styles.sectionHeader}>BASICS</Text>

                {/* Ticket Name */}
                <Text style={styles.fieldLabel}>Ticket Name *</Text>
                <TextInput
                  style={styles.input}
                  value={currentTicket.name}
                  onChangeText={(text) =>
                    setCurrentTicket({ ...currentTicket, name: text })
                  }
                  placeholder="e.g., General Admission"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                />
                <View style={styles.quickChipsContainer}>
                  {[
                    "General Admission",
                    "VIP",
                    "Early Bird",
                    "Couple Pass",
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.quickChip,
                        currentTicket.name === preset && styles.quickChipActive,
                      ]}
                      onPress={() =>
                        setCurrentTicket({ ...currentTicket, name: preset })
                      }
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          currentTicket.name === preset &&
                            styles.quickChipTextActive,
                        ]}
                      >
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Price */}
                <View style={styles.fieldSpacing} />
                <Text style={styles.fieldLabel}>Price *</Text>
                <View style={styles.priceInputWrapper}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={currentTicket.base_price}
                    onChangeText={(text) =>
                      setCurrentTicket({ ...currentTicket, base_price: text })
                    }
                    placeholder="0.00"
                    placeholderTextColor={LIGHT_TEXT_COLOR}
                    keyboardType="numeric"
                  />
                </View>
                <Text style={styles.inputHelper}>Enter 0 for free tickets</Text>

                {/* Capacity */}
                <View style={styles.fieldSpacing} />
                <Text style={styles.fieldLabel}>Capacity</Text>
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => setCapacityMode("unlimited")}
                >
                  <Ionicons
                    name={
                      capacityMode === "unlimited"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color={
                      capacityMode === "unlimited"
                        ? COLORS.primary
                        : LIGHT_TEXT_COLOR
                    }
                  />
                  <Text
                    style={[
                      styles.radioText,
                      capacityMode === "unlimited" && styles.radioTextActive,
                    ]}
                  >
                    Unlimited
                  </Text>
                </TouchableOpacity>

                <View style={styles.radioRow}>
                  <TouchableOpacity
                    style={styles.radioRowHeader}
                    onPress={() => setCapacityMode("limited")}
                  >
                    <Ionicons
                      name={
                        capacityMode === "limited"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={
                        capacityMode === "limited"
                          ? COLORS.primary
                          : LIGHT_TEXT_COLOR
                      }
                    />
                    <Text
                      style={[
                        styles.radioText,
                        capacityMode === "limited" && styles.radioTextActive,
                      ]}
                    >
                      Limited to
                    </Text>
                  </TouchableOpacity>
                  {capacityMode === "limited" && (
                    <TextInput
                      style={styles.inlineNumberInput}
                      value={currentTicket.total_quantity}
                      onChangeText={(text) =>
                        setCurrentTicket({
                          ...currentTicket,
                          total_quantity: text,
                        })
                      }
                      placeholder="100"
                      keyboardType="numeric"
                    />
                  )}
                </View>

                <View style={styles.sectionDivider} />

                {/* ADVANCED SETTINGS COLLAPSIBLE */}
                <TouchableOpacity
                  style={styles.advancedHeader}
                  onPress={() => setShowAdvanced(!showAdvanced)}
                >
                  <Text style={styles.advancedHeaderText}>
                    Advanced Settings
                  </Text>
                  <Ionicons
                    name={showAdvanced ? "chevron-up" : "chevron-down"}
                    size={16}
                    color="#374151"
                  />
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.advancedContainer}>
                    {/* Description */}
                    <Text style={styles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={currentTicket.description}
                      onChangeText={(text) =>
                        setCurrentTicket({
                          ...currentTicket,
                          description: text,
                        })
                      }
                      placeholder="What's included with this ticket?"
                      placeholderTextColor={LIGHT_TEXT_COLOR}
                      multiline
                    />

                    {/* Sales Window */}
                    <View style={styles.fieldSpacing} />
                    <Text style={styles.fieldLabel}>Sales Window</Text>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setSalesMode("duration")}
                    >
                      <Ionicons
                        name={
                          salesMode === "duration"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={
                          salesMode === "duration"
                            ? COLORS.primary
                            : LIGHT_TEXT_COLOR
                        }
                      />
                      <Text
                        style={[
                          styles.radioText,
                          salesMode === "duration" && styles.radioTextActive,
                        ]}
                      >
                        Entire event duration
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setSalesMode("custom")}
                    >
                      <Ionicons
                        name={
                          salesMode === "custom"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={
                          salesMode === "custom"
                            ? COLORS.primary
                            : LIGHT_TEXT_COLOR
                        }
                      />
                      <Text
                        style={[
                          styles.radioText,
                          salesMode === "custom" && styles.radioTextActive,
                        ]}
                      >
                        Custom dates
                      </Text>
                    </TouchableOpacity>

                    {salesMode === "custom" && (
                      <View style={styles.customDatesContainer}>
                        <View style={styles.datePickerWrapper}>
                          <Text style={styles.dateLabel}>Start:</Text>
                          <TouchableOpacity
                            style={styles.datePickerBtnCompact}
                            onPress={() => setShowSalesStartPicker(true)}
                          >
                            <Text
                              style={styles.datePickerBtnText}
                              numberOfLines={1}
                            >
                              {currentTicket.sales_start_date
                                ? new Date(
                                    currentTicket.sales_start_date,
                                  ).toLocaleDateString()
                                : "Select date"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.datePickerWrapper}>
                          <Text style={styles.dateLabel}>End:</Text>
                          <TouchableOpacity
                            style={styles.datePickerBtnCompact}
                            onPress={() => setShowSalesEndPicker(true)}
                          >
                            <Text
                              style={styles.datePickerBtnText}
                              numberOfLines={1}
                            >
                              {currentTicket.sales_end_date
                                ? new Date(
                                    currentTicket.sales_end_date,
                                  ).toLocaleDateString()
                                : "Select date"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Date Errors */}
                        {currentTicket.sales_start_date &&
                          currentTicket.sales_end_date &&
                          currentTicket.sales_end_date <
                            currentTicket.sales_start_date && (
                            <Text style={styles.validationError}>
                              End date cannot be before start date
                            </Text>
                          )}
                        {currentTicket.sales_end_date &&
                          eventStartDate &&
                          currentTicket.sales_end_date >
                            new Date(eventStartDate) && (
                            <Text style={styles.validationWarning}>
                              Sales must close before the event starts
                            </Text>
                          )}
                      </View>
                    )}
                    {salesMode === "duration" && (
                      <Text style={styles.inputHelper}>
                        Defaults to event duration if not customized
                      </Text>
                    )}

                    {/* Visibility */}
                    <View style={styles.fieldSpacing} />
                    <Text style={styles.fieldLabel}>Visibility</Text>
                    <View style={styles.segmentedControl}>
                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          currentTicket.visibility === "public" &&
                            styles.segmentBtnActive,
                        ]}
                        onPress={() =>
                          setCurrentTicket({
                            ...currentTicket,
                            visibility: "public",
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            currentTicket.visibility === "public" &&
                              styles.segmentTextActive,
                          ]}
                        >
                          🌍 Public
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.segmentBtn,
                          currentTicket.visibility === "invite_only" &&
                            styles.segmentBtnActive,
                        ]}
                        onPress={() =>
                          setCurrentTicket({
                            ...currentTicket,
                            visibility: "invite_only",
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            currentTicket.visibility === "invite_only" &&
                              styles.segmentTextActive,
                          ]}
                        >
                          🔒 Invite Only
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {currentTicket.visibility === "invite_only" && (
                      <Text style={styles.inputHelper}>
                        Only users with direct link can purchase
                      </Text>
                    )}

                    {/* Gender Restriction */}
                    <View style={styles.fieldSpacing} />
                    <Text style={styles.fieldLabel}>Restrict by gender?</Text>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setGenderMode("none")}
                    >
                      <Ionicons
                        name={
                          genderMode === "none"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={
                          genderMode === "none"
                            ? COLORS.primary
                            : LIGHT_TEXT_COLOR
                        }
                      />
                      <Text
                        style={[
                          styles.radioText,
                          genderMode === "none" && styles.radioTextActive,
                        ]}
                      >
                        No restriction
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.radioRow}
                      onPress={() => setGenderMode("restricted")}
                    >
                      <Ionicons
                        name={
                          genderMode === "restricted"
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={
                          genderMode === "restricted"
                            ? COLORS.primary
                            : LIGHT_TEXT_COLOR
                        }
                      />
                      <Text
                        style={[
                          styles.radioText,
                          genderMode === "restricted" && styles.radioTextActive,
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>

                    {genderMode === "restricted" && (
                      <View style={styles.genderChipsContainer}>
                        {["Male", "Female", "Non-binary"].map((g) => (
                          <TouchableOpacity
                            key={g}
                            style={[
                              styles.genderChip,
                              currentTicket.gender_restriction === g &&
                                styles.genderChipActive,
                            ]}
                            onPress={() =>
                              setCurrentTicket({
                                ...currentTicket,
                                gender_restriction: g,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.genderChipText,
                                currentTicket.gender_restriction === g &&
                                  styles.genderChipTextActive,
                              ]}
                            >
                              {g === "Male" ? "M" : g === "Female" ? "F" : "NB"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Date Pickers (Invisible normally) */}
                {showSalesStartPicker && (
                  <DateTimePicker
                    value={currentTicket.sales_start_date || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowSalesStartPicker(false);
                      if (date)
                        setCurrentTicket({
                          ...currentTicket,
                          sales_start_date: date,
                        });
                    }}
                  />
                )}
                {showSalesEndPicker && (
                  <DateTimePicker
                    value={currentTicket.sales_end_date || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={currentTicket.sales_start_date || undefined}
                    maximumDate={
                      eventStartDate ? new Date(eventStartDate) : undefined
                    }
                    onChange={(event, date) => {
                      setShowSalesEndPicker(false);
                      if (date)
                        setCurrentTicket({
                          ...currentTicket,
                          sales_end_date: date,
                        });
                    }}
                  />
                )}
              </KeyboardAwareScrollView>

              {/* LIVE PREVIEW CARD */}
              {!isKeyboardVisible && (
                <View style={styles.livePreviewContainer}>
                  <View style={styles.previewCard}>
                    <View style={styles.previewCardHeader}>
                      <Text style={styles.previewCardTitle} numberOfLines={1}>
                        🎟 {currentTicket.name || "Ticket Name"}
                      </Text>
                      <Text style={styles.previewCardPrice}>
                        {currentTicket.base_price &&
                        parseFloat(currentTicket.base_price) > 0
                          ? `₹${parseFloat(currentTicket.base_price).toLocaleString("en-IN")}`
                          : "Free"}
                      </Text>
                    </View>
                    <Text style={styles.previewCardMeta}>
                      {capacityMode === "limited" &&
                      currentTicket.total_quantity
                        ? `Limited to ${currentTicket.total_quantity}`
                        : "Unlimited capacity"}{" "}
                      •{" "}
                      {currentTicket.visibility === "invite_only"
                        ? "Invite Only"
                        : "Public"}{" "}
                      •{" "}
                      {genderMode === "restricted" &&
                      currentTicket.gender_restriction &&
                      currentTicket.gender_restriction !== "all"
                        ? `${currentTicket.gender_restriction} Only`
                        : "All genders"}
                    </Text>
                  </View>
                </View>
              )}

              {/* STICKY FOOTER */}
              <KeyboardStickyView
                offset={{ closed: 0, opened: 0 }}
                style={styles.stickyFooterContainer}
              >
                <View
                  style={[
                    styles.stickyFooter,
                    { paddingBottom: Math.max(insets.bottom, 20) },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.primaryAddButton,
                      !currentTicket.name.trim() &&
                        styles.primaryAddButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={!currentTicket.name.trim()}
                  >
                    <Text style={styles.primaryAddButtonText}>
                      {editingIndex !== null ? "Update Ticket" : "Add Ticket"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardStickyView>
            </View>
          </View>
        </Modal>
      </View>
    );
  },
);

TicketTypesEditor.displayName = "TicketTypesEditor";

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyCardContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  emptyCardSubtext: {
    fontSize: 14,
    marginTop: 4,
    color: "#6B7280",
    lineHeight: 20,
  },
  emptyAddButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyAddButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  // --- TICKET TILE ---
  ticketTile: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  tileIconContainer: {
    paddingTop: 4,
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tileContent: {
    flex: 1,
  },
  tileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tileName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 8,
  },
  tileBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tileBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#166534",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tileBadgeSoldOut: {
    backgroundColor: "#FEE2E2",
  },
  tileBadgeTextSoldOut: {
    color: "#991B1B",
  },
  tilePrice: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 12,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
    fontWeight: "500",
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  tileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  visibilityText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  // --- MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontFamily: FONTS.primary,
    fontSize: 22,
    color: TEXT_COLOR,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  fieldLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  pillContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pillOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    gap: 6,
  },
  pillOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  pillOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  pillOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  floatingFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  saveButton: {
    borderRadius: 30,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    ...SHADOWS.primaryGlow,
  },
  saveButtonGradient: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // --- Discount viz on tile ---
  discountPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  tilePriceStruck: {
    fontSize: 16,
    fontWeight: "500",
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
  },
  // --- Sales Window ---
  salesWindowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
  },
  datePickerBtnText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_COLOR,
  },
  // --- Helper & Validation ---
  helperText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 6,
    fontWeight: "400",
  },
  validationError: {
    fontSize: 13,
    color: "#EF4444",
    marginTop: 6,
    fontWeight: "500",
  },
  validationWarning: {
    fontSize: 13,
    color: "#F59E0B",
    marginTop: 6,
    fontWeight: "500",
  },
  // --- Compact Gender Pills ---
  compactPill: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  compactPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  compactPillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#4B5563",
  },
  compactPillTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  // --- REDESIGN STYLES ---
  sectionHeader: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6B7280",
    marginBottom: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 32,
  },
  fieldSpacing: {
    height: 20,
  },
  quickChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: COLORS.primary,
  },
  quickChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#4B5563",
  },
  quickChipTextActive: {
    color: COLORS.primary,
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    height: 48,
  },
  currencySymbol: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#9CA3AF",
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: TEXT_COLOR,
    textAlign: "right",
  },
  inputHelper: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  radioRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#374151",
  },
  radioTextActive: {
    color: COLORS.primary,
  },
  inlineNumberInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: FONTS.regular,
    fontSize: 16,
    width: 80,
    marginLeft: 12,
    textAlign: "center",
  },
  advancedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  advancedHeaderText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#374151",
  },
  advancedContainer: {
    marginTop: 16,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  customDatesContainer: {
    marginTop: 12,
    gap: 12,
    paddingLeft: 32,
  },
  datePickerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#4B5563",
  },
  datePickerBtnCompact: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 140,
    alignItems: "center",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 4,
    height: 44,
  },
  segmentBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#4B5563",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  genderChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingLeft: 32,
  },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  genderChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  genderChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#4B5563",
  },
  genderChipTextActive: {
    color: COLORS.primary,
  },
  livePreviewContainer: {
    position: "absolute",
    bottom: 92,
    left: 20,
    right: 20,
    zIndex: 10,
    elevation: 10,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  previewCardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: "#111827",
    flex: 1,
    marginRight: 12,
  },
  previewCardPrice: {
    fontFamily: FONTS.black,
    fontSize: 18,
    color: "#111827",
  },
  previewCardMeta: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#6B7280",
  },
  stickyFooterContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  stickyFooter: {
    height: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#374151",
  },
  primaryAddButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
  },
  primaryAddButtonDisabled: {
    opacity: 0.5,
  },
  primaryAddButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});

export default TicketTypesEditor;
