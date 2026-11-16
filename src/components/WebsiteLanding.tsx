import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  FileSpreadsheet,
  Globe,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Moon,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { t } from '../data/i18n';
import { CREATOR_SUPPORT } from '../data/supportInfo';
import type { AutomationRule, ChannelType, Language, ThemeMode, WorkspaceTab } from '../types/crm';
import { extractQuickOrderFromText, matchAutomationRule } from '../utils/crmLogic';

interface WebsiteLandingProps {
  lang: Language;
  theme: ThemeMode;
  isAuthenticated: boolean;
  rules: AutomationRule[];
  orderCount: number;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLaunchApp: (initialTab?: WorkspaceTab) => void;
  onQuickAddOrderFromDemo: (payload: {
    customerName: string;
    phone: string;
    channel: ChannelType;
    item: string;
    quantity: number;
  }) => void;
}

export const WebsiteLanding: React.FC<WebsiteLandingProps> = ({
  lang,
  theme,
  isAuthenticated,
  rules,
  orderCount,
  onToggleLang,
  onToggleTheme,
  onLaunchApp,
  onQuickAddOrderFromDemo,
}) => {
  const copy = t(lang);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [studioImgFailed, setStudioImgFailed] = useState(false);

  // Interactive workflow simulator state
  const [simChannel, setSimChannel] = useState<ChannelType>('WHATSAPP');
  const [simMessage, setSimMessage] = useState(
    lang === 'bn'
      ? 'ভাই, Smart Watch Ultra ২ পিস অর্ডার করব। দাম কত ও ডেলিভারি চার্জ? 01711223344'
      : 'Hi, I want to order 2 pcs Smart Watch Ultra. What is the price & delivery charge? 01711223344'
  );
  const [simResult, setSimResult] = useState<{
    ruleName: string | null;
    reply: string;
    extracted: { item: string; quantity: number; phone: string } | null;
  } | null>(null);
  const [simOrderSaved, setSimOrderSaved] = useState(false);

  const runSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = matchAutomationRule(simMessage, simChannel, rules);
    const extracted = extractQuickOrderFromText(simMessage);
    setSimOrderSaved(false);
    setSimResult({
      ruleName: matched ? matched.name : null,
      reply: matched
        ? matched.replyTemplate
        : lang === 'bn'
          ? 'ধন্যবাদ! আমাদের সাপোর্ট টিম বা Gemini AI সহায়ক এখনই আপনার মেসেজের উত্তর প্রস্তুত করছে।'
          : 'Thank you for contacting us! Our support desk or Gemini AI assistant is drafting your reply.',
      extracted,
    });
  };

  const handleSaveDemoOrder = () => {
    if (!simResult?.extracted) return;
    onQuickAddOrderFromDemo({
      customerName: lang === 'bn' ? 'লাইভ ডেমো ক্রেতা' : 'Live Demo Buyer',
      phone: simResult.extracted.phone || '01700000000',
      channel: simChannel,
      item: simResult.extracted.item,
      quantity: simResult.extracted.quantity,
    });
    setSimOrderSaved(true);
  };

  const pricingTiers: {
    id: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
    name: string;
    audience: string;
    price: string;
    cadence: string;
    limits: string[];
  }[] = [
    {
      id: 'STARTER',
      name: 'Starter',
      audience: lang === 'bn' ? 'একক অনলাইন শপের জন্য' : 'For solo commerce sellers',
      price: '৳1,490',
      cadence: lang === 'bn' ? '/ মাস' : '/ month',
      limits: [
        lang === 'bn' ? '১টি WhatsApp + ১টি Messenger চ্যানেল' : '1 WhatsApp + 1 Messenger channel',
        lang === 'bn' ? 'মাসে ১,৫০০ অটো-রিপ্লাই ট্রিগার' : '1,500 auto-reply triggers / month',
        lang === 'bn' ? 'আনলিমিটেড Excel CSV ও QR ইনভয়েস' : 'Unlimited Excel CSV & QR invoices',
      ],
    },
    {
      id: 'GROWTH',
      name: 'Growth',
      audience: lang === 'bn' ? 'দ্রুত বর্ধনশীল ই-কমার্স টিমের জন্য' : 'For scaling operations teams',
      price: '৳3,490',
      cadence: lang === 'bn' ? '/ মাস' : '/ month',
      limits: [
        lang === 'bn' ? 'WhatsApp, Messenger ও Gmail ফুল সিঙ্ক' : 'Full WhatsApp, Messenger & Gmail sync',
        lang === 'bn' ? 'Gemini AI স্মার্ট রিপ্লাই ও অর্ডার এক্সট্র্যাকশন' : 'Gemini AI smart replies & order extraction',
        lang === 'bn' ? '১৫,০০০ অটোমেশন ইভেন্ট + ৫ টিম সিট' : '15,000 automation events + 5 team seats',
      ],
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      audience: lang === 'bn' ? 'বড় এজেন্সি ও কর্পোরেট ব্র্যান্ড' : 'For multi-brand & B2B teams',
      price: '৳8,900',
      cadence: lang === 'bn' ? '/ মাস' : '/ month',
      limits: [
        lang === 'bn' ? 'আনলিমিটেড চ্যানেল ও কাস্টম ওয়েবহুক' : 'Unlimited channels & custom webhooks',
        lang === 'bn' ? 'অগ্রাধিকার Gemini AI প্রসেসিং ও SLA' : 'Priority Gemini AI drafting & SLA',
        lang === 'bn' ? 'ডেডিকেটেড Firestore ক্লাউড রুলস ও অডিট' : 'Dedicated Firestore cloud sync & audit',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Strictly 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-6 px-4 sm:px-6 py-3.5 sm:py-4">
          <a
            href="#top"
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {copy.brandName}
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#capabilities"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navFeatures}
            </a>
            <a
              href="#workflow"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navWorkflow}
            </a>
            <a
              href="#pricing"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navPricing}
            </a>
            <button
              type="button"
              onClick={() => onLaunchApp('orders')}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navWebApp}
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleLang}
              aria-label={lang === 'bn' ? 'Switch language to English' : 'ভাষা বাংলা করুন'}
              title={lang === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
              title={theme === 'light' ? (lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode') : (lang === 'bn' ? 'লাইট মোড' : 'Light Mode')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 sm:p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" aria-hidden="true" /> : <Sun className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => onLaunchApp('overview')}
              className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-indigo-600 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">
                {isAuthenticated
                  ? lang === 'bn'
                    ? 'অ্যাপ'
                    : 'App'
                  : lang === 'bn'
                    ? 'লগইন'
                    : 'Sign In'}
              </span>
              <span className="hidden sm:inline">
                {isAuthenticated
                  ? lang === 'bn'
                    ? 'ওয়েব অ্যাপ'
                    : 'Dashboard'
                  : copy.openAppCta}
              </span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="top">
        <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <div>
                <p className="text-xs font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">
                  {copy.heroEyebrow}
                </p>
                <h1
                  style={{ textWrap: 'balance' }}
                  className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl leading-[1.15]"
                >
                  {copy.heroTitle}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {copy.heroSubtitle}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onLaunchApp('overview')}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>
                      {isAuthenticated
                        ? lang === 'bn'
                          ? 'CRM ড্যাশবোর্ড খুলুন'
                          : 'Open CRM Dashboard'
                        : copy.heroPrimaryAction}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <a
                    href="#workflow"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{copy.heroSecondaryAction}</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_crm_workspace_1794830071009.jpg"
                    alt="Automation CRM operations desk with laptop and smartphone"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover lg:h-full"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-8 text-center">
                    <Layers className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Automation CRM Operations Hub
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full-width 4-Column KPI / Proof Strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-y border-slate-200 dark:border-slate-800 py-6 lg:grid-cols-4">
            <div className="px-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.kpi1Label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {copy.kpi1Value}
              </p>
            </div>
            <div className="px-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.kpi2Label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {copy.kpi2Value}
              </p>
            </div>
            <div className="px-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.kpi3Label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {copy.kpi3Value}
              </p>
            </div>
            <div className="px-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.kpi4Label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {copy.kpi4Value}
              </p>
            </div>
          </div>
        </section>

        {/* Core Capabilities Asymmetric Bento Grid */}
        <section id="capabilities" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {copy.capSectionTitle}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                {copy.capSectionDesc}
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Featured Marquee Card (2 cols) */}
              <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 md:grid-cols-2 lg:col-span-2">
                <div className="flex flex-col justify-between p-8">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      <span>01. Unified Omnichannel Studio</span>
                    </div>
                    <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                      {lang === 'bn'
                        ? 'WhatsApp, Messenger ও Gmail ইনবক্স একসাথে'
                        : 'WhatsApp, Messenger & Gmail Unified in One Inbox'}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {lang === 'bn'
                        ? 'আলাদা অ্যাপ বা ট্যাব বদলানোর ঝামেলা ছাড়াই সব চ্যানেলের মেসেজ পড়ুন, অটো-রিপ্লাই রুলস সেট করুন এবং Gemini AI দিয়ে মুহূর্তেই প্রফেশনাল উত্তর তৈরি করুন।'
                        : 'Read and reply across every customer channel from one calm desk, automate repetitive price/delivery replies, and draft tailored responses with Gemini AI.'}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>WhatsApp Cloud</span>
                    <span aria-hidden="true">·</span>
                    <span>Meta Messenger</span>
                    <span aria-hidden="true">·</span>
                    <span>Gmail B2B</span>
                  </div>
                </div>
                <div className="min-h-[240px] bg-slate-200 dark:bg-slate-800">
                  {!studioImgFailed ? (
                    <img
                      src="/src/assets/images/feature_omnichannel_studio_1794830071491.jpg"
                      alt="Minimalist smartphone and studio hardware for customer messaging"
                      referrerPolicy="no-referrer"
                      onError={() => setStudioImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
                      Omnichannel Studio
                    </div>
                  )}
                </div>
              </div>

              {/* Capability 02: Gemini AI */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <Bot className="w-4 h-4" aria-hidden="true" />
                    <span>02. Gemini AI Automation</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'AI স্মার্ট রিপ্লাই ও অটো-অর্ডার এক্সট্র্যাকশন'
                      : 'AI Reply Drafting & Order Capture'}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'bn'
                      ? 'গ্রাহকের বাংলা বা ইংরেজি মেসেজ বিশ্লেষণ করে পণ্যের নাম, পরিমাণ ও ঠিকানা স্বয়ংক্রিয়ভাবে বের করে সরাসরি অর্ডার শিটে পাঠায়।'
                      : 'Analyzes Bengali or English customer threads to draft polite answers and extract structured item, quantity, and address fields straight into your orders sheet.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchApp('inbox')}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 self-start"
                >
                  <span>{lang === 'bn' ? 'AI ইনবক্স খুলুন' : 'Open AI Inbox'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Capability 03: Orders Excel Sheet */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                    <span>03. Orders Excel Sheet</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'লাইভ এক্সেল শিট ও UTF-8 CSV এক্সপোর্ট'
                      : 'Live Orders Grid & Excel CSV Export'}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'bn'
                      ? `বর্তমানে ${orderCount}টি নমুনা অর্ডার রেডি আছে। ইনলাইন এডিট, ডেলিভারি স্ট্যাটাস আপডেট এবং বাংলা টেক্সট-সহ নিখুঁত Excel CSV ডাউনলোড করুন।`
                      : `Manage ${orderCount} live orders with inline status updates, tabular-aligned pricing, delivery fees, and instant UTF-8 BOM Excel CSV exports.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchApp('orders')}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 self-start"
                >
                  <span>{lang === 'bn' ? 'অর্ডার শিট দেখুন' : 'Open Orders Sheet'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Capability 04: Commercial QR Invoice */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <QrCode className="w-4 h-4" aria-hidden="true" />
                    <span>04. Commercial QR Billing</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'ভেরিফায়েড QR কোড ইনভয়েস ও PDF প্রিন্ট'
                      : 'Scannable QR Invoices & PDF Print'}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'bn'
                      ? 'প্রতিটি অর্ডারের জন্য ১ ক্লিকে কোম্পানির লেটারহেড ও স্ক্যানযোগ্য QR কোড যুক্ত কমার্শিয়াল ইনভয়েস তৈরি ও প্রিন্ট করুন।'
                      : 'Generate print-ready commercial invoices with itemized totals and an authentic scannable QR verification payload in one click.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchApp('invoices')}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 self-start"
                >
                  <span>{lang === 'bn' ? 'ইনভয়েস স্টুডিও' : 'Open Invoice Studio'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Capability 05: Cloud Sync & PWA */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>05. Cloud Sync & Installable PWA</span>
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                    {lang === 'bn'
                      ? 'Firebase ক্লাউড সিকিউরিটি ও মোবাইল ওয়েব অ্যাপ'
                      : 'Firebase Cloud Sync & Installable PWA'}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {lang === 'bn'
                      ? 'Google সাইন-ইন ও কঠোর Firestore সিকিউরিটি রুলস-সহ ক্লাউডে আপনার সব অর্ডার ও অটোমেশন রুলস সুরক্ষিত রাখুন।'
                      : 'Install directly onto desktop or mobile home screens, work offline seamlessly, and sync verified records to Google Firebase Firestore.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchApp('account')}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4 self-start"
                >
                  <span>{lang === 'bn' ? 'ক্লাউড অ্যাকাউন্ট ও প্রোফাইল' : 'Cloud Account & Profile'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Live Auto-Reply Simulator */}
        <section id="workflow" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
              <div className="lg:col-span-5">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {lang === 'bn' ? 'লাইভ মেকানিজম ডেমো' : 'Interactive Mechanism Demo'}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {lang === 'bn'
                    ? 'মেসেজ লিখুন, সাথে সাথেই দেখুন কীভাবে অটো-রিপ্লাই ও অর্ডার তৈরি হয়'
                    : 'Test how incoming messages trigger rules and capture orders'}
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {lang === 'bn'
                    ? 'কোনো অ্যাকাউন্ট লগইন ছাড়াই এখানে একটি গ্রাহক মেসেজ লিখে পরীক্ষা করুন। আমাদের ইঞ্জিন চ্যানেল ও কিওয়ার্ড ম্যাচ করে তাৎক্ষণিক উত্তর এবং অর্ডার ডাটা তৈরি করবে।'
                    : 'Try typing a customer inquiry or order message in Bengali or English. Watch the rule engine match keywords, draft the reply, and capture order details directly into the workspace.'}
                </p>

                <div className="mt-6 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>{lang === 'bn' ? '০১. চ্যানেল ও কিওয়ার্ড রুল ম্যাচিং' : '01. Channel & keyword rule matching'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                    <span>{lang === 'bn' ? '০২. অর্ডার ও ফোন নম্বর শনাক্তকরণ' : '02. Automatic phone & item capture'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                    <span>{lang === 'bn' ? '০৩. সরাসরি CRM অর্ডার শিটে সংরক্ষণ' : '03. One-click sync to Orders Excel Sheet'}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
                <form onSubmit={runSimulation} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'bn' ? 'চ্যানেল নির্বাচন করুন' : 'Select Incoming Channel'}
                    </span>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                      {(['WHATSAPP', 'MESSENGER', 'GMAIL'] as ChannelType[]).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setSimChannel(ch)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            simChannel === ch
                              ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {ch === 'WHATSAPP' ? 'WhatsApp' : ch === 'MESSENGER' ? 'Messenger' : 'Gmail'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="demo-customer-msg"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                    >
                      {lang === 'bn' ? 'গ্রাহকের নমুনা মেসেজ' : 'Simulated Customer Message'}
                    </label>
                    <textarea
                      id="demo-customer-msg"
                      rows={3}
                      value={simMessage}
                      onChange={(e) => setSimMessage(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{lang === 'bn' ? 'অটোমেশন রান করুন' : 'Run Auto-Reply Test'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onLaunchApp('inbox')}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap"
                    >
                      {lang === 'bn' ? 'ফুল AI স্টুডিওতে যান →' : 'Open Full AI Inbox →'}
                    </button>
                  </div>
                </form>

                {simResult && (
                  <div className="mt-6 space-y-4 border-t border-slate-200 dark:border-slate-800 pt-5">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {simResult.ruleName
                            ? `${lang === 'bn' ? 'ম্যাচড রুল:' : 'Matched Rule:'} ${simResult.ruleName}`
                            : lang === 'bn'
                              ? 'ডিফল্ট ফলব্যাক রিপ্লাই'
                              : 'Default Smart Fallback'}
                        </span>
                        <span className="font-mono">1.1s</span>
                      </div>
                      <p className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 text-sm text-slate-800 dark:text-slate-200">
                        {simResult.reply}
                      </p>
                    </div>

                    {simResult.extracted && (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
                        <div className="text-xs text-emerald-900 dark:text-emerald-200">
                          <span className="font-semibold">
                            {lang === 'bn' ? 'অর্ডার শনাক্ত হয়েছে:' : 'Order Captured:'}
                          </span>{' '}
                          <span className="font-mono tabular-nums">
                            {simResult.extracted.quantity}x {simResult.extracted.item}
                            {simResult.extracted.phone ? ` · ${simResult.extracted.phone}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveDemoOrder}
                            disabled={simOrderSaved}
                            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                          >
                            {simOrderSaved
                              ? lang === 'bn'
                                ? 'শিটে যুক্ত হয়েছে'
                                : 'Added to Sheet'
                              : lang === 'bn'
                                ? 'অর্ডার শিটে যোগ করুন'
                                : 'Add to Orders Sheet'}
                          </button>
                          {simOrderSaved && (
                            <button
                              type="button"
                              onClick={() => onLaunchApp('orders')}
                              className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 underline"
                            >
                              {lang === 'bn' ? 'দেখুন' : 'View'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing / Licensing Tiers */}
        <section id="pricing" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {copy.pricingTitle}
              </h2>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
                {copy.pricingDesc}
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {pricingTiers.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-xl border p-8 ${
                    plan.id === 'GROWTH'
                      ? 'border-indigo-600 dark:border-indigo-500 bg-slate-50 dark:bg-slate-900'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                  }`}
                >
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {plan.audience}
                      </span>
                    </div>
                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                        {plan.price}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{plan.cadence}</span>
                    </div>
                    <ul className="mt-6 space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6 text-sm text-slate-600 dark:text-slate-300">
                      {plan.limits.map((lim) => (
                        <li key={lim} className="flex items-start gap-2">
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold" aria-hidden="true">
                            ·
                          </span>
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLaunchApp('overview')}
                    className={`mt-8 w-full rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                      plan.id === 'GROWTH'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {lang === 'bn' ? `${plan.name} প্যাকেজে সাইন ইন করুন` : `Sign In for ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">{copy.brandName}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'মাল্টি-চ্যানেল অটোমেশন CRM, এক্সেল অর্ডার ও কমার্শিয়াল QR ইনভয়েস প্ল্যাটফর্ম'
                : 'Multi-Channel Automation CRM, Orders Sheet & Commercial QR Invoicing'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>
                {lang === 'bn' ? 'ডেভেলপার:' : 'Developer:'}{' '}
                <strong className="font-semibold text-slate-900 dark:text-white">
                  {lang === 'bn' ? CREATOR_SUPPORT.developerNameBn : CREATOR_SUPPORT.developerNameEn}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <a
                href={CREATOR_SUPPORT.supportPhoneHref}
                className="inline-flex items-center gap-1.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline tabular-nums"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {lang === 'bn' ? 'কাস্টমার সাপোর্ট:' : 'Customer Support:'} {CREATOR_SUPPORT.supportPhone}
                </span>
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white">
              {copy.navFeatures}
            </a>
            <a href="#workflow" className="hover:text-slate-900 dark:hover:text-white">
              {copy.navWorkflow}
            </a>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white">
              {copy.navPricing}
            </a>
            <button
              type="button"
              onClick={() => onLaunchApp('overview')}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {copy.openAppCta}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
