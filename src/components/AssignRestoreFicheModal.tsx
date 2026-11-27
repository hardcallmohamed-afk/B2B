import React, { useEffect, useState } from 'react';
import { X, UserPlus, RotateCcw, Lock, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { FicheEntreprise, StatutCRM } from '../utils/crmDomain';
import { ROLE_BADGE_META, type TeamStatRecord } from '../utils/gamification';

export type AssignRestoreMode = 'assign' | 'restore';

interface AssignRestoreFicheModalProps {
  isOpen: boolean;
  mode: AssignRestoreMode;
  fiche: FicheEntreprise | null;
  sourceOwnerUid: string;
  sourceOwnerName: string;
  teamMembers: TeamStatRecord[];
  onClose: () => void;
  onConfirmAssign: (params: {
    fiche: FicheEntreprise;
    sourceOwnerUid: string;
    sourceOwnerName: string;
    targetOwnerUid: string;
    targetOwnerName: string;
    nextStatut: StatutCRM;
    note: string;
  }) => Promise<void>;
  onConfirmRestore: (params: {
    fiche: FicheEntreprise;
    ownerUid: string;
    ownerName: string;
    nextStatut: StatutCRM;
    reason: string;
  }) => Promise<void>;
}

const UNLOCK_STATUTS: StatutCRM[] = [
  'Appel en cours',
  'RDV pris',
  'Devis envoyé',
  'À contacter',
];

export const AssignRestoreFicheModal: React.FC<AssignRestoreFicheModalProps> = ({
  isOpen,
  mode,
  fiche,
  sourceOwnerUid,
  sourceOwnerName,
  teamMembers,
  onClose,
  onConfirmAssign,
  onConfirmRestore,
}) => {
  const activeMembers = teamMembers.filter((m) => m.active !== false);
  const [targetUid, setTargetUid] = useState<string>('');
  const [nextStatut, setNextStatut] = useState<StatutCRM>('Appel en cours');
  const [noteOrReason, setNoteOrReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !fiche) return;
    setError(null);
    setNoteOrReason('');

    if (mode === 'assign') {
      const otherMember = activeMembers.find((m) => m.uid !== sourceOwnerUid);
      setTargetUid(otherMember?.uid || activeMembers[0]?.uid || '');
      // Si la fiche est signée/verrouillée, proposer par défaut de la déverrouiller pour le destinataire
      setNextStatut(
        fiche.statut === 'Signé Orange Pro' ? 'Appel en cours' : (fiche.statut as StatutCRM)
      );
    } else {
      setNextStatut('Appel en cours');
    }
  }, [isOpen, mode, fiche?.id, sourceOwnerUid]);

  if (!isOpen || !fiche) return null;

  const isSignedLocked = fiche.statut === 'Signé Orange Pro';
  const selectedTarget = activeMembers.find((m) => m.uid === targetUid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'assign') {
      if (!targetUid || !selectedTarget) {
        setError('Veuillez sélectionner un collaborateur destinataire.');
        return;
      }
      if (targetUid === sourceOwnerUid && nextStatut === fiche.statut) {
        setError(
          'Cette fiche appartient déjà à ce collaborateur avec le même statut. Choisissez un autre destinataire ou changez le statut.'
        );
        return;
      }
      setSubmitting(true);
      try {
        await onConfirmAssign({
          fiche,
          sourceOwnerUid,
          sourceOwnerName,
          targetOwnerUid: selectedTarget.uid,
          targetOwnerName: selectedTarget.displayName,
          nextStatut,
          note: noteOrReason.trim(),
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de l’attribution de la fiche.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Mode restore
    if (!noteOrReason.trim() || noteOrReason.trim().length < 3) {
      setError('Veuillez préciser un motif de restitution (au moins 3 caractères).');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirmRestore({
        fiche,
        ownerUid: sourceOwnerUid,
        ownerName: sourceOwnerName,
        nextStatut,
        reason: noteOrReason.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la restitution de la fiche.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="assign-restore-fiche-modal"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                mode === 'restore'
                  ? 'bg-violet-100 text-violet-700 border border-violet-200'
                  : 'bg-orange-100 text-orange-700 border border-orange-200'
              }`}
            >
              {mode === 'restore' ? (
                <RotateCcw className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-stone-900">
                {mode === 'restore'
                  ? 'Restituer la fiche signée au collaborateur'
                  : isSignedLocked
                    ? 'Réattribuer cette fiche signée à un collaborateur'
                    : 'Attribuer / Transférer la fiche'}
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                <strong>{fiche.societe}</strong>
                {fiche.numeroFiche ? ` · ${fiche.numeroFiche}` : ''}
                {fiche.ville ? ` · ${fiche.ville}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] text-stone-500">Portefeuille actuel</div>
              <div className="font-bold text-stone-900">{sourceOwnerName}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-stone-500">Statut actuel</div>
              <div className="inline-flex items-center gap-1 font-bold text-stone-800">
                {isSignedLocked && <Lock className="w-3 h-3 text-amber-600" />}
                {fiche.statut}
              </div>
            </div>
          </div>

          {isSignedLocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Cette fiche est actuellement verrouillée en <strong>Signé Orange Pro</strong> (invisible pour les collaborateurs).{' '}
                {mode === 'restore'
                  ? 'La restitution la déverrouille et la rend immédiatement accessible à son collaborateur avec une notification temps réel.'
                  : 'Choisissez un statut actif ci-dessous pour que le collaborateur destinataire puisse y accéder immédiatement.'}
              </p>
            </div>
          )}

          {mode === 'assign' && (
            <div>
              <label className="block font-bold text-stone-800 mb-1.5">
                Collaborateur destinataire <span className="text-red-600">*</span>
              </label>
              <select
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                required
                data-testid="assign-target-select"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-900 focus:border-orange-500 focus:outline-none"
              >
                <option value="">Sélectionner un collaborateur...</option>
                {activeMembers.map((member) => {
                  const roleLabel = ROLE_BADGE_META[member.role]?.shortLabel || member.role;
                  return (
                    <option key={member.uid} value={member.uid}>
                      {member.displayName} — {roleLabel} ({member.zone || 'Maroc'})
                      {member.uid === sourceOwnerUid ? ' [Actuel]' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-[11px] text-stone-500">
                Le collaborateur recevra une notification instantanée avec alerte sonore dédiée et la fiche apparaîtra dans son CRM.
              </p>
            </div>
          )}

          <div>
            <label className="block font-bold text-stone-800 mb-1.5">
              {mode === 'restore' ? 'Statut après restitution (déverrouillé)' : 'Statut CRM de la fiche attribuée'}
            </label>
            <select
              value={nextStatut}
              onChange={(e) => setNextStatut(e.target.value as StatutCRM)}
              data-testid="assign-restore-status-select"
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-900 focus:border-orange-500 focus:outline-none"
            >
              {UNLOCK_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {mode === 'assign' && (
                <option value="Pas intéressé">Pas intéressé</option>
              )}
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-800 mb-1.5">
              {mode === 'restore' ? (
                <>
                  Motif de restitution <span className="text-red-600">*</span>
                </>
              ) : (
                'Consigne ou commentaire pour le collaborateur (optionnel)'
              )}
            </label>
            <textarea
              rows={3}
              value={noteOrReason}
              onChange={(e) => setNoteOrReason(e.target.value)}
              placeholder={
                mode === 'restore'
                  ? 'Ex : Contrat refusé par le back-office, reprendre la négociation avec le décideur...'
                  : 'Ex : Prospect chaud à rappeler avant 15h pour proposition Fibre 200M...'
              }
              maxLength={280}
              required={mode === 'restore'}
              data-testid="assign-restore-note-input"
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-stone-300 bg-white hover:bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="assign-restore-confirm-btn"
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition-colors ${
                mode === 'restore'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting
                ? 'Traitement...'
                : mode === 'restore'
                  ? 'Restituer & Déverrouiller'
                  : 'Confirmer l’attribution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
