import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Mail,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Target,
  Activity,
} from 'lucide-react';
import {
  SECTEURS_META,
  computeMaturityScore,
  getOrangeProRecommendation,
  type FicheEntreprise,
  type StatutCRM,
} from '../App';
import { buildPortfolioAiSummary } from '../utils/analytics';
import {
  buildCommercialBriefFromTextFallback,
  buildFallbackBriefPrompt,
  buildFallbackChatPrompt,
  buildFallbackInsightsPrompt,
  buildLocalDeterministicBrief,
  buildLocalDeterministicChatReply,
  buildLocalDeterministicInsights,
  buildPortfolioInsightsFromTextFallback,
  fetchJsonWithRetry,
  isStaticHostingEnvironment,
  type CommercialBrief,
  type CopilotFicheInput,
  type PortfolioInsights,
} from '../utils/aiCopilotClient';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isLocalFallback?: boolean;
}

interface AiCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  fiches: FicheEntreprise[];
  focusedFiche: FicheEntreprise | null;
  onClearFocusedFiche: () => void;
  aiAvailable: boolean;
  aiModel: string;
  hasConfiguredFallbackKeys?: boolean;
  onOpenApiHub?: () => void;
  onOpenEmailStudio: (fiche: FicheEntreprise) => void;
  onMoveFiche: (ficheId: string, statut: StatutCRM) => void;
  onSelectFicheForBrief?: (fiche: FicheEntreprise) => void;
  onFallbackLlmPrompt?: (
    prompt: string,
    systemInstruction?: string
  ) => Promise<{ ok: boolean; text: string; sourceLabel?: string; error?: string }>;
  onRefreshAiStatus?: () => void;
}

const QUICK_PROMPTS = [
  {
    label: 'Priorités du jour',
    prompt:
      'Analyse mon portefeuille actuel et donne-moi le top 3 des comptes à appeler en priorité aujourd’hui avec le motif précis et leur code OP-XXXX.',
  },
  {
    label: 'Plan Fibre & Flotte',
    prompt:
      'Quels comptes Grand Compte ou PME de mon portefeuille ont le plus fort potentiel Fibre Dédiée + Flotte Mobile Corporate ? Propose un angle d’attaque.',
  },
  {
    label: 'Relance Devis',
    prompt:
      'Prépare un plan de relance concret pour les comptes actuellement en "RDV pris" ou "Devis envoyé" afin d’accélérer la signature Orange Pro.',
  },
  {
    label: 'Script appel à froid',
    prompt:
      'Rédige un script d’appel à froid de 30 secondes adapté aux décideurs B2B de Meknès & Région pour obtenir un rendez-vous d’audit télécom sans coupure.',
  },
];

