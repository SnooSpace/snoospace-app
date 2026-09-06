/**
 * TicketViewScreen - Display user's event ticket with QR code
 * Shows: QR code for entry, event details, ticket breakdown, per-tier refund request
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Video,
  ChevronRight,
  Clock,
  AlertCircle,
  TriangleAlert,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import {
  getMyTicket, submitRefundRequest, getRefundRequests,
  getPostponementDecision, submitPostponementOptOut, submitPostponementKeep,
} from "../../api/events";
import { useLocationName } from "../../utils/locationNameCache";
import { detectMeetingPlatform } from "../../utils/meetingPlatformUtils";
import SnooLoader from "../../components/ui/SnooLoader";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";

const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1A2D4A";
const MUTED_TEXT = "#6B7280";
const PRIMARY_COLOR = "#2962FF";
const SUCCESS_COLOR = "#16A34A";
const WARNING_COLOR = "#D97706";
const ERROR_COLOR = "#EF4444";

export default function TicketViewScreen({ route, navigation }) {
  const { eventId } = route.params || {};
  const insets = useSafeAreaInsets();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refund state
  const [refundRequests, setRefundRequests] = useState([]); // array, keyed by ticket_type_id
  const [refundLoading, setRefundLoading] = useState(false);
  const [showRefundSheet, setShowRefundSheet] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null); // { ticketTypeId, name, totalPrice, refundPolicy }
  const [refundReason, setRefundReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Postponement state
  const [postponementDecision, setPostponementDecision] = useState(null); // null = not loaded yet
  const [postponeSubmitting, setPostponeSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0); // seconds remaining in opt-out window

  // Resolve location name with fallback
  const rawLocationName = useLocationName(ticket?.locationUrl, {
    fallback: ticket?.eventType === "virtual" ? "Virtual Event" : "Location TBD",
  });
  const displayLocation = ticket?.locationName || rawLocationName;

  useEffect(() => {
    loadTicket();
  }, [eventId]);

  const loadTicket = async () => {
    if (!eventId) {
      setError("No event specified");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await getMyTicket(eventId);
      if (response?.ticket) {
        setTicket(response.ticket);
        // Load refund request statuses
        loadRefundRequests(response.ticket.registrationId);
        // Load postponement decision (non-fatal if event not postponed)
        loadPostponementDecision();
      } else if (response?.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error("Error loading ticket:", err);
      setError(err.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  };

  const loadRefundRequests = async (registrationId) => {
    if (!registrationId) return;
    try {
      setRefundLoading(true);
      const res = await getRefundRequests(registrationId);
      if (res?.requests) setRefundRequests(res.requests);
    } catch (e) {
      // Non-fatal — refund UI just won't show status
      console.warn("Could not load refund requests:", e.message);
    } finally {
      setRefundLoading(false);
    }
  };

  const loadPostponementDecision = async () => {
    if (!eventId) return;
    try {
      const res = await getPostponementDecision(eventId);
      if (res?.has_decision) {
        setPostponementDecision(res);
        if (res.window_open && res.window_seconds_remaining > 0) {
          setCountdown(res.window_seconds_remaining);
        }
      }
    } catch (e) {
      // Non-fatal — postponement banner just won't show
      console.warn("Could not load postponement decision:", e.message);
    }
  };

  // Live countdown ticker — updates every second while window is open
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m remaining`;
    if (m > 0) return `${m}m ${s}s remaining`;
    return `${s}s remaining`;
  };


  // Returns the refund_request row for a given ticket_type_id, or null
  const getRequestForTier = useCallback(
    (ticketTypeId) =>
      refundRequests.find((r) => r.ticket_type_id === ticketTypeId) || null,
    [refundRequests],
  );

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateTime = (dateString) => {
    return `${formatDate(dateString)} • ${formatTime(dateString)}`;
  };

  const handleOpenLocation = () => {
    if (ticket?.locationUrl) {
      Linking.openURL(ticket.locationUrl).catch(() => {
        Alert.alert("Error", "Unable to open maps");
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "registered":
        return SUCCESS_COLOR;
      case "attended":
        return PRIMARY_COLOR;
      case "cancelled":
      case "revoked":
        return ERROR_COLOR;
      default:
        return MUTED_TEXT;
    }
  };

  const getStatusBgColor = (status) => {
    switch (status) {
      case "registered":
        return "#E8F5E9";
      case "attended":
        return "#E0F2FE";
      case "cancelled":
      case "revoked":
        return "#FEE2E2";
      default:
        return "#F3F4F6";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "registered":
        return "Confirmed";
      case "attended":
        return "Attended";
      case "cancelled":
        return "Cancelled";
      case "revoked":
        return "Revoked";
      default:
        return status;
    }
  };

  // Buyer-facing refund request status label — intentionally neutral,
  // does NOT expose auto_approved vs manual_review distinction to buyer.
  const getRefundStatusDisplay = (req) => {
    if (!req) return null;
    switch (req.status) {
      case "auto_approved":
      case "manual_review":
      case "pending_review":
        return { label: "Refund Requested — pending review", color: WARNING_COLOR, bg: "#FFFBEB" };
      case "approved":
        return { label: "Refund Approved — processing", color: SUCCESS_COLOR, bg: "#ECFDF5" };
      case "rejected":
        return { label: "Refund Request Rejected", color: ERROR_COLOR, bg: "#FEF2F2" };
      case "completed":
        return { label: "Refund Completed ✓", color: SUCCESS_COLOR, bg: "#ECFDF5" };
      default:
        return { label: req.status, color: MUTED_TEXT, bg: "#F3F4F6" };
    }
  };

  const handleOpenRefundSheet = (tier) => {
    setSelectedTier(tier);
    setRefundReason("");
    setShowRefundSheet(true);
  };

  const handleSubmitRefund = async () => {
    if (!selectedTier || !ticket?.registrationId) return;
    try {
      setSubmitting(true);
      const res = await submitRefundRequest(
        ticket.registrationId,
        selectedTier.ticketTypeId,
        refundReason.trim() || undefined,
      );
      if (res?.success) {
        setShowRefundSheet(false);
        // Refresh refund statuses
        await loadRefundRequests(ticket.registrationId);
      } else {
        Alert.alert("Error", res?.error || "Failed to submit refund request");
      }
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to submit refund request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading ticket...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Ticket</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centerContainer}>
          <AlertCircle size={60} color={ERROR_COLOR} strokeWidth={2} />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTicket} activeOpacity={0.85}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCancelled = ticket?.status === "cancelled";
  const isRevoked = ticket?.status === "revoked";
  const isInvalid = isCancelled || isRevoked;
  const isPast = new Date(ticket?.eventDate) < new Date();

  // Compute refundable tiers: only show refund UI for tickets where refund is allowed
  // and registration is still active (not cancelled/revoked).
  const refundableTiers = (!isInvalid && ticket?.tickets || []).filter(
    (t) => t.refundPolicy?.allowed === true,
  );

  // Computed refund amount preview for the sheet
  const refundPreviewAmount = selectedTier
    ? (selectedTier.totalPrice * ((selectedTier.refundPolicy?.percentage ?? 100) / 100))
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Ticket</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket Card */}
        <View style={styles.ticketCard}>
          {/* QR Code Section */}
          <View
            style={[styles.qrSection, isInvalid && styles.qrSectionCancelled]}
          >
            <View
              style={[
                styles.qrContainer,
                isInvalid && styles.qrContainerCancelled,
              ]}
            >
              <QRCode
                value={ticket?.qrCodeData || "INVALID"}
                size={200}
                backgroundColor={isInvalid ? "#F3F4F6" : "#FFFFFF"}
                color={isInvalid ? "#9CA3AF" : "#000000"}
              />
            </View>
            {isRevoked ? (
              <Text style={styles.qrCancelledText}>Ticket Revoked</Text>
            ) : isCancelled ? (
              <Text style={styles.qrCancelledText}>Ticket Cancelled</Text>
            ) : (
              <Text style={styles.qrHint}>Scan this QR code at entry</Text>
            )}
          </View>

          {/* Revoked Banner */}
          {isRevoked && ticket?.revokedReason && (
            <View style={styles.revokedBanner}>
              <TriangleAlert size={18} color={ERROR_COLOR} strokeWidth={2} />
              <Text style={styles.revokedText}>{ticket.revokedReason}</Text>
            </View>
          )}

          {/* Dashed Divider with Semicircular coupon bite notches */}
          <View style={styles.dashedDivider}>
            <View style={styles.circleLeft} />
            <View style={styles.dashedLine} />
            <View style={styles.circleRight} />
          </View>

          {/* Event Info */}
          <View style={styles.eventSection}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {ticket?.eventTitle}
            </Text>

            {/* Organizer/Community Row */}
            <View style={styles.communityRow}>
              {ticket?.communityLogo && /^https?:\/\//.test(ticket.communityLogo) ? (
                <Image
                  source={{ uri: ticket.communityLogo }}
                  style={styles.communityAvatar}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(ticket?.communityName || "Community")}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.communityAvatar, styles.communityAvatarGradient]}
                >
                  <Text style={styles.communityInitials}>
                    {getInitials(ticket?.communityName || "C")}
                  </Text>
                </LinearGradient>
              )}
              <Text style={styles.communityName} numberOfLines={1}>
                {ticket?.communityName}
              </Text>
            </View>

            {/* Date & Time Row */}
            <View style={styles.infoRow}>
              <View style={styles.iconContainer}>
                <Calendar size={18} color={PRIMARY_COLOR} strokeWidth={2} />
              </View>
              <Text style={styles.infoText}>
                {formatDateTime(ticket?.eventDate)}
              </Text>
            </View>

            {/* Location Row */}
            {ticket?.locationUrl && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={handleOpenLocation}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <MapPin size={18} color={PRIMARY_COLOR} strokeWidth={2} />
                </View>
                <Text style={styles.infoText} numberOfLines={2}>
                  {displayLocation || "View Location"}
                </Text>
                <ChevronRight size={16} color={MUTED_TEXT} strokeWidth={2.2} />
              </TouchableOpacity>
            )}

            {/* Virtual / Hybrid Meeting Link Row */}
            {!!ticket?.virtualLink && (() => {
              const platformInfo = detectMeetingPlatform(
                ticket.virtualLink,
                ticket?.meetingPlatform
              );
              return (
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => {
                    const raw = ticket.virtualLink;
                    const match = raw.match(/https?:\/\/[^\s]+/i);
                    const targetUrl = match ? match[0] : raw.trim();
                    if (targetUrl) {
                      Linking.openURL(targetUrl).catch(() => {
                        Alert.alert("Unable to open link", "Please check your internet connection or install the meeting app.");
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: platformInfo.bg || "rgba(41, 98, 255, 0.08)" }]}>
                    <Video size={18} color={platformInfo.color || PRIMARY_COLOR} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.infoText} numberOfLines={1}>
                      {platformInfo.id !== "virtual" ? `Join on ${platformInfo.name}` : "Join Video Call"}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Manrope-Regular",
                        fontSize: 12,
                        color: MUTED_TEXT,
                        marginTop: 2,
                      }}
                    >
                      Tap to open meeting link
                    </Text>
                  </View>
                  <ChevronRight size={16} color={MUTED_TEXT} strokeWidth={2.2} />
                </TouchableOpacity>
              );
            })()}
          </View>
        </View>

        {/* Ticket Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Ticket Details</Text>

          {ticket?.tickets?.map((t, index) => (
            <View key={index} style={styles.ticketRow}>
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketName}>
                  {t.quantity}× {t.name}
                </Text>
                <Text style={styles.ticketPrice}>
                  ₹{t.unitPrice.toLocaleString("en-IN")} each
                </Text>
              </View>
              <Text style={styles.ticketTotal}>
                ₹{t.totalPrice.toLocaleString("en-IN")}
              </Text>
            </View>
          ))}

          {ticket?.discountAmount > 0 && (
            <View style={styles.ticketRow}>
              <Text style={styles.discountLabel}>
                Discount {ticket?.promoCode && `(${ticket.promoCode})`}
              </Text>
              <Text style={styles.discountAmount}>
                -₹{ticket.discountAmount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalAmount}>
              ₹{(ticket?.totalAmount || 0).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* Booking Info Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Booking Information</Text>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booking ID</Text>
            <Text style={styles.bookingValue}>#{ticket?.registrationId}</Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booked by</Text>
            <Text style={styles.bookingValue}>{ticket?.memberName}</Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Booked on</Text>
            <Text style={styles.bookingValue}>
              {formatDate(ticket?.registeredAt)}
            </Text>
          </View>

          <View style={styles.bookingRow}>
            <Text style={styles.bookingLabel}>Status</Text>
            <View style={[styles.statusPill, { backgroundColor: getStatusBgColor(ticket?.status) }]}>
              <Text
                style={[
                  styles.statusValue,
                  { color: getStatusColor(ticket?.status) },
                ]}
              >
                {getStatusLabel(ticket?.status)}
              </Text>
            </View>
          </View>

          {isCancelled && ticket?.refundAmount > 0 && (
            <View style={styles.bookingRow}>
              <Text style={styles.bookingLabel}>Refund</Text>
              <Text style={[styles.bookingValue, { color: SUCCESS_COLOR }]}>
                ₹{ticket.refundAmount.toLocaleString("en-IN")}
              </Text>
            </View>
          )}
        </View>

        {/* ── POSTPONEMENT BANNER ── */}
        {/* Shown when buyer has a pending decision on a postponed event */}
        {postponementDecision?.has_decision && (
          <View style={[styles.detailsCard, {
            borderLeftWidth: 4,
            borderLeftColor:
              postponementDecision.decision === 'opted_out_refund'  ? SUCCESS_COLOR :
              postponementDecision.decision === 'kept_ticket'        ? SUCCESS_COLOR :
              postponementDecision.decision === 'auto_kept_no_response' ? MUTED_TEXT :
              postponementDecision.decision === 'auto_refunded_indefinite_cap' ? PRIMARY_COLOR :
              WARNING_COLOR,
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertCircle size={18} color={WARNING_COLOR} />
              <Text style={[styles.sectionTitle, { marginLeft: 6, marginBottom: 0 }]}>
                Event Postponed
              </Text>
            </View>

            {/* Pending — window open */}
            {postponementDecision.decision === 'pending' && postponementDecision.window_open && (
              <>
                <Text style={styles.detailText}>
                  This event has been postponed to a new date. You have until the deadline
                  below to request a full refund if you can no longer attend. No action
                  means your ticket is automatically kept.
                </Text>

                {postponementDecision.new_start_datetime && (
                  <View style={{ marginTop: 10, padding: 10, backgroundColor: '#EFF6FF', borderRadius: 10 }}>
                    <Text style={[styles.labelText, { color: PRIMARY_COLOR }]}>New Date</Text>
                    <Text style={[styles.valueText, { fontWeight: '700' }]}>
                      {formatDate(postponementDecision.new_start_datetime)} · {formatTime(postponementDecision.new_start_datetime)}
                    </Text>
                  </View>
                )}

                {countdown > 0 && (
                  <View style={{ marginTop: 8, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 10, flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={14} color={WARNING_COLOR} />
                    <Text style={{ marginLeft: 6, color: WARNING_COLOR, fontWeight: '600', fontSize: 13 }}>
                      {formatCountdown(countdown)}
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    id="postpone-keep-btn"
                    style={[styles.refundBtn, { flex: 1, backgroundColor: '#F0FDF4', borderColor: SUCCESS_COLOR }]}
                    disabled={postponeSubmitting}
                    onPress={async () => {
                      Alert.alert(
                        "Keep My Ticket",
                        "You'll keep your ticket for the rescheduled event. No refund will be issued.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Confirm", onPress: async () => {
                            setPostponeSubmitting(true);
                            try {
                              await submitPostponementKeep(postponementDecision.decision_id);
                              await loadPostponementDecision();
                            } catch (e) {
                              Alert.alert("Error", e.message || "Could not confirm keep");
                            } finally { setPostponeSubmitting(false); }
                          }},
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.refundBtnText, { color: SUCCESS_COLOR }]}>Keep My Ticket</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    id="postpone-refund-btn"
                    style={[styles.refundBtn, { flex: 1, backgroundColor: '#FEF2F2', borderColor: ERROR_COLOR }]}
                    disabled={postponeSubmitting}
                    onPress={async () => {
                      Alert.alert(
                        "Request Full Refund",
                        `You'll receive a full refund of your ticket price. This cannot be undone once submitted.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Request Refund", style: "destructive", onPress: async () => {
                            setPostponeSubmitting(true);
                            try {
                              await submitPostponementOptOut(postponementDecision.decision_id);
                              await loadPostponementDecision();
                            } catch (e) {
                              Alert.alert("Error", e.message || "Could not process refund request");
                            } finally { setPostponeSubmitting(false); }
                          }},
                        ]
                      );
                    }}
                  >
                    <Text style={[styles.refundBtnText, { color: ERROR_COLOR }]}>Request Refund Instead</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Pending — window not yet open (no new date set) */}
            {postponementDecision.decision === 'pending' && !postponementDecision.window_open && !postponementDecision.new_date_set_at && (
              <Text style={styles.detailText}>
                The organiser has postponed this event. A new date will be announced soon.
                Once the new date is confirmed, you'll have 72 hours to decide whether to
                keep your ticket or request a full refund.
              </Text>
            )}

            {/* Resolved states */}
            {postponementDecision.decision === 'opted_out_refund' && (
              <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10 }}>
                <Text style={{ color: SUCCESS_COLOR, fontWeight: '600', fontSize: 13 }}>
                  ✓ Refund Requested
                </Text>
                <Text style={[styles.detailText, { marginTop: 4 }]}>
                  Your full refund is being processed. You'll receive it within 5–7 business days.
                </Text>
              </View>
            )}

            {(postponementDecision.decision === 'kept_ticket' ||
              postponementDecision.decision === 'auto_kept_no_response') && (
              <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 10 }}>
                <Text style={{ color: SUCCESS_COLOR, fontWeight: '600', fontSize: 13 }}>
                  ✓ Ticket Kept
                </Text>
                <Text style={[styles.detailText, { marginTop: 4 }]}>
                  {postponementDecision.decision === 'auto_kept_no_response'
                    ? 'The opt-out window closed with no action — your ticket has been automatically kept.'
                    : 'You confirmed you\'re keeping your ticket for the rescheduled event.'}
                </Text>
              </View>
            )}

            {postponementDecision.decision === 'auto_refunded_indefinite_cap' && (
              <View style={{ backgroundColor: '#EFF6FF', padding: 10, borderRadius: 10 }}>
                <Text style={{ color: PRIMARY_COLOR, fontWeight: '600', fontSize: 13 }}>
                  ✓ Auto-Refunded
                </Text>
                <Text style={[styles.detailText, { marginTop: 4 }]}>
                  No new date was set within 30 days of postponement. A full refund has been
                  automatically processed to your original payment method.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── REFUND SECTION ── */}

        {/* Only shown if registration is active and at least one tier is refundable */}
        {!isInvalid && refundableTiers.length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Refund</Text>

            {refundableTiers.map((tier, idx) => {
              const req = getRequestForTier(tier.ticketTypeId);
              const statusDisplay = getRefundStatusDisplay(req);
              const policy = tier.refundPolicy;
              const tierRefundAmount = tier.totalPrice * (policy.percentage / 100);

              return (
                <View key={idx} style={[styles.bookingRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8, paddingVertical: 12 }]}>
                  <Text style={styles.ticketName}>{tier.quantity}× {tier.name}</Text>

                  {/* Policy summary */}
                  <Text style={{ fontSize: 12, color: MUTED_TEXT, fontFamily: FONTS.semiBold }}>
                    {policy.percentage}% refund · deadline {policy.deadline_hours_before}h before event
                    {tierRefundAmount > 0 ? ` · up to ₹${tierRefundAmount.toLocaleString('en-IN')}` : ''}
                  </Text>

                  {req ? (
                    /* Already has an active request — show status pill */
                    <View style={[styles.statusPill, { backgroundColor: statusDisplay.bg, alignSelf: 'flex-start' }]}>
                      <Text style={[styles.statusValue, { color: statusDisplay.color }]}>
                        {statusDisplay.label}
                      </Text>
                    </View>
                  ) : (
                    /* No existing request — show Request button */
                    !isPast && (
                      <TouchableOpacity
                        style={styles.refundBtn}
                        onPress={() => handleOpenRefundSheet({
                          ticketTypeId: tier.ticketTypeId,
                          name: tier.name,
                          totalPrice: tier.totalPrice,
                          refundPolicy: policy,
                        })}
                        activeOpacity={0.8}
                      >
                        <RotateCcw size={14} color={PRIMARY_COLOR} strokeWidth={2} />
                        <Text style={styles.refundBtnText}>Request Refund</Text>
                      </TouchableOpacity>
                    )
                  )}

                  {/* If rejected, show rejection reason if available */}
                  {req?.status === 'rejected' && req?.rejection_reason && (
                    <Text style={{ fontSize: 12, color: ERROR_COLOR, fontFamily: FONTS.semiBold }}>
                      Reason: {req.rejection_reason}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Past Event Notice */}
        {isPast && !isCancelled && (
          <View style={styles.noticeCard}>
            <Clock size={18} color={WARNING_COLOR} strokeWidth={2} />
            <Text style={styles.noticeText}>
              This event has ended. This ticket is kept for your records.
            </Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 80 + insets.bottom }} />
      </ScrollView>

      {/* ── REFUND REQUEST BOTTOM SHEET ── */}
      <Modal
        visible={showRefundSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRefundSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} onPress={() => setShowRefundSheet(false)} activeOpacity={1} />
          <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Request Refund</Text>
              <TouchableOpacity onPress={() => setShowRefundSheet(false)} activeOpacity={0.7}>
                <X size={22} color={MUTED_TEXT} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {selectedTier && (
              <>
                {/* Policy terms */}
                <View style={styles.sheetPolicyBox}>
                  <Text style={styles.sheetPolicyTitle}>{selectedTier.name}</Text>
                  <Text style={styles.sheetPolicyLine}>
                    Refund: {selectedTier.refundPolicy.percentage}% of ₹{selectedTier.totalPrice.toLocaleString('en-IN')}
                  </Text>
                  <Text style={[styles.sheetPolicyLine, { color: PRIMARY_COLOR, fontFamily: FONTS.semiBold }]}>
                    You will receive: ₹{refundPreviewAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.sheetPolicyLine}>
                    Deadline: {selectedTier.refundPolicy.deadline_hours_before}h before event
                  </Text>
                  <Text style={[styles.sheetPolicyLine, { fontSize: 11, marginTop: 4 }]}>
                    Platform fee is not included in the refund. Final approval is at organiser discretion.
                  </Text>
                </View>

                {/* Reason input */}
                <Text style={[styles.bookingLabel, { marginBottom: 6, marginTop: 16 }]}>
                  Reason (optional)
                </Text>
                <TextInput
                  style={styles.reasonInput}
                  value={refundReason}
                  onChangeText={setRefundReason}
                  placeholder="Tell us why you'd like a refund…"
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={300}
                />

                {/* Submit */}
                <TouchableOpacity
                  style={[styles.sheetSubmitBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleSubmitRefund}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.sheetSubmitBtnText}>Submit Refund Request</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CARD_BACKGROUND,
  },
  headerWrapper: {
    backgroundColor: CARD_BACKGROUND,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.black,
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 15,
    color: MUTED_TEXT,
    marginTop: 12,
    fontFamily: FONTS.semiBold,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
    marginTop: 8,
    fontFamily: FONTS.semiBold,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  scrollView: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContent: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
  },
  qrSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: CARD_BACKGROUND,
  },
  qrSectionCancelled: {
    backgroundColor: "#F9FAFB",
  },
  qrContainer: {
    padding: 16,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  qrContainerCancelled: {
    opacity: 0.5,
  },
  qrHint: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 16,
    fontFamily: FONTS.semiBold,
  },
  qrCancelledText: {
    fontSize: 14,
    color: ERROR_COLOR,
    fontFamily: FONTS.semiBold,
    marginTop: 16,
  },
  dashedDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 0,
    position: "relative",
  },
  circleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR,
    marginLeft: -10,
    zIndex: 10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  circleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BACKGROUND_COLOR,
    marginRight: -10,
    zIndex: 10,
  },
  eventSection: {
    padding: 20,
  },
  eventTitle: {
    fontSize: 22,
    fontFamily: FONTS.primary,
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  communityAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  communityAvatarGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  communityInitials: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  communityName: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#5E8D9B",
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.primary,
    color: MUTED_TEXT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  ticketPrice: {
    fontSize: 12.5,
    fontFamily: FONTS.semiBold,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  ticketTotal: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  discountLabel: {
    fontSize: 14,
    color: SUCCESS_COLOR,
    fontFamily: FONTS.semiBold,
  },
  discountAmount: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: SUCCESS_COLOR,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  totalAmount: {
    fontSize: 19,
    fontFamily: FONTS.semiBold,
    color: PRIMARY_COLOR,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  bookingLabel: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: MUTED_TEXT,
  },
  bookingValue: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statusValue: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FEF3C7",
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#92400E",
  },
  revokedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  revokedText: {
    flex: 1,
    fontSize: 13,
    color: "#EF4444",
    fontFamily: FONTS.semiBold,
  },
  // Refund UI
  refundBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    alignSelf: "flex-start",
  },
  refundBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: PRIMARY_COLOR,
  },
  // Refund Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: CARD_BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    color: TEXT_COLOR,
  },
  sheetPolicyBox: {
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E0E8FF",
    gap: 4,
  },
  sheetPolicyTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  sheetPolicyLine: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: MUTED_TEXT,
  },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  sheetSubmitBtn: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSubmitBtnText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
