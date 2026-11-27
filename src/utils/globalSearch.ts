// Pure global instant search engine (Ctrl+K / Cmd+K) for CRM DIVERSIFIA — Orange Pro B2B.
// Accent-tolerant, Moroccan phone-aware (06 / 06 61 / +212661 / 212661), and strictly RBAC-enforced.

import { SECTEURS_META, type FicheEntreprise } from './crmDomain';
import { ROLE_BADGE_META, type TeamRole, type TeamStatRecord } from './gamification';
import type { CrmTabId } from '../components/CrmSidebar';
import type { AdminSubSectionId } from './crmRouter';

export type GlobalSearchActionId =
  | 'nav_tab'
  | 'new_fiche'
  | 'open_copilot'
  | 'open_hygiene';

export interface GlobalSearchFicheHit {
  kind: 'fiche';
  id: string;
  fiche: FicheEntreprise;
  score: number;
  matchedField: string;
}

export interface GlobalSearchCollaboratorHit {
  kind: 'collaborator';
  id: string;
  member: TeamStatRecord;
  score: number;
}

export interface GlobalSearchActionHit {
  kind: 'action';
  id: string;
  actionType: GlobalSearchActionId;
  label: string;
  subtitle: string;
  tab?: CrmTabId;
  adminSubSection?: AdminSubSectionId;
  keywords: string[];
  superAdminOnly?: boolean;
  score: number;
}

export type GlobalSearchItem =
  | GlobalSearchFicheHit
  | GlobalSearchCollaboratorHit
  | GlobalSearchActionHit;

export interface GlobalSearchResults {
  query: string;
  fiches: GlobalSearchFicheHit[];
  collaborators: GlobalSearchCollaboratorHit[];
  actions: GlobalSearchActionHit[];
  flatItems: GlobalSearchItem[];
  totalCount: number;
}

export interface GlobalSearchInput {
  query: string;
  fiches: FicheEntreprise[];
  teamStats: TeamStatRecord[];
  role: TeamRole | string;
  isSuperAdmin: boolean;
  maxFiches?: number;
  maxCollaborators?: number;
}

/**
 * Strips accents, lowercases, and collapses non-alphanumeric separators to single spaces.
 */
export function normalizeSearchText(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes Moroccan phone inputs or fragments so that:
 *  - "0661"
 *  - "06 61"
 *  - "+212661"
 *  - "+212 6 61"
 *  - "212661"
 *  - "00212 661"
 * all map to the canonical prefix "0661".
 */
export function normalizeMoroccanPhoneFragment(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 3) return '';

  if (digits.startsWith('002120')) {
    return '0' + digits.slice(6);
  }
  if (digits.startsWith('00212')) {
    return '0' + digits.slice(5);
  }
  if (digits.startsWith('2120') && digits.length >= 5) {
    return '0' + digits.slice(4);
  }
  if (digits.startsWith('212') && digits.length >= 4 && /^[567]/.test(digits[3])) {
    return '0' + digits.slice(3);
  }
  // Handle queries like "+212 6..." where raw had + or 212
  if (digits.length === 9 && /^[567]/.test(digits)) {
    return '0' + digits;
  }
  return digits;
}

/**
 * Returns true if the user query looks phone-like (digits, spaces, +, -, parens, dots).
 */
export function isPhoneLikeQuery(raw: string): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return false;
  if (!/^[\d\s+\-().]+$/.test(trimmed)) return false;
  return normalizeMoroccanPhoneFragment(trimmed).length >= 3;
}

function scoreTextField(queryNorm: string, queryTokens: string[], rawValue: string): number {
  if (!rawValue || !queryNorm) return 0;
  const valNorm = normalizeSearchText(rawValue);
  if (!valNorm) return 0;

  if (valNorm === queryNorm) return 100;
  if (valNorm.startsWith(queryNorm)) return 85;

  const words = valNorm.split(' ');
  if (words.some((w) => w === queryNorm)) return 80;
  if (words.some((w) => w.startsWith(queryNorm))) return 70;
  if (valNorm.includes(queryNorm)) return 50;

  if (queryTokens.length > 1 && queryTokens.every((tok) => valNorm.includes(tok))) {
    return 45;
  }
  return 0;
}

function scorePhoneField(phoneQueryDigits: string, rawPhone: string): number {
  if (!phoneQueryDigits || !rawPhone) return 0;
  const targetDigits = normalizeMoroccanPhoneFragment(rawPhone);
  if (!targetDigits) return 0;

  if (targetDigits === phoneQueryDigits) return 98;
  if (targetDigits.startsWith(phoneQueryDigits)) return 90;
  if (targetDigits.includes(phoneQueryDigits)) return 72;
  return 0;
}

