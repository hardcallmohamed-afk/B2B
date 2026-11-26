import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CollaboratorChatWidget,
  SupervisorAudioControlsContainer,
  SupervisorCoachingHeaderStopButton,
  SupervisorCoachingPttPill,
} from './components/CollaboratorChatWidget';
import { NotificationBell } from './components/NotificationBell';
import { AchievementToast } from './components/AchievementToast';
import { filterNotificationsForRole, type AppNotification } from './utils/notifications';
import {
  normalizeMoroccanPhone,
  normalizeProEmail,
  inferSecteur,
  isValidCompanyName,
  cleanExtractedCompanyName,
  htmlToReadableText,
  extractRelevantWindows,
  extractPhonesFromReadableText,
  extractDecideurFromText,
  extractEffectifFromText,
  getOrangeProRecommendation,
  computeMaturityScore,
  findDuplicateGroups,
  mergeFicheGroup,
  buildStrictCsv,
  expandPaginationUrls,
  getOrderedKeysForTask,
  getAnyAvailableLlmKeys,
  mergeHubAndCloudKeys,
  generatePersonalizedEmail,
  createInitialPortfolio,
  DEFAULT_EMAIL_SKILLS,
  type ApiKeyEntry,
  type FicheEntreprise,
} from './App';

test('normalizeMoroccanPhone converts all Moroccan formats strictly to 05/06/07XXXXXXXX', () => {
  assert.equal(normalizeMoroccanPhone('+212 5 35 52 18 40'), '0535521840');
  assert.equal(normalizeMoroccanPhone('00212 6 61 48 29 10'), '0661482910');
  assert.equal(normalizeMoroccanPhone('+212 (0)5 35 52 18 40'), '0535521840');
  assert.equal(normalizeMoroccanPhone('00212 (0)6 61 48 29 10'), '0661482910');
  assert.equal(normalizeMoroccanPhone('07-00-11-22-33'), '0700112233');
  assert.equal(normalizeMoroccanPhone('12345'), '');
});

test('normalizeProEmail lowercases valid emails and rejects technical/directory domains', () => {
  assert.equal(normalizeProEmail('Contact@Fiduciaire-Meknes.MA'), 'contact@fiduciaire-meknes.ma');
  assert.equal(normalizeProEmail('noreply@entreprise.ma'), '');
  assert.equal(normalizeProEmail('no-reply@entreprise.ma'), '');
  assert.equal(normalizeProEmail('postmaster@entreprise.ma'), '');
  assert.equal(normalizeProEmail('webmaster@entreprise.ma'), '');
  assert.equal(normalizeProEmail('privacy@entreprise.ma'), '');
  assert.equal(normalizeProEmail('info@telecontact.ma'), '');
  assert.equal(normalizeProEmail('contact@kerix.net'), '');
  assert.equal(normalizeProEmail('team@pagesjaunes.ma'), '');
  assert.equal(normalizeProEmail('bot@sentry.io'), '');
  assert.equal(normalizeProEmail('test@wixpress.com'), '');
});

test('inferSecteur blocks substring false positives and enforces Moroccan business priorities', () => {
  // No false positives by substring
  assert.notEqual(inferSecteur('Société Information Systèmes', 'pme'), 'enseignement');
  assert.equal(inferSecteur('Centrale Béton Atlas', 'pme'), 'btp'); // never 'liberal' (bet)
  assert.notEqual(inferSecteur('Nouvelle Adresse Pro', 'pme'), 'liberal'); // never 'dr'
  assert.notEqual(inferSecteur('Standard Services Plus', 'pme'), 'riad_hotellerie'); // never 'dar'

  // Moroccan priorities
  assert.equal(inferSecteur('Auto-École Al Mansour École de conduite', 'pme'), 'auto_ecole');
  assert.equal(inferSecteur('Fiduciaire Consulting & Conseil Fiscal', 'pme'), 'fiduciaire');
  assert.equal(inferSecteur('Clinique Privée Dr Tazi', 'pme'), 'clinique');
});

