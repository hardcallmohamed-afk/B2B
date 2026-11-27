import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyDirectionReport,
  buildMonthlyPayrollExcelCsv,
  buildMonthlyDirectionReportPdfDoc,
  escapeExcelCsvCell,
  type AttendanceSessionLike,
} from './directionReport';
import type { SignedContractRecord, TeamStatRecord } from './gamification';

function makeMember(overrides: Partial<TeamStatRecord> = {}): TeamStatRecord {
  return {
    uid: overrides.uid || 'u1',
    orgScope: 'orange_pro_team',
    displayName: overrides.displayName || 'Karim Mansouri',
    role: overrides.role || 'commercial',
    zone: overrides.zone || 'Meknès',
    active: overrides.active ?? true,
    totalProspects: overrides.totalProspects ?? 40,
    totalQualified: overrides.totalQualified ?? 12,
    totalContracts: overrides.totalContracts ?? 3,
    totalPayoutMad: overrides.totalPayoutMad ?? 3500,
    xp: overrides.xp ?? 2000,
    unlockedCount: overrides.unlockedCount ?? 5,
    manualBadges: [],
    monthlyHistory: [],
    ...overrides,
  };
}

function makeContract(overrides: Partial<SignedContractRecord> = {}): SignedContractRecord {
  return {
    id: overrides.id || 'c1',
    orgScope: 'orange_pro_team',
    ownerId: overrides.ownerId || 'u1',
    ownerName: overrides.ownerName || 'Karim Mansouri',
    ficheId: overrides.ficheId || 'f1',
    numeroFiche: overrides.numeroFiche || 'OP-1001',
    societe: overrides.societe || 'Fiduciaire Atlas',
    ville: overrides.ville || 'Meknès',
    secteur: overrides.secteur || 'fiduciaire',
    produitOrangePro: overrides.produitOrangePro || 'Fibre Pro + Pack Flotte 5-20 lignes',
    tier: overrides.tier || 'PME',
    effectif: overrides.effectif || '15',
    payoutMad: overrides.payoutMad ?? 1500,
    payoutStatus: overrides.payoutStatus || 'Validé',
    signedAt: overrides.signedAt || '2026-11-12T10:00:00.000Z',
    referenceVirement: overrides.referenceVirement,
    refusMotif: overrides.refusMotif,
  };
}

test('directionReport: filters strictly by YYYY-MM month and computes exact payout totals & netAPayerMad', () => {
  const teamStats = [
    makeMember({ uid: 'u1', displayName: 'Karim Mansouri', totalProspects: 45 }),
    makeMember({ uid: 'u2', displayName: 'Salma Berrada', role: 'grand_compte', zone: 'Rabat', totalProspects: 30 }),
  ];

  const contracts = [
    makeContract({ id: 'c1', ownerId: 'u1', payoutMad: 1500, payoutStatus: 'Validé', signedAt: '2026-11-05T09:00:00Z' }),
    makeContract({ id: 'c2', ownerId: 'u1', payoutMad: 650, payoutStatus: 'En attente', signedAt: '2026-11-10T11:00:00Z' }),
    makeContract({ id: 'c3', ownerId: 'u2', ownerName: 'Salma Berrada', payoutMad: 3000, payoutStatus: 'Versé', referenceVirement: 'VIR-2026-11', signedAt: '2026-11-14T15:00:00Z' }),
    makeContract({ id: 'c4', ownerId: 'u2', ownerName: 'Salma Berrada', payoutMad: 1000, payoutStatus: 'Refusé', refusMotif: 'Dossier incomplet', signedAt: '2026-11-18T16:00:00Z' }),
    // Previous month contract -> MUST be excluded from 2026-11
    makeContract({ id: 'c-old', ownerId: 'u1', payoutMad: 9999, payoutStatus: 'Versé', signedAt: '2026-10-28T10:00:00Z' }),
  ];

  const report = buildMonthlyDirectionReport({
    monthKey: '2026-11',
    teamStats,
    signedContracts: contracts,
  });

  assert.equal(report.summary.activeCommercialsCount, 2);
  assert.equal(report.summary.totalProspects, 75);
  assert.equal(report.summary.monthContractsCount, 4);
  assert.equal(report.summary.enAttenteMad, 650);
  assert.equal(report.summary.valideMad, 1500);
  assert.equal(report.summary.verseMad, 3000);
  assert.equal(report.summary.refuseMad, 1000);
  assert.equal(report.summary.netAPayerMad, 2150); // 1500 Validé + 650 En attente
  assert.equal(report.summary.totalValideEtVerseMad, 4500); // 1500 + 3000
  assert.equal(report.summary.totalWorkedHours, null);

  // Salma (3000 Validé+Versé) ranked ahead of Karim (1500 Validé+Versé)
  assert.equal(report.commercialRows[0].uid, 'u2');
  assert.equal(report.commercialRows[0].totalValideEtVerseMad, 3000);
  assert.equal(report.commercialRows[1].uid, 'u1');
  assert.equal(report.commercialRows[1].enAttenteMad, 650);
});

