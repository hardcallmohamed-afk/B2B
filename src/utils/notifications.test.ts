import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectNewUnlockNotifications,
  mergeNotificationsFeed,
  countUnreadNotifications,
  markAllNotificationsRead,
} from './notifications';
import { evaluateAchievements } from './gamification';

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
