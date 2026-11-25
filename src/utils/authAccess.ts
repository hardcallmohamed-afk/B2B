// Pure RBAC, Super-Admin identity, and Firebase Auth error formatting helpers.

export const SUPER_ADMIN_EMAIL = 'hardcallmohamed@gmail.com';
export const FIREBASE_PROJECT_ID = 'gen-lang-client-0884936685';

export type ManagedUserRole = 'commercial' | 'grand_compte' | 'team_lead' | 'manager';

export const MANAGED_ROLE_OPTIONS: ReadonlyArray<{
  value: ManagedUserRole;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: 'commercial',
    label: 'Commercial B2B',
    shortLabel: 'Commercial',
    description: 'Prospection terrain, qualification & signatures TPE/PME',
  },
  {
    value: 'grand_compte',
    label: 'Expert Grand Compte',
    shortLabel: 'Grand Compte',
    description: 'Fibre Dédiée, flottes corporate & dossiers grands comptes',
  },
  {
    value: 'team_lead',
    label: 'Chef d’Équipe',
    shortLabel: 'Chef d’Équipe',
    description: 'Animation d’escouade terrain & accompagnement commercial',
  },
  {
    value: 'manager',
    label: 'Superviseur / Manager',
    shortLabel: 'Superviseur',
    description: 'Pilotage commercial, suivi territorial & performance équipe',
  },
];

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
