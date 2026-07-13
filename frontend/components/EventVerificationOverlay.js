import React from "react";
import { useEventVerification } from "../context/EventVerificationContext";
import EventVerificationPopup from "./EventVerificationPopup";

export default function EventVerificationOverlay() {
  const { activePopup, loading, handleConfirm, handleReject, handleAskLater } = useEventVerification();

  return (
    <EventVerificationPopup
      activePopup={activePopup}
      loading={loading}
      onConfirm={handleConfirm}
      onReject={handleReject}
      onAskLater={handleAskLater}
    />
  );
}
