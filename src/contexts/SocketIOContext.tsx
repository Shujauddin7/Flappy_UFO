'use client';

/**
 * Global Socket.IO Context - Phase 2 Implementation
 * Keeps Socket.IO connection and listeners active across ALL pages
 * This ensures real-time updates work even when user is not on leaderboard page
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { connectSocket, joinTournament } from '@/lib/socketio';
import type { Socket } from 'socket.io-client';

interface SocketIOContextValue {
    socket: Socket | null;
    isConnected: boolean;
    joinTournamentRoom: (tournamentId: string, userId?: string, username?: string) => void;
}

const SocketIOContext = createContext<SocketIOContextValue>({
    socket: null,
    isConnected: false,
    joinTournamentRoom: () => { },
});

export const useSocketIO = () => useContext(SocketIOContext);

export function SocketIOProvider({ children }: { children: React.ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Connect to Socket.IO server (persists for entire app lifecycle)
        const socketInstance = connectSocket();
        setSocket(socketInstance);

        // Track connection state
        const handleConnect = () => {
            setIsConnected(true);
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        // ✅ Don't add connect_error listener here - it's already handled in socketio.ts
        // This prevents duplicate error logging (especially visible in Eruda on mobile)

        socketInstance.on('connect', handleConnect);
        socketInstance.on('disconnect', handleDisconnect);
        // ❌ Removed: socketInstance.on('connect_error', handleConnectError);

        // IMPORTANT: Check if already connected (might connect before listeners added)
        if (socketInstance.connected) {
            setIsConnected(true);
        } else {
        }

        // Cleanup on app unmount (rarely happens in SPA)
        return () => {
            socketInstance.off('connect', handleConnect);
            socketInstance.off('disconnect', handleDisconnect);
            // ✅ DON'T call disconnectSocket() here - socket should persist!
            // The socket is a singleton that should stay alive for the entire app lifecycle
            // Only disconnect when user actually closes the browser tab
        };
    }, []);

    const joinTournamentRoom = useCallback((tournamentId: string, userId?: string, username?: string) => {
        console.log('🎮 [DEBUG] joinTournamentRoom called with:', { tournamentId, userId, username });

        if (socket) {
            // Check actual socket connection, not just state
            if (socket.connected) {
                joinTournament(tournamentId, userId, username);
            } else {
                // Try to join when it connects
                socket.once('connect', () => {
                    joinTournament(tournamentId, userId, username);
                });
            }
        } else {
            console.error('❌ [GLOBAL] No socket instance available');
        }
    }, [socket]);

    return (
        <SocketIOContext.Provider value={{ socket, isConnected, joinTournamentRoom }}>
            {children}
        </SocketIOContext.Provider>
    );
}
