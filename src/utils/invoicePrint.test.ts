import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrintableInvoiceHtml,
  computeInvoiceTotals,
  escapeHtml,
} from './invoicePrint';
import type { BusinessProfile, OrderRecord } from '../types/crm';

const sampleOrder: OrderRecord = {
  id: 'ORD-901',
  uid: 'demo',
  customerName: 'Nusrat <VIP> & Co',
  phone: '01819887766',
  channel: 'MESSENGER',
  item: 'ANC Wireless Earbuds Pro',
  quantity: 2,
  unitPrice: 1850,
  deliveryFee: 120,
  discount: 100,
  total: 3720,
  status: 'CONFIRMED',
  paymentStatus: 'PARTIAL',
  address: 'GEC Circle, Chattogram',
  notes: 'Cash on delivery',
  createdAt: '2026-11-16T09:05:00.000Z',
  updatedAt: '2026-11-16T09:05:00.000Z',
};

const sampleBusiness: BusinessProfile = {
  displayName: 'Arif Mahmud',
  businessName: 'Dhaka Horizon Commerce',
  email: 'orders@dhakahorizon.com',
  phone: '+8801711009988',
  businessAddress: 'Dhanmondi, Dhaka',
};

test('computeInvoiceTotals calculates subtotal, VAT, and grand total accurately', () => {
  const noVat = computeInvoiceTotals(sampleOrder, 0);
  assert.equal(noVat.lineSubtotal, 3700);
  assert.equal(noVat.vatAmount, 0);
  assert.equal(noVat.grandTotal, 3720);

  const vat15 = computeInvoiceTotals(sampleOrder, 15);
  assert.equal(vat15.lineSubtotal, 3700);
  assert.equal(vat15.vatAmount, 555);
  assert.equal(vat15.grandTotal, 4275);
});

test('escapeHtml safely escapes HTML special characters', () => {
  assert.equal(escapeHtml('<script>"alert"&\'x\'</script>'), '&lt;script&gt;&quot;alert&quot;&amp;&#39;x&#39;&lt;/script&gt;');
});

test('buildPrintableInvoiceHtml renders complete self-contained printable invoice with escaped fields and QR', () => {
  const html = buildPrintableInvoiceHtml({
    order: sampleOrder,
    business: sampleBusiness,
    qrDataUrl: 'data:image/png;base64,FAKEQR',
    vatPercent: 5,
    lang: 'bn',
  });
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('INV-ORD-901'));
  assert.ok(html.includes('Dhaka Horizon Commerce'));
  assert.ok(html.includes('Nusrat &lt;VIP&gt; &amp; Co'));
  assert.ok(html.includes('data:image/png;base64,FAKEQR'));
  assert.ok(html.includes('VAT (5%)'));
  assert.ok(html.includes('window.print()'));
  assert.ok(html.includes('@media print'));
});
