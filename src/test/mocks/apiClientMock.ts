import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@new/lib/api/client';

export const apiMock = new MockAdapter(apiClient, { onNoMatch: 'throwException' });

export function resetApiMock() {
  apiMock.reset();
}

export function restoreApiMock() {
  apiMock.restore();
}
