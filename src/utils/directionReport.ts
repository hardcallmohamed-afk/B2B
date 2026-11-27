// Pure Monthly Direction Report & Payroll Commissions Bordereau engine (PDF + Excel FR/Maroc CSV).
// Works 100% client-side (GitHub Pages static + Express server) with zero vulnerable dependencies.

import {
  ROLE_BADGE_META,
  type OrangeProTier,
  type PayoutStatus,
  type SignedContractRecord,
  type TeamRole,
  type TeamStatRecord,
} from './gamification';
import type { WorkspaceLegalInfo } from './accountPreferences';
import { sanitizeCsvCell } from './securityHardening';

export interface AttendanceSessionLike {
  ownerId: string;
  dateKey?: string;
  loginAt?: string;
  workedSeconds: number;
}

export interface DirectionCommercialRow {
  uid: string;
  displayName: string;
  role: TeamRole;
  roleLabel: string;
  zone: string;
  prospectsCount: number;
  workedHours: number | null;
  contractsCount: number;
  enAttenteMad: number;
  valideMad: number;
  verseMad: number;
  refuseMad: number;
  totalValideEtVerseMad: number;
}

export interface DirectionContractRow {
  id: string;
  signedAt: string;
  signedDateFr: string;
  ownerId: string;
  ownerName: string;
  societe: string;
  numeroFiche: string;
  ville: string;
  produitOrangePro: string;
  tier: OrangeProTier;
  payoutMad: number;
  payoutStatus: PayoutStatus;
  referenceOrMotif: string;
}

export interface DirectionReportSummary {
  activeCommercialsCount: number;
  totalProspects: number;
  monthContractsCount: number;
  enAttenteMad: number;
  valideMad: number;
  verseMad: number;
  refuseMad: number;
  netAPayerMad: number; // Validé + En attente
  totalValideEtVerseMad: number; // Validé + Versé
  totalWorkedHours: number | null;
}

export interface MonthlyDirectionReport {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  generatedAtIso: string;
  filtersLabel: string;
  workspaceLegal?: WorkspaceLegalInfo;
  summary: DirectionReportSummary;
  commercialRows: DirectionCommercialRow[];
  contractRows: DirectionContractRow[];
}

const FR_MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export function getCurrentMonthKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthKeyFr(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec((monthKey || '').trim());
  if (!m) return monthKey || 'Mois en cours';
  const year = m[1];
  const monthIdx = Number.parseInt(m[2], 10) - 1;
  const label = FR_MONTH_NAMES[monthIdx] || m[2];
  return `${label} ${year}`;
}

export function getRecentMonthKeys(
  count = 12,
  now: Date = new Date()
): Array<{ key: string; label: string }> {
  const list: Array<{ key: string; label: string }> = [];
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(baseYear, baseMonth - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    list.push({ key, label: formatMonthKeyFr(key) });
  }
  return list;
}

/**
 * Extracts a YYYY-MM month key from ISO dates, YYYY-MM-DD strings, or DD/MM/YYYY strings.
 */
export function extractMonthKey(rawDate: string | undefined): string {
  const s = (rawDate || '').trim();
  if (!s) return '';
  const isoMatch = /^(\d{4})-(\d{2})/.exec(s);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (frMatch) return `${frMatch[3]}-${frMatch[2]}`;
  const ts = Date.parse(s);
  if (Number.isFinite(ts)) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
}

function formatSignedDateFr(rawDate: string | undefined): string {
  const s = (rawDate || '').trim();
  if (!s) return '—';
  const ts = Date.parse(s);
  if (Number.isFinite(ts)) {
    return new Date(ts).toLocaleDateString('fr-FR');
  }
  return s.slice(0, 10);
}

function roundHours(seconds: number): number {
  return Math.round((Math.max(0, seconds) / 3600) * 10) / 10;
}

