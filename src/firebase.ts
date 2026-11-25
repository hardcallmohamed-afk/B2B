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
  doc,
  collection,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  sanitizeFichePayload,
  sanitizeSkillPayload,
  sanitizeWorkspacePayload,
  sanitizeAppUserPayload,
  type FicheLike,
  type EmailSkillLike,
  type WorkspaceLike,
  type SanitizedFicheDoc,
  type SanitizedEmailSkillDoc,
  type SyncDiff,
} from './utils/firestoreSanitize';
import type { ManagedAppUser, ManagedUserRole } from './utils/authAccess';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass the provisioned named firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
      role: d.role === 'manager' ? 'manager' : 'commercial',
      zone: typeof d.zone === 'string' ? d.zone : '',
      active: Boolean(d.active),
      createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
      createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function getAppUsersCollection() {
  return collection(db, 'app_users');
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
  try {
    await updateDoc(doc(db, 'app_users', uid), {
      displayName: cleanName,
      role: updates.role === 'manager' ? 'manager' : 'commercial',
      zone: cleanZone,
      active: Boolean(updates.active),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, targetPath);
  }
}

export async function adminDeleteManagedUser(uid: string): Promise<void> {
  const targetPath = `app_users/${uid}`;
  try {
    await deleteDoc(doc(db, 'app_users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
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

  // Step 2: Migrate existing local fiches & skills to Firestore in chunked batches.
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
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
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function syncFichesDiffToFirestore(
  uid: string,
  diff: SyncDiff<SanitizedFicheDoc>
): Promise<void> {
  const tasks: Array<() => void> = [];
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
    tasks.push(() => {});
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

  if (tasks.length === 0) return;

  for (const batch of batches) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/fiches`);
    }
  }
}

export async function syncSkillsDiffToFirestore(
  uid: string,
  diff: SyncDiff<SanitizedEmailSkillDoc>
): Promise<void> {
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

  for (const batch of batches) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/skills`);
    }
  }
}

export function getUserFichesCollection(uid: string) {
  return collection(db, 'users', uid, 'fiches');
}

export function getUserSkillsCollection(uid: string) {
  return collection(db, 'users', uid, 'skills');
}
