import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  FileSpreadsheet,
  Headphones,
  Inbox,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Phone,
  QrCode,
  Search,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { CREATOR_SUPPORT } from '../data/supportInfo';
import type {
  AutomationRule,
  ChannelType,
  ConversationThread,
  Language,
  OrderRecord,
  OrderStatus,
  WorkspaceTab,
} from '../types/crm';
import {
  computeAdvancedAnalytics,
  computeWorkspaceMetrics,
  formatCurrencyBDT,
  getNextOrderStatus,
} from '../utils/crmLogic';
import { ChannelLabel, OrderStatusLabel, PaymentStatusLabel } from './ChannelTag';

interface OverviewViewProps {
  lang: Language;
  businessName?: string;
  orders: OrderRecord[];
  conversations: ConversationThread[];
  rules: AutomationRule[];
  onNavigateTab: (tab: WorkspaceTab) => void;
  onSelectOrderForInvoice: (orderId: string) => void;
  onUpdateOrder: (order: OrderRecord) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  lang,
  businessName,
  orders,
  conversations,
  rules,
  onNavigateTab,
  onSelectOrderForInvoice,
  onUpdateOrder,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  const globalMetrics = useMemo(
    () => computeWorkspaceMetrics(orders, conversations, rules),
    [orders, conversations, rules]
  );

