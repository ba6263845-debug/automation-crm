import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInvoiceQrPayload,
  calculateOrderTotal,
  computeAdvancedAnalytics,
  computeWorkspaceMetrics,
  exportOrdersToCsv,
  extractQuickOrderFromText,
  extractRegionFromAddress,
  getNextOrderStatus,
  matchAutomationRule,
  validateOrderInput,
} from './crmLogic';
import type { AutomationRule, ConversationThread, OrderRecord } from '../types/crm';

const sampleOrders: OrderRecord[] = [
  {
    id: 'ord-101',
    uid: 'demo',
    customerName: 'Rafiqul Islam',
    phone: '01711223344',
    channel: 'WHATSAPP',
    item: 'Smart Watch Ultra',
    quantity: 2,
    unitPrice: 2400,
    deliveryFee: 60,
    discount: 100,
    total: 4760,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    address: 'Dhanmondi, Dhaka',
    notes: '',
    createdAt: '2026-11-16T08:00:00.000Z',
    updatedAt: '2026-11-16T08:00:00.000Z',
  },
  {
    id: 'ord-102',
    uid: 'demo',
    customerName: 'Nusrat Jahan',
    phone: '01811223344',
    channel: 'MESSENGER',
    item: 'Wireless Earbuds Pro',
    quantity: 1,
    unitPrice: 1850,
    deliveryFee: 120,
    discount: 0,
    total: 1970,
    status: 'PENDING',
    paymentStatus: 'UNPAID',
    address: 'Agrabad, Chattogram',
    notes: '',
    createdAt: '2026-11-16T09:00:00.000Z',
    updatedAt: '2026-11-16T09:00:00.000Z',
  },
  {
    id: 'ord-103',
    uid: 'demo',
    customerName: 'Cancelled Buyer',
    phone: '01911223344',
    channel: 'GMAIL',
    item: 'USB Hub',
    quantity: 1,
    unitPrice: 900,
    deliveryFee: 60,
    discount: 0,
    total: 960,
    status: 'CANCELLED',
    paymentStatus: 'UNPAID',
    address: 'Sylhet',
    notes: '',
    createdAt: '2026-11-16T09:30:00.000Z',
    updatedAt: '2026-11-16T09:30:00.000Z',
  },
];

const sampleRules: AutomationRule[] = [
  {
    id: 'r-all',
    uid: 'demo',
    name: 'Global Delivery Policy',
    channel: 'ALL',
    keywords: ['delivery', 'ডেলিভারি', 'চার্জ'],
    replyTemplate: 'ঢাকায় ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা ডেলিভারি চার্জ।',
    autoExtractOrder: false,
    enabled: true,
    hitCount: 12,
    createdAt: '2026-11-16T07:00:00.000Z',
    updatedAt: '2026-11-16T07:00:00.000Z',
  },
  {
    id: 'r-wa',
    uid: 'demo',
    name: 'WhatsApp Fast Price',
    channel: 'WHATSAPP',
    keywords: ['দাম', 'price', 'ডেলিভারি'],
    replyTemplate: 'আমাদের পণ্যের দাম ও অফার তালিকা WhatsApp-এ পাঠানো হলো।',
    autoExtractOrder: true,
    enabled: true,
    hitCount: 25,
    createdAt: '2026-11-16T07:00:00.000Z',
    updatedAt: '2026-11-16T07:00:00.000Z',
  },
];

const sampleChats: ConversationThread[] = [
  {
    id: 'chat-1',
    customerName: 'Rafiqul Islam',
    handle: '+8801711223344',
    channel: 'WHATSAPP',
    unreadCount: 2,
    autoReplyEnabled: true,
    lastActivity: '10:15 AM',
    intentTag: 'Order Inquiry',
    messages: [],
  },
];

test('calculateOrderTotal computes exact subtotal + delivery - discount without negative totals', () => {
  assert.equal(calculateOrderTotal(2400, 2, 60, 100), 4760);
  assert.equal(calculateOrderTotal(500, 1, 0, 1000), 0);
  assert.equal(calculateOrderTotal(100, 0, 50, 0), 50);
});

test('validateOrderInput rejects empty or invalid payloads and accepts valid ones', () => {
  const invalid = validateOrderInput(
    {
      customerName: '',
      phone: '12',
      channel: 'WHATSAPP',
      item: '',
      quantity: 0,
      unitPrice: -10,
      deliveryFee: 0,
      discount: 0,
    },
    'en'
  );
  assert.ok(invalid.customerName);
  assert.ok(invalid.phone);
  assert.ok(invalid.item);
  assert.ok(invalid.quantity);
  assert.ok(invalid.unitPrice);

  const valid = validateOrderInput(
    {
      customerName: 'Tariq Hasan',
      phone: '01712345678',
      channel: 'WHATSAPP',
      item: 'Leather Wallet',
      quantity: 2,
      unitPrice: 850,
      deliveryFee: 60,
      discount: 0,
    },
    'bn'
  );
  assert.deepEqual(valid, {});
});

