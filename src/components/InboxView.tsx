import React, { useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Plus,
  Search,
  Send,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type {
  AiDraftResult,
  AutomationRule,
  ChannelType,
  ConversationThread,
  Language,
} from '../types/crm';
import { extractQuickOrderFromText, matchAutomationRule } from '../utils/crmLogic';
import { ChannelLabel } from './ChannelTag';

interface InboxViewProps {
  lang: Language;
  businessName: string;
  conversations: ConversationThread[];
  rules: AutomationRule[];
  onUpdateConversation: (thread: ConversationThread) => void;
  onCreateOrderFromChat: (payload: {
    customerName: string;
    phone: string;
    channel: ChannelType;
    item: string;
    quantity: number;
    unitPrice: number;
    address: string;
  }) => void;
  onIncrementRuleHit: (ruleId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  lang,
  businessName,
  conversations,
  rules,
  onUpdateConversation,
  onCreateOrderFromChat,
  onIncrementRuleHit,
}) => {
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(conversations[0]?.id ?? '');
  const [replyDraft, setReplyDraft] = useState('');
  const [inboundSimText, setInboundSimText] = useState('');
  const [showSimBar, setShowSimBar] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiDraftResult | null>(null);
  const [orderCreatedNotice, setOrderCreatedNotice] = useState<string | null>(null);

  const filteredThreads = useMemo(() => {
    return conversations.filter((c) => {
      if (channelFilter !== 'ALL' && c.channel !== channelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.customerName.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.messages.some((m) => m.text.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [conversations, channelFilter, searchQuery]);

  const activeThread = useMemo(() => {
    return (
      conversations.find((c) => c.id === selectedId) ??
      filteredThreads[0] ??
      null
    );
  }, [conversations, selectedId, filteredThreads]);

  const handleSelectThread = (thread: ConversationThread) => {
    setSelectedId(thread.id);
    setAiResult(null);
    setAiError(null);
    setOrderCreatedNotice(null);
    if (thread.unreadCount > 0) {
      onUpdateConversation({ ...thread, unreadCount: 0 });
    }
  };

  const handleSendAgentReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyDraft.trim()) return;
    const newMsg = {
      id: `m-${Date.now()}`,
      sender: 'agent' as const,
      text: replyDraft.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      aiGenerated: Boolean(aiResult && aiResult.replyText === replyDraft.trim()),
    };
    onUpdateConversation({
      ...activeThread,
      unreadCount: 0,
      lastActivity: lang === 'bn' ? 'এইমাত্র' : 'Just now',
      messages: [...activeThread.messages, newMsg],
    });
    setReplyDraft('');
    setAiResult(null);
  };

  const handleSimulateInbound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !inboundSimText.trim()) return;
    const text = inboundSimText.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const customerMsg = {
      id: `m-${Date.now()}-in`,
      sender: 'customer' as const,
      text,
      timestamp: nowTime,
    };

    const nextMessages = [...activeThread.messages, customerMsg];
    let matchedRule: AutomationRule | null = null;
    if (activeThread.autoReplyEnabled) {
      matchedRule = matchAutomationRule(text, activeThread.channel, rules);
      if (matchedRule) {
        nextMessages.push({
          id: `m-${Date.now()}-bot`,
          sender: 'bot' as const,
          text: matchedRule.replyTemplate,
          timestamp: nowTime,
          matchedRuleName: matchedRule.name,
        });
        onIncrementRuleHit(matchedRule.id);
      }
    }

    onUpdateConversation({
      ...activeThread,
      unreadCount: matchedRule ? 0 : activeThread.unreadCount + 1,
      lastActivity: lang === 'bn' ? 'এইমাত্র' : 'Just now',
      messages: nextMessages,
    });
    setInboundSimText('');
    setShowSimBar(false);
  };

  const handleDraftWithAi = async () => {
    if (!activeThread) return;
    const lastCustomerMsg = [...activeThread.messages]
      .reverse()
      .find((m) => m.sender === 'customer');
    const messageToAnalyze =
      lastCustomerMsg?.text ||
      activeThread.messages[activeThread.messages.length - 1]?.text ||
      'Hello';

    setAiLoading(true);
    setAiError(null);
    try {
      const recentHistory = activeThread.messages
        .slice(-5)
        .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
        .join('\n');

      const res = await fetch('/api/ai/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: activeThread.customerName,
          channel: activeThread.channel,
          customerMessage: messageToAnalyze,
          businessName,
          language: lang,
          recentHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const quick = extractQuickOrderFromText(messageToAnalyze);
        const matched = matchAutomationRule(messageToAnalyze, activeThread.channel, rules);
        setAiError(
          data.code === 'API_KEY_MISSING'
            ? lang === 'bn'
              ? 'সার্ভারে GEMINI_API_KEY যুক্ত না থাকায় রুল ও স্মার্ট পার্সার ড্রাফট দেখানো হয়েছে।'
              : 'GEMINI_API_KEY not active in environment; generated draft using local rule & order parser.'
            : data.error ||
                (lang === 'bn'
                  ? 'AI সার্ভার থেকে রেসপন্স না পাওয়ায় লোকাল অটো-ড্রাফট ব্যবহার করা হয়েছে।'
                  : 'Used local rule & order parser draft due to AI service error.')
        );
        const fallbackReply = matched
          ? matched.replyTemplate
          : lang === 'bn'
            ? `ধন্যবাদ ${activeThread.customerName}! আপনার মেসেজটি পেয়েছি। অনুগ্রহ করে ডেলিভারি ঠিকানা নিশ্চিত করলে আমরা এখনই অর্ডার কনফার্ম করছি।`
            : `Thank you ${activeThread.customerName}! We received your inquiry and can confirm your order as soon as you share your delivery address.`;
        setReplyDraft(fallbackReply);
        setAiResult({
          replyText: fallbackReply,
          detectedIntent: quick ? 'Order Confirmation' : 'Customer Inquiry',
          suggestedStatus: quick ? 'CONFIRMED' : 'PENDING',
          extractedOrder: quick
            ? {
                customerName: activeThread.customerName,
                item: quick.item,
                quantity: quick.quantity,
                unitPrice: 1850,
                address: 'Dhaka',
              }
            : null,
        });
        return;
      }

      setAiResult(data as AiDraftResult);
      setReplyDraft(data.replyText || '');
    } catch (err) {
      const quick = extractQuickOrderFromText(messageToAnalyze);
      const matched = matchAutomationRule(messageToAnalyze, activeThread.channel, rules);
      const fallbackReply = matched
        ? matched.replyTemplate
        : lang === 'bn'
          ? `ধন্যবাদ ${activeThread.customerName}! আপনার মেসেজটি পেয়েছি। অনুগ্রহ করে ডেলিভারি ঠিকানা নিশ্চিত করলে আমরা এখনই অর্ডার কনফার্ম করছি।`
          : `Thank you ${activeThread.customerName}! We received your inquiry and can confirm your order as soon as you share your delivery address.`;
      setReplyDraft(fallbackReply);
      setAiResult({
        replyText: fallbackReply,
        detectedIntent: quick ? 'Order Confirmation' : 'Customer Inquiry',
        suggestedStatus: quick ? 'CONFIRMED' : 'PENDING',
        extractedOrder: null,
      });
      setAiError(err instanceof Error ? err.message : 'Network error while drafting reply');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLogExtractedOrder = () => {
    if (!activeThread || !aiResult?.extractedOrder) return;
    onCreateOrderFromChat({
      customerName: aiResult.extractedOrder.customerName || activeThread.customerName,
      phone: activeThread.handle.replace(/[^0-9+]/g, '') || '01700000000',
      channel: activeThread.channel,
      item: aiResult.extractedOrder.item,
      quantity: aiResult.extractedOrder.quantity,
      unitPrice: aiResult.extractedOrder.unitPrice || 1500,
      address: aiResult.extractedOrder.address || 'Dhaka',
    });
    setOrderCreatedNotice(
      lang === 'bn'
        ? 'অর্ডারটি Orders Excel Sheet-এ সংরক্ষিত হয়েছে!'
        : 'Order logged to Orders Excel Sheet!'
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left: Thread List */}
      <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[540px]">
        <div className="border-b border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={lang === 'bn' ? 'কথোপকথন খুঁজুন' : 'Search conversations'}
              placeholder={lang === 'bn' ? 'নাম বা মেসেজ খুঁজুন...' : 'Search customer or text...'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            {(['ALL', 'WHATSAPP', 'MESSENGER', 'GMAIL'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  channelFilter === ch
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {ch === 'ALL'
                  ? lang === 'bn'
                    ? 'সব'
                    : 'All'
                  : ch === 'WHATSAPP'
                    ? 'WA'
                    : ch === 'MESSENGER'
                      ? 'MSG'
                      : 'Gmail'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'কোনো কনভারসেশন পাওয়া যায়নি।' : 'No matching conversations found.'}
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const lastMsg = thread.messages[thread.messages.length - 1];
              const isActive = activeThread?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelectThread(thread)}
                  className={`w-full text-left p-4 transition-colors ${
                    isActive
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {thread.customerName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                      {thread.lastActivity}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <ChannelLabel channel={thread.channel} />
                    {thread.unreadCount > 0 && (
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {thread.unreadCount} new
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {lastMsg.text}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Active Conversation & AI Studio */}
      <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[540px]">
        {activeThread ? (
          <>
            {/* Thread Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeThread.customerName}
                  </h2>
                  <ChannelLabel channel={activeThread.channel} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {activeThread.handle} · {activeThread.intentTag}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConversation({
                      ...activeThread,
                      autoReplyEnabled: !activeThread.autoReplyEnabled,
                    })
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    activeThread.autoReplyEnabled
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lang === 'bn'
                    ? activeThread.autoReplyEnabled
                      ? 'অটো-রিপ্লাই: চালু'
                      : 'অটো-রিপ্লাই: বন্ধ'
                    : activeThread.autoReplyEnabled
                      ? 'Auto-Reply: ON'
                      : 'Auto-Reply: OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSimBar((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'ইনকামিং টেস্ট' : 'Simulate Inbound'}</span>
                </button>
              </div>
            </div>

            {/* Simulate Incoming Customer Message Bar */}
            {showSimBar && (
              <form
                onSubmit={handleSimulateInbound}
                className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-3 flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  value={inboundSimText}
                  onChange={(e) => setInboundSimText(e.target.value)}
                  aria-label="Simulated customer message"
                  placeholder={
                    lang === 'bn'
                      ? 'গ্রাহকের মতো মেসেজ লিখুন (যেমন: দাম কত এবং ডেলিভারি চার্জ?)'
                      : 'Type simulated customer message (e.g. price and delivery charge?)'
                  }
                  className="flex-1 min-w-[220px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 dark:bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-indigo-700 whitespace-nowrap"
                >
                  {lang === 'bn' ? 'গ্রাহক হিসেবে পাঠান' : 'Send as Customer'}
                </button>
              </form>
            )}

            {/* Messages Feed */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[380px]">
              {activeThread.messages.map((msg) => {
                const isCustomer = msg.sender === 'customer';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                        isCustomer
                          ? 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        {msg.sender === 'customer'
                          ? activeThread.customerName
                          : msg.sender === 'bot'
                            ? `Auto-Bot (${msg.matchedRuleName || 'Rule'})`
                            : msg.aiGenerated
                              ? 'Agent · Gemini AI Draft'
                              : 'Agent'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{msg.timestamp}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI Extraction & Error Banner */}
            {(aiError || aiResult || orderCreatedNotice) && (
              <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-3 space-y-2">
                {aiError && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{aiError}</p>
                )}
                {orderCreatedNotice && (
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{orderCreatedNotice}</span>
                  </p>
                )}
                {aiResult && (
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {lang === 'bn' ? 'AI ইন্টেন্ট:' : 'AI Intent:'}
                      </span>{' '}
                      <span>{aiResult.detectedIntent}</span>
                      {aiResult.extractedOrder && (
                        <>
                          {' · '}
                          <span className="font-mono">
                            {aiResult.extractedOrder.quantity}x {aiResult.extractedOrder.item}
                          </span>
                        </>
                      )}
                    </div>
                    {aiResult.extractedOrder && !orderCreatedNotice && (
                      <button
                        type="button"
                        onClick={handleLogExtractedOrder}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {lang === 'bn' ? 'এক্সেল শিটে অর্ডার যোগ করুন' : 'Log Extracted Order'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reply Composer */}
            <form
              onSubmit={handleSendAgentReply}
              className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <textarea
                rows={2}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                aria-label={lang === 'bn' ? 'উত্তর লিখুন' : 'Write reply'}
                placeholder={
                  lang === 'bn'
                    ? 'গ্রাহকের উত্তর লিখুন অথবা নিচের Gemini AI বাটনে ক্লিক করুন...'
                    : 'Write your reply or click Draft with Gemini AI...'
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDraftWithAi}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-60 transition-colors whitespace-nowrap"
                >
                  {aiLoading ? (
                    <Bot className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {aiLoading
                      ? lang === 'bn'
                        ? 'AI ড্রাফট তৈরি হচ্ছে...'
                        : 'Drafting with Gemini...'
                      : lang === 'bn'
                        ? 'Gemini AI দিয়ে উত্তর লিখুন'
                        : 'Draft with Gemini AI'}
                  </span>
                </button>

                <button
                  type="submit"
                  disabled={!replyDraft.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'উত্তর পাঠান' : 'Send Reply'}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
            {lang === 'bn' ? 'একটি কনভারসেশন নির্বাচন করুন' : 'Select a conversation thread'}
          </div>
        )}
      </div>
    </div>
  );
};
