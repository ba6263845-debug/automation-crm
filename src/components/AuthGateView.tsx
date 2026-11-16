import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Lock,
  LogIn,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import { CREATOR_SUPPORT } from '../data/supportInfo';
import type { AuthSessionUser, Language, ThemeMode } from '../types/crm';

interface AuthGateViewProps {
  lang: Language;
  theme: ThemeMode;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onBackToWebsite: () => void;
  onGoogleSignIn: () => Promise<void>;
  onSessionAuthenticated: (session: AuthSessionUser) => void;
}

type AuthMode = 'customer-login' | 'customer-signup' | 'admin-login';

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
  onBackToWebsite,
  onGoogleSignIn,
  onSessionAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>('customer-login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMsg(null);
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : lang === 'bn'
            ? 'Google সাইন ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।'
            : 'Google Sign-In failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const endpoint = mode === 'customer-signup' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'customer-signup'
          ? { email, password, displayName, businessName }
          : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (lang === 'bn' ? 'সাইন ইন ব্যর্থ হয়েছে।' : 'Authentication failed.'));
        return;
      }
      onSessionAuthenticated(data as AuthSessionUser);
    } catch {
      setErrorMsg(lang === 'bn' ? 'সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।' : 'Unable to reach auth server.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          lang === 'bn'
            ? 'শুধুমাত্র অনুমোদিত এডমিন লগইন করতে পারবেন। সঠিক তথ্য দিন।'
            : data.error || 'Restricted: Invalid administrator credentials.'
        );
        return;
      }
      onSessionAuthenticated(data as AuthSessionUser);
    } catch {
      setErrorMsg(lang === 'bn' ? 'এডমিন ভেরিফিকেশন ব্যর্থ হয়েছে।' : 'Admin verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Single Corner Header Controls */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{lang === 'bn' ? 'ওয়েবসাইটে ফিরে যান' : 'Back to Website'}</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleLang}
              aria-label={lang === 'bn' ? 'Switch language to English' : 'ভাষা বাংলা করুন'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Automation CRM
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {mode === 'admin-login'
                ? lang === 'bn'
                  ? 'এডমিনিস্ট্রেটর পোর্টাল'
                  : 'Administrator Sign In'
                : mode === 'customer-signup'
                  ? lang === 'bn'
                    ? 'নতুন বিজনেস অ্যাকাউন্ট তৈরি'
                    : 'Create Business Account'
                  : lang === 'bn'
                    ? 'ওয়ার্কস্পেসে সাইন ইন করুন'
                    : 'Sign In to Workspace'}
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'admin-login'
                ? lang === 'bn'
                  ? 'শুধুমাত্র অনুমোদিত সিস্টেম এডমিনের জন্য সংরক্ষিত।'
                  : 'Restricted access for authorized administrators only.'
                : lang === 'bn'
                  ? 'ড্যাশবোর্ড, অর্ডার শিট ও অটো-রিপ্লাই চালু করতে লগইন করুন।'
                  : 'Authenticate before entering your orders sheet, inbox, and QR studio.'}
            </p>
          </div>

          {mode !== 'admin-login' ? (
            <>
              {/* Customer Sign In / Sign Up Switch */}
              <div className="mt-6 flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('customer-login')}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
                    mode === 'customer-login'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'bn' ? 'লগইন (Sign In)' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('customer-signup')}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
                    mode === 'customer-signup'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lang === 'bn' ? 'সাইন আপ (Sign Up)' : 'Sign Up'}
                </button>
              </div>

              {/* Google Sign-In Button */}
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors"
              >
                <LogIn className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <span>{lang === 'bn' ? 'Google দিয়ে সাইন ইন করুন' : 'Continue with Google'}</span>
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] font-medium text-slate-400">
                  {lang === 'bn' ? 'অথবা ইমেইল দিয়ে' : 'OR WITH EMAIL'}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <form onSubmit={handleCustomerSubmit} className="space-y-3.5">
                {mode === 'customer-signup' && (
                  <>
                    <div>
                      <label
                        htmlFor="auth-display-name"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        {lang === 'bn' ? 'আপনার নাম' : 'Your Full Name'}
                      </label>
                      <input
                        id="auth-display-name"
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={lang === 'bn' ? 'যেমন: আরিফ মাহমুদ' : 'e.g. Arif Mahmud'}
                        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="auth-biz-name"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        {lang === 'bn' ? 'প্রতিষ্ঠানের নাম (ঐচ্ছিক)' : 'Business Name (Optional)'}
                      </label>
                      <input
                        id="auth-biz-name"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Dhaka Horizon Commerce"
                        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {errorMsg && (
                  <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {mode === 'customer-signup' ? (
                    <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {loading
                      ? lang === 'bn'
                        ? 'অপেক্ষা করুন...'
                        : 'Processing...'
                      : mode === 'customer-signup'
                        ? lang === 'bn'
                          ? 'অ্যাকাউন্ট তৈরি ও প্রবেশ করুন'
                          : 'Create Account & Enter'
                        : lang === 'bn'
                          ? 'লগইন করুন'
                          : 'Sign In'}
                  </span>
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleAdminSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-username"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {lang === 'bn' ? 'এডমিন ইউজারনেম' : 'Admin Username'}
                </label>
                <input
                  id="admin-username"
                  type="text"
                  required
                  autoComplete="username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {lang === 'bn' ? 'এডমিন পাসওয়ার্ড' : 'Admin Password'}
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {errorMsg && (
                <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {loading
                    ? lang === 'bn'
                      ? 'যাচাই হচ্ছে...'
                      : 'Verifying...'
                    : lang === 'bn'
                      ? 'এডমিন লগইন'
                      : 'Sign In as Admin'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('customer-login')}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {lang === 'bn' ? '← কাস্টমার লগইনে ফিরে যান' : '← Return to Customer Sign In'}
              </button>
            </form>
          )}

          {/* Discreet Admin Access Trigger + Support Info */}
          <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <a
              href={CREATOR_SUPPORT.supportPhoneHref}
              className="inline-flex items-center gap-1 font-mono hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <Phone className="w-3 h-3" aria-hidden="true" />
              <span>
                {lang === 'bn' ? 'সাপোর্ট:' : 'Support:'} {CREATOR_SUPPORT.supportPhone}
              </span>
            </a>

            {mode !== 'admin-login' && (
              <button
                type="button"
                onClick={() => switchMode('admin-login')}
                className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Lock className="w-3 h-3" aria-hidden="true" />
                <span>{lang === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Access'}</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
