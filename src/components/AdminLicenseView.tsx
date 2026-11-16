import React, { useEffect, useState } from 'react';
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { AdminLicenseRecord, Language, LicenseTier } from '../types/crm';

interface AdminLicenseViewProps {
  lang: Language;
  adminEmail: string;
}

export const AdminLicenseView: React.FC<AdminLicenseViewProps> = ({ lang, adminEmail }) => {
  const [licenses, setLicenses] = useState<AdminLicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [latestCreatedKey, setLatestCreatedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tier, setTier] = useState<LicenseTier>('GROWTH');
  const [validDays, setValidDays] = useState(365);

  const loadLicenses = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/licenses');
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load licenses');
        return;
      }
      setLicenses(Array.isArray(data.licenses) ? data.licenses : []);
    } catch {
      setErrorMsg(lang === 'bn' ? 'লাইসেন্স তালিকা লোড করা যায়নি।' : 'Unable to load licenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setLatestCreatedKey(null);
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerEmail,
          tier,
          validDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not generate license');
        return;
      }
      const created = data.license as AdminLicenseRecord;
      setLicenses((prev) => [created, ...prev]);
      setLatestCreatedKey(created.licenseKey);
      setCustomerName('');
      setCustomerEmail('');
    } catch {
      setErrorMsg(lang === 'bn' ? 'লাইসেন্স তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate license.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (record: AdminLicenseRecord) => {
    const nextStatus = record.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/licenses/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setLicenses((prev) => prev.map((l) => (l.id === record.id ? data.license : l)));
    } catch {
      // ignore transient
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLicenses((prev) => prev.filter((l) => l.id !== id));
      }
    } catch {
      // ignore transient
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const filtered = licenses.filter((l) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      l.customerName.toLowerCase().includes(q) ||
      l.customerEmail.toLowerCase().includes(q) ||
      l.licenseKey.toLowerCase().includes(q)
    );
  });

  const activeCount = licenses.filter((l) => l.status === 'ACTIVE').length;
  const revokedCount = licenses.filter((l) => l.status === 'REVOKED').length;

  return (
    <div className="space-y-6">
      {/* Admin-Only License Bar Summary */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? 'এডমিন লাইসেন্স ম্যানেজার ও জেনারেটর' : 'Admin License Manager & Key Studio'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  Admin Only
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {lang === 'bn'
                  ? `লগইনকৃত এডমিন: ${adminEmail} — শুধুমাত্র আপনিই নতুন লাইসেন্স কী তৈরি বা বাতিল করতে পারবেন।`
                  : `Signed in as Admin (${adminEmail}) — license creation and revocation are strictly hidden from customers.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div>
              <p className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'মোট লাইসেন্স' : 'Total'}</p>
              <p className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {licenses.length}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'সক্রিয়' : 'Active'}</p>
              <p className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {activeCount}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'বাতিল' : 'Revoked'}</p>
              <p className="font-mono text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {revokedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Create License Key Form */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'নতুন লাইসেন্স কী তৈরি করুন' : 'Issue New Commercial License Key'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'ক্রেতার ব্যবসা ও প্যাকেজ অনুযায়ী এনক্রিপ্টেড কী জেনারেট করুন।'
              : 'Generate a cryptographic key bound to a client business and subscription tier.'}
          </p>

          <form onSubmit={handleCreateLicense} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="lic-cust-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {lang === 'bn' ? 'গ্রাহক / প্রতিষ্ঠানের নাম *' : 'Client / Business Name *'}
              </label>
              <input
                id="lic-cust-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Padma Style House"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="lic-cust-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {lang === 'bn' ? 'গ্রাহকের ইমেইল (ঐচ্ছিক)' : 'Client Email (Optional)'}
              </label>
              <input
                id="lic-cust-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="owner@clientstore.bd"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="lic-tier"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {lang === 'bn' ? 'প্যাকেজ টিয়ার' : 'License Tier'}
                </label>
                <select
                  id="lic-tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as LicenseTier)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="STARTER">STARTER</option>
                  <option value="GROWTH">GROWTH</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="lic-days"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  {lang === 'bn' ? 'মেয়াদ (দিন)' : 'Validity (Days)'}
                </label>
                <input
                  id="lic-days"
                  type="number"
                  min={1}
                  max={3650}
                  required
                  value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? lang === 'bn'
                    ? 'তৈরি হচ্ছে...'
                    : 'Generating...'
                  : lang === 'bn'
                    ? 'নতুন লাইসেন্স কী তৈরি করুন'
                    : 'Generate License Key'}
              </span>
            </button>
          </form>

          {latestCreatedKey && (
            <div className="mt-5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3.5">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {lang === 'bn' ? 'নতুন লাইসেন্স কী প্রস্তুত:' : 'Newly Issued License Key:'}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <code className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all">
                  {latestCreatedKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyKey(latestCreatedKey)}
                  aria-label="Copy generated license key"
                  className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 shrink-0"
                >
                  {copiedKey === latestCreatedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Issued Licenses Table */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'ইস্যুকৃত লাইসেন্স রেজিস্ট্রি' : 'Issued License Registry'}
            </h3>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'bn' ? 'নাম বা কী খুঁজুন...' : 'Search client or key...'}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-xs text-slate-500">
              {lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading registry...'}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'এখনো কোনো লাইসেন্স তৈরি করা হয়নি। বাম দিকের ফর্ম থেকে তৈরি করুন।'
                : 'No licenses issued yet. Create one using the generator form.'}
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pr-3">{lang === 'bn' ? 'গ্রাহক' : 'Client'}</th>
                    <th className="py-2.5 px-3">{lang === 'bn' ? 'লাইসেন্স কী' : 'License Key'}</th>
                    <th className="py-2.5 px-3">{lang === 'bn' ? 'প্যাকেজ' : 'Tier'}</th>
                    <th className="py-2.5 px-3">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                    <th className="py-2.5 pl-3 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((lic) => (
                    <tr key={lic.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{lic.customerName}</p>
                        {lic.customerEmail && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{lic.customerEmail}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {lic.licenseKey}
                      </td>
                      <td className="py-3 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                        {lic.tier}
                        <span className="block text-[10px] font-normal text-slate-500">
                          {lic.validDays}d
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            lic.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {lic.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyKey(lic.licenseKey)}
                            aria-label={`Copy ${lic.licenseKey}`}
                            title="Copy Key"
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {copiedKey === lic.licenseKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lic)}
                            aria-label={lic.status === 'ACTIVE' ? `Revoke ${lic.licenseKey}` : `Activate ${lic.licenseKey}`}
                            title={lic.status === 'ACTIVE' ? 'Revoke' : 'Reactivate'}
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {lic.status === 'ACTIVE' ? (
                              <Ban className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(lic.id)}
                            aria-label={`Delete ${lic.licenseKey}`}
                            title="Delete"
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
