/**
 * Typy odpowiedzi API — odzwierciedlają core/responses.py z backendu.
 *
 * Backend zawsze zwraca:
 *   { success: true,  data: T, timestamp: string }
 *   { success: false, error: string, code: string, timestamp: string }
 *
 * ApiResponse<T> to surowy typ z backendu.
 * Axios interceptor automatycznie rozpakowuje data.data → T,
 * więc w plikach API i komponentach operujesz bezpośrednio na T.
 */

/** Sukces — data zawiera T */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/** Błąd - error zawiera komunikat */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
}

/** Union - to co dosłownie wraca z backendu */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * UnwrapApi<T> — helper type który wyciąga T z ApiResponse<T>.
 * Używasz go gdy chcesz opisać co zwraca funkcja z pliku API
 * (już po rozpakowaniu przez interceptor).
 *
 * Przykład:
 *   const result: UnwrapApi<BoardResponse> = await fetchBoard(1);
 *   // result to BoardResponse, nie ApiResponse<BoardResponse>
 */
export type UnwrapApi<T> = T extends ApiResponse<infer U> ? U : T;

/**
 * PaginatedResponse<T> — pomocniczy typ dla list z paginacją.
 * Używaj gdy backend zwraca { items: T[], total, limit, offset }.
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
