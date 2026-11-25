export type DetectedApiProviderId =
  | 'groq'
  | 'openrouter'
  | 'gemini'
  | 'tavily'
  | 'openai'
  | 'deepseek'
  | 'mistral'
  | 'anthropic';

export interface ApiKeyDetectionResult {
  provider: DetectedApiProviderId;
  label: string;
  confidence: 'high' | 'medium';
  reason: string;
  needsServerProbe: boolean;
}

export const PROVIDER_DISPLAY_LABELS: Record<DetectedApiProviderId, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
  tavily: 'Tavily Search',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  mistral: 'Mistral AI',
  anthropic: 'Anthropic Claude',
};

/**
 * Détecte automatiquement le distributeur d'une clé API à partir de son préfixe ou de sa structure.
 * Pour les formats ambigus (ex: `sk-...` ou 32 caractères alphanumériques Mistral),
 * `needsServerProbe` vaut `true` afin de vérifier en direct sur les endpoints officiels.
 */
export function detectApiKeyProviderSync(rawKey: string): ApiKeyDetectionResult | null {
  const key = String(rawKey || '').trim();
  if (key.length < 6) return null;

  if (/^gsk_[A-Za-z0-9_-]{8,}$/.test(key)) {
    return {
      provider: 'groq',
      label: PROVIDER_DISPLAY_LABELS.groq,
      confidence: 'high',
      reason: 'Préfixe gsk_ détecté',
      needsServerProbe: false,
    };
  }

  if (/^sk-or-(?:v1-)?[A-Za-z0-9_-]{8,}$/i.test(key)) {
    return {
      provider: 'openrouter',
      label: PROVIDER_DISPLAY_LABELS.openrouter,
      confidence: 'high',
      reason: 'Préfixe sk-or- détecté',
      needsServerProbe: false,
    };
  }

  if (/^sk-ant-[A-Za-z0-9_-]{8,}$/i.test(key)) {
    return {
      provider: 'anthropic',
      label: PROVIDER_DISPLAY_LABELS.anthropic,
      confidence: 'high',
      reason: 'Préfixe sk-ant- détecté',
      needsServerProbe: false,
    };
  }

  if (/^tvly-[A-Za-z0-9_-]{8,}$/i.test(key)) {
    return {
      provider: 'tavily',
      label: PROVIDER_DISPLAY_LABELS.tavily,
      confidence: 'high',
      reason: 'Préfixe tvly- détecté',
      needsServerProbe: false,
    };
  }

  if (/^AIza[A-Za-z0-9_-]{12,}$/.test(key) || /^AQ\.[A-Za-z0-9._-]{12,}$/.test(key)) {
    return {
      provider: 'gemini',
      label: PROVIDER_DISPLAY_LABELS.gemini,
      confidence: 'high',
      reason: 'Format clé Google Gemini détecté',
      needsServerProbe: false,
    };
  }

  if (/^sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{10,}$/.test(key)) {
    return {
      provider: 'openai',
      label: PROVIDER_DISPLAY_LABELS.openai,
      confidence: 'high',
      reason: 'Préfixe OpenAI détecté',
      needsServerProbe: false,
    };
  }

  if (/^mis_[A-Za-z0-9_-]{8,}$/i.test(key)) {
    return {
      provider: 'mistral',
      label: PROVIDER_DISPLAY_LABELS.mistral,
      confidence: 'high',
      reason: 'Préfixe mis_ détecté',
      needsServerProbe: false,
    };
  }

  if (/^sk-[a-f0-9]{24,}$/.test(key)) {
    return {
      provider: 'deepseek',
      label: PROVIDER_DISPLAY_LABELS.deepseek,
      confidence: 'medium',
      reason: 'Format hexadécimal DeepSeek (vérification auto à l’enregistrement)',
      needsServerProbe: true,
    };
  }

  if (/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) {
    return {
      provider: 'openai',
      label: 'OpenAI / DeepSeek',
      confidence: 'medium',
      reason: 'Préfixe sk- détecté (vérification auto du distributeur)',
      needsServerProbe: true,
    };
  }

  if (/^[A-Za-z0-9]{32}$/.test(key)) {
    return {
      provider: 'mistral',
      label: PROVIDER_DISPLAY_LABELS.mistral,
      confidence: 'medium',
      reason: 'Format 32 caractères (Mistral AI) — vérification auto à l’enregistrement',
      needsServerProbe: true,
    };
  }

  return null;
}

export async function probeApiKeyProviderViaServer(
  rawKey: string,
  allowedProviders?: readonly DetectedApiProviderId[]
): Promise<{
  provider: DetectedApiProviderId | null;
  label: string;
  verified: boolean;
}> {
  const key = String(rawKey || '').trim();
  const syncGuess = detectApiKeyProviderSync(key);
  if (key.length < 8) {
    return { provider: null, label: '', verified: false };
  }

  try {
    const res = await fetch('/api/ai/detect-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: key,
        allowedProviders: allowedProviders ? Array.from(allowedProviders) : undefined,
      }),
      signal: AbortSignal.timeout(7500),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        detectedProvider?: string;
        label?: string;
        verified?: boolean;
      } | null;
      const detected = data?.detectedProvider as DetectedApiProviderId | undefined;
      if (
        detected &&
        detected in PROVIDER_DISPLAY_LABELS &&
        (!allowedProviders || allowedProviders.includes(detected))
      ) {
        return {
          provider: detected,
          label: data?.label || PROVIDER_DISPLAY_LABELS[detected],
          verified: Boolean(data?.verified),
        };
      }
    }
  } catch {
    // Repli silencieux sur la détection locale par motif
  }

  if (syncGuess && (!allowedProviders || allowedProviders.includes(syncGuess.provider))) {
    return {
      provider: syncGuess.provider,
      label: PROVIDER_DISPLAY_LABELS[syncGuess.provider],
      verified: false,
    };
  }
  return { provider: null, label: '', verified: false };
}
