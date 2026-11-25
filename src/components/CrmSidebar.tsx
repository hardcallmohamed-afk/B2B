import React from 'react';
import {
  Award,
  Building2,
  FileText,
  GitMerge,
  Globe,
  KanbanSquare,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import type { TeamRole } from '../utils/gamification';
import { getUserInitials } from '../utils/avatarResize';
import { RoleBadge } from './RoleBadge';

export type CrmTabId =
  | 'portefeuille'
  | 'kanban'
  | 'team'
  | 'badges'
  | 'crawler'
  | 'paste'
  | 'dedup'
  | 'compte'
  | 'admin';

export const CRM_TAB_META: Record<
  CrmTabId,
  {
    section: string;
    title: string;
    subtitle: string;
  }
> = {
  portefeuille: {
    section: 'Commercial',
    title: 'Portefeuille CRM',
    subtitle: 'Prospection B2B, qualification multi-contacts & export 9 colonnes CSV',
  },
  kanban: {
    section: 'Commercial',
    title: 'Kanban Pipeline',
    subtitle: 'Glisser-déposer vos opportunités commerciales & suivi de conversion',
  },
  team: {
    section: 'Commercial',
    title: 'Équipe & Payouts',
    subtitle: 'Classement des ventes, filtres par rôle, évolution 6 mois & commissions MAD',
  },
  crawler: {
    section: 'Prospection & MDM',
    title: 'Crawler Profond N1/N2',
    subtitle: 'Exploration automatisée des annuaires & extraction des décideurs',
  },
  paste: {
    section: 'Prospection & MDM',
    title: 'Extraction HTML / CSV / JSON',
    subtitle: 'Import rapide depuis Google, LinkedIn, fichiers CSV ou sauvegardes JSON',
  },
  dedup: {
    section: 'Prospection & MDM',
    title: 'Déduplication MDM',
    subtitle: 'Fusion intelligente priorisée par nom de société & normalisation',
  },
  badges: {
    section: 'Progression',
    title: 'Succès & Badges',
    subtitle: 'Paliers de rareté, XP cumulés & distinctions de rôles Orange Pro',
  },
  compte: {
    section: 'Progression',
    title: 'Mon Compte',
    subtitle: 'Photo de profil, rôle, objectif mensuel, signature email & sécurité',
  },
  admin: {
    section: 'Administration',
    title: 'Utilisateurs & Accès',
    subtitle: 'Création de comptes, sélecteurs de rôles & coffre Cloud des clés API',
  },
};

interface CrmSidebarProps {
  activeTab: CrmTabId;
  onSelectTab: (tab: CrmTabId) => void;
  onNewFiche: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isSuperAdmin: boolean;
  counts: {
    fiches: number;
    contracts: number;
    duplicates: number;
    unlockedBadges: number;
    totalBadges: number;
    managedUsers: number;
  };
  user: {
    displayName: string;
    email: string;
    role: TeamRole;
    avatarDataUrl?: string;
    cloudSynced: boolean;
    cloudBusy: boolean;
    hasSyncError: boolean;
  };
  onSignOut: () => void;
}

interface NavItemDef {
  id: CrmTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeTone?: 'default' | 'amber' | 'orange';
}

export const CrmSidebar: React.FC<CrmSidebarProps> = ({
  activeTab,
  onSelectTab,
  onNewFiche,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  isSuperAdmin,
  counts,
  user,
  onSignOut,
}) => {
  const groups: Array<{ label: string; items: NavItemDef[] }> = [
    {
      label: 'Commercial',
      items: [
        {
          id: 'portefeuille',
          label: 'Portefeuille CRM',
          icon: Building2,
          badge: String(counts.fiches),
        },
        {
          id: 'kanban',
          label: 'Kanban Pipeline',
          icon: KanbanSquare,
        },
        {
          id: 'team',
          label: 'Équipe & Payouts',
          icon: Trophy,
          badge: counts.contracts > 0 ? String(counts.contracts) : undefined,
        },
      ],
    },
    {
      label: 'Prospection & MDM',
      items: [
        {
          id: 'crawler',
          label: 'Crawler Profond',
          icon: Globe,
        },
        {
          id: 'paste',
          label: 'Extraction / Import',
          icon: FileText,
        },
        {
          id: 'dedup',
          label: 'Déduplication MDM',
          icon: GitMerge,
          badge: counts.duplicates > 0 ? String(counts.duplicates) : undefined,
          badgeTone: counts.duplicates > 0 ? 'amber' : 'default',
        },
      ],
    },
    {
      label: 'Progression',
      items: [
        {
          id: 'badges',
          label: 'Succès & Badges',
          icon: Award,
          badge: `${counts.unlockedBadges}/${counts.totalBadges}`,
          badgeTone: 'orange',
        },
        {
          id: 'compte',
          label: 'Mon Compte',
          icon: UserIcon,
        },
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            label: 'Administration',
            items: [
              {
                id: 'admin' as CrmTabId,
                label: 'Utilisateurs & Accès',
                icon: Users,
                badge: String(counts.managedUsers),
              },
            ],
          },
        ]
      : []),
  ];

  const handleNavClick = (tab: CrmTabId) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const compact = !isMobileDrawer && collapsed;

    return (
      <div className="flex h-full flex-col bg-[#161412] text-stone-200 select-none">
        {/* Brand Header */}
        <div
          className={`flex items-center border-b border-stone-800/80 ${
            compact ? 'justify-center px-2 py-2.5' : 'justify-between px-4 py-2.5'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs">
              O
            </div>
            {!compact && (
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-tight text-white truncate leading-tight">
                  Orange Pro B2B
                </div>
                <div className="text-[10px] font-medium text-stone-400 truncate">
                  CRM · MDM · Studio IA
                </div>
              </div>
            )}
          </div>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fermer la navigation"
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            !compact && (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Réduire la barre latérale"
                title="Réduire le menu"
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Expand button when collapsed on desktop */}
        {compact && (
          <div className="flex justify-center pt-2 pb-0.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Agrandir la barre latérale"
              title="Agrandir le menu"
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Quick Create CTA */}
        <div className={compact ? 'px-2.5 py-2' : 'px-3 py-2'}>
          <button
            type="button"
            onClick={() => {
              onNewFiche();
              onCloseMobile();
            }}
            title="Nouvelle fiche prospect"
            className={`w-full rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
              compact ? 'h-8 px-0' : 'h-8 px-3'
            }`}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!compact && <span>Nouvelle fiche</span>}
          </button>
        </div>

        {/* Vertical Navigation Groups */}
        <nav
          aria-label="Navigation principale CRM"
          className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2.5 py-0.5 space-y-2"
        >
          {groups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              {!compact ? (
                <div className="px-2.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wider text-stone-500">
                  {group.label}
                </div>
              ) : (
                <div className="mx-2 my-0.5 border-t border-stone-800/80" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`crm-nav-${item.id}`}
                    title={compact ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center rounded-xl transition-colors text-xs whitespace-nowrap ${
                      compact
                        ? 'justify-center px-0 py-2'
                        : 'justify-between gap-2 px-2.5 py-1.5'
                    } ${
                      active
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25 font-semibold'
                        : 'text-stone-300 border border-transparent hover:bg-white/5 hover:text-white font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-orange-400' : 'text-stone-400'
                        }`}
                      />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </span>
                    {!compact && item.badge && (
                      <span
                        className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md shrink-0 ${
                          item.badgeTone === 'amber'
                            ? 'bg-amber-500/20 text-amber-300'
                            : item.badgeTone === 'orange'
                              ? 'bg-orange-500/20 text-orange-300'
                              : active
                                ? 'bg-orange-500/25 text-orange-200'
                                : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Profile & Session Footer */}
        <div className="border-t border-stone-800/80 p-2 space-y-1.5">
          {!compact ? (
            <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-2 space-y-1.5">
              <button
                type="button"
                onClick={() => handleNavClick('compte')}
                className="w-full flex items-center gap-2 text-left group"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-stone-700 bg-stone-800 flex items-center justify-center shrink-0">
                  {user.avatarDataUrl ? (
                    <img
                      src={user.avatarDataUrl}
                      alt={user.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-extrabold text-orange-400">
                      {getUserInitials(user.displayName, user.email)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-100 truncate max-w-[105px] group-hover:text-orange-300 transition-colors">
                      {user.displayName}
                    </span>
                    <RoleBadge role={user.role} showShort />
                  </div>
                </div>
                <Settings className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-200 shrink-0" />
              </button>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-800 text-[10px]">
                <span className="text-stone-400 truncate">
                  {user.hasSyncError
                    ? 'Synchro Cloud à relancer'
                    : user.cloudBusy
                      ? 'Synchro Cloud...'
                      : user.cloudSynced
                        ? 'Cloud Firestore actif'
                        : 'Session active'}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-stone-400 hover:text-red-400 font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  Quitter
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleNavClick('compte')}
                title={`${user.displayName} — Mon Compte`}
                className="w-8 h-8 rounded-lg overflow-hidden border border-stone-700 bg-stone-800 flex items-center justify-center hover:border-orange-500 transition-colors"
              >
                {user.avatarDataUrl ? (
                  <img
                    src={user.avatarDataUrl}
                    alt={user.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] font-extrabold text-orange-400">
                    {getUserInitials(user.displayName, user.email)}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Vertical CRM Sidebar */}
      <aside
        data-testid="crm-vertical-sidebar"
        className={`hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen overflow-hidden shrink-0 border-r border-stone-800/80 transition-[width] duration-200 z-30 ${
          collapsed ? 'w-[72px]' : 'w-[256px]'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true" aria-label="Menu CRM">
          <div
            className="fixed inset-0 bg-stone-950/60 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[84vw] h-full shadow-2xl z-10">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
