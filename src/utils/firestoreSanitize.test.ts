import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDocId,
  sanitizeWorkspacePayload,
  sanitizeFichePayload,
  sanitizeSkillPayload,
  sanitizeAppUserPayload,
  serializeDocCanonical,
  computeCollectionSyncDiff,
  type SanitizedFicheDoc,
} from './firestoreSanitize';

test('sanitizeDocId enforces ^[a-zA-Z0-9_-]+$ and 1..128 char bounds', () => {
  assert.equal(sanitizeDocId('op_abc-123'), 'op_abc-123');
  assert.equal(sanitizeDocId('bad/id with spaces!'), 'bad_id_with_spaces_');
  assert.equal(sanitizeDocId('a'.repeat(200)).length, 128);
  assert.match(sanitizeDocId('   ', 'op'), /^op_[a-z0-9]+$/);
});

test('sanitizeWorkspacePayload enforces blueprint bounds for cities and signature', () => {
  const manyCities = Array.from({ length: 70 }, (_, i) => `Ville_${i}_${'x'.repeat(120)}`);
  const out = sanitizeWorkspacePayload('user_123', {
    villesAll: manyCities,
    villesActive: ['Meknès', 'Meknès', 'Fès'],
    modeVille: 'filter',
    defaultVille: '',
    emailSignature: 'S'.repeat(600),
    seeded: true,
  });

  assert.equal(out.ownerId, 'user_123');
  assert.equal(out.villesAll.length, 50);
  assert.equal(out.villesAll[0].length, 100);
  assert.deepEqual(out.villesActive, ['Meknès', 'Fès']);
  assert.equal(out.modeVille, 'filter');
  assert.equal(out.defaultVille.length <= 80, true);
  assert.equal(out.defaultVille.length >= 1, true);
  assert.equal(out.emailSignature.length, 400);
  assert.equal(out.seeded, true);
});

test('sanitizeFichePayload clamps strings, validates enums, caps enrichment clues, and handles multi-contacts + numeroFiche', () => {
  const out = sanitizeFichePayload('uid_1', {
    id: 'fiche/bad!id',
    numeroFiche: 'op-0042!!',
    societe: '  Société Test ' + 'A'.repeat(250),
    secteur: 'invalid_secteur',
    ville: 'Meknès',
    telephone: '0535521122',
    telephonesSupplementaires: Array.from({ length: 14 }, (_, i) => `06610000${String(i).padStart(2, '0')}`),
    email: 'contact@test.ma',
    emailsSupplementaires: Array.from({ length: 12 }, (_, i) => `user${i}@test.ma`),
    contact: 'M. Amine',
    role: 'Gérant',
    source: 'Pages Jaunes',
    effectif: '25',
    statut: 'Statut Inconnu',
    siteWeb: 'https://test.ma/' + 'p'.repeat(600),
    verifieWeb: true,
    pistesEnrichissement: Array.from({ length: 25 }, (_, i) => `Piste ${i} ${'z'.repeat(300)}`),
    dateAjout: '2026-11-25T10:00:00.000Z',
  });

  assert.equal(out.id, 'fiche_bad_id');
  assert.equal(out.numeroFiche, 'OP-0042');
  assert.equal(out.societe.length, 200);
  assert.equal(out.secteur, 'pme');
  assert.equal(out.statut, 'À contacter');
  assert.equal(out.telephonesSupplementaires?.length, 10);
  assert.equal(out.emailsSupplementaires?.length, 10);
  assert.equal(out.siteWeb?.length, 500);
  assert.equal(out.pistesEnrichissement?.length, 15);
  assert.equal(out.pistesEnrichissement?.[0].length, 250);
});

test('sanitizeSkillPayload clamps rules to 4000 chars and defaults blank name', () => {
  const out = sanitizeSkillPayload('uid_1', {
    id: 'terrain-orange',
    nom: '   ',
    description: 'Desc',
    role: 'Role',
    regles: 'R'.repeat(5000),
    ctaStyle: 'CTA',
    isBuiltin: true,
  });

  assert.equal(out.id, 'terrain-orange');
  assert.equal(out.nom, 'Skill personnalisé');
  assert.equal(out.regles.length, 4000);
  assert.equal(out.isBuiltin, true);
});

