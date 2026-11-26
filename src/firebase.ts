import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  linkWithCredential,
  updatePassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  collection,
  query,
  where,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  writeBatch,
  serverTimestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  sanitizeFichePayload,
  sanitizeSkillPayload,
  sanitizeWorkspacePayload,
  sanitizeAppUserPayload,
  sanitizeTeamStatPayload,
  sanitizeSignedContractPayload,
  sanitizeApiKeyConfigPayload,
  sanitizeUserPresencePayload,
  sanitizeAttendanceSessionPayload,
  sanitizeProviderId,
  sanitizeActivitePayload,
  type FicheLike,
  type EmailSkillLike,
  type WorkspaceLike,
  type TeamStatLike,
  type SignedContractLike,
  type ApiKeyConfigLike,
  type ActiviteLike,
  type SanitizedFicheDoc,
  type SanitizedEmailSkillDoc,
  type SanitizedSignedContractDoc,
  type SanitizedUserPresenceDoc,
  type SanitizedAttendanceSessionDoc,
  type SanitizedActiviteDoc,
  type SyncDiff,
} from './utils/firestoreSanitize';
import { normalizeManagedRole, type ManagedAppUser, type ManagedUserRole } from './utils/authAccess';
import type { TeamRole } from './utils/gamification';
import {
  buildDeviceHistoryList,
  buildWorkDisconnectEntry,
  splitFirstAndLastName,
  type ClientDeviceType,
} from './utils/attendance';

const app = getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

// CRITICAL: Pass the provisioned named firestoreDatabaseId from firebase-applet-config.json
// Enable auto-detect long polling so mobile Chrome / GitHub Pages / restrictive proxies never hang on WebChannel.
function createResilientFirestore(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createResilientFirestore();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    // Permission errors on /test/connection are expected and confirm live connectivity.
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function resendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) throw new Error('Aucun utilisateur connecté.');
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export async function setOrLinkAccountPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('Aucun compte connecté.');
  }
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  if (hasPasswordProvider) {
    await updatePassword(user, newPassword);
  } else {
    const credential = EmailAuthProvider.credential(user.email, newPassword);
    await linkWithCredential(user, credential);
  }
}

export async function updateOwnAuthDisplayName(displayName: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Aucun compte connecté.');
  }
  const cleanName = displayName.trim().slice(0, 120);
  if (!cleanName) return;
  await updateProfile(auth.currentUser, { displayName: cleanName });
}

export async function getCurrentUserIdToken(forceRefresh = false): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Vous devez être connecté pour utiliser le proxy IA sécurisé.');
  }
  return auth.currentUser.getIdToken(forceRefresh);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function getSecondaryProvisioningAuth() {
  const existing = getApps().find((a) => a.name === 'admin-user-provisioning');
  const secApp = existing || initializeApp(firebaseConfig, 'admin-user-provisioning');
  return getAuth(secApp);
}

