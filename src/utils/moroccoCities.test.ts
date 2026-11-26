import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_MOROCCO_CITY_NAMES,
  MOROCCO_REGIONS,
  MOROCCO_CITIES_CATALOG,
  detectMoroccoGeographyFromCoordinates,
  resolveCityAndRegionFromZoneString,
  filterCitiesByRegion,
  doesCityBelongToRegion,
  mergeWithAllMoroccanCities,
  normalizeCityKey,
} from './moroccoCities';

test('MOROCCO_REGIONS covers all 12 official administrative regions of Morocco', () => {
  assert.equal(MOROCCO_REGIONS.length, 12);
  const regionIds = MOROCCO_REGIONS.map((r) => r.id);
  assert.ok(regionIds.includes('casablanca_settat'));
  assert.ok(regionIds.includes('rabat_sale_kenitra'));
  assert.ok(regionIds.includes('fes_meknes'));
  assert.ok(regionIds.includes('tanger_tetouan_al_hoceima'));
  assert.ok(regionIds.includes('marrakech_safi'));
  assert.ok(regionIds.includes('souss_massa'));
  assert.ok(regionIds.includes('oriental'));
  assert.ok(regionIds.includes('beni_mellal_khenifra'));
  assert.ok(regionIds.includes('draa_tafilalet'));
  assert.ok(regionIds.includes('guelmim_oued_noun'));
  assert.ok(regionIds.includes('laayoune_sakia_el_hamra'));
  assert.ok(regionIds.includes('dakhla_oued_ed_dahab'));
});

test('ALL_MOROCCO_CITY_NAMES catalog contains key commercial hubs and is normalized without duplicates', () => {
  assert.ok(ALL_MOROCCO_CITY_NAMES.length >= 80);
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Meknès'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Casablanca'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Rabat'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Tanger'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Marrakech'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Agadir'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Laâyoune'));
  assert.ok(ALL_MOROCCO_CITY_NAMES.includes('Dakhla'));

  // Ensure unique normalized keys
  const keys = ALL_MOROCCO_CITY_NAMES.map((c) => normalizeCityKey(c));
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, ALL_MOROCCO_CITY_NAMES.length);
});

test('detectMoroccoGeographyFromCoordinates identifies nearest city, nearest major city, and region', () => {
  // Near Meknès (33.8935, -5.5473)
  const geoMeknes = detectMoroccoGeographyFromCoordinates(33.894, -5.548);
  assert.equal(geoMeknes.detectedCity, 'Meknès');
  assert.equal(geoMeknes.nearestMajorCity, 'Meknès');
  assert.equal(geoMeknes.regionId, 'fes_meknes');
  assert.equal(geoMeknes.collaboratorPublicZoneLabel, 'Meknès · Fès-Meknès');
  assert.equal(
    geoMeknes.availabilityBadgeLabel,
    'Meknès (Fès-Meknès) — Disponible Services Orange Pro'
  );

  // Near Rabat center (34.02, -6.84)
  const geoRabat = detectMoroccoGeographyFromCoordinates(34.02, -6.84);
  assert.equal(geoRabat.regionId, 'rabat_sale_kenitra');
  assert.equal(geoRabat.nearestMajorCity, 'Rabat');
  assert.ok(geoRabat.collaboratorPublicZoneLabel.includes('Rabat-Salé-Kénitra'));
  assert.ok(geoRabat.availabilityBadgeLabel.includes('Disponible Services Orange Pro'));

  // Near Casablanca (33.58, -7.61)
  const geoCasa = detectMoroccoGeographyFromCoordinates(33.58, -7.61);
  assert.equal(geoCasa.detectedCity, 'Casablanca');
  assert.equal(geoCasa.nearestMajorCity, 'Casablanca');
  assert.equal(geoCasa.regionId, 'casablanca_settat');
});

test('resolveCityAndRegionFromZoneString formats zone for collaborator view and resolves region', () => {
  const r1 = resolveCityAndRegionFromZoneString('Casablanca');
  assert.equal(r1.city, 'Casablanca');
  assert.equal(r1.regionId, 'casablanca_settat');
  assert.equal(r1.formattedZone, 'Casablanca · Casablanca-Settat');
  assert.equal(
    r1.availabilityBadgeLabel,
    'Casablanca (Casa-Settat) — Disponible Services Orange Pro'
  );

  const r2 = resolveCityAndRegionFromZoneString('Fès · Fès-Meknès');
  assert.equal(r2.city, 'Fès');
  assert.equal(r2.regionId, 'fes_meknes');
  assert.equal(r2.majorCity, 'Fès');

  const r3 = resolveCityAndRegionFromZoneString('Agadir');
  assert.equal(r3.city, 'Agadir');
  assert.equal(r3.regionId, 'souss_massa');
});

test('filterCitiesByRegion and doesCityBelongToRegion correctly partition cities by administrative region', () => {
  const feskMeknesCities = filterCitiesByRegion('fes_meknes');
  assert.ok(feskMeknesCities.includes('Meknès'));
  assert.ok(feskMeknesCities.includes('Fès'));
  assert.ok(!feskMeknesCities.includes('Casablanca'));
  assert.ok(!feskMeknesCities.includes('Marrakech'));

  const casaCities = filterCitiesByRegion('casablanca_settat');
  assert.ok(casaCities.includes('Casablanca'));
  assert.ok(casaCities.includes('Mohammedia'));
  assert.ok(casaCities.includes('Settat'));
  assert.ok(!casaCities.includes('Rabat'));

  assert.equal(doesCityBelongToRegion('Meknès', 'fes_meknes'), true);
  assert.equal(doesCityBelongToRegion('Casablanca', 'fes_meknes'), false);
  assert.equal(doesCityBelongToRegion('Casablanca', 'casablanca_settat'), true);
  assert.equal(doesCityBelongToRegion('Tanger', 'all'), true);
});

test('mergeWithAllMoroccanCities preserves custom zones while guaranteeing national coverage', () => {
  const merged = mergeWithAllMoroccanCities(['Zone Franche Kénitra', 'Meknès']);
  assert.ok(merged.includes('Zone Franche Kénitra'));
  assert.ok(merged.includes('Meknès'));
  assert.ok(merged.includes('Casablanca'));
  assert.ok(merged.includes('Agadir'));
  assert.ok(merged.length >= ALL_MOROCCO_CITY_NAMES.length);
});
