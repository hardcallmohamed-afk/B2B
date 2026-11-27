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
  inspectTeamStatDocKeys,
  buildTeamStatRepairUpdatePayload,
  sanitizeSignedContractPayload,
  sanitizeApiKeyConfigPayload,
  sanitizeUserPresencePayload,
  inspectUserPresenceDocKeys,
  buildUserPresenceRepairUpdatePayload,
  VALID_TEAM_ROLES,
  sanitizeAttendanceSessionPayload,
  sanitizeProviderId,
  sanitizeActivitePayload,
  sanitizeCloudNotificationPayload,
  sanitizeFicheAuditLogPayload,
  sanitizeDirectChatChannelPayload,
  sanitizeDirectChatMessagePayload,
  sanitizeCoachingSessionPayload,
  sanitizeCoachingCandidatePayload,
  clampUtf8Bytes,
  type FicheLike,
  type EmailSkillLike,
  type WorkspaceLike,
  type TeamStatLike,
  type SanitizedTeamStatDoc,
  type SignedContractLike,
  type ApiKeyConfigLike,
  type ActiviteLike,
  type CloudNotificationLike,
  type FicheAuditLogLike,
  type DirectChatChannelLike,
  type DirectChatMessageLike,
  type CoachingSessionLike,
  type CoachingCandidateLike,
  type SanitizedFicheDoc,
  type SanitizedEmailSkillDoc,
  type SanitizedSignedContractDoc,
  type SanitizedUserPresenceDoc,
  type SanitizedAttendanceSessionDoc,
  type SanitizedActiviteDoc,
  type SanitizedCloudNotificationDoc,
  type SanitizedFicheAuditLogDoc,
  type SanitizedDirectChatChannelDoc,
  type SanitizedDirectChatMessageDoc,
  type SanitizedCoachingSessionDoc,
  type SanitizedCoachingCandidateDoc,
  type SyncDiff,
  type PayoutStatus,
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

async function ensureFreshAuthUser(expectedUid?: string, forceRefresh = false): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Session Firebase non authentifiée.');
  }
  if (expectedUid && user.uid !== expectedUid) {
    throw new Error('Identifiant utilisateur Firebase incohérent avec la session active.');
  }
  try {
    await user.getIdToken(forceRefresh);
  } catch {
    // Non-blocking fallback when token is already fresh in memory or offline
  }
  return user;
}

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err || '').toLowerCase();
  return msg.includes('permission-denied') || msg.includes('missing or insufficient permissions');
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

export function getSignedContractsQuery(uid: string, canSuperviseTeam: boolean) {
  if (canSuperviseTeam) {
    return query(collection(db, 'signed_contracts'), where('orgScope', '==', 'orange_pro_team'));
  }
  return query(collection(db, 'signed_contracts'), where('ownerId', '==', uid));
}

export type UserPresenceRecord = SanitizedUserPresenceDoc & {
  updatedAtIso?: string;
};
export type AttendanceSessionRecord = SanitizedAttendanceSessionDoc;

export function getUserPresenceListQuery() {
  return query(collection(db, 'user_presence'), where('orgScope', '==', 'orange_pro_team'));
}

export function getOwnUserPresenceDocRef(uid: string) {
  return doc(db, 'user_presence', uid);
}

export function getUserSessionsQuery(uid: string) {
  return query(
    collection(db, 'user_presence', uid, 'sessions'),
    where('orgScope', '==', 'orange_pro_team'),
    where('ownerId', '==', uid)
  );
}

export interface CloudApiKeyRecord {
  provider: string;
  label: string;
  key: string;
  active: boolean;
  updatedBy: string;
  updatedAt?: string;
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
  const cleanName = clampUtf8Bytes(updates.displayName.trim(), 120) || 'Utilisateur';
  const cleanZone = clampUtf8Bytes(updates.zone.trim(), 100);
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
    const cleanPhone =
      typeof updates.phonePro === 'string' ? clampUtf8Bytes(updates.phonePro.trim(), 30) : undefined;
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
      try {
        await updateDoc(presRef, presUpdate);
      } catch {
        const prev = presSnap.data();
        const repaired = buildRepairedUserPresenceDoc(
          {
            uid,
            email: typeof prev.email === 'string' && prev.email.length >= 3 ? prev.email : updates.email || '',
            displayName: cleanName,
            firstName,
            lastName,
            phonePro: cleanPhone !== undefined ? cleanPhone : typeof prev.phonePro === 'string' ? prev.phonePro : '',
            avatarDataUrl: typeof prev.avatarDataUrl === 'string' ? prev.avatarDataUrl : '',
            role: cleanRole,
            zone: cleanZone,
          },
          prev
        );
        await repairExistingUserPresenceDoc(presRef, prev, repaired);
      }
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

  const repairTeamStatDoc = async (existingData: DocumentData, nextDoc: SanitizedTeamStatDoc) => {
    const repairPayload = buildTeamStatRepairUpdatePayload(
      existingData as Record<string, unknown>,
      nextDoc,
      {
        updatedAtSentinel: serverTimestamp(),
        createdAtSentinel: serverTimestamp(),
        deleteFieldSentinel: deleteField(),
        hasValidCreatedAtTimestamp: isFirestoreTimestampValue(existingData.createdAt),
      }
    );
    await updateDoc(ref, repairPayload);
  };

