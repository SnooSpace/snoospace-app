import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, Platform } from "react-native";
import { User } from "lucide-react-native";
import { getAuthToken, getAuthEmail, getActiveAccount } from "../api/auth";
import { apiPost } from "../api/client";
import { COLORS } from "../constants/theme";

const ProfileTabIcon = ({ focused, color, userType = "member" }) => {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
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
            setPhotoUrl(url);
          }
        }
      } catch (error) {
        console.log("[ProfileTabIcon] Error fetching profile photo:", error);
      }
    };

    fetchProfile();
  }, [userType]);

  if (photoUrl) {
    return (
      <View
        style={[
          styles.container,
          focused && styles.activeContainer,
          { borderColor: focused ? "#3565F2" : "transparent" },
        ]}
      >
        <Image source={{ uri: photoUrl }} style={styles.image} />
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
});

export default ProfileTabIcon;
