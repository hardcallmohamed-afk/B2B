import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRouteFromHash,
  buildHashFromRoute,
  resolveInitialCrmRoute,
  getRouteBreadcrumb,
  type CrmTabId,
} from './crmRouter';

test('parseRouteFromHash accurately parses all canonical routes and aliases', () => {
  assert.deepEqual(parseRouteFromHash(''), { tab: 'portefeuille' });
  assert.deepEqual(parseRouteFromHash('#/'), { tab: 'portefeuille' });
  assert.deepEqual(parseRouteFromHash('#/portefeuille'), { tab: 'portefeuille' });
  assert.deepEqual(parseRouteFromHash('#/crm'), { tab: 'portefeuille' });
  assert.deepEqual(parseRouteFromHash('#/kanban'), { tab: 'kanban' });
  assert.deepEqual(parseRouteFromHash('#/pipeline'), { tab: 'kanban' });
  assert.deepEqual(parseRouteFromHash('#/equipe'), { tab: 'team' });
  assert.deepEqual(parseRouteFromHash('#/team'), { tab: 'team' });
  assert.deepEqual(parseRouteFromHash('#/payouts'), { tab: 'team' });
  assert.deepEqual(parseRouteFromHash('#/succes'), { tab: 'badges' });
  assert.deepEqual(parseRouteFromHash('#/badges'), { tab: 'badges' });
  assert.deepEqual(parseRouteFromHash('#/crawler'), { tab: 'crawler' });
  assert.deepEqual(parseRouteFromHash('#/extraction'), { tab: 'paste' });
  assert.deepEqual(parseRouteFromHash('#/import'), { tab: 'paste' });
  assert.deepEqual(parseRouteFromHash('#/paste'), { tab: 'paste' });
  assert.deepEqual(parseRouteFromHash('#/deduplication'), { tab: 'dedup' });
  assert.deepEqual(parseRouteFromHash('#/compte'), { tab: 'compte' });
  assert.deepEqual(parseRouteFromHash('#/profil'), { tab: 'compte' });
  assert.deepEqual(parseRouteFromHash('#/account'), { tab: 'compte' });
  assert.deepEqual(parseRouteFromHash('#/vault'), { tab: 'vault', adminSubSection: 'vault' });
  assert.deepEqual(parseRouteFromHash('#/coffre'), { tab: 'vault', adminSubSection: 'vault' });
});

test('parseRouteFromHash accurately parses admin sub-routes', () => {
  assert.deepEqual(parseRouteFromHash('#/admin'), { tab: 'admin', adminSubSection: 'all' });
  assert.deepEqual(parseRouteFromHash('#/admin/utilisateurs'), {
    tab: 'admin',
    adminSubSection: 'users',
  });
  assert.deepEqual(parseRouteFromHash('#/admin/users'), {
    tab: 'admin',
    adminSubSection: 'users',
  });
  assert.deepEqual(parseRouteFromHash('#/admin/radar'), {
    tab: 'admin',
    adminSubSection: 'attendance',
  });
  assert.deepEqual(parseRouteFromHash('#/admin/presence'), {
    tab: 'admin',
    adminSubSection: 'attendance',
  });
  assert.deepEqual(parseRouteFromHash('#/admin/coffre'), {
    tab: 'vault',
    adminSubSection: 'vault',
  });
  assert.deepEqual(parseRouteFromHash('#/radar'), {
    tab: 'admin',
    adminSubSection: 'attendance',
  });
});

test('buildHashFromRoute generates clean canonical URLs', () => {
  assert.equal(buildHashFromRoute('portefeuille'), '#/portefeuille');
  assert.equal(buildHashFromRoute('kanban'), '#/kanban');
  assert.equal(buildHashFromRoute('team'), '#/equipe');
  assert.equal(buildHashFromRoute('badges'), '#/succes');
  assert.equal(buildHashFromRoute('crawler'), '#/crawler');
  assert.equal(buildHashFromRoute('paste'), '#/extraction');
  assert.equal(buildHashFromRoute('dedup'), '#/deduplication');
  assert.equal(buildHashFromRoute('compte'), '#/compte');
  assert.equal(buildHashFromRoute('admin', 'all'), '#/admin');
  assert.equal(buildHashFromRoute('admin', 'users'), '#/admin/utilisateurs');
  assert.equal(buildHashFromRoute('admin', 'attendance'), '#/admin/radar');
  assert.equal(buildHashFromRoute('admin', 'vault'), '#/vault');
  assert.equal(buildHashFromRoute('vault'), '#/vault');
});

test('resolveInitialCrmRoute prioritizes hash over fallback', () => {
  const fromHash = resolveInitialCrmRoute('#/equipe');
  assert.equal(fromHash.tab, 'team');

  const fromRadar = resolveInitialCrmRoute('#/admin/radar');
  assert.equal(fromRadar.tab, 'admin');
  assert.equal(fromRadar.adminSubSection, 'attendance');

  const fallback = resolveInitialCrmRoute('');
  assert.equal(fallback.tab, 'portefeuille');
});

test('getRouteBreadcrumb returns clean hierarchy labels', () => {
  const b1 = getRouteBreadcrumb('portefeuille');
  assert.equal(b1.sectionLabel, 'Commercial');
  assert.equal(b1.tabLabel, 'Portefeuille CRM');

  const b2 = getRouteBreadcrumb('admin', 'attendance');
  assert.equal(b2.sectionLabel, 'Administration');
  assert.equal(b2.tabLabel, 'Console Super-Admin');
  assert.equal(b2.subLabel, 'Radar GPS & Présence Terrain');
});
