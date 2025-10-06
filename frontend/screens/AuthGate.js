import React, { useEffect } from "react";
import { View } from "react-native";
import { getPendingOtp, getAuthToken, getAuthEmail } from "../api/auth";
import { apiPost } from "../api/client";

export default function AuthGate({ navigation }) {
  useEffect(() => {
    (async () => {
      try {
        const pending = await getPendingOtp();
        if (pending && pending.email) {
          if (pending.flow === 'login') {
            navigation.reset({ index: 0, routes: [{ name: 'LoginOtp', params: { email: pending.email } }] });
            return;
          }
          if (pending.flow === 'signup_member') {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'MemberSignup',
                  state: {
                    index: 1,
                    routes: [
                      { name: 'MemberEmail' },
                      { name: 'MemberOtp', params: { email: pending.email } },
                    ],
                  },
                },
              ],
            });
            return;
          }
        }

        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) {
          navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
          return;
        }
        const profile = await apiPost('/auth/get-user-profile', { email }, 8000, token);
        const role = profile?.role;
        const routeName = role === 'member' ? 'MemberHome'
          : role === 'community' ? 'CommunityHome'
          : role === 'sponsor' ? 'SponsorHome'
          : role === 'venue' ? 'VenueHome'
          : 'Landing';
        navigation.reset({ index: 0, routes: [{ name: routeName }] });
      } catch {
        navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
      }
    })();
  }, [navigation]);

  return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
}


