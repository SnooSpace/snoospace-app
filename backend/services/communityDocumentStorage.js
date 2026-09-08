const supabase = require('../supabase');

const BUCKET_NAME = 'community-verification-docs';
const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes

/**
 * Uploads a community verification PDF document to private Supabase Storage.
 *
 * @param {string|number} communityId - ID of the community
 * @param {Buffer} fileBuffer - File contents in memory
 * @param {string} originalFilename - Original uploaded filename
 * @returns {Promise<string>} The storage path within the bucket (e.g. "54/1718000000_doc.pdf")
 */
async function uploadVerificationDocument(communityId, fileBuffer, originalFilename) {
  if (!communityId) {
    throw new Error('communityId is required for document upload');
  }
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('A valid file buffer is required for document upload');
  }

  // Sanitize filename: keep alphanumeric, dots, underscores, dashes
  const safeFilename = (originalFilename || 'document.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '');

  const storagePath = `${communityId}/${Date.now()}_${safeFilename}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) {
    console.error('[communityDocumentStorage.uploadVerificationDocument] Supabase Storage upload failed:', error);
    throw new Error(`Failed to upload verification document: ${error.message || error}`);
  }

  return storagePath;
}

/**
 * Generates a signed temporary URL for admin viewing/retrieval of a private verification document.
 *
 * @param {string} storagePath - Storage path within the bucket
 * @param {number} [ttlSeconds=900] - Signed URL lifetime in seconds (default 15 minutes)
 * @returns {Promise<string>} The signed URL
 */
async function getSignedDocumentUrl(storagePath, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
  if (!storagePath) {
    throw new Error('storagePath is required to generate a signed URL');
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    console.error('[communityDocumentStorage.getSignedDocumentUrl] Failed to create signed URL:', error);
    throw new Error(`Failed to generate signed document URL: ${error?.message || 'Unknown error'}`);
  }

  return data.signedUrl;
}

module.exports = {
  BUCKET_NAME,
  uploadVerificationDocument,
  getSignedDocumentUrl,
};
