import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCompanyNameCore,
  extractDistinctiveTokens,
  evaluateCompanyNameMatch,
  findSmartDuplicateGroups,
  type DedupCandidate,
} from './deduplication';

test('normalizeCompanyNameCore strips Moroccan legal forms, accents, and optional city suffix', () => {
  assert.equal(normalizeCompanyNameCore('STE Fiduciaire Ismailia Expertise SARL'), 'fiduciaire ismailia expertise');
  assert.equal(normalizeCompanyNameCore('Clinique Privée Atlas Meknès', true), 'clinique privee atlas');
  assert.deepEqual(extractDistinctiveTokens('Pharmacie Zerhoun Meknès'), ['zerhoun']);
});

test('findSmartDuplicateGroups NEVER groups distinct companies solely because they share an email', () => {
  const fiches: DedupCandidate[] = [
    {
      id: '1',
      societe: 'Pharmacie Zerhoun',
      ville: 'Moulay Idriss Zerhoun',
      telephone: '0535544210',
      email: 'contact@cabinet-comptable-partage.ma',
      secteur: 'commerce',
    },
    {
      id: '2',
      societe: 'Auto-École Al Mansour',
      ville: 'Meknès',
      telephone: '0663712045',
      email: 'contact@cabinet-comptable-partage.ma',
      secteur: 'auto_ecole',
    },
  ];

  const groups = findSmartDuplicateGroups(fiches);
  assert.equal(groups.length, 0);
});

test('findSmartDuplicateGroups prioritizes exact and fuzzy company name matches', () => {
  const fiches: DedupCandidate[] = [
    {
      id: 'a1',
      societe: 'Fiduciaire Ismailia Expertise',
      ville: 'Meknès',
      telephone: '0535521840',
      email: 'a@ismailia.ma',
      secteur: 'fiduciaire',
    },
    {
      id: 'a2',
      societe: 'STE Fiduciaire Ismailia Expertise SARL',
      ville: 'Meknès',
      telephone: '',
      email: '',
      secteur: 'fiduciaire',
    },
    {
      id: 'b1',
      societe: 'Clinique Privée Atlas Meknès',
      ville: 'Meknès',
      telephone: '0535519022',
      email: 'direction@clinique-atlas.ma',
      secteur: 'clinique',
    },
    {
      id: 'b2',
      societe: 'Clinique Atlas',
      ville: 'Meknès',
      telephone: '0535519023',
      email: 'accueil@atlas.ma',
      secteur: 'clinique',
    },
    {
      id: 'c1',
      societe: 'Pharmacie Zerhoun',
      ville: 'Meknès',
      telephone: '0535544210',
      email: '',
      secteur: 'commerce',
    },
    {
      id: 'c2',
      societe: 'Pharmacie Al Amal',
      ville: 'Meknès',
      telephone: '0535544299',
      email: '',
      secteur: 'commerce',
    },
  ];

  const groups = findSmartDuplicateGroups(fiches);
  assert.equal(groups.length, 2);

  // Exact match sorted first with 100% confidence
  assert.equal(groups[0].motif, 'Nom de société identique');
  assert.equal(groups[0].confidence, 100);
  assert.deepEqual(groups[0].ids.sort(), ['a1', 'a2']);

  // Fuzzy name match ("Clinique Privée Atlas Meknès" vs "Clinique Atlas")
  assert.equal(groups[1].motif, 'Nom de société très proche');
  assert.ok(groups[1].confidence >= 84);
  assert.deepEqual(groups[1].ids.sort(), ['b1', 'b2']);
});

test('evaluateCompanyNameMatch rejects unrelated companies sharing only generic sector words', () => {
  assert.equal(
    evaluateCompanyNameMatch(
      { id: '1', societe: 'Cabinet Fiduciaire Al Baraka', ville: 'Meknès', telephone: '', email: '', secteur: 'fiduciaire' },
      { id: '2', societe: 'Cabinet Fiduciaire Atlas', ville: 'Meknès', telephone: '', email: '', secteur: 'fiduciaire' }
    ),
    null
  );
  assert.equal(
    evaluateCompanyNameMatch(
      { id: '3', societe: 'Hôtel Riad Bahia', ville: 'Meknès', telephone: '', email: '', secteur: 'riad_hotellerie' },
      { id: '4', societe: 'Hôtel Riad Zitoune', ville: 'Meknès', telephone: '', email: '', secteur: 'riad_hotellerie' }
    ),
    null
  );
});

test('phone-only collisions are excluded by default unless company names are compatible or opt-in enabled', () => {
  const fiches: DedupCandidate[] = [
    { id: 'p1', societe: 'Menuiserie Benali', ville: 'Meknès', telephone: '0535500001', email: '' },
    { id: 'p2', societe: 'Boulangerie Al Qods', ville: 'Meknès', telephone: '0535500001', email: '' },
  ];

  assert.equal(findSmartDuplicateGroups(fiches, { includePhoneOnly: false }).length, 0);
  const withPhone = findSmartDuplicateGroups(fiches, { includePhoneOnly: true });
  assert.equal(withPhone.length, 1);
  assert.equal(withPhone[0].motif, 'Téléphone identique (contrôle secondaire)');
});
