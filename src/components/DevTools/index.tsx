"use client";

import { useSession, signOut } from 'next-auth/react';

interface ExtendedUser {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    username?: string;
    walletAddress?: string;
    wallet_address?: string;
}

export default function DevTools() {
    const { data: session, status } = useSession();

    // Only show dev tools in development environment, never in production
    const isProduction = typeof window !== 'undefined' &&
        (window.location.hostname === 'flappyufo.vercel.app' ||
            window.location.hostname.includes('vercel.app') ||
            process.env.NODE_ENV === 'production');

    const showDevTools = !isProduction &&
        (process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true' ||
            (typeof window !== 'undefined' &&
                (window.location.hostname.includes('flappyufo-git-dev-shujauddin') ||
                    window.location.hostname.includes('msshuj') ||
                    window.location.href.includes('git-dev-shujauddin'))))

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
                        onClick={() => signOut()}
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
                            console.log('🔍 Testing user insert...');
                            try {
                                const testWallet = '0x1234567890123456789012345678901234567890';
                                const { data, error } = await supabase
                                    .from('users')
                                    .upsert({
                                        wallet: testWallet,
                                        username: 'test_user_' + Date.now()
                                    }, {
                                        onConflict: 'wallet'
                                    })
                                    .select();

                                if (error) {
                                    console.error('❌ Insert test failed:', error);
                                    alert('❌ Insert failed: ' + error.message);
                                } else {
                                    console.log('✅ Insert test successful:', data);
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
