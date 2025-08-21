'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Custom hook to handle session persistence in World App environment
 * Addresses the issue where users have to sign in repeatedly when app is reopened
 */
export const useSessionPersistence = () => {
  const { data: session, status } = useSession();
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    // Wait for NextAuth to finish loading the session
    if (status !== 'loading') {
      setIsSessionReady(true);
      
      if (session?.user?.walletAddress) {
        console.log('✅ Session restored successfully for wallet:', session.user.walletAddress);
        console.log('📝 Session details:', {
          username: session.user.username,
          walletAddress: session.user.walletAddress
        });
      } else {
        console.log('ℹ️ No active session found - user needs to sign in');
      }
    }
  }, [session, status]);

  return {
    session,
    status,
    isSessionReady,
    isSignedIn: !!session?.user?.walletAddress,
    walletAddress: session?.user?.walletAddress || null,
    username: session?.user?.username || null,
  };
};
