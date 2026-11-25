import React, { useMemo, useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import {
  ADMIN_DISTINCTION_BADGES,
  RARITY_META,
  RARITY_ORDER,
  ROLE_BADGE_META,
  TEAM_ROLE_ORDER,
  evaluateAchievements,
  type CollaboratorMetrics,
  type EvaluatedAchievement,
  type TeamRole,
  type TeamStatRecord,
} from '../utils/gamification';
import { BadgeArtwork, BadgeChipWithDrawing } from './BadgeArtwork';
import { RoleBadge } from './RoleBadge';

type SortMode = 'progress_desc' | 'xp_desc' | 'unlocked_first';

interface AchievementsPanelProps {
  currentUserUid: string;
  currentUserName: string;
  currentUserRole?: TeamRole;
  isSuperAdmin: boolean;
  myMetrics: CollaboratorMetrics;
  teamStats: TeamStatRecord[];
  initialSelectedUid?: string | null;
  onAdminToggleManualBadge?: (targetUid: string, nextBadges: string[]) => Promise<void>;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  currentUserUid,
  currentUserName,
  currentUserRole,
  isSuperAdmin,
  myMetrics,
  teamStats,
  initialSelectedUid,
  onAdminToggleManualBadge,
}) => {
  const [selectedUid, setSelectedUid] = useState<string>(
    initialSelectedUid || currentUserUid
  );
  const [roleFilter, setRoleFilter] = useState<'all' | TeamRole>('all');
  const [hideUnlocked, setHideUnlocked] = useState(false);
  const [hideLocked, setHideLocked] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('progress_desc');
  const [busyBadgeId, setBusyBadgeId] = useState<string | null>(null);

  const roleFilteredMembers = useMemo(
    () =>
      teamStats.filter(
        (s) => s.uid !== currentUserUid && (roleFilter === 'all' || s.role === roleFilter)
      ),
    [teamStats, currentUserUid, roleFilter]
  );

  const effectiveUid = isSuperAdmin ? selectedUid || currentUserUid : currentUserUid;
  const selectedStat = useMemo(
    () => teamStats.find((s) => s.uid === effectiveUid) || null,
    [teamStats, effectiveUid]
  );

  // Build metrics for the viewed user: exact live metrics for self, synced team_stats metrics for another collaborator
  const evaluated = useMemo(() => {
    const manualBadges = selectedStat?.manualBadges || [];
    if (effectiveUid === currentUserUid) {
      return evaluateAchievements(myMetrics, manualBadges);
    }
    const approxMetrics: CollaboratorMetrics = {
      totalProspects: selectedStat?.totalProspects ?? 0,
      qualifiedCount: selectedStat?.totalQualified ?? 0,
      contractsCount: selectedStat?.totalContracts ?? 0,
      grandCompteContracts: Math.floor((selectedStat?.totalContracts ?? 0) / 4),
      pmeContracts: Math.floor((selectedStat?.totalContracts ?? 0) / 2),
      totalPayoutMad: selectedStat?.totalPayoutMad ?? 0,
      multiContactFiches: Math.floor((selectedStat?.totalProspects ?? 0) / 3),
      highMaturityFiches: Math.floor((selectedStat?.totalProspects ?? 0) / 2),
      distinctCities: selectedStat?.totalProspects ? Math.min(8, Math.max(1, Math.ceil(selectedStat.totalProspects / 6))) : 0,
    };
    return evaluateAchievements(approxMetrics, manualBadges);
  }, [effectiveUid, currentUserUid, myMetrics, selectedStat]);

  const viewedName =
    effectiveUid === currentUserUid
      ? currentUserName
      : selectedStat?.displayName || 'Collaborateur';

  const viewedRole: TeamRole =
    effectiveUid === currentUserUid
      ? currentUserRole || (isSuperAdmin ? 'super_admin' : 'commercial')
      : selectedStat?.role || 'commercial';

  const roleDistinctionBadges = useMemo(
    () => ADMIN_DISTINCTION_BADGES.filter((b) => b.category === 'role'),
    []
  );
  const perfDistinctionBadges = useMemo(
    () => ADMIN_DISTINCTION_BADGES.filter((b) => b.category !== 'role'),
    []
  );

  const handleToggleManualBadge = async (badgeId: string) => {
    if (!isSuperAdmin || !onAdminToggleManualBadge) return;
    const current = selectedStat?.manualBadges || [];
    const exists = current.includes(badgeId);
    const next = exists ? current.filter((b) => b !== badgeId) : [...current, badgeId];
    setBusyBadgeId(badgeId);
    try {
      await onAdminToggleManualBadge(effectiveUid, next);
    } finally {
      setBusyBadgeId(null);
    }
  };

  const sortItems = (list: EvaluatedAchievement[]) => {
    const filtered = list.filter((item) => {
      if (hideUnlocked && item.unlocked) return false;
      if (hideLocked && !item.unlocked) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortMode === 'xp_desc') return b.xpBoost - a.xpBoost || b.progressPct - a.progressPct;
      if (sortMode === 'unlocked_first') {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return b.progressPct - a.progressPct;
      }
      return b.progressPct - a.progressPct || b.xpBoost - a.xpBoost;
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Hero Grid matching reference screenshot layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Hero Summary Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs lg:col-span-5">
          <div>
            <div className="flex items-start gap-4">
              <BadgeArtwork
                badgeId="admin_legend_hall"
                iconKey="trophy"
                rarity="legendaire"
                size="xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold text-stone-900">Succès &amp; Badges</h2>
                  <RoleBadge role={viewedRole} size="sm" />
                  <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-800">
                    Rang {evaluated.rankNumber} · {evaluated.rankTitle}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-stone-600">
                  Suivez votre progression commerciale Orange Pro, débloquez des récompenses par
                  palier de rareté et cumulez de l’XP en signant des contrats B2B.
                </p>
              </div>
            </div>

            {(selectedStat?.manualBadges?.length || 0) > 0 && (
              <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500 mr-1">
                  Badges attribués :
                </span>
                {(selectedStat?.manualBadges || []).map((bid) => (
                  <BadgeChipWithDrawing key={bid} badgeId={bid} size="xs" />
                ))}
              </div>
            )}
          </div>

          {/* 3 Main Stat Blocks */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Succès débloqués
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-stone-900 tabular-nums">
                  {evaluated.unlockedCount}
                </span>
                <span className="text-xs font-semibold text-stone-500">
                  /{evaluated.totalCount}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-orange-700">
                XP total gagné
              </div>
              <div className="mt-1 text-2xl font-extrabold text-stone-900 tabular-nums">
                {evaluated.totalXp.toLocaleString('fr-FR')}
              </div>
              <div className="text-[10px] font-medium text-stone-500">XP</div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                Taux complétion
              </div>
              <div className="mt-1 text-2xl font-extrabold text-stone-900 tabular-nums">
                {evaluated.completionPct}%
              </div>
              <div className="text-[10px] font-medium text-stone-500">Total</div>
            </div>
          </div>
        </div>

        {/* Right Top Panel: 5 Rarity Tier Strip + "À suivre - Proche du déverrouillage" */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          {/* 5 Rarity Tier Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RARITY_ORDER.map((rarity) => {
              const meta = RARITY_META[rarity];
              const stat = evaluated.byRarity[rarity];
              return (
                <div
                  key={rarity}
                  className={`rounded-xl border p-2.5 shadow-2xs ${meta.headerBg} ${meta.borderColor}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[11px] font-extrabold ${meta.headerText}`}>
                      {meta.label}
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${meta.headerText}`}>
                      {stat.unlocked}/{stat.total}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/15">
                    <div
                      className="h-full rounded-full bg-white/90 transition-all"
                      style={{ width: `${stat.pct}%` }}
                    />
                  </div>
                  <div className={`mt-1.5 text-[10px] font-bold opacity-90 ${meta.headerText}`}>
                    +{meta.tierBonusXp.toLocaleString('fr-FR')} XP
                  </div>
                </div>
              );
            })}
          </div>

          {/* "À suivre - Proche du déverrouillage" */}
          <div className="flex-1 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-stone-700">
                À suivre — Proche du déverrouillage
              </h3>
              <span className="text-[11px] font-medium text-stone-500">{viewedName}</span>
            </div>
            {evaluated.nextToUnlock.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                Tous les succès automatiques sont débloqués ! Performance exceptionnelle.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {evaluated.nextToUnlock.map((item) => {
                  const meta = RARITY_META[item.rarity];
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BadgeArtwork
                            badgeId={item.id}
                            iconKey={item.iconKey}
                            rarity={item.rarity}
                            unlocked={false}
                            size="sm"
                          />
                          <span className="truncate text-xs font-bold text-stone-900">
                            {item.title}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${meta.pillBg} ${meta.pillText}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                          className={`h-full rounded-full ${meta.barColor}`}
                          style={{ width: `${Math.max(4, item.progressPct)}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-stone-600 tabular-nums">
                        <span>
                          {item.current.toLocaleString('fr-FR')}/
                          {item.target.toLocaleString('fr-FR')}
                          {item.unit ? ` ${item.unit}` : ''}
                        </span>
                        <span className="font-bold text-stone-900">{item.progressPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Super-Admin Exclusive Badge Attribution Console */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/70 via-white to-orange-50/40 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-bold text-stone-900">
                  Attribution de Badges de Distinction (Super-Admin uniquement)
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-stone-600">
                Sélectionnez un collaborateur pour consulter ses succès et lui attribuer ou retirer
                des distinctions officielles Orange Pro.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrer collaborateurs par rôle"
                data-testid="badges-role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | TeamRole)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 focus:border-violet-500 focus:outline-none"
              >
                <option value="all">Tous les rôles</option>
                {TEAM_ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_BADGE_META[r].label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Collaborateur cible pour attribution de badges"
                value={effectiveUid}
                onChange={(e) => setSelectedUid(e.target.value)}
                className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-stone-900 focus:border-violet-500 focus:outline-none"
              >
                <option value={currentUserUid}>Moi-même ({currentUserName})</option>
                {roleFilteredMembers.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {s.displayName} · {ROLE_BADGE_META[s.role]?.shortLabel || s.role} ({s.zone || 'Meknès'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {/* Groupe 1 : Badges de Rôles & Responsabilités */}
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-800">
                Badges de Rôles &amp; Responsabilités
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {roleDistinctionBadges.map((badge) => {
                  const awarded = (selectedStat?.manualBadges || []).includes(badge.id);
                  const meta = RARITY_META[badge.rarity];
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      disabled={busyBadgeId === badge.id}
                      onClick={() => void handleToggleManualBadge(badge.id)}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                        awarded
                          ? 'border-indigo-500 bg-indigo-50 shadow-2xs'
                          : 'border-stone-200 bg-white hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BadgeArtwork
                          badgeId={badge.id}
                          iconKey={badge.iconKey}
                          rarity={badge.rarity}
                          unlocked={true}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-xs font-bold text-stone-900 leading-snug">
                            {badge.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-stone-500">
                            <span
                              className={`rounded-xs px-1 py-0.2 font-bold ${meta.pillBg} ${meta.pillText}`}
                            >
                              {meta.label}
                            </span>
                            <span>+{badge.xpBoost} XP</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                          awarded
                            ? 'bg-indigo-600 text-white'
                            : 'border border-stone-300 bg-stone-50 text-stone-700'
                        }`}
                      >
                        {awarded ? (
                          <>
                            <Check className="h-3 w-3" /> Actif
                          </>
                        ) : (
                          'Attribuer'
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Groupe 2 : Distinctions de Performance */}
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-violet-800">
                Distinctions de Performance
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {perfDistinctionBadges.map((badge) => {
                  const awarded = (selectedStat?.manualBadges || []).includes(badge.id);
                  const meta = RARITY_META[badge.rarity];
                  return (
                    <button
                      key={badge.id}
                      type="button"
                      disabled={busyBadgeId === badge.id}
                      onClick={() => void handleToggleManualBadge(badge.id)}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all ${
                        awarded
                          ? 'border-violet-500 bg-violet-50 shadow-2xs'
                          : 'border-stone-200 bg-white hover:border-violet-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BadgeArtwork
                          badgeId={badge.id}
                          iconKey={badge.iconKey}
                          rarity={badge.rarity}
                          unlocked={true}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-xs font-bold text-stone-900 leading-snug">
                            {badge.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-500">
                            <span
                              className={`rounded-xs px-1.5 py-0.2 font-bold ${meta.pillBg} ${meta.pillText}`}
                            >
                              {meta.label}
                            </span>
                            <span>+{badge.xpBoost} XP</span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                          awarded
                            ? 'bg-violet-600 text-white'
                            : 'border border-stone-300 bg-stone-50 text-stone-700'
                        }`}
                      >
                        {awarded ? (
                          <>
                            <Check className="h-3 w-3" /> Attribué
                          </>
                        ) : (
                          'Attribuer'
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Sort Controls Bar (matching screenshot) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-stone-700">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideUnlocked}
              onChange={(e) => setHideUnlocked(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
            />
            Masquer les succès débloqués
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={hideLocked}
              onChange={(e) => setHideLocked(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
            />
            Masquer les succès verrouillés
          </label>
        </div>

        <select
          aria-label="Trier les succès"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 focus:border-orange-500 focus:outline-none"
        >
          <option value="progress_desc">Progression (décroissante)</option>
          <option value="xp_desc">Boost XP (décroissant)</option>
          <option value="unlocked_first">Débloqués en premier</option>
        </select>
      </div>

      {/* 5 Colored Rarity Tier Sections */}
      <div className="space-y-5">
        {RARITY_ORDER.map((rarity) => {
          const meta = RARITY_META[rarity];
          const stat = evaluated.byRarity[rarity];
          const sectionItems = sortItems(evaluated.items.filter((i) => i.rarity === rarity));

          return (
            <section
              key={rarity}
              className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs"
            >
              {/* Colored Rarity Banner Header */}
              <div
                className={`flex items-center justify-between px-4 py-2.5 ${meta.headerBg} ${meta.headerText}`}
              >
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  {meta.label}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold tabular-nums">
                  <Lock className="h-3.5 w-3.5 opacity-80" />
                  Débloqué {stat.unlocked}/{stat.total}
                </span>
              </div>

              {sectionItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-stone-500">
                  Aucun succès visible dans cette catégorie avec les filtres actifs.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {sectionItems.map((item) => {
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                          item.unlocked
                            ? 'border-stone-200 bg-white shadow-2xs'
                            : 'border-stone-200/80 bg-stone-50/70'
                        }`}
                      >
                        <div>
                          <div className="flex flex-col items-center text-center">
                            <BadgeArtwork
                              badgeId={item.id}
                              iconKey={item.iconKey}
                              rarity={item.rarity}
                              unlocked={item.unlocked}
                              size="lg"
                            />

                            <h4 className="mt-3 text-xs font-extrabold text-stone-900">
                              {item.title}
                            </h4>
                            <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-stone-600">
                              {item.description}
                            </p>
                          </div>

                          <div className="mt-3 flex justify-center">
                            <span
                              className={`inline-block w-full rounded-md py-1 text-center text-[10px] font-extrabold ${meta.pillBg} ${meta.pillText}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-2.5 text-[11px]">
                          <div className="flex items-center justify-between text-stone-600">
                            <span>Boost XP :</span>
                            <span className="font-bold text-stone-900 tabular-nums">
                              +{item.xpBoost.toLocaleString('fr-FR')} XP
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-stone-600">
                            <span>Type d’XP :</span>
                            <span className="font-semibold text-stone-800">{item.xpType}</span>
                          </div>

                          {item.unlocked ? (
                            <div className="flex items-center justify-between pt-1 text-[11px] font-bold text-emerald-700">
                              <span>Statut</span>
                              <span className="inline-flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> Débloqué
                              </span>
                            </div>
                          ) : (
                            <div className="pt-1">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-stone-500 tabular-nums">
                                <span>Progression</span>
                                <span>
                                  {item.current.toLocaleString('fr-FR')}/
                                  {item.target.toLocaleString('fr-FR')}
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                                <div
                                  className={`h-full rounded-full ${meta.barColor}`}
                                  style={{ width: `${Math.max(item.current > 0 ? 5 : 0, item.progressPct)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
