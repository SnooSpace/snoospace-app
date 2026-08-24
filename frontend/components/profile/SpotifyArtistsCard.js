import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Music, MessageSquare, Disc3, Mic2 } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FONTS } from '../../constants/theme';
import HapticsService from '../../services/HapticsService';

const SpotifyLogo = ({ size = 20, color = "#FFFFFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.216.354-.676.464-1.028.249-2.818-1.722-6.365-2.111-10.542-1.157-.403.092-.804-.16-.896-.562-.092-.402.159-.804.563-.895 4.571-1.045 8.492-.595 11.655 1.338.353.214.464.675.248 1.027zm1.469-3.267c-.271.44-.847.578-1.287.308-3.225-1.982-8.142-2.557-11.958-1.398-.494.149-1.017-.13-1.167-.624-.149-.495.13-1.016.624-1.167 4.358-1.323 9.776-.682 13.48 1.594.44.27.578.846.308 1.287zm.126-3.403C15.23 8.341 8.85 8.13 5.157 9.251c-.593.18-1.22-.155-1.4-.748-.18-.593.155-1.22.748-1.4 4.239-1.287 11.285-1.038 15.738 1.605.533.317.708 1.005.392 1.538-.317.533-1.007.709-1.537.392z" />
  </Svg>
);

export function SpotifyArtistsCard({ artists = [], tracks = [], targetUsername, onPromptPress }) {
  const hasArtists = Array.isArray(artists) && artists.length > 0;
  const hasTracks = Array.isArray(tracks) && tracks.length > 0;

  if (!hasArtists && !hasTracks) return null;

  const [activeTab, setActiveTab] = useState(hasArtists ? 'artists' : 'tracks');

  const topGenres = [...new Set(
    artists.flatMap(a => (typeof a === 'object' && Array.isArray(a.genres) ? a.genres : []))
  )].slice(0, 4);

  const handleArtistPress = useCallback((artistName, spotifyUrl) => {
    HapticsService.triggerImpactLight();
    if (spotifyUrl) {
      Linking.openURL(spotifyUrl).catch(() => {});
      return;
    }
    const query = encodeURIComponent(artistName);
    Linking.openURL(`https://open.spotify.com/search/${query}`).catch(() => {});
  }, []);

  const handleTrackPress = useCallback((trackName, artistName, spotifyUrl) => {
    HapticsService.triggerImpactLight();
    if (spotifyUrl) {
      Linking.openURL(spotifyUrl).catch(() => {});
      return;
    }
    const query = encodeURIComponent(`${trackName} ${artistName || ''}`);
    Linking.openURL(`https://open.spotify.com/search/${query}`).catch(() => {});
  }, []);

  const handleTabChange = (tab) => {
    HapticsService.triggerSelection();
    setActiveTab(tab);
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.spotifyLogoContainer}>
            <SpotifyLogo size={20} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Spotify Music</Text>
            <Text style={styles.headerSub}>Synced · last 6 months</Text>
          </View>
        </View>

        {/* Tab Toggle (if both artists & tracks are available) */}
        {hasArtists && hasTracks && (
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'artists' && styles.segmentBtnActive]}
              onPress={() => handleTabChange('artists')}
              activeOpacity={0.8}
            >
              <Mic2 size={13} color={activeTab === 'artists' ? '#1DB954' : '#64748B'} strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={[styles.segmentText, activeTab === 'artists' && styles.segmentTextActive]}>
                Artists
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'tracks' && styles.segmentBtnActive]}
              onPress={() => handleTabChange('tracks')}
              activeOpacity={0.8}
            >
              <Disc3 size={13} color={activeTab === 'tracks' ? '#1DB954' : '#64748B'} strokeWidth={2.5} style={{ marginRight: 4 }} />
              <Text style={[styles.segmentText, activeTab === 'tracks' && styles.segmentTextActive]}>
                Songs
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* TOP ARTISTS VIEW */}
      {activeTab === 'artists' && hasArtists && (
        <View style={styles.sectionBody}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.artistsRow}
          >
            {artists.map((artist, idx) => {
              const artistName = typeof artist === 'string' ? artist : (artist.name || artist.artist_name || '');
              const imageUrl = typeof artist === 'object' ? (artist.image_url || artist.artist_image_url) : null;
              const spotifyUrl = typeof artist === 'object' ? (artist.spotify_url || null) : null;
              const key = (typeof artist === 'object' && (artist.id || artist.spotify_artist_id)) || `${artistName}-${idx}`;
              const isRank1 = typeof artist === 'object' ? (artist.rank === 1) : (idx === 0);

              if (!artistName) return null;

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.artistItem}
                  onPress={() => handleArtistPress(artistName, spotifyUrl)}
                  activeOpacity={0.75}
                >
                  <View style={styles.imageWrapper}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.artistImage}
                      />
                    ) : (
                      <View style={[styles.artistImage, styles.artistImageFallback]}>
                        <Music size={24} color="#64748B" />
                      </View>
                    )}
                    {isRank1 && (
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>♯1</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.artistName} numberOfLines={2}>
                    {artistName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Genre tags */}
          {topGenres.length > 0 && (
            <View style={styles.genreRow}>
              {topGenres.map((genre) => (
                <View
                  key={genre}
                  style={styles.genreTag}
                >
                  <Text style={styles.genreText}>
                    {genre}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* TOP TRACKS (SONGS) VIEW */}
      {activeTab === 'tracks' && hasTracks && (
        <View style={styles.sectionBody}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tracksRow}
          >
            {tracks.map((track, idx) => {
              const trackName = typeof track === 'string' ? track : (track.name || track.title || '');
              const artistName = typeof track === 'object' ? (track.artist_name || track.artists || '') : '';
              const imageUrl = typeof track === 'object' ? (track.image_url || track.album_art_url) : null;
              const spotifyUrl = typeof track === 'object' ? (track.spotify_url || null) : null;
              const key = (typeof track === 'object' && (track.id || track.spotify_track_id)) || `${trackName}-${idx}`;
              const rank = typeof track === 'object' && track.rank ? track.rank : idx + 1;

              if (!trackName) return null;

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.trackItem}
                  onPress={() => handleTrackPress(trackName, artistName, spotifyUrl)}
                  activeOpacity={0.75}
                >
                  <View style={styles.trackImageWrapper}>
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.trackImage}
                      />
                    ) : (
                      <View style={[styles.trackImage, styles.artistImageFallback]}>
                        <Music size={24} color="#64748B" />
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
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Conversation Prompt Footer */}
      <TouchableOpacity
        style={styles.promptRow}
        onPress={() => {
          HapticsService.triggerImpactLight();
          if (onPromptPress) onPromptPress();
        }}
        activeOpacity={0.7}
      >
        <MessageSquare size={15} color="#1DB954" strokeWidth={2.5} style={{ marginRight: 8 }} />
        <Text style={styles.promptText}>
          Ask {targetUsername} about their music taste
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginVertical: 8,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    paddingVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spotifyLogoContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  headerText: { 
    gap: 1 
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    letterSpacing: -0.3,
  },
  headerSub: {
    color: '#16A34A',
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#64748B',
  },
  segmentTextActive: {
    fontFamily: FONTS.semiBold,
    color: '#0F172A',
  },
  sectionBody: {
    paddingTop: 6, // Prevents rank badges from being cut off at the top
  },
  artistsRow: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 16,
  },
  artistItem: {
    alignItems: 'center',
    width: 76,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  artistImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  artistImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.primary,
  },
  artistName: {
    color: '#1E293B',
    fontSize: 12,
    fontFamily: FONTS.medium,
    textAlign: 'center',
  },
  tracksRow: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 14,
  },
  trackItem: {
    width: 96,
  },
  trackImageWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  trackImage: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  trackRankBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  trackRankText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: FONTS.semiBold,
  },
  trackTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  trackArtist: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 1,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  genreText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: '#475569',
    textTransform: 'capitalize',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  promptText: {
    color: '#334155',
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
});
