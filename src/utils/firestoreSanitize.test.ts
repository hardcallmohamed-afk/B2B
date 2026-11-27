import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDocId,
  sanitizeWorkspacePayload,
  sanitizeFichePayload,
  sanitizeSkillPayload,
  sanitizeAppUserPayload,
  serializeDocCanonical,
  computeCollectionSyncDiff,
  type SanitizedFicheDoc,
} from './firestoreSanitize';

test('sanitizeDocId enforces ^[a-zA-Z0-9_-]+$ and 1..128 char bounds', () => {
  assert.equal(sanitizeDocId('op_abc-123'), 'op_abc-123');
  assert.equal(sanitizeDocId('bad/id with spaces!'), 'bad_id_with_spaces_');
  assert.equal(sanitizeDocId('a'.repeat(200)).length, 128);
  assert.match(sanitizeDocId('   ', 'op'), /^op_[a-z0-9]+$/);
});

test('sanitizeWorkspacePayload enforces blueprint bounds for cities and signature', () => {
  const manyCities = Array.from({ length: 70 }, (_, i) => `Ville_${i}_${'x'.repeat(120)}`);
  const out = sanitizeWorkspacePayload('user_123', {
    villesAll: manyCities,
    villesActive: ['Meknès', 'Meknès', 'Fès'],
    modeVille: 'filter',
    defaultVille: '',
    emailSignature: 'S'.repeat(600),
    seeded: true,
  });

  assert.equal(out.ownerId, 'user_123');
  assert.equal(out.villesAll.length, 50);
  assert.equal(out.villesAll[0].length, 100);
  assert.deepEqual(out.villesActive, ['Meknès', 'Fès']);
  assert.equal(out.modeVille, 'filter');
  assert.equal(out.defaultVille.length <= 80, true);
  assert.equal(out.defaultVille.length >= 1, true);
  assert.equal(out.emailSignature.length, 400);
  assert.equal(out.seeded, true);
});

test('sanitizeFichePayload clamps strings, validates enums, caps enrichment clues, and handles multi-contacts + numeroFiche', () => {
  const out = sanitizeFichePayload('uid_1', {
    id: 'fiche/bad!id',
    numeroFiche: 'op-0042!!',
    societe: '  Société Test ' + 'A'.repeat(250),
    secteur: 'invalid_secteur',
    ville: 'Meknès',
    telephone: '0535521122',
    telephonesSupplementaires: Array.from({ length: 14 }, (_, i) => `06610000${String(i).padStart(2, '0')}`),
    email: 'contact@test.ma',
    emailsSupplementaires: Array.from({ length: 12 }, (_, i) => `user${i}@test.ma`),
    contact: 'M. Amine',
    role: 'Gérant',
    source: 'Pages Jaunes',
    effectif: '25',
    statut: 'Statut Inconnu',
    siteWeb: 'https://test.ma/' + 'p'.repeat(600),
    verifieWeb: true,
    pistesEnrichissement: Array.from({ length: 25 }, (_, i) => `Piste ${i} ${'z'.repeat(300)}`),
    dateAjout: '2026-11-25T10:00:00.000Z',
  });

  assert.equal(out.id, 'fiche_bad_id');
  assert.equal(out.numeroFiche, 'OP-0042');
  assert.equal(Buffer.byteLength(out.societe, 'utf8'), 200);
  assert.equal(out.secteur, 'pme');
  assert.equal(out.statut, 'À contacter');
  assert.equal(out.telephonesSupplementaires?.length, 10);
  assert.equal(out.emailsSupplementaires?.length, 10);
  assert.equal(out.siteWeb?.length, 500);
  assert.equal(out.pistesEnrichissement?.length, 15);
  assert.equal(out.pistesEnrichissement?.[0].length, 250);
});

test('sanitizeSkillPayload clamps rules to 4000 chars and defaults blank name', () => {
  const out = sanitizeSkillPayload('uid_1', {
    id: 'terrain-orange',
    nom: '   ',
    description: 'Desc',
    role: 'Role',
    regles: 'R'.repeat(5000),
    ctaStyle: 'CTA',
    isBuiltin: true,
  });

  assert.equal(out.id, 'terrain-orange');
  assert.equal(out.nom, 'Skill personnalisé');
  assert.equal(out.regles.length, 4000);
  assert.equal(out.isBuiltin, true);
});

