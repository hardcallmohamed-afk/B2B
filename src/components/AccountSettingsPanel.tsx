import React, { useRef, useState } from 'react';
import {
  Award,
  Bell,
  Camera,
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  Trophy,
  User as UserIcon,
  Volume2,
  Wallet,
} from 'lucide-react';
import {
  ADMIN_DISTINCTION_BADGES,
  formatMad,
  type AchievementSummary,
  type TeamRole,
} from '../utils/gamification';
import { getUserInitials, resizeAvatarImageFile } from '../utils/avatarResize';
import {
  getPushNotificationStatus,
  playCelebrationChime,
  requestPushNotificationPermission,
  type PushNotificationStatus,
} from '../utils/notifications';
import { BadgeChipWithDrawing } from './BadgeArtwork';
import { RoleBadge } from './RoleBadge';
import {
  requestPasswordReset,
  setOrLinkAccountPassword,
  updateOwnAuthDisplayName,
} from '../firebase';
import { formatFirebaseAuthError } from '../utils/authAccess';

export interface UserProfileSettings {
  displayName: string;
  avatarDataUrl: string;
  phonePro: string;
  zone: string;
  bio: string;
  monthlyGoalContracts: number;
  notifyBadges: boolean;
  notifySound: boolean;
  compactUi: boolean;
}

export interface AdvancedAccountPreferences {
  monthlyGoalPayoutMad: number;
  preferredContactChannel: 'whatsapp' | 'phone' | 'email';
  ficheNumberPrefix: 'OP-' | 'DIV-' | 'B2B-';
  followUpAlertDelay: '24h' | '48h' | '72h' | '7d';
  targetMaturityPct: 75 | 85 | 95;
  defaultEmailTone: 'terrain' | 'executif' | 'court';
  defaultEmailCycle:
    | 'premier_contact'
    | 'suite_passage'
    | 'diagnostic'
    | 'relance_devis'
    | 'fin_contrat'
    | 'renouvellement'
    | 'reactivation';
  preferredAiProvider: 'auto' | 'mistral' | 'groq' | 'gemini' | 'openrouter';
  autoAppendPhoneInEmail: boolean;
  csvDelimiter: ';' | ',';
  workHoursSchedule: 'standard_maroc' | 'continu_08_20' | 'terrain_etendu';
  autoSaveIntervalSec: 15 | 30 | 60;
}

const DEFAULT_ADVANCED_PREFS: AdvancedAccountPreferences = {
  monthlyGoalPayoutMad: 15000,
  preferredContactChannel: 'whatsapp',
  ficheNumberPrefix: 'DIV-',
  followUpAlertDelay: '48h',
  targetMaturityPct: 85,
  defaultEmailTone: 'terrain',
  defaultEmailCycle: 'premier_contact',
  preferredAiProvider: 'auto',
  autoAppendPhoneInEmail: true,
  csvDelimiter: ';',
  workHoursSchedule: 'standard_maroc',
  autoSaveIntervalSec: 30,
};

