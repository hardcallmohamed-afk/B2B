import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFriendlyApiError,
  fetchJsonWithRetry,
  normalizeCommercialBrief,
  normalizePortfolioInsights,
  parseJsonObjectFromLlmText,
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
    'Voici le diagnostic :\n```json\n{"scoreSante": 84, "constatCle": "Bon pipeline"}\n```'
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
