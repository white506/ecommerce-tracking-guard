import type { Money } from '../money/money.js';

export type CanonicalOrderItem = Readonly<{
  id: string;
  productId: string | null;
  variantId: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: Money;
  total: Money;
}>;

export type CanonicalRefundItem = Readonly<{
  orderItemId: string | null;
  quantity: number;
  amount: Money;
}>;

export type CanonicalRefund = Readonly<{
  id: string;
  createdAt: string;
  amount: Money;
  items: readonly CanonicalRefundItem[];
}>;

export type CanonicalOrder = Readonly<{
  id: string;
  identifiers: Readonly<{
    legacyResourceId: string | null;
    name: string | null;
    orderNumber: string | null;
    confirmationNumber: string | null;
  }>;
  createdAt: string;
  cancelledAt: string | null;
  currency: string;
  itemSubtotal: Money;
  discounts: Money;
  shipping: Money;
  tax: Money;
  originalTotal: Money;
  currentTotal: Money;
  items: readonly CanonicalOrderItem[];
  refunds: readonly CanonicalRefund[];
}>;
