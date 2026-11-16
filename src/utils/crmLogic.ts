import type {
  AutomationRule,
  ChannelType,
  ConversationThread,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
} from '../types/crm';

export interface OrderInput {
  customerName: string;
  phone: string;
  channel: ChannelType;
  item: string;
  quantity: number;
  unitPrice: number;
  deliveryFee: number;
  discount: number;
  address?: string;
  notes?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
}

export interface OrderValidationErrors {
  customerName?: string;
  phone?: string;
  item?: string;
  quantity?: string;
  unitPrice?: string;
  deliveryFee?: string;
  discount?: string;
}

export function calculateOrderTotal(
  unitPrice: number,
  quantity: number,
  deliveryFee: number = 0,
  discount: number = 0
): number {
  const safeQty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  const safePrice = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);
  const safeDelivery = Math.max(0, Number.isFinite(deliveryFee) ? deliveryFee : 0);
  const safeDiscount = Math.max(0, Number.isFinite(discount) ? discount : 0);
  const subtotal = safeQty * safePrice + safeDelivery;
  return Math.max(0, Math.round((subtotal - safeDiscount) * 100) / 100);
}

export function validateOrderInput(input: OrderInput, lang: 'bn' | 'en' = 'en'): OrderValidationErrors {
  const errors: OrderValidationErrors = {};
  if (!input.customerName || input.customerName.trim().length < 2) {
    errors.customerName =
      lang === 'bn' ? 'ক্রেতার নাম কমপক্ষে ২ অক্ষরের হতে হবে' : 'Customer name must be at least 2 characters';
  }
  const cleanPhone = (input.phone || '').replace(/[\s\-()]/g, '');
  if (!cleanPhone || cleanPhone.length < 6 || cleanPhone.length > 20 || !/^\+?[0-9]+$/.test(cleanPhone)) {
    errors.phone =
      lang === 'bn' ? 'সঠিক মোবাইল নম্বর দিন (৬-২০ ডিজিট)' : 'Enter a valid phone number (6-20 digits)';
  }
  if (!input.item || input.item.trim().length < 2) {
    errors.item = lang === 'bn' ? 'পণ্যের নাম লিখুন' : 'Product item name is required';
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 10000) {
    errors.quantity = lang === 'bn' ? 'পরিমাণ ১ থেকে ১০,০০০ এর মধ্যে হতে হবে' : 'Quantity must be between 1 and 10,000';
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
    errors.unitPrice = lang === 'bn' ? 'একক মূল্য ০ বা তার বেশি হতে হবে' : 'Unit price must be 0 or greater';
  }
  if (!Number.isFinite(input.deliveryFee) || input.deliveryFee < 0) {
    errors.deliveryFee = lang === 'bn' ? 'ডেলিভারি চার্জ ঋণাত্মক হতে পারবে না' : 'Delivery fee cannot be negative';
  }
  if (!Number.isFinite(input.discount) || input.discount < 0) {
    errors.discount = lang === 'bn' ? 'ডিসকাউন্ট ঋণাত্মক হতে পারবে না' : 'Discount cannot be negative';
  }
  return errors;
}

export function computeWorkspaceMetrics(
  orders: OrderRecord[],
  conversations: ConversationThread[],
  rules: AutomationRule[]
) {
  const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
  const totalRevenue = activeOrders.reduce((acc, o) => acc + o.total, 0);
  const paidRevenue = activeOrders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((acc, o) => acc + o.total, 0);
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;
  const unreadMessages = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const totalAutoHits = rules.reduce((acc, r) => acc + r.hitCount, 0);
  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const byChannel: Record<ChannelType, { orders: number; revenue: number; chats: number }> = {
    WHATSAPP: { orders: 0, revenue: 0, chats: 0 },
    MESSENGER: { orders: 0, revenue: 0, chats: 0 },
    GMAIL: { orders: 0, revenue: 0, chats: 0 },
  };

  for (const ord of activeOrders) {
    byChannel[ord.channel].orders += 1;
    byChannel[ord.channel].revenue += ord.total;
  }
  for (const conv of conversations) {
    byChannel[conv.channel].chats += 1;
  }

  return {
    totalOrders: orders.length,
    activeOrdersCount: activeOrders.length,
    totalRevenue,
    paidRevenue,
    pendingCount,
    deliveredCount,
    unreadMessages,
    totalAutoHits,
    activeRulesCount,
    byChannel,
  };
}