function toCopilotFicheInput(f: FicheEntreprise): CopilotFicheInput {
  return {
    id: f.id,
    numeroFiche: f.numeroFiche,
    societe: f.societe,
    secteur: f.secteur,
    secteurLabel: SECTEURS_META[f.secteur]?.label || f.secteur,
    ville: f.ville,
    telephone: f.telephone,
    telephonesSupplementaires: f.telephonesSupplementaires,
    email: f.email,
    emailsSupplementaires: f.emailsSupplementaires,
    contact: f.contact,
    role: f.role,
    effectif: f.effectif,
    statut: f.statut,
    dateAjout: f.dateAjout,
    statutUpdatedAt: f.statutUpdatedAt,
  };
}

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  open,
  onClose,
  fiches,
  focusedFiche,
  onClearFocusedFiche,
  aiAvailable,
  aiModel,
  hasConfiguredFallbackKeys = false,
  onOpenApiHub,
  onOpenEmailStudio,
  onMoveFiche,
  onSelectFicheForBrief,
  onFallbackLlmPrompt,
  onRefreshAiStatus,
}) => {
  const [mode, setMode] = useState<'chat' | 'brief' | 'diagnostic'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour ! Je suis votre Copilote Commercial Orange Pro connecté à votre portefeuille en temps réel. Demandez-moi vos priorités d’appels, lancez un Diagnostic IA global ou ouvrez un Brief IA sur n’importe quelle fiche.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const [lastChatQuery, setLastChatQuery] = useState('');
  const [activeProviderHint, setActiveProviderHint] = useState('');

  const [brief, setBrief] = useState<CommercialBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefNotice, setBriefNotice] = useState('');
  const lastBriefFicheId = useRef<string | null>(null);

  const [insights, setInsights] = useState<PortfolioInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsNotice, setInsightsNotice] = useState('');

  const serverSideBlockedUntilRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const canTryServerAi = () => {
    if (!aiAvailable) return false;
    if (isStaticHostingEnvironment()) return false;
    if (Date.now() < serverSideBlockedUntilRef.current) return false;
    return true;
  };

  const markServerAiUnavailable = (status: number, isStaticOrHtml: boolean) => {
    if (isStaticOrHtml || status === 404 || status === 429 || status === 503 || status === 0) {
      serverSideBlockedUntilRef.current = Date.now() + 90_000;
    }
  };

  useEffect(() => {
    if (open) {
      onRefreshAiStatus?.();
    }
  }, [open, onRefreshAiStatus]);

  useEffect(() => {
    if (open && focusedFiche) {
      setMode('brief');
      if (lastBriefFicheId.current !== focusedFiche.id) {
        void loadBriefForFiche(focusedFiche);
      }
    }
  }, [open, focusedFiche]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const buildLocalFallbackNotice = (reason?: string): string => {
    const cleanReason = (reason || '').trim();
    const isGenericNoKey =
      !cleanReason ||
      /aucune clé ia/i.test(cleanReason) ||
      /hébergement statique/i.test(cleanReason);
    if (isGenericNoKey) {
      return 'Analyse calculée localement sur votre portefeuille CRM (aucune clé IA externe active ou quota Gemini intégré atteint). Ajoutez n’importe quelle clé IA (Groq, Mistral, OpenRouter, OpenAI, DeepSeek, Claude, Gemini) dans le Hub API pour activer l’IA générative.';
    }
    return `Analyse calculée localement sur votre portefeuille CRM (${cleanReason}). Vous pouvez ajouter une autre clé dans le Hub API (détection automatique du distributeur).`;
  };

  const loadBriefForFiche = async (fiche: FicheEntreprise, forceServerRetry = false) => {
    if (forceServerRetry) {
      serverSideBlockedUntilRef.current = 0;
    }
    lastBriefFicheId.current = fiche.id;
    setBrief(null);
    setBriefNotice('');
    setBriefLoading(true);
    try {
      const reco = getOrangeProRecommendation(fiche);
      const ficheInput = toCopilotFicheInput(fiche);
      const briefPayload = {
        societe: fiche.societe,
        secteur: SECTEURS_META[fiche.secteur].label,
        ville: fiche.ville,
        effectif: fiche.effectif,
        statut: fiche.statut,
        contact: fiche.contact,
        role: fiche.role,
        tier: reco.tier,
        offre: reco.offre,
        maturite: computeMaturityScore(fiche),
      };

      const runExternalFallback = async () => {
        if (!onFallbackLlmPrompt) return null;
        return onFallbackLlmPrompt(
          buildFallbackBriefPrompt(briefPayload),
          'Tu es Directeur Commercial B2B Orange Pro Maroc. Retourne uniquement un objet JSON valide.'
        );
      };

      let lastErr = '';
      const preferExternalFirst = !canTryServerAi() || hasConfiguredFallbackKeys;

      if (preferExternalFirst) {
        const fb = await runExternalFallback();
        if (fb?.ok && fb.text.trim()) {
          setBrief(buildCommercialBriefFromTextFallback(fb.text, ficheInput));
          setActiveProviderHint(fb.sourceLabel || 'IA disponible');
          return;
        }
        if (fb?.error) lastErr = fb.error;
      }

      if (canTryServerAi()) {
        const res = await fetchJsonWithRetry<{
          brief?: CommercialBrief;
          model?: string;
          error?: string;
        }>(
          '/api/ai/next-action',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(briefPayload),
          },
          {
            timeoutMs: 25000,
            maxNetworkRetries: 1,
            fallbackLabel: 'Service IA serveur momentanément indisponible',
          }
        );

        if (res.ok && res.data?.brief) {
          setBrief(res.data.brief);
          setActiveProviderHint(res.data.model ? `Gemini · ${res.data.model}` : 'Gemini');
          return;
        }
        markServerAiUnavailable(res.status, res.isStaticOrHtml);
        if (res.error) lastErr = res.error;

        if (!preferExternalFirst) {
          const fb = await runExternalFallback();
          if (fb?.ok && fb.text.trim()) {
            setBrief(buildCommercialBriefFromTextFallback(fb.text, ficheInput));
            setActiveProviderHint(fb.sourceLabel || 'Fournisseur IA alternatif');
            return;
          }
          if (fb?.error) lastErr = fb.error;
        }
      }

      // Repli transparent vers le calcul CRM local sur la fiche réelle
      setBrief(buildLocalDeterministicBrief(ficheInput));
      setActiveProviderHint('Calcul CRM local');
      setBriefNotice(buildLocalFallbackNotice(lastErr));
    } finally {
      setBriefLoading(false);
    }
  };

  const loadPortfolioInsights = async (forceServerRetry = false) => {
    if (forceServerRetry) {
      serverSideBlockedUntilRef.current = 0;
    }
    setInsightsNotice('');
    setInsightsLoading(true);
    try {
      const portfolioSummary = buildPortfolioAiSummary(fiches);
      const copilotFiches = fiches.map(toCopilotFicheInput);

      const runExternalFallback = async () => {
        if (!onFallbackLlmPrompt) return null;
        return onFallbackLlmPrompt(
          buildFallbackInsightsPrompt(portfolioSummary),
          'Tu es Directeur des Ventes B2B Orange Pro Maroc. Retourne uniquement un objet JSON valide.'
        );
      };

      let lastErr = '';
      const preferExternalFirst = !canTryServerAi() || hasConfiguredFallbackKeys;

      if (preferExternalFirst) {
        const fb = await runExternalFallback();
        if (fb?.ok && fb.text.trim()) {
          setInsights(buildPortfolioInsightsFromTextFallback(fb.text, copilotFiches));
          setActiveProviderHint(fb.sourceLabel || 'IA disponible');
          return;
        }
        if (fb?.error) lastErr = fb.error;
      }

      if (canTryServerAi()) {
        const res = await fetchJsonWithRetry<{
          insights?: PortfolioInsights;
          model?: string;
          error?: string;
        }>(
          '/api/ai/portfolio-insights',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ portfolioSummary }),
          },
          {
            timeoutMs: 25000,
            maxNetworkRetries: 1,
            fallbackLabel: 'Service IA serveur momentanément indisponible',
          }
        );

        if (res.ok && res.data?.insights) {
          setInsights(res.data.insights);
          setActiveProviderHint(res.data.model ? `Gemini · ${res.data.model}` : 'Gemini');
          return;
        }
        markServerAiUnavailable(res.status, res.isStaticOrHtml);
        if (res.error) lastErr = res.error;

        if (!preferExternalFirst) {
          const fb = await runExternalFallback();
          if (fb?.ok && fb.text.trim()) {
            setInsights(buildPortfolioInsightsFromTextFallback(fb.text, copilotFiches));
            setActiveProviderHint(fb.sourceLabel || 'Fournisseur IA alternatif');
            return;
          }
          if (fb?.error) lastErr = fb.error;
        }
      }

      // Repli transparent vers le diagnostic CRM local en temps réel
      setInsights(buildLocalDeterministicInsights(copilotFiches));
      setActiveProviderHint('Calcul CRM local');
      setInsightsNotice(buildLocalFallbackNotice(lastErr));
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleSendChat = async (customText?: string, isRetry = false) => {
    const text = (customText ?? input).trim();
    if (!text || isSending) return;
    if (isRetry) {
      serverSideBlockedUntilRef.current = 0;
    }
    setChatNotice('');
    setLastChatQuery(text);

    const nextHistory: ChatMessage[] = isRetry
      ? messages
      : [
          ...messages,
          {
            id: `u_${Date.now()}`,
            role: 'user',
            content: text,
          },
        ];

    if (!isRetry) {
      setMessages(nextHistory);
      if (!customText) setInput('');
    }
    setIsSending(true);

    try {
      const portfolioSummary = buildPortfolioAiSummary(fiches);
      const focusedSummary = focusedFiche
        ? `[${focusedFiche.numeroFiche || 'N/A'}] ${focusedFiche.societe} (${SECTEURS_META[focusedFiche.secteur].label}, ${focusedFiche.ville}, statut: ${focusedFiche.statut}, contact: ${focusedFiche.contact || 'absent'}, effectif: ${focusedFiche.effectif || 'N/A'})`
        : '';

      const chatHistoryPayload = nextHistory
        .filter((m) => m.id !== 'welcome' && !m.isLocalFallback)
        .map((m) => ({ role: m.role, content: m.content }));

      const runExternalFallback = async () => {
        if (!onFallbackLlmPrompt) return null;
        return onFallbackLlmPrompt(
          buildFallbackChatPrompt(chatHistoryPayload, portfolioSummary, focusedSummary),
          'Tu es le Copilote Commercial B2B Orange Pro Maroc.'
        );
      };

      let lastErr = '';
      const preferExternalFirst = !canTryServerAi() || hasConfiguredFallbackKeys;

      if (preferExternalFirst) {
        const fb = await runExternalFallback();
        if (fb?.ok && fb.text.trim()) {
          setActiveProviderHint(fb.sourceLabel || 'IA disponible');
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              content: fb.text.trim(),
            },
          ]);
          return;
        }
        if (fb?.error) lastErr = fb.error;
      }

      if (canTryServerAi()) {
        const res = await fetchJsonWithRetry<{
          reply?: string;
          model?: string;
          error?: string;
        }>(
          '/api/ai/chat',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: chatHistoryPayload,
              portfolioSummary,
              focusedFiche: focusedSummary,
            }),
          },
          {
            timeoutMs: 25000,
            maxNetworkRetries: 1,
            fallbackLabel: 'Service IA serveur momentanément indisponible',
          }
        );

        if (res.ok && res.data?.reply) {
          setActiveProviderHint(res.data.model ? `Gemini · ${res.data.model}` : 'Gemini');
          setMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              content: String(res.data?.reply || '').trim(),
            },
          ]);
          return;
        }
        markServerAiUnavailable(res.status, res.isStaticOrHtml);
        if (res.error) lastErr = res.error;

        if (!preferExternalFirst) {
          const fb = await runExternalFallback();
          if (fb?.ok && fb.text.trim()) {
            setActiveProviderHint(fb.sourceLabel || 'Fournisseur IA alternatif');
            setMessages((prev) => [
              ...prev,
              {
                id: `a_${Date.now()}`,
                role: 'assistant',
                content: fb.text.trim(),
              },
            ]);
            return;
          }
          if (fb?.error) lastErr = fb.error;
        }
      }

      // Repli transparent vers la réponse CRM locale instantanée (zéro blocage utilisateur)
      const localReply = buildLocalDeterministicChatReply(
        text,
        fiches.map(toCopilotFicheInput),
        focusedFiche ? toCopilotFicheInput(focusedFiche) : null
      );
      setActiveProviderHint('Calcul CRM local');
      setChatNotice(buildLocalFallbackNotice(lastErr));
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: localReply,
          isLocalFallback: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-900/40"
      role="dialog"
      aria-modal="true"
      aria-label="Copilote Commercial IA Orange Pro"
      data-testid="ai-copilot-drawer"
    >
      <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-orange-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-stone-900 truncate">
                Copilote Commercial IA
              </h2>
              <p className="text-[11px] text-stone-500 truncate">
                {activeProviderHint
                  ? activeProviderHint === 'Calcul CRM local'
                    ? 'Mode CRM local actif · prêt pour clé IA externe'
                    : `Connecté · ${activeProviderHint}`
                  : hasConfiguredFallbackKeys
                    ? `Multi-IA prêt (Hub API / Coffre${aiAvailable ? ` · ${aiModel}` : ''})`
                    : aiAvailable
                      ? `Gemini (${aiModel}) · bascule auto multi-IA active`
                      : 'Analyse CRM locale prête · ajoutez une clé IA dans le Hub API'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le Copilote IA"
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sélecteur de mode : Assistant Pipeline / Diagnostic IA / Brief Fiche */}
        <div className="px-4 py-2 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
          <div className="inline-flex p-0.5 bg-stone-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'chat'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Assistant
            </button>
            <button
              type="button"
              data-testid="copilot-tab-diagnostic"
              onClick={() => setMode('diagnostic')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'diagnostic'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Diagnostic IA
            </button>
            <button
              type="button"
              onClick={() => setMode('brief')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'brief'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Brief Fiche
            </button>
          </div>
          <span className="text-[11px] text-stone-500 tabular-nums shrink-0">
            {fiches.length} comptes
          </span>
        </div>

        {/* MODE 1 : CHAT PIPELINE */}
        {mode === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-stone-100">
                {QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    disabled={isSending}
                    onClick={() => void handleSendChat(qp.prompt)}
                    className="text-left px-2.5 py-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-orange-50 hover:border-orange-300 text-xs font-medium text-stone-800 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="truncate">{qp.label}</span>
                      <ArrowRight className="w-3 h-3 text-orange-600 shrink-0" />
                    </span>
                  </button>
                ))}
              </div>

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-stone-900 text-stone-50'
                        : 'bg-stone-100 text-stone-900 border border-stone-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3.5 py-2.5 text-xs bg-stone-100 border border-stone-200 text-stone-600 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600 animate-spin" />
                    Analyse du portefeuille en cours...
                  </div>
                </div>
              )}

              {chatNotice && (
                <div
                  role="status"
                  className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-2"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>{chatNotice}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    {onOpenApiHub && (
                      <button
                        type="button"
                        onClick={onOpenApiHub}
                        className="px-2.5 py-1 rounded-md bg-stone-900 text-white hover:bg-stone-800 text-[11px] font-semibold"
                      >
                        Ajouter une clé dans le Hub API
                      </button>
                    )}
                    {lastChatQuery && (
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => void handleSendChat(lastChatQuery, true)}
                        className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-semibold"
                      >
                        Réessayer IA
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
              className="p-3 border-t border-stone-200 bg-white flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex. Quel argumentaire pour OP-0002 ?"
                aria-label="Message au Copilote Commercial IA"
                className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                Envoyer
              </button>
            </form>
          </>
        )}

        {/* MODE 2 : DIAGNOSTIC IA EXÉCUTIF DU PORTEFEUILLE */}
        {mode === 'diagnostic' && (
          <div data-testid="copilot-diagnostic-panel" className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-orange-600" />
                  Audit Exécutif Portefeuille
                </h3>
                <p className="text-[11px] text-stone-500">
                  Score de santé, goulots pipeline et top comptes à attaquer maintenant.
                </p>
              </div>
              <button
                type="button"
                disabled={insightsLoading || fiches.length === 0}
                onClick={() => void loadPortfolioInsights(true)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? 'animate-spin' : ''}`} />
                {insights ? 'Actualiser' : 'Lancer Audit IA'}
              </button>
            </div>

            {insightsLoading && (
              <div className="py-10 text-center space-y-2">
                <Sparkles className="w-5 h-5 text-orange-600 animate-spin mx-auto" />
                <p className="text-xs text-stone-600 font-medium">
                  Diagnostic commercial sur vos {fiches.length} comptes...
                </p>
              </div>
            )}

            {insightsNotice && (
              <div
                role="status"
                className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{insightsNotice}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  {onOpenApiHub && (
                    <button
                      type="button"
                      onClick={onOpenApiHub}
                      className="px-2.5 py-1 rounded-md bg-stone-900 text-white hover:bg-stone-800 text-[11px] font-semibold"
                    >
                      Ajouter une clé dans le Hub API
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={insightsLoading || fiches.length === 0}
                    onClick={() => void loadPortfolioInsights(true)}
                    className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-semibold"
                  >
                    Réessayer IA
                  </button>
                </div>
              </div>
            )}

            {/* Synthèse instantanée locale du portefeuille (toujours disponible sans latence) */}
            {fiches.length > 0 && (() => {
              const qualifiedCount = fiches.filter((f) => Boolean(f.telephone && f.email)).length;
              const multiContactCount = fiches.filter(
                (f) =>
                  (f.telephonesSupplementaires?.length ?? 0) > 0 ||
                  (f.emailsSupplementaires?.length ?? 0) > 0
              ).length;
              const advancedCount = fiches.filter(
                (f) => f.statut === 'RDV pris' || f.statut === 'Devis envoyé' || f.statut === 'Signé Orange Pro'
              ).length;
              const incompleteCount = fiches.filter((f) => !f.telephone || !f.email).length;
              return (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                    <div className="text-[11px] text-stone-500">Fiches joignables</div>
                    <div className="text-base font-bold font-mono text-stone-900 tabular-nums">
                      {qualifiedCount}
                      <span className="text-[11px] font-normal text-stone-400">/{fiches.length}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                    <div className="text-[11px] text-stone-500">Pipeline avancé</div>
                    <div className="text-base font-bold font-mono text-orange-600 tabular-nums">
                      {advancedCount}
                      <span className="text-[11px] font-normal text-stone-400"> RDV/Devis/Signés</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                    <div className="text-[11px] text-stone-500">Multi-contacts</div>
                    <div className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                      {multiContactCount}
                      <span className="text-[11px] font-normal text-stone-400"> comptes</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                    <div className="text-[11px] text-stone-500">À enrichir</div>
                    <div className="text-base font-bold font-mono text-amber-700 tabular-nums">
                      {incompleteCount}
                      <span className="text-[11px] font-normal text-stone-400"> incomplètes</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {!insights && !insightsLoading && !insightsNotice && (
              <div className="rounded-xl border border-dashed border-stone-300 p-5 text-center space-y-2">
                <Activity className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="text-xs text-stone-600">
                  Cliquez sur « Lancer Audit IA » pour obtenir une analyse stratégique et le plan d&apos;attaque chiffré sur vos {fiches.length} comptes.
                </p>
              </div>
            )}

            {insights && !insightsLoading && (
              <div className="space-y-3.5 text-xs">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-stone-500">Score de Santé Pipeline</div>
                    <p className="text-stone-800 leading-relaxed">{insights.constatCle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-2xl font-bold font-mono tabular-nums ${
                        insights.scoreSante >= 75
                          ? 'text-emerald-700'
                          : insights.scoreSante >= 50
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}
                    >
                      {Math.max(0, Math.min(100, Number(insights.scoreSante) || 0))}
                      <span className="text-xs text-stone-400">/100</span>
                    </div>
                  </div>
                </div>

                {insights.alertePipeline && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 space-y-0.5">
                    <div className="text-[11px] font-bold text-amber-900">Point de vigilance pipeline</div>
                    <p className="leading-relaxed">{insights.alertePipeline}</p>
                  </div>
                )}

                {insights.actionsPrioritaires?.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-stone-900">Actions prioritaires cette semaine</h4>
                    <ul className="space-y-1.5 text-stone-700">
                      {insights.actionsPrioritaires.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono font-bold text-orange-600 shrink-0">
                            0{idx + 1}.
                          </span>
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insights.opportunitesCibles?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-stone-900">Comptes cibles prioritaires</h4>
                    {insights.opportunitesCibles.map((opp, idx) => {
                      const matched = fiches.find(
                        (f) =>
                          (opp.numeroFiche && f.numeroFiche?.toUpperCase() === opp.numeroFiche.toUpperCase()) ||
                          f.societe.toLowerCase() === opp.societe.toLowerCase()
                      );
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-stone-200 bg-white p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-stone-900 truncate">
                              {opp.numeroFiche && (
                                <span className="font-mono text-[11px] text-orange-700 mr-1.5">
                                  {opp.numeroFiche}
                                </span>
                              )}
                              {opp.societe}
                            </div>
                            {matched && onSelectFicheForBrief && (
                              <button
                                type="button"
                                onClick={() => onSelectFicheForBrief(matched)}
                                className="text-[11px] font-semibold text-orange-700 hover:underline shrink-0"
                              >
                                Brief IA →
                              </button>
                            )}
                          </div>
                          <p className="text-stone-600">{opp.raison}</p>
                          <p className="text-emerald-800 font-medium">Action : {opp.action}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODE 3 : BRIEF COMMERCIAL IA (BATTLECARD) */}
        {mode === 'brief' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!focusedFiche ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center space-y-2">
                <Target className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="text-sm font-semibold text-stone-800">
                  Aucune fiche sélectionnée
                </p>
                <p className="text-xs text-stone-500">
                  Cliquez sur le bouton « Brief IA » d&apos;une entreprise dans le Tableau CRM ou le Kanban pour générer sa battlecard commerciale Orange Pro.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {focusedFiche.numeroFiche && (
                          <span className="font-mono text-[11px] font-bold text-orange-700">
                            {focusedFiche.numeroFiche}
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-stone-900">{focusedFiche.societe}</h3>
                      </div>
                      <p className="text-xs text-stone-500">
                        {SECTEURS_META[focusedFiche.secteur].label} · {focusedFiche.ville || 'Maroc'} · Statut : {focusedFiche.statut}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadBriefForFiche(focusedFiche, true)}
                      disabled={briefLoading}
                      aria-label="Régénérer le Brief IA"
                      className="px-2 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-700 flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${briefLoading ? 'animate-spin' : ''}`} />
                      Actualiser
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenEmailStudio(focusedFiche);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Ouvrir Studio Email
                    </button>
                    {focusedFiche.statut === 'À contacter' && (
                      <button
                        type="button"
                        onClick={() => onMoveFiche(focusedFiche.id, 'Appel en cours')}
                        className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-stone-800"
                      >
                        Passer en « Appel en cours »
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClearFocusedFiche}
                      className="text-xs text-stone-500 hover:text-stone-800 ml-auto"
                    >
                      Changer de fiche
                    </button>
                  </div>
                </div>

                {briefLoading && (
                  <div className="py-10 text-center space-y-2">
                    <Sparkles className="w-5 h-5 text-orange-600 animate-spin mx-auto" />
                    <p className="text-xs text-stone-600 font-medium">
                      Préparation de la battlecard Orange Pro...
                    </p>
                  </div>
                )}

                {briefNotice && (
                  <div
                    role="status"
                    className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>{briefNotice}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-6">
                      {onOpenApiHub && (
                        <button
                          type="button"
                          onClick={onOpenApiHub}
                          className="px-2.5 py-1 rounded-md bg-stone-900 text-white hover:bg-stone-800 text-[11px] font-semibold"
                        >
                          Ajouter une clé dans le Hub API
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={briefLoading}
                        onClick={() => void loadBriefForFiche(focusedFiche, true)}
                        className="px-2.5 py-1 rounded-md bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 text-[11px] font-semibold"
                      >
                        Réessayer IA
                      </button>
                    </div>
                  </div>
                )}

                {brief && !briefLoading && (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                      <span className="text-stone-500">Priorité commerciale</span>
                      <span className="font-bold text-orange-700">{brief.priorite}</span>
                    </div>

                    <div>
                      <h4 className="font-bold text-stone-900 mb-1">Diagnostic rapide</h4>
                      <p className="text-stone-700 leading-relaxed">{brief.resume}</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-stone-900 mb-1.5">Pitch Orange Pro (3 points)</h4>
                      <ul className="space-y-1.5 text-stone-700">
                        {brief.pitch3Points.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="font-mono font-bold text-orange-600 shrink-0">
                              0{i + 1}.
                            </span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5">
                      <p className="font-bold text-stone-900">
                        Objection probable : <span className="font-normal text-stone-700">{brief.objectionPrincipale}</span>
                      </p>
                      <p className="font-bold text-emerald-800">
                        Réponse terrain : <span className="font-normal text-stone-800">{brief.reponseObjection}</span>
                      </p>
                    </div>

                    <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3 space-y-1">
                      <p className="text-[11px] font-semibold text-orange-800">
                        Canal recommandé : {brief.canalRecommande}
                      </p>
                      <p className="font-bold text-stone-900">{brief.prochaineAction}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
