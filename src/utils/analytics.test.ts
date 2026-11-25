import test from 'node:test';
import assert from 'node:assert/strict';
import type { FicheEntreprise } from '../App';
import {
  buildKpiTrendSeries,
  buildPipelineFunnelStats,
  buildCityAndOfferBreakdown,
  groupFichesByStatut,
  moveFicheToStatut,
  buildPortfolioAiSummary,
  KANBAN_STAGES,
} from './analytics';

const refDate = new Date('2026-11-25T12:00:00.000Z');
const daysAgo = (n: number) => new Date(refDate.getTime() - n * 86400000).toISOString();

const sampleFiches: FicheEntreprise[] = [
  {
    id: 'f1',
    societe: 'Fiduciaire Atlas',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '0535521840',
    email: 'contact@fiduciaire-atlas.ma',
    contact: 'Khalid Bennani',
    role: 'Expert-Comptable',
    source: 'Pages Jaunes',
    effectif: '14',
    statut: 'RDV pris',
    dateAjout: daysAgo(25),
  },
  {
    id: 'f2',
    societe: 'Clinique Privée Saïss',
    secteur: 'clinique',
    ville: 'Meknès',
    telephone: '0535519022',
    email: 'dir@clinique-saiss.ma',
    contact: 'Dr Mohamed Tazi',
    role: 'Directeur Médical',
    source: 'Kerix',
    effectif: '48',
    statut: 'Signé Orange Pro',
    dateAjout: daysAgo(12),
  },
  {
    id: 'f3',
    societe: 'Auto-École Al Mansour',
    secteur: 'auto_ecole',
    ville: 'El Hajeb',
    telephone: '0663712045',
    email: '',
    contact: '',
    role: '',
    source: 'Porte à porte',
    effectif: '',
    statut: 'À contacter',
    dateAjout: daysAgo(2),
  },
  {
    id: 'f4',
    societe: 'Sogetra BTP Ifrane',
    secteur: 'btp',
    ville: 'Ifrane',
    telephone: '0661904412',
    email: 'direction@sogetra.ma',
    contact: 'Karim Idrissi',
    role: 'Gérant',
    source: 'Google Maps',
    effectif: '32',
    statut: 'Devis envoyé',
    dateAjout: daysAgo(0),
  },
];

test('buildKpiTrendSeries computes cumulative totals, qualified counts, signed counts, and deltas over 30d', () => {
  const res = buildKpiTrendSeries(sampleFiches, '30d', refDate);
  assert.equal(res.points.length, 10);
  assert.equal(res.totalNow, 4);
  assert.equal(res.qualifiedNow, 3); // RDV pris + Signé + Devis envoyé
  assert.equal(res.signedNow, 1);
  assert.equal(res.conversionRate, 75);
  assert.equal(res.points[0].totalFiches, 0); // 29 days ago, before f1 (25 days ago)
  assert.equal(res.totalDelta, 4);
  assert.equal(res.points[res.points.length - 1].segments.bleu, 2);
  assert.equal(res.points[res.points.length - 1].segments.jaune, 1);
  assert.equal(res.points[res.points.length - 1].segments.violet, 1);
});

test('buildKpiTrendSeries supports 7d and 90d timeframes without negative counts', () => {
  const res7 = buildKpiTrendSeries(sampleFiches, '7d', refDate);
  assert.equal(res7.points.length, 7);
  assert.equal(res7.points[0].totalFiches, 2); // f1 and f2 added > 7 days ago
  assert.equal(res7.totalDelta, 2); // f3 and f4 added in last 7 days

  const res90 = buildKpiTrendSeries(sampleFiches, '90d', refDate);
  assert.equal(res90.points.length, 12);
  assert.equal(res90.totalNow, 4);
});

test('groupFichesByStatut maps all 6 CRM stages with headcount and maturity stats', () => {
  const cols = groupFichesByStatut(sampleFiches);
  assert.equal(cols.length, KANBAN_STAGES.length);
  assert.equal(cols.length, 6);

  const aContacter = cols.find((c) => c.meta.statut === 'À contacter')!;
  assert.equal(aContacter.items.length, 1);
  assert.equal(aContacter.totalEffectif, 0);

  const signe = cols.find((c) => c.meta.statut === 'Signé Orange Pro')!;
  assert.equal(signe.items.length, 1);
  assert.equal(signe.totalEffectif, 48);
  assert.equal(signe.avgMaturity, 100);
});

test('moveFicheToStatut updates stage immutably and detects no-op moves', () => {
  const move1 = moveFicheToStatut(sampleFiches, 'f3', 'RDV pris');
  assert.equal(move1.changed, true);
  assert.equal(move1.movedFiche?.statut, 'RDV pris');
  assert.equal(sampleFiches[2].statut, 'À contacter'); // original untouched
  assert.equal(move1.updated[2].statut, 'RDV pris');

  const moveNoop = moveFicheToStatut(sampleFiches, 'f3', 'À contacter');
  assert.equal(moveNoop.changed, false);
  assert.equal(moveNoop.movedFiche?.id, 'f3');
});

test('buildPortfolioAiSummary outputs structured real portfolio snapshot for AI Copilot', () => {
  const summary = buildPortfolioAiSummary(sampleFiches);
  assert.match(summary, /Total fiches : 4/);
  assert.match(summary, /Clinique Privée Saïss/);
  assert.match(summary, /Signé Orange Pro: 1/);
  assert.match(summary, /Meknès \(2\)/);
});

test('buildPipelineFunnelStats computes stage shares, headcount, and conversion rates', () => {
  const funnel = buildPipelineFunnelStats(sampleFiches);
  assert.equal(funnel.length, 6);
  const signed = funnel.find((s) => s.statut === 'Signé Orange Pro')!;
  assert.equal(signed.count, 1);
  assert.equal(signed.sharePct, 25);
  assert.equal(signed.totalEffectif, 48);
  assert.equal(signed.conversionPct, 50); // 1 signed out of 2 reaching Devis envoyé+
});

test('buildCityAndOfferBreakdown aggregates cities, offer tiers, and multi-contact totals', () => {
  const enrichedSample: FicheEntreprise[] = [
    {
      ...sampleFiches[0],
      numeroFiche: 'OP-0001',
      telephonesSupplementaires: ['0661223344'],
      emailsSupplementaires: ['k.bennani@fiduciaire-atlas.ma'],
    },
    ...sampleFiches.slice(1),
  ];
  const res = buildCityAndOfferBreakdown(enrichedSample);
  assert.equal(res.topCities[0].ville, 'Meknès');
  assert.equal(res.topCities[0].total, 2);
  assert.equal(res.topCities[0].qualified, 2);
  assert.equal(res.contactability.withMultiPhone, 1);
  assert.equal(res.contactability.withMultiEmail, 1);
  assert.equal(res.contactability.totalPhonesCount, 5);
  assert.equal(res.contactability.totalEmailsCount, 4);
  assert.equal(res.offerTiers.find((t) => t.tier === 'Grand Compte')?.count, 2); // f2 (48) + f4 (32)
});