interface ActionCatalogItem {
  id: string;
  actionType: GlobalSearchActionId;
  label: string;
  subtitle: string;
  tab?: CrmTabId;
  adminSubSection?: AdminSubSectionId;
  keywords: string[];
  superAdminOnly?: boolean;
  defaultPriority: number;
}

const ACTION_CATALOG: readonly ActionCatalogItem[] = [
  // Quick Actions
  {
    id: 'action-new-fiche',
    actionType: 'new_fiche',
    label: '+ Nouvelle fiche rapide',
    subtitle: 'Créer un prospect entreprise B2B dans votre portefeuille',
    keywords: ['nouvelle', 'fiche', 'creer', 'ajouter', 'prospect', 'client', 'rapide', 'plus'],
    defaultPriority: 100,
  },
  {
    id: 'action-open-copilot',
    actionType: 'open_copilot',
    label: 'Ouvrir Copilote IA',
    subtitle: 'Brief commercial, relances et analyse de portefeuille',
    keywords: ['copilote', 'ia', 'ai', 'assistant', 'gemini', 'brief', 'analyse'],
    defaultPriority: 95,
  },
  {
    id: 'action-open-hygiene',
    actionType: 'open_hygiene',
    label: 'Diagnostic Hygiène Données',
    subtitle: 'Détecter et nettoyer effectifs aberrants, téléphones et emails',
    tab: 'dedup',
    keywords: ['hygiene', 'nettoyage', 'diagnostic', 'donnees', 'effectif', 'anomalie', 'dedup', 'qualite'],
    defaultPriority: 90,
  },
  // Standard CRM Navigation Tabs (authorized for all approved roles)
  {
    id: 'nav-portefeuille',
    actionType: 'nav_tab',
    label: 'Portefeuille CRM',
    subtitle: 'Tableau et cartes terrain de tous vos prospects',
    tab: 'portefeuille',
    keywords: ['portefeuille', 'crm', 'prospects', 'fiches', 'tableau', 'clients', 'accueil'],
    defaultPriority: 85,
  },
  {
    id: 'nav-kanban',
    actionType: 'nav_tab',
    label: 'Kanban Pipeline',
    subtitle: 'Suivi visuel par étapes de conversion',
    tab: 'kanban',
    keywords: ['kanban', 'pipeline', 'etapes', 'rdv', 'devis', 'signe'],
    defaultPriority: 80,
  },
  {
    id: 'nav-team',
    actionType: 'nav_tab',
    label: 'Équipe & Payouts',
    subtitle: 'Classement commercial, commissions MAD et contrats signés',
    tab: 'team',
    keywords: ['equipe', 'team', 'payouts', 'commissions', 'classement', 'contrats', 'rapport', 'bordereau', 'paie'],
    defaultPriority: 78,
  },
  {
    id: 'nav-crawler',
    actionType: 'nav_tab',
    label: 'Crawler Profond N1/N2',
    subtitle: 'Exploration automatisée des annuaires B2B',
    tab: 'crawler',
    keywords: ['crawler', 'scraping', 'exploration', 'annuaire', 'prospection'],
    defaultPriority: 70,
  },
  {
    id: 'nav-paste',
    actionType: 'nav_tab',
    label: 'Extraction HTML / CSV / JSON',
    subtitle: 'Import rapide de prospects et sauvegarde',
    tab: 'paste',
    keywords: ['extraction', 'import', 'csv', 'json', 'html', 'coller', 'paste'],
    defaultPriority: 68,
  },
  {
    id: 'nav-dedup',
    actionType: 'nav_tab',
    label: 'Déduplication MDM',
    subtitle: 'Fusion intelligente des doublons et hygiène CRM',
    tab: 'dedup',
    keywords: ['deduplication', 'dedup', 'doublons', 'mdm', 'fusion'],
    defaultPriority: 66,
  },
  {
    id: 'nav-badges',
    actionType: 'nav_tab',
    label: 'Succès & Badges',
    subtitle: 'XP cumulés, paliers de rareté et distinctions',
    tab: 'badges',
    keywords: ['badges', 'succes', 'xp', 'realisations', 'trophees'],
    defaultPriority: 62,
  },
  {
    id: 'nav-compte',
    actionType: 'nav_tab',
    label: 'Mon Compte & Paramètres',
    subtitle: 'Profil, signature email, objectifs et cache hors-ligne',
    tab: 'compte',
    keywords: ['compte', 'profil', 'parametres', 'signature', 'securite', 'offline'],
    defaultPriority: 60,
  },
  // STRICTLY SUPER-ADMIN ONLY (#/admin, #/admin/radar, #/vault)
  {
    id: 'nav-admin',
    actionType: 'nav_tab',
    label: 'Administration Utilisateurs & Accès',
    subtitle: 'Gestion des comptes, approbations et rôles (#/admin)',
    tab: 'admin',
    adminSubSection: 'users',
    keywords: ['admin', 'administration', 'utilisateurs', 'roles', 'acces', 'comptes', 'approbation'],
    superAdminOnly: true,
    defaultPriority: 55,
  },
  {
    id: 'nav-admin-radar',
    actionType: 'nav_tab',
    label: 'Radar GPS & Présence Équipe',
    subtitle: 'Suivi temps réel, carte terrain et pointage (#/admin/radar)',
    tab: 'admin',
    adminSubSection: 'attendance',
    keywords: ['radar', 'gps', 'presence', 'carte', 'pointage', 'live', 'localisation', 'admin'],
    superAdminOnly: true,
    defaultPriority: 54,
  },
  {
    id: 'nav-vault',
    actionType: 'nav_tab',
    label: 'Coffre Clés API Cloud',
    subtitle: 'Gestion sécurisée des clés Groq, Mistral et Gemini (#/vault)',
    tab: 'vault',
    adminSubSection: 'vault',
    keywords: ['vault', 'coffre', 'cles', 'api', 'groq', 'mistral', 'gemini', 'admin'],
    superAdminOnly: true,
    defaultPriority: 53,
  },
];