test('computeWorkspaceMetrics excludes cancelled orders from revenue and counts channels', () => {
  const m = computeWorkspaceMetrics(sampleOrders, sampleChats, sampleRules);
  assert.equal(m.totalOrders, 3);
  assert.equal(m.activeOrdersCount, 2);
  assert.equal(m.totalRevenue, 6730);
  assert.equal(m.paidRevenue, 4760);
  assert.equal(m.pendingCount, 1);
  assert.equal(m.unreadMessages, 2);
  assert.equal(m.totalAutoHits, 37);
  assert.equal(m.byChannel.WHATSAPP.orders, 1);
  assert.equal(m.byChannel.MESSENGER.orders, 1);
  assert.equal(m.byChannel.GMAIL.orders, 0);
});

test('matchAutomationRule prioritizes channel-specific rules over ALL-channel rules', () => {
  const waMatch = matchAutomationRule('ভাই ডেলিভারি চার্জ কত?', 'WHATSAPP', sampleRules);
  assert.equal(waMatch?.id, 'r-wa');

  const msgMatch = matchAutomationRule('ডেলিভারি চার্জ কত?', 'MESSENGER', sampleRules);
  assert.equal(msgMatch?.id, 'r-all');

  const noMatch = matchAutomationRule('Good morning', 'GMAIL', sampleRules);
  assert.equal(noMatch, null);
});

test('extractQuickOrderFromText parses Bengali order intent, quantity, and BD phone number', () => {
  const parsed = extractQuickOrderFromText('Smart Watch 2 পিস অর্ডার করতে চাই 01712345678');
  assert.ok(parsed);
  assert.equal(parsed?.quantity, 2);
  assert.equal(parsed?.phone, '01712345678');
});

test('exportOrdersToCsv produces UTF-8 BOM CSV with escaped quotes', () => {
  const csv = exportOrdersToCsv(sampleOrders);
  assert.ok(csv.startsWith('\uFEFFOrder ID,Customer Name'));
  assert.ok(csv.includes('ord-101,Rafiqul Islam'));
  assert.ok(csv.includes('"Agrabad, Chattogram"'));
});

test('buildInvoiceQrPayload produces deterministic structured invoice payload', () => {
  const qr = JSON.parse(buildInvoiceQrPayload(sampleOrders[0], 'Dhaka Gadgets'));
  assert.equal(qr.inv, 'INV-ORD-101');
  assert.equal(qr.total, 4760);
  assert.equal(qr.merchant, 'Dhaka Gadgets');
});

test('computeAdvancedAnalytics filters by channel/search and computes AOV, collection rate, and pipeline', () => {
  const allStats = computeAdvancedAnalytics(sampleOrders, 'ALL', '');
  assert.equal(allStats.activeOrdersCount, 2);
  assert.equal(allStats.totalUnitsSold, 3);
  assert.equal(allStats.totalRevenue, 6730);
  assert.equal(allStats.paidRevenue, 4760);
  assert.equal(allStats.unpaidBalance, 1970);
  assert.equal(allStats.totalDeliveryFees, 180);
  assert.equal(allStats.totalDiscounts, 100);
  assert.equal(allStats.collectionRatePct, 71);
  assert.equal(allStats.averageOrderValue, 3365);
  assert.equal(allStats.pipeline.CONFIRMED, 1);
  assert.equal(allStats.pipeline.PENDING, 1);
  assert.equal(allStats.pipeline.CANCELLED, 1);
  assert.equal(allStats.paymentBreakdown.paidCount, 1);
  assert.equal(allStats.paymentBreakdown.paidAmount, 4760);
  assert.equal(allStats.paymentBreakdown.unpaidCount, 1);
  assert.equal(allStats.paymentBreakdown.unpaidAmount, 1970);
  assert.equal(allStats.paymentBreakdown.cancelledCount, 1);
  assert.equal(allStats.paymentBreakdown.cancelledAmount, 960);
  assert.equal(allStats.unpaidActiveCount, 1);
  assert.equal(allStats.topItems[0].item, 'Smart Watch Ultra');
  assert.equal(allStats.topLocations.length, 2);

  const waOnly = computeAdvancedAnalytics(sampleOrders, 'WHATSAPP', '');
  assert.equal(waOnly.filteredOrders.length, 1);
  assert.equal(waOnly.totalRevenue, 4760);
  assert.equal(waOnly.collectionRatePct, 100);

  const searchOnly = computeAdvancedAnalytics(sampleOrders, 'ALL', 'Nusrat');
  assert.equal(searchOnly.filteredOrders.length, 1);
  assert.equal(searchOnly.filteredOrders[0].id, 'ord-102');

  const addressSearch = computeAdvancedAnalytics(sampleOrders, 'ALL', 'Chattogram');
  assert.equal(addressSearch.filteredOrders.length, 1);
  assert.equal(addressSearch.filteredOrders[0].id, 'ord-102');
});

test('extractRegionFromAddress extracts city/region cleanly from customer addresses', () => {
  assert.equal(extractRegionFromAddress('Dhanmondi, Dhaka'), 'Dhaka');
  assert.equal(extractRegionFromAddress('Sylhet'), 'Sylhet');
  assert.equal(extractRegionFromAddress(''), 'Dhaka / Local');
});

test('getNextOrderStatus advances pending -> confirmed -> shipped -> delivered', () => {
  assert.equal(getNextOrderStatus('PENDING'), 'CONFIRMED');
  assert.equal(getNextOrderStatus('CONFIRMED'), 'SHIPPED');
  assert.equal(getNextOrderStatus('SHIPPED'), 'DELIVERED');
  assert.equal(getNextOrderStatus('DELIVERED'), null);
  assert.equal(getNextOrderStatus('CANCELLED'), null);
});
