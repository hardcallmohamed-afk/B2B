import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, Lock, ShieldCheck, X } from 'lucide-react';
import {
  ORANGE_PRO_PRODUCTS,
  computeDefaultPayoutMad,
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
}

interface SignContractModalProps {
  target: SignContractTarget | null;
  isSuperAdmin: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    produitOrangePro: string;
    tier: OrangeProTier;
    payoutMad: number;
  }) => Promise<void>;
}

export const SignContractModal: React.FC<SignContractModalProps> = ({
  target,
  isSuperAdmin,
  submitting,
  onClose,
  onConfirm,
}) => {
  const [selectedProduit, setSelectedProduit] = useState('');
  const [tier, setTier] = useState<OrangeProTier>('PME');
  const [payoutMad, setPayoutMad] = useState<number>(1500);

  useEffect(() => {
    if (!target) return;
    const matched =
      ORANGE_PRO_PRODUCTS.find((p) => p.label === target.suggestedProduit) ||
      ORANGE_PRO_PRODUCTS.find((p) => p.tier === target.suggestedTier) ||
      ORANGE_PRO_PRODUCTS[2];
    setSelectedProduit(matched.label);
    setTier(matched.tier);
    setPayoutMad(computeDefaultPayoutMad(matched.tier, target.effectif, matched.label));
  }, [target]);

  if (!target) return null;

  const handleProductChange = (label: string) => {
    setSelectedProduit(label);
    const matched = ORANGE_PRO_PRODUCTS.find((p) => p.label === label);
    const nextTier = matched ? matched.tier : tier;
    setTier(nextTier);
    setPayoutMad(computeDefaultPayoutMad(nextTier, target.effectif, label));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      produitOrangePro: selectedProduit.trim() || 'Pack Orange Pro',
      tier,
      payoutMad: Math.max(0, Math.round(Number(payoutMad) || 0)),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-contract-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4">
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
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-stone-700">
              Produit Orange Pro souscrit
            </label>
            <select
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
              <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                Gamme tarifaire
              </label>
              <select
                value={tier}
                onChange={(e) => {
                  const nextTier = e.target.value as OrangeProTier;
                  setTier(nextTier);
                  setPayoutMad(computeDefaultPayoutMad(nextTier, target.effectif, selectedProduit));
                }}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-orange-500 focus:outline-none"
              >
                <option value="TPE / Libéral">TPE / Libéral</option>
                <option value="PME">PME</option>
                <option value="Grand Compte">Grand Compte</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-stone-700">
                Payout commission (MAD)
              </label>
              {isSuperAdmin ? (
                <input
                  type="number"
                  min={0}
                  max={10000000}
                  step={50}
                  value={payoutMad}
                  onChange={(e) => setPayoutMad(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-bold text-emerald-700 tabular-nums focus:border-orange-500 focus:outline-none"
                  required
                />
              ) : (
                <div className="flex h-[42px] items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 tabular-nums">
                  <span>{formatMad(payoutMad)}</span>
                  <span className="text-[11px] font-medium text-emerald-700">Barème auto</span>
                </div>
              )}
            </div>
          </div>

          {!isSuperAdmin ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="leading-relaxed">
                <strong>Verrouillage après signature :</strong> dès validation, la fiche client est
                automatiquement retirée de votre portefeuille et verrouillée pour la confidentialité.
                Vous continuerez à voir votre <strong>payout ({formatMad(payoutMad)})</strong>, votre
                <strong> nombre de contrats</strong> et le <strong>produit Orange Pro</strong> dans
                l’onglet <em>Équipe &amp; Payouts</em>.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p className="leading-relaxed">
                En tant que <strong>Super-Admin</strong>, le contrat sera enregistré dans le registre
                des payouts et restera consultable et modifiable à tout moment.
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
