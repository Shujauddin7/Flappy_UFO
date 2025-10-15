/**
 * Socket.IO Client Utility for Realtime Tournament Updates
 * Follows LEADERBOARD.md specification exactly
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Get Socket.IO server URL based on environment
const getSocketUrl = (): string => {
    const vercelEnv = process.env.VERCEL_ENV;
    const isProduction = vercelEnv === 'production' || process.env.NEXT_PUBLIC_ENV === 'prod';

    if (isProduction) {
        return process.env.NEXT_PUBLIC_SOCKETIO_PROD_URL || 'https://flappy-ufo-socketio-server-production.up.railway.app';
    } else {
        return process.env.NEXT_PUBLIC_SOCKETIO_DEV_URL || 'https://flappy-ufo-socketio-server-dev.up.railway.app';
    }
};
/**
 * Connect to Socket.IO server
 * Returns the socket instance for event listening
 */
export const connectSocket = (): Socket => {
    // 🔍 If socket already exists (connected or not), return it - DON'T create new one
    if (socket) {
        console.log('🔄 Reusing existing socket instance:', {
            connected: socket.connected,
            id: socket.id || 'not connected yet'
        });
        return socket;
    }

    const url = getSocketUrl();

    console.log('🆕 Creating NEW Socket.IO instance for:', url);

    socket = io(url, {
        transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
        upgrade: true, // Allow transport upgrades
        rememberUpgrade: true, // Remember successful upgrade to websocket
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        autoConnect: true,
    });

    // Connection success logging
    socket.on('connect', () => {
        console.log('✅ Socket.IO connected:', {
            id: socket?.id,
            transport: socket?.io?.engine?.transport?.name,
        });
    });

    // Error logging - but only log ONCE per error type
    let errorLogged = false;
    socket.on('connect_error', (error) => {
        if (!errorLogged) {
            console.error('❌ Socket.IO connection error:', error.message);
            errorLogged = true;
        }
    });

    // Reset error flag on successful connection
    socket.on('connect', () => {
        errorLogged = false;
    });

    // Event listeners removed - console logs cleaned up
    socket.onAny(() => {
        // Intentionally empty - for future debugging if needed
    });

    socket.on('disconnect', () => {
        // Intentionally empty - for future debugging if needed
    });

    return socket;
};

/**
 * Disconnect from Socket.IO server
 */
export const disconnectSocket = (): void => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

/**
 * Join a tournament room to receive updates
 * Room format: tournament_{tournamentId} as per LEADERBOARD.md
 */
export const joinTournament = (tournamentId: string, userId?: string, username?: string): void => {
    if (socket && socket.connected) {
        socket.emit('join_tournament', {
            tournament_id: tournamentId,
            user_id: userId,
            username: username
        });
    } else {
        console.error('❌ Cannot join tournament: Socket not connected');
    }
};

/**
 * Leave a tournament room
 */
export const leaveTournament = (tournamentId: string): void => {
    if (socket && socket.connected) {
        socket.emit('leave_tournament', { tournamentId });
    }
};

/**
 * Get the current socket instance
 * Useful for direct access to socket events
 */
export const getSocket = (): Socket | null => {
    return socket;
};
