/**
 * useApiClient — zwraca skonfigurowany apiClient.
 *
 * Na razie prosty wrapper. W przyszłości może:
 *   - odczytywać token z AuthContext zamiast localStorage
 *   - zwracać różne instancje per tenant/workspace
 *   - dodawać nagłówki specyficzne dla usera (np. aktywny workspace)
 *
 * Użycie:
 *   const client = useApiClient();
 *   const data = await client.get('/api/v1/boards');
 */
'use client';

import { apiClient } from '@/_new/lib/api';

export function useApiClient() {
  return apiClient;
}
