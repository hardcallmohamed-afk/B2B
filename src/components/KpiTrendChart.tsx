import React, { useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import type { FicheEntreprise, SegmentCouleur } from '../App';
import {
  buildKpiTrendSeries,
  type TrendMetricMode,
  type TrendPeriod,
} from '../utils/analytics';

interface KpiTrendChartProps {
  fiches: FicheEntreprise[];
  totalUnfilteredCount: number;
}

const SEGMENT_SERIES: { key: SegmentCouleur; label: string; stroke: string }[] = [
  { key: 'bleu', label: 'Bleu', stroke: '#2563eb' },
  { key: 'vert', label: 'Vert', stroke: '#059669' },
  { key: 'orange', label: 'Orange', stroke: '#ea580c' },
  { key: 'jaune', label: 'Jaune', stroke: '#d97706' },
  { key: 'violet', label: 'Violet', stroke: '#7c3aed' },
  { key: 'cyan', label: 'Cyan', stroke: '#0891b2' },
];

function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const midX = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${midX} ${prev.y.toFixed(1)}, ${midX} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(coords: { x: number; y: number }[], baselineY: number): string {
  if (coords.length === 0) return '';
  const line = buildSmoothPath(coords);
  const last = coords[coords.length - 1];
  const first = coords[0];
  return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export const KpiTrendChart: React.FC<KpiTrendChartProps> = ({ fiches, totalUnfilteredCount }) => {
  const [period, setPeriod] = useState<TrendPeriod>('30d');
  const [metricMode, setMetricMode] = useState<TrendMetricMode>('pipeline');
  const [collapsed, setCollapsed] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const summary = useMemo(() => buildKpiTrendSeries(fiches, period), [fiches, period]);
  const points = summary.points;

  const width = 1240;
  const height = 225;
  const padLeft = 40;
  const padRight = 22;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baselineY = padTop + plotH;

  const maxY = useMemo(() => {
    if (metricMode === 'maturity') return 100;
    if (metricMode === 'pipeline') {
      const m = Math.max(...points.map((p) => p.totalFiches), 4);
      return Math.ceil(m * 1.15);
    }
    const maxSeg = Math.max(
      ...points.flatMap((p) => SEGMENT_SERIES.map((s) => p.segments[s.key])),
      3
    );
    return Math.ceil(maxSeg * 1.2);
  }, [metricMode, points]);

  const xFor = (idx: number) =>
    points.length <= 1 ? padLeft : padLeft + (idx / (points.length - 1)) * plotW;

  const yFor = (val: number) => {
    const ratio = maxY > 0 ? Math.max(0, Math.min(1, val / maxY)) : 0;
    return padTop + plotH - ratio * plotH;
  };

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = Math.round((maxY * i) / steps);
      return { val, y: yFor(val) };
    });
  }, [maxY]);

  const activePoint =
    activeIndex !== null && points[activeIndex]
      ? points[activeIndex]
      : points[points.length - 1];

  const isFiltered = fiches.length !== totalUnfilteredCount;

  return (
    <section
      aria-label="Tendance KPI Portefeuille Orange Pro"
      data-testid="kpi-trend-chart"
      className="bg-white rounded-xl border border-stone-200 overflow-hidden"
    >
      {/* En-tête compact + contrôles */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-stone-900">
                Évolution KPI &amp; Dynamique Pipeline
              </h2>
              <span className="text-xs text-stone-500 tabular-nums">
                {isFiltered
                  ? `Vue filtrée (${fiches.length}/${totalUnfilteredCount} fiches)`
                  : `Portefeuille global (${fiches.length} fiches)`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de métrique */}
          <div
            role="tablist"
            aria-label="Métrique de tendance"
            className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg"
          >
            {(
              [
                { id: 'pipeline', label: 'Pipeline' },
                { id: 'maturity', label: 'Maturité %' },
                { id: 'segments', label: 'Segments' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={metricMode === tab.id}
                onClick={() => setMetricMode(tab.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  metricMode === tab.id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sélecteur de période */}
          <div
            role="group"
            aria-label="Période du graphique"
            className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg"
          >
            {(
              [
                { id: '7d', label: '7j' },
                { id: '30d', label: '30j' },
                { id: '90d', label: '90j' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setActiveIndex(null);
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors tabular-nums ${
                  period === p.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Déplier le graphique KPI' : 'Replier le graphique KPI'}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Bandeau métriques synthétiques + point actif */}
          <div className="flex flex-wrap items-baseline justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 tabular-nums">
              <div>
                <span className="text-stone-500">Portefeuille : </span>
                <span className="font-bold text-stone-900 text-sm">{summary.totalNow}</span>
                <span
                  className={`ml-1.5 font-semibold ${
                    summary.totalDelta >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {summary.totalDelta >= 0 ? `+${summary.totalDelta}` : summary.totalDelta} sur {period}
                </span>
              </div>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <div>
                <span className="text-stone-500">Qualifiés (RDV/Devis/Signés) : </span>
                <span className="font-bold text-orange-700 text-sm">{summary.qualifiedNow}</span>
                <span className="ml-1 text-stone-500">({summary.conversionRate}%)</span>
              </div>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <div>
                <span className="text-stone-500">Signés Orange Pro : </span>
                <span className="font-bold text-emerald-700 text-sm">{summary.signedNow}</span>
              </div>
              <span className="text-stone-300" aria-hidden="true">·</span>
              <div>
                <span className="text-stone-500">Maturité moyenne : </span>
                <span className="font-bold text-stone-900 text-sm">{summary.avgMaturityNow}%</span>
                <span
                  className={`ml-1 font-semibold ${
                    summary.maturityDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  ({summary.maturityDelta >= 0 ? `+${summary.maturityDelta}` : summary.maturityDelta} pts)
                </span>
              </div>
            </div>

            {activePoint && (
              <div
                data-testid="kpi-trend-callout"
                className="text-xs text-stone-700 font-medium tabular-nums flex flex-wrap items-center gap-2"
              >
                <span className="font-bold text-stone-900">{activePoint.label}</span>
                <span className="text-stone-300" aria-hidden="true">/</span>
                {metricMode === 'pipeline' && (
                  <>
                    <span className="text-stone-900">Total {activePoint.totalFiches}</span>
                    <span className="text-orange-700">Qualifiés {activePoint.qualified}</span>
                    <span className="text-emerald-700">Signés {activePoint.signed}</span>
                  </>
                )}
                {metricMode === 'maturity' && (
                  <span className="text-orange-700">
                    Maturité moyenne : {activePoint.avgMaturity}% (cible 80%)
                  </span>
                )}
                {metricMode === 'segments' && (
                  <>
                    {SEGMENT_SERIES.map((s) => (
                      <span key={s.key} style={{ color: s.stroke }} className="font-semibold">
                        {s.label} {activePoint.segments[s.key]}
                      </span>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Graphique SVG interactif responsive */}
          {fiches.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-stone-500 border border-dashed border-stone-200 rounded-lg">
              Aucune fiche dans la sélection actuelle pour tracer la tendance KPI.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-[210px] min-w-[540px] select-none"
                role="img"
                aria-label={`Graphique de tendance ${metricMode} sur ${period}`}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <defs>
                  <linearGradient id="orangeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="stoneAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#292524" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#292524" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Grille horizontale + labels axe Y */}
                {yTicks.map((t, i) => (
                  <g key={i}>
                    <line
                      x1={padLeft}
                      y1={t.y}
                      x2={width - padRight}
                      y2={t.y}
                      stroke="#e7e5e4"
                      strokeDasharray={i === 0 ? undefined : '3 4'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={t.y + 4}
                      textAnchor="end"
                      fill="#78716c"
                      fontSize="10"
                      className="font-mono"
                    >
                      {metricMode === 'maturity' ? `${t.val}%` : t.val}
                    </text>
                  </g>
                ))}

                {/* Mode 1 : Pipeline & Conversion */}
                {metricMode === 'pipeline' && (() => {
                  const totalCoords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.totalFiches) }));
                  const qualCoords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.qualified) }));
                  const signedCoords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.signed) }));
                  return (
                    <>
                      <path d={buildAreaPath(totalCoords, baselineY)} fill="url(#stoneAreaGrad)" />
                      <path d={buildAreaPath(qualCoords, baselineY)} fill="url(#orangeAreaGrad)" />
                      <path d={buildAreaPath(signedCoords, baselineY)} fill="url(#emeraldAreaGrad)" />

                      <path
                        d={buildSmoothPath(totalCoords)}
                        fill="none"
                        stroke="#292524"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d={buildSmoothPath(qualCoords)}
                        fill="none"
                        stroke="#ea580c"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d={buildSmoothPath(signedCoords)}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}

                {/* Mode 2 : Maturité moyenne (%) + ligne objectif 80% */}
                {metricMode === 'maturity' && (() => {
                  const matCoords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.avgMaturity) }));
                  const targetY = yFor(80);
                  return (
                    <>
                      <line
                        x1={padLeft}
                        y1={targetY}
                        x2={width - padRight}
                        y2={targetY}
                        stroke="#059669"
                        strokeDasharray="5 4"
                        strokeWidth="1.2"
                      />
                      <text
                        x={width - padRight - 2}
                        y={targetY - 5}
                        textAnchor="end"
                        fill="#047857"
                        fontSize="10"
                        fontWeight="600"
                      >
                        Objectif qualité 80%
                      </text>
                      <path d={buildAreaPath(matCoords, baselineY)} fill="url(#orangeAreaGrad)" />
                      <path
                        d={buildSmoothPath(matCoords)}
                        fill="none"
                        stroke="#ea580c"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}

                {/* Mode 3 : 6 Segments Couleur Orange Pro */}
                {metricMode === 'segments' &&
                  SEGMENT_SERIES.map((s) => {
                    const coords = points.map((p, i) => ({
                      x: xFor(i),
                      y: yFor(p.segments[s.key]),
                    }));
                    return (
                      <path
                        key={s.key}
                        d={buildSmoothPath(coords)}
                        fill="none"
                        stroke={s.stroke}
                        strokeWidth="2"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    );
                  })}

                {/* Crosshair + points interactifs + labels axe X */}
                {points.map((p, idx) => {
                  const cx = xFor(idx);
                  const isActive =
                    activeIndex === idx || (activeIndex === null && idx === points.length - 1);
                  const slotW = points.length > 1 ? plotW / (points.length - 1) : plotW;
                  return (
                    <g key={p.dateKey}>
                      {isActive && (
                        <line
                          x1={cx}
                          y1={padTop}
                          x2={cx}
                          y2={baselineY}
                          stroke="#a8a29e"
                          strokeDasharray="2 3"
                          strokeWidth="1"
                        />
                      )}

                      {metricMode === 'pipeline' && (
                        <>
                          <circle
                            cx={cx}
                            cy={yFor(p.totalFiches)}
                            r={isActive ? 4.2 : 2.5}
                            fill="#292524"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={cx}
                            cy={yFor(p.qualified)}
                            r={isActive ? 4.2 : 2.5}
                            fill="#ea580c"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={cx}
                            cy={yFor(p.signed)}
                            r={isActive ? 4.2 : 2.5}
                            fill="#059669"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        </>
                      )}

                      {metricMode === 'maturity' && (
                        <circle
                          cx={cx}
                          cy={yFor(p.avgMaturity)}
                          r={isActive ? 4.5 : 2.8}
                          fill="#ea580c"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                      )}

                      {metricMode === 'segments' &&
                        isActive &&
                        SEGMENT_SERIES.map((s) => (
                          <circle
                            key={s.key}
                            cx={cx}
                            cy={yFor(p.segments[s.key])}
                            r="3.5"
                            fill={s.stroke}
                            stroke="#ffffff"
                            strokeWidth="1.2"
                          />
                        ))}

                      {/* Label axe X */}
                      <text
                        x={cx}
                        y={height - 8}
                        textAnchor="middle"
                        fill={isActive ? '#1c1917' : '#78716c'}
                        fontSize="10"
                        fontWeight={isActive ? '700' : '400'}
                        className="font-mono"
                      >
                        {p.label}
                      </text>

                      {/* Zone de survol & focus accessible */}
                      <rect
                        x={cx - slotW / 2}
                        y={padTop}
                        width={slotW}
                        height={plotH}
                        fill="transparent"
                        className="cursor-pointer"
                        tabIndex={0}
                        role="button"
                        aria-label={`Point ${p.label} : ${p.totalFiches} fiches, ${p.qualified} qualifiées, ${p.signed} signées, maturité ${p.avgMaturity}%`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onFocus={() => setActiveIndex(idx)}
                        onClick={() => setActiveIndex(idx)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Légende sobre en pied de graphique */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[11px] text-stone-500">
            <div className="flex flex-wrap items-center gap-4">
              {metricMode === 'pipeline' && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-stone-800 inline-block" aria-hidden="true" />
                    Total fiches cumulées
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-orange-600 inline-block" aria-hidden="true" />
                    Qualifiés (RDV + Devis + Signés)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-emerald-600 inline-block" aria-hidden="true" />
                    Signés Orange Pro
                  </span>
                </>
              )}
              {metricMode === 'maturity' && (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-orange-600 inline-block" aria-hidden="true" />
                    Maturité moyenne des fiches (%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t border-dashed border-emerald-600 inline-block" aria-hidden="true" />
                    Seuil cible prêt à prospecter (80%)
                  </span>
                </>
              )}
              {metricMode === 'segments' &&
                SEGMENT_SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block"
                      style={{ backgroundColor: s.stroke }}
                      aria-hidden="true"
                    />
                    {s.label}
                  </span>
                ))}
            </div>
            <span>Mis à jour en temps réel selon vos filtres et déplacements Kanban</span>
          </div>
        </div>
      )}
    </section>
  );
};
