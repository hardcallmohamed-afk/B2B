import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
  isVerifiedSuperAdmin,
  evaluateUserAccess,
  validateNewUserInput,
  generateStrongTempPassword,
  formatFirebaseAuthError,
} from './authAccess';

test('Super-Admin check requires exact email AND verified flag', () => {
  assert.equal(isSuperAdminEmail('HardCallMohamed@gmail.com '), true);
  assert.equal(isSuperAdminEmail('other@gmail.com'), false);
  assert.equal(isVerifiedSuperAdmin(SUPER_ADMIN_EMAIL, true), true);
  assert.equal(isVerifiedSuperAdmin(SUPER_ADMIN_EMAIL, false), false);
  assert.equal(isVerifiedSuperAdmin('attacker@gmail.com', true), false);
});

test('evaluateUserAccess blocks unauthorized or suspended users and enforces email verification', () => {
  // Verified Super Admin
  const adminOk = evaluateUserAccess({
    email: SUPER_ADMIN_EMAIL,
    emailVerified: true,
    appUserProfile: null,
  });
  assert.equal(adminOk.status, 'allowed');
  if (adminOk.status === 'allowed') assert.equal(adminOk.isAdmin, true);

  // Unverified Super Admin -> must verify email
  const adminUnverified = evaluateUserAccess({
    email: SUPER_ADMIN_EMAIL,
    emailVerified: false,
    appUserProfile: null,
  });
  assert.equal(adminUnverified.status, 'verify_email');

  // Unknown non-admin user -> denied
  const stranger = evaluateUserAccess({
    email: 'stranger@example.com',
    emailVerified: true,
    appUserProfile: null,
  });
  assert.equal(stranger.status, 'denied');

  // Suspended managed user -> denied
  const suspended = evaluateUserAccess({
    email: 'rep@orangepro.ma',
    emailVerified: true,
    appUserProfile: {
      uid: 'u_rep',
      email: 'rep@orangepro.ma',
      displayName: 'Youssef Commercial',
      role: 'commercial',
      zone: 'Meknès',
      active: false,
      createdBy: 'admin_uid',
    },
  });
  assert.equal(suspended.status, 'denied');

  // Active verified managed user -> allowed (non-admin)
  const activeRep = evaluateUserAccess({
    email: 'rep@orangepro.ma',
    emailVerified: true,
    appUserProfile: {
      uid: 'u_rep',
      email: 'rep@orangepro.ma',
      displayName: 'Youssef Commercial',
      role: 'commercial',
      zone: 'Meknès',
      active: true,
      createdBy: 'admin_uid',
    },
  });
  assert.equal(activeRep.status, 'allowed');
  if (activeRep.status === 'allowed') {
    assert.equal(activeRep.isAdmin, false);
    assert.equal(activeRep.roleLabel, 'Commercial B2B');
  }
});

test('validateNewUserInput validates name, email, non-admin collision, and password length', () => {
  assert.ok(validateNewUserInput({ displayName: 'A', email: 'a@b.ma', password: 'Password1!' }));
  assert.ok(validateNewUserInput({ displayName: 'Karim', email: 'not-an-email', password: 'Password1!' }));
  assert.ok(validateNewUserInput({ displayName: 'Admin', email: SUPER_ADMIN_EMAIL, password: 'Password1!' }));
  assert.ok(validateNewUserInput({ displayName: 'Karim', email: 'karim@b.ma', password: 'short' }));
  assert.equal(validateNewUserInput({ displayName: 'Karim B.', email: 'karim@b.ma', password: 'Password123!' }), null);
});

test('generateStrongTempPassword creates 12-char mixed password and formatFirebaseAuthError maps unauthorized-domain', () => {
  const pwd = generateStrongTempPassword(12);
  assert.equal(pwd.length, 12);
  assert.match(pwd, /[A-Z]/);
  assert.match(pwd, /[a-z]/);
  assert.match(pwd, /[0-9]/);

  const err = formatFirebaseAuthError(new Error('Firebase: Error (auth/unauthorized-domain).'), 'hardcallmohamed-afk.github.io');
  assert.equal(err.code, 'unauthorized_domain');
  assert.equal(err.domainToAuthorize, 'hardcallmohamed-afk.github.io');
});

test('normalizeManagedRole and getManagedRoleLabel support all 4 CRM roles and safely default unknown strings', async () => {
  const { normalizeManagedRole, getManagedRoleLabel, MANAGED_ROLE_OPTIONS } = await import('./authAccess');
  assert.equal(MANAGED_ROLE_OPTIONS.length, 4);
  assert.equal(normalizeManagedRole('grand_compte'), 'grand_compte');
  assert.equal(normalizeManagedRole('team_lead'), 'team_lead');
  assert.equal(normalizeManagedRole('manager'), 'manager');
  assert.equal(normalizeManagedRole('commercial'), 'commercial');
  assert.equal(normalizeManagedRole('unknown_role'), 'commercial');
  assert.equal(getManagedRoleLabel('grand_compte'), 'Expert Grand Compte');
  assert.equal(getManagedRoleLabel('team_lead'), 'Chef d’Équipe');
});

test('isSupervisorRole and canUseWhisperCoaching strictly allow authorized supervisors and reject non-supervisors', async () => {
  const {
    isSupervisorRole,
    canUseWhisperCoaching,
    getCollaboratorAudioUiVisibility,
  } = await import('./authAccess');

  for (const allowedRole of ['super_admin', 'admin', 'manager', 'superviseur', ' Manager ', 'SUPERVISEUR']) {
    assert.equal(isSupervisorRole(allowedRole), true, `Expected supervisor: ${allowedRole}`);
    assert.equal(canUseWhisperCoaching(allowedRole), true, `Expected whisper allowed: ${allowedRole}`);
    const vis = getCollaboratorAudioUiVisibility(allowedRole);
    assert.equal(vis.isSupervisor, true);
    assert.equal(vis.showAudioSupervisionContainer, true);
    assert.equal(vis.showListenAndWhisperControls, true);
    assert.equal(vis.allowSilentBackgroundEarpiece, true);
  }

  for (const nonSupervisor of ['commercial', 'grand_compte', 'team_lead', '', 'guest', undefined, null]) {
    assert.equal(isSupervisorRole(nonSupervisor), false, `Expected non-supervisor: ${String(nonSupervisor)}`);
    assert.equal(canUseWhisperCoaching(nonSupervisor), false, `Expected whisper denied: ${String(nonSupervisor)}`);
    const vis = getCollaboratorAudioUiVisibility(nonSupervisor);
    assert.equal(vis.isSupervisor, false);
    assert.equal(vis.showAudioSupervisionContainer, false);
    assert.equal(vis.showListenAndWhisperControls, false);
    assert.equal(vis.allowSilentBackgroundEarpiece, true);
  }
});

