/**
 * Publiczne API feature'a `account` (panel konta uzytkownika).
 * Strona src/app/(dashboard)/account/page.tsx sklada widok wylacznie z tego pliku
 * (PR-A6 z docs/architecture/REFAKTOR-PLAN.md).
 *
 * `ProfileSection` i `Sidebar` sa prawdziwe (dane z /api/v1/auth/me).
 * `AddressBook`, `PaymentMethods`, `SecurityCenter` to makiety - patrz components/_mock/README.md.
 */

export { default as Sidebar } from './components/Sidebar';
export { default as ProfileSection } from './components/ProfileSection';
export { default as AddressBook } from './components/_mock/AddressBook';
export { default as PaymentMethods } from './components/_mock/PaymentMethods';
export { default as SecurityCenter } from './components/_mock/SecurityCenter';
export type { ActiveSection } from './types';
