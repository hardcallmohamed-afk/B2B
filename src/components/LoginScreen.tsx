import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  ArrowLeft,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import {
  signInWithEmail,
  signInWithGoogle,
  requestPasswordReset,
  resendVerificationEmail,
  reloadCurrentUser,
  signOutUser,
} from '../firebase';
import {
  FIREBASE_PROJECT_ID,
  formatFirebaseAuthError,
  type FormattedAuthError,
} from '../utils/authAccess';

interface LoginScreenProps {
  onSuccessNotify?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccessNotify }) => {
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<FormattedAuthError | null>(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseAuthConsoleUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;
  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

  const handleCopyDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // Clipboard blocked
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError({
        code: 'invalid_credentials',
        message: 'Veuillez saisir une adresse email professionnelle valide.',
      });
      return;
    }
    if (!password) {
      setAuthError({
        code: 'invalid_credentials',
        message: 'Veuillez saisir votre mot de passe.',
      });
      return;
    }

    setBusy(true);
    try {
      const user = await signInWithEmail(cleanEmail, password);
      onSuccessNotify?.(`Bienvenue ${user.displayName || user.email || ''}.`);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err, currentHostname));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setInfoMessage('');
    setBusy(true);
    try {
      const user = await signInWithGoogle();
      onSuccessNotify?.(`Connecté en tant que ${user.email || user.displayName || 'Google'}.`);
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err, currentHostname));
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError({
        code: 'invalid_credentials',
        message: 'Entrez votre adresse email pour recevoir le lien de réinitialisation.',
      });
      return;
    }

    setBusy(true);
    try {
      await requestPasswordReset(cleanEmail);
      setInfoMessage(
        `Un lien de réinitialisation a été envoyé à ${cleanEmail} (vérifiez également vos courriers indésirables).`
      );
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err, currentHostname));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="login-screen"
      className="min-h-screen bg-[#F6F5F2] text-stone-900 flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-md space-y-5">
        {/* Identité Orange Pro B2B */}
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-black text-xl flex items-center justify-center shadow-xs shrink-0">
            O
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-900 leading-tight">
              Orange Pro B2B — Espace Privé
            </h1>
            <p className="text-xs text-stone-500">
              CRM Prospection, Pipeline Kanban &amp; Studio Email IA
            </p>
          </div>
        </div>

        {/* Carte de connexion */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-5">
          {view === 'login' ? (
            <>
              <div>
                <h2 className="text-sm font-bold text-stone-900">Connexion au portefeuille</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Identifiez-vous avec votre email et mot de passe professionnels.
                </p>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-3.5" noValidate>
                <div className="space-y-1">
                  <label htmlFor="login-email" className="block text-xs font-semibold text-stone-700">
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@entreprise.ma"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-stone-700">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('reset');
                        setAuthError(null);
                        setInfoMessage('');
                      }}
                      className="text-xs font-medium text-orange-700 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  data-testid="login-submit-btn"
                  className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  {busy ? 'Connexion en cours...' : 'Se connecter'}
                </button>
              </form>

              <div className="relative flex items-center">
                <div className="flex-1 border-t border-stone-200" />
                <span className="px-3 text-[11px] font-medium text-stone-400">ou</span>
                <div className="flex-1 border-t border-stone-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleLogin}
                data-testid="login-google-btn"
                className="w-full py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <KeyRound className="w-4 h-4 text-orange-600" />
                Continuer avec Google (Admin / Comptes autorisés)
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setAuthError(null);
                    setInfoMessage('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour à la connexion
                </button>
                <h2 className="text-sm font-bold text-stone-900">Réinitialiser le mot de passe</h2>
                <p className="text-xs text-stone-500">
                  Saisissez votre email pour recevoir un lien sécurisé de réinitialisation Firebase.
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-3.5" noValidate>
                <div className="space-y-1">
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-stone-700">
                    Adresse email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@entreprise.ma"
                    className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-orange-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {busy ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>
            </>
          )}

          {/* Messages d'erreur / info */}
          {authError && (
            <div
              role="alert"
              data-testid="login-error-alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{authError.message}</p>
              </div>

              {authError.code === 'unauthorized_domain' && authError.domainToAuthorize && (
                <div className="rounded-lg bg-white border border-red-200 p-2.5 space-y-2 text-[11px] text-stone-700">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono font-bold text-stone-900 truncate">
                      {authError.domainToAuthorize}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyDomain(authError.domainToAuthorize!)}
                      className="px-2 py-1 rounded border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 font-semibold flex items-center gap-1 shrink-0"
                    >
                      {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedDomain ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                  <a
                    href={firebaseAuthConsoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                  >
                    Ouvrir Firebase Auth → Authorized domains
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {authError.code === 'provider_disabled' && (
                <div className="rounded-lg bg-white border border-red-200 p-2.5 text-[11px] text-stone-700 space-y-1">
                  <p>
                    Activez le fournisseur <strong>Email/Password</strong> dans Firebase Console pour utiliser le login mot de passe.
                  </p>
                  <a
                    href={firebaseProvidersUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                  >
                    Activer Email/Password dans Firebase Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <div className="pt-2 border-t border-stone-100 text-center">
            <p className="text-[11px] text-stone-500">
              Accès privé sans inscription publique. Les comptes sont créés exclusivement par l&apos;administrateur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AccessGateNoticeProps {
  mode: 'verify_email' | 'denied';
  email: string;
  reason?: string;
  onUserReloaded: () => Promise<void>;
}

export const AccessGateNotice: React.FC<AccessGateNoticeProps> = ({
  mode,
  email,
  reason,
  onUserReloaded,
}) => {
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleResend = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      await resendVerificationEmail();
      setStatusMsg('Email de vérification renvoyé. Consultez votre boîte de réception puis cliquez sur « J’ai vérifié ».');
    } catch {
      setStatusMsg('Impossible de renvoyer l’email pour le moment. Patientez quelques instants.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    setStatusMsg('');
    try {
      await reloadCurrentUser();
      await onUserReloaded();
    } catch {
      setStatusMsg('Vérification non encore confirmée. Cliquez sur le lien reçu par email puis réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOutUser();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'denied' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-stone-900">
              {mode === 'denied' ? 'Accès non autorisé' : 'Vérification de votre adresse email requise'}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5 break-all">{email}</p>
          </div>
        </div>

        <p className="text-xs text-stone-700 leading-relaxed">
          {mode === 'denied'
            ? reason ||
              "Votre compte n'est pas autorisé à accéder à cet espace CRM Orange Pro. Contactez l'administrateur."
            : 'Pour activer la synchronisation Cloud sécurisée et accéder au CRM, ouvrez le lien de vérification envoyé à votre adresse email.'}
        </p>

        {statusMsg && (
          <div className="rounded-lg bg-stone-50 border border-stone-200 p-2.5 text-xs text-stone-700">
            {statusMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {mode === 'verify_email' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleRefresh}
                className="flex-1 py-2 px-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                J&apos;ai vérifié — Continuer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleResend}
                className="py-2 px-3 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 text-xs font-semibold"
              >
                Renvoyer l&apos;email
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleSignOut}
            className="py-2 px-3 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
};
