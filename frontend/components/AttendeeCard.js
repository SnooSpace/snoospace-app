import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

const AttendeeCard = ({ 
  attendee, 
  onSwipeLeft, 
  onSwipeRight, 
  onUndo, 
  onRequestNextEvent,
  canUndo = false 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const photos = attendee.photos || [];
  const firstPhoto = photos[0] || { photo_url: 'https://via.placeholder.com/300' };
  const remainingPhotos = photos.slice(1);

  // Reset animation values when attendee changes
  useEffect(() => {
    translateX.setValue(0);
    scale.setValue(1);
    opacity.setValue(1);
    rotate.setValue(0);
    setIsAnimating(false);
  }, [attendee.id]);

  // Animation functions
  const animateSwipe = (direction, callback) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    const targetX = direction === 'left' ? -screenWidth : screenWidth;
    
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Call the callback to move to next card
      callback();
    });
  };

  const animateReturnToCenter = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(rotate, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
  };

  const handleSwipeLeft = () => {
    animateSwipe('left', onSwipeLeft);
  };

  const handleSwipeRight = () => {
    animateSwipe('right', onSwipeRight);
  };

  const handleUndo = () => {
    if (canUndo) {
      animateReturnToCenter();
      onUndo();
    }
  };

  // Gesture handling functions
  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  // Update rotation based on translation
  useEffect(() => {
    const listener = translateX.addListener(({ value }) => {
      const rotation = value / 10; // Adjust rotation sensitivity
      rotate.setValue(rotation);
    });

    return () => {
      translateX.removeListener(listener);
    };
  }, []);

  const handleGestureStateChange = (event) => {
    const { state, translationX, velocityX, translationY } = event.nativeEvent;
    
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      // Check if this is primarily a horizontal swipe (not vertical)
      const isHorizontalSwipe = Math.abs(translationX) > Math.abs(translationY);
      
      if (!isHorizontalSwipe) {
        // If it's more vertical than horizontal, return to center
        animateReturnToCenter();
        return;
      }

      // Determine if swipe is strong enough
      const isStrongSwipe = Math.abs(translationX) > screenWidth * 0.3 || Math.abs(velocityX) > 500;
      
      if (isStrongSwipe && (state === State.END)) {
        if (translationX > 0) {
          // Swipe right - like
          handleSwipeRight();
        } else {
          // Swipe left - pass
          handleSwipeLeft();
        }
      } else {
        // Return to center for any incomplete swipe
        animateReturnToCenter();
      }
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
      activeOffsetX={[-15, 15]}
      failOffsetY={[-30, 30]}
      shouldCancelWhenOutside={true}
      minPointers={1}
      maxPointers={1}
    >
      <Animated.View style={[
        styles.card,
        {
          transform: [
            { translateX },
            { scale },
            { rotate: rotate.interpolate({
              inputRange: [-screenWidth, 0, screenWidth],
              outputRange: ['-15deg', '0deg', '15deg'],
              extrapolate: 'clamp',
            })}
          ],
          opacity
        }
      ]}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerName}>{attendee.name}</Text>
          {canUndo && (
            <TouchableOpacity 
              style={styles.headerUndoButton}
              onPress={handleUndo}
              disabled={isAnimating}
            >
              <Ionicons name="arrow-undo" size={24} color={isAnimating ? "#CCCCCC" : "#FFFFFF"} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Content */}
        <ScrollView 
          style={styles.verticalScrollView}
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
        >
          {/* First Photo with Age/Location Badge */}
          <View style={styles.firstPhoto}>
            <Image
              source={{ uri: firstPhoto.photo_url }}
              style={styles.photo}
              resizeMode="cover"
            />
            <View style={styles.ageLocationBadge}>
              <Text style={styles.badgePronounsAge}>
                {attendee.pronouns || 'they/them'}, {attendee.age}
              </Text>
              {attendee.city && (
                <View style={styles.badgeLocation}>
                  <Ionicons name="location-outline" size={14} color={LIGHT_TEXT_COLOR} />
                  <Text style={styles.badgeLocationText}>{attendee.city}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bio Section */}
          {attendee.bio && (
            <View style={styles.bioSection}>
              <Text style={styles.bioText}>{attendee.bio}</Text>
            </View>
          )}

          {/* Interests Section */}
          {attendee.interests && attendee.interests.length > 0 && (
            <View style={styles.interestsSection}>
              <Text style={styles.sectionTitle}>My interests</Text>
              <View style={styles.interestsList}>
                {attendee.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Remaining Photos */}
          {remainingPhotos.map((photo, index) => (
            <View key={photo.id || index} style={styles.photoItem}>
              <Image
                source={{ uri: photo.photo_url }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          ))}

          {/* Bottom padding for action buttons */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.passButton,
              isAnimating && styles.disabledButton
            ]}
            onPress={handleSwipeLeft}
            disabled={isAnimating}
          >
            <Ionicons name="close" size={30} color={isAnimating ? "#CCCCCC" : "#FFFFFF"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.likeButton,
              isAnimating && styles.disabledButton
            ]}
            onPress={handleSwipeRight}
            disabled={isAnimating}
          >
            <Ionicons name="heart" size={30} color={isAnimating ? "#CCCCCC" : "#FFFFFF"} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.requestButton,
              isAnimating && styles.disabledButton
            ]}
            onPress={onRequestNextEvent}
            disabled={isAnimating}
          >
            <Ionicons name="calendar-outline" size={24} color={isAnimating ? "#CCCCCC" : "#FFFFFF"} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  card: {
    width: screenWidth - 40,
    height: screenHeight * 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  headerUndoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalScrollView: {
    flex: 1,
  },
  firstPhoto: {
    position: 'relative',
    height: screenHeight * 0.65,
  },
  photoItem: {
    height: screenHeight * 0.65,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  ageLocationBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badgePronounsAge: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  badgeLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeLocationText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 5,
  },
  bioSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  bioText: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  interestsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bottomPadding: {
    height: 100, // Space for action buttons
  },
  actionButtons: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  passButton: {
    backgroundColor: '#FF3B30',
  },
  likeButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  requestButton: {
    backgroundColor: '#34C759',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default AttendeeCard;
