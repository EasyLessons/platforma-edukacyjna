import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardCard } from '../boardCard';
import type { Board } from '../../types';

const board: Board = {
  id: 1,
  name: 'Algebra',
  icon: 'FileText',
  bg_color: 'green-500',
  workspace_id: 7,
  owner_id: 2,
  owner_username: 'editor',
  is_favourite: false,
  last_modified: '2026-10-01T10:00:00Z',
  last_modified_by: null,
  last_opened: null,
};

const renderCard = (canManage: boolean) =>
  render(
    <BoardCard
      board={board}
      canManage={canManage}
      onlineUsers={[]}
      onAction={{ edit: vi.fn(), delete: vi.fn() }}
      onToggleFavourite={vi.fn()}
      onSelect={vi.fn()}
    />
  );

describe('BoardCard - zarządzanie tablicą tylko dla właściciela przestrzeni', () => {
  it('dla właściciela pokazuje zmianę nazwy', () => {
    renderCard(true);
    expect(screen.getAllByTitle('Zmień nazwę').length).toBeGreaterThan(0);
  });

  it('dla edytora/viewera nie pokazuje zmiany nazwy ani menu z usuwaniem, zostaje gwiazdka', () => {
    renderCard(false);
    expect(screen.queryAllByTitle('Zmień nazwę')).toHaveLength(0);
    expect(screen.queryByText('Usuń tablicę')).toBeNull();
    expect(screen.getAllByTitle('Dodaj do ulubionych').length).toBeGreaterThan(0);
  });
});
