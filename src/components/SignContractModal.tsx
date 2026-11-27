import React, { useEffect, useMemo, useState } from 'react';
import { Award, Calculator, CheckCircle2, Lock, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  COMMISSION_SECTOR_PROFILES,
  DIVERSIFIA_FIXE_LINES,
  DIVERSIFIA_MOBILE_FORFAITS,
  ORANGE_PRO_PRODUCTS,
  buildDefaultForecastParams,
  calculateForecastCommission,
  formatMad,
  type OrangeProTier,
} from '../utils/gamification';

export interface SignContractTarget {
  id: string;
  numeroFiche?: string;
  societe: string;
  ville: string;
  secteur: string;
  effectif: string;
  suggestedTier: OrangeProTier;
  suggestedProduit: string;
  ownerUid?: string;
  ownerDisplayName?: string;
}

interface SignContractModalProps {
  target: SignContractTarget | null;
  isSuperAdmin: boolean;
  canSetInitialPayout?: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    produitOrangePro: string;
    tier: OrangeProTier;
    payoutMad: number;
    secteur?: string;
    effectif?: string;
  }) => Promise<void>;
}

export const SignContractModal: React.FC<SignContractModalProps> = ({
  target,
  isSuperAdmin,
  canSetInitialPayout,
  submitting,
  onClose,
  onConfirm,
}) => {
  const allowsInitialPayout = canSetInitialPayout ?? isSuperAdmin;
  const [selectedProduit, setSelectedProduit] = useState('');
  const [tier, setTier] = useState<OrangeProTier>('PME');
  const [payoutMad, setPayoutMad] = useState<number>(1500);

  // Calculateur de commission prévisionnelle (Secteur + Effectif + Grille DIVERSIFIA)
  const [calcSecteur, setCalcSecteur] = useState<string>('pme');
  const [calcEffectif, setCalcEffectif] = useState<number>(10);
  const [calcEffectifEstimated, setCalcEffectifEstimated] = useState<boolean>(false);
  const [fixeLineId, setFixeLineId] = useState<string>('ftth_100');
  const [fixeQty, setFixeQty] = useState<number>(1);
  const [mobileForfaitId, setMobileForfaitId] = useState<string>('illimite_na');
  const [mobileQty, setMobileQty] = useState<number>(2);
  const [autoSyncPayout, setAutoSyncPayout] = useState<boolean>(true);

  useEffect(() => {
    if (!target) return;
    const defaults = buildDefaultForecastParams(target.secteur, target.effectif);
    const initialBreakdown = calculateForecastCommission(defaults);

    const matched =
      ORANGE_PRO_PRODUCTS.find((p) => p.label === target.suggestedProduit) ||
      ORANGE_PRO_PRODUCTS.find((p) => p.tier === initialBreakdown.recommendedTier) ||
      ORANGE_PRO_PRODUCTS.find((p) => p.tier === target.suggestedTier) ||
      ORANGE_PRO_PRODUCTS[2];

    setCalcSecteur(defaults.secteur);
    setCalcEffectif(defaults.effectifNum);
    setCalcEffectifEstimated(defaults.isEffectifEstimated);
    setFixeLineId(defaults.fixeLineId);
    setFixeQty(defaults.fixeQty);
    setMobileForfaitId(defaults.mobileForfaitId);
    setMobileQty(defaults.mobileQty);
    setAutoSyncPayout(true);

    setSelectedProduit(matched.label);
    setTier(initialBreakdown.recommendedTier);
    setPayoutMad(initialBreakdown.totalCommissionMad);
  }, [target]);

  const forecast = useMemo(
    () =>
      calculateForecastCommission({
        secteur: calcSecteur,
        effectifNum: calcEffectif,
        isEffectifEstimated: calcEffectifEstimated,
        fixeLineId,
        fixeQty,
        mobileForfaitId,
        mobileQty,
      }),
    [calcSecteur, calcEffectif, calcEffectifEstimated, fixeLineId, fixeQty, mobileForfaitId, mobileQty]
  );

  useEffect(() => {
    if (!target || !autoSyncPayout) return;
    setPayoutMad(forecast.totalCommissionMad);
    setTier(forecast.recommendedTier);
  }, [target, autoSyncPayout, forecast.totalCommissionMad, forecast.recommendedTier]);

  if (!target) return null;

  const applyRecommendedFromSectorEffectif = (nextSecteur: string, nextEffectif: number) => {
    const rec = buildDefaultForecastParams(nextSecteur, String(Math.max(1, nextEffectif)));
    setCalcSecteur(rec.secteur);
    setCalcEffectif(rec.effectifNum);
    setCalcEffectifEstimated(false);
    setFixeLineId(rec.fixeLineId);
    setFixeQty(rec.fixeQty);
    setMobileForfaitId(rec.mobileForfaitId);
    setMobileQty(rec.mobileQty);
    setAutoSyncPayout(true);
  };

  const handleProductChange = (label: string) => {
    setSelectedProduit(label);
    const matched = ORANGE_PRO_PRODUCTS.find((p) => p.label === label);
    if (matched) {
      setTier(matched.tier);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      produitOrangePro: selectedProduit.trim() || forecast.summaryLabel || 'Pack Orange Pro',
      tier,
      payoutMad: Math.max(0, Math.round(Number(payoutMad) || 0)),
      secteur: calcSecteur,
      effectif: String(Math.max(1, Math.round(calcEffectif) || 1)),
    });
  };

  const sectorOptions = Object.values(COMMISSION_SECTOR_PROFILES);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-contract-title"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-xs">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 id="sign-contract-title" className="text-base font-bold text-stone-900">
                Valider la signature Orange Pro
              </h3>
              <p className="text-xs text-stone-600">
                {target.numeroFiche ? `${target.numeroFiche} · ` : ''}
                {target.societe} ({target.ville || 'Maroc'})
                {target.ownerDisplayName ? ` · Portefeuille : ${target.ownerDisplayName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-200/70 hover:text-stone-800"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Calculateur de commission prévisionnelle basé sur le secteur et l'effectif */}
          <div
            data-testid="commission-forecast-calculator"
            className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-orange-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900">
                    Calculateur de commission prévisionnelle (Grille DIVERSIFIA)
                  </h4>
                  <p className="text-[11px] text-stone-600">
                    Estimation automatique selon le secteur d’activité et l’effectif de l’entreprise.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => applyRecommendedFromSectorEffectif(calcSecteur, calcEffectif)}
                className="inline-flex items-center gap-1 rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
                Recalculer auto
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label htmlFor="calc-secteur" className="mb-1 block text-[11px] font-semibold text-stone-700">
                  Secteur d’activité
                </label>
                <select
                  id="calc-secteur"
                  value={calcSecteur}
                  onChange={(e) => {
                    const nextSec = e.target.value;
                    applyRecommendedFromSectorEffectif(nextSec, calcEffectif);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                >
                  {sectorOptions.map((sec) => (
                    <option key={sec.secteur} value={sec.secteur}>
                      {sec.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="calc-effectif" className="mb-1 flex items-center justify-between text-[11px] font-semibold text-stone-700">
                  <span>Effectif entreprise (salariés)</span>
                  {calcEffectifEstimated && (
                    <span className="text-[10px] font-medium text-amber-700">Estimé secteur</span>
                  )}
                </label>
                <input
                  id="calc-effectif"
                  type="number"
                  min={1}
                  max={5000}
                  value={calcEffectif}
                  onChange={(e) => {
                    const nextEff = Math.max(1, Math.min(5000, Number(e.target.value) || 1));
                    applyRecommendedFromSectorEffectif(calcSecteur, nextEff);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold tabular-nums text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label htmlFor="calc-fixe-line" className="mb-1 block text-[11px] font-semibold text-stone-700">
                  Fibre / Box / Fixe
                </label>
                <select
                  id="calc-fixe-line"
                  value={fixeLineId}
                  onChange={(e) => {
                    setFixeLineId(e.target.value);
                    setAutoSyncPayout(true);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                >
                  {DIVERSIFIA_FIXE_LINES.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.label} ({line.commissionTotal} DH)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="calc-fixe-qty" className="mb-1 block text-[11px] font-semibold text-stone-700">
                  Qté
                </label>
                <input
                  id="calc-fixe-qty"
                  type="number"
                  min={0}
                  max={50}
                  value={fixeQty}
                  onChange={(e) => {
                    setFixeQty(Math.max(0, Math.min(50, Number(e.target.value) || 0)));
                    setAutoSyncPayout(true);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-semibold tabular-nums text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label htmlFor="calc-mobile-forfait" className="mb-1 block text-[11px] font-semibold text-stone-700">
                  Forfait Mobile
                </label>
                <select
                  id="calc-mobile-forfait"
                  value={mobileForfaitId}
                  onChange={(e) => {
                    setMobileForfaitId(e.target.value);
                    setAutoSyncPayout(true);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none"
                >
                  {DIVERSIFIA_MOBILE_FORFAITS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.commissionTotal} DH)
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="calc-mobile-qty" className="mb-1 block text-[11px] font-semibold text-stone-700">
                  Lignes mob.
                </label>
                <input
                  id="calc-mobile-qty"
                  type="number"
                  min={0}
                  max={200}
                  value={mobileQty}
                  onChange={(e) => {
                    setMobileQty(Math.max(0, Math.min(200, Number(e.target.value) || 0)));
                    setAutoSyncPayout(true);
                  }}
                  className="w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-semibold tabular-nums text-stone-900 focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Synthèse chiffrée prévisionnelle + échéancier 1ère / 4ème facture */}
            <div className="grid grid-cols-3 gap-2 border-t border-orange-200/80 pt-3">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Payout prévisionnel
                </span>
                <span
                  data-testid="forecast-total-mad"
                  className="text-base font-bold text-emerald-700 tabular-nums"
                >
                  {formatMad(forecast.totalCommissionMad)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  1ère facture
                </span>
                <span
                  data-testid="forecast-first-invoice-mad"
                  className="text-sm font-bold text-stone-900 tabular-nums"
                >
                  {formatMad(forecast.firstInvoiceMad)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  4ème facture
                </span>
                <span
                  data-testid="forecast-fourth-invoice-mad"
                  className="text-sm font-bold text-stone-900 tabular-nums"
                >
                  {formatMad(forecast.fourthInvoiceMad)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
              <span className="truncate">
                Mix estimé : <strong className="text-stone-800">{forecast.summaryLabel}</strong>
              </span>
              {!autoSyncPayout && (
                <button
                  type="button"
                  onClick={() => {
                    setAutoSyncPayout(true);
                    setPayoutMad(forecast.totalCommissionMad);
                    setTier(forecast.recommendedTier);
                  }}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Appliquer {formatMad(forecast.totalCommissionMad)}
                </button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="contract-produit-select" className="mb-1.5 block text-xs font-semibold text-stone-700">
              Produit Orange Pro souscrit
            </label>
            <select
              id="contract-produit-select"
              value={selectedProduit}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              required
            >
              {ORANGE_PRO_PRODUCTS.map((prod) => (
                <option key={prod.label} value={prod.label}>
                  [{prod.tier}] {prod.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="contract-tier-select" className="mb-1.5 block text-xs font-semibold text-stone-700">
                Gamme tarifaire
              </label>
              <select
                id="contract-tier-select"
                value={tier}
                onChange={(e) => {
                  const nextTier = e.target.value as OrangeProTier;
                  setTier(nextTier);
                  setAutoSyncPayout(false);
                }}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
              >
                <option value="TPE / Libéral">TPE / Libéral</option>
                <option value="PME">PME</option>
                <option value="Grand Compte">Grand Compte</option>
              </select>
            </div>

            <div>
              <label htmlFor="contract-payout-input" className="mb-1.5 block text-xs font-semibold text-stone-700">
                {allowsInitialPayout ? 'Payout commission retenu (MAD)' : 'Payout commission prévisionnel (MAD)'}
              </label>
              {allowsInitialPayout ? (
                <input
                  id="contract-payout-input"
                  type="number"
                  min={0}
                  max={10000000}
                  step={1}
                  value={payoutMad}
                  onChange={(e) => {
                    setAutoSyncPayout(false);
                    setPayoutMad(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 tabular-nums focus:border-orange-500 focus:outline-none"
                  required
                />
              ) : (
                <div className="flex h-[42px] items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 tabular-nums">
                  <span>{formatMad(payoutMad)}</span>
                  <span className="text-[11px] font-medium text-emerald-700">Soumis à validation (0 MAD initial)</span>
                </div>
              )}
            </div>
          </div>

          {!allowsInitialPayout ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="leading-relaxed">
                <strong>Validation &amp; verrouillage après signature :</strong> dès confirmation, la fiche client est
                verrouillée pour la confidentialité et le contrat est créé au statut{' '}
                <strong>« En attente » (0 MAD initial jusqu&apos;à validation de la commission prévisionnelle de {formatMad(payoutMad)} par votre Manager / Direction)</strong>.
                Vous suivez l&apos;état de validation et le versement en direct dans l’onglet <em>Équipe &amp; Payouts</em>.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="leading-relaxed">
                En tant que <strong>{isSuperAdmin ? 'Super-Admin' : 'Superviseur (Manager / Chef d’équipe)'}</strong>, la commission initiale de{' '}
                <strong>{formatMad(payoutMad)}</strong> sera directement enregistrée dans le registre des payouts{target.ownerDisplayName ? ` au bénéfice de ${target.ownerDisplayName}` : ''}.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Enregistrement...' : 'Confirmer la signature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
