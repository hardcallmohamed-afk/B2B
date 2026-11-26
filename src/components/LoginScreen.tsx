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
  ShieldCheck,
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
import { DiversifiaLogo } from './DiversifiaLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onSuccessNotify?: (msg: string) => void;
}

const DIVERSIFIA_CAPABILITIES = [
  {
    num: '01',
    title: 'Forfaits Orange Pro & Illimité Pro',
    desc: 'Déploiement de flottes mobiles corporate, roaming pro et solutions voix/data.',
  },
  {
    num: '02',
    title: 'Business Box Fibre & Fixe VoIP',
    desc: 'Connectivité fibre dédiée très haut débit, standard cloud et liens multi-sites.',
  },
  {
    num: '03',
    title: 'Pipeline CRM & Suivi des Payouts',
    desc: 'Qualification B2B, pilotage Kanban par équipe et suivi transparent des commissions.',
  },
  {
    num: '04',
    title: 'Prospection & Studio Email IA',
    desc: 'Enrichissement multi-contacts, déduplication MDM et rédaction commerciale assistée.',
  },
];

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
      className="min-h-screen bg-[#FFF7EE] text-[#0B0A09] grid grid-cols-1 lg:grid-cols-12"
    >
      {/* Colonne Gauche : Univers de marque Diversifia — Distributeur Orange Pro */}
      <aside className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-[#0B0A09] text-white relative overflow-hidden flex-col justify-between p-10 xl:p-14">
        {/* Halo architectural orange Diversifia + grille subtile */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-25 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #F96614 0%, #ED5F10 40%, transparent 72%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-24 w-[420px] h-[420px] rounded-full opacity-15 blur-3xl"
          style={{
            background: 'radial-gradient(circle, #F68749 0%, transparent 70%)',
          }}
        />

        {/* En-tête logo Diversifia */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <DiversifiaLogo theme="dark" size="lg" showSubtitle />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 border border-stone-800 rounded-lg px-3 py-1.5">
            Portail B2B Maroc
          </span>
        </div>

        {/* Message central inspiré de diversifia.ma */}
        <div className="relative z-10 max-w-xl space-y-6 my-auto py-8">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#F96614]">
              16 ans d’expérience télécom B2B
            </p>
            <h1 className="text-3xl xl:text-[42px] font-extrabold tracking-tight leading-[1.12] text-white">
              Le Partenaire Orange{' '}
              <span className="text-[#F96614]">Par Excellence.</span>
            </h1>
            <p className="text-sm leading-relaxed text-stone-300">
              Diversifia vous accompagne dans le choix, le développement et la pérennité des
              solutions de télécommunications d’entreprise : mobilité, fibre dédiée et pilotage
              commercial Orange Pro.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {DIVERSIFIA_CAPABILITIES.map((cap) => (
              <div
                key={cap.num}
                className="rounded-xl border border-stone-800 bg-white/[0.03] p-3.5 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[#F96614]">
                    {cap.num}
                  </span>
                  <h2 className="text-xs font-bold text-white">{cap.title}</h2>
                </div>
                <p className="text-[11px] leading-relaxed text-stone-400">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pied de page sobre */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-stone-800/80 text-[11px] text-stone-400">
          <span>Diversifia SARL · Distributeur Agréé Orange Pro</span>
          <span className="inline-flex items-center gap-1.5 text-stone-300">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F96614]" />
            Accès réservé aux équipes autorisées
          </span>
        </div>
      </aside>

      {/* Colonne Droite : Formulaire de connexion épuré sur fond chaud #FFF7EE */}
      <main className="lg:col-span-6 xl:col-span-5 flex flex-col items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Logo mobile / tablette */}
          <div className="flex flex-col items-center text-center lg:hidden space-y-2">
            <DiversifiaLogo theme="light" size="md" showSubtitle />
            <p className="text-xs text-stone-600">
              Le Partenaire Orange Par Excellence · Espace CRM B2B
            </p>
          </div>

          {/* En-tête desktop au-dessus de la carte */}
          <div className="hidden lg:block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#ED5F10]">
              Espace Collaborateurs
            </span>
            <h2 className="text-xl font-extrabold text-[#0B0A09] tracking-tight mt-0.5">
              Accéder à votre portefeuille
            </h2>
          </div>

          {/* Carte de connexion */}
          <div className="bg-white rounded-2xl border border-[#E3E3E3] shadow-xs p-6 sm:p-7 space-y-5">
            {view === 'login' ? (
              <>
                <div>
                  <h3 className="text-sm font-bold text-[#0B0A09]">Connexion sécurisée</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Identifiez-vous avec votre email et mot de passe professionnels Diversifia.
                  </p>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-3.5" noValidate>
                  <div className="space-y-1">
                    <label htmlFor="login-email" className="block text-xs font-semibold text-stone-800">
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
                        placeholder="prenom.nom@diversifia.ma"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#F96614]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="login-password" className="block text-xs font-semibold text-stone-800">
                        Mot de passe
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setView('reset');
                          setAuthError(null);
                          setInfoMessage('');
                        }}
                        className="text-xs font-semibold text-[#ED5F10] hover:underline"
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
                        className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#F96614]"
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
                    className="w-full py-2.5 px-4 rounded-lg bg-[#F96614] hover:bg-[#ED5F10] disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs"
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
                  className="w-full py-2.5 px-4 rounded-lg border border-stone-300 bg-white hover:bg-[#FFF7EE] disabled:opacity-60 text-[#0B0A09] text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-[#F96614] shrink-0" />
                  <span>Continuer avec Google</span>
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
                  <h3 className="text-sm font-bold text-[#0B0A09]">Réinitialiser le mot de passe</h3>
                  <p className="text-xs text-stone-500">
                    Saisissez votre email pour recevoir un lien sécurisé de réinitialisation Firebase.
                  </p>
                </div>

                <form onSubmit={handlePasswordReset} className="space-y-3.5" noValidate>
                  <div className="space-y-1">
                    <label htmlFor="reset-email" className="block text-xs font-semibold text-stone-800">
                      Adresse email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom.nom@diversifia.ma"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:border-[#F96614]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0B0A09] hover:bg-stone-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
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
                      className="inline-flex items-center gap-1 font-semibold text-[#ED5F10] hover:underline"
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
                      className="inline-flex items-center gap-1 font-semibold text-[#ED5F10] hover:underline"
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

            <div className="pt-2.5 border-t border-stone-100 text-center">
              <p className="text-[11px] text-stone-500">
                Accès privé sans inscription publique. Les comptes sont créés exclusivement par l&apos;administrateur Diversifia.
              </p>
              <div className="pt-2">
                <PWAInstallButton variant="login" onInstalledNotify={onSuccessNotify} />
              </div>
            </div>
          </div>
        </div>
      </main>
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
    <div className="min-h-screen bg-[#FFF7EE] text-[#0B0A09] flex flex-col items-center justify-center p-4 gap-5">
      <DiversifiaLogo theme="light" size="md" showSubtitle />
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E3E3E3] shadow-xs p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'denied' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#0B0A09]">
              {mode === 'denied' ? 'Accès non autorisé' : 'Vérification de votre adresse email requise'}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5 break-all">{email}</p>
          </div>
        </div>

        <p className="text-xs text-stone-700 leading-relaxed">
          {mode === 'denied'
            ? reason ||
              "Votre compte n'est pas autorisé à accéder à cet espace CRM Diversifia Orange Pro. Contactez l'administrateur."
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
                className="flex-1 py-2 px-3 rounded-lg bg-[#F96614] hover:bg-[#ED5F10] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
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
