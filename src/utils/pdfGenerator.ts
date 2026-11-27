// Client-side PDF generation for DIVERSIFIA B2B Orange Pro client quotes.
// Zero commission printed. Uses workspace legal info or blank placeholders.

import { jsPDF } from 'jspdf';
import type { FicheEntreprise } from './crmDomain';

export interface QuoteConfig {
  fiche: FicheEntreprise;
  produitOrangePro: string;
  tier: 'Grand Compte' | 'PME' | 'TPE / Libéral';
  quantiteFixe: number;
  quantiteMobile: number;
  prixMensuelMad: number; // Saisi par le commercial
  validityDays: number;
  commercialName: string;
  commercialEmail?: string;
  commercialPhone?: string;
  workspaceLegal?: {
    raisonSociale?: string;
    ice?: string;
    adresse?: string;
    telephone?: string;
  };
}

/**
 * Formate un montant en MAD sans espaces insécables Unicode (U+202F / U+00A0)
 * qui provoquent des glyphes cassés (« / ») avec la police intégrée Helvetica de jsPDF.
 */
export function formatPdfMad(amount: number, decimals = 2): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return safe
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/[\u00A0\u202F]/g, ' ');
}

export function generateClientQuotePdf(config: QuoteConfig): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    fiche,
    produitOrangePro,
    tier,
    quantiteFixe,
    quantiteMobile,
    prixMensuelMad,
    validityDays,
    commercialName,
    commercialEmail,
    commercialPhone,
    workspaceLegal,
  } = config;

  const quoteNumber = `DV-${fiche.numeroFiche || fiche.id.slice(-6).toUpperCase()}`;
  const todayStr = new Date().toLocaleDateString('fr-FR');
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + (validityDays || 15));
  const validUntilStr = validUntilDate.toLocaleDateString('fr-FR');

  const totalMonthlyHt = Math.max(0, Number(prixMensuelMad) || 0);
  const tvaMonthly = Math.round(totalMonthlyHt * 0.2 * 100) / 100;
  const totalMonthlyTtc = Math.round((totalMonthlyHt + tvaMonthly) * 100) / 100;
  const totalAnnualHt = totalMonthlyHt * 12;
  const totalAnnualTtc = totalMonthlyTtc * 12;

  // 1. En-tête DIVERSIFIA (Brand Orange #F96614 & Dark Stone #1C1917)
  doc.setFillColor(28, 25, 23); // #1C1917
  doc.rect(0, 0, 210, 38, 'F');

  doc.setFillColor(249, 102, 20); // Orange #F96614
  doc.rect(0, 38, 210, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('DIVERSIFIA', 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 220, 220);
  doc.text('Partenaire Officiel B2B Orange Maroc — Solutions Entreprises', 15, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(249, 102, 20);
  doc.text('DEVIS COMMERCIAL', 195, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`N° ${quoteNumber}`, 195, 25, { align: 'right' });
  doc.text(`Date : ${todayStr}`, 195, 31, { align: 'right' });

  // 2. Coordonnées Émetteur (Workspace Legal)
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);

  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('ÉMETTEUR :', 15, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  const issuerName = workspaceLegal?.raisonSociale?.trim() || 'DIVERSIFIA — Partenaire Orange Pro B2B';
  const issuerNameLines = doc.splitTextToSize(issuerName, 95);
  doc.text(issuerNameLines, 15, y);
  y += issuerNameLines.length * 4;
  if (workspaceLegal?.ice?.trim()) {
    doc.text(`ICE : ${workspaceLegal.ice.trim()}`, 15, y);
    y += 4;
  }
  const issuerAddr = workspaceLegal?.adresse?.trim() || 'Maroc — Direction Commerciale Entreprises';
  const issuerAddrLines = doc.splitTextToSize(issuerAddr, 95);
  doc.text(issuerAddrLines, 15, y);
  y += issuerAddrLines.length * 4;
  doc.text(`Tél : ${workspaceLegal?.telephone?.trim() || commercialPhone || 'Service Commercial B2B'}`, 15, y);

  // 3. Coordonnées Prospect / Client
  let yRight = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT / PROSPECT :', 120, yRight);
  doc.setFont('helvetica', 'normal');
  yRight += 5;
  const societeLines = doc.splitTextToSize(fiche.societe || 'Client Orange Pro', 75);
  doc.text(societeLines, 120, yRight);
  yRight += societeLines.length * 4;
  const contactLines = doc.splitTextToSize(
    `À l'attention de : ${fiche.contact || 'Direction / Responsable'} (${fiche.role || 'Décideur'})`,
    75
  );
  doc.text(contactLines, 120, yRight);
  yRight += contactLines.length * 4;
  const villeLines = doc.splitTextToSize(`Ville : ${fiche.ville || 'Maroc'}`, 75);
  doc.text(villeLines, 120, yRight);
  yRight += villeLines.length * 4;
  const coordLines = doc.splitTextToSize(
    `Tél : ${fiche.telephone || 'Non renseigné'} | Email : ${fiche.email || 'Non renseigné'}`,
    75
  );
  doc.text(coordLines, 120, yRight);
  yRight += Math.max(0, (coordLines.length - 1) * 4);

  // 4. Commercial en charge
  y = Math.max(y, yRight) + 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, 195, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text("Chargé d'Affaires Orange Pro :", 15, y);
  doc.setFont('helvetica', 'normal');
  const commercialLines = doc.splitTextToSize(
    `${commercialName}${commercialEmail ? ` (${commercialEmail})` : ''}`,
    120
  );
  doc.text(commercialLines, 75, y);
  y += Math.max(0, (commercialLines.length - 1) * 4.5);

  // 5. Tableau des offres / prestations
  y += 10;
  doc.setFillColor(245, 245, 244);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  doc.text("Désignation de l'offre Orange Pro", 18, y + 5.5);
  doc.text('Segment', 108, y + 5.5);
  doc.text('Qté', 138, y + 5.5);
  doc.text('Total Mensuel HT', 192, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const productLines = doc.splitTextToSize(produitOrangePro || 'Pack Orange Pro', 86);
  const rowHeight = Math.max(12, productLines.length * 4.5 + 6);
  doc.rect(15, y, 180, rowHeight);
  doc.text(productLines, 18, y + 6);
  doc.text(tier, 108, y + 6);
  doc.text(`${quantiteFixe} fix. / ${quantiteMobile} mob.`, 138, y + 6);
  doc.text(`${formatPdfMad(totalMonthlyHt, 2)} MAD`, 192, y + 6, { align: 'right' });

  // 6. Totaux HT, TVA (20%) et TTC
  y += rowHeight + 8;
  doc.setFillColor(254, 243, 235); // Orange soft bg
  doc.roundedRect(105, y, 90, 32, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('TOTAL HT MENSUEL :', 110, y + 7);
  doc.text(`${formatPdfMad(totalMonthlyHt, 2)} MAD`, 191, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('TVA (20%) :', 110, y + 13);
  doc.text(`${formatPdfMad(tvaMonthly, 2)} MAD`, 191, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(194, 65, 12); // Orange dark
  doc.text('TOTAL TTC MENSUEL :', 110, y + 20);
  doc.text(`${formatPdfMad(totalMonthlyTtc, 2)} MAD`, 191, y + 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Engagement annuel : ${formatPdfMad(totalAnnualHt, 0)} MAD HT (${formatPdfMad(totalAnnualTtc, 0)} MAD TTC)`,
    110,
    y + 27
  );

  // 7. Conditions de validité et mentions légales (AUCUNE COMMISSION IMPRIMÉE)
  y += 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  doc.text("Conditions générales de l'offre :", 15, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`- Offre exclusive Orange Pro B2B valable jusqu'au ${validUntilStr} (${validityDays} jours).`, 15, y);
  y += 4;
  doc.text('- Raccordement fibre et déploiement flotte mobile selon éligibilité technique sur site.', 15, y);
  y += 4;
  doc.text('- Document commercial confidentiel établi à destination exclusive du prospect.', 15, y);

  // Signature / Bon pour accord
  y += 16;
  doc.setDrawColor(180, 180, 180);
  doc.rect(15, y, 85, 25);
  doc.rect(110, y, 85, 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('Pour DIVERSIFIA', 18, y + 5);
  doc.text('Bon pour accord & Signature Client', 113, y + 5);

  // Enregistrer le PDF
  const safeFilename = `Devis_Orange_Pro_${(fiche.societe || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}_${quoteNumber}.pdf`;
  doc.save(safeFilename);
}
