import test from 'node:test';
import assert from 'node:assert/strict';
import { detectApiKeyProviderSync } from './apiKeyDetector';

test('detectApiKeyProviderSync detects high-confidence prefixes across major providers', () => {
  const groq = detectApiKeyProviderSync('gsk_1234567890abcdefghijklmnop');
  assert.equal(groq?.provider, 'groq');
  assert.equal(groq?.confidence, 'high');
  assert.equal(groq?.needsServerProbe, false);

  const openrouter = detectApiKeyProviderSync('sk-or-v1-abc123def456ghi789');
  assert.equal(openrouter?.provider, 'openrouter');
  assert.equal(openrouter?.confidence, 'high');

  const gemini = detectApiKeyProviderSync('AIzaSyDummyKeyExample1234567890');
  assert.equal(gemini?.provider, 'gemini');
  assert.equal(gemini?.confidence, 'high');

  const geminiAq = detectApiKeyProviderSync('AQ.Abcdefghijklmno123456');
  assert.equal(geminiAq?.provider, 'gemini');
  assert.equal(geminiAq?.confidence, 'high');

  const tavily = detectApiKeyProviderSync('tvly-dev-1234567890abcdef');
  assert.equal(tavily?.provider, 'tavily');
  assert.equal(tavily?.confidence, 'high');

  const openaiProj = detectApiKeyProviderSync('sk-proj-abc123def456ghi789');
  assert.equal(openaiProj?.provider, 'openai');
  assert.equal(openaiProj?.confidence, 'high');

  const anthropic = detectApiKeyProviderSync('sk-ant-api03-abc123def456');
  assert.equal(anthropic?.provider, 'anthropic');
  assert.equal(anthropic?.confidence, 'high');
});

test('detectApiKeyProviderSync flags ambiguous formats (Mistral 32-char, DeepSeek hex, generic sk-) for live probe', () => {
  const mistralRaw = detectApiKeyProviderSync('AbCdEfGhIjKlMnOpQrStUvWxYz123456');
  assert.equal(mistralRaw?.provider, 'mistral');
  assert.equal(mistralRaw?.confidence, 'medium');
  assert.equal(mistralRaw?.needsServerProbe, true);

  const deepseekHex = detectApiKeyProviderSync('sk-0123456789abcdef0123456789abcdef');
  assert.equal(deepseekHex?.provider, 'deepseek');
  assert.equal(deepseekHex?.confidence, 'medium');
  assert.equal(deepseekHex?.needsServerProbe, true);

  const genericSk = detectApiKeyProviderSync('sk-liveGenericOpenAIKeyFormat12345');
  assert.equal(genericSk?.provider, 'openai');
  assert.equal(genericSk?.confidence, 'medium');
  assert.equal(genericSk?.needsServerProbe, true);

  assert.equal(detectApiKeyProviderSync('short'), null);
});
