import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { Check, Cloud, Headphones, LogIn, LogOut, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { CREATOR_SUPPORT } from '../data/supportInfo';
import type { AuthSessionUser, BusinessProfile, Language } from '../types/crm';

interface AccountViewProps {
  lang: Language;
  firebaseUser: User | null;
  sessionUser: AuthSessionUser | null;
  firestoreConnected: boolean | null;
  business: BusinessProfile;
  syncingCloud: boolean;
  onUpdateBusiness: (next: BusinessProfile) => Promise<void> | void;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onResetDemoWorkspace: () => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  lang,
  firebaseUser,
  sessionUser,
  firestoreConnected,
  business,
  syncingCloud,
  onUpdateBusiness,
  onGoogleSignIn,
  onSignOut,
  onResetDemoWorkspace,
}) => {
  const [form, setForm] = useState<BusinessProfile>(business);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    await onUpdateBusiness(form);
    setSavedMsg(
      lang === 'bn'
        ? firebaseUser
          ? 'প্রোফাইল ও ব্যবসার তথ্য Firebase Firestore-এ সংরক্ষিত হয়েছে।'
          : 'প্রোফাইল লোকাল ওয়ার্কস্পেসে সংরক্ষিত হয়েছে।'
        : firebaseUser
          ? 'Business profile synced to Firebase Firestore.'
          : 'Business profile saved to workspace.'
    );
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
    }
  };

  const activeName =
    firebaseUser?.displayName || sessionUser?.displayName || form.displayName || 'Workspace Operator';
  const activeEmail = firebaseUser?.email || sessionUser?.email || form.email;
  const isSignedIn = Boolean(firebaseUser || sessionUser?.authenticated);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Cloud Auth & Sync Card */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'অ্যাকাউন্ট ও ক্লাউড সিঙ্ক' : 'Account & Cloud Sync'}
            </h2>
            <Cloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {lang === 'bn'
              ? 'Google দিয়ে সাইন ইন করলে আপনার সব অর্ডার, অটোমেশন রুলস এবং ব্যবসার প্রোফাইল Firestore ডাটাবেসে নিরাপদে সিঙ্ক থাকবে।'
              : 'Sign in with Google to persist your orders, automation rules, and private business profile inside Firestore.'}
          </p>

          {isSignedIn ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 text-xs">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200">{activeName}</p>
                {activeEmail && (
                  <p className="mt-0.5 font-mono text-emerald-800 dark:text-emerald-300">{activeEmail}</p>
                )}
              </div>
              {!firebaseUser && (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'Google ক্লাউড সিঙ্ক সংযুক্ত করুন' : 'Connect Google Cloud Sync'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{lang === 'bn' ? 'সাইন আউট করুন' : 'Sign Out'}</span>
              </button>
              {authError && <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{lang === 'bn' ? 'Google দিয়ে সাইন ইন করুন' : 'Sign in with Google'}</span>
              </button>
              {authError && <p className="text-xs text-rose-600 dark:text-rose-400">{authError}</p>}
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{lang === 'bn' ? 'ডাটাবেস সংযোগ:' : 'Firestore Link:'}</span>
            <span className="font-mono">
              {firestoreConnected === false
                ? 'Offline Fallback'
                : syncingCloud
                  ? 'Syncing...'
                  : 'Ready'}
            </span>
          </div>

          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={onResetDemoWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'bn' ? 'ডেমো ডাটা রিসেট করুন' : 'Reset Demo Workspace Data'}</span>
            </button>
          </div>
        </div>

        {/* Creator & Customer Support Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'ক্রিয়েটর ও কাস্টমার সাপোর্ট' : 'Developer & Customer Support'}
            </h3>
            <Headphones className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'ডেভেলপার' : 'Developer'}
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {lang === 'bn' ? CREATOR_SUPPORT.developerNameBn : CREATOR_SUPPORT.developerNameEn}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'হেল্পলাইন নম্বর' : 'Support Number'}
              </span>
              <a
                href={CREATOR_SUPPORT.supportPhoneHref}
                className="inline-flex items-center gap-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline tabular-nums"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{CREATOR_SUPPORT.supportPhone}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Business Profile Form */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'ব্যবসা ও ইনভয়েস প্রোফাইল' : 'Business & Invoice Letterhead Profile'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'এই তথ্যগুলো আপনার QR ইনভয়েস ও AI রিপ্লাইয়ের কনটেক্সটে ব্যবহৃত হয়।'
                : 'Used directly on commercial QR invoices and as context for Gemini AI replies.'}
            </p>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        </div>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prof-display" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'অপারেটরের নাম' : 'Operator Display Name'}
              </label>
              <input
                id="prof-display"
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="prof-biz" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Registered Business Name'}
              </label>
              <input
                id="prof-biz"
                type="text"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prof-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'ব্যবসায়িক ইমেইল' : 'Business Email'}
              </label>
              <input
                id="prof-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'হটলাইন / WhatsApp নম্বর' : 'Support / WhatsApp Phone'}
              </label>
              <input
                id="prof-phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prof-address" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {lang === 'bn' ? 'অফিস / স্টোরের ঠিকানা' : 'Store / Office Address'}
            </label>
            <input
              id="prof-address"
              type="text"
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {savedMsg && (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{savedMsg}</span>
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              {lang === 'bn' ? 'প্রোফাইল সেভ করুন' : 'Save Business Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
