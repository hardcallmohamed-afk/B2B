// Pure RBAC, Super-Admin identity, and Firebase Auth error formatting helpers.

export const SUPER_ADMIN_EMAIL = 'hardcallmohamed@gmail.com';
export const FIREBASE_PROJECT_ID = 'gen-lang-client-0884936685';

export type ManagedUserRole = 'commercial' | 'grand_compte' | 'team_lead' | 'manager';

export interface RoleCapabilities {
  role: ManagedUserRole | 'super_admin';
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  unlockedPerks: string[];
  restrictedToSuperAdmin: readonly [
    'Gestion des Utilisateurs & Rôles',
    'Coffre Clés API Cloud (/api_keys)',
    'Carte GPS Temps Réel (3s) & Radar Collaborateurs',
  ];
  canManageOwnPortfolio: boolean;
  canUseAiEmailStudio: boolean;
  canUseCommissionCalculator: boolean;
  canBatchAudit8Workers: boolean;
  canPrioritizeGrandCompte: boolean;
  canUseDeepCrawlerL2: boolean;
  canUseMdmDeduplication: boolean;
  canViewSquadLeaderboard: boolean;
  canSuperviseTeamPayouts: boolean;
  canAwardTeamDistinctions: boolean;
  canExportFullBackupJson: boolean;
  // 3 accès strictement verrouillés au Super-Admin (jamais accordés aux autres rôles)
  canManageUsers: boolean;
  canAccessApiKeysVault: boolean;
  canAccessLiveGpsMap: boolean;
}

export const SUPER_ADMIN_EXCLUSIVE_FEATURES = [
  'Gestion des Utilisateurs & Rôles',
  'Coffre Clés API Cloud (/api_keys)',
  'Carte GPS Temps Réel (3s) & Radar Collaborateurs',
] as const;

export const MANAGED_ROLE_OPTIONS: ReadonlyArray<{
  value: ManagedUserRole;
  label: string;
  shortLabel: string;
  description: string;
  perks: ReadonlyArray<string>;
}> = [
  {
    value: 'commercial',
    label: 'Commercial B2B',
    shortLabel: 'Commercial',
    description: 'Prospection terrain, qualification & signatures TPE/PME',
    perks: [
      'Portefeuille CRM personnel & Pipeline Kanban',
      'Calculateur de commission DIVERSIFIA & Studio Email IA',
      'Suivi de ses contrats signés & 50 badges de progression',
    ],
  },
  {
    value: 'grand_compte',
    label: 'Expert Grand Compte',
    shortLabel: 'Grand Compte',
    description: 'Fibre Dédiée, flottes corporate & dossiers grands comptes',
    perks: [
      'Tous les accès Commercial B2B + Priorité Grands Comptes (≥ 30 sal.)',
      'Audit & Enrichissement IA en rafale (8 workers parallèles)',
      'Simulateur avancé Fibre Dédiée / Flotte Corporate & Export CSV complet',
    ],
  },
  {
    value: 'team_lead',
    label: 'Chef d’Équipe',
    shortLabel: 'Chef d’Équipe',
    description: 'Animation d’escouade terrain & accompagnement commercial',
    perks: [
      'Tous les accès Expert Grand Compte + Crawler Profond Niveau 1 & 2',
      'Module Déduplication MDM & Fusion intelligente des doublons',
      'Suivi détaillé des performances et objectifs de son escouade',
    ],
  },
  {
    value: 'manager',
    label: 'Superviseur / Manager',
    shortLabel: 'Superviseur',
    description: 'Pilotage commercial, suivi territorial & performance équipe (sans accès Admin/API/Map)',
    perks: [
      'Tous les accès Chef d’Équipe + Supervision Équipe & Payouts multi-zones',
      'Pré-validation des commissions & Attribution de distinctions d’équipe',
      'Export Backup JSON global (Sans accès Comptes, Coffre API ni Carte GPS)',
    ],
  },
];

