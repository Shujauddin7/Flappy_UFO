'use client';
import { walletAuth } from '@/auth/wallet';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useCallback, useState } from 'react';

interface SignInAuthButtonProps {
  onSuccess?: () => void;
}

/**
 * Custom AuthButton for sign-in modal with success callback
 */
export const SignInAuthButton = ({ onSuccess }: SignInAuthButtonProps) => {
  const [isPending, setIsPending] = useState(false);
  const { isInstalled } = useMiniKit();

  const onClick = useCallback(async () => {
    if (!isInstalled || isPending) {
      return;
    }
    setIsPending(true);
    try {
      await walletAuth();
      // Auth successful, trigger callback
      onSuccess?.();
    } catch (error) {
      console.error('Wallet authentication button error', error);
      setIsPending(false);
      return;
    }

    setIsPending(false);
  }, [isInstalled, isPending, onSuccess]);

  return (
    <LiveFeedback
      label={{
        failed: 'Failed to sign in',
        pending: 'Signing in...',
        success: 'Signed in successfully',
      }}
      state={isPending ? 'pending' : undefined}
    >
      <Button
        onClick={onClick}
        disabled={isPending}
        size="lg"
        variant="primary"
      >
        Sign In with World App
      </Button>
    </LiveFeedback>
  );
};
