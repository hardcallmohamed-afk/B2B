import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitFirstAndLastName,
  detectClientDeviceInfo,
  isDuringWorkHours,
  getLocalDateKey,
  formatWorkedDuration,
  buildWorkDisconnectEntry,
  parseWorkDisconnectEvent,
  shouldFlagAbruptClosure,
  computeHeartbeatDeltaSeconds,
  buildDeviceHistoryList,
  encodeLiveFieldTelemetry,
  parseLiveFieldTelemetry,
  resolveCollaboratorCoordinates,
  stripFieldTelemetrySuffix,
  computeDistanceKm,
  computeMercatorMarkerPosition,
  computeTeamBoundsZoom,
  computeVisibleGoogleMapTiles,
  panMercatorCenterByPixels,
  projectLatLngToMercatorWorld,
  reconcilePresenceOnlineState,
} from './attendance';
import { getRoleCapabilities } from './authAccess';

test('splitFirstAndLastName separates prénom and nom cleanly', () => {
  assert.deepEqual(splitFirstAndLastName('Youssef Bennani'), {
    firstName: 'Youssef',
    lastName: 'Bennani',
  });
  assert.deepEqual(splitFirstAndLastName('  Fatima Zahra   El Mansouri '), {
    firstName: 'Fatima',
    lastName: 'Zahra El Mansouri',
  });
  assert.deepEqual(splitFirstAndLastName('Mohamed'), {
    firstName: 'Mohamed',
    lastName: '',
  });
});

test('detectClientDeviceInfo identifies Windows Chrome desktop and iPhone Safari mobile', () => {
  const desktop = detectClientDeviceInfo(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    0,
    1440
  );
  assert.equal(desktop.deviceType, 'desktop');
  assert.equal(desktop.os, 'Windows');
  assert.equal(desktop.browser, 'Chrome');
  assert.equal(desktop.label, 'Windows · Chrome (PC / Bureau)');

  const mobile = detectClientDeviceInfo(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    5,
    390
  );
  assert.equal(mobile.deviceType, 'mobile');
  assert.equal(mobile.os, 'iPhone (iOS)');
  assert.equal(mobile.browser, 'Safari');
  assert.equal(mobile.label, 'iPhone (iOS) · Safari (Mobile)');
});

test('isDuringWorkHours enforces Mon-Fri 08:30-18:30, Sat 09:00-13:00, and Sun off', () => {
  // Wednesday 10:15 local
  assert.equal(isDuringWorkHours(new Date(2026, 10, 25, 10, 15, 0)).duringWorkHours, true);
  // Wednesday 07:45 local (before hours)
  assert.equal(isDuringWorkHours(new Date(2026, 10, 25, 7, 45, 0)).duringWorkHours, false);
  // Wednesday 20:00 local (after hours)
  assert.equal(isDuringWorkHours(new Date(2026, 10, 25, 20, 0, 0)).duringWorkHours, false);
  // Saturday 11:00 local
  assert.equal(isDuringWorkHours(new Date(2026, 10, 28, 11, 0, 0)).duringWorkHours, true);
  // Saturday 15:00 local
  assert.equal(isDuringWorkHours(new Date(2026, 10, 28, 15, 0, 0)).duringWorkHours, false);
  // Sunday 10:00 local
  assert.equal(isDuringWorkHours(new Date(2026, 10, 29, 10, 0, 0)).duringWorkHours, false);
});

test('formatWorkedDuration, disconnect entry parsing, and heartbeat delta caps behave accurately', () => {
  assert.equal(formatWorkedDuration(0), '0 min');
  assert.equal(formatWorkedDuration(45), '< 1 min');
  assert.equal(formatWorkedDuration(1500), '25 min');
  assert.equal(formatWorkedDuration(27720), '7h 42m');

  const raw = buildWorkDisconnectEntry('2026-11-25T10:42:00.000Z', 'Déconnexion manuelle');
  const parsed = parseWorkDisconnectEvent(raw);
  assert.equal(parsed.timestamp, '2026-11-25T10:42:00.000Z');
  assert.equal(parsed.reason, 'Déconnexion manuelle');

  assert.equal(shouldFlagAbruptClosure(1000, 5000, 120000), false); // quick F5 reload
  assert.equal(shouldFlagAbruptClosure(1000, 180000, 120000), true); // absent >= 2 min

  // Laptop sleep overnight (8h gap) is capped to maxStepSeconds (180s)
  assert.equal(computeHeartbeatDeltaSeconds(0, 8 * 3600 * 1000, 180), 180);
  assert.equal(computeHeartbeatDeltaSeconds(1000, 61000, 180), 60);

  assert.deepEqual(
    buildDeviceHistoryList(['Android · Chrome (Mobile)', 'Windows · Chrome (PC / Bureau)'], 'Windows · Chrome (PC / Bureau)'),
    ['Windows · Chrome (PC / Bureau)', 'Android · Chrome (Mobile)']
  );
  assert.match(getLocalDateKey(new Date(2026, 10, 25)), /^2026-11-25$/);
});

