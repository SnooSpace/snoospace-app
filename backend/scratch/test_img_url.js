const { detectFace } = require('../services/faceDetectionService');

async function test() {
  const urls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Pierre-Emile_Menuet_by_Nadar_crop.jpg/800px-Pierre-Emile_Menuet_by_Nadar_crop.jpg',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
  ];

  for (const u of urls) {
    try {
      const res = await detectFace(u);
      console.log('URL:', u);
      console.log('Detection:', res.faceEligible, res.embedding?.length);
    } catch (e) {
      console.log('URL:', u, 'Error:', e.message);
    }
  }
}

test();
