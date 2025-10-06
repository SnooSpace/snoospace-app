import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./navigation/AppNavigator";
import { getAuthToken, getAuthEmail, getPendingOtp, clearPendingOtp } from "./api/auth";
import { apiPost } from "./api/client";

export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator initialRouteName={'AuthGate'} />
    </NavigationContainer>
  );
}
