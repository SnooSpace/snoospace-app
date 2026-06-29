import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Music } from "lucide-react-native";
import { useSpotifyConnect } from "../hooks/useSpotifyConnect";
import { FONTS } from "../constants/theme";

export default function SpotifyConnectorWidget({
  connected,
  onConnectedChange,
  topArtists = [],
  onArtistsChange,
  accentColor = "#2962FF",
  onRefreshProfile,
}) {
  const { connect, disconnect, syncArtists, isConnecting, error } = useSpotifyConnect();

  const handleConnect = async () => {
    const success = await connect();
    if (success) {
      if (onConnectedChange) onConnectedChange(true);
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  const handleDisconnect = async () => {
    const success = await disconnect();
    if (success) {
      if (onConnectedChange) onConnectedChange(false);
      if (onArtistsChange) onArtistsChange([]);
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  const handleSync = async () => {
    const success = await syncArtists();
    if (success && onRefreshProfile) {
      onRefreshProfile();
    }
  };

  return (
    <View style={styles.container}>
      {!connected ? (
        <TouchableOpacity
          style={styles.spotifyButton}
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.9}
        >
          <View style={styles.spotifyLogoContainer}>
            <Music size={20} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <View style={styles.spotifyTextContainer}>
            <Text style={styles.spotifyTitle}>Connect Spotify</Text>
            <Text style={styles.spotifySubtitle}>
              Showcase your music taste on your profile
            </Text>
          </View>
          <View style={[styles.connectBadge, { backgroundColor: accentColor }]}>
            {isConnecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.connectBadgeText}>Connect</Text>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.connectedCard}>
          <View style={styles.connectedHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.spotifyLogoContainerConnected}>
                <Music size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.spotifyTitle}>Spotify Connected</Text>
                <Text style={styles.spotifySubtitleConnected}>
                  {topArtists.length} artist{topArtists.length !== 1 ? "s" : ""} synced
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleDisconnect}
              style={styles.disconnectBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.disconnectText}>Remove</Text>
            </TouchableOpacity>
          </View>

          {topArtists.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.artistsScroll}
            >
              {topArtists.map((artist, idx) => {
                const name = typeof artist === 'string' ? artist : artist.artist_name || '';
                return (
                  <View key={idx} style={styles.artistPill}>
                    <Text style={styles.artistPillText}>{name}</Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.noArtistsText}>No artists synced yet. Tap Sync to retrieve.</Text>
          )}

          <TouchableOpacity
            style={styles.editArtistsBtn}
            onPress={handleSync}
            activeOpacity={0.8}
          >
            <Text style={[styles.editArtistsBtnText, { color: accentColor }]}>
              Sync Spotify Top Artists
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  spotifyButton: {
    backgroundColor: "#121212",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  spotifyLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  spotifyTextContainer: {
    flex: 1,
  },
  spotifyTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  spotifySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#A7A7A7",
    marginTop: 2,
  },
  connectBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  connectBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  connectedCard: {
    backgroundColor: "#181818",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  connectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  spotifyLogoContainerConnected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  spotifySubtitleConnected: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#1DB954",
    marginTop: 1,
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  disconnectText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#EF4444",
  },
  artistsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  artistPill: {
    backgroundColor: "#282828",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#3E3E3E",
  },
  artistPillText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
  },
  noArtistsText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#A7A7A7",
    marginBottom: 8,
  },
  editArtistsBtn: {
    borderTopWidth: 1,
    borderTopColor: "#282828",
    paddingTop: 12,
    marginTop: 8,
    alignItems: "center",
  },
  editArtistsBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 6,
    textAlign: "center",
  },
});