test('computeCollectionSyncDiff detects create, status-only update, full update, delete, and no-op', () => {
  const baseA = sanitizeFichePayload('u1', {
    id: 'op_1',
    societe: 'Fiduciaire Atlas',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '0535521100',
    email: 'a@atlas.ma',
    contact: 'Karim',
    role: 'Gérant',
    source: 'Manuel',
    effectif: '12',
    statut: 'À contacter',
    dateAjout: '2026-11-25T10:00:00.000Z',
  });
  const baseB = sanitizeFichePayload('u1', {
    ...baseA,
    id: 'op_2',
    societe: 'Clinique Al Amal',
  });

  const known = new Map<string, { hash: string; doc: SanitizedFicheDoc }>([
    [baseA.id, { hash: serializeDocCanonical(baseA as unknown as Record<string, unknown>), doc: baseA }],
    [baseB.id, { hash: serializeDocCanonical(baseB as unknown as Record<string, unknown>), doc: baseB }],
  ]);

  // No-op check
  const noop = computeCollectionSyncDiff(known, [baseA, baseB]);
  assert.equal(noop.toCreate.length, 0);
  assert.equal(noop.toUpdate.length, 0);
  assert.equal(noop.toDelete.length, 0);

  // Status-only update on A, delete B, create C
  const updatedA: SanitizedFicheDoc = { ...baseA, statut: 'RDV pris' };
  const createdC = sanitizeFichePayload('u1', { ...baseA, id: 'op_3', societe: 'Notaire Fès' });
  const diff = computeCollectionSyncDiff(known, [updatedA, createdC]);

  assert.equal(diff.toCreate.length, 1);
  assert.equal(diff.toCreate[0].id, 'op_3');
  assert.equal(diff.toUpdate.length, 1);
  assert.equal(diff.toUpdate[0].id, 'op_1');
  assert.equal(diff.toUpdate[0].statusOnly, true);
  assert.deepEqual(diff.toDelete, ['op_2']);

  // Multi-field update sets statusOnly = false
  const editedA: SanitizedFicheDoc = { ...baseA, statut: 'RDV pris', telephone: '0661223344' };
  const diff2 = computeCollectionSyncDiff(known, [editedA, baseB]);
  assert.equal(diff2.toUpdate.length, 1);
  assert.equal(diff2.toUpdate[0].statusOnly, false);
});

test('sanitizeAppUserPayload enforces role enum, email lowercasing, and blueprint bounds', () => {
  const out = sanitizeAppUserPayload({
    uid: 'uid/bad!',
    email: '  Rep.Meknes@OrangePro.MA ',
    displayName: '  Youssef Benali  ',
    role: 'superadmin_injection',
    zone: 'Meknès ' + 'Z'.repeat(150),
    active: true,
    createdBy: 'admin_123',
  });

  assert.equal(out.uid, 'uid_bad_');
  assert.equal(out.email, 'rep.meknes@orangepro.ma');
  assert.equal(out.displayName, 'Youssef Benali');
  assert.equal(out.role, 'commercial'); // invalid role safely falls back to commercial
  assert.equal(out.zone.length, 100);
  assert.equal(out.active, true);
  assert.equal(out.createdBy, 'admin_123');
});

test('sanitizeTeamStatPayload clamps counters, badges, monthlyHistory, and validates role', async () => {
  const { sanitizeTeamStatPayload } = await import('./firestoreSanitize');
  const out = sanitizeTeamStatPayload({
    uid: 'usr/1',
    displayName: '  Salma Idrissi ',
    role: 'invalid_role',
    zone: 'Meknès',
    active: true,
    totalProspects: -10,
    totalQualified: 25,
    totalContracts: 4,
    totalPayoutMad: 5200.6,
    xp: 1850,
    unlockedCount: 140,
    manualBadges: Array.from({ length: 25 }, (_, i) => `badge_${i}`),
    monthlyHistory: Array.from({ length: 30 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}:1:1000`),
  });

  assert.equal(out.uid, 'usr_1');
  assert.equal(out.orgScope, 'orange_pro_team');
  assert.equal(out.role, 'commercial');
  assert.equal(out.totalProspects, 0);
  assert.equal(out.totalPayoutMad, 5201);
  assert.equal(out.unlockedCount, 100);
  assert.equal(out.manualBadges.length, 20);
  assert.equal(out.monthlyHistory.length <= 24, true);
});

test('sanitizeSignedContractPayload strips invalid enums and enforces numeric bounds with zero PII fields', async () => {
  const { sanitizeSignedContractPayload } = await import('./firestoreSanitize');
  const out = sanitizeSignedContractPayload({
    id: 'ctr/001',
    ownerId: 'u_9',
    ownerName: 'Youssef',
    ficheId: 'op_77',
    numeroFiche: 'op-0077',
    societe: 'Clinique Atlas',
    ville: 'Meknès',
    secteur: 'clinique',
    produitOrangePro: 'Fibre Dédiée + Flotte Mobile Corporate + Standard Cloud',
    tier: 'InvalidTier',
    effectif: '45',
    payoutMad: -500,
    payoutStatus: 'HackerPaid',
    signedAt: '2026-11-25T15:00:00.000Z',
  });

  assert.equal(out.id, 'ctr_001');
  assert.equal(out.orgScope, 'orange_pro_team');
  assert.equal(out.numeroFiche, 'OP-0077');
  assert.equal(out.tier, 'PME');
  assert.equal(out.payoutStatus, 'En attente');
  assert.equal(out.payoutMad, 0);
  assert.equal('telephone' in out, false);
  assert.equal('email' in out, false);
});

test('sanitizeProviderId & sanitizeApiKeyConfigPayload normalize provider IDs and clamp API key fields', async () => {
  const { sanitizeProviderId, sanitizeApiKeyConfigPayload } = await import('./firestoreSanitize');
  assert.equal(sanitizeProviderId(' Groq / API! '), 'groq_api');
  assert.equal(sanitizeProviderId('   '), 'custom');

  const out = sanitizeApiKeyConfigPayload({
    provider: 'Groq',
    label: '  Groq Production Key  ',
    key: '  gsk_live_test_1234567890  ',
    active: true,
    updatedBy: 'admin_uid_1',
  });

  assert.equal(out.provider, 'groq');
  assert.equal(out.label, 'Groq Production Key');
  assert.equal(out.key, 'gsk_live_test_1234567890');
  assert.equal(out.active, true);
  assert.equal(out.updatedBy, 'admin_uid_1');
});


