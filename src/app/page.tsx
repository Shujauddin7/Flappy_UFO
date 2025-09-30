import GameHomepage from '@/components/GameHomepage';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Home() {
  return (
    <ErrorBoundary>
      <GameHomepage />
    </ErrorBoundary>
  );
}
