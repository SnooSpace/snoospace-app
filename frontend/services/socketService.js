import { io } from 'socket.io-client';
import { BACKEND_BASE_URL } from '../api/client';
import { getActiveAccount } from '../api/auth';

let socket = null;

/**
 * Get the socket singleton instance, initializing it if necessary.
 */
export const getSocket = () => {
  if (!socket) {
    console.log("[SocketService] Initializing socket connection to:", BACKEND_BASE_URL);
    socket = io(BACKEND_BASE_URL, {
      autoConnect: false,
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[SocketService] Socket connected successfully:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketService] Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[SocketService] Socket connection error:', error.message);
    });
  }
  return socket;
};

/**
 * Connect the socket and register the user's ID to join their personal room.
 * @param {string|number} [userId] - Optional active user's ID
 */
export const connectSocket = async (userId) => {
  try {
    const s = getSocket();
    if (!s.connected) {
      s.connect();
    }
    
    let id = userId;
    if (!id) {
      const activeAccount = await getActiveAccount();
      id = activeAccount?.id;
    }

    if (id) {
      console.log(`[SocketService] Emitting register_user for ID: ${id}`);
      s.emit('register_user', id);
    } else {
      console.log("[SocketService] No active account found to register.");
    }
  } catch (err) {
    console.error("[SocketService] Error during connectSocket:", err);
  }
};

/**
 * Disconnect and release the socket client.
 */
export const disconnectSocket = () => {
  if (socket) {
    console.log('[SocketService] Disconnecting socket.');
    socket.disconnect();
    socket = null;
  }
};