test('directionReport: aggregates attendance sessions strictly for selected monthKey in hours', () => {
  const teamStats = [makeMember({ uid: 'u1', displayName: 'Karim Mansouri' })];
  const sessions: AttendanceSessionLike[] = [
    { ownerId: 'u1', dateKey: '2026-11-02', workedSeconds: 7200 }, // 2.0h
    { ownerId: 'u1', dateKey: '2026-11-03', workedSeconds: 5400 }, // 1.5h
    { ownerId: 'u1', dateKey: '2026-10-30', workedSeconds: 36000 }, // excluded (October)
  ];

  const report = buildMonthlyDirectionReport({
    monthKey: '2026-11',
    teamStats,
    signedContracts: [],
    attendanceSessions: sessions,
  });

  assert.equal(report.summary.totalWorkedHours, 3.5);
  assert.equal(report.commercialRows[0].workedHours, 3.5);
});

test('directionReport: CSV export uses UTF-8 BOM, semicolon separator, and neutralizes formula injection', () => {
  assert.equal(escapeExcelCsvCell('=CMD|"/C calc"!A0'), `"'=CMD|""/C calc""!A0"`);
  assert.equal(escapeExcelCsvCell('+212661000000'), "'+212661000000");
  assert.equal(escapeExcelCsvCell('-SUM(A1:A2)'), "'-SUM(A1:A2)");
  assert.equal(escapeExcelCsvCell('@HYPERLINK("http://x")'), `"'@HYPERLINK(""http://x"")"`);
  assert.equal(escapeExcelCsvCell(1500), '1500');
  assert.equal(escapeExcelCsvCell(12.5), '12,5');

  const report = buildMonthlyDirectionReport({
    monthKey: '2026-11',
    teamStats: [makeMember({ uid: 'u1', displayName: '=HYPERLINK("evil")' })],
    signedContracts: [
      makeContract({
        id: 'c-inj',
        ownerId: 'u1',
        societe: '+MALICIOUS;SARL',
        payoutStatus: 'Refusé',
        refusMotif: '-1+1',
      }),
    ],
  });

  const csv = buildMonthlyPayrollExcelCsv(report);
  assert.equal(csv.charCodeAt(0), 0xfeff, 'CSV must begin with UTF-8 BOM');
  assert.ok(csv.includes('SECTION 1 — BORDEREAU DE PAIE PAR COMMERCIAL'));
  assert.ok(csv.includes('SECTION 2 — DÉTAIL DES CONTRATS DU MOIS'));
  assert.ok(csv.includes('Nom complet;Rôle;Zone;Prospects;Heures présence'));
  assert.ok(csv.includes(`"'=HYPERLINK(""evil"")"`), 'Dangerous displayName formula must be prefixed');
  assert.ok(csv.includes(`"'+MALICIOUS;SARL"`), 'Dangerous societe with semicolon must be quoted and prefixed');
  assert.ok(csv.includes("'-1+1"), 'Dangerous motif formula must be prefixed');
});

test('directionReport: PDF generation builds valid multi-page jsPDF document without throwing', async () => {
  const teamStats = Array.from({ length: 12 }, (_, i) =>
    makeMember({ uid: `u-${i}`, displayName: `Commercial Test ${i + 1}`, zone: 'Casablanca' })
  );
  const contracts = Array.from({ length: 30 }, (_, i) =>
    makeContract({
      id: `c-${i}`,
      ownerId: `u-${i % 12}`,
      ownerName: `Commercial Test ${(i % 12) + 1}`,
      societe: `Entreprise Cliente B2B ${i + 1}`,
      payoutMad: 1500,
      payoutStatus: i % 3 === 0 ? 'Versé' : i % 3 === 1 ? 'Validé' : 'En attente',
      referenceVirement: i % 3 === 0 ? `VIR-${100 + i}` : undefined,
      signedAt: `2026-11-${String((i % 27) + 1).padStart(2, '0')}T10:00:00Z`,
    })
  );

  const report = buildMonthlyDirectionReport({
    monthKey: '2026-11',
    teamStats,
    signedContracts: contracts,
    filtersLabel: 'Tous rôles · Maroc',
    workspaceLegal: {
      raisonSociale: 'DIVERSIFIA SARL',
      ice: '002345678900012',
    },
  });

  const doc = await buildMonthlyDirectionReportPdfDoc(report);
  assert.ok(doc.getNumberOfPages() >= 2, '30 contracts + 12 commercials should paginate cleanly across >= 2 pages');
  const rawPdf = doc.output('datauristring');
  assert.ok(rawPdf.startsWith('data:application/pdf'), 'Output must be a valid PDF data URI');
});
