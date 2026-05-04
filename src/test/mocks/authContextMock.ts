import { vi } from 'vitest';
import type { User } from '@new/shared/types/user';
import { mockUser } from './authFixtures';

export function createMockAuthContext(overrides: Partial<{
  isLoggedIn: boolean;
  user: User | null;
}> = {}) {
  return {
    isLoggedIn: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    ...overrides,
  };
}

export const mockLoggedInAuthContext = createMockAuthContext({
  isLoggedIn: true,
  user: mockUser,
});
