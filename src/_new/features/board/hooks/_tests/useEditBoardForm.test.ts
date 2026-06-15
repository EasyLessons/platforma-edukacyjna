import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditBoardForm } from '../useEditBoardForm';
import { mockBoard } from '@/test/mocks/fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useEditBoardForm', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  const setup = (board = mockBoard) =>
    renderHook(() => useEditBoardForm({ board, onSubmit, onClose }));

  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('inicjalizuje formularz danymi tablicy', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({
      name: mockBoard.name,
      icon: mockBoard.icon,
      bg_color: mockBoard.bg_color,
    });
    expect(result.current.isDirty).toBe(false);
  });

  describe('isDirty', () => {
    it('false na starcie', () => {
      const { result } = setup();
      expect(result.current.isDirty).toBe(false);
    });

    it('true po zmianie nazwy', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona nazwa'); });
      expect(result.current.isDirty).toBe(true);
    });

    it('true po zmianie ikony', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('icon', 'Star'); });
      expect(result.current.isDirty).toBe(true);
    });

    it('false gdy przywrócono oryginalne wartości', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona'); });
      act(() => { result.current.handleChange('name', mockBoard.name); });
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('handleChange', () => {
    it('aktualizuje pole', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Nowa nazwa'); });
      expect(result.current.formData.name).toBe('Nowa nazwa');
    });

    it('czyści błąd pola', async () => {
      const { result } = setup();
      // ustaw błąd przez submit z pustą nazwą
      act(() => { result.current.handleChange('name', ''); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();

      act(() => { result.current.handleChange('name', 'Nowa'); });
      expect(result.current.errors.name).toBeFalsy();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('wywołuje onSubmit z poprawnymi danymi (trim name)', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', '  Zaktualizowana tablica  '); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Zaktualizowana tablica',
        icon: mockBoard.icon,
        bg_color: mockBoard.bg_color,
      });
    });

    it('wywołuje onClose po sukcesie', async () => {
      const { result } = setup();
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('handleSubmit — błędy walidacji', () => {
    it('nie wywołuje onSubmit gdy name jest puste', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', ''); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.errors.name).toBeTruthy();
    });
  });

  describe('handleClose', () => {
    it('przywraca oryginalne wartości tablicy', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona'); });
      act(() => { result.current.handleClose(); });
      expect(result.current.formData.name).toBe(mockBoard.name);
    });

    it('wywołuje onClose', () => {
      const { result } = setup();
      act(() => { result.current.handleClose(); });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
