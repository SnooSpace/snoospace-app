import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Music, RefreshCw, Trash2, CheckCircle2, Mic2, Disc3 } from "lucide-react-native";
import Svg, { Path } from "react-native-svg";
import { useSpotifyConnect } from "../../hooks/useSpotifyConnect";
import { FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
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
  topTracks = [],
  onTracksChange,
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
  const [activeTab, setActiveTab] = useState("artists");

  const hasArtists = Array.isArray(topArtists) && topArtists.length > 0;
  const hasTracks = Array.isArray(topTracks) && topTracks.length > 0;

  const handleConnect = async () => {
    clearError();
    const result = await connect();
    if (result?.success) {
      if (onConnectedChange) onConnectedChange(true);
      if (result.profile?.top_artists && onArtistsChange) {
        onArtistsChange(result.profile.top_artists);
      }
      if (result.profile?.top_tracks && onTracksChange) {
        onTracksChange(result.profile.top_tracks);
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
      if (onTracksChange) onTracksChange([]);
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
      if (result.data?.top_tracks && onTracksChange) {
        onTracksChange(result.data.top_tracks);
      }
      if (onRefreshProfile) onRefreshProfile();
    }
  };

  const handleTabChange = (tab) => {
    HapticsService.triggerSelection();
    setActiveTab(tab);
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
                  {topArtists.length} {topArtists.length === 1 ? "artist" : "artists"}{topTracks.length > 0 ? ` · ${topTracks.length} ${topTracks.length === 1 ? "song" : "songs"}` : ""} synced
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
                <Trash2 size={15} color="#EF4444" strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Bar */}
          {hasArtists && hasTracks && (
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[styles.segmentBtn, activeTab === "artists" && styles.segmentBtnActive]}
                onPress={() => handleTabChange("artists")}
                activeOpacity={0.8}
              >
                <Mic2 size={13} color={activeTab === "artists" ? "#1DB954" : "#64748B"} strokeWidth={2.5} style={{ marginRight: 4 }} />
                <Text style={[styles.segmentText, activeTab === "artists" && styles.segmentTextActive]}>
                  Artists
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, activeTab === "tracks" && styles.segmentBtnActive]}
                onPress={() => handleTabChange("tracks")}
                activeOpacity={0.8}
              >
                <Disc3 size={13} color={activeTab === "tracks" ? "#1DB954" : "#64748B"} strokeWidth={2.5} style={{ marginRight: 4 }} />
                <Text style={[styles.segmentText, activeTab === "tracks" && styles.segmentTextActive]}>
                  Songs
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Top Artists Horizontal List */}
          {activeTab === "artists" && hasArtists && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {topArtists.map((artist, idx) => {
                const name = typeof artist === "string" ? artist : (artist.name || artist.artist_name || "");
                const imageUrl = typeof artist === "object" ? (artist.image_url || artist.artist_image_url) : null;
                const isRank1 = typeof artist === "object" ? (artist.rank === 1) : (idx === 0);

                if (!name) return null;

                return (
                  <View key={idx} style={styles.artistItem}>
                    <View style={styles.imageWrapper}>
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.artistImage} />
                      ) : (
                        <View style={[styles.artistImage, styles.fallbackImage]}>
                          <Music size={22} color="#64748B" />
                        </View>
                      )}
                      {isRank1 && (
                        <View style={styles.rankBadge}>
                          <Text style={styles.rankBadgeText}>♯1</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.artistName} numberOfLines={2}>
                      {name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Top Songs Horizontal List */}
          {(activeTab === "tracks" || !hasArtists) && hasTracks && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mediaRow}
            >
              {topTracks.map((track, idx) => {
                const trackName = typeof track === "string" ? track : (track.name || track.title || "");
                const artistName = typeof track === "object" ? (track.artist_name || track.artists || "") : "";
                const imageUrl = typeof track === "object" ? (track.image_url || track.album_art_url) : null;
                const rank = typeof track === "object" && track.rank ? track.rank : idx + 1;

                if (!trackName) return null;

                return (
                  <View key={idx} style={styles.trackItem}>
                    <View style={styles.trackImageWrapper}>
                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.trackImage} />
                      ) : (
                        <View style={[styles.trackImage, styles.fallbackImage]}>
                          <Music size={22} color="#64748B" />
                        </View>
                      )}
                      <View style={styles.trackRankBadge}>
                        <Text style={styles.trackRankText}>♯{rank}</Text>
                      </View>
                    </View>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {trackName}
                    </Text>
                    {!!artistName && (
                      <Text style={styles.trackArtist} numberOfLines={1}>
                        {artistName}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {!hasArtists && !hasTracks && (
            <Text style={styles.noArtistsText}>
              No music synced yet. Tap below to sync.
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
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  spotifyLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  spotifyTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  spotifyTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: "#0F172A",
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  spotifySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: "#64748B",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  spotifySubtitleConnected: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#16A34A",
    marginTop: 1,
  },
  disconnectBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    padding: 3,
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#64748B",
  },
  segmentTextActive: {
    fontFamily: FONTS.semiBold,
    color: "#0F172A",
  },
  mediaRow: {
    flexDirection: "row",
    gap: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
  artistItem: {
    alignItems: "center",
    width: 72,
  },
  imageWrapper: {
    position: "relative",
    marginBottom: 6,
  },
  artistImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  fallbackImage: {
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#1DB954",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  rankBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: FONTS.primary,
  },
  artistName: {
    color: "#1E293B",
    fontSize: 11,
    fontFamily: FONTS.medium,
    textAlign: "center",
  },
  trackItem: {
    width: 90,
  },
  trackImageWrapper: {
    position: "relative",
    marginBottom: 6,
  },
  trackImage: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  trackRankBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  trackRankText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: FONTS.semiBold,
  },
  trackTitle: {
    color: "#0F172A",
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  trackArtist: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 1,
  },
  noArtistsText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#64748B",
    marginBottom: 10,
  },
  syncBtn: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
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
