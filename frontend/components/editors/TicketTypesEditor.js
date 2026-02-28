/**
 * TicketTypesEditor - Component for managing event ticket tiers
 * Used in CreateEventModal and EditEventModal to add/edit/remove ticket types
 */
import React, {
  useState,
  useRef,
  useEffect,
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
  LayoutAnimation,
  UIManager,
} from "react-native";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Ticket,
  Earth,
  Lock,
  Users,
  User,
  CalendarDays,
  Check,
  BadgePercent,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import CustomDatePicker from "../../components/ui/CustomDatePicker";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
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
      promos = [],
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
    const [showSalesDatePicker, setShowSalesDatePicker] = useState(false);

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

    const [alertConfig, setAlertConfig] = useState(null);

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
        setAlertConfig({
          visible: true,
          title: "Required",
          message: "Please enter a ticket name",
          primaryAction: {
            text: "OK",
            onPress: () => setAlertConfig(null),
          },
        });
        return;
      }

      // Sales window hard validation
      if (
        currentTicket.sales_start_date &&
        currentTicket.sales_end_date &&
        currentTicket.sales_end_date < currentTicket.sales_start_date
      ) {
        setAlertConfig({
          visible: true,
          title: "Invalid Sales Window",
          message: "Sales end date cannot be before sales start date.",
          primaryAction: {
            text: "OK",
            onPress: () => setAlertConfig(null),
          },
        });
        return;
      }
      if (
        salesMode === "custom" &&
        currentTicket.sales_end_date &&
        eventStartDate &&
        currentTicket.sales_end_date > new Date(eventStartDate)
      ) {
        setAlertConfig({
          visible: true,
          title: "Invalid Sales Window",
          message: "Sales must close before the event starts.",
          primaryAction: {
            text: "OK",
            onPress: () => setAlertConfig(null),
          },
        });
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
        setAlertConfig({
          visible: true,
          title: "Cannot Delete Ticket",
          message: `This ticket type has ${ticket.sold_count} sold ticket(s). You cannot delete a ticket type that has been purchased by users.\n\nYou can edit the ticket details instead.`,
          primaryAction: {
            text: "OK",
            onPress: () => setAlertConfig(null),
          },
        });
        return;
      }

      setAlertConfig({
        visible: true,
        title: "Delete Ticket Type",
        message: "Are you sure you want to delete this ticket type?",
        secondaryAction: {
          text: "Cancel",
          onPress: () => setAlertConfig(null),
        },
        primaryAction: {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updated = ticketTypes.filter((_, i) => i !== index);
            onChange(updated);
            setAlertConfig(null);
          },
        },
      });
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

    // --- Find ALL applicable discounts for a ticket ---
    const getApplicableDiscounts = useCallback(
      (ticket) => {
        const price = parseFloat(ticket.base_price) || 0;
        if (price <= 0) return [];

        const now = new Date();
        const results = [];

        for (const p of promos) {
          if (p.is_active === false) continue;

          const applies =
            !p.applies_to ||
            p.applies_to === "all" ||
            (p.applies_to === "specific" &&
              p.selected_tickets &&
              p.selected_tickets.includes(ticket.name));
          if (!applies) continue;

          if (p.offer_type === "early_bird") {
            if (
              p.trigger === "by_date" &&
              p.valid_until &&
              new Date(p.valid_until) < now
            )
              continue;
          }

          const discounted =
            p.discount_type === "percentage"
              ? price - (price * (parseFloat(p.discount_value) || 0)) / 100
              : Math.max(0, price - (parseFloat(p.discount_value) || 0));
          const savingsPct = Math.round(((price - discounted) / price) * 100);

          results.push({
            original: price,
            discounted,
            savingsPct,
            offerType: p.offer_type,
            name:
              p.name || (p.offer_type === "early_bird" ? "Early Bird" : p.code),
          });
        }

        // Sort by best discount first (lowest discounted price)
        results.sort((a, b) => a.discounted - b.discounted);
        return results;
      },
      [promos],
    );

    // --- DiscountPreview: auto-cycles through applicable discounts ---
    const DiscountPreview = ({ discounts, formatPrice }) => {
      const [activeIdx, setActiveIdx] = useState(0);
      const timerRef = useRef(null);

      // Auto-cycle every 3s when multiple discounts
      useEffect(() => {
        if (discounts.length <= 1) return;
        timerRef.current = setInterval(() => {
          setActiveIdx((prev) => (prev + 1) % discounts.length);
        }, 3000);
        return () => clearInterval(timerRef.current);
      }, [discounts.length]);

      // Reset index if discounts change
      useEffect(() => {
        setActiveIdx(0);
      }, [discounts.length]);

      const d = discounts[activeIdx] || discounts[0];
      if (!d) return null;

      const isEarlyBird = d.offerType === "early_bird";

      return (
        <View>
          <View style={styles.discountPriceRow}>
            <Text style={styles.tilePriceStruck}>
              {formatPrice(d.original)}
            </Text>
            <Text style={styles.tilePrice}>
              <Text style={styles.currencySymbol}>₹</Text>
              {d.discounted
                ? parseFloat(d.discounted).toLocaleString("en-IN")
                : "0"}
            </Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{d.savingsPct}% OFF</Text>
            </View>
          </View>
          {/* Offer tag with icon */}
          <TouchableOpacity
            style={styles.offerTag}
            onPress={() => {
              if (discounts.length > 1) {
                clearInterval(timerRef.current);
                setActiveIdx((prev) => (prev + 1) % discounts.length);
                // Restart timer
                timerRef.current = setInterval(() => {
                  setActiveIdx((prev) => (prev + 1) % discounts.length);
                }, 3000);
              }
            }}
            activeOpacity={discounts.length > 1 ? 0.6 : 1}
          >
            {isEarlyBird ? (
              <Zap size={12} color="#EA580C" fill="#EA580C" />
            ) : (
              <BadgePercent size={12} color="#16A34A" />
            )}
            <Text
              style={[
                styles.offerTagText,
                { color: isEarlyBird ? "#EA580C" : "#16A34A" },
              ]}
              numberOfLines={1}
            >
              {d.name}
            </Text>
            {discounts.length > 1 && (
              <Text style={styles.offerTagCounter}>
                {activeIdx + 1}/{discounts.length}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    };

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
                <Ticket size={24} color="#FFFFFF" />
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
          const discounts = getApplicableDiscounts(ticket);

          return (
            <View key={index} style={styles.ticketTile}>
              {/* Left Tile Icon */}
              <View style={styles.tileIconContainer}>
                {status.label === "Active" ? (
                  <LinearGradient
                    colors={["#EEF2FF", "#C7D2FE"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tileIconCircle}
                  >
                    <Ticket size={20} color={COLORS.primary} />
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.tileIconCircle,
                      { backgroundColor: "#F3F6FB" },
                    ]}
                  >
                    <Ticket size={20} color="#64748B" />
                  </View>
                )}
              </View>

              {/* Right Content */}
              <View style={styles.tileContent}>
                <View style={styles.tileHeader}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {ticket.name}
                  </Text>
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: status.dotColor },
                      ]}
                    />
                    <Text style={styles.statusText}>{status.label}</Text>
                  </View>
                </View>

                {/* Price + Discount Preview */}
                {discounts.length > 0 ? (
                  <DiscountPreview
                    discounts={discounts}
                    formatPrice={formatPrice}
                  />
                ) : !ticket.base_price || ticket.base_price === 0 ? (
                  <Text style={styles.tilePrice}>Free</Text>
                ) : (
                  <Text style={styles.tilePrice}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    {parseFloat(ticket.base_price).toLocaleString("en-IN")}
                  </Text>
                )}

                {ticket.total_quantity ? (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progress}%` },
                          isSoldOut && { backgroundColor: "#EF4444" },
                          progress === 0 && { backgroundColor: "transparent" },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { marginTop: 6 }]}>
                      {soldCount} / {ticket.total_quantity} sold
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.progressText}>
                    {soldCount} sold · Unlimited capacity
                  </Text>
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
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(index)}
                  >
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
                <View>
                  <Text style={styles.modalTitle}>
                    {editingIndex !== null ? "Edit Ticket" : "Add Ticket"}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {editingIndex !== null
                      ? "Update ticket tier details"
                      : "Create a new ticket tier"}
                  </Text>
                </View>
              </View>

              <KeyboardAwareScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 280 }}
                bottomOffset={80}
              >
                {/* SECTION 1: TICKET DETAILS */}
                <View style={styles.elevatedCard}>
                  <Text style={styles.fieldLabel}>Ticket Name</Text>
                  <TextInput
                    style={styles.input}
                    value={currentTicket.name}
                    onChangeText={(text) =>
                      setCurrentTicket({ ...currentTicket, name: text })
                    }
                    placeholder="e.g., General"
                    placeholderTextColor="#94A3B8"
                  />
                  <View style={styles.presetPillsContainer}>
                    {["General", "VIP", "Early Access", "Couple"].map(
                      (preset) => (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.presetPill,
                            currentTicket.name === preset &&
                              styles.presetPillActive,
                          ]}
                          onPress={() =>
                            setCurrentTicket({ ...currentTicket, name: preset })
                          }
                        >
                          <Text
                            style={[
                              styles.presetPillText,
                              currentTicket.name === preset &&
                                styles.presetPillTextActive,
                            ]}
                          >
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>

                  <View style={styles.fieldSpacing} />

                  <Text style={styles.fieldLabel}>Description •Optional</Text>
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
                    placeholderTextColor="#94A3B8"
                    multiline
                  />
                </View>
                {/* ROUND OFF ELEVATED CARD 2 */}
                <View style={styles.elevatedCard}>
                  <Text style={styles.fieldLabel}>Price</Text>
                  <View style={styles.priceContainer}>
                    <View style={styles.currencyBadge}>
                      <Text style={styles.currencySymbolBadge}>₹</Text>
                    </View>
                    <TextInput
                      style={styles.priceInputLarge}
                      value={currentTicket.base_price}
                      onChangeText={(text) =>
                        setCurrentTicket({ ...currentTicket, base_price: text })
                      }
                      placeholder="0.00"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.priceHelperRow}>
                    {!currentTicket.base_price ||
                    parseFloat(currentTicket.base_price) === 0 ? (
                      <View style={styles.freeBadge}>
                        <Text style={styles.freeBadgeText}>FREE TICKET</Text>
                      </View>
                    ) : (
                      <Text style={styles.paidCaption}>Paid ticket</Text>
                    )}
                  </View>

                  <View style={styles.fieldSpacing} />
                  <Text style={styles.fieldLabel}>Capacity</Text>
                  <View style={styles.segmentedToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.segmentToggleButton,
                        capacityMode === "unlimited" &&
                          styles.segmentToggleButtonActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setCapacityMode("unlimited");
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentToggleText,
                          capacityMode === "unlimited" &&
                            styles.segmentToggleTextActive,
                        ]}
                      >
                        Unlimited
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.segmentToggleButton,
                        capacityMode === "limited" &&
                          styles.segmentToggleButtonActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setCapacityMode("limited");
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentToggleText,
                          capacityMode === "limited" &&
                            styles.segmentToggleTextActive,
                        ]}
                      >
                        Limited
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {capacityMode === "limited" && (
                    <View style={styles.capacityInputWrapper}>
                      <Text style={styles.capacityInputLabel}>Max tickets</Text>
                      <TextInput
                        style={styles.capacityNumberInput}
                        value={currentTicket.total_quantity}
                        onChangeText={(text) =>
                          setCurrentTicket({
                            ...currentTicket,
                            total_quantity: text,
                          })
                        }
                        placeholder="100"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                    </View>
                  )}
                </View>

                {/* SECTION 3: ACCESS & AVAILABILITY */}
                <View style={styles.elevatedCard}>
                  <View style={styles.section3Header}>
                    <Text style={styles.section3Title}>
                      Access & Availability
                    </Text>
                    <Text style={styles.section3Subtitle}>
                      Control who can see and buy this ticket
                    </Text>
                  </View>

                  {/* Sales Window */}
                  <Text style={styles.fieldLabel}>Sales Window</Text>
                  <View style={styles.segmentedToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.segmentToggleButton,
                        salesMode === "duration" &&
                          styles.segmentToggleButtonActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setSalesMode("duration");
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentToggleText,
                          salesMode === "duration" &&
                            styles.segmentToggleTextActive,
                        ]}
                      >
                        Entire Duration
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.segmentToggleButton,
                        salesMode === "custom" &&
                          styles.segmentToggleButtonActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setSalesMode("custom");
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentToggleText,
                          salesMode === "custom" &&
                            styles.segmentToggleTextActive,
                        ]}
                      >
                        Custom Dates
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {salesMode === "duration" && (
                    <Text style={[styles.inputHelper, { color: "#94A3B8" }]}>
                      Defaults to event duration if not customized
                    </Text>
                  )}

                  {salesMode === "custom" && (
                    <View style={styles.customDatesRow}>
                      <TouchableOpacity
                        style={styles.datePillBtn}
                        activeOpacity={0.75}
                        onPress={() => setShowSalesDatePicker(true)}
                      >
                        <CalendarDays
                          size={16}
                          strokeWidth={1.75}
                          color={COLORS.primary}
                        />
                        <Text
                          style={[
                            styles.datePillText,
                            !currentTicket.sales_start_date &&
                              styles.datePillPlaceholder,
                          ]}
                          numberOfLines={1}
                        >
                          {currentTicket.sales_start_date
                            ? new Date(
                                currentTicket.sales_start_date,
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : "Start date"}
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.datePillArrow}>→</Text>

                      <TouchableOpacity
                        style={styles.datePillBtn}
                        activeOpacity={0.75}
                        onPress={() => setShowSalesDatePicker(true)}
                      >
                        <CalendarDays
                          size={16}
                          strokeWidth={1.75}
                          color={COLORS.primary}
                        />
                        <Text
                          style={[
                            styles.datePillText,
                            !currentTicket.sales_end_date &&
                              styles.datePillPlaceholder,
                          ]}
                          numberOfLines={1}
                        >
                          {currentTicket.sales_end_date
                            ? new Date(
                                currentTicket.sales_end_date,
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : "End date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {salesMode === "custom" &&
                    currentTicket.sales_start_date &&
                    currentTicket.sales_end_date &&
                    currentTicket.sales_end_date <
                      currentTicket.sales_start_date && (
                      <Text style={styles.validationError}>
                        End date cannot be before start date
                      </Text>
                    )}
                  {salesMode === "custom" &&
                    currentTicket.sales_end_date &&
                    eventStartDate &&
                    currentTicket.sales_end_date > new Date(eventStartDate) && (
                      <Text style={styles.validationWarning}>
                        Sales must close before the event starts
                      </Text>
                    )}

                  {/* Visibility */}
                  <View style={styles.fieldSpacing} />
                  <Text style={styles.fieldLabel}>Visibility</Text>
                  <View style={styles.visibilityButtonsContainer}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.8}
                      onPress={() =>
                        setCurrentTicket({
                          ...currentTicket,
                          visibility: "public",
                        })
                      }
                    >
                      <LinearGradient
                        colors={
                          currentTicket.visibility === "public"
                            ? ["#3B82F6", "#2563EB"]
                            : ["#F1F5F9", "#F1F5F9"]
                        }
                        style={styles.visibilityBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Earth
                          size={18}
                          strokeWidth={1.75}
                          color={
                            currentTicket.visibility === "public"
                              ? "#FFFFFF"
                              : "#475569"
                          }
                        />
                        <Text
                          style={[
                            styles.visibilityBtnText,
                            currentTicket.visibility === "public" &&
                              styles.visibilityBtnTextActive,
                          ]}
                        >
                          Public
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ flex: 1 }}
                      activeOpacity={0.8}
                      onPress={() =>
                        setCurrentTicket({
                          ...currentTicket,
                          visibility: "invite_only",
                        })
                      }
                    >
                      <LinearGradient
                        colors={
                          currentTicket.visibility === "invite_only"
                            ? ["#3B82F6", "#2563EB"]
                            : ["#F1F5F9", "#F1F5F9"]
                        }
                        style={styles.visibilityBtn}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Lock
                          size={18}
                          strokeWidth={1.75}
                          color={
                            currentTicket.visibility === "invite_only"
                              ? "#FFFFFF"
                              : "#475569"
                          }
                        />
                        <Text
                          style={[
                            styles.visibilityBtnText,
                            currentTicket.visibility === "invite_only" &&
                              styles.visibilityBtnTextActive,
                          ]}
                        >
                          Invite Only
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  {currentTicket.visibility === "invite_only" && (
                    <Text style={styles.inputHelper}>
                      Only users with direct link can purchase
                    </Text>
                  )}

                  {/* Access Control (Gender Restriction) */}
                  <View style={styles.fieldSpacing} />
                  <Text style={styles.fieldLabel}>Access Control</Text>
                  <Text style={styles.inputHelperTop}>
                    Define who this ticket is available to
                  </Text>

                  <View style={styles.choiceTilesColumn}>
                    {[
                      {
                        id: "all",
                        title: "No Restriction",
                        subtitle: "Open to everyone",
                        Icon: Users,
                        tileColor: "#E8F5FF",
                        iconBgColor: "#D0E9FF",
                        iconColor: "#3565F2",
                      },
                      {
                        id: "Male",
                        title: "Men Only",
                        subtitle: "Visible only to male attendees",
                        Icon: User,
                        tileColor: "#EDEDFF",
                        iconBgColor: "#DEDEFF",
                        iconColor: "#4F6EF7",
                      },
                      {
                        id: "Female",
                        title: "Women Only",
                        subtitle: "Visible only to female attendees",
                        Icon: User,
                        tileColor: "#F3EEFF",
                        iconBgColor: "#E9E2FF",
                        iconColor: "#7A5AF8",
                      },
                    ].map((g) => {
                      const isActive =
                        currentTicket.gender_restriction === g.id ||
                        (currentTicket.gender_restriction !== "Male" &&
                          currentTicket.gender_restriction !== "Female" &&
                          g.id === "all");

                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[
                            styles.choiceTile,
                            { backgroundColor: g.tileColor },
                            isActive && styles.choiceTileActive,
                          ]}
                          activeOpacity={0.8}
                          onPress={() => {
                            if (g.id === "all") {
                              setGenderMode("none");
                              setCurrentTicket({
                                ...currentTicket,
                                gender_restriction: "all",
                              });
                            } else {
                              setGenderMode("restricted");
                              setCurrentTicket({
                                ...currentTicket,
                                gender_restriction: g.id,
                              });
                            }
                          }}
                        >
                          <View
                            style={[
                              styles.choiceTileIconBg,
                              { backgroundColor: g.iconBgColor },
                            ]}
                          >
                            <g.Icon
                              size={18}
                              strokeWidth={1.75}
                              color={g.iconColor}
                            />
                          </View>

                          <View style={styles.choiceTileTextWrapper}>
                            <Text style={styles.choiceTileTitle}>
                              {g.title}
                            </Text>
                            <Text style={styles.choiceTileSubtitle}>
                              {g.subtitle}
                            </Text>
                          </View>

                          {isActive && (
                            <View style={styles.choiceTileCheck}>
                              <Check
                                size={16}
                                strokeWidth={2.5}
                                color={COLORS.primary}
                              />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </KeyboardAwareScrollView>

              {/* SALES DATE PICKER MODAL */}
              <CustomDatePicker
                visible={showSalesDatePicker}
                onClose={() => setShowSalesDatePicker(false)}
                startDate={currentTicket.sales_start_date}
                endDate={currentTicket.sales_end_date}
                maxDate={eventStartDate ? new Date(eventStartDate) : undefined}
                onConfirm={({ startDate, endDate }) => {
                  setCurrentTicket({
                    ...currentTicket,
                    sales_start_date: startDate,
                    sales_end_date: endDate,
                  });
                  setShowSalesDatePicker(false);
                }}
              />

              {/* LIVE TICKET PREVIEW CARD */}
              {!isKeyboardVisible && (
                <View style={styles.livePreviewContainer}>
                  <View style={styles.realTicketPreview}>
                    <View style={styles.ticketStubLeft} />
                    <View style={styles.ticketStubRight} />

                    <View style={styles.ticketPreviewHeader}>
                      <View style={styles.ticketIconContainer}>
                        <Ticket size={22} strokeWidth={1.75} color="#D05050" />
                      </View>
                      <View style={styles.ticketPreviewTitleContainer}>
                        <Text style={styles.previewCardTitle} numberOfLines={1}>
                          {currentTicket.name || "Ticket Name"}
                        </Text>
                        <Text style={styles.previewCardMeta}>
                          {capacityMode === "limited" &&
                          currentTicket.total_quantity
                            ? `Limited • ${currentTicket.total_quantity}`
                            : "Unlimited"}
                        </Text>
                      </View>

                      <Text style={styles.ticketPreviewPriceLarge}>
                        {currentTicket.base_price &&
                        parseFloat(currentTicket.base_price) > 0
                          ? `₹${parseFloat(currentTicket.base_price).toLocaleString("en-IN")}`
                          : "FREE"}
                      </Text>
                    </View>

                    <View style={styles.ticketHairlineDivider} />

                    <View style={styles.ticketPreviewFooter}>
                      <View style={styles.ticketPreviewFooterRow}>
                        {currentTicket.visibility === "invite_only" ? (
                          <Lock size={14} strokeWidth={2} color="#64748B" />
                        ) : (
                          <Earth size={14} strokeWidth={2} color="#64748B" />
                        )}
                        <Text style={styles.ticketPreviewFooterText}>
                          {currentTicket.visibility === "invite_only"
                            ? "Invite Only"
                            : "Public"}{" "}
                          •{" "}
                          {genderMode === "restricted" &&
                          currentTicket.gender_restriction &&
                          currentTicket.gender_restriction !== "all"
                            ? `${currentTicket.gender_restriction === "Male" ? "Men Only" : currentTicket.gender_restriction === "Female" ? "Women Only" : currentTicket.gender_restriction}`
                            : "All genders"}
                        </Text>
                      </View>
                      <View style={styles.ticketPreviewFooterRow}>
                        <CalendarDays
                          size={14}
                          strokeWidth={2}
                          color="#64748B"
                        />
                        <Text style={styles.ticketPreviewFooterText}>
                          {salesMode === "duration"
                            ? "Entire duration"
                            : currentTicket.sales_start_date
                              ? `${new Date(currentTicket.sales_start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${
                                  currentTicket.sales_end_date
                                    ? ` → ${new Date(currentTicket.sales_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                                    : ""
                                }`
                              : "Custom dates"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* PREMIUM STICKY CTA WITH BLUR */}
              <KeyboardStickyView
                offset={{ closed: 0, opened: 0 }}
                style={styles.stickyFooterContainer}
              >
                <View style={styles.stickyFooterBlur}>
                  <View
                    style={[
                      styles.stickyFooterContent,
                      { paddingBottom: Math.max(insets.bottom, 20) },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.ghostCancelButton}
                      onPress={() => setShowModal(false)}
                    >
                      <Text style={styles.ghostCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.premiumCreateButton,
                        !currentTicket.name.trim() &&
                          styles.premiumCreateButtonDisabled,
                      ]}
                      onPress={handleSave}
                      disabled={!currentTicket.name.trim()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.premiumCreateButtonText}>
                        {editingIndex !== null
                          ? "Update Ticket"
                          : "Create Ticket"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardStickyView>
            </View>
          </View>
        </Modal>

        {/* ── CUSTOM ALERT MODAL ── */}
        {alertConfig && (
          <CustomAlertModal
            visible={alertConfig.visible}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={() => setAlertConfig(null)}
            primaryAction={alertConfig.primaryAction}
            secondaryAction={alertConfig.secondaryAction}
          />
        )}
      </View>
    );
  },
);

TicketTypesEditor.displayName = "TicketTypesEditor";

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: TEXT_COLOR,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5EAF2",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonText: {
    fontFamily: "BasicCommercial-Bold",
    color: "#111827",
    fontSize: 15,
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
    borderColor: "#E8ECF4",
    padding: 20,
    gap: 16,
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
    fontFamily: "BasicCommercial-Bold",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: 8,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#4B5563",
  },
  tilePrice: {
    fontSize: 18,
    fontFamily: "Manrope-SemiBold",
    color: "#111827",
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 15,
    color: "#6B7280",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: "Manrope-Medium",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 999,
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
    paddingVertical: 4,
    marginLeft: 12,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#4B5563",
  },

  // --- MODAL ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#F7F9FC",
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
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#374151",
    marginBottom: 8,
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
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#EA580C",
  },
  offerTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  offerTagText: {
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
    maxWidth: 120,
  },
  offerTagCounter: {
    fontSize: 10,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    marginLeft: 2,
  },
  // --- Sales Window ---
  salesWindowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  // --- CUSTOM DATE PILL ROW ---
  customDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  datePillBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F0F5FF",
    borderWidth: 1,
    borderColor: "#D8E4FF",
  },
  datePillText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#1E3A8A",
  },
  datePillPlaceholder: {
    color: "#94A3B8",
    fontFamily: FONTS.regular,
  },
  datePillArrow: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: "#94A3B8",
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
  // --- PREMIUM ELEVATED CARDS ---
  elevatedCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  elevatedCardAdvanced: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  // --- IDENTITY CARD (Name & Presets) ---
  presetPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  presetPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#F2F4F8",
    borderWidth: 1,
    borderColor: "#E6EBF2",
  },
  presetPillActive: {
    backgroundColor: "#E9EDF5",
    borderColor: "#B0BAD0",
    borderWidth: 1,
  },
  presetPillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#1C1F26",
  },
  presetPillTextActive: {
    fontFamily: FONTS.semiBold,
    color: "#1C1F26",
  },

  // --- PRICING CARD ---
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 64,
  },
  currencyBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  currencySymbolBadge: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#475569",
  },
  priceInputLarge: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 24,
    color: "#0F172A",
  },
  priceHelperRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  freeBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  freeBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: "#166534",
    letterSpacing: 0.5,
  },
  paidCaption: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#94A3B8",
  },

  // --- SEGMENTED TOGGLES (Capacity, Sales Window, Visibility) ---
  segmentedToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F6FB",
    borderRadius: 14,
    padding: 4,
    height: 44,
    marginTop: 8,
  },
  segmentToggleButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  segmentToggleButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentToggleText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "rgba(100, 116, 139, 0.7)",
  },
  segmentToggleTextActive: {
    fontFamily: FONTS.semiBold,
    color: "#0F172A",
  },
  // --- VISIBILITY (Event Spec) ---
  visibilityButtonsContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  visibilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  visibilityBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#475569",
  },
  visibilityBtnTextActive: {
    color: "#FFFFFF",
  },

  capacityInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  capacityInputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#475569",
  },
  capacityNumberInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    width: 100,
    height: 44,
    textAlign: "center",
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#0F172A",
  },

  inputHelperTop: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#64748B",
    marginTop: -4,
    marginBottom: 8,
  },
  // --- NEW CHOICE TILES ---
  choiceTilesColumn: {
    marginTop: 8,
    gap: 12,
  },
  choiceTile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECF4",
  },
  choiceTileActive: {
    borderWidth: 1.5,
    borderColor: "#3565F2",
    shadowColor: "#3565F2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  choiceTileIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0", // Default soft grey
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  choiceTileActiveIconBg: {
    backgroundColor: "#DBEAFE", // Soft blue when active - handled via JS or inherited? Actually let's just use one soft blue if the user didn't specify active/inactive icon bg state. The prompt says "Icon background: Soft blue circle (32px)"
  },
  // Re-define icon bg to just be blue always
  choiceTileIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EBF1FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  choiceTileTextWrapper: {
    flex: 1,
  },
  choiceTileTitle: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 2,
  },
  choiceTileSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
    opacity: 0.8,
  },
  choiceTileCheck: {
    marginLeft: 12,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },

  // --- OVERRIDES FOR SECTION 3 ACCESS & AVAILABILITY HEADER ---
  section3Header: {
    marginBottom: 20,
  },
  section3Title: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#0F172A",
  },
  section3Subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // --- LIVE TICKET PREVIEW CARD ---
  livePreviewContainer: {
    position: "absolute",
    bottom: 96,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  realTicketPreview: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  ticketStubLeft: {
    position: "absolute",
    left: -12,
    top: "50%",
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    opacity: 0.05,
  },
  ticketStubRight: {
    position: "absolute",
    right: -12,
    top: "50%",
    marginTop: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    opacity: 0.05,
  },
  ticketPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 0,
  },
  ticketIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FEF0EF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  ticketPreviewTitleContainer: {
    flex: 1,
  },
  previewCardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 2,
  },
  previewCardMeta: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#64748B",
  },
  ticketPreviewPriceLarge: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#0F172A",
  },
  ticketHairlineDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 16,
  },
  ticketPreviewFooter: {
    gap: 6,
  },
  ticketPreviewFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketPreviewFooterText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#64748B",
  },

  // --- STICKY FOOTER WITH BLUR ---
  stickyFooterContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  stickyFooterBlur: {
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Native fallback if blur isn't used wrapper
    borderTopWidth: 1,
    borderTopColor: "rgba(229, 231, 235, 0.5)",
  },
  stickyFooterContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ghostCancelButton: {
    flex: 1,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 26,
  },
  ghostCancelButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#4B5563",
  },
  premiumCreateButton: {
    flex: 2,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumCreateButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  premiumCreateButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default TicketTypesEditor;
