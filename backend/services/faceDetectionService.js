/**
 * Face Detection Service
 * 
 * Provides automated face detection, landmark extraction, and 128-d descriptor/embedding
 * computation for profile photos using @vladmandic/face-api with SsdMobilenetv1.
 */

const path = require('path');
const axios = require('axios');
const jpeg = require('jpeg-js');

// Prefer native tfjs-node if available; fall back to pre-bundled node-wasm
let faceapi;
try {
  // Check if tfjs-node can be loaded
  require('@tensorflow/tfjs-node');
  faceapi = require('@vladmandic/face-api');
} catch (e) {
  // Use WASM backend with pure JS decoding
  faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
}

let initPromise = null;

/**
 * Initialize face-api.js models from disk.
 * Models are loaded once at service init and cached.
 */
async function initFaceApi() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Ensure TensorFlow backend is ready
    if (faceapi.tf?.ready) {
      await faceapi.tf.ready();
    }

    const modelPath = path.resolve(__dirname, '../node_modules/@vladmandic/face-api/model');

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    ]);

    console.log('[FaceDetectionService] Models loaded successfully from disk. Backend:', faceapi.tf?.getBackend?.());
  })();

  return initPromise;
}

/**
 * Download and decode an image buffer to a 3D Tensor [height, width, 3].
 * Handles Cloudinary URLs by ensuring JPEG format for fast, reliable decoding.
 * 
 * @param {string} imageUrl - The remote image URL
 * @returns {Promise<{ tensor: any, width: number, height: number }>}
 */
async function loadImageTensor(imageUrl) {
  let fetchUrl = imageUrl;

  // If this is a Cloudinary upload URL, ensure JPEG format output for universal decoding
  if (typeof fetchUrl === 'string' && fetchUrl.includes('/image/upload/') && !fetchUrl.includes('/f_jpg/')) {
    fetchUrl = fetchUrl.replace('/image/upload/', '/image/upload/f_jpg/');
  }

  const response = await axios.get(fetchUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'Accept': 'image/jpeg,image/png,image/*;q=0.8',
    },
  });

  const buffer = Buffer.from(response.data);

  // If native tfjs-node decodeImage is available, use it
  if (faceapi.tf?.node?.decodeImage) {
    const rawTensor = faceapi.tf.node.decodeImage(buffer, 3);
    const height = rawTensor.shape[0];
    const width = rawTensor.shape[1];
    return { tensor: rawTensor, width, height };
  }

  // Pure JavaScript JPEG decode fallback
  const decoded = jpeg.decode(buffer, { useTArray: true });
  const tensor = faceapi.tf.browser.fromPixels(
    { data: decoded.data, width: decoded.width, height: decoded.height },
    3
  );

  return { tensor, width: decoded.width, height: decoded.height };
}

/**
 * Detect a face in a remote image URL and evaluate eligibility criteria.
 * 
 * Eligibility Criteria:
 * 1. Exactly one dominant face detected.
 * 2. Detection confidence > 0.8.
 * 3. Face bounding box height >= 15% of image height (rejects tiny/background faces).
 * 
 * @param {string} imageUrl - Remote image URL (typically Cloudinary)
 * @returns {Promise<{
 *   faceEligible: boolean,
 *   confidence: number | null,
 *   embedding: number[] | null,
 *   reason?: 'no_face' | 'multiple_faces' | 'low_confidence' | 'face_too_small' | null
 * }>}
 */
async function detectFace(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return {
      faceEligible: false,
      confidence: null,
      embedding: null,
      reason: 'no_face',
    };
  }

  await initFaceApi();

  let imageTensorObj = null;

  try {
    imageTensorObj = await loadImageTensor(imageUrl);
    const { tensor, height: imgHeight } = imageTensorObj;

    // Detect all faces using SsdMobilenetv1 with landmarks and 128-d descriptors
    const detections = await faceapi
      .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      return {
        faceEligible: false,
        confidence: null,
        embedding: null,
        reason: 'no_face',
      };
    }

    if (detections.length > 1) {
      return {
        faceEligible: false,
        confidence: null,
        embedding: null,
        reason: 'multiple_faces',
      };
    }

    const dominantFace = detections[0];
    const confidence = dominantFace.detection.score;
    const boxHeight = dominantFace.detection.box.height;

    // Check confidence threshold (> 0.8)
    if (confidence <= 0.8) {
      return {
        faceEligible: false,
        confidence: Number(confidence.toFixed(4)),
        embedding: null,
        reason: 'low_confidence',
      };
    }

    // Check size threshold (face box height must be >= 15% of image height)
    const heightRatio = boxHeight / imgHeight;
    if (heightRatio < 0.15) {
      return {
        faceEligible: false,
        confidence: Number(confidence.toFixed(4)),
        embedding: null,
        reason: 'face_too_small',
      };
    }

    // Convert 128-d Float32Array descriptor to JavaScript number array
    const embedding = Array.from(dominantFace.descriptor);

    return {
      faceEligible: true,
      confidence: Number(confidence.toFixed(4)),
      embedding,
      reason: null,
    };
  } catch (err) {
    console.error(`[FaceDetectionService] Error processing image "${imageUrl}":`, err.message);
    return {
      faceEligible: false,
      confidence: null,
      embedding: null,
      reason: 'no_face',
    };
  } finally {
    if (imageTensorObj?.tensor) {
      imageTensorObj.tensor.dispose();
    }
  }
}

module.exports = {
  initFaceApi,
  detectFace,
};
