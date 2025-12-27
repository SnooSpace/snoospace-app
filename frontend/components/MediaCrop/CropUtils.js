/**
 * CropUtils.js
 * Utility functions for crop calculations including bounds, clamping, and transforms.
 */

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => {
  "worklet";
  return Math.min(Math.max(value, min), max);
};

/**
 * Calculate scale and pan bounds for crop constraints
 * Ensures the image always fills the crop frame with no empty areas
 *
 * @param {Object} params
 * @param {number} params.imageWidth - Original image width
 * @param {number} params.imageHeight - Original image height
 * @param {number} params.frameWidth - Crop frame width
 * @param {number} params.frameHeight - Crop frame height
 * @param {number} params.currentScale - Current scale value
 * @param {number} params.maxZoom - Maximum zoom multiplier (default 5)
 * @returns {Object} { minScale, maxScale, panLimits: { minX, maxX, minY, maxY } }
 */
export const calculateBounds = ({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  currentScale = 1,
  maxZoom = 5,
}) => {
  "worklet";

  // Guard against zero dimensions
  if (!imageWidth || !imageHeight || !frameWidth || !frameHeight) {
    return {
      minScale: 1,
      maxScale: maxZoom,
      panLimits: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
    };
  }

  // Minimum scale: image must fill the frame entirely (cover behavior)
  const minScaleX = frameWidth / imageWidth;
  const minScaleY = frameHeight / imageHeight;
  const minScale = Math.max(minScaleX, minScaleY);

  // Maximum scale: maxZoom times the minimum scale
  const maxScale = minScale * maxZoom;

  // Clamp current scale to valid range
  const clampedScale = clamp(currentScale, minScale, maxScale);

  // Calculate scaled image dimensions
  const scaledWidth = imageWidth * clampedScale;
  const scaledHeight = imageHeight * clampedScale;

  // Calculate pan limits (image edges cannot enter the frame)
  // The image center can move by half the difference between scaled size and frame size
  const maxTranslateX = Math.max(0, (scaledWidth - frameWidth) / 2);
  const maxTranslateY = Math.max(0, (scaledHeight - frameHeight) / 2);

  return {
    minScale,
    maxScale,
    panLimits: {
      minX: -maxTranslateX,
      maxX: maxTranslateX,
      minY: -maxTranslateY,
      maxY: maxTranslateY,
    },
  };
};

/**
 * Calculate initial scale to fit/fill image in frame
 * @param {Object} params
 * @param {number} params.imageWidth - Original image width
 * @param {number} params.imageHeight - Original image height
 * @param {number} params.frameWidth - Crop frame width
 * @param {number} params.frameHeight - Crop frame height
 * @param {string} params.mode - 'fill' (cover) or 'fit' (contain)
 * @returns {number} Initial scale value
 */
export const calculateInitialScale = ({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  mode = "fill",
}) => {
  "worklet";

  if (!imageWidth || !imageHeight || !frameWidth || !frameHeight) {
    return 1;
  }

  const scaleX = frameWidth / imageWidth;
  const scaleY = frameHeight / imageHeight;

  // 'fill' = cover (use larger scale to fill frame)
  // 'fit' = contain (use smaller scale to show entire image)
  return mode === "fill" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
};

/**
 * Calculate crop region for image export
 * Converts transform values to crop coordinates
 *
 * @param {Object} params
 * @param {number} params.imageWidth - Original image width
 * @param {number} params.imageHeight - Original image height
 * @param {number} params.frameWidth - Crop frame width
 * @param {number} params.frameHeight - Crop frame height
 * @param {number} params.scale - Current scale
 * @param {number} params.translateX - Current X translation
 * @param {number} params.translateY - Current Y translation
 * @returns {Object} { originX, originY, width, height } in original image coordinates
 */
export const calculateCropRegion = ({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  scale,
  translateX,
  translateY,
}) => {
  // The visible region in the frame, converted back to original image space
  // The frame is centered on the scaled image, offset by translate values

  // Scaled image dimensions
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // Center of the scaled image relative to frame center
  // translateX/Y moves the image, so negative translate means image moved left/up
  const centerOffsetX = scaledWidth / 2 - translateX;
  const centerOffsetY = scaledHeight / 2 - translateY;

  // Visible frame region in scaled image coordinates
  const frameLeftInScaled = centerOffsetX - frameWidth / 2;
  const frameTopInScaled = centerOffsetY - frameHeight / 2;

  // Convert to original image coordinates
  const originX = frameLeftInScaled / scale;
  const originY = frameTopInScaled / scale;
  const cropWidth = frameWidth / scale;
  const cropHeight = frameHeight / scale;

  return {
    originX: Math.max(0, originX),
    originY: Math.max(0, originY),
    width: Math.min(cropWidth, imageWidth - originX),
    height: Math.min(cropHeight, imageHeight - originY),
  };
};

/**
 * Check if image meets minimum resolution requirements
 * @param {number} imageWidth - Image width
 * @param {number} imageHeight - Image height
 * @param {number} minWidth - Minimum required width
 * @param {number} minHeight - Minimum required height
 * @returns {Object} { valid, message }
 */
export const validateImageSize = (
  imageWidth,
  imageHeight,
  minWidth,
  minHeight
) => {
  if (imageWidth < minWidth || imageHeight < minHeight) {
    return {
      valid: false,
      message: `Image too small. Minimum size is ${minWidth}×${minHeight}px. Your image is ${imageWidth}×${imageHeight}px.`,
    };
  }
  return { valid: true, message: null };
};

/**
 * Calculate output dimensions maintaining aspect ratio
 * @param {Array} aspectRatio - [width, height] ratio
 * @param {number} targetWidth - Desired output width
 * @returns {Object} { width, height }
 */
export const calculateOutputDimensions = (aspectRatio, targetWidth) => {
  const ratio = aspectRatio[0] / aspectRatio[1];
  return {
    width: Math.round(targetWidth),
    height: Math.round(targetWidth / ratio),
  };
};

export default {
  clamp,
  calculateBounds,
  calculateInitialScale,
  calculateCropRegion,
  validateImageSize,
  calculateOutputDimensions,
};
