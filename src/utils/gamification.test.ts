import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDefaultPayoutMad,
  evaluateAchievements,
  buildTeamLeaderboard,
  buildTeamMonthlyEvolution,
  buildMonthlyHistoryStrings,
  type SignedContractRecord,
  type TeamStatRecord,
} from './gamification';

test('computeDefaultPayoutMad scales by Orange Pro tier and company headcount', () => {
  assert.equal(computeDefaultPayoutMad('TPE / Libéral', '4'), 650);
  assert.equal(computeDefaultPayoutMad('PME', '20'), 1750); // 1500 + 250
  assert.equal(computeDefaultPayoutMad('Grand Compte', '60'), 4500); // 3500 + 1000
});

test('evaluateAchievements unlocks milestones across rarity tiers, awards XP, and includes Admin manual badges', () => {
  const res = evaluateAchievements(
    {
      totalProspects: 15,
      qualifiedCount: 5,
      contractsCount: 3,
      grandCompteContracts: 1,
      pmeContracts: 2,
      totalPayoutMad: 5200,
      multiContactFiches: 4,
      highMaturityFiches: 8,
      distinctCities: 4,
    },
    ['admin_mvp_mois']
  );

  assert.ok(res.unlockedCount >= 10);
  assert.equal(res.totalCount, 30); // 24 auto + 6 admin distinction badges
  assert.ok(res.totalXp > 1500);
  assert.equal(res.nextToUnlock.length, 3);
  // Admin manual badge unlocked
  const mvp = res.items.find((i) => i.id === 'admin_mvp_mois');
  assert.equal(mvp?.unlocked, true);
  assert.equal(mvp?.isManualAdminBadge, true);
  // Rare Grand Compte unlocked
  assert.equal(res.items.find((i) => i.id === 'first_gc')?.unlocked, true);
  // Legendary still locked
  assert.equal(res.byRarity.legendaire.unlocked, 0);
});

test('buildTeamLeaderboard ranks collaborators by contracts, payout, and XP', () => {
  const members: TeamStatRecord[] = [
    {
      uid: 'u1',
      orgScope: 'orange_pro_team',
      displayName: 'Youssef',
      role: 'commercial',
      zone: 'Meknès',
      active: true,
      totalProspects: 20,
      totalQualified: 6,
      totalContracts: 2,
      totalPayoutMad: 3000,
      xp: 900,
      unlockedCount: 6,
      manualBadges: [],
      monthlyHistory: ['2026-11:2:3000'],
    },
    {
      uid: 'u2',
      orgScope: 'orange_pro_team',
      displayName: 'Salma',
      role: 'commercial',
      zone: 'Ifrane',
      active: true,
      totalProspects: 18,
      totalQualified: 8,
      totalContracts: 4,
      totalPayoutMad: 6500,
      xp: 1800,
      unlockedCount: 11,
      manualBadges: ['admin_mvp_mois'],
      monthlyHistory: ['2026-11:4:6500'],
    },
  ];

  const ranked = buildTeamLeaderboard(members, []);
  assert.equal(ranked[0].uid, 'u2');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].uid, 'u1');
  assert.equal(ranked[1].rank, 2);
});

test('buildTeamMonthlyEvolution filters cleanly between global team and single collaborator', () => {
  const contracts: SignedContractRecord[] = [
    {
      id: 'c1',
      orgScope: 'orange_pro_team',
      ownerId: 'u1',
      ownerName: 'Youssef',
      ficheId: 'f1',
      numeroFiche: 'OP-0001',
      societe: 'Fiduciaire Atlas',
      ville: 'Meknès',
      secteur: 'fiduciaire',
      produitOrangePro: 'Fibre Pro + Pack Flotte 5-20 lignes + Fixe VoIP',
      tier: 'PME',
      effectif: '14',
      payoutMad: 1500,
      payoutStatus: 'Validé',
      signedAt: '2026-11-10T10:00:00.000Z',
    },
    {
      id: 'c2',
      orgScope: 'orange_pro_team',
      ownerId: 'u2',
      ownerName: 'Salma',
      ficheId: 'f2',
      numeroFiche: 'OP-0002',
      societe: 'Clinique Atlas',
      ville: 'Ifrane',
      secteur: 'clinique',
      produitOrangePro: 'Fibre Dédiée + Flotte Mobile Corporate + Standard Cloud',
      tier: 'Grand Compte',
      effectif: '48',
      payoutMad: 4000,
      payoutStatus: 'Versé',
      signedAt: '2026-11-18T14:00:00.000Z',
    },
  ];

  const now = new Date('2026-11-25T12:00:00.000Z');
  const globalSeries = buildTeamMonthlyEvolution([], contracts, 'all', now);
  const lastGlobal = globalSeries[globalSeries.length - 1];
  assert.equal(lastGlobal.ym, '2026-11');
  assert.equal(lastGlobal.contracts, 2);
  assert.equal(lastGlobal.payoutMad, 5500);

  const salmaSeries = buildTeamMonthlyEvolution([], contracts, 'u2', now);
  const lastSalma = salmaSeries[salmaSeries.length - 1];
  assert.equal(lastSalma.contracts, 1);
  assert.equal(lastSalma.payoutMad, 4000);

  assert.deepEqual(buildMonthlyHistoryStrings(contracts), ['2026-11:2:5500']);
});
