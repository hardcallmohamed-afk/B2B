import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectNewUnlockNotifications,
  detectContractNotifications,
  mergeNotificationsFeed,
  countUnreadNotifications,
  markAllNotificationsRead,
} from './notifications';
import { evaluateAchievements, type SignedContractRecord } from './gamification';

test('detectNewUnlockNotifications seeds baseline silently on first run, then detects new auto achievements and awarded role badges', () => {
  const initialEval = evaluateAchievements(
    {
      totalProspects: 1,
      qualifiedCount: 0,
      contractsCount: 0,
      grandCompteContracts: 0,
      pmeContracts: 0,
      totalPayoutMad: 0,
      multiContactFiches: 0,
      highMaturityFiches: 0,
      distinctCities: 1,
    },
    []
  );

  // First load: baseline initialized silently (zero spam)
  const step1 = detectNewUnlockNotifications(
    { initialized: false, unlockedIds: [] },
    initialEval.items,
    '2026-11-25T10:00:00.000Z'
  );
  assert.equal(step1.nextBaseline.initialized, true);
  assert.equal(step1.created.length, 0);
  assert.ok(step1.nextBaseline.unlockedIds.includes('first_prospect'));

  // Second update: user signs 1st contract + Super-Admin awards Role Badge & MVP Distinction
  const nextEval = evaluateAchievements(
    {
      totalProspects: 1,
      qualifiedCount: 1,
      contractsCount: 1,
      grandCompteContracts: 0,
      pmeContracts: 1,
      totalPayoutMad: 1500,
      multiContactFiches: 0,
      highMaturityFiches: 0,
      distinctCities: 1,
    },
    ['role_chef_equipe', 'admin_mvp_mois']
  );

  const step2 = detectNewUnlockNotifications(
    step1.nextBaseline,
    nextEval.items,
    '2026-11-25T10:05:00.000Z'
  );
  assert.ok(step2.created.length >= 3);
  const roleNotif = step2.created.find((n) => n.badgeId === 'role_chef_equipe');
  assert.equal(roleNotif?.kind, 'role_badge_awarded');
  assert.equal(roleNotif?.read, false);

  const distinctionNotif = step2.created.find((n) => n.badgeId === 'admin_mvp_mois');
  assert.equal(distinctionNotif?.kind, 'distinction_awarded');

  const contractNotif = step2.created.find((n) => n.badgeId === 'first_contract');
  assert.equal(contractNotif?.kind, 'achievement_unlocked');

  // Re-running with same state creates 0 duplicates
  const step3 = detectNewUnlockNotifications(
    step2.nextBaseline,
    nextEval.items,
    '2026-11-25T10:06:00.000Z'
  );
  assert.equal(step3.created.length, 0);

  // Feed helpers
  const feed = mergeNotificationsFeed([], step2.created);
  assert.equal(countUnreadNotifications(feed), step2.created.length);
  const readFeed = markAllNotificationsRead(feed);
  assert.equal(countUnreadNotifications(readFeed), 0);
});

test('detectContractNotifications notifies supervisors when a collaborator signs and notifies on contract status transitions (Validé, Versé, Refusé)', () => {
  const existingContract: SignedContractRecord = {
    id: 'ctr_1',
    orgScope: 'orange_pro_team',
    ownerId: 'collab_1',
    ownerName: 'Youssef Benali',
    ficheId: 'f1',
    numeroFiche: 'OP-001',
    societe: 'Fiduciaire Atlas',
    ville: 'Meknès',
    secteur: 'fiduciaire',
    produitOrangePro: 'Fibre Pro 200M',
    tier: 'PME',
    effectif: '15',
    payoutMad: 1500,
    payoutStatus: 'En attente',
    signedAt: '2026-11-20T09:00:00.000Z',
  };

  // Step 1: First hydration seeds silently without spam
  const initAdmin = detectContractNotifications(
    { initialized: false, byId: {} },
    [existingContract],
    { currentUserUid: 'admin_1', canSuperviseTeam: true, nowIso: '2026-11-20T09:05:00.000Z' }
  );
  assert.equal(initAdmin.nextBaseline.initialized, true);
  assert.equal(initAdmin.created.length, 0);

  // Step 2: Collaborator signs a brand-new contract -> Super-Admin receives contract_signed notification
  const newCollabContract: SignedContractRecord = {
    ...existingContract,
    id: 'ctr_2',
    societe: 'Clinique Al Amal',
    tier: 'Grand Compte',
    payoutMad: 0,
    payoutStatus: 'En attente',
    signedAt: '2026-11-20T10:00:00.000Z',
  };
  const stepSigned = detectContractNotifications(
    initAdmin.nextBaseline,
    [existingContract, newCollabContract],
    { currentUserUid: 'admin_1', canSuperviseTeam: true, nowIso: '2026-11-20T10:01:00.000Z' }
  );
  assert.equal(stepSigned.created.length, 1);
  assert.equal(stepSigned.created[0].kind, 'contract_signed');
  assert.equal(stepSigned.created[0].targetTab, 'team');
  assert.match(stepSigned.created[0].title, /Youssef Benali/);
  assert.match(stepSigned.created[0].message, /Clinique Al Amal/);

  // Step 3: Contract status changes to Refusé -> Collaborator receives contract_status_changed notification with motif
  const initCollab = detectContractNotifications(
    { initialized: false, byId: {} },
    [existingContract],
    { currentUserUid: 'collab_1', canSuperviseTeam: false, nowIso: '2026-11-20T09:05:00.000Z' }
  );
  const refusedContract: SignedContractRecord = {
    ...existingContract,
    payoutStatus: 'Refusé',
    refusMotif: 'Pièce justificative manquante',
  };
  const stepRefused = detectContractNotifications(
    initCollab.nextBaseline,
    [refusedContract],
    { currentUserUid: 'collab_1', canSuperviseTeam: false, nowIso: '2026-11-20T11:00:00.000Z' }
  );
  assert.equal(stepRefused.created.length, 1);
  assert.equal(stepRefused.created[0].kind, 'contract_status_changed');
  assert.equal(stepRefused.created[0].contractMeta?.payoutStatus, 'Refusé');
  assert.match(stepRefused.created[0].message, /Pièce justificative manquante/);

  // Step 4: Contract status changes to Versé -> notification includes payout and referenceVirement
  const paidContract: SignedContractRecord = {
    ...existingContract,
    payoutStatus: 'Versé',
    referenceVirement: 'VIR-2026-991',
  };
  const stepPaid = detectContractNotifications(
    stepRefused.nextBaseline,
    [paidContract],
    { currentUserUid: 'collab_1', canSuperviseTeam: false, nowIso: '2026-11-20T12:00:00.000Z' }
  );
  assert.equal(stepPaid.created.length, 1);
  assert.equal(stepPaid.created[0].contractMeta?.payoutStatus, 'Versé');
  assert.match(stepPaid.created[0].message, /VIR-2026-991/);

  // Step 5: Re-running unchanged snapshot emits 0 duplicates
  const stepRepeat = detectContractNotifications(
    stepPaid.nextBaseline,
    [paidContract],
    { currentUserUid: 'collab_1', canSuperviseTeam: false, nowIso: '2026-11-20T12:05:00.000Z' }
  );
  assert.equal(stepRepeat.created.length, 0);
});