export function buildMonthlyDirectionReport(params: {
  monthKey: string;
  teamStats: TeamStatRecord[];
  signedContracts: SignedContractRecord[];
  attendanceSessions?: AttendanceSessionLike[];
  filtersLabel?: string;
  workspaceLegal?: WorkspaceLegalInfo;
  now?: Date;
}): MonthlyDirectionReport {
  const monthKey = /^\d{4}-\d{2}$/.test((params.monthKey || '').trim())
    ? params.monthKey.trim()
    : getCurrentMonthKey(params.now);

  const monthContracts = params.signedContracts
    .filter((c) => extractMonthKey(c.signedAt) === monthKey)
    .sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''));

  // Aggregate attendance seconds per uid for target monthKey
  const attendanceProvided =
    Array.isArray(params.attendanceSessions) && params.attendanceSessions.length > 0;
  const workedSecondsByUid = new Map<string, number>();
  if (attendanceProvided && params.attendanceSessions) {
    for (const sess of params.attendanceSessions) {
      if (!sess || !sess.ownerId) continue;
      const sessMonth = extractMonthKey(sess.dateKey || sess.loginAt);
      if (sessMonth !== monthKey) continue;
      const sec = Number.isFinite(sess.workedSeconds) ? Math.max(0, sess.workedSeconds) : 0;
      workedSecondsByUid.set(sess.ownerId, (workedSecondsByUid.get(sess.ownerId) || 0) + sec);
    }
  }

  // Group month contracts by ownerId
  const contractsByUid = new Map<string, SignedContractRecord[]>();
  for (const c of monthContracts) {
    const list = contractsByUid.get(c.ownerId) || [];
    list.push(c);
    contractsByUid.set(c.ownerId, list);
  }

  // Build commercial rows covering all filtered teamStats + any contract owner in monthKey
  const memberByUid = new Map<string, TeamStatRecord>();
  for (const m of params.teamStats) {
    memberByUid.set(m.uid, m);
  }

  const allUids = new Set<string>([...memberByUid.keys(), ...contractsByUid.keys()]);
  const commercialRows: DirectionCommercialRow[] = [];

  for (const uid of allUids) {
    const m = memberByUid.get(uid);
    const ownerContracts = contractsByUid.get(uid) || [];

    let enAttenteMad = 0;
    let valideMad = 0;
    let verseMad = 0;
    let refuseMad = 0;

    for (const c of ownerContracts) {
      const amount = Number.isFinite(c.payoutMad) ? Math.max(0, Math.round(c.payoutMad)) : 0;
      if (c.payoutStatus === 'Refusé') refuseMad += amount;
      else if (c.payoutStatus === 'Versé') verseMad += amount;
      else if (c.payoutStatus === 'Validé') valideMad += amount;
      else enAttenteMad += amount;
    }

    const role: TeamRole = m?.role || 'commercial';
    const roleMeta = ROLE_BADGE_META[role];
    const workedSec = workedSecondsByUid.get(uid);

    commercialRows.push({
      uid,
      displayName: m?.displayName || ownerContracts[0]?.ownerName || 'Collaborateur',
      role,
      roleLabel: roleMeta ? roleMeta.shortLabel : role,
      zone: m?.zone || ownerContracts[0]?.ville || 'Maroc',
      prospectsCount: m ? Math.max(0, Number(m.totalProspects) || 0) : 0,
      workedHours: typeof workedSec === 'number' && workedSec > 0 ? roundHours(workedSec) : null,
      contractsCount: ownerContracts.length,
      enAttenteMad,
      valideMad,
      verseMad,
      refuseMad,
      totalValideEtVerseMad: valideMad + verseMad,
    });
  }

  commercialRows.sort((a, b) => {
    if (b.totalValideEtVerseMad !== a.totalValideEtVerseMad) {
      return b.totalValideEtVerseMad - a.totalValideEtVerseMad;
    }
    if (b.contractsCount !== a.contractsCount) {
      return b.contractsCount - a.contractsCount;
    }
    return a.displayName.localeCompare(b.displayName, 'fr');
  });

  // Global month summary
  let enAttenteMad = 0;
  let valideMad = 0;
  let verseMad = 0;
  let refuseMad = 0;

  const contractRows: DirectionContractRow[] = monthContracts.map((c) => {
    const amount = Number.isFinite(c.payoutMad) ? Math.max(0, Math.round(c.payoutMad)) : 0;
    if (c.payoutStatus === 'Refusé') refuseMad += amount;
    else if (c.payoutStatus === 'Versé') verseMad += amount;
    else if (c.payoutStatus === 'Validé') valideMad += amount;
    else enAttenteMad += amount;

    const referenceOrMotif =
      c.payoutStatus === 'Versé'
        ? c.referenceVirement?.trim() || '—'
        : c.payoutStatus === 'Refusé'
          ? c.refusMotif?.trim() || '—'
          : c.referenceVirement?.trim() || '—';

    return {
      id: c.id,
      signedAt: c.signedAt,
      signedDateFr: formatSignedDateFr(c.signedAt),
      ownerId: c.ownerId,
      ownerName: c.ownerName || memberByUid.get(c.ownerId)?.displayName || 'Collaborateur',
      societe: c.societe || 'Client Orange Pro',
      numeroFiche: c.numeroFiche || '',
      ville: c.ville || '',
      produitOrangePro: c.produitOrangePro || 'Offre Orange Pro',
      tier: c.tier,
      payoutMad: amount,
      payoutStatus: c.payoutStatus,
      referenceOrMotif,
    };
  });

  const activeCommercialsCount = params.teamStats.filter((m) => m.active !== false).length;
  const totalProspects = params.teamStats.reduce(
    (sum, m) => sum + Math.max(0, Number(m.totalProspects) || 0),
    0
  );

  let totalWorkedSec = 0;
  for (const row of commercialRows) {
    const sec = workedSecondsByUid.get(row.uid);
    if (typeof sec === 'number' && sec > 0) totalWorkedSec += sec;
  }

  return {
    monthKey,
    monthLabel: formatMonthKeyFr(monthKey),
    generatedAtIso: (params.now || new Date()).toISOString(),
    filtersLabel: params.filtersLabel?.trim() || 'Toute l’équipe',
    workspaceLegal: params.workspaceLegal,
    summary: {
      activeCommercialsCount,
      totalProspects,
      monthContractsCount: contractRows.length,
      enAttenteMad,
      valideMad,
      verseMad,
      refuseMad,
      netAPayerMad: valideMad + enAttenteMad,
      totalValideEtVerseMad: valideMad + verseMad,
      totalWorkedHours: totalWorkedSec > 0 ? roundHours(totalWorkedSec) : null,
    },
    commercialRows,
    contractRows,
  };
}

