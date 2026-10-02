/**
 * BasicInfo — zmiana awatara idzie przez backend (SEC-03), nie przez
 * supabase.storage z anon key. Sprawdzamy: wysyłkę, stan ładowania, błędy.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@new/lib/errors/AppError';
import { mockUser } from '@/test/mocks/authFixtures';

const updateUser = vi.fn();
vi.mock('@/_new/lib/auth', () => ({
  useAuth: () => ({ updateUser }),
}));

const uploadAvatar = vi.fn();
vi.mock('../../api/avatarApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/avatarApi')>()),
  uploadAvatar: (file: File) => uploadAvatar(file),
}));

// Gdyby komponent znów sięgnął po klienta Supabase, test ma to wykryć.
const supabaseStorageFrom = vi.fn();
vi.mock('@/_new/lib/supabase/client', () => ({
  supabase: { storage: { from: (bucket: string) => supabaseStorageFrom(bucket) } },
}));

import BasicInfo from './BasicInfo';

function makeFile(type = 'image/png', size = 100, name = 'foto.png'): File {
  return new File([new Uint8Array(size)], name, { type });
}

function selectFile(file: File) {
  const input = document.getElementById('avatar-upload') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

beforeEach(() => {
  updateUser.mockReset();
  uploadAvatar.mockReset();
  supabaseStorageFrom.mockReset();
});

describe('BasicInfo — upload awatara', () => {
  it('wysyła plik do backendu i aktualizuje użytkownika adresem z odpowiedzi', async () => {
    uploadAvatar.mockResolvedValue({ ...mockUser, avatar_url: 'https://x.supabase.co/new.webp' });
    render(<BasicInfo user={mockUser} />);
    const file = makeFile();

    selectFile(file);

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ avatar_url: 'https://x.supabase.co/new.webp' })
    );
    expect(uploadAvatar).toHaveBeenCalledTimes(1);
    expect(uploadAvatar).toHaveBeenCalledWith(file);
    expect(supabaseStorageFrom).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pokazuje stan ładowania i blokuje pole pliku w trakcie wysyłki', async () => {
    let resolveUpload: (value: unknown) => void = () => {};
    uploadAvatar.mockReturnValue(new Promise((resolve) => (resolveUpload = resolve)));
    render(<BasicInfo user={mockUser} />);

    const input = selectFile(makeFile());

    expect(await screen.findByText('Wgrywam...')).toBeInTheDocument();
    expect(input).toBeDisabled();

    resolveUpload({ ...mockUser, avatar_url: 'https://x.supabase.co/new.webp' });

    expect(await screen.findByText('Zmień zdjęcie')).toBeInTheDocument();
    expect(input).not.toBeDisabled();
  });

  it('odrzuca zły typ pliku bez wysyłania czegokolwiek', async () => {
    render(<BasicInfo user={mockUser} />);

    selectFile(makeFile('image/svg+xml', 100, 'x.svg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG lub WEBP/);
    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('odrzuca za duży plik bez wysyłania', async () => {
    render(<BasicInfo user={mockUser} />);

    selectFile(makeFile('image/jpeg', 5 * 1024 * 1024 + 1, 'duze.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/za duże/);
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('pokazuje komunikat backendu przy 400 i nie zmienia użytkownika', async () => {
    uploadAvatar.mockRejectedValue(
      new AppError('Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP', 'INVALID_FILE_TYPE', 400)
    );
    render(<BasicInfo user={mockUser} />);

    selectFile(makeFile());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Plik nie jest poprawnym obrazem JPEG, PNG ani WEBP'
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(screen.getByText('Zmień zdjęcie')).toBeInTheDocument();
  });

  it.each([
    [413, 'FILE_TOO_LARGE', /za duże/],
    [429, 'RATE_LIMITED', /Zbyt wiele prób/],
    [503, 'STORAGE_NOT_CONFIGURED', /Nie udało się zapisać awatara/],
    [0, 'NETWORK_ERROR', /Brak połączenia/],
  ])('mapuje błąd %s (%s) na czytelny komunikat', async (status, code, expected) => {
    uploadAvatar.mockRejectedValue(new AppError('surowy komunikat serwera', code, status));
    render(<BasicInfo user={mockUser} />);

    selectFile(makeFile());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).not.toHaveTextContent('surowy komunikat serwera');
  });

  it('czyści poprzedni błąd po udanej wysyłce', async () => {
    uploadAvatar.mockRejectedValueOnce(new AppError('x', 'APP_ERROR', 500));
    uploadAvatar.mockResolvedValueOnce({ ...mockUser, avatar_url: 'https://x.supabase.co/n.webp' });
    render(<BasicInfo user={mockUser} />);

    selectFile(makeFile());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    selectFile(makeFile());
    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('nic nie robi bez zalogowanego użytkownika', () => {
    render(<BasicInfo user={null} />);

    selectFile(makeFile());

    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});