export function getRoleCapabilities(
  role: ManagedUserRole | 'super_admin' | string | undefined,
  isVerifiedSuperAdminUser = false
): RoleCapabilities {
  if (isVerifiedSuperAdminUser || role === 'super_admin') {
    return {
      role: 'super_admin',
      level: 5,
      label: 'Super Admin Principal',
      unlockedPerks: [
        'Accès intégral CRM DIVERSIFIA toutes zones & tous modules',
        'Exclusif : Carte GPS Temps Réel (3s) & Radar de Suivi Collaborateurs',
        'Exclusif : Gestion des Utilisateurs, Rôles & Pointage',
        'Exclusif : Coffre Clés API Cloud (/api_keys/{provider})',
      ],
      restrictedToSuperAdmin: SUPER_ADMIN_EXCLUSIVE_FEATURES,
      canManageOwnPortfolio: true,
      canUseAiEmailStudio: true,
      canUseCommissionCalculator: true,
      canBatchAudit8Workers: true,
      canPrioritizeGrandCompte: true,
      canUseDeepCrawlerL2: true,
      canUseMdmDeduplication: true,
      canViewSquadLeaderboard: true,
      canSuperviseTeamPayouts: true,
      canAwardTeamDistinctions: true,
      canExportFullBackupJson: true,
      canManageUsers: true,
      canAccessApiKeysVault: true,
      canAccessLiveGpsMap: true,
    };
  }

  const normalized = normalizeManagedRole(role);
  const opt = MANAGED_ROLE_OPTIONS.find((o) => o.value === normalized) || MANAGED_ROLE_OPTIONS[0];
  const level: 1 | 2 | 3 | 4 =
    normalized === 'manager'
      ? 4
      : normalized === 'team_lead'
        ? 3
        : normalized === 'grand_compte'
          ? 2
          : 1;

  return {
    role: normalized,
    level,
    label: opt.label,
    unlockedPerks: [...opt.perks],
    restrictedToSuperAdmin: SUPER_ADMIN_EXCLUSIVE_FEATURES,
    canManageOwnPortfolio: true,
    canUseAiEmailStudio: true,
    canUseCommissionCalculator: true,
    canBatchAudit8Workers: level >= 2,
    canPrioritizeGrandCompte: level >= 2,
    canUseDeepCrawlerL2: level >= 3,
    canUseMdmDeduplication: level >= 3,
    canViewSquadLeaderboard: level >= 3,
    canSuperviseTeamPayouts: level >= 4,
    canAwardTeamDistinctions: level >= 4,
    canExportFullBackupJson: level >= 4,
    // STRICTEMENT VERROUILLÉ : Aucun rôle autre que le Super-Admin n'a accès à ces 3 modules
    canManageUsers: false,
    canAccessApiKeysVault: false,
    canAccessLiveGpsMap: false,
  };
}

export function normalizeManagedRole(raw: unknown): ManagedUserRole {
  if (raw === 'manager' || raw === 'team_lead' || raw === 'grand_compte' || raw === 'commercial') {
    return raw;
  }
  return 'commercial';
}

export function getManagedRoleLabel(role: ManagedUserRole): string {
  const found = MANAGED_ROLE_OPTIONS.find((opt) => opt.value === role);
  return found ? found.label : 'Commercial B2B';
}

export const AUTHORIZED_SUPERVISOR_ROLES = new Set([
  'super_admin',
  'admin',
  'manager',
  'superviseur',
] as const);

/**
 * Retourne true uniquement pour les rôles superviseurs autorisés
 * (`super_admin`, `admin`, `manager`, `superviseur`).
 */
export function isSupervisorRole(role: string | null | undefined): boolean {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return AUTHORIZED_SUPERVISOR_ROLES.has(normalized as never);
}

/**
 * Indique si le rôle est autorisé à voir et manipuler les contrôles
 * de supervision audio / écoute & soufflage (Whisper Coaching).
 */
export function canUseWhisperCoaching(role: string | null | undefined): boolean {
  return isSupervisorRole(role);
}

export interface CollaboratorAudioUiVisibility {
  isSupervisor: boolean;
  showAudioSupervisionContainer: boolean;
  showListenAndWhisperControls: boolean;
  allowSilentBackgroundEarpiece: boolean;
}

export function getCollaboratorAudioUiVisibility(
  role: string | null | undefined
): CollaboratorAudioUiVisibility {
  const supervisor = isSupervisorRole(role);
  return {
    isSupervisor: supervisor,
    showAudioSupervisionContainer: supervisor,
    showListenAndWhisperControls: supervisor,
    allowSilentBackgroundEarpiece: true,
  };
}

export interface ManagedAppUser {
  uid: string;
  email: string;
  displayName: string;
  role: ManagedUserRole;
  zone: string;
  active: boolean;
  createdBy: string;
  createdAt?: string;
}

export type AccessDecision =
  | { status: 'allowed'; isAdmin: true; roleLabel: 'Super Admin' }
  | { status: 'allowed'; isAdmin: false; roleLabel: string; profile: ManagedAppUser }
  | { status: 'verify_email'; email: string; isAdmin: boolean }
  | { status: 'denied'; reason: string };

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return normalizeAuthEmail(email) === SUPER_ADMIN_EMAIL;
}

/**
 * Super-Admin privileges strictly require the exact owner email AND verified email state.
 */
export function isVerifiedSuperAdmin(
  email: string | null | undefined,
  emailVerified: boolean | undefined
): boolean {
  return Boolean(emailVerified) && isSuperAdminEmail(email);
}

