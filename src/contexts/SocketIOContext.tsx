'use client';

/**
 * Global Socket.IO Context - Phase 2 Implementation
 * Keeps Socket.IO connection and listeners active across ALL pages
 * This ensures real-time updates work even when user is not on leaderboard page
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { connectSocket, disconnectSocket, joinTournament } from '@/lib/socketio';
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
        console.log('🌐 [GLOBAL] Initializing Socket.IO connection...');

        // Connect to Socket.IO server (persists for entire app lifecycle)
        const socketInstance = connectSocket();
        setSocket(socketInstance);

        // Track connection state
        const handleConnect = () => {
            console.log('✅ [GLOBAL] Socket.IO connected!');
            console.log('   Transport:', socketInstance?.io?.engine?.transport?.name);
            setIsConnected(true);
        };

        const handleDisconnect = (reason: string) => {
            console.log('🔌 [GLOBAL] Socket.IO disconnected:', reason);
            setIsConnected(false);
        };

        const handleConnectError = (error: Error) => {
            console.error('❌ [GLOBAL] Socket.IO connection error:', error.message);
        };

        socketInstance.on('connect', handleConnect);
        socketInstance.on('disconnect', handleDisconnect);
        socketInstance.on('connect_error', handleConnectError);

        // IMPORTANT: Check if already connected (might connect before listeners added)
        if (socketInstance.connected) {
            console.log('✅ [GLOBAL] Socket already connected on init!');
            setIsConnected(true);
        } else {
            console.log('⏳ [GLOBAL] Waiting for socket to connect...');
        }

        // Cleanup on app unmount (rarely happens in SPA)
        return () => {
            console.log('🛑 [GLOBAL] Cleaning up Socket.IO connection');
            socketInstance.off('connect', handleConnect);
            socketInstance.off('disconnect', handleDisconnect);
            socketInstance.off('connect_error', handleConnectError);
            disconnectSocket();
        };
    }, []);

    const joinTournamentRoom = useCallback((tournamentId: string, userId?: string, username?: string) => {
        if (socket) {
            // Check actual socket connection, not just state
            if (socket.connected) {
                console.log('🎮 [GLOBAL] Joining tournament room:', tournamentId);
                joinTournament(tournamentId, userId, username);
            } else {
                console.warn('⚠️ [GLOBAL] Socket exists but not connected. Will join when connected.');
                // Try to join when it connects
                socket.once('connect', () => {
                    console.log('🎮 [GLOBAL] Socket connected! Joining tournament:', tournamentId);
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
