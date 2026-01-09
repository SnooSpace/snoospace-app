/**
 * TicketTypesEditor - Component for managing event ticket tiers
 * Used in CreateEventModal and EditEventModal to add/edit/remove ticket types
 */
import React, { useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

const TicketTypesEditor = ({ ticketTypes = [], onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [currentTicket, setCurrentTicket] = useState({
    name: "",
    description: "",
    base_price: "",
    total_quantity: "",
    visibility: "public",
    gender_restriction: "all",
    min_per_order: "1",
    max_per_order: "10",
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
    });
    setEditingIndex(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

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
    });
    setEditingIndex(index);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!currentTicket.name.trim()) {
      Alert.alert("Required", "Please enter a ticket name");
      return;
    }

    const ticketData = {
      name: currentTicket.name.trim(),
      description: currentTicket.description.trim() || null,
      base_price: parseFloat(currentTicket.base_price) || 0,
      total_quantity: currentTicket.total_quantity
        ? parseInt(currentTicket.total_quantity)
        : null,
      visibility: currentTicket.visibility,
      gender_restriction: currentTicket.gender_restriction || "all",
      min_per_order: parseInt(currentTicket.min_per_order) || 1,
      max_per_order: parseInt(currentTicket.max_per_order) || 10,
      is_active: true,
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
        [{ text: "OK" }]
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
      ]
    );
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return "Free";
    return `₹${parseFloat(price).toLocaleString("en-IN")}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>Ticket Types</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add-circle" size={24} color={COLORS.primary} />
          <Text style={styles.addButtonText}>Add Ticket</Text>
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {ticketTypes.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrapper}>
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyIconGradient}
            >
              <Ionicons name="ticket-outline" size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.emptyText}>No ticket types added</Text>
          <Text style={styles.emptySubtext}>
            Add tickets to enable registrations
          </Text>
        </View>
      )}

      {/* Ticket List */}
      {ticketTypes.map((ticket, index) => (
        <TouchableOpacity
          key={index}
          style={styles.ticketCard}
          onPress={() => openEditModal(index)}
        >
          <View style={styles.ticketInfo}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketName}>{ticket.name}</Text>
              {ticket.visibility !== "public" && (
                <View style={styles.visibilityBadge}>
                  <Ionicons
                    name={
                      ticket.visibility === "hidden" ? "eye-off" : "lock-closed"
                    }
                    size={12}
                    color="#666"
                  />
                  <Text style={styles.visibilityText}>{ticket.visibility}</Text>
                </View>
              )}
            </View>
            <Text style={styles.ticketPrice}>
              {formatPrice(ticket.base_price)}
            </Text>
            {ticket.total_quantity && (
              <Text style={styles.ticketQuantity}>
                {ticket.sold_count || 0} / {ticket.total_quantity} sold
              </Text>
            )}
          </View>
          <View style={styles.ticketActions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(index)}
            >
              <Ionicons
                name={
                  (ticket.sold_count || 0) > 0
                    ? "lock-closed-outline"
                    : "trash-outline"
                }
                size={20}
                color={
                  (ticket.sold_count || 0) > 0 ? LIGHT_TEXT_COLOR : "#FF3B30"
                }
              />
            </TouchableOpacity>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={LIGHT_TEXT_COLOR}
            />
          </View>
        </TouchableOpacity>
      ))}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? "Edit Ticket Type" : "Add Ticket Type"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Name */}
              <Text style={styles.fieldLabel}>Ticket Name *</Text>
              <TextInput
                style={styles.input}
                value={currentTicket.name}
                onChangeText={(text) =>
                  setCurrentTicket({ ...currentTicket, name: text })
                }
                placeholder="e.g., General Admission, VIP, Student"
                placeholderTextColor={LIGHT_TEXT_COLOR}
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={currentTicket.description}
                onChangeText={(text) =>
                  setCurrentTicket({ ...currentTicket, description: text })
                }
                placeholder="What's included with this ticket?"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                multiline
                numberOfLines={3}
              />

              {/* Price */}
              <Text style={styles.fieldLabel}>Price (₹)</Text>
              <TextInput
                style={styles.input}
                value={currentTicket.base_price}
                onChangeText={(text) =>
                  setCurrentTicket({ ...currentTicket, base_price: text })
                }
                placeholder="0 for free tickets"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                keyboardType="numeric"
              />

              {/* Max Attendees */}
              <Text style={styles.fieldLabel}>Max Attendees (Optional)</Text>
              <TextInput
                style={styles.input}
                value={currentTicket.total_quantity}
                onChangeText={(text) =>
                  setCurrentTicket({ ...currentTicket, total_quantity: text })
                }
                placeholder="Leave empty for unlimited"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                keyboardType="numeric"
              />

              {/* Visibility */}
              <Text style={styles.fieldLabel}>Visibility</Text>
              <View style={styles.visibilityOptions}>
                {["public", "invite_only"].map((vis) => (
                  <TouchableOpacity
                    key={vis}
                    style={[
                      styles.visibilityOption,
                      currentTicket.visibility === vis &&
                        styles.visibilityOptionActive,
                    ]}
                    onPress={() =>
                      setCurrentTicket({ ...currentTicket, visibility: vis })
                    }
                  >
                    <Ionicons
                      name={
                        vis === "public"
                          ? "globe-outline"
                          : "lock-closed-outline"
                      }
                      size={18}
                      color={
                        currentTicket.visibility === vis
                          ? COLORS.primary
                          : LIGHT_TEXT_COLOR
                      }
                    />
                    <Text
                      style={[
                        styles.visibilityOptionText,
                        currentTicket.visibility === vis &&
                          styles.visibilityOptionTextActive,
                      ]}
                    >
                      {vis === "invite_only"
                        ? "Invite Only"
                        : vis.charAt(0).toUpperCase() + vis.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Gender Restriction */}
              <Text style={styles.fieldLabel}>Gender Restriction</Text>
              <View style={styles.visibilityOptions}>
                {["all", "Male", "Female", "Non-binary"].map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.visibilityOption,
                      currentTicket.gender_restriction === gender &&
                        styles.visibilityOptionActive,
                    ]}
                    onPress={() =>
                      setCurrentTicket({
                        ...currentTicket,
                        gender_restriction: gender,
                      })
                    }
                  >
                    <Ionicons
                      name={
                        gender === "all"
                          ? "people-outline"
                          : gender === "Male"
                          ? "male-outline"
                          : gender === "Female"
                          ? "female-outline"
                          : "transgender-outline"
                      }
                      size={18}
                      color={
                        currentTicket.gender_restriction === gender
                          ? COLORS.primary
                          : LIGHT_TEXT_COLOR
                      }
                    />
                    <Text
                      style={[
                        styles.visibilityOptionText,
                        currentTicket.gender_restriction === gender &&
                          styles.visibilityOptionTextActive,
                      ]}
                    >
                      {gender === "all" ? "All" : gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                <Text style={styles.saveButtonText}>
                  {editingIndex !== null ? "Update Ticket" : "Add Ticket"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
  emptyState: {
    alignItems: "center",
    padding: 32,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    ...SHADOWS.sm,
  },
  emptyIconWrapper: {
    marginBottom: 12,
  },
  emptyIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_COLOR,
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  ticketCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  ticketInfo: {
    flex: 1,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  visibilityText: {
    fontSize: 10,
    color: "#666",
    textTransform: "capitalize",
  },
  ticketPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 4,
  },
  ticketQuantity: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  ticketActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#FAFAFA",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  visibilityOptions: {
    flexDirection: "row",
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FAFAFA",
    gap: 6,
  },
  visibilityOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  visibilityOptionText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  visibilityOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  saveButton: {
    margin: 20,
    marginTop: 10,
    borderRadius: 30,
    overflow: "hidden",
    ...SHADOWS.primaryGlow,
  },
  saveButtonGradient: {
    padding: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default TicketTypesEditor;
