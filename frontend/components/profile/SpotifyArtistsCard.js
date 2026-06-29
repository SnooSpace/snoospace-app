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
import Animated, { FadeIn } from 'react-native-reanimated';
import { FONTS, COLORS } from '../../constants/theme';
import HapticsService from '../../services/HapticsService';

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
    artists.flatMap(a => a.genres || [])
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
            <Music size={16} color="#FFFFFF" strokeWidth={2.5} />
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
        {artists.map((artist) => (
          <TouchableOpacity
            key={artist.spotify_artist_id}
            style={styles.artistItem}
            onPress={() => handleArtistPress(artist.artist_name)}
            activeOpacity={0.75}
          >
            <View style={styles.imageWrapper}>
              {artist.artist_image_url ? (
                <Image
                  source={{ uri: artist.artist_image_url }}
                  style={styles.artistImage}
                />
              ) : (
                <View style={[styles.artistImage, styles.artistImageFallback]}>
                  <Music size={22} color="#868E96" />
                </View>
              )}
              {artist.rank === 1 && (
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>♯1</Text>
                </View>
              )}
            </View>
            <Text style={styles.artistName} numberOfLines={2}>
              {artist.artist_name}
            </Text>
          </TouchableOpacity>
        ))}
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
