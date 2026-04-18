const { uploadImage, deleteImage } = require('./config/cloudinary');

/**
 * Test Cloudinary upload with a sample image URL
 * Run this with: node backend/testCloudinary.js
 */
async function testCloudinaryUpload() {
  try {
    console.log('🧪 Testing Cloudinary Upload...\n');

    // Test with a sample image URL
    const sampleImageUrl = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400';
    
    console.log('📤 Uploading sample image to Cloudinary...');
    const uploadResult = await uploadImage(sampleImageUrl, {
      folder: 'snoospace/test'
    });

    console.log('✅ Upload successful!');
    console.log('📋 Upload details:');
    console.log(`   URL: ${uploadResult.url}`);
    console.log(`   Public ID: ${uploadResult.public_id}`);
    console.log(`   Size: ${uploadResult.width}x${uploadResult.height}`);
    console.log(`   Format: ${uploadResult.format}\n`);

    console.log('🗑️  Testing image deletion...');
    const deleteResult = await deleteImage(uploadResult.public_id);
    
    if (deleteResult.result === 'ok') {
      console.log('✅ Delete successful!\n');
    } else {
      console.log('⚠️  Delete result:', deleteResult);
    }

    console.log('🎉 All tests passed! Cloudinary is configured correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Make sure you have:');
    console.error('   1. Created a Cloudinary account');
    console.error('   2. Added CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your .env file');
    console.error('   3. Restarted the backend server\n');
    process.exit(1);
  }
}

// Run the test
testCloudinaryUpload();
