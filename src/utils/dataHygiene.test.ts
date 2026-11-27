import test from 'node:test';
import assert from 'node:assert/strict';
import type { FicheEntreprise } from './crmDomain';
import type { SignedContractRecord } from './gamification';
import {
  analyzeDataHygiene,
  applySafeHygieneFixesToFiche,
  isEffectifAberrant,
} from './dataHygiene';

function makeFiche(overrides: Partial<FicheEntreprise> = {}): FicheEntreprise {
  return {
    id: 'f_clean_1',
    numeroFiche: 'OP-0001',
    societe: 'Fiduciaire Atlas Meknès',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '05 35 52 18 40',
    email: 'contact@fiduciaire-atlas.ma',
    contact: 'Karim Benali',
    role: 'Gérant',
    source: 'Terrain',
    effectif: '18',
    statut: 'À contacter',
    dateAjout: '2026-11-20',
    ...overrides,
  };
}

function makeContract(overrides: Partial<SignedContractRecord> = {}): SignedContractRecord {
  return {
    id: 'ctr_1',
    orgScope: 'orange_pro_team',
    ownerId: 'u_1',
    ownerName: 'Youssef Benali',
    ficheId: 'f_signed_ok',
    numeroFiche: 'OP-0100',
    societe: 'Clinique Atlas',
    ville: 'Meknès',
    secteur: 'clinique',
    produitOrangePro: 'Fibre Dédiée + Flotte Mobile',
    tier: 'Grand Compte',
    effectif: '45',
    payoutMad: 1500,
    payoutStatus: 'Validé',
    signedAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

test('analyzeDataHygiene reports zero false positives on a healthy Moroccan CRM portfolio', () => {
  const healthyFiches: FicheEntreprise[] = [
    makeFiche({ id: 'f_1', numeroFiche: 'OP-0001', telephone: '05 35 52 18 40', effectif: '18' }),
    makeFiche({ id: 'f_2', numeroFiche: 'OP-0002', telephone: '0661482910', effectif: '10-25' }),
    makeFiche({ id: 'f_3', numeroFiche: 'OP-0003', telephone: '+212 6 61 48 29 10', effectif: 'Non précisé', email: '' }),
    makeFiche({
      id: 'f_signed_ok',
      numeroFiche: 'OP-0100',
      societe: 'Clinique Atlas',
      statut: 'Signé Orange Pro',
      telephone: '0535521840',
      effectif: '45',
    }),
    // Matched via numeroFiche even if id differs
    makeFiche({
      id: 'f_signed_by_num',
      numeroFiche: 'OP-0101',
      societe: 'Hôtel Transatlantique',
      statut: 'Signé Orange Pro',
      telephone: '05 35 52 00 11',
      effectif: '60',
    }),
  ];

  const contracts: SignedContractRecord[] = [
    makeContract({ id: 'c_1', ficheId: 'f_signed_ok', numeroFiche: 'OP-0100' }),
    makeContract({ id: 'c_2', ficheId: 'legacy_other_id', numeroFiche: 'op-0101' }),
  ];

  const report = analyzeDataHygiene(healthyFiches, contracts);
  assert.equal(report.isHealthy, true);
  assert.equal(report.anomalies.length, 0);
  assert.equal(report.autoFixableCount, 0);
  assert.equal(report.manualReviewCount, 0);
  assert.equal(report.affectedFichesCount, 0);
});

test('analyzeDataHygiene detects aberrant headcount (e.g. OP-0151 Attijariwafa Bank 500110000) and proposes safe fix', () => {
  assert.equal(isEffectifAberrant('500110000'), true);
  assert.equal(isEffectifAberrant('0'), true);
  assert.equal(isEffectifAberrant('-12'), true);
  assert.equal(isEffectifAberrant('0661482910'), true);
  assert.equal(isEffectifAberrant('45'), false);
  assert.equal(isEffectifAberrant('10-50'), false);
  assert.equal(isEffectifAberrant('Non précisé'), false);
  assert.equal(isEffectifAberrant(''), false);

  const bankFiche = makeFiche({
    id: 'f_op_0151',
    numeroFiche: 'OP-0151',
    societe: 'Attijariwafa Bank',
    effectif: '500110000',
  });

  const report = analyzeDataHygiene([bankFiche], []);
  assert.equal(report.isHealthy, false);
  assert.equal(report.countsByCategory.effectif_aberrant, 1);
  assert.equal(report.autoFixableCount, 1);

  const anomaly = report.anomalies[0];
  assert.equal(anomaly.category, 'effectif_aberrant');
  assert.equal(anomaly.beforeValue, '500110000');
  assert.equal(anomaly.afterValue, 'Non précisé');
  assert.equal(anomaly.autoFixable, true);

  const { updatedFiche, changes } = applySafeHygieneFixesToFiche(bankFiche, report.anomalies);
  assert.equal(updatedFiche.effectif, 'Non précisé');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].field, 'effectif');
  assert.equal(changes[0].oldValue, '500110000');
  assert.equal(changes[0].newValue, 'Non précisé');
});

