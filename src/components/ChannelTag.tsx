import React from 'react';
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import type { ChannelType, Language, OrderStatus, PaymentStatus, RuleChannelType } from '../types/crm';

export const ChannelLabel: React.FC<{ channel: RuleChannelType }> = ({ channel }) => {
  if (channel === 'WHATSAPP') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>WhatsApp</span>
      </span>
    );
  }
  if (channel === 'MESSENGER') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
        <MessageSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Messenger</span>
      </span>
    );
  }
  if (channel === 'GMAIL') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400 whitespace-nowrap">
        <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Gmail</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
      <span>All Channels</span>
    </span>
  );
};

export const OrderStatusLabel: React.FC<{ status: OrderStatus; lang: Language }> = ({
  status,
  lang,
}) => {
  const map: Record<
    OrderStatus,
    { bn: string; en: string; color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    PENDING: {
      bn: 'পেন্ডিং',
      en: 'Pending',
      color: 'text-amber-700 dark:text-amber-400',
      Icon: Clock,
    },
    CONFIRMED: {
      bn: 'কনফার্মড',
      en: 'Confirmed',
      color: 'text-indigo-700 dark:text-indigo-400',
      Icon: CheckCircle2,
    },
    SHIPPED: {
      bn: 'শিপড',
      en: 'Shipped',
      color: 'text-sky-700 dark:text-sky-400',
      Icon: Truck,
    },
    DELIVERED: {
      bn: 'ডেলিভার্ড',
      en: 'Delivered',
      color: 'text-emerald-700 dark:text-emerald-400',
      Icon: PackageCheck,
    },
    CANCELLED: {
      bn: 'বাতিল',
      en: 'Cancelled',
      color: 'text-rose-700 dark:text-rose-400',
      Icon: XCircle,
    },
  };
  const cfg = map[status];
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{lang === 'bn' ? cfg.bn : cfg.en}</span>
    </span>
  );
};

export const PaymentStatusLabel: React.FC<{ status: PaymentStatus; lang: Language }> = ({
  status,
  lang,
}) => {
  const map: Record<PaymentStatus, { bn: string; en: string; color: string }> = {
    PAID: { bn: 'পরিশোধিত', en: 'Paid', color: 'text-emerald-700 dark:text-emerald-400' },
    PARTIAL: { bn: 'আংশিক', en: 'Partial', color: 'text-amber-700 dark:text-amber-400' },
    UNPAID: { bn: 'বকেয়া', en: 'Unpaid', color: 'text-slate-600 dark:text-slate-400' },
  };
  const cfg = map[status];
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${cfg.color}`}>
      {lang === 'bn' ? cfg.bn : cfg.en}
    </span>
  );
};

export const CHANNEL_OPTIONS: { value: ChannelType; label: string }[] = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'MESSENGER', label: 'Messenger' },
  { value: 'GMAIL', label: 'Gmail' },
];
