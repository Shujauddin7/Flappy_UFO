"use client";

import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { resetCoins } from '@/utils/coins';
import { Suspense } from 'react';

interface ExtendedUser {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    username?: string;
    walletAddress?: string;
    wallet_address?: string;
}

function DevToolsContent() {
    const { data: session, status } = useSession();
    const searchParams = useSearchParams();

    // Show dev tools in development OR on dev deployment URLs OR with secret debug key
    const isLocalDev = process.env.NODE_ENV === 'development';
    const isDevDeployment = typeof window !== 'undefined' &&
        (window.location.hostname.includes('flappyufo-git-dev-shujauddin') ||
            window.location.hostname.includes('msshuj') ||
            window.location.href.includes('git-dev-shujauddin'));

    // Check for secret debug key access
    const debugKey = process.env.NEXT_PUBLIC_DEBUG_KEY;
    const debugParam = searchParams.get('debug');
    const hasValidDebugKey = debugKey && debugParam === debugKey;

    // Show if: (local dev OR dev deployment OR has valid debug key) AND show dev tools is enabled
    const showDevTools = (isLocalDev || isDevDeployment || hasValidDebugKey) &&
        process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS !== 'false';

    if (!showDevTools) {
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

            <div style={{ marginBottom: '8px', fontSize: '10px', color: '#aaa' }}>
                URL: {typeof window !== 'undefined' ? window.location.hostname : 'server'}
            </div>

            {session?.user ? (
                <>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>User:</strong> {session.user.username || session.user.name || 'Unknown'}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>User ID:</strong> {session.user.id?.slice(0, 8) || 'N/A'}...
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                        <strong>Wallet:</strong> {(() => {
                            const extendedUser = session.user as ExtendedUser;
                            const walletAddr = extendedUser?.walletAddress || extendedUser?.wallet_address;
                            if (!walletAddr) return 'N/A';
                            return `${walletAddr.slice(0, 6)}...${walletAddr.slice(-4)}`;
                        })()}
                    </div>
                    <button
                        onClick={() => {
                            resetCoins(); // Reset practice mode coins on signout
                            signOut();
                        }}
                        style={{
                            background: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            width: '100%',
                            marginBottom: '5px'
                        }}
                    >
                        🚪 Sign Out
                    </button>

                    <button
                        onClick={async () => {
                            const { supabase } = await import('@/lib/supabase');
                            try {
                                const { error } = await supabase
                                    .from('users')
                                    .upsert({
                                        wallet: '0x1234567890123456789012345678901234567890',
                                        username: 'test_user_' + Date.now()
                                    }, {
                                        onConflict: 'wallet'
                                    })
                                    .select();

                                if (error) {
                                    console.error('❌ Insert test failed:', error);
                                    alert('❌ Insert failed: ' + error.message);
                                } else {
                                    alert('✅ Test user created! Check Supabase table.');
                                }
                            } catch (err) {
                                console.error('❌ Insert test error:', err);
                                alert('❌ Insert error: ' + String(err));
                            }
                        }}
                        style={{
                            background: '#44ff44',
                            color: 'black',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            width: '100%',
                            marginBottom: '5px'
                        }}
                    >
                        🧪 Test Insert
                    </button>

                    <details style={{ fontSize: '10px', marginTop: '8px' }}>
                        <summary style={{ cursor: 'pointer', color: '#aaa' }}>🔍 Debug Session</summary>
                        <pre style={{
                            background: 'rgba(255,255,255,0.1)',
                            padding: '5px',
                            marginTop: '5px',
                            borderRadius: '3px',
                            fontSize: '9px',
                            overflow: 'auto',
                            maxHeight: '200px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {JSON.stringify(session, null, 2)}
                        </pre>
                    </details>
                </>
            ) : (
                <>
                    <div style={{ marginBottom: '8px' }}>❌ Not signed in</div>
                    <div style={{ fontSize: '10px', marginBottom: '5px', color: '#aaa' }}>
                        Status: {status}
                    </div>
                </>
            )}
        </div>
    );
}

export default function DevTools() {
    return (
        <Suspense fallback={null}>
            <DevToolsContent />
        </Suspense>
    );
}
