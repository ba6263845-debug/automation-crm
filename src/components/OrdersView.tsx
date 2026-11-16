import React, { useMemo, useState } from 'react';
import {
  Download,
  Minus,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChannelType,
  Language,
  OrderRecord,
  OrderStatus,
  PaymentStatus,
} from '../types/crm';
import {
  calculateOrderTotal,
  exportOrdersToCsv,
  formatCurrencyBDT,
  validateOrderInput,
  type OrderValidationErrors,
} from '../utils/crmLogic';
import { ChannelLabel } from './ChannelTag';

interface OrdersViewProps {
  lang: Language;
  orders: OrderRecord[];
  onAddOrder: (order: Omit<OrderRecord, 'id' | 'uid' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateOrder: (order: OrderRecord) => void;
  onDeleteOrder: (orderId: string) => void;
  onOpenInvoice: (orderId: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  lang,
  orders,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onOpenInvoice,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [channelFilter, setChannelFilter] = useState<'ALL' | ChannelType>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);

  // New Order Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<ChannelType>('WHATSAPP');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('60');
  const [discount, setDiscount] = useState('0');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<OrderValidationErrors>({});

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (statusFilter !== 'ALL' && ord.status !== statusFilter) return false;
      if (channelFilter !== 'ALL' && ord.channel !== channelFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          ord.id.toLowerCase().includes(q) ||
          ord.customerName.toLowerCase().includes(q) ||
          ord.phone.toLowerCase().includes(q) ||
          ord.item.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, channelFilter, search]);

