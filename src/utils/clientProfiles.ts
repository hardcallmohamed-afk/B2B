import type { FicheEntreprise, SecteurCode } from '../App';
import {
  buildMonthlyHistoryStrings,
  isConfirmedPayoutStatus,
  type SignedContractRecord,
} from './gamification';

export interface ClientTypeProfile {
  secteur: SecteurCode;
  clientTypeLabel: string;
  segmentCommercial: string;
  decisionMakerProfile: string;
  typicalLineSizing: string;
  billingCycle: string;
  telecomChallenges: string[];
  recommendedSolutions: string[];
  salesArguments: string[];
  discoveryQuestions: string[];
  suggestedMonthlyBudgetMad: string;
}

const SECTOR_PROFILES: Record<SecteurCode, Omit<ClientTypeProfile, 'secteur'>> = {
  fiduciaire: {
    clientTypeLabel: 'Cabinet Fiduciaire & Expertise Comptable',
    segmentCommercial: 'Segment Bleu · Services à Haute Disponibilité',
    decisionMakerProfile: 'Expert-Comptable / Associé Gérant / Responsable Administratif',
    typicalLineSizing: '1 à 2 lignes Fibre Pro 200M–500M + 5 à 20 forfaits Mobile Pro + standard fixe',
    billingCycle: 'Facturation entreprise TVA récupérable · Engagement 24 mois',
    telecomChallenges: [
      'Télé-déclarations fiscales (DGI / SIMPL) et CNSS critiques en fin de mois : zéro coupure tolérée.',
      'Transfert sécurisé de liasses fiscales, bilans volumineux et dossiers clients en cloud.',
      'Accueil téléphonique multi-appels simultané lors des échéances trimestrielles.',
    ],
    recommendedSolutions: [
      'Fibre Pro Orange 200M ou 500M avec IP fixe et SLA intervention rapide',
      'Back-up 4G/5G Business Box pour continuité absolue sur les déclarations',
      'Standard Cloud / Lignes fixes VoIP avec renvoi vers les collaborateurs comptables',
      'Flotte Mobile Pro avec appels illimités vers les clients et administrations',
    ],
    salesArguments: [
      'Continuité d’activité garantie pendant les pics de clôture fiscale (Fibre + secours 4G/5G).',
      'Facture unique consolidée Fixe + Mobile facilitant la comptabilité interne du cabinet.',
      'Débit symétrique et IP fixe adaptés aux logiciels Sage, Ciel et plateformes cloud.',
    ],
    discoveryQuestions: [
      'Avez-vous déjà subi une coupure internet en pleine période de télédéclaration DGI/CNSS ?',
      'Combien de collaborateurs ont besoin d’appels pro illimités ou d’un numéro fixe direct ?',
      'Utilisez-vous un serveur comptable distant nécessitant une IP fixe dédiée ?',
    ],
    suggestedMonthlyBudgetMad: '1 200 – 3 500 MAD HT / mois',
  },
  clinique: {
    clientTypeLabel: 'Clinique Privée, Polyclinique & Centre Médical',
    segmentCommercial: 'Segment Bleu · Infrastructure Critique Santé',
    decisionMakerProfile: 'Directeur Général / Directeur Médical / Responsable SI & Achats',
    typicalLineSizing: 'Fibre Dédiée / 500M–1G + Standard multi-postes + 15 à 60 lignes Mobile Pro',
    billingCycle: 'Contrat Grand Compte / PME Santé · Facturation mensuelle centralisée',
    telecomChallenges: [
      'Transmission rapide d’imagerie médicale (IRM, scanner, radio PACS) et dossiers patients.',
      'Standard d’accueil et prise de rendez-vous saturés avec besoin de file d’attente intelligente.',
      'Couverture Wi-Fi séparée : réseau médical sécurisé vs Wi-Fi patients & visiteurs.',
    ],
    recommendedSolutions: [
      'Fibre Pro 500M / 1 Gbps ou Liaison Spécialisée avec GTR garantie',
      'Standard Téléphonique IP (PABX / Centrex) multi-services (Urgences, Accueil, Labo)',
      'Flotte Mobile Orange Pro pour médecins de garde, infirmiers et ambulances',
      'Wi-Fi Pro managé à double SSID (staff médical sécurisé + portail captif visiteurs)',
    ],
    salesArguments: [
      'Fiabilité réseau critique pour le dossier patient informatisé et la télé-imagerie.',
      'Zéro appel patient perdu grâce au standard multi-lignes avec message d’accueil dédié.',
      'Interlocuteur B2B dédié DIVERSIFIA pour le déploiement sans interruption des soins.',
    ],
    discoveryQuestions: [
      'Votre standard actuel gère-t-il efficacement les appels simultanés des urgences et rendez-vous ?',
      'Disposez-vous d’une ligne de secours automatique en cas d’incident sur la fibre principale ?',
      'Comment équipez-vous aujourd’hui vos équipes de garde et coordinateurs médicaux ?',
    ],
    suggestedMonthlyBudgetMad: '3 500 – 12 000 MAD HT / mois',
  },
  notaire: {
    clientTypeLabel: 'Étude Notariale',
    segmentCommercial: 'Segment Bleu · Professions Réglementées & Confiance',
    decisionMakerProfile: 'Maître Notaire Titulaire / Clerc Principal',
    typicalLineSizing: 'Fibre Pro 200M + IP Fixe + 3 à 12 lignes Mobile Pro + Fixe accueil',
    billingCycle: 'Facturation étude notariale · Débit mensuel automatisé',
    telecomChallenges: [
      'Accès permanent aux portails Tawtik, Conservation Foncière (ANCFCC) et DGI.',
      'Confidentialité des échanges, signatures électroniques et visioconférences clients MRE.',
      'Disponibilité téléphonique irréprochable auprès des promoteurs, banques et acquéreurs.',
    ],
    recommendedSolutions: [
      'Fibre Pro 200M avec IP Fixe sécurisée et backup 4G Pro',
      'Ligne Fixe Pro avec numéro géographique prestigieux et renvoi d’appel',
      'Forfaits Mobile Pro incluant data généreuse et roaming international (clients MRE)',
    ],
    salesArguments: [
      'Connexion stable et rapide pour Tawtik, ANCFCC et les signatures à distance.',
      'Options roaming et appels internationaux maîtrisés pour la clientèle résidant à l’étranger.',
      'Installation clé en main et suivi après-vente prioritaire dédié aux professions réglementées.',
    ],
    discoveryQuestions: [
      'Traitez-vous régulièrement des dossiers avec des MRE ou investisseurs à l’étranger ?',
      'Votre connexion actuelle suffit-elle pour les visioconférences et l’archivage sécurisé des actes ?',
      'Souhaitez-vous regrouper l’ensemble des lignes mobiles des clercs sur une seule facture ?',
    ],
    suggestedMonthlyBudgetMad: '900 – 2 800 MAD HT / mois',
  },
  immobilier: {
    clientTypeLabel: 'Promoteur Immobilier & Agence Immobilière',
    segmentCommercial: 'Segment Vert · Mobilité Terrain & Bureaux de Vente',
    decisionMakerProfile: 'Directeur Général / Directeur Commercial / Gérant d’Agence',
    typicalLineSizing: 'Fibre Pro siège + Box 4G/5G bureaux de vente + 8 à 30 Mobile Pro',
    billingCycle: 'Multi-sites centralisé sur compte unique entreprise',
    telecomChallenges: [
      'Connecter rapidement des bureaux de vente éphémères ou chantiers sans attendre le génie civil.',
      'Équiper les conseillers commerciaux en mobilité permanente (WhatsApp Pro, vidéos HD, visites).',
      'Centraliser les appels entrants des campagnes publicitaires sans perdre aucun lead acheteur.',
    ],
    recommendedSolutions: [
      'Fibre Pro au siège + Business Box 4G/5G instantanée sur les showrooms / bureaux de vente',
      'Flotte Mobile Pro avec gros volume Data (vidéos, plans 3D, visites virtuelles)',
      'Numéro Fixe Pro unique avec renvoi automatique vers les commerciaux de permanence',
    ],
    salesArguments: [
      'Déploiement immédiat des bureaux de vente en 24h avec la Business Box 4G/5G Pro.',
      'Chaque appel prospect est décroché grâce au renvoi intelligent vers les conseillers.',
      'Maîtrise budgétaire totale sur la flotte mobile des agents commerciaux.',
    ],
    discoveryQuestions: [
      'Combien de bureaux de vente ou projets actifs devez-vous connecter cette année ?',
      'Vos agents utilisent-ils leurs numéros personnels ou une flotte entreprise conservée par la société ?',
      'Comment gérez-vous les appels entrants générés par vos campagnes immobilières ?',
    ],
    suggestedMonthlyBudgetMad: '1 800 – 6 000 MAD HT / mois',
  },
  riad_hotellerie: {
    clientTypeLabel: 'Riad, Hôtel, Maison d’Hôtes & Tourisme',
    segmentCommercial: 'Segment Vert · Hospitalité & Expérience Wi-Fi Client',
    decisionMakerProfile: 'Propriétaire / Directeur d’Exploitation / Responsable Hébergement',
    typicalLineSizing: 'Fibre Pro 200M–500M + Réseau Wi-Fi multi-bornes + Fixe réception + Mobile équipe',
    billingCycle: 'Facturation établissement hôtelier · Option saisonnalité maîtrisée',
    telecomChallenges: [
      'Note Booking / TripAdvisor directement impactée par la qualité du Wi-Fi dans chaque chambre/patio.',
      'Murs épais en pisé/médina nécessitant une couverture Wi-Fi Pro maillée sans zones blanches.',
      'Gestion des plateformes OTA (Booking, Expedia, Airbnb), TPE bancaires et appels internationaux.',
    ],
    recommendedSolutions: [
      'Fibre Pro Très Haut Débit (200M à 500M) dédiée à l’établissement',
      'Architecture Wi-Fi Pro étendue (chambres, terrasses, réception) avec réseau TPE isolé',
      'Forfaits Mobile Pro pour chauffeurs, conciergerie et direction + fixe réception',
    ],
    salesArguments: [
      'Amélioration immédiate de la satisfaction client et des avis en ligne grâce au très haut débit.',
      'Séparation stricte entre le Wi-Fi invités et le réseau interne (TPE, PMS, réservations).',
      'Secours 4G/5G pour ne jamais bloquer les paiements TPE ni les check-ins.',
    ],
    discoveryQuestions: [
      'Avez-vous des zones mortes Wi-Fi dans certaines chambres, suites ou sur la terrasse ?',
      'Vos TPE bancaires et votre logiciel de réservation partagent-ils le même réseau que les clients ?',
      'Vos chauffeurs et réceptionnistes disposent-ils de lignes pro dédiées pour WhatsApp clients ?',
    ],
    suggestedMonthlyBudgetMad: '1 400 – 4 500 MAD HT / mois',
  },
  auto_ecole: {
    clientTypeLabel: 'Auto-École & Centre de Formation Conduite',
    segmentCommercial: 'Segment Vert · TPE / Proximité & Gestion NARSA',
    decisionMakerProfile: 'Directeur / Gérant Fondateur',
    typicalLineSizing: 'Fibre Pro 100M–200M + 1 Fixe accueil + 2 à 6 Mobile Pro (moniteurs)',
    billingCycle: 'Pack TPE simplifié · Facture unique mensuelle',
    telecomChallenges: [
      'Accès fiable aux plateformes NARSA et logiciels de code de la route en salle.',
      'Coordination rapide entre le secrétariat et les moniteurs sur route.',
      'Visibilité professionnelle avec un numéro fixe et une réactivité WhatsApp candidats.',
    ],
    recommendedSolutions: [
      'Pack Fibre Pro TPE + Téléphonie Fixe incluse pour l’agence',
      'Flotte Mobile Pro économique (appels illimités entre secrétariat et moniteurs)',
      'Option Backup 4G si l’agence est en zone non encore fibrée',
    ],
    salesArguments: [
      'Budget fixe et prévisible regroupant internet salle de code, téléphone fixe et mobiles moniteurs.',
      'Zéro blocage sur les inscriptions et plannings en ligne NARSA.',
      'Mise en service rapide et accompagnement local DIVERSIFIA.',
    ],
    discoveryQuestions: [
      'Combien d’agences ou de véhicules/moniteurs coordonnez-vous chaque jour ?',
      'Avez-vous besoin d’internet stable pour les écrans de code et la gestion des dossiers NARSA ?',
      'Souhaitez-vous réduire le coût mensuel global de vos lignes internet + mobiles ?',
    ],
    suggestedMonthlyBudgetMad: '550 – 1 500 MAD HT / mois',
  },
  pme: {
    clientTypeLabel: 'PME, Services B2B, Transit & Logistique',
    segmentCommercial: 'Segment Orange · Croissance & Flotte Multi-Collaborateurs',
    decisionMakerProfile: 'Directeur Général / Directeur Administratif & Financier / Responsable IT',
    typicalLineSizing: 'Fibre Pro 200M–500M + 10 à 40 lignes Mobile Pro + Standard VoIP',
    billingCycle: 'Contrat Entreprise PME · Facturation consolidée multi-lignes',
    telecomChallenges: [
      'Productivité des équipes commerciales, chauffeurs et administratifs répartis sur le terrain.',
      'Outils collaboratifs cloud (ERP, CRM, Microsoft 365, visioconférence) gourmands en upload.',
      'Contrôle des coûts télécoms, suivi de consommation et conservation des numéros en cas de turnover.',
    ],
    recommendedSolutions: [
      'Pack Convergent Fibre Pro 200M/500M + Flotte Mobile Orange Pro sur mesure',
      'Téléphonie Fixe IP / Standard virtuel avec transfert d’appels interne gratuit',
      'Solutions Data mobile / Tablettes pour équipes commerciales et livreurs',
    ],
    salesArguments: [
      'Propriété des numéros conservée par l’entreprise : vos clients restent chez vous.',
      'Remises flotte progressives dès 5 lignes mobiles combinées à la Fibre Pro.',
      'Tableau de bord clair et facture unique mensuelle avec suivi commercial dédié.',
    ],
    discoveryQuestions: [
      'Combien de collaborateurs ont besoin d’une ligne mobile entreprise ou d’un accès data terrain ?',
      'Êtes-vous satisfait du débit montant (upload) et du support technique de votre opérateur actuel ?',
      'À quelle date arrive l’échéance de votre contrat télécom actuel ?',
    ],
    suggestedMonthlyBudgetMad: '2 000 – 7 500 MAD HT / mois',
  },
  industrie: {
    clientTypeLabel: 'Industrie, Unité de Production & Agro-Industrie',
    segmentCommercial: 'Segment Orange · Grand Compte & Zones Industrielles',
    decisionMakerProfile: 'Directeur Industriel / DSI / Directeur Achats & Moyens Généraux',
    typicalLineSizing: 'Fibre Pro / Liaison Dédiée + Interconnexion multi-sites + 25 à 150 Mobile Pro',
    billingCycle: 'Convention Grand Compte · SLA dédié & facturation analytique',
    telecomChallenges: [
      'Sites situés en zone industrielle nécessitant une étude d’éligibilité Fibre ou faisceau dédié.',
      'Interconnexion sécurisée entre usine, entrepôts logistiques et siège administratif (VPN/MPLS).',
      'Gestion de flottes importantes (cadres, chefs d’équipe, maintenance, commerciaux, M2M/GPS).',
    ],
    recommendedSolutions: [
      'Fibre Pro Haute Disponibilité / Liaison Spécialisée avec GTR contractuelle',
      'Interconnexion VPN / IP Fixe pour ERP industriel (SAP, Sage X3) et vidéosurveillance',
      'Flotte Mobile Grand Compte multi-paliers (Direction, Cadres, Terrain) + cartes SIM M2M/IoT',
    ],
    salesArguments: [
      'Haute disponibilité réseau indispensable pour la chaîne de production et les expéditions.',
      'Optimisation immédiate de la facture télécom globale via des paliers adaptés à chaque profil métier.',
      'Accompagnement ingénierie avant-vente et déploiement coordonné sur zone industrielle.',
    ],
    discoveryQuestions: [
      'Avez-vous plusieurs sites (usine, dépôts, siège) à interconnecter de manière sécurisée ?',
      'Utilisez-vous des cartes SIM de géolocalisation GPS ou de télémétrie sur vos équipements ?',
      'Quel est le nombre total de lignes mobiles et fixes actuellement actives sur vos sites ?',
    ],
    suggestedMonthlyBudgetMad: '5 000 – 25 000 MAD HT / mois',
  },
  btp: {
    clientTypeLabel: 'Entreprise BTP, Construction & Génie Civil',
    segmentCommercial: 'Segment Orange · Multi-Chantiers & Mobilité Intensive',
    decisionMakerProfile: 'PDG / Directeur Travaux / Responsable Achats & Parc',
    typicalLineSizing: 'Fibre siège + Box 4G/5G chantiers mobiles + 15 à 80 Mobile Pro + SIM GPS',
    billingCycle: 'Contrat Flotte & Multi-Sites · Ajout rapide de lignes chantiers',
    telecomChallenges: [
      'Connecter des bases-vie et chantiers temporaires partout au Maroc sans délai.',
      'Échanges permanents de plans AutoCAD/BIM, photos d’avancement et bons de livraison.',
      'Suivi GPS des engins, camions et conducteurs de travaux sur le terrain.',
    ],
    recommendedSolutions: [
      'Fibre Pro au siège social + Business Box 4G/5G déplaçables d’un chantier à l’autre',
      'Flotte Mobile Pro robuste avec appels illimités et Data renforcée pour conducteurs de travaux',
      'Cartes SIM Data / M2M pour suivi flotte véhicules et engins de chantier',
    ],
    salesArguments: [
      'Vos bases-vie sont connectées dès le jour 1 grâce aux routeurs 4G/5G Pro transportables.',
      'Communication fluide et illimitée entre le siège, les chefs de chantier et les fournisseurs.',
      'Facturation unifiée avec maîtrise des plafonds par catégorie de collaborateur.',
    ],
    discoveryQuestions: [
      'Combien de chantiers ouverts nécessitent aujourd’hui un accès internet autonome ?',
      'Comment vos conducteurs de travaux transfèrent-ils les plans et rapports quotidiens ?',
      'Avez-vous une flotte d’engins ou camions nécessitant des cartes SIM GPS/tracking ?',
    ],
    suggestedMonthlyBudgetMad: '2 500 – 12 000 MAD HT / mois',
  },
  gros: {
    clientTypeLabel: 'Grossiste, Distribution & Négoce Multi-Régions',
    segmentCommercial: 'Segment Orange · Force de Vente Itinérante & Commandes',
    decisionMakerProfile: 'Gérant / Directeur Commercial / Responsable Logistique',
    typicalLineSizing: 'Fibre Pro dépôts + 10 à 50 Mobile Pro / Tablettes prise de commande',
    billingCycle: 'Facturation entreprise · Remises volume flotte commerciale',
    telecomChallenges: [
      'Prise de commande en temps réel sur tablette/mobile par les livreurs et commerciaux terrain.',
      'Volume élevé d’appels entrants et sortants avec les détaillants et fournisseurs.',
      'Continuité internet au dépôt pour la facturation, les bons de sortie et la gestion de stock.',
    ],
    recommendedSolutions: [
      'Fibre Pro 200M/500M aux dépôts et bureaux de facturation + secours 4G',
      'Flotte Mobile Pro appels illimités + Data dédiée pour applications de prise de commande',
      'Cartes SIM Data / M2M pour suivi des tournées de livraison',
    ],
    salesArguments: [
      'Zéro rupture dans la facturation au dépôt ni dans la remontée des commandes terrain.',
      'Coût réduit par commercial grâce aux offres flotte Orange Pro appels illimités.',
      'Meilleure couverture réseau nationale sur les axes interurbains et zones périphériques.',
    ],
    discoveryQuestions: [
      'Combien de commerciaux itinérants et livreurs sillonnent vos zones de distribution ?',
      'Utilisez-vous une application mobile ou ERP connecté pour les commandes et stocks ?',
      'Disposez-vous de plusieurs dépôts ou points de vente à équiper ?',
    ],
    suggestedMonthlyBudgetMad: '2 000 – 8 000 MAD HT / mois',
  },
  enseignement: {
    clientTypeLabel: 'École Privée, Institut & Centre de Formation',
    segmentCommercial: 'Segment Violet · Très Haut Débit Collectif & Salles Connectées',
    decisionMakerProfile: 'Directeur Fondateur / Directeur Pédagogique / Responsable Administratif',
    typicalLineSizing: 'Fibre Pro 200M–500M + Wi-Fi pédagogique sécurisé + Fixe + 5 à 20 Mobile Pro',
    billingCycle: 'Facturation établissement scolaire · Contrat annuel / 24 mois',
    telecomChallenges: [
      'Connexion simultanée des salles informatiques, tableaux interactifs et plateformes Massar/LMS.',
      'Accueil téléphonique massif pendant les périodes d’inscriptions et de rentrée scolaire.',
      'Communication rapide avec les parents (appels, WhatsApp, transport scolaire).',
    ],
    recommendedSolutions: [
      'Fibre Pro 200M à 500M avec répartition Wi-Fi Pro sécurisée (Administration vs Salles)',
      'Ligne Fixe Pro multi-canaux pour ne manquer aucun appel parent lors des inscriptions',
      'Flotte Mobile Pro pour la direction, la vie scolaire et les chauffeurs de bus scolaires',
    ],
    salesArguments: [
      'Fluidité garantie pour Massar, les cours numériques et la gestion administrative.',
      'Sécurité renforcée sur le Wi-Fi pédagogique et séparation du réseau comptable.',
      'Suivi direct des chauffeurs de transport scolaire grâce aux lignes flotte dédiées.',
    ],
    discoveryQuestions: [
      'Combien de salles informatiques, classes connectées ou campus gérez-vous ?',
      'Votre débit actuel tient-il la charge lors des cours vidéo ou connexions simultanées ?',
      'Vos équipes transport scolaire et accueil ont-elles des lignes professionnelles dédiées ?',
    ],
    suggestedMonthlyBudgetMad: '1 300 – 4 500 MAD HT / mois',
  },
  liberal: {
    clientTypeLabel: 'Profession Libérale (Médecin, Avocat, Architecte, Labo)',
    segmentCommercial: 'Segment Cyan · Pack Pro Clé en Main & Image Premium',
    decisionMakerProfile: 'Praticien / Associé Fondateur / Secrétaire Principale',
    typicalLineSizing: 'Fibre Pro 100M–200M + Fixe Cabinet + 1 à 6 Mobile Pro',
    billingCycle: 'Facturation cabinet professionnel · Gestion ultra-simple',
    telecomChallenges: [
      'Continuité internet pour logiciels métier (dossier médical, plans CAO/BIM, procédures juridiques).',
      'Accueil téléphonique soigné et joignabilité sans mélanger vie privée et vie professionnelle.',
      'Envoi rapide de fichiers lourds (radios, plans d’architecture, conclusions juridiques).',
    ],
    recommendedSolutions: [
      'Pack Fibre Pro 100M/200M + Ligne Fixe Pro cabinet',
      'Forfaits Mobile Orange Pro avec appels illimités et Data confortable',
      'Option IP Fixe ou Backup 4G pour les cabinets médicaux et laboratoires d’analyses',
    ],
    salesArguments: [
      'Offre tout-en-un rapide à installer avec un seul interlocuteur dédié.',
      'Téléversement rapide des dossiers volumineux (architectes, labos, imagerie).',
      'Séparation claire entre le numéro du cabinet et le téléphone personnel du praticien.',
    ],
    discoveryQuestions: [
      'Utilisez-vous un logiciel métier cloud ou envoyez-vous fréquemment des fichiers volumineux ?',
      'Votre secrétariat dispose-t-il d’un accueil fixe fiable avec transfert vers votre mobile ?',
      'Souhaitez-vous regrouper internet cabinet + lignes mobiles sur une seule facture pro ?',
    ],
    suggestedMonthlyBudgetMad: '650 – 2 200 MAD HT / mois',
  },
  commerce: {
    clientTypeLabel: 'Pharmacie, Commerce, Restauration & Retail',
    segmentCommercial: 'Segment Cyan · Continuité Caisse, TPE & Multi-Points de Vente',
    decisionMakerProfile: 'Pharmacien Titulaire / Gérant / Propriétaire de Point de Vente',
    typicalLineSizing: 'Fibre Pro 100M–200M + Secours 4G TPE + Fixe + 2 à 8 Mobile Pro',
    billingCycle: 'Pack Pro Commerce · Coût mensuel optimisé',
    telecomChallenges: [
      'Zéro interruption tolérée sur les TPE bancaires, caisses enregistreuses et commandes grossistes.',
      'Besoin de connexion fiable pour la vidéosurveillance à distance et les plateformes de livraison.',
      'Gestion des commandes clients par téléphone et WhatsApp Business.',
    ],
    recommendedSolutions: [
      'Fibre Pro 100M/200M + Secours 4G dédié caisse/TPE (continuité d’encaissement)',
      'Ligne Fixe Pro + Forfaits Mobile Pro pour gérant et préparateurs/livreurs',
      'Wi-Fi invité séparé du réseau caisse/vidéosurveillance (cafés, restaurants, commerces)',
    ],
    salesArguments: [
      'Vos encaissements TPE et commandes fournisseurs ne s’arrêtent jamais grâce au secours 4G.',
      'Accès fluide à la vidéosurveillance sur smartphone depuis n’importe où.',
      'Tarif packagé compétitif incluant internet très haut débit, fixe et mobiles pro.',
    ],
    discoveryQuestions: [
      'Que se passe-t-il sur vos TPE bancaires et votre caisse si votre internet principal coupe ?',
      'Avez-vous d’autres points de vente ou un besoin d’accès à distance aux caméras ?',
      'Recevez-vous des commandes clients via téléphone fixe ou WhatsApp Business ?',
    ],
    suggestedMonthlyBudgetMad: '600 – 2 000 MAD HT / mois',
  },
};

