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
  statutUpdatedAt?: string;
  prochaineRelanceAt?: string;
  rdvAt?: string;
  rdvLieu?: string;
  assignedByUid?: string;
  assignedByName?: string;
  assignedAt?: string;
  restoredByName?: string;
  restoredAt?: string;
  restoredReason?: string;
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
  dismissedDedupKeys?: string[];
  includePhoneOnlyDedup?: boolean;
  legalRaisonSociale?: string;
  legalIce?: string;
  legalAdresse?: string;
  legalTelephone?: string;
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
  dismissedDedupKeys?: string[];
  includePhoneOnlyDedup?: boolean;
  legalRaisonSociale?: string;
  legalIce?: string;
  legalAdresse?: string;
  legalTelephone?: string;
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
  statutUpdatedAt?: string;
  prochaineRelanceAt?: string;
  rdvAt?: string;
  rdvLieu?: string;
  assignedByUid?: string;
  assignedByName?: string;
  assignedAt?: string;
  restoredByName?: string;
  restoredAt?: string;
  restoredReason?: string;
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

export const VALID_ACTIVITE_TYPES = new Set([
  'appel',
  'whatsapp',
  'email',
  'visite',
  'note',
  'rdv',
  'devis',
  'statut',
  'attribution',
  'acces',
  'modification',
  'restitution',
  'signature',
] as const);

export type ActiviteType =
  | 'appel'
  | 'whatsapp'
  | 'email'
  | 'visite'
  | 'note'
  | 'rdv'
  | 'devis'
  | 'statut'
  | 'attribution'
  | 'acces'
  | 'modification'
  | 'restitution'
  | 'signature';

export const VALID_ACTIVITE_RESULTATS = new Set([
  'joint',
  'pas_de_reponse',
  'rappeler',
  'rdv_fixe',
  'refus',
  'autre',
  'vide',
] as const);

export type ActiviteResultat =
  | 'joint'
  | 'pas_de_reponse'
  | 'rappeler'
  | 'rdv_fixe'
  | 'refus'
  | 'autre'
  | 'vide';