test('encodeLiveFieldTelemetry, parseLiveFieldTelemetry, and resolveCollaboratorCoordinates keep telemetry <= 160 chars and decode accurately', () => {
  const encoded = encodeLiveFieldTelemetry({
    baseDeviceLabel: 'iPhone (iOS) · Safari (Mobile)',
    status: 'en_rdv_client',
    lat: 33.8935,
    lng: -5.5473,
    accuracyMeters: 15,
    speedKmh: 0,
    clientName: 'Clinique Atlas (Meknès)',
    actionLabel: 'Signature contrat',
  });
  assert.ok(encoded.length <= 160);
  assert.equal(stripFieldTelemetrySuffix(encoded), 'iPhone (iOS) · Safari (Mobile)');

  const parsed = parseLiveFieldTelemetry(encoded, true, new Date().toISOString());
  assert.equal(parsed.cleanDeviceLabel, 'iPhone (iOS) · Safari (Mobile)');
  assert.equal(parsed.status, 'en_rdv_client');
  assert.equal(parsed.hasLiveGps, true);
  assert.equal(parsed.lat, 33.8935);
  assert.equal(parsed.lng, -5.5473);
  assert.equal(parsed.accuracyMeters, 15);
  assert.equal(parsed.clientName, 'Clinique Atlas (Meknès)');
  assert.equal(parsed.actionLabel, 'Signature contrat');

  // Offline status overrides active status
  const parsedOffline = parseLiveFieldTelemetry(encoded, false);
  assert.equal(parsedOffline.status, 'hors_ligne');

  // Zone fallback when GPS is null (formatted as Ville · Région for collaborator Orange Pro presentation)
  const fallbackCoords = resolveCollaboratorCoordinates({
    uid: 'user_fes_01',
    zone: 'Fès',
    lat: null,
    lng: null,
  });
  assert.equal(fallbackCoords.source, 'zone_reseau');
  assert.equal(fallbackCoords.cityLabel, 'Fès · Fès-Meknès');
  assert.equal(fallbackCoords.regionLabel, 'Fès-Meknès');
  assert.ok(Math.abs(fallbackCoords.lat - 34.0331) < 0.05);

  const distFesMeknes = computeDistanceKm(34.0331, -5.0003, 33.8935, -5.5473);
  assert.ok(distFesMeknes > 45 && distFesMeknes < 65);
});

test('6-decimal GPS precision and Web Mercator Google Maps HD projection place markers accurately at center and pan smoothly', () => {
  const encoded6 = encodeLiveFieldTelemetry({
    baseDeviceLabel: 'Android · Chrome (Mobile)',
    status: 'en_deplacement',
    lat: 33.893524,
    lng: -5.547271,
    accuracyMeters: 8,
    speedKmh: 42,
    clientName: 'Ste Atlas Logistique',
    actionLabel: 'Déplacement Terrain',
  });
  const parsed6 = parseLiveFieldTelemetry(encoded6, true);
  assert.equal(parsed6.lat, 33.893524);
  assert.equal(parsed6.lng, -5.547271);

  const resolved6 = resolveCollaboratorCoordinates({
    uid: 'u_exact_gps',
    zone: 'Meknès',
    lat: parsed6.lat,
    lng: parsed6.lng,
  });
  assert.equal(resolved6.source, 'gps_live');
  assert.equal(resolved6.lat, 33.893524);
  assert.equal(resolved6.lng, -5.547271);

  // At map center, marker position must land at exact center pixel (viewportWidth/2, viewportHeight/2)
  const centerMarker = computeMercatorMarkerPosition({
    lat: 33.893524,
    lng: -5.547271,
    centerLat: 33.893524,
    centerLng: -5.547271,
    zoom: 16,
    viewportWidth: 768,
    viewportHeight: 420,
  });
  assert.ok(Math.abs(centerMarker.leftPx - 384) < 0.01);
  assert.ok(Math.abs(centerMarker.topPx - 210) < 0.01);
  assert.equal(centerMarker.isInsideViewport, true);

  const tilesResult = computeVisibleGoogleMapTiles({
    centerLat: 33.893524,
    centerLng: -5.547271,
    zoom: 16,
    viewportWidth: 768,
    viewportHeight: 420,
    mapStyle: 'hybride',
  });
  assert.ok(tilesResult.tiles.length >= 6);
  assert.ok(tilesResult.tiles[0].url.includes('google.com/vt/lyrs=y'));

  const worldBefore = projectLatLngToMercatorWorld(33.893524, -5.547271, 16);
  const panned = panMercatorCenterByPixels(33.893524, -5.547271, 128, -64, 16);
  const worldAfter = projectLatLngToMercatorWorld(panned.lat, panned.lng, 16);
  assert.ok(Math.abs(worldAfter.worldX - (worldBefore.worldX - 128)) < 1);
  assert.ok(Math.abs(worldAfter.worldY - (worldBefore.worldY + 64)) < 1);
});

