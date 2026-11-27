import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCsvCell,
  toSafeExternalHttpUrl,
  evaluatePasswordStrength,
  sanitizeOrgSettingsConfig,
  DEFAULT_ORG_SETTINGS,
} from './securityHardening';

test('sanitizeCsvCell neutralizes CSV Formula Injection payloads and escapes quotes/delimiters', () => {
  assert.equal(sanitizeCsvCell('=CMD|"/C calc"!A0'), `"'=CMD|""/C calc""!A0"`);
  assert.equal(sanitizeCsvCell('+212661223344'), `'+212661223344`);
  assert.equal(sanitizeCsvCell('-10+5'), `'-10+5`);
  assert.equal(sanitizeCsvCell('@SUM(A1:A5)'), `'@SUM(A1:A5)`);
  assert.equal(sanitizeCsvCell('\t=1+1'), `'=1+1`);
  assert.equal(sanitizeCsvCell('\r+HYPERLINK("http://evil")'), `"'+HYPERLINK(""http://evil"")"`);
  assert.equal(sanitizeCsvCell('Société; Test "B2B"'), '"Société; Test ""B2B"""');
  assert.equal(sanitizeCsvCell('Clinique Atlas'), 'Clinique Atlas');
  assert.equal(sanitizeCsvCell(12.5, { decimalCommaForNumbers: true }), '12,5');
  assert.equal(sanitizeCsvCell(null), '');
});

test('toSafeExternalHttpUrl accepts valid http/https URLs and blocks XSS or non-http schemes', () => {
  assert.equal(toSafeExternalHttpUrl('https://fiduciaire-atlas.ma/contact'), 'https://fiduciaire-atlas.ma/contact');
  assert.equal(toSafeExternalHttpUrl('http://orange.ma'), 'http://orange.ma/');
  assert.equal(toSafeExternalHttpUrl('clinique-zerhoun.ma'), 'https://clinique-zerhoun.ma/');
  assert.equal(toSafeExternalHttpUrl('javascript:alert(1)'), null);
  assert.equal(toSafeExternalHttpUrl('JAVASCRIPT:void(0)'), null);
  assert.equal(toSafeExternalHttpUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(toSafeExternalHttpUrl('vbscript:msgbox(1)'), null);
  assert.equal(toSafeExternalHttpUrl('file:///etc/passwd'), null);
  assert.equal(toSafeExternalHttpUrl('https://user:secret@evil.example/path'), null);
  assert.equal(toSafeExternalHttpUrl(''), null);
  assert.equal(toSafeExternalHttpUrl(undefined), null);
});

test('evaluatePasswordStrength enforces >=10 chars, >=3 classes, and rejects trivial sequences', () => {
  const weakShort = evaluatePasswordStrength('Ab1!short');
  assert.equal(weakShort.valid, false);
  assert.ok(weakShort.score <= 2);

  const weakSequence = evaluatePasswordStrength('Azerty123456!');
  assert.equal(weakSequence.valid, false);
  assert.equal(weakSequence.score, 1);

  const weakPasswordWord = evaluatePasswordStrength('MyPassword99!');
  assert.equal(weakPasswordWord.valid, false);

  const weakTwoClasses = evaluatePasswordStrength('abcdefghijkl');
  assert.equal(weakTwoClasses.valid, false);

  const strong = evaluatePasswordStrength('MeknesPro#2026');
  assert.equal(strong.valid, true);
  assert.equal(strong.score, 4);
  assert.equal(strong.label, 'Excellent');

  const robust3Classes = evaluatePasswordStrength('Diversifia2026');
  assert.equal(robust3Classes.valid, false); // contains 'diversifia'

  const valid3Classes = evaluatePasswordStrength('AtlasFibre2026');
  assert.equal(valid3Classes.valid, true);
  assert.equal(valid3Classes.score, 3);
  assert.equal(valid3Classes.label, 'Robuste');
});

test('sanitizeOrgSettingsConfig clamps numeric bounds and defaults invalid fields safely', () => {
  const out = sanitizeOrgSettingsConfig({
    companyName: '  DIVERSIFIA MAROC SARL  ',
    companyIce: '002345678000091',
    defaultPayoutGrandCompteMad: -100,
    defaultPayoutPmeMad: 2200,
    defaultPayoutTpeMad: 1100,
    defaultSlaRottingHours: 9999,
    defaultIdleLockMinutes: 45 as unknown as 30,
    dlpExportAlertThreshold: 2,
    enforceCndpOptOutLock: false,
  });

  assert.equal(out.companyName, 'DIVERSIFIA MAROC SARL');
  assert.equal(out.companyIce, '002345678000091');
  assert.equal(out.defaultPayoutGrandCompteMad, 0);
  assert.equal(out.defaultPayoutPmeMad, 2200);
  assert.equal(out.defaultPayoutTpeMad, 1100);
  assert.equal(out.defaultSlaRottingHours, 720);
  assert.equal(out.defaultIdleLockMinutes, DEFAULT_ORG_SETTINGS.defaultIdleLockMinutes);
  assert.equal(out.dlpExportAlertThreshold, 5);
  assert.equal(out.enforceCndpOptOutLock, false);
});
