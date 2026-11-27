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

test('isDuringWorkHours enforces Mon-Fri 08:30-18:30, Sat 09:00-13:00, and Sun off in Africa/Casablanca (UTC+1)', () => {
  // Wednesday 10:15 Casablanca (09:15 UTC)
  assert.equal(isDuringWorkHours(new Date('2026-11-25T09:15:00.000Z')).duringWorkHours, true);
  // Wednesday 07:45 Casablanca (06:45 UTC - before hours)
  assert.equal(isDuringWorkHours(new Date('2026-11-25T06:45:00.000Z')).duringWorkHours, false);
  // Wednesday 20:00 Casablanca (19:00 UTC - after hours)
  assert.equal(isDuringWorkHours(new Date('2026-11-25T19:00:00.000Z')).duringWorkHours, false);
  // Saturday 11:00 Casablanca (10:00 UTC)
  assert.equal(isDuringWorkHours(new Date('2026-11-28T10:00:00.000Z')).duringWorkHours, true);
  // Saturday 15:00 Casablanca (14:00 UTC)
  assert.equal(isDuringWorkHours(new Date('2026-11-28T14:00:00.000Z')).duringWorkHours, false);
  // Sunday 10:00 Casablanca (09:00 UTC)
  assert.equal(isDuringWorkHours(new Date('2026-11-29T09:00:00.000Z')).duringWorkHours, false);
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
  assert.match(getLocalDateKey(new Date('2026-11-25T12:00:00.000Z')), /^2026-11-25$/);
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
  assert.ok(tilesResult.tiles[0].url.includes('arcgisonline.com/ArcGIS/rest/services/World_Imagery'));

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

  // All commercial roles have full access to Crawler L2, Batch Audit 8 workers, MDM Deduplication, and Backup JSON
  for (const r of nonAdminRoles) {
    const caps = getRoleCapabilities(r, false);
    assert.equal(caps.canUseDeepCrawlerL2, true);
    assert.equal(caps.canBatchAudit8Workers, true);
    assert.equal(caps.canUseMdmDeduplication, true);
    assert.equal(caps.canExportFullBackupJson, true);
  }

  // Supervision & hierarchy perks verification
  const commCaps = getRoleCapabilities('commercial', false);
  const gcCaps = getRoleCapabilities('grand_compte', false);
  const leadCaps = getRoleCapabilities('team_lead', false);
  const mgrCaps = getRoleCapabilities('manager', false);

  assert.equal(commCaps.canPrioritizeGrandCompte, false);
  assert.equal(gcCaps.canPrioritizeGrandCompte, true);
  assert.equal(gcCaps.canViewSquadLeaderboard, false);
  assert.equal(leadCaps.canViewSquadLeaderboard, true);
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

  // Mobile background session (12 min old <= 15 min window) stays online
  const mobileBg = reconcilePresenceOnlineState(
    true,
    '2026-11-26T10:48:00.000Z',
    now
  );
  assert.equal(mobileBg.effectiveOnline, true);
  assert.equal(mobileBg.isStaleSignal, false);

  // Stale session (20 min old > 15 min window) with isOnline=true -> reconciled as offline/stale
  const stale = reconcilePresenceOnlineState(
    true,
    '2026-11-26T10:40:00.000Z',
    now
  );
  assert.equal(stale.effectiveOnline, false);
  assert.equal(stale.isStaleSignal, true);

  // Device clock skew (client lastSeenAt 25 min behind, but Firestore server updatedAt is 20s ago) -> stays online
  const clockSkewed = reconcilePresenceOnlineState(
    true,
    '2026-11-26T10:35:00.000Z',
    now,
    15 * 60 * 1000,
    '2026-11-26T10:59:40.000Z'
  );
  assert.equal(clockSkewed.effectiveOnline, true);
  assert.equal(clockSkewed.isStaleSignal, false);

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

test('attendance helpers strictly clamp multi-byte French text within Firestore UTF-8 byte limits', async () => {
  const {
    encodeLiveFieldTelemetry,
    buildDeviceHistoryList,
    buildWorkDisconnectEntry,
    splitFirstAndLastName,
  } = await import('./attendance');

  const byteLen = (s: string) => Buffer.byteLength(s, 'utf8');

  const telemetry = encodeLiveFieldTelemetry({
    baseDeviceLabel: 'Windows · Chrome (PC / Bureau) — Édition Étendue',
    status: 'en_rdv_client',
    lat: 33.90991,
    lng: -5.536218,
    accuracyMeters: 12,
    speedKmh: 45,
    clientName: 'Clinique Spécialisée Al-Fès & Associés 😀',
    actionLabel: 'Déplacement Terrain',
  });
  assert.ok(byteLen(telemetry) <= 160, `telemetry exceeded 160 bytes: ${byteLen(telemetry)}`);

  const devices = buildDeviceHistoryList(
    ['Android · Chrome — Écran Spécial 🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥'],
    'iPhone (iOS) · Safari (Mobile) — Édition Spéciale €€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€€'
  );
  for (const d of devices) {
    assert.ok(byteLen(d) <= 160, `device exceeded 160 bytes: ${byteLen(d)}`);
  }

  const disconnectEntry = buildWorkDisconnectEntry(
    '2026-11-26T10:43:00.000Z',
    'Déconnexion réseau imprévue à Fès-Meknès — tunnel SSH'
  );
  assert.ok(byteLen(disconnectEntry) <= 80, `disconnectEntry exceeded 80 bytes: ${byteLen(disconnectEntry)}`);

  const split = splitFirstAndLastName('Éléonore-Chloé ' + 'É'.repeat(40));
  assert.ok(byteLen(split.firstName) <= 60);
  assert.ok(byteLen(split.lastName) <= 60);
});

test('formatGpsAccuracyBadge, computeDistanceMeters, and rtcIceConfig TURN/ICE helpers classify precision and NAT candidates accurately', async () => {
  const { formatGpsAccuracyBadge, computeDistanceMeters } = await import('./attendance');
  const {
    buildTurnIceServersJson,
    parseIceServersJson,
    extractIceCandidateType,
  } = await import('./rtcIceConfig');

  const highAcc = formatGpsAccuracyBadge('gps_live', 14);
  assert.equal(highAcc.tier, 'precise');
  assert.equal(highAcc.label, 'GPS Précis (±14m)');

  const wifiAcc = formatGpsAccuracyBadge('gps_live', 450);
  assert.equal(wifiAcc.tier, 'wifi_cell');
  assert.equal(wifiAcc.label, 'Wi-Fi / 4G (±450m)');

  const ipAcc = formatGpsAccuracyBadge('gps_live', 5000);
  assert.equal(ipAcc.tier, 'approx');
  assert.equal(ipAcc.label, 'Position approximative IP / Zone (±5 km)');
  assert.equal(ipAcc.shortLabel, 'Position approximative IP / Zone');

  const zoneAcc = formatGpsAccuracyBadge('zone_reseau', null);
  assert.equal(zoneAcc.tier, 'approx');
  assert.equal(zoneAcc.label, 'Position approximative IP / Zone');

  const distMeters = computeDistanceMeters(33.8935, -5.5473, 33.8936, -5.5473);
  assert.ok(distMeters > 10 && distMeters < 15);

  const json = buildTurnIceServersJson({
    turnUrls: 'turns:global.relay.metered.ca:443?transport=tcp, turn:global.relay.metered.ca:80',
    username: 'orange_b2b_user',
    credential: 'secret_pass_123',
  });
  const parsed = parseIceServersJson(json);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].username, 'orange_b2b_user');
  assert.equal(parsed[1].credential, 'secret_pass_123');

  assert.equal(
    extractIceCandidateType(
      JSON.stringify({
        candidate:
          'candidate:4 1 UDP 16777215 102.50.12.4 58420 typ relay raddr 10.0.0.1 rport 51234',
      })
    ),
    'relay'
  );
  assert.equal(
    extractIceCandidateType(
      JSON.stringify({
        candidate: 'candidate:2 1 UDP 1686052607 196.200.145.11 54321 typ srflx raddr 192.168.1.10 rport 54321',
      })
    ),
    'srflx'
  );
  assert.equal(
    extractIceCandidateType(
      JSON.stringify({
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.10 54321 typ host',
      })
    ),
    'host'
  );
});

