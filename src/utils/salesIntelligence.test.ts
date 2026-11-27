import test from 'node:test';
import assert from 'node:assert/strict';
import type { FicheEntreprise } from './crmDomain';
import {
  computeLeadScore,
  computeDealRotting,
  computeWeightedPipelineForecast,
  parseFollowUpDelayToHours,
} from './salesIntelligence';

function makeFiche(overrides: Partial<FicheEntreprise> = {}): FicheEntreprise {
  return {
    id: 'op_1',
    societe: 'Clinique Atlas',
    secteur: 'clinique',
    ville: 'Meknès',
    telephone: '0535521100',
    email: 'direction@clinique-atlas.ma',
    contact: 'Dr. Amine',
    role: 'Directeur',
    source: 'Terrain',
    effectif: '45',
    statut: 'Devis envoyé',
    dateAjout: '2026-11-20T10:00:00.000Z',
    statutUpdatedAt: '2026-11-22T10:00:00.000Z',
    ...overrides,
  };
}

test('computeLeadScore assigns Grade A to high-value qualified accounts and penalizes optOut / Pas intéressé', () => {
  const hotLead = makeFiche({ verifieWeb: true });
  const scoreHot = computeLeadScore(hotLead);
  assert.equal(scoreHot.grade, 'A');
  assert.ok(scoreHot.score >= 80);
  assert.ok(scoreHot.reasons.length >= 2);

  const coldLead = makeFiche({
    secteur: 'commerce',
    effectif: '',
    telephone: '',
    email: '',
    contact: '',
    statut: 'À contacter',
  });
  const scoreCold = computeLeadScore(coldLead);
  assert.equal(scoreCold.grade, 'C');
  assert.ok(scoreCold.score < 45);

  const optedOut = computeLeadScore(makeFiche({ optOut: true }));
  assert.equal(optedOut.score, 0);
  assert.equal(optedOut.grade, 'C');

  const lost = computeLeadScore(makeFiche({ statut: 'Pas intéressé' }));
  assert.equal(lost.grade, 'C');
  assert.ok(lost.score <= 15);
});

test('computeDealRotting flags stale active deals beyond SLA threshold and ignores terminal or optOut deals', () => {
  const nowMs = Date.parse('2026-11-27T10:00:00.000Z');
  const stale = makeFiche({
    statut: 'RDV pris',
    statutUpdatedAt: '2026-11-23T08:00:00.000Z', // 98h ago
  });
  const rot72 = computeDealRotting(stale, '72h', nowMs);
  assert.equal(rot72.isRotting, true);
  assert.equal(rot72.elapsedDays, 4);
  assert.equal(rot72.label, 'Dormant 4j');

  const fresh = makeFiche({
    statut: 'Appel en cours',
    statutUpdatedAt: '2026-11-26T20:00:00.000Z', // 14h ago
  });
  assert.equal(computeDealRotting(fresh, '24h', nowMs).isRotting, false);

  const signed = makeFiche({
    statut: 'Signé Orange Pro',
    statutUpdatedAt: '2026-10-01T10:00:00.000Z',
  });
  assert.equal(computeDealRotting(signed, '24h', nowMs).isRotting, false);

  assert.equal(parseFollowUpDelayToHours('7d'), 168);
});

test('computeWeightedPipelineForecast weights stages accurately with custom org payout tiers', () => {
  const nowMs = Date.parse('2026-11-27T10:00:00.000Z');
  const fiches: FicheEntreprise[] = [
    // Grand Compte (4000 MAD) at Devis envoyé (75%) -> 3000 weighted
    makeFiche({ id: 'f1', effectif: '50', statut: 'Devis envoyé', statutUpdatedAt: '2026-11-20T10:00:00.000Z' }),
    // PME (2000 MAD) at RDV pris (50%) -> 1000 weighted
    makeFiche({ id: 'f2', secteur: 'pme', effectif: '15', statut: 'RDV pris', statutUpdatedAt: '2026-11-26T10:00:00.000Z' }),
    // TPE (1000 MAD) at Signé Orange Pro (100%) -> 1000 signed + weighted
    makeFiche({ id: 'f3', secteur: 'commerce', effectif: '4', statut: 'Signé Orange Pro' }),
    // Opt-out excluded
    makeFiche({ id: 'f4', effectif: '60', statut: 'Devis envoyé', optOut: true }),
  ];

  const forecast = computeWeightedPipelineForecast(fiches, {
    orgSettings: {
      defaultPayoutGrandCompteMad: 4000,
      defaultPayoutPmeMad: 2000,
      defaultPayoutTpeMad: 1000,
      defaultSlaRottingHours: 72,
    },
    monthlyGoalPayoutMad: 10000,
    nowMs,
  });

  assert.equal(forecast.grossPipelineMad, 6000);
  assert.equal(forecast.signedRevenueMad, 1000);
  assert.equal(forecast.weightedForecastMad, 5000);
  assert.equal(forecast.activeDealsCount, 2);
  assert.equal(forecast.rottingDealsCount, 1);
  assert.equal(forecast.goalProgressPct, 50);
});