/**
 * Escapes a value for Microsoft Excel FR/Maroc CSV (semicolon-delimited) with strict
 * protection against CSV Formula Injection (=, +, -, @, TAB, CR).
 */
export function escapeExcelCsvCell(raw: string | number | null | undefined): string {
  return sanitizeCsvCell(raw, { delimiter: ';', decimalCommaForNumbers: true });
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeExcelCsvCell).join(';');
}

/**
 * Builds an Excel FR/Maroc CSV (UTF-8 with BOM \uFEFF, semicolon separator ';') containing:
 *  - Global month synthesis
 *  - Section 1: Bordereau par Commercial
 *  - Section 2: Détail des Contrats du Mois
 */
export function buildMonthlyPayrollExcelCsv(report: MonthlyDirectionReport): string {
  const lines: string[] = [];
  const issuer =
    report.workspaceLegal?.raisonSociale?.trim() || 'DIVERSIFIA — Partenaire Officiel Orange Pro B2B';

  // Header & Synthesis
  lines.push(csvRow(['RAPPORT DIRECTION & BORDEREAU DE COMMISSIONS', report.monthLabel]));
  lines.push(csvRow(['Émetteur', issuer]));
  if (report.workspaceLegal?.ice?.trim()) {
    lines.push(csvRow(['ICE', report.workspaceLegal.ice.trim()]));
  }
  lines.push(csvRow(['Périmètre / Filtres', report.filtersLabel]));
  lines.push(csvRow(['Date d’édition', formatSignedDateFr(report.generatedAtIso)]));
  lines.push('');

  lines.push(csvRow(['SYNTHÈSE GLOBALE DU MOIS', 'VALEUR']));
  lines.push(csvRow(['Commerciaux actifs', report.summary.activeCommercialsCount]));
  lines.push(csvRow(['Total prospects portefeuille', report.summary.totalProspects]));
  lines.push(csvRow(['Contrats signés (mois)', report.summary.monthContractsCount]));
  lines.push(csvRow(['Commissions En attente (MAD)', report.summary.enAttenteMad]));
  lines.push(csvRow(['Commissions Validé (MAD)', report.summary.valideMad]));
  lines.push(csvRow(['Commissions Versé (MAD)', report.summary.verseMad]));
  lines.push(csvRow(['Commissions Refusé (MAD)', report.summary.refuseMad]));
  lines.push(csvRow(['Net à régler (Validé + En attente) (MAD)', report.summary.netAPayerMad]));
  lines.push(
    csvRow([
      'Total heures présence pointées',
      report.summary.totalWorkedHours !== null ? report.summary.totalWorkedHours : '—',
    ])
  );
  lines.push('');

  // Section 1: Bordereau par Commercial
  lines.push(csvRow(['SECTION 1 — BORDEREAU DE PAIE PAR COMMERCIAL']));
  lines.push(
    csvRow([
      'Nom complet',
      'Rôle',
      'Zone',
      'Prospects',
      'Heures présence',
      'Contrats signés (mois)',
      'En attente (MAD)',
      'Validé (MAD)',
      'Versé (MAD)',
      'Refusé (MAD)',
      'Total Validé + Versé (MAD)',
    ])
  );

  for (const r of report.commercialRows) {
    lines.push(
      csvRow([
        r.displayName,
        r.roleLabel,
        r.zone,
        r.prospectsCount,
        r.workedHours !== null ? r.workedHours : '—',
        r.contractsCount,
        r.enAttenteMad,
        r.valideMad,
        r.verseMad,
        r.refuseMad,
        r.totalValideEtVerseMad,
      ])
    );
  }

  lines.push(
    csvRow([
      'TOTAL',
      '',
      '',
      report.summary.totalProspects,
      report.summary.totalWorkedHours !== null ? report.summary.totalWorkedHours : '—',
      report.summary.monthContractsCount,
      report.summary.enAttenteMad,
      report.summary.valideMad,
      report.summary.verseMad,
      report.summary.refuseMad,
      report.summary.totalValideEtVerseMad,
    ])
  );
  lines.push('');

  // Section 2: Détail des Contrats du Mois
  lines.push(csvRow(['SECTION 2 — DÉTAIL DES CONTRATS DU MOIS']));
  lines.push(
    csvRow([
      'Date signature',
      'Commercial',
      'Client / Société',
      'Produit Orange Pro',
      'Segment (Tier)',
      'Commission (MAD)',
      'Statut payout',
      'Référence virement / Motif refus',
    ])
  );

  for (const c of report.contractRows) {
    lines.push(
      csvRow([
        c.signedDateFr,
        c.ownerName,
        c.societe,
        c.produitOrangePro,
        c.tier,
        c.payoutMad,
        c.payoutStatus,
        c.referenceOrMotif,
      ])
    );
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function downloadMonthlyPayrollExcelCsv(report: MonthlyDirectionReport): string {
  const filename = `DIVERSIFIA_Bordereau_Paie_${report.monthKey}.csv`;
  const csvContent = buildMonthlyPayrollExcelCsv(report);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return filename;
}

/**
 * Strips Unicode narrow/non-breaking spaces so jsPDF Helvetica never renders broken '/' glyphs.
 */
function safePdfText(raw: string): string {
  return (raw || '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-');
}

function truncatePdfText(raw: string, maxLen: number): string {
  const clean = safePdfText(raw).trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(1, maxLen - 1)).trim()}...`;
}

/**
 * Builds the jsPDF document for the Monthly Direction Report & Commissions Bordereau.
 * Uses dynamic imports for jsPDF & formatPdfMad so TeamPerformancePanel stays light.
 */
export async function buildMonthlyDirectionReportPdfDoc(report: MonthlyDirectionReport) {
  const [{ jsPDF }, { formatPdfMad }] = await Promise.all([
    import('jspdf'),
    import('./pdfGenerator'),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 186mm
  const bottomLimit = pageHeight - 20;

  const drawHeader = (isContinuation = false) => {
    doc.setFillColor(28, 25, 23); // Dark Stone #1C1917
    doc.rect(0, 0, pageWidth, isContinuation ? 18 : 34, 'F');
    doc.setFillColor(249, 102, 20); // Orange #F96614
    doc.rect(0, isContinuation ? 18 : 34, pageWidth, 2.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 12 : 18);
    doc.text('DIVERSIFIA', marginX, isContinuation ? 11 : 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 10 : 12);
    doc.setTextColor(249, 102, 20);
    doc.text(
      safePdfText(`RAPPORT DIRECTION & COMMISSIONS - ${report.monthLabel.toUpperCase()}`),
      pageWidth - marginX,
      isContinuation ? 11 : 15,
      { align: 'right' }
    );

    if (!isContinuation) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(220, 220, 220);
      const issuer =
        report.workspaceLegal?.raisonSociale?.trim() ||
        'Partenaire Officiel B2B Orange Maroc - Direction Commerciale';
      const iceSuffix = report.workspaceLegal?.ice?.trim()
        ? ` | ICE : ${report.workspaceLegal.ice.trim()}`
        : '';
      doc.text(safePdfText(`${issuer}${iceSuffix}`), marginX, 23);
      doc.text(
        safePdfText(
          `Perimetre : ${truncatePdfText(report.filtersLabel, 68)} | Edite le ${formatSignedDateFr(
            report.generatedAtIso
          )}`
        ),
        marginX,
        29
      );
    }
  };

  drawHeader(false);
  let y = 43;

  const ensureSpace = (neededMm: number, onNewPage?: () => void) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      drawHeader(true);
      y = 27;
      if (onNewPage) onNewPage();
    }
  };

  // 1. Executive KPI Summary Grid (2 rows x 4 boxes)
  const kpiBoxes = [
    {
      label: 'Commerciaux actifs',
      value: String(report.summary.activeCommercialsCount),
      sub: `${report.summary.totalProspects} prospects`,
    },
    {
      label: 'Contrats du mois',
      value: String(report.summary.monthContractsCount),
      sub:
        report.summary.totalWorkedHours !== null
          ? `Presence : ${report.summary.totalWorkedHours} h`
          : 'Presence : --',
    },
    {
      label: 'Net a regler',
      value: `${formatPdfMad(report.summary.netAPayerMad, 0)} MAD`,
      sub: 'Valide + En attente',
    },
    {
      label: 'Total Valide + Verse',
      value: `${formatPdfMad(report.summary.totalValideEtVerseMad, 0)} MAD`,
      sub: 'Cumul confirme',
    },
    {
      label: 'En attente',
      value: `${formatPdfMad(report.summary.enAttenteMad, 0)} MAD`,
      sub: 'A valider',
    },
    {
      label: 'Valide',
      value: `${formatPdfMad(report.summary.valideMad, 0)} MAD`,
      sub: 'Pret virement',
    },
    {
      label: 'Verse',
      value: `${formatPdfMad(report.summary.verseMad, 0)} MAD`,
      sub: 'Paye',
    },
    {
      label: 'Refuse',
      value: `${formatPdfMad(report.summary.refuseMad, 0)} MAD`,
      sub: 'Hors paie',
    },
  ];

  const boxGap = 3;
  const boxW = (contentWidth - boxGap * 3) / 4;
  const boxH = 17;

  kpiBoxes.forEach((box, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const bx = marginX + col * (boxW + boxGap);
    const by = y + row * (boxH + boxGap);

    doc.setFillColor(247, 245, 240);
    doc.setDrawColor(225, 222, 216);
    doc.roundedRect(bx, by, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(115, 110, 105);
    doc.text(safePdfText(box.label.toUpperCase()), bx + 2.5, by + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 25, 23);
    doc.text(safePdfText(box.value), bx + 2.5, by + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(130, 125, 120);
    doc.text(safePdfText(box.sub), bx + 2.5, by + 15);
  });

  y += boxH * 2 + boxGap + 8;

  // 2. Section 1: Bordereau par Commercial
  const drawCommercialTableHeader = () => {
    doc.setFillColor(28, 25, 23);
    doc.rect(marginX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    doc.text('Commercial', marginX + 2, y + 4.7);
    doc.text('Role / Zone', marginX + 38, y + 4.7);
    doc.text('Prosp.', marginX + 74, y + 4.7, { align: 'right' });
    doc.text('Heures', marginX + 88, y + 4.7, { align: 'right' });
    doc.text('Ctr.', marginX + 98, y + 4.7, { align: 'right' });
    doc.text('Attente', marginX + 116, y + 4.7, { align: 'right' });
    doc.text('Valide', marginX + 134, y + 4.7, { align: 'right' });
    doc.text('Verse', marginX + 152, y + 4.7, { align: 'right' });
    doc.text('Refuse', marginX + 167, y + 4.7, { align: 'right' });
    doc.text('Val+Ver', marginX + 184, y + 4.7, { align: 'right' });
    y += 7;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(28, 25, 23);
  doc.text('1. BORDEREAU DE COMMISSIONS PAR COMMERCIAL (MAD)', marginX, y);
  y += 4;
  drawCommercialTableHeader();

  if (report.commercialRows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucun collaborateur dans le perimetre selectionne.', marginX + 2, y + 5);
    y += 9;
  } else {
    report.commercialRows.forEach((row, idx) => {
      ensureSpace(7, drawCommercialTableHeader);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 249, 246);
        doc.rect(marginX, y, contentWidth, 6.5, 'F');
      }
      doc.setDrawColor(235, 232, 226);
      doc.line(marginX, y + 6.5, marginX + contentWidth, y + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(28, 25, 23);
      doc.text(truncatePdfText(row.displayName, 22), marginX + 2, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 86, 82);
      doc.text(truncatePdfText(`${row.roleLabel} - ${row.zone}`, 22), marginX + 38, y + 4.5);

      doc.setTextColor(40, 40, 40);
      doc.text(String(row.prospectsCount), marginX + 74, y + 4.5, { align: 'right' });
      doc.text(
        row.workedHours !== null ? `${row.workedHours}h` : '--',
        marginX + 88,
        y + 4.5,
        { align: 'right' }
      );
      doc.text(String(row.contractsCount), marginX + 98, y + 4.5, { align: 'right' });
      doc.text(formatPdfMad(row.enAttenteMad, 0), marginX + 116, y + 4.5, { align: 'right' });
      doc.text(formatPdfMad(row.valideMad, 0), marginX + 134, y + 4.5, { align: 'right' });
      doc.text(formatPdfMad(row.verseMad, 0), marginX + 152, y + 4.5, { align: 'right' });
      doc.text(formatPdfMad(row.refuseMad, 0), marginX + 167, y + 4.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(249, 102, 20);
      doc.text(formatPdfMad(row.totalValideEtVerseMad, 0), marginX + 184, y + 4.5, {
        align: 'right',
      });
      y += 6.5;
    });

    // Total Row
    ensureSpace(8);
    doc.setFillColor(244, 240, 234);
    doc.rect(marginX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(28, 25, 23);
    doc.text('TOTAL PERIODE', marginX + 2, y + 4.8);
    doc.text(String(report.summary.totalProspects), marginX + 74, y + 4.8, { align: 'right' });
    doc.text(
      report.summary.totalWorkedHours !== null ? `${report.summary.totalWorkedHours}h` : '--',
      marginX + 88,
      y + 4.8,
      { align: 'right' }
    );
    doc.text(String(report.summary.monthContractsCount), marginX + 98, y + 4.8, {
      align: 'right',
    });
    doc.text(formatPdfMad(report.summary.enAttenteMad, 0), marginX + 116, y + 4.8, {
      align: 'right',
    });
    doc.text(formatPdfMad(report.summary.valideMad, 0), marginX + 134, y + 4.8, {
      align: 'right',
    });
    doc.text(formatPdfMad(report.summary.verseMad, 0), marginX + 152, y + 4.8, {
      align: 'right',
    });
    doc.text(formatPdfMad(report.summary.refuseMad, 0), marginX + 167, y + 4.8, {
      align: 'right',
    });
    doc.setTextColor(249, 102, 20);
    doc.text(formatPdfMad(report.summary.totalValideEtVerseMad, 0), marginX + 184, y + 4.8, {
      align: 'right',
    });
    y += 12;
  }

  // 3. Section 2: Détail des Contrats du Mois
  const drawContractsTableHeader = () => {
    doc.setFillColor(28, 25, 23);
    doc.rect(marginX, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    doc.text('Date', marginX + 2, y + 4.7);
    doc.text('Commercial', marginX + 20, y + 4.7);
    doc.text('Client / Societe', marginX + 50, y + 4.7);
    doc.text('Produit / Tier', marginX + 88, y + 4.7);
    doc.text('MAD', marginX + 137, y + 4.7, { align: 'right' });
    doc.text('Statut', marginX + 141, y + 4.7);
    doc.text('Ref. / Motif', marginX + 160, y + 4.7);
    y += 7;
  };

  ensureSpace(18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(28, 25, 23);
  doc.text(
    safePdfText(`2. DETAIL DES CONTRATS DU MOIS (${report.contractRows.length})`),
    marginX,
    y
  );
  y += 4;
  drawContractsTableHeader();

  if (report.contractRows.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(safePdfText(`Aucun contrat signe sur ${report.monthLabel}.`), marginX + 2, y + 5);
    y += 10;
  } else {
    report.contractRows.forEach((c, idx) => {
      ensureSpace(7, drawContractsTableHeader);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 249, 246);
        doc.rect(marginX, y, contentWidth, 6.5, 'F');
      }
      doc.setDrawColor(235, 232, 226);
      doc.line(marginX, y + 6.5, marginX + contentWidth, y + 6.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(70, 70, 70);
      doc.text(safePdfText(c.signedDateFr), marginX + 2, y + 4.4);
      doc.text(truncatePdfText(c.ownerName, 18), marginX + 20, y + 4.4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 25, 23);
      doc.text(truncatePdfText(c.societe, 22), marginX + 50, y + 4.4);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      doc.text(truncatePdfText(`${c.produitOrangePro} (${c.tier})`, 27), marginX + 88, y + 4.4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 25, 23);
      doc.text(formatPdfMad(c.payoutMad, 0), marginX + 137, y + 4.4, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.text(truncatePdfText(c.payoutStatus, 11), marginX + 141, y + 4.4);
      doc.text(truncatePdfText(c.referenceOrMotif, 16), marginX + 160, y + 4.4);
      y += 6.5;
    });
  }

  // 4. Signature Block (Visa Direction / Comptabilité)
  ensureSpace(34);
  y += 8;
  const sigBoxW = (contentWidth - 8) / 2;
  const sigBoxH = 24;

  doc.setDrawColor(200, 195, 190);
  doc.setFillColor(252, 251, 249);
  doc.roundedRect(marginX, y, sigBoxW, sigBoxH, 2, 2, 'FD');
  doc.roundedRect(marginX + sigBoxW + 8, y, sigBoxW, sigBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(28, 25, 23);
  doc.text('Visa Direction Commerciale', marginX + 4, y + 6);
  doc.text('Visa Comptabilite & Paie', marginX + sigBoxW + 12, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 125, 120);
  doc.text('Nom, date et signature :', marginX + 4, y + 11);
  doc.text('Cachet, date et validation virement :', marginX + sigBoxW + 12, y + 11);

  // 5. Pagination Footer ("Page X / Y") across all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(225, 222, 216);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(125, 120, 115);
    doc.text(
      safePdfText(`DIVERSIFIA - Rapport Direction & Paie (${report.monthLabel}) - Document interne`),
      marginX,
      pageHeight - 8
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${p} / ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right',
    });
  }

  return doc;
}

export async function generateMonthlyDirectionReportPdf(
  report: MonthlyDirectionReport
): Promise<string> {
  const filename = `DIVERSIFIA_Rapport_Direction_${report.monthKey}.pdf`;
  const doc = await buildMonthlyDirectionReportPdfDoc(report);
  doc.save(filename);
  return filename;
}