export interface ActiviteLike {
  id: string;
  ownerId?: string;
  ficheId?: string;
  type: string;
  resultat: string;
  texte: string;
  auteurNom: string;
  auteurUid?: string;
  auteurRole?: string;
  createdAtIso?: string;
  rdvAt?: string;
  rdvLieu?: string;
  prochaineRelanceAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SanitizedActiviteDoc {
  id: string;
  ownerId: string;
  ficheId: string;
  type: ActiviteType;
  resultat: ActiviteResultat;
  texte: string;
  auteurNom: string;
  auteurUid?: string;
  auteurRole?: string;
  createdAtIso?: string;
  rdvAt?: string;
  rdvLieu?: string;
  prochaineRelanceAt?: string;
}

export const VALID_CLOUD_NOTIFICATION_KINDS = new Set([
  'fiche_assigned',
  'fiche_accessed',
  'fiche_restored',
  'fiche_updated',
  'contract_signed',
  'contract_status_changed',
  'direct_message',
  'coaching_invite',
] as const);

export type CloudNotificationKind =
  | 'fiche_assigned'
  | 'fiche_accessed'
  | 'fiche_restored'
  | 'fiche_updated'
  | 'contract_signed'
  | 'contract_status_changed'
  | 'direct_message'
  | 'coaching_invite';

export interface CloudNotificationLike {
  id?: string;
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderRole?: string;
  kind: string;
  title: string;
  message: string;
  ficheId?: string;
  ficheOwnerId?: string;
  numeroFiche?: string;
  societe?: string;
  payoutStatus?: string;
  payoutMad?: number;
  targetTab?: 'crm' | 'team' | 'badges';
  read?: boolean;
  createdAtIso?: string;
}

export interface SanitizedCloudNotificationDoc {
  id: string;
  orgScope: 'orange_pro_team';
  recipientUid: string;
  senderUid: string;
  senderName: string;
  senderRole?: string;
  kind: CloudNotificationKind;
  title: string;
  message: string;
  ficheId?: string;
  ficheOwnerId?: string;
  numeroFiche?: string;
  societe?: string;
  payoutStatus?: 'En attente' | 'Validé' | 'Versé' | 'Refusé';
  payoutMad?: number;
  targetTab?: 'crm' | 'team' | 'badges';
  read: boolean;
  createdAtIso: string;
}

export const VALID_AUDIT_ACTIONS = new Set([
  'created',
  'field_updated',
  'status_changed',
  'assigned',
  'restored',
  'signed',
  'accessed',
  'activity_logged',
  'rdv_scheduled',
  'quote_generated',
  'web_verified',
  'enriched',
] as const);

export type FicheAuditAction =
  | 'created'
  | 'field_updated'
  | 'status_changed'
  | 'assigned'
  | 'restored'
  | 'signed'
  | 'accessed'
  | 'activity_logged'
  | 'rdv_scheduled'
  | 'quote_generated'
  | 'web_verified'
  | 'enriched';

export interface FicheAuditLogLike {
  id?: string;
  ficheId?: string;
  ownerId?: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole?: string;
  createdAtIso?: string;
}

export interface SanitizedFicheAuditLogDoc {
  id: string;
  ficheId: string;
  ownerId: string;
  action: FicheAuditAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole?: string;
  createdAtIso: string;
}

export interface DirectChatChannelLike {
  collabUid: string;
  collabName: string;
  collabEmail?: string;
  collabZone?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  lastSenderUid?: string;
  lastSenderName?: string;
  unreadByAdmin?: number;
  unreadByCollab?: number;
}

export interface SanitizedDirectChatChannelDoc {
  collabUid: string;
  orgScope: 'orange_pro_team';
  collabName: string;
  collabEmail?: string;
  collabZone?: string;
  lastMessageText: string;
  lastMessageAt: string;
  lastSenderUid: string;
  lastSenderName?: string;
  unreadByAdmin: number;
  unreadByCollab: number;
}

export interface DirectChatMessageLike {
  id?: string;
  collabUid: string;
  senderUid: string;
  senderName: string;
  senderRole?: string;
  text: string;
  createdAtIso?: string;
}

export interface SanitizedDirectChatMessageDoc {
  id: string;
  collabUid: string;
  orgScope: 'orange_pro_team';
  senderUid: string;
  senderName: string;
  senderRole?: string;
  text: string;
  createdAtIso: string;
}

export const VALID_COACHING_STATUSES = new Set([
  'idle',
  'collab_ready',
  'live',
  'ended',
] as const);

export type CoachingSessionStatus = 'idle' | 'collab_ready' | 'live' | 'ended';

export interface CoachingSessionLike {
  collabUid: string;
  collabName: string;
  status: string;
  collabConsentActive?: boolean;
  adminUid?: string;
  adminName?: string;
  adminPttActive?: boolean;
  offerSdp?: string;
  answerSdp?: string;
  updatedAtIso?: string;
}

export interface SanitizedCoachingSessionDoc {
  collabUid: string;
  orgScope: 'orange_pro_team';
  collabName: string;
  status: CoachingSessionStatus;
  collabConsentActive: boolean;
  adminUid?: string;
  adminName?: string;
  adminPttActive?: boolean;
  offerSdp?: string;
  answerSdp?: string;
  updatedAtIso: string;
}

export interface CoachingCandidateLike {
  id?: string;
  senderUid: string;
  fromRole: 'admin' | 'collab';
  candidateJson: string;
  createdAtIso?: string;
}

export interface SanitizedCoachingCandidateDoc {
  id: string;
  senderUid: string;
  fromRole: 'admin' | 'collab';
  candidateJson: string;
  createdAtIso: string;
}

export const VALID_MANAGED_ROLES = new Set([
  'commercial',
  'grand_compte',
  'team_lead',
  'manager',
] as const);

export type SanitizedManagedRole = 'commercial' | 'grand_compte' | 'team_lead' | 'manager';
export type SanitizedTeamRole = 'super_admin' | SanitizedManagedRole;

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
  role: SanitizedManagedRole;
  zone: string;
  active: boolean;
  createdBy: string;
}

const utf8Encoder = new TextEncoder();

