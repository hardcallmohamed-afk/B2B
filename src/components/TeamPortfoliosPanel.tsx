import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Search,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  UserPlus,
  RotateCcw,
  Lock,
  MapPin,
  Users,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import {
  SECTEURS_META,
  STATUTS_CRM,
  computeMaturityScore,
  type FicheEntreprise,
  type SecteurCode,
  type StatutCRM,
} from '../utils/crmDomain';
import {
  ROLE_BADGE_META,
  formatMad,
  type TeamStatRecord,
} from '../utils/gamification';
import { getUserInitials } from '../utils/avatarResize';
import { fetchAllTeamPortfolios } from '../firebase';
import { RoleBadge } from './RoleBadge';

export interface PortfolioFicheItem {
  fiche: FicheEntreprise;
  ownerUid: string;
  ownerName: string;
  ownerRole: TeamStatRecord['role'];
  ownerZone: string;
}

interface TeamPortfoliosPanelProps {
  teamStats: TeamStatRecord[];
  currentUserUid: string;
  currentUserFiches: FicheEntreprise[];
  initialOwnerUid?: string;
  refreshKey?: number;
  onInspectFiche: (item: PortfolioFicheItem) => void;
  onOpenQuote: (fiche: FicheEntreprise, ownerUid: string) => void;
  onOpenAssign: (item: PortfolioFicheItem) => void;
  onOpenRestore: (item: PortfolioFicheItem) => void;
}

