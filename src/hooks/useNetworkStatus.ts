import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Toast from 'react-native-toast-message';

/**
 * Monitors online/offline status using a lightweight Firebase Firestore
 * connectivity check combined with AppState.
 *
 * Shows a Toast when the app goes offline or comes back online.
 * Returns `isOnline` boolean for conditional UI rendering.
 */
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkConnectivity() {
      try {
        // Lightweight connectivity test: fetch a tiny public resource
        const res = await Promise.race([
          fetch('https://www.gstatic.com/generate_204', { method: 'HEAD' }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000),
          ),
        ]);
        if (!cancelled) {
          const online = (res as Response).status === 204 || (res as Response).ok;
          if (online && wasOfflineRef.current) {
            Toast.show({
              type: 'success',
              text1: 'Back Online',
              text2: 'Your connection has been restored.',
              position: 'top',
              visibilityTime: 2500,
            });
            wasOfflineRef.current = false;
          }
          setIsOnline(online);
        }
      } catch {
        if (!cancelled) {
          if (!wasOfflineRef.current) {
            Toast.show({
              type: 'error',
              text1: 'No Internet Connection',
              text2: 'Please check your network and try again.',
              position: 'top',
              visibilityTime: 4000,
            });
            wasOfflineRef.current = true;
          }
          setIsOnline(false);
        }
      }
    }

    checkConnectivity();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') { checkConnectivity(); }
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return isOnline;
}
