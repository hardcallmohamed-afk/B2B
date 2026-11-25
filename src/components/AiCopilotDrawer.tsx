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
} from 'lucide-react';
import {
  SECTEURS_META,
  computeMaturityScore,
  getOrangeProRecommendation,
  type FicheEntreprise,
  type StatutCRM,
} from '../App';
import { buildPortfolioAiSummary } from '../utils/analytics';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CommercialBrief {
  priorite: string;
  resume: string;
  pitch3Points: string[];
  objectionPrincipale: string;
  reponseObjection: string;
  canalRecommande: string;
  prochaineAction: string;
}

interface AiCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  fiches: FicheEntreprise[];
  focusedFiche: FicheEntreprise | null;
  onClearFocusedFiche: () => void;
  aiAvailable: boolean;
  aiModel: string;
  onOpenEmailStudio: (fiche: FicheEntreprise) => void;
  onMoveFiche: (ficheId: string, statut: StatutCRM) => void;
}

const QUICK_PROMPTS = [
  {
    label: 'Priorités du jour',
    prompt:
      'Analyse mon portefeuille actuel et donne-moi le top 3 des comptes à appeler en priorité aujourd’hui avec le motif précis pour chacun.',
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

export const AiCopilotDrawer: React.FC<AiCopilotDrawerProps> = ({
  open,
  onClose,
  fiches,
  focusedFiche,
  onClearFocusedFiche,
  aiAvailable,
  aiModel,
  onOpenEmailStudio,
  onMoveFiche,
}) => {
  const [mode, setMode] = useState<'chat' | 'brief'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour ! Je suis votre Copilote Commercial Orange Pro connecté à votre portefeuille en temps réel. Demandez-moi vos priorités d’appels, un script terrain ou ouvrez un Brief IA sur n’importe quelle fiche.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');

  const [brief, setBrief] = useState<CommercialBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');
  const lastBriefFicheId = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const loadBriefForFiche = async (fiche: FicheEntreprise) => {
    lastBriefFicheId.current = fiche.id;
    setBrief(null);
    setBriefError('');
    setBriefLoading(true);
    try {
      const reco = getOrangeProRecommendation(fiche);
      const res = await fetch('/api/ai/next-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBriefError(data?.error || 'Impossible de générer le Brief IA.');
        return;
      }
      setBrief(data.brief || null);
    } catch {
      setBriefError('Erreur réseau lors de l’appel au service Gemini IA.');
    } finally {
      setBriefLoading(false);
    }
  };

  const handleSendChat = async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || isSending) return;
    setChatError('');

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!customText) setInput('');
    setIsSending(true);

    try {
      const portfolioSummary = buildPortfolioAiSummary(fiches);
      const focusedSummary = focusedFiche
        ? `${focusedFiche.societe} (${SECTEURS_META[focusedFiche.secteur].label}, ${focusedFiche.ville}, statut: ${focusedFiche.statut}, contact: ${focusedFiche.contact || 'absent'}, effectif: ${focusedFiche.effectif || 'N/A'})`
        : '';

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, content: m.content })),
          portfolioSummary,
          focusedFiche: focusedSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatError(data?.error || 'Le service IA a renvoyé une erreur.');
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: String(data.reply || '').trim(),
        },
      ]);
    } catch {
      setChatError('Impossible de joindre le serveur IA local.');
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
                {aiAvailable
                  ? `Intégration Gemini active (${aiModel})`
                  : 'Clé serveur GEMINI_API_KEY requise dans Settings > Secrets'}
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

        {/* Sélecteur de mode : Assistant Pipeline vs Brief Fiche */}
        <div className="px-4 py-2 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2">
          <div className="inline-flex p-0.5 bg-stone-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'chat'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Assistant Pipeline
            </button>
            <button
              type="button"
              onClick={() => setMode('brief')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                mode === 'brief'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Brief Fiche IA
            </button>
          </div>
          <span className="text-[11px] text-stone-500 tabular-nums">
            {fiches.length} comptes synchronisés
          </span>
        </div>

        {/* MODE 1 : CHAT PIPELINE */}
        {mode === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Raccourcis de prompts métier */}
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

              {chatError && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{chatError}</span>
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
                placeholder="Ex. Quel argumentaire pour Clinique Privée Atlas ?"
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

        {/* MODE 2 : BRIEF COMMERCIAL IA (BATTLECARD) */}
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
                      <h3 className="text-sm font-bold text-stone-900">{focusedFiche.societe}</h3>
                      <p className="text-xs text-stone-500">
                        {SECTEURS_META[focusedFiche.secteur].label} · {focusedFiche.ville || 'Maroc'} · Statut : {focusedFiche.statut}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadBriefForFiche(focusedFiche)}
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
                      Préparation de la battlecard Orange Pro via Gemini...
                    </p>
                  </div>
                )}

                {briefError && (
                  <div
                    role="alert"
                    className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{briefError}</span>
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
