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
  Sparkles,
  Loader2,
  Phone,
  Laptop,
  Smartphone,
  Tablet,
  Clock,
  LogIn,
  LogOut,
  Wifi,
  WifiOff,
  Pencil,
  ChevronDown,
  ChevronUp,
  History,
  X,
} from 'lucide-react';
import {
  adminCreateManagedUser,
  adminUpdateManagedUser,
  adminDeleteManagedUser,
  adminUpsertApiKey,
  adminDeleteApiKey,
  fetchUserAttendanceSessions,
  getCurrentUserIdToken,
  requestPasswordReset,
  setOrLinkAccountPassword,
  type AttendanceSessionRecord,
  type CloudApiKeyRecord,
  type UserPresenceRecord,
} from '../firebase';
import {
  FIREBASE_PROJECT_ID,
  MANAGED_ROLE_OPTIONS,
  SUPER_ADMIN_EMAIL,
  validateNewUserInput,
  generateStrongTempPassword,
  formatFirebaseAuthError,
  type ManagedAppUser,
  type ManagedUserRole,
} from '../utils/authAccess';
import { ADMIN_DISTINCTION_BADGES, type TeamStatRecord } from '../utils/gamification';
import { getUserInitials } from '../utils/avatarResize';
import {
  WORK_SCHEDULE_LABEL,
  formatDateTimeShort,
  formatWorkedDuration,
  parseWorkDisconnectEvent,
  splitFirstAndLastName,
} from '../utils/attendance';
import { BadgeArtwork } from './BadgeArtwork';
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
  teamStats?: TeamStatRecord[];
  userPresences?: UserPresenceRecord[];
  cloudApiKeys?: CloudApiKeyRecord[];
  villesOptions: string[];
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
}

