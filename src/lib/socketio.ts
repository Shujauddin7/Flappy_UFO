/**
 * Socket.IO Client Utility for Realtime Tournament Updates
 * Follows LEADERBOARD.md specification exactly
 */

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// Get Socket.IO server URL based on environment
const getSocketUrl = (): string => {
    const env = process.env.NEXT_PUBLIC_ENV || 'dev';
    
    if (env === 'production') {
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
    if (socket && socket.connected) {
        console.log('✅ Socket.IO already connected');
        return socket;
    }

    const url = getSocketUrl();
    console.log(`🔌 Connecting to Socket.IO server: ${url}`);

    socket = io(url, {
        transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
    });

    return socket;
};

/**
 * Disconnect from Socket.IO server
 */
export const disconnectSocket = (): void => {
    if (socket) {
        console.log('🛑 Disconnecting from Socket.IO server');
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
        console.log(`�� Joining tournament room: tournament_${tournamentId}`);
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
        console.log(`👋 Leaving tournament room: tournament_${tournamentId}`);
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
