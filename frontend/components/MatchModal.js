import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';

const MatchModal = ({ visible, matchData, onClose, onSendMessage }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Start animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Heart pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(heartAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(heartAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    } else {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      heartAnim.setValue(1);
    }
  }, [visible]);

  if (!visible || !matchData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You and {matchData.member2_name} liked each other
            </Text>
          </View>

          {/* Profile Photos */}
          <View style={styles.photosContainer}>
            <View style={styles.photoWrapper}>
              <Image
                source={{ uri: matchData.member1_photo || 'https://via.placeholder.com/150' }}
                style={styles.profilePhoto}
              />
            </View>
            
            <Animated.View style={[styles.heartContainer, { transform: [{ scale: heartAnim }] }]}>
              <Ionicons name="heart" size={40} color="#FF3B30" />
            </Animated.View>
            
            <View style={styles.photoWrapper}>
              <Image
                source={{ uri: matchData.member2_photo || 'https://via.placeholder.com/150' }}
                style={styles.profilePhoto}
              />
            </View>
          </View>

          {/* Names */}
          <View style={styles.namesContainer}>
            <Text style={styles.name1}>{matchData.member1_name}</Text>
            <Text style={styles.andText}>&</Text>
            <Text style={styles.name2}>{matchData.member2_name}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.continueButton]}
              onPress={onClose}
            >
              <Text style={styles.continueButtonText}>Continue Swiping</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.messageButton]}
              onPress={onSendMessage}
            >
              <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
              <Text style={styles.messageButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    maxWidth: screenWidth - 40,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  heartContainer: {
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  namesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  name1: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  andText: {
    fontSize: 16,
    color: '#8E8E93',
    marginHorizontal: 10,
  },
  name2: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  continueButton: {
    backgroundColor: '#F2F2F7',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  messageButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
});

export default MatchModal;
