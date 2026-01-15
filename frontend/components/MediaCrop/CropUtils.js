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
 * @param {number} params.scale - Effective scale (displayScale * userZoom)
 * @param {number} params.translateX - Current X translation (in screen pixels)
 * @param {number} params.translateY - Current Y translation (in screen pixels)
 * @param {number} params.displayWidth - Display width (image scaled to fill frame)
 * @param {number} params.displayHeight - Display height (image scaled to fill frame)
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
  displayWidth,
  displayHeight,
}) => {
  // The scale passed is the effective scale (displayScale * userZoom)
  // translateX/Y are in screen-pixel space relative to displayed image

  // Calculate the display scale (how much the image is scaled to fill the frame)
  const displayScale = displayWidth / imageWidth;

  // Calculate userZoom from effectiveScale
  const userZoom = scale / displayScale;

  // The actual displayed size at the time of interaction (with user zoom applied)
  const actualDisplayedWidth = displayWidth * userZoom;
  const actualDisplayedHeight = displayHeight * userZoom;

  // The frame is centered on the displayed image
  // translateX/Y represents how much the IMAGE has moved relative to the frame center
  // The frame is FIXED on screen. translate moves the IMAGE.
  // Positive translateY = user dragged image DOWN = image moved DOWN relative to frame
  // This means LOWER parts of the image are now visible in the frame
  // So the frame's position in image coordinates should be HIGHER (larger Y value = further down)

  // When translate=0, frame is centered on image
  // When image moves down by translate, we're viewing content that's further UP in original
  // So we subtract translate to get the frame's position in image coordinates
  const frameLeftInDisplayed =
    (actualDisplayedWidth - frameWidth) / 2 - translateX;
  const frameTopInDisplayed =
    (actualDisplayedHeight - frameHeight) / 2 - translateY;

  // Convert from actualDisplayed coordinates to original image coordinates
  // actualDisplayed = original * displayScale * userZoom
  // So: original = actualDisplayed / (displayScale * userZoom) = actualDisplayed / scale
  // But scale = displayScale * userZoom, so:
  // original = actualDisplayed / scale ??? No, that's wrong!

  // Actually: actualDisplayed = displayWidth * userZoom = (imageWidth * displayScale) * userZoom
  // So to go from actualDisplayed to original: original = actualDisplayed / (displayScale * userZoom)
  // displayScale * userZoom = scale (the effectiveScale), so: original = actualDisplayed / scale

  // Wait, let me recalculate...
  // displayWidth = imageWidth * displayScale (image scaled to fit)
  // actualDisplayedWidth = displayWidth * userZoom = imageWidth * displayScale * userZoom
  // So: actualDisplayedWidth / imageWidth = displayScale * userZoom = scale
  // Therefore: imageWidth = actualDisplayedWidth / scale

  // To convert a coordinate from actualDisplayed space to original space:
  // originalCoord = actualDisplayedCoord * (imageWidth / actualDisplayedWidth)
  //               = actualDisplayedCoord / (actualDisplayedWidth / imageWidth)
  //               = actualDisplayedCoord / scale

  // But wait - the issue is that 'scale' passed in is effectiveScale = initialScale * savedCropData.scale
  // where initialScale = displayWidth / imageWidth (same as displayScale)
  // So scale = displayScale * userZoom = displayScale * savedCropData.scale

  // Let me recalculate with cleaner logic:
  // The image is displayed at size (actualDisplayedWidth, actualDisplayedHeight)
  // The original image is (imageWidth, imageHeight)
  // The conversion factor is: originalX = displayedX * (imageWidth / actualDisplayedWidth)

  const scaleToOriginalX = imageWidth / actualDisplayedWidth;
  const scaleToOriginalY = imageHeight / actualDisplayedHeight;

  const originX = frameLeftInDisplayed * scaleToOriginalX;
  const originY = frameTopInDisplayed * scaleToOriginalY;
  const cropWidth = frameWidth * scaleToOriginalX;
  const cropHeight = frameHeight * scaleToOriginalY;

  // Clamp origin to ensure it's within image bounds
  const clampedOriginX = Math.max(0, Math.min(originX, imageWidth - 1));
  const clampedOriginY = Math.max(0, Math.min(originY, imageHeight - 1));

  // Calculate maximum available width/height from the clamped origin
  const maxAvailableWidth = imageWidth - clampedOriginX;
  const maxAvailableHeight = imageHeight - clampedOriginY;

  // Clamp crop dimensions to fit within available space
  const clampedWidth = Math.max(1, Math.min(cropWidth, maxAvailableWidth));
  const clampedHeight = Math.max(1, Math.min(cropHeight, maxAvailableHeight));

  // Debug: Log all intermediate values
  console.log("[CropUtils] calculateCropRegion debug:", {
    input: {
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
      scale,
      translateX,
      translateY,
      displayWidth,
      displayHeight,
    },
    calculated: {
      displayScale,
      userZoom,
      actualDisplayedWidth,
      actualDisplayedHeight,
      frameLeftInDisplayed,
      frameTopInDisplayed,
      scaleToOriginalX,
      scaleToOriginalY,
    },
    raw: { originX, originY, cropWidth, cropHeight },
    clamped: {
      originX: clampedOriginX,
      originY: clampedOriginY,
      width: clampedWidth,
      height: clampedHeight,
    },
  });

  return {
    originX: clampedOriginX,
    originY: clampedOriginY,
    width: clampedWidth,
    height: clampedHeight,
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