test('company name cleaner and validator reject UI noise and keep valid companies', () => {
  assert.equal(cleanExtractedCompanyName('**Fiduciaire Atlas** - Telecontact'), 'Fiduciaire Atlas');
  assert.equal(isValidCompanyName('Fiduciaire Atlas'), true);
  assert.equal(isValidCompanyName('Voir le numéro'), false);
  assert.equal(isValidCompanyName('Meknès'), false);
  assert.equal(isValidCompanyName('Rue Mohammed V'), false);
});

test('htmlToReadableText preserves tel/mailto and decodes obfuscated emails', () => {
  const html = '<div class="card"><a href="tel:+212535521840">Appeler</a><a href="mailto:dg@atlas.ma">Mail</a> info&#64;atlas.ma</div>';
  const text = htmlToReadableText(html);
  assert.ok(text.includes('+212535521840'));
  assert.ok(text.includes('dg@atlas.ma'));
  assert.ok(text.includes('info@atlas.ma'));
  assert.deepEqual(extractPhonesFromReadableText(text), ['0535521840']);
});

test('extractRelevantWindows isolates target company snippet', () => {
  const noiseBefore = 'Autre Entreprise 0535111111 '.repeat(40);
  const target = 'Fiduciaire Ismailia Expertise Meknès 0535521840';
  const noiseAfter = 'Autre Société 0535999999 '.repeat(40);
  const win = extractRelevantWindows(`${noiseBefore}\n${target}\n${noiseAfter}`, 'Fiduciaire Ismailia Expertise');
  assert.ok(win.includes('0535521840'));
  assert.ok(!win.includes('0535999999') || win.length < (noiseBefore.length + noiseAfter.length));
});

test('extractDecideurFromText supports forward, inverted LinkedIn, and nominative email fallback', () => {
  assert.deepEqual(extractDecideurFromText('Gérant : Karim Benali'), { contact: 'Karim Benali', role: 'Gérant' });
  assert.deepEqual(extractDecideurFromText('Salma Idrissi - Directrice Générale'), {
    contact: 'Salma Idrissi',
    role: 'Directrice Générale',
  });
  assert.deepEqual(extractDecideurFromText('', 'ahmed.benali@entreprise.ma'), {
    contact: 'Ahmed Benali',
    role: 'Contact identifié',
  });
  assert.equal(extractEffectifFromText('Entreprise comptant 42 salariés à Meknès'), '42');
});

test('Orange Pro offer recommendation and maturity score compute accurately', () => {
  const seed = createInitialPortfolio();
  const clinique = seed.find((f) => f.id === 'mk-2')!;
  const pme = seed.find((f) => f.id === 'mk-1')!;
  const tpe = seed.find((f) => f.id === 'mk-6')!;

  assert.equal(getOrangeProRecommendation(clinique).tier, 'Grand Compte');
  assert.equal(getOrangeProRecommendation(pme).tier, 'PME');
  assert.equal(getOrangeProRecommendation(tpe).tier, 'TPE / Libéral');
  assert.equal(computeMaturityScore(clinique), 100);
});

test('MDM Entity Resolution detects duplicates and merges keeping max effectif and concatenated sources', () => {
  const seed = createInitialPortfolio();
  const groups = findDuplicateGroups(seed);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].fiches.length, 2);

  const merged = mergeFicheGroup(groups[0].fiches);
  assert.equal(merged.effectif, '16');
  assert.ok(merged.source.includes('Pages Jaunes'));
  assert.ok(merged.source.includes('LinkedIn'));
  assert.equal(merged.email, 'contact@fiduciaire-ismailia.ma');
});

