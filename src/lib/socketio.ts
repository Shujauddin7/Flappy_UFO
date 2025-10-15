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
    // If socket exists and is connected, return it
    if (socket && socket.connected) {
        return socket;
    }

    // If socket exists but disconnected, clean it up first
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }

    const url = getSocketUrl();
    
    socket = io(url, {
        transports: ['websocket', 'polling'], // WebSocket first, polling as fallback
        upgrade: true, // Allow transport upgrades
        rememberUpgrade: false, // ✅ DON'T remember upgrade - let it negotiate fresh each time
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        autoConnect: true,
    });

    let errorShown = false; // Only log first error, then suppress (fallback works)
    
    // Enhanced connection logging
    socket.on('connect', () => {
        const transport = socket?.io?.engine?.transport?.name;
        console.log('✅ Socket.IO connected:', {
            id: socket?.id,
            transport: transport,
            url: url,
            environment: process.env.NEXT_PUBLIC_ENV || 'unknown'
        });
        
        // ✅ Log if we successfully upgraded to WebSocket
        if (transport === 'websocket') {
            console.log('🚀 WebSocket connection established (optimal performance)');
        } else if (transport === 'polling') {
            console.log('📡 Using polling transport (WebSocket upgrade may happen)');
        }
        
        errorShown = false; // Reset error flag on successful connection
    });

    // ✅ Listen for transport upgrades
    socket.io.engine.on('upgrade', (transport) => {
        console.log('⬆️ Transport upgraded to:', transport.name);
    });

    socket.on('connect_error', (error) => {
        // Only log first error to avoid console spam (polling fallback handles connection)
        if (!errorShown && error.message === 'websocket error') {
            console.warn('⚠️ Initial WebSocket handshake failed, using polling (will attempt upgrade after connection)');
            errorShown = true;
        } else if (!errorShown) {
            console.error('❌ Socket.IO connection error:', {
                message: error.message,
                transport: socket?.io?.engine?.transport?.name || 'attempting',
                note: 'Polling fallback will be used automatically'
            });
            errorShown = true;
        }
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
