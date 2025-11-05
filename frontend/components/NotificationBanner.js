import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationBanner({ notification, onPress, onDismiss }) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (notification) {
      // Reset animations
      slideAnim.setValue(-100);
      opacityAnim.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 4 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!notification) return null;

  const payload = notification.payload || {};
  const actorAvatar = payload.actorAvatar;
  const actorName = payload.actorName || 'Someone';

  // Position just below the safe area
  const bannerTopPosition = insets.top + 12;

  return (
    <Animated.View
      style={[
        styles.absoluteContainer,
        {
          top: bannerTopPosition,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
        <TouchableOpacity
          style={styles.banner}
          onPress={() => {
            if (onPress) onPress();
            handleDismiss();
          }}
          activeOpacity={0.95}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Image
              source={
                actorAvatar
                  ? { uri: actorAvatar }
                  : require('../assets/icon.png')
              }
              style={styles.avatar}
            />
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            <Text style={styles.text} numberOfLines={2}>
              <Text style={styles.boldText}>{actorName}</Text>
              {notification.type === 'follow' && (
                <Text style={styles.normalText}> started following you</Text>
              )}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimestamp(notification.created_at)}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeIcon}>×</Text>
          </TouchableOpacity>
        </TouchableOpacity>
    </Animated.View>
  );
}

function formatTimestamp(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10000,
    paddingHorizontal: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    minHeight: 64,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    color: '#000000',
    marginBottom: 2,
  },
  boldText: {
    fontWeight: '600',
  },
  normalText: {
    fontWeight: '400',
    color: '#262626',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E8E',
    marginTop: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 22,
    color: '#8E8E8E',
    lineHeight: 22,
    fontWeight: '300',
  },
});