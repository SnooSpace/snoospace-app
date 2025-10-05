import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./navigation/AppNavigator";
import { getAuthToken, getAuthEmail } from "./api/auth";
import { apiPost } from "./api/client";

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) {
          setInitialRoute('Landing');
          return;
        }
        // Determine role; if valid, go to role home
        const profile = await apiPost('/auth/get-user-profile', { email }, 8000, token);
        const role = profile?.role;
        switch (role) {
          case 'member':
            setInitialRoute('MemberHome');
            break;
          case 'community':
            setInitialRoute('CommunityHome');
            break;
          case 'sponsor':
            setInitialRoute('SponsorHome');
            break;
          case 'venue':
            setInitialRoute('VenueHome');
            break;
          default:
            setInitialRoute('Landing');
        }
      } catch {
        setInitialRoute('Landing');
      }
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <AppNavigator initialRouteName={initialRoute} />
    </NavigationContainer>
  );
}
