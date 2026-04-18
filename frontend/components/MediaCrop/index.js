/**
 * MediaCrop Component Library
 * Instagram-style media crop with gesture support.
 *
 * Usage:
 *
 * 1. Navigate to CropScreen:
 *    navigation.navigate('CropScreen', {
 *      imageUri: 'file://...',
 *      presetKey: 'avatar', // or 'banner', 'event', etc.
 *      onComplete: ({ uri, width, height, metadata }) => { ... },
 *      onCancel: () => { ... },
 *    });
 *
 * 2. Or use CropView directly in your component:
 *    <CropView
 *      imageUri={imageUri}
 *      aspectRatio={[1, 1]}
 *      onCropChange={(data) => { ... }}
 *    />
 */

// Main screen for navigation integration
export { default as CropScreen } from "./CropScreen";

// Batch crop screen for multiple images
export { default as BatchCropScreen } from "./BatchCropScreen";

// Core crop view component
export { default as CropView } from "./CropView";

// Overlay component
export { default as CropOverlay } from "./CropOverlay";

// Presets and utilities
export {
  default as CropPresets,
  CROP_PRESETS,
  getPreset,
  getAspectRatioDecimal,
  calculateFrameDimensions,
  findClosestVideoPreset,
  createNaturalVideoPreset,
} from "./CropPresets";

export {
  default as CropUtils,
  clamp,
  calculateBounds,
  calculateInitialScale,
  calculateCropRegion,
  validateImageSize,
  calculateOutputDimensions,
} from "./CropUtils";

// Hook for easy integration
export { default as useCrop } from "./useCrop";
