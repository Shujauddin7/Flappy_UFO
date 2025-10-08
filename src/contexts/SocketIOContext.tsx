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
            setIsConnected(true);
        };

        const handleDisconnect = (reason: string) => {
            console.log('🔌 [GLOBAL] Socket.IO disconnected:', reason);
            setIsConnected(false);
        };

        socketInstance.on('connect', handleConnect);
        socketInstance.on('disconnect', handleDisconnect);

        // Set initial state
        if (socketInstance.connected) {
            setIsConnected(true);
        }

        // Cleanup on app unmount (rarely happens in SPA)
        return () => {
            console.log('🛑 [GLOBAL] Cleaning up Socket.IO connection');
            socketInstance.off('connect', handleConnect);
            socketInstance.off('disconnect', handleDisconnect);
            disconnectSocket();
        };
    }, []);

    const joinTournamentRoom = useCallback((tournamentId: string, userId?: string, username?: string) => {
        if (socket && isConnected) {
            joinTournament(tournamentId, userId, username);
        } else {
            console.warn('⚠️ Cannot join tournament: Socket not connected yet');
        }
    }, [socket, isConnected]);

    return (
        <SocketIOContext.Provider value={{ socket, isConnected, joinTournamentRoom }}>
            {children}
        </SocketIOContext.Provider>
    );
}
