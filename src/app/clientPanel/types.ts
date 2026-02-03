// TypeScript types for ClientPanel
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatar?: string;
  language: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

export interface Address {
  id: number;
  label: string;
  fullName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: number;
  type: 'credit_card' | 'debit_card' | 'paypal';
  lastFourDigits: string;
  cardHolderName: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover';
}

export type ActiveSection = 'profile' | 'addresses' | 'payments' | 'security';

export interface ClientPanelContextType {
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  user: User | null;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
}