test('mergeFicheGroup honors preferredPrimaryId and preserves Signé Orange Pro status', () => {
  const seed = createInitialPortfolio();
  const groups = findDuplicateGroups(seed);
  const group = groups[0].fiches;
  assert.equal(group.length, 2);
  const primary = group[0];
  const secondary = group[1];

  const chosenMerge = mergeFicheGroup(group, secondary.id);
  assert.equal(chosenMerge.id, secondary.id);
  assert.equal(chosenMerge.societe, secondary.societe);
  assert.equal(chosenMerge.effectif, '16');

  const withSigned = group.map((f) =>
    f.id === secondary.id ? { ...f, statut: 'Signé Orange Pro' as const } : f
  );
  const signedMerge = mergeFicheGroup(withSigned, primary.id);
  assert.equal(signedMerge.id, secondary.id);
  assert.equal(signedMerge.statut, 'Signé Orange Pro');
});

test('buildStrictCsv produces UTF-8 BOM, semicolon delimiter, and exact 9 columns', () => {
  const sample: FicheEntreprise[] = [createInitialPortfolio()[0]];
  const csv = buildStrictCsv(sample);
  assert.ok(csv.startsWith('\uFEFFsociete;secteur;ville;telephone;email;contact;role;source;effectif\n'));
  const dataCols = csv.split('\n')[1].split(';');
  assert.equal(dataCols.length, 9);
  assert.equal(dataCols[0], 'Fiduciaire Ismailia Expertise');
});

test('expandPaginationUrls handles range and intermediate page generation', () => {
  const urls = expandPaginationUrls(['https://example.ma/list?page=5'], 'range', 2, 4);
  assert.deepEqual(urls, [
    'https://example.ma/list?page=2',
    'https://example.ma/list?page=3',
    'https://example.ma/list?page=4',
  ]);
});

test('getOrderedKeysForTask routes by priority, optimal task tie-break, and skips quota/disabled keys', () => {
  const keys: ApiKeyEntry[] = [
    { id: '1', provider: 'gemini', label: 'Gem 1', apiKey: 'AIza1', model: 'auto-flash', taskScope: 'all', priority: 1, enabled: true, status: 'idle' },
    { id: '2', provider: 'tavily', label: 'Tav 1', apiKey: 'tvly-1', model: 'basic', taskScope: 'search', priority: 1, enabled: true, status: 'idle' },
    { id: '3', provider: 'groq', label: 'Groq 1', apiKey: 'gsk_1', model: 'llama-3.3-70b-versatile', taskScope: 'all', priority: 1, enabled: true, status: 'idle' },
    { id: '4', provider: 'mistral', label: 'Mistral 1', apiKey: 'mis_1', model: 'mistral-small-latest', taskScope: 'all', priority: 1, enabled: true, status: 'idle' },
    { id: '5', provider: 'openrouter', label: 'OR 1', apiKey: 'sk-or-1', model: 'openrouter/free', taskScope: 'all', priority: 1, enabled: true, status: 'idle' },
    { id: '6', provider: 'tavily', label: 'Tav Quota', apiKey: 'tvly-2', model: 'basic', taskScope: 'search', priority: 1, enabled: true, status: 'quota' },
    { id: '7', provider: 'mistral', label: 'Mistral Off', apiKey: 'mis_2', model: 'mistral-small-latest', taskScope: 'email', priority: 1, enabled: false, status: 'idle' },
  ];

  // Search tie-break: tavily -> gemini (skips quota key #6)
  assert.deepEqual(
    getOrderedKeysForTask(keys, 'search').map((k) => k.id),
    ['2', '1']
  );

  // Extract tie-break: groq -> openrouter -> mistral -> gemini
  assert.deepEqual(
    getOrderedKeysForTask(keys, 'extract').map((k) => k.id),
    ['3', '5', '4', '1']
  );

  // Email tie-break: mistral -> openrouter -> gemini -> groq (skips disabled #7)
  assert.deepEqual(
    getOrderedKeysForTask(keys, 'email').map((k) => k.id),
    ['4', '5', '1', '3']
  );
});

