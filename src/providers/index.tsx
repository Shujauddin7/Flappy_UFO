'use client';
import { GlobalAssetPreloader } from '@/components/GlobalAssetPreloader';
import { SocketIOProvider } from '@/contexts/SocketIOContext';
import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

// Global data preloader to prevent leaderboard blur
const preloadLeaderboardData = async () => {
  if (typeof window === 'undefined') return;

  try {
    const [tournamentRes, leaderboardRes] = await Promise.all([
      fetch('/api/tournament/stats', { cache: 'no-store' }),
      fetch('/api/tournament/leaderboard-data', { cache: 'no-store' })
    ]);

    if (tournamentRes.ok && leaderboardRes.ok) {
      const [tournamentData, leaderboardData] = await Promise.all([
        tournamentRes.json(),
        leaderboardRes.json()
      ]);

      // Store in sessionStorage for instant leaderboard access
      sessionStorage.setItem('tournament_data', JSON.stringify({
        data: tournamentData,
        timestamp: Date.now()
      }));

      sessionStorage.setItem('leaderboard_data', JSON.stringify({
        data: leaderboardData,
        timestamp: Date.now()
      }));

      }
  } catch {
    }
};

// Component for app-level data preloading
function AppDataPreloader({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Preload leaderboard data on app startup
    preloadLeaderboardData();

    // Set up interval to refresh data every 30 seconds for real-time feel
    const interval = setInterval(preloadLeaderboardData, 30000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}

const ErudaProvider = dynamic(
  () => import('@/providers/Eruda').then((c) => c.ErudaProvider),
  { ssr: false },
);

// Define props for ClientProviders
interface ClientProvidersProps {
  children: ReactNode;
  session: Session | null; // Use the appropriate type for session from next-auth
}

/**
 * ClientProvider wraps the app with essential context providers.
 *
 * - ErudaProvider:
 *     - Should be used only in development.
 *     - Enables an in-browser console for logging and debugging.
 *
 * - MiniKitProvider:
 *     - Required for MiniKit functionality.
 *
 * This component ensures both providers are available to all child components.
 */
export default function ClientProviders({
  children,
  session,
}: ClientProvidersProps) {
  return (
    <ErudaProvider>
      <MiniKitProvider>
        <SessionProvider
          session={session}
          refetchInterval={0} // Disable automatic refetching to prevent infinite loops
          refetchOnWindowFocus={false} // Don't refetch when user returns to page
          refetchWhenOffline={false} // Don't refetch when coming back online
          // Enhanced session options for proper session restoration
          basePath="/api/auth"
        >
          <SocketIOProvider>
            <AppDataPreloader>
              <GlobalAssetPreloader>
                {children}
              </GlobalAssetPreloader>
            </AppDataPreloader>
          </SocketIOProvider>
        </SessionProvider>
      </MiniKitProvider>
    </ErudaProvider>
  );
}
