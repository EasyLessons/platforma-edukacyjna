/**
 * Typy MAKIET panelu konta (adresy, platnosci). Nie maja odpowiednika w backendzie -
 * patrz README.md w tym folderze i docs/known-issues.md #5.
 */
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
