import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMoroccanPhoneFragment,
  runGlobalSearch,
} from './globalSearch';
import type { FicheEntreprise } from './crmDomain';
import type { TeamStatRecord } from './gamification';

function makeFiche(overrides: Partial<FicheEntreprise> = {}): FicheEntreprise {
  return {
    id: overrides.id || 'f1',
    numeroFiche: overrides.numeroFiche || 'OP-1001',
    societe: overrides.societe || 'Fiduciaire Atlas Meknès',
    secteur: overrides.secteur || 'fiduciaire',
    ville: overrides.ville || 'Meknès',
    telephone: overrides.telephone || '0661445566',
    email: overrides.email || 'contact@atlas-fiduciaire.ma',
    contact: overrides.contact || 'Karim Bennis',
    role: overrides.role || 'Gérant',
    source: overrides.source || 'Prospection',
    effectif: overrides.effectif || '18',
    statut: overrides.statut || 'À contacter',
    dateAjout: overrides.dateAjout || '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

function makeMember(overrides: Partial<TeamStatRecord> = {}): TeamStatRecord {
  return {
    uid: overrides.uid || 'u1',
    orgScope: 'orange_pro_team',
    displayName: overrides.displayName || 'Youssef Alaoui',
    role: overrides.role || 'commercial',
    zone: overrides.zone || 'Meknès',
    active: overrides.active ?? true,
    totalProspects: overrides.totalProspects ?? 25,
    totalQualified: overrides.totalQualified ?? 10,
    totalContracts: overrides.totalContracts ?? 3,
    totalPayoutMad: overrides.totalPayoutMad ?? 4500,
    xp: overrides.xp ?? 1200,
    unlockedCount: overrides.unlockedCount ?? 4,
    manualBadges: [],
    monthlyHistory: [],
    ...overrides,
  };
}

test('globalSearch: accent-insensitive and case-insensitive search matches Moroccan cities & accented company names', () => {
  const fiches = [
    makeFiche({ id: 'f1', societe: 'Clinique Élégance Fès', ville: 'Fès', contact: 'Dr. Réda Tazi' }),
    makeFiche({ id: 'f2', societe: 'Hôtel Riad Meknès', ville: 'Meknès', secteur: 'riad_hotellerie' }),
  ];

  const resCity = runGlobalSearch({
    query: 'MEKNES',
    fiches,
    teamStats: [],
    role: 'commercial',
    isSuperAdmin: false,
  });
  assert.equal(resCity.fiches.length, 1);
  assert.equal(resCity.fiches[0].fiche.id, 'f2');

  const resAccent = runGlobalSearch({
    query: 'elegance fes',
    fiches,
    teamStats: [],
    role: 'commercial',
    isSuperAdmin: false,
  });
  assert.equal(resAccent.fiches.length, 1);
  assert.equal(resAccent.fiches[0].fiche.id, 'f1');
});

test('globalSearch: Moroccan phone normalization matches 0661, 06 61, +212661, 212661, and 00212 6 61 identically', () => {
  assert.equal(normalizeMoroccanPhoneFragment('0661'), '0661');
  assert.equal(normalizeMoroccanPhoneFragment('06 61'), '0661');
  assert.equal(normalizeMoroccanPhoneFragment('+212661'), '0661');
  assert.equal(normalizeMoroccanPhoneFragment('+212 6 61'), '0661');
  assert.equal(normalizeMoroccanPhoneFragment('212661'), '0661');
  assert.equal(normalizeMoroccanPhoneFragment('00212 661'), '0661');

  const fiches = [
    makeFiche({ id: 'f-phone', societe: 'Cabinet Zahra', telephone: '+212 6 61 98 76 54' }),
    makeFiche({ id: 'f-other', societe: 'Autre SARL', telephone: '0535112233' }),
  ];

  for (const q of ['0661', '06 61', '+212661', '212661', '0021266198']) {
    const res = runGlobalSearch({
      query: q,
      fiches,
      teamStats: [],
      role: 'commercial',
      isSuperAdmin: false,
    });
    assert.equal(res.fiches.length, 1, `Query "${q}" should match Cabinet Zahra`);
    assert.equal(res.fiches[0].fiche.id, 'f-phone');
  }
});

test('globalSearch: prioritizes exact matches and word-start matches over substring matches', () => {
  const fiches = [
    makeFiche({ id: 'sub', numeroFiche: 'OP-2001', societe: 'Société Super Atlas Distribution' }),
    makeFiche({ id: 'prefix', numeroFiche: 'OP-2002', societe: 'Atlas Telecom Pro' }),
    makeFiche({ id: 'exact', numeroFiche: 'OP-2003', societe: 'Atlas' }),
  ];

  const res = runGlobalSearch({
    query: 'Atlas',
    fiches,
    teamStats: [],
    role: 'commercial',
    isSuperAdmin: false,
  });

  assert.deepEqual(
    res.fiches.map((h) => h.fiche.id),
    ['exact', 'prefix', 'sub']
  );

  // Exact numeroFiche match
  const resCode = runGlobalSearch({
    query: 'OP-2002',
    fiches,
    teamStats: [],
    role: 'commercial',
    isSuperAdmin: false,
  });
  assert.equal(resCode.fiches[0].fiche.id, 'prefix');
});

test('globalSearch: strict RBAC blocks #/admin, #/admin/radar, and #/vault for all non-super-admin roles', () => {
  const nonSuperAdminRoles = ['commercial', 'grand_compte', 'senior', 'team_lead', 'manager'];
  const sensitiveQueries = ['', 'admin', 'radar', 'gps', 'vault', 'coffre', 'api'];

  for (const role of nonSuperAdminRoles) {
    for (const q of sensitiveQueries) {
      const res = runGlobalSearch({
        query: q,
        fiches: [],
        teamStats: [],
        role,
        isSuperAdmin: false,
      });
      const restrictedHits = res.actions.filter(
        (a) => a.tab === 'admin' || a.tab === 'vault' || a.superAdminOnly
      );
      assert.equal(
        restrictedHits.length,
        0,
        `Role "${role}" must NEVER see admin/radar/vault for query "${q}"`
      );
    }
  }

  // Super-Admin MUST see them when searching
  const adminRes = runGlobalSearch({
    query: 'radar',
    fiches: [],
    teamStats: [],
    role: 'super_admin',
    isSuperAdmin: true,
  });
  assert.ok(
    adminRes.actions.some((a) => a.id === 'nav-admin-radar'),
    'Super-Admin must find Radar GPS route'
  );

  const vaultRes = runGlobalSearch({
    query: 'vault',
    fiches: [],
    teamStats: [],
    role: 'super_admin',
    isSuperAdmin: true,
  });
  assert.ok(
    vaultRes.actions.some((a) => a.id === 'nav-vault'),
    'Super-Admin must find Coffre Clés API route'
  );
});

test('globalSearch: enforces top-8 fiches and top-5 collaborators limits', () => {
  const fiches = Array.from({ length: 15 }, (_, i) =>
    makeFiche({ id: `f-${i}`, societe: `Entreprise Orange ${i + 1}`, numeroFiche: `OP-${3000 + i}` })
  );
  const teamStats = Array.from({ length: 9 }, (_, i) =>
    makeMember({ uid: `u-${i}`, displayName: `Commercial Maroc ${i + 1}`, zone: 'Casablanca' })
  );

  const resFiches = runGlobalSearch({
    query: 'Orange',
    fiches,
    teamStats,
    role: 'manager',
    isSuperAdmin: false,
  });
  assert.equal(resFiches.fiches.length, 8);

  const resTeam = runGlobalSearch({
    query: 'Maroc',
    fiches,
    teamStats,
    role: 'manager',
    isSuperAdmin: false,
  });
  assert.equal(resTeam.collaborators.length, 5);
});
