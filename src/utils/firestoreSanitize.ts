// Pure Firestore payload sanitization & diff helpers aligned 1:1 with firebase-blueprint.json & firestore.rules.

export const VALID_SECTEUR_CODES = new Set([
  'fiduciaire',
  'clinique',
  'notaire',
  'immobilier',
  'riad_hotellerie',
  'auto_ecole',
  'pme',
  'industrie',
  'btp',
  'gros',
  'enseignement',
  'liberal',
  'commerce',
] as const);

export const VALID_STATUT_VALUES = new Set([
  'À contacter',
  'Appel en cours',
  'RDV pris',
  'Devis envoyé',
  'Signé Orange Pro',
  'Pas intéressé',
] as const);

export interface FicheLike {
  id: string;
  numeroFiche?: string;
  societe: string;
  secteur: string;
  ville: string;
  telephone: string;
  telephonesSupplementaires?: string[];
  email: string;
  emailsSupplementaires?: string[];
  contact: string;
  role: string;
  source: string;
  effectif: string;
  statut: string;
  siteWeb?: string;
  verifieWeb?: boolean;
  pistesEnrichissement?: string[];
  dateAjout: string;
}

export interface EmailSkillLike {
  id: string;
  nom: string;
  description: string;
  role: string;
  regles: string;
  ctaStyle: string;
  isBuiltin?: boolean;
}

export interface WorkspaceLike {
  villesAll: string[];
  villesActive: string[];
  modeVille: 'filter' | 'default';
  defaultVille: string;
  emailSignature: string;
  seeded: boolean;
  displayName?: string;
  avatarDataUrl?: string;
  phonePro?: string;
  zone?: string;
  bio?: string;
  monthlyGoalContracts?: number;
  notifyBadges?: boolean;
  notifySound?: boolean;
  compactUi?: boolean;
}

export interface SanitizedWorkspaceDoc {
  ownerId: string;
  villesAll: string[];
  villesActive: string[];
  modeVille: 'filter' | 'default';
  defaultVille: string;
  emailSignature: string;
  seeded: boolean;
  displayName?: string;
  avatarDataUrl?: string;
  phonePro?: string;
  zone?: string;
  bio?: string;
  monthlyGoalContracts?: number;
  notifyBadges?: boolean;
  notifySound?: boolean;
  compactUi?: boolean;
}

export interface SanitizedFicheDoc {
  ownerId: string;
  id: string;
  numeroFiche?: string;
  societe: string;
  secteur: string;
  ville: string;
  telephone: string;
  telephonesSupplementaires?: string[];
  email: string;
  emailsSupplementaires?: string[];
  contact: string;
  role: string;
  source: string;
  effectif: string;
  statut: string;
  siteWeb?: string;
  verifieWeb?: boolean;
  pistesEnrichissement?: string[];
  dateAjout: string;
}

export interface SanitizedEmailSkillDoc {
  ownerId: string;
  id: string;
  nom: string;
  description: string;
  role: string;
  regles: string;
  ctaStyle: string;
  isBuiltin?: boolean;
}

export const VALID_MANAGED_ROLES = new Set(['commercial', 'manager'] as const);

export interface AppUserLike {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  zone: string;
  active: boolean;
  createdBy: string;
}

export interface SanitizedAppUserDoc {
  uid: string;
  email: string;
  displayName: string;
  role: 'commercial' | 'manager';
  zone: string;
  active: boolean;
  createdBy: string;
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : fallback;
  return str.slice(0, maxLen);
}

export function sanitizeDocId(rawId: unknown, fallbackPrefix = 'doc'): string {
  const base = typeof rawId === 'string' ? rawId.trim() : '';
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  if (cleaned.length >= 1) return cleaned;
  return `${fallbackPrefix}_${Date.now().toString(36)}`;
}

export function sanitizeNumeroFiche(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  return cleaned.length >= 1 ? cleaned : undefined;
}

function sanitizeStringArray(arr: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, maxItemLen);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

const SAFE_AVATAR_DATA_URL_REGEX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function sanitizeAvatarDataUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length > 45000) return '';
  return SAFE_AVATAR_DATA_URL_REGEX.test(trimmed) ? trimmed : '';
}

