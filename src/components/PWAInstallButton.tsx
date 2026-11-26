import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Laptop,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'sidebar-compact' | 'login';
  onInstalledNotify?: (msg: string) => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onInstalledNotify,
}) => {
  const { isNativeInstallReady, isInstalled, platform, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Never show install button when already running as an installed standalone PWA
  if (isInstalled) return null;

  const handleClick = async () => {
    if (isNativeInstallReady) {
      setInstalling(true);
      try {
        const outcome = await promptInstall();
        if (outcome === 'accepted') {
          onInstalledNotify?.('Application CRM DIVERSIFIA installée sur votre appareil !');
        } else if (outcome === 'unavailable') {
          setShowGuideModal(true);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const labelShort =
    platform === 'ios'
      ? 'Installer iOS'
      : platform === 'android'
        ? 'Installer App'
        : 'Installer';

  const labelFull =
    platform === 'ios'
      ? 'Installer sur iPhone / iPad'
      : platform === 'macos_safari'
        ? 'Installer sur Mac'
        : platform === 'android'
          ? 'Installer sur Android'
          : 'Installer l’application';

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={installing}
          data-testid="pwa-install-header-btn"
          title={labelFull}
          className="px-2 sm:px-2.5 py-1.5 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-900 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="hidden md:inline">{installing ? 'Installation...' : labelShort}</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={installing}
          data-testid="pwa-install-sidebar-btn"
          className="w-full rounded-xl border border-orange-500/35 bg-orange-500/12 hover:bg-orange-500/20 text-orange-300 px-2.5 py-2 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="truncate">{installing ? 'Installation...' : labelFull}</span>
        </button>
      )}

      {variant === 'sidebar-compact' && (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={installing}
          title={labelFull}
          aria-label={labelFull}
          className="p-1.5 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-stone-800 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {variant === 'login' && (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={installing}
          data-testid="pwa-install-login-btn"
          className="w-full py-2.5 px-3.5 rounded-xl border border-orange-200 bg-orange-50/90 hover:bg-orange-100 text-orange-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4 text-orange-600 shrink-0" />
          <span>{installing ? 'Installation en cours...' : `${labelFull} (Chrome, Android, Apple)`}</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/60 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-stone-200 shadow-2xl overflow-hidden text-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#161412] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 id="pwa-install-guide-title" className="text-sm font-extrabold">
                    Installer CRM DIVERSIFIA
                  </h3>
                  <p className="text-[11px] text-stone-300">
                    Accès rapide plein écran sur Android, Apple &amp; PC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fermer le guide d'installation"
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {isNativeInstallReady && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await promptInstall();
                    if (res === 'accepted') {
                      setShowGuideModal(false);
                      onInstalledNotify?.('Application CRM DIVERSIFIA installée !');
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Installer maintenant en 1 clic
                </button>
              )}

              {/* Apple iOS / iPadOS */}
              <div
                className={`rounded-xl border p-3.5 space-y-2 ${
                  platform === 'ios'
                    ? 'border-orange-300 bg-orange-50/70'
                    : 'border-stone-200 bg-stone-50/60'
                }`}
              >
                <div className="font-extrabold text-stone-900 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-orange-600" />
                  Apple iPhone / iPad (Safari)
                  {platform === 'ios' && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">
                      Votre appareil
                    </span>
                  )}
                </div>
                <ol className="space-y-1.5 text-stone-700 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-orange-700">1.</span>
                    <span>
                      Ouvrez cette page dans <strong>Safari</strong> puis touchez le bouton{' '}
                      <strong className="inline-flex items-center gap-0.5 text-stone-900">
                        <Share className="w-3 h-3 inline text-sky-600" /> Partager
                      </strong>{' '}
                      en bas (ou en haut sur iPad).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-orange-700">2.</span>
                    <span>
                      Faites défiler et choisissez{' '}
                      <strong className="inline-flex items-center gap-0.5 text-stone-900">
                        <PlusSquare className="w-3 h-3 inline text-stone-700" /> Sur l’écran d’accueil
                      </strong>
                      .
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-orange-700">3.</span>
                    <span>
                      Appuyez sur <strong>Ajouter</strong> en haut à droite.
                    </span>
                  </li>
                </ol>
              </div>

              {/* Android Chrome */}
              <div
                className={`rounded-xl border p-3.5 space-y-1.5 ${
                  platform === 'android'
                    ? 'border-orange-300 bg-orange-50/70'
                    : 'border-stone-200 bg-stone-50/60'
                }`}
              >
                <div className="font-extrabold text-stone-900 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  Android (Chrome / Edge / Samsung)
                  {platform === 'android' && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">
                      Votre appareil
                    </span>
                  )}
                </div>
                <p className="text-stone-700 leading-relaxed">
                  Appuyez sur le menu{' '}
                  <strong className="inline-flex items-center text-stone-900">
                    <MoreVertical className="w-3 h-3 inline" /> (3 points)
                  </strong>{' '}
                  en haut à droite de Chrome puis touchez{' '}
                  <strong>« Installer l’application »</strong> ou{' '}
                  <strong>« Ajouter à l’écran d’accueil »</strong>.
                </p>
              </div>

              {/* PC / Mac Desktop */}
              <div
                className={`rounded-xl border p-3.5 space-y-1.5 ${
                  platform === 'desktop_chromium' || platform === 'macos_safari'
                    ? 'border-orange-300 bg-orange-50/70'
                    : 'border-stone-200 bg-stone-50/60'
                }`}
              >
                <div className="font-extrabold text-stone-900 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                  PC Windows / Mac (Chrome, Edge, Safari)
                  {(platform === 'desktop_chromium' || platform === 'macos_safari') && (
                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">
                      Votre appareil
                    </span>
                  )}
                </div>
                <p className="text-stone-700 leading-relaxed">
                  <strong>Chrome / Edge :</strong> cliquez sur l’icône d’installation à droite de la barre
                  d’adresse (ou Menu <strong>⋮ → Cast, enregistrer et partager → Installer CRM DIVERSIFIA</strong>).
                  <br />
                  <strong>Safari macOS :</strong> cliquez sur <strong>Fichier → Ajouter au Dock</strong>.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-stone-500">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PWA prête hors-ligne &amp; temps réel
                </span>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold"
                >
                  Compris
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      data-testid="pwa-offline-banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[65] flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950 shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
      <span>Mode hors ligne — Les données CRM seront synchronisées dès le retour du réseau.</span>
    </div>
  );
};
