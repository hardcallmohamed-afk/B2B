import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRdvRequirements,
  isFicheDueForRelanceToday,
  ACTIVITE_TYPE_META,
  ACTIVITE_RESULTAT_META,
  formatFriendlyDateFr,
} from './activiteHelpers';
import {
  sanitizeActivitePayload,
  sanitizeFichePayload,
  sanitizeWorkspacePayload,
  sanitizeSignedContractPayload,
} from './firestoreSanitize';

test('validateRdvRequirements enforces valid date and lieu', () => {
  const emptyDate = validateRdvRequirements('', 'Siège Meknès');
  assert.equal(emptyDate.valid, false);
  assert.match(emptyDate.error || '', /date et l’heure/i);

  const invalidDate = validateRdvRequirements('not-a-date', 'Siège Meknès');
  assert.equal(invalidDate.valid, false);

  const emptyLieu = validateRdvRequirements('2026-11-30T10:00:00.000Z', '');
  assert.equal(emptyLieu.valid, false);
  assert.match(emptyLieu.error || '', /lieu ou l’adresse/i);

  const valid = validateRdvRequirements('2026-11-30T10:00:00.000Z', 'Cabinet Dr Alami, Av. des FAR, Meknès');
  assert.equal(valid.valid, true);
  assert.equal(valid.normalizedLieu, 'Cabinet Dr Alami, Av. des FAR, Meknès');
  assert.ok(valid.normalizedDate);
});

test('isFicheDueForRelanceToday accurately checks against local end of day', () => {
  const now = new Date('2026-11-26T12:00:00Z');

  // Relance scheduled earlier today
  const earlierToday = new Date('2026-11-26T09:00:00Z').toISOString();
  assert.equal(isFicheDueForRelanceToday(earlierToday, now), true);

  // Relance scheduled yesterday (overdue)
  const yesterday = new Date('2026-11-25T15:00:00Z').toISOString();
  assert.equal(isFicheDueForRelanceToday(yesterday, now), true);

  // Relance scheduled far in the future
  const nextMonth = new Date('2026-12-15T10:00:00Z').toISOString();
  assert.equal(isFicheDueForRelanceToday(nextMonth, now), false);

  // Missing or empty
  assert.equal(isFicheDueForRelanceToday(undefined, now), false);
  assert.equal(isFicheDueForRelanceToday('', now), false);
});

test('sanitizeActivitePayload validates enums, clamps sizes and preserves optional fields', () => {
  const result = sanitizeActivitePayload('user-123', 'op-456', {
    id: 'act-789',
    type: 'appel',
    resultat: 'joint',
    texte: 'Client intéressé par la Fibre 100M et 3 forfaits illimités.',
    auteurNom: 'Karim Bennani',
    prochaineRelanceAt: '2026-11-28T10:00:00.000Z',
    rdvAt: '2026-11-30T15:00:00.000Z',
    rdvLieu: 'Bureau Meknès',
  });

  assert.equal(result.id, 'act-789');
  assert.equal(result.ownerId, 'user-123');
  assert.equal(result.ficheId, 'op-456');
  assert.equal(result.type, 'appel');
  assert.equal(result.resultat, 'joint');
  assert.equal(result.texte, 'Client intéressé par la Fibre 100M et 3 forfaits illimités.');
  assert.equal(result.auteurNom, 'Karim Bennani');
  assert.equal(result.rdvAt, '2026-11-30T15:00:00.000Z');
  assert.equal(result.rdvLieu, 'Bureau Meknès');
  assert.equal(result.prochaineRelanceAt, '2026-11-28T10:00:00.000Z');

  // Fallback on invalid enum values
  const fallback = sanitizeActivitePayload('u', 'f', {
    id: 'act-bad',
    type: 'invalid_type',
    resultat: 'unknown_res',
    texte: 'x'.repeat(1500),
    auteurNom: '',
  });
  assert.equal(fallback.type, 'note');
  assert.equal(fallback.resultat, 'vide');
  assert.equal(fallback.texte.length, 1000);
  assert.equal(fallback.auteurNom, 'Collaborateur');
});

test('sanitizeFichePayload preserves optional mirror fields prochaineRelanceAt, rdvAt, rdvLieu', () => {
  const fiche = sanitizeFichePayload('usr-1', {
    id: 'op-001',
    societe: 'Cabinet Fiduciaire Atlas',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '0535520000',
    email: 'contact@atlas.ma',
    contact: 'M. Tazi',
    role: 'Gérant',
    source: 'Prospection terrain',
    effectif: '10',
    statut: 'RDV pris',
    dateAjout: '2026-11-20T00:00:00Z',
    prochaineRelanceAt: '2026-11-27T09:00:00Z',
    rdvAt: '2026-11-29T14:30:00Z',
    rdvLieu: 'Siège social Meknès',
  });

  assert.equal(fiche.prochaineRelanceAt, '2026-11-27T09:00:00Z');
  assert.equal(fiche.rdvAt, '2026-11-29T14:30:00Z');
  assert.equal(fiche.rdvLieu, 'Siège social Meknès');
});

test('sanitizeWorkspacePayload preserves legal company information and SignedContract preserves referenceVirement', () => {
  const ws = sanitizeWorkspacePayload('usr-1', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'filter',
    defaultVille: 'Meknès',
    emailSignature: 'DIVERSIFIA B2B',
    seeded: true,
    legalRaisonSociale: 'DIVERSIFIA SARL AU',
    legalIce: '003456789000012',
    legalAdresse: 'Avenue Hassan II, Meknès',
    legalTelephone: '0535500000',
  });

  assert.equal(ws.legalRaisonSociale, 'DIVERSIFIA SARL AU');
  assert.equal(ws.legalIce, '003456789000012');
  assert.equal(ws.legalAdresse, 'Avenue Hassan II, Meknès');
  assert.equal(ws.legalTelephone, '0535500000');

  const contract = sanitizeSignedContractPayload({
    id: 'ctr-1',
    ownerId: 'usr-1',
    ownerName: 'Ahmed',
    ficheId: 'op-1',
    societe: 'Client Test',
    ville: 'Meknès',
    secteur: 'pme',
    produitOrangePro: 'FTTH 100 Mega',
    tier: 'PME',
    effectif: '5',
    payoutMad: 300,
    payoutStatus: 'Versé',
    signedAt: '2026-11-26T10:00:00Z',
    referenceVirement: 'VIR-BMCE-2026-99881',
  });

  assert.equal(contract.referenceVirement, 'VIR-BMCE-2026-99881');
});
