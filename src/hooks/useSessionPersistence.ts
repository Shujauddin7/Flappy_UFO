'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Custom hook to handle session persistence in World App environment
 * Addresses the issue where users have to sign in repeatedly when app is reopened
 * Enhanced for dev environment with better logging and recovery
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
          walletAddress: session.user.walletAddress,
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          timestamp: new Date().toISOString()
        });

        // Additional dev environment debugging
        if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
          console.log('🔧 Dev session debugging:', {
            sessionStatus: status,
            hasSession: !!session,
            hasWallet: !!session?.user?.walletAddress,
            cookieAvailable: document.cookie.includes('next-auth.session-token'),
            userAgent: navigator.userAgent.includes('MiniApp') ? 'World App' : 'Other'
          });
        }
      } else {
        console.log('ℹ️ No active session found - user needs to sign in');
        console.log('🔍 Session debugging info:', {
          status,
          hasSession: !!session,
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV
        });
      }
    } else {
      console.log('⏳ Session loading...', {
        status,
        environment: process.env.NODE_ENV
      });
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
