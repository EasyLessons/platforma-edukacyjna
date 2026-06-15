import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost/',
      origin: 'http://localhost',
      pathname: '/',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
  });
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
  vi.clearAllMocks();
});