import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  Sparkles,
  Pencil,
  Check,
  X,
  Eye,
  Briefcase,
  UserPlus,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';
import {
  ROLE_BADGE_META,
  TEAM_ROLE_ORDER,
  buildTeamLeaderboard,
  buildTeamMonthlyEvolution,
  computeCurrentMonthPayoutSummary,
  formatMad,
  type OrangeProTier,
  type PayoutStatus,
  type SignedContractRecord,
  type TeamRole,
  type TeamStatRecord,
} from '../utils/gamification';
import { getUserInitials } from '../utils/avatarResize';
import {
  ALL_MOROCCO_CITY_NAMES,
  MOROCCO_REGIONS,
  doesCityBelongToRegion,
  filterCitiesByRegion,
  normalizeCityKey,
  resolveCityAndRegionFromZoneString,
} from '../utils/moroccoCities';
import { BadgeChipWithDrawing } from './BadgeArtwork';
import { RoleBadge } from './RoleBadge';
import { TeamPortfoliosPanel, type PortfolioFicheItem } from './TeamPortfoliosPanel';
import type { FicheEntreprise } from '../utils/crmDomain';
import type { WorkspaceLegalInfo } from '../utils/accountPreferences';
import {
  buildMonthlyDirectionReport,
  downloadMonthlyPayrollExcelCsv,
  formatMonthKeyFr,
  generateMonthlyDirectionReportPdf,
  getCurrentMonthKey,
  getRecentMonthKeys,
} from '../utils/directionReport';
import { fetchTeamAttendanceSessionsForMonth } from '../firebase';

interface TeamPerformancePanelProps {
  currentUserUid: string;
  isSuperAdmin: boolean;
  currentUserRole?: TeamRole;
  teamStats: TeamStatRecord[];
  signedContracts: SignedContractRecord[];
  currentUserFiches?: FicheEntreprise[];
  portfolioRefreshKey?: number;
  initialSubView?: 'leaderboard' | 'portfolios';
  initialSelectedUid?: string;
  workspaceLegal?: WorkspaceLegalInfo;
  onNotify?: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
  onAdminUpdateContract?: (
    contractId: string,
    updates: {
      produitOrangePro: string;
      tier: OrangeProTier;
      payoutMad: number;
      payoutStatus: PayoutStatus;
      referenceVirement?: string;
      refusMotif?: string;
    }
  ) => Promise<void>;
  onJumpToBadges?: (targetUid: string) => void;
  onOpenContractFiche?: (contract: SignedContractRecord) => void;
  onAssignContractFiche?: (contract: SignedContractRecord) => void;
  onRestoreContractFiche?: (contract: SignedContractRecord) => void;
  onOpenMemberProfileChat?: (uid: string) => void;
  onInspectPortfolioFiche?: (item: PortfolioFicheItem) => void;
  onOpenPortfolioQuote?: (fiche: FicheEntreprise, ownerUid: string) => void;
  onOpenPortfolioAssign?: (item: PortfolioFicheItem) => void;
  onOpenPortfolioRestore?: (item: PortfolioFicheItem) => void;
  accessibleFicheIds?: Set<string>;
}

const PAYOUT_STATUS_STYLES: Record<PayoutStatus, string> = {
  'En attente': 'border-amber-200 bg-amber-50 text-amber-800',
  Validé: 'border-sky-200 bg-sky-50 text-sky-800',
  Versé: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Refusé: 'border-red-200 bg-red-50 text-red-800',
};

