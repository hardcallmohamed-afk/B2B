import React, { useState, useEffect } from 'react';
import {
  X,
  PhoneCall,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  AlertCircle,
  History,
  MessageSquare,
  Mail,
  FileSpreadsheet,
} from 'lucide-react';
import type { FicheEntreprise } from '../App';
import {
  ACTIVITE_TYPE_META,
  ACTIVITE_RESULTAT_META,
  validateRdvRequirements,
  formatFriendlyDateFr,
} from '../utils/activiteHelpers';
import type { ActiviteType, ActiviteResultat, SanitizedActiviteDoc } from '../utils/firestoreSanitize';
import { saveFicheActivite, fetchFicheActivites } from '../firebase';

interface ActiviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiche: FicheEntreprise | null;
  currentUserName: string;
  currentUserUid: string;
  onFicheUpdated: (updatedFiche: FicheEntreprise) => void;
  onNotify: (msg: string, type?: 'ok' | 'err' | 'warn' | 'info') => void;
}

export const ActiviteModal: React.FC<ActiviteModalProps> = ({
  isOpen,
  onClose,
  fiche,
  currentUserName,
  currentUserUid,
  onFicheUpdated,
  onNotify,
}) => {
  const [type, setType] = useState<ActiviteType>('appel');
  const [resultat, setResultat] = useState<ActiviteResultat>('joint');
  const [texte, setTexte] = useState('');
  const [prochaineRelanceAt, setProchaineRelanceAt] = useState('');
  const [rdvAt, setRdvAt] = useState('');
  const [rdvLieu, setRdvLieu] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<SanitizedActiviteDoc[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fiche) {
      setType('appel');
      setResultat('joint');
      setTexte('');
      setProchaineRelanceAt('');
      setRdvAt(fiche.rdvAt ? fiche.rdvAt.slice(0, 16) : '');
      setRdvLieu(fiche.rdvLieu || fiche.ville || '');
      setErrorMessage(null);
      setIsLoadingHistory(true);
      fetchFicheActivites(currentUserUid, fiche.id)
        .then((items) => {
          setHistory(items || []);
        })
        .catch(() => {
          // Non bloquant
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    }
  }, [isOpen, fiche, currentUserUid]);

  if (!isOpen || !fiche) return null;

  const isRdvType = type === 'rdv' || resultat === 'rdv_fixe';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let cleanRdvAt: string | undefined;
    let cleanRdvLieu: string | undefined;

    if (isRdvType) {
      const rdvVal = validateRdvRequirements(rdvAt, rdvLieu);
      if (!rdvVal.valid) {
        setErrorMessage(rdvVal.error || 'Informations de RDV incomplètes');
        return;
      }
      cleanRdvAt = rdvVal.normalizedDate;
      cleanRdvLieu = rdvVal.normalizedLieu;
    }

    let cleanRelanceAt: string | undefined;
    if (prochaineRelanceAt) {
      const parsedRelance = new Date(prochaineRelanceAt);
      if (!isNaN(parsedRelance.getTime())) {
        cleanRelanceAt = parsedRelance.toISOString();
      }
    }

    const activiteId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const auteur = currentUserName.trim().slice(0, 120) || 'Commercial DIVERSIFIA';

    setIsSaving(true);
    try {
      await saveFicheActivite(currentUserUid, fiche.id, {
        id: activiteId,
        ownerId: currentUserUid,
        ficheId: fiche.id,
        type,
        resultat,
        texte: texte.trim().slice(0, 1000),
        auteurNom: auteur,
        prochaineRelanceAt: cleanRelanceAt,
        rdvAt: cleanRdvAt,
        rdvLieu: cleanRdvLieu,
      });

      // Mettre à jour l'état local de la fiche avec les miroirs
      const updated: FicheEntreprise = {
        ...fiche,
        ...(cleanRelanceAt !== undefined ? { prochaineRelanceAt: cleanRelanceAt } : {}),
        ...(cleanRdvAt !== undefined ? { rdvAt: cleanRdvAt } : {}),
        ...(cleanRdvLieu !== undefined ? { rdvLieu: cleanRdvLieu } : {}),
        ...(isRdvType ? { statut: 'RDV pris', statutUpdatedAt: new Date().toISOString() } : {}),
      };

      onFicheUpdated(updated);
      onNotify('Activité consignée avec succès dans le journal.', 'ok');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement de l’activité.';
      setErrorMessage(msg);
      onNotify('Échec de la sauvegarde de l’activité.', 'err');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* En-tête */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-100 text-orange-700 rounded-lg">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 id="activite-modal-title" className="text-base font-bold text-stone-900 leading-tight">
                Noter l’appel & Activité
              </h3>
              <p className="text-xs text-stone-500 truncate max-w-xs sm:max-w-md">
                {fiche.societe} · {fiche.contact || 'Contact direct'} ({fiche.telephone || 'Sans tél.'})
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Type d'interaction */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Type d’interaction
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(['appel', 'whatsapp', 'email', 'visite', 'note', 'rdv'] as ActiviteType[]).map((t) => {
                const meta = ACTIVITE_TYPE_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-2 py-2 rounded-lg border text-xs font-medium text-center transition-all ${
                      active
                        ? 'border-orange-500 bg-orange-50 text-orange-800 font-bold shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    {meta.label.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Résultat */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Résultat du contact
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                [
                  'joint',
                  'pas_de_reponse',
                  'rappeler',
                  'rdv_fixe',
                  'refus',
                  'autre',
                ] as ActiviteResultat[]
              ).map((r) => {
                const meta = ACTIVITE_RESULTAT_META[r];
                const active = resultat === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setResultat(r)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs text-left transition-all ${
                      active
                        ? 'border-stone-900 bg-stone-900 text-white font-semibold shadow-xs'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Champs RDV obligatoires si type=rdv ou resultat=rdv_fixe */}
          {isRdvType && (
            <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-orange-900">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span>Rendez-vous obligatoire (Date, heure et lieu)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Date & Heure du RDV *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={rdvAt}
                    onChange={(e) => setRdvAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Lieu / Adresse du RDV *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    placeholder="ex. Siège Casablanca ou Visio Teams"
                    value={rdvLieu}
                    onChange={(e) => setRdvLieu(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Prochaine relance facultative */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Prochaine relance recommandée (optionnel)
            </label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                type="datetime-local"
                value={prochaineRelanceAt}
                onChange={(e) => setProchaineRelanceAt(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
              {prochaineRelanceAt && (
                <button
                  type="button"
                  onClick={() => setProchaineRelanceAt('')}
                  className="text-[11px] text-stone-400 hover:text-stone-700 px-1"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Compte-rendu / Note */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                Compte-rendu & Note interne
              </label>
              <span className="text-[10px] text-stone-400 tabular-nums">
                {texte.length} / 1000
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Ex : Échange avec la directrice financière. Intéressée par la Fibre 200M + 4 forfaits illimités. Rappeler mardi pour proposition."
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Historique dépliable */}
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5 text-stone-400" />
              <span>Historique des activités ({history.length})</span>
            </button>

            {showHistory && (
              <div className="mt-2.5 space-y-2 max-h-40 overflow-y-auto pr-1">
                {isLoadingHistory ? (
                  <p className="text-xs text-stone-400 italic">Chargement du journal...</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">Aucune activité enregistrée sur cette fiche.</p>
                ) : (
                  history.map((act) => {
                    const meta = ACTIVITE_TYPE_META[act.type] || ACTIVITE_TYPE_META.note;
                    const resMeta = ACTIVITE_RESULTAT_META[act.resultat];
                    return (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-lg border border-stone-100 bg-stone-50 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`}>
                              {meta.label}
                            </span>
                            {resMeta?.label && (
                              <span className="text-[10px] text-stone-500 font-medium">
                                · {resMeta.label}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400">
                            {act.auteurNom}
                          </span>
                        </div>
                        {act.texte && <p className="text-stone-700 whitespace-pre-wrap">{act.texte}</p>}
                        {(act.rdvAt || act.prochaineRelanceAt) && (
                          <div className="flex flex-wrap gap-2 text-[10px] text-stone-500 pt-0.5">
                            {act.rdvAt && (
                              <span className="font-semibold text-orange-700">
                                📅 RDV : {formatFriendlyDateFr(act.rdvAt)} ({act.rdvLieu || 'Lieu non spécifié'})
                              </span>
                            )}
                            {act.prochaineRelanceAt && (
                              <span className="text-sky-700 font-semibold">
                                ⏰ Relance : {formatFriendlyDateFr(act.prochaineRelanceAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Pied de modal */}
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
              className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Enregistrement...' : 'Enregistrer l’activité'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
