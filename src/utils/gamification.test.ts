import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIVERSIFIA_FIXE_LINES,
  DIVERSIFIA_MOBILE_FORFAITS,
  buildDefaultForecastParams,
  calculateForecastCommission,
  computeCurrentMonthPayoutSummary,
  computeDefaultPayoutMad,
  evaluateAchievements,
  buildTeamLeaderboard,
  buildTeamMonthlyEvolution,
  buildMonthlyHistoryStrings,
  formatDateAjoutShort,
  parseDateAjoutTimestamp,
  sortByDateAjout,
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
    ['admin_mvp_mois', 'role_chef_equipe', 'admin_box5g_expert', 'role_superviseur_diversifia']
  );

  assert.ok(res.unlockedCount >= 14);
  assert.equal(res.totalCount, 50); // 36 auto + 9 admin distinctions + 5 role badges
  assert.ok(res.totalXp > 2000);
  assert.equal(res.nextToUnlock.length, 3);
  // Admin manual badge unlocked
  const mvp = res.items.find((i) => i.id === 'admin_mvp_mois');
  assert.equal(mvp?.unlocked, true);
  assert.equal(mvp?.isManualAdminBadge, true);
  assert.equal(mvp?.xpType, 'Distinction Admin');
  // New DIVERSIFIA role & distinction badges unlocked
  assert.equal(res.items.find((i) => i.id === 'admin_box5g_expert')?.unlocked, true);
  assert.equal(res.items.find((i) => i.id === 'role_superviseur_diversifia')?.unlocked, true);
  // Role badge unlocked
  const roleBadge = res.items.find((i) => i.id === 'role_chef_equipe');
  assert.equal(roleBadge?.unlocked, true);
  assert.equal(roleBadge?.xpType, 'Badge de Rôle');
  // New auto achievements unlocked (prospect_5, qualified_2, payout_5000)
  assert.equal(res.items.find((i) => i.id === 'prospect_5')?.unlocked, true);
  assert.equal(res.items.find((i) => i.id === 'qualified_2')?.unlocked, true);
  assert.equal(res.items.find((i) => i.id === 'payout_5000')?.unlocked, true);
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

test('buildTeamMonthlyEvolution and computeCurrentMonthPayoutSummary aggregate current month and TotalPayoutMad', () => {
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

  const monthSummary = computeCurrentMonthPayoutSummary(contracts, [], 'all', now);
  assert.equal(monthSummary.ym, '2026-11');
  assert.equal(monthSummary.currentMonthPayoutMad, 5500);
  assert.equal(monthSummary.currentMonthContractsCount, 2);
  assert.equal(monthSummary.totalSignedPayoutMad, 5500);
  assert.equal(monthSummary.verseMad, 4000);
  assert.equal(monthSummary.valideMad, 1500);
  assert.equal(monthSummary.avgPayoutPerContractMad, 2750);
});

test('sortByDateAjout sorts fiches ascending and descending by dateAjout', () => {
  const fiches = [
    { id: '1', societe: 'Alpha', dateAjout: '2026-11-10T09:00:00.000Z' },
    { id: '2', societe: 'Bravo', dateAjout: '2026-11-24T15:30:00.000Z' },
    { id: '3', societe: 'Charlie', dateAjout: '2026-11-15T12:00:00.000Z' },
  ];

  const desc = sortByDateAjout(fiches, 'desc');
  assert.deepEqual(
    desc.map((f) => f.id),
    ['2', '3', '1']
  );

  const asc = sortByDateAjout(fiches, 'asc');
  assert.deepEqual(
    asc.map((f) => f.id),
    ['1', '3', '2']
  );

  assert.ok(parseDateAjoutTimestamp('2026-11-24T15:30:00.000Z') > 0);
  assert.equal(formatDateAjoutShort('2026-11-24T15:30:00.000Z'), '24/11/2026');
});

test('ROLE_BADGE_META defines distinct Admin, Commercial, and team role labels and visual classes', async () => {
  const { ROLE_BADGE_META, TEAM_ROLE_ORDER } = await import('./gamification');
  assert.equal(ROLE_BADGE_META.super_admin.shortLabel, 'Admin');
  assert.equal(ROLE_BADGE_META.commercial.shortLabel, 'Commercial');
  const shortLabels = new Set(TEAM_ROLE_ORDER.map((r) => ROLE_BADGE_META[r].shortLabel));
  const classes = new Set(TEAM_ROLE_ORDER.map((r) => ROLE_BADGE_META[r].className));
  assert.equal(shortLabels.size, TEAM_ROLE_ORDER.length);
  assert.equal(classes.size, TEAM_ROLE_ORDER.length);
});

