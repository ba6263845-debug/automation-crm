import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Bot,
  FileSpreadsheet,
  Globe,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Phone,
  QrCode,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import { t } from './data/i18n';
import { CREATOR_SUPPORT } from './data/supportInfo';
import {
  DEFAULT_BUSINESS_PROFILE,
  INITIAL_CONVERSATIONS,
  INITIAL_ORDERS,
  INITIAL_RULES,
} from './data/seedData';
import {
  auth,
  fetchUserOrdersFromFirestore,
  fetchUserRulesFromFirestore,
  loadUserPrivateInfo,
  removeOrderFromFirestore,
  removeRuleFromFirestore,
  saveOrderToFirestore,
  saveRuleToFirestore,
  signInWithGooglePopup,
  signOutFirebase,
  syncUserProfileToFirestore,
  testFirestoreConnection,
} from './lib/firebase';
import type {
  AppSurface,
  AuthSessionUser,
  AutomationRule,
  BusinessProfile,
  ChannelType,
  ConversationThread,
  Language,
  OrderRecord,
  ThemeMode,
  WorkspaceTab,
} from './types/crm';
import { calculateOrderTotal } from './utils/crmLogic';
import { AccountView } from './components/AccountView';
import { AdminLicenseView } from './components/AdminLicenseView';
import { AuthGateView } from './components/AuthGateView';
import { AutomationView } from './components/AutomationView';
import { InboxView } from './components/InboxView';
import { InvoiceStudioView } from './components/InvoiceStudioView';
import { OrdersView } from './components/OrdersView';
import { OverviewView } from './components/OverviewView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { WebsiteLanding } from './components/WebsiteLanding';

