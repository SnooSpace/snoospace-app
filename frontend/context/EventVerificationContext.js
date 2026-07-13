import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuthState } from "../contexts/AuthStateContext";
import { getMyEvents, getEventVerifications, updateEventVerification } from "../api/events";
import { shouldShowRSVP, shouldShowAttendance, calculateAskLaterCooldown } from "../utils/verificationUtils";
import EventBus from "../utils/EventBus";
import HapticsService from "../services/HapticsService";

const EventVerificationContext = createContext(null);

export function EventVerificationProvider({ children }) {
  const { activeAccountEmail } = useAuthState();
  const [events, setEvents] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [activePopup, setActivePopup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Fetch events and verification states from backend
  const loadData = useCallback(async () => {
    if (!activeAccountEmail) return;
    try {
      const [eventsRes, verificationsRes] = await Promise.all([
        getMyEvents(),
        getEventVerifications(),
      ]);

      if (eventsRes?.events) {
        setEvents(eventsRes.events);
      }
      if (verificationsRes?.verifications) {
        setVerifications(verificationsRes.verifications);
      }
      setDataLoaded(true);
    } catch (error) {
      console.warn("[EventVerificationProvider] Error loading data:", error);
    }
  }, [activeAccountEmail]);

  // Load initially or when account changes
  useEffect(() => {
    if (activeAccountEmail) {
      loadData();
    } else {
      setEvents([]);
      setVerifications([]);
      setActivePopup(null);
      setDataLoaded(false);
    }
  }, [activeAccountEmail, loadData]);

  // Listen for App Resume to refresh verification checks
  useEffect(() => {
    const unsubscribe = EventBus.on("appResumed", () => {
      console.log("[EventVerificationProvider] App resumed, refreshing data...");
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // Evaluation logic
  const evaluateVerification = useCallback(() => {
    if (!dataLoaded || events.length === 0) {
      setActivePopup(null);
      return;
    }

    // 1. RSVP check: Upcoming events, sorted closest first
    const upcomingEvents = events
      .filter((e) => {
        const start = new Date(e.start_datetime || e.event_date).getTime();
        return start > Date.now();
      })
      .sort((a, b) => {
        const startA = new Date(a.start_datetime || a.event_date).getTime();
        const startB = new Date(b.start_datetime || b.event_date).getTime();
        return startA - startB;
      });

    for (const event of upcomingEvents) {
      const verification = verifications.find(
        (v) => parseInt(v.event_id) === parseInt(event.id) && v.type === "going"
      );
      if (shouldShowRSVP(event, verification)) {
        setActivePopup({ event, type: "going" });
        return;
      }
    }

    // 2. Attendance check: Past events, sorted most recent first
    const pastEvents = events
      .filter((e) => {
        const start = new Date(e.start_datetime || e.event_date).getTime();
        return start <= Date.now();
      })
      .sort((a, b) => {
        const startA = new Date(a.start_datetime || a.event_date).getTime();
        const startB = new Date(b.start_datetime || b.event_date).getTime();
        return startB - startA; // Descending (most recent first)
      });

    for (const event of pastEvents) {
      const verification = verifications.find(
        (v) => parseInt(v.event_id) === parseInt(event.id) && v.type === "attendance"
      );
      if (shouldShowAttendance(event, verification)) {
        setActivePopup({ event, type: "attendance" });
        return;
      }
    }

    setActivePopup(null);
  }, [events, verifications, dataLoaded]);

  // Evaluate whenever events or verifications are loaded/updated
  useEffect(() => {
    evaluateVerification();
  }, [events, verifications, evaluateVerification]);

  // API Call Actions
  const handleConfirm = useCallback(async () => {
    if (!activePopup) return;
    const { event, type } = activePopup;
    try {
      setLoading(true);
      const res = await updateEventVerification({
        eventId: event.id,
        type,
        status: "confirmed",
      });

      if (res?.success) {
        HapticsService.triggerImpactMedium();

        // Update local verifications state
        setVerifications((prev) => {
          const index = prev.findIndex(
            (v) => parseInt(v.event_id) === parseInt(event.id) && v.type === type
          );
          const updated = res.verification;
          if (index > -1) {
            const next = [...prev];
            next[index] = updated;
            return next;
          }
          return [...prev, updated];
        });

        // Update local event registration status if attendance confirmed
        const confirmedAtStr = new Date().toISOString();
        if (type === "attendance") {
          setEvents((prev) =>
            prev.map((e) =>
              parseInt(e.id) === parseInt(event.id)
                ? { ...e, attendance_status: "attended", attendance_confirmed_at: confirmedAtStr }
                : e
            )
          );
        }

        // Notify other subscribers (like YourEventsScreen.js)
        EventBus.emit("event-status-updated", {
          eventId: event.id,
          status: type === "attendance" ? "attended" : "confirmed",
          confirmedAt: confirmedAtStr,
        });
      }
    } catch (err) {
      console.warn("[EventVerificationProvider] Error confirming:", err);
    } finally {
      setLoading(false);
      setActivePopup(null);
    }
  }, [activePopup]);

  const handleReject = useCallback(async () => {
    if (!activePopup) return;
    const { event, type } = activePopup;
    const nextStatus = type === "going" ? "dont_going" : "did_not_attend";
    try {
      setLoading(true);
      const res = await updateEventVerification({
        eventId: event.id,
        type,
        status: nextStatus,
      });

      if (res?.success) {
        HapticsService.triggerImpactLight();

        // Update local verifications state
        setVerifications((prev) => {
          const index = prev.findIndex(
            (v) => parseInt(v.event_id) === parseInt(event.id) && v.type === type
          );
          const updated = res.verification;
          if (index > -1) {
            const next = [...prev];
            next[index] = updated;
            return next;
          }
          return [...prev, updated];
        });

        // Update local event registration status if attendance rejected
        const confirmedAtStr = new Date().toISOString();
        if (type === "attendance") {
          setEvents((prev) =>
            prev.map((e) =>
              parseInt(e.id) === parseInt(event.id)
                ? { ...e, attendance_status: "did_not_attend", attendance_confirmed_at: confirmedAtStr }
                : e
            )
          );
        }

        // Notify other subscribers
        EventBus.emit("event-status-updated", {
          eventId: event.id,
          status: type === "attendance" ? "did_not_attend" : "dont_going",
          confirmedAt: confirmedAtStr,
        });
      }
    } catch (err) {
      console.warn("[EventVerificationProvider] Error rejecting:", err);
    } finally {
      setLoading(false);
      setActivePopup(null);
    }
  }, [activePopup]);

  const handleAskLater = useCallback(async () => {
    if (!activePopup) return;
    const { event, type } = activePopup;
    const nextPromptAt = calculateAskLaterCooldown(event, type);

    try {
      setLoading(true);
      const res = await updateEventVerification({
        eventId: event.id,
        type,
        status: "ask_later",
        nextPromptAt,
      });

      if (res?.success) {
        // Update local verifications state
        setVerifications((prev) => {
          const index = prev.findIndex(
            (v) => parseInt(v.event_id) === parseInt(event.id) && v.type === type
          );
          const updated = res.verification;
          if (index > -1) {
            const next = [...prev];
            next[index] = updated;
            return next;
          }
          return [...prev, updated];
        });
      }
    } catch (err) {
      console.warn("[EventVerificationProvider] Error asking later:", err);
    } finally {
      setLoading(false);
      setActivePopup(null);
    }
  }, [activePopup]);

  return (
    <EventVerificationContext.Provider
      value={{
        activePopup,
        loading,
        handleConfirm,
        handleReject,
        handleAskLater,
        refreshData: loadData,
        events,
      }}
    >
      {children}
    </EventVerificationContext.Provider>
  );
}

export function useEventVerification() {
  const context = useContext(EventVerificationContext);
  if (!context) {
    throw new Error("useEventVerification must be used within an EventVerificationProvider");
  }
  return context;
}