test('DIVERSIFIA commission grid and sector+headcount forecast calculator compute exact payouts and invoice splits', () => {
  // Exact DIVERSIFIA grid checks from Engagement sheet
  assert.equal(DIVERSIFIA_FIXE_LINES.find((l) => l.id === 'ftth_200')?.commissionTotal, 400);
  assert.equal(DIVERSIFIA_FIXE_LINES.find((l) => l.id === 'adsl')?.commissionTotal, 99);
  const box12 = DIVERSIFIA_FIXE_LINES.find((l) => l.id === 'box_12_4g');
  assert.equal(box12?.commissionTotal, 150);
  assert.equal(box12?.firstInvoiceMad, 100);
  assert.equal(box12?.fourthInvoiceMad, 50);

  const illimiteInter = DIVERSIFIA_MOBILE_FORFAITS.find((m) => m.id === 'illimite_inter');
  assert.equal(illimiteInter?.commissionTotal, 250);
  assert.equal(illimiteInter?.firstInvoiceMad, 125);
  assert.equal(illimiteInter?.fourthInvoiceMad, 125);

  // Clinique 45 salariés -> FTTH 200M (400) + 16× ILLIMITE NA (200)
  const cliniqueParams = buildDefaultForecastParams('clinique', '45');
  assert.equal(cliniqueParams.fixeLineId, 'ftth_200');
  assert.equal(cliniqueParams.isEffectifEstimated, false);
  const cliniqueCalc = calculateForecastCommission(cliniqueParams);
  assert.equal(cliniqueCalc.recommendedTier, 'Grand Compte');
  assert.equal(
    cliniqueCalc.firstInvoiceMad + cliniqueCalc.fourthInvoiceMad,
    cliniqueCalc.totalCommissionMad
  );

  // Blank headcount -> estimated from sector default (auto_ecole = 3)
  const autoEcoleParams = buildDefaultForecastParams('auto_ecole', '');
  assert.equal(autoEcoleParams.isEffectifEstimated, true);
  assert.equal(autoEcoleParams.effectifNum, 3);
  const autoEcoleCalc = calculateForecastCommission(autoEcoleParams);
  assert.equal(autoEcoleCalc.recommendedTier, 'TPE / Libéral');

  // Exact Box 5G (250: 125 + 125) + 2× 21 HEURE (300: 150 + 150) = 550 DH (275 + 275)
  const customCalc = calculateForecastCommission({
    secteur: 'pme',
    effectifNum: 12,
    fixeLineId: 'box_5g',
    fixeQty: 1,
    mobileForfaitId: '21_heure',
    mobileQty: 2,
  });
  assert.equal(customCalc.totalCommissionMad, 550);
  assert.equal(customCalc.firstInvoiceMad, 275);
  assert.equal(customCalc.fourthInvoiceMad, 275);
});

test('Refusé contracts are excluded from leaderboard, monthly evolution, and payout summary totals', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  const members: TeamStatRecord[] = [
    {
      uid: 'u1',
      orgScope: 'orange_pro_team',
      displayName: 'Sara Benali',
      role: 'commercial',
      zone: 'Meknès',
      active: true,
      totalProspects: 10,
      totalQualified: 4,
      totalContracts: 0,
      totalPayoutMad: 0,
      xp: 200,
      unlockedCount: 2,
      manualBadges: [],
      monthlyHistory: [],
    },
  ];
  const contracts: SignedContractRecord[] = [
    {
      id: 'c_ok',
      orgScope: 'orange_pro_team',
      ownerId: 'u1',
      ownerName: 'Sara Benali',
      ficheId: 'f1',
      numeroFiche: 'MK-001',
      societe: 'Clinique Atlas',
      ville: 'Meknès',
      secteur: 'clinique',
      produitOrangePro: 'Fibre Pro 200M',
      tier: 'Grand Compte',
      effectif: '40',
      payoutMad: 1500,
      payoutStatus: 'Validé',
      signedAt: '2026-06-10T10:00:00Z',
    },
    {
      id: 'c_refused',
      orgScope: 'orange_pro_team',
      ownerId: 'u1',
      ownerName: 'Sara Benali',
      ficheId: 'f2',
      numeroFiche: 'MK-002',
      societe: 'Dossier Rejeté SARL',
      ville: 'Meknès',
      secteur: 'pme',
      produitOrangePro: 'Pack PME',
      tier: 'PME',
      effectif: '10',
      payoutMad: 900,
      payoutStatus: 'Refusé',
      refusMotif: 'Dossier incomplet',
      signedAt: '2026-06-12T10:00:00Z',
    },
  ];

  const leaderboard = buildTeamLeaderboard(members, contracts);
  assert.equal(leaderboard[0].contractsCount, 1);
  assert.equal(leaderboard[0].payoutMad, 1500);

  const evolution = buildTeamMonthlyEvolution(members, contracts, 'all', now);
  const june = evolution.find((pt) => pt.ym === '2026-06');
  assert.equal(june?.contracts, 1);
  assert.equal(june?.payoutMad, 1500);

  const summary = computeCurrentMonthPayoutSummary(contracts, members, 'all', now);
  assert.equal(summary.currentMonthContractsCount, 1);
  assert.equal(summary.currentMonthPayoutMad, 1500);
  assert.equal(summary.valideMad, 1500);
  assert.equal(summary.enAttenteMad, 0);
  assert.equal(summary.totalSignedContractsCount, 1);
  assert.equal(summary.totalSignedPayoutMad, 1500);
});

