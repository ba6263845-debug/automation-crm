import React, { useState } from 'react';
import { Bot, Check, Copy, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { AutomationRule, ChannelType, Language, RuleChannelType } from '../types/crm';
import { matchAutomationRule } from '../utils/crmLogic';
import { ChannelLabel } from './ChannelTag';

interface AutomationViewProps {
  lang: Language;
  rules: AutomationRule[];
  onAddRule: (rule: Omit<AutomationRule, 'id' | 'uid' | 'hitCount' | 'createdAt' | 'updatedAt'>) => void;
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
}

export const AutomationView: React.FC<AutomationViewProps> = ({
  lang,
  rules,
  onAddRule,
  onToggleRule,
  onDeleteRule,
}) => {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<RuleChannelType>('ALL');
  const [keywordsText, setKeywordsText] = useState('');
  const [replyTemplate, setReplyTemplate] = useState('');
  const [autoExtractOrder, setAutoExtractOrder] = useState(true);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Gemini Rule Generator
  const [aiGoal, setAiGoal] = useState('');
  const [aiRuleLoading, setAiRuleLoading] = useState(false);
  const [aiRuleNote, setAiRuleNote] = useState<string | null>(null);

  // Live Rule Tester
  const [testMsg, setTestMsg] = useState('');
  const [testChannel, setTestChannel] = useState<ChannelType>('WHATSAPP');
  const matchedTestRule = testMsg.trim() ? matchAutomationRule(testMsg, testChannel, rules) : null;

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = keywordsText
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (!name.trim() || keywords.length === 0 || !replyTemplate.trim()) {
      setRuleError(
        lang === 'bn'
          ? 'রুলের নাম, অন্তত ১টি কিওয়ার্ড এবং রিপ্লাই টেমপ্লেট লিখুন।'
          : 'Rule name, at least 1 keyword, and reply template are required.'
      );
      return;
    }

    onAddRule({
      name: name.trim(),
      channel,
      keywords,
      replyTemplate: replyTemplate.trim(),
      autoExtractOrder,
      enabled: true,
    });
    setName('');
    setKeywordsText('');
    setReplyTemplate('');
    setRuleError(null);
  };

  const handleGenerateAiRule = async () => {
    if (!aiGoal.trim()) return;
    setAiRuleLoading(true);
    setAiRuleNote(null);
    try {
      const res = await fetch('/api/ai/generate-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalPrompt: aiGoal.trim(),
          channel,
          language: lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'API_KEY_MISSING') {
          setName(lang === 'bn' ? 'স্মার্ট কাস্টম অটো-রিপ্লাই' : 'Smart Custom Policy');
          setKeywordsText('price, দাম, order, অর্ডার, info');
          setReplyTemplate(aiGoal.trim());
          setAiRuleNote(
            lang === 'bn'
              ? 'GEMINI_API_KEY না থাকায় আপনার নীতিমালা দিয়ে লোকাল টেমপ্লেট পূরণ করা হয়েছে।'
              : 'GEMINI_API_KEY not active; pre-filled template from your policy prompt.'
          );
        } else {
          setAiRuleNote(data.error || 'Failed to generate rule');
        }
        return;
      }
      setName(data.name || 'Smart Auto-Reply Rule');
      setKeywordsText(Array.isArray(data.keywords) ? data.keywords.join(', ') : 'price, order');
      setReplyTemplate(data.replyTemplate || '');
      setAutoExtractOrder(Boolean(data.autoExtractOrder));
      setAiGoal('');
    } catch (err) {
      setAiRuleNote(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAiRuleLoading(false);
    }
  };

  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/meta` : '/api/webhooks/meta';

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Create Rule & AI Rule Builder */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>{lang === 'bn' ? 'Gemini AI রুল বিল্ডার' : 'Gemini AI Rule Builder'}</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            {lang === 'bn'
              ? 'আপনার ব্যবসার নিয়ম লিখে দিন, AI নিজেই কিওয়ার্ড ও অটো-রিপ্লাই ড্রাফট তৈরি করবে।'
              : 'Describe your support policy in plain words and let Gemini AI populate keywords and reply copy.'}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={aiGoal}
              onChange={(e) => setAiGoal(e.target.value)}
              aria-label="AI rule policy prompt"
              placeholder={
                lang === 'bn'
                  ? 'যেমন: ক্যাশ অন ডেলিভারি ও ২৪ ঘণ্টায় ডেলিভারি...'
                  : 'e.g. 24h Dhaka delivery 60 BDT, outside 120 BDT...'
              }
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGenerateAiRule}
              disabled={aiRuleLoading || !aiGoal.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{aiRuleLoading ? '...' : lang === 'bn' ? 'তৈরি' : 'Draft'}</span>
            </button>
          </div>
          {aiRuleNote && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">{aiRuleNote}</p>
          )}
        </div>

        <form
          onSubmit={handleCreateRule}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'নতুন অটো-রিপ্লাই রুল' : 'Create Automation Rule'}
          </h2>

          <div>
            <label htmlFor="rule-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {lang === 'bn' ? 'রুলের নাম *' : 'Rule Name *'}
            </label>
            <input
              id="rule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rule-channel" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'চ্যানেল' : 'Target Channel'}
              </label>
              <select
                id="rule-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as RuleChannelType)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">All Channels</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="MESSENGER">Messenger</option>
                <option value="GMAIL">Gmail</option>
              </select>
            </div>
            <div>
              <label htmlFor="rule-keywords" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'ট্রিগার কিওয়ার্ড (কমা দিয়ে) *' : 'Trigger Keywords (comma) *'}
              </label>
              <input
                id="rule-keywords"
                type="text"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="price, দাম, delivery"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rule-reply" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {lang === 'bn' ? 'অটো-রিপ্লাই মেসেজ *' : 'Auto-Reply Template *'}
            </label>
            <textarea
              id="rule-reply"
              rows={3}
              value={replyTemplate}
              onChange={(e) => setReplyTemplate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoExtractOrder}
              onChange={(e) => setAutoExtractOrder(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              {lang === 'bn'
                ? 'মেসেজ থেকে স্বয়ংক্রিয়ভাবে অর্ডার ডিটেক্ট করুন'
                : 'Auto-extract customer order intents'}
            </span>
          </label>

          {ruleError && <p className="text-xs text-rose-600 dark:text-rose-400">{ruleError}</p>}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'bn' ? 'রুল সংরক্ষণ করুন' : 'Save Automation Rule'}</span>
          </button>
        </form>
      </div>

      {/* Right: Active Rules List + Live Tester + Meta Webhook */}
      <div className="lg:col-span-7 space-y-6">
        {/* Live Rule Tester */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'রিয়েল-টাইম রুল ম্যাচ টেস্টার' : 'Real-Time Rule Match Tester'}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              aria-label="Test channel"
              value={testChannel}
              onChange={(e) => setTestChannel(e.target.value as ChannelType)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="MESSENGER">Messenger</option>
              <option value="GMAIL">Gmail</option>
            </select>
            <input
              type="text"
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              aria-label="Test incoming text"
              placeholder={
                lang === 'bn'
                  ? 'যেকোনো মেসেজ লিখে দেখুন কোন রুল ট্রিগার হয়...'
                  : 'Type a test message to preview matched rule...'
              }
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {testMsg.trim() && (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs">
              {matchedTestRule ? (
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Matched: {matchedTestRule.name}
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{matchedTestRule.replyTemplate}</p>
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'কোনো কিওয়ার্ড ম্যাচ করেনি — Gemini AI ফলব্যাক উত্তর প্রস্তুত করবে।'
                    : 'No static keyword matched — Gemini AI fallback will draft a custom reply.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Active Rules */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সক্রিয় অটোমেশন রুলস' : 'Configured Automation Rules'}
            </h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">{rules.length} rules</span>
          </div>
          {rules.map((rule) => (
            <div key={rule.id} className="p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{rule.name}</span>
                  <ChannelLabel channel={rule.channel} />
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {rule.hitCount} hits
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{rule.replyTemplate}</p>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Keywords: {rule.keywords.join(', ')}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleRule(rule.id)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    rule.enabled
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {rule.enabled ? (lang === 'bn' ? 'চালু' : 'Active') : lang === 'bn' ? 'বন্ধ' : 'Paused'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete rule ${rule.name}`}
                  onClick={() => onDeleteRule(rule.id)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Meta Webhook Endpoint Info */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'WhatsApp & Messenger ওয়েবহুক এন্ডপয়েন্ট' : 'Meta WhatsApp & Messenger Webhook'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'Meta Developer Console-এ Callback URL হিসেবে নিচের সার্ভার এন্ডপয়েন্ট ব্যবহার করুন।'
              : 'Configure this verified Express endpoint as your Callback URL in Meta Developer Console.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'কপি' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
