/**
 * QRScannerScreen - Scan and verify attendee tickets
 * For community accounts to check in attendees at events
 */
import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ArrowLeft, Calendar, Camera, Check, AlertCircle, X, QrCode, Keyboard } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { verifyTicket } from "../../api/events";
import { COLORS, FONTS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const { width, height } = Dimensions.get("window");
const SCAN_FRAME_SIZE = width * 0.7;

// Colors
const SUCCESS_COLOR = "#16A34A";
const ERROR_COLOR = "#DC2626";
const WARNING_COLOR = "#F59E0B";
const PRIMARY_COLOR = COLORS.primary;

export default function QRScannerScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { success, attendee, error }
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannedCodes, setScannedCodes] = useState(new Set()); // Prevent duplicate scans

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  // Pulse animation for scan frame
  useEffect(() => {
    if (scanning && !processing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [scanning, processing]);

  // Animate result in
  useEffect(() => {
    if (result) {
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [result]);

  const handleBarCodeScanned = async ({ data }) => {
    // Prevent duplicate scans of the same QR
    if (scannedCodes.has(data) || processing || !scanning) return;

    setScannedCodes((prev) => new Set(prev).add(data));
    await processQRCode(data);
  };

  const processQRCode = async (qrData) => {
    if (!event?.id) {
      Alert.alert("Error", "No event selected");
      return;
    }

    setScanning(false);
    setProcessing(true);
    setResult(null);
    resultOpacity.setValue(0);

    try {
      const response = await verifyTicket(event.id, qrData);

      if (response?.success && response?.verified) {
        setResult({
          success: true,
          attendee: response.attendee,
        });
      } else {
        setResult({
          success: false,
          error: response?.error || "Verification failed",
          alreadyCheckedIn: response?.alreadyCheckedIn,
          attendee: response?.attendee,
        });
      }
    } catch (err) {
      console.error("Verification error:", err);
      setResult({
        success: false,
        error: err.message || "Failed to verify ticket",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleScanNext = () => {
    setResult(null);
    setScanning(true);
    resultOpacity.setValue(0);
    // Remove from scanned set after delay to allow re-scan if needed
    setTimeout(() => {
      setScannedCodes(new Set());
    }, 2000);
  };

  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;
    processQRCode(manualCode.trim());
    setManualCode("");
    setShowManualEntry(false);
  };

  // Handle permissions
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <SnooLoader size="large" color={PRIMARY_COLOR} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color={PRIMARY_COLOR} strokeWidth={1.5} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan ticket QR codes
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Header */}
        <SafeAreaView edges={["top"]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan Tickets</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Event Info */}
          <View style={styles.eventBadge}>
            <Calendar size={16} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.eventBadgeText} numberOfLines={1}>
              {event?.title || "Select Event"}
            </Text>
          </View>
        </SafeAreaView>

        {/* Scan Frame */}
        {scanning && !processing && !result && (
          <View style={styles.scanFrameContainer}>
            <Animated.View
              style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}
            >
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </Animated.View>
            <Text style={styles.scanHint}>Point camera at QR code</Text>
          </View>
        )}

        {/* Processing Indicator */}
        {processing && (
          <View style={styles.processingContainer}>
            <SnooLoader size="large" color="#FFFFFF" />
            <Text style={styles.processingText}>Verifying...</Text>
          </View>
        )}

        {/* Result Card */}
        {result && (
          <Animated.View
            style={[styles.resultContainer, { opacity: resultOpacity }]}
          >
            <View
              style={[
                styles.resultCard,
                result.success
                  ? styles.resultCardSuccess
                  : result.alreadyCheckedIn
                  ? styles.resultCardWarning
                  : styles.resultCardError,
              ]}
            >
              {/* Icon */}
              <View
                style={[
                  styles.resultIconContainer,
                  result.success
                    ? { backgroundColor: "rgba(22, 163, 74, 0.1)" }
                    : result.alreadyCheckedIn
                    ? { backgroundColor: "rgba(245, 158, 11, 0.1)" }
                    : { backgroundColor: "rgba(220, 38, 38, 0.1)" },
                ]}
              >
                {result.success ? (
                  <Check size={36} color={SUCCESS_COLOR} strokeWidth={3} />
                ) : result.alreadyCheckedIn ? (
                  <AlertCircle size={36} color={WARNING_COLOR} strokeWidth={2.5} />
                ) : (
                  <X size={36} color={ERROR_COLOR} strokeWidth={3} />
                )}
              </View>

              {/* Status Text */}
              <Text
                style={[
                  styles.resultStatus,
                  result.success
                    ? { color: SUCCESS_COLOR }
                    : result.alreadyCheckedIn
                    ? { color: WARNING_COLOR }
                    : { color: ERROR_COLOR },
                ]}
              >
                {result.success
                  ? "Verified!"
                  : result.alreadyCheckedIn
                  ? "Already Checked In"
                  : "Invalid Ticket"}
              </Text>

              {/* Attendee Info */}
              {result.attendee && (
                <View style={styles.attendeeInfo}>
                  {result.attendee.memberPhoto && (
                    <Image
                      source={{ uri: result.attendee.memberPhoto }}
                      style={styles.attendeePhoto}
                    />
                  )}
                  <Text style={styles.attendeeName}>
                    {result.attendee.memberName}
                  </Text>
                  {result.attendee.ticketSummary && (
                    <Text style={styles.attendeeTicket}>
                      {result.attendee.ticketSummary}
                    </Text>
                  )}
                </View>
              )}

              {/* Error Message */}
              {!result.success && result.error && !result.attendee && (
                <Text style={styles.errorMessage}>{result.error}</Text>
              )}

              {/* Scan Next Button */}
              <TouchableOpacity
                style={styles.scanNextButton}
                onPress={handleScanNext}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scanNextGradient}
                >
                  <QrCode
                    size={20}
                    color="#FFFFFF"
                    strokeWidth={2}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.scanNextText}>Scan Next Ticket</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Bottom Actions */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualEntry(true)}
          >
            <Keyboard size={20} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.manualButtonText}>Enter code manually</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Manual Entry Modal */}
        {showManualEntry && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIconContainer}>
                <Keyboard size={24} color={PRIMARY_COLOR} strokeWidth={2} />
              </View>
              <Text style={styles.modalTitle}>Enter Registration Code</Text>
              <Text style={styles.modalDescription}>
                Enter the attendee's code manually to verify their ticket.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="SNOO-E15-R123-abc123..."
                placeholderTextColor="#9CA3AF"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowManualEntry(false);
                    setManualCode("");
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleManualSubmit}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalSubmitGradient}
                  >
                    <Text style={styles.modalSubmitText}>Verify</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.black,
    color: "#FFFFFF",
  },
  eventBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginTop: 8,
    maxWidth: width - 80,
  },
  eventBadgeText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
  },
  scanFrameContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "transparent",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: PRIMARY_COLOR,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  scanHint: {
    marginTop: 24,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: "#FFFFFF",
    textAlign: "center",
  },
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: FONTS.medium,
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  resultCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  resultCardSuccess: {
    borderWidth: 1.5,
    borderColor: "rgba(22, 163, 74, 0.2)",
  },
  resultCardWarning: {
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  resultCardError: {
    borderWidth: 1.5,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  resultIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  resultStatus: {
    fontSize: 26,
    fontFamily: FONTS.primary,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  attendeeInfo: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  attendeePhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  attendeeName: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  attendeeTicket: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  scanNextButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  scanNextGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  scanNextText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  bottomActions: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  manualButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  manualButtonText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
  },
  permissionTitle: {
    fontSize: 20,
    fontFamily: FONTS.primary,
    color: "#1F2937",
    marginTop: 20,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#6B7280",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    color: "#1F2937",
    marginBottom: 6,
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#1F2937",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#6B7280",
  },
  modalSubmitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  modalSubmitGradient: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  modalSubmitText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
