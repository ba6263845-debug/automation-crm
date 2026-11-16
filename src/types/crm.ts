export type Language = 'bn' | 'en';
export type ThemeMode = 'light' | 'dark';
export type AppSurface = 'website' | 'app';
export type WorkspaceTab =
  | 'overview'
  | 'inbox'
  | 'orders'
  | 'invoices'
  | 'automation'
  | 'account'
  | 'admin-licenses';

export type ChannelType = 'WHATSAPP' | 'MESSENGER' | 'GMAIL';
export type RuleChannelType = 'ALL' | ChannelType;
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'PARTIAL';
export type LicenseTier = 'STARTER' | 'GROWTH' | 'ENTERPRISE';
export type LicenseStatus = 'ACTIVE' | 'REVOKED';

export interface AuthSessionUser {
  authenticated: boolean;
  role: 'admin' | 'customer' | null;
  email?: string;
  displayName?: string;
  businessName?: string;
  provider?: 'admin_credentials' | 'google_admin' | 'customer_email' | 'google_customer';
}

export interface AdminLicenseRecord {
  id: string;
  licenseKey: string;
  tier: LicenseTier;
  customerName: string;
  customerEmail: string;
  status: LicenseStatus;
  validDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRecord {
  id: string;
  uid: string;
  customerName: string;
  phone: string;
  channel: ChannelType;
  item: string;
  quantity: number;
  unitPrice: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  uid: string;
  name: string;
  channel: RuleChannelType;
  keywords: string[];
  replyTemplate: string;
  autoExtractOrder: boolean;
  enabled: boolean;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'agent' | 'bot';
  text: string;
  timestamp: string;
  matchedRuleName?: string;
  aiGenerated?: boolean;
}

export interface ConversationThread {
  id: string;
  customerName: string;
  handle: string;
  channel: ChannelType;
  unreadCount: number;
  autoReplyEnabled: boolean;
  lastActivity: string;
  intentTag: string;
  messages: ChatMessage[];
}

export interface BusinessProfile {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  businessAddress: string;
}

export interface AiDraftResult {
  replyText: string;
  detectedIntent: string;
  suggestedStatus: OrderStatus;
  extractedOrder: {
    customerName: string;
    item: string;
    quantity: number;
    unitPrice: number;
    address: string;
  } | null;
}
