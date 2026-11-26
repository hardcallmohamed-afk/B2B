import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPdfMad } from './pdfGenerator';
import {
  doesCityBelongToRegion,
  filterCitiesByRegion,
  resolveCityAndRegionFromZoneString,
} from './moroccoCities';

test('formatPdfMad outputs ASCII spaces without Unicode U+202F or U+00A0 artifacts', () => {
  const formatted = formatPdfMad(12450.5, 2);
  assert.equal(/[\u00A0\u202F]/.test(formatted), false);
  assert.equal(formatted, '12 450,50');

  const annual = formatPdfMad(149400, 0);
  assert.equal(/[\u00A0\u202F]/.test(annual), false);
  assert.equal(annual, '149 400');

  assert.equal(formatPdfMad(-50, 2), '0,00');
  assert.equal(formatPdfMad(Number.NaN, 2), '0,00');
});

test('doesCityBelongToRegion and filterCitiesByRegion do not falsely assign unknown cities to fes_meknes', () => {
  assert.equal(doesCityBelongToRegion('Meknès', 'fes_meknes'), true);
  assert.equal(doesCityBelongToRegion('Casablanca', 'casablanca_settat'), true);
  assert.equal(doesCityBelongToRegion('Casablanca', 'fes_meknes'), false);
  assert.equal(doesCityBelongToRegion('Ville Inconnue XYZ', 'fes_meknes'), false);
  assert.equal(doesCityBelongToRegion('Ville Inconnue XYZ', 'all'), true);

  const resolvedUnknown = resolveCityAndRegionFromZoneString('Ville Inconnue XYZ');
  assert.equal(resolvedUnknown.matched, false);

  const fesMeknesCities = filterCitiesByRegion('fes_meknes', ['Ville Inconnue XYZ', 'Zone Industrielle Meknès']);
  assert.equal(fesMeknesCities.includes('Ville Inconnue XYZ'), false);
  assert.equal(fesMeknesCities.includes('Zone Industrielle Meknès'), true);
});
