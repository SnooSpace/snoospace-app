/**
 * Starts an ngrok tunnel forwarding to port 5000 using the official @ngrok/ngrok SDK.
 * Run with: node scripts/start_tunnel.js
 */

const ngrok = require('@ngrok/ngrok');

async function start() {
  const port = process.env.PORT || 5000;
  const authtoken = process.env.NGROK_AUTHTOKEN || '3IK36LmQY2FooX66LpbSWkKPyw6_5VeC4CrotDJrhS7VdhSyX';

  try {
    console.log(`[ngrok] Establishing tunnel to http://localhost:${port}...`);
    
    const listener = await ngrok.forward({
      addr: port,
      authtoken: authtoken,
    });

    const url = listener.url();
    const callbackUri = `${url}/api/auth/spotify/callback`;

    console.log('\n' + '='.repeat(60));
    console.log('🚀 NGROK TUNNEL ACTIVE');
    console.log(`   Forwarding URL:       ${url}`);
    console.log(`   Spotify Redirect URI: ${callbackUri}`);
    console.log('='.repeat(60) + '\n');
    console.log('Keep this process running while testing Spotify OAuth on your device.');
    console.log('Press Ctrl+C to terminate the tunnel.\n');

    process.stdin.resume();
  } catch (err) {
    console.error('[ngrok] Failed to start tunnel:', err.message || err);
    process.exit(1);
  }
}

start();
