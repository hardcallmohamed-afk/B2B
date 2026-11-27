import React, { useEffect, useRef, useState } from 'react';
import { Lock, ShieldCheck, LogOut, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import {
  reauthenticateCurrentUserWithGoogle,
  reauthenticateCurrentUserWithPassword,
  recordSecurityAuditLog,
} from '../firebase';
import type { IdleLockMinutes } from '../utils/securityHardening';

interface IdleLockOverlayProps {
  enabled: boolean;
  idleMinutes: IdleLockMinutes;
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  userRole: string;
  hasPasswordProvider: boolean;
  onSignOut: () => void;
  onNotify?: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
}

export const IdleLockOverlay: React.FC<IdleLockOverlayProps> = ({
  enabled,
  idleMinutes,
  userUid,
  userEmail,
  userDisplayName,
  userRole,
  hasPasswordProvider,
  onSignOut,
  onNotify,
}) => {
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottleRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !idleMinutes || idleMinutes <= 0) {
      setLocked(false);
      return;
    }

    lastActivityRef.current = Date.now();
    const timeoutMs = idleMinutes * 60 * 1000;

    const markActive = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < 1500) return;
      lastThrottleRef.current = now;
      if (!locked) {
        lastActivityRef.current = now;
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'pointerdown',
      'touchstart',
    ];
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));

    const intervalId = window.setInterval(() => {
      if (locked) return;
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        setLocked(true);
        setPassword('');
        setErrorMsg('');
      }
    }, 10_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      window.clearInterval(intervalId);
    };
  }, [enabled, idleMinutes, locked]);

  if (!enabled || !locked) return null;

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Saisissez votre mot de passe pour déverrouiller.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await reauthenticateCurrentUserWithPassword(password);
      lastActivityRef.current = Date.now();
      setLocked(false);
      setPassword('');
      void recordSecurityAuditLog({
        severity: 'info',
        category: 'session',
        action: 'idle_lock_unlocked',
        summary: `Session déverrouillée par mot de passe après inactivité (${idleMinutes} min).`,
        actorUid: userUid,
        actorName: userDisplayName,
        actorRole: userRole,
      });
      onNotify?.('Session déverrouillée en toute sécurité.', 'ok');
    } catch {
      setErrorMsg('Mot de passe incorrect ou session expirée. Réessayez ou reconnectez-vous.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockWithGoogle = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await reauthenticateCurrentUserWithGoogle();
      lastActivityRef.current = Date.now();
      setLocked(false);
      setPassword('');
      void recordSecurityAuditLog({
        severity: 'info',
        category: 'session',
        action: 'idle_lock_unlocked_google',
        summary: `Session déverrouillée via Google après inactivité (${idleMinutes} min).`,
        actorUid: userUid,
        actorName: userDisplayName,
        actorRole: userRole,
      });
      onNotify?.('Session déverrouillée via Google.', 'ok');
    } catch {
      setErrorMsg('Vérification Google annulée ou bloquée par le navigateur.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session verrouillée par sécurité"
      className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-xl flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900">Session verrouillée</h2>
            <p className="text-xs text-stone-500">
              Protection automatique après {idleMinutes} min d&apos;inactivité. Vos données CRM sont masquées.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5 text-xs">
          <p className="font-semibold text-stone-900 truncate">{userDisplayName}</p>
          <p className="text-stone-500 truncate">{userEmail}</p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {hasPasswordProvider && (
          <form onSubmit={(e) => void handleUnlockWithPassword(e)} className="space-y-3">
            <div>
              <label
                htmlFor="idle-lock-password"
                className="block text-xs font-semibold text-stone-700 mb-1"
              >
                Mot de passe du compte
              </label>
              <div className="relative">
                <input
                  id="idle-lock-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Saisissez votre mot de passe"
                  className="w-full px-3 py-2 pr-9 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Déverrouiller le CRM
            </button>
          </form>
        )}

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUnlockWithGoogle()}
            className="w-full py-2.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
            Déverrouiller avec Google
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLocked(false);
              onSignOut();
            }}
            className="w-full py-2 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion sécurisée
          </button>
        </div>
      </div>
    </div>
  );
};
