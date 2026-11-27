// Routeur léger côté client basé sur URL Hash & deep-linking avec synchronisation localStorage.
// Permet :
// 1. La persistance exacte de la section active lors d'un rafraîchissement (F5 / reload) ou d'un partage d'URL.
// 2. L'historique de navigation du navigateur (boutons Précédent / Suivant).
// 3. Des sous-routes précises pour l'Administration (#/admin/utilisateurs, #/admin/radar, #/admin/coffre).

export type CrmTabId =
  | 'portefeuille'
  | 'kanban'
  | 'team'
  | 'badges'
  | 'crawler'
  | 'paste'
  | 'dedup'
  | 'compte'
  | 'admin'
  | 'vault';

export type AdminSubSectionId = 'all' | 'users' | 'attendance' | 'vault' | 'security';

export interface CrmRouteState {
  tab: CrmTabId;
  adminSubSection?: AdminSubSectionId;
}

export const STORAGE_ACTIVE_TAB_KEY = 'diversifia_crm_active_tab_v2';
export const STORAGE_ADMIN_SUBSECTION_KEY = 'diversifia_crm_admin_subsection_v2';

const TAB_HASH_CANONICAL: Record<CrmTabId, string> = {
  portefeuille: 'portefeuille',
  kanban: 'kanban',
  team: 'equipe',
  badges: 'succes',
  crawler: 'crawler',
  paste: 'extraction',
  dedup: 'deduplication',
  compte: 'compte',
  admin: 'admin',
  vault: 'vault',
};

const HASH_ALIASES: Record<string, CrmTabId> = {
  portefeuille: 'portefeuille',
  portfolio: 'portefeuille',
  crm: 'portefeuille',
  fiches: 'portefeuille',
  leads: 'portefeuille',
  '': 'portefeuille',

  kanban: 'kanban',
  pipeline: 'kanban',

  equipe: 'team',
  team: 'team',
  payouts: 'team',
  commissions: 'team',
  classement: 'team',

  succes: 'badges',
  badges: 'badges',
  achievements: 'badges',
  progression: 'badges',

  crawler: 'crawler',
  scraping: 'crawler',
  annuaires: 'crawler',

  extraction: 'paste',
  paste: 'paste',
  import: 'paste',
  collecte: 'paste',

  deduplication: 'dedup',
  dedup: 'dedup',
  doublons: 'dedup',
  mdm: 'dedup',

  compte: 'compte',
  account: 'compte',
  profile: 'compte',
  profil: 'compte',
  parametres: 'compte',
  settings: 'compte',

  admin: 'admin',
  administration: 'admin',
  users: 'admin',
  utilisateurs: 'admin',

  vault: 'vault',
  coffre: 'vault',
  api_keys: 'vault',
  'api-keys': 'vault',
  keys: 'vault',
};

const ADMIN_SUBSECTION_ALIASES: Record<string, AdminSubSectionId> = {
  users: 'users',
  utilisateurs: 'users',
  comptes: 'users',
  team: 'users',

  radar: 'attendance',
  attendance: 'attendance',
  presence: 'attendance',
  gps: 'attendance',
  suivi: 'attendance',
  carte: 'attendance',

  vault: 'vault',
  coffre: 'vault',
  cles: 'vault',
  keys: 'vault',
  api: 'vault',

  all: 'all',
  overview: 'all',
  global: 'all',
  'vue-globale': 'all',

  security: 'security',
  securite: 'security',
  gouvernance: 'security',
  dlp: 'security',
  audit: 'security',
};

/**
 * Analyse le hash de l'URL courante et retourne la route correspondante.
 */
export function parseRouteFromHash(rawHash: string): CrmRouteState {
  const clean = (rawHash || '')
    .replace(/^#\/?/, '')
    .split('?')[0]
    .trim()
    .toLowerCase();

  if (!clean) {
    return { tab: 'portefeuille' };
  }

  const segments = clean.split('/').map((s) => s.trim()).filter(Boolean);
  const first = segments[0] || '';
  const second = segments[1] || '';

  // Cas spécial : sous-route admin (#/admin/users, #/admin/radar, #/admin/coffre)
  if (first === 'admin' || first === 'administration') {
    if (second && ADMIN_SUBSECTION_ALIASES[second]) {
      const sub = ADMIN_SUBSECTION_ALIASES[second];
      if (sub === 'vault') {
        return { tab: 'vault', adminSubSection: 'vault' };
      }
      return { tab: 'admin', adminSubSection: sub };
    }
    return { tab: 'admin', adminSubSection: 'all' };
  }

  // Cas direct raccourci (#/radar, #/coffre)
  if (first === 'radar' || first === 'attendance' || first === 'gps') {
    return { tab: 'admin', adminSubSection: 'attendance' };
  }
  if (first === 'coffre' || first === 'vault' || first === 'api_keys' || first === 'api-keys') {
    return { tab: 'vault', adminSubSection: 'vault' };
  }

  const matchedTab = HASH_ALIASES[first];
  if (matchedTab) {
    return { tab: matchedTab };
  }

  return { tab: 'portefeuille' };
}

/**
 * Construit un hash d'URL clair et élégant à partir de la route et sous-section.
 */
export function buildHashFromRoute(
  tab: CrmTabId,
  adminSubSection?: AdminSubSectionId
): string {
  if (tab === 'vault') {
    return '#/vault';
  }
  if (tab === 'admin') {
    if (adminSubSection === 'users') return '#/admin/utilisateurs';
    if (adminSubSection === 'attendance') return '#/admin/radar';
    if (adminSubSection === 'vault') return '#/vault';
    if (adminSubSection === 'security') return '#/admin/securite';
    if (adminSubSection === 'all') return '#/admin';
    return '#/admin';
  }
  const canonical = TAB_HASH_CANONICAL[tab] || 'portefeuille';
  return `#/${canonical}`;
}

/**
 * Sauvegarde la route active dans le localStorage pour restaurer l'état exact en cas de navigation sans hash.
 */
export function saveRouteToStorage(route: CrmRouteState): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_ACTIVE_TAB_KEY, route.tab);
    if (route.adminSubSection) {
      window.localStorage.setItem(STORAGE_ADMIN_SUBSECTION_KEY, route.adminSubSection);
    }
  } catch {
    // Ignore quota issues
  }
}

