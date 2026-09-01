/**
 * PlanCropImage.js
 * Shared component that renders a cropped region of the activity-type master image
 * as the default banner for Open Plans.
 */
import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const ACTIVITY_IMAGES = {
  sports:         require('../../assets/Illustrations/New_Sports.webp'),
  bar:            require('../../assets/Illustrations/Bar.webp'),
  food:           require('../../assets/Illustrations/Food.webp'),
  cafe:           require('../../assets/Illustrations/Cafe.webp'),
  yoga:           require('../../assets/Illustrations/Yoga.webp'),
  gym:            require('../../assets/Illustrations/Gym.webp'),
  walk:           require('../../assets/Illustrations/Jogging_Walking.webp'),
  rides:          require('../../assets/Illustrations/Ride.webp'),
  live_music:     require('../../assets/Illustrations/Music.webp'),
  study:          require('../../assets/Illustrations/New_CoWork.webp'),
  cowork:         require('../../assets/Illustrations/New_CoWork.webp'),
  creative:       require('../../assets/Illustrations/New_Creative.webp'),
  games:          require('../../assets/Illustrations/Gaming.webp'),
  gaming:         require('../../assets/Illustrations/Gaming.webp'),
  hangout:        require('../../assets/Illustrations/Hangout.webp'),
  pet_friendly:   require('../../assets/Illustrations/Pet_Gathering.webp'),
  pet_gathering:  require('../../assets/Illustrations/Pet_Gathering.webp'),
  movies:         require('../../assets/Illustrations/Movie.webp'),
  other:          require('../../assets/Illustrations/New_Other.webp'),
  house_party:    require('../../assets/Illustrations/House_Party.webp'),
  club:           require('../../assets/Illustrations/Club.webp'),
  hiking:         require('../../assets/Illustrations/New_Hiking.webp'),
  shopping:       require('../../assets/Illustrations/Shopping.webp'),
  bowling:        require('../../assets/Illustrations/Bowling.webp'),
  gokarting:      require('../../assets/Illustrations/Gokarting.webp'),
  go_karting:     require('../../assets/Illustrations/Gokarting.webp'),
  indoorgames:    require('../../assets/Illustrations/Indoorgames.webp'),
  indoor_games:   require('../../assets/Illustrations/Indoorgames.webp'),
  pilates:        require('../../assets/Illustrations/Pilates.webp'),
  swimming:       require('../../assets/Illustrations/Swimming.webp'),
};

/**
 * @param {string}  activityType  – activity key corresponding to the image mapping
 * @param {number}  containerW    – rendered width of the container
 * @param {number}  [height=110]  – rendered height of the container
 */
export default function PlanCropImage({ activityType, containerW = '100%', height = 110 }) {
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
