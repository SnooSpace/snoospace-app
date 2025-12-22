import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  Linking,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventDetails } from '../../api/events';
import { getGradientForName, getInitials } from '../../utils/AvatarGenerator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BANNER_HEIGHT = SCREEN_HEIGHT * 0.45;

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const BACKGROUND_COLOR = '#0A0A0A';
const CARD_BACKGROUND = '#1A1A1A';

const EventDetailsScreen = ({ route, navigation }) => {
  const { eventId, eventData: initialData } = route.params || {};
  const insets = useSafeAreaInsets();
  
  // Use initialData for quick display, but always load full details from API
  const [event, setEvent] = useState(initialData || null);
  const [loading, setLoading] = useState(true); // Always show loading initially
  const [error, setError] = useState(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Always load full event details from API
    const id = eventId || initialData?.id;
    if (id) {
      loadEventDetails(id);
    } else {
      setLoading(false);
      setError('No event ID provided');
    }
  }, [eventId, initialData?.id]);

  const loadEventDetails = async (id) => {
    try {
      setLoading(true);
      const response = await getEventDetails(id);
      if (response?.event) {
        setEvent(response.event);
      } else {
        // If API fails but we have initialData, use it
        if (!initialData) {
          setError('Failed to load event details');
        }
      }
    } catch (err) {
      console.error('Error loading event details:', err);
      // If API fails and no initialData, show error
      if (!initialData) {
        setError('Failed to load event details');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (startDate, endDate) => {
    if (!startDate) return '';
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    const dayOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    
    const startDay = start.toLocaleDateString('en-IN', dayOptions);
    const startTime = start.toLocaleTimeString('en-IN', timeOptions);
    
    if (end && end.toDateString() !== start.toDateString()) {
      const endDay = end.toLocaleDateString('en-IN', dayOptions);
      const endTime = end.toLocaleTimeString('en-IN', timeOptions);
      return `${startDay}, ${startTime} - ${endDay}, ${endTime}`;
    }
    
    if (end) {
      const endTime = end.toLocaleTimeString('en-IN', timeOptions);
      return `${startDay}, ${startTime} - ${endTime}`;
    }
    
    return `${startDay}, ${startTime}`;
  };

  const formatGatesTime = (gatesTime) => {
    if (!gatesTime) return null;
    const time = new Date(gatesTime);
    return time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Parse venue name from Google Maps URL
  const parseVenueName = (url) => {
    if (!url) return null;
    try {
      // Try to extract place name from various Google Maps URL formats
      // Format: /place/Place+Name/ or /search/Place+Name/
      const placeMatch = url.match(/\/place\/([^/@]+)/);
      if (placeMatch) {
        return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      }
      // Format: q=Place+Name
      const qMatch = url.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        return decodeURIComponent(qMatch[1].replace(/\+/g, ' '));
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const handleOpenLocation = () => {
    if (event?.location_url) {
      Linking.openURL(event.location_url);
    }
  };

  const handleViewCommunity = () => {
    if (event?.community_id) {
      navigation.navigate('CommunityPublicProfile', { communityId: event.community_id });
    }
  };

  const handleRegister = () => {
    // TODO: Implement registration flow
    console.log('Register for event:', event?.id);
  };

  // Navigate to featured account's profile based on account type
  const handleFeaturedAccountPress = (account) => {
    if (!account.linked_account_id || !account.linked_account_type) return;
    
    switch (account.linked_account_type) {
      case 'member':
        navigation.navigate('MemberPublicProfile', { memberId: account.linked_account_id });
        break;
      case 'community':
        navigation.navigate('CommunityPublicProfile', { communityId: account.linked_account_id });
        break;
      case 'sponsor':
        // Sponsor profiles not yet implemented
        console.log('Sponsor profile navigation not implemented');
        break;
    }
  };

  // Navigate to community head's linked member profile
  const handleCommunityHeadPress = (head) => {
    if (head.member_id) {
      navigation.navigate('MemberPublicProfile', { memberId: head.member_id });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color={MUTED_TEXT} />
        <Text style={styles.errorText}>{error || 'Event not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Handle multiple possible banner field names from API
  const banners = event.banner_carousel?.length > 0 
    ? event.banner_carousel 
    : event.banners?.length > 0 
      ? event.banners 
      : event.banner_url 
        ? [{ image_url: event.banner_url, url: event.banner_url }] 
        : [];

  const categories = event.categories 
    ? (Array.isArray(event.categories) ? event.categories : [event.categories])
    : [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Floating Header */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="bookmark-outline" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Banner Section */}
        <View style={styles.bannerContainer}>
          {banners.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentBannerIndex(index);
              }}
            >
              {banners.map((banner, index) => (
                <Image
                  key={index}
                  source={{ uri: banner.image_url || banner.url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <LinearGradient
              colors={getGradientForName(event.title)}
              style={styles.bannerImage}
            />
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', BACKGROUND_COLOR]}
            style={styles.bannerGradient}
          />
          
          {/* Banner Dots */}
          {banners.length > 1 && (
            <View style={styles.dotsContainer}>
              {banners.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    currentBannerIndex === index && styles.activeDot,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          {/* Category Pills */}
          {categories.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesContainer}
            >
              {categories.map((category, index) => (
                <View key={index} style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{category}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Date/Time */}
          <Text style={styles.dateTime}>
            {formatDateTime(event.start_datetime || event.event_date, event.end_datetime)}
          </Text>

          {/* Venue Row */}
          {event.location_url && (
            <TouchableOpacity style={styles.infoRow} onPress={handleOpenLocation}>
              <View style={styles.infoIcon}>
                <Ionicons name="location-outline" size={20} color={TEXT_COLOR} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle} numberOfLines={2}>
                  {event.venue_name || parseVenueName(event.location_url) || 'View Location'}
                </Text>
                <Text style={styles.infoSubtitle}>Tap to open in Maps</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED_TEXT} />
            </TouchableOpacity>
          )}

          {/* Gates Open Row */}
          {event.gates_open_time && (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="time-outline" size={20} color={TEXT_COLOR} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>
                  Gates open at {formatGatesTime(event.gates_open_time)}
                </Text>
                <Text style={styles.infoSubtitle}>View full schedule & timeline</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={MUTED_TEXT} />
            </View>
          )}

          {/* About Section */}
          {event.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About the event</Text>
              <Text 
                style={styles.description}
                numberOfLines={descriptionExpanded ? undefined : 4}
              >
                {event.description}
              </Text>
              {event.description.length > 200 && (
                <TouchableOpacity onPress={() => setDescriptionExpanded(!descriptionExpanded)}>
                  <Text style={styles.readMore}>
                    {descriptionExpanded ? 'Show less' : 'Read more'} ›
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Highlights Section */}
          {event.highlights?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Event Highlights</Text>
              {event.highlights.map((highlight, index) => (
                <View key={index} style={styles.highlightItem}>
                  <Ionicons 
                    name={highlight.icon_name || 'star'} 
                    size={20} 
                    color={PRIMARY_COLOR} 
                  />
                  <View style={styles.highlightContent}>
                    <Text style={styles.highlightTitle}>{highlight.title}</Text>
                    {highlight.description && (
                      <Text style={styles.highlightDesc}>{highlight.description}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Things to Know Section */}
          {event.things_to_know?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Things to Know</Text>
              {event.things_to_know.slice(0, 3).map((item, index) => (
                <View key={index} style={styles.thingRow}>
                  <Ionicons 
                    name={item.icon_name || 'information-circle-outline'} 
                    size={22} 
                    color={TEXT_COLOR} 
                  />
                  <Text style={styles.thingText}>{item.label}</Text>
                </View>
              ))}
              {event.things_to_know.length > 3 && (
                <TouchableOpacity>
                  <Text style={styles.seeAll}>See all ›</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Featured Accounts Section */}
          {event.featured_accounts?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {event.featured_accounts.map((account, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[
                      styles.featuredCard,
                      account.linked_account_id && styles.featuredCardClickable
                    ]}
                    onPress={() => handleFeaturedAccountPress(account)}
                    disabled={!account.linked_account_id}
                    activeOpacity={account.linked_account_id ? 0.7 : 1}
                  >
                    {account.profile_photo_url || account.account_photo ? (
                      <Image 
                        source={{ uri: account.profile_photo_url || account.account_photo }} 
                        style={styles.featuredPhoto} 
                      />
                    ) : (
                      <LinearGradient
                        colors={getGradientForName(account.display_name || account.account_name || 'A')}
                        style={styles.featuredPhoto}
                      >
                        <Text style={styles.featuredInitials}>
                          {getInitials(account.display_name || account.account_name || 'A')}
                        </Text>
                      </LinearGradient>
                    )}
                    <Text style={styles.featuredName} numberOfLines={1}>
                      {account.display_name || account.account_name}
                    </Text>
                    <Text style={styles.featuredRole}>{account.role}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Organised By Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organised By</Text>
            <TouchableOpacity style={styles.hostCard} onPress={handleViewCommunity}>
              <View style={styles.hostLeft}>
                {event.community_logo ? (
                  <Image source={{ uri: event.community_logo }} style={styles.hostAvatar} />
                ) : (
                  <LinearGradient
                    colors={getGradientForName(event.community_name || 'C')}
                    style={styles.hostAvatar}
                  >
                    <Text style={styles.hostInitials}>
                      {getInitials(event.community_name || 'C')}
                    </Text>
                  </LinearGradient>
                )}
                <View style={styles.hostInfo}>
                  <Text style={styles.hostName} numberOfLines={2}>
                    {event.community_name || 'Community'}
                  </Text>
                </View>
              </View>
              <View style={styles.hostStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{event.community_events_count || '0'}</Text>
                  <Text style={styles.statLabel}>Events</Text>
                </View>
              </View>
            </TouchableOpacity>
            
            {/* Community Heads */}
            {event.community_heads?.length > 0 && (
              <View style={styles.headsContainer}>
                <Text style={styles.headsTitle}>Community Heads</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {event.community_heads.map((head, index) => (
                    <TouchableOpacity 
                      key={index} 
                      style={[
                        styles.headCard,
                        head.member_id && styles.headCardClickable
                      ]}
                      onPress={() => handleCommunityHeadPress(head)}
                      disabled={!head.member_id}
                      activeOpacity={head.member_id ? 0.7 : 1}
                    >
                      {head.profile_pic_url || head.profile_photo_url ? (
                        <Image source={{ uri: head.profile_pic_url || head.profile_photo_url }} style={styles.headPhoto} />
                      ) : (
                        <LinearGradient
                          colors={getGradientForName(head.name || 'H')}
                          style={styles.headPhoto}
                        >
                          <Text style={styles.headInitials}>
                            {getInitials(head.name || 'H')}
                          </Text>
                        </LinearGradient>
                      )}
                      <Text style={styles.headName} numberOfLines={1}>{head.name}</Text>
                      {head.is_primary && <Text style={styles.headRole}>Primary</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Gallery Section */}
          {event.gallery?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {event.gallery.map((image, index) => (
                  <Image 
                    key={index}
                    source={{ uri: image.image_url || image.url }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Spacer for bottom bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>
            {event.ticket_price ? `₹${event.ticket_price}` : 'Free'}
          </Text>
          {event.ticket_price && <Text style={styles.priceSubtext}>onwards</Text>}
        </View>
        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>
            {event.ticket_price ? 'Book tickets' : 'Register'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: MUTED_TEXT,
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  retryButtonText: {
    color: TEXT_COLOR,
    fontWeight: '600',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT * 0.5,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: TEXT_COLOR,
    width: 24,
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: -40,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryText: {
    color: TEXT_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 15,
    color: PRIMARY_COLOR,
    marginBottom: 20,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BACKGROUND,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  infoSubtitle: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: MUTED_TEXT,
  },
  readMore: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginTop: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  highlightContent: {
    flex: 1,
    marginLeft: 12,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  highlightDesc: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  thingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  thingText: {
    fontSize: 14,
    color: TEXT_COLOR,
    marginLeft: 12,
    flex: 1,
  },
  seeAll: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginTop: 12,
  },
  featuredCard: {
    width: 100,
    alignItems: 'center',
    marginRight: 16,
  },
  featuredPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featuredInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  featuredName: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_COLOR,
    textAlign: 'center',
  },
  featuredRole: {
    fontSize: 11,
    color: MUTED_TEXT,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  hostCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BACKGROUND,
    padding: 16,
    borderRadius: 12,
  },
  hostLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hostAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hostInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  hostName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    flex: 1,
  },
  hostInfo: {
    flex: 1,
  },
  hostStats: {
    flexDirection: 'row',
  },
  headsContainer: {
    marginTop: 16,
  },
  headsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 12,
  },
  headCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  headPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  headInitials: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  headName: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    textAlign: 'center',
  },
  headRole: {
    fontSize: 10,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  galleryImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  statItem: {
    alignItems: 'center',
    marginLeft: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 11,
    color: MUTED_TEXT,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  priceSubtext: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginLeft: 4,
  },
  registerButton: {
    backgroundColor: TEXT_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: BACKGROUND_COLOR,
  },
});

export default EventDetailsScreen;
