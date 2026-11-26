import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  MapPin,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  User,
  Users,
  Calendar,
  Clock,
  FileSpreadsheet,
  PhoneCall,
  Bot,
  Sparkles,
  CheckCircle2,
  Copy,
  Target,
  Briefcase,
  Lightbulb,
  HelpCircle,
  History,
  RefreshCw,
  FileText,
  Lock,
  UserPlus,
  RotateCcw,
} from 'lucide-react';
import {
  SECTEURS_META,
  SEGMENTS_COULEUR,
  STATUTS_CRM,
  computeMaturityScore,
  getOrangeProRecommendation,
  type FicheEntreprise,
  type SecteurCode,
  type StatutCRM,
} from '../App';
import {
  ROLE_BADGE_META,
  computeDefaultPayoutMad,
  formatMad,
  type TeamRole,
} from '../utils/gamification';
import { getClientTypeProfile } from '../utils/clientProfiles';
import { resolveCityAndRegionFromZoneString } from '../utils/moroccoCities';
import {
  ACTIVITE_RESULTAT_META,
  ACTIVITE_TYPE_META,
  formatAuditDateTimeFr,
  formatFriendlyDateFr,
} from '../utils/activiteHelpers';
import type { SanitizedActiviteDoc } from '../utils/firestoreSanitize';
import { fetchFicheActivites } from '../firebase';

interface FicheDetailModalProps {
  isOpen: boolean;
  fiche: FicheEntreprise | null;
  currentUserUid: string;
  ficheOwnerUid?: string;
  ownerDisplayName?: string;
  isSuperAdmin: boolean;
  canSuperviseTeam?: boolean;
  verifyingId: string | null;
  activityRefreshKey?: number;
  onClose: () => void;
  onChangeStatut: (fiche: FicheEntreprise, nextStatut: StatutCRM) => void;
  onChangeSecteur: (ficheId: string, nextSecteur: SecteurCode) => void;
  onOpenQuote: (fiche: FicheEntreprise) => void;
  onOpenActivite: (fiche: FicheEntreprise) => void;
  onOpenRdv: (fiche: FicheEntreprise) => void;
  onOpenEmail: (fiche: FicheEntreprise) => void;
  onOpenAiBrief: (fiche: FicheEntreprise) => void;
  onVerifyWeb: (fiche: FicheEntreprise) => void;
  onOpenAssist: (fiche: FicheEntreprise) => void;
  onOpenSignContract: (fiche: FicheEntreprise) => void;
  onOpenAssign?: (fiche: FicheEntreprise, ownerUid: string) => void;
  onOpenRestore?: (fiche: FicheEntreprise, ownerUid: string) => void;
  onCopyText: (value: string, label: string) => void;
}

function buildWhatsAppNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('212') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `212${digits.slice(1)}`;
  return digits;
}