  const filteredSummary = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== 'CANCELLED');
    const sum = active.reduce((acc, o) => acc + o.total, 0);
    return { count: filteredOrders.length, totalSum: sum };
  }, [filteredOrders]);

  const handleExportCsv = () => {
    const csv = exportOrdersToCsv(filteredOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `automation-crm-orders-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setCustomerName('');
    setPhone('');
    setChannel('WHATSAPP');
    setItem('');
    setQuantity('1');
    setUnitPrice('');
    setDeliveryFee('60');
    setDiscount('0');
    setAddress('');
    setNotes('');
    setFormErrors({});
  };

  const handleSubmitNewOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    const priceNum = unitPrice.trim() === '' ? NaN : Number(unitPrice);
    const delivNum = Number(deliveryFee || 0);
    const discNum = Number(discount || 0);

    const errs = validateOrderInput(
      {
        customerName,
        phone,
        channel,
        item,
        quantity: Number.isInteger(qtyNum) ? qtyNum : 0,
        unitPrice: priceNum,
        deliveryFee: delivNum,
        discount: discNum,
        address,
        notes,
      },
      lang
    );

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    const total = calculateOrderTotal(priceNum, qtyNum, delivNum, discNum);
    onAddOrder({
      customerName: customerName.trim(),
      phone: phone.trim(),
      channel,
      item: item.trim(),
      quantity: qtyNum,
      unitPrice: priceNum,
      deliveryFee: delivNum,
      discount: discNum,
      total,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      address: address.trim(),
      notes: notes.trim(),
    });
    resetForm();
    setShowNewModal(false);
  };

  const adjustQuantity = (ord: OrderRecord, delta: number) => {
    const nextQty = Math.max(1, ord.quantity + delta);
    if (nextQty === ord.quantity) return;
    onUpdateOrder({
      ...ord,
      quantity: nextQty,
      total: calculateOrderTotal(ord.unitPrice, nextQty, ord.deliveryFee, ord.discount),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={lang === 'bn' ? 'অর্ডার খুঁজুন' : 'Search orders'}
              placeholder={lang === 'bn' ? 'ক্রেতা, ফোন বা পণ্য...' : 'Search name, phone, item...'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select
            aria-label={lang === 'bn' ? 'চ্যানেল ফিল্টার' : 'Filter by channel'}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as 'ALL' | ChannelType)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">{lang === 'bn' ? 'সব চ্যানেল' : 'All Channels'}</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="MESSENGER">Messenger</option>
            <option value="GMAIL">Gmail</option>
          </select>

          <select
            aria-label={lang === 'bn' ? 'স্ট্যাটাস ফিল্টার' : 'Filter by status'}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OrderStatus)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">{lang === 'bn' ? 'সব স্ট্যাটাস' : 'All Statuses'}</option>
            <option value="PENDING">{lang === 'bn' ? 'পেন্ডিং' : 'Pending'}</option>
            <option value="CONFIRMED">{lang === 'bn' ? 'কনফার্মড' : 'Confirmed'}</option>
            <option value="SHIPPED">{lang === 'bn' ? 'শিপড' : 'Shipped'}</option>
            <option value="DELIVERED">{lang === 'bn' ? 'ডেলিভার্ড' : 'Delivered'}</option>
            <option value="CANCELLED">{lang === 'bn' ? 'বাতিল' : 'Cancelled'}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'bn' ? 'Excel CSV ডাউনলোড' : 'Download CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{lang === 'bn' ? 'নতুন অর্ডার' : 'New Order'}</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {lang === 'bn' ? 'কাস্টমার অর্ডার এক্সেল শিট' : 'Customer Orders Spreadsheet'}
          </span>
          <span className="font-mono tabular-nums">
            {filteredSummary.count} {lang === 'bn' ? 'টি রো' : 'rows'} ·{' '}
            {formatCurrencyBDT(filteredSummary.totalSum)}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {lang === 'bn' ? 'কোনো অর্ডার পাওয়া যায়নি' : 'No orders match the current filter'}
            </p>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{lang === 'bn' ? 'প্রথম অর্ডার যোগ করুন' : 'Log First Order'}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">{lang === 'bn' ? 'ক্রেতা ও ফোন' : 'Customer'}</th>
                  <th className="py-3 px-4">{lang === 'bn' ? 'চ্যানেল' : 'Channel'}</th>
                  <th className="py-3 px-4">{lang === 'bn' ? 'পণ্য ও ঠিকানা' : 'Item & Address'}</th>
                  <th className="py-3 px-4 text-center">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'bn' ? 'মোট (BDT)' : 'Total'}</th>
                  <th className="py-3 px-4">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
                  <th className="py-3 px-4">{lang === 'bn' ? 'পেমেন্ট' : 'Payment'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {ord.id}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-white">{ord.customerName}</p>
                      <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{ord.phone}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <ChannelLabel channel={ord.channel} />
                    </td>
                    <td className="py-3 px-4 max-w-[240px]">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{ord.item}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {ord.address || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-0.5">
                        <button
                          type="button"
                          aria-label={`Decrease quantity for ${ord.id}`}
                          onClick={() => adjustQuantity(ord, -1)}
                          className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums min-w-[18px] text-center">
                          {ord.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity for ${ord.id}`}
                          onClick={() => adjustQuantity(ord, 1)}
                          className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {formatCurrencyBDT(ord.total)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        aria-label={`Order status for ${ord.id}`}
                        value={ord.status}
                        onChange={(e) =>
                          onUpdateOrder({
                            ...ord,
                            status: e.target.value as OrderStatus,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="PENDING">{lang === 'bn' ? 'পেন্ডিং' : 'Pending'}</option>
                        <option value="CONFIRMED">{lang === 'bn' ? 'কনফার্মড' : 'Confirmed'}</option>
                        <option value="SHIPPED">{lang === 'bn' ? 'শিপড' : 'Shipped'}</option>
                        <option value="DELIVERED">{lang === 'bn' ? 'ডেলিভার্ড' : 'Delivered'}</option>
                        <option value="CANCELLED">{lang === 'bn' ? 'বাতিল' : 'Cancelled'}</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        aria-label={`Payment status for ${ord.id}`}
                        value={ord.paymentStatus}
                        onChange={(e) =>
                          onUpdateOrder({
                            ...ord,
                            paymentStatus: e.target.value as PaymentStatus,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="UNPAID">{lang === 'bn' ? 'বকেয়া' : 'Unpaid'}</option>
                        <option value="PARTIAL">{lang === 'bn' ? 'আংশিক' : 'Partial'}</option>
                        <option value="PAID">{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(ord.id)}
                          aria-label={`Generate QR Invoice for ${ord.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          <QrCode className="w-3 h-3" aria-hidden="true" />
                          <span>{lang === 'bn' ? 'ইনভয়েস' : 'Invoice'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteOrder(ord.id)}
                          aria-label={`Delete order ${ord.id}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
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

      {/* Add New Order Modal */}
      {showNewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-order-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 id="new-order-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'নতুন কাস্টমার অর্ডার যোগ করুন' : 'Log New Customer Order'}
              </h2>
              <button
                type="button"
                aria-label="Close new order dialog"
                onClick={() => setShowNewModal(false)}
                className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewOrder} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ord-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'ক্রেতার নাম *' : 'Customer Name *'}
                  </label>
                  <input
                    id="ord-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setFormErrors((prev) => ({ ...prev, customerName: undefined }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {formErrors.customerName && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.customerName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-phone" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'মোবাইল নম্বর *' : 'Phone Number *'}
                  </label>
                  <input
                    id="ord-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setFormErrors((prev) => ({ ...prev, phone: undefined }));
                    }}
                    placeholder="01711223344"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="ord-item" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'পণ্যের নাম *' : 'Product Item *'}
                  </label>
                  <input
                    id="ord-item"
                    type="text"
                    value={item}
                    onChange={(e) => {
                      setItem(e.target.value);
                      setFormErrors((prev) => ({ ...prev, item: undefined }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {formErrors.item && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.item}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-channel" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'চ্যানেল' : 'Channel'}
                  </label>
                  <select
                    id="ord-channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as ChannelType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="MESSENGER">Messenger</option>
                    <option value="GMAIL">Gmail</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="ord-qty" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'পরিমাণ *' : 'Qty *'}
                  </label>
                  <input
                    id="ord-qty"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      setFormErrors((prev) => ({ ...prev, quantity: undefined }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {formErrors.quantity && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.quantity}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-price" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'একক দাম *' : 'Unit Price *'}
                  </label>
                  <input
                    id="ord-price"
                    type="number"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(e.target.value);
                      setFormErrors((prev) => ({ ...prev, unitPrice: undefined }));
                    }}
                    placeholder="1500"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                  {formErrors.unitPrice && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.unitPrice}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="ord-delivery" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'ডেলিভারি' : 'Delivery'}
                  </label>
                  <input
                    id="ord-delivery"
                    type="number"
                    min="0"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="ord-discount" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}
                  </label>
                  <input
                    id="ord-discount"
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ord-address" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'ডেলিভারি ঠিকানা' : 'Delivery Address'}
                </label>
                <input
                  id="ord-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'হিসাবকৃত মোট:' : 'Computed Total:'}{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrencyBDT(
                      calculateOrderTotal(
                        Number(unitPrice) || 0,
                        Number(quantity) || 0,
                        Number(deliveryFee) || 0,
                        Number(discount) || 0
                      )
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    {lang === 'bn' ? 'অর্ডার সেভ করুন' : 'Save Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