export function clampUtf8Bytes(value: unknown, maxBytes: number, fallback = ''): string {
  const str = typeof value === 'string' ? value : fallback;
  if (maxBytes <= 0) return '';
  if (utf8Encoder.encode(str).length <= maxBytes) return str;
  let bytes = 0;
  let out = '';
  for (const ch of str) {
    const chBytes = utf8Encoder.encode(ch).length;
    if (bytes + chBytes > maxBytes) break;
    out += ch;
    bytes += chBytes;
  }
  return out;
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  return clampUtf8Bytes(value, maxLen, fallback);
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
    const trimmed = clampUtf8Bytes(item.trim(), maxItemLen);
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
  if (Array.isArray(input.dismissedDedupKeys)) {
    doc.dismissedDedupKeys = sanitizeStringArray(input.dismissedDedupKeys, 100, 200);
  }
  if (typeof input.includePhoneOnlyDedup === 'boolean') {
    doc.includePhoneOnlyDedup = input.includePhoneOnlyDedup;
  }
  if (typeof input.legalRaisonSociale === 'string' && input.legalRaisonSociale.trim().length > 0) {
    doc.legalRaisonSociale = clampString(input.legalRaisonSociale.trim(), 200);
  }
  if (typeof input.legalIce === 'string' && input.legalIce.trim().length > 0) {
    doc.legalIce = clampString(input.legalIce.trim(), 30);
  }
  if (typeof input.legalAdresse === 'string' && input.legalAdresse.trim().length > 0) {
    doc.legalAdresse = clampString(input.legalAdresse.trim(), 300);
  }
  if (typeof input.legalTelephone === 'string' && input.legalTelephone.trim().length > 0) {
    doc.legalTelephone = clampString(input.legalTelephone.trim(), 30);
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
  if (typeof fiche.statutUpdatedAt === 'string' && fiche.statutUpdatedAt.trim().length > 0) {
    doc.statutUpdatedAt = clampString(fiche.statutUpdatedAt.trim(), 64);
  }
  if (typeof fiche.prochaineRelanceAt === 'string' && fiche.prochaineRelanceAt.trim().length > 0) {
    doc.prochaineRelanceAt = clampString(fiche.prochaineRelanceAt.trim(), 64);
  }
  if (typeof fiche.rdvAt === 'string' && fiche.rdvAt.trim().length > 0) {
    doc.rdvAt = clampString(fiche.rdvAt.trim(), 64);
  }
  if (typeof fiche.rdvLieu === 'string' && fiche.rdvLieu.trim().length > 0) {
    doc.rdvLieu = clampString(fiche.rdvLieu.trim(), 160);
  }
  if (typeof fiche.assignedByUid === 'string' && fiche.assignedByUid.trim().length > 0) {
    doc.assignedByUid = sanitizeDocId(fiche.assignedByUid, 'user');
  }
  if (typeof fiche.assignedByName === 'string' && fiche.assignedByName.trim().length > 0) {
    doc.assignedByName = clampString(fiche.assignedByName.trim(), 120);
  }
  if (typeof fiche.assignedAt === 'string' && fiche.assignedAt.trim().length > 0) {
    doc.assignedAt = clampString(fiche.assignedAt.trim(), 64);
  }
  if (typeof fiche.restoredByName === 'string' && fiche.restoredByName.trim().length > 0) {
    doc.restoredByName = clampString(fiche.restoredByName.trim(), 120);
  }
  if (typeof fiche.restoredAt === 'string' && fiche.restoredAt.trim().length > 0) {
    doc.restoredAt = clampString(fiche.restoredAt.trim(), 64);
  }
  if (typeof fiche.restoredReason === 'string' && fiche.restoredReason.trim().length > 0) {
    doc.restoredReason = clampString(fiche.restoredReason.trim(), 300);
  }

  return doc;
}

export function sanitizeActivitePayload(
  ownerId: string,
  ficheId: string,
  input: ActiviteLike
): SanitizedActiviteDoc {
  const cleanOwnerId = sanitizeDocId(ownerId, 'user');
  const cleanFicheId = sanitizeDocId(ficheId, 'op');
  const cleanId = sanitizeDocId(input.id, 'act');

  const rawType = clampString(input.type, 32).toLowerCase();
  const type: ActiviteType = VALID_ACTIVITE_TYPES.has(rawType as never)
    ? (rawType as ActiviteType)
    : 'note';

  const rawResultat = clampString(input.resultat, 32).toLowerCase();
  const resultat: ActiviteResultat = VALID_ACTIVITE_RESULTATS.has(rawResultat as never)
    ? (rawResultat as ActiviteResultat)
    : 'vide';

  const rawTexte = clampString(input.texte?.trim?.() ?? '', 1000);
  const rawAuteur = clampString(input.auteurNom?.trim?.() ?? '', 120);
  const auteurNom = rawAuteur.length >= 1 ? rawAuteur : 'Collaborateur';

  const doc: SanitizedActiviteDoc = {
    id: cleanId,
    ownerId: cleanOwnerId,
    ficheId: cleanFicheId,
    type,
    resultat,
    texte: rawTexte,
    auteurNom,
    createdAtIso: clampString(input.createdAtIso?.trim?.() ?? '', 64) || new Date().toISOString(),
  };

  if (typeof input.auteurUid === 'string' && input.auteurUid.trim().length > 0) {
    doc.auteurUid = sanitizeDocId(input.auteurUid, 'user');
  }
  if (typeof input.auteurRole === 'string' && input.auteurRole.trim().length > 0) {
    doc.auteurRole = clampString(input.auteurRole.trim(), 40);
  }
  if (typeof input.rdvAt === 'string' && input.rdvAt.trim().length > 0) {
    doc.rdvAt = clampString(input.rdvAt.trim(), 64);
  }
  if (typeof input.rdvLieu === 'string' && input.rdvLieu.trim().length > 0) {
    doc.rdvLieu = clampString(input.rdvLieu.trim(), 160);
  }
  if (typeof input.prochaineRelanceAt === 'string' && input.prochaineRelanceAt.trim().length > 0) {
    doc.prochaineRelanceAt = clampString(input.prochaineRelanceAt.trim(), 64);
  }

  return doc;
}

export function sanitizeCloudNotificationPayload(
  input: CloudNotificationLike
): SanitizedCloudNotificationDoc {
  const cleanId = sanitizeDocId(
    input.id || `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    'ntf'
  );
  const recipientUid = sanitizeDocId(input.recipientUid, 'user');
  const senderUid = sanitizeDocId(input.senderUid, 'user');
  const rawSenderName = clampString(input.senderName?.trim?.() ?? '', 120);
  const senderName = rawSenderName.length >= 1 ? rawSenderName : 'Collaborateur';
  const rawKind = clampString(input.kind, 40).toLowerCase();
  const kind: CloudNotificationKind = VALID_CLOUD_NOTIFICATION_KINDS.has(rawKind as never)
    ? (rawKind as CloudNotificationKind)
    : 'fiche_updated';
  const rawTitle = clampString(input.title?.trim?.() ?? '', 200);
  const title = rawTitle.length >= 1 ? rawTitle : 'Notification CRM';
  const message = clampString(input.message?.trim?.() ?? '', 600);
  const createdAtIso =
    clampString(input.createdAtIso?.trim?.() ?? '', 64) || new Date().toISOString();

  const doc: SanitizedCloudNotificationDoc = {
    id: cleanId,
    orgScope: 'orange_pro_team',
    recipientUid,
    senderUid,
    senderName,
    kind,
    title,
    message,
    read: Boolean(input.read),
    createdAtIso,
  };

  if (typeof input.senderRole === 'string' && input.senderRole.trim().length > 0) {
    doc.senderRole = clampString(input.senderRole.trim(), 40);
  }
  if (typeof input.ficheId === 'string' && input.ficheId.trim().length > 0) {
    doc.ficheId = clampString(input.ficheId.trim(), 128);
  }
  if (typeof input.ficheOwnerId === 'string' && input.ficheOwnerId.trim().length > 0) {
    doc.ficheOwnerId = clampString(input.ficheOwnerId.trim(), 128);
  }
  if (typeof input.numeroFiche === 'string' && input.numeroFiche.trim().length > 0) {
    doc.numeroFiche = clampString(input.numeroFiche.trim(), 32);
  }
  if (typeof input.societe === 'string' && input.societe.trim().length > 0) {
    doc.societe = clampString(input.societe.trim(), 200);
  }
  if (typeof input.payoutStatus === 'string' && VALID_PAYOUT_STATUSES.has(input.payoutStatus as never)) {
    doc.payoutStatus = input.payoutStatus as 'En attente' | 'Validé' | 'Versé' | 'Refusé';
  }
  if (typeof input.payoutMad === 'number' && Number.isFinite(input.payoutMad)) {
    doc.payoutMad = Math.min(10000000, Math.max(0, Math.round(input.payoutMad)));
  }
  if (input.targetTab === 'crm' || input.targetTab === 'team' || input.targetTab === 'badges') {
    doc.targetTab = input.targetTab;
  }

  return doc;
}

export function sanitizeFicheAuditLogPayload(
  ownerId: string,
  ficheId: string,
  input: FicheAuditLogLike
): SanitizedFicheAuditLogDoc {
  const cleanOwnerId = sanitizeDocId(ownerId, 'user');
  const cleanFicheId = sanitizeDocId(ficheId, 'op');
  const cleanId = sanitizeDocId(
    input.id || `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    'aud'
  );
  const rawAction = clampString(input.action, 40).toLowerCase();
  const action: FicheAuditAction = VALID_AUDIT_ACTIONS.has(rawAction as never)
    ? (rawAction as FicheAuditAction)
    : 'field_updated';
  const rawSummary = clampString(input.summary?.trim?.() ?? '', 600);
  const summary = rawSummary.length >= 1 ? rawSummary : 'Modification enregistrée';
  const rawActorName = clampString(input.actorName?.trim?.() ?? '', 120);
  const actorName = rawActorName.length >= 1 ? rawActorName : 'Collaborateur';

  const doc: SanitizedFicheAuditLogDoc = {
    id: cleanId,
    ficheId: cleanFicheId,
    ownerId: cleanOwnerId,
    action,
    summary,
    actorUid: sanitizeDocId(input.actorUid, 'user'),
    actorName,
    createdAtIso: clampString(input.createdAtIso?.trim?.() ?? '', 64) || new Date().toISOString(),
  };

  if (typeof input.field === 'string' && input.field.trim().length > 0) {
    doc.field = clampString(input.field.trim(), 80);
  }
  if (typeof input.oldValue === 'string') {
    doc.oldValue = clampString(input.oldValue.trim(), 300);
  }
  if (typeof input.newValue === 'string') {
    doc.newValue = clampString(input.newValue.trim(), 300);
  }
  if (typeof input.actorRole === 'string' && input.actorRole.trim().length > 0) {
    doc.actorRole = clampString(input.actorRole.trim(), 40);
  }

  return doc;
}

export function sanitizeDirectChatChannelPayload(
  input: DirectChatChannelLike
): SanitizedDirectChatChannelDoc {
  const cleanCollabUid = sanitizeDocId(input.collabUid, 'usr');
  const rawName = clampString((input.collabName || '').trim(), 120);
  const doc: SanitizedDirectChatChannelDoc = {
    collabUid: cleanCollabUid,
    orgScope: 'orange_pro_team',
    collabName: rawName.length >= 1 ? rawName : 'Collaborateur',
    lastMessageText: clampString((input.lastMessageText || '').trim(), 500),
    lastMessageAt: clampString((input.lastMessageAt || '').trim(), 64) || new Date().toISOString(),
    lastSenderUid: input.lastSenderUid ? sanitizeDocId(input.lastSenderUid, 'usr') : '',
    unreadByAdmin: Math.min(10000, Math.max(0, Math.round(Number(input.unreadByAdmin) || 0))),
    unreadByCollab: Math.min(10000, Math.max(0, Math.round(Number(input.unreadByCollab) || 0))),
  };
  if (typeof input.collabEmail === 'string' && input.collabEmail.trim().length > 0) {
    doc.collabEmail = clampString(input.collabEmail.trim().toLowerCase(), 160);
  }
  if (typeof input.collabZone === 'string' && input.collabZone.trim().length > 0) {
    doc.collabZone = clampString(input.collabZone.trim(), 100);
  }
  if (typeof input.lastSenderName === 'string' && input.lastSenderName.trim().length > 0) {
    doc.lastSenderName = clampString(input.lastSenderName.trim(), 120);
  }
  return doc;
}

export function sanitizeDirectChatMessagePayload(
  input: DirectChatMessageLike
): SanitizedDirectChatMessageDoc {
  const cleanId = sanitizeDocId(
    input.id || `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    'msg'
  );
  const rawSenderName = clampString((input.senderName || '').trim(), 120);
  const rawText = clampString((input.text || '').trim(), 2000);
  const doc: SanitizedDirectChatMessageDoc = {
    id: cleanId,
    collabUid: sanitizeDocId(input.collabUid, 'usr'),
    orgScope: 'orange_pro_team',
    senderUid: sanitizeDocId(input.senderUid, 'usr'),
    senderName: rawSenderName.length >= 1 ? rawSenderName : 'Utilisateur',
    text: rawText.length >= 1 ? rawText : '...',
    createdAtIso: clampString((input.createdAtIso || '').trim(), 64) || new Date().toISOString(),
  };
  if (typeof input.senderRole === 'string' && input.senderRole.trim().length > 0) {
    doc.senderRole = clampString(input.senderRole.trim(), 40);
  }
  return doc;
}

export function sanitizeCoachingSessionPayload(
  input: CoachingSessionLike
): SanitizedCoachingSessionDoc {
  const rawStatus = clampString(input.status, 32).toLowerCase();
  const status: CoachingSessionStatus = VALID_COACHING_STATUSES.has(rawStatus as never)
    ? (rawStatus as CoachingSessionStatus)
    : 'idle';
  const rawName = clampString((input.collabName || '').trim(), 120);
  const doc: SanitizedCoachingSessionDoc = {
    collabUid: sanitizeDocId(input.collabUid, 'usr'),
    orgScope: 'orange_pro_team',
    collabName: rawName.length >= 1 ? rawName : 'Collaborateur',
    status,
    collabConsentActive: Boolean(input.collabConsentActive),
    updatedAtIso: clampString((input.updatedAtIso || '').trim(), 64) || new Date().toISOString(),
  };
  if (typeof input.adminUid === 'string') {
    doc.adminUid = input.adminUid.trim() ? sanitizeDocId(input.adminUid, 'usr') : '';
  }
  if (typeof input.adminName === 'string') {
    doc.adminName = clampString(input.adminName.trim(), 120);
  }
  if (typeof input.adminPttActive === 'boolean') {
    doc.adminPttActive = input.adminPttActive;
  }
  if (typeof input.offerSdp === 'string') {
    doc.offerSdp = clampString(input.offerSdp, 24000);
  }
  if (typeof input.answerSdp === 'string') {
    doc.answerSdp = clampString(input.answerSdp, 24000);
  }
  return doc;
}

export function sanitizeCoachingCandidatePayload(
  input: CoachingCandidateLike
): SanitizedCoachingCandidateDoc {
  const cleanId = sanitizeDocId(
    input.id || `ice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    'ice'
  );
  return {
    id: cleanId,
    senderUid: sanitizeDocId(input.senderUid, 'usr'),
    fromRole: input.fromRole === 'admin' ? 'admin' : 'collab',
    candidateJson: clampString(input.candidateJson || '{}', 2000),
    createdAtIso: clampString((input.createdAtIso || '').trim(), 64) || new Date().toISOString(),
  };
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
  const role: SanitizedManagedRole = VALID_MANAGED_ROLES.has(input.role as never)
    ? (input.role as SanitizedManagedRole)
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

export const VALID_TEAM_ROLES = new Set([
  'super_admin',
  'manager',
  'team_lead',
  'grand_compte',
  'commercial',
] as const);
export const VALID_ORANGE_TIERS = new Set(['Grand Compte', 'PME', 'TPE / Libéral'] as const);
export const VALID_PAYOUT_STATUSES = new Set(['En attente', 'Validé', 'Versé', 'Refusé'] as const);
export type PayoutStatus = 'En attente' | 'Validé' | 'Versé' | 'Refusé';

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
  role: SanitizedTeamRole;
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
  const role: SanitizedTeamRole = VALID_TEAM_ROLES.has(input.role as never)
    ? (input.role as SanitizedTeamRole)
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

export const TEAM_STAT_REQUIRED_DATA_KEYS = [
  'uid',
  'orgScope',
  'displayName',
  'role',
  'zone',
  'active',
  'totalProspects',
  'totalQualified',
  'totalContracts',
  'totalPayoutMad',
  'xp',
  'unlockedCount',
  'manualBadges',
  'monthlyHistory',
] as const;

export const TEAM_STAT_ALLOWED_KEYS = new Set<string>([
  ...TEAM_STAT_REQUIRED_DATA_KEYS,
  'avatarDataUrl',
  'createdAt',
  'updatedAt',
]);

export function inspectTeamStatDocKeys(existingData: Record<string, unknown>): {
  missingDataKeys: string[];
  extraKeys: string[];
} {
  const missingDataKeys = TEAM_STAT_REQUIRED_DATA_KEYS.filter(
    (key) => !(key in existingData)
  );
  const extraKeys = Object.keys(existingData).filter(
    (key) => !TEAM_STAT_ALLOWED_KEYS.has(key)
  );
  return { missingDataKeys, extraKeys };
}

export function buildTeamStatRepairUpdatePayload(
  existingData: Record<string, unknown>,
  cleanDoc: SanitizedTeamStatDoc,
  sentinels: {
    updatedAtSentinel: unknown;
    createdAtSentinel: unknown;
    deleteFieldSentinel: unknown;
    hasValidCreatedAtTimestamp: boolean;
  }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...cleanDoc,
    updatedAt: sentinels.updatedAtSentinel,
  };
  if (!sentinels.hasValidCreatedAtTimestamp) {
    payload.createdAt = sentinels.createdAtSentinel;
  }
  const { extraKeys } = inspectTeamStatDocKeys(existingData);
  for (const extraKey of extraKeys) {
    payload[extraKey] = sentinels.deleteFieldSentinel;
  }
  return payload;
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
  referenceVirement?: string;
  refusMotif?: string;
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
  payoutStatus: 'En attente' | 'Validé' | 'Versé' | 'Refusé';
  signedAt: string;
  referenceVirement?: string;
  refusMotif?: string;
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
  const payoutStatus: 'En attente' | 'Validé' | 'Versé' | 'Refusé' = VALID_PAYOUT_STATUSES.has(
    input.payoutStatus as never
  )
    ? (input.payoutStatus as 'En attente' | 'Validé' | 'Versé' | 'Refusé')
    : 'En attente';

  const doc: SanitizedSignedContractDoc = {
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

  if (typeof input.referenceVirement === 'string' && input.referenceVirement.trim().length > 0) {
    doc.referenceVirement = clampString(input.referenceVirement.trim(), 80);
  }
  if (typeof input.refusMotif === 'string' && input.refusMotif.trim().length > 0) {
    doc.refusMotif = clampString(input.refusMotif.trim(), 200);
  }

  return doc;
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

export const VALID_DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet'] as const);
export const VALID_SESSION_STATUSES = new Set([
  'active',
  'closed',
  'disconnected_work_hours',
] as const);

export interface UserPresenceLike {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phonePro?: string;
  avatarDataUrl?: string;
  role: string;
  zone?: string;
  isOnline?: boolean;
  currentDevice?: string;
  devicesUsed?: string[];
  lastLoginAt?: string;
  lastLogoutAt?: string;
  lastSeenAt?: string;
  lastWorkDisconnectAt?: string;
  workHoursDisconnectCount?: number;
  workHoursDisconnectTimes?: string[];
  activeDateKey?: string;
  todayWorkedSeconds?: number;
  totalWorkedSeconds?: number;
  currentSessionId?: string;
}

export interface SanitizedUserPresenceDoc {
  uid: string;
  orgScope: 'orange_pro_team';
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  phonePro: string;
  avatarDataUrl: string;
  role: SanitizedTeamRole;
  zone: string;
  isOnline: boolean;
  currentDevice: string;
  devicesUsed: string[];
  lastLoginAt: string;
  lastLogoutAt: string;
  lastSeenAt: string;
  lastWorkDisconnectAt: string;
  workHoursDisconnectCount: number;
  workHoursDisconnectTimes: string[];
  activeDateKey: string;
  todayWorkedSeconds: number;
  totalWorkedSeconds: number;
  currentSessionId: string;
}

export function sanitizeUserPresencePayload(input: UserPresenceLike): SanitizedUserPresenceDoc {
  const cleanUid = sanitizeDocId(input.uid, 'usr');
  const rawEmail = clampString((input.email || '').trim().toLowerCase(), 160);
  const email = rawEmail.length >= 3 ? rawEmail : 'user@orangepro.ma';
  const rawName = clampString((input.displayName || '').trim(), 120);
  const displayName = rawName.length >= 1 ? rawName : email.split('@')[0] || 'Collaborateur';
  const role: SanitizedTeamRole = VALID_TEAM_ROLES.has(input.role as never)
    ? (input.role as SanitizedTeamRole)
    : 'commercial';

  const clampInt = (n: unknown, maxVal: number) =>
    Math.min(maxVal, Math.max(0, Math.round(Number(n) || 0)));

  return {
    uid: cleanUid,
    orgScope: 'orange_pro_team',
    email,
    displayName,
    firstName: clampString((input.firstName || '').trim(), 60),
    lastName: clampString((input.lastName || '').trim(), 60),
    phonePro: clampString((input.phonePro || '').trim(), 30),
    avatarDataUrl: sanitizeAvatarDataUrl(input.avatarDataUrl),
    role,
    zone: clampString((input.zone || '').trim(), 100),
    isOnline: Boolean(input.isOnline),
    currentDevice: clampString((input.currentDevice || '').trim(), 160),
    devicesUsed: sanitizeStringArray(input.devicesUsed ?? [], 12, 160),
    lastLoginAt: clampString((input.lastLoginAt || '').trim(), 64),
    lastLogoutAt: clampString((input.lastLogoutAt || '').trim(), 64),
    lastSeenAt: clampString((input.lastSeenAt || '').trim(), 64),
    lastWorkDisconnectAt: clampString((input.lastWorkDisconnectAt || '').trim(), 64),
    workHoursDisconnectCount: clampInt(input.workHoursDisconnectCount, 100000),
    workHoursDisconnectTimes: sanitizeStringArray(input.workHoursDisconnectTimes ?? [], 30, 80),
    activeDateKey: clampString((input.activeDateKey || '').trim(), 16),
    todayWorkedSeconds: clampInt(input.todayWorkedSeconds, 86400),
    totalWorkedSeconds: clampInt(input.totalWorkedSeconds, 100000000),
    currentSessionId: input.currentSessionId ? sanitizeDocId(input.currentSessionId, 'ses') : '',
  };
}

export const USER_PRESENCE_REQUIRED_DATA_KEYS = [
  'uid',
  'orgScope',
  'email',
  'displayName',
  'firstName',
  'lastName',
  'phonePro',
  'avatarDataUrl',
  'role',
  'zone',
  'isOnline',
  'currentDevice',
  'devicesUsed',
  'lastLoginAt',
  'lastLogoutAt',
  'lastSeenAt',
  'lastWorkDisconnectAt',
  'workHoursDisconnectCount',
  'workHoursDisconnectTimes',
  'activeDateKey',
  'todayWorkedSeconds',
  'totalWorkedSeconds',
  'currentSessionId',
] as const;

export const USER_PRESENCE_ALLOWED_KEYS = new Set<string>([
  ...USER_PRESENCE_REQUIRED_DATA_KEYS,
  'createdAt',
  'updatedAt',
]);

export function inspectUserPresenceDocKeys(existingData: Record<string, unknown>): {
  missingDataKeys: string[];
  extraKeys: string[];
} {
  const missingDataKeys = USER_PRESENCE_REQUIRED_DATA_KEYS.filter(
    (key) => !(key in existingData)
  );
  const extraKeys = Object.keys(existingData).filter(
    (key) => !USER_PRESENCE_ALLOWED_KEYS.has(key)
  );
  return { missingDataKeys, extraKeys };
}

export function buildUserPresenceRepairUpdatePayload(
  existingData: Record<string, unknown>,
  cleanDoc: SanitizedUserPresenceDoc,
  sentinels: {
    updatedAtSentinel: unknown;
    createdAtSentinel: unknown;
    deleteFieldSentinel: unknown;
    hasValidCreatedAtTimestamp: boolean;
  }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...cleanDoc,
    updatedAt: sentinels.updatedAtSentinel,
  };
  if (!sentinels.hasValidCreatedAtTimestamp) {
    payload.createdAt = sentinels.createdAtSentinel;
  }
  const { extraKeys } = inspectUserPresenceDocKeys(existingData);
  for (const extraKey of extraKeys) {
    payload[extraKey] = sentinels.deleteFieldSentinel;
  }
  return payload;
}

export interface AttendanceSessionLike {
  id: string;
  ownerId: string;
  dateKey: string;
  loginAt: string;
  lastSeenAt: string;
  logoutAt?: string;
  workedSeconds: number;
  deviceLabel: string;
  deviceType: string;
  status: string;
  disconnectReason?: string;
  disconnectedDuringWorkHours?: boolean;
}

export interface SanitizedAttendanceSessionDoc {
  id: string;
  ownerId: string;
  orgScope: 'orange_pro_team';
  dateKey: string;
  loginAt: string;
  lastSeenAt: string;
  logoutAt: string;
  workedSeconds: number;
  deviceLabel: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  status: 'active' | 'closed' | 'disconnected_work_hours';
  disconnectReason: string;
  disconnectedDuringWorkHours: boolean;
}

export function sanitizeAttendanceSessionPayload(
  input: AttendanceSessionLike
): SanitizedAttendanceSessionDoc {
  const id = sanitizeDocId(input.id, 'ses');
  const ownerId = sanitizeDocId(input.ownerId, 'usr');
  const rawDateKey = clampString((input.dateKey || '').trim(), 16);
  const dateKey = rawDateKey.length >= 8 ? rawDateKey : new Date().toISOString().slice(0, 10);
  const rawLogin = clampString((input.loginAt || '').trim(), 64) || new Date().toISOString();
  const rawSeen = clampString((input.lastSeenAt || '').trim(), 64) || rawLogin;
  const rawDevice = clampString((input.deviceLabel || '').trim(), 160) || 'Navigateur';
  const deviceType = VALID_DEVICE_TYPES.has(input.deviceType as never)
    ? (input.deviceType as 'desktop' | 'mobile' | 'tablet')
    : 'desktop';
  const status = VALID_SESSION_STATUSES.has(input.status as never)
    ? (input.status as 'active' | 'closed' | 'disconnected_work_hours')
    : 'active';

  return {
    id,
    ownerId,
    orgScope: 'orange_pro_team',
    dateKey,
    loginAt: rawLogin,
    lastSeenAt: rawSeen,
    logoutAt: clampString((input.logoutAt || '').trim(), 64),
    workedSeconds: Math.min(86400, Math.max(0, Math.round(Number(input.workedSeconds) || 0))),
    deviceLabel: rawDevice,
    deviceType,
    status,
    disconnectReason: clampString((input.disconnectReason || '').trim(), 80),
    disconnectedDuringWorkHours: Boolean(input.disconnectedDuringWorkHours),
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

export function computeCollectionSyncDiff<
  T extends { id: string; statut?: string; statutUpdatedAt?: string }
>(
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
      const prevWithoutStatus = {
        ...prev.doc,
        statut: doc.statut,
        statutUpdatedAt: doc.statutUpdatedAt,
      };
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

export interface FriendlyCloudError {
  code: 'permission-denied' | 'offline' | 'unavailable' | 'unauthenticated' | 'not-found' | 'failed-precondition' | 'unknown';
  shortTag: string;
  userMessage: string;
  retryable: boolean;
}

export function parseFriendlyCloudError(err: unknown): FriendlyCloudError {
  const rawBase = err instanceof Error ? err.message : String(err || '');
  let innerError = rawBase;
  let path = '';
  try {
    const parsed = JSON.parse(rawBase) as { error?: string; path?: string };
    if (parsed && typeof parsed.error === 'string') {
      innerError = parsed.error;
      if (typeof parsed.path === 'string') path = parsed.path;
    }
  } catch {
    // Not JSON
  }

  const lower = `${innerError} ${rawBase}`.toLowerCase();

  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return {
      code: 'permission-denied',
      shortTag: ' (permission-denied)',
      userMessage:
        'Accès refusé par Cloud Firestore. Vérifiez que votre email est bien vérifié et cliquez sur « Réessayer la synchro » pour rafraîchir votre jeton de sécurité.',
      retryable: true,
    };
  }
  if (lower.includes('client is offline') || lower.includes('network') || lower.includes('failed to get document')) {
    return {
      code: 'offline',
      shortTag: ' (hors-ligne)',
      userMessage:
        'Connexion Cloud Firestore interrompue ou bloquée par le réseau. Vérifiez votre accès internet puis cliquez sur « Réessayer la synchro ».',
      retryable: true,
    };
  }
  if (lower.includes('unavailable') || lower.includes('deadline-exceeded') || lower.includes('aborted')) {
    return {
      code: 'unavailable',
      shortTag: ' (réseau indisponible)',
      userMessage:
        'Service Cloud Firestore momentanément indisponible. Nouvelle tentative possible immédiatement.',
      retryable: true,
    };
  }
  if (lower.includes('unauthenticated')) {
    return {
      code: 'unauthenticated',
      shortTag: ' (session expirée)',
      userMessage: 'Votre session Firebase a expiré. Rafraîchissez la session ou reconnectez-vous.',
      retryable: true,
    };
  }
  if (lower.includes('failed-precondition')) {
    return {
      code: 'failed-precondition',
      shortTag: ' (précondition)',
      userMessage: `Condition Firestore non satisfaite${path ? ` sur ${path}` : ''}. Cliquez sur « Réessayer la synchro ».`,
      retryable: false,
    };
  }
  if (lower.includes('not-found')) {
    return {
      code: 'not-found',
      shortTag: ' (introuvable)',
      userMessage: `Document Cloud introuvable${path ? ` (${path})` : ''}.`,
      retryable: false,
    };
  }
  return {
    code: 'unknown',
    shortTag: '',
    userMessage: 'Erreur temporaire de synchronisation Cloud Firestore.',
    retryable: true,
  };
}

