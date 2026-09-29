/**
 * Refresh tokenu nie doszedł do skutku z przyczyn przejściowych: brak sieci, serwer nieosiągalny, itp.
 */
export class RefreshUnavailableError extends Error {
  constructor(message = 'Serwer logowania chwilowo niedostępny') {
    super(message);
    this.name = 'RefreshUnavailableError';
  }
}
