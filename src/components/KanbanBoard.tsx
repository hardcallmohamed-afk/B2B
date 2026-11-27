import React, { useMemo, useState } from 'react';
import {
  GripVertical,
  Phone,
  MessageSquare,
  Mail,
  Sparkles,
  Bot,
  Users,
  Globe,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Eye,
  FileSpreadsheet,
  UserPlus,
  RotateCcw,
  Ban,
  Flame,
} from 'lucide-react';
import {
  SECTEURS_META,
  SEGMENTS_COULEUR,
  computeMaturityScore,
  getOrangeProRecommendation,
  type FicheEntreprise,
  type StatutCRM,
} from '../utils/crmDomain';
import { isEffectifAberrant } from '../utils/dataHygiene';
import {
  KANBAN_STAGES,
  computePortfolioVelocity,
  groupFichesByStatut,
  type PortfolioVelocityReport,
  type VelocityLevel,
} from '../utils/analytics';
import { computeDealRotting, computeLeadScore } from '../utils/salesIntelligence';
import type { OrgSettingsConfig } from '../utils/securityHardening';
import type { AdvancedAccountPreferences } from '../utils/accountPreferences';
import { PipelineForecastBar } from './PipelineForecastBar';

interface KanbanBoardProps {
  fiches: FicheEntreprise[];
  velocityReport?: PortfolioVelocityReport;
  verifyingId: string | null;
  targetMaturityPct?: number;
  preferredContactChannel?: 'whatsapp' | 'phone' | 'email';
  orgSettings?: OrgSettingsConfig | null;
  monthlyGoalPayoutMad?: number;
  followUpAlertDelay?: AdvancedAccountPreferences['followUpAlertDelay'];
  enforceCndpOptOutLock?: boolean;
  onMoveFiche: (ficheId: string, targetStatut: StatutCRM) => void;
  onOpenEmail: (fiche: FicheEntreprise) => void;
  onVerifyOne: (fiche: FicheEntreprise) => void;
  onOpenAiBrief: (fiche: FicheEntreprise) => void;
  onOpenAssist?: (fiche: FicheEntreprise) => void;
  onOpenDetail?: (fiche: FicheEntreprise) => void;
  onOpenQuote?: (fiche: FicheEntreprise) => void;
  onQuickAddInStage?: (statut: StatutCRM) => void;
  canSuperviseTeam?: boolean;
  onAssignFiche?: (fiche: FicheEntreprise) => void;
  onRestoreFiche?: (fiche: FicheEntreprise) => void;
}