export const TeamPortfoliosPanel: React.FC<TeamPortfoliosPanelProps> = ({
  teamStats,
  currentUserUid,
  currentUserFiches,
  initialOwnerUid = 'all',
  refreshKey = 0,
  onInspectFiche,
  onOpenQuote,
  onOpenAssign,
  onOpenRestore,
}) => {
  const [portfoliosByUid, setPortfoliosByUid] = useState<Record<string, FicheEntreprise[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedOwnerUid, setSelectedOwnerUid] = useState<string>(initialOwnerUid);
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterSecteur, setFilterSecteur] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (initialOwnerUid) {
      setSelectedOwnerUid(initialOwnerUid);
    }
  }, [initialOwnerUid]);

  const memberIdsKey = useMemo(
    () =>
      teamStats
        .map((m) => m.uid)
        .sort()
        .join(','),
    [teamStats]
  );

  const loadPortfolios = useCallback(async () => {
    const uids = teamStats.map((m) => m.uid).filter(Boolean);
    if (uids.length === 0) {
      setPortfoliosByUid({ [currentUserUid]: currentUserFiches });
      return;
    }
    setLoading(true);
    try {
      const fetched = await fetchAllTeamPortfolios(uids);
      const next: Record<string, FicheEntreprise[]> = {};
      for (const uid of uids) {
        if (uid === currentUserUid && (!fetched[uid] || fetched[uid].length === 0)) {
          next[uid] = currentUserFiches;
        } else {
          next[uid] = (fetched[uid] || []).map((doc) => ({
            ...doc,
            secteur: (doc.secteur as SecteurCode) || 'pme',
            statut: (doc.statut as StatutCRM) || 'À contacter',
          }));
        }
      }
      setPortfoliosByUid(next);
    } finally {
      setLoading(false);
    }
  }, [memberIdsKey, currentUserUid, currentUserFiches, teamStats]);

  useEffect(() => {
    void loadPortfolios();
  }, [memberIdsKey, refreshKey]);

  // Keep current user's live fiches synchronized immediately
  useEffect(() => {
    if (!currentUserUid) return;
    setPortfoliosByUid((prev) => ({
      ...prev,
      [currentUserUid]: currentUserFiches,
    }));
  }, [currentUserUid, currentUserFiches]);

  const memberSummaries = useMemo(() => {
    return teamStats.map((member) => {
      const list = portfoliosByUid[member.uid] || [];
      const signedLocked = list.filter((f) => f.statut === 'Signé Orange Pro').length;
      const qualified = list.filter((f) =>
        ['RDV pris', 'Devis envoyé', 'Signé Orange Pro'].includes(f.statut)
      ).length;
      return {
        member,
        totalFiches: list.length,
        signedLocked,
        qualified,
      };
    });
  }, [teamStats, portfoliosByUid]);

  const allItems = useMemo<PortfolioFicheItem[]>(() => {
    const rows: PortfolioFicheItem[] = [];
    for (const member of teamStats) {
      const list = portfoliosByUid[member.uid] || [];
      for (const fiche of list) {
        rows.push({
          fiche,
          ownerUid: member.uid,
          ownerName: member.displayName || 'Collaborateur',
          ownerRole: member.role,
          ownerZone: member.zone || 'Maroc',
        });
      }
    }
    return rows;
  }, [teamStats, portfoliosByUid]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (selectedOwnerUid !== 'all' && item.ownerUid !== selectedOwnerUid) return false;
      if (filterStatut === 'locked_signed') {
        if (item.fiche.statut !== 'Signé Orange Pro') return false;
      } else if (filterStatut !== 'all' && item.fiche.statut !== filterStatut) {
        return false;
      }
      if (filterSecteur !== 'all' && item.fiche.secteur !== filterSecteur) return false;
      if (q) {
        const hay = [
          item.fiche.societe,
          item.fiche.numeroFiche || '',
          item.fiche.ville,
          item.fiche.contact,
          item.fiche.telephone,
          item.fiche.email,
          item.ownerName,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, selectedOwnerUid, filterStatut, filterSecteur, searchQuery]);

  const totalPlatformFiches = allItems.length;
  const totalSignedLocked = allItems.filter((i) => i.fiche.statut === 'Signé Orange Pro').length;

  return (
    <div className="space-y-5" data-testid="team-portfolios-panel">
      {/* Header & Summary */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-orange-600" />
            <h3 className="text-base font-bold text-stone-900">
              Portefeuilles de Tous les Collaborateurs
            </h3>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Consultez toutes les fiches de la plateforme ({totalPlatformFiches} fiches dont{' '}
            <strong className="text-amber-700">{totalSignedLocked} signées/verrouillées</strong>), suivez l’audit complet, attribuez ou restituez un dossier.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPortfolios()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 px-3.5 py-2 text-xs font-bold text-stone-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Synchronisation...' : 'Actualiser les portefeuilles'}
        </button>
      </div>

      {/* Per-Collaborator Portfolio Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedOwnerUid('all')}
          className={`text-left rounded-2xl border p-3.5 transition-all ${
            selectedOwnerUid === 'all'
              ? 'border-orange-500 bg-orange-50/60 ring-1 ring-orange-300'
              : 'border-stone-200 bg-white hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-stone-900">Toute la plateforme</div>
                <div className="text-[11px] text-stone-500">{teamStats.length} collaborateurs</div>
              </div>
            </div>
            <span className="font-mono text-base font-extrabold text-orange-700 tabular-nums">
              {totalPlatformFiches}
            </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-600">
            <span>Signées verrouillées</span>
            <span className="font-bold text-amber-800 tabular-nums">{totalSignedLocked}</span>
          </div>
        </button>

        {memberSummaries.map(({ member, totalFiches, signedLocked, qualified }) => {
          const isSelected = selectedOwnerUid === member.uid;
          return (
            <button
              key={member.uid}
              type="button"
              onClick={() =>
                setSelectedOwnerUid((prev) => (prev === member.uid ? 'all' : member.uid))
              }
              className={`text-left rounded-2xl border p-3.5 transition-all ${
                isSelected
                  ? 'border-orange-500 bg-orange-50/60 ring-1 ring-orange-300'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {member.avatarDataUrl ? (
                    <img
                      src={member.avatarDataUrl}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full object-cover border border-stone-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                      {getUserInitials(member.displayName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 truncate">
                      {member.displayName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <RoleBadge role={member.role} size="xs" showShort />
                    </div>
                  </div>
                </div>
                <span className="font-mono text-base font-extrabold text-stone-900 tabular-nums shrink-0">
                  {totalFiches}
                </span>
              </div>

              <div className="mt-2.5 pt-2 border-t border-stone-100 grid grid-cols-3 gap-1 text-[10px] text-stone-600">
                <div>
                  <span className="block text-stone-400">Qualif.</span>
                  <strong className="text-stone-800 tabular-nums">{qualified}</strong>
                </div>
                <div>
                  <span className="block text-stone-400">Signées</span>
                  <strong className="text-amber-700 tabular-nums">{signedLocked}</strong>
                </div>
                <div className="text-right">
                  <span className="block text-stone-400">Payout</span>
                  <strong className="text-emerald-700 tabular-nums">
                    {formatMad(member.totalPayoutMad)}
                  </strong>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher société, code fiche, ville, contact, collaborateur..."
            className="w-full rounded-xl border border-stone-300 bg-stone-50/70 pl-8 pr-3 py-2 text-xs text-stone-900 focus:border-orange-500 focus:bg-white focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrer par collaborateur"
          value={selectedOwnerUid}
          onChange={(e) => setSelectedOwnerUid(e.target.value)}
          className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">Tous les collaborateurs</option>
          {teamStats.map((m) => (
            <option key={m.uid} value={m.uid}>
              {m.displayName} ({ROLE_BADGE_META[m.role]?.shortLabel || m.role})
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par statut CRM"
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">Tous les statuts</option>
          <option value="locked_signed">Signées / Verrouillées uniquement</option>
          {STATUTS_CRM.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrer par secteur"
          value={filterSecteur}
          onChange={(e) => setFilterSecteur(e.target.value)}
          className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 focus:border-orange-500 focus:outline-none"
        >
          <option value="all">Tous les secteurs</option>
          {(Object.keys(SECTEURS_META) as SecteurCode[]).map((code) => (
            <option key={code} value={code}>
              {SECTEURS_META[code].label}
            </option>
          ))}
        </select>
      </div>

      {/* Table of all fiches */}
      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
          <div className="text-xs font-bold text-stone-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600" />
            Fiches du portefeuille ({filteredItems.length})
          </div>
          {loading && <span className="text-[11px] text-stone-500">Chargement en cours...</span>}
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            {loading
              ? 'Chargement des portefeuilles de l’équipe...'
              : 'Aucune fiche ne correspond aux filtres sélectionnés.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2.5">Entreprise / Code</th>
                  <th className="px-3 py-2.5">Propriétaire</th>
                  <th className="px-3 py-2.5">Secteur &amp; Ville</th>
                  <th className="px-3 py-2.5">Statut</th>
                  <th className="px-3 py-2.5">Maturité</th>
                  <th className="px-4 py-2.5 text-right">Actions supervision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredItems.map((item) => {
                  const { fiche } = item;
                  const secLabel = SECTEURS_META[fiche.secteur]?.label || fiche.secteur;
                  const maturity = computeMaturityScore(fiche);
                  const isSigned = fiche.statut === 'Signé Orange Pro';

                  return (
                    <tr
                      key={`${item.ownerUid}_${fiche.id}`}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onInspectFiche(item)}
                          className="text-left group"
                        >
                          <div className="font-bold text-stone-900 group-hover:text-orange-700 transition-colors">
                            {fiche.societe}
                          </div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                            {fiche.numeroFiche && (
                              <span className="font-mono font-semibold text-stone-700">
                                {fiche.numeroFiche}
                              </span>
                            )}
                            {fiche.contact && <span>· {fiche.contact}</span>}
                          </div>
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-semibold text-stone-900">{item.ownerName}</div>
                        <div className="mt-0.5">
                          <RoleBadge role={item.ownerRole} size="xs" showShort />
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-stone-800">{secLabel}</div>
                        <div className="text-[11px] text-stone-500 inline-flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-orange-500" />
                          {fiche.ville || 'Maroc'}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                            isSigned
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : fiche.statut === 'Devis envoyé'
                                ? 'border-sky-200 bg-sky-50 text-sky-800'
                                : fiche.statut === 'RDV pris'
                                  ? 'border-orange-200 bg-orange-50 text-orange-800'
                                  : 'border-stone-200 bg-stone-50 text-stone-700'
                          }`}
                        >
                          {isSigned ? (
                            <Lock className="w-3 h-3 text-emerald-700" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 opacity-60" />
                          )}
                          {fiche.statut}
                        </span>
                        {fiche.assignedByName && (
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            Attribuée par {fiche.assignedByName}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-stone-200 overflow-hidden">
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
                          <span className="font-mono text-[11px] font-bold text-stone-700 tabular-nums">
                            {maturity}%
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onInspectFiche(item)}
                            title="Voir détails, profil client & journal d'audit"
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-800"
                          >
                            <Eye className="w-3.5 h-3.5 text-orange-600" />
                            Détails
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenQuote(fiche, item.ownerUid)}
                            title="Générer le devis PDF"
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-700"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                            PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenAssign(item)}
                            title="Attribuer ou réattribuer à un collaborateur"
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-800"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Attribuer
                          </button>

                          {isSigned && (
                            <button
                              type="button"
                              onClick={() => onOpenRestore(item)}
                              title="Restituer et déverrouiller cette fiche signée pour son collaborateur"
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Restituer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
