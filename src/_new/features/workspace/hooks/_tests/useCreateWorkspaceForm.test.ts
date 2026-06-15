import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateWorkspaceForm } from '../useCreateWorkspaceForm';
import { DEFAULT_WORKSPACE_ICON, DEFAULT_WORKSPACE_COLOR } from '../../utils/constants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useCreateWorkspaceForm', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  const setup = () => renderHook(() => useCreateWorkspaceForm({ onSubmit, onClose }));

  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('inicjalizuje formularz z domyślnymi wartościami', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({
      name: '',
      icon: DEFAULT_WORKSPACE_ICON,
      bg_color: DEFAULT_WORKSPACE_COLOR,
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });

  it('isReady=false gdy name jest puste', () => {
    const { result } = setup();
    expect(result.current.isReady).toBe(false);
  });

  it('isReady=true gdy name nie jest puste', () => {
    const { result } = setup();
    act(() => { result.current.handleChange('name', 'Mój workspace'); });
    expect(result.current.isReady).toBe(true);
  });

  describe('handleChange', () => {
    it('aktualizuje pole name', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Workspace testowy'); });
      expect(result.current.formData.name).toBe('Workspace testowy');
    });

    it('aktualizuje pole icon', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('icon', 'Rocket'); });
      expect(result.current.formData.icon).toBe('Rocket');
    });

    it('aktualizuje pole bg_color', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('bg_color', 'blue-500'); });
      expect(result.current.formData.bg_color).toBe('blue-500');
    });

    it('czyści błąd pola po zmianie', async () => {
      const { result } = setup();
      // Wywołaj submit z pustą nazwą żeby ustawić błąd
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();
      // Popraw nazwę
      act(() => { result.current.handleChange('name', 'Nowa nazwa'); });
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
        result.current.handleChange('name', 'Workspace');
        result.current.handleChange('icon', '');
      });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.icon).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('ustawia błąd gdy name przekracza 200 znaków', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'a'.repeat(201)); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('wywołuje onSubmit z trimowaną nazwą', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', '  Mój workspace  '); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Mój workspace',
        icon: DEFAULT_WORKSPACE_ICON,
        bg_color: DEFAULT_WORKSPACE_COLOR,
      });
    });

    it('wywołuje onClose po sukcesie', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Workspace'); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onClose).toHaveBeenCalled();
    });

    it('resetuje formularz po sukcesie', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Workspace'); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.formData.name).toBe('');
    });
  });

  describe('handleClose', () => {
    it('wywołuje onClose i resetuje formularz', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Workspace'); });
      act(() => { result.current.handleClose(); });
      expect(onClose).toHaveBeenCalled();
      expect(result.current.formData.name).toBe('');
    });
  });
});
