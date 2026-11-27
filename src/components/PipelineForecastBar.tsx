import React, { useMemo } from 'react';
import { TrendingUp, Target, Clock, Layers } from 'lucide-react';
import type { FicheEntreprise } from '../utils/crmDomain';
import type { AdvancedAccountPreferences } from '../utils/accountPreferences';
import type { OrgSettingsConfig } from '../utils/securityHardening';
import { computeWeightedPipelineForecast } from '../utils/salesIntelligence';

interface PipelineForecastBarProps {
  fiches: FicheEntreprise[];
  orgSettings?: OrgSettingsConfig | null;
  monthlyGoalPayoutMad?: number;
  rottingThreshold?: AdvancedAccountPreferences['followUpAlertDelay'] | number;
  onlyRottingActive?: boolean;
  onToggleRottingFilter?: () => void;
}

function formatMad(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

export const PipelineForecastBar: React.FC<PipelineForecastBarProps> = ({
  fiches,
  orgSettings,
  monthlyGoalPayoutMad = 15000,
  rottingThreshold,
  onlyRottingActive = false,
  onToggleRottingFilter,
}) => {
  const forecast = useMemo(
    () =>
      computeWeightedPipelineForecast(fiches, {
        orgSettings,
        monthlyGoalPayoutMad,
        rottingThresholdHours: rottingThreshold ?? orgSettings?.defaultSlaRottingHours ?? 72,
      }),
    [fiches, orgSettings, monthlyGoalPayoutMad, rottingThreshold]
  );

  const clampedBarPct = Math.min(100, Math.max(0, forecast.goalProgressPct));

  return (
    <div
      data-testid="pipeline-forecast-bar"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xs"
    >
      <div className="rounded-xl bg-stone-50 border border-stone-200/80 px-3.5 py-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-500">
          <span>Pipeline brut</span>
          <Layers className="w-3.5 h-3.5 text-stone-400" />
        </div>
        <p className="text-base font-extrabold text-stone-900 tabular-nums mt-0.5">
          {formatMad(forecast.grossPipelineMad)}
        </p>
        <p className="text-[11px] text-stone-500 tabular-nums">
          {forecast.activeDealsCount} affaire(s) active(s) en cours
        </p>
      </div>

      <div className="rounded-xl bg-orange-50/70 border border-orange-200/80 px-3.5 py-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-orange-800">
          <span>Prévisionnel pondéré</span>
          <TrendingUp className="w-3.5 h-3.5 text-orange-600" />
        </div>
        <p className="text-base font-extrabold text-orange-700 tabular-nums mt-0.5">
          {formatMad(forecast.weightedForecastMad)}
        </p>
        <p className="text-[11px] text-orange-900/70 tabular-nums">
          Dont {formatMad(forecast.signedRevenueMad)} signé (10–75% pondéré)
        </p>
      </div>

      <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/80 px-3.5 py-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
          <span>Progression objectif mensuel</span>
          <Target className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          <p className="text-base font-extrabold text-emerald-700 tabular-nums">
            {forecast.goalProgressPct}%
          </p>
          <span className="text-[11px] text-stone-500 tabular-nums">
            Cible : {formatMad(forecast.monthlyGoalMad)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${clampedBarPct}%` }}
          />
        </div>
      </div>

      <div
        className={`rounded-xl border px-3.5 py-2.5 flex flex-col justify-between transition-colors ${
          onlyRottingActive
            ? 'bg-red-50 border-red-400'
            : forecast.rottingDealsCount > 0
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-stone-50 border-stone-200/80'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
          <span>Affaires dormantes à relancer</span>
          <Clock
            className={`w-3.5 h-3.5 ${
              forecast.rottingDealsCount > 0 ? 'text-amber-600' : 'text-stone-400'
            }`}
          />
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={`text-base font-extrabold tabular-nums ${
              forecast.rottingDealsCount > 0 ? 'text-amber-800' : 'text-stone-800'
            }`}
          >
            {forecast.rottingDealsCount}
          </p>
          {onToggleRottingFilter && (
            <button
              type="button"
              onClick={onToggleRottingFilter}
              aria-pressed={onlyRottingActive}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                onlyRottingActive
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {onlyRottingActive ? 'Filtre actif' : 'Filtrer'}
            </button>
          )}
        </div>
        <p className="text-[11px] text-stone-500">
          Seuil SLA inactivité configuré
        </p>
      </div>
    </div>
  );
};
