import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateBoardForm } from '../useCreateBoardForm';
import { DEFAULT_BOARD_ICON, DEFAULT_BOARD_COLOR } from '../../utils/constants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useCreateBoardForm', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  const setup = () =>
    renderHook(() => useCreateBoardForm({ workspace_id: 10, onSubmit, onClose }));

  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('inicjalizuje formularz z domyślnymi wartościami', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({
      name: '',
      icon: DEFAULT_BOARD_ICON,
      bg_color: DEFAULT_BOARD_COLOR,
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.submitError).toBe('');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('isReady=false gdy name jest puste', () => {
    const { result } = setup();
    expect(result.current.isReady).toBe(false);
  });

  it('isReady=true gdy name nie jest puste', () => {
    const { result } = setup();
    act(() => { result.current.handleChange('name', 'Moja tablica'); });
    expect(result.current.isReady).toBe(true);
  });

  describe('handleChange', () => {
    it('aktualizuje pole name', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Nowa tablica'); });
      expect(result.current.formData.name).toBe('Nowa tablica');
    });

    it('aktualizuje pole icon', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('icon', 'Star'); });
      expect(result.current.formData.icon).toBe('Star');
    });

    it('aktualizuje pole bg_color', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('bg_color', 'blue-500'); });
      expect(result.current.formData.bg_color).toBe('blue-500');
    });

    it('czyści błąd pola po zmianie wartości', async () => {
      const { result } = setup();
      // Wywołaj submit z pustą nazwą żeby ustawić błąd
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();
      // Popraw nazwę — błąd powinien zniknąć
      act(() => { result.current.handleChange('name', 'Dobra nazwa'); });
      expect(result.current.errors.name).toBeFalsy();
    });
  });

  describe('walidacja', () => {
    it('ustawia błąd gdy name jest puste', async () => {
      const { result } = setup();
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('ustawia błąd gdy icon jest puste', async () => {
      const { result } = setup();
      act(() => {
        result.current.handleChange('name', 'Tablica');
        result.current.handleChange('icon', '');
      });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.icon).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('wywołuje onSubmit z poprawnymi danymi (trim name)', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', '  Moja tablica  '); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Moja tablica',
        icon: DEFAULT_BOARD_ICON,
        bg_color: DEFAULT_BOARD_COLOR,
        workspace_id: 10,
      });
    });

    it('wywołuje onClose po sukcesie', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Tablica'); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onClose).toHaveBeenCalled();
    });

    it('resetuje formularz po sukcesie', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Tablica'); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.formData.name).toBe('');
    });

    it('ustawia isSubmitting=true podczas operacji, false po zakończeniu', async () => {
      let resolveFn!: () => void;
      onSubmit.mockImplementation(
        () => new Promise<void>((resolve) => { resolveFn = resolve; })
      );

      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Tablica'); });

      let submitPromise!: Promise<void>;
      act(() => { submitPromise = result.current.handleSubmit(fakeEvent) as unknown as Promise<void>; });

      expect(result.current.isSubmitting).toBe(true);
      act(() => resolveFn());
      await act(async () => { await submitPromise; });
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('handleClose', () => {
    it('wywołuje onClose', () => {
      const { result } = setup();
      act(() => { result.current.handleClose(); });
      expect(onClose).toHaveBeenCalled();
    });

    it('resetuje formularz', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Jakieś dane'); });
      act(() => { result.current.handleClose(); });
      expect(result.current.formData.name).toBe('');
    });
  });
});
