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
  sanitizeProviderId,
  type FicheLike,
  type EmailSkillLike,
  type WorkspaceLike,
  type TeamStatLike,
  type SignedContractLike,
  type ApiKeyConfigLike,
  type SanitizedFicheDoc,
  type SanitizedEmailSkillDoc,
  type SanitizedSignedContractDoc,
  type SyncDiff,
} from './utils/firestoreSanitize';
import { normalizeManagedRole, type ManagedAppUser, type ManagedUserRole } from './utils/authAccess';
import type { TeamRole } from './utils/gamification';

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

function stripImmutableFicheKeys(docData: SanitizedFicheDoc): DocumentData {
  const { ownerId: _o, id: _i, ...mutable } = docData;
  return mutable;
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
        updatedAt: serverTimestamp(),
      });
    } else {
      const mutable = stripImmutableFicheKeys(ficheDoc);
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
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      const mutable = stripImmutableFicheKeys(upd.next);
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
