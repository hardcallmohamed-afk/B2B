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
} from './attendance';

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