const STORAGE_KEYS = {
  lang: 'autocrm_lang_v1',
  theme: 'autocrm_theme_v1',
  orders: 'autocrm_orders_v1',
  rules: 'autocrm_rules_v1',
  chats: 'autocrm_chats_v1',
  biz: 'autocrm_biz_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => readStorage(STORAGE_KEYS.lang, 'bn'));
  const [theme, setTheme] = useState<ThemeMode>(() => readStorage(STORAGE_KEYS.theme, 'light'));
  const [surface, setSurface] = useState<AppSurface>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'app';
    }
    return 'website';
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [orders, setOrders] = useState<OrderRecord[]>(() =>
    readStorage(STORAGE_KEYS.orders, INITIAL_ORDERS)
  );
  const [rules, setRules] = useState<AutomationRule[]>(() =>
    readStorage(STORAGE_KEYS.rules, INITIAL_RULES)
  );
  const [conversations, setConversations] = useState<ConversationThread[]>(() =>
    readStorage(STORAGE_KEYS.chats, INITIAL_CONVERSATIONS)
  );
  const [business, setBusiness] = useState<BusinessProfile>(() =>
    readStorage(STORAGE_KEYS.biz, DEFAULT_BUSINESS_PROFILE)
  );
  const [selectedInvoiceOrderId, setSelectedInvoiceOrderId] = useState<string>(
    orders[0]?.id ?? 'ORD-2601'
  );

  // Firebase & Server Session state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<AuthSessionUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  // Sync theme to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEYS.lang, JSON.stringify(lang));
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rules, JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.biz, JSON.stringify(business));
  }, [business]);

  // Check server auth session on boot
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { authenticated: false, role: null }))
      .then((data: AuthSessionUser) => {
        if (data?.authenticated) {
          setSessionUser(data);
        }
      })
      .catch(() => {})
      .finally(() => setSessionChecked(true));
  }, []);

  // Test Firestore connection on boot and listen to Auth state
  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setSyncingCloud(true);
        try {
          const idToken = await user.getIdToken();
          const sessionRes = await fetch('/api/auth/firebase-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (sessionRes.ok) {
            const sessionData = (await sessionRes.json()) as AuthSessionUser;
            setSessionUser(sessionData);
          }

          const [priv, cloudOrders, cloudRules] = await Promise.all([
            loadUserPrivateInfo(user.uid),
            fetchUserOrdersFromFirestore(user.uid),
            fetchUserRulesFromFirestore(user.uid),
          ]);
          if (priv) {
            setBusiness((prev) => ({
              ...prev,
              email: priv.email || user.email || prev.email,
              phone: priv.phone || prev.phone,
              businessName: priv.businessName || prev.businessName,
              businessAddress: priv.businessAddress || prev.businessAddress,
            }));
          }
          if (cloudOrders.length > 0) setOrders(cloudOrders);
          if (cloudRules.length > 0) setRules(cloudRules);
        } catch (err) {
          console.error('Firestore hydration notice:', err);
        } finally {
          setSyncingCloud(false);
        }
      }
    });
    return () => unsub();
  }, []);

  const isAuthenticated = Boolean(sessionUser?.authenticated || firebaseUser);
  const isAdmin = sessionUser?.role === 'admin';

  const copy = t(lang);

  const handleLaunchApp = (tab: WorkspaceTab = 'overview') => {
    setActiveTab(tab);
    setSurface('app');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleAddOrder = (
    payload: Omit<OrderRecord, 'id' | 'uid' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const id = `ORD-${Math.floor(2600 + Math.random() * 7000)}`;
    const newOrder: OrderRecord = {
      ...payload,
      id,
      uid: firebaseUser?.uid || 'demo',
      createdAt: now,
      updatedAt: now,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedInvoiceOrderId(id);

    if (firebaseUser) {
      saveOrderToFirestore(firebaseUser.uid, newOrder, true).catch(console.error);
    }
  };

  const handleUpdateOrder = (updated: OrderRecord) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (firebaseUser) {
      saveOrderToFirestore(firebaseUser.uid, updated, false).catch(console.error);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (firebaseUser) {
      removeOrderFromFirestore(firebaseUser.uid, orderId).catch(console.error);
    }
  };

  const handleAddRule = (
    payload: Omit<AutomationRule, 'id' | 'uid' | 'hitCount' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const id = `rule-${Date.now()}`;
    const newRule: AutomationRule = {
      ...payload,
      id,
      uid: firebaseUser?.uid || 'demo',
      hitCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setRules((prev) => [newRule, ...prev]);
    if (firebaseUser) {
      saveRuleToFirestore(firebaseUser.uid, newRule, true).catch(console.error);
    }
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const next = { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() };
        if (firebaseUser) {
          saveRuleToFirestore(firebaseUser.uid, next, false).catch(console.error);
        }
        return next;
      })
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    if (firebaseUser) {
      removeRuleFromFirestore(firebaseUser.uid, ruleId).catch(console.error);
    }
  };

  const handleIncrementRuleHit = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, hitCount: r.hitCount + 1 } : r))
    );
  };

  const handleUpdateBusiness = async (next: BusinessProfile) => {
    setBusiness(next);
    if (firebaseUser) {
      setSyncingCloud(true);
      try {
        await syncUserProfileToFirestore(firebaseUser, next);
      } finally {
        setSyncingCloud(false);
      }
    }
  };

  const handleSignOutAll = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    if (firebaseUser) {
      await signOutFirebase().catch(() => {});
    }
    setSessionUser(null);
    setActiveTab('overview');
  };

  const handleGoogleLoginAndSync = async () => {
    const user = await signInWithGooglePopup();
    const idToken = await user.getIdToken();
    const sessionRes = await fetch('/api/auth/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (sessionRes.ok) {
      const sessionData = (await sessionRes.json()) as AuthSessionUser;
      setSessionUser(sessionData);
    }
    await syncUserProfileToFirestore(user, business).catch(() => {});
  };

  const handleQuickAddOrderFromDemo = (payload: {
    customerName: string;
    phone: string;
    channel: ChannelType;
    item: string;
    quantity: number;
  }) => {
    const unitPrice = 2450;
    const deliveryFee = 60;
    handleAddOrder({
      customerName: payload.customerName,
      phone: payload.phone,
      channel: payload.channel,
      item: payload.item,
      quantity: payload.quantity,
      unitPrice,
      deliveryFee,
      discount: 0,
      total: calculateOrderTotal(unitPrice, payload.quantity, deliveryFee, 0),
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      address: 'Dhaka',
      notes: 'Captured via Live Auto-Reply Simulator',
    });
  };

  const navItems: {
    id: WorkspaceTab;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: copy.tabOverview, Icon: LayoutDashboard },
    { id: 'inbox', label: copy.tabInbox, Icon: Inbox },
    { id: 'orders', label: copy.tabOrders, Icon: FileSpreadsheet },
    { id: 'invoices', label: copy.tabInvoices, Icon: QrCode },
    { id: 'automation', label: copy.tabAutomation, Icon: Bot },
    { id: 'account', label: copy.tabAccount, Icon: ShieldCheck },
    ...(isAdmin
      ? [{ id: 'admin-licenses' as WorkspaceTab, label: copy.tabAdminLicenses, Icon: KeyRound }]
      : []),
  ];

  const effectiveTab: WorkspaceTab =
    activeTab === 'admin-licenses' && !isAdmin ? 'overview' : activeTab;

  const activeNavItem = navItems.find((n) => n.id === effectiveTab) ?? navItems[0];

  if (surface === 'website') {
    return (
      <>
        <WebsiteLanding
          lang={lang}
          theme={theme}
          isAuthenticated={isAuthenticated}
          rules={rules}
          orderCount={orders.length}
          onToggleLang={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
          onToggleTheme={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))}
          onLaunchApp={handleLaunchApp}
          onQuickAddOrderFromDemo={handleQuickAddOrderFromDemo}
        />
        <OfflineIndicator lang={lang} />
      </>
    );
  }

  // Front Login & Sign-In Gate required before entering CRM Workspace
  if (!isAuthenticated) {
    if (!sessionChecked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-xs text-slate-500">
          {lang === 'bn' ? 'সেশন যাচাই হচ্ছে...' : 'Checking session...'}
        </div>
      );
    }

    return (
      <>
        <AuthGateView
          lang={lang}
          theme={theme}
          onToggleLang={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
          onToggleTheme={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))}
          onBackToWebsite={() => setSurface('website')}
          onGoogleSignIn={handleGoogleLoginAndSync}
          onSessionAuthenticated={(userSession) => {
            setSessionUser(userSession);
            if (userSession.businessName) {
              setBusiness((prev) => ({
                ...prev,
                displayName: userSession.displayName || prev.displayName,
                businessName: userSession.businessName || prev.businessName,
                email: userSession.email || prev.email,
              }));
            }
          }}
        />
        <OfflineIndicator lang={lang} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[260px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-slate-200 dark:lg:border-slate-800 lg:bg-white dark:lg:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={() => setSurface('website')}
            className="text-left text-base font-bold tracking-tight text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap"
          >
            {copy.brandName}
          </button>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 p-3">
          {navItems.map(({ id, label, Icon }) => {
            const active = effectiveTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 dark:text-white truncate">
              {business.businessName}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {sessionUser?.email || firebaseUser?.email || (firebaseUser ? 'Cloud Synced' : 'Verified Workspace')}
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-2.5 text-[11px] space-y-1">
            <p className="text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'ডেভেলপার:' : 'Developer:'}{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {lang === 'bn' ? CREATOR_SUPPORT.developerNameBn : CREATOR_SUPPORT.developerNameEn}
              </span>
            </p>
            <a
              href={CREATOR_SUPPORT.supportPhoneHref}
              className="inline-flex items-center gap-1.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline tabular-nums"
            >
              <Phone className="w-3 h-3" aria-hidden="true" />
              <span>
                {lang === 'bn' ? 'সাপোর্ট:' : 'Support:'} {CREATOR_SUPPORT.supportPhone}
              </span>
            </a>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSurface('website')}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {copy.backToWebsite}
            </button>
            <button
              type="button"
              onClick={handleSignOutAll}
              aria-label={copy.signOut}
              title={copy.signOut}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {copy.brandName}
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {navItems.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab(id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold ${
                    effectiveTab === id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="text-[11px] space-y-1">
                <p className="text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'ডেভেলপার:' : 'Developer:'}{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'bn' ? CREATOR_SUPPORT.developerNameBn : CREATOR_SUPPORT.developerNameEn}
                  </span>
                </p>
                <a
                  href={CREATOR_SUPPORT.supportPhoneHref}
                  className="inline-flex items-center gap-1.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums"
                >
                  <Phone className="w-3 h-3" aria-hidden="true" />
                  <span>{CREATOR_SUPPORT.supportPhone}</span>
                </a>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSurface('website');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {copy.backToWebsite}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignOutAll();
                  }}
                  aria-label={copy.signOut}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-rose-600"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Top Contextual Header */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 lg:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">{copy.brandName}</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {activeNavItem.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
              aria-label="Switch language"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((th) => (th === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <PWAInstallButton lang={lang} />
          </div>
        </header>

        {/* Admin-Only License Bar (Strictly hidden from all regular customers/creators) */}
        {isAdmin && (
          <div
            data-testid="admin-license-bar"
            className="no-print border-b border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/90 dark:bg-indigo-950/40 px-4 py-2.5 sm:px-6"
          >
            <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
                <span className="font-semibold">
                  {lang === 'bn'
                    ? 'এডমিন লাইসেন্স বার — শুধুমাত্র আপনিই নতুন লাইসেন্স কী তৈরি ও নিয়ন্ত্রণ করতে পারবেন'
                    : 'Admin License Bar — Exclusive License Creation & Control'}
                </span>
              </div>
              {effectiveTab !== 'admin-licenses' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin-licenses')}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
                >
                  {lang === 'bn' ? 'লাইসেন্স তৈরি করুন →' : 'Manage & Create Licenses →'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {effectiveTab === 'overview' && (
            <OverviewView
              lang={lang}
              businessName={business.businessName}
              orders={orders}
              conversations={conversations}
              rules={rules}
              onNavigateTab={setActiveTab}
              onSelectOrderForInvoice={(orderId) => {
                setSelectedInvoiceOrderId(orderId);
                setActiveTab('invoices');
              }}
              onUpdateOrder={handleUpdateOrder}
            />
          )}

          {effectiveTab === 'inbox' && (
            <InboxView
              lang={lang}
              businessName={business.businessName}
              conversations={conversations}
              rules={rules}
              onUpdateConversation={(updated) =>
                setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
              }
              onCreateOrderFromChat={(payload) => {
                handleAddOrder({
                  ...payload,
                  deliveryFee: 60,
                  discount: 0,
                  total: calculateOrderTotal(payload.unitPrice, payload.quantity, 60, 0),
                  status: 'CONFIRMED',
                  paymentStatus: 'UNPAID',
                  notes: 'Extracted via Inbox AI Studio',
                });
              }}
              onIncrementRuleHit={handleIncrementRuleHit}
            />
          )}

          {effectiveTab === 'orders' && (
            <OrdersView
              lang={lang}
              orders={orders}
              onAddOrder={handleAddOrder}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              onOpenInvoice={(orderId) => {
                setSelectedInvoiceOrderId(orderId);
                setActiveTab('invoices');
              }}
            />
          )}

          {effectiveTab === 'invoices' && (
            <InvoiceStudioView
              lang={lang}
              orders={orders}
              selectedOrderId={selectedInvoiceOrderId}
              business={business}
              onSelectOrder={setSelectedInvoiceOrderId}
              onUpdateOrder={handleUpdateOrder}
            />
          )}

          {effectiveTab === 'automation' && (
            <AutomationView
              lang={lang}
              rules={rules}
              onAddRule={handleAddRule}
              onToggleRule={handleToggleRule}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {effectiveTab === 'account' && (
            <AccountView
              lang={lang}
              firebaseUser={firebaseUser}
              sessionUser={sessionUser}
              firestoreConnected={firestoreConnected}
              business={business}
              syncingCloud={syncingCloud}
              onUpdateBusiness={handleUpdateBusiness}
              onGoogleSignIn={handleGoogleLoginAndSync}
              onSignOut={handleSignOutAll}
              onResetDemoWorkspace={() => {
                setOrders(INITIAL_ORDERS);
                setRules(INITIAL_RULES);
                setConversations(INITIAL_CONVERSATIONS);
                setBusiness(DEFAULT_BUSINESS_PROFILE);
              }}
            />
          )}

          {effectiveTab === 'admin-licenses' && isAdmin && (
            <AdminLicenseView
              lang={lang}
              adminEmail={sessionUser?.email || firebaseUser?.email || 'Admin'}
            />
          )}
        </main>
      </div>

      <OfflineIndicator lang={lang} />
    </div>
  );
}