function loadAdvancedAccountPrefs(uid: string): AdvancedAccountPreferences {
  if (typeof window === 'undefined') return DEFAULT_ADVANCED_PREFS;
  try {
    const raw = window.localStorage.getItem(`op_advanced_account_prefs_${uid}`);
    if (!raw) return DEFAULT_ADVANCED_PREFS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ADVANCED_PREFS,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch {
    return DEFAULT_ADVANCED_PREFS;
  }
}

interface AccountSettingsPanelProps {
  uid: string;
  email: string;
  emailVerified: boolean;
  hasPasswordProvider: boolean;
  role: TeamRole;
  profile: UserProfileSettings;
  emailSignature: string;
  villesOptions: string[];
  manualBadges: string[];
  achievementSummary: AchievementSummary;
  contractsCount: number;
  totalPayoutMad: number;
  prospectsCount: number;
  onSaveProfile: (next: UserProfileSettings, nextSignature: string) => void;
  onExportBackup: () => void;
  onSignOut: () => void;
  onJumpToBadges: () => void;
  onJumpToAdminSection?: (section: 'all' | 'users' | 'attendance' | 'vault') => void;
  onTestBadgeAlert?: () => void;
  onNotify: (msg: string, type?: 'ok' | 'warn' | 'err') => void;
}

export const AccountSettingsPanel: React.FC<AccountSettingsPanelProps> = ({
  uid,
  email,
  emailVerified,
  hasPasswordProvider,
  role,
  profile,
  emailSignature,
  villesOptions,
  manualBadges,
  achievementSummary,
  contractsCount,
  totalPayoutMad,
  prospectsCount,
  onSaveProfile,
  onExportBackup,
  onSignOut,
  onJumpToBadges,
  onJumpToAdminSection,
  onTestBadgeAlert,
  onNotify,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile.avatarDataUrl);
  const [phonePro, setPhonePro] = useState(profile.phonePro);
  const [zone, setZone] = useState(profile.zone);
  const [bio, setBio] = useState(profile.bio);
  const [signature, setSignature] = useState(emailSignature);
  const [monthlyGoalContracts, setMonthlyGoalContracts] = useState(profile.monthlyGoalContracts);
  const [notifyBadges, setNotifyBadges] = useState(profile.notifyBadges);
  const [notifySound, setNotifySound] = useState(profile.notifySound);
  const [compactUi, setCompactUi] = useState(profile.compactUi);
  const [advPrefs, setAdvPrefs] = useState<AdvancedAccountPreferences>(() =>
    loadAdvancedAccountPrefs(uid)
  );

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>(() => getPushNotificationStatus());

  // Sécurité / Mot de passe
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initials = getUserInitials(displayName || profile.displayName, email);

  const awardedBadgeObjects = ADMIN_DISTINCTION_BADGES.filter((b) => manualBadges.includes(b.id));
  const goalPct = Math.min(100, Math.round((contractsCount / Math.max(1, monthlyGoalContracts)) * 100));

  const handlePhotoFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressed = await resizeAvatarImageFile(file);
      setAvatarDataUrl(compressed);
      onSaveProfile(
        {
          displayName: displayName.trim() || profile.displayName,
          avatarDataUrl: compressed,
          phonePro: phonePro.trim(),
          zone: zone.trim(),
          bio: bio.trim(),
          monthlyGoalContracts,
          notifyBadges,
          notifySound,
          compactUi,
        },
        signature
      );
      onNotify('Photo de profil mise à jour et synchronisée dans le Cloud.');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Impossible de traiter cette photo.',
        'err'
      );
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setAvatarDataUrl('');
    onSaveProfile(
      {
        displayName: displayName.trim() || profile.displayName,
        avatarDataUrl: '',
        phonePro: phonePro.trim(),
        zone: zone.trim(),
        bio: bio.trim(),
        monthlyGoalContracts,
        notifyBadges,
        notifySound,
        compactUi,
      },
      signature
    );
    onNotify('Photo de profil retirée.');
  };

  const persistAdvancedPrefs = (nextPrefs: AdvancedAccountPreferences) => {
    setAdvPrefs(nextPrefs);
    try {
      window.localStorage.setItem(`op_advanced_account_prefs_${uid}`, JSON.stringify(nextPrefs));
    } catch {
      // Ignore quota
    }
  };

  const handleResetAdvancedPrefs = () => {
    persistAdvancedPrefs(DEFAULT_ADVANCED_PREFS);
    onNotify('Paramètres avancés du compte réinitialisés aux valeurs recommandées DIVERSIFIA.');
  };

  const handleSaveProfileForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      onNotify('Veuillez saisir un nom complet (au moins 2 caractères).', 'warn');
      return;
    }
    setSavingProfile(true);
    try {
      await updateOwnAuthDisplayName(cleanName);
    } catch {
      // Non-fatal; profile is still saved to Firestore workspace & team_stats
    } finally {
      persistAdvancedPrefs(advPrefs);
      onSaveProfile(
        {
          displayName: cleanName,
          avatarDataUrl,
          phonePro: phonePro.trim(),
          zone: zone.trim(),
          bio: bio.trim(),
          monthlyGoalContracts: Math.min(200, Math.max(1, Math.round(monthlyGoalContracts || 5))),
          notifyBadges,
          notifySound,
          compactUi,
        },
        signature
      );
      setSavingProfile(false);
      onNotify('Tous les paramètres du compte et préférences avancées ont été enregistrés.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      onNotify('Le mot de passe doit contenir au moins 8 caractères.', 'warn');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify('Les deux mots de passe ne correspondent pas.', 'warn');
      return;
    }
    setPwdBusy(true);
    try {
      await setOrLinkAccountPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onNotify('Mot de passe mis à jour avec succès.');
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      onNotify(formatted.message, 'err');
    } finally {
      setPwdBusy(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!email) return;
    setResetBusy(true);
    try {
      await requestPasswordReset(email);
      onNotify(`Lien de réinitialisation envoyé à ${email}.`);
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      onNotify(formatted.message, 'err');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <section data-testid="account-settings-panel" className="space-y-5">
      {/* Carte Profil Héro avec Photo, Rôle, Badges et Déconnexion */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar avec upload 1-clic */}
            <div className="relative group w-20 h-20 shrink-0">
              {avatarDataUrl ? (
                <img
                  src={avatarDataUrl}
                  alt={displayName || 'Avatar'}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-orange-200 shadow-xs"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-xs">
                  {initials}
                </div>
              )}
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Télécharger une photo de profil"
                title="Changer ma photo de profil"
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-stone-900 hover:bg-orange-600 text-white flex items-center justify-center shadow-md border-2 border-white transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => void handlePhotoFile(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-stone-900">
                  {displayName || profile.displayName || 'Mon Compte'}
                </h2>
                <RoleBadge role={role} size="sm" />
                {emailVerified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Email vérifié
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600">
                <span className="inline-flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  {email}
                </span>
                {zone && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    {zone}
                  </span>
                )}
                <span className="font-mono text-[11px] text-stone-400">ID: {uid.slice(0, 10)}…</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-[11px] font-semibold text-stone-800 inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-orange-600" />
                  {uploadingPhoto ? 'Compression...' : 'Télécharger une photo'}
                </button>
                {avatarDataUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-semibold text-red-700 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportBackup}
              className="px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-800 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              Sauvegarde JSON
            </button>
            <button
              type="button"
              onClick={onSignOut}
              data-testid="account-signout-btn"
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </div>
        </div>

        {/* Résumé Performance & Badges de Rôles attribués */}
        <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Rang &amp; XP
            </div>
            <div className="mt-1 text-sm font-extrabold text-stone-900">
              Rang {achievementSummary.rankNumber} · {achievementSummary.totalXp.toLocaleString('fr-FR')} XP
            </div>
            <div className="text-[11px] text-stone-500">{achievementSummary.rankTitle}</div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-violet-600" />
              Succès débloqués
            </div>
            <div className="mt-1 text-sm font-extrabold text-stone-900 tabular-nums">
              {achievementSummary.unlockedCount}/{achievementSummary.totalCount} ({achievementSummary.completionPct}%)
            </div>
            <button
              type="button"
              onClick={onJumpToBadges}
              className="text-[11px] font-semibold text-orange-700 hover:underline"
            >
              Voir mes badges →
            </button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
            <div className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              Contrats &amp; Payout
            </div>
            <div className="mt-1 text-sm font-extrabold text-emerald-800 tabular-nums">
              {formatMad(totalPayoutMad)}
            </div>
            <div className="text-[11px] text-stone-500 tabular-nums">
              {contractsCount} contrat{contractsCount > 1 ? 's' : ''} · {prospectsCount} prospects
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3">
            <div className="text-[10px] font-bold uppercase text-orange-800 flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Objectif Mensuel
              </span>
              <span className="tabular-nums">{goalPct}%</span>
            </div>
            <div className="mt-1 text-sm font-extrabold text-stone-900 tabular-nums">
              {contractsCount} / {monthlyGoalContracts} contrats
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-orange-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-600 transition-all"
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </div>
        </div>

        {awardedBadgeObjects.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-stone-600">Badges attribués :</span>
            {awardedBadgeObjects.map((b) => (
              <BadgeChipWithDrawing key={b.id} badgeId={b.id} size="xs" showXp />
            ))}
          </div>
        )}
      </div>

      {/* Grille 2 colonnes : Informations Profil & Préférences / Sécurité */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Formulaire Profil & Préférences */}
        <form
          onSubmit={handleSaveProfileForm}
          className="lg:col-span-7 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-orange-600" />
              Informations du Profil &amp; Préférences
            </h3>
            <span className="text-[11px] text-stone-500">Synchronisé Cloud Firestore</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="acc-name" className="block text-xs font-semibold text-stone-700">
                Nom affiché
              </label>
              <input
                id="acc-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                placeholder="Votre nom complet"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="acc-phone" className="block text-xs font-semibold text-stone-700">
                Téléphone professionnel
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="acc-phone"
                  type="tel"
                  value={phonePro}
                  onChange={(e) => setPhonePro(e.target.value)}
                  maxLength={30}
                  placeholder="06 XX XX XX XX"
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="acc-zone" className="block text-xs font-semibold text-stone-700">
                Zone / Ville principale
              </label>
              <input
                id="acc-zone"
                type="text"
                list="account-zone-list"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                maxLength={100}
                placeholder="Meknès"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
              <datalist id="account-zone-list">
                {villesOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label htmlFor="acc-goal" className="block text-xs font-semibold text-stone-700">
                Objectif contrats / mois
              </label>
              <input
                id="acc-goal"
                type="number"
                min={1}
                max={200}
                value={monthlyGoalContracts}
                onChange={(e) => setMonthlyGoalContracts(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-bold tabular-nums focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="acc-bio" className="block text-xs font-semibold text-stone-700">
              Présentation / Spécialité B2B
            </label>
            <input
              id="acc-bio"
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={240}
              placeholder="Ex. Conseiller Orange Pro Fibre Dédiée & Flottes PME — Meknès & Ifrane"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="acc-sig" className="block text-xs font-semibold text-stone-700">
              Signature Email Studio IA
            </label>
            <textarea
              id="acc-sig"
              rows={3}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              maxLength={400}
              placeholder="Votre signature utilisée dans les emails générés..."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
            />
          </div>

          {/* Préférences Notifications & Affichage */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
            <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-orange-600" />
              Notifications &amp; Confort d’utilisation
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer text-xs text-stone-700">
              <span className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-orange-600" />
                Alertes en direct lors d’un succès débloqué ou d’un badge attribué
              </span>
              <input
                type="checkbox"
                checked={notifyBadges}
                onChange={(e) => setNotifyBadges(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
            </label>

            <div className="flex items-center justify-between gap-3 text-xs text-stone-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <Volume2 className="w-3.5 h-3.5 text-orange-600" />
                Son de célébration sur déblocage de badge
                <input
                  type="checkbox"
                  checked={notifySound}
                  onChange={(e) => setNotifySound(e.target.checked)}
                  className="ml-2 h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
              </label>
              <button
                type="button"
                onClick={() => playCelebrationChime()}
                className="text-[11px] font-semibold text-orange-700 hover:underline shrink-0"
              >
                Tester le son
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/80 text-xs text-stone-700">
              <span className="text-[11px] text-stone-600">
                Push navigateur :{' '}
                <strong className={pushStatus === 'granted' ? 'text-emerald-700' : 'text-stone-800'}>
                  {pushStatus === 'granted'
                    ? 'Activées'
                    : pushStatus === 'denied'
                      ? 'Bloquées par le navigateur'
                      : pushStatus === 'unsupported'
                        ? 'Non supportées'
                        : 'En attente'}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                {pushStatus === 'default' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = await requestPushNotificationPermission();
                      setPushStatus(next);
                      if (next === 'granted') {
                        onNotify('Notifications push activées pour vos badges et succès.', 'ok');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-[11px] font-semibold text-orange-800"
                  >
                    Activer les notifications push
                  </button>
                )}
                {onTestBadgeAlert && (
                  <button
                    type="button"
                    onClick={onTestBadgeAlert}
                    className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-800"
                  >
                    Tester l’alerte badge
                  </button>
                )}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer text-xs text-stone-700">
              <span>Mode d’affichage compact pour grands portefeuilles</span>
              <input
                type="checkbox"
                checked={compactUi}
                onChange={(e) => setCompactUi(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
            </label>
          </div>

          {/* Centre Complet de Paramètres Avancés du Compte (Prospection, Studio IA, Export & Horaires) */}
          <div
            data-testid="advanced-account-settings-suite"
            className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-orange-600" />
                  Suite Complète des Paramètres Avancés du Compte (Prospection, IA &amp; Gouvernance)
                </div>
                <p className="text-[11px] text-stone-500">
                  Personnalisez vos seuils commerciaux, votre Studio Email IA, vos formats d’export et vos horaires terrain.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetAdvancedPrefs}
                className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-[11px] font-semibold text-stone-700"
              >
                Valeurs recommandées
              </button>
            </div>

            {/* 1. Paramètres Commerciaux & Prospection Terrain */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="adv-payout-goal" className="block text-[11px] font-semibold text-stone-700">
                  Objectif Payout mensuel (MAD)
                </label>
                <input
                  id="adv-payout-goal"
                  type="number"
                  min={1000}
                  max={500000}
                  step={500}
                  value={advPrefs.monthlyGoalPayoutMad}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      monthlyGoalPayoutMad: Math.max(500, Number(e.target.value) || 15000),
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold tabular-nums focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-channel" className="block text-[11px] font-semibold text-stone-700">
                  Canal de contact prioritaire
                </label>
                <select
                  id="adv-channel"
                  value={advPrefs.preferredContactChannel}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      preferredContactChannel: e.target.value as AdvancedAccountPreferences['preferredContactChannel'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value="whatsapp">WhatsApp Business (+212)</option>
                  <option value="phone">Appel téléphonique direct</option>
                  <option value="email">Studio Email IA B2B</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-prefix" className="block text-[11px] font-semibold text-stone-700">
                  Préfixe numérotation fiches
                </label>
                <select
                  id="adv-prefix"
                  value={advPrefs.ficheNumberPrefix}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      ficheNumberPrefix: e.target.value as AdvancedAccountPreferences['ficheNumberPrefix'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-mono font-bold text-stone-800"
                >
                  <option value="DIV-">DIV- (DIVERSIFIA Officiel)</option>
                  <option value="OP-">OP- (Orange Pro)</option>
                  <option value="B2B-">B2B- (Entreprise)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-followup" className="block text-[11px] font-semibold text-stone-700">
                  Délai d’alerte relance prospect
                </label>
                <select
                  id="adv-followup"
                  value={advPrefs.followUpAlertDelay}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      followUpAlertDelay: e.target.value as AdvancedAccountPreferences['followUpAlertDelay'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value="24h">Relance intensive (24h)</option>
                  <option value="48h">Standard B2B (48h)</option>
                  <option value="72h">Cycle Grand Compte (72h)</option>
                  <option value="7d">Suivi hebdomadaire (7 jours)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-maturity" className="block text-[11px] font-semibold text-stone-700">
                  Seuil de maturité fiche cible
                </label>
                <select
                  id="adv-maturity"
                  value={advPrefs.targetMaturityPct}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      targetMaturityPct: Number(e.target.value) as AdvancedAccountPreferences['targetMaturityPct'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value={75}>75% (Qualification rapide)</option>
                  <option value={85}>85% (Standard DIVERSIFIA)</option>
                  <option value={95}>95% (Audit Grand Compte complet)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-schedule" className="block text-[11px] font-semibold text-stone-700">
                  Cadence &amp; Horaires de travail
                </label>
                <select
                  id="adv-schedule"
                  value={advPrefs.workHoursSchedule}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      workHoursSchedule: e.target.value as AdvancedAccountPreferences['workHoursSchedule'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value="standard_maroc">Lun–Ven 08h30–18h30 · Sam 09h–13h</option>
                  <option value="continu_08_20">Continu 08h00–20h00 (6j/7)</option>
                  <option value="terrain_etendu">Terrain étendu &amp; RDV Grands Comptes</option>
                </select>
              </div>
            </div>

            {/* 2. Paramètres Studio Email IA, Moteur Multi-LLM & Export CSV */}
            <div className="pt-3 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label htmlFor="adv-email-tone" className="block text-[11px] font-semibold text-stone-700">
                  Ton Studio Email IA par défaut
                </label>
                <select
                  id="adv-email-tone"
                  value={advPrefs.defaultEmailTone}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      defaultEmailTone: e.target.value as AdvancedAccountPreferences['defaultEmailTone'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value="terrain">Direct terrain (PME / TPE)</option>
                  <option value="executif">Exécutif Direction / Grand Compte</option>
                  <option value="court">Relance éclair (4 lignes)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-ai-provider" className="block text-[11px] font-semibold text-stone-700">
                  Moteur IA prioritaire
                </label>
                <select
                  id="adv-ai-provider"
                  value={advPrefs.preferredAiProvider}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      preferredAiProvider: e.target.value as AdvancedAccountPreferences['preferredAiProvider'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value="auto">Routeur Auto (Mistral → Groq → Gemini)</option>
                  <option value="mistral">Mistral AI Prioritaire</option>
                  <option value="groq">Groq Llama 3.3 Ultra-Rapide</option>
                  <option value="gemini">Google Gemini 2.5 Flash</option>
                  <option value="openrouter">OpenRouter Multi-Modèles</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-csv-delim" className="block text-[11px] font-semibold text-stone-700">
                  Format d’export CSV
                </label>
                <select
                  id="adv-csv-delim"
                  value={advPrefs.csvDelimiter}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      csvDelimiter: e.target.value as AdvancedAccountPreferences['csvDelimiter'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value=";">Excel Maroc / FR (Point-virgule ; UTF-8 BOM)</option>
                  <option value=",">Standard International (Virgule ,)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="adv-autosave" className="block text-[11px] font-semibold text-stone-700">
                  Cadence Sync Cloud Firestore
                </label>
                <select
                  id="adv-autosave"
                  value={advPrefs.autoSaveIntervalSec}
                  onChange={(e) =>
                    persistAdvancedPrefs({
                      ...advPrefs,
                      autoSaveIntervalSec: Number(e.target.value) as AdvancedAccountPreferences['autoSaveIntervalSec'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800"
                >
                  <option value={15}>Temps réel rapide (15 sec)</option>
                  <option value={30}>Équilibré (30 sec)</option>
                  <option value={60}>Économie bande passante (60 sec)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer text-xs text-stone-700 pt-1">
              <span>Insérer automatiquement mon numéro professionnel ({phonePro || '06...'}) au bas des emails IA</span>
              <input
                type="checkbox"
                checked={advPrefs.autoAppendPhoneInEmail}
                onChange={(e) =>
                  persistAdvancedPrefs({
                    ...advPrefs,
                    autoAppendPhoneInEmail: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {savingProfile ? 'Enregistrement...' : 'Enregistrer mes paramètres'}
          </button>
        </form>

        {/* Colonne Sécurité, Mot de passe, Raccourcis Super-Admin & Session */}
        <div className="lg:col-span-5 space-y-4">
          {role === 'super_admin' && onJumpToAdminSection && (
            <div
              data-testid="superadmin-quick-console-card"
              className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  Console Direction &amp; Accès Super-Admin
                </h3>
                <span className="text-[11px] font-bold text-orange-800">Contrôle Total</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">
                Accédez en 1 clic au Radar Dispatch GPS temps réel (invisible pour les collaborateurs), à la délégation d’accès Superviseur Élite et au Coffre Cloud de clés API.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  data-testid="jump-radar-dispatch-btn"
                  onClick={() => onJumpToAdminSection('attendance')}
                  className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold flex items-center justify-between"
                >
                  <span>Radar Dispatch GPS &amp; Suivi Temps Réel</span>
                  <span className="text-orange-400">Ouvrir →</span>
                </button>
                <button
                  type="button"
                  data-testid="jump-users-access-btn"
                  onClick={() => onJumpToAdminSection('users')}
                  className="w-full py-2 px-3 rounded-xl border border-orange-300 bg-white hover:bg-orange-100/60 text-stone-900 text-xs font-bold flex items-center justify-between"
                >
                  <span>Gérer Comptes &amp; Accès Superviseur Élite</span>
                  <span className="text-orange-700">Gérer →</span>
                </button>
                <button
                  type="button"
                  data-testid="jump-api-vault-btn"
                  onClick={() => onJumpToAdminSection('vault')}
                  className="w-full py-2 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center justify-between"
                >
                  <span>Coffre Clés API Cloud (/api_keys)</span>
                  <span className="text-stone-500">Configurer →</span>
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs space-y-3.5">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              Sécurité &amp; Mot de passe
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              {hasPasswordProvider
                ? 'Modifiez votre mot de passe de connexion ou demandez un lien de réinitialisation sécurisé par email.'
                : 'Définissez un mot de passe lié à votre email pour vous connecter sur n’importe quel appareil sans pop-up Google.'}
            </p>

            <form onSubmit={handleChangePassword} className="space-y-2.5">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe (min. 8 caractères)"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le nouveau mot de passe"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-orange-600"
              />
              <button
                type="submit"
                disabled={pwdBusy || newPassword.length < 8}
                className="w-full py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {pwdBusy
                  ? 'Mise à jour...'
                  : hasPasswordProvider
                    ? 'Mettre à jour mon mot de passe'
                    : 'Activer mon mot de passe'}
              </button>
            </form>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-stone-500">Mot de passe oublié ?</span>
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void handleSendResetEmail()}
                className="text-xs font-semibold text-orange-700 hover:underline disabled:opacity-50"
              >
                {resetBusy ? 'Envoi...' : 'Recevoir un lien par email'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 space-y-2 text-xs text-stone-600">
            <div className="font-bold text-stone-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Confidentialité &amp; Cloisonnement du Compte
            </div>
            <p className="text-[11px] leading-relaxed">
              Votre portefeuille prospects est isolé par votre identifiant unique Cloud.
              {role === 'super_admin'
                ? ' En tant que Super-Admin, vous disposez du contrôle complet sur les comptes utilisateurs, le coffre de clés API et la validation des payouts.'
                : ' Les contrats signés restent visibles dans votre tableau de payouts (produit & commission MAD), tandis que les coordonnées clients sont verrouillées après signature.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
