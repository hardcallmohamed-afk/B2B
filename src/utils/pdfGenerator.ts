// Client-side PDF generation for DIVERSIFIA B2B Orange Pro client quotes.
// Zero commission printed. Uses workspace legal info or blank placeholders.

import { jsPDF } from 'jspdf';
import type { FicheEntreprise } from '../App';

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

  const totalMonthly = Math.max(0, prixMensuelMad);
  const totalAnnual = totalMonthly * 12;

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
  doc.setFontSize(14);
  doc.setTextColor(249, 102, 20);
  doc.text(`DEVIS PROPOSITIONS COMMERCIALE`, 130, 18, { align: 'left' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`N° ${quoteNumber}`, 130, 25, { align: 'left' });
  doc.text(`Date : ${todayStr}`, 130, 31, { align: 'left' });

  // 2. Coordonnées Émetteur (Workspace Legal ou À compléter)
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);

  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('ÉMETTEUR :', 15, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text(workspaceLegal?.raisonSociale ? workspaceLegal.raisonSociale : 'DIVERSIFIA (À compléter dans Mon Compte)', 15, y);
  y += 4;
  doc.text(`ICE : ${workspaceLegal?.ice ? workspaceLegal.ice : 'À compléter (ICE)'}`, 15, y);
  y += 4;
  doc.text(workspaceLegal?.adresse ? workspaceLegal.adresse : 'Adresse du siège social non renseignée', 15, y);
  y += 4;
  doc.text(`Tél : ${workspaceLegal?.telephone || commercialPhone || 'Service Commercial B2B'}`, 15, y);

  // 3. Coordonnées Prospect / Client
  let yRight = 50;
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT / PROSPECT :', 120, yRight);
  doc.setFont('helvetica', 'normal');
  yRight += 5;
  doc.text(fiche.societe, 120, yRight);
  yRight += 4;
  doc.text(`À l’attention de : ${fiche.contact || 'Direction / Responsable'} (${fiche.role || 'Décideur'})`, 120, yRight);
  yRight += 4;
  doc.text(`Ville : ${fiche.ville || 'Maroc'}`, 120, yRight);
  yRight += 4;
  doc.text(`Tél : ${fiche.telephone || 'Non renseigné'} | Email : ${fiche.email || 'Non renseigné'}`, 120, yRight);

  // 4. Commercial en charge
  y = Math.max(y, yRight) + 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, 195, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('Chargé d’Affaires Orange Pro :', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${commercialName} ${commercialEmail ? `(${commercialEmail})` : ''}`, 75, y);

  // 5. Tableau des offres / prestations
  y += 10;
  doc.setFillColor(245, 245, 244);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  doc.text('Désignation de l’offre Orange Pro', 18, y + 5.5);
  doc.text('Segment', 110, y + 5.5);
  doc.text('Qté', 145, y + 5.5);
  doc.text('Total Mensuel MAD', 165, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.rect(15, y, 180, 12);
  doc.text(produitOrangePro, 18, y + 7.5);
  doc.text(tier, 110, y + 7.5);
  doc.text(`${quantiteFixe} fixes / ${quantiteMobile} mob.`, 145, y + 7.5);
  doc.text(`${totalMonthly.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`, 165, y + 7.5, { align: 'left' });

  // 6. Totaux
  y += 18;
  doc.setFillColor(254, 243, 235); // Orange soft bg
  doc.roundedRect(115, y, 80, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(194, 65, 12); // Orange dark
  doc.text('TOTAL HT MENSUEL :', 120, y + 8);
  doc.text(`${totalMonthly.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`, 190, y + 8, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Engagement annuel (${totalAnnual.toLocaleString('fr-FR')} MAD)`, 120, y + 16);

  // 7. Conditions de validité et mentions légales (AUCUNE COMMISSION IMPRIMÉE)
  y += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  doc.text('Conditions générales de l’offre :', 15, y);
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
  const safeFilename = `Devis_Orange_Pro_${fiche.societe.replace(/[^a-zA-Z0-9]/g, '_')}_${quoteNumber}.pdf`;
  doc.save(safeFilename);
}
