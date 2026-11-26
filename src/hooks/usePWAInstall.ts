import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

export type PWAPlatformKind =
  | 'ios'
  | 'macos_safari'
  | 'android'
  | 'desktop_chromium'
  | 'other';

declare global {
  interface Window {
    __opDeferredInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function detectPWAPlatform(userAgent?: string, maxTouchPoints?: number): PWAPlatformKind {
  const ua =
    typeof userAgent === 'string'
      ? userAgent
      : typeof navigator !== 'undefined'
        ? navigator.userAgent || ''
        : '';
  const touchPts =
    typeof maxTouchPoints === 'number'
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
        ? navigator.maxTouchPoints || 0
        : 0;

  if (/iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && touchPts > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  if (/Macintosh|Mac OS X/i.test(ua) && /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox/i.test(ua)) {
    return 'macos_safari';
  }
  if (/Chrome|Edg|OPR|Brave/i.test(ua) && !/Firefox/i.test(ua)) {
    return 'desktop_chromium';
  }
  return 'other';
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches === true ||
    nav.standalone === true
  );
}

// Capture beforeinstallprompt early at module evaluation time so we never miss it on fast loads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.__opDeferredInstallPrompt = e as BeforeInstallPromptEvent;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window !== 'undefined' ? window.__opDeferredInstallPrompt ?? null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningStandalone());
  const [platform] = useState<PWAPlatformKind>(() => detectPWAPlatform());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEv = e as BeforeInstallPromptEvent;
      window.__opDeferredInstallPrompt = promptEv;
      setDeferredPrompt(promptEv);
    };

    const handleAppInstalled = () => {
      window.__opDeferredInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    const mql = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      if (isRunningStandalone()) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    mql?.addEventListener?.('change', handleDisplayModeChange);

    if (window.__opDeferredInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__opDeferredInstallPrompt);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEv = deferredPrompt || (typeof window !== 'undefined' ? window.__opDeferredInstallPrompt : null);
    if (!promptEv) return 'unavailable';
    try {
      await promptEv.prompt();
      const { outcome } = await promptEv.userChoice;
      if (outcome === 'accepted') {
        window.__opDeferredInstallPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
      }
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isNativeInstallReady: Boolean(deferredPrompt),
    isInstalled,
    platform,
    promptInstall,
  };
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
