import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Music, RefreshCw, Trash2, CheckCircle2 } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useSpotifyConnect } from "../../hooks/useSpotifyConnect";
import { FONTS } from "../../constants/theme";
import CustomConfirmDialog from "./CustomConfirmDialog";

const SpotifyLogo = ({ size = 20, color = "#FFFFFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.216.354-.676.464-1.028.249-2.818-1.722-6.365-2.111-10.542-1.157-.403.092-.804-.16-.896-.562-.092-.402.159-.804.563-.895 4.571-1.045 8.492-.595 11.655 1.338.353.214.464.675.248 1.027zm1.469-3.267c-.271.44-.847.578-1.287.308-3.225-1.982-8.142-2.557-11.958-1.398-.494.149-1.017-.13-1.167-.624-.149-.495.13-1.016.624-1.167 4.358-1.323 9.776-.682 13.48 1.594.44.27.578.846.308 1.287zm.126-3.403C15.23 8.341 8.85 8.13 5.157 9.251c-.593.18-1.22-.155-1.4-.748-.18-.593.155-1.22.748-1.4 4.239-1.287 11.285-1.038 15.738 1.605.533.317.708 1.005.392 1.538-.317.533-1.007.709-1.537.392z" />
  </Svg>
);

export default function SpotifyConnectorWidget({
  connected,
  onConnectedChange,
  topArtists = [],
  onArtistsChange,
  accentColor = "#2962FF",
  onRefreshProfile,
}) {
  const {
    connect,
    disconnect,
    syncArtists,
    isConnecting,
    isSyncing,
    isDisconnecting,
    error,
    clearError,
  } = useSpotifyConnect();

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const handleConnect = async () => {
    clearError();
    const result = await connect();
    if (result?.success) {
      if (onConnectedChange) onConnectedChange(true);
      if (result.profile?.top_artists && onArtistsChange) {
        onArtistsChange(result.profile.top_artists);
      }
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  const handleConfirmDisconnect = () => {
    setShowDisconnectModal(true);
  };

  const handlePerformDisconnect = async () => {
    setShowDisconnectModal(false);
    clearError();
    const result = await disconnect();
    if (result?.success) {
      if (onConnectedChange) onConnectedChange(false);
      if (onArtistsChange) onArtistsChange([]);
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  const handleSync = async () => {
    clearError();
    const result = await syncArtists();
    if (result?.success) {
      if (result.data?.top_artists && onArtistsChange) {
        onArtistsChange(result.data.top_artists);
      }
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  return (
    <View style={styles.container}>
      {!connected ? (
        <TouchableOpacity
          style={styles.spotifyButton}
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.88}
        >
          <View style={styles.spotifyLogoContainer}>
            <SpotifyLogo size={22} color="#FFFFFF" />
          </View>
          <View style={styles.spotifyTextContainer}>
            <Text style={styles.spotifyTitle}>Connect Spotify</Text>
            <Text style={styles.spotifySubtitle}>
              Showcase your music taste on your Discover profile
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
          {/* Header Row */}
          <View style={styles.connectedHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.spotifyLogoContainerConnected}>
                <SpotifyLogo size={20} color="#FFFFFF" />
              </View>
              <View>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.spotifyTitle}>Spotify Connected</Text>
                  <CheckCircle2 size={14} color="#1DB954" strokeWidth={2.5} style={{ marginLeft: 6 }} />
                </View>
                <Text style={styles.spotifySubtitleConnected}>
                  {topArtists.length} {topArtists.length === 1 ? "artist" : "artists"} synced
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleConfirmDisconnect}
              disabled={isDisconnecting}
              style={styles.disconnectBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isDisconnecting ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <View style={styles.disconnectInner}>
                  <Trash2 size={13} color="#EF4444" strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={styles.disconnectText}>Remove</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Top Artists Horizontal List */}
          {topArtists.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.artistsScroll}
            >
              {topArtists.map((artist, idx) => {
                const name =
                  typeof artist === "string"
                    ? artist
                    : artist.name || artist.artist_name || "";
                return (
                  <View key={idx} style={styles.artistPill}>
                    <Text style={styles.artistPillText} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.noArtistsText}>
              No top artists synced yet. Tap below to sync.
            </Text>
          )}

          {/* Sync Button */}
          <TouchableOpacity
            style={styles.syncBtn}
            onPress={handleSync}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <View style={styles.syncingRow}>
                <ActivityIndicator size="small" color={accentColor} style={{ marginRight: 8 }} />
                <Text style={[styles.syncBtnText, { color: accentColor }]}>
                  Syncing with Spotify...
                </Text>
              </View>
            ) : (
              <View style={styles.syncingRow}>
                <RefreshCw size={14} color={accentColor} strokeWidth={2.2} style={{ marginRight: 6 }} />
                <Text style={[styles.syncBtnText, { color: accentColor }]}>
                  Sync Top Artists & Tracks
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <TouchableOpacity onPress={clearError} activeOpacity={0.8}>
          <Text style={styles.errorText}>{error}</Text>
        </TouchableOpacity>
      )}

      {/* Custom Disconnect Confirmation Dialog */}
      <CustomConfirmDialog
        visible={showDisconnectModal}
        title="Disconnect Spotify"
        message="Are you sure you want to unlink your Spotify account? Your top artists and tracks will be removed from your Discover profile."
        confirmLabel="Disconnect"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handlePerformDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
      />
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
    paddingRight: 8,
  },
  spotifyTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  spotifySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#A7A7A7",
    marginTop: 2,
  },
  connectBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  connectBadgeText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  connectedCard: {
    backgroundColor: "#161616",
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  spotifySubtitleConnected: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#1DB954",
    marginTop: 1,
  },
  disconnectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  disconnectInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  disconnectText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#EF4444",
  },
  artistsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
  },
  artistPill: {
    backgroundColor: "#222222",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "#333333",
  },
  artistPillText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#EEEEEE",
  },
  noArtistsText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#A7A7A7",
    marginBottom: 10,
  },
  syncBtn: {
    borderTopWidth: 1,
    borderTopColor: "#242424",
    paddingTop: 12,
    marginTop: 4,
    alignItems: "center",
  },
  syncingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 8,
    textAlign: "center",
  },
});
