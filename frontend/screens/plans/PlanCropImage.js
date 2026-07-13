/**
 * PlanCropImage.js
 * Shared component that renders a cropped region of the activity-type master image
 * as the default banner for Open Plans.
 */
import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const ACTIVITY_IMAGES = {
  sports:       require('../../assets/Sports.webp'),
  bar:          require('../../assets/Bar.webp'),
  food:         require('../../assets/Food.webp'),
  cafe:         require('../../assets/Cafe.webp'),
  yoga:         require('../../assets/Yoga.webp'),
  gym:          require('../../assets/Gym.webp'),
  walk:         require('../../assets/walk.webp'),
  rides:        require('../../assets/ride.webp'),
  live_music:   require('../../assets/Music.webp'),
  study:        require('../../assets/Co-work_Study.webp'),
  creative:     require('../../assets/Creative.webp'),
  games:        require('../../assets/Gaming.webp'),
  gaming:       require('../../assets/Gaming.webp'),
  hangout:      require('../../assets/Hangout.webp'),
  pet_friendly: require('../../assets/Pet_Friendly.webp'),
  movies:       require('../../assets/Movie.webp'),
  other:        require('../../assets/Other.webp'),
  house_party:  require('../../assets/HouseParty.webp'),
  club:         require('../../assets/Party.webp'),
  hiking:       require('../../assets/Hiking.webp'),
  shopping:     require('../../assets/Shopping.webp'),
};

/**
 * @param {string}  activityType  – activity key corresponding to the image mapping
 * @param {number}  containerW    – rendered width of the container
 * @param {number}  [height=110]  – rendered height of the container
 */
export default function PlanCropImage({ activityType, containerW, height = 110 }) {
  const imageSource = ACTIVITY_IMAGES[activityType];

  if (!imageSource) {
    // Return a clean premium neutral placeholder background for missing assets (like movies)
    return (
      <View style={{ width: containerW, height: height, backgroundColor: '#F1F5F9' }} />
    );
  }

  return (
    <View style={{ width: containerW, height: height, overflow: 'hidden' }}>
      <Image
        source={imageSource}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
      />
    </View>
  );
}
