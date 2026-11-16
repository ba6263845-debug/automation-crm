import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Download, FileText, Printer, QrCode } from 'lucide-react';
import type { BusinessProfile, Language, OrderRecord } from '../types/crm';
import { buildInvoiceQrPayload, formatCurrencyBDT } from '../utils/crmLogic';
import {
  buildPrintableInvoiceHtml,
  computeInvoiceTotals,
  executeInvoicePrintWithFallback,
  renderInvoiceToPngBlob,
  triggerBlobDownload,
} from '../utils/invoicePrint';
import { PaymentStatusLabel } from './ChannelTag';

interface InvoiceStudioViewProps {
  lang: Language;
  orders: OrderRecord[];
  selectedOrderId: string;
  business: BusinessProfile;
  onSelectOrder: (orderId: string) => void;
  onUpdateOrder: (order: OrderRecord) => void;
}

export const InvoiceStudioView: React.FC<InvoiceStudioViewProps> = ({
  lang,
  orders,
  selectedOrderId,
  business,
  onSelectOrder,
  onUpdateOrder,
}) => {
  const activeOrder = orders.find((o) => o.id === selectedOrderId) ?? orders[0] ?? null;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [vatPercent, setVatPercent] = useState<number>(0);
  const [printing, setPrinting] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<{
    type: 'info' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!activeOrder) {
      setQrDataUrl('');
      return;
    }
    const payload = buildInvoiceQrPayload(activeOrder, business.businessName);
    QRCode.toDataURL(payload, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [activeOrder, business.businessName]);

  if (!activeOrder) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500">
        {lang === 'bn'
          ? 'ইনভয়েস তৈরি করার জন্য প্রথমে একটি অর্ডার যোগ করুন।'
          : 'Add an order in the Orders Sheet to generate a commercial QR invoice.'}
      </div>
    );
  }

  const { lineSubtotal, vatAmount, grandTotal } = computeInvoiceTotals(activeOrder, vatPercent);

  const handleSmartPrint = async () => {
    if (printing) return;
    setPrinting(true);
    setPrintFeedback(null);
    try {
      const result = await executeInvoicePrintWithFallback({
        order: activeOrder,
        business,
        qrDataUrl,
        vatPercent,
        lang,
      });

      if (result === 'native-print-opened') {
        setPrintFeedback({
          type: 'success',
          text:
            lang === 'bn'
              ? `ইনভয়েস INV-${activeOrder.id} প্রিন্ট / PDF ডায়ালগ খোলা হয়েছে।`
              : `Print / Save PDF dialog opened for INV-${activeOrder.id}.`,
        });
      } else {
        setPrintFeedback({
          type: 'info',
          text:
            lang === 'bn'
              ? `প্রিভিউ ফ্রেম ব্রাউজার প্রিন্ট ডায়ালগ ব্লক করায় প্রিন্টেবল ইনভয়েস (INV-${activeOrder.id}.html) ডাউনলোড করা হয়েছে। ফাইলটি ব্রাউজারে ওপেন করে প্রিন্ট করুন অথবা PNG সেভ করুন।`
              : `Preview frame blocked the browser print dialog, so printable invoice INV-${activeOrder.id}.html was downloaded automatically. Open it in a tab to print/save PDF, or export PNG.`,
        });
      }
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPrintableHtml = () => {
    const html = buildPrintableInvoiceHtml({
      order: activeOrder,
      business,
      qrDataUrl,
      vatPercent,
      lang,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    triggerBlobDownload(blob, `INV-${activeOrder.id}.html`);
    setPrintFeedback({
      type: 'success',
      text:
        lang === 'bn'
          ? `প্রিন্টেবল ইনভয়েস INV-${activeOrder.id}.html ডাউনলোড হয়েছে।`
          : `Downloaded printable invoice INV-${activeOrder.id}.html.`,
    });
  };

  const handleDownloadPng = async () => {
    if (exportingPng) return;
    setExportingPng(true);
    try {
      const blob = await renderInvoiceToPngBlob({
        order: activeOrder,
        business,
        qrDataUrl,
        vatPercent,
        lang,
      });
      triggerBlobDownload(blob, `INV-${activeOrder.id}.png`);
      setPrintFeedback({
        type: 'success',
        text:
          lang === 'bn'
            ? `হাই-রেজ ইনভয়েস ইমেজ INV-${activeOrder.id}.png ডাউনলোড হয়েছে।`
            : `Downloaded high-resolution invoice image INV-${activeOrder.id}.png.`,
      });
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Control Bar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="inv-order-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {lang === 'bn' ? 'অর্ডার নির্বাচন করুন:' : 'Select Order:'}
          </label>
          <select
            id="inv-order-select"
            value={activeOrder.id}
            onChange={(e) => {
              onSelectOrder(e.target.value);
              setPrintFeedback(null);
            }}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
          >
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} — {o.customerName} ({formatCurrencyBDT(o.total)})
              </option>
            ))}
          </select>

          <label htmlFor="inv-vat-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-2">
            VAT %:
          </label>
          <select
            id="inv-vat-select"
            value={vatPercent}
            onChange={(e) => setVatPercent(Number(e.target.value))}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
          >
            <option value={0}>0%</option>
            <option value={5}>5%</option>
            <option value={7.5}>7.5%</option>
            <option value={15}>15%</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeOrder.paymentStatus !== 'PAID' && (
            <button
              type="button"
              onClick={() =>
                onUpdateOrder({
                  ...activeOrder,
                  paymentStatus: 'PAID',
                  updatedAt: new Date().toISOString(),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'bn' ? 'পরিশোধিত মার্ক করুন' : 'Mark as Paid'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={exportingPng}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'bn' ? 'ছবি সেভ (PNG)' : 'Save PNG'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPrintableHtml}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'bn' ? 'প্রিন্ট ফাইল (HTML)' : 'Printable HTML'}</span>
          </button>
          <button
            type="button"
            onClick={handleSmartPrint}
            disabled={printing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {printing
                ? lang === 'bn'
                  ? 'প্রস্তুত হচ্ছে...'
                  : 'Preparing...'
                : lang === 'bn'
                  ? 'প্রিন্ট / PDF সেভ'
                  : 'Print / Save PDF'}
            </span>
          </button>
        </div>
      </div>

      {printFeedback && (
        <div
          role="status"
          className={`no-print rounded-xl border px-4 py-3 text-xs font-medium ${
            printFeedback.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
              : 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200'
          }`}
        >
          {printFeedback.text}
        </div>
      )}

      {/* Printable Commercial Invoice Sheet */}
      <div className="print-only-area mx-auto max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-8 sm:p-10 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {lang === 'bn' ? 'কমার্শিয়াল ট্যাক্স ইনভয়েস' : 'Commercial Invoice'}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              {business.businessName || 'Automation CRM'}
            </h2>
            <p className="mt-1 text-xs text-slate-600">{business.businessAddress}</p>
            <p className="mt-0.5 text-xs text-slate-600 font-mono">
              {business.phone} · {business.email}
            </p>
          </div>

          <div className="flex items-start gap-4">
            <div className="text-right text-xs">
              <p className="font-mono text-sm font-bold text-slate-900">INV-{activeOrder.id}</p>
              <p className="mt-1 text-slate-500 font-mono">
                {new Date(activeOrder.createdAt).toLocaleDateString()}
              </p>
              <div className="mt-2">
                <PaymentStatusLabel status={activeOrder.paymentStatus} lang={lang} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-1.5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR verification code for invoice INV-${activeOrder.id}`}
                  className="h-24 w-24"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center bg-slate-50 text-slate-400">
                  <QrCode className="w-8 h-8" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'bn' ? 'বিল প্রাপক (Bill To)' : 'Bill To'}
            </p>
            <p className="mt-1.5 text-sm font-bold text-slate-900">{activeOrder.customerName}</p>
            <p className="mt-0.5 font-mono text-slate-600">{activeOrder.phone}</p>
            <p className="mt-0.5 text-slate-600">{activeOrder.address || 'Bangladesh'}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'bn' ? 'অর্ডার চ্যানেল ও নোট' : 'Channel & Reference'}
            </p>
            <p className="mt-1.5 font-semibold text-slate-800">{activeOrder.channel}</p>
            <p className="mt-0.5 text-slate-600">{activeOrder.notes || 'Standard Fulfillment'}</p>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-3">{lang === 'bn' ? 'বিবরণ' : 'Description'}</th>
                <th className="py-3 px-3 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                <th className="py-3 px-3 text-right">{lang === 'bn' ? 'একক মূল্য' : 'Unit Price'}</th>
                <th className="py-3 px-3 text-right">{lang === 'bn' ? 'মোট' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-4 px-3 font-medium text-slate-900">{activeOrder.item}</td>
                <td className="py-4 px-3 text-right font-mono tabular-nums">{activeOrder.quantity}</td>
                <td className="py-4 px-3 text-right font-mono tabular-nums">
                  {formatCurrencyBDT(activeOrder.unitPrice)}
                </td>
                <td className="py-4 px-3 text-right font-mono font-semibold tabular-nums">
                  {formatCurrencyBDT(lineSubtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{lang === 'bn' ? 'সাবটোটাল' : 'Subtotal'}</span>
              <span className="font-mono tabular-nums">{formatCurrencyBDT(lineSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{lang === 'bn' ? 'ডেলিভারি চার্জ' : 'Delivery Fee'}</span>
              <span className="font-mono tabular-nums">{formatCurrencyBDT(activeOrder.deliveryFee)}</span>
            </div>
            {activeOrder.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>{lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}</span>
                <span className="font-mono tabular-nums">-{formatCurrencyBDT(activeOrder.discount)}</span>
              </div>
            )}
            {vatAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>VAT ({vatPercent}%)</span>
                <span className="font-mono tabular-nums">{formatCurrencyBDT(vatAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2.5 text-sm font-bold text-slate-900">
              <span>{lang === 'bn' ? 'সর্বমোট প্রদেয়' : 'Grand Total'}</span>
              <span className="font-mono tabular-nums">{formatCurrencyBDT(grandTotal)}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {lang === 'bn'
              ? 'ডিজিটালভাবে ভেরিফায়েড QR ইনভয়েস — স্ক্যান করে অর্ডার স্ট্যাটাস যাচাই করুন'
              : 'Digitally verified QR commercial invoice — scan QR payload to audit order details'}
          </span>
          <span className="font-mono">
            {business.businessName || 'Automation CRM'} · INV-{activeOrder.id}
          </span>
        </div>
      </div>
    </div>
  );
};