function getVelocityCardStyles(level: VelocityLevel): {
  textCls: string;
  subTextCls: string;
  cardBorderCls: string;
  barCls: string;
} {
  switch (level) {
    case 'bottleneck':
      return {
        textCls: 'text-red-700',
        subTextCls: 'text-red-600/90',
        cardBorderCls: 'border-red-300 hover:border-red-400',
        barCls: 'bg-red-500',
      };
    case 'slow':
      return {
        textCls: 'text-amber-700',
        subTextCls: 'text-amber-700/90',
        cardBorderCls: 'border-amber-300 hover:border-amber-400',
        barCls: 'bg-amber-500',
      };
    case 'fast':
      return {
        textCls: 'text-emerald-700',
        subTextCls: 'text-stone-500',
        cardBorderCls: 'border-stone-200 hover:border-stone-400',
        barCls: 'bg-emerald-500',
      };
    case 'terminal':
      return {
        textCls: 'text-stone-500',
        subTextCls: 'text-stone-400',
        cardBorderCls: 'border-stone-200 hover:border-stone-400',
        barCls: 'bg-stone-300',
      };
    default:
      return {
        textCls: 'text-stone-700',
        subTextCls: 'text-stone-500',
        cardBorderCls: 'border-stone-200 hover:border-stone-400',
        barCls: 'bg-stone-400',
      };
  }
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  fiches,
  velocityReport: externalVelocityReport,
  verifyingId,
  targetMaturityPct = 85,
  preferredContactChannel = 'whatsapp',
  orgSettings,
  monthlyGoalPayoutMad = 15000,
  followUpAlertDelay = '48h',
  enforceCndpOptOutLock = true,
  onMoveFiche,
  onOpenEmail,
  onVerifyOne,
  onOpenAiBrief,
  onOpenAssist,
  onOpenDetail,
  onOpenQuote,
  onQuickAddInStage,
  canSuperviseTeam = false,
  onAssignFiche,
  onRestoreFiche,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StatutCRM | null>(null);
  const [onlyBottlenecks, setOnlyBottlenecks] = useState(false);
  const [onlyRotting, setOnlyRotting] = useState(false);

  const velocityReport = useMemo(
    () => externalVelocityReport ?? computePortfolioVelocity(fiches),
    [externalVelocityReport, fiches]
  );

  const effectiveRottingThreshold = orgSettings?.defaultSlaRottingHours || followUpAlertDelay;

  const visibleFiches = useMemo(() => {
    return fiches.filter((f) => {
      if (onlyBottlenecks && !velocityReport.byFicheId.get(f.id)?.isBottleneck) return false;
      if (onlyRotting && !computeDealRotting(f, effectiveRottingThreshold).isRotting) return false;
      return true;
    });
  }, [fiches, onlyBottlenecks, onlyRotting, velocityReport, effectiveRottingThreshold]);

  const columns = useMemo(() => groupFichesByStatut(visibleFiches), [visibleFiches]);

  const displayedBottleneckCount = useMemo(
    () =>
      fiches.reduce(
        (acc, f) => acc + (velocityReport.byFicheId.get(f.id)?.isBottleneck ? 1 : 0),
        0
      ),
    [fiches, velocityReport]
  );

  const handleDragStart = (e: React.DragEvent, ficheId: string) => {
    setDraggingId(ficheId);
    e.dataTransfer.setData('text/plain', ficheId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: StatutCRM) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatut: StatutCRM) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverStage(null);
    if (droppedId) {
      onMoveFiche(droppedId, targetStatut);
    }
  };

  return (
    <section
      aria-label="Tableau Kanban Pipeline Orange Pro"
      data-testid="kanban-board"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-bold text-stone-900">
            Pipeline Commercial Kanban — Glisser-Déposer
          </h2>
          <p className="text-xs text-stone-500">
            Glissez une carte d&apos;une colonne à l&apos;autre ou suivez la vélocité par statut (temps écoulé vs moyenne) pour débloquer les comptes en attente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          {displayedBottleneckCount > 0 ? (
            <button
              type="button"
              onClick={() => setOnlyBottlenecks((v) => !v)}
              aria-pressed={onlyBottlenecks}
              data-testid="kanban-bottleneck-toggle"
              className={`px-2.5 py-1 rounded-md border font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                onlyBottlenecks
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {displayedBottleneckCount} point{displayedBottleneckCount > 1 ? 's' : ''} de blocage
            </button>
          ) : (
            <span className="text-emerald-700 font-medium flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              Pipeline fluide
            </span>
          )}
          <span className="text-stone-500">
            {visibleFiches.length} fiche(s) affichée(s) · 6 étapes
          </span>
        </div>
      </div>

      <PipelineForecastBar
        fiches={fiches}
        monthlyGoalPayoutMad={monthlyGoalPayoutMad}
        orgSettings={orgSettings}
        rottingThreshold={effectiveRottingThreshold}
        onlyRottingActive={onlyRotting}
        onToggleRottingFilter={() => setOnlyRotting((v) => !v)}
      />

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 min-w-0 xl:min-w-[1260px] items-start">
          {columns.map((col, colIndex) => {
            const isOver = dragOverStage === col.meta.statut;
            const prevStage = colIndex > 0 ? KANBAN_STAGES[colIndex - 1].statut : null;
            const nextStage = colIndex < KANBAN_STAGES.length - 1 ? KANBAN_STAGES[colIndex + 1].statut : null;
            const stageVel = velocityReport.byStage[col.meta.statut];

            return (
              <div
                key={col.meta.statut}
                data-testid={`kanban-col-${col.meta.statut}`}
                data-stage={col.meta.statut}
                onDragOver={(e) => handleDragOver(e, col.meta.statut)}
                onDragEnter={(e) => handleDragOver(e, col.meta.statut)}
                onDragLeave={(e) => {
                  const related = e.relatedTarget as Node | null;
                  if (!related || !e.currentTarget.contains(related)) {
                    setDragOverStage((curr) => (curr === col.meta.statut ? null : curr));
                  }
                }}
                onDrop={(e) => handleDrop(e, col.meta.statut)}
                className={`rounded-xl border transition-colors flex flex-col min-h-[320px] overflow-hidden ${
                  isOver
                    ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-200'
                    : 'border-stone-200 bg-stone-100/70'
                }`}
              >
                {/* En-tête de colonne */}
                <div className={`relative px-3 pt-3.5 pb-2.5 border-b border-stone-200/80 ${col.meta.headerBgCls}`}>
                  <span
                    className={`absolute inset-x-0 top-0 h-[3px] ${col.meta.accentBarCls}`}
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`text-xs font-bold truncate ${col.meta.badgeTextCls}`}>
                      {col.meta.shortLabel}
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        data-testid={`kanban-count-${col.meta.statut}`}
                        className="text-xs font-bold text-stone-900 tabular-nums"
                      >
                        {col.items.length}
                      </span>
                      {onQuickAddInStage && col.meta.statut !== 'Signé Orange Pro' && (
                        <button
                          type="button"
                          onClick={() => onQuickAddInStage(col.meta.statut)}
                          aria-label={`Ajouter une fiche dans ${col.meta.shortLabel}`}
                          title={`Nouvelle fiche dans ${col.meta.shortLabel}`}
                          className="p-0.5 rounded hover:bg-stone-200/80 text-stone-600 hover:text-stone-900"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-stone-500 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-stone-400" />
                      {col.totalEffectif > 0 ? `${col.totalEffectif.toLocaleString('fr-FR')} sal.` : '—'}
                    </span>
                    <span>Mat. {col.avgMaturity}%</span>
                  </div>
                  <div
                    className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-stone-200/60 text-[10px] tabular-nums"
                    data-testid={`kanban-stage-vel-${col.meta.statut}`}
                  >
                    <span className="text-stone-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      Moy. {stageVel?.avgLabel || '—'}
                    </span>
                    {stageVel && stageVel.bottleneckCount > 0 ? (
                      <span className="font-semibold text-red-700 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {stageVel.bottleneckCount} bloqué{stageVel.bottleneckCount > 1 ? 's' : ''}
                      </span>
                    ) : stageVel && stageVel.slowCount > 0 ? (
                      <span className="font-semibold text-amber-700">
                        {stageVel.slowCount} ralenti{stageVel.slowCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-stone-400">
                        {stageVel?.isTerminal ? 'Sortie' : 'Nominal'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Liste des cartes */}
                <div className="p-2 space-y-2 flex-1">
                  {col.items.length === 0 ? (
                    <div
                      className={`h-24 rounded-lg border border-dashed flex items-center justify-center text-center px-3 text-[11px] transition-colors ${
                        isOver
                          ? 'border-orange-400 bg-orange-50 text-orange-800 font-semibold'
                          : 'border-stone-300/80 text-stone-400'
                      }`}
                    >
                      {isOver ? 'Déposer ici' : onlyBottlenecks ? 'Aucun blocage ici' : 'Glisser une fiche ici'}
                    </div>
                  ) : (
                    col.items.map((f) => {
                      const secMeta = SECTEURS_META[f.secteur] || SECTEURS_META.pme;
                      const segMeta = SEGMENTS_COULEUR[secMeta.couleur] || SEGMENTS_COULEUR.orange;
                      const reco = getOrangeProRecommendation(f);
                      const mat = computeMaturityScore(f);
                      const leadScore = computeLeadScore(f);
                      const rotting = computeDealRotting(f, effectiveRottingThreshold);
                      const isOptOutLocked = Boolean(f.optOut && enforceCndpOptOutLock);
                      const vel = velocityReport.byFicheId.get(f.id);
                      const velStyles = getVelocityCardStyles(vel?.level || 'normal');
                      const isDragging = draggingId === f.id;
                      const cleanDigits = (f.telephone || '').replace(/\D/g, '');
                      const waPhone = cleanDigits
                        ? cleanDigits.startsWith('212')
                          ? cleanDigits
                          : cleanDigits.startsWith('00212')
                            ? cleanDigits.slice(2)
                            : `212${cleanDigits.replace(/^0+/, '')}`
                        : '';
                      const extraPhonesCount = f.telephonesSupplementaires?.length || 0;
                      const extraEmailsCount = f.emailsSupplementaires?.length || 0;
                      const velBarPct =
                        vel && vel.stageAvgHours > 0
                          ? Math.min(100, Math.max(8, Math.round((vel.elapsedHours / (vel.stageAvgHours * 2)) * 100)))
                          : 20;

                      return (
                        <article
                          key={f.id}
                          draggable
                          data-testid={`kanban-card-${f.id}`}
                          onDragStart={(e) => handleDragStart(e, f.id)}
                          onDragEnd={handleDragEnd}
                          className={`relative overflow-hidden rounded-lg bg-white border p-2.5 transition-all cursor-grab active:cursor-grabbing ${velStyles.cardBorderCls} ${
                            isDragging ? 'opacity-45 scale-[0.98] ring-2 ring-orange-400' : ''
                          }`}
                        >
                          <span
                            className={`absolute inset-x-0 top-0 h-[2.5px] ${segMeta.dotCls}`}
                            aria-hidden="true"
                          />

                          {/* Numéro fiche unique + Score IA + poignée drag */}
                          <div className="flex items-center justify-between gap-1.5 pt-0.5">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              {f.numeroFiche && (
                                <span className="font-mono text-[10px] font-bold text-stone-500 tracking-tight">
                                  {f.numeroFiche}
                                </span>
                              )}
                              <span
                                title={`Score Priorité ${leadScore.score}/100 · ${leadScore.reasons.join(', ')}`}
                                className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-extrabold tabular-nums border ${
                                  leadScore.grade === 'A'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : leadScore.grade === 'B'
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-stone-100 border-stone-200 text-stone-600'
                                }`}
                              >
                                {leadScore.grade}·{leadScore.score}
                              </span>
                              {rotting.isRotting && (
                                <span
                                  title={`Affaire dormante (${rotting.elapsedHours}h sans action)`}
                                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold bg-red-50 border border-red-200 text-red-700"
                                >
                                  <Flame className="w-2.5 h-2.5" />
                                  {rotting.label}
                                </span>
                              )}
                              {f.optOut && (
                                <span
                                  title="Liste Rouge CNDP — Ne plus contacter"
                                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold bg-red-600 text-white"
                                >
                                  <Ban className="w-2.5 h-2.5" />
                                  CNDP
                                </span>
                              )}
                            </div>
                            <GripVertical
                              className="w-3.5 h-3.5 text-stone-400 shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          {/* Titre société (cliquable pour ouvrir les détails) */}
                          {onOpenDetail ? (
                            <button
                              type="button"
                              onClick={() => onOpenDetail(f)}
                              className="text-left text-xs font-bold text-stone-900 hover:text-orange-700 hover:underline leading-snug line-clamp-2 mt-0.5 block w-full"
                              title="Ouvrir les détails complets de la fiche"
                            >
                              {f.societe}
                            </button>
                          ) : (
                            <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2 mt-0.5">
                              {f.societe}
                            </h4>
                          )}

                          {/* Métadonnées propres sans pilules */}
                          <p className="text-[11px] text-stone-500 mt-1 truncate">
                            {f.ville || 'Maroc'} · {secMeta.label}
                          </p>

                          {/* Décideur, Téléphone & Multi-contacts */}
                          <div className="mt-2 pt-2 border-t border-stone-100 space-y-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-stone-700 font-medium truncate">
                                {f.contact || 'Décideur à identifier'}
                              </span>
                              {f.effectif &&
                                (isEffectifAberrant(f.effectif) ? (
                                  <span
                                    data-testid={`kanban-aberrant-eff-${f.id}`}
                                    title={`Effectif aberrant (« ${f.effectif} ») — à nettoyer dans Déduplication / Hygiène`}
                                    className="inline-flex items-center gap-0.5 rounded bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0"
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Eff. à vérifier
                                  </span>
                                ) : (
                                  <span className="text-stone-500 tabular-nums shrink-0">
                                    {f.effectif} sal.
                                  </span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between gap-1.5 text-stone-600 font-mono tabular-nums">
                              <span className="truncate">
                                {f.telephone || 'Tél. manquant'}
                                {extraPhonesCount > 0 && (
                                  <span className="font-sans text-[10px] font-semibold text-stone-500 ml-1">
                                    (+{extraPhonesCount})
                                  </span>
                                )}
                              </span>
                              <span className="font-sans text-[10px] font-semibold text-orange-700 shrink-0">
                                {reco.tier}
                              </span>
                            </div>
                            {extraEmailsCount > 0 && (
                              <div className="text-[10px] text-stone-500 truncate">
                                {f.email} (+{extraEmailsCount} email{extraEmailsCount > 1 ? 's' : ''})
                              </div>
                            )}
                          </div>

                          {/* Indicateur de vélocité automatique (temps dans le statut vs moyenne) */}
                          {vel && (
                            <div
                              data-testid={`kanban-velocity-${f.id}`}
                              title={`Dans « ${f.statut} » depuis ${vel.durationLabel} (${vel.comparisonLabel})`}
                              className="mt-2 pt-2 border-t border-stone-100 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-1.5 text-[10px] tabular-nums">
                                <span className={`font-semibold flex items-center gap-1 min-w-0 ${velStyles.textCls}`}>
                                  {vel.isBottleneck ? (
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <Clock className="w-3 h-3 shrink-0" />
                                  )}
                                  <span className="font-mono font-bold">{vel.durationLabel}</span>
                                  <span className="truncate">{vel.label}</span>
                                </span>
                                <span className={`font-mono shrink-0 ${velStyles.subTextCls}`}>
                                  {vel.comparisonLabel}
                                </span>
                              </div>
                              <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${velStyles.barCls}`}
                                  style={{ width: `${velBarPct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Barre de maturité */}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-stone-400 shrink-0">Mat.</span>
                            <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  mat >= targetMaturityPct
                                    ? 'bg-emerald-600'
                                    : mat >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${mat}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono tabular-nums text-stone-500">
                              {mat}%
                            </span>
                          </div>

                          {/* Actions rapides + Déplacement 1-clic & sélecteur accessible */}
                          <div className="mt-2.5 pt-2 border-t border-stone-100 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-0.5">
                                {f.telephone && (
                                  <a
                                    href={`tel:${f.telephone}`}
                                    aria-label={`Appeler ${f.societe}`}
                                    title={`Appeler ${f.telephone}${preferredContactChannel === 'phone' ? ' (Canal prioritaire)' : ''}`}
                                    className={`p-1 rounded ${
                                      preferredContactChannel === 'phone'
                                        ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                                        : 'hover:bg-stone-100 text-stone-600 hover:text-stone-900'
                                    }`}
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {waPhone && !isOptOutLocked && (
                                  <a
                                    href={`https://wa.me/${waPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`WhatsApp ${f.societe}`}
                                    title={`WhatsApp Pro${preferredContactChannel === 'whatsapp' ? ' (Canal prioritaire)' : ''}`}
                                    className={`p-1 rounded ${
                                      preferredContactChannel === 'whatsapp'
                                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                                        : 'hover:bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={isOptOutLocked}
                                  onClick={() => onOpenEmail(f)}
                                  aria-label={`Studio Email ${f.societe}`}
                                  title={
                                    isOptOutLocked
                                      ? 'Verrouillé : prospect sur Liste Rouge CNDP'
                                      : `Studio Email IA${preferredContactChannel === 'email' ? ' (Canal prioritaire)' : ''}`
                                  }
                                  className={`p-1 rounded disabled:opacity-35 disabled:cursor-not-allowed ${
                                    preferredContactChannel === 'email'
                                      ? 'bg-sky-100 text-sky-800 ring-1 ring-sky-300'
                                      : 'hover:bg-sky-50 text-sky-700'
                                  }`}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={verifyingId === f.id}
                                  onClick={() => onVerifyOne(f)}
                                  aria-label={`Enrichir ${f.societe}`}
                                  title="Vérifier & Enrichir"
                                  className="p-1 rounded hover:bg-orange-50 text-orange-700 disabled:opacity-40"
                                >
                                  <Sparkles className={`w-3.5 h-3.5 ${verifyingId === f.id ? 'animate-spin' : ''}`} />
                                </button>
                                {onOpenDetail && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDetail(f)}
                                    aria-label={`Détails de ${f.societe}`}
                                    title="Voir détails & profil client"
                                    className="p-1 rounded hover:bg-orange-50 text-stone-700 hover:text-orange-700"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onOpenQuote && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenQuote(f)}
                                    aria-label={`Devis PDF pour ${f.societe}`}
                                    title="Générer Devis PDF"
                                    className="p-1 rounded hover:bg-emerald-50 text-emerald-700"
                                  >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onOpenAssist && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenAssist(f)}
                                    aria-label={`Enrichissement Assisté ${f.societe}`}
                                    title="Enrichissement Assisté (Coller Google / IA)"
                                    className="p-1 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canSuperviseTeam && onAssignFiche && (
                                  <button
                                    type="button"
                                    onClick={() => onAssignFiche(f)}
                                    aria-label={`Attribuer ${f.societe}`}
                                    title={
                                      f.statut === 'Signé Orange Pro'
                                        ? 'Réattribuer cette fiche à un collaborateur'
                                        : 'Attribuer cette fiche à un collaborateur'
                                    }
                                    className="p-1 rounded hover:bg-orange-50 text-orange-700"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canSuperviseTeam &&
                                  f.statut === 'Signé Orange Pro' &&
                                  onRestoreFiche && (
                                    <button
                                      type="button"
                                      onClick={() => onRestoreFiche(f)}
                                      aria-label={`Restituer ${f.societe}`}
                                      title="Restituer / déverrouiller cette fiche signée"
                                      className="p-1 rounded hover:bg-violet-50 text-violet-700"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenAiBrief(f)}
                                aria-label={`Brief IA ${f.societe}`}
                                title="Brief Commercial IA"
                                className="px-1.5 py-0.5 rounded bg-stone-900 hover:bg-stone-800 text-orange-300 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                              >
                                <Bot className="w-3 h-3" />
                                Brief IA
                              </button>
                            </div>

                            <div className="flex items-center gap-1">
                              {prevStage && (
                                <button
                                  type="button"
                                  onClick={() => onMoveFiche(f.id, prevStage)}
                                  aria-label={`Reculer ${f.societe} vers ${prevStage}`}
                                  title={`Déplacer vers « ${prevStage} »`}
                                  className="p-1 rounded border border-stone-200 bg-stone-50 hover:bg-stone-200 text-stone-600 shrink-0"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                              )}
                              <select
                                aria-label={`Déplacer ${f.societe} vers une étape`}
                                value={f.statut}
                                onChange={(e) => onMoveFiche(f.id, e.target.value as StatutCRM)}
                                className="flex-1 min-w-0 text-[11px] font-medium bg-stone-50 border border-stone-200 rounded-md px-1.5 py-1 text-stone-700 focus:outline-none focus:border-orange-500"
                              >
                                {KANBAN_STAGES.map((s) => (
                                  <option key={s.statut} value={s.statut}>
                                    {s.shortLabel}
                                  </option>
                                ))}
                              </select>
                              {nextStage && (
                                <button
                                  type="button"
                                  onClick={() => onMoveFiche(f.id, nextStage)}
                                  aria-label={`Avancer ${f.societe} vers ${nextStage}`}
                                  title={`Déplacer vers « ${nextStage} »`}
                                  className="p-1 rounded border border-stone-200 bg-stone-50 hover:bg-orange-100 hover:border-orange-300 text-stone-700 hover:text-orange-800 shrink-0"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