  const analytics = useMemo(
    () => computeAdvancedAnalytics(orders, channelFilter, searchQuery),
    [orders, channelFilter, searchQuery]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (channelFilter !== 'ALL' && conv.channel !== channelFilter) return false;
      if (q) {
        const lastMsg = conv.messages[conv.messages.length - 1]?.text.toLowerCase() || '';
        return (
          conv.customerName.toLowerCase().includes(q) ||
          conv.handle.toLowerCase().includes(q) ||
          conv.intentTag.toLowerCase().includes(q) ||
          lastMsg.includes(q)
        );
      }
      return true;
    });
  }, [conversations, channelFilter, searchQuery]);

  const filteredRules = useMemo(() => {
    return rules
      .filter((r) => channelFilter === 'ALL' || r.channel === 'ALL' || r.channel === channelFilter)
      .sort((a, b) => b.hitCount - a.hitCount);
  }, [rules, channelFilter]);

  const unreadFilteredChats = useMemo(
    () => filteredConversations.reduce((acc, c) => acc + c.unreadCount, 0),
    [filteredConversations]
  );

  const handleCopySupportPhone = async () => {
    try {
      await navigator.clipboard.writeText(CREATOR_SUPPORT.supportPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      setCopiedPhone(false);
    }
  };

  const handleAdvanceStatus = (ord: OrderRecord) => {
    const next = getNextOrderStatus(ord.status);
    if (!next) return;
    onUpdateOrder({
      ...ord,
      status: next,
      updatedAt: new Date().toISOString(),
    });
  };

  const nextActionLabel = (status: OrderStatus): string | null => {
    if (status === 'PENDING') return lang === 'bn' ? 'কনফার্ম' : 'Confirm';
    if (status === 'CONFIRMED') return lang === 'bn' ? 'শিপ' : 'Ship';
    if (status === 'SHIPPED') return lang === 'bn' ? 'ডেলিভার' : 'Deliver';
    return null;
  };

  const pipelineStages: {
    status: OrderStatus;
    labelBn: string;
    labelEn: string;
    barClass: string;
  }[] = [
    { status: 'PENDING', labelBn: 'পেন্ডিং', labelEn: 'Pending', barClass: 'bg-amber-500' },
    { status: 'CONFIRMED', labelBn: 'কনফার্মড', labelEn: 'Confirmed', barClass: 'bg-indigo-600' },
    { status: 'SHIPPED', labelBn: 'শিপড', labelEn: 'Shipped', barClass: 'bg-sky-500' },
    { status: 'DELIVERED', labelBn: 'ডেলিভার্ড', labelEn: 'Delivered', barClass: 'bg-emerald-600' },
  ];

  const totalPipelineActive =
    analytics.pipeline.PENDING +
    analytics.pipeline.CONFIRMED +
    analytics.pipeline.SHIPPED +
    analytics.pipeline.DELIVERED;

  const paidBarPct =
    analytics.totalRevenue > 0
      ? Math.round((analytics.paymentBreakdown.paidAmount / analytics.totalRevenue) * 100)
      : 0;
  const partialBarPct =
    analytics.totalRevenue > 0
      ? Math.round((analytics.paymentBreakdown.partialAmount / analytics.totalRevenue) * 100)
      : 0;
  const unpaidBarPct = Math.max(0, 100 - paidBarPct - partialBarPct);

  const storeTitle = businessName?.trim() || (lang === 'bn' ? 'আপনার বিজনেস' : 'Your Store');

  return (
    <div className="space-y-6">
      {/* Executive Business Digest & Action Attention Strip */}
      <section
        aria-label={lang === 'bn' ? 'ব্যবসায়িক অপারেশন সারসংক্ষেপ' : 'Business Operations Digest'}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {lang === 'bn'
                ? `${storeTitle} — আজকের বিস্তারিত ড্যাশবোর্ড সারসংক্ষেপ`
                : `${storeTitle} — Operations & Store Digest`}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 tabular-nums">
              {lang === 'bn'
                ? `এই মুহূর্তে আপনার স্টোরে ${analytics.activeOrdersCount}টি সক্রিয় অর্ডারে মোট ${analytics.totalUnitsSold} পিস পণ্য রয়েছে। বকেয়া কালেকশন, পেন্ডিং অর্ডার কনফার্মেশন, ইনবক্স রিপ্লাই এবং অটোমেশনের সম্পূর্ণ অবস্থা নিচে দেওয়া হলো।`
                : `Tracking ${analytics.activeOrdersCount} active orders (${analytics.totalUnitsSold} units) across your store. Review priority follow-ups, payment collections, live customer chats, and active auto-reply rules below.`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-2.5 text-left hover:bg-amber-100/70 dark:hover:bg-amber-950/50 transition-colors"
            >
              <div>
                <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                  {lang === 'bn' ? 'কনফার্ম বাকি' : 'Pending Orders'}
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                  {analytics.pipeline.PENDING}{' '}
                  {lang === 'bn' ? 'টি' : analytics.pipeline.PENDING === 1 ? 'order' : 'orders'}
                </p>
              </div>
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('invoices')}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {lang === 'bn' ? 'বকেয়া পেমেন্ট' : 'Unpaid Due'}
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrencyBDT(analytics.unpaidBalance)}
                </p>
              </div>
              <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('inbox')}
              className="flex items-center justify-between gap-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 px-3.5 py-2.5 text-left hover:bg-indigo-100/70 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <div>
                <p className="text-[11px] font-medium text-indigo-800 dark:text-indigo-300">
                  {lang === 'bn' ? 'অপঠিত চ্যাট' : 'Unread Chats'}
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-indigo-900 dark:text-indigo-200 tabular-nums">
                  {unreadFilteredChats}{' '}
                  {lang === 'bn' ? 'মেসেজ' : unreadFilteredChats === 1 ? 'msg' : 'msgs'}
                </p>
              </div>
              <MessageSquareText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Plain-Language 3-Step Workflow Explainer */}
        <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-1 gap-3 md:grid-cols-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'bn' ? '১. ২৪/৭ অটো-রিপ্লাই ক্যাপচার' : '1. 24/7 Auto-Reply Capture'}
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'WhatsApp, Messenger ও Gmail-এর মেসেজে কীওয়ার্ড ও Gemini AI দিয়ে তাৎক্ষণিক উত্তর যায়।'
                  : 'Instant keyword rules & Gemini AI answer WhatsApp, Messenger, and Gmail inquiries automatically.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'bn' ? '২. এক্সেল অর্ডার শিট সিঙ্ক' : '2. Excel Order Sheet Sync'}
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'ক্রেতার নাম, ফোন, ঠিকানা ও ডেলিভারি চার্জসহ সব অর্ডার ১ ক্লিকে CSV/Excel-এ সংরক্ষণ হয়।'
                  : 'Customer phone, delivery area, fees, and order stages sync into an exportable spreadsheet.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <QrCode className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {lang === 'bn' ? '৩. QR ইনভয়েস ও ডেলিভারি ট্র্যাক' : '3. QR Invoice & Delivery Track'}
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'প্রতিটি অর্ডারের ভেরিফায়েড QR বিল প্রিন্ট করুন এবং Paid/Partial/Unpaid পেমেন্ট স্ট্যাটাস ট্র্যাক করুন।'
                  : 'Generate scannable commercial QR bills and track Paid, Partial, and COD balances clearly.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Command Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div
          role="group"
          aria-label={lang === 'bn' ? 'ড্যাশবোর্ড চ্যানেল ফিল্টার' : 'Dashboard channel filter'}
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1"
        >
          {(
            [
              { id: 'ALL', label: lang === 'bn' ? 'সব চ্যানেল' : 'All Channels' },
              { id: 'WHATSAPP', label: 'WhatsApp' },
              { id: 'MESSENGER', label: 'Messenger' },
              { id: 'GMAIL', label: 'Gmail' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setChannelFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                channelFilter === tab.id
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={lang === 'bn' ? 'ড্যাশবোর্ড অর্ডার বা চ্যাট খুঁজুন' : 'Search dashboard orders or chats'}
            placeholder={
              lang === 'bn'
                ? 'ক্রেতা, ফোন, এলাকা বা অর্ডার ID...'
                : 'Filter by customer, phone, area, or ID...'
            }
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 4 Primary Advanced KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? 'মোট সক্রিয় বিক্রি' : 'Active Revenue'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {formatCurrencyBDT(analytics.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lang === 'bn'
              ? `পরিশোধিত: ${formatCurrencyBDT(analytics.paidRevenue)} (${analytics.collectionRatePct}%)`
              : `Collected: ${formatCurrencyBDT(analytics.paidRevenue)} (${analytics.collectionRatePct}%)`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? 'মোট অর্ডার ও গড় মূল্য' : 'Orders & Avg Ticket'}</span>
            <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {analytics.activeOrdersCount}{' '}
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {`/ ${analytics.totalUnitsSold} ${lang === 'bn' ? 'পিস' : analytics.totalUnitsSold === 1 ? 'unit' : 'units'}`}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lang === 'bn'
              ? `গড় অর্ডার: ${formatCurrencyBDT(analytics.averageOrderValue)} · বাতিল: ${analytics.paymentBreakdown.cancelledCount}`
              : `Avg ticket: ${formatCurrencyBDT(analytics.averageOrderValue)} · Cancelled: ${analytics.paymentBreakdown.cancelledCount}`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? 'ডেলিভারি পাইপলাইন' : 'Fulfillment Pipeline'}</span>
            <PackageCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {analytics.pipeline.DELIVERED}/{totalPipelineActive}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lang === 'bn'
              ? `${analytics.pipeline.PENDING} পেন্ডিং · ${analytics.pipeline.CONFIRMED + analytics.pipeline.SHIPPED} চলমান`
              : `${analytics.pipeline.PENDING} pending · ${analytics.pipeline.CONFIRMED + analytics.pipeline.SHIPPED} in transit`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? 'অটো-রিপ্লাই ও ইনবক্স' : 'Inbox & Auto-Replies'}</span>
            <Inbox className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          </div>
          <p className="mt-2.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {globalMetrics.totalAutoHits}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {lang === 'bn'
              ? `${unreadFilteredChats} অপঠিত চ্যাট · ${globalMetrics.activeRulesCount} সক্রিয় রুলস`
              : `${unreadFilteredChats} unread chats · ${globalMetrics.activeRulesCount} active rules`}
          </p>
        </div>
      </div>

      {/* Main Analytics & Live Operations Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">
          {/* Fulfillment Pipeline Visualizer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'অর্ডার ফুলফিলমেন্ট পাইপলাইন' : 'Order Fulfillment Pipeline'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'পেন্ডিং থেকে ডেলিভারি পর্যন্ত অর্ডারের ধাপভিত্তিক বিশ্লেষণ'
                    : 'Live stage breakdown across filtered customer orders'}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                {lang === 'bn' ? 'বকেয়া:' : 'Due:'} {formatCurrencyBDT(analytics.unpaidBalance)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {pipelineStages.map((stage) => {
                const count = analytics.pipeline[stage.status];
                const pct =
                  totalPipelineActive > 0 ? Math.round((count / totalPipelineActive) * 100) : 0;
                return (
                  <div
                    key={stage.status}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5"
                  >
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? stage.labelBn : stage.labelEn}
                    </p>
                    <div className="mt-1.5 flex items-baseline justify-between">
                      <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {count}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${stage.barClass}`}
                        style={{ width: `${Math.max(pct, count > 0 ? 12 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Payment & Cashflow Breakdown */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'পেমেন্ট ও ক্যাশফ্লো বিশ্লেষণ' : 'Payment & Cashflow Breakdown'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'পরিশোধিত, আংশিক, বকেয়া ও ডেলিভারি চার্জের হিসাব'
                    : 'Paid, partial, COD unpaid balances, delivery fees & discounts'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('invoices')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                <span>{lang === 'bn' ? 'QR ইনভয়েস খুলুন' : 'Open Invoices'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Stacked Cashflow Ratio Bar */}
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex">
              {paidBarPct > 0 && (
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${paidBarPct}%` }}
                  title={`Paid: ${paidBarPct}%`}
                />
              )}
              {partialBarPct > 0 && (
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${partialBarPct}%` }}
                  title={`Partial: ${partialBarPct}%`}
                />
              )}
              {unpaidBarPct > 0 && analytics.totalRevenue > 0 && (
                <div
                  className="bg-slate-400 dark:bg-slate-600 h-full"
                  style={{ width: `${unpaidBarPct}%` }}
                  title={`Unpaid: ${unpaidBarPct}%`}
                />
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {lang === 'bn' ? 'পরিশোধিত (Paid)' : 'Paid Orders'} ·{' '}
                  <span className="font-mono tabular-nums">{analytics.paymentBreakdown.paidCount}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrencyBDT(analytics.paymentBreakdown.paidAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {lang === 'bn' ? 'আংশিক পরিশোধ (Partial)' : 'Partial Payment'} ·{' '}
                  <span className="font-mono tabular-nums">{analytics.paymentBreakdown.partialCount}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrencyBDT(analytics.paymentBreakdown.partialAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'বকেয়া / ক্যাশ অন ডেলিভারি (Unpaid)' : 'Unpaid / COD Due'} ·{' '}
                  <span className="font-mono tabular-nums">{analytics.paymentBreakdown.unpaidCount}</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrencyBDT(analytics.paymentBreakdown.unpaidAmount)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  {lang === 'bn' ? 'মোট ডেলিভারি চার্জ:' : 'Delivery Charges:'}{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {formatCurrencyBDT(analytics.totalDeliveryFees)}
                  </strong>
                </span>
                <span>
                  {lang === 'bn' ? 'মোট ডিসকাউন্ট:' : 'Discounts Given:'}{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {formatCurrencyBDT(analytics.totalDiscounts)}
                  </strong>
                </span>
                <span>
                  {lang === 'bn' ? 'বাতিল অর্ডার:' : 'Cancelled:'}{' '}
                  <strong className="font-mono text-rose-600 dark:text-rose-400">
                    {analytics.paymentBreakdown.cancelledCount} ({formatCurrencyBDT(analytics.paymentBreakdown.cancelledAmount)})
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Channel Revenue Share Matrix */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'চ্যানেল অনুযায়ী পারফরম্যান্স ও শেয়ার' : 'Channel Revenue & Share'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('orders')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                <span>{lang === 'bn' ? 'সব অর্ডার দেখুন' : 'View All Orders'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {analytics.channelShares.map((item) => {
                const chatsCount = globalMetrics.byChannel[item.channel].chats;
                return (
                  <div key={item.channel} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <ChannelLabel channel={item.channel} />
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                          {item.orders} {lang === 'bn' ? 'অর্ডার' : 'orders'} · {chatsCount}{' '}
                          {lang === 'bn' ? 'চ্যাট' : 'chats'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrencyBDT(item.revenue)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">({item.sharePct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          item.channel === 'WHATSAPP'
                            ? 'bg-emerald-600'
                            : item.channel === 'MESSENGER'
                              ? 'bg-indigo-600'
                              : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.max(item.sharePct, item.revenue > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Customer Inbox Digest */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'সাম্প্রতিক কাস্টমার ইনবক্স ও মেসেজ' : 'Live Customer Inbox Digest'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'ক্রেতাদের সর্বশেষ বার্তা, ইন্টেন্ট ও অটো-বট রেসপন্স'
                    : 'Recent customer threads, detected intent, and latest message preview'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('inbox')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                <span>{lang === 'bn' ? 'ইনবক্সে উত্তর দিন' : 'Reply in Inbox'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {filteredConversations.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'নির্বাচিত চ্যানেল বা সার্চে কোনো কাস্টমার চ্যাট পাওয়া যায়নি।'
                  : 'No customer conversations match the active filter.'}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredConversations.slice(0, 4).map((conv) => {
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  return (
                    <div key={conv.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {conv.customerName}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <ChannelLabel channel={conv.channel} />
                          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {conv.intentTag}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                          {conv.unreadCount > 0 && (
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {conv.unreadCount} {lang === 'bn' ? 'অপঠিত' : 'unread'}
                            </span>
                          )}
                          <span className="text-slate-500 dark:text-slate-400">{conv.lastActivity}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {lastMsg
                          ? `${lastMsg.sender === 'bot' ? (lang === 'bn' ? 'অটো-রিপ্লাই: ' : 'Auto-Bot: ') : lastMsg.sender === 'agent' ? (lang === 'bn' ? 'আপনি: ' : 'You: ') : ''}${lastMsg.text}`
                          : conv.handle}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Auto-Reply Rules + Top Products & Delivery Regions + Shortcuts + Creator Support */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Auto-Reply Rules Performance */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'অটো-রিপ্লাই রুলস পারফরম্যান্স' : 'Auto-Reply Rules Activity'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'কোন কীওয়ার্ডে কতবার স্বয়ংক্রিয় উত্তর গেছে'
                    : 'Active keyword triggers & automated response counts'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('automation')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                <span>{lang === 'bn' ? 'রুলস' : 'Manage'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {filteredRules.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'কোনো অটো-রিপ্লাই রুল পাওয়া যায়নি।' : 'No rules configured for this channel.'}
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRules.slice(0, 4).map((rule) => (
                  <div key={rule.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {rule.name}
                      </span>
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                        {rule.hitCount} {lang === 'bn' ? 'হিট' : 'hits'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <ChannelLabel channel={rule.channel} />
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          rule.enabled
                            ? 'font-medium text-emerald-700 dark:text-emerald-400'
                            : 'font-medium text-slate-400'
                        }
                      >
                        {rule.enabled
                          ? lang === 'bn'
                            ? 'চালু'
                            : 'Active'
                          : lang === 'bn'
                            ? 'বন্ধ'
                            : 'Paused'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono truncate">
                        {rule.keywords.slice(0, 3).join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Products & Delivery Regions */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'শীর্ষ বিক্রিত পণ্য' : 'Top Moving Products'}
              </h2>
              {analytics.topItems.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'এই ফিল্টারে কোনো সক্রিয় পণ্য পাওয়া যায়নি।' : 'No matching active items.'}
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {analytics.topItems.map((prod) => (
                    <div key={prod.item} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{prod.item}</p>
                        <p className="mt-0.5 text-slate-500 dark:text-slate-400 tabular-nums">
                          {prod.units} {lang === 'bn' ? 'পিস বিক্রি' : 'units sold'}
                        </p>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums shrink-0">
                        {formatCurrencyBDT(prod.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'ডেলিভারি এলাকা অনুযায়ী চাহিদা' : 'Top Delivery Regions'}
                </h3>
                <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </div>
              {analytics.topLocations.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'কোনো ডেলিভারি ঠিকানা নেই।' : 'No regional data in filter.'}
                </p>
              ) : (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {analytics.topLocations.map((loc) => (
                    <div
                      key={loc.location}
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {loc.location}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums shrink-0">
                        {loc.orders} {lang === 'bn' ? 'অর্ডার' : 'orders'} · {formatCurrencyBDT(loc.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Operations */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'দ্রুত অ্যাকশন ওয়ার্কফ্লো' : 'Quick Operations Shortcuts'}
            </h2>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => onNavigateTab('inbox')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'Gemini AI স্মার্ট রিপ্লাই স্টুডিও' : 'Open Gemini AI Reply Studio'}</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('orders')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'অর্ডার এক্সেল শিট ও CSV এক্সপোর্ট' : 'Manage Orders Excel Sheet'}</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('invoices')}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <QrCode className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'QR কোড ইনভয়েস জেনারেটর' : 'Generate Commercial QR Invoice'}</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Creator & Customer Support Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'ডেভেলপার ও কাস্টমার সাপোর্ট' : 'Developer & Customer Support'}
              </h2>
              <Headphones className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'ক্রিয়েটর / ডেভেলপার' : 'Created by'}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {lang === 'bn' ? CREATOR_SUPPORT.developerNameBn : CREATOR_SUPPORT.developerNameEn}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'কাস্টমার সাপোর্ট নম্বর' : 'Customer Support'}
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {CREATOR_SUPPORT.supportPhone}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? CREATOR_SUPPORT.supportHoursBn : CREATOR_SUPPORT.supportHoursEn}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <a
                href={CREATOR_SUPPORT.supportPhoneHref}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{lang === 'bn' ? 'কল সাপোর্ট' : 'Call Support'}</span>
              </a>
              <button
                type="button"
                onClick={handleCopySupportPhone}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {copiedPhone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {copiedPhone
                    ? lang === 'bn'
                      ? 'কপি হয়েছে'
                      : 'Copied'
                    : lang === 'bn'
                      ? 'কপি'
                      : 'Copy'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Recent Orders Snapshot with Full Customer & Payment Details */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সাম্প্রতিক কাস্টমার অর্ডার ও বিস্তারিত স্ট্যাটাস' : 'Recent Orders & Detailed Status'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'ক্রেতার মোবাইল, ঠিকানা, পেমেন্ট ও ডেলিভারি ধাপ সরাসরি আপডেট করুন'
                : 'Customer phone, delivery address, payment state, and 1-click fulfillment'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
          >
            {lang === 'bn' ? 'সম্পূর্ণ শিট ওপেন করুন' : 'Open Full Sheet'}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4">ID</th>
                <th className="py-2.5 px-4">{lang === 'bn' ? 'ক্রেতা ও ফোন' : 'Customer & Phone'}</th>
                <th className="py-2.5 px-4">{lang === 'bn' ? 'পণ্য ও ঠিকানা' : 'Item & Address'}</th>
                <th className="py-2.5 px-4">{lang === 'bn' ? 'চ্যানেল' : 'Channel'}</th>
                <th className="py-2.5 px-4">{lang === 'bn' ? 'অবস্থা ও পেমেন্ট' : 'Order & Payment'}</th>
                <th className="py-2.5 px-4 text-right">{lang === 'bn' ? 'মোট' : 'Total'}</th>
                <th className="py-2.5 pl-4 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {analytics.filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'bn' ? 'কোনো অর্ডার পাওয়া যায়নি।' : 'No orders match the current filter.'}
                  </td>
                </tr>
              ) : (
                analytics.filteredOrders.slice(0, 6).map((ord) => {
                  const nextLabel = nextActionLabel(ord.status);
                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                        {ord.id}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap align-top">
                        <p className="font-medium text-slate-900 dark:text-white text-xs sm:text-sm">
                          {ord.customerName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {ord.phone}
                        </p>
                      </td>
                      <td className="py-3 px-4 max-w-[230px] align-top">
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {ord.item}{' '}
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            ×{ord.quantity}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {ord.address || (lang === 'bn' ? 'ঠিকানা যুক্ত নেই' : 'No address')}
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <ChannelLabel channel={ord.channel} />
                      </td>
                      <td className="py-3 px-4 align-top">
                        <div className="flex flex-col gap-0.5">
                          <OrderStatusLabel status={ord.status} lang={lang} />
                          <PaymentStatusLabel status={ord.paymentStatus} lang={lang} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
                        <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatCurrencyBDT(ord.total)}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {ord.deliveryFee > 0
                            ? `${lang === 'bn' ? 'ডেলি:' : 'Del:'} ${formatCurrencyBDT(ord.deliveryFee)}`
                            : lang === 'bn'
                              ? 'ফ্রি ডেলি.'
                              : 'Free del.'}
                        </p>
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap align-top">
                        <div className="inline-flex items-center gap-3">
                          {nextLabel && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStatus(ord)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              <span>{nextLabel}</span>
                              <ArrowRight className="w-3 h-3" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectOrderForInvoice(ord.id)}
                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {lang === 'bn' ? 'QR ইনভয়েস' : 'QR Invoice'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