export function getClientTypeProfile(fiche: Pick<FicheEntreprise, 'secteur' | 'effectif'>): ClientTypeProfile {
  const base = SECTOR_PROFILES[fiche.secteur] || SECTOR_PROFILES.pme;
  const effNum = parseInt(String(fiche.effectif || '').replace(/[^\d]/g, ''), 10) || 0;
  let adjustedSizing = base.typicalLineSizing;
  if (effNum >= 50) {
    adjustedSizing = `Grand Compte (${effNum} sal.) · Fibre Pro 500M–1G + Backup dédié + flotte estimée ${Math.max(15, Math.round(effNum * 0.45))} lignes Mobile Pro`;
  } else if (effNum >= 15) {
    adjustedSizing = `PME (${effNum} sal.) · Fibre Pro 200M–500M + Standard VoIP + flotte estimée ${Math.max(6, Math.round(effNum * 0.5))} lignes Mobile Pro`;
  }

  return {
    secteur: fiche.secteur,
    ...base,
    typicalLineSizing: adjustedSizing,
  };
}

export function buildMemberContractSyncSummary(ownerContracts: SignedContractRecord[]): {
  totalContracts: number;
  totalPayoutMad: number;
  monthlyHistory: string[];
} {
  const confirmed = ownerContracts.filter((c) => isConfirmedPayoutStatus(c.payoutStatus));
  const totalContracts = confirmed.length;
  const totalPayoutMad = Math.round(
    confirmed.reduce((sum, c) => sum + Math.max(0, Number(c.payoutMad) || 0), 0)
  );
  const monthlyHistory = buildMonthlyHistoryStrings(ownerContracts);
  return { totalContracts, totalPayoutMad, monthlyHistory };
}
