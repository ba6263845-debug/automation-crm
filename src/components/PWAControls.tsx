import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import type { Language } from '../types/crm';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: !!deferredPrompt, isInstalled, isIOS, install };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC<{ lang: Language; variant?: 'compact' | 'full' }> = ({
  lang,
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install PWA'}
        className={
          variant === 'full'
            ? 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={variant === 'compact' ? 'hidden sm:inline' : ''}>
          {lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install PWA'}
        </span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <h3 id="pwa-guide-title" className="text-base font-semibold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'ডিভাইসে ওয়েব অ্যাপ ইনস্টল করুন' : 'Install Automation CRM App'}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close install guide"
                onClick={() => setShowGuide(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isIOS
                ? lang === 'bn'
                  ? '১. Safari ব্রাউজারের নিচে Share বাটনে ট্যাপ করুন।\n২. "Add to Home Screen" নির্বাচন করুন।'
                  : '1. Tap the Share button in Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".'
                : lang === 'bn'
                  ? 'আপনার ব্রাউজারের অ্যাড্রেস বারের ডানদিকে Install আইকনে ক্লিক করুন অথবা মেনু থেকে "Install Automation CRM" বেছে নিন।'
                  : 'Click the Install icon in your browser address bar, or open the browser menu and select "Install Automation CRM".'}
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-600/30 bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {lang === 'bn'
          ? 'অফলাইন মোড — লোকাল ক্যাশড ডাটা ব্যবহৃত হচ্ছে'
          : 'Offline Mode — Cached workspace data is active'}
      </span>
    </div>
  );
};
