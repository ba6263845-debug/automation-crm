import type { BusinessProfile, Language, OrderRecord } from '../types/crm';
import { formatCurrencyBDT } from './crmLogic';

export interface InvoiceTotals {
  lineSubtotal: number;
  vatAmount: number;
  grandTotal: number;
}

export function computeInvoiceTotals(order: OrderRecord, vatPercent: number): InvoiceTotals {
  const safeQty = Math.max(0, Number.isFinite(order.quantity) ? order.quantity : 0);
  const safeUnitPrice = Math.max(0, Number.isFinite(order.unitPrice) ? order.unitPrice : 0);
  const safeVat = Math.max(0, Number.isFinite(vatPercent) ? vatPercent : 0);
  const lineSubtotal = Math.round(safeQty * safeUnitPrice * 100) / 100;
  const vatAmount = Math.round((lineSubtotal * safeVat) / 100);
  const grandTotal = Math.max(0, Math.round((order.total + vatAmount) * 100) / 100);
  return { lineSubtotal, vatAmount, grandTotal };
}

export function escapeHtml(input: string | number | undefined | null): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPrintableInvoiceHtml(params: {
  order: OrderRecord;
  business: BusinessProfile;
  qrDataUrl: string;
  vatPercent: number;
  lang: Language;
}): string {
  const { order, business, qrDataUrl, vatPercent, lang } = params;
  const { lineSubtotal, vatAmount, grandTotal } = computeInvoiceTotals(order, vatPercent);
  const storeName = business.businessName || 'Automation CRM';
  const invoiceNo = `INV-${order.id}`;
  const formattedDate = new Date(order.createdAt).toLocaleDateString(
    lang === 'bn' ? 'bn-BD' : 'en-US'
  );

  const paymentLabel =
    order.paymentStatus === 'PAID'
      ? lang === 'bn'
        ? 'পরিশোধিত (PAID)'
        : 'PAID'
      : order.paymentStatus === 'PARTIAL'
        ? lang === 'bn'
          ? 'আংশিক পরিশোধ (PARTIAL)'
          : 'PARTIAL'
        : lang === 'bn'
          ? 'বকেয়া / COD (UNPAID)'
          : 'UNPAID';

  const paymentColor =
    order.paymentStatus === 'PAID'
      ? '#047857'
      : order.paymentStatus === 'PARTIAL'
        ? '#b45309'
        : '#475569';

  return `<!doctype html>
<html lang="${lang === 'bn' ? 'bn' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(invoiceNo)} — ${escapeHtml(storeName)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Plus Jakarta Sans', 'Noto Sans Bengali', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      background: #f8fafc;
    }
    .toolbar {
      max-width: 760px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .print-btn {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .sheet {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;
    }
    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4f46e5;
      margin: 0;
    }
    .store-name {
      font-size: 24px;
      font-weight: 800;
      margin: 4px 0 6px;
      color: #0f172a;
    }
    .muted {
      font-size: 12px;
      color: #475569;
      margin: 2px 0;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-variant-numeric: tabular-nums;
    }
    .inv-meta {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .inv-right { text-align: right; font-size: 12px; }
    .inv-id { font-size: 15px; font-weight: 700; margin: 0; }
    .qr-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px;
      background: #ffffff;
    }
    .qr-box img { display: block; width: 96px; height: 96px; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 22px;
      font-size: 12px;
    }
    .section-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      margin: 0 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 26px;
      font-size: 12px;
    }
    th {
      text-align: left;
      padding: 10px 12px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    td {
      padding: 14px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
    }
    .num { text-align: right; }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 22px;
    }
    .totals { width: 280px; font-size: 12px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      color: #475569;
    }
    .grand-row {
      display: flex;
      justify-content: space-between;
      padding-top: 10px;
      margin-top: 8px;
      border-top: 1px solid #cbd5e1;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer {
      margin-top: 34px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border: none; border-radius: 0; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print-btn" onclick="window.print()">
      ${lang === 'bn' ? 'প্রিন্ট করুন / PDF সেভ করুন' : 'Print / Save as PDF'}
    </button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <p class="eyebrow">${lang === 'bn' ? 'কমার্শিয়াল ট্যাক্স ইনভয়েস' : 'Commercial Invoice'}</p>
        <h1 class="store-name">${escapeHtml(storeName)}</h1>
        <p class="muted">${escapeHtml(business.businessAddress || 'Bangladesh')}</p>
        <p class="muted mono">${escapeHtml(business.phone)} · ${escapeHtml(business.email)}</p>
      </div>
      <div class="inv-meta">
        <div class="inv-right">
          <p class="inv-id mono">${escapeHtml(invoiceNo)}</p>
          <p class="muted mono">${escapeHtml(formattedDate)}</p>
          <p style="margin: 6px 0 0; font-weight: 700; color: ${paymentColor};">${escapeHtml(paymentLabel)}</p>
        </div>
        ${
          qrDataUrl
            ? `<div class="qr-box"><img src="${escapeHtml(qrDataUrl)}" alt="QR ${escapeHtml(invoiceNo)}" /></div>`
            : ''
        }
      </div>
    </div>

    <div class="grid-2">
      <div>
        <p class="section-label">${lang === 'bn' ? 'বিল প্রাপক (Bill To)' : 'Bill To'}</p>
        <p style="margin: 0; font-size: 14px; font-weight: 700;">${escapeHtml(order.customerName)}</p>
        <p class="muted mono">${escapeHtml(order.phone)}</p>
        <p class="muted">${escapeHtml(order.address || 'Bangladesh')}</p>
      </div>
      <div style="text-align: right;">
        <p class="section-label">${lang === 'bn' ? 'অর্ডার চ্যানেল ও নোট' : 'Channel & Reference'}</p>
        <p style="margin: 0; font-weight: 700;">${escapeHtml(order.channel)}</p>
        <p class="muted">${escapeHtml(order.notes || 'Standard Fulfillment')}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>${lang === 'bn' ? 'বিবরণ' : 'Description'}</th>
          <th class="num">${lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
          <th class="num">${lang === 'bn' ? 'একক মূল্য' : 'Unit Price'}</th>
          <th class="num">${lang === 'bn' ? 'মোট' : 'Amount'}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${escapeHtml(order.item)}</strong></td>
          <td class="num mono">${escapeHtml(order.quantity)}</td>
          <td class="num mono">${escapeHtml(formatCurrencyBDT(order.unitPrice))}</td>
          <td class="num mono"><strong>${escapeHtml(formatCurrencyBDT(lineSubtotal))}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        <div class="total-row">
          <span>${lang === 'bn' ? 'সাবটোটাল' : 'Subtotal'}</span>
          <span class="mono">${escapeHtml(formatCurrencyBDT(lineSubtotal))}</span>
        </div>
        <div class="total-row">
          <span>${lang === 'bn' ? 'ডেলিভারি চার্জ' : 'Delivery Fee'}</span>
          <span class="mono">${escapeHtml(formatCurrencyBDT(order.deliveryFee))}</span>
        </div>
        ${
          order.discount > 0
            ? `<div class="total-row" style="color: #047857;">
                <span>${lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}</span>
                <span class="mono">-${escapeHtml(formatCurrencyBDT(order.discount))}</span>
              </div>`
            : ''
        }
        ${
          vatAmount > 0
            ? `<div class="total-row">
                <span>VAT (${escapeHtml(vatPercent)}%)</span>
                <span class="mono">${escapeHtml(formatCurrencyBDT(vatAmount))}</span>
              </div>`
            : ''
        }
        <div class="grand-row">
          <span>${lang === 'bn' ? 'সর্বমোট প্রদেয়' : 'Grand Total'}</span>
          <span class="mono">${escapeHtml(formatCurrencyBDT(grandTotal))}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <span>${
        lang === 'bn'
          ? 'ডিজিটালভাবে ভেরিফায়েড QR ইনভয়েস — স্ক্যান করে অর্ডার স্ট্যাটাস যাচাই করুন'
          : 'Digitally verified QR commercial invoice — scan QR payload to audit order details'
      }</span>
      <span class="mono">${escapeHtml(storeName)} · ${escapeHtml(invoiceNo)}</span>
    </div>
  </div>
</body>
</html>`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function renderInvoiceToPngBlob(params: {
  order: OrderRecord;
  business: BusinessProfile;
  qrDataUrl: string;
  vatPercent: number;
  lang: Language;
}): Promise<Blob> {
  const { order, business, qrDataUrl, vatPercent, lang } = params;
  const { lineSubtotal, vatAmount, grandTotal } = computeInvoiceTotals(order, vatPercent);

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1480;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle outer invoice border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  const left = 96;
  const right = canvas.width - 96;

  // Header left
  ctx.fillStyle = '#4f46e5';
  ctx.font = 'bold 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(lang === 'bn' ? 'COMMERCIAL TAX INVOICE' : 'COMMERCIAL INVOICE', left, 128);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 40px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(business.businessName || 'Automation CRM', left, 178);

  ctx.fillStyle = '#475569';
  ctx.font = '22px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(business.businessAddress || 'Bangladesh', left, 218);
  ctx.fillText(`${business.phone} · ${business.email}`, left, 252);

  // QR Image on top right
  if (qrDataUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.strokeRect(right - 168, 102, 168, 168);
        ctx.drawImage(img, right - 158, 112, 148, 148);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = qrDataUrl;
    });
  }

  // Invoice ID & Date left of QR
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px ui-monospace, monospace';
  ctx.fillText(`INV-${order.id}`, right - 192, 140);

  ctx.fillStyle = '#64748b';
  ctx.font = '21px ui-monospace, monospace';
  ctx.fillText(new Date(order.createdAt).toLocaleDateString(), right - 192, 176);

  ctx.fillStyle =
    order.paymentStatus === 'PAID'
      ? '#047857'
      : order.paymentStatus === 'PARTIAL'
        ? '#b45309'
        : '#475569';
  ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(order.paymentStatus, right - 192, 214);
  ctx.textAlign = 'left';

  // Header divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 304);
  ctx.lineTo(right, 304);
  ctx.stroke();

  // Bill To & Channel
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(lang === 'bn' ? 'BILL TO' : 'BILL TO', left, 358);
  ctx.textAlign = 'right';
  ctx.fillText(lang === 'bn' ? 'CHANNEL & REFERENCE' : 'CHANNEL & REFERENCE', right, 358);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(order.customerName, left, 400);

  ctx.fillStyle = '#475569';
  ctx.font = '22px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(order.phone, left, 436);
  ctx.fillText(order.address || 'Bangladesh', left, 470);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(order.channel, right, 400);
  ctx.fillStyle = '#475569';
  ctx.font = '21px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(order.notes || 'Standard Fulfillment', right, 436);
  ctx.textAlign = 'left';

  // Table header
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(left, 540, right - left, 56);
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(left, 540);
  ctx.lineTo(right, 540);
  ctx.moveTo(left, 596);
  ctx.lineTo(right, 596);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ITEM DESCRIPTION', left + 16, 575);
  ctx.textAlign = 'right';
  ctx.fillText('QTY', right - 360, 575);
  ctx.fillText('UNIT PRICE', right - 180, 575);
  ctx.fillText('AMOUNT', right - 16, 575);
  ctx.textAlign = 'left';

  // Table row
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif';
  ctx.fillText(order.item.slice(0, 40), left + 16, 654);
  ctx.textAlign = 'right';
  ctx.font = '23px ui-monospace, monospace';
  ctx.fillText(String(order.quantity), right - 360, 654);
  ctx.fillText(formatCurrencyBDT(order.unitPrice), right - 180, 654);
  ctx.font = 'bold 23px ui-monospace, monospace';
  ctx.fillText(formatCurrencyBDT(lineSubtotal), right - 16, 654);
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(left, 692);
  ctx.lineTo(right, 692);
  ctx.stroke();

  // Totals block
  let y = 766;
  const labelX = right - 380;
  const drawTotalRow = (label: string, val: string, bold = false, color = '#475569') => {
    ctx.fillStyle = color;
    ctx.font = `${bold ? 'bold 28px' : '23px'} "Plus Jakarta Sans", "Noto Sans Bengali", system-ui, sans-serif`;
    ctx.fillText(label, labelX, y);
    ctx.textAlign = 'right';
    ctx.font = `${bold ? 'bold 28px' : '23px'} ui-monospace, monospace`;
    ctx.fillText(val, right - 16, y);
    ctx.textAlign = 'left';
    y += 46;
  };

  drawTotalRow(lang === 'bn' ? 'Subtotal' : 'Subtotal', formatCurrencyBDT(lineSubtotal));
  drawTotalRow(lang === 'bn' ? 'Delivery Fee' : 'Delivery Fee', formatCurrencyBDT(order.deliveryFee));
  if (order.discount > 0) {
    drawTotalRow('Discount', `-${formatCurrencyBDT(order.discount)}`, false, '#047857');
  }
  if (vatAmount > 0) {
    drawTotalRow(`VAT (${vatPercent}%)`, formatCurrencyBDT(vatAmount));
  }

  ctx.strokeStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(labelX, y - 16);
  ctx.lineTo(right, y - 16);
  ctx.stroke();
  y += 22;
  drawTotalRow('Grand Total', formatCurrencyBDT(grandTotal), true, '#0f172a');

  // Footer
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(left, 1340);
  ctx.lineTo(right, 1340);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '19px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Digitally verified QR commercial invoice — scan QR code to audit order details', left, 1384);
  ctx.textAlign = 'right';
  ctx.fillText(`${business.businessName || 'Automation CRM'} · INV-${order.id}`, right, 1384);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to render PNG invoice'));
    }, 'image/png');
  });
}