test('getRoleCapabilities grants progressive CRM privileges per role while strictly locking Users, API Keys Vault, and Live GPS Map to Super-Admin', () => {
  const nonAdminRoles = ['commercial', 'grand_compte', 'team_lead', 'manager'] as const;
  for (const r of nonAdminRoles) {
    const caps = getRoleCapabilities(r, false);
    assert.equal(caps.canManageUsers, false, `${r} must never access User Management`);
    assert.equal(caps.canAccessApiKeysVault, false, `${r} must never access API Keys Vault`);
    assert.equal(caps.canAccessLiveGpsMap, false, `${r} must never access Live GPS Map`);
    assert.ok(caps.unlockedPerks.length >= 3);
  }

  // Progressive perks verification
  const commCaps = getRoleCapabilities('commercial', false);
  const gcCaps = getRoleCapabilities('grand_compte', false);
  const leadCaps = getRoleCapabilities('team_lead', false);
  const mgrCaps = getRoleCapabilities('manager', false);

  assert.equal(commCaps.canPrioritizeGrandCompte, false);
  assert.equal(gcCaps.canPrioritizeGrandCompte, true);
  assert.equal(gcCaps.canUseMdmDeduplication, false);
  assert.equal(leadCaps.canUseMdmDeduplication, true);
  assert.equal(leadCaps.canSuperviseTeamPayouts, false);
  assert.equal(mgrCaps.canSuperviseTeamPayouts, true);

  // Only verified Super-Admin gets the 3 exclusive modules
  const superCaps = getRoleCapabilities('super_admin', true);
  assert.equal(superCaps.canManageUsers, true);
  assert.equal(superCaps.canAccessApiKeysVault, true);
  assert.equal(superCaps.canAccessLiveGpsMap, true);
});

test('reconcilePresenceOnlineState and computeTeamBoundsZoom keep online status reliable and fit team pins accurately', () => {
  const now = Date.parse('2026-11-26T11:00:00.000Z');
  // Active online session with fresh heartbeat -> online
  const activeFresh = reconcilePresenceOnlineState(
    true,
    '2026-11-26T10:59:15.000Z',
    now
  );
  assert.equal(activeFresh.effectiveOnline, true);
  assert.equal(activeFresh.isStaleSignal, false);

  // Explicit logout (isOnline=false) stays offline
  const loggedOut = reconcilePresenceOnlineState(
    false,
    '2026-11-26T10:59:15.000Z',
    now
  );
  assert.equal(loggedOut.effectiveOnline, false);
  assert.equal(loggedOut.isStaleSignal, false);

  // Stale session (15 min old > 10 min window) with isOnline=true -> reconciled as offline/stale
  const stale = reconcilePresenceOnlineState(
    true,
    '2026-11-26T10:45:00.000Z',
    now
  );
  assert.equal(stale.effectiveOnline, false);
  assert.equal(stale.isStaleSignal, true);

  // Default heartbeat cap is 120s (safe under Firestore +300s rule)
  assert.equal(computeHeartbeatDeltaSeconds(0, 600_000), 120);

  // computeTeamBoundsZoom frames single point tightly and multiple spread cities sensibly
  const single = computeTeamBoundsZoom([{ lat: 33.8935, lng: -5.5473 }], 800, 400);
  assert.equal(single.zoom, 15);
  assert.ok(Math.abs(single.centerLat - 33.8935) < 0.0001);

  const multi = computeTeamBoundsZoom(
    [
      { lat: 33.8935, lng: -5.5473 }, // Meknès
      { lat: 33.5731, lng: -7.5898 }, // Casablanca
    ],
    800,
    400
  );
  assert.ok(multi.zoom >= 7 && multi.zoom <= 11);
  assert.ok(multi.centerLat > 33.57 && multi.centerLat < 33.90);
});
