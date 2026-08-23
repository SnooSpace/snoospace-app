/**
 * Spotify Integration Unit Tests
 * Tests token encryption, service methods, and sync transformers.
 * Run with: node tests/spotify.test.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const { encrypt, decrypt, getEncryptionKey } = require('../utils/spotifyTokenCrypto');
const spotifyService = require('../services/spotifyService');
const { mapArtistItem, mapTrackItem } = require('../services/spotifySync');

async function runTests() {
  console.log('🧪 Starting Spotify Integration Unit Tests...\n');
  let passed = 0;
  let total = 0;

  function it(description, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${description}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // ─── 1. Crypto Tests ────────────────────────────────────────────────────────
  console.log('--- 1. Token Encryption & Decryption (AES-256-GCM) ---');

  it('Derives a valid 32-byte key from TOKEN_ENCRYPTION_KEY', () => {
    const key = getEncryptionKey();
    assert.strictEqual(key.length, 32, 'Key buffer must be 32 bytes');
  });

  it('Encrypts and decrypts access tokens losslessly', () => {
    const sampleToken = 'BQB_sample_spotify_access_token_1234567890_abcdef';
    const encrypted = encrypt(sampleToken);
    
    assert.notStrictEqual(encrypted, sampleToken, 'Encrypted output must not match plaintext');
    const parts = encrypted.split(':');
    assert.strictEqual(parts.length, 3, 'Must be in iv:authTag:ciphertext format');
    assert.strictEqual(parts[0].length, 24, '12-byte IV must be 24 hex characters');
    assert.strictEqual(parts[1].length, 32, '16-byte Auth Tag must be 32 hex characters');

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, sampleToken, 'Decrypted text must match original plaintext');
  });

  it('Encrypts and decrypts refresh tokens losslessly', () => {
    const sampleRefreshToken = 'AQD_sample_spotify_refresh_token_9876543210_zyxwvu';
    const encrypted = encrypt(sampleRefreshToken);
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, sampleRefreshToken);
  });

  it('Fails decryption when ciphertext is tampered with', () => {
    const original = 'secret_token_data';
    const encrypted = encrypt(original);
    const parts = encrypted.split(':');
    // Tamper with ciphertext by altering last char
    const tamperedCipher = parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    assert.throws(() => {
      decrypt(tamperedPayload);
    }, /Unsupported state or unable to authenticate data|bad auth tag/i);
  });

  it('Fails decryption when auth tag is tampered with', () => {
    const original = 'secret_token_data';
    const encrypted = encrypt(original);
    const parts = encrypted.split(':');
    // Invert auth tag
    const tamperedTag = parts[1].replace(/./g, 'f');
    const tamperedPayload = `${parts[0]}:${tamperedTag}:${parts[2]}`;

    assert.throws(() => {
      decrypt(tamperedPayload);
    }, /Unsupported state or unable to authenticate data|bad auth tag/i);
  });

  // ─── 2. Spotify Service Tests ───────────────────────────────────────────────
  console.log('\n--- 2. Spotify Service ---');

  it('Generates valid authorize URL with client_id, state, and scopes', () => {
    const state = 'test_signed_state_nonce_123';
    const authUrl = spotifyService.getAuthorizeUrl(state);

    assert.ok(authUrl.startsWith('https://accounts.spotify.com/authorize'), 'Must target Spotify accounts endpoint');
    assert.ok(authUrl.includes(`client_id=${process.env.SPOTIFY_CLIENT_ID}`), 'Must contain configured SPOTIFY_CLIENT_ID');
    assert.ok(authUrl.includes('response_type=code'), 'Must specify code response type');
    assert.ok(authUrl.includes(`state=${state}`), 'Must contain state parameter');
    assert.ok(authUrl.includes('user-top-read'), 'Must include user-top-read scope');
  });

  // ─── 3. Data Mapping Tests ──────────────────────────────────────────────────
  console.log('\n--- 3. Data Transformers (Top Artists & Tracks) ---');

  it('Maps Spotify artist payload to clean schema with rank and genres', () => {
    const rawArtist = {
      id: '4Z8W4fKeB5YxbusRsdQVPb',
      name: 'Radiohead',
      images: [
        { url: 'https://i.scdn.co/image/large.jpg', height: 640, width: 640 },
        { url: 'https://i.scdn.co/image/medium.jpg', height: 300, width: 300 },
      ],
      external_urls: { spotify: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb' },
      genres: ['art rock', 'alternative rock', 'indie rock', 'experimental'],
      popularity: 82,
    };

    const mapped = mapArtistItem(rawArtist, 0);

    assert.strictEqual(mapped.id, '4Z8W4fKeB5YxbusRsdQVPb');
    assert.strictEqual(mapped.name, 'Radiohead');
    assert.strictEqual(mapped.image_url, 'https://i.scdn.co/image/medium.jpg');
    assert.strictEqual(mapped.spotify_url, 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb');
    assert.strictEqual(mapped.rank, 1);
    assert.deepStrictEqual(mapped.genres, ['art rock', 'alternative rock', 'indie rock']); // capped at 3
    assert.strictEqual(mapped.popularity, 82);
  });

  it('Maps Spotify track payload to clean schema with artists and rank', () => {
    const rawTrack = {
      id: '503OTo2dSrau7g567TyEg7',
      name: 'Karma Police',
      artists: [{ name: 'Radiohead' }],
      album: {
        images: [
          { url: 'https://i.scdn.co/image/album_large.jpg' },
          { url: 'https://i.scdn.co/image/album_med.jpg' },
        ],
      },
      external_urls: { spotify: 'https://open.spotify.com/track/503OTo2dSrau7g567TyEg7' },
      preview_url: 'https://p.scdn.co/mp3-preview/sample.mp3',
    };

    const mapped = mapTrackItem(rawTrack, 2);

    assert.strictEqual(mapped.id, '503OTo2dSrau7g567TyEg7');
    assert.strictEqual(mapped.name, 'Karma Police');
    assert.strictEqual(mapped.artist_name, 'Radiohead');
    assert.strictEqual(mapped.image_url, 'https://i.scdn.co/image/album_med.jpg');
    assert.strictEqual(mapped.spotify_url, 'https://open.spotify.com/track/503OTo2dSrau7g567TyEg7');
    assert.strictEqual(mapped.rank, 3);
    assert.strictEqual(mapped.preview_url, 'https://p.scdn.co/mp3-preview/sample.mp3');
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
