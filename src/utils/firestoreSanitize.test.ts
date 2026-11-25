import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDocId,
  sanitizeWorkspacePayload,
  sanitizeFichePayload,
  sanitizeSkillPayload,
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

test('sanitizeFichePayload clamps strings, validates enums, and caps enrichment clues', () => {
  const out = sanitizeFichePayload('uid_1', {
    id: 'fiche/bad!id',
    societe: '  Société Test ' + 'A'.repeat(250),
    secteur: 'invalid_secteur',
    ville: 'Meknès',
    telephone: '0535521122',
    email: 'contact@test.ma',
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
  assert.equal(out.societe.length, 200);
  assert.equal(out.secteur, 'pme');
  assert.equal(out.statut, 'À contacter');
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
