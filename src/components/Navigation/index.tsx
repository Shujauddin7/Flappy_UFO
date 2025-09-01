'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Home, Trophy, InfoCircle } from 'iconoir-react';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * This component uses the UI Kit to navigate between pages
 * Bottom navigation is the most common navigation pattern in Mini Apps
 * We require mobile first design patterns for mini apps
 * Read More: https://docs.world.org/mini-apps/design/app-guidelines#mobile-first
 */

export const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState('home');

  // Update tab based on current route
  useEffect(() => {
    if (pathname === '/') {
      setValue('home');
    } else if (pathname === '/leaderboard') {
      setValue('leaderboard');
    }
  }, [pathname]);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);

    switch (newValue) {
      case 'home':
        router.push('/');
        break;
      case 'leaderboard':
        router.push('/leaderboard');
        break;
      case 'info':
        // TODO: Open info modal
        console.log('Info clicked - TODO: Open info modal');
        break;
      default:
        break;
    }
  };

  return (
    <Tabs value={value} onValueChange={handleValueChange}>
      <TabItem value="home" icon={<Home />} label="Home" />
      <TabItem value="leaderboard" icon={<Trophy />} label="Leaderboard" />
      <TabItem value="info" icon={<InfoCircle />} label="Info" />
    </Tabs>
  );
};
