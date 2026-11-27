import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  Compass,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { SECTEURS_META, type FicheEntreprise } from '../utils/crmDomain';
import { ROLE_BADGE_META, type TeamRole, type TeamStatRecord } from '../utils/gamification';
import {
  runGlobalSearch,
  type GlobalSearchActionHit,
  type GlobalSearchItem,
} from '../utils/globalSearch';

interface GlobalSearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  fiches: FicheEntreprise[];
  teamStats: TeamStatRecord[];
  role: TeamRole | string;
  isSuperAdmin: boolean;
  onSelectFiche: (fiche: FicheEntreprise) => void;
  onSelectCollaborator: (member: TeamStatRecord) => void;
  onSelectAction: (action: GlobalSearchActionHit) => void;
}

export const GlobalSearchPalette: React.FC<GlobalSearchPaletteProps> = ({
  isOpen,
  onClose,
  fiches,
  teamStats,
  role,
  isSuperAdmin,
  onSelectFiche,
  onSelectCollaborator,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const results = useMemo(
    () =>
      runGlobalSearch({
        query,
        fiches,
        teamStats,
        role,
        isSuperAdmin,
      }),
    [query, fiches, teamStats, role, isSuperAdmin]
  );

  // Reset and auto-focus when opening
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Clamp activeIndex when result list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep selected item visible when navigating with keyboard
  useEffect(() => {
    if (!isOpen) return;
    const el = itemRefs.current.get(activeIndex);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  const executeItem = (item: GlobalSearchItem) => {
    onClose();
    if (item.kind === 'fiche') {
      onSelectFiche(item.fiche);
    } else if (item.kind === 'collaborator') {
      onSelectCollaborator(item.member);
    } else {
      onSelectAction(item);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const count = results.flatItems.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (count === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results.flatItems[activeIndex] || results.flatItems[0];
      if (target) executeItem(target);
    }
  };

  // Compute flat indices for grouped sections (order matches results.flatItems)
  const isStarterMode = results.query.length === 0;
  let runningIdx = 0;
  const sections: Array<{
    key: string;
    title: string;
    items: Array<{ item: GlobalSearchItem; flatIndex: number }>;
  }> = [];

  if (isStarterMode) {
    if (results.actions.length > 0) {
      sections.push({
        key: 'actions',
        title: 'Actions rapides & Navigation',
        items: results.actions.map((item) => ({ item, flatIndex: runningIdx++ })),
      });
    }
    if (results.fiches.length > 0) {
      sections.push({
        key: 'fiches',
        title: 'Fiches récentes du portefeuille',
        items: results.fiches.map((item) => ({ item, flatIndex: runningIdx++ })),
      });
    }
  } else {
    if (results.fiches.length > 0) {
      sections.push({
        key: 'fiches',
        title: `Fiches prospects (${results.fiches.length})`,
        items: results.fiches.map((item) => ({ item, flatIndex: runningIdx++ })),
      });
    }
    if (results.collaborators.length > 0) {
      sections.push({
        key: 'collaborators',
        title: `Collaborateurs & Équipe (${results.collaborators.length})`,
        items: results.collaborators.map((item) => ({ item, flatIndex: runningIdx++ })),
      });
    }
    if (results.actions.length > 0) {
      sections.push({
        key: 'actions',
        title: `Navigation & Actions rapides (${results.actions.length})`,
        items: results.actions.map((item) => ({ item, flatIndex: runningIdx++ })),
      });
    }
  }

  itemRefs.current.clear();

  const renderActionIcon = (action: GlobalSearchActionHit) => {
    if (action.actionType === 'new_fiche') {
      return <Plus className="w-4 h-4 text-orange-600 shrink-0" />;
    }
    if (action.actionType === 'open_copilot') {
      return <Bot className="w-4 h-4 text-stone-800 shrink-0" />;
    }
    if (action.actionType === 'open_hygiene') {
      return <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    return <Compass className="w-4 h-4 text-stone-500 shrink-0" />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale CRM"
      data-testid="global-search-palette"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-[2px] flex items-start justify-center p-3 sm:pt-16 sm:px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-200 bg-stone-50/70">
          <Search className="w-4 h-4 text-orange-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une société, OP-..., téléphone (06 / +212), collaborateur ou onglet..."
            aria-label="Recherche globale CRM"
            data-testid="global-search-input"
            className="flex-1 bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Effacer la recherche"
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la recherche globale"
            className="px-2 py-1 rounded-md border border-stone-200 bg-white text-[11px] font-mono font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 shrink-0"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 divide-y divide-stone-100">
          {sections.length === 0 ? (
            <div className="py-10 px-6 text-center space-y-1.5">
              <p className="text-sm font-semibold text-stone-800">
                Aucun résultat pour « {results.query} »
              </p>
              <p className="text-xs text-stone-500">
                Essayez un nom de société, un code OP-..., un numéro marocain (0661 / +212661), un collaborateur ou un onglet.
              </p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key} className="py-2">
                <div className="px-4 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {section.title}
                </div>
                <div className="px-2 space-y-0.5">
                  {section.items.map(({ item, flatIndex }) => {
                    const isActive = flatIndex === activeIndex;
                    return (
                      <button
                        key={item.id}
                        ref={(el) => {
                          if (el) itemRefs.current.set(flatIndex, el);
                        }}
                        type="button"
                        data-testid={`global-search-item-${item.id}`}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => executeItem(item)}
                        className={`w-full text-left px-3 py-2.5 min-h-[44px] rounded-xl flex items-center justify-between gap-3 transition-colors ${
                          isActive
                            ? 'bg-orange-50 text-stone-900 ring-1 ring-orange-200'
                            : 'hover:bg-stone-50 text-stone-800'
                        }`}
                      >
                        {item.kind === 'fiche' && (
                          <>
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div className="mt-0.5 p-1.5 rounded-lg bg-stone-100 text-stone-700 shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.fiche.numeroFiche && (
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                                      {item.fiche.numeroFiche}
                                    </span>
                                  )}
                                  <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                                    {item.fiche.societe}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                    {item.fiche.statut}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
                                  {item.fiche.ville && (
                                    <span className="inline-flex items-center gap-0.5">
                                      <MapPin className="w-3 h-3 text-orange-600" />
                                      {item.fiche.ville}
                                    </span>
                                  )}
                                  {item.fiche.telephone && (
                                    <span className="inline-flex items-center gap-0.5 font-mono text-stone-700">
                                      <Phone className="w-3 h-3 text-stone-400" />
                                      {item.fiche.telephone}
                                    </span>
                                  )}
                                  {item.fiche.contact && (
                                    <span className="truncate">{item.fiche.contact}</span>
                                  )}
                                  <span className="text-stone-400">
                                    · {(SECTEURS_META[item.fiche.secteur] || SECTEURS_META.pme).label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-orange-600' : 'text-stone-300'
                              }`}
                            />
                          </>
                        )}

                        {item.kind === 'collaborator' && (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <Users className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                                    {item.member.displayName}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                                    {ROLE_BADGE_META[item.member.role]?.shortLabel || item.member.role}
                                  </span>
                                </div>
                                <div className="text-[11px] text-stone-500 flex items-center gap-2">
                                  <span>Zone : {item.member.zone || 'Maroc'}</span>
                                  <span>·</span>
                                  <span>{item.member.totalProspects} prospects</span>
                                </div>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-orange-600' : 'text-stone-300'
                              }`}
                            />
                          </>
                        )}

                        {item.kind === 'action' && (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="p-1.5 rounded-lg bg-stone-100 shrink-0">
                                {renderActionIcon(item)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
                                  {item.label}
                                </div>
                                <div className="text-[11px] text-stone-500 truncate">
                                  {item.subtitle}
                                </div>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-orange-600' : 'text-stone-300'
                              }`}
                            />
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="px-4 py-2 border-t border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-stone-300 bg-white font-mono text-[10px] text-stone-700">
                ↑↓
              </kbd>
              Naviguer
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-stone-300 bg-white font-mono text-[10px] text-stone-700">
                ↵
              </kbd>
              Ouvrir
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-stone-300 bg-white font-mono text-[10px] text-stone-700">
                Esc
              </kbd>
              Fermer
            </span>
          </div>
          <span className="font-mono text-[10px] text-stone-400">
            CRM DIVERSIFIA · Recherche instantanée
          </span>
        </div>
      </div>
    </div>
  );
};
