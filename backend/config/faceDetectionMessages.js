/**
 * Shared face detection reason codes and user-facing messages.
 * Used by verificationsController and photo eligibility pipelines (discover_photos).
 */

const REASON_MESSAGES = {
  no_face: "We couldn't detect a face in this photo. Make sure your face is clearly visible, well-lit, and facing the camera directly.",
  multiple_faces: "We detected more than one face in this photo. Please use a photo with just you in the frame — no one else visible.",
  low_confidence: "The photo quality made it hard to confirm your face clearly. Try a sharper photo with better lighting.",
  face_too_small: "Your face is too small in this frame. Zoom in or crop closer so your face fills more of the photo.",
};

const DEFAULT_FALLBACK_MESSAGE = "We couldn't verify this photo. Please try a different one.";

/**
 * Returns a user-friendly guidance message for a face detection failure reason code.
 * 
 * @param {string} [reason] - Reason code from detectFace ('no_face', 'multiple_faces', etc.)
 * @returns {string} - User-facing guidance string
 */
function getFaceDetectionMessage(reason) {
  if (reason && typeof reason === 'string' && REASON_MESSAGES[reason]) {
    return REASON_MESSAGES[reason];
  }
  return DEFAULT_FALLBACK_MESSAGE;
}

module.exports = {
  REASON_MESSAGES,
  getFaceDetectionMessage,
};
