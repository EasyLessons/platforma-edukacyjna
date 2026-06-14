import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditWorkspaceForm } from '../useEditWorkspaceForm';
import { mockWorkspace } from '@/test/mocks/fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('useEditWorkspaceForm', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  const setup = (workspace = mockWorkspace) =>
    renderHook(() => useEditWorkspaceForm({ workspace, onSubmit, onClose }));

  const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    onSubmit.mockResolvedValue(undefined);
  });

  it('inicjalizuje formularz danymi workspace', () => {
    const { result } = setup();
    expect(result.current.formData).toEqual({
      name: mockWorkspace.name,
      icon: mockWorkspace.icon,
      bg_color: mockWorkspace.bg_color,
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  describe('isDirty', () => {
    it('false na starcie', () => {
      const { result } = setup();
      expect(result.current.isDirty).toBe(false);
    });

    it('true po zmianie nazwy', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona'); });
      expect(result.current.isDirty).toBe(true);
    });

    it('true po zmianie ikony', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('icon', 'Rocket'); });
      expect(result.current.isDirty).toBe(true);
    });

    it('false gdy przywrócono oryginalne wartości', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona'); });
      act(() => { result.current.handleChange('name', mockWorkspace.name); });
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
      act(() => { result.current.handleChange('name', ''); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(result.current.errors.name).toBeTruthy();

      act(() => { result.current.handleChange('name', 'Nowy'); });
      expect(result.current.errors.name).toBeFalsy();
    });
  });

  describe('handleSubmit — ścieżka sukcesu', () => {
    it('wywołuje onSubmit z trimowaną nazwą', async () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', '  Zaktualizowany  '); });
      await act(async () => { await result.current.handleSubmit(fakeEvent); });
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Zaktualizowany',
        icon: mockWorkspace.icon,
        bg_color: mockWorkspace.bg_color,
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
    it('przywraca oryginalne wartości workspace', () => {
      const { result } = setup();
      act(() => { result.current.handleChange('name', 'Zmieniona'); });
      act(() => { result.current.handleClose(); });
      expect(result.current.formData.name).toBe(mockWorkspace.name);
    });

    it('wywołuje onClose', () => {
      const { result } = setup();
      act(() => { result.current.handleClose(); });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
