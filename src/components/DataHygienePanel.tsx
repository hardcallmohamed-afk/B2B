import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileSignature,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { FicheEntreprise } from '../utils/crmDomain';
import type { SignedContractRecord } from '../utils/gamification';
import {
  HYGIENE_CATEGORY_META,
  analyzeDataHygiene,
  type HygieneAnomaly,
  type HygieneAnomalyCategory,
} from '../utils/dataHygiene';

interface DataHygienePanelProps {
  fiches: FicheEntreprise[];
  signedContracts: SignedContractRecord[];
  busy?: boolean;
  onApplySingleFix: (anomaly: HygieneAnomaly) => Promise<void> | void;
  onApplyAllSafeFixes: (safeAnomalies: HygieneAnomaly[]) => Promise<void> | void;
  onRegisterContractForFiche: (fiche: FicheEntreprise) => void;
  onReclassifyToNegotiation: (fiche: FicheEntreprise) => Promise<void> | void;
  onOpenFicheDetail: (fiche: FicheEntreprise) => void;
}

export const DataHygienePanel: React.FC<DataHygienePanelProps> = ({
  fiches,
  signedContracts,
  busy = false,
  onApplySingleFix,
  onApplyAllSafeFixes,
  onRegisterContractForFiche,
  onReclassifyToNegotiation,
  onOpenFicheDetail,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | HygieneAnomalyCategory>('all');

  const report = useMemo(
    () => analyzeDataHygiene(fiches, signedContracts),
    [fiches, signedContracts]
  );

  const ficheById = useMemo(() => {
    const map = new Map<string, FicheEntreprise>();
    for (const f of fiches) {
      map.set(f.id, f);
    }
    return map;
  }, [fiches]);

  const filteredAnomalies = useMemo(() => {
    if (categoryFilter === 'all') return report.anomalies;
    return report.anomalies.filter((a) => a.category === categoryFilter);
  }, [report.anomalies, categoryFilter]);

  const safeAnomalies = useMemo(
    () => report.anomalies.filter((a) => a.autoFixable),
    [report.anomalies]
  );

  return (
    <section
      data-testid="data-hygiene-panel"
      className="bg-white rounded-xl border border-stone-200 p-4 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              Hygiène &amp; Nettoyage Données CRM
            </h2>
            {report.isHealthy ? (
              <span
                data-testid="hygiene-healthy-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
              >
                <CheckCircle2 className="w-3 h-3" />
                Base saine
              </span>
            ) : (
              <span
                data-testid="hygiene-anomaly-count-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 tabular-nums"
              >
                <AlertTriangle className="w-3 h-3" />
                {report.anomalies.length} anomalie{report.anomalies.length > 1 ? 's' : ''} sur{' '}
                {report.affectedFichesCount} fiche{report.affectedFichesCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Détecte automatiquement les effectifs aberrants (&gt; 100 000), téléphones/emails mal formatés et fiches « Signé Orange Pro » sans contrat enregistré. Chaque correction est prévisualisée (Avant → Après) et journalisée dans l’audit fiche.
          </p>
        </div>

        {safeAnomalies.length > 0 && (
          <button
            type="button"
            disabled={busy}
            data-testid="hygiene-clean-all-safe-btn"
            onClick={() => void onApplyAllSafeFixes(safeAnomalies)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
          >
            {busy ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Nettoyer automatiquement les anomalies sûres ({safeAnomalies.length})
          </button>
        )}
      </div>

      {/* Compteurs par catégorie */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {(Object.keys(HYGIENE_CATEGORY_META) as HygieneAnomalyCategory[]).map((cat) => {
          const meta = HYGIENE_CATEGORY_META[cat];
          const count = report.countsByCategory[cat];
          const active = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter((prev) => (prev === cat ? 'all' : cat))}
              aria-pressed={active}
              data-testid={`hygiene-filter-${cat}`}
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                active
                  ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-300'
                  : 'border-stone-200 bg-stone-50/60 hover:bg-stone-100/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-stone-600 truncate">
                  {meta.label}
                </span>
                <span
                  className={`font-mono text-xs font-extrabold tabular-nums px-1.5 py-0.5 rounded ${
                    count === 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {report.isHealthy ? (
        <div className="p-6 text-center rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs font-medium text-emerald-900 flex flex-col items-center gap-1.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>
            Aucune anomalie détectée sur vos {fiches.length} fiche{fiches.length > 1 ? 's' : ''}. Effectifs, coordonnées et contrats signés sont cohérents.
          </span>
        </div>
      ) : filteredAnomalies.length === 0 ? (
        <div className="p-5 text-center rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
          Aucune anomalie dans cette catégorie.{' '}
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className="font-semibold text-orange-700 hover:underline"
          >
            Afficher toutes les anomalies ({report.anomalies.length})
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {categoryFilter !== 'all' && (
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>
                Filtre actif : <strong>{HYGIENE_CATEGORY_META[categoryFilter].label}</strong> (
                {filteredAnomalies.length})
              </span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="font-semibold text-orange-700 hover:underline"
              >
                Tout afficher
              </button>
            </div>
          )}

          {filteredAnomalies.map((anomaly) => {
            const meta = HYGIENE_CATEGORY_META[anomaly.category];
            const fiche = ficheById.get(anomaly.ficheId);

            return (
              <div
                key={anomaly.id}
                data-testid={`hygiene-row-${anomaly.id}`}
                className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.badgeCls}`}
                    >
                      {meta.shortLabel}
                    </span>
                    {anomaly.numeroFiche && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-700">
                        {anomaly.numeroFiche}
                      </span>
                    )}
                    <span className="font-bold text-stone-900 truncate">{anomaly.societe}</span>
                    {anomaly.ville && (
                      <span className="text-[11px] text-stone-500">· {anomaly.ville}</span>
                    )}
                  </div>

                  <p className="text-[11px] text-stone-600">{anomaly.reason}</p>

                  {/* Avant -> Après */}
                  <div className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px]">
                    <span className="text-stone-500 font-medium">Avant :</span>
                    <span className="font-mono text-red-700 line-through break-all">
                      {anomaly.beforeValue || '(vide)'}
                    </span>
                    <ArrowRight className="w-3 h-3 text-stone-400 shrink-0" />
                    <span className="text-stone-500 font-medium">Après :</span>
                    {anomaly.afterValue !== null ? (
                      <span className="font-mono font-bold text-emerald-800 break-all">
                        {anomaly.afterValue}
                      </span>
                    ) : (
                      <span className="italic text-amber-800 font-semibold">
                        Action manuelle requise
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {anomaly.autoFixable && (
                    <button
                      type="button"
                      disabled={busy}
                      data-testid={`hygiene-fix-btn-${anomaly.id}`}
                      onClick={() => void onApplySingleFix(anomaly)}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-50 px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                    >
                      <Wrench className="w-3 h-3 text-orange-400" />
                      Corriger
                    </button>
                  )}

                  {anomaly.category === 'signe_sans_contrat' && fiche && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        data-testid={`hygiene-register-contract-${fiche.id}`}
                        onClick={() => onRegisterContractForFiche(fiche)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                        Enregistrer le contrat
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        data-testid={`hygiene-reclassify-${fiche.id}`}
                        onClick={() => void onReclassifyToNegotiation(fiche)}
                        title="Repasse le statut de la fiche en « Devis envoyé » (négociation en cours)"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reclasser en Négociation
                      </button>
                    </>
                  )}

                  {fiche && (
                    <button
                      type="button"
                      onClick={() => onOpenFicheDetail(fiche)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Ouvrir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