/**
 * Charge la dernière route enregistrée depuis le localStorage.
 */
export function loadRouteFromStorage(): CrmRouteState | null {
  try {
    if (typeof window === 'undefined') return null;
    const rawTab = window.localStorage.getItem(STORAGE_ACTIVE_TAB_KEY);
    if (!rawTab) return null;
    const matched = HASH_ALIASES[rawTab.trim().toLowerCase()];
    if (!matched) return null;

    let sub: AdminSubSectionId | undefined;
    const rawSub = window.localStorage.getItem(STORAGE_ADMIN_SUBSECTION_KEY);
    if (rawSub && ADMIN_SUBSECTION_ALIASES[rawSub.trim().toLowerCase()]) {
      sub = ADMIN_SUBSECTION_ALIASES[rawSub.trim().toLowerCase()];
    }

    return {
      tab: matched,
      adminSubSection: sub,
    };
  } catch {
    return null;
  }
}

/**
 * Détermine la route initiale au chargement :
 * 1. Vérifie le hash d'URL en priorité (permet les liens partagés, favoris et rafraîchissement F5).
 * 2. Si hash vide, vérifie le localStorage (persistance de session).
 * 3. Sinon retombe sur le Portefeuille CRM.
 */
export function resolveInitialCrmRoute(currentHash?: string): CrmRouteState {
  const hash =
    typeof currentHash === 'string'
      ? currentHash
      : typeof window !== 'undefined'
        ? window.location.hash
        : '';

  if (hash && hash.replace(/^#\/?/, '').trim().length > 0) {
    const fromHash = parseRouteFromHash(hash);
    saveRouteToStorage(fromHash);
    return fromHash;
  }

  const fromStorage = loadRouteFromStorage();
  if (fromStorage) {
    return fromStorage;
  }

  return { tab: 'portefeuille' };
}

/**
 * Synchronise l'URL du navigateur avec la route active sans rechargement de page.
 */
export function syncRouteToUrl(route: CrmRouteState, replace = false): void {
  if (typeof window === 'undefined') return;
  const targetHash = buildHashFromRoute(route.tab, route.adminSubSection);
  if (window.location.hash === targetHash) return;

  saveRouteToStorage(route);

  try {
    if (replace) {
      window.history.replaceState(null, '', targetHash);
    } else {
      window.history.pushState(null, '', targetHash);
    }
  } catch {
    window.location.hash = targetHash;
  }
}

export interface RouteBreadcrumbInfo {
  sectionLabel: string;
  tabLabel: string;
  subLabel?: string;
}

export function getRouteBreadcrumb(
  tab: CrmTabId,
  adminSubSection?: AdminSubSectionId
): RouteBreadcrumbInfo {
  switch (tab) {
    case 'portefeuille':
      return { sectionLabel: 'Commercial', tabLabel: 'Portefeuille CRM' };
    case 'kanban':
      return { sectionLabel: 'Commercial', tabLabel: 'Pipeline Kanban' };
    case 'team':
      return { sectionLabel: 'Commercial', tabLabel: 'Équipe & Payouts' };
    case 'badges':
      return { sectionLabel: 'Progression', tabLabel: 'Succès & Badges' };
    case 'crawler':
      return { sectionLabel: 'Prospection & MDM', tabLabel: 'Crawler Profond N1/N2' };
    case 'paste':
      return { sectionLabel: 'Prospection & MDM', tabLabel: 'Extraction HTML & CSV' };
    case 'dedup':
      return { sectionLabel: 'Prospection & MDM', tabLabel: 'Déduplication MDM' };
    case 'compte':
      return { sectionLabel: 'Progression', tabLabel: 'Mon Compte' };
    case 'admin':
      if (adminSubSection === 'users') {
        return {
          sectionLabel: 'Administration',
          tabLabel: 'Console Super-Admin',
          subLabel: 'Utilisateurs & Accès',
        };
      }
      if (adminSubSection === 'attendance') {
        return {
          sectionLabel: 'Administration',
          tabLabel: 'Console Super-Admin',
          subLabel: 'Radar GPS & Présence Terrain',
        };
      }
      if (adminSubSection === 'security') {
        return {
          sectionLabel: 'Administration',
          tabLabel: 'Console Super-Admin',
          subLabel: 'Gouvernance & Centre Sécurité / DLP',
        };
      }
      return {
        sectionLabel: 'Administration',
        tabLabel: 'Console Super-Admin',
        subLabel: "Vue d'ensemble",
      };
    case 'vault':
      return {
        sectionLabel: 'Administration',
        tabLabel: 'Console Super-Admin',
        subLabel: 'Coffre Clés API (/api_keys)',
      };
    default:
      return { sectionLabel: 'Commercial', tabLabel: 'Portefeuille CRM' };
  }
}
