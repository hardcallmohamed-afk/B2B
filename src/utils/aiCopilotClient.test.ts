import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommercialBriefFromTextFallback,
  buildLocalDeterministicBrief,
  buildLocalDeterministicChatReply,
  buildLocalDeterministicInsights,
  buildPortfolioInsightsFromTextFallback,
  extractFriendlyApiError,
  fetchJsonWithRetry,
  isStaticHostingEnvironment,
  normalizeCommercialBrief,
  normalizePortfolioInsights,
  parseJsonObjectFromLlmText,
  type CopilotFicheInput,
} from './aiCopilotClient';

test('extractFriendlyApiError handles HTML proxy/fallback pages without throwing', () => {
  const res = extractFriendlyApiError(
    502,
    '<!doctype html><html><body>Bad Gateway</body></html>',
    null,
    'Erreur serveur'
  );
  assert.equal(res.isHtmlOrNonJson, true);
  assert.match(res.message, /HTTP 502/);
});

test('parseJsonObjectFromLlmText strips markdown fences and extracts valid JSON objects', () => {
  const parsed = parseJsonObjectFromLlmText<{ scoreSante: number }>(
    'Voici le diagnostic :\n```json\n{"scoreSante": 84, "constatCle": "Bon pipeline",}\n```'
  );
  assert.equal(parsed?.scoreSante, 84);
});

test('normalizePortfolioInsights clamps score and extracts target opportunities', () => {
  const insights = normalizePortfolioInsights({
    scoreSante: 145,
    constatCle: 'Pipeline solide à Meknès.',
    alertePipeline: 'Relances devis en retard',
    actionsPrioritaires: ['Appeler OP-0001', 'Relancer devis'],
    opportunitesCibles: [
      { numeroFiche: 'OP-0001', societe: 'Atlas Tech', raison: '25 postes', action: 'RDV Fibre' },
    ],
  });
  assert.ok(insights);
  assert.equal(insights.scoreSante, 100);
  assert.equal(insights.opportunitesCibles.length, 1);
  assert.equal(insights.opportunitesCibles[0].societe, 'Atlas Tech');
});

test('normalizeCommercialBrief validates fallback brief payloads safely', () => {
  const brief = normalizeCommercialBrief({
    priorite: 'Haute',
    resume: 'Compte prêt pour offre Fibre Pro.',
    pitch3Points: ['Continuité SLA', 'Portabilité sans coupure'],
    objectionPrincipale: 'Engagement en cours',
    reponseObjection: 'Audit gratuit avant échéance',
    canalRecommande: 'Téléphone',
    prochaineAction: 'Appeler le gérant demain 10h',
  });
  assert.ok(brief);
  assert.equal(brief.priorite, 'Haute');
  assert.equal(brief.pitch3Points.length, 2);
});

test('fetchJsonWithRetry gracefully handles non-JSON HTML responses and retries transient 503', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response('<html>503 Temporarily Unavailable</html>', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      });
    }
    return new Response(JSON.stringify({ ok: true, reply: 'Bonjour!' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const res = await fetchJsonWithRetry<{ ok: boolean; reply: string }>(
      '/api/ai/chat',
      { method: 'POST', body: '{}' },
      { maxNetworkRetries: 1, timeoutMs: 3000 }
    );
    assert.equal(calls, 2);
    assert.equal(res.ok, true);
    assert.equal(res.data?.reply, 'Bonjour!');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchJsonWithRetry detects GitHub Pages static host and skips /api/ requests immediately', async () => {
  const prevWindow = (globalThis as { window?: unknown }).window;
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response('', { status: 404 });
  }) as typeof fetch;

  (globalThis as { window: { location: { hostname: string; protocol: string } } }).window = {
    location: { hostname: 'hardcallmohamed-afk.github.io', protocol: 'https:' },
  };

  try {
    assert.equal(isStaticHostingEnvironment(), true);
    const res = await fetchJsonWithRetry('/api/ai/chat', { method: 'POST', body: '{}' });
    assert.equal(fetchCalled, false);
    assert.equal(res.ok, false);
    assert.equal(res.isStaticOrHtml, true);
    assert.equal(res.shouldFallback, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});

test('local deterministic Copilote helpers produce real diagnostic, brief, and chat responses', () => {
  const sampleFiches: CopilotFicheInput[] = [
    {
      id: 'f1',
      numeroFiche: 'OP-0001',
      societe: 'Clinique Al Amal',
      secteur: 'clinique',
      secteurLabel: 'Clinique / Santé',
      ville: 'Meknès',
      telephone: '0535521100',
      email: 'direction@alamal.ma',
      contact: 'Dr. Tazi',
      role: 'Directeur',
      effectif: '45',
      statut: 'Devis envoyé',
      statutUpdatedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    },
    {
      id: 'f2',
      numeroFiche: 'OP-0002',
      societe: 'Fiduciaire Atlas',
      secteur: 'fiduciaire',
      secteurLabel: 'Fiduciaire',
      ville: 'El Hajeb',
      telephone: '0661002233',
      email: '',
      contact: 'M. Bennani',
      role: 'Gérant',
      effectif: '8',
      statut: 'À contacter',
      statutUpdatedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    },
  ];

  const insights = buildLocalDeterministicInsights(sampleFiches);
  assert.ok(insights.scoreSante > 0 && insights.scoreSante <= 100);
  assert.ok(insights.opportunitesCibles.length === 2);
  assert.equal(insights.opportunitesCibles[0].numeroFiche, 'OP-0001');
  assert.match(insights.actionsPrioritaires[0], /OP-0001/);

  const brief = buildLocalDeterministicBrief(sampleFiches[0]);
  assert.equal(brief.priorite, 'Haute');
  assert.equal(brief.canalRecommande, 'Téléphone');
  assert.match(brief.prochaineAction, /0535521100/);

  const chatByCode = buildLocalDeterministicChatReply('Quel argumentaire pour OP-0001 ?', sampleFiches);
  assert.match(chatByCode, /Clinique Al Amal/);
  assert.match(chatByCode, /OP-0001/);

  const chatRelance = buildLocalDeterministicChatReply('Relance devis urgente', sampleFiches);
  assert.match(chatRelance, /Clinique Al Amal/);

  const proseInsights = buildPortfolioInsightsFromTextFallback(
    'Pipeline solide avec 1 devis urgent sur Clinique Al Amal.',
    sampleFiches
  );
  assert.match(proseInsights.constatCle, /Clinique Al Amal/);

  const proseBrief = buildCommercialBriefFromTextFallback(
    'Compte santé prioritaire prêt pour Fibre Dédiée SLA.',
    sampleFiches[0]
  );
  assert.match(proseBrief.resume, /Fibre Dédiée SLA/);
});
