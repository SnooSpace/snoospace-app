import React, { useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Music, MessageSquare } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FONTS, COLORS } from '../../constants/theme';
import HapticsService from '../../services/HapticsService';

const SpotifyLogo = ({ size = 18, color = "#FFFFFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.216.354-.676.464-1.028.249-2.818-1.722-6.365-2.111-10.542-1.157-.403.092-.804-.16-.896-.562-.092-.402.159-.804.563-.895 4.571-1.045 8.492-.595 11.655 1.338.353.214.464.675.248 1.027zm1.469-3.267c-.271.44-.847.578-1.287.308-3.225-1.982-8.142-2.557-11.958-1.398-.494.149-1.017-.13-1.167-.624-.149-.495.13-1.016.624-1.167 4.358-1.323 9.776-.682 13.48 1.594.44.27.578.846.308 1.287zm.126-3.403C15.23 8.341 8.85 8.13 5.157 9.251c-.593.18-1.22-.155-1.4-.748-.18-.593.155-1.22.748-1.4 4.239-1.287 11.285-1.038 15.738 1.605.533.317.708 1.005.392 1.538-.317.533-1.007.709-1.537.392z" />
  </Svg>
);

const GENRE_COLORS = {
  'pop':        '#3B5BDB',
  'indie':      '#7048E8',
  'hip hop':    '#E67700',
  'electronic': '#0C8599',
  'r&b':        '#C2255C',
  'default':    '#64748B',
};

function genreColor(genre) {
  const match = Object.keys(GENRE_COLORS).find(k => genre.toLowerCase().includes(k));
  return match ? GENRE_COLORS[match] : GENRE_COLORS.default;
}

export function SpotifyArtistsCard({ artists = [], targetUsername }) {
  if (!artists || artists.length === 0) return null;

  const topGenres = [...new Set(
    artists.flatMap(a => (typeof a === 'object' && Array.isArray(a.genres) ? a.genres : []))
  )].slice(0, 4);

  const handleArtistPress = useCallback((artistName) => {
    HapticsService.triggerImpactLight();
    const query = encodeURIComponent(artistName);
    Linking.openURL(`https://open.spotify.com/search/${query}`).catch(() => {});
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.spotifyLogoContainer}>
            <SpotifyLogo size={18} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Top Artists</Text>
            <Text style={styles.headerSub}>via Spotify · last 6 months</Text>
          </View>
        </View>
      </View>

      {/* Artist bubbles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.artistsRow}
      >
        {artists.map((artist, idx) => {
          const artistName = typeof artist === 'string' ? artist : (artist.name || artist.artist_name || '');
          const imageUrl = typeof artist === 'object' ? (artist.image_url || artist.artist_image_url) : null;
          const key = (typeof artist === 'object' && (artist.id || artist.spotify_artist_id)) || `${artistName}-${idx}`;
          const isRank1 = typeof artist === 'object' ? (artist.rank === 1) : (idx === 0);

          if (!artistName) return null;

          return (
            <TouchableOpacity
              key={key}
              style={styles.artistItem}
              onPress={() => handleArtistPress(artistName)}
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
                    <Music size={22} color="#868E96" />
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
              style={[styles.genreTag, { backgroundColor: genreColor(genre) + '1A' }]}
            >
              <Text style={[styles.genreText, { color: genreColor(genre) }]}>
                {genre}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Conversation prompt */}
      <TouchableOpacity style={styles.promptRow} activeOpacity={0.7}>
        <MessageSquare size={14} color="#1DB954" strokeWidth={2} style={{ marginRight: 6 }} />
        <Text style={styles.promptText}>
          Ask {targetUsername} about their music taste
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0D1117',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1DB95422',  // Spotify green tint, subtle
    marginVertical: 8,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spotifyLogoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1DB954',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { 
    gap: 1 
  },
  headerTitle: {
    color: '#F8F9FA',
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  headerSub: {
    color: '#868E96',
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  artistsRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 14,
  },
  artistItem: {
    alignItems: 'center',
    width: 70,
  },
  imageWrapper: {
    position: 'relative',
    marginBottom: 6,
  },
  artistImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#1C1C1E',
  },
  artistImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1DB954',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: FONTS.primary, // BasicCommercial-Bold
  },
  artistName: {
    color: '#CED4DA',
    fontSize: 11,
    fontFamily: FONTS.medium,
    textAlign: 'center',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  genreTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  genreText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    textTransform: 'capitalize',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1C2128',
  },
  promptText: {
    color: '#B8E0E8',
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
});
