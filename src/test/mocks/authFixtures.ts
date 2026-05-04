import type { User } from '@new/shared/types/user';
import type { LoginResponse } from '@new/features/auth/types';

export const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockLoginResponse: LoginResponse = {
  access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjo5OTk5OTk5OTk5LCJpYXQiOjE3MzAwMDAwMDB9.fakesig',
  token_type: 'bearer',
  user: mockUser,
};

export const mockValidToken = mockLoginResponse.access_token;

export const mockExpiredToken =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxLCJpYXQiOjF9.fakesig';
