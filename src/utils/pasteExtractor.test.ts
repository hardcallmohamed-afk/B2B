import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePastedText,
  extractAllMoroccanPhones,
  extractAllEmails,
  extractDecideurEnhanced,
  extractEffectifEnhanced,
  extractSiteWebEnhanced,
  extractAllFromAssistedPaste,
  mergeMultiPhones,
  mergeMultiEmails,
  generateNextNumeroFiche,
  ensureUniqueNumeroFiches,
} from './pasteExtractor';

test('normalizePastedText strips Google Maps/AI Overview bidi markers, dashes, and HTML tel/mailto links', () => {
  const raw =
    '<p>Aperçu IA\u200B : <a href="tel:+212535521840">Appeler</a> · \u202A(0535) 52–18–40\u202C · contact [at] atlas-meknes.ma</p>';
  const norm = normalizePastedText(raw);
  assert.ok(norm.includes('+212535521840'));
  assert.ok(norm.includes('(0535) 52-18-40'));
  assert.ok(norm.includes('contact@atlas-meknes.ma'));
  assert.ok(!norm.includes('\u202A'));
});

test('extractAllMoroccanPhones extracts multiple numbers from Google AI Overview with parentheses, en-dashes, and +212', () => {
  const googleAiSnippet = `
    Aperçu IA — Clinique Privée Atlas Meknès
    La Clinique Privée Atlas à Meknès est joignable au \u202A+212 (0)5 35 51 90 22\u202C,
    au standard (0535) 51–90–23 ou via GSM urgence 06.61.48.29.10 / 00212 7 00 11 22 33.
  `;
  const phones = extractAllMoroccanPhones(googleAiSnippet);
  assert.deepEqual(phones, ['0535519022', '0535519023', '0661482910', '0700112233']);
});

test('extractAllEmails returns all valid emails sorted with company-domain matches first', () => {
  const raw = `
    Contact générique: commercial@gmail.com
    Direction: direction@fiduciaire-ismailia.ma
    Secrétariat: secretariat@fiduciaire-ismailia.ma
    Ignoré: noreply@google.com, info@telecontact.ma
  `;
  const emails = extractAllEmails(raw, 'Fiduciaire Ismailia Expertise');
  assert.equal(emails.length, 3);
  assert.ok(emails[0].includes('fiduciaire-ismailia.ma'));
  assert.ok(emails[1].includes('fiduciaire-ismailia.ma'));
  assert.equal(emails[2], 'commercial@gmail.com');
});

test('extractAllFromAssistedPaste parses full Google AI Overview French prose accurately', () => {
  const aiOverview = `
    Aperçu IA
    Pharmacie Zerhoun est une officine située à Moulay Idriss Zerhoun, dirigée par Dr Rachid Benjelloun, Pharmacien titulaire.
    L'établissement compte environ 12 salariés et dispose d'un site web : www.pharmacie-zerhoun.ma.
    Téléphones : +212 5 35 54 42 10 / 06 62 11 44 88
    Email : contact@pharmacie-zerhoun.ma et commandes@pharmacie-zerhoun.ma
  `;
  const res = extractAllFromAssistedPaste(aiOverview, 'Pharmacie Zerhoun');
  assert.deepEqual(res.phones, ['0535544210', '0662114488']);
  assert.deepEqual(res.emails, ['contact@pharmacie-zerhoun.ma', 'commandes@pharmacie-zerhoun.ma']);
  assert.equal(res.contact, 'Dr Rachid Benjelloun');
  assert.equal(res.role, 'Pharmacien titulaire');
  assert.equal(res.effectif, '12');
  assert.equal(res.siteWeb, 'https://www.pharmacie-zerhoun.ma');
});

test('extractDecideurEnhanced handles LinkedIn inverted lines and effectif ranges', () => {
  const dec = extractDecideurEnhanced('Youssef El Alami - Directeur Commercial chez Saïss Immo');
  assert.equal(dec.contact, 'Youssef El Alami');
  assert.equal(dec.role, 'Directeur Commercial');

  assert.equal(extractEffectifEnhanced('Entreprise comptant entre 20 et 40 salariés'), '30');
  assert.equal(extractSiteWebEnhanced('Site officiel : fiduciaire-meknes.ma'), 'https://fiduciaire-meknes.ma');
});

test('mergeMultiPhones and mergeMultiEmails append new contacts even when primary already exists', () => {
  const mp = mergeMultiPhones('0535521840', ['0661224580'], ['+212 535 52 18 40', '0662998877', '0535529900']);
  assert.equal(mp.primary, '0535521840');
  assert.deepEqual(mp.extras, ['0661224580', '0662998877', '0535529900']);
  assert.equal(mp.addedCount, 2);

  const me = mergeMultiEmails('contact@atlas.ma', [], ['contact@atlas.ma', 'dg@atlas.ma', 'ventes@atlas.ma']);
  assert.equal(me.primary, 'contact@atlas.ma');
  assert.deepEqual(me.extras, ['dg@atlas.ma', 'ventes@atlas.ma']);
  assert.equal(me.addedCount, 2);
});

test('generateNextNumeroFiche and ensureUniqueNumeroFiches guarantee unique OP-XXXX codes', () => {
  const next = generateNextNumeroFiche([
    { numeroFiche: 'OP-0001' },
    { numeroFiche: 'OP-0012' },
    { numeroFiche: 'OP-0005' },
  ]);
  assert.equal(next, 'OP-0013');

  const backfilled = ensureUniqueNumeroFiches([
    { id: 'a', numeroFiche: 'OP-0001' },
    { id: 'b', numeroFiche: 'OP-0001' }, // duplicate
    { id: 'c' }, // missing
  ]);
  assert.equal(backfilled[0].numeroFiche, 'OP-0001');
  assert.equal(backfilled[1].numeroFiche, 'OP-0002');
  assert.equal(backfilled[2].numeroFiche, 'OP-0003');
  assert.equal(new Set(backfilled.map((x) => x.numeroFiche)).size, 3);
});