export const AdminUsersPanel: React.FC<AdminUsersPanelProps> = ({
  adminUid,
  adminEmail,
  adminHasPasswordProvider,
  users,
  teamStats = [],
  userPresences = [],
  cloudApiKeys = [],
  villesOptions,
  onNotify,
}) => {
  // Formulaire de création d'utilisateur
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phonePro, setPhonePro] = useState('');
  const [password, setPassword] = useState(() => generateStrongTempPassword(12));
  const [showPwd, setShowPwd] = useState(true);
  const [role, setRole] = useState<ManagedUserRole>('commercial');
  const [selectedInitialRoleBadges, setSelectedInitialRoleBadges] = useState<string[]>([]);
  const [zone, setZone] = useState(villesOptions[0] || 'Meknès');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreatedCreds, setLastCreatedCreds] = useState<{
    displayName: string;
    email: string;
    password: string;
    role: ManagedUserRole;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Recherche, filtre rôle & actions sur la liste
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ManagedUserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<{
    displayName: string;
    phonePro: string;
    zone: string;
  }>({ displayName: '', phonePro: '', zone: '' });

  // Suivi présence, appareils et pointage heures de travail
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<
    'all' | 'online' | 'offline' | 'work_disconnect'
  >('all');
  const [expandedSessionsUid, setExpandedSessionsUid] = useState<string | null>(null);
  const [sessionsByUid, setSessionsByUid] = useState<Record<string, AttendanceSessionRecord[]>>({});
  const [loadingSessionsUid, setLoadingSessionsUid] = useState<string | null>(null);

  const roleDistinctionOptions = useMemo(
    () => ADMIN_DISTINCTION_BADGES.filter((b) => b.category === 'role'),
    []
  );

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
  const [proxyTestBusy, setProxyTestBusy] = useState<string | null>(null);
  const [proxyTestResult, setProxyTestResult] = useState<{
    ok: boolean;
    provider: string;
    message: string;
  } | null>(null);

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

  const presenceByUid = useMemo(() => {
    const map = new Map<string, UserPresenceRecord>();
    userPresences.forEach((p) => map.set(p.uid, p));
    return map;
  }, [userPresences]);

  const statByUid = useMemo(() => {
    const map = new Map<string, TeamStatRecord>();
    teamStats.forEach((s) => map.set(s.uid, s));
    return map;
  }, [teamStats]);

  // Liste consolidée (Super-Admin + tous les utilisateurs gérés + présences connues) pour le suivi complet
  const consolidatedTeamTracking = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      uid: string;
      displayName: string;
      firstName: string;
      lastName: string;
      email: string;
      phonePro: string;
      avatarDataUrl: string;
      role: TeamStatRecord['role'];
      zone: string;
      active: boolean;
      isOnline: boolean;
      currentDevice: string;
      devicesUsed: string[];
      lastLoginAt: string;
      lastLogoutAt: string;
      lastSeenAt: string;
      lastWorkDisconnectAt: string;
      workHoursDisconnectCount: number;
      workHoursDisconnectTimes: string[];
      todayWorkedSeconds: number;
      totalWorkedSeconds: number;
      isSuperAdminRow: boolean;
    }> = [];

    const buildRow = (params: {
      uid: string;
      fallbackName: string;
      fallbackEmail: string;
      fallbackRole: TeamStatRecord['role'];
      fallbackZone: string;
      active: boolean;
      isSuperAdminRow: boolean;
    }) => {
      const pres = presenceByUid.get(params.uid);
      const stat = statByUid.get(params.uid);
      const effectiveName = pres?.displayName || stat?.displayName || params.fallbackName || 'Collaborateur';
      const split = splitFirstAndLastName(effectiveName);
      const firstName = pres?.firstName || split.firstName;
      const lastName = pres?.lastName || split.lastName;
      return {
        uid: params.uid,
        displayName: effectiveName,
        firstName,
        lastName,
        email: pres?.email || params.fallbackEmail,
        phonePro: pres?.phonePro || '',
        avatarDataUrl: pres?.avatarDataUrl || stat?.avatarDataUrl || '',
        role: pres?.role || stat?.role || params.fallbackRole,
        zone: pres?.zone || stat?.zone || params.fallbackZone,
        active: params.active,
        isOnline: Boolean(pres?.isOnline),
        currentDevice: pres?.currentDevice || '',
        devicesUsed: pres?.devicesUsed || [],
        lastLoginAt: pres?.lastLoginAt || '',
        lastLogoutAt: pres?.lastLogoutAt || '',
        lastSeenAt: pres?.lastSeenAt || '',
        lastWorkDisconnectAt: pres?.lastWorkDisconnectAt || '',
        workHoursDisconnectCount: pres?.workHoursDisconnectCount || 0,
        workHoursDisconnectTimes: pres?.workHoursDisconnectTimes || [],
        todayWorkedSeconds: pres?.todayWorkedSeconds || 0,
        totalWorkedSeconds: pres?.totalWorkedSeconds || 0,
        isSuperAdminRow: params.isSuperAdminRow,
      };
    };

    // Toujours inclure le Super-Admin en tête
    seen.add(adminUid);
    rows.push(
      buildRow({
        uid: adminUid,
        fallbackName: 'Administrateur Principal',
        fallbackEmail: adminEmail,
        fallbackRole: 'super_admin',
        fallbackZone: 'Meknès',
        active: true,
        isSuperAdminRow: true,
      })
    );

    users.forEach((u) => {
      if (seen.has(u.uid)) return;
      seen.add(u.uid);
      rows.push(
        buildRow({
          uid: u.uid,
          fallbackName: u.displayName,
          fallbackEmail: u.email,
          fallbackRole: u.role,
          fallbackZone: u.zone,
          active: u.active,
          isSuperAdminRow: false,
        })
      );
    });

    // Compléter avec d'éventuelles présences orphelines
    userPresences.forEach((p) => {
      if (seen.has(p.uid)) return;
      seen.add(p.uid);
      rows.push(
        buildRow({
          uid: p.uid,
          fallbackName: p.displayName,
          fallbackEmail: p.email,
          fallbackRole: p.role,
          fallbackZone: p.zone,
          active: true,
          isSuperAdminRow: false,
        })
      );
    });

    return rows;
  }, [adminUid, adminEmail, users, presenceByUid, statByUid, userPresences]);

  const attendanceSummary = useMemo(() => {
    const onlineCount = consolidatedTeamTracking.filter((r) => r.isOnline).length;
    const totalTodaySec = consolidatedTeamTracking.reduce((s, r) => s + r.todayWorkedSeconds, 0);
    const totalWorkDisconnects = consolidatedTeamTracking.reduce(
      (s, r) => s + r.workHoursDisconnectCount,
      0
    );
    return {
      totalMembers: consolidatedTeamTracking.length,
      onlineCount,
      totalTodaySec,
      totalWorkDisconnects,
    };
  }, [consolidatedTeamTracking]);

  const filteredTrackingRows = useMemo(() => {
    const q = attendanceSearch.trim().toLowerCase();
    return consolidatedTeamTracking.filter((r) => {
      if (attendanceFilter === 'online' && !r.isOnline) return false;
      if (attendanceFilter === 'offline' && r.isOnline) return false;
      if (attendanceFilter === 'work_disconnect' && r.workHoursDisconnectCount === 0) return false;
      if (!q) return true;
      return (
        r.displayName.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phonePro.toLowerCase().includes(q) ||
        r.currentDevice.toLowerCase().includes(q) ||
        r.zone.toLowerCase().includes(q)
      );
    });
  }, [consolidatedTeamTracking, attendanceSearch, attendanceFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return sorted.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'suspended' && u.active) return false;
      if (!q) return true;
      const pres = presenceByUid.get(u.uid);
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.zone.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (pres?.phonePro || '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter, presenceByUid]);

  const toggleInitialRoleBadge = (badgeId: string) => {
    setSelectedInitialRoleBadges((prev) =>
      prev.includes(badgeId) ? prev.filter((id) => id !== badgeId) : [...prev, badgeId]
    );
  };

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
        phonePro: phonePro.trim(),
        initialManualBadges: selectedInitialRoleBadges,
      });
      setLastCreatedCreds({
        displayName: created.displayName,
        email: created.email,
        password,
        role: created.role,
      });
      setDisplayName('');
      setEmail('');
      setPhonePro('');
      setSelectedInitialRoleBadges([]);
      setPassword(generateStrongTempPassword(12));
      onNotify(
        `Utilisateur ${created.displayName} (${created.email}) créé avec un portefeuille initial vide. Email de vérification envoyé.`
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

  const startEditUserDetails = (u: ManagedAppUser) => {
    const pres = presenceByUid.get(u.uid);
    setEditingUserUid(u.uid);
    setEditUserForm({
      displayName: pres?.displayName || u.displayName,
      phonePro: pres?.phonePro || '',
      zone: pres?.zone || u.zone,
    });
  };

  const handleSaveUserDetails = async (u: ManagedAppUser) => {
    const cleanName = editUserForm.displayName.trim();
    if (cleanName.length < 2) {
      onNotify('Le nom complet doit contenir au moins 2 caractères.', 'warn');
      return;
    }
    setBusyUid(u.uid);
    try {
      await adminUpdateManagedUser(u.uid, {
        displayName: cleanName,
        role: u.role,
        zone: editUserForm.zone.trim(),
        active: u.active,
        phonePro: editUserForm.phonePro.trim(),
        email: u.email,
      });
      setEditingUserUid(null);
      onNotify(`Fiche utilisateur mise à jour pour ${cleanName}.`);
    } catch {
      onNotify('Impossible de mettre à jour les coordonnées utilisateur.', 'err');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleUserSessions = async (uid: string) => {
    if (expandedSessionsUid === uid) {
      setExpandedSessionsUid(null);
      return;
    }
    setExpandedSessionsUid(uid);
    setLoadingSessionsUid(uid);
    try {
      const list = await fetchUserAttendanceSessions(uid);
      setSessionsByUid((prev) => ({ ...prev, [uid]: list }));
    } catch {
      onNotify('Impossible de charger l’historique de pointage pour cet utilisateur.', 'err');
    } finally {
      setLoadingSessionsUid(null);
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

  const handleTestSecureProxy = async (providerId: string) => {
    setProxyTestBusy(providerId);
    setProxyTestResult(null);
    try {
      const idToken = await getCurrentUserIdToken();
      const res = await fetch('/api/ai/groq-secure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          provider: providerId,
          prompt:
            'Réponds en une phrase courte en français : confirme que la connexion sécurisée Orange Pro B2B fonctionne.',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        model?: string;
        error?: string;
      };
      if (!res.ok) {
        const errMsg = data.error || `Erreur serveur HTTP ${res.status}.`;
        setProxyTestResult({ ok: false, provider: providerId, message: errMsg });
        onNotify(errMsg, 'err');
        return;
      }
      const okMsg = `${data.reply || 'Réponse reçue'} (${data.model || providerId})`;
      setProxyTestResult({ ok: true, provider: providerId, message: okMsg });
      onNotify(`Proxy serveur sécurisé (${providerId}) opérationnel.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau lors du test du proxy.';
      setProxyTestResult({ ok: false, provider: providerId, message: msg });
      onNotify(msg, 'err');
    } finally {
      setProxyTestBusy(null);
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
                <label htmlFor="admin-new-phone" className="block text-xs font-semibold text-stone-700">
                  Téléphone professionnel (optionnel)
                </label>
                <input
                  id="admin-new-phone"
                  type="tel"
                  value={phonePro}
                  onChange={(e) => setPhonePro(e.target.value)}
                  placeholder="06 61 00 00 00"
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

              {/* Sélecteur visuel de rôle CRM */}
              <div className="space-y-1.5" data-testid="admin-create-role-selector">
                <label className="block text-xs font-semibold text-stone-700">
                  Sélecteur de rôle CRM
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MANAGED_ROLE_OPTIONS.map((opt) => {
                    const active = role === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRole(opt.value)}
                        aria-pressed={active}
                        className={`rounded-xl border p-2.5 text-left transition-all ${
                          active
                            ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500/30'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <RoleBadge role={opt.value} showShort />
                          {active && <Check className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-snug text-stone-600">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Badges de rôle initiaux optionnels */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-stone-700">
                  Badges de responsabilités initiaux (optionnel)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {roleDistinctionOptions.map((badge) => {
                    const picked = selectedInitialRoleBadges.includes(badge.id);
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => toggleInitialRoleBadge(badge.id)}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 ${
                          picked
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                            : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <BadgeArtwork
                          badgeId={badge.id}
                          iconKey={badge.iconKey}
                          rarity={badge.rarity}
                          size="xs"
                        />
                        <span>{badge.title.replace(/^Rôle\s*:\s*/i, '')}</span>
                        {picked && <Check className="w-3 h-3 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="admin-new-zone" className="block text-xs font-semibold text-stone-700">
                  Zone / Ville principale
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

              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
                Tout nouveau compte démarre automatiquement avec un <strong>portefeuille initial vide (0 fiche)</strong> isolé sur Cloud Firestore.
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold">Identifiants créés</span>
                    <RoleBadge role={lastCreatedCreds.role} showShort />
                  </div>
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
                  Portefeuille initial vide (0 fiche) prêt. Un email de vérification a été envoyé ; l&apos;utilisateur doit le valider avant sa première connexion.
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
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                aria-label="Filtrer par rôle"
                data-testid="admin-directory-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | ManagedUserRole)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-800 focus:outline-none focus:border-orange-600"
              >
                <option value="all">Tous les rôles</option>
                {MANAGED_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrer par statut"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
                className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-800 focus:outline-none focus:border-orange-600"
              >
                <option value="all">Tous statuts</option>
                <option value="active">Actifs</option>
                <option value="suspended">Suspendus</option>
              </select>
              <div className="relative flex-1 sm:w-52">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, email, zone..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
                />
              </div>
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
                const pres = presenceByUid.get(u.uid);
                const stat = statByUid.get(u.uid);
                const avatar = pres?.avatarDataUrl || stat?.avatarDataUrl || '';
                const initials = getUserInitials(u.displayName, u.email);
                const isEditing = editingUserUid === u.uid;
                return (
                  <div
                    key={u.uid}
                    className={`rounded-xl border p-3 space-y-2 text-xs ${
                      u.active ? 'border-stone-200 bg-white' : 'border-red-200 bg-red-50/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={u.displayName}
                              className="w-9 h-9 rounded-full object-cover border border-stone-200"
                            />
                          ) : (
                            <span className="w-9 h-9 rounded-full bg-stone-900 text-white text-xs font-bold flex items-center justify-center">
                              {initials}
                            </span>
                          )}
                          <span
                            title={pres?.isOnline ? 'En ligne' : 'Hors ligne'}
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              pres?.isOnline ? 'bg-emerald-500' : 'bg-stone-300'
                            }`}
                          />
                        </div>
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
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-stone-600">
                            <span className="break-all">{u.email}</span>
                            {pres?.phonePro && (
                              <span className="inline-flex items-center gap-1 font-medium text-stone-800 tabular-nums">
                                <Phone className="w-3 h-3 text-orange-600" />
                                {pres.phonePro}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={u.role}
                          disabled={isBusy}
                          aria-label={`Rôle de ${u.displayName}`}
                          onChange={(e) => void handleRoleChange(u, e.target.value as ManagedUserRole)}
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] font-medium text-stone-800"
                        >
                          {MANAGED_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => (isEditing ? setEditingUserUid(null) : startEditUserDetails(u))}
                          title="Modifier nom, téléphone et zone"
                          className="px-2 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-[11px] font-medium flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Éditer
                        </button>

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

                    {isEditing && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                            Nom &amp; Prénom
                          </label>
                          <input
                            type="text"
                            value={editUserForm.displayName}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, displayName: e.target.value }))
                            }
                            className="w-full px-2 py-1 rounded border border-stone-300 bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                            Téléphone
                          </label>
                          <input
                            type="tel"
                            value={editUserForm.phonePro}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, phonePro: e.target.value }))
                            }
                            placeholder="06 61 ..."
                            className="w-full px-2 py-1 rounded border border-stone-300 bg-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-stone-600 mb-0.5">
                            Zone / Ville
                          </label>
                          <input
                            type="text"
                            value={editUserForm.zone}
                            onChange={(e) =>
                              setEditUserForm((prev) => ({ ...prev, zone: e.target.value }))
                            }
                            className="w-full px-2 py-1 rounded border border-stone-300 bg-white text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSaveUserDetails(u)}
                            className="flex-1 py-1 px-2.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold"
                          >
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUserUid(null)}
                            aria-label="Fermer l'édition"
                            className="p-1 rounded border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Suivi Équipe, Profils complets, Appareils & Pointage Heures de Travail */}
      <div
        data-testid="admin-attendance-panel"
        className="bg-white rounded-xl border border-stone-200 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              Suivi Collaborateurs — Profils, Appareils &amp; Pointage Heures de Travail
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Vue réservée au Super-Admin : Nom &amp; Prénom, photo, téléphone, appareils utilisés, heure de connexion, heure de sortie, déconnexions pendant les heures de travail ({WORK_SCHEDULE_LABEL}) et heures travaillées.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer présence"
              value={attendanceFilter}
              onChange={(e) =>
                setAttendanceFilter(
                  e.target.value as 'all' | 'online' | 'offline' | 'work_disconnect'
                )
              }
              className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-800"
            >
              <option value="all">Tous les membres ({attendanceSummary.totalMembers})</option>
              <option value="online">En ligne ({attendanceSummary.onlineCount})</option>
              <option value="offline">
                Hors ligne ({attendanceSummary.totalMembers - attendanceSummary.onlineCount})
              </option>
              <option value="work_disconnect">Avec déconnexion heures travail</option>
            </select>
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                placeholder="Nom, prénom, tél, appareil..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>
        </div>

        {/* 4 KPI de présence */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="text-[11px] font-semibold text-stone-500">Membres suivis</div>
            <div className="text-lg font-extrabold text-stone-900 tabular-nums mt-0.5">
              {attendanceSummary.totalMembers}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="text-[11px] font-semibold text-emerald-800">En ligne maintenant</div>
            <div className="text-lg font-extrabold text-emerald-900 tabular-nums mt-0.5">
              {attendanceSummary.onlineCount}
            </div>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
            <div className="text-[11px] font-semibold text-orange-800">Heures travaillées (aujourd&apos;hui)</div>
            <div className="text-lg font-extrabold text-orange-950 tabular-nums mt-0.5">
              {formatWorkedDuration(attendanceSummary.totalTodaySec)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="text-[11px] font-semibold text-amber-900">Déconnexions heures travail</div>
            <div className="text-lg font-extrabold text-amber-950 tabular-nums mt-0.5">
              {attendanceSummary.totalWorkDisconnects}
            </div>
          </div>
        </div>

        {/* Cartes détaillées par collaborateur */}
        {filteredTrackingRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
            Aucun collaborateur ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrackingRows.map((member) => {
              const initials = getUserInitials(member.displayName, member.email);
              const isExpanded = expandedSessionsUid === member.uid;
              const sessions = sessionsByUid[member.uid] || [];
              const recentDisconnects = member.workHoursDisconnectTimes
                .slice(0, 3)
                .map((raw) => parseWorkDisconnectEvent(raw));

              return (
                <div
                  key={member.uid}
                  className="rounded-xl border border-stone-200 bg-stone-50/40 p-3.5 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Identité : Photo, Nom, Prénom, Rôle, Téléphone, Email */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {member.avatarDataUrl ? (
                          <img
                            src={member.avatarDataUrl}
                            alt={member.displayName}
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200 bg-white"
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-xl bg-stone-900 text-white text-sm font-bold flex items-center justify-center">
                            {initials}
                          </span>
                        )}
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white flex items-center justify-center ${
                            member.isOnline ? 'bg-emerald-500' : 'bg-stone-400'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-stone-900 text-sm">
                            {member.displayName}
                          </span>
                          <RoleBadge role={member.role} />
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              member.isOnline
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {member.isOnline ? (
                              <Wifi className="w-3 h-3" />
                            ) : (
                              <WifiOff className="w-3 h-3" />
                            )}
                            {member.isOnline ? 'En ligne' : 'Hors ligne'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-600">
                          <span>
                            Prénom : <strong className="text-stone-900">{member.firstName || '—'}</strong>
                          </span>
                          <span>
                            Nom : <strong className="text-stone-900">{member.lastName || '—'}</strong>
                          </span>
                          <span>
                            Zone : <strong className="text-stone-800">{member.zone || '—'}</strong>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-stone-700">
                            <Phone className="w-3 h-3 text-orange-600" />
                            Tél :{' '}
                            {member.phonePro ? (
                              <a
                                href={`tel:${member.phonePro}`}
                                className="font-bold text-stone-900 hover:text-orange-700 tabular-nums"
                              >
                                {member.phonePro}
                              </a>
                            ) : (
                              <span className="text-stone-400 italic">Non renseigné</span>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 text-stone-600 break-all">
                            <Mail className="w-3 h-3 text-stone-400" />
                            {member.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleUserSessions(member.uid)}
                      className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0"
                    >
                      <History className="w-3.5 h-3.5 text-orange-600" />
                      Historique pointage
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Grille Pointage & Appareils */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <div className="rounded-lg bg-white border border-stone-200 p-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                        <Laptop className="w-3 h-3 text-stone-600" />
                        Appareil(s) utilisé(s)
                      </div>
                      <div className="font-semibold text-stone-900 text-[11px] truncate" title={member.currentDevice}>
                        {member.currentDevice || 'Aucune session enregistrée'}
                      </div>
                      {member.devicesUsed.length > 1 && (
                        <div className="text-[10px] text-stone-500">
                          +{member.devicesUsed.length - 1} autre{member.devicesUsed.length > 2 ? 's' : ''} :{' '}
                          {member.devicesUsed.slice(1, 3).join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-stone-200 p-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                        <LogIn className="w-3 h-3 text-emerald-600" />
                        Heure de connexion (logue)
                      </div>
                      <div className="font-bold text-stone-900 tabular-nums">
                        {formatDateTimeShort(member.lastLoginAt)}
                      </div>
                      <div className="text-[10px] text-stone-500 tabular-nums">
                        Dernière activité : {formatDateTimeShort(member.lastSeenAt)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-white border border-stone-200 p-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                        <LogOut className="w-3 h-3 text-stone-600" />
                        Heure de sortie
                      </div>
                      <div className="font-bold text-stone-900 tabular-nums">
                        {member.isOnline ? 'En session active' : formatDateTimeShort(member.lastLogoutAt)}
                      </div>
                      {member.isOnline && member.lastLogoutAt && (
                        <div className="text-[10px] text-stone-500 tabular-nums">
                          Sortie préc. : {formatDateTimeShort(member.lastLogoutAt)}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-stone-200 p-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                        <AlertTriangle
                          className={`w-3 h-3 ${
                            member.workHoursDisconnectCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        />
                        Déconnexions heures travail
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-extrabold tabular-nums ${
                            member.workHoursDisconnectCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {member.workHoursDisconnectCount}
                        </span>
                        {member.lastWorkDisconnectAt && (
                          <span className="text-[10px] text-stone-600 tabular-nums">
                            (dern. {formatDateTimeShort(member.lastWorkDisconnectAt)})
                          </span>
                        )}
                      </div>
                      {recentDisconnects.length > 0 && (
                        <div className="text-[10px] text-amber-800 space-y-0.5">
                          {recentDisconnects.map((ev, idx) => (
                            <div key={idx} className="truncate tabular-nums">
                              • {ev.dateTimeLabel} — {ev.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-white border border-stone-200 p-2.5 space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-orange-600" />
                        Heures travaillées
                      </div>
                      <div className="font-extrabold text-orange-700 tabular-nums">
                        Aujourd&apos;hui : {formatWorkedDuration(member.todayWorkedSeconds)}
                      </div>
                      <div className="text-[10px] text-stone-600 tabular-nums">
                        Total cumulé : {formatWorkedDuration(member.totalWorkedSeconds)}
                      </div>
                    </div>
                  </div>

                  {/* Historique détaillé des sessions à la demande */}
                  {isExpanded && (
                    <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-800">
                          Journal des connexions, sorties &amp; temps travaillé ({sessions.length})
                        </span>
                        {loadingSessionsUid === member.uid && (
                          <span className="text-[11px] text-stone-500 inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                          </span>
                        )}
                      </div>
                      {loadingSessionsUid !== member.uid && sessions.length === 0 ? (
                        <p className="text-[11px] text-stone-500">
                          Aucune session de pointage enregistrée pour le moment (se crée automatiquement à la connexion).
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-stone-200 text-stone-500">
                                <th className="py-1.5 pr-3 font-semibold">Connexion</th>
                                <th className="py-1.5 pr-3 font-semibold">Sortie</th>
                                <th className="py-1.5 pr-3 font-semibold">Durée travaillée</th>
                                <th className="py-1.5 pr-3 font-semibold">Appareil</th>
                                <th className="py-1.5 font-semibold">Statut / Motif</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 tabular-nums">
                              {sessions.slice(0, 15).map((ses) => (
                                <tr key={ses.id}>
                                  <td className="py-1.5 pr-3 text-stone-900 font-medium">
                                    {formatDateTimeShort(ses.loginAt)}
                                  </td>
                                  <td className="py-1.5 pr-3 text-stone-700">
                                    {ses.logoutAt ? formatDateTimeShort(ses.logoutAt) : 'En cours'}
                                  </td>
                                  <td className="py-1.5 pr-3 font-semibold text-stone-900">
                                    {formatWorkedDuration(ses.workedSeconds)}
                                  </td>
                                  <td className="py-1.5 pr-3 text-stone-700">
                                    <span className="inline-flex items-center gap-1">
                                      {ses.deviceType === 'mobile' ? (
                                        <Smartphone className="w-3 h-3 text-stone-500" />
                                      ) : ses.deviceType === 'tablet' ? (
                                        <Tablet className="w-3 h-3 text-stone-500" />
                                      ) : (
                                        <Laptop className="w-3 h-3 text-stone-500" />
                                      )}
                                      {ses.deviceLabel}
                                    </span>
                                  </td>
                                  <td className="py-1.5">
                                    {ses.status === 'active' ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                        Session active
                                      </span>
                                    ) : ses.disconnectedDuringWorkHours ? (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                                        Déco. heures travail ({ses.disconnectReason || 'Sortie'})
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-semibold text-[10px]">
                                        {ses.disconnectReason || 'Session terminée'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                    {['groq', 'mistral', 'openrouter', 'openai', 'deepseek'].includes(item.provider) && (
                      <button
                        type="button"
                        disabled={proxyTestBusy !== null}
                        onClick={() => void handleTestSecureProxy(item.provider)}
                        title="Tester l'appel serveur sécurisé (/api/ai/groq-secure)"
                        className="px-2 py-1 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800 text-[11px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {proxyTestBusy === item.provider ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        Tester
                      </button>
                    )}
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

        {/* Test direct du proxy serveur sécurisé (/api/ai/groq-secure) */}
        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-stone-500">
            Endpoint serveur sécurisé (Admin SDK + vérification token Firebase) :{' '}
            <code className="font-mono font-semibold text-stone-800">POST /api/ai/groq-secure</code>
          </span>
          <button
            type="button"
            disabled={proxyTestBusy !== null}
            onClick={() =>
              void handleTestSecureProxy(
                ['groq', 'mistral', 'openrouter', 'openai', 'deepseek'].includes(apiProvider)
                  ? apiProvider
                  : 'groq'
              )
            }
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {proxyTestBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            )}
            Tester l’appel serveur sécurisé
          </button>
        </div>

        {proxyTestResult && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-xs ${
              proxyTestResult.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">
              [{proxyTestResult.provider}]
            </span>
            {proxyTestResult.message}
          </div>
        )}
      </div>
    </section>
  );
};