export function sanitizeWorkspacePayload(ownerId: string, input: WorkspaceLike): SanitizedWorkspaceDoc {
  const cleanOwnerId = sanitizeDocId(ownerId, 'user');
  const villesAll = sanitizeStringArray(input.villesAll, 50, 100);
  const villesActive = sanitizeStringArray(input.villesActive, 50, 100);
  const modeVille: 'filter' | 'default' = input.modeVille === 'filter' ? 'filter' : 'default';
  const rawDefaultVille = clampString(input.defaultVille?.trim?.() ?? '', 80);
  const defaultVille = clampString(rawDefaultVille.length >= 1 ? rawDefaultVille : villesAll[0] || 'Meknès', 80);

  const doc: SanitizedWorkspaceDoc = {
    ownerId: cleanOwnerId,
    villesAll,
    villesActive,
    modeVille,
    defaultVille,
    emailSignature: clampString(input.emailSignature, 400),
    seeded: Boolean(input.seeded),
  };

  if (typeof input.displayName === 'string') {
    doc.displayName = clampString(input.displayName.trim(), 120);
  }
  if (typeof input.avatarDataUrl === 'string') {
    doc.avatarDataUrl = sanitizeAvatarDataUrl(input.avatarDataUrl);
  }
  if (typeof input.phonePro === 'string') {
    doc.phonePro = clampString(input.phonePro.trim(), 30);
  }
  if (typeof input.zone === 'string') {
    doc.zone = clampString(input.zone.trim(), 100);
  }
  if (typeof input.bio === 'string') {
    doc.bio = clampString(input.bio.trim(), 240);
  }
  if (typeof input.monthlyGoalContracts === 'number' && Number.isFinite(input.monthlyGoalContracts)) {
    doc.monthlyGoalContracts = Math.min(200, Math.max(1, Math.round(input.monthlyGoalContracts)));
  }
  if (typeof input.notifyBadges === 'boolean') {
    doc.notifyBadges = input.notifyBadges;
  }
  if (typeof input.notifySound === 'boolean') {
    doc.notifySound = input.notifySound;
  }
  if (typeof input.compactUi === 'boolean') {
    doc.compactUi = input.compactUi;
  }

  return doc;
}

export function sanitizeFichePayload(ownerId: string, fiche: FicheLike): SanitizedFicheDoc {
  const cleanOwnerId = sanitizeDocId(ownerId, 'user');
  const cleanId = sanitizeDocId(fiche.id, 'op');
  const cleanNumero = sanitizeNumeroFiche(fiche.numeroFiche);
  const rawSociete = clampString(fiche.societe?.trim?.() ?? '', 200);
  const societe = rawSociete.length >= 1 ? rawSociete : 'Entreprise sans nom';
  const secteur = VALID_SECTEUR_CODES.has(fiche.secteur as never) ? fiche.secteur : 'pme';
  const statut = VALID_STATUT_VALUES.has(fiche.statut as never) ? fiche.statut : 'À contacter';
  const dateAjout = clampString(fiche.dateAjout, 64) || new Date().toISOString();

  const doc: SanitizedFicheDoc = {
    ownerId: cleanOwnerId,
    id: cleanId,
    societe,
    secteur,
    ville: clampString(fiche.ville, 100),
    telephone: clampString(fiche.telephone, 30),
    email: clampString(fiche.email, 160),
    contact: clampString(fiche.contact, 160),
    role: clampString(fiche.role, 120),
    source: clampString(fiche.source, 500),
    effectif: clampString(fiche.effectif, 20),
    statut,
    dateAjout,
  };

  if (cleanNumero) {
    doc.numeroFiche = cleanNumero;
  }
  if (Array.isArray(fiche.telephonesSupplementaires)) {
    doc.telephonesSupplementaires = sanitizeStringArray(fiche.telephonesSupplementaires, 10, 30);
  }
  if (Array.isArray(fiche.emailsSupplementaires)) {
    doc.emailsSupplementaires = sanitizeStringArray(fiche.emailsSupplementaires, 10, 160);
  }
  if (typeof fiche.siteWeb === 'string') {
    doc.siteWeb = clampString(fiche.siteWeb, 500);
  }
  if (typeof fiche.verifieWeb === 'boolean') {
    doc.verifieWeb = fiche.verifieWeb;
  }
  if (Array.isArray(fiche.pistesEnrichissement)) {
    doc.pistesEnrichissement = sanitizeStringArray(fiche.pistesEnrichissement, 15, 250);
  }

  return doc;
}

export function sanitizeSkillPayload(ownerId: string, skill: EmailSkillLike): SanitizedEmailSkillDoc {
  const cleanOwnerId = sanitizeDocId(ownerId, 'user');
  const cleanId = sanitizeDocId(skill.id, 'skill');
  const rawNom = clampString(skill.nom?.trim?.() ?? '', 120);
  const nom = rawNom.length >= 1 ? rawNom : 'Skill personnalisé';

  const doc: SanitizedEmailSkillDoc = {
    ownerId: cleanOwnerId,
    id: cleanId,
    nom,
    description: clampString(skill.description, 300),
    role: clampString(skill.role, 200),
    regles: clampString(skill.regles, 4000),
    ctaStyle: clampString(skill.ctaStyle, 300),
  };

  if (typeof skill.isBuiltin === 'boolean') {
    doc.isBuiltin = skill.isBuiltin;
  }

  return doc;
}

