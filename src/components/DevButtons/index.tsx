'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

export const DevButtons = () => {
  const { data: session } = useSession();
  const [testData, setTestData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // Only show in development environment
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false });
      setTestData(null);
      alert('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Error signing out');
    }
  };

  const handleTestUserData = async () => {
    if (!session?.user?.walletAddress) {
      alert('Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users?wallet=${session.user.walletAddress}`);
      const result = await response.json();
      
      if (response.ok) {
        setTestData(result.user);
        alert('User data loaded - check below!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      alert('Error fetching user data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '10px',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: '200px'
    }}>
      <div style={{ color: '#00F5FF', fontSize: '12px', fontWeight: 'bold' }}>
        DEV MODE
      </div>
      
      <button
        onClick={handleSignOut}
        disabled={!session}
        style={{
          background: session ? '#FF4444' : '#666',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: session ? 'pointer' : 'not-allowed',
          fontSize: '12px'
        }}
      >
        Sign Out
      </button>

      <button
        onClick={handleTestUserData}
        disabled={!session || loading}
        style={{
          background: session && !loading ? '#00F5FF' : '#666',
          color: session && !loading ? 'black' : 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: session && !loading ? 'pointer' : 'not-allowed',
          fontSize: '12px'
        }}
      >
        {loading ? 'Loading...' : 'User Test Data'}
      </button>

      {session && (
        <div style={{ color: '#00F5FF', fontSize: '10px', marginTop: '5px' }}>
          Status: Signed In
          <br />
          Wallet: {session.user.walletAddress?.slice(0, 6)}...{session.user.walletAddress?.slice(-4)}
        </div>
      )}

      {testData && (
        <div style={{
          background: 'rgba(0, 245, 255, 0.1)',
          padding: '8px',
          borderRadius: '4px',
          marginTop: '8px',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <div style={{ color: '#00F5FF', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
            Supabase User Data:
          </div>
          <pre style={{
            color: '#E5E7EB',
            fontSize: '9px',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {JSON.stringify(testData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
