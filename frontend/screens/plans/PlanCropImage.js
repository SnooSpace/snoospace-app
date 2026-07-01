/**
 * PlanCropImage.js
 * Shared component that renders a cropped region of the activity-type master image
 * as the default banner for Open Plans.
 */
import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const MASTER_IMAGE = require('../../assets/Open_Plans.webp');
const MASTER_SIZE  = 1254; // pixel width & height of the source image

export const CROP_MAP = {
  sports:       { l: 130, t: 130, r: 470, b: 348 },
  movies:       { l: 360, t:  10, r: 720, b: 240 },
  bar:          { l: 870, t:   0, r: 1200, b: 200 },
  food:         { l: 810, t: 310, r: 1150, b: 530 },
  cafe:         { l: 330, t: 290, r: 670,  b: 490 },
  yoga:         { l: 480, t: 420, r: 820,  b: 650 },
  gym:          { l: 890, t: 530, r: 1220, b: 730 },
  walk:         { l:  10, t: 620, r: 350,  b: 870 },
  rides:        { l: 520, t: 910, r: 870,  b: 1120 },
  live_music:   { l: 580, t: 280, r: 880,  b: 450 },
  study:        { l: 900, t: 680, r: 1230, b: 920 },
  creative:     { l: 230, t: 820, r: 580,  b: 1060 },
  games:        { l: 130, t: 440, r: 470,  b: 690 },
  gaming:       { l: 130, t: 440, r: 470,  b: 690 },
  pet_friendly: { l: 140, t: 680, r: 490,  b: 900 },
  hangout:      { l: 450, t: 570, r: 790,  b: 790 },
  other:        { l: 300, t: 350, r: 660,  b: 570 },
};

/**
 * @param {string}  activityType  – one of the CROP_MAP keys
 * @param {number}  containerW    – rendered width of the container
 * @param {number}  [height=110]  – rendered height of the container
 */
export default function PlanCropImage({ activityType, containerW, height = 110 }) {
  if (activityType === 'other') {
    return (
      <View style={{ width: containerW, height: height, overflow: 'hidden' }}>
        <Image
          source={MASTER_IMAGE}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>
    );
  }

  const box   = CROP_MAP[activityType] || CROP_MAP.other;
  const boxW  = box.r - box.l;
  const boxH  = box.b - box.t;
  const H     = height;

  const scale   = Math.max(containerW / boxW, H / boxH);
  const imgSize = MASTER_SIZE * scale;

  // Centre the crop inside the container
  const offsetX = -(box.l * scale) + (containerW - boxW * scale) / 2;
  const offsetY = -(box.t * scale) + (H - boxH * scale) / 2;

  return (
    <View style={{ width: containerW, height: H, overflow: 'hidden' }}>
      <Image
        source={MASTER_IMAGE}
        style={{
          position: 'absolute',
          width:  imgSize,
          height: imgSize,
          left:   offsetX,
          top:    offsetY,
        }}
        contentFit="cover"
      />
    </View>
  );
}