export function sanitizeAppUserPayload(input: AppUserLike): SanitizedAppUserDoc {
  const cleanUid = sanitizeDocId(input.uid, 'usr');
  const cleanCreatedBy = sanitizeDocId(input.createdBy, 'admin');
  const rawEmail = clampString((input.email || '').trim().toLowerCase(), 160);
  const email = rawEmail.length >= 3 ? rawEmail : 'user@orangepro.ma';
  const rawName = clampString((input.displayName || '').trim(), 120);
  const displayName = rawName.length >= 1 ? rawName : email.split('@')[0] || 'Utilisateur';
  const role: 'commercial' | 'manager' = VALID_MANAGED_ROLES.has(input.role as never)
    ? (input.role as 'commercial' | 'manager')
    : 'commercial';

  return {
    uid: cleanUid,
    email,
    displayName,
    role,
    zone: clampString((input.zone || '').trim(), 100),
    active: Boolean(input.active),
    createdBy: cleanCreatedBy,
  };
}

export const VALID_TEAM_ROLES = new Set(['super_admin', 'manager', 'commercial'] as const);
export const VALID_ORANGE_TIERS = new Set(['Grand Compte', 'PME', 'TPE / Libéral'] as const);
export const VALID_PAYOUT_STATUSES = new Set(['En attente', 'Validé', 'Versé'] as const);

export interface TeamStatLike {
  uid: string;
  displayName: string;
  role: string;
  zone: string;
  active: boolean;
  totalProspects: number;
  totalQualified: number;
  totalContracts: number;
  totalPayoutMad: number;
  xp: number;
  unlockedCount: number;
  manualBadges?: string[];
  monthlyHistory?: string[];
  avatarDataUrl?: string;
}

export interface SanitizedTeamStatDoc {
  uid: string;
  orgScope: 'orange_pro_team';
  displayName: string;
  role: 'super_admin' | 'manager' | 'commercial';
  zone: string;
  active: boolean;
  totalProspects: number;
  totalQualified: number;
  totalContracts: number;
  totalPayoutMad: number;
  xp: number;
  unlockedCount: number;
  manualBadges: string[];
  monthlyHistory: string[];
  avatarDataUrl?: string;
}

export function sanitizeTeamStatPayload(input: TeamStatLike): SanitizedTeamStatDoc {
  const cleanUid = sanitizeDocId(input.uid, 'usr');
  const rawName = clampString((input.displayName || '').trim(), 120);
  const displayName = rawName.length >= 1 ? rawName : 'Collaborateur';
  const role: 'super_admin' | 'manager' | 'commercial' = VALID_TEAM_ROLES.has(input.role as never)
    ? (input.role as 'super_admin' | 'manager' | 'commercial')
    : 'commercial';

  const clampInt = (n: unknown, maxVal: number) =>
    Math.min(maxVal, Math.max(0, Math.round(Number(n) || 0)));

  const doc: SanitizedTeamStatDoc = {
    uid: cleanUid,
    orgScope: 'orange_pro_team',
    displayName,
    role,
    zone: clampString((input.zone || '').trim(), 100),
    active: Boolean(input.active),
    totalProspects: clampInt(input.totalProspects, 100000),
    totalQualified: clampInt(input.totalQualified, 100000),
    totalContracts: clampInt(input.totalContracts, 100000),
    totalPayoutMad: clampInt(input.totalPayoutMad, 100000000),
    xp: clampInt(input.xp, 10000000),
    unlockedCount: clampInt(input.unlockedCount, 100),
    manualBadges: sanitizeStringArray(input.manualBadges ?? [], 20, 64),
    monthlyHistory: sanitizeStringArray(input.monthlyHistory ?? [], 24, 40),
  };

  if (typeof input.avatarDataUrl === 'string') {
    doc.avatarDataUrl = sanitizeAvatarDataUrl(input.avatarDataUrl);
  }

  return doc;
}

export interface SignedContractLike {
  id: string;
  ownerId: string;
  ownerName: string;
  ficheId: string;
  numeroFiche?: string;
  societe: string;
  ville: string;
  secteur: string;
  produitOrangePro: string;
  tier: string;
  effectif: string;
  payoutMad: number;
  payoutStatus: string;
  signedAt: string;
}

export interface SanitizedSignedContractDoc {
  id: string;
  orgScope: 'orange_pro_team';
  ownerId: string;
  ownerName: string;
  ficheId: string;
  numeroFiche: string;
  societe: string;
  ville: string;
  secteur: string;
  produitOrangePro: string;
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  effectif: string;
  payoutMad: number;
  payoutStatus: 'En attente' | 'Validé' | 'Versé';
  signedAt: string;
}