test('computeCollectionSyncDiff detects create, status-only update, full update, delete, and no-op', () => {
  const baseA = sanitizeFichePayload('u1', {
    id: 'op_1',
    societe: 'Fiduciaire Atlas',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '0535521100',
    email: 'a@atlas.ma',
    contact: 'Karim',
    role: 'Gérant',
    source: 'Manuel',
    effectif: '12',
    statut: 'À contacter',
    dateAjout: '2026-11-25T10:00:00.000Z',
  });
  const baseB = sanitizeFichePayload('u1', {
    ...baseA,
    id: 'op_2',
    societe: 'Clinique Al Amal',
  });

  const known = new Map<string, { hash: string; doc: SanitizedFicheDoc }>([
    [baseA.id, { hash: serializeDocCanonical(baseA as unknown as Record<string, unknown>), doc: baseA }],
    [baseB.id, { hash: serializeDocCanonical(baseB as unknown as Record<string, unknown>), doc: baseB }],
  ]);

  // No-op check
  const noop = computeCollectionSyncDiff(known, [baseA, baseB]);
  assert.equal(noop.toCreate.length, 0);
  assert.equal(noop.toUpdate.length, 0);
  assert.equal(noop.toDelete.length, 0);

  // Status-only update (statut + statutUpdatedAt) on A, delete B, create C
  const updatedA: SanitizedFicheDoc = {
    ...baseA,
    statut: 'RDV pris',
    statutUpdatedAt: '2026-11-25T11:30:00.000Z',
  };
  const createdC = sanitizeFichePayload('u1', {
    ...baseA,
    id: 'op_3',
    societe: 'Notaire Fès',
    statutUpdatedAt: '2026-11-25T11:30:00.000Z',
  });
  assert.equal(createdC.statutUpdatedAt, '2026-11-25T11:30:00.000Z');
  const diff = computeCollectionSyncDiff(known, [updatedA, createdC]);

  assert.equal(diff.toCreate.length, 1);
  assert.equal(diff.toCreate[0].id, 'op_3');
  assert.equal(diff.toUpdate.length, 1);
  assert.equal(diff.toUpdate[0].id, 'op_1');
  assert.equal(diff.toUpdate[0].statusOnly, true);
  assert.deepEqual(diff.toDelete, ['op_2']);

  // Multi-field update sets statusOnly = false
  const editedA: SanitizedFicheDoc = {
    ...baseA,
    statut: 'RDV pris',
    statutUpdatedAt: '2026-11-25T11:30:00.000Z',
    telephone: '0661223344',
  };
  const diff2 = computeCollectionSyncDiff(known, [editedA, baseB]);
  assert.equal(diff2.toUpdate.length, 1);
  assert.equal(diff2.toUpdate[0].statusOnly, false);
});

test('sanitizeAppUserPayload enforces role enum, email lowercasing, and blueprint bounds', () => {
  const out = sanitizeAppUserPayload({
    uid: 'uid/bad!',
    email: '  Rep.Meknes@OrangePro.MA ',
    displayName: '  Youssef Benali  ',
    role: 'superadmin_injection',
    zone: 'Meknès ' + 'Z'.repeat(150),
    active: true,
    createdBy: 'admin_123',
  });

  assert.equal(out.uid, 'uid_bad_');
  assert.equal(out.email, 'rep.meknes@orangepro.ma');
  assert.equal(out.displayName, 'Youssef Benali');
  assert.equal(out.role, 'commercial'); // invalid role safely falls back to commercial
  assert.equal(Buffer.byteLength(out.zone, 'utf8'), 100);
  assert.equal(out.active, true);
  assert.equal(out.createdBy, 'admin_123');
});

