import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image"; // ── PERF: memory-disk cache so tab bar avatar never re-fetches
import { User } from "lucide-react-native";
import { getAuthToken, getAuthEmail, getActiveAccount } from "../api/auth";
import { apiPost } from "../api/client";
import { COLORS } from "../constants/theme";
import EventBus from "../utils/EventBus";

const ProfileTabIcon = ({ focused, color, userType = "member" }) => {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const activeAccount = await getActiveAccount();
      const email = activeAccount?.email;

      if (token && email) {
        const response = await apiPost(
          "/auth/get-user-profile",
          { email },
          10000,
          token,
        );

        if (response?.profile) {
          const url =
            userType === "member"
              ? response.profile.profile_photo_url
              : response.profile.logo_url;
          setPhotoUrl(url || null);
        }
      }
    } catch (error) {
      console.log("[ProfileTabIcon] Error fetching profile photo:", error);
    }
  }, [userType]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Listen to account switch events — show spinner during switch, then
  // re-fetch the new account's photo once the switch completes.
  useEffect(() => {
    const unsubStart = EventBus.on("account-switch-start", () => {
      setIsSwitching(true);
    });
    const unsubEnd = EventBus.on("account-switch-end", () => {
      setIsSwitching(false);
    });
    const unsubDone = EventBus.on("account-switch-done", () => {
      setIsSwitching(false);
      // Clear stale photo immediately so the old avatar doesn't linger,
      // then fetch the new account's photo.
      setPhotoUrl(null);
      fetchProfile();
    });
    return () => {
      if (unsubStart) unsubStart();
      if (unsubEnd) unsubEnd();
      if (unsubDone) unsubDone();
    };
  }, [fetchProfile]);

  if (isSwitching) {
    return (
      <View style={styles.switchingContainer}>
        <ActivityIndicator size="small" color="#3565F2" />
      </View>
    );
  }

  if (photoUrl) {
    return (
      <View
        style={[
          styles.container,
          focused && styles.activeContainer,
          { borderColor: focused ? "#3565F2" : "transparent" },
        ]}
      >
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.fallbackContainer}>
      <User
        size={26}
        color={focused ? "#3565F2" : "#999999"}
        fill={focused ? "rgba(53, 101, 242, 0.15)" : "transparent"}
        strokeWidth={focused ? 2.5 : 2}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  activeContainer: {
    // Border color is set dynamically via props
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 15,
  },
  fallbackContainer: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  switchingContainer: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProfileTabIcon;
