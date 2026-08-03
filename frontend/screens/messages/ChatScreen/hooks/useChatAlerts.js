import { useState, useCallback } from "react";

export default function useChatAlerts() {
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });

  const showAlert = useCallback((config) => {
    setAlertConfig({ ...config, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((p) => ({ ...p, visible: false }));
  }, []);

  return {
    alertConfig,
    showAlert,
    hideAlert,
  };
}
