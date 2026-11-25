import React, { useMemo, useState } from 'react';
import {
  GripVertical,
  Phone,
  MessageSquare,
  Mail,
  Sparkles,
  Bot,
  Users,
} from 'lucide-react';
import {
  SECTEURS_META,
  SEGMENTS_COULEUR,
  computeMaturityScore,
  getOrangeProRecommendation,
  type FicheEntreprise,
  type StatutCRM,
} from '../App';
import { KANBAN_STAGES, groupFichesByStatut } from '../utils/analytics';

interface KanbanBoardProps {
  fiches: FicheEntreprise[];
  verifyingId: string | null;
  onMoveFiche: (ficheId: string, targetStatut: StatutCRM) => void;
  onOpenEmail: (fiche: FicheEntreprise) => void;
  onVerifyOne: (fiche: FicheEntreprise) => void;
  onOpenAiBrief: (fiche: FicheEntreprise) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  fiches,
  verifyingId,
  onMoveFiche,
  onOpenEmail,
  onVerifyOne,
  onOpenAiBrief,
}) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StatutCRM | null>(null);

  const columns = useMemo(() => groupFichesByStatut(fiches), [fiches]);

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
            Glissez une carte d&apos;une colonne à l&apos;autre (ou utilisez le sélecteur d&apos;étape) pour mettre à jour le statut CRM et la tendance KPI.
          </p>
        </div>
        <div className="text-xs text-stone-500 tabular-nums">
          {fiches.length} fiche(s) affichée(s) · 6 étapes
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 min-w-0 xl:min-w-[1260px] items-start">
          {columns.map((col) => {
            const isOver = dragOverStage === col.meta.statut;
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
                    <span
                      data-testid={`kanban-count-${col.meta.statut}`}
                      className="text-xs font-bold text-stone-900 tabular-nums shrink-0"
                    >
                      {col.items.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-stone-500 tabular-nums">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-stone-400" />
                      {col.totalEffectif > 0 ? `${col.totalEffectif} sal.` : '—'}
                    </span>
                    <span>Mat. {col.avgMaturity}%</span>
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
                      {isOver ? 'Déposer ici' : 'Glisser une fiche ici'}
                    </div>
                  ) : (
                    col.items.map((f) => {
                      const secMeta = SECTEURS_META[f.secteur];
                      const segMeta = SEGMENTS_COULEUR[secMeta.couleur];
                      const reco = getOrangeProRecommendation(f);
                      const mat = computeMaturityScore(f);
                      const isDragging = draggingId === f.id;
                      const waPhone = f.telephone ? `212${f.telephone.replace(/^0/, '')}` : '';

                      return (
                        <article
                          key={f.id}
                          draggable
                          data-testid={`kanban-card-${f.id}`}
                          onDragStart={(e) => handleDragStart(e, f.id)}
                          onDragEnd={handleDragEnd}
                          className={`relative overflow-hidden rounded-lg bg-white border border-stone-200 p-2.5 transition-all cursor-grab active:cursor-grabbing hover:border-stone-400 ${
                            isDragging ? 'opacity-45 scale-[0.98] ring-2 ring-orange-400' : ''
                          }`}
                        >
                          <span
                            className={`absolute inset-x-0 top-0 h-[2.5px] ${segMeta.dotCls}`}
                            aria-hidden="true"
                          />

                          {/* Titre + poignée drag */}
                          <div className="flex items-start justify-between gap-1.5 pt-0.5">
                            <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                              {f.societe}
                            </h4>
                            <GripVertical
                              className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          </div>

                          {/* Métadonnées propres sans pilules */}
                          <p className="text-[11px] text-stone-500 mt-1 truncate">
                            {f.ville || 'Maroc'} · {secMeta.label}
                          </p>

                          {/* Décideur & Téléphone */}
                          <div className="mt-2 pt-2 border-t border-stone-100 space-y-0.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-stone-700 font-medium truncate">
                                {f.contact || 'Décideur à identifier'}
                              </span>
                              {f.effectif && (
                                <span className="text-stone-500 tabular-nums shrink-0">
                                  {f.effectif} sal.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-stone-600 font-mono tabular-nums">
                              <span className="truncate">{f.telephone || 'Tél. manquant'}</span>
                              <span className="font-sans text-[10px] font-semibold text-orange-700 shrink-0">
                                {reco.tier}
                              </span>
                            </div>
                          </div>

                          {/* Barre de maturité */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  mat >= 80
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

                          {/* Actions rapides + Déplacement accessible */}
                          <div className="mt-2.5 pt-2 border-t border-stone-100 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-0.5">
                                {f.telephone && (
                                  <a
                                    href={`tel:${f.telephone}`}
                                    aria-label={`Appeler ${f.societe}`}
                                    title={`Appeler ${f.telephone}`}
                                    className="p-1 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900"
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {waPhone && (
                                  <a
                                    href={`https://wa.me/${waPhone}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`WhatsApp ${f.societe}`}
                                    title="WhatsApp Pro"
                                    className="p-1 rounded hover:bg-emerald-50 text-emerald-700"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenEmail(f)}
                                  aria-label={`Studio Email ${f.societe}`}
                                  title="Studio Email IA"
                                  className="p-1 rounded hover:bg-sky-50 text-sky-700"
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

                            <select
                              aria-label={`Déplacer ${f.societe} vers une étape`}
                              value={f.statut}
                              onChange={(e) => onMoveFiche(f.id, e.target.value as StatutCRM)}
                              className="w-full text-[11px] font-medium bg-stone-50 border border-stone-200 rounded-md px-2 py-1 text-stone-700 focus:outline-none focus:border-orange-500"
                            >
                              {KANBAN_STAGES.map((s) => (
                                <option key={s.statut} value={s.statut}>
                                  {s.shortLabel}
                                </option>
                              ))}
                            </select>
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
