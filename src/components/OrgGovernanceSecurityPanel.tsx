import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  Download,
  RefreshCw,
  Save,
  Lock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  adminSaveCloudOrgSettings,
  fetchSecurityAuditLogs,
  recordSecurityAuditLog,
} from '../firebase';
import type { SanitizedSecurityAuditLogDoc } from '../utils/firestoreSanitize';
import {
  DEFAULT_ORG_SETTINGS,
  IDLE_LOCK_OPTIONS,
  sanitizeCsvCell,
  sanitizeOrgSettingsConfig,
  type IdleLockMinutes,
  type OrgSettingsConfig,
  type SecurityAuditCategory,
  type SecurityAuditSeverity,
} from '../utils/securityHardening';

interface OrgGovernanceSecurityPanelProps {
  adminUid: string;
  adminName: string;
  orgSettings: OrgSettingsConfig;
  turnConfiguredCloud?: boolean;
  onOrgSettingsSaved?: (next: OrgSettingsConfig) => void;
  onNotify: (msg: string, type?: 'ok' | 'err' | 'warn') => void;
}

const CATEGORY_LABELS: Record<SecurityAuditCategory, string> = {
  export_dlp: 'Export / DLP',
  access_control: 'Contrôle d’accès',
  vault_config: 'Coffre & Relais',
  org_settings: 'Gouvernance Org',
  data_privacy: 'CNDP / Vie privée',
  session: 'Session & Sécurité',
};

const SEVERITY_BADGE: Record<SecurityAuditSeverity, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-stone-100 text-stone-700 border-stone-200',
};