export const FicheDetailModal: React.FC<FicheDetailModalProps> = ({
  isOpen,
  fiche,
  currentUserUid,
  ficheOwnerUid,
  ownerDisplayName,
  isSuperAdmin,
  canSuperviseTeam = false,
  verifyingId,
  activityRefreshKey = 0,
  onClose,
  onChangeStatut,
  onChangeSecteur,
  onOpenQuote,
  onOpenActivite,
  onOpenRdv,
  onOpenEmail,
  onOpenAiBrief,
  onVerifyWeb,
  onOpenAssist,
  onOpenSignContract,
  onOpenAssign,
  onOpenRestore,
  onCopyText,
}) => {
  const [activites, setActivites] = useState<SanitizedActiviteDoc[]>([]);
  const [loadingActivites, setLoadingActivites] = useState(false);
  const resolvedOwnerUid = ficheOwnerUid || currentUserUid;
  const hasSupervision = isSuperAdmin || canSuperviseTeam;

  useEffect(() => {
    if (!isOpen || !fiche || !resolvedOwnerUid) return;
    let cancelled = false;
    setLoadingActivites(true);
    fetchFicheActivites(resolvedOwnerUid, fiche.id)
      .then((list) => {
        if (!cancelled) setActivites(list || []);
      })
      .catch(() => {
        if (!cancelled) setActivites([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingActivites(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fiche?.id, resolvedOwnerUid, activityRefreshKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !fiche) return null;

  const secMeta = SECTEURS_META[fiche.secteur] || SECTEURS_META.pme;
  const segMeta = SEGMENTS_COULEUR[secMeta.couleur] || SEGMENTS_COULEUR.orange;
  const clientProfile = getClientTypeProfile(fiche);
  const reco = getOrangeProRecommendation(fiche);
  const maturity = computeMaturityScore(fiche);
  const estimatedCommissionMad = computeDefaultPayoutMad(reco.tier, fiche.effectif, reco.offre);
  const locationInfo = resolveCityAndRegionFromZoneString(fiche.ville || 'Maroc');
  const waNumber = buildWhatsAppNumber(fiche.telephone);
  const isLockedSigned = fiche.statut === 'Signé Orange Pro' && !hasSupervision;

  const extraPhones = fiche.telephonesSupplementaires || [];
  const extraEmails = fiche.emailsSupplementaires || [];

  const reloadHistory = () => {
    if (!resolvedOwnerUid) return;
    setLoadingActivites(true);
    fetchFicheActivites(resolvedOwnerUid, fiche.id)
      .then((list) => setActivites(list || []))
      .catch(() => setActivites([]))
      .finally(() => setLoadingActivites(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/50 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fiche-detail-modal-title"
      data-testid="fiche-detail-modal"
    >
      <div
        className="relative flex h-full w-full max-w-3xl flex-col bg-[#F7F5F0] shadow-2xl border-l border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-5 py-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span className={`h-2.5 w-2.5 rounded-sm shrink-0 ${segMeta.dotCls}`} aria-hidden="true" />
                {fiche.numeroFiche && (
                  <button
                    type="button"
                    onClick={() => onCopyText(fiche.numeroFiche || '', `Code ${fiche.numeroFiche}`)}
                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-stone-700 hover:text-orange-700"
                    title="Copier le code fiche"
                  >
                    <span>{fiche.numeroFiche}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                )}
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-medium text-stone-600">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  {locationInfo.formattedZone}
                </span>
                {fiche.dateAjout && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[11px] text-stone-500">Ajouté le {fiche.dateAjout}</span>
                  </>
                )}
              </div>

              <h2
                id="fiche-detail-modal-title"
                className="mt-1 text-lg sm:text-xl font-extrabold text-stone-900 leading-tight break-words"
              >
                {fiche.societe}
              </h2>

              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <select
                  aria-label="Secteur d'activité"
                  value={fiche.secteur}
                  disabled={isLockedSigned}
                  onChange={(e) => onChangeSecteur(fiche.id, e.target.value as SecteurCode)}
                  className="rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                >
                  {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
                    <option key={code} value={code}>
                      {SECTEURS_META[code].label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Statut CRM de la fiche"
                  value={fiche.statut}
                  disabled={isLockedSigned}
                  onChange={(e) => onChangeStatut(fiche, e.target.value as StatutCRM)}
                  className="rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-900 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                >
                  {STATUTS_CRM.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <div className="inline-flex items-center gap-2 text-xs text-stone-600">
                  <span>Maturité</span>
                  <div className="w-16 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        maturity >= 80
                          ? 'bg-emerald-600'
                          : maturity >= 50
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${maturity}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-stone-800 tabular-nums">{maturity}%</span>
                </div>

                {isLockedSigned && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                    <Lock className="w-3.5 h-3.5" />
                    Dossier signé verrouillé
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer les détails de la fiche"
              className="p-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Bar — PDF Generation & Key Commercial Workflows */}
          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="fiche-detail-generate-pdf-btn"
              onClick={() => onOpenQuote(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Générer Devis PDF
            </button>

            <button
              type="button"
              onClick={() => onOpenActivite(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-orange-600" />
              Logger activité
            </button>

            <button
              type="button"
              onClick={() => onOpenRdv(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              Planifier RDV
            </button>

            <button
              type="button"
              onClick={() => onOpenEmail(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              Studio Email IA
            </button>

            <button
              type="button"
              onClick={() => onOpenAiBrief(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 px-2.5 py-1.5 text-xs font-semibold text-orange-300 transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              Brief IA
            </button>

            <button
              type="button"
              disabled={verifyingId === fiche.id}
              onClick={() => onVerifyWeb(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 text-xs font-semibold text-orange-800 disabled:opacity-50 transition-colors"
            >
              <Sparkles className={`w-3.5 h-3.5 ${verifyingId === fiche.id ? 'animate-spin' : ''}`} />
              {verifyingId === fiche.id ? 'Vérification...' : 'Vérifier Web'}
            </button>

            <button
              type="button"
              onClick={() => onOpenAssist(fiche)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              Enrichir
            </button>

            {hasSupervision && onOpenAssign && (
              <button
                type="button"
                data-testid="fiche-detail-assign-btn"
                onClick={() => onOpenAssign(fiche, resolvedOwnerUid)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 text-xs font-bold text-orange-900 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {fiche.statut === 'Signé Orange Pro' ? 'Réattribuer' : 'Attribuer'}
              </button>
            )}

            {hasSupervision && fiche.statut === 'Signé Orange Pro' && onOpenRestore && (
              <button
                type="button"
                data-testid="fiche-detail-restore-btn"
                onClick={() => onOpenRestore(fiche, resolvedOwnerUid)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restituer au collaborateur
              </button>
            )}

            {fiche.statut !== 'Signé Orange Pro' && (
              <button
                type="button"
                onClick={() => onOpenSignContract(fiche)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white transition-colors ml-auto"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Signer Orange Pro
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {(ownerDisplayName || fiche.assignedByName || fiche.restoredByName) && (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {ownerDisplayName && (
                <span className="text-stone-700">
                  Portefeuille : <strong className="text-stone-900">{ownerDisplayName}</strong>
                </span>
              )}
              {fiche.assignedByName && (
                <span className="text-orange-800">
                  Attribuée par <strong>{fiche.assignedByName}</strong>
                  {fiche.assignedAt ? ` le ${formatAuditDateTimeFr(fiche.assignedAt)}` : ''}
                </span>
              )}
              {fiche.restoredByName && (
                <span className="text-violet-800">
                  Restituée par <strong>{fiche.restoredByName}</strong>
                  {fiche.restoredAt ? ` le ${formatAuditDateTimeFr(fiche.restoredAt)}` : ''}
                  {fiche.restoredReason ? ` — ${fiche.restoredReason}` : ''}
                </span>
              )}
            </div>
          )}
          {/* 1. Profil Clientèle Réel & Recommandation Orange Pro */}
          <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2 bg-stone-50/70">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Profil Clientèle &amp; Besoins Orange Pro
                </h3>
              </div>
              <span className="text-xs font-semibold text-stone-600">
                {clientProfile.segmentCommercial}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Top Key-Value Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Type de clientèle
                  </div>
                  <div className="mt-1 font-bold text-stone-900">
                    {clientProfile.clientTypeLabel}
                  </div>
                  <div className="mt-1 text-stone-600">
                    Décideur type : {clientProfile.decisionMakerProfile}
                  </div>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-800">
                    Offre Orange Pro Recommandée ({reco.tier})
                  </div>
                  <div className="mt-1 font-bold text-stone-900">{reco.offre}</div>
                  <div className="mt-1 text-stone-700 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span>Budget client estimé : {clientProfile.suggestedMonthlyBudgetMad}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    Dimensionnement &amp; Facturation
                  </div>
                  <div className="mt-1 font-medium text-stone-800">
                    {clientProfile.typicalLineSizing}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500">
                    {clientProfile.billingCycle}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                    Estimation Commission Interne (DIVERSIFIA)
                  </div>
                  <div className="mt-1 text-base font-extrabold text-emerald-900 font-mono tabular-nums">
                    {formatMad(estimatedCommissionMad)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-emerald-800">
                    Confidentiel équipe · Jamais affiché sur le Devis PDF client
                  </div>
                </div>
              </div>

              {/* Pitch rapide */}
              {clientProfile.salesArguments[0] && (
                <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-3.5 py-2.5 text-xs text-stone-700">
                  <span className="font-bold text-stone-900">Angle d’approche conseillé : </span>
                  {clientProfile.salesArguments[0]}
                </div>
              )}

              {/* Enjeux / Solutions / Arguments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-orange-600" />
                    Enjeux télécoms de ce secteur
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {clientProfile.telecomChallenges.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Solutions Orange Pro à proposer
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {clientProfile.recommendedSolutions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    Arguments clés en rendez-vous
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {clientProfile.salesArguments.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                    Questions de découverte client
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700">
                    {clientProfile.discoveryQuestions.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Coordonnées, Décideur & Rendez-vous */}
          <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/70">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Coordonnées, Décideur &amp; Suivi Commercial
                </h3>
              </div>
              {fiche.source && (
                <span className="text-[11px] text-stone-500">Source : {fiche.source}</span>
              )}
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-stone-500">Décideur &amp; Fonction</div>
                    <div className="font-semibold text-stone-900">
                      {fiche.contact || 'Non renseigné'}
                      {fiche.role ? ` — ${fiche.role}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] text-stone-500">Effectif estimé</div>
                    <div className="font-semibold text-stone-900">
                      {fiche.effectif ? `${fiche.effectif} collaborateurs` : 'Non renseigné'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-stone-500">Site Web</div>
                    {fiche.siteWeb ? (
                      <a
                        href={fiche.siteWeb.startsWith('http') ? fiche.siteWeb : `https://${fiche.siteWeb}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-orange-700 hover:underline break-all"
                      >
                        {fiche.siteWeb}
                      </a>
                    ) : (
                      <span className="text-stone-400 italic">Non renseigné</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-stone-500">Téléphone(s)</div>
                    {fiche.telephone ? (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-stone-900">{fiche.telephone}</span>
                        <a
                          href={`tel:${fiche.telephone}`}
                          className="text-[11px] font-semibold text-orange-700 hover:underline"
                        >
                          Appeler
                        </a>
                        {waNumber && (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-700 hover:underline"
                          >
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onCopyText(fiche.telephone, 'Téléphone')}
                          className="text-[11px] text-stone-500 hover:text-stone-800"
                        >
                          Copier
                        </button>
                      </div>
                    ) : (
                      <span className="text-stone-400 italic">Téléphone manquant</span>
                    )}
                    {extraPhones.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {extraPhones.map((ph, i) => (
                          <div key={i} className="font-mono text-[11px] text-stone-600 flex items-center gap-2">
                            <span>{ph}</span>
                            <a href={`tel:${ph}`} className="font-sans text-orange-700 hover:underline">
                              Appeler
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-stone-500">Email(s) professionnel(s)</div>
                    {fiche.email ? (
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="font-medium text-stone-900 break-all">{fiche.email}</span>
                        <button
                          type="button"
                          onClick={() => onCopyText(fiche.email, 'Email')}
                          className="text-[11px] text-stone-500 hover:text-stone-800"
                        >
                          Copier
                        </button>
                      </div>
                    ) : (
                      <span className="text-stone-400 italic">Email manquant</span>
                    )}
                    {extraEmails.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {extraEmails.map((em, i) => (
                          <div key={i} className="text-[11px] text-stone-600 break-all">
                            {em}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RDV, Relance & Pistes d'enrichissement */}
              {(fiche.rdvAt || fiche.prochaineRelanceAt || (fiche.pistesEnrichissement && fiche.pistesEnrichissement.length > 0)) && (
                <div className="sm:col-span-2 pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fiche.rdvAt && (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-900">
                        <Calendar className="w-3.5 h-3.5" />
                        Rendez-vous planifié
                      </div>
                      <div className="mt-1 font-semibold text-stone-900">
                        {formatFriendlyDateFr(fiche.rdvAt)}
                      </div>
                      {fiche.rdvLieu && (
                        <div className="text-[11px] text-stone-600 mt-0.5">Lieu : {fiche.rdvLieu}</div>
                      )}
                    </div>
                  )}

                  {fiche.prochaineRelanceAt && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                        <Clock className="w-3.5 h-3.5" />
                        Prochaine relance
                      </div>
                      <div className="mt-1 font-semibold text-stone-900">
                        {formatFriendlyDateFr(fiche.prochaineRelanceAt)}
                      </div>
                    </div>
                  )}

                  {fiche.pistesEnrichissement && fiche.pistesEnrichissement.length > 0 && (
                    <div className="sm:col-span-2 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-700">
                        <FileText className="w-3.5 h-3.5" />
                        Pistes &amp; vérifications web ({fiche.pistesEnrichissement.length})
                      </div>
                      <ul className="mt-1.5 space-y-1 text-stone-700">
                        {fiche.pistesEnrichissement.slice(0, 5).map((piste, idx) => (
                          <li key={idx} className="truncate">
                            · {piste}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 3. Journal d'Activités & Devis PDF générés */}
          <section className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2 bg-stone-50/70">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-orange-600" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Journal d’audit complet, Activités &amp; Devis ({activites.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reloadHistory}
                    disabled={loadingActivites}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingActivites ? 'animate-spin' : ''}`} />
                    Actualiser
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenActivite(fiche)}
                    className="rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-800"
                  >
                    + Activité
                  </button>
                </div>
              </div>

              <div className="p-4">
                {loadingActivites ? (
                  <div className="py-6 text-center text-xs text-stone-500">
                    Chargement de l’historique complet d’audit et d’activités...
                  </div>
                ) : activites.length === 0 ? (
                  <div className="py-6 text-center text-xs text-stone-500 space-y-2">
                    <p>Aucune action ni activité enregistrée pour cette entreprise pour le moment.</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenQuote(fiche)}
                        className="rounded-lg bg-orange-600 hover:bg-orange-700 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Générer le 1er Devis PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenActivite(fiche)}
                        className="rounded-lg border border-stone-300 bg-white hover:bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700"
                      >
                        Logger un appel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {activites.map((act) => {
                      const typeMeta = ACTIVITE_TYPE_META[act.type] || {
                        label: act.type,
                        bgClass: 'bg-stone-50 border-stone-200',
                        textClass: 'text-stone-700',
                      };
                      const resMeta = ACTIVITE_RESULTAT_META[act.resultat] || { label: '' };
                      const roleLabel =
                        act.auteurRole && act.auteurRole in ROLE_BADGE_META
                          ? ROLE_BADGE_META[act.auteurRole as TeamRole].shortLabel
                          : act.auteurRole || '';
                      return (
                        <div key={act.id} className="py-3 first:pt-0 last:pb-0 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${typeMeta.bgClass} ${typeMeta.textClass}`}
                              >
                                {typeMeta.label}
                              </span>
                              {resMeta.label && (
                                <span className="text-[11px] font-semibold text-stone-600">
                                  · {resMeta.label}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                              <span className="font-semibold text-stone-800">
                                {act.auteurNom}
                                {roleLabel ? ` (${roleLabel})` : ''}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-[10px] text-stone-500 tabular-nums">
                                {formatAuditDateTimeFr(act.createdAtIso)}
                              </span>
                            </div>
                          </div>
                          {act.texte && (
                            <p className="mt-1.5 text-stone-700 leading-relaxed whitespace-pre-wrap">
                              {act.texte}
                            </p>
                          )}
                          {(act.rdvAt || act.prochaineRelanceAt) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                              {act.rdvAt && (
                                <span>
                                  RDV : <strong className="text-stone-700">{formatFriendlyDateFr(act.rdvAt)}</strong>
                                  {act.rdvLieu ? ` (${act.rdvLieu})` : ''}
                                </span>
                              )}
                              {act.prochaineRelanceAt && (
                                <span>
                                  Relance :{' '}
                                  <strong className="text-stone-700">
                                    {formatFriendlyDateFr(act.prochaineRelanceAt)}
                                  </strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </section>
        </div>
      </div>
    </div>
  );
};