export const TeamPerformancePanel: React.FC<TeamPerformancePanelProps> = ({
  currentUserUid,
  isSuperAdmin,
  currentUserRole,
  teamStats,
  signedContracts,
  currentUserFiches = [],
  portfolioRefreshKey = 0,
  initialSubView = 'leaderboard',
  initialSelectedUid,
  workspaceLegal,
  onNotify,
  onAdminUpdateContract,
  onJumpToBadges,
  onOpenContractFiche,
  onAssignContractFiche,
  onRestoreContractFiche,
  onOpenMemberProfileChat,
  onInspectPortfolioFiche,
  onOpenPortfolioQuote,
  onOpenPortfolioAssign,
  onOpenPortfolioRestore,
  accessibleFicheIds,
}) => {
  const canManageContracts = isSuperAdmin || currentUserRole === 'manager' || currentUserRole === 'team_lead';
  const [subView, setSubView] = useState<'leaderboard' | 'portfolios'>(initialSubView);
  const [portfolioTargetUid, setPortfolioTargetUid] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<'all' | TeamRole>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedUid, setSelectedUid] = useState<string>(initialSelectedUid || 'all');
  const [reportMonthKey, setReportMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [reportExportBusy, setReportExportBusy] = useState<'pdf' | 'csv' | null>(null);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [editPayout, setEditPayout] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<PayoutStatus>('En attente');
  const [editRefvirement, setEditRefvirement] = useState<string>('');
  const [editRefusMotif, setEditRefusMotif] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingContractId, setSavingContractId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedUid && initialSelectedUid !== 'all') {
      setSelectedRole('all');
      setSelectedRegion('all');
      setSelectedCity('all');
      setSelectedUid(initialSelectedUid);
      setSubView('leaderboard');
    }
  }, [initialSelectedUid]);

  const roleFilteredStats = useMemo(() => {
    return teamStats.filter((m) => {
      if (selectedRole !== 'all' && m.role !== selectedRole) return false;
      const resolved = resolveCityAndRegionFromZoneString(m.zone || 'Meknès');
      if (selectedRegion !== 'all' && resolved.regionId !== selectedRegion) return false;
      if (
        selectedCity !== 'all' &&
        normalizeCityKey(resolved.city) !== normalizeCityKey(selectedCity)
      ) {
        return false;
      }
      return true;
    });
  }, [teamStats, selectedRole, selectedRegion, selectedCity]);

  const roleAllowedUids = useMemo(
    () => new Set(roleFilteredStats.map((m) => m.uid)),
    [roleFilteredStats]
  );

  const roleFilteredContracts = useMemo(
    () =>
      selectedRole === 'all' && selectedRegion === 'all' && selectedCity === 'all'
        ? signedContracts
        : signedContracts.filter((c) => {
            if (!roleAllowedUids.has(c.ownerId)) return false;
            if (selectedRegion !== 'all' && c.ville && !doesCityBelongToRegion(c.ville, selectedRegion)) {
              return false;
            }
            if (
              selectedCity !== 'all' &&
              c.ville &&
              normalizeCityKey(c.ville) !== normalizeCityKey(selectedCity)
            ) {
              return false;
            }
            return true;
          }),
    [signedContracts, selectedRole, selectedRegion, selectedCity, roleAllowedUids]
  );

  const leaderboard = useMemo(
    () => buildTeamLeaderboard(roleFilteredStats, roleFilteredContracts),
    [roleFilteredStats, roleFilteredContracts]
  );

  const effectiveSelectedUid =
    selectedUid !== 'all' && leaderboard.some((m) => m.uid === selectedUid)
      ? selectedUid
      : 'all';

  const selectedMember = useMemo(
    () =>
      effectiveSelectedUid === 'all'
        ? null
        : leaderboard.find((m) => m.uid === effectiveSelectedUid) || null,
    [leaderboard, effectiveSelectedUid]
  );

  const monthlyEvolution = useMemo(
    () => buildTeamMonthlyEvolution(roleFilteredStats, roleFilteredContracts, effectiveSelectedUid),
    [roleFilteredStats, roleFilteredContracts, effectiveSelectedUid]
  );

  const currentMonthSummary = useMemo(
    () =>
      computeCurrentMonthPayoutSummary(
        roleFilteredContracts,
        roleFilteredStats,
        effectiveSelectedUid
      ),
    [roleFilteredContracts, roleFilteredStats, effectiveSelectedUid]
  );

  const maxMonthContracts = useMemo(
    () => Math.max(1, ...monthlyEvolution.map((m) => m.contracts)),
    [monthlyEvolution]
  );

  const maxMonthPayout = useMemo(
    () => Math.max(1, ...monthlyEvolution.map((m) => m.payoutMad)),
    [monthlyEvolution]
  );

  // Scoped KPIs (Global Team vs Role vs Selected Collaborator)
  const kpis = useMemo(() => {
    if (selectedMember) {
      return {
        contracts: selectedMember.contractsCount,
        payoutMad: selectedMember.payoutMad,
        qualified: selectedMember.qualifiedCount,
        xp: selectedMember.xp,
        badges: selectedMember.badgesCount,
        conversionPct: selectedMember.conversionPct,
      };
    }
    const contracts = leaderboard.reduce((s, r) => s + r.contractsCount, 0);
    const payoutMad = leaderboard.reduce((s, r) => s + r.payoutMad, 0);
    const qualified = leaderboard.reduce((s, r) => s + r.qualifiedCount, 0);
    const prospects = leaderboard.reduce((s, r) => s + r.prospectsCount, 0);
    const xp = leaderboard.reduce((s, r) => s + r.xp, 0);
    const badges = leaderboard.reduce((s, r) => s + r.badgesCount, 0);
    const conversionPct = Math.min(
      100,
      Math.round((contracts / Math.max(1, prospects + contracts)) * 100)
    );
    return { contracts, payoutMad, qualified, xp, badges, conversionPct };
  }, [leaderboard, selectedMember]);

  // Signed Contracts Ledger:
  // - Super-Admin / Manager / Team-Lead see team contracts (filtered by selectedRole and selectedUid if chosen)
  // - Collaborator sees ONLY their own signed contracts (without client phone/email PII)
  const visibleContracts = useMemo(() => {
    const base = canManageContracts
      ? effectiveSelectedUid === 'all'
        ? roleFilteredContracts
        : roleFilteredContracts.filter((c) => c.ownerId === effectiveSelectedUid)
      : signedContracts.filter((c) => c.ownerId === currentUserUid);
    return [...base].sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''));
  }, [signedContracts, roleFilteredContracts, canManageContracts, effectiveSelectedUid, currentUserUid]);

  const payoutBreakdown = useMemo(() => {
    let enAttente = 0;
    let valide = 0;
    let verse = 0;
    let refused = 0;
    for (const c of visibleContracts) {
      if (c.payoutStatus === 'Refusé') {
        refused += c.payoutMad;
        continue;
      }
      if (c.payoutStatus === 'Versé') verse += c.payoutMad;
      else if (c.payoutStatus === 'Validé') valide += c.payoutMad;
      else enAttente += c.payoutMad;
    }
    // Seuls Validé + Versé comptent dans le cumul confirmé
    return { enAttente, valide, verse, refused, total: valide + verse };
  }, [visibleContracts]);

  const startEditContract = (c: SignedContractRecord) => {
    setEditingContractId(c.id);
    setEditPayout(c.payoutMad);
    setEditStatus(c.payoutStatus);
    setEditRefvirement(c.referenceVirement || '');
    setEditRefusMotif(c.refusMotif || '');
    setEditError(null);
  };

  const saveEditContract = async (c: SignedContractRecord) => {
    if (!onAdminUpdateContract) return;
    if (editStatus === 'Versé' && !editRefvirement.trim()) {
      setEditError('Référence de virement obligatoire pour valider le versement.');
      return;
    }
    if (editStatus === 'Refusé' && !editRefusMotif.trim()) {
      setEditError('Motif de refus obligatoire pour rejeter un contrat.');
      return;
    }
    setEditError(null);
    setSavingContractId(c.id);
    try {
      await onAdminUpdateContract(c.id, {
        produitOrangePro: c.produitOrangePro,
        tier: c.tier,
        payoutMad: Math.max(0, Math.round(Number(editPayout) || 0)),
        payoutStatus: editStatus,
        referenceVirement: editStatus === 'Versé' ? editRefvirement.trim() : undefined,
        refusMotif: editStatus === 'Refusé' ? editRefusMotif.trim() : undefined,
      });
      setEditingContractId(null);
    } finally {
      setSavingContractId(null);
    }
  };

  const regionFilteredCities = useMemo(
    () => filterCitiesByRegion(selectedRegion, ALL_MOROCCO_CITY_NAMES),
    [selectedRegion]
  );

  const recentMonths = useMemo(() => getRecentMonthKeys(12), []);

  const scopedReportStats = useMemo(
    () =>
      effectiveSelectedUid === 'all'
        ? roleFilteredStats
        : roleFilteredStats.filter((m) => m.uid === effectiveSelectedUid),
    [roleFilteredStats, effectiveSelectedUid]
  );

  const reportFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedRole !== 'all') {
      parts.push(`Rôle : ${ROLE_BADGE_META[selectedRole]?.shortLabel || selectedRole}`);
    }
    if (selectedRegion !== 'all') {
      const reg = MOROCCO_REGIONS.find((r) => r.id === selectedRegion);
      parts.push(`Région : ${reg?.label || selectedRegion}`);
    }
    if (selectedCity !== 'all') {
      parts.push(`Ville : ${selectedCity}`);
    }
    if (selectedMember) {
      parts.push(`Collaborateur : ${selectedMember.displayName}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'Toute l’équipe · Toutes régions';
  }, [selectedRole, selectedRegion, selectedCity, selectedMember]);

  const monthReportPreview = useMemo(
    () =>
      buildMonthlyDirectionReport({
        monthKey: reportMonthKey,
        teamStats: scopedReportStats,
        signedContracts: visibleContracts,
        filtersLabel: reportFiltersLabel,
        workspaceLegal,
      }),
    [reportMonthKey, scopedReportStats, visibleContracts, reportFiltersLabel, workspaceLegal]
  );

  const handleExportDirectionReport = async (format: 'pdf' | 'csv') => {
    if (!canManageContracts || reportExportBusy) return;
    setReportExportBusy(format);
    try {
      let attendanceSessions: Array<{
        ownerId: string;
        dateKey?: string;
        loginAt?: string;
        workedSeconds: number;
      }> = [];

      // On-demand Super-Admin attendance enrichment (graceful fallback if offline)
      if (isSuperAdmin && scopedReportStats.length > 0) {
        try {
          attendanceSessions = await fetchTeamAttendanceSessionsForMonth(
            scopedReportStats.map((m) => m.uid),
            reportMonthKey
          );
        } catch {
          attendanceSessions = [];
        }
      }

      const fullReport = buildMonthlyDirectionReport({
        monthKey: reportMonthKey,
        teamStats: scopedReportStats,
        signedContracts: visibleContracts,
        attendanceSessions,
        filtersLabel: reportFiltersLabel,
        workspaceLegal,
      });

      if (format === 'pdf') {
        const filename = await generateMonthlyDirectionReportPdf(fullReport);
        onNotify?.(`Rapport Direction PDF généré (${filename}).`, 'ok');
      } else {
        const filename = downloadMonthlyPayrollExcelCsv(fullReport);
        onNotify?.(`Bordereau Excel (.csv) téléchargé (${filename}).`, 'ok');
      }
    } catch {
      onNotify?.(
        format === 'pdf'
          ? 'Impossible de générer le Rapport Direction PDF.'
          : 'Impossible d’exporter le Bordereau Excel (.csv).',
        'err'
      );
    } finally {
      setReportExportBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {canManageContracts && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-xs">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              data-testid="team-subtab-leaderboard"
              onClick={() => setSubView('leaderboard')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                subView === 'leaderboard'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              Classement &amp; Payouts
            </button>
            <button
              type="button"
              data-testid="team-subtab-portfolios"
              onClick={() => setSubView('portfolios')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                subView === 'portfolios'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Portefeuilles de l’Équipe ({teamStats.length})
            </button>
          </div>
          <span className="px-2 text-[11px] text-stone-500">
            Supervision : consulter tous les portefeuilles, attribuer et restituer des fiches
          </span>
        </div>
      )}

      {canManageContracts && subView === 'portfolios' ? (
        <TeamPortfoliosPanel
          teamStats={teamStats}
          currentUserUid={currentUserUid}
          currentUserFiches={currentUserFiches}
          initialOwnerUid={portfolioTargetUid}
          refreshKey={portfolioRefreshKey}
          onInspectFiche={(item) => onInspectPortfolioFiche?.(item)}
          onOpenQuote={(fiche, ownerUid) => onOpenPortfolioQuote?.(fiche, ownerUid)}
          onOpenAssign={(item) => onOpenPortfolioAssign?.(item)}
          onOpenRestore={(item) => onOpenPortfolioRestore?.(item)}
        />
      ) : (
      <>
      {/* Encart Rapport Direction & Bordereau de Commissions Mensuel (PDF + Excel CSV) — RBAC strict canManageContracts */}
      {canManageContracts && (
        <section
          data-testid="direction-report-export-bar"
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs space-y-3"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-orange-600 shrink-0" />
                <h3 className="text-sm font-bold text-stone-900">
                  Rapport Direction &amp; Bordereau de Commissions Mensuel
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold">
                  {formatMonthKeyFr(reportMonthKey)}
                </span>
              </div>
              <p
                data-testid="direction-report-preview-line"
                className="text-xs text-stone-600 tabular-nums"
              >
                <strong>{monthReportPreview.summary.monthContractsCount}</strong> contrat
                {monthReportPreview.summary.monthContractsCount > 1 ? 's' : ''} ·{' '}
                <strong className="text-sky-700">
                  {formatMad(monthReportPreview.summary.valideMad)}
                </strong>{' '}
                validés ·{' '}
                <strong className="text-emerald-700">
                  {formatMad(monthReportPreview.summary.verseMad)}
                </strong>{' '}
                versés · Net à régler :{' '}
                <strong className="text-orange-700">
                  {formatMad(monthReportPreview.summary.netAPayerMad)}
                </strong>
                {isSuperAdmin ? ' · Heures pointées incluses au clic' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-2.5 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                <select
                  aria-label="Sélectionner le mois du rapport Direction"
                  data-testid="direction-report-month-select"
                  value={reportMonthKey}
                  onChange={(e) => setReportMonthKey(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-stone-800 focus:outline-none"
                >
                  {recentMonths.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.key})
                    </option>
                  ))}
                  {!recentMonths.some((m) => m.key === reportMonthKey) && (
                    <option value={reportMonthKey}>
                      {formatMonthKeyFr(reportMonthKey)} ({reportMonthKey})
                    </option>
                  )}
                </select>
              </div>

              <button
                type="button"
                disabled={reportExportBusy !== null}
                data-testid="export-direction-pdf-btn"
                onClick={() => void handleExportDirectionReport('pdf')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                {reportExportBusy === 'pdf' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-orange-400" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-orange-400" />
                )}
                {reportExportBusy === 'pdf' ? 'Génération PDF...' : 'Exporter Rapport PDF'}
              </button>

              <button
                type="button"
                disabled={reportExportBusy !== null}
                data-testid="export-payroll-csv-btn"
                onClick={() => void handleExportDirectionReport('csv')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition-colors whitespace-nowrap"
              >
                {reportExportBusy === 'csv' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-700" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-emerald-700" />
                )}
                {reportExportBusy === 'csv' ? 'Export Excel...' : 'Exporter Bordereau Excel (.csv)'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Header & Collaborator Scope Filter */}
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-600" />
            <h2 className="text-base font-bold text-stone-900">
              Classement Équipe, Disponibilité Régionale &amp; Payouts
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {selectedMember
              ? `Résultats & zone de disponibilité Orange Pro de ${selectedMember.displayName} (${resolveCityAndRegionFromZoneString(selectedMember.zone).formattedZone})`
              : `Vue globale de l’équipe commerciale et de leur disponibilité par Ville & Région (${leaderboard.length} membre${leaderboard.length > 1 ? 's' : ''})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtrage de la Région à part */}
          <div className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-orange-600" />
            <select
              aria-label="Filtrer l'équipe par région"
              data-testid="team-region-filter"
              value={selectedRegion}
              onChange={(e) => {
                const nextReg = e.target.value;
                setSelectedRegion(nextReg);
                setSelectedCity('all');
                setSelectedUid('all');
              }}
              className="bg-transparent text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="all">Toutes les régions (12)</option>
              {MOROCCO_REGIONS.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Choix de l'ensemble des villes (filtrées par région) */}
          <div className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2">
            <select
              aria-label="Filtrer l'équipe par ville"
              data-testid="team-city-filter"
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedUid('all');
              }}
              className="bg-transparent text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="all">Toutes les villes ({regionFilteredCities.length})</option>
              {regionFilteredCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Sélecteur de rôle */}
          <div className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2">
            <Filter className="h-3.5 w-3.5 text-orange-600" />
            <select
              aria-label="Filtrer par rôle"
              data-testid="team-role-filter"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as 'all' | TeamRole);
                setSelectedUid('all');
              }}
              className="bg-transparent text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="all">Tous les rôles</option>
              {TEAM_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_BADGE_META[r].label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2">
            <Users className="h-3.5 w-3.5 text-stone-500" />
            <select
              aria-label="Filtrer par collaborateur"
              value={effectiveSelectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              className="bg-transparent text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="all">
                {selectedRole === 'all'
                  ? 'Vue Globale Équipe (Tous)'
                  : `Tous (${ROLE_BADGE_META[selectedRole].label})`}
              </option>
              {leaderboard.map((m) => (
                <option key={m.uid} value={m.uid}>
                  #{m.rank} {m.displayName} ({m.contractsCount} contrats)
                </option>
              ))}
            </select>
          </div>
          {(effectiveSelectedUid !== 'all' ||
            selectedRole !== 'all' ||
            selectedRegion !== 'all' ||
            selectedCity !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedRole('all');
                setSelectedRegion('all');
                setSelectedCity('all');
                setSelectedUid('all');
              }}
              className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Composant Total des Payouts Cumulés pour le Mois en Cours (basé sur TotalPayoutMad des contrats signés) */}
      <div
        data-testid="current-month-payout-card"
        className="rounded-2xl border border-orange-200 bg-white p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-700">
              <Wallet className="h-4 w-4 text-orange-600" />
              <span>Total des Payouts Cumulés — Mois en cours ({currentMonthSummary.monthLabel})</span>
              <span className="text-stone-400">·</span>
              <span className="font-mono text-stone-600 tabular-nums">{currentMonthSummary.ym}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <span
                data-testid="current-month-payout-amount"
                className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-mono tabular-nums"
              >
                {formatMad(currentMonthSummary.effectiveDisplayPayoutMad)}
              </span>
              <span className="text-xs text-stone-500">
                sur{' '}
                <strong className="text-stone-800 tabular-nums">
                  {currentMonthSummary.currentMonthContractsCount > 0
                    ? currentMonthSummary.currentMonthContractsCount
                    : currentMonthSummary.totalSignedContractsCount}
                </strong>{' '}
                contrat(s) validé(s) / versé(s)
              </span>
              {currentMonthSummary.growthPct !== null && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    currentMonthSummary.growthPct >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {currentMonthSummary.growthPct >= 0 ? '+' : ''}
                  {currentMonthSummary.growthPct}% vs mois précédent
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500">
              Calculé uniquement sur les contrats <strong className="text-stone-700">Validés ou Versés</strong> (hors En attente et Refusés) —{' '}
              {selectedMember ? `par ${selectedMember.displayName}` : 'équipe commerciale DIVERSIFIA'}.
              {currentMonthSummary.enAttenteCount > 0 && (
                <span className="ml-1.5 font-semibold text-amber-700">
                  ({currentMonthSummary.enAttenteCount} en attente : {formatMad(currentMonthSummary.enAttenteMad)} hors cumul)
                </span>
              )}
              {currentMonthSummary.refusedContractsCount > 0 && (
                <span className="ml-1.5 font-semibold text-red-700">
                  ({currentMonthSummary.refusedContractsCount} refusé
                  {currentMonthSummary.refusedContractsCount > 1 ? 's' : ''} exclu
                  {currentMonthSummary.refusedContractsCount > 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:min-w-[460px]">
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-2.5">
              <div className="text-[11px] text-stone-500">Mois ({currentMonthSummary.ym})</div>
              <div className="mt-1 text-sm font-bold text-stone-900 font-mono tabular-nums">
                {formatMad(currentMonthSummary.currentMonthPayoutMad)}
              </div>
              <div className="mt-0.5 text-[10px] text-stone-500 tabular-nums">
                {currentMonthSummary.currentMonthContractsCount} validé(s) ce mois
              </div>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-2.5">
              <div className="text-[11px] font-medium text-orange-800">Cumul Confirmé</div>
              <div
                data-testid="cumulative-total-payout-mad"
                className="mt-1 text-sm font-bold text-orange-950 font-mono tabular-nums"
              >
                {formatMad(currentMonthSummary.totalSignedPayoutMad)}
              </div>
              <div className="mt-0.5 text-[10px] text-orange-800 tabular-nums">
                {currentMonthSummary.totalSignedContractsCount} contrat(s) validé(s)
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
              <div className="text-[11px] font-medium text-amber-900">En attente (hors cumul)</div>
              <div className="mt-1 text-sm font-bold text-amber-950 font-mono tabular-nums">
                {formatMad(currentMonthSummary.enAttenteMad)}
              </div>
              <div className="mt-0.5 text-[10px] text-amber-800 tabular-nums">
                {currentMonthSummary.enAttenteCount} dossier(s) en attente
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
              <div className="text-[11px] font-medium text-emerald-800">Déjà Versé</div>
              <div className="mt-1 text-sm font-bold text-emerald-950 font-mono tabular-nums">
                {formatMad(currentMonthSummary.verseMad)}
              </div>
              <div className="mt-0.5 text-[10px] text-emerald-800 tabular-nums">
                Validé : {formatMad(currentMonthSummary.valideMad)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Contrats Signés</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-stone-900 tabular-nums">
            {kpis.contracts}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            Taux de conversion : <strong className="text-emerald-700">{kpis.conversionPct}%</strong>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>Payout Commissions</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-900 tabular-nums">
            {formatMad(kpis.payoutMad)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-stone-600">
            <span>Versé : {formatMad(payoutBreakdown.verse)}</span>
            <span>·</span>
            <span>En attente : {formatMad(payoutBreakdown.enAttente)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Pipeline Qualifié</span>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-stone-900 tabular-nums">
            {kpis.qualified}
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            RDV pris, Devis envoyés &amp; Signés
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>XP &amp; Succès Débloqués</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-stone-900 tabular-nums">
            {kpis.xp.toLocaleString('fr-FR')} <span className="text-sm font-semibold text-stone-500">XP</span>
          </div>
          <div className="mt-1 text-[11px] text-stone-500">
            {kpis.badges} badge{kpis.badges > 1 ? 's' : ''} débloqué{kpis.badges > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Selected Collaborator Distinctions Strip */}
      {selectedMember && selectedMember.manualBadges.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-stone-700 mr-1">
            Distinctions de {selectedMember.displayName} :
          </span>
          {selectedMember.manualBadges.map((bid) => (
            <BadgeChipWithDrawing key={bid} badgeId={bid} size="sm" showXp />
          ))}
        </div>
      )}

      {/* 6-Month Sales & Payout Evolution Chart */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              Évolution des ventes &amp; payouts sur 6 mois
            </h3>
            <p className="text-xs text-stone-500">
              {selectedMember
                ? `Courbe mensuelle de ${selectedMember.displayName}`
                : 'Progression consolidée de toute l’équipe Orange Pro'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-orange-500" />
              Contrats signés
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
              Payout (MAD)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2 sm:gap-4">
          {monthlyEvolution.map((pt) => {
            const cHeight = Math.max(6, Math.round((pt.contracts / maxMonthContracts) * 100));
            const pHeight = Math.max(6, Math.round((pt.payoutMad / maxMonthPayout) * 100));
            return (
              <div key={pt.ym} className="flex flex-col items-center">
                <div className="mb-1 text-[10px] font-bold text-stone-700 tabular-nums">
                  {pt.contracts > 0 ? `${pt.contracts} ctr` : '0'}
                </div>
                <div className="flex h-32 w-full items-end justify-center gap-1.5 rounded-xl bg-stone-50 px-2 pb-2 pt-3">
                  <div
                    className="w-3.5 rounded-t-md bg-orange-500 transition-all sm:w-5"
                    style={{ height: `${pt.contracts === 0 ? 4 : cHeight}%` }}
                    title={`${pt.label} : ${pt.contracts} contrat(s)`}
                  />
                  <div
                    className="w-3.5 rounded-t-md bg-emerald-500 transition-all sm:w-5"
                    style={{ height: `${pt.payoutMad === 0 ? 4 : pHeight}%` }}
                    title={`${pt.label} : ${formatMad(pt.payoutMad)}`}
                  />
                </div>
                <div className="mt-1.5 text-[11px] font-semibold text-stone-700">{pt.label}</div>
                <div className="text-[10px] font-medium text-emerald-700 tabular-nums">
                  {pt.payoutMad > 0 ? `${pt.payoutMad.toLocaleString('fr-FR')} DH` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Leaderboard Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-stone-900">
              Classement Commercial de l’Équipe (trié par Payout MAD)
            </h3>
          </div>
          <span className="text-xs text-stone-500">
            Mis à jour en temps réel selon les payouts actifs · Cliquez sur un membre pour filtrer
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Rang</th>
                <th className="px-4 py-3">Collaborateur</th>
                <th className="px-4 py-3 text-right">Contrats</th>
                <th className="px-4 py-3 text-right">Payout Total</th>
                <th className="px-4 py-3 text-right">Prospects</th>
                <th className="px-4 py-3 text-right">Qualifiés</th>
                <th className="px-4 py-3 text-right">Conversion</th>
                <th className="px-4 py-3 text-right">XP &amp; Badges</th>
                <th className="px-4 py-3">Distinctions Admin</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-stone-500">
                    Les statistiques d’équipe se synchronisent dès la première activité.
                  </td>
                </tr>
              ) : (
                leaderboard.map((row) => {
                  const isMe = row.uid === currentUserUid;
                  const isSelected = selectedUid === row.uid;
                  const rankBadge =
                    row.rank === 1
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : row.rank === 2
                        ? 'bg-stone-200 text-stone-800 border-stone-300'
                        : row.rank === 3
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : 'bg-stone-50 text-stone-600 border-stone-200';
                  return (
                    <tr
                      key={row.uid}
                      onClick={() => setSelectedUid(isSelected ? 'all' : row.uid)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-orange-50/70'
                          : 'hover:bg-stone-50/80'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-extrabold tabular-nums ${rankBadge}`}
                        >
                          #{row.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 shrink-0 flex items-center justify-center">
                            {row.avatarDataUrl ? (
                              <img
                                src={row.avatarDataUrl}
                                alt={row.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-stone-700">
                                {getUserInitials(row.displayName)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-stone-900">{row.displayName}</span>
                              {isMe && (
                                <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <RoleBadge role={row.role} showShort />
                              <span
                                data-testid={`team-member-availability-zone-${row.uid}`}
                                className="text-[11px] font-medium text-stone-600"
                              >
                                · {resolveCityAndRegionFromZoneString(row.zone || 'Meknès').formattedZone}
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                · Disponible Services Orange Pro
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="text-sm font-extrabold text-stone-900">
                          {row.contractsCount}
                        </div>
                        {row.enAttenteCount > 0 && (
                          <div className="text-[10px] font-semibold text-amber-700">
                            +{row.enAttenteCount} en attente
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="font-bold text-emerald-700">
                          {formatMad(row.payoutMad)}
                        </div>
                        {row.enAttenteMad > 0 && (
                          <div className="text-[10px] text-amber-700">
                            {formatMad(row.enAttenteMad)} en attente
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-700 tabular-nums">
                        {row.prospectsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-700 tabular-nums">
                        {row.qualifiedCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-700 tabular-nums">
                        {row.conversionPct}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div className="font-bold text-stone-900">
                          {row.xp.toLocaleString('fr-FR')} XP
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {row.badgesCount} succès
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.manualBadges.length === 0 ? (
                          <span className="text-[11px] text-stone-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.manualBadges.slice(0, 2).map((bid) => (
                              <BadgeChipWithDrawing key={bid} badgeId={bid} size="xs" />
                            ))}
                            {row.manualBadges.length > 2 && (
                              <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                                +{row.manualBadges.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUid(isSelected ? 'all' : row.uid)}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                              isSelected
                                ? 'border-orange-500 bg-orange-600 text-white'
                                : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            {isSelected ? 'Filtré' : 'Filtrer'}
                          </button>
                          {canManageContracts && (
                            <button
                              type="button"
                              onClick={() => {
                                setPortfolioTargetUid(row.uid);
                                setSubView('portfolios');
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-100"
                              title={`Consulter le portefeuille complet de ${row.displayName}`}
                            >
                              <Briefcase className="h-3 w-3" />
                              Portefeuille
                            </button>
                          )}
                          {isSuperAdmin && onOpenMemberProfileChat && !isMe && (
                            <button
                              type="button"
                              onClick={() => onOpenMemberProfileChat(row.uid)}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                              title={`Ouvrir le profil complet, le chat direct et le coaching de ${row.displayName}`}
                            >
                              <MessageCircle className="h-3 w-3" />
                              Profil / Chat
                            </button>
                          )}
                          {isSuperAdmin && onJumpToBadges && (
                            <button
                              type="button"
                              onClick={() => onJumpToBadges(row.uid)}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
                              title="Attribuer des badges à ce collaborateur"
                            >
                              <Award className="h-3 w-3" />
                              Badges
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signed Contracts & Payouts Ledger (Post-Signing Privacy Lock for Collaborators) */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-5 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-600" />
              <h3 className="text-sm font-bold text-stone-900">
                {canManageContracts
                  ? `Contrats Signés & Gestion des Payouts (${visibleContracts.length})`
                  : `Mes Contrats Signés & Payouts (${visibleContracts.length})`}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              {canManageContracts
                ? 'Ajustez les commissions MAD et validez le versement de chaque contrat signé.'
                : 'Après signature, les fiches clients sont verrouillées. Vous suivez ici votre nombre de contrats, le produit Orange Pro et votre payout.'}
            </p>
          </div>
          {!canManageContracts && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              Fiches clients verrouillées après signature
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-3">Date</th>
                {canManageContracts && <th className="px-4 py-3">Collaborateur</th>}
                <th className="px-4 py-3">Dossier / Entreprise</th>
                <th className="px-4 py-3">Produit Orange Pro</th>
                <th className="px-4 py-3">Gamme</th>
                <th className="px-4 py-3 text-right">Payout (MAD)</th>
                <th className="px-4 py-3">Statut Paiement</th>
                {canManageContracts && <th className="px-4 py-3 text-right">Validation</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleContracts.length === 0 ? (
                <tr>
                  <td colSpan={canManageContracts ? 8 : 6} className="px-4 py-8 text-center text-stone-500">
                    Aucun contrat signé enregistré pour cette sélection. Passez une fiche en statut{' '}
                    <strong>« Signé Orange Pro »</strong> pour calculer automatiquement le payout.
                  </td>
                </tr>
              ) : (
                visibleContracts.map((c) => {
                  const isEditing = editingContractId === c.id;
                  const dateLabel = c.signedAt
                    ? new Date(c.signedAt).toLocaleDateString('fr-FR')
                    : '—';
                  return (
                    <tr key={c.id} className="hover:bg-stone-50/70">
                      <td className="px-4 py-3 font-medium text-stone-600 tabular-nums">
                        {dateLabel}
                      </td>
                      {canManageContracts && (
                        <td className="px-4 py-3 font-semibold text-stone-800">{c.ownerName}</td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-bold text-stone-900">
                          {!canManageContracts && <Lock className="h-3 w-3 text-stone-400" />}
                          <span>{c.societe}</span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {c.numeroFiche ? `${c.numeroFiche} · ` : ''}
                          {c.ville || 'Maroc'}
                        </div>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 font-medium text-stone-800">
                        {c.produitOrangePro}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                          {c.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            step={50}
                            value={editPayout}
                            onChange={(e) => setEditPayout(Math.max(0, Number(e.target.value) || 0))}
                            className="w-24 rounded-lg border border-orange-400 px-2 py-1 text-right text-xs font-bold text-stone-900"
                          />
                        ) : c.payoutStatus === 'Refusé' ? (
                          <div className="flex flex-col items-end">
                            <span className="text-red-500 line-through font-semibold text-[11px]">
                              {formatMad(c.payoutMad)}
                            </span>
                            <span className="text-[10px] font-bold text-red-700">0 MAD actif</span>
                          </div>
                        ) : c.payoutStatus === 'En attente' ? (
                          <div className="flex flex-col items-end">
                            <span className="text-amber-700 font-semibold">
                              {formatMad(c.payoutMad)}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-600">
                              Hors cumul (en attente)
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-700">{formatMad(c.payoutMad)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-1.5">
                            <select
                              value={editStatus}
                              onChange={(e) => {
                                setEditStatus(e.target.value as PayoutStatus);
                                setEditError(null);
                              }}
                              className="rounded-lg border border-orange-400 bg-white px-2 py-1 text-xs font-semibold text-stone-900"
                            >
                              <option value="En attente">En attente</option>
                              <option value="Validé">Validé</option>
                              <option value="Versé">Versé</option>
                              <option value="Refusé">Refusé</option>
                            </select>
                            {editStatus === 'Versé' && (
                              <input
                                type="text"
                                placeholder="Réf. virement (ex: VIR-2026-...)"
                                value={editRefvirement}
                                onChange={(e) => {
                                  setEditRefvirement(e.target.value);
                                  setEditError(null);
                                }}
                                className="w-full rounded-md border border-emerald-400 px-2 py-1 text-[11px] text-stone-900"
                              />
                            )}
                            {editStatus === 'Refusé' && (
                              <input
                                type="text"
                                placeholder="Motif de refus obligatoire"
                                value={editRefusMotif}
                                onChange={(e) => {
                                  setEditRefusMotif(e.target.value);
                                  setEditError(null);
                                }}
                                className="w-full rounded-md border border-red-400 px-2 py-1 text-[11px] text-stone-900"
                              />
                            )}
                            {editError && (
                              <p className="text-[11px] font-medium text-red-600">{editError}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PAYOUT_STATUS_STYLES[c.payoutStatus] || PAYOUT_STATUS_STYLES['En attente']}`}
                            >
                              {c.payoutStatus}
                            </span>
                            {c.payoutStatus === 'Refusé' && c.refusMotif && (
                              <p className="mt-0.5 text-[10px] text-red-600 italic">Motif : {c.refusMotif}</p>
                            )}
                            {c.payoutStatus === 'Versé' && c.referenceVirement && (
                              <p className="mt-0.5 text-[10px] text-stone-500 font-mono">Réf : {c.referenceVirement}</p>
                            )}
                          </div>
                        )}
                      </td>
                      {canManageContracts && (
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={savingContractId === c.id}
                                onClick={() => void saveEditContract(c)}
                                className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                                title="Enregistrer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingContractId(null);
                                  setEditError(null);
                                }}
                                className="rounded-lg bg-stone-200 p-1.5 text-stone-700 hover:bg-stone-300"
                                title="Annuler"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {onOpenContractFiche && (canManageContracts || accessibleFicheIds?.has(c.ficheId)) && (
                                <button
                                  type="button"
                                  onClick={() => onOpenContractFiche(c)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-orange-50 hover:text-orange-800 hover:border-orange-200"
                                  title="Ouvrir les détails complets, l'audit, restituer ou réattribuer la fiche"
                                >
                                  <Eye className="h-3 w-3" />
                                  Fiche
                                </button>
                              )}
                              {canManageContracts && onAssignContractFiche && (
                                <button
                                  type="button"
                                  onClick={() => onAssignContractFiche(c)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-100"
                                  title="Réattribuer cette fiche signée à un collaborateur"
                                >
                                  <UserPlus className="h-3 w-3" />
                                  Attribuer
                                </button>
                              )}
                              {canManageContracts && onRestoreContractFiche && (
                                <button
                                  type="button"
                                  onClick={() => onRestoreContractFiche(c)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
                                  title="Restituer et déverrouiller cette fiche au collaborateur"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Restituer
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEditContract(c)}
                                className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                              >
                                <Pencil className="h-3 w-3" />
                                Valider / Modifier
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
