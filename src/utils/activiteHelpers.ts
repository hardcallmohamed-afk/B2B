// Activity, reminder, and appointment helpers for DIVERSIFIA Orange Pro CRM.
// Pure functions, 100% testable in Node.js.

import {
  VALID_ACTIVITE_TYPES,
  VALID_ACTIVITE_RESULTATS,
  type ActiviteType,
  type ActiviteResultat,
  type ActiviteLike,
} from './firestoreSanitize';

export interface RdvValidationResult {
  valid: boolean;
  error?: string;
  normalizedDate?: string;
  normalizedLieu?: string;
}

export function validateRdvRequirements(rdvAt?: unknown, rdvLieu?: unknown): RdvValidationResult {
  if (typeof rdvAt !== 'string' || !rdvAt.trim()) {
    return {
      valid: false,
      error: 'La date et l’heure du rendez-vous sont obligatoires pour passer en statut « RDV pris ».',
    };
  }

  const parsed = new Date(rdvAt.trim());
  if (isNaN(parsed.getTime())) {
    return {
      valid: false,
      error: 'Format de date/heure de RDV invalide.',
    };
  }

  if (typeof rdvLieu !== 'string' || !rdvLieu.trim() || rdvLieu.trim().length < 2) {
    return {
      valid: false,
      error: 'Le lieu ou l’adresse du rendez-vous est obligatoire (au moins 2 caractères).',
    };
  }

  return {
    valid: true,
    normalizedDate: parsed.toISOString(),
    normalizedLieu: rdvLieu.trim().slice(0, 160),
  };
}

export function isFicheDueForRelanceToday(prochaineRelanceAt?: unknown, now: Date = new Date()): boolean {
  if (typeof prochaineRelanceAt !== 'string' || !prochaineRelanceAt.trim()) {
    return false;
  }

  const targetDate = new Date(prochaineRelanceAt.trim());
  if (isNaN(targetDate.getTime())) {
    return false;
  }

  // End of current local day (23:59:59.999)
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return targetDate.getTime() <= endOfToday.getTime();
}

export const ACTIVITE_TYPE_META: Record<
  ActiviteType,
  { label: string; iconName: string; bgClass: string; textClass: string }
> = {
  appel: {
    label: 'Appel téléphonique',
    iconName: 'Phone',
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-700',
  },
  whatsapp: {
    label: 'Message WhatsApp',
    iconName: 'MessageSquare',
    bgClass: 'bg-green-50 border-green-200',
    textClass: 'text-green-700',
  },
  email: {
    label: 'Email professionnel',
    iconName: 'Mail',
    bgClass: 'bg-sky-50 border-sky-200',
    textClass: 'text-sky-700',
  },
  visite: {
    label: 'Visite terrain',
    iconName: 'MapPin',
    bgClass: 'bg-purple-50 border-purple-200',
    textClass: 'text-purple-700',
  },
  note: {
    label: 'Note interne',
    iconName: 'FileText',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-700',
  },
  rdv: {
    label: 'Rendez-vous fixé',
    iconName: 'Calendar',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-700',
  },
  devis: {
    label: 'Devis préparé',
    iconName: 'FileSpreadsheet',
    bgClass: 'bg-indigo-50 border-indigo-200',
    textClass: 'text-indigo-700',
  },
  statut: {
    label: 'Changement de statut',
    iconName: 'ArrowRightLeft',
    bgClass: 'bg-stone-100 border-stone-200',
    textClass: 'text-stone-700',
  },
  attribution: {
    label: 'Attribution de fiche',
    iconName: 'UserPlus',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-800',
  },
  acces: {
    label: 'Accès / Consultation',
    iconName: 'Eye',
    bgClass: 'bg-sky-50 border-sky-200',
    textClass: 'text-sky-800',
  },
  modification: {
    label: 'Modification fiche',
    iconName: 'Pencil',
    bgClass: 'bg-amber-50 border-amber-200',
    textClass: 'text-amber-800',
  },
  restitution: {
    label: 'Restitution fiche signée',
    iconName: 'RotateCcw',
    bgClass: 'bg-violet-50 border-violet-200',
    textClass: 'text-violet-800',
  },
  signature: {
    label: 'Signature Orange Pro',
    iconName: 'CheckCircle2',
    bgClass: 'bg-emerald-50 border-emerald-200',
    textClass: 'text-emerald-800',
  },
};

export const ACTIVITE_RESULTAT_META: Record<
  ActiviteResultat,
  { label: string; badgeClass: string }
> = {
  joint: { label: 'Décideur joint', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  pas_de_reponse: { label: 'Pas de réponse / Répondeur', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  rappeler: { label: 'À rappeler', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  rdv_fixe: { label: 'RDV fixé', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' },
  refus: { label: 'Refus / Pas intéressé', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
  autre: { label: 'Autre résultat', badgeClass: 'bg-stone-100 text-stone-800 border-stone-200' },
  vide: { label: '', badgeClass: '' },
};

export function formatFriendlyDateFr(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatAuditDateTimeFr(isoString?: string): string {
  if (!isoString) return 'Date inconnue';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} à ${hh}:${min}:${ss}`;
  } catch {
    return isoString;
  }
}
