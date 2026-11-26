import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import type { FicheEntreprise } from '../App';
import { validateRdvRequirements } from '../utils/activiteHelpers';
import { saveFicheActivite } from '../firebase';

interface RdvModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiche: FicheEntreprise | null;
  currentUserName: string;
  currentUserUid: string;
  onRdvConfirmed: (updatedFiche: FicheEntreprise) => void;
  onNotify: (msg: string, type?: 'ok' | 'err' | 'warn' | 'info') => void;
}

export const RdvModal: React.FC<RdvModalProps> = ({
  isOpen,
  onClose,
  fiche,
  currentUserName,
  currentUserUid,
  onRdvConfirmed,
  onNotify,
}) => {
  const [rdvAt, setRdvAt] = useState('');
  const [rdvLieu, setRdvLieu] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fiche) {
      // Default to tomorrow at 10:00 local time if empty
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const isoLocal = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);

      setRdvAt(fiche.rdvAt ? fiche.rdvAt.slice(0, 16) : isoLocal);
      setRdvLieu(fiche.rdvLieu || (fiche.ville ? `Siège de l'entreprise à ${fiche.ville}` : ''));
      setNote('');
      setErrorMessage(null);
    }
  }, [isOpen, fiche]);

  if (!isOpen || !fiche) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateRdvRequirements(rdvAt, rdvLieu);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Date et lieu de rendez-vous obligatoires.');
      return;
    }

    const cleanRdvAt = validation.normalizedDate!;
    const cleanRdvLieu = validation.normalizedLieu!;
    const auteur = currentUserName.trim().slice(0, 120) || 'Commercial DIVERSIFIA';
    const activiteId = `act_rdv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      // Enregistrer l'activité officielle type 'rdv'
      await saveFicheActivite(currentUserUid, fiche.id, {
        id: activiteId,
        ownerId: currentUserUid,
        ficheId: fiche.id,
        type: 'rdv',
        resultat: 'rdv_fixe',
        texte: note.trim().slice(0, 1000) || `Rendez-vous fixé pour le ${new Date(cleanRdvAt).toLocaleString('fr-FR')} à ${cleanRdvLieu}.`,
        auteurNom: auteur,
        rdvAt: cleanRdvAt,
        rdvLieu: cleanRdvLieu,
      });

      const updatedFiche: FicheEntreprise = {
        ...fiche,
        statut: 'RDV pris',
        statutUpdatedAt: nowIso,
        rdvAt: cleanRdvAt,
        rdvLieu: cleanRdvLieu,
      };

      onRdvConfirmed(updatedFiche);
      onNotify(`Rendez-vous planifié avec succès pour « ${fiche.societe} ».`, 'ok');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la fixation du rendez-vous.';
      setErrorMessage(msg);
      onNotify('Échec de la validation du rendez-vous.', 'err');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rdv-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-lg bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-orange-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500 text-white rounded-lg shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 id="rdv-modal-title" className="text-base font-bold text-stone-900 leading-tight">
                Fixer le Rendez-vous Client
              </h3>
              <p className="text-xs text-orange-900/80 font-medium truncate max-w-xs sm:max-w-md">
                Passage en statut « RDV pris » · {fiche.societe}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-600 flex items-start gap-2.5">
            <Building2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-stone-900">{fiche.societe}</p>
              <p className="text-[11px] text-stone-500">
                Contact : {fiche.contact || 'Décideur'} · Tél : {fiche.telephone || 'Non renseigné'}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date & Heure (Strictement Obligatoire) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Date & Heure précises du RDV <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                required
                value={rdvAt}
                onChange={(e) => setRdvAt(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium text-stone-800"
              />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">
              Règle CRM : un prospect ne peut pas être placé en « RDV pris » sans date et heure fixées.
            </p>
          </div>

          {/* Lieu ou modalité (Strictement Obligatoire) */}
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1">
              Lieu, adresse ou visio <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                maxLength={160}
                placeholder="Ex : Bureau client à Casablanca, Tour CFC, ou Visio Google Meet"
                value={rdvLieu}
                onChange={(e) => setRdvLieu(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-medium text-stone-800"
              />
            </div>
          </div>

          {/* Note préparatoire facultative */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Objectif ou notes préparatoires (optionnel)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Ex : Présentation offre Fibre Pro + audit des lignes mobiles actuelles."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Pied */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 rounded-lg hover:bg-stone-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Validation...' : 'Confirmer le Rendez-vous'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