/**
 * Checks strict Super-Admin eligibility for restricted navigation entries.
 * Never grants access to commercial, grand_compte, senior, team_lead, or manager.
 */
export function canAccessSuperAdminSearchRoutes(
  role: TeamRole | string,
  isSuperAdmin: boolean
): boolean {
  return Boolean(isSuperAdmin && role === 'super_admin');
}

export function runGlobalSearch(input: GlobalSearchInput): GlobalSearchResults {
  const {
    query,
    fiches,
    teamStats,
    role,
    isSuperAdmin,
    maxFiches = 8,
    maxCollaborators = 5,
  } = input;

  const trimmed = (query || '').trim();
  const queryNorm = normalizeSearchText(trimmed);
  const queryTokens = queryNorm ? queryNorm.split(' ').filter(Boolean) : [];
  const phoneQueryDigits = normalizeMoroccanPhoneFragment(trimmed);
  const phoneLike = isPhoneLikeQuery(trimmed);
  const allowSuperAdminRoutes = canAccessSuperAdminSearchRoutes(role, isSuperAdmin);

  // Filter actions strictly by RBAC first so restricted entries can NEVER leak
  const allowedCatalog = ACTION_CATALOG.filter(
    (item) => !item.superAdminOnly || allowSuperAdminRoutes
  );

  // Empty query -> instant useful starter palette (quick actions + top tabs + first 4 fiches)
  if (!queryNorm && !phoneQueryDigits) {
    const starterActions: GlobalSearchActionHit[] = allowedCatalog
      .slice(0, 8)
      .map((item) => ({
        kind: 'action',
        id: item.id,
        actionType: item.actionType,
        label: item.label,
        subtitle: item.subtitle,
        tab: item.tab,
        adminSubSection: item.adminSubSection,
        keywords: item.keywords,
        superAdminOnly: item.superAdminOnly,
        score: item.defaultPriority,
      }));

    const starterFiches: GlobalSearchFicheHit[] = fiches
      .slice(0, Math.min(4, maxFiches))
      .map((fiche, idx) => ({
        kind: 'fiche',
        id: `fiche-${fiche.id}`,
        fiche,
        score: 50 - idx,
        matchedField: 'recent',
      }));

    const flatItems: GlobalSearchItem[] = [...starterActions, ...starterFiches];
    return {
      query: trimmed,
      fiches: starterFiches,
      collaborators: [],
      actions: starterActions,
      flatItems,
      totalCount: flatItems.length,
    };
  }

  // 1. Score Fiches
  const ficheHits: GlobalSearchFicheHit[] = [];
  for (const f of fiches) {
    let bestScore = 0;
    let matchedField = '';

    const consider = (score: number, field: string) => {
      if (score > bestScore) {
        bestScore = score;
        matchedField = field;
      }
    };

    if (phoneQueryDigits) {
      consider(scorePhoneField(phoneQueryDigits, f.telephone), 'telephone');
      if (Array.isArray(f.telephonesSupplementaires)) {
        for (const extra of f.telephonesSupplementaires) {
          consider(scorePhoneField(phoneQueryDigits, extra), 'telephone');
        }
      }
    }

    if (queryNorm) {
      // Exact or prefix match on numeroFiche gets top boost
      if (f.numeroFiche) {
        const numScore = scoreTextField(queryNorm, queryTokens, f.numeroFiche);
        if (numScore > 0) consider(numScore + 12, 'numeroFiche');
      }
      // Company name gets strong priority
      const socScore = scoreTextField(queryNorm, queryTokens, f.societe);
      if (socScore > 0) consider(socScore + 10, 'societe');

      consider(scoreTextField(queryNorm, queryTokens, f.contact), 'contact');
      consider(scoreTextField(queryNorm, queryTokens, f.ville), 'ville');
      consider(scoreTextField(queryNorm, queryTokens, f.email), 'email');
      if (Array.isArray(f.emailsSupplementaires)) {
        for (const extraMail of f.emailsSupplementaires) {
          consider(scoreTextField(queryNorm, queryTokens, extraMail), 'email');
        }
      }
      const secMeta = SECTEURS_META[f.secteur];
      consider(scoreTextField(queryNorm, queryTokens, f.secteur), 'secteur');
      if (secMeta) {
        consider(scoreTextField(queryNorm, queryTokens, secMeta.label), 'secteur');
      }
      consider(scoreTextField(queryNorm, queryTokens, f.statut), 'statut');

      // Combined multi-token match across fields (e.g., "clinique meknes")
      if (bestScore === 0 && queryTokens.length > 1) {
        const combined = normalizeSearchText(
          `${f.societe} ${f.numeroFiche || ''} ${f.contact} ${f.ville} ${f.email} ${f.secteur} ${secMeta?.label || ''} ${f.statut}`
        );
        if (queryTokens.every((tok) => combined.includes(tok))) {
          consider(42, 'multi');
        }
      }
    }

    if (bestScore > 0) {
      ficheHits.push({
        kind: 'fiche',
        id: `fiche-${f.id}`,
        fiche: f,
        score: bestScore,
        matchedField,
      });
    }
  }

  ficheHits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.fiche.societe.localeCompare(b.fiche.societe, 'fr');
  });
  const topFiches = ficheHits.slice(0, maxFiches);

  // 2. Score Collaborators (skip pure phone-number searches unless matching name/zone)
  const collaboratorHits: GlobalSearchCollaboratorHit[] = [];
  if (queryNorm && !phoneLike) {
    for (const member of teamStats) {
      const roleMeta = ROLE_BADGE_META[member.role];
      let bestScore = 0;

      const nameScore = scoreTextField(queryNorm, queryTokens, member.displayName);
      if (nameScore > 0) bestScore = Math.max(bestScore, nameScore + 10);

      bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, member.zone));
      bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, member.role));
      if (roleMeta) {
        bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, roleMeta.label));
        bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, roleMeta.shortLabel));
      }

      if (bestScore === 0 && queryTokens.length > 1) {
        const combined = normalizeSearchText(
          `${member.displayName} ${member.zone} ${member.role} ${roleMeta?.label || ''}`
        );
        if (queryTokens.every((tok) => combined.includes(tok))) {
          bestScore = 40;
        }
      }

      if (bestScore > 0) {
        collaboratorHits.push({
          kind: 'collaborator',
          id: `collab-${member.uid}`,
          member,
          score: bestScore,
        });
      }
    }

    collaboratorHits.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.member.displayName.localeCompare(b.member.displayName, 'fr');
    });
  }
  const topCollaborators = collaboratorHits.slice(0, maxCollaborators);

  // 3. Score Navigation & Quick Actions (strictly RBAC-filtered)
  const actionHits: GlobalSearchActionHit[] = [];
  if (queryNorm && !phoneLike) {
    for (const item of allowedCatalog) {
      let bestScore = 0;
      const labelScore = scoreTextField(queryNorm, queryTokens, item.label);
      if (labelScore > 0) bestScore = Math.max(bestScore, labelScore + 8);

      bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, item.subtitle));
      for (const kw of item.keywords) {
        bestScore = Math.max(bestScore, scoreTextField(queryNorm, queryTokens, kw));
      }

      if (bestScore === 0 && queryTokens.length > 1) {
        const combined = normalizeSearchText(
          `${item.label} ${item.subtitle} ${item.keywords.join(' ')}`
        );
        if (queryTokens.every((tok) => combined.includes(tok))) {
          bestScore = 40;
        }
      }

      if (bestScore > 0) {
        actionHits.push({
          kind: 'action',
          id: item.id,
          actionType: item.actionType,
          label: item.label,
          subtitle: item.subtitle,
          tab: item.tab,
          adminSubSection: item.adminSubSection,
          keywords: item.keywords,
          superAdminOnly: item.superAdminOnly,
          score: bestScore,
        });
      }
    }

    actionHits.sort((a, b) => b.score - a.score);
  }

  const flatItems: GlobalSearchItem[] = [...topFiches, ...topCollaborators, ...actionHits];

  return {
    query: trimmed,
    fiches: topFiches,
    collaborators: topCollaborators,
    actions: actionHits,
    flatItems,
    totalCount: flatItems.length,
  };
}