test('sanitizeTeamStatPayload clamps counters, badges, monthlyHistory, and validates role', async () => {
  const { sanitizeTeamStatPayload } = await import('./firestoreSanitize');
  const out = sanitizeTeamStatPayload({
    uid: 'usr/1',
    displayName: '  Salma Idrissi ',
    role: 'invalid_role',
    zone: 'Meknès',
    active: true,
    totalProspects: -10,
    totalQualified: 25,
    totalContracts: 4,
    totalPayoutMad: 5200.6,
    xp: 1850,
    unlockedCount: 140,
    manualBadges: Array.from({ length: 25 }, (_, i) => `badge_${i}`),
    monthlyHistory: Array.from({ length: 30 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}:1:1000`),
  });

  assert.equal(out.uid, 'usr_1');
  assert.equal(out.orgScope, 'orange_pro_team');
  assert.equal(out.role, 'commercial');
  assert.equal(out.totalProspects, 0);
  assert.equal(out.totalPayoutMad, 5201);
  assert.equal(out.unlockedCount, 100);
  assert.equal(out.manualBadges.length, 20);
  assert.equal(out.monthlyHistory.length <= 24, true);
});

test('sanitizeSignedContractPayload strips invalid enums and enforces numeric bounds with zero PII fields', async () => {
  const { sanitizeSignedContractPayload } = await import('./firestoreSanitize');
  const out = sanitizeSignedContractPayload({
    id: 'ctr/001',
    ownerId: 'u_9',
    ownerName: 'Youssef',
    ficheId: 'op_77',
    numeroFiche: 'op-0077',
    societe: 'Clinique Atlas',
    ville: 'Meknès',
    secteur: 'clinique',
    produitOrangePro: 'Fibre Dédiée + Flotte Mobile Corporate + Standard Cloud',
    tier: 'InvalidTier',
    effectif: '45',
    payoutMad: -500,
    payoutStatus: 'HackerPaid',
    signedAt: '2026-11-25T15:00:00.000Z',
  });

  assert.equal(out.id, 'ctr_001');
  assert.equal(out.orgScope, 'orange_pro_team');
  assert.equal(out.numeroFiche, 'OP-0077');
  assert.equal(out.tier, 'PME');
  assert.equal(out.payoutStatus, 'En attente');
  assert.equal(out.payoutMad, 0);
  assert.equal('telephone' in out, false);
  assert.equal('email' in out, false);
});

test('sanitizeProviderId & sanitizeApiKeyConfigPayload normalize provider IDs and clamp API key fields', async () => {
  const { sanitizeProviderId, sanitizeApiKeyConfigPayload } = await import('./firestoreSanitize');
  assert.equal(sanitizeProviderId(' Groq / API! '), 'groq_api');
  assert.equal(sanitizeProviderId('   '), 'custom');

  const out = sanitizeApiKeyConfigPayload({
    provider: 'Groq',
    label: '  Groq Production Key  ',
    key: '  gsk_live_test_1234567890  ',
    active: true,
    updatedBy: 'admin_uid_1',
  });

  assert.equal(out.provider, 'groq');
  assert.equal(out.label, 'Groq Production Key');
  assert.equal(out.key, 'gsk_live_test_1234567890');
  assert.equal(out.active, true);
  assert.equal(out.updatedBy, 'admin_uid_1');
});

test('sanitizeAvatarDataUrl accepts valid JPEG/PNG/WebP base64 and blocks SVG/XSS/oversized payloads', async () => {
  const { sanitizeAvatarDataUrl, sanitizeWorkspacePayload } = await import('./firestoreSanitize');
  const validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD=';
  assert.equal(sanitizeAvatarDataUrl(validJpg), validJpg);
  assert.equal(sanitizeAvatarDataUrl('data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4='), '');
  assert.equal(sanitizeAvatarDataUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeAvatarDataUrl('data:image/jpeg;base64,' + 'A'.repeat(46000)), '');

  const ws = sanitizeWorkspacePayload('u_prof', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'default',
    defaultVille: 'Meknès',
    emailSignature: 'Sig',
    seeded: true,
    displayName: '  Karim Mansouri ',
    avatarDataUrl: validJpg,
    monthlyGoalContracts: 500,
    notifyBadges: true,
    notifySound: false,
    compactUi: true,
  });
  assert.equal(ws.displayName, 'Karim Mansouri');
  assert.equal(ws.avatarDataUrl, validJpg);
  assert.equal(ws.monthlyGoalContracts, 200);
  assert.equal(ws.notifyBadges, true);
  assert.equal(ws.notifySound, false);
  assert.equal(ws.compactUi, true);
});

test('sanitizeAppUserPayload and sanitizeTeamStatPayload preserve grand_compte and team_lead roles', async () => {
  const { sanitizeTeamStatPayload } = await import('./firestoreSanitize');
  const uGc = sanitizeAppUserPayload({
    uid: 'u_gc',
    email: 'gc@orangepro.ma',
    displayName: 'Nadia Grand Compte',
    role: 'grand_compte',
    zone: 'Meknès',
    active: true,
    createdBy: 'admin_1',
  });
  const uLead = sanitizeAppUserPayload({
    uid: 'u_lead',
    email: 'lead@orangepro.ma',
    displayName: 'Karim Chef',
    role: 'team_lead',
    zone: 'Fès',
    active: true,
    createdBy: 'admin_1',
  });
  assert.equal(uGc.role, 'grand_compte');
  assert.equal(uLead.role, 'team_lead');

  const statLead = sanitizeTeamStatPayload({
    uid: 'u_lead',
    displayName: 'Karim Chef',
    role: 'team_lead',
    zone: 'Fès',
    active: true,
    totalProspects: 0,
    totalQualified: 0,
    totalContracts: 0,
    totalPayoutMad: 0,
    xp: 0,
    unlockedCount: 0,
  });
  assert.equal(statLead.role, 'team_lead');
  assert.equal(statLead.totalProspects, 0);
});

test('parseFriendlyCloudError classifies permission-denied, offline, and unauthenticated errors cleanly', async () => {
  const { parseFriendlyCloudError } = await import('./firestoreSanitize');
  const perm = parseFriendlyCloudError(
    new Error(JSON.stringify({ error: 'FirebaseError: Missing or insufficient permissions (permission-denied)', path: 'users/u1' }))
  );
  assert.equal(perm.code, 'permission-denied');
  assert.equal(perm.shortTag, ' (permission-denied)');
  assert.equal(perm.retryable, true);

  const offline = parseFriendlyCloudError(new Error('Failed to get document because the client is offline.'));
  assert.equal(offline.code, 'offline');
  assert.equal(offline.retryable, true);

  const unauth = parseFriendlyCloudError(new Error('unauthenticated'));
  assert.equal(unauth.code, 'unauthenticated');
});

test('sanitizeWorkspacePayload preserves deduplication preferences safely within blueprint bounds', () => {
  const ws = sanitizeWorkspacePayload('u_dedup', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'default',
    defaultVille: 'Meknès',
    emailSignature: 'Sig',
    seeded: true,
    dismissedDedupKeys: ['id1|id2', 'id1|id2', 'id3|id4'],
    includePhoneOnlyDedup: true,
  });
  assert.deepEqual(ws.dismissedDedupKeys, ['id1|id2', 'id3|id4']);
  assert.equal(ws.includePhoneOnlyDedup, true);
});

test('sanitizeUserPresencePayload and sanitizeAttendanceSessionPayload enforce bounds, enums, and PII fields', async () => {
  const { sanitizeUserPresencePayload, sanitizeAttendanceSessionPayload } = await import(
    './firestoreSanitize'
  );
  const presence = sanitizeUserPresencePayload({
    uid: 'u/presence!',
    email: '  Youssef@OrangePro.MA ',
    displayName: 'Youssef Bennani',
    firstName: 'Youssef',
    lastName: 'Bennani',
    phonePro: '0661223344',
    role: 'invalid_role',
    zone: 'Meknès',
    isOnline: true,
    currentDevice: 'Windows · Chrome (PC / Bureau)',
    devicesUsed: Array.from({ length: 16 }, (_, i) => `Device ${i}`),
    todayWorkedSeconds: 120000, // capped to 86400
    totalWorkedSeconds: -50,
    workHoursDisconnectTimes: Array.from({ length: 40 }, (_, i) => `2026-11-25T10:${String(i % 60).padStart(2, '0')}:00Z|Déconnexion`),
  });
  assert.equal(presence.uid, 'u_presence_');
  assert.equal(presence.orgScope, 'orange_pro_team');
  assert.equal(presence.email, 'youssef@orangepro.ma');
  assert.equal(presence.role, 'commercial');
  assert.equal(presence.devicesUsed.length, 12);
  assert.equal(presence.todayWorkedSeconds, 86400);
  assert.equal(presence.totalWorkedSeconds, 0);
  assert.equal(presence.workHoursDisconnectTimes.length, 30);

  const session = sanitizeAttendanceSessionPayload({
    id: 'ses/1',
    ownerId: 'u_1',
    dateKey: '2026-11-25',
    loginAt: '2026-11-25T08:40:00.000Z',
    lastSeenAt: '2026-11-25T10:00:00.000Z',
    workedSeconds: 4800,
    deviceLabel: 'Windows · Chrome (PC / Bureau)',
    deviceType: 'bad_type',
    status: 'disconnected_work_hours',
    disconnectReason: 'Déconnexion manuelle',
    disconnectedDuringWorkHours: true,
  });
  assert.equal(session.id, 'ses_1');
  assert.equal(session.deviceType, 'desktop');
  assert.equal(session.status, 'disconnected_work_hours');
  assert.equal(session.disconnectedDuringWorkHours, true);
});

test('sanitizeFichePayload, sanitizeActivitePayload, and sanitizeCloudNotificationPayload handle attribution, restoration, audit types, and cloud notifications', async () => {
  const { sanitizeActivitePayload, sanitizeCloudNotificationPayload } = await import(
    './firestoreSanitize'
  );

  const fiche = sanitizeFichePayload('collab_2', {
    id: 'f_99',
    societe: 'Clinique Royale',
    secteur: 'clinique',
    ville: 'Rabat',
    telephone: '0537001122',
    email: 'contact@clinique-royale.ma',
    contact: 'Dr. Amine',
    role: 'Directeur',
    source: 'Manuel',
    effectif: '40',
    statut: 'Appel en cours',
    dateAjout: '2026-11-26T09:00:00.000Z',
    assignedByUid: 'sup_1',
    assignedByName: 'Mohamed Admin',
    assignedAt: '2026-11-26T09:30:00.000Z',
    restoredByName: 'Mohamed Admin',
    restoredAt: '2026-11-26T10:00:00.000Z',
    restoredReason: 'Modification de l’offre demandée par le client',
  });
  assert.equal(fiche.assignedByUid, 'sup_1');
  assert.equal(fiche.assignedByName, 'Mohamed Admin');
  assert.equal(fiche.restoredByName, 'Mohamed Admin');
  assert.equal(fiche.restoredReason, 'Modification de l’offre demandée par le client');

  for (const auditType of ['attribution', 'acces', 'modification', 'restitution', 'signature'] as const) {
    const act = sanitizeActivitePayload('collab_2', 'f_99', {
      id: `act_${auditType}`,
      type: auditType,
      resultat: 'autre',
      texte: `Action ${auditType}`,
      auteurNom: 'Mohamed Admin',
      auteurUid: 'sup_1',
      auteurRole: 'super_admin',
      createdAtIso: '2026-11-26T10:05:12.000Z',
    });
    assert.equal(act.type, auditType);
    assert.equal(act.auteurUid, 'sup_1');
    assert.equal(act.auteurRole, 'super_admin');
    assert.equal(act.createdAtIso, '2026-11-26T10:05:12.000Z');
  }

  const notif = sanitizeCloudNotificationPayload({
    id: 'ntf/bad id!',
    recipientUid: 'collab_2',
    senderUid: 'sup_1',
    senderName: 'Mohamed Admin',
    senderRole: 'super_admin',
    kind: 'fiche_assigned',
    title: 'Nouvelle fiche attribuée',
    message: 'Détails de la fiche attribuée',
    ficheId: 'f_99',
    ficheOwnerId: 'collab_2',
    numeroFiche: 'OP-0099',
    societe: 'Clinique Royale',
    targetTab: 'crm',
    read: false,
    createdAtIso: '2026-11-26T10:10:00.000Z',
  });
  assert.equal(notif.id, 'ntf_bad_id_');
  assert.equal(notif.kind, 'fiche_assigned');
  assert.equal(notif.numeroFiche, 'OP-0099');
  assert.equal(notif.targetTab, 'crm');
  assert.equal(notif.read, false);
});

test('sanitizeFicheAuditLogPayload, direct chat, coaching WebRTC, and contract cloud notifications enforce strict schema bounds', async () => {
  const {
    sanitizeFicheAuditLogPayload,
    sanitizeDirectChatChannelPayload,
    sanitizeDirectChatMessagePayload,
    sanitizeCoachingSessionPayload,
    sanitizeCoachingCandidatePayload,
    sanitizeCloudNotificationPayload,
  } = await import('./firestoreSanitize');

  const audit = sanitizeFicheAuditLogPayload('collab_1', 'f_10', {
    id: 'aud/1!',
    ficheId: 'f_10',
    action: 'field_updated',
    field: 'telephone',
    oldValue: '0535000000',
    newValue: '0661112233',
    summary: 'Téléphone mis à jour',
    actorUid: 'sup_1',
    actorName: 'Mohamed Admin',
    actorRole: 'super_admin',
    createdAtIso: '2026-11-26T11:00:00.000Z',
  });
  assert.equal(audit.id, 'aud_1_');
  assert.equal(audit.action, 'field_updated');
  assert.equal(audit.field, 'telephone');
  assert.equal(audit.oldValue, '0535000000');
  assert.equal(audit.newValue, '0661112233');

  const fallbackAudit = sanitizeFicheAuditLogPayload('collab_1', 'f_10', {
    ficheId: 'f_10',
    action: 'invalid_action',
    summary: 'Test fallback',
    actorUid: 'sup_1',
    actorName: 'Admin',
  });
  assert.equal(fallbackAudit.action, 'field_updated');

  const chan = sanitizeDirectChatChannelPayload({
    collabUid: 'collab_1',
    collabName: 'Malak Cheik',
    collabEmail: 'Malak@OrangePro.MA',
    collabZone: 'Meknès',
    lastMessageText: 'Bonjour !',
    lastSenderUid: 'admin_1',
    lastSenderName: 'Admin',
    unreadByAdmin: -3,
    unreadByCollab: 2,
  });
  assert.equal(chan.collabUid, 'collab_1');
  assert.equal(chan.collabEmail, 'malak@orangepro.ma');
  assert.equal(chan.unreadByAdmin, 0);
  assert.equal(chan.unreadByCollab, 2);

  const msg = sanitizeDirectChatMessagePayload({
    id: 'msg_1',
    collabUid: 'collab_1',
    senderUid: 'admin_1',
    senderName: 'Admin',
    senderRole: 'super_admin',
    text: 'Bravo pour le RDV !',
  });
  assert.equal(msg.id, 'msg_1');
  assert.equal(msg.text, 'Bravo pour le RDV !');

  const coaching = sanitizeCoachingSessionPayload({
    collabUid: 'collab_1',
    collabName: 'Malak Cheik',
    status: 'live',
    collabConsentActive: true,
    adminPttActive: true,
    offerSdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1',
  });
  assert.equal(coaching.status, 'live');
  assert.equal(coaching.collabConsentActive, true);
  assert.equal(coaching.adminPttActive, true);

  const cand = sanitizeCoachingCandidatePayload({
    id: 'c1',
    senderUid: 'admin_1',
    fromRole: 'admin',
    candidateJson: '{"candidate":"candidate:1"}',
  });
  assert.equal(cand.fromRole, 'admin');
  assert.equal(cand.senderUid, 'admin_1');

  const contractNotif = sanitizeCloudNotificationPayload({
    recipientUid: 'collab_1',
    senderUid: 'admin_1',
    senderName: 'Admin',
    kind: 'contract_status_changed',
    title: 'Contrat refusé',
    message: 'Dossier incomplet',
    payoutStatus: 'Refusé',
    payoutMad: 1500,
    targetTab: 'team',
  });
  assert.equal(contractNotif.kind, 'contract_status_changed');
  assert.equal(contractNotif.payoutStatus, 'Refusé');
  assert.equal(contractNotif.payoutMad, 1500);
});

test('clampUtf8Bytes keeps user_presence and direct_chats payloads within Firestore UTF-8 byte limits', async () => {
  const {
    sanitizeUserPresencePayload,
    sanitizeDirectChatChannelPayload,
    clampUtf8Bytes,
  } = await import('./firestoreSanitize');
  const byteLen = (s: string) => Buffer.byteLength(s, 'utf8');

  const accentedLong = 'Éàçù€—'.repeat(60) + '🚀'.repeat(20);
  assert.ok(byteLen(clampUtf8Bytes(accentedLong, 160)) <= 160);

  const pres = sanitizeUserPresencePayload({
    uid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    email: 'hardcallmohamed@gmail.com',
    displayName: accentedLong,
    firstName: accentedLong,
    lastName: accentedLong,
    phonePro: '📞'.repeat(20),
    role: 'super_admin',
    zone: accentedLong,
    isOnline: true,
    currentDevice: accentedLong,
    devicesUsed: [accentedLong, 'Android · ' + accentedLong],
    workHoursDisconnectTimes: ['2026-11-26T10:43:00Z|' + accentedLong],
  });
  assert.ok(byteLen(pres.displayName) <= 120);
  assert.ok(byteLen(pres.firstName) <= 60);
  assert.ok(byteLen(pres.lastName) <= 60);
  assert.ok(byteLen(pres.phonePro) <= 30);
  assert.ok(byteLen(pres.zone) <= 100);
  assert.ok(byteLen(pres.currentDevice) <= 160);
  for (const d of pres.devicesUsed) assert.ok(byteLen(d) <= 160);
  for (const t of pres.workHoursDisconnectTimes) assert.ok(byteLen(t) <= 80);

  const chan = sanitizeDirectChatChannelPayload({
    collabUid: 'HFduvO7RQYVw9pLwJu8ndy6w0al1',
    collabName: accentedLong,
    collabEmail: 'collab@orangepro.ma',
    collabZone: accentedLong,
    lastMessageText: accentedLong,
    lastSenderUid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    lastSenderName: accentedLong,
    unreadByAdmin: 0,
    unreadByCollab: 1,
  });
  assert.ok(byteLen(chan.collabName) <= 120);
  assert.ok(byteLen(chan.collabZone || '') <= 100);
  assert.ok(byteLen(chan.lastMessageText) <= 500);
  assert.ok(byteLen(chan.lastSenderName || '') <= 120);
});

test('buildUserPresenceRepairUpdatePayload omits valid createdAt, heals invalid createdAt, and deletes legacy extra keys', async () => {
  const {
    sanitizeUserPresencePayload,
    inspectUserPresenceDocKeys,
    buildUserPresenceRepairUpdatePayload,
  } = await import('./firestoreSanitize');

  const cleanPres = sanitizeUserPresencePayload({
    uid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    email: 'hardcallmohamed@gmail.com',
    displayName: 'HARDCALL CONTACT',
    role: 'super_admin',
    zone: 'Meknès',
    isOnline: true,
    currentDevice: 'Windows · Chrome (PC / Bureau)',
  });

  const legacyWithValidTs: Record<string, unknown> = {
    uid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    email: 'hardcallmohamed@gmail.com',
    displayName: 'HARDCALL',
    legacyGhostField: 'old',
    lastPingAt: 123456,
    createdAt: { toDate: () => new Date() },
  };
  const inspected = inspectUserPresenceDocKeys(legacyWithValidTs);
  assert.ok(inspected.missingDataKeys.includes('workHoursDisconnectTimes'));
  assert.deepEqual(inspected.extraKeys, ['legacyGhostField', 'lastPingAt']);

  const DELETE_SENTINEL = Symbol('deleteField');
  const SERVER_TS_CREATED = Symbol('serverCreatedAt');
  const SERVER_TS_UPDATED = Symbol('serverUpdatedAt');

  const repairValidTs = buildUserPresenceRepairUpdatePayload(legacyWithValidTs, cleanPres, {
    updatedAtSentinel: SERVER_TS_UPDATED,
    createdAtSentinel: SERVER_TS_CREATED,
    deleteFieldSentinel: DELETE_SENTINEL,
    hasValidCreatedAtTimestamp: true,
  });
  assert.equal('createdAt' in repairValidTs, false);
  assert.equal(repairValidTs.updatedAt, SERVER_TS_UPDATED);
  assert.equal(repairValidTs.legacyGhostField, DELETE_SENTINEL);
  assert.equal(repairValidTs.lastPingAt, DELETE_SENTINEL);
  assert.equal(repairValidTs.orgScope, 'orange_pro_team');

  const repairMissingTs = buildUserPresenceRepairUpdatePayload(
    { uid: 'u1', oldField: true },
    cleanPres,
    {
      updatedAtSentinel: SERVER_TS_UPDATED,
      createdAtSentinel: SERVER_TS_CREATED,
      deleteFieldSentinel: DELETE_SENTINEL,
      hasValidCreatedAtTimestamp: false,
    }
  );
  assert.equal(repairMissingTs.createdAt, SERVER_TS_CREATED);
  assert.equal(repairMissingTs.oldField, DELETE_SENTINEL);
});

test('buildTeamStatRepairUpdatePayload detects missing/extra keys and heals legacy team_stats docs', async () => {
  const {
    sanitizeTeamStatPayload,
    inspectTeamStatDocKeys,
    buildTeamStatRepairUpdatePayload,
  } = await import('./firestoreSanitize');

  const cleanStat = sanitizeTeamStatPayload({
    uid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    displayName: 'HARDCALL CONTACT',
    role: 'super_admin',
    zone: 'Meknès',
    active: true,
    totalProspects: 10,
    totalQualified: 4,
    totalContracts: 2,
    totalPayoutMad: 3500,
    xp: 250,
    unlockedCount: 5,
    manualBadges: ['top_closer'],
    monthlyHistory: ['2026-11:2:3500'],
    avatarDataUrl: '',
  });

  const legacyStat: Record<string, unknown> = {
    uid: 'eHlHBvh4asbWuG24W1RAph3SHil1',
    displayName: 'HARDCALL',
    legacyScore: 99,
  };
  const inspected = inspectTeamStatDocKeys(legacyStat);
  assert.ok(inspected.missingDataKeys.includes('orgScope'));
  assert.ok(inspected.missingDataKeys.includes('manualBadges'));
  assert.deepEqual(inspected.extraKeys, ['legacyScore']);

  const DELETE_SENTINEL = Symbol('deleteField');
  const SERVER_TS_CREATED = Symbol('serverCreatedAt');
  const SERVER_TS_UPDATED = Symbol('serverUpdatedAt');

  const repaired = buildTeamStatRepairUpdatePayload(legacyStat, cleanStat, {
    updatedAtSentinel: SERVER_TS_UPDATED,
    createdAtSentinel: SERVER_TS_CREATED,
    deleteFieldSentinel: DELETE_SENTINEL,
    hasValidCreatedAtTimestamp: false,
  });
  assert.equal(repaired.createdAt, SERVER_TS_CREATED);
  assert.equal(repaired.updatedAt, SERVER_TS_UPDATED);
  assert.equal(repaired.legacyScore, DELETE_SENTINEL);
  assert.equal(repaired.orgScope, 'orange_pro_team');
});

test('extractPersistedFicheFields preserves relance, rdv, attribution, and restoration fields across reload and sanitization', async () => {
  const {
    extractPersistedFicheFields,
    formatFicheNumeroWithPrefix,
    formatEmailBodyWithOptionalPhone,
    getFollowUpAlertDelayMs,
    computeCurrentMonthContractsAndPayout,
  } = await import('./accountPreferences');

  const rawDoc: Record<string, unknown> = {
    id: 'op_relance_1',
    societe: 'Cabinet Atlas',
    secteur: 'fiduciaire',
    ville: 'Meknès',
    telephone: '0535521100',
    email: 'contact@atlas.ma',
    contact: 'M. Karim',
    role: 'Gérant',
    source: 'Terrain',
    effectif: '14',
    statut: 'RDV pris',
    dateAjout: '2026-11-26T08:00:00.000Z',
    prochaineRelanceAt: '2026-11-28T10:30:00.000Z',
    rdvAt: '2026-11-29T14:00:00.000Z',
    rdvLieu: 'Siège Meknès Hamria',
    assignedByUid: 'sup_admin_1',
    assignedByName: 'Mohamed Admin',
    assignedAt: '2026-11-26T09:00:00.000Z',
    restoredByName: 'Mohamed Admin',
    restoredAt: '2026-11-26T09:15:00.000Z',
    restoredReason: 'Révision du périmètre Fibre',
  };

  const extra = extractPersistedFicheFields(rawDoc);
  const sanitized = sanitizeFichePayload('collab_1', {
    ...(rawDoc as unknown as Parameters<typeof sanitizeFichePayload>[1]),
    ...extra,
  });
  const roundTrip = extractPersistedFicheFields(sanitized as unknown as Record<string, unknown>);

  assert.equal(roundTrip.prochaineRelanceAt, '2026-11-28T10:30:00.000Z');
  assert.equal(roundTrip.rdvAt, '2026-11-29T14:00:00.000Z');
  assert.equal(roundTrip.rdvLieu, 'Siège Meknès Hamria');
  assert.equal(roundTrip.assignedByUid, 'sup_admin_1');
  assert.equal(roundTrip.assignedByName, 'Mohamed Admin');
  assert.equal(roundTrip.assignedAt, '2026-11-26T09:00:00.000Z');
  assert.equal(roundTrip.restoredByName, 'Mohamed Admin');
  assert.equal(roundTrip.restoredAt, '2026-11-26T09:15:00.000Z');
  assert.equal(roundTrip.restoredReason, 'Révision du périmètre Fibre');

  assert.equal(formatFicheNumeroWithPrefix('OP-0042', 'B2B-'), 'B2B-0042');
  assert.equal(
    formatEmailBodyWithOptionalPhone('Bonjour,\nCordialement.', '0661223344', true).includes(
      '0661223344'
    ),
    true
  );
  assert.equal(getFollowUpAlertDelayMs('24h'), 24 * 60 * 60 * 1000);
  assert.equal(getFollowUpAlertDelayMs('48h'), 48 * 60 * 60 * 1000);

  const monthSummary = computeCurrentMonthContractsAndPayout(
    [
      { signedAt: '2026-11-10T10:00:00.000Z', payoutMad: 1500, payoutStatus: 'Validé' },
      { signedAt: '2026-11-15T10:00:00.000Z', payoutMad: 2000, payoutStatus: 'Versé' },
      { signedAt: '2026-11-20T10:00:00.000Z', payoutMad: 1200, payoutStatus: 'Refusé' },
      { signedAt: '2026-10-20T10:00:00.000Z', payoutMad: 3000, payoutStatus: 'Validé' },
    ],
    new Date('2026-11-26T12:00:00.000Z')
  );
  assert.equal(monthSummary.currentMonthKey, '2026-11');
  assert.equal(monthSummary.currentMonthContractsCount, 2);
  assert.equal(monthSummary.currentMonthPayoutMad, 3500);
});

test('isVaultOrMaskedApiKey detects masked vault keys and sanitizeWorkspacePayload preserves legal mentions', async () => {
  const { isVaultOrMaskedApiKey, parseJsonObjectFromLlmText } = await import('./aiRateLimiter');

  assert.equal(isVaultOrMaskedApiKey('', 'gsk_••••••••9a2f'), true);
  assert.equal(isVaultOrMaskedApiKey('', 'tvly-****1234'), true);
  assert.equal(isVaultOrMaskedApiKey('cloud_vault_gemini', '__CLOUD_VAULT__'), true);
  assert.equal(isVaultOrMaskedApiKey('local_1', 'gsk_live_real_unmasked_token_1234567890'), false);

  const parsed = parseJsonObjectFromLlmText<{ objet: string; corps: string }>(
    'Voici la réponse:\n```json\n{"objet":"Offre Fibre","corps":"Bonjour,\\nProposition Orange Pro."}\n```'
  );
  assert.equal(parsed?.objet, 'Offre Fibre');
  assert.equal(parsed?.corps, 'Bonjour,\nProposition Orange Pro.');

  const ws = sanitizeWorkspacePayload('u_legal', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'default',
    defaultVille: 'Meknès',
    emailSignature: 'Sig',
    seeded: true,
    legalRaisonSociale: 'DIVERSIFIA TELECOM SARL',
    legalIce: '002345678000091',
    legalAdresse: 'Avenue Mohammed V, Meknès',
    legalTelephone: '+212 5 35 52 00 00',
  });
  assert.equal(ws.legalRaisonSociale, 'DIVERSIFIA TELECOM SARL');
  assert.equal(ws.legalIce, '002345678000091');
  assert.equal(ws.legalAdresse, 'Avenue Mohammed V, Meknès');
  assert.equal(ws.legalTelephone, '+212 5 35 52 00 00');
});

test('isDuringWorkHours uses Africa/Casablanca timezone and projectLatLngToMercatorWorld handles negative Moroccan longitudes', async () => {
  const { isDuringWorkHours, projectLatLngToMercatorWorld, computeMercatorMarkerPosition } =
    await import('./attendance');

  // Thursday 2026-11-26 at 10:30 UTC is 11:30 in Africa/Casablanca (UTC+1) -> during work hours
  const thursdayMorning = new Date('2026-11-26T10:30:00.000Z');
  const whStandard = isDuringWorkHours(thursdayMorning, 'standard_maroc');
  assert.equal(whStandard.duringWorkHours, true);

  const whLateNight = isDuringWorkHours(new Date('2026-11-26T22:30:00.000Z'), 'standard_maroc');
  assert.equal(whLateNight.duringWorkHours, false);

  // Meknès negative longitude (-5.5547) must not be clamped to 0
  const meknesPt = projectLatLngToMercatorWorld(33.8935, -5.5547, 15);
  const zeroLngPt = projectLatLngToMercatorWorld(33.8935, 0, 15);
  assert.ok(meknesPt.worldX < zeroLngPt.worldX);

  const markerPos = computeMercatorMarkerPosition({
    lat: 33.8935,
    lng: -5.5547,
    centerLat: 33.8935,
    centerLng: -5.5547,
    zoom: 15,
    viewportWidth: 800,
    viewportHeight: 500,
  });
  assert.equal(markerPos.leftPx, 400);
  assert.equal(markerPos.topPx, 250);
  assert.equal(markerPos.isInsideViewport, true);
});

test('sanitizeSecurityAuditLogPayload, sanitizeOrgSettingsPayload, optOut, and advancedPrefsJson enforce strict schema bounds', async () => {
  const {
    sanitizeSecurityAuditLogPayload,
    sanitizeOrgSettingsPayload,
    sanitizeWorkspacePayload,
    sanitizeFichePayload,
    sanitizeCloudNotificationPayload,
  } = await import('./firestoreSanitize');

  const log = sanitizeSecurityAuditLogPayload({
    id: 'sec/bad id!',
    severity: 'CRITICAL',
    category: 'export_dlp',
    action: 'csv_export_mass',
    summary: 'Export CSV de 85 fiches par Youssef',
    actorUid: 'u/1!',
    actorName: 'Youssef Benali',
    actorRole: 'commercial',
    targetUid: 'target/2',
    targetLabel: 'Portefeuille complet',
    recordCount: 85,
  });
  assert.equal(log.id, 'sec_bad_id_');
  assert.equal(log.orgScope, 'orange_pro_team');
  assert.equal(log.severity, 'critical');
  assert.equal(log.category, 'export_dlp');
  assert.equal(log.actorUid, 'u_1_');
  assert.equal(log.recordCount, 85);

  const fallbackLog = sanitizeSecurityAuditLogPayload({
    severity: 'unknown_sev',
    category: 'unknown_cat',
    action: '',
    summary: '',
    actorUid: 'u1',
    actorName: '',
  });
  assert.equal(fallbackLog.severity, 'info');
  assert.equal(fallbackLog.category, 'session');

  const org = sanitizeOrgSettingsPayload(
    {
      companyName: '  DIVERSIFIA MAROC  ',
      companyIce: '002345678000091',
      defaultPayoutGrandCompteMad: 4200,
      defaultPayoutPmeMad: 2100,
      defaultPayoutTpeMad: 950,
      defaultSlaRottingHours: 48,
      defaultIdleLockMinutes: 15,
      dlpExportAlertThreshold: 40,
      enforceCndpOptOutLock: true,
    },
    'admin_uid_1'
  );
  assert.equal(org.companyName, 'DIVERSIFIA MAROC');
  assert.equal(org.defaultPayoutGrandCompteMad, 4200);
  assert.equal(org.defaultIdleLockMinutes, 15);
  assert.equal(org.updatedBy, 'admin_uid_1');

  const ws = sanitizeWorkspacePayload('u_prefs', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'default',
    defaultVille: 'Meknès',
    emailSignature: 'Sig',
    seeded: true,
    advancedPrefsJson: JSON.stringify({ monthlyGoalPayoutMad: 20000, idleLockMinutes: 15 }),
  });
  assert.ok(ws.advancedPrefsJson && ws.advancedPrefsJson.includes('20000'));

  const wsBadJson = sanitizeWorkspacePayload('u_prefs', {
    villesAll: ['Meknès'],
    villesActive: ['Meknès'],
    modeVille: 'default',
    defaultVille: 'Meknès',
    emailSignature: 'Sig',
    seeded: true,
    advancedPrefsJson: '{not valid json',
  });
  assert.equal(wsBadJson.advancedPrefsJson, undefined);

  const ficheOptOut = sanitizeFichePayload('u1', {
    id: 'f_cndp',
    societe: 'Cabinet CNDP',
    secteur: 'fiduciaire',
    ville: 'Rabat',
    telephone: '0537001122',
    email: 'c@cndp.ma',
    contact: 'Mme Salma',
    role: 'Directrice',
    source: 'Manuel',
    effectif: '10',
    statut: 'À contacter',
    dateAjout: '2026-11-27T10:00:00.000Z',
    optOut: true,
    optOutAt: '2026-11-27T11:00:00.000Z',
    optOutReason: 'Demande explicite Loi 09-08',
  });
  assert.equal(ficheOptOut.optOut, true);
  assert.equal(ficheOptOut.optOutAt, '2026-11-27T11:00:00.000Z');
  assert.equal(ficheOptOut.optOutReason, 'Demande explicite Loi 09-08');

  const dlpNotif = sanitizeCloudNotificationPayload({
    recipientUid: 'admin_1',
    senderUid: 'collab_1',
    senderName: 'Youssef',
    kind: 'security_dlp_alert',
    title: 'Alerte DLP Export Massif',
    message: 'Export de 85 fiches',
    targetTab: 'admin',
  });
  assert.equal(dlpNotif.kind, 'security_dlp_alert');
  assert.equal(dlpNotif.targetTab, 'admin');
});