export type PrintAttemptResult = 'native-print-opened' | 'iframe-blocked-downloaded';

/**
 * Attempts native browser print (`window.print()`), listening for `beforeprint`.
 * Inside sandboxed iframes (e.g. embedded previews without `allow-modals`),
 * `window.print()` is silently suppressed and `beforeprint` never fires;
 * in that case we automatically download a standalone printable A4 HTML invoice.
 */
export function executeInvoicePrintWithFallback(params: {
  order: OrderRecord;
  business: BusinessProfile;
  qrDataUrl: string;
  vatPercent: number;
  lang: Language;
}): Promise<PrintAttemptResult> {
  return new Promise((resolve) => {
    let beforePrintFired = false;
    const onBeforePrint = () => {
      beforePrintFired = true;
    };

    window.addEventListener('beforeprint', onBeforePrint, { once: true });

    let printThrew = false;
    try {
      window.print();
    } catch {
      printThrew = true;
    }

    setTimeout(() => {
      window.removeEventListener('beforeprint', onBeforePrint);
      if (!printThrew && beforePrintFired) {
        resolve('native-print-opened');
        return;
      }

      const html = buildPrintableInvoiceHtml(params);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      triggerBlobDownload(blob, `INV-${params.order.id}.html`);
      resolve('iframe-blocked-downloaded');
    }, 350);
  });
}
