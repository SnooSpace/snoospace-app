import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";

export const GradientHeart = ({ width = 150, height = 150 }) => (
  <Svg width={width} height={height} viewBox="0 0 48 48">
    <Defs>
      <LinearGradient id="blueGradient" x1="5%" y1="5%" x2="95%" y2="95%">
        <Stop offset="0%" stopColor="#00f2fe" stopOpacity="1" />
        <Stop offset="45%" stopColor="#00c6ff" stopOpacity="1" />
        <Stop offset="100%" stopColor="#0072ff" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    <Path
      fill="url(#blueGradient)"
      d="M34.6 3.1c-4.5 0-7.9 1.8-10.6 5.6-2.7-3.7-6.1-5.5-10.6-5.5C6 3.1 0 9.6 0 17.6c0 7.3 5.4 12 10.6 16.5.6.5 1.3 1.1 1.9 1.7l2.3 2c4.4 3.9 6.6 5.9 7.6 6.5.5.3 1.1.5 1.6.5s1.1-.2 1.6-.5c1-.6 2.8-2.2 7.8-6.8l2-1.8c.7-.6 1.3-1.2 2-1.7C42.7 29.6 48 25 48 17.6c0-8-6-14.5-13.4-14.5z"
    />
  </Svg>
);
