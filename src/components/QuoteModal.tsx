import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Building2,
  DollarSign,
  Calendar,
} from 'lucide-react';
import {
  getOrangeProRecommendation,
  type FicheEntreprise,
  type StatutCRM,
} from '../utils/crmDomain';
import { ORANGE_PRO_PRODUCTS, type OrangeProTier } from '../utils/gamification';
import { generateClientQuotePdf } from '../utils/pdfGenerator';
import { saveFicheActivite, saveFicheAuditLog } from '../firebase';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiche: FicheEntreprise | null;
  currentUserName: string;
  currentUserUid: string;
  ficheOwnerUid?: string;
  actorUid?: string;
  actorRole?: string;
  commercialEmail?: string;
  commercialPhone?: string;
  workspaceLegal?: {
    raisonSociale?: string;
    ice?: string;
    adresse?: string;
    telephone?: string;
  };
  onFicheUpdated: (updatedFiche: FicheEntreprise) => void;
  onNotify: (msg: string, type?: 'ok' | 'err' | 'warn' | 'info') => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  isOpen,
  onClose,
  fiche,
  currentUserName,
  currentUserUid,
  ficheOwnerUid,
  actorUid,
  actorRole,
  commercialEmail,
  commercialPhone,
  workspaceLegal,
  onFicheUpdated,
  onNotify,
}) => {
  const [selectedProduct, setSelectedProduct] = useState(
    ORANGE_PRO_PRODUCTS[0]?.label || 'Pack Fibre Pro + Mobile'
  );
  const [quantiteFixe, setQuantiteFixe] = useState(1);
  const [quantiteMobile, setQuantiteMobile] = useState(3);
  const [prixMensuelMad, setPrixMensuelMad] = useState<number | ''>('');
  const [validityDays, setValidityDays] = useState(15);
  const [passToDevisEnvoye, setPassToDevisEnvoye] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fiche) {
      const reco = getOrangeProRecommendation(fiche);
      setSelectedProduct(reco.offre);
      setQuantiteFixe(reco.tier === 'Grand Compte' ? 4 : reco.tier === 'PME' ? 2 : 1);
      setQuantiteMobile(reco.tier === 'Grand Compte' ? 20 : reco.tier === 'PME' ? 8 : 3);
      setPrixMensuelMad('');
      setValidityDays(15);
      setPassToDevisEnvoye(fiche.statut !== 'Signé Orange Pro');
      setErrorMessage(null);
    }
  }, [isOpen, fiche]);

  if (!isOpen || !fiche) return null;

  const reco = getOrangeProRecommendation(fiche);

  const handleDownloadAndLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const safeFixe = Math.max(0, Number(quantiteFixe) || 0);
    const safeMobile = Math.max(0, Number(quantiteMobile) || 0);
    if (safeFixe + safeMobile < 1) {
      setErrorMessage('Veuillez renseigner au moins 1 ligne fixe/fibre ou 1 ligne mobile.');
      return;
    }

    const monthlyPrice = Number(prixMensuelMad);
    if (isNaN(monthlyPrice) || monthlyPrice <= 0) {
      setErrorMessage('Veuillez saisir un prix mensuel MAD valide (ex: 649 ou 1450).');
      return;
    }

    setIsGenerating(true);
    try {
      const selectedProductMeta = ORANGE_PRO_PRODUCTS.find((p) => p.label === selectedProduct);
      const effectiveTier: OrangeProTier = selectedProductMeta?.tier || reco.tier;

      // 1. Générer et télécharger le PDF client (Zero commission)
      generateClientQuotePdf({
        fiche,
        produitOrangePro: selectedProduct,
        tier: effectiveTier,
        quantiteFixe: safeFixe,
        quantiteMobile: safeMobile,
        prixMensuelMad: monthlyPrice,
        validityDays,
        commercialName: currentUserName,
        commercialEmail,
        commercialPhone,
        workspaceLegal,
      });

      // 2. Enregistrer l'activité type 'devis' et l'audit_log dans la sous-collection
      const activiteId = `act_devis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const auteur = currentUserName.trim().slice(0, 120) || 'Commercial';

      const effectiveOwnerUid = ficheOwnerUid || currentUserUid;
      await saveFicheActivite(effectiveOwnerUid, fiche.id, {
        id: activiteId,
        ownerId: effectiveOwnerUid,
        ficheId: fiche.id,
        type: 'devis',
        resultat: 'autre',
        texte: `Devis client généré : ${selectedProduct} (${safeFixe} fix. / ${safeMobile} mob. · ${monthlyPrice.toLocaleString('fr-FR')} MAD HT/mois). Validité : ${validityDays} jours.`,
        auteurNom: auteur,
        auteurUid: actorUid || currentUserUid,
        auteurRole: actorRole,
        createdAtIso: nowIso,
      });

      void saveFicheAuditLog(effectiveOwnerUid, fiche.id, {
        ownerId: effectiveOwnerUid,
        ficheId: fiche.id,
        action: 'updated',
        field: 'devis_pdf',
        oldValue: fiche.statut,
        newValue: `${selectedProduct} (${monthlyPrice} MAD HT/mois)`,
        summary: `Devis PDF généré : ${selectedProduct} (${monthlyPrice} MAD HT/mois)`,
        actorUid: actorUid || currentUserUid,
        actorName: auteur,
        actorRole: actorRole || 'commercial',
        createdAtIso: nowIso,
      }).catch(() => {});

      // 3. Mettre à jour éventuellement la fiche en 'Devis envoyé' si demandé (sans jamais rétrograder un contrat signé)
      let updatedFiche = { ...fiche };
      if (
        passToDevisEnvoye &&
        fiche.statut !== 'Devis envoyé' &&
        fiche.statut !== 'Signé Orange Pro'
      ) {
        updatedFiche = {
          ...fiche,
          statut: 'Devis envoyé' as StatutCRM,
          statutUpdatedAt: nowIso,
        };
        onFicheUpdated(updatedFiche);
      }

      onNotify('Devis client PDF généré et téléchargé avec succès !', 'ok');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération du devis PDF.';
      setErrorMessage(msg);
      onNotify('Échec de la génération du devis.', 'err');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-600 text-white rounded-lg shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="quote-modal-title" className="text-base font-bold leading-tight">
                Préparer un Devis Client Orange Pro
              </h3>
              <p className="text-xs text-orange-300 font-mono">
                {fiche.societe} · {reco.tier}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-300 hover:text-white hover:bg-stone-800 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <form onSubmit={handleDownloadAndLog} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-[11px] text-amber-900">
            <strong>Règle de conformité :</strong> Le document PDF téléchargé intègre les informations légales de votre workspace et le tarif client saisi (HT, TVA 20% &amp; TTC). Aucune commission commerciale n’y figure jamais.
          </div>

          {/* Choix de l'offre Orange Pro */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1">
              Offre Orange Pro / Solution Entreprise
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500 font-medium"
            >
              {ORANGE_PRO_PRODUCTS.map((prod) => (
                <option key={prod.label} value={prod.label}>
                  {prod.label} ({prod.tier})
                </option>
              ))}
            </select>
          </div>

          {/* Quantités fixes et mobiles */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Lignes Fixes / Fibre (0 si mobile seul)
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={quantiteFixe}
                onChange={(e) => setQuantiteFixe(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Lignes Mobiles Illimitées (0 si fibre seule)
              </label>
              <input
                type="number"
                min={0}
                max={5000}
                value={quantiteMobile}
                onChange={(e) => setQuantiteMobile(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Prix mensuel MAD */}
          <div>
            <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-orange-600" />
              <span>Prix Mensuel Client HT (en MAD) <span className="text-red-500">*</span></span>
            </label>
            <input
              type="number"
              min={1}
              max={1000000}
              step={1}
              required
              placeholder="Ex : 649 ou 1450"
              value={prixMensuelMad}
              onChange={(e) => setPrixMensuelMad(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-mono font-bold text-stone-900"
            />
            <p className="text-[10px] text-stone-500 mt-1">
              Tarif libre négocié avec le client prospect (TVA 20% et TTC calculés automatiquement sur le PDF).
            </p>
          </div>

          {/* Validité du devis */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <span>Durée de validité du devis</span>
            </label>
            <select
              value={validityDays}
              onChange={(e) => setValidityDays(Number(e.target.value) || 15)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            >
              <option value={10}>10 jours</option>
              <option value={15}>15 jours (Standard)</option>
              <option value={30}>30 jours</option>
              <option value={60}>60 jours</option>
            </select>
          </div>

          {/* Option passage auto en Devis envoyé */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="passToDevis"
              checked={passToDevisEnvoye}
              onChange={(e) => setPassToDevisEnvoye(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500"
            />
            <label htmlFor="passToDevis" className="text-xs text-stone-700 font-medium">
              Passer automatiquement la fiche prospect au statut « Devis envoyé »
            </label>
          </div>

          {/* Pied */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Génération PDF...' : 'Télécharger le Devis PDF & Logger'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