/**
 * Evaluates whether a signed-in Firebase user is allowed into the CRM workspace.
 * - Super-Admin (hardcallmohamed@gmail.com): allowed when email is verified (or asked to verify if Email/Password unverified).
 * - Other users: MUST exist in /app_users/{uid} with active === true AND verified email.
 */
export function evaluateUserAccess(params: {
  email: string | null | undefined;
  emailVerified: boolean;
  appUserProfile: ManagedAppUser | null;
}): AccessDecision {
  const email = normalizeAuthEmail(params.email);

  if (isSuperAdminEmail(email)) {
    if (!params.emailVerified) {
      return { status: 'verify_email', email, isAdmin: true };
    }
    return { status: 'allowed', isAdmin: true, roleLabel: 'Super Admin' };
  }

  if (!params.appUserProfile) {
    return {
      status: 'denied',
      reason:
        "Votre compte n'est pas autorisé sur cette application. Seul l'administrateur peut créer et activer des accès utilisateurs.",
    };
  }

  if (!params.appUserProfile.active) {
    return {
      status: 'denied',
      reason:
        "Votre accès a été suspendu par l'administrateur. Contactez votre responsable Orange Pro pour le réactiver.",
    };
  }

  if (!params.emailVerified) {
    return { status: 'verify_email', email, isAdmin: false };
  }

  return {
    status: 'allowed',
    isAdmin: false,
    roleLabel: getManagedRoleLabel(params.appUserProfile.role),
    profile: params.appUserProfile,
  };
}

export function validateNewUserInput(input: {
  displayName: string;
  email: string;
  password: string;
}): string | null {
  const name = input.displayName.trim();
  const email = normalizeAuthEmail(input.email);
  const password = input.password;

  if (name.length < 2) {
    return 'Indiquez le nom complet de l’utilisateur (au moins 2 caractères).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Adresse email professionnelle invalide.';
  }
  if (email === SUPER_ADMIN_EMAIL) {
    return 'Cette adresse correspond déjà au compte Super-Admin principal.';
  }
  if (password.length < 8) {
    return 'Le mot de passe temporaire doit contenir au moins 8 caractères.';
  }
  return null;
}

export function generateStrongTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#!$%&*';
  const all = upper + lower + digits + symbols;

  const pick = (pool: string) => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return pool[buf[0] % pool.length];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < Math.max(8, length)) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export interface FormattedAuthError {
  message: string;
  code: 'unauthorized_domain' | 'provider_disabled' | 'invalid_credentials' | 'email_in_use' | 'popup_closed' | 'generic';
  domainToAuthorize?: string;
}

export function formatFirebaseAuthError(err: unknown, currentHostname = ''): FormattedAuthError {
  const raw = err instanceof Error ? err.message : String(err || '');

  if (raw.includes('auth/unauthorized-domain')) {
    return {
      code: 'unauthorized_domain',
      domainToAuthorize: currentHostname || 'hardcallmohamed-afk.github.io',
      message: `Le domaine « ${currentHostname || 'votre site'} » n'est pas encore autorisé pour la pop-up Google dans Firebase Console. Utilisez la connexion Email + Mot de passe ci-dessous ou ajoutez ce domaine dans Firebase Auth > Settings > Authorized domains.`,
    };
  }
  if (raw.includes('auth/operation-not-allowed')) {
    return {
      code: 'provider_disabled',
      message:
        'La connexion Email / Mot de passe doit être activée une fois dans Firebase Console (Authentication → Sign-in method → Email/Password → Activer).',
    };
  }
  if (
    raw.includes('auth/invalid-credential') ||
    raw.includes('auth/wrong-password') ||
    raw.includes('auth/user-not-found') ||
    raw.includes('auth/invalid-email')
  ) {
    return {
      code: 'invalid_credentials',
      message: 'Email ou mot de passe incorrect. Vérifiez vos identifiants ou cliquez sur « Mot de passe oublié ? ».',
    };
  }
  if (raw.includes('auth/email-already-in-use')) {
    return {
      code: 'email_in_use',
      message: 'Un compte Firebase existe déjà pour cette adresse email.',
    };
  }
  if (raw.includes('auth/too-many-requests')) {
    return {
      code: 'generic',
      message: 'Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer.',
    };
  }
  if (raw.includes('auth/popup-closed-by-user')) {
    return {
      code: 'popup_closed',
      message: 'Fenêtre de connexion Google fermée avant la fin.',
    };
  }
  if (raw.includes('auth/requires-recent-login')) {
    return {
      code: 'generic',
      message: 'Par sécurité, reconnectez-vous récemment avant de modifier votre mot de passe.',
    };
  }
  return {
    code: 'generic',
    message: 'Échec de l’authentification Firebase. Vérifiez votre connexion internet et vos paramètres.',
  };
}
