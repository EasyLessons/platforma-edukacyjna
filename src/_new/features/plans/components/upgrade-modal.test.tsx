import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpgradeModal } from './upgrade-modal';

describe('UpgradeModal', () => {
  it('zamknięty nic nie renderuje', () => {
    render(<UpgradeModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('otwarty pokazuje tytuł, korzyści i przycisk Zamknij', () => {
    render(<UpgradeModal isOpen onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Przejdź na Premium');
    expect(dialog).toHaveTextContent('Nielimitowana liczba tablic');
    expect(dialog).toHaveTextContent('Nielimitowana liczba workspace’ów');
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
  });

  it('pokazuje powód dla PLAN_LIMIT_BOARDS', () => {
    render(<UpgradeModal isOpen onClose={vi.fn()} reason="PLAN_LIMIT_BOARDS" />);
    expect(screen.getByRole('dialog')).toHaveTextContent('limit tablic w planie Free');
  });

  it('pokazuje powód dla PLAN_LIMIT_WORKSPACES', () => {
    render(<UpgradeModal isOpen onClose={vi.fn()} reason="PLAN_LIMIT_WORKSPACES" />);
    expect(screen.getByRole('dialog')).toHaveTextContent('limit własnych workspace’ów');
  });

  it('pokazuje powód dla PLAN_LIMIT_ELEMENTS', () => {
    render(<UpgradeModal isOpen onClose={vi.fn()} reason="PLAN_LIMIT_ELEMENTS" />);
    expect(screen.getByRole('dialog')).toHaveTextContent('tylko do odczytu');
  });

  it('klik „Zamknij" woła onClose', () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('klik X (aria-label „Zamknij okno") woła onClose', () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij okno' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape zamyka modal', () => {
    const onClose = vi.fn();
    render(<UpgradeModal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