export function sanitizeSignedContractPayload(
  input: SignedContractLike
): SanitizedSignedContractDoc {
  const cleanId = sanitizeDocId(input.id, 'ctr');
  const cleanOwnerId = sanitizeDocId(input.ownerId, 'usr');
  const cleanFicheId = sanitizeDocId(input.ficheId, 'op');
  const rawOwnerName = clampString((input.ownerName || '').trim(), 120);
  const rawSociete = clampString((input.societe || '').trim(), 200);
  const rawProduit = clampString((input.produitOrangePro || '').trim(), 200);
  const secteur = VALID_SECTEUR_CODES.has(input.secteur as never) ? input.secteur : 'pme';
  const tier: 'Grand Compte' | 'PME' | 'TPE / Libéral' = VALID_ORANGE_TIERS.has(input.tier as never)
    ? (input.tier as 'Grand Compte' | 'PME' | 'TPE / Libéral')
    : 'PME';
  const payoutStatus: 'En attente' | 'Validé' | 'Versé' = VALID_PAYOUT_STATUSES.has(
    input.payoutStatus as never
  )
    ? (input.payoutStatus as 'En attente' | 'Validé' | 'Versé')
    : 'En attente';

  return {
    id: cleanId,
    orgScope: 'orange_pro_team',
    ownerId: cleanOwnerId,
    ownerName: rawOwnerName.length >= 1 ? rawOwnerName : 'Collaborateur',
    ficheId: cleanFicheId,
    numeroFiche: sanitizeNumeroFiche(input.numeroFiche) || '',
    societe: rawSociete.length >= 1 ? rawSociete : 'Client Orange Pro',
    ville: clampString((input.ville || '').trim(), 100),
    secteur,
    produitOrangePro: rawProduit.length >= 1 ? rawProduit : 'Pack Orange Pro',
    tier,
    effectif: clampString((input.effectif || '').trim(), 20),
    payoutMad: Math.min(10000000, Math.max(0, Math.round(Number(input.payoutMad) || 0))),
    payoutStatus,
    signedAt: clampString(input.signedAt, 64) || new Date().toISOString(),
  };
}

export interface ApiKeyConfigLike {
  provider: string;
  key: string;
  label?: string;
  active?: boolean;
  updatedBy: string;
}

export interface SanitizedApiKeyConfigDoc {
  provider: string;
  key: string;
  label: string;
  active: boolean;
  updatedBy: string;
}

export function sanitizeProviderId(raw: unknown): string {
  const base = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const cleaned = base
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return cleaned.length >= 1 ? cleaned : 'custom';
}

export function sanitizeApiKeyConfigPayload(input: ApiKeyConfigLike): SanitizedApiKeyConfigDoc {
  const provider = sanitizeProviderId(input.provider);
  const cleanKey = clampString((input.key || '').trim(), 512);
  const rawLabel = clampString((input.label || '').trim(), 120);
  const label = rawLabel.length >= 1 ? rawLabel : provider.toUpperCase();
  const updatedBy = sanitizeDocId(input.updatedBy, 'admin');

  return {
    provider,
    key: cleanKey,
    label,
    active: input.active !== false,
    updatedBy,
  };
}

export function serializeDocCanonical(doc: Record<string, unknown>): string {
  const keys = Object.keys(doc).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of keys) {
    const val = doc[key];
    if (val !== undefined) {
      normalized[key] = val;
    }
  }
  return JSON.stringify(normalized);
}

export interface SyncDiff<T extends { id: string }> {
  toCreate: T[];
  toUpdate: Array<{ id: string; next: T; statusOnly: boolean }>;
  toDelete: string[];
}

export function computeCollectionSyncDiff<T extends { id: string; statut?: string }>(
  knownById: Map<string, { hash: string; doc: T }>,
  nextDocs: T[]
): SyncDiff<T> {
  const toCreate: T[] = [];
  const toUpdate: Array<{ id: string; next: T; statusOnly: boolean }> = [];
  const nextIds = new Set<string>();

  for (const doc of nextDocs) {
    if (nextIds.has(doc.id)) continue;
    nextIds.add(doc.id);

    const nextHash = serializeDocCanonical(doc as unknown as Record<string, unknown>);
    const prev = knownById.get(doc.id);

    if (!prev) {
      toCreate.push(doc);
    } else if (prev.hash !== nextHash) {
      // Detect pure status transition (matches Action 1 in firestore.rules)
      const prevWithoutStatus = { ...prev.doc, statut: doc.statut };
      const statusOnly =
        typeof doc.statut === 'string' &&
        doc.statut !== prev.doc.statut &&
        serializeDocCanonical(prevWithoutStatus as unknown as Record<string, unknown>) === nextHash;

      toUpdate.push({ id: doc.id, next: doc, statusOnly });
    }
  }

  const toDelete: string[] = [];
  for (const existingId of knownById.keys()) {
    if (!nextIds.has(existingId)) {
      toDelete.push(existingId);
    }
  }

  return { toCreate, toUpdate, toDelete };
}