test('generatePersonalizedEmail injects company data, offer, and selected skill', () => {
  const fiche = createInitialPortfolio()[1]; // Clinique Privée Atlas Meknès
  const email = generatePersonalizedEmail(fiche, 'fin_contrat', 'executif', 'Cordialement,\nEquipe Pro', DEFAULT_EMAIL_SKILLS[2]);
  assert.ok(email.objet.includes('Clinique Privée Atlas Meknès'));
  assert.ok(email.corps.includes('Dr Mohamed Tazi'));
  assert.ok(email.corps.includes('Fibre Dédiée'));
});

test('getAnyAvailableLlmKeys and mergeHubAndCloudKeys let any available AI handle any task', () => {
  const localKeys: ApiKeyEntry[] = [
    { id: '1', provider: 'tavily', label: 'Tav', apiKey: 'tvly-1', model: 'basic', taskScope: 'search', priority: 1, enabled: true, status: 'idle' },
    { id: '2', provider: 'groq', label: 'Groq Extract Only', apiKey: 'gsk_1', model: 'llama-3.3-70b-versatile', taskScope: 'extract', priority: 1, enabled: true, status: 'idle' },
    { id: '3', provider: 'openai', label: 'OpenAI Quota', apiKey: 'sk-proj-1', model: 'gpt-4o-mini', taskScope: 'all', priority: 2, enabled: true, status: 'quota' },
  ];

  const merged = mergeHubAndCloudKeys(localKeys, [
    { provider: 'mistral', label: 'Mistral Cloud', key: 'mis_cloud_1', active: true, updatedBy: 'admin-1' },
    { provider: 'groq', label: 'Groq Dup', key: 'gsk_1', active: true, updatedBy: 'admin-1' }, // duplicate secret ignored
    { provider: 'anthropic', label: 'Anthropic', key: 'sk-ant-1', active: true, updatedBy: 'admin-1' },
    { provider: 'deepseek', label: 'DeepSeek Off', key: 'sk-ds-1', active: false, updatedBy: 'admin-1' },
  ]);

  const emailOrder = getAnyAvailableLlmKeys(merged, 'email').map((k) => k.id);
  // First: cloud_vault_mistral (P100); next: groq ('extract'-scoped non-quota) or anthropic (P101); last: openai (quota retry)
  assert.deepEqual(emailOrder, ['cloud_vault_mistral', 'cloud_vault_anthropic', '2', '3']);
});

test('CollaboratorChatWidget and audio supervision subcomponents return null in DOM for non-supervisors', () => {
  for (const role of ['commercial', 'grand_compte', 'team_lead', 'unknown']) {
    const widgetHtml = renderToStaticMarkup(
      React.createElement(CollaboratorChatWidget, {
        currentUserUid: 'collab_1',
        currentUserName: 'Youssef Benali',
        currentUserEmail: 'youssef@orangepro.ma',
        currentUserRole: role,
        currentUserZone: 'Meknès',
        initialOpen: true,
        onNotify: () => {},
      })
    );
    assert.ok(widgetHtml.includes('Discussion Direction'), `Chat drawer should render for ${role}`);
    assert.equal(widgetHtml.includes('Audio Direction'), false, `Audio Direction must not be in DOM for ${role}`);
    assert.equal(widgetHtml.includes('Autoriser micro'), false, `Autoriser micro must not be in DOM for ${role}`);
    assert.equal(widgetHtml.includes('supervisor-audio-controls-container'), false);
    assert.equal(widgetHtml.includes('coaching-ptt-live-pill'), false);
    assert.equal(widgetHtml.includes('<audio'), false, `No <audio> element in DOM for ${role}`);

    assert.equal(
      renderToStaticMarkup(
        React.createElement(SupervisorAudioControlsContainer, {
          currentUserRole: role,
          isListeningOrActive: false,
          coachingBusy: false,
          coachingError: 'Err',
          onStart: () => {},
        })
      ),
      ''
    );
    assert.equal(
      renderToStaticMarkup(
        React.createElement(SupervisorCoachingPttPill, {
          currentUserRole: role,
          coachingActive: true,
          adminPttActive: true,
        })
      ),
      ''
    );
    assert.equal(
      renderToStaticMarkup(
        React.createElement(SupervisorCoachingHeaderStopButton, {
          currentUserRole: role,
          coachingActive: true,
          onStop: () => {},
        })
      ),
      ''
    );
  }

  for (const supervisorRole of ['manager', 'super_admin', 'admin', 'superviseur']) {
    const supervisorWidgetHtml = renderToStaticMarkup(
      React.createElement(CollaboratorChatWidget, {
        currentUserUid: 'sup_1',
        currentUserName: 'Superviseur Meknès',
        currentUserEmail: 'sup@orangepro.ma',
        currentUserRole: supervisorRole,
        currentUserZone: 'Meknès',
        initialOpen: true,
        onNotify: () => {},
      })
    );
    assert.ok(supervisorWidgetHtml.includes('supervisor-audio-controls-container'));
    assert.ok(supervisorWidgetHtml.includes('Audio Direction'));
    assert.ok(
      renderToStaticMarkup(
        React.createElement(SupervisorCoachingPttPill, {
          currentUserRole: supervisorRole,
          coachingActive: true,
          adminPttActive: true,
        })
      ).includes('coaching-ptt-live-pill')
    );
  }
});

