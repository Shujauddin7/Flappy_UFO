"use client";

import { useSession, signOut } from 'next-auth/react';

interface ExtendedUser {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    wallet_address?: string;
    world_id?: string;
}

export default function DevTools() {
    const { data: session, status } = useSession();

    // Only show when explicitly enabled via environment variable
    if (process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS !== 'true') {
        return null;
    }

    return (
        <div className="dev-tools" style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '12px',
            zIndex: 9999,
            border: '2px solid #ff4444',
            minWidth: '200px'
        }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
                🛠️ DEV TOOLS
            </div>

            <div style={{ marginBottom: '8px' }}>
                <strong>Status:</strong> {status}
            </div>

            {session?.user ? (
                <>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>User:</strong> {session.user.name || 'Unknown'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>World ID:</strong> {session.user.id?.slice(0, 8) || 'N/A'}...
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>Wallet:</strong> {(() => {
                            const walletAddr = (session.user as ExtendedUser)?.wallet_address;
                            if (!walletAddr) return 'N/A';
                            return `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
                        })()}
                    </div>
                    <button
                        onClick={() => signOut()}
                        style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            width: '100%'
                        }}
                    >
                        🚪 Sign Out
                    </button>
                </>
            ) : (
                <div>❌ Not signed in</div>
            )}
        </div>
    );
}