export const OrgGovernanceSecurityPanel: React.FC<OrgGovernanceSecurityPanelProps> = ({
  adminUid,
  adminName,
  orgSettings,
  turnConfiguredCloud = false,
  onOrgSettingsSaved,
  onNotify,
}) => {
  const [form, setForm] = useState<OrgSettingsConfig>(() => sanitizeOrgSettingsConfig(orgSettings));
  const [savingOrg, setSavingOrg] = useState(false);

  const [logs, setLogs] = useState<SanitizedSecurityAuditLogDoc[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [catFilter, setCatFilter] = useState<'all' | SecurityAuditCategory>('all');
  const [sevFilter, setSevFilter] = useState<'all' | SecurityAuditSeverity>('all');

  useEffect(() => {
    setForm(sanitizeOrgSettingsConfig(orgSettings));
  }, [orgSettings]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const items = await fetchSecurityAuditLogs(180);
      setLogs(items);
    } catch {
      onNotify('Impossible de charger le journal d’audit sécurité.', 'err');
    } finally {
      setLoadingLogs(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (catFilter !== 'all' && l.category !== catFilter) return false;
      if (sevFilter !== 'all' && l.severity !== sevFilter) return false;
      return true;
    });
  }, [logs, catFilter, sevFilter]);

  const lastMassExport = useMemo(
    () => logs.find((l) => l.category === 'export_dlp' && l.severity === 'critical') || null,
    [logs]
  );

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      const { saved, updatedAtIso } = await adminSaveCloudOrgSettings(form);
      const nextCfg: OrgSettingsConfig = { ...saved, updatedAtIso };
      onOrgSettingsSaved?.(nextCfg);
      await recordSecurityAuditLog({
        severity: 'warn',
        category: 'org_settings',
        action: 'org_settings_updated',
        summary: `Paramètres organisation mis à jour : GC ${saved.defaultPayoutGrandCompteMad} MAD, PME ${saved.defaultPayoutPmeMad} MAD, TPE ${saved.defaultPayoutTpeMad} MAD, Auto-Lock ${saved.defaultIdleLockMinutes}m, Seuil DLP ${saved.dlpExportAlertThreshold}, CNDP ${saved.enforceCndpOptOutLock ? 'ON' : 'OFF'}.`,
        actorUid: adminUid,
        actorName: adminName,
        actorRole: 'super_admin',
        targetLabel: saved.companyName,
      });
      onNotify('Paramètres Organisation enregistrés et propagés à toute l’équipe.', 'ok');
      void loadLogs();
    } catch {
      onNotify('Erreur lors de l’enregistrement des paramètres organisation (vérifiez firestore.rules).', 'err');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleExportAuditCsv = () => {
    const header = [
      'Date (ISO)',
      'Sévérité',
      'Catégorie',
      'Action',
      'Acteur',
      'Rôle',
      'Cible',
      'Volume',
      'Résumé',
    ]
      .map((h) => sanitizeCsvCell(h, { delimiter: ';' }))
      .join(';');

    const rows = filteredLogs.map((l) =>
      [
        l.createdAtIso,
        l.severity,
        CATEGORY_LABELS[l.category] || l.category,
        l.action,
        l.actorName,
        l.actorRole,
        l.targetLabel || l.targetUid || '',
        l.recordCount ?? '',
        l.summary,
      ]
        .map((v) => sanitizeCsvCell(v, { delimiter: ';' }))
        .join(';')
    );

    const csv = `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diversifia-audit-securite-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`Journal d’audit exporté (${filteredLogs.length} événements, anti-injection CSV).`, 'ok');
  };

  const healthChecks = [
    {
      label: 'Auth Email Vérifié & RBAC',
      detail: 'Strict Firebase ID Token + rôles /app_users',
      ok: true,
    },
    {
      label: 'Relais TURN WebRTC Authentifié',
      detail: turnConfiguredCloud
        ? 'Bearer /api/rtc/ice-servers + Firestore /app_config/rtc_ice'
        : 'Bearer protégé (configurez TURN dans Coffre API pour 4G/5G)',
      ok: true,
    },
    {
      label: 'En-têtes OWASP, CSP & Anti-CSRF',
      detail: 'nosniff, Referrer-Policy, Permissions-Policy, Rate-Limit IP',
      ok: true,
    },
    {
      label: 'Verrouillage Inactivité',
      detail:
        form.defaultIdleLockMinutes > 0
          ? `Actif (${form.defaultIdleLockMinutes} min par défaut)`
          : 'Désactivé par défaut (recommandé : 30 min)',
      ok: form.defaultIdleLockMinutes > 0,
    },
    {
      label: 'Conformité CNDP Loi 09-08',
      detail: form.enforceCndpOptOutLock
        ? 'Verrouillage Email/WhatsApp actif sur Liste Rouge'
        : 'Indicateur uniquement (verrouillage envoi désactivé)',
      ok: form.enforceCndpOptOutLock,
    },
    {
      label: 'Surveillance DLP Exports',
      detail: lastMassExport
        ? `Dernier export massif : ${lastMassExport.actorName} (${lastMassExport.recordCount ?? '?'} fiches)`
        : `Seuil critique configuré à ${form.dlpExportAlertThreshold} fiches`,
      ok: !lastMassExport,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Tableau de Bord Santé Cybersécurité */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Tableau de Bord Santé Cybersécurité &amp; Conformité CNDP
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Posture Zero-Trust, prévention des fuites de données (DLP) et conformité Loi marocaine 09-08.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <Lock className="w-3.5 h-3.5" />
            Journal append-only actif
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {healthChecks.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${
                item.ok
                  ? 'bg-emerald-50/40 border-emerald-200/80'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-900">{item.label}</p>
                <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Gouvernance Organisation (/app_config/org_settings) */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              Gouvernance Organisation (Paramètres Globaux Équipe)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Mentions légales partagées pour les devis PDF, paliers commissions MAD, SLA affaires dormantes et politique DLP/CNDP.
            </p>
          </div>
          {orgSettings.updatedAtIso && (
            <span className="text-[11px] text-stone-500 tabular-nums">
              Dernière MAJ : {new Date(orgSettings.updatedAtIso).toLocaleString('fr-FR')}
            </span>
          )}
        </div>

        <form onSubmit={(e) => void handleSaveOrgSettings(e)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Raison sociale émettrice (Devis PDF par défaut)
              </label>
              <input
                type="text"
                maxLength={140}
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                placeholder={DEFAULT_ORG_SETTINGS.companyName}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                ICE Société (15 chiffres)
              </label>
              <input
                type="text"
                maxLength={40}
                value={form.companyIce}
                onChange={(e) => setForm((p) => ({ ...p, companyIce: e.target.value }))}
                placeholder="002345678000091"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Adresse du siège
              </label>
              <input
                type="text"
                maxLength={220}
                value={form.companyAddress}
                onChange={(e) => setForm((p) => ({ ...p, companyAddress: e.target.value }))}
                placeholder="Avenue Mohammed V, Meknès"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Téléphone standard siège
              </label>
              <input
                type="text"
                maxLength={40}
                value={form.companyPhone}
                onChange={(e) => setForm((p) => ({ ...p, companyPhone: e.target.value }))}
                placeholder="+212 5 35 52 00 00"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-stone-100">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Commission Grand Compte (MAD)
              </label>
              <input
                type="number"
                min={0}
                max={200000}
                value={form.defaultPayoutGrandCompteMad}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultPayoutGrandCompteMad: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Commission PME (MAD)
              </label>
              <input
                type="number"
                min={0}
                max={200000}
                value={form.defaultPayoutPmeMad}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultPayoutPmeMad: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Commission TPE / Libéral (MAD)
              </label>
              <input
                type="number"
                min={0}
                max={200000}
                value={form.defaultPayoutTpeMad}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultPayoutTpeMad: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-stone-100">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                SLA Affaires dormantes (heures)
              </label>
              <input
                type="number"
                min={12}
                max={720}
                value={form.defaultSlaRottingHours}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultSlaRottingHours: Math.max(12, Math.min(720, Number(e.target.value) || 72)),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Verrouillage inactivité par défaut
              </label>
              <select
                value={form.defaultIdleLockMinutes}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    defaultIdleLockMinutes: Number(e.target.value) as IdleLockMinutes,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900"
              >
                {IDLE_LOCK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Seuil alerte DLP export massif (fiches)
              </label>
              <input
                type="number"
                min={5}
                max={5000}
                value={form.dlpExportAlertThreshold}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    dlpExportAlertThreshold: Math.max(5, Math.min(5000, Number(e.target.value) || 50)),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enforceCndpOptOutLock}
                onChange={(e) =>
                  setForm((p) => ({ ...p, enforceCndpOptOutLock: e.target.checked }))
                }
                className="w-4 h-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
              Bloquer les raccourcis Email / WhatsApp sur les prospects inscrits en Liste Rouge (Loi 09-08 CNDP)
            </label>

            <button
              type="submit"
              disabled={savingOrg}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {savingOrg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Enregistrer la gouvernance
            </button>
          </div>
        </form>
      </section>

      {/* 3. Journal d'Audit Sécurité & DLP (/security_audit_logs) */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-600" />
              Journal d’Audit Sécurité, DLP &amp; CNDP ({filteredLogs.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Traçabilité immuable des exports CSV/JSON, actions utilisateurs, coffre API/TURN et mises en Liste Rouge.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loadingLogs}
              className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Exporter CSV sécurisé
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-stone-500">
            <Filter className="w-3.5 h-3.5" />
            Filtres :
          </span>
          <select
            aria-label="Filtrer par catégorie d'audit"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as 'all' | SecurityAuditCategory)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
          >
            <option value="all">Toutes les catégories</option>
            {(Object.keys(CATEGORY_LABELS) as SecurityAuditCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrer par sévérité d'audit"
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value as 'all' | SecurityAuditSeverity)}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-stone-50 text-stone-800"
          >
            <option value="all">Toutes les sévérités</option>
            <option value="critical">Critique (DLP / Alerte)</option>
            <option value="warn">Avertissement</option>
            <option value="info">Information</option>
          </select>
        </div>

        {loadingLogs && logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
            Chargement du journal de sécurité...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
            Aucun événement d’audit pour ces filtres. Les prochains exports, actions admin et changements CNDP apparaîtront ici automatiquement.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold">
                  <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Sévérité</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Catégorie</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Acteur</th>
                  <th className="py-2.5 px-3">Détail de l’événement</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLogs.slice(0, 100).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/70">
                    <td className="py-2.5 px-3 whitespace-nowrap text-stone-500 tabular-nums">
                      {new Date(log.createdAtIso).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase ${SEVERITY_BADGE[log.severity]}`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-stone-700">
                      {CATEGORY_LABELS[log.category] || log.category}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-stone-900">{log.actorName}</span>
                      <span className="text-stone-400 ml-1">({log.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-3 text-stone-700 max-w-md">
                      <p className="leading-snug">{log.summary}</p>
                      {log.targetLabel && (
                        <p className="text-[11px] text-stone-400 mt-0.5">Cible : {log.targetLabel}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-stone-700">
                      {typeof log.recordCount === 'number' ? log.recordCount : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