test('NotificationBell and AchievementToast hide coaching_invite and supervision labels from non-supervisors', () => {
  const coachingNotif: AppNotification = {
    id: 'cloud_ntf_coach_1',
    kind: 'coaching_invite',
    badgeId: 'coaching_invite',
    title: 'Invitation Coaching Terrain',
    message: 'Activez votre audio supervision.',
    rarity: 'legendaire',
    xpBoost: 0,
    createdAt: '2026-11-26T10:00:00.000Z',
    read: false,
    targetTab: 'crm',
  };
  const directMsgNotif: AppNotification = {
    id: 'cloud_ntf_msg_1',
    kind: 'direct_message',
    badgeId: 'direct_message',
    title: 'Nouveau message Direction',
    message: 'Bonjour, point sur le RDV de 14h.',
    rarity: 'rare',
    xpBoost: 0,
    createdAt: '2026-11-26T10:05:00.000Z',
    read: false,
    targetTab: 'crm',
  };

  assert.equal(filterNotificationsForRole([coachingNotif, directMsgNotif], 'commercial').length, 1);
  assert.equal(filterNotificationsForRole([coachingNotif, directMsgNotif], 'manager').length, 2);

  // Non-supervisor NotificationBell unread count excludes coaching_invite
  const bellCollabHtml = renderToStaticMarkup(
    React.createElement(NotificationBell, {
      notifications: [coachingNotif, directMsgNotif],
      currentUserRole: 'commercial',
      onMarkAllRead: () => {},
      onOpenBadges: () => {},
    })
  );
  assert.ok(bellCollabHtml.includes('Notifications (1 non lues)'));

  // Non-supervisor AchievementToast returns null on coaching_invite and avoids "Coaching" copy on direct_message
  assert.equal(
    renderToStaticMarkup(
      React.createElement(AchievementToast, {
        notification: coachingNotif,
        currentUserRole: 'commercial',
        onDismiss: () => {},
        onOpenBadges: () => {},
      })
    ),
    ''
  );
  const toastDirectCollabHtml = renderToStaticMarkup(
    React.createElement(AchievementToast, {
      notification: directMsgNotif,
      currentUserRole: 'commercial',
      onDismiss: () => {},
      onOpenBadges: () => {},
    })
  );
  assert.equal(toastDirectCollabHtml.includes('Coaching'), false);
  assert.ok(toastDirectCollabHtml.includes('Ouvrir la discussion'));

  // Supervisor sees coaching toast normally
  assert.ok(
    renderToStaticMarkup(
      React.createElement(AchievementToast, {
        notification: coachingNotif,
        currentUserRole: 'manager',
        onDismiss: () => {},
        onOpenBadges: () => {},
      })
    ).includes('Coaching Terrain Live')
  );
});