test('analyzeDataHygiene normalizes dirty Moroccan phones and flags short invalid numbers for manual review', () => {
  const dirtyFixable = makeFiche({
    id: 'f_tel_dirty',
    telephone: '  00212 (0)6-61.48/29 10 ',
  });
  const shortInvalid = makeFiche({
    id: 'f_tel_short',
    telephone: '061234',
  });

  const report = analyzeDataHygiene([dirtyFixable, shortInvalid], []);
  assert.equal(report.countsByCategory.telephone_mal_formate, 2);
  assert.equal(report.autoFixableCount, 1);
  assert.equal(report.manualReviewCount, 1);

  const fixable = report.anomalies.find((a) => a.ficheId === 'f_tel_dirty')!;
  assert.equal(fixable.autoFixable, true);
  assert.equal(fixable.afterValue, '06 61 48 29 10');

  const invalid = report.anomalies.find((a) => a.ficheId === 'f_tel_short')!;
  assert.equal(invalid.autoFixable, false);
  assert.equal(invalid.afterValue, null);

  const { updatedFiche } = applySafeHygieneFixesToFiche(dirtyFixable, [fixable]);
  assert.equal(updatedFiche.telephone, '06 61 48 29 10');
});

test('analyzeDataHygiene normalizes recoverable emails and flags broken emails for manual review', () => {
  const uppercaseEmail = makeFiche({
    id: 'f_email_upper',
    email: '  Contact@Societe-Maroc.MA  ',
  });
  const brokenEmail = makeFiche({
    id: 'f_email_broken',
    email: 'contact-sans-arobase.ma',
  });

  const report = analyzeDataHygiene([uppercaseEmail, brokenEmail], []);
  assert.equal(report.countsByCategory.email_invalide, 2);
  assert.equal(report.autoFixableCount, 1);
  assert.equal(report.manualReviewCount, 1);

  const fixable = report.anomalies.find((a) => a.ficheId === 'f_email_upper')!;
  assert.equal(fixable.autoFixable, true);
  assert.equal(fixable.afterValue, 'contact@societe-maroc.ma');

  const broken = report.anomalies.find((a) => a.ficheId === 'f_email_broken')!;
  assert.equal(broken.autoFixable, false);
  assert.equal(broken.afterValue, null);
});

test('analyzeDataHygiene flags orphan Signé Orange Pro fiches missing from signedContracts', () => {
  const orphanSigned = makeFiche({
    id: 'f_orphan_signed',
    numeroFiche: 'OP-0999',
    societe: 'Cabinet Notarial Al Amal',
    statut: 'Signé Orange Pro',
  });

  const report = analyzeDataHygiene([orphanSigned], [makeContract()]);
  assert.equal(report.countsByCategory.signe_sans_contrat, 1);
  assert.equal(report.autoFixableCount, 0);
  assert.equal(report.manualReviewCount, 1);

  const anomaly = report.anomalies[0];
  assert.equal(anomaly.category, 'signe_sans_contrat');
  assert.equal(anomaly.autoFixable, false);
  assert.equal(anomaly.beforeValue, 'Signé Orange Pro');
});