export function matchAutomationRule(
  messageText: string,
  channel: ChannelType,
  rules: AutomationRule[]
): AutomationRule | null {
  const normalized = messageText.trim().toLowerCase();
  if (!normalized) return null;

  // Prefer channel-specific rules over ALL-channel rules
  const sortedRules = [...rules]
    .filter((r) => r.enabled && (r.channel === channel || r.channel === 'ALL'))
    .sort((a, b) => {
      if (a.channel === channel && b.channel !== channel) return -1;
      if (b.channel === channel && a.channel !== channel) return 1;
      return b.keywords.length - a.keywords.length;
    });

  for (const rule of sortedRules) {
    const matched = rule.keywords.some((kw) => {
      const cleanKw = kw.trim().toLowerCase();
      return cleanKw.length > 0 && normalized.includes(cleanKw);
    });
    if (matched) return rule;
  }
  return null;
}

export function extractQuickOrderFromText(text: string): {
  item: string;
  quantity: number;
  phone: string;
} | null {
  const clean = text.trim();
  if (!clean) return null;

  const phoneMatch = clean.match(/(?:\+?88)?01[3-9][0-9]{8}/);
  const qtyMatch = clean.match(/(\d{1,3})\s*(?:pcs|pc|টি|পিস|টা|units?)/i);
  const hasOrderIntent = /(order|অর্ডার|নিব|নিতে চাই|কিনব|পাঠান|confirm|book)/i.test(clean);

  if (!hasOrderIntent && !phoneMatch) return null;

  const quantity = qtyMatch ? Math.max(1, Math.min(1000, parseInt(qtyMatch[1], 10))) : 1;
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Remove phone and common filler words to infer short item label
  let itemGuess = clean
    .replace(/(?:\+?88)?01[3-9][0-9]{8}/g, '')
    .replace(/(?:please|vai|bhai|ভাই|আসসালামু আলাইকুম|hello|hi|অর্ডার করতে চাই|অর্ডার|নিতে চাই|পাঠিয়ে দিন)/gi, '')
    .trim();

  if (itemGuess.length > 60) {
    itemGuess = itemGuess.slice(0, 57) + '...';
  }
  if (!itemGuess) {
    itemGuess = 'Catalog Product Inquiry';
  }

  return { item: itemGuess, quantity, phone };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportOrdersToCsv(orders: OrderRecord[]): string {
  const headers = [
    'Order ID',
    'Customer Name',
    'Phone',
    'Channel',
    'Item',
    'Quantity',
    'Unit Price',
    'Delivery Fee',
    'Discount',
    'Total',
    'Status',
    'Payment Status',
    'Address',
    'Created At',
  ];

  const rows = orders.map((o) =>
    [
      o.id,
      o.customerName,
      o.phone,
      o.channel,
      o.item,
      o.quantity,
      o.unitPrice,
      o.deliveryFee,
      o.discount,
      o.total,
      o.status,
      o.paymentStatus,
      o.address,
      o.createdAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  // UTF-8 BOM ensures Excel renders Bengali characters cleanly
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function buildInvoiceQrPayload(order: OrderRecord, businessName: string): string {
  return JSON.stringify({
    inv: `INV-${order.id.toUpperCase()}`,
    merchant: businessName || 'Automation CRM',
    customer: order.customerName,
    phone: order.phone,
    total: order.total,
    currency: 'BDT',
    payment: order.paymentStatus,
    status: order.status,
  });
}

export interface PaymentBreakdownStats {
  paidCount: number;
  paidAmount: number;
  partialCount: number;
  partialAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
}

export interface LocationDemandStat {
  location: string;
  orders: number;
  revenue: number;
}

export interface AdvancedDashboardAnalytics {
  filteredOrders: OrderRecord[];
  activeOrdersCount: number;
  totalUnitsSold: number;
  totalRevenue: number;
  paidRevenue: number;
  unpaidBalance: number;
  totalDeliveryFees: number;
  totalDiscounts: number;
  collectionRatePct: number;
  averageOrderValue: number;
  pipeline: Record<OrderStatus, number>;
  paymentBreakdown: PaymentBreakdownStats;
  unpaidActiveCount: number;
  topLocations: LocationDemandStat[];
  channelShares: {
    channel: ChannelType;
    orders: number;
    revenue: number;
    sharePct: number;
  }[];
  topItems: {
    item: string;
    units: number;
    revenue: number;
  }[];
}

export function extractRegionFromAddress(address: string): string {
  const clean = (address || '').trim();
  if (!clean) return 'Dhaka / Local';
  const parts = clean
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Dhaka / Local';
  return parts[parts.length - 1];
}

export function computeAdvancedAnalytics(
  orders: OrderRecord[],
  channelFilter: 'ALL' | ChannelType = 'ALL',
  searchQuery: string = ''
): AdvancedDashboardAnalytics {
  const q = searchQuery.trim().toLowerCase();
  const filteredOrders = orders.filter((o) => {
    if (channelFilter !== 'ALL' && o.channel !== channelFilter) return false;
    if (q) {
      return (
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.item.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const active = filteredOrders.filter((o) => o.status !== 'CANCELLED');
  const cancelled = filteredOrders.filter((o) => o.status === 'CANCELLED');

  const totalRevenue = active.reduce((acc, o) => acc + o.total, 0);
  const paidOrders = active.filter((o) => o.paymentStatus === 'PAID');
  const partialOrders = active.filter((o) => o.paymentStatus === 'PARTIAL');
  const unpaidOrders = active.filter((o) => o.paymentStatus === 'UNPAID');

  const paidRevenue = paidOrders.reduce((acc, o) => acc + o.total, 0);
  const partialAmount = partialOrders.reduce((acc, o) => acc + o.total, 0);
  const unpaidOnlyAmount = unpaidOrders.reduce((acc, o) => acc + o.total, 0);
  const cancelledAmount = cancelled.reduce((acc, o) => acc + o.total, 0);

  const unpaidBalance = Math.max(0, totalRevenue - paidRevenue);
  const collectionRatePct = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0;
  const averageOrderValue = active.length > 0 ? Math.round(totalRevenue / active.length) : 0;
  const totalDeliveryFees = active.reduce((acc, o) => acc + (o.deliveryFee || 0), 0);
  const totalDiscounts = active.reduce((acc, o) => acc + (o.discount || 0), 0);
  const totalUnitsSold = active.reduce((acc, o) => acc + (o.quantity || 0), 0);

  const pipeline: Record<OrderStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  for (const o of filteredOrders) {
    pipeline[o.status] += 1;
  }

  const channelMap: Record<ChannelType, { orders: number; revenue: number }> = {
    WHATSAPP: { orders: 0, revenue: 0 },
    MESSENGER: { orders: 0, revenue: 0 },
    GMAIL: { orders: 0, revenue: 0 },
  };
  for (const o of active) {
    channelMap[o.channel].orders += 1;
    channelMap[o.channel].revenue += o.total;
  }

  const channelShares = (['WHATSAPP', 'MESSENGER', 'GMAIL'] as ChannelType[]).map((ch) => ({
    channel: ch,
    orders: channelMap[ch].orders,
    revenue: channelMap[ch].revenue,
    sharePct: totalRevenue > 0 ? Math.round((channelMap[ch].revenue / totalRevenue) * 100) : 0,
  }));

  const itemTotals = new Map<string, { units: number; revenue: number }>();
  const locationTotals = new Map<string, { orders: number; revenue: number }>();
  for (const o of active) {
    const prev = itemTotals.get(o.item) ?? { units: 0, revenue: 0 };
    itemTotals.set(o.item, {
      units: prev.units + o.quantity,
      revenue: prev.revenue + o.total,
    });

    const loc = extractRegionFromAddress(o.address);
    const prevLoc = locationTotals.get(loc) ?? { orders: 0, revenue: 0 };
    locationTotals.set(loc, {
      orders: prevLoc.orders + 1,
      revenue: prevLoc.revenue + o.total,
    });
  }

  const topItems = Array.from(itemTotals.entries())
    .map(([item, stats]) => ({ item, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  const topLocations = Array.from(locationTotals.entries())
    .map(([location, stats]) => ({ location, ...stats }))
    .sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
    .slice(0, 4);

  return {
    filteredOrders,
    activeOrdersCount: active.length,
    totalUnitsSold,
    totalRevenue,
    paidRevenue,
    unpaidBalance,
    totalDeliveryFees,
    totalDiscounts,
    collectionRatePct,
    averageOrderValue,
    pipeline,
    paymentBreakdown: {
      paidCount: paidOrders.length,
      paidAmount: paidRevenue,
      partialCount: partialOrders.length,
      partialAmount,
      unpaidCount: unpaidOrders.length,
      unpaidAmount: unpaidOnlyAmount,
      cancelledCount: cancelled.length,
      cancelledAmount,
    },
    unpaidActiveCount: partialOrders.length + unpaidOrders.length,
    topLocations,
    channelShares,
    topItems,
  };
}

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case 'PENDING':
      return 'CONFIRMED';
    case 'CONFIRMED':
      return 'SHIPPED';
    case 'SHIPPED':
      return 'DELIVERED';
    default:
      return null;
  }
}

export function formatCurrencyBDT(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `৳${safe.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