export async function fetchAppUserProfile(uid: string): Promise<ManagedAppUser | null> {
  const path = `app_users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'app_users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid: snap.id,
      email: typeof d.email === 'string' ? d.email : '',
      displayName: typeof d.displayName === 'string' ? d.displayName : '',
      role: normalizeManagedRole(d.role),
      zone: typeof d.zone === 'string' ? d.zone : '',
      active: Boolean(d.active),
      createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function getAppUsersQuery(adminUid: string) {
  return query(collection(db, 'app_users'), where('createdBy', '==', adminUid));
}

export function getTeamStatsQuery() {
  return query(collection(db, 'team_stats'), where('orgScope', '==', 'orange_pro_team'));
}

export function getSignedContractsQuery(uid: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return query(collection(db, 'signed_contracts'), where('orgScope', '==', 'orange_pro_team'));
  }
  return query(collection(db, 'signed_contracts'), where('ownerId', '==', uid));
}

export type UserPresenceRecord = SanitizedUserPresenceDoc;
export type AttendanceSessionRecord = SanitizedAttendanceSessionDoc;

export function getUserPresenceListQuery() {
  return query(collection(db, 'user_presence'), where('orgScope', '==', 'orange_pro_team'));
}

export function getUserSessionsQuery(uid: string) {
  return query(collection(db, 'user_presence', uid, 'sessions'), where('orgScope', '==', 'orange_pro_team'));
}

export interface CloudApiKeyRecord {
  provider: string;
  label: string;
  key: string;
  active: boolean;
  updatedBy: string;
  updatedAt?: string;
}

export function getAdminApiKeysQuery(adminUid: string) {
  return query(collection(db, 'api_keys'), where('updatedBy', '==', adminUid));
}

export async function adminUpsertApiKey(
  adminUid: string,
  input: Omit<ApiKeyConfigLike, 'updatedBy'>
): Promise<CloudApiKeyRecord> {
  const clean = sanitizeApiKeyConfigPayload({
    ...input,
    updatedBy: adminUid,
  });
  const path = `api_keys/${clean.provider}`;
  const ref = doc(db, 'api_keys', clean.provider);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        label: clean.label,
        key: clean.key,
        active: clean.active,
        updatedBy: clean.updatedBy,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...clean,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminDeleteApiKey(provider: string): Promise<void> {
  const cleanProvider = sanitizeProviderId(provider);
  const path = `api_keys/${cleanProvider}`;
  try {
    await deleteDoc(doc(db, 'api_keys', cleanProvider));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Super-Admin-only user provisioning:
 * Creates a Firebase Auth Email/Password user via a secondary Firebase App instance
 * so the Super-Admin stays signed in, sends a verification email, signs out the secondary
 * auth instance, and writes the /app_users/{uid} authorization record in Firestore.
 */
export async function adminCreateManagedUser(params: {
  adminUid: string;
  displayName: string;
  email: string;
  password: string;
  role: ManagedUserRole;
  zone: string;
  phonePro?: string;
  initialManualBadges?: string[];
}): Promise<ManagedAppUser> {
  const secondaryAuth = getSecondaryProvisioningAuth();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.displayName.trim();

  let newUid = '';
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, params.password);
    newUid = cred.user.uid;
    try {
      await updateProfile(cred.user, { displayName: cleanName });
    } catch {
      // Non-fatal profile name update
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-fatal; user can also request resend on first login
    }
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // Ensure secondary session is cleared
    }
  }

  const sanitized = sanitizeAppUserPayload({
    uid: newUid,
    email: cleanEmail,
    displayName: cleanName,
    role: params.role,
    zone: params.zone,
    active: true,
    createdBy: params.adminUid,
  });

  const targetPath = `app_users/${sanitized.uid}`;
  try {
    await setDoc(doc(db, 'app_users', sanitized.uid), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, targetPath);
  }

  const initialBadges = Array.from(
    new Set(
      (params.initialManualBadges || [])
        .filter((b) => typeof b === 'string' && b.trim().length > 0)
        .map((b) => b.trim().slice(0, 64))
    )
  ).slice(0, 20);

  // Seed initial /team_stats/{uid} record so the collaborator immediately appears in Team Leaderboard & Badges
  // with an empty portfolio (0 prospects, 0 contracts, 0 payout).
  try {
    const initialStat = sanitizeTeamStatPayload({
      uid: sanitized.uid,
      displayName: sanitized.displayName,
      role: sanitized.role,
      zone: sanitized.zone,
      active: sanitized.active,
      totalProspects: 0,
      totalQualified: 0,
      totalContracts: 0,
      totalPayoutMad: 0,
      xp: 0,
      unlockedCount: initialBadges.length,
      manualBadges: initialBadges,
      monthlyHistory: [],
    });
    await setDoc(doc(db, 'team_stats', sanitized.uid), {
      ...initialStat,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal; will also be created automatically on collaborator's first workspace sync
  }

  // Seed initial /user_presence/{uid} record so Super-Admin immediately sees Name, Prénom, Phone, and Attendance
  try {
    const { firstName, lastName } = splitFirstAndLastName(sanitized.displayName);
    const initialPresence = sanitizeUserPresencePayload({
      uid: sanitized.uid,
      email: sanitized.email,
      displayName: sanitized.displayName,
      firstName,
      lastName,
      phonePro: params.phonePro || '',
      avatarDataUrl: '',
      role: sanitized.role,
      zone: sanitized.zone,
      isOnline: false,
      currentDevice: '',
      devicesUsed: [],
      lastLoginAt: '',
      lastLogoutAt: '',
      lastSeenAt: '',
      lastWorkDisconnectAt: '',
      workHoursDisconnectCount: 0,
      workHoursDisconnectTimes: [],
      activeDateKey: '',
      todayWorkedSeconds: 0,
      totalWorkedSeconds: 0,
      currentSessionId: '',
    });
    await setDoc(doc(db, 'user_presence', sanitized.uid), {
      ...initialPresence,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal; will also be created automatically on collaborator's first login
  }

  return {
    ...sanitized,
    createdAt: new Date().toISOString(),
  };
}

export async function adminUpdateManagedUser(
  uid: string,
  updates: {
    displayName: string;
    role: ManagedUserRole;
    zone: string;
    active: boolean;
    phonePro?: string;
    email?: string;
  }
): Promise<void> {
  const targetPath = `app_users/${uid}`;
  const cleanName = updates.displayName.trim().slice(0, 120) || 'Utilisateur';
  const cleanZone = updates.zone.trim().slice(0, 100);
  const cleanRole: ManagedUserRole = normalizeManagedRole(updates.role);
  try {
    await updateDoc(doc(db, 'app_users', uid), {
      displayName: cleanName,
      role: cleanRole,
      zone: cleanZone,
      active: Boolean(updates.active),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, targetPath);
  }

  // Keep /team_stats/{uid} metadata in sync if it exists
  try {
    const statRef = doc(db, 'team_stats', uid);
    const snap = await getDoc(statRef);
    if (snap.exists()) {
      await updateDoc(statRef, {
        displayName: cleanName,
        role: cleanRole,
        zone: cleanZone,
        active: Boolean(updates.active),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal
  }

  // Keep /user_presence/{uid} metadata (name, surname, phone, role, zone) in sync
  try {
    const presRef = doc(db, 'user_presence', uid);
    const presSnap = await getDoc(presRef);
    const { firstName, lastName } = splitFirstAndLastName(cleanName);
    const cleanPhone = typeof updates.phonePro === 'string' ? updates.phonePro.trim().slice(0, 30) : undefined;
    if (presSnap.exists()) {
      const presUpdate: DocumentData = {
        displayName: cleanName,
        firstName,
        lastName,
        role: cleanRole,
        zone: cleanZone,
        updatedAt: serverTimestamp(),
      };
      if (cleanPhone !== undefined) {
        presUpdate.phonePro = cleanPhone;
      }
      await updateDoc(presRef, presUpdate);
    } else if (updates.email) {
      const seeded = sanitizeUserPresencePayload({
        uid,
        email: updates.email,
        displayName: cleanName,
        firstName,
        lastName,
        phonePro: cleanPhone || '',
        avatarDataUrl: '',
        role: cleanRole,
        zone: cleanZone,
        isOnline: false,
      });
      await setDoc(presRef, {
        ...seeded,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal
  }
}

export async function adminDeleteManagedUser(uid: string): Promise<void> {
  const targetPath = `app_users/${uid}`;
  try {
    await deleteDoc(doc(db, 'app_users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
  }
  try {
    await deleteDoc(doc(db, 'team_stats', uid));
  } catch {
    // Non-fatal if stat doc does not exist
  }
  try {
    await deleteDoc(doc(db, 'user_presence', uid));
  } catch {
    // Non-fatal if presence doc does not exist
  }
}

export async function syncMyTeamStat(
  uid: string,
  input: TeamStatLike,
  isSuperAdmin: boolean
): Promise<void> {
  const path = `team_stats/${uid}`;
  const ref = doc(db, 'team_stats', uid);
  const clean = sanitizeTeamStatPayload({ ...input, uid });

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...clean,
        manualBadges: isSuperAdmin ? clean.manualBadges : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (isSuperAdmin) {
      const payload: DocumentData = {
        displayName: clean.displayName,
        role: clean.role,
        zone: clean.zone,
        active: clean.active,
        totalProspects: clean.totalProspects,
        totalQualified: clean.totalQualified,
        totalContracts: clean.totalContracts,
        totalPayoutMad: clean.totalPayoutMad,
        xp: clean.xp,
        unlockedCount: clean.unlockedCount,
        monthlyHistory: clean.monthlyHistory,
        updatedAt: serverTimestamp(),
      };
      if (typeof clean.avatarDataUrl === 'string') {
        payload.avatarDataUrl = clean.avatarDataUrl;
      }
      await updateDoc(ref, payload);
    } else {
      // Strictly respect Action 2 in firestore.rules: collaborator never touches manualBadges, role, or active
      const payload: DocumentData = {
        displayName: clean.displayName,
        zone: clean.zone,
        totalProspects: clean.totalProspects,
        totalQualified: clean.totalQualified,
        totalContracts: clean.totalContracts,
        totalPayoutMad: clean.totalPayoutMad,
        xp: clean.xp,
        unlockedCount: clean.unlockedCount,
        monthlyHistory: clean.monthlyHistory,
        updatedAt: serverTimestamp(),
      };
      if (typeof clean.avatarDataUrl === 'string') {
        payload.avatarDataUrl = clean.avatarDataUrl;
      }
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminUpdateUserManualBadges(
  targetUid: string,
  manualBadges: string[],
  fallbackProfile?: {
    displayName: string;
    role: TeamRole;
    zone: string;
    active: boolean;
  }
): Promise<void> {
  const path = `team_stats/${targetUid}`;
  const ref = doc(db, 'team_stats', targetUid);
  const cleanBadges = Array.from(
    new Set(manualBadges.filter((b) => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim().slice(0, 64)))
  ).slice(0, 20);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const seed = sanitizeTeamStatPayload({
        uid: targetUid,
        displayName: fallbackProfile?.displayName || 'Collaborateur',
        role: fallbackProfile?.role || 'commercial',
        zone: fallbackProfile?.zone || 'Meknès',
        active: fallbackProfile?.active ?? true,
        totalProspects: 0,
        totalQualified: 0,
        totalContracts: 0,
        totalPayoutMad: 0,
        xp: 0,
        unlockedCount: cleanBadges.length,
        manualBadges: cleanBadges,
        monthlyHistory: [],
      });
      await setDoc(ref, {
        ...seed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    await updateDoc(ref, {
      manualBadges: cleanBadges,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createSignedContract(
  input: SignedContractLike
): Promise<SanitizedSignedContractDoc> {
  const clean = sanitizeSignedContractPayload(input);
  const path = `signed_contracts/${clean.id}`;
  try {
    await setDoc(doc(db, 'signed_contracts', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateSignedContract(
  contractId: string,
  updates: {
    produitOrangePro: string;
    tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
    payoutMad: number;
    payoutStatus: 'En attente' | 'Validé' | 'Versé';
  }
): Promise<void> {
  const path = `signed_contracts/${contractId}`;
  const cleanProduit = updates.produitOrangePro.trim().slice(0, 200) || 'Pack Orange Pro';
  const cleanPayout = Math.min(10000000, Math.max(0, Math.round(Number(updates.payoutMad) || 0)));
  try {
    await updateDoc(doc(db, 'signed_contracts', contractId), {
      produitOrangePro: cleanProduit,
      tier: updates.tier,
      payoutMad: cleanPayout,
      payoutStatus: updates.payoutStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

const BATCH_LIMIT = 400;

function buildMutableFicheUpdate(docData: SanitizedFicheDoc): DocumentData {
  const {
    ownerId: _o,
    id: _i,
    numeroFiche,
    telephonesSupplementaires,
    emailsSupplementaires,
    siteWeb,
    verifieWeb,
    pistesEnrichissement,
    statutUpdatedAt,
    prochaineRelanceAt,
    rdvAt,
    rdvLieu,
    ...requiredMutable
  } = docData;

  return {
    ...requiredMutable,
    numeroFiche: numeroFiche !== undefined ? numeroFiche : deleteField(),
    telephonesSupplementaires:
      telephonesSupplementaires !== undefined ? telephonesSupplementaires : deleteField(),
    emailsSupplementaires:
      emailsSupplementaires !== undefined ? emailsSupplementaires : deleteField(),
    siteWeb: siteWeb !== undefined ? siteWeb : deleteField(),
    verifieWeb: verifieWeb !== undefined ? verifieWeb : deleteField(),
    pistesEnrichissement:
      pistesEnrichissement !== undefined ? pistesEnrichissement : deleteField(),
    statutUpdatedAt: statutUpdatedAt !== undefined ? statutUpdatedAt : deleteField(),
    prochaineRelanceAt: prochaineRelanceAt !== undefined ? prochaineRelanceAt : deleteField(),
    rdvAt: rdvAt !== undefined ? rdvAt : deleteField(),
    rdvLieu: rdvLieu !== undefined ? rdvLieu : deleteField(),
  };
}

function stripImmutableSkillKeys(docData: SanitizedEmailSkillDoc): DocumentData {
  const { ownerId: _o, id: _i, ...mutable } = docData;
  return mutable;
}

export async function ensureUserWorkspace(
  uid: string,
  localWorkspace: WorkspaceLike,
  localFiches: FicheLike[],
  localSkills: EmailSkillLike[]
): Promise<{ created: boolean }> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    return { created: false };
  }

  // Step 1: Create parent /users/{uid} FIRST and await commit so subcollection Master Gate exists() passes.
  const sanitizedWorkspace = sanitizeWorkspacePayload(uid, {
    ...localWorkspace,
    seeded: true,
  });

  try {
    await setDoc(userRef, {
      ...sanitizedWorkspace,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  // Step 2: Seed initial skills (and any provided fiches — always [] for new accounts)
  // resiliently so a pre-existing skill or single-doc collision NEVER aborts workspace creation.
  const ops: Array<{ type: 'fiche' | 'skill'; id: string; data: DocumentData }> = [];
  const seenFicheIds = new Set<string>();
  for (const fiche of localFiches) {
    const clean = sanitizeFichePayload(uid, fiche);
    if (seenFicheIds.has(clean.id)) continue;
    seenFicheIds.add(clean.id);
    ops.push({ type: 'fiche', id: clean.id, data: clean });
  }
  const seenSkillIds = new Set<string>();
  for (const skill of localSkills) {
    const clean = sanitizeSkillPayload(uid, skill);
    if (seenSkillIds.has(clean.id)) continue;
    seenSkillIds.add(clean.id);
    ops.push({ type: 'skill', id: clean.id, data: clean });
  }

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const colName = op.type === 'fiche' ? 'fiches' : 'skills';
      const ref = doc(db, 'users', uid, colName, op.id);
      batch.set(ref, {
        ...op.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch {
      // Resilient fallback: upsert each doc individually without crashing workspace bootstrap
      for (const op of chunk) {
        try {
          if (op.type === 'skill') {
            await upsertSkillResilient(uid, op.data as SanitizedEmailSkillDoc);
          } else {
            await upsertFicheResilient(uid, op.data as SanitizedFicheDoc, false);
          }
        } catch {
          // Non-fatal during initial seed; outgoing sync will reconcile if needed
        }
      }
    }
  }

  return { created: true };
}

export async function syncWorkspaceToFirestore(
  uid: string,
  workspace: WorkspaceLike
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const sanitized = sanitizeWorkspacePayload(uid, workspace);
  const { ownerId: _o, ...mutableFields } = sanitized;

  try {
    await updateDoc(userRef, {
      ...mutableFields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('not-found') || msg.includes('no document to update')) {
      try {
        await setDoc(userRef, {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, userPath);
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

async function upsertFicheResilient(
  uid: string,
  ficheDoc: SanitizedFicheDoc,
  statusOnly = false
): Promise<void> {
  const ref = doc(db, 'users', uid, 'fiches', ficheDoc.id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    if (statusOnly) {
      await updateDoc(ref, {
        statut: ficheDoc.statut,
        ...(ficheDoc.statutUpdatedAt !== undefined
          ? { statutUpdatedAt: ficheDoc.statutUpdatedAt }
          : {}),
        ...(ficheDoc.prochaineRelanceAt !== undefined
          ? { prochaineRelanceAt: ficheDoc.prochaineRelanceAt }
          : {}),
        ...(ficheDoc.rdvAt !== undefined ? { rdvAt: ficheDoc.rdvAt } : {}),
        ...(ficheDoc.rdvLieu !== undefined ? { rdvLieu: ficheDoc.rdvLieu } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      const mutable = buildMutableFicheUpdate(ficheDoc);
      await updateDoc(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    await setDoc(ref, {
      ...ficheDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

async function upsertSkillResilient(
  uid: string,
  skillDoc: SanitizedEmailSkillDoc
): Promise<void> {
  const ref = doc(db, 'users', uid, 'skills', skillDoc.id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const mutable = stripImmutableSkillKeys(skillDoc);
    await updateDoc(ref, {
      ...mutable,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      ...skillDoc,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function syncFichesDiffToFirestore(
  uid: string,
  diff: SyncDiff<SanitizedFicheDoc>
): Promise<void> {
  const totalOps = diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;
  if (totalOps === 0) return;

  const batches: ReturnType<typeof writeBatch>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  const pushOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
    if (count >= BATCH_LIMIT) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
    fn(currentBatch);
    count++;
  };

  for (const created of diff.toCreate) {
    const ref = doc(db, 'users', uid, 'fiches', created.id);
    pushOp((b) =>
      b.set(ref, {
        ...created,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }

  for (const upd of diff.toUpdate) {
    const ref = doc(db, 'users', uid, 'fiches', upd.id);
    if (upd.statusOnly) {
      pushOp((b) =>
        b.update(ref, {
          statut: upd.next.statut,
          ...(upd.next.statutUpdatedAt !== undefined
            ? { statutUpdatedAt: upd.next.statutUpdatedAt }
            : {}),
          ...(upd.next.prochaineRelanceAt !== undefined
            ? { prochaineRelanceAt: upd.next.prochaineRelanceAt }
            : {}),
          ...(upd.next.rdvAt !== undefined ? { rdvAt: upd.next.rdvAt } : {}),
          ...(upd.next.rdvLieu !== undefined ? { rdvLieu: upd.next.rdvLieu } : {}),
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      const mutable = buildMutableFicheUpdate(upd.next);
      pushOp((b) =>
        b.update(ref, {
          ...mutable,
          updatedAt: serverTimestamp(),
        })
      );
    }
  }

  for (const deletedId of diff.toDelete) {
    const ref = doc(db, 'users', uid, 'fiches', deletedId);
    pushOp((b) => b.delete(ref));
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  try {
    for (const batch of batches) {
      await batch.commit();
    }
    return;
  } catch {
    // Fallback: resilient per-document upsert so one existing/stale/locked doc never aborts the whole sync
    let firstError: unknown = null;
    for (const created of diff.toCreate) {
      try {
        await upsertFicheResilient(uid, created, false);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    for (const upd of diff.toUpdate) {
      try {
        await upsertFicheResilient(uid, upd.next, upd.statusOnly);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    for (const deletedId of diff.toDelete) {
      try {
        await deleteDoc(doc(db, 'users', uid, 'fiches', deletedId));
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    if (firstError) {
      handleFirestoreError(firstError, OperationType.WRITE, `users/${uid}/fiches`);
    }
  }
}

export async function syncSkillsDiffToFirestore(
  uid: string,
  diff: SyncDiff<SanitizedEmailSkillDoc>
): Promise<void> {
  const totalOps = diff.toCreate.length + diff.toUpdate.length + diff.toDelete.length;
  if (totalOps === 0) return;

  const batches: ReturnType<typeof writeBatch>[] = [];
  let currentBatch = writeBatch(db);
  let count = 0;

  const pushOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
    if (count >= BATCH_LIMIT) {
      batches.push(currentBatch);
      currentBatch = writeBatch(db);
      count = 0;
    }
    fn(currentBatch);
    count++;
  };

  for (const created of diff.toCreate) {
    const ref = doc(db, 'users', uid, 'skills', created.id);
    pushOp((b) =>
      b.set(ref, {
        ...created,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }

  for (const upd of diff.toUpdate) {
    const ref = doc(db, 'users', uid, 'skills', upd.id);
    const mutable = stripImmutableSkillKeys(upd.next);
    pushOp((b) =>
      b.update(ref, {
        ...mutable,
        updatedAt: serverTimestamp(),
      })
    );
  }

  for (const deletedId of diff.toDelete) {
    const ref = doc(db, 'users', uid, 'skills', deletedId);
    pushOp((b) => b.delete(ref));
  }

  if (count > 0) {
    batches.push(currentBatch);
  }

  try {
    for (const batch of batches) {
      await batch.commit();
    }
    return;
  } catch {
    // Fallback: resilient per-document upsert (prevents existing doc / createdAt immutability collisions)
    let firstError: unknown = null;
    for (const created of diff.toCreate) {
      try {
        await upsertSkillResilient(uid, created);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    for (const upd of diff.toUpdate) {
      try {
        await upsertSkillResilient(uid, upd.next);
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    for (const deletedId of diff.toDelete) {
      try {
        await deleteDoc(doc(db, 'users', uid, 'skills', deletedId));
      } catch (err) {
        if (!firstError) firstError = err;
      }
    }
    if (firstError) {
      handleFirestoreError(firstError, OperationType.WRITE, `users/${uid}/skills`);
    }
  }
}

export async function fetchInitialUserCollectionDocs(uid: string): Promise<{
  userSnap: Awaited<ReturnType<typeof getDoc>>;
  fichesSnap: Awaited<ReturnType<typeof getDocs>>;
  skillsSnap: Awaited<ReturnType<typeof getDocs>>;
}> {
  const userPath = `users/${uid}`;
  let userSnap: Awaited<ReturnType<typeof getDoc>>;
  try {
    userSnap = await getDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let fichesSnap: Awaited<ReturnType<typeof getDocs>>;
  try {
    fichesSnap = await getDocs(query(collection(db, 'users', uid, 'fiches'), where('ownerId', '==', uid)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/fiches`);
  }

  let skillsSnap: Awaited<ReturnType<typeof getDocs>>;
  try {
    skillsSnap = await getDocs(query(collection(db, 'users', uid, 'skills'), where('ownerId', '==', uid)));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${uid}/skills`);
  }

  return { userSnap, fichesSnap, skillsSnap };
}

export function getUserFichesCollection(uid: string) {
  return collection(db, 'users', uid, 'fiches');
}

export function getUserSkillsCollection(uid: string) {
  return collection(db, 'users', uid, 'skills');
}

export async function syncMyUserPresenceProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  phonePro: string;
  avatarDataUrl: string;
  role: TeamRole;
  zone: string;
}): Promise<void> {
  const path = `user_presence/${params.uid}`;
  const ref = doc(db, 'user_presence', params.uid);
  const { firstName, lastName } = splitFirstAndLastName(params.displayName);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const clean = sanitizeUserPresencePayload({
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
        firstName,
        lastName,
        phonePro: params.phonePro,
        avatarDataUrl: params.avatarDataUrl,
        role: params.role,
        zone: params.zone,
        isOnline: true,
      });
      await setDoc(ref, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const cleanProfile = sanitizeUserPresencePayload({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      firstName,
      lastName,
      phonePro: params.phonePro,
      avatarDataUrl: params.avatarDataUrl,
      role: params.role,
      zone: params.zone,
    });
    await updateDoc(ref, {
      displayName: cleanProfile.displayName,
      firstName: cleanProfile.firstName,
      lastName: cleanProfile.lastName,
      phonePro: cleanProfile.phonePro,
      avatarDataUrl: cleanProfile.avatarDataUrl,
      zone: cleanProfile.zone,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function startAttendanceSession(params: {
  uid: string;
  email: string;
  displayName: string;
  phonePro: string;
  avatarDataUrl: string;
  role: TeamRole;
  zone: string;
  deviceLabel: string;
  deviceType: ClientDeviceType;
  sessionId: string;
  loginAtIso: string;
  dateKey: string;
  pendingAbruptClosure?: {
    logoutAtIso: string;
    duringWorkHours: boolean;
    reason: string;
    workedSeconds: number;
    previousSessionId?: string;
  } | null;
}): Promise<{ todayWorkedSeconds: number; totalWorkedSeconds: number; workHoursDisconnectCount: number }> {
  const presPath = `user_presence/${params.uid}`;
  const presRef = doc(db, 'user_presence', params.uid);
  const { firstName, lastName } = splitFirstAndLastName(params.displayName);

  let nextTodaySeconds = 0;
  let nextTotalSeconds = 0;
  let nextDisconnectCount = 0;
  let nextDisconnectTimes: string[] = [];
  let nextLastWorkDisconnectAt = '';
  let nextLastLogoutAt = '';
  let nextDevices: string[] = [params.deviceLabel];

  try {
    const snap = await getDoc(presRef);
    if (snap.exists()) {
      const prev = snap.data();
      const sameDay = prev.activeDateKey === params.dateKey;
      nextTodaySeconds = sameDay ? Math.max(0, Math.round(Number(prev.todayWorkedSeconds) || 0)) : 0;
      nextTotalSeconds = Math.max(0, Math.round(Number(prev.totalWorkedSeconds) || 0));
      nextDisconnectCount = Math.max(0, Math.round(Number(prev.workHoursDisconnectCount) || 0));
      nextDisconnectTimes = Array.isArray(prev.workHoursDisconnectTimes)
        ? (prev.workHoursDisconnectTimes as string[])
        : [];
      nextLastWorkDisconnectAt = typeof prev.lastWorkDisconnectAt === 'string' ? prev.lastWorkDisconnectAt : '';
      nextLastLogoutAt = typeof prev.lastLogoutAt === 'string' ? prev.lastLogoutAt : '';
      const prevDevices = Array.isArray(prev.devicesUsed) ? (prev.devicesUsed as string[]) : [];
      nextDevices = buildDeviceHistoryList(prevDevices, params.deviceLabel, 12);

      // Flush unclosed session from an earlier browser/network closure if user was away >= 2 min
      if (params.pendingAbruptClosure && params.pendingAbruptClosure.previousSessionId) {
        try {
          const oldSessRef = doc(
            db,
            'user_presence',
            params.uid,
            'sessions',
            params.pendingAbruptClosure.previousSessionId
          );
          const oldSnap = await getDoc(oldSessRef);
          if (oldSnap.exists() && oldSnap.data().status === 'active') {
            nextLastLogoutAt = params.pendingAbruptClosure.logoutAtIso;
            if (params.pendingAbruptClosure.duringWorkHours) {
              nextDisconnectCount += 1;
              nextLastWorkDisconnectAt = params.pendingAbruptClosure.logoutAtIso;
              const entry = buildWorkDisconnectEntry(
                params.pendingAbruptClosure.logoutAtIso,
                params.pendingAbruptClosure.reason
              );
              nextDisconnectTimes = [entry, ...nextDisconnectTimes.filter((x) => x !== entry)].slice(0, 30);
            }
            await updateDoc(oldSessRef, {
              lastSeenAt: params.pendingAbruptClosure.logoutAtIso,
              logoutAt: params.pendingAbruptClosure.logoutAtIso,
              workedSeconds: Math.min(86400, Math.max(0, Math.round(params.pendingAbruptClosure.workedSeconds))),
              status: params.pendingAbruptClosure.duringWorkHours
                ? 'disconnected_work_hours'
                : 'closed',
              disconnectReason: params.pendingAbruptClosure.reason.slice(0, 80),
              disconnectedDuringWorkHours: params.pendingAbruptClosure.duringWorkHours,
              updatedAt: serverTimestamp(),
            });
          }
        } catch {
          // Non-fatal cleanup of prior session
        }
      }

      const cleanPres = sanitizeUserPresencePayload({
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
        firstName,
        lastName,
        phonePro: params.phonePro,
        avatarDataUrl: params.avatarDataUrl,
        role: params.role,
        zone: params.zone,
        isOnline: true,
        currentDevice: params.deviceLabel,
        devicesUsed: nextDevices,
        lastLoginAt: params.loginAtIso,
        lastLogoutAt: nextLastLogoutAt,
        lastSeenAt: params.loginAtIso,
        lastWorkDisconnectAt: nextLastWorkDisconnectAt,
        workHoursDisconnectCount: nextDisconnectCount,
        workHoursDisconnectTimes: nextDisconnectTimes,
        activeDateKey: params.dateKey,
        todayWorkedSeconds: nextTodaySeconds,
        totalWorkedSeconds: nextTotalSeconds,
        currentSessionId: params.sessionId,
      });

      await updateDoc(presRef, {
        displayName: cleanPres.displayName,
        firstName: cleanPres.firstName,
        lastName: cleanPres.lastName,
        phonePro: cleanPres.phonePro,
        avatarDataUrl: cleanPres.avatarDataUrl,
        zone: cleanPres.zone,
        isOnline: true,
        currentDevice: cleanPres.currentDevice,
        devicesUsed: cleanPres.devicesUsed,
        lastLoginAt: cleanPres.lastLoginAt,
        lastLogoutAt: cleanPres.lastLogoutAt,
        lastSeenAt: cleanPres.lastSeenAt,
        lastWorkDisconnectAt: cleanPres.lastWorkDisconnectAt,
        workHoursDisconnectCount: cleanPres.workHoursDisconnectCount,
        workHoursDisconnectTimes: cleanPres.workHoursDisconnectTimes,
        activeDateKey: cleanPres.activeDateKey,
        todayWorkedSeconds: cleanPres.todayWorkedSeconds,
        totalWorkedSeconds: cleanPres.totalWorkedSeconds,
        currentSessionId: cleanPres.currentSessionId,
        updatedAt: serverTimestamp(),
      });
    } else {
      const cleanPres = sanitizeUserPresencePayload({
        uid: params.uid,
        email: params.email,
        displayName: params.displayName,
        firstName,
        lastName,
        phonePro: params.phonePro,
        avatarDataUrl: params.avatarDataUrl,
        role: params.role,
        zone: params.zone,
        isOnline: true,
        currentDevice: params.deviceLabel,
        devicesUsed: nextDevices,
        lastLoginAt: params.loginAtIso,
        lastLogoutAt: '',
        lastSeenAt: params.loginAtIso,
        lastWorkDisconnectAt: '',
        workHoursDisconnectCount: 0,
        workHoursDisconnectTimes: [],
        activeDateKey: params.dateKey,
        todayWorkedSeconds: 0,
        totalWorkedSeconds: 0,
        currentSessionId: params.sessionId,
      });
      await setDoc(presRef, {
        ...cleanPres,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, presPath);
  }

  // Create the session log document after /user_presence/{uid} exists (Master Gate)
  const sessPath = `user_presence/${params.uid}/sessions/${params.sessionId}`;
  try {
    const cleanSess = sanitizeAttendanceSessionPayload({
      id: params.sessionId,
      ownerId: params.uid,
      dateKey: params.dateKey,
      loginAt: params.loginAtIso,
      lastSeenAt: params.loginAtIso,
      logoutAt: '',
      workedSeconds: 0,
      deviceLabel: params.deviceLabel,
      deviceType: params.deviceType,
      status: 'active',
      disconnectReason: '',
      disconnectedDuringWorkHours: false,
    });
    await setDoc(doc(db, 'user_presence', params.uid, 'sessions', params.sessionId), {
      ...cleanSess,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, sessPath);
  }

  return {
    todayWorkedSeconds: nextTodaySeconds,
    totalWorkedSeconds: nextTotalSeconds,
    workHoursDisconnectCount: nextDisconnectCount,
  };
}

export async function heartbeatAttendanceSession(params: {
  uid: string;
  sessionId: string;
  nowIso: string;
  dateKey: string;
  todayWorkedSeconds: number;
  totalWorkedSeconds: number;
  sessionWorkedSeconds: number;
  deviceLabel: string;
}): Promise<void> {
  const presRef = doc(db, 'user_presence', params.uid);
  const sessRef = doc(db, 'user_presence', params.uid, 'sessions', params.sessionId);
  const safeToday = Math.min(86400, Math.max(0, Math.round(params.todayWorkedSeconds)));
  const safeTotal = Math.min(100000000, Math.max(0, Math.round(params.totalWorkedSeconds)));
  const safeSession = Math.min(86400, Math.max(0, Math.round(params.sessionWorkedSeconds)));

  try {
    await updateDoc(presRef, {
      isOnline: true,
      currentDevice: params.deviceLabel.slice(0, 160),
      lastSeenAt: params.nowIso.slice(0, 64),
      activeDateKey: params.dateKey.slice(0, 16),
      todayWorkedSeconds: safeToday,
      totalWorkedSeconds: safeTotal,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `user_presence/${params.uid}`);
  }

  try {
    await updateDoc(sessRef, {
      lastSeenAt: params.nowIso.slice(0, 64),
      workedSeconds: safeSession,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if session doc hasn't settled yet
  }
}

export async function closeAttendanceSession(params: {
  uid: string;
  sessionId: string;
  logoutAtIso: string;
  dateKey: string;
  todayWorkedSeconds: number;
  totalWorkedSeconds: number;
  sessionWorkedSeconds: number;
  reason: string;
  duringWorkHours: boolean;
}): Promise<void> {
  const presRef = doc(db, 'user_presence', params.uid);
  const sessRef = doc(db, 'user_presence', params.uid, 'sessions', params.sessionId);
  const safeToday = Math.min(86400, Math.max(0, Math.round(params.todayWorkedSeconds)));
  const safeTotal = Math.min(100000000, Math.max(0, Math.round(params.totalWorkedSeconds)));
  const safeSession = Math.min(86400, Math.max(0, Math.round(params.sessionWorkedSeconds)));
  const cleanReason = params.reason.trim().slice(0, 80) || 'Déconnexion';

  try {
    const snap = await getDoc(presRef);
    if (snap.exists()) {
      const prev = snap.data();
      let disconnectCount = Math.max(0, Math.round(Number(prev.workHoursDisconnectCount) || 0));
      let disconnectTimes = Array.isArray(prev.workHoursDisconnectTimes)
        ? (prev.workHoursDisconnectTimes as string[])
        : [];
      let lastWorkDisconnectAt =
        typeof prev.lastWorkDisconnectAt === 'string' ? prev.lastWorkDisconnectAt : '';

      if (params.duringWorkHours) {
        disconnectCount += 1;
        lastWorkDisconnectAt = params.logoutAtIso.slice(0, 64);
        const entry = buildWorkDisconnectEntry(params.logoutAtIso, cleanReason);
        disconnectTimes = [entry, ...disconnectTimes.filter((x) => x !== entry)].slice(0, 30);
      }

      await updateDoc(presRef, {
        isOnline: false,
        lastLogoutAt: params.logoutAtIso.slice(0, 64),
        lastSeenAt: params.logoutAtIso.slice(0, 64),
        lastWorkDisconnectAt,
        workHoursDisconnectCount: disconnectCount,
        workHoursDisconnectTimes: disconnectTimes,
        activeDateKey: params.dateKey.slice(0, 16),
        todayWorkedSeconds: safeToday,
        totalWorkedSeconds: safeTotal,
        currentSessionId: '',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `user_presence/${params.uid}`);
  }

  try {
    await updateDoc(sessRef, {
      lastSeenAt: params.logoutAtIso.slice(0, 64),
      logoutAt: params.logoutAtIso.slice(0, 64),
      workedSeconds: safeSession,
      status: params.duringWorkHours ? 'disconnected_work_hours' : 'closed',
      disconnectReason: cleanReason,
      disconnectedDuringWorkHours: params.duringWorkHours,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if session doc already closed
  }
}

export async function fetchUserAttendanceSessions(
  uid: string
): Promise<AttendanceSessionRecord[]> {
  const path = `user_presence/${uid}/sessions`;
  try {
    const snap = await getDocs(getUserSessionsQuery(uid));
    const list: AttendanceSessionRecord[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push(
        sanitizeAttendanceSessionPayload({
          id: docSnap.id,
          ownerId: typeof d.ownerId === 'string' ? d.ownerId : uid,
          dateKey: typeof d.dateKey === 'string' ? d.dateKey : '',
          loginAt: typeof d.loginAt === 'string' ? d.loginAt : '',
          lastSeenAt: typeof d.lastSeenAt === 'string' ? d.lastSeenAt : '',
          logoutAt: typeof d.logoutAt === 'string' ? d.logoutAt : '',
          workedSeconds: Number(d.workedSeconds) || 0,
          deviceLabel: typeof d.deviceLabel === 'string' ? d.deviceLabel : 'Navigateur',
          deviceType: typeof d.deviceType === 'string' ? d.deviceType : 'desktop',
          status: typeof d.status === 'string' ? d.status : 'closed',
          disconnectReason: typeof d.disconnectReason === 'string' ? d.disconnectReason : '',
          disconnectedDuringWorkHours: Boolean(d.disconnectedDuringWorkHours),
        })
      );
    });
    list.sort((a, b) => (b.loginAt || '').localeCompare(a.loginAt || ''));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * LOT 2: Enregistrer une entrée dans le journal d'activité de la fiche prospect
 * et mettre à jour de manière miroir les rappels (prochaineRelanceAt, rdvAt, rdvLieu) sur la fiche.
 */
export async function saveFicheActivite(
  uid: string,
  ficheId: string,
  activite: ActiviteLike
): Promise<SanitizedActiviteDoc> {
  const sanitized = sanitizeActivitePayload(uid, ficheId, activite);
  const actPath = `users/${uid}/fiches/${ficheId}/activites/${sanitized.id}`;
  const actRef = doc(db, 'users', uid, 'fiches', ficheId, 'activites', sanitized.id);

  try {
    await setDoc(actRef, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, actPath);
  }

  // Synchronisation miroir optionnelle sur la fiche parent si une relance ou un RDV est spécifié
  if (sanitized.prochaineRelanceAt !== undefined || sanitized.rdvAt !== undefined || sanitized.rdvLieu !== undefined) {
    try {
      const parentRef = doc(db, 'users', uid, 'fiches', ficheId);
      const updates: DocumentData = { updatedAt: serverTimestamp() };
      if (sanitized.prochaineRelanceAt !== undefined) {
        updates.prochaineRelanceAt = sanitized.prochaineRelanceAt;
      }
      if (sanitized.rdvAt !== undefined) {
        updates.rdvAt = sanitized.rdvAt;
      }
      if (sanitized.rdvLieu !== undefined) {
        updates.rdvLieu = sanitized.rdvLieu;
      }
      await updateDoc(parentRef, updates);
    } catch {
      // Non bloquant : l'activité reste enregistrée dans la sous-collection
    }
  }

  return sanitized;
}

/**
 * LOT 2: Récupérer le journal d'activité d'une fiche
 */
export async function fetchFicheActivites(
  uid: string,
  ficheId: string
): Promise<SanitizedActiviteDoc[]> {
  const actPath = `users/${uid}/fiches/${ficheId}/activites`;
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'fiches', ficheId, 'activites'));
    const list: SanitizedActiviteDoc[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push(
        sanitizeActivitePayload(uid, ficheId, {
          id: docSnap.id,
          type: d.type,
          resultat: d.resultat,
          texte: typeof d.texte === 'string' ? d.texte : '',
          auteurNom: typeof d.auteurNom === 'string' ? d.auteurNom : '',
          rdvAt: typeof d.rdvAt === 'string' ? d.rdvAt : undefined,
          rdvLieu: typeof d.rdvLieu === 'string' ? d.rdvLieu : undefined,
          prochaineRelanceAt: typeof d.prochaineRelanceAt === 'string' ? d.prochaineRelanceAt : undefined,
        })
      );
    });
    // Tri par date de création ou id décroissant (les plus récentes en haut)
    list.sort((a, b) => b.id.localeCompare(a.id));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, actPath);
  }
}

/**
 * LOT 6: Consultation en lecture seule des fiches d'un collaborateur actif
 * par le Super-Admin, le Manager ou le Team Lead.
 */
export async function fetchTeamMemberFiches(
  memberUid: string
): Promise<SanitizedFicheDoc[]> {
  const path = `users/${memberUid}/fiches`;
  try {
    const q = query(
      collection(db, 'users', memberUid, 'fiches'),
      where('ownerId', '==', memberUid)
    );
    const snap = await getDocs(q);
    const list: SanitizedFicheDoc[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      list.push(
        sanitizeFichePayload(memberUid, {
          ...d,
          id: docSnap.id,
        } as FicheLike)
      );
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * LOT 5: Mise à jour et validation d'un contrat signé par un Manager ou Super-Admin.
 * Si le statut passe à 'Versé', une référence de virement (max 80 car.) est obligatoire.
 */
export async function managerUpdateSignedContract(
  contractId: string,
  updates: {
    produitOrangePro: string;
    tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
    payoutMad: number;
    payoutStatus: 'En attente' | 'Validé' | 'Versé';
    referenceVirement?: string;
  }
): Promise<void> {
  const path = `signed_contracts/${contractId}`;
  const cleanProduit = updates.produitOrangePro.trim().slice(0, 200) || 'Pack Orange Pro';
  const cleanPayout = Math.min(10000000, Math.max(0, Math.round(Number(updates.payoutMad) || 0)));
  const cleanRef = typeof updates.referenceVirement === 'string' ? updates.referenceVirement.trim().slice(0, 80) : '';

  if (updates.payoutStatus === 'Versé' && !cleanRef) {
    throw new Error('Une référence de virement bancaire est obligatoire pour passer le contrat au statut « Versé ».');
  }

  const payload: DocumentData = {
    produitOrangePro: cleanProduit,
    tier: updates.tier,
    payoutMad: cleanPayout,
    payoutStatus: updates.payoutStatus,
    updatedAt: serverTimestamp(),
  };

  if (cleanRef) {
    payload.referenceVirement = cleanRef;
  }

  try {
    await updateDoc(doc(db, 'signed_contracts', contractId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