  const executeAttempt = async () => {
    let diagStep = 'get';
    let diagPrimaryErr = '';
    let diagExisted = false;
    let diagHadTs = false;
    let diagMissingCount = 0;
    let diagExtraCount = 0;

    try {
      const snap = await getDocFromServer(ref).catch(() => getDoc(ref));

      const selfHealFromServer = async (fallbackPrev: DocumentData = {}) => {
        diagStep = 'selfHeal_get';
        const freshSnap = await getDocFromServer(ref).catch(() => snap);
        if (!freshSnap.exists()) {
          diagStep = 'selfHeal_create';
          diagExisted = false;
          const createPayload: SanitizedTeamStatDoc = isSuperAdmin
            ? clean
            : {
                ...clean,
                totalProspects: 0,
                totalQualified: 0,
                totalContracts: 0,
                totalPayoutMad: 0,
                xp: 0,
                unlockedCount: 0,
                manualBadges: [],
                monthlyHistory: [],
              };
          await setDoc(ref, {
            ...createPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }
        const freshData = freshSnap.data() || fallbackPrev;
        diagExisted = true;
        diagHadTs = isFirestoreTimestampValue(freshData.createdAt);
        const { missingDataKeys, extraKeys } = inspectTeamStatDocKeys(freshData);
        diagMissingCount = missingDataKeys.length;
        diagExtraCount = extraKeys.length;

        if (isSuperAdmin) {
          diagStep = 'selfHeal_repair_update';
          const repairedDoc: SanitizedTeamStatDoc = sanitizeTeamStatPayload({
            ...clean,
            uid,
            manualBadges: Array.isArray(freshData.manualBadges)
              ? (freshData.manualBadges as string[])
              : clean.manualBadges,
          });
          await repairTeamStatDoc(freshData, repairedDoc);
          return;
        }

        diagStep = 'collab_update';
        const collabPayload: DocumentData = {
          displayName: clean.displayName,
          zone: clean.zone,
          totalProspects: clean.totalProspects,
          totalQualified: clean.totalQualified,
          xp: clean.xp,
          unlockedCount: clean.unlockedCount,
          monthlyHistory: clean.monthlyHistory,
          updatedAt: serverTimestamp(),
        };
        if (typeof clean.avatarDataUrl === 'string') {
          collabPayload.avatarDataUrl = clean.avatarDataUrl;
        }
        await updateDoc(ref, collabPayload);
      };

      if (!snap.exists()) {
        diagStep = 'create_new';
        diagExisted = false;
        const createPayload = isSuperAdmin
          ? clean
          : {
              ...clean,
              totalProspects: 0,
              totalQualified: 0,
              totalContracts: 0,
              totalPayoutMad: 0,
              xp: 0,
              unlockedCount: 0,
              manualBadges: [],
              monthlyHistory: [],
            };
        try {
          await setDoc(ref, {
            ...createPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        } catch (primaryErr) {
          diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
          await selfHealFromServer();
          return;
        }
      }

      const prev = snap.data();
      diagExisted = true;
      diagHadTs = isFirestoreTimestampValue(prev.createdAt);
      const { missingDataKeys, extraKeys } = inspectTeamStatDocKeys(prev);
      diagMissingCount = missingDataKeys.length;
      diagExtraCount = extraKeys.length;

      const hasValidSchema =
        prev.uid === uid &&
        prev.orgScope === 'orange_pro_team' &&
        diagHadTs &&
        diagMissingCount === 0 &&
        diagExtraCount === 0;

      if (isSuperAdmin) {
        if (hasValidSchema) {
          diagStep = 'fast_update';
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
          try {
            await updateDoc(ref, payload);
            return;
          } catch (primaryErr) {
            diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            await selfHealFromServer(prev);
            return;
          }
        } else {
          await selfHealFromServer(prev);
          return;
        }
      }

      // Collaborator updates own profile & non-financial progression stats on /team_stats
      diagStep = 'collab_update';
      const payload: DocumentData = {
        displayName: clean.displayName,
        zone: clean.zone,
        totalProspects: clean.totalProspects,
        totalQualified: clean.totalQualified,
        xp: clean.xp,
        unlockedCount: clean.unlockedCount,
        monthlyHistory: clean.monthlyHistory,
        updatedAt: serverTimestamp(),
      };
      if (typeof clean.avatarDataUrl === 'string') {
        payload.avatarDataUrl = clean.avatarDataUrl;
      }
      await updateDoc(ref, payload);
    } catch (innerErr) {
      throw withPresenceStepTag(
        innerErr,
        `step=${diagStep};exists=${diagExisted};hadTs=${diagHadTs};miss=${diagMissingCount};extra=${diagExtraCount}${diagPrimaryErr ? `;firstErr=${diagPrimaryErr.slice(0, 80)}` : ''};role=${clean.role};hist=${clean.monthlyHistory.length};badges=${clean.manualBadges.length}`
      );
    }
  };

  try {
    await ensureFreshAuthUser(uid);
    try {
      await executeAttempt();
    } catch (firstErr) {
      if (isPermissionDeniedError(firstErr)) {
        await ensureFreshAuthUser(uid, true);
        await executeAttempt();
      } else {
        throw firstErr;
      }
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
  input: SignedContractLike,
  isSuperAdmin = false
): Promise<SanitizedSignedContractDoc> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Session Firebase non authentifiée : impossible de créer le contrat.');
  }
  const clean = sanitizeSignedContractPayload({
    ...input,
    // Ensure client authInfo.userId maps strictly to ownerId for non-supervisors
    ownerId: isSuperAdmin ? input.ownerId || currentUid : currentUid,
    // Phase 3 Rules: client creation forces payoutMad = 0 and payoutStatus = 'En attente'
    payoutMad: isSuperAdmin ? input.payoutMad : 0,
    payoutStatus: isSuperAdmin ? input.payoutStatus : 'En attente',
  });
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
    payoutStatus: PayoutStatus;
    referenceVirement?: string;
    refusMotif?: string;
  }
): Promise<void> {
  await updateOrUpsertSignedContract(contractId, updates, `signed_contracts/${contractId}`);
}

/**
 * Super-Admin helper: immediately recalculates & persists /team_stats/{targetUid}
 * (totalContracts, totalPayoutMad, monthlyHistory) after a contract is signed,
 * validated, paid, or refused so every collaborator's leaderboard stays live.
 */
export async function adminSyncMemberContractStats(
  targetUid: string,
  summary: {
    totalContracts: number;
    totalPayoutMad: number;
    monthlyHistory: string[];
  }
): Promise<void> {
  if (!targetUid) return;
  const ref = doc(db, 'team_stats', targetUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      totalContracts: Math.max(0, Math.round(summary.totalContracts)),
      totalPayoutMad: Math.max(0, Math.round(summary.totalPayoutMad)),
      monthlyHistory: summary.monthlyHistory.slice(-18),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal: live /signed_contracts overlay still keeps leaderboard accurate
  }
}

export async function adminResyncTeamMemberStats(
  targetUid: string,
  patch: {
    totalProspects: number;
    totalQualified: number;
    totalContracts: number;
    totalPayoutMad: number;
    xp: number;
    unlockedCount: number;
  }
): Promise<void> {
  if (!targetUid) return;
  const path = `team_stats/${targetUid}`;
  const ref = doc(db, 'team_stats', targetUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      totalProspects: Math.max(0, Math.round(patch.totalProspects)),
      totalQualified: Math.max(0, Math.round(patch.totalQualified)),
      totalContracts: Math.max(0, Math.round(patch.totalContracts)),
      totalPayoutMad: Math.max(0, Math.round(patch.totalPayoutMad)),
      xp: Math.max(0, Math.round(patch.xp)),
      unlockedCount: Math.max(0, Math.round(patch.unlockedCount)),
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
    assignedByUid,
    assignedByName,
    assignedAt,
    restoredByName,
    restoredAt,
    restoredReason,
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
    assignedByUid: assignedByUid !== undefined ? assignedByUid : deleteField(),
    assignedByName: assignedByName !== undefined ? assignedByName : deleteField(),
    assignedAt: assignedAt !== undefined ? assignedAt : deleteField(),
    restoredByName: restoredByName !== undefined ? restoredByName : deleteField(),
    restoredAt: restoredAt !== undefined ? restoredAt : deleteField(),
    restoredReason: restoredReason !== undefined ? restoredReason : deleteField(),
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

function isFirestoreTimestampValue(val: unknown): boolean {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof (val as { toDate?: unknown }).toDate === 'function'
  );
}

async function repairExistingUserPresenceDoc(
  presRef: ReturnType<typeof doc>,
  existingData: DocumentData,
  cleanDoc: SanitizedUserPresenceDoc
): Promise<void> {
  const repairPayload = buildUserPresenceRepairUpdatePayload(
    existingData as Record<string, unknown>,
    cleanDoc,
    {
      updatedAtSentinel: serverTimestamp(),
      createdAtSentinel: serverTimestamp(),
      deleteFieldSentinel: deleteField(),
      hasValidCreatedAtTimestamp: isFirestoreTimestampValue(existingData.createdAt),
    }
  );
  await updateDoc(presRef, repairPayload);
}

function withPresenceStepTag(err: unknown, stepInfo: string): Error {
  const baseMsg = err instanceof Error ? err.message : String(err || 'Firestore write failed');
  return new Error(`${baseMsg} [${stepInfo}]`);
}

function summarizePresenceDiag(
  expectedUid: string,
  clean: SanitizedUserPresenceDoc,
  existing?: DocumentData
): string {
  const exRole = existing && typeof existing.role === 'string' ? existing.role : 'none';
  const exEmailOk =
    existing && typeof existing.email === 'string' ? existing.email.length >= 3 : false;
  const exOrgOk = existing ? existing.orgScope === 'orange_pro_team' : false;
  const exUpdTs = existing ? isFirestoreTimestampValue(existing.updatedAt) : false;
  return [
    `uidEq=${clean.uid === expectedUid}`,
    `role=${clean.role}`,
    `exRole=${exRole}`,
    `exEmailOk=${exEmailOk}`,
    `exOrgOk=${exOrgOk}`,
    `exUpdTs=${exUpdTs}`,
    `emailLen=${clean.email.length}`,
    `nameLen=${clean.displayName.length}`,
    `firstLen=${clean.firstName.length}`,
    `lastLen=${clean.lastName.length}`,
    `phoneLen=${clean.phonePro.length}`,
    `zoneLen=${clean.zone.length}`,
    `devLen=${clean.currentDevice.length}`,
    `devs=${clean.devicesUsed.length}`,
    `disc=${clean.workHoursDisconnectTimes.length}`,
    `discCount=${clean.workHoursDisconnectCount}`,
    `loginLen=${clean.lastLoginAt.length}`,
    `logoutLen=${clean.lastLogoutAt.length}`,
    `seenLen=${clean.lastSeenAt.length}`,
    `workDiscLen=${clean.lastWorkDisconnectAt.length}`,
    `dateLen=${clean.activeDateKey.length}`,
    `today=${clean.todayWorkedSeconds}`,
    `total=${clean.totalWorkedSeconds}`,
    `sessLen=${clean.currentSessionId.length}`,
    `avatarLen=${clean.avatarDataUrl.length}`,
  ].join(';');
}

function buildRepairedUserPresenceDoc(
  params: {
    uid: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    phonePro: string;
    avatarDataUrl: string;
    role: TeamRole;
    zone: string;
  },
  prev: DocumentData,
  overrides: Partial<{
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
  }> = {}
) {
  return sanitizeUserPresencePayload({
    uid: params.uid,
    email: typeof prev.email === 'string' && prev.email.length >= 3 ? prev.email : params.email,
    displayName: params.displayName,
    firstName: params.firstName,
    lastName: params.lastName,
    phonePro: params.phonePro,
    avatarDataUrl: params.avatarDataUrl,
    role: VALID_TEAM_ROLES.has(params.role as never)
      ? params.role
      : typeof prev.role === 'string'
        ? prev.role
        : params.role,
    zone: params.zone,
    isOnline:
      overrides.isOnline !== undefined
        ? overrides.isOnline
        : typeof prev.isOnline === 'boolean'
          ? prev.isOnline
          : true,
    currentDevice:
      overrides.currentDevice !== undefined
        ? overrides.currentDevice
        : typeof prev.currentDevice === 'string'
          ? prev.currentDevice
          : '',
    devicesUsed:
      overrides.devicesUsed !== undefined
        ? overrides.devicesUsed
        : Array.isArray(prev.devicesUsed)
          ? (prev.devicesUsed as string[])
          : [],
    lastLoginAt:
      overrides.lastLoginAt !== undefined
        ? overrides.lastLoginAt
        : typeof prev.lastLoginAt === 'string'
          ? prev.lastLoginAt
          : '',
    lastLogoutAt:
      overrides.lastLogoutAt !== undefined
        ? overrides.lastLogoutAt
        : typeof prev.lastLogoutAt === 'string'
          ? prev.lastLogoutAt
          : '',
    lastSeenAt:
      overrides.lastSeenAt !== undefined
        ? overrides.lastSeenAt
        : typeof prev.lastSeenAt === 'string'
          ? prev.lastSeenAt
          : '',
    lastWorkDisconnectAt:
      overrides.lastWorkDisconnectAt !== undefined
        ? overrides.lastWorkDisconnectAt
        : typeof prev.lastWorkDisconnectAt === 'string'
          ? prev.lastWorkDisconnectAt
          : '',
    workHoursDisconnectCount:
      overrides.workHoursDisconnectCount !== undefined
        ? overrides.workHoursDisconnectCount
        : Math.max(0, Math.round(Number(prev.workHoursDisconnectCount) || 0)),
    workHoursDisconnectTimes:
      overrides.workHoursDisconnectTimes !== undefined
        ? overrides.workHoursDisconnectTimes
        : Array.isArray(prev.workHoursDisconnectTimes)
          ? (prev.workHoursDisconnectTimes as string[])
          : [],
    activeDateKey:
      overrides.activeDateKey !== undefined
        ? overrides.activeDateKey
        : typeof prev.activeDateKey === 'string'
          ? prev.activeDateKey
          : '',
    todayWorkedSeconds:
      overrides.todayWorkedSeconds !== undefined
        ? overrides.todayWorkedSeconds
        : Math.max(0, Math.round(Number(prev.todayWorkedSeconds) || 0)),
    totalWorkedSeconds:
      overrides.totalWorkedSeconds !== undefined
        ? overrides.totalWorkedSeconds
        : Math.max(0, Math.round(Number(prev.totalWorkedSeconds) || 0)),
    currentSessionId:
      overrides.currentSessionId !== undefined
        ? overrides.currentSessionId
        : typeof prev.currentSessionId === 'string'
          ? prev.currentSessionId
          : '',
  });
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
    isOnline: true,
    lastSeenAt: new Date().toISOString(),
  });

  const executeAttempt = async () => {
    let diagStep = 'get';
    let diagPrimaryErr = '';
    let diagExisted = false;
    let diagHadTs = false;
    let diagExtraCount = 0;
    let diagMissingCount = 0;
    let diagPayloadSummary = summarizePresenceDiag(params.uid, cleanProfile);
    try {
      const snap = await getDocFromServer(ref).catch(() => getDoc(ref));

      const selfHealFromServer = async (fallbackPrev: DocumentData = {}) => {
        diagStep = 'selfHeal_get';
        const freshSnap = await getDocFromServer(ref).catch(() => snap);
        if (!freshSnap.exists()) {
          diagStep = 'selfHeal_create';
          diagExisted = false;
          await setDoc(ref, {
            ...cleanProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }
        const freshData = freshSnap.data() || fallbackPrev;
        diagExisted = true;
        diagHadTs = isFirestoreTimestampValue(freshData.createdAt);
        const { missingDataKeys, extraKeys } = inspectUserPresenceDocKeys(freshData);
        diagMissingCount = missingDataKeys.length;
        diagExtraCount = extraKeys.length;
        diagStep = 'selfHeal_repair_update';
        const repaired = buildRepairedUserPresenceDoc(
          {
            uid: params.uid,
            email: params.email,
            displayName: cleanProfile.displayName,
            firstName: cleanProfile.firstName,
            lastName: cleanProfile.lastName,
            phonePro: cleanProfile.phonePro,
            avatarDataUrl: cleanProfile.avatarDataUrl,
            role: params.role,
            zone: cleanProfile.zone,
          },
          freshData,
          {
            isOnline: true,
            lastSeenAt: cleanProfile.lastSeenAt,
          }
        );
        diagPayloadSummary = summarizePresenceDiag(params.uid, repaired, freshData);
        await repairExistingUserPresenceDoc(ref, freshData, repaired);
      };

      if (!snap.exists()) {
        diagStep = 'create_new';
        diagExisted = false;
        try {
          await setDoc(ref, {
            ...cleanProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        } catch (primaryErr) {
          diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
          await selfHealFromServer();
          return;
        }
      }

      const prev = snap.data();
      diagExisted = true;
      diagHadTs = isFirestoreTimestampValue(prev.createdAt);
      const { missingDataKeys, extraKeys } = inspectUserPresenceDocKeys(prev);
      diagMissingCount = missingDataKeys.length;
      diagExtraCount = extraKeys.length;
      const hasCoreSchema =
        prev.uid === params.uid &&
        prev.orgScope === 'orange_pro_team' &&
        typeof prev.email === 'string' &&
        prev.email.length >= 3 &&
        typeof prev.role === 'string' &&
        VALID_TEAM_ROLES.has(prev.role as never) &&
        diagHadTs &&
        diagMissingCount === 0 &&
        diagExtraCount === 0;

      if (hasCoreSchema) {
        diagStep = 'fast_update';
        diagPayloadSummary = summarizePresenceDiag(params.uid, cleanProfile, prev);
        try {
          await updateDoc(ref, {
            displayName: cleanProfile.displayName,
            firstName: cleanProfile.firstName,
            lastName: cleanProfile.lastName,
            phonePro: cleanProfile.phonePro,
            avatarDataUrl: cleanProfile.avatarDataUrl,
            ...(prev.role !== cleanProfile.role ? { role: cleanProfile.role } : {}),
            zone: cleanProfile.zone,
            isOnline: true,
            lastSeenAt: cleanProfile.lastSeenAt,
            updatedAt: serverTimestamp(),
          });
          return;
        } catch (primaryErr) {
          diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
          await selfHealFromServer(prev);
          return;
        }
      } else {
        await selfHealFromServer(prev);
      }
    } catch (innerErr) {
      throw withPresenceStepTag(
        innerErr,
        `step=${diagStep};exists=${diagExisted};hadTs=${diagHadTs};miss=${diagMissingCount};extra=${diagExtraCount}${diagPrimaryErr ? `;firstErr=${diagPrimaryErr.slice(0, 80)}` : ''};${diagPayloadSummary}`
      );
    }
  };

  try {
    await ensureFreshAuthUser(params.uid);
    try {
      await executeAttempt();
    } catch (firstErr) {
      if (isPermissionDeniedError(firstErr)) {
        await ensureFreshAuthUser(params.uid, true);
        await executeAttempt();
      } else {
        throw firstErr;
      }
    }
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
  let nextDevices: string[] = [clampUtf8Bytes(params.deviceLabel, 160)];
  let closedPriorSession = false;

  const executeAttempt = async () => {
    let diagStep = 'get';
    let diagPrimaryErr = '';
    let diagExisted = false;
    let diagHadTs = false;
    let diagExtraCount = 0;
    let diagMissingCount = 0;
    let diagPayloadSummary = '';

    try {
      const snap = await getDocFromServer(presRef).catch(() => getDoc(presRef));

      const computePayloadFromBase = (base: DocumentData | null) => {
        if (base) {
          const sameDay = base.activeDateKey === params.dateKey;
          nextTodaySeconds = sameDay
            ? Math.max(0, Math.round(Number(base.todayWorkedSeconds) || 0))
            : 0;
          nextTotalSeconds = Math.max(0, Math.round(Number(base.totalWorkedSeconds) || 0));
          nextDisconnectCount = Math.max(
            0,
            Math.round(Number(base.workHoursDisconnectCount) || 0)
          );
          nextDisconnectTimes = Array.isArray(base.workHoursDisconnectTimes)
            ? (base.workHoursDisconnectTimes as string[])
            : [];
          nextLastWorkDisconnectAt =
            typeof base.lastWorkDisconnectAt === 'string' ? base.lastWorkDisconnectAt : '';
          nextLastLogoutAt = typeof base.lastLogoutAt === 'string' ? base.lastLogoutAt : '';
          const prevDevices = Array.isArray(base.devicesUsed)
            ? (base.devicesUsed as string[])
            : [];
          nextDevices = buildDeviceHistoryList(prevDevices, params.deviceLabel, 12);
        }

        if (closedPriorSession && params.pendingAbruptClosure) {
          nextLastLogoutAt = params.pendingAbruptClosure.logoutAtIso;
          if (params.pendingAbruptClosure.duringWorkHours) {
            nextDisconnectCount += 1;
            nextLastWorkDisconnectAt = params.pendingAbruptClosure.logoutAtIso;
            const entry = buildWorkDisconnectEntry(
              params.pendingAbruptClosure.logoutAtIso,
              params.pendingAbruptClosure.reason
            );
            nextDisconnectTimes = [entry, ...nextDisconnectTimes.filter((x) => x !== entry)].slice(
              0,
              30
            );
          }
        }

        return sanitizeUserPresencePayload({
          uid: params.uid,
          email:
            base && typeof base.email === 'string' && base.email.length >= 3
              ? base.email
              : params.email,
          displayName: params.displayName,
          firstName,
          lastName,
          phonePro:
            params.phonePro.trim().length > 0
              ? params.phonePro
              : base && typeof base.phonePro === 'string'
                ? base.phonePro
                : '',
          avatarDataUrl:
            params.avatarDataUrl.trim().length > 0
              ? params.avatarDataUrl
              : base && typeof base.avatarDataUrl === 'string'
                ? base.avatarDataUrl
                : '',
          role: VALID_TEAM_ROLES.has(params.role as never)
            ? params.role
            : base && typeof base.role === 'string' && VALID_TEAM_ROLES.has(base.role as never)
              ? base.role
              : params.role,
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
      };

      const selfHealFromServer = async () => {
        diagStep = 'selfHeal_get';
        const freshSnap = await getDocFromServer(presRef);
        if (!freshSnap.exists()) {
          diagStep = 'selfHeal_create';
          diagExisted = false;
          const freshPres = computePayloadFromBase(null);
          diagPayloadSummary = summarizePresenceDiag(params.uid, freshPres);
          await setDoc(presRef, {
            ...freshPres,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }
        const freshData = freshSnap.data();
        diagExisted = true;
        diagHadTs = isFirestoreTimestampValue(freshData.createdAt);
        const { missingDataKeys, extraKeys } = inspectUserPresenceDocKeys(freshData);
        diagMissingCount = missingDataKeys.length;
        diagExtraCount = extraKeys.length;
        diagStep = 'selfHeal_repair_update';
        const repairedPres = computePayloadFromBase(freshData);
        diagPayloadSummary = summarizePresenceDiag(params.uid, repairedPres, freshData);
        await repairExistingUserPresenceDoc(presRef, freshData, repairedPres);
      };

      if (snap.exists()) {
        const prev = snap.data();
        diagExisted = true;
        diagHadTs = isFirestoreTimestampValue(prev.createdAt);

        // Flush unclosed session from an earlier browser/network closure if user was away >= 2 min
        if (
          !closedPriorSession &&
          params.pendingAbruptClosure &&
          params.pendingAbruptClosure.previousSessionId
        ) {
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
              closedPriorSession = true;
              await updateDoc(oldSessRef, {
                lastSeenAt: clampUtf8Bytes(params.pendingAbruptClosure.logoutAtIso, 64),
                logoutAt: clampUtf8Bytes(params.pendingAbruptClosure.logoutAtIso, 64),
                workedSeconds: Math.min(
                  86400,
                  Math.max(0, Math.round(params.pendingAbruptClosure.workedSeconds))
                ),
                status: params.pendingAbruptClosure.duringWorkHours
                  ? 'disconnected_work_hours'
                  : 'closed',
                disconnectReason: clampUtf8Bytes(params.pendingAbruptClosure.reason, 80),
                disconnectedDuringWorkHours: params.pendingAbruptClosure.duringWorkHours,
                updatedAt: serverTimestamp(),
              });
            }
          } catch {
            // Non-fatal cleanup of prior session
          }
        }

        const cleanPres = computePayloadFromBase(prev);
        diagPayloadSummary = summarizePresenceDiag(params.uid, cleanPres, prev);
        const { missingDataKeys, extraKeys } = inspectUserPresenceDocKeys(prev);
        diagMissingCount = missingDataKeys.length;
        diagExtraCount = extraKeys.length;
        const hasValidFullSchema =
          prev.uid === params.uid &&
          prev.orgScope === 'orange_pro_team' &&
          typeof prev.email === 'string' &&
          prev.email.length >= 3 &&
          typeof prev.role === 'string' &&
          VALID_TEAM_ROLES.has(prev.role as never) &&
          diagHadTs &&
          diagMissingCount === 0 &&
          diagExtraCount === 0;

        if (hasValidFullSchema) {
          diagStep = 'fast_update';
          try {
            await updateDoc(presRef, {
              displayName: cleanPres.displayName,
              firstName: cleanPres.firstName,
              lastName: cleanPres.lastName,
              phonePro: cleanPres.phonePro,
              avatarDataUrl: cleanPres.avatarDataUrl,
              ...(prev.role !== cleanPres.role ? { role: cleanPres.role } : {}),
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
            return;
          } catch (primaryErr) {
            diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            await selfHealFromServer();
            return;
          }
        } else {
          diagStep = 'legacy_repair_update';
          try {
            await repairExistingUserPresenceDoc(presRef, prev, cleanPres);
            return;
          } catch (primaryErr) {
            diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
            await selfHealFromServer();
            return;
          }
        }
      } else {
        diagStep = 'create_new';
        diagExisted = false;
        const cleanPres = computePayloadFromBase(null);
        diagPayloadSummary = summarizePresenceDiag(params.uid, cleanPres);
        try {
          await setDoc(presRef, {
            ...cleanPres,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        } catch (primaryErr) {
          diagPrimaryErr = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
          await selfHealFromServer();
          return;
        }
      }
    } catch (innerErr) {
      throw withPresenceStepTag(
        innerErr,
        `step=${diagStep};exists=${diagExisted};hadTs=${diagHadTs};miss=${diagMissingCount};extra=${diagExtraCount}${diagPrimaryErr ? `;firstErr=${diagPrimaryErr.slice(0, 80)}` : ''}${diagPayloadSummary ? `;${diagPayloadSummary}` : ''}`
      );
    }
  };

  try {
    await ensureFreshAuthUser(params.uid);
    try {
      await executeAttempt();
    } catch (firstErr) {
      if (isPermissionDeniedError(firstErr)) {
        await ensureFreshAuthUser(params.uid, true);
        await executeAttempt();
      } else {
        throw firstErr;
      }
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
  fallbackProfile?: {
    email: string;
    displayName: string;
    role: TeamRole;
    zone: string;
    phonePro?: string;
    avatarDataUrl?: string;
  };
}): Promise<{ todayWorkedSeconds: number; totalWorkedSeconds: number }> {
  const presRef = doc(db, 'user_presence', params.uid);
  const sessRef = doc(db, 'user_presence', params.uid, 'sessions', params.sessionId);
  let safeToday = Math.min(86400, Math.max(0, Math.round(params.todayWorkedSeconds)));
  let safeTotal = Math.min(100000000, Math.max(0, Math.round(params.totalWorkedSeconds)));
  const safeSession = Math.min(86400, Math.max(0, Math.round(params.sessionWorkedSeconds)));
  const safeDeviceLabel = clampUtf8Bytes(params.deviceLabel.trim(), 160);
  const safeNowIso = clampUtf8Bytes(params.nowIso.trim(), 64);
  const safeDateKey = clampUtf8Bytes(params.dateKey.trim(), 16);
  const safeSessionId = clampUtf8Bytes(params.sessionId.trim(), 128);

  const safeZone = params.fallbackProfile?.zone
    ? clampUtf8Bytes(params.fallbackProfile.zone.trim(), 80)
    : undefined;

  if (!auth.currentUser || auth.currentUser.uid !== params.uid) {
    return { todayWorkedSeconds: safeToday, totalWorkedSeconds: safeTotal };
  }

  const fastHeartbeatPayload: DocumentData = {
    isOnline: true,
    currentDevice: safeDeviceLabel,
    lastSeenAt: safeNowIso,
    activeDateKey: safeDateKey,
    todayWorkedSeconds: safeToday,
    totalWorkedSeconds: safeTotal,
    currentSessionId: safeSessionId,
    updatedAt: serverTimestamp(),
  };
  if (safeZone) {
    fastHeartbeatPayload.zone = safeZone;
  }

  try {
    await updateDoc(presRef, fastHeartbeatPayload);
  } catch (firstErr) {
    // Self-healing reconciliation from server (fixes expired mobile wake token, multi-device counter skew, stale cache, or legacy schema)
    try {
      if (isPermissionDeniedError(firstErr)) {
        await ensureFreshAuthUser(params.uid, true);
        try {
          await updateDoc(presRef, fastHeartbeatPayload);
          try {
            await updateDoc(sessRef, {
              lastSeenAt: safeNowIso,
              workedSeconds: safeSession,
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Non-fatal
          }
          return { todayWorkedSeconds: safeToday, totalWorkedSeconds: safeTotal };
        } catch {
          // Fall through to full server reconciliation
        }
      }

      const snap = await getDocFromServer(presRef).catch(() => getDoc(presRef));
      if (snap.exists()) {
        const prev = snap.data();
        const sameDay = prev.activeDateKey === safeDateKey;
        const prevToday = Math.max(0, Math.round(Number(prev.todayWorkedSeconds) || 0));
        const prevTotal = Math.max(0, Math.round(Number(prev.totalWorkedSeconds) || 0));
        const deltaGuess = sameDay
          ? Math.min(120, Math.max(0, safeToday - prevToday))
          : Math.min(120, Math.max(0, safeToday));
        safeToday = sameDay
          ? Math.min(86400, Math.max(prevToday, prevToday + deltaGuess))
          : Math.min(86400, Math.max(0, deltaGuess));
        const totalDelta = Math.min(120, Math.max(deltaGuess, safeTotal - prevTotal));
        safeTotal = Math.min(100000000, Math.max(prevTotal, prevTotal + Math.max(0, totalDelta)));

        const prevDevices = Array.isArray(prev.devicesUsed) ? (prev.devicesUsed as string[]) : [];
        const nextDevices = buildDeviceHistoryList(prevDevices, safeDeviceLabel, 12);

        const hasValidHeader =
          prev.uid === params.uid &&
          prev.orgScope === 'orange_pro_team' &&
          typeof prev.email === 'string' &&
          prev.email.length >= 3 &&
          typeof prev.role === 'string' &&
          isFirestoreTimestampValue(prev.createdAt);

        let recoveredViaUpdate = false;
        if (hasValidHeader) {
          try {
            await updateDoc(presRef, {
              isOnline: true,
              currentDevice: safeDeviceLabel,
              ...(safeZone ? { zone: safeZone } : {}),
              devicesUsed: nextDevices,
              lastSeenAt: safeNowIso,
              activeDateKey: safeDateKey,
              todayWorkedSeconds: safeToday,
              totalWorkedSeconds: safeTotal,
              currentSessionId: safeSessionId,
              updatedAt: serverTimestamp(),
            });
            recoveredViaUpdate = true;
          } catch {
            recoveredViaUpdate = false;
          }
        }

        if (!recoveredViaUpdate) {
          const fallbackName =
            params.fallbackProfile?.displayName ||
            (typeof prev.displayName === 'string' ? prev.displayName : 'Collaborateur');
          const { firstName, lastName } = splitFirstAndLastName(fallbackName);
          const repaired = buildRepairedUserPresenceDoc(
            {
              uid: params.uid,
              email:
                typeof prev.email === 'string' && prev.email.length >= 3
                  ? prev.email
                  : params.fallbackProfile?.email || '',
              displayName: fallbackName,
              firstName,
              lastName,
              phonePro:
                params.fallbackProfile?.phonePro ||
                (typeof prev.phonePro === 'string' ? prev.phonePro : ''),
              avatarDataUrl:
                params.fallbackProfile?.avatarDataUrl ||
                (typeof prev.avatarDataUrl === 'string' ? prev.avatarDataUrl : ''),
              role: typeof prev.role === 'string' ? (prev.role as TeamRole) : params.fallbackProfile?.role || 'commercial',
              zone:
                params.fallbackProfile?.zone ||
                (typeof prev.zone === 'string' ? prev.zone : 'Meknès'),
            },
            prev,
            {
              isOnline: true,
              currentDevice: safeDeviceLabel,
              devicesUsed: nextDevices,
              lastLoginAt:
                typeof prev.lastLoginAt === 'string' && prev.lastLoginAt ? prev.lastLoginAt : safeNowIso,
              lastSeenAt: safeNowIso,
              activeDateKey: safeDateKey,
              todayWorkedSeconds: safeToday,
              totalWorkedSeconds: safeTotal,
              currentSessionId: safeSessionId,
            }
          );
          await repairExistingUserPresenceDoc(presRef, prev, repaired);
        }
      } else if (params.fallbackProfile) {
        const { firstName, lastName } = splitFirstAndLastName(params.fallbackProfile.displayName);
        const cleanPres = sanitizeUserPresencePayload({
          uid: params.uid,
          email: params.fallbackProfile.email,
          displayName: params.fallbackProfile.displayName,
          firstName,
          lastName,
          phonePro: params.fallbackProfile.phonePro || '',
          avatarDataUrl: params.fallbackProfile.avatarDataUrl || '',
          role: params.fallbackProfile.role,
          zone: params.fallbackProfile.zone,
          isOnline: true,
          currentDevice: safeDeviceLabel,
          devicesUsed: [safeDeviceLabel],
          lastLoginAt: safeNowIso,
          lastSeenAt: safeNowIso,
          activeDateKey: safeDateKey,
          todayWorkedSeconds: Math.min(120, safeToday),
          totalWorkedSeconds: Math.min(120, safeTotal),
          currentSessionId: safeSessionId,
        });
        safeToday = cleanPres.todayWorkedSeconds;
        safeTotal = cleanPres.totalWorkedSeconds;
        await setDoc(presRef, {
          ...cleanPres,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (hbErr) {
      const fbHbErr = hbErr as { code?: string; message?: string };
      console.warn('[PresenceDebug] Échec heartbeatAttendanceSession', {
        uid: params.uid,
        sessionId: safeSessionId,
        code: fbHbErr?.code || 'unknown',
        message: fbHbErr?.message || (hbErr instanceof Error ? hbErr.message : String(hbErr)),
      });
    }
  }

  try {
    await updateDoc(sessRef, {
      lastSeenAt: safeNowIso,
      workedSeconds: safeSession,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if session doc hasn't settled yet
  }

  return { todayWorkedSeconds: safeToday, totalWorkedSeconds: safeTotal };
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
  isManualSignOut?: boolean;
}): Promise<void> {
  const presRef = doc(db, 'user_presence', params.uid);
  const sessRef = doc(db, 'user_presence', params.uid, 'sessions', params.sessionId);
  let safeToday = Math.min(86400, Math.max(0, Math.round(params.todayWorkedSeconds)));
  let safeTotal = Math.min(100000000, Math.max(0, Math.round(params.totalWorkedSeconds)));
  const safeSession = Math.min(86400, Math.max(0, Math.round(params.sessionWorkedSeconds)));
  const cleanReason = clampUtf8Bytes(params.reason.trim(), 80) || 'Déconnexion';
  const safeLogoutIso = clampUtf8Bytes(params.logoutAtIso.trim(), 64);
  const safeDateKey = clampUtf8Bytes(params.dateKey.trim(), 16);

  try {
    await ensureFreshAuthUser(params.uid);
    const snap = await getDocFromServer(presRef).catch(() => getDoc(presRef));
    if (snap.exists()) {
      const prev = snap.data();
      const activeServerSessionId =
        typeof prev.currentSessionId === 'string' ? prev.currentSessionId : '';

      // If another device/tab took over as the active session and this is only a tab close (not manual sign-out),
      // do NOT flip the collaborator's global status to Hors Ligne!
      const anotherSessionIsActive =
        !params.isManualSignOut &&
        Boolean(activeServerSessionId) &&
        activeServerSessionId !== params.sessionId;

      if (!anotherSessionIsActive) {
        const sameDay = prev.activeDateKey === safeDateKey;
        const prevToday = Math.max(0, Math.round(Number(prev.todayWorkedSeconds) || 0));
        const prevTotal = Math.max(0, Math.round(Number(prev.totalWorkedSeconds) || 0));
        if (sameDay) {
          safeToday = Math.min(86400, Math.max(prevToday, Math.min(prevToday + 550, safeToday)));
        } else {
          safeToday = Math.min(550, Math.max(0, safeToday));
        }
        safeTotal = Math.min(100000000, Math.max(prevTotal, Math.min(prevTotal + 550, safeTotal)));

        let disconnectCount = Math.max(0, Math.round(Number(prev.workHoursDisconnectCount) || 0));
        let disconnectTimes = Array.isArray(prev.workHoursDisconnectTimes)
          ? (prev.workHoursDisconnectTimes as string[])
          : [];
        let lastWorkDisconnectAt =
          typeof prev.lastWorkDisconnectAt === 'string' ? prev.lastWorkDisconnectAt : '';

        if (params.duringWorkHours) {
          disconnectCount += 1;
          lastWorkDisconnectAt = safeLogoutIso;
          const entry = buildWorkDisconnectEntry(safeLogoutIso, cleanReason);
          disconnectTimes = [entry, ...disconnectTimes.filter((x) => x !== entry)].slice(0, 30);
        }

        try {
          await updateDoc(presRef, {
            isOnline: false,
            lastLogoutAt: safeLogoutIso,
            lastSeenAt: safeLogoutIso,
            lastWorkDisconnectAt: clampUtf8Bytes(lastWorkDisconnectAt, 64),
            workHoursDisconnectCount: disconnectCount,
            workHoursDisconnectTimes: disconnectTimes,
            activeDateKey: safeDateKey,
            todayWorkedSeconds: safeToday,
            totalWorkedSeconds: safeTotal,
            currentSessionId: '',
            updatedAt: serverTimestamp(),
          });
        } catch {
          const fallbackName =
            typeof prev.displayName === 'string' && prev.displayName.trim()
              ? prev.displayName
              : 'Collaborateur';
          const { firstName, lastName } = splitFirstAndLastName(fallbackName);
          const repaired = buildRepairedUserPresenceDoc(
            {
              uid: params.uid,
              email: typeof prev.email === 'string' ? prev.email : '',
              displayName: fallbackName,
              firstName: typeof prev.firstName === 'string' ? prev.firstName : firstName,
              lastName: typeof prev.lastName === 'string' ? prev.lastName : lastName,
              phonePro: typeof prev.phonePro === 'string' ? prev.phonePro : '',
              avatarDataUrl: typeof prev.avatarDataUrl === 'string' ? prev.avatarDataUrl : '',
              role: (typeof prev.role === 'string' ? prev.role : 'commercial') as TeamRole,
              zone: typeof prev.zone === 'string' ? prev.zone : 'Meknès',
            },
            prev,
            {
              isOnline: false,
              lastLogoutAt: safeLogoutIso,
              lastSeenAt: safeLogoutIso,
              lastWorkDisconnectAt,
              workHoursDisconnectCount: disconnectCount,
              workHoursDisconnectTimes: disconnectTimes,
              activeDateKey: safeDateKey,
              todayWorkedSeconds: safeToday,
              totalWorkedSeconds: safeTotal,
              currentSessionId: '',
            }
          );
          await repairExistingUserPresenceDoc(presRef, prev, repaired);
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `user_presence/${params.uid}`);
  }

  try {
    await updateDoc(sessRef, {
      lastSeenAt: safeLogoutIso,
      logoutAt: safeLogoutIso,
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
    const q = query(
      collection(db, 'users', uid, 'fiches', ficheId, 'activites'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    const list: SanitizedActiviteDoc[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let resolvedCreatedAtIso =
        typeof d.createdAtIso === 'string' && d.createdAtIso.trim()
          ? d.createdAtIso.trim()
          : '';
      if (!resolvedCreatedAtIso && d.createdAt && typeof d.createdAt.toDate === 'function') {
        try {
          resolvedCreatedAtIso = d.createdAt.toDate().toISOString();
        } catch {
          resolvedCreatedAtIso = '';
        }
      }
      list.push(
        sanitizeActivitePayload(uid, ficheId, {
          id: docSnap.id,
          type: d.type,
          resultat: d.resultat,
          texte: typeof d.texte === 'string' ? d.texte : '',
          auteurNom: typeof d.auteurNom === 'string' ? d.auteurNom : '',
          auteurUid: typeof d.auteurUid === 'string' ? d.auteurUid : undefined,
          auteurRole: typeof d.auteurRole === 'string' ? d.auteurRole : undefined,
          createdAtIso: resolvedCreatedAtIso || undefined,
          rdvAt: typeof d.rdvAt === 'string' ? d.rdvAt : undefined,
          rdvLieu: typeof d.rdvLieu === 'string' ? d.rdvLieu : undefined,
          prochaineRelanceAt: typeof d.prochaineRelanceAt === 'string' ? d.prochaineRelanceAt : undefined,
        })
      );
    });
    // Tri chronologique décroissant par date/heure exacte (puis id)
    list.sort((a, b) => {
      const ta = a.createdAtIso ? Date.parse(a.createdAtIso) : 0;
      const tb = b.createdAtIso ? Date.parse(b.createdAtIso) : 0;
      if (tb !== ta) return tb - ta;
      return b.id.localeCompare(a.id);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, actPath);
  }
}

/**
 * Journal d'audit immuable (sous-collection /users/{uid}/fiches/{ficheId}/audit_logs/{logId})
 * Enregistre chaque modification avec acteur, rôle, champ, ancienne/nouvelle valeur, date et heure exacte.
 */
export async function saveFicheAuditLog(
  ownerUid: string,
  ficheId: string,
  input: FicheAuditLogLike
): Promise<SanitizedFicheAuditLogDoc | null> {
  if (!ownerUid || !ficheId) return null;
  const sanitized = sanitizeFicheAuditLogPayload(ownerUid, ficheId, {
    ...input,
    createdAtIso: input.createdAtIso || new Date().toISOString(),
  });
  const ref = doc(db, 'users', ownerUid, 'fiches', ficheId, 'audit_logs', sanitized.id);
  try {
    await setDoc(ref, {
      ...sanitized,
      createdAt: serverTimestamp(),
    });
    return sanitized;
  } catch {
    // Non-bloquant pour ne jamais casser une saisie CRM en cas de latence réseau
    return null;
  }
}

export async function fetchFicheAuditLogs(
  ownerUid: string,
  ficheId: string
): Promise<SanitizedFicheAuditLogDoc[]> {
  const auditPath = `users/${ownerUid}/fiches/${ficheId}/audit_logs`;
  try {
    const q = query(
      collection(db, 'users', ownerUid, 'fiches', ficheId, 'audit_logs'),
      where('ownerId', '==', ownerUid)
    );
    const snap = await getDocs(q);
    const list: SanitizedFicheAuditLogDoc[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      let resolvedIso =
        typeof d.createdAtIso === 'string' && d.createdAtIso.trim()
          ? d.createdAtIso.trim()
          : '';
      if (!resolvedIso && d.createdAt && typeof d.createdAt.toDate === 'function') {
        try {
          resolvedIso = d.createdAt.toDate().toISOString();
        } catch {
          resolvedIso = '';
        }
      }
      list.push(
        sanitizeFicheAuditLogPayload(ownerUid, ficheId, {
          id: docSnap.id,
          action: d.action,
          field: typeof d.field === 'string' ? d.field : undefined,
          oldValue: typeof d.oldValue === 'string' ? d.oldValue : undefined,
          newValue: typeof d.newValue === 'string' ? d.newValue : undefined,
          summary: typeof d.summary === 'string' ? d.summary : '',
          actorUid: typeof d.actorUid === 'string' ? d.actorUid : ownerUid,
          actorName: typeof d.actorName === 'string' ? d.actorName : 'Collaborateur',
          actorRole: typeof d.actorRole === 'string' ? d.actorRole : undefined,
          createdAtIso: resolvedIso || undefined,
        })
      );
    });
    list.sort((a, b) => {
      const ta = a.createdAtIso ? Date.parse(a.createdAtIso) : 0;
      const tb = b.createdAtIso ? Date.parse(b.createdAtIso) : 0;
      if (tb !== ta) return tb - ta;
      return b.id.localeCompare(a.id);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, auditPath);
  }
}

/**
 * LOT 6: Consultation des fiches d'un collaborateur actif
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
 * Charge le portefeuille complet de tous les collaborateurs de la plateforme (Superviseurs).
 */
export async function fetchAllTeamPortfolios(
  memberUids: string[]
): Promise<Record<string, SanitizedFicheDoc[]>> {
  const uniqueUids = Array.from(new Set(memberUids.filter((u) => typeof u === 'string' && u.trim())));
  const settled = await Promise.allSettled(
    uniqueUids.map(async (uid) => ({
      uid,
      fiches: await fetchTeamMemberFiches(uid),
    }))
  );
  const result: Record<string, SanitizedFicheDoc[]> = {};
  for (let i = 0; i < uniqueUids.length; i++) {
    const item = settled[i];
    if (item.status === 'fulfilled') {
      result[item.value.uid] = item.value.fiches;
    } else {
      result[uniqueUids[i]] = [];
    }
  }
  return result;
}

/**
 * Notifications temps réel inter-utilisateurs (/notifications/{notifId})
 */
export function getUserNotificationsQuery(uid: string) {
  return query(collection(db, 'notifications'), where('recipientUid', '==', uid));
}

export async function createCloudNotification(
  input: CloudNotificationLike
): Promise<SanitizedCloudNotificationDoc | null> {
  if (!input.recipientUid || !input.senderUid) return null;
  const sanitized = sanitizeCloudNotificationPayload({
    ...input,
    read: false,
    createdAtIso: input.createdAtIso || new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'notifications', sanitized.id), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return sanitized;
  } catch {
    // Non-bloquant pour les workflows CRM
    return null;
  }
}

export async function markCloudNotificationRead(notifId: string): Promise<void> {
  if (!notifId) return;
  try {
    await updateDoc(doc(db, 'notifications', notifId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

export async function markAllCloudNotificationsRead(notifIds: string[]): Promise<void> {
  const cleanIds = Array.from(new Set(notifIds.filter(Boolean))).slice(0, 100);
  if (cleanIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of cleanIds) {
      batch.update(doc(db, 'notifications', id), {
        read: true,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch {
    // Fallback individual update if one doc was deleted
    await Promise.allSettled(cleanIds.map((id) => markCloudNotificationRead(id)));
  }
}

/**
 * Mise à jour d'une fiche d'un collaborateur par un superviseur (Super-Admin / Manager / Chef d'équipe)
 */
export async function updateTeamMemberFiche(
  ownerUid: string,
  fiche: FicheLike
): Promise<SanitizedFicheDoc> {
  const sanitized = sanitizeFichePayload(ownerUid, fiche);
  const path = `users/${ownerUid}/fiches/${sanitized.id}`;
  try {
    await updateDoc(doc(db, 'users', ownerUid, 'fiches', sanitized.id), {
      ...buildMutableFicheUpdate(sanitized),
      updatedAt: serverTimestamp(),
    });
    return sanitized;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Attribuer ou réattribuer une fiche (y compris une fiche signée/verrouillée) à un collaborateur.
 * Déplace la fiche + son historique d'activités vers le portefeuille cible, journalise l'attribution,
 * et envoie une notification cloud temps réel au collaborateur destinataire.
 */
export async function transferFicheToCollaborator(params: {
  fiche: FicheLike;
  sourceOwnerUid: string;
  sourceOwnerName: string;
  targetOwnerUid: string;
  targetOwnerName: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  nextStatut?: string;
  note?: string;
}): Promise<SanitizedFicheDoc> {
  const nowIso = new Date().toISOString();
  const nextStatut = params.nextStatut || params.fiche.statut;
  const targetFiche = sanitizeFichePayload(params.targetOwnerUid, {
    ...params.fiche,
    statut: nextStatut,
    statutUpdatedAt: nowIso,
    assignedByUid: params.actorUid,
    assignedByName: params.actorName,
    assignedAt: nowIso,
  });

  const targetRef = doc(db, 'users', params.targetOwnerUid, 'fiches', targetFiche.id);
  const targetPath = `users/${params.targetOwnerUid}/fiches/${targetFiche.id}`;

  // 1. Load source activities & audit logs before deleting source (if transferring between two users)
  let sourceActivities: SanitizedActiviteDoc[] = [];
  let sourceAuditLogs: SanitizedFicheAuditLogDoc[] = [];
  if (params.sourceOwnerUid !== params.targetOwnerUid) {
    try {
      sourceActivities = await fetchFicheActivites(params.sourceOwnerUid, params.fiche.id);
    } catch {
      sourceActivities = [];
    }
    try {
      sourceAuditLogs = await fetchFicheAuditLogs(params.sourceOwnerUid, params.fiche.id);
    } catch {
      sourceAuditLogs = [];
    }
  }

  // 2. Write or update fiche in target user's subcollection
  try {
    const existingSnap = await getDoc(targetRef);
    if (existingSnap.exists()) {
      await updateDoc(targetRef, {
        ...buildMutableFicheUpdate(targetFiche),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(targetRef, {
        ...targetFiche,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }

  // 3. Migrate previous activities & audit logs into target fiche if moved between different owners
  if (params.sourceOwnerUid !== params.targetOwnerUid && sourceActivities.length > 0) {
    for (const act of sourceActivities.slice(0, 60)) {
      try {
        const migrated = sanitizeActivitePayload(params.targetOwnerUid, targetFiche.id, {
          ...act,
          ownerId: params.targetOwnerUid,
          ficheId: targetFiche.id,
        });
        await setDoc(
          doc(db, 'users', params.targetOwnerUid, 'fiches', targetFiche.id, 'activites', migrated.id),
          {
            ...migrated,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );
      } catch {
        // Non-fatal
      }
    }
  }
  if (params.sourceOwnerUid !== params.targetOwnerUid && sourceAuditLogs.length > 0) {
    for (const aud of sourceAuditLogs.slice(0, 80)) {
      try {
        const migrated = sanitizeFicheAuditLogPayload(params.targetOwnerUid, targetFiche.id, {
          ...aud,
          ownerId: params.targetOwnerUid,
          ficheId: targetFiche.id,
        });
        await setDoc(
          doc(db, 'users', params.targetOwnerUid, 'fiches', targetFiche.id, 'audit_logs', migrated.id),
          {
            ...migrated,
            createdAt: serverTimestamp(),
          }
        );
      } catch {
        // Non-fatal
      }
    }
  }

  // 4. Delete from source portfolio (including subcollections) if moved to another collaborator
  if (params.sourceOwnerUid !== params.targetOwnerUid) {
    for (const act of sourceActivities) {
      try {
        await deleteDoc(
          doc(db, 'users', params.sourceOwnerUid, 'fiches', params.fiche.id, 'activites', act.id)
        );
      } catch {
        // Non-fatal
      }
    }
    for (const aud of sourceAuditLogs) {
      try {
        await deleteDoc(
          doc(db, 'users', params.sourceOwnerUid, 'fiches', params.fiche.id, 'audit_logs', aud.id)
        );
      } catch {
        // Non-fatal
      }
    }
    try {
      await deleteDoc(doc(db, 'users', params.sourceOwnerUid, 'fiches', params.fiche.id));
    } catch {
      // Non-fatal if source doc already removed
    }
  }

  // 5. Log activity & dedicated audit entry on the target fiche
  const isReassign = params.sourceOwnerUid !== params.targetOwnerUid;
  const auditNote = [
    isReassign
      ? `Fiche attribuée à ${params.targetOwnerName} (depuis ${params.sourceOwnerName}) par ${params.actorName}.`
      : `Fiche réaffectée / confirmée sur le portefeuille de ${params.targetOwnerName} par ${params.actorName}.`,
    params.fiche.statut !== nextStatut ? `Statut mis à « ${nextStatut} ».` : '',
    params.note?.trim() ? `Note : ${params.note.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  try {
    await saveFicheActivite(params.targetOwnerUid, targetFiche.id, {
      id: `act_attr_${Date.now().toString(36)}`,
      type: 'attribution',
      resultat: 'autre',
      texte: auditNote,
      auteurNom: params.actorName,
      auteurUid: params.actorUid,
      auteurRole: params.actorRole,
      createdAtIso: nowIso,
    });
  } catch {
    // Non-fatal
  }

  await saveFicheAuditLog(params.targetOwnerUid, targetFiche.id, {
    action: 'assigned',
    field: 'ownerId',
    oldValue: params.sourceOwnerName,
    newValue: params.targetOwnerName,
    summary: auditNote,
    actorUid: params.actorUid,
    actorName: params.actorName,
    actorRole: params.actorRole,
    createdAtIso: nowIso,
  });

  // 6. Send real-time cloud notification to target collaborator (if different from actor)
  if (params.targetOwnerUid !== params.actorUid) {
    await createCloudNotification({
      recipientUid: params.targetOwnerUid,
      senderUid: params.actorUid,
      senderName: params.actorName,
      senderRole: params.actorRole,
      kind: 'fiche_assigned',
      title: `Nouvelle fiche attribuée : ${targetFiche.societe}`,
      message: `${params.actorName} vous a attribué la fiche ${targetFiche.numeroFiche || targetFiche.societe}${targetFiche.ville ? ` (${targetFiche.ville})` : ''}${params.note?.trim() ? ` — ${params.note.trim()}` : ''}.`,
      ficheId: targetFiche.id,
      ficheOwnerId: params.targetOwnerUid,
      numeroFiche: targetFiche.numeroFiche,
      societe: targetFiche.societe,
      targetTab: 'crm',
      createdAtIso: nowIso,
    });
  }

  return targetFiche;
}

/**
 * Restituer une fiche signée/verrouillée à son collaborateur (la déverrouille et change son statut CRM)
 * avec suivi d'audit complet et notification temps réel.
 */
export async function restoreSignedFicheToCollaborator(params: {
  fiche: FicheLike;
  ownerUid: string;
  ownerName: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  nextStatut: string;
  reason: string;
}): Promise<SanitizedFicheDoc> {
  const nowIso = new Date().toISOString();
  const cleanReason = params.reason.trim().slice(0, 300) || 'Restitution par la supervision';
  const updatedFiche = sanitizeFichePayload(params.ownerUid, {
    ...params.fiche,
    statut: params.nextStatut,
    statutUpdatedAt: nowIso,
    restoredByName: params.actorName,
    restoredAt: nowIso,
    restoredReason: cleanReason,
  });

  await updateTeamMemberFiche(params.ownerUid, updatedFiche);

  // Audit log (activity + dedicated audit_logs sub-collection)
  try {
    await saveFicheActivite(params.ownerUid, updatedFiche.id, {
      id: `act_rest_${Date.now().toString(36)}`,
      type: 'restitution',
      resultat: 'autre',
      texte: `Fiche signée restituée et déverrouillée par ${params.actorName} (statut : « ${params.nextStatut} »). Motif : ${cleanReason}`,
      auteurNom: params.actorName,
      auteurUid: params.actorUid,
      auteurRole: params.actorRole,
      createdAtIso: nowIso,
    });
  } catch {
    // Non-fatal
  }

  await saveFicheAuditLog(params.ownerUid, updatedFiche.id, {
    action: 'restored',
    field: 'statut',
    oldValue: params.fiche.statut,
    newValue: params.nextStatut,
    summary: `Fiche signée restituée et déverrouillée par ${params.actorName} (statut : « ${params.nextStatut} »). Motif : ${cleanReason}`,
    actorUid: params.actorUid,
    actorName: params.actorName,
    actorRole: params.actorRole,
    createdAtIso: nowIso,
  });

  // Real-time cloud notification to collaborator
  if (params.ownerUid !== params.actorUid) {
    await createCloudNotification({
      recipientUid: params.ownerUid,
      senderUid: params.actorUid,
      senderName: params.actorName,
      senderRole: params.actorRole,
      kind: 'fiche_restored',
      title: `Fiche restituée : ${updatedFiche.societe}`,
      message: `${params.actorName} a déverrouillé et restitué la fiche ${updatedFiche.numeroFiche || updatedFiche.societe} en statut « ${params.nextStatut} » — Motif : ${cleanReason}.`,
      ficheId: updatedFiche.id,
      ficheOwnerId: params.ownerUid,
      numeroFiche: updatedFiche.numeroFiche,
      societe: updatedFiche.societe,
      targetTab: 'crm',
      createdAtIso: nowIso,
    });
  }

  return updatedFiche;
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
    payoutStatus: PayoutStatus;
    referenceVirement?: string;
    refusMotif?: string;
  }
): Promise<void> {
  await updateOrUpsertSignedContract(contractId, updates, `signed_contracts/${contractId}`);
}

async function updateOrUpsertSignedContract(
  contractId: string,
  updates: {
    produitOrangePro: string;
    tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
    payoutMad: number;
    payoutStatus: PayoutStatus;
    referenceVirement?: string;
    refusMotif?: string;
  },
  operationPath: string
): Promise<void> {
  const cleanProduit = clampUtf8Bytes(updates.produitOrangePro.trim(), 200) || 'Pack Orange Pro';
  const cleanPayout = Math.min(10000000, Math.max(0, Math.round(Number(updates.payoutMad) || 0)));
  const cleanRef =
    typeof updates.referenceVirement === 'string'
      ? clampUtf8Bytes(updates.referenceVirement.trim(), 80)
      : '';
  const cleanMotif =
    typeof updates.refusMotif === 'string' ? clampUtf8Bytes(updates.refusMotif.trim(), 200) : '';

  if (updates.payoutStatus === 'Versé' && !cleanRef) {
    throw new Error('Une référence de virement bancaire est obligatoire pour passer le contrat au statut « Versé ».');
  }
  if (updates.payoutStatus === 'Refusé' && !cleanMotif) {
    throw new Error('Un motif de refus est obligatoire pour rejeter le contrat.');
  }

  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('Session Firebase expirée : reconnectez-vous pour mettre à jour ce contrat.');
  }

  try {
    const docRef = doc(db, 'signed_contracts', contractId);
    const snap = await getDocFromServer(docRef).catch(() => getDoc(docRef));
    if (!snap.exists()) {
      throw new Error(`Le contrat « ${contractId} » est introuvable sur le serveur.`);
    }

    const prev = snap.data() as Record<string, unknown>;
    const payload: DocumentData = {
      produitOrangePro: cleanProduit,
      tier: updates.tier,
      payoutMad: cleanPayout,
      payoutStatus: updates.payoutStatus,
      updatedAt: serverTimestamp(),
    };
    if (cleanRef) {
      payload.referenceVirement = cleanRef;
    } else if ('referenceVirement' in prev) {
      payload.referenceVirement = deleteField();
    }
    if (cleanMotif) {
      payload.refusMotif = cleanMotif;
    } else if ('refusMotif' in prev) {
      payload.refusMotif = deleteField();
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, operationPath);
  }
}

// =========================================================================
// DISCUSSION DIRECTE TEMPS RÉEL (Super-Admin <-> Collaborateur, 0 API externe)
// =========================================================================

export function getDirectChatChannelsQuery() {
  return query(collection(db, 'direct_chats'), where('orgScope', '==', 'orange_pro_team'));
}

export function getDirectChatChannelDocRef(collabUid: string) {
  return doc(db, 'direct_chats', collabUid);
}

export function getDirectChatMessagesQuery(collabUid: string) {
  return query(
    collection(db, 'direct_chats', collabUid, 'messages'),
    where('orgScope', '==', 'orange_pro_team'),
    where('collabUid', '==', collabUid)
  );
}

export async function sendDirectChatMessage(params: {
  collabUid: string;
  collabName: string;
  collabEmail?: string;
  collabZone?: string;
  senderUid: string;
  senderName: string;
  senderRole: string;
  isSenderSuperAdmin: boolean;
  text: string;
  recipientUidForNotification?: string;
}): Promise<SanitizedDirectChatMessageDoc> {
  const nowIso = new Date().toISOString();
  const cleanText = clampUtf8Bytes(params.text.trim(), 2000);
  if (!cleanText) {
    throw new Error('Le message ne peut pas être vide.');
  }

  const channelPath = `direct_chats/${params.collabUid}`;
  const channelRef = doc(db, 'direct_chats', params.collabUid);
  const safePreview = clampUtf8Bytes(cleanText, 500);
  const safeSenderName = clampUtf8Bytes(params.senderName.trim(), 120) || 'Utilisateur';

  const executeChannelAttempt = async () => {
    const snap = await getDocFromServer(channelRef).catch(() => getDoc(channelRef));

    const buildChannelDoc = (base: DocumentData | null) => {
      const prevUnreadAdmin = base
        ? Math.max(0, Math.round(Number(base.unreadByAdmin) || 0))
        : 0;
      const prevUnreadCollab = base
        ? Math.max(0, Math.round(Number(base.unreadByCollab) || 0))
        : 0;
      return sanitizeDirectChatChannelPayload({
        collabUid: params.collabUid,
        collabName:
          params.collabName ||
          (base && typeof base.collabName === 'string' ? base.collabName : 'Collaborateur'),
        collabEmail:
          params.collabEmail ||
          (base && typeof base.collabEmail === 'string' ? base.collabEmail : undefined),
        collabZone:
          params.collabZone ||
          (base && typeof base.collabZone === 'string' ? base.collabZone : undefined),
        lastMessageText: safePreview,
        lastMessageAt: nowIso,
        lastSenderUid: params.senderUid,
        lastSenderName: safeSenderName,
        unreadByAdmin: params.isSenderSuperAdmin ? 0 : Math.min(10000, prevUnreadAdmin + 1),
        unreadByCollab: params.isSenderSuperAdmin ? Math.min(10000, prevUnreadCollab + 1) : 0,
      });
    };

    const selfHealFromServer = async () => {
      const freshSnap = await getDocFromServer(channelRef);
      if (!freshSnap.exists()) {
        const freshDoc = buildChannelDoc(null);
        await setDoc(channelRef, {
          ...freshDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }
      const freshData = freshSnap.data();
      const repairedDoc = buildChannelDoc(freshData);
      if (isFirestoreTimestampValue(freshData.createdAt) || !params.isSenderSuperAdmin) {
        await updateDoc(channelRef, {
          collabName: repairedDoc.collabName,
          ...(repairedDoc.collabEmail !== undefined ? { collabEmail: repairedDoc.collabEmail } : {}),
          ...(repairedDoc.collabZone !== undefined ? { collabZone: repairedDoc.collabZone } : {}),
          lastMessageText: repairedDoc.lastMessageText,
          lastMessageAt: repairedDoc.lastMessageAt,
          lastSenderUid: repairedDoc.lastSenderUid,
          ...(repairedDoc.lastSenderName !== undefined
            ? { lastSenderName: repairedDoc.lastSenderName }
            : {}),
          unreadByAdmin: repairedDoc.unreadByAdmin,
          unreadByCollab: repairedDoc.unreadByCollab,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(channelRef, {
          ...repairedDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    };

    if (snap.exists()) {
      const prev = snap.data();
      const nextDoc = buildChannelDoc(prev);
      try {
        await updateDoc(channelRef, {
          collabName: nextDoc.collabName,
          ...(nextDoc.collabEmail !== undefined ? { collabEmail: nextDoc.collabEmail } : {}),
          ...(nextDoc.collabZone !== undefined ? { collabZone: nextDoc.collabZone } : {}),
          lastMessageText: nextDoc.lastMessageText,
          lastMessageAt: nextDoc.lastMessageAt,
          lastSenderUid: nextDoc.lastSenderUid,
          ...(nextDoc.lastSenderName !== undefined
            ? { lastSenderName: nextDoc.lastSenderName }
            : {}),
          unreadByAdmin: nextDoc.unreadByAdmin,
          unreadByCollab: nextDoc.unreadByCollab,
          updatedAt: serverTimestamp(),
        });
      } catch {
        await selfHealFromServer();
      }
    } else {
      const channelDoc = buildChannelDoc(null);
      try {
        await setDoc(channelRef, {
          ...channelDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        await selfHealFromServer();
      }
    }
  };

  try {
    await ensureFreshAuthUser(params.senderUid);
    try {
      await executeChannelAttempt();
    } catch (firstErr) {
      if (isPermissionDeniedError(firstErr)) {
        await ensureFreshAuthUser(params.senderUid, true);
        await executeChannelAttempt();
      } else {
        throw firstErr;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, channelPath);
  }

  const msgDoc = sanitizeDirectChatMessagePayload({
    collabUid: params.collabUid,
    senderUid: params.senderUid,
    senderName: params.senderName,
    senderRole: params.senderRole,
    text: cleanText,
    createdAtIso: nowIso,
  });

  try {
    await setDoc(doc(db, 'direct_chats', params.collabUid, 'messages', msgDoc.id), {
      ...msgDoc,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `direct_chats/${params.collabUid}/messages/${msgDoc.id}`
    );
  }

  if (params.recipientUidForNotification && params.recipientUidForNotification !== params.senderUid) {
    await createCloudNotification({
      recipientUid: params.recipientUidForNotification,
      senderUid: params.senderUid,
      senderName: params.senderName,
      senderRole: params.senderRole,
      kind: 'direct_message',
      title: `Nouveau message de ${safeSenderName}`,
      message: clampUtf8Bytes(cleanText, 220),
      ficheOwnerId: params.collabUid,
      targetTab: params.isSenderSuperAdmin ? 'crm' : 'team',
      createdAtIso: nowIso,
    });
  }

  return msgDoc;
}

export async function markDirectChatRead(
  collabUid: string,
  readerRole: 'admin' | 'collab'
): Promise<void> {
  if (!collabUid) return;
  const ref = doc(db, 'direct_chats', collabUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      ...(readerRole === 'admin' ? { unreadByAdmin: 0 } : { unreadByCollab: 0 }),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal
  }
}

// =========================================================================
// COACHING TERRAIN LIVE & PUSH-TO-TALK (WebRTC P2P + Firestore, 0 API externe)
// Consentement explicite du collaborateur requis & indicateur visible obligatoire
// =========================================================================

export function getCoachingSessionsQuery() {
  return query(collection(db, 'coaching_sessions'), where('orgScope', '==', 'orange_pro_team'));
}

export function getCoachingSessionDocRef(collabUid: string) {
  return doc(db, 'coaching_sessions', collabUid);
}

export function getCoachingCandidatesQuery(collabUid: string) {
  return collection(db, 'coaching_sessions', collabUid, 'candidates');
}

export async function clearCoachingCandidates(collabUid: string): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'coaching_sessions', collabUid, 'candidates'));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch {
    // Non-fatal
  }
}

export async function setCollaboratorCoachingState(
  collabUid: string,
  input: Omit<CoachingSessionLike, 'collabUid'>
): Promise<SanitizedCoachingSessionDoc> {
  const nowIso = new Date().toISOString();
  const clean = sanitizeCoachingSessionPayload({
    ...input,
    collabUid,
    updatedAtIso: nowIso,
  });
  const ref = doc(db, 'coaching_sessions', collabUid);
  try {
    await ensureFreshAuthUser(collabUid);
    const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
    if (snap.exists()) {
      await updateDoc(ref, {
        collabName: clean.collabName,
        status: clean.status,
        collabConsentActive: clean.collabConsentActive,
        offerSdp: clean.offerSdp ?? '',
        ...(clean.answerSdp !== undefined ? { answerSdp: clean.answerSdp } : {}),
        ...(clean.adminPttActive !== undefined ? { adminPttActive: clean.adminPttActive } : {}),
        updatedAtIso: clean.updatedAtIso,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `coaching_sessions/${collabUid}`);
  }
}

export async function setAdminCoachingState(
  collabUid: string,
  updates: {
    status?: 'live' | 'collab_ready' | 'ended';
    adminUid?: string;
    adminName?: string;
    adminPttActive?: boolean;
    answerSdp?: string;
  }
): Promise<void> {
  const ref = doc(db, 'coaching_sessions', collabUid);
  const path = `coaching_sessions/${collabUid}`;
  try {
    const payload: DocumentData = {
      updatedAtIso: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    };
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.adminUid !== undefined) payload.adminUid = updates.adminUid;
    if (updates.adminName !== undefined) payload.adminName = updates.adminName.slice(0, 120);
    if (updates.adminPttActive !== undefined) payload.adminPttActive = updates.adminPttActive;
    if (updates.answerSdp !== undefined) payload.answerSdp = updates.answerSdp.slice(0, 24000);
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addCoachingIceCandidate(
  collabUid: string,
  input: CoachingCandidateLike
): Promise<SanitizedCoachingCandidateDoc | null> {
  const clean = sanitizeCoachingCandidatePayload({
    ...input,
    createdAtIso: new Date().toISOString(),
  });
  try {
    await setDoc(doc(db, 'coaching_sessions', collabUid, 'candidates', clean.id), {
      ...clean,
      createdAt: serverTimestamp(),
    });
    return clean;
  } catch {
    return null;
  }
}


