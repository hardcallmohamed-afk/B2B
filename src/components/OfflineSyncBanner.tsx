import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { subscribeFirestoreSnapshotsInSync } from '../firebase';

export const OfflineSyncBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const [justReconnected, setJustReconnected] = useState(false);
  const [cloudSyncedAfterReconnect, setCloudSyncedAfterReconnect] = useState(false);
  const wasOfflineRef = useRef<boolean>(!isOnline);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const handleOffline = () => {
      clearReconnectTimer();
      wasOfflineRef.current = true;
      setIsOnline(false);
      setJustReconnected(false);
      setCloudSyncedAfterReconnect(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setJustReconnected(true);
        setCloudSyncedAfterReconnect(false);
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          setJustReconnected(false);
          reconnectTimerRef.current = null;
        }, 4000);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const unsubInSync = subscribeFirestoreSnapshotsInSync(() => {
      setCloudSyncedAfterReconnect(true);
    });

    return () => {
      clearReconnectTimer();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      unsubInSync();
    };
  }, []);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="offline-sync-banner"
        className="w-full border-b border-amber-300 bg-amber-50 px-3 sm:px-5 py-2 text-xs text-amber-950 flex items-center justify-center gap-2"
      >
        <CloudOff className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="font-medium leading-snug">
          Mode hors-ligne terrain actif — vos modifications sont enregistrées localement et seront synchronisées automatiquement dès le retour du réseau.
        </span>
      </div>
    );
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="reconnected-sync-banner"
        className="w-full border-b border-emerald-300 bg-emerald-50 px-3 sm:px-5 py-2 text-xs text-emerald-950 flex items-center justify-center gap-2"
      >
        {cloudSyncedAfterReconnect ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
        )}
        <span className="font-semibold leading-snug">
          Connexion rétablie — synchronisation cloud active.
        </span>
      </div>
    );
  }

  return null;
};
