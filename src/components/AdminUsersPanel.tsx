import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  ShieldCheck,
  Search,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Eye,
  EyeOff,
  Lock,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import {
  adminCreateManagedUser,
  adminUpdateManagedUser,
  adminDeleteManagedUser,
  adminUpsertApiKey,
  adminDeleteApiKey,
  requestPasswordReset,
  setOrLinkAccountPassword,
  type CloudApiKeyRecord,
} from '../firebase';
import {
  FIREBASE_PROJECT_ID,
  SUPER_ADMIN_EMAIL,
  validateNewUserInput,
  generateStrongTempPassword,
  formatFirebaseAuthError,
  type ManagedAppUser,
  type ManagedUserRole,
} from '../utils/authAccess';
import { RoleBadge } from './RoleBadge';

const CLOUD_API_PROVIDERS = [
  { id: 'groq', label: 'Groq (Llama / Mixtral)' },
  { id: 'mistral', label: 'Mistral AI' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic Claude' },
  { id: 'deepseek', label: 'DeepSeek' },
] as const;

function maskApiKey(raw: string): string {
  const s = raw.trim();
  if (s.length <= 8) return '••••••••';
  return `${s.slice(0, 5)}••••••${s.slice(-4)}`;
}

interface AdminUsersPanelProps {
  adminUid: string;
  adminEmail: string;
  adminHasPasswordProvider: boolean;
  users: ManagedAppUser[];
  cloudApiKeys?: CloudApiKeyRecord[];
  villesOptions: string[];
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
}

export const AdminUsersPanel: React.FC<AdminUsersPanelProps> = ({
  adminUid,
  adminEmail,
  adminHasPasswordProvider,
  users,
  cloudApiKeys = [],
  villesOptions,
  onNotify,
}) => {
  // Formulaire de création d'utilisateur
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generateStrongTempPassword(12));
  const [showPwd, setShowPwd] = useState(true);
  const [role, setRole] = useState<ManagedUserRole>('commercial');
  const [zone, setZone] = useState(villesOptions[0] || 'Meknès');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreatedCreds, setLastCreatedCreds] = useState<{
    displayName: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Recherche & actions sur la liste
  const [search, setSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);

  // Mot de passe du compte Super-Admin lui-même
  const [adminNewPwd, setAdminNewPwd] = useState('');
  const [adminPwdBusy, setAdminPwdBusy] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Coffre Cloud /api_keys/{provider} (Super-Admin uniquement)
  const [apiProvider, setApiProvider] = useState<string>('groq');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [revealedProviders, setRevealedProviders] = useState<Record<string, boolean>>({});

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'hardcallmohamed-afk.github.io';
  const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`;
  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

  const stats = useMemo(() => {
    const active = users.filter((u) => u.active).length;
    return {
      total: users.length,
      active,
      suspended: users.length - active,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (!q) return sorted;
    return sorted.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.zone.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setLastCreatedCreds(null);

    const validationErr = validateNewUserInput({ displayName, email, password });
    if (validationErr) {
      setCreateError(validationErr);
      return;
    }

    setCreating(true);
    try {
      const created = await adminCreateManagedUser({
        adminUid,
        displayName,
        email,
        password,
        role,
        zone,
      });
      setLastCreatedCreds({
        displayName: created.displayName,
        email: created.email,
        password,
      });
      setDisplayName('');
      setEmail('');
      setPassword(generateStrongTempPassword(12));
      onNotify(
        `Utilisateur ${created.displayName} (${created.email}) créé. Un email de vérification lui a été envoyé.`
      );
    } catch (err) {
      const formatted = formatFirebaseAuthError(err, currentHostname);
      setCreateError(formatted.message);
      onNotify(formatted.message, 'err');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!lastCreatedCreds) return;
    const text = `Accès CRM Orange Pro B2B\nNom : ${lastCreatedCreds.displayName}\nEmail : ${lastCreatedCreds.email}\nMot de passe temporaire : ${lastCreatedCreds.password}\n(Cliquez sur le lien de vérification reçu par email lors de la 1re connexion.)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      window.setTimeout(() => setCopiedCreds(false), 2500);
    } catch {
      onNotify('Copie manuelle requise.', 'warn');
    }
  };

  const handleToggleActive = async (u: ManagedAppUser) => {
    setBusyUid(u.uid);
    try {
      await adminUpdateManagedUser(u.uid, {
        displayName: u.displayName,
        role: u.role,
        zone: u.zone,
        active: !u.active,
      });
      onNotify(
        !u.active
          ? `Accès réactivé pour ${u.displayName}.`
          : `Accès suspendu immédiatement pour ${u.displayName}.`
      );
    } catch {
      onNotify('Impossible de modifier le statut de cet utilisateur.', 'err');
    } finally {
      setBusyUid(null);
    }
  };

  const handleRoleChange = async (u: ManagedAppUser, nextRole: ManagedUserRole) => {
    if (u.role === nextRole) return;
    setBusyUid(u.uid);
    try {
      await adminUpdateManagedUser(u.uid, {
        displayName: u.displayName,
        role: nextRole,
        zone: u.zone,
        active: u.active,
      });
      onNotify(`Rôle mis à jour pour ${u.displayName}.`);
    } catch {
      onNotify('Impossible de modifier le rôle.', 'err');
    } finally {
      setBusyUid(null);
    }
  };

  const handleSendReset = async (u: ManagedAppUser) => {
    setBusyUid(u.uid);
    try {
      await requestPasswordReset(u.email);
      onNotify(`Email de réinitialisation envoyé à ${u.email}.`);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err, currentHostname);
      onNotify(formatted.message, 'err');
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteUser = async (u: ManagedAppUser) => {
    setBusyUid(u.uid);
    try {
      await adminDeleteManagedUser(u.uid);
      setConfirmDeleteUid(null);
      onNotify(`Accès retiré pour ${u.displayName} (${u.email}).`);
    } catch {
      onNotify('Impossible de retirer cet utilisateur.', 'err');
    } finally {
      setBusyUid(null);
    }
  };

  const handleSaveAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPwd.length < 8) {
      onNotify('Votre mot de passe Admin doit contenir au moins 8 caractères.', 'warn');
      return;
    }
    setAdminPwdBusy(true);
    try {
      await setOrLinkAccountPassword(adminNewPwd);
      setAdminNewPwd('');
      onNotify(
        `Mot de passe Admin enregistré pour ${adminEmail}. Vous pouvez désormais vous connecter par Email + Mot de passe depuis n'importe quel domaine.`
      );
    } catch (err) {
      const formatted = formatFirebaseAuthError(err, currentHostname);
      onNotify(formatted.message, 'err');
    } finally {
      setAdminPwdBusy(false);
    }
  };

  const handleCopyDomain = async () => {
    try {
      await navigator.clipboard.writeText('hardcallmohamed-afk.github.io');
      setCopiedDomain(true);
      window.setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveCloudApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = apiKeyInput.trim();
    if (trimmedKey.length < 8) {
      onNotify('Saisissez une clé API valide (au moins 8 caractères).', 'warn');
      return;
    }
    const providerMeta = CLOUD_API_PROVIDERS.find((p) => p.id === apiProvider);
    setApiKeyBusy(true);
    try {
      await adminUpsertApiKey(adminUid, {
        provider: apiProvider,
        label: providerMeta?.label || apiProvider.toUpperCase(),
        key: trimmedKey,
        active: true,
      });
      setApiKeyInput('');
      onNotify(`Clé API "${providerMeta?.label || apiProvider}" sauvegardée dans Firestore (/api_keys/${apiProvider}).`);
    } catch {
      onNotify('Échec de sauvegarde de la clé API dans /api_keys (accès Super-Admin requis).', 'err');
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleDeleteCloudApiKey = async (provider: string) => {
    setApiKeyBusy(true);
    try {
      await adminDeleteApiKey(provider);
      onNotify(`Clé API "${provider}" supprimée de Firestore.`);
    } catch {
      onNotify('Impossible de supprimer cette clé API.', 'err');
    } finally {
      setApiKeyBusy(false);
    }
  };

  return (
    <section data-testid="admin-users-panel" className="space-y-4">
      {/* En-tête Super-Admin */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-600" />
            Administration des Utilisateurs &amp; Accès Privés
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Section strictement réservée au Super-Admin ({SUPER_ADMIN_EMAIL}). Vous seul pouvez créer, suspendre ou révoquer des comptes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
          <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 font-semibold">
            {stats.total} compte{stats.total > 1 ? 's' : ''}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold">
            {stats.active} actif{stats.active > 1 ? 's' : ''}
          </span>
          {stats.suspended > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-800 font-semibold">
              {stats.suspended} suspendu{stats.suspended > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Colonne gauche : Formulaire création utilisateur + Mot de passe Admin */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-orange-600" />
              Créer un nouvel utilisateur
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3" noValidate>
              <div className="space-y-1">
                <label htmlFor="admin-new-name" className="block text-xs font-semibold text-stone-700">
                  Nom complet
                </label>
                <input
                  id="admin-new-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex. Youssef Bennani"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="admin-new-email" className="block text-xs font-semibold text-stone-700">
                  Email de connexion
                </label>
                <input
                  id="admin-new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="commercial@orangepro.ma"
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="admin-new-pwd" className="block text-xs font-semibold text-stone-700">
                    Mot de passe temporaire
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateStrongTempPassword(12))}
                    className="text-[11px] font-semibold text-orange-700 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Générer
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="admin-new-pwd"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="w-full pl-3 pr-9 py-2 rounded-lg border border-stone-300 font-mono text-xs focus:outline-none focus:border-orange-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Masquer' : 'Afficher'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                  >
                    {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="admin-new-role" className="block text-xs font-semibold text-stone-700">
                    Rôle
                  </label>
                  <select
                    id="admin-new-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as ManagedUserRole)}
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-xs focus:outline-none focus:border-orange-600"
                  >
                    <option value="commercial">Commercial B2B</option>
                    <option value="manager">Superviseur</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="admin-new-zone" className="block text-xs font-semibold text-stone-700">
                    Zone / Ville
                  </label>
                  <input
                    id="admin-new-zone"
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    list="admin-zone-suggestions"
                    placeholder="Meknès"
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
                  />
                  <datalist id="admin-zone-suggestions">
                    {villesOptions.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>
              </div>

              {createError && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {creating ? 'Création du compte...' : 'Créer le compte utilisateur'}
              </button>
            </form>

            {lastCreatedCreds && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2 text-xs text-emerald-950">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">Identifiants créés (à transmettre)</span>
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="px-2 py-1 rounded bg-white border border-emerald-300 text-emerald-900 font-semibold flex items-center gap-1"
                  >
                    {copiedCreds ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCreds ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <div className="font-mono text-[11px] bg-white rounded-lg border border-emerald-200 p-2 space-y-0.5">
                  <div>Email : {lastCreatedCreds.email}</div>
                  <div>Mot de passe : {lastCreatedCreds.password}</div>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Un email de vérification a été envoyé automatiquement ; l&apos;utilisateur doit le valider pour activer la synchro Cloud.
                </p>
              </div>
            )}
          </div>

          {/* Mot de passe du compte Super-Admin */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-stone-700" />
              {adminHasPasswordProvider
                ? 'Modifier mon mot de passe Admin'
                : 'Définir un mot de passe pour mon compte Admin'}
            </h3>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Permet à <strong>{adminEmail}</strong> de se connecter par Email + Mot de passe sur mobile et GitHub Pages sans dépendre de la pop-up Google.
            </p>
            <form onSubmit={handleSaveAdminPassword} className="flex items-center gap-2">
              <input
                type="password"
                value={adminNewPwd}
                onChange={(e) => setAdminNewPwd(e.target.value)}
                placeholder="Nouveau mot de passe (8+ car.)"
                aria-label="Nouveau mot de passe Admin"
                className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
              <button
                type="submit"
                disabled={adminPwdBusy || adminNewPwd.length < 8}
                className="px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
              >
                {adminPwdBusy ? '...' : 'Enregistrer'}
              </button>
            </form>
          </div>

          {/* Aide rapide Firebase Console pour GitHub Pages */}
          <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 space-y-2 text-xs">
            <h3 className="font-bold text-stone-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              Configuration Firebase Auth (GitHub Pages)
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-stone-700">
              <li>
                Activez <strong>Email/Password</strong> dans{' '}
                <a
                  href={firebaseProvidersUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  Sign-in method <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Ajoutez{' '}
                <code className="font-mono font-semibold text-stone-900">hardcallmohamed-afk.github.io</code>{' '}
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-stone-300 text-[10px] font-semibold text-stone-800 hover:bg-stone-100"
                >
                  {copiedDomain ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedDomain ? 'Copié' : 'Copier'}
                </button>{' '}
                dans{' '}
                <a
                  href={firebaseAuthSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-orange-700 font-semibold hover:underline inline-flex items-center gap-0.5"
                >
                  Authorized domains <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ol>
          </div>
        </div>

        {/* Colonne droite : Répertoire des utilisateurs */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-stone-900">
              Comptes utilisateurs autorisés ({filteredUsers.length})
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom, email, zone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          {/* Carte Super-Admin verrouillée */}
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-bold text-stone-900 flex items-center gap-2 flex-wrap">
                <span>Administrateur Principal</span>
                <RoleBadge role="super_admin" />
              </div>
              <p className="text-[11px] text-stone-600">{SUPER_ADMIN_EMAIL} · Accès total &amp; création comptes</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700">Actif (verrouillé)</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
              {users.length === 0
                ? 'Aucun utilisateur supplémentaire créé pour le moment. Utilisez le formulaire à gauche pour créer un compte Commercial ou Superviseur.'
                : 'Aucun utilisateur ne correspond à votre recherche.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const isBusy = busyUid === u.uid;
                return (
                  <div
                    key={u.uid}
                    className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
                      u.active ? 'border-stone-200 bg-white' : 'border-red-200 bg-red-50/40'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900">{u.displayName}</span>
                        <RoleBadge role={u.role} />
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.active ? 'Actif' : 'Suspendu'}
                        </span>
                        {u.zone && (
                          <span className="text-[11px] text-stone-500">· {u.zone}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-600 break-all">{u.email}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        value={u.role}
                        disabled={isBusy}
                        aria-label={`Rôle de ${u.displayName}`}
                        onChange={(e) => void handleRoleChange(u, e.target.value as ManagedUserRole)}
                        className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] font-medium text-stone-800"
                      >
                        <option value="commercial">Commercial B2B</option>
                        <option value="manager">Superviseur</option>
                      </select>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleToggleActive(u)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 ${
                          u.active
                            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                            : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {u.active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {u.active ? 'Suspendre' : 'Réactiver'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSendReset(u)}
                        title="Envoyer un email de réinitialisation de mot de passe"
                        className="px-2 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-[11px] font-medium flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Reset MDP
                      </button>

                      {confirmDeleteUid === u.uid ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteUser(u)}
                            className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUid(null)}
                            className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] text-stone-600"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteUid(u.uid)}
                          aria-label={`Révoquer l'accès de ${u.displayName}`}
                          title="Révoquer et supprimer l'accès"
                          className="p-1.5 rounded-lg border border-stone-200 hover:border-red-300 hover:bg-red-50 text-stone-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coffre Clés API Cloud (/api_keys/{provider}) — Super-Admin uniquement */}
      <div
        data-testid="admin-api-keys-vault"
        className="bg-white rounded-xl border border-stone-200 p-4 space-y-3.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-orange-600" />
              Coffre Clés API Cloud (<code className="font-mono text-[11px] text-orange-700">/api_keys/&#123;provider&#125;</code>)
            </h3>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Protégé côté serveur par les règles Firestore (<code className="font-mono">isSuperAdmin()</code>). Seul votre compte Super-Admin peut lire ou modifier ces clés (Groq, Mistral, Gemini, etc.).
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[10px] font-bold text-orange-800">
            {cloudApiKeys.length} clé{cloudApiKeys.length > 1 ? 's' : ''} en coffre Cloud
          </span>
        </div>

        <form onSubmit={handleSaveCloudApiKey} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-3 space-y-1">
            <label htmlFor="vault-provider" className="block text-[11px] font-semibold text-stone-700">
              Fournisseur IA
            </label>
            <select
              id="vault-provider"
              value={apiProvider}
              onChange={(e) => setApiProvider(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium focus:outline-none focus:border-orange-600"
            >
              {CLOUD_API_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6 space-y-1">
            <label htmlFor="vault-apikey" className="block text-[11px] font-semibold text-stone-700">
              Clé API secrète (nouvelle ou mise à jour)
            </label>
            <div className="relative">
              <input
                id="vault-apikey"
                type={showApiKeyInput ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Ex. gsk_... ou AIza..."
                className="w-full pl-3 pr-9 py-2 rounded-lg border border-stone-300 font-mono text-xs focus:outline-none focus:border-orange-600"
              />
              <button
                type="button"
                onClick={() => setShowApiKeyInput((v) => !v)}
                aria-label={showApiKeyInput ? 'Masquer la clé' : 'Afficher la clé'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
              >
                {showApiKeyInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={apiKeyBusy || apiKeyInput.trim().length < 8}
              className="w-full py-2 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              {apiKeyBusy ? 'Enregistrement...' : 'Sauvegarder en Cloud'}
            </button>
          </div>
        </form>

        {cloudApiKeys.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {cloudApiKeys.map((item) => {
              const revealed = Boolean(revealedProviders[item.provider]);
              return (
                <div
                  key={item.provider}
                  className="rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900">{item.label}</span>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-600">
                        /api_keys/{item.provider}
                      </code>
                    </div>
                    <div className="font-mono text-[11px] text-stone-600 truncate mt-0.5">
                      {revealed ? item.key : maskApiKey(item.key)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedProviders((prev) => ({
                          ...prev,
                          [item.provider]: !prev[item.provider],
                        }))
                      }
                      title={revealed ? 'Masquer' : 'Afficher'}
                      className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-100 text-stone-600"
                    >
                      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      disabled={apiKeyBusy}
                      onClick={() => void handleDeleteCloudApiKey(item.provider)}
                      title="Supprimer cette clé"
                      className="p-1.5 rounded-lg border border-stone-200 bg-white hover:border-red-300 hover:bg-red-50 text-stone-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
